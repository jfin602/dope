import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { DeveloperSessionBackend } from '../../packages/theia-extension/lib/node/developer-session-backend.js';
import { DeveloperSessionStore } from '../../packages/theia-extension/lib/node/developer-session-store.js';

test('shared links are revision safe, detachable, and resolve current owner truth without execution', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-session-membership-'));
    const foreignRoot = await mkdtemp(join(tmpdir(), 'dope-session-membership-other-'));
    const backend = new DeveloperSessionBackend(new DeveloperSessionStore());
    const foreign = new DeveloperSessionBackend(new DeveloperSessionStore());
    try {
        const chatId = randomUUID();
        const chats = new ChatRepository();
        await chats.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '', title: 'Shared source' });
        const manifest = join(root, '.dope/chats/index.json');
        const entry = JSON.parse(await readFile(manifest, 'utf8')).entries[0];
        const source = join(root, '.dope/chats/folders', entry.file);
        const ownerBytes = [await readFile(manifest), await readFile(source)];
        const attachment = await backend.attach(pathToFileURL(root).href);
        const otherAttachment = await foreign.attach(pathToFileURL(foreignRoot).href);
        const handle = attachment.projectHandle;
        const create = async (revision: number) => backend.mutate({ projectHandle: handle,
            expectedCollectionRevision: revision, expectedSessionRevision: null,
            operation: { type: 'create', title: 'Manual', objective: '' } });
        const first = await create(0);
        const second = await create(1);
        const ref = { kind: 'chat' as const, chatId };
        const request = (sessionId: string, collectionRevision: number, sessionRevision: number) =>
            ({ projectHandle: handle, sessionId, expectedCollectionRevision: collectionRevision,
                expectedSessionRevision: sessionRevision, ref });
        const linkedFirst = await backend.attachLink(request(first.session.id, 2, 1));
        assert.equal(linkedFirst.snapshot.revision, 3);
        assert.equal(linkedFirst.session.revision, 2);
        const file = join(root, '.dope/development-sessions.json');
        const bytes = await readFile(file);
        const duplicate = await backend.attachLink(request(first.session.id, 3, 2));
        assert.equal(duplicate.snapshot.revision, 3);
        assert.equal(duplicate.session.revision, 2);
        assert.deepEqual(await readFile(file), bytes);
        await assert.rejects(backend.attachLink(request(first.session.id, 2, 2)), /Stale/);
        await assert.rejects(backend.attachLink(request(first.session.id, 3, 1)), /Stale/);
        await assert.rejects(backend.attachLink({ ...request(first.session.id, 3, 2), ref:
            { kind: 'chat', chatId: '../bad' } }), /Invalid/);
        await assert.rejects(backend.attachLink({ ...request(first.session.id, 3, 2), ref:
            { kind: 'chat', chatId: randomUUID() } }), /missing/);
        const foreignChat = randomUUID();
        await chats.mutate(foreignRoot, 0, { type: 'create-chat', id: foreignChat,
            folderPath: '', title: 'Other project' });
        await assert.rejects(backend.attachLink({ ...request(first.session.id, 3, 2), ref:
            { kind: 'chat', chatId: foreignChat } }), /missing/);
        await assert.rejects(backend.attachLink({ ...request(first.session.id, 3, 2),
            projectHandle: otherAttachment.projectHandle }), /handle/);
        const linkedSecond = await backend.attachLink(request(second.session.id, 3, 1));
        assert.equal(linkedSecond.snapshot.revision, 4);
        assert.deepEqual(linkedSecond.session.links, [ref]);
        const resolved = await backend.resolve({ projectHandle: handle, sessionId: first.session.id });
        assert.equal(resolved.collectionRevision, 4);
        assert.equal(resolved.sessionRevision, 2);
        assert.equal(resolved.artifacts[0].availability, 'resolved');
        assert.equal(resolved.artifacts[0].title, 'Shared source');
        assert.equal(JSON.stringify(resolved).includes('messages'), false);
        const detached = await backend.detachLink(request(first.session.id, 4, 2));
        assert.deepEqual(detached.session.links, []);
        assert.deepEqual((await backend.get(handle, second.session.id))?.links, [ref]);
        assert.deepEqual([await readFile(manifest), await readFile(source)], ownerBytes);
        const closed = await backend.mutate({ projectHandle: handle, expectedCollectionRevision: 5,
            expectedSessionRevision: detached.session.revision, operation: { type: 'close', sessionId: first.session.id,
                closeout: { achieved: '', unresolved: '', deferred: '' } } });
        await assert.rejects(backend.attachLink(request(first.session.id, 6, closed.session.revision)), /immutable/);
        await assert.rejects(backend.detachLink(request(first.session.id, 6, closed.session.revision)), /immutable/);
        const reopened = await backend.mutate({ projectHandle: handle, expectedCollectionRevision: 6,
            expectedSessionRevision: closed.session.revision, operation: { type: 'reopen', sessionId: first.session.id } });
        assert.equal((await backend.attachLink(request(first.session.id, 7, reopened.session.revision))).session.links.length, 1);
        const removed = JSON.parse(await readFile(manifest, 'utf8'));
        removed.entries = [];
        removed.revision++;
        await writeFile(manifest, `${JSON.stringify(removed)}\n`);
        assert.equal((await backend.resolve({ projectHandle: handle, sessionId: first.session.id })).artifacts[0].availability, 'missing');
        assert.deepEqual((await backend.get(handle, first.session.id))?.links, [ref]);
        const missingDuplicate = await backend.attachLink(request(first.session.id, 8, 6));
        assert.equal(missingDuplicate.snapshot.revision, 8);
        assert.equal(missingDuplicate.session.revision, 6);
        await writeFile(manifest, '{bad json');
        assert.equal((await backend.resolve({ projectHandle: handle, sessionId: second.session.id })).artifacts[0].availability, 'unavailable');
        assert.deepEqual(await readdir(join(root, '.dope')), ['chats', 'development-sessions.json']);
        await assert.rejects(foreign.resolve({ projectHandle: handle, sessionId: first.session.id }), /handle/);
        backend.dispose();
        await assert.rejects(backend.resolve({ projectHandle: handle, sessionId: first.session.id }), /handle/);
    } finally {
        backend.dispose(); foreign.dispose();
        await rm(root, { recursive: true, force: true });
        await rm(foreignRoot, { recursive: true, force: true });
    }
});

test('link cap rejects another attachment without changing revisions or owner bytes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-session-link-cap-'));
    const store = new DeveloperSessionStore();
    const backend = new DeveloperSessionBackend(store);
    try {
        const chatId = randomUUID();
        await new ChatRepository().mutate(root, 0,
            { type: 'create-chat', id: chatId, folderPath: '', title: 'Capacity target' });
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const created = await backend.mutate({ projectHandle, expectedCollectionRevision: 0,
            expectedSessionRevision: null, operation: { type: 'create', title: 'Full', objective: '' } });
        await store.transact(root, null, 1, current => ({ ...current, revision: 2,
            sessions: current.sessions.map(session => ({ ...session, revision: 2,
                links: Array.from({ length: 100 }, () => ({ kind: 'chat' as const, chatId: randomUUID() })) })) }));
        const sessionFile = join(root, '.dope/development-sessions.json');
        const ownerFile = join(root, '.dope/chats/index.json');
        const before = [await readFile(sessionFile), await readFile(ownerFile)];
        await assert.rejects(backend.attachLink({ projectHandle, sessionId: created.session.id,
            expectedCollectionRevision: 2, expectedSessionRevision: 2,
            ref: { kind: 'chat', chatId } }), /Too many/);
        assert.deepEqual([await readFile(sessionFile), await readFile(ownerFile)], before);
    } finally {
        backend.dispose();
        await rm(root, { recursive: true, force: true });
    }
});
