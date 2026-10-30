import assert from 'node:assert/strict';
import test from 'node:test';
import { PiModelBridge } from '../../packages/theia-extension/lib/node/pi-model-bridge.js';

const known = (value: boolean | number) => ({ source: 'adapter-known' as const, value });
function fixture() {
    const connection = { version: 1 as const, id: 'desk', alias: 'LM Studio', lifecycle: 'enabled' as const,
        config: { type: 'local' as const, runtime: 'lm-studio' as const, endpoint: 'http://127.0.0.1:1234/v1' } };
    const model = { version: 1 as const, connectionId: 'desk', providerModelKey: 'exact-model',
        label: 'Exact Model', locality: 'local' as const, enabled: true, state: 'ready' as const,
        capabilities: { conversationalText: known(true), streaming: known(true), structuredOutput: { source: 'unknown' as const },
            toolCalling: { source: 'unknown' as const }, agentExecution: { source: 'unknown' as const } },
        limits: { contextWindowTokens: { source: 'unknown' as const }, maxInputTokens: { source: 'unknown' as const },
            maxOutputTokens: { source: 'unknown' as const } } };
    const state: any = { registry: { version: 1, revision: 3, connections: [connection], models: [model] },
        observations: [{ connectionId: 'desk', health: 'ready' }],
        loadedLocalModels: [{ connectionId: 'desk', providerModelKey: 'exact-model', contextWindowTokens: 32768 }], tests: [] };
    const calls: any[] = [];
    let refreshError = false;
    const bridge = new PiModelBridge({ inventory: async () => state,
        refreshModels: async () => { if (refreshError) throw new Error('secret transport error'); return state; },
        credential: async () => undefined });
    const host = { async openNoToolSession(...args: any[]) { calls.push(args); return { version: '1.4.0', tools: [], resources: 'isolated' }; },
        async openWorkSession(...args: any[]) { calls.push(args); return { version: '1.4.0',
            tools: ['dope_read', 'dope_list', 'dope_edit', 'dope_process'], resources: 'isolated' }; } };
    return { state, bridge, host, calls, failRefresh: () => { refreshError = true; },
        restoreRefresh: () => { refreshError = false; } };
}

test('Pi bridge binds only the exact refreshed AI Center Local model and measured budget', async () => {
    const { bridge, host, calls } = fixture();
    const binding = await bridge.bind({ connectionId: 'desk', modelId: 'exact-model',
        registryRevision: 3, loadedContextTokens: 32768 }, host as any, '/tmp');
    assert.equal(binding.modelId, 'exact-model');
    assert.equal(binding.registryRevision, 3);
    assert.equal(binding.contextWindowTokens, 32768);
    assert.equal(binding.maxOutputTokens, 4096);
    assert.equal(calls[0][0].id, 'exact-model');
    assert.equal(calls[0][0].provider, 'dope-local');
    assert.equal(calls[0][0].baseUrl, 'http://127.0.0.1:1234/v1');
    assert.equal(calls[0][0].contextWindow, 32768);
});

test('Pi bridge denies stale, wrong, disabled, cold, hosted and unreachable selections', async () => {
    const selection = { connectionId: 'desk', modelId: 'exact-model' };
    for (const mutate of [
        (f: ReturnType<typeof fixture>) => { f.state.registry.models[0].enabled = false; },
        (f: ReturnType<typeof fixture>) => { f.state.loadedLocalModels = []; },
        (f: ReturnType<typeof fixture>) => { f.state.registry.connections[0].lifecycle = 'disabled'; },
        (f: ReturnType<typeof fixture>) => { f.state.registry.connections[0].config.type = 'openai-compatible'; },
        (f: ReturnType<typeof fixture>) => { f.state.registry.connections[0].config.endpoint = 'https://api.openai.com/v1'; },
        (f: ReturnType<typeof fixture>) => { f.state.registry.models[0].locality = 'hosted'; },
        (f: ReturnType<typeof fixture>) => { f.failRefresh(); }
    ]) {
        const f = fixture(); mutate(f);
        await assert.rejects(f.bridge.bind(selection, f.host as any, '/tmp'));
        assert.equal(f.calls.length, 0);
    }
    const f = fixture();
    for (const invalid of [{ connectionId: 'desk', modelId: 'wrong' },
        { ...selection, registryRevision: 2 }, { ...selection, loadedContextTokens: 4096 }])
        await assert.rejects(f.bridge.bind(invalid, f.host as any, '/tmp'));
    assert.equal(f.calls.length, 0);
});

test('Pi bridge denies an endpoint switch during refresh and an insufficient loaded context', async () => {
    const f = fixture();
    const bridge = new PiModelBridge({ inventory: async () => f.state,
        refreshModels: async () => { f.state.registry.connections[0].config.endpoint = 'http://127.0.0.1:4321/v1';
            return f.state; }, credential: async () => undefined });
    await assert.rejects(bridge.bind({ connectionId: 'desk', modelId: 'exact-model' }, f.host as any, '/tmp'));
    assert.equal(f.calls.length, 0);
    const cold = fixture();
    cold.state.loadedLocalModels[0].contextWindowTokens = 1024;
    await assert.rejects(cold.bridge.bind({ connectionId: 'desk', modelId: 'exact-model' }, cold.host as any, '/tmp'));
    assert.equal(cold.calls.length, 0);
});

test('Pi bridge denies unverified tools and returns only credential reference', async () => {
    const f = fixture();
    await assert.rejects(f.bridge.bind({ connectionId: 'desk', modelId: 'exact-model' }, f.host as any,
        '/tmp', { tools: true }), /Verify Local agent/);
    f.state.registry.connections[0].credential = { source: 'environment', name: 'LOCAL_TOKEN', status: 'available' };
    const bridge = new PiModelBridge({ inventory: async () => f.state, refreshModels: async () => f.state,
        credential: async () => 'private-token' });
    const result = await bridge.bind({ connectionId: 'desk', modelId: 'exact-model' }, f.host as any, '/tmp');
    assert.deepEqual(result.credentialReference, { source: 'environment', name: 'LOCAL_TOKEN' });
    assert.ok(!JSON.stringify(result).includes('private-token'));
    assert.equal(f.calls[0][2], 'private-token');
});

test('Pi bridge caps output and opens Work mode only after tool verification', async () => {
    const f = fixture();
    f.state.registry.models[0].limits.maxOutputTokens = known(128);
    const binding = await f.bridge.bind({ connectionId: 'desk', modelId: 'exact-model' }, f.host as any, '/tmp');
    assert.equal(binding.maxOutputTokens, 128);
    assert.equal(f.calls[0][0].maxTokens, 128);
    const verified = fixture();
    verified.state.registry.models[0].capabilities.agentExecution = known(true);
    const bridge = new PiModelBridge({ inventory: async () => verified.state,
        refreshModels: async () => verified.state, credential: async () => undefined,
        verifyLocalAgentExecution: async () => 'supported' });
    const work = await bridge.bind({ connectionId: 'desk', modelId: 'exact-model' },
        verified.host as any, '/tmp', { tools: true });
    assert.equal(work.modelId, 'exact-model');
    assert.equal(verified.calls.length, 1);
    const selection = { connectionId: 'desk', modelId: 'exact-model', registryRevision: 3,
        loadedContextTokens: 32768 };
    await bridge.assertWorkSelection(selection, 'http://127.0.0.1:1234/v1');
    verified.state.registry.revision++;
    await assert.rejects(bridge.assertWorkSelection(selection, 'http://127.0.0.1:1234/v1'));
});

test('Pi Work binding returns the refreshed registry revision for subsequent tool checks', async () => {
    const f = fixture();
    const bridge = new PiModelBridge({ inventory: async () => f.state,
        refreshModels: async () => { f.state.registry.revision++;
            f.state.registry.models[0].capabilities.agentExecution = known(true);
            return f.state; },
        credential: async () => undefined,
        verifyLocalAgentExecution: async () => 'supported' });
    const selected = { connectionId: 'desk', modelId: 'exact-model', registryRevision: 3,
        loadedContextTokens: 32768 };
    const binding = await bridge.bind(selected, f.host as any, '/tmp', { tools: true });
    assert.equal(binding.registryRevision, 4);
    await bridge.assertWorkSelection({ ...selected, registryRevision: binding.registryRevision }, binding.endpoint);
    await assert.rejects(bridge.assertWorkSelection(selected, binding.endpoint), /changed during execution/);
});

test('a stopped Local service fails closed and a fresh selected binding can resume', async () => {
    const f = fixture();
    const selected = { connectionId: 'desk', modelId: 'exact-model', registryRevision: 3,
        loadedContextTokens: 32768 };
    f.failRefresh();
    await assert.rejects(f.bridge.bind(selected, f.host as any, '/tmp'), /Local server unreachable/);
    assert.equal(f.calls.length, 0);
    f.restoreRefresh();
    const resumed = await f.bridge.bind(selected, f.host as any, '/tmp');
    assert.equal(resumed.contextWindowTokens, 32768);
    assert.equal(f.calls.length, 1);
});
