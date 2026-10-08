import assert from 'node:assert/strict';
import test from 'node:test';
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/index.js';
import { AgentExecutionRuntime } from '../../packages/theia-extension/lib/node/agent-execution-runtime.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';

const at = '2026-10-08T12:00:00Z';

test('runtime transcript retains ordered pages, terminal commands, legacy runs and validation ownership', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-runtime-transcript-'));
    const git = promisify(execFile);
    await git('git', ['clone', '--quiet', '--shared', resolve(import.meta.dirname, '../..'), root]);
    const store = new AgentStore();
    let emit!: (event: any) => void;
    let complete!: () => void;
    const adapter = { id: 'fake-codex', async start(request: any) {
        emit = request.onEvent;
        const result = new Promise<void>(resolveResult => { complete = resolveResult; });
        return { result, cancel: async () => complete() };
    }, dispose() {} };
    const registry = { connections: [{ id: 'codex', lifecycle: 'enabled', config: { type: 'codex', runtime: 'app-server' },
        codexAccount: { accountId: 'account-1', status: 'signed-in', planUsage: 'available' } }],
    models: [{ connectionId: 'codex', providerModelKey: 'model-1', enabled: true, state: 'ready', locality: 'hosted',
        capabilities: { agentExecution: { source: 'adapter-known', value: true } } }],
    observations: [{ connectionId: 'codex', health: 'ready' }] };
    const validationCalls: string[] = [];
    const runtime = new AgentExecutionRuntime(store, { resolve: async () => ({ resolution: { policyRevision: 1,
        candidates: [{ target: { connectionId: 'codex', modelId: 'model-1' } }] } }) } as any,
    { inventory: async () => ({ registry: { version: 1, revision: 1, connections: registry.connections,
        models: registry.models }, observations: registry.observations }) } as any,
    new Map([['codex', adapter as any]]), 0, { run: async (input: any, persist: any) => {
        validationCalls.push(input.target.label);
        const result = { version: 1, kind: input.target.kind, label: input.target.label,
            command: input.target.command, owner: 'dope', candidateFingerprint: input.candidateFingerprint,
            workspaceId: 'validation-fixture', durationMs: 1, exitCode: 1, stdout: '', stderr: '',
            stdoutTruncated: false, stderrTruncated: false, status: 'failed' };
        await persist(result);
        return result;
    } } as any);
    const backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} }, runtime);
    const notifications: string[] = [];
    const unlisten = store.onChange((_root, change) => { if (change.kind === 'transcript') notifications.push(change.id); });
    try {
        const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
        const task = await backend.createTask(handle, { version: 1, id: 'task-1', createdAt: at,
            objective: 'Explain work', instructions: 'Perform one change', projectRoot: '.',
            modelPolicy: { kind: 'follow-coding-agent' }, controls: {}, authority: { profile: 'phase-8b-project' },
            completion: { validation: [{ kind: 'test', label: 'npm test', command: 'npm test' }],
                requireValidationPass: true }, origin: { kind: 'direct' } } as any);
        const legacy = await store.createRun(root, { version: 1, id: 'legacy-run', taskId: task.id, status: 'pending',
            grantId: 'legacy-grant', grantRevision: 0, requestedPolicy: task.modelPolicy, projectRoot: '.',
            createdAt: at, changedFiles: [], validationResults: [] });
        assert.equal((await backend.readTranscript(handle, legacy.id, 0, 2)).state, 'not-recorded');
        const grant = createDefaultExecutionGrant({ id: 'grant-1', revision: 0, taskId: task.id, acceptedAt: at });
        const run = await backend.start(handle, pathToFileURL(root).href, task.id, grant, true);
        emit({ kind: 'agent-message', summary: 'visible', text: 'First paragraph', truncated: false, redacted: false });
        emit({ kind: 'command-started', summary: 'start', commandId: 'cmd-1', command: 'npm test', cwd: '.', status: 'running' });
        emit({ kind: 'command-completed', summary: 'done', commandId: 'cmd-1', status: 'completed', exitCode: 0,
            stdout: 'provider passed', stdoutTruncated: false });
        for (let index = 0; index < 12; index++) emit({ kind: 'agent-message', summary: 'visible',
            text: `Message ${index}`, truncated: false, redacted: false });
        emit({ kind: 'command-started', summary: 'start', commandId: 'cmd-2', command: 'still running', status: 'running' });
        complete();
        const final = await runtime.waitForRun(root, run.id);
        assert.ok(notifications.length > 0);
        assert.ok(notifications.every(id => id === run.id));
        assert.equal(final.status, 'failed');
        assert.deepEqual(validationCalls, ['npm test']);
        assert.equal(final.commandEvidence?.[0]?.result, 'passed');
        assert.equal(final.validationResults[0].owner, 'dope');
        assert.equal(final.validationResults[0].status, 'failed');
        const reopened = new AgentRuntimeBackend(new AgentStore(), { notifyAgentStateChanged() {} });
        try {
            const attached = (await reopened.attach(pathToFileURL(root).href)).projectHandle;
            const entries: any[] = [];
            let cursor = 0;
            for (;;) {
                const page = await reopened.readTranscript(attached, run.id, cursor, 3);
                assert.equal(page.state, 'recorded');
                entries.push(...page.entries);
                cursor = page.nextSequence;
                if (!page.hasMore) break;
            }
            assert.deepEqual(entries.map(entry => entry.sequence), [...entries.map(entry => entry.sequence)].sort((a, b) => a - b));
            assert.equal(entries[0].code, 'run-started');
            assert.equal(entries[1].text, 'First paragraph');
            assert.equal(entries.filter(entry => entry.kind === 'message').length, 13);
            assert.equal(entries.find(entry => entry.commandId === 'cmd-1').stdout, 'provider passed');
            assert.equal(entries.find(entry => entry.commandId === 'cmd-1').status, 'completed');
            assert.equal(entries.find(entry => entry.commandId === 'cmd-2').status, 'interrupted');
            assert.equal(entries.at(-1).code, 'run-ended');
            const live = await backend.readTranscript(handle, run.id, 0, 3);
            assert.deepEqual(live.entries, entries.slice(0, 3));
            assert.equal((await reopened.readEvents(attached, run.id, 0, 100)).events.length > 0, true);
            assert.equal((await reopened.readTranscript(attached, legacy.id, 0, 2)).state, 'not-recorded');
            assert.throws(() => reopened.readTranscript(handle, run.id, 0, 2), /handle/);
        } finally { reopened.dispose(); }
    } finally { unlisten(); await runtime.dispose(); backend.dispose(); await rm(root, { recursive: true, force: true }); }
});
