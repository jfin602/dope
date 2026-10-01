import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { acceptRebase, previewRebase, stalePlanningMap } from '../../packages/visual-planning/lib/rebase.js';
import type { PlanningMap, RebaseReality, PlannedTransformation } from '../../packages/visual-planning/src/index.ts';

const basis = { architectureRevision: 0, architectureFingerprint: 'old', physicalInputFingerprint: 'old-source', physicalGeneration: 1 };
const future = (id: string, parentId = 'sys', name = id) => ({ id, kind: 'subsystem' as const, parentId, name, purpose: 'purpose', roots: [`src/${id}`] });
const change = (id: string, source = 'a'): PlannedTransformation =>
  ({ id, kind: 'modify', currentIds: [source], futureNodes: [future(source, 'sys', 'Target')], dependsOn: [] });
const architecture = (a = future('a'), b = future('b')) => ({ schemaVersion: 1 as const, systems: [
  { id: 'sys', name: 'System', purpose: 'purpose', subsystems: [
    { id: a.id, name: a.name, purpose: a.purpose, roots: a.roots, components: [] },
    { id: b.id, name: b.name, purpose: b.purpose, roots: b.roots, components: [] }
  ] }
] });
const physical = (name = 'a') => [
  { id: 'sys', kind: 'system', name: 'System', evidenceIds: ['declaration'] },
  { id: 'a', kind: 'subsystem', parentId: 'sys', name, evidenceIds: ['declaration'] },
  { id: 'b', kind: 'subsystem', parentId: 'sys', name: 'b', evidenceIds: ['declaration'] }
];
const reality = (patch: Partial<RebaseReality> = {}): RebaseReality => ({ basis, architecture: architecture(),
  physicalNodes: physical(), relationships: [], ...patch });
const map = (transformations: PlannedTransformation[], old: RebaseReality = reality()): PlanningMap =>
  ({ schemaVersion: 1, id: 'plan', projectId: 'project', title: 'Plan', objective: 'Objective', status: 'draft', revision: 0,
    history: [{ revision: 0, action: 'create', at: '2026-10-01' }], basis, basisSnapshot: old, transformations, workItems: [] });
const newer = (patch: Partial<RebaseReality> = {}): RebaseReality => reality({ basis: { ...basis, physicalInputFingerprint: 'new-source', physicalGeneration: 2 }, ...patch });

test('unrelated generation advances only global basis, with no affected branch or transformation', () => {
  const target = map([change('edit-a')]);
  const stale = stalePlanningMap(target, newer());
  assert.equal(stale.stale, true);
  assert.deepEqual(stale.affectedTransformationIds, []);
  assert.deepEqual(stale.affectedBranchIds, []);
  assert.deepEqual(previewRebase(target, newer()).unaffectedTransformationIds, ['edit-a']);
});

test('a source edit stales only the owning branch when graph identities stay fixed', () => {
  const code = [
    { id: 'code:a', kind: 'code', name: 'a.ts', parentId: 'a', path: 'src/a.ts', evidenceIds: ['source-a'] },
    { id: 'code:b', kind: 'code', name: 'b.ts', parentId: 'b', path: 'src/b.ts', evidenceIds: ['source-b'] }
  ];
  const old = reality({ physicalNodes: [...physical(), ...code], sourceHashes: { 'src/a.ts': 'a'.repeat(64), 'src/b.ts': 'b'.repeat(64) } });
  const current = newer({ physicalNodes: [...physical(), ...code], sourceHashes: { 'src/a.ts': 'c'.repeat(64), 'src/b.ts': 'b'.repeat(64) } });
  const stale = stalePlanningMap(map([change('edit-a'), change('edit-b', 'b')], old), current);
  assert.deepEqual(stale.affectedTransformationIds, ['edit-a']);
  assert.equal(stale.conflicts[0].reason, 'source-changed');
  assert.ok(stale.conflicts[0].evidence.some(value => value.includes('src/a.ts') && value.includes('source hash changed')));
});

test('removed, replaced, parent, identity, contract and relationship changes are localized with evidence', () => {
  const target = map([change('edit-a'), change('edit-b', 'b')]);
  const missing = newer({ architecture: { schemaVersion: 1, systems: [{ id: 'sys', name: 'System', purpose: 'purpose', subsystems: [architecture().systems[0].subsystems[1]] }] } });
  assert.ok(stalePlanningMap(target, missing).conflicts.some(c => c.transformationId === 'edit-a' && c.reason === 'missing' && c.evidence.length));
  assert.deepEqual(stalePlanningMap(target, missing).affectedBranchIds, ['a', 'sys']);
  const renamed = newer({ architecture: architecture(future('a', 'sys', 'Renamed')) });
  assert.ok(stalePlanningMap(target, renamed).conflicts.some(c => c.transformationId === 'edit-a' && c.reason === 'identity'));
  assert.equal(stalePlanningMap(target, renamed).affectedTransformationIds.includes('edit-b'), false);
  const replaced = newer({ architecture: { schemaVersion: 1, systems: [{ id: 'sys', name: 'System', purpose: 'purpose', subsystems: [
    { ...architecture().systems[0].subsystems[1], components: [{ id: 'a', name: 'a', purpose: 'purpose', roots: ['src/a'] }] }
  ] }] } });
  assert.ok(stalePlanningMap(target, replaced).conflicts.some(c => c.transformationId === 'edit-a' && c.reason === 'identity'));
  const moved = newer({ architecture: { schemaVersion: 1, systems: [{ id: 'other', name: 'Other', purpose: 'purpose', subsystems: [
    architecture().systems[0].subsystems[0]] }, { id: 'sys', name: 'System', purpose: 'purpose', subsystems: [architecture().systems[0].subsystems[1]] }] } });
  assert.ok(stalePlanningMap(target, moved).conflicts.some(c => c.reason === 'parent'));
  const contracted = newer({ architecture: architecture({ ...future('a'), purpose: 'new contract' }) });
  assert.ok(stalePlanningMap(target, contracted).conflicts.some(c => c.reason === 'contract'));
  const old = reality({ relationships: [{ kind: 'depends-on', sourceId: 'a', targetId: 'b', evidenceIds: ['old-edge'] }] });
  const changed = newer({ relationships: [{ kind: 'depends-on', sourceId: 'a', targetId: 'b', evidenceIds: ['new-edge'] }] });
  assert.ok(stalePlanningMap(map([change('edit-a')], old), changed).conflicts.some(c => c.reason === 'relationship'));
});

test('already realized and differently realized remain distinct, while missing old graph is unresolved', () => {
  const target = map([change('edit-a')]);
  const realized = newer({ physicalNodes: physical('Target') });
  assert.deepEqual(previewRebase(target, realized).conflicts.map(c => c.reason), ['already-realized']);
  const divergent = newer({ physicalNodes: physical('Unexpected') });
  assert.ok(previewRebase(target, divergent).conflicts.some(c => c.reason === 'realized-differently'));
  assert.deepEqual(previewRebase({ ...target, basisSnapshot: undefined }, divergent).conflicts.map(c => c.reason), ['unresolved']);
});

test('cancel retains old basis; acceptance changes basis, revision and history only after every conflict is resolved', () => {
  const target = map([change('edit-a')]), current = newer({ physicalNodes: physical('Unexpected') });
  const preview = previewRebase(target, current), conflict = preview.conflicts[0];
  assert.equal(target.basis.physicalGeneration, 1); // cancellation is simply no mutation
  assert.throws(() => acceptRebase(target, preview, [], '2026-10-01'), /Unresolved/);
  const accepted = acceptRebase(target, preview, [{ ...conflict, action: 'keep-target' }], '2026-10-01');
  assert.equal(accepted.basis.physicalGeneration, 2);
  assert.equal(accepted.revision, 1);
  assert.match(accepted.history.at(-1)!.action, /rebase:/);
  assert.equal(accepted.transformations[0].futureNodes[0].name, 'Target');
  assert.equal(target.basis.physicalGeneration, 1);
  const different = acceptRebase(target, preview, [{ ...conflict, action: 'accept-different' }], '2026-10-01');
  assert.equal(different.transformations[0].resolution, 'accepted-different');
});

test('removed reference requires an explicit same-kind replacement, preserving target intent', () => {
  const target = map([change('edit-a')]);
  const current = newer({ architecture: architecture(future('c')), physicalNodes: [physical()[0],
    { id: 'c', kind: 'subsystem', parentId: 'sys', name: 'c', evidenceIds: ['declaration'] }, physical()[2]] });
  const preview = previewRebase(target, current), missing = preview.conflicts.find(c => c.reason === 'missing')!;
  assert.throws(() => acceptRebase(target, preview, preview.conflicts.map(c => ({ ...c, action: 'keep-target' as const })), '2026-10-01'), /replacement/);
  const choices = preview.conflicts.map(c => c === missing ? { ...c, action: 'replace-reference' as const, replacementId: 'c' } :
    { ...c, action: 'keep-target' as const });
  const accepted = acceptRebase(target, preview, choices, '2026-10-01');
  assert.deepEqual(accepted.transformations[0].currentIds, ['c']);
  assert.equal(accepted.transformations[0].futureNodes[0].id, 'c');
  assert.equal(accepted.transformations[0].futureNodes[0].name, 'Target');
});

test('store rebase rejects stale expected revision and invalid decisions without partial write', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-rebase-'));
  try {
    const store = new PlanningStore(), original = reality();
    const created = await store.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Objective', basis }, undefined, async () => original);
    const updated = await store.mutate(root, created.revision, { type: 'put-transformation', mapId: 'plan', transformation: change('edit-a') });
    const current = newer({ physicalNodes: physical('Unexpected') });
    const entry = updated.maps[0], request = { mapId: entry.id, projectHandle: 'handle', expectedRevision: updated.revision,
      expectedMapRevision: entry.revision, expectedBasis: entry.basis, expectedCurrentBasis: current.basis };
    await assert.rejects(store.rebase(root, { ...request, expectedRevision: 1, decisions: [] }, async () => current), /Stale/);
    await assert.rejects(store.rebase(root, { ...request, decisions: [] }, async () => current), /Unresolved/);
    await assert.rejects(store.rebase(root, { ...request, expectedCurrentBasis: basis, decisions: [] }, async () => current), /basis changed/);
    assert.deepEqual(await store.read(root), updated);
    const conflict = previewRebase(entry, current).conflicts[0];
    const committed = await store.rebase(root, { ...request, decisions: [{ ...conflict, action: 'keep-target' }] }, async () => current);
    assert.equal(committed.revision, updated.revision + 1);
    assert.equal((await store.read(root)).maps[0].basis.physicalGeneration, 2);
  } finally { await rm(root, { recursive: true, force: true }); }
});
