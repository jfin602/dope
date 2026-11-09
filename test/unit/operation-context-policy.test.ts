import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveOperationContextPolicy, trustedOperationForTurn } from
    '../../packages/theia-extension/lib/node/operation-context-policy.js';

const model = { conversationalText: true, streaming: true, contextWindowTokens: 16384,
    maxInputTokens: 12000, maxOutputTokens: 4096,
    localReasoning: { values: ['off', 'low'], default: 'low', format: 'effort' as const } };

test('trusted dispatched operations have distinct managed classes without authority from text', () => {
    const cases = [
        [{ docsReview: false, roadmapEdit: false, investigation: false }, 'chat'],
        [{ docsReview: false, roadmapEdit: false, investigation: true }, 'investigation'],
        [{ docsReview: true, roadmapEdit: false, investigation: false }, 'docs-review'],
        [{ promptStage: 'prompt-ass', docsReview: false, roadmapEdit: false, investigation: false }, 'prompt-ass'],
        [{ promptStage: 'prompt-plan', docsReview: false, roadmapEdit: false, investigation: false }, 'prompt-plan'],
        [{ promptStage: 'prompt-write', docsReview: false, roadmapEdit: false, investigation: false }, 'prompt-write'],
        [{ docsReview: false, roadmapEdit: true, investigation: false }, 'roadmap-edit']
    ] as const;
    for (const [dispatch, expected] of cases) {
        const operation = trustedOperationForTurn(dispatch);
        assert.equal(operation, expected);
        assert.equal(resolveOperationContextPolicy('managed', operation, model).operation, expected);
    }
    assert.equal(resolveOperationContextPolicy('managed', 'phase-roadmap', model).operation, 'phase-roadmap');
    assert.equal(trustedOperationForTurn({ docsReview: false, roadmapEdit: false, investigation: false }), 'chat');
    // The selector has no prose argument: quoted/model-origin slash text cannot select a privileged class.
    assert.ok(resolveOperationContextPolicy('managed', 'prompt-ass', model).discretionary!.run.toolCalls >
        resolveOperationContextPolicy('managed', 'chat', model).discretionary!.run.toolCalls);
});

test('capacity and reasoning clamp independent allowances; unmanaged has no discretionary quota', () => {
    const small = { ...model, contextWindowTokens: 6000, maxInputTokens: 5000, maxOutputTokens: 1500 };
    const on = resolveOperationContextPolicy('managed', 'prompt-plan', small);
    const off = resolveOperationContextPolicy('managed', 'prompt-plan', small, { 'reasoning.effort': 'off' });
    assert.equal(on.model.reasoningEnabled, true);
    assert.equal(off.model.reasoningEnabled, false);
    assert.equal(on.discretionary?.modelOutputTokens, 1500);
    assert.ok(on.discretionary!.inputCompositionTokens < off.discretionary!.inputCompositionTokens);
    assert.ok(on.discretionary!.inputCompositionTokens + on.discretionary!.modelOutputTokens + 2048 <= 6000);
    assert.equal(resolveOperationContextPolicy('managed', 'chat', {
        conversationalText: true, streaming: true, contextWindowTokens: 6000
    }).model.reasoningEnabled, false);
    const unmanaged = resolveOperationContextPolicy('unmanaged', 'prompt-write', small);
    assert.equal(unmanaged.discretionary, null);
    assert.equal(unmanaged.model.contextWindowTokens, 6000);
    assert.equal(unmanaged.model.maxOutputTokens, 1500);
    assert.equal(Object.hasOwn(unmanaged, 'projectTools'), false);
    assert.throws(() => resolveOperationContextPolicy('managed', 'chat',
        { ...small, contextWindowTokens: 1024 }), /cannot fit/);
});
