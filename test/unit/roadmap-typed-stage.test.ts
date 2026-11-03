import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { parseRoadmapMarkers, parseTypedRoadmapDraft } from '../../packages/theia-extension/lib/node/roadmap-local-model.js';
import { RoadmapNativeStageOwner } from '../../packages/theia-extension/lib/node/roadmap-native-stage.js';
import { stageTypedRoadmapDraft } from '../../packages/theia-extension/lib/node/roadmap-typed-stage.js';

const candidate = () => parseTypedRoadmapDraft(JSON.stringify({ type: 'roadmap-draft', schemaVersion: 1,
    phases: ['Path', 'Combat', 'Waves', 'Economy', 'Defeat'].map((title, at) => ({ title,
        objective: `Deliver ${title.toLowerCase()} behavior`, ...(at ? { dependsOn: [at] } : {}),
        gates: [1, 2].map(number => ({ title: `${title} Gate ${number}`,
            purpose: `Verify ${title.toLowerCase()} behavior`, criteria: [1, 2].map(criterion => ({
                title: `${title} check ${number}.${criterion}`,
                expectedResult: `A playable scenario shows ${title.toLowerCase()} result ${number}.${criterion}` })) })) }))
}), 'stop');

test('RM1 candidate uses the existing noncanonical stage converter without invented dependencies', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-marker-stage-'));
    try {
        const owner = new RoadmapNativeStageOwner(new RoadmapStore());
        const context = { root, projectId: 'uninitialized', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const marker = ['RM1', 'P|Path|Build a route', 'G|Waypoints|Move enemies',
            'C|Enemies visit every waypoint in order', 'P|Combat|Build one tower',
            'G|Projectiles|Attack enemies', 'C|Projectiles damage enemies on contact', 'END'].join('\n');
        const stage = await stageTypedRoadmapDraft(owner, context, parseRoadmapMarkers(marker, 'stop'));
        const snapshot = await owner.snapshot(context);
        assert.deepEqual(snapshot?.counts, { phases: 2, gates: 2, criteria: 2 });
        assert.equal(stage.operations.length, 4);
        assert.deepEqual(stage.operations.map(operation => operation.action.type),
            ['phase.create', 'gate.create', 'phase.create', 'gate.create']);
        await assert.rejects(readFile(join(root, '.dope', 'roadmap.json')), { code: 'ENOENT' });
        await assert.rejects(readFile(join(root, 'ROADMAP.md')), { code: 'ENOENT' });
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('typed five-Phase draft becomes one complete existing proposal with zero pre-Apply writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-typed-stage-'));
    try {
        const store = new RoadmapStore(), owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'uninitialized', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const stage = await stageTypedRoadmapDraft(owner, context, candidate());
        const snapshot = await owner.snapshot(context);
        assert.equal(snapshot?.proposalId, stage.id);
        assert.equal(snapshot?.complete, true);
        assert.deepEqual(snapshot?.counts, { phases: 5, gates: 10, criteria: 20 });
        assert.equal(snapshot?.operationIds.length, 19);
        assert.equal(snapshot?.preview.entities.length, 35);
        assert.equal(new Set(snapshot?.entityIds).size, 35);
        assert.equal((await store.read(root)).revision, 0);
        assert.equal(await store.gateIndexHash(root), null);
        await assert.rejects(readFile(join(root, '.dope', 'roadmap.json')), { code: 'ENOENT' });
        await assert.rejects(readFile(join(root, 'ROADMAP.md')), { code: 'ENOENT' });
        await assert.rejects(owner.review(context, [stage.operations[0].id], 'reject'), /ROADMAP_REVIEW_DEPENDENT/);
        await assert.rejects(owner.review(context, [stage.operations[2].id], 'apply'), /Missing Roadmap Phase/);
        const firstIds = [stage.operations[0].id, stage.operations[1].id, stage.operations[2].id];
        const review = await owner.review(context, firstIds, 'apply');
        const applied = await owner.decide(context, review.token, firstIds, 'apply');
        assert.equal(applied.revision, 1);
        const saved = await store.read(root);
        assert.equal(saved.revision, 1);
        assert.equal((saved as { phases: unknown[] }).phases.length, 1);
        assert.equal((saved as { gates: unknown[] }).gates.length, 2);
        assert.deepEqual((await store.listRevisions(root, saved.projectId)).revisions.map(item => item.revision), [1]);
        await assert.rejects(owner.decide(context, review.token, firstIds, 'apply'), /APPROVAL_UNAVAILABLE/);
        const remaining = stage.operations.filter(item => item.status === 'Pending').map(item => item.id);
        const second = await owner.review(context, remaining, 'apply');
        assert.equal(second.before.revision, 1);
        assert.equal((await owner.decide(context, second.token, remaining, 'apply')).revision, 2);
        assert.deepEqual((await store.listRevisions(root, saved.projectId)).revisions.map(item => item.revision), [2, 1]);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('typed staging rejects foreign, competing, cancelled and stale owners without canonical writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-typed-stage-negative-'));
    try {
        const store = new RoadmapStore(), owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'uninitialized', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        await assert.rejects(stageTypedRoadmapDraft(owner, { ...context, projectId: 'foreign' }, candidate()), /OWNER_CHANGED/);
        let active = true;
        await assert.rejects(stageTypedRoadmapDraft(owner, context, candidate(), () => {
            if (!active) throw new Error('cancelled');
            active = false;
        }), /cancelled/);
        assert.equal(owner.get('chat'), undefined);
        let checks = 0;
        await assert.rejects(stageTypedRoadmapDraft(owner, context, candidate(), () => {
            if (++checks === 3) throw new Error('cancelled after first batch');
        }), /cancelled after first batch/);
        assert.equal(owner.get('chat'), undefined);
        assert.equal(await store.gateIndexHash(root), null);
        await assert.rejects(stageTypedRoadmapDraft(owner, context, {
            ...candidate(), draft: { ...candidate().draft, projectId: 'forged' } } as never), /projectId/);
        const stage = await stageTypedRoadmapDraft(owner, context, candidate());
        await assert.rejects(stageTypedRoadmapDraft(owner, context, candidate()), /OWNER_NOT_EMPTY/);
        const foreignRoot = await mkdtemp(join(tmpdir(), 'dope-foreign-root-'));
        try {
            await assert.rejects(stageTypedRoadmapDraft(owner, { ...context, root: foreignRoot },
                candidate()), /STAGE_STALE/);
        } finally { await rm(foreignRoot, { recursive: true, force: true }); }
        assert.equal(await owner.snapshot({ ...context, chatId: 'other' }), undefined);
        await assert.rejects(owner.snapshot({ ...context, lease: 'foreign' }), /STAGE_STALE/);
        owner.get('chat')!.expires = Date.now() - 1;
        await assert.rejects(owner.review(context, [stage.operations[0].id], 'apply'), /STAGE_STALE/);
        assert.equal(await store.gateIndexHash(root), null);
        assert.equal((await store.read(root)).revision, 0);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('protected current-turn Chat uses one tool-free typed answer and persists the existing pending proposal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-typed-chat-'));
    const store = new RoadmapStore(), repository = new ChatRepository();
    const chatId = randomUUID();
    const composer = new ChatContextComposer({} as never, {} as never,
        { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
            inputsCurrent: async () => false } as never, repository, store);
    let calls = 0;
    const model = { id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
        streaming: true, contextWindowTokens: 32768, maxInputTokens: 32768 } };
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true,
        providerId: 'local', models: [model] }] }),
        async *generate(_selection: unknown, request: { projectTools?: unknown; maxOutputTokens?: number;
            messages: { content: string }[] }) {
            calls++;
            assert.equal(request.projectTools, undefined);
            assert.equal(request.maxOutputTokens, 4096);
            assert.match(JSON.stringify(request.messages), /RM1/);
            assert.doesNotMatch(JSON.stringify(request.messages), /"type":"roadmap-draft"/);
            const draft = candidate().draft;
            yield { type: 'complete' as const, actualModelId: 'q4', finishReason: 'stop',
                usage: { tokenMeasurement: 'unavailable' as const },
                text: ['RM1', ...draft.phases.flatMap(phase => [
                    `P|${phase.title}|${phase.objective}`, ...phase.gates.flatMap(gate => [
                        `G|${gate.title}|${gate.purpose}`,
                        ...gate.criteria.map(criterion => `C|${criterion.expectedResult}`)
                    ])
                ]), 'END'].join('\n') };
        } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
        composer, undefined, { ground: async () => ({ blocks: [], diagnostics: [] }) } as never,
        undefined, undefined, undefined, store);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Typed' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) throw new Error('Chat lease unavailable');
        const result = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'q4' },
            content: 'Create a complete development Roadmap for a tower-defense game.', context: [] });
        assert.equal(calls, 1);
        assert.ok(result.proposal, result.proposalError);
        assert.equal(result.proposal.operations?.length, 15);
        assert.equal(result.proposal.preview?.totalChanged, 35);
        assert.equal((await store.read(root)).revision, 0);
        assert.equal(await store.gateIndexHash(root), null);
        const saved = (await repository.read(root)).chats.find(chat => chat.id === chatId)!.messages
            .find(message => message.role === 'assistant')!;
        assert.equal(saved.role, 'assistant');
        assert.equal(saved.planningActivity?.status, 'pending');
        assert.equal(saved.planningActivity?.proposalId, result.proposal.id);
        assert.match(saved.planningActivity?.diagnostic ?? '', /finishReason=stop.*markerEND=yes.*reasoningTokens=unavailable/);
        assert.equal(saved.execution.finishReason, 'stop');
        assert.equal(saved.execution.tokenUsage?.tokenMeasurement, 'unavailable');
        assert.equal(saved.execution.toolEvents?.length ?? 0, 0);
        const ids = result.proposal.operations!.map(item => item.id);
        const review = await backend.reviewNativeRoadmap(projectHandle, chatId, lease.token,
            result.proposal.id, ids, 'apply');
        const applied = await backend.decideNativeRoadmap(projectHandle, chatId, lease.token,
            result.proposal.id, ids, 'apply', review.token);
        assert.equal(applied.revision, 1);
        assert.deepEqual((await store.listRevisions(root, (await store.read(root)).projectId)).revisions
            .map(item => item.revision), [1]);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('explicit and Interactive marker creation send identical trusted instructions without legacy history or tools', async () => {
    const outbound: { role: string; content: string }[][] = [];
    for (const following of [false, true]) {
        const root = await mkdtemp(join(tmpdir(), 'dope-marker-prompt-'));
        const store = new RoadmapStore(), repository = new ChatRepository(), chatId = randomUUID();
        const composer = new ChatContextComposer({} as never, {} as never,
            { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
                inputsCurrent: async () => false } as never, repository, store);
        const model = { id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
            streaming: true, contextWindowTokens: 32768, maxInputTokens: 32768 } };
        const selection = { connectionId: 'local', modelId: 'q4' };
        const models = { list: async () => ({ connections: [{ id: 'local', ready: true,
            providerId: 'local', models: [model] }] }),
            async *generate(_selection: unknown, request: { messages: { role: string; content: string }[];
                projectTools?: unknown }) {
                assert.equal(request.projectTools, undefined);
                outbound.push(request.messages);
                yield { type: 'complete' as const, text: 'obsolete JSON', finishReason: 'stop' };
            } };
        const routing = { resolve: async () => ({ resolution: { selectedTarget: selection },
            inventory: { models: [{ connectionId: 'local', providerModelKey: 'q4', locality: 'local' }] } }),
            async *generate(request: { conversation(target: typeof selection): Promise<{
                messages: { role: string; content: string }[]; projectTools?: unknown }> }) {
                const turn = await request.conversation(selection);
                assert.equal(turn.projectTools, undefined);
                outbound.push(turn.messages);
                yield { type: 'complete' as const, text: 'obsolete JSON', finishReason: 'stop' };
            } };
        const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
            composer, routing as never, { ground: async () => ({ blocks: [], diagnostics: [] }) } as never,
            undefined, undefined, undefined, store);
        try {
            const { projectHandle } = await backend.attach(pathToFileURL(root).href);
            await backend.mutate({ projectHandle, expectedRevision: 0,
                operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Marker prompt' } });
            const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
            assert.equal(lease.acquired, true);
            if (!lease.acquired) throw new Error('Chat lease unavailable');
            await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
                ...(following ? {} : { selectedModel: selection }),
                content: '/roadmap Create a complete tower-defense Roadmap. Do not use tools. ' +
                    'Treat "gate.create" and "JSON" as quoted technical terms, not output instructions.',
                context: [] }), /RM1 line 1/);
            assert.equal((await store.read(root)).revision, 0);
            await assert.rejects(readFile(join(root, '.dope', 'roadmap.json')), { code: 'ENOENT' });
        } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
    }
    assert.equal(outbound.length, 2);
    assert.deepEqual(outbound[0], outbound[1]);
    const trusted = outbound[0].filter(message => message.role === 'system').map(message => message.content);
    assert.equal(trusted.filter(message => message.includes('Roadmap Markers v1')).length, 1);
    assert.doesNotMatch(trusted.join('\n'), /roadmap_(?:read|stage)|gate\.create|strict JSON|new:\d|bounded batches/);
});

test('protected marker failures save bounded diagnostics without a proposal or Roadmap write', async () => {
    for (const mode of ['missing-end', 'length', 'reasoning-only', 'oversized'] as const) {
        const root = await mkdtemp(join(tmpdir(), `dope-marker-${mode}-`));
        const store = new RoadmapStore(), repository = new ChatRepository();
        const chatId = randomUUID();
        const composer = new ChatContextComposer({} as never, {} as never,
            { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
                inputsCurrent: async () => false } as never, repository, store);
        const model = { id: 'q4', label: 'Q4', usable: true, capabilities: { conversationalText: true,
            streaming: true, contextWindowTokens: 32768, maxInputTokens: 32768 } };
        const models = { list: async () => ({ connections: [{ id: 'local', ready: true,
            providerId: 'local', models: [model] }] }),
            async *generate() {
                if (mode === 'reasoning-only') {
                    yield { type: 'activity' as const, kind: 'thinking' as const, text: 'An outline without final text' };
                    return;
                }
                const marker = 'RM1\nP|Path|Build a path\nG|Waypoints|Move enemies\n' +
                    'C|Enemies visit waypoints in order\nP|Combat|Build a tower\n' +
                    'G|Attack|Damage enemies\nC|Projectiles damage enemies\nEND';
                yield { type: 'complete' as const,
                    text: mode === 'missing-end' ? marker.slice(0, -3) :
                        mode === 'oversized' ? marker + 'x'.repeat(32768) : marker,
                    finishReason: mode === 'length' ? 'length' : 'stop',
                    usage: { tokenMeasurement: 'unavailable' as const } };
            } };
        const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
            composer, undefined, { ground: async () => ({ blocks: [], diagnostics: [] }) } as never,
            undefined, undefined, undefined, store);
        try {
            const { projectHandle } = await backend.attach(pathToFileURL(root).href);
            await backend.mutate({ projectHandle, expectedRevision: 0,
                operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Marker negative' } });
            const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
            assert.equal(lease.acquired, true);
            if (!lease.acquired) throw new Error('Chat lease unavailable');
            await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
                selectedModel: { connectionId: 'local', modelId: 'q4' },
                content: '/roadmap Create a complete development Roadmap', context: [] }));
            const saved = (await repository.read(root)).chats.find(chat => chat.id === chatId)!.messages
                .find(message => message.role === 'assistant')!;
            assert.equal(saved.execution.status, 'failed', mode);
            assert.match(saved.execution.failure ?? '', /RM1 completion:.*reasoningTokens=unavailable/, mode);
            assert.equal(saved.planningActivity?.status, 'failed', mode);
            assert.equal(saved.planningActivity?.proposalId, undefined, mode);
            assert.equal((await store.read(root)).revision, 0, mode);
            assert.equal(await store.gateIndexHash(root), null, mode);
            await assert.rejects(readFile(join(root, '.dope', 'roadmap.json')), { code: 'ENOENT' });
            await assert.rejects(readFile(join(root, 'ROADMAP.md')), { code: 'ENOENT' });
        } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
    }
});

test('two competing typed creation proposals cannot both initialize a revision-zero Roadmap', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-typed-race-'));
    try {
        const store = new RoadmapStore(), owner = new RoadmapNativeStageOwner(store);
        const first = { root, projectId: 'uninitialized', chatId: 'first', turnId: 'turn-1', lease: 'lease-1' };
        const second = { ...first, chatId: 'second', turnId: 'turn-2', lease: 'lease-2' };
        const a = await stageTypedRoadmapDraft(owner, first, candidate());
        const b = await stageTypedRoadmapDraft(owner, second, candidate());
        assert.notEqual(a.id, b.id);
        assert.equal(await store.gateIndexHash(root), null);
        const ids = a.operations.map(item => item.id);
        const review = await owner.review(first, ids, 'apply');
        assert.equal((await owner.decide(first, review.token, ids, 'apply')).revision, 1);
        await assert.rejects(owner.review(second, b.operations.map(item => item.id), 'apply'),
            /OWNER_CHANGED|STAGE_STALE/);
        assert.equal((await store.read(root)).revision, 1);
    } finally { await rm(root, { recursive: true, force: true }); }
});
