import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { MCPChatObservation, mcpObservationFailure } from '../../packages/theia-extension/lib/node/mcp-chat-observation.js';
import { MCPServerRegistryStore } from '../../packages/theia-extension/lib/node/mcp-server-registry-store.js';
import { MCPProjectPreferencesStore, mcpProjectKey } from '../../packages/theia-extension/lib/node/mcp-project-preferences-store.js';
import { dispatch } from '../../packages/pi-runtime/worker.mjs';

const model = { id: 'offline-mcp', name: 'Offline MCP', provider: 'dope-local',
    api: 'openai-completions', baseUrl: 'http://127.0.0.1:9/v1', reasoning: false,
    input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 8192, maxTokens: 512 };

test('observation failure labels are bounded Dope codes, never server text', () => {
    assert.match(mcpObservationFailure(new Error('MCP observation output limit')), /output limit/);
    assert.match(mcpObservationFailure(new Error('Invalid MCP observation result')), /invalid or rejected server result/);
    assert.equal(mcpObservationFailure(new Error('secret-value-from-server')),
        'MCP observation failed (unavailable); no result was accepted');
});

test('bundled Pi Chat worker calls only a broker-approved observation through contained MCP', async () => {
    const portProbe = createServer();
    await new Promise<void>(resolve => portProbe.listen(0, '127.0.0.1', resolve));
    const bridgePort = (portProbe.address() as { port: number }).port;
    await new Promise<void>(resolve => portProbe.close(() => resolve()));
    const base = await mkdtemp(join(process.cwd(), '.dope-mcp-worker-'));
    const installRoot = join(base, 'tools', 'fake');
    const root = join(base, 'project');
    const global = join(base, 'global');
    const command = join(installRoot, 'bin', 'fake-mcp');
    const originalFetch = globalThis.fetch;
    const originalWrite = process.stdout.write;
    let observation: MCPChatObservation | undefined;
    let registry: MCPServerRegistryStore | undefined;
    let preferences: MCPProjectPreferencesStore | undefined;
    try {
        await mkdir(join(installRoot, 'bin'), { recursive: true });
        await mkdir(root); await mkdir(global, { mode: 0o700 });
        await writeFile(command, `#!/usr/bin/python3
import json, os, socket, sys
assert not os.path.exists('/work/new-file')
try:
 open('/work/new-file','w').write('bad')
 raise AssertionError('canonical write permitted')
except OSError: pass
s=socket.socket(); s.bind(('127.0.0.1',int(os.environ['GODOT_MCP_BRIDGE_URL'].rsplit(':',1)[1]))); s.listen(1)
for line in sys.stdin:
 request=json.loads(line)
 method=request.get('method')
 if method=='initialize': result={'protocolVersion':'2025-06-18','capabilities':{'tools':{}},'serverInfo':{'name':'fake','version':'1'}}
 elif method=='tools/list': result={'tools':[{'name':'godot_get_server_info','inputSchema':{'type':'object','properties':{},'additionalProperties':False}}]}
 elif method=='notifications/initialized': continue
 elif method=='tools/call':
  assert request['params']=={'name':'godot_get_server_info','arguments':{}}
  result={'content':[{'type':'text','text':'fixture observation'}]}
 else: raise AssertionError('unapproved method')
 print(json.dumps({'jsonrpc':'2.0','id':request['id'],'result':result}),flush=True)
`);
        await chmod(command, 0o700);
        const passwords = new Map<string, string>();
        registry = new MCPServerRegistryStore(global, async () => ({
            getPassword: async (_service, account) => passwords.get(account),
            setPassword: async (_service, account, value) => { passwords.set(account, value); },
            deletePassword: async (_service, account) => { passwords.delete(account); },
            findCredentials: async () => [] }));
        preferences = new MCPProjectPreferencesStore(global);
        await registry.mutate({ version: 1, expectedRevision: 0, mutation: { type: 'create', server: {
            version: 1, id: 'godot', name: 'Fixture', lifecycle: 'installed',
            configStatus: 'configured', config: { transport: 'stdio', command, args: [] } } } });
        await registry.replaceBridgeToken('godot', 1, 'fixture-secure-bridge-token-with-forty-characters');
        const registered = await registry.mutate({ version: 1, expectedRevision: 2, mutation: {
            type: 'update', id: 'godot', server: { ...(await registry.read()).servers[0],
                config: { transport: 'stdio', command, args: [], launch: {
                    mode: 'isolated-loopback-bridge', installRoot, bridgePort,
                    environment: { bridgeUrl: 'GODOT_MCP_BRIDGE_URL',
                        bridgeToken: 'GODOT_MCP_BRIDGE_TOKEN', projectRoot: 'GODOT_MCP_PROJECT_DIR' } } } } } });
        const key = await mcpProjectKey(root);
        await preferences.mutate({ version: 1, expectedRevision: 0,
            projectKey: key, serverId: 'godot', registrationRevision: registered.servers[0].registrationRevision,
            enabled: true });
        const signal = new AbortController();
        observation = await MCPChatObservation.open(root, () => root, signal.signal, registry, preferences,
            () => signal.abort());
        assert.ok(observation);
        let turns = 0, dispatched = 0;
        await assert.rejects(observation.execute('mcp_godot_scene_write', {}, async () => true,
            () => root, () => { dispatched++; }), /denied/);
        await assert.rejects(observation.execute('mcp_godot_server_info', { path: 'scene.tscn' },
            async () => true, () => root, () => { dispatched++; }), /denied/);
        await assert.rejects(observation.execute('mcp_godot_server_info', {}, async () => false,
            () => root, () => { dispatched++; }), /approval/);
        assert.equal(dispatched, 0);
        globalThis.fetch = async (_url, options) => {
            const body = JSON.parse(String(options?.body));
            assert.equal(body.model, model.id);
            assert.ok(body.tools.some((tool: any) => tool.function.name === 'mcp_godot_server_info'));
            if (++turns === 2) assert.match(JSON.stringify(body.messages), /fixture observation/);
            const choice = turns === 1 ? [
                { index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'mcp-call-1',
                    type: 'function', function: { name: 'mcp_godot_server_info', arguments: '{}' } }] }, finish_reason: null },
                { index: 0, delta: {}, finish_reason: 'tool_calls' }
            ] : [
                { index: 0, delta: { role: 'assistant', content: 'Observed server information.' }, finish_reason: null },
                { index: 0, delta: {}, finish_reason: 'stop' }
            ];
            return new Response(choice.map((item, index) => `data: ${JSON.stringify({ id: `mcp-${turns}-${index}`,
                object: 'chat.completion.chunk', created: 1, model: model.id, choices: [item] })}\n\n`).join('') +
                'data: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
        };
        process.stdout.write = function (chunk: any, ...args: any[]) {
            try {
                const frame = JSON.parse(String(chunk));
                if (frame.tool) {
                    assert.equal(frame.tool.name, 'mcp_godot_server_info');
                    void observation!.execute(frame.tool.name, frame.tool.arguments, async () => true, () => root,
                        () => { dispatched++; }).then(output =>
                        dispatch({ type: 'tool-result', requestId: frame.id, toolId: frame.tool.id,
                            result: { status: 'completed', output } }));
                    return true;
                }
            } catch { /* ordinary test output */ }
            return originalWrite.call(this, chunk, ...args);
        } as typeof process.stdout.write;
        const opened = await dispatch({ type: 'open', mode: 'chat-tools', cwd: root, model,
            mcpTools: observation.descriptors });
        assert.ok(opened.tools.includes('mcp_godot_server_info'));
        const answer = await dispatch({ type: 'turn', id: 41, maxOutputTokens: 128,
            messages: [{ role: 'user', content: 'Observe server information.' }] });
        assert.match(answer.text, /Observed server information/);
        assert.equal(turns, 2);
        assert.equal(dispatched, 1);
        await preferences.mutate({ version: 1, expectedRevision: 1, projectKey: key,
            serverId: 'godot', registrationRevision: registered.servers[0].registrationRevision,
            enabled: false });
        await assert.rejects(observation.execute('mcp_godot_server_info', {}, async () => true,
            () => root, () => { dispatched++; }), /revoked|project changed/);
        assert.equal(dispatched, 1);
    } finally {
        process.stdout.write = originalWrite;
        globalThis.fetch = originalFetch;
        await dispatch({ type: 'close' }).catch(() => {});
        await observation?.close();
        preferences?.dispose(); registry?.dispose();
        await rm(base, { recursive: true, force: true });
    }
});
