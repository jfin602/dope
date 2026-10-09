import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { AgentRuntimeBackend } from '../../packages/theia-extension/lib/node/agent-runtime-backend.js';
import { AgentExecutionRuntime } from '../../packages/theia-extension/lib/node/agent-execution-runtime.js';

const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
    physicalInputFingerprint: 'source', physicalGeneration: 1 };
const selection = (key: string, revision: number, mapRevision: number, paths = ['src/agent']) => ({
    requestKey: key, expectedProjectRevision: revision, expectedMapRevision: mapRevision,
    planningMapId: 'plan', workItemId: 'work', delegablePaths: paths,
    modelPolicy: { kind: 'follow-coding-agent' as const }, controls: {},
    completion: { validation: [{ kind: 'test' as const, label: 'focused', command: 'npm test -- --focused' }],
        requireValidationPass: true }, validationApproved: true
});
async function fixture(assignment: 'AI' | 'SHARED' | 'HUMAN', run: (context: {
    backend: AgentRuntimeBackend; planning: PlanningStore; agents: AgentStore;
    root: string; handle: string; revision: number; mapRevision: number;
}) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), 'dope-workitem-launch-'));
    const planning = new PlanningStore(), agents = new AgentStore();
    const backend = new AgentRuntimeBackend(agents, { notifyAgentStateChanged: () => undefined }, undefined, planning);
    try {
        let collection = await planning.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Build', basis });
        collection = await planning.mutate(root, collection.revision, { type: 'put-transformation', mapId: 'plan',
            transformation: { id: 'change', kind: 'add', currentIds: [], dependsOn: [],
                futureNodes: [{ id: 'core', kind: 'system', name: 'Core', purpose: 'Core', roots: ['src'] }] } });
        const work = { id: 'work', title: 'Build core', objective: 'Implement core', transformationIds: ['change'],
            dependsOn: [], requirements: ['Keep tests green'], constraints: ['Stay in scope'],
            acceptanceCriteria: ['Core works'], validationTargets: [], workingSet: ['src'],
            status: 'proposed' as const, assignment,
            delegablePaths: assignment === 'HUMAN' ? [] : ['src/agent'],
            humanReservedPaths: assignment === 'SHARED' ? ['src/human'] : assignment === 'HUMAN' ? ['src'] : [] };
        collection = await planning.mutate(root, collection.revision, { type: 'put-work-item', mapId: 'plan', workItem: work });
        collection = await planning.mutate(root, collection.revision, { type: 'put-work-item', mapId: 'plan',
            workItem: { ...work, status: 'ready' } });
        collection = await planning.mutate(root, collection.revision, { type: 'transition', mapId: 'plan', status: 'active' });
        const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
        await run({ backend, planning, agents, root, handle, revision: collection.revision,
            mapRevision: collection.maps[0].revision });
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
}

test('launch derives a bounded immutable WorkItem task and inverse links from AgentStore', async () =>
    fixture('SHARED', async ({ backend, agents, root, handle, revision, mapRevision }) => {
        const request = selection('launch-one', revision, mapRevision);
        const task = await backend.launchWorkItem(handle, request);
        assert.equal(task.objective, 'Implement core');
        assert.equal(task.reviewPolicy?.kind, 'required');
        assert.deepEqual(task.completion, request.completion);
        assert.equal(task.origin.kind, 'work-item');
        if (task.origin.kind !== 'work-item') throw new Error('Wrong origin');
        assert.equal(task.origin.mapRevision, mapRevision);
        assert.deepEqual(task.origin.scope, { assignment: 'SHARED', workingSet: ['src'],
            delegablePaths: ['src/agent'], humanReservedPaths: ['src/human'] });
        assert.deepEqual(await backend.listWorkItemTasks(handle, 'plan', 'work'), [task]);
        assert.deepEqual(await agents.listTasks(root), [task]);
        assert.deepEqual(await backend.listRuns(handle), []);
        assert.throws(() => backend.createTask(handle, task), /revision-checked launch/);
    }));

test('WorkItem launch refuses unapproved, absent, optional or malformed validation without persisting a task', async () =>
    fixture('AI', async ({ backend, agents, root, handle, revision, mapRevision }) => {
        const valid = selection('validation', revision, mapRevision);
        const denied = [
            { ...valid, validationApproved: false },
            { ...valid, validationApproved: undefined },
            { ...valid, completion: { validation: [], requireValidationPass: true } },
            { ...valid, completion: { ...valid.completion, requireValidationPass: false } },
            { ...valid, completion: { validation: [{ kind: 'test', label: 'focused' }], requireValidationPass: true } },
            { ...valid, completion: { validation: [{ kind: 'test', label: 'focused', command: ' ' }], requireValidationPass: true } },
            { ...valid, completion: { validation: [{ kind: 'test', label: 'focused', command: 'x'.repeat(161) }], requireValidationPass: true } },
            { ...valid, completion: { validation: Array(13).fill({ kind: 'test', label: 'focused', command: 'true' }), requireValidationPass: true } },
            { ...valid, completion: { validation: [{ kind: 'unknown', label: 'focused', command: 'true' }], requireValidationPass: true } }
        ];
        for (const request of denied) {
            await assert.rejects(backend.launchWorkItem(handle, request as typeof valid));
            assert.deepEqual(await agents.listTasks(root), []);
        }
        const task = await backend.launchWorkItem(handle, valid);
        assert.deepEqual(await agents.listTasks(root), [task]);
        await assert.rejects(backend.launchWorkItem(handle, { ...valid, requestKey: 'another',
            validationApproved: false }), /developer approval/);
        assert.deepEqual(await agents.listTasks(root), [task]);
    }));

test('saved legacy WorkItem task with empty completion cannot Start or create a run', async () =>
    fixture('AI', async ({ backend, agents, root, handle, revision, mapRevision }) => {
        const approved = await backend.launchWorkItem(handle, selection('valid-task', revision, mapRevision));
        const legacy = await agents.createTask(root, { ...approved, id: 'legacy-empty',
            completion: { validation: [], requireValidationPass: false } });
        const runtime = new AgentExecutionRuntime(agents, {} as any, {} as any, new Map());
        try {
            await assert.rejects(runtime.start(root, pathToFileURL(root).href, legacy.id, {} as any, false),
                /requires approved Dope validation/);
            assert.deepEqual(await agents.listRuns(root), []);
            assert.deepEqual((await agents.readTask(root, legacy.id))?.completion, legacy.completion);
        } finally { await runtime.dispose(); }
    }));

test('same request key is idempotent, including concurrent retries; conflicting reuse fails', async () =>
    fixture('AI', async ({ backend, handle, revision, mapRevision }) => {
        const request = selection('same-key', revision, mapRevision);
        const [first, second] = await Promise.all([backend.launchWorkItem(handle, request), backend.launchWorkItem(handle, request)]);
        assert.equal(first.id, second.id);
        assert.equal((await backend.listTasks(handle)).length, 1);
        assert.equal((await backend.launchWorkItem(handle, request)).id, first.id);
        await assert.rejects(backend.launchWorkItem(handle, { ...request, workItemId: 'other' }), /request key already used/);
    }));

test('stale project or map revision cannot launch', async () =>
    fixture('AI', async ({ backend, planning, root, handle, revision, mapRevision }) => {
        await assert.rejects(backend.launchWorkItem(handle, selection('stale-project', revision - 1, mapRevision)), /Stale Planning project/);
        await assert.rejects(backend.launchWorkItem(handle, selection('stale-map', revision, mapRevision - 1)), /Stale or missing Planning map/);
        await planning.mutate(root, revision, { type: 'update', mapId: 'plan', title: 'Changed', objective: 'Changed' });
        await assert.rejects(backend.launchWorkItem(handle, selection('changed', revision, mapRevision)), /Stale Planning project/);
        assert.deepEqual(await backend.listTasks(handle), []);
    }));

test('human ownership and SHARED human-reserved paths deny launch', async () => {
    await fixture('HUMAN', async ({ backend, handle, revision, mapRevision }) => {
        await assert.rejects(backend.launchWorkItem(handle, selection('human', revision, mapRevision)), /Human-owned/);
        assert.deepEqual(await backend.listTasks(handle), []);
    });
    await fixture('SHARED', async ({ backend, handle, revision, mapRevision }) => {
        await assert.rejects(backend.launchWorkItem(handle, selection('reserved', revision, mapRevision, ['src/human'])), /human-reserved/);
        await assert.rejects(backend.launchWorkItem(handle, selection('parent', revision, mapRevision, ['src'])), /human-reserved/);
        await assert.rejects(backend.launchWorkItem(handle, selection('outside', revision, mapRevision, ['src/other'])), /outside delegable/);
        assert.deepEqual(await backend.listTasks(handle), []);
    });
});
