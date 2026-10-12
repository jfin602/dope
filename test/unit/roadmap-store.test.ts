import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';

const fixture = async (run: (root: string) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-store-'));
    try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
};
const create = (id: string) => ({ type: 'create' as const, id, kind: 'milestone' as const,
    title: id, objective: '', order: 0 });

test('revisioned atomic writes publish only committed changed IDs and survive restart', async () => fixture(async root => {
    const store = new RoadmapStore();
    const events: unknown[] = [];
    store.onChange(change => events.push(change));
    assert.equal((await store.read(root)).revision, 0);
    assert.deepEqual(await readdir(root), []);
    const first = await store.mutate(root, 0, create('m1'));
    assert.equal(first.revision, 1);
    assert.equal(first.checkpoints[0].status, 'unknown');
    await assert.rejects(store.mutate(root, 0, create('m2')), /Stale Roadmap revision/);
    await assert.rejects(store.mutate(root, 1, create('m1')), /already exists/);
    await assert.rejects(store.mutate(root, 1, create('m2'), 'foreign'), /identity changed/);
    await assert.rejects(store.mutate(root, 1, { ...create('bad'), order: -1 }), /Invalid Roadmap index/);
    await assert.rejects(store.mutate(root, 1, { ...create('bad'), dependencies: ['missing'] }), /missing dependency/);
    assert.equal((await new RoadmapStore().read(root)).revision, 1);
    assert.equal(events.length, 1);
    assert.deepEqual((events[0] as { changedIds: string[] }).changedIds, ['m1']);
    const unchanged = await store.mutate(root, 1, { type: 'update', id: 'm1', title: 'm1', objective: '', order: 0,
        dependencies: [], links: [] }, first.projectId);
    assert.equal(unchanged.revision, 1);
    assert.equal(events.length, 1);
    const second = await store.mutate(root, 1, create('m2'), first.projectId);
    assert.equal(second.revision, 2);
    assert.deepEqual((await new RoadmapStore().read(root)).checkpoints.map(item => item.id), ['m1', 'm2']);
    assert.deepEqual((events[1] as { changedIds: string[] }).changedIds, ['m2']);
}));

test('corruption, unsupported version, oversized and symlink state fail closed', async () => fixture(async root => {
    const store = new RoadmapStore();
    const snapshot = await store.mutate(root, 0, create('m1'));
    const file = join(root, '.dope/roadmap.json');
    const original = await readFile(file);
    await writeFile(file, '{');
    await assert.rejects(store.read(root), /Corrupt or unsupported/);
    await assert.rejects(store.mutate(root, 1, create('m2')), /Corrupt or unsupported/);
    await writeFile(file, JSON.stringify({ ...snapshot, schemaVersion: 99 }));
    await assert.rejects(store.read(root), /Corrupt or unsupported/);
    await writeFile(file, Buffer.alloc(4 * 1024 * 1024 + 1));
    await assert.rejects(store.read(root), /size limit/);
    await rm(file);
    await symlink(join(root, 'elsewhere'), file);
    await assert.rejects(store.read(root), /Unsafe Roadmap file/);
    await rm(file);
    await writeFile(file, original);
    assert.equal((await store.read(root)).projectId, snapshot.projectId);
}));

test('stale process lock from a crash is recovered without replacing a live lock', async () => fixture(async root => {
    const store = new RoadmapStore();
    const first = await store.mutate(root, 0, create('m1'));
    const lock = join(root, '.dope/roadmap.lock');
    await writeFile(lock, `${process.pid}\n`);
    await assert.rejects(store.mutate(root, 1, create('m2'), first.projectId), /Roadmap locked/);
    await writeFile(lock, '99999999\n');
    const second = await store.mutate(root, 1, create('m2'), first.projectId);
    assert.equal(second.revision, 2);
    await assert.rejects(readFile(lock), /ENOENT/);
}));

test('project copy and symlink root cannot adopt another project identity', async () => fixture(async root => {
    const store = new RoadmapStore();
    const original = await store.mutate(root, 0, create('m1'));
    const copy = await mkdtemp(join(tmpdir(), 'dope-roadmap-copy-'));
    try {
        await mkdir(join(copy, '.dope'));
        await writeFile(join(copy, '.dope/roadmap.json'), await readFile(join(root, '.dope/roadmap.json')));
        await assert.rejects(store.read(copy), /Corrupt or unsupported/);
        await assert.rejects(store.mutate(copy, 1, create('m2'), original.projectId), /Corrupt or unsupported/);
        const linked = `${copy}-link`;
        await symlink(root, linked);
        try { await assert.rejects(store.read(linked), /canonical local root/); }
        finally { await rm(linked); }
    } finally { await rm(copy, { recursive: true, force: true }); }
}));

test('explicit preview acceptance keeps stable IDs and original Markdown bytes', async () => fixture(async root => {
    await mkdir(join(root, 'docs/roadmap'), { recursive: true });
    const path = join(root, 'docs/roadmap/mvp-roadmap.md');
    await writeFile(path, '# Roadmap\n## Product Phase 1 — One\nStatus: **NOT GREEN**\n');
    const before = await readFile(path);
    const store = new RoadmapStore();
    const preview = await previewRoadmapImport(root);
    assert.equal((await store.read(root)).revision, 0);
    const accepted = await store.acceptImport(root, 0, preview);
    assert.equal(accepted.revision, 1);
    assert.equal(accepted.checkpoints[0].id, preview.checkpoints[0].id);
    assert.equal(accepted.checkpoints[0].status, 'not-green');
    assert.equal(accepted.checkpoints[0].readOnly, false);
    await assert.rejects(store.mutate(root, 1, { type: 'update', id: accepted.checkpoints[0].id, title: 'rewrite',
        objective: '', order: 0, dependencies: [], links: [] }), /Markdown owns/);
    assert.deepEqual(await readFile(path), before);
    const repeat = await store.acceptImport(root, 1, preview, accepted.projectId);
    assert.equal(repeat.revision, 1);
    await writeFile(path, '# Roadmap\n## Product Phase 1 — One\nStatus: **GREEN**\n');
    await assert.rejects(store.acceptImport(root, 1, preview, accepted.projectId), /Stale Roadmap import preview/);
    assert.equal((await store.read(root)).revision, 1);
    await assert.rejects(store.mutate(root, 1, { type: 'update', id: accepted.checkpoints[0].id,
        title: accepted.checkpoints[0].title, objective: 'Roadmap-owned objective', order: 0,
        dependencies: [], links: [] }, accepted.projectId), /Stale Roadmap source/);
    const refreshed = await store.acceptImport(root, 1, await previewRoadmapImport(root), accepted.projectId);
    assert.equal(refreshed.revision, 2);
    assert.equal(refreshed.checkpoints[0].id, accepted.checkpoints[0].id);
    assert.equal(refreshed.checkpoints[0].status, 'green');
    assert.equal(refreshed.checkpoints[0].readOnly, false);
    const edited = await store.mutate(root, 2, { type: 'update', id: refreshed.checkpoints[0].id,
        title: refreshed.checkpoints[0].title, objective: 'Roadmap-owned objective', order: 0,
        dependencies: [], links: [] }, refreshed.projectId);
    assert.equal(edited.checkpoints[0].objective, 'Roadmap-owned objective');
    assert.equal(edited.checkpoints[0].title, refreshed.checkpoints[0].title);
}));

test('duplicate source headings cannot create duplicate IDs or editable prose', async () => fixture(async root => {
    await mkdir(join(root, 'docs/roadmap'), { recursive: true });
    await writeFile(join(root, 'docs/roadmap/mvp-roadmap.md'), '# Roadmap\n## Product Phase 1 — One\nStatus: GREEN\n## Product Phase 1 — Two\nStatus: GREEN\n');
    const store = new RoadmapStore();
    const preview = await previewRoadmapImport(root);
    const result = await store.acceptImport(root, 0, preview);
    assert.equal(result.revision, 0);
    assert.deepEqual(result.checkpoints, []);
}));

test('unsupported source status stays read-only after explicit import', async () => fixture(async root => {
    await mkdir(join(root, 'docs/roadmap'), { recursive: true });
    await writeFile(join(root, 'docs/roadmap/mvp-roadmap.md'), '# Roadmap\n## Product Phase 2 — Two\nStatus: PENDING REVIEW\n');
    const store = new RoadmapStore();
    const accepted = await store.acceptImport(root, 0, await previewRoadmapImport(root));
    assert.equal(accepted.checkpoints[0].readOnly, true);
    await assert.rejects(store.mutate(root, 1, { type: 'update', id: accepted.checkpoints[0].id,
        title: accepted.checkpoints[0].title, objective: 'edit', order: 0, dependencies: [], links: [] }), /read-only/);
}));
