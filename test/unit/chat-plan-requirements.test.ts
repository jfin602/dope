import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { planRequirements, planRequirementCoverage, planOutputDirectives,
    planExplicitConstraintViolations, type PlanRequirement } from '../../packages/theia-extension/lib/node/chat-plan-requirements.js';
import { validImplementationPlan, type LocalImplementationPlan } from '../../packages/theia-extension/lib/node/roadmap-local-model.js';

const requirements: PlanRequirement[] = [
    'Visual Git history functionality',
    'Reuse the existing read-only diff editor',
    'Functional branch checkout',
    'Functional commit creation',
    'Checkout and commit controls in the toolbar',
    'Explicit authorization before checkout and commit',
    'Implementation and verification tests',
].map((text, index) => ({ id: `R${index + 1}`, text,
    terms: planRequirements(text)[0]?.terms ?? [] }));
const step = (title: string, detail: string, deliverables: string[]): LocalImplementationPlan['steps'][number] =>
    ({ title, detail, deliverables, dependsOn: [], reuse: [] });
const complete: LocalImplementationPlan = { type: 'implementation-plan', objective: 'Visual Git history',
    successCriteria: ['Git history view opens commit diffs read-only', 'Checkout switches branches after authorization',
        'Commit creation returns a new Git identifier after authorization'], constraints: [], assumptions: [],
    steps: [
        step('Build Git history panel', 'Render commit history in a navigable visual Git panel and connect the read-only diff editor to selected commits.',
            ['Visual Git history view with existing read-only diff editor']),
        step('Branch checkout operation', 'Call checkoutBranch for the selected branch after explicit authorization and confirmation; handle failure.',
            ['Functional branch checkout with explicit authorization']),
        step('Commit creation operation', 'Invoke the repository commit service, handle failure and verify the resulting Git commit identifier exists.',
            ['Functional commit creation with verified identifier']),
        step('Toolbar actions', 'Wire checkout and commit controls in the toolbar to the guarded operations.',
            ['Checkout and commit toolbar controls']),
        step('Implementation tests', 'Implement tests for visual history, diff editor reuse, branch checkout, commit creation, toolbar and authorization failures.',
            ['Implementation and verification tests']),
    ], tests: ['Verify Git history view and read-only diff editor', 'Verify branch checkout and commit creation succeeds and fails safely',
        'Verify toolbar controls and explicit authorization before checkout and commit', 'Run implementation and verification tests'],
    guiQualification: 'Verify visual Git history and toolbar actions in the browser', risks: [], alternatives: [], question: '' };
const statuses = (plan: LocalImplementationPlan) => planRequirementCoverage(requirements, plan).map(item => item.status);

test('A: equivalent wording for history and diff work is recognized without exact requirement phrases', () => {
    assert.equal(validImplementationPlan(complete), true);
    assert.equal(statuses(complete)[0], 'covered');
    assert.equal(statuses(complete)[1], 'covered');
});

test('generic inspect and review instructions are workflow constraints, not product feature requirements', () => {
    const request = "Inspect this project's implementation and prepare one small, concrete development milestone with validation steps. Present the proposal for my review without changing source files.";
    assert.deepEqual(planRequirements(request), []);
    assert.equal(planRequirementCoverage(planRequirements(request), complete).length, 0);
    assert.equal(planRequirements(`${request} Add functional branch checkout.`).length, 1);
});

test('specific file inspection and test-plan formatting directions do not become product requirements', () => {
    const request = `Inspect src/counter.js and package.json using your available tools. Prepare one minimal implementation plan for adding an automated test for the existing increment function using Node's built-in test runner. Include the file changes, one test case and validation command. Present the plan for review. Do not edit files, run commands or apply Roadmap changes. Finish once the necessary source evidence is verified.`;
    const requirements = planRequirements(request);
    assert.equal(requirements.length, 1);
    assert.match(requirements[0].text, /automated test.*Node's built-in test runner/i);
    assert.equal(planRequirements(`${request} Add functional branch checkout.`).length, 2);
});

test('bulleted Planning directives retain the Node-only requirement and reject forbidden alternatives', () => {
    const request = `Inspect src/counter.js and package.json using your project tools.\n\nPrepare one minimal implementation plan to add an automated test for the existing increment function.\n\nRequirements:\n- Use Node's built-in test runner.\n- Do not introduce Vitest, Jest or new dependencies.\n- Test that increment(1) returns 2.\n- Include the required file changes and validation command.\n- Reuse the existing function rather than rewriting it.\n- Do not modify project files or the Roadmap.\n\nPresent the implementation plan for review.`;
    const expected = planRequirements(request);
    assert.deepEqual(expected.map(item => item.text), [
        'add an automated test for the existing increment function',
        "Use Node's built-in test runner", 'Test that increment(1) returns 2']);
    assert.ok(planOutputDirectives(request).includes('Do not introduce Vitest, Jest or new dependencies'));
    const plan: LocalImplementationPlan = { type: 'implementation-plan', objective: 'Add automated test for increment function',
        successCriteria: ['Node built-in test runner passes increment(1) returns 2'],
        constraints: ['No new dependencies'], assumptions: [], steps: [
            { title: 'Add automated test', detail: 'Add automated test for increment function using Node built-in test runner; test that increment(1) returns 2',
                deliverables: ['src/counter.test.js imports existing increment function and asserts increment(1) returns 2'],
                dependsOn: [], reuse: [{ path: 'src/counter.js', reason: 'Reuse existing increment function' }] },
            { title: 'Add test script', detail: 'Use Node built-in test runner in package.json scripts.test via node --test',
                deliverables: ['package.json test script for validation command npm test'], dependsOn: [1],
                reuse: [{ path: 'package.json', reason: 'Extend existing ESM manifest' }] }],
        tests: ['Run npm test with Node built-in test runner and assert increment(1) returns 2'],
        guiQualification: 'Not applicable: CLI test only', risks: [], alternatives: [], question: '' };
    assert.equal(validImplementationPlan(plan), true);
    assert.equal(planRequirementCoverage(expected, plan).every(item => item.complete), true);
    assert.deepEqual(planExplicitConstraintViolations(request, plan, ['src/counter.js', 'package.json']), []);
    assert.match(planExplicitConstraintViolations(request, { ...plan,
        steps: [plan.steps[0], { ...plan.steps[1], detail: 'Add Jest and npm install for the test' }] },
    ['src/counter.js', 'package.json']).join(' '), /Jest/);
    assert.match(planExplicitConstraintViolations(request, { ...plan,
        tests: ['Run npm test with Node built-in test runner and assert increment(1) returns 3'],
        successCriteria: ['Node built-in test runner passes increment(1) returns 3'],
        steps: plan.steps.map(step => ({ ...step, detail: step.detail.replaceAll('returns 2', 'returns 3'),
            deliverables: step.deliverables.map(item => item.replaceAll('returns 2', 'returns 3')) })) },
    ['src/counter.js', 'package.json']).join(' '), /Requested test result/);
    assert.match(planExplicitConstraintViolations(request, { ...plan,
        steps: plan.steps.map(step => ({ ...step, reuse: [] })) }, ['src/counter.js']).join(' '), /verified reuse path/);
});

test('B/C: a commit control is not commit creation; execution, failure and identifier verification cover it', () => {
    const buttonOnly = { ...complete, steps: complete.steps.filter(item => item.title !== 'Commit creation operation') };
    assert.notEqual(statuses(buttonOnly)[3], 'covered');
    assert.equal(statuses(complete)[3], 'covered');
});

test('D: checkout without explicit permission work leaves authorization unresolved', () => {
    const noPermission = { ...complete, steps: complete.steps.map(item => ({ ...item,
        detail: item.detail.replaceAll('explicit authorization', 'confirmation').replaceAll('guarded', 'connected'),
        deliverables: item.deliverables.map(value => value.replaceAll('explicit authorization', 'confirmation')) })) };
    assert.notEqual(statuses(noPermission)[5], 'covered');
});

test('E/F/G: complete work is review eligible; omissions and mentions are diagnostic only', () => {
    assert.equal(statuses(complete).every(value => value === 'covered'), true);
    const missing = { ...complete, steps: complete.steps.filter(item => item.title !== 'Commit creation operation') };
    assert.notEqual(statuses(missing)[3], 'covered');
    const mentioned = { ...missing, objective: 'Functional commit creation',
        successCriteria: [...missing.successCriteria, 'Functional commit creation succeeds'] };
    assert.notEqual(statuses(mentioned)[3], 'covered');
});

test('H: malformed and partial JSON never become valid implementation plans', () => {
    assert.equal(validImplementationPlan({ ...complete, steps: [complete.steps[0], { ...complete.steps[1], dependsOn: [3] }] }), false);
    assert.equal(validImplementationPlan({ ...complete, type: 'no-action' }), false);
    assert.throws(() => JSON.parse(JSON.stringify(complete).slice(0, -1)));
});

test('I: both saved real-Q4 envelopes stay incomplete and preserve actual source references', () => {
    const corpus = JSON.parse(readFileSync(new URL('../fixtures/checkpoint-one-real-q4.json', import.meta.url), 'utf8')) as {
        request: string; sourceRefs: { id: string; sourceHash: string }[];
        responses: { messageId: string; plan: LocalImplementationPlan }[] };
    assert.equal(corpus.responses.length, 2);
    assert.deepEqual(corpus.sourceRefs.map(item => item.id), [
        'src/diffEditor.js', 'src/history.js', 'src/permissions.js', 'src/toolbar.js', 'test/history.test.js']);
    for (const response of corpus.responses) {
        assert.equal(validImplementationPlan(response.plan), true);
        assert.notEqual(statuses(response.plan)[3], 'covered');
        assert.notEqual(statuses(response.plan)[6], 'covered');
    }
    assert.equal(corpus.responses[0].plan.steps.length, 2);
    assert.equal(corpus.responses[1].plan.steps.length, 2);
    assert.equal(planRequirements(corpus.request).length, 5);
});
