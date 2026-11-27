import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { existsSync, watch } from 'node:fs';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection } from '../../packages/agent-core/lib/work-tool-selection.js';
import { captureDirtyBasis } from '../../packages/agent-core/lib/node/dirty-basis.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { brokerIsolatedFileOperation } from '../../packages/agent-core/lib/node/isolated-file-operations.js';
import { ISOLATED_FILE_SCRIPT } from '../../packages/agent-core/lib/node/isolated-file-operations.js';
import { launchLocalSandboxedTool } from '../../packages/agent-core/lib/node/local-tool-sandbox.js';

const execute = promisify(execFile);

async function fixture(run: (root: string, workspace: ExecutionWorkspace, request: any) => Promise<void>): Promise<void> {
    const parent = await mkdtemp(join(tmpdir(), 'dope-isolated-file-'));
    const root = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    try {
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), root]);
        await writeFile(join(root, 'index.html'), '<html>first</html>\r\n');
        const basis = await captureDirtyBasis(root);
        workspace = await ExecutionWorkspace.create(root, basis);
        const taskId = 'isolated-task';
        const grant = createDefaultExecutionGrant({ id: 'isolated-grant', revision: 0,
            taskId, acceptedAt: new Date().toISOString(), toolSelection: makeWorkToolSelection({
                projectUri: pathToFileURL(root).toString(), taskId, grantRevision: 0,
                grantId: 'isolated-grant', executionMode: 'isolated',
                connectionId: 'local', modelId: 'model'
            }, ['read', 'write', 'edit']) });
        const request = { projectRoot: root, executionRoot: workspace.root, grant, taskId,
            connectionId: 'local', registrationId: 'local', modelId: 'model', prompt: '', onEvent() {} };
        await run(root, workspace, request);
    } finally { await workspace?.dispose(); await rm(parent, { recursive: true, force: true }); }
}

test('isolated whole operations create parents, overwrite, edit exactly, and promote only on Accept', async () => fixture(async (root, workspace, request) => {
    const op = (input: any, signal?: AbortSignal) => brokerIsolatedFileOperation(request, workspace, input, signal);
    assert.equal((await op({ kind: 'read', path: 'index.html' })).status, 'completed');
    assert.deepEqual(await op({ kind: 'write', path: 'src/main.ts', content: 'export const n = 1;\n' }),
        { status: 'completed', output: '', createdDirectories: ['src'], bytesWritten: 20 });
    assert.equal((await op({ kind: 'write', path: 'index.html', content: '\uFEFFalpha\r\nbeta\r\n' })).status, 'completed');
    assert.equal((await op({ kind: 'edit', path: 'index.html', edits: [
        { oldText: 'alpha\nbeta', newText: 'gamma\ndelta' }
    ] })).status, 'completed');
    assert.equal(await readFile(join(workspace.root, 'index.html'), 'utf8'), '\uFEFFgamma\r\ndelta\r\n');
    assert.equal(await readFile(join(root, 'index.html'), 'utf8'), '<html>first</html>\r\n');
    assert.equal(existsSync(join(root, 'src')), false);
    const delta = await workspace.delta();
    assert.deepEqual(delta.effects.map(effect => [effect.kind, effect.path]), [
        ['modify', 'index.html'], ['create', 'src/main.ts']
    ]);
    assert.deepEqual((await workspace.promote(request.grant, delta)).applied, ['index.html', 'src/main.ts']);
    assert.equal(await readFile(join(root, 'src/main.ts'), 'utf8'), 'export const n = 1;\n');
}));

test('isolated denials leave no new parent and exact edits reject stale, duplicate, overlap and invalid data', async () => fixture(async (root, workspace, request) => {
    const op = (input: any, req = request) => brokerIsolatedFileOperation(req, workspace, input);
    for (const path of ['.git/config', 'new/.env', '../escape', '/tmp/escape', 'new/../escape', 'new/secret.key']) {
        assert.equal((await op({ kind: 'write', path, content: 'bad' })).status, 'denied', path);
    }
    assert.equal(existsSync(join(workspace.root, 'new')), false);
    assert.equal((await op({ kind: 'write', path: 'new/deep/file.txt', content: 'x'.repeat(65537) })).status, 'denied');
    assert.equal((await op({ kind: 'write', path: 'new/deep/file.txt', content: 'x\0' })).status, 'denied');
    assert.equal((await op({ kind: 'write', path: 'new/deep/file.txt', content: '\ud800' })).status, 'denied');
    assert.equal((await op({ kind: 'write', path: `new/${'a'.repeat(300)}`, content: 'bad' })).status, 'denied');
    assert.equal(existsSync(join(workspace.root, 'new')), false); // Parent was created, then rolled back.
    assert.equal(existsSync(join(workspace.root, 'new')), false);
    assert.equal((await op({ kind: 'write', path: 'new/deep/file.txt', content: 'bad' }, {
        ...request, grant: { ...request.grant, permissions: { ...request.grant.permissions, 'workspace-write': false } }
    })).status, 'denied');
    assert.equal(existsSync(join(workspace.root, 'new')), false);
    assert.equal((await op({ kind: 'write', path: 'new/deep/file.txt', content: 'bad' }, {
        ...request, grant: { ...request.grant, toolSelection: makeWorkToolSelection({
            projectUri: pathToFileURL(root).toString(), taskId: request.taskId, grantRevision: 0,
            grantId: 'isolated-grant', executionMode: 'isolated',
            connectionId: 'local', modelId: 'model' }, ['read']) }
    })).status, 'denied');
    assert.equal(existsSync(join(workspace.root, 'new')), false);
    await writeFile(join(workspace.root, 'duplicate.txt'), 'one one');
    const edit = (path: string, edits: any[]) => op({ kind: 'edit', path, edits });
    assert.equal((await edit('duplicate.txt', [{ oldText: 'one', newText: 'two' }])).output, 'EDIT_MATCH_CONFLICT');
    assert.equal((await edit('duplicate.txt', [{ oldText: 'missing', newText: 'two' }])).output, 'EDIT_MATCH_CONFLICT');
    assert.equal((await edit('duplicate.txt', [
        { oldText: 'one one', newText: 'two' }, { oldText: 'one', newText: 'three' }
    ])).output, 'EDIT_MATCH_CONFLICT');
    assert.equal(await readFile(join(workspace.root, 'duplicate.txt'), 'utf8'), 'one one');
    const prior = await op({ kind: 'read', path: 'index.html' });
    assert.equal(prior.status, 'completed');
    await writeFile(join(workspace.root, 'index.html'), 'concurrent replacement');
    assert.equal((await edit('index.html', [{ oldText: '<html>first</html>', newText: 'new' }])).output,
        'EDIT_MATCH_CONFLICT');
    assert.equal(await readFile(join(workspace.root, 'index.html'), 'utf8'), 'concurrent replacement');
    const abort = new AbortController(); abort.abort();
    assert.equal((await brokerIsolatedFileOperation(request, workspace,
        { kind: 'write', path: 'cancelled/deep/file.txt', content: 'bad' }, abort.signal)).status, 'cancelled');
    assert.equal(existsSync(join(workspace.root, 'cancelled')), false);
    const outside = join(root, '..', 'outside'); await writeFile(outside, 'untouched');
    await symlink(outside, join(workspace.root, 'escape'));
    assert.equal((await op({ kind: 'write', path: 'escape', content: 'bad' })).status, 'denied');
    await symlink(root, join(workspace.root, 'linked'));
    assert.equal((await op({ kind: 'write', path: 'linked/file.txt', content: 'bad' })).status, 'denied');
    assert.equal(await readFile(outside, 'utf8'), 'untouched');
    await rm(join(workspace.root, 'escape')); await rm(join(workspace.root, 'linked'));
    await rm(join(workspace.root, 'duplicate.txt'));
    assert.equal(existsSync(join(root, 'new')), false); // Reject: dispose without promotion.
}));

test('sandbox edit rechecks the actual target after an intervening replacement', async () => fixture(async (_root, workspace) => {
    const marker = '  fd=os.open(leaf,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent)';
    const recheck = ISOLATED_FILE_SCRIPT.lastIndexOf(marker);
    assert.ok(recheck > ISOLATED_FILE_SCRIPT.indexOf(marker));
    const delayed = ISOLATED_FILE_SCRIPT.slice(0, recheck) +
        '  import time; time.sleep(0.4)\n' + ISOLATED_FILE_SCRIPT.slice(recheck);
    const args = ['/usr/bin/python3', '-c', delayed, 'edit', 'index.html',
        Buffer.from(JSON.stringify([{ oldText: 'first', newText: 'second' }])).toString('base64'), '65536'];
    const temporary = new Promise<void>((resolve, reject) => {
        const watcher = watch(workspace.root, (_event, name) => {
            if (name?.toString().startsWith('.dope-edit-')) {
                clearTimeout(timeout); watcher.close(); resolve();
            }
        });
        const timeout = setTimeout(() => { watcher.close(); reject(new Error('No edit staging event')); }, 4000);
    });
    const pending = launchLocalSandboxedTool({ workspaceRoot: workspace.root }, args, 5000);
    await temporary;
    await writeFile(join(workspace.root, 'index.html'), 'external replacement');
    const settled = await pending;
    assert.equal(settled.exitCode, 0);
    assert.equal(JSON.parse(settled.stdout).status, 'denied');
    assert.equal(await readFile(join(workspace.root, 'index.html'), 'utf8'), 'external replacement');
}));

test('cancellation after staging produces an explicit candidate recovery state', async () => fixture(async (_root, workspace, request) => {
    const abort = new AbortController();
    let observed = false;
    const watcher = watch(workspace.root, (_event, name) => {
        if (name?.toString().startsWith('.dope-edit-')) { observed = true; abort.abort(); }
    });
    try {
        const result = await brokerIsolatedFileOperation(request, workspace,
            { kind: 'write', path: 'index.html', content: 'x'.repeat(65536) }, abort.signal);
        assert.equal(observed, true);
        assert.equal(result.status, 'recovery-required');
        assert.equal(result.output, 'RECONCILE_CANDIDATE');
    } finally { watcher.close(); }
}));
