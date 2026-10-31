import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { Chat } from '../../packages/chat/lib/index.js';
import { ChatContextComposer, GROUNDED_CHAT_INSTRUCTION } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { createSnapshot } from '../../packages/software-map/lib/index.js';
import type { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import type { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import type { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';
import type { ChatRepository } from '../../packages/chat/lib/node/index.js';

const id = () => randomUUID();
const model = { conversationalText: true, streaming: true, contextWindowTokens: 500, maxInputTokens: 500 };
const chat = (): Chat => ({ schemaVersion: 1, id: id(), revision: 0, folderPath: '', title: 'Active', titleSource: 'developer', color: 'blue',
  createdAt: '2026-10-03T12:00:00.000Z', updatedAt: '2026-10-03T12:00:00.000Z', lastInteractedAt: '2026-10-03T12:00:00.000Z',
  settings: { schemaVersion: 1, context: { maxInputTokens: 500, reservedOutputTokens: 0, history: 'recent', savedChatSearch: true,
    allowedSources: ['editor', 'selection', 'file', 'project-mind', 'architecture', 'physical-map', 'flow', 'planning-map', 'work-item', 'saved-chat'] } },
  messages: [] });

test('ordinary Chat distinguishes factual recall from requested advice and preserves source truth', () => {
  assert.match(GROUNDED_CHAT_INSTRUCTION, /For a direct factual or conversation-recall question, answer the requested fact directly/);
  assert.match(GROUNDED_CHAT_INSTRUCTION, /do not add an unsolicited design, implementation plan, or claimed project inspection/);
  assert.match(GROUNDED_CHAT_INSTRUCTION, /100–170 words is a soft preference for advice requests, never a cap/);
  assert.match(GROUNDED_CHAT_INSTRUCTION, /Give more detail when the request or safety requires it/);
  assert.match(GROUNDED_CHAT_INSTRUCTION, /When the user asks for a practical approach, give one recommendation.*initial deliverable/);
  assert.match(GROUNDED_CHAT_INSTRUCTION, /never imply an unobserved file was inspected/);
  assert.doesNotMatch(GROUNDED_CHAT_INSTRUCTION, /PixiJS|tower defense|strict JSON|truncate/);
});

test('recent context keeps complete exchanges and excludes cancelled, failed and provisional turns', async () => {
  const active = chat(); active.settings.context.maxInputTokens = 2000;
  const user = (content: string) => ({ schemaVersion: 1 as const, id: id(), role: 'user' as const,
    createdAt: active.createdAt, content, contextRefs: [] });
  const assistant = (content: string, status: 'complete' | 'cancelled' | 'failed') => ({
    schemaVersion: 1 as const, id: id(), role: 'assistant' as const, createdAt: active.createdAt, content,
    execution: { schemaVersion: 1 as const, id: id(), status, startedAt: active.createdAt,
      selectedModel: { connectionId: 'local', modelId: 'qwen' } } });
  active.messages = [user('old fact'), assistant('old answer', 'complete'),
    user('abandoned counter request'), assistant('', 'cancelled'),
    user('failed source request'), assistant('', 'failed'),
    user('interrupted source request'), assistant('', 'failed'),
    user('retry this'), assistant('', 'failed'), assistant('retried answer', 'complete'),
    user('later fact'), assistant('later answer', 'complete') ] as Chat['messages'];
  const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore,
    {} as SoftwareMapIndex, {} as ChatRepository);
  const result = await composer.compose('/tmp', active, 'What is 1+1?', [],
    { ...model, contextWindowTokens: 4000, maxInputTokens: 4000 });
  assert.deepEqual(result.messages.map(item => [item.role, item.content]), [
    ['user', 'old fact'], ['assistant', 'old answer'],
    ['user', 'retry this'], ['assistant', 'retried answer'],
    ['user', 'later fact'], ['assistant', 'later answer'], ['user', 'What is 1+1?']]);
});

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
      content: 'old context '.repeat(25), contextRefs: [] },
      { schemaVersion: 1, id: id(), role: 'assistant', createdAt: active.createdAt,
        content: 'old answer', execution: { schemaVersion: 1, id: id(), status: 'complete',
          selectedModel: { connectionId: 'local', modelId: 'qwen' }, startedAt: active.createdAt } }];
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

test('automatic investigation references hash only bytes included in the measured context', async () => {
  const active = chat(); active.settings.context.maxInputTokens = 1200;
  const source = 'verified evidence '.repeat(300);
  const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore,
    {} as SoftwareMapIndex, {} as ChatRepository);
  const result = await composer.compose('/tmp', active, 'Plan this', [],
    { ...model, contextWindowTokens: 4096, maxInputTokens: 4096 }, { blocks: [{ text: source,
    ref: { schemaVersion: 1, kind: 'file', id: 'src/a.ts', label: 'src/a.ts', origin: 'automatic',
      projectId: 'project-a', estimatedTokens: 1000, includedBytes: Buffer.byteLength(source),
      contentHash: createHash('sha256').update(source).digest('hex') } }], diagnostics: [] });
  const ref = result.refs[0];
  assert.ok(ref.includedBytes! < Buffer.byteLength(source));
  const excerpt = result.messages.at(-1)!.content.split('[Auto file: src/a.ts]\n')[1];
  assert.equal(ref.contentHash, createHash('sha256').update(excerpt).digest('hex'));
  assert.ok(result.diagnostics.some(item => item.kind === 'truncated'));
});

test('normalized explicit file evidence reaches model context with honest current-source reference', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-cp-context-'));
  try {
    await mkdir(join(root, 'src'));
    const source = 'export const diffEditor = "read-only";\n';
    await writeFile(join(root, 'src/diffEditor.js'), source);
    const index = { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
      inputsCurrent: async () => false } as unknown as SoftwareMapIndex;
    const grounding = await new ChatProjectGrounder(index).ground(root, 'Use the editor in src/diffEditor.js; then plan.');
    const active = chat(); active.settings.context.maxInputTokens = 1000;
    const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore, index, {} as ChatRepository);
    const composed = await composer.compose(root, active, 'Use the editor in src/diffEditor.js; then plan.', [],
      { ...model, contextWindowTokens: 2000, maxInputTokens: 2000 }, grounding);
    const ref = composed.refs.find(item => item.kind === 'file');
    assert.equal(ref?.id, 'src/diffEditor.js');
    assert.equal(ref?.sourceHash, createHash('sha256').update(source).digest('hex'));
    assert.equal(ref?.contentHash, ref?.sourceHash);
    assert.match(composed.messages.at(-1)!.content, /export const diffEditor/);
    assert.equal(composed.refs.some(item => item.kind === 'directory'), false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('fresh structure evidence reaches the ordinary Chat packet with matching references', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-structure-context-'));
  try {
    await mkdir(join(root, 'src'));
    await writeFile(join(root, 'package.json'), '{"name":"game"}');
    await writeFile(join(root, 'src/game.ts'), 'export const wave = 1;\n');
    const index = { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
      inputsCurrent: async () => false } as unknown as SoftwareMapIndex;
    const grounder = new ChatProjectGrounder(index);
    const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore, index, {} as ChatRepository);
    const active = chat(); active.settings.context.maxInputTokens = 2000;
    const content = 'Okay I created our basic structure';
    const first = await composer.compose(root, active, content, [],
      { ...model, contextWindowTokens: 4000, maxInputTokens: 4000 }, await grounder.ground(root, content));
    const packet = first.messages.at(-1)!.content;
    assert.match(packet, /\[Auto directory: \.\]/);
    assert.match(packet, /\[Auto file: src\/game\.ts\]/);
    assert.match(packet, /export const wave = 1/);
    const ref = first.refs.find(item => item.id === 'src/game.ts')!;
    assert.equal(ref.sourceHash, createHash('sha256').update('export const wave = 1;\n').digest('hex'));
    assert.equal(ref.contentHash, ref.sourceHash);
    await writeFile(join(root, 'src/game.ts'), 'export const wave = 2;\n');
    const second = await composer.compose(root, active, content, [],
      { ...model, contextWindowTokens: 4000, maxInputTokens: 4000 }, await grounder.ground(root, content));
    assert.match(second.messages.at(-1)!.content, /export const wave = 2/);
    assert.notEqual(second.refs.find(item => item.id === 'src/game.ts')!.sourceHash, ref.sourceHash);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('ordinary greenfield context keeps source truth and permits prospective design', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-greenfield-context-'));
  try {
    const index = { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
      inputsCurrent: async () => false } as unknown as SoftwareMapIndex;
    const content = 'Lets plan the start of a new project. I want to make a 2D tower defense game with pixi.js';
    const grounding = await new ChatProjectGrounder(index).ground(root, content);
    const active = chat(); active.settings.context.maxInputTokens = 1000;
    const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore, index, {} as ChatRepository);
    const composed = await composer.compose(root, active, content, [],
      { ...model, contextWindowTokens: 2000, maxInputTokens: 2000 }, grounding);
    assert.equal(composed.messages[0].role, 'system');
    assert.match(composed.messages[0].content, /prospective designs/);
    assert.match(composed.messages[0].content, /existing project files/);
    assert.match(composed.messages[0].content, /feasible starting approach/);
    assert.match(composed.messages[0].content, /No file evidence in this turn.*NOT that the attached project is empty/);
    assert.match(composed.messages[0].content, /short implementation order/);
    assert.match(composed.messages[0].content, /first milestone or vertical slice/);
    assert.match(composed.messages[0].content, /at most one consequential question/);
    assert.doesNotMatch(composed.messages[0].content, /PixiJS|tower defense/);
    assert.equal(composed.refs.some(ref => ref.kind === 'file' || ref.kind === 'grounding-status'), false);
    assert.equal(composed.refs[0]?.kind, 'project-orientation');
    assert.match(composed.messages.at(-1)!.content, /Auto project-orientation/);
    assert.ok(composed.usedTokens <= composed.budgetTokens);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('uninspected files are not an empty project; a current root listing can verify an empty scope', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-project-truth-'));
  try {
    const index = { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
      inputsCurrent: async () => false } as unknown as SoftwareMapIndex;
    const grounder = new ChatProjectGrounder(index);
    const active = chat(); active.settings.context.maxInputTokens = 1200;
    const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore, index, {} as ChatRepository);
    await writeFile(join(root, 'existing.ts'), 'export const existing = true;');
    const idea = 'Help plan a command-line backup utility in Rust';
    const uninspected = await composer.compose(root, active, idea, [],
      { ...model, contextWindowTokens: 2000, maxInputTokens: 2000 }, await grounder.ground(root, idea));
    assert.equal(uninspected.refs.some(ref => ref.kind === 'directory' || ref.kind === 'file'), false);
    assert.match(uninspected.messages[0].content, /files were not inspected or included/);
    assert.match(uninspected.messages[0].content, /software project.*short implementation order/);
    assert.doesNotMatch(uninspected.messages[0].content, /PixiJS|tower defense/);
    assert.doesNotMatch(uninspected.messages.at(-1)!.content, /existing\.ts|\(empty\)/);
    await rm(join(root, 'existing.ts'));
    const listed = await grounder.ground(root, 'What is at the repository root?');
    assert.match(listed.blocks.find(block => block.ref.kind === 'directory')!.text, /Project directory \.: \(empty\)/);
    const verified = await composer.compose(root, active, 'What is at the repository root?', [],
      { ...model, contextWindowTokens: 2000, maxInputTokens: 2000 }, listed);
    assert.match(verified.messages.at(-1)!.content, /Auto directory.*Project directory \.: \(empty\)/s);
    assert.match(verified.messages[0].content, /limit the claim to the listed scope/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('current grounding and Roadmap instructions precede saved history in model requests', async () => {
  const active = chat();
  active.settings.context.maxInputTokens = 2000;
  active.settings.context.allowedSources.push('roadmap-checkpoint');
  active.messages = [
    { schemaVersion: 1, id: id(), role: 'user', createdAt: active.createdAt,
      content: 'Old question', contextRefs: [] },
    { schemaVersion: 1, id: id(), role: 'assistant', createdAt: active.createdAt,
      content: 'Old answer', execution: { schemaVersion: 1, id: id(), status: 'complete',
        selectedModel: { connectionId: 'local', modelId: 'model' }, startedAt: active.createdAt,
        finishedAt: active.createdAt } },
  ];
  const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore,
    {} as SoftwareMapIndex, {} as ChatRepository,
    { read: async () => ({ projectRoot: '/tmp', projectId: 'p', revision: 1,
      checkpoints: [{ id: 'checkpoint', kind: 'milestone', title: 'Current', objective: 'Current objective',
        status: 'active', dependencies: [], links: [], evidence: [] }] }) } as never);
  const result = await composer.compose('/tmp', active, 'Current question',
    [{ kind: 'roadmap-checkpoint', id: 'checkpoint', projectId: 'p', ownerRevision: 1 }],
    { conversationalText: true, streaming: true, contextWindowTokens: 4000 },
    { blocks: [], diagnostics: [] } as never);
  assert.deepEqual(result.messages.map(message => message.role),
    ['system', 'system', 'user', 'assistant', 'user']);
  assert.equal(result.messages[2].content, 'Old question');
  assert.match(result.messages.at(-1)!.content, /Current question/);
});

test('saved applied decisions survive reload and selected Roadmap facts outrank optional files', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-planning-memory-'));
  try {
    await writeFile(join(root, 'large.txt'), 'optional'.repeat(10000));
    const active = chat();
    active.settings.context.maxInputTokens = 1200;
    active.settings.context.allowedSources.push('roadmap-checkpoint');
    const applied = { schemaVersion: 1 as const, id: id(), role: 'assistant' as const,
      createdAt: active.createdAt,
      content: JSON.stringify({ type: 'roadmap-proposal', action: { type: 'edit', id: 'chosen', title: 'Approved title' } }),
      execution: { schemaVersion: 1 as const, id: id(), status: 'complete' as const,
        selectedModel: { connectionId: 'local', modelId: 'model' }, startedAt: active.createdAt,
        finishedAt: active.createdAt },
      planningActivity: { schemaVersion: 1 as const, kind: 'roadmap-proposal' as const,
        status: 'applied' as const, refs: [], proposalId: id(), appliedRevision: 3 } };
    active.messages = [applied, { ...applied, id: id(),
      content: JSON.stringify({ type: 'roadmap-proposal', action: { type: 'edit', id: 'next', title: 'Next approved' } }),
      planningActivity: { ...applied.planningActivity, proposalId: id(), appliedRevision: 4 } }];
    const persisted = JSON.parse(JSON.stringify(active)) as Chat;
    const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore,
      {} as SoftwareMapIndex, {} as ChatRepository,
      { read: async () => ({ projectRoot: root, projectId: 'project-a', revision: 3,
        checkpoints: [
          { id: 'dependency', kind: 'phase', title: 'Base', objective: 'Base goal', order: 0,
            status: 'green', dependencies: [], links: [], evidence: [] },
          { id: 'chosen', kind: 'milestone', title: 'Approved title', objective: 'Current goal', order: 1,
            status: 'active', dependencies: ['dependency'], links: [], evidence: [] },
          { id: 'next', kind: 'milestone', title: 'Next', objective: 'Next goal', order: 2,
            status: 'unknown', dependencies: [], links: [], evidence: [] }] }) } as never);
    const selection = { kind: 'roadmap-checkpoint' as const, id: 'chosen', projectId: 'project-a', ownerRevision: 3 };
    const result = await composer.compose(root, persisted, 'What next?',
      [{ kind: 'file', id: 'large.txt' }, selection],
      { conversationalText: true, streaming: true, contextWindowTokens: 1200 });
    const context = result.messages.at(-1)!.content;
    assert.match(context, /Current goal/);
    assert.match(context, /verifiedDependencies/);
    assert.match(context, /Next goal/);
    assert.match(context, /Approved title/);
    assert.match(context, /Next approved/);
    assert.equal(result.refs[0].kind, 'roadmap-checkpoint');
    assert.ok(result.usedTokens <= result.budgetTokens);
    await assert.rejects(composer.compose(root, persisted, 'Question',
      [{ ...selection, projectId: 'project-b' }],
      { conversationalText: true, streaming: true, contextWindowTokens: 1200 }), /Stale or foreign Roadmap/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('loaded context caps preview below Chat policy and omits oversized context', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-loaded-context-'));
  try {
    await writeFile(join(root, 'large.txt'), 'x'.repeat(30000));
    const active = chat();
    active.settings.context.maxInputTokens = 8192;
    active.settings.context.reservedOutputTokens = 1024;
    const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore, {} as SoftwareMapIndex, {} as ChatRepository);
    const result = await composer.compose(root, active, 'Question', [{ kind: 'file', id: 'large.txt' }],
      { conversationalText: true, streaming: true, contextWindowTokens: 4096 });
    assert.equal(result.budgetTokens, 3072);
    assert.ok(result.usedTokens <= 3072);
    assert.ok(result.diagnostics.some(item => item.kind === 'truncated'));
    await assert.rejects(composer.compose(root, active, 'x'.repeat(10000), [],
      { conversationalText: true, streaming: true, contextWindowTokens: 4096 }), /exceeds selected model input budget/);
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
    let sent = '', failRetry = true, sentOutput: number | undefined, sentModel = '';
    const registry = { list: async () => ({ connections: [{ id: 'connected', ready: true, providerId: 'local',
      models: [{ id: 'model', label: 'Model', usable: true, capabilities: model }] }] }),
      async *generate(selection: { modelId: string }, request: { messages: { content: string }[]; maxOutputTokens?: number }) {
        if (request.maxOutputTokens !== undefined) {
          sentModel = selection.modelId;
          sentOutput = request.maxOutputTokens;
        }
        sent ||= request.messages.at(-1)?.content ?? '';
        if (request.messages.at(-1)?.content.includes('Retry question') && failRetry) {
          failRetry = false;
          throw new Error('Temporary provider failure');
        }
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
    settings.context.reservedOutputTokens = 17;
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
    assert.equal(sentOutput, 17);
    assert.equal(sentModel, 'model');
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
    await assert.rejects(service.runTurn({ projectHandle, chatId, leaseToken: claim.token,
      selectedModel: { connectionId: 'connected', modelId: 'model' }, content: 'Retry question',
      context: [{ kind: 'file', id: 'fact.txt' }] }), /Temporary provider failure/);
    const failed = (await repository.read(root)).chats[0].messages.at(-1)!;
    assert.equal(failed.role, 'assistant');
    if (failed.role !== 'assistant') return;
    await assert.rejects(service.runTurn({ projectHandle, chatId, leaseToken: claim.token,
      selectedModel: { connectionId: 'connected', modelId: 'model' }, retryMessageId: failed.id }),
      /Retry context changed or missing/);
    assert.equal((await repository.read(root)).chats[0].messages.length, 4);
    const retried = await service.runTurn({ projectHandle, chatId, leaseToken: claim.token,
      selectedModel: { connectionId: 'connected', modelId: 'model' }, retryMessageId: failed.id,
      context: [{ kind: 'file', id: 'fact.txt' }] });
    assert.deepEqual(retried.refs, persisted.contextRefs);
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
