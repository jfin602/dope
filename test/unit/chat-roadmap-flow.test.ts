import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';

test('saved answer prepares a review without a second model call or exact selection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-extract-'));
    const store = new RoadmapStore(), greenfield = new RoadmapGreenfield(store);
    const repository = new ChatRepository();
    let calls = 0;
    const models = { async *generate() { calls++; yield { type: 'complete', text: '' }; } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
        undefined, undefined, undefined, undefined, greenfield);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const chatId = randomUUID(), sourceId = randomUUID();
        let snapshot = await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'test-panel' });
        assert(lease.acquired);
        const now = new Date().toISOString();
        snapshot = await backend.mutate({ projectHandle, expectedRevision: snapshot.revision,
            leaseToken: lease.token, operation: { type: 'append-user', chatId, message: {
                schemaVersion: 1, id: randomUUID(), role: 'user', createdAt: now, contextRefs: [],
                content: 'I want a PixiJS 2D tower defense game with a fixed enemy path.' } } });
        snapshot = await backend.mutate({ projectHandle, expectedRevision: snapshot.revision,
            leaseToken: lease.token, operation: { type: 'begin-assistant', chatId, message: {
                schemaVersion: 1, id: sourceId, role: 'assistant', createdAt: now, content: '',
                execution: { schemaVersion: 1, id: randomUUID(), status: 'pending',
                    selectedModel: { connectionId: 'local', modelId: 'q4' }, startedAt: now } } } });
        await backend.mutate({ projectHandle, expectedRevision: snapshot.revision, leaseToken: lease.token,
            operation: { type: 'finish-assistant', chatId, messageId: sourceId, outcome: 'complete',
                content: 'Verified Facts:\nUsing PixiJS for rendering\nPhase 1: PixiJS Setup (Week 1)\n- Render a scene\nPhase 2: Fixed Path (Week 2)\n- Move an enemy',
                actualModel: { schemaVersion: 1, connectionId: 'local', modelId: 'q4',
                    providerId: 'local', modelLabel: 'Q4' } } });
        const review = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            content: 'Lets make a roadmap first' });
        assert.equal(calls, 0);
        assert.deepEqual(review.roadmapDraftReview?.phases.map(phase => phase.title), ['PixiJS Setup', 'Fixed Path']);
        assert.equal(review.roadmapDraftReview?.phases[0].checkpoints[0].title, 'Render a scene');
        const saved = await backend.get(projectHandle, chatId);
        const action = saved?.messages.find(item => item.id === sourceId);
        assert(action?.role === 'assistant');
        assert.match(action.roadmapAction?.diagnostic ?? '', /without file evidence/);
        assert.equal(action.roadmapAction?.sourceMessageId, sourceId);
        assert.equal(action.roadmapAction?.sourceContentHash,
            createHash('sha256').update(action.content).digest('hex'));
        assert.doesNotMatch(action.roadmapAction?.diagnostic ?? '', new RegExp(sourceId));
        assert.equal((await store.read(root)).revision, 0);
        assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            content: 'Lets make a roadmap first' }), /already has a Roadmap decision/);
        assert.equal(calls, 0);
        await backend.release(projectHandle, chatId, lease.token);
        const retired = await backend.get(projectHandle, chatId);
        const retiredAction = retired?.messages.find(item => item.id === sourceId);
        assert(retiredAction?.role === 'assistant');
        assert.equal(retiredAction.roadmapAction?.status, 'stale');
        const reclaimed = await backend.claim({ projectHandle, chatId, ownerId: 'next-panel' });
        assert(reclaimed.acquired);
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: reclaimed.token,
            content: 'Lets make a roadmap first' }), /already has a Roadmap decision/);
        assert.equal(calls, 0);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});
