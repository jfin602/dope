import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { PlanningTargetReview } from '../../packages/theia-extension/lib/node/planning-target-review.js';
import { VisualPlanningBackend } from '../../packages/theia-extension/lib/node/visual-planning-backend.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import type { RoadmapStore } from '../../packages/project-intelligence/src/node/roadmap-store.ts';
import type { VisualPlanningService } from '../../packages/visual-planning/src/service.ts';

const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
    physicalInputFingerprint: 'physical', physicalGeneration: 1 };
const transformation = { id: 'add-core', kind: 'add' as const, currentIds: [],
    futureNodes: [{ id: 'core', kind: 'system' as const, name: 'Core', purpose: 'Target', roots: [] }], dependsOn: [] };
async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'dope-target-review-'));
    const markdown = '# Roadmap\n\n## Checkpoint\nDesign core\n';
    await writeFile(join(root, 'ROADMAP.md'), markdown);
    const sourceHash = createHash('sha256').update(markdown).digest('hex');
    const map = { schemaVersion: 1 as const, id: 'map', projectId: 'planning', title: 'Target',
        objective: 'Design core', status: 'draft' as const, revision: 1, history: [], basis,
        transformations: [transformation], workItems: [] };
    const collection = { schemaVersion: 1 as const, projectId: 'planning', revision: 1, maps: [map] };
    const checkpoint = { id: 'checkpoint', kind: 'milestone' as const, title: 'Checkpoint', objective: 'Design core',
        order: 1, dependencies: [], status: 'not-implemented' as const, readOnly: false, evidence: [],
        source: { path: 'ROADMAP.md', sha256: sourceHash, line: 3, text: '## Checkpoint' },
        links: [{ owner: 'planning-map' as const, targetId: 'map', ownerProjectId: 'planning',
            ownerRevision: 1, basis }] };
    const roadmap = { schemaVersion: 1 as const, projectId: 'roadmap', projectRoot: root, revision: 1,
        checkpoints: [checkpoint], linkedDocument: { projectRoot: root, projectId: 'roadmap', path: 'ROADMAP.md',
            sourceHash, sections: [{ sectionKey: 'checkpoint', checkpointId: 'checkpoint' }],
            lastSynced: { sourceHash, roadmapRevision: 1 }, syncState: 'synced' as const } };
    let stale = false, overlap = false, adopted = 0, mutations = 0;
    let observedBasis = basis;
    const planning = { attach: async () => ({ projectHandle: 'handle', snapshot: collection }),
        read: async () => collection,
        currentSoftwareImpact: async () => stale ? { status: 'stale', reason: 'Affected branch changed' } :
            { status: 'ready', checkpoint: { id: 'checkpoint' }, planningMap: { id: 'map', revision: map.revision }, basis: observedBasis },
        targetDesign: async () => { if (overlap) throw new Error('Overlapping Planning Map target');
            return { mapId: 'map', mapRevision: map.revision, collectionRevision: collection.revision, basis: map.basis,
                current: { nodes: [], relationships: [] }, target: { nodes: transformation.futureNodes, relationships: [] },
                diff: { nodes: ['core'], relationships: [] } }; },
        preview: async () => transformation,
        mutate: async () => { mutations++; map.revision++; collection.revision++; return collection; },
        currentBasis: async () => observedBasis,
        previewRebase: async () => ({ schemaVersion: 1, oldBasis: map.basis, currentBasis: observedBasis,
            conflicts: [], unaffectedTransformationIds: ['add-core'], currentReality: {
                basis: observedBasis, architecture: { schemaVersion: 1, systems: [] }, physicalNodes: [], relationships: [] } }),
        acceptRebase: async () => { map.basis = observedBasis; map.revision++; collection.revision++; stale = false; return collection; },
        adoptTarget: async () => { adopted++; throw new Error('Canonical adoption forbidden'); }
    } as unknown as VisualPlanningService;
    const owner = { read: async () => roadmap } as unknown as RoadmapStore;
    const review = new PlanningTargetReview(root, 'checkpoint', ['core'], owner, planning);
    return { root, map, collection, checkpoint, roadmap, review, owner, planning,
        setStale: (value: boolean) => { stale = value; }, setOverlap: (value: boolean) => { overlap = value; },
        setObservedBasis: (value: typeof basis) => { observedBasis = value; },
        get adopted() { return adopted; }, get mutations() { return mutations; },
        dispose: () => rm(root, { recursive: true, force: true }) };
}

test('target approval requires a fresh preview; reject and concurrent manual map edits preserve canonical source', async () => {
    const f = await fixture();
    try {
        const preview = await f.review.preview();
        assert.deepEqual(preview.design.diff.nodes, ['core']);
        await assert.rejects(f.review.approve(preview.token, false), /Explicit developer/);
        f.review.reject(preview.token);
        await assert.rejects(f.review.approve(preview.token, true), /preview approval/);
        const stale = await f.review.preview();
        f.map.objective = 'Manual concurrent edit'; f.map.revision++; f.collection.revision++;
        f.checkpoint.links[0].ownerRevision = f.map.revision;
        await assert.rejects(f.review.approve(stale.token, true), /changed/);
        assert.equal(await f.review.approved(), false);
        assert.equal(f.adopted, 0);
        assert.equal(await readFile(join(f.root, 'ROADMAP.md'), 'utf8'), '# Roadmap\n\n## Checkpoint\nDesign core\n');
    } finally { await f.dispose(); }
});

test('typed transformation update requires explicit Roadmap relink and re-reviewed target basis', async () => {
    const f = await fixture();
    try {
        const typed = await f.review.previewTransformation({ kind: 'add', node: transformation.futureNodes[0] }, 'add-core');
        assert.equal(typed.kind, 'add');
        const updated = await f.review.putTransformation({ kind: 'add', node: transformation.futureNodes[0] },
            'add-core', f.collection.revision, f.map.revision);
        assert.equal(updated.relinkRequired, true);
        assert.equal(f.mutations, 1);
        await assert.rejects(f.review.preview(), /re-review/);
        f.checkpoint.links[0].ownerRevision = f.map.revision;
        f.roadmap.revision++;
        const review = await f.review.preview();
        await f.review.approve(review.token, true);
        assert.equal(await f.review.approved(), true);
        f.setStale(true);
        assert.equal(await f.review.approved(), false);
        f.setObservedBasis({ ...basis, physicalInputFingerprint: 'repaired' });
        const rebase = await f.review.previewRebase('map');
        const rebased = await f.review.acceptRebase('map', rebase, f.collection.revision, f.map.revision, []);
        assert.equal(rebased.relinkRequired, true);
        await assert.rejects(f.review.preview(), /re-review/);
        f.checkpoint.links[0].ownerRevision = f.map.revision;
        f.checkpoint.links[0].basis = f.map.basis;
        f.roadmap.revision++;
        const repaired = await f.review.preview();
        await f.review.approve(repaired.token, true);
        assert.equal(await f.review.approved(), true);
        assert.equal(await new PlanningTargetReview(f.root, 'checkpoint', ['other'], f.owner, f.planning).approved(), false);
        f.setOverlap(true);
        await assert.rejects(f.review.preview(), /Overlapping/);
        assert.equal(f.adopted, 0);
    } finally { await f.dispose(); }
});

test('real target projection shows current, target and diff without canonical write; overlapping maps block review', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-target-projection-'));
    try {
        const store = new PlanningStore();
        let collection = await store.mutate(root, 0, { type: 'create', id: 'map', title: 'Target', objective: 'Core', basis });
        collection = await store.mutate(root, collection.revision,
            { type: 'put-transformation', mapId: 'map', transformation });
        const backend = new VisualPlanningBackend(store);
        const currentBasis = { ...basis, physicalGeneration: 2 }; // unrelated refresh, same semantic inputs
        (backend as unknown as { reality: () => Promise<unknown> }).reality = async () =>
            ({ basis: currentBasis, architecture: { schemaVersion: 1, systems: [{ id: 'existing',
                name: 'Existing', purpose: 'Canonical', subsystems: [{ id: 'existing-sub',
                    name: 'Existing sub', purpose: 'Canonical', roots: ['src/existing'] }] }] },
                physicalNodes: [], relationships: [] });
        const handle = (await backend.attach(pathToFileURL(root).href)).projectHandle;
        const reviewed = await backend.targetDesign(handle, 'map', collection.revision, collection.maps[0].revision);
        assert.equal(reviewed.current.nodes.some(node => node.id === 'core'), false);
        assert.deepEqual(reviewed.diff.nodes, ['core']);
        assert.equal(reviewed.target.nodes[0].id, 'core');
        await assert.rejects(readFile(join(root, '.dope/architecture.json')), /ENOENT/);
        collection = await store.mutate(root, collection.revision,
            { type: 'create', id: 'other', title: 'Other', objective: 'Overlapping', basis });
        collection = await store.mutate(root, collection.revision,
            { type: 'put-transformation', mapId: 'other', transformation: { ...transformation, id: 'also-core' } });
        await assert.rejects(backend.targetDesign(handle, 'map', collection.revision, collection.maps[0].revision), /Overlapping/);
        currentBasis.physicalInputFingerprint = 'changed';
        await assert.rejects(backend.targetDesign(handle, 'map', collection.revision, collection.maps[0].revision), /rebase/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
