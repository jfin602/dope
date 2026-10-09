import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { branchMap, canCloseOut, detectActiveConflicts, transitionMap } from '../../packages/visual-planning/lib/index.js';
import type { GraphNode, GraphRelationship } from '../../packages/software-map/src/index.ts';
import type { PlanningMap, PlannedTransformation, RebaseResult, StaleResult } from '../../packages/visual-planning/src/index.ts';
import type { AdoptionAcceptance, AdoptionRequest, PlanningCollection, PlanningOperation, RebaseAcceptance, RebaseRequest, VisualPlanningService } from '../../packages/visual-planning/src/service.ts';
import type { AdoptionPreview } from '../../packages/visual-planning/src/adoption.ts';
import type { SoftwareMapController } from '../../packages/theia-extension/src/browser/software-map-controller.ts';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';
import type { WorkItem } from '../../packages/visual-planning/src/index.ts';
const require = createRequire(import.meta.url);
const { PlanningMapController } = require('../../packages/theia-extension/lib/browser/planning-map-controller.js') as
  typeof import('../../packages/theia-extension/src/browser/planning-map-controller.ts');
const { projectPlanningMap, projectRebaseConflict, projectReconciliationResult } = require('../../packages/theia-extension/lib/browser/planning-map-projection.js') as
  typeof import('../../packages/theia-extension/src/browser/planning-map-projection.ts');
const { physicalMapTabId, physicalMapTabOptions } = require('../../packages/theia-extension/lib/browser/physical-map-controller.js') as
  typeof import('../../packages/theia-extension/src/browser/physical-map-controller.ts');
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const boundary = (id: string, kind: 'system' | 'subsystem' | 'component', parentId?: string): GraphNode =>
  ({ id, kind, name: id, parentId, purpose: '', evidenceIds: [] });
const nodes: GraphNode[] = [boundary('sys', 'system'), boundary('a', 'subsystem', 'sys'),
  boundary('b', 'subsystem', 'sys'), boundary('cmp', 'component', 'a')];
const edge: GraphRelationship = { id: 'edge', kind: 'depends-on', sourceId: 'a', targetId: 'b',
  evidenceIds: ['source'], originRelationshipIds: ['raw'] };
const basis = { architectureRevision: 0, architectureFingerprint: 'arch', physicalInputFingerprint: 'source', physicalGeneration: 1 };
const future = (id: string, kind: 'system' | 'subsystem' | 'component', parentId?: string, name = id) =>
  ({ id, kind, parentId, name, purpose: 'Target', roots: [] });
const changes: PlannedTransformation[] = [
  { id: 'add', kind: 'add', currentIds: [], futureNodes: [future('new', 'subsystem', 'sys')], dependsOn: [] },
  { id: 'modify', kind: 'modify', currentIds: ['a'], futureNodes: [future('a', 'subsystem', 'sys', 'Renamed')], dependsOn: [] },
  { id: 'move', kind: 'move', currentIds: ['cmp'], futureNodes: [future('cmp', 'component', 'b')], dependsOn: [] },
  { id: 'contract', kind: 'change-contract', currentIds: ['b'], futureNodes: [future('b', 'subsystem', 'sys')], dependsOn: [] },
  { id: 'redirect', kind: 'redirect-relationship', currentIds: [], futureNodes: [], dependsOn: [],
    redirect: { from: { sourceId: 'a', targetId: 'b', policy: 'allowed' }, to: { sourceId: 'b', targetId: 'a', policy: 'allowed' } } }
];
const map = (id: string, status: PlanningMap['status'] = 'draft', transformations = changes): PlanningMap =>
  ({ schemaVersion: 1, id, projectId: 'project', title: id, objective: 'Target', status, revision: 0,
    history: [{ revision: 0, action: 'create', at: '2026-10-01' }], basis, transformations, workItems: [] });

 test('Current, Target and Diff preserve reality while labeling every planned meaning', () => {
  const planning = map('one', 'active', [...changes, { id: 'remove', kind: 'remove', currentIds: ['b'], futureNodes: [], dependsOn: [] }]
    .filter(t => t.id !== 'move' && t.id !== 'contract' && t.id !== 'redirect'));
  const current = projectPlanningMap(nodes, [edge], [], planning, 'current');
  const target = projectPlanningMap(nodes, [edge], [], planning, 'target');
  const diff = projectPlanningMap(nodes, [edge], [], planning, 'diff');
  assert.deepEqual(current.nodes.map(n => n.id), ['sys', 'a', 'b']);
  assert.deepEqual(target.nodes.map(n => n.id), ['sys', 'a', 'new']);
  assert.deepEqual(diff.nodes.map(n => n.id), ['sys', 'a', 'new', 'b']);
  assert.equal(diff.nodes.find(n => n.id === 'b')?.intent, 'remove');
  assert.match(diff.nodes.find(n => n.id === 'new')!.badge, /Planned addition/);
  assert.match(diff.nodes.find(n => n.id === 'a')!.badge, /Planned change/);
  assert.equal(current.nodes.some(n => n.intent), false);
});

test('move, contract and relationship states have textual target and diff semantics', () => {
  const planning = map('one');
  const target = projectPlanningMap(nodes, [edge], [], planning, 'target', 'sys', undefined, { selectedId: 'a' });
  const diff = projectPlanningMap(nodes, [edge], [], planning, 'diff', 'sys', undefined, { selectedId: 'a' });
  assert.equal(target.nodes.find(n => n.id === 'a')?.name, 'Renamed');
  assert.match(target.nodes.find(n => n.id === 'b')!.badge, /contract/);
  assert.equal(target.edges.some(e => e.id === 'edge'), true); // physical dependency remains evidence
  assert.match(target.edges.find(e => e.id === 'planned:redirect')!.label, /Planned allowed/);
  assert.equal(diff.edges.find(e => e.id === 'edge')!.label, 'Dependency');
  assert.match(diff.edges.find(e => e.id === 'planned-remove:redirect')!.label, /removal/);
  assert.match(projectPlanningMap(nodes, [edge], [], planning, 'diff', 'a').nodes.find(n => n.id === 'cmp')!.badge, /move/);
  assert.match(projectPlanningMap(nodes, [edge], [], planning, 'target', 'b').nodes.find(n => n.id === 'cmp')!.badge, /move/);
});

test('Planning views share bounded detail and selection without changing target intent', () => {
  const planning = map('detail');
  for (const view of ['current', 'target', 'diff'] as const) {
    const overview = projectPlanningMap(nodes, [edge], [], planning, view, undefined, undefined, { detail: 'overview' });
    assert.deepEqual(overview.nodes.map(node => node.id), ['sys']);
    const selected = projectPlanningMap(nodes, [edge], [], planning, view, 'sys', undefined,
      { detail: 'implementation', selectedId: 'a' });
    assert.equal(selected.edges.some(item => item.id === 'edge'), true);
    assert.equal(selected.nodes.find(node => node.id === 'cmp')?.parentId, view === 'current' ? 'a' : 'b');
    assert.match(selected.nodes.find(node => node.id === 'a')!.badge, view === 'current' ? /Declared only/ : /Planned change/);
  }
});

test('adopted target remains visible without claiming Physical Map realization', () => {
  const planning = map('adopted', 'active', [{ ...changes[0], adopted: true }, changes[1],
    { id: 'remove', kind: 'remove', currentIds: ['b'], futureNodes: [], dependsOn: [], adopted: true }]);
  const target = projectPlanningMap(nodes, [], [], planning, 'target');
  const diff = projectPlanningMap(nodes, [], [], planning, 'diff');
  assert.equal(target.nodes.find(node => node.id === 'new')?.state, 'declared-only');
  assert.match(target.nodes.find(node => node.id === 'new')!.badge, /Adopted target · Physical Map refresh pending/);
  assert.match(target.nodes.find(node => node.id === 'a')!.badge, /Planned change/);
  assert.equal(target.nodes.some(node => node.id === 'b'), false);
  assert.match(diff.nodes.find(node => node.id === 'b')!.badge, /Adopted removal/);
});

function harness(agent?: AgentRuntimeService) {
  const listeners = new Set<() => void>();
  const physical = { workspace: 'file:///A', status: { state: 'ready', generation: 1, publishedGeneration: 1, inputFingerprint: 'source' },
    initialization: { declarationFingerprint: 'arch' }, async attach() {}, onChange(listener: () => void) {
      listeners.add(listener); return { dispose: () => { listeners.delete(listener); } };
    } };
  let collection: PlanningCollection = { schemaVersion: 1, projectId: 'project', revision: 0, maps: [] };
  const service = { async attach() { return { projectHandle: 'handle', snapshot: collection }; },
    async preview() { return changes[0]; },
    async staleness(): Promise<StaleResult> { return { schemaVersion: 1, stale: false, architectureChanged: false, physicalChanged: false,
      affectedTransformationIds: [], affectedBranchIds: [], conflicts: [] }; },
    async previewRebase(_request: RebaseRequest): Promise<RebaseResult> { throw new Error('Not configured'); },
    async acceptRebase(_request: RebaseAcceptance): Promise<PlanningCollection> { throw new Error('Not configured'); },
    async previewAdoption(_request: AdoptionRequest): Promise<AdoptionPreview> { throw new Error('Not configured'); },
    async adoptTarget(_request: AdoptionAcceptance): Promise<PlanningCollection> { throw new Error('Not configured'); },
    async read() { return collection; }, async mutate({ expectedRevision, operation }: { expectedRevision: number; operation: PlanningOperation }) {
      assert.equal(expectedRevision, collection.revision);
      const maps = [...collection.maps];
      if (operation.type === 'create') maps.push(map(operation.id, 'draft', []));
      if (operation.type === 'duplicate') maps.push(branchMap(maps.find(m => m.id === operation.mapId)!, operation.newId, '2026-10-01'));
      if (operation.type === 'transition') {
        const index = maps.findIndex(m => m.id === operation.mapId);
        maps[index] = transitionMap(maps[index], operation.status, '2026-10-01');
      }
      if (operation.type === 'reconcile') {
        const index = maps.findIndex(m => m.id === operation.mapId), current = maps[index];
        maps[index] = { ...current, revision: current.revision + 1, reconciliation: { basis: { ...basis, physicalGeneration: 2 }, at: '2026-10-01',
          results: current.transformations.map(t => ({ schemaVersion: 1, transformationId: t.id, identityId: t.futureNodes[0]?.id ?? t.id,
            outcome: 'implemented-differently' as const, physicalGeneration: 2, evidenceIds: ['source'], explanation: 'Source changed' })) } };
      }
      if (operation.type === 'disposition') {
        const index = maps.findIndex(m => m.id === operation.mapId), current = maps[index];
        maps[index] = { ...current, revision: current.revision + 1, transformations: current.transformations.map(t =>
          t.id === operation.transformationId ? { ...t, resolution: operation.resolution } : t) };
      }
      if (operation.type === 'closeout') {
        const index = maps.findIndex(m => m.id === operation.mapId), current = maps[index];
        assert.equal(canCloseOut(current), true);
        maps[index] = { ...current, status: 'completed', revision: current.revision + 1 };
      }
      collection = { ...collection, revision: collection.revision + 1, maps };
      return collection;
    } };
  const controller = new PlanningMapController(physical as unknown as SoftwareMapController, () => service as VisualPlanningService, agent);
  return { controller, physical, listeners, service, get collection() { return collection; }, set collection(value: PlanningCollection) { collection = value; } };
}

test('Planning Work launch uses revisioned service and blocks human, stale and reserved scope', async () => {
  const launches: unknown[] = [];
  const agent = { async attach() { return { projectHandle: 'agent-handle' }; },
    async listWorkItemTasks() { return []; }, async launchWorkItem(_handle: string, request: unknown) {
      launches.push(request); return { id: 'agent-task' };
    } } as unknown as AgentRuntimeService;
  const h = harness(agent); await tick();
  const work: WorkItem = { id: 'work', title: 'Work', objective: 'Implement', transformationIds: [], dependsOn: [],
    requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: ['src', 'docs'], status: 'ready',
    assignment: 'SHARED', delegablePaths: ['src'], humanReservedPaths: ['docs'] };
  h.collection = { schemaVersion: 1, projectId: 'project', revision: 4,
    maps: [{ ...map('plan', 'active'), revision: 2, workItems: [work] }] };
  await h.controller.refresh();
  h.controller.selectWorkItem('work');
  await tick();
  assert.equal(h.controller.canLaunchWork, true);
  assert.equal(await h.controller.launchWork(), undefined);
  assert.match(h.controller.error, /explicit approval/);
  assert.equal(await h.controller.launchWork('', true), undefined);
  assert.equal(await h.controller.launchWork('npm test', false), undefined);
  assert.equal(await h.controller.launchWork('npm test\nother', true), undefined);
  assert.equal(await h.controller.launchWork('x'.repeat(161), true), undefined);
  assert.equal(launches.length, 0);
  assert.equal(h.controller.selectedWorkItem?.id, 'work');
  assert.equal((await h.controller.launchWork(' npm test ', true))?.id, 'agent-task');
  assert.deepEqual(launches[0], { requestKey: (launches[0] as { requestKey: string }).requestKey,
    expectedProjectRevision: 4, expectedMapRevision: 2, planningMapId: 'plan', workItemId: 'work',
    delegablePaths: ['src'], modelPolicy: { kind: 'follow-coding-agent' }, controls: {},
    completion: { validation: [{ kind: 'test', label: 'Required WorkItem validation', command: 'npm test' }],
      requireValidationPass: true }, validationApproved: true });
  assert.equal(launches.length, 1);
  assert.equal(h.controller.selectedWorkItem?.id, 'work');
  h.collection.maps[0].workItems[0] = { ...work, assignment: 'HUMAN', delegablePaths: [], humanReservedPaths: ['src', 'docs'] };
  assert.equal(h.controller.canLaunchWork, false);
  h.collection.maps[0].workItems[0] = { ...work, delegablePaths: ['src'], humanReservedPaths: ['src'] };
  assert.equal(h.controller.canLaunchWork, false);
  h.collection.maps[0].workItems[0] = work;
  h.controller.stale = { ...h.controller.stale!, stale: true };
  assert.equal(h.controller.canLaunchWork, false);
  assert.equal(await h.controller.launchWork(), undefined);
  assert.equal(launches.length, 1);
  h.controller.dispose();
});

test('Adopt Target requires displayed diff acceptance and clears the preview after commit', async () => {
  const h = harness(); await tick();
  h.collection = { schemaVersion: 1, projectId: 'project', revision: 1, maps: [map('plan', 'active', [changes[0]])] };
  await h.controller.refresh();
  const result: AdoptionPreview = { scope: { kind: 'subsystem', id: 'new' }, selectedTransformationIds: ['add'],
    includedDependentTransformationIds: [], changes: [{ id: 'new', kind: 'subsystem', action: 'add', after: changes[0].futureNodes[0] }], blockers: [] };
  let writes = 0;
  h.service.previewAdoption = async request => { assert.equal(request.expectedRevision, 1); return result; };
  h.service.adoptTarget = async request => {
    writes++;
    assert.deepEqual(request.acceptedChanges, result.changes);
    assert.deepEqual(request.acceptedTransformationIds, ['add']);
    return { ...h.collection, revision: 2, maps: [map('plan', 'active', [{ ...changes[0], adopted: true }])] };
  };
  await h.controller.beginAdoption(result.scope);
  assert.equal(writes, 0);
  assert.deepEqual(h.controller.adoptionPreview?.result, result);
  await h.controller.acceptAdoption();
  assert.equal(writes, 1);
  assert.equal(h.controller.selected?.transformations[0].adopted, true);
  assert.equal(h.controller.adoptionPreview, undefined);
  h.controller.dispose();
});

test('unchanged generation refresh permits editing but rejects a late preview from the prior observation', async () => {
  const h = harness(); await tick();
  h.collection = { schemaVersion: 1, projectId: 'project', revision: 1, maps: [map('plan')] };
  await h.controller.refresh();
  h.physical.status.generation = 2;
  await h.controller.beginEdit({ kind: 'remove', id: 'a' });
  assert.ok(h.controller.preview);
  assert.equal(h.controller.preview?.observationGeneration, 2);
  h.controller.cancelEdit();
  let complete!: (value: typeof changes[0]) => void;
  h.service.preview = () => new Promise(resolve => { complete = resolve; });
  const pending = h.controller.beginEdit({ kind: 'remove', id: 'a' });
  h.physical.status.generation = 3;
  complete(changes[0]);
  await pending;
  assert.equal(h.controller.preview, undefined);
  h.controller.dispose();
});

test('creation, explicit branching, multiple active maps, lifecycle and history filtering', async () => {
  const h = harness(); await tick();
  await h.controller.create('First', 'Change architecture');
  const first = h.controller.selected!.id;
  await h.controller.transition('active');
  await h.controller.duplicate();
  const second = h.controller.selected!.id;
  assert.notEqual(first, second);
  assert.equal(h.controller.selected?.branchedFrom, first);
  await h.controller.transition('active');
  assert.equal(h.controller.visibleMaps.filter(m => m.status === 'active').length, 2);
  h.collection = { ...h.collection, maps: h.collection.maps.map(m => m.id === first ? map(first, 'active', [changes[1]]) : map(second, 'active', [
    { ...changes[1], id: 'other', futureNodes: [future('a', 'subsystem', 'sys', 'Different')] }
  ])) };
  await h.controller.refresh();
  assert.deepEqual(h.controller.conflicts, detectActiveConflicts(h.collection.maps));
  assert.equal(h.controller.conflicts[0].identityId, 'a');
  await h.controller.transition('completed'); // generic transition never completes a map
  assert.equal(h.controller.selected!.status, 'active');
  await h.controller.transition('archived');
  assert.equal(h.collection.maps.find(m => m.id === second)?.status, 'archived');
  h.controller.dispose();
});

test('reconciliation is presented through controller state and closeout is an explicit action', async () => {
  const h = harness(); await tick();
  h.collection = { schemaVersion: 1, projectId: 'project', revision: 1, maps: [map('plan', 'active', [changes[1]])] };
  await h.controller.refresh();
  assert.equal(h.controller.canCloseOut, false);
  await h.controller.reconcile();
  assert.equal(h.controller.selected?.reconciliation?.results[0].outcome, 'implemented-differently');
  await h.controller.closeout();
  assert.equal(h.controller.selected?.status, 'active');
  await h.controller.disposition('modify', 'accepted-different');
  assert.equal(h.controller.canCloseOut, true);
  await h.controller.closeout();
  assert.equal(h.controller.visibleMaps.some(m => m.id === 'plan'), false);
  h.controller.setHistory(true);
  h.controller.select('plan');
  assert.equal(h.controller.selected?.reconciliation?.results[0].evidenceIds[0], 'source');
  assert.match(projectReconciliationResult(h.controller.selected!.reconciliation!.results[0]), /implemented-differently.*Source changed.*source/);
  assert.match(projectReconciliationResult({ schemaVersion: 1, identityId: 'code:extra', outcome: 'unexpected-implementation',
    physicalGeneration: 2, evidenceIds: ['evidence:extra'], explanation: 'Unplanned file' }), /Unexpected.*code:extra.*evidence:extra/);
  const widget = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/physical-map-widget.ts'), 'utf8');
  assert.match(widget, /Analyze and reconcile/);
  assert.match(widget, /Close out Planning Map/);
  assert.match(widget, /projectReconciliationResult/);
  assert.match(widget, /new SingleTextInputDialog\(/);
  assert.doesNotMatch(widget, /window\.prompt\(/);
  h.controller.dispose();
});

test('focused tabs share one selected map and late project responses are ignored', async () => {
  const h = harness(); await tick(); await h.controller.create('First', 'Objective');
  const selected = h.controller.selected;
  const focusA = { focusId: 'a', map: h.controller.selected };
  const focusB = { focusId: 'b', map: h.controller.selected };
  assert.strictEqual(focusA.map, focusB.map);
  assert.strictEqual(selected, h.controller.selected);
  assert.equal(physicalMapTabId(physicalMapTabOptions('file:///A', 'a')),
    physicalMapTabId(physicalMapTabOptions('file:///A', 'a')));
  const frontend = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/frontend-module.ts'), 'utf8');
  assert.match(frontend, /context\.container\.get\(PlanningMapController\), context\.container\.get\(SmapPresentationState\), options/);
  let complete!: (value: { projectHandle: string; snapshot: PlanningCollection }) => void;
  h.service.attach = () => new Promise(resolve => { complete = resolve; });
  h.physical.workspace = 'file:///B'; for (const listener of h.listeners) listener();
  assert.equal(h.controller.selected, undefined);
  complete({ projectHandle: 'old', snapshot: h.collection });
  h.physical.workspace = 'file:///C'; for (const listener of h.listeners) listener();
  await tick();
  assert.equal(h.controller.selected, undefined);
  h.controller.dispose();
});

test('late mutation after workspace switch or disposal cannot restore old planning state', async () => {
  const h = harness(); await tick();
  let complete!: (value: PlanningCollection) => void;
  h.service.mutate = () => new Promise(resolve => { complete = resolve; });
  const pending = h.controller.create('Old', 'Old project');
  h.physical.workspace = 'file:///B'; for (const listener of h.listeners) listener();
  complete({ schemaVersion: 1, projectId: 'old', revision: 1, maps: [map('old')] });
  await pending;
  assert.equal(h.controller.selected, undefined);
  h.controller.dispose();
  assert.equal(h.controller.selected, undefined);
});

test('stale map, branch, transformation and edge markers require an explicit three-way rebase', async () => {
  const h = harness(); await tick();
  const planning = map('plan', 'active', [changes[1], changes[4]]);
  h.collection = { schemaVersion: 1, projectId: 'project', revision: 1, maps: [planning] };
  const conflict = { transformationId: 'redirect', identityId: 'a', reason: 'relationship' as const, evidence: ['Changed edge'] };
  const stale: StaleResult = { schemaVersion: 1, stale: true, architectureChanged: false, physicalChanged: true,
    affectedTransformationIds: ['redirect'], affectedBranchIds: ['sys'], conflicts: [conflict] };
  h.service.staleness = async () => stale;
  await h.controller.refresh(); await tick();
  assert.deepEqual(h.controller.stale, stale);
  const projected = projectPlanningMap(nodes, [edge], [], planning, 'diff', undefined, stale);
  assert.match(projected.nodes.find(n => n.id === 'sys')!.badge, /Stale branch/);
  assert.match(projected.nodes.find(n => n.id === 'a')!.badge, /Conflict/);
  assert.match(projected.edges.find(e => e.id === 'planned:redirect')!.label, /Conflict/);
  const newBasis = { ...basis, physicalInputFingerprint: 'new-source', physicalGeneration: 2 };
  h.physical.status.inputFingerprint = 'new-source'; h.physical.status.generation = 2;
  const reality = { basis: newBasis, architecture: { schemaVersion: 1 as const, systems: [] }, physicalNodes: [], relationships: [] };
  const rebase: RebaseResult = { schemaVersion: 1, oldBasis: basis, currentBasis: newBasis, currentReality: reality,
    conflicts: [conflict], unaffectedTransformationIds: ['modify'] };
  let writes = 0;
  h.service.previewRebase = async request => { assert.equal(request.expectedRevision, 1); return rebase; };
  h.service.acceptRebase = async request => { writes++; assert.equal(request.decisions[0].action, 'keep-target');
    return { ...h.collection, revision: 2, maps: [{ ...planning, revision: 1, basis: newBasis }] }; };
  await h.controller.beginRebase();
  assert.equal(writes, 0);
  assert.equal(h.controller.rebasePreview?.result.oldBasis.physicalGeneration, 1);
  assert.match(projectRebaseConflict(planning, rebase, conflict).target, /redirect-relationship/);
  h.controller.cancelRebase();
  assert.equal(h.controller.stale?.stale, true);
  assert.equal(h.controller.selected?.basis.physicalGeneration, 1);
  await h.controller.beginRebase();
  h.controller.decideRebase({ ...conflict, action: 'keep-target' });
  await h.controller.acceptRebase();
  assert.equal(writes, 1);
  assert.equal(h.controller.selected?.basis.physicalGeneration, 2);
  h.controller.dispose();
});
