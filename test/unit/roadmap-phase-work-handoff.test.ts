import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import type { PhaseWorkLink } from '../../packages/project-intelligence/src/node/roadmap-gate-domain.ts';
import { gateFixture } from './roadmap-gate-document-fixture.ts';
import { readHistoryOwnerMetadata } from '../../packages/theia-extension/lib/node/history-owner-metadata.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
    physicalInputFingerprint: 'physical', physicalGeneration: 1 };

test('locked Phase Work review records exact many-to-many Criteria and WorkItem IDs without a grant', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-phase-work-'));
    try {
        const store = new RoadmapStore();
        let roadmap = await store.saveGateIndex(root, 0, 'uninitialized', {
            schemaVersion: 2, projectId: 'roadmap', projectRoot: root, revision: 1,
            phases: [], gates: [], corrections: [] });
        roadmap = await store.mutateGateIndex(root, roadmap.revision, 'roadmap',
            { type: 'phase.create', id: 'phase', title: 'Phase', objective: 'Deliver a result' });
        roadmap = await store.mutateGateIndex(root, roadmap.revision, 'roadmap',
            { type: 'gate.create', id: 'gate', parentPhaseId: 'phase', designation: 'G1', title: 'Gate',
                purpose: 'Verify result', criteria: [
                    { id: 'c1', title: 'First', expectedResult: 'First observed' },
                    { id: 'c2', title: 'Second', expectedResult: 'Second observed' }] });
        const collection = { projectId: 'planning', revision: 1, maps: [{ id: 'map', projectId: 'planning',
            revision: 1, status: 'draft', basis, transformations: [{ id: 'change' }], workItems: [
                { id: 'work-a', title: 'A', status: 'ready', transformationIds: ['change'],
                    acceptanceCriteria: ['A accepted'], validationTargets: ['A checked'] },
                { id: 'work-b', title: 'B', status: 'ready', transformationIds: ['change'],
                    acceptanceCriteria: ['B accepted'], validationTargets: ['B checked'] }] }] };
        const readPlanning = async () => collection;
        const link = (workItemId: string, criterionIds: string[]): PhaseWorkLink => ({
            planningProjectId: 'planning', mapId: 'map', mapRevision: 1, basis, workItemId,
            transformationIds: ['change'], criterionIds });
        await assert.rejects(store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [link('work-a', ['c1', 'c2'])], readPlanning), /Finish and lock/);
        roadmap = await store.mutateGateIndex(root, roadmap.revision, 'roadmap',
            { type: 'phase.coverage.approve', id: 'phase', requiredGateIds: ['gate'], approvedBy: 'owner',
                reviewedAt: new Date().toISOString(), source: { projectId: 'roadmap', revision: roadmap.revision,
                    sha256: hash('source') } });
        const finish = await store.previewFinishPlanning(root, 'roadmap', roadmap.revision, 'phase');
        roadmap = await store.finishPlanning(root, finish, true, 'owner');
        await assert.rejects(store.previewPhaseWork(root, 'foreign', roadmap.revision, 'phase',
            [link('work-a', ['c1', 'c2'])], readPlanning), /foreign/);
        await assert.rejects(store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [link('work-a', ['c1'])], readPlanning), /Link every required Criterion/);
        await assert.rejects(store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [link('work-a', ['c1', 'c2']), link('work-a', ['c1'])], readPlanning), /distinct WorkItems/);
        await assert.rejects(store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [link('missing', ['c1', 'c2'])], readPlanning), /WorkItem/);
        collection.maps[0].workItems[1].status = 'proposed';
        await assert.rejects(store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [link('work-b', ['c1', 'c2'])], readPlanning), /Ready WorkItem/);
        collection.maps[0].workItems[1].status = 'ready';
        await assert.rejects(store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [{ ...link('work-a', ['c1', 'c2']), planningProjectId: 'foreign' }], readPlanning), /Foreign/);
        await assert.rejects(store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [{ ...link('work-a', ['c1', 'c2']), mapRevision: 2 }], readPlanning), /stale Planning Map/);
        await assert.rejects(store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [link('work-a', ['c1', 'ambiguous'])], readPlanning), /unknown Criterion/);
        await assert.rejects(store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [link('work-a', ['c2', 'c1'])], readPlanning), /locked Gate and Criterion order/);
        const review = await store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [link('work-a', ['c1', 'c2']), link('work-b', ['c2'])], readPlanning);
        assert.deepEqual(review.items.map(item => item.criterionIds), [['c1', 'c2'], ['c2']]);
        await assert.rejects(store.applyPhaseWork(root, review, false, 'owner', readPlanning), /approval required/);
        const changed = await store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [link('work-a', ['c1', 'c2'])], readPlanning);
        collection.revision++;
        await assert.rejects(store.applyPhaseWork(root, changed, true, 'owner', readPlanning), /Planning or WorkItem review changed/);
        const approved = await store.previewPhaseWork(root, 'roadmap', roadmap.revision, 'phase',
            [link('work-a', ['c1', 'c2']), link('work-b', ['c2'])], readPlanning);
        const applied = await store.applyPhaseWork(root, approved, true, 'owner', readPlanning);
        assert.equal(applied.phases[0].workLinks?.length, 2);
        assert.equal(applied.phases[0].implementationStatus, roadmap.phases[0].implementationStatus);
        assert.equal(applied.phases[0].qualificationStatus, roadmap.phases[0].qualificationStatus);
        assert.deepEqual((await new RoadmapStore().read(root)).phases[0].workLinks, approved.links);
        const history = await readHistoryOwnerMetadata({ projectId: 'workbench', projectRoot: root }, new Date().toISOString());
        assert.ok(history.entries.some(entry => entry.sourceId === `phase-work:roadmap:${applied.revision}`));
        await assert.rejects(store.applyPhaseWork(root, approved, true, 'owner', readPlanning), /approval required/);
        await assert.rejects(store.previewPhaseWork(root, 'roadmap', applied.revision, 'phase',
            approved.links, readPlanning), /already reviewed/);
        await assert.rejects(store.previewReopenPlanning(root, 'roadmap', applied.revision, 'phase'), /executing Phase/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('linked Markdown drift after Work review prevents applying a Phase link', async () =>
    gateFixture(async (root, file, store) => {
        let roadmap = await store.read(root);
        roadmap = await store.mutateGateIndex(root, roadmap.revision, roadmap.projectId,
            { type: 'phase.coverage.approve', id: 'phase-one', requiredGateIds: ['gate-one'],
                approvedBy: 'owner', reviewedAt: new Date().toISOString(), source: {
                    projectId: roadmap.projectId, revision: roadmap.revision,
                    path: 'ROADMAP.md', sha256: roadmap.linkedDocument!.sourceHash } });
        const finish = await store.previewFinishPlanning(root, roadmap.projectId, roadmap.revision, 'phase-one');
        roadmap = await store.finishPlanning(root, finish, true, 'owner');
        const criterionIds = roadmap.gates[0].criteria.map(item => item.id);
        const link: PhaseWorkLink = { planningProjectId: 'planning', mapId: 'map', mapRevision: 1,
            basis, workItemId: 'work', transformationIds: ['change'], criterionIds };
        const planning = async () => ({ projectId: 'planning', revision: 1, maps: [{ id: 'map',
            projectId: 'planning', revision: 1, status: 'active', basis,
            transformations: [{ id: 'change' }], workItems: [{ id: 'work', title: 'Work', status: 'ready',
                transformationIds: ['change'], acceptanceCriteria: ['Accepted'], validationTargets: ['Verified'] }] }] });
        const review = await store.previewPhaseWork(root, roadmap.projectId, roadmap.revision,
            'phase-one', [link], planning);
        const before = await readFile(join(root, '.dope', 'roadmap.json'));
        await writeFile(file, 'Externally changed');
        await assert.rejects(store.applyPhaseWork(root, review, true, 'owner', planning), /source|stale|linked/i);
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), before);
    }));
