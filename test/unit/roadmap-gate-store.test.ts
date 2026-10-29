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
    await writeFile(join(root, 'ROADMAP.md'), 'source');
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

test('typed Phase, Gate, criterion and correction mutations persist across store restart', async () => fixture(async (root, file) => {
    const store = new RoadmapStore();
    await store.saveGateIndex(root, 0, 'uninitialized', {
        schemaVersion: 2, projectId: 'owner-1', projectRoot: root, revision: 1,
        phases: [], gates: [], corrections: [],
    });
    let revision = 1;
    const act = async (operation: Parameters<RoadmapStore['mutateGateIndex']>[3]) => {
        const result = await store.mutateGateIndex(root, revision, 'owner-1', operation);
        assert.equal(result.revision, ++revision);
        assert.deepEqual(await new RoadmapStore().read(root), result);
        assert.equal(JSON.parse(await readFile(file, 'utf8')).schemaVersion, 2);
        return result;
    };
    await act({ type: 'phase.create', id: 'p1', title: 'Phase One', objective: 'Deliver one' });
    await act({ type: 'phase.create', id: 'p2', title: 'Phase Two', objective: 'Deliver two' });
    await act({ type: 'phase.reorder', ids: ['p2', 'p1'] });
    await act({ type: 'gate.create', id: 'g1', parentPhaseId: 'p1', designation: 'G1',
        title: 'Check one', purpose: 'Verify one', criteria: [{ id: 'c1', title: 'Observe one', expectedResult: 'One is visible' }] });
    await act({ type: 'criterion.add', gateId: 'g1', id: 'c2', title: 'Observe two', expectedResult: 'Two is visible' });
    await act({ type: 'criterion.reorder', gateId: 'g1', ids: ['c2', 'c1'] });
    await act({ type: 'criterion.edit', gateId: 'g1', id: 'c1', title: 'Observe first', expectedResult: 'First is visible' });
    await act({ type: 'gate.create', id: 'g2', parentPhaseId: 'p1', designation: 'G2',
        title: 'Check two', purpose: 'Verify two', criteria: [{ id: 'c3', title: 'Observe three', expectedResult: 'Three is visible' }] });
    await act({ type: 'gate.reorder', parentPhaseId: 'p1', ids: ['g2', 'g1'] });
    await act({ type: 'gate.dependencies', id: 'g2', dependencies: ['g1'] });
    await act({ type: 'phase.dependencies', id: 'p2', dependencies: ['p1'] });
    await act({ type: 'correction.attach', id: 'fix', parent: { kind: 'gate', id: 'g1' }, criterionId: 'c1',
        title: 'Repair first', objective: 'Fix first result' });
    const final = await act({ type: 'correction.reparent', id: 'fix', parent: { kind: 'phase', id: 'p2' } });
    assert.deepEqual(final.phases.map(item => [item.id, item.order]), [['p1', 1], ['p2', 0]]);
    assert.deepEqual(final.gates.map(item => [item.id, item.order]), [['g1', 1], ['g2', 0]]);
    assert.deepEqual(final.gates[0].criteria.map(item => [item.id, item.order]), [['c1', 1], ['c2', 0]]);
    assert.deepEqual(final.corrections[0].parent, { kind: 'phase', id: 'p2' });
    assert.equal(final.corrections[0].criterionId, undefined);
    assert.equal((await readFile(file, 'utf8')).includes('"schemaVersion": 2'), true);
    await act({ type: 'correction.delete', id: 'fix' });
    await act({ type: 'criterion.remove', gateId: 'g1', id: 'c2' });
    await act({ type: 'gate.dependencies', id: 'g2', dependencies: [] });
    await act({ type: 'gate.delete', id: 'g1' });
    await act({ type: 'gate.delete', id: 'g2' });
    await act({ type: 'phase.dependencies', id: 'p2', dependencies: [] });
    await act({ type: 'phase.delete', id: 'p1' });
}));

test('invalid parent, duplicate, stale, foreign, cyclic and source-owned mutations leave index bytes intact', async () => fixture(async (root, file) => {
    const markdown = '# Owner roadmap\n';
    await writeFile(join(root, 'ROADMAP.md'), markdown);
    const store = new RoadmapStore();
    await store.saveGateIndex(root, 0, 'uninitialized', index(root, digest(markdown)));
    const before = digest(await readFile(file));
    const reject = async (expectedRevision: number, projectId: string,
        operation: Parameters<RoadmapStore['mutateGateIndex']>[3], reason: RegExp) => {
        await assert.rejects(store.mutateGateIndex(root, expectedRevision, projectId, operation), reason);
        assert.equal(digest(await readFile(file)), before);
    };
    await reject(1, 'owner-1', { type: 'gate.create', id: 'new', parentPhaseId: 'missing', designation: 'G2',
        title: 'New gate', purpose: 'Verify', criteria: [{ id: 'new-criterion', title: 'Observe', expectedResult: 'Observed' }] }, /Missing Roadmap Phase/);
    await reject(1, 'owner-1', { type: 'phase.create', id: 'gate-1', title: 'Duplicate', objective: 'Invalid' }, /Duplicate/);
    await reject(1, 'owner-1', { type: 'correction.reparent', id: 'correction-1', parent: { kind: 'gate', id: 'missing' } }, /Missing Roadmap Gate/);
    await reject(1, 'owner-1', { type: 'correction.reparent', id: 'correction-1', parent: { kind: 'phase', id: 'phase-1' },
        criterionId: 'criterion-1' }, /cannot own a criterion/);
    await reject(0, 'owner-1', { type: 'phase.create', id: 'new', title: 'New', objective: 'New' }, /Stale/);
    await reject(1, 'foreign', { type: 'phase.create', id: 'new', title: 'New', objective: 'New' }, /identity changed/);
    await reject(1, 'owner-1', { type: 'gate.edit', id: 'gate-1', title: 'New', purpose: 'New' }, /read-only/);
    await reject(1, 'owner-1', { type: 'criterion.remove', gateId: 'gate-1', id: 'criterion-1' }, /read-only/);
    await reject(1, 'owner-1', { type: 'phase.dependencies', id: 'phase-1', dependencies: ['phase-1'] }, /read-only/);
    await reject(1, 'owner-1', { type: 'gate.create', id: 'new', parentPhaseId: 'phase-1', designation: 'G2',
        title: 'New gate', purpose: 'Verify', criteria: [{ id: 'new-criterion', title: 'Observe', expectedResult: 'Observed' }] }, /read-only/);
    await writeFile(join(root, 'ROADMAP.md'), `${markdown}drift\n`);
    await reject(1, 'owner-1', { type: 'phase.create', id: 'new', title: 'New', objective: 'New' }, /fingerprint changed/);
}));

test('dependency cycle and foreign reference cannot write; changed criteria invalidate prior Green', async () => fixture(async (root, file) => {
    const store = new RoadmapStore();
    const base = index(root, digest('unused'));
    delete (base as Partial<typeof base>).linkedDocument;
    base.gates[0].qualificationStatus = 'green';
    base.phases[0].qualificationStatus = 'green';
    await store.saveGateIndex(root, 0, 'uninitialized', base);
    const initialHash = digest(await readFile(file));
    await assert.rejects(store.mutateGateIndex(root, 1, 'owner-1', { type: 'gate.create', id: 'bad-gate',
        parentPhaseId: 'phase-1', designation: 'G2', title: 'Bad', purpose: 'Invalid',
        criteria: [{ id: 'bad', title: 'Bad', expectedResult: '' }] }), /criterion fields/);
    assert.equal(digest(await readFile(file)), initialHash);
    let current = await store.mutateGateIndex(root, 1, 'owner-1', { type: 'gate.create', id: 'gate-2',
        parentPhaseId: 'phase-1', designation: 'G2', title: 'Second', purpose: 'Verify second',
        criteria: [{ id: 'criterion-2', title: 'Observe second', expectedResult: 'Second is visible' }] });
    assert.equal(current.phases[0].qualificationStatus, 'stale');
    const before = digest(await readFile(file));
    await assert.rejects(store.mutateGateIndex(root, 2, 'owner-1', { type: 'gate.dependencies', id: 'gate-1',
        dependencies: ['foreign-gate'] }), /dependency parent/);
    assert.equal(digest(await readFile(file)), before);
    current = await store.mutateGateIndex(root, 2, 'owner-1', { type: 'gate.dependencies', id: 'gate-2', dependencies: ['gate-1'] });
    const afterDependency = digest(await readFile(file));
    await assert.rejects(store.mutateGateIndex(root, 3, 'owner-1', { type: 'gate.dependencies', id: 'gate-1',
        dependencies: ['gate-2'] }), /dependency cycle/);
    assert.equal(digest(await readFile(file)), afterDependency);
    current = await store.mutateGateIndex(root, 3, 'owner-1', { type: 'criterion.edit', gateId: 'gate-1',
        id: 'criterion-1', title: 'Updated observation', expectedResult: 'New expected result' });
    assert.equal(current.gates[0].qualificationStatus, 'stale');
    assert.equal((await new RoadmapStore().read<typeof current>(root)).revision, 4);
}));
