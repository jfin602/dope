import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { readHistoryOwnerMetadata } from '../../packages/theia-extension/lib/node/history-owner-metadata.js';
import { gateFixture, sha } from './roadmap-gate-document-fixture.ts';

const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const proof = { projectId: 'owner', revision: 1, sha256: hash('reviewed source') };
async function fixture(run: (root: string, store: RoadmapStore) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), 'dope-finish-planning-'));
    const store = new RoadmapStore();
    try {
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId: 'owner',
            projectRoot: root, revision: 1, phases: [], gates: [], corrections: [] });
        await run(root, store);
    } finally { await rm(root, { recursive: true, force: true }); }
}
async function plan(root: string, store: RoadmapStore, second = false) {
    let index = await store.read(root);
    index = await store.mutateGateIndex(root, index.revision, 'owner',
        { type: 'phase.create', id: 'p1', title: 'One', objective: 'Deliver one' });
    index = await store.mutateGateIndex(root, index.revision, 'owner',
        { type: 'gate.create', id: 'g1', parentPhaseId: 'p1', designation: 'G1', title: 'Required check',
            purpose: 'Verify', criteria: [{ id: 'c1', title: 'Expected check', expectedResult: 'Result observed' }] });
    if (second) index = await store.mutateGateIndex(root, index.revision, 'owner',
        { type: 'phase.create', id: 'p2', title: 'Two', objective: 'Deliver two' });
    return index;
}

test('Finish Planning locks only the reviewed Phase, persists one History revision, and reopens by review', async () =>
    fixture(async (root, store) => {
        let index = await plan(root, store, true);
        await assert.rejects(store.previewFinishPlanning(root, 'owner', index.revision, 'p1'), /coverage approval/);
        index = await store.mutateGateIndex(root, index.revision, 'owner',
            { type: 'phase.coverage.approve', id: 'p1', requiredGateIds: ['g1'], approvedBy: 'reviewer',
                reviewedAt: new Date().toISOString(), source: proof });
        const before = await store.listRevisions(root, 'owner');
        const preview = await store.previewFinishPlanning(root, 'owner', index.revision, 'p1');
        assert.deepEqual(preview.requiredGateIds, ['g1']);
        assert.deepEqual(preview.criteria, [{ id: 'c1', expectedResult: 'Result observed' }]);
        const locked = await store.finishPlanning(root, preview, true, 'reviewer');
        assert.equal(locked.phases.find(p => p.id === 'p1')?.planningLock?.basisRevision, index.revision);
        assert.equal(locked.phases.find(p => p.id === 'p1')?.qualificationStatus,
            index.phases.find(p => p.id === 'p1')?.qualificationStatus);
        assert.deepEqual(locked.gates, index.gates);
        assert.equal(locked.phases.find(p => p.id === 'p2')?.planningLock, undefined);
        assert.equal((await new RoadmapStore().read(root)).phases.find(p => p.id === 'p1')?.planningLock?.approvalId,
            preview.approvalId);
        const after = await store.listRevisions(root, 'owner');
        assert.equal(after.revisions.length, before.revisions.length + 1);
        assert.deepEqual(after.revisions[0].receipt.operationIds,
            ['phase-finish-planning:p1', `planning-approval:${preview.approvalId}`]);
        const history = async () => (await readHistoryOwnerMetadata({ projectId: 'workbench', projectRoot: root },
            new Date().toISOString())).entries.filter(item => item.source === 'roadmap');
        assert.deepEqual((await history()).map(item => item.title),
            [`Phase planning locked (R${locked.revision})`]);
        await assert.rejects(store.finishPlanning(root, preview, true, 'reviewer'), /unissued/);
        await assert.rejects(store.mutateGateIndex(root, locked.revision, 'owner',
            { type: 'phase.edit', id: 'p1', title: 'Changed', objective: 'Deliver one' }), /planning lock/);
        await assert.rejects(store.mutateGateIndex(root, locked.revision, 'owner',
            { type: 'phase.coverage.revoke', id: 'p1' }), /planning lock/);
        const other = await store.mutateGateIndex(root, locked.revision, 'owner',
            { type: 'phase.edit', id: 'p2', title: 'Edited', objective: 'Deliver two' });
        const reopen = await store.previewReopenPlanning(root, 'owner', other.revision, 'p1');
        const reopened = await store.reopenPlanning(root, reopen, true, 'reviewer');
        assert.equal(reopened.phases.find(p => p.id === 'p1')?.planningLock, undefined);
        assert.deepEqual((await history()).map(item => item.title),
            [`Phase planning reopened (R${reopened.revision})`, `Phase planning locked (R${locked.revision})`]);
        await assert.rejects(store.reopenPlanning(root, reopen, true, 'reviewer'), /unissued/);
    }));

test('Finish Planning rejects missing Gates, proposals, foreign and stale approvals without writes', async () =>
    fixture(async (root, store) => {
        let index = await store.mutateGateIndex(root, 1, 'owner',
            { type: 'phase.create', id: 'p1', title: 'One', objective: 'Deliver one' });
        await assert.rejects(store.previewFinishPlanning(root, 'owner', index.revision, 'p1'), /empty|coverage/);
        await assert.rejects(store.mutateGateIndex(root, index.revision, 'owner',
            { type: 'gate.create', id: 'incomplete', parentPhaseId: 'p1', designation: 'G1',
                title: 'Incomplete', purpose: 'Missing expected result', criteria: [] }), /gate fields/);
        index = await store.mutateGateIndex(root, index.revision, 'owner',
            { type: 'gate.create', id: 'g1', parentPhaseId: 'p1', designation: 'G1', title: 'Check',
                purpose: 'Verify', criteria: [{ id: 'c1', title: 'Result', expectedResult: 'Observed' }] });
        await assert.rejects(store.previewFinishPlanning(root, 'foreign', index.revision, 'p1'), /foreign/);
        await assert.rejects(store.previewFinishPlanning(root, 'owner', index.revision - 1, 'p1'), /Stale/);
        index = await store.mutateGateIndex(root, index.revision, 'owner',
            { type: 'phase.coverage.approve', id: 'p1', requiredGateIds: ['g1'], approvedBy: 'reviewer',
                reviewedAt: new Date().toISOString(), source: proof });
        const unlisten = store.onPlanningConflict((projectRoot, projectId) =>
            projectRoot === root && projectId === 'owner');
        await assert.rejects(store.previewFinishPlanning(root, 'owner', index.revision, 'p1'), /Pending Roadmap proposal/);
        unlisten();
        const preview = await store.previewFinishPlanning(root, 'owner', index.revision, 'p1');
        const file = join(root, '.dope', 'roadmap.json');
        const before = await readFile(file);
        await assert.rejects(store.finishPlanning(root, { ...preview, criteria: [] }, true, 'reviewer'), /unissued/);
        assert.deepEqual(await readFile(file), before);
        const changed = await store.mutateGateIndex(root, index.revision, 'owner',
            { type: 'phase.create', id: 'p2', title: 'Two', objective: 'Deliver two' });
        await assert.rejects(store.finishPlanning(root, preview, true, 'reviewer'), /Stale/);
        assert.equal((await store.read(root)).revision, changed.revision);
    }));

test('linked source hash mismatch and unresolved proposals prevent Finish Planning', async () =>
    fixture(async (root, store) => {
        let index = await plan(root, store);
        index = await store.mutateGateIndex(root, index.revision, 'owner',
            { type: 'phase.coverage.approve', id: 'p1', requiredGateIds: ['g1'], approvedBy: 'reviewer',
                reviewedAt: new Date().toISOString(), source: proof });
        const file = join(root, '.dope', 'roadmap.json');
        const raw = JSON.parse(await readFile(file, 'utf8'));
        raw.corrections = [{ id: 'repair', projectId: 'owner', parent: { kind: 'phase', id: 'p1' },
            title: 'Pending', objective: 'Resolve', order: 0, implementationStatus: 'unknown',
            qualificationStatus: 'unknown', draftAcceptance: 'proposed' }];
        await writeFile(file, `${JSON.stringify(raw)}\n`);
        await assert.rejects(store.previewFinishPlanning(root, 'owner', index.revision, 'p1'), /unresolved/);
        raw.corrections = [];
        raw.linkedDocument = { projectId: 'owner', projectRoot: root, path: 'ROADMAP.md',
            sourceHash: hash('old'), syncState: 'synced', sections: [],
            lastSynced: { sourceHash: hash('old'), fields: [] } };
        await writeFile(join(root, 'ROADMAP.md'), 'changed');
        await writeFile(file, `${JSON.stringify(raw)}\n`);
        await assert.rejects(store.previewFinishPlanning(root, 'owner', index.revision, 'p1'), /source|hash/i);
    }));

test('linked Markdown is checked again at confirmation without writing or locking on drift', async () =>
    gateFixture(async (root, file, store) => {
        let index = await store.read(root);
        assert.equal(index.phases[0].planningLock, undefined);
        index = await store.mutateGateIndex(root, index.revision, index.projectId,
            { type: 'phase.coverage.approve', id: 'phase-one', requiredGateIds: ['gate-one'],
                approvedBy: 'reviewer', reviewedAt: new Date().toISOString(),
                source: { projectId: index.projectId, revision: index.revision,
                    path: 'ROADMAP.md', sha256: index.linkedDocument!.sourceHash } });
        const preview = await store.previewFinishPlanning(root, index.projectId, index.revision, 'phase-one');
        const canonical = await readFile(join(root, '.dope', 'roadmap.json'));
        await writeFile(file, 'externally changed');
        await assert.rejects(store.finishPlanning(root, preview, true, 'reviewer'), /linked|stale|source/i);
        assert.equal(sha(await readFile(join(root, '.dope', 'roadmap.json'))), sha(canonical));
        assert.equal((await store.read(root)).phases[0].planningLock, undefined);
    }));
