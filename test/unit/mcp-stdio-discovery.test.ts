import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { EventEmitter } from 'node:events';
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { MCPStdioDiscovery } from '../../packages/theia-extension/lib/node/mcp-stdio-discovery.js';
import { launchContainedMCPServer } from '../../packages/theia-extension/lib/node/mcp-contained-launch.js';
import { mcpProjectKey } from '../../packages/theia-extension/lib/node/mcp-project-preferences-store.js';

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
    return { client: new MCPStdioDiscovery(session as never), get closed() { return closed; } };
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
});

test('malicious schema, wrong request ID and oversized output close the session', async () => {
    for (const mode of ['schema', 'id', 'large']) {
        const connection = mock((request, child) => {
            if (request.method === 'initialize') response(child, request.id, initialized);
            if (request.method === 'tools/list') {
                if (mode === 'large') child.stdout.write('x'.repeat(256 * 1024 + 2));
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

test('actual isolated fake server completes MCP initialize and tools/list with no startup project write', async () => {
    const temporary = await mkdtemp(join(process.cwd(), '.dope-mcp-protocol-'));
    const installRoot = join(temporary, 'tools', 'fake');
    const projectRoot = join(temporary, 'project');
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
        await mkdir(projectRoot);
        await writeFile(command, script); await chmod(command, 0o700);
        const session = await launchContainedMCPServer({ command, installRoot, projectRoot,
            projectKey: await mcpProjectKey(projectRoot), bridgePort: 9081,
            bridgeToken: 'a'.repeat(40), environment: { bridgeUrl: 'GODOT_MCP_BRIDGE_URL',
                bridgeToken: 'GODOT_MCP_BRIDGE_TOKEN', projectRoot: 'GODOT_MCP_PROJECT_DIR' } });
        const client = new MCPStdioDiscovery(session);
        try {
            const found = await client.discover({ ...identity, projectKey: await mcpProjectKey(projectRoot) });
            assert.deepEqual(found.tools.map(item => item.name), ['observe']);
            await assert.rejects(import('node:fs/promises').then(fs => fs.access(join(projectRoot, 'new-file'))));
        } finally { await client.close(); }
    } finally { await rm(temporary, { recursive: true, force: true }); }
});
