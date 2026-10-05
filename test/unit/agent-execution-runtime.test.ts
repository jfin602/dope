import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/index.js';
import { AgentExecutionRuntime } from '../../packages/theia-extension/lib/node/agent-execution-runtime.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';

const now = '2026-10-05T12:00:00Z';
const baseTask = (policy: any = { kind: 'follow-coding-agent' }) => ({ version: 1, id: 'task-1',
    createdAt: now, objective: 'Edit a file', instructions: 'Make the requested edit', projectRoot: '.',
    modelPolicy: policy, controls: {}, authority: { profile: 'phase-8b-project' },
    completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' } });
const grant = () => createDefaultExecutionGrant({ id: 'grant-1', revision: 0, taskId: 'task-1', acceptedAt: now });

class FakeAdapter {
    id = 'fake-codex'; starts: any[] = []; cancels = 0; disposals = 0;
    onEvent?: (event: any) => void;
    private resolve!: () => void;
    private reject!: (error: Error) => void;
    result!: Promise<void>;
    async start(request: any) {
        this.result = new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
        this.starts.push(request); this.onEvent = request.onEvent;
        return { result: this.result, cancel: async () => { this.cancels++; this.reject(new Error('cancelled')); } };
    }
    complete() { this.resolve(); }
    fail() { this.reject(new Error('provider failed')); }
    dispose() { this.disposals++; if (this.reject) this.reject(new Error('disposed')); }
}

async function fixture(work: (f: {
    root: string; store: AgentStore; runtime: AgentExecutionRuntime; backend: AgentRuntimeBackend;
    adapter: FakeAdapter; handle: string; registry: any; routing: any;
}) => Promise<void>, policy?: any) {
    const root = await mkdtemp(join(tmpdir(), 'dope-agent-lifecycle-'));
    const store = new AgentStore();
    const adapter = new FakeAdapter();
    const connection = { id: 'codex', lifecycle: 'enabled', config: { type: 'codex', runtime: 'app-server' },
        codexAccount: { accountId: 'account-1', status: 'signed-in', planUsage: 'available' } };
    const model = { connectionId: 'codex', providerModelKey: 'model-1', enabled: true, state: 'ready',
        locality: 'hosted', capabilities: { agentExecution: { source: 'adapter-known', value: true } } };
    const registry = { connections: [connection], models: [model], observations: [{ connectionId: 'codex', health: 'ready' }] };
    const routing = { calls: [] as any[], async resolve(...args: any[]) {
        this.calls.push(args);
        return { resolution: { policyRevision: 7, candidates: [
            { target: { connectionId: 'codex', modelId: 'model-1' } } ] } };
    } };
    const runtime = new AgentExecutionRuntime(store, routing as any,
        { inventory: async () => ({ registry: { version: 1, revision: 1, connections: registry.connections,
            models: registry.models }, observations: registry.observations }) } as any,
        new Map([['codex', adapter as any]]));
    const backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} }, runtime);
    const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
    try {
        await backend.createTask(handle, baseTask(policy));
        await work({ root, store, runtime, backend, adapter, handle, registry, routing });
    } finally { await runtime.dispose(); backend.dispose(); await rm(root, { recursive: true, force: true }); }
}

async function terminal(store: AgentStore, root: string, runId: string) {
    for (let i = 0; i < 80; i++) {
        const run = await store.readRun(root, runId);
        if (run && ['completed', 'cancelled', 'failed', 'interrupted'].includes(run.status)) return run;
        await new Promise(resolve => setTimeout(resolve, 5));
    }
    throw new Error('Run did not terminate');
}

test('start rejects absent acceptance and mismatched attached root', async () => fixture(async f => {
    await assert.rejects(f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1',
        { ...grant(), acceptedBy: 'model' } as any, true), /accepted/);
    await assert.rejects(f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1',
        { ...grant(), taskId: 'other-task' }, true), /does not match/);
    await assert.rejects(f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1',
        { ...grant(), acceptedAt: '2026-10-05T11:59:59Z' }, true), /does not match/);
    const other = await mkdtemp(join(tmpdir(), 'dope-other-root-'));
    try { await assert.rejects(f.backend.start(f.handle, pathToFileURL(other).href, 'task-1', grant(), true), /root/); }
    finally { await rm(other, { recursive: true, force: true }); }
    assert.equal((await f.store.listRuns(f.root)).length, 0);
}));

test('Follow Coding Agent resolves policy and persists immutable actual provenance before adapter effects', async () => fixture(async f => {
    const run = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true);
    assert.deepEqual(f.routing.calls[0][0], 'coding-agent');
    assert.deepEqual(f.routing.calls[0][1].requiredCapabilities, ['agentExecution']);
    assert.equal(f.routing.calls[0][2], true);
    assert.deepEqual(run.provenance, { version: 1, connectionId: 'codex', modelId: 'model-1',
        providerId: 'codex', runtimeKind: 'hosted', adapterId: 'fake-codex', policyRevision: 7 });
    assert.equal(f.adapter.starts[0].modelId, 'model-1');
    assert.equal(f.adapter.starts[0].registrationId, 'account-1');
    assert.equal(f.adapter.starts[0].grant.id, 'grant-1');
    await assert.rejects(f.store.updateRun(f.root, run, { ...run,
        provenance: { ...run.provenance!, modelId: 'other' } }), /Immutable/);
    f.adapter.onEvent!({ kind: 'command-started', summary: 'secret provider output' });
    f.adapter.onEvent!({ kind: 'file-changed', path: 'edited.txt', summary: 'secret diff' });
    f.adapter.onEvent!({ kind: 'agent-message', summary: 'Bearer secret' });
    f.adapter.complete();
    const done = await terminal(f.store, f.root, run.id);
    assert.equal(done.status, 'completed');
    assert.deepEqual(done.changedFiles, ['edited.txt']);
    const events = (await f.store.readEvents(f.root, run.id, 0, 20)).events;
    assert.deepEqual(events.map(event => event.kind), ['status', 'process', 'file', 'message', 'status']);
    assert.ok(!JSON.stringify(events).includes('secret'));
}));

test('exact policy uses only named current target, with no role resolution', async () => fixture(async f => {
    const run = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true);
    assert.equal(f.routing.calls.length, 0);
    assert.deepEqual(run.requestedPolicy, { kind: 'exact', connectionId: 'codex', modelId: 'model-1' });
    assert.equal(run.provenance?.policyRevision, undefined);
    f.adapter.complete(); await terminal(f.store, f.root, run.id);
}, { kind: 'exact', connectionId: 'codex', modelId: 'model-1' }));

test('hosted authorization and unavailable/ineligible exact selection fail before any run', async () => fixture(async f => {
    await assert.rejects(f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), false), /Hosted/);
    f.registry.models[0].capabilities.agentExecution.value = false;
    await assert.rejects(f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true), /ineligible/);
    f.registry.models[0].capabilities.agentExecution.value = true;
    f.registry.models[0].capabilities.agentExecution.source = 'unknown';
    await assert.rejects(f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true), /ineligible/);
    f.registry.models[0].capabilities.agentExecution.source = 'adapter-known';
    f.registry.observations[0].health = 'unknown';
    await assert.rejects(f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true), /ineligible/);
    assert.equal(f.adapter.starts.length, 0);
    assert.equal((await f.store.listRuns(f.root)).length, 0);
}, { kind: 'exact', connectionId: 'codex', modelId: 'model-1' }));

test('stop before effects cancels and rejects a competing start', async () => fixture(async f => {
    const run = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true);
    await assert.rejects(f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true), /already active/);
    const second = new AgentRuntimeBackend(f.store, { notifyAgentStateChanged() {} }, f.runtime);
    const secondHandle = (await second.attach(pathToFileURL(f.root).href)).projectHandle;
    await assert.rejects(second.start(secondHandle, pathToFileURL(f.root).href, 'task-1', grant(), true), /already active/);
    second.dispose();
    const stopped = await f.backend.stop(f.handle, run.id);
    assert.equal(stopped.status, 'cancelled');
    assert.equal(f.adapter.cancels, 1);
    assert.ok((await f.store.readEvents(f.root, run.id, 0, 20)).events.some(item => item.status === 'cancelling'));
}));

test('post-effect stop preserves workspace bytes and recorded file evidence', async () => fixture(async f => {
    const run = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true);
    await writeFile(join(f.root, 'edited.txt'), 'changed');
    f.adapter.onEvent!({ kind: 'file-changed', path: 'edited.txt', summary: 'provider payload' });
    const stopped = await f.backend.stop(f.handle, run.id);
    assert.equal(stopped.status, 'cancelled');
    assert.deepEqual(stopped.changedFiles, ['edited.txt']);
    assert.equal(await readFile(join(f.root, 'edited.txt'), 'utf8'), 'changed');
}));

test('provider failure after output and authority denial terminate without fallback', async () => fixture(async f => {
    const run = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true);
    f.adapter.onEvent!({ kind: 'agent-message', summary: 'output' });
    f.adapter.fail();
    assert.equal((await terminal(f.store, f.root, run.id)).status, 'failed');
    assert.equal(f.adapter.starts.length, 1);
    const second = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true);
    f.adapter.onEvent!({ kind: 'authority-denied', summary: 'secret authority detail' });
    const denied = await terminal(f.store, f.root, second.id);
    assert.equal(denied.status, 'failed');
    assert.equal(denied.outcome?.code, 'authority-denied');
    assert.equal(f.adapter.starts.length, 2);
    assert.equal(f.adapter.cancels, 1);
}));

test('adapter startup failure leaves a single failed run with selected provenance', async () => fixture(async f => {
    f.adapter.start = async (_request: any): Promise<any> => { throw new Error('private provider detail'); };
    await assert.rejects(f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true),
        /private provider detail/);
    const runs = await f.store.listRuns(f.root);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].status, 'failed');
    assert.equal(runs[0].provenance?.modelId, 'model-1');
    assert.ok(!JSON.stringify(runs[0]).includes('private provider detail'));
}));

test('runtime disposal terminates the owned adapter process and records terminal truth', async () => fixture(async f => {
    const run = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true);
    await f.runtime.dispose();
    assert.equal(f.adapter.disposals, 1);
    assert.ok(['cancelled', 'interrupted', 'failed'].includes((await terminal(f.store, f.root, run.id)).status));
}));

test('Stop still interrupts when the cancelling write fails', async () => fixture(async f => {
    const run = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true);
    const original = f.store.updateRun.bind(f.store);
    (f.store as any).updateRun = (root: string, expected: any, next: any) =>
        next.status === 'cancelling' ? Promise.reject(new Error('storage failure')) : original(root, expected, next);
    await assert.rejects(f.backend.stop(f.handle, run.id), /process stopped/);
    assert.equal(f.adapter.cancels, 1);
    assert.equal((await terminal(f.store, f.root, run.id)).status, 'interrupted');
}));

test('failed adapter interrupt invokes dedicated process termination', async () => fixture(async f => {
    let terminate = 0;
    f.adapter.start = async () => {
        let reject!: (error: Error) => void;
        const result = new Promise<void>((_resolve, fail) => { reject = fail; });
        return { result, cancel: async () => { throw new Error('interrupt unavailable'); },
            terminate: () => { terminate++; reject(new Error('process terminated')); } };
    };
    const run = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-1', grant(), true);
    const stopped = await f.backend.stop(f.handle, run.id);
    assert.equal(terminate, 1);
    assert.equal(stopped.status, 'interrupted');
}));
