import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { createMCPObservationExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { MCPServerRegistryStore } from '../../packages/theia-extension/lib/node/mcp-server-registry-store.js';
import { MCPProjectPreferencesStore, mcpProjectKey } from '../../packages/theia-extension/lib/node/mcp-project-preferences-store.js';
import { WorkMCPObservationAuthority } from '../../packages/theia-extension/lib/node/mcp-work-observation.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';

test('Work MCP offer requires global install, secure credential, explicit exact project and reviewed method', async () => {
    const base = await mkdtemp(join(process.cwd(), '.dope-work-mcp-authority-'));
    const root = join(base, 'project'), other = join(base, 'other'), global = join(base, 'global');
    await mkdir(root); await mkdir(other); await mkdir(global, { mode: 0o700 });
    const passwords = new Map<string, string>();
    const registry = new MCPServerRegistryStore(global, async () => ({
        getPassword: async (_service, account) => passwords.get(account),
        setPassword: async (_service, account, value) => { passwords.set(account, value); },
        deletePassword: async (_service, account) => { passwords.delete(account); },
        findCredentials: async () => [] }));
    const preferences = new MCPProjectPreferencesStore(global);
    const authority = new WorkMCPObservationAuthority(registry, preferences);
    try {
        assert.equal(await authority.offer(root, 'local', 'model'), undefined, 'no global install');
        await registry.mutate({ version: 1, expectedRevision: 0, mutation: { type: 'create', server: {
            version: 1, id: 'godot', name: 'Fixture', lifecycle: 'installed', configStatus: 'configured',
            config: { transport: 'stdio', command: '/usr/bin/true', args: [] } } } });
        assert.equal(await authority.offer(root, 'local', 'model'), undefined, 'no secure token');
        await registry.mutate({ version: 1, expectedRevision: 1, mutation: { type: 'update', id: 'godot',
            server: { ...(await registry.read()).servers[0], lifecycle: 'disabled' } } });
        await registry.replaceBridgeToken('godot', 2, 'fixture-secure-bridge-token-with-forty-characters');
        await registry.mutate({ version: 1, expectedRevision: 3, mutation: { type: 'update', id: 'godot',
            server: { ...(await registry.read()).servers[0], lifecycle: 'installed', config: {
                transport: 'stdio', command: '/usr/bin/true', args: [], launch: {
                    mode: 'isolated-loopback-bridge', installRoot: '/usr/bin', bridgePort: 9081,
                    environment: { bridgeUrl: 'GODOT_MCP_BRIDGE_URL', bridgeToken: 'GODOT_MCP_BRIDGE_TOKEN',
                        projectRoot: 'GODOT_MCP_PROJECT_DIR' } } } } } });
        assert.equal(await authority.offer(root, 'local', 'model'), undefined, 'project off');
        const key = await mcpProjectKey(root);
        await preferences.mutate({ version: 1, expectedRevision: 0, projectKey: key,
            serverId: 'godot', registrationRevision: 1, enabled: true });
        const offered = await authority.offer(root, 'local', 'model');
        assert.ok(offered);
        assert.equal(offered.toolName, 'godot_get_server_info');
        assert.equal(await authority.offer(other, 'local', 'model'), undefined, 'wrong project');
        const grant = createMCPObservationExecutionGrant({ id: 'grant', revision: 1, taskId: 'task',
            acceptedAt: new Date().toISOString(), mcpObservation: offered });
        await authority.assertScope(root, grant, 'local', 'model');
        const mutatingGrant = createMCPObservationExecutionGrant({ id: 'mutating', revision: 1,
            taskId: 'task', acceptedAt: new Date().toISOString(),
            mcpObservation: { ...offered, toolName: 'godot_scene_write' } });
        await assert.rejects(authority.assertScope(root, mutatingGrant, 'local', 'model'), /scope unavailable/);
        await assert.rejects(authority.assertScope(other, grant, 'local', 'model'));
        await assert.rejects(authority.assertScope(root, grant, 'wrong', 'model'));
        await assert.rejects(authority.assertScope(root, grant, 'local', 'wrong'));
        await registry.mutate({ version: 1, expectedRevision: 4, mutation: { type: 'update', id: 'godot',
            server: { ...(await registry.read()).servers[0], name: 'Changed server identity' } } });
        await assert.rejects(authority.assertScope(root, grant, 'local', 'model'), /server or project/);
        await preferences.mutate({ version: 1, expectedRevision: 1, projectKey: key,
            serverId: 'godot', registrationRevision: 1, enabled: false });
        assert.equal(await authority.offer(root, 'local', 'model'), undefined, 'disabled after start');
    } finally { authority.dispose(); registry.dispose(); preferences.dispose();
        await rm(base, { recursive: true, force: true }); }
});

test('one pending Work MCP approval is tied to run, task, grant and abort', async () => {
    const scope = { projectKey: 'a'.repeat(64), serverId: 'godot', registrationRevision: 1,
        catalogRevision: 4, toolName: 'godot_get_server_info', connectionId: 'local', modelId: 'model',
        maxCalls: 1 as const, expiresAt: new Date(Date.now() + 600_000).toISOString() };
    const grant = createMCPObservationExecutionGrant({ id: 'grant', revision: 1, taskId: 'task',
        acceptedAt: new Date().toISOString(), mcpObservation: scope });
    const current = { grantId: grant.id, grantRevision: grant.revision, taskId: grant.taskId,
        projectKey: scope.projectKey, serverId: scope.serverId,
        registrationRevision: scope.registrationRevision, catalogRevision: scope.catalogRevision,
        toolName: scope.toolName, connectionId: scope.connectionId, modelId: scope.modelId,
        workspaceId: 'candidate', candidateFingerprint: 'b'.repeat(64), callId: 'pi-1' };
    const authority = new WorkMCPObservationAuthority({} as never, {} as never);
    try {
        const signal = new AbortController();
        const pending = authority.request('/project', 'run', grant, current, signal.signal);
        const [view] = authority.list('/project');
        assert.equal(view.runId, 'run');
        assert.equal(await authority.request('/project', 'second-run', grant,
            { ...current, callId: 'pi-2' }, new AbortController().signal), undefined,
        'a simultaneous second request cannot replace the first pending approval');
        assert.equal(authority.list('/project')[0].id, view.id);
        assert.throws(() => authority.decide('/project', 'wrong-run', view.id, true));
        assert.throws(() => authority.decide('/other', 'run', view.id, true));
        authority.decide('/project', 'run', view.id, true);
        const approval = await pending;
        assert.equal(approval?.approvedBy, 'developer');
        assert.equal(approval?.candidateFingerprint, current.candidateFingerprint);
        assert.deepEqual(authority.list('/project'), []);
        const cancelled = new AbortController();
        const waiting = authority.request('/project', 'run', grant, current, cancelled.signal);
        cancelled.abort();
        assert.equal(await waiting, undefined);
        const denied = authority.request('/project', 'run', grant, current, new AbortController().signal);
        authority.decide('/project', 'run', authority.list('/project')[0].id, false);
        assert.equal(await denied, undefined);
        const revoked = authority.request('/project', 'run', grant, current, new AbortController().signal);
        authority.revoke('/project');
        assert.equal(await revoked, undefined);
    } finally { authority.dispose(); }
});

test('Work approval RPC is bound to one project handle and current run; project switch revokes', async () => {
    const revoked: string[] = [], decisions: unknown[][] = [];
    const authority = { onChange() { return () => {}; }, offer: async () => undefined,
        list: () => [], revoke(root: string) { revoked.push(root); },
        decide(...args: unknown[]) { decisions.push(args); } };
    const store = { onChange() { return () => {}; }, root: async (uri: string) => uri,
        listSequences: async () => [] };
    const execution = { reconcile: async () => {}, activeRunId: () => 'run' };
    const backend = new AgentRuntimeBackend(store as never, { notifyAgentStateChanged() {} },
        execution as never, undefined, authority as never);
    try {
        const first = await backend.attach('/project-a');
        await assert.rejects(backend.decideWorkMCPObservation('wrong-handle', 'run', 'request', true));
        await assert.rejects(backend.decideWorkMCPObservation(first.projectHandle, 'other-run', 'request', true));
        await backend.decideWorkMCPObservation(first.projectHandle, 'run', 'request', true);
        assert.deepEqual(decisions, [['/project-a', 'run', 'request', true]]);
        const second = await backend.attach('/project-b');
        assert.deepEqual(revoked, ['/project-a']);
        await assert.rejects(backend.pendingWorkMCPObservations(first.projectHandle));
        assert.deepEqual(await backend.pendingWorkMCPObservations(second.projectHandle), []);
    } finally { backend.dispose(); }
});
