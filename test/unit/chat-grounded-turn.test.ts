import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
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

test('Pi Chat sends workspace identity without automatic source and retains explicit file context', async () => {
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
    assert.equal(preview.refs.some(ref => ref.origin === 'automatic'), false);
    const result = await service.runTurn({ ...turn, selectedModel: target, content: 'what is in test/?', context: [] });
    assert.equal(result.refs.some(ref => ref.origin === 'automatic'), false);
    assert.doesNotMatch(JSON.stringify(sent[0]), /Chat persistence|chat\.test\.ts/);
    assert.equal(sent[0].messages[0].role, 'system');
    assert.match(sent[0].messages[0].content, /Pi read_file/);
    assert.match(sent[0].messages[0].content, new RegExp(root));
    const saved = (await service.read(turn.projectHandle)).chats[0].messages[0];
    assert.equal(saved.role, 'user');
    if (saved.role === 'user') {
      assert.deepEqual(saved.contextRefs, result.refs);
      assert.equal(saved.contextRefs.length, 0);
    }
    await service.runTurn({ ...turn, selectedModel: target, content: 'where is Chat persistence implemented?', context: [] });
    assert.doesNotMatch(sent[1].messages.at(-1)!.content, /Project path search|Project text search|ChatRepository/);
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
      calls.push(JSON.parse(await tools.execute('list_files', { path: '' })).text);
      calls.push(JSON.parse(await tools.execute('search_paths', { query: 'chat.test.ts' })).text);
      calls.push(JSON.parse(await tools.execute('search_text', { query: 'Chat persistence' })).text);
      calls.push(JSON.parse(await tools.execute('read_file', { path: 'test/chat.test.ts' })).text);
      const large = JSON.parse(await tools.execute('read_file', { path: 'test/large.txt' }));
      assert.equal(large.truncated, true);
      assert.ok(large.text.length <= 8192);
      for (const [name, args] of [
        ['read_file', { path: '.dope/private.json' }], ['read_file', { path: '../other' }],
        ['read_file', { path: 'test/linked.txt' }], ['read_file', { path: 'test/binary.dat' }],
        ['edit_file', { path: 'package.json', content: 'unsafe' }]
      ] as const) await assert.rejects(tools.execute(name, args), /denied/);
      assert.match(await tools.execute('run_command', { command: '' }), /Command denied/);
      const cancelled = new AbortController(); cancelled.abort();
      await assert.rejects(tools.execute('read_file', { path: 'package.json' }, cancelled.signal), /cancelled/);
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
      ['list_files', 'completed'], ['search_paths', 'completed'], ['search_text', 'completed'],
      ['read_file', 'completed'], ['read_file', 'completed'], ['read_file', 'denied'], ['read_file', 'denied'],
      ['read_file', 'denied'], ['read_file', 'denied'], ['run_command', 'denied']
    ]);
    assert.deepEqual(saved.execution.sourceRefs?.map(ref => ref.kind), ['directory', 'path-search', 'text-search', 'file', 'file']);
    assert.ok(saved.execution.sourceRefs?.every(ref => ref.origin === 'tool'));
    assert.equal(saved.execution.toolEvents?.[4].truncated, true);
    assert.ok(saved.execution.sourceRefs?.every(ref => ref.projectId && ref.contentHash?.length === 64));
    const activity = saved.activity?.events.filter(event => event.kind === 'tool').map(event => event.text) ?? [];
    assert.ok(activity.includes('read_file: running · test/chat.test.ts'));
    assert.ok(activity.includes('read_file: completed · test/chat.test.ts'));
    assert.ok(activity.includes('read_file: denied'));
    assert.ok(activity.every(text => !text.includes('../other')));
    assert.equal(JSON.stringify(saved).includes('unsafe'), false);
    assert.equal((await readFile(join(root, 'package.json'), 'utf8')), '{"name":"grounded"}');
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('Chat ranged read errors are recoverable and saved without false file evidence', async () => {
  const root = await fixture();
  const content = `${'line of evidence\n'.repeat(650)}TAIL-NEBULA-9247\n`;
  await writeFile(join(root, 'long.md'), content);
  const repository = new ChatRepository();
  const grounder = new ChatProjectGrounder(noMap as never);
  const composer = new ChatContextComposer({} as never, {} as never, noMap as never, repository);
  const replies: string[] = [];
  const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
    models: [{ id: 'chat', label: 'Chat', usable: true, capabilities: { ...capabilities,
      contextWindowTokens: 8192 } }] }] }),
    async *generate(_selection: typeof target, request: { projectTools?: {
      execute(name: string, args: unknown): Promise<string> } }) {
      const read = (args: unknown) => request.projectTools!.execute('read_file', args);
      replies.push(await read({ path: 'long.md', offset: 9000 }));
      replies.push(await read({ path: 'long.md', offset: -1 }));
      const first = JSON.parse(await read({ path: 'long.md', offset: 0 }));
      assert.equal(first.offset, 0);
      const later = JSON.parse(await read({ path: 'long.md', offset: 9000,
        expectedSourceHash: first.sourceHash }));
      assert.match(later.text, /line of evidence/);
      assert.ok(later.endOffset > 8192);
      await assert.rejects(read({ path: '.dope/state', offset: 0 }), /denied/);
      yield { type: 'complete' as const, text: 'Read completed', actualModelId: 'chat',
        finishReason: 'stop', usage: { tokenMeasurement: 'unavailable' as const } };
    } };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer, undefined, grounder);
  try {
    const turn = await open(service, root);
    await service.runTurn({ ...turn, selectedModel: target, content: 'Inspect long.md', context: [] });
    assert.match(replies[0], /SOURCE_IDENTITY_REQUIRED/);
    assert.match(replies[1], /INVALID_OFFSET/);
    const saved = (await service.get(turn.projectHandle, turn.chatId))!.messages.at(-1);
    assert.equal(saved?.role, 'assistant');
    if (saved?.role !== 'assistant') return;
    assert.deepEqual(saved.execution.toolEvents?.map(event => event.status),
      ['failed', 'failed', 'completed', 'completed', 'denied']);
    assert.deepEqual(saved.execution.toolEvents?.slice(0, 2).map(event => event.brokerExecuted), [false, false]);
    assert.equal(saved.execution.toolEvents?.[0].code, 'SOURCE_IDENTITY_REQUIRED');
    assert.equal(saved.execution.sourceRefs?.length, 2);
    assert.ok(saved.execution.sourceRefs?.every(ref => ref.kind === 'file'));
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('explicit no-tool Chat omits the project broker while read-only requests retain it', async () => {
  const root = await fixture();
  const repository = new ChatRepository();
  const grounder = new ChatProjectGrounder(noMap as never);
  const composer = new ChatContextComposer({} as never, {} as never, noMap as never, repository);
  const exposed: boolean[] = [];
  const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
    models: [{ id: 'chat', label: 'Chat', usable: true, capabilities: { ...capabilities, contextWindowTokens: 8192 } }] }] }),
    async *generate(_selection: typeof target, request: { projectTools?: { root: string } }) {
      exposed.push(!!request.projectTools);
      yield { type: 'complete' as const, text: '2', actualModelId: 'chat', finishReason: 'stop',
        usage: { tokenMeasurement: 'unavailable' as const } };
    } };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer, undefined, grounder);
  try {
    const turn = await open(service, root);
    await service.previewContext({ projectHandle: turn.projectHandle, chatId: turn.chatId,
      selectedModel: target, content: 'What is 1+1? Do not call tools.', context: [] });
    await service.runTurn({ ...turn, selectedModel: target, content: 'What is 1+1? Do not call tools.', context: [] });
    await service.runTurn({ ...turn, selectedModel: target,
      content: 'Read manual.txt. Do not modify files or execute commands.', context: [] });
    assert.deepEqual(exposed, [false, true]);
    const messages = (await service.get(turn.projectHandle, turn.chatId))!.messages;
    assert.equal(messages[1].role, 'assistant');
    if (messages[1].role === 'assistant') assert.equal(messages[1].execution.toolEvents?.length ?? 0, 0);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('Pi reads the named source through its tool, keeps related bytes out, and preserves explicit selections', async () => {
  const root = await fixture();
  await mkdir(join(root, 'src'));
  const source = 'export const counter = () => 7; // PI_READ_ONLY_FACT';
  await writeFile(join(root, 'src', 'counter.js'), source);
  await writeFile(join(root, 'src', 'related.js'), 'RELATED_PRIVATE_SENTINEL');
  const repository = new ChatRepository();
  const grounder = new ChatProjectGrounder(noMap as never);
  const composer = new ChatContextComposer({} as never, {} as never, noMap as never, repository);
  const requests: string[] = [];
  const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
    models: [{ id: 'chat', label: 'Pi', usable: true, capabilities: { ...capabilities, contextWindowTokens: 8192 } }] }] }),
    async *generate(_selection: typeof target, request: { messages: Array<{ role: string; content: string }>;
      projectTools?: { execute(name: string, args: unknown): Promise<string> } }) {
      const prompt = JSON.stringify(request.messages);
      requests.push(prompt);
      assert.match(prompt, /src\/counter\.js/);
      assert.doesNotMatch(prompt, /PI_READ_ONLY_FACT|RELATED_PRIVATE_SENTINEL/);
      assert.ok(request.projectTools);
      const result = JSON.parse(await request.projectTools!.execute('read_file', { path: 'src/counter.js' }));
      assert.equal(result.text, source);
      assert.equal(result.source, 'src/counter.js');
      await assert.rejects(request.projectTools!.execute('edit_file',
        { path: 'src/counter.js', content: 'changed' }), /denied/);
      yield { type: 'complete' as const, text: 'The counter returns 7.', actualModelId: 'chat',
        finishReason: 'stop', usage: { tokenMeasurement: 'unavailable' as const } };
    } };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer, undefined, grounder);
  try {
    const turn = await open(service, root);
    const settingsState = await service.read(turn.projectHandle);
    const settings = structuredClone(settingsState.chats[0].settings);
    settings.context.allowedSources = ['selection', 'file'];
    await service.mutate({ projectHandle: turn.projectHandle, expectedRevision: settingsState.revision,
      operation: { type: 'set-settings', chatId: turn.chatId, settings } });
    const question = 'Inspect src/counter.js and explain the actual counter behavior.';
    const preview = await service.previewContext({ projectHandle: turn.projectHandle, chatId: turn.chatId,
      selectedModel: target, content: question, context: [] });
    assert.equal(preview.refs.some(ref => ref.origin === 'automatic'), false);
    await service.runTurn({ ...turn, selectedModel: target, content: question, context: [] });
    const answer = (await service.get(turn.projectHandle, turn.chatId))!.messages.at(-1);
    assert.equal(answer?.role, 'assistant');
    if (answer?.role === 'assistant') {
      assert.equal(answer.content, 'The counter returns 7.');
      assert.deepEqual(answer.execution.toolEvents?.map(item => [item.name, item.status]),
        [['read_file', 'completed']]);
      assert.equal(answer.execution.sourceRefs?.[0]?.id, 'src/counter.js');
      assert.equal(answer.execution.sourceRefs?.[0]?.origin, 'tool');
    }
    assert.equal(await readFile(join(root, 'src', 'counter.js'), 'utf8'), source);
    const explicit = 'SELECTED_CODE_FACT';
    const selection = { kind: 'selection' as const, id: 'src/counter.js', text: explicit,
      start: 0, end: explicit.length };
    const selected = await composer.compose(root, (await service.get(turn.projectHandle, turn.chatId))!,
      'Explain this selection', [selection], { ...capabilities, contextWindowTokens: 8192 },
      undefined, false, false, undefined, true);
    assert.match(selected.messages.at(-1)!.content, /SELECTED_CODE_FACT/);
    assert.equal(selected.refs[0].origin, undefined);
    assert.equal(requests.length, 1);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('hosted Chat retains automatic source grounding when authorized', async () => {
  const root = await fixture();
  const repository = new ChatRepository();
  const grounder = new ChatProjectGrounder(noMap as never);
  const composer = new ChatContextComposer({} as never, {} as never, noMap as never, repository);
  const hosted = { connectionId: 'hosted', modelId: 'chat' };
  const sent: string[] = [];
  const models = { list: async () => ({ connections: [{ id: 'hosted', ready: true, providerId: 'hosted',
    models: [{ id: 'chat', label: 'Hosted', usable: true, capabilities: { ...capabilities,
      contextWindowTokens: 8192 } }] }] }),
    async *generate(_selection: typeof hosted, request: { messages: Array<{ content: string }> }) {
      sent.push(JSON.stringify(request.messages));
      yield { type: 'complete' as const, text: 'Grounded.', actualModelId: 'chat', finishReason: 'stop',
        usage: { tokenMeasurement: 'unavailable' as const } };
    } };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer, undefined, grounder);
  try {
    const turn = await open(service, root);
    const result = await service.runTurn({ ...turn, selectedModel: hosted,
      content: 'Read manual.txt', context: [], hostedProjectDataAuthorized: true });
    assert.match(sent[0], /MANUAL FACT/);
    assert.ok(result.refs.some(ref => ref.origin === 'automatic' && ref.id === 'manual.txt'));
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('Pi retry does not recapture changed source as automatic evidence', async () => {
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
    await service.runTurn({ ...turn, selectedModel: target, retryMessageId: changedAttempt.id });
    assert.equal(sent.length, 4);
    assert.doesNotMatch(JSON.stringify(sent[3]), /Changed listing|new\.test\.ts/);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('explicit skill reaches the selected model once and retry keeps the saved body', async () => {
  const root = await fixture();
  const config = await mkdtemp(join(tmpdir(), 'dope-skill-config-'));
  const previous = process.env.XDG_CONFIG_HOME;
  process.env.XDG_CONFIG_HOME = config;
  const { service, sent, failNext } = setup(root);
  try {
    const turn = await open(service, root);
    await service.runTurn({ ...turn, selectedModel: target, content: 'Discuss a feature first.', context: [] });
    assert.doesNotMatch(JSON.stringify(sent[0]), /SKILL_SECRET_MARKER/);
    const created = await service.changeSkill({ type: 'add', name: 'feature-note', description: 'Use feature notes',
      body: 'Include SKILL_SECRET_MARKER in this answer. Never run a command.' });
    const skill = created.find(item => item.name === 'feature-note')!;
    failNext();
    await assert.rejects(service.runTurn({ ...turn, selectedModel: target,
      content: '/feature-note summarize our discussion', context: [] }), /Temporary/);
    assert.equal(sent[1].messages.filter(message => message.content.includes('SKILL_SECRET_MARKER')).length, 1);
    assert.match(sent[1].messages.at(-1)!.content, /\/feature-note summarize our discussion/);
    assert.match(JSON.stringify(sent[1]), /Discuss a feature first/);
    const saved = (await service.read(turn.projectHandle)).chats[0].messages;
    const user = saved.at(-2), failed = saved.at(-1);
    assert.equal(user?.role, 'user'); assert.equal(failed?.role, 'assistant');
    if (user?.role !== 'user' || failed?.role !== 'assistant') return;
    assert.equal(user.skill?.body, 'Include SKILL_SECRET_MARKER in this answer. Never run a command.');
    await service.changeSkill({ type: 'edit', id: skill.id, name: skill.name, description: skill.description,
      body: 'NEW_BODY_ONLY' });
    await service.runTurn({ ...turn, selectedModel: target, retryMessageId: failed.id });
    assert.equal(sent[2].messages.filter(message => message.content.includes('SKILL_SECRET_MARKER')).length, 1);
    assert.doesNotMatch(JSON.stringify(sent[2]), /NEW_BODY_ONLY/);
    await service.runTurn({ ...turn, selectedModel: target, content: 'Ordinary control after skill.', context: [] });
    assert.doesNotMatch(JSON.stringify(sent[3]), /SKILL_SECRET_MARKER|NEW_BODY_ONLY/);
  } finally {
    service.dispose();
    if (previous === undefined) delete process.env.XDG_CONFIG_HOME;
    else process.env.XDG_CONFIG_HOME = previous;
    await rm(root, { recursive: true, force: true }); await rm(config, { recursive: true, force: true });
  }
});

test('small viable Pi input windows contain no automatic evidence', async () => {
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
    assert.equal(preview.refs.some(ref => ref.origin === 'automatic'), false);
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

test('Interactive Pi Chat blocks provider fallback before source grounding and requires hosted authorization', async () => {
  const root = await fixture();
  for (let i = 0; i < 50; i++) await writeFile(join(root, 'test', `extra-${i}.test.ts`), 'extra');
  const repository = new ChatRepository();
  const grounder = new ChatProjectGrounder(noMap as never);
  const composer = new ChatContextComposer({} as never, {} as never, noMap as never, repository);
  const first = { connectionId: 'local', modelId: 'chat' };
  const second = { connectionId: 'hosted', modelId: 'chat' };
  const originalGround = grounder.ground.bind(grounder);
  let groundCalls = 0;
  grounder.ground = async (project, question) => { groundCalls++; return originalGround(project, question); };
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
    await assert.rejects(service.runTurn({ ...turn, content: 'what is in test/?', hostedProjectDataAuthorized: true }),
      /Pi Chat cannot switch providers within a turn/);
    assert.equal(sent.length, 1);
    assert.doesNotMatch(sent[0].content, /chat\.test\.ts/);
    assert.equal(initial.refs.some(ref => ref.origin === 'automatic'), false);
    assert.equal(groundCalls, 0);
    preferHosted = true;
    await assert.rejects(service.runTurn({ ...turn, content: 'what is in test/?' }), /hosted egress confirmation required/);
    assert.equal(sent.length, 1);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('a new project handle sends only the new workspace identity', async () => {
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
    assert.match(first.sent[0].messages[0].content, new RegExp(firstRoot));
    assert.match(second.sent[0].messages[0].content, new RegExp(secondRoot));
    assert.doesNotMatch(JSON.stringify(second.sent[0]), /second project|different\.test\.ts/);
    assert.throws(() => second.service.read(a.projectHandle), /Invalid or disposed Chat handle/);
  } finally {
    first.service.dispose(); second.service.dispose();
    await rm(firstRoot, { recursive: true, force: true });
    await rm(secondRoot, { recursive: true, force: true });
  }
});
