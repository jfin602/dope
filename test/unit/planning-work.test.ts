import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { canCloseOut, parsePlanningMap, suggestWorkItems } from '../../packages/visual-planning/lib/index.js';
import { acceptSuggestion, mergeWorkItems, putWorkItem, splitWorkItem } from '../../packages/visual-planning/lib/work.js';
import type { PlanningMap, WorkItem } from '../../packages/visual-planning/src/index.ts';
const require = createRequire(import.meta.url);
const { PlanningMapController } = require('../../packages/theia-extension/lib/browser/planning-map-controller.js') as
  typeof import('../../packages/theia-extension/src/browser/planning-map-controller.ts');
const { affectedArchitecture, transformationsForArchitecture } = require('../../packages/theia-extension/lib/browser/planning-work-projection.js') as
  typeof import('../../packages/theia-extension/src/browser/planning-work-projection.ts');
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
const basis = { architectureRevision: 0, architectureFingerprint: 'arch', physicalInputFingerprint: 'source', physicalGeneration: 1 };
const map = (): PlanningMap => parsePlanningMap({ schemaVersion: 1, id: 'plan', projectId: 'project', title: 'Plan', objective: 'Target',
  status: 'active', revision: 0, history: [], basis, transformations: [
    { id: 'add', kind: 'add', currentIds: [], futureNodes: [{ id: 'new', kind: 'component', parentId: 'sub', name: 'New', purpose: 'Do', roots: [] }], dependsOn: [] },
    { id: 'change', kind: 'modify', currentIds: ['new'], futureNodes: [{ id: 'new', kind: 'component', parentId: 'sub', name: 'Changed', purpose: 'Do', roots: [] }], dependsOn: ['add'] },
    { id: 'other', kind: 'remove', currentIds: ['old'], futureNodes: [], dependsOn: [] }
  ], workItems: [] });
const item = (id: string, refs: string[]): WorkItem => ({ id, title: id, objective: id, transformationIds: refs, dependsOn: [],
  requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: [], status: 'proposed' });

test('suggestions are stable proposals, explicit acceptance and many-to-many references remain separate from architecture truth', () => {
  const original = map(), suggestions = suggestWorkItems(original);
  assert.deepEqual(suggestWorkItems(parsePlanningMap({ ...original, transformations: [...original.transformations].reverse() })), suggestions);
  assert.deepEqual(suggestions.map(s => s.transformationIds), [['add', 'change'], ['other']]);
  assert.equal(original.workItems.length, 0);
  const first = putWorkItem(original, acceptSuggestion(original, suggestions[0], 'one'));
  const second = putWorkItem(first, item('two', ['add', 'other']));
  assert.deepEqual(second.workItems.map(w => w.transformationIds), [['add', 'change'], ['add', 'other']]);
  assert.deepEqual(second.transformations, original.transformations);
  assert.equal(canCloseOut(second), false);
  assert.throws(() => putWorkItem(second, item('bad', ['missing'])), /unknown transformation/);
  assert.throws(() => putWorkItem(second, { ...item('bad', ['add']), workingSet: ['../escape'] }), /workingSet/);
});

test('split preserves references; merge preserves union; dependencies and transitions are checked', () => {
  const initial = putWorkItem(map(), item('one', ['add', 'change']));
  const split = splitWorkItem(initial, 'one', [item('left', ['add']), item('right', ['change'])]);
  assert.deepEqual(split.workItems.map(w => w.id), ['left', 'right']);
  assert.throws(() => splitWorkItem(initial, 'one', [item('left', ['add']), item('right', ['add'])]), /preserve/);
  const dependent = putWorkItem(split, { ...item('later', ['other']), dependsOn: ['left'] });
  assert.throws(() => mergeWorkItems(dependent, ['left', 'right'], item('both', ['add', 'change'])), /dependent/);
  const merged = mergeWorkItems(split, ['left', 'right'], item('both', ['add', 'change']));
  assert.deepEqual(merged.workItems[0].transformationIds, ['add', 'change']);
  assert.throws(() => putWorkItem(merged, { ...merged.workItems[0], status: 'completed', completionNotes: 'Done' }), /Illegal/);
  const ready = putWorkItem(merged, { ...merged.workItems[0], status: 'ready' });
  const doing = putWorkItem(ready, { ...ready.workItems[0], status: 'in-progress' });
  const done = putWorkItem(doing, { ...doing.workItems[0], status: 'completed', completionNotes: 'Implemented' });
  assert.equal(done.workItems[0].status, 'completed');
  assert.equal(canCloseOut(done), false);
});

test('work projection links transformations and architecture in both directions', () => {
  const planning = putWorkItem(map(), item('one', ['add', 'other']));
  assert.deepEqual(affectedArchitecture(planning, planning.workItems[0].transformationIds), ['new', 'old', 'sub']);
  assert.deepEqual(affectedArchitecture(planning, ['add'], [{ id: 'sub', parentId: 'sys' }]), ['new', 'sub', 'sys']);
  assert.deepEqual(transformationsForArchitecture(planning, 'new'), ['add', 'change']);
  assert.deepEqual(transformationsForArchitecture(planning, 'unknown'), []);
});

test('controller shares WorkItem identity across projections and clears it on project switch', async () => {
  const listeners = new Set<() => void>();
  const physical = { workspace: 'file:///A', status: { state: 'ready', generation: 1, inputFingerprint: 'source' },
    initialization: { declarationFingerprint: 'arch' }, onChange(listener: () => void) { listeners.add(listener); return { dispose() { listeners.delete(listener); } }; } };
  let snapshot = { schemaVersion: 1 as const, projectId: 'project', revision: 1, maps: [map()] };
  const service = { async attach() { return { projectHandle: 'handle', snapshot }; }, async read() { return snapshot; },
    async mutate({ operation }: { operation: { type: string; workItem?: WorkItem } }) {
      if (operation.type === 'put-work-item' && operation.workItem) snapshot = { ...snapshot, revision: snapshot.revision + 1,
        maps: [putWorkItem(snapshot.maps[0], operation.workItem)] };
      return snapshot;
    } };
  const controller = new PlanningMapController(physical as never, () => service as never);
  await tick(); controller.requestSuggestions(); assert.equal(controller.selected?.workItems.length, 0);
  await controller.acceptSuggestion(0);
  const selected = controller.selectedWorkItemId;
  assert.ok(selected);
  assert.equal(controller.selectedWorkItem?.id, selected);
  assert.equal(controller.selectedWorkItem?.id, selected); // focused tabs use this same controller
  controller.selectTransformation('add');
  assert.deepEqual(controller.linkedWorkItems.map(item => item.id), [selected]);
  controller.selectWorkItem(selected);
  physical.workspace = 'file:///B'; for (const listener of listeners) listener();
  assert.equal(controller.selectedWorkItemId, undefined);
  assert.equal(controller.selected, undefined);
  controller.dispose();
});

test('split suggestions retain source refs and expose both predecessor dependencies', async () => {
  const listeners = new Set<() => void>();
  const physical = { workspace: 'file:///A', onChange(listener: () => void) { listeners.add(listener); return { dispose() { listeners.delete(listener); } }; } };
  let snapshot = { schemaVersion: 1 as const, projectId: 'project', revision: 1,
    maps: [parsePlanningMap({ ...map(), transformations: map().transformations.map(change =>
      change.id === 'other' ? { ...change, dependsOn: ['change'] } : change) })] };
  const service = { async attach() { return { projectHandle: 'handle', snapshot }; },
    async mutate({ operation }: { operation: { type: string; workItem?: WorkItem } }) {
      if (operation.workItem) snapshot = { ...snapshot, revision: snapshot.revision + 1,
        maps: [putWorkItem(snapshot.maps[0], operation.workItem)] };
      return snapshot;
    } };
  const controller = new PlanningMapController(physical as never, () => service as never);
  await tick(); controller.requestSuggestions();
  controller.splitSuggestion(0, [['add'], ['change']]);
  assert.deepEqual(controller.suggestions?.map(s => s.transformationIds), [['add'], ['change'], ['other']]);
  assert.deepEqual(controller.suggestions?.[2].dependsOn, [0, 1]);
  await controller.acceptSuggestion(2);
  assert.equal(controller.selected?.workItems.length, 0);
  await controller.acceptSuggestion(0); await controller.acceptSuggestion(1); await controller.acceptSuggestion(2);
  assert.equal(controller.selected?.workItems.length, 3);
  assert.equal(controller.selected?.workItems.find(w => w.transformationIds[0] === 'other')?.dependsOn.length, 2);
  controller.dispose();
});
