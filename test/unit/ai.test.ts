import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAIRegistryMutation, findEligibleModels, nextAIConnectionHealth, parseAIConnection, parseAIModel, parseAIRegistryMutation,
    parseAIRegistrySnapshot } from '../../packages/ai/lib/index.js';
import type { AIConnection, AIModel, AIRegistrySnapshot } from '../../packages/ai/lib/index.js';

const unknown = { source: 'unknown' } as const;
const known = (value: boolean | number) => ({ source: 'provider-reported' as const, value });
const connection = (id = 'one'): AIConnection => ({ version: 1, id, alias: 'First', lifecycle: 'enabled',
    config: { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234' },
    credential: { source: 'environment', name: 'LOCAL_API_KEY', status: 'missing' } });
const model = (connectionId = 'one', providerModelKey = 'shared'): AIModel => ({
    version: 1, connectionId, providerModelKey, label: 'Original', locality: 'local', enabled: true, state: 'ready',
    capabilities: { conversationalText: known(true), streaming: unknown, structuredOutput: unknown, toolCalling: known(false) },
    limits: { contextWindowTokens: known(65536), maxInputTokens: unknown, maxOutputTokens: unknown },
});
const snapshot = (): AIRegistrySnapshot => ({ version: 1, revision: 0,
    connections: [connection(), connection('two')], models: [model(), model('two')] });
const observed = [{ connectionId: 'one', health: 'ready' as const }, { connectionId: 'two', health: 'ready' as const }];
const loaded = [{ connectionId: 'one', providerModelKey: 'shared', contextWindowTokens: 8192 }];

test('strict versioned parsing rejects unknown fields, secrets, malformed references and quality', () => {
    assert.deepEqual(parseAIConnection(connection()), connection());
    assert.deepEqual(parseAIModel(model()), model());
    assert.throws(() => parseAIConnection({ ...connection(), version: 2 }));
    assert.throws(() => parseAIConnection({ ...connection(), secret: 'value' }));
    assert.throws(() => parseAIConnection({ ...connection(), credential: { source: 'secure', status: 'available', value: 'secret' } }));
    assert.throws(() => parseAIConnection({ ...connection(), config: { type: 'openai-compatible', endpoint: 'https://user:pass@example.com' } }));
    assert.throws(() => parseAIConnection({ ...connection(), config: { type: 'openai', endpoint: 'https://example.com?api_key=secret' } }));
    assert.throws(() => parseAIModel({ ...model(), limits: { ...model().limits, contextWindowTokens: { source: 'unknown', value: 1 } } }));
    assert.throws(() => parseAIModel({ ...model(), capabilities: { ...model().capabilities, streaming: { source: 'configured' } } }));
    assert.throws(() => parseAIModel({ ...model(), limits: { ...model().limits, contextWindowTokens: known(0) } }));
    assert.throws(() => parseAIRegistrySnapshot({ ...snapshot(), connections: [connection(), connection()] }));
    assert.throws(() => parseAIRegistrySnapshot({ ...snapshot(), models: [model('missing')] }));
    assert.throws(() => applyAIRegistryMutation(snapshot(), { version: 2 as 1, expectedRevision: 0,
        mutation: { type: 'remove-connection', id: 'one' } }));
});

test('Codex identity and non-secret account projection stay separate from API keys and model inference', () => {
    const codex: AIConnection = { version: 1, id: 'codex-one', alias: 'Work', lifecycle: 'enabled',
        config: { type: 'codex', runtime: 'app-server' },
        codexAccount: { status: 'signed-in', accountLabel: 'Work account', accountId: 'subject-1',
            clientId: 'issued-client', planUsage: 'available' } };
    assert.deepEqual(parseAIConnection(codex), codex);
    assert.throws(() => parseAIConnection({ ...codex, credential: { source: 'secure', status: 'available' } }));
    assert.throws(() => parseAIConnection({ ...codex, codexAccount: { status: 'signed-in', accessToken: 'secret' } }));
    assert.throws(() => parseAIConnection({ ...codex, config: { type: 'codex', runtime: 'app-server', endpoint: 'http://localhost' } }));
    assert.throws(() => parseAIRegistryMutation({ type: 'update-connection', id: codex.id, changes: {
        alias: 'Work', lifecycle: 'enabled', config: codex.config, credential: { source: 'secure', status: 'available' } } }));
    assert.throws(() => parseAIConnection({ ...connection(), codexAccount: { status: 'signed-in' } }));
    const agent: AIModel = { ...model('codex-one'), locality: 'hosted',
        capabilities: { ...model().capabilities, conversationalText: unknown, agentExecution: { source: 'adapter-known', value: true } } };
    const registry: AIRegistrySnapshot = { version: 1, revision: 0,
        connections: [codex, { ...codex, id: 'codex-two', alias: 'Personal' }], models: [agent] };
    assert.deepEqual(findEligibleModels(registry, { capabilities: ['agentExecution'] }).models, [agent]);
    assert.deepEqual(findEligibleModels(registry, { capabilities: ['conversationalText'] }).models, []);
    assert.throws(() => parseAIRegistrySnapshot({ ...registry, models: [{ ...agent, locality: 'local' }] }));
    assert.throws(() => applyAIRegistryMutation(registry, { version: 1, expectedRevision: 0, mutation: {
        type: 'upsert-model', model: { ...agent, locality: 'local' } } }));
    assert.deepEqual(findEligibleModels({ ...registry, models: [{ ...agent, capabilities: { ...agent.capabilities, agentExecution: unknown } }] },
        { capabilities: ['agentExecution'] }).models, []);
    assert.deepEqual(findEligibleModels(snapshot(), { capabilities: ['agentExecution'] }).models, []);
    const updated = applyAIRegistryMutation(registry, { version: 1, expectedRevision: 0, mutation: {
        type: 'update-connection', id: 'codex-one', changes: { alias: 'Renamed', lifecycle: 'enabled',
            config: codex.config, codexAccount: { status: 'signed-out' } } } });
    assert.equal(updated.connections[0].id, codex.id);
    assert.equal(updated.connections[1].id, 'codex-two');
    assert.equal(updated.connections[0].codexAccount?.status, 'signed-out');
});

test('connection IDs survive config, alias, credential and lifecycle changes; removal is explicit', () => {
    const before = snapshot();
    const updated = applyAIRegistryMutation(before, { version: 1, expectedRevision: 0, mutation: { type: 'update-connection', id: 'one',
        changes: { alias: 'Changed', lifecycle: 'disabled', config: { type: 'openai' } } } });
    assert.equal(updated.connections[0].id, 'one');
    assert.deepEqual(updated.connections[0].credential, connection().credential);
    assert.equal(updated.connections[0].lifecycle, 'disabled');
    assert.equal(updated.models[0].connectionId, 'one');
    assert.equal(before.connections[0].alias, 'First');
    assert.throws(() => applyAIRegistryMutation(updated, { version: 1, expectedRevision: 0, mutation: { type: 'remove-connection', id: 'one' } }), /Stale/);
    assert.throws(() => applyAIRegistryMutation(updated, { version: 1, expectedRevision: 1, mutation: { type: 'create-connection', connection: connection() } }), /already exists/);
    assert.throws(() => parseAIRegistryMutation({ type: 'update-connection', id: 'one', changes: { ...updated.connections[0], id: 'other' } }));
    const cleared = applyAIRegistryMutation(updated, { version: 1, expectedRevision: 1,
        mutation: { type: 'update-connection', id: 'one', changes: { alias: 'Changed', lifecycle: 'disabled',
            config: { type: 'openai' }, credential: null } } });
    assert.equal(cleared.connections[0].credential, undefined);
    const removed = applyAIRegistryMutation(updated, { version: 1, expectedRevision: 1, mutation: { type: 'remove-connection', id: 'one' } });
    assert.deepEqual(removed.connections.map(item => item.id), ['two']);
    assert.deepEqual(removed.models.map(item => item.connectionId), ['two']);
    assert.equal(removed.revision, 2);
});

test('model identity is scoped by connection, not label or inventory position', () => {
    const before = snapshot();
    const changed = applyAIRegistryMutation(before, { version: 1, expectedRevision: 0, mutation: { type: 'upsert-model',
        model: { ...model(), label: 'Renamed', state: 'unavailable' } } });
    assert.equal(changed.models.length, 2);
    assert.equal(changed.models.find(item => item.connectionId === 'one')?.label, 'Renamed');
    assert.equal(changed.models.find(item => item.connectionId === 'two')?.label, 'Original');
    const hidden = applyAIRegistryMutation(changed, { version: 1, expectedRevision: 1, mutation: { type: 'set-model-enabled',
        connectionId: 'two', providerModelKey: 'shared', enabled: false } });
    assert.equal(hidden.models.find(item => item.connectionId === 'two')?.enabled, false);
    assert.equal(hidden.models.find(item => item.connectionId === 'one')?.enabled, true);
    const refreshed = applyAIRegistryMutation(hidden, { version: 1, expectedRevision: 2, mutation: { type: 'upsert-model',
        model: { ...model('two'), enabled: true, label: 'After refresh' } } });
    assert.equal(refreshed.models.find(item => item.connectionId === 'two')?.enabled, false);
});

test('eligibility filters only and fails closed on unknown hard capabilities and context', () => {
    const state = snapshot();
    assert.deepEqual(findEligibleModels(state, { locality: 'hosted' }).models, []);
    assert.deepEqual(findEligibleModels(state, { capabilities: ['streaming'] }).models, []);
    assert.deepEqual(findEligibleModels(state, { capabilities: ['toolCalling'] }).models, []);
    assert.equal(findEligibleModels(state, { capabilities: ['conversationalText'] }).models.length, 2);
    assert.deepEqual(findEligibleModels(state, { minimumKnownContextTokens: 4096 }).models, []);
    assert.deepEqual(findEligibleModels(state, { usableOnly: true }, observed).models, []);
    assert.deepEqual(findEligibleModels(state, { usableOnly: true, loadedLocalModels: loaded }, observed).models.map(item => item.connectionId), ['one']);
    assert.deepEqual(findEligibleModels(state, { minimumKnownContextTokens: 16384, loadedLocalModels: loaded }).models, []);
    assert.deepEqual(findEligibleModels(state, { minimumKnownContextTokens: 4096, loadedLocalModels: loaded }).models.map(item => item.connectionId), ['one']);
    assert.deepEqual(findEligibleModels(state, { usableOnly: true, loadedLocalModels: loaded }, [{ connectionId: 'one', health: 'unavailable' }]).models, []);
    const disabled = { ...state, connections: [{ ...state.connections[0], lifecycle: 'disabled' as const }, state.connections[1]] };
    assert.deepEqual(findEligibleModels(disabled, { enabledOnly: true }).models.map(item => item.connectionId), ['two']);
    assert.equal(state.models[0].state, 'ready');
});

test('health is lifecycle-aware and transient request failure does not persist as a warning', () => {
    assert.equal(nextAIConnectionHealth('ready', 'enabled', 'transient-request-failure'), 'ready');
    assert.equal(nextAIConnectionHealth('ready', 'disabled', 'unavailable'), 'disabled');
    assert.equal(nextAIConnectionHealth('disabled', 'enabled', 'transient-request-failure'), 'unknown');
    assert.equal(nextAIConnectionHealth('checking', 'enabled', 'needs-authentication'), 'needs-authentication');
});
