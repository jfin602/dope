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
