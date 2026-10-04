import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelRuntimeFailure } from '../../packages/contracts/lib/model-runtime.js';
import type { ConversationRequest } from '../../packages/contracts/lib/model-runtime.js';
import { GeminiConversationalProvider, LocalConversationalProvider } from
    '../../packages/theia-extension/lib/node/conversational-providers.js';
import { LmStudioSynthesisProvider } from '../../packages/theia-extension/lib/node/lmstudio-synthesis-provider.js';
import { ModelConnectionsRegistry } from '../../packages/theia-extension/lib/node/model-connections.js';

const request = { modelId: 'chat-model', messages: [{ role: 'system' as const, content: 'Be clear' },
    { role: 'user' as const, content: 'Hi' }] };
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value),
    { status, headers: { 'Content-Type': 'application/json' } });
const sse = (frames: string[]) => new Response(frames.map(frame => `data: ${frame}\r\n\r\n`).join(''),
    { headers: { 'Content-Type': 'text/event-stream' } });
const collect = async (provider: { generateConversation: LocalConversationalProvider['generateConversation'] },
    input: ConversationRequest = request) => { const events = []; for await (const event of provider.generateConversation(input)) events.push(event); return events; };
const isFailure = (kind: string) => (error: unknown) => error instanceof ModelRuntimeFailure && error.failureClass === kind;
const native = (id = 'chat-model', context = 4096) => json({ models: [
    { type: 'llm', key: id, loaded_instances: [{ id, config: { context_length: context } }] },
    { type: 'embedding', key: 'embed', loaded_instances: [{ id: 'embed', config: { context_length: 2048 } }] },
] });

test('Local discovery and streaming preserve exact model, order, usage and synthesis state', async () => {
    const synthesis = new LmStudioSynthesisProvider();
    const calls: { url: string; body?: any; authorization?: string | null }[] = [];
    const local = new LocalConversationalProvider({ token: 'secret', fetch: async (url, init) => {
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url: String(url), body, authorization: new Headers(init?.headers).get('Authorization') });
        if (String(url).endsWith('/api/v1/models')) return native();
        if (String(url).endsWith('/v1/models')) return json({ data: [{ id: 'chat-model' }, { id: 'chat-model' }] });
        return sse([
            JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] }),
            JSON.stringify({ choices: [{ delta: { content: 'lo' }, finish_reason: 'stop' }] }),
            JSON.stringify({ choices: [], usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } }),
            '[DONE]',
        ]);
    } });
    assert.deepEqual(await local.discoverModels(), [{ id: 'chat-model', label: 'chat-model',
        capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 4096 } }]);
    assert.deepEqual(await collect(local, { ...request, maxOutputTokens: 1024 }), [
        { type: 'delta', text: 'Hel' }, { type: 'delta', text: 'lo' },
        { type: 'complete', text: 'Hello', finishReason: 'stop', usage: {
            inputTokens: 3, outputTokens: 2, totalTokens: 5, tokenMeasurement: 'provider-reported' } },
    ]);
    assert.equal(calls[2].body.model, 'chat-model');
    assert.deepEqual(calls[2].body.messages, request.messages);
    assert.equal(calls[2].body.max_tokens, 1024);
    assert.equal(calls[2].body.response_format, undefined);
    assert.equal(calls[2].body.stream, true);
    assert.ok(calls.every(call => call.authorization === 'Bearer secret'));
    assert.equal(synthesis.selectedModel, undefined);
    assert.equal(synthesis.isReady, false);
});

test('Local native inventory excludes embeddings, unloaded and unknown-capacity instances from Chat', async () => {
    const local = new LocalConversationalProvider({ fetch: async url => String(url).endsWith('/api/v1/models') ?
        json({ models: [
            { type: 'llm', key: 'chat-model', max_context_length: 131072, loaded_instances: [
                { id: 'instance-a', config: { context_length: 4096 } },
                { id: 'instance-b', config: { context_length: 2048 } }] },
            { type: 'llm', key: 'unloaded', max_context_length: 8192, loaded_instances: [] },
            { type: 'llm', key: 'unknown', loaded_instances: [{ id: 'unknown', config: {} }] },
            { type: 'embedding', key: 'embed', loaded_instances: [{ id: 'embed', config: { context_length: 1024 } }] },
        ] }) : json({ data: ['chat-model', 'instance-a', 'unloaded', 'unknown', 'embed'].map(id => ({ id })) }) });
    const models = await local.discoverModels();
    assert.equal(models.find(item => item.id === 'chat-model')?.capabilities.contextWindowTokens, 2048);
    assert.equal(models.find(item => item.id === 'instance-a')?.capabilities.contextWindowTokens, 4096);
    for (const id of ['unloaded', 'unknown', 'embed']) {
        assert.equal(models.find(item => item.id === id)?.capabilities.conversationalText, false);
        await assert.rejects(collect(local, { ...request, modelId: id }), isFailure('model-unavailable'));
    }
});

test('Local fails closed on unavailable model, reconnect, cancellation and redacted transport errors', async () => {
    let modelId = 'chat-model';
    let streamCalls = 0;
    const local = new LocalConversationalProvider({ token: 'secret', fetch: async (url) => {
        if (String(url).endsWith('/api/v1/models')) return native(modelId);
        if (String(url).endsWith('/v1/models')) return json({ data: [{ id: modelId }] });
        streamCalls++;
        return sse([JSON.stringify({ choices: [{ delta: { content: 'one' } }] }), '[DONE]']);
    } });
    await local.discoverModels();
    await assert.rejects(collect(local, { ...request, modelId: 'other' }), isFailure('model-unavailable'));
    assert.equal(streamCalls, 0);
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(collect(local, { ...request, signal: controller.signal }), isFailure('cancelled'));
    const iterator = local.generateConversation(request)[Symbol.asyncIterator]();
    assert.deepEqual(await iterator.next(), { done: false, value: { type: 'delta', text: 'one' } });
    modelId = 'new-model';
    await local.discoverModels();
    await assert.rejects(iterator.next(), isFailure('connection-unavailable'));
    await assert.rejects(collect(local), isFailure('model-unavailable'));
    const failed = new LocalConversationalProvider({ token: 'secret', fetch: async () => json({ error: 'secret' }, 401) });
    await assert.rejects(failed.discoverModels(), error => isFailure('authentication')(error) && !String(error).includes('secret'));
    const malformed = new LocalConversationalProvider({ fetch: async () => json({ data: [{ wrong: true }] }) });
    await assert.rejects(malformed.discoverModels(), isFailure('invalid-json'));
});

test('Gemini SDK discovery, stream, usage and selected model stay separate from synthesis', async () => {
    const calls: { url: string; body?: any; key?: string | null }[] = [];
    const gemini = new GeminiConversationalProvider({ apiKey: 'secret', fetch: async (url, init) => {
        const body = init?.body ? JSON.parse(String(init.body)) : undefined;
        calls.push({ url: String(url), body, key: new Headers(init?.headers).get('x-goog-api-key') });
        if (/\/models(?:\?|$)/.test(String(url))) return json({ models: [
            { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/gemini-image', supportedGenerationMethods: ['generateContent'] },
        ] });
        return sse([
            JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Hel' }] } }] }),
            JSON.stringify({ candidates: [{ content: { parts: [{ text: 'lo' }] }, finishReason: 'STOP' }],
                usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2, totalTokenCount: 6 } }),
        ]);
    } });
    assert.deepEqual((await gemini.discoverModels()).map(item => item.id), ['gemini-3-flash']);
    assert.deepEqual(await collect(gemini, { ...request, modelId: 'gemini-3-flash', maxOutputTokens: 1024 }), [
        { type: 'delta', text: 'Hel' }, { type: 'delta', text: 'lo' },
        { type: 'complete', text: 'Hello', finishReason: 'STOP', usage: {
            inputTokens: 4, outputTokens: 2, totalTokens: 6, tokenMeasurement: 'provider-reported' } },
    ]);
    assert.equal(calls[1].body.contents[0].role, 'user');
    assert.equal(calls[1].body.systemInstruction.parts[0].text, 'Be clear');
    assert.equal(calls[1].body.generationConfig.maxOutputTokens, 1024);
    assert.ok(calls[1].url.includes('gemini-3-flash'));
    assert.equal(calls[1].key, 'secret');
    assert.equal(JSON.stringify(calls[1].body).includes('secret'), false);
});

test('Gemini rejects undiscovered selection, cancellation, reconnect and redacts SDK failures', async () => {
    let listed = true;
    let failures = false;
    const gemini = new GeminiConversationalProvider({ apiKey: 'secret', fetch: async (url) => {
        if (/\/models(?:\?|$)/.test(String(url))) return json({ models: listed ? [
            { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] }] : [] });
        if (failures) return json({ error: { message: 'secret' } }, 403);
        return sse([JSON.stringify({ candidates: [{ content: { parts: [{ text: 'A' }] } }] })]);
    } });
    await gemini.discoverModels();
    const selected = { ...request, modelId: 'gemini-3-flash' };
    await assert.rejects(collect(gemini, request), isFailure('model-unavailable'));
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(collect(gemini, { ...selected, signal: controller.signal }), isFailure('cancelled'));
    const iterator = gemini.generateConversation(selected)[Symbol.asyncIterator]();
    assert.deepEqual(await iterator.next(), { done: false, value: { type: 'delta', text: 'A' } });
    listed = false;
    await gemini.discoverModels();
    await assert.rejects(iterator.next(), isFailure('connection-unavailable'));
    await assert.rejects(collect(gemini, selected), isFailure('model-unavailable'));
    listed = true;
    await gemini.discoverModels();
    failures = true;
    await assert.rejects(collect(gemini, selected), error => isFailure('authentication')(error) && !String(error).includes('secret'));
});

test('connection registry routes exact Local or Gemini model without fallback', async () => {
    const called: string[] = [];
    const local = new LocalConversationalProvider({ fetch: async (url) => {
        if (String(url).endsWith('/api/v1/models')) return native();
        if (String(url).endsWith('/v1/models')) return json({ data: [{ id: 'chat-model' }] });
        called.push('local');
        return sse([JSON.stringify({ choices: [{ delta: { content: 'L' } }] }), '[DONE]']);
    } });
    const gemini = new GeminiConversationalProvider({ apiKey: 'secret', fetch: async (url) => {
        if (/\/models(?:\?|$)/.test(String(url))) return json({ models: [
            { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] }] });
        called.push('gemini');
        return sse([JSON.stringify({ candidates: [{ content: { parts: [{ text: 'G' }] } }] })]);
    } });
    const registry = new ModelConnectionsRegistry({ async read() { return []; }, async write() {} });
    await registry.upsert({ id: 'local', label: 'Local', providerId: 'local' });
    await registry.upsert({ id: 'gemini', label: 'Gemini', providerId: 'gemini' });
    await registry.connect('local', local);
    await registry.connect('gemini', gemini);
    const generate = async (connectionId: string, modelId: string) => {
        const events = [];
        for await (const event of registry.generate({ connectionId, modelId }, { messages: request.messages })) events.push(event);
        return events;
    };
    const geminiEvents = await generate('gemini', 'gemini-3-flash');
    const localEvents = await generate('local', 'chat-model');
    assert.equal(geminiEvents.at(-1)?.text, 'G');
    assert.deepEqual(geminiEvents.at(-1)?.provenance, { connectionId: 'gemini', modelId: 'gemini-3-flash',
        providerId: 'gemini', modelLabel: 'gemini-3-flash' });
    assert.equal(localEvents.at(-1)?.text, 'L');
    assert.deepEqual(localEvents.at(-1)?.provenance, { connectionId: 'local', modelId: 'chat-model',
        providerId: 'local', modelLabel: 'chat-model' });
    await assert.rejects(generate('gemini', 'chat-model'), isFailure('model-unavailable'));
    assert.deepEqual(called, ['gemini', 'local']);
});

test('both streams stop after cancellation following a delivered delta', async () => {
    const local = new LocalConversationalProvider({ fetch: async (url) => String(url).endsWith('/api/v1/models') ? native() :
        String(url).endsWith('/v1/models') ? json({ data: [{ id: 'chat-model' }] }) : sse([
            JSON.stringify({ choices: [{ delta: { content: 'first' } }] }), '[DONE]']) });
    const gemini = new GeminiConversationalProvider({ apiKey: 'secret', fetch: async (url) =>
        /\/models(?:\?|$)/.test(String(url)) ? json({ models: [
            { name: 'models/gemini-3-flash', supportedGenerationMethods: ['generateContent'] }] }) :
            sse([JSON.stringify({ candidates: [{ content: { parts: [{ text: 'first' }] } }] })]) });
    await local.discoverModels();
    await gemini.discoverModels();
    for (const [provider, modelId] of [[local, 'chat-model'], [gemini, 'gemini-3-flash']] as const) {
        const controller = new AbortController();
        const iterator = provider.generateConversation({ ...request, modelId, signal: controller.signal })[Symbol.asyncIterator]();
        assert.equal((await iterator.next()).value?.text, 'first');
        controller.abort();
        await assert.rejects(iterator.next(), isFailure('cancelled'));
    }
});
