import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { branchMap, detectActiveConflicts, transitionMap } from '../../packages/visual-planning/lib/index.js';
import type { GraphNode, GraphRelationship } from '../../packages/software-map/src/index.ts';
import type { PlanningMap, PlannedTransformation } from '../../packages/visual-planning/src/index.ts';
import type { PlanningCollection, PlanningOperation, VisualPlanningService } from '../../packages/visual-planning/src/service.ts';
import type { SoftwareMapController } from '../../packages/theia-extension/src/browser/software-map-controller.ts';
const require = createRequire(import.meta.url);
const { PlanningMapController } = require('../../packages/theia-extension/lib/browser/planning-map-controller.js') as
  typeof import('../../packages/theia-extension/src/browser/planning-map-controller.ts');
const { projectPlanningMap } = require('../../packages/theia-extension/lib/browser/planning-map-projection.js') as
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
  const target = projectPlanningMap(nodes, [edge], [], planning, 'target', 'sys');
  const diff = projectPlanningMap(nodes, [edge], [], planning, 'diff', 'sys');
  assert.equal(target.nodes.find(n => n.id === 'a')?.name, 'Renamed');
  assert.match(target.nodes.find(n => n.id === 'b')!.badge, /contract/);
  assert.equal(target.edges.some(e => e.id === 'edge'), true); // physical dependency remains evidence
  assert.match(target.edges.find(e => e.id === 'planned:redirect')!.label, /Planned allowed/);
  assert.equal(diff.edges.find(e => e.id === 'edge')!.label, 'Dependency');
  assert.match(diff.edges.find(e => e.id === 'planned-remove:redirect')!.label, /removal/);
  assert.match(projectPlanningMap(nodes, [edge], [], planning, 'diff', 'a').nodes.find(n => n.id === 'cmp')!.badge, /move/);
  assert.match(projectPlanningMap(nodes, [edge], [], planning, 'target', 'b').nodes.find(n => n.id === 'cmp')!.badge, /move/);
});

function harness() {
  const listeners = new Set<() => void>();
  const physical = { workspace: 'file:///A', status: { state: 'ready', generation: 1, publishedGeneration: 1, inputFingerprint: 'source' },
    initialization: { declarationFingerprint: 'arch' }, onChange(listener: () => void) {
      listeners.add(listener); return { dispose: () => { listeners.delete(listener); } };
    } };
  let collection: PlanningCollection = { schemaVersion: 1, projectId: 'project', revision: 0, maps: [] };
  const service = { async attach() { return { projectHandle: 'handle', snapshot: collection }; },
    async read() { return collection; }, async mutate({ expectedRevision, operation }: { expectedRevision: number; operation: PlanningOperation }) {
      assert.equal(expectedRevision, collection.revision);
      const maps = [...collection.maps];
      if (operation.type === 'create') maps.push(map(operation.id, 'draft', []));
      if (operation.type === 'duplicate') maps.push(branchMap(maps.find(m => m.id === operation.mapId)!, operation.newId, '2026-10-01'));
      if (operation.type === 'transition') {
        const index = maps.findIndex(m => m.id === operation.mapId);
        maps[index] = transitionMap(maps[index], operation.status, '2026-10-01');
      }
      collection = { ...collection, revision: collection.revision + 1, maps };
      return collection;
    } };
  const controller = new PlanningMapController(physical as unknown as SoftwareMapController, () => service as VisualPlanningService);
  return { controller, physical, listeners, service, get collection() { return collection; }, set collection(value: PlanningCollection) { collection = value; } };
}

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
  await h.controller.transition('completed'); // unresolved transformation: domain rule blocks
  assert.equal(h.controller.selected!.status, 'active');
  h.collection = { ...h.collection, maps: h.collection.maps.map(m => m.id === second ? map(second, 'active', []) : m) };
  await h.controller.refresh();
  await h.controller.transition('completed');
  assert.equal(h.controller.visibleMaps.some(m => m.id === second), false);
  h.controller.setHistory(true);
  assert.equal(h.controller.visibleMaps.some(m => m.id === second), true);
  await h.controller.transition('archived');
  assert.equal(h.controller.selected!.status, 'archived');
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
  assert.match(frontend, /context\.container\.get\(PlanningMapController\), options/);
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
