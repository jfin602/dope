import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection } from '../../packages/agent-core/lib/work-tool-selection.js';
import { parseAgentRun, parseAgentTask } from '../../packages/agent-core/lib/contracts.js';
import { DirectWorkJournal } from '../../packages/agent-core/lib/node/direct-work-journal.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { launchLocalSandboxedTool } from '../../packages/agent-core/lib/node/local-tool-sandbox.js';

const exec = promisify(execFile);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
async function fixture(body: (root: string, head: string) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'dope-direct-work-'));
    try {
        await exec('git', ['init', '-q', root]);
        await exec('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
        await exec('git', ['config', 'user.name', 'Test'], { cwd: root });
        await mkdir(join(root, 'src'));
        await writeFile(join(root, 'src', 'old.txt'), 'original\n');
        await exec('git', ['add', 'src/old.txt'], { cwd: root });
        await exec('git', ['commit', '-qm', 'basis'], { cwd: root });
        const head = (await exec('git', ['rev-parse', 'HEAD'], { cwd: root })).stdout.trim();
        await body(root, head);
    } finally { await rm(root, { recursive: true, force: true }); }
}
const grant = (root: string) => createDefaultExecutionGrant({ id: 'grant-direct', revision: 1,
    taskId: 'task-direct', acceptedAt: new Date().toISOString(), toolSelection: makeWorkToolSelection({
        projectUri: pathToFileURL(root).href, taskId: 'task-direct', grantRevision: 1,
        connectionId: 'local', modelId: 'model' }, ['edit_file']) });
const create = (root: string, head: string, runId = 'run-direct') =>
    DirectWorkJournal.create(root, head, 'task-direct', runId, grant(root));

test('Direct writer enforces sealed tool selection and delegated scope', async () => fixture(async (root, head) => {
    const unselected = await DirectWorkJournal.create(root, head, 'task-direct', 'unselected',
        createDefaultExecutionGrant({ id: 'unselected', revision: 1, taskId: 'task-direct',
            acceptedAt: new Date().toISOString() }));
    await assert.rejects(unselected.edit('modify', 'src/old.txt', 'bad', async () => false), /tool or delegated scope/);
    const scoped = await DirectWorkJournal.create(root, head, 'task-direct', 'scoped', grant(root),
        { authorizedPaths: ['src'], reservedPaths: ['src/old.txt'] });
    await assert.rejects(scoped.edit('modify', 'src/old.txt', 'bad', async () => false), /tool or delegated scope/);
    assert.equal(await readFile(join(root, 'src/old.txt'), 'utf8'), 'original\n');
}));

test('Direct Work creates, modifies successively, and retains exact before images', async () => fixture(async (root, head) => {
    const journal = await create(root, head);
    const noUnsaved = async () => false;
    const first = await journal.edit('modify', 'src/old.txt', 'first\n', noUnsaved);
    assert.equal(first.before, digest('original\n'));
    assert.equal(Buffer.from(first.beforeBytes!, 'base64').toString(), 'original\n');
    const second = await journal.edit('modify', 'src/old.txt', 'second\n', noUnsaved);
    assert.equal(second.before, digest('first\n'));
    const created = await journal.edit('create', 'src/new.txt', 'new\n', noUnsaved);
    assert.equal(created.before, null);
    assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'second\n');
    assert.equal(await readFile(join(root, 'src', 'new.txt'), 'utf8'), 'new\n');
    const saved = JSON.parse(await readFile(journal.path, 'utf8'));
    assert.deepEqual(saved.changes.map((item: { result: string }) => item.result),
        ['completed', 'completed', 'completed']);
    assert.deepEqual((await DirectWorkJournal.reconcile(root, journal.path)).map(item => item.result),
        ['completed', 'completed', 'completed']);
}));

test('Direct Work denies owner edits, dirty/untracked targets, unsaved editors, and unsafe paths', async () => fixture(async (root, head) => {
    const journal = await create(root, head);
    await assert.rejects(journal.edit('modify', 'src/old.txt', 'bad', async () => true), /Unsaved editor/);
    assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'original\n');
    await writeFile(join(root, 'src', 'old.txt'), 'owner edit\n');
    await assert.rejects(journal.edit('modify', 'src/old.txt', 'bad', async () => false), /owner source|dirty/i);
    await writeFile(join(root, 'src', 'old.txt'), 'original\n');
    await writeFile(join(root, 'src', 'untracked.txt'), 'owner untracked');
    await assert.rejects(journal.edit('create', 'src/untracked.txt', 'bad', async () => false), /owner source|dirty/i);
    await rm(join(root, 'src', 'untracked.txt'));
    for (const path of ['../escape', 'src/../../escape', '.git/config', '.dope/x', 'src/.env'])
        await assert.rejects(journal.edit('create', path, 'bad', async () => false));
    await symlink(root, join(root, 'src', 'escape'));
    await assert.rejects(journal.edit('modify', 'src/escape', 'bad', async () => false));
    await rm(join(root, 'src', 'escape'));
    await assert.rejects(journal.edit('delete' as 'modify', 'src/old.txt', 'bad', async () => false));
    await assert.rejects(journal.edit('rename' as 'modify', 'src/old.txt', 'bad', async () => false));
}));

test('Direct Work records a completed first file when a second file fails, and detects later conflicts', async () => fixture(async (root, head) => {
    const journal = await create(root, head);
    await journal.edit('modify', 'src/old.txt', 'agent first\n', async () => false);
    await assert.rejects(journal.edit('create', 'src/missing/second.txt', 'bad', async () => false));
    assert.equal(journal.changes.length, 1);
    assert.equal(journal.changes[0].result, 'completed');
    await writeFile(join(root, 'src', 'old.txt'), 'owner after agent\n');
    await assert.rejects(journal.edit('modify', 'src/old.txt', 'agent second\n', async () => false), /conflict/i);
    assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'owner after agent\n');
}));

test('restart reconciliation distinguishes completed, absent and uncertain prepared writes', async () => fixture(async (root, head) => {
    const journal = await create(root, head);
    await journal.edit('modify', 'src/old.txt', 'agent\n', async () => false);
    assert.equal((await DirectWorkJournal.reconcile(root, journal.path))[0].result, 'completed');
    const saved = JSON.parse(await readFile(journal.path, 'utf8'));
    saved.changes[0].result = 'prepared';
    saved.changes[0].finishedAt = undefined;
    saved.changes.push({ id: 'pending-create', taskId: 'task-direct', runId: 'run-direct',
        operation: 'create', path: 'src/not-written.txt', before: null, beforeBytes: null,
        after: digest('later'), afterBytes: Buffer.from('later').toString('base64'),
        at: new Date().toISOString(), result: 'prepared' });
    await writeFile(journal.path, JSON.stringify(saved));
    assert.deepEqual((await DirectWorkJournal.reconcile(root, journal.path)).map(item => item.result),
        ['uncertain', 'not-applied']);
    const next = JSON.parse(await readFile(journal.path, 'utf8'));
    next.changes[0].result = 'prepared';
    await writeFile(join(root, 'src', 'old.txt'), 'owner concurrent\n');
    await writeFile(journal.path, JSON.stringify(next));
    assert.equal((await DirectWorkJournal.reconcile(root, journal.path))[0].result, 'uncertain');
}));

test('historical AgentTask and AgentRun records remain isolated when mode is absent', () => {
    const task = parseAgentTask({ version: 1, id: 'old-task', createdAt: '2026-11-25T00:00:00Z',
        objective: 'Read source', instructions: 'Read source', projectRoot: '.',
        modelPolicy: { kind: 'follow-coding-agent' }, controls: {}, authority: { profile: 'phase-8b-project' },
        completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' } });
    assert.equal(task.executionMode ?? 'isolated', 'isolated');
    const run = parseAgentRun({ version: 1, id: 'old-run', taskId: 'old-task', status: 'pending',
        grantId: 'old-grant', grantRevision: 0, requestedPolicy: { kind: 'follow-coding-agent' },
        projectRoot: '.', createdAt: '2026-11-25T00:00:00Z', changedFiles: [], validationResults: [] });
    assert.equal(run.executionMode ?? 'isolated', 'isolated');
});

test('model command sandbox cannot write the canonical project', async () => fixture(async (root) => {
    const workspace = await ExecutionWorkspace.create(root);
    try {
        const result = await launchLocalSandboxedTool({ workspaceRoot: workspace.root },
            ['/usr/bin/python3', '-c', `import pathlib,sys\ntry: pathlib.Path(sys.argv[1]).write_text('bypass')\nexcept OSError: pass\nprint('done')`,
                join(root, 'src', 'old.txt')]);
        assert.equal(result.exitCode, 0);
        assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'original\n');
    } finally { await workspace.dispose(); }
}));
