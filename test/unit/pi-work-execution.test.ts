import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { PiWorkExecutionAdapter } from '../../packages/theia-extension/lib/node/pi-work-execution.js';
import { dispatch } from '../../packages/pi-runtime/worker.mjs';

const execute = promisify(execFile);

test('Pi Work model-selected read/edit/test stays in a disposable candidate until Dope promotion', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-pi-work-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    let turn = 0;
    let scopedPrompt = '';
    const calls = [
        { name: 'dope_read', args: { path: 'README.md', maxBytes: 64 } },
        { name: 'dope_edit', args: { operation: 'modify', path: 'README.md', content: 'candidate change\n' } },
        { name: 'dope_process', args: { kind: 'test', commandId: 'failing-sample' } },
        { name: 'dope_process', args: { kind: 'test', commandId: 'sample' } }
    ];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
        const wire = JSON.parse(String(options?.body));
        assert.equal(wire.model, 'synthetic-local');
        assert.deepEqual(wire.tools.map((item: any) => item.function.name).sort(),
            ['dope_edit', 'dope_list', 'dope_process', 'dope_read']);
        const next = calls[turn++];
        const chunks = next ? [
            { delta: { role: 'assistant', tool_calls: [{ index: 0, id: `call-${turn}`, type: 'function',
                function: { name: next.name, arguments: JSON.stringify(next.args) } }] }, finish_reason: null },
            { delta: {}, finish_reason: 'tool_calls' }
        ] : [
            { delta: { role: 'assistant', content: 'Candidate complete.' }, finish_reason: null },
            { delta: {}, finish_reason: 'stop' }
        ];
        const output = chunks.map((choice, index) => `data: ${JSON.stringify({
            id: `synthetic-${turn}-${index}`, object: 'chat.completion.chunk', created: 1,
            model: 'synthetic-local', choices: [{ index: 0, ...choice }] })}\n\n`);
        output.push('data: [DONE]\n\n');
        return new Response(output.join(''), { status: 200,
            headers: { 'content-type': 'text/event-stream' } });
    };
    const factory: any = { create() { return {
        async start() { return { version: '1.4.0', transport: 'supervised-worker', tools: [] }; },
        openWorkSession(model: unknown, cwd: string) { return dispatch({ type: 'open', mode: 'work', model, cwd }); },
        async runWork(prompt: string, onTool: (call: any) => Promise<any>, onEvent: (event: any) => void) {
            scopedPrompt = prompt;
            const original = process.stdout.write;
            const replies: Promise<unknown>[] = [];
            process.stdout.write = function (chunk: any, ...args: any[]) {
                try {
                    const record = JSON.parse(String(chunk));
                    if (record.tool) {
                        replies.push(onTool(record.tool).then(result => dispatch({ type: 'tool-result',
                            toolId: record.tool.id, result }), () => dispatch({ type: 'tool-result',
                            toolId: record.tool.id, result: { status: 'denied', output: '' } })));
                        return true;
                    }
                } catch { /* normal output */ }
                return original.call(this, chunk, ...args);
            } as typeof process.stdout.write;
            try {
                const answer = await dispatch({ type: 'work', id: 10, prompt, emit: onEvent });
                await Promise.all(replies);
                return answer;
            } finally { process.stdout.write = original; }
        },
        dispose() { void dispatch({ type: 'close' }); }
    }; }, release(host: any) { host.dispose(); }, dispose() { void dispatch({ type: 'close' }); } };
    try {
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), project]);
        const original = await readFile(join(project, 'README.md'), 'utf8');
        workspace = await ExecutionWorkspace.create(project);
        const endpoint = 'http://127.0.0.1:9/v1';
        const bridge: any = { async bind(_selection: unknown, host: any, cwd: string) {
            const opened = await host.openWorkSession({ id: 'synthetic-local', name: 'Synthetic Local',
                provider: 'dope-local', api: 'openai-completions', baseUrl: endpoint,
                reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 4096, maxTokens: 512 }, cwd);
            assert.deepEqual(opened.tools.sort(), ['dope_edit', 'dope_list', 'dope_process', 'dope_read']);
            return { endpoint };
        }, async assertWorkSelection() {} };
        const grant = createDefaultExecutionGrant({ id: 'grant-1', revision: 0, taskId: 'task-1',
            acceptedAt: new Date().toISOString() });
        const events: any[] = [];
        const request = { projectRoot: project, executionRoot: workspace.root, grant, taskId: 'task-1',
            connectionId: 'local', registrationId: 'local', modelId: 'synthetic-local',
            selectedRegistryRevision: 1, selectedLoadedContextTokens: 4096,
            prompt: 'Read README, edit it in the candidate, and run the approved test.',
            onEvent(event: unknown) { events.push(event); } };
        let active = true;
        const adapter = new PiWorkExecutionAdapter(bridge, factory, () => {
            if (!active) throw new Error('Run revoked');
            return workspace!;
        }, () => [{ id: 'failing-sample', kind: 'test', executable: 'node',
            argv: ['--test', 'test/fixtures/ide-testing/missing.test.js'] },
            { id: 'sample', kind: 'test', executable: 'node',
                argv: ['--test', 'test/fixtures/ide-testing/sample.test.js'] }]);
        const handle = await adapter.start(request);
        await handle.result;
        assert.equal(turn, 5);
        assert.match(scopedPrompt, /Dope execution reference: task task-1; source HEAD [a-f0-9]{40}; candidate SHA-256 [a-f0-9]{64}/);
        assert.equal(await readFile(join(workspace.root, 'README.md'), 'utf8'), 'candidate change\n');
        assert.equal(await readFile(join(project, 'README.md'), 'utf8'), original);
        assert.ok(events.some(event => event.kind === 'file-changed'));
        assert.ok(events.some(event => /^Pi source HEAD [a-f0-9]{40}; candidate SHA-256 [a-f0-9]{64}$/.test(event.summary)));
        assert.ok(events.some(event => /^Pi candidate SHA-256 [a-f0-9]{64}; delta SHA-256 [a-f0-9]{64}$/.test(event.summary)));
        assert.ok(events.some(event => event.kind === 'command-completed' && event.status === 'completed'));
        assert.ok(events.some(event => event.kind === 'command-completed' && event.status === 'failed'));
        assert.ok(events.some(event => event.summary === 'Pi dope_process failed'));
        assert.equal(events.some(event => event.kind === 'authority-denied'), false);
        assert.ok(events.some(event => event.summary === 'Pi session started'));
        assert.ok(events.some(event => event.summary === 'Pi model turn running'));
        assert.ok(events.some(event => event.summary === 'Pi dope_edit started'));
        assert.ok(events.some(event => event.summary === 'Pi dope_process ended'));
        const commandStart = events.findIndex(event => event.kind === 'command-started');
        const commandEnd = events.findIndex(event => event.kind === 'command-completed');
        assert.ok(commandStart >= 0 && commandEnd > commandStart);
        assert.equal(events[commandEnd].status, 'failed');
        assert.equal(events[commandEnd].exitCode, undefined); // Broker reports status, not an exit code.
        assert.ok(events.some(event => event.summary === 'Pi session settled'));
        await assert.rejects(adapter.start({ ...request, grant: undefined } as any));
        await assert.rejects(adapter.start({ ...request, taskId: 'foreign-task' }));
        await assert.rejects(adapter.start({ ...request, grant: { ...grant, revision: -1 } }));
        await writeFile(join(project, 'README.md'), 'changed source');
        await assert.rejects(adapter.start(request), /basis|changed/i);
        active = false;
        await assert.rejects(adapter.start(request), /revoked/);
        adapter.dispose();
        await assert.rejects(adapter.start(request));
    } finally {
        factory.dispose();
        await workspace?.dispose();
        await rm(parent, { recursive: true, force: true });
        globalThis.fetch = originalFetch;
    }
});

test('Pi Work rejects a revoked callback and ignores late Pi events after cancellation', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-pi-work-cancel-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    let callTool: ((call: any) => Promise<any>) | undefined;
    let stream: ((event: any) => void) | undefined;
    let rejectTurn: ((error: Error) => void) | undefined;
    let revoked = false;
    const host: any = { async start() {}, runWork(_prompt: string, tool: typeof callTool, event: typeof stream) {
        callTool = tool; stream = event;
        return new Promise((_resolve, reject) => { rejectTurn = reject; });
    }, dispose() { rejectTurn?.(new Error('Pi session cancelled')); } };
    const factory: any = { create() { return host; }, release() { host.dispose(); } };
    try {
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), project]);
        workspace = await ExecutionWorkspace.create(project);
        const grant = createDefaultExecutionGrant({ id: 'grant-cancel', revision: 0,
            taskId: 'task-cancel', acceptedAt: new Date().toISOString() });
        const events: any[] = [];
        const adapter = new PiWorkExecutionAdapter({ async bind() { return { endpoint: 'http://127.0.0.1:9/v1' }; },
            async assertWorkSelection() {} } as any, factory, () => {
            if (revoked) throw new Error('Run revoked');
            return workspace!;
        }, () => []);
        const handle = await adapter.start({ projectRoot: project, executionRoot: workspace.root,
            grant, taskId: 'task-cancel', connectionId: 'local', registrationId: 'local',
            modelId: 'fixture-model', prompt: 'Read README', onEvent: event => events.push(event) });
        revoked = true;
        await assert.rejects(callTool!({ id: 1, name: 'dope_read', arguments: { path: 'README.md', maxBytes: 64 } }),
            /denied/);
        assert.ok(events.some(event => event.kind === 'authority-denied'));
        await handle.cancel();
        const count = events.length;
        stream!({ type: 'work', sequence: 1, kind: 'agent_start' });
        await assert.rejects(callTool!({ id: 2, name: 'dope_read', arguments: { path: 'README.md', maxBytes: 64 } }),
            /stopped/);
        assert.equal(events.length, count);
        adapter.dispose();
    } finally {
        await workspace?.dispose();
        await rm(parent, { recursive: true, force: true });
    }
});
