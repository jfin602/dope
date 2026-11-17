import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readdir, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { MCPServerRegistryStore } from '../../packages/theia-extension/lib/node/mcp-server-registry-store.js';
import { MCPProjectPreferencesStore, mcpProjectKey } from '../../packages/theia-extension/lib/node/mcp-project-preferences-store.js';
import { MCPProjectActivationBackend } from '../../packages/theia-extension/lib/node/mcp-project-activation-backend.js';

const server = { version: 1 as const, id: 'godot', name: 'Godot', lifecycle: 'installed' as const,
    configStatus: 'configured' as const, config: { transport: 'stdio' as const, command: '/bin/true', args: [] } };
test('project selection is machine-local, off by default, revision-safe and revokes across projects', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-mcp-project-'));
    const a = join(root, 'a'), b = join(root, 'b'), c = join(root, 'c'), config = join(root, 'config');
    await Promise.all([mkdir(a), mkdir(b), mkdir(c)]);
    const registry = new MCPServerRegistryStore(config), store = new MCPProjectPreferencesStore(config);
    const events: Array<{ kind: string; revokePrevious: boolean; generation: number }> = [];
    const client = { notifyMCPProjectActivationChanged(event: typeof events[number]) { events.push(event); } };
    const first = new MCPProjectActivationBackend(store, registry, client);
    const secondStore = new MCPProjectPreferencesStore(config);
    const second = new MCPProjectActivationBackend(secondStore, registry, client);
    try {
        const created = await registry.mutate({ version: 1, expectedRevision: 0,
            mutation: { type: 'create', server } });
        const registrationRevision = created.servers[0].registrationRevision;
        const initialA = await first.switchProject(a);
        assert.equal(initialA.servers[0].state, 'disabled');
        const initialB = await second.switchProject(b);
        assert.equal(initialB.servers[0].eligible, false);
        const activeA = await first.setEnabled({ projectKey: initialA.projectKey!, serverId: 'godot',
            registrationRevision, expectedRevision: initialA.preferencesRevision, enabled: true });
        assert.equal(activeA.servers[0].state, 'active');
        await assert.rejects(second.setEnabled({ projectKey: initialA.projectKey!, serverId: 'godot',
            registrationRevision, expectedRevision: initialB.preferencesRevision, enabled: true }), /context mismatch/);
        await assert.rejects(second.setEnabled({ projectKey: initialB.projectKey!, serverId: 'godot',
            registrationRevision, expectedRevision: initialB.preferencesRevision, enabled: true }), /Stale/);
        assert.equal((await second.current()).servers[0].eligible, false);
        const switched = await first.switchProject(b);
        assert.equal(switched.servers[0].eligible, false);
        assert.ok(events.some(event => event.kind === 'project-switch' && event.revokePrevious));
        assert.equal((await first.switchProject(c)).servers[0].eligible, false);
        const restarted = new MCPProjectPreferencesStore(config);
        const again = new MCPProjectActivationBackend(restarted, registry, client);
        assert.equal((await again.switchProject(a)).servers[0].eligible, true);
        const disabled = await registry.mutate({ version: 1, expectedRevision: created.revision,
            mutation: { type: 'remove', id: 'godot' } });
        assert.equal((await again.current()).servers[0].state, 'uninstalled');
        const reinstalled = await registry.mutate({ version: 1, expectedRevision: disabled.revision,
            mutation: { type: 'create', server } });
        assert.notEqual(reinstalled.servers[0].registrationRevision, registrationRevision);
        assert.equal((await again.current()).servers[0].eligible, false);
        await assert.rejects(again.setEnabled({ projectKey: (await again.current()).projectKey!,
            serverId: 'godot', registrationRevision, expectedRevision: (await again.current()).preferencesRevision,
            enabled: true }), /registration changed/);
        assert.deepEqual(await readdir(a), []);
        assert.deepEqual(await readdir(b), []);
        assert.deepEqual(await readdir(c), []);
        again.dispose(); restarted.dispose();
    } finally { first.dispose(); second.dispose(); store.dispose(); secondStore.dispose(); registry.dispose();
        await rm(root, { recursive: true, force: true }); }
});

test('root aliases and symlinks cannot share a project selection', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-mcp-root-'));
    const project = join(root, 'project'), alias = join(root, 'alias');
    try {
        await mkdir(project); await symlink(project, alias);
        assert.match(await mcpProjectKey(project), /^[a-f0-9]{64}$/);
        await assert.rejects(mcpProjectKey(alias), /Unsafe/);
        await assert.rejects(mcpProjectKey(`${project}/../project`), /Unsafe/);
        await assert.rejects(mcpProjectKey('project'), /Unsafe/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
