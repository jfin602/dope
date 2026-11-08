import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { resolveChatSkill } from '../../packages/theia-extension/lib/node/chat-skills.js';
import { ChatProjectGrounder } from '../../packages/theia-extension/lib/node/chat-project-grounder.js';
import { assertPromptDraftNameAvailable, finishedPromptStack, finishedPromptText, newPromptDraftIdentity,
    priorPromptDraft, promptStageCommand, verifyPromptDraftIdentity, verifyPromptDraftSourceBasis,
    verifyPromptDraftSource } from '../../packages/theia-extension/lib/node/prompt-authoring-stage.js';

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
