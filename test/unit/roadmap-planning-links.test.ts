import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapPlanningLinks } from '../../packages/theia-extension/lib/node/roadmap-planning-links.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { previewRebase } from '../../packages/visual-planning/lib/rebase.js';
import type { RebaseReality } from '../../packages/visual-planning/src/index.ts';
import type { VisualPlanningService } from '../../packages/visual-planning/lib/service.js';

const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
    physicalInputFingerprint: 'physical', physicalGeneration: 7 };

test('generation-only relink requires equivalent source, structure and live owner identity', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-equivalent-'));
    try {
        const maps = new PlanningStore();
        const old: RebaseReality = { basis, architecture: { schemaVersion: 1, systems: [{
            id: 'system', name: 'System', purpose: 'Purpose', subsystems: [{ id: 'processing', name: 'Processing',
                purpose: 'Purpose', roots: ['src'], components: [] }],
        }] }, physicalNodes: [
            { id: 'system', kind: 'system', name: 'System', evidenceIds: ['declaration'] },
            { id: 'processing', kind: 'subsystem', name: 'Processing', parentId: 'system', evidenceIds: ['declaration'] },
            { id: 'code:file:src%2FlogSummary.js', kind: 'code', name: 'logSummary.js', parentId: 'processing',
                path: 'src/logSummary.js', evidenceIds: ['syntax'] },
        ], relationships: [{ kind: 'owns', sourceId: 'processing', targetId: 'code:file:src%2FlogSummary.js', evidenceIds: ['syntax'] }],
            sourceHashes: { 'src/logSummary.js': 'a'.repeat(64) } };
        const collection = await maps.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Design', basis },
            undefined, async () => old);
        const map = collection.maps[0];
        const link = { owner: 'planning-map' as const, targetId: 'plan', ownerProjectId: collection.projectId,
            ownerRevision: map.revision, basis: map.basis };
        let current: RebaseReality = { ...old, basis: { ...basis, physicalGeneration: 8 } };
        let available = true;
        const planning = { attach: async () => ({ projectHandle: 'handle', snapshot: await maps.read(root) }),
            read: async () => maps.read(root), conflicts: async () => [],
            staleness: async () => ({ stale: false, conflicts: [] }),
            currentBasis: async () => current.basis,
            previewRebase: async (request: { expectedCurrentBasis: RebaseReality['basis'] }) => {
                if (!available) throw new Error('Software Map unavailable');
                assert.deepEqual(request.expectedCurrentBasis, current.basis);
                return previewRebase(map, current);
            },
        } as unknown as VisualPlanningService;
        const bridge = new RoadmapPlanningLinks(root, planning);
        assert.equal((await bridge.resolve(root, link))?.owner, 'planning-map');
        assert.equal(await bridge.resolve(root, { ...link, ownerProjectId: 'foreign' }), undefined);
        assert.equal(await bridge.resolve(root, { ...link, ownerRevision: map.revision + 1 }), undefined);
        current = { ...current, sourceHashes: { 'src/logSummary.js': 'b'.repeat(64) } };
        assert.equal(await bridge.resolve(root, link), undefined);
        current = { ...old, basis: { ...basis, physicalGeneration: 8 }, relationships: [] };
        assert.equal(await bridge.resolve(root, link), undefined);
        current = { ...old, basis: { ...basis, physicalGeneration: 8 }, sourceHashes: undefined };
        assert.equal(await bridge.resolve(root, link), undefined);
        current = { ...old, basis: { ...basis, physicalInputFingerprint: 'changed', physicalGeneration: 8 } };
        assert.equal(await bridge.resolve(root, link), undefined);
        current = { ...old, basis: { ...basis, physicalGeneration: 8 } };
        available = false;
        await assert.rejects(bridge.resolve(root, link), /Software Map unavailable/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
