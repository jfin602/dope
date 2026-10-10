import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { brokerLocalProcess, type LocalProcessCommand } from
    '../../packages/agent-core/lib/node/local-tool-broker.js';

const execute = promisify(execFile);
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

test('local process broker contains allowed Node test and denies unapproved effects', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-broker-process-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    try {
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), project]);
        workspace = await ExecutionWorkspace.create(project);
        const root = workspace.root;
        const privateFile = join(parent, 'private');
        const outside = join(parent, 'outside');
        await writeFile(privateFile, 'host-private');
        await writeFile(outside, 'original');
        await writeFile(join(root, '.env'), 'candidate-private');
        await mkdir(join(root, 'secrets'));
        await writeFile(join(root, 'secrets', 'token'), 'candidate-secret');
        await symlink(privateFile, join(root, 'escape'));
        const probe = `import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const denied = fn => { try { fn(); return false; } catch { return true; } };
test('OS containment', () => {
 try {
 assert.equal(process.cwd(), '/work');
 assert.equal(process.env.HOME, '/home/local');
 assert.equal(process.env.DOPE_PRIVATE_TOKEN, undefined);
 assert.equal(denied(() => fs.readFileSync(${JSON.stringify(privateFile)})), true);
 assert.equal(denied(() => fs.readFileSync('/work/escape')), true);
 assert.equal(denied(() => fs.readFileSync('/work/secrets/token')), true);
 assert.equal(denied(() => fs.readFileSync('/work/.env')), true);
 assert.equal(denied(() => fs.writeFileSync(${JSON.stringify(outside)}, 'bad')), true);
 assert.equal(denied(() => fs.writeFileSync('/work/.git/config', 'bad')), true);
 const git = spawnSync('/usr/bin/git', ['-C', '/work', 'config', '--local', 'probe.key', 'bad']);
 assert.notEqual(git.status, 0);
 const network = spawnSync('/usr/bin/python3', ['-c',
  "import socket; s=socket.socket(); s.connect(('127.0.0.1',9))"]);
 assert.notEqual(network.status, 0);
 const internet = spawnSync('/usr/bin/python3', ['-c',
  "import socket; s=socket.socket(); s.connect(('1.1.1.1',443))"]);
 assert.notEqual(internet.status, 0);
 fs.writeFileSync('/work/allowed-output', 'candidate only');
 } catch (error) { fs.writeFileSync('/work/probe-error', String(error.stack)); throw error; }
});`;
        await writeFile(join(root, 'containment.test.mjs'), probe);
        await writeFile(join(root, 'build.mjs'),
            "import fs from 'node:fs'; fs.writeFileSync('/work/built', 'candidate build'); console.log('build ok');");
        await writeFile(join(root, 'linger.test.mjs'), `import fs from 'node:fs';
import { spawn } from 'node:child_process';
spawn(process.execPath, ['-e', "setTimeout(() => require('fs').writeFileSync('/work/orphan', 'bad'), 2000); setInterval(() => {}, 1000)"], { stdio: 'ignore' });
fs.writeFileSync('/work/spawned', 'yes');
setInterval(() => {}, 1000);`);
        const grant = createDefaultExecutionGrant({ id: 'grant-1', revision: 0, taskId: 'task-1',
            acceptedAt: new Date().toISOString() });
        const request = { projectRoot: project, executionRoot: root, grant, taskId: 'task-1',
            connectionId: 'local', registrationId: 'local', modelId: 'model', prompt: '', onEvent() {} };
        const command = (id: string, file: string, timeoutMs = 5000): LocalProcessCommand =>
            ({ id, kind: 'test', executable: 'node', argv: ['--test', file], timeoutMs });
        const call = (id: string, kind: 'test' | 'build' = 'test') =>
            ({ id: 'call-1', name: 'process' as const, arguments: { kind, commandId: id } });
        const run = (id: string, commands: readonly LocalProcessCommand[], signal?: AbortSignal) =>
            brokerLocalProcess(request, workspace!, call(id), commands, signal);

        process.env.DOPE_PRIVATE_TOKEN = 'must-not-enter';
        try {
            const allowed = await run('contained', [command('contained', 'containment.test.mjs')]);
            assert.equal(allowed.status, 'completed', JSON.stringify(allowed) + '\n' +
                await readFile(join(root, 'probe-error'), 'utf8').catch(() => ''));
            assert.match(allowed.output, /pass 1/u);
            assert.equal(await readFile(join(root, 'allowed-output'), 'utf8'), 'candidate only');
            assert.equal(await readFile(outside, 'utf8'), 'original');
            assert.equal(await readFile(join(project, 'README.md'), 'utf8'),
                await readFile(join(root, 'README.md'), 'utf8'));
        } finally { delete process.env.DOPE_PRIVATE_TOKEN; }
        const built = await brokerLocalProcess(request, workspace, call('build', 'build'),
            [{ id: 'build', kind: 'build', executable: 'node', argv: ['build.mjs'] }]);
        assert.equal(built.status, 'completed', built.output);
        assert.match(built.output, /build ok/u);
        assert.equal(await readFile(join(root, 'built'), 'utf8'), 'candidate build');

        for (const invalid of [
            { ...command('bad', 'containment.test.mjs'), argv: ['--test', 'containment.test.mjs;touch bad'] },
            { ...command('bad', 'containment.test.mjs'), executable: 'sh' },
            { ...command('bad', 'containment.test.mjs'), argv: ['-e', 'process.exit(0)'] },
            { ...command('bad', 'containment.test.mjs'), argv: ['--test', '../escape.test.mjs'] },
            { ...command('bad', 'containment.test.mjs'), cwd: '/tmp' }
        ]) assert.equal((await run('bad', [invalid as LocalProcessCommand])).status, 'denied');
        assert.equal((await run('unknown', [])).status, 'denied');
        assert.equal((await brokerLocalProcess(request, workspace, call('contained', 'build'),
            [command('contained', 'containment.test.mjs')])).status, 'denied');
        assert.equal((await brokerLocalProcess({ ...request, taskId: 'wrong' }, workspace,
            call('contained'), [command('contained', 'containment.test.mjs')])).status, 'denied');
        assert.equal((await brokerLocalProcess({ ...request, executionRoot: project }, workspace,
            call('contained'), [command('contained', 'containment.test.mjs')])).status, 'denied');
        assert.equal((await brokerLocalProcess({ ...request, grant: { ...grant,
            permissions: { ...grant.permissions, 'workspace-test': false } } }, workspace,
        call('contained'), [command('contained', 'containment.test.mjs')])).status, 'denied');

        const waitForSpawn = async () => {
            for (let i = 0; i < 60; i++) {
                if (await readFile(join(root, 'spawned'), 'utf8').catch(() => '') === 'yes') return;
                await pause(50);
            }
            assert.fail('sandbox child did not start');
        };
        const abort = new AbortController();
        const cancelled = run('cancel', [command('cancel', 'linger.test.mjs', 5000)], abort.signal);
        await waitForSpawn();
        abort.abort();
        assert.equal((await cancelled).status, 'cancelled');
        await rm(join(root, 'spawned'));
        const timed = await run('timeout', [command('timeout', 'linger.test.mjs', 1000)]);
        assert.equal(timed.status, 'failed');
        assert.equal(timed.truncated, true);
        await pause(2300);
        await assert.rejects(readFile(join(root, 'orphan')));
        assert.equal(await readFile(outside, 'utf8'), 'original');
    } finally {
        await workspace?.dispose();
        await rm(parent, { recursive: true, force: true });
    }
});
