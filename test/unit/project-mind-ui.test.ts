import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { ProjectMindController } = require('../../packages/theia-extension/lib/browser/project-mind-controller.js');
const { ProjectMindBackend } = require('../../packages/theia-extension/lib/node/project-mind-backend.js');
const { ProjectMindStore } = require('../../packages/project-intelligence/lib/node/project-mind-store.js');

const deferred = () => {
  let resolve: (value: any) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<any>((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
const note = (title: string) => ({ schemaVersion: 2, type: 'note', id: randomUUID(), title, body: 'original', status: 'active',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), provenance: 'developer', archivedAt: null, links: [] });
const snapshot = (title: string, revision = 1) => ({ schemaVersion: 2, projectId: randomUUID(), revision, artifacts: [note(title)] });
const connection = () => {
  const pendingAttach = deferred();
  const pendingSave = deferred();
  const pendingRead = deferred();
  let client: any;
  let disposed = false;
  return {
    pendingAttach, pendingSave, pendingRead,
    setClient(value: any) { client = value; },
    event(value: any) { client?.notifyProjectMindChanged(value); },
    listener() { return client; },
    attach() { return pendingAttach.promise; },
    mutate() { return pendingSave.promise; },
    read() { return this.pendingRead.promise; },
    migrate() { return Promise.reject(new Error('no legacy Note')); },
    dispose() { disposed = true; },
    get disposed() { return disposed; }
  };
};

test('delayed attachment and committed save from A cannot render over B', async () => {
  const a = connection();
  const b = connection();
  const mind = new ProjectMindController(() => !a.disposed ? a : b, () => {});
  const first = mind.attach('file:///A');
  const second = mind.attach('file:///B');
  const projectA = snapshot('A');
  const projectB = snapshot('B');
  a.pendingAttach.resolve({ projectHandle: 'a', snapshot: projectA });
  b.pendingAttach.resolve({ projectHandle: 'b', snapshot: projectB });
  await Promise.all([first, second]);
  assert.equal(mind.workspace, 'file:///B');
  assert.equal(mind.projectId, projectB.projectId);
  const a2 = connection();
  const b2 = connection();
  let count = 0;
  const editor = new ProjectMindController(() => ++count === 1 ? a2 : b2, () => {});
  const attached = editor.attach('file:///A');
  a2.pendingAttach.resolve({ projectHandle: 'a', snapshot: projectA });
  await attached;
  editor.select(projectA.artifacts[0].id);
  editor.edit('body', 'unsaved A');
  const saving = editor.save();
  assert.equal(editor.pending, true);
  assert.equal(editor.pendingOperation, 'replace');
  assert.equal(editor.baseRevision, 1);
  assert.equal(await editor.attach('file:///B'), false);
  const switched = editor.attach('file:///B', true);
  b2.pendingAttach.resolve({ projectHandle: 'b', snapshot: projectB });
  await switched;
  a2.pendingSave.resolve({ ...projectA, revision: 2, artifacts: [{ ...projectA.artifacts[0], body: 'unsaved A' }] });
  assert.equal(await saving, false);
  assert.equal(editor.projectId, projectB.projectId);
  assert.equal(editor.pending, false);
  assert.equal(editor.pendingOperation, undefined);
  assert.equal(editor.draft, undefined);
  assert.equal(a2.disposed, true);
});

test('peer event preserves dirty text; stale/conflict/failure retain draft until explicit reload', async () => {
  const peer = connection();
  const mind = new ProjectMindController(() => peer, () => {});
  const original = snapshot('note');
  const attached = mind.attach('file:///A');
  peer.pendingAttach.resolve({ projectHandle: 'a', snapshot: original });
  await attached;
  mind.select(original.artifacts[0].id);
  mind.edit('body', 'my draft');
  peer.event({ projectId: original.projectId, revision: 2 });
  assert.equal(mind.draft.body, 'my draft');
  assert.equal(mind.stale, true);
  assert.equal(await mind.save(), false);
  assert.equal(mind.draft.body, 'my draft');
  const reloading = mind.refresh(true);
  peer.pendingRead.resolve({ ...original, revision: 2 });
  assert.equal(await reloading, true);
  assert.equal(mind.draft.body, 'original');
  mind.edit('body', 'retry me');
  const failed = mind.save();
  assert.equal(mind.canLeave, false);
  peer.pendingSave.reject(new Error('Stale Project Mind revision'));
  assert.equal(await failed, false);
  assert.equal(mind.draft.body, 'retry me');
  assert.match(mind.error, /Stale Project Mind revision.*Draft retained/);
  assert.equal(mind.canLeave, false);
});

test('selection/close cannot lose draft and disposal silences callbacks and late reads', async () => {
  const peer = connection();
  let changes = 0;
  const mind = new ProjectMindController(() => peer, () => { changes++; });
  const original = snapshot('note');
  const attached = mind.attach('file:///A');
  peer.pendingAttach.resolve({ projectHandle: 'a', snapshot: original });
  await attached;
  mind.select(original.artifacts[0].id);
  mind.edit('body', 'keep me');
  assert.equal(mind.select(undefined), false);
  assert.equal(await mind.attach('file:///B'), false);
  assert.equal(mind.canLeave, false);
  assert.equal(mind.draft.body, 'keep me');
  mind.select(original.artifacts[0].id); // blocked until an explicit discard/reload
  assert.equal(mind.draft.body, 'keep me');
  mind.dispose();
  const oldClient = peer.listener();
  oldClient?.notifyProjectMindChanged({ projectId: original.projectId, revision: 2 });
  assert.equal(peer.disposed, true);
  assert.equal(await mind.attach('file:///B'), false);
  assert.equal(mind.draft.body, 'keep me');
  assert.ok(changes > 0);
});

test('late read cannot replace a newly edited draft, and empty projects follow first peer creation', async () => {
  const peer = connection();
  const mind = new ProjectMindController(() => peer, () => {});
  const attached = mind.attach('file:///A');
  peer.pendingAttach.resolve({ projectHandle: 'a', snapshot: undefined });
  await attached;
  const created = snapshot('peer');
  peer.event({ projectId: created.projectId, revision: 1 });
  peer.pendingRead.resolve(created);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(mind.projectId, created.projectId);
  mind.select(created.artifacts[0].id);
  peer.pendingRead = deferred();
  peer.event({ projectId: created.projectId, revision: 2 });
  const waiting = mind.refresh();
  mind.edit('body', 'typed while reading');
  peer.pendingRead.resolve({ ...created, revision: 2 });
  assert.equal(await waiting, false);
  assert.equal(mind.draft.body, 'typed while reading');
  assert.equal(mind.stale, true);
});

test('controller creates, transitions and archives through the real backend/store', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-mind-ui-'));
  const store = new ProjectMindStore();
  const mind = new ProjectMindController(() => {
    let client: any;
    const backend = new ProjectMindBackend(store, { notifyProjectMindChanged: event => client?.notifyProjectMindChanged(event) });
    return { setClient(value: any) { client = value; }, dispose: () => backend.dispose(),
      attach: (uri: string) => backend.attach(uri), read: (handle: string) => backend.read(handle),
      mutate: (request: any) => backend.mutate(request), migrate: (handle: string) => backend.migrate(handle) };
  }, () => {});
  try {
    await mind.attach(pathToFileURL(root).toString());
    assert.equal(mind.attached, true);
    assert.equal(mind.create('question'), true);
    mind.edit('title', 'Why?');
    mind.edit('body', 'A question');
    mind.edit('answer', 'Because');
    assert.equal(await mind.save(), true);
    assert.equal(mind.revision, 1);
    const id = mind.selectedId;
    assert.equal(await mind.mutate({ type: 'transition', artifactId: id, status: 'answered', answer: 'Because' }), true);
    assert.equal(await mind.mutate({ type: 'archive', artifactId: id, archived: true }), true);
    const saved = await store.read(root);
    assert.equal(saved.revision, 3);
    assert.equal(saved.artifacts[0].status, 'answered');
    assert.ok(saved.artifacts[0].archivedAt);
  } finally { mind.dispose(); await rm(root, { recursive: true, force: true }); }
});
