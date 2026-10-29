import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';

const source = `# Roadmap\r\nUnrelated introduction.\r\n## Phase 1 [id: phase-one]: First\r\nObjective: Deliver first\r\n### Gate G1 [id: gate-one] [phase: phase-one]: Check first\r\nObjective: Prove first\r\n- Criterion C1 [id: criterion-one]: Result one — Expected: one is visible\r\nUnrelated **prose**.\r\n- [ ] Build task, not a Gate\r\n`;
const sha = (value: Buffer | string): string => createHash('sha256').update(value).digest('hex');
async function fixture(run: (root: string, file: string, store: RoadmapStore) => Promise<void>) {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-document-'));
    const file = join(root, 'ROADMAP.md');
    try {
        await writeFile(file, source);
        const store = new RoadmapStore();
        await store.acceptGateImport(root, 0, 'project-one', await previewRoadmapImport(root, 'ROADMAP.md'));
        await run(root, file, store);
    } finally { await rm(root, { recursive: true, force: true }); }
}

test('approved criterion patch preserves unrelated bytes and external sync survives restart', async () => fixture(async (root, file, store) => {
    const before = await readFile(file);
    const first = await store.read(root);
    const patch = await store.previewGateDocumentPatch(root, { kind: 'criterion', id: 'criterion-one',
        sourceHash: first.linkedDocument!.sourceHash, detail: 'one is reviewed' });
    assert.equal(patch.requiresApproval, true);
    assert.equal(patch.changedLines.length, 1);
    assert.equal(sha(await readFile(file)), sha(before));
    await store.publishGateDocumentPatch(root, patch, false);
    assert.equal(sha(await readFile(file)), sha(before));
    const published = await store.publishGateDocumentPatch(root, patch, true);
    assert.equal(published.gates[0].criteria[0].expectedResult, 'one is reviewed');
    assert.equal((await readFile(file, 'utf8')).replace('one is reviewed', 'one is visible'), source);
    assert.equal(published.linkedDocument!.lastSynced!.sourceHash, sha(await readFile(file)));
    const external = (await readFile(file, 'utf8')).replace('Objective: Prove first', 'Objective: Prove externally')
        .replace('Unrelated **prose**.', 'Unrelated **prose**. More detail.');
    await writeFile(file, external);
    const preview = await new RoadmapStore().previewGateDocumentSync(root);
    assert.equal(preview.state, 'source-changed');
    assert.deepEqual(preview.changes.map(change => [change.kind, change.field]), [['gate', 'detail']]);
    const synced = await new RoadmapStore().applyGateDocumentSync(root, preview, true);
    assert.equal(synced.gates[0].purpose, 'Prove externally');
    assert.equal(sha(await readFile(file)), sha(external));
    assert.equal((await new RoadmapStore().previewGateDocumentSync(root)).state, 'unchanged');
}));

test('foreign, stale, conflict and rejected previews never write source', async () => fixture(async (root, file, store) => {
    const first = await store.read(root);
    const before = await readFile(file);
    await assert.rejects(store.previewGateDocumentPatch(root, { kind: 'gate', id: 'gate-one',
        sourceHash: '0'.repeat(64), detail: 'No' }), /Stale/);
    const patch = await store.previewGateDocumentPatch(root, { kind: 'gate', id: 'gate-one',
        sourceHash: first.linkedDocument!.sourceHash, detail: 'Prove better' });
    await assert.rejects(store.publishGateDocumentPatch(root, { ...patch, projectId: 'foreign' }, true), /owner or revision/);
    assert.equal(sha(await readFile(file)), sha(before));
    await writeFile(file, source.replace('Objective: Prove first', 'Objective: external'));
    await assert.rejects(store.publishGateDocumentPatch(root, patch, true), /Stale/);
    const preview = await store.previewGateDocumentSync(root);
    await store.applyGateDocumentSync(root, preview, false);
    assert.equal((await store.read(root)).revision, first.revision);
    await writeFile(file, source.replace('Objective: Prove first', 'Objective: external\r\nObjective: duplicate'));
    assert.equal((await store.previewGateDocumentSync(root)).state, 'conflict');
    assert.equal((await store.read(root)).revision, first.revision);
}));

test('missing source requires exact approved relink', async () => fixture(async (root, file, store) => {
    const first = await store.read(root);
    const moved = join(root, 'MOVED.md');
    await rename(file, moved);
    assert.equal((await store.previewGateDocumentSync(root)).state, 'relink-needed');
    const preview = await store.previewGateRelink(root, 'MOVED.md');
    assert.equal(preview.state, 'ready');
    await store.applyGateRelink(root, preview, false);
    assert.equal((await store.read(root)).linkedDocument!.path, 'ROADMAP.md');
    const relinked = await store.applyGateRelink(root, preview, true);
    assert.equal(relinked.linkedDocument!.path, 'MOVED.md');
    assert.equal(sha(await readFile(moved)), sha(source));
    assert.equal((await store.previewGateDocumentSync(root)).state, 'unchanged');
    assert.notEqual(first.revision, relinked.revision);
}));

test('phase and Gate headings retain stable IDs and publication is a separate approval', async () => fixture(async (root, file, store) => {
    const first = await store.read(root);
    const phase = await store.previewGateDocumentPatch(root, { kind: 'phase', id: 'phase-one',
        sourceHash: first.linkedDocument!.sourceHash, title: 'Revised phase' });
    const revised = await store.publishGateDocumentPatch(root, phase, true);
    assert.equal(revised.phases[0].title, 'Revised phase');
    assert.equal(revised.linkedDocument!.sections[0].sectionKey, 'phase-one');
    const gate = await store.previewGateDocumentPatch(root, { kind: 'gate', id: 'gate-one',
        sourceHash: revised.linkedDocument!.sourceHash, title: 'Revised gate', detail: 'Prove revised' });
    const published = await store.publishGateDocumentPatch(root, gate, true);
    assert.equal(published.gates[0].purpose, 'Prove revised');
    assert.equal(published.gates[0].title, 'Revised gate');
    assert.match(await readFile(file, 'utf8'), /\[id: gate-one\] \[phase: phase-one\]: Revised gate/);
    assert.match(await readFile(file, 'utf8'), /Unrelated \*\*prose\*\*\./);
}));

test('interrupted approved patch settles from exact after-hash and rejects unknown bytes', async () => fixture(async (root, file, store) => {
    const first = await store.read(root);
    const patch = await store.previewGateDocumentPatch(root, { kind: 'criterion', id: 'criterion-one',
        sourceHash: first.linkedDocument!.sourceHash, detail: 'one is reviewed' });
    const indexFile = join(root, '.dope', 'roadmap.json');
    const marker = { ...first, revision: first.revision + 1, linkedDocument: { ...first.linkedDocument!,
        syncState: 'pending-sync', pending: { basisRevision: first.revision, beforeHash: patch.beforeHash,
            afterHash: patch.afterHash, edit: { kind: 'criterion', id: 'criterion-one', detail: 'one is reviewed' },
            outcome: 'document-written' } } };
    await writeFile(indexFile, JSON.stringify(marker));
    await writeFile(file, patch.after);
    const settled = await new RoadmapStore().recoverGateDocumentPatch(root, true);
    assert.equal(settled.gates[0].criteria[0].expectedResult, 'one is reviewed');
    assert.equal(settled.linkedDocument!.pending, undefined);
    assert.equal((await new RoadmapStore().previewGateDocumentSync(root)).state, 'unchanged');
    const second = { ...settled, revision: settled.revision + 1, linkedDocument: { ...settled.linkedDocument!,
        syncState: 'pending-sync', pending: { basisRevision: settled.revision, beforeHash: patch.afterHash,
            afterHash: 'f'.repeat(64), edit: { kind: 'criterion', id: 'criterion-one', detail: 'unknown' },
            outcome: 'prepared' } } };
    await writeFile(indexFile, JSON.stringify(second));
    const external = patch.after + 'External task prose.\r\n';
    await writeFile(file, external);
    const conflict = await new RoadmapStore().recoverGateDocumentPatch(root, true);
    assert.equal(conflict.linkedDocument!.pending!.outcome, 'conflict');
    assert.equal(sha(await readFile(file)), sha(external));
}));
