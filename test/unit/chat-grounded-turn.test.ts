import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
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
// The grounded system instruction alone costs 504 conservative input tokens.
// Keep enough room for it while testing evidence truncation separately.
const capabilities = { conversationalText: true, streaming: true, contextWindowTokens: 2048 };

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

test('local Pi discovery is project-bound, read-only and records safe source activity', async () => {
  const root = await fixture();
  await symlink('../manual.txt', join(root, 'test', 'linked.txt'));
  await writeFile(join(root, 'test', 'binary.dat'), Buffer.from([0, 1, 2]));
  await writeFile(join(root, 'test', 'large.txt'), 'x'.repeat(70_000));
  const repository = new ChatRepository();
  const grounder = new ChatProjectGrounder(noMap as never);
  const composer = new ChatContextComposer({} as never, {} as never, noMap as never, repository);
  const calls: string[] = [];
  const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
    models: [{ id: 'chat', label: 'Chat', usable: true, capabilities: { ...capabilities, contextWindowTokens: 8192 } }] }] }),
    async *generate(_selection: typeof target, request: { projectTools?: {
      root: string; execute(name: string, args: unknown, signal?: AbortSignal): Promise<string> } }) {
      assert.equal(request.projectTools?.root, root);
      const tools = request.projectTools!;
      calls.push(JSON.parse(await tools.execute('dope_list', { path: '' })).text);
      calls.push(JSON.parse(await tools.execute('dope_search_paths', { query: 'chat.test.ts' })).text);
      calls.push(JSON.parse(await tools.execute('dope_search_text', { query: 'Chat persistence' })).text);
      calls.push(JSON.parse(await tools.execute('dope_read', { path: 'test/chat.test.ts' })).text);
      const large = JSON.parse(await tools.execute('dope_read', { path: 'test/large.txt' }));
      assert.equal(large.truncated, true);
      assert.ok(large.text.length <= 8192);
      for (const [name, args] of [
        ['dope_read', { path: '.dope/private.json' }], ['dope_read', { path: '../other' }],
        ['dope_read', { path: 'test/linked.txt' }], ['dope_read', { path: 'test/binary.dat' }],
        ['dope_process', { command: 'echo unsafe' }], ['dope_edit', { path: 'package.json', content: 'unsafe' }]
      ] as const) await assert.rejects(tools.execute(name, args), /denied/);
      const cancelled = new AbortController(); cancelled.abort();
      await assert.rejects(tools.execute('dope_read', { path: 'package.json' }, cancelled.signal), /cancelled/);
      yield { type: 'complete' as const, text: 'The project contains ChatRepository source.', actualModelId: 'chat',
        finishReason: 'stop', usage: { tokenMeasurement: 'unavailable' as const } };
    } };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer, undefined, grounder);
  try {
    const turn = await open(service, root);
    await service.runTurn({ ...turn, selectedModel: target, content: 'inspect this project', context: [] });
    assert.match(calls[0], /package.json/);
    assert.match(calls[1], /test\/chat.test.ts/);
    assert.match(calls[2], /ChatRepository/);
    assert.match(calls[3], /ChatRepository/);
    const saved = (await service.get(turn.projectHandle, turn.chatId))!.messages.at(-1);
    assert.equal(saved?.role, 'assistant');
    if (saved?.role !== 'assistant') return;
    assert.deepEqual(saved.execution.toolEvents?.map(event => [event.name, event.status]), [
      ['dope_list', 'completed'], ['dope_search_paths', 'completed'], ['dope_search_text', 'completed'],
      ['dope_read', 'completed'], ['dope_read', 'completed'], ['dope_read', 'denied'], ['dope_read', 'denied'],
      ['dope_read', 'denied'], ['dope_read', 'denied']
    ]);
    assert.deepEqual(saved.execution.sourceRefs?.map(ref => ref.kind), ['directory', 'path-search', 'text-search', 'file', 'file']);
    assert.equal(saved.execution.toolEvents?.[4].truncated, true);
    assert.ok(saved.execution.sourceRefs?.every(ref => ref.projectId && ref.contentHash?.length === 64));
    assert.equal(JSON.stringify(saved).includes('unsafe'), false);
    assert.equal((await readFile(join(root, 'package.json'), 'utf8')), '{"name":"grounded"}');
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

test('small viable input windows report omitted Auto evidence and never exceed the model budget', async () => {
  const root = await fixture();
  const { service, sent } = setup(root, { window: 550 });
  try {
    const turn = await open(service, root);
    const state = await service.read(turn.projectHandle);
    const settings = structuredClone(state.chats[0].settings);
    settings.context.reservedOutputTokens = 0;
    settings.context.maxInputTokens = 550;
    await service.mutate({ projectHandle: turn.projectHandle, expectedRevision: state.revision,
      operation: { type: 'set-settings', chatId: turn.chatId, settings } });
    const preview = await service.runTurn({ ...turn, selectedModel: target, content: 'what is in test/?' });
    assert.ok(preview.usedTokens <= preview.budgetTokens);
    assert.ok(preview.diagnostics.some(item => item.kind === 'omitted' || item.kind === 'truncated'));
    assert.ok(preview.refs.some(ref => ref.origin === 'automatic' && ref.includedBytes === 0));
    assert.equal(sent.length, 1);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('input window below the grounded instruction minimum fails before model generation', async () => {
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
    await assert.rejects(service.runTurn({ ...turn, selectedModel: target, content: 'what is in test/?' }),
      /Message exceeds selected model input budget/);
    assert.equal(sent.length, 0);
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
      capabilities: { ...capabilities, contextWindowTokens: 900 } }] },
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
      assert.equal(selected.budgetTokens, 900);
      assert.ok(selected.usedTokens <= selected.budgetTokens);
      assert.deepEqual(selected.refs.map(ref => [ref.kind, ref.id]), initial.refs.map(ref => [ref.kind, ref.id]));
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
