import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { bindGateChatActions, validGateChatEnvelope } from '../../packages/theia-extension/lib/node/roadmap-gate-chat.js';

test('Chat only accepts bounded structural proposals and binds temporary IDs within a batch', () => {
    const envelope = { type: 'roadmap-gate-proposal', projectId: 'owner-1', ownerRevision: 2,
        actions: [
            { type: 'phase.create', id: 'new:1', title: 'Combat', objective: 'Prove defeat' },
            { type: 'gate.create', id: 'new:2', parentPhaseId: 'new:1', designation: 'G1',
                title: 'Defeat', purpose: 'Health gate', criteria: [
                    { id: 'new:3', title: 'Zero health', expectedResult: 'Game ends' }] }
        ] };
    assert.equal(validGateChatEnvelope(envelope), true);
    const actions = bindGateChatActions(envelope.actions as never);
    assert.match(actions[0].id!, /^[0-9a-f]{8}-/);
    assert.equal((actions[1] as { parentPhaseId: string }).parentPhaseId, actions[0].id);
    assert.notEqual(actions[1].id, 'new:2');
    assert.equal(validGateChatEnvelope({ ...envelope, actions: [{ type: 'gate.waiver.approve' }] }), false);
    assert.throws(() => bindGateChatActions([{ type: 'phase.create', id: 'new:1', title: 'A', objective: 'A' },
        { type: 'phase.create', id: 'new:1', title: 'B', objective: 'B' }] as never), /distinct/);
});

test('saved Chat reviews a schema-two Phase proposal before the Roadmap writer applies it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-chat-'));
    const store = new RoadmapStore(), repository = new ChatRepository();
    const projectId = randomUUID();
    const index = { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
        inputsCurrent: async () => false };
    const composer = new ChatContextComposer({} as never, {} as never, index as never, repository, store);
    const actions = new ProjectPlanningActions(store);
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
            streaming: true, contextWindowTokens: 8192, maxInputTokens: 8192 } }] }] }),
    async *generate() { yield { type: 'complete' as const, actualModelId: 'q4', text: JSON.stringify({
        type: 'roadmap-gate-proposal', projectId, ownerRevision: 1,
        actions: [{ type: 'phase.create', id: 'new:1', title: 'Combat Systems',
            objective: 'Verify combat behavior' }] }) }; } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
        composer, undefined, undefined, actions, undefined, undefined, store);
    try {
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId,
            projectRoot: root, revision: 1, phases: [], gates: [], corrections: [] });
        const { projectHandle } = await backend.attach(pathToFileURL(root).href), chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Roadmap authoring' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) throw new Error('Chat lease unavailable');
        const before = await readFile(join(root, '.dope', 'roadmap.json'));
        const turn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: 'Add a Phase called Combat Systems.',
            context: [{ kind: 'roadmap', id: 'roadmap', projectId, ownerRevision: 1 }] });
        assert.ok(turn.proposal);
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), before);
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, turn.proposal.id, false);
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), before);
        const retry = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: 'Add a Phase called Combat Systems.',
            context: [{ kind: 'roadmap', id: 'roadmap', projectId, ownerRevision: 1 }] });
        assert.ok(retry.proposal);
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, retry.proposal.id, true);
        const saved = await store.read(root);
        assert.equal(saved.revision, 2);
        assert.equal(saved.phases[0].title, 'Combat Systems');
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});
