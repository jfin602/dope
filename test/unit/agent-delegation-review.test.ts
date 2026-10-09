import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { createDefaultExecutionGrant } from '../../packages/agent-core/lib/index.js';
import { AgentExecutionRuntime } from '../../packages/theia-extension/lib/node/agent-execution-runtime.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';

const git = promisify(execFile);
const now = '2026-10-09T12:00:00Z';
const task = (kind: 'direct' | 'work-item', id: string, scope?: {
    assignment: 'SHARED'; workingSet: string[]; delegablePaths: string[]; humanReservedPaths: string[]
}) => ({ version: 1, id, createdAt: now,
    objective: 'Create review.txt', instructions: 'Write candidate bytes', projectRoot: '.', projectId: 'project',
    modelPolicy: { kind: 'follow-coding-agent' }, controls: {}, authority: { profile: 'phase-8b-project' },
    completion: { validation: [{ kind: 'test', label: 'focused', command: 'true' }], requireValidationPass: true },
    origin: kind === 'direct' ? { kind: 'direct' } : { kind: 'work-item', projectId: 'project',
        planningMapId: 'map', workItemId: 'work', mapRevision: 1,
        basis: { architectureRevision: 1, architectureFingerprint: 'architecture',
            physicalInputFingerprint: 'physical', physicalGeneration: 1 },
        scope: scope ?? { assignment: 'AI', workingSet: ['review.txt'], delegablePaths: ['review.txt'], humanReservedPaths: [] } },
    ...(kind === 'work-item' ? { planningMapId: 'map', reviewPolicy: { kind: 'required' } } : {}) });

async function fixture(kind: 'direct' | 'work-item', validationStatus: 'passed' | 'failed',
    runTest: (f: { root: string; store: AgentStore; runtime: AgentExecutionRuntime;
        backend: AgentRuntimeBackend; handle: string; adapter: { request?: any; complete(): void };
        taskId: string; planning: PlanningStore }) => Promise<void>,
    scope?: { assignment: 'SHARED'; workingSet: string[]; delegablePaths: string[]; humanReservedPaths: string[] },
    throughPlanning = false) {
    const root = await mkdtemp(join(tmpdir(), 'dope-delegation-review-'));
    await git('git', ['clone', '--quiet', '--shared', resolve(import.meta.dirname, '../..'), root]);
    const store = new AgentStore();
    const planning = new PlanningStore();
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
    const backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} }, runtime, planning);
    try {
        const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
        let taskId = 'task-review';
        if (kind === 'direct') await backend.createTask(handle, task(kind, 'task-review') as any);
        else if (!throughPlanning) await store.createTask(root, task(kind, 'task-review', scope) as any);
        else {
            const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
                physicalInputFingerprint: 'physical', physicalGeneration: 1 };
            let collection = await planning.mutate(root, 0, { type: 'create', id: 'map', title: 'Plan',
                objective: 'Review', basis });
            collection = await planning.mutate(root, collection.revision, { type: 'put-transformation', mapId: 'map',
                transformation: { id: 'change', kind: 'add', currentIds: [], dependsOn: [],
                    futureNodes: [{ id: 'core', kind: 'system', name: 'Core', purpose: 'Core', roots: ['src'] }] } });
            const work = { id: 'work', title: 'Review', objective: 'Create review.txt', transformationIds: ['change'],
                dependsOn: [], requirements: [], constraints: [], acceptanceCriteria: ['Candidate validated'],
                validationTargets: ['true'], workingSet: scope?.workingSet ?? ['review.txt'],
                status: 'proposed' as const, assignment: (scope?.assignment ?? 'AI') as 'AI' | 'SHARED',
                delegablePaths: scope?.delegablePaths ?? ['review.txt'], humanReservedPaths: scope?.humanReservedPaths ?? [] };
            collection = await planning.mutate(root, collection.revision, { type: 'put-work-item', mapId: 'map', workItem: work });
            collection = await planning.mutate(root, collection.revision, { type: 'put-work-item', mapId: 'map',
                workItem: { ...work, status: 'ready' } });
            collection = await planning.mutate(root, collection.revision, { type: 'transition', mapId: 'map', status: 'active' });
            const request = { requestKey: 'review-seam', expectedProjectRevision: collection.revision,
                expectedMapRevision: collection.maps[0].revision, planningMapId: 'map', workItemId: 'work',
                delegablePaths: scope?.delegablePaths ?? ['review.txt'], modelPolicy: { kind: 'follow-coding-agent' as const },
                controls: {}, completion: { validation: [{ kind: 'test' as const, label: 'focused', command: 'true' }],
                    requireValidationPass: true }, validationApproved: true };
            const launched = await backend.launchWorkItem(handle, request);
            taskId = launched.id;
            assert.equal((await backend.launchWorkItem(handle, request)).id, taskId);
            assert.equal((await backend.readTask(handle, taskId))?.origin.kind, 'work-item');
            assert.deepEqual(await backend.listWorkItemTasks(handle, 'map', 'work'), [launched]);
            assert.deepEqual(await backend.listRuns(handle), []);
        }
        await runTest({ root, store, runtime, backend, handle, adapter, taskId, planning });
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

test('Planning launch uses the saved task ID through explicit Start, Dope validation and accepted review', async () =>
    fixture('work-item', 'passed', async f => {
        const uri = pathToFileURL(f.root).href;
        const grant = createDefaultExecutionGrant({ id: 'grant-planning-seam', revision: 0,
            taskId: f.taskId, acceptedAt: new Date(Date.now() + 1_000).toISOString() });
        await assert.rejects(f.backend.start(f.handle, uri, f.taskId, undefined as any, true));
        await assert.rejects(f.backend.start(f.handle, uri, f.taskId, grant, false), /hosted|consent|authorized/i);
        await assert.rejects(f.backend.start(f.handle, pathToFileURL(tmpdir()).href, f.taskId, grant, true),
            /project root/);
        assert.deepEqual(await f.backend.listRuns(f.handle), []);
        const started = await f.backend.start(f.handle, uri, f.taskId, grant, true);
        assert.equal(started.taskId, f.taskId);
        assert.equal(f.adapter.request!.taskId, f.taskId);
        await assert.rejects(f.backend.start(f.handle, uri, f.taskId, grant, true), /already active/);
        await writeFile(join(f.adapter.request!.executionRoot, 'review.txt'), 'candidate\n');
        f.adapter.complete();
        const held = await f.runtime.waitForRun(f.root, started.id);
        assert.equal(held.status, 'blocked', JSON.stringify({ outcome: held.outcome, validation: held.validationResults }));
        assert.equal(held.candidateReview?.state, 'ready');
        assert.equal(held.candidateReview?.validation[0]?.owner, 'dope');
        assert.equal(held.candidateReview?.validation[0]?.status, 'passed');
        assert.equal(held.candidateReview?.validation[0]?.candidateFingerprint, held.candidateFingerprint);
        await assert.rejects(readFile(join(f.root, 'review.txt')), { code: 'ENOENT' });
        await assert.rejects(f.backend.start(f.handle, uri, f.taskId, grant, true), /restart reconciliation|already has an AgentRun/);
        assert.equal((await f.backend.listRuns(f.handle)).length, 1);
        const accepted = await f.backend.decideCandidate(f.handle, held.id, 0,
            held.candidateReview!.candidateFingerprint, 'accept', grant);
        assert.equal(accepted.status, 'completed');
        assert.deepEqual(accepted.appliedFiles, ['review.txt']);
        assert.equal(await readFile(join(f.root, 'review.txt'), 'utf8'), 'candidate\n');
        assert.equal((await f.planning.read(f.root)).maps[0].workItems[0].status, 'ready');
    }, undefined, true));

test('Planning-launched candidate can be rejected after a changed authoritative basis', async () =>
    fixture('work-item', 'passed', async f => {
        const grant = createDefaultExecutionGrant({ id: 'grant-planning-reject', revision: 0,
            taskId: f.taskId, acceptedAt: new Date(Date.now() + 1_000).toISOString() });
        const started = await f.backend.start(f.handle, pathToFileURL(f.root).href, f.taskId, grant, true);
        await writeFile(join(f.adapter.request!.executionRoot, 'review.txt'), 'candidate\n');
        f.adapter.complete();
        const held = await f.runtime.waitForRun(f.root, started.id);
        assert.equal(held.candidateReview?.state, 'ready');
        await writeFile(join(f.root, 'external.txt'), 'changed\n');
        await assert.rejects(f.backend.decideCandidate(f.handle, held.id, 0,
            held.candidateReview!.candidateFingerprint, 'accept', grant), /Git basis changed/);
        const rejected = await f.backend.decideCandidate(f.handle, held.id, 0,
            held.candidateReview!.candidateFingerprint, 'reject');
        assert.equal(rejected.reviewDecision?.kind, 'reject');
        await assert.rejects(readFile(join(f.root, 'review.txt')), { code: 'ENOENT' });
        assert.equal((await f.planning.read(f.root)).maps[0].workItems[0].status, 'ready');
    }, undefined, true));

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

async function hold(f: { root: string; backend: AgentRuntimeBackend; handle: string;
    runtime: AgentExecutionRuntime; adapter: { request?: any; complete(): void } }) {
    const grant = createDefaultExecutionGrant({ id: 'grant-review', revision: 0,
        taskId: 'task-review', acceptedAt: now });
    const started = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-review', grant, true);
    await writeFile(join(f.adapter.request!.executionRoot, 'review.txt'), 'candidate\n');
    f.adapter.complete();
    const held = await f.runtime.waitForRun(f.root, started.id);
    assert.equal(held.candidateReview?.state, 'ready');
    return { held, grant };
}

test('accept promotes the exact validated WorkItem candidate once and persists the decision', async () =>
    fixture('work-item', 'passed', async f => {
        const { held, grant } = await hold(f);
        const fingerprint = held.candidateReview!.candidateFingerprint;
        const accepted = await f.backend.decideCandidate(f.handle, held.id, 0, fingerprint, 'accept', grant);
        assert.equal(accepted.status, 'completed');
        assert.equal(accepted.reviewDecision?.kind, 'accept');
        assert.deepEqual(accepted.appliedFiles, ['review.txt']);
        assert.equal(await readFile(join(f.root, 'review.txt'), 'utf8'), 'candidate\n');
        assert.deepEqual((await f.backend.decideCandidate(f.handle, held.id, 0, fingerprint, 'accept', grant)).appliedFiles,
            ['review.txt']);
        assert.equal((await new AgentStore().readRun(f.root, held.id))?.reviewDecision?.kind, 'accept');
    }));

test('reject persists without applying and repeated rejection is idempotent', async () =>
    fixture('work-item', 'passed', async f => {
        const { held } = await hold(f);
        const fingerprint = held.candidateReview!.candidateFingerprint;
        const rejected = await f.backend.decideCandidate(f.handle, held.id, 0, fingerprint, 'reject');
        assert.equal(rejected.status, 'cancelled');
        assert.equal(rejected.reviewDecision?.kind, 'reject');
        assert.equal((await f.backend.decideCandidate(f.handle, held.id, 0, fingerprint, 'reject')).status, 'cancelled');
        await assert.rejects(readFile(join(f.root, 'review.txt')), { code: 'ENOENT' });
        await assert.rejects(f.backend.decideCandidate(f.handle, held.id, 0, fingerprint, 'accept',
            createDefaultExecutionGrant({ id: 'grant-review', revision: 0, taskId: 'task-review', acceptedAt: now })));
    }));

test('stale revision, fingerprint and authoritative Git basis block accept', async () =>
    fixture('work-item', 'passed', async f => {
        const { held, grant } = await hold(f);
        const fingerprint = held.candidateReview!.candidateFingerprint;
        await assert.rejects(f.backend.decideCandidate(f.handle, held.id, 1, fingerprint, 'accept', grant));
        await assert.rejects(f.backend.decideCandidate(f.handle, held.id, 0, '0'.repeat(64), 'accept', grant));
        await assert.rejects(f.backend.decideCandidate(f.handle, held.id, 0, fingerprint, 'accept',
            createDefaultExecutionGrant({ id: 'different-grant', revision: 0,
                taskId: 'task-review', acceptedAt: now })), /grant changed/);
        await writeFile(join(f.root, 'external.txt'), 'external\n');
        await assert.rejects(f.backend.decideCandidate(f.handle, held.id, 0, fingerprint, 'accept', grant),
            /Git basis changed/);
        assert.equal((await f.store.readRun(f.root, held.id))?.reviewDecision, undefined);
        await assert.rejects(readFile(join(f.root, 'review.txt')), { code: 'ENOENT' });
    }));

test('tampered frozen bytes and failed validation never promote', async () => {
    await fixture('work-item', 'passed', async f => {
        const { held, grant } = await hold(f);
        const saved = await f.store.reviewCandidateRoot(f.root, held.id);
        await writeFile(join(saved!, 'review.txt'), 'tampered\n');
        await assert.rejects(f.backend.decideCandidate(f.handle, held.id, 0,
            held.candidateReview!.candidateFingerprint, 'accept', grant), /Frozen review candidate changed/);
        await assert.rejects(readFile(join(f.root, 'review.txt')), { code: 'ENOENT' });
    });
    await fixture('work-item', 'failed', async f => {
        const grant = createDefaultExecutionGrant({ id: 'grant-review', revision: 0,
            taskId: 'task-review', acceptedAt: now });
        const started = await f.backend.start(f.handle, pathToFileURL(f.root).href, 'task-review', grant, true);
        await writeFile(join(f.adapter.request!.executionRoot, 'review.txt'), 'candidate\n');
        f.adapter.complete();
        const failed = await f.runtime.waitForRun(f.root, started.id);
        await assert.rejects(f.backend.decideCandidate(f.handle, failed.id, 0, '0'.repeat(64), 'accept', grant));
    });
});

test('review hold survives backend restart and accepted candidate is applied once', async () =>
    fixture('work-item', 'passed', async f => {
        const { held, grant } = await hold(f);
        const store = new AgentStore();
        const runtime = new AgentExecutionRuntime(store, {} as any, {} as any, new Map());
        const backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} }, runtime);
        try {
            const handle = (await backend.attach(pathToFileURL(f.root).href)).projectHandle;
            assert.equal((await backend.readRun(handle, held.id))?.candidateReview?.state, 'ready');
            const fingerprint = held.candidateReview!.candidateFingerprint;
            const accepted = await backend.decideCandidate(handle, held.id, 0, fingerprint, 'accept', grant);
            assert.equal(accepted.status, 'completed');
            assert.equal(await readFile(join(f.root, 'review.txt'), 'utf8'), 'candidate\n');
            assert.deepEqual(await backend.decideCandidate(handle, held.id, 0, fingerprint, 'accept', grant), accepted);
            assert.equal((await new AgentStore().readRun(f.root, held.id))?.reviewDecision?.kind, 'accept');
        } finally { backend.dispose(); await runtime.dispose(); }
    }));

test('human-reserved SHARED path fails review and records a blocked action without promotion', async () =>
    fixture('work-item', 'passed', async f => {
        const grant = createDefaultExecutionGrant({ id: 'grant-review', revision: 0,
            taskId: f.taskId, acceptedAt: new Date(Date.now() + 1_000).toISOString() });
        const started = await f.backend.start(f.handle, pathToFileURL(f.root).href, f.taskId, grant, true);
        await mkdir(join(f.adapter.request!.executionRoot, 'src'), { recursive: true });
        await writeFile(join(f.adapter.request!.executionRoot, 'src/human.txt'), 'reserved\n');
        f.adapter.complete();
        const failed = await f.runtime.waitForRun(f.root, started.id);
        assert.equal(failed.status, 'failed');
        assert.equal(failed.outcome?.code, 'authority-denied');
        assert.equal(failed.candidateReview, undefined);
        assert.equal((await f.store.listActions(f.root, started.taskId))[0]?.requiredAuthority, 'human-reserved-scope');
        await assert.rejects(readFile(join(f.root, 'src/human.txt')), { code: 'ENOENT' });
    }, { assignment: 'SHARED', workingSet: ['src'], delegablePaths: ['src/agent'], humanReservedPaths: ['src/human.txt'] }, true));
