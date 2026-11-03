import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapNativeStageOwner } from '../../packages/theia-extension/lib/node/roadmap-native-stage.js';
import { roadmapProposalPreview } from '../../packages/theia-extension/lib/node/roadmap-proposal-presentation.js';
import { parsePlanningActivity } from '../../packages/chat/lib/index.js';
import { gateFixture, sourceBytes } from './roadmap-gate-document-fixture.ts';

test('pending proposal fields revise under one generation and invalidate reviewed approval without canonical writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-revise-'));
    try {
        const store = new RoadmapStore(), owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'uninitialized', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const basis = { version: 1, expectedRevision: 0, expectedSourceHash: null };
        const phases = await owner.stage(context, { ...basis, expectedStage: 1, actions: [
            { type: 'phase.create', id: 'new:p1', title: 'First', objective: 'Build first' },
            { type: 'phase.create', id: 'new:p2', title: 'Second', objective: 'Build second' }] }) as
            { acceptedOperationIds: string[]; createdEntityIds: Record<string, string> };
        const gates = await owner.stage(context, { ...basis, expectedStage: 2, done: true, actions: [
            { type: 'gate.create', id: 'new:g1', parentPhaseId: 'new:p1', designation: 'G1',
                title: 'First gate', purpose: 'Check first', criteria: [
                    { id: 'new:c1', title: 'First criterion', expectedResult: 'First visible result' }] },
            { type: 'gate.create', id: 'new:g2', parentPhaseId: 'new:p2', designation: 'G2',
                title: 'Second gate', purpose: 'Check second', criteria: [
                    { id: 'new:c2', title: 'Second criterion', expectedResult: 'Second visible result' }] }] }) as
            { acceptedOperationIds: string[]; createdEntityIds: Record<string, string> };
        const stage = owner.get('chat')!, proposalId = stage.id;
        const update = (operationId: string, entityId: string,
            field: 'title' | 'objective' | 'purpose' | 'expectedResult', value: string) =>
            owner.revise(context, { proposalId, expectedGeneration: stage.generation,
                operationId, entityId, field, value });
        const oldReview = await owner.review(context,
            [phases.acceptedOperationIds[0], gates.acceptedOperationIds[0]], 'apply');
        const p1 = phases.createdEntityIds['new:p1'], p2 = phases.createdEntityIds['new:p2'];
        const g1 = gates.createdEntityIds['new:g1'], g2 = gates.createdEntityIds['new:g2'];
        const c1 = gates.createdEntityIds['new:c1'];
        await update(phases.acceptedOperationIds[0], p1, 'title', 'Revised first');
        await assert.rejects(owner.decide(context, oldReview.token,
            [phases.acceptedOperationIds[0], gates.acceptedOperationIds[0]], 'apply'), /ROADMAP_APPROVAL_UNAVAILABLE/);
        await update(phases.acceptedOperationIds[0], p1, 'objective', 'Revised first objective');
        await update(gates.acceptedOperationIds[0], g1, 'title', 'Revised first gate');
        await update(gates.acceptedOperationIds[0], g1, 'purpose', 'Revised first purpose');
        await update(gates.acceptedOperationIds[0], c1, 'title', 'Revised first criterion');
        const revised = await update(gates.acceptedOperationIds[0], c1, 'expectedResult', 'Revised observation');
        assert.equal(stage.generation, 6);
        assert.equal(revised.snapshot.proposalId, proposalId);
        assert.deepEqual(revised.snapshot.operationIds, [...phases.acceptedOperationIds, ...gates.acceptedOperationIds]);
        assert.equal(revised.snapshot.preview.entities.find(item => item.id === p1)?.after?.title, 'Revised first');
        assert.equal(revised.snapshot.preview.entities.find(item => item.id === g1)?.after?.detail, 'Revised first purpose');
        assert.equal(revised.snapshot.preview.entities.find(item => item.id === c1)?.after?.detail, 'Revised observation');
        assert.equal(revised.snapshot.preview.entities.find(item => item.id === p2)?.after?.title, 'Second');
        assert.equal(revised.snapshot.preview.entities.find(item => item.id === g2)?.after?.title, 'Second gate');
        const unchanged = JSON.stringify(revised.snapshot);
        await assert.rejects(owner.revise(context, { proposalId, expectedGeneration: 5,
            operationId: phases.acceptedOperationIds[0], entityId: p1, field: 'title', value: 'Stale' }),
        /GENERATION_CHANGED/);
        await assert.rejects(update(gates.acceptedOperationIds[0], c1, 'purpose', 'Wrong field'), /FIELD_NOT_OWNED/);
        await assert.rejects(update(gates.acceptedOperationIds[0], c1, 'title', '<script>unsafe</script>'), /invalid text/);
        await assert.rejects(owner.revise({ ...context, lease: 'wrong' }, { proposalId,
            expectedGeneration: 6, operationId: phases.acceptedOperationIds[0], entityId: p1,
            field: 'title', value: 'Wrong lease' }), /ROADMAP_STAGE_STALE/);
        await assert.rejects(owner.revise({ ...context, chatId: 'other' }, { proposalId,
            expectedGeneration: 6, operationId: phases.acceptedOperationIds[0], entityId: p1,
            field: 'title', value: 'Wrong Chat' }), /PROPOSAL_CHANGED/);
        assert.equal(JSON.stringify(await owner.snapshot(context)), unchanged);
        assert.equal(await store.gateIndexHash(root), null);
        assert.equal(existsSync(join(root, '.dope', 'roadmap-revisions')), false);
        const duplicate = { proposalId, expectedGeneration: 6, operationId: phases.acceptedOperationIds[1],
            entityId: p2, field: 'title' as const };
        const simultaneous = await Promise.allSettled([
            owner.revise(context, { ...duplicate, value: 'Second revision A' }),
            owner.revise(context, { ...duplicate, value: 'Second revision B' })]);
        assert.deepEqual(simultaneous.map(item => item.status).sort(), ['fulfilled', 'rejected']);
        assert.equal(stage.generation, 7);
        const review = await owner.review(context, [phases.acceptedOperationIds[0], gates.acceptedOperationIds[0]], 'apply');
        const applied = await owner.decide(context, review.token,
            [phases.acceptedOperationIds[0], gates.acceptedOperationIds[0]], 'apply');
        assert.equal(applied.revision, 1);
        const canonical = await store.read(root);
        assert.equal(canonical.phases.find(item => item.id === p1)?.title, 'Revised first');
        assert.equal(canonical.gates.find(item => item.id === g1)?.criteria[0].expectedResult, 'Revised observation');
        await assert.rejects(update(phases.acceptedOperationIds[0], p1, 'title', 'After apply'), /NOT_PENDING/);
        await owner.cancel(context, { version: 1 });
        await assert.rejects(update(phases.acceptedOperationIds[1], p2, 'title', 'After cancel'),
            /PROPOSAL_CHANGED|OWNER_CHANGED/);
        assert.equal((await store.read(root)).revision, 1);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('pending edit refuses changed linked source, project, turn and expired stage', async () => {
    await gateFixture(async (root, file, store) => {
        const owner = new RoadmapNativeStageOwner(store), index = await store.read(root);
        const context = { root, projectId: index.projectId, chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const staged = await owner.stage(context, { version: 1, expectedRevision: index.revision,
            expectedSourceHash: index.linkedDocument!.sourceHash, expectedStage: 1, done: true,
            actions: [{ type: 'gate.edit', id: index.gates[0].id, title: 'Proposed Gate',
                purpose: 'Proposed purpose' }] }) as { acceptedOperationIds: string[] };
        const request = { proposalId: owner.get('chat')!.id, expectedGeneration: 0,
            operationId: staged.acceptedOperationIds[0], entityId: index.gates[0].id,
            field: 'title' as const, value: 'Revised proposed Gate' };
        const bytes = await sourceBytes(file), hash = await store.gateIndexHash(root);
        await assert.rejects(owner.revise({ ...context, projectId: 'foreign' }, request), /OWNER_CHANGED/);
        await assert.rejects(owner.revise({ ...context, turnId: 'foreign' }, request), /STAGE_STALE/);
        const revised = await owner.revise(context, request);
        assert.equal(revised.snapshot.preview.entities.find(item => item.id === index.gates[0].id)?.after?.title,
            'Revised proposed Gate');
        assert.deepEqual(await sourceBytes(file), bytes);
        assert.equal(await store.gateIndexHash(root), hash);
        request.expectedGeneration = 1;
        await writeFile(file, '# changed outside Dope\n');
        await assert.rejects(owner.revise(context, request), /SOURCE_CHANGED/);
        await writeFile(file, bytes);
        owner.get('chat')!.expires = Date.now() - 1;
        await assert.rejects(owner.revise(context, request), /STAGE_STALE/);
        assert.equal(owner.get('chat')!.generation, 1);
        assert.equal(await store.gateIndexHash(root), hash);
        assert.deepEqual(await sourceBytes(file), bytes);
        owner.get('chat')!.expires = Date.now() + 60_000;
        await store.mutateGateIndex(root, index.revision, index.projectId,
            { type: 'phase.edit', id: index.phases[0].id, title: 'Independent Phase',
                objective: index.phases[0].objective });
        await assert.rejects(owner.revise(context, request), /ROADMAP_SOURCE_NOT_SYNCED|ROADMAP_STAGE_STALE/);
    });
});

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
        const read = await owner.read(context, { version: 1, limit: 2 }) as { revision: number; entries: unknown[];
            stageBasis: { expectedRevision: number; expectedSourceHash: string | null } };
        assert.equal(read.revision, 1);
        assert.deepEqual(read.stageBasis, { expectedRevision: 1, expectedSourceHash: sourceHash });
        assert.deepEqual(read.entries, []);
        const first = await owner.stage(context, { version: 1, expectedRevision: 1, expectedSourceHash: sourceHash, expectedStage: 1,
            actions: [
                { type: 'phase.create', id: 'new:p1', title: 'First', objective: 'Ship first' },
                { type: 'phase.create', id: 'new:p2', title: 'Second', objective: 'Ship second' },
            ] }) as { acceptedOperationIds: string[]; createdEntityIds: Record<string, string> };
        assert.equal(first.acceptedOperationIds.length, 2);
        const firstSnapshot = await owner.snapshot(context);
        assert.equal(firstSnapshot?.sequence, 1);
        assert.deepEqual(firstSnapshot?.counts, { phases: 2, gates: 0, criteria: 0 });
        assert.equal(firstSnapshot?.incompletePhaseIds.length, 2);
        assert.equal(firstSnapshot?.complete, false);
        owner.get('chat')!.expires = Date.now() + 1000;
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
        const secondSnapshot = await owner.snapshot(context);
        assert.equal(secondSnapshot?.sequence, 2);
        assert.ok(secondSnapshot!.expiresAt > Date.now() + 9 * 60_000);
        assert.ok(secondSnapshot!.expiresAt <= owner.get('chat')!.createdAt + 30 * 60_000);
        assert.deepEqual(secondSnapshot?.counts, { phases: 2, gates: 2, criteria: 2 });
        assert.equal(secondSnapshot?.proposalId, firstSnapshot?.proposalId);
        assert.equal(secondSnapshot?.operationIds[0], firstSnapshot?.operationIds[0]);
        assert.equal(secondSnapshot?.preview.entities.filter(item => item.after?.kind === 'gate').length, 2);
        assert.equal(owner.get('chat')?.operations[2].action.type, 'gate.create');
        assert.equal((owner.get('chat')?.operations[2].action as { parentPhaseId: string }).parentPhaseId,
            first.createdEntityIds['new:p1']);
        assert.equal(owner.get('chat')?.operations[0].batch, 1);
        assert.equal(owner.get('chat')?.operations[2].batch, 2);
        await writeFile(join(root, 'ROADMAP.md'), '# Externally changed Roadmap\n');
        await assert.rejects(owner.snapshot(context), /ROADMAP_SOURCE_CHANGED/);
        await writeFile(join(root, 'ROADMAP.md'), markdown);
        assert.equal((await owner.snapshot(context))?.sequence, 2);
        const cancelled = await owner.cancel(context, { version: 1 }) as { cancelled: boolean; cancelledOperationIds: string[] };
        assert.equal(cancelled.cancelled, true);
        assert.equal(cancelled.cancelledOperationIds.length, 4);
        assert.equal(owner.get('chat'), undefined);
        assert.equal(await owner.snapshot(context), undefined);
        assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), before);
        assert.equal(createHash('sha256').update(await readFile(join(root, 'ROADMAP.md'))).digest('hex'), sourceHash);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('revision-zero native staging stays provisional and selected approval creates one owned revision', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-native-zero-'));
    try {
        const store = new RoadmapStore();
        const owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'uninitialized', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const basis = { version: 1, expectedRevision: 0, expectedSourceHash: null };
        const initial = await owner.read(context, { version: 1 }) as { revision: number; projectId: string;
            stageBasis: { expectedRevision: number; expectedSourceHash: string | null } };
        assert.equal(initial.revision, 0);
        assert.equal(initial.projectId, 'uninitialized');
        assert.deepEqual(initial.stageBasis, { expectedRevision: 0, expectedSourceHash: null });
        const first = await owner.stage(context, { ...basis, expectedStage: 1, actions: [
            { type: 'phase.create', id: 'new:phase', title: 'Playable loop', objective: 'Deliver one playable wave' }
        ] }) as { acceptedOperationIds: string[]; createdEntityIds: Record<string, string> };
        await assert.rejects(owner.stage(context, { ...basis, expectedSourceHash: 'null', expectedStage: 2,
            actions: [{ type: 'phase.create', id: 'new:wrong', title: 'Wrong', objective: 'Must not stage' }] }),
        /expectedSourceHash was a non-hash string.*literal JSON null.*same expectedStage/);
        assert.equal((await owner.snapshot(context))?.sequence, 1);
        assert.equal(await store.gateIndexHash(root), null);
        const second = await owner.stage(context, { ...basis, expectedStage: 2, done: true, actions: [
            { type: 'gate.create', id: 'new:gate-a', parentPhaseId: 'new:phase', designation: 'G1',
                title: 'Enemies follow the path', purpose: 'Verify fixed waypoint movement', criteria: [
                    { id: 'new:criterion-a', title: 'Waypoint traversal',
                        expectedResult: 'An enemy reaches each waypoint in sequence' }] },
            { type: 'gate.create', id: 'new:gate-b', parentPhaseId: 'new:phase', designation: 'G2',
                title: 'Towers attack enemies', purpose: 'Verify combat', criteria: [
                    { id: 'new:criterion-b', title: 'Damage is applied',
                        expectedResult: 'A tower hit reduces enemy health' }] }
        ] }) as { acceptedOperationIds: string[] };
        assert.equal(await store.gateIndexHash(root), null);
        assert.equal((await store.read(root)).revision, 0);
        const [phase] = first.acceptedOperationIds;
        const [gateA, gateB] = second.acceptedOperationIds;
        await assert.rejects(owner.review(context, [gateA], 'apply'), /Missing Roadmap Phase/);
        const review = await owner.review(context, [phase, gateA], 'apply');
        assert.equal(review.indexHash, null);
        assert.equal(review.after?.projectId, owner.get('chat')?.ownerId);
        assert.equal(await store.gateIndexHash(root), null);
        const applied = await owner.decide(context, review.token, [phase, gateA], 'apply');
        assert.equal(applied.revision, 1);
        const saved = await store.read(root);
        assert.equal(saved.revision, 1);
        assert.equal(saved.projectId, owner.get('chat')?.ownerId);
        assert.equal((saved as { gates: unknown[] }).gates.length, 1);
        assert.equal((saved as { phases: { id: string }[] }).phases[0].id, first.createdEntityIds['new:phase']);
        const archived = await store.listRevisions(root, saved.projectId);
        assert.deepEqual(archived.revisions.map(item => item.revision), [1]);
        await assert.rejects(owner.decide(context, review.token, [phase, gateA], 'apply'), /APPROVAL_UNAVAILABLE/);
        const rest = await owner.review(context, [gateB], 'apply');
        const final = await owner.decide(context, rest.token, [gateB], 'apply');
        assert.equal(final.revision, 2);
        assert.equal((await store.read(root) as { gates: unknown[] }).gates.length, 2);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('revision-zero rejection and competing initialization never apply a staged proposal', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-native-zero-stale-'));
    try {
        const store = new RoadmapStore();
        const owner = new RoadmapNativeStageOwner(store);
        const context = { root, projectId: 'uninitialized', chatId: 'chat', turnId: 'turn', lease: 'lease' };
        const actions = [{ type: 'phase.create', id: 'new:p', title: 'Phase', objective: 'Objective' },
            { type: 'gate.create', id: 'new:g', parentPhaseId: 'new:p', designation: 'G1',
                title: 'Gate', purpose: 'Purpose', criteria: [{ id: 'new:c', title: 'Check',
                    expectedResult: 'Observable result' }] }];
        const stage = await owner.stage(context, { version: 1, expectedRevision: 0,
            expectedSourceHash: null, expectedStage: 1, done: true, actions }) as { acceptedOperationIds: string[] };
        const rejected = await owner.review(context, stage.acceptedOperationIds, 'reject');
        await owner.decide(context, rejected.token, stage.acceptedOperationIds, 'reject');
        assert.equal(await store.gateIndexHash(root), null);
        owner.forget('chat');
        const pending = await owner.stage(context, { version: 1, expectedRevision: 0,
            expectedSourceHash: null, expectedStage: 1, done: true, actions }) as { acceptedOperationIds: string[] };
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId: 'other',
            projectRoot: root, revision: 1, phases: [], gates: [], corrections: [] });
        await assert.rejects(owner.review(context, pending.acceptedOperationIds, 'apply'), /OWNER_CHANGED|STAGE_STALE/);
        assert.equal((await store.read(root)).projectId, 'other');
        assert.equal((await store.read(root)).revision, 1);
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
            actions: [{ type: 'phase.create', id: 'new:p', title: 'Title', objective: 'Objective' }] }),
        /STALE_SOURCE: read current Roadmap once/);
        await assert.rejects(owner.stage(context, { ...basis, expectedRevision: 0,
            actions: [{ type: 'phase.create', id: 'new:p', title: 'Title', objective: 'Objective' }] }),
        /STALE_SOURCE: stop/);
        await assert.rejects(owner.stage(context, { ...basis, expectedSourceHash: undefined,
            actions: [{ type: 'phase.create', id: 'new:p', title: 'Title', objective: 'Objective' }] }),
        /expectedSourceHash/);
        await assert.rejects(owner.stage(context, { ...basis, expectedSourceHash: 'changed',
            actions: [{ type: 'phase.create', id: 'new:p', title: 'Title', objective: 'Objective' }] }),
        /expectedSourceHash/);
        await assert.rejects(owner.stage(context, { ...basis,
            actions: [{ type: 'phase.create', id: 'new:p', title: 'Title' }] }), /missing objective/);
        await assert.rejects(owner.stage(context, { ...basis,
            actions: [{ type: 'phase.source', id: 'new:p', source: {} }] }), /unsupported type/);
        await assert.rejects(owner.stage(context, { ...basis,
            actions: [{ type: 'phase.create', id: 'new:p', title: '<script>alert(1)</script>', objective: 'Objective' }] }), /invalid title/);
        await assert.rejects(owner.stage(context, { ...basis,
            actions: Array.from({ length: 9 }, (_, at) => ({ type: 'phase.create', id: `new:p${at}`,
                title: 'Title', objective: 'Objective' })) }), /ARGUMENTS/);
        assert.equal(owner.get('chat'), undefined);
        await owner.stage(context, { ...basis,
            actions: [{ type: 'phase.create', id: 'new:p', title: 'Title', objective: 'Objective' }] });
        assert.equal((await owner.snapshot(context))?.sequence, 1);
        await assert.rejects(owner.snapshot({ ...context, projectId: 'forged' }), /OWNER_CHANGED|STAGE_STALE/);
        await assert.rejects(owner.snapshot({ ...context, lease: 'forged' }), /STAGE_STALE/);
        await assert.rejects(owner.stage({ ...context, lease: 'forged' }, { ...basis,
            actions: [{ type: 'phase.create', id: 'new:q', title: 'Title', objective: 'Objective' }] }), /STAGE_STALE/);
        await assert.rejects(owner.cancel({ ...context, turnId: 'other' }, { version: 1 }), /STAGE_STALE/);
        owner.get('chat')!.expires = Date.now() - 1;
        await assert.rejects(owner.snapshot(context), /STAGE_STALE/);
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

test('tower-defense stage, selected Apply, first link and automatic sync preserve exact counts', async () => {
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
        const gates = [1, 2, 3, 4, 5, 1].map((phase, at) => ({ type: 'gate.create', id: `new:g${at + 1}`,
            parentPhaseId: `new:p${phase}`, designation: `G${at + 1}`, title: `Gate ${at + 1}`,
            purpose: `Verify lane ${phase}`, criteria: [{ id: `new:c${at + 1}`,
                title: `Observe wave ${at + 1}`, expectedResult: `Wave ${at + 1} stops` }] }));
        const final = await owner.stage(context, { ...basis, expectedStage: 2, done: true,
            actions: gates }) as { complete: boolean; proposalId: string; totalOperations: number };
        assert.equal(final.complete, true);
        assert.equal(final.proposalId, first.proposalId);
        assert.equal(final.totalOperations, 11);
        const readback = await owner.read(context, { version: 1, limit: 1, stageOffset: 10 }) as {
            stage: { proposalId: string; operations: { id: string }[]; nextOperationOffset: number | null } };
        assert.equal(readback.stage.proposalId, final.proposalId);
        assert.equal(readback.stage.operations[0].id, owner.get('chat')!.operations[10].id);
        assert.equal(readback.stage.nextOperationOffset, null);
        const { before, after, stage } = await owner.complete(context);
        assert.equal(after.phases.length, 5);
        assert.equal(after.gates.length, 6);
        assert.equal(after.gates.filter(gate => gate.criteria.length).length, 6);
        assert.equal(after.gates[0].parentPhaseId, first.createdEntityIds['new:p1']);
        assert.equal(after.gates[1].parentPhaseId, first.createdEntityIds['new:p2']);
        assert.equal(after.gates[2].parentPhaseId, first.createdEntityIds['new:p3']);
        const changedIds = [...after.phases, ...after.gates, ...after.gates.flatMap(gate => gate.criteria)]
            .map(item => item.id);
        const preview = roadmapProposalPreview(before, after, stage.operations.map(item => item.action), changedIds);
        const saved = parsePlanningActivity({ schemaVersion: 1, kind: 'roadmap-gate-proposal', status: 'pending',
            refs: [], proposalId: stage.id, proposal: { id: stage.id, chatId: randomUUID(), messageId: randomUUID(),
                ownerId: 'tower', revision: 1, changedIds, action: { type: 'native-stage-preview', id: 'tower' },
                summary: JSON.stringify(preview), preview, previewOnly: true } });
        assert.equal(saved.proposal?.preview?.totalChanged, 17);
        assert.equal(saved.proposal?.preview?.additionalChanges, 0);
        assert.equal(saved.proposal?.preview?.steps.length, 11);
        assert.deepEqual(saved.proposal?.preview?.entities.map(item => item.id), changedIds);
        assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'), beforeHash);
        const accepted = stage.operations.slice(0, 10).map(item => item.id);
        const review = await owner.review(context, accepted, 'apply');
        assert.equal(review.after?.phases.length, 5);
        assert.equal(review.after?.gates.length, 5);
        assert.equal(review.after?.gates.reduce((count, gate) => count + gate.criteria.length, 0), 5);
        const applied = await owner.decide(context, review.token, accepted, 'apply');
        assert.equal(applied.revision, 2);
        assert.deepEqual(applied.statuses.map(item => item.status),
            [...Array(10).fill('Applied'), 'Pending']);
        const reopened = new RoadmapStore();
        const current = await reopened.read(root);
        assert.equal(current.revision, 2);
        assert.equal(current.phases.length, 5);
        assert.equal(current.gates.length, 5);
        assert.equal(current.gates.reduce((count, gate) => count + gate.criteria.length, 0), 5);
        assert.ok(current.gates.every(gate => gate.qualificationStatus !== 'green'));
        const archive = await reopened.listRevisions(root, 'tower');
        assert.deepEqual(archive.revisions.map(item => item.revision), [2, 1]);
        assert.deepEqual(archive.revisions[0].receipt.operationIds, accepted);
        assert.equal((await reopened.fetchRevision(root, 'tower', 2)).snapshot,
            await readFile(file, 'utf8'));
        const remaining = stage.operations.filter(item => item.status === 'Pending');
        const projected = await reopened.mutateGateIndex(root, current.revision, current.projectId,
            remaining.map(item => item.action), true);
        const ghostIds = projected.gates.filter(gate => !current.gates.some(acceptedGate => acceptedGate.id === gate.id));
        assert.equal(ghostIds.length, 1);
        assert.equal(ghostIds[0].criteria.length, 1);
        assert.equal((await reopened.read(root)).gates.length, 5);
        const publication = await reopened.previewRoadmapPublication(root, 'ROADMAP.md');
        assert.deepEqual([publication.phaseCount, publication.gateCount, publication.criterionCount], [5, 5, 5]);
        const linked = await reopened.applyRoadmapPublication(root, publication, true);
        assert.equal(linked.linkedDocument?.syncState, 'synced');
        assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), publication.content);
        assert.equal(createHash('sha256').update(publication.content).digest('hex'),
            linked.linkedDocument?.sourceHash);
        assert.equal((await new RoadmapStore().read(root)).gates.length, 5);
        const edited = await reopened.mutateGateIndex(root, linked.revision, 'tower', {
            type: 'phase.edit', id: current.phases[0].id, title: 'Fortified Lane 1',
            objective: current.phases[0].objective });
        assert.equal(edited.linkedDocument?.syncState, 'pending-sync');
        const synchronized = await new RoadmapStore().recoverAutoSync(root);
        const source = await readFile(join(root, 'ROADMAP.md'), 'utf8');
        assert.match(source, /Fortified Lane 1/);
        assert.equal(synchronized.linkedDocument?.syncState, 'synced');
        assert.equal(createHash('sha256').update(source).digest('hex'), synchronized.linkedDocument?.sourceHash);
        assert.deepEqual((await reopened.listRevisions(root, 'tower')).revisions.map(item => item.revision),
            [5, 4, 3, 2, 1]);
        const comparison = await reopened.previewRestore(root, 'tower', linked.revision);
        assert.match(comparison.linkedDiff!.before, /Fortified Lane 1/);
        assert.match(comparison.linkedDiff!.after, /Phase 1/);
        const restored = await reopened.applyRestore(root, comparison, true);
        assert.equal(restored.revision, 6);
        assert.equal(restored.linkedDocument?.syncState, 'synced');
        const reopenedRestore = await new RoadmapStore().read(root);
        const restoredSource = await readFile(join(root, 'ROADMAP.md'), 'utf8');
        assert.equal(reopenedRestore.phases.length, 5);
        assert.equal(reopenedRestore.gates.length, 5);
        assert.equal(reopenedRestore.gates.reduce((count, gate) => count + gate.criteria.length, 0), 5);
        assert.equal(reopenedRestore.phases[0].title, linked.phases[0].title);
        assert.equal(createHash('sha256').update(restoredSource).digest('hex'),
            reopenedRestore.linkedDocument?.sourceHash);
        assert.deepEqual((await reopened.listRevisions(root, 'tower')).revisions.map(item => item.revision),
            [6, 5, 4, 3, 2, 1]);
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
        assert.equal((await owner.snapshot(context))?.sequence, 1);
        await assert.rejects(owner.stage(context, { ...basis, expectedStage: 2, actions: [
            { type: 'gate.create', id: 'new:g1', parentPhaseId: 'new:p1', designation: 'G1',
                title: 'Task bullet', purpose: 'Unspecified', criteria: [
                    { id: 'new:c1', title: 'Build feature', expectedResult: '' }] }] }), /criteria\[0\]/);
        await assert.rejects(owner.stage(context, { ...basis, expectedStage: 2, done: true, actions: [
            { type: 'phase.create', id: 'new:p2', title: 'Other', objective: 'Defend lane' }] }), /FULL_MISSING_GATE/);
        assert.equal(owner.get('chat')?.done, false);
        assert.equal((await owner.snapshot(context))?.sequence, 1);
        const cancelled = await owner.cancel(context, { version: 1 }) as { cancelled: boolean };
        assert.equal(cancelled.cancelled, true);
        await owner.stage(context, { ...basis, expectedStage: 1, done: true, strategy: 'phase-only', actions: [
            { type: 'phase.create', id: 'new:p1', title: 'Lane', objective: 'Defend lane' }] });
        const { after } = await owner.complete(context);
        assert.equal(after.gates.length, 0);
    } finally { await rm(root, { recursive: true, force: true }); }
});
