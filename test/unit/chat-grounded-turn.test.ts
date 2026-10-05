import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer, GROUNDED_CHAT_INSTRUCTION } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { parseRoutingProvenance } from '../../packages/ai/lib/index.js';

const noMap = { snapshot: () => undefined, status: () => ({ state: 'uninitialized' }), inputsCurrent: async () => false };
const target = { connectionId: 'local', modelId: 'chat' };
const capabilities = { conversationalText: true, streaming: true, contextWindowTokens: 1200 };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dope-grounded-turn-'));
  await mkdir(join(root, 'test'));
  await writeFile(join(root, 'test', 'chat.test.ts'), 'Chat persistence is in ChatRepository.');
  await writeFile(join(root, 'manual.txt'), 'MANUAL FACT');
  await writeFile(join(root, 'package.json'), '{"name":"grounded"}');
  return root;
}

function setup(root: string, options: { fail?: boolean; window?: number } = {}) {
  const repository = new ChatRepository();
  const sent: Array<{ target: string; messages: Array<{ role: string; content: string }> }> = [];
  let fail = options.fail ?? false;
  const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
    models: [{ id: 'chat', label: 'Chat', usable: true, capabilities: { ...capabilities,
      contextWindowTokens: options.window ?? capabilities.contextWindowTokens } }] }] }),
    async *generate(selected: typeof target, request: { messages: Array<{ role: string; content: string }> }) {
      sent.push({ target: selected.connectionId, messages: request.messages });
      if (fail) { fail = false; throw new Error('Temporary model failure'); }
      yield { type: 'complete' as const, text: 'Grounded answer' };
    } };
  const grounder = new ChatProjectGrounder(noMap as never);
  const composer = new ChatContextComposer({} as never, {} as never, noMap as never, repository);
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer, undefined, grounder);
  return { repository, service, sent, failNext: () => { fail = true; } };
}

async function open(service: ChatBackend, root: string) {
  const { projectHandle } = await service.attach(pathToFileURL(root).href);
  const chatId = randomUUID();
  await service.mutate({ projectHandle, expectedRevision: 0,
    operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Pinned' } });
  const lease = await service.claim({ projectHandle, chatId, ownerId: 'test' });
  if (!lease.acquired) assert.fail('Chat lease unavailable');
  return { projectHandle, chatId, leaseToken: lease.token };
}

test('ordinary Chat supplies local listing/search evidence, orientation, manual context and persisted Auto refs', async () => {
  const root = await fixture();
  const { service, sent } = setup(root);
  try {
    const turn = await open(service, root);
    let state = await service.read(turn.projectHandle);
    const settings = structuredClone(state.chats[0].settings);
    settings.context.allowedSources = ['file'];
    state = await service.mutate({ projectHandle: turn.projectHandle, expectedRevision: state.revision,
      operation: { type: 'set-settings', chatId: turn.chatId, settings } });
    const preview = await service.previewContext({ projectHandle: turn.projectHandle, chatId: turn.chatId,
      selectedModel: target, content: 'what is in test/?', context: [] });
    assert.ok(preview.refs.some(ref => ref.origin === 'automatic' && ref.kind === 'directory'));
    const result = await service.runTurn({ ...turn, selectedModel: target, content: 'what is in test/?', context: [] });
    assert.ok(result.refs.some(ref => ref.origin === 'automatic' && ref.id === 'test'));
    assert.match(sent[0].messages.at(-1)!.content, /chat\.test\.ts/);
    assert.equal(sent[0].messages[0].role, 'system');
    assert.equal(sent[0].messages[0].content, GROUNDED_CHAT_INSTRUCTION);
    assert.doesNotMatch(JSON.stringify(sent[0]), new RegExp(root));
    const saved = (await service.read(turn.projectHandle)).chats[0].messages[0];
    assert.equal(saved.role, 'user');
    if (saved.role === 'user') {
      assert.deepEqual(saved.contextRefs, result.refs);
      assert.ok(saved.contextRefs.every(ref => ref.origin === 'automatic' && ref.contentHash?.length === 64));
    }
    await service.runTurn({ ...turn, selectedModel: target, content: 'where is Chat persistence implemented?', context: [] });
    assert.match(sent[1].messages.at(-1)!.content, /Project path search|Project text search/);
    await service.runTurn({ ...turn, selectedModel: target, content: 'hello there', context: [] });
    assert.doesNotMatch(sent[2].messages.at(-1)!.content, /Project path search|Project text search|chat\.test\.ts/);
    await service.runTurn({ ...turn, selectedModel: target, content: 'Read manual.txt',
      context: [{ kind: 'file', id: 'manual.txt' }] });
    assert.match(sent[3].messages.at(-1)!.content, /MANUAL FACT/);
    const finalUser = (await service.read(turn.projectHandle)).chats[0].messages.at(-2);
    assert.equal(finalUser?.role, 'user');
    if (finalUser?.role === 'user') assert.ok(finalUser.contextRefs.some(ref => ref.origin !== 'automatic' && ref.id === 'manual.txt'));
    assert.ok(result.usedTokens <= result.budgetTokens);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('retry keeps evidence identity and refuses changed evidence before a second model request', async () => {
  const root = await fixture();
  const { service, sent, failNext } = setup(root, { fail: true });
  try {
    const turn = await open(service, root);
    await assert.rejects(service.runTurn({ ...turn, selectedModel: target, content: 'what is in test/?' }), /Temporary/);
    const failed = (await service.read(turn.projectHandle)).chats[0].messages.at(-1);
    assert.equal(failed?.role, 'assistant');
    if (failed?.role !== 'assistant') return;
    await service.runTurn({ ...turn, selectedModel: target, retryMessageId: failed.id });
    assert.equal(sent.length, 2);
    failNext();
    await assert.rejects(service.runTurn({ ...turn, selectedModel: target, content: 'what is in test/?' }), /Temporary/);
    const changedAttempt = (await service.read(turn.projectHandle)).chats[0].messages.at(-1);
    assert.equal(changedAttempt?.role, 'assistant');
    if (changedAttempt?.role !== 'assistant') return;
    await writeFile(join(root, 'test', 'new.test.ts'), 'Changed listing');
    await assert.rejects(service.runTurn({ ...turn, selectedModel: target, retryMessageId: changedAttempt.id }),
      /Retry project evidence changed or is stale/);
    assert.equal(sent.length, 3);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('small input windows report omitted Auto evidence and never exceed the model budget', async () => {
  const root = await fixture();
  const { service, sent } = setup(root, { window: 110 });
  try {
    const turn = await open(service, root);
    const state = await service.read(turn.projectHandle);
    const settings = structuredClone(state.chats[0].settings);
    settings.context.reservedOutputTokens = 0;
    settings.context.maxInputTokens = 110;
    await service.mutate({ projectHandle: turn.projectHandle, expectedRevision: state.revision,
      operation: { type: 'set-settings', chatId: turn.chatId, settings } });
    const preview = await service.runTurn({ ...turn, selectedModel: target, content: 'what is in test/?' });
    assert.ok(preview.usedTokens <= preview.budgetTokens);
    assert.ok(preview.diagnostics.some(item => item.kind === 'omitted' || item.kind === 'truncated'));
    assert.ok(preview.refs.some(ref => ref.origin === 'automatic' && ref.includedBytes === 0));
    assert.equal(sent.length, 1);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('grounding only writes Chat state and no project authority or map input', async () => {
  const root = await fixture();
  const { service } = setup(root);
  try {
    await mkdir(join(root, '.dope'));
    for (const name of ['architecture.json', 'project-mind.json', 'planning-maps.json'])
      await writeFile(join(root, '.dope', name), `fixture-${name}`);
    const before = await Promise.all(['architecture.json', 'project-mind.json', 'planning-maps.json']
      .map(name => readFile(join(root, '.dope', name), 'utf8')));
    const turn = await open(service, root);
    await service.runTurn({ ...turn, selectedModel: target, content: 'what is in test/?' });
    const after = await Promise.all(['architecture.json', 'project-mind.json', 'planning-maps.json']
      .map(name => readFile(join(root, '.dope', name), 'utf8')));
    assert.deepEqual(after, before);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('Interactive fallback reuses selected Auto evidence and hosted egress requires authorization', async () => {
  const root = await fixture();
  for (let i = 0; i < 50; i++) await writeFile(join(root, 'test', `extra-${i}.test.ts`), 'extra');
  const repository = new ChatRepository();
  const grounder = new ChatProjectGrounder(noMap as never);
  const composer = new ChatContextComposer({} as never, {} as never, noMap as never, repository);
  const first = { connectionId: 'local', modelId: 'chat' };
  const second = { connectionId: 'hosted', modelId: 'chat' };
  let preferHosted = true;
  const sent: Array<{ target: string; content: string }> = [];
  const models = { list: async () => ({ connections: [
    { id: 'local', ready: true, providerId: 'local', models: [{ id: 'chat', label: 'Local', usable: true, capabilities }] },
    { id: 'hosted', ready: true, providerId: 'hosted', models: [{ id: 'chat', label: 'Hosted', usable: true,
      capabilities: { ...capabilities, contextWindowTokens: 400 } }] },
  ] }), async *generate() { assert.fail('role turn bypassed routing'); } };
  const routing = { async resolve(_role: string, _hard: unknown, authorized: boolean) {
    const selectedTarget = preferHosted ? second : first;
    return { inventory: { models: [
      { ...first, providerModelKey: 'chat', locality: 'local' },
      { ...second, providerModelKey: 'chat', locality: 'hosted' },
    ] }, resolution: { selectedTarget: preferHosted && !authorized ? undefined : selectedTarget } };
  }, async *generate(request: { hostedProjectDataAuthorized: boolean;
    conversation: (target: typeof first) => Promise<{ messages: Array<{ content: string }> }> }) {
    const original = await request.conversation(first);
    sent.push({ target: 'local', content: original.messages.at(-1)!.content });
    assert.equal(request.hostedProjectDataAuthorized, true);
    const fallback = await request.conversation(second);
    sent.push({ target: 'hosted', content: fallback.messages.at(-1)!.content });
    yield { type: 'complete' as const, text: 'Answer', routingProvenance: parseRoutingProvenance({
      version: 1, source: 'role-policy', requestedRole: 'interactive', policyRevision: 1,
      effectiveHard: { requiredCapabilities: ['conversationalText', 'streaming'], locality: 'any', enabledOnly: true,
        usableOnly: true, hostedProjectData: 'requires-feature-authorization' },
      preferredTarget: first, actualTarget: second,
      executionLabels: { connection: 'Hosted', provider: 'hosted', model: 'Hosted' },
      attempts: [{ target: first, outcome: 'transient-transport' }, { target: second, outcome: 'selected' }],
    }) };
  } };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer,
    routing as never, grounder);
  try {
    const turn = await open(service, root);
    const current = await service.read(turn.projectHandle);
    const settings = structuredClone(current.chats[0].settings);
    settings.context.reservedOutputTokens = 0;
    settings.context.maxInputTokens = 1200;
    await service.mutate({ projectHandle: turn.projectHandle, expectedRevision: current.revision,
      operation: { type: 'set-settings', chatId: turn.chatId, settings } });
    const initial = await service.previewContext({ projectHandle: turn.projectHandle, chatId: turn.chatId,
      selectedModel: first, content: 'what is in test/?', context: [] });
    await assert.rejects(service.runTurn({ ...turn, content: 'what is in test/?' }), /hosted egress confirmation required/);
    assert.equal(sent.length, 0);
    preferHosted = false;
    const selected = await service.runTurn({ ...turn, content: 'what is in test/?', hostedProjectDataAuthorized: true });
    assert.equal(sent.length, 2);
    assert.match(sent[0].content, /chat\.test\.ts/);
    assert.match(sent[1].content, /chat\.test\.ts/);
    const state = await service.read(turn.projectHandle);
    const user = state.chats[0].messages[0];
    assert.equal(user.role, 'user');
    if (user.role === 'user') {
      assert.deepEqual(user.contextRefs, selected.refs);
      assert.ok(user.contextRefs.some(ref => ref.origin === 'automatic' && ref.kind === 'directory'));
      assert.equal(selected.budgetTokens, 400);
      assert.ok((selected.refs.find(ref => ref.kind === 'directory')?.includedBytes ?? 0) <
        (initial.refs.find(ref => ref.kind === 'directory')?.includedBytes ?? 0));
    }
    preferHosted = true;
    await assert.rejects(service.runTurn({ ...turn, content: 'what is in test/?' }), /hosted egress confirmation required/);
    assert.equal(sent.length, 2);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('a new project handle selects only the new project evidence', async () => {
  const firstRoot = await fixture();
  const secondRoot = await fixture();
  await rm(join(secondRoot, 'test', 'chat.test.ts'));
  await writeFile(join(secondRoot, 'test', 'different.test.ts'), 'second project');
  const first = setup(firstRoot), second = setup(secondRoot);
  try {
    const a = await open(first.service, firstRoot);
    await first.service.runTurn({ ...a, selectedModel: target, content: 'what is in test/?' });
    const b = await open(second.service, secondRoot);
    await second.service.runTurn({ ...b, selectedModel: target, content: 'what is in test/?' });
    assert.match(first.sent[0].messages.at(-1)!.content, /chat\.test\.ts/);
    assert.match(second.sent[0].messages.at(-1)!.content, /different\.test\.ts/);
    assert.doesNotMatch(second.sent[0].messages.at(-1)!.content, /chat\.test\.ts/);
    assert.throws(() => second.service.read(a.projectHandle), /Invalid or disposed Chat handle/);
  } finally {
    first.service.dispose(); second.service.dispose();
    await rm(firstRoot, { recursive: true, force: true });
    await rm(secondRoot, { recursive: true, force: true });
  }
});
