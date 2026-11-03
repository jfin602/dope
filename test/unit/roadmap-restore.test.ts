import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { readGateMappedDocument, structureDiagnostics } from '../../packages/project-intelligence/lib/node/roadmap-gate-document.js';
import { readHistoryOwnerMetadata } from '../../packages/theia-extension/lib/node/history-owner-metadata.js';
import { roadmapHistoryTarget } from '../../packages/theia-extension/src/browser/roadmap-history-navigation.ts';

const linkedFixture = async (run: (root: string, file: string, store: RoadmapStore) => Promise<void>) => {
    const root = await mkdtemp(join(tmpdir(), 'dope-restore-linked-'));
    try {
        const store = new RoadmapStore();
        await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2, projectId: 'owner',
            projectRoot: root, revision: 1, phases: [{ id: 'phase-one', projectId: 'owner', title: 'First',
                objective: 'Deliver first', order: 0, dependencies: [], implementationStatus: 'unknown',
                qualificationStatus: 'unknown', draftAcceptance: 'accepted', gateSetCoverage: { status: 'unreviewed' } }],
            gates: [{ id: 'gate-one', projectId: 'owner', parentPhaseId: 'phase-one', designation: 'G1',
                title: 'Check first', purpose: 'Prove first', order: 0, dependencies: [],
                criteria: [{ id: 'criterion-one', projectId: 'owner', title: 'Result one',
                    expectedResult: 'one is visible', order: 0, evidence: [] }],
                implementationStatus: 'unknown', qualificationStatus: 'unknown', draftAcceptance: 'accepted' }],
            corrections: [] });
        const publication = await store.previewRoadmapPublication(root, 'ROADMAP.md');
        await writeFile(join(root, 'ROADMAP.md'), `${publication.content}\nUnmapped prose stays.\n`);
        const link = await store.previewExistingRoadmapLink(root, 'ROADMAP.md');
        assert.equal(link.compatible, true, link.diagnostics.join('; '));
        await store.applyExistingRoadmapLink(root, link, true);
        await run(root, join(root, 'ROADMAP.md'), store);
    } finally { await rm(root, { recursive: true, force: true }); }
};

test('reviewed restore appends a head, retains intervening revisions and rejects stale or duplicate approval', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-restore-'));
    try {
        await mkdir(join(root, '.dope'));
        await writeFile(join(root, '.dope', 'roadmap.json'), `${JSON.stringify({ schemaVersion: 2,
            projectId: 'owner', projectRoot: root, revision: 1, phases: [], gates: [], corrections: [] })}\n`);
        const store = new RoadmapStore();
        await store.initializeRevisionArchive(root, 'owner');
        let head = await store.read(root);
        head = await store.mutateGateIndex(root, head.revision, 'owner',
            { type: 'phase.create', id: 'phase-one', title: 'First', objective: 'Deliver first' });
        for (let revision = 3; revision <= 9; revision++) head = await store.mutateGateIndex(root, head.revision,
            'owner', { type: 'phase.edit', id: 'phase-one', title: `Phase R${revision}`, objective: 'Deliver first' });
        const target = JSON.parse((await store.fetchRevision(root, 'owner', 5)).snapshot);
        const preview = await store.previewRestore(root, 'owner', 5);
        const bytes = await readFile(join(root, '.dope', 'roadmap.json'));
        await store.applyRestore(root, preview, false);
        assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), bytes);
        const approved = await store.previewRestore(root, 'owner', 5);
        const restored = await store.applyRestore(root, approved, true);
        assert.equal(restored.revision, 10);
        assert.equal(restored.phases[0].title, target.phases[0].title);
        assert.equal((await new RoadmapStore().applyRestore(root, approved, true)).revision, 10);
        const revisions = await store.listRevisions(root, 'owner');
        assert.deepEqual(revisions.revisions.map(item => item.revision), [10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
        assert.equal(roadmapHistoryTarget(revisions.revisions.map(item => item.revision), 10, 1, 10, -1), 9);
        assert.equal((await store.fetchRevision(root, 'owner', 9)).revision, 9);
        assert.deepEqual(revisions.revisions[0].receipt.operationIds,
            ['restore-from:5', 'restore-previous:9', `restore-approval:${approved.approvalId}`]);
        assert.equal(revisions.revisions[0].receipt.restoredFromRevision, 5);
        assert.equal(revisions.revisions[0].receipt.previousHeadRevision, 9);
        await assert.rejects(store.previewRestore(root, 'owner', 5), /already matches/);
        const history = await readHistoryOwnerMetadata({ projectRoot: root, projectId: 'owner' }, new Date().toISOString());
        assert.deepEqual(history.entries.filter(item => item.source === 'roadmap').map(item => item.title),
            ['Roadmap restored from R5 as R10']);
        await store.mutateGateIndex(root, 10, 'owner',
            { type: 'phase.edit', id: 'phase-one', title: 'Concurrent', objective: 'Deliver first' });
        const stale = await store.previewRestore(root, 'owner', 5);
        await store.mutateGateIndex(root, 11, 'owner',
            { type: 'phase.edit', id: 'phase-one', title: 'Concurrent again', objective: 'Deliver first' });
        await assert.rejects(store.applyRestore(root, stale, true), /Stale/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('linked restore reviews checked Markdown bytes and preserves unrelated prose after restart', async () => linkedFixture(async (root, file, store) => {
    const original = await store.read(root);
    let head = await store.mutateGateIndex(root, original.revision, original.projectId,
        { type: 'gate.edit', id: 'gate-one', title: 'Changed Gate', purpose: 'Prove first' });
    head = await store.recoverAutoSync(root);
    assert.equal(head.linkedDocument?.syncState, 'synced');
    const review = await store.previewRestore(root, original.projectId, original.revision);
    assert.match(review.linkedDiff!.before, /Changed Gate/);
    assert.match(review.linkedDiff!.after, /Check first/);
    const restored = await store.applyRestore(root, review, true);
    assert.equal(restored.revision, head.revision + 1);
    assert.equal(restored.linkedDocument?.syncState, 'synced');
    const bytes = await readFile(file, 'utf8');
    assert.match(bytes, /Check first/);
    assert.match(bytes, /Unmapped prose stays/);
    const restarted = new RoadmapStore();
    const reopened = await restarted.read(root);
    assert.equal(reopened.gates[0].title, 'Check first');
    const mapped = await readGateMappedDocument(root, reopened.linkedDocument!);
    assert.deepEqual(mapped.diagnostics, []);
    assert.deepEqual(structureDiagnostics(reopened, mapped), []);
    assert.equal(mapped.hash, reopened.linkedDocument!.sourceHash);
    assert.equal((await restarted.listRevisions(root, original.projectId)).headRevision, restored.revision);
}));

test('linked restore refuses an external edit before canonical publication', async () => linkedFixture(async (root, file, store) => {
    const first = await store.read(root);
    let head = await store.mutateGateIndex(root, first.revision, first.projectId,
        { type: 'gate.edit', id: 'gate-one', title: 'Changed Gate', purpose: 'Prove first' });
    head = await store.recoverAutoSync(root);
    const review = await store.previewRestore(root, first.projectId, first.revision);
    await writeFile(file, `${await readFile(file, 'utf8')}External edit.\n`);
    const canonical = await readFile(join(root, '.dope', 'roadmap.json'));
    await assert.rejects(store.applyRestore(root, review, true), /externally|changed after/);
    assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), canonical);
    assert.equal((await store.listRevisions(root, first.projectId)).headRevision, head.revision);
}));

test('tampered or expired restore approval is nonwriting', async () => linkedFixture(async (root, file, store) => {
    const first = await store.read(root);
    let head = await store.mutateGateIndex(root, first.revision, first.projectId,
        { type: 'gate.edit', id: 'gate-one', title: 'Changed Gate', purpose: 'Prove first' });
    head = await store.recoverAutoSync(root);
    const review = await store.previewRestore(root, first.projectId, first.revision);
    const canonical = await readFile(join(root, '.dope', 'roadmap.json'));
    const source = await readFile(file);
    await assert.rejects(store.applyRestore(root, { ...review, expiresAt: Date.now() - 1 }, true), /Stale/);
    await assert.rejects(store.applyRestore(root, review, true), /Stale/);
    assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), canonical);
    assert.deepEqual(await readFile(file), source);
    assert.equal((await store.listRevisions(root, first.projectId)).headRevision, head.revision);
}));

test('linked multi-field structural restore removes added definitions and retains author prose', async () => linkedFixture(async (root, file, store) => {
    const original = await store.read(root);
    let head = await store.mutateGateIndex(root, original.revision, original.projectId, [
        { type: 'phase.edit', id: 'phase-one', title: 'Changed Phase', objective: 'Deliver more' },
        { type: 'criterion.edit', gateId: 'gate-one', id: 'criterion-one', title: 'Changed result',
            expectedResult: 'more is visible' },
        { type: 'gate.create', id: 'gate-two', parentPhaseId: 'phase-one', designation: 'G2',
            title: 'Extra Gate', purpose: 'Prove extra', criteria: [{ id: 'criterion-two',
                title: 'Extra check', expectedResult: 'Extra is visible' }] },
    ]);
    head = await store.recoverAutoSync(root);
    assert.equal(head.linkedDocument?.syncState, 'synced');
    head = await store.mutateGateIndex(root, head.revision, head.projectId,
        { type: 'correction.attach', id: 'correction-one', parent: { kind: 'gate', id: 'gate-one' },
            criterionId: 'criterion-one', title: 'Repair', objective: 'Repair first' });
    head = await store.recoverAutoSync(root);
    const review = await store.previewRestore(root, original.projectId, original.revision);
    assert.match(review.changes.join(' '), /Gate gate-two: removed/);
    assert.match(review.changes.join(' '), /Criterion criterion-one expectedResult/);
    assert.match(review.linkedDiff!.before, /Extra Gate/);
    assert.doesNotMatch(review.linkedDiff!.after, /Extra Gate/);
    const restored = await store.applyRestore(root, review, true);
    assert.equal(restored.gates.length, 1);
    assert.equal(restored.corrections.length, 0);
    assert.equal(restored.phases[0].title, original.phases[0].title);
    assert.equal(restored.gates[0].criteria[0].expectedResult, original.gates[0].criteria[0].expectedResult);
    assert.equal(restored.linkedDocument?.syncState, 'synced');
    const bytes = await readFile(file, 'utf8');
    assert.match(bytes, /Unmapped prose stays/);
    assert.doesNotMatch(bytes, /Extra Gate|correction-one/);
    assert.equal((await new RoadmapStore().read(root)).revision, restored.revision);
}));

test('linked restore refuses a symlink substitution without an index or external file write', async () => linkedFixture(async (root, file, store) => {
    const original = await store.read(root);
    let head = await store.mutateGateIndex(root, original.revision, original.projectId,
        { type: 'gate.edit', id: 'gate-one', title: 'Changed Gate', purpose: 'Prove first' });
    head = await store.recoverAutoSync(root);
    const review = await store.previewRestore(root, original.projectId, original.revision);
    const replacement = join(root, 'replacement.md');
    await writeFile(replacement, 'Independent file\n');
    await rm(file);
    await symlink(replacement, file);
    const canonical = await readFile(join(root, '.dope', 'roadmap.json'));
    await assert.rejects(store.applyRestore(root, review, true), /Unsafe|symlink|linked/i);
    assert.deepEqual(await readFile(join(root, '.dope', 'roadmap.json')), canonical);
    assert.equal(await readFile(replacement, 'utf8'), 'Independent file\n');
    assert.equal((await store.listRevisions(root, original.projectId)).headRevision, head.revision);
}));

test('linked backup collision leaves a truthful conflict and one committed restore receipt', async () => linkedFixture(async (root, file, store) => {
    const original = await store.read(root);
    let head = await store.mutateGateIndex(root, original.revision, original.projectId,
        { type: 'gate.edit', id: 'gate-one', title: 'Changed Gate', purpose: 'Prove first' });
    head = await store.recoverAutoSync(root);
    const review = await store.previewRestore(root, original.projectId, original.revision);
    const before = await readFile(file);
    await writeFile(`${file}.dope-pending-backup`, 'collision');
    const restored = await store.applyRestore(root, review, true);
    assert.equal(restored.revision, head.revision + 1);
    assert.notEqual(restored.linkedDocument?.syncState, 'synced');
    assert.deepEqual(await readFile(file), before);
    const replay = await new RoadmapStore().applyRestore(root, review, true);
    assert.equal(replay.revision, restored.revision);
    const revisions = await store.listRevisions(root, original.projectId);
    assert.equal(revisions.headRevision, restored.revision);
    assert.equal(revisions.revisions.filter(item => item.receipt.restoredFromRevision !== undefined).length, 1);
}));

test('historical Green is not copied into restored requirements and current evidence remains stale', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-restore-evidence-'));
    try {
        const store = new RoadmapStore();
        let head = await store.saveGateIndex(root, 0, 'uninitialized', { schemaVersion: 2,
            projectId: 'owner', projectRoot: root, revision: 1,
            phases: [{ id: 'phase', projectId: 'owner', title: 'Phase', objective: 'Deliver', order: 0,
                dependencies: [], implementationStatus: 'unknown', qualificationStatus: 'unknown',
                draftAcceptance: 'accepted', gateSetCoverage: { status: 'unreviewed' } }],
            gates: [{ id: 'gate', projectId: 'owner', parentPhaseId: 'phase', designation: 'G1',
                title: 'Gate', purpose: 'Check', order: 0, dependencies: [],
                criteria: [{ id: 'criterion', projectId: 'owner', title: 'Test', expectedResult: 'First',
                    order: 0, evidence: [] }], implementationStatus: 'unknown',
                qualificationStatus: 'unknown', draftAcceptance: 'accepted' }], corrections: [] });
        const proof = { projectId: 'owner', revision: 1, sha256: 'a'.repeat(64) };
        head = await store.mutateGateIndex(root, head.revision, 'owner',
            { type: 'gate.source', id: 'gate', source: proof });
        head = await store.mutateGateIndex(root, head.revision, 'owner',
            { type: 'evidence.propose', gateId: 'gate', criterionId: 'criterion', id: 'evidence',
                result: 'pass', kind: 'test', summary: 'Observed', verifiedBy: 'reviewer',
                observedAt: new Date().toISOString(), source: proof });
        head = await store.mutateGateIndex(root, head.revision, 'owner',
            { type: 'evidence.approve', gateId: 'gate', criterionId: 'criterion', id: 'evidence',
                reviewerId: 'reviewer', reviewedAt: new Date().toISOString(), currentSource: proof });
        assert.equal(head.gates[0].qualificationStatus, 'green');
        const greenRevision = head.revision;
        head = await store.mutateGateIndex(root, head.revision, 'owner',
            { type: 'criterion.edit', gateId: 'gate', id: 'criterion', title: 'Test', expectedResult: 'Second' });
        const review = await store.previewRestore(root, 'owner', greenRevision);
        head = await store.applyRestore(root, review, true);
        assert.equal(head.gates[0].criteria[0].expectedResult, 'First');
        assert.equal(head.gates[0].criteria[0].evidence[0].id, 'evidence');
        assert.equal(head.gates[0].criteria[0].evidence[0].validation?.status, 'stale');
        assert.notEqual(head.gates[0].qualificationStatus, 'green');
        assert.equal((JSON.parse((await store.fetchRevision(root, 'owner', greenRevision)).snapshot)).gates[0]
            .qualificationStatus, 'green');
    } finally { await rm(root, { recursive: true, force: true }); }
});
