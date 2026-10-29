import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { gateFixture, sha, source } from './roadmap-gate-document-fixture.ts';

test('restarted pending patch settles only exact approved document bytes', async () => gateFixture(async (root, file, store) => {
    const first = await store.read(root);
    const patch = await store.previewGateDocumentPatch(root, { kind: 'criterion', id: 'criterion-one',
        sourceHash: first.linkedDocument!.sourceHash, detail: 'one is reviewed' });
    const marker = { ...first, revision: first.revision + 1, linkedDocument: { ...first.linkedDocument!,
        syncState: 'pending-sync', pending: { basisRevision: first.revision, beforeHash: patch.beforeHash,
            afterHash: patch.afterHash, edit: { kind: 'criterion', id: 'criterion-one', detail: 'one is reviewed' },
            outcome: 'document-written' } } };
    await writeFile(join(root, '.dope/roadmap.json'), JSON.stringify(marker));
    await writeFile(file, patch.after);
    const settled = await new RoadmapStore().recoverGateDocumentPatch(root, true);
    assert.equal(settled.gates[0].criteria[0].expectedResult, 'one is reviewed');
    assert.equal(settled.linkedDocument!.pending, undefined);
    assert.equal((await new RoadmapStore().previewGateDocumentSync(root)).state, 'unchanged');
}));

test('unknown post-crash source is retained as conflict with byte hash intact', async () => gateFixture(async (root, file, store) => {
    const first = await store.read(root);
    const patch = await store.previewGateDocumentPatch(root, { kind: 'gate', id: 'gate-one',
        sourceHash: first.linkedDocument!.sourceHash, detail: 'Prove approved' });
    const marker = { ...first, revision: first.revision + 1, linkedDocument: { ...first.linkedDocument!,
        syncState: 'pending-sync', pending: { basisRevision: first.revision, beforeHash: patch.beforeHash,
            afterHash: patch.afterHash, edit: { kind: 'gate', id: 'gate-one', detail: 'Prove approved' },
            outcome: 'prepared' } } };
    await writeFile(join(root, '.dope/roadmap.json'), JSON.stringify(marker));
    const external = patch.after + 'Independent source edit.\r\n';
    await writeFile(file, external);
    const conflict = await new RoadmapStore().recoverGateDocumentPatch(root, true);
    assert.equal(conflict.linkedDocument!.pending!.outcome, 'conflict');
    assert.equal(sha(await readFile(file)), sha(external));
}));

test('verified pending backup restores a source moved by interrupted publication', async () => gateFixture(async (root, file, store) => {
    const first = await store.read(root);
    const patch = await store.previewGateDocumentPatch(root, { kind: 'gate', id: 'gate-one',
        sourceHash: first.linkedDocument!.sourceHash, detail: 'Prove approved' });
    const marker = { ...first, revision: first.revision + 1, linkedDocument: { ...first.linkedDocument!,
        syncState: 'pending-sync', pending: { basisRevision: first.revision, beforeHash: patch.beforeHash,
            afterHash: patch.afterHash, edit: { kind: 'gate', id: 'gate-one', detail: 'Prove approved' },
            outcome: 'prepared' } } };
    await writeFile(join(root, '.dope/roadmap.json'), JSON.stringify(marker));
    await writeFile(`${file}.dope-pending-backup`, source);
    await rm(file);
    const recovered = await new RoadmapStore().recoverGateDocumentPatch(root, true);
    assert.equal(recovered.linkedDocument!.syncState, 'synced');
    assert.equal(sha(await readFile(file)), sha(source));
    assert.equal(recovered.gates[0].purpose, 'Prove first');
}));
