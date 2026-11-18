import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseMCPServer, parseMCPServerRegistrySnapshot } from '../../packages/ai/lib/mcp-server-registry.js';
import { MCPServerRegistryStore } from '../../packages/theia-extension/lib/node/mcp-server-registry-store.js';
import { MCPServerRegistryBackend } from '../../packages/theia-extension/lib/node/mcp-server-registry-backend.js';
import { AIRegistryStore } from '../../packages/theia-extension/lib/node/ai-registry-store.js';

const server = (id = 'godot') => ({ version: 1 as const, id, name: 'Godot bridge', lifecycle: 'installed' as const,
    configStatus: 'configured' as const, config: { transport: 'stdio' as const,
        command: '/home/user/.local/bin/godot-editor-mcp', args: [] } });
const create = (id: string, expectedRevision: number) => ({ version: 1 as const, expectedRevision,
    mutation: { type: 'create' as const, server: server(id) } });
async function temporary(work: (directory: string) => Promise<void>): Promise<void> {
    const directory = await mkdtemp(join(tmpdir(), 'dope-mcp-registry-'));
    try { await work(directory); } finally { await rm(directory, { recursive: true, force: true }); }
}
async function child(directory: string, id: string): Promise<string> {
    const source = fileURLToPath(new URL('../../packages/theia-extension/lib/node/mcp-server-registry-store.js', import.meta.url));
    const script = `const {MCPServerRegistryStore}=require(${JSON.stringify(source)});
        const store=new MCPServerRegistryStore(process.argv[1]);
        store.mutate({version:1,expectedRevision:0,mutation:{type:'create',server:{version:1,id:process.argv[2],
        name:'Child',lifecycle:'installed',configStatus:'configured',config:{transport:'stdio',command:'/bin/true',args:[]}}}})
        .then(()=>process.stdout.write('ok'),error=>{process.stderr.write(error.message);process.exitCode=1});`;
    return new Promise((resolve, reject) => {
        const handle = spawn(process.execPath, ['-e', script, directory, id]);
        let output = '', error = '';
        handle.stdout.on('data', chunk => { output += chunk; });
        handle.stderr.on('data', chunk => { error += chunk; });
        handle.on('close', code => code === 0 ? resolve(output) : reject(new Error(error)));
    });
}

test('global configuration round-trips across project contexts and restart without touching model registry', async () => {
    await temporary(async directory => {
        const projectA = join(directory, 'project-a'), projectB = join(directory, 'project-b');
        await mkdir(projectA); await mkdir(projectB);
        const global = join(directory, 'global');
        const ai = new AIRegistryStore(global);
        const modelBefore = await ai.read();
        const first = new MCPServerRegistryStore(global);
        const notifications: number[] = [];
        const second = new MCPServerRegistryStore(global);
        const backend = new MCPServerRegistryBackend(second,
            { notifyMCPServerRegistryChanged(revision) { notifications.push(revision); } });
        try {
            assert.equal((await first.mutate(create('godot', 0))).servers[0].registrationRevision, 1);
            assert.deepEqual((await backend.list()).servers, (await first.read()).servers);
            const reopened = new MCPServerRegistryStore(global);
            assert.deepEqual((await reopened.read()).servers, (await first.read()).servers);
            reopened.dispose();
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Missing external registry event')), 2000);
                const unlisten = second.onChange(snapshot => {
                    if (snapshot.revision === 2) { clearTimeout(timeout); unlisten(); resolve(); }
                });
                void first.mutate({ version: 1, expectedRevision: 1, mutation: { type: 'update', id: 'godot',
                    server: { ...server(), registrationRevision: 1, name: 'Renamed' } } }).catch(reject);
            });
            assert.ok(notifications.includes(2));
            assert.equal((await backend.list()).servers[0].name, 'Renamed');
            assert.deepEqual(await ai.read(), modelBefore);
            assert.deepEqual(await readdir(projectA), []);
            assert.deepEqual(await readdir(projectB), []);
            assert.deepEqual((await readdir(global)).filter(name => name.endsWith('.json')), ['mcp-servers.json']);
        } finally { backend.dispose(); first.dispose(); second.dispose(); ai.dispose(); }
    });
});

test('duplicate, stale, remove and recreate preserve distinct registration generations', async () => {
    await temporary(async directory => {
        const store = new MCPServerRegistryStore(directory);
        try {
            await store.mutate(create('godot', 0));
            await assert.rejects(store.mutate(create('godot', 1)), /Duplicate/);
            await assert.rejects(store.mutate(create('other', 0)), /Stale/);
            await assert.rejects(store.mutate({ version: 1, expectedRevision: 1,
                mutation: { type: 'update', id: 'godot', server: { ...server(), registrationRevision: 9 } } }), /identity changed/);
            const removed = await store.mutate({ version: 1, expectedRevision: 1,
                mutation: { type: 'remove', id: 'godot' } });
            assert.deepEqual(removed.servers, []);
            const installed = await store.mutate(create('godot', 2));
            assert.equal(installed.servers[0].registrationRevision, 3);
        } finally { store.dispose(); }
    });
});

test('two processes race one revision and abandoned lock recovers', async () => {
    await temporary(async directory => {
        await writeFile(join(directory, '.mcp-servers.lock'), '999999999\n');
        const results = await Promise.allSettled([child(directory, 'left'), child(directory, 'right')]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        assert.equal(results.filter(result => result.status === 'rejected').length, 1);
        const store = new MCPServerRegistryStore(directory);
        assert.equal((await store.read()).revision, 1);
        store.dispose();
    });
});

test('corrupt and unsupported bytes refuse reads and mutations without overwrite', async () => {
    await temporary(async directory => {
        const store = new MCPServerRegistryStore(directory);
        await store.mutate(create('godot', 0));
        for (const bytes of ['{broken', JSON.stringify({ version: 2, revision: 1, servers: [] }),
            JSON.stringify({ version: 1, revision: 1, servers: [{ ...server(), registrationRevision: 1, secret: 'BAD' }] })]) {
            await writeFile(store.path, bytes);
            await assert.rejects(store.read(), /Corrupt or unsupported/);
            await assert.rejects(store.mutate(create('other', 1)), /Corrupt or unsupported/);
            assert.equal(await readFile(store.path, 'utf8'), bytes);
        }
        await rm(store.path);
        await assert.rejects(store.read(), /Missing initialized/);
        store.dispose();
    });
});

test('stdio only, bounded paths and unknown secret fields are refused', () => {
    const valid = { ...server(), registrationRevision: 1 };
    assert.equal(parseMCPServer(valid).config.transport, 'stdio');
    for (const bad of [
        { ...valid, config: { transport: 'http', endpoint: 'https://example.com' } },
        { ...valid, config: { transport: 'stdio', command: 'godot-editor-mcp', args: [] } },
        { ...valid, config: { transport: 'stdio', command: '/bin/../bad', args: [] } },
        { ...valid, config: { transport: 'stdio', command: '/bin/true', args: Array(33).fill('x') } },
        { ...valid, password: 'plaintext' },
        { ...valid, credential: { source: 'environment', name: 'TOKEN' } }
    ]) assert.throws(() => parseMCPServer(bad));
    assert.throws(() => parseMCPServerRegistrySnapshot({ version: 1, revision: 1,
        servers: [valid, valid] }), /Duplicate/);
});

test('isolated bridge profile requires a bounded loopback port and secure token reference', () => {
    const valid = { ...server(), registrationRevision: 1,
        config: { ...server().config, launch: { mode: 'isolated-loopback-bridge',
            installRoot: '/home/user/.local/share/uv/tools/godot-editor-mcp', bridgePort: 9081,
            environment: { bridgeUrl: 'MCP_BRIDGE_URL', bridgeToken: 'MCP_BRIDGE_TOKEN',
                projectRoot: 'MCP_PROJECT_ROOT' } } },
        credential: { source: 'secure', account: 'godot' } };
    assert.equal(parseMCPServer(valid).config.launch?.bridgePort, 9081);
    for (const bad of [
        { ...valid, credential: undefined },
        { ...valid, config: { ...valid.config, launch: { ...valid.config.launch, bridgePort: 0 } } },
        { ...valid, config: { ...valid.config, launch: { ...valid.config.launch, bridgePort: 65536 } } },
        { ...valid, config: { ...valid.config, launch: { ...valid.config.launch, installRoot: '/home/../tmp' } } },
        { ...valid, config: { ...valid.config, launch: { ...valid.config.launch,
            environment: { ...valid.config.launch.environment, bridgeToken: 'LD_PRELOAD' } } } },
        { ...valid, config: { ...valid.config, launch: { ...valid.config.launch,
            environment: { ...valid.config.launch.environment, projectRoot: 'MCP_BRIDGE_URL' } } } },
        { ...valid, config: { ...valid.config, launch: { ...valid.config.launch, endpoint: '0.0.0.0' } } }
    ]) assert.throws(() => parseMCPServer(bad));
});

test('credential references require OS secure storage and never persist the secret', async () => {
    await temporary(async directory => {
        const missing = new MCPServerRegistryStore(directory, async () => undefined);
        const configured = { ...server(), credential: { source: 'secure' as const, account: 'godot' } };
        try {
            await assert.rejects(missing.mutate({ version: 1, expectedRevision: 0,
                mutation: { type: 'create', server: configured } }), /secure storage unavailable/);
            assert.deepEqual(await readdir(directory), []);
            await missing.mutate(create('godot', 0));
            await assert.rejects(missing.replaceBridgeToken('godot', 1,
                'test-only-secure-bridge-token-with-40-chars'), /secure storage unavailable/);
            assert.equal((await missing.read()).revision, 1);
        } finally { missing.dispose(); }
        const secureDirectory = join(directory, 'secure');
        await mkdir(secureDirectory, { mode: 0o700 });
        const secure = new MCPServerRegistryStore(secureDirectory, async () => ({
            getPassword: async () => 'sensitive-value', setPassword: async () => {},
            deletePassword: async () => {}, findCredentials: async () => [] }));
        try {
            await secure.mutate({ version: 1, expectedRevision: 0, mutation: { type: 'create', server: configured } });
            const bytes = await readFile(secure.path, 'utf8');
            assert.ok(bytes.includes('"account": "godot"'));
            assert.ok(!bytes.includes('sensitive-value'));
        } finally { secure.dispose(); }
    });
});

test('explicit bridge-token setup is revision-safe, secret-free in catalog and rotation requires disablement', async () => {
    await temporary(async directory => {
        const passwords = new Map<string, string>();
        const store = new MCPServerRegistryStore(directory, async () => ({
            getPassword: async (_service, account) => passwords.get(account),
            setPassword: async (_service, account, secret) => { passwords.set(account, secret); },
            deletePassword: async (_service, account) => { passwords.delete(account); },
            findCredentials: async () => [] }));
        const firstToken = 'first-secure-bridge-token-with-thirty-two-chars';
        const secondToken = 'second-secure-bridge-token-with-thirty-two-chars';
        try {
            await store.mutate(create('godot', 0));
            assert.equal(await store.bridgeCredentialStatus('godot'), 'missing');
            await assert.rejects(store.replaceBridgeToken('godot', 0, firstToken), /Stale/);
            await assert.rejects(store.replaceBridgeToken('godot', 1, 'weak'), /Invalid/);
            const configured = await store.replaceBridgeToken('godot', 1, firstToken);
            assert.equal(configured.revision, 2);
            assert.equal(await store.bridgeCredentialStatus('godot'), 'available');
            assert.ok(!(await readFile(store.path, 'utf8')).includes(firstToken));
            const launch = { mode: 'isolated-loopback-bridge' as const,
                installRoot: '/home/user/.local/share/uv/tools/godot-editor-mcp', bridgePort: 9081,
                environment: { bridgeUrl: 'MCP_BRIDGE_URL', bridgeToken: 'MCP_BRIDGE_TOKEN',
                    projectRoot: 'MCP_PROJECT_ROOT' } };
            await store.mutate({ version: 1, expectedRevision: 2, mutation: { type: 'update', id: 'godot',
                server: { ...configured.servers[0], config: { ...configured.servers[0].config, launch } } } });
            await assert.rejects(store.replaceBridgeToken('godot', 3, secondToken), /Disable/);
            assert.equal(await store.readBridgeToken('godot'), firstToken);
            const disabled = await store.mutate({ version: 1, expectedRevision: 3,
                mutation: { type: 'update', id: 'godot',
                    server: { ...(await store.read()).servers[0], lifecycle: 'disabled' } } });
            await store.replaceBridgeToken('godot', disabled.revision, secondToken);
            assert.equal(await store.readBridgeToken('godot'), secondToken);
            assert.ok(!(await readFile(store.path, 'utf8')).includes(secondToken));
        } finally { store.dispose(); }
    });
});
