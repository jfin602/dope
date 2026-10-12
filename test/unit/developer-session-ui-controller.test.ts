import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DeveloperSessionController } = require('../../packages/theia-extension/lib/browser/developer-session-controller.js');

const deferred = () => {
    let resolve!: (value: any) => void;
    let reject!: (error: Error) => void;
    const promise = new Promise<any>((ok, fail) => { resolve = ok; reject = fail; });
    return { promise, resolve, reject };
};
const session = (id: string, root: string, revision = 2) => ({ schemaVersion: 2, id,
    project: { canonicalRoot: root, projectMindId: null }, revision, title: id, objective: '',
    createdAt: '2026-10-11T00:00:00.000Z', updatedAt: '2026-10-11T00:00:00.000Z',
    status: 'active', notes: '', nextActions: [], closeout: null, links: [] });
const collection = (root: string, sessions: any[], revision = 4) => ({ schemaVersion: 2,
    project: { canonicalRoot: root, projectMindId: null }, revision, sessions });

function workspace(initial: string) {
    let root = initial;
    let listener: (() => void) | undefined;
    return {
        get roots() { return Promise.resolve([{ resource: { toString: () => root } }]); },
        onWorkspaceChanged(callback: () => void) { listener = callback; return { dispose() { listener = undefined; } }; },
        change(next: string) { root = next; listener?.(); },
    };
}

function connection(handle: string, snapshot: any) {
    const calls: { method: string; request: any }[] = [];
    let disposed = false;
    return {
        calls,
        get disposed() { return disposed; },
        attach(uri: string) { calls.push({ method: 'attach', request: uri });
            return Promise.resolve({ projectHandle: handle, project: snapshot.project, snapshot }); },
        read(request: string): Promise<any> { calls.push({ method: 'read', request }); return Promise.resolve(snapshot); },
        resolve(request: any): Promise<any> { calls.push({ method: 'resolve', request });
            return Promise.resolve({ sessionId: request.sessionId, collectionRevision: snapshot.revision,
                sessionRevision: snapshot.sessions[0].revision, artifacts: [] }); },
        mutate(request: any): Promise<any> { calls.push({ method: 'mutate', request });
            const next = { ...snapshot, revision: snapshot.revision + 1,
                sessions: snapshot.sessions.map((s: any) => s.id === request.operation.sessionId ?
                    { ...s, revision: s.revision + 1 } : s) };
            snapshot = next;
            return Promise.resolve({ snapshot: next,
                session: next.sessions.find((s: any) => s.id === request.operation.sessionId) }); },
        dispose() { disposed = true; },
    };
}

test('root switch retires A and ignores late attachment and read from A', async () => {
    const idA = 'c433482f-9576-4402-af45-ef246414c9c0';
    const idB = '5852ad1b-6ab5-4632-bb64-9cac4a9469f8';
    const ws = workspace('file:///A');
    const a = connection('A-handle', collection('/A', [session(idA, '/A')]));
    const b = connection('B-handle', collection('/B', [session(idB, '/B')]));
    const c = connection('C-handle', collection('/A', [session(idA, '/A')]));
    const slowAttach = deferred();
    const attachA = a.attach.bind(a);
    a.attach = (uri: string) => { void attachA(uri); return slowAttach.promise; };
    const connections = [a, b, c];
    const controller = new DeveloperSessionController(() => connections.shift(), ws as any, () => {});
    const first = controller.attach();
    await Promise.resolve();
    ws.change('file:///B');
    await Promise.resolve();
    await Promise.resolve();
    slowAttach.resolve({ projectHandle: 'A-handle', project: { canonicalRoot: '/A', projectMindId: null },
        snapshot: collection('/A', [session(idA, '/A')]) });
    await first;
    assert.equal(controller.workspace, 'file:///B');
    assert.deepEqual(controller.snapshot?.sessions.map((s: any) => s.id), [idB]);
    assert.equal(a.disposed, true);
    assert.equal(controller.select(idA), false);
    assert.equal(controller.select(idB), true);

    const slowRead = deferred();
    b.read = (handle: string) => { b.calls.push({ method: 'read', request: handle }); return slowRead.promise; };
    const reading = controller.refresh();
    ws.change('file:///A');
    slowRead.resolve(collection('/B', [session(idB, '/B')], 99));
    assert.equal(await reading, false);
    assert.notEqual(controller.snapshot?.project.canonicalRoot, '/B');
    controller.dispose();
});

test('selection invalidates late resolution and mutation uses exact backend revisions', async () => {
    const id = 'c433482f-9576-4402-af45-ef246414c9c0';
    const other = '5852ad1b-6ab5-4632-bb64-9cac4a9469f8';
    const ws = workspace('file:///A');
    const backend = connection('opaque', collection('/A', [session(id, '/A'), session(other, '/A')]));
    const controller = new DeveloperSessionController(() => backend, ws as any, () => {});
    await controller.attach();
    assert.equal(controller.select(id), true);
    const slowResolve = deferred();
    backend.resolve = (request: any) => { backend.calls.push({ method: 'resolve', request }); return slowResolve.promise; };
    const resolving = controller.resolveSelected();
    assert.equal(controller.select(other), true);
    slowResolve.resolve({ sessionId: id, collectionRevision: 4, sessionRevision: 2, artifacts: [] });
    assert.equal(await resolving, false);
    assert.equal(controller.resolution, undefined);
    assert.deepEqual(backend.calls.map(call => call.method), ['attach', 'resolve']);
    assert.equal(await controller.mutate({ type: 'rename', sessionId: id, title: 'Wrong selection' }), false);
    assert.equal(await controller.mutate({ type: 'rename', sessionId: other, title: 'Renamed' }), true);
    assert.deepEqual(backend.calls.find(call => call.method === 'mutate')?.request, {
        projectHandle: 'opaque', expectedCollectionRevision: 4, expectedSessionRevision: 2,
        operation: { type: 'rename', sessionId: other, title: 'Renamed' },
    });
    assert.equal(controller.revision, 5);
    assert.equal(controller.selectedId, other);
    assert.equal(backend.calls.filter(call => call.method === 'mutate').length, 1);
    controller.dispose();
});

test('selection during a pending mutation drops its result and refreshes canonical revisions', async () => {
    const id = 'c433482f-9576-4402-af45-ef246414c9c0';
    const other = '5852ad1b-6ab5-4632-bb64-9cac4a9469f8';
    const ws = workspace('file:///A');
    const original = collection('/A', [session(id, '/A'), session(other, '/A')]);
    const backend = connection('opaque', original);
    const controller = new DeveloperSessionController(() => backend, ws as any, () => {});
    await controller.attach();
    controller.select(id);
    const slow = deferred();
    backend.mutate = (request: any) => { backend.calls.push({ method: 'mutate', request }); return slow.promise; };
    backend.read = (handle: string) => { backend.calls.push({ method: 'read', request: handle });
        return Promise.resolve(collection('/A', [session(id, '/A', 3), session(other, '/A')], 5)); };
    const mutating = controller.mutate({ type: 'rename', sessionId: id, title: 'Saved' });
    controller.select(other);
    slow.resolve({ snapshot: collection('/A', [session(id, '/A', 3), session(other, '/A')], 5),
        session: session(id, '/A', 3) });
    assert.equal(await mutating, false);
    await Promise.resolve();
    assert.equal(controller.selectedId, other);
    assert.equal(controller.revision, 5);
    assert.equal(controller.pending, false);
    assert.deepEqual(backend.calls.map(call => call.method), ['attach', 'mutate', 'read']);
    controller.dispose();
});

test('create passes a null session revision and occurs only on explicit mutation', async () => {
    const id = 'c433482f-9576-4402-af45-ef246414c9c0';
    const ws = workspace('file:///A');
    const backend = connection('opaque', collection('/A', [], 0));
    const controller = new DeveloperSessionController(() => backend, ws as any, () => {});
    await controller.attach();
    await controller.refresh();
    assert.deepEqual(backend.calls.map(call => call.method), ['attach', 'read']);
    backend.mutate = (request: any) => { backend.calls.push({ method: 'mutate', request });
        const made = session(id, '/A', 1);
        return Promise.resolve({ snapshot: collection('/A', [made], 1), session: made }); };
    assert.equal(await controller.mutate({ type: 'create', title: 'Manual', objective: '' }), true);
    assert.deepEqual(backend.calls[2].request, { projectHandle: 'opaque', expectedCollectionRevision: 0,
        expectedSessionRevision: null, operation: { type: 'create', title: 'Manual', objective: '' } });
    controller.dispose();
});

test('invalid handle is retired; disposal drops late reads and causes no owner writes', async () => {
    const id = 'c433482f-9576-4402-af45-ef246414c9c0';
    const ws = workspace('file:///A');
    const backend = connection('opaque', collection('/A', [session(id, '/A')]));
    const controller = new DeveloperSessionController(() => backend, ws as any, () => {});
    await controller.attach();
    backend.read = (handle: string) => { backend.calls.push({ method: 'read', request: handle });
        return Promise.reject(new Error('Invalid or disposed Development Sessions handle')); };
    assert.equal(await controller.refresh(), false);
    assert.equal(controller.attached, false);
    assert.match(controller.error, /handle/);
    assert.equal(await controller.mutate({ type: 'create', title: 'No write', objective: '' }), false);
    assert.deepEqual(backend.calls.map(call => call.method), ['attach', 'read']);

    const next = connection('next', collection('/A', [session(id, '/A')]));
    const second = new DeveloperSessionController(() => next, ws as any, () => {});
    await second.attach();
    const slow = deferred();
    next.read = () => slow.promise;
    const reading = second.refresh();
    second.dispose();
    slow.resolve(collection('/A', [session(id, '/A')], 100));
    assert.equal(await reading, false);
    assert.equal(second.snapshot, undefined);
    assert.equal(next.disposed, true);
    assert.deepEqual(next.calls.map(call => call.method), ['attach']);
});
