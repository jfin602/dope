import assert from 'node:assert/strict';
import { chmod, lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { planRoadmapDocumentPatch, readRoadmapDocumentCapabilities } from '../../packages/project-intelligence/lib/node/roadmap-document-patch.js';

const sourcePath = 'docs/roadmap/mvp-roadmap.md';
const fixture = async (content: string, run: (root: string, store: RoadmapStore, actions: ProjectPlanningActions, file: string) => Promise<void>) => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-document-patch-'));
    const file = join(root, sourcePath);
    try {
        await mkdir(join(root, 'docs/roadmap'), { recursive: true });
        await writeFile(file, content);
        await run(root, new RoadmapStore(), new ProjectPlanningActions(new RoadmapStore()), file);
    } finally { await rm(root, { recursive: true, force: true }); }
};
const initial = '# Roadmap\r\nUnmapped introduction.\r\n## Product Phase 1 — One\r\nStatus: **NOT GREEN**\r\nObjective: old prose\r\nProse: old detail\r\nOrder: 1\r\nUnmapped **formatting** stays.\r\n\r\n## Product Phase 2 — Two\r\nStatus: **NOT GREEN**\r\nObjective: another\r\nOrder: 2\r\n';
async function setup(root: string, store: RoadmapStore, actions: ProjectPlanningActions) {
    const imported = await store.acceptImport(root, 0, await previewRoadmapImport(root));
    const { projectHandle } = await actions.attach(root);
    const item = imported.checkpoints.find(checkpoint => checkpoint.title.includes('Phase 1'))!;
    return { imported, projectHandle, item };
}

test('approved mapped patch preserves CRLF, unrelated bytes and evidence status', async () => fixture(initial, async (root, store, actions, file) => {
    const { imported, projectHandle, item } = await setup(root, store, actions);
    const request = { projectHandle, ownerId: imported.projectId, expectedRevision: imported.revision,
        sourceHashes: { [item.id]: item.source!.sha256 },
        actions: [{ type: 'document-edit' as const, id: item.id, title: 'Product Phase 1 — Revised', objective: 'new prose', prose: 'new detail', order: 4 }] };
    const preview = await actions.preview(request);
    assert.equal(preview.requiresApproval, true);
    assert.equal(preview.documentDiff?.changedLines.length, 4);
    assert.deepEqual(await readFile(file, 'utf8'), initial);
    await assert.rejects(actions.apply(request, preview.token), /approval required/);
    assert.deepEqual(await readFile(file, 'utf8'), initial);
    const result = await actions.apply(request, preview.token, true);
    assert.equal(result.revision, imported.revision + 3); // prepared, document-written, settled index
    assert.equal(result.checkpoints[0].title, 'Product Phase 1 — Revised');
    assert.equal(result.checkpoints[0].status, 'not-green');
    assert.equal(result.checkpoints[1].status, 'not-green');
    assert.equal(result.checkpoints[1].source!.sha256, result.linkedDocument!.sourceHash);
    const expected = initial.replace('Product Phase 1 — One', 'Product Phase 1 — Revised')
        .replace('Objective: old prose', 'Objective: new prose').replace('Prose: old detail', 'Prose: new detail').replace('Order: 1', 'Order: 4');
    assert.deepEqual(await readFile(file, 'utf8'), expected);
    assert.equal(result.linkedDocument?.lastSynced.roadmapRevision, result.revision);
    await assert.rejects(actions.preview({ ...request, expectedRevision: result.revision }), /Stale or unsupported/);
}));

test('concurrent source edit and Roadmap revision refuse publication', async () => fixture(initial, async (root, store, actions, file) => {
    const { imported, projectHandle, item } = await setup(root, store, actions);
    const request = { projectHandle, ownerId: imported.projectId, expectedRevision: imported.revision,
        sourceHashes: { [item.id]: item.source!.sha256 }, actions: [{ type: 'document-edit' as const, id: item.id, objective: 'new' }] };
    const preview = await actions.preview(request);
    await writeFile(file, initial + 'External edit.\r\n');
    await assert.rejects(actions.apply(request, preview.token, true), /Stale linked Roadmap source fingerprint/);
    assert.equal((await store.read(root)).revision, imported.revision);
    await writeFile(file, initial);
    await store.mutate(root, imported.revision, { type: 'create', id: 'other', kind: 'milestone', title: 'Other', objective: '', order: 5 }, imported.projectId);
    await assert.rejects(actions.apply(request, preview.token, true), /Stale Roadmap revision/);
    assert.deepEqual(await readFile(file, 'utf8'), initial);
}));

test('competing write at linked publication is preserved and requires source-aware recovery', async () => fixture(initial,
    async (root, store, actions, file) => {
        const { imported, projectHandle, item } = await setup(root, store, actions);
        const request = { projectHandle, ownerId: imported.projectId, expectedRevision: imported.revision,
            sourceHashes: { [item.id]: item.source!.sha256 },
            actions: [{ type: 'document-edit' as const, id: item.id, objective: 'approved' }] };
        const preview = await actions.preview(request);
        const external = initial.replace('Objective: old prose', 'Objective: external competing write');
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
        try { await assert.rejects(actions.apply(request, preview.token, true), /source changed during publication/); }
        finally { (fs as { rename: typeof fs.rename }).rename = originalRename; }
        assert.equal(injected, true);
        assert.equal(await readFile(file, 'utf8'), external);
        assert.equal((await store.read(root)).linkedDocument?.syncState, 'pending-sync');
        const restarted = new RoadmapStore();
        const recovery = await restarted.previewPendingRecovery(root);
        assert.equal(recovery.state, 'ready');
        const settled = await restarted.applyPendingRecovery(root, recovery, true);
        assert.equal(settled.linkedDocument?.syncState, 'synced');
        assert.equal(settled.checkpoints[0].status, 'not-green');
        assert.equal(await readFile(file, 'utf8'), external);
        await assert.rejects(lstat(`${file}.dope-pending-backup`), /ENOENT/);
    }));

test('atomic external replacement during publication cannot be overwritten', async () => fixture(initial,
    async (root, store, actions, file) => {
        const { imported, projectHandle, item } = await setup(root, store, actions);
        const request = { projectHandle, ownerId: imported.projectId, expectedRevision: imported.revision,
            sourceHashes: { [item.id]: item.source!.sha256 },
            actions: [{ type: 'document-edit' as const, id: item.id, objective: 'approved' }] };
        const preview = await actions.preview(request);
        const external = initial.replace('Objective: old prose', 'Objective: replaced externally');
        const replacement = `${file}.external-staged`;
        await writeFile(replacement, external);
        const fs = createRequire(import.meta.url)('node:fs/promises') as typeof import('node:fs/promises');
        const originalRename = fs.rename;
        let injected = false;
        (fs as { rename: typeof fs.rename }).rename = async (from, to) => {
            if (!injected && from === file && typeof to === 'string' && to.endsWith('.dope-pending-backup')) {
                injected = true;
                await originalRename(replacement, file);
            }
            return originalRename(from, to);
        };
        try { await assert.rejects(actions.apply(request, preview.token, true), /source changed during publication/); }
        finally { (fs as { rename: typeof fs.rename }).rename = originalRename; }
        assert.equal(injected, true);
        assert.equal(await readFile(file, 'utf8'), external);
        const restarted = new RoadmapStore();
        const recovery = await restarted.previewPendingRecovery(root);
        assert.equal(recovery.state, 'ready');
        const settled = await restarted.applyPendingRecovery(root, recovery, true);
        assert.equal(settled.linkedDocument?.syncState, 'synced');
        assert.equal(await readFile(file, 'utf8'), external);
        await assert.rejects(lstat(`${file}.dope-pending-backup`), /ENOENT/);
    }));

test('restart clears an empty reserved backup after interrupted publication', async () => fixture(initial,
    async (root, store, actions, file) => {
        const { imported, projectHandle, item } = await setup(root, store, actions);
        const request = { projectHandle, ownerId: imported.projectId, expectedRevision: imported.revision,
            sourceHashes: { [item.id]: item.source!.sha256 },
            actions: [{ type: 'document-edit' as const, id: item.id, objective: 'approved' }] };
        const preview = await actions.preview(request);
        const fs = createRequire(import.meta.url)('node:fs/promises') as typeof import('node:fs/promises');
        const originalRename = fs.rename;
        let interrupted = false;
        (fs as { rename: typeof fs.rename }).rename = async (from, to) => {
            if (!interrupted && from === file && typeof to === 'string' && to.endsWith('.dope-pending-backup')) {
                interrupted = true;
                throw new Error('injected interruption before source move');
            }
            return originalRename(from, to);
        };
        try { await assert.rejects(actions.apply(request, preview.token, true), /pending sync/); }
        finally { (fs as { rename: typeof fs.rename }).rename = originalRename; }
        assert.equal(interrupted, true);
        assert.equal(await readFile(file, 'utf8'), initial);
        const restarted = new RoadmapStore();
        const recovered = await restarted.recoverDocumentSync(root);
        assert.equal(recovered.linkedDocument?.syncState, 'synced');
        assert.match(await readFile(file, 'utf8'), /Objective: approved/);
        await assert.rejects(lstat(`${file}.dope-pending-backup`), /ENOENT/);
    }));

test('unsupported field/section and direct owner writes refuse changes', async () => fixture(initial.replace('Objective: old prose\r\n', ''), async (root, store, actions, file) => {
    const { imported, projectHandle, item } = await setup(root, store, actions);
    const capabilities = await readRoadmapDocumentCapabilities(root, imported, item.id);
    assert.equal(capabilities.fields.objective.editable, false);
    assert.equal(capabilities.fields.order.editable, true);
    assert.equal(capabilities.fields.prose.editable, true);
    const request = { projectHandle, ownerId: imported.projectId, expectedRevision: imported.revision,
        sourceHashes: { [item.id]: item.source!.sha256 }, actions: [{ type: 'document-edit' as const, id: item.id, objective: 'new' }] };
    await assert.rejects(actions.preview(request), /Unsupported or ambiguous Roadmap Objective field/);
    await assert.rejects(store.mutate(root, imported.revision, { type: 'update', id: item.id, title: item.title,
        objective: 'backdoor', order: item.order, dependencies: [], links: [] }, imported.projectId), /Markdown owns mapped/);
    await assert.rejects(actions.preview({ ...request, actions: [{ type: 'status' as const, id: item.id, status: 'green' as never }] }), /gate promotion/);
    assert.deepEqual(await readFile(file, 'utf8'), initial.replace('Objective: old prose\r\n', ''));
}));

test('duplicate mapped labels remain unsupported while a structured source is eligible', async () => {
    await fixture(initial, async (root, store, actions) => {
        const { imported, item } = await setup(root, store, actions);
        const capability = await readRoadmapDocumentCapabilities(root, imported, item.id);
        assert.deepEqual(Object.values(capability.fields).map(field => field.editable), [true, true, true]);
    });
    await fixture(initial.replace('Objective: old prose\r\n', 'Objective: old prose\r\nObjective: duplicate\r\n'),
        async (root, store, actions) => {
            const { imported, item } = await setup(root, store, actions);
            await assert.rejects(readRoadmapDocumentCapabilities(root, imported, item.id),
                /Stale or unsupported linked Roadmap section/);
        });
});

test('foreign and symlink source paths fail closed', async () => fixture(initial, async (root, store, actions, file) => {
    const { imported, projectHandle, item } = await setup(root, store, actions);
    await assert.rejects(planRoadmapDocumentPatch(root, { ...imported, linkedDocument: { ...imported.linkedDocument!, path: '../foreign.md' } },
        { checkpointId: item.id, sourceHash: item.source!.sha256, objective: 'new' }), /Stale or unsupported|Unsafe/);
    const request = { projectHandle, ownerId: imported.projectId, expectedRevision: imported.revision,
        sourceHashes: { [item.id]: item.source!.sha256 }, actions: [{ type: 'document-edit' as const, id: item.id, objective: 'new' }] };
    const preview = await actions.preview(request);
    await rm(file);
    const foreign = join(root, 'foreign.md');
    await writeFile(foreign, initial);
    await symlink(foreign, file);
    await assert.rejects(actions.apply(request, preview.token, true), /symlink/);
    assert.equal((await store.read(root)).revision, imported.revision);
}));

test('read-only source section and denied document directory cannot publish a change', async () => {
    await fixture(initial.replace('Status: **NOT GREEN**', 'Status: PENDING REVIEW'), async (root, store, actions) => {
        const { imported, projectHandle, item } = await setup(root, store, actions);
        const request = { projectHandle, ownerId: imported.projectId, expectedRevision: imported.revision,
            sourceHashes: { [item.id]: item.source!.sha256 },
            actions: [{ type: 'document-edit' as const, id: item.id, objective: 'new' }] };
        await assert.rejects(actions.preview(request), /Stale or unsupported linked Roadmap section/);
    });
    await fixture(initial, async (root, store, actions, file) => {
        const { imported, projectHandle, item } = await setup(root, store, actions);
        const request = { projectHandle, ownerId: imported.projectId, expectedRevision: imported.revision,
            sourceHashes: { [item.id]: item.source!.sha256 },
            actions: [{ type: 'document-edit' as const, id: item.id, objective: 'new' }] };
        const preview = await actions.preview(request);
        const directory = join(root, 'docs/roadmap');
        await chmod(directory, 0o500);
        try { await assert.rejects(actions.apply(request, preview.token, true), /EACCES|EPERM/); }
        finally { await chmod(directory, 0o700); }
        const pending = await store.read(root);
        assert.equal(pending.revision, imported.revision + 1);
        assert.equal(pending.linkedDocument?.syncState, 'pending-sync');
        assert.deepEqual(await readFile(file, 'utf8'), initial);
    });
});
