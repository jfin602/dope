import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatch } from '../../packages/pi-runtime/worker.mjs';

const model = { id: 'offline-work', name: 'Offline Work', provider: 'dope-local',
    api: 'openai-completions', baseUrl: 'http://127.0.0.1:9/v1', reasoning: false,
    input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 8192, maxTokens: 512 };
const descriptor = { name: 'mcp_godot_server_info', description: 'One approved external observation.',
    parameters: { type: 'object', properties: {}, additionalProperties: false } };

test('one existing Pi Work worker session offers the exact optional MCP observation', async () => {
    const originalFetch = globalThis.fetch;
    const originalWrite = process.stdout.write;
    let turns = 0, calls = 0;
    try {
        globalThis.fetch = async (_url, options) => {
            const body = JSON.parse(String(options?.body));
            const names = body.tools.map((item: any) => item.function.name).sort();
            assert.deepEqual(names, ['edit_file', 'list_files', 'mcp_godot_server_info', 'read_file']);
            if (++turns === 2) assert.match(JSON.stringify(body.messages), /fixture observation/);
            const choices = turns === 1 ? [
                { index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'work-mcp-1',
                    type: 'function', function: { name: descriptor.name, arguments: '{}' } }] }, finish_reason: null },
                { index: 0, delta: {}, finish_reason: 'tool_calls' }
            ] : [
                { index: 0, delta: { role: 'assistant', content: 'Observed fixture.' }, finish_reason: null },
                { index: 0, delta: {}, finish_reason: 'stop' }
            ];
            return new Response(choices.map((choice, index) => `data: ${JSON.stringify({
                id: `work-${turns}-${index}`, object: 'chat.completion.chunk', created: 1,
                model: model.id, choices: [choice] })}\n\n`).join('') + 'data: [DONE]\n\n',
            { status: 200, headers: { 'content-type': 'text/event-stream' } });
        };
        process.stdout.write = function (chunk: any, ...args: any[]) {
            try {
                const frame = JSON.parse(String(chunk));
                if (frame.tool) {
                    assert.equal(frame.tool.name, descriptor.name);
                    assert.deepEqual(frame.tool.arguments, {});
                    calls++;
                    queueMicrotask(() => void dispatch({ type: 'tool-result', requestId: frame.id,
                        toolId: frame.tool.id, result: { status: 'completed', output: 'fixture observation' } }));
                    return true;
                }
            } catch { /* ordinary test output */ }
            return originalWrite.call(this, chunk, ...args);
        } as typeof process.stdout.write;
        const opened = await dispatch({ type: 'open', mode: 'work', cwd: process.cwd(), model,
            workProcessAvailable: false, workToolNames: ['read_file', 'list_files', 'edit_file'],
            mcpTools: [descriptor] });
        assert.ok(opened.tools.includes(descriptor.name));
        const answer = await dispatch({ type: 'work', id: 71, prompt: 'Observe server info.' });
        assert.match(answer.text, /Observed fixture/);
        assert.equal(turns, 2);
        assert.equal(calls, 1);
    } finally {
        globalThis.fetch = originalFetch; process.stdout.write = originalWrite;
        await dispatch({ type: 'close' }).catch(() => {});
    }
});

test('Pi Work worker rejects malformed and multiple MCP manifests', async () => {
    for (const mcpTools of [[descriptor, { ...descriptor, name: 'mcp_godot_scene_write' }],
        [{ ...descriptor, parameters: { type: 'object', properties: { path: { type: 'string' } },
            additionalProperties: false } }], [{ ...descriptor, name: 'run_command' }]]) {
        await assert.rejects(dispatch({ type: 'open', mode: 'work', cwd: process.cwd(), model,
            workProcessAvailable: false, mcpTools }));
    }
    await dispatch({ type: 'close' }).catch(() => {});
});
