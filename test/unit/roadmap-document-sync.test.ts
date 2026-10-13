import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';

const path = 'docs/roadmap/mvp-roadmap.md';
const original = '# Roadmap\r\nIntro stays.\r\n## Product Phase 1 — One\r\nStatus: **NOT GREEN**\r\nObjective: old\r\nOrder: 1\r\nUnmapped note.\r\n';
async function fixture(run: (root: string, file: string, store: RoadmapStore) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-sync-'));
    const file = join(root, path);
    try {
        await mkdir(join(root, 'docs/roadmap'), { recursive: true });
        await writeFile(file, original);
        await run(root, file, new RoadmapStore());
    } finally { await rm(root, { recursive: true, force: true }); }
}
async function accepted(root: string, store: RoadmapStore) {
    return store.acceptImport(root, 0, await previewRoadmapImport(root));
}

test('external mapped edit previews deterministically and applies without writing Markdown or changing status', async () => fixture(async (root, file, store) => {
    const first = await accepted(root, store);
    assert.equal(first.checkpoints[0].objective, 'old');
    const edited = original.replace('Objective: old', 'Objective: external').replace('Unmapped note.', 'Unmapped note. Extra text.');
    await writeFile(file, edited);
    const preview = await store.previewDocumentSync(root);
    assert.equal(preview.state, 'source-changed');
    assert.deepEqual(preview.changes.map(change => [change.field, change.accepted, change.source]), [['objective', 'old', 'external']]);
    assert.equal((await store.read(root)).revision, first.revision);
    const events: { revision: number; changedIds: string[] }[] = [];
    const off = store.onChange(change => events.push(change));
    const next = await store.applyDocumentSync(root, preview);
    off();
    assert.equal(next.checkpoints[0].objective, 'external');
    assert.equal(next.checkpoints[0].status, 'not-green');
    assert.equal(next.linkedDocument?.syncState, 'synced');
    assert.deepEqual(events.map(({ revision, changedIds }) => ({ revision, changedIds })),
        [{ revision: next.revision, changedIds: [next.checkpoints[0].id] }]);
    assert.equal((await store.previewDocumentSync(root)).state, 'unchanged');
    assert.equal(await readFile(file, 'utf8'), edited);
}));

test('independent Roadmap owner change and external prose reconcile at checked revision', async () => fixture(async (root, file, store) => {
    const first = await accepted(root, store);
    const linked = await store.mutate(root, first.revision, { type: 'update', id: first.checkpoints[0].id,
        title: first.checkpoints[0].title, objective: first.checkpoints[0].objective, order: first.checkpoints[0].order,
        dependencies: [], links: [{ owner: 'issue', targetId: 'issue-1' }] }, first.projectId);
    const edited = original.replace('Objective: old', 'Objective: external');
    await writeFile(file, edited);
    const preview = await store.previewDocumentSync(root);
    assert.equal(preview.state, 'source-changed');
    const next = await store.applyDocumentSync(root, preview);
    assert.equal(next.checkpoints[0].objective, 'external');
    assert.deepEqual(next.checkpoints[0].links, linked.checkpoints[0].links);
    assert.equal(await readFile(file, 'utf8'), edited);
}));

test('unmapped document change updates only the source basis and preserves qualification truth', async () => fixture(async (root, file, store) => {
    const first = await accepted(root, store);
    const edited = original.replace('Unmapped note.', 'Unmapped note. More detail.').replace('NOT GREEN', 'GREEN');
    await writeFile(file, edited);
    const preview = await store.previewDocumentSync(root);
    assert.equal(preview.state, 'source-changed');
    assert.deepEqual(preview.changes, []);
    const next = await store.applyDocumentSync(root, preview);
    assert.equal(next.checkpoints[0].status, first.checkpoints[0].status);
    assert.equal(await readFile(file, 'utf8'), edited);
}));

test('overlap, ambiguity and moved section refuse apply and leave source untouched', async () => fixture(async (root, file, store) => {
    await accepted(root, store);
    const ambiguous = original.replace('Objective: old', 'Objective: external\r\nObjective: duplicate');
    await writeFile(file, ambiguous);
    const preview = await store.previewDocumentSync(root);
    assert.equal(preview.state, 'conflict');
    await assert.rejects(store.applyDocumentSync(root, preview), /No applicable/);
    assert.equal(await readFile(file, 'utf8'), ambiguous);
    await writeFile(file, original.replace('Product Phase 1', 'Product Phase 9'));
    assert.equal((await store.previewDocumentSync(root)).state, 'conflict');
    assert.equal(await readFile(file, 'utf8'), original.replace('Product Phase 1', 'Product Phase 9'));
}));

test('overlapping source and index edits produce a conflict preview without damaging either owner', async () => fixture(async (root, file, store) => {
    await accepted(root, store);
    const indexFile = join(root, '.dope/roadmap.json');
    const index = JSON.parse(await readFile(indexFile, 'utf8'));
    index.revision++;
    index.checkpoints[0].objective = 'local';
    await writeFile(indexFile, `${JSON.stringify(index)}\n`);
    const edited = original.replace('Objective: old', 'Objective: external');
    await writeFile(file, edited);
    const preview = await store.previewDocumentSync(root);
    assert.equal(preview.state, 'conflict');
    assert.equal(preview.changes[0].conflict, true);
    await assert.rejects(store.applyDocumentSync(root, preview), /No applicable/);
    assert.equal((await store.read(root)).checkpoints[0].objective, 'local');
    assert.equal(await readFile(file, 'utf8'), edited);
}));

test('source or Roadmap changes after preview deny stale apply; missing file asks for relink', async () => fixture(async (root, file, store) => {
    const first = await accepted(root, store);
    await writeFile(file, original.replace('Objective: old', 'Objective: changed'));
    const preview = await store.previewDocumentSync(root);
    const newer = original.replace('Objective: old', 'Objective: newer');
    await writeFile(file, newer);
    await assert.rejects(store.applyDocumentSync(root, preview), /Stale linked Roadmap sync preview/);
    assert.equal(await readFile(file, 'utf8'), newer);
    const fresh = await store.previewDocumentSync(root);
    await store.mutate(root, first.revision, { type: 'create', id: 'manual', kind: 'milestone', title: 'Manual', objective: '', order: 3 }, first.projectId);
    await assert.rejects(store.applyDocumentSync(root, fresh), /Stale Roadmap revision/);
    assert.equal(await readFile(file, 'utf8'), newer);
    await rm(file);
    assert.equal((await store.previewDocumentSync(root)).state, 'relink-needed');
    assert.equal((await store.read(root)).checkpoints.length, 2);
}));

test('explicit relink of identical moved bytes changes only owner references after approval', async () => fixture(async (root, file, store) => {
    const first = await accepted(root, store);
    const moved = join(root, 'docs/roadmap/MOVED.md');
    await rename(file, moved);
    const preview = await store.previewRelink(root, 'docs/roadmap/MOVED.md');
    assert.equal(preview.state, 'ready');
    assert.equal(preview.sourceHash, first.linkedDocument?.sourceHash);
    assert.equal(preview.sections[0].checkpointId, first.linkedDocument?.sections[0].checkpointId);
    assert.equal((await store.applyRelink(root, preview, false)).revision, first.revision);
    assert.equal((await store.read(root)).linkedDocument?.path, path);
    const next = await store.applyRelink(root, preview, true);
    assert.equal(next.revision, first.revision + 1);
    assert.equal(next.linkedDocument?.path, 'docs/roadmap/MOVED.md');
    assert.equal(next.linkedDocument?.syncState, 'synced');
    assert.equal(next.checkpoints[0].source?.path, 'docs/roadmap/MOVED.md');
    assert.deepEqual(next.checkpoints.map(item => [item.id, item.title, item.status]),
        first.checkpoints.map(item => [item.id, item.title, item.status]));
    assert.equal(await readFile(moved, 'utf8'), original);
    assert.equal((await store.previewDocumentSync(root)).state, 'unchanged');
    await assert.rejects(store.applyRelink(root, preview, true), /Stale Roadmap revision/);
}));

test('relink rejects unsafe, missing, changed and stale candidates without touching either owner', async () => fixture(async (root, file, store) => {
    const first = await accepted(root, store);
    const moved = join(root, 'docs/roadmap/MOVED.md');
    await rename(file, moved);
    await assert.rejects(store.previewRelink(root, '../foreign.md'), /Unsafe linked Roadmap path/);
    await assert.rejects(store.previewRelink(root, '/tmp/foreign.md'), /Unsafe linked Roadmap path/);
    await assert.rejects(store.previewRelink(root, '.dope/roadmap.md'), /Unsafe linked Roadmap path/);
    await assert.rejects(store.previewRelink(root, 'missing.md'), /ENOENT/);
    await symlink(moved, join(root, 'alias.md'));
    await assert.rejects(store.previewRelink(root, 'alias.md'), /Unsafe linked Roadmap symlink/);
    const ready = await store.previewRelink(root, 'docs/roadmap/MOVED.md');
    await writeFile(moved, original.replace('Objective: old', 'Objective: changed'));
    assert.equal((await store.previewRelink(root, 'docs/roadmap/MOVED.md')).state, 'review');
    await assert.rejects(store.applyRelink(root, ready, true), /Stale linked Roadmap relink preview/);
    await writeFile(moved, original);
    const fresh = await store.previewRelink(root, 'docs/roadmap/MOVED.md');
    await store.mutate(root, first.revision, { type: 'create', id: 'manual', kind: 'milestone',
        title: 'Manual', objective: '', order: 2 }, first.projectId);
    await assert.rejects(store.applyRelink(root, fresh, true), /Stale Roadmap revision/);
    assert.equal((await store.read(root)).linkedDocument?.path, path);
    assert.equal(await readFile(moved, 'utf8'), original);
}));

test('same bytes with ambiguous mapped section identities require separate review', async () => fixture(async (root, file, store) => {
    await writeFile(file, `${original}## Phase 1 — alternate\r\nObjective: other\r\n`);
    const first = await accepted(root, store);
    const moved = join(root, 'docs/roadmap/MOVED.md');
    await rename(file, moved);
    const preview = await store.previewRelink(root, 'docs/roadmap/MOVED.md');
    assert.equal(preview.state, 'review');
    assert.match(preview.diagnostics.join(' '), /ambiguous/i);
    await assert.rejects(store.applyRelink(root, preview, true), /safe approved preview/);
    assert.equal((await store.read(root)).revision, first.revision);
    assert.equal((await store.read(root)).linkedDocument?.path, path);
}));
