import assert from 'node:assert/strict';
import test from 'node:test';
import { RoadmapGenerationController } from '../../packages/theia-extension/lib/node/roadmap-generation-controller.js';
import type { GenerationDependencies, GenerationLimits, GenerationPhase } from '../../packages/theia-extension/src/node/roadmap-generation-controller';

const identity = { root: '/tmp/disposable-roadmap', projectId: 'project-1', revision: 0,
    sourceHash: null, indexHash: null, chatId: 'chat-1', turnId: 'turn-1', ownerId: 'project-1',
    model: { connectionId: 'local-1', modelId: 'q4', providerId: 'local' as const,
        contextWindowTokens: 8192, reasoningControls: { 'reasoning.effort': 'on' } },
    origin: 'trusted-user-chat' as const };
const phase = (n: number): GenerationPhase => ({ title: `Phase ${n}`, objective: `Objective ${n}`,
    subcalls: 1, gates: [{ title: `Gate ${n}`, purpose: 'Purpose',
        criteria: [{ title: 'Observable', expectedResult: 'Observed' }] }] });
const limits: GenerationLimits = { maxPhases: 5, maxGatesPerPhase: 3, maxSubcallsPerPhase: 2,
    maxCalls: 8, maxTokens: 1000, idleMs: 1000, deadlineMs: 5000, maxRetries: 1 };

function stage() {
    let count = 0, complete = 0;
    const owner: NonNullable<GenerationDependencies['stage']> = {
        validate: async () => true,
        stage: async item => { count++; return item.title; },
        complete: async () => { complete++; return true; },
        snapshot: async () => ({ proposalId: 'one-proposal', sequence: count,
            counts: { phases: count, gates: count, criteria: count } })
    };
    return { owner, get count() { return count; }, get complete() { return complete; } };
}

test('one execution stages two Phases before receipts and finishes one proposal', async () => {
    const native = stage();
    let executions = 0;
    const controller = new RoadmapGenerationController(identity, 'Build exactly 2 Phases', '{}', {
        current: async () => true, stage: native.owner,
        call: async input => {
            executions++;
            await input.admitTool();
            const first = await input.submitPhase(1, phase(1));
            assert.equal(native.count, 1);
            assert.deepEqual([first.proposalId, first.stageSequence, first.phase], ['one-proposal', 1, 1]);
            await input.admitTool();
            const second = await input.submitPhase(2, phase(2));
            assert.equal(native.count, 2);
            assert.deepEqual([second.proposalId, second.stageSequence, second.phase], ['one-proposal', 2, 2]);
            await input.admitTool();
            await input.finish(['Uncertain requirement needs owner review']);
            return { usage: { totalTokens: 27, finishReason: 'stop' } };
        }
    }, limits);
    const result = await controller.run();
    assert.equal(result.state, 'review-ready');
    assert.equal(executions, 1);
    assert.deepEqual([result.phases, result.calls, result.tokens], [2, 3, 27]);
    assert.equal(native.complete, 1);
    assert.equal(result.scopeLedger.staged.length, 2);
    assert.ok(result.metrics.timeToFirstStageMs !== undefined);
    assert.ok(result.metrics.timeToReviewMs !== undefined);
    await assert.rejects(controller.run(), /already started/);
});

test('duplicate and skipped Phase attempts do not stage a second Phase', async () => {
    const native = stage();
    const result = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true, stage: native.owner,
        call: async input => {
            await input.admitTool(); await input.submitPhase(1, phase(1));
            await input.admitTool();
            await assert.rejects(input.submitPhase(1, phase(1)), /PHASE_ORDER/);
            input.rejectTool();
            await input.admitTool();
            await assert.rejects(input.submitPhase(3, phase(3)), /PHASE_ORDER/);
            input.rejectTool();
            return { usage: { totalTokens: 3 } };
        }
    }, limits).run();
    assert.equal(result.state, 'incomplete');
    assert.equal(native.count, 1);
    assert.equal(result.phases, 1);
    assert.equal(native.complete, 0);
    assert.equal(result.metrics.retries, 2);
});

test('failed StageOwner acknowledgement cannot advance the expected Phase', async () => {
    const native = stage();
    const result = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true, stage: { ...native.owner,
            stage: async () => { throw new Error('STAGE_OWNER_FAILED'); } },
        call: async input => {
            await input.admitTool();
            await assert.rejects(input.submitPhase(1, phase(1)), /STAGE_OWNER_FAILED/);
            input.rejectTool();
            return { usage: { totalTokens: 3 } };
        }
    }, limits).run();
    assert.equal(result.state, 'incomplete');
    assert.equal(result.phases, 0);
    assert.equal(native.complete, 0);
});

test('source drift rejects the next tool before staging', async () => {
    const native = stage();
    let current = true;
    const result = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => current, stage: native.owner,
        call: async input => {
            await input.admitTool(); await input.submitPhase(1, phase(1));
            current = false;
            await assert.rejects(input.admitTool(), /STALE/);
            return {};
        }
    }, limits).run();
    assert.equal(result.state, 'stale');
    assert.equal(native.count, 1);
    assert.equal(native.complete, 0);
});

test('finish before any Phase is denied and cannot expose a proposal', async () => {
    const native = stage();
    const result = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true, stage: native.owner,
        call: async input => {
            await input.admitTool();
            await assert.rejects(input.finish([]), /FINISH_DENIED/);
            input.rejectTool();
            return {};
        }
    }, limits).run();
    assert.equal(result.state, 'incomplete');
    assert.equal(native.complete, 0);
});

test('idle and absolute deadlines stop a live provider without unlimited thinking', async () => {
    const native = stage();
    const idle = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true, stage: native.owner,
        call: async () => new Promise(() => undefined)
    }, { ...limits, idleMs: 12 }).run();
    assert.equal(idle.state, 'failed');
    assert.match(idle.events.at(-1)?.diagnostic ?? '', /idle timeout/);
    let timer: ReturnType<typeof setInterval> | undefined;
    const absolute = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true, stage: native.owner,
        call: input => new Promise(() => {
            let sequence = 0;
            timer = setInterval(() => input.report({ generationId: input.identity.generationId,
                call: 1, sequence: ++sequence, kind: 'reasoning', text: 'provider output' }), 5);
        })
    }, { ...limits, idleMs: 20, deadlineMs: 60 }).run();
    if (timer) clearInterval(timer);
    assert.equal(absolute.state, 'cancelled');
    assert.equal(native.count, 0);
});

test('missing native stage makes zero inference calls', async () => {
    let calls = 0;
    const result = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true, call: async () => { calls++; return {}; }
    }, limits).run();
    assert.equal(result.state, 'incomplete');
    assert.equal(calls, 0);
});
