import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { gateFixture } from './roadmap-gate-document-fixture.ts';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

test('reviewed locked amendment stales only changed Criterion and requires fresh Work handoff', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-phase-amend-'));
    try {
        const store = new RoadmapStore();
        let index = await store.saveGateIndex(root, 0, 'uninitialized', {
            schemaVersion: 2, projectId: 'owner', projectRoot: root, revision: 1,
            phases: [], gates: [], corrections: [] });
        const act = async (operation: Parameters<RoadmapStore['mutateGateIndex']>[3]) => {
            index = await store.mutateGateIndex(root, index.revision, 'owner', operation);
        };
        await act({ type: 'phase.create', id: 'p', title: 'Phase', objective: 'Result' });
        await act({ type: 'phase.create', id: 'unrelated', title: 'Other', objective: 'Other result' });
        await act({ type: 'gate.create', id: 'g', parentPhaseId: 'p', designation: 'G1', title: 'Gate',
            purpose: 'Verify', criteria: [{ id: 'c1', title: 'One', expectedResult: 'One passes' },
                { id: 'c2', title: 'Two', expectedResult: 'Two passes' }] });
        await act({ type: 'gate.create', id: 'g2', parentPhaseId: 'p', designation: 'G2', title: 'Other gate',
            purpose: 'Verify other', criteria: [{ id: 'c3', title: 'Three', expectedResult: 'Three passes' }] });
        const source = { projectId: 'owner', revision: index.revision, sha256: hash('source') };
        await act({ type: 'phase.coverage.approve', id: 'p', requiredGateIds: ['g', 'g2'],
            approvedBy: 'owner', reviewedAt: new Date().toISOString(), source });
        index = await store.finishPlanning(root,
            await store.previewFinishPlanning(root, 'owner', index.revision, 'p'), true, 'owner');
        for (const criterionId of ['c1', 'c2', 'c3']) {
            const gateId = criterionId === 'c3' ? 'g2' : 'g';
            await act({ type: 'evidence.propose', gateId, criterionId, id: `e-${criterionId}`,
                result: 'pass', kind: 'manual-check', summary: 'Observed', verifiedBy: 'owner',
                observedAt: new Date().toISOString(), source });
            await act({ type: 'evidence.approve', gateId, criterionId, id: `e-${criterionId}`,
                reviewerId: 'owner', reviewedAt: new Date().toISOString(), currentSource: source });
        }
        const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
            physicalInputFingerprint: 'physical', physicalGeneration: 1 };
        const links = [
            { planningProjectId: 'planning', mapId: 'map', mapRevision: 1, basis,
                workItemId: 'work-a', transformationIds: ['change'], criterionIds: ['c1', 'c2'] },
            { planningProjectId: 'planning', mapId: 'map', mapRevision: 1, basis,
                workItemId: 'work-b', transformationIds: ['change'], criterionIds: ['c3'] }];
        const planning = async () => ({ projectId: 'planning', revision: 1,
            maps: [{ id: 'map', projectId: 'planning', revision: 1, status: 'active', basis,
                transformations: [{ id: 'change' }], workItems: ['work-a', 'work-b'].map(id => ({
                    id, title: id, status: 'ready', transformationIds: ['change'],
                    acceptanceCriteria: ['Accepted'], validationTargets: ['Checked'] })) }] });
        index = await store.applyPhaseWork(root,
            await store.previewPhaseWork(root, 'owner', index.revision, 'p', links, planning),
            true, 'owner', planning);
        const uiReview = await store.previewPhaseAmendment(root, 'owner', index.revision, 'p',
            [{ type: 'criterion.reorder', gateId: 'g', ids: ['c2', 'c1'] }], 'owner');
        assert.deepEqual(uiReview.affectedGateIds, []);
        index = await store.applyPhaseAmendment(root, uiReview, true, 'owner');
        assert.equal(index.phases.find(item => item.id === 'p')?.gateSetCoverage.status, 'approved');
        assert.equal(index.phases.find(item => item.id === 'p')?.workLinks?.length, 2);
        assert.equal(index.gates.find(item => item.id === 'g')?.criteria.find(item => item.id === 'c2')?.order, 0);
        const oldRevision = index.revision;
        const oldOther = structuredClone(index.phases.find(item => item.id === 'unrelated'));
        await assert.rejects(store.mutateGateIndex(root, index.revision, 'owner',
            { type: 'criterion.edit', gateId: 'g', id: 'c1', title: 'One', expectedResult: 'Changed' }),
        /planning lock|locked|amendment/i);
        const review = await store.previewPhaseAmendment(root, 'owner', index.revision, 'p',
            [{ type: 'criterion.edit', gateId: 'g', id: 'c1', title: 'One', expectedResult: 'Changed' }], 'owner');
        assert.deepEqual(review.affectedGateIds, ['g']);
        assert.deepEqual(review.affectedCriterionIds, ['c1']);
        assert.deepEqual(review.affectedWorkItemIds, ['work-a']);
        await assert.rejects(store.applyPhaseAmendment(root, { ...review, after: 'forged' }, true, 'owner'),
            /approval required/);
        assert.equal((await store.read<typeof index>(root)).revision, oldRevision);
        const accepted = await store.previewPhaseAmendment(root, 'owner', index.revision, 'p', review.operations, 'owner');
        index = await store.applyPhaseAmendment(root, accepted, true, 'owner');
        assert.equal(index.revision, oldRevision + 1);
        assert.equal(index.phases.find(item => item.id === 'p')?.qualificationStatus, 'stale');
        assert.equal(index.gates.find(item => item.id === 'g')?.qualificationStatus, 'stale');
        assert.notEqual(index.gates.find(item => item.id === 'g2')?.qualificationStatus, 'stale');
        assert.equal(index.gates.find(item => item.id === 'g')?.criteria.find(item => item.id === 'c1')
            ?.evidence[0].validation?.status, 'stale');
        assert.equal(index.gates.find(item => item.id === 'g')?.criteria.find(item => item.id === 'c2')
            ?.evidence[0].validation, undefined);
        assert.equal(index.gates.find(item => item.id === 'g2')?.criteria[0].evidence[0].validation, undefined);
        assert.deepEqual(index.phases.find(item => item.id === 'unrelated'), oldOther);
        assert.deepEqual(index.phases.find(item => item.id === 'p')?.amendment?.affectedCriterionIds, ['c1']);
        assert.equal(index.phases.find(item => item.id === 'p')?.amendment?.oldRevision, oldRevision);
        assert.equal(index.phases.find(item => item.id === 'p')?.gateSetCoverage.status, 'unreviewed');
        assert.deepEqual(index.phases.find(item => item.id === 'p')?.workLinks?.map(item => item.workItemId), ['work-b']);
        assert.equal((await store.fetchRevision(root, 'owner', oldRevision)).revision, oldRevision);
        await assert.rejects(store.applyPhaseAmendment(root, accepted, true, 'owner'), /approval required/);
        const before = await readFile(join(root, '.dope', 'roadmap.json'));
        await assert.rejects(store.previewPhaseAmendment(root, 'owner', oldRevision, 'p', accepted.operations, 'owner'),
            /current|owner|revision/i);
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), before);
        const gateReview = await store.previewPhaseAmendment(root, 'owner', index.revision, 'p',
            [{ type: 'gate.create', id: 'g3', parentPhaseId: 'p', designation: 'G3',
                title: 'New gate', purpose: 'New result',
                criteria: [{ id: 'c4', title: 'Four', expectedResult: 'Four passes' }] }], 'owner');
        assert.deepEqual(gateReview.affectedGateIds, ['g3']);
        index = await store.applyPhaseAmendment(root, gateReview, true, 'owner');
        assert.deepEqual(index.phases.find(item => item.id === 'p')?.planningLock?.requiredGateIds,
            ['g', 'g2', 'g3']);
        assert.equal(index.gates.find(item => item.id === 'g2')?.criteria[0].evidence[0].validation, undefined);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('external linked Markdown change rejects amendment apply without a canonical write', async () =>
    gateFixture(async (root, file, store) => {
        let index = await store.read(root);
        index = await store.mutateGateIndex(root, index.revision, index.projectId,
            { type: 'phase.coverage.approve', id: 'phase-one', requiredGateIds: ['gate-one'],
                approvedBy: 'owner', reviewedAt: new Date().toISOString(), source: {
                    projectId: index.projectId, revision: index.revision, path: 'ROADMAP.md',
                    sha256: index.linkedDocument!.sourceHash } });
        index = await store.finishPlanning(root,
            await store.previewFinishPlanning(root, index.projectId, index.revision, 'phase-one'), true, 'owner');
        const review = await store.previewPhaseAmendment(root, index.projectId, index.revision, 'phase-one',
            [{ type: 'phase.edit', id: 'phase-one', title: 'Amended Phase', objective: 'New result' }], 'owner');
        const before = await readFile(join(root, '.dope', 'roadmap.json'));
        await writeFile(file, 'Externally changed');
        await assert.rejects(store.applyPhaseAmendment(root, review, true, 'owner'), /source changed|conflict/i);
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), before);
        await assert.rejects(store.previewPhaseAmendment(root, index.projectId, index.revision,
            'phase-one', review.operations, 'owner'), /source changed|conflict/i);
    }));
