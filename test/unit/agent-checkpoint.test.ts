import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';
import { assertDirtyBasis, captureDirtyBasis } from '../../packages/agent-core/lib/node/dirty-basis.js';
import { checkpointBody, checkpointSubject, verifyCheckpointScope, versionCoherent } from
    '../../packages/agent-core/lib/node/sequence-checkpoint.js';

const hash = 'a'.repeat(64);
const dirty = { head: 'b'.repeat(40), paths: [{ path: 'existing.txt', code: ' M', hash, size: 2, mode: 0o644 }] };
const effect = { kind: 'create', path: 'task.txt', after: 'c'.repeat(64) };
const run = { id: 'run-1', appliedFiles: ['task.txt'], candidateDelta: { effects: [effect] } } as any;

test('checkpoint scope preserves accepted bytes and excludes ambient/runtime paths', () => {
    const current = [...dirty.paths, { path: 'task.txt', code: '??', hash: effect.after, size: 2, mode: 0o644 }];
    assert.deepEqual(verifyCheckpointScope(undefined, run, [current[1]]), ['task.txt']);
    assert.deepEqual(verifyCheckpointScope(dirty, run, current), ['existing.txt', 'task.txt']);
    assert.throws(() => verifyCheckpointScope(undefined, run, current), /Unaccepted ambient/);
    assert.throws(() => verifyCheckpointScope(dirty, run, [...current,
        { path: 'other.txt', code: '??', hash, size: 2, mode: 0o644 }]), /Unaccepted ambient/);
    assert.throws(() => verifyCheckpointScope(dirty, run, [...current,
        { path: '.dope/agent/sequences/state.json', code: '??', hash, size: 2, mode: 0o644 }]), /Unaccepted ambient/);
    assert.throws(() => verifyCheckpointScope(dirty, run, [{ ...current[0], hash: effect.after }, current[1]]),
        /Accepted dirty byte identity/);
    assert.throws(() => verifyCheckpointScope(dirty, run, [{ ...current[0], mode: 0o755 }, current[1]]),
        /Accepted dirty byte identity/);
    assert.throws(() => verifyCheckpointScope(dirty, run, [current[0], { ...current[1], hash }]),
        /Applied authoritative bytes/);
});

test('checkpoint subjects and body are deterministic and provider-response free', async () => {
    const phase = await importPhaseStack('p8', [{ filename: 'P1-work.txt', text:
        'TASK: Phase 8 / P1 — Work\n- Recommended configuration: `GPT-6 Sol Medium`.\n' +
        '- Browser required: no.\nThe assigned project version is `0.8.1`.\n' },
    { filename: 'P2-closeout.txt', text: 'TASK: Phase 8 / P2 — Closeout\n' +
        '- Recommended configuration: `GPT-6 Sol Medium`.\n- Browser required: yes.\n' +
        'The assigned project version is `0.8.2`.\n' }]);
    const sequence = { stack: phase, currentEntryNumber: 1 } as any;
    assert.equal(checkpointSubject(sequence), '0.8.1');
    const correction = structuredClone(phase);
    correction.mode = 'correction'; correction.folderName = 'c8-fix';
    assert.equal(checkpointSubject({ ...sequence, stack: correction }), 'c8-fix/P1: Work');
    const body = checkpointBody({ id: 'task-1' } as any, run, ['existing.txt'], ['test: focused']);
    assert.match(body, /AgentRun run-1/);
    assert.match(body, /Applied files: task.txt/);
    assert.match(body, /Accepted dirty files: existing.txt/);
    assert.ok(body.length < 4000);
});

test('version coherence blocks root lock, workspace version and internal reference drift', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-checkpoint-version-'));
    const put = async (path: string, value: unknown) => writeFile(join(root, path), JSON.stringify(value));
    try {
        await mkdir(join(root, 'packages/a'), { recursive: true });
        await mkdir(join(root, 'packages/b'), { recursive: true });
        await put('package.json', { version: '0.8.17', workspaces: ['packages/a', 'packages/b'] });
        await put('packages/a/package.json', { name: '@dope/a', version: '0.8.17', dependencies: { '@dope/b': '0.8.17' } });
        await put('packages/b/package.json', { name: '@dope/b', version: '0.8.17' });
        await versionCoherent(root, '0.8.17');
        await assert.rejects(versionCoherent(root, '0.8.16'), /version mismatch/);
        await writeFile(join(root, 'npm-shrinkwrap.json'), '{}');
        await assert.rejects(versionCoherent(root, '0.8.17'), /Forbidden root/);
        await rm(join(root, 'npm-shrinkwrap.json'));
        await writeFile(join(root, 'package-lock.json'), '{}');
        await assert.rejects(versionCoherent(root, '0.8.17'), /Forbidden root/);
        await rm(join(root, 'package-lock.json'));
        await put('packages/a/package.json', { name: '@dope/a', version: '0.8.17', dependencies: { '@dope/b': '0.8.16' } });
        await assert.rejects(versionCoherent(root, '0.8.17'), /Internal reference mismatch/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('dirty basis captures actual HEAD and detects substituted acceptance', async () => {
    const root = process.cwd();
    const basis = await captureDirtyBasis(root);
    await assertDirtyBasis(root, basis);
    await assert.rejects(assertDirtyBasis(root, { ...basis, head: '0'.repeat(40) }), /basis changed/);
});
