import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { documentationReviewApplicability, prepareDocumentationReview,
    renewDocumentationReviewLease } from '../../packages/theia-extension/lib/node/documentation-review.js';
import { parsePlanningActivity } from '../../packages/chat/lib/index.js';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';

async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'dope-doc-review-'));
    await mkdir(join(root, 'docs'));
    const store = new RoadmapStore();
    const request = (changes: { path: string; after: string }[]) => ({ root,
        chatId: randomUUID(), messageId: randomUUID(), ownerId: 'panel-a', leaseToken: randomUUID(), changes });
    return { root, store, request };
}

test('review persists exact new/update basis and diff without canonical or History effects', async () => {
    const { root, store, request } = await fixture();
    try {
        await writeFile(join(root, 'docs', 'current.md'), 'before\n');
        const proposal = await prepareDocumentationReview(store, request([
            { path: 'docs/current.md', after: 'after\n' }, { path: 'docs/new.txt', after: 'new\n' }]));
        assert.equal(proposal.targets[0].before, 'before\n');
        assert.match(proposal.targets[0].diff, /-before/);
        assert.match(proposal.targets[0].diff, /\+after/);
        assert.equal(proposal.targets[1].beforeHash, null);
        assert.equal(proposal.targets[1].operation, 'create');
        assert.equal(await readFile(join(root, 'docs/current.md'), 'utf8'), 'before\n');
        assert.deepEqual(await readdir(join(root, 'docs')), ['current.md']);
        assert.deepEqual(await readdir(root), ['docs']);
        const saved = parsePlanningActivity(JSON.parse(JSON.stringify({ schemaVersion: 1,
            kind: 'documentation-proposal', status: 'pending', refs: [], proposalId: proposal.id,
            documentProposal: proposal })));
        assert.equal(saved.documentProposal?.digest, proposal.digest);
        assert.equal(await documentationReviewApplicability(new RoadmapStore(), saved.documentProposal!, root), 'applicable');
        assert.equal(await documentationReviewApplicability(store,
            { ...proposal, targets: [{ ...proposal.targets[0], after: 'tampered' }, proposal.targets[1]] }, root), 'stale');
        await writeFile(join(root, 'docs', 'current.md'), 'manual edit\n');
        assert.equal(await documentationReviewApplicability(store, proposal, root), 'stale');
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('review rejects collision, symlink, protected, unsafe, oversized and foreign source', async () => {
    const { root, store, request } = await fixture();
    try {
        await writeFile(join(root, 'docs', 'taken.md'), 'old');
        await symlink(join(root, 'docs'), join(root, 'linked'));
        await symlink(join(root, 'docs', 'taken.md'), join(root, 'docs', 'alias.md'));
        for (const path of ['../outside.md', '/tmp/outside.md', 'docs/../outside.md',
            'linked/escape.md', 'docs/alias.md', '.dope/owner.md', 'docs/tasks/report.md', 'AGENTS.md',
            'docs/AGENTS.md', 'docs/SKILL.md',
            'docs/qualification/result.md', 'docs/generated/output.md', 'docs/secrets.md',
            'docs/spec.generated.md', 'docs/new.md/']) {
            await assert.rejects(prepareDocumentationReview(store, request([{ path, after: 'new' }])),
                /documentation|Documentation|Unsafe|ENOENT/i, path);
        }
        await assert.rejects(prepareDocumentationReview(store, request([{ path: 'docs/taken.md', after: 'old' }])), /no change/i);
        await assert.rejects(prepareDocumentationReview(store, request([{ path: 'docs/new.md', after: 'x'.repeat(128_001) }])), /limit/i);
        await assert.rejects(prepareDocumentationReview(store, request([{ path: 'docs/new.md', after: 'a\0b' }])), /text/i);
        await assert.rejects(prepareDocumentationReview(store, request([{ path: 'docs/new.md', after: '\ud800' }])), /lossless/i);
        const proposal = await prepareDocumentationReview(store, request([{ path: 'docs/new.md', after: 'new' }]));
        await writeFile(join(root, 'docs/new.md'), 'foreign');
        assert.equal(await documentationReviewApplicability(store, proposal, root), 'stale');
        assert.equal(await documentationReviewApplicability(store, proposal, '/tmp'), 'expired');
        assert.equal(await documentationReviewApplicability(store, { ...proposal, expiresAt: '2000-01-01T00:00:00.000Z' }, root), 'expired');
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('lease renewal retains reviewed bytes only for the same owner and current source', async () => {
    const { root, store, request } = await fixture();
    try {
        await writeFile(join(root, 'docs/current.md'), 'before\n');
        const proposal = await prepareDocumentationReview(store, request([
            { path: 'docs/current.md', after: 'before\nThe bounds are inclusive.\n' }]));
        const renewed = await renewDocumentationReviewLease(store, proposal, root, 'panel-a', 'new-lease');
        assert.equal(renewed.id, proposal.id);
        assert.notEqual(renewed.digest, proposal.digest);
        assert.deepEqual(renewed.targets, proposal.targets);
        assert.equal(await documentationReviewApplicability(store, renewed, root), 'applicable');
        assert.equal(await readFile(join(root, 'docs/current.md'), 'utf8'), 'before\n');
        await assert.rejects(renewDocumentationReviewLease(store, proposal, root,
            'foreign-panel', 'foreign-lease'), /owner or source changed/);
        await writeFile(join(root, 'docs/current.md'), 'concurrent edit\n');
        await assert.rejects(renewDocumentationReviewLease(store, proposal, root,
            'panel-a', 'later-lease'), /owner or source changed/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('linked Roadmap Markdown and changed owner revision cannot enter a Docs review', async () => {
    const { root, request } = await fixture();
    try {
        const base = await new RoadmapStore().read(root);
        const index = { ...base, projectId: randomUUID(), revision: 2,
            linkedDocument: { path: 'docs/roadmap.md', syncState: 'synced' } };
        const store = { read: async () => index } as unknown as RoadmapStore;
        await assert.rejects(prepareDocumentationReview(store, request([{ path: 'docs/roadmap.md', after: 'wrong' }])), /separate writer/i);
        const proposal = await prepareDocumentationReview(store, request([{ path: 'docs/spec.md', after: 'new' }]));
        const changed = { read: async () => ({ ...index, revision: 3 }) } as unknown as RoadmapStore;
        assert.equal(await documentationReviewApplicability(changed, proposal, root), 'stale');
        const unsynced = { read: async () => ({ ...index,
            linkedDocument: { ...index.linkedDocument, syncState: 'conflict' } }) } as unknown as RoadmapStore;
        assert.equal(await documentationReviewApplicability(unsynced, proposal, root), 'stale');
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('saved Chat owns one durable Docs proposal and rejects decision replay', async () => {
    for (const decision of ['denied', 'cancelled'] as const) {
        const { root, store } = await fixture();
        const repo = new ChatRepository(), chatId = randomUUID(), messageId = randomUUID();
        try {
            let state = await repo.mutate(root, 0, { type: 'create-chat', id: chatId, folderPath: '' });
            const lease = await repo.claim(root, chatId, 'docs-review');
            if (!lease.acquired) throw new Error('Chat lease missing');
            const startedAt = new Date().toISOString();
            state = await repo.mutate(root, state.revision, { type: 'begin-assistant', chatId, message: {
                schemaVersion: 1, id: messageId, role: 'assistant', content: '', createdAt: startedAt,
                execution: { schemaVersion: 1, id: randomUUID(), status: 'pending',
                    selectedModel: { connectionId: 'local', modelId: 'model' }, startedAt },
            } }, lease.token);
            state = await repo.mutate(root, state.revision, { type: 'start-assistant', chatId, messageId,
                actualModel: { schemaVersion: 1, connectionId: 'local', modelId: 'model',
                    providerId: 'test', modelLabel: 'Test' } }, lease.token);
            await repo.mutate(root, state.revision, { type: 'finish-assistant', chatId, messageId,
                outcome: 'complete', content: 'Reviewed documentation proposal' }, lease.token);
            const proposal = await prepareDocumentationReview(store, { root, chatId, messageId, ownerId: 'panel-a',
                leaseToken: lease.token, changes: [{ path: 'docs/spec.md', after: '# Spec\n' }] });
            const activity = { schemaVersion: 1 as const, kind: 'documentation-proposal' as const,
                status: 'pending' as const, refs: [], proposalId: proposal.id, documentProposal: proposal };
            await repo.recordPlanningActivity(root, chatId, messageId, lease.token, activity);
            const saved = (await new ChatRepository().read(root)).chats[0].messages[0];
            assert.equal(saved.role, 'assistant');
            if (saved.role !== 'assistant') throw new Error('assistant missing');
            assert.equal(saved.planningActivity?.documentProposal?.digest, proposal.digest);
            await assert.rejects(repo.recordPlanningActivity(root, chatId, messageId, randomUUID(),
                { ...activity, status: decision }, { proposalId: proposal.id, status: 'pending' }), /lease/i);
            await repo.recordPlanningActivity(root, chatId, messageId, lease.token,
                { ...activity, status: decision }, { proposalId: proposal.id, status: 'pending' });
            await assert.rejects(repo.recordPlanningActivity(root, chatId, messageId, lease.token,
                activity, { proposalId: proposal.id, status: 'pending' }), /state changed/);
            const decided = (await new ChatRepository().read(root)).chats[0].messages[0];
            assert.equal(decided.role === 'assistant' && decided.planningActivity?.status, decision);
            assert.equal((await new ChatRepository().read(root)).chats[0].messages[0].role, 'assistant');
            assert.deepEqual(await readdir(join(root, 'docs')), []);
            assert.equal((await readdir(join(root, '.dope'))).includes('history'), false);
        } finally { await rm(root, { recursive: true, force: true }); }
    }
});
