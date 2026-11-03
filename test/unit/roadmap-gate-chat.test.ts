import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import type { ChatEvent } from '../../packages/chat/lib/service.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { ambiguousGateReferences, bindGateChatActions, touchesLinkedSource, validGateChatEnvelope } from '../../packages/theia-extension/lib/node/roadmap-gate-chat.js';
import { dispatch as dispatchPi } from '../../packages/pi-runtime/worker.mjs';

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

test('Pi worker serializes two Roadmap batches through ChatBackend without canonical writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-native-pi-backend-'));
    const store = new RoadmapStore(), repository = new ChatRepository(), chatId = randomUUID();
    const composer = new ChatContextComposer({} as never, {} as never,
        { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
            inputsCurrent: async () => false } as never, repository, store);
    const model = { id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
        streaming: true, contextWindowTokens: 32768, maxInputTokens: 32768 } };
    const piModel = { id: 'offline-fixture', name: 'Offline Fixture', api: 'openai-completions',
        provider: 'dope-local', baseUrl: 'http://127.0.0.1:9/v1', reasoning: false,
        input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 4096, maxTokens: 512 };
    const calls: { name: string; arguments: unknown }[] = [];
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true,
        providerId: 'local', models: [model] }] }),
    async *generate(_selection: unknown, request: { projectTools?: { roadmapTools?: boolean;
        execute(name: string, args: unknown): Promise<string> } }) {
        assert.equal(request.projectTools?.roadmapTools, true);
        const originalFetch = globalThis.fetch, originalWrite = process.stdout.write;
        let turn = 0, basis: { expectedRevision: number; expectedSourceHash: string | null } | undefined;
        let relayError: unknown;
        const actions = [
            { type: 'phase.create', id: 'new:phase', title: 'Foundation', objective: 'Playable wave' },
            { type: 'gate.create', id: 'new:gate', parentPhaseId: 'new:phase', designation: 'G1',
                title: 'Wave check', purpose: 'Verify the wave', criteria: [
                    { id: 'new:criterion', title: 'Wave finishes', expectedResult: 'Wave completes' }] }
        ];
        try {
            process.stdout.write = function (chunk: unknown, ...args: unknown[]) {
                try {
                    const record = JSON.parse(String(chunk));
                    if (record.tool) {
                        calls.push(record.tool);
                        queueMicrotask(() => { void (async () => {
                            try {
                                const output = await request.projectTools!.execute(record.tool.name, record.tool.arguments);
                                if (record.tool.name === 'roadmap_read') basis = JSON.parse(output).stageBasis;
                                await dispatchPi({ type: 'tool-result', toolId: record.tool.id,
                                    result: { status: 'completed', output } });
                            } catch (error) { relayError = error; }
                        })(); });
                        return true;
                    }
                } catch { /* ordinary test output */ }
                return originalWrite.call(this, chunk as never, ...args as never[]);
            } as typeof process.stdout.write;
            globalThis.fetch = async (_url, options) => {
                const body = JSON.parse(String(options?.body));
                assert.equal(body.tools.find((item: { function: { name: string } }) =>
                    item.function.name === 'roadmap_stage').function.parameters.properties.actions.items.anyOf.length, 19);
                const next = ++turn;
                const name = next === 1 ? 'roadmap_read' : next <= 3 ? 'roadmap_stage' : undefined;
                const params = next === 1 ? { version: 1 } : next <= 3 ?
                    { version: 1, ...basis, expectedStage: next - 1, done: next === 3,
                        actions: [actions[next - 2]] } : undefined;
                const choices = name ? [
                    { index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0, id: `call-${next}`,
                        type: 'function', function: { name, arguments: JSON.stringify(params) } }] }, finish_reason: null },
                    { index: 0, delta: {}, finish_reason: 'tool_calls' }
                ] : [
                    { index: 0, delta: { role: 'assistant', content: 'Staged for review.' }, finish_reason: null },
                    { index: 0, delta: {}, finish_reason: 'stop' }
                ];
                return new Response(choices.map((choice, at) => `data: ${JSON.stringify({ id: `stage-${next}-${at}`,
                    object: 'chat.completion.chunk', created: 1, model: 'offline-fixture', choices: [choice] })}\n\n`).join('') +
                    'data: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
            };
            await dispatchPi({ type: 'open', mode: 'chat-tools', roadmapTools: true, cwd: root, model: piModel });
            const result = await dispatchPi({ type: 'turn', id: 79, maxOutputTokens: 512,
                messages: [{ role: 'user', content: 'Stage a complete Roadmap.' }] });
            assert.equal(relayError, undefined);
            assert.deepEqual(basis, { expectedRevision: 0, expectedSourceHash: null });
            yield { type: 'complete' as const, actualModelId: 'q4', text: result.text };
        } finally {
            process.stdout.write = originalWrite;
            globalThis.fetch = originalFetch;
            await dispatchPi({ type: 'close' });
        }
    } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
        composer, undefined, { ground: async () => ({ blocks: [], diagnostics: [] }) } as never,
        undefined, undefined, undefined, store);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'New project' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) throw new Error('Chat lease unavailable');
        const turn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: 'Create a complete development Roadmap for a playable 2D tower-defense game.', context: [] });
        assert.ok(turn.proposal, turn.proposalError);
        assert.deepEqual(calls.map(item => item.name), ['roadmap_read', 'roadmap_stage', 'roadmap_stage']);
        assert.equal(turn.proposal.operations?.length, 2);
        assert.equal(await store.gateIndexHash(root), null);
        assert.equal((await store.read(root)).revision, 0);
        await assert.rejects(readFile(join(root, 'ROADMAP.md')), { code: 'ENOENT' });
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
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

test('one greenfield Chat request stages a native Roadmap proposal without canonical initialization', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-native-greenfield-chat-'));
    const store = new RoadmapStore(), repository = new ChatRepository();
    const chatId = randomUUID();
    const snapshots: Extract<ChatEvent, { kind: 'roadmap-stage' }>[] = [];
    let attachedHandle = '', activeLease = '', finalStarted = false;
    const composer = new ChatContextComposer({} as never, {} as never,
        { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
            inputsCurrent: async () => false } as never, repository, store);
    const model = { id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
        streaming: true, contextWindowTokens: 32768, maxInputTokens: 32768 } };
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [model] }] }),
    async *generate(_selection: unknown, request: { projectTools?: {
        roadmapTools?: boolean; execute(name: string, args: unknown): Promise<string> } }) {
        assert.equal(request.projectTools?.roadmapTools, true);
        const read = JSON.parse(await request.projectTools!.execute('roadmap_read', { version: 1 })) as {
            projectId: string; revision: number; link: unknown };
        assert.equal(read.projectId, 'uninitialized');
        assert.equal(read.revision, 0);
        assert.equal(read.link, null);
        const basis = { version: 1, expectedRevision: 0, expectedSourceHash: null };
        const first = JSON.parse(await request.projectTools!.execute('roadmap_stage', { ...basis,
            expectedStage: 1, actions: [
                { type: 'phase.create', id: 'new:foundation', title: 'Playable loop',
                    objective: 'Complete one wave with a working path and tower' }
            ] })) as { acceptedOperationIds: string[] };
        assert.equal(first.acceptedOperationIds.length, 1);
        assert.equal(snapshots.length, 1);
        assert.equal(snapshots[0].snapshot?.sequence, 1);
        assert.deepEqual(snapshots[0].snapshot?.counts, { phases: 1, gates: 0, criteria: 0 });
        assert.equal(snapshots[0].snapshot?.incompletePhaseIds.length, 1);
        const duplicate = JSON.parse(await request.projectTools!.execute('roadmap_stage', { ...basis,
            expectedStage: 1, actions: [{ type: 'phase.create', id: 'new:repeat',
                title: 'Repeat', objective: 'Must not advance' }] })) as { error: string };
        assert.match(duplicate.error, /ROADMAP_STAGE_EXPECTED_2/);
        const invalid = JSON.parse(await request.projectTools!.execute('roadmap_stage', { ...basis,
            expectedStage: 2, actions: [{ type: 'gate.create', id: 'new:orphan',
                parentPhaseId: 'new:missing', designation: 'G1', title: 'Orphan',
                purpose: 'Reject', criteria: [] }] })) as { error: string };
        assert.match(invalid.error, /unknown parentPhaseId/);
        assert.equal(snapshots.length, 1);
        const second = JSON.parse(await request.projectTools!.execute('roadmap_stage', { ...basis,
            expectedStage: 2, actions: [{ type: 'phase.create', id: 'new:progression',
                title: 'Progression', objective: 'Persist health and resolve defeat between waves' }] })) as {
                    acceptedOperationIds: string[] };
        assert.equal(second.acceptedOperationIds.length, 1);
        assert.equal(snapshots.length, 2);
        assert.deepEqual(snapshots[1].snapshot?.counts, { phases: 2, gates: 0, criteria: 0 });
        const third = JSON.parse(await request.projectTools!.execute('roadmap_stage', { ...basis,
            expectedStage: 3, done: true, actions: [
                { type: 'gate.create', id: 'new:path', parentPhaseId: 'new:foundation', designation: 'G1',
                    title: 'Enemy path', purpose: 'Verify fixed waypoint traversal', criteria: [
                        { id: 'new:waypoints', title: 'Ordered waypoints',
                            expectedResult: 'Enemy visits waypoints in order' }] },
                { type: 'gate.create', id: 'new:health', parentPhaseId: 'new:progression', designation: 'G1',
                    title: 'Health persists', purpose: 'Verify loss state', criteria: [
                        { id: 'new:defeat', title: 'Defeat at zero',
                            expectedResult: 'Main tower health carries forward and zero ends the game' }] }
            ] })) as { complete: boolean };
        assert.equal(third.complete, true);
        assert.equal(snapshots.length, 3);
        assert.equal(snapshots[2].snapshot?.sequence, 3);
        assert.deepEqual(snapshots[2].snapshot?.counts, { phases: 2, gates: 2, criteria: 2 });
        assert.deepEqual(snapshots[2].snapshot?.incompletePhaseIds, []);
        assert.equal(snapshots[0].snapshot?.proposalId, snapshots[2].snapshot?.proposalId);
        assert.equal((await backend.readNativeRoadmapStage(attachedHandle, chatId,
            snapshots[2].messageId, activeLease))?.sequence, 3);
        assert.equal(await backend.readNativeRoadmapStage(attachedHandle, chatId,
            'foreign-turn', activeLease), undefined);
        assert.equal(await backend.readNativeRoadmapStage(attachedHandle, chatId,
            snapshots[2].messageId, 'foreign-lease'), undefined);
        assert.equal(snapshots.every(event => !JSON.stringify(event).includes(activeLease)), true);
        finalStarted = true;
        yield { type: 'complete' as const, actualModelId: 'q4', text: 'I staged a proposed Roadmap for review.' };
    } };
    const backend = new ChatBackend(repository, { notifyChatEvent(event) {
        if (event.kind === 'roadmap-stage') { assert.equal(finalStarted, false); snapshots.push(event); }
    } }, models as never,
        composer, undefined, { ground: async () => ({ blocks: [], diagnostics: [] }) } as never,
        undefined, undefined, undefined, store);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        attachedHandle = projectHandle;
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'New project' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) throw new Error('Chat lease unavailable');
        activeLease = lease.token;
        const turn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: 'Create a complete development Roadmap for a playable 2D tower-defense game built using TypeScript and PixiJS.',
            context: [] });
        assert.ok(turn.proposal, turn.proposalError);
        assert.equal(await backend.readNativeRoadmapStage(projectHandle, chatId,
            snapshots[2].messageId, lease.token), undefined);
        assert.equal(turn.proposal.revision, 0);
        assert.equal(turn.proposal.ownerId, 'uninitialized');
        assert.equal(turn.proposal.operations?.length, 4);
        assert.equal(turn.proposal.preview?.entities.filter(item => item.after?.kind === 'phase').length, 2);
        assert.equal(turn.proposal.preview?.entities.filter(item => item.after?.kind === 'gate').length, 2);
        assert.equal(await store.gateIndexHash(root), null);
        assert.equal((await store.read(root)).revision, 0);
        const ids = turn.proposal.operations!.map(item => item.id);
        const review = await backend.reviewNativeRoadmap(projectHandle, chatId, lease.token,
            turn.proposal.id, ids, 'apply');
        const applied = await backend.decideNativeRoadmap(projectHandle, chatId, lease.token,
            turn.proposal.id, ids, 'apply', review.token);
        assert.equal(applied.revision, 1);
        const saved = await store.read(root) as { revision: number; phases: unknown[]; gates: unknown[] };
        assert.equal(saved.revision, 1);
        assert.equal(saved.phases.length, 2);
        assert.equal(saved.gates.length, 2);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('native stage cancellation invalidates the live observer without a canonical write', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-native-cancel-event-'));
    const store = new RoadmapStore(), repository = new ChatRepository();
    const chatId = randomUUID();
    const events: Extract<ChatEvent, { kind: 'roadmap-stage' }>[] = [];
    const composer = new ChatContextComposer({} as never, {} as never,
        { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
            inputsCurrent: async () => false } as never, repository, store);
    const model = { id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
        streaming: true, contextWindowTokens: 32768, maxInputTokens: 32768 } };
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [model] }] }),
    async *generate(_selection: unknown, request: { projectTools?: { execute(name: string, args: unknown): Promise<string> } }) {
        await request.projectTools!.execute('roadmap_stage', { version: 1, expectedRevision: 0,
            expectedSourceHash: null, expectedStage: 1, actions: [
                { type: 'phase.create', id: 'new:p', title: 'Phase', objective: 'Ship' }] });
        assert.equal(events.length, 1);
        const result = JSON.parse(await request.projectTools!.execute('roadmap_cancel', { version: 1 })) as {
            cancelled: boolean };
        assert.equal(result.cancelled, true);
        assert.equal(events.length, 2);
        assert.equal(events[1].snapshot, null);
        assert.equal(events[1].reason, 'cancelled');
        yield { type: 'complete' as const, actualModelId: 'q4', text: 'Cancelled the draft.' };
    } };
    const backend = new ChatBackend(repository, { notifyChatEvent(event) {
        if (event.kind === 'roadmap-stage') events.push(event);
    } }, models as never, composer, undefined,
    { ground: async () => ({ blocks: [], diagnostics: [] }) } as never,
    undefined, undefined, undefined, store);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Cancel' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        if (!lease.acquired) throw new Error('Chat lease unavailable');
        const turn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: 'Create a Roadmap for a tower-defense game.', context: [] });
        assert.equal(turn.proposal, undefined);
        assert.equal((await store.read(root)).revision, 0);
        assert.equal(await store.gateIndexHash(root), null);
        await assert.rejects(readFile(join(root, 'ROADMAP.md')), { code: 'ENOENT' });
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
