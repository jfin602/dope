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

test('explicit create and field saves use revisions and fresh attachment reads saved metadata', async () => {
    const id = 'c433482f-9576-4402-af45-ef246414c9c0';
    const ws = workspace('file:///A');
    let saved = collection('/A', [], 0);
    const backend = connection('opaque', saved);
    backend.read = () => Promise.resolve(saved);
    backend.mutate = (request: any) => {
        backend.calls.push({ method: 'mutate', request });
        const old = saved.sessions[0];
        const operation = request.operation;
        const made = operation.type === 'create'
            ? { ...session(id, '/A', 1), title: operation.title, objective: operation.objective }
            : { ...old, revision: old.revision + 1,
                [({ rename: 'title', 'set-objective': 'objective', 'set-notes': 'notes',
                    'set-next-actions': 'nextActions' } as any)[operation.type]]:
                    operation.title ?? operation.objective ?? operation.notes ?? operation.nextActions };
        saved = collection('/A', [made], saved.revision + 1);
        return Promise.resolve({ snapshot: saved, session: made });
    };
    const controller = new DeveloperSessionController(() => backend, ws as any, () => {});
    await controller.attach();
    controller.setCreateDraft('title', 'Build parser');
    controller.setCreateDraft('objective', 'Understand syntax');
    assert.equal(backend.calls.filter(call => call.method === 'mutate').length, 0);
    assert.equal(await controller.create(), true);
    assert.equal(controller.selectedId, id);
    controller.setSelectedDraft('title', 'Parser work');
    controller.setSelectedDraft('objective', 'Parse expressions');
    controller.setSelectedDraft('notes', 'Investigate tokens');
    controller.setSelectedDraft('nextActions', ['Read lexer', 'Write tests']);
    assert.equal(await controller.saveSelected('title'), true);
    assert.equal(await controller.saveSelected('objective'), true);
    assert.equal(await controller.saveSelected('notes'), true);
    assert.equal(await controller.saveSelected('nextActions'), true);
    assert.deepEqual(backend.calls.filter(call => call.method === 'mutate').map(call =>
        [call.request.expectedCollectionRevision, call.request.expectedSessionRevision,
            call.request.operation.type]), [[0, null, 'create'], [1, 1, 'rename'],
        [2, 2, 'set-objective'], [3, 3, 'set-notes'], [4, 4, 'set-next-actions']]);
    const fresh = new DeveloperSessionController(() => backend, ws as any, () => {});
    backend.attach = (uri: string) => Promise.resolve({ projectHandle: 'opaque', project: saved.project, snapshot: saved });
    await fresh.attach();
    fresh.select(id);
    assert.equal(fresh.selected?.title, 'Parser work');
    assert.equal(fresh.selected?.objective, 'Parse expressions');
    assert.equal(fresh.selected?.notes, 'Investigate tokens');
    assert.deepEqual(fresh.selected?.nextActions, ['Read lexer', 'Write tests']);
    fresh.dispose(); controller.dispose();
});

test('oversized values never mutate; conflict retains project-scoped drafts and closed Session is read-only', async () => {
    const id = 'c433482f-9576-4402-af45-ef246414c9c0';
    const ws = workspace('file:///A');
    const backend = connection('opaque', collection('/A', [session(id, '/A')]));
    const controller = new DeveloperSessionController(() => backend, ws as any, () => {});
    await controller.attach(); controller.select(id);
    controller.setSelectedDraft('title', 'x'.repeat(161));
    assert.equal(await controller.saveSelected('title'), false);
    assert.match(controller.error, /160/);
    controller.setSelectedDraft('title', 'Draft after conflict');
    controller.setSelectedDraft('objective', 'x'.repeat(4001));
    assert.equal(await controller.saveSelected('objective'), false);
    controller.setSelectedDraft('objective', 'Local objective');
    controller.setSelectedDraft('notes', 'Local notes');
    controller.setSelectedDraft('notes', 'x'.repeat(16001));
    assert.equal(await controller.saveSelected('notes'), false);
    controller.setSelectedDraft('notes', 'Local notes');
    controller.setSelectedDraft('nextActions', ['x'.repeat(1001)]);
    assert.equal(await controller.saveSelected('nextActions'), false);
    backend.mutate = (request: any) => { backend.calls.push({ method: 'mutate', request });
        return Promise.reject(new Error('Revision conflict')); };
    assert.equal(await controller.saveSelected('title'), false);
    assert.match(controller.error, /conflict/i);
    assert.equal(controller.selectedDraft?.title, 'Draft after conflict');
    assert.equal(controller.selectedDraft?.notes, 'Local notes');
    controller.select(undefined); controller.select(id);
    assert.equal(controller.selectedDraft?.title, 'Draft after conflict');
    assert.equal(backend.calls.filter(call => call.method === 'mutate').length, 1);
    backend.read = () => Promise.resolve(collection('/A', [{ ...session(id, '/A', 3), status: 'closed' }], 5));
    await controller.refresh();
    assert.equal(controller.selected?.status, 'closed');
    assert.equal(await controller.saveSelected('notes'), false);
    assert.equal(await controller.mutate({ type: 'rename', sessionId: id, title: 'Nope' }), false);
    assert.equal(backend.calls.filter(call => call.method === 'mutate').length, 1);
    controller.dispose();
});

test('same Session ID in another project cannot inherit an unsaved draft', async () => {
    const id = 'c433482f-9576-4402-af45-ef246414c9c0';
    const ws = workspace('file:///A');
    const backends = [connection('A', collection('/A', [session(id, '/A')])),
        connection('B', collection('/B', [session(id, '/B')]))];
    const controller = new DeveloperSessionController(() => backends.shift()!, ws as any, () => {});
    await controller.attach(); controller.select(id);
    controller.setSelectedDraft('notes', 'Only A');
    ws.change('file:///B');
    await Promise.resolve(); await Promise.resolve();
    controller.select(id);
    assert.equal(controller.selectedDraft?.notes, '');
    assert.equal(controller.selected?.project.canonicalRoot, '/B');
    controller.dispose();
});

test('layout restores only a selected ID after the attached project identity is verified', async () => {
    const id = 'c433482f-9576-4402-af45-ef246414c9c0';
    const ws = workspace('file:///A');
    const backend = connection('A', collection('/A', [session(id, '/A')]));
    const controller = new DeveloperSessionController(() => backend, ws as any, () => {});
    const layout = { workspace: 'file:///A', project: { canonicalRoot: '/A', projectMindId: null }, selectedId: id };
    controller.restoreSelection(layout);
    assert.equal(controller.selectedId, undefined);
    assert.equal(controller.layoutSelection(), undefined);
    await controller.attach();
    assert.equal(controller.selectedId, id);
    assert.deepEqual(controller.layoutSelection(), layout);
    assert.deepEqual(backend.calls.map(call => call.method), ['attach', 'resolve']);
    assert.equal(backend.calls.some(call => call.method === 'mutate'), false);
    controller.dispose();
});

test('layout rejects missing, malformed and other-project selections without owner writes', async () => {
    const id = 'c433482f-9576-4402-af45-ef246414c9c0';
    for (const layout of [
        { workspace: 'file:///B', project: { canonicalRoot: '/A', projectMindId: null }, selectedId: id },
        { workspace: 'file:///A', project: { canonicalRoot: '/B', projectMindId: null }, selectedId: id },
        { workspace: 'file:///A', project: { canonicalRoot: '/A', projectMindId: 'foreign' }, selectedId: id },
        { workspace: 'file:///A', project: { canonicalRoot: '/A', projectMindId: null },
            selectedId: '5852ad1b-6ab5-4632-bb64-9cac4a9469f8' },
        { workspace: 'file:///A', project: { canonicalRoot: '/A', projectMindId: null }, selectedId: '../bad' },
    ]) {
        const backend = connection('A', collection('/A', [session(id, '/A')]));
        const controller = new DeveloperSessionController(() => backend, workspace('file:///A') as any, () => {});
        controller.restoreSelection(layout);
        await controller.attach();
        assert.equal(controller.selectedId, undefined);
        assert.deepEqual(backend.calls.map(call => call.method), ['attach']);
        controller.dispose();
    }
});

test('root switch retires pending layout restoration and late resolution', async () => {
    const id = 'c433482f-9576-4402-af45-ef246414c9c0';
    const ws = workspace('file:///A');
    const a = connection('A', collection('/A', [session(id, '/A')]));
    const b = connection('B', collection('/B', [session(id, '/B')]));
    const waiting = deferred();
    a.attach = () => waiting.promise;
    const backends = [a, b];
    const controller = new DeveloperSessionController(() => backends.shift()!, ws as any, () => {});
    controller.restoreSelection({ workspace: 'file:///A', project: { canonicalRoot: '/A', projectMindId: null }, selectedId: id });
    const first = controller.attach();
    await Promise.resolve();
    ws.change('file:///B');
    waiting.resolve({ projectHandle: 'A', project: collection('/A', []).project,
        snapshot: collection('/A', [session(id, '/A')]) });
    await first;
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(controller.workspace, 'file:///B');
    assert.equal(controller.selectedId, undefined);
    assert.deepEqual(b.calls.map(call => call.method), ['attach']);
    assert.equal(a.disposed, true);
    controller.dispose();
});

test('attachment refuses a backend snapshot for a different project identity', async () => {
    const id = 'c433482f-9576-4402-af45-ef246414c9c0';
    const ws = workspace('file:///A');
    const backend = connection('A', collection('/A', [session(id, '/A')]));
    backend.attach = async () => ({ projectHandle: 'A', project: { canonicalRoot: '/B', projectMindId: null },
        snapshot: collection('/A', [session(id, '/A')]) });
    const controller = new DeveloperSessionController(() => backend, ws as any, () => {});
    controller.restoreSelection({ workspace: 'file:///A', project: { canonicalRoot: '/A', projectMindId: null }, selectedId: id });
    await controller.attach();
    assert.equal(controller.attached, false);
    assert.equal(controller.snapshot, undefined);
    assert.equal(controller.selectedId, undefined);
    assert.match(controller.error, /identity mismatch/);
    controller.dispose();
});
