import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { previewTransformation } from '../../packages/visual-planning/lib/editing.js';
import { projectTarget } from '../../packages/visual-planning/lib/index.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { createRequire } from 'node:module';
import type { SoftwareMapController } from '../../packages/theia-extension/src/browser/software-map-controller.ts';
import type { VisualPlanningService, PlanningCollection, PlanningMutation } from '../../packages/visual-planning/src/service.ts';
import type { ArchitectureDeclaration } from '../../packages/software-map/src/index.ts';
import type { PlanningMap, PlannedNode } from '../../packages/visual-planning/src/index.ts';

const architecture: ArchitectureDeclaration = { schemaVersion: 1, systems: [{ id: 'sys', name: 'System', purpose: 'Own software', subsystems: [
  { id: 'a', name: 'A', purpose: 'A', roots: ['src/a'], allowedDependencies: ['b'], components: [
    { id: 'one', name: 'One', purpose: 'One', roots: ['src/a/one'] }, { id: 'two', name: 'Two', purpose: 'Two', roots: ['src/a/two'] }
  ] }, { id: 'b', name: 'B', purpose: 'B', roots: ['src/b'] }, { id: 'c', name: 'C', purpose: 'C', roots: ['src/c'] }
] }] };
const basis = { architectureRevision: 0, architectureFingerprint: 'arch', physicalInputFingerprint: 'physical', physicalGeneration: 1 };
const map = (): PlanningMap => ({ schemaVersion: 1, id: 'plan', projectId: 'project', title: 'Plan', objective: 'Change', status: 'draft',
  revision: 0, history: [{ revision: 0, action: 'create', at: 'now' }], basis, transformations: [], workItems: [] });
const node = (id: string, kind: PlannedNode['kind'], parentId?: string): PlannedNode =>
  ({ id, kind, ...(parentId ? { parentId } : {}), name: id, purpose: id, roots: [] });
const require = createRequire(import.meta.url);
const { PlanningMapController } = require('../../packages/theia-extension/lib/browser/planning-map-controller.js') as
  typeof import('../../packages/theia-extension/src/browser/planning-map-controller.ts');

test('each supported gesture yields a typed preview; complex edits are explicit', () => {
  const current = map(), before = JSON.stringify(architecture);
  assert.equal(previewTransformation(architecture, current, { kind: 'add', node: node('new-sys', 'system') }, 'add').kind, 'add');
  assert.equal(previewTransformation(architecture, current, { kind: 'add', node: node('new-sub', 'subsystem', 'sys') }, 'add').kind, 'add');
  assert.equal(previewTransformation(architecture, current, { kind: 'add', node: node('new-component', 'component', 'a') }, 'add').kind, 'add');
  assert.deepEqual(previewTransformation(architecture, current, { kind: 'move', id: 'one', parentId: 'b' }, 'move').futureNodes[0].parentId, 'b');
  assert.equal(previewTransformation(architecture, current, { kind: 'remove', id: 'two' }, 'remove').kind, 'remove');
  assert.deepEqual(previewTransformation(architecture, current, { kind: 'draw-relationship', sourceId: 'a', targetId: 'c' }, 'redirect').redirect?.to,
    { sourceId: 'a', targetId: 'c', policy: 'allowed' });
  assert.equal(previewTransformation(architecture, current, { kind: 'redirect-relationship',
    from: { sourceId: 'a', targetId: 'b', policy: 'allowed' }, to: { sourceId: 'a', targetId: 'c', policy: 'allowed' } }, 'explicit').kind,
  'redirect-relationship');
  for (const kind of ['modify', 'change-contract', 'split', 'merge'] as const) {
    const currentIds = kind === 'merge' ? ['one', 'two'] : kind === 'change-contract' ? ['a'] : ['one'];
    const futureNodes = kind === 'split' ? [node('part-a', 'component', 'a'), node('part-b', 'component', 'a')] :
      kind === 'merge' ? [node('combined', 'component', 'a')] : kind === 'change-contract' ?
      [{ ...node('a', 'subsystem', 'sys'), allowedDependencies: ['c'] }] : [{ ...node('one', 'component', 'a'), name: 'Changed' }];
    assert.equal(previewTransformation(architecture, current, { kind, currentIds, futureNodes }, kind).kind, kind);
  }
  assert.deepEqual(current.transformations, []); // preview/cancel cannot mutate the map
  assert.equal(JSON.stringify(architecture), before);
});

test('invalid geometry, hierarchy, identities and conflicting references fail without changing truth', () => {
  const current = map();
  assert.throws(() => previewTransformation(architecture, current, { kind: 'move', id: 'one', parentId: 'sys' }, 'bad'), /hierarchy/);
  assert.throws(() => previewTransformation(architecture, current, { kind: 'move', id: 'missing', parentId: 'b' }, 'bad'), /Unknown/);
  assert.throws(() => previewTransformation(architecture, current, { kind: 'remove', id: 'a' }, 'bad'), /occupied/);
  assert.throws(() => previewTransformation(architecture, current, { kind: 'draw-relationship', sourceId: 'b', targetId: 'c' }, 'bad'), /Ambiguous/);
  assert.throws(() => previewTransformation(architecture, current, { kind: 'add', node: node('a', 'subsystem', 'sys') }, 'bad'), /duplicate/);
  const moved = previewTransformation(architecture, current, { kind: 'move', id: 'one', parentId: 'b' }, 'move');
  assert.throws(() => previewTransformation(architecture, { ...current, transformations: [moved] },
    { kind: 'remove', id: 'one' }, 'remove'), /Conflicting/);
  assert.equal(projectTarget(architecture, current).nodes.find(n => n.id === 'one')?.parentId, 'a');
});

test('explicit commit, durable semantic undo/redo, stale rejection and canonical isolation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-edit-'));
  try {
    await mkdir(join(root, '.dope'));
    const canonical = `${JSON.stringify(architecture)}\n`;
    await writeFile(join(root, '.dope/architecture.json'), canonical);
    const store = new PlanningStore();
    const actualBasis = { ...basis, architectureFingerprint: createHash('sha256').update(canonical).digest('hex') };
    let state = await store.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Change', basis: actualBasis });
    const change = previewTransformation(architecture, state.maps[0], { kind: 'move', id: 'one', parentId: 'b' }, 'move');
    const bytesBefore = await readFile(join(root, '.dope/planning-maps.json'), 'utf8');
    assert.equal(state.maps[0].transformations.length, 0); // cancel preview
    assert.equal(await readFile(join(root, '.dope/planning-maps.json'), 'utf8'), bytesBefore);
    state = await store.mutate(root, state.revision, { type: 'put-transformation', mapId: 'plan', transformation: change,
      expectedMapRevision: state.maps[0].revision, expectedBasis: actualBasis });
    assert.equal(state.maps[0].transformations[0].kind, 'move');
    await assert.rejects(store.mutate(root, state.revision, { type: 'undo', mapId: 'plan', expectedMapRevision: 0,
      expectedBasis: actualBasis }), /Stale/);
    state = await store.mutate(root, state.revision, { type: 'undo', mapId: 'plan', expectedMapRevision: state.maps[0].revision,
      expectedBasis: actualBasis });
    assert.deepEqual(state.maps[0].transformations, []);
    assert.equal(state.maps[0].editHistory?.redo.length, 1);
    state = await store.mutate(root, state.revision, { type: 'redo', mapId: 'plan', expectedMapRevision: state.maps[0].revision,
      expectedBasis: actualBasis });
    assert.equal(state.maps[0].transformations[0].kind, 'move');
    assert.equal(state.maps[0].history.at(-1)?.action, 'redo:plan');
    assert.equal((await store.read(root)).maps[0].editHistory?.undo.length, 1);
    assert.equal(await readFile(join(root, '.dope/architecture.json'), 'utf8'), canonical);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('controller requires visible preview, explicit commit, and fresh revision/basis', async () => {
  const physical = { workspace: 'file:///project', status: { state: 'ready', inputFingerprint: 'physical', generation: 1 },
    initialization: { declarationFingerprint: 'arch' }, onChange: () => ({ dispose() {} }) };
  let collection: PlanningCollection = { schemaVersion: 1, projectId: 'project', revision: 1, maps: [map()] };
  let writes = 0;
  const service = {
    async attach() { return { projectHandle: 'handle', snapshot: collection }; },
    async read() { return collection; },
    async preview(_handle: string, id: string, revision: number, mapRevision: number,
      command: Parameters<typeof previewTransformation>[2], transformationId: string) {
      assert.equal(id, 'plan'); assert.equal(revision, collection.revision); assert.equal(mapRevision, collection.maps[0].revision);
      return previewTransformation(architecture, collection.maps[0], command, transformationId);
    },
    async mutate(request: PlanningMutation) {
      writes++;
      assert.equal(request.expectedRevision, collection.revision);
      assert.equal(request.operation.type, 'put-transformation');
      if (request.operation.type === 'put-transformation') {
        const current = collection.maps[0];
        assert.equal(request.operation.expectedMapRevision, current.revision);
        collection = { ...collection, revision: collection.revision + 1, maps: [{ ...current,
          revision: current.revision + 1, history: [...current.history, { revision: current.revision + 1, action: 'put', at: 'now' }],
          transformations: [request.operation.transformation] }] };
      }
      return collection;
    }
  };
  const controller = new PlanningMapController(physical as unknown as SoftwareMapController, () => service as unknown as VisualPlanningService);
  await new Promise(resolve => setImmediate(resolve));
  await controller.beginEdit({ kind: 'move', id: 'one', parentId: 'b' });
  assert.equal(controller.preview?.transformation.kind, 'move');
  assert.equal(writes, 0);
  controller.cancelEdit(); assert.equal(controller.preview, undefined);
  await controller.beginEdit({ kind: 'move', id: 'one', parentId: 'b' });
  collection = { ...collection, revision: 2 };
  await controller.refresh();
  await controller.commitEdit();
  assert.equal(writes, 0);
  await controller.beginEdit({ kind: 'move', id: 'one', parentId: 'b' });
  await controller.commitEdit();
  assert.equal(writes, 1);
  assert.equal(controller.selected?.transformations[0].kind, 'move');
  physical.status.inputFingerprint = 'changed';
  await controller.beginEdit({ kind: 'add', node: node('future', 'component', 'a') });
  assert.equal(controller.preview, undefined);
  assert.match(controller.error, /stale/i);
  controller.dispose();
});
