import assert from 'node:assert/strict';
import { createConnection, createServer, type Socket } from 'node:net';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { launchContainedMCPServer } from '../../packages/theia-extension/lib/node/mcp-contained-launch.js';
import { mcpProjectKey } from '../../packages/theia-extension/lib/node/mcp-project-preferences-store.js';
import { MCPProjectPreferencesStore } from '../../packages/theia-extension/lib/node/mcp-project-preferences-store.js';
import { MCPServerRegistryStore } from '../../packages/theia-extension/lib/node/mcp-server-registry-store.js';
import { MCPProjectActivationBackend } from '../../packages/theia-extension/lib/node/mcp-project-activation-backend.js';

let port = 0;
async function availablePort(): Promise<number> {
    const listener = createServer();
    await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
    const selected = (listener.address() as { port: number }).port;
    await new Promise<void>(resolve => listener.close(() => resolve()));
    return selected;
}
const token = 'canary-token-with-at-least-thirty-two-characters';
const environment = { bridgeUrl: 'GODOT_MCP_BRIDGE_URL', bridgeToken: 'GODOT_MCP_BRIDGE_TOKEN',
    projectRoot: 'GODOT_MCP_PROJECT_DIR' };
const fake = `#!/usr/bin/python3
import os, pathlib, resource, socket, sys, threading
root=pathlib.Path('/work')
checks={}
checks['project_read']=root.joinpath('visible').read_text()=='project-data'
checks['project_write_denied']=False
try: root.joinpath('new-file').write_text('bad')
except OSError: checks['project_write_denied']=True
checks['secret_denied']=not root.joinpath('.env').is_file()
checks['outside_denied']=not pathlib.Path(__HOST_SECRET__).is_file()
checks['symlink_escape_denied']=not root.joinpath('link-out').is_file()
try: pathlib.Path(__HOST_SECRET__).write_text('intrusion')
except OSError: pass
try: root.joinpath('link-out').write_text('intrusion')
except OSError: pass
checks['egress_denied']=False
try: socket.create_connection(('1.1.1.1',80),timeout=.2)
except OSError: checks['egress_denied']=True
checks['resource_limits']=resource.getrlimit(resource.RLIMIT_NOFILE)[0]<=128 and resource.getrlimit(resource.RLIMIT_FSIZE)[0]<=67108864 and resource.getrlimit(resource.RLIMIT_CPU)[0]<=60 and resource.getrlimit(resource.RLIMIT_AS)[0]<=4294967296
checks['environment']=os.environ.get('GODOT_MCP_PROJECT_DIR')=='/work' and os.environ.get('GODOT_MCP_TRANSPORT') is None and os.environ.get('GODOT_MCP_CHECK_UPDATES') is None
assert all(checks.values()), checks
s=socket.socket(); s.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1); s.bind(('127.0.0.1',int(os.environ['GODOT_MCP_BRIDGE_URL'].rsplit(':',1)[1]))); s.listen(2)
def bridge():
 while True:
  c,_=s.accept(); data=c.recv(512).decode().strip(); c.sendall(b'authorized' if data==os.environ['GODOT_MCP_BRIDGE_TOKEN'] else b'denied'); c.close()
threading.Thread(target=bridge,daemon=True).start()
print('READY',flush=True)
for line in sys.stdin:
 print('reply:'+line.strip(),flush=True)
`;

async function bridgeRequest(message: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const socket = createConnection({ host: '127.0.0.1', port });
        let output = '';
        socket.setTimeout(1500, () => socket.destroy(new Error('bridge timeout')));
        socket.on('connect', () => socket.write(message + '\n'));
        socket.on('data', chunk => { output += chunk; });
        socket.on('end', () => { socket.destroy(); resolve(output); });
        socket.on('error', reject);
    });
}

test('private bridge is authenticated, confined, bounded and revoked on project switch', async () => {
    port = await availablePort();
    const base = process.cwd();
    await mkdir(base, { recursive: true });
    const temporary = await mkdtemp(join(base, 'dope-mcp-canary-'));
    const installRoot = join(temporary, 'tools', 'fake');
    const projectRoot = join(temporary, 'project');
    const command = join(installRoot, 'bin', 'fake-mcp');
    const hostSecret = join(temporary, 'host-secret');
    const controller = new AbortController();
    try {
        await mkdir(join(installRoot, 'bin'), { recursive: true });
        await mkdir(projectRoot);
        await writeFile(command, fake.replaceAll('__HOST_SECRET__', JSON.stringify(hostSecret)));
        await chmod(command, 0o700);
        await writeFile(hostSecret, 'host-secret');
        await writeFile(join(projectRoot, 'visible'), 'project-data');
        await writeFile(join(projectRoot, '.env'), 'project-secret');
        await symlink(hostSecret, join(projectRoot, 'link-out'));
        const projectKey = await mcpProjectKey(projectRoot);
        await assert.rejects(launchContainedMCPServer({ command, installRoot, projectRoot,
            projectKey: '0'.repeat(64), bridgePort: port, bridgeToken: token, environment }), /project identity changed/);
        const session = await launchContainedMCPServer({ command, installRoot, projectRoot,
            projectKey, bridgePort: port, bridgeToken: token, environment, signal: controller.signal, maxLifetimeMs: 10000 });
        let output = '';
        let diagnostics = '';
        session.stdio.stdout!.on('data', chunk => { output += chunk; });
        session.stdio.stderr!.on('data', chunk => { diagnostics += chunk; });
        try {
            for (let attempt = 0; !output.includes('READY') && attempt < 100; attempt++)
                await new Promise(resolve => setTimeout(resolve, 20));
            assert.match(output, /READY/, diagnostics);
            assert.equal(await bridgeRequest('wrong-token'), 'denied');
            assert.equal(await bridgeRequest(token), 'authorized');
            session.stdio.stdin!.write('ping\n');
            for (let attempt = 0; !output.includes('reply:ping') && attempt < 100; attempt++)
                await new Promise(resolve => setTimeout(resolve, 20));
            assert.match(output, /reply:ping/);
            controller.abort();
            await session.exited;
            await assert.rejects(bridgeRequest(token));
            assert.equal(await readFile(join(projectRoot, 'visible'), 'utf8'), 'project-data');
            assert.equal(await readFile(join(projectRoot, '.env'), 'utf8'), 'project-secret');
            assert.equal(await readFile(hostSecret, 'utf8'), 'host-secret');
        } finally { await session.close(); }
    } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('uv tool mounts only its resolved Python runtime and rejects an unrelated interpreter', async () => {
    port = await availablePort();
    const temporary = await mkdtemp(join(process.cwd(), 'dope-mcp-uv-'));
    const uvRoot = join(temporary, 'uv');
    const installRoot = join(uvRoot, 'tools', 'fake');
    const runtimeRoot = join(uvRoot, 'python', 'cpython-test-3.13');
    const runtimeAlias = join(uvRoot, 'python', 'cpython-test');
    const projectRoot = join(temporary, 'project');
    const interpreter = join(installRoot, 'bin', 'python');
    const command = join(installRoot, 'bin', 'fake-mcp');
    const hostSecret = join(temporary, 'host-secret');
    try {
        await mkdir(join(installRoot, 'bin'), { recursive: true });
        await mkdir(join(runtimeRoot, 'bin'), { recursive: true });
        await mkdir(projectRoot);
        await writeFile(join(runtimeRoot, 'bin', 'python3'), '#!/bin/sh\nexec /usr/bin/python3 "$@"\n');
        await chmod(join(runtimeRoot, 'bin', 'python3'), 0o700);
        await symlink(runtimeRoot, runtimeAlias);
        await symlink(join(runtimeAlias, 'bin', 'python3'), interpreter);
        await writeFile(command, fake.replace('#!/usr/bin/python3', `#!${interpreter}`)
            .replaceAll('__HOST_SECRET__', JSON.stringify(hostSecret)));
        await chmod(command, 0o700);
        await writeFile(hostSecret, 'host-secret');
        await writeFile(join(projectRoot, 'visible'), 'project-data');
        await writeFile(join(projectRoot, '.env'), 'project-secret');
        const policy = { command, installRoot, projectRoot,
            projectKey: await mcpProjectKey(projectRoot), bridgePort: port, bridgeToken: token, environment };
        const session = await launchContainedMCPServer(policy);
        try {
            let output = '';
            session.stdio.stdout!.on('data', chunk => { output += chunk; });
            for (let attempt = 0; !output.includes('READY') && attempt < 100; attempt++)
                await new Promise(resolve => setTimeout(resolve, 20));
            assert.match(output, /READY/);
            assert.equal(await bridgeRequest(token), 'authorized');
        } finally { await session.close(); }
        await rm(interpreter);
        await symlink('/usr/bin/python3', interpreter);
        await assert.rejects(launchContainedMCPServer(policy), /interpreter outside narrow installation/);
        assert.equal(await readFile(hostSecret, 'utf8'), 'host-secret');
    } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('trusted project switch revokes the registered server session', async () => {
    port = await availablePort();
    const base = process.cwd();
    await mkdir(base, { recursive: true });
    const temporary = await mkdtemp(join(base, 'dope-mcp-switch-'));
    const installRoot = join(temporary, 'tools', 'fake');
    const projectRoot = join(temporary, 'project-a');
    const otherRoot = join(temporary, 'project-b');
    const command = join(installRoot, 'bin', 'fake-mcp');
    const hostSecret = join(temporary, 'host-secret');
    const global = join(temporary, 'global');
    await mkdir(join(installRoot, 'bin'), { recursive: true });
    await mkdir(projectRoot); await mkdir(otherRoot); await mkdir(global, { mode: 0o700 });
    await writeFile(command, fake.replaceAll('__HOST_SECRET__', JSON.stringify(hostSecret)));
    await chmod(command, 0o700); await writeFile(hostSecret, 'host-secret');
    await writeFile(join(projectRoot, 'visible'), 'project-data');
    await writeFile(join(projectRoot, '.env'), 'project-secret');
    const secure = async () => ({ getPassword: async () => token,
        setPassword: async () => {}, deletePassword: async () => {}, findCredentials: async () => [] });
    const registry = new MCPServerRegistryStore(global, secure);
    const preferences = new MCPProjectPreferencesStore(global);
    let trustedRoot = otherRoot;
    const activation = new MCPProjectActivationBackend(preferences, registry,
        { notifyMCPProjectActivationChanged() {} }, async () => trustedRoot);
    const noRootAuthority = new MCPProjectActivationBackend(preferences, registry,
        { notifyMCPProjectActivationChanged() {} });
    try {
        const saved = await registry.mutate({ version: 1, expectedRevision: 0, mutation: { type: 'create',
            server: { version: 1, id: 'fake', name: 'Fake', lifecycle: 'installed', configStatus: 'configured',
                config: { transport: 'stdio', command, args: [], launch: {
                    mode: 'isolated-loopback-bridge', installRoot, bridgePort: port, environment } },
                credential: { source: 'secure', account: 'fake' } } } });
        const current = await activation.switchProject(projectRoot);
        await activation.setEnabled({ projectKey: current.projectKey!, serverId: 'fake',
            registrationRevision: saved.servers[0].registrationRevision,
            expectedRevision: current.preferencesRevision, enabled: true });
        await noRootAuthority.switchProject(projectRoot);
        await assert.rejects(noRootAuthority.launchContained('fake'), /No trusted active MCP project/);
        await assert.rejects(activation.launchContained('fake'), /active project mismatch/);
        trustedRoot = projectRoot;
        const session = await activation.launchContained('fake');
        try {
            await activation.switchProject(otherRoot);
            trustedRoot = otherRoot;
            await session.exited;
            await assert.rejects(bridgeRequest(token));
        await assert.rejects(activation.launchContained('fake'), /unavailable/);
        } finally { await session.close(); }
        await activation.switchProject(projectRoot);
        trustedRoot = projectRoot;
        const second = await activation.launchContained('fake');
        try {
            await registry.mutate({ version: 1, expectedRevision: 1,
                mutation: { type: 'remove', id: 'fake' } });
            await second.exited;
            await assert.rejects(bridgeRequest(token));
        } finally { await second.close(); }
    } finally {
        noRootAuthority.dispose(); activation.dispose(); registry.dispose(); preferences.dispose();
        await rm(temporary, { recursive: true, force: true });
    }
});

test('lifetime expiry and early child exit release the host port and private socket', async () => {
    port = await availablePort();
    const base = process.cwd();
    await mkdir(base, { recursive: true });
    const temporary = await mkdtemp(join(base, 'dope-mcp-exit-'));
    const installRoot = join(temporary, 'tools', 'fake');
    const projectRoot = join(temporary, 'project');
    const command = join(installRoot, 'bin', 'fake-mcp');
    const hostSecret = join(temporary, 'host-secret');
    try {
        await mkdir(join(installRoot, 'bin'), { recursive: true });
        await mkdir(projectRoot);
        await writeFile(join(projectRoot, 'visible'), 'project-data');
        await writeFile(join(projectRoot, '.env'), 'project-secret');
        await writeFile(command, fake.replaceAll('__HOST_SECRET__', JSON.stringify(hostSecret)));
        await chmod(command, 0o700); await writeFile(hostSecret, 'host-secret');
        const policy = { command, installRoot, projectRoot, projectKey: await mcpProjectKey(projectRoot),
            bridgePort: port, bridgeToken: token, environment };
        const session = await launchContainedMCPServer({ ...policy, maxLifetimeMs: 1000 });
        await session.exited;
        await assert.rejects(bridgeRequest(token));
        await writeFile(command, '#!/usr/bin/python3\nprint("done", flush=True)\n');
        try {
            const short = await launchContainedMCPServer({ ...policy, maxLifetimeMs: 1000 });
            await short.exited;
            await assert.rejects(bridgeRequest(token));
        } catch (error) {
            assert.match(String(error), /isolated process exited during startup|private bridge did not start/);
        }
    } finally { await rm(temporary, { recursive: true, force: true }); }
});

test('occupied host port and executable escape fail closed without replacing the listener', async () => {
    port = await availablePort();
    const base = process.cwd();
    await mkdir(base, { recursive: true });
    const temporary = await mkdtemp(join(base, 'dope-mcp-deny-'));
    const installRoot = join(temporary, 'tools', 'fake');
    const projectRoot = join(temporary, 'project');
    const command = join(installRoot, 'bin', 'fake-mcp');
    const hostSecret = join(temporary, 'host-secret');
    const occupantPeers = new Set<Socket>();
    const occupant = createServer(socket => {
        occupantPeers.add(socket); socket.on('close', () => occupantPeers.delete(socket));
        socket.end('occupied');
    });
    try {
        await mkdir(join(installRoot, 'bin'), { recursive: true });
        await mkdir(projectRoot);
        await writeFile(join(projectRoot, 'visible'), 'project-data');
        await writeFile(join(projectRoot, '.env'), 'project-secret');
        await writeFile(command, fake.replaceAll('__HOST_SECRET__', JSON.stringify(hostSecret)));
        await chmod(command, 0o700); await writeFile(hostSecret, 'host-secret');
        const policy = { command, installRoot, projectRoot, projectKey: await mcpProjectKey(projectRoot),
            bridgePort: port, bridgeToken: token, environment };
        await new Promise<void>(resolve => occupant.listen(port, '127.0.0.1', resolve));
        await assert.rejects(launchContainedMCPServer(policy), /containment unavailable/);
        assert.equal(await bridgeRequest('x'), 'occupied');
        await symlink('/usr/bin/true', join(installRoot, 'bin', 'escape'));
        await assert.rejects(launchContainedMCPServer({ ...policy,
            command: join(installRoot, 'bin', 'escape') }), /outside a canonical narrow installation/);
    } finally {
        for (const peer of occupantPeers) peer.destroy();
        if (occupant.listening) await new Promise<void>(resolve => occupant.close(() => resolve()));
        await rm(temporary, { recursive: true, force: true });
    }
});
