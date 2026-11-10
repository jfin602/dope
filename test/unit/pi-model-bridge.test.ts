import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import test from 'node:test';
import { PiModelBridge } from '../../packages/theia-extension/lib/node/pi-model-bridge.js';
import { PiRuntimeHost } from '../../packages/theia-extension/lib/node/pi-runtime-host.js';

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
            tools: ['read_file', 'list_files', 'edit_file', 'read_command_output',
                ...(args[4] === false ? [] : ['run_command'])], resources: 'isolated' }; },
        async openChatToolsSession(...args: any[]) { calls.push(args); return { version: '1.4.0',
            tools: args[5] === true ? args[6] === true ? ['roadmap_phase'] :
                ['roadmap_phase', 'roadmap_finish'] :
                args[4] === true ? ['roadmap_read', 'roadmap_stage', 'roadmap_cancel'] :
                ['read_file', 'list_files', 'search_paths', 'search_text', 'run_command'],
            resources: 'isolated' }; } };
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
    assert.equal(binding.maxOutputTokens, 32768 - 1536);
    assert.equal(calls[0][0].id, 'exact-model');
    assert.equal(calls[0][0].provider, 'dope-local');
    assert.equal(calls[0][0].baseUrl, 'http://127.0.0.1:1234/v1');
    assert.equal(calls[0][0].contextWindow, 32768);
    assert.equal(calls[0][0].maxTokens, binding.maxOutputTokens);
});

test('only the exact local GPT-OSS 20B binding requests explicit Pi sampling', async () => {
    const f = fixture();
    f.state.registry.models[0].providerModelKey = 'openai/gpt-oss-20b';
    f.state.loadedLocalModels[0].providerModelKey = 'openai/gpt-oss-20b';
    await f.bridge.bind({ connectionId: 'desk', modelId: 'openai/gpt-oss-20b' },
        f.host as any, '/tmp');
    assert.deepEqual(f.calls[0][0].samplingParams, { temperature: 1, top_p: 1 });
    f.state.registry.models[0].providerModelKey = 'qwen3.5-9b';
    f.state.loadedLocalModels[0].providerModelKey = 'qwen3.5-9b';
    await f.bridge.bind({ connectionId: 'desk', modelId: 'qwen3.5-9b' },
        f.host as any, '/tmp');
    assert.equal(f.calls[1][0].samplingParams, undefined);
    assert.equal(f.calls[1][0].compat.maxTokensField, 'max_tokens');
});

test('the exact GPT-OSS bridge binding serializes sampling through the real Pi worker', async () => {
    const requests: Record<string, unknown>[] = [];
    const server = createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        requests.push(JSON.parse(body));
        const base = { id: 'sample', object: 'chat.completion.chunk', created: 1,
            model: 'openai/gpt-oss-20b' };
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.end([
            { index: 0, delta: { role: 'assistant', content: 'ok' }, finish_reason: null },
            { index: 0, delta: {}, finish_reason: 'stop' }
        ].map(choice => `data: ${JSON.stringify({ ...base, choices: [choice] })}\n\n`).join('') +
            'data: [DONE]\n\n');
    });
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const f = fixture();
    f.state.registry.connections[0].config.endpoint =
        `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
    f.state.registry.models[0].providerModelKey = 'openai/gpt-oss-20b';
    f.state.loadedLocalModels[0].providerModelKey = 'openai/gpt-oss-20b';
    f.state.registry.models[0].capabilities.localReasoning = { source: 'provider-reported',
        value: { values: ['low'], default: 'low', format: 'openai-reasoning-effort' } };
    const host = new PiRuntimeHost();
    try {
        await host.start();
        await f.bridge.bind({ connectionId: 'desk', modelId: 'openai/gpt-oss-20b' }, host, '/tmp');
        let completed = false;
        for await (const event of host.streamTurn([{ role: 'user', content: 'Say ok.' }], 512))
            if (event.type === 'complete') completed = true;
        assert.equal(completed, true);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].model, 'openai/gpt-oss-20b');
        assert.equal(requests[0].temperature, 1);
        assert.equal(requests[0].top_p, 1);
        assert.equal(requests[0].reasoning_effort, 'low');
    } finally {
        host.dispose();
        server.close();
    }
});

test('Pi bridge uses the loaded 16K context and declared provider ceiling without a 4K/8K cap', async () => {
    const f = fixture();
    f.state.loadedLocalModels[0].contextWindowTokens = 16384;
    f.state.registry.models[0].limits.maxOutputTokens = known(20000);
    const selected = { connectionId: 'desk', modelId: 'exact-model', loadedContextTokens: 16384 };
    const binding = await f.bridge.bind(selected, f.host as any, '/tmp');
    assert.equal(binding.maxOutputTokens, 16384 - 1536);
    assert.equal(f.calls[0][0].maxTokens, binding.maxOutputTokens);
    f.state.registry.models[0].limits.maxOutputTokens = known(12000);
    const declared = await f.bridge.bind(selected, f.host as any, '/tmp');
    assert.equal(declared.maxOutputTokens, 12000);
    assert.equal(f.calls[1][0].maxTokens, 12000);
});

test('Pi binding follows reported modes rather than a model name', async () => {
    const f = fixture();
    f.state.registry.models[0].providerModelKey = 'qwen3.5-9b';
    f.state.loadedLocalModels[0].providerModelKey = 'qwen3.5-9b';
    await f.bridge.bind({ connectionId: 'desk', modelId: 'qwen3.5-9b' }, f.host as any, '/tmp');
    assert.equal(f.calls[0][0].reasoning, false);
    f.state.registry.models[0].capabilities.localReasoning = { source: 'provider-reported',
        value: { values: ['on'], default: 'on', format: 'qwen-chat-template' } };
    await f.bridge.bind({ connectionId: 'desk', modelId: 'qwen3.5-9b' }, f.host as any, '/tmp');
    assert.equal(f.calls[1][0].reasoning, true);
    assert.deepEqual(f.calls[1][0].compat, { maxTokensField: 'max_tokens', thinkingFormat: 'qwen-chat-template' });
    assert.equal(f.calls[1][3], 'medium');
    await assert.rejects(f.bridge.bind({ connectionId: 'desk', modelId: 'qwen3.5-9b' }, f.host as any, '/tmp',
        { reasoningMode: 'off' }), /Reasoning Off is unavailable/);
    assert.equal(f.calls.length, 2);
    await assert.rejects(f.bridge.bind({ connectionId: 'desk', modelId: 'qwen3.5-9b' }, f.host as any,
        '/tmp', { reasoningMode: 'high' }), /does not support/);
    f.state.registry.models[0].providerModelKey = 'another-model';
    f.state.loadedLocalModels[0].providerModelKey = 'another-model';
    delete f.state.registry.models[0].capabilities.localReasoning;
    await f.bridge.bind({ connectionId: 'desk', modelId: 'another-model' }, f.host as any, '/tmp');
    assert.equal(f.calls[2][0].reasoning, false);
    assert.deepEqual(f.calls[2][0].compat, { maxTokensField: 'max_tokens' });
});

test('Pi Chat binding accepts only the complete brokered tool boundary', async () => {
    const f = fixture();
    f.state.registry.models[0].capabilities.agentExecution = known(true);
    const bridge = new PiModelBridge({ inventory: async () => f.state,
        refreshModels: async () => f.state, credential: async () => undefined,
        verifyLocalAgentExecution: async () => 'supported' });
    const selected = { connectionId: 'desk', modelId: 'exact-model' };
    const binding = await bridge.bind(selected, f.host as any, '/tmp', { chatTools: true });
    assert.equal(binding.modelId, 'exact-model');
    const incomplete = { ...f.host, openChatToolsSession: async () => ({ version: '1.4.0',
        tools: ['read_file', 'list_files', 'search_paths', 'search_text'], resources: 'isolated' }) };
    await assert.rejects(bridge.bind(selected, incomplete as any, '/tmp', { chatTools: true }),
        /Pi tool boundary changed/);
});

test('protected proposal binding accepts the complete Pi tool set regardless of order', async () => {
    const f = fixture();
    f.state.registry.models[0].capabilities.agentExecution = known(true);
    const proposalTools = ['read_file', 'list_files', 'search_paths', 'search_text',
        'proposal_status', 'proposal_stage_document', 'proposal_stage_prompt', 'proposal_finish'];
    const host = { ...f.host, openChatToolsSession: async (...args: any[]) => {
        f.calls.push(args);
        return { version: '1.4.0', tools: proposalTools, resources: 'isolated' };
    } };
    const selected = { connectionId: 'desk', modelId: 'exact-model' };
    const binding = await f.bridge.bind(selected, host as any, '/tmp',
        { chatTools: true, proposalTools: true });
    assert.equal(binding.modelId, selected.modelId);
    assert.equal(f.calls[0][6], true);
    const missing = { ...host, openChatToolsSession: async () => ({ version: '1.4.0',
        tools: proposalTools.filter(name => name !== 'proposal_finish'), resources: 'isolated' }) };
    await assert.rejects(f.bridge.bind(selected, missing as any, '/tmp',
        { chatTools: true, proposalTools: true }), /Pi tool boundary changed/);
});

test('protected Planning binding exposes only bounded Plan and read tools', async () => {
    const f = fixture();
    f.state.registry.models[0].capabilities.agentExecution = known(true);
    const names = ['read_file', 'list_files', 'search_paths', 'search_text', 'plan_status',
        'plan_stage_step', 'plan_correct_step', 'plan_stage_closeout', 'plan_stage_efficiency', 'plan_finish'];
    const host = { ...f.host, openChatToolsSession: async (...args: any[]) => {
        f.calls.push(args);
        return { version: '1.4.0', tools: names, resources: 'isolated' };
    } };
    await f.bridge.bind({ connectionId: 'desk', modelId: 'exact-model' }, host as any, '/tmp',
        { chatTools: true, planTools: true });
    assert.equal(f.calls[0][9], true);
    const incomplete = { ...host, openChatToolsSession: async () => ({ version: '1.4.0',
        tools: names.filter(name => name !== 'plan_finish'), resources: 'isolated' }) };
    await assert.rejects(f.bridge.bind({ connectionId: 'desk', modelId: 'exact-model' },
        incomplete as any, '/tmp', { chatTools: true, planTools: true }), /Pi tool boundary changed/);
});

test('protected native Roadmap mode has only read, stage and cancel tools', async () => {
    const f = fixture();
    f.state.registry.models[0].capabilities.agentExecution = known(true);
    await f.bridge.bind({ connectionId: 'desk', modelId: 'exact-model' }, f.host as any, '/tmp',
        { chatTools: true, roadmapTools: true });
    assert.equal(f.calls[0][4], true);
    assert.deepEqual((await f.host.openChatToolsSession({ baseUrl: 'local' }, '/tmp', undefined, undefined, true)).tools,
        ['roadmap_read', 'roadmap_stage', 'roadmap_cancel']);
});

test('protected generation mode exposes only bounded typed Phase and finish tools', async () => {
    const f = fixture();
    f.state.registry.models[0].capabilities.agentExecution = known(true);
    await f.bridge.bind({ connectionId: 'desk', modelId: 'exact-model' }, f.host as any, '/tmp',
        { chatTools: true, roadmapGeneration: true });
    assert.equal(f.calls[0][4], false);
    assert.equal(f.calls[0][5], true);
    assert.deepEqual((await f.host.openChatToolsSession({ baseUrl: 'local' }, '/tmp',
        undefined, undefined, false, true)).tools, ['roadmap_phase', 'roadmap_finish']);
});

test('freshly refreshed exact model reuses a verified tool capability without another synthetic loop', async () => {
    const f = fixture();
    f.state.registry.models[0].capabilities.agentExecution = known(true);
    let probes = 0;
    const bridge = new PiModelBridge({ inventory: async () => f.state,
        refreshModels: async () => f.state, credential: async () => undefined,
        verifyLocalAgentExecution: async () => { probes++; return 'supported'; } });
    await bridge.bind({ connectionId: 'desk', modelId: 'exact-model' }, f.host as any, '/tmp', { chatTools: true });
    assert.equal(probes, 0);
    assert.equal(f.calls.length, 1);
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
    const noProcess = fixture();
    noProcess.state.registry.models[0].capabilities.agentExecution = known(true);
    const noProcessBridge = new PiModelBridge({ inventory: async () => noProcess.state,
        refreshModels: async () => noProcess.state, credential: async () => undefined,
        verifyLocalAgentExecution: async () => 'supported' });
    await noProcessBridge.bind({ connectionId: 'desk', modelId: 'exact-model' },
        noProcess.host as any, '/tmp', { tools: true, workProcessAvailable: false });
    assert.equal(noProcess.calls[0][4], false);
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
