import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection, workToolRegistration, WORK_PI_VERSION,
    WORK_TOOL_CATALOG_REVISION } from '../../packages/agent-core/lib/work-tool-selection.js';
import { ExecutionWorkspace } from '../../packages/agent-core/lib/node/execution-workspace.js';
import { DirectWorkJournal } from '../../packages/agent-core/lib/node/direct-work-journal.js';
import { PiWorkExecutionAdapter, piFileArgumentDetail, projectPathForPiFile } from '../../packages/theia-extension/lib/node/pi-work-execution.js';
import { dispatch } from '../../packages/pi-runtime/worker.mjs';

const execute = promisify(execFile);
const selectedGrant = (project: string, id: string, taskId: string, modelId: string,
    tools: Parameters<typeof makeWorkToolSelection>[1] =
        ['read', 'ls', 'write'], mode: 'isolated' | 'direct' = 'isolated') =>
    createDefaultExecutionGrant({ id, revision: 0, taskId, acceptedAt: new Date().toISOString(),
        toolSelection: makeWorkToolSelection({ projectUri: 'file://' + project, taskId,
            grantRevision: 0, connectionId: 'local', modelId, grantId: id,
            executionMode: mode }, tools) });
const brokerCall = (tool: (call: any) => Promise<any>, call: any) => {
    const registration = workToolRegistration(call.name);
    return tool({ ...call, contract: registration ? {
        revision: WORK_TOOL_CATALOG_REVISION, piVersion: WORK_PI_VERSION,
        schemaHash: registration.schemaHash } : undefined });
};

test('Pi Work file diagnostics distinguish absolute paths without retaining private path bytes or source', () => {
    assert.deepEqual(piFileArgumentDetail({ path: '/home/owner/private/project', limit: 12 }),
        { fields: ['path', 'limit'], pathStatus: 'absolute', limit: 12 });
    assert.deepEqual(piFileArgumentDetail({ path: '.', limit: 12 }),
        { fields: ['path', 'limit'], path: '.', pathStatus: 'project-relative', limit: 12 });
    assert.deepEqual(piFileArgumentDetail({ path: 'src/main.ts', content: 'private source' }),
        { fields: ['path', 'content'], path: 'src/main.ts', pathStatus: 'project-relative', contentBytes: 14 });
    assert.deepEqual(piFileArgumentDetail({ path: '.git/private-secret', content: 'x' }),
        { fields: ['path', 'content'], pathStatus: 'protected', contentBytes: 1 });
});

test('Pi Work absolute file paths resolve only inside the exact execution workspace', () => {
    const workspace = { root: '/tmp/dope-execution-test/work' };
    assert.equal(projectPathForPiFile(workspace.root, workspace), '.');
    assert.equal(projectPathForPiFile(`${workspace.root}/src/main.ts`, workspace), 'src/main.ts');
    assert.equal(projectPathForPiFile('src/main.ts', workspace), 'src/main.ts');
    for (const path of ['/tmp/elsewhere', `${workspace.root}-sibling`, '/project/src/main.ts',
        `${workspace.root}/../elsewhere`, `${workspace.root}//src`, `${workspace.root}/`,
        `${workspace.root}/src/./main.ts`, 'src/../main.ts', '', '~/file', 'C:\\file',
        `${workspace.root}/src\\main.ts`, `${workspace.root}/src\u0000main.ts`])
        assert.throws(() => projectPathForPiFile(path, workspace), /Pi file path/u, path);
});

test('Pi Work Direct write updates canonical source only through the broker', async () => {
    const project = await mkdtemp(join(tmpdir(), 'dope-pi-direct-'));
    let workspace: ExecutionWorkspace | undefined;
    try {
        await mkdir(join(project, 'src'));
        await writeFile(join(project, 'src', 'file.txt'), 'before\n');
        await execute('git', ['init', '-q', project]);
        await execute('git', ['add', 'src/file.txt'], { cwd: project });
        await execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
            'commit', '-qm', 'basis'], { cwd: project });
        const head = (await execute('git', ['rev-parse', 'HEAD'], { cwd: project })).stdout.trim();
        workspace = await ExecutionWorkspace.create(project);
        const grant = selectedGrant(project, 'grant-direct', 'task-direct', 'model', ['write'], 'direct');
        const journal = await DirectWorkJournal.create(project, head, 'task-direct', 'run-direct', grant);
        workspace.bindDirectBasis(journal);
        const host: any = { async start() {}, async runWork(_prompt: string,
            onTool: (call: any) => Promise<any>) {
            const result = await brokerCall(onTool, { id: 1, name: 'write', arguments: {
                path: 'src/file.txt', content: 'direct\n' }, contract: {
                    revision: 4, piVersion: '1.4.0',
                    schemaHash: 'e98a2484f667cf7c22d76ca103bf2022bf9113dc63fe38b899e71c328cb1e833' } });
            assert.equal(result.status, 'completed');
            return { modelId: 'model', text: 'Edited through Dope.' };
        }, dispose() {} };
        const adapter = new PiWorkExecutionAdapter({ async bind() {
            return { endpoint: 'http://127.0.0.1:9/v1', registryRevision: 1 };
        }, async assertWorkSelection() {} } as any,
        { create: () => host, release() {} } as any, () => workspace!, () => [], undefined,
        () => ({ journal, unsaved: async () => false }));
        const run = await adapter.start({ projectRoot: project, executionRoot: workspace.root,
            executionMode: 'direct', grant, taskId: 'task-direct', runId: 'run-direct',
            connectionId: 'local', registrationId: 'local', modelId: 'model',
            prompt: 'Modify the source file.', onEvent() {} });
        await run.result;
        assert.equal(await readFile(join(project, 'src', 'file.txt'), 'utf8'), 'direct\n');
        assert.equal(journal.changes[0].result, 'completed');
    } finally { await workspace?.dispose(); await rm(project, { recursive: true, force: true }); }
});

test('Pi Work serializes parallel Direct write and edit calls in Pi call order', async () => {
    const project = await mkdtemp(join(tmpdir(), 'dope-pi-direct-parallel-'));
    let workspace: ExecutionWorkspace | undefined;
    try {
        await writeFile(join(project, 'index.html'), '<title>Before</title>\n');
        await execute('git', ['init', '-q', project]);
        await execute('git', ['add', 'index.html'], { cwd: project });
        await execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
            'commit', '-qm', 'basis'], { cwd: project });
        const head = (await execute('git', ['rev-parse', 'HEAD'], { cwd: project })).stdout.trim();
        workspace = await ExecutionWorkspace.create(project);
        const grant = selectedGrant(project, 'grant-parallel', 'task-parallel', 'model',
            ['write', 'edit'], 'direct');
        const journal = await DirectWorkJournal.create(project, head, 'task-parallel', 'run-parallel', grant);
        workspace.bindDirectBasis(journal);
        const host: any = { async start() {}, async runWork(_prompt: string,
            onTool: (call: any) => Promise<any>) {
            const [written, edited] = await Promise.all([
                brokerCall(onTool, { id: 1, name: 'write', arguments: {
                    path: join(workspace!.root, 'src/main.ts'), content: 'export const ready = true;\n' } }),
                brokerCall(onTool, { id: 2, name: 'edit', arguments: {
                    path: join(workspace!.root, 'index.html'), edits: [
                        { oldText: 'Before', newText: 'After' }] } })
            ]);
            assert.equal(written.status, 'completed', JSON.stringify(written));
            assert.equal(edited.status, 'completed', JSON.stringify(edited));
            return { modelId: 'model', text: 'Done.' };
        }, dispose() {} };
        const adapter = new PiWorkExecutionAdapter({ async bind() {
            return { endpoint: 'http://127.0.0.1:9/v1', registryRevision: 1 };
        }, async assertWorkSelection() {} } as any,
        { create: () => host, release() {} } as any, () => workspace!, () => [], undefined,
        () => ({ journal, unsaved: async () => false, refresh: async () => true }));
        const run = await adapter.start({ projectRoot: project, executionRoot: workspace.root,
            executionMode: 'direct', grant, taskId: 'task-parallel', runId: 'run-parallel',
            connectionId: 'local', registrationId: 'local', modelId: 'model',
            prompt: 'Create the source and edit the page.', onEvent() {} });
        await run.result;
        assert.equal(await readFile(join(project, 'src/main.ts'), 'utf8'), 'export const ready = true;\n');
        assert.equal(await readFile(join(project, 'index.html'), 'utf8'), '<title>After</title>\n');
        assert.deepEqual(journal.changes.map(change => change.path), ['src/main.ts', 'index.html']);
    } finally { await workspace?.dispose(); await rm(project, { recursive: true, force: true }); }
});

for (const mode of ['isolated', 'direct'] as const)
test(`Pi native selected file calls traverse the ${mode} Work bridge`, async () => {
    const project = await mkdtemp(join(tmpdir(), `dope-pi-native-bridge-${mode}-`));
    let workspace: ExecutionWorkspace | undefined;
    try {
        await mkdir(join(project, 'src'));
        await writeFile(join(project, 'src', 'file.txt'), 'before\n');
        await execute('git', ['init', '-q', project]);
        await execute('git', ['add', 'src/file.txt'], { cwd: project });
        await execute('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
            'commit', '-qm', 'basis'], { cwd: project });
        const head = (await execute('git', ['rev-parse', 'HEAD'], { cwd: project })).stdout.trim();
        workspace = await ExecutionWorkspace.create(project);
        const grant = selectedGrant(project, 'native-grant', 'native-task', 'model',
            ['read', 'ls', 'write', 'edit'], mode);
        const journal = mode === 'direct' ? await DirectWorkJournal.create(project, head,
            'native-task', 'native-run', grant) : undefined;
        if (journal) workspace.bindDirectBasis(journal);
        const hashes = {
            read: '134f19bcabe3e29d63c5cebb38f1d2556759fd08adad6bc90a4b4d3cd1fb8441',
            write: 'e98a2484f667cf7c22d76ca103bf2022bf9113dc63fe38b899e71c328cb1e833',
            edit: '55866598f02c5e00ddfcbcae3df78081e3712de09a622bac7a6bc02ef2acc1bc',
            ls: 'ad4ee18683e9c3d6bfa7969709a0683bc9f896099ed6a74db0b6c49444718a0c'
        };
        const observations: any[] = [];
        let savedEditorRefreshes = 0;
        const host: any = { async start() {}, async runWork(_prompt: string,
            onTool: (call: any) => Promise<any>) {
            let id = 0;
            const call = (name: keyof typeof hashes, args: unknown) => brokerCall(onTool, { id: ++id, name,
                arguments: args, contract: { revision: 4, schemaHash: hashes[name], piVersion: '1.4.0' } });
            assert.match((await call('ls', { path: workspace!.root })).output, /src\//);
            assert.match((await call('read', { path: join(workspace!.root, 'src/file.txt') })).output, /before/);
            assert.match((await call('write', { path: join(workspace!.root, 'src/nested/new.txt'), content: 'one\n' })).output,
                /Successfully wrote/);
            assert.equal((await call('write', { path: 'src/nested/new.txt', content: 'two\n' })).status,
                'completed');
            assert.match((await call('edit', { path: join(workspace!.root, 'src/nested/new.txt'), edits: [
                { oldText: 'two', newText: 'three' }] })).output, /Successfully edited/);
            assert.match((await call('edit', { path: join(workspace!.root, 'src/file.txt'), edits: [
                { oldText: 'before', newText: 'after' }] })).output, /Successfully edited/);
            assert.match((await call('ls', { path: 'src/nested' })).output, /new.txt/);
            assert.equal((await call('write', { path: '.git/private-secret', content: 'x' })).status, 'denied');
            assert.equal((await call('write', { path: join(workspace!.root, '.git/config'),
                content: 'x' })).status, 'denied');
            await symlink('/tmp', join(workspace!.root, 'src', 'escape'));
            assert.notEqual((await call('write', { path: join(workspace!.root, 'src/escape/foreign.txt'),
                content: 'x' })).status, 'completed');
            await rm(join(workspace!.root, 'src', 'escape'));
            return { modelId: 'model', text: 'Native calls completed.' };
        }, dispose() {} };
        const adapter = new PiWorkExecutionAdapter({ async bind() {
            return { endpoint: 'http://127.0.0.1:9/v1', registryRevision: 1 };
        }, async assertWorkSelection() {} } as any,
        { create: () => host, release() {} } as any, () => workspace!, () => [], undefined,
        journal ? () => ({ journal, unsaved: async () => false,
            refresh: async () => { savedEditorRefreshes++; return true; } }) : undefined);
        const run = await adapter.start({ projectRoot: project, executionRoot: workspace.root,
            executionMode: mode, grant, taskId: 'native-task', runId: 'native-run',
            connectionId: 'local', registrationId: 'local', modelId: 'model',
            prompt: 'Use native file tools.', onEvent(event: unknown) { observations.push(event); } });
        await run.result;
        for (let id = 1; id <= 10; id++) assert.equal(observations.filter(event =>
            event.kind === 'work-observation' && event.toolId === `pi-${id}` &&
            ['completed', 'failed', 'recoverable', 'denied', 'cancelled'].includes(event.phase)).length, 1);
        assert.ok(observations.some(event => event.kind === 'work-observation' &&
            event.toolId === 'pi-1' && event.phase === 'requested' &&
            JSON.parse(event.detail).rawArguments.path === workspace!.root));
        assert.ok(observations.some(event => event.kind === 'work-observation' &&
            event.toolId === 'pi-1' && event.phase === 'validating' &&
            JSON.parse(event.detail).resolvedProjectPath === '.'));
        assert.match(JSON.stringify(observations), /private-secret/u);
        assert.ok(observations.some(event => event.kind === 'work-observation' &&
            event.toolId === 'pi-8' && event.phase === 'requested' &&
            JSON.parse(event.detail).rawArguments.path === '.git/private-secret'));
        assert.equal(await readFile(join(workspace.root, 'src/nested/new.txt'), 'utf8'), 'three\n');
        assert.equal(await readFile(join(workspace.root, 'src/file.txt'), 'utf8'), 'after\n');
        assert.equal(savedEditorRefreshes > 0, mode === 'direct');
        assert.equal(await readFile(join(project, 'src/nested/new.txt'), 'utf8').catch(() => ''),
            mode === 'direct' ? 'three\n' : '');
    } finally { await workspace?.dispose(); await rm(project, { recursive: true, force: true }); }
});

test('Pi Work rejects foreign project, task and model selections before opening a session', async () => {
    const adapter = new PiWorkExecutionAdapter({} as any, {} as any,
        () => { throw new Error('workspace must not open'); }, () => []);
    const grant = selectedGrant('/tmp/approved-project', 'grant', 'task', 'model', ['read']);
    const request: any = { projectRoot: '/tmp/approved-project', executionRoot: '/tmp/candidate',
        grant, taskId: 'task', connectionId: 'local', registrationId: 'local', modelId: 'model',
        prompt: 'Inspect.', onEvent() {} };
    await assert.rejects(adapter.start({ ...request, projectRoot: '/tmp/foreign-project' }),
        /selection binding changed/);
    await assert.rejects(adapter.start({ ...request, taskId: 'foreign-task' }),
        /selection binding changed/);
    await assert.rejects(adapter.start({ ...request, modelId: 'foreign-model' }),
        /selection binding changed/);
});

test('Pi Work model-selected read/edit/test stays in a disposable candidate until Dope promotion', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-pi-work-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    let turn = 0;
    let scopedPrompt = '';
    const calls = [
        { name: 'read', args: { path: 'docs/p3-fixture.md' } },
        { name: 'write', args: { path: 'README.md', content: 'candidate change\n' } },
        { name: 'run_command', args: { kind: 'test', commandId: 'failing-sample' } },
        { name: 'run_command', args: { kind: 'test', commandId: 'sample' } }
    ];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (_url, options) => {
        const wire = JSON.parse(String(options?.body));
        assert.equal(wire.model, 'synthetic-local');
        assert.deepEqual(wire.tools.map((item: any) => item.function.name).sort(),
            ['ls', 'read', 'read_command_output', 'run_command', 'write']);
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
        openWorkSession(model: unknown, cwd: string, workToolNames: string[]) {
            return dispatch({ type: 'open', mode: 'work', model, cwd, workToolNames });
        },
        async runWork(prompt: string, onTool: (call: any) => Promise<any>, onEvent: (event: any) => void) {
            scopedPrompt = prompt;
            const original = process.stdout.write;
            const replies: Promise<unknown>[] = [];
            process.stdout.write = function (chunk: any, ...args: any[]) {
                try {
                    const record = JSON.parse(String(chunk));
                    if (record.tool) {
                        replies.push(onTool(record.tool).then(result => dispatch({ type: 'tool-result',
                            requestId: record.id, toolId: record.tool.id, result }), () => dispatch({ type: 'tool-result',
                            requestId: record.id, toolId: record.tool.id, result: { status: 'denied', output: '' } })));
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
        await writeFile(join(workspace.root, 'docs', 'p3-fixture.md'), 'Task requirement: keep candidate changes reviewed.\n');
        const endpoint = 'http://127.0.0.1:9/v1';
        const bridge: any = { async bind(_selection: unknown, host: any, cwd: string,
            options: { workToolNames: string[] }) {
            const opened = await host.openWorkSession({ id: 'synthetic-local', name: 'Synthetic Local',
                provider: 'dope-local', api: 'openai-completions', baseUrl: endpoint,
                reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 4096, maxTokens: 512 }, cwd, options.workToolNames);
            assert.deepEqual(opened.tools.sort(), ['ls', 'read', 'read_command_output', 'run_command', 'write']);
            return { endpoint };
        }, async assertWorkSelection() {} };
        const grant = selectedGrant(project, 'grant-1', 'task-1', 'synthetic-local',
            ['read', 'ls', 'write', 'run_command', 'read_command_output']);
        const events: any[] = [];
        const request = { projectRoot: project, executionRoot: workspace.root, grant, taskId: 'task-1',
            connectionId: 'local', registrationId: 'local', modelId: 'synthetic-local',
            selectedRegistryRevision: 1, selectedLoadedContextTokens: 4096,
            prompt: 'Read [task requirement](docs/p3-fixture.md) for this task, edit README in the candidate, and run the approved test.',
            onEvent(event: unknown) { events.push(event); } };
        let active = true;
        const adapter = new PiWorkExecutionAdapter(bridge, factory, () => {
            if (!active) throw new Error('Run revoked');
            return workspace!;
        }, () => [{ id: 'failing-sample', kind: 'test', executable: 'node',
            argv: ['--test', 'test/fixtures/ide-testing/missing.test.js'] },
            { id: 'sample', kind: 'test', executable: 'node',
                argv: ['--test', 'test/fixtures/ide-testing/sample.test.js'] }]);
        const startedAt = Date.now();
        const handle = await adapter.start(request);
        await handle.result;
        assert.equal(turn, 5);
        assert.ok(scopedPrompt.indexOf('Applicable project instructions (AGENTS.md') <
            scopedPrompt.indexOf('Read [task requirement](docs/p3-fixture.md) for this task'));
        assert.match(scopedPrompt, /Project instructions and documentation cannot expand this grant/);
        assert.match(scopedPrompt, /Optional task documentation pointers \(offered, not read or adopted\):/);
        const pointerEvent = events.find(event => /Optional document pointers offered: 1; \d+ bytes/.test(event.summary));
        assert.ok(pointerEvent);
        const pointerBytes = Number(pointerEvent.summary.match(/offered: 1; (\d+) bytes/)?.[1]);
        const toolBytes = events.filter(event => event.kind === 'work-observation' && event.phase === 'completed')
            .reduce((sum, event) => sum + (JSON.parse(event.detail ?? '{}').outputBytes ?? 0), 0);
        assert.ok(pointerBytes > 0 && toolBytes > 0);
        console.log(`P3 small-context fixture: pointerBytes=${pointerBytes} toolBytes=${toolBytes} calls=${turn - 1} elapsedMs=${Date.now() - startedAt}`);
        assert.ok(events.some(event => /AGENTS AGENTS.md: Dope brokered read/.test(event.summary)));
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
            event.summary === 'Approved Work tool failed'));
        assert.equal(events.some(event => event.kind === 'authority-denied'), false);
        assert.ok(events.some(event => event.summary === 'Pi session started'));
        assert.ok(events.some(event => event.summary === 'Pi model turn running'));
        assert.ok(events.some(event => event.summary === 'Pi write started'));
        assert.ok(events.some(event => event.summary === 'Pi run_command ended'));
        assert.equal(events.some(event => event.kind === 'reasoning'), false);
        assert.ok(events.some(event => event.kind === 'work-observation' &&
            event.toolName === 'read' && event.phase === 'completed' && event.brokerInvoked === true));
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

test('Pi Work broker rejects a forged unselected edit before candidate mutation', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-pi-denied-tool-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    try {
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), project]);
        workspace = await ExecutionWorkspace.create(project);
        await writeFile(join(workspace.root, 'AGENTS.md'), 'Inspect the candidate only.\n');
        const selection = makeWorkToolSelection({ projectUri: 'file://' + project,
            taskId: 'selected-task', grantRevision: 1, connectionId: 'local', modelId: 'model',
            grantId: 'selected-grant', executionMode: 'isolated' }, ['read']);
        const grant = createDefaultExecutionGrant({ id: 'selected-grant', revision: 1,
            taskId: 'selected-task', acceptedAt: new Date().toISOString(), toolSelection: selection });
        const events: any[] = [];
        const host: any = { async start() {}, async runWork(_prompt: string,
            onTool: (call: any) => Promise<any>) {
            await assert.rejects(brokerCall(onTool, { id: 1, name: 'write', arguments: {
                path: 'forged.txt', content: 'forged' }, contract: { revision: 4,
                piVersion: '1.4.0', schemaHash: 'e98a2484f667cf7c22d76ca103bf2022bf9113dc63fe38b899e71c328cb1e833' } }), /denied/);
            return { modelId: 'model', text: 'No change.' };
        }, dispose() {} };
        const adapter = new PiWorkExecutionAdapter({ async bind(_model: any, _host: any, _cwd: any, options: any) {
            assert.deepEqual(options.workToolNames, ['read']);
            return { endpoint: 'http://127.0.0.1:9/v1', registryRevision: 1 };
        }, async assertWorkSelection() {} } as any,
        { create: () => host, release() {} } as any, () => workspace!, () => []);
        const run = await adapter.start({ projectRoot: project, executionRoot: workspace.root,
            executionMode: 'isolated',
            grant, taskId: 'selected-task', connectionId: 'local', registrationId: 'local',
            modelId: 'model', prompt: 'Inspect only.', onEvent(event: unknown) { events.push(event); } });
        await assert.rejects(run.result, /denied/);
        await assert.rejects(readFile(join(workspace.root, 'forged.txt')), { code: 'ENOENT' });
        assert.ok(events.some(event => event.kind === 'work-observation' && event.toolName === 'write' &&
            event.phase === 'denied' && event.brokerInvoked === false));
    } finally { await workspace?.dispose(); await rm(parent, { recursive: true, force: true }); }
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
        const grant = selectedGrant(project, 'grant-cancel', 'task-cancel', 'fixture-model');
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
        await assert.rejects(brokerCall(callTool!, { id: 1, name: 'read', arguments: { path: 'README.md' } }),
            /denied/);
        assert.ok(events.some(event => event.kind === 'authority-denied' &&
            event.summary === 'Pi Work tool denied at workspace-check'));
        assert.ok(events.some(event => event.kind === 'provider-event' &&
            event.summary === 'Pi Work tool stopped at workspace-check'));
        await handle.cancel();
        const count = events.length;
        stream!({ type: 'work', sequence: 1, kind: 'agent_start' });
        await assert.rejects(brokerCall(callTool!, { id: 2, name: 'read', arguments: { path: 'README.md' } }),
            /stopped/);
        assert.equal(events.filter(event => event.kind === 'work-observation' && event.toolId === 'pi-2' &&
            ['completed', 'failed', 'recoverable', 'denied', 'cancelled'].includes(event.phase)).length, 1);
        assert.equal(events.filter(event => event.kind === 'provider-event' && event.summary === 'Pi session started').length, 0);
        assert.equal(events.length, count + 2);
        adapter.dispose();
    } finally {
        await workspace?.dispose();
        await rm(parent, { recursive: true, force: true });
    }
});

test('Pi Work returns broker denials to the model and permits a corrected tool call', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-pi-work-source-hash-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    const events: any[] = [];
    let reply: any;
    let listDenied: any;
    let listRetry: any;
    let parseReply: any;
    const host: any = { async start() {}, async runWork(_prompt: string, tool: (call: any) => Promise<any>) {
        reply = await brokerCall(tool, { id: 1, name: 'read', arguments: {
            path: 'missing-source.txt' } });
        listDenied = await brokerCall(tool, { id: 2, name: 'ls', arguments: {
            path: 'missing-directory', limit: 100 } });
        listRetry = await brokerCall(tool, { id: 3, name: 'ls', arguments: {
            path: '.', limit: 100 } });
        parseReply = await brokerCall(tool, { id: 4, name: 'read', arguments: {},
            argumentError: true, piCallIdHash: 'a'.repeat(64) });
        return { modelId: 'fixture-model', text: 'No file content read' };
    }, dispose() {} };
    const factory: any = { create() { return host; }, release() {} };
    try {
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), project]);
        workspace = await ExecutionWorkspace.create(project);
        await writeFile(join(workspace.root, 'AGENTS.md'), 'Use the authorized candidate tools.\n');
        await writeFile(join(workspace.root, 'safe-source.txt'), 'safe source\n');
        const grant = selectedGrant(project, 'grant-source-hash', 'task-source-hash', 'fixture-model');
        const adapter = new PiWorkExecutionAdapter({ async bind() { return { endpoint: 'http://127.0.0.1:9/v1' }; },
            async assertWorkSelection() {} } as any, factory, () => workspace!, () => []);
        const handle = await adapter.start({ projectRoot: project, executionRoot: workspace.root,
            grant, taskId: 'task-source-hash', connectionId: 'local', registrationId: 'local',
            modelId: 'fixture-model', prompt: 'Read README', onEvent: event => events.push(event) });
        await handle.result;
        assert.equal(reply.status, 'failed');
        assert.match(reply.output, /^MISSING_FILE:/);
        assert.equal(listDenied.status, 'failed');
        assert.match(listDenied.output, /^MISSING_DIRECTORY:/);
        assert.equal(listRetry.status, 'completed');
        assert.match(parseReply.output, /^INVALID_ARGUMENTS:/);
        const call = events.filter(event => event.kind === 'work-observation' && event.toolId === 'pi-4');
        assert.equal(call.filter(event => ['completed', 'failed', 'recoverable', 'denied', 'cancelled'].includes(event.phase)).length, 1);
        assert.match(call[0].detail, /"piCallIdHash":"a{64}"/);
        for (let id = 1; id <= 4; id++) assert.equal(events.filter(event =>
            event.kind === 'work-observation' && event.toolId === `pi-${id}` &&
            ['completed', 'failed', 'recoverable', 'denied', 'cancelled'].includes(event.phase)).length, 1);
        assert.equal(events.some(event => event.kind === 'authority-denied'), false);
        assert.ok(events.some(event => event.kind === 'work-observation' && event.toolName === 'read' &&
            event.phase === 'recoverable' && event.code === 'MISSING_FILE' &&
            event.brokerInvoked === true && event.effectExecuted === false));
    } finally {
        await workspace?.dispose();
        await rm(parent, { recursive: true, force: true });
    }
});

test('Pi Work native read ranges return candidate content and retain emitted reasoning', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-pi-work-recovery-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    const observed: any[] = [];
    const host: any = { async start() {}, async runWork(_prompt: string, tool: (call: any) => Promise<any>, stream: (event: any) => void) {
        stream({ type: 'work', sequence: 1, kind: 'reasoning', text: 'Check the candidate range. password=' });
        stream({ type: 'work', sequence: 2, kind: 'reasoning', text: 'hiddenvalue ' });
        const first = await brokerCall(tool, { id: 1, name: 'read', arguments: { path: 'CANDIDATE.txt', offset: 1, limit: 5 } });
        observed.push(first);
        observed.push(await brokerCall(tool, { id: 2, name: 'read', arguments: {
            path: 'CANDIDATE.txt', offset: 2, limit: 3 } }));
        const later = await brokerCall(tool, { id: 3, name: 'read', arguments: {
            path: 'CANDIDATE.txt', offset: 501, limit: 2 } });
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
        const grant = selectedGrant(project, 'grant-recovery', 'task-recovery', 'fixture-model');
        const events: any[] = [];
        const adapter = new PiWorkExecutionAdapter({ async bind() { return { endpoint: 'http://127.0.0.1:9/v1' }; },
            async assertWorkSelection() {} } as any, factory, () => workspace!, () => []);
        const handle = await adapter.start({ projectRoot: project, executionRoot: workspace.root,
            grant, taskId: 'task-recovery', connectionId: 'local', registrationId: 'local',
            modelId: 'fixture-model', prompt: 'Read candidate', onEvent: event => events.push(event) });
        await handle.result;
        assert.equal(observed[0].status, 'completed');
        assert.match(observed[0].output, /safe candidate line/);
        assert.equal(observed[1].status, 'completed');
        assert.equal(observed[2].status, 'completed');
        assert.match(observed[2].output, /safe candidate line/);
        assert.ok(events.some(event => event.kind === 'reasoning'));
        assert.match(JSON.stringify(events.filter(event => event.kind === 'reasoning')), /hiddenvalue|password=/);
        assert.ok(events.some(event => event.kind === 'work-observation' && event.toolId === 'pi-1' &&
            event.phase === 'completed' && event.brokerInvoked === true));
        assert.ok(events.some(event => event.kind === 'work-observation' && event.toolId === 'pi-2' &&
            event.phase === 'completed' && event.brokerInvoked === true));
        assert.ok(events.some(event => event.kind === 'work-observation' && event.toolId === 'pi-3' &&
            event.phase === 'completed'));
        assert.ok(events.some(event => event.kind === 'observation-gap'));
        assert.equal(events.some(event => event.kind === 'authority-denied'), false);
        assert.deepEqual(await readFile(join(workspace.root, 'CANDIDATE.txt')), original);
        adapter.dispose();
    } finally { await workspace?.dispose(); await rm(parent, { recursive: true, force: true }); }
});

test('Pi Work native list handles missing and file targets before a directory retry', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'dope-pi-list-recovery-'));
    const project = join(parent, 'project');
    let workspace: ExecutionWorkspace | undefined;
    const replies: any[] = [];
    const host: any = { async start() {}, async runWork(_prompt: string, tool: (call: any) => Promise<any>) {
        replies.push(await brokerCall(tool, { id: 1, name: 'ls', arguments: { path: 'missing-directory', limit: 20 } }));
        replies.push(await brokerCall(tool, { id: 2, name: 'ls', arguments: { path: 'README.md', limit: 20 } }));
        replies.push(await brokerCall(tool, { id: 3, name: 'ls', arguments: { path: '.', limit: 20 } }));
        return { modelId: 'fixture-model', text: 'Directory listed' };
    }, dispose() {} };
    try {
        await execute('git', ['clone', '--no-local', '--quiet', '--', resolve('.'), project]);
        workspace = await ExecutionWorkspace.create(project);
        await writeFile(join(workspace.root, 'AGENTS.md'), 'Use the approved candidate tools.\n');
        const grant = selectedGrant(project, 'grant-list-recovery', 'task-list-recovery', 'fixture-model');
        const events: any[] = [];
        const adapter = new PiWorkExecutionAdapter({ async bind(_model: any, _host: any, _cwd: any, options: any) {
            assert.ok(options.workToolNames.includes('ls'));
            return { endpoint: 'http://127.0.0.1:9/v1' };
        }, async assertWorkSelection() {} } as any,
        { create: () => host, release() {} } as any, () => workspace!, () => []);
        const handle = await adapter.start({ projectRoot: project, executionRoot: workspace.root,
            grant, taskId: 'task-list-recovery', connectionId: 'local', registrationId: 'local',
            modelId: 'fixture-model', prompt: 'List the candidate.', onEvent: event => events.push(event) });
        await handle.result;
        assert.deepEqual(replies.map(reply => reply.status), ['failed', 'failed', 'completed']);
        assert.match(replies[0].output, /^MISSING_DIRECTORY:/);
        assert.match(replies[2].output, /README\.md/);
        assert.ok(events.some(event => event.kind === 'work-observation' &&
            event.toolName === 'ls' && event.phase === 'completed' && event.brokerInvoked === true));
        assert.equal(events.some(event => event.kind === 'authority-denied'), false);
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
        const grant = selectedGrant(project, 'grant-output', 'task-output', 'model',
            ['read', 'ls', 'edit', 'run_command', 'read_command_output']);
        const request = { projectRoot: project, executionRoot: workspace.root, grant,
            taskId: 'task-output', connectionId: 'local', registrationId: 'local',
            modelId: 'model', prompt: 'Run one approved command and inspect its output.',
            onEvent(event: unknown) { observations.push(event); } };
        const host: any = { async start() {}, async runWork(_prompt: string, onTool: (call: any) => Promise<any>) {
            const first = await brokerCall(onTool, { id: 1, name: 'run_command',
                arguments: { kind: 'build', commandId: 'sample-output' } });
            const initial = JSON.parse(first.output);
            assert.equal(first.status, 'completed');
            assert.equal(initial.sanitized, true);
            assert.equal(initial.captureTruncated, false);
            assert.ok(initial.nextOffset > 0);
            assert.match(initial.text, /^A+/);
            invocations++;
            const later = await brokerCall(onTool, { id: 2, name: 'read_command_output',
                arguments: { handle: initial.handle, offset: initial.nextOffset, maxBytes: 2048 } });
            const page = JSON.parse(later.output);
            assert.equal(page.outputIdentity, initial.outputIdentity);
            assert.equal(page.offset, initial.nextOffset);
            assert.match(initial.text + page.text, /\[redacted\]/);
            assert.doesNotMatch(initial.text + page.text, /hidden-value/);
            assert.equal(page.nextOffset, null);
            assert.equal(await readFile(join(workspace!.root, 'command-count'), 'utf8'), '1');
            const unavailable = await brokerCall(onTool, { id: 5, name: 'run_command',
                arguments: { kind: 'build', commandId: 'unapproved-command' } });
            assert.equal(unavailable.status, 'failed');
            assert.match(unavailable.output, /^COMMAND_UNAVAILABLE:/);
            assert.equal(await readFile(join(workspace!.root, 'command-count'), 'utf8'), '1');
            const now = Date.now;
            Date.now = () => now() + 120_001;
            try {
                const expired = await brokerCall(onTool, { id: 3, name: 'read_command_output',
                    arguments: { handle: initial.handle, offset: 0, maxBytes: 128 } });
                assert.equal(expired.status, 'failed');
                assert.match(expired.output, /OUTPUT_HANDLE_EXPIRED/);
            } finally { Date.now = now; }
            revoked = true;
            await assert.rejects(brokerCall(onTool, { id: 4, name: 'read_command_output',
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
        assert.ok(observations.some(event => event.kind === 'work-observation' &&
            event.toolName === 'run_command' && event.phase === 'recoverable' &&
            event.code === 'COMMAND_UNAVAILABLE' && event.effectExecuted === false));
        const commandReceipt = observations.find(event => event.kind === 'work-observation' &&
            event.toolName === 'run_command' && event.phase === 'completed');
        assert.ok(commandReceipt);
        const commandDetail = JSON.parse(commandReceipt.detail);
        assert.match(commandDetail.rawOutput, /hidden-value/);
        assert.match(commandDetail.modelOutput, /"handle"/);
        assert.doesNotMatch(commandDetail.modelOutput, /hidden-value/);
    } finally { await workspace?.dispose(); await rm(parent, { recursive: true, force: true }); }
});

test('Pi Work retains issued output handles in the local Work transcript', async () => {
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
        const grant = selectedGrant(project, 'grant-handle', 'task-handle', 'model',
            ['read', 'ls', 'edit', 'run_command', 'read_command_output']);
        const host: any = { async start() {}, async runWork(_prompt: string,
            onTool: (call: any) => Promise<any>, onEvent: (event: any) => void) {
            const result = await brokerCall(onTool, { id: 1, name: 'run_command',
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
        assert.match(JSON.stringify(observations), new RegExp(issuedHandle));
        assert.ok(observations.some(event => event.kind === 'agent-message' &&
            event.text.includes(`## Completed\n\nHandle ${issuedHandle}.\n\nResult: passed.`) &&
            event.redacted === false), JSON.stringify(observations.filter(event => event.kind === 'agent-message')));
        assert.ok(observations.some(event => event.kind === 'reasoning' &&
            event.text.includes(issuedHandle)));
    } finally { await workspace?.dispose(); await rm(parent, { recursive: true, force: true }); }
});
