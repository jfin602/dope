import assert from 'node:assert/strict';
import test from 'node:test';
import { piConversation } from '../../packages/theia-extension/lib/node/pi-conversation-runtime.js';

const selection = { connectionId: 'local', modelId: 'fixture-model' };
const bridge = { bind: async () => ({ connectionId: 'local', modelId: 'fixture-model',
    endpoint: 'http://127.0.0.1:1234/v1', contextWindowTokens: 8192, maxOutputTokens: 2048 }) };
function fixture(result = { text: 'safe answer', modelId: 'fixture-model', finishReason: 'stop',
    usage: { tokenMeasurement: 'provider-reported', inputTokens: 25, outputTokens: 2, totalTokens: 27 } }) {
    const calls: unknown[] = [];
    const host = { start: async () => ({ tools: [] }),
        async *streamTurn(messages: unknown, limit: number, signal?: AbortSignal) {
            calls.push({ messages, limit, signal });
            yield { type: 'delta', text: result.text };
            yield { type: 'complete', ...result };
        } };
    const factory = { create: () => host, release: () => {} };
    return { calls, factory };
}

test('Pi turn preserves exact model, saved follow-up roles, streaming and bounded usage', async () => {
    const { calls, factory } = fixture();
    const events = [];
    const messages = [{ role: 'system', content: 'Dope scope' }, { role: 'user', content: 'first' },
        { role: 'assistant', content: 'previous answer' }, { role: 'user', content: 'follow up' }] as const;
    for await (const event of piConversation(selection, { messages, maxOutputTokens: 128 },
        bridge as never, factory as never)) events.push(event);
    assert.deepEqual(events.map(event => event.type), ['delta', 'complete']);
    assert.deepEqual((calls[0] as { messages: unknown }).messages, messages);
    assert.equal((calls[0] as { limit: number }).limit, 128);
    assert.equal((events.at(-1) as { actualModelId: string }).actualModelId, 'fixture-model');
    assert.equal((events.at(-1) as { usage: { totalTokens: number } }).usage.totalTokens, 27);
});

test('Pi stops on changed model, insufficient context and cancellation', async () => {
    const changed = fixture({ text: 'wrong', modelId: 'other', finishReason: 'stop',
        usage: { tokenMeasurement: 'provider-reported', inputTokens: 1, outputTokens: 1, totalTokens: 2 } });
    await assert.rejects(async () => {
        for await (const _event of piConversation(selection, { messages: [{ role: 'user', content: 'hi' }] },
            bridge as never, changed.factory as never)) { /* inspect completion */ }
    }, /different model/);
    const oversized = fixture();
    await assert.rejects(async () => {
        for await (const _event of piConversation(selection, { messages: [{ role: 'user', content: 'x'.repeat(30000) }] },
            bridge as never, oversized.factory as never)) { /* denied before inference */ }
    }, /measured model budget/);
    assert.equal(oversized.calls.length, 0);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(async () => {
        for await (const _event of piConversation(selection, { messages: [{ role: 'user', content: 'hi' }],
            signal: controller.signal }, bridge as never, fixture().factory as never)) { /* cancelled */ }
    }, /cancelled/);
});

test('active Pi cancellation stops the worker turn and preserves cancelled status', async () => {
    const controller = new AbortController();
    let released = false;
    const host = { start: async () => ({}), async *streamTurn(_messages: unknown, _limit: number,
        signal?: AbortSignal) {
        await new Promise<void>(resolve => signal?.addEventListener('abort', () => resolve(), { once: true }));
        throw new Error('Worker stopped');
    } };
    const factory = { create: () => host, release: () => { released = true; } };
    const turn = (async () => {
        for await (const _event of piConversation(selection, { messages: [{ role: 'user', content: 'wait' }],
            signal: controller.signal }, bridge as never, factory as never)) { /* no output */ }
    })();
    setImmediate(() => controller.abort());
    await assert.rejects(turn, /Conversation cancelled/);
    assert.equal(released, true);
});
