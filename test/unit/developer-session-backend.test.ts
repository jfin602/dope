import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm, symlink } from 'node:fs/promises';
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
