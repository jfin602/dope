import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapNativeStageOwner } from '../../packages/theia-extension/lib/node/roadmap-native-stage.js';
import { RoadmapGenerationNativeStage } from '../../packages/theia-extension/lib/node/roadmap-generation-native-stage.js';
import type { GenerationIdentity, GenerationPhase } from '../../packages/theia-extension/src/node/roadmap-generation-controller';

test('three serial Phases stage nine Gates and Criteria under one proposal without canonical writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-native-phase-'));
    try {
        const store = new RoadmapStore(), owner = new RoadmapNativeStageOwner(store);
        const before = await store.read(root), hash = await store.gateIndexHash(root);
        const identity: GenerationIdentity = { generationId: 'generation', root,
            projectId: before.projectId, revision: before.revision, sourceHash: null, indexHash: null,
            chatId: 'chat', turnId: 'turn', ownerId: before.projectId,
            model: { connectionId: 'local', modelId: 'q4', providerId: 'local',
                contextWindowTokens: 8192, reasoningControls: {} }, origin: 'trusted-user-chat' };
        const adapter = new RoadmapGenerationNativeStage(owner, 'lease', identity);
        const signal = new AbortController().signal;
        let proposalId = '';
        for (let n = 1; n <= 3; n++) {
            const phase: GenerationPhase = { title: `Phase ${n}`, objective: `Objective ${n}`,
                subcalls: 1, gates: Array.from({ length: 3 }, (_, gate) => ({
                    title: `Gate ${n}.${gate + 1}`, purpose: `Verify feature ${n}.${gate + 1}`,
                    criteria: [{ title: `Observation ${n}.${gate + 1}`,
                        expectedResult: `Feature ${n}.${gate + 1} appears in the running game` }] })) };
            assert.equal(adapter.validate(phase, identity, signal), true);
            assert.equal(await adapter.stage(phase, identity, signal), phase.title);
            const snapshot = await adapter.snapshot();
            assert.ok(snapshot);
            if (proposalId) assert.equal(snapshot.proposalId, proposalId);
            proposalId = snapshot.proposalId;
            assert.deepEqual(snapshot.counts, { phases: n, gates: n * 3, criteria: n * 3 });
            assert.equal(snapshot.operationIds.length, n * 4);
            assert.equal(snapshot.complete, false);
            assert.deepEqual(await store.read(root), before);
            assert.equal(await store.gateIndexHash(root), hash);
        }
        assert.equal(await adapter.complete(identity, signal), true);
        const snapshot = await adapter.snapshot();
        assert.equal(snapshot?.proposalId, proposalId);
        assert.equal(snapshot?.complete, true);
        const stage = owner.get('chat')!;
        assert.equal(stage.operations.length, 12);
        assert.equal(new Set(stage.operations.map(item => item.id)).size, 12);
        const phaseIds = new Set(stage.operations.filter(item => item.action.type === 'phase.create')
            .map(item => (item.action as { id: string }).id));
        assert.equal(phaseIds.size, 3);
        const gates = stage.operations.filter(item => item.action.type === 'gate.create')
            .map(item => item.action as { parentPhaseId: string; criteria: { id: string }[] });
        assert.equal(gates.length, 9);
        assert.ok(gates.every(gate => phaseIds.has(gate.parentPhaseId) && gate.criteria.length === 1));
        assert.equal(new Set(gates.flatMap(gate => gate.criteria.map(criterion => criterion.id))).size, 9);
        assert.deepEqual(await store.read(root), before);
        assert.equal(await store.gateIndexHash(root), hash);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('invalid nested content and cancelled stage cannot advance native proposal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-native-phase-negative-'));
    try {
        const store = new RoadmapStore(), owner = new RoadmapNativeStageOwner(store);
        const index = await store.read(root);
        const identity: GenerationIdentity = { generationId: 'generation', root,
            projectId: index.projectId, revision: 0, sourceHash: null, indexHash: null,
            chatId: 'chat', turnId: 'turn', ownerId: index.projectId,
            model: { connectionId: 'local', modelId: 'q4', providerId: 'local',
                contextWindowTokens: 8192, reasoningControls: {} }, origin: 'trusted-user-chat' };
        const adapter = new RoadmapGenerationNativeStage(owner, 'lease', identity);
        const phase: GenerationPhase = { title: 'First', objective: 'Build first', subcalls: 1,
            gates: [{ title: 'Gate', purpose: 'Verify first', criteria: [
                { title: 'Observable', expectedResult: 'A visible result' }] }] };
        const signal = new AbortController().signal;
        assert.equal(adapter.validate({ ...phase, gates: [{ ...phase.gates[0], criteria: [] }] }, identity, signal), false);
        assert.equal(adapter.validate({ ...phase, gates: [phase.gates[0], phase.gates[0]] }, identity, signal), false);
        assert.equal(adapter.validate(phase, { ...identity, projectId: 'foreign' }, signal), false);
        const cancelled = new AbortController(); cancelled.abort();
        await assert.rejects(adapter.stage(phase, identity, cancelled.signal), /INVALID_PHASE/);
        assert.equal(owner.get('chat'), undefined);
        await adapter.stage(phase, identity, signal);
        assert.equal(adapter.validate(phase, identity, signal), false);
        await assert.rejects(adapter.stage({ ...phase, title: 'Second',
            gates: [{ ...phase.gates[0], criteria: [] }] }, identity, signal), /INVALID_PHASE/);
        assert.equal(owner.get('chat')?.operations.length, 2);
        assert.deepEqual(await store.read(root), index);
    } finally { await rm(root, { recursive: true, force: true }); }
});
