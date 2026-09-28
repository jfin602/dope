import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { PlanningController } = require('../../packages/theia-extension/lib/browser/planning-controller.js');
const { openPlanningFile } = require('../../packages/theia-extension/lib/browser/planning-file-navigation.js');
const deferred = () => {
    let resolve: (value: any) => void = () => {};
    let reject: (reason: Error) => void = () => {};
    const promise = new Promise<any>((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
};
const fixture = (name: string, revision = 1) => {
    const now = '2026-09-28T12:00:00.000Z';
    const plan = { id: randomUUID(), title: name, objective: '', context: '', status: 'draft', steps: [{ id: randomUUID(), title: 'Step', body: '', status: 'pending', createdAt: now, updatedAt: now }], revision: 1, provenance: 'developer', createdAt: now, updatedAt: now, links: [] };
    return { schemaVersion: 1, projectId: randomUUID(), revision, plans: [plan], tasks: [{ id: randomUUID(), planId: plan.id, stepId: plan.steps[0].id, title: 'Task', objective: '', requirements: [], constraints: [], status: 'pending', links: [], workingSet: [], createdAt: now, updatedAt: now }], history: [] };
};
const connection = () => {
    const attach = deferred(), mutate = deferred(), read = deferred(), bridge = deferred();
    let listener: any;
    let disposed = false;
    const calls: any[] = [];
    return { attachDeferred: attach, mutateDeferred: mutate, readDeferred: read, bridgeDeferred: bridge, calls,
        setClient(client: any) { listener = client; },
        event(revision: number, handle = 'handle') { listener?.notifyPlanningChanged({ projectHandle: handle, revision }); },
        attach() { return attach.promise; }, read() { return read.promise; },
        mutate(request: any) { calls.push(request); return mutate.promise; },
        createFromDecision(...args: any[]) { calls.push(args); return bridge.promise; },
        dispose() { disposed = true; }, get disposed() { return disposed; }
    };
};

test('dirty Plan, Step and Task drafts block selection, workspace switch and mutation', async () => {
    const peer = connection();
    const controller = new PlanningController(() => peer, () => {});
    const snapshot = fixture('first');
    const attaching = controller.attach('file:///A');
    peer.attachDeferred.resolve({ projectHandle: 'handle', snapshot });
    await attaching;
    const plan = snapshot.plans[0], step = plan.steps[0], task = snapshot.tasks[0];
    for (const [ids, field] of [[[plan.id], 'context'], [[plan.id, step.id], 'body'], [[plan.id, step.id, task.id], 'objective']] as const) {
        assert.equal(controller.select(...ids), true);
        controller.edit(field, 'copyable draft');
        assert.equal(controller.canLeave, false);
        assert.equal(controller.select(), false);
        assert.equal(await controller.attach('file:///B'), false);
        assert.equal(await controller.mutate({ type: 'plan.transition', planId: plan.id, status: 'active' }), false);
        assert.equal((controller.draft?.value as any)[field], 'copyable draft');
        const reload = controller.refresh(true);
        peer.readDeferred.resolve(snapshot);
        assert.equal(await reload, true);
        assert.equal(controller.canLeave, true);
    }
});

test('late A attachment and save cannot render into B; old notifications cannot alter B', async () => {
    const first = connection(), second = connection(), third = connection();
    const peers = [first, second, third];
    const controller = new PlanningController(() => peers.shift()!, () => {});
    const old = controller.attach('file:///A');
    const fresh = controller.attach('file:///B');
    const a = fixture('A'), b = fixture('B');
    first.attachDeferred.resolve({ projectHandle: 'handle', snapshot: a });
    second.attachDeferred.resolve({ projectHandle: 'handle', snapshot: b });
    await Promise.all([old, fresh]);
    assert.equal(controller.projectId, b.projectId);
    second.event(4, 'wrong handle');
    assert.equal(controller.stale, false);
    controller.select(b.plans[0].id);
    controller.edit('title', 'B changed');
    const saving = controller.save();
    assert.equal(controller.pending, true);
    assert.equal(await controller.attach('file:///A'), false);
    const switched = controller.attach('file:///A', true);
    third.attachDeferred.resolve({ projectHandle: 'handle', snapshot: a });
    await switched;
    second.event(2);
    assert.equal(controller.stale, false);
    second.mutateDeferred.resolve({ snapshot: { ...b, revision: 2 }, entry: { planId: b.plans[0].id } });
    assert.equal(await saving, false);
    assert.equal(controller.projectId, a.projectId);
    assert.equal(controller.draft, undefined);
    assert.equal(second.disposed, true);
    controller.dispose();
});

test('notifications preserve dirty text and pending saves; stale failure requires explicit reload', async () => {
    const peer = connection(), controller = new PlanningController(() => peer, () => {}), snapshot = fixture('first');
    const attach = controller.attach('file:///A'); peer.attachDeferred.resolve({ projectHandle: 'handle', snapshot }); await attach;
    controller.select(snapshot.plans[0].id);
    controller.edit('objective', 'my draft');
    peer.event(2);
    assert.equal(controller.stale, true);
    assert.equal(controller.draft?.value.objective, 'my draft');
    assert.equal(await controller.save(), false);
    const refresh = controller.refresh(true);
    peer.readDeferred.resolve({ ...snapshot, revision: 2 });
    assert.equal(await refresh, true);
    controller.edit('objective', 'retry me');
    const save = controller.save();
    peer.event(3);
    peer.mutateDeferred.reject(new Error('Stale Planning revision'));
    assert.equal(await save, false);
    assert.equal(controller.draft?.value.objective, 'retry me');
    assert.match(controller.error, /Stale Planning revision.*Draft retained/);
    controller.dispose();
});

test('Decision bridge allows one pending request and new deliberate creations after acknowledgement', async () => {
    const peer = connection(), controller = new PlanningController(() => peer, () => {}), snapshot = fixture('first');
    const attaching = controller.attach('file:///A'); peer.attachDeferred.resolve({ projectHandle: 'handle', snapshot }); await attaching;
    const decisionId = randomUUID();
    const first = controller.createFromDecision(decisionId);
    assert.equal(await controller.createFromDecision(decisionId), undefined);
    assert.equal(peer.calls.length, 1);
    const planId = peer.calls[0][3];
    peer.bridgeDeferred.resolve({ snapshot: { ...snapshot, revision: 2, plans: [...snapshot.plans, { ...snapshot.plans[0], id: planId }] }, entry: { planId } });
    assert.equal(await first, planId);
    assert.equal(controller.planId, planId);
    const again = controller.createFromDecision(decisionId);
    assert.equal(peer.calls.length, 2);
    peer.bridgeDeferred.resolve({ snapshot: { ...snapshot, revision: 3 }, entry: { planId: peer.calls[1][3] } });
    await again;
    controller.dispose();
});

test('new Plan, Step and Task drafts create rather than overwrite the previous selection', async () => {
    const snapshot = fixture('existing');
    for (const kind of ['plan', 'step', 'task'] as const) {
        const peer = connection(), controller = new PlanningController(() => peer, () => {});
        const attaching = controller.attach('file:///A'); peer.attachDeferred.resolve({ projectHandle: 'handle', snapshot }); await attaching;
        const plan = snapshot.plans[0], step = plan.steps[0], task = snapshot.tasks[0];
        controller.select(plan.id, kind === 'plan' ? undefined : step.id, kind === 'task' ? task.id : undefined);
        assert.equal(controller.create(kind), true);
        controller.edit('title', 'new title');
        const draftId = controller.draft?.value.id;
        const save = controller.save();
        assert.equal(peer.calls[0].operation.type, `${kind}.create`);
        assert.equal(peer.calls[0].operation.id, draftId);
        const updated = structuredClone(snapshot);
        if (kind === 'plan') updated.plans.push({ ...plan, id: draftId, title: 'new title' });
        if (kind === 'step') updated.plans[0].steps.push({ ...step, id: draftId, title: 'new title' });
        if (kind === 'task') updated.tasks.push({ ...task, id: draftId, title: 'new title' });
        updated.revision++;
        peer.mutateDeferred.resolve({ snapshot: updated, entry: {} });
        assert.equal(await save, true);
        assert.equal(controller.draft?.value.id, draftId);
        controller.dispose();
    }
});

test('file navigation checks availability and current project before opening with optional line', async () => {
    const calls: Array<number | undefined> = [];
    const navigate = async (line?: number) => { calls.push(line); };
    let current = true;
    assert.equal(await openPlanningFile({ type: 'file', path: 'src/a.ts', line: 12 }, async () => true, navigate, () => current), true);
    assert.deepEqual(calls, [12]);
    assert.equal(await openPlanningFile({ type: 'file', path: 'missing.ts' }, async () => false, navigate, () => current), false);
    const pending = deferred();
    const late = openPlanningFile({ type: 'file', path: 'old.ts' }, () => pending.promise, navigate, () => current);
    current = false;
    pending.resolve(true);
    assert.equal(await late, false);
    assert.deepEqual(calls, [12]);
});

test('presentation wires ordinary editor links and mode switching without canonical status mutation', () => {
    const widget = readFileSync(new URL('../../packages/theia-extension/src/browser/planning-widget.ts', import.meta.url), 'utf8');
    const workbench = readFileSync(new URL('../../packages/theia-extension/src/browser/dope-workbench.ts', import.meta.url), 'utf8');
    assert.match(widget, /open\(this\.opener, target, line \? \{ selection: \{ start: \{ line: line - 1/);
    assert.match(widget, /this\.files\.exists\(target\)/);
    assert.match(widget, /beforeunload/);
    assert.match(workbench, /mode === WorkspaceMode\.PLAN\) await this\.planningView\.openView/);
    assert.doesNotMatch(workbench.slice(workbench.indexOf('async applyMode')), /\.mutate\(|\.save\(|\.transition\(/);
});
