import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { DeveloperSessionStore } from '../../packages/theia-extension/lib/node/developer-session-store.js';
import type { SessionCollection } from '../../packages/contracts/lib/developer-session.js';
import type { SessionOperation } from '../../packages/contracts/lib/developer-session-service.js';

async function project() {
    const root = await mkdtemp(join(tmpdir(), 'dope-session-store-'));
    return { root, clean: () => rm(root, { recursive: true, force: true }) };
}

function addSession(current: SessionCollection): SessionCollection {
    const now = '2026-10-10T12:00:00.000Z';
    return { ...current, revision: current.revision + 1, sessions: [...current.sessions, {
        schemaVersion: 1, id: randomUUID(), project: current.project, revision: 1,
        title: 'Manual effort', objective: '', createdAt: now, updatedAt: now,
        status: 'active', notes: '', nextActions: [], closeout: null,
    }] };
}

test('missing read is side effect free; transaction is atomic, bound and does not touch sibling stores', async () => {
    const p = await project();
    try {
        const store = new DeveloperSessionStore();
        assert.equal(await store.root(pathToFileURL(p.root).href), p.root);
        await assert.rejects(store.root(`${pathToFileURL(p.root).href}/../other`), /Unsafe/);
        const empty = await store.read(p.root);
        assert.deepEqual(empty, { schemaVersion: 1, project: { canonicalRoot: p.root, projectMindId: null }, revision: 0, sessions: [] });
        assert.deepEqual(await readdir(p.root), []);
        await mkdir(join(p.root, '.dope'));
        await writeFile(join(p.root, '.dope', 'planning-maps.json'), 'planning sentinel');
        await writeFile(join(p.root, '.dope', 'project-mind.json'), 'mind sentinel');
        const saved = await store.transact(p.root, null, 0, addSession);
        assert.equal(saved.revision, 1);
        assert.equal(saved.sessions.length, 1);
        assert.deepEqual(await store.read(p.root), saved);
        assert.deepEqual(JSON.parse(await readFile(join(p.root, '.dope', 'development-sessions.json'), 'utf8')), saved);
        assert.deepEqual((await readdir(join(p.root, '.dope'))).sort(),
            ['development-sessions.json', 'planning-maps.json', 'project-mind.json']);
        assert.equal(await readFile(join(p.root, '.dope', 'planning-maps.json'), 'utf8'), 'planning sentinel');
        assert.equal(await readFile(join(p.root, '.dope', 'project-mind.json'), 'utf8'), 'mind sentinel');
        await assert.rejects(store.transact(p.root, null, 0, addSession), /Stale/);
        assert.deepEqual(await store.read(p.root), saved);
        await assert.rejects(store.read(p.root, 'different-project'), /identity/);
    } finally { await p.clean(); }
});

test('an active exclusive lock blocks a second writer', async () => {
    const p = await project();
    try {
        const store = new DeveloperSessionStore();
        let entered!: () => void;
        let release!: () => void;
        const started = new Promise<void>(resolve => { entered = resolve; });
        const gate = new Promise<void>(resolve => { release = resolve; });
        const first = store.transact(p.root, null, 0, async current => {
            entered();
            await gate;
            return addSession(current);
        });
        await started;
        try { await assert.rejects(store.transact(p.root, null, 0, addSession), /locked/); }
        finally { release(); }
        assert.equal((await first).revision, 1);
        assert.equal((await store.read(p.root)).revision, 1);
    } finally { await p.clean(); }
});

test('corrupt and oversize documents fail closed without repair', async () => {
    const p = await project();
    try {
        const store = new DeveloperSessionStore();
        await mkdir(join(p.root, '.dope'));
        const file = join(p.root, '.dope', 'development-sessions.json');
        for (const bytes of ['{', '{}', 'x'.repeat(16 * 1024 * 1024 + 1)]) {
            await writeFile(file, bytes);
            await assert.rejects(store.read(p.root), /Corrupt|Oversize/);
            await assert.rejects(store.transact(p.root, null, 0, addSession), /Corrupt|Oversize/);
            assert.equal(await readFile(file, 'utf8'), bytes);
        }
        await writeFile(file, Buffer.from([0x7b, 0x22, 0xff, 0x22, 0x7d]));
        await assert.rejects(store.read(p.root), /Corrupt/);
    } finally { await p.clean(); }
});

test('unsafe root, directory, store and lock are rejected', async () => {
    const p = await project();
    const outside = await project();
    try {
        const store = new DeveloperSessionStore();
        await assert.rejects(store.read(join(p.root, '..', 'elsewhere')), /canonical|ENOENT/);
        await assert.rejects(store.read(join(p.root, 'missing')), /ENOENT/);
        await assert.rejects(store.root('https://example.com/project'), /local|Unsafe/);
        await symlink(outside.root, join(p.root, '.dope'));
        await assert.rejects(store.read(p.root), /Unsafe/);
        await assert.rejects(store.transact(p.root, null, 0, addSession), /Unsafe/);
        await rm(join(p.root, '.dope'));
        await mkdir(join(p.root, '.dope'));
        const target = join(outside.root, 'target');
        await writeFile(target, '{}');
        const file = join(p.root, '.dope', 'development-sessions.json');
        const lock = join(p.root, '.dope', 'development-sessions.lock');
        await symlink(target, file);
        await assert.rejects(store.read(p.root), /Unsafe/);
        await assert.rejects(store.transact(p.root, null, 0, addSession), /Unsafe/);
        await rm(file);
        await mkdir(file);
        await assert.rejects(store.read(p.root), /Unsafe/);
        await rm(file, { recursive: true });
        await symlink(target, lock);
        await assert.rejects(store.read(p.root), /Unsafe/);
        await assert.rejects(store.transact(p.root, null, 0, addSession), /Unsafe/);
        assert.equal(await readFile(target, 'utf8'), '{}');
    } finally { await p.clean(); await outside.clean(); }
});

test('copied store cannot silently rebind to another project root', async () => {
    const source = await project();
    const copy = await project();
    try {
        const store = new DeveloperSessionStore();
        await store.transact(source.root, null, 0, addSession);
        await mkdir(join(copy.root, '.dope'));
        await copyFile(join(source.root, '.dope', 'development-sessions.json'),
            join(copy.root, '.dope', 'development-sessions.json'));
        await assert.rejects(store.read(copy.root), /identity/);
        await assert.rejects(store.transact(copy.root, null, 1, addSession), /identity/);
        assert.equal((await readdir(join(copy.root, '.dope'))).length, 1);
    } finally { await source.clean(); await copy.clean(); }
});

test('lifecycle edits are revision checked, transition safe and confined to session storage', async () => {
    const p = await project();
    try {
        const store = new DeveloperSessionStore();
        await mkdir(join(p.root, '.dope'));
        for (const name of ['chats.json', 'planning-maps.json', 'agent.json', 'project-mind.json'])
            await writeFile(join(p.root, '.dope', name), `${name} sentinel`);
        let collectionRevision = 0;
        const edit = async (operation: SessionOperation, sessionRevision: number | null) => {
            const result = await store.mutate(p.root, null, {
                projectHandle: 'unused-until-P4', expectedCollectionRevision: collectionRevision,
                expectedSessionRevision: sessionRevision, operation,
            });
            collectionRevision = result.snapshot.revision;
            return result.session;
        };
        const first = await edit({ type: 'create', title: 'First', objective: 'Build feature' }, null);
        const second = await edit({ type: 'create', title: 'Second', objective: '' }, null);
        assert.notEqual(first.id, second.id);
        assert.equal(second.revision, 1);
        let current = await edit({ type: 'rename', sessionId: first.id, title: 'Renamed' }, first.revision);
        assert.equal(current.revision, 2);
        assert.ok(current.updatedAt > first.updatedAt);
        current = await edit({ type: 'set-objective', sessionId: first.id, objective: 'Revised objective' }, current.revision);
        current = await edit({ type: 'set-notes', sessionId: first.id, notes: 'Developer note' }, current.revision);
        current = await edit({ type: 'set-next-actions', sessionId: first.id, nextActions: ['Verify'] }, current.revision);
        current = await edit({ type: 'pause', sessionId: first.id }, current.revision);
        await assert.rejects(edit({ type: 'pause', sessionId: first.id }, current.revision), /active/);
        current = await edit({ type: 'resume', sessionId: first.id }, current.revision);
        current = await edit({ type: 'close', sessionId: first.id,
            closeout: { achieved: 'Implemented', unresolved: 'None', deferred: 'UI' } }, current.revision);
        assert.equal(current.closeout?.closedAt, current.updatedAt);
        await assert.rejects(edit({ type: 'rename', sessionId: first.id, title: 'Too late' }, current.revision), /immutable/);
        const closed = current;
        current = await edit({ type: 'reopen', sessionId: first.id }, current.revision);
        assert.equal(current.status, 'active');
        assert.equal(current.closeout, null);
        assert.ok(current.updatedAt > closed.updatedAt);
        await assert.rejects(edit({ type: 'reopen', sessionId: first.id }, current.revision), /closed/);
        await assert.rejects(edit({ type: 'rename', sessionId: first.id, title: 'Stale' }, first.revision), /Stale/);
        await assert.rejects(store.mutate(p.root, null, { projectHandle: '', expectedCollectionRevision: 0,
            expectedSessionRevision: current.revision, operation: { type: 'rename', sessionId: first.id, title: 'Stale' } }), /Stale/);
        await assert.rejects(edit({ type: 'rename', sessionId: randomUUID(), title: 'Unknown' }, 1), /Unknown/);
        await assert.rejects(edit({ type: 'rename', sessionId: first.id, title: ' '.repeat(161) }, current.revision), /title/);
        await assert.rejects(edit({ type: 'set-next-actions', sessionId: first.id, nextActions: Array(51).fill('x') }, current.revision), /next actions/);
        assert.equal((await store.read(p.root)).revision, collectionRevision);
        assert.equal((await store.read(p.root)).sessions.find(session => session.id === second.id)?.title, 'Second');
        for (const name of ['chats.json', 'planning-maps.json', 'agent.json', 'project-mind.json'])
            assert.equal(await readFile(join(p.root, '.dope', name), 'utf8'), `${name} sentinel`);
    } finally { await p.clean(); }
});
