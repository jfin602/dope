import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cp, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { VisualPlanningBackend } from '../../packages/theia-extension/lib/node/visual-planning-backend.js';

const basis = { architectureRevision: 1, architectureFingerprint: 'architecture', physicalInputFingerprint: 'source', physicalGeneration: 1 };
const create = (id: string) => ({ type: 'create' as const, id, title: id, objective: 'Improve architecture', basis });
const uri = (root: string) => pathToFileURL(root).href;
const file = (root: string) => join(root, '.dope', 'planning-maps.json');
async function fixture(run: (first: string, second: string) => Promise<void>) {
  const parent = await mkdtemp(join(tmpdir(), 'dope-planning-'));
  const first = join(parent, 'first'), second = join(parent, 'second');
  await mkdir(first); await mkdir(second);
  try { await run(first, second); } finally { await rm(parent, { recursive: true, force: true }); }
}

test('empty collection, multiple maps, history, duplicate and reopen retain project identity', async () => fixture(async (first, second) => {
  const store = new PlanningStore();
  const root = await store.root(uri(first));
  assert.deepEqual(await store.read(root), { schemaVersion: 1, projectId: 'uninitialized', revision: 0, maps: [] });
  await mkdir(join(first, '.dope'));
  const legacy = '{"old":"planning"}\n';
  await writeFile(join(first, '.dope/planning.json'), legacy);
  const one = await store.mutate(root, 0, create('first'));
  assert.equal(one.revision, 1);
  assert.equal(one.maps[0].revision, 0);
  const two = await store.mutate(root, 1, create('second'));
  const three = await store.mutate(root, 2, { type: 'duplicate', mapId: 'first', newId: 'branch' });
  const four = await store.mutate(root, 3, { type: 'transition', mapId: 'first', status: 'active' });
  assert.deepEqual(four.maps.map(map => map.id), ['branch', 'first', 'second']);
  assert.equal(four.maps.find(map => map.id === 'first')?.history.at(-1)?.action, 'status:active');
  assert.equal(three.maps.find(map => map.id === 'branch')?.branchedFrom, 'first');
  assert.deepEqual(await new PlanningStore().read(root), four);
  assert.equal(await readFile(join(first, '.dope/planning.json'), 'utf8'), legacy);
  await cp(join(first, '.dope'), join(second, '.dope'), { recursive: true });
  assert.deepEqual(await new PlanningStore().read(await store.root(uri(second))), four);
  const other = await store.mutate(second, 4, create('third'));
  assert.equal(other.projectId, four.projectId);
  assert.equal((await store.read(root)).revision, 4);
}));

test('typed transformation and WorkItem mutations reject traversal and preserve revision', async () => fixture(async first => {
  const store = new PlanningStore();
  await store.mutate(first, 0, create('plan'));
  const transformation = { id: 'add-core', kind: 'add' as const, currentIds: [], dependsOn: [],
    futureNodes: [{ id: 'core', kind: 'system' as const, name: 'Core', purpose: 'Domain', roots: ['src/core'] }] };
  const two = await store.mutate(first, 1, { type: 'put-transformation', mapId: 'plan', transformation });
  assert.equal(two.maps[0].revision, 1);
  await assert.rejects(store.mutate(first, 2, { type: 'put-transformation', mapId: 'plan', transformation: {
    ...transformation, futureNodes: [{ ...transformation.futureNodes[0], roots: ['../escape'] }],
  } }), /Invalid/);
  const workItem = { id: 'build-core', title: 'Build core', objective: 'Create core', transformationIds: ['add-core'], dependsOn: [],
    requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: ['src/core'], status: 'proposed' as const };
  const three = await store.mutate(first, 2, { type: 'put-work-item', mapId: 'plan', workItem });
  assert.equal(three.maps[0].workItems.length, 1);
  await assert.rejects(store.mutate(first, 3, { type: 'remove-transformation', mapId: 'plan', transformationId: 'add-core' }), /unknown transformation/);
  assert.equal((await store.read(first)).revision, 3);
}));

test('WorkItem split and merge commit atomically and reject illegal status changes', async () => fixture(async first => {
  const store = new PlanningStore();
  await store.mutate(first, 0, create('plan'));
  const transformation = { id: 'add-core', kind: 'add' as const, currentIds: [], dependsOn: [],
    futureNodes: [{ id: 'core', kind: 'system' as const, name: 'Core', purpose: 'Domain', roots: [] }] };
  await store.mutate(first, 1, { type: 'put-transformation', mapId: 'plan', transformation });
  const work = (id: string) => ({ id, title: id, objective: id, transformationIds: ['add-core'], dependsOn: [],
    requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: [], status: 'proposed' as const });
  await store.mutate(first, 2, { type: 'put-work-item', mapId: 'plan', workItem: work('original') });
  await assert.rejects(store.mutate(first, 3, { type: 'put-work-item', mapId: 'plan',
    workItem: { ...work('original'), status: 'completed', completionNotes: 'Done' } }), /Illegal WorkItem transition/);
  assert.equal((await store.read(first)).revision, 3);
  const split = await store.mutate(first, 3, { type: 'split-work-item', mapId: 'plan', sourceId: 'original',
    parts: [work('left'), work('right')] });
  assert.deepEqual(split.maps[0].workItems.map(item => item.id), ['left', 'right']);
  await assert.rejects(store.mutate(first, 4, { type: 'merge-work-items', mapId: 'plan', sourceIds: ['left', 'right'],
    merged: { ...work('merged'), transformationIds: ['missing'] } }), /preserve transformation/);
  assert.equal((await store.read(first)).revision, 4);
  const merged = await store.mutate(first, 4, { type: 'merge-work-items', mapId: 'plan', sourceIds: ['left', 'right'], merged: work('merged') });
  assert.deepEqual(merged.maps[0].workItems.map(item => item.id), ['merged']);
}));

test('stale and simultaneous writers serialize; live and abandoned locks are handled', async () => fixture(async first => {
  const a = new PlanningStore(), b = new PlanningStore();
  await a.mutate(first, 0, create('one'));
  await assert.rejects(b.mutate(first, 0, create('stale')), /Stale/);
  const results = await Promise.allSettled([a.mutate(first, 1, create('two')), b.mutate(first, 1, create('three'))]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await a.read(first)).revision, 2);
  const lock = join(first, '.dope/planning-maps.lock');
  const child = spawn(process.execPath, ['-e', `const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(lock)},process.pid+'\\n',{flag:'wx'});process.stdout.write('ready\\n');process.stdin.on('data',()=>process.exit(0));`], { stdio: ['pipe', 'pipe', 'inherit'] });
  try {
    await new Promise<void>((resolve, reject) => { child.stdout.once('data', () => resolve()); child.once('error', reject); });
    await assert.rejects(a.mutate(first, 2, create('blocked')), /locked/);
  } finally {
    child.stdin.write('done\n');
    await new Promise<void>(resolve => child.once('exit', () => resolve()));
  }
  const recovered = await b.mutate(first, 2, create('recovered'));
  assert.equal(recovered.revision, 3);
}));

test('corrupt and future bytes refuse mutation without rewriting; unsafe entries stay untouched', async () => fixture(async (first, second) => {
  const store = new PlanningStore();
  await mkdir(join(first, '.dope'));
  for (const bytes of ['{', '{"schemaVersion":2,"projectId":"project-x","revision":1,"maps":[]}',
    '{"schemaVersion":1,"projectId":"project-x","revision":1,"maps":[],"viewport":{},"provider":"local"}']) {
    await writeFile(file(first), bytes);
    await assert.rejects(store.read(first), /Corrupt/);
    await assert.rejects(store.mutate(first, 0, create('plan')), /Corrupt/);
    assert.equal(await readFile(file(first), 'utf8'), bytes);
  }
  await rm(file(first));
  await writeFile(join(second, 'target'), 'untouched');
  await symlink(join(second, 'target'), file(first));
  await assert.rejects(store.read(first), /Unsafe/);
  await assert.rejects(store.mutate(first, 0, create('plan')), /Unsafe/);
  assert.equal(await readFile(join(second, 'target'), 'utf8'), 'untouched');
  await rm(file(first)); await rm(join(first, '.dope'), { recursive: true });
  await symlink(second, join(first, '.dope'));
  await assert.rejects(store.read(first), /Unsafe/);
  await assert.rejects(store.mutate(first, 0, create('plan')), /Unsafe/);
  await assert.rejects(store.root('https://example.com/project'), /local/);
}));

test('separate projects and backend handles cannot redirect or survive disposal', async () => fixture(async (first, second) => {
  const store = new PlanningStore();
  const backend = new VisualPlanningBackend(store);
  const attached = await backend.attach(uri(first));
  const handle = attached.projectHandle;
  assert.equal(attached.snapshot.revision, 0);
  await assert.rejects(backend.attach(uri(second)), /different/);
  await assert.rejects(backend.read('wrong'), /handle/);
  const one = await backend.mutate({ projectHandle: handle, expectedRevision: 0, operation: create('one') });
  assert.equal((await backend.get(handle, 'one'))?.id, 'one');
  assert.equal((await backend.list(handle)).length, 1);
  assert.deepEqual(await backend.conflicts(handle), []);
  const secondMap = await backend.mutate({ projectHandle: handle, expectedRevision: 1, operation: create('another') });
  const target = (name: string) => ({ id: 'shared', kind: 'system' as const, name, purpose: 'Shared', roots: [] });
  let revision = secondMap.revision;
  for (const [mapId, name] of [['one', 'First'], ['another', 'Second']] as const) {
    const changed = await backend.mutate({ projectHandle: handle, expectedRevision: revision++, operation: {
      type: 'put-transformation', mapId, transformation: { id: 'add-shared', kind: 'add', currentIds: [], futureNodes: [target(name)], dependsOn: [] },
    } });
    assert.equal(changed.revision, revision);
    await backend.mutate({ projectHandle: handle, expectedRevision: revision++, operation: { type: 'transition', mapId, status: 'active' } });
  }
  assert.equal((await backend.conflicts(handle))[0].identityId, 'shared');
  const other = new VisualPlanningBackend(store);
  const secondHandle = (await other.attach(uri(second))).projectHandle;
  const two = await other.mutate({ projectHandle: secondHandle, expectedRevision: 0, operation: create('two') });
  assert.notEqual(two.projectId, one.projectId);
  await writeFile(file(first), JSON.stringify({ ...one, projectId: 'project-changed', maps: one.maps.map(map => ({ ...map, projectId: 'project-changed' })) }));
  await assert.rejects(backend.read(handle), /identity changed/);
  await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: 1, operation: create('bad') }), /identity changed/);
  backend.dispose();
  await assert.rejects(backend.read(handle), /handle/);
  await assert.rejects(backend.attach(uri(first)), /Disposed/);
  other.dispose();
}));
