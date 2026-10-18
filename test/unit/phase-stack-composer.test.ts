import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildPlan } from '../../scripts/codex-phase-core.mjs';
import { composePhaseStackDraft } from '../../packages/agent-core/lib/phase-stack-composer.js';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';
import type { ComposeStackInput, WorkPromptChoice } from '../../packages/agent-core/src/phase-stack-composer';

function work(id: string, dependsOn: string[] = []): WorkPromptChoice {
    return { tier: id === 'integration' ? 'T2' : 'T1', model: 'GPT-6 Sol High', estimatedMinutes: 7,
        ...(id === 'integration' ? { integrationChecks: ['Check Work importer and Roadmap projection together'] } : {}),
        workItem: { id, title: `${id} task`, objective: `Implement ${id} behavior`, dependsOn,
            status: 'ready', workingSet: ['packages/agent-core/src/sequence.ts'],
            requirements: ['Preserve project authority'], constraints: ['Do not start a Run'],
            acceptanceCriteria: ['Accepted behavior is observable'], validationTargets: ['Run focused unit test'] } };
}
function fixture(folderName = 'c11-draft', version = '0.11.8'): ComposeStackInput {
    return { folderName, version, sourceVersion: folderName === 'p1-11' ? '1.11.0' : version,
        work: [work('integration', ['core']), work('core')],
        closeout: { title: 'Manual closeout', objective: 'Inspect exact source and live evidence',
            manualReason: 'Browser and native observations are required', browserRequired: true,
            acceptanceCriteria: ['Observe real GUI and owner review'], model: 'GPT-6 Sol High' } };
}

test('correction draft is deterministic, dependency ordered and round trips through Work and runner validators', async () => {
    const input = fixture();
    const draft = await composePhaseStackDraft(input);
    assert.deepEqual(draft, await composePhaseStackDraft({ ...input, work: [...input.work].reverse() }));
    assert.deepEqual(draft.files.map(file => file.filename),
        ['P1-core-task.txt', 'P2-integration-task.txt', 'P3-manual-closeout.txt']);
    assert.match(draft.files[1].text, /Depends on: P1 \(core\)/);
    assert.match(draft.files[1].text, /Required affected-system T2 integration/);
    const sources = draft.files.map(({ filename, text }) => ({ filename, text }));
    const imported = await importPhaseStack(input.folderName, sources, draft.sourcePath);
    const runner = buildPlan(sources, input.folderName);
    assert.deepEqual(imported.entries.map(entry => entry.number), runner.prompts.map(prompt => prompt.number));
    assert.deepEqual(imported.entries.map(entry => entry.execution), ['agent-task', 'agent-task', 'manual-gate']);
    assert.equal(runner.unchangedVersion, '0.11.8');
});

test('phase draft uses assigned versions and both existing validators', async () => {
    const input = fixture('p1-11', '1.11.1');
    const draft = await composePhaseStackDraft(input);
    const sources = draft.files.map(({ filename, text }) => ({ filename, text }));
    assert.deepEqual((await importPhaseStack(input.folderName, sources)).entries.map(entry => entry.versionPolicy.version),
        ['1.11.1', '1.11.2', '1.11.3']);
    assert.deepEqual(buildPlan(sources, input.folderName).prompts.map(prompt => prompt.targetVersion),
        ['1.11.1', '1.11.2', '1.11.3']);
});

test('draft rejects duplicate, unknown and cyclic WorkItem dependencies', async () => {
    await assert.rejects(composePhaseStackDraft({ ...fixture(), work: [work('core'), work('core')] }), /Duplicate WorkItem ID/);
    await assert.rejects(composePhaseStackDraft({ ...fixture(), work: [work('core', ['missing'])] }), /Unknown WorkItem dependency/);
    await assert.rejects(composePhaseStackDraft({ ...fixture(), work: [work('core', ['integration']), work('integration', ['core'])] }), /dependency cycle/);
    await assert.rejects(composePhaseStackDraft({ ...fixture(), work: [{ ...work('core'), workItem: { ...work('core').workItem, status: 'proposed' } }] }), /not accepted/);
});

test('draft rejects unsafe paths, ambiguous closeout, wrong version/model and oversize', async () => {
    const base = fixture();
    await assert.rejects(composePhaseStackDraft({ ...base, work: [{ ...work('core'), workItem: { ...work('core').workItem, workingSet: ['../outside'] } }] }), /Unsafe working set/);
    await assert.rejects(composePhaseStackDraft({ ...base, closeout: { ...base.closeout, title: 'Final review' } }), /must say closeout/);
    await assert.rejects(composePhaseStackDraft({ ...base, work: [work('closeout')] }), /Only the final prompt/);
    await assert.rejects(composePhaseStackDraft({ ...base, version: '0.11.9' }), /Source version .* does not match/);
    await assert.rejects(composePhaseStackDraft({ ...fixture('p1-11', '1.11.1'), version: '1.11.2', sourceVersion: '1.11.1' }), /target .* does not match/);
    await assert.rejects(composePhaseStackDraft({ ...base, work: [{ ...work('core'), model: 'Terra High' as WorkPromptChoice['model'] }] }), /Unknown recommended configuration/);
    const long = 'x'.repeat(450);
    const oversized = work('core');
    oversized.workItem = { ...oversized.workItem, requirements: Array(12).fill(long),
        constraints: Array(12).fill(long), acceptanceCriteria: Array(12).fill(long) };
    await assert.rejects(composePhaseStackDraft({ ...base, work: [oversized] }), /prompt size limit/);
});

test('efficiency diagnostics distinguish target, soft and hard budgets', async () => {
    const base = fixture();
    const choice = { ...work('core'), estimatedMinutes: 11 };
    assert.match((await composePhaseStackDraft({ ...base, work: [choice, work('integration', ['core'])] })).diagnostics[0], /10-minute soft ceiling/);
    await assert.rejects(composePhaseStackDraft({ ...base, work: [{ ...choice, estimatedMinutes: 16 }] }), /15-minute hard budget/);
    await assert.rejects(composePhaseStackDraft({ ...base, work: [{ ...choice, tier: 'T2', integrationChecks: [] }] }), /T2 integration check/);
    await assert.rejects(composePhaseStackDraft({ ...base, work: [work('core')] }), /T2 integration prompt/);
});
