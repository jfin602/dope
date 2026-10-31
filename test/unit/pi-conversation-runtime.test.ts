import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
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

test('Pi Chat passes brokered project tools through the exact local session', async () => {
    const observed: unknown[] = [];
    const localBridge = { bind: async (_selection: unknown, _host: unknown, cwd: string, options: unknown) => {
        observed.push({ cwd, options });
        return { contextWindowTokens: 8192, maxOutputTokens: 2048 };
    } };
    const host = { start: async () => ({}), async *streamTurn(_messages: unknown, _limit: number,
        _signal?: AbortSignal, onTool?: (call: { id: number; name: string; arguments: unknown }) => Promise<unknown>) {
        observed.push(await onTool!({ id: 1, name: 'read_file', arguments: { path: 'src/index.html' } }));
        yield { type: 'complete', text: 'The page has a heading.', modelId: 'fixture-model', finishReason: 'stop',
            usage: { tokenMeasurement: 'unavailable' } };
    } };
    const events = [];
    for await (const event of piConversation(selection, { messages: [{ role: 'user', content: 'inspect this project' }],
        projectTools: { root: '/project', execute: async (name, args) => {
            observed.push({ name, args }); return '<h1>Heading</h1>';
        } } }, localBridge as never, { create: () => host, release: () => {} } as never)) events.push(event);
    assert.deepEqual(observed, [
        { cwd: '/project', options: { chatTools: true } },
        { name: 'read_file', args: { path: 'src/index.html' } },
        { status: 'completed', output: '<h1>Heading</h1>' }
    ]);
    assert.equal(events.at(-1)?.type, 'complete');
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

test('Pi host failure is explicit and a fresh Dope turn can rebind without replay', async () => {
    let attempts = 0;
    let released = 0;
    const healthy = fixture();
    const factory = { create() {
        attempts++;
        if (attempts === 1) return { async start() { throw new Error('worker exited'); } };
        return healthy.factory.create();
    }, release() { released++; } };
    const messages = [{ role: 'system', content: 'Keep source hash abc and approved no-write constraint' },
        { role: 'user', content: 'Resume from saved Dope Chat' }] as const;
    await assert.rejects(async () => {
        for await (const _event of piConversation(selection, { messages }, bridge as never,
            factory as never)) { /* stopped before model request */ }
    }, /Bundled Pi worker unavailable/);
    assert.equal(healthy.calls.length, 0);
    const events = [];
    for await (const event of piConversation(selection, { messages }, bridge as never,
        factory as never)) events.push(event);
    assert.equal(healthy.calls.length, 1);
    assert.deepEqual((healthy.calls[0] as { messages: unknown }).messages, messages);
    assert.equal(released, 2);
    assert.equal(events.at(-1)?.type, 'complete');
});

test('Pi accepts compactable prior Chat context while keeping current constraints bounded', async () => {
    const { calls, factory } = fixture();
    const messages = [{ role: 'system', content: 'Keep source hash abc and approved no-write constraint' },
        ...Array.from({ length: 24 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user',
            content: 'older context '.repeat(40) })),
        { role: 'user', content: 'Recall source hash abc' }] as const;
    for await (const _event of piConversation(selection, { messages }, bridge as never,
        factory as never)) { /* exact history reaches bounded Pi worker */ }
    assert.equal(calls.length, 1);
    assert.deepEqual((calls[0] as { messages: unknown }).messages, messages);
});

test('Pi Chat completion carries the exact Dope context identity for persistence', async () => {
    const messages = [{ role: 'system', content: 'Approved source abc' },
        { role: 'user', content: 'Continue' }] as const;
    const compaction = { originalSha256: 'b'.repeat(64), compactedSha256: 'c'.repeat(64), tokensBefore: 4940 };
    const { factory } = fixture({ text: 'safe answer', modelId: 'fixture-model', finishReason: 'stop',
        usage: { tokenMeasurement: 'provider-reported', inputTokens: 25, outputTokens: 2, totalTokens: 27 },
        compaction } as any);
    const events = [];
    for await (const event of piConversation(selection, { messages }, bridge as never, factory as never)) events.push(event);
    const completed = events.at(-1);
    assert.equal(completed?.type, 'complete');
    if (completed?.type !== 'complete') throw new Error('completion missing');
    assert.deepEqual(completed.compaction, { canonicalContextSha256:
        createHash('sha256').update(JSON.stringify(messages)).digest('hex'), ...compaction });
});

test('Pi repeated-evidence stop remains an incomplete answer, never a completion event', async () => {
    const host = { start: async () => ({}), async *streamTurn() {
        throw new Error('Repeated unchanged project evidence stopped this Chat turn');
    } };
    const events = [];
    await assert.rejects(async () => {
        for await (const event of piConversation(selection, { messages: [{ role: 'user', content: 'Inspect source' }] },
            bridge as never, { create: () => host, release: () => {} } as never)) events.push(event);
    }, /stopped after repeated unchanged project evidence/);
    assert.equal(events.some(event => event.type === 'complete'), false);
});
