import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { importPhaseStack, parseImportedStack, parseSequenceEntry, parseAgentTaskSequence, hasPhaseStackSourceDrift,
    phaseStackTaskMetadata, SEQUENCE_STATUSES, canTransitionSequence, transitionSequence }
    from '../../packages/agent-core/lib/index.js';

function prompt(number: number, options: { mode?: 'phase' | 'correction'; phase?: number; version?: string;
    closeout?: boolean; browser?: string; label?: string; title?: string; suffix?: string } = {}) {
    const mode = options.mode ?? 'phase', phase = options.phase ?? 8;
    const closeout = options.closeout ?? false;
    const title = options.title ?? (closeout ? 'Phase closeout' : `Task ${number}`);
    const version = options.version ?? `0.8.${number}`;
    return { filename: `P${number}-${closeout ? 'phase-closeout' : `task-${number}`}.txt`,
        text: `TASK: ${mode === 'phase' ? 'Phase' : 'Correction'} ${phase} / P${number} — ${title}\n\n` +
            `MODEL / REASONING / USAGE\n- Recommended configuration: \`${options.label ?? 'GPT-6 Sol High'}\`.\n` +
            (options.browser === undefined ? '' : `- Browser required: ${options.browser}\n`) +
            `\nVERSIONING\n${mode === 'phase' ? `The assigned project version is \`${version}\`.` :
                `- Required unchanged project version: \`${version}\`.`}\n\n${options.suffix ?? 'Full prompt body.\n'}` };
}
const phase = () => [prompt(1), prompt(2, { closeout: true, browser: 'yes.' })];

test('phase and correction imports preserve prompt text and classify gates', async () => {
    const sources = phase();
    const stack = await importPhaseStack('p8', sources.slice().reverse());
    assert.deepEqual(stack.entries.map(entry => entry.execution), ['agent-task', 'manual-gate']);
    assert.equal(stack.entries[0].promptText, sources[0].text);
    assert.equal(stack.entries[0].recommendation.model, 'gpt-6-sol');
    assert.equal(stack.entries[0].recommendation.reasoning, 'high');
    assert.deepEqual(stack.entries[0].versionPolicy, { kind: 'target', version: '0.8.1' });
    assert.equal(Object.isFrozen(stack.entries[0]), true);
    assert.deepEqual(parseSequenceEntry(JSON.parse(JSON.stringify(stack.entries[0]))), stack.entries[0]);
    assert.throws(() => parseSequenceEntry({ ...stack.entries[0], execution: 'manual-gate' }), /does not match/);
    assert.equal(Object.isFrozen(stack.entries), true);
    assert.deepEqual(await importPhaseStack('p8', sources), stack);
    assert.deepEqual(await parseImportedStack(JSON.parse(JSON.stringify(stack))), stack);
    assert.deepEqual(phaseStackTaskMetadata(stack, 1), {
        objective: 'Task 1', instructions: sources[0].text,
        origin: { kind: 'phase-stack', promptId: `p8-P1-${stack.fingerprint.slice(0, 12)}` },
        controls: { reasoningEffort: 'high' },
        recommendedModel: 'gpt-6-sol', versionPolicy: { kind: 'target', version: '0.8.1' },
        stackFingerprint: stack.fingerprint });
    assert.throws(() => phaseStackTaskMetadata(stack, 2), /not an executable/);
    const correction = await importPhaseStack('c8-fix', [
        prompt(1, { mode: 'correction', version: '0.8.13', browser: 'yes.' }),
        prompt(2, { mode: 'correction', version: '0.8.13', closeout: true })]);
    assert.equal(correction.mode, 'correction');
    assert.equal(correction.unchangedVersion, '0.8.13');
    assert.deepEqual(correction.entries.map(entry => entry.execution), ['manual-gate', 'manual-gate']);
    assert.deepEqual(correction.entries[0].versionPolicy, { kind: 'unchanged', version: '0.8.13' });
});

test('real p8c stack imports with continuation versions and final manual closeout', async () => {
    const folder = new URL('../../docs/tasks/p8c/', import.meta.url);
    const names = (await readdir(folder)).filter(name => /^P\d+-.*\.txt$/u.test(name));
    const sources = await Promise.all(names.map(async filename =>
        ({ filename, text: await readFile(new URL(filename, folder), 'utf8') })));
    const stack = await importPhaseStack('p8c', sources);
    assert.deepEqual(stack.entries.map(entry => entry.versionPolicy.version),
        ['0.8.14', '0.8.15', '0.8.16', '0.8.17', '0.8.18', '0.8.19', '0.8.20']);
    assert.equal(stack.versionOffset, 13);
    assert.equal(stack.continuationSlice, 'C');
    assert.equal(stack.entries.at(-1)?.execution, 'manual-gate');
    assert.equal(stack.entries.at(-1)?.kind, 'closeout');
});

test('numbering, folder, mode, version and closeout grammar fail closed', async () => {
    const invalid = [
        { folder: 'p8', sources: [prompt(2), prompt(3, { closeout: true })], message: /contiguous/ },
        { folder: 'p8', sources: [prompt(1), prompt(1), prompt(2, { closeout: true })], message: /Duplicate/ },
        { folder: 'p8', sources: [prompt(1), prompt(2)], message: /final closeout/ },
        { folder: 'p8', sources: [prompt(1, { closeout: true }), prompt(2, { closeout: true })], message: /final closeout/ },
        { folder: 'p8', sources: [prompt(1, { version: '0.8.2' }), prompt(2, { closeout: true })], message: /does not match/ },
        { folder: 'p8b', sources: [prompt(1, { version: '0.8.1' }), prompt(2, { closeout: true })], message: /Continuation/ },
        { folder: 'p8', sources: [prompt(1, { mode: 'correction', version: '0.8.1' }), prompt(2, { closeout: true })], message: /stack mode/ },
        { folder: 'c8-fix', sources: [prompt(1, { mode: 'correction', version: '0.8.13' }),
            prompt(2, { mode: 'correction', version: '0.8.14', closeout: true })], message: /unchanged version/ },
        { folder: 'P8', sources: phase(), message: /Task folder/ },
        { folder: 'p8', sources: [{ ...prompt(1), filename: 'P01-task.txt' }, prompt(2, { closeout: true })], message: /Prompt filename/ },
        { folder: 'p8', sources: [prompt(1, { label: 'GPT-6 Sol Ultra' }), prompt(2, { closeout: true })], message: /Unknown recommended/ },
        { folder: 'p8', sources: [prompt(1, { title: 'Prepare closeout' }), prompt(2, { closeout: true })], message: /Ambiguous closeout/ }
    ];
    for (const item of invalid) await assert.rejects(importPhaseStack(item.folder, item.sources), item.message);
});

test('Browser metadata requires exact yes. or no. and defaults to no', async () => {
    for (const value of ['yes', 'no', 'YES.', 'yes. extra', ''])
        await assert.rejects(importPhaseStack('p8', [prompt(1, { browser: value }), prompt(2, { closeout: true })]), /Browser required/);
    const no = await importPhaseStack('p8', [prompt(1, { browser: 'no.' }), prompt(2, { closeout: true })]);
    assert.equal(no.entries[0].browserRequired, false);
    assert.equal(no.entries[0].execution, 'agent-task');
    const yes = await importPhaseStack('p8', [prompt(1, { browser: 'yes.' }), prompt(2, { closeout: true })]);
    assert.equal(yes.entries[0].execution, 'manual-gate');
    const duplicate = prompt(1, { browser: 'yes.', suffix: '- Browser required: no.\n' });
    await assert.rejects(importPhaseStack('p8', [duplicate, prompt(2, { closeout: true })]), /at most one/);
});

test('snapshot hash detects source drift and rejects tampering without modifying stored snapshot', async () => {
    const original = phase();
    const stack = await importPhaseStack('p8', original);
    const edited = [{ ...original[0], text: original[0].text.replace('Full prompt body.', 'Changed body.') }, original[1]];
    assert.equal(await hasPhaseStackSourceDrift(stack, original), false);
    assert.equal(await hasPhaseStackSourceDrift(stack, edited), true);
    assert.equal(stack.entries[0].promptText, original[0].text);
    await assert.rejects(parseImportedStack({ ...stack, entries: [
        { ...stack.entries[0], promptText: edited[0].text }, stack.entries[1]] }), /snapshot or fingerprint mismatch/);
    await assert.rejects(parseImportedStack({ ...stack, token: 'private' }), /Invalid agent record fields/);
});

test('sequence status transitions and strict position are versioned', async () => {
    const stack = await importPhaseStack('p8', phase());
    const now = '2026-10-06T12:00:00Z';
    const base = { version: 1, id: 'sequence-1', createdAt: now, updatedAt: now,
        status: 'ready', currentEntryNumber: 1, stack, checkpoints: [],
        basis: { head: 'a'.repeat(40), packageVersion: '0.8.0', worktreeFingerprint: 'b'.repeat(64) } };
    assert.deepEqual(await parseAgentTaskSequence(base), base);
    assert.equal(Object.isFrozen((await parseAgentTaskSequence(base)).stack), true);
    assert.deepEqual(SEQUENCE_STATUSES, ['ready', 'running', 'waiting-manual', 'blocked', 'interrupted', 'completed']);
    for (const [from, to] of [['ready', 'running'], ['running', 'waiting-manual'],
        ['waiting-manual', 'completed'], ['running', 'blocked'], ['running', 'interrupted'],
        ['blocked', 'ready'], ['interrupted', 'ready']] as const) {
        assert.equal(canTransitionSequence(from, to), true);
        assert.equal(transitionSequence(from, to), to);
    }
    for (const to of SEQUENCE_STATUSES) {
        assert.equal(canTransitionSequence('completed', to), false);
        assert.throws(() => transitionSequence('completed', to));
    }
    for (const change of [{ version: 2 }, { status: 'completed' },
        { status: 'running', currentEntryNumber: 2 }, { status: 'waiting-manual', currentEntryNumber: 1 },
        { currentEntryNumber: 0 }, { updatedAt: '2026-10-05T12:00:00Z' }, { providerSession: 'x' }])
        await assert.rejects(parseAgentTaskSequence({ ...base, ...change }));
    await assert.rejects(parseAgentTaskSequence({ ...base, status: 'completed', currentEntryNumber: 3 }));
});
