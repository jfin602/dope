import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapNativeStageOwner } from '../../packages/theia-extension/lib/node/roadmap-native-stage.js';
import { roadmapProposalPreview } from '../../packages/theia-extension/lib/node/roadmap-proposal-presentation.js';
import { parsePlanningActivity } from '../../packages/chat/lib/index.js';

test('native read, multi-batch stage and cancel never write the canonical index', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-native-'));
    try {
        const store = new RoadmapStore();
        const markdown = '# Roadmap\n';
        await writeFile(join(root, 'ROADMAP.md'), markdown);
        const sourceHash = createHash('sha256').update(markdown).digest('hex');
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId: 'owner',
            projectRoot: root, revision: 1, phases: [], gates: [], corrections: [],
            linkedDocument: { projectId: 'owner', projectRoot: root, path: 'ROADMAP.md',
                sourceHash, syncState: 'synced', sections: [] } });
        const file = join(root, '.dope', 'roadmap.json');
        const before = createHash('sha256').update(await readFile(file)).digest('hex');
        const owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'owner', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const read = await owner.read(context, { version: 1, limit: 2 }) as { revision: number; entries: unknown[] };
        assert.equal(read.revision, 1);
        assert.deepEqual(read.entries, []);
        const first = await owner.stage(context, { version: 1, expectedRevision: 1, expectedSourceHash: sourceHash, expectedStage: 1,
            actions: [
                { type: 'phase.create', id: 'new:p1', title: 'First', objective: 'Ship first' },
                { type: 'phase.create', id: 'new:p2', title: 'Second', objective: 'Ship second' },
            ] }) as { acceptedOperationIds: string[]; createdEntityIds: Record<string, string> };
        assert.equal(first.acceptedOperationIds.length, 2);
        const second = await owner.stage(context, { version: 1, expectedRevision: 1, expectedSourceHash: sourceHash, expectedStage: 2,
            actions: [
                { type: 'gate.create', id: 'new:g1', parentPhaseId: 'new:p1', designation: 'G1',
                    title: 'First Gate', purpose: 'Verify first', criteria: [
                        { id: 'new:c1', title: 'Observe first', expectedResult: 'First result' }] },
                { type: 'gate.create', id: 'new:g2', parentPhaseId: 'new:p2', designation: 'G2',
                    title: 'Second Gate', purpose: 'Verify second', criteria: [
                        { id: 'new:c2', title: 'Observe second', expectedResult: 'Second result' }] },
            ] }) as { acceptedOperationIds: string[]; createdEntityIds: Record<string, string>; totalOperations: number };
        assert.equal(second.acceptedOperationIds.length, 2);
        assert.equal(second.totalOperations, 4);
        assert.equal(owner.get('chat')?.operations[2].action.type, 'gate.create');
        assert.equal((owner.get('chat')?.operations[2].action as { parentPhaseId: string }).parentPhaseId,
            first.createdEntityIds['new:p1']);
        assert.equal(owner.get('chat')?.operations[0].batch, 1);
        assert.equal(owner.get('chat')?.operations[2].batch, 2);
        const cancelled = await owner.cancel(context, { version: 1 }) as { cancelled: boolean; cancelledOperationIds: string[] };
        assert.equal(cancelled.cancelled, true);
        assert.equal(cancelled.cancelledOperationIds.length, 4);
        assert.equal(owner.get('chat'), undefined);
        assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), before);
        assert.equal(createHash('sha256').update(await readFile(join(root, 'ROADMAP.md'))).digest('hex'), sourceHash);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('native stage rejects wrong identity, stale basis, invalid actions and oversized batches', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-native-negative-'));
    try {
        const store = new RoadmapStore();
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId: 'owner',
            projectRoot: root, revision: 1, phases: [], gates: [], corrections: [] });
        const owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'owner', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const basis = { version: 1, expectedRevision: 1, expectedSourceHash: null, expectedStage: 1 };
        await assert.rejects(owner.stage({ ...context, projectId: 'forged' }, { ...basis,
            actions: [{ type: 'phase.create', id: 'new:p', title: 'Title', objective: 'Objective' }] }), /OWNER_CHANGED/);
        await assert.rejects(owner.stage(context, { ...basis, expectedRevision: 0,
            actions: [{ type: 'phase.create', id: 'new:p', title: 'Title', objective: 'Objective' }] }), /STALE_SOURCE/);
        await assert.rejects(owner.stage(context, { ...basis,
            actions: [{ type: 'phase.source', id: 'new:p', source: {} }] }), /unsupported kind/);
        await assert.rejects(owner.stage(context, { ...basis,
            actions: [{ type: 'phase.create', id: 'new:p', title: '<script>alert(1)</script>', objective: 'Objective' }] }), /invalid title/);
        await assert.rejects(owner.stage(context, { ...basis,
            actions: Array.from({ length: 9 }, (_, at) => ({ type: 'phase.create', id: `new:p${at}`,
                title: 'Title', objective: 'Objective' })) }), /ARGUMENTS/);
        assert.equal(owner.get('chat'), undefined);
        await owner.stage(context, { ...basis,
            actions: [{ type: 'phase.create', id: 'new:p', title: 'Title', objective: 'Objective' }] });
        await assert.rejects(owner.stage({ ...context, lease: 'forged' }, { ...basis,
            actions: [{ type: 'phase.create', id: 'new:q', title: 'Title', objective: 'Objective' }] }), /STAGE_STALE/);
        await assert.rejects(owner.cancel({ ...context, turnId: 'other' }, { version: 1 }), /STAGE_STALE/);
        owner.get('chat')!.expires = Date.now() - 1;
        await assert.rejects(owner.cancel(context, { version: 1 }), /STAGE_STALE/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('reviewed native subset applies one revision, preserves pending decisions and rejects children without writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-native-subset-'));
    try {
        const store = new RoadmapStore();
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId: 'owner',
            projectRoot: root, revision: 1, phases: [], gates: [], corrections: [] });
        const owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'owner', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const staged = await owner.stage(context, { version: 1, expectedRevision: 1,
            expectedSourceHash: null, expectedStage: 1, done: true,
            actions: [
                { type: 'phase.create', id: 'new:p', title: 'Phase', objective: 'Ship' },
                ...['A', 'B', 'C'].map((letter, at) => ({ type: 'gate.create', id: `new:g${letter}`,
                    parentPhaseId: 'new:p', designation: `G${at + 1}`, title: `Gate ${letter}`,
                    purpose: `Verify ${letter}`, criteria: [{ id: `new:c${letter}`,
                        title: `Check ${letter}`, expectedResult: `Pass ${letter}` }] }))
            ] }) as { acceptedOperationIds: string[] };
        const [phase, a, b, c] = staged.acceptedOperationIds;
        const file = join(root, '.dope', 'roadmap.json');
        const original = await readFile(file);
        await assert.rejects(owner.review(context, [a], 'apply'), /Missing Roadmap Phase/);
        await assert.rejects(owner.review(context, [phase], 'reject'), /ROADMAP_REVIEW_DEPENDENT/);
        assert.deepEqual(await readFile(file), original);
        const review = await owner.review(context, [phase, a, b], 'apply');
        assert.equal(review.after?.gates.length, 2);
        await assert.rejects(owner.decide(context, review.token, [phase, a], 'apply'), /APPROVAL_UNAVAILABLE/);
        const applied = await owner.decide(context, review.token, [phase, a, b], 'apply');
        assert.equal(applied.revision, 2);
        assert.equal((await store.read(root)).revision, 2);
        const archive = await new RoadmapStore().listRevisions(root, 'owner');
        assert.deepEqual(archive.revisions.map(item => item.revision), [2, 1]);
        assert.deepEqual(archive.revisions[0].receipt.operationIds, [phase, a, b]);
        assert.equal((await store.fetchRevision(root, 'owner', 2)).snapshot, (await readFile(file, 'utf8')));
        await assert.rejects(owner.decide(context, review.token, [phase, a, b], 'apply'), /APPROVAL_UNAVAILABLE/);
        const rejectReview = await owner.review(context, [c], 'reject');
        const acceptedBytes = await readFile(file);
        const rejected = await owner.decide(context, rejectReview.token, [c], 'reject');
        assert.equal(rejected.revision, undefined);
        assert.deepEqual(await readFile(file), acceptedBytes);
        assert.equal((await store.listRevisions(root, 'owner')).revisions.length, 2);
        assert.deepEqual(rejected.statuses.map(item => item.status), ['Applied', 'Applied', 'Applied', 'Rejected']);
        const index = await store.read(root);
        assert.equal(index.gates.length, 2);
        assert.deepEqual(index.gates.map(gate => gate.criteria[0].title), ['Check A', 'Check B']);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('complete tower-defense batches produce one saved exact projection without owner writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-native-complete-'));
    try {
        const store = new RoadmapStore();
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId: 'tower',
            projectRoot: root, revision: 1, phases: [], gates: [], corrections: [] });
        const file = join(root, '.dope', 'roadmap.json');
        const beforeHash = createHash('sha256').update(await readFile(file)).digest('hex');
        const owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'tower', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const basis = { version: 1, expectedRevision: 1, expectedSourceHash: null };
        const first = await owner.stage(context, { ...basis, expectedStage: 1,
            actions: Array.from({ length: 5 }, (_, at) => ({ type: 'phase.create', id: `new:p${at + 1}`,
                title: `Phase ${at + 1}`, objective: `Defend lane ${at + 1}` })) }) as { proposalId: string; createdEntityIds: Record<string, string> };
        const gates = [1, 1, 2, 3].map((phase, at) => ({ type: 'gate.create', id: `new:g${at + 1}`,
            parentPhaseId: `new:p${phase}`, designation: `G${at + 1}`, title: `Gate ${at + 1}`,
            purpose: `Verify lane ${phase}`, criteria: [{ id: `new:c${at + 1}`,
                title: `Observe wave ${at + 1}`, expectedResult: `Wave ${at + 1} stops` }] }));
        const final = await owner.stage(context, { ...basis, expectedStage: 2, done: true,
            actions: gates }) as { complete: boolean; proposalId: string; totalOperations: number };
        assert.equal(final.complete, true);
        assert.equal(final.proposalId, first.proposalId);
        assert.equal(final.totalOperations, 9);
        const readback = await owner.read(context, { version: 1, limit: 1, stageOffset: 8 }) as {
            stage: { proposalId: string; operations: { id: string }[]; nextOperationOffset: number | null } };
        assert.equal(readback.stage.proposalId, final.proposalId);
        assert.equal(readback.stage.operations[0].id, owner.get('chat')!.operations[8].id);
        assert.equal(readback.stage.nextOperationOffset, null);
        const { before, after, stage } = await owner.complete(context);
        assert.equal(after.phases.length, 5);
        assert.equal(after.gates.length, 4);
        assert.equal(after.gates.filter(gate => gate.criteria.length).length, 4);
        assert.equal(after.gates[0].parentPhaseId, first.createdEntityIds['new:p1']);
        assert.equal(after.gates[2].parentPhaseId, first.createdEntityIds['new:p2']);
        assert.equal(after.gates[3].parentPhaseId, first.createdEntityIds['new:p3']);
        const changedIds = [...after.phases, ...after.gates, ...after.gates.flatMap(gate => gate.criteria)]
            .map(item => item.id);
        const preview = roadmapProposalPreview(before, after, stage.operations.map(item => item.action), changedIds);
        const saved = parsePlanningActivity({ schemaVersion: 1, kind: 'roadmap-gate-proposal', status: 'pending',
            refs: [], proposalId: stage.id, proposal: { id: stage.id, chatId: randomUUID(), messageId: randomUUID(),
                ownerId: 'tower', revision: 1, changedIds, action: { type: 'native-stage-preview', id: 'tower' },
                summary: JSON.stringify(preview), preview, previewOnly: true } });
        assert.equal(saved.proposal?.preview?.totalChanged, 13);
        assert.equal(saved.proposal?.preview?.additionalChanges, 0);
        assert.equal(saved.proposal?.preview?.steps.length, 9);
        assert.deepEqual(saved.proposal?.preview?.entities.map(item => item.id), changedIds);
        assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), beforeHash);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('partial, duplicate and phase-only stages remain honest and noncanonical', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-native-partial-'));
    try {
        const store = new RoadmapStore();
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId: 'tower',
            projectRoot: root, revision: 1, phases: [], gates: [], corrections: [] });
        const owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'tower', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const basis = { version: 1, expectedRevision: 1, expectedSourceHash: null };
        await owner.stage(context, { ...basis, expectedStage: 1, actions: [
            { type: 'phase.create', id: 'new:p1', title: 'Lane', objective: 'Defend lane' }] });
        assert.equal(owner.get('chat')?.done, false);
        await assert.rejects(owner.stage(context, { ...basis, expectedStage: 1, actions: [
            { type: 'phase.create', id: 'new:p2', title: 'Wrong order', objective: 'Defend lane' }] }), /EXPECTED_2/);
        await assert.rejects(owner.stage(context, { ...basis, expectedStage: 2, actions: [
            { type: 'phase.create', id: 'new:p1', title: 'Duplicate', objective: 'Defend lane' }] }), /distinct new/);
        await assert.rejects(owner.stage(context, { ...basis, expectedStage: 2, actions: [
            { type: 'gate.create', id: 'new:g1', parentPhaseId: 'new:absent', designation: 'G1',
                title: 'Missing parent', purpose: 'Observe lane', criteria: [
                    { id: 'new:c1', title: 'Wave stops', expectedResult: 'Stopped' }] }] }), /unknown parentPhaseId/);
        await assert.rejects(owner.stage(context, { ...basis, expectedStage: 2, actions: [
            { type: 'gate.create', id: 'new:g1', parentPhaseId: 'new:p1', designation: 'G1',
                title: 'Task bullet', purpose: 'Unspecified', criteria: [
                    { id: 'new:c1', title: 'Build feature', expectedResult: '' }] }] }), /criteria\[0\]/);
        await assert.rejects(owner.stage(context, { ...basis, expectedStage: 2, done: true, actions: [
            { type: 'phase.create', id: 'new:p2', title: 'Other', objective: 'Defend lane' }] }), /FULL_MISSING_GATE/);
        assert.equal(owner.get('chat')?.done, false);
        const cancelled = await owner.cancel(context, { version: 1 }) as { cancelled: boolean };
        assert.equal(cancelled.cancelled, true);
        await owner.stage(context, { ...basis, expectedStage: 1, done: true, strategy: 'phase-only', actions: [
            { type: 'phase.create', id: 'new:p1', title: 'Lane', objective: 'Defend lane' }] });
        const { after } = await owner.complete(context);
        assert.equal(after.gates.length, 0);
    } finally { await rm(root, { recursive: true, force: true }); }
});
