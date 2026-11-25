import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/authority.js';
import { makeWorkToolSelection } from '../../packages/agent-core/lib/work-tool-selection.js';
import { AgentExecutionRuntime } from '../../packages/theia-extension/lib/node/agent-execution-runtime.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';
import { PiWorkExecutionAdapter } from '../../packages/theia-extension/lib/node/pi-work-execution.js';
import { PiRuntimeFactory } from '../../packages/theia-extension/lib/node/pi-runtime-host.js';

const execute = promisify(execFile);
const tick = () => new Promise(resolve => setTimeout(resolve, 10));

test('real Work service finishes for review and continues as a linked, ceiling-bound run',
    { timeout: 40_000 }, async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-work-session-runtime-'));
    const store = new AgentStore();
    const seen: any[] = [];
    const provider = createServer(async (request, response) => {
        let body = '';
        for await (const part of request) body += part;
        seen.push(JSON.parse(body));
        const base = { id: `reply-${seen.length}`, object: 'chat.completion.chunk', created: 1,
            model: 'offline-work' };
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(`data: ${JSON.stringify({ ...base, choices: [{ index: 0,
            delta: { role: 'assistant', content: `Answer ${seen.length}.` }, finish_reason: 'stop' }] })}\n\n`);
        response.end('data: [DONE]\n\n');
    });
    provider.listen(0, '127.0.0.1');
    await once(provider, 'listening');
    const endpoint = `http://127.0.0.1:${(provider.address() as any).port}/v1`;
    const model = { id: 'offline-work', name: 'Offline Work', provider: 'dope-local',
        api: 'openai-completions', baseUrl: endpoint, reasoning: false, input: ['text'],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 4096, maxTokens: 512 };
    const connection = { version: 1, id: 'local', alias: 'Local', lifecycle: 'enabled',
        config: { type: 'local', runtime: 'lm-studio', endpoint } };
    const inventory: any = { registry: { version: 1, revision: 1, connections: [connection], models: [{
        connectionId: 'local', providerModelKey: model.id, enabled: true, state: 'ready', locality: 'local',
        capabilities: { agentExecution: { source: 'adapter-known', value: true } } }] },
        observations: [{ connectionId: 'local', health: 'ready' }],
        loadedLocalModels: [{ connectionId: 'local', providerModelKey: model.id, contextWindowTokens: 4096 }] };
    const factory = new PiRuntimeFactory();
    let runtime!: AgentExecutionRuntime;
    const bridge: any = { async bind(_selection: unknown, host: any, cwd: string, options: any) {
        await host.openWorkSession(model, cwd, undefined, undefined, false, [], options.workToolNames);
        return { endpoint, registryRevision: 1 };
    }, async assertWorkSelection() {} };
    const adapter = new PiWorkExecutionAdapter(bridge, factory,
        request => runtime.localWorkspace(request), request => runtime.localCommands(request));
    runtime = new AgentExecutionRuntime(store, { async resolve() { throw new Error('Exact model required'); } } as any,
        { async inventory() { return inventory; } } as any, new Map([['local', adapter]]));
    let backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} }, runtime);
    try {
        await writeFile(join(root, 'README.md'), 'baseline\n');
        await execute('git', ['init', '-q', root]);
        await execute('git', ['-C', root, 'add', 'README.md']);
        await execute('git', ['-C', root, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid',
            'commit', '-qm', 'fixture']);
        const head = (await execute('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim();
        const uri = pathToFileURL(root).href;
        const handle = (await backend.attach(uri)).projectHandle;
        const task = (id: string, objective: string, createdAt: string,
            instructions = 'Answer concisely.') => ({ version: 1, id, createdAt,
            objective, instructions, projectRoot: '.',
            modelPolicy: { kind: 'exact', connectionId: 'local', modelId: model.id }, controls: {},
            authority: { profile: 'phase-8b-project' }, origin: { kind: 'direct' },
            reviewPolicy: { kind: 'required' }, completion: { validation: [
                { kind: 'test', label: 'candidate baseline', command: 'test -f README.md' }],
                requireValidationPass: true } });
        const grant = (id: string, taskId: string, tools: any[] = []) =>
            createDefaultExecutionGrant({ id, revision: 0, taskId, acceptedAt: new Date().toISOString(),
                toolSelection: makeWorkToolSelection({ projectUri: uri, taskId, grantRevision: 0,
                    connectionId: 'local', modelId: model.id }, tools) });
        await backend.createTask(handle, task('task-one', 'First Work turn', new Date(Date.now() - 2000).toISOString()) as any);
        const firstGrant = grant('grant-one', 'task-one', ['read_file']);
        const first = await backend.startWorkSession(handle, uri, 'task-one', firstGrant, false);
        for (let n = 0; n < 300 && (await backend.readWorkSession(handle, first.id))?.status !== 'awaiting-input'; n++)
            await tick();
        const waiting = await backend.readWorkSession(handle, first.id);
        assert.equal(waiting?.status, 'awaiting-input');
        assert.equal(waiting?.candidateSnapshot?.runId, first.id);
        assert.deepEqual(await new AgentStore().readWorkCandidateSnapshot(root, first.id,
            waiting!.candidateSnapshot!.id), waiting!.candidateSnapshot);
        assert.equal((await backend.readRun(handle, first.id))?.status, 'running');
        await Promise.all([
            backend.submitWorkMessage(handle, first.id, 'message-one', 'First follow-up.'),
            backend.submitWorkMessage(handle, first.id, 'message-one', 'First follow-up.')
        ]);
        await backend.submitWorkMessage(handle, first.id, 'message-two', 'Second follow-up.');
        await assert.rejects(backend.submitWorkMessage(handle, first.id, 'message-one', 'Changed text.'),
            /ID already used/);
        for (let n = 0; n < 300; n++) {
            const state = await backend.readWorkSession(handle, first.id);
            if (state?.status === 'awaiting-input' && state.messages.every(message => message.status === 'delivered')) break;
            await tick();
        }
        const delivered = (await backend.readWorkSession(handle, first.id))!;
        assert.deepEqual(delivered.messages.map(message => [message.id, message.status]),
            [['message-one', 'delivered'], ['message-two', 'delivered']]);
        assert.equal(seen.length, 3, 'retry did not duplicate a model turn');
        await backend.finishWorkSession(handle, first.id);
        const held = await runtime.waitForRun(root, first.id);
        assert.equal(held.status, 'blocked');
        assert.equal(held.candidateReview?.state, 'ready');
        assert.equal(held.validationResults[0]?.status, 'passed');
        assert.equal(held.validationResults[0]?.candidateFingerprint, held.candidateFingerprint);
        await assert.rejects(backend.submitWorkMessage(handle, first.id, 'late-message', 'Change during review.'),
            /cannot accept messages/);
        const decided = await backend.decideCandidate(handle, first.id, 0,
            held.candidateReview!.candidateFingerprint, 'reject');
        assert.equal(decided.status, 'cancelled');
        await backend.createTask(handle, task('task-two', 'First Work turn',
            new Date().toISOString(), 'Continue the first Work task with fresh instructions.') as any);
        const secondGrant = grant('grant-two', 'task-two', []);
        await assert.rejects(backend.continueWorkSession(handle, uri, first.id, first.id,
            'task-two', secondGrant, false, 'f'.repeat(40), false), /source HEAD changed/);
        await assert.rejects(backend.continueWorkSession(handle, uri, first.id, first.id,
            'task-two', grant('grant-expanded', 'task-two', ['read_file', 'edit_file']), false,
            head, false), /exceeds original grant/);
        const second = await backend.continueWorkSession(handle, uri, first.id, first.id,
            'task-two', secondGrant, false, head, false);
        assert.notEqual(second.id, first.id);
        const linked = await backend.readWorkSession(handle, first.id);
        assert.equal(linked?.id, first.id);
        assert.deepEqual(linked?.segments.map(segment => segment.runId), [first.id, second.id]);
        assert.equal(linked?.toolSelectionHash, waiting?.toolSelectionHash);
        assert.equal(second.provenance?.modelId, first.provenance?.modelId);
        for (let n = 0; n < 300 && (await backend.readWorkSession(handle, first.id))?.status !== 'awaiting-input'; n++)
            await tick();
        assert.equal((await backend.readWorkSession(handle, first.id))?.status, 'awaiting-input');
        assert.equal(seen.length, 4);
        await backend.finishWorkSession(handle, first.id);
        const secondHeld = await runtime.waitForRun(root, second.id);
        assert.equal(secondHeld.status, 'blocked');
        assert.equal(secondHeld.validationResults[0]?.status, 'passed');
        await backend.decideCandidate(handle, second.id, 0,
            secondHeld.candidateReview!.candidateFingerprint, 'reject');

        // Model a process lost after a third segment reached the delivery boundary.
        // A fresh backend must hold that message and require explicit source reset.
        await store.createTask(root, task('task-three', 'Abandoned turn', new Date().toISOString()) as any);
        const thirdGrant = grant('grant-three', 'task-three', []);
        const thirdAt = new Date().toISOString();
        const pending: any = { version: 1, id: 'abandoned-run', taskId: 'task-three',
            status: 'pending', grantId: thirdGrant.id, grantRevision: thirdGrant.revision,
            toolSelection: thirdGrant.toolSelection, requestedPolicy: { kind: 'exact', connectionId: 'local',
                modelId: model.id }, projectRoot: '.', createdAt: thirdAt, basis: { head, clean: true },
            changedFiles: [], validationResults: [] };
        await store.createRun(root, pending);
        await store.updateRun(root, pending, { ...pending, status: 'running', startedAt: thirdAt,
            provenance: second.provenance });
        const completedSession = (await store.readWorkSession(root, first.id))!;
        const queuedAt = new Date().toISOString();
        const recovering = await store.updateWorkSession(root, completedSession, { ...completedSession,
            status: 'running', revision: completedSession.revision + 1,
            segments: [...completedSession.segments, { runId: pending.id, taskId: pending.taskId,
                grantId: pending.grantId, grantRevision: pending.grantRevision, basisHead: head, startedAt: thirdAt }],
            messages: [...completedSession.messages, { id: 'uncertain-message', text: 'Do not replay me',
                queuedAt, status: 'queued' }] });
        await store.updateWorkSession(root, recovering, { ...recovering, revision: recovering.revision + 1,
            messages: [...recovering.messages.map(message => message.id === 'uncertain-message' ?
                { ...message, status: 'delivering' as const, deliveryStartedAt: new Date().toISOString() } : message),
                { id: 'safe-pending', text: 'Deliver after verified recovery',
                    queuedAt: new Date().toISOString(), status: 'queued' as const }] });
        const restartedStore = new AgentStore();
        runtime = new AgentExecutionRuntime(restartedStore,
            { async resolve() { throw new Error('Exact model required'); } } as any,
            { async inventory() { return inventory; } } as any, new Map([['local', adapter]]));
        backend = new AgentRuntimeBackend(restartedStore, { notifyAgentStateChanged() {} }, runtime);
        const restartedHandle = (await backend.attach(uri)).projectHandle;
        assert.equal((await backend.readWorkSession(restartedHandle, first.id))?.status, 'recovery-required');
        assert.equal((await backend.readWorkSession(restartedHandle, first.id))?.candidateSnapshot?.runId, second.id);
        assert.equal((await backend.readRun(restartedHandle, pending.id))?.status, 'interrupted');
        assert.deepEqual((await backend.readWorkSession(restartedHandle, first.id))?.messages.slice(-2)
            .map(message => message.status), ['delivering', 'queued']);
        await backend.createTask(restartedHandle, task('task-four', 'First Work turn',
            new Date().toISOString(), 'Resume the first Work task after verified recovery.') as any);
        const fourthGrant = grant('grant-four', 'task-four', []);
        await assert.rejects(backend.continueWorkSession(restartedHandle, uri, first.id, pending.id,
            'task-four', fourthGrant, false, head, false), /explicit recovery decision/);
        const fourth = await backend.continueWorkSession(restartedHandle, uri, first.id, pending.id,
            'task-four', fourthGrant, false, head, true);
        assert.equal((await backend.readWorkSession(restartedHandle, first.id))?.messages.at(-2)?.status,
            'abandoned');
        for (let n = 0; n < 300 && (await backend.readWorkSession(restartedHandle, first.id))?.status !== 'awaiting-input'; n++)
            await tick();
        assert.equal((await backend.readWorkSession(restartedHandle, first.id))?.status, 'awaiting-input',
            JSON.stringify({ run: await backend.readRun(restartedHandle, fourth.id), seen: seen.length,
                events: await backend.readEvents(restartedHandle, fourth.id, 0, 100) }));
        for (let n = 0; n < 300; n++) {
            const state = await backend.readWorkSession(restartedHandle, first.id);
            if (state?.status === 'awaiting-input' && state.messages.at(-1)?.status === 'delivered') break;
            await tick();
        }
        assert.equal((await backend.readWorkSession(restartedHandle, first.id))?.messages.at(-1)?.status,
            'delivered', 'safe queued message is delivered after recovery');
        assert.equal(seen.length, 6, 'uncertain message was never replayed and queued message ran once');
        const stopped = await backend.stop(restartedHandle, fourth.id);
        assert.equal(stopped.status, 'cancelled');
        assert.equal((await backend.readWorkSession(restartedHandle, first.id))?.status, 'stopped');
        assert.equal((await backend.readWorkSession(restartedHandle, first.id))?.candidateSnapshot?.runId,
            fourth.id, 'Stop retains the last settled candidate snapshot');
    } finally {
        await runtime.dispose();
        backend.dispose();
        factory.dispose();
        provider.closeAllConnections(); provider.close();
        await rm(root, { recursive: true, force: true });
    }
});
