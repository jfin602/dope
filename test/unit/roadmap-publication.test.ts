import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { readGateMappedDocument } from '../../packages/project-intelligence/lib/node/roadmap-gate-document.js';

const fixture = async (run: (root: string, store: RoadmapStore) => Promise<void>) => {
    const root = await mkdtemp(join(tmpdir(), 'dope-publish-'));
    try {
        const store = new RoadmapStore();
        await store.saveGateIndex(root, 0, 'uninitialized', {
            schemaVersion: 2, projectId: 'publish-owner', projectRoot: root, revision: 1,
            phases: [{ id: 'phase-one', projectId: 'publish-owner', title: 'First Phase',
                objective: 'Deliver the result', order: 0, dependencies: [], implementationStatus: 'unknown',
                qualificationStatus: 'unknown', draftAcceptance: 'accepted', gateSetCoverage: { status: 'unreviewed' } }],
            gates: [1, 2].map((number, order) => ({ id: `gate-${number}`, projectId: 'publish-owner',
                parentPhaseId: 'phase-one', designation: `G${number}`, title: `Gate ${number}`,
                purpose: `Verify result ${number}`, order, dependencies: number === 2 ? ['gate-1'] : [],
                criteria: [{ id: `criterion-${number}`, projectId: 'publish-owner', title: `Check ${number}`,
                    expectedResult: `Result ${number} is visible`, order: 0, evidence: [] }],
                implementationStatus: 'unknown' as const, qualificationStatus: 'unknown' as const,
                draftAcceptance: 'accepted' as const })), corrections: [],
        });
        await run(root, store);
    } finally { await rm(root, { recursive: true, force: true }); }
};

test('approved schema-2 publication round-trips and remains qualification-neutral', async () => fixture(async (root, store) => {
    const preview = await store.previewRoadmapPublication(root, 'ROADMAP.md');
    assert.equal(preview.gateCount, 2);
    assert.match(preview.content, /Criterion 1 \[id: criterion-2\]/);
    assert.match(preview.content, /Dependencies: gate-1/);
    assert.match(preview.warnings.join(' '), /unreviewed/);
    await store.applyRoadmapPublication(root, preview, false);
    await assert.rejects(readFile(join(root, 'ROADMAP.md')), /ENOENT/);
    const approved = await store.previewRoadmapPublication(root, 'ROADMAP.md');
    let changes = 0;
    store.onChange(() => { changes++; });
    const result = await store.applyRoadmapPublication(root, approved, true);
    assert.equal(changes, 1);
    assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), approved.content);
    assert.equal(result.linkedDocument?.sourceHash, approved.sourceHash);
    assert.equal(result.linkedDocument?.syncState, 'synced');
    assert.equal(result.phases[0].draftAcceptance, 'published');
    assert.equal(result.phases[0].gateSetCoverage.status, 'unreviewed');
    assert.equal(result.phases[0].qualificationStatus, 'unknown');
    assert.deepEqual(result.gates.map(g => g.qualificationStatus), ['unknown', 'unknown']);
    const mapped = await readGateMappedDocument(root, result.linkedDocument!);
    assert.deepEqual(mapped.fields, approved.fields);
    assert.deepEqual(mapped.diagnostics, []);
    assert.deepEqual(await new RoadmapStore().read(root), result);
    assert.equal((await store.applyRoadmapPublication(root, approved, true)).revision, result.revision);
    assert.equal((await new RoadmapStore().applyRoadmapPublication(root, approved, true)).revision, result.revision);
    await assert.rejects(store.applyRoadmapPublication(root,
        { ...approved, approvalId: 'different-intent' }, true), /Stale/);
    await assert.rejects(store.applyRoadmapPublication(root,
        { ...approved, content: 'changed preview' }, true), /Stale/);
    assert.equal(changes, 1);
}));

test('edited dependency metadata is a source conflict, never silently synchronized', async () => fixture(async (root, store) => {
    const preview = await store.previewRoadmapPublication(root, 'ROADMAP.md');
    await store.applyRoadmapPublication(root, preview, true);
    const source = join(root, 'ROADMAP.md');
    const before = await readFile(source, 'utf8');
    await writeFile(source, before.replace('Dependencies: gate-1', 'Dependencies: none'));
    const sync = await store.previewGateDocumentSync(root);
    assert.equal(sync.state, 'conflict');
    assert.match(sync.diagnostics.join(' '), /topology differs/);
    assert.deepEqual((await store.read<import('../../packages/project-intelligence/lib/node/roadmap-gate-domain.js').RoadmapGateIndex>(root))
        .gates[1].dependencies, ['gate-1']);
}));

test('published mapped text follows the existing reviewed source synchronization', async () => fixture(async (root, store) => {
    const preview = await store.previewRoadmapPublication(root, 'ROADMAP.md');
    const published = await store.applyRoadmapPublication(root, preview, true);
    const source = join(root, 'ROADMAP.md');
    await writeFile(source, (await readFile(source, 'utf8')).replace('Objective: Deliver the result',
        'Objective: Deliver the revised result'));
    const sync = await store.previewGateDocumentSync(root);
    assert.equal(sync.state, 'source-changed');
    assert.deepEqual(sync.changes.map(change => [change.kind, change.id, change.field]),
        [['phase', 'phase-one', 'detail']]);
    const accepted = await store.applyGateDocumentSync(root, sync, true);
    assert.equal(accepted.phases[0].objective, 'Deliver the revised result');
    assert.equal(accepted.linkedDocument?.syncState, 'synced');
    assert.notEqual(accepted.linkedDocument?.sourceHash, published.linkedDocument?.sourceHash);
    assert.equal((await store.previewGateDocumentSync(root)).state, 'unchanged');
}));

test('collision, unsafe path, symlink, stale approval and conflicting review do not publish', async () => fixture(async (root, store) => {
    await writeFile(join(root, 'ROADMAP.md'), 'owner document\n');
    await assert.rejects(store.previewRoadmapPublication(root, 'ROADMAP.md'), /already exists/);
    assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), 'owner document\n');
    for (const path of ['../escape.md', '/tmp/escape.md', '.dope/roadmap.md', 'docs/roadmap.md'])
        await assert.rejects(store.previewRoadmapPublication(root, path), /Unsafe/);
    await symlink(root, join(root, 'alias'));
    await assert.rejects(store.previewRoadmapPublication(root, 'alias/alternate.md'), /Unsafe/);
    const preview = await store.previewRoadmapPublication(root, 'alternate.md');
    await assert.rejects(store.applyRoadmapPublication(root, { ...preview, path: 'tampered.md' }, true), /Stale/);
    await assert.rejects(store.applyRoadmapPublication(root, { ...preview, content: 'tampered' }, true), /Stale/);
    const revision = (await store.read(root)).revision;
    await store.mutateGateIndex(root, revision, 'publish-owner', {
        type: 'gate.edit', id: 'gate-1', title: 'New title', purpose: 'Verify result 1',
    });
    await assert.rejects(store.applyRoadmapPublication(root, preview, true), /Stale/);
    await assert.rejects(readFile(join(root, 'alternate.md')), /ENOENT/);
}));

test('competing destinations cannot publish twice', async () => fixture(async (root, store) => {
    const first = await store.previewRoadmapPublication(root, 'ROADMAP.md');
    const competing = await store.previewRoadmapPublication(root, 'OTHER.md');
    await store.applyRoadmapPublication(root, first, true);
    await assert.rejects(store.applyRoadmapPublication(root, competing, true), /Stale/);
    await assert.rejects(readFile(join(root, 'OTHER.md')), /ENOENT/);
}));

test('approved intent recovers before file creation', async () => fixture(async (root, store) => {
    const preview = await store.previewRoadmapPublication(root, 'ROADMAP.md');
    const owner = store as unknown as { settleRoadmapPublication: (...args: unknown[]) => Promise<unknown> };
    const settle = owner.settleRoadmapPublication;
    owner.settleRoadmapPublication = async () => { throw new Error('injected before file'); };
    await assert.rejects(store.applyRoadmapPublication(root, preview, true), /injected/);
    owner.settleRoadmapPublication = settle;
    assert.equal((await store.read<{ pendingPublication?: unknown } & import('../../packages/project-intelligence/lib/node/roadmap-gate-domain.js').RoadmapGateIndex>(root)).pendingPublication !== undefined, true);
    await assert.rejects(readFile(join(root, 'ROADMAP.md')), /ENOENT/);
    const recovered = await new RoadmapStore().recoverRoadmapPublication(root);
    assert.equal(recovered.linkedDocument?.sourceHash, preview.sourceHash);
    assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), preview.content);
}));

test('approved intent recovers after file creation before linked persistence', async () => fixture(async (root, store) => {
    const preview = await store.previewRoadmapPublication(root, 'ROADMAP.md');
    const owner = store as unknown as { replace: (...args: unknown[]) => Promise<void> };
    const replace = owner.replace;
    let writes = 0;
    owner.replace = async (...args) => { if (++writes === 2) throw new Error('injected after file');
        return replace.apply(store, args); };
    await assert.rejects(store.applyRoadmapPublication(root, preview, true), /injected/);
    owner.replace = replace;
    assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), preview.content);
    const pending = await new RoadmapStore().read<import('../../packages/project-intelligence/lib/node/roadmap-gate-domain.js').RoadmapGateIndex>(root);
    assert.equal(pending.linkedDocument, undefined);
    assert.equal(pending.pendingPublication?.sourceHash, preview.sourceHash);
    const recovered = await new RoadmapStore().recoverRoadmapPublication(root);
    assert.equal(recovered.linkedDocument?.sourceHash, preview.sourceHash);
    assert.equal(recovered.revision, preview.revision + 2);
    assert.equal((await new RoadmapStore().recoverRoadmapPublication(root)).revision, recovered.revision);
}));

test('damaged interrupted staging bytes keep publication noncanonical', async () => fixture(async (root, store) => {
    const preview = await store.previewRoadmapPublication(root, 'ROADMAP.md');
    const owner = store as unknown as { settleRoadmapPublication: (...args: unknown[]) => Promise<unknown> };
    const settle = owner.settleRoadmapPublication;
    owner.settleRoadmapPublication = async () => { throw new Error('injected before stage'); };
    await assert.rejects(store.applyRoadmapPublication(root, preview, true), /injected/);
    owner.settleRoadmapPublication = settle;
    await writeFile(join(root, `.${preview.approvalId}.dope-roadmap-publish.tmp`), 'partial');
    await assert.rejects(new RoadmapStore().recoverRoadmapPublication(root), /differs from approved bytes/);
    const current = await new RoadmapStore().read<import('../../packages/project-intelligence/lib/node/roadmap-gate-domain.js').RoadmapGateIndex>(root);
    assert.equal(current.linkedDocument, undefined);
    assert.equal(current.pendingPublication?.approvalId, preview.approvalId);
    await assert.rejects(readFile(join(root, 'ROADMAP.md')), /ENOENT/);
}));

test('response loss after linked persistence is an idempotent confirmed result', async () => fixture(async (root, store) => {
    const preview = await store.previewRoadmapPublication(root, 'ROADMAP.md');
    const owner = store as unknown as { publish: (...args: unknown[]) => void };
    const publish = owner.publish;
    owner.publish = () => { throw new Error('injected lost response'); };
    await assert.rejects(store.applyRoadmapPublication(root, preview, true), /lost response/);
    owner.publish = publish;
    const persisted = await new RoadmapStore().read<import('../../packages/project-intelligence/lib/node/roadmap-gate-domain.js').RoadmapGateIndex>(root);
    assert.equal(persisted.linkedDocument?.sourceHash, preview.sourceHash);
    assert.equal((await store.applyRoadmapPublication(root, preview, true)).revision, persisted.revision);
}));
