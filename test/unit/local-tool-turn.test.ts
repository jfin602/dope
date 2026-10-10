import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalToolTurnTransport } from '../../packages/theia-extension/lib/node/local-tool-turn.js';
import { LocalContextBudget } from '../../packages/theia-extension/lib/node/local-context-budget.js';

const connection = (endpoint = 'http://127.0.0.1:1234/v1') => ({ version: 1 as const, id: 'local', alias: 'Local',
    lifecycle: 'enabled' as const, config: { type: 'local' as const, runtime: 'lm-studio' as const, endpoint } });
const inventory = (endpoint?: string): any => ({ registry: { revision: 1,
    connections: [connection(endpoint)], models: [{ connectionId: 'local', providerModelKey: 'loaded-model',
        enabled: true, state: 'ready' }] }, loadedLocalModels: [{ connectionId: 'local',
        providerModelKey: 'loaded-model', contextWindowTokens: 65536 }] });
const request = (endpoint?: string) => ({ connection: connection(endpoint), modelId: 'loaded-model',
    loadedModelIds: ['loaded-model'], budget: new LocalContextBudget('local', 'loaded-model', inventory(endpoint)),
    inventory: async () => inventory(endpoint), messages: [{ role: 'user' as const, content: 'Do work' }] });
const completion = (message: object, finish_reason = 'stop') =>
    new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', ...message }, finish_reason }] }), { status: 200 });
const mock = (reply: (url: string, init: RequestInit) => Promise<Response> | Response) =>
    new LocalToolTurnTransport(reply as typeof fetch);
const expectClass = async (work: Promise<unknown>, kind: string) =>
    assert.rejects(work, (error: any) => error.failureClass === kind && !/secret|payload/i.test(error.message));

test('one LM Studio turn declares bounded tools and returns final text', async () => {
    let sent: any;
    const transport = mock((url, init) => {
        assert.equal(url, 'http://127.0.0.1:1234/v1/chat/completions');
        assert.equal(init.redirect, 'error');
        sent = JSON.parse(init.body as string);
        return completion({ content: 'Done' });
    });
    assert.deepEqual(await transport.turn(request()), { kind: 'final', text: 'Done' });
    assert.equal(sent.model, 'loaded-model');
    assert.equal(sent.max_tokens, 512);
    assert.deepEqual(sent.tools.map((tool: any) => tool.function.name), ['read', 'list', 'edit', 'process']);
    assert.equal(sent.stream, false);
});

test('valid call is normalized through the P1 tool parser, never executed', async () => {
    const transport = mock(() => completion({ content: null, tool_calls: [{ id: 'call_1', type: 'function',
        function: { name: 'read', arguments: '{"path":"src/main.ts","maxBytes":100}' } }] }, 'tool_calls'));
    assert.deepEqual(await transport.turn(request()), { kind: 'tools', calls: [{ id: 'call_1', name: 'read',
        arguments: { path: 'src/main.ts', maxBytes: 100 } }] });
});

test('malformed JSON, unknown tool, mixed final text and unsupported envelope fail closed', async () => {
    for (const [name, args, kind] of [['read', '{oops', 'invalid-json'],
        ['shell', '{}', 'unsupported-capability']] as const) {
        const transport = mock(() => completion({ content: null, tool_calls: [{ id: 'call_1', type: 'function',
            function: { name, arguments: args } }] }, 'tool_calls'));
        await expectClass(transport.turn(request()), kind);
    }
    const mixed = mock(() => completion({ content: 'also done', tool_calls: [{ id: 'call_1', type: 'function',
        function: { name: 'read', arguments: '{"path":"x","maxBytes":1}' } }] }, 'tool_calls'));
    await expectClass(mixed.turn(request()), 'invalid-json');
    await expectClass(mock(() => completion({ content: null }, 'tool_calls')).turn(request()), 'unsupported-capability');
});

test('abort, timeout, endpoint and loaded-model failures do not send unsafe requests', async () => {
    const never = mock((_url, init) => new Promise((_resolve, reject) => {
        init.signal!.addEventListener('abort', () => reject(new Error('secret raw abort payload')), { once: true });
    }));
    const abort = new AbortController(); abort.abort();
    await expectClass(never.turn({ ...request(), signal: abort.signal }), 'cancelled');
    await expectClass(never.turn({ ...request(), timeoutMs: 5 }), 'cancelled');
    let called = false;
    const guarded = mock(() => { called = true; return completion({ content: 'bad' }); });
    for (const endpoint of ['http://example.com/v1', 'http://127.0.0.1:1234/v1/other',
        'http://127.0.0.1:1234/v1?next=http://evil', 'https://localhost:1234/v1'])
        await expectClass(guarded.turn(request(endpoint)), 'connection-unavailable');
    await expectClass(guarded.turn({ ...request(), loadedModelIds: [] }), 'model-unavailable');
    assert.equal(called, false);
});

test('oversized response and unavailable provider are sanitized', async () => {
    await expectClass(mock(() => completion({ content: 'x'.repeat(140_000) })).turn(request()), 'invalid-json');
    await expectClass(mock(() => { throw new Error('secret provider payload'); }).turn(request()), 'transient-transport');
    await expectClass(mock(() => new Response('secret provider payload', { status: 503 })).turn(request()), 'transient-upstream');
    await expectClass(mock(() => new Response('secret provider payload', { status: 400 })).turn(request()), 'unsupported-capability');
    await expectClass(mock(() => new Response('{bad json')).turn(request()), 'invalid-json');
    await expectClass(mock(() => new Response(JSON.stringify({ model: 'another-model', choices: [] }))).turn(request()),
        'model-unavailable');
});
