import assert from 'node:assert/strict';
import test from 'node:test';
import { LocalAgentTurnLoop } from '../../packages/theia-extension/lib/node/local-agent-turn-loop.js';
import { LocalContextBudget } from '../../packages/theia-extension/lib/node/local-context-budget.js';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { ModelRuntimeFailure } from '../../packages/contracts/lib/model-runtime.js';

const connection: any = { version: 1, id: 'local', alias: 'Local', lifecycle: 'enabled',
    config: { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234/v1' } };
const inventory = (): any => ({ registry: { revision: 1, connections: [connection],
    models: [{ connectionId: 'local', providerModelKey: 'model', enabled: true, state: 'ready' }] },
loadedLocalModels: [{ connectionId: 'local', providerModelKey: 'model', contextWindowTokens: 65536 }] });
const read = (id: string) => ({ id, name: 'read' as const, arguments: { path: 'src/a.ts', maxBytes: 100 } });
const grant = createDefaultExecutionGrant({ id: 'grant', revision: 1, taskId: 'task',
    acceptedAt: '2026-10-10T00:00:00.000Z' });
function harness(replies: any[], execute?: (call: any, signal: AbortSignal) => Promise<any>) {
    const sent: any[] = [];
    const events: any[] = [];
    let active = true;
    const transport = { turn: async (request: any) => {
        sent.push(structuredClone(request.messages));
        const reply = replies.shift();
        if (reply instanceof Error) throw reply;
        return reply;
    } };
    const broker = { assertActive: async () => { if (!active) throw new Error('secret workspace error'); },
        execute: execute ?? (async (call: any) => ({ id: call.id, name: call.name,
            status: 'completed', output: 'file contents', truncated: false })) };
    const loop = new LocalAgentTurnLoop(transport as any, broker as any);
    const abort = new AbortController();
    const input: any = { request: { projectRoot: '/project', executionRoot: '/candidate', grant,
        taskId: 'task', connectionId: 'local', registrationId: 'registration', modelId: 'model',
        prompt: 'Do work', onEvent: (event: any) => events.push(event) },
        connection, loadedModelIds: ['model'], inventory: async () => inventory(),
        budget: new LocalContextBudget('local', 'model', inventory()), signal: abort.signal };
    return { loop, input, sent, events, abort, revoke: () => { active = false; } };
}
const rejected = (work: Promise<unknown>, pattern: RegExp) => assert.rejects(work,
    (error: any) => pattern.test(error.message) && !/secret raw|secret workspace/.test(error.message));

test('two turns correlate tool call and result, sanitize result and final transcript', async () => {
    const h = harness([{ kind: 'tools', calls: [read('call_1')] },
        { kind: 'final', text: 'Done. authorization=secret raw token' }],
    async call => ({ id: call.id, name: call.name, status: 'completed',
        output: 'secret=secret raw payload', truncated: false }));
    const result = await h.loop.run(h.input);
    assert.doesNotMatch(result, /secret raw/);
    assert.equal(h.sent.length, 2);
    assert.equal(h.sent[1][2].tool_calls[0].id, 'call_1');
    assert.equal(h.sent[1][3].tool_call_id, 'call_1');
    assert.match(h.sent[1][3].content, /\[redacted\]/);
    assert.doesNotMatch(JSON.stringify(h.sent[1]), /secret raw/);
    assert.deepEqual(h.events.map(event => event.kind), ['status', 'agent-message', 'status']);
    assert.doesNotMatch(JSON.stringify(h.events), /secret raw/);
});

test('repeated completed process is redirected once without duplicate execution', async () => {
    const process = (id: string) => ({ id, name: 'process' as const,
        arguments: { kind: 'test' as const, commandId: 'validation-1' } });
    let executions = 0;
    const h = harness([{ kind: 'tools', calls: [process('first')] },
        { kind: 'tools', calls: [process('repeat')] },
        { kind: 'final', text: 'Test passed; task complete.' }], async call => {
        executions++;
        return { id: call.id, name: call.name, status: 'completed', output: 'test passed', truncated: false };
    });
    assert.equal(await h.loop.run(h.input), 'Test passed; task complete.');
    assert.equal(executions, 1);
    assert.equal(h.sent.length, 3);
    assert.match(h.sent[2].at(-1).content, /already completed successfully/);
});

test('completion prose on a redundant completed process ends without another effect', async () => {
    let executions = 0;
    const process = (id: string) => ({ id, name: 'process' as const,
        arguments: { kind: 'test' as const, commandId: 'validation-1' } });
    const h = harness([{ kind: 'tools', calls: [process('first')] },
        { kind: 'tools', calls: [process('repeat')], text: 'I fixed the file and the test passed.' }], async call => {
        executions++;
        return { id: call.id, name: call.name, status: 'completed', output: 'test passed', truncated: false };
    });
    assert.equal(await h.loop.run(h.input), 'I fixed the file and the test passed.');
    assert.equal(executions, 1);
    assert.equal(h.sent.length, 2);
});

test('unknown, duplicate, missing IDs and mismatched terminal results fail closed', async () => {
    for (const bad of [
        [{ kind: 'tools', calls: [{ id: 'a', name: 'shell', arguments: {} }] }],
        [{ kind: 'tools', calls: [read('a'), read('a')] }],
        [{ kind: 'tools', calls: [{ ...read('a'), id: '' }] }],
        [{ kind: 'tools', calls: [read('a')] }, { kind: 'tools', calls: [read('a')] }]
    ]) {
        const h = harness(bad);
        await rejected(h.loop.run(h.input), /invalid|duplicate/i);
    }
    const h = harness([{ kind: 'tools', calls: [read('a')] }],
        async () => ({ id: 'wrong', name: 'read', status: 'completed', output: '', truncated: false }));
    await rejected(h.loop.run(h.input), /does not match/);
});
test('no progress, finite turns/tools and provider errors stop without raw payload', async () => {
    const repeated = harness([{ kind: 'tools', calls: [read('a')] },
        { kind: 'tools', calls: [read('b')] }]);
    await rejected(repeated.loop.run(repeated.input), /repeated/);
    const empty = harness([{ kind: 'final', text: '' }, { kind: 'final', text: '' }]);
    await rejected(empty.loop.run(empty.input), /no progress/);
    const turns = harness(Array.from({ length: 13 }, (_, i) => ({ kind: 'tools', calls: [
        { ...read(`turn_${i}`), arguments: { path: 'src/a.ts', maxBytes: 100 + i } }
    ] })));
    await rejected(turns.loop.run(turns.input), /turn limit/);
    const calls = harness([{ kind: 'tools', calls: Array.from({ length: 8 }, (_, i) => ({ ...read(`a${i}`), arguments: { path: 'src/a.ts', maxBytes: 100 } })) },
        { kind: 'tools', calls: Array.from({ length: 8 }, (_, i) => ({ ...read(`b${i}`), arguments: { path: 'src/a.ts', maxBytes: 101 } })) },
        { kind: 'tools', calls: Array.from({ length: 8 }, (_, i) => ({ ...read(`c${i}`), arguments: { path: 'src/a.ts', maxBytes: 102 } })) },
        { kind: 'tools', calls: Array.from({ length: 8 }, (_, i) => ({ ...read(`d${i}`), arguments: { path: 'src/a.ts', maxBytes: 103 } })) },
        { kind: 'tools', calls: [read('overflow')] }]);
    await rejected(calls.loop.run(calls.input), /tool limit/);
    const provider = harness([new Error('secret raw provider failure')]);
    await rejected(provider.loop.run(provider.input), /model turn failed/);
    const classified = harness([new ModelRuntimeFailure('secret raw provider failure', 'transient-upstream')]);
    await assert.rejects(classified.loop.run(classified.input), (error: any) =>
        error.failureClass === 'transient-upstream' && error.message === 'Local model turn failed');
});

test('cancel, disposed run, revoked workspace and denied effect stop before continuation', async () => {
    const cancelled = harness([{ kind: 'final', text: 'should not run' }]);
    cancelled.abort.abort();
    await rejected(cancelled.loop.run(cancelled.input), /cancelled/);
    assert.equal(cancelled.sent.length, 0);
    const disposed = harness([{ kind: 'final', text: 'should not run' }]);
    disposed.loop.dispose();
    await rejected(disposed.loop.run(disposed.input), /disposed/);
    const revoked = harness([{ kind: 'final', text: 'should not run' }]);
    revoked.revoke();
    await rejected(revoked.loop.run(revoked.input), /workspace no longer active/);
    const denied = harness([{ kind: 'tools', calls: [read('a')] }, { kind: 'final', text: 'wrong' }],
        async call => ({ id: call.id, name: call.name, status: 'denied', output: 'secret raw', truncated: false }));
    await rejected(denied.loop.run(denied.input), /effect denied/);
    assert.equal(denied.sent.length, 1);
    assert.ok(denied.events.some(event => event.kind === 'authority-denied'));
    assert.doesNotMatch(JSON.stringify(denied.events), /secret raw/);
});

test('context overflow and cancellation during a broker call stop before another model turn', async () => {
    const overflow = harness([{ kind: 'final', text: 'wrong' }]);
    overflow.input.request.prompt = 'x'.repeat(33_000);
    await rejected(overflow.loop.run(overflow.input), /context history exceeds budget/);
    assert.equal(overflow.sent.length, 0);
    const pending = harness([{ kind: 'tools', calls: [read('a')] }, { kind: 'final', text: 'wrong' }],
        async (_call, signal) => new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(new Error('secret raw cancellation')),
                { once: true });
        }));
    const work = pending.loop.run(pending.input);
    await new Promise(resolve => setImmediate(resolve));
    pending.abort.abort();
    await rejected(work, /cancelled/);
    assert.equal(pending.sent.length, 1);
});
