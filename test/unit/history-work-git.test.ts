import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';
import { historyAgentRunStatus, readHistoryWorkGitMetadata } from
    '../../packages/theia-extension/lib/node/history-work-git.js';

const runGit = promisify(execFile);
const at = '2026-10-12T12:00:00Z', later = '2026-10-12T12:00:01Z';
const project = (root: string, projectId = 'project-a') => ({ projectRoot: root, projectId });
const task = (id = 'task-1') => ({ version: 1, id, projectId: 'project-a', createdAt: at,
    objective: 'Edit one file', instructions: 'Private instructions', projectRoot: '.' as const,
    modelPolicy: { kind: 'follow-coding-agent' as const }, controls: {},
    authority: { profile: 'phase-8b-project' as const },
    completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' as const } });
const run = (id = 'run-1', taskId = 'task-1') => ({ version: 1, id, taskId, projectId: 'project-a',
    status: 'pending' as const, grantId: 'grant-1', grantRevision: 0,
    requestedPolicy: { kind: 'follow-coding-agent' as const }, projectRoot: '.' as const,
    createdAt: at, changedFiles: [], validationResults: [] });
async function git(root: string, args: string[]) { return runGit('git', args, { cwd: root, timeout: 3000 }); }

test('Agent, validation, review, promotion, sequence and Git remain separate owner facts', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-history-work-git-'));
    try {
        await git(root, ['init', '-q']);
        await git(root, ['config', 'user.name', 'History Fixture']);
        await git(root, ['config', 'user.email', 'history@example.invalid']);
        await writeFile(join(root, 'source.txt'), 'original\n');
        await git(root, ['add', 'source.txt']);
        await git(root, ['commit', '-q', '-m', 'Initial source']);
        await writeFile(join(root, 'source.txt'), 'changed\n');
        const store = new AgentStore();
        await store.createTask(root, task());
        await store.createRun(root, run());
        await store.updateRun(root, run(), { ...run(), status: 'running', startedAt: later,
            provenance: { version: 1, connectionId: 'local', modelId: 'small', providerId: 'provider',
                adapterId: 'adapter', runtimeKind: 'local' } });
        const stack = await importPhaseStack('p8', [1, 2].map(number => ({
            filename: `P${number}-${number === 2 ? 'closeout' : 'implement'}.txt`,
            text: `TASK: Phase 8 / P${number} — ${number === 2 ? 'Closeout' : 'Implement'}\n- Recommended configuration: \`GPT-6 Sol Medium\`.\n` +
                `- Browser required: no.\nThe assigned project version is \`0.8.${number}\`.\n` })));
        await store.createSequence(root, { version: 1, id: 'sequence-1', createdAt: at, updatedAt: later,
            status: 'ready', currentEntryNumber: 1, stack, checkpoints: [],
            basis: { head: 'a'.repeat(40), packageVersion: '0.8.0', worktreeFingerprint: 'b'.repeat(64) } });
        const paths = ['.dope/agent/tasks/task-1.json', '.dope/agent/runs/run-1/run.json',
            '.dope/agent/sequences/sequence-1.json'];
        const before = await Promise.all(paths.map(path => readFile(join(root, path))));
        const statusBefore = (await git(root, ['status', '--porcelain'])).stdout;
        const fsmonitor = join(root, '.git/fsmonitor.sh'), marker = join(root, '.git/fsmonitor-ran');
        await writeFile(fsmonitor, `#!/bin/sh\necho invoked > '${marker}'\n`);
        await chmod(fsmonitor, 0o755);
        await git(root, ['config', 'core.fsmonitor', fsmonitor]);
        const result = await readHistoryWorkGitMetadata(project(root), later);
        assert.equal(result.diagnostics.length, 0, JSON.stringify(result.diagnostics));
        assert.deepEqual(result.entries.filter(entry => entry.source === 'agent').map(entry => entry.owner.kind),
            ['agent-task', 'agent-run', 'agent-sequence']);
        assert.deepEqual(result.entries.find(entry => entry.owner.kind === 'agent-run')?.status, {
            kind: 'agent-run', state: 'running', validation: 'unknown', review: 'none',
            promotion: 'not-applied', provenance: { connectionId: 'local', modelId: 'small',
                adapterId: 'adapter', runtimeKind: 'local' } });
        assert.equal(result.entries.find(entry => entry.owner.kind === 'git-commit')?.title, 'Initial source');
        const dirty = result.entries.find(entry => entry.owner.kind === 'git-dirty');
        assert.equal(dirty?.kind, 'snapshot');
        assert.equal(dirty?.occurredAt, null);
        assert.ok(result.dirtyPaths.includes('source.txt'));
        assert.equal(JSON.stringify(result).includes('Private instructions'), false);
        assert.equal(JSON.stringify(result).includes('original\n'), false);
        assert.deepEqual(await Promise.all(paths.map(path => readFile(join(root, path)))), before);
        await assert.rejects(readFile(marker), { code: 'ENOENT' });
        assert.equal((await git(root, ['-c', 'core.fsmonitor=false', 'status', '--porcelain'])).stdout, statusBefore);
        assert.equal((await readHistoryWorkGitMetadata(project(root, 'other'), later)).entries.some(
            entry => entry.source === 'agent'), true); // Sequence has root scope; task/run IDs are project-bound.
        assert.equal((await readHistoryWorkGitMetadata(project(root, 'other'), later)).entries.some(
            entry => entry.owner.kind === 'agent-run' || entry.owner.kind === 'agent-task'), false);
        const validation = { version: 1 as const, kind: 'test' as const, label: 'unit', status: 'passed' as const,
            owner: 'dope' as const };
        const held = { ...run(), status: 'blocked' as const, startedAt: later, validationResults: [validation],
            candidateReview: { state: 'ready' as const }, provenance: { version: 1, connectionId: 'local',
                modelId: 'small', providerId: 'provider', adapterId: 'adapter', runtimeKind: 'local' as const } };
        assert.deepEqual(historyAgentRunStatus(held as never), { kind: 'agent-run', state: 'blocked',
            validation: 'passed', review: 'pending', promotion: 'not-applied', provenance: {
                connectionId: 'local', modelId: 'small', adapterId: 'adapter', runtimeKind: 'local' } });
        assert.equal((historyAgentRunStatus({ ...held, reviewDecision: { kind: 'accept' } } as never) as
            { promotion: string }).promotion, 'not-applied');
        assert.equal((historyAgentRunStatus({ ...held, status: 'completed', reviewDecision: { kind: 'accept' },
            authorityDecision: { allowed: true }, appliedFiles: ['source.txt'] } as never) as
            { promotion: string }).promotion, 'applied');
        assert.equal((historyAgentRunStatus({ ...held, validationResults: [{ ...validation, owner: undefined }] } as never) as
            { validation: string }).validation, 'unknown');
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('Git root, canonical path and bounded command failures are diagnostic and read only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-history-git-limit-'));
    try {
        await git(root, ['init', '-q']);
        await git(root, ['config', 'user.name', 'History Fixture']);
        await git(root, ['config', 'user.email', 'history@example.invalid']);
        await writeFile(join(root, 'tracked.txt'), 'tracked');
        await git(root, ['add', 'tracked.txt']);
        await git(root, ['commit', '-q', '-m', 'Root']);
        await mkdir(join(root, 'nested'));
        assert.match((await readHistoryWorkGitMetadata(project(join(root, 'nested')), later)).diagnostics
            .map(item => item.message).join(' '), /differs/);
        assert.equal((await readHistoryWorkGitMetadata(project(join(root, '..')), later)).entries.length, 0);
        await symlink(root, join(root, 'linked'));
        assert.equal((await readHistoryWorkGitMetadata(project(join(root, 'linked')), later)).entries.length, 0);
        for (let i = 0; i < 51; i++) await writeFile(join(root, `file-${i}.txt`), 'x');
        const capped = await readHistoryWorkGitMetadata(project(root), later);
        assert.equal(capped.dirtyPaths.length, 50);
        assert.equal(capped.truncated, true);
        await writeFile(join(root, 'huge.txt'), 'x'.repeat(70000));
        // A large file body is never read; Git status remains a bounded path list.
        assert.equal((await readHistoryWorkGitMetadata(project(root), later)).dirtyPaths.length, 50);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('a fresh non-Git project has no Git failure, while unsafe Git metadata remains visible', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-history-no-git-'));
    try {
        const empty = await readHistoryWorkGitMetadata(project(root), later);
        assert.deepEqual(empty.diagnostics, []);
        await writeFile(join(root, '.git'), 'gitdir: /missing/metadata');
        const invalid = await readHistoryWorkGitMetadata(project(root), later);
        assert.ok(invalid.diagnostics.some(item => item.source === 'git'));
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('Git command timeout returns a diagnostic within the fixed bound', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-history-git-timeout-'));
    const bin = join(root, 'bin');
    const priorPath = process.env.PATH;
    try {
        await mkdir(bin);
        await writeFile(join(bin, 'git'), '#!/bin/sh\nexec sleep 10\n');
        await chmod(join(bin, 'git'), 0o755);
        process.env.PATH = `${bin}:${priorPath}`;
        const start = Date.now();
        const result = await readHistoryWorkGitMetadata(project(root), later);
        assert.ok(Date.now() - start < 5000);
        assert.equal(result.entries.length, 0);
        assert.equal(result.diagnostics.some(item => item.source === 'git'), true);
    } finally {
        process.env.PATH = priorPath;
        await rm(root, { recursive: true, force: true });
    }
});

test('Git output beyond the fixed byte budget is rejected', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-history-git-output-'));
    const bin = join(root, 'bin');
    const priorPath = process.env.PATH;
    try {
        await mkdir(bin);
        await writeFile(join(bin, 'git'), '#!/bin/sh\nprintf "%070000d" 0\n');
        await chmod(join(bin, 'git'), 0o755);
        process.env.PATH = `${bin}:${priorPath}`;
        const result = await readHistoryWorkGitMetadata(project(root), later);
        assert.equal(result.entries.length, 0);
        assert.match(result.diagnostics.map(item => item.message).join(' '), /maxBuffer/);
    } finally {
        process.env.PATH = priorPath;
        await rm(root, { recursive: true, force: true });
    }
});
