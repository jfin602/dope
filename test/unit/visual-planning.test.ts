import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArchitecture } from '../../packages/software-map/lib/index.js';
import {
  branchMap, canCloseOut, detectActiveConflicts, parseCrossMapConflict, parsePlanningMap, parsePlanningMapJson,
  parseRebaseResult, parseReconciliationResult, parseStaleResult, projectTarget,
  suggestWorkItems, transitionMap, validatePlanningReferences,
} from '../../packages/visual-planning/lib/index.js';
import type { PlanningMap, PlannedTransformation } from '../../packages/visual-planning/lib/index.js';

const architecture = parseArchitecture({ schemaVersion: 1, systems: [{ id: 'app', name: 'App', purpose: 'Application', subsystems: [
  { id: 'api', name: 'API', purpose: 'Endpoints', roots: ['src/api'], allowedDependencies: ['core'], components: [{ id: 'routes', name: 'Routes', purpose: 'Handlers', roots: ['src/api/routes'] }] },
  { id: 'core', name: 'Core', purpose: 'Domain', roots: ['src/core'] },
  { id: 'other', name: 'Other', purpose: 'Other', roots: ['src/other'] },
] }] });
const basis = { architectureRevision: 2, architectureFingerprint: 'canonical:2', physicalInputFingerprint: 'physical:2', physicalGeneration: 3 };
function map(transformations: PlannedTransformation[] = []): PlanningMap {
  return parsePlanningMap({ schemaVersion: 1, id: 'plan-a', projectId: 'project', title: 'Target', objective: 'Improve boundaries', status: 'draft', revision: 0,
    history: [], basis, transformations, workItems: [] });
}
const node = (id: string, parentId: string, roots: string[] = []) => ({ id, kind: 'component' as const, parentId, name: id, purpose: id, roots });
const add: PlannedTransformation = { id: 'add-worker', kind: 'add', currentIds: [], futureNodes: [node('worker', 'core', ['src/core/worker'])], dependsOn: [] };
const move: PlannedTransformation = { id: 'move-routes', kind: 'move', currentIds: ['routes'], futureNodes: [node('routes', 'core', ['src/api/routes'])], dependsOn: ['add-worker'] };

test('strict parser rejects future/malformed schema, bad identities, paths, references and cycles', () => {
  const valid = map([add, move]);
  assert.deepEqual(parsePlanningMapJson(JSON.stringify(valid)), valid);
  assert.throws(() => parsePlanningMapJson('{'), /malformed JSON/);
  assert.throws(() => parsePlanningMap({ ...valid, schemaVersion: 2 }), /schemaVersion/);
  assert.throws(() => parsePlanningMap({ ...valid, extra: true }), /root/);
  assert.throws(() => parsePlanningMap({ ...valid, id: '../bad' }), /id/);
  assert.throws(() => parsePlanningMap({ ...valid, transformations: [add, add] }), /duplicate transformation/);
  assert.throws(() => parsePlanningMap({ ...valid, transformations: [{ ...add, futureNodes: [node('worker', 'core', ['../bad'])] }] }), /roots/);
  assert.throws(() => parsePlanningMap({ ...valid, transformations: [{ ...add, dependsOn: ['missing'] }] }), /unknown dependency/);
  assert.throws(() => parsePlanningMap({ ...valid, transformations: [{ ...add, dependsOn: ['move-routes'] }, move] }), /cycle/);
  assert.throws(() => validatePlanningReferences(architecture, map([{ ...move, currentIds: ['missing'], futureNodes: [node('missing', 'core')], dependsOn: [] }])), /unknown current/);
  assert.throws(() => validatePlanningReferences(architecture, map([{ ...add, futureNodes: [node('routes', 'core')] }])), /duplicate future/);
  const plannedChange: PlannedTransformation = { id: 'change-worker', kind: 'modify', currentIds: ['worker'], futureNodes: [node('worker', 'core', ['src/core/worker'])], dependsOn: [] };
  assert.throws(() => validatePlanningReferences(architecture, map([add, plannedChange])), /missing dependency/);
  assert.doesNotThrow(() => validatePlanningReferences(architecture, map([add, { ...plannedChange, dependsOn: ['add-worker'] }])));
  assert.throws(() => parsePlanningMap({ ...valid, workItems: [{ id: 'w', title: 'W', objective: 'Do', transformationIds: ['missing'], dependsOn: [], requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: [], status: 'ready' }] }), /unknown transformation/);
});

test('lifecycle, branch identity and explicit closeout', () => {
  const draft = map([add]);
  assert.throws(() => transitionMap(draft, 'completed', '2026-10-01'), /illegal transition/);
  const active = transitionMap(draft, 'active', '2026-10-01');
  assert.equal(active.revision, 1);
  assert.throws(() => transitionMap(active, 'completed', '2026-10-01'), /illegal transition/);
  const branch = branchMap(active, 'plan-b', '2026-10-01');
  assert.equal(branch.id, 'plan-b'); assert.equal(branch.branchedFrom, 'plan-a'); assert.equal(branch.status, 'draft');
  assert.equal(branch.revision, 0); assert.equal(branch.history[0].action, 'branch:plan-a');
  assert.throws(() => branchMap(active, 'plan-a', '2026-10-01'), /branch identity/);
  const resolved = map([{ ...add, resolution: 'as-planned' }]);
  assert.equal(canCloseOut(resolved), false);
  assert.throws(() => transitionMap(transitionMap(resolved, 'active', '2026-10-01'), 'completed', '2026-10-02'), /illegal transition/);
  assert.equal(transitionMap(active, 'superseded', '2026-10-01').status, 'superseded');
});

test('target projection is deterministic and preserves canonical/physical truth', () => {
  const original = structuredClone(architecture);
  const planning = map([move, add]);
  const target = projectTarget(architecture, planning);
  assert.deepEqual(target.nodes.map(n => n.id), [...target.nodes.map(n => n.id)].sort());
  assert.equal(target.nodes.find(n => n.id === 'routes')?.parentId, 'core');
  assert.equal(target.nodes.find(n => n.id === 'worker')?.parentId, 'core');
  assert.deepEqual(architecture, original);
  assert.equal(architecture.systems[0].subsystems[0].components?.[0].id, 'routes');
  const completeWork = { id: 'work', title: 'Work', objective: 'Implement', transformationIds: ['add-worker'], dependsOn: [], requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: [], status: 'completed' as const, completionNotes: 'Done' };
  const workMap = parsePlanningMap({ ...map([add]), workItems: [completeWork] });
  assert.equal(canCloseOut(workMap), false);
  assert.deepEqual(projectTarget(architecture, workMap).nodes, projectTarget(architecture, map([add])).nodes);
  assert.deepEqual(architecture, original);
});

test('contract and relationship changes project without retaining old edges', () => {
  const api = { id: 'api', kind: 'subsystem' as const, parentId: 'app', name: 'API', purpose: 'Endpoints', roots: ['src/api'], allowedDependencies: ['other'] };
  const changed = map([{ id: 'contract', kind: 'change-contract', currentIds: ['api'], futureNodes: [api], dependsOn: [] }]);
  assert.deepEqual(projectTarget(architecture, changed).relationships, [{ sourceId: 'api', targetId: 'other', policy: 'allowed' }]);
  const redirect = map([{ id: 'edge', kind: 'redirect-relationship', currentIds: [], futureNodes: [], dependsOn: [],
    redirect: { from: { sourceId: 'api', targetId: 'core', policy: 'allowed' }, to: { sourceId: 'api', targetId: 'other', policy: 'allowed' } } }]);
  assert.deepEqual(projectTarget(architecture, redirect).relationships, [{ sourceId: 'api', targetId: 'other', policy: 'allowed' }]);
  assert.deepEqual(projectTarget(architecture, redirect).nodes.find(n => n.id === 'api')?.allowedDependencies, ['other']);
  assert.throws(() => projectTarget(architecture, map([{ ...changed.transformations[0], kind: 'move' }])), /unchanged parent/);
});

test('remove and split project intent; merge rejects a dangling dependency', () => {
  const removed = map([{ id: 'remove-routes', kind: 'remove', currentIds: ['routes'], futureNodes: [], dependsOn: [] }]);
  assert.equal(projectTarget(architecture, removed).nodes.some(n => n.id === 'routes'), false);
  assert.equal(architecture.systems[0].subsystems[0].components?.[0].id, 'routes');
  const part = (id: string) => ({ id, kind: 'subsystem' as const, parentId: 'app', name: id, purpose: id, roots: [`src/${id}`] });
  const split = map([{ id: 'split-other', kind: 'split', currentIds: ['other'], futureNodes: [part('other-a'), part('other-b')], dependsOn: [] }]);
  assert.deepEqual(projectTarget(architecture, split).nodes.filter(n => n.id.startsWith('other')).map(n => n.id), ['other-a', 'other-b']);
  const merge = map([{ id: 'merge-core', kind: 'merge', currentIds: ['core', 'other'], futureNodes: [part('combined')], dependsOn: [] }]);
  assert.throws(() => projectTarget(architecture, merge), /invalid relationship/);
});

test('active incompatible overlap yields stable conflicts and suggestions remain proposals', () => {
  const a = transitionMap(map([add, move]), 'active', '2026-10-01');
  const b = transitionMap(parsePlanningMap({ ...map([{ ...move, futureNodes: [node('routes', 'other', ['src/api/routes'])], dependsOn: [] }]), id: 'plan-b' }), 'active', '2026-10-01');
  assert.deepEqual(detectActiveConflicts([b, a]).map(c => [c.identityId, c.transformationIds]), [['routes', ['move-routes', 'move-routes']]]);
  assert.deepEqual(detectActiveConflicts([a, transitionMap(parsePlanningMap({ ...map([add, move]), id: 'plan-c' }), 'active', '2026-10-01')]), []);
  assert.deepEqual(suggestWorkItems(map([move, add])), [
    { transformationIds: ['add-worker'], dependsOn: [], objective: 'add: worker' },
    { transformationIds: ['move-routes'], dependsOn: [0], objective: 'move: routes' },
  ]);
  const changeRoutes: PlannedTransformation = { id: 'name-routes', kind: 'modify', currentIds: ['routes'], futureNodes: [node('routes', 'core', ['src/api/routes'])], dependsOn: ['move-routes'] };
  assert.deepEqual(suggestWorkItems(map([changeRoutes, add, move])).map(item => [item.transformationIds, item.dependsOn]), [
    [['add-worker'], []], [['move-routes', 'name-routes'], [0]],
  ]);
  const between: PlannedTransformation = { id: 'between', kind: 'add', currentIds: [], futureNodes: [node('unrelated', 'core')], dependsOn: ['add-worker'] };
  const later: PlannedTransformation = { id: 'later', kind: 'modify', currentIds: ['worker'], futureNodes: [node('worker', 'core', ['src/core/worker'])], dependsOn: ['between'] };
  assert.deepEqual(suggestWorkItems(map([later, between, add])).map(item => item.dependsOn), [[], [0], [1]]);
  assert.deepEqual(a.workItems, []);
});

test('versioned conflict, stale, rebase and reconciliation results fail closed', () => {
  const conflict = detectActiveConflicts([
    transitionMap(map([move, add]), 'active', '2026-10-01'),
    transitionMap(parsePlanningMap({ ...map([{ ...move, dependsOn: [], futureNodes: [node('routes', 'other')] }]), id: 'plan-b' }), 'active', '2026-10-01'),
  ])[0];
  assert.deepEqual(parseCrossMapConflict(conflict), conflict);
  assert.throws(() => parseCrossMapConflict({ ...conflict, schemaVersion: 2 }), /schemaVersion/);
  const stale = { schemaVersion: 1, stale: true, architectureChanged: false, physicalChanged: true, affectedTransformationIds: [], affectedBranchIds: [], conflicts: [] };
  assert.deepEqual(parseStaleResult(stale), stale);
  assert.throws(() => parseStaleResult({ ...stale, extra: true }), /stale/);
  const currentReality = { basis: { ...basis, physicalGeneration: 4 }, architecture, physicalNodes: [], relationships: [] };
  const rebase = { schemaVersion: 1, oldBasis: basis, currentBasis: currentReality.basis, currentReality,
    conflicts: [{ transformationId: 'move-routes', identityId: 'routes', reason: 'parent', evidence: ['Parent changed'] }], unaffectedTransformationIds: ['add-worker'] };
  assert.deepEqual(parseRebaseResult(rebase), rebase);
  assert.throws(() => parseRebaseResult({ ...rebase, unaffectedTransformationIds: ['move-routes'] }), /conflicting unaffected/);
  const reconciliation = { schemaVersion: 1, transformationId: 'add-worker', identityId: 'worker', outcome: 'not-implemented', physicalGeneration: 4, evidenceIds: [], explanation: 'No physical source change observed' };
  assert.deepEqual(parseReconciliationResult(reconciliation), reconciliation);
  assert.throws(() => parseReconciliationResult({ ...reconciliation, schemaVersion: 2 }), /schemaVersion/);
  assert.throws(() => parseReconciliationResult({ ...reconciliation, outcome: 'unexpected-implementation' }), /transformationId/);
});
