import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection } from '../../packages/agent-core/lib/work-tool-selection.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { PiRuntimeHost } from '../../packages/theia-extension/lib/node/pi-runtime-host.js';
import { PiWorkExecutionAdapter } from '../../packages/theia-extension/lib/node/pi-work-execution.js';

const execute = promisify(execFile);

test('supervised Pi Work adapter queues during a brokered tool and retains the same session after acknowledgment',
    { timeout: 30_000 }, async () => {
    const project = await mkdtemp(join(tmpdir(), 'dope-work-conversation-'));
    let workspace: ExecutionWorkspace | undefined;
    const seen: any[] = [];
    const provider = createServer(async (request, response) => {
        let body = '';
        for await (const part of request) body += part;
        seen.push(JSON.parse(body));
        const call = seen.length === 1;
        const choice = call ? { delta: { role: 'assistant', tool_calls: [{ index: 0,
            id: 'read-first', type: 'function', function: { name: 'read_file',
                arguments: JSON.stringify({ path: 'README.md', offset: 0, maxBytes: 2048 }) } }] },
            finish_reason: 'tool_calls' } : { delta: { role: 'assistant',
            content: seen.length === 2 ? 'First turn complete.' : 'Second turn complete.' }, finish_reason: 'stop' };
        const base = { id: `fixture-${seen.length}`, object: 'chat.completion.chunk', created: 1,
            model: 'offline-work' };
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0, ...choice }] })}\n\n`);
        response.end('data: [DONE]\n\n');
    });
    provider.listen(0, '127.0.0.1');
    await once(provider, 'listening');
    let releaseTool!: () => void;
    const toolHold = new Promise<void>(resolve => { releaseTool = resolve; });
    let toolEntered!: () => void;
    const toolStarted = new Promise<void>(resolve => { toolEntered = resolve; });
    let turns = 0;
    let acknowledgments = 0;
    let released = 0;
    let handle: Awaited<ReturnType<PiWorkExecutionAdapter['start']>> | undefined;
    const model = { id: 'offline-work', name: 'Offline Work', api: 'openai-completions',
        provider: 'dope-local', baseUrl: `http://127.0.0.1:${(provider.address() as any).port}/v1`,
        reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 4096, maxTokens: 512 };
    const factory: any = { create() {
        const host = new PiRuntimeHost();
        return { start: () => host.start(), openWorkSession: (...args: any[]) =>
            (host.openWorkSession as any)(...args),
            runWork: (prompt: string, onTool: (call: any) => Promise<any>, onEvent: (event: any) => void,
                recovery?: string, messageId?: string) => host.runWork(prompt, async call => {
                    toolEntered();
                    await toolHold;
                    return onTool(call);
                }, onEvent, recovery, messageId),
            dispose: () => host.dispose() };
    }, release(host: any) { released++; host.dispose(); } };
    try {
        await writeFile(join(project, 'README.md'), 'first source\n');
        await execute('git', ['init', '-q', project]);
        await execute('git', ['-C', project, 'add', 'README.md']);
        await execute('git', ['-C', project, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
            'commit', '-qm', 'fixture']);
        workspace = await ExecutionWorkspace.create(project);
        const selection = makeWorkToolSelection({ projectUri: `file://${project}`, taskId: 'task-1',
            grantRevision: 0, connectionId: 'local', modelId: model.id }, ['read_file']);
        const grant = createDefaultExecutionGrant({ id: 'grant-1', revision: 0, taskId: 'task-1',
            acceptedAt: new Date().toISOString(), toolSelection: selection });
        const bridge: any = { async bind(_selection: unknown, host: any, cwd: string, options: any) {
            assert.deepEqual(options.workToolNames, ['read_file']);
            await host.openWorkSession(model, cwd, undefined, undefined, false, [], options.workToolNames);
            return { endpoint: model.baseUrl, registryRevision: 1 };
        }, async assertWorkSelection() {} };
        const adapter = new PiWorkExecutionAdapter(bridge, factory, () => workspace!, () => []);
        const events: any[] = [];
        handle = await adapter.start({ projectRoot: project, executionRoot: workspace.root,
            grant, taskId: 'task-1', connectionId: 'local', registrationId: 'local',
            modelId: model.id, selectedRegistryRevision: 1, selectedLoadedContextTokens: 4096,
            prompt: 'Read README.md and answer.', onEvent(event: unknown) { events.push(event); },
            workSession: { async onTurnSettled() { turns++; }, async onMessageAccepted(id: string) {
                assert.equal(id, 'message-2'); acknowledgments++;
            } } });
        await Promise.race([toolStarted, handle.result.then(() => { throw new Error('Worker finished without a tool'); }),
            new Promise((_, reject) => setTimeout(() => reject(new Error(`Tool did not start; provider calls: ${seen.length}; tools: ${seen.map(w => w.tools?.map((t: any) => t.function?.name))}; events: ${events.map(e => e.summary).join('|')}`)), 5000))]);
        handle.submitWorkMessage!('message-2', 'Continue after reading.');
        assert.equal(acknowledgments, 0);
        assert.equal(turns, 0);
        assert.equal(seen.length, 1);
        releaseTool();
        for (let attempt = 0; attempt < 200 && turns < 2; attempt++)
            await new Promise(resolve => setTimeout(resolve, 10));
        assert.equal(turns, 2);
        assert.equal(acknowledgments, 1);
        assert.equal(released, 0);
        assert.equal(seen.length, 3);
        const users = (wire: any) => wire.messages.filter((message: any) => message.role === 'user')
            .map((message: any) => message.content.map((part: any) => part.text).join(''));
        assert.equal(users(seen[2]).length, 2);
        assert.match(users(seen[2])[1], /Continue after reading/);
        assert.ok(seen[2].messages.some((message: any) => message.role === 'assistant' &&
            message.content === 'First turn complete.'));
        assert.ok(events.some(event => event.kind === 'work-observation' && event.toolName === 'read_file' &&
            event.phase === 'completed' && event.brokerInvoked === true));
        handle.finishWorkSession!();
        await handle.result;
        assert.equal(released, 1);
        assert.equal(await readFile(join(project, 'README.md'), 'utf8'), 'first source\n');
        adapter.dispose();
    } finally {
        releaseTool();
        handle?.terminate?.();
        await workspace?.dispose();
        provider.closeAllConnections();
        provider.close();
        await rm(project, { recursive: true, force: true });
    }
});
