import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveChatSkill } from '../../packages/theia-extension/lib/node/chat-skills.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { finishedPromptStack, finishedPromptText, priorPromptDraft, promptStageCommand,
    verifyPromptDraftSource, validatePromptAssessment, validatePromptPlan } from '../../packages/theia-extension/lib/node/prompt-authoring-stage.js';
import { promptStageInstruction } from '../../packages/theia-extension/lib/node/prompt-authoring-stage.js';

const choice = (id: string, title: string, tier: 'T1' | 'T2', dependsOn: string[] = []) => ({
    tier, model: 'GPT-6 Sol Medium', estimatedMinutes: 6,
    ...(tier === 'T2' ? { integrationChecks: ['Run the affected integration test'] } : {}),
    workItem: { id, title, objective: `Implement ${title}`, dependsOn,
        requirements: ['Preserve source authority'], constraints: ['Do not auto-run Work'],
        acceptanceCriteria: ['The affected path works'], validationTargets: ['Run focused tests'],
        workingSet: ['src/feature.js'], status: 'draft',
        delegablePaths: ['src/feature.js'], humanReservedPaths: [] }
});

test('assessment and ten-step plan reject ungrounded retrieval, missing work and wrong gates', () => {
    const refs = [{ kind: 'file', id: 'src/example.ts' }, { kind: 'file', id: 'test/example.test.ts' }] as never;
    const assessment = `# Source basis\nRead: src/example.ts, test/example.test.ts\nListed: none\nUninspected: docs/missing.md\n\n# Evidence\nT1 focused source/unit verification.\nT2 cross-boundary integration verification.\nT3 manual browser/native independent qualification.`;
    validatePromptAssessment(assessment, refs, '/prompt-ass inspect src/example.ts and docs/missing.md');
    assert.throws(() => validatePromptAssessment(assessment.replace('# Source basis', 'Source basis'),
        refs, '/prompt-ass inspect src/example.ts'), /literal Markdown # Source basis/);
    assert.match(promptStageInstruction({ stage: 'prompt-ass' }, {}), /literal Markdown headings # Scope/);
    assert.match(promptStageInstruction({ stage: 'prompt-ass' }, {}), /requested late section/);
    assert.throws(() => validatePromptAssessment(assessment.replace('Uninspected: docs/missing.md',
        'Uninspected: none'), refs, '/prompt-ass inspect docs/missing.md'), /uninspected path/);
    assert.throws(() => validatePromptAssessment(assessment.replace('T1 focused source/unit',
        'T1 file listing'), refs, '/prompt-ass inspect src/example.ts'), /Evidence/);
    const work = Array.from({ length: 10 }, (_, index) => `### Work ${index + 1}: Repair source boundary ${index + 1}\n- Tier: ${index === 8 ? 'T2' : 'T1'}\n- Depends on: ${index ? index : 'none'}\n- Files: src/example.ts\n- Tests: test/example.test.ts\n- Acceptance: Focused fixture ${index + 1} returns the expected checked result.${index === 8 ? '\n- Integration: Run cross-boundary integration between source and test.' : ''}`).join('\n\n');
    const gates = ['Single responsibility', 'Runtime feasibility', 'Test precision', 'Build precision',
        'Evidence distribution', 'Command deduplication', 'Model economy and deferral',
        'Runnable/traceable contract', 'UI Design Compliance', 'Human Usability'];
    const plan = `${work}\n\n### Manual closeout\n- Tier: T3\nObserve the browser independently.\n\n### Efficiency gates\n${gates.map((gate, index) => `${index + 1}. ${gate}: specific source reason ${index + 1}.`).join('\n')}`;
    validatePromptPlan(plan, refs, 10);
    assert.throws(() => validatePromptPlan(plan.replace('### Work 10:', '### Work ten:'), refs, 10), /10 distinct/);
    assert.throws(() => validatePromptPlan(plan.replace('### Manual closeout', '### Work 11: Manual closeout'), refs, 10), /10 distinct/);
    assert.throws(() => validatePromptPlan(plan.replace('10. Human Usability', '10. File retrieval'), refs, 10), /gate 10/);
    assert.throws(() => validatePromptPlan(plan.replace('src/example.ts', 'index.html'), refs, 10), /unverified file/);
    assert.throws(() => validatePromptPlan(plan.replace('test/example.test.ts', 'test/invented.test.ts'), refs, 10), /focused test/);
    assert.throws(() => validatePromptPlan(plan.replace(/- Acceptance: [^\n]+/u, '- Acceptance: done'), refs, 10), /acceptance|Work/);
});

test('native prompt commands bind leading protected invocation and draft exact validated bytes', async () => {
    const prior = { assessment: { id: 'assessment-1', content: '# Unpublished prompt assessment\n\nDraft only. This command did not change project files or start Work.\n\nScope checked.' },
        plan: { id: 'plan-1', content: '# Unpublished prompt plan\n\nDraft only. This command did not change project files or start Work.\n\nTwo steps.' } } as never;
    assert.deepEqual(promptStageCommand('/prompt-ass', 'prompt-ass'), { stage: 'prompt-ass' });
    assert.deepEqual(promptStageCommand('/prompt-plan review more', 'prompt-plan'), { stage: 'prompt-plan' });
    assert.equal(promptStageCommand('`/prompt-ass`', undefined), undefined);
    assert.equal(promptStageCommand('Please /prompt-ass', undefined), undefined);
    assert.throws(() => promptStageCommand('/prompt-write', 'prompt-write'), /Usage/);
    assert.throws(() => promptStageCommand('/prompt-write ../escape', 'prompt-write'));
    assert.deepEqual(promptStageCommand('/prompt-write c0-feature', 'prompt-write'),
        { stage: 'prompt-write', folder: 'c0-feature' });
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
