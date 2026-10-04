import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ModelRuntimeFailure } from '../../packages/contracts/lib/model-runtime.js';
import { FileModelConnectionStore, ModelConnectionsBackend, ModelConnectionsRegistry } from '../../packages/theia-extension/lib/node/model-connections.js';

const model = (id: string, conversationalText = true) => ({ id, label: id,
    capabilities: { conversationalText, streaming: true, contextWindowTokens: 8192,
        reasoningControls: [{ id: 'effort', values: ['low', 'high'] }] } });
const request = { messages: [{ role: 'user' as const, content: 'Hello' }] };

test('connection inventory, readiness invalidation, exact routing and cancellation', async () => {
    const store = { entries: [] as any[], async read() { return this.entries; },
        async write(entries: readonly any[]) { this.entries = [...entries]; } };
    const registry = new ModelConnectionsRegistry(store);
    await registry.upsert({ id: 'one', providerId: 'example', label: 'One' });
    await registry.upsert({ id: 'two', providerId: 'example', label: 'Two' });
    const called: string[] = [];
    const runtime = (name: string) => ({
        async discoverModels() { return [model('chat'), model('embed', false)]; },
        async *generateConversation(input: { modelId: string; signal?: AbortSignal }) {
            called.push(`${name}:${input.modelId}`);
            yield { type: 'delta' as const, text: 'Hello' };
            yield { type: 'complete' as const, text: 'Hello', usage: { tokenMeasurement: 'estimated' as const } };
        },
    });
    await registry.connect('one', runtime('one'));
    await registry.connect('two', runtime('two'));
    assert.deepEqual((await registry.list()).connections[0].models.map(item => item.usable), [true, false]);
    assert.equal((await registry.list()).connections[0].ready, true);
    const events = [];
    for await (const event of registry.generate({ connectionId: 'two', modelId: 'chat' }, request)) events.push(event);
    assert.deepEqual(called, ['two:chat']);
    assert.equal(events.at(-1)?.type, 'complete');
    await assert.rejects(async () => { for await (const _ of registry.generate({ connectionId: 'one', modelId: 'missing' }, request)) {} },
        (error: unknown) => error instanceof ModelRuntimeFailure && error.failureClass === 'model-unavailable');
    await assert.rejects(async () => { for await (const _ of registry.generate({ connectionId: 'one', modelId: 'embed' }, request)) {} },
        (error: unknown) => error instanceof ModelRuntimeFailure && error.failureClass === 'unsupported-capability');
    await assert.rejects(async () => { for await (const _ of registry.generate({ connectionId: 'one', modelId: 'chat' },
        { ...request, controls: { effort: 'medium' } })) {} },
        (error: unknown) => error instanceof ModelRuntimeFailure && error.failureClass === 'unsupported-capability');
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(async () => { for await (const _ of registry.generate({ connectionId: 'one', modelId: 'chat' },
        { ...request, signal: controller.signal })) {} },
        (error: unknown) => error instanceof ModelRuntimeFailure && error.failureClass === 'cancelled');
    assert.deepEqual(called, ['two:chat']);
    registry.disconnect('two');
    assert.equal((await registry.list()).connections[1].ready, false);
    await assert.rejects(async () => { for await (const _ of registry.generate({ connectionId: 'two', modelId: 'chat' }, request)) {} },
        (error: unknown) => error instanceof ModelRuntimeFailure && error.failureClass === 'connection-unavailable');
    await registry.remove('one');
    assert.equal((await registry.list()).connections.length, 1);
});

test('AI Center model state controls Chat inventory and exact turn execution live', async () => {
    const listeners = new Set<(snapshot: any) => void>();
    const snapshot = { version: 1, revision: 1, connections: [{ id: 'desk', alias: 'Desk',
        lifecycle: 'enabled', config: { type: 'local', runtime: 'lmstudio', endpoint: 'http://localhost:1234/v1' } }],
        models: [{ connectionId: 'desk', providerModelKey: 'chat', enabled: true, state: 'ready' }] };
    const store = { async read() { return snapshot; }, onChange(listener: (value: any) => void) {
        listeners.add(listener); return () => listeners.delete(listener);
    } };
    const registry = new ModelConnectionsRegistry(undefined, store as any);
    let changes = 0, executions = 0;
    registry.onChange(() => { changes++; });
    await registry.connect('desk', { async discoverModels() { return [model('chat')]; },
        async *generateConversation() { executions++; yield { type: 'complete' as const, text: 'OK' }; } });
    assert.equal((await registry.list()).connections[0].models[0].usable, true);
    snapshot.models[0].enabled = false;
    snapshot.revision++;
    for (const listener of listeners) listener(snapshot);
    assert.ok(changes > 0);
    assert.equal((await registry.list()).connections[0].models[0].usable, false);
    await assert.rejects(async () => { for await (const _ of registry.generate({ connectionId: 'desk', modelId: 'chat' }, request)) {} },
        (error: unknown) => error instanceof ModelRuntimeFailure && error.failureClass === 'model-unavailable');
    assert.equal(executions, 0);
    snapshot.models[0].enabled = true;
    snapshot.revision++;
    for (const listener of listeners) listener(snapshot);
    assert.equal((await registry.list()).connections[0].models[0].usable, true);
    for await (const _ of registry.generate({ connectionId: 'desk', modelId: 'chat' }, request)) {}
    assert.equal(executions, 1);
});

test('late discovery cannot restore a replaced connection', async () => {
    const registry = new ModelConnectionsRegistry({ async read() { return []; }, async write() {} });
    await registry.upsert({ id: 'one', providerId: 'example', label: 'One' });
    let finish!: (models: ReturnType<typeof model>[]) => void;
    const stale = registry.connect('one', { discoverModels: () => new Promise(resolve => { finish = resolve; }),
        async *generateConversation() {} });
    await Promise.resolve();
    await registry.connect('one', { async discoverModels() { return [model('current')]; },
        async *generateConversation() {} });
    finish([model('stale')]);
    await stale;
    assert.deepEqual((await registry.list()).connections[0].models.map(item => item.id), ['current']);
});

test('failed rediscovery clears readiness and backend announces changes', async () => {
    const registry = new ModelConnectionsRegistry({ async read() { return []; }, async write() {} });
    let changed = 0;
    const backend = new ModelConnectionsBackend(registry, { notifyModelConnectionsChanged() { changed++; } });
    await backend.upsert({ id: 'one', providerId: 'example', label: 'One' });
    let fail = false;
    await registry.connect('one', { async discoverModels() {
        if (fail) throw new Error('Offline');
        return [model('chat')];
    }, async *generateConversation() {} });
    assert.equal((await backend.list()).connections[0].ready, true);
    fail = true;
    await assert.rejects(registry.refresh('one'), /Offline/);
    assert.deepEqual((await backend.list()).connections[0],
        { id: 'one', providerId: 'example', label: 'One', ready: false, models: [] });
    assert.ok(changed >= 3);
    backend.dispose();
    const before = changed;
    registry.disconnect('one');
    assert.equal(changed, before);
});

test('only safe metadata survives application storage and restart', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-model-connections-'));
    try {
        const path = join(root, 'model-connections.json');
        const registry = new ModelConnectionsRegistry(new FileModelConnectionStore(path));
        await registry.upsert({ id: 'one', providerId: 'example', label: 'One',
            endpoint: 'https://secret.example/token', credential: 'private-token' } as any);
        await registry.setSessionCredential('one', 'session-only-token');
        assert.equal(registry.sessionCredential('one'), 'session-only-token');
        await registry.setPreferred({ connectionId: 'one', modelId: 'chat' });
        const stored = await readFile(path, 'utf8');
        assert.ok(!stored.includes('secret.example') && !stored.includes('private-token') &&
            !stored.includes('session-only-token'));
        assert.deepEqual((await new ModelConnectionsRegistry(new FileModelConnectionStore(path)).list()).connections,
            [{ id: 'one', providerId: 'example', label: 'One', preferredModelId: 'chat', ready: false, models: [] }]);
    } finally { await rm(root, { recursive: true, force: true }); }
});
