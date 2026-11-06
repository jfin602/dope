import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { prepareDocumentationReview } from '../../packages/theia-extension/lib/node/documentation-review.js';
import { applyDocumentationProposal, readDocumentationApplications,
    reconcileDocumentationApplication } from '../../packages/theia-extension/lib/node/documentation-application.js';
import { HistoryBackend } from '../../packages/theia-extension/lib/node/history-backend.js';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { resolveChatSkill } from '../../packages/theia-extension/lib/node/chat-skills.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'dope-doc-apply-'));
    await mkdir(join(root, 'docs'));
    const store = new RoadmapStore(), leaseToken = randomUUID();
    const proposal = (changes: { path: string; after: string }[]) => prepareDocumentationReview(store, {
        root, chatId: randomUUID(), messageId: randomUUID(), ownerId: 'developer-panel', leaseToken, changes });
    return { root, store, leaseToken, proposal };
}

test('one approved create/update set retains exact bytes, stable retry and one original History diff', async () => {
    const f = await fixture();
    try {
        await writeFile(join(f.root, 'docs', 'existing.md'), 'old\r\n');
        const proposal = await f.proposal([{ path: 'docs/existing.md', after: 'new\r\n' },
            { path: 'docs/created.txt', after: 'created\n' }]);
        await assert.rejects(applyDocumentationProposal(f.store, proposal, f.root, 'wrong lease'), /lease/i);
        await assert.rejects(applyDocumentationProposal(f.store, { ...proposal, digest: digest('tampered') },
            f.root, f.leaseToken), /stale/i);
        assert.deepEqual(await readDocumentationApplications(f.root), []);
        const result = await applyDocumentationProposal(f.store, proposal, f.root, f.leaseToken);
        assert.equal(result.status, 'complete');
        assert.deepEqual(result.effects.map(effect => effect.path), ['docs/existing.md', 'docs/created.txt']);
        assert.equal(await readFile(join(f.root, 'docs', 'existing.md'), 'utf8'), 'new\r\n');
        assert.equal(await readFile(join(f.root, 'docs', 'created.txt'), 'utf8'), 'created\n');
        const retry = await applyDocumentationProposal(f.store, proposal, f.root, f.leaseToken);
        assert.equal(retry.id, result.id);
        assert.deepEqual(retry.effects, result.effects);
        assert.equal((await readDocumentationApplications(f.root)).length, 1);
        await writeFile(join(f.root, 'docs', 'existing.md'), 'later editor change\n');
        const history = new HistoryBackend();
        const { projectHandle } = await history.attach(pathToFileURL(f.root).toString());
        const entry = (await history.read(projectHandle)).entries.find(item => item.source === 'documentation');
        assert.equal(entry?.sourceId, result.id);
        assert.equal(entry?.documentation?.changes.length, 2);
        assert.match(entry?.documentation?.changes[0].diff ?? '', /\+new/);
        assert.equal(entry?.documentation?.changes[0].afterHash, digest('new\r\n'));
        history.dispose();
    } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('stale, collision, foreign root, symlink and linked Roadmap source make zero effects', async () => {
    const f = await fixture();
    try {
        await writeFile(join(f.root, 'docs', 'current.md'), 'before');
        const stale = await f.proposal([{ path: 'docs/current.md', after: 'after' }]);
        await writeFile(join(f.root, 'docs', 'current.md'), 'concurrent editor');
        await assert.rejects(applyDocumentationProposal(f.store, stale, f.root, f.leaseToken), /stale/i);
        assert.equal(await readFile(join(f.root, 'docs', 'current.md'), 'utf8'), 'concurrent editor');
        const create = await f.proposal([{ path: 'docs/new.md', after: 'new' }]);
        await writeFile(join(f.root, 'docs', 'new.md'), 'collision');
        await assert.rejects(applyDocumentationProposal(f.store, create, f.root, f.leaseToken), /stale|unsafe/i);
        await assert.rejects(applyDocumentationProposal(f.store, create, '/tmp', f.leaseToken), /project/i);
        await rm(join(f.root, 'docs', 'new.md'));
        await symlink(join(f.root, 'docs', 'current.md'), join(f.root, 'docs', 'new.md'));
        await assert.rejects(applyDocumentationProposal(f.store, create, f.root, f.leaseToken), /stale|unsafe/i);
        assert.deepEqual(await readDocumentationApplications(f.root), []);
        const reviewed = await f.proposal([{ path: 'docs/other.md', after: 'other' }]);
        const index = await f.store.read(f.root);
        const linked = { read: async () => ({ ...index,
            linkedDocument: { path: 'docs/other.md', syncState: 'synced' } }) } as unknown as RoadmapStore;
        await assert.rejects(applyDocumentationProposal(linked, reviewed, f.root, f.leaseToken), /stale/i);
    } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('recovery distinguishes crash before effect from verified retained create and deduplicates restart', async () => {
    const f = await fixture();
    try {
        const proposal = await f.proposal([{ path: 'docs/new.md', after: 'approved bytes' }]);
        await mkdir(join(f.root, '.dope'));
        const directory = join(f.root, '.dope', 'documentation-applications');
        await mkdir(directory);
        const journal = { schemaVersion: 1, id: proposal.id, proposalDigest: proposal.digest, root: f.root,
            projectId: proposal.projectId, worktreeId: proposal.worktreeId, ownerId: proposal.ownerId,
            chatId: proposal.chatId, messageId: proposal.messageId, leaseDigest: proposal.leaseDigest,
            roadmapRevision: proposal.roadmapRevision, approvedAt: new Date().toISOString(),
            status: 'applying', effects: [], targets: proposal.targets };
        const file = join(directory, `${proposal.id}.json`);
        await writeFile(file, JSON.stringify(journal));
        const orphanedFirstWrite = join(directory, `${proposal.id}.${randomUUID()}.tmp`);
        await link(file, orphanedFirstWrite);
        const zero = await reconcileDocumentationApplication(f.root, proposal.id);
        assert.equal(zero?.status, 'failed');
        assert.deepEqual(await readDocumentationApplications(f.root), []);
        await rm(orphanedFirstWrite);
        await writeFile(file, JSON.stringify(journal));
        const staged = join(f.root, `docs/new.md.dope-${proposal.id}.stage`);
        await writeFile(staged, 'approved bytes');
        await link(staged, join(f.root, 'docs', 'new.md'));
        const beforeHistory = await readFile(file, 'utf8');
        const history = new HistoryBackend();
        const { projectHandle } = await history.attach(pathToFileURL(f.root).toString());
        assert.equal((await history.read(projectHandle)).entries.some(entry => entry.source === 'documentation'), false);
        assert.equal(await readFile(file, 'utf8'), beforeHistory);
        assert.equal(await readFile(staged, 'utf8'), 'approved bytes');
        history.dispose();
        const retained = await reconcileDocumentationApplication(f.root, proposal.id);
        assert.equal(retained?.status, 'complete');
        assert.equal(retained?.effects.length, 1);
        assert.equal(retained?.effects[0].appliedAt, null);
        const again = await reconcileDocumentationApplication(f.root, proposal.id);
        assert.deepEqual(again, retained);
        assert.equal((await readDocumentationApplications(f.root)).length, 1);
    } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('update interruption restores an absent name, then records only a verified retained subset', async () => {
    const f = await fixture();
    try {
        await writeFile(join(f.root, 'docs', 'first.md'), 'before');
        const proposal = await f.proposal([{ path: 'docs/first.md', after: 'approved' },
            { path: 'docs/second.md', after: 'not yet applied' }]);
        await mkdir(join(f.root, '.dope'));
        const directory = join(f.root, '.dope', 'documentation-applications');
        await mkdir(directory);
        const journal = { schemaVersion: 1, id: proposal.id, proposalDigest: proposal.digest, root: f.root,
            projectId: proposal.projectId, worktreeId: proposal.worktreeId, ownerId: proposal.ownerId,
            chatId: proposal.chatId, messageId: proposal.messageId, leaseDigest: proposal.leaseDigest,
            roadmapRevision: proposal.roadmapRevision, approvedAt: new Date().toISOString(),
            status: 'applying', effects: [], targets: proposal.targets };
        const file = join(directory, `${proposal.id}.json`);
        const source = join(f.root, 'docs', 'first.md');
        const staged = `${source}.dope-${proposal.id}.stage`;
        const backup = `${source}.dope-${proposal.id}.backup`;
        await writeFile(file, JSON.stringify(journal));
        await writeFile(staged, 'approved');
        await rename(source, backup);
        const restored = await reconcileDocumentationApplication(f.root, proposal.id);
        assert.equal(restored?.status, 'failed');
        assert.equal(await readFile(source, 'utf8'), 'before');
        assert.deepEqual(await readDocumentationApplications(f.root), []);
        await writeFile(file, JSON.stringify(journal));
        await writeFile(staged, 'approved');
        await rename(source, backup);
        await link(staged, source);
        const partial = await reconcileDocumentationApplication(f.root, proposal.id);
        assert.equal(partial?.status, 'partial');
        assert.deepEqual(partial?.effects.map(effect => effect.path), ['docs/first.md']);
        assert.equal(partial?.effects[0].appliedAt, null);
        assert.equal(await readFile(source, 'utf8'), 'approved');
        assert.equal((await readDocumentationApplications(f.root)).length, 1);
        const repeat = await reconcileDocumentationApplication(f.root, proposal.id);
        assert.deepEqual(repeat?.effects, partial?.effects);
    } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('Chat backend requires a distinct exact developer approval and consumes it once', async () => {
    const f = await fixture();
    const repository = new ChatRepository();
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, undefined, undefined,
        undefined, undefined, undefined, undefined, undefined, f.store);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(f.root).toString());
        const chatId = randomUUID(), userId = randomUUID(), messageId = randomUUID();
        let state = await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'developer-panel' });
        if (!lease.acquired) throw new Error('Chat lease unavailable');
        state = await repository.mutate(f.root, state.revision, { type: 'append-user', chatId,
            message: { schemaVersion: 1, id: userId, role: 'user', createdAt: new Date().toISOString(),
                content: '/docs-review the decision', contextRefs: [],
                skill: await resolveChatSkill('/docs-review the decision') } }, lease.token);
        const startedAt = new Date().toISOString();
        state = await repository.mutate(f.root, state.revision, { type: 'begin-assistant', chatId,
            message: { schemaVersion: 1, id: messageId, role: 'assistant', content: '', createdAt: startedAt,
                execution: { schemaVersion: 1, id: randomUUID(), status: 'pending',
                    selectedModel: { connectionId: 'local', modelId: 'exact' }, startedAt } } }, lease.token);
        state = await repository.mutate(f.root, state.revision, { type: 'start-assistant', chatId, messageId,
            actualModel: { schemaVersion: 1, connectionId: 'local', modelId: 'exact', providerId: 'test', modelLabel: 'Exact' } }, lease.token);
        await repository.mutate(f.root, state.revision, { type: 'finish-assistant', chatId, messageId,
            outcome: 'complete', content: 'Reviewed decision' }, lease.token);
        const proposal = await backend.reviewDocumentation(projectHandle, chatId, lease.token, messageId,
            [{ path: 'docs/decision.md', after: '# Decision\n' }]);
        assert.equal((await readDocumentationApplications(f.root)).length, 0);
        await assert.rejects(backend.applyDocumentation(projectHandle, chatId, 'wrong', proposal.id, proposal.digest), /ownership/i);
        await assert.rejects(backend.applyDocumentation(projectHandle, chatId, lease.token, proposal.id, digest('wrong')), /Exact/i);
        assert.equal((await readDocumentationApplications(f.root)).length, 0);
        await backend.release(projectHandle, chatId, lease.token);
        const reclaimed = await backend.claim({ projectHandle, chatId, ownerId: 'developer-panel' });
        if (!reclaimed.acquired) throw new Error('Same owner could not reclaim Chat');
        const pending = (await backend.get(projectHandle, chatId))!.messages.find(message => message.id === messageId);
        const renewed = pending?.role === 'assistant' ? pending.planningActivity?.documentProposal : undefined;
        assert.ok(renewed);
        assert.equal(pending?.role === 'assistant' && pending.planningActivity?.status, 'pending');
        assert.equal(renewed.id, proposal.id);
        assert.notEqual(renewed.digest, proposal.digest);
        assert.deepEqual(renewed.targets, proposal.targets);
        assert.equal((await readDocumentationApplications(f.root)).length, 0);
        await assert.rejects(backend.applyDocumentation(projectHandle, chatId, reclaimed.token,
            proposal.id, proposal.digest), /Exact/i);
        const result = await backend.applyDocumentation(projectHandle, chatId, reclaimed.token,
            renewed.id, renewed.digest);
        assert.equal(result.status, 'complete');
        assert.equal(await readFile(join(f.root, 'docs', 'decision.md'), 'utf8'), '# Decision\n');
        await assert.rejects(backend.applyDocumentation(projectHandle, chatId, reclaimed.token, renewed.id, renewed.digest), /Exact/i);
        assert.equal((await readDocumentationApplications(f.root)).length, 1);
        const saved = (await repository.read(f.root)).chats[0].messages.find(message => message.id === messageId);
        assert.equal(saved?.role === 'assistant' && saved.planningActivity?.status, 'applied');
        const history = new HistoryBackend();
        const attached = await history.attach(pathToFileURL(f.root).toString());
        const entry = (await history.read(attached.projectHandle)).entries.find(item => item.source === 'documentation');
        assert.equal(entry?.availability, 'available');
        assert.deepEqual(entry?.owner, { kind: 'chat', chatId });
        assert.match(entry?.documentation?.changes[0].diff ?? '', /\+# Decision/);
        history.dispose();
    } finally { backend.dispose(); await rm(f.root, { recursive: true, force: true }); }
});

test('recovery preserves a concurrent editor collision after an update was moved aside', async () => {
    const f = await fixture();
    try {
        const source = join(f.root, 'docs', 'current.md');
        await writeFile(source, 'reviewed before');
        const proposal = await f.proposal([{ path: 'docs/current.md', after: 'approved after' }]);
        await mkdir(join(f.root, '.dope'));
        const directory = join(f.root, '.dope', 'documentation-applications');
        await mkdir(directory);
        const journal = { schemaVersion: 1, id: proposal.id, proposalDigest: proposal.digest, root: f.root,
            projectId: proposal.projectId, worktreeId: proposal.worktreeId, ownerId: proposal.ownerId,
            chatId: proposal.chatId, messageId: proposal.messageId, leaseDigest: proposal.leaseDigest,
            roadmapRevision: proposal.roadmapRevision, approvedAt: new Date().toISOString(),
            status: 'applying', effects: [], targets: proposal.targets };
        await writeFile(join(directory, `${proposal.id}.json`), JSON.stringify(journal));
        const backup = `${source}.dope-${proposal.id}.backup`;
        const staged = `${source}.dope-${proposal.id}.stage`;
        await writeFile(staged, 'approved after');
        await rename(source, backup);
        await writeFile(source, 'concurrent editor');
        const result = await reconcileDocumentationApplication(f.root, proposal.id);
        assert.equal(result?.status, 'uncertain');
        assert.deepEqual(result?.effects, []);
        assert.equal(await readFile(source, 'utf8'), 'concurrent editor');
        assert.equal(await readFile(backup, 'utf8'), 'reviewed before');
        assert.deepEqual(await readDocumentationApplications(f.root), []);
    } finally { await rm(f.root, { recursive: true, force: true }); }
});
