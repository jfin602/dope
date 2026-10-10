import assert from 'node:assert/strict';
import test from 'node:test';
import { LOCAL_TOOL_LIMITS, parseLocalToolRequests, parseLocalToolResult } from
    '../../packages/agent-core/lib/node/local-tool-contracts.js';

const read = { id: 'call-1', name: 'read', arguments: { path: 'src/main.ts', maxBytes: 1024 } };
const parse = (calls: unknown) => parseLocalToolRequests(JSON.stringify(calls));

test('Local tool requests have bounded, exact adapter-only shapes', () => {
    const calls = parse([read,
        { id: 'call-2', name: 'list', arguments: { path: '.', maxEntries: 20 } },
        { id: 'call-3', name: 'edit', arguments: { operation: 'modify', path: 'src/main.ts', content: 'ok' } },
        { id: 'call-4', name: 'process', arguments: { kind: 'test', commandId: 'focused-test' } }]);
    assert.equal(calls.length, 4);
    assert.equal(Object.isFrozen(calls[0].arguments), true);
    assert.deepEqual(parseLocalToolResult({ id: 'call-1', name: 'read', status: 'completed',
        output: 'ok', truncated: false }), { id: 'call-1', name: 'read',
        status: 'completed', output: 'ok', truncated: false });
    for (const status of ['denied', 'failed', 'cancelled'])
        assert.equal(parseLocalToolResult({ id: 'call-1', name: 'read', status,
            output: '', truncated: false }).status, status);
});

test('reject malformed, mixed, truncated, oversized, unknown, and repeated calls', () => {
    for (const json of ['{', '[]', '{}', JSON.stringify([read]) + '{}',
        JSON.stringify([read]).slice(0, -1), JSON.stringify({ calls: [read] })])
        assert.throws(() => parseLocalToolRequests(json));
    for (const calls of [
        [{ ...read, name: 'network' }], [{ ...read, name: 'delete' }],
        [{ ...read, id: 'bad id' }], [{ ...read, id: '../bad' }],
        [{ ...read, permission: 'all' }],
        [{ ...read, arguments: { ...read.arguments, effect: 'network' } }],
        [{ ...read, arguments: { ...read.arguments, maxBytes: LOCAL_TOOL_LIMITS.readBytes + 1 } }],
        [{ ...read, arguments: { ...read.arguments, recursive: { depth: 999 } } }],
        [{ ...read, arguments: { path: ['src/main.ts'], maxBytes: 10 } }],
        [{ ...read, arguments: { path: 'src/main.ts' } }],
        [{ ...read, arguments: { ...read.arguments, path: 'x'.repeat(LOCAL_TOOL_LIMITS.pathBytes + 1) } }],
        [{ id: 'edit-1', name: 'edit', arguments: { operation: 'delete', path: 'src/a', content: '' } }],
        [{ id: 'edit-1', name: 'edit', arguments: { operation: 'modify', path: 'src/a',
            content: 'x'.repeat(LOCAL_TOOL_LIMITS.editBytes + 1) } }],
        [{ id: 'proc-1', name: 'process', arguments: { kind: 'git-write', commandId: 'x' } }],
        [{ id: 'proc-1', name: 'process', arguments: { kind: 'test', commandId: 'x', argv: ['sh'] } }],
        [read, read], Array(LOCAL_TOOL_LIMITS.calls + 1).fill(read)
    ]) assert.throws(() => parse(calls));
    assert.throws(() => parseLocalToolRequests(JSON.stringify([read]), new Set(['call-1'])));
    assert.throws(() => parseLocalToolRequests(' '.repeat(LOCAL_TOOL_LIMITS.jsonBytes + 1)));
    assert.throws(() => parseLocalToolResult({ id: 'x', name: 'read', status: 'running', output: '', truncated: false }));
    assert.throws(() => parseLocalToolResult({ id: 'x', name: 'read', status: 'completed',
        output: 'x'.repeat(LOCAL_TOOL_LIMITS.resultBytes + 1), truncated: false }));
});

test('deny absolute, traversal, protected and private path forms in every path tool', () => {
    for (const path of ['/etc/passwd', '../out', 'src/../out', 'src//out', './src/a',
        'C:/private', 'src\\other', '~/secret', '.git/config', 'src/.dope/state',
        '.env', 'src/.env.local', '.ssh/id_rsa', '.npmrc', 'credentials.json', 'src/\nother']) {
        for (const call of [read, { id: 'list-1', name: 'list', arguments: { path, maxEntries: 1 } },
            { id: 'edit-1', name: 'edit', arguments: { operation: 'create', path, content: '' } }])
            assert.throws(() => parse([{ ...call, arguments: { ...call.arguments, path } }]), path);
    }
});
