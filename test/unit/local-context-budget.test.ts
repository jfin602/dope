import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalContextBudget } from '../../packages/theia-extension/lib/node/local-context-budget.js';

const snapshot = (capacity?: number, revision = 1, loaded = true): any => ({ registry: { revision,
    connections: [{ id: 'local', lifecycle: 'enabled', config: { type: 'local', runtime: 'lm-studio',
        endpoint: 'http://127.0.0.1:1234/v1' } }],
    models: [{ connectionId: 'local', providerModelKey: 'model', enabled: true, state: 'ready' }] },
    loadedLocalModels: loaded ? [{ connectionId: 'local', providerModelKey: 'model',
        contextWindowTokens: capacity }] : [] });
const budget = (capacity = 4096) => new LocalContextBudget('local', 'model', snapshot(capacity));
const rejected = (work: () => unknown) => assert.throws(work, (error: any) =>
    error.failureClass === 'nonretryable-provider');

test('observed 4096 and 65536 capacities reserve output, system and tool space', () => {
    assert.equal(budget(4096).inputBytes, 2304);
    assert.equal(budget(65536).inputBytes, 32768);
    assert.equal(budget().maxOutputTokens, 512);
    rejected(() => new LocalContextBudget('local', 'model', snapshot(2048)));
    rejected(() => new LocalContextBudget('local', 'model', snapshot(undefined)));
    assert.throws(() => new LocalContextBudget('local', 'model', snapshot(4096, 1, false)),
        (error: any) => error.failureClass === 'model-unavailable');
});

test('history and essential tool state overflow fail; explicit display output clips visibly', () => {
    const small = budget();
    small.prepareTurn(snapshot(4096), [{ content: 'x'.repeat(2000) }]);
    rejected(() => small.prepareTurn(snapshot(4096), [{ content: 'x'.repeat(2300) }]));
    rejected(() => small.recordResult('x'.repeat(9000)));
    const clipped = small.recordResult('é'.repeat(9000), true);
    assert.ok(Buffer.byteLength(clipped) <= 8192);
    assert.match(clipped, /\[Local output truncated by Dope context budget\]$/);
    rejected(() => small.recordOutput('x'.repeat(9000)));
    const display = small.recordOutput('x'.repeat(9000), true);
    assert.ok(Buffer.byteLength(display) <= small.maxOutputTokens);
    assert.match(display, /truncated by Dope context budget/);
});

test('model unload, loaded capacity and registry revision changes fail before another turn', () => {
    const current = budget();
    for (const state of [snapshot(4096, 1, false), snapshot(65536), snapshot(4096, 2)])
        assert.throws(() => current.prepareTurn(state, [{ content: 'continue' }]));
});

test('finite turn, tool and accumulated byte limits', () => {
    const turns = budget();
    for (let i = 0; i < 12; i++) turns.prepareTurn(snapshot(4096), [{ content: 'continue' }]);
    rejected(() => turns.prepareTurn(snapshot(4096), [{ content: 'one more' }]));
    const tools = budget();
    tools.recordToolCalls(32);
    rejected(() => tools.recordToolCalls(1));
    const large = budget(65536);
    for (let i = 0; i < 4; i++) large.prepareTurn(snapshot(65536), [{ content: 'x'.repeat(32000) }]);
    rejected(() => large.prepareTurn(snapshot(65536), [{ content: 'x'.repeat(32000) }]));
});
