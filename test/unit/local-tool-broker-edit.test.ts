import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { brokerLocalEdit } from '../../packages/agent-core/lib/node/local-tool-broker.js';
import { LOCAL_TOOL_LIMITS } from '../../packages/agent-core/lib/node/local-tool-contracts.js';

const execute = promisify(execFile);

test('broker creates and modifies only bounded candidate files under fixed authority', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-broker-edit-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    try {
        // Clone the existing committed fixture; no test or runner HEAD is moved or rewritten.
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), project]);
        const original = await readFile(join(project, 'README.md'), 'utf8');
        const head = (await execute('git', ['rev-parse', 'HEAD'], { cwd: project })).stdout.trim();
        workspace = await ExecutionWorkspace.create(project);
        const grant = createDefaultExecutionGrant({ id: 'grant-1', revision: 0, taskId: 'task-1',
            acceptedAt: new Date().toISOString() });
        const request = { projectRoot: project, executionRoot: workspace.root, grant, taskId: 'task-1',
            connectionId: 'local', registrationId: 'local', modelId: 'model', prompt: '', onEvent() {} };
        const edit = (operation: 'create' | 'modify', path: string, content: string) =>
            ({ id: 'call-1', name: 'edit' as const, arguments: { operation, path, content } });
        const run = (operation: 'create' | 'modify', path: string, content: string) =>
            brokerLocalEdit(request, workspace!, edit(operation, path, content));

        assert.equal((await run('create', 'packages/agent-core/src/p4-canary.txt', 'created')).status, 'completed');
        assert.equal((await run('modify', 'README.md', 'candidate replacement')).status, 'completed');
        assert.equal(await readFile(join(workspace.root, 'README.md'), 'utf8'), 'candidate replacement');
        assert.equal(await readFile(join(workspace.root, 'packages/agent-core/src/p4-canary.txt'), 'utf8'), 'created');
        assert.equal(await readFile(join(project, 'README.md'), 'utf8'), original);
        await assert.rejects(readFile(join(project, 'packages/agent-core/src/p4-canary.txt')));

        for (const path of ['.git/config', '.dope/smap.json', '.env', 'secrets/token', 'token.key',
            '../outside', '/tmp/outside', 'packages/agent-core/../README.md'])
            assert.equal((await run('create', path, 'bad')).status, 'denied', path);
        const outside = join(parent, 'outside');
        await writeFile(outside, 'outside original');
        const link = join(workspace.root, 'packages/agent-core/src/escape');
        await symlink(outside, link);
        assert.equal((await run('modify', 'packages/agent-core/src/escape', 'bad')).status, 'denied');
        assert.equal((await run('create', 'packages/agent-core/src/escape', 'bad')).status, 'denied');
        assert.equal(await readFile(outside, 'utf8'), 'outside original');
        await rm(link);
        const parentLink = join(workspace.root, 'linked-parent');
        await symlink(join(parent, 'project'), parentLink);
        assert.equal((await run('create', 'linked-parent/outside.txt', 'bad')).status, 'denied');
        await rm(parentLink);
        assert.equal((await brokerLocalEdit({ ...request, projectRoot: parent }, workspace,
            edit('modify', 'README.md', 'bad'))).status, 'denied');
        assert.equal((await brokerLocalEdit({ ...request, executionRoot: project }, workspace,
            edit('modify', 'README.md', 'bad'))).status, 'denied');
        assert.equal((await brokerLocalEdit({ ...request, taskId: 'wrong' }, workspace,
            edit('modify', 'README.md', 'bad'))).status, 'denied');
        assert.equal((await brokerLocalEdit({ ...request, grant: { ...grant,
            permissions: { ...grant.permissions, 'workspace-write': false } } }, workspace,
        edit('modify', 'README.md', 'bad'))).status, 'denied');
        assert.equal((await run('modify', 'README.md', 'x'.repeat(LOCAL_TOOL_LIMITS.editBytes + 1))).status, 'denied');
        const abort = new AbortController(); abort.abort();
        assert.equal((await brokerLocalEdit(request, workspace,
            edit('modify', 'README.md', 'bad'), abort.signal)).status, 'cancelled');
        await writeFile(join(project, 'README.md'), 'changed external basis');
        assert.equal((await run('modify', 'README.md', 'bad')).status, 'denied');
        await writeFile(join(project, 'README.md'), original);
        assert.deepEqual((await workspace.delta()).effects.map(effect => [effect.kind, effect.path]), [
            ['create', 'packages/agent-core/src/p4-canary.txt'], ['modify', 'README.md']
        ]);
        assert.equal(await readFile(join(workspace.root, 'README.md'), 'utf8'), 'candidate replacement');
        assert.equal(await readFile(join(project, 'README.md'), 'utf8'), original);
        assert.equal((await execute('git', ['rev-parse', 'HEAD'], { cwd: project })).stdout.trim(), head);
        assert.equal((await execute('git', ['rev-parse', 'HEAD'], { cwd: workspace.root })).stdout.trim(), head);
        assert.equal((await execute('git', ['rev-parse', 'HEAD'])).stdout.trim(), head);
    } finally {
        await workspace?.dispose();
        await rm(parent, { recursive: true, force: true });
    }
});
