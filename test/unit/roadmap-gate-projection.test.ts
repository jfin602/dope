import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { readRoadmapProjection } from '../../packages/project-intelligence/lib/node/roadmap-projection-reader.js';

const fixture = async (run: (root: string) => Promise<void>) => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-projection-'));
    try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
};

test('saved schema-2 Roadmap projects stable Phase/Gate/Correction IDs, parents, dependencies and honest status', async () => fixture(async root => {
    const store = new RoadmapStore();
    await store.saveGateIndex(root, 0, 'uninitialized', {
        schemaVersion: 2, projectId: 'project-c100', projectRoot: root, revision: 1,
        phases: [], gates: [], corrections: [],
    });
    const act = async (revision: number, operation: Parameters<RoadmapStore['mutateGateIndex']>[3]) =>
        store.mutateGateIndex(root, revision, 'project-c100', operation);
    await act(1, { type: 'phase.create', id: 'phase-11', title: 'Phase 11', objective: 'Deliver workflow' });
    await act(2, { type: 'gate.create', id: 'gate-11', parentPhaseId: 'phase-11', designation: 'G1',
        title: 'Qualification', purpose: 'Verify workflow', criteria: [
            { id: 'criterion-11', title: 'Visible result', expectedResult: 'Result is visible' }] });
    await act(3, { type: 'gate.create', id: 'gate-12', parentPhaseId: 'phase-11', designation: 'G2',
        title: 'Follow-up', purpose: 'Verify another result', criteria: [
            { id: 'criterion-12', title: 'Other result', expectedResult: 'Other is visible' }] });
    await act(4, { type: 'gate.dependencies', id: 'gate-12', dependencies: ['gate-11'] });
    await act(5, { type: 'correction.attach', id: 'correction-11', parent: { kind: 'gate', id: 'gate-11' },
        criterionId: 'criterion-11', title: 'Repair', objective: 'Fix evidence' });
    const first = await readRoadmapProjection(new RoadmapStore(), root, [],
        { projectId: 'project-c100', selectedId: 'gate-11' });
    const second = await readRoadmapProjection(new RoadmapStore(), root, [],
        { projectId: 'project-c100', selectedId: 'gate-11' });
    assert.deepEqual(second, first);
    assert.equal(first.revision, 6);
    assert.deepEqual(first.nodes.map(node => [node.kind, node.id]), [
        ['phase', 'phase-11'], ['gate', 'gate-11'], ['gate', 'gate-12'], ['correction', 'correction-11']]);
    assert.equal(first.selection?.node.id, 'gate-11');
    assert.equal(first.nodes.find(node => node.id === 'gate-11')?.parentId, 'phase-11');
    assert.equal(first.nodes.find(node => node.id === 'correction-11')?.parentId, 'gate-11');
    assert.equal(first.nodes.find(node => node.id === 'gate-11')?.qualificationStatus, 'unknown');
    assert.equal(first.nodes.find(node => node.id === 'phase-11')?.qualificationStatus, 'planned');
    assert.equal(first.nodes.find(node => node.id === 'gate-11')?.evidenceStatus, 'none');
    assert(first.edges.some(edge => edge.kind === 'dependency' && edge.from === 'gate-11' && edge.to === 'gate-12'));
    assert.equal(first.nodes.some(node => node.kind === 'gate' && node.id.startsWith('task:')), false);
}));

test('projection selection is project-scoped and c10 cannot alias c100', async () => fixture(async root => {
    const store = new RoadmapStore();
    await store.saveGateIndex(root, 0, 'uninitialized', {
        schemaVersion: 2, projectId: 'project-c100', projectRoot: root, revision: 1,
        phases: [], gates: [], corrections: [],
    });
    await store.mutateGateIndex(root, 1, 'project-c100', {
        type: 'phase.create', id: 'phase-1', title: 'Phase 1', objective: 'Own c100',
    });
    await store.mutateGateIndex(root, 2, 'project-c100', {
        type: 'gate.create', id: 'gate-1', parentPhaseId: 'phase-1', designation: 'G1',
        title: 'Shared-looking ID', purpose: 'Verify c100', criteria: [
            { id: 'criterion-1', title: 'Visible result', expectedResult: 'Result is visible' }],
    });
    const selected = await readRoadmapProjection(store, root, [], { projectId: 'project-c10', selectedId: 'gate-1' });
    assert.equal(selected.projectId, 'project-c100');
    assert.equal(selected.selection, undefined);
    assert(selected.nodes.some(node => node.id === 'gate-1'));
}));

test('store change revision leads the existing service reader to the new saved projection', async () => fixture(async root => {
    const store = new RoadmapStore();
    const changes: { projectId: string; revision: number }[] = [];
    const off = store.onChange(change => changes.push(change));
    await store.saveGateIndex(root, 0, 'uninitialized', {
        schemaVersion: 2, projectId: 'project-c11', projectRoot: root, revision: 1,
        phases: [], gates: [], corrections: [],
    });
    await store.mutateGateIndex(root, 1, 'project-c11', {
        type: 'phase.create', id: 'phase-11', title: 'Phase 11', objective: 'Deliver workflow',
    });
    const projection = await readRoadmapProjection(store, root, [],
        { projectId: 'project-c11', selectedId: 'phase-11' });
    assert.deepEqual(changes.map(change => [change.projectId, change.revision]),
        [['project-c11', 1], ['project-c11', 2]]);
    assert.equal(projection.revision, changes.at(-1)?.revision);
    assert.equal(projection.selection?.node.id, 'phase-11');
    assert.equal(projection.selection?.node.qualificationStatus, 'unplanned');
    off();
}));
