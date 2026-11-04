import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { createProjectMind } from '../../packages/project-intelligence/lib/index.js';
import { readHistoryOwnerMetadata } from '../../packages/theia-extension/lib/node/history-owner-metadata.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapNativeStageOwner } from '../../packages/theia-extension/lib/node/roadmap-native-stage.js';
import { gateFixture } from './roadmap-gate-document-fixture.ts';

const observedAt = '2026-10-12T12:00:00.000Z';
const basis = { architectureRevision: 1, architectureFingerprint: 'a', physicalInputFingerprint: 'b', physicalGeneration: 1 };
const project = (root: string) => ({ projectId: 'workbench-project', projectRoot: root });

test('Chat metadata uses actual interaction, keeps interrupted and legacy bytes, and isolates roots', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'dope-history-owner-'));
  const a = join(parent, 'a'), b = join(parent, 'b');
  await mkdir(a); await mkdir(b);
  try {
    const repo = new ChatRepository(), active = randomUUID(), legacy = randomUUID();
    let state = await repo.mutate(a, 0, { type: 'create-chat', id: active, folderPath: '', title: 'Active' });
    state = await repo.mutate(a, state.revision, { type: 'create-chat', id: legacy, folderPath: '', title: 'Legacy' });
    const index = JSON.parse(await readFile(join(a, '.dope/chats/index.json'), 'utf8'));
    const entry = (id: string) => join(a, '.dope/chats/folders', index.entries.find((item: { id: string }) => item.id === id).file);
    const activePath = entry(active), legacyPath = entry(legacy);
    const activeJson = JSON.parse(await readFile(activePath, 'utf8'));
    activeJson.updatedAt = '2026-10-12T11:00:00.000Z';
    activeJson.lastInteractedAt = '2026-10-12T10:00:00.000Z';
    activeJson.createdAt = '2026-10-12T09:00:00.000Z';
    activeJson.messages = [{ schemaVersion: 1, id: randomUUID(), role: 'assistant', createdAt: activeJson.lastInteractedAt,
      content: '', execution: { schemaVersion: 1, id: randomUUID(), status: 'pending',
        selectedModel: { connectionId: 'local', modelId: 'model' }, startedAt: activeJson.lastInteractedAt } }];
    await writeFile(activePath, JSON.stringify(activeJson, null, 2));
    const legacyJson = JSON.parse(await readFile(legacyPath, 'utf8'));
    delete legacyJson.color;
    await writeFile(legacyPath, JSON.stringify(legacyJson, null, 2));
    const before = await Promise.all([readFile(activePath), readFile(legacyPath), readFile(join(a, '.dope/chats/index.json'))]);
    const result = await readHistoryOwnerMetadata(project(a), observedAt);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].kind, 'event');
    assert.equal(result.entries[0].occurredAt, activeJson.lastInteractedAt);
    assert.equal(result.entries[0].title, 'Active');
    assert.equal(JSON.parse(await readFile(activePath, 'utf8')).messages[0].execution.status, 'pending');
    assert.match(result.diagnostics.map(item => item.message).join(' '), /Legacy|unsupported/);
    assert.deepEqual(await Promise.all([readFile(activePath), readFile(legacyPath), readFile(join(a, '.dope/chats/index.json'))]), before);
    assert.deepEqual((await readHistoryOwnerMetadata(project(b), observedAt)).entries, []);
    assert.deepEqual((await readHistoryOwnerMetadata({ ...project(a), projectRoot: join(a, '..') }, observedAt)).entries, []);
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test('Planning status and Mind timestamps remain owner facts; absent Mind stays absent', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-history-planning-'));
  try {
    const store = new PlanningStore();
    let collection = await store.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Goal', basis });
    collection = await store.mutate(root, collection.revision, { type: 'put-transformation', mapId: 'plan',
      transformation: { id: 'change', kind: 'add', currentIds: [], dependsOn: [],
        futureNodes: [{ id: 'core', kind: 'system', name: 'Core', purpose: 'Build', roots: [] }] } });
    collection = await store.mutate(root, collection.revision, { type: 'put-work-item', mapId: 'plan', workItem: {
      id: 'work', title: 'Work', objective: 'Build', transformationIds: ['change'], dependsOn: [], requirements: [], constraints: [],
      acceptanceCriteria: [], validationTargets: [], workingSet: [], status: 'proposed' } });
    const planPath = join(root, '.dope/planning-maps.json'), before = await readFile(planPath);
    const first = await readHistoryOwnerMetadata(project(root), observedAt);
    assert.equal(first.entries.find(item => item.owner.kind === 'planning-map')?.status.kind, 'owner');
    const work = first.entries.find(item => item.owner.kind === 'work-item');
    assert.equal(work?.kind, 'snapshot');
    assert.deepEqual(work?.status, { kind: 'work-item', state: 'proposed' });
    assert.equal(work?.observedAt, observedAt);
    assert.deepEqual(await readFile(planPath), before);
    await assert.rejects(readFile(join(root, '.dope/project-mind.json')), /ENOENT/);
    const artifactId = randomUUID(), now = '2026-10-12T10:00:00.000Z';
    const mind = createProjectMind(randomUUID(), { schemaVersion: 2, type: 'note', id: artifactId, title: 'Note',
      body: 'Private body', status: 'active', provenance: 'developer', createdAt: now, updatedAt: now,
      archivedAt: null, links: [] });
    const mindPath = join(root, '.dope/project-mind.json');
    await writeFile(mindPath, JSON.stringify(mind));
    const mindBefore = await readFile(mindPath);
    const second = await readHistoryOwnerMetadata(project(root), observedAt);
    assert.equal(second.entries.find(item => item.source === 'project-mind')?.occurredAt, now);
    assert.equal(second.entries.find(item => item.source === 'project-mind')?.ownerProjectId, mind.projectId);
    assert.equal(JSON.stringify(second).includes('Private body'), false);
    assert.deepEqual(await readFile(mindPath), mindBefore);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('bounded lists and corrupt, linked and foreign metadata give diagnostics without invented events', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-history-limits-'));
  try {
    await mkdir(join(root, '.dope'));
    const maps = Array.from({ length: 51 }, (_, i) => ({ schemaVersion: 1, id: `map${i}`, projectId: 'project-one',
      title: `Map ${i}`, objective: 'Goal', status: 'draft', revision: 0,
      history: [{ revision: 0, action: 'create', at: observedAt }], basis, transformations: [], workItems: [] }));
    const file = join(root, '.dope/planning-maps.json');
    await writeFile(file, JSON.stringify({ schemaVersion: 1, projectId: 'project-one', revision: 1, maps }));
    const bounded = await readHistoryOwnerMetadata(project(root), observedAt);
    assert.equal(bounded.entries.length, 50);
    assert.equal(bounded.truncated, true);
    assert.match(bounded.diagnostics.map(item => item.message).join(' '), /truncated/);
    await writeFile(file, '{');
    const corrupt = await readHistoryOwnerMetadata(project(root), observedAt);
    assert.equal(corrupt.entries.length, 0);
    assert.equal(corrupt.diagnostics.some(item => item.source === 'planning'), true);
    await rm(file);
    await symlink(join(root, 'outside'), file);
    const linked = await readHistoryOwnerMetadata(project(root), observedAt);
    assert.equal(linked.entries.length, 0);
    assert.match(linked.diagnostics.map(item => item.message).join(' '), /Unsafe/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('absent optional Planning Map and Project Mind metadata is ordinary empty History', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-history-empty-'));
  try {
    const empty = await readHistoryOwnerMetadata(project(root), observedAt);
    assert.deepEqual(empty.entries, []);
    assert.deepEqual(empty.diagnostics, []);
    assert.equal(empty.truncated, false);
    await mkdir(join(root, '.dope'));
    await writeFile(join(root, '.dope/project-mind.json'), '{bad json');
    const corrupt = await readHistoryOwnerMetadata(project(root), observedAt);
    assert.ok(corrupt.diagnostics.some(item => item.source === 'project-mind'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a denied metadata read remains a source diagnostic', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-history-denied-'));
  try {
    const denied = { peekCandidateIds: async () => {
      throw Object.assign(new Error('Chat metadata read denied'), { code: 'EACCES' });
    } } as unknown as ChatRepository;
    const result = await readHistoryOwnerMetadata(project(root), observedAt, denied);
    assert.deepEqual(result.entries, []);
    assert.deepEqual(result.diagnostics, [{ source: 'chat', message: 'Chat metadata read denied' }]);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Project History projects each reviewed Roadmap Apply receipt once, including partial review and restore', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-history-roadmap-'));
  try {
    const store = new RoadmapStore(), owner = new RoadmapNativeStageOwner(store);
    const context = { root, projectId: 'uninitialized', chatId: 'chat', turnId: 'turn', lease: 'lease' };
    const history = () => readHistoryOwnerMetadata(project(root), observedAt);
    assert.equal((await history()).entries.filter(item => item.source === 'roadmap').length, 0);
    const staged = await owner.stage(context, { version: 1, expectedRevision: 0,
      expectedSourceHash: null, expectedStage: 1, done: true, actions: [
        { type: 'phase.create', id: 'new:p1', title: 'First Phase', objective: 'Build first' },
        { type: 'gate.create', id: 'new:g1', parentPhaseId: 'new:p1', designation: 'G1',
          title: 'First Gate', purpose: 'Verify first', criteria: [
            { id: 'new:c1', title: 'One', expectedResult: 'One works' },
            { id: 'new:c2', title: 'Two', expectedResult: 'Two works' }] },
        { type: 'phase.create', id: 'new:p2', title: 'Second Phase', objective: 'Build second' },
        { type: 'gate.create', id: 'new:g2', parentPhaseId: 'new:p2', designation: 'G1',
          title: 'Second Gate', purpose: 'Verify second', criteria: [
            { id: 'new:c3', title: 'Three', expectedResult: 'Three works' }] }
      ] }) as { acceptedOperationIds: string[] };
    assert.equal((await history()).entries.filter(item => item.source === 'roadmap').length, 0);
    const firstIds = staged.acceptedOperationIds.slice(0, 2);
    const firstReview = await owner.review(context, firstIds, 'apply');
    await owner.decide(context, firstReview.token, firstIds, 'apply');
    const first = (await history()).entries.filter(item => item.source === 'roadmap');
    assert.equal(first.length, 1);
    assert.equal(first[0].title, 'Roadmap Apply: 2 accepted operations (R1)');
    assert.equal(first[0].ownerRevision, 1);
    assert.equal(first[0].status.kind === 'owner' && first[0].status.label, 'Reviewed Apply');
    const secondIds = staged.acceptedOperationIds.slice(2);
    const secondReview = await owner.review(context, secondIds, 'apply');
    await owner.decide(context, secondReview.token, secondIds, 'apply');
    const two = (await history()).entries.filter(item => item.source === 'roadmap');
    assert.deepEqual(two.map(item => item.ownerRevision), [2, 1]);
    assert.equal(new Set(two.map(item => item.sourceId)).size, 2);
    assert.deepEqual((await new RoadmapStore().listRevisions(root, (await store.read(root)).projectId)).revisions
      .slice(0, 2).map(item => item.receipt.operationIds?.length), [2, 2]);
    const repeated = (await history()).entries.filter(item => item.source === 'roadmap');
    assert.deepEqual(repeated, two);
    const fresh = await readHistoryOwnerMetadata(project(root), observedAt);
    assert.deepEqual(fresh.entries.filter(item => item.source === 'roadmap'), two);
    assert.deepEqual((await history()).entries.filter(item => item.source === 'roadmap'), two);
    const otherRoot = await mkdtemp(join(tmpdir(), 'dope-history-other-'));
    try { assert.equal((await readHistoryOwnerMetadata(project(otherRoot), observedAt))
      .entries.filter(item => item.source === 'roadmap').length, 0); }
    finally { await rm(otherRoot, { recursive: true, force: true }); }
    const rejectedContext = { ...context, projectId: (await store.read(root)).projectId,
      chatId: 'rejected-chat', turnId: 'rejected-turn' };
    const rejectedStage = await owner.stage(rejectedContext, { version: 1, expectedRevision: 2,
      expectedSourceHash: null, expectedStage: 1, done: true, actions: [
        { type: 'phase.edit', id: (await store.read(root)).phases[0].id,
          title: 'Rejected edit', objective: 'Build first' }
      ] }) as { acceptedOperationIds: string[] };
    const reject = await owner.review(rejectedContext, rejectedStage.acceptedOperationIds, 'reject');
    await owner.decide(rejectedContext, reject.token, rejectedStage.acceptedOperationIds, 'reject');
    assert.deepEqual((await history()).entries.filter(item => item.source === 'roadmap'), two);
    const current = await store.read(root);
    const preview = await store.previewRestore(root, current.projectId, 1);
    await store.applyRestore(root, preview, true);
    const restored = (await history()).entries.filter(item => item.source === 'roadmap');
    assert.equal(restored.length, 3);
    assert.equal(restored[0].title, 'Roadmap restored from R1 as R3');
    assert.equal(restored.filter(item => item.status.kind === 'owner' && item.status.label === 'Reviewed Apply').length, 2);
    await writeFile(join(root, '.dope', 'roadmap-revisions', 'r-000000000002.json'), '{corrupt');
    const corrupt = await history();
    assert.equal(corrupt.entries.filter(item => item.source === 'roadmap').length, 0);
    assert.ok(corrupt.diagnostics.some(item => item.source === 'roadmap' && /Corrupt/.test(item.message)));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('linked Markdown synchronization does not create another Apply History event', async () => {
  await gateFixture(async (root, _file, store) => {
    const index = await store.read(root), owner = new RoadmapNativeStageOwner(store);
    const context = { root, projectId: index.projectId, chatId: 'chat', turnId: 'turn', lease: 'lease' };
    const history = () => readHistoryOwnerMetadata(project(root), observedAt);
    assert.equal((await history()).entries.filter(item => item.source === 'roadmap').length, 0);
    const staged = await owner.stage(context, { version: 1, expectedRevision: index.revision,
      expectedSourceHash: index.linkedDocument!.sourceHash, expectedStage: 1, done: true,
      actions: [{ type: 'gate.edit', id: index.gates[0].id, title: 'Reviewed Gate',
        purpose: index.gates[0].purpose }] }) as { acceptedOperationIds: string[] };
    const review = await owner.review(context, staged.acceptedOperationIds, 'apply');
    await owner.decide(context, review.token, staged.acceptedOperationIds, 'apply');
    const beforeSync = (await history()).entries.filter(item => item.source === 'roadmap');
    assert.equal(beforeSync.length, 1);
    assert.equal(beforeSync[0].title, `Roadmap Apply: 1 accepted operation (R${index.revision + 1})`);
    await store.recoverAutoSync(root);
    const afterSync = (await history()).entries.filter(item => item.source === 'roadmap');
    assert.deepEqual(afterSync, beforeSync);
    assert.equal((await store.read(root)).revision, index.revision + 1);
  });
});

test('Apply All creates one History event with its actual operation count', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-history-apply-all-'));
  try {
    const store = new RoadmapStore(), owner = new RoadmapNativeStageOwner(store);
    const context = { root, projectId: 'uninitialized', chatId: 'chat', turnId: 'turn', lease: 'lease' };
    const staged = await owner.stage(context, { version: 1, expectedRevision: 0,
      expectedSourceHash: null, expectedStage: 1, done: true, actions: [
        { type: 'phase.create', id: 'new:p', title: 'Phase', objective: 'Build' },
        { type: 'gate.create', id: 'new:g', parentPhaseId: 'new:p', designation: 'G1',
          title: 'Gate', purpose: 'Check', criteria: [
            { id: 'new:c1', title: 'First', expectedResult: 'First works' },
            { id: 'new:c2', title: 'Second', expectedResult: 'Second works' }] }
      ] }) as { acceptedOperationIds: string[] };
    const review = await owner.review(context, staged.acceptedOperationIds, 'apply');
    await owner.decide(context, review.token, staged.acceptedOperationIds, 'apply');
    const entries = (await readHistoryOwnerMetadata(project(root), observedAt)).entries
      .filter(item => item.source === 'roadmap');
    assert.equal(entries.length, 1);
    assert.equal(entries[0].title, 'Roadmap Apply: 2 accepted operations (R1)');
    assert.equal((await store.read(root)).gates[0].criteria.length, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});
