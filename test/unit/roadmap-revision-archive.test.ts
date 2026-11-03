import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { link, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapRevisionArchive } from '../../packages/project-intelligence/lib/node/roadmap-revision-archive.js';
import { gateFixture } from './roadmap-gate-document-fixture.ts';

const hash = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');

test('import, typed manual edit and evidence writer create exact restart-stable revisions', async () => gateFixture(async (root, _file, store) => {
    const path = join(root, '.dope', 'roadmap.json');
    const witnessed = [await readFile(path)];
    let head = await store.read(root);
    head = await store.mutateGateIndex(root, head.revision, head.projectId,
        { type: 'gate.blockers', id: 'gate-one', reasons: ['Pending independent check'] });
    witnessed.push(await readFile(path));
    head = await store.mutateGateIndex(root, head.revision, head.projectId,
        { type: 'phase.blockers', id: 'phase-one', reasons: ['Pending phase review'] }, false,
        { indexHash: hash(witnessed[1]), operationIds: ['operation-a', 'operation-b'] });
    witnessed.push(await readFile(path));
    head = await store.mutateGateIndex(root, head.revision, head.projectId,
        { type: 'evidence.propose', gateId: 'gate-one', criterionId: 'criterion-one', id: 'evidence-one',
            result: 'pass', kind: 'test', summary: 'Observed assertion', verifiedBy: 'test',
            observedAt: new Date().toISOString(), source: { projectId: head.projectId, revision: 1,
                sha256: hash('tested source') } });
    witnessed.push(await readFile(path));
    const restarted = new RoadmapStore();
    const list = await restarted.listRevisions(root, head.projectId);
    assert.deepEqual(list.revisions.map(item => item.revision), [4, 3, 2, 1]);
    assert.equal(list.earliestAvailable, 1);
    assert.deepEqual(list.revisions.find(item => item.revision === 3)?.receipt.operationIds,
        ['operation-a', 'operation-b']);
    for (let i = 0; i < witnessed.length; i++) {
        const record = await restarted.fetchRevision(root, head.projectId, i + 1);
        assert.equal(record.snapshot, witnessed[i].toString('utf8'));
        assert.equal(record.hash, hash(witnessed[i]));
        assert.equal(record.source?.path, 'ROADMAP.md');
    }
    await assert.rejects(restarted.fetchRevision(root, 'foreign', 1), /Foreign/);
    await assert.rejects(restarted.fetchRevision(root, head.projectId, 0), /Invalid/);
    const before = await readFile(path);
    await restarted.listRevisions(root, head.projectId, undefined, 2);
    assert.deepEqual(await readFile(path), before);
    await assert.rejects(store.mutateGateIndex(root, head.revision - 1, head.projectId,
        { type: 'phase.edit', id: 'phase-one', title: 'Stale', objective: 'Stale' }), /Stale/);
    assert.equal((await restarted.listRevisions(root, head.projectId)).revisions.length, 4);
}));

test('verified late baseline does not invent earlier revisions and corruption blocks reads without changing current', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-archive-baseline-'));
    try {
        await mkdir(join(root, '.dope'));
        const index = { schemaVersion: 2, projectId: 'owner', projectRoot: root, revision: 7,
            phases: [], gates: [], corrections: [] };
        const path = join(root, '.dope', 'roadmap.json');
        await writeFile(path, `${JSON.stringify(index)}\n`);
        const store = new RoadmapStore();
        assert.deepEqual((await store.listRevisions(root, 'owner')).revisions, []);
        await store.initializeRevisionArchive(root, 'owner');
        const list = await store.listRevisions(root, 'owner');
        assert.deepEqual(list.revisions.map(item => item.revision), [7]);
        assert.equal(list.unavailableBefore, 7);
        await assert.rejects(store.fetchRevision(root, 'owner', 6), /unavailable/);
        await store.mutateGateIndex(root, 7, 'owner', { type: 'phase.create', id: 'phase',
            title: 'New phase', objective: 'Deliver', });
        const bytes = await readFile(path);
        const archiveFile = join(root, '.dope', 'roadmap-revisions', 'r-000000000007.json');
        const archived = await readFile(archiveFile);
        const orphan = join(root, '.dope', 'roadmap-revisions', '.revision-00000000-0000-4000-8000-000000000000.tmp');
        await link(archiveFile, orphan);
        await assert.rejects(store.listRevisions(root, 'owner'), /Unsafe/);
        await store.initializeRevisionArchive(root, 'owner');
        assert.equal((await store.listRevisions(root, 'owner')).revisions.length, 2);
        await rm(archiveFile);
        await assert.rejects(store.listRevisions(root, 'owner'), /start is missing/);
        await writeFile(archiveFile, archived);
        await writeFile(archiveFile, '{');
        await assert.rejects(store.listRevisions(root, 'owner'), /Corrupt/);
        await writeFile(archiveFile, 'x'.repeat(9 * 1024 * 1024));
        await assert.rejects(store.listRevisions(root, 'owner'), /oversized/);
        assert.deepEqual(await readFile(path), bytes);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('uncommitted intent is invisible, exact retry succeeds, conflicting retry blocks, and symlink is rejected', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-archive-intent-'));
    try {
        await mkdir(join(root, '.dope'));
        const path = join(root, '.dope', 'roadmap.json');
        const initial = Buffer.from(JSON.stringify({ schemaVersion: 2, projectId: 'owner', projectRoot: root,
            revision: 1, phases: [], gates: [], corrections: [] }));
        await writeFile(path, initial);
        const archive = new RoadmapRevisionArchive();
        const next = (title: string) => Buffer.from(JSON.stringify({ ...JSON.parse(initial.toString('utf8')),
            revision: 2, phases: [{ id: 'phase', projectId: 'owner', title, objective: 'Deliver', order: 0,
                dependencies: [], implementationStatus: 'unknown', qualificationStatus: 'unknown',
                draftAcceptance: 'accepted', gateSetCoverage: { status: 'unreviewed' } }] }));
        await archive.prepare(root, initial, next('First'));
        const store = new RoadmapStore();
        const pending = await store.listRevisions(root, 'owner');
        assert.deepEqual(pending.revisions.map(item => item.revision), [1]);
        assert.deepEqual(pending.pendingIntent, { revision: 2, hash: hash(next('First')) });
        await assert.rejects(archive.prepare(root, initial, next('Second')), /Conflicting Roadmap revision hash/);
        await archive.prepare(root, initial, next('First'));
        await writeFile(path, next('First'));
        assert.equal((await store.fetchRevision(root, 'owner', 2)).hash, hash(next('First')));
        const current = await readFile(path);
        await rm(join(root, '.dope', 'roadmap-revisions'), { recursive: true });
        await symlink(root, join(root, '.dope', 'roadmap-revisions'));
        await assert.rejects(store.listRevisions(root, 'owner'), /Unsafe/);
        assert.deepEqual(await readFile(path), current);
    } finally { await rm(root, { recursive: true, force: true }); }
});
