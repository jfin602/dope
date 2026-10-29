import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { gateFixture, sha, source } from './roadmap-gate-document-fixture.ts';

test('document patch preview requires separate approval and changes one mapped line', async () => gateFixture(async (root, file, store) => {
    const first = await store.read(root);
    const patch = await store.previewGateDocumentPatch(root, { kind: 'criterion', id: 'criterion-one',
        sourceHash: first.linkedDocument!.sourceHash, detail: 'one is reviewed' });
    assert.equal(patch.changedLines.length, 1);
    assert.equal(patch.requiresApproval, true);
    assert.equal(sha(await readFile(file)), sha(source));
    await store.publishGateDocumentPatch(root, patch, false);
    assert.equal(sha(await readFile(file)), sha(source));
    const next = await store.publishGateDocumentPatch(root, patch, true);
    assert.equal(next.gates[0].criteria[0].expectedResult, 'one is reviewed');
    assert.equal((await readFile(file, 'utf8')).replace('one is reviewed', 'one is visible'), source);
}));

test('source drift after preview refuses publication without changing either owner', async () => gateFixture(async (root, file, store) => {
    const first = await store.read(root);
    const patch = await store.previewGateDocumentPatch(root, { kind: 'gate', id: 'gate-one',
        sourceHash: first.linkedDocument!.sourceHash, detail: 'Prove approved' });
    const external = source.replace('Unmapped prose stays.', 'Unmapped prose changed.');
    await writeFile(file, external);
    await assert.rejects(store.publishGateDocumentPatch(root, patch, true), /Stale/);
    assert.equal(sha(await readFile(file)), sha(external));
    assert.equal((await store.read(root)).revision, first.revision);
}));

test('competing write at publication is preserved and leaves recoverable pending intent', async () => gateFixture(async (root, file, store) => {
    const first = await store.read(root);
    const patch = await store.previewGateDocumentPatch(root, { kind: 'gate', id: 'gate-one',
        sourceHash: first.linkedDocument!.sourceHash, detail: 'Prove approved' });
    const external = source.replace('Objective: Prove first', 'Objective: Prove externally');
    const fs = createRequire(import.meta.url)('node:fs/promises') as typeof import('node:fs/promises');
    const originalRename = fs.rename;
    let injected = false;
    (fs as { rename: typeof fs.rename }).rename = async (from, to) => {
        if (!injected && from === file && typeof to === 'string' && to.endsWith('.dope-pending-backup')) {
            injected = true;
            await writeFile(file, external);
        }
        return originalRename(from, to);
    };
    try { await assert.rejects(store.publishGateDocumentPatch(root, patch, true), /pending sync/); }
    finally { (fs as { rename: typeof fs.rename }).rename = originalRename; }
    assert.equal(injected, true);
    assert.equal(sha(await readFile(file)), sha(external));
    assert.equal((await store.read(root)).linkedDocument!.syncState, 'pending-sync');
    const conflict = await new RoadmapStore().recoverGateDocumentPatch(root, true);
    assert.equal(conflict.linkedDocument!.pending!.outcome, 'conflict');
    assert.equal(sha(await readFile(file)), sha(external));
}));
