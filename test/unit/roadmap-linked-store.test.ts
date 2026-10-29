import assert from 'node:assert/strict';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { gateFixture, sha, source } from './roadmap-gate-document-fixture.ts';

test('schema-two import persists stable linked section identities without rewriting source', async () => gateFixture(async (root, file, store) => {
    const saved = await new RoadmapStore().read(root);
    assert.equal(saved.schemaVersion, 2);
    assert.deepEqual(saved.linkedDocument!.sections.map(section => [section.kind, section.id]),
        [['phase', 'phase-one'], ['gate', 'gate-one'], ['criterion', 'criterion-one']]);
    assert.equal(saved.linkedDocument!.lastSynced!.sourceHash, sha(source));
    assert.equal(sha(await readFile(file)), sha(source));
}));

test('missing linked source needs exact approved relink; changed candidate stays review-only', async () => gateFixture(async (root, file, store) => {
    const moved = join(root, 'MOVED.md');
    await rename(file, moved);
    assert.equal((await store.previewGateDocumentSync(root)).state, 'relink-needed');
    const preview = await store.previewGateRelink(root, 'MOVED.md');
    assert.equal(preview.state, 'ready');
    await store.applyGateRelink(root, preview, false);
    assert.equal((await store.read(root)).linkedDocument!.path, 'ROADMAP.md');
    const next = await store.applyGateRelink(root, preview, true);
    assert.equal(next.linkedDocument!.path, 'MOVED.md');
    assert.equal(sha(await readFile(moved)), sha(source));
    await rename(moved, file);
    await writeFile(file, source + 'External edit.\r\n');
    assert.equal((await store.previewGateRelink(root, 'ROADMAP.md')).state, 'review');
    assert.equal((await store.read(root)).linkedDocument!.path, 'MOVED.md');
}));
