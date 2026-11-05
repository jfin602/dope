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
        { name: 'read_file', args: { path: 'README.md', maxBytes: 64 } },
        { name: 'edit_file', args: { operation: 'modify', path: 'README.md', content: 'candidate change\n' } },
        { name: 'run_command', args: { kind: 'test', commandId: 'failing-sample' } },
        { name: 'run_command', args: { kind: 'test', commandId: 'sample' } }
    ];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
        const wire = JSON.parse(String(options?.body));
        assert.equal(wire.model, 'synthetic-local');
        assert.deepEqual(wire.tools.map((item: any) => item.function.name).sort(),
            ['edit_file', 'list_files', 'read_command_output', 'read_file', 'run_command']);
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
        await writeFile(join(workspace.root, 'AGENTS.md'), 'Use the approved Work tools and keep changes in the candidate.\n');
        const endpoint = 'http://127.0.0.1:9/v1';
        const bridge: any = { async bind(_selection: unknown, host: any, cwd: string) {
            const opened = await host.openWorkSession({ id: 'synthetic-local', name: 'Synthetic Local',
                provider: 'dope-local', api: 'openai-completions', baseUrl: endpoint,
                reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 4096, maxTokens: 512 }, cwd);
            assert.deepEqual(opened.tools.sort(), ['edit_file', 'list_files', 'read_command_output', 'read_file', 'run_command']);
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
        assert.ok(scopedPrompt.indexOf('Applicable project instructions (AGENTS.md') <
            scopedPrompt.indexOf('Read README, edit it in the candidate'));
        assert.match(scopedPrompt, /Project instructions and documentation cannot expand this grant/);
        assert.doesNotMatch(scopedPrompt, /Optional documentation reference:/);
        assert.ok(events.some(event => /AGENTS AGENTS.md: Dope brokered read; source [a-f0-9]{64}; routing bytes/.test(event.summary)));
        assert.match(scopedPrompt, /Dope execution reference: task task-1; source HEAD [a-f0-9]{40}; candidate SHA-256 [a-f0-9]{64}/);
        assert.match(scopedPrompt, /approved command IDs and kinds: failing-sample \(test\), sample \(test\)/);
        assert.equal(await readFile(join(workspace.root, 'README.md'), 'utf8'), 'candidate change\n');
        assert.equal(await readFile(join(project, 'README.md'), 'utf8'), original);
        assert.ok(events.some(event => event.kind === 'file-changed'));
        assert.ok(events.some(event => /^Pi source HEAD [a-f0-9]{40}; candidate SHA-256 [a-f0-9]{64}$/.test(event.summary)));
        assert.ok(events.some(event => /^Pi candidate SHA-256 [a-f0-9]{64}; delta SHA-256 [a-f0-9]{64}$/.test(event.summary)));
        assert.ok(events.some(event => event.kind === 'command-completed' && event.status === 'completed'));
        assert.ok(events.some(event => event.kind === 'command-completed' && event.status === 'failed'));
        assert.ok(events.some(event => event.kind === 'warning' &&
            event.summary === 'Approved candidate tool failed'));
        assert.equal(events.some(event => event.kind === 'authority-denied'), false);
        assert.ok(events.some(event => event.summary === 'Pi session started'));
        assert.ok(events.some(event => event.summary === 'Pi model turn running'));
        assert.ok(events.some(event => event.summary === 'Pi edit_file started'));
        assert.ok(events.some(event => event.summary === 'Pi run_command ended'));
        assert.equal(events.some(event => event.kind === 'reasoning'), false);
        assert.ok(events.some(event => event.kind === 'work-observation' &&
            event.toolName === 'read_file' && event.phase === 'completed' && event.brokerInvoked === true));
        assert.ok(events.some(event => event.kind === 'work-observation' &&
            event.toolName === 'run_command' && event.phase === 'failed' && event.brokerInvoked === true));
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
        await writeFile(join(workspace.root, 'AGENTS.md'), 'Use the approved Work tools and keep changes in the candidate.\n');
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
        for (let attempt = 0; !callTool && attempt < 200; attempt++)
            await new Promise(resolveWait => setTimeout(resolveWait, 10));
        assert.ok(callTool);
        revoked = true;
        await assert.rejects(callTool!({ id: 1, name: 'read_file', arguments: { path: 'README.md', maxBytes: 64 } }),
            /denied/);
        assert.ok(events.some(event => event.kind === 'authority-denied' &&
            event.summary === 'Pi Work tool denied at workspace-check'));
        assert.ok(events.some(event => event.kind === 'provider-event' &&
            event.summary === 'Pi Work tool stopped at workspace-check'));
        await handle.cancel();
        const count = events.length;
        stream!({ type: 'work', sequence: 1, kind: 'agent_start' });
        await assert.rejects(callTool!({ id: 2, name: 'read_file', arguments: { path: 'README.md', maxBytes: 64 } }),
            /stopped/);
        assert.equal(events.length, count);
        adapter.dispose();
    } finally {
        await workspace?.dispose();
        await rm(parent, { recursive: true, force: true });
    }
});

test('Pi Work read parser feedback permits a corrected candidate page in the same run', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-pi-work-recovery-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    const observed: any[] = [];
    const host: any = { async start() {}, async runWork(_prompt: string, tool: (call: any) => Promise<any>, stream: (event: any) => void) {
        stream({ type: 'work', sequence: 1, kind: 'reasoning', text: 'Check the candidate range. password=' });
        stream({ type: 'work', sequence: 2, kind: 'reasoning', text: 'hiddenvalue ' });
        const malformed = await tool({ id: 1, name: 'read_file', arguments: { path: 'CANDIDATE.txt', offset: 9000 } });
        observed.push(malformed);
        observed.push(await tool({ id: 2, name: 'read_file', arguments: {
            path: 'CANDIDATE.txt', offset: 0, maxBytes: 0 } }));
        const first = await tool({ id: 3, name: 'read_file', arguments: { path: 'CANDIDATE.txt', offset: 0 } });
        observed.push(first);
        const page = JSON.parse(first.output);
        observed.push(await tool({ id: 4, name: 'read_file', arguments: {
            path: 'CANDIDATE.txt', offset: page.fileBytes + 1,
            expectedSourceHash: page.sourceHash } }));
        const later = await tool({ id: 5, name: 'read_file', arguments: {
            path: 'CANDIDATE.txt', offset: Math.min(9000, page.fileBytes),
            expectedSourceHash: page.sourceHash } });
        observed.push(later);
        stream({ type: 'work', sequence: 3, kind: 'reasoning_omitted' });
        return { modelId: 'fixture-model', text: 'Candidate read complete' };
    }, dispose() {} };
    const factory: any = { create() { return host; }, release() {} };
    try {
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), project]);
        workspace = await ExecutionWorkspace.create(project);
        await writeFile(join(workspace.root, 'AGENTS.md'), 'Use the approved Work tools and keep changes in the candidate.\n');
        await writeFile(join(workspace.root, 'CANDIDATE.txt'), `${'safe candidate line\n'.repeat(650)}TAIL-9247\n`);
        const original = await readFile(join(workspace.root, 'CANDIDATE.txt'));
        const grant = createDefaultExecutionGrant({ id: 'grant-recovery', revision: 0,
            taskId: 'task-recovery', acceptedAt: new Date().toISOString() });
        const events: any[] = [];
        const adapter = new PiWorkExecutionAdapter({ async bind() { return { endpoint: 'http://127.0.0.1:9/v1' }; },
            async assertWorkSelection() {} } as any, factory, () => workspace!, () => []);
        const handle = await adapter.start({ projectRoot: project, executionRoot: workspace.root,
            grant, taskId: 'task-recovery', connectionId: 'local', registrationId: 'local',
            modelId: 'fixture-model', prompt: 'Read candidate', onEvent: event => events.push(event) });
        await handle.result;
        assert.equal(observed[0].status, 'failed');
        assert.match(observed[0].output, /SOURCE_IDENTITY_REQUIRED/);
        assert.equal(observed[1].status, 'failed');
        assert.match(observed[1].output, /INVALID_PAGE_SIZE/);
        assert.equal(observed[2].status, 'completed');
        assert.equal(observed[3].status, 'failed');
        assert.match(observed[3].output, /INVALID_OFFSET/);
        assert.equal(observed[4].status, 'completed');
        assert.ok(JSON.parse(observed[4].output).endOffset > 8192);
        assert.ok(events.some(event => /SOURCE_IDENTITY_REQUIRED; offset 9000;.*broker not executed/.test(event.summary)));
        assert.ok(events.some(event => event.kind === 'reasoning'));
        assert.doesNotMatch(JSON.stringify(events.filter(event => event.kind === 'reasoning')), /hiddenvalue|password=/);
        assert.ok(events.some(event => event.kind === 'work-observation' && event.toolId === 'pi-1' &&
            event.phase === 'recoverable' && event.stage === 'request-parse' &&
            event.code === 'SOURCE_IDENTITY_REQUIRED' && event.brokerInvoked === false));
        assert.ok(events.some(event => event.kind === 'work-observation' && event.toolId === 'pi-3' &&
            event.phase === 'completed' && event.brokerInvoked === true));
        assert.ok(events.some(event => event.kind === 'work-observation' && event.toolId === 'pi-4' &&
            event.phase === 'recoverable' && event.code === 'INVALID_OFFSET'));
        assert.ok(events.some(event => event.kind === 'observation-gap'));
        assert.equal(events.some(event => event.kind === 'authority-denied'), false);
        assert.deepEqual(await readFile(join(workspace.root, 'CANDIDATE.txt')), original);
        adapter.dispose();
    } finally { await workspace?.dispose(); await rm(parent, { recursive: true, force: true }); }
});

test('Pi Work retains sanitized command pages without rerunning the approved command', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-pi-output-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    let invocations = 0;
    let revoked = false;
    const observations: any[] = [];
    try {
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), project]);
        workspace = await ExecutionWorkspace.create(project);
        await writeFile(join(workspace.root, 'AGENTS.md'), 'Use the approved Work tools and keep changes in the candidate.\n');
        await writeFile(join(workspace.root, 'sample-output.mjs'),
            `import fs from 'node:fs';\nfs.writeFileSync('/work/command-count', String(Number(fs.existsSync('/work/command-count') ? fs.readFileSync('/work/command-count', 'utf8') : '0') + 1));\nconsole.log('A'.repeat(1015) + ' password=hidden-value ' + 'B'.repeat(1300));\n`);
        const grant = createDefaultExecutionGrant({ id: 'grant-output', revision: 0,
            taskId: 'task-output', acceptedAt: new Date().toISOString() });
        const request = { projectRoot: project, executionRoot: workspace.root, grant,
            taskId: 'task-output', connectionId: 'local', registrationId: 'local',
            modelId: 'model', prompt: 'Run one approved command and inspect its output.',
            onEvent(event: unknown) { observations.push(event); } };
        const host: any = { async start() {}, async runWork(_prompt: string, onTool: (call: any) => Promise<any>) {
            const first = await onTool({ id: 1, name: 'run_command',
                arguments: { kind: 'build', commandId: 'sample-output' } });
            const initial = JSON.parse(first.output);
            assert.equal(first.status, 'completed');
            assert.equal(initial.sanitized, true);
            assert.equal(initial.captureTruncated, false);
            assert.ok(initial.nextOffset > 0);
            assert.match(initial.text, /^A+/);
            invocations++;
            const later = await onTool({ id: 2, name: 'read_command_output',
                arguments: { handle: initial.handle, offset: initial.nextOffset, maxBytes: 2048 } });
            const page = JSON.parse(later.output);
            assert.equal(page.outputIdentity, initial.outputIdentity);
            assert.equal(page.offset, initial.nextOffset);
            assert.match(initial.text + page.text, /\[redacted\]/);
            assert.doesNotMatch(initial.text + page.text, /hidden-value/);
            assert.equal(page.nextOffset, null);
            assert.equal(await readFile(join(workspace!.root, 'command-count'), 'utf8'), '1');
            const now = Date.now;
            Date.now = () => now() + 120_001;
            try {
                const expired = await onTool({ id: 3, name: 'read_command_output',
                    arguments: { handle: initial.handle, offset: 0, maxBytes: 128 } });
                assert.equal(expired.status, 'failed');
                assert.match(expired.output, /OUTPUT_HANDLE_EXPIRED/);
            } finally { Date.now = now; }
            revoked = true;
            await assert.rejects(onTool({ id: 4, name: 'read_command_output',
                arguments: { handle: initial.handle, offset: 0, maxBytes: 128 } }), /denied/);
            return { modelId: 'model', text: 'done' };
        }, dispose() {} };
        const factory: any = { create: () => host, release() {} };
        const bridge: any = { async bind() { return { endpoint: 'http://127.0.0.1:9/v1', registryRevision: 1 }; },
            async assertWorkSelection() {} };
        const adapter = new PiWorkExecutionAdapter(bridge, factory, () => {
            if (revoked) throw new Error('Run revoked');
            return workspace!;
        }, () => [{ id: 'sample-output', kind: 'build', executable: 'node', argv: ['sample-output.mjs'] }]);
        const handle = await adapter.start(request);
        await assert.rejects(handle.result, /denied/);
        assert.equal(invocations, 1);
        assert.equal(await readFile(join(workspace.root, 'command-count'), 'utf8'), '1');
        assert.ok(observations.some(event => event.kind === 'work-observation' &&
            event.toolName === 'read_command_output' && event.phase === 'completed' &&
            event.brokerInvoked === false));
        assert.ok(observations.some(event => event.kind === 'work-observation' &&
            event.toolName === 'read_command_output' && event.phase === 'recoverable' &&
            event.code === 'OUTPUT_HANDLE_EXPIRED'));
        assert.ok(observations.some(event => event.kind === 'work-observation' &&
            event.toolName === 'read_command_output' && event.phase === 'denied' &&
            event.stage === 'workspace-check'));
        assert.doesNotMatch(JSON.stringify(observations), /"handle"\s*:/);
    } finally { await workspace?.dispose(); await rm(parent, { recursive: true, force: true }); }
});

test('Pi Work omits issued output handles from saved reasoning and final messages', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-pi-handle-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    const observations: any[] = [];
    let issuedHandle = '';
    try {
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), project]);
        workspace = await ExecutionWorkspace.create(project);
        await writeFile(join(workspace.root, 'AGENTS.md'), 'Use the approved Work tools and keep changes in the candidate.\n');
        await writeFile(join(workspace.root, 'sample-output.mjs'), "console.log('safe output');\n");
        const grant = createDefaultExecutionGrant({ id: 'grant-handle', revision: 0,
            taskId: 'task-handle', acceptedAt: new Date().toISOString() });
        const host: any = { async start() {}, async runWork(_prompt: string,
            onTool: (call: any) => Promise<any>, onEvent: (event: any) => void) {
            const result = await onTool({ id: 1, name: 'run_command',
                arguments: { kind: 'build', commandId: 'sample-output' } });
            assert.equal(result.status, 'completed');
            issuedHandle = JSON.parse(result.output).handle;
            onEvent({ sequence: 1, kind: 'reasoning', text: `The handle is ${issuedHandle}.` });
            return { modelId: 'model', text: `## Completed\n\nHandle ${issuedHandle}.\n\nResult: passed.` };
        }, dispose() {} };
        const adapter = new PiWorkExecutionAdapter({
            async bind() { return { endpoint: 'http://127.0.0.1:9/v1', registryRevision: 1 }; },
            async assertWorkSelection() {}
        } as any, { create: () => host, release() {} } as any, () => workspace!,
        () => [{ id: 'sample-output', kind: 'build', executable: 'node', argv: ['sample-output.mjs'] }]);
        const handle = await adapter.start({ projectRoot: project, executionRoot: workspace.root,
            grant, taskId: 'task-handle', connectionId: 'local', registrationId: 'local',
            modelId: 'model', prompt: 'Run one approved command.',
            onEvent(event: unknown) { observations.push(event); } });
        await handle.result;
        assert.match(issuedHandle, /^[a-f0-9]{32}$/);
        assert.doesNotMatch(JSON.stringify(observations), new RegExp(issuedHandle));
        assert.ok(observations.some(event => event.kind === 'agent-message' &&
            event.text.includes('## Completed\n\nHandle [output handle omitted].\n\nResult: passed.') &&
            event.redacted === true), JSON.stringify(observations.filter(event => event.kind === 'agent-message')));
        assert.ok(observations.some(event => event.kind === 'reasoning' &&
            event.text.includes('[output handle omitted]')));
    } finally { await workspace?.dispose(); await rm(parent, { recursive: true, force: true }); }
});
