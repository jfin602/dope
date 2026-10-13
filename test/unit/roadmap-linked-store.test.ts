import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';

const fixture = async (run: (root: string) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-linked-roadmap-'));
    try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
};
const sha256 = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const source = '# Roadmap\r\n## Phase 1 — Build\r\nStatus: ACTIVE\r\nUnmapped prose stays intact.\r\n';

test('selected source binds on acceptance, survives restart and preserves document bytes and checkpoint identity', async () => fixture(async root => {
    const path = join(root, 'ROADMAP.md');
    await writeFile(path, source);
    const before = await readFile(path);
    const store = new RoadmapStore();
    const preview = await previewRoadmapImport(root, 'ROADMAP.md');
    assert.equal((await store.read(root)).linkedDocument, undefined);
    const accepted = await store.acceptImport(root, 0, preview);
    const link = accepted.linkedDocument!;
    assert.equal(link.path, 'ROADMAP.md');
    assert.equal(link.projectRoot, root);
    assert.equal(link.projectId, accepted.projectId);
    assert.equal(link.sourceHash, sha256(before));
    assert.deepEqual(link.sections, [{ sectionKey: preview.checkpoints[0].sectionKey, checkpointId: preview.checkpoints[0].id }]);
    assert.deepEqual(link.lastSynced, { sourceHash: sha256(before), roadmapRevision: accepted.revision,
        fields: [{ checkpointId: preview.checkpoints[0].id, title: preview.checkpoints[0].title }] });
    assert.equal(link.syncState, 'synced');
    assert.equal(accepted.checkpoints[0].id, preview.checkpoints[0].id);
    assert.deepEqual(await readFile(path), before);
    assert.deepEqual((await new RoadmapStore().read(root)).linkedDocument, link);
    assert.equal((await store.acceptImport(root, 1, preview, accepted.projectId)).revision, 1);
    assert.deepEqual(await readFile(path), before);
}));

test('legacy v1 without a link stays valid until explicit acceptance', async () => fixture(async root => {
    await writeFile(join(root, 'ROADMAP.md'), source);
    const store = new RoadmapStore();
    const initial = await store.mutate(root, 0, { type: 'create', id: 'manual', kind: 'milestone',
        title: 'Manual', objective: '', order: 0 });
    const path = join(root, '.dope/roadmap.json');
    const legacy = JSON.parse((await readFile(path)).toString('utf8'));
    assert.equal(legacy.linkedDocument, undefined);
    assert.equal((await new RoadmapStore().read(root)).linkedDocument, undefined);
    const preview = await previewRoadmapImport(root, 'ROADMAP.md');
    const accepted = await store.acceptImport(root, initial.revision, preview, initial.projectId);
    assert.equal(accepted.checkpoints[0].id, 'manual');
    assert.equal(accepted.linkedDocument?.lastSynced.roadmapRevision, accepted.revision);
    const importedV1 = JSON.parse((await readFile(path)).toString('utf8'));
    delete importedV1.linkedDocument;
    await writeFile(path, JSON.stringify(importedV1));
    assert.equal((await store.read(root)).linkedDocument, undefined);
    const rebound = await store.acceptImport(root, accepted.revision, preview, accepted.projectId);
    assert.equal(rebound.revision, accepted.revision + 1);
    assert.deepEqual(rebound.checkpoints.map(item => item.id), accepted.checkpoints.map(item => item.id));
}));

test('stale, forged, unsafe and foreign acceptance fail closed without source edits', async () => fixture(async root => {
    await writeFile(join(root, 'ROADMAP.md'), source);
    const before = await readFile(join(root, 'ROADMAP.md'));
    const store = new RoadmapStore();
    const preview = await previewRoadmapImport(root, 'ROADMAP.md');
    await assert.rejects(store.acceptImport(root, 0, { ...preview, roadmapPath: '../ROADMAP.md' }), /Unsafe roadmap source path/);
    await assert.rejects(store.acceptImport(root, 0, { ...preview, sources: [] }), /Stale Roadmap import preview/);
    await writeFile(join(root, 'ROADMAP.md'), `${source}Changed.\r\n`);
    await assert.rejects(store.acceptImport(root, 0, preview), /Stale Roadmap import preview/);
    await writeFile(join(root, 'ROADMAP.md'), before);
    const accepted = await store.acceptImport(root, 0, preview);
    await assert.rejects(store.acceptImport(root, 0, preview, accepted.projectId), /Stale Roadmap revision/);
    await assert.rejects(store.acceptImport(root, 1, preview, 'foreign'), /identity changed/);
    assert.deepEqual(await readFile(join(root, 'ROADMAP.md')), before);
    const copy = await mkdtemp(join(tmpdir(), 'dope-linked-copy-'));
    try {
        await mkdir(join(copy, '.dope'));
        const copied = JSON.parse((await readFile(join(root, '.dope/roadmap.json'))).toString('utf8'));
        copied.projectRoot = copy;
        await writeFile(join(copy, '.dope/roadmap.json'), JSON.stringify(copied));
        await assert.rejects(new RoadmapStore().read(copy), /Corrupt or unsupported/);
    } finally { await rm(copy, { recursive: true, force: true }); }
}));

test('malformed link and newer schema reject; symlinked source cannot be accepted', async () => fixture(async root => {
    await writeFile(join(root, 'ROADMAP.md'), source);
    const store = new RoadmapStore();
    const preview = await previewRoadmapImport(root, 'ROADMAP.md');
    const accepted = await store.acceptImport(root, 0, preview);
    const file = join(root, '.dope/roadmap.json');
    const original = await readFile(file);
    const corrupt = JSON.parse(original.toString('utf8'));
    corrupt.linkedDocument.sections[0].checkpointId = 'missing';
    await writeFile(file, JSON.stringify(corrupt));
    await assert.rejects(store.read(root), /Corrupt or unsupported/);
    await writeFile(file, JSON.stringify({ ...accepted, schemaVersion: 2 }));
    await assert.rejects(store.read(root), /Corrupt or unsupported/);
    await writeFile(file, original);
    await rm(join(root, 'ROADMAP.md'));
    await symlink(join(root, 'elsewhere.md'), join(root, 'ROADMAP.md'));
    await assert.rejects(store.acceptImport(root, accepted.revision, preview, accepted.projectId), /Unsafe roadmap source path/);
    assert.equal((await store.read(root)).revision, accepted.revision);
}));
