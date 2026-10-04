import assert from 'node:assert/strict';
import test from 'node:test';
import { ModelRuntimeFailure } from '../../packages/contracts/lib/model-runtime.js';
import type { ConversationRequest } from '../../packages/contracts/lib/model-runtime.js';
import { ModelConnectionsRegistry } from '../../packages/theia-extension/lib/node/model-connections.js';
import { OpenAIConversationalProvider } from '../../packages/theia-extension/lib/node/openai-conversational-provider.js';

const model = { id: 'gpt-test', reasoningEfforts: ['low', 'medium'] as const };
const messages = [{ role: 'system' as const, content: 'Be clear' },
    { role: 'user' as const, content: 'Hi' }, { role: 'assistant' as const, content: 'Hello' },
    { role: 'user' as const, content: 'Continue' }];
const request = { modelId: 'gpt-test', messages };
const frame = (event: object) => `event: ${(event as { type: string }).type}\r\ndata: ${JSON.stringify(event)}\r\n\r\n`;
const delta = (text: string) => frame({ type: 'response.output_text.delta', delta: text });
const complete = (modelId = 'gpt-test') => frame({ type: 'response.completed', response: { status: 'completed', model: modelId,
    usage: { input_tokens: 8, output_tokens: 3, total_tokens: 11 } } });
const stream = (...chunks: string[]) => new Response(new ReadableStream<Uint8Array>({
    start(controller) { for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk)); controller.close(); },
}), { headers: { 'Content-Type': 'text/event-stream' } });
const json = (status: number) => new Response(JSON.stringify({ error: { message: 'secret provider payload' } }), { status });
const collect = async (provider: OpenAIConversationalProvider, input: ConversationRequest = request) => {
    const events = [];
    for await (const event of provider.generateConversation(input)) events.push(event);
    return events;
};
const isFailure = (kind: string) => (error: unknown) =>
    error instanceof ModelRuntimeFailure && error.failureClass === kind && !String(error).includes('secret');

test('OpenAI Responses request uses exact configured model, full Dope transcript and configured controls', async () => {
    const calls: { url: string; headers: Headers; body: any }[] = [];
    const provider = new OpenAIConversationalProvider({ apiKey: 'secret', models: [model], fetch: async (url, init) => {
        calls.push({ url: String(url), headers: new Headers(init?.headers), body: JSON.parse(String(init?.body)) });
        return stream(delta('Hel'), delta('lo'), complete('gpt-test-2026-10-01'));
    } });
    assert.deepEqual(await provider.discoverModels(), [{ id: 'gpt-test', label: 'gpt-test', capabilities: {
        conversationalText: true, streaming: true,
        reasoningControls: [{ id: 'reasoning.effort', values: ['low', 'medium'] }] } }]);
    const events = await collect(provider, { ...request, controls: { 'reasoning.effort': 'low' }, maxOutputTokens: 1024 });
    assert.deepEqual(events, [
        { type: 'delta', text: 'Hel' }, { type: 'delta', text: 'lo' },
        { type: 'complete', text: 'Hello', actualModelId: 'gpt-test-2026-10-01', finishReason: 'completed',
            usage: { inputTokens: 8, outputTokens: 3, totalTokens: 11, tokenMeasurement: 'provider-reported' } },
    ]);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.openai.com/v1/responses');
    assert.equal(calls[0].headers.get('Authorization'), 'Bearer secret');
    assert.deepEqual(calls[0].body, { model: 'gpt-test', input: messages, stream: true, store: false,
        truncation: 'disabled', max_output_tokens: 1024, reasoning: { effort: 'low' } });
    assert.equal(JSON.stringify(calls[0].body).includes('secret'), false);
});

test('OpenAI parser handles split CRLF frames and ignores non-text lifecycle events', async () => {
    const payload = frame({ type: 'response.created', response: { id: 'optional' } }) +
        delta('A') + delta('B') + complete();
    const provider = new OpenAIConversationalProvider({ apiKey: 'secret', models: [{ id: 'gpt-test' }],
        fetch: async () => stream(...payload.split('')) });
    assert.deepEqual((await collect(provider)).map(event => event.text), ['A', 'B', 'AB']);
});

test('OpenAI rejects unsupported controls and unavailable models before transport; registry has no fallback', async () => {
    let calls = 0;
    const provider = new OpenAIConversationalProvider({ apiKey: 'secret', models: [model], fetch: async () => {
        calls++;
        return stream(delta('OK'), complete('gpt-test-snapshot'));
    } });
    await assert.rejects(collect(provider, { ...request, modelId: 'other' }), isFailure('model-unavailable'));
    await assert.rejects(collect(provider, { ...request, controls: { 'reasoning.effort': 'high' } }),
        isFailure('unsupported-capability'));
    assert.equal(calls, 0);
    const registry = new ModelConnectionsRegistry({ async read() { return []; }, async write() {} });
    await registry.upsert({ id: 'openai', label: 'OpenAI', providerId: 'openai', apiKey: 'secret' } as any);
    await registry.connect('openai', provider);
    const events = [];
    for await (const event of registry.generate({ connectionId: 'openai', modelId: 'gpt-test' }, { messages }))
        events.push(event);
    assert.deepEqual(events.at(-1)?.provenance, { connectionId: 'openai', modelId: 'gpt-test-snapshot',
        providerId: 'openai', modelLabel: 'gpt-test-snapshot' });
    await assert.rejects(async () => {
        for await (const _ of registry.generate({ connectionId: 'openai', modelId: 'other' }, { messages })) { /* drain */ }
    }, isFailure('model-unavailable'));
    assert.equal(calls, 1);
    assert.equal(JSON.stringify(await registry.list()).includes('secret'), false);
});

test('OpenAI cancellation before and after a delta stops completion', async () => {
    const controller = new AbortController();
    const provider = new OpenAIConversationalProvider({ apiKey: 'secret', models: [model],
        fetch: async () => stream(delta('first'), complete()) });
    controller.abort();
    await assert.rejects(collect(provider, { ...request, signal: controller.signal }), isFailure('cancelled'));
    const afterDelta = new AbortController();
    const iterator = provider.generateConversation({ ...request, signal: afterDelta.signal })[Symbol.asyncIterator]();
    assert.deepEqual((await iterator.next()).value, { type: 'delta', text: 'first' });
    afterDelta.abort();
    await assert.rejects(iterator.next(), isFailure('cancelled'));
});

test('OpenAI classifies HTTP, transport, rejected and incomplete streams without provider payloads', async () => {
    for (const [status, kind] of [[401, 'authentication'], [403, 'authentication'], [429, 'nonretryable-provider'],
        [500, 'transient-upstream'], [400, 'nonretryable-provider'], [404, 'model-unavailable']] as const) {
        const provider = new OpenAIConversationalProvider({ apiKey: 'secret', models: [model], fetch: async () => json(status) });
        await assert.rejects(collect(provider), isFailure(kind));
    }
    for (const [payload, kind] of [[frame({ type: 'error', message: 'secret' }), 'nonretryable-provider'],
        [frame({ type: 'response.failed', response: { error: { message: 'secret' } } }), 'nonretryable-provider'],
        [frame({ type: 'response.failed', response: { error: { code: 'server_error', message: 'secret' } } }),
            'transient-upstream'],
        [frame({ type: 'error', code: 'insufficient_quota', message: 'secret' }), 'nonretryable-provider'],
        [frame({ type: 'response.incomplete', response: {} }), 'nonretryable-provider'],
        [delta('partial'), 'transient-transport'], ['data: invalid\n\n', 'invalid-json']] as const) {
        const provider = new OpenAIConversationalProvider({ apiKey: 'secret', models: [model],
            fetch: async () => stream(payload) });
        await assert.rejects(collect(provider), isFailure(kind));
    }
    const provider = new OpenAIConversationalProvider({ apiKey: 'secret', models: [model],
        fetch: async () => { throw new Error('secret transport details'); } });
    await assert.rejects(collect(provider), isFailure('transient-transport'));
});
