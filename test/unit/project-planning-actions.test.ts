import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import type { PlanningActionRequest } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import type { RoadmapGateIndex } from '../../packages/project-intelligence/lib/node/roadmap-gate-domain.js';

const fixture = async (run: (root: string, store: RoadmapStore, actions: ProjectPlanningActions) => Promise<void>) => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-actions-'));
    const store = new RoadmapStore();
    const actions = new ProjectPlanningActions(store);
    try {
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId: 'owner-1',
            projectRoot: root, revision: 1, phases: [], gates: [], corrections: [] });
        await store.mutateGateIndex(root, 1, 'owner-1', { type: 'phase.create', id: 'phase-1',
            title: 'Phase One', objective: 'Deliver one' });
        await run(root, store, actions);
    } finally { await rm(root, { recursive: true, force: true }); }
};
const request = (handle: string, revision: number, action: PlanningActionRequest['actions'][number]): PlanningActionRequest =>
    ({ projectHandle: handle, ownerId: 'owner-1', expectedRevision: revision, actions: [action] });
const createGate = { type: 'gate.create' as const, id: 'gate-1', parentPhaseId: 'phase-1', designation: 'G1',
    title: 'Review', purpose: 'Confirm the result', criteria: [{ id: 'criterion-1', title: 'Visible',
        expectedResult: 'The result is visible' }] };

test('service-backed Gate preview, approval, edit, criterion and selected read persist', async () => fixture(async (root, store, actions) => {
    const { projectHandle, snapshot } = await actions.attach(root);
    assert.equal((snapshot as unknown as RoadmapGateIndex).schemaVersion, 2);
    const before = await readFile(join(root, '.dope', 'roadmap.json'));
    const proposal = request(projectHandle, snapshot.revision, createGate);
    const preview = await actions.preview(proposal);
    assert.equal(preview.requiresApproval, true);
    assert.equal(preview.next.gates[0].qualificationStatus, 'unknown');
    assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), before);
    await assert.rejects(actions.apply(proposal, preview.token), /approval required/);
    const created = await actions.apply(proposal, preview.token, true);
    assert.equal(created.gates[0].id, 'gate-1');
    const edit = request(projectHandle, created.revision, { type: 'gate.edit', id: 'gate-1',
        title: 'Reviewed', purpose: 'Confirm the saved result' });
    const edited = await actions.apply(edit, (await actions.preview(edit)).token, true);
    assert.equal(edited.gates[0].title, 'Reviewed');
    const criterion = request(projectHandle, edited.revision, { type: 'criterion.edit', gateId: 'gate-1',
        id: 'criterion-1', title: 'Visible result', expectedResult: 'The saved result is visible' });
    await actions.apply(criterion, (await actions.preview(criterion)).token, true);
    const selected = await actions.read(projectHandle, 'owner-1', 'gate-1') as { selected: RoadmapGateIndex['gates'][number] };
    assert.equal(selected.selected.criteria[0].expectedResult, 'The saved result is visible');
    assert.equal((await new RoadmapStore().read<RoadmapGateIndex>(root)).gates[0].title, 'Reviewed');
    assert.equal(selected.selected.qualificationStatus, 'unknown');
}));

test('invalid identity, permission, stale owner and approval denials leave the index unchanged', async () => fixture(async (root, store, actions) => {
    const { projectHandle } = await actions.attach(root);
    const good = request(projectHandle, 2, createGate);
    await assert.rejects(actions.preview(request(projectHandle, 2, { ...createGate, id: 'bad\0id' })), /Invalid|identity/);
    await assert.rejects(actions.preview({ ...good, projectHandle: 'foreign' }), /Foreign/);
    await assert.rejects(actions.preview({ ...good, ownerId: 'foreign' }), /Foreign/);
    await assert.rejects(actions.preview({ ...good, expectedRevision: 1 }), /Stale/);
    await assert.rejects(actions.preview(request(projectHandle, 2, { type: 'status', id: 'phase-1', status: 'not-green' })), /retired/);
    await assert.rejects(actions.preview(request(projectHandle, 2, { type: 'shell', command: 'whoami' } as never)), /Unknown/);
    const preview = await actions.preview(good);
    await assert.rejects(actions.apply(good, preview.token, false), /approval required/);
    await assert.rejects(actions.apply(good, 'wrong', true), /preview token/);
    assert.equal((await store.read<RoadmapGateIndex>(root)).revision, 2);
    await store.mutateGateIndex(root, 2, 'owner-1', { type: 'phase.create', id: 'phase-2',
        title: 'Second', objective: 'Deliver two' });
    await assert.rejects(actions.apply(good, preview.token, true), /Stale/);
    assert.equal((await store.read<RoadmapGateIndex>(root)).gates.length, 0);
}));
