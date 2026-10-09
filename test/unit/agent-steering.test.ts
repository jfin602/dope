import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';

const at = '2026-10-09T12:00:00Z';
const task = { version: 1, id: 'task-1', createdAt: at, objective: 'Edit one file',
    instructions: 'Edit src/a.ts', projectRoot: '.', modelPolicy: { kind: 'follow-coding-agent' },
    controls: {}, authority: { profile: 'phase-8b-project' },
    completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' } };
const run = { version: 1, id: 'run-1', taskId: 'task-1', status: 'pending', grantId: 'grant-1',
    grantRevision: 0, requestedPolicy: { kind: 'follow-coding-agent' }, projectRoot: '.',
    createdAt: at, changedFiles: [], validationResults: [] };

async function fixture(work: (f: { root: string; store: AgentStore; backend: AgentRuntimeBackend;
    handle: string }) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), 'dope-agent-steering-'));
    try {
        const store = new AgentStore();
        await store.createTask(root, task as never);
        const pending = await store.createRun(root, run as never);
        await store.updateRun(root, pending, { ...pending, status: 'running', startedAt: at });
        const backend = new AgentRuntimeBackend(store, { notifyAgentStateChanged() {} },
            { activeRunId: () => 'run-1', reconcile: async () => {} } as never);
        const { projectHandle } = await backend.attach(new URL(`file://${root}`).href);
        await work({ root, store, backend, handle: projectHandle });
    } finally { await rm(root, { recursive: true, force: true }); }
}

test('unsupported active turn persists a scoped, truthful acknowledgement without executing it', async () => fixture(async f => {
    const state = await f.backend.requestSteering(f.handle, 'task-1', 'run-1', 0,
        { kind: 'instruction', text: 'Focus on the parser' });
    assert.equal(state.revision, 1);
    assert.equal(state.entries[0].acknowledgement.status, 'unsupported');
    assert.equal(state.entries[0].acknowledgement.nextStep, 'explicit-stop-and-new-task');
    assert.deepEqual(await new AgentStore().readSteering(f.root, 'run-1'), state);
    assert.match(await readFile(join(f.root, '.dope/agent/runs/run-1/steering.json'), 'utf8'), /Focus on the parser/);
    assert.equal((await f.store.readRun(f.root, 'run-1'))?.grantRevision, 0);
    await assert.rejects(f.backend.requestSteering(f.handle, 'other-task', 'run-1', 1,
        { kind: 'focus', text: 'Another request' }), /mismatch/);
}));

test('stale steering revision cannot overwrite acknowledged intent', async () => fixture(async f => {
    await f.backend.requestSteering(f.handle, 'task-1', 'run-1', 0,
        { kind: 'focus', text: 'Keep the change small' });
    await assert.rejects(f.backend.requestSteering(f.handle, 'task-1', 'run-1', 0,
        { kind: 'instruction', text: 'Different instruction' }), /Stale steering revision/);
    assert.equal((await f.backend.readSteering(f.handle, 'run-1'))?.entries.length, 1);
}));

test('terminal run rejects steering', async () => fixture(async f => {
    const running = (await f.store.readRun(f.root, 'run-1'))!;
    await f.store.updateRun(f.root, running, { ...running, status: 'completed', endedAt: at });
    await assert.rejects(f.backend.requestSteering(f.handle, 'task-1', 'run-1', 0,
        { kind: 'instruction', text: 'Too late' }), /no steerable active turn/);
    assert.equal(await f.backend.readSteering(f.handle, 'run-1'), undefined);
}));
