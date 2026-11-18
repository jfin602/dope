import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:net';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { MCPStdioDiscovery } from '../../packages/theia-extension/lib/node/mcp-stdio-discovery.js';
import { MCPProjectPreferencesStore, mcpProjectKey } from '../../packages/theia-extension/lib/node/mcp-project-preferences-store.js';
import { MCPServerRegistryStore } from '../../packages/theia-extension/lib/node/mcp-server-registry-store.js';
import { MCPProjectActivationBackend } from '../../packages/theia-extension/lib/node/mcp-project-activation-backend.js';

const identity = { serverId: 'fake', registrationRevision: 1, projectKey: 'a'.repeat(64) };
const initialized = { protocolVersion: '2025-06-18', capabilities: { tools: {} },
    serverInfo: { name: 'fake', version: '1' } };
const tool = { name: 'observe', inputSchema: { type: 'object', properties: {} } };

function mock(reply: (request: Record<string, unknown>, child: EventEmitter &
    { stdin: PassThrough; stdout: PassThrough }) => void) {
    const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough() });
    let buffer = '';
    child.stdin.on('data', chunk => {
        buffer += chunk.toString();
        for (;;) {
            const newline = buffer.indexOf('\n');
            if (newline < 0) break;
            const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
            reply(JSON.parse(line), child);
        }
    });
    let closed = false;
    const session = { stdio: child, exited: Promise.resolve(), close: async () => { closed = true; } };
    return { client: new MCPStdioDiscovery(session as never), child, get closed() { return closed; } };
}
const response = (child: { stdout: PassThrough }, id: unknown, result: unknown) =>
    child.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n');

test('bounded stdio handshake and stable manifest detect changed tool metadata', async () => {
    const run = (description: string) => {
        const connection = mock((request, child) => {
            if (request.method === 'initialize') response(child, request.id, initialized);
            if (request.method === 'tools/list') response(child, request.id,
                { tools: [{ ...tool, description }] });
        });
        return connection.client.discover(identity);
    };
    const first = await run('first');
    const same = await run('first');
    const changed = await run('changed');
    assert.equal(first.transport, 'stdio');
    assert.equal(first.tools[0].name, 'observe');
    assert.equal(first.manifestRevision, same.manifestRevision);
    assert.notEqual(first.manifestRevision, changed.manifestRevision);
    const rejected = mock((request, child) => {
        if (request.method === 'initialize') response(child, request.id, initialized);
        if (request.method === 'tools/list') response(child, request.id,
            { tools: [{ ...tool, description: 'changed' }] });
    });
    await assert.rejects(rejected.client.discover(identity, undefined, first.manifestRevision), /manifest changed/);
    assert.equal(rejected.closed, true);
    assert.equal(rejected.client.status().state, 'unavailable');
});

test('checked observation calls only the pinned tool and caps external output', async () => {
    let calls = 0, changed = false;
    const connection = mock((request, child) => {
        if (request.method === 'initialize') response(child, request.id, initialized);
        if (request.method === 'tools/list') response(child, request.id,
            { tools: [{ ...tool, ...(changed ? { description: 'drift' } : {}) }] });
        if (request.method === 'tools/call') {
            calls++;
            assert.deepEqual(request.params, { name: 'observe', arguments: {} });
            response(child, request.id, { content: [{ type: 'text', text: 'server observation' }] });
        }
    });
    const discovery = await connection.client.discover(identity);
    const result = await connection.client.observe(discovery, 'observe');
    assert.equal(JSON.parse(result).content[0], 'server observation');
    assert.equal(calls, 1);
    changed = true;
    await assert.rejects(connection.client.observe(discovery, 'observe'), /manifest changed/);
    assert.equal(calls, 1);
    assert.equal(connection.closed, true);
    await assert.rejects(connection.client.observe(discovery, 'mutate'), /unavailable/);
});

test('replayed tool reply closes the MCP session before another call', async () => {
    let lastCallId: unknown;
    const connection = mock((request, child) => {
        if (request.method === 'initialize') response(child, request.id, initialized);
        if (request.method === 'tools/list') response(child, request.id, { tools: [tool] });
        if (request.method === 'tools/call') {
            lastCallId = request.id;
            response(child, request.id, { content: [{ type: 'text', text: 'first result' }] });
        }
    });
    const discovery = await connection.client.discover(identity);
    assert.equal(JSON.parse(await connection.client.observe(discovery, 'observe')).content[0], 'first result');
    assert.ok(lastCallId);
    response(connection.child, lastCallId,
        { content: [{ type: 'text', text: 'replayed result' }] });
    assert.equal(connection.client.status().state, 'unavailable');
    assert.equal(connection.closed, true);
    await assert.rejects(connection.client.observe(discovery, 'observe'), /unavailable/);
});

test('observation rejects changed result shape and bounds a large payload as partial', async () => {
    for (const payload of [
        { content: [{ type: 'image', data: 'bad' }] },
        { isError: true, content: [{ type: 'text', text: 'failed' }] }
    ]) {
        const connection = mock((request, child) => {
            if (request.method === 'initialize') response(child, request.id, initialized);
            if (request.method === 'tools/list') response(child, request.id, { tools: [tool] });
            if (request.method === 'tools/call') response(child, request.id, payload);
        });
        const discovery = await connection.client.discover(identity);
        await assert.rejects(connection.client.observe(discovery, 'observe'));
        assert.equal(connection.closed, true);
    }
    const large = mock((request, child) => {
        if (request.method === 'initialize') response(child, request.id, initialized);
        if (request.method === 'tools/list') response(child, request.id, { tools: [tool] });
        if (request.method === 'tools/call') response(child, request.id,
            { content: [{ type: 'text', text: 'version: 4.7.2 ' + 'x'.repeat(9000) }] });
    });
    const discovered = await large.client.discover(identity);
    const output = await large.client.observe(discovered, 'observe');
    assert.ok(Buffer.byteLength(output, 'utf8') <= 8192);
    assert.equal(JSON.parse(output).truncated, true);
    assert.match(JSON.parse(output).content[0], /^version: 4\.7\.2 /);
    assert.equal(large.client.status().state, 'discovered');
});

test('malformed JSON, malicious schema, wrong request ID and oversized output close the session', async () => {
    for (const mode of ['json', 'schema', 'id', 'large']) {
        const connection = mock((request, child) => {
            if (request.method === 'initialize') response(child, request.id, initialized);
            if (request.method === 'tools/list') {
                if (mode === 'json') child.stdout.write('{invalid\n');
                else if (mode === 'large') child.stdout.write('x'.repeat(256 * 1024 + 2));
                else response(child, mode === 'id' ? 999 : request.id,
                    { tools: [{ ...tool, inputSchema: { type: 'string' } }] });
            }
        });
        await assert.rejects(connection.client.discover(identity));
        assert.equal(connection.closed, true);
    }
});

test('cancelled discovery closes the session before a result', async () => {
    const controller = new AbortController();
    const connection = mock(() => {});
    const pending = connection.client.discover(identity, controller.signal);
    controller.abort();
    await assert.rejects(pending, /cancelled/);
    assert.equal(connection.closed, true);
});

test('unsupported negotiated protocol version closes discovery before tool listing', async () => {
    let listed = false;
    const connection = mock((request, child) => {
        if (request.method === 'initialize')
            response(child, request.id, { ...initialized, protocolVersion: '2024-11-05' });
        if (request.method === 'tools/list') listed = true;
    });
    await assert.rejects(connection.client.discover(identity), /Invalid MCP initialize result/);
    assert.equal(listed, false);
    assert.equal(connection.closed, true);
});

test('actual isolated fake server completes MCP initialize and tools/list with no startup project write', async () => {
    const listener = createServer();
    await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
    const bridgePort = (listener.address() as { port: number }).port;
    await new Promise<void>(resolve => listener.close(() => resolve()));
    const temporary = await mkdtemp(join(process.cwd(), '.dope-mcp-protocol-'));
    const installRoot = join(temporary, 'tools', 'fake');
    const projectRoot = join(temporary, 'project');
    const otherRoot = join(temporary, 'other-project');
    const global = join(temporary, 'global');
    const command = join(installRoot, 'bin', 'fake-mcp');
    const script = `#!/usr/bin/python3
import json, os, socket, sys
assert not os.path.exists('/work/new-file')
try:
 open('/work/new-file','w').write('bad')
 raise AssertionError('write permitted')
except OSError: pass
s=socket.socket(); s.bind(('127.0.0.1',int(os.environ['GODOT_MCP_BRIDGE_URL'].rsplit(':',1)[1]))); s.listen(1)
for line in sys.stdin:
 request=json.loads(line)
 if request.get('method')=='initialize': result={'protocolVersion':'2025-06-18','capabilities':{'tools':{}},'serverInfo':{'name':'fake','version':'1'}}
 elif request.get('method')=='tools/list': result={'tools':[{'name':'observe','inputSchema':{'type':'object','properties':{}}}]}
 elif request.get('method')=='notifications/initialized': continue
 else: raise AssertionError('unapproved request')
 print(json.dumps({'jsonrpc':'2.0','id':request['id'],'result':result}),flush=True)
`;
    try {
        await mkdir(join(installRoot, 'bin'), { recursive: true });
        await mkdir(projectRoot); await mkdir(otherRoot); await mkdir(global, { mode: 0o700 });
        await writeFile(command, script); await chmod(command, 0o700);
        const token = 'test-only-secure-bridge-token-with-40-chars';
        const passwords = new Map<string, string>();
        const registry = new MCPServerRegistryStore(global, async () => ({
            getPassword: async (_service, account) => passwords.get(account),
            setPassword: async (_service, account, secret) => { passwords.set(account, secret); },
            deletePassword: async (_service, account) => { passwords.delete(account); },
            findCredentials: async () => [] }));
        const preferences = new MCPProjectPreferencesStore(global);
        let trustedRoot = otherRoot;
        const activation = new MCPProjectActivationBackend(preferences, registry,
            { notifyMCPProjectActivationChanged() {} }, async () => trustedRoot);
        try {
            await registry.mutate({ version: 1, expectedRevision: 0, mutation: { type: 'create',
                server: { version: 1, id: 'fake', name: 'Fake', lifecycle: 'installed',
                    configStatus: 'configured', config: { transport: 'stdio', command, args: [] } } } });
            await registry.replaceBridgeToken('fake', 1, token);
            const registered = await registry.mutate({ version: 1, expectedRevision: 2,
                mutation: { type: 'update', id: 'fake', server: {
                    ...(await registry.read()).servers[0], config: { transport: 'stdio', command, args: [],
                        launch: { mode: 'isolated-loopback-bridge', installRoot, bridgePort,
                            environment: { bridgeUrl: 'GODOT_MCP_BRIDGE_URL',
                                bridgeToken: 'GODOT_MCP_BRIDGE_TOKEN', projectRoot: 'GODOT_MCP_PROJECT_DIR' } } } } } });
            const selected = await activation.switchProject(projectRoot);
            await activation.setEnabled({ projectKey: selected.projectKey!, serverId: 'fake',
                registrationRevision: registered.servers[0].registrationRevision,
                expectedRevision: selected.preferencesRevision, enabled: true });
            await assert.rejects(activation.launchContained('fake'), /active project mismatch/);
            trustedRoot = projectRoot;
            const session = await activation.launchContained('fake');
            const client = new MCPStdioDiscovery(session);
            try {
                const found = await client.discover({ serverId: 'fake',
                    registrationRevision: registered.servers[0].registrationRevision,
                    projectKey: await mcpProjectKey(projectRoot) });
                assert.deepEqual(found.tools.map(item => item.name), ['observe']);
                assert.equal(client.status().state, 'discovered');
                await assert.rejects(import('node:fs/promises').then(fs => fs.access(join(projectRoot, 'new-file'))));
                await activation.switchProject(otherRoot);
                trustedRoot = otherRoot;
                await session.exited;
                assert.equal(client.status().state, 'unavailable');
            } finally { await client.close(); }
        } finally { activation.dispose(); preferences.dispose(); registry.dispose(); }
    } finally { await rm(temporary, { recursive: true, force: true }); }
});
