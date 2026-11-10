import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveChatSkill } from '../../packages/theia-extension/lib/node/chat-skills.js';
import { trustedOperationForTurn } from '../../packages/theia-extension/lib/node/operation-context-policy.js';

test('only bound prompt command stages select protected policy classes', () => {
    for (const stage of ['prompt-ass', 'prompt-plan', 'prompt-write'] as const) {
        const parsed = promptStageCommand(stage === 'prompt-ass' ? '/prompt-ass c0-test Do work' : `/${stage}`,
            stage);
        assert.equal(trustedOperationForTurn({ promptStage: parsed?.stage, docsReview: false,
            roadmapEdit: false, investigation: false }), stage);
    }
    assert.equal(trustedOperationForTurn({ promptStage: promptStageCommand('Quote /prompt-write', undefined)?.stage,
        docsReview: false, roadmapEdit: false, investigation: false }), 'chat');
});
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { assertPromptDraftNameAvailable, finishedPromptStack, finishedPromptText, newPromptDraftIdentity,
    priorPromptDraft, promptStageCommand, promptStageInstruction, verifyPromptDraftIdentity, verifyPromptDraftSourceBasis,
    verifyPromptDraftSource, validatedAssessment, renderAssessment, validatedPlan, renderPlan,
    requestedWorkPromptCount, planReceiptCurrent, validateAssessmentTiers,
    validatedAssessmentWireframe } from '../../packages/theia-extension/lib/node/prompt-authoring-stage.js';

test('shared tier contract identifies the missing responsibility before acceptance', () => {
    const valid = { T1: 'Focused source and unit validation',
        T2: 'Cross-boundary integration validation',
        T3: 'Independent manual browser qualification' };
    assert.doesNotThrow(() => validateAssessmentTiers(valid));
    assert.throws(() => validateAssessmentTiers({ ...valid, T1: 'Unit tests' }),
        /ASSESSMENT_TIERS: T1/);
    assert.throws(() => validateAssessmentTiers({ ...valid, T2: 'Documentation only' }),
        /ASSESSMENT_TIERS: T2/);
    assert.throws(() => validateAssessmentTiers({ ...valid, T3: 'Release notes' }),
        /ASSESSMENT_TIERS: T3/);
});

test('structured plan checks requested ten work tasks, source, order, T2/T3 and all efficiency gates', () => {
    const finding = { claim: 'Read relevant source', path: 'src/clamp.ts', start: 0, end: 20,
        sourceHash: 'a'.repeat(64), quote: 'source' };
    const assessment = { scope: 'Clamp feature', observations: [finding], preservation: [finding],
        dependencies: [finding], risks: [finding],
        tiers: { T1: 'Focused implementation', T2: 'Integration', T3: 'Manual browser closeout' },
        omittedRequestedFiles: [] };
    const refs = [{ kind: 'file', id: 'src/clamp.ts', origin: 'tool', sourceHash: 'a'.repeat(64) },
        { kind: 'file', id: 'test/clamp.test.ts', origin: 'tool', sourceHash: 'b'.repeat(64) }] as never;
    const work = Array.from({ length: 10 }, (_, index) => ({ id: `step-${index + 1}`,
        title: `Implement clamp responsibility ${index + 1}`,
        objective: `Implement bounded clamp responsibility ${index + 1} in verified source`,
        tier: index === 9 ? 'T2' : 'T1', dependsOn: index ? [`step-${index}`] : [],
        workingSet: ['src/clamp.ts'], validationTargets: [`Run test/clamp.test.ts for case ${index + 1}`],
        buildNeeds: 'Compile changed extension lib for compiled-import tests',
        acceptanceCriteria: [`Clamp responsibility ${index + 1} works`] }));
    const closeout = { title: 'Manual clamp closeout', objective: 'Observe clamp in browser',
        manualReason: 'Human interaction needs observation', browserRequired: true, tier: 'T3',
        acceptanceCriteria: ['Observe bounded behavior'] };
    const efficiencyAudit = [
        'Single responsibility and narrow boundary per task',
        'Runtime target 8 minutes, soft 10 and hard 15 minutes',
        'Test precision uses focused unit cases',
        'Build precision compiles changed lib only',
        'Evidence distribution puts integration in T2 and manual browser in T3',
        'Command deduplication avoids repeated aggregate runs',
        'Model economy uses Medium and defers unrelated features',
        'Runnable traceable grammar preserves version and closeout',
        'UI Design Compliance follows ADR 0016 and semantic theme tokens when applicable',
        'Human Usability follows ADR 0037, keyboard and recovery when applicable' ];
    const plan = { work, closeout, efficiencyAudit };
    const check = (candidate: unknown, source = refs, record = assessment, count = 10) =>
        validatedPlan(JSON.stringify(candidate), record, source, count);
    assert.equal(requestedWorkPromptCount('Build ten work tasks plus closeout'), 10);
    assert.equal(requestedWorkPromptCount('Use one work prompt and a manual closeout'), 1);
    assert.equal(requestedWorkPromptCount('Use four implementation prompts'), 4);
    assert.equal(check(plan).work.length, 10);
    assert.match(renderPlan(check(plan)), /Final manual closeout \(T3\)/);
    const receipt = `Plan record sha256: ${'a'.repeat(64)}; revision: 1.`;
    assert.equal(planReceiptCurrent(receipt, 'a'.repeat(64), 1), true);
    assert.equal(planReceiptCurrent(receipt, 'a'.repeat(64), 2), false);
    assert.equal(planReceiptCurrent(receipt, 'b'.repeat(64), 1), false);
    assert.throws(() => check({ ...plan, work: work.slice(0, 9) }), /PLAN_WORK_COUNT/);
    assert.throws(() => check({ ...plan, work: work.map((item, index) => index === 1 ?
        { ...item, dependsOn: ['step-3'] } : item) }), /PLAN_WORK_CONTENT/);
    assert.throws(() => check({ ...plan, work: work.map((item, index) => index === 2 ?
        { ...item, workingSet: ['src/invented.ts'] } : item) }), /PLAN_UNSUPPORTED_SOURCE/);
    assert.throws(() => check({ ...plan, work: work.map((item, index) => index === 0 ?
        { ...item, objective: 'Validate T1 read tier only' } : item) }), /PLAN_UNSUPPORTED_ASSUMPTION|PLAN_WORK_CONTENT/);
    assert.throws(() => check({ ...plan, work: work.map((item, index) => index === 0 ?
        { ...item, buildNeeds: 'Add a CommonJS adapter and CI pipeline' } : item) }), /PLAN_UNSUPPORTED_ASSUMPTION/);
    assert.throws(() => check(plan, [] as never), /PLAN_READ_REQUIRED/);
    assert.throws(() => check(plan, refs, { ...assessment, omittedRequestedFiles: ['docs/late-guide.md'] }),
        /PLAN_MISSING_SOURCE/);
    assert.throws(() => check({ ...plan, work: work.map(item => ({ ...item, tier: 'T1' })) }), /PLAN_T2_REQUIRED/);
    assert.throws(() => check({ ...plan, closeout: { ...closeout, tier: 'T2' } }), /PLAN_T3_CLOSEOUT/);
    assert.throws(() => check({ ...plan, efficiencyAudit: efficiencyAudit.map((item, index) =>
        index === 8 ? 'Ninth gate checks CI deployment' : item) }), /PLAN_EFFICIENCY_GATE_9/);
    assert.throws(() => check({ ...plan, efficiencyAudit: efficiencyAudit.map((item, index) =>
        index === 9 ? 'Tenth gate checks browser packaging' : item) }), /PLAN_EFFICIENCY_GATE_10/);
});

const choice = (id: string, title: string, tier: 'T1' | 'T2', dependsOn: string[] = []) => ({
    tier, model: 'GPT-6 Sol Medium', estimatedMinutes: 6,
    ...(tier === 'T2' ? { integrationChecks: ['Run the affected integration test'] } : {}),
    workItem: { id, title, objective: `Implement ${title}`, dependsOn,
        requirements: ['Preserve source authority'], constraints: ['Do not auto-run Work'],
        acceptanceCriteria: ['The affected path works'], validationTargets: ['Run focused tests'],
        workingSet: ['src/feature.js'], status: 'draft',
        delegablePaths: ['src/feature.js'], humanReservedPaths: [] }
});

test('native prompt commands bind leading protected invocation and draft exact validated bytes', async () => {
    const prior = { assessment: { id: 'assessment-1', content: '# Unpublished prompt assessment\n\nDraft only. This command did not change project files or start Work.\n\nScope checked.' },
        plan: { id: 'plan-1', content: '# Unpublished prompt plan\n\nDraft only. This command did not change project files or start Work.\n\nTwo steps.' } } as never;
    assert.deepEqual(promptStageCommand('/prompt-ass c0-feature Build a feature', 'prompt-ass'),
        { stage: 'prompt-ass', folder: 'c0-feature', details: 'Build a feature' });
    assert.throws(() => promptStageCommand('/prompt-ass', 'prompt-ass'), /Usage/);
    assert.throws(() => promptStageCommand('/prompt-ass c0-feature', 'prompt-ass'), /Usage/);
    for (const name of ['../escape', 'éclair', 'UPPER', 'a--b', 'ab', 'drafts'])
        assert.throws(() => promptStageCommand(`/prompt-ass ${name} Do work`, 'prompt-ass'));
    assert.deepEqual(promptStageCommand('/prompt-plan review more', 'prompt-plan'), { stage: 'prompt-plan' });
    assert.equal(promptStageCommand('`/prompt-ass`', undefined), undefined);
    assert.equal(promptStageCommand('Please /prompt-ass', undefined), undefined);
    assert.deepEqual(promptStageCommand('/prompt-write', 'prompt-write'), { stage: 'prompt-write' });
    assert.throws(() => promptStageCommand('/prompt-write ../escape', 'prompt-write'));
    assert.deepEqual(promptStageCommand('/prompt-write add focused checks', 'prompt-write'),
        { stage: 'prompt-write' });
    const input = { folderName: 'c0-feature', sourceKind: 'chat-plan', version: '1.2.3',
        sourceVersion: '1.2.3', work: [choice('step-1', 'Add feature', 'T1'),
            choice('step-2', 'Integrate feature', 'T2', ['step-1'])],
        closeout: { title: 'Feature closeout', objective: 'Check the feature in the browser',
            manualReason: 'Human interaction', acceptanceCriteria: ['Open the feature'],
            model: 'GPT-6 Sol High', browserRequired: true } };
    const result = await finishedPromptStack(JSON.stringify(input), input.folderName, input.sourceVersion, prior);
    assert.match(result.text, /Unpublished prompt stack draft/);
    assert.equal(result.draft.files.length, 3);
    assert.match(result.draft.files[0].text, /Draft Chat plan step: step-1/);
    assert.doesNotMatch(result.draft.files[0].text, /Accepted WorkItem/);
    assert.match(result.draft.files[2].text, /Browser required: yes/);
    assert.equal(result.draft.files[2].filename, 'P3-feature-closeout.txt');
    assert.match(result.text, /docs\/tasks\/c0-feature\/prompt-assessment\.md/);
    assert.match(result.text, /docs\/tasks\/c0-feature\/implementation-plan\.md/);
    assert.match(result.text, /assessment-1/);
    const compact = { work: [
        { id: 'step-1', title: 'Add feature', objective: 'Implement feature', tier: 'T1',
            dependsOn: [], workingSet: ['src/feature.js'], acceptanceCriteria: ['Feature works'],
            validationTargets: ['Run feature unit test'] },
        { id: 'step-2', title: 'Integrate feature', objective: 'Check feature', tier: 'T2',
            dependsOn: ['step-1'], workingSet: ['src/feature.js'],
            acceptanceCriteria: ['Feature integration passes'], validationTargets: ['Run integration test'],
            integrationChecks: ['Run integration test'] } ],
        closeout: { title: 'Feature closeout', objective: 'Observe the feature',
            manualReason: 'Human inspection', acceptanceCriteria: ['Feature is visible'], browserRequired: true } };
    const compactResult = await finishedPromptStack(JSON.stringify(compact), input.folderName, input.sourceVersion, prior);
    assert.equal(compactResult.draft.files.length, 3);
    assert.match(compactResult.draft.files[0].text, /Draft Chat plan step: step-1/);
    await assert.rejects(finishedPromptStack(JSON.stringify({ ...compact, work: compact.work.map((step, index) =>
        index === 0 ? { ...step, acceptanceCriteria: ['Requested behavior works'] } : step) }),
    input.folderName, input.sourceVersion, prior), /generic example text/);
    const planRequiresTest = { ...prior, plan: { ...prior.plan, content: `${prior.plan.content}\nUpdate test suite.`,
        execution: { sourceRefs: [{ kind: 'file', id: 'test/feature.test.js' }] } } } as never;
    await assert.rejects(finishedPromptStack(JSON.stringify(compact), input.folderName,
        input.sourceVersion, planRequiresTest), /omitted a test file/);
    const withTest = { ...compact, work: compact.work.map((step, index) => index === 0 ?
        { ...step, workingSet: ['src/feature.js', 'test/feature.test.js'] } : step) };
    const testResult = await finishedPromptStack(JSON.stringify(withTest), input.folderName,
        input.sourceVersion, planRequiresTest);
    assert.match(testResult.draft.files[0].text, /test\/feature\.test\.js/);
    await assert.rejects(finishedPromptStack(JSON.stringify({ ...input, sourceVersion: '1.2.4' }),
        input.folderName, input.sourceVersion, prior), /source version/);
    await assert.rejects(finishedPromptStack('{oops}', input.folderName, input.sourceVersion, prior), /JSON/);
});

test('named draft rejects duplicate and canonical names, foreign owners and projects', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-named-prompt-'));
    try {
        const draft = newPromptDraftIdentity('c0-feature', root, randomUUID(), randomUUID(),
            'owner-lease', 'head', '0.13.11', 'a'.repeat(64));
        assert.equal(verifyPromptDraftIdentity(draft, root, draft.chatId, draft.userMessageId,
            'owner-lease').id, draft.id);
        assert.throws(() => verifyPromptDraftIdentity(draft, root + '-foreign', draft.chatId,
            draft.userMessageId, 'owner-lease'), /another project/);
        assert.throws(() => verifyPromptDraftIdentity(draft, root, draft.chatId,
            draft.userMessageId, 'foreign-lease'), /owner lease/);
        verifyPromptDraftSourceBasis(draft, { head: 'head', packageVersion: '0.13.11',
            worktreeFingerprint: 'a'.repeat(64) });
        assert.throws(() => verifyPromptDraftSourceBasis(draft, { head: 'new-head',
            packageVersion: '0.13.11', worktreeFingerprint: 'a'.repeat(64) }), /source changed/);
        assert.throws(() => verifyPromptDraftSourceBasis(draft, { head: 'head',
            packageVersion: '0.13.12', worktreeFingerprint: 'a'.repeat(64) }), /source changed/);
        assert.throws(() => verifyPromptDraftSourceBasis(draft, { head: 'head',
            packageVersion: '0.13.11', worktreeFingerprint: 'b'.repeat(64) }), /source changed/);
        await assert.rejects(assertPromptDraftNameAvailable(root, [{ messages: [
            { role: 'user', promptDraft: draft }] } as never], 'c0-feature'), /already exists/);
        await mkdir(join(root, 'docs', 'tasks', 'c0-feature'), { recursive: true });
        await assert.rejects(assertPromptDraftNameAvailable(root, [], 'c0-feature'), /Task directory/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('saved assessment is selected only from completed protected Chat and current broker-read source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-prompt-stage-'));
    try {
        await writeFile(join(root, 'README.md'), 'Original source');
        const grounder = new ChatProjectGrounder({} as never);
        const page = await grounder.readFileRange(root, 'README.md', 0, 4);
        const content = finishedPromptText('prompt-ass', 'Scope\nSource basis: README.md', [],
            '/prompt-ass Read README.md and AGENTS.md');
        assert.match(content, /Explicitly requested paths not read: README\.md, AGENTS\.md/);
        const skill = await resolveChatSkill('/prompt-ass');
        const assistant = { id: randomUUID(), role: 'assistant', content,
            execution: { status: 'complete', sourceRefs: [{ kind: 'file', id: 'README.md',
                projectId: createHash('sha256').update(root).digest('hex'),
                sourceHash: page.sourceHash }] } };
        const chat = { messages: [{ role: 'user', content: '/prompt-ass', skill }, assistant] } as never;
        assert.equal(priorPromptDraft(chat, 'prompt-ass')?.assistant.id, assistant.id);
        const retried = { messages: [{ role: 'user', content: '/prompt-ass', skill },
            { role: 'assistant', content: 'Interrupted before completion', execution: { status: 'failed' } },
            assistant] } as never;
        assert.equal(priorPromptDraft(retried, 'prompt-ass')?.assistant.id, assistant.id);
        await verifyPromptDraftSource(root, assistant as never, grounder);
        const full = await grounder.readFile(root, 'README.md');
        await verifyPromptDraftSource(root, { execution: { sourceRefs: [{ kind: 'file',
            id: 'README.md', sourceHash: full.blocks[0].ref.sourceHash,
            projectId: createHash('sha256').update(root).digest('hex'),
            contentHash: full.blocks[0].ref.contentHash }] } } as never, grounder);
        await writeFile(join(root, 'README.md'), 'large'.repeat(3000));
        const large = await grounder.readFile(root, 'README.md');
        await verifyPromptDraftSource(root, { execution: { sourceRefs: [{ kind: 'file',
            id: 'README.md', sourceHash: large.blocks[0].ref.sourceHash,
            projectId: createHash('sha256').update(root).digest('hex'),
            contentHash: createHash('sha256').update(large.blocks[0].text.slice(0, 8192)).digest('hex')
        }] } } as never, grounder);
        await assert.rejects(verifyPromptDraftSource(root, { execution: { sourceRefs: [{ kind: 'file',
            id: 'README.md', sourceHash: full.blocks[0].ref.sourceHash,
            projectId: 'foreign-project', contentHash: full.blocks[0].ref.contentHash }] } } as never,
        grounder), /identity/);
        await writeFile(join(root, 'README.md'), 'Changed source');
        await assert.rejects(verifyPromptDraftSource(root, assistant as never, grounder), /changed/);
        const forged = { messages: [{ role: 'user', content: '/prompt-ass',
            skill: { ...skill, digest: createHash('sha256').update('forged').digest('hex') } }, assistant] } as never;
        assert.equal(priorPromptDraft(forged, 'prompt-ass'), undefined);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('structured assessment requires actual brokered byte ranges and discloses omitted requests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-assessment-range-'));
    try {
        await writeFile(join(root, 'README.md'), `${'early\n'.repeat(900)}late section\n`);
        const grounder = new ChatProjectGrounder({} as never);
        const first = await grounder.readFileRange(root, 'README.md', 0, 4096);
        const late = await grounder.readFileRange(root, 'README.md', 5400, 256, first.sourceHash);
        const projectId = createHash('sha256').update(root).digest('hex');
        const refs = [{ kind: 'directory', id: 'docs', origin: 'tool' },
            { kind: 'path-search', id: 'AGENTS.md', origin: 'tool' },
            ...[first, late].map(page => ({ kind: 'file', id: page.path, origin: 'tool',
                projectId, sourceHash: page.sourceHash, start: page.offset, end: page.endOffset }))] as never;
        const finding = { claim: 'Late source section is present', path: 'README.md',
            quote: 'late section' };
        const evidence = [first, late].map(page => ({ path: page.path, start: page.offset,
            end: page.endOffset, sourceHash: page.sourceHash, text: page.text }));
        const input = { scope: 'Assess the requested source', observations: [finding],
            preservation: [finding], dependencies: [finding], risks: [finding],
            tiers: { T1: 'Focused source test', T2: 'Cross-boundary integration',
                T3: 'Independent manual browser qualification' } };
        const record = validatedAssessment(JSON.stringify(input), refs,
            '/prompt-ass safe-task Inspect README.md and AGENTS.md', evidence);
        assert.deepEqual(record.omittedRequestedFiles, ['AGENTS.md']);
        assert.match(renderAssessment(record), /README\.md bytes 5400/);
        assert.equal(record.observations[0].sourceHash, late.sourceHash);
        assert.equal(record.observations[0].end, 5412);
        assert.match(renderAssessment(record), /T1 focused source and unit checks/);
        assert.match(renderAssessment(record), /T2 cross-boundary integration/);
        assert.match(renderAssessment(record), /T3 independent manual browser qualification/);
        assert.throws(() => validatedAssessment(JSON.stringify({ ...input,
            observations: [{ ...finding, path: 'AGENTS.md' }] }), refs, '', evidence), /UNSUPPORTED_SOURCE/);
        assert.throws(() => validatedAssessment(JSON.stringify({ ...input,
            observations: [{ ...finding, quote: 'early\nlate section' }] }), refs, '', evidence), /UNSUPPORTED_SOURCE/);
        assert.throws(() => validatedAssessment(JSON.stringify({ ...input,
            observations: [{ ...finding, quote: 'false' }] }), refs, '', evidence), /UNSUPPORTED_SOURCE/);
        assert.throws(() => validatedAssessment('x'.repeat(20_001), refs, '', evidence), /PAYLOAD_LIMIT/);
        await writeFile(join(root, 'README.md'), 'changed');
        await assert.rejects(grounder.readFileRange(root, 'README.md', 0, 1, first.sourceHash), /Stale/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('assessment resolves exact ASCII and UTF-8 citations across brokered pages and files', () => {
    const pages = [
        { path: 'src/clamp.js', start: 0, text: 'export const café = 1;\n', sourceHash: 'a'.repeat(64) },
        { path: 'src/clamp.js', start: 100, text: 'return Math.min(value, max);\n', sourceHash: 'a'.repeat(64) },
        { path: 'test/clamp.test.js', start: 0, text: 'assert.equal(clamp(4), 4);\n', sourceHash: 'b'.repeat(64) }
    ].map(page => ({ ...page, end: page.start + Buffer.byteLength(page.text, 'utf8') }));
    const refs = pages.map(page => ({ kind: 'file', id: page.path, origin: 'tool',
        sourceHash: page.sourceHash, start: page.start, end: page.end })) as never;
    const findings = [
        { claim: 'Unicode source', path: 'src/clamp.js', quote: 'café' },
        { claim: 'Late source', path: 'src/clamp.js', quote: 'Math.min(value, max)' },
        { claim: 'Test source', path: 'test/clamp.test.js', quote: 'clamp(4)' }
    ];
    const input = { scope: 'Review clamp source', observations: findings,
        preservation: [findings[0]], dependencies: [findings[1]], risks: [findings[2]],
        tiers: { T1: 'Focused source tests', T2: 'Integration',
            T3: 'Independent manual browser qualification' } };
    const check = (candidate: unknown, read = refs, observed = pages) =>
        validatedAssessment(JSON.stringify(candidate), read, '', observed);
    const record = check(input);
    assert.deepEqual(record.observations.map(item => [item.start, item.end, item.sourceHash]),
        [[13, 18, 'a'.repeat(64)], [107, 127, 'a'.repeat(64)], [13, 21, 'b'.repeat(64)]]);
    assert.throws(() => check({ ...input, observations: [{ ...findings[0], quote: 'never observed' }] }),
        /UNSUPPORTED_SOURCE/);
    assert.throws(() => check({ ...input, observations: [{ ...findings[0], path: 'test/clamp.test.js' }] }),
        /UNSUPPORTED_SOURCE/);
    assert.throws(() => check({ ...input, observations: [{ ...findings[0], path: 'listed.js' }] },
        [...refs, { kind: 'path-search', id: 'listed.js', origin: 'tool' }] as never), /UNSUPPORTED_SOURCE/);
    assert.throws(() => check(input, refs.slice(1) as never), /UNSUPPORTED_SOURCE/);
    assert.throws(() => check(input, refs, pages.map(page => page.path === 'src/clamp.js' && page.start === 0 ?
        { ...page, sourceHash: 'c'.repeat(64) } : page)), /UNSUPPORTED_SOURCE/);
    assert.throws(() => check({ ...input, observations: [{ ...findings[0], quote: 'Math.min(value, max);\nnot read' }] }),
        /UNSUPPORTED_SOURCE/);
    assert.throws(() => check({ ...input, observations: [{ ...findings[0], start: 0,
        end: 18, sourceHash: 'a'.repeat(64) }] }), /ASSESSMENT_CITATION/);
    assert.throws(() => check({ ...input, observations: [{ ...findings[0], quote: 'export' }] },
        [...refs, { kind: 'file', id: 'src/clamp.js', origin: 'tool',
            sourceHash: 'a'.repeat(64), start: 200, end: 200 + Buffer.byteLength(pages[0].text) }] as never,
        [...pages, { ...pages[0], start: 200, end: 200 + Buffer.byteLength(pages[0].text) }]),
    /ambiguous repeated matches/);
});

test('saved P8 GPT-OSS citation is denied while an exact quote from that same read gets trusted metadata', () => {
    const source = "export function clamp(value, min, max) {\n  if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {\n    throw new TypeError('clamp expects numbers');\n  }\n  if (min > max) throw new RangeError('min must be at most max');\n  return Math.min(Math.max(value, min), max);\n}\n";
    const sourceHash = 'cbf7b0f869f07dc1835ac5a09706b9b5e7184ae1d5e4c385c02d8ffd45d44431';
    const evidence = [{ path: 'src/clamp.js', start: 0, end: 298, sourceHash, text: source }];
    const refs = [{ kind: 'file', id: 'src/clamp.js', origin: 'tool', start: 0,
        end: 298, sourceHash }] as never;
    const p8 = { claim: 'public API currently accepts non-finite numbers', path: 'src/clamp.js',
        start: 0, end: 298, sourceHash,
        quote: "export function clamp(value, min, max) {\\n  if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {" };
    const candidate = (finding: unknown) => ({ scope: 'clamp API implementation review',
        observations: [finding], preservation: [finding], dependencies: [finding], risks: [finding],
        tiers: { T1: 'Focused source', T2: 'Integration',
            T3: 'Independent manual browser qualification' } });
    assert.throws(() => validatedAssessment(JSON.stringify(candidate(p8)), refs, '', evidence),
        /ASSESSMENT_CITATION/);
    const exact = { claim: p8.claim, path: p8.path,
        quote: "if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {" };
    const record = validatedAssessment(JSON.stringify(candidate(exact)), refs, '', evidence);
    assert.equal(record.observations[0].start, 43);
    assert.equal(record.observations[0].sourceHash, sourceHash);
    assert.throws(() => validatedAssessment(JSON.stringify(candidate({ ...exact,
        quote: p8.quote })), refs, '', evidence), /UNSUPPORTED_SOURCE/);
});

test('exact P8-R2 provisional Assessment is denied against its two brokered reads', () => {
    const source = "export function clamp(value, min, max) {\n  if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {\n    throw new TypeError('clamp expects numbers');\n  }\n  if (min > max) throw new RangeError('min must be at most max');\n  return Math.min(Math.max(value, min), max);\n}\n";
    const tests = "import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport { clamp } from '../src/clamp.js';\n\ntest('clamps inside and outside inclusive bounds', () => {\n  assert.equal(clamp(4, 0, 10), 4);\n  assert.equal(clamp(-3, 0, 10), 0);\n  assert.equal(clamp(13, 0, 10), 10);\n});\ntest('rejects reversed bounds', () => {\n  assert.throws(() => clamp(2, 4, 1), RangeError);\n});\n";
    const pages = [
        { path: 'src/clamp.js', text: source, sourceHash:
            'cef929fb2f9f68f95e59747073fdd22c8f8bbb57e58a66e55acc958b658572ce' },
        { path: 'test/clamp.test.js', text: tests, sourceHash:
            '5453f135a604bfb10101c44c988c12b9a2122df5a58f7024485e0855b4453a4f' }
    ].map(page => ({ ...page, start: 0, end: Buffer.byteLength(page.text) }));
    assert.deepEqual(pages.map(page => page.end), [298, 382]);
    const refs = pages.map(page => ({ kind: 'file', id: page.path, origin: 'tool',
        sourceHash: page.sourceHash, start: page.start, end: page.end })) as never;
    const model = {
        scope: 'Assess clamp API and outline ten implementation responsibilities',
        observations: [
            { claim: 'clamp throws TypeError when non-number arguments are passed', path: 'src/clamp.js',
                quote: "if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {\\n    throw new TypeError('clamp expects numbers');\\n  }" },
            { claim: 'clamp throws RangeError for reversed bounds', path: 'src/clamp.js',
                quote: "if (min > max) throw new RangeError('min must be at most max');" }
        ],
        preservation: [
            { claim: 'test file asserts correct clamping behavior and error throwing', path: 'test/clamp.test.js',
                quote: 'assert.equal(clamp(4, 0, 10), 4);\\n  assert.equal(clamp(-3, 0, 10), 0);\\n  assert.equal(clamp(13, 0, 10), 10);' },
            { claim: 'test file checks reversed bounds error', path: 'test/clamp.test.js',
                quote: 'assert.throws(() => clamp(2, 4, 1), RangeError);' }
        ],
        dependencies: [{ claim: 'clamp relies on Math.min and Math.max for clamping logic', path: 'src/clamp.js',
            quote: 'return Math.min(Math.max(value, min), max);' }],
        risks: [
            { claim: 'clamp currently does not handle NaN or Infinity values explicitly', path: 'src/clamp.js',
                quote: "if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {" },
            { claim: 'no batch processing support in current implementation', path: 'src/clamp.js',
                quote: "export function clamp(value, min, max) {\\n  if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {" }
        ],
        tiers: { T1: 'Implement input validation, bounds checks, NaN/Infinity handling, and batch API support.',
            T2: 'Ensure compatibility with existing tests, integrate error handling into documentation, and add property-based tests for edge cases.',
            T3: 'Conduct manual browser qualification to confirm behavior across browsers and environments.' }
    };
    assert.throws(() => validatedAssessment(JSON.stringify(model), refs,
        '/prompt-ass clamp-api-correction Inspect src/clamp.js test/clamp.test.js package.json docs/late-guide.md RELEASE_NOTES.md',
        pages), /ASSESSMENT_UNSUPPORTED_SOURCE/);
    const corrected = { ...model, tiers: { T1: 'Focused source and unit validation',
        T2: 'Cross-boundary integration validation',
        T3: 'Independent manual browser qualification' },
        observations: [{ ...model.observations[0],
        quote: "if (typeof value !== 'number' || typeof min !== 'number' || typeof max !== 'number') {" },
        model.observations[1]], preservation: [
            { ...model.preservation[0], quote: 'assert.equal(clamp(4, 0, 10), 4);' },
            model.preservation[1]], risks: [model.risks[0],
            { ...model.risks[1], quote: 'export function clamp(value, min, max) {' }] };
    const record = validatedAssessment(JSON.stringify(corrected), refs,
        'Inspect src/clamp.js test/clamp.test.js package.json docs/late-guide.md RELEASE_NOTES.md', pages);
    assert.deepEqual(record.omittedRequestedFiles,
        ['package.json', 'docs/late-guide.md', 'RELEASE_NOTES.md']);
});

test('Assessment instruction requests one bounded wireframe and leaves detail to Plan', () => {
    const instruction = promptStageInstruction({ stage: 'prompt-ass', folder: 'clamp-api-correction' }, {});
    assert.match(instruction, /Decide only the work-prompt count and task division/);
    assert.match(instruction, /One work prompt is valid/);
    assert.match(instruction, /one assessment_stage call/);
    assert.doesNotMatch(instruction, /expectedSourceHash|nextOffset/);
    assert.doesNotMatch(instruction, /all requested source pages|Stage T1 focused|ten efficiency gates/);
    assert.match(instruction, /Then call assessment_finish/);
    assert.doesNotMatch(instruction, /\{claim,path,start,end,sourceHash,quote\}/);
});

test('wireframe checks one and several work steps, owner count, order and source claims', () => {
    const text = 'export function clamp(value) { return value; }';
    const sourceHash = 'e'.repeat(64);
    const refs = [{ kind: 'file', id: 'src/clamp.js', origin: 'tool',
        sourceHash, start: 0, end: Buffer.byteLength(text) }] as never;
    const evidence = [{ path: 'src/clamp.js', start: 0, end: Buffer.byteLength(text),
        sourceHash, text }];
    const step = { id: 'step-1', title: 'Clamp behavior', objective: 'Add bounded clamp behavior',
        boundary: 'Source implementation', dependsOn: [] };
    const base = { kind: 'wireframe', objective: 'Clamp values', count: 1,
        rationale: 'One bounded source task is enough', work: [step], constraints: [], deferrals: [],
        closeout: { title: 'Manual closeout', objective: 'Observe clamp behavior',
            manualReason: 'Independent human check' }, sourceClaims: [] };
    assert.equal(validatedAssessmentWireframe(base, refs, evidence, 1).work.length, 1);
    assert.throws(() => validatedAssessmentWireframe(base, refs, evidence, 2), /COUNT/);
    assert.throws(() => validatedAssessmentWireframe({ ...base, count: 2 }, refs, evidence), /COUNT/);
    const two = { ...base, count: 2, work: [step, { ...step, id: 'step-2',
        title: 'Integrate clamp', boundary: 'Integration', dependsOn: ['step-1'] }] };
    assert.equal(validatedAssessmentWireframe(two, refs, evidence).count, 2);
    assert.throws(() => validatedAssessmentWireframe({ ...two, work: [two.work[1], step] },
        refs, evidence), /STEP/);
    assert.throws(() => validatedAssessmentWireframe({ ...two, work: [step,
        { ...two.work[1], dependsOn: ['step-3'] }] }, refs, evidence), /STEP/);
    assert.throws(() => validatedAssessmentWireframe({ ...base, rationale: 'x'.repeat(17_000) },
        refs, evidence), /SHAPE/);
    const claimed = { ...base, sourceClaims: [{ claim: 'Clamp returns value',
        path: 'src/clamp.js', quote: 'return value;' }] };
    assert.equal(validatedAssessmentWireframe(claimed, refs, evidence).sourceClaims.length, 1);
    assert.throws(() => validatedAssessmentWireframe({ ...claimed, sourceClaims: [{
        ...claimed.sourceClaims[0], quote: 'invented source' }] }, refs, evidence), /UNSUPPORTED_SOURCE/);
    assert.throws(() => validatedAssessmentWireframe({ ...base, objective: 'Change src/clamp.js' },
        refs, evidence), /WIREFRAME_SOURCE/);
    assert.equal(validatedAssessmentWireframe({ ...claimed,
        objective: 'Change src/clamp.js' }, refs, evidence).count, 1);
});

test('P8-R4 empty dependencies cannot pass without verified coverage and a reason', () => {
    const text = 'export function clamp(value) { return value; }\n';
    const sourceHash = 'e'.repeat(64);
    const refs = [{ kind: 'file', id: 'src/clamp.js', origin: 'tool',
        sourceHash, start: 0, end: Buffer.byteLength(text) }] as never;
    const evidence = [{ path: 'src/clamp.js', start: 0, end: Buffer.byteLength(text),
        sourceHash, text }];
    const finding = { claim: 'Clamp returns the supplied value', path: 'src/clamp.js',
        quote: 'return value;' };
    const output = { scope: 'Assess clamp', observations: [finding], preservation: [finding],
        dependencies: [], risks: [finding], tiers: { T1: 'Focused source unit tests',
            T2: 'Cross-boundary integration', T3: 'Independent manual browser qualification' } };
    assert.throws(() => validatedAssessment(JSON.stringify(output), refs,
        'Inspect src/clamp.js and package.json', evidence), /ASSESSMENT_DEPENDENCIES_EMPTY/);
    assert.throws(() => validatedAssessment(JSON.stringify({ ...output,
        emptyReasons: { dependencies: 'No runtime dependencies declared' } }), refs,
        'Inspect src/clamp.js and package.json', evidence), /ASSESSMENT_DEPENDENCIES_EMPTY/);
});

test('assessment keeps JSON escaped newline distinct from literal source backslash-n', () => {
    const text = 'first line\nsecond line\n';
    const sourceHash = 'd'.repeat(64);
    const evidence = [{ path: 'src/example.js', start: 0, end: Buffer.byteLength(text),
        sourceHash, text }];
    const refs = [{ kind: 'file', id: 'src/example.js', origin: 'tool', start: 0,
        end: Buffer.byteLength(text), sourceHash }] as never;
    const candidate = (quote: string) => ({ scope: 'Inspect source',
        observations: [{ claim: 'Observed lines', path: 'src/example.js', quote }],
        preservation: [{ claim: 'Observed lines', path: 'src/example.js', quote }],
        dependencies: [{ claim: 'Observed lines', path: 'src/example.js', quote }],
        risks: [{ claim: 'Observed lines', path: 'src/example.js', quote }],
        tiers: { T1: 'Focused source checks', T2: 'Integration',
            T3: 'Independent manual browser qualification' } });
    const valid = validatedAssessment(JSON.stringify(candidate('first line\nsecond line')),
        refs, '', evidence);
    assert.equal(valid.observations[0].start, 0);
    assert.equal(valid.observations[0].end, Buffer.byteLength('first line\nsecond line'));
    assert.throws(() => validatedAssessment(JSON.stringify(candidate('first line\\nsecond line')),
        refs, '', evidence), /UNSUPPORTED_SOURCE/);
});
