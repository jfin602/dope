import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalAgentExecutionAdapter } from '../../packages/theia-extension/lib/node/local-agent-execution.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';

const connection: any = { version: 1, id: 'local', alias: 'Local', lifecycle: 'enabled',
    config: { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234/v1' } };
const inventory = (): any => ({ registry: { revision: 1, connections: [connection],
    models: [{ connectionId: 'local', providerModelKey: 'model', enabled: true, state: 'ready' }] },
loadedLocalModels: [{ connectionId: 'local', providerModelKey: 'model', contextWindowTokens: 65536 }] });

async function fixture() {
    const parent = await mkdtemp(join(tmpdir(), 'dope-local-adapter-test-'));
    const projectRoot = join(parent, 'project');
    const executionRoot = join(parent, 'candidate');
    await Promise.all([mkdir(projectRoot), mkdir(executionRoot)]);
    const grant = createDefaultExecutionGrant({ id: 'grant', revision: 1, taskId: 'task',
        acceptedAt: '2026-10-10T00:00:00.000Z' });
    const events: any[] = [];
    const request: any = { projectRoot: await realpath(projectRoot), executionRoot: await realpath(executionRoot),
        grant, taskId: 'task', connectionId: 'local', registrationId: 'local', modelId: 'model',
        prompt: 'Edit one file', onEvent: (event: any) => events.push(event) };
    const workspace = Object.assign(Object.create(ExecutionWorkspace.prototype), {
        projectRoot: request.projectRoot, root: request.executionRoot,
        assertActiveBasis: async (project: string, root: string) => {
            assert.equal(project, request.projectRoot); assert.equal(root, request.executionRoot);
        }
    }) as ExecutionWorkspace;
    return { request, workspace, events, cleanup: () => rm(parent, { recursive: true, force: true }) };
}

test('requires OS containment and fresh loaded capacity before model execution', async () => {
    const f = await fixture();
    let turns = 0;
    const base: any = { inventory: async () => inventory(), workspace: async () => f.workspace,
        commands: () => [], transport: { turn: async () => { turns++; return { kind: 'final', text: 'done' }; } } };
    try {
        const denied = new LocalAgentExecutionAdapter({ ...base,
            sandboxPreflight: async () => ({ available: false, reason: 'private mount failed' }) });
        await assert.rejects(denied.start(f.request), /sandbox unavailable/);
        assert.equal(turns, 0);
        const stale = new LocalAgentExecutionAdapter({ ...base,
            sandboxPreflight: async () => ({ available: true }), inventory: async () => ({ ...inventory(), loadedLocalModels: [] }) });
        await assert.rejects(stale.start(f.request), /not loaded/);
        assert.equal(turns, 0);
    } finally { await f.cleanup(); }
});

test('uses candidate/grant and emits bounded turn, command, file and final events', async () => {
    const f = await fixture();
    const replies: any[] = [{ kind: 'tools', calls: [
        { id: 'proc', name: 'process', arguments: { kind: 'test', commandId: 'test_one' } },
        { id: 'edit', name: 'edit', arguments: { operation: 'modify', path: 'src/a.ts', content: 'ok' } }
    ] }, { kind: 'final', text: 'Finished. secret=private-value' }];
    const calls: any[] = [];
    const adapter = new LocalAgentExecutionAdapter({ inventory: async () => inventory(),
        workspace: async request => { assert.strictEqual(request.grant, f.request.grant); return f.workspace; },
        commands: request => { assert.equal(request.executionRoot, f.request.executionRoot); return []; },
        sandboxPreflight: async () => ({ available: true }),
        transport: { turn: async () => replies.shift() },
        broker: (request, workspace) => {
            assert.strictEqual(request.grant, f.request.grant);
            assert.strictEqual(workspace, f.workspace);
            return { assertActive: () => workspace.assertActiveBasis(request.projectRoot, request.executionRoot),
                execute: async (call: any) => { calls.push(call); return { id: call.id, name: call.name,
                    status: 'completed', output: 'token=private-value', truncated: false }; } };
        } });
    try {
        const handle = await adapter.start(f.request);
        await handle.result;
        assert.deepEqual(calls.map(call => call.name), ['process', 'edit']);
        assert.deepEqual(f.events.map(event => event.kind), ['status', 'command-started',
            'command-completed', 'file-changed', 'agent-message', 'status']);
        assert.doesNotMatch(JSON.stringify(f.events), /private-value/);
        assert.equal(handle.recovery, undefined);
    } finally { adapter.dispose(); await f.cleanup(); }
});

test('cancel, timeout and dispose abort transport and sandbox child work', async () => {
    const f = await fixture();
    try {
        for (const mode of ['cancel', 'timeout', 'dispose'] as const) {
            let childRunning = false;
            let childStopped = false;
            const adapter = new LocalAgentExecutionAdapter({ inventory: async () => inventory(),
                workspace: async () => f.workspace, commands: () => [],
                timeoutMs: mode === 'timeout' ? 100 : 2000,
                sandboxPreflight: async () => ({ available: true }),
                transport: { turn: async () => ({ kind: 'tools', calls: [
                    { id: 'one', name: 'process', arguments: { kind: 'test', commandId: 'test_one' } }
                ] }) },
                broker: () => ({ assertActive: async () => {}, execute: async (_call, signal) => {
                    childRunning = true;
                    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
                        childRunning = false; childStopped = true; reject(new Error('secret child diagnostic'));
                    }, { once: true }));
                } }) });
            const handle = await adapter.start(f.request);
            while (!childRunning) await new Promise(resolve => setImmediate(resolve));
            if (mode === 'cancel') await handle.cancel();
            if (mode === 'dispose') adapter.dispose();
            await assert.rejects(handle.result, (error: any) => {
                assert.doesNotMatch(error.message, /secret child/);
                return /cancelled|timed out/.test(error.message);
            });
            assert.equal(childRunning, false);
            assert.equal(childStopped, true);
            adapter.dispose();
        }
    } finally { await f.cleanup(); }
});

test('cancel and terminate abort an in-flight local model transport', async () => {
    const f = await fixture();
    try {
        for (const stop of ['cancel', 'terminate'] as const) {
            let started!: () => void;
            const turnStarted = new Promise<void>(resolve => { started = resolve; });
            let transportStopped = false;
            const adapter = new LocalAgentExecutionAdapter({ inventory: async () => inventory(),
                workspace: async () => f.workspace, commands: () => [],
                sandboxPreflight: async () => ({ available: true }),
                transport: { turn: async ({ signal }: any) => {
                    started();
                    return new Promise((_resolve, reject) => signal.addEventListener('abort', () => {
                        transportStopped = true; reject(new Error('secret transport diagnostic'));
                    }, { once: true }));
                } } });
            const handle = await adapter.start(f.request);
            await turnStarted;
            if (stop === 'cancel') await handle.cancel();
            else handle.terminate?.();
            await assert.rejects(handle.result, /Local execution cancelled/);
            assert.equal(transportStopped, true);
            adapter.dispose();
        }
    } finally { await f.cleanup(); }
});
