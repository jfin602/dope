import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { mkdtemp, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { ModelRuntimeFailure } from '../../packages/contracts/lib/model-runtime.js';
import { CodexAppServer } from '../../packages/theia-extension/lib/node/codex-app-server.js';
import { AIRegistryStore } from '../../packages/theia-extension/lib/node/ai-registry-store.js';
import { AIInventoryController } from '../../packages/theia-extension/lib/node/ai-registry-backend.js';
import { ModelConnectionsRegistry } from '../../packages/theia-extension/lib/node/model-connections.js';
import { AICredentialManager } from '../../packages/theia-extension/lib/node/ai-credential-manager.js';

type Message = { id?: number; method?: string; params?: any };
class FakeChild extends EventEmitter {
    readonly stdin = new PassThrough();
    readonly stdout = new PassThrough();
    readonly stderr = new PassThrough();
    readonly messages: Message[] = [];
    exitCode: number | null = null;
    kills: string[] = [];
    private readonly scenario: string;
    private readonly catalog: () => any;
    constructor(scenario: string, catalog: () => any) {
        super();
        this.scenario = scenario;
        this.catalog = catalog;
        this.stdin.on('data', chunk => {
            for (const line of String(chunk).trim().split('\n')) if (line) this.receive(JSON.parse(line));
        });
    }
    send(message: unknown) { this.stdout.write(`${JSON.stringify(message)}\n`); }
    die() { this.exitCode = 1; this.emit('exit', 1, null); }
    kill(signal: NodeJS.Signals) { this.kills.push(signal); this.die(); return true; }
    private receive(message: Message) {
        this.messages.push(message);
        if (message.method === 'initialize') {
            if (this.scenario === 'startup-timeout') return;
            this.send('{not-json');
            this.send({ id: 999, result: { bogus: true } });
            this.send({ id: message.id, result: { userAgent: 'fake' } });
        }
        if (message.method === 'thread/start' || message.method === 'thread/resume') {
            this.send({ id: message.id, result: { thread: { id: 'thread-1' } } });
        }
        if (message.method === 'model/list') this.send({ id: message.id, result: this.catalog() });
        if (message.method === 'turn/start') {
            if (this.scenario === 'death') { this.die(); return; }
            if (this.scenario === 'timeout') return;
            this.send({ id: message.id, result: { turn: { id: 'turn-1', status: 'inProgress' } } });
            this.send({ method: 'item/agentMessage/delta', params: { threadId: 'thread-1', delta: 'OK' } });
            const completed = { method: 'turn/completed', params: { threadId: 'thread-1',
                turn: { id: 'turn-1', status: this.scenario === 'failed' || this.scenario === 'interrupted' ?
                    this.scenario : this.scenario === 'usage' ? 'failed' : 'completed',
                ...(this.scenario === 'usage' ? { error: { code: 'subscription_sharing_usage_limit_exceeded' } } : {}) } } };
            if (this.scenario === 'slow-turn') setTimeout(() => this.send(completed), 70);
            else this.send(completed);
        }
    }
}

function fixture(scenario = 'completed') {
    const children: FakeChild[] = [];
    const spawns: { command: string; args: string[]; options: any }[] = [];
    let token = 'oauth-first';
    let catalog = { data: [
        { model: 'entitled-model', displayName: 'Entitled', hidden: false },
        { model: 'hidden', displayName: 'Hidden', hidden: true }
    ], nextCursor: null };
    const auth = { async accessToken(connectionId: string, registrationId: string) {
        assert.equal(connectionId, 'codex'); assert.equal(registrationId, 'account-1'); return token;
    } };
    const adapter = new CodexAppServer(auth as any, {
        version: async () => 'codex-cli 0.100.0', timeoutMs: 35, turnTimeoutMs: 110, idleMs: 100,
        spawnChild: ((command: string, args: string[], options: any) => {
            spawns.push({ command, args, options });
            const child = new FakeChild(scenario, () => catalog);
            children.push(child);
            return child as unknown as ChildProcessWithoutNullStreams;
        }) as any
    });
    return { adapter, children, spawns, setToken(value: string) { token = value; }, setCatalog(value: typeof catalog) { catalog = value; } };
}

test('initialize precedes initialized; malformed and late responses are ignored; synthetic turn has no project input', async () => {
    const { adapter, children, spawns } = fixture();
    try {
        assert.deepEqual(await adapter.models('codex', 'account-1'), [{ id: 'entitled-model', label: 'Entitled' }]);
        assert.deepEqual(await adapter.test('codex', 'account-1', 'entitled-model'), { threadId: 'thread-1', text: 'OK' });
        const methods = children[0].messages.map(message => message.method);
        assert.deepEqual(methods, ['initialize', 'initialized', 'model/list', 'thread/start', 'turn/start']);
        assert.equal(children[0].messages[0].params.clientInfo.name, 'Dope');
        const start = children[0].messages[3].params;
        const turn = children[0].messages[4].params;
        assert.equal(start.sandbox, 'read-only');
        assert.equal(start.approvalPolicy, 'never');
        assert.deepEqual(turn.sandboxPolicy, { type: 'readOnly', networkAccess: false });
        assert.deepEqual(turn.input, [{ type: 'text', text: 'Reply with OK. Do not use tools.' }]);
        assert.ok(start.cwd.startsWith(tmpdir()));
        await assert.rejects(stat(start.cwd), { code: 'ENOENT' });
        assert.equal(spawns[0].options.env.ACCESS_TOKEN, 'oauth-first');
        assert.equal(spawns[0].options.env.OPENAI_API_KEY, undefined);
        assert.deepEqual(Object.keys(spawns[0].options.env).filter(key => spawns[0].options.env[key] !== undefined).sort(),
            ['ACCESS_TOKEN', 'CODEX_HOME', 'HOME', 'PATH', 'LANG', 'LC_ALL', 'TMPDIR']
                .filter(key => spawns[0].options.env[key] !== undefined).sort());
        assert.ok(spawns[0].args.includes('stdio://'));
        assert.ok(spawns[0].args.includes('model_providers.openai_chatgpt_plan.wire_api="responses"'));
        assert.ok(spawns[0].args.includes('features.shell_tool=false'));
        assert.ok(spawns[0].args.includes('agents.enabled=false'));
        assert.ok(spawns[0].args.includes('project_doc_max_bytes=0'));
        assert.ok(spawns[0].args.includes('--strict-config'));
        assert.ok(spawns[0].args.includes('web_search="disabled"'));
        assert.deepEqual(await readdir(spawns[0].options.cwd), []);
    } finally { adapter.dispose(); assert.deepEqual(children[0].kills, ['SIGTERM']); }
});

test('failed, interrupted, death and timeout never pass Test Connection and terminate children', async () => {
    for (const scenario of ['failed', 'interrupted', 'usage', 'death', 'timeout', 'startup-timeout']) {
        const { adapter, children } = fixture(scenario);
        try {
            await assert.rejects(adapter.test('codex', 'account-1', 'entitled-model'), error => {
                assert.ok(error instanceof ModelRuntimeFailure);
                if (scenario === 'usage') assert.equal(error.failureClass, 'transient-upstream');
                return true;
            });
            assert.ok(children[0].exitCode !== null);
        } finally { adapter.dispose(); }
    }
});

test('a completed hosted turn may exceed the short RPC timeout', async () => {
    const { adapter } = fixture('slow-turn');
    try {
        assert.deepEqual(await adapter.test('codex', 'account-1', 'entitled-model'),
            { threadId: 'thread-1', text: 'OK' });
    } finally { adapter.dispose(); }
});

test('token rotation restarts process and resumes an opaque provider thread; idle and disposal stop children', async () => {
    const { adapter, children, spawns, setToken } = fixture();
    try {
        await adapter.test('codex', 'account-1', 'entitled-model');
        setToken('oauth-replacement');
        await adapter.resume('codex', 'account-1', 'thread-1');
        assert.deepEqual(children[0].kills, ['SIGTERM']);
        assert.deepEqual(children[1].messages.map(message => message.method), ['initialize', 'initialized', 'thread/resume']);
        assert.equal(spawns[0].options.env.CODEX_HOME, spawns[1].options.env.CODEX_HOME);
        await delay(135);
        assert.deepEqual(children[1].kills, ['SIGTERM']);
        for (let attempt = 0; attempt < 25; attempt++) {
            try { await stat(spawns[1].options.cwd); await delay(10); }
            catch (error) { assert.equal((error as NodeJS.ErrnoException).code, 'ENOENT'); break; }
            if (attempt === 24) assert.fail('Isolated Codex home was not removed after idle shutdown');
        }
    } finally { adapter.dispose(); }
});

test('executable and model-catalog failures are safe and cannot fall back to API credentials', async () => {
    const { adapter, children, setCatalog } = fixture();
    try {
        setCatalog({ data: [], nextCursor: null });
        assert.deepEqual(await adapter.models('codex', 'account-1'), []);
        assert.equal(children.length, 1);
        const missing = new CodexAppServer({ accessToken: async () => 'token' } as any,
            { version: async () => { throw Error('secret path'); } });
        await assert.rejects(missing.resolveExecutable(), { failureClass: 'connection-unavailable', message: 'Codex executable unavailable' });
        const incompatible = new CodexAppServer({ accessToken: async () => 'token' } as any,
            { version: async () => 'wrong format' });
        await assert.rejects(incompatible.resolveExecutable(), { failureClass: 'unsupported-capability' });
    } finally { adapter.dispose(); }
});

test('auth failure does not spawn a child or use an API key; disposal terminates an active session', async () => {
    const { adapter, children, spawns } = fixture();
    try {
        await adapter.test('codex', 'account-1', 'entitled-model');
        const unauthorized = new CodexAppServer({ accessToken: async () => { throw Error('secret oauth failure'); } } as any,
            { version: async () => 'codex-cli 0.100.0', spawnChild: (() => { throw Error('should not spawn'); }) as any });
        await assert.rejects(unauthorized.test('codex', 'account-1', 'entitled-model'),
            { message: 'ChatGPT account needs authorization', failureClass: 'authentication' });
        unauthorized.dispose();
        assert.equal(spawns.length, 1);
    } finally { adapter.dispose(); }
    assert.deepEqual(children[0].kills, ['SIGTERM']);
});

test('AI inventory uses app-server model catalog and marks agent execution only', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dope-codex-inventory-'));
    const store = new AIRegistryStore(directory);
    const credentials = new AICredentialManager(store, async () => undefined, { OPENAI_API_KEY: 'not-a-fallback' });
    const runtime = new ModelConnectionsRegistry(undefined, store, credentials);
    const { adapter, children } = fixture();
    const controller = new AIInventoryController(store, runtime, credentials, adapter);
    try {
        await store.mutate({ version: 1, expectedRevision: 0, mutation: { type: 'create-connection', connection: {
            version: 1, id: 'codex', alias: 'Codex', lifecycle: 'enabled', config: { type: 'codex', runtime: 'app-server' },
            codexAccount: { status: 'signed-in', accountId: 'account-1', planUsage: 'available' }
        } } });
        const inventory = await controller.refreshModels('codex');
        assert.equal(children.length, 1);
        assert.deepEqual(inventory.registry.models.map(model => model.providerModelKey), ['entitled-model']);
        assert.deepEqual(inventory.registry.models[0].capabilities.agentExecution, { source: 'adapter-known', value: true });
        assert.equal(inventory.registry.models[0].capabilities.conversationalText.source, 'unknown');
        assert.equal(inventory.registry.models[0].limits.contextWindowTokens.source, 'unknown');
        assert.equal(inventory.observations[0].health, 'unknown');
        const result = await controller.testConnection('codex');
        assert.equal(result.modelId, 'entitled-model');
        assert.equal(result.hostedCostPossible, true);
        assert.equal(children.length, 1);
        assert.equal((await controller.inventory()).observations[0].health, 'ready');
        const snapshot = await store.read();
        await store.mutate({ version: 1, expectedRevision: snapshot.revision, mutation: { type: 'update-connection',
            id: 'codex', changes: { alias: 'Codex', lifecycle: 'enabled', config: { type: 'codex', runtime: 'app-server' },
                codexAccount: { status: 'signed-out', accountId: 'account-1', planUsage: 'unavailable' } } } });
        assert.deepEqual(children[0].kills, ['SIGTERM']);
        await assert.rejects(controller.testConnection('codex'), { failureClass: 'authentication' });
    } finally { controller.dispose(); adapter.dispose(); store.dispose(); await rm(directory, { recursive: true, force: true }); }
});
