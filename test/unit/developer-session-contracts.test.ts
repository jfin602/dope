import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDeveloperSession, parseSessionCollection, parseSessionProjectIdentity } from '../../packages/contracts/lib/developer-session.js';
import type { DeveloperSession } from '../../packages/contracts/lib/developer-session.js';

const project = { canonicalRoot: '/work/project', projectMindId: null };
const createdAt = '2026-10-10T12:00:00.000Z';
const updatedAt = '2026-10-10T12:01:00.000Z';
const session: DeveloperSession = {
  schemaVersion: 1, id: 'd6174551-e136-48a8-a3f8-f3d4f911a10c', project, revision: 1,
  title: 'Explore the feature', objective: 'Decide what to build', createdAt, updatedAt,
  status: 'active', notes: 'Developer observation', nextActions: ['Inspect source'], closeout: null,
};

test('manual session round trips with no Project Mind identity or AI content', () => {
  const collection = { schemaVersion: 1, project, revision: 1, sessions: [session] };
  assert.deepEqual(parseDeveloperSession(JSON.parse(JSON.stringify(session))), session);
  assert.deepEqual(parseSessionCollection(JSON.parse(JSON.stringify(collection))), collection);
  assert.deepEqual(parseSessionCollection({ schemaVersion: 1, project, revision: 0, sessions: [] }).sessions, []);
  assert.deepEqual(parseSessionProjectIdentity({ canonicalRoot: '/work/project', projectMindId: 'project-existing' }),
    { canonicalRoot: '/work/project', projectMindId: 'project-existing' });
});

test('strict shape, identity, duplicate and size limits', () => {
  const collection = { schemaVersion: 1, project, revision: 1, sessions: [session] };
  for (const malformed of [
    { ...session, extra: true }, { ...session, schemaVersion: 2 }, { ...session, id: '../project/session' },
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
