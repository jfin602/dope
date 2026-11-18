import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { MCPServerRegistryStore } from '../../packages/theia-extension/lib/node/mcp-server-registry-store.js';
import { MCPProjectPreferencesStore, mcpProjectKey } from '../../packages/theia-extension/lib/node/mcp-project-preferences-store.js';
import { MCPProjectActivationBackend } from '../../packages/theia-extension/lib/node/mcp-project-activation-backend.js';
import { MCPStdioDiscovery } from '../../packages/theia-extension/lib/node/mcp-stdio-discovery.js';
import { MCPChatObservation } from '../../packages/theia-extension/lib/node/mcp-chat-observation.js';
import { WorkMCPObservationAuthority } from '../../packages/theia-extension/lib/node/mcp-work-observation.js';

async function availablePort(): Promise<number> {
    const listener = createServer();
    await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
    const port = (listener.address() as { port: number }).port;
    await new Promise<void>(resolve => listener.close(() => resolve()));
    return port;
}

const script = `#!/usr/bin/python3
import json, os, socket, sys
kind=os.path.basename(sys.argv[0]).split('-')[0]
assert open('/work/README.md').read().strip()==kind
for path in ['/work/authoritative.tscn', '/work/created-at-startup']:
 try:
  open(path,'w').write('intrusion')
  raise AssertionError('canonical write permitted')
 except OSError: pass
assert not os.path.isfile('/work/.git/config')
try:
 open('/work/.git/config','w').write('intrusion')
 raise AssertionError('Git metadata writable')
except OSError: pass
os.system('/usr/bin/touch /work/process-startup-write 2>/dev/null')
assert not os.path.exists('/work/process-startup-write')
assert not os.path.isfile('/work/.env')
try:
 socket.create_connection(('198.51.100.1',9),0.05)
 raise AssertionError('network permitted')
except OSError: pass
for line in sys.stdin:
 request=json.loads(line)
 method=request.get('method')
 if method=='notifications/initialized': continue
 if method=='initialize': result={'protocolVersion':'2025-06-18','capabilities':{'tools':{}},'serverInfo':{'name':kind,'version':'1'}}
 elif method=='tools/list': result={'tools':[{'name':kind+'_status','inputSchema':{'type':'object','properties':{},'additionalProperties':False}}]}
 elif method=='tools/call':
  assert request['params']=={'name':kind+'_status','arguments':{}}
  result={'content':[{'type':'text','text':kind+':'+str(request['id'])}]}
 else: raise AssertionError('unapproved method')
 print(json.dumps({'jsonrpc':'2.0','id':request['id'],'result':result}),flush=True)
`;

test('two unrelated servers use the same contained catalog and project APIs; unreviewed Pi tools stay hidden', async () => {
    const base = await mkdtemp(join(process.cwd(), '.dope-mcp-generic-'));
    const global = join(base, 'global');
    const roots = { notes: join(base, 'project-notes'), metrics: join(base, 'project-metrics') };
    const notesPort = await availablePort();
    let metricsPort = await availablePort();
    while (metricsPort === notesPort) metricsPort = await availablePort();
    const ports = { notes: notesPort, metrics: metricsPort };
    const tokens = new Map<string, string>();
    const registry = new MCPServerRegistryStore(global, async () => ({
        getPassword: async (_service, account) => tokens.get(account),
        setPassword: async (_service, account, value) => { tokens.set(account, value); },
        deletePassword: async (_service, account) => { tokens.delete(account); },
        findCredentials: async () => [] }));
    const preferences = new MCPProjectPreferencesStore(global);
    const activation = Object.fromEntries(Object.entries(roots).map(([id, root]) => [id,
        new MCPProjectActivationBackend(preferences, registry,
            { notifyMCPProjectActivationChanged() {} }, async () => root)])) as
        Record<keyof typeof roots, MCPProjectActivationBackend>;
    const clients: MCPStdioDiscovery[] = [];
    try {
        await mkdir(global, { mode: 0o700 });
        for (const [id, root] of Object.entries(roots)) {
            await mkdir(root);
            await writeFile(join(root, 'README.md'), id + '\n');
            await writeFile(join(root, 'authoritative.tscn'), 'canonical scene\n');
            await mkdir(join(root, '.git'));
            await writeFile(join(root, '.git', 'config'), 'protected Git metadata\n');
            await writeFile(join(root, id === 'notes' ? 'main.ts' : 'main.rs'),
                id === 'notes' ? 'export const answer = 42;\n' : 'fn main() {}\n');
            await writeFile(join(root, '.env'), 'masked project secret\n');
            const installRoot = join(base, 'tools', id);
            const command = join(installRoot, 'bin', `${id}-mcp`);
            await mkdir(join(installRoot, 'bin'), { recursive: true });
            await writeFile(command, script);
            await chmod(command, 0o700);
            const before = await registry.read();
            await registry.mutate({ version: 1, expectedRevision: before.revision, mutation: {
                type: 'create', server: { version: 1, id, name: id, lifecycle: 'installed',
                    configStatus: 'configured', config: { transport: 'stdio', command, args: [] } } } });
            const pending = await registry.read();
            await registry.replaceBridgeToken(id, pending.revision,
                `test-only-${id}-bridge-token-with-forty-characters`);
            const configured = await registry.read();
            const saved = configured.servers.find(server => server.id === id)!;
            await registry.mutate({ version: 1, expectedRevision: configured.revision, mutation: {
                type: 'update', id, server: { ...saved, config: { transport: 'stdio', command,
                    args: [], launch: { mode: 'isolated-loopback-bridge', installRoot,
                        bridgePort: ports[id as keyof typeof roots], environment: {
                            bridgeUrl: 'MCP_BRIDGE_URL', bridgeToken: 'MCP_BRIDGE_TOKEN',
                            projectRoot: 'MCP_PROJECT_ROOT' } } } } } });
        }
        const initial = await Promise.all(Object.entries(activation).map(async ([id, backend]) =>
            [id, await backend.switchProject(roots[id as keyof typeof roots])] as const));
        for (const [, snapshot] of initial)
            assert.ok(snapshot.servers.every(server => !server.eligible));
        const catalog = await registry.read();
        for (const [id, backend] of Object.entries(activation)) {
            const current = await backend.current();
            const server = catalog.servers.find(item => item.id === id)!;
            await backend.setEnabled({ projectKey: current.projectKey!, serverId: id,
                registrationRevision: server.registrationRevision,
                expectedRevision: current.preferencesRevision, enabled: true });
            await assert.rejects(backend.launchContained(id === 'notes' ? 'metrics' : 'notes'),
                /unavailable/);
        }
        const work = new WorkMCPObservationAuthority(registry, preferences);
        try {
            assert.equal(await work.offer(roots.notes, 'local', 'model'), undefined);
            assert.equal(await MCPChatObservation.open(roots.notes, () => roots.notes,
                new AbortController().signal, registry, preferences, () => {}), undefined);
        } finally { work.dispose(); }
        const sessions = await Promise.all(Object.entries(activation).map(async ([id, backend]) => {
            const session = await backend.launchContained(id);
            const client = new MCPStdioDiscovery(session);
            clients.push(client);
            return { id, client, session };
        }));
        for (const { id, client } of sessions) {
            const root = roots[id as keyof typeof roots];
            const server = catalog.servers.find(item => item.id === id)!;
            const discovery = await client.discover({ serverId: id,
                registrationRevision: server.registrationRevision,
                projectKey: await mcpProjectKey(root) });
            assert.deepEqual(discovery.tools.map(tool => tool.name), [`${id}_status`]);
            await assert.rejects(client.observe(discovery, 'scene_write'), /unavailable/);
            const receipt = JSON.parse(await client.observe(discovery, `${id}_status`));
            assert.equal(receipt.serverId, id);
            assert.match(receipt.manifestRevision, /^[a-f0-9]{64}$/);
            assert.deepEqual(receipt.content, [`${id}:4`]);
            assert.equal(await readFile(join(root, 'authoritative.tscn'), 'utf8'), 'canonical scene\n');
            assert.equal(await readFile(join(root, id === 'notes' ? 'main.ts' : 'main.rs'), 'utf8'),
                id === 'notes' ? 'export const answer = 42;\n' : 'fn main() {}\n');
            await assert.rejects(readFile(join(root, 'created-at-startup')));
            await assert.rejects(readFile(join(root, 'process-startup-write')));
            assert.equal(await readFile(join(root, '.git', 'config'), 'utf8'), 'protected Git metadata\n');
            assert.equal(await readFile(join(root, '.env'), 'utf8'), 'masked project secret\n');
        }
        const removed = await registry.mutate({ version: 1, expectedRevision: catalog.revision,
            mutation: { type: 'remove', id: 'notes' } });
        await Promise.all(sessions.map(({ session }) => session.exited));
        assert.ok(clients.every(client => client.status().state === 'unavailable'));
        const notes = catalog.servers.find(item => item.id === 'notes')!;
        const reinstalled = await registry.mutate({ version: 1, expectedRevision: removed.revision,
            mutation: { type: 'create', server: { version: 1, id: 'notes', name: 'notes',
                lifecycle: 'installed', configStatus: 'configured', config: notes.config,
                credential: notes.credential } } });
        assert.notEqual(reinstalled.servers.find(item => item.id === 'notes')!.registrationRevision,
            notes.registrationRevision);
        assert.equal((await activation.notes.current()).servers.find(item => item.serverId === 'notes')?.eligible,
            false);
    } finally {
        await Promise.all(clients.map(client => client.close().catch(() => {})));
        for (const backend of Object.values(activation)) backend.dispose();
        preferences.dispose(); registry.dispose();
        await rm(base, { recursive: true, force: true });
    }
});
