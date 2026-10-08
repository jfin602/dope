import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { chmod, mkdir, mkdtemp, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/index.js';
import { CodexAgentExecutionAdapter, mutationConfig, prepareSandboxNpm, resolveSandboxNode } from '../../packages/theia-extension/lib/node/codex-agent-execution.js';
import { providerFailure } from '../../packages/theia-extension/lib/node/codex-rpc-process.js';

test('sandbox probe resolves standalone Node 24 independently of Electron process.execPath', async () => {
    assert.equal(await resolveSandboxNode(dirname(process.execPath)), await realpath(process.execPath));
    await assert.rejects(resolveSandboxNode('/nonexistent-node-directory'), /Node 24 npm installation unavailable/);
});

test('sandbox Node resolver skips Yarn-style Node shim without sibling npm', async () => {
    const shim = await mkdtemp(join(tmpdir(), 'dope-node-shim-'));
    try {
        await writeFile(join(shim, 'node'), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`, { mode: 0o755 });
        assert.equal(await resolveSandboxNode(`${shim}:${dirname(process.execPath)}`),
            await realpath(process.execPath));
    } finally { await rm(shim, { recursive: true, force: true }); }
});

test('isolated npm toolchain runs project commands without host npm read access', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-npm-toolchain-'));
    try {
        const node = await resolveSandboxNode(dirname(process.execPath));
        await prepareSandboxNpm(root, node);
        const bin = join(root, 'node_modules', '.dope-bin');
        const { stdout } = await promisify(execFile)(join(bin, 'npm'), ['--version'], {
            cwd: root, env: { PATH: `${bin}:/usr/local/bin:/usr/bin:/bin` }
        });
        assert.match(stdout.trim(), /^\d+\.\d+\.\d+$/u);
        assert.ok(mutationConfig(root).includes(`PATH = "${bin}:/usr/local/bin:/usr/bin:/bin"`));
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('Codex capacity failure is narrowly sanitized for retry', () => {
    assert.equal(providerFailure({ code: 'model_at_capacity' }).message, 'Codex model at capacity');
    assert.equal(providerFailure({ message: 'Service is at capacity; try again later' }).message,
        'Codex model at capacity');
    assert.notEqual(providerFailure({ code: 'rate_limit_exceeded' }).message, 'Codex model at capacity');
});

type Message = { id?: number; method?: string; params?: any };
class FakeChild extends EventEmitter {
    readonly stdin = new PassThrough();
    readonly stdout = new PassThrough();
    readonly stderr = new PassThrough();
    readonly messages: Message[] = [];
    exitCode: number | null = null;
    kills: string[] = [];
    private readonly scenario: string;
    constructor(scenario: string) {
        super();
        this.scenario = scenario;
        this.stdin.on('data', chunk => {
            for (const line of String(chunk).trim().split('\n')) if (line) this.receive(JSON.parse(line));
        });
    }
    send(value: unknown) { this.stdout.write(`${JSON.stringify(value)}\n`); }
    die() { if (this.exitCode !== null) return; this.exitCode = 1; this.emit('exit', 1, null); }
    kill(signal: NodeJS.Signals) { this.kills.push(signal); this.die(); return true; }
    private receive(message: Message) {
        this.messages.push(message);
        if (message.method === 'initialize') {
            if (this.scenario === 'malformed') { this.stdout.write('{broken\n'); return; }
            if (message.params?.capabilities?.experimentalApi !== true) {
                this.send({ id: message.id, error: { code: -32600,
                    message: 'thread/start.runtimeWorkspaceRoots requires experimentalApi capability' } });
                return;
            }
            this.send({ id: message.id, result: { userAgent: 'fake' } });
        }
        if (message.method === 'thread/start') this.send({ id: message.id, result: {
            thread: { id: 'thread-1' }, model: this.scenario === 'fallback' ? 'unexpected-model' : message.params.model,
            modelProvider: 'openai_chatgpt_plan', cwd: message.params.cwd,
            runtimeWorkspaceRoots: message.params.runtimeWorkspaceRoots, approvalPolicy: 'never',
            activePermissionProfile: { id: 'dope_run', extends: ':workspace' }
        } });
        if (message.method === 'turn/start') {
            if (this.scenario === 'death') { this.die(); return; }
            this.send({ id: message.id, result: { turn: { id: 'turn-1' } } });
            if (this.scenario === 'cancel') return;
            const common = { threadId: 'thread-1', turnId: 'turn-1' };
            if (this.scenario === 'mcp') {
                this.send({ method: 'item/started', params: { ...common, item: { type: 'mcpToolCall' } } });
                return;
            }
            if (this.scenario === 'reroute') {
                this.send({ method: 'model/rerouted', params: { ...common, model: 'other-model' } });
                return;
            }
            if (this.scenario === 'config-warning') {
                this.send({ method: 'configWarning', params: { message: 'secret setting skipped' } });
                return;
            }
            if (this.scenario === 'flood') {
                for (let index = 0; index < 1001; index++) this.send({ method: 'item/completed', params: {
                    ...common, item: { type: 'agentMessage', text: 'Bearer secret123', id: `item-${index}` }
                } });
                return;
            }
            if (this.scenario === 'outside-file') {
                this.send({ method: 'item/completed', params: { ...common,
                    item: { type: 'fileChange', status: 'completed', changes: [{ path: '../outside', diff: 'secret' }] } } });
                return;
            }
            if (this.scenario === 'incremental') {
                const notify = (method: string, item: object) =>
                    this.send({ method, params: { ...common, item } });
                notify('item/started', { type: 'reasoning', id: 'hidden-1', text: 'private reasoning' });
                notify('item/completed', { type: 'reasoning', id: 'hidden-1', text: 'private reasoning' });
                notify('item/started', { type: 'agentMessage', id: 'visible-1', text: '' });
                notify('item/updated', { type: 'agentMessage', id: 'visible-1', text: 'Here is ' });
                notify('item/updated', { type: 'agentMessage', id: 'visible-1', text: 'Here is the change.' });
                notify('item/completed', { type: 'agentMessage', id: 'visible-1', text: 'Here is the change.' });
                notify('item/completed', { type: 'agentMessage', id: 'visible-2', text: 'Ready Bearer secret123' });
                notify('item/completed', { type: 'agentMessage', id: 'visible-3', text: '<think>hidden</think>' });
                notify('item/completed', { type: 'agentMessage', id: 'visible-4', text: 'x'.repeat(200_000) });
                notify('item/started', { type: 'commandExecution', id: 'cmd-1', cwd: message.params.cwd,
                    command: 'echo ready', status: 'inProgress' });
                notify('item/updated', { type: 'commandExecution', id: 'cmd-1', cwd: message.params.cwd,
                    status: 'inProgress', stdout: 'ready\n' });
                notify('item/completed', { type: 'commandExecution', id: 'cmd-1', cwd: message.params.cwd,
                    status: 'completed', exitCode: 0, stderr: 'Bearer secret123' });
                notify('item/started', { type: 'commandExecution', id: 'cmd-2', cwd: join(message.params.cwd, 'src'),
                    command: 'cat /home/jfin/.ssh/id_rsa', status: 'inProgress' });
                notify('item/completed', { type: 'commandExecution', id: 'cmd-2', cwd: join(message.params.cwd, 'src'),
                    status: 'completed', exitCode: 1, stdout: 'z'.repeat(5_000),
                    stderr: 'A=one\nB=two\nC=three' });
                this.send({ method: 'turn/completed', params: { ...common, turn: { id: 'turn-1', status: 'completed' } } });
                return;
            }
            this.send({ method: 'item/started', params: { ...common,
                item: { type: 'commandExecution', cwd: message.params.cwd, id: 'item-1', status: 'inProgress',
                    command: 'echo secret', aggregatedOutput: 'secret' } } });
            this.send({ method: 'item/completed', params: { ...common,
                item: { type: 'commandExecution', cwd: message.params.cwd, id: 'item-1', status: 'completed', exitCode: 0 } } });
            this.send({ method: 'item/completed', params: { ...common,
                item: { type: 'fileChange', status: 'completed', changes: [{ path: 'src/a.ts', diff: 'secret diff' }] } } });
            this.send({ method: 'item/completed', params: { ...common,
                item: { type: 'agentMessage', text: 'Done Bearer secret123' } } });
            this.send({ method: 'turn/completed', params: { threadId: 'thread-1',
                turn: { id: 'turn-1', status: 'completed' } } });
        }
        if (message.method === 'turn/interrupt') this.send({ id: message.id, result: {} });
    }
}

async function fixture(scenario = 'complete') {
    const root = await mkdtemp(join(tmpdir(), 'dope-execution-project-'));
    await mkdir(join(root, '.git'));
    const executionRoot = await mkdtemp(join(tmpdir(), 'dope-execution-work-'));
    await mkdir(join(executionRoot, '.git'));
    const runtimeDirectory = await mkdtemp(join(tmpdir(), 'dope-execution-runtime-'));
    const spawns: { command: string; args: string[]; options: any; child: FakeChild }[] = [];
    const auth = { async accessToken(connection: string, account: string) {
        assert.equal(connection, 'codex'); assert.equal(account, 'account-1'); return 'oauth-secret';
    } };
    const adapter = new CodexAgentExecutionAdapter(auth as any, {
        runtimeDirectory, timeoutMs: 40, turnTimeoutMs: 120,
        verifySandbox: async () => {},
        prepareToolchain: async () => {},
        version: async () => 'codex-cli 0.155.1',
        spawnChild: ((command: string, args: string[], options: any) => {
            const child = new FakeChild(scenario);
            spawns.push({ command, args, options, child });
            return child as unknown as ChildProcessWithoutNullStreams;
        }) as any
    });
    const events: any[] = [];
    const request = { projectRoot: root, executionRoot, grant: createDefaultExecutionGrant({ id: 'grant-1', revision: 0,
        taskId: 'task-1', acceptedAt: '2026-10-05T00:00:00Z' }), taskId: 'task-1',
        connectionId: 'codex', registrationId: 'account-1', modelId: 'exact-model',
        prompt: 'Implement one task', onEvent: (event: any) => events.push(event) };
    return { root, executionRoot, runtimeDirectory, spawns, adapter, request, events,
        async cleanup() { adapter.dispose(); await rm(root, { recursive: true, force: true });
            await rm(executionRoot, { recursive: true, force: true });
            await rm(runtimeDirectory, { recursive: true, force: true }); } };
}

test('named sandbox profile denies outside reads, temp, network, secrets and Git writes', () => {
    const config = mutationConfig();
    for (const line of ['default_permissions = "dope_run"', 'extends = ":workspace"',
        '":root" = "deny"', '":minimal" = "read"', '":tmpdir" = "deny"',
        '":slash_tmp" = "deny"', '".git" = "read"', '".codex" = "read"',
        '"**/.env" = "deny"', 'writable_roots = []', 'network_access = false',
        'exclude_tmpdir_env_var = true', 'exclude_slash_tmp = true', 'inherit = "none"',
        'PATH = "/usr/local/bin:/usr/bin:/bin"',
        'enabled = false', 'web_search = "disabled"', 'apps = false', 'browser_use = false'])
        assert.ok(config.includes(line), line);
    assert.ok(!config.includes('OPENAI_API_KEY'));
    assert.ok(mutationConfig('/approved/root').includes('[projects."/approved/root"]\ntrust_level = "untrusted"'));
});

test('dedicated run uses approved root and exact model, normalizes bounded events and cleans up', async () => {
    const f = await fixture();
    try {
        const handle = await f.adapter.start(f.request);
        await handle.result;
        assert.deepEqual(handle.recovery, { adapterId: 'codex-app-server-execution', handle: 'thread-1' });
        const spawned = f.spawns[0];
        assert.equal(spawned.child.messages.find(message => message.method === 'initialize')?.params?.capabilities?.experimentalApi, true);
        assert.equal(spawned.options.cwd, f.executionRoot);
        assert.deepEqual(spawned.args, ['app-server', '--strict-config', '--listen', 'stdio://']);
        assert.equal(spawned.options.env.ACCESS_TOKEN, 'oauth-secret');
        assert.equal(spawned.options.env.OPENAI_API_KEY, undefined);
        assert.equal(spawned.options.env.HOME, spawned.options.env.CODEX_HOME);
        assert.notEqual(spawned.options.env.HOME, f.root);
        await assert.rejects(stat(spawned.options.env.HOME), { code: 'ENOENT' });
        const thread = spawned.child.messages.find(message => message.method === 'thread/start')!.params;
        const turn = spawned.child.messages.find(message => message.method === 'turn/start')!.params;
        assert.equal(thread.model, 'exact-model'); assert.equal(thread.allowProviderModelFallback, false);
        assert.equal(thread.modelProvider, 'openai_chatgpt_plan');
        assert.equal(thread.permissions, 'dope_run'); assert.equal(turn.permissions, 'dope_run');
        assert.deepEqual(thread.runtimeWorkspaceRoots, [f.executionRoot]);
        assert.notEqual(thread.cwd, f.root);
        assert.deepEqual(turn.input, [{ type: 'text', text: 'Implement one task' }]);
        assert.deepEqual(f.events.map(e => e.kind), ['command-started', 'command-completed',
            'file-changed', 'agent-message', 'warning', 'status', 'status']);
        assert.equal(f.events[2].path, 'src/a.ts');
        assert.equal(f.events[3].text, 'Done [redacted]');
        assert.equal(f.events[1].stdoutPresent, false);
        assert.equal(f.events[1].stderrPresent, false);
        assert.ok(!JSON.stringify(f.events).includes('secret123'));
        assert.ok(!JSON.stringify(f.events).includes('secret diff'));
        assert.deepEqual(spawned.child.kills, ['SIGTERM']);
    } finally { await f.cleanup(); }
});

test('visible item snapshots retain incremental prose once and correlate bounded command observations', async () => {
    const f = await fixture('incremental');
    try {
        await (await f.adapter.start(f.request)).result;
        const messages = f.events.filter(event => event.kind === 'agent-message');
        assert.deepEqual(messages.map(event => event.text), ['Here is ', 'the change.', 'Ready [redacted]']);
        const started = f.events.find(event => event.kind === 'command-started');
        const completed = f.events.find(event => event.kind === 'command-completed');
        assert.equal(started.commandId, 'cmd-1');
        assert.equal(started.command, 'echo ready');
        assert.equal(started.cwd, '.');
        assert.equal(started.status, 'running');
        assert.equal(completed.commandId, started.commandId);
        assert.equal(completed.status, 'completed');
        assert.equal(completed.exitCode, 0);
        assert.equal(completed.stdout, 'ready\n');
        assert.equal(completed.stdoutPresent, true);
        assert.equal(completed.stderr, '[redacted]');
        assert.equal(completed.stderrPresent, true);
        const second = f.events.filter(event => event.kind === 'command-completed')[1];
        assert.equal(second.commandId, 'cmd-2');
        assert.equal(second.cwd, 'src');
        assert.equal(second.status, 'failed');
        assert.equal(second.exitCode, 1);
        assert.equal(second.command, 'cat [redacted]');
        assert.equal(second.commandRedacted, true);
        assert.equal(second.stdout.length, 4_000);
        assert.equal(second.stdoutTruncated, true);
        assert.equal(second.stderrPresent, false);
        assert.equal(second.stderrDropped, true);
        assert.ok(f.events.some(event => event.summary === 'Unsafe or oversized agent message dropped'));
        assert.ok(!JSON.stringify(f.events).includes('private reasoning'));
        assert.ok(!JSON.stringify(f.events).includes('secret123'));
        assert.ok(!JSON.stringify(f.events).includes('x'.repeat(100)));
    } finally { await f.cleanup(); }
});

test('malformed RPC and process death fail and clean up; unverified versions cannot spawn', async () => {
    for (const scenario of ['malformed', 'death']) {
        const f = await fixture(scenario);
        try {
            if (scenario === 'malformed') await assert.rejects(f.adapter.start(f.request),
                { failureClass: 'connection-unavailable' });
            else await assert.rejects((await f.adapter.start(f.request)).result,
                { failureClass: 'connection-unavailable' });
            assert.equal(f.spawns.length, 1);
            assert.deepEqual(f.spawns[0].child.kills, scenario === 'malformed' ? ['SIGTERM'] : []);
        } finally { await f.cleanup(); }
    }
    const f = await fixture();
    try {
        const invalid = new CodexAgentExecutionAdapter({ accessToken: async () => 'token' } as any,
            { version: async () => 'codex-cli 0.155.2',
                spawnChild: (() => assert.fail('must not spawn')) as any });
        await assert.rejects(invalid.start(f.request), { failureClass: 'unsupported-capability' });
        invalid.dispose();
    } finally { await f.cleanup(); }
});

test('verified turn/interrupt is scoped to thread and turn, followed by process stop', async () => {
    const f = await fixture('cancel');
    try {
        const handle = await f.adapter.start(f.request);
        await handle.cancel();
        await assert.rejects(handle.result);
        const interrupt = f.spawns[0].child.messages.find(message => message.method === 'turn/interrupt');
        assert.deepEqual(interrupt?.params, { threadId: 'thread-1', turnId: 'turn-1' });
        assert.deepEqual(f.spawns[0].child.kills, ['SIGTERM']);
    } finally { await f.cleanup(); }
});

test('unexpected remote tool, configuration warning and outside file observation deny authority', async () => {
    for (const scenario of ['mcp', 'outside-file', 'config-warning']) {
        const f = await fixture(scenario);
        try {
            const handle = await f.adapter.start(f.request);
            await assert.rejects(handle.result, { failureClass: 'unsupported-capability' }, scenario);
            assert.ok(f.events.some(event => event.kind === 'authority-denied'));
            assert.deepEqual(f.spawns[0].child.kills, ['SIGTERM']);
        } finally { await f.cleanup(); }
    }
});

test('grant mismatch and noncanonical root fail before auth or process', async () => {
    const f = await fixture();
    try {
        await assert.rejects(f.adapter.start({ ...f.request, taskId: 'other' }),
            { failureClass: 'unsupported-capability' });
        await assert.rejects(f.adapter.start({ ...f.request, projectRoot: `${f.root}/../${f.root.split('/').at(-1)!}` }),
            { failureClass: 'unsupported-capability' });
        assert.equal(f.spawns.length, 0);
    } finally { await f.cleanup(); }
});

test('runtime home must be private and outside the approved project', async () => {
    const fixtureRun = await fixture();
    try {
        await chmod(fixtureRun.runtimeDirectory, 0o777);
        await assert.rejects(fixtureRun.adapter.start(fixtureRun.request),
            { failureClass: 'unsupported-capability' });
        assert.equal(fixtureRun.spawns.length, 0);
    } finally { await fixtureRun.cleanup(); }
});

test('failed installed-sandbox probe rejects before auth and process creation', async () => {
    const f = await fixture();
    let authCalled = false;
    const adapter = new CodexAgentExecutionAdapter({ accessToken: async () => {
        authCalled = true; return 'unexpected';
    } } as any, { runtimeDirectory: f.runtimeDirectory, version: async () => 'codex-cli 0.155.1',
        verifySandbox: async () => { throw Error('unsupported sandbox'); },
        spawnChild: (() => assert.fail('must not spawn')) as any });
    try {
        await assert.rejects(adapter.start(f.request), { message: 'unsupported sandbox' });
        assert.equal(authCalled, false);
    } finally { adapter.dispose(); await f.cleanup(); }
});

test('provider model fallback or reroute fails closed without accepting mutated output', async () => {
    for (const scenario of ['fallback', 'reroute']) {
        const fixtureRun = await fixture(scenario);
        try {
            if (scenario === 'fallback') await assert.rejects(fixtureRun.adapter.start(fixtureRun.request),
                { failureClass: 'unsupported-capability' });
            else await assert.rejects((await fixtureRun.adapter.start(fixtureRun.request)).result,
                { failureClass: 'unsupported-capability' });
            assert.deepEqual(fixtureRun.spawns[0].child.kills, ['SIGTERM']);
        } finally { await fixtureRun.cleanup(); }
    }
});

test('disposal stops a pending run and rejects its result', async () => {
    const fixtureRun = await fixture('cancel');
    try {
        const handle = await fixtureRun.adapter.start(fixtureRun.request);
        fixtureRun.adapter.dispose();
        await assert.rejects(handle.result, { failureClass: 'connection-unavailable' });
        assert.deepEqual(fixtureRun.spawns[0].child.kills, ['SIGTERM']);
    } finally { await fixtureRun.cleanup(); }
});

test('provider event flood stops the process without persisting raw message bodies', async () => {
    const fixtureRun = await fixture('flood');
    try {
        const handle = await fixtureRun.adapter.start(fixtureRun.request);
        await assert.rejects(handle.result, { failureClass: 'unsupported-capability' });
        assert.equal(fixtureRun.events.length, 1001);
        assert.equal(fixtureRun.events.at(-1).kind, 'warning');
        assert.ok(!JSON.stringify(fixtureRun.events).includes('secret123'));
        assert.deepEqual(fixtureRun.spawns[0].child.kills, ['SIGTERM']);
    } finally { await fixtureRun.cleanup(); }
});
