import assert from 'node:assert/strict';
import test from 'node:test';
import { planExplicitConstraintViolations, planRequirements } from '../../packages/theia-extension/lib/node/chat-plan-requirements.js';
import type { LocalImplementationPlan } from '../../packages/theia-extension/lib/node/roadmap-local-model.js';

const request = `Inspect the existing project source and prepare a minimal implementation plan to add automated testing for the increment function.
Requirements:
- Use Node's built-in test runner.
- Do not introduce Jest, Vitest, Mocha or any new dependency.
- Test that increment(1) returns 2.
- Reuse the existing increment implementation.
- Include exact affected files, deliverables and validation command.
- Keep the implementation small.
Present the implementation plan for review.
Do not modify project files, execute commands or apply Roadmap changes.`;

const plan: LocalImplementationPlan = {
    type: 'implementation-plan', objective: 'Add automated tests for increment',
    successCriteria: ['increment(1) returns 2 using node:test', 'does not introduce any new dependencies'],
    constraints: ['No external test framework'], assumptions: [],
    steps: [
        { title: 'Inspect existing increment', detail: 'Reuse src/counter.js increment implementation',
            deliverables: ['Retain src/counter.js'], dependsOn: [],
            reuse: [{ path: 'src/counter.js', reason: 'Use the existing increment function' }] },
        { title: 'Add Node test', detail: 'Import test from node:test and assert from node:assert/strict; assert increment(1) === 2',
            deliverables: ['src/counter.test.mjs with node:test case', 'Run node --test src/counter.test.mjs'],
            dependsOn: [1], reuse: [{ path: 'src/counter.js', reason: 'Import increment' }] }
    ], tests: ['node --test src/counter.test.mjs verifies increment(1) === 2'],
    guiQualification: 'No GUI change', risks: [], alternatives: [], question: ''
};

test('Planning distinguishes workflow instructions, negative constraints and implementation requirements', () => {
    const requirements = planRequirements(request).map(item => item.text);
    assert.ok(requirements.some(item => /automated testing/.test(item)));
    assert.ok(requirements.some(item => /test that increment/.test(item.toLowerCase())));
    assert.ok(!requirements.some(item => /Present the implementation plan|Do not modify project files/.test(item)));
    assert.deepEqual(planExplicitConstraintViolations(request, plan, ['src/counter.js']), []);
});

test('Planning catches forbidden frameworks, new packages, missing Node runner and missing exact assertion', () => {
    assert.match(planExplicitConstraintViolations(request, { ...plan,
        steps: [...plan.steps.slice(0, 1), { ...plan.steps[1], detail: 'Add Jest and test increment(1) returns 2' }] },
    ['src/counter.js']).join('; '), /forbidden item Jest/);
    assert.match(planExplicitConstraintViolations(request, { ...plan, tests: ['npm install lodash'] },
        ['src/counter.js']).join('; '), /new dependencies/);
    const noRunner = { ...plan, steps: [...plan.steps.slice(0, 1),
        { ...plan.steps[1], detail: 'Use console.assert for increment(1) === 2',
            deliverables: ['src/counter.test.mjs'] }], tests: ['node src/counter.test.mjs'],
        successCriteria: ['increment(1) returns 2'] };
    assert.match(planExplicitConstraintViolations(request, noRunner, ['src/counter.js']).join('; '), /node:test case/);
    const noAssertion = { ...plan, steps: [...plan.steps.slice(0, 1),
        { ...plan.steps[1], detail: 'Import test from node:test; add tests for increment',
            deliverables: ['src/counter.test.mjs', 'Run node --test src/counter.test.mjs'] }],
        tests: ['node --test src/counter.test.mjs'], successCriteria: ['Automated increment tests'] };
    assert.match(planExplicitConstraintViolations(request, noAssertion, ['src/counter.js']).join('; '),
        /test result is absent/);
});

test('Planning handles paraphrased denials without treating them as proposals', () => {
    const negatives = ['does not add a new dependency', 'must not introduce new dependencies',
        'avoids installing new dependencies', 'no additional dependencies are introduced'];
    for (const statement of negatives) {
        const candidate = { ...plan, successCriteria: [plan.successCriteria[0], statement] };
        assert.deepEqual(planExplicitConstraintViolations(request, candidate, ['src/counter.js']), [], statement);
    }
});
