import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { DeveloperSessionBackend } from '../../packages/theia-extension/lib/node/developer-session-backend.js';
import { DeveloperSessionStore } from '../../packages/theia-extension/lib/node/developer-session-store.js';

const uri = (root: string) => pathToFileURL(root).href;
const create = (projectHandle: string, expectedCollectionRevision: number) => ({
    projectHandle, expectedCollectionRevision, expectedSessionRevision: null,
    operation: { type: 'create' as const, title: 'Manual session', objective: 'Investigate' },
});

test('A/B connections isolate data and handles; same-root reopen retires the old handle', async () => {
    const a = await mkdtemp(join(tmpdir(), 'dope-session-backend-a-'));
    const b = await mkdtemp(join(tmpdir(), 'dope-session-backend-b-'));
    const alias = `${a}-alias`;
    const store = new DeveloperSessionStore();
    const first = new DeveloperSessionBackend(store);
    const second = new DeveloperSessionBackend(store);
    try {
        const attachedA = await first.attach(uri(a));
        assert.equal(attachedA.project.canonicalRoot, a);
        assert.deepEqual(attachedA.snapshot.sessions, []);
        const madeA = await first.mutate(create(attachedA.projectHandle, 0));
        assert.deepEqual(await first.list(attachedA.projectHandle), [madeA.session]);
        assert.deepEqual(await first.get(attachedA.projectHandle, madeA.session.id), madeA.session);
        assert.equal(await first.get(attachedA.projectHandle, 'missing'), undefined);

        const attachedB = await second.attach(uri(b));
        assert.notEqual(attachedA.projectHandle, attachedB.projectHandle);
        assert.deepEqual(await second.list(attachedB.projectHandle), []);
        await assert.rejects(second.read(attachedA.projectHandle), /handle/);
        await assert.rejects(first.mutate(create(attachedB.projectHandle, 1)), /handle/);
        await assert.rejects(first.attach(uri(b)), /different/);
        assert.equal((await first.read(attachedA.projectHandle)).revision, 1);
        assert.deepEqual(await readdir(b), []);

        await symlink(a, alias);
        const reopened = await first.attach(uri(alias));
        assert.equal(reopened.project.canonicalRoot, a);
        assert.notEqual(reopened.projectHandle, attachedA.projectHandle);
        assert.equal(reopened.snapshot.revision, 1);
        await assert.rejects(first.read(attachedA.projectHandle), /handle/);
        assert.equal((await first.get(reopened.projectHandle, madeA.session.id))?.id, madeA.session.id);
        assert.deepEqual(await second.list(attachedB.projectHandle), []);
    } finally {
        first.dispose(); second.dispose();
        await rm(alias, { force: true });
        await rm(a, { recursive: true, force: true });
        await rm(b, { recursive: true, force: true });
    }
});

test('superseded concurrent attach cannot publish a stale project or handle', async () => {
    const a = await mkdtemp(join(tmpdir(), 'dope-session-backend-race-'));
    const b = await mkdtemp(join(tmpdir(), 'dope-session-backend-race-'));
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    class DelayedStore extends DeveloperSessionStore {
        private calls = 0;
        override async root(folderUri: string): Promise<string> {
            if (++this.calls === 1) { entered(); await gate; }
            return super.root(folderUri);
        }
    }
    const backend = new DeveloperSessionBackend(new DelayedStore());
    try {
        const slow = backend.attach(uri(a));
        await started;
        const current = await backend.attach(uri(b));
        release();
        await assert.rejects(slow, /superseded/);
        assert.equal(current.project.canonicalRoot, b);
        assert.equal((await backend.read(current.projectHandle)).revision, 0);
        assert.deepEqual(await readdir(a), []);
    } finally {
        release(); backend.dispose();
        await rm(a, { recursive: true, force: true });
        await rm(b, { recursive: true, force: true });
    }
});

test('dispose rejects attachment and all subsequent calls; mutation errors retain store truth', async () => {
    const a = await mkdtemp(join(tmpdir(), 'dope-session-backend-errors-'));
    const store = new DeveloperSessionStore();
    const backend = new DeveloperSessionBackend(store);
    try {
        const { projectHandle } = await backend.attach(uri(a));
        const made = await backend.mutate(create(projectHandle, 0));
        await assert.rejects(backend.mutate(create(projectHandle, 0)), /Stale/);
        await assert.rejects(backend.mutate({ projectHandle, expectedCollectionRevision: 1,
            expectedSessionRevision: 0, operation: { type: 'rename', sessionId: made.session.id, title: 'Wrong' } }), /Stale/);
        await assert.rejects(backend.mutate({ projectHandle, expectedCollectionRevision: 1,
            expectedSessionRevision: 1, operation: { type: 'pause', sessionId: 'missing' } }), /Unknown/);
        assert.equal((await backend.read(projectHandle)).revision, 1);
        backend.dispose();
        await assert.rejects(backend.attach(uri(a)), /Disposed/);
        await assert.rejects(backend.read(projectHandle), /disposed/);
        await assert.rejects(backend.list(projectHandle), /disposed/);
        await assert.rejects(backend.get(projectHandle, made.session.id), /disposed/);
        await assert.rejects(backend.mutate(create(projectHandle, 1)), /disposed/);
        assert.equal((await store.read(a)).revision, 1);
    } finally {
        backend.dispose();
        await rm(a, { recursive: true, force: true });
    }
});

test('two sessions survive restart beside independent project and unchanged project truth', async () => {
    const a = await mkdtemp(join(tmpdir(), 'dope-session-integration-a-'));
    const b = await mkdtemp(join(tmpdir(), 'dope-session-integration-b-'));
    const copy = await mkdtemp(join(tmpdir(), 'dope-session-integration-copy-'));
    const store = new DeveloperSessionStore();
    const connectionA = new DeveloperSessionBackend(store);
    const concurrentA = new DeveloperSessionBackend(store);
    const connectionB = new DeveloperSessionBackend(store);
    const sentinels = [
        ['chats/conversation.json', 'chat truth'],
        ['planning-maps.json', 'planning truth'],
        ['agent/tasks/task.json', 'task truth'],
        ['agent/runs/run.json', 'run truth'],
        ['project-mind.json', 'mind truth'],
    ] as const;
    try {
        for (const [path, contents] of sentinels) {
            const file = join(a, '.dope', path);
            await mkdir(join(file, '..'), { recursive: true });
            await writeFile(file, contents);
        }
        const attachedA = await connectionA.attach(uri(a));
        const peerA = await concurrentA.attach(uri(a));
        const attachedB = await connectionB.attach(uri(b));
        assert.deepEqual(attachedA.snapshot.sessions, []); // no AI or other store is needed
        const first = await connectionA.mutate(create(attachedA.projectHandle, 0));
        const second = await connectionA.mutate(create(attachedA.projectHandle, 1));
        const onlyB = await connectionB.mutate(create(attachedB.projectHandle, 0));
        assert.notEqual(first.session.id, second.session.id);
        assert.notEqual(first.session.id, onlyB.session.id);

        const attempts = await Promise.allSettled([
            connectionA.mutate({ projectHandle: attachedA.projectHandle, expectedCollectionRevision: 2,
                expectedSessionRevision: first.session.revision,
                operation: { type: 'close', sessionId: first.session.id,
                    closeout: { achieved: 'Manual effort', unresolved: '', deferred: '' } } }),
            concurrentA.mutate({ projectHandle: peerA.projectHandle, expectedCollectionRevision: 2,
                expectedSessionRevision: first.session.revision,
                operation: { type: 'pause', sessionId: first.session.id } }),
        ]);
        assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1);
        assert.match(String((attempts.find(result => result.status === 'rejected') as PromiseRejectedResult).reason), /locked|Stale/);
        let current = await connectionA.read(attachedA.projectHandle);
        if (current.sessions.find(session => session.id === first.session.id)?.status !== 'closed') {
            const session = current.sessions.find(session => session.id === first.session.id)!;
            const resumed = await connectionA.mutate({ projectHandle: attachedA.projectHandle,
                expectedCollectionRevision: current.revision, expectedSessionRevision: session.revision,
                operation: { type: 'resume', sessionId: session.id } });
            current = resumed.snapshot;
            current = (await connectionA.mutate({ projectHandle: attachedA.projectHandle,
                expectedCollectionRevision: current.revision, expectedSessionRevision: resumed.session.revision,
                operation: { type: 'close', sessionId: session.id,
                    closeout: { achieved: 'Manual effort', unresolved: '', deferred: '' } } })).snapshot;
        }
        assert.equal(current.sessions.find(session => session.id === first.session.id)?.status, 'closed');
        assert.equal(current.sessions.find(session => session.id === second.session.id)?.status, 'active');
        for (const [path, contents] of sentinels)
            assert.equal(await readFile(join(a, '.dope', path), 'utf8'), contents);

        connectionA.dispose(); concurrentA.dispose(); connectionB.dispose();
        const restartedA = new DeveloperSessionBackend(new DeveloperSessionStore());
        const restartedB = new DeveloperSessionBackend(new DeveloperSessionStore());
        try {
            const reopenedA = await restartedA.attach(uri(a));
            const reopenedB = await restartedB.attach(uri(b));
            assert.deepEqual(reopenedA.snapshot, current);
            assert.deepEqual(reopenedB.snapshot.sessions, [onlyB.session]);
            await assert.rejects(restartedB.read(reopenedA.projectHandle), /handle/);

            await mkdir(join(copy, '.dope'));
            await copyFile(join(a, '.dope', 'development-sessions.json'), join(copy, '.dope', 'development-sessions.json'));
            const copied = new DeveloperSessionBackend(new DeveloperSessionStore());
            await assert.rejects(copied.attach(uri(copy)), /identity/);
            copied.dispose();

            const bFile = join(b, '.dope', 'development-sessions.json');
            const bBytes = await readFile(bFile);
            await rm(bFile);
            assert.deepEqual((await restartedB.read(reopenedB.projectHandle)).sessions, []);
            assert.deepEqual(await readdir(join(b, '.dope')), []);
            await assert.rejects(restartedB.mutate(create(reopenedB.projectHandle, 1)), /Stale/);
            assert.deepEqual(await readdir(join(b, '.dope')), []);
            await writeFile(bFile, bBytes); // explicit recovery preserves the prior identity and revision
            assert.deepEqual((await restartedB.read(reopenedB.projectHandle)).sessions, [onlyB.session]);
            assert.deepEqual((await restartedA.read(reopenedA.projectHandle)).sessions, current.sessions);
        } finally { restartedA.dispose(); restartedB.dispose(); }
    } finally {
        connectionA.dispose(); concurrentA.dispose(); connectionB.dispose();
        await rm(a, { recursive: true, force: true });
        await rm(b, { recursive: true, force: true });
        await rm(copy, { recursive: true, force: true });
    }
});
