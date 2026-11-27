import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createServer } from 'node:net';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';
import { createMCPObservationExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection, WORK_TOOL_REGISTRY, WORK_TOOL_CATALOG_REVISION,
    WORK_PI_VERSION } from '../../packages/agent-core/lib/work-tool-selection.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { MCPServerRegistryStore } from '../../packages/theia-extension/lib/node/mcp-server-registry-store.js';
import { MCPProjectPreferencesStore, mcpProjectKey } from '../../packages/theia-extension/lib/node/mcp-project-preferences-store.js';
import { WorkMCPObservationAuthority } from '../../packages/theia-extension/lib/node/mcp-work-observation.js';
import { PiWorkExecutionAdapter } from '../../packages/theia-extension/lib/node/pi-work-execution.js';
import { dispatch } from '../../packages/pi-runtime/worker.mjs';

const run = promisify(execFile);

test('Pi Work uses one approved contained observation, records a safe receipt and leaves canonical files unpromoted', async () => {
    const probe = createServer();
    await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
    const bridgePort = (probe.address() as { port: number }).port;
    await new Promise<void>(resolve => probe.close(() => resolve()));
    const base = await mkdtemp(join(process.cwd(), '.dope-mcp-work-'));
    const root = join(base, 'project'), global = join(base, 'global');
    const outsideSecret = join(base, 'host-secret.txt');
    const installRoot = join(base, 'tools', 'fake'), command = join(installRoot, 'bin', 'fake-mcp');
    let workspace: ExecutionWorkspace | undefined;
    let registry: MCPServerRegistryStore | undefined;
    let preferences: MCPProjectPreferencesStore | undefined;
    let authority: WorkMCPObservationAuthority | undefined;
    try {
        await mkdir(root); await mkdir(global, { mode: 0o700 });
        await mkdir(join(installRoot, 'bin'), { recursive: true });
        await writeFile(outsideSecret, 'outside secret must stay hidden\n');
        await writeFile(join(root, 'README.md'), 'canonical stays unchanged\n');
        await run('git', ['init', '-q', root]);
        await run('git', ['-C', root, 'add', 'README.md']);
        await run('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test',
            'commit', '-qm', 'fixture']);
        await writeFile(command, `#!/usr/bin/python3
import json, os, socket, sys, time
assert open('/work/README.md').read() == 'canonical stays unchanged\\n'
try:
 open(${JSON.stringify(outsideSecret)}).read()
 raise AssertionError('outside secret readable')
except OSError: pass
try:
 socket.create_connection(('198.51.100.1',9),0.05)
 raise AssertionError('external network reachable')
except OSError: pass
for path in ['/work/new-file', '/work/scene.tscn']:
 try:
  open(path,'w').write('bad')
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
  try: mode=open(os.path.join(os.path.dirname(sys.argv[0]),'mode')).read().strip()
  except OSError: mode='ok'
  if mode=='shutdown': sys.exit(0)
  if mode=='slow': time.sleep(3)
  result={'isError':True,'content':[{'type':'text','text':'fixture failure'}]} if mode=='fail' else {'content':[{'type':'text','text':'fixture server information'}]}
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
            version: 1, id: 'godot', name: 'Fixture', lifecycle: 'installed', configStatus: 'configured',
            config: { transport: 'stdio', command, args: [] } } } });
        await registry.replaceBridgeToken('godot', 1, 'fixture-secure-bridge-token-with-forty-characters');
        const registered = await registry.mutate({ version: 1, expectedRevision: 2, mutation: {
            type: 'update', id: 'godot', server: { ...(await registry.read()).servers[0],
                config: { transport: 'stdio', command, args: [], launch: {
                    mode: 'isolated-loopback-bridge', installRoot, bridgePort,
                    environment: { bridgeUrl: 'GODOT_MCP_BRIDGE_URL', bridgeToken: 'GODOT_MCP_BRIDGE_TOKEN',
                        projectRoot: 'GODOT_MCP_PROJECT_DIR' } } } } } });
        const projectKey = await mcpProjectKey(root);
        await preferences.mutate({ version: 1, expectedRevision: 0, projectKey,
            serverId: 'godot', registrationRevision: registered.servers[0].registrationRevision, enabled: true });
        authority = new WorkMCPObservationAuthority(registry, preferences);
        const scope = await authority.offer(root, 'local', 'fixture-model');
        assert.ok(scope);
        const toolSelection = makeWorkToolSelection({ projectUri: 'file://' + root,
            taskId: 'task', grantRevision: 1, grantId: 'grant', executionMode: 'isolated',
            connectionId: 'local', modelId: 'fixture-model' },
            ['read', 'ls', 'write', 'edit', 'mcp_godot_server_info']);
        const grant = createMCPObservationExecutionGrant({ id: 'grant', revision: 1,
            taskId: 'task', acceptedAt: new Date().toISOString(), mcpObservation: scope, toolSelection });
        workspace = await ExecutionWorkspace.create(root);
        let openedTools: string[] = [];
        let callResult: unknown;
        const host: any = { async start() {}, async openWorkSession(_model: unknown, _cwd: string,
            _credential: unknown, _thinking: unknown, _process: unknown, mcpTools: any[]) {
            openedTools = mcpTools.map(tool => tool.name);
            return { version: '1.4.0', resources: 'isolated', tools: [
                'read', 'ls', 'write', 'edit', ...openedTools], workCatalogRevision: WORK_TOOL_CATALOG_REVISION };
        }, async runWork(_prompt: string, onTool: (call: any) => Promise<any>) {
            const edit = await onTool({ id: 1, name: 'write', arguments: {
                path: 'README.md', content: 'candidate change stays in review\n' },
                contract: { revision: WORK_TOOL_CATALOG_REVISION, piVersion: WORK_PI_VERSION,
                    schemaHash: WORK_TOOL_REGISTRY.find(tool => tool.id === 'write')!.schemaHash } });
            assert.equal(edit.status, 'completed');
            callResult = await onTool({ id: 2, name: 'mcp_godot_server_info', arguments: {} });
            return { modelId: 'fixture-model', text: 'Observed external information.' };
        }, dispose() {} };
        const bridge: any = { async bind(_selection: unknown, openedHost: any, cwd: string, options: any) {
            assert.deepEqual(options.mcpTools.map((tool: any) => tool.name), ['mcp_godot_server_info']);
            await openedHost.openWorkSession({}, cwd, undefined, undefined, false, options.mcpTools);
            return { endpoint: 'http://127.0.0.1:9/v1', registryRevision: 1 };
        }, async assertWorkSelection() {} };
        const events: any[] = [];
        const request = { projectRoot: root, executionRoot: workspace.root, grant, taskId: 'task', runId: 'run',
            connectionId: 'local', registrationId: 'local', modelId: 'fixture-model',
            selectedRegistryRevision: 1, selectedLoadedContextTokens: 4096,
            prompt: 'Observe server information for this Work task.', onEvent(event: unknown) { events.push(event); } };
        const adapter = new PiWorkExecutionAdapter(bridge, { create: () => host, release() {} } as any,
            () => workspace!, () => [], authority);
        const unlisten = authority.onChange((changedRoot, runId) => {
            const [pending] = authority!.list(changedRoot);
            if (changedRoot === root && runId === 'run' && pending)
                queueMicrotask(() => authority!.decide(root, runId, pending.id, true));
        });
        const handle = await adapter.start(request);
        await handle.result;
        unlisten();
        assert.deepEqual(openedTools, ['mcp_godot_server_info']);
        assert.match((callResult as { output: string }).output, /fixture server information/);
        const [receipt] = events.filter(event => event.kind === 'mcp-observation').map(event => event.receipt);
        assert.equal(receipt.status, 'completed');
        assert.equal(receipt.dispatched, true);
        assert.match(receipt.outputSha256, /^[a-f0-9]{64}$/);
        assert.equal(events.some(event => event.kind === 'file-changed'), true);
        assert.deepEqual((await workspace.delta()).effects.map((effect: any) => effect.path), ['README.md']);
        assert.equal(await readFile(join(workspace.root, 'README.md'), 'utf8'), 'candidate change stays in review\n');
        assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'canonical stays unchanged\n');
        await assert.rejects(readFile(join(root, 'new-file')));
        await assert.rejects(readFile(join(root, 'scene.tscn')));
        const originalFetch = globalThis.fetch;
        const originalWrite = process.stdout.write;
        const realEvents: any[] = [];
        const realModel = { id: 'fixture-model', name: 'Fixture Local', provider: 'dope-local',
            api: 'openai-completions', baseUrl: 'http://127.0.0.1:9/v1', reasoning: false,
            input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192, maxTokens: 512 };
        let modelTurns = 0;
        const realHost: any = { async start() {},
            openWorkSession(model: unknown, cwd: string, _credential: unknown, _thinking: unknown,
                _process: unknown, mcpTools: unknown[]) {
                return dispatch({ type: 'open', mode: 'work', model, cwd, workProcessAvailable: false, mcpTools });
            },
            async runWork(prompt: string, onTool: (call: any) => Promise<any>, onEvent: (event: any) => void) {
                const replies: Promise<unknown>[] = [];
                process.stdout.write = function (chunk: any, ...args: any[]) {
                    try {
                        const frame = JSON.parse(String(chunk));
                        if (frame.tool) {
                            replies.push(onTool(frame.tool).then(result => dispatch({ type: 'tool-result',
                                requestId: frame.id, toolId: frame.tool.id, result })));
                            return true;
                        }
                    } catch { /* ordinary test output */ }
                    return originalWrite.call(this, chunk, ...args);
                } as typeof process.stdout.write;
                const answer = await dispatch({ type: 'work', id: 73, prompt, emit: onEvent });
                await Promise.all(replies);
                return answer;
            }, dispose() {} };
        const realBridge: any = { async bind(_selection: unknown, openedHost: any, cwd: string, options: any) {
            const opened = await openedHost.openWorkSession(realModel, cwd, undefined, undefined,
                false, options.mcpTools);
            assert.ok(opened.tools.includes('mcp_godot_server_info'));
            return { endpoint: realModel.baseUrl, registryRevision: 1 };
        }, async assertWorkSelection() {} };
        const realAdapter = new PiWorkExecutionAdapter(realBridge,
            { create: () => realHost, release() {} } as any, () => workspace!, () => [], authority);
        const realApprove = authority.onChange((changedRoot, runId) => {
            const [pending] = authority!.list(changedRoot);
            if (changedRoot === root && runId === 'run-real' && pending)
                queueMicrotask(() => authority!.decide(root, runId, pending.id, true));
        });
        try {
            globalThis.fetch = async (_url, options) => {
                const body = JSON.parse(String(options?.body));
                assert.equal(body.model, realModel.id);
                assert.ok(body.tools.some((tool: any) => tool.function.name === 'mcp_godot_server_info'));
                const choices = ++modelTurns === 1 ? [
                    { delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'work-p9-1',
                        type: 'function', function: { name: 'mcp_godot_server_info', arguments: '{}' } }] },
                    finish_reason: null }, { delta: {}, finish_reason: 'tool_calls' }
                ] : [
                    { delta: { role: 'assistant', content: 'Fixture observed.' }, finish_reason: null },
                    { delta: {}, finish_reason: 'stop' }
                ];
                return new Response(choices.map((choice, index) => `data: ${JSON.stringify({
                    id: `work-p9-${modelTurns}-${index}`, object: 'chat.completion.chunk',
                    created: 1, model: realModel.id, choices: [{ index: 0, ...choice }] })}\n\n`).join('') +
                    'data: [DONE]\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
            };
            const realRun = await realAdapter.start({ ...request, runId: 'run-real',
                onEvent(event: unknown) { realEvents.push(event); } });
            await realRun.result;
            assert.equal(modelTurns, 2);
            assert.equal(realEvents.filter(event => event.kind === 'mcp-observation' &&
                event.receipt.status === 'completed' && event.receipt.dispatched).length, 1);
            assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'canonical stays unchanged\n');
        } finally {
            globalThis.fetch = originalFetch;
            process.stdout.write = originalWrite;
            realApprove(); realAdapter.dispose();
            await dispatch({ type: 'close' }).catch(() => {});
        }
        const negativeCalls = [
            { name: 'mcp_godot_server_info', arguments: { path: '../outside' } },
            { name: 'mcp_godot_scene_write', arguments: {} },
            { name: 'mcp_run_command', arguments: {} },
            { name: 'mcp_fetch_url', arguments: {} },
            { name: 'mcp_read_outside_root', arguments: {} }
        ];
        for (const raw of negativeCalls) {
            const before = events.length;
            host.runWork = async (_prompt: string, onTool: (call: any) => Promise<any>) => {
                await onTool({ id: 1, ...raw });
                return { modelId: 'fixture-model', text: 'Unexpected success' };
            };
            const deniedRun = await adapter.start(request);
            await assert.rejects(deniedRun.result);
            assert.equal(events.slice(before).some(event => event.kind === 'mcp-observation'), false);
            assert.ok(events.slice(before).some(event => event.kind === 'work-observation' &&
                event.phase === 'denied' && event.brokerInvoked === false));
            assert.deepEqual(authority.list(root), []);
        }
        await writeFile(join(root, 'README.md'), 'source drift\n');
        await assert.rejects(adapter.start(request), /basis|changed/i);
        await writeFile(join(root, 'README.md'), 'canonical stays unchanged\n');
        host.runWork = async (_prompt: string, onTool: (call: any) => Promise<any>) => {
            await onTool({ id: 1, name: 'mcp_godot_server_info', arguments: {} });
            return { modelId: 'fixture-model', text: 'Unexpected success' };
        };
        const waitingRun = await adapter.start(request);
        for (let attempt = 0; !authority.list(root).length && attempt < 100; attempt++)
            await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(authority.list(root).length, 1);
        await waitingRun.cancel();
        assert.deepEqual(authority.list(root), []);
        const autoApprove = authority.onChange((changedRoot, runId) => {
            const [pending] = authority!.list(changedRoot);
            if (changedRoot === root && runId === 'run' && pending)
                queueMicrotask(() => authority!.decide(root, runId, pending.id, true));
        });
        host.runWork = async (_prompt: string, onTool: (call: any) => Promise<any>) => {
            await onTool({ id: 1, name: 'mcp_godot_server_info', arguments: {} });
            return { modelId: 'fixture-model', text: 'Unexpected success' };
        };
        await writeFile(join(installRoot, 'bin', 'mode'), 'fail');
        const failedAt = events.length;
        const failedRun = await adapter.start(request);
        await assert.rejects(failedRun.result);
        assert.ok(events.slice(failedAt).some(event => event.kind === 'mcp-observation' &&
            event.receipt.status === 'failed' && event.receipt.dispatched === true));
        await writeFile(join(installRoot, 'bin', 'mode'), 'shutdown');
        const shutdownAt = events.length;
        const shutdownRun = await adapter.start(request);
        await assert.rejects(shutdownRun.result);
        assert.ok(events.slice(shutdownAt).some(event => event.kind === 'mcp-observation' &&
            event.receipt.status === 'failed' && event.receipt.dispatched === true));
        await writeFile(join(installRoot, 'bin', 'mode'), 'slow');
        const cancelledAt = events.length;
        const activeRun = await adapter.start(request);
        for (let attempt = 0; !authority.list(root).length && attempt < 100; attempt++)
            await new Promise(resolve => setTimeout(resolve, 10));
        await new Promise(resolve => setTimeout(resolve, 200));
        await activeRun.cancel();
        assert.ok(events.slice(cancelledAt).some(event => event.kind === 'mcp-observation' &&
            event.receipt.status === 'cancelled' && event.receipt.dispatched === true));
        autoApprove();
        await rm(join(installRoot, 'bin', 'mode'));
        const expired = createMCPObservationExecutionGrant({ id: 'expired', revision: 1, taskId: 'task',
            acceptedAt: new Date(Date.now() - 120_000).toISOString(),
            mcpObservation: { ...scope, expiresAt: new Date(Date.now() - 60_000).toISOString() },
            toolSelection: { ...toolSelection, grantId: 'expired' } });
        await assert.rejects(adapter.start({ ...request, grant: expired }), /scope unavailable/);
        const beforeDisable = events.length;
        host.runWork = async (_prompt: string, onTool: (call: any) => Promise<any>) => {
            await preferences!.mutate({ version: 1, expectedRevision: 1, projectKey,
                serverId: 'godot', registrationRevision: registered.servers[0].registrationRevision, enabled: false });
            await onTool({ id: 1, name: 'mcp_godot_server_info', arguments: {} });
            return { modelId: 'fixture-model', text: 'Unexpected success' };
        };
        const disabledRun = await adapter.start(request);
        await assert.rejects(disabledRun.result);
        assert.equal(events.slice(beforeDisable).some(event => event.kind === 'mcp-observation' &&
            event.receipt.dispatched), false);
        adapter.dispose();
    } finally {
        authority?.dispose(); registry?.dispose(); preferences?.dispose();
        await workspace?.dispose(); await rm(base, { recursive: true, force: true });
    }
});
