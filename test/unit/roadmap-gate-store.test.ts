import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore, parseRoadmapIndex } from '../../packages/project-intelligence/lib/node/roadmap-store.js';

const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const fixture = async (run: (root: string, file: string) => Promise<void>) => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-store-'));
    const file = join(root, '.dope', 'roadmap.json');
    try { await run(root, file); } finally { await rm(root, { recursive: true, force: true }); }
};
const index = (root: string, sourceHash: string, revision = 1) => ({
    schemaVersion: 2 as const, projectId: 'owner-1', projectRoot: root, revision,
    phases: [{ id: 'phase-1', projectId: 'owner-1', title: 'Phase One', objective: 'Deliver the outcome', order: 0,
        dependencies: [], implementationStatus: 'implemented', qualificationStatus: 'unknown',
        draftAcceptance: 'accepted', gateSetCoverage: { status: 'unreviewed' } }],
    gates: [{ id: 'gate-1', projectId: 'owner-1', parentPhaseId: 'phase-1', designation: 'G1',
        title: 'Verification', purpose: 'Check the outcome', order: 0, dependencies: [],
        criteria: [{ id: 'criterion-1', projectId: 'owner-1', title: 'Response',
            expectedResult: 'Expected response', order: 0, evidence: [] }],
        implementationStatus: 'implemented', qualificationStatus: 'unknown', draftAcceptance: 'accepted' }],
    corrections: [{ id: 'correction-1', projectId: 'owner-1', parent: { kind: 'gate', id: 'gate-1' },
        criterionId: 'criterion-1', title: 'Repair', objective: 'Fix observed failure', order: 0,
        implementationStatus: 'unknown', qualificationStatus: 'unknown', draftAcceptance: 'proposed' }],
    linkedDocument: { projectId: 'owner-1', projectRoot: root, path: 'ROADMAP.md', sourceHash,
        syncState: 'synced', sections: [
            { sectionKey: 'phase', kind: 'phase', id: 'phase-1' },
            { sectionKey: 'gate', kind: 'gate', id: 'gate-1' },
        ] },
});

test('RoadmapStore reads, saves and restarts a schema-2 Phase/Gate/Correction index', async () => fixture(async (root, file) => {
    const markdown = '# User Roadmap\n';
    await writeFile(join(root, 'ROADMAP.md'), markdown);
    const sourceHash = digest(markdown);
    const first = index(root, sourceHash);
    const store = new RoadmapStore();
    assert.equal((await store.read(root)).schemaVersion, 2);
    assert.deepEqual(await readdir(root), ['ROADMAP.md']); // read did not initialize .dope
    assert.deepEqual(parseRoadmapIndex(first, root), first);
    await assert.rejects(store.saveGateIndex(root, 0, 'uninitialized', {
        ...first, linkedDocument: { ...first.linkedDocument, sourceHash: digest('untrusted') },
    }), /fingerprint changed/);
    assert.deepEqual(await readdir(join(root, '.dope')), []);
    const saved = await store.saveGateIndex(root, 0, 'uninitialized', first);
    assert.deepEqual(saved, first);
    assert.deepEqual(await new RoadmapStore().read(root), first);
    const next = { ...first, revision: 2, phases: [{ ...first.phases[0], title: 'Revised Phase' }] };
    await store.saveGateIndex(root, 1, 'owner-1', next);
    assert.deepEqual(await new RoadmapStore().read(root), next);
    assert.equal(digest(await readFile(join(root, 'ROADMAP.md'))), sourceHash);
    assert.equal((await readdir(join(root, '.dope'))).join(','), 'roadmap.json');
}));

test('malformed schema 2 and schema 1 reject without changing index bytes', async () => fixture(async (root, file) => {
    await mkdir(join(root, '.dope'));
    const store = new RoadmapStore();
    const valid = index(root, digest('source'));
    for (const value of [
        { ...valid, gates: [{ ...valid.gates[0], parentPhaseId: 'missing' }] },
        { schemaVersion: 1, projectId: 'owner-1', projectRoot: root, revision: 1, checkpoints: [] },
    ]) {
        const bytes = Buffer.from(JSON.stringify(value));
        await writeFile(file, bytes);
        const before = digest(await readFile(file));
        await assert.rejects(store.read(root), value.schemaVersion === 1 ? /Incompatible.*Review the index/ : /Corrupt.*Review the index/);
        await assert.rejects(store.saveGateIndex(root, 1, 'owner-1', { ...valid, revision: 2 }));
        assert.equal(digest(await readFile(file)), before);
    }
}));

test('wrong root, project, revision and source fingerprint cannot overwrite a valid owner', async () => fixture(async (root, file) => {
    const sourceHash = digest('source');
    const first = index(root, sourceHash);
    const store = new RoadmapStore();
    await store.saveGateIndex(root, 0, 'uninitialized', first);
    const before = digest(await readFile(file));
    await assert.rejects(store.saveGateIndex(root, 1, 'foreign', { ...first, revision: 2 }), /identity changed/);
    await assert.rejects(store.saveGateIndex(root, 0, 'owner-1', { ...first, revision: 2 }), /Stale/);
    await assert.rejects(store.saveGateIndex(root, 1, 'owner-1', { ...first, revision: 2, projectRoot: '/other' }), /root/);
    await assert.rejects(store.saveGateIndex(root, 1, 'owner-1', { ...first, revision: 2,
        linkedDocument: { ...first.linkedDocument, sourceHash: digest('other') } }), /separate reviewed synchronization/);
    await assert.rejects(store.saveGateIndex(root, 1, 'owner-1', { ...first, revision: 2,
        gates: [{ ...first.gates[0], parentPhaseId: 'missing' }] }), /Invalid Roadmap gate index/);
    await assert.rejects(store.mutate(root, 1, { type: 'create', id: 'old', kind: 'milestone',
        title: 'Old', objective: '', order: 0 }), /Checkpoint Roadmap operations are retired/);
    assert.equal(digest(await readFile(file)), before);
    const other = await mkdtemp(join(tmpdir(), 'dope-gate-copy-'));
    try {
        await mkdir(join(other, '.dope'));
        await writeFile(join(other, '.dope', 'roadmap.json'), await readFile(file));
        await assert.rejects(store.read(other), /Corrupt/);
    } finally { await rm(other, { recursive: true, force: true }); }
}));
