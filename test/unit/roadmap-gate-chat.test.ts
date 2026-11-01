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
import { ambiguousGateReferences, bindGateChatActions, touchesLinkedSource, validGateChatEnvelope } from '../../packages/theia-extension/lib/node/roadmap-gate-chat.js';

test('an indirect Gate name shared by two Gates needs an exact identity', () => {
    const index = { gates: [
        { id: 'gate-one', designation: 'G1', title: 'Readiness' },
        { id: 'gate-two', designation: 'G2', title: 'Other readiness' }
    ] } as never;
    assert.equal(ambiguousGateReferences(index,
        'Change the purpose of a readiness Gate to verify ambiguity.').length, 2);
    assert.deepEqual(ambiguousGateReferences(index,
        'Change the purpose of Gate gate-one to verify final behavior.'), []);
    assert.deepEqual(ambiguousGateReferences(index,
        'Change the purpose of G2 to verify final behavior.'), []);
});

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

test('linked source IDs are recognized across structural and multi-action references', () => {
    const sections = ['phase-one', 'gate-one', 'criterion-one'];
    assert.equal(touchesLinkedSource([{ type: 'gate.delete', id: 'gate-one' }] as never, sections), true);
    assert.equal(touchesLinkedSource([{ type: 'gate.edit', id: 'gate-one', title: 'New', purpose: 'Same' },
        { type: 'criterion.edit', gateId: 'gate-one', id: 'criterion-one', title: 'Same', expectedResult: 'New' }] as never,
    sections), true);
    assert.equal(touchesLinkedSource([{ type: 'gate.create', id: 'new:1', parentPhaseId: 'phase-one',
        designation: 'G2', title: 'New', purpose: 'New', criteria: [] }] as never, sections), true);
    assert.equal(touchesLinkedSource([{ type: 'gate.create', id: 'new:1', parentPhaseId: 'other-phase',
        designation: 'G2', title: 'New', purpose: 'New', criteria: [] }] as never, sections), false);
});

test('saved Chat reviews a schema-two Phase proposal before the Roadmap writer applies it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-chat-'));
    const store = new RoadmapStore(), repository = new ChatRepository();
    const projectId = randomUUID();
    const index = { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
        inputsCurrent: async () => false };
    const composer = new ChatContextComposer({} as never, {} as never, index as never, repository, store);
    const actions = new ProjectPlanningActions(store);
    let answer: unknown = { type: 'roadmap-gate-proposal', projectId, ownerRevision: 1,
        actions: [{ type: 'phase.create', id: 'new:1', title: 'Combat Systems',
            objective: 'Verify combat behavior' }] };
    const prompts: string[] = [];
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
            streaming: true, contextWindowTokens: 8192, maxInputTokens: 8192 } }] }] }),
    async *generate(_selection: unknown, request: { messages: { content: string }[] }) {
        prompts.push(JSON.stringify(request.messages));
        yield { type: 'complete' as const, actualModelId: 'q4', text: JSON.stringify(answer) }; } };
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
        const unskilled = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: 'Add a Phase called Combat Systems.',
            context: [{ kind: 'roadmap', id: 'roadmap', projectId, ownerRevision: 1 }] });
        assert.equal(unskilled.proposal, undefined);
        assert.equal(unskilled.proposalError, undefined);
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), before);
        assert.doesNotMatch(prompts[0], /Supported action types and fields/);
        const turn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: '/roadmap Add a Phase called Combat Systems.',
            context: [{ kind: 'roadmap', id: 'roadmap', projectId, ownerRevision: 1 }] });
        assert.match(prompts[1], /Supported action types and fields/);
        assert.equal((prompts[1].match(/Dope skill \/roadmap/g) ?? []).length, 1);
        assert.ok(turn.proposal);
        assert.equal(turn.proposal.preview?.source, 'validated-roadmap');
        assert.equal(turn.proposal.preview?.entities[0]?.after?.title, 'Combat Systems');
        assert.equal(turn.proposal.preview?.entities[0]?.action, 'create');
        assert.equal(turn.proposal.preview?.steps[0]?.type, 'phase.create');
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), before);
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, turn.proposal.id, false);
        await assert.rejects(backend.decidePlanningProposal(projectHandle, chatId, lease.token,
            turn.proposal.id, true), /unavailable/);
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), before);
        const retry = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: '/roadmap', context: [] });
        assert.ok(retry.proposal);
        assert.ok(retry.refs.some(ref => ref.kind === 'roadmap'));
        assert.match(prompts[2], /Add a Phase called Combat Systems/);
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, retry.proposal.id, true);
        const saved = await store.read(root);
        assert.equal(saved.revision, 2);
        assert.equal(saved.phases[0].title, 'Combat Systems');
        answer = { type: 'no-action', message: 'Combat Systems is the first Phase.' };
        const beforeQuestion = await readFile(join(root, '.dope', 'roadmap.json'));
        const question = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: 'Which Phase comes first?',
            context: [{ kind: 'roadmap', id: 'roadmap', projectId, ownerRevision: 2 }] });
        assert.equal(question.proposalError, undefined);
        assert.equal(question.proposal, undefined);
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), beforeQuestion);
        const phaseList = Array.from({ length: 70 }, (_, order) => ({ id: `phase-${order}`,
            projectId, title: `Phase ${order}`, objective: `Objective ${order}`, order, dependencies: [],
            implementationStatus: 'unknown' as const, qualificationStatus: 'unknown' as const,
            gateSetCoverage: { status: 'unreviewed' as const } }));
        const gateList = Array.from({ length: 52 }, (_, order) => ({ id: `gate-${order}`,
            projectId, parentPhaseId: 'phase-69', designation: `G${order}`, title: `Gate ${order}`,
            purpose: `Purpose ${order}`, order, dependencies: [], draftAcceptance: 'accepted',
            criteria: Array.from({ length: 16 }, (_, number) => ({ id: `criterion-${order}-${number}`,
                projectId, title: `Criterion ${number}`, expectedResult: `Expected ${number}`,
                order: number, evidence: [] })) }));
        const large = { schemaVersion: 2 as const, projectId, projectRoot: root, revision: 2,
            phases: phaseList, gates: gateList, corrections: [] };
        const largeComposer = new ChatContextComposer({} as never, {} as never, index as never,
            repository, { read: async () => large } as never);
        const savedChat = await backend.get(projectHandle, chatId);
        assert.ok(savedChat);
        const selectedContext = [{ kind: 'roadmap' as const, id: 'gate-50', projectId, ownerRevision: 2 }];
        const readOnly = await largeComposer.compose(root, savedChat, 'What does this criterion require?',
            selectedContext, { conversationalText: true, streaming: true, contextWindowTokens: 16384 });
        assert.doesNotMatch(JSON.stringify(readOnly.messages), /Supported action types and fields/);
        assert.match(JSON.stringify(readOnly.messages), /criterion-50-15/);
        assert.doesNotMatch(JSON.stringify(readOnly.messages), /gate-0/);
        const skilled = await largeComposer.compose(root, savedChat, '/roadmap Edit gate-50',
            [{ kind: 'roadmap', id: 'roadmap', projectId, ownerRevision: 2 }],
            { conversationalText: true, streaming: true, contextWindowTokens: 16384 },
            undefined, false, false, undefined, true, true);
        assert.match(JSON.stringify(skilled.messages), /Supported action types and fields/);
        assert.match(JSON.stringify(skilled.messages), /criterion-50-15/);
        assert.match(JSON.stringify(skilled.messages), /phase-69/);
        assert.match(JSON.stringify(skilled.messages), /siblingGates/);
        assert.ok(skilled.messages.some(message => message.content.includes('"designation":"G50"')));
        assert.match(JSON.stringify(skilled.messages), /Every Gate designation must match G/);
        const explicitGate = await largeComposer.compose(root, savedChat,
            '/roadmap Edit gate-50 but keep its title unchanged',
            [{ kind: 'roadmap', id: 'phase-69', projectId, ownerRevision: 2 }],
            { conversationalText: true, streaming: true, contextWindowTokens: 16384 },
            undefined, false, false, undefined, true, true);
        assert.ok(explicitGate.messages.some(message => message.content.includes('"target":{"id":"gate-50"')));
        assert.ok(explicitGate.messages.some(message => message.content.includes('"title":"Gate 50"')));
        assert.ok(skilled.diagnostics.some(item => item.message.includes('first 64')));
        assert.ok(skilled.usedTokens <= skilled.budgetTokens);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});
