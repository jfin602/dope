import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { brokerLocalRead } from '../../packages/agent-core/lib/node/local-tool-broker.js';
import { parseLocalToolRequests } from '../../packages/agent-core/lib/node/local-tool-contracts.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';

const execute = promisify(execFile);

test('broker reads only candidate files under the fixed grant and isolated Linux workspace', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-broker-read-'));
    const project = join(parent, 'project');
    const privateFile = join(parent, 'private');
    let workspace: ExecutionWorkspace | undefined;
    try {
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), project]);
        workspace = await ExecutionWorkspace.create(project);
        const work = workspace.root;
        await mkdir(join(work, 'src'), { recursive: true });
        await writeFile(join(work, 'src', 'main.ts'), 'candidate source');
        await writeFile(join(work, '.git', 'config'), 'git private');
        await writeFile(join(work, '.dope', 'state'), 'dope private');
        await writeFile(join(work, '.env'), 'secret environment');
        await writeFile(join(work, 'token.key'), 'secret key');
        await writeFile(privateFile, 'outside private');
        await symlink(privateFile, join(work, 'escape'));
        await symlink('/proc/self/fd/0', join(work, 'proc-fd'));
        await writeFile(join(work, 'large.txt'), 'x'.repeat(400));
        const grant = createDefaultExecutionGrant({ id: 'grant-1', revision: 0, taskId: 'task-1',
            acceptedAt: new Date().toISOString() });
        const request = { projectRoot: project, executionRoot: work, grant, taskId: 'task-1',
            connectionId: 'local', registrationId: 'local', modelId: 'model', prompt: '',
            onEvent() {} };
        const call = (name: 'read' | 'list', path: string, limit = 100) =>
            parseLocalToolRequests(JSON.stringify([{ id: 'call-1', name,
                arguments: name === 'read' ? { path, maxBytes: limit } : { path, maxEntries: limit } }]))[0];
        const run = (name: 'read' | 'list', path: string, limit?: number) =>
            brokerLocalRead(request, call(name, path, limit), undefined, workspace);

        assert.deepEqual(await run('read', 'src/main.ts'), { id: 'call-1', name: 'read',
            status: 'completed', output: 'candidate source', truncated: false });
        const root = await run('list', '.', 1);
        assert.equal(root.status, 'completed');
        assert.equal(root.truncated, true);
        assert.doesNotMatch(root.output, /"name":"(?:\.git|\.dope|\.env|escape|proc-fd|token\.key)"/);
        assert.deepEqual(JSON.parse((await run('list', 'src')).output),
            [{ name: 'main.ts', kind: 'file' }]);
        assert.deepEqual(await run('read', 'large.txt', 16), { id: 'call-1', name: 'read',
            status: 'completed', output: 'x'.repeat(16), truncated: true });

        for (const path of ['escape', 'proc-fd', 'src/../main.ts', '../private',
            '/etc/passwd', '.git/config', '.dope/state', '.env', 'token.key']) {
            const response = await brokerLocalRead(request, { id: 'call-1', name: 'read',
                arguments: { path, maxBytes: 100 } }, undefined, workspace);
            assert.equal(response.status, 'denied', path);
            assert.equal(response.output, '');
        }
        assert.equal((await brokerLocalRead({ ...request, taskId: 'wrong-task' },
            call('read', 'src/main.ts'), undefined, workspace)).status, 'denied');
        assert.equal((await brokerLocalRead({ ...request, grant: { ...grant, permissions:
            { ...grant.permissions, 'workspace-read': false } } }, call('read', 'src/main.ts'), undefined, workspace)).status, 'denied');
        assert.equal((await brokerLocalRead(request, { id: 'edit-1', name: 'edit',
            arguments: { operation: 'modify', path: 'src/main.ts', content: 'bad' } }, undefined, workspace)).status, 'denied');
        assert.equal(await readFile(join(work, 'src', 'main.ts'), 'utf8'), 'candidate source');
        const abort = new AbortController(); abort.abort();
        assert.equal((await brokerLocalRead(request, call('read', 'src/main.ts'), abort.signal, workspace)).status, 'cancelled');
        await rm(work, { recursive: true, force: true });
        assert.equal((await run('read', 'src/main.ts')).status, 'denied');
    } finally { await workspace?.dispose(); await rm(parent, { recursive: true, force: true }); }
});
