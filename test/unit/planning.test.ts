import assert from 'node:assert/strict';
import test from 'node:test';
import { applyPlanningOperation, emptyPlanningDocument, parsePlanningDocument, queryPlans, queryTasks } from '../../packages/planning/lib/index.js';
import type { PlanningDocument, PlanningOperation } from '../../packages/contracts/lib/planning.js';

const uuid = (number: number) => `00000000-0000-4000-8000-${number.toString().padStart(12, '0')}`;
const now = '2026-09-28T12:00:00.000Z';
const projectId = uuid(1);
const planId = uuid(2);
const stepId = uuid(3);
const taskId = uuid(4);
let nextId = 20;

function apply(document: PlanningDocument, operation: PlanningOperation) {
    return applyPlanningOperation(document, document.revision, operation, now, uuid(nextId++));
}
const createPlan = (id = planId): PlanningOperation => ({ type: 'plan.create', id, title: 'Plan', objective: '', context: '', links: [] });
const createStep = (id = stepId): PlanningOperation => ({ type: 'step.create', planId, id, title: 'Step', body: '' });
const createTask = (id = taskId): PlanningOperation => ({ type: 'task.create', id, planId, stepId, title: 'Task', objective: '', requirements: [], constraints: [], links: [], workingSet: [] });
function base() { return apply(emptyPlanningDocument(projectId), createPlan()).snapshot; }
function withStep() { return apply(base(), createStep()).snapshot; }
function withTask() { return apply(withStep(), createTask()).snapshot; }

test('strict document schema, UUIDs, duplicate IDs and parent relationships', () => {
    const snapshot = withTask();
    for (const bad of [
        { ...snapshot, schemaVersion: 2 }, { ...snapshot, unexpected: true }, { ...snapshot, revision: -1 },
        { ...snapshot, projectId: 'not-uuid' }, { ...snapshot, plans: [{ ...snapshot.plans[0], extra: 1 }] },
        { ...snapshot, plans: [{ ...snapshot.plans[0], steps: [snapshot.plans[0].steps[0], snapshot.plans[0].steps[0]] }] },
        { ...snapshot, tasks: [{ ...snapshot.tasks[0], stepId: uuid(99) }] },
        { ...snapshot, tasks: [{ ...snapshot.tasks[0], planId: uuid(99) }] },
        { ...snapshot, history: [{ ...snapshot.history[0], actor: 'model' }, ...snapshot.history.slice(1)] },
        { ...snapshot, plans: [{ ...snapshot.plans[0], revision: 99 }] },
        { ...snapshot, history: [{ ...snapshot.history[0], operation: 'task.create' }, ...snapshot.history.slice(1)] },
    ]) assert.throws(() => parsePlanningDocument(bad));
    assert.throws(() => apply(base(), createPlan()));
    assert.throws(() => apply(withStep(), createStep()));
    assert.throws(() => apply(withTask(), createTask()));
    assert.throws(() => apply(base(), { ...createStep(), id: uuid(99), planId: uuid(98) }));
    assert.throws(() => apply(withStep(), { ...createTask(uuid(99)), stepId: uuid(98) }));
});

test('Plan lifecycle accepts only explicit draft/active/completed/reopened/superseded edges', () => {
    const edges = { draft: ['active', 'superseded'], active: ['completed', 'superseded'], completed: ['active'], superseded: [] } as const;
    for (const [from, targets] of Object.entries(edges)) {
        let snapshot = base();
        if (from === 'active' || from === 'completed') snapshot = apply(snapshot, { type: 'plan.transition', planId, status: 'active' }).snapshot;
        if (from === 'completed') snapshot = apply(snapshot, { type: 'plan.transition', planId, status: 'completed' }).snapshot;
        if (from === 'superseded') snapshot = apply(snapshot, { type: 'plan.transition', planId, status: 'superseded' }).snapshot;
        for (const to of Object.keys(edges) as (keyof typeof edges)[]) {
            const operation: PlanningOperation = { type: 'plan.transition', planId, status: to };
            if (targets.includes(to as never)) assert.equal(apply(snapshot, operation).snapshot.plans[0].status, to);
            else assert.throws(() => apply(snapshot, operation), `${from} -> ${to}`);
        }
    }
});

test('Step lifecycle requires a visible reason and clears it when unblocked', () => {
    const edges = { pending: ['active', 'blocked', 'skipped', 'superseded'], active: ['blocked', 'complete', 'skipped', 'superseded'], blocked: ['pending', 'active', 'skipped', 'superseded'], complete: ['active'], skipped: ['pending', 'active'], superseded: [] } as const;
    const paths: Record<keyof typeof edges, (keyof typeof edges)[]> = {
        pending: [], active: ['active'], blocked: ['blocked'], complete: ['active', 'complete'], skipped: ['skipped'], superseded: ['superseded'],
    };
    for (const [from, targets] of Object.entries(edges)) {
        let snapshot = withStep();
        for (const status of paths[from as keyof typeof edges]) snapshot = apply(snapshot, { type: 'step.transition', planId, stepId, status, ...(status === 'blocked' ? { blockedReason: 'Waiting' } : {}) }).snapshot;
        for (const to of Object.keys(edges) as (keyof typeof edges)[]) {
            const operation: PlanningOperation = { type: 'step.transition', planId, stepId, status: to, ...(to === 'blocked' ? { blockedReason: 'Waiting' } : {}) };
            if (targets.includes(to as never)) {
                const child = apply(snapshot, operation).snapshot.plans[0].steps[0];
                assert.equal(child.status, to);
                assert.equal(child.blockedReason, to === 'blocked' ? 'Waiting' : undefined);
            } else assert.throws(() => apply(snapshot, operation), `${from} -> ${to}`);
        }
    }
    assert.throws(() => apply(withStep(), { type: 'step.transition', planId, stepId, status: 'blocked', blockedReason: '  ' }));
    assert.throws(() => apply(withStep(), { type: 'step.transition', planId, stepId, status: 'active', blockedReason: 'stale' }));
});

test('Task lifecycle, fixed parent and explicit edits', () => {
    const edges = { pending: ['active', 'blocked', 'cancelled'], active: ['blocked', 'complete', 'cancelled'], blocked: ['pending', 'active', 'cancelled'], complete: ['active'], cancelled: ['pending'] } as const;
    const paths: Record<keyof typeof edges, (keyof typeof edges)[]> = { pending: [], active: ['active'], blocked: ['blocked'], complete: ['active', 'complete'], cancelled: ['cancelled'] };
    for (const [from, targets] of Object.entries(edges)) {
        let snapshot = withTask();
        for (const status of paths[from as keyof typeof edges]) snapshot = apply(snapshot, { type: 'task.transition', taskId, status }).snapshot;
        for (const to of Object.keys(edges) as (keyof typeof edges)[]) {
            const operation: PlanningOperation = { type: 'task.transition', taskId, status: to };
            if (targets.includes(to as never)) assert.equal(apply(snapshot, operation).snapshot.tasks[0].status, to);
            else assert.throws(() => apply(snapshot, operation), `${from} -> ${to}`);
        }
    }
    const edit: PlanningOperation = { type: 'task.edit', taskId, title: 'Edited', objective: 'Do it', requirements: ['Test'], constraints: [], links: [], workingSet: [], completionNotes: 'Done', validationNotes: 'Manual' };
    const result = apply(withTask(), edit);
    assert.equal(result.snapshot.tasks[0].planId, planId);
    assert.equal(result.snapshot.tasks[0].stepId, stepId);
    assert.equal(result.snapshot.tasks[0].completionNotes, 'Done');
    assert.throws(() => apply(withTask(), { ...edit, planId: uuid(99) } as PlanningOperation));
});

test('reordering preserves IDs and task references; queries are deterministic', () => {
    let snapshot = withStep();
    snapshot = apply(snapshot, { type: 'step.create', planId, id: uuid(5), title: 'Another', body: '' }).snapshot;
    snapshot = apply(snapshot, { type: 'step.create', planId, id: uuid(6), title: 'Third', body: '' }).snapshot;
    snapshot = apply(snapshot, createTask()).snapshot;
    snapshot = apply(snapshot, { type: 'step.reorder', planId, stepId: uuid(6), index: 0 }).snapshot;
    assert.deepEqual(snapshot.plans[0].steps.map(item => item.id), [uuid(6), stepId, uuid(5)]);
    assert.equal(queryTasks(snapshot, planId, stepId)[0].id, taskId);
    assert.throws(() => apply(snapshot, { type: 'step.reorder', planId, stepId, index: 9 }));
    assert.throws(() => apply(snapshot, { type: 'step.reorder', planId, stepId, index: 1 }));
    const second = apply(snapshot, createPlan(uuid(7))).snapshot;
    assert.deepEqual(queryPlans(second).map(item => item.id), [planId, uuid(7)]);
    assert.deepEqual(queryPlans(second).map(item => item.id), queryPlans(second).map(item => item.id));
    assert.throws(() => queryTasks(second, planId, uuid(98)));
});

test('one accepted operation yields one immutable developer history record and revisions', () => {
    const original = emptyPlanningDocument(projectId);
    const first = apply(original, createPlan());
    assert.equal(original.revision, 0);
    assert.equal(first.snapshot.revision, 1);
    assert.equal(first.snapshot.plans[0].revision, 1);
    assert.deepEqual(first.entry, first.snapshot.history[0]);
    const second = apply(first.snapshot, createStep());
    assert.equal(second.snapshot.revision, 2);
    assert.equal(second.snapshot.plans[0].revision, 2);
    assert.deepEqual(second.snapshot.history[0], first.entry);
    assert.deepEqual([second.entry.actor, second.entry.operation, second.entry.planRevision, second.entry.stepId], ['developer', 'step.create', 2, stepId]);
    assert.throws(() => applyPlanningOperation(second.snapshot, 0, createTask(), now, uuid(90)));
    assert.throws(() => applyPlanningOperation(second.snapshot, 2, createTask(), now, second.entry.id));
    assert.equal(second.snapshot.history.length, 2);
    const edited = apply(second.snapshot, { type: 'plan.edit', planId, title: 'Updated', objective: 'Ship', context: 'Context', links: [] });
    assert.equal(edited.snapshot.plans[0].title, 'Updated');
    assert.equal(edited.entry.planRevision, 3);
    const child = apply(edited.snapshot, { type: 'step.edit', planId, stepId, title: 'Revised', body: 'Body' });
    assert.equal(child.snapshot.plans[0].steps[0].body, 'Body');
    assert.equal(child.snapshot.history.length, 4);
    assert.deepEqual(second.snapshot.history, [first.entry, second.entry]);
    assert.throws(() => apply(child.snapshot, { type: 'unknown', planId } as unknown as PlanningOperation));
});

test('links accept artifact IDs and normalized project-relative paths, reject unsafe shapes', () => {
    const artifact = { type: 'artifact' as const, id: uuid(50) };
    const file = { type: 'file' as const, path: 'src/main.ts', line: 1 };
    assert.deepEqual(apply(emptyPlanningDocument(projectId), { ...createPlan(), links: [artifact, file] }).snapshot.plans[0].links, [artifact, file]);
    for (const path of ['/tmp/a', '../x', 'a/../b', './x', 'a//b', 'C:/x', 'https://host/x', 'a\\b', '']) {
        assert.throws(() => apply(emptyPlanningDocument(projectId), { ...createPlan(), links: [{ type: 'file', path }] }), path);
    }
    for (const line of [0, -1, 1.5]) assert.throws(() => apply(emptyPlanningDocument(projectId), { ...createPlan(), links: [{ ...file, line }] }));
    assert.throws(() => apply(withStep(), { ...createTask(), links: [file] } as PlanningOperation));
    assert.throws(() => apply(withStep(), { ...createTask(), workingSet: [artifact] } as PlanningOperation));
});
