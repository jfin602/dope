import assert from 'node:assert/strict';
import { lstat, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapPlanningLinks } from '../../packages/theia-extension/lib/node/roadmap-planning-links.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import type { VisualPlanningService } from '../../packages/visual-planning/lib/service.js';

const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
    physicalInputFingerprint: 'physical', physicalGeneration: 7 };

test('Planning Map, transformation and WorkItem links use exact owner revision and current basis without owner writes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-planning-'));
    try {
        const maps = new PlanningStore();
        let collection = await maps.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Design', basis });
        collection = await maps.mutate(root, 1, { type: 'put-transformation', mapId: 'plan', transformation: {
            id: 'add-core', kind: 'add', currentIds: [], futureNodes: [{ id: 'core', kind: 'system',
                name: 'Core', purpose: 'Domain', roots: [] }], dependsOn: [] } });
        collection = await maps.mutate(root, 2, { type: 'put-work-item', mapId: 'plan', workItem: {
            id: 'build-core', title: 'Build core', objective: 'Implement', transformationIds: ['add-core'],
            dependsOn: [], requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [],
            workingSet: [], status: 'proposed' } });
        let physicalCurrent = true;
        let conflicting = false;
        let adopted = 0;
        let previewed = 0;
        const planning = {
            attach: async () => ({ projectHandle: 'planning-handle', snapshot: await maps.read(root) }),
            read: async (handle: string) => { assert.equal(handle, 'planning-handle'); return maps.read(root); },
            conflicts: async () => conflicting ? [{ mapIds: ['plan', 'other'] }] : [],
            staleness: async () => ({ stale: !physicalCurrent, conflicts: [] }),
            currentBasis: async () => physicalCurrent ? basis : { ...basis, physicalGeneration: basis.physicalGeneration + 1 },
            preview: async () => { previewed++; physicalCurrent = false; return collection.maps[0].transformations[0]; },
            adoptTarget: async () => { adopted++; throw new Error('Direct adoption forbidden'); },
        } as unknown as VisualPlanningService;
        const bridge = new RoadmapPlanningLinks(root, planning);
        const store = new RoadmapStore();
        await store.mutate(root, 0, { type: 'create', id: 'phase', kind: 'phase', title: 'Phase', objective: '', order: 0 });
        const actions = new ProjectPlanningActions(store, undefined, bridge);
        const { projectHandle, snapshot } = await actions.attach(root);
        const map = collection.maps[0];
        const base = { ownerProjectId: collection.projectId, ownerRevision: map.revision, basis: map.basis };
        const links = [
            { owner: 'planning-map' as const, targetId: 'plan', ...base },
            { owner: 'transformation' as const, targetId: 'plan/add-core', ...base },
            { owner: 'work-item' as const, targetId: 'plan/build-core', ...base },
        ];
        const ownerBytes = await readFile(join(root, '.dope/planning-maps.json'));
        const request = { projectHandle, ownerId: snapshot.projectId, expectedRevision: snapshot.revision,
            actions: links.map(link => ({ type: 'link' as const, id: 'phase', link })) };
        const proposal = await actions.preview(request);
        assert.equal((await actions.readOwner(projectHandle, snapshot.projectId, links[1]))?.owner, 'transformation');
        await actions.apply(request, proposal.token);
        assert.deepEqual(await readFile(join(root, '.dope/planning-maps.json')), ownerBytes);
        assert.equal(adopted, 0);
        assert.equal((await bridge.resolve(root, links[2]))?.owner, 'work-item');
        assert.equal(await bridge.resolve(root, { ...links[0], targetId: 'missing' }), undefined);
        assert.equal(await bridge.resolve(root, { ...links[0], ownerProjectId: 'foreign' }), undefined);
        assert.equal(await bridge.resolve(root, { ...links[0], ownerRevision: map.revision + 1 }), undefined);
        conflicting = true;
        assert.equal(await bridge.resolve(root, links[0]), undefined);
        conflicting = false;
        await assert.rejects(bridge.previewTransformation(root, links[0], { kind: 'remove', id: 'core' }, 'remove-core'),
            /basis changed after preview/);
        assert.equal(previewed, 1);
        assert.equal(await bridge.resolve(root, links[0]), undefined);
        await assert.rejects(actions.preview({ projectHandle, ownerId: snapshot.projectId, expectedRevision: 2,
            actions: [{ type: 'link', id: 'phase', link: { ...links[0], targetId: 'other' } }] }), /Foreign or unresolved/);
        await assert.rejects(actions.preview({ projectHandle, ownerId: snapshot.projectId, expectedRevision: 2,
            actions: [{ type: 'adopt-target', id: 'phase', link: links[0] } as never] }), /Unknown planning action/);
        assert.equal(adopted, 0);
        assert.deepEqual(await readFile(join(root, '.dope/planning-maps.json')), ownerBytes);
        await assert.rejects(lstat(join(root, '.dope/agent')), /ENOENT/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('basis changes after Roadmap preview reject apply without Roadmap or Planning Map mutation', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-basis-'));
    try {
        const maps = new PlanningStore();
        const collection = await maps.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Design', basis });
        const map = collection.maps[0];
        let stale = false;
        const planning = { attach: async () => ({ projectHandle: 'handle', snapshot: await maps.read(root) }),
            read: async () => maps.read(root), conflicts: async () => [],
            staleness: async () => ({ stale: false, conflicts: [] }),
            currentBasis: async () => stale ? { ...basis, physicalGeneration: basis.physicalGeneration + 1 } : basis,
        } as unknown as VisualPlanningService;
        const store = new RoadmapStore();
        await store.mutate(root, 0, { type: 'create', id: 'phase', kind: 'phase', title: 'Phase', objective: '', order: 0 });
        const actions = new ProjectPlanningActions(store, undefined, new RoadmapPlanningLinks(root, planning));
        const { projectHandle, snapshot } = await actions.attach(root);
        const request = { projectHandle, ownerId: snapshot.projectId, expectedRevision: snapshot.revision, actions: [{
            type: 'link' as const, id: 'phase', link: { owner: 'planning-map' as const, targetId: 'plan',
                ownerProjectId: collection.projectId, ownerRevision: map.revision, basis: map.basis } }] };
        const preview = await actions.preview(request);
        stale = true;
        await assert.rejects(actions.apply(request, preview.token), /Foreign or unresolved/);
        assert.equal((await store.read(root)).revision, 1);
        assert.equal((await maps.read(root)).revision, 1);
    } finally { await rm(root, { recursive: true, force: true }); }
});
