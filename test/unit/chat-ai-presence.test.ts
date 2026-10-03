import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { readOnlyPrompt, ChatPanelController } from '../../packages/theia-extension/lib/browser/chat-panel-controller.js';

const selection = { connectionId: 'one', modelId: 'model' };
const capabilities = { conversationalText: true, streaming: true, contextWindowTokens: 1000 };
async function until(ready: () => Promise<boolean>): Promise<void> {
  for (let i = 0; i < 100; i++) { if (await ready()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
  assert.fail('Timed out waiting for title');
}

for (const kind of ['Ask', 'Explain', 'Trace', 'Find Related'] as const) {
  test(`${kind} stays a read-only Chat prompt`, () => {
    const prompt = readOnlyPrompt(kind, 'What does this do?');
    assert.match(prompt, /What does this do\?/);
    assert.match(prompt, /context|evidence|Flow/i);
    assert.doesNotMatch(prompt, /write|modify|execute|commit/i);
  });
}

test('selected context is inspectable, removable and cleared on project switch', async () => {
  const panel = new ChatPanelController(() => { throw new Error('no connection'); }, () => {});
  panel.addContext({ kind: 'file', id: 'src/a.ts' });
  panel.addContext({ kind: 'architecture', id: 'system' });
  assert.deepEqual(panel.context.map(item => item.id), ['src/a.ts', 'system']);
  panel.removeContext(0);
  assert.deepEqual(panel.context.map(item => item.id), ['system']);
  await panel.attach(undefined);
  assert.deepEqual(panel.context, []);
  panel.dispose();
});

test('first successful answer keeps model/context provenance and titles without delaying answer', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-ai-presence-'));
  const repository = new ChatRepository();
  const sent: Array<{ selection: typeof selection; content: string }> = [];
  let releaseTitle!: () => void;
  const titleGate = new Promise<void>(resolve => { releaseTitle = resolve; });
  const models = { list: async () => ({ connections: [{ id: 'one', ready: true, providerId: 'local',
    models: [{ id: 'model', label: 'Model', usable: true, capabilities }] }] }),
    async *generate(selected: typeof selection, request: { messages: { content: string }[] }) {
      sent.push({ selection: selected, content: request.messages.at(-1)!.content });
      if (sent.length === 1) yield { type: 'complete' as const, text: 'Explanation', usage: { tokenMeasurement: 'estimated' as const } };
      else { await titleGate; yield { type: 'complete' as const, text: 'Useful title', usage: { tokenMeasurement: 'estimated' as const } }; }
    } };
  const composer = { compose: async (_root: string, _chat: unknown, content: string, context: { kind: string; id: string }[]) => ({
    messages: [{ role: 'user', content: `${content}\nEvidence: ${context[0]?.id}` }],
    refs: [{ schemaVersion: 1, kind: 'file', id: context[0].id, label: context[0].id,
      estimatedTokens: 3 }], diagnostics: [], usedTokens: 12, budgetTokens: 1000,
  }) };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer as never);
  try {
    await mkdir(join(root, '.dope'));
    const canonical = '{"systems":[{"id":"accepted"}]}';
    await writeFile(join(root, '.dope/architecture.json'), canonical);
    const { projectHandle } = await service.attach(pathToFileURL(root).href);
    const chatId = randomUUID();
    await service.mutate({ projectHandle, expectedRevision: 0, operation: { type: 'create-chat', id: chatId, folderPath: '' } });
    const claim = await service.claim({ projectHandle, chatId, ownerId: 'panel' });
    assert.equal(claim.acquired, true);
    if (!claim.acquired) return;
    const preview = await service.runTurn({ projectHandle, chatId, leaseToken: claim.token, selectedModel: selection,
      content: readOnlyPrompt('Explain', 'What does it do?'), context: [{ kind: 'file', id: 'src/a.ts' }] });
    assert.equal(preview.refs[0].id, 'src/a.ts');
    assert.equal(sent.length, 2);
    const chat = (await service.read(projectHandle)).chats[0];
    assert.equal(chat.messages[0].role, 'user');
    if (chat.messages[0].role === 'user') assert.equal(chat.messages[0].contextRefs[0].id, 'src/a.ts');
    assert.equal(chat.messages[1].role, 'assistant');
    if (chat.messages[1].role === 'assistant') {
      assert.deepEqual(chat.messages[1].execution.selectedModel, selection);
      assert.equal(chat.messages[1].execution.actualModel?.providerId, 'local');
    }
    assert.deepEqual(sent.map(item => item.selection), [selection, selection]);
    assert.match(sent[0].content, /Evidence: src\/a.ts/);
    assert.equal(chat.titleSource, 'placeholder');
    releaseTitle();
    await until(async () => (await service.read(projectHandle)).chats[0].titleSource === 'automatic');
    assert.equal((await service.read(projectHandle)).chats[0].title, 'Useful title');
    assert.equal(await readFile(join(root, '.dope/architecture.json'), 'utf8'), canonical);
  } finally { releaseTitle(); service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('title failure falls back and late title cannot override user rename or stale model', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-ai-title-'));
  const repository = new ChatRepository();
  let available = true, mode: 'failure' | 'late' = 'failure', calls = 0;
  let releaseTitle!: () => void;
  const titleGate = new Promise<void>(resolve => { releaseTitle = resolve; });
  const models = { list: async () => ({ connections: [{ id: 'one', ready: available, providerId: 'local',
    models: available ? [{ id: 'model', label: 'Model', usable: true, capabilities }] : [] }] }),
    async *generate() { calls++; if (calls % 2 === 1) yield { type: 'complete' as const, text: 'Answer' };
      else { if (mode === 'late') await titleGate; else throw new Error('title offline');
        yield { type: 'complete' as const, text: 'Late title' }; } } };
  const composer = { compose: async (_root: string, _chat: unknown, content: string) => ({
    messages: [{ role: 'user', content }], refs: [], diagnostics: [], usedTokens: 5, budgetTokens: 1000,
  }) };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer as never);
  try {
    const { projectHandle } = await service.attach(pathToFileURL(root).href);
    async function send(content: string): Promise<string> {
      const chatId = randomUUID();
      const snapshot = await service.read(projectHandle);
      await service.mutate({ projectHandle, expectedRevision: snapshot.revision,
        operation: { type: 'create-chat', id: chatId, folderPath: '' } });
      const claim = await service.claim({ projectHandle, chatId, ownerId: chatId });
      assert.equal(claim.acquired, true);
      if (!claim.acquired) throw new Error('claim');
      await service.runTurn({ projectHandle, chatId, leaseToken: claim.token, selectedModel: selection, content });
      return chatId;
    }
    const failed = await send('First user message with a very long topic');
    await until(async () => (await service.read(projectHandle)).chats.find(item => item.id === failed)?.titleSource === 'automatic');
    assert.equal((await service.read(projectHandle)).chats.find(item => item.id === failed)?.title,
      'First user message with a very long topic');
    mode = 'late';
    const locked = await send('User controls this title');
    const snapshot = await service.read(projectHandle);
    await service.mutate({ projectHandle, expectedRevision: snapshot.revision,
      operation: { type: 'rename-chat', chatId: locked, title: 'Manual' } });
    releaseTitle();
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal((await service.read(projectHandle)).chats.find(item => item.id === locked)?.title, 'Manual');
    assert.equal((await service.read(projectHandle)).chats.find(item => item.id === locked)?.titleSource, 'developer');
    available = false;
    const stale = await service.read(projectHandle);
    assert.equal(stale.chats.find(item => item.id === locked)?.title, 'Manual');
  } finally { releaseTitle(); service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('stale selected model skips title generation and uses bounded first-message fallback', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-ai-stale-model-'));
  const repository = new ChatRepository();
  let lists = 0, generates = 0;
  const models = { list: async () => ({ connections: [{ id: 'one', ready: ++lists === 1, providerId: 'local',
    models: [{ id: 'model', label: 'Model', usable: true, capabilities }] }] }),
    async *generate() { generates++; yield { type: 'complete' as const, text: 'Answer' }; } };
  const composer = { compose: async (_root: string, _chat: unknown, content: string) => ({
    messages: [{ role: 'user', content }], refs: [], diagnostics: [], usedTokens: 5, budgetTokens: 1000,
  }) };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer as never);
  try {
    const { projectHandle } = await service.attach(pathToFileURL(root).href);
    const chatId = randomUUID();
    await service.mutate({ projectHandle, expectedRevision: 0,
      operation: { type: 'create-chat', id: chatId, folderPath: '' } });
    const claim = await service.claim({ projectHandle, chatId, ownerId: 'panel' });
    assert.equal(claim.acquired, true);
    if (!claim.acquired) return;
    const content = 'A long first user message '.repeat(9);
    await service.runTurn({ projectHandle, chatId, leaseToken: claim.token, selectedModel: selection, content });
    await until(async () => (await service.read(projectHandle)).chats[0].titleSource === 'automatic');
    const chat = (await service.read(projectHandle)).chats[0];
    assert.equal(chat.title, content.slice(0, 80).trimEnd());
    assert.equal(generates, 1);
    assert.equal(chat.messages[1].role, 'assistant');
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('disposed project connection cannot publish a late title', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-ai-stale-project-'));
  const repository = new ChatRepository();
  let calls = 0, releaseTitle!: () => void;
  const titleGate = new Promise<void>(resolve => { releaseTitle = resolve; });
  const models = { list: async () => ({ connections: [{ id: 'one', ready: true, providerId: 'local',
    models: [{ id: 'model', label: 'Model', usable: true, capabilities }] }] }),
    async *generate() {
      if (++calls === 1) yield { type: 'complete' as const, text: 'Answer' };
      else { await titleGate; yield { type: 'complete' as const, text: 'Too late' }; }
    } };
  const composer = { compose: async (_root: string, _chat: unknown, content: string) => ({
    messages: [{ role: 'user', content }], refs: [], diagnostics: [], usedTokens: 5, budgetTokens: 1000,
  }) };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer as never);
  try {
    const { projectHandle } = await service.attach(pathToFileURL(root).href);
    const chatId = randomUUID();
    await service.mutate({ projectHandle, expectedRevision: 0,
      operation: { type: 'create-chat', id: chatId, folderPath: '' } });
    const claim = await service.claim({ projectHandle, chatId, ownerId: 'panel' });
    assert.equal(claim.acquired, true);
    if (!claim.acquired) return;
    await service.runTurn({ projectHandle, chatId, leaseToken: claim.token, selectedModel: selection,
      content: 'Project answer' });
    service.dispose();
    releaseTitle();
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal((await repository.read(root)).chats[0].titleSource, 'placeholder');
  } finally { releaseTitle(); service.dispose(); await rm(root, { recursive: true, force: true }); }
});
