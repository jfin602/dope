import assert from 'node:assert/strict';
import test from 'node:test';
import { implementationPlanShapeIssues, localPlanningJson, parseStrategicDraft, requestsRoadmapOwnerRevision, roadmapLocalBudget, validImplementationPlan,
    verifyRoadmapLocalInput } from '../../packages/theia-extension/lib/node/roadmap-local-model.js';

const noAction = '{"type":"no-action","message":"More project context is required"}';
const complete = (text: string) => ({ type: 'complete' as const, text });

const implementationPlan = { type: 'implementation-plan', objective: 'Add visual Git history',
    successCriteria: ['Checkout and commits are usable'], constraints: ['Keep permissions explicit'],
    assumptions: ['Existing diff editor can be reused'], steps: [
        { title: 'Inspect history', detail: 'Identify Git and diff editor owners', deliverables: ['Source map'], dependsOn: [], reuse: [] },
        { title: 'Implement history view', detail: 'Wire history to existing diff editor', deliverables: ['History panel'],
            dependsOn: [1], reuse: [] }], tests: ['Unit history navigation'], guiQualification: 'Exercise checkout in GUI',
    risks: ['Stale branch state; refresh before action'], alternatives: ['Reuse existing list first'], question: '' };

test('whole strategic envelope requires complete output and exact owner identity', () => {
    const draft = { type: 'strategic-roadmap-draft', projectId: 'project', ownerRevision: 0,
        phases: ['Foundation', 'Combat', 'MVP polish'].map((title, index) => ({ title,
            objective: `${title} is usable`, checkpoints: [{ title: `${title} milestone`, objective: 'Observable result',
                dependsOn: index ? [index] : [] }] })) };
    assert.equal(parseStrategicDraft(JSON.stringify(draft), 'stop', 'project', 0).phases.length, 3);
    assert.throws(() => parseStrategicDraft(JSON.stringify(draft), 'length', 'project', 0), /truncated/);
    assert.throws(() => parseStrategicDraft(JSON.stringify(draft).slice(0, -5), 'stop', 'project', 0), /invalid JSON/);
    assert.throws(() => parseStrategicDraft(JSON.stringify(draft), 'stop', 'foreign', 0), /foreign/);
    assert.throws(() => parseStrategicDraft(JSON.stringify({ ...draft, tool: 'write' }), 'stop', 'project', 0), /foreign/);
});

test('structured local Gate proposal requires exact criteria shape and owner', () => {
    const phases = ['Build', 'Qualify'].map(title => ({ title, objective: '', checkpoints: [], gates: [{
        title: `${title} acceptance`, purpose: 'Verify a stated requirement',
        criteria: [{ title: 'Tower defeat', expectedResult: 'Main tower health reaches 0 and the player loses' }]
    }] }));
    const draft = { type: 'strategic-roadmap-draft', projectId: 'project', ownerRevision: 0, phases };
    assert.equal(parseStrategicDraft(JSON.stringify(draft), 'stop', 'project', 0).phases[0].gates?.length, 1);
    assert.throws(() => parseStrategicDraft(JSON.stringify({ ...draft, phases: [{ ...phases[0],
        gates: [{ ...phases[0].gates[0], status: 'green' }] }, phases[1]] }), 'stop', 'project', 0), /shape/);
    assert.throws(() => parseStrategicDraft(JSON.stringify(draft), 'stop', 'project', 1), /foreign/);
});

test('local draft action permits proposed Gates and criteria without a qualification status', async () => {
    const signal = new AbortController().signal;
    const action = { type: 'roadmap-draft-proposal', projectId: 'project', draftRevision: 1,
        action: { type: 'add-criterion', phaseId: 'phase', gateId: 'gate', title: 'Tower defeat',
            expectedResult: 'At zero health the player loses' } };
    assert.equal((await localPlanningJson(async function* () { yield complete(JSON.stringify(action)); },
        signal, 4096, 'draft')).text, JSON.stringify(action));
    await assert.rejects(localPlanningJson(async function* () { yield complete(JSON.stringify({ ...action,
        action: { ...action.action, status: 'green' } })); }, signal, 4096, 'draft'), /strict JSON/);
});

test('strict plan envelope is separate from the 4000-character no-action and small Roadmap action caps', async () => {
    const signal = new AbortController().signal;
    const valid = JSON.stringify({ ...implementationPlan, steps: implementationPlan.steps.map((step, index) => ({
        ...step, detail: 'Use the existing editor. '.repeat(78) + (index ? 'Wire actions safely.' : 'Inspect source first.') })) });
    assert.ok(valid.length > 4000);
    assert.equal(validImplementationPlan(JSON.parse(valid)), true);
    assert.equal((await localPlanningJson(async function* () { yield complete(valid); }, signal, 16000, 'plan')).text, valid);
    for (const bad of [
        { ...implementationPlan, actions: [{ type: 'shell' }] },
        { ...implementationPlan, steps: [implementationPlan.steps[0]] },
        { ...implementationPlan, steps: [implementationPlan.steps[0], { ...implementationPlan.steps[1], dependsOn: [2] }] },
        { ...implementationPlan, steps: Array.from({ length: 17 }, () => implementationPlan.steps[0]) }
    ]) {
        assert.equal(validImplementationPlan(bad), false);
        let calls = 0;
        await assert.rejects(localPlanningJson(async function* () { calls++; yield complete(JSON.stringify(bad)); },
            signal, 16000, 'plan'), /strict JSON/);
        assert.equal(calls, 2);
    }
    await assert.rejects(localPlanningJson(async function* () { yield complete(noAction); }, signal, 16000, 'plan'), /strict JSON/);
    await assert.rejects(localPlanningJson(async function* () { yield complete(valid); }, signal, 1000, 'plan'), /strict JSON/);
    await assert.rejects(localPlanningJson(async function* () { yield { type: 'delta', text: valid.slice(0, 50) }; },
        signal, 16000, 'plan'), /without completion/);
});

test('every implementation step requires a typed reuse array, including validation steps', () => {
    assert.equal(validImplementationPlan(implementationPlan), true);
    const missing = { ...implementationPlan, steps: [implementationPlan.steps[0],
        (({ reuse: _reuse, ...step }) => step)(implementationPlan.steps[1])] };
    assert.equal(validImplementationPlan(missing), false);
    assert.deepEqual(implementationPlanShapeIssues(missing), ['missing steps[1].reuse']);
    const wrongType = { ...implementationPlan, steps: [implementationPlan.steps[0],
        { ...implementationPlan.steps[1], reuse: 'src/history.js' }] };
    assert.equal(validImplementationPlan(wrongType), false);
    assert.deepEqual(implementationPlanShapeIssues(wrongType), ['steps[1].reuse must be [] or an array of {path,reason}']);
});

test('measured 4096 narrow stress reserves serialized input, system and output', () => {
    const budget = roadmapLocalBudget(4096, 1024);
    assert.equal(budget.total, 4096);
    assert.equal(budget.output, 1024);
    assert.equal(budget.inputBytes + budget.output + 512 + 256, 4096);
    assert.ok(budget.composerInputTokens * 3 <= budget.inputBytes);
    assert.ok(budget.maxOutputBytes > 512);
    verifyRoadmapLocalInput([{ role: 'system', content: 'Return JSON' },
        { role: 'user', content: 'Context'.repeat(100) }], budget);
    assert.throws(() => verifyRoadmapLocalInput([{ role: 'user', content: 'x'.repeat(3000) }], budget), /exceeds/);
    assert.throws(() => roadmapLocalBudget(undefined, 512), /measured/);
});

test('16K, 32K and 64K use measured capacity and independent model/developer limits', () => {
    for (const total of [16384, 32768, 65536]) {
        const budget = roadmapLocalBudget(total, 2048);
        assert.equal(budget.total, total);
        assert.equal(budget.output, 2048);
        assert.equal(budget.inputBytes, total - 2048 - 512 - 256);
        assert.ok(budget.maxOutputBytes > budget.output);
        verifyRoadmapLocalInput([{ role: 'user', content: 'x'.repeat(9000) }], budget);
    }
    const limited = roadmapLocalBudget(65536, 2048, { maxInputTokens: 7000, maxOutputTokens: 768 });
    assert.equal(limited.inputBytes, 7000);
    assert.equal(limited.output, 768);
    assert.throws(() => verifyRoadmapLocalInput([{ role: 'user', content: 'x'.repeat(7000) }], limited), /exceeds/);
    assert.throws(() => roadmapLocalBudget(16384, 0), /limit/);
});

test('bounded JSON bytes are independent of output token reservation', async () => {
    const value = JSON.stringify({ type: 'roadmap-intent', intent: 'set-objective', value: 'x'.repeat(700) });
    const bytes = roadmapLocalBudget(16384, 1024).maxOutputBytes;
    assert.ok(Buffer.byteLength(value, 'utf8') > 512);
    assert.equal((await localPlanningJson(async function* () { yield complete(value); },
        new AbortController().signal, bytes, 'linked')).text, value);
    await assert.rejects(localPlanningJson(async function* () { yield complete(value); },
        new AbortController().signal, 512, 'linked'), /strict JSON/);
});

test('non-tools JSON fallback repairs once and never accepts a second malformed response', async () => {
    const controller = new AbortController();
    let calls = 0;
    const generate = async function* () { calls++; yield complete(calls === 1 ? 'not JSON' : noAction); };
    assert.equal((await localPlanningJson(generate, controller.signal)).text, noAction);
    assert.equal(calls, 2);
    calls = 0;
    await assert.rejects(localPlanningJson(async function* () { calls++; yield complete('{bad'); }, controller.signal), /two attempts/);
    assert.equal(calls, 2);
});

test('invalid implementation plan gives the retry a concrete finish instruction', async () => {
    const hints: Array<string | undefined> = [];
    const plan = JSON.stringify(implementationPlan);
    const result = await localPlanningJson(async function* (hint) {
        hints.push(hint);
        yield complete(hints.length === 1 ? 'I will inspect more files.' : plan);
    }, new AbortController().signal, 16000, 'plan');
    assert.equal(result.text, plan);
    assert.equal(hints[0], undefined);
    assert.match(hints[1]!, /complete strict implementation-plan JSON/);
    assert.match(hints[1]!, /Finish now/);
});

test('valid JSON with a missing reuse field receives the exact schema issue and only one retry', async () => {
    const missing = { ...implementationPlan, steps: [implementationPlan.steps[0],
        (({ reuse: _reuse, ...step }) => step)(implementationPlan.steps[1])] };
    const hints: Array<string | undefined> = [];
    const result = await localPlanningJson(async function* (hint) {
        hints.push(hint);
        yield complete(JSON.stringify(hints.length === 1 ? missing : implementationPlan));
    }, new AbortController().signal, 16000, 'plan');
    assert.equal(result.text, JSON.stringify(implementationPlan));
    assert.equal(hints.length, 2);
    assert.match(hints[1]!, /missing steps\[1\]\.reuse/);
    assert.match(hints[1]!, /reuse:\[\]/);
});

test('a copied no-action placeholder is retried once and never published as an answer', async () => {
    const placeholder = '{"type":"no-action","message":"source-backed answer"}';
    let calls = 0;
    const generate = async function* () { calls++; yield complete(calls === 1 ? placeholder : noAction); };
    assert.equal((await localPlanningJson(generate, new AbortController().signal, 4096, 'linked')).text, noAction);
    assert.equal(calls, 2);
    calls = 0;
    await assert.rejects(localPlanningJson(async function* () { calls++; yield complete(placeholder); },
        new AbortController().signal, 4096, 'linked'), /strict JSON/);
    assert.equal(calls, 2);
});

test('a requested owner revision must be stated from trusted context before accepting no-action', async () => {
    assert.equal(requestsRoadmapOwnerRevision('Give the current Roadmap owner revision and decision'), true);
    assert.equal(requestsRoadmapOwnerRevision('Give the brief decision revision'), false);
    const incomplete = '{"type":"no-action","message":"Brief decision revision 4; do not start the canary."}';
    const completeAnswer = '{"type":"no-action","message":"Roadmap owner revision: 9. Brief decision revision: 4; do not start the canary."}';
    const hints: Array<string | undefined> = [], causes: string[] = [];
    let calls = 0;
    const answer = await localPlanningJson(async function* (hint) {
        hints.push(hint); calls++; yield complete(calls === 1 ? incomplete : completeAnswer);
    }, new AbortController().signal, 4096, 'linked', true,
    { requiredOwnerRevision: 9, onRetry: cause => causes.push(cause) });
    assert.equal(answer.text, completeAnswer);
    assert.equal(calls, 2);
    assert.equal(hints[0], undefined);
    assert.match(hints[1]!, /owner revision 9/);
    assert.deepEqual(causes, ['missing-owner-revision']);
    calls = 0;
    await assert.rejects(localPlanningJson(async function* () { calls++; yield complete(incomplete); },
        new AbortController().signal, 4096, 'linked', true,
        { requiredOwnerRevision: 9 }), (error: Error & { failureClass?: string }) => {
        assert.match(error.message, /omitted the requested current Roadmap owner revision/);
        assert.equal(error.failureClass, 'incomplete-answer');
        return true;
    });
    assert.equal(calls, 2);
    assert.equal((await localPlanningJson(async function* () { yield complete(incomplete); },
        new AbortController().signal, 4096, 'linked')).text, incomplete);
});

test('abort stops retries; strict fallback rejects tool and multiple-action envelopes', async () => {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(localPlanningJson(async function* () {
        calls++;
        controller.abort();
        yield complete(noAction);
    }, controller.signal), /cancelled/);
    assert.equal(calls, 1);
    await assert.rejects(localPlanningJson(async function* () {
        yield complete('{"type":"roadmap-proposal","projectId":"p","ownerRevision":1,"action":[{"type":"shell"}]}');
    }, new AbortController().signal), /strict JSON/);
    await assert.rejects(localPlanningJson(async function* () {
        yield complete('x'.repeat(513));
    }, new AbortController().signal), /strict JSON/);
});

test('linked intent contract rejects missing action type, wrong operation, extra keys and unknown intent before completion', async () => {
    const valid = '{"type":"roadmap-intent","intent":"set-objective","value":"Checked goal"}';
    for (const malformed of [
        '{"type":"roadmap-proposal","projectId":"p","ownerRevision":1,"action":{"id":"a","objective":"x"}}',
        '{"type":"roadmap-proposal","projectId":"p","ownerRevision":1,"action":{"type":"edit","id":"a","objective":"x"}}',
        '{"type":"roadmap-intent","intent":"set-status","value":"green"}',
        '{"type":"roadmap-intent","intent":"set-objective","value":"x","actions":[]}'
    ]) {
        let calls = 0;
        await assert.rejects(localPlanningJson(async function* () { calls++; yield complete(malformed); },
            new AbortController().signal, 512, 'linked'), /strict JSON/);
        assert.equal(calls, 2);
    }
    assert.equal((await localPlanningJson(async function* () { yield complete(valid); },
        new AbortController().signal, 512, 'linked')).text, valid);
});

test('strict local completion accepts only known, bounded envelopes', async () => {
    const signal = new AbortController().signal;
    const draft = JSON.stringify({ type: 'roadmap-draft-proposal', projectId: 'p', draftRevision: 0,
        action: { type: 'create-phase', title: 'First phase' } });
    const unlinked = JSON.stringify({ type: 'roadmap-proposal', projectId: 'p', ownerRevision: 1,
        action: { type: 'edit', id: 'a', objective: 'Goal' } });
    for (const [value, mode] of [[draft, 'draft'], [unlinked, 'unlinked'], [noAction, 'linked']] as const)
        assert.equal((await localPlanningJson(async function* () { yield complete(value); },
            signal, 4096, mode)).text, value);
    for (const value of [
        '{"type":"other","message":"looks structured"}',
        '{"type":"no-action","message":{"text":"nested"}}',
        '{"type":"no-action","message":"  "}',
        '{"type":"no-action","message":"okay","saved":true}',
        '{"type":"roadmap-proposal","projectId":"p","ownerRevision":1,"action":{"type":"shell","command":"pwd"}}',
        '{"type":"no-action","message":"' + 'x'.repeat(4001) + '"}',
        '{"type":"no-action","message":"unfinished"'
    ]) await assert.rejects(localPlanningJson(async function* () { yield complete(value); },
        signal, 4096, 'unlinked'), /strict JSON/);
    await assert.rejects(localPlanningJson(async function* () { yield complete(noAction); },
        signal, 8, 'unlinked'), /strict JSON/);
});

test('substantive no-action answers and questions complete without an edit', async () => {
    const answer = JSON.stringify({ type: 'no-action', message: 'The first phase depends on the API contract. ' +
        'Which version of that contract should the checkpoint target? '.repeat(25) });
    let calls = 0;
    assert.equal((await localPlanningJson(async function* () { calls++; yield complete(answer); },
        new AbortController().signal, 4096, 'draft')).text, answer);
    assert.equal(calls, 1);
});

test('two-step envelope requires explicit cap and rejects unsafe or incomplete output', async () => {
    const value = JSON.stringify({ type: 'roadmap-sequence', projectId: 'project', ownerRevision: 4,
        actions: [{ type: 'edit', id: 'checkpoint', objective: 'First step' },
            { type: 'status', id: 'checkpoint', status: 'active' }] });
    const signal = new AbortController().signal;
    assert.equal((await localPlanningJson(async function* () { yield complete(value); }, signal,
        4096, 'unlinked', true, { maxSteps: 2 })).text, value);
    await assert.rejects(localPlanningJson(async function* () { yield complete(value); }, signal,
        4096, 'unlinked'), /strict JSON/);
    await assert.rejects(localPlanningJson(async function* () { yield complete(value.replace('"edit"', '"shell"')); },
        signal, 4096, 'unlinked', true, { maxSteps: 2 }), /strict JSON/);
    await assert.rejects(localPlanningJson(async function* () { yield { type: 'delta', text: value }; },
        signal, 4096, 'unlinked', true, { maxSteps: 2 }), /without completion/);
    const draft = JSON.stringify({ type: 'roadmap-draft-sequence', projectId: 'project', draftRevision: 0,
        actions: [{ type: 'create-phase', title: 'Design' }, { type: 'create-phase', title: 'Build' }] });
    assert.equal((await localPlanningJson(async function* () { yield complete(draft); }, signal,
        4096, 'draft', true, { maxSteps: 2 })).text, draft);
    await assert.rejects(localPlanningJson(async function* () { yield complete(draft); }, signal,
        4096, 'draft'), /strict JSON/);
});

import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';

async function withChat(run: (backend: ChatBackend, projectHandle: string, chatId: string, token: string) => Promise<void>,
    models: unknown, routing?: unknown) {
    const root = await mkdtemp(join(tmpdir(), 'dope-short-chat-'));
    const backend = new ChatBackend(new ChatRepository(), { notifyChatEvent() {} }, models as never,
        { compose: async () => ({ messages: [{ role: 'user', content: 'Plan' }], refs: [], diagnostics: [],
            usedTokens: 1, budgetTokens: 1 }) } as never, routing as never);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Short planning' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        if (!lease.acquired) throw new Error('Missing lease');
        await run(backend, projectHandle, chatId, lease.token);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
}

test('local Roadmap turn fails before transport when loaded capacity is unknown', async () => {
    let calls = 0;
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'unknown', label: 'Unknown', usable: true,
            capabilities: { conversationalText: true, streaming: true } }] }] }),
        async *generate() { calls++; yield complete(noAction); } };
    await withChat(async (backend, projectHandle, chatId, token) => {
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: token,
            selectedModel: { connectionId: 'local', modelId: 'unknown' }, content: 'Plan',
            context: [{ kind: 'roadmap-checkpoint', id: 'a', projectId: 'p', ownerRevision: 1 }] }), /measured/);
    }, models);
    assert.equal(calls, 0);
});

test('Follow Roadmap planning denies implicit hosted fallback before transport', async () => {
    const calls: Array<{ locality: string; authorized: boolean }> = [];
    const routing = { resolve: async (_role: string, hard: { locality: string }, authorized: boolean) => {
        calls.push({ locality: hard.locality, authorized });
        return { inventory: { models: [] }, resolution: { selectedTarget: undefined } };
    } };
    const models = { list: async () => ({ connections: [] }), async *generate() {
        throw new Error('Hosted transport must not run');
    } };
    await withChat(async (backend, projectHandle, chatId, token) => {
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: token,
            content: 'Plan', context: [{ kind: 'roadmap-checkpoint', id: 'a', projectId: 'p', ownerRevision: 1 }],
            hostedProjectDataAuthorized: true }), /no eligible model/);
    }, models, routing);
    assert.deepEqual(calls, [{ locality: 'local-only', authorized: false }]);
});

test('an exact hosted Roadmap turn requires explicit project-data consent', async () => {
    let calls = 0;
    const models = { list: async () => ({ connections: [{ id: 'hosted', ready: true, providerId: 'gemini',
        models: [{ id: 'm', label: 'Hosted', usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 8192 } }] }] }),
        async *generate() { calls++; yield complete(noAction); } };
    await withChat(async (backend, projectHandle, chatId, token) => {
        await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: token,
            selectedModel: { connectionId: 'hosted', modelId: 'm' }, content: 'Plan',
            context: [{ kind: 'roadmap-checkpoint', id: 'a', projectId: 'p', ownerRevision: 1 }] }), /confirmation/);
    }, models);
    assert.equal(calls, 0);
});
