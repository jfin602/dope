import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';

const git = promisify(execFile);
async function stack(root: string, path: string, phase: number, count = 2, valid = true) {
    const directory = join(root, path); await mkdir(directory, { recursive: true });
    for (let number = 1; number <= count; number++) {
        const closeout = valid && number === count;
        const name = closeout ? 'closeout' : `work-${number}`;
        await writeFile(join(directory, `P${number}-${name}.txt`),
            `TASK: Correction ${phase} / P${number} — ${closeout ? 'Closeout' : 'Work'}\n` +
            '- Recommended configuration: `GPT-6 Sol Medium`.\n' +
            `- Browser required: ${number === 3 ? 'yes' : 'no'}.\n` +
            '- Required unchanged project version: `0.8.20`.\n');
    }
}
async function fixture(work: (root: string, backend: AgentRuntimeBackend, handle: string,
    store: AgentStore) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), 'dope-stack-discovery-'));
    try {
        await git('git', ['init', '-q', root]);
        await git('git', ['-C', root, 'config', 'user.name', 'Test']);
        await git('git', ['-C', root, 'config', 'user.email', 'test@example.invalid']);
        await writeFile(join(root, 'package.json'), '{"name":"fixture","version":"0.8.20"}\n');
        await writeFile(join(root, 'existing.txt'), 'original\n');
        await stack(root, 'docs/tasks/c4-dope-phase-stack-smoke', 4, 4);
        await stack(root, 'docs/tasks/c1-domain-model', 1);
        await stack(root, 'docs/tasks/c2-provider-sync-hardening', 2);
        await stack(root, 'docs/tasks/c4-bad', 4, 1, false);
        await mkdir(join(root, 'docs/tasks/ordinary-folder'), { recursive: true });
        await writeFile(join(root, 'docs/tasks/readme.txt'), 'ordinary file\n');
        await git('git', ['-C', root, 'add', '.']);
        await git('git', ['-C', root, 'commit', '-qm', 'baseline']);
        const store = new AgentStore(), backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} });
        const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
        try { await work(root, backend, handle, store); } finally { backend.dispose(); }
    } finally { await rm(root, { recursive: true, force: true }); }
}

test('default discovery is sorted, bounded to immediate named folders, and survives malformed neighbors', async () =>
    fixture(async (_root, backend, handle) => {
        const stacks = await backend.listTaskStacks(handle, 'docs/tasks');
        assert.deepEqual(stacks.map(item => item.folderName), [
            'c1-domain-model', 'c2-provider-sync-hardening', 'c4-bad', 'c4-dope-phase-stack-smoke']);
        assert.equal(stacks.find(item => item.folderName === 'c4-bad')?.valid, false);
        assert.match(stacks.find(item => item.folderName === 'c4-bad')?.error ?? '', /closeout/i);
        assert.equal(stacks.find(item => item.folderName === 'c4-dope-phase-stack-smoke')?.valid, true);
        assert.equal(stacks.find(item => item.folderName === 'c4-dope-phase-stack-smoke')?.mode, 'correction');
    }));

test('selection creates and reuses one durable sequence; P3 browser and P4 closeout stay manual', async () =>
    fixture(async (root, backend, handle, store) => {
        const first = await backend.openTaskStack(handle, 'docs/tasks/', 'c4-dope-phase-stack-smoke');
        assert.equal(first.kind, 'opened'); if (first.kind !== 'opened') return;
        const second = await backend.openTaskStack(handle, 'docs/tasks', 'c4-dope-phase-stack-smoke');
        assert.equal(second.kind, 'opened'); if (second.kind !== 'opened') return;
        assert.equal(second.sequence.id, first.sequence.id);
        const concurrent = await Promise.all(Array.from({ length: 3 }, () =>
            backend.openTaskStack(handle, 'docs/tasks', 'c4-dope-phase-stack-smoke')));
        assert.ok(concurrent.every(item => item.kind === 'opened' && item.sequence.id === first.sequence.id));
        assert.equal((await store.listSequences(root)).length, 1);
        assert.deepEqual(first.sequence.stack.entries.map(entry => entry.execution),
            ['agent-task', 'agent-task', 'manual-gate', 'manual-gate']);
        const listed = await backend.listTaskStacks(handle, 'docs/tasks');
        assert.equal(listed.find(item => item.folderName === 'c4-dope-phase-stack-smoke')?.sequenceId, first.sequence.id);
        const reopened = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} });
        const handle2 = (await reopened.attach(pathToFileURL(root).href)).projectHandle;
        assert.equal((await reopened.listTaskStacks(handle2, 'docs/tasks'))
            .find(item => item.folderName === 'c4-dope-phase-stack-smoke')?.sequenceId, first.sequence.id);
        reopened.dispose();
    }));

test('dirty worktree does not block discovery; one acceptance captures exact basis and changed bytes revoke it', async () =>
    fixture(async (root, backend, handle, store) => {
        await writeFile(join(root, 'existing.txt'), 'dirty one\n');
        assert.equal((await backend.listTaskStacks(handle, 'docs/tasks')).length, 4);
        const opened = await backend.openTaskStack(handle, 'docs/tasks', 'c4-dope-phase-stack-smoke');
        assert.equal(opened.kind, 'opened'); if (opened.kind !== 'opened') return;
        assert.equal(opened.sequence.blockedReason, 'dirty-acceptance-required');
        const fingerprint = (await backend.sequenceEvidence(handle)).worktreeFingerprint;
        const accepted = await backend.acceptSequenceDirtyBasis(handle, opened.sequence.id, fingerprint);
        assert.equal(accepted.status, 'ready'); assert.equal(accepted.acceptedDirty?.paths[0]?.path, 'existing.txt');
        assert.equal((await store.listSequences(root)).length, 1);
        await writeFile(join(root, 'existing.txt'), 'dirty two\n');
        assert.equal((await backend.reconcileSequence(handle, opened.sequence.id)).blockedReason, 'worktree-drift');
        await assert.rejects(backend.acceptSequenceDirtyBasis(handle, opened.sequence.id, fingerprint), /changed/);
        const renewed = await backend.acceptSequenceDirtyBasis(handle, opened.sequence.id,
            (await backend.sequenceEvidence(handle)).worktreeFingerprint);
        assert.equal(renewed.status, 'ready');
        await writeFile(join(root, 'existing.txt'), 'dirty one\n');
        assert.equal((await backend.reconcileSequence(handle, opened.sequence.id)).blockedReason, 'worktree-drift');
    }));

test('source drift reopens the existing sequence without creating a duplicate', async () =>
    fixture(async (root, backend, handle, store) => {
        const opened = await backend.openTaskStack(handle, 'docs/tasks', 'c4-dope-phase-stack-smoke');
        assert.equal(opened.kind, 'opened'); if (opened.kind !== 'opened') return;
        await writeFile(join(root, 'docs/tasks/c4-dope-phase-stack-smoke/P1-work-1.txt'),
            'TASK: Correction 4 / P1 — Changed\n- Recommended configuration: `GPT-6 Sol Medium`.\n' +
            '- Browser required: no.\n- Required unchanged project version: `0.8.20`.\n');
        const reopened = await backend.openTaskStack(handle, 'docs/tasks', 'c4-dope-phase-stack-smoke');
        assert.equal(reopened.kind, 'opened'); if (reopened.kind !== 'opened') return;
        assert.equal(reopened.sequence.id, opened.sequence.id);
        assert.equal(reopened.sequence.blockedReason, 'source-drift');
        assert.equal((await store.listSequences(root)).length, 1);
    }));

test('tasks root rejects traversal, absolute paths, symlink escape and missing directories', async () =>
    fixture(async (root, backend, handle) => {
        for (const path of ['../outside', '/tmp', 'docs/../tasks', 'docs\\tasks'])
            await assert.rejects(backend.listTaskStacks(handle, path), /inside the current project/);
        await assert.rejects(backend.listTaskStacks(handle, 'missing/tasks'), /not found/);
        const outside = await mkdtemp(join(tmpdir(), 'dope-stack-outside-'));
        try {
            await symlink(outside, join(root, 'escaped'));
            await assert.rejects(backend.listTaskStacks(handle, 'escaped'), /inside the current project/);
        } finally { await rm(outside, { recursive: true, force: true }); }
    }));

test('custom project-relative tasks root persists in snapshot; version mismatch is actionable', async () =>
    fixture(async (root, backend, handle) => {
        await stack(root, 'custom/tasks/c8-custom', 8);
        const stacks = await backend.listTaskStacks(handle, 'custom/tasks/');
        assert.deepEqual(stacks.map(item => item.folderName), ['c8-custom']);
        const opened = await backend.openTaskStack(handle, 'custom/tasks', 'c8-custom');
        assert.equal(opened.kind, 'opened'); if (opened.kind !== 'opened') return;
        assert.equal(opened.sequence.stack.sourcePath, 'custom/tasks/c8-custom');
        await writeFile(join(root, 'package.json'), '{"name":"fixture","version":"0.8.21"}\n');
        assert.deepEqual(await backend.openTaskStack(handle, 'docs/tasks', 'c4-dope-phase-stack-smoke'),
            { kind: 'version-mismatch' });
    }));
