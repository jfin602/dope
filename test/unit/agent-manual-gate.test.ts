import assert from 'node:assert/strict';
import test from 'node:test';
import { appendFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { captureSequenceEvidence, manualGateDecision, sequenceBlockReason } from
    '../../packages/agent-core/lib/node/sequence-reconciliation.js';
import { importPhaseStack, parseAgentTaskSequence, phaseStackTaskMetadata } from
    '../../packages/agent-core/lib/sequence.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';

const a = 'a'.repeat(40), b = 'b'.repeat(40), c = 'c'.repeat(40), empty = 'e'.repeat(64);
const now = '2026-10-06T12:00:00Z';
function prompt(n: number, browser: boolean, closeout = false) {
    const title = closeout ? 'Closeout' : `Task ${n}`;
    return { filename: `P${n}-${closeout ? 'closeout' : 'task'}.txt`,
        text: `TASK: Phase 8 / P${n} — ${title}\n- Recommended configuration: \`GPT-6 Sol High\`.\n` +
            `- Browser required: ${browser ? 'yes' : 'no'}.\nThe assigned project version is \`0.8.${n}\`.\n` };
}
const evidence = (head: string, history: { sha: string; subject: string }[],
    version: string, clean = true) => ({ head, history, packageVersion: version, clean,
        worktreeFingerprint: empty });

test('browser gate waits on the same entry and only a coherent external checkpoint advances it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-manual-gate-'));
    try {
        const stack = await importPhaseStack('p8', [prompt(1, true), prompt(2, false), prompt(3, false, true)]);
        assert.deepEqual(stack.entries.map(entry => entry.execution), ['manual-gate', 'agent-task', 'manual-gate']);
        assert.equal(stack.entries[0].promptText, prompt(1, true).text);
        assert.equal(stack.entries[0].recommendation.reasoning, 'high');
        assert.deepEqual(stack.entries[0].versionPolicy, { kind: 'target', version: '0.8.1' });
        assert.throws(() => phaseStackTaskMetadata(stack, 1), /not an executable/);
        const initial = { version: 1, id: 'manual-sequence', createdAt: now, updatedAt: now,
            status: 'waiting-manual', currentEntryNumber: 1, stack, checkpoints: [],
            basis: { head: a, packageVersion: '0.8.0', worktreeFingerprint: empty } };
        const store = new AgentStore();
        await store.createSequence(root, initial);
        assert.equal(manualGateDecision(initial, evidence(a, [], '0.8.0'), false).sha, undefined);
        assert.equal((await new AgentStore().readSequence(root, initial.id))?.currentEntryNumber, 1);
        assert.equal(manualGateDecision(initial, evidence(a, [], '0.8.0', false), false).reason, 'worktree-drift');
        assert.equal(manualGateDecision(initial, evidence(b, [{ sha: b, subject: '0.8.1' }],
            '0.8.2'), false, a, ['code.ts'], true).reason, 'version-mismatch');
        assert.equal(manualGateDecision(initial, evidence(b, [{ sha: b, subject: 'wrong' }],
            '0.8.1'), false, a, ['code.ts'], true).reason, 'head-drift');
        assert.equal(manualGateDecision(initial, evidence(b, [{ sha: b, subject: '0.8.1' }],
            '0.8.1'), false, c, ['code.ts'], true).reason, 'git-history');
        assert.equal(manualGateDecision(initial, evidence(b, [{ sha: b, subject: '0.8.1' }],
            '0.8.1'), false, a, ['code.ts'], false).reason, 'version-mismatch');
        assert.equal(manualGateDecision(initial, evidence(b, [{ sha: b, subject: '0.8.1' }],
            '0.8.1'), true, a, ['code.ts'], true).reason, 'source-drift');
        assert.equal(manualGateDecision(initial, evidence(b, [{ sha: b, subject: '0.8.1' }],
            '0.8.1'), false, a, ['code.ts'], true).sha, b);
        const advanced = { ...initial, status: 'ready', currentEntryNumber: 2,
            checkpoints: [{ entryNumber: 1, sha: b, preGateBasis: initial.basis }],
            basis: { ...initial.basis, head: b, packageVersion: '0.8.1' },
            updatedAt: '2026-10-06T12:00:01Z' };
        await store.updateSequence(root, initial, advanced);
        assert.deepEqual(await new AgentStore().readSequence(root, initial.id), advanced);
        await assert.rejects(store.updateSequence(root, initial, advanced), /Stale agent sequence/);
        assert.equal(sequenceBlockReason(advanced, evidence(b, [{ sha: b, subject: '0.8.1' }],
            '0.8.1'), false), undefined);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('terminal closeout requires its own external checkpoint and cannot be checkpointed twice', async () => {
    const stack = await importPhaseStack('p8', [prompt(1, false), prompt(2, false, true)]);
    const pending = { version: 1, id: 'closeout-sequence', createdAt: now, updatedAt: now,
        status: 'waiting-manual', currentEntryNumber: 2, stack,
        checkpoints: [{ entryNumber: 1, sha: b }],
        basis: { head: b, packageVersion: '0.8.1', worktreeFingerprint: empty } };
    assert.equal(manualGateDecision(pending, evidence(b, [{ sha: b, subject: '0.8.1' }],
        '0.8.1'), false).sha, undefined);
    const history = [{ sha: c, subject: '0.8.2' }, { sha: b, subject: '0.8.1' }];
    assert.equal(manualGateDecision(pending, evidence(c, [{ sha: c, subject: '0.8.2' }],
        '0.8.2'), false, b, ['package.json'], true).reason, 'git-history');
    assert.equal(manualGateDecision(pending, evidence(c, [...history, { sha: a, subject: '0.8.2' }],
        '0.8.2'), false, b, ['package.json'], true).reason, 'git-history');
    assert.equal(manualGateDecision(pending, evidence(c, history, '0.8.2', false), false,
        b, ['package.json'], true).reason, 'worktree-drift');
    assert.equal(manualGateDecision(pending, evidence(c, history, '0.8.2'), false,
        b, ['package.json'], true).sha, c);
    const completed = { ...pending, status: 'completed', currentEntryNumber: 3,
        checkpoints: [...pending.checkpoints, { entryNumber: 2, sha: c, preGateBasis: pending.basis }],
        basis: { ...pending.basis, head: c, packageVersion: '0.8.2' } };
    assert.equal((await parseAgentTaskSequence(completed)).status, 'completed');
    assert.equal(sequenceBlockReason(completed, evidence(c, history, '0.8.2'), false), undefined);
    assert.throws(() => manualGateDecision(completed, evidence(c, history, '0.8.2'), false), /no pending/);
});

test('backend verifies an existing external Git checkpoint, persists its SHA and never duplicates it', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-reconcile-'));
    const git = promisify(execFile);
    try {
        // Reuse an existing version checkpoint; this test creates no commit or repository ref.
        await git('git', ['clone', '--quiet', '--shared', resolve(import.meta.dirname, '../..'), root]);
        const current = await captureSequenceEvidence(root);
        const version = /^0\.8\.(\d+)$/u.exec(current.packageVersion);
        if (!version || Number(version[1]) < 2 || current.history[0]?.subject !== current.packageVersion)
            return; // Pure gate tests still run after this repository moves to its next version.
        const prior = (await git('git', ['rev-parse', 'HEAD^'], { cwd: root })).stdout.trim();
        const previousPackage = JSON.parse((await git('git', ['show', 'HEAD^:package.json'], { cwd: root })).stdout);
        const folder = join(root, 'qualification-gates/p8d');
        await mkdir(folder, { recursive: true });
        await appendFile(join(root, '.git/info/exclude'), '\n/qualification-gates/\n');
        const sources = [
            { filename: 'P1-browser.txt', text: 'TASK: Phase 8 / P1 — Browser work\n' +
                '- Recommended configuration: `GPT-6 Sol High`.\n- Browser required: yes.\n' +
                `The assigned project version is \`${current.packageVersion}\`.\n` },
            { filename: 'P2-closeout.txt', text: 'TASK: Phase 8 / P2 — Closeout\n' +
                '- Recommended configuration: `GPT-6 Sol High`.\n- Browser required: no.\n' +
                `The assigned project version is \`0.8.${Number(version[1]) + 1}\`.\n` }
        ];
        for (const source of sources) await writeFile(join(folder, source.filename), source.text);
        const stack = await importPhaseStack('p8d', sources, 'qualification-gates/p8d');
        const sequence = { version: 1, id: 'external-checkpoint', createdAt: now, updatedAt: now,
            status: 'waiting-manual', currentEntryNumber: 1, stack, checkpoints: [],
            basis: { head: prior, packageVersion: previousPackage.version,
                worktreeFingerprint: current.worktreeFingerprint } };
        const store = new AgentStore();
        await store.createSequence(root, sequence);
        const backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} });
        const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
        const advanced = await backend.reconcileManualGate(handle, sequence.id);
        assert.equal(advanced.status, 'waiting-manual', JSON.stringify({
            reason: advanced.blockedReason, message: advanced.gateMessage }));
        assert.equal(advanced.currentEntryNumber, 2);
        assert.equal(advanced.checkpoints[0].sha, current.head);
        assert.deepEqual(advanced.checkpoints[0].preGateBasis, sequence.basis);
        assert.deepEqual(await new AgentStore().readSequence(root, sequence.id), advanced);
        const again = await backend.reconcileManualGate(handle, sequence.id);
        assert.equal(again.currentEntryNumber, 2);
        assert.equal(again.checkpoints.length, 1);
        await assert.rejects(backend.prepareSequenceTask(handle, sequence.id,
            { kind: 'follow-coding-agent' }, { validation: [], requireValidationPass: false }),
        /not an executable|not ready/);
        backend.dispose();
        const closeoutFolder = join(root, 'qualification-gates/p8e');
        await mkdir(closeoutFolder, { recursive: true });
        const closeoutSource = { filename: 'P1-closeout.txt', text: 'TASK: Phase 8 / P1 — Closeout\n' +
            '- Recommended configuration: `GPT-6 Sol High`.\n- Browser required: no.\n' +
            `The assigned project version is \`${current.packageVersion}\`.\n` };
        await writeFile(join(closeoutFolder, closeoutSource.filename), closeoutSource.text);
        const closeout = { ...sequence, id: 'external-closeout',
            stack: await importPhaseStack('p8e', [closeoutSource], 'qualification-gates/p8e') };
        await store.createSequence(root, closeout);
        const reopened = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} });
        const reopenedHandle = (await reopened.attach(pathToFileURL(root).href)).projectHandle;
        assert.equal((await reopened.readSequence(reopenedHandle, sequence.id))?.currentEntryNumber, 2);
        const done = await reopened.reconcileManualGate(reopenedHandle, closeout.id);
        assert.equal(done.status, 'completed');
        assert.equal(done.checkpoints[0].sha, current.head);
        await assert.rejects(reopened.reconcileManualGate(reopenedHandle, closeout.id), /no pending/);
        reopened.dispose();
        const restarted = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} });
        const restartedHandle = (await restarted.attach(pathToFileURL(root).href)).projectHandle;
        assert.equal((await restarted.readSequence(restartedHandle, sequence.id))?.currentEntryNumber, 2);
        assert.equal((await restarted.readSequence(restartedHandle, closeout.id))?.status, 'completed');
        restarted.dispose();
    } finally { await rm(root, { recursive: true, force: true }); }
});
