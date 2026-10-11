import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MAX_COLLECTION_LINKS, MAX_SESSION_LINKS, parseDeveloperSession, parseSessionArtifactRef,
  parseSessionCollection, parseSessionProjectIdentity, sessionArtifactRefKey } from '../../packages/contracts/lib/developer-session.js';
import type { LegacyDeveloperSession, SessionArtifactRef } from '../../packages/contracts/lib/developer-session.js';

const project = { canonicalRoot: '/work/project', projectMindId: null };
const createdAt = '2026-10-10T12:00:00.000Z';
const updatedAt = '2026-10-10T12:01:00.000Z';
const session: LegacyDeveloperSession = {
  schemaVersion: 1, id: 'd6174551-e136-48a8-a3f8-f3d4f911a10c', project, revision: 1,
  title: 'Explore the feature', objective: 'Decide what to build', createdAt, updatedAt,
  status: 'active', notes: 'Developer observation', nextActions: ['Inspect source'], closeout: null,
};

test('manual session round trips with no Project Mind identity or AI content', () => {
  const collection = { schemaVersion: 1, project, revision: 1, sessions: [session] };
  assert.deepEqual(parseDeveloperSession(JSON.parse(JSON.stringify(session))), { ...session, schemaVersion: 2, links: [] });
  assert.deepEqual(parseSessionCollection(JSON.parse(JSON.stringify(collection))), {
    ...collection, schemaVersion: 2, sessions: [{ ...session, schemaVersion: 2, links: [] }],
  });
  assert.deepEqual(parseSessionCollection({ schemaVersion: 1, project, revision: 0, sessions: [] }).sessions, []);
  assert.deepEqual(parseSessionProjectIdentity({ canonicalRoot: '/work/project', projectMindId: 'project-existing' }),
    { canonicalRoot: '/work/project', projectMindId: 'project-existing' });
});

const artifactId = 'd6174551-e136-48a8-a3f8-f3d4f911a10c';
const refs: SessionArtifactRef[] = [
  { kind: 'chat', chatId: artifactId },
  { kind: 'planning-map', mapId: 'Map_1' },
  { kind: 'work-item', mapId: 'Map_1', workItemId: 'Work_1' },
  { kind: 'agent-task', taskId: 'task.1' },
  { kind: 'agent-run', taskId: 'task.1', runId: 'run.1' },
  { kind: 'agent-sequence', sequenceId: 'sequence.1' },
  { kind: 'project-mind', artifactId, artifactType: 'decision' },
  { kind: 'project-mind', artifactId, artifactType: 'idea' },
];

test('strict v2 references and collection round trip preserve distinct composite identities', () => {
  const v2 = { ...session, schemaVersion: 2, links: refs };
  const collection = { schemaVersion: 2, project, revision: 1, sessions: [v2] };
  assert.deepEqual(parseSessionCollection(JSON.parse(JSON.stringify(collection))), collection);
  assert.deepEqual(refs.map(parseSessionArtifactRef), refs);
  assert.notEqual(sessionArtifactRefKey(refs[1]), sessionArtifactRefKey(refs[2]));
  assert.notEqual(sessionArtifactRefKey(refs[3]), sessionArtifactRefKey(refs[4]));
  assert.notEqual(sessionArtifactRefKey(refs[6]), sessionArtifactRefKey(refs[7]));
  assert.notEqual(sessionArtifactRefKey(refs[2]), sessionArtifactRefKey({ kind: 'work-item', mapId: 'Map_2', workItemId: 'Work_1' }));
  assert.notEqual(sessionArtifactRefKey(refs[4]), sessionArtifactRefKey({ kind: 'agent-run', taskId: 'task.2', runId: 'run.1' }));
});

test('v1 normalization is deterministic, preserves all legacy fields and does not write the source file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'dope-session-contract-'));
  try {
    const legacy = { schemaVersion: 1, project, revision: 4, sessions: [{ ...session, revision: 3,
      status: 'closed', closeout: { achieved: 'Done', unresolved: 'Open', deferred: 'Later', closedAt: updatedAt } }] };
    const file = join(dir, 'development-sessions.json');
    const bytes = JSON.stringify(legacy);
    await writeFile(file, bytes);
    const normalized = parseSessionCollection(JSON.parse(await readFile(file, 'utf8')));
    assert.deepEqual(normalized, { ...legacy, schemaVersion: 2,
      sessions: [{ ...legacy.sessions[0], schemaVersion: 2, links: [] }] });
    assert.deepEqual(parseSessionCollection(legacy), normalized);
    assert.equal(await readFile(file, 'utf8'), bytes);
    assert.deepEqual(legacy.sessions[0], { ...session, revision: 3, status: 'closed',
      closeout: { achieved: 'Done', unresolved: 'Open', deferred: 'Later', closedAt: updatedAt } });
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('references reject malformed, copied, path-like, duplicate and oversized values', () => {
  for (const malformed of [
    { kind: 'chat', chatId: '../chat' }, { kind: 'chat', chatId: artifactId, title: 'copied' },
    { kind: 'planning-map', mapId: 'Map/1' }, { kind: 'planning-map', mapId: 'M'.repeat(4097) },
    { kind: 'work-item', mapId: 'Map_1' },
    { kind: 'work-item', mapId: 'Map_1', workItemId: '../work' },
    { kind: 'agent-task', taskId: 'x'.repeat(121) }, { kind: 'agent-run', taskId: 'task.1', runId: '..' },
    { kind: 'agent-sequence', sequenceId: 'provider://sequence' },
    { kind: 'project-mind', artifactId, artifactType: 'note' },
    { kind: 'project-mind', artifactId, artifactType: 'idea', body: 'copied' },
    { kind: 'unknown', id: 'one' },
  ]) assert.throws(() => parseSessionArtifactRef(malformed));
  const v2 = { ...session, schemaVersion: 2, links: refs };
  assert.throws(() => parseDeveloperSession({ ...v2, links: [refs[0], { kind: 'chat', chatId: artifactId.toUpperCase() }] }), /Duplicate/);
  assert.throws(() => parseDeveloperSession({ ...v2, links: Array(MAX_SESSION_LINKS + 1).fill(refs[0]) }));
  assert.throws(() => parseDeveloperSession({ ...v2, links: [], extra: 'x' }));
  assert.throws(() => parseDeveloperSession({ ...session, links: [] }));
  assert.throws(() => parseDeveloperSession({ ...v2, links: undefined }));
  assert.throws(() => parseDeveloperSession({ ...v2, schemaVersion: 3 }));
  assert.throws(() => parseSessionCollection({ schemaVersion: 2, project, revision: 1, sessions: [session] }), /Mixed/);
  assert.throws(() => parseSessionCollection({ schemaVersion: 3, project, revision: 1, sessions: [] }));
  const many = Array.from({ length: Math.floor(MAX_COLLECTION_LINKS / MAX_SESSION_LINKS) + 1 }, (_, i) => ({
    ...v2, id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    links: Array.from({ length: MAX_SESSION_LINKS }, (_, j) => ({ kind: 'agent-task', taskId: `task-${i}-${j}` })),
  }));
  assert.throws(() => parseSessionCollection({ schemaVersion: 2, project, revision: 1, sessions: many }), /Too many/);
});

test('strict shape, identity, duplicate and size limits', () => {
  const collection = { schemaVersion: 1, project, revision: 1, sessions: [session] };
  for (const malformed of [
    { ...session, extra: true }, { ...session, schemaVersion: 3 }, { ...session, id: '../project/session' },
    { ...session, id: 'session/one' }, { ...session, title: ' '.repeat(10) },
    { ...session, title: 'x'.repeat(161) }, { ...session, objective: 'x'.repeat(4001) },
    { ...session, notes: 'x'.repeat(16001) }, { ...session, nextActions: ['x'.repeat(1001)] },
    { ...session, nextActions: Array(51).fill('item') }, { ...session, revision: -1 },
    { ...session, project: { canonicalRoot: '../project', projectMindId: null } },
    { ...session, project: { canonicalRoot: '/work/project', projectMindId: '../other' } },
  ]) assert.throws(() => parseDeveloperSession(malformed));
  assert.throws(() => parseSessionCollection({ ...collection, sessions: [session, session] }), /Duplicate/);
  assert.throws(() => parseSessionCollection({ ...collection, sessions: [session, { ...session,
    id: '52a6ccf4-5cf7-4d70-914b-44c2663d6554', project: { canonicalRoot: '/work/other', projectMindId: null },
  }] }), /Foreign/);
  assert.throws(() => parseSessionCollection({ ...collection, secret: 'extra' }));
  assert.throws(() => parseSessionCollection({ ...collection, revision: 0 }));
  for (const root of ['/work/../other', '/work//project', 'relative/path', '/work\\project'])
    assert.throws(() => parseSessionProjectIdentity({ canonicalRoot: root, projectMindId: null }));
});

test('status, timestamps and closeout must agree', () => {
  const closeout = { achieved: 'Shipped slice', unresolved: 'One question', deferred: 'UI', closedAt: updatedAt };
  assert.equal(parseDeveloperSession({ ...session, status: 'paused' }).status, 'paused');
  assert.deepEqual(parseDeveloperSession({ ...session, status: 'closed', closeout }).closeout, closeout);
  for (const malformed of [
    { ...session, status: 'done' }, { ...session, status: 'closed' }, { ...session, closeout },
    { ...session, status: 'closed', closeout: { ...closeout, arbitrary: true } },
    { ...session, status: 'closed', closeout: { ...closeout, closedAt: '2026-10-10T12:02:00.000Z' } },
    { ...session, createdAt: '2026-02-30T12:00:00.000Z' },
    { ...session, updatedAt: '2026-10-10T11:00:00.000Z' },
    { ...session, updatedAt: 'tomorrow' },
  ]) assert.throws(() => parseDeveloperSession(malformed));
});
