import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { MCPChatObservation } from '../../packages/theia-extension/lib/node/mcp-chat-observation.js';
import { mcpProjectKey } from '../../packages/theia-extension/lib/node/mcp-project-preferences-store.js';

test('Chat MCP broker checks approval, current project, server revision and arguments before dispatch', async () => {
    const root = await mkdtemp(join(process.cwd(), 'dope-mcp-chat-'));
    try {
        const key = await mcpProjectKey(root);
        const discovery = { transport: 'stdio', serverId: 'godot', registrationRevision: 4,
            projectKey: key, manifestRevision: 'a'.repeat(64), protocolVersion: '2025-06-18',
            tools: [{ name: 'godot_get_server_info', inputSchema: { type: 'object', properties: {} } }] };
        let enabled = true, registrationRevision = 4, activeRoot = root, calls = 0;
        const registry = { readBridgeToken: async () => 'secret-token-with-at-least-thirty-two-characters',
            read: async () => ({ servers: [{ id: 'godot', registrationRevision,
            lifecycle: 'installed', configStatus: 'configured' }] }) };
        const preferences = { read: async () => ({ preferences: enabled ? [{ projectKey: key,
            serverId: 'godot', registrationRevision: 4, enabled: true }] : [] }) };
        const transport = { status: () => ({ state: 'discovered' }),
            observe: async (_discovery: unknown, name: string, _signal: unknown, onDispatch: () => void) => {
                onDispatch?.(); calls++; assert.equal(name, 'godot_get_server_info');
                return '{"content":["ok secret-token-with-at-least-thirty-two-characters"]}';
            }, close: async () => {} };
        const descriptor = { name: 'mcp_godot_server_info', description: 'Observed',
            parameters: { type: 'object', properties: {}, additionalProperties: false } };
        const broker = new (MCPChatObservation as any)([descriptor], { dispose() {} }, transport,
            discovery, root, registry, preferences, new AbortController().signal) as MCPChatObservation;
        const run = (name: string, args: unknown, approved = async () => true) =>
            broker.execute(name, args, approved, () => activeRoot);
        const result = await run(descriptor.name, {});
        assert.match(result, /ok/);
        assert.doesNotMatch(result, /secret-token/);
        assert.equal(calls, 1);
        await assert.rejects(run('mcp_godot_scene_write', {}), /denied/);
        await assert.rejects(run(descriptor.name, { command: 'touch scene.tscn' }), /denied/);
        await assert.rejects(run(descriptor.name, {}, async () => false), /approval/);
        assert.equal(calls, 1);
        activeRoot = '/wrong-project';
        await assert.rejects(run(descriptor.name, {}), /project changed/);
        activeRoot = root; enabled = false;
        await assert.rejects(run(descriptor.name, {}), /revoked/);
        enabled = true; registrationRevision = 5;
        await assert.rejects(run(descriptor.name, {}), /revoked/);
        assert.equal(calls, 1);
        await broker.close();
    } finally { await rm(root, { recursive: true, force: true }); }
});
