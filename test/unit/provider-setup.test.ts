import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import type { AIConnection, AIConnectionConfig } from '../../packages/ai/lib/index.js';
import { ModelRuntimeFailure } from '../../packages/contracts/lib/model-runtime.js';
import { AIRegistryStore } from '../../packages/theia-extension/lib/node/ai-registry-store.js';
import { AIRegistryBackend } from '../../packages/theia-extension/lib/node/ai-registry-backend.js';
import { AICredentialManager } from '../../packages/theia-extension/lib/node/ai-credential-manager.js';
import { ModelConnectionsRegistry } from '../../packages/theia-extension/lib/node/model-connections.js';
import { LocalConversationalProvider } from '../../packages/theia-extension/lib/node/conversational-providers.js';
import { detectLocalRuntime, providerSetup, providerSetupDescriptions } from
    '../../packages/theia-extension/lib/node/provider-setup.js';

const connection = (id: string, config: AIConnectionConfig, preferredModelId?: string): AIConnection =>
    ({ version: 1, id, alias: 'Shared alias', lifecycle: 'enabled', config,
        ...(preferredModelId ? { preferredModelId } : {}) });
const mutation = (item: AIConnection, expectedRevision: number) => ({ version: 1 as const, expectedRevision,
    mutation: { type: 'create-connection' as const, connection: item } });
const local = { type: 'local' as const, runtime: 'lm-studio' as const, endpoint: 'http://127.0.0.1:9999/v1' };
const json = (value: unknown) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } });

test('provider setup validates identity and safe fields without conflating OpenAI with compatible endpoints', async () => {
    const descriptions = providerSetupDescriptions();
    assert.deepEqual(descriptions.map(item => item.type), ['local', 'openai', 'openai-compatible', 'gemini']);
    assert.equal(descriptions.find(item => item.type === 'local')?.locality, 'local');
    assert.equal(descriptions.find(item => item.type === 'openai-compatible')?.modelSource, 'configured-or-discovered');
    assert.throws(() => providerSetup(connection('x', { type: 'openai', endpoint: 'https://other.example/v1' })),
        /OpenAI-compatible/);
    assert.throws(() => providerSetup(connection('x', { ...local, endpoint: 'http://example.com/v1' })), /localhost/);
    assert.throws(() => providerSetup(connection('x', { type: 'gemini', endpoint: 'https://example.com' })), /unsupported/);
    assert.equal(providerSetup(connection('x', { type: 'openai-compatible', endpoint: 'https://example.com/v1' })).type,
        'openai-compatible');
    assert.equal(providerSetup(connection('x', { type: 'gemini' })).credential, 'required');
    const unconfigured = new LocalConversationalProvider({ compatible: true, endpoint: 'https://host.example/v1',
        fetch: async () => json({ data: [{ id: 'unknown-kind' }] }) });
    assert.equal((await unconfigured.discoverModels())[0].capabilities.conversationalText, false);
    await assert.rejects(async () => { for await (const _event of unconfigured.generateConversation(
        { modelId: 'unknown-kind', messages: [] })) {} }, /Selected local model unavailable/);
    assert.deepEqual(await detectLocalRuntime(async url => String(url).endsWith('/v1/models') ?
        json({ data: [{ id: 'loaded' }] }) : json({}) as Response),
    { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234/v1' });
    assert.equal(await detectLocalRuntime(async () => { throw Error('offline'); }), undefined);
});

test('duplicate-looking connections keep independent IDs; detection is explicit and stale-safe', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dope-provider-setup-'));
    const store = new AIRegistryStore(directory);
    try {
        await store.mutate(mutation(connection('one', local), 0));
        await store.mutate(mutation(connection('two', local), 1));
        const backend = new AIRegistryBackend(store, { notifyAIRegistryChanged() {} }, async () =>
            ({ type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234/v1' }));
        assert.equal((await backend.providerSetups()).length, 4);
        assert.equal((await store.read()).connections[0].config.type, 'local');
        await assert.rejects(backend.useDetectedRuntime('one', 1), /Stale/);
        const updated = await backend.useDetectedRuntime('one', 2);
        assert.equal(updated.connections[0].id, 'one');
        assert.equal((updated.connections[0].config as typeof local).endpoint, 'http://127.0.0.1:1234/v1');
        assert.deepEqual(updated.connections[1].config, local);
        const changed = await store.mutate({ version: 1, expectedRevision: 3,
            mutation: { type: 'update-connection', id: 'one', changes: {
                alias: 'Renamed', lifecycle: 'enabled', config: { type: 'openai-compatible', endpoint: 'https://host.example/v1' } } } });
        assert.equal(changed.connections[0].id, 'one');
        assert.equal(changed.connections[0].config.type, 'openai-compatible');
        await store.mutate(mutation({ ...connection('openai-key', { type: 'openai' }, 'gpt-test'),
            credential: { source: 'environment', name: 'OPENAI_API_KEY', status: 'unknown' } }, 4));
        await assert.rejects(store.mutate({ version: 1, expectedRevision: 5, mutation: {
            type: 'update-connection', id: 'openai-key', changes: { alias: 'Shared alias', lifecycle: 'enabled',
                config: { type: 'openai-compatible', endpoint: 'https://other.example/v1' } } } }), /Clear the previous provider credential/);
        await assert.rejects(store.mutate(mutation(connection('bad', { type: 'openai', endpoint: 'https://other.example' }), 5)),
            /OpenAI-compatible/);
        assert.equal((await store.read()).revision, 5);
        backend.dispose();
    } finally { store.dispose(); await rm(directory, { recursive: true, force: true }); }
});

test('activation uses configured connection and resolved credential; exact model and Local loaded capacity remain guarded', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dope-provider-runtime-'));
    const store = new AIRegistryStore(directory);
    const originalFetch = globalThis.fetch;
    const calls: { url: string; auth: string | null; model?: string }[] = [];
    globalThis.fetch = async (url, init) => {
        const address = String(url);
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url: address, auth: new Headers(init?.headers).get('Authorization'), model: body?.model });
        if (address.endsWith('/api/v1/models')) return json({ models: [
            { type: 'llm', key: 'loaded', loaded_instances: [{ id: 'loaded', config: { context_length: 2048 } }] },
            { type: 'llm', key: 'unknown', loaded_instances: [{ id: 'unknown', config: {} }] }] });
        if (address.endsWith('/models')) return json({ data: [{ id: 'loaded' }, { id: 'unknown' }] });
        return new Response('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n');
    };
    try {
        await store.mutate(mutation(connection('hosted', { type: 'openai-compatible', endpoint: 'https://host.example/v1' }, 'configured'), 0));
        await store.mutate(mutation(connection('local', local), 1));
        await store.mutate(mutation(connection('openai', { type: 'openai' }, 'gpt-test'), 2));
        const environment = { COMPAT_KEY: 'environment-secret', OPENAI_API_KEY: 'openai-secret' };
        const credentials = new AICredentialManager(store, async () => undefined, environment);
        await store.mutate({ version: 1, expectedRevision: 3, mutation: { type: 'update-connection', id: 'hosted',
            changes: { alias: 'Shared alias', lifecycle: 'enabled', config: { type: 'openai-compatible', endpoint: 'https://host.example/v1' },
                credential: { source: 'environment', name: 'COMPAT_KEY', status: 'unknown' } } } });
        const registry = new ModelConnectionsRegistry(undefined, store, credentials);
        await registry.activate('hosted');
        assert.deepEqual((await registry.list()).connections[0].models.map(item => item.id), ['configured']);
        await assert.rejects(async () => { for await (const _event of registry.generate(
            { connectionId: 'hosted', modelId: 'other' }, { messages: [{ role: 'user', content: 'Hi' }] })) {} },
        (error: unknown) => error instanceof ModelRuntimeFailure && error.failureClass === 'model-unavailable');
        const events = [];
        for await (const event of registry.generate({ connectionId: 'hosted', modelId: 'configured' },
            { messages: [{ role: 'user', content: 'Hi' }] })) events.push(event);
        assert.deepEqual(events.at(-1)?.type === 'complete' ? events.at(-1).provenance : undefined,
            { connectionId: 'hosted', modelId: 'configured', providerId: 'openai-compatible', modelLabel: 'configured' });
        assert.equal(calls.at(-1)?.auth, 'Bearer environment-secret');
        assert.equal(calls.at(-1)?.model, 'configured');
        await registry.activate('local');
        const models = (await registry.list()).connections[1].models;
        assert.equal(models.find(item => item.id === 'loaded')?.capabilities.contextWindowTokens, 2048);
        assert.equal(models.find(item => item.id === 'unknown')?.usable, false);
        await registry.activate('openai');
        assert.deepEqual((await registry.list()).connections[2].models.map(item => item.id), ['gpt-test']);
        assert.equal((await registry.list()).connections[2].providerId, 'openai');
        assert.doesNotMatch(await readFile(store.path, 'utf8'), /environment-secret/);
        assert.doesNotMatch(await readFile(store.path, 'utf8'), /openai-secret/);
        await registry.setSessionCredential('hosted', 'session-secret');
        assert.equal((await registry.list()).connections[0].ready, false);
        assert.doesNotMatch(await readFile(store.path, 'utf8'), /session-secret/);
        await store.mutate(mutation(connection('anonymous', { type: 'openai-compatible', endpoint: 'https://other.example/v1' }, 'manual'), 4));
        await credentials.replace('anonymous', 'session', 'unselected-secret');
        await registry.activate('anonymous');
        const before = calls.length;
        for await (const _event of registry.generate({ connectionId: 'anonymous', modelId: 'manual' },
            { messages: [{ role: 'user', content: 'Hi' }] })) {}
        assert.equal(calls[before]?.auth, null);
        await registry.setSessionCredential('anonymous', 'selected-secret');
        await registry.activate('anonymous');
        for await (const _event of registry.generate({ connectionId: 'anonymous', modelId: 'manual' },
            { messages: [{ role: 'user', content: 'Hi' }] })) {}
        assert.equal(calls.at(-1)?.auth, 'Bearer selected-secret');
        await store.mutate({ version: 1, expectedRevision: 5, mutation: { type: 'update-connection', id: 'hosted',
            changes: { alias: 'Shared alias', lifecycle: 'enabled', config: { type: 'openai-compatible', endpoint: 'https://host.example/v1' },
                credential: { source: 'secure', status: 'unknown' } } } });
        await assert.rejects(registry.activate('hosted'), /OS secure storage unavailable/);
    } finally { globalThis.fetch = originalFetch; store.dispose(); await rm(directory, { recursive: true, force: true }); }
});
