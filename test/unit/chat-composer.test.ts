import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { ChatPanelController } from '../../packages/theia-extension/lib/browser/chat-panel-controller.js';
import { ModelConnectionsRegistry } from '../../packages/theia-extension/lib/node/model-connections.js';
import type { ChatClient } from '../../packages/chat/lib/service.js';
import type { ChatConnection } from '../../packages/theia-extension/src/browser/chat-panel-controller.js';

async function until(predicate: () => boolean) {
    for (let i = 0; i < 100; i++) { if (predicate()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
    assert.fail('Timed out');
}

function fixture(repository: ChatRepository, registry: ModelConnectionsRegistry) {
    let client: ChatClient | undefined;
    const composer = new ChatContextComposer({} as never, {} as never, {} as never, repository);
    const service = new ChatBackend(repository, { notifyChatEvent(event) { client?.notifyChatEvent(event); } }, registry, composer);
    return Object.assign(service, { setClient(value: ChatClient | undefined) { client = value; },
        emit(event: Parameters<ChatClient['notifyChatEvent']>[0]) { client?.notifyChatEvent(event); } }) as ChatConnection & { emit: ChatClient['notifyChatEvent'] };
}

test('composer lifecycle saves pending before runtime, streams, keeps provenance, overrides and retries explicitly', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dope-composer-'));
    const workspace = pathToFileURL(dir).href;
    const repository = new ChatRepository();
    const registry = new ModelConnectionsRegistry({ async read() { return []; }, async write() {} });
    const calls: string[] = [];
    let fail = false;
    let pendingObserved = false;
    for (const id of ['one', 'two']) {
        await registry.upsert({ id, providerId: id, label: id });
        await registry.connect(id, {
            async discoverModels() { return [{ id: 'chat', label: 'Chat', capabilities: { conversationalText: true,
                streaming: true, contextWindowTokens: 8192, reasoningControls: [{ id: 'effort', values: ['low'] }] } }]; },
            async *generateConversation(input) {
                calls.push(id);
                assert.deepEqual(input.controls, { effort: 'low' });
                const saved = (await repository.read(dir)).chats[0].messages;
                pendingObserved = saved.at(-1)?.role === 'assistant' && saved.at(-1).execution.status === 'streaming' &&
                    saved.at(-2)?.role === 'user';
                if (fail) { fail = false; throw new Error('provider secret detail'); }
                yield { type: 'delta' as const, text: 'Hello' };
                yield { type: 'complete' as const, text: 'Hello', usage: { tokenMeasurement: 'estimated' as const },
                    actualModelId: 'chat-snapshot' };
            }
        });
    }
    const services: ReturnType<typeof fixture>[] = [];
    const panel = new ChatPanelController(() => { const service = fixture(repository, registry); services.push(service); return service; }, () => {});
    try {
        await panel.attach(workspace);
        assert.equal(await panel.newChat(''), true);
        const id = panel.chatId!;
        const settings = structuredClone(panel.chat!.settings);
        settings.defaultModel = { connectionId: 'one', modelId: 'chat' };
        settings.reasoningControls = { effort: 'low' };
        settings.context.history = 'none';
        settings.context.maxInputTokens = 1024;
        settings.context.allowedSources = ['editor', 'saved-chat'];
        settings.context.savedChatSearch = true;
        assert.equal(await panel.mutate({ type: 'set-settings', chatId: id, settings }), true);
        panel.draft = 'First question';
        assert.equal(await panel.runTurn(settings.defaultModel), true, panel.error);
        assert.equal(pendingObserved, true);
        assert.equal(panel.turnModel, undefined);
        assert.equal(panel.draft, '');
        assert.equal(panel.chat!.messages[1].role, 'assistant');
        const first = panel.chat!.messages[1];
        if (first.role !== 'assistant') assert.fail();
        assert.equal(first.execution.status, 'complete');
        assert.equal(first.execution.actualModel?.modelId, 'chat-snapshot');
        assert.equal(first.execution.selectedModel.connectionId, 'one');
        assert.equal(first.content, 'Hello');
        const unsupported = structuredClone(panel.chat!.settings);
        unsupported.reasoningControls = { effort: 'high' };
        assert.equal(await panel.mutate({ type: 'set-settings', chatId: id, settings: unsupported }), true);
        panel.draft = 'Unsupported control';
        assert.equal(await panel.runTurn(settings.defaultModel), false);
        assert.match(panel.error, /does not support/);
        assert.equal(panel.chat!.messages.length, 2);
        assert.equal(await panel.mutate({ type: 'set-settings', chatId: id, settings }), true);
        panel.turnModel = { connectionId: 'two', modelId: 'chat' };
        panel.draft = 'Second question';
        fail = true;
        assert.equal(await panel.runTurn(panel.turnModel), false);
        const failed = panel.chat!.messages.at(-1)!;
        if (failed.role !== 'assistant') assert.fail();
        assert.equal(failed.execution.status, 'failed');
        assert.equal(failed.execution.selectedModel.connectionId, 'two');
        assert.equal(failed.execution.failure, 'Conversation failed');
        assert.equal(panel.turnModel, undefined);
        assert.equal(panel.chat!.settings.defaultModel?.connectionId, 'one');
        assert.deepEqual(calls, ['one', 'two']);
        assert.equal(await panel.runTurn(settings.defaultModel, failed.id), true);
        assert.deepEqual(calls, ['one', 'two', 'one']);
        assert.equal(panel.chat!.messages.at(-2)?.id, failed.id);
        assert.equal(panel.chat!.messages.at(-1)?.role, 'assistant');
        assert.equal(panel.chat!.messages.length, 5);
        await panel.select(undefined);
        const relocated = new ChatPanelController(() => fixture(repository, registry), () => {});
        try {
            await relocated.attach(workspace);
            assert.equal(await relocated.select(id), true);
            assert.deepEqual(relocated.chat!.settings, settings);
            assert.equal(relocated.chat!.messages[1].role, 'assistant');
        } finally { relocated.dispose(); }
    } finally { panel.dispose(); await rm(dir, { recursive: true, force: true }); }
});

test('cancel and stale deltas cannot create a completed answer in another Chat or project', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dope-composer-cancel-'));
    const repository = new ChatRepository();
    const registry = new ModelConnectionsRegistry({ async read() { return []; }, async write() {} });
    await registry.upsert({ id: 'one', providerId: 'local', label: 'one' });
    await registry.connect('one', { async discoverModels() { return [{ id: 'chat', label: 'chat',
        capabilities: { conversationalText: true, streaming: true } }]; },
        async *generateConversation(request) {
            yield { type: 'delta' as const, text: 'Partial' };
            await new Promise<void>(resolve => request.signal?.addEventListener('abort', () => resolve(), { once: true }));
            throw new Error('cancelled');
        } });
    let service!: ReturnType<typeof fixture>;
    const panel = new ChatPanelController(() => service = fixture(repository, registry), () => {});
    try {
        await panel.attach(pathToFileURL(dir).href);
        await panel.newChat('');
        const id = panel.chatId!;
        panel.draft = 'Stop me';
        const run = panel.runTurn({ connectionId: 'one', modelId: 'chat' });
        await until(() => panel.stream?.content === 'Partial' || !!panel.error);
        assert.equal(panel.error, '');
        service.emit({ kind: 'assistant-delta', projectHandle: 'other', revision: 99, chatId: id,
            messageId: randomUUID(), executionId: randomUUID(), sequence: 0, delta: 'bad' });
        assert.equal(panel.stream?.content, 'Partial');
        await panel.cancel();
        assert.equal(await run, false);
        assert.equal(panel.chat!.messages.at(-1)?.role, 'assistant');
        const last = panel.chat!.messages.at(-1)!;
        if (last.role !== 'assistant') assert.fail();
        assert.equal(last.execution.status, 'cancelled');
        assert.equal(last.content, 'Partial');
        assert.equal(panel.stream, undefined);
        await panel.attach(undefined);
        service.emit({ kind: 'assistant-delta', projectHandle: 'old', revision: 99, chatId: id,
            messageId: last.id, executionId: last.execution.id, sequence: 1, delta: 'stale' });
        assert.equal(panel.snapshot, undefined);
    } finally { panel.dispose(); await rm(dir, { recursive: true, force: true }); }
});

test('panel source keeps input and toolbar rows with setup, settings and transcript status', async () => {
    const source = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    assert.match(source, /composer\.append\(input, toolbar\)/);
    assert.match(source, /toolbar\.append\(this\.button\(`Context/);
    assert.match(source, /this\.button\('Tools'/);
    assert.match(source, /Set up models/);
    assert.match(source, /Chat settings/);
    assert.match(source, /execution\.status/);
    assert.match(source, /actualModel\.providerId/);
});

test('unavailable selection never routes to another connected model', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'dope-composer-no-model-'));
    const repository = new ChatRepository();
    const registry = new ModelConnectionsRegistry({ async read() { return []; }, async write() {} });
    await registry.upsert({ id: 'ready', providerId: 'local', label: 'Ready' });
    let generated = 0;
    await registry.connect('ready', { async discoverModels() { return [{ id: 'chat', label: 'chat',
        capabilities: { conversationalText: true, streaming: true } }]; },
        async *generateConversation() { generated++; } });
    const panel = new ChatPanelController(() => fixture(repository, registry), () => {});
    try {
        await panel.attach(pathToFileURL(dir).href);
        await panel.newChat('');
        panel.draft = 'Keep private';
        assert.equal(await panel.runTurn({ connectionId: 'missing', modelId: 'chat' }), false);
        assert.match(panel.error, /Selected model is unavailable/);
        assert.equal(panel.chat!.messages.length, 0);
        assert.equal(panel.draft, 'Keep private');
        assert.equal(generated, 0);
    } finally { panel.dispose(); await rm(dir, { recursive: true, force: true }); }
});
