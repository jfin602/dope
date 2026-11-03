import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapNativeStageOwner } from '../../packages/theia-extension/lib/node/roadmap-native-stage.js';

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
        const first = await owner.stage(context, { version: 1, expectedRevision: 1, expectedSourceHash: sourceHash,
            actions: [
                { type: 'phase.create', id: 'new:p1', title: 'First', objective: 'Ship first' },
                { type: 'phase.create', id: 'new:p2', title: 'Second', objective: 'Ship second' },
            ] }) as { acceptedOperationIds: string[]; createdEntityIds: Record<string, string> };
        assert.equal(first.acceptedOperationIds.length, 2);
        const second = await owner.stage(context, { version: 1, expectedRevision: 1, expectedSourceHash: sourceHash,
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
        const basis = { version: 1, expectedRevision: 1, expectedSourceHash: null };
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
