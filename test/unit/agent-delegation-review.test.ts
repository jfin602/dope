import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/index.js';
import { AgentExecutionRuntime } from '../../packages/theia-extension/lib/node/agent-execution-runtime.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';

const git = promisify(execFile);
const now = '2026-10-09T12:00:00Z';
const task = (kind: 'direct' | 'work-item', id: string) => ({ version: 1, id, createdAt: now,
    objective: 'Create review.txt', instructions: 'Write candidate bytes', projectRoot: '.', projectId: 'project',
    modelPolicy: { kind: 'follow-coding-agent' }, controls: {}, authority: { profile: 'phase-8b-project' },
    completion: { validation: [{ kind: 'test', label: 'focused', command: 'true' }], requireValidationPass: true },
    origin: kind === 'direct' ? { kind: 'direct' } : { kind: 'work-item', projectId: 'project',
        planningMapId: 'map', workItemId: 'work', mapRevision: 1,
        basis: { architectureRevision: 1, architectureFingerprint: 'architecture',
            physicalInputFingerprint: 'physical', physicalGeneration: 1 },
        scope: { assignment: 'AI', workingSet: ['review.txt'], delegablePaths: ['review.txt'], humanReservedPaths: [] } },
    ...(kind === 'work-item' ? { planningMapId: 'map', reviewPolicy: { kind: 'required' } } : {}) });

async function fixture(kind: 'direct' | 'work-item', validationStatus: 'passed' | 'failed',
    runTest: (f: { root: string; store: AgentStore; runtime: AgentExecutionRuntime;
        backend: AgentRuntimeBackend; handle: string; adapter: { request?: any; complete(): void } }) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), 'dope-delegation-review-'));
    await git('git', ['clone', '--quiet', '--shared', resolve(import.meta.dirname, '../..'), root]);
    const store = new AgentStore();
    let complete!: () => void;
    const adapter = { id: 'fake-codex', request: undefined as any,
        async start(request: any) {
            this.request = request;
            return { result: new Promise<void>(resolve => { complete = resolve; }), cancel: async () => {} };
        }, complete() { complete(); }, dispose() {} };
    const routing = { async resolve() { return { resolution: { policyRevision: 1,
        candidates: [{ target: { connectionId: 'codex', modelId: 'model' } }] } }; } };
    const inventory = { async inventory() { return { registry: { version: 1, revision: 1,
        connections: [{ id: 'codex', lifecycle: 'enabled', config: { type: 'codex', runtime: 'app-server' },
            codexAccount: { accountId: 'account', status: 'signed-in', planUsage: 'available' } }],
        models: [{ connectionId: 'codex', providerModelKey: 'model', enabled: true, state: 'ready', locality: 'hosted',
            capabilities: { agentExecution: { source: 'adapter-known', value: true } } }] },
        observations: [{ connectionId: 'codex', health: 'ready' }] }; } };
    const validation = { async run(input: any, persist: (result: any) => Promise<void>) {
        const result = { version: 1, kind: input.target.kind, label: input.target.label,
            command: input.target.command, owner: 'dope', candidateFingerprint: input.candidateFingerprint,
            workspaceId: 'fixture', durationMs: 1, exitCode: validationStatus === 'passed' ? 0 : 1,
            stdout: '', stderr: '', stdoutTruncated: false, stderrTruncated: false, status: validationStatus };
        await persist(result); return result;
    } };
    const runtime = new AgentExecutionRuntime(store, routing as any, inventory as any,
        new Map([['codex', adapter as any]]), 0, validation as any);
    const backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} }, runtime);
    try {
        const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
        if (kind === 'direct') await backend.createTask(handle, task(kind, 'task-review') as any);
        else await store.createTask(root, task(kind, 'task-review') as any);
        await runTest({ root, store, runtime, backend, handle, adapter });
    } finally { await runtime.dispose(); backend.dispose(); await rm(root, { recursive: true, force: true }); }
}

test('WorkItem validated candidate is held with durable diff, fingerprint and bytes', async () =>
    fixture('work-item', 'passed', async f => {
        const grant = createDefaultExecutionGrant({ id: 'grant-review', revision: 0,
            taskId: 'task-review', acceptedAt: now });
        const started = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-review', grant, true);
        await writeFile(join(f.adapter.request!.executionRoot, 'review.txt'), 'candidate\n');
        f.adapter.complete();
        const held = await f.runtime.waitForRun(f.root, started.id);
        assert.equal(held.status, 'blocked', JSON.stringify(held.outcome));
        assert.equal(held.candidateReview?.state, 'ready');
        assert.match(held.candidateReview!.diff, /\+candidate/);
        assert.deepEqual(held.candidateReview!.changedPaths, ['review.txt']);
        assert.equal(held.candidateReview!.validation[0].status, 'passed');
        assert.equal(held.candidateReview!.candidateFingerprint, held.candidateFingerprint);
        assert.equal(await readFile(join((await f.store.reviewCandidateRoot(f.root, started.id))!, 'review.txt'), 'utf8'), 'candidate\n');
        await assert.rejects(readFile(join(f.root, 'review.txt')), { code: 'ENOENT' });
        await f.runtime.reconcile(f.root);
        assert.equal((await new AgentStore().readRun(f.root, started.id))?.status, 'blocked');
    }));

test('failed WorkItem validation cannot create a review hold', async () =>
    fixture('work-item', 'failed', async f => {
        const grant = createDefaultExecutionGrant({ id: 'grant-review', revision: 0,
            taskId: 'task-review', acceptedAt: now });
        const started = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-review', grant, true);
        await writeFile(join(f.adapter.request!.executionRoot, 'review.txt'), 'candidate\n');
        f.adapter.complete();
        const failed = await f.runtime.waitForRun(f.root, started.id);
        assert.equal(failed.status, 'failed');
        assert.equal(failed.outcome?.code, 'validation-failed');
        assert.equal(failed.candidateReview, undefined);
        assert.equal(await f.store.reviewCandidateRoot(f.root, started.id), undefined);
        await assert.rejects(readFile(join(f.root, 'review.txt')), { code: 'ENOENT' });
    }));

test('direct task still promotes automatically after validation', async () =>
    fixture('direct', 'passed', async f => {
        const grant = createDefaultExecutionGrant({ id: 'grant-review', revision: 0,
            taskId: 'task-review', acceptedAt: now });
        const started = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-review', grant, true);
        await writeFile(join(f.adapter.request!.executionRoot, 'review.txt'), 'candidate\n');
        f.adapter.complete();
        const done = await f.runtime.waitForRun(f.root, started.id);
        assert.equal(done.status, 'completed');
        assert.equal(done.candidateReview, undefined);
        assert.equal(await readFile(join(f.root, 'review.txt'), 'utf8'), 'candidate\n');
    }));
