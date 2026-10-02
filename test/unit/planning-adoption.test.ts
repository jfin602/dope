import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { parseArchitecture } from '../../packages/software-map/lib/index.js';
import { planAdoption } from '../../packages/visual-planning/lib/adoption.js';
import { stalePlanningMap } from '../../packages/visual-planning/lib/rebase.js';
import { parsePlanningMap, projectTarget } from '../../packages/visual-planning/lib/index.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { acceptInitialization, readInitialization, replaceArchitecture } from '../../packages/code-analysis/lib/node/smap-initialization-file.js';
import { readArchitecture } from '../../packages/code-analysis/lib/node/architecture-file.js';
import { VisualPlanningBackend } from '../../packages/theia-extension/lib/node/visual-planning-backend.js';

const architecture = parseArchitecture({ schemaVersion: 1, systems: [{ id: 'app', name: 'App', purpose: 'App', subsystems: [
  { id: 'api', name: 'API', purpose: 'API', roots: ['src/api'], components: [{ id: 'route', name: 'Route', purpose: 'Route', roots: ['src/api/route'] }] },
  { id: 'db', name: 'DB', purpose: 'DB', roots: ['src/db'] }
] }] });
const basis = { architectureRevision: 0, architectureFingerprint: 'fixture', physicalInputFingerprint: 'physical', physicalGeneration: 1 };
const node = (id: string, kind: 'system' | 'subsystem' | 'component', parentId?: string) =>
  ({ id, kind, ...(parentId ? { parentId } : {}), name: id, purpose: id, roots: kind === 'system' ? [] : [`src/${id}`] });
const add = (id: string, futureNodes: ReturnType<typeof node>[]) => ({ id, kind: 'add' as const, currentIds: [], futureNodes, dependsOn: [] });
const map = (transformations: any[], workItems: any[] = []) => parsePlanningMap({ schemaVersion: 1, id: 'plan', projectId: 'project-a', title: 'Plan', objective: 'Improve', status: 'active',
  revision: 0, history: [{ revision: 0, action: 'create', at: 'now' }], basis, transformations, workItems });
const changes = [
  add('new-system', [node('next', 'system')]),
  { ...add('new-subsystem', [node('worker', 'subsystem', 'next')]), dependsOn: ['new-system'] },
  { ...add('new-component', [node('handler', 'component', 'worker')]), dependsOn: ['new-subsystem'] },
  { id: 'move-route', kind: 'move' as const, currentIds: ['route'], futureNodes: [{ ...node('route', 'component', 'db'), name: 'Route', purpose: 'Route', roots: ['src/api/route'] }], dependsOn: [] },
];

test('bounded scopes include required hierarchy and produce exact canonical changes', () => {
  const planning = map(changes);
  const component = planAdoption(architecture, planning, { kind: 'component', id: 'handler' });
  assert.deepEqual(component.blockers, []);
  assert.deepEqual(component.includedDependentTransformationIds, ['new-subsystem', 'new-system']);
  assert.deepEqual(component.changes.map(c => [c.id, c.action]), [['handler', 'add'], ['next', 'add'], ['worker', 'add']]);
  const subsystem = planAdoption(architecture, planning, { kind: 'subsystem', id: 'worker' });
  assert.deepEqual(subsystem.blockers, []);
  assert.deepEqual(subsystem.changes.map(c => c.id), ['handler', 'next', 'worker']);
  const system = planAdoption(architecture, planning, { kind: 'system', id: 'next' });
  assert.deepEqual(system.blockers, []);
  assert.deepEqual(system.changes.map(c => c.id), ['handler', 'next', 'worker']);
  const selected = planAdoption(architecture, planning, { kind: 'transformations', ids: ['move-route'] });
  assert.deepEqual(selected.changes.map(c => [c.id, c.action]), [['route', 'reparent']]);
  assert.equal(selected.changes[0].before?.parentId, 'api');
  assert.equal(selected.changes[0].after?.parentId, 'db');
  assert.deepEqual(planAdoption(architecture, planning, { kind: 'subsystem', id: 'api' }).selectedTransformationIds, ['move-route']);
  assert.deepEqual(planAdoption(architecture, planning, { kind: 'subsystem', id: 'db' }).selectedTransformationIds, ['move-route']);
  const combined = planAdoption(architecture, planning, { kind: 'transformations', ids: ['move-route', 'new-component'] });
  assert.deepEqual(combined.blockers, []);
  assert.deepEqual(combined.changes.map(c => [c.id, c.action]), [['handler', 'add'], ['next', 'add'], ['route', 'reparent'], ['worker', 'add']]);
});

test('dependency, hierarchy, identity and strict declaration blockers are visible', () => {
  const dependency = map([{ ...add('new-target', [node('cache', 'subsystem', 'app')]), futureNodes: [{ ...node('cache', 'subsystem', 'app'), allowedDependencies: ['db'] }] }]);
  const proposal = planAdoption(architecture, dependency, { kind: 'transformations', ids: ['new-target'] });
  assert.deepEqual(proposal.blockers, []);
  assert.deepEqual(proposal.changes.map(c => c.id), ['cache']);
  const contract = planAdoption(architecture, map([{ id: 'allow-db', kind: 'change-contract', currentIds: ['api'],
    futureNodes: [{ id: 'api', kind: 'subsystem', parentId: 'app', name: 'API', purpose: 'API', roots: ['src/api'], allowedDependencies: ['db'] }], dependsOn: [] }]),
    { kind: 'subsystem', id: 'api' });
  assert.deepEqual(contract.changes.map(c => [c.id, c.action]), [['api', 'dependency']]);
  const invalid = planAdoption(architecture, map([add('duplicate', [node('api', 'subsystem', 'app')])]), { kind: 'transformations', ids: ['duplicate'] });
  assert.match(invalid.blockers.join(' '), /duplicate|Invalid/i);
  const orphan = planAdoption(architecture, map([add('orphan', [node('child', 'component', 'missing')])]), { kind: 'transformations', ids: ['orphan'] });
  assert.match(orphan.blockers.join(' '), /Missing parent/);
  const emptySystem = planAdoption(architecture, map([add('empty', [node('empty', 'system')])]), { kind: 'transformations', ids: ['empty'] });
  assert.match(emptySystem.blockers.join(' '), /requires a selected subsystem/);
  const conflicting = planAdoption(architecture, map([{ id: 'remove-api', kind: 'remove', currentIds: ['api'], futureNodes: [], dependsOn: [] }]),
    { kind: 'transformations', ids: ['remove-api'] });
  assert.match(conflicting.blockers.join(' '), /occupied|Invalid/);
  const removal = planAdoption(architecture, map([
    { id: 'remove-api', kind: 'remove', currentIds: ['api'], futureNodes: [], dependsOn: [] },
    { id: 'remove-route', kind: 'remove', currentIds: ['route'], futureNodes: [], dependsOn: [] }
  ]), { kind: 'transformations', ids: ['remove-api'] });
  assert.deepEqual(removal.blockers, []);
  assert.deepEqual(removal.includedDependentTransformationIds, ['remove-route']);
  assert.deepEqual(removal.changes.map(c => [c.id, c.action]), [['api', 'remove'], ['route', 'remove']]);
  const overlap = planAdoption(architecture, map([
    { id: 'name-one', kind: 'modify', currentIds: ['api'], futureNodes: [{ id: 'api', kind: 'subsystem', parentId: 'app', name: 'API One', purpose: 'API', roots: ['src/api'] }], dependsOn: [] },
    { id: 'name-two', kind: 'modify', currentIds: ['api'], futureNodes: [{ id: 'api', kind: 'subsystem', parentId: 'app', name: 'API Two', purpose: 'API', roots: ['src/api'] }], dependsOn: [] }
  ]), { kind: 'transformations', ids: ['name-one', 'name-two'] });
  assert.match(overlap.blockers.join(' '), /Conflicting transformations/);
});

async function fixture(run: (root: string, backend: VisualPlanningBackend, handle: string, store: PlanningStore) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'dope-adopt-'));
  try {
    await mkdir(join(root, '.dope'));
    await writeFile(join(root, '.dope/architecture.json'), `${JSON.stringify(architecture, null, 2)}\n`);
    await acceptInitialization(root, (await readInitialization(root)).declarationFingerprint);
    const store = new PlanningStore(), backend = new VisualPlanningBackend(store);
    const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
    await run(root, backend, handle, store);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('explicit acceptance updates canonical and preserves the old planning basis until rebase', async () => fixture(async (root, backend, handle, store) => {
  const state = await readInitialization(root);
  const realBasis = { ...basis, architectureFingerprint: state.declarationFingerprint };
  let collection = await store.mutate(root, 0,
    { type: 'create', id: 'plan', title: 'Plan', objective: 'Improve', basis: realBasis }, undefined,
    async () => ({ basis: realBasis, architecture, physicalNodes: [], relationships: [] }));
  await backend.read(handle);
  for (const change of [changes[0], changes[1], changes[2], changes[3]]) collection = await backend.mutate({ projectHandle: handle,
    expectedRevision: collection.revision, operation: { type: 'put-transformation', mapId: 'plan', transformation: change } });
  const work = { id: 'work', title: 'Work', objective: 'Build', transformationIds: ['new-component'], dependsOn: [], requirements: [], constraints: [],
    acceptanceCriteria: [], validationTargets: [], workingSet: [], status: 'proposed' as const };
  collection = await backend.mutate({ projectHandle: handle, expectedRevision: collection.revision,
    operation: { type: 'put-work-item', mapId: 'plan', workItem: work } });
  const request = { projectHandle: handle, mapId: 'plan', expectedRevision: collection.revision,
    expectedMapRevision: collection.maps[0].revision, expectedBasis: realBasis, scope: { kind: 'component' as const, id: 'handler' } };
  const preview = await backend.previewAdoption(request);
  assert.deepEqual(preview.blockers, []);
  await assert.rejects(backend.adoptTarget({ ...request, acceptedChanges: [], acceptedTransformationIds: [] }), /not accepted/);
  const before = await readFile(join(root, '.dope/architecture.json'), 'utf8');
  assert.equal(createHash('sha256').update(before).digest('hex'), realBasis.architectureFingerprint);
  const acceptedTransformationIds = [...preview.selectedTransformationIds, ...preview.includedDependentTransformationIds].sort();
  const after = await backend.adoptTarget({ ...request, acceptedChanges: preview.changes, acceptedTransformationIds });
  assert.deepEqual(after.maps[0].basis, realBasis);
  assert.deepEqual(after.maps[0].basisSnapshot?.basis, realBasis);
  assert.equal(after.maps[0].workItems[0].status, 'proposed');
  assert.deepEqual(after.maps[0].transformations.filter(t => t.adopted).map(t => t.id), acceptedTransformationIds);
  assert.equal(after.maps[0].transformations.find(t => t.id === 'move-route')?.adopted, undefined);
  assert.equal((await readArchitecture(root)).architecture.systems.some(s => s.id === 'next'), true);
  const nextFingerprint = (await readInitialization(root)).declarationFingerprint;
  assert.notEqual(nextFingerprint, after.maps[0].basis.architectureFingerprint);
  assert.equal(stalePlanningMap(after.maps[0], { basis: { ...realBasis, architectureFingerprint: nextFingerprint },
    architecture: (await readArchitecture(root)).architecture, physicalNodes: [], relationships: [] }).stale, true);
  assert.equal(projectTarget((await readArchitecture(root)).architecture, after.maps[0]).nodes.find(n => n.id === 'route')?.parentId, 'db');
  assert.equal((await store.read(root)).revision, after.revision);
  await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: after.revision,
    operation: { type: 'put-transformation', mapId: 'plan', transformation: { ...changes[3], adopted: true } } }), /Adopted transformations/);
  await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: after.revision,
    operation: { type: 'remove-transformation', mapId: 'plan', transformationId: 'new-component' } }), /Adopted transformations/);
  await assert.rejects(backend.adoptTarget({ ...request, acceptedChanges: preview.changes, acceptedTransformationIds }), /Stale/);
  assert.equal((await readFile(join(root, '.dope/architecture.json'), 'utf8')).includes('handler'), true);
  assert.equal((await readFile(join(root, '.dope/smap.json'), 'utf8')).includes('physical'), false);
  await assert.rejects(readFile(join(root, '.dope/smap-analysis.json')), /ENOENT/);
}));

test('stale canonical bytes and failed companion write preserve both durable documents', async () => fixture(async (root, backend, handle, store) => {
  const state = await readInitialization(root), realBasis = { ...basis, architectureFingerprint: state.declarationFingerprint };
  let collection = await backend.mutate({ projectHandle: handle, expectedRevision: 0,
    operation: { type: 'create', id: 'plan', title: 'Plan', objective: 'Improve', basis: realBasis } });
  collection = await backend.mutate({ projectHandle: handle, expectedRevision: collection.revision,
    operation: { type: 'put-transformation', mapId: 'plan', transformation: changes[3] } });
  const request = { projectHandle: handle, mapId: 'plan', expectedRevision: collection.revision,
    expectedMapRevision: collection.maps[0].revision, expectedBasis: realBasis, scope: { kind: 'transformations' as const, ids: ['move-route'] } };
  const preview = await backend.previewAdoption(request);
  const arch = await readFile(join(root, '.dope/architecture.json'), 'utf8');
  const planning = await readFile(join(root, '.dope/planning-maps.json'), 'utf8');
  await assert.rejects(store.adopt(root, { ...request, acceptedChanges: preview.changes, acceptedTransformationIds: ['move-route'] },
    collection.projectId, (fingerprint, declaration) => replaceArchitecture(root, fingerprint, declaration, async () => { throw new Error('injected failure'); })), /injected failure/);
  assert.equal(await readFile(join(root, '.dope/planning-maps.json'), 'utf8'), planning);
  assert.equal(await readFile(join(root, '.dope/architecture.json'), 'utf8'), arch);
  const markerPath = join(root, '.dope/smap.json');
  const marker = await readFile(markerPath, 'utf8');
  await assert.rejects(store.adopt(root, { ...request, acceptedChanges: preview.changes, acceptedTransformationIds: ['move-route'] },
    collection.projectId, (fingerprint, declaration, beforeCommit) => replaceArchitecture(root, fingerprint, declaration, async () => {
      const rollback = await beforeCommit();
      await writeFile(markerPath, `${marker} `);
      return rollback;
    })), /Stale Software Map marker/);
  assert.equal(await readFile(join(root, '.dope/planning-maps.json'), 'utf8'), planning);
  assert.equal(await readFile(join(root, '.dope/architecture.json'), 'utf8'), arch);
  await writeFile(markerPath, marker);
  await writeFile(join(root, '.dope/architecture.json'), `${arch} `);
  await assert.rejects(backend.adoptTarget({ ...request, acceptedChanges: preview.changes, acceptedTransformationIds: ['move-route'] }), /marker|Stale/);
  assert.equal(await readFile(join(root, '.dope/planning-maps.json'), 'utf8'), planning);
}));

test('corrupt, future and unsafe architecture files refuse adoption without rewriting planning', async () => fixture(async (root, backend, handle) => {
  const state = await readInitialization(root), realBasis = { ...basis, architectureFingerprint: state.declarationFingerprint };
  const collection = await backend.mutate({ projectHandle: handle, expectedRevision: 0,
    operation: { type: 'create', id: 'plan', title: 'Plan', objective: 'Improve', basis: realBasis } });
  const planning = await readFile(join(root, '.dope/planning-maps.json'), 'utf8');
  const path = join(root, '.dope/architecture.json');
  const request = { projectHandle: handle, mapId: 'plan', expectedRevision: collection.revision,
    expectedMapRevision: collection.maps[0].revision, expectedBasis: realBasis,
    scope: { kind: 'transformations' as const, ids: ['none'] }, acceptedChanges: [], acceptedTransformationIds: [] };
  for (const bytes of ['{broken', '{"schemaVersion":2,"systems":[]}']) {
    await writeFile(path, bytes);
    await assert.rejects(backend.adoptTarget(request));
    assert.equal(await readFile(path, 'utf8'), bytes);
    assert.equal(await readFile(join(root, '.dope/planning-maps.json'), 'utf8'), planning);
  }
  await rm(path);
  const outside = join(root, 'outside');
  await writeFile(outside, 'untouched');
  await symlink(outside, path);
  await assert.rejects(backend.adoptTarget(request), /Unsafe/);
  assert.equal(await readFile(outside, 'utf8'), 'untouched');
  assert.equal(await readFile(join(root, '.dope/planning-maps.json'), 'utf8'), planning);
}));
