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

test('controller strictly serializes validated phases and retains bounded scope ledger', async () => {
    let inFlight = 0, peak = 0, callCount = 0;
    let lateReport: (() => void) | undefined;
    const ledgers: readonly string[][] = [];
    const mutableLedgers = ledgers as string[][];
    const deps: GenerationDependencies = {
        current: async bound => bound.projectId === 'project-1',
        call: async input => {
            inFlight++; peak = Math.max(peak, inFlight);
            const callNumber = callCount + 1;
            input.report({ generationId: input.identity.generationId, call: callNumber,
                sequence: 1, kind: 'reasoning', text: 'working' });
            input.report({ generationId: input.identity.generationId, call: callNumber,
                sequence: 1, kind: 'reasoning', text: 'duplicate' });
            input.report({ generationId: 'foreign', call: callNumber,
                sequence: 2, kind: 'reasoning', text: 'foreign' });
            lateReport = () => input.report({ generationId: input.identity.generationId,
                call: callNumber, sequence: 2, kind: 'final', text: 'late' });
            assert.equal(input.scope, 'Build\nseveral phases');
            assert.equal(input.identity.model.providerId, 'local');
            mutableLedgers.push([...input.ledger]);
            await new Promise(resolve => setTimeout(resolve, 1));
            inFlight--; callCount++;
            return callCount === 4 ? { done: true, usage: { totalTokens: 3, finishReason: 'stop' } } :
                { done: false, phase: phase(callCount), usage: { totalTokens: 3,
                    finishReason: 'tool-call', reasoning: 'captured' } };
        },
        stage: { validate: async () => true, stage: async item => item.title,
            complete: async () => true }
    };
    const controller = new RoadmapGenerationController(identity, 'Build\nseveral phases',
        '{"projectId":"project-1"}', deps, limits);
    const result = await controller.run();
    assert.equal(result.state, 'review-ready');
    assert.equal(result.phases, 3);
    assert.equal(result.calls, 4);
    assert.equal(result.tokens, 12);
    assert.equal(peak, 1);
    const summary = (n: number) => `Phase ${n}; Gates: Gate ${n}`;
    assert.deepEqual(ledgers, [[], [summary(1)], [summary(1), summary(2)],
        [summary(1), summary(2), summary(3)]]);
    assert.deepEqual(result.events.map(event => event.sequence),
        result.events.map((_, index) => index + 1));
    assert.ok(result.events.every(event => event.generationId === result.identity.generationId));
    assert.deepEqual(result.usage[0], { totalTokens: 3, finishReason: 'tool-call',
        reasoning: 'captured' });
    assert.equal(result.providerProgress.length, 4);
    lateReport?.();
    assert.equal(result.providerProgress.length, 4);
    await assert.rejects(controller.run(), /already started/);
});

test('without a native stage the controller makes zero inference calls and reports incomplete', async () => {
    let calls = 0;
    const result = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true, call: async () => { calls++; return { done: true }; }
    }, limits).run();
    assert.equal(result.state, 'incomplete');
    assert.equal(calls, 0);
    assert.equal(result.calls, 0);
});

test('cancellation discards late model result and schedules no stage or next phase', async () => {
    let resolve!: (value: { done: boolean; phase: GenerationPhase }) => void;
    let calls = 0, stages = 0;
    const controller = new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true,
        call: async input => {
            calls++;
            input.report({ generationId: input.identity.generationId, call: 1,
                sequence: 1, kind: 'reasoning', text: 'provider output' });
            return new Promise(done => { resolve = done; });
        },
        stage: { validate: async () => { stages++; return true; }, stage: async () => 'x',
            complete: async () => true }
    }, limits);
    const running = controller.run();
    await new Promise(resolve => setTimeout(resolve, 1));
    controller.cancel();
    resolve({ done: false, phase: phase(1) });
    const result = await running;
    assert.equal(result.state, 'cancelled');
    assert.equal(calls, 1);
    assert.equal(stages, 0);
    assert.equal(result.providerProgress.length, 1);
    assert.equal(result.events.at(-1)?.state, 'cancelled');
});

test('drift and exhausted retries terminate before stage or following call', async () => {
    let calls = 0, stages = 0, current = true;
    const deps: GenerationDependencies = {
        current: async () => current,
        call: async () => { calls++; current = false; return { done: false, phase: phase(1) }; },
        stage: { validate: async () => { stages++; return true; }, stage: async () => 'x',
            complete: async () => true }
    };
    const stale = await new RoadmapGenerationController(identity, 'Scope', '{}', deps, limits).run();
    assert.equal(stale.state, 'stale');
    assert.equal(calls, 1);
    assert.equal(stages, 0);
    calls = 0;
    const failed = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true,
        call: async () => { calls++; return { done: false, usage: { totalTokens: 1 } }; }, stage: deps.stage
    }, limits).run();
    assert.equal(failed.state, 'incomplete');
    assert.equal(calls, 2);
    assert.equal(failed.phases, 0);
});

test('idle timeout stops a pending call and ignores its delayed completion', async () => {
    let resolve!: (value: { done: boolean; phase: GenerationPhase }) => void;
    let stages = 0;
    const controller = new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true,
        call: async () => new Promise(done => { resolve = done; }),
        stage: { validate: async () => true, stage: async () => { stages++; return 'x'; },
            complete: async () => true }
    }, { ...limits, idleMs: 10 });
    const result = await controller.run();
    resolve({ done: false, phase: phase(1) });
    await new Promise(resolve => setTimeout(resolve, 1));
    assert.equal(result.state, 'failed');
    assert.equal(stages, 0);
    assert.equal(result.calls, 1);
});

test('genuine provider progress keeps a Phase call alive beyond the idle interval', async () => {
    let calls = 0, stages = 0;
    const result = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true,
        call: async input => {
            calls++;
            if (calls === 2) return { done: true, usage: { totalTokens: 2 } };
            for (let sequence = 1; sequence <= 6; sequence++) {
                await new Promise(resolve => setTimeout(resolve, 20));
                input.report({ generationId: input.identity.generationId, call: calls,
                    sequence, kind: 'reasoning', text: 'real provider output' });
            }
            return { done: false, phase: phase(1), usage: { totalTokens: 2 } };
        },
        stage: { validate: async () => true, stage: async () => { stages++; return 'Phase 1'; },
            complete: async () => true }
    }, { ...limits, idleMs: 55, deadlineMs: 500 }).run();
    assert.equal(result.state, 'review-ready');
    assert.equal(result.phases, 1);
    assert.equal(stages, 1);
    assert.equal(result.providerProgress.length, 6);
    assert.ok(result.metrics.durationMs > 55);
});

test('continuous provider output cannot evade the absolute generation deadline', async () => {
    let stages = 0;
    let interval: ReturnType<typeof setInterval> | undefined;
    const result = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true,
        call: input => new Promise(() => {
            let sequence = 0;
            interval = setInterval(() => input.report({ generationId: input.identity.generationId,
                call: 1, sequence: ++sequence, kind: 'tool-argument', text: 'provider tool delta' }), 10);
        }),
        stage: { validate: async () => { stages++; return true; }, stage: async () => 'x',
            complete: async () => true }
    }, { ...limits, idleMs: 40, deadlineMs: 110 }).run();
    if (interval) clearInterval(interval);
    assert.equal(result.state, 'cancelled');
    assert.match(result.events.at(-1)?.diagnostic ?? '', /deadline exceeded/);
    assert.ok(result.providerProgress.length > 1);
    assert.equal(stages, 0);
});

test('synthetic or invalid progress cannot extend an idle Phase call', async () => {
    let stages = 0;
    const result = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true,
        call: input => new Promise(() => {
            let sequence = 0;
            const timer = setInterval(() => {
                if (input.signal.aborted) { clearInterval(timer); return; }
                input.report({ generationId: input.identity.generationId, call: 1,
                    sequence: ++sequence, kind: 'reasoning', text: ' ' });
            }, 5);
        }),
        stage: { validate: async () => { stages++; return true; }, stage: async () => 'x',
            complete: async () => true }
    }, { ...limits, idleMs: 35, deadlineMs: 300 }).run();
    assert.equal(result.state, 'failed');
    assert.match(result.events.at(-1)?.diagnostic ?? '', /idle timeout/);
    assert.equal(result.providerProgress.length, 0);
    assert.equal(stages, 0);
});

test('unknown provider usage stays unknown and conservatively consumes token allowance', async () => {
    let calls = 0;
    const result = await new RoadmapGenerationController(identity, 'Scope', '{}', {
        current: async () => true,
        call: async () => { calls++; return { done: false, phase: phase(calls) }; },
        stage: { validate: async () => true, stage: async () => 'reference', complete: async () => true }
    }, limits).run();
    assert.equal(result.state, 'incomplete');
    assert.equal(result.tokens, 'unknown');
    assert.equal(calls, 1);
    assert.equal(result.phases, 1);
});

test('one malformed Phase receives targeted correction without restarting accepted work', async () => {
    const seen: { phase: number; correction?: string; ledger: readonly string[] }[] = [];
    const staged: string[] = [];
    const result = await new RoadmapGenerationController(identity,
        'Enemy spawn; towers and cooldown; persistent base health', '{}', {
            current: async () => true,
            call: async input => {
                seen.push({ phase: input.phase, correction: input.correction, ledger: input.ledger });
                if (seen.length === 1) return { done: false, phase: phase(1), usage: { totalTokens: 10 } };
                if (seen.length === 2) return { done: false, invalidReason: 'Gate is missing',
                    usage: { totalTokens: 10 } };
                if (seen.length === 3) return { done: false, phase: phase(2),
                    usage: { totalTokens: 10 } };
                return { done: true, unresolved: ['Persistent base health needs owner review'],
                    usage: { totalTokens: 10 } };
            },
            stage: { validate: async () => true,
                stage: async item => { staged.push(item.title); return item.title; },
                complete: async () => true }
        }, limits).run();
    assert.equal(result.state, 'review-ready');
    assert.deepEqual(staged, ['Phase 1', 'Phase 2']);
    assert.deepEqual(seen.map(item => item.phase), [1, 2, 2, 3]);
    assert.equal(seen[2].correction, 'Gate is missing');
    assert.deepEqual(seen[2].ledger, ['Phase 1; Gates: Gate 1']);
    assert.deepEqual(result.scopeLedger.requirements,
        ['Enemy spawn', 'towers and cooldown', 'persistent base health']);
    assert.equal(result.scopeLedger.semanticCoverage, 'unverified');
    assert.deepEqual(result.scopeLedger.unresolved, ['Persistent base health needs owner review']);
    assert.equal(result.scopeLedger.staged.length, 2);
    assert.equal(result.metrics.retries, 1);
    assert.ok(result.metrics.timeToFirstStageMs !== undefined);
    assert.ok(result.metrics.timeToReviewMs !== undefined);
    assert.equal(result.usage.length, 4);
});

test('a repeated malformed Phase leaves a bounded inspectable partial draft without review authority', async () => {
    let calls = 0, completes = 0;
    const result = await new RoadmapGenerationController(identity, 'Build phases', '{}', {
        current: async () => true,
        call: async () => { calls++; return calls === 1 ?
            { done: false, phase: phase(1), usage: { totalTokens: 1 } } :
            { done: false, invalidReason: 'Missing Gate', usage: { totalTokens: 1 } }; },
        stage: { validate: async () => true, stage: async item => item.title,
            complete: async () => { completes++; return true; } }
    }, limits).run();
    assert.equal(result.state, 'incomplete');
    assert.equal(result.phases, 1);
    assert.equal(result.calls, 3);
    assert.equal(result.metrics.retries, 1);
    assert.equal(result.scopeLedger.staged[0].gates[0].criteria[0], 'Observed');
    assert.equal(completes, 0);
});

test('a fresh command revalidates a partial and can finish at the exact Phase ceiling', async () => {
    const staged: string[] = [];
    const calls: number[] = [];
    const constrained = { ...limits, maxPhases: 2 };
    const result = await new RoadmapGenerationController(identity, 'Enemy spawn; base health', '{}', {
        current: async () => true,
        call: async input => { calls.push(input.phase); return input.phase === 2 ?
            { done: false, phase: phase(2), usage: { totalTokens: 2 } } :
            { done: true, usage: { totalTokens: 2 } }; },
        stage: { validate: async () => true, stage: async item => {
            staged.push(item.title); return item.title; }, complete: async () => true }
    }, constrained, [phase(1)]).run();
    assert.equal(result.state, 'review-ready');
    assert.deepEqual(calls, [2, 3]);
    assert.deepEqual(staged, ['Phase 1', 'Phase 2']);
    assert.equal(result.calls, 2);
    assert.equal(result.scopeLedger.candidateCoverage.length, 2);
    assert.equal(result.scopeLedger.semanticCoverage, 'unverified');
});
