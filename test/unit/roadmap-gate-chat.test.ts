import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
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
        summary: 'Create Combat and its Defeat gate.',
        actions: [
            { type: 'phase.create', id: 'new:1', title: 'Combat', objective: 'Prove defeat' },
            { type: 'gate.create', id: 'new:2', parentPhaseId: 'new:1', designation: 'G1',
                title: 'Defeat', purpose: 'Health gate', criteria: [
                    { id: 'new:3', title: 'Zero health', expectedResult: 'Game ends' }] }
        ] };
    assert.equal(validGateChatEnvelope(envelope), true);
    assert.equal(validGateChatEnvelope({ ...envelope, summary: '' }), false);
    assert.equal(validGateChatEnvelope({ ...envelope, summary: 'x'.repeat(201) }), false);
    assert.equal(validGateChatEnvelope({ ...envelope, summary: 'First line\nSecond line' }), false);
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

test('saved Chat retains a native staged Roadmap proposal and validated preview after reload', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-chat-'));
    const store = new RoadmapStore(), repository = new ChatRepository();
    const projectId = randomUUID(), chatId = randomUUID();
    const markdown = '# Tower defense Roadmap\n';
    const sourceHash = createHash('sha256').update(markdown).digest('hex');
    const index = { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
        inputsCurrent: async () => false };
    const composer = new ChatContextComposer({} as never, {} as never, index as never, repository, store);
    const prompts: string[] = [];
    const model = { id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
        streaming: true, contextWindowTokens: 32768, maxInputTokens: 32768 } };
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [model] }] }),
    async *generate(_selection: unknown, request: { messages: { content: string }[];
        projectTools?: { roadmapTools?: boolean; execute(name: string, args: unknown): Promise<string> } }) {
        prompts.push(JSON.stringify(request.messages));
        if (request.projectTools?.roadmapTools && prompts.length === 2) {
            const read = JSON.parse(await request.projectTools.execute('roadmap_read', { version: 1 })) as {
                projectId: string; revision: number; link: { sourceHash: string; syncState: string } };
            assert.equal(read.projectId, projectId);
            assert.equal(read.revision, 1);
            assert.equal(read.link.sourceHash, sourceHash);
            assert.equal(read.link.syncState, 'synced');
            const basis = { version: 1, expectedRevision: read.revision,
                expectedSourceHash: read.link.sourceHash };
            const first = JSON.parse(await request.projectTools.execute('roadmap_stage', {
                ...basis, expectedStage: 1, actions: Array.from({ length: 5 }, (_, at) => ({
                    type: 'phase.create', id: `new:p${at + 1}`, title: `Phase ${at + 1}`,
                    objective: `Defend lane ${at + 1}` })) })) as { proposalId: string;
                        acceptedOperationIds: string[]; createdEntityIds: Record<string, string> };
            assert.equal(first.acceptedOperationIds.length, 5);
            const second = JSON.parse(await request.projectTools.execute('roadmap_stage', {
                ...basis, expectedStage: 2, done: true,
                actions: [1, 1, 2, 3].map((phase, at) => ({ type: 'gate.create',
                    id: `new:g${at + 1}`, parentPhaseId: `new:p${phase}`,
                    designation: `G${at + 1}`, title: `Gate ${at + 1}`,
                    purpose: `Verify lane ${phase}`, criteria: [{ id: `new:c${at + 1}`,
                        title: `Observe wave ${at + 1}`, expectedResult: `Wave ${at + 1} stops` }] }))
            })) as { proposalId: string; acceptedOperationIds: string[]; complete: boolean };
            assert.equal(second.complete, true);
            assert.equal(second.proposalId, first.proposalId);
            assert.equal(second.acceptedOperationIds.length, 4);
            const staged = JSON.parse(await request.projectTools.execute('roadmap_read',
                { version: 1, stageOffset: 8 })) as { stage: { proposalId: string;
                    operations: { id: string; action: { parentPhaseId?: string } }[] } };
            assert.equal(staged.stage.proposalId, first.proposalId);
            assert.equal(staged.stage.operations.length, 1);
            assert.equal(staged.stage.operations[0].action.parentPhaseId,
                first.createdEntityIds['new:p3']);
        }
        // A response envelope alone must never become a protected Roadmap proposal.
        yield { type: 'complete' as const, actualModelId: 'q4',
            text: request.projectTools?.roadmapTools ?
                JSON.stringify({ type: 'roadmap-gate-proposal', projectId, ownerRevision: 1,
                    summary: 'Untrusted response text', actions: [] }) :
                JSON.stringify({ type: 'no-action', message: 'No change was staged.' }) };
    } };
    const grounder = { ground: async () => ({ blocks: [], diagnostics: [] }) };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
        composer, undefined, grounder as never, undefined, undefined, undefined, store);
    try {
        await writeFile(join(root, 'ROADMAP.md'), markdown);
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId,
            projectRoot: root, revision: 1, phases: [], gates: [], corrections: [],
            linkedDocument: { projectId, projectRoot: root, path: 'ROADMAP.md', sourceHash,
                syncState: 'synced', sections: [], lastSynced: { sourceHash, fields: [] } } });
        const canonical = await readFile(join(root, '.dope', 'roadmap.json'));
        const source = await readFile(join(root, 'ROADMAP.md'));
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Roadmap authoring' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) throw new Error('Chat lease unavailable');
        const context = [{ kind: 'roadmap' as const, id: 'roadmap', projectId,
            ownerRevision: 1, sourceHash }];
        const ordinary = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: '/roadmap Describe a Phase proposal without staging it.', context });
        assert.equal(ordinary.proposal, undefined);
        assert.equal(ordinary.proposalError, undefined);
        assert.equal(prompts.length, 1);
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), canonical);
        const turn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: '/roadmap Build a five Phase tower-defense plan.', context });
        assert.ok(turn.proposal);
        assert.equal(turn.proposal.ownerId, projectId);
        assert.equal(turn.proposal.revision, 1);
        assert.equal(turn.proposal.sourceHash, sourceHash);
        assert.equal(turn.proposal.chatId, chatId);
        assert.equal(turn.proposal.previewOnly, undefined);
        assert.equal(turn.proposal.operations?.length, 9);
        assert.ok(turn.proposal.operations?.every(item => item.status === 'Pending'));
        assert.equal(turn.proposal.preview?.source, 'validated-roadmap');
        assert.equal(turn.proposal.preview?.totalChanged, 13);
        assert.equal(turn.proposal.preview?.additionalChanges, 0);
        assert.equal(turn.proposal.preview?.steps.length, 9);
        assert.equal(turn.proposal.preview?.entities.length, 13);
        assert.equal(turn.proposal.preview?.entities.filter(item => item.after?.kind === 'gate').length, 4);
        assert.equal(turn.proposal.preview?.entities.filter(item => item.after?.kind === 'criterion').length, 4);
        assert.equal(new Set(turn.proposal.preview?.entities.filter(item => item.after?.kind === 'gate')
            .map(item => item.after?.parentId)).size, 3);
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), canonical);
        assert.deepEqual(await readFile(join(root, 'ROADMAP.md')), source);
        assert.equal(prompts.length, 2, 'no second model pass parses the response');
        backend.dispose();
        const reloaded = new ChatBackend(new ChatRepository(), { notifyChatEvent() {} });
        try {
            const reopened = await reloaded.attach(pathToFileURL(root).href);
            const saved = await reloaded.get(reopened.projectHandle, chatId);
            const assistant = saved?.messages.find(message => message.role === 'assistant' &&
                message.planningActivity?.proposalId === turn.proposal?.id);
            assert.ok(assistant && assistant.role === 'assistant');
            assert.equal(assistant.planningActivity?.status, 'pending');
            assert.equal(assistant.planningActivity?.kind, 'roadmap-gate-proposal');
            assert.equal(assistant.planningActivity?.proposalId, turn.proposal.id);
            assert.equal(assistant.planningActivity?.proposal?.id, turn.proposal.id);
            assert.equal(assistant.planningActivity?.proposal?.messageId, assistant.id);
            assert.equal(assistant.planningActivity?.proposal?.chatId, chatId);
            assert.equal(assistant.planningActivity?.proposal?.ownerId, projectId);
            assert.equal(assistant.planningActivity?.proposal?.revision, 1);
            assert.equal(assistant.planningActivity?.proposal?.sourceHash, sourceHash);
            assert.equal(assistant.planningActivity?.proposal?.previewOnly, undefined);
            assert.deepEqual(assistant.planningActivity?.proposal?.changedIds, turn.proposal.changedIds);
            assert.deepEqual(assistant.planningActivity?.proposal?.preview,
                JSON.parse(JSON.stringify(turn.proposal.preview)));
            assert.ok(assistant.planningActivity?.refs.some(ref => ref.kind === 'roadmap' &&
                ref.projectId === projectId && ref.ownerRevision === 1 && ref.sourceHash === sourceHash));
            assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), canonical);
            assert.deepEqual(await readFile(join(root, 'ROADMAP.md')), source);
        } finally { reloaded.dispose(); }
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('linked native Chat subset approval synchronizes Markdown while rejected operations stay inert', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-linked-ai-sync-'));
    const store = new RoadmapStore(), repository = new ChatRepository();
    const projectId = randomUUID(), chatId = randomUUID();
    try {
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId,
            projectRoot: root, revision: 1,
            phases: [{ id: 'phase-one', projectId, title: 'First Phase', objective: 'Deliver result',
                order: 0, dependencies: [], implementationStatus: 'unknown', qualificationStatus: 'unknown',
                draftAcceptance: 'accepted', gateSetCoverage: { status: 'unreviewed' } }],
            gates: [{ id: 'gate-one', projectId, parentPhaseId: 'phase-one', designation: 'G1',
                title: 'First Gate', purpose: 'Check result', order: 0, dependencies: [],
                criteria: [{ id: 'criterion-one', projectId, title: 'Check result',
                    expectedResult: 'Result visible', order: 0, evidence: [] }],
                implementationStatus: 'unknown', qualificationStatus: 'unknown', draftAcceptance: 'accepted' }],
            corrections: [] });
        const publication = await store.previewRoadmapPublication(root, 'PLAN.md');
        const linked = await store.applyRoadmapPublication(root, publication, true);
        const file = join(root, 'PLAN.md');
        const before = await readFile(file);
        const composer = new ChatContextComposer({} as never, {} as never,
            { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
                inputsCurrent: async () => false } as never, repository, store);
        let generations = 0;
        const models = { list: async () => ({ connections: [{ id: 'local', ready: true,
            providerId: 'local', models: [{ id: 'q4', label: 'Q4', usable: true,
                capabilities: { conversationalText: true, streaming: true,
                    contextWindowTokens: 32768, maxInputTokens: 32768 } }] }] }),
        async *generate(_selection: unknown, request: { projectTools?: {
            roadmapTools?: boolean; execute(name: string, args: unknown): Promise<string> } }) {
            assert.equal(request.projectTools?.roadmapTools, true);
            const basis = JSON.parse(await request.projectTools!.execute('roadmap_read', { version: 1 })) as {
                revision: number; link: { sourceHash: string } };
            const numbers = ++generations === 1 ? [2, 3] : [4, 5];
            await request.projectTools!.execute('roadmap_stage', { version: 1,
                expectedRevision: basis.revision, expectedSourceHash: basis.link.sourceHash,
                expectedStage: 1, done: true, actions: numbers.map(number => ({
                    type: 'gate.create', id: `new:gate${number}`, parentPhaseId: 'phase-one',
                    designation: `G${number}`, title: `AI Gate ${number}`,
                    purpose: `Verify ${number}`, criteria: [{ id: `new:criterion${number}`,
                        title: `Check ${number}`, expectedResult: `Result ${number}` }] })) });
            yield { type: 'complete' as const, actualModelId: 'q4', text: 'Two Gates staged for review.' };
        } };
        const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
            composer, undefined, { ground: async () => ({ blocks: [], diagnostics: [] }) } as never,
            undefined, undefined, undefined, store);
        try {
            const { projectHandle } = await backend.attach(pathToFileURL(root).href);
            await backend.mutate({ projectHandle, expectedRevision: 0,
                operation: { type: 'create-chat', id: chatId, folderPath: '' } });
            const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
            if (!lease.acquired) throw new Error('Chat lease unavailable');
            const turn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
                selectedModel: { connectionId: 'local', modelId: 'q4' },
                content: '/roadmap Add two Gates for the first Phase.',
                context: [{ kind: 'roadmap', id: 'roadmap', projectId,
                    ownerRevision: linked.revision, sourceHash: linked.linkedDocument!.sourceHash }] });
            assert.ok(turn.proposal, turn.proposalError);
            assert.deepEqual(await readFile(file), before);
            const [first, second] = turn.proposal.operations!.map(item => item.id);
            const review = await backend.reviewNativeRoadmap(projectHandle, chatId, lease.token,
                turn.proposal.id, [first], 'apply');
            const result = await backend.decideNativeRoadmap(projectHandle, chatId, lease.token,
                turn.proposal.id, [first], 'apply', review.token);
            assert.ok(result.revision && result.revision > linked.revision);
            const settled = await new RoadmapStore().recoverAutoSync(root);
            assert.equal(settled.linkedDocument?.syncState, 'synced');
            assert.match(await readFile(file, 'utf8'), /AI Gate 2/);
            assert.doesNotMatch(await readFile(file, 'utf8'), /AI Gate 3/);
            const acceptedBytes = await readFile(file);
            const reject = await backend.reviewNativeRoadmap(projectHandle, chatId, lease.token,
                turn.proposal.id, [second], 'reject');
            await backend.decideNativeRoadmap(projectHandle, chatId, lease.token,
                turn.proposal.id, [second], 'reject', reject.token);
            assert.deepEqual(await readFile(file), acceptedBytes);
            const current = await store.read<import('../../packages/project-intelligence/lib/node/roadmap-gate-domain.js').RoadmapGateIndex>(root);
            const staleTurn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
                selectedModel: { connectionId: 'local', modelId: 'q4' },
                content: '/roadmap Propose two more Gates for the first Phase.',
                context: [{ kind: 'roadmap', id: 'roadmap', projectId,
                    ownerRevision: current.revision, sourceHash: current.linkedDocument!.sourceHash }] });
            assert.ok(staleTurn.proposal, staleTurn.proposalError);
            const staleIds = staleTurn.proposal.operations!.map(item => item.id);
            const staleReview = await backend.reviewNativeRoadmap(projectHandle, chatId, lease.token,
                staleTurn.proposal.id, [staleIds[0]], 'apply');
            const independent = await store.mutateGateIndex(root, current.revision, projectId,
                { type: 'phase.edit', id: 'phase-one', title: 'Independently revised Phase',
                    objective: 'Deliver result' });
            await new RoadmapStore().recoverAutoSync(root);
            const independentBytes = await readFile(file);
            await assert.rejects(backend.decideNativeRoadmap(projectHandle, chatId, lease.token,
                staleTurn.proposal.id, [staleIds[0]], 'apply', staleReview.token), /STALE|NOT_SYNCED/);
            assert.deepEqual(await readFile(file), independentBytes);
            assert.equal((await store.read(root)).revision, independent.revision);
            const reopened = new ChatBackend(new ChatRepository(), { notifyChatEvent() {} });
            try {
                const attached = await reopened.attach(pathToFileURL(root).href);
                const chat = await reopened.get(attached.projectHandle, chatId);
                assert.ok(chat?.messages.some(item => item.role === 'assistant' &&
                    item.planningActivity?.proposalId === turn.proposal!.id &&
                    item.planningActivity?.status === 'applied'));
            } finally { reopened.dispose(); }
            assert.equal((await new RoadmapStore().read<import('../../packages/project-intelligence/lib/node/roadmap-gate-domain.js').RoadmapGateIndex>(root))
                .linkedDocument?.syncState, 'synced');
        } finally { backend.dispose(); }
    } finally { await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 20 }); }
});
