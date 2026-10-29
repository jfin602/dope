import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { gateFixture, sha, source } from './roadmap-gate-document-fixture.ts';

test('external mapped edit reviews and syncs into the one Gate owner after restart', async () => gateFixture(async (root, file, store) => {
    const first = await store.read(root);
    const external = source.replace('Objective: Prove first', 'Objective: Prove externally')
        .replace('Unmapped prose stays.', 'Unmapped prose stays. More detail.');
    await writeFile(file, external);
    const preview = await store.previewGateDocumentSync(root);
    assert.equal(preview.state, 'source-changed');
    assert.deepEqual(preview.changes.map(change => [change.kind, change.field]), [['gate', 'detail']]);
    assert.equal((await store.read(root)).revision, first.revision);
    await store.applyGateDocumentSync(root, preview, false);
    assert.equal((await store.read(root)).revision, first.revision);
    const next = await new RoadmapStore().applyGateDocumentSync(root, preview, true);
    assert.equal(next.gates[0].purpose, 'Prove externally');
    assert.equal(sha(await readFile(file)), sha(external));
    assert.equal((await new RoadmapStore().previewGateDocumentSync(root)).state, 'unchanged');
}));

test('ambiguous mapped source and stale preview cannot sync', async () => gateFixture(async (root, file, store) => {
    const first = await store.read(root);
    await writeFile(file, source.replace('Objective: Prove first', 'Objective: External'));
    const preview = await store.previewGateDocumentSync(root);
    await writeFile(file, source.replace('Objective: Prove first', 'Objective: Newer'));
    await assert.rejects(store.applyGateDocumentSync(root, preview, true), /Stale/);
    const ambiguous = source.replace('Objective: Prove first', 'Objective: External\r\nObjective: Duplicate');
    await writeFile(file, ambiguous);
    assert.equal((await store.previewGateDocumentSync(root)).state, 'conflict');
    assert.equal((await store.read(root)).revision, first.revision);
    assert.equal(sha(await readFile(file)), sha(ambiguous));
}));

test('task prose changes sync without creating Gates; structural reassignment stays conflicted', async () => gateFixture(async (root, file, store) => {
    const external = source.replace('Build task, not a Gate', 'Build a different task');
    await writeFile(file, external);
    const preview = await store.previewGateDocumentSync(root);
    assert.equal(preview.state, 'source-changed');
    assert.deepEqual(preview.changes, []);
    const next = await store.applyGateDocumentSync(root, preview, true);
    assert.equal(next.gates.length, 1);
    assert.equal(next.gates[0].criteria.length, 1);
    assert.equal(sha(await readFile(file)), sha(external));
    const changedDesignation = external.replace('Gate G1', 'Gate G2');
    await writeFile(file, changedDesignation);
    assert.equal((await store.previewGateDocumentSync(root)).state, 'conflict');
    assert.equal((await store.read(root)).gates[0].designation, 'G1');
}));
