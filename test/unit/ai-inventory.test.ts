import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ModelRuntimeFailure } from '../../packages/contracts/lib/model-runtime.js';
import { AIRegistryStore } from '../../packages/theia-extension/lib/node/ai-registry-store.js';
import { AIInventoryController, AIRegistryBackend } from '../../packages/theia-extension/lib/node/ai-registry-backend.js';
import { AICredentialManager } from '../../packages/theia-extension/lib/node/ai-credential-manager.js';
import { ModelConnectionsRegistry } from '../../packages/theia-extension/lib/node/model-connections.js';
import { LocalAgentCapabilityProbe } from '../../packages/theia-extension/lib/node/local-agent-capability.js';

const local = (id: string) => ({ version: 1 as const, id, alias: id, lifecycle: 'enabled' as const,
    config: { type: 'local' as const, runtime: 'lm-studio' as const, endpoint: 'http://127.0.0.1:1234/v1' } });
const loaded = (id: string, contextWindowTokens?: number) => ({ id, label: id,
    capabilities: { conversationalText: !!contextWindowTokens, streaming: !!contextWindowTokens,
        ...(contextWindowTokens ? { contextWindowTokens } : {}) } });

async function fixture(run: (state: { store: AIRegistryStore; controller: AIInventoryController;
    runtime: ModelConnectionsRegistry; credentials: AICredentialManager;
    connectFake: () => Promise<void>;
    change: (models: ReturnType<typeof loaded>[]) => void;
    calls: { messages: unknown; maxOutputTokens?: number }[];
    fail: (error?: Error) => void; generationFail: (error?: Error) => void }) => Promise<void>,
    probe?: LocalAgentCapabilityProbe) {
    const directory = await mkdtemp(join(tmpdir(), 'dope-ai-inventory-'));
    const store = new AIRegistryStore(directory);
    const credentials = new AICredentialManager(store, async () => undefined, {});
    const runtime = new ModelConnectionsRegistry(undefined, store, credentials);
    const controller = new AIInventoryController(store, runtime, credentials, undefined, probe);
    let models = [loaded('alpha', 4096), loaded('beta', 8192)];
    let error: Error | undefined;
    let generationError: Error | undefined;
    const calls: { messages: unknown; maxOutputTokens?: number }[] = [];
    try {
        await store.mutate({ version: 1, expectedRevision: 0, mutation: { type: 'create-connection', connection: local('desk') } });
        const fake = {
            async discoverModels() { if (error) throw error; return models; },
            async *generateConversation(request) {
                calls.push({ messages: request.messages, maxOutputTokens: request.maxOutputTokens });
                if (generationError) throw generationError;
                yield { type: 'complete' as const, text: 'OK', usage: { tokenMeasurement: 'provider-reported' as const,
                    inputTokens: 4, outputTokens: 1 } };
            }
        };
        await runtime.connect('desk', fake);
        await run({ store, controller, runtime, credentials, calls, connectFake: () => runtime.connect('desk', fake),
            change(next) { models = next; },
            fail(next) { error = next; }, generationFail(next) { generationError = next; } });
    } finally { controller.dispose(); store.dispose(); await rm(directory, { recursive: true, force: true }); }
}

test('Local Coding Agent eligibility requires synthetic tool continuation and live sandbox/context', async () => {
    let sandbox = true;
    let mode: 'tools' | 'no-tool' | 'deferred' = 'tools';
    let release: (() => void) | undefined;
    const transport = { async turn(request: { messages: { role: string; content: string }[] }) {
        if (request.messages.some(message => message.role === 'tool')) {
            const result = JSON.parse(request.messages.at(-1)!.content);
            return { kind: 'final' as const, text: `Value: ${result.output}` };
        }
        if (mode === 'deferred') await new Promise<void>(resolve => { release = resolve; });
        if (mode === 'no-tool') return { kind: 'final' as const, text: 'OK' };
        return { kind: 'tools' as const, calls: [{ id: 'probe-call', name: 'read' as const,
            arguments: { path: 'dope-synthetic-capability-probe.txt', maxBytes: 128 } }] };
    } };
    const probe = new LocalAgentCapabilityProbe(transport as any, async () => ({ available: sandbox }));
    await fixture(async ({ store, controller, runtime, change }) => {
        await controller.refreshModels('desk');
        let snapshot = await store.read();
        await store.mutate({ version: 1, expectedRevision: snapshot.revision, mutation: { type: 'create-connection',
            connection: { version: 1, id: 'codex', alias: 'Codex', lifecycle: 'enabled',
                config: { type: 'codex', runtime: 'app-server' } } } });
        snapshot = await store.read();
        await store.mutate({ version: 1, expectedRevision: snapshot.revision, mutation: { type: 'upsert-model',
            model: { ...snapshot.models.find(item => item.connectionId === 'desk')!, connectionId: 'codex',
                providerModelKey: 'hosted', locality: 'hosted', capabilities: {
                    conversationalText: { source: 'unknown' }, streaming: { source: 'unknown' },
                    structuredOutput: { source: 'unknown' }, toolCalling: { source: 'unknown' },
                    agentExecution: { source: 'adapter-known', value: true } } } } });
        await controller.refreshModels('desk');
        assert.deepEqual((await controller.inventory()).registry.models.find(item => item.connectionId === 'codex')?.capabilities.agentExecution, { source: 'adapter-known', value: true });
        const capability = async (id = 'alpha') => (await controller.inventory()).registry.models.find(item =>
            item.connectionId === 'desk' && item.providerModelKey === id)?.capabilities.agentExecution;
        assert.equal((await capability())?.source, 'unknown');
        assert.deepEqual((await controller.findEligibleModels({ usableOnly: true,
            capabilities: ['agentExecution'] })).models, []);
        mode = 'no-tool';
        assert.equal(await controller.verifyLocalAgentExecution('desk', 'alpha'), 'unsupported');
        assert.equal((await capability())?.source, 'unknown');
        mode = 'tools'; sandbox = false;
        assert.equal(await controller.verifyLocalAgentExecution('desk', 'alpha'), 'unavailable');
        sandbox = true;
        assert.equal(await controller.verifyLocalAgentExecution('desk', 'alpha'), 'supported');
        assert.deepEqual(await capability(), { source: 'adapter-known', value: true });
        assert.deepEqual((await controller.findEligibleModels({ usableOnly: true,
            capabilities: ['agentExecution'] })).models.map(item => item.providerModelKey), ['alpha']);
        assert.equal((await store.read()).models.find(item => item.providerModelKey === 'alpha')?.capabilities
            .agentExecution?.source, 'unknown');
        sandbox = false;
        assert.equal(await controller.verifyLocalAgentExecution('desk', 'alpha'), 'unavailable');
        assert.equal((await capability())?.source, 'unknown');
        sandbox = true;
        assert.equal(await controller.verifyLocalAgentExecution('desk', 'alpha'), 'supported');
        mode = 'deferred';
        const timeoutProbe = new LocalAgentCapabilityProbe(transport as any,
            async () => ({ available: true }), 10);
        assert.equal(await timeoutProbe.probe((await store.read()).connections.find(item => item.id === 'desk')!,
            'alpha', () => controller.inventory()), 'timed-out');
        release?.();
        const cancel = new AbortController();
        const cancelled = controller.verifyLocalAgentExecution('desk', 'alpha', cancel.signal);
        await new Promise(resolve => setImmediate(resolve));
        cancel.abort();
        assert.equal(await cancelled, 'cancelled');
        release?.();
        assert.equal((await capability())?.source, 'unknown');
        const stale = controller.verifyLocalAgentExecution('desk', 'alpha');
        await new Promise(resolve => setImmediate(resolve));
        await controller.refreshModels('desk');
        release?.();
        assert.notEqual(await stale, 'supported');
        assert.equal((await capability())?.source, 'unknown');
        mode = 'tools';
        change([loaded('alpha'), loaded('beta', 8192)]);
        await controller.refreshModels('desk');
        assert.equal(await controller.verifyLocalAgentExecution('desk', 'alpha'), 'unavailable');
        assert.equal((await capability())?.source, 'unknown');
        assert.equal(await controller.verifyLocalAgentExecution('desk', 'beta'), 'supported');
        snapshot = await store.read();
        await store.mutate({ version: 1, expectedRevision: snapshot.revision, mutation: { type: 'update-connection',
            id: 'desk', changes: { alias: 'desk', lifecycle: 'enabled',
                config: { type: 'local', runtime: 'lm-studio', endpoint: 'http://localhost:1234/v1' } } } });
        assert.equal((await capability('beta'))?.source, 'unknown');
        assert.deepEqual((await controller.inventory()).registry.models.find(item => item.connectionId === 'codex')?.capabilities.agentExecution, { source: 'adapter-known', value: true });
        runtime.disconnect('desk');
        assert.equal((await capability('beta'))?.source, 'unknown');
    }, probe);
});

test('inventory reconciles scoped identities without losing disabled preferences or known missing models', async () => {
    await fixture(async ({ store, controller, runtime, change }) => {
        const first = await controller.refreshModels('desk');
        assert.deepEqual(first.registry.models.map(model => model.providerModelKey), ['alpha', 'beta']);
        assert.equal(first.registry.models[0].capabilities.conversationalText.source, 'adapter-known');
        assert.equal(first.registry.models[0].limits.contextWindowTokens.source, 'unknown');
        await store.mutate({ version: 1, expectedRevision: first.registry.revision,
            mutation: { type: 'set-model-enabled', connectionId: 'desk', providerModelKey: 'alpha', enabled: false } });
        change([loaded('beta', 8192), loaded('gamma')]);
        const refreshed = await controller.refreshModels('desk');
        assert.equal(refreshed.registry.models.find(model => model.providerModelKey === 'alpha')?.state, 'disabled');
        assert.equal(refreshed.registry.models.find(model => model.providerModelKey === 'alpha')?.enabled, false);
        assert.equal((await store.read()).models.find(model => model.providerModelKey === 'alpha')?.state, 'unavailable');
        assert.equal(refreshed.registry.models.find(model => model.providerModelKey === 'gamma')?.capabilities.conversationalText.source, 'unknown');
        assert.deepEqual((await controller.findEligibleModels({ usableOnly: true, capabilities: ['conversationalText'],
            minimumKnownContextTokens: 4096 })).models.map(model => model.providerModelKey), ['beta']);
        assert.deepEqual((await controller.findEligibleModels({ usableOnly: true,
            loadedLocalModels: [{ connectionId: 'desk', providerModelKey: 'gamma', contextWindowTokens: 65536 }] }))
            .models.map(model => model.providerModelKey), ['beta']);
        runtime.disconnect('desk');
        assert.equal((await controller.inventory()).observations[0].health, 'unknown');
        assert.deepEqual((await controller.findEligibleModels({ usableOnly: true })).models, []);
        const restartedRuntime = { onExecutionFailure() { return () => {}; }, onChange() { return () => {}; },
            async list() { return { connections: [] }; } } as unknown as ModelConnectionsRegistry;
        const restartedCredentials = { onChange() { return () => {}; } } as unknown as AICredentialManager;
        const restarted = new AIInventoryController(store, restartedRuntime, restartedCredentials);
        try {
            const cold = await restarted.inventory();
            assert.equal(cold.observations[0].health, 'unknown');
            assert.equal(cold.registry.models.find(model => model.providerModelKey === 'beta')?.state, 'unknown');
            assert.equal(cold.registry.models.find(model => model.providerModelKey === 'alpha')?.state, 'disabled');
        } finally { restarted.dispose(); }
    });
});

test('Test Connection uses one tiny synthetic turn, never falls back, and invalidates on changes', async () => {
    await fixture(async ({ store, controller, credentials, connectFake, change, fail, generationFail, calls }) => {
        const result = await controller.testConnection('desk');
        assert.equal(result.modelId, 'alpha');
        assert.equal(result.hostedCostPossible, false);
        assert.equal(result.usage?.outputTokens, 1);
        assert.deepEqual(calls, [{ messages: [{ role: 'user', content: 'Reply with OK.' }], maxOutputTokens: 64 }]);
        assert.equal((await controller.inventory()).tests.length, 1);
        generationFail(new ModelRuntimeFailure('temporary', 'transient-upstream'));
        await assert.rejects(controller.testConnection('desk'), /temporary/);
        assert.equal(calls.length, 2);
        assert.equal((await controller.inventory()).observations[0].health, 'ready');
        generationFail();
        await controller.testConnection('desk');
        await credentials.replace('desk', 'session', 'fixture-token');
        assert.equal((await controller.inventory()).tests.length, 0);
        assert.equal((await controller.inventory()).observations[0].health, 'unknown');
        await connectFake();
        const before = await store.read();
        await store.mutate({ version: 1, expectedRevision: before.revision,
            mutation: { type: 'set-model-enabled', connectionId: 'desk', providerModelKey: 'alpha', enabled: false } });
        assert.equal((await controller.inventory()).tests.length, 0);
        change([loaded('alpha', 4096)]);
        await assert.rejects(controller.testConnection('desk'), /No usable model/);
        assert.equal(calls.length, 3);
        change([loaded('alpha', 4096), loaded('beta', 8192)]);
        fail(new ModelRuntimeFailure('temporary', 'transient-upstream'));
        await assert.rejects(controller.refreshModels('desk'), /temporary/);
        assert.equal((await controller.inventory()).observations[0].health, 'degraded');
    });
});

test('authentication and disabled lifecycle normalize without runtime probing', async () => {
    await fixture(async ({ store, controller }) => {
        let snapshot = await store.read();
        await store.mutate({ version: 1, expectedRevision: snapshot.revision, mutation: { type: 'create-connection',
            connection: { version: 1, id: 'host', alias: 'Host', lifecycle: 'enabled',
                config: { type: 'openai' }, preferredModelId: 'configured-model' } } });
        await assert.rejects(controller.refreshModels('host'), /credential/);
        assert.equal((await controller.inventory()).observations.find(item => item.connectionId === 'host')?.health,
            'needs-authentication');
        snapshot = await store.read();
        await store.mutate({ version: 1, expectedRevision: snapshot.revision, mutation: { type: 'update-connection',
            id: 'desk', changes: { alias: 'desk', lifecycle: 'disabled', config: local('desk').config } } });
        assert.equal((await controller.inventory()).observations.find(item => item.connectionId === 'desk')?.health, 'disabled');
        await assert.rejects(controller.refreshModels('desk'), /disabled/);
    });
});

test('hosted test discloses potential cost and invalid configuration fails before provider use', async () => {
    await fixture(async ({ store, controller, runtime, calls }) => {
        const snapshot = await store.read();
        await store.mutate({ version: 1, expectedRevision: snapshot.revision, mutation: { type: 'create-connection',
            connection: { version: 1, id: 'host', alias: 'Host', lifecycle: 'enabled',
                config: { type: 'openai' }, preferredModelId: 'chosen' } } });
        const credentials = new AICredentialManager(store, async () => undefined, { OPENAI_API_KEY: 'fixture-key' });
        const hosted = new ModelConnectionsRegistry(undefined, store, credentials);
        const inventory = new AIInventoryController(store, hosted, credentials);
        try {
            await hosted.connect('host', { async discoverModels() { return [loaded('chosen', 8192)]; },
                async *generateConversation(request) {
                    calls.push({ messages: request.messages, maxOutputTokens: request.maxOutputTokens });
                    yield { type: 'complete' as const, text: 'OK', usage: { tokenMeasurement: 'unavailable' as const } };
                } });
            assert.deepEqual(await inventory.testConnectionDisclosure('host'), { hostedCostPossible: true });
            const result = await inventory.testConnection('host');
            assert.equal(result.hostedCostPossible, true);
            assert.equal(result.modelId, 'chosen');
            assert.equal(calls.length, 1);
            assert.equal((await inventory.inventory()).registry.models.find(item => item.connectionId === 'host')?.limits
                .contextWindowTokens.source, 'adapter-known');
            assert.deepEqual((await inventory.findEligibleModels({ usableOnly: true, locality: 'hosted',
                minimumKnownContextTokens: 8000 })).models.map(item => item.providerModelKey), ['chosen']);
        } finally { inventory.dispose(); }
        assert.equal((await controller.inventory()).tests.length, 0);
        assert.equal((await runtime.list()).connections.length, 2);
    });
});

test('invalid configuration is reported before attempting a provider request', async () => {
    const bad = { ...local('bad'), config: { type: 'local' as const, runtime: 'lm-studio' as const,
        endpoint: 'https://example.com/v1' } };
    const store = { async read() { return { version: 1 as const, revision: 0, connections: [bad], models: [] }; },
        onChange() { return () => {}; } } as unknown as AIRegistryStore;
    const credentials = { onChange() { return () => {}; } } as unknown as AICredentialManager;
    const runtime = { onExecutionFailure() { return () => {}; }, onChange() { return () => {}; },
        async list() { return { connections: [] }; } } as unknown as ModelConnectionsRegistry;
    const controller = new AIInventoryController(store, runtime, credentials);
    try {
        await assert.rejects(controller.refreshModels('bad'), /Invalid connection configuration/);
        assert.equal((await controller.inventory()).observations[0].health, 'invalid-configuration');
    } finally { controller.dispose(); }
});

test('connection creation schedules one bounded check and publishes health without polling', async () => {
    await fixture(async ({ store, controller }) => {
        const notifications: number[] = [];
        const backend = new AIRegistryBackend(store, {
            notifyAIRegistryChanged(revision) { notifications.push(revision); }, notifyAIInventoryChanged() {} },
        undefined, controller);
        try {
            const checked = new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => { unlisten(); reject(new Error('Bounded check missing')); }, 1000);
                const unlisten = controller.onChange(() => {
                    void controller.inventory().then(state => {
                        if (state.observations.find(item => item.connectionId === 'new-host')?.health === 'needs-authentication') {
                            clearTimeout(timeout); unlisten(); resolve();
                        }
                    }, reject);
                });
            });
            const before = await store.read();
            await backend.mutate({ version: 1, expectedRevision: before.revision, mutation: { type: 'create-connection',
                connection: { version: 1, id: 'new-host', alias: 'New', lifecycle: 'enabled',
                    config: { type: 'openai' }, preferredModelId: 'configured' } } });
            await checked;
            assert.ok(notifications.length);
            assert.equal((await store.read()).models.length, 0);
        } finally { backend.dispose(); }
    });
});

test('a transient execution failure stays quiet; authentication execution failure changes health', async () => {
    await fixture(async ({ controller, runtime, generationFail }) => {
        await controller.refreshModels('desk');
        generationFail(new ModelRuntimeFailure('temporary', 'transient-transport'));
        await assert.rejects(async () => { for await (const _event of runtime.generate({ connectionId: 'desk', modelId: 'alpha' },
            { messages: [{ role: 'user', content: 'probe' }] })) {} }, /temporary/);
        assert.equal((await controller.inventory()).observations[0].health, 'ready');
        generationFail(new ModelRuntimeFailure('auth', 'authentication'));
        await assert.rejects(async () => { for await (const _event of runtime.generate({ connectionId: 'desk', modelId: 'alpha' },
            { messages: [{ role: 'user', content: 'probe' }] })) {} }, /auth/);
        assert.equal((await controller.inventory()).observations[0].health, 'needs-authentication');
    });
});
