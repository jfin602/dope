import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { link, lstat, mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection } from '../../packages/agent-core/lib/work-tool-selection.js';
import { parseAgentRun, parseAgentTask } from '../../packages/agent-core/lib/contracts.js';
import { DirectWorkJournal } from '../../packages/agent-core/lib/node/direct-work-journal.js';
import { captureDirtyBasis } from '../../packages/agent-core/lib/node/dirty-basis.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { launchLocalSandboxedTool } from '../../packages/agent-core/lib/node/local-tool-sandbox.js';
import { localWorkspaceBroker } from '../../packages/theia-extension/lib/node/local-agent-turn-loop.js';

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
async function waitFor(path: string): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt++) {
        try { await lstat(path); return; } catch { await new Promise(resolve => setTimeout(resolve, 10)); }
    }
    throw new Error('Timed out waiting for Direct writer test seam');
}
async function waitForPreparedTemp(journal: DirectWorkJournal): Promise<string> {
    for (let attempt = 0; attempt < 100; attempt++) {
        const saved = JSON.parse(await readFile(journal.path, 'utf8'));
        if (saved.changes[0]?.tempPath) return saved.changes[0].tempPath;
        await new Promise(resolve => setTimeout(resolve, 10));
    }
    throw new Error('Timed out waiting for Direct journal plan');
}

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

test('reviewed owner-dirty files remain attributable through successive edits and selective revert', async () => fixture(async (root, head) => {
    await writeFile(join(root, 'src', 'old.txt'), 'owner before\n');
    await writeFile(join(root, 'src', 'owner.txt'), 'owner untracked\n');
    const basis = await captureDirtyBasis(root);
    const journal = await DirectWorkJournal.create(root, head, 'task-direct', 'dirty-owner', grant(root),
        undefined, undefined, basis);
    await journal.edit('modify', 'src/old.txt', 'agent first\n', async () => false);
    await journal.edit('modify', 'src/old.txt', 'agent second\n', async () => false);
    assert.equal((await DirectWorkJournal.review(root, journal.path)).conflicts.length, 0);
    assert.equal((await DirectWorkJournal.revert(root, journal.path, ['src/old.txt'], async () => false))[0].result,
        'reverted');
    assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'owner before\n');
    assert.equal(await readFile(join(root, 'src', 'owner.txt'), 'utf8'), 'owner untracked\n');
}));

test('Dope History focus metadata does not block repeat Work, while other protected dirty paths do',
    async () => fixture(async (root) => {
        await mkdir(join(root, '.dope'));
        await writeFile(join(root, '.dope', 'history-focus.json'), '{"schemaVersion":1}\n');
        assert.deepEqual((await captureDirtyBasis(root)).paths, []);
        await writeFile(join(root, '.dope', 'foreign.json'), 'owner data\n');
        await assert.rejects(captureDirtyBasis(root), /Protected dirty path/);
        await rm(join(root, '.dope', 'foreign.json'));
        await rm(join(root, '.dope', 'history-focus.json'));
        await symlink('missing', join(root, '.dope', 'history-focus.json'));
        await assert.rejects(captureDirtyBasis(root), /Protected dirty path/);
    }));

test('reviewed untracked owner file is modified and restored as owner source, never an agent creation', async () => fixture(async (root, head) => {
    await writeFile(join(root, 'src', 'owner.txt'), 'owner untracked\n');
    const basis = await captureDirtyBasis(root);
    const journal = await DirectWorkJournal.create(root, head, 'task-direct', 'dirty-untracked', grant(root),
        undefined, undefined, basis);
    await assert.rejects(journal.edit('create', 'src/owner.txt', 'bad', async () => false), /create\/modify conflict/);
    const change = await journal.edit('modify', 'src/owner.txt', 'agent\n', async () => false);
    assert.equal(change.before, digest('owner untracked\n'));
    assert.equal((await DirectWorkJournal.revert(root, journal.path, ['src/owner.txt'], async () => false))[0].result,
        'reverted');
    assert.equal(await readFile(join(root, 'src', 'owner.txt'), 'utf8'), 'owner untracked\n');
}));

test('reviewed dirty basis rejects changes before start and before a brokered write', async () => fixture(async (root, head) => {
    await writeFile(join(root, 'src', 'old.txt'), 'owner before\n');
    const basis = await captureDirtyBasis(root);
    await writeFile(join(root, 'src', 'old.txt'), 'owner changed\n');
    await assert.rejects(DirectWorkJournal.create(root, head, 'task-direct', 'stale', grant(root),
        undefined, undefined, basis), /basis changed/);
    await writeFile(join(root, 'src', 'old.txt'), 'owner before\n');
    const journal = await DirectWorkJournal.create(root, head, 'task-direct', 'dirty-race', grant(root),
        undefined, undefined, await captureDirtyBasis(root));
    await writeFile(join(root, 'src', 'replacement.txt'), 'owner before\n');
    await rename(join(root, 'src', 'replacement.txt'), join(root, 'src', 'old.txt'));
    await assert.rejects(journal.edit('modify', 'src/old.txt', 'agent\n', async () => false), /owner source changed/);
    assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'owner before\n');
}));

test('unrelated reviewed owner edit changing during Direct Work blocks further broker writes', async () => fixture(async (root, head) => {
    await writeFile(join(root, 'src', 'owner.txt'), 'owner before\n');
    const journal = await DirectWorkJournal.create(root, head, 'task-direct', 'dirty-unrelated', grant(root),
        undefined, undefined, await captureDirtyBasis(root));
    await journal.edit('modify', 'src/old.txt', 'agent first\n', async () => false);
    await writeFile(join(root, 'src', 'owner.txt'), 'owner changed\n');
    await assert.rejects(journal.edit('modify', 'src/old.txt', 'agent second\n', async () => false),
        /owner source changed/);
    assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'agent first\n');
    assert.equal(await readFile(join(root, 'src', 'owner.txt'), 'utf8'), 'owner changed\n');
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
    await writeFile(join(root, '.git', 'info', 'exclude'), 'src/ignored.txt\n');
    await assert.rejects(journal.edit('create', 'src/ignored.txt', 'bad', async () => false), /Ignored project path/);
    await assert.rejects(readFile(join(root, 'src', 'ignored.txt')), /ENOENT/);
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
    await assert.rejects(journal.edit('create', 'src/.dope/second.txt', 'bad', async () => false));
    assert.equal(journal.changes.length, 1);
    assert.equal(journal.changes[0].result, 'completed');
    await writeFile(join(root, 'src', 'old.txt'), 'owner after agent\n');
    await assert.rejects(journal.edit('modify', 'src/old.txt', 'agent second\n', async () => false), /conflict/i);
    assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'owner after agent\n');
}));

test('Direct review reverts only matching after-state files and keeps owner edits', async () => fixture(async (root, head) => {
    const journal = await create(root, head);
    await journal.edit('modify', 'src/old.txt', 'agent first\n', async () => false);
    await journal.edit('modify', 'src/old.txt', 'agent second\n', async () => false);
    await journal.edit('create', 'src/new.txt', 'agent new\n', async () => false);
    assert.deepEqual((await DirectWorkJournal.review(root, journal.path)).conflicts, []);
    await writeFile(join(root, 'src/new.txt'), 'owner new\n');
    assert.deepEqual((await DirectWorkJournal.review(root, journal.path)).conflicts, ['src/new.txt']);
    assert.deepEqual(await DirectWorkJournal.revert(root, journal.path,
        ['src/old.txt', 'src/new.txt'], async () => false), [
        { path: 'src/old.txt', result: 'reverted' },
        { path: 'src/new.txt', result: 'conflict', reason: 'Current file identity or hash differs from the agent after-state' }
    ]);
    assert.equal(await readFile(join(root, 'src/old.txt'), 'utf8'), 'original\n');
    assert.equal(await readFile(join(root, 'src/new.txt'), 'utf8'), 'owner new\n');
}));

test('Direct review removes a matching agent-created file and blocks unsaved editor changes', async () => fixture(async (root, head) => {
    const journal = await create(root, head);
    await journal.edit('create', 'src/new.txt', 'new\n', async () => false);
    assert.equal((await DirectWorkJournal.revert(root, journal.path, ['src/new.txt'], async () => true))[0].result, 'conflict');
    assert.equal(await readFile(join(root, 'src/new.txt'), 'utf8'), 'new\n');
    assert.equal((await DirectWorkJournal.revert(root, journal.path, ['src/new.txt'], async () => false))[0].result, 'reverted');
    await assert.rejects(readFile(join(root, 'src/new.txt')), /ENOENT/);
}));

test('Direct review refuses a same-byte replacement with a different file identity', async () => fixture(async (root, head) => {
    const journal = await create(root, head);
    await journal.edit('modify', 'src/old.txt', 'agent\n', async () => false);
    await writeFile(join(root, 'src/replacement.txt'), 'agent\n');
    await rename(join(root, 'src/replacement.txt'), join(root, 'src/old.txt'));
    assert.deepEqual((await DirectWorkJournal.review(root, journal.path)).conflicts, ['src/old.txt']);
    assert.equal((await DirectWorkJournal.revert(root, journal.path, ['src/old.txt'], async () => false))[0].result, 'conflict');
    assert.equal(await readFile(join(root, 'src/old.txt'), 'utf8'), 'agent\n');
}));

test('new Direct segment binds prior applied source and reverts only its own edits', async () => fixture(async (root, head) => {
    const first = await create(root, head, 'segment-1');
    const prior = await first.edit('modify', 'src/old.txt', 'segment one\n', async () => false);
    const second = await DirectWorkJournal.create(root, head, 'task-direct', 'segment-2', grant(root),
        undefined, [{ path: prior.path, after: prior.after, afterIdentity: prior.afterIdentity! }]);
    await second.assertActive();
    await second.edit('modify', 'src/old.txt', 'segment two\n', async () => false);
    assert.equal((await DirectWorkJournal.revert(root, second.path, ['src/old.txt'], async () => false))[0].result, 'reverted');
    assert.equal(await readFile(join(root, 'src/old.txt'), 'utf8'), 'segment one\n');
}));

test('new Direct segment retains an unchanged owner baseline beside inherited agent edits', async () => fixture(async (root, head) => {
    await writeFile(join(root, 'src', 'old.txt'), 'owner before\n');
    await writeFile(join(root, 'src', 'owner.txt'), 'owner untracked\n');
    const first = await DirectWorkJournal.create(root, head, 'task-direct', 'dirty-segment-1', grant(root),
        undefined, undefined, await captureDirtyBasis(root));
    const prior = await first.edit('modify', 'src/old.txt', 'agent first\n', async () => false);
    const second = await DirectWorkJournal.create(root, head, 'task-direct', 'dirty-segment-2', grant(root),
        undefined, [{ path: prior.path, after: prior.after, afterIdentity: prior.afterIdentity! }],
        await captureDirtyBasis(root));
    await second.assertActive();
    await second.edit('modify', 'src/old.txt', 'agent second\n', async () => false);
    assert.equal((await DirectWorkJournal.revert(root, second.path, ['src/old.txt'], async () => false))[0].result,
        'reverted');
    assert.equal(await readFile(join(root, 'src', 'old.txt'), 'utf8'), 'agent first\n');
    assert.equal(await readFile(join(root, 'src', 'owner.txt'), 'utf8'), 'owner untracked\n');
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

test('Direct whole write creates nested parents, rewrites its file, exact edits, and removes only empty attributed parents',
    async () => fixture(async (root, head) => {
        const journal = await create(root, head);
        const first = await journal.write('new/deep/file.txt', '\ufeffalpha\r\n', async () => false);
        assert.deepEqual(first.parents?.filter(parent => parent.before === 'absent').map(parent => parent.path),
            ['new', 'new/deep']);
        assert.equal(first.result, 'completed');
        await journal.write('new/deep/file.txt', '\ufeffalpha\r\nbeta\r\n', async () => false);
        const edited = await journal.exactEdit('new/deep/file.txt', [{ oldText: 'beta', newText: 'gamma' }],
            async () => false);
        assert.equal(edited.before, digest('\ufeffalpha\r\nbeta\r\n'));
        assert.equal(await readFile(join(root, 'new/deep/file.txt'), 'utf8'), '\ufeffalpha\r\ngamma\r\n');
        assert.deepEqual((await DirectWorkJournal.review(root, journal.path)).conflicts, []);
        assert.equal((await DirectWorkJournal.revert(root, journal.path, ['new/deep/file.txt'], async () => false))[0].result,
            'reverted');
        await assert.rejects(readFile(join(root, 'new/deep/file.txt')), /ENOENT/);
        await assert.rejects(readFile(join(root, 'new/deep')), /ENOENT|EISDIR/);
        await assert.rejects(readFile(join(root, 'new')), /ENOENT|EISDIR/);
    }));

test('Direct nested revert retains an owner-used directory and mixed safe/unsafe files',
    async () => fixture(async (root, head) => {
        const journal = await create(root, head);
        await journal.write('new/deep/safe.txt', 'safe', async () => false);
        await journal.write('new/deep/unsafe.txt', 'unsafe', async () => false);
        await writeFile(join(root, 'new/deep/owner.txt'), 'owner');
        await writeFile(join(root, 'new/deep/unsafe.txt'), 'owner changed');
        const result = await DirectWorkJournal.revert(root, journal.path,
            ['new/deep/safe.txt', 'new/deep/unsafe.txt'], async () => false);
        assert.deepEqual(result.map(item => item.result), ['reverted', 'conflict']);
        assert.equal(await readFile(join(root, 'new/deep/owner.txt'), 'utf8'), 'owner');
        assert.equal(await readFile(join(root, 'new/deep/unsafe.txt'), 'utf8'), 'owner changed');
        await assert.rejects(readFile(join(root, 'new/deep/safe.txt')), /ENOENT/);
    }));

test('Direct write treats saved tabs as writable and unsaved tabs and stale exact edits as conflicts',
    async () => fixture(async (root, head) => {
        const journal = await create(root, head);
        await journal.write('src/old.txt', 'saved tab\n', async () => false);
        await assert.rejects(journal.write('src/old.txt', 'bad', async () => true), /Unsaved editor/);
        await assert.rejects(journal.exactEdit('src/old.txt', [{ oldText: 'missing', newText: 'bad' }],
            async () => false), /match conflict/);
        assert.equal(await readFile(join(root, 'src/old.txt'), 'utf8'), 'saved tab\n');
    }));

test('Direct parent and file fault receipts block replay and preserve outside symlink targets',
    async () => fixture(async (root, head) => {
        const journal = await create(root, head);
        await assert.rejects(journal.edit('create', 'new/partial.txt', 'partial', async () => false,
            undefined, undefined, 'after-file'), /uncertain/);
        assert.equal(await readFile(join(root, 'new/partial.txt'), 'utf8'), 'partial');
        assert.equal((await DirectWorkJournal.reconcile(root, journal.path))[0].result, 'uncertain');
        await assert.rejects(journal.write('new/partial.txt', 'replay', async () => false), /reconciliation/);
        await assert.rejects(DirectWorkJournal.revert(root, journal.path, ['new/partial.txt'], async () => false),
            /uncertain/);
        const other = await create(root, head, 'other');
        await symlink('src', join(root, 'link'));
        await assert.rejects(other.write('link/bad.txt', 'bad', async () => false), /Unsafe direct parent/);
        await assert.rejects(readFile(join(root, 'src/bad.txt')), /ENOENT/);
    }));

test('Direct pre-commit owner replacement is a conflict and does not overwrite owner bytes',
    async () => fixture(async (root, head) => {
        const journal = await create(root, head);
        const operation = journal.edit('modify', 'src/old.txt', 'agent', async () => false,
            undefined, undefined, 'pause-after-temp');
        const temp = await waitForPreparedTemp(journal);
        await waitFor(join(root, 'src', temp));
        await writeFile(join(root, 'src/owner-replacement.txt'), 'owner');
        await rename(join(root, 'src/owner-replacement.txt'), join(root, 'src/old.txt'));
        await assert.rejects(operation, /source conflict/);
        assert.equal(await readFile(join(root, 'src/old.txt'), 'utf8'), 'owner');
        assert.equal((await DirectWorkJournal.reconcile(root, journal.path))[0].result, 'not-applied');
    }));

test('Direct cancellation after parent creation retains a prepared receipt and prevents replay',
    async () => fixture(async (root, head) => {
        const journal = await create(root, head);
        const controller = new AbortController();
        const operation = journal.edit('create', 'cancel/child.txt', 'agent', async () => false,
            controller.signal, undefined, 'pause-after-parent');
        await waitFor(join(root, 'cancel'));
        controller.abort();
        await assert.rejects(operation);
        assert.equal((await DirectWorkJournal.reconcile(root, journal.path))[0].result, 'uncertain');
        await assert.rejects(journal.write('cancel/child.txt', 'retry', async () => false),
            /reconciliation|journal changed/);
        await assert.rejects(readFile(join(root, 'cancel/child.txt')), /ENOENT/);
    }));

test('Direct mid-file fault rolls back its temporary file and new parents with a verified no-effect receipt',
    async () => fixture(async (root, head) => {
        const journal = await create(root, head);
        await assert.rejects(journal.edit('create', 'partial/deep/file.txt', 'agent', async () => false,
            undefined, undefined, 'after-temp'), /write denied/);
        assert.equal(journal.changes[0].result, 'not-applied');
        await assert.rejects(lstat(join(root, 'partial')), /ENOENT/);
        assert.equal((await DirectWorkJournal.reconcile(root, journal.path))[0].result, 'not-applied');
        await journal.write('partial/deep/file.txt', 'retry', async () => false);
        assert.equal(await readFile(join(root, 'partial/deep/file.txt'), 'utf8'), 'retry');
    }));

test('Direct exact edit rejects a same-byte identity swap during editor preflight',
    async () => fixture(async (root, head) => {
        const journal = await create(root, head);
        await assert.rejects(journal.exactEdit('src/old.txt',
            [{ oldText: 'original', newText: 'agent' }], async () => {
                await writeFile(join(root, 'src/replacement.txt'), 'original\n');
                await rename(join(root, 'src/replacement.txt'), join(root, 'src/old.txt'));
                return false;
            }), /identity conflict/);
        assert.equal(await readFile(join(root, 'src/old.txt'), 'utf8'), 'original\n');
        assert.equal(journal.changes.length, 0);
    }));

test('Direct rapid same-file calls serialize and never journal a second overlapping effect',
    async () => fixture(async (root, head) => {
        const journal = await create(root, head);
        const first = journal.edit('modify', 'src/old.txt', 'first', async () => false);
        await assert.rejects(journal.edit('modify', 'src/old.txt', 'second', async () => false),
            /Concurrent Direct Work operation/);
        await first;
        await journal.write('src/old.txt', 'second', async () => false);
        assert.equal(await readFile(join(root, 'src/old.txt'), 'utf8'), 'second');
        assert.deepEqual(journal.changes.map(change => change.result), ['completed', 'completed']);
    }));

test('Direct denies ignored and hardlinked targets before any canonical mutation',
    async () => fixture(async (root, head) => {
        await writeFile(join(root, '.gitignore'), 'ignored/\n');
        const journal = await DirectWorkJournal.create(root, head, 'task-direct', 'ignored', grant(root),
            undefined, undefined, await captureDirtyBasis(root));
        await assert.rejects(journal.write('ignored/nested/file.txt', 'bad', async () => false), /Ignored project path/);
        await link(join(root, 'src/old.txt'), join(root, 'src/hardlink.txt'));
        await assert.rejects(journal.write('src/old.txt', 'bad', async () => false), /Unsafe direct target/);
        await assert.rejects(readFile(join(root, 'ignored/nested/file.txt')), /ENOENT/);
        assert.equal(journal.changes.length, 0);
    }));

test('Direct broker mirrors nested whole writes and exact edits into the isolated model view',
    async () => fixture(async (root, head) => {
        const workspace = await ExecutionWorkspace.create(root);
        try {
            const offered = grant(root);
            const journal = await DirectWorkJournal.create(root, head, 'task-direct', 'run-direct', offered);
            workspace.bindDirectBasis(journal);
            const request: any = { projectRoot: root, executionRoot: workspace.root, grant: offered,
                taskId: 'task-direct', runId: 'run-direct', executionMode: 'direct',
                connectionId: 'local', registrationId: 'local', modelId: 'model', prompt: '', onEvent() {} };
            const direct = { journal, unsaved: async () => false, refresh: async () => true };
            const broker = localWorkspaceBroker(request, workspace, [], direct);
            const execute = (input: any) => broker.executeFileOperation!(input, new AbortController().signal);
            const first = await execute({ id: 'one', kind: 'write', path: 'new/deep/file.txt', content: 'alpha' });
            assert.equal(first.status, 'completed', JSON.stringify(first));
            assert.equal((await execute({ id: 'two', kind: 'write', path: 'new/deep/file.txt', content: 'alpha beta' })).status,
                'completed');
            assert.equal((await execute({ id: 'three', kind: 'edit', path: 'new/deep/file.txt', edits: [
                { oldText: 'beta', newText: 'gamma' }] })).status, 'completed');
            assert.equal(await readFile(join(root, 'new/deep/file.txt'), 'utf8'), 'alpha gamma');
            assert.equal(await readFile(join(workspace.root, 'new/deep/file.txt'), 'utf8'), 'alpha gamma');
            assert.equal(journal.changes.length, 3);
            const legacy = await broker.execute({ id: 'legacy', name: 'edit',
                arguments: { operation: 'create', path: 'legacy/deep.txt', content: 'legacy' } },
                new AbortController().signal);
            assert.equal(legacy.status, 'completed');
            assert.equal(await readFile(join(workspace.root, 'legacy/deep.txt'), 'utf8'), 'legacy');
            const forged = localWorkspaceBroker({ ...request, grant: { ...offered,
                toolSelection: { ...offered.toolSelection, tools: [] } } }, workspace, [], direct);
            assert.equal((await forged.executeFileOperation!({ id: 'forged', kind: 'write',
                path: 'new/deep/file.txt', content: 'bad' }, new AbortController().signal)).status, 'denied');
        } finally { await workspace.dispose(); }
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
