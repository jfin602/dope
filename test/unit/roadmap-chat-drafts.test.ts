import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';

test('a new plan-only owner refuses existing plan or legacy greenfield drafts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-plan-owner-'));
    const drafts = new RoadmapGreenfield(new RoadmapStore());
    try {
        const plan = await drafts.beginImplementationPlan(root);
        await assert.rejects(drafts.beginImplementationPlan(root), /existing implementation plan owner/);
        drafts.cancel(plan.handle);
        const legacy = await drafts.begin(root);
        await assert.rejects(drafts.beginImplementationPlan(root), /existing implementation plan owner/);
        drafts.cancel(legacy.handle);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('selected local model previews two draft phases with one approval and no canonical write', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-chat-draft-steps-'));
    const store = new RoadmapStore(), greenfield = new RoadmapGreenfield(store);
    const repository = new ChatRepository();
    const { handle } = await greenfield.begin(root);
    const chatId = randomUUID();
    const projectId = (await store.read(root)).projectId;
    let calls = 0;
    const answer = JSON.stringify({ type: 'roadmap-draft-sequence', projectId, draftRevision: 0,
        actions: [{ type: 'create-phase', title: 'Design' }, { type: 'create-phase', title: 'Build' }] });
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'short', label: 'Short', usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 4096 } }] }] }),
        async *generate() { calls++; yield { type: 'complete' as const, text: answer }; } };
    const composer = { compose: async () => ({ messages: [{ role: 'user' as const, content: 'Two phases' }],
        refs: [], diagnostics: [], usedTokens: 20, budgetTokens: 1000 }) };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer as never,
        undefined, undefined, new ProjectPlanningActions(store), greenfield);
    let releaseLease: (() => Promise<void>) | undefined;
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        if (!lease.acquired) throw new Error('Chat lease missing');
        releaseLease = () => backend.release(projectHandle, chatId, lease.token);
        greenfield.bindChat(root, handle, chatId);
        const result = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'short' }, planningSteps: 2, content: 'Two phases' });
        assert.ok(result.proposal);
        assert.equal(result.proposal?.action.type, 'draft-sequence');
        assert.equal(greenfield.read(handle).revision, 0);
        assert.equal((await store.read(root)).revision, 0);
        assert.equal(calls, 1);
        const message = (await backend.get(projectHandle, chatId))!.messages.at(-1)!;
        assert.equal(message.role === 'assistant' && message.planningActivity?.kind, 'roadmap-draft-sequence');
        assert.equal(message.role === 'assistant' && message.execution.actualModel?.modelId, 'short');
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, result.proposal!.id, true);
        assert.deepEqual(greenfield.read(handle).phases.map(phase => phase.title), ['Design', 'Build']);
        assert.equal((await store.read(root)).revision, 0);
    } finally {
        await releaseLease?.();
        backend.dispose();
        await rm(root, { recursive: true, force: true });
    }
});
