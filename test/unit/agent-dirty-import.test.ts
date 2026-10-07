import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { captureSequenceEvidence, sequenceBlockReason, stackSourceDrift } from
    '../../packages/agent-core/lib/node/sequence-reconciliation.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';

const git = promisify(execFile);
async function fixture(work: (root: string, backend: AgentRuntimeBackend, handle: string,
    store: AgentStore) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), 'dope-dirty-import-'));
    try {
        await git('git', ['init', '-q', root]);
        await git('git', ['-C', root, 'config', 'user.name', 'Test']);
        await git('git', ['-C', root, 'config', 'user.email', 'test@example.invalid']);
        await mkdir(join(root, 'docs/tasks/c8-dirty-import'), { recursive: true });
        await writeFile(join(root, 'package.json'), '{"name":"fixture","version":"0.8.20"}\n');
        await writeFile(join(root, 'existing.txt'), 'original\n');
        for (const [number, title] of [[1, 'Work'], [2, 'Closeout']] as const)
            await writeFile(join(root, `docs/tasks/c8-dirty-import/P${number}-${title.toLowerCase()}.txt`),
                `TASK: Correction 8 / P${number} — ${title}\n` +
                '- Recommended configuration: `GPT-6 Sol Medium`.\n- Browser required: no.\n' +
                '- Required unchanged project version: `0.8.20`.\n');
        await git('git', ['-C', root, 'add', '.']);
        await git('git', ['-C', root, 'commit', '-qm', 'baseline']);
        const store = new AgentStore(), backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} });
        const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
        try { await work(root, backend, handle, store); } finally { backend.dispose(); }
    } finally { await rm(root, { recursive: true, force: true }); }
}

test('dirty import is typed, opt-in, read-only to project/Git, and execution still requires acceptance', async () =>
    fixture(async (root, backend, handle, store) => {
        await writeFile(join(root, 'existing.txt'), 'changed\n');
        const head = (await git('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim();
        const before = await readFile(join(root, 'existing.txt'));
        const refused = await backend.importSequence(handle, 'c8-dirty-import');
        assert.deepEqual(refused, { kind: 'dirty-confirmation-required' });
        assert.deepEqual(await store.listSequences(root), []);
        const result = await backend.importSequence(handle, 'c8-dirty-import', { allowDirtyImport: true });
        assert.equal(result.kind, 'imported');
        if (result.kind !== 'imported') return;
        const sequence = result.sequence;
        assert.equal(sequence.basis.clean, false);
        assert.equal(sequence.status, 'blocked');
        assert.equal(sequence.blockedReason, 'dirty-acceptance-required');
        assert.equal(sequence.acceptedDirty, undefined);
        assert.equal((await backend.reconcileSequence(handle, sequence.id)).blockedReason, 'dirty-acceptance-required');
        await assert.rejects(backend.prepareSequenceTask(handle, sequence.id, { kind: 'follow-coding-agent' },
            { validation: [], requireValidationPass: false }), /not ready/);
        assert.deepEqual(await readFile(join(root, 'existing.txt')), before);
        assert.equal((await git('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim(), head);
        assert.equal((await git('git', ['-C', root, 'diff', '--cached', '--name-only'])).stdout, '');
        const reopened = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} });
        const reopenedHandle = (await reopened.attach(pathToFileURL(root).href)).projectHandle;
        assert.equal((await reopened.readSequence(reopenedHandle, sequence.id))?.blockedReason,
            'dirty-acceptance-required');
        reopened.dispose();
        const fingerprint = (await backend.sequenceEvidence(handle)).worktreeFingerprint;
        const task = await backend.prepareSequenceTask(handle, sequence.id, { kind: 'follow-coding-agent' },
            { validation: [], requireValidationPass: false }, { worktreeFingerprint: fingerprint });
        assert.equal(task.authority.profile, 'phase-8b-project');
        const accepted = (await backend.readSequence(handle, sequence.id))!;
        assert.equal(accepted.status, 'ready');
        assert.equal(accepted.blockedReason, undefined);
        assert.equal(accepted.acceptedDirty?.paths[0]?.path, 'existing.txt');
        assert.equal(accepted.acceptedDirty?.paths[0]?.code, ' M');
        assert.equal(accepted.acceptedDirty?.paths[0]?.size, before.length);
        assert.equal((await backend.reconcileSequence(handle, sequence.id)).blockedReason, undefined);
        await writeFile(join(root, 'later.txt'), 'unrelated\n');
        const drifted = await backend.reconcileSequence(handle, sequence.id);
        assert.equal(drifted.blockedReason, 'worktree-drift');
        assert.deepEqual(drifted.acceptedDirty, accepted.acceptedDirty);
    }));

test('dirty basis changes after confirmation require renewed acceptance', async () => fixture(async (root, backend, handle) => {
    await writeFile(join(root, 'existing.txt'), 'first\n');
    const result = await backend.importSequence(handle, 'c8-dirty-import', { allowDirtyImport: true });
    assert.equal(result.kind, 'imported');
    if (result.kind !== 'imported') return;
    const fingerprint = (await backend.sequenceEvidence(handle)).worktreeFingerprint;
    await writeFile(join(root, 'existing.txt'), 'second\n');
    await assert.rejects(backend.prepareSequenceTask(handle, result.sequence.id,
        { kind: 'follow-coding-agent' }, { validation: [], requireValidationPass: false },
        { worktreeFingerprint: fingerprint }), /changed since acceptance/);
    const blocked = (await backend.readSequence(handle, result.sequence.id))!;
    assert.equal(blocked.status, 'blocked');
    assert.equal(blocked.acceptedDirty, undefined);
    assert.equal(blocked.taskId, undefined);
}));

test('clean import succeeds without a confirmation option', async () => fixture(async (_root, backend, handle) => {
    const result = await backend.importSequence(handle, 'c8-dirty-import');
    assert.equal(result.kind, 'imported');
    if (result.kind !== 'imported') return;
    assert.equal(result.sequence.basis.clean, true);
    assert.equal(result.sequence.status, 'ready');
    assert.equal(result.sequence.acceptedDirty, undefined);
}));

test('dirty import fingerprint detects changed bytes and other reconciliation blockers', async () =>
    fixture(async (root, backend, handle) => {
        await writeFile(join(root, 'existing.txt'), 'first\n');
        const result = await backend.importSequence(handle, 'c8-dirty-import', { allowDirtyImport: true });
        assert.equal(result.kind, 'imported');
        if (result.kind !== 'imported') return;
        const sequence = result.sequence;
        const initial = await captureSequenceEvidence(root);
        assert.equal(sequenceBlockReason(sequence, initial, false), 'dirty-acceptance-required');
        await writeFile(join(root, 'existing.txt'), 'other\n');
        const changed = await captureSequenceEvidence(root);
        assert.notEqual(changed.worktreeFingerprint, initial.worktreeFingerprint);
        assert.equal(sequenceBlockReason(sequence, changed, false), 'worktree-drift');
        assert.equal(sequenceBlockReason(sequence, { ...initial, head: 'a'.repeat(40) }, false), 'head-drift');
        assert.equal(sequenceBlockReason(sequence, { ...initial, packageVersion: '0.8.21' }, false), 'version-mismatch');
        assert.equal(sequenceBlockReason(sequence, initial, true), 'source-drift');
        await writeFile(join(root, 'docs/tasks/c8-dirty-import/P1-work.txt'), 'invalid source\n');
        assert.equal(await stackSourceDrift(root, sequence.stack), true);
    }));

test('known import failures have specific backend results', async () => fixture(async (root, backend, handle) => {
    assert.deepEqual(await backend.importSequence(handle, '../outside'), { kind: 'unsafe-source' });
    await writeFile(join(root, 'docs/tasks/c8-dirty-import/P1-work.txt'), 'invalid grammar\n');
    assert.deepEqual(await backend.importSequence(handle, 'c8-dirty-import'), { kind: 'invalid-stack' });
    assert.equal((await backend.listSequences(handle)).length, 0);
}));

test('version mismatch is reported specifically', async () => fixture(async (root, backend, handle) => {
    await writeFile(join(root, 'package.json'), '{"name":"fixture","version":"0.8.21"}\n');
    assert.deepEqual(await backend.importSequence(handle, 'c8-dirty-import', { allowDirtyImport: true }),
        { kind: 'version-mismatch' });
}));
