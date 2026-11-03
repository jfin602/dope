import assert from 'node:assert/strict';
import test from 'node:test';
import { allowsPlainGateAnswer, generateTypedRoadmapDraft, localPlanningJson, parseStrategicDraft,
    parseRoadmapMarkers, parseTypedRoadmapDraft, requestsRoadmapOwnerRevision, roadmapLocalBudget, typedRoadmapDraftInstruction,
    verifyRoadmapLocalInput } from '../../packages/theia-extension/lib/node/roadmap-local-model.js';

const noAction = '{"type":"no-action","message":"More project context is required"}';
const complete = (text: string) => ({ type: 'complete' as const, text });
const markerLines = () => [
    'RM1',
    'P|Path and enemies|Build a fixed waypoint path',
    'G|Enemy motion|Spawn enemies with health and move them over waypoints',
    'C|Enemies traverse every waypoint in order',
    'C|Enemies with zero health disappear from the path',
    'P|Tower combat|Build a basic tower',
    'G|Projectile attack|Target enemies and fire on a cooldown',
    'C|One tower targets an enemy and fires a projectile after its cooldown expires',
    'P|Waves|Deliver waves',
    'G|Wave advance|Start the next wave when the current wave ends',
    'C|The next wave begins after all current enemies are defeated',
    'P|Economy|Add earned and spent currency',
    'G|Buy towers|Use kill currency to purchase defenses',
    'C|A kill adds currency and buying a tower deducts the displayed cost',
    'P|Main tower and defeat|Keep health between waves',
    'G|Defeat|Persist health and end play at zero',
    'C|Main tower health persists across waves and zero health ends the game',
    'END'
];

test('RM1 parses one five-Phase candidate with exact result, stable title, warnings and no dependencies', () => {
    const text = markerLines().join('\n');
    const candidate = parseRoadmapMarkers(text, 'stop', [
        { label: 'waypoints', terms: ['waypoint'] },
        { label: 'multiplayer', terms: ['multiplayer'] }
    ]);
    assert.equal(candidate.kind, 'untrusted-typed-roadmap-draft');
    assert.equal(candidate.draft.phases.length, 5);
    assert.equal(candidate.draft.phases[0].gates[0].criteria.length, 2);
    assert.equal(candidate.draft.phases[0].gates[0].criteria[0].expectedResult,
        'Enemies traverse every waypoint in order');
    assert.equal(candidate.draft.phases[0].gates[0].criteria[0].title,
        'Enemies traverse every waypoint in order [69e4d45836]');
    assert.deepEqual(candidate.draft.phases.map(phase => phase.title),
        ['Path and enemies', 'Tower combat', 'Waves', 'Economy', 'Main tower and defeat']);
    assert.ok(candidate.draft.phases.every(phase => !Object.hasOwn(phase, 'dependsOn')));
    assert.deepEqual(candidate.coverageWarnings, ['No Gate/Criterion text explicitly covers multiplayer']);
    assert.deepEqual(parseRoadmapMarkers(text.replaceAll('\n', '\r\n') + '\r\n', 'eos', [
        { label: 'waypoints', terms: ['waypoint'] }, { label: 'multiplayer', terms: ['multiplayer'] }
    ]), candidate);
    assert.equal(parseTypedRoadmapDraft(JSON.stringify(candidate.draft), 'stop').draft.phases.length, 5);
});

test('RM1 fails closed on grammar, nesting, field, safety and completion errors', () => {
    const valid = markerLines();
    const replace = (at: number, value: string) => valid.map((line, index) => index === at ? value : line).join('\n');
    const parse = (text: string, reason = 'stop') => parseRoadmapMarkers(text, reason);
    assert.throws(() => parse(valid.join('\n'), 'length'), /truncated/);
    assert.throws(() => parse(valid.join('\n'), ''), /finish reason/);
    assert.throws(() => parse(valid.join('\n').slice(0, -3)), /line 17.*END/);
    assert.throws(() => parse(valid.join('\n') + '\n\n'), /line 19.*END/);
    assert.throws(() => parse('preface\n' + valid.join('\n')), /line 1/);
    assert.throws(() => parse(valid.join('\n') + '\ncommentary'), /END/);
    assert.throws(() => parse(replace(1, 'C|Enemies move')), /line 2.*preceding Gate/);
    assert.throws(() => parse(replace(2, 'C|Enemies move')), /line 3.*preceding Gate/);
    assert.throws(() => parse(replace(3, 'P|Early|Wrong nesting')), /previous Gate needs a Criterion/);
    assert.throws(() => parse(replace(3, 'X|Unknown')), /line 4.*unknown kind/);
    assert.throws(() => parse(replace(3, 'C|Enemies|move')), /line 4.*field count/);
    assert.throws(() => parse(replace(3, 'C|')), /line 4.*expectedResult/);
    assert.throws(() => parse(replace(3, 'C| Padded result')), /line 4.*expectedResult/);
    assert.throws(() => parse(replace(3, 'C|<script>alert(1)</script>')), /line 4.*expectedResult/);
    assert.throws(() => parse(replace(3, 'C|Passed')), /line 4.*observable behavior/);
    assert.throws(() => parse(replace(1, 'P|Path and enemies|')), /line 2.*Phase objective/);
    assert.throws(() => parse(replace(3, 'C|' + 'x'.repeat(301))), /line 4.*expectedResult/);
    assert.throws(() => parse(replace(3, 'C|Bad\uD800 text')), /line 4.*expectedResult/);
    assert.throws(() => parse(replace(4, valid[3])), /line 5.*duplicate/);
    assert.throws(() => parse(replace(7, valid[3])), /line 8.*duplicate/);
    assert.throws(() => parse(replace(4, 'G|Enemy motion|Repeated')), /line 5.*Gate title/);
    assert.throws(() => parse(replace(5, 'P|Path and enemies|Repeated')), /line 6.*Phase title/);
    assert.throws(() => parse(replace(1, 'P|Path and enemies|'.concat('x'.repeat(361)))), /line 2.*Phase objective/);
    assert.throws(() => parseRoadmapMarkers(valid.join('\n'), 'stop', [], 20), /reserved output/);
    assert.throws(() => parse(valid.join('\n') + 'x'.repeat(32768)), /reserved output/);
    assert.throws(() => parseRoadmapMarkers('RM1\n' + 'C|x\n'.repeat(699) + 'END', 'stop'), /line 701.*line limit/);
    const sharedPrefix = 'A visible event with a very long but identical leading description that fills the whole derived title prefix ';
    const distinct = valid.map((line, at) => at === 3 ? `C|${sharedPrefix}one appears` :
        at === 4 ? `C|${sharedPrefix}two appears` : line).join('\n');
    const criteria = parse(distinct).draft.phases[0].gates[0].criteria;
    assert.notEqual(criteria[0].title, criteria[1].title);
    assert.ok(criteria.every(item => item.title.length <= 120));
});

test('RM1 and JSON count real operations while enforcing the 64-entity projection ceiling', () => {
    const lines = ['RM1'];
    for (let phase = 1; phase <= 5; phase++) {
        lines.push(`P|Phase ${phase}|Deliver phase ${phase}`);
        for (let gate = 1; gate <= 2; gate++) {
            lines.push(`G|Gate ${gate}|Demonstrate gate ${gate}`);
            for (let criterion = 1; criterion <= 4; criterion++)
                lines.push(`C|Phase ${phase} gate ${gate} result ${criterion} is visible`);
        }
    }
    lines.push('END');
    const candidate = parseRoadmapMarkers(lines.join('\n'), 'stop');
    assert.equal(candidate.draft.phases.length, 5);
    assert.equal(candidate.draft.phases.reduce((count, phase) => count + phase.gates.length +
        phase.gates.reduce((sum, gate) => sum + gate.criteria.length, 0), 0) + 5, 55);
    assert.equal(parseTypedRoadmapDraft(JSON.stringify(candidate.draft), 'stop').draft.phases.length, 5);
    const tooMany = lines.slice(0, -1);
    for (let gate = 3; gate <= 4; gate++) {
        tooMany.push(`G|Gate ${gate}|Expand the result`);
        for (let criterion = 1; criterion <= 6; criterion++)
            tooMany.push(`C|Additional gate ${gate} result ${criterion} appears`);
    }
    tooMany.push('END');
    assert.throws(() => parseRoadmapMarkers(tooMany.join('\n'), 'stop'), /at most 64/);
    const phases = Array.from({ length: 12 }, (_, at) => ({
        title: `Phase ${at}`, objective: 'Deliver visible behavior',
        ...(at ? { dependsOn: [at] } : {}),
        gates: Array.from({ length: at < 2 ? 3 : 2 }, (_, gate) => ({
            title: `Gate ${gate}`, purpose: 'Show visible behavior',
            criteria: [{ title: 'Observable result', expectedResult: `Phase ${at} gate ${gate} is visible` }]
        }))
    }));
    assert.throws(() => parseTypedRoadmapDraft(JSON.stringify({
        type: 'roadmap-draft', schemaVersion: 1, phases
    }), 'stop'), /49 operations; at most 48/);
    assert.equal(parseTypedRoadmapDraft(JSON.stringify({
        type: 'roadmap-draft', schemaVersion: 1,
        phases: [{ ...phases[0], gates: phases[0].gates.slice(0, 2) }, ...phases.slice(1)]
    }), 'stop').draft.phases.length, 12);
});

const towerDraft = () => ({ type: 'roadmap-draft', schemaVersion: 1, phases: [
    ['Path and enemies', 'Build a fixed waypoint path', 'Enemies traverse waypoints with health',
        'Spawn enemies', 'Enemies spawn and move through each fixed waypoint until health reaches zero'],
    ['Tower combat', 'Build a basic tower', 'Tower targets enemies and fires projectiles',
        'Cooldown', 'One tower type fires a projectile at a target only after its cooldown expires'],
    ['Waves', 'Deliver waves', 'Wave completion and next wave',
        'Wave advance', 'After all enemies are defeated, the next wave begins'],
    ['Economy', 'Add earned and spent currency', 'Kills earn currency and tower placement spends it',
        'Spend currency', 'A kill adds currency; buying a tower or ability deducts the displayed cost'],
    ['Main tower and defeat', 'Keep health between waves', 'Persistent main tower health and defeat',
        'Zero health defeat', 'Main tower health persists across waves and zero health ends the game']
].map(([title, objective, gateTitle, criterionTitle, expectedResult], index) => ({
    title, objective, ...(index ? { dependsOn: [index] } : {}), gates: [
        { title: gateTitle, purpose: objective, criteria: [{ title: criterionTitle, expectedResult }] },
        { title: `${title} acceptance`, purpose: `Check ${objective.toLowerCase()}`,
            criteria: [{ title: `${title} observable result`, expectedResult: `${objective} is visible in play` },
                { title: `${title} regression`, expectedResult: index === 4 ?
                    'Optional later features are separated from the MVP acceptance path' :
                    `A fresh play session demonstrates ${objective.toLowerCase()}` }] }
    ]
})) });

test('one compact typed five-Phase draft is complete and remains untrusted', async () => {
    const draft = towerDraft();
    const text = JSON.stringify(draft);
    assert.ok(Buffer.byteLength(text) < roadmapLocalBudget(16384, 4096).maxOutputBytes);
    let calls = 0;
    const candidate = await generateTypedRoadmapDraft(async function* () {
        calls++;
        yield { type: 'delta', text };
        yield { type: 'complete', text, finishReason: 'stop' };
    }, new AbortController().signal, roadmapLocalBudget(16384, 4096).maxOutputBytes,
    [{ label: 'waypoints', terms: ['waypoint'] }, { label: 'spending', terms: ['spends', 'deducts'] },
        { label: 'defeat', terms: ['zero health'] }]);
    assert.equal(calls, 1);
    assert.equal(candidate.kind, 'untrusted-typed-roadmap-draft');
    assert.equal(candidate.draft.phases.length, 5);
    assert.equal(candidate.draft.phases.reduce((n, phase) => n + phase.gates.length, 0), 10);
    assert.equal(candidate.draft.phases.reduce((n, phase) => n +
        phase.gates.reduce((count, gate) => count + gate.criteria.length, 0), 0), 15);
    assert.deepEqual(candidate.coverageWarnings, []);
    assert.ok(!JSON.stringify(candidate).includes('projectId'));
    assert.match(typedRoadmapDraftInstruction(['currency spending']), /currency spending/);
    assert.doesNotMatch(typedRoadmapDraftInstruction(), /expectedStage/);
});

test('typed Roadmap rejects incomplete, oversized, foreign authority and invalid nested fields', () => {
    const draft = towerDraft();
    const parse = (value: unknown) => parseTypedRoadmapDraft(JSON.stringify(value), 'stop');
    assert.throws(() => parseTypedRoadmapDraft(JSON.stringify(draft), 'length'), /truncated/);
    assert.throws(() => parseTypedRoadmapDraft(JSON.stringify(draft).slice(0, -1), 'stop'), /malformed JSON/);
    assert.throws(() => parseTypedRoadmapDraft(JSON.stringify(draft), 'stop', [], 100), /reserved output/);
    for (const field of ['projectId', 'ownerRevision', 'sourceHash', 'operationId', 'uuid', 'expectedStage', 'approvalToken'])
        assert.throws(() => parse({ ...draft, [field]: 'forged' }), new RegExp(field));
    assert.throws(() => parse({ ...draft, phases: [{ ...draft.phases[0], gates: [] }, ...draft.phases.slice(1)] }), /gates needs/);
    assert.throws(() => parse({ ...draft, phases: [{ ...draft.phases[0], gates: [
        { ...draft.phases[0].gates[0], criteria: [] }] }, ...draft.phases.slice(1)] }), /criteria needs/);
    assert.throws(() => parse({ ...draft, phases: [{ ...draft.phases[0], status: 'green' }, ...draft.phases.slice(1)] }), /status/);
    assert.throws(() => parse({ ...draft, phases: [{ ...draft.phases[0], checkpoints: [] }, ...draft.phases.slice(1)] }), /checkpoints/);
    assert.throws(() => parse({ ...draft, phases: [{ ...draft.phases[0], gates: [
        { ...draft.phases[0].gates[0], criteria: [{ ...draft.phases[0].gates[0].criteria[0],
            expectedResult: 'Passed' }] }] }, ...draft.phases.slice(1)] }), /observable behavior/);
    assert.throws(() => parse({ ...draft, phases: draft.phases.map((phase, index) => ({ ...phase,
        title: `${phase.title} ${index}`, gates: Array.from({ length: 8 }, (_, gateIndex) => ({
            title: `Gate ${gateIndex}`, purpose: 'Check the deliverable', criteria: [
                { title: 'Observable A', expectedResult: 'The player sees the expected result' },
                { title: 'Observable B', expectedResult: 'The player sees a second result' }
            ] })) })) }), /at most 48/);
});

test('typed Roadmap rejects duplicate titles and invalid phase dependencies with precise paths', () => {
    const draft = towerDraft();
    const parse = (value: unknown) => parseTypedRoadmapDraft(JSON.stringify(value), 'stop');
    assert.throws(() => parse({ ...draft, phases: [draft.phases[0],
        { ...draft.phases[1], title: draft.phases[0].title }, ...draft.phases.slice(2)] }), /duplicate titles/);
    assert.throws(() => parse({ ...draft, phases: [draft.phases[0],
        { ...draft.phases[1], dependsOn: [2] }, ...draft.phases.slice(2)] }), /dependsOn/);
    assert.throws(() => parse({ ...draft, phases: [draft.phases[0],
        { ...draft.phases[1], dependsOn: [1, 1] }, ...draft.phases.slice(2)] }), /dependsOn/);
    assert.deepEqual(parseTypedRoadmapDraft(JSON.stringify(draft), 'stop',
        [{ label: 'multiplayer', terms: ['multiplayer'] }]).coverageWarnings,
    ['No Gate/Criterion text explicitly covers multiplayer']);
});

test('typed generation is one bounded call and cancellation or prose is non-applicable', async () => {
    const controller = new AbortController();
    let calls = 0;
    await assert.rejects(generateTypedRoadmapDraft(async function* () {
        calls++;
        controller.abort();
        yield { type: 'complete', text: JSON.stringify(towerDraft()) };
    }, controller.signal, 16384), /cancelled/);
    assert.equal(calls, 1);
    await assert.rejects(generateTypedRoadmapDraft(async function* () {
        yield { type: 'delta', text: '{'.repeat(200) };
    }, new AbortController().signal, 100), /reserved output/);
    await assert.rejects(generateTypedRoadmapDraft(async function* () {
        yield { type: 'complete', text: 'This is a read-only Chat answer.' };
    }, new AbortController().signal, 16384), /malformed JSON/);
    await assert.rejects(generateTypedRoadmapDraft(async function* () {
        yield { type: 'delta', text: '{}' };
    }, new AbortController().signal, 16384), /without completion/);
    await assert.rejects(generateTypedRoadmapDraft(async function* () {
        yield { type: 'activity', kind: 'tool', text: 'roadmap_stage' };
        yield { type: 'complete', text: JSON.stringify(towerDraft()) };
    }, new AbortController().signal, 16384), /attempted a tool call/);
});

test('strict Planning buffers JSON while forwarding genuine activity before validation', async () => {
    const seen: string[] = [];
    const output = JSON.stringify({ type: 'no-action', message: 'The Gate remains unchanged.' });
    const result = await localPlanningJson(async function* () {
        yield { type: 'activity', kind: 'thinking', text: 'Checking source' };
        yield { type: 'activity', kind: 'tool', text: 'read_file: completed · ROADMAP.md' };
        yield { type: 'delta', text: output.slice(0, 20) };
        yield { type: 'delta', text: output.slice(20) };
        assert.deepEqual(seen, ['thinking:Checking source', 'tool:read_file: completed · ROADMAP.md']);
        yield complete(output);
    }, new AbortController().signal, 4096, 'gate', true, {
        onActivity: (kind, text) => seen.push(`${kind}:${text}`)
    });
    assert.equal(result.text, output);
    assert.equal(seen.length, 2);
    const failureActivity: string[] = [];
    await assert.rejects(localPlanningJson(async function* () {
        yield { type: 'activity', kind: 'thinking', text: 'Could not finish' };
        yield complete('{"type":"final","text":"not a planning envelope"}');
    }, new AbortController().signal, 4096, 'gate', true, {
        onActivity: (kind, text) => failureActivity.push(`${kind}:${text}`)
    }), /strict JSON/);
    assert.deepEqual(failureActivity, ['thinking:Could not finish', 'thinking:Could not finish']);
    const cancelled = new AbortController();
    await assert.rejects(localPlanningJson(async function* () {
        yield { type: 'activity', kind: 'thinking', text: 'Started' };
        cancelled.abort();
        yield complete(output);
    }, cancelled.signal, 4096, 'gate', true, {
        onActivity: (kind, text) => seen.push(`${kind}:${text}`)
    }), /cancelled/);
});

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

test('schema-two question retry asks for a no-action JSON envelope after plain prose', async () => {
    const hints: Array<string | undefined> = [];
    const answer = '{"type":"no-action","message":"G1 verifies demo readiness."}';
    const result = await localPlanningJson(async function* (hint) {
        hints.push(hint);
        yield complete(hints.length === 1 ? 'G1 verifies demo readiness.' : answer);
    }, new AbortController().signal, 4096, 'gate');
    assert.equal(result.text, answer);
    assert.equal(hints[0], undefined);
    assert.match(hints[1]!, /read-only schema-2 Roadmap answer/);
    assert.match(hints[1]!, /"type":"no-action"/);
});

test('an explicitly read-only schema-two question can show bounded plain prose as no-action', async () => {
    const prose = 'G1 verifies demo readiness.';
    const result = await localPlanningJson(async function* () { yield complete(prose); },
        new AbortController().signal, 4096, 'gate', true, { allowPlainNoAction: true });
    assert.deepEqual(JSON.parse(result.text), { type: 'no-action', message: prose });
    await assert.rejects(localPlanningJson(async function* () { yield complete(prose); },
        new AbortController().signal, 4096, 'gate'), /strict JSON/);
    await assert.rejects(localPlanningJson(async function* () { yield complete('{bad'); },
        new AbortController().signal, 4096, 'gate', true, { allowPlainNoAction: true }), /strict JSON/);
});

test('plain Gate questions stay read-only and text mutation envelopes cannot stage a proposal', async () => {
    const readRequest = 'Read ROADMAP.md using read_file once. What is the exact Gate G1 heading? Answer only; do not edit files.';
    const prose = 'The exact Gate G1 heading is: Release readiness.';
    assert.equal(allowsPlainGateAnswer(readRequest), true);
    assert.equal(allowsPlainGateAnswer('What is the exact Gate G1 heading?'), true);
    assert.equal(allowsPlainGateAnswer('Remove Gate G1 and its Criterion; explain the next step.'), false);
    assert.equal(allowsPlainGateAnswer('Read ROADMAP.md and propose a change to Gate G1.'), false);
    const result = await localPlanningJson(async function* () { yield complete(prose); },
        new AbortController().signal, 4096, 'gate', true,
        { allowPlainNoAction: allowsPlainGateAnswer(readRequest) });
    assert.deepEqual(JSON.parse(result.text), { type: 'no-action', message: prose });
    const mutation = JSON.stringify({ type: 'roadmap-gate-proposal', projectId: 'owner', ownerRevision: 2,
        actions: [{ type: 'phase.create', id: 'new:phase', title: 'Unreviewed', objective: 'No write' }] });
    let attempts = 0;
    await assert.rejects(localPlanningJson(async function* () { attempts++; yield complete(mutation); },
        new AbortController().signal, 4096, 'gate'), /strict JSON/);
    assert.equal(attempts, 2);
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
