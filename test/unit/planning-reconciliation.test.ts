import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { canCloseOut, parsePlanningMap, transitionMap } from '../../packages/visual-planning/lib/index.js';
import { reconcilePlanningMap, reconciliationRollups } from '../../packages/visual-planning/lib/reconciliation.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';
import { TypeScriptAnalyzer } from '../../packages/code-analysis-typescript/lib/index.js';
import { acceptInitialization, readInitialization } from '../../packages/code-analysis/lib/node/smap-initialization-file.js';
import { VisualPlanningBackend } from '../../packages/theia-extension/lib/node/visual-planning-backend.js';
import type { PlannedTransformation, PlanningMap, RebaseReality } from '../../packages/visual-planning/src/index.ts';

const basis = { architectureRevision: 0, architectureFingerprint: 'arch', physicalInputFingerprint: 'old', physicalGeneration: 1 };
const change = (id: string, target: string): PlannedTransformation => ({ id, kind: 'modify', currentIds: ['a'],
  futureNodes: [{ id: 'a', kind: 'subsystem', parentId: 'sys', name: target, purpose: 'Purpose', roots: ['src/a'] }], dependsOn: [] });
const architecture = { schemaVersion: 1 as const, systems: [{ id: 'sys', name: 'System', purpose: 'Purpose', subsystems: [
  { id: 'a', name: 'A', purpose: 'Purpose', roots: ['src/a'], components: [] },
  { id: 'other', name: 'Other', purpose: 'Purpose', roots: ['src/other'], components: [] }
] }] };
const physical = (name = 'A') => [
  { id: 'sys', kind: 'system', name: 'System', evidenceIds: ['declaration'] },
  { id: 'a', kind: 'subsystem', parentId: 'sys', name, evidenceIds: ['declaration'] },
  { id: 'other', kind: 'subsystem', parentId: 'sys', name: 'Other', evidenceIds: ['declaration'] },
  { id: 'code:a', kind: 'code', parentId: 'a', name: 'a.ts', path: 'src/a.ts', evidenceIds: ['syntax-a'] },
  { id: 'code:other', kind: 'code', parentId: 'other', name: 'other.ts', path: 'src/other.ts', evidenceIds: ['syntax-other'] }
];
const old: RebaseReality = { basis, architecture, physicalNodes: physical(), relationships: [],
  sourceHashes: { 'src/a.ts': 'a'.repeat(64), 'src/other.ts': 'b'.repeat(64) } };
const fresh = (name = 'Target', otherHash = 'b'): RebaseReality => ({ ...old,
  basis: { ...basis, physicalInputFingerprint: 'new', physicalGeneration: 2 }, physicalNodes: physical(name),
  sourceHashes: { 'src/a.ts': 'c'.repeat(64), 'src/other.ts': otherHash.repeat(64) } });
const map = (transformations: PlannedTransformation[] = [change('edit-a', 'Target')]): PlanningMap =>
  parsePlanningMap({ schemaVersion: 1, id: 'plan', projectId: 'project', title: 'Plan', objective: 'Change architecture',
    status: 'active', revision: 0, history: [{ revision: 0, action: 'create', at: '2026-10-01' }], basis,
    basisSnapshot: old, transformations, workItems: [] });

test('fresh source-backed comparison retains all outcomes, unexpected code, and rollups independent of WorkItem completion', () => {
  const target = map([change('edit-a', 'Target'), { id: 'add-missing', kind: 'add', currentIds: [],
    futureNodes: [{ id: 'missing', kind: 'subsystem', parentId: 'sys', name: 'Missing', purpose: 'Purpose', roots: [] }], dependsOn: [] }]);
  target.workItems = [{ id: 'work', title: 'Work', objective: 'Work', transformationIds: ['edit-a', 'add-missing'],
    dependsOn: [], requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: [],
    status: 'completed', completionNotes: 'Code done' }];
  const report = reconcilePlanningMap(target, fresh('Target', 'd'), '2026-10-01');
  assert.deepEqual(report.results.map(r => r.outcome), ['not-implemented', 'implemented-as-planned', 'unexpected-implementation']);
  assert.equal(report.results[1].evidenceIds.includes('syntax-a'), true);
  assert.equal(report.results[2].identityId, 'code:other');
  target.reconciliation = report;
  const rollup = reconciliationRollups(target);
  assert.equal(rollup.workItems.work['implemented-as-planned'], 1);
  assert.equal(rollup.workItems.work['not-implemented'], 1);
  assert.equal(rollup.branches.a['implemented-as-planned'], 1);
  assert.equal(rollup.branches.other['unexpected-implementation'], 1);
  assert.equal(rollup.branches.sys['unexpected-implementation'], 1);
  assert.equal(rollup.map['unexpected-implementation'], 1);
  assert.equal(canCloseOut(target), false);
  assert.equal(reconcilePlanningMap(map([change('edit-a', 'Different')]), fresh(), '2026-10-01').results[0].outcome, 'implemented-differently');
  assert.equal(reconcilePlanningMap(map(), { ...old, basis: { ...basis, physicalGeneration: 2 } }, '2026-10-01').results[0].outcome, 'not-implemented');
  assert.throws(() => reconcilePlanningMap(map(), old, '2026-10-01'), /Fresh/);
});

test('explicit closeout requires reconciled dispositions and matching semantic basis; history retains target and realized evidence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-reconcile-'));
  try {
    const store = new PlanningStore();
    let collection = await store.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Change architecture', basis }, undefined, async () => old);
    collection = await store.mutate(root, collection.revision, { type: 'put-transformation', mapId: 'plan', transformation: change('edit-a', 'Target') });
    collection = await store.mutate(root, collection.revision, { type: 'transition', mapId: 'plan', status: 'active' });
    await assert.rejects(store.mutate(root, collection.revision, { type: 'transition', mapId: 'plan', status: 'completed' }), /illegal transition/);
    await assert.rejects(store.mutate(root, collection.revision, { type: 'closeout', mapId: 'plan', expectedMapRevision: 2 }, undefined, async () => fresh()), /Unresolved/);
    await assert.rejects(store.mutate(root, collection.revision, { type: 'reconcile', mapId: 'plan', expectedMapRevision: 2 }, undefined, async () => old), /Fresh/);
    collection = await store.mutate(root, collection.revision, { type: 'reconcile', mapId: 'plan', expectedMapRevision: 2 }, undefined, async () => fresh());
    await assert.rejects(store.mutate(root, collection.revision, { type: 'closeout', mapId: 'plan', expectedMapRevision: 3 }, undefined, async () => fresh()), /Unresolved/);
    collection = await store.mutate(root, collection.revision, { type: 'disposition', mapId: 'plan', transformationId: 'edit-a', resolution: 'as-planned' });
    await assert.rejects(store.mutate(root, collection.revision, { type: 'closeout', mapId: 'plan', expectedMapRevision: 4 }, undefined,
      async () => ({ ...fresh(), basis: { ...fresh().basis, physicalInputFingerprint: 'changed', physicalGeneration: 3 } })), /Stale reconciliation/);
    collection = await store.mutate(root, collection.revision, { type: 'closeout', mapId: 'plan', expectedMapRevision: 4 }, undefined,
      async () => ({ ...fresh(), basis: { ...fresh().basis, physicalGeneration: 3 } }));
    const closed = (await new PlanningStore().read(root)).maps[0];
    assert.equal(closed.status, 'completed');
    assert.equal(closed.transformations[0].futureNodes[0].name, 'Target');
    assert.equal(closed.reconciliation?.results[0].outcome, 'implemented-as-planned');
    assert.equal(closed.reconciliation?.basis.physicalInputFingerprint, 'new');
    assert.match(closed.history.at(-1)!.action, /closeout/);
    assert.equal(collection.maps[0].status, 'completed');
    collection = await store.mutate(root, collection.revision, { type: 'transition', mapId: 'plan', status: 'archived' });
    assert.equal(collection.maps[0].reconciliation?.results[0].outcome, 'implemented-as-planned');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('accepted divergence, deferral linkage and abandonment remain explicit final dispositions', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-disposition-'));
  try {
    const store = new PlanningStore();
    let c = await store.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Change architecture', basis }, undefined, async () => old);
    c = await store.mutate(root, c.revision, { type: 'put-transformation', mapId: 'plan', transformation: change('edit-a', 'Desired') });
    c = await store.mutate(root, c.revision, { type: 'duplicate', mapId: 'plan', newId: 'later' });
    c = await store.mutate(root, c.revision, { type: 'transition', mapId: 'plan', status: 'active' });
    c = await store.mutate(root, c.revision, { type: 'reconcile', mapId: 'plan', expectedMapRevision: 2 }, undefined, async () => fresh());
    await assert.rejects(store.mutate(root, c.revision, { type: 'disposition', mapId: 'plan', transformationId: 'edit-a', resolution: 'as-planned' }), /Invalid/);
    c = await store.mutate(root, c.revision, { type: 'disposition', mapId: 'plan', transformationId: 'edit-a', resolution: 'accepted-different' });
    assert.equal(canCloseOut(c.maps.find(m => m.id === 'plan')!), true);
    c = await store.mutate(root, c.revision, { type: 'closeout', mapId: 'plan', expectedMapRevision: 4 }, undefined, async () => fresh());
    assert.equal(c.maps.find(m => m.id === 'plan')?.status, 'completed');
    assert.equal(c.maps.find(m => m.id === 'plan')?.transformations[0].futureNodes[0].name, 'Desired');
    assert.equal(c.maps.find(m => m.id === 'plan')?.reconciliation?.results[0].outcome, 'implemented-differently');
    c = await store.mutate(root, c.revision, { type: 'duplicate', mapId: 'later', newId: 'defer-source' });
    c = await store.mutate(root, c.revision, { type: 'transition', mapId: 'defer-source', status: 'active' });
    c = await store.mutate(root, c.revision, { type: 'reconcile', mapId: 'defer-source', expectedMapRevision: 1 }, undefined, async () => fresh());
    await assert.rejects(store.mutate(root, c.revision, { type: 'disposition', mapId: 'defer-source', transformationId: 'edit-a', resolution: 'deferred', deferredToMapId: 'missing' }), /Deferral/);
    c = await store.mutate(root, c.revision, { type: 'disposition', mapId: 'defer-source', transformationId: 'edit-a', resolution: 'deferred', deferredToMapId: 'later' });
    assert.deepEqual(c.maps.find(m => m.id === 'defer-source')?.transformations[0].deferredTo, { mapId: 'later', transformationId: 'edit-a' });
    c = await store.mutate(root, c.revision, { type: 'closeout', mapId: 'defer-source', expectedMapRevision: 3 }, undefined, async () => fresh());
    assert.equal((await new PlanningStore().read(root)).maps.find(m => m.id === 'defer-source')?.status, 'completed');
    await assert.rejects(store.mutate(root, c.revision, { type: 'remove-transformation', mapId: 'later', transformationId: 'edit-a' }), /deferred map linkage/);
    c = await store.mutate(root, c.revision, { type: 'duplicate', mapId: 'later', newId: 'abandon-source' });
    c = await store.mutate(root, c.revision, { type: 'transition', mapId: 'abandon-source', status: 'active' });
    c = await store.mutate(root, c.revision, { type: 'reconcile', mapId: 'abandon-source', expectedMapRevision: 1 }, undefined, async () => fresh());
    c = await store.mutate(root, c.revision, { type: 'disposition', mapId: 'abandon-source', transformationId: 'edit-a', resolution: 'abandoned' });
    c = await store.mutate(root, c.revision, { type: 'closeout', mapId: 'abandon-source', expectedMapRevision: 3 }, undefined, async () => fresh());
    assert.equal(c.maps.find(m => m.id === 'abandon-source')?.transformations[0].resolution, 'abandoned');
    assert.equal(c.maps.find(m => m.id === 'abandon-source')?.transformations[0].deferredTo, undefined);
    assert.throws(() => transitionMap(c.maps.find(m => m.id === 'plan')!, 'completed', '2026-10-01'), /illegal transition/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('backend performs explicit reanalysis and rejects source edits after reconciliation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-reconcile-backend-'));
  try {
    await mkdir(join(root, 'src/a'), { recursive: true });
    await mkdir(join(root, '.dope'));
    await writeFile(join(root, '.dope/architecture.json'), `${JSON.stringify(architecture)}\n`);
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ include: ['src/**/*.ts'] }));
    const source = join(root, 'src/a/a.ts');
    await writeFile(source, 'export const value = 1;\n');
    await acceptInitialization(root, (await readInitialization(root)).declarationFingerprint);
    const index = new SoftwareMapIndex(new TypeScriptAnalyzer());
    await index.analyze(root);
    const backend = new VisualPlanningBackend(new PlanningStore(), index);
    const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
    const initial = index.snapshot(root)!.metadata;
    const initialBasis = { architectureRevision: 0, architectureFingerprint: (await readInitialization(root)).declarationFingerprint,
      physicalInputFingerprint: initial.inputFingerprint, physicalGeneration: initial.generation };
    let c = await backend.mutate({ projectHandle: handle, expectedRevision: 0,
      operation: { type: 'create', id: 'plan', title: 'Plan', objective: 'Change', basis: initialBasis } });
    c = await backend.mutate({ projectHandle: handle, expectedRevision: c.revision,
      operation: { type: 'put-transformation', mapId: 'plan', transformation: change('edit-a', 'Target') } });
    c = await backend.mutate({ projectHandle: handle, expectedRevision: c.revision,
      operation: { type: 'transition', mapId: 'plan', status: 'active' } });
    await writeFile(source, 'export const value = 2;\n');
    c = await backend.mutate({ projectHandle: handle, expectedRevision: c.revision,
      operation: { type: 'reconcile', mapId: 'plan', expectedMapRevision: 2 } });
    assert.equal(c.maps[0].reconciliation?.basis.physicalGeneration, 2);
    assert.notEqual(c.maps[0].reconciliation?.basis.physicalInputFingerprint, initial.inputFingerprint);
    c = await backend.mutate({ projectHandle: handle, expectedRevision: c.revision,
      operation: { type: 'disposition', mapId: 'plan', transformationId: 'edit-a', resolution: 'accepted-different' } });
    await writeFile(source, 'export const value = 3;\n');
    await assert.rejects(backend.mutate({ projectHandle: handle, expectedRevision: c.revision,
      operation: { type: 'closeout', mapId: 'plan', expectedMapRevision: 4 } }), /inputs or generation changed/);
    assert.equal((await backend.read(handle)).maps[0].status, 'active');
    backend.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Planning Map persistence and unchanged reanalysis preserve the semantic basis', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-planning-basis-'));
  try {
    await mkdir(join(root, 'src/a'), { recursive: true });
    await mkdir(join(root, '.dope'));
    await writeFile(join(root, '.dope/architecture.json'), `${JSON.stringify(architecture)}\n`);
    await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ include: ['src/**/*.ts'] }));
    const source = join(root, 'src/a/a.ts'), original = 'export const value = 1;\n';
    await writeFile(source, original);
    await acceptInitialization(root, (await readInitialization(root)).declarationFingerprint);
    const analyzer = new TypeScriptAnalyzer();
    const index = new SoftwareMapIndex(analyzer);
    await index.analyze(root);
    const first = index.snapshot(root)!.metadata;
    const backend = new VisualPlanningBackend(new PlanningStore(), index);
    const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
    const initialBasis = { architectureRevision: 0, architectureFingerprint: (await readInitialization(root)).declarationFingerprint,
      physicalInputFingerprint: first.inputFingerprint, physicalGeneration: first.generation };
    let collection = await backend.mutate({ projectHandle: handle, expectedRevision: 0,
      operation: { type: 'create', id: 'plan', title: 'Plan', objective: 'Change', basis: initialBasis } });
    assert.equal(await index.inputsCurrent(root), true);
    assert.equal(index.snapshot(root)!.metadata.inputFingerprint, first.inputFingerprint);
    for (const name of ['project-mind.json', 'smap-analysis.json']) {
      await writeFile(join(root, '.dope', name), JSON.stringify({ revision: 1 }));
    }
    const marker = join(root, '.dope/smap.json');
    await writeFile(marker, `${JSON.stringify(JSON.parse(await readFile(marker, 'utf8')), null, 2)}\n`);
    assert.equal(await index.inputsCurrent(root), true);
    await index.analyze(root);
    const second = index.snapshot(root)!.metadata;
    assert.ok(second.generation > first.generation);
    assert.equal(second.inputFingerprint, first.inputFingerprint);
    const stale = await backend.staleness(handle, 'plan');
    assert.equal(stale.stale, false);
    assert.equal(stale.physicalChanged, false);
    assert.deepEqual(stale.affectedTransformationIds, []);
    assert.deepEqual(stale.affectedBranchIds, []);
    const change = await backend.preview(handle, 'plan', collection.revision, collection.maps[0].revision,
      { kind: 'add', node: { id: 'new', kind: 'component', parentId: 'a', name: 'New', purpose: 'Change', roots: [] } }, 'add-new');
    collection = await backend.mutate({ projectHandle: handle, expectedRevision: collection.revision,
      operation: { type: 'put-transformation', mapId: 'plan', expectedMapRevision: collection.maps[0].revision,
        expectedBasis: initialBasis, transformation: change } });
    assert.equal(collection.maps[0].transformations.length, 1);
    assert.equal(await index.inputsCurrent(root), true);
    await writeFile(source, 'export const value = 2;\n');
    await index.analyze(root);
    assert.notEqual(index.snapshot(root)!.metadata.inputFingerprint, first.inputFingerprint);
    assert.equal((await backend.staleness(handle, 'plan')).physicalChanged, true);
    await writeFile(source, original);
    await index.analyze(root);
    assert.equal((await backend.staleness(handle, 'plan')).stale, false);
    const changedArchitecture = { ...architecture, systems: [{ ...architecture.systems[0], name: 'Renamed' }] };
    const bytes = `${JSON.stringify(changedArchitecture)}\n`;
    await writeFile(join(root, '.dope/architecture.json'), bytes);
    await writeFile(join(root, '.dope/smap.json'), JSON.stringify({ schemaVersion: 1,
      architectureFingerprint: createHash('sha256').update(bytes).digest('hex') }));
    await index.analyze(root);
    assert.equal((await backend.staleness(handle, 'plan')).architectureChanged, true);
    backend.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});
