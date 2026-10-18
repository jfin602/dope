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
const fresh = { schemaVersion: 1 as const, stale: false, architectureChanged: false, physicalChanged: false,
  affectedTransformationIds: [], affectedBranchIds: [], conflicts: [] };
const map = (): PlanningMap => parsePlanningMap({ schemaVersion: 1, id: 'plan', projectId: 'project', title: 'Plan', objective: 'Target',
  status: 'active', revision: 0, history: [], basis, transformations: [
    { id: 'add', kind: 'add', currentIds: [], futureNodes: [{ id: 'new', kind: 'component', parentId: 'sub', name: 'New', purpose: 'Do', roots: [] }], dependsOn: [] },
    { id: 'change', kind: 'modify', currentIds: ['new'], futureNodes: [{ id: 'new', kind: 'component', parentId: 'sub', name: 'Changed', purpose: 'Do', roots: [] }], dependsOn: ['add'] },
    { id: 'other', kind: 'remove', currentIds: ['old'], futureNodes: [], dependsOn: [] }
  ], workItems: [] });
const item = (id: string, refs: string[]): WorkItem => ({ id, title: id, objective: id, transformationIds: refs, dependsOn: [],
  requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: [], status: 'proposed' });

test('legacy WorkItems default to human ownership without changing identity, status or basis', () => {
  const original = map();
  const legacy = { ...item('legacy', ['add']), workingSet: ['src/legacy'] };
  const parsed = parsePlanningMap({ ...original, workItems: [legacy] });
  assert.deepEqual(parsed.basis, original.basis);
  assert.equal(parsed.workItems[0].id, 'legacy');
  assert.equal(parsed.workItems[0].status, 'proposed');
  assert.equal(parsed.workItems[0].assignment, 'HUMAN');
  assert.deepEqual(parsed.workItems[0].delegablePaths, []);
  assert.deepEqual(parsed.workItems[0].humanReservedPaths, ['src/legacy']);
  assert.deepEqual(parsePlanningMap(parsed).workItems, parsed.workItems);
  assert.equal(acceptSuggestion(original, suggestWorkItems(original)[0], 'suggested').assignment, 'HUMAN');
});

test('ownership scopes must be bounded, disjoint and consistent with assignment', () => {
  const original = map();
  const scoped = { ...item('scoped', ['add']), workingSet: ['src'], assignment: 'SHARED' as const,
    delegablePaths: ['src/agent'], humanReservedPaths: ['src/human'] };
  const parsed = parsePlanningMap({ ...original, workItems: [scoped] });
  assert.deepEqual(parsed.workItems[0].delegablePaths, ['src/agent']);
  assert.deepEqual(parsePlanningMap({ ...original, workItems: [{ ...scoped, assignment: 'AI', humanReservedPaths: [] }] }).workItems[0].humanReservedPaths, []);
  const rejects = [
    { ...scoped, assignment: 'HUMAN' },
    { ...scoped, assignment: 'AI' },
    { ...scoped, delegablePaths: [] },
    { ...scoped, delegablePaths: ['elsewhere'] },
    { ...scoped, delegablePaths: ['src/human/nested'] },
    { ...scoped, humanReservedPaths: ['src'] },
    { ...scoped, delegablePaths: ['../escape'] },
    { ...scoped, humanReservedPaths: ['/absolute'] }
  ];
  for (const invalid of rejects) assert.throws(() => parsePlanningMap({ ...original, workItems: [invalid] }));
});

test('suggestions are stable proposals, explicit acceptance and many-to-many references remain separate from architecture truth', () => {
  const original = map(), suggestions = suggestWorkItems(original);
  assert.deepEqual(suggestWorkItems(parsePlanningMap({ ...original, transformations: [...original.transformations].reverse() })), suggestions);
  assert.deepEqual(suggestions.map(s => s.transformationIds), [['add', 'change'], ['other']]);
  assert.equal(original.workItems.length, 0);
  const first = putWorkItem(original, acceptSuggestion(original, suggestions[0], 'one'));
  assert.deepEqual(first.workItems[0].acceptanceCriteria, suggestions[0].acceptanceCriteria);
  assert.equal(first.workItems[0].status, 'proposed');
  assert.deepEqual(first.workItems[0].humanReservedPaths, suggestions[0].workingSet);
  assert.throws(() => acceptSuggestion(original, { ...suggestions[0], projectId: 'foreign' }, 'foreign'), /foreign/);
  assert.throws(() => acceptSuggestion(original, { ...suggestions[0], acceptanceCriteria: [] }, 'empty'), /acceptance/);
  assert.throws(() => acceptSuggestion(original, { ...suggestions[0], workingSet: ['foreign/path'] }, 'outside'), /grounded/);
  assert.throws(() => acceptSuggestion(parsePlanningMap({ ...original, transformations: original.transformations.map(t =>
    t.id === 'add' ? { ...t, futureNodes: [{ ...t.futureNodes[0], name: 'Revised' }] } : t) }), suggestions[0], 'stale'), /Stale/);
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
  const predecessor = putWorkItem(map(), item('predecessor', ['other']));
  const withDependency = putWorkItem(predecessor, { ...item('parent', ['add', 'change']), dependsOn: ['predecessor'],
    workingSet: ['src/human'], humanReservedPaths: ['src/human'] });
  assert.throws(() => splitWorkItem(withDependency, 'parent', [item('a', ['add']), item('b', ['change'])]), /predecessor/);
  const preserved = splitWorkItem(withDependency, 'parent', [
    { ...item('a', ['add']), dependsOn: ['predecessor'], workingSet: ['src/human'], humanReservedPaths: ['src/human'] },
    { ...item('b', ['change']), dependsOn: ['predecessor'], workingSet: ['src/human'], humanReservedPaths: ['src/human'] }
  ]);
  assert.throws(() => mergeWorkItems(preserved, ['a', 'b'], { ...item('both', ['add', 'change']), dependsOn: ['predecessor'] }), /human-reserved/);
  assert.throws(() => mergeWorkItems(preserved, ['a', 'b'], { ...item('both', ['add', 'change']), humanReservedPaths: ['src/human'], workingSet: ['src/human'] }), /predecessor/);
  const merged = mergeWorkItems(split, ['left', 'right'], item('both', ['add', 'change']));
  assert.deepEqual(merged.workItems[0].transformationIds, ['add', 'change']);
  assert.throws(() => putWorkItem(merged, { ...merged.workItems[0], status: 'completed', completionNotes: 'Done' }), /Illegal/);
  assert.throws(() => putWorkItem(merged, { ...merged.workItems[0], status: 'ready' }), /acceptance and validation/);
  const ready = putWorkItem(merged, { ...merged.workItems[0], status: 'ready',
    acceptanceCriteria: ['Merged target is implemented'], validationTargets: ['Inspect merged target'] });
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
  const service = { async attach() { return { projectHandle: 'handle', snapshot }; }, async read() { return snapshot; }, async staleness() { return fresh; },
    async mutate({ operation }: { operation: { type: string; workItem?: WorkItem } }) {
      if (operation.type === 'put-work-item' && operation.workItem) snapshot = { ...snapshot, revision: snapshot.revision + 1,
        maps: [putWorkItem(snapshot.maps[0], operation.workItem)] };
      return snapshot;
    } };
  const controller = new PlanningMapController(physical as never, () => service as never);
  await tick(); await controller.refreshStale(); controller.requestSuggestions(); assert.equal(controller.selected?.workItems.length, 0);
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

test('checkpoint handoff only exposes reviewed suggestions and acceptance writes a proposed WorkItem', async () => {
  const physical = { workspace: 'file:///A', status: { state: 'ready', generation: 1, inputFingerprint: 'source' },
    initialization: { declarationFingerprint: 'arch' }, onChange: () => ({ dispose() {} }) };
  let snapshot = { schemaVersion: 1 as const, projectId: 'project', revision: 1, maps: [map()] };
  let approved = false;
  const service = { async attach() { return { projectHandle: 'handle', snapshot }; }, async staleness() { return fresh; },
    async suggestApprovedWorkItems() { if (!approved) throw new Error('Target approval required'); return suggestWorkItems(snapshot.maps[0]); },
    async mutate({ operation }: { operation: { workItem: WorkItem } }) {
      snapshot = { ...snapshot, revision: snapshot.revision + 1, maps: [putWorkItem(snapshot.maps[0], operation.workItem)] };
      return snapshot;
    } };
  const controller = new PlanningMapController(physical as never, () => service as never);
  await tick();
  controller.setPrepareWorkContext({ workspace: 'file:///A', projectId: 'project', checkpointId: 'checkpoint',
    title: 'Checkpoint', objective: 'Target', requirements: [], impactReferences: [], mapId: 'plan' });
  controller.requestSuggestions();
  assert.equal(controller.suggestions, undefined);
  await controller.requestApprovedSuggestions([]);
  assert.match(controller.error, /approval/);
  approved = true;
  await controller.requestApprovedSuggestions([]);
  await controller.refreshStale();
  assert.equal(controller.suggestions?.length, 2);
  assert.equal(snapshot.maps[0].workItems.length, 0);
  await controller.acceptSuggestion(0);
  assert.equal(snapshot.maps[0].workItems[0].status, 'proposed');
  controller.dispose();
});

test('split suggestions retain source refs and expose both predecessor dependencies', async () => {
  const listeners = new Set<() => void>();
  const physical = { workspace: 'file:///A', status: { state: 'ready', generation: 1, inputFingerprint: 'source' },
    initialization: { declarationFingerprint: 'arch' }, onChange(listener: () => void) { listeners.add(listener); return { dispose() { listeners.delete(listener); } }; } };
  let snapshot = { schemaVersion: 1 as const, projectId: 'project', revision: 1,
    maps: [parsePlanningMap({ ...map(), transformations: map().transformations.map(change =>
      change.id === 'other' ? { ...change, dependsOn: ['change'] } : change) })] };
  const service = { async attach() { return { projectHandle: 'handle', snapshot }; }, async staleness() { return fresh; },
    async mutate({ operation }: { operation: { type: string; workItem?: WorkItem } }) {
      if (operation.workItem) snapshot = { ...snapshot, revision: snapshot.revision + 1,
        maps: [putWorkItem(snapshot.maps[0], operation.workItem)] };
      return snapshot;
    } };
  const controller = new PlanningMapController(physical as never, () => service as never);
  await tick(); await controller.refreshStale(); controller.requestSuggestions();
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

test('suggestion review is editable, dependency ordered, rejectable and blocked by stale basis', async () => {
  const physical = { workspace: 'file:///A', status: { state: 'ready', generation: 1, inputFingerprint: 'source' },
    initialization: { declarationFingerprint: 'arch' }, onChange: () => ({ dispose() {} }) };
  let snapshot = { schemaVersion: 1 as const, projectId: 'project', revision: 1, maps: [map()] };
  let writes = 0;
  const service = { async attach() { return { projectHandle: 'handle', snapshot }; }, async read() { return snapshot; },
    async staleness() { return fresh; }, async mutate({ operation }: { operation: { workItem: WorkItem } }) {
      writes++;
      snapshot = { ...snapshot, revision: snapshot.revision + 1, maps: [putWorkItem(snapshot.maps[0], operation.workItem)] };
      return snapshot;
    } };
  const controller = new PlanningMapController(physical as never, () => service as never);
  await tick(); await controller.refreshStale(); controller.requestSuggestions();
  controller.splitSuggestion(0, [['add'], ['change']]);
  assert.equal(controller.canAcceptSuggestion(1), false);
  await controller.acceptSuggestion(1);
  assert.equal(writes, 0);
  assert.match(controller.error, /predecessor/);
  controller.editSuggestion(0, 'Reviewed objective', ['Reviewed acceptance'], ['Reviewed validation']);
  controller.selectSuggestion(0);
  assert.deepEqual(controller.suggestions?.[0].acceptanceCriteria, ['Reviewed acceptance']);
  controller.rejectSuggestion(0);
  assert.match(controller.error, /dependent/);
  controller.stale = { ...fresh, stale: true };
  assert.equal(controller.canAcceptSuggestion(0), false);
  await controller.acceptSuggestion(0);
  assert.equal(writes, 0);
  controller.stale = fresh;
  await controller.acceptSuggestion(0);
  assert.equal(writes, 1);
  assert.equal(snapshot.maps[0].workItems[0].title, 'Reviewed objective');
  assert.equal(snapshot.maps[0].workItems[0].assignment, 'HUMAN');
  assert.equal(controller.canLaunchWork, false);
  controller.stale = { ...fresh, stale: true };
  await controller.putWorkItem({ ...snapshot.maps[0].workItems[0], title: 'Blocked edit' });
  assert.equal(writes, 1);
  assert.match(controller.error, /stale/);
  controller.dispose();
  const restored = new PlanningMapController(physical as never, () => service as never);
  await tick();
  assert.equal(restored.selected?.workItems[0].title, 'Reviewed objective');
  assert.equal(restored.suggestions, undefined);
  restored.dispose();
});
