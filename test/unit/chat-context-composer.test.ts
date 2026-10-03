import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Chat } from '../../packages/chat/lib/index.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { createSnapshot } from '../../packages/software-map/lib/index.js';
import type { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import type { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import type { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';
import type { ChatRepository } from '../../packages/chat/lib/node/index.js';

const id = () => randomUUID();
const model = { conversationalText: true, streaming: true, contextWindowTokens: 500, maxInputTokens: 500 };
const chat = (): Chat => ({ schemaVersion: 1, id: id(), revision: 0, folderPath: '', title: 'Active', titleSource: 'developer',
  createdAt: '2026-10-03T12:00:00.000Z', updatedAt: '2026-10-03T12:00:00.000Z', lastInteractedAt: '2026-10-03T12:00:00.000Z',
  settings: { schemaVersion: 1, context: { maxInputTokens: 500, reservedOutputTokens: 0, history: 'recent', savedChatSearch: true,
    allowedSources: ['editor', 'selection', 'file', 'project-mind', 'architecture', 'physical-map', 'flow', 'planning-map', 'work-item', 'saved-chat'] } },
  messages: [] });

test('all bounded source kinds resolve through project authorities with durable typed provenance', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-context-'));
  try {
    await mkdir(join(root, '.dope')); await mkdir(join(root, 'src'));
    await writeFile(join(root, 'src/a.ts'), 'export const answer = 42;');
    const architecture = JSON.stringify({ schemaVersion: 1, systems: [{ id: 'system', name: 'System', purpose: 'Purpose',
      subsystems: [{ id: 'subsystem', name: 'Subsystem', purpose: 'Purpose', roots: ['src'] }] }] });
    const fingerprint = createHash('sha256').update(architecture).digest('hex');
    await writeFile(join(root, '.dope/architecture.json'), architecture);
    await writeFile(join(root, '.dope/smap.json'), JSON.stringify({ schemaVersion: 1, architectureFingerprint: fingerprint }));
    const snapshot = createSnapshot({ projectId: 'project:root', generation: 3, inputFingerprint: 'input',
      analysis: { completeness: 'complete', errors: [] } }, [
      { id: 'project:root', kind: 'project', name: 'Project', evidenceIds: [] },
      { id: 'system', kind: 'system', name: 'System', purpose: 'Purpose', parentId: 'project:root', evidenceIds: ['proof'] },
    ], [], [{ id: 'proof', class: 'declaration', producer: 'test', producerVersion: '1' }], []);
    const mind = { read: async () => ({ projectId: 'mind', artifacts: [{ id: 'note', title: 'Note', type: 'note', body: 'Knowledge' }] }) } as unknown as ProjectMindStore;
    const planning = { read: async () => ({ projectId: 'planning', maps: [{ id: 'map', title: 'Plan', objective: 'Goal', status: 'draft',
      basis: { architectureFingerprint: fingerprint, physicalInputFingerprint: 'input', physicalGeneration: 3 },
      transformations: [], workItems: [{ id: 'work', title: 'Work', objective: 'Do it' }] }] }) } as unknown as PlanningStore;
    const index = { snapshot: () => snapshot, status: () => ({ state: 'ready', generation: 3, inputFingerprint: 'input' }),
      inputsCurrent: async () => true } as unknown as SoftwareMapIndex;
    const saved = chat(); saved.id = id(); saved.title = 'Saved';
    const messageId = id(); saved.messages = [{ schemaVersion: 1, id: messageId, role: 'user', createdAt: saved.createdAt,
      content: 'Saved fact', contextRefs: [] }];
    const chats = { read: async () => ({ chats: [saved] }) } as unknown as ChatRepository;
    const composer = new ChatContextComposer(mind, planning, index, chats);
    const active = chat();
    const cases = [
      { kind: 'editor', id: 'src/a.ts', text: 'unsaved edit' },
      { kind: 'selection', id: 'src/a.ts', text: 'answer', start: 13, end: 19 },
      { kind: 'file', id: 'src/a.ts' },
      { kind: 'project-mind', id: 'note', projectId: 'mind' },
      { kind: 'architecture', id: 'system' },
      { kind: 'physical-map', id: 'system', projectId: 'project:root', generation: 3 },
      { kind: 'physical-map', id: 'proof', projectId: 'project:root', generation: 3 },
      { kind: 'flow', id: 'system', projectId: 'project:root', generation: 3 },
      { kind: 'planning-map', id: 'map', projectId: 'planning' },
      { kind: 'work-item', id: 'map:work', projectId: 'planning' },
      { kind: 'saved-chat', id: saved.id, messageId },
    ] as const;
    for (const source of cases) {
      const result = await composer.compose(root, active, 'Question', [source], model);
      assert.equal(result.refs[0]?.kind, source.kind);
      assert.equal(result.refs[0]?.id, source.id);
      assert.ok(result.messages.at(-1)?.content.includes('Project context'));
      assert.ok(result.usedTokens <= result.budgetTokens);
    }
    await assert.rejects(composer.compose(root, active, 'Question', [{ kind: 'file', id: '../escape' }], model), /unsafe path/);
    await assert.rejects(composer.compose(root, active, 'Question', [{ kind: 'file', id: '.dope/architecture.json' }], model), /typed project context/);
    const outside = await mkdtemp(join(tmpdir(), 'dope-outside-'));
    try {
      await writeFile(join(outside, 'secret'), 'secret'); await symlink(join(outside, 'secret'), join(root, 'src/link'));
      await assert.rejects(composer.compose(root, active, 'Question', [{ kind: 'file', id: 'src/link' }], model), /escapes project/);
    } finally { await rm(outside, { recursive: true, force: true }); }
    await assert.rejects(composer.compose(root, active, 'Question', [{ kind: 'physical-map', id: 'system', projectId: 'wrong', generation: 3 }], model), /Stale/);
    await assert.rejects(composer.compose(root, active, 'Question', [{ kind: 'flow', id: 'system', projectId: 'project:root', generation: 2 }], model), /Stale/);
    await assert.rejects(composer.compose(root, active, 'Question', [{ kind: 'project-mind', id: 'missing' }], model), /missing/);
    await assert.rejects(composer.compose(root, active, 'Question', [{ kind: 'project-mind', id: 'note', projectId: 'other' }], model), /Stale/);
    await assert.rejects(composer.compose(root, active, 'Question', [{ kind: 'planning-map', id: 'map', projectId: 'other' }], model), /Stale/);
    await assert.rejects(composer.compose(root, active, 'Question', [{ kind: 'selection', id: 'src/a.ts', text: 'wrong', start: 1, end: 3 }], model), /selection bounds/);
    await assert.rejects(composer.compose(root, active, 'Question', [{ kind: 'saved-chat', id: active.id, messageId }], model), /another Chat/);
    active.settings.context.allowedSources = ['file'];
    await assert.rejects(composer.compose(root, active, 'Question', [{ kind: 'editor', id: 'src/a.ts', text: 'x' }], model), /disabled/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('context and active history share selected-model budget with explicit omission diagnostics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-context-budget-'));
  try {
    await writeFile(join(root, 'large.txt'), 'x'.repeat(600));
    const active = chat(); active.settings.context.maxInputTokens = 60;
    active.messages = [{ schemaVersion: 1, id: id(), role: 'user', createdAt: active.createdAt,
      content: 'old context '.repeat(25), contextRefs: [] }];
    const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore, {} as SoftwareMapIndex, {} as ChatRepository);
    const result = await composer.compose(root, active, 'New question', [{ kind: 'file', id: 'large.txt' }], model);
    assert.equal(result.refs.length, 1);
    assert.ok(result.diagnostics.some(item => item.kind === 'truncated'));
    assert.ok(result.diagnostics.some(item => item.kind === 'history'));
    assert.equal(result.messages.length, 1);
    assert.ok(result.usedTokens <= result.budgetTokens);
    await assert.rejects(composer.compose(root, active, 'x'.repeat(300), [], model), /exceeds/);
    await assert.rejects(composer.compose(root, active, 'Question', Array(21).fill({ kind: 'file', id: 'large.txt' }), model), /Too many/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('send persists only included references and supplies their bounded text to the selected model', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-context-send-'));
  try {
    await writeFile(join(root, 'fact.txt'), 'The accepted fact');
    const { ChatRepository } = await import('../../packages/chat/lib/node/index.js');
    const { ChatBackend } = await import('../../packages/theia-extension/lib/node/chat-backend.js');
    const repository = new ChatRepository();
    const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore, {} as SoftwareMapIndex, repository);
    let sent = '';
    const registry = { list: async () => ({ connections: [{ id: 'connected', ready: true, providerId: 'local',
      models: [{ id: 'model', label: 'Model', usable: true, capabilities: model }] }] }),
      async *generate(_selection: unknown, request: { messages: { content: string }[] }) {
        sent = request.messages.at(-1)?.content ?? '';
        yield { type: 'complete' as const, text: 'Answer', usage: { tokenMeasurement: 'estimated' as const } };
      } };
    const service = new ChatBackend(repository, { notifyChatEvent() {} }, registry as never, composer);
    const { projectHandle } = await service.attach(new URL(`file://${root}`).href);
    const chatId = id();
    let collection = await service.mutate({ projectHandle, expectedRevision: 0,
      operation: { type: 'create-chat', id: chatId, folderPath: '' } });
    const settings = structuredClone(collection.chats[0].settings);
    settings.context.allowedSources = ['file'];
    settings.context.maxInputTokens = 500;
    settings.context.reservedOutputTokens = 0;
    collection = await service.mutate({ projectHandle, expectedRevision: collection.revision,
      operation: { type: 'set-settings', chatId, settings } });
    const claim = await service.claim({ projectHandle, chatId, ownerId: 'test' });
    assert.equal(claim.acquired, true);
    if (!claim.acquired) return;
    const preview = await service.runTurn({ projectHandle, chatId, leaseToken: claim.token,
      selectedModel: { connectionId: 'connected', modelId: 'model' }, content: 'Question',
      context: [{ kind: 'file', id: 'fact.txt' }] });
    assert.equal(preview.refs.length, 1);
    assert.match(sent, /The accepted fact/);
    const persisted = (await repository.read(root)).chats[0].messages[0];
    assert.equal(persisted.role, 'user');
    if (persisted.role !== 'user') return;
    assert.equal(persisted.contextRefs[0].id, 'fact.txt');
    assert.equal(persisted.contextRefs[0].includedBytes, Buffer.byteLength('The accepted fact'));
    assert.equal(persisted.contextRefs[0].contentHash?.length, 64);
    assert.equal(persisted.contextRefs[0].excerpt, undefined);
    await assert.rejects(service.runTurn({ projectHandle, chatId, leaseToken: claim.token,
      selectedModel: { connectionId: 'connected', modelId: 'model' }, content: 'Unsafe',
      context: [{ kind: 'file', id: '../outside' }] }), /unsafe path/);
    assert.equal((await repository.read(root)).chats[0].messages.length, 2);
    service.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('saved Chat lookup is bounded, matches titles, and excludes the active Chat', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-context-search-'));
  try {
    const { ChatRepository } = await import('../../packages/chat/lib/node/index.js');
    const repository = new ChatRepository();
    const one = id(), two = id();
    let state = await repository.mutate(root, 0, { type: 'create-chat', id: one, folderPath: '', title: 'Architecture note' });
    state = await repository.mutate(root, state.revision, { type: 'create-chat', id: two, folderPath: '', title: 'Architecture followup' });
    for (const chatId of [one, two]) {
      const lease = await repository.claim(root, chatId, 'test');
      if (!lease.acquired) assert.fail();
      state = await repository.mutate(root, state.revision, { type: 'append-user', chatId, message: {
        schemaVersion: 1, id: id(), role: 'user', createdAt: new Date().toISOString(), content: 'Plain content', contextRefs: [],
      } }, lease.token);
    }
    const hits = await repository.search(root, 'Architecture', 1, one);
    assert.equal(hits.length, 1);
    assert.equal(hits[0].chatId, two);
    await assert.rejects(repository.search(root, 'x', 51), /Invalid Chat search/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
