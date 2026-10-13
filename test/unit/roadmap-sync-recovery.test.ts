import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapLinkedObserver } from '../../packages/project-intelligence/lib/node/roadmap-linked-observer.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';

const document = '# Roadmap\n## Product Phase 1 — One\nStatus: **NOT GREEN**\nObjective: old\nOrder: 1\nOther prose stays.\n';
async function fixture(run: (root: string, file: string, store: RoadmapStore) => Promise<void>): Promise<void> {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-recover-'));
    const file = join(root, 'docs/roadmap/mvp-roadmap.md');
    try {
        await mkdir(join(root, 'docs/roadmap'), { recursive: true });
        await writeFile(file, document);
        await run(root, file, new RoadmapStore());
    } finally { await rm(root, { recursive: true, force: true }); }
}
async function approvedEdit(root: string, store: RoadmapStore): Promise<() => Promise<unknown>> {
    const first = await store.acceptImport(root, 0, await previewRoadmapImport(root));
    const actions = new ProjectPlanningActions(store);
    const { projectHandle } = await actions.attach(root);
    const item = first.checkpoints[0];
    const request = { projectHandle, ownerId: first.projectId, expectedRevision: first.revision,
        sourceHashes: { [item.id]: item.source!.sha256 },
        actions: [{ type: 'document-edit' as const, id: item.id, objective: 'approved' }] };
    const preview = await actions.preview(request);
    return () => actions.apply(request, preview.token, true);
}

for (const failAt of [1, 2, 3]) test(`restart recovers injected failure after owner write ${failAt}`, async () => fixture(async (root, file, store) => {
    const apply = await approvedEdit(root, store);
    const original = (store as any).replace.bind(store);
    let calls = 0;
    (store as any).replace = async (...args: unknown[]) => {
        const result = await original(...args);
        if (++calls === failAt) throw new Error('injected owner write failure');
        return result;
    };
    await assert.rejects(apply(), /injected owner write failure|pending sync/);
    const pending = await new RoadmapStore().read(root);
    assert.equal(pending.linkedDocument?.syncState, failAt === 3 ? 'synced' : 'pending-sync');
    const restarted = new RoadmapStore();
    const preview = await restarted.previewDocumentSync(root);
    assert.equal(preview.state, 'unchanged');
    const final = await restarted.read(root);
    assert.equal(final.checkpoints[0].objective, 'approved');
    assert.equal(final.checkpoints[0].status, 'not-green');
    assert.equal((await readFile(file, 'utf8')).includes('Objective: approved'), true);
    assert.equal((await readFile(file, 'utf8')).includes('Other prose stays.'), true);
    await assert.rejects(apply(), /Stale Roadmap revision/);
}));

test('failure before pending index write leaves both owners unchanged', async () => fixture(async (root, file, store) => {
    const apply = await approvedEdit(root, store);
    const before = await store.read(root);
    (store as any).replace = async () => { throw new Error('injected before owner index write'); };
    await assert.rejects(apply(), /injected before owner index write/);
    const restarted = new RoadmapStore();
    assert.equal((await restarted.read(root)).revision, before.revision);
    assert.equal((await restarted.read(root)).linkedDocument?.pending, undefined);
    assert.equal(await readFile(file, 'utf8'), document);
    assert.equal((await restarted.previewDocumentSync(root)).state, 'unchanged');
}));

test('source edit after document write needs reviewed recovery and preserves both edits until approval', async () => fixture(async (root, file, store) => {
    const apply = await approvedEdit(root, store);
    const original = (store as any).replace.bind(store);
    let writes = 0;
    (store as any).replace = async (...args: unknown[]) => {
        if (++writes === 2) throw new Error('injected before document-written index write');
        return original(...args);
    };
    await assert.rejects(apply());
    assert.match(await readFile(file, 'utf8'), /Objective: approved/);
    const external = (await readFile(file, 'utf8')).replace('Objective: approved', 'Objective: external');
    await writeFile(file, external);
    const restarted = new RoadmapStore();
    assert.equal((await restarted.previewDocumentSync(root)).state, 'conflict');
    const pending = await restarted.read(root);
    assert.equal(pending.checkpoints[0].objective, 'old');
    assert.equal(pending.linkedDocument?.pending?.outcome, 'conflict');
    const preview = await restarted.previewPendingRecovery(root);
    assert.equal(preview.state, 'ready');
    const recovered = await restarted.applyPendingRecovery(root, preview, true);
    assert.equal(recovered.checkpoints[0].objective, 'external');
    assert.equal(recovered.checkpoints[0].status, 'not-green');
    assert.equal(await readFile(file, 'utf8'), external);
    assert.equal((await new RoadmapStore().previewDocumentSync(root)).state, 'unchanged');
}));

test('stale source after pending write remains a visible conflict and preserves both owners', async () => fixture(async (root, file, store) => {
    const apply = await approvedEdit(root, store);
    const original = (store as any).replace.bind(store);
    let calls = 0;
    (store as any).replace = async (...args: unknown[]) => {
        const result = await original(...args);
        if (++calls === 1) throw new Error('injected owner write failure');
        return result;
    };
    await assert.rejects(apply());
    const foreign = document.replace('Objective: old', 'Objective: external');
    await writeFile(file, foreign);
    const restarted = new RoadmapStore();
    assert.equal((await restarted.previewDocumentSync(root)).state, 'conflict');
    assert.equal((await restarted.read(root)).linkedDocument?.pending?.outcome, 'conflict');
    assert.equal(await readFile(file, 'utf8'), foreign);
    await assert.rejects(restarted.mutate(root, (await restarted.read(root)).revision,
        { type: 'create', id: 'manual', kind: 'milestone', title: 'Manual', objective: '', order: 2 }), /Pending linked/);
}));

test('reviewed source-wins recovery clears a crash conflict without overwriting Markdown', async () => fixture(async (root, file, store) => {
    const apply = await approvedEdit(root, store);
    const original = (store as any).replace.bind(store);
    let writes = 0;
    (store as any).replace = async (...args: unknown[]) => {
        const result = await original(...args);
        if (++writes === 1) throw new Error('injected after pending index write');
        return result;
    };
    await assert.rejects(apply());
    const external = document.replace('Objective: old', 'Objective: external').replace('Other prose stays.', 'External note stays.');
    await writeFile(file, external);
    const restarted = new RoadmapStore();
    assert.equal((await restarted.previewDocumentSync(root)).state, 'conflict');
    const preview = await restarted.previewPendingRecovery(root);
    assert.equal(preview.state, 'ready');
    assert.deepEqual(preview.changes.filter(change => change.field === 'objective').map(change =>
        [change.accepted, change.roadmap, change.source, change.conflict]), [['old', 'approved', 'external', true]]);
    const pending = await restarted.read(root);
    assert.equal((await restarted.applyPendingRecovery(root, preview, false)).revision, pending.revision);
    assert.equal((await restarted.read(root)).linkedDocument?.syncState, 'pending-sync');
    const final = await restarted.applyPendingRecovery(root, preview, true);
    assert.equal(final.checkpoints[0].objective, 'external');
    assert.equal(final.checkpoints[0].status, 'not-green');
    assert.equal(final.linkedDocument?.syncState, 'synced');
    assert.equal(final.linkedDocument?.pending, undefined);
    assert.equal(await readFile(file, 'utf8'), external);
    assert.equal((await new RoadmapStore().previewDocumentSync(root)).state, 'unchanged');
    await assert.rejects(restarted.applyPendingRecovery(root, preview, true), /Stale pending Roadmap recovery/);
    const actions = new ProjectPlanningActions(restarted);
    const { projectHandle } = await actions.attach(root);
    const request = { projectHandle, ownerId: final.projectId, expectedRevision: final.revision,
        sourceHashes: { [final.checkpoints[0].id]: final.checkpoints[0].source!.sha256 },
        actions: [{ type: 'document-edit' as const, id: final.checkpoints[0].id, objective: 'readmitted' }] };
    const next = await actions.preview(request);
    const readmitted = await actions.apply(request, next.token, true);
    assert.equal(readmitted.checkpoints[0].objective, 'readmitted');
    assert.equal(readmitted.checkpoints[0].status, 'not-green');
    assert.match(await readFile(file, 'utf8'), /External note stays/);
    assert.match(await readFile(file, 'utf8'), /Objective: readmitted/);
}));

test('pending recovery rejects stale preview, missing source and malformed mapped fields', async () => fixture(async (root, file, store) => {
    const apply = await approvedEdit(root, store);
    const original = (store as any).replace.bind(store);
    (store as any).replace = async (...args: unknown[]) => { await original(...args); throw new Error('injected'); };
    await assert.rejects(apply());
    const external = document.replace('Objective: old', 'Objective: external');
    await writeFile(file, external);
    const restarted = new RoadmapStore();
    const preview = await restarted.previewPendingRecovery(root);
    assert.equal(preview.state, 'ready');
    const malformed = external.replace('Objective: external', 'Objective: external\nObjective: duplicate');
    await writeFile(file, malformed);
    assert.equal((await restarted.previewPendingRecovery(root)).state, 'review');
    await assert.rejects(restarted.applyPendingRecovery(root, preview, true), /Stale pending Roadmap recovery preview/);
    assert.equal(await readFile(file, 'utf8'), malformed);
    await rm(file);
    assert.equal((await restarted.previewPendingRecovery(root)).state, 'review');
    await assert.rejects(restarted.applyPendingRecovery(root, preview, true), /Stale pending Roadmap recovery preview/);
    assert.equal((await restarted.read(root)).linkedDocument?.syncState, 'pending-sync');
}));

test('missing and unsafe linked source never relink or overwrite on recovery', async () => fixture(async (root, file, store) => {
    const apply = await approvedEdit(root, store);
    const original = (store as any).replace.bind(store);
    (store as any).replace = async (...args: unknown[]) => { await original(...args); throw new Error('injected'); };
    await assert.rejects(apply());
    await rm(file);
    const other = join(root, 'other.md');
    await writeFile(other, document);
    await symlink(other, file);
    const restarted = new RoadmapStore();
    const preview = await restarted.previewDocumentSync(root);
    assert.equal(preview.state, 'relink-needed');
    assert.equal((await restarted.read(root)).linkedDocument?.syncState, 'pending-sync');
    assert.equal(await readFile(other, 'utf8'), document);
}));

test('moved source during pending write waits for original-path restoration and reviewed recovery', async () => fixture(async (root, file, store) => {
    const apply = await approvedEdit(root, store);
    const original = (store as any).replace.bind(store);
    (store as any).replace = async (...args: unknown[]) => { await original(...args); throw new Error('injected'); };
    await assert.rejects(apply());
    const moved = join(root, 'docs/roadmap/moved.md');
    await rename(file, moved);
    const restarted = new RoadmapStore();
    assert.equal((await restarted.previewDocumentSync(root)).state, 'relink-needed');
    assert.equal((await restarted.previewPendingRecovery(root)).state, 'review');
    await assert.rejects(restarted.previewRelink(root, 'docs/roadmap/moved.md'), /Pending linked Roadmap sync/);
    assert.equal(await readFile(moved, 'utf8'), document);
    await rename(moved, file);
    // A prior conflict outcome remains explicit even after the source returns.
    const preview = await restarted.previewPendingRecovery(root);
    assert.equal(preview.state, 'ready');
    const recovered = await restarted.applyPendingRecovery(root, preview, true);
    assert.equal(recovered.linkedDocument?.syncState, 'synced');
    assert.equal(recovered.checkpoints[0].objective, 'old');
    assert.equal(await readFile(file, 'utf8'), document);
}));

test('one observer debounces duplicate source events and detaches on project switch', async () => fixture(async (root, file, store) => {
    await store.acceptImport(root, 0, await previewRoadmapImport(root));
    const otherRoot = await mkdtemp(join(tmpdir(), 'dope-roadmap-other-'));
    try {
        await mkdir(join(otherRoot, 'docs/roadmap'), { recursive: true });
        await writeFile(join(otherRoot, 'docs/roadmap/mvp-roadmap.md'), document);
        await store.acceptImport(otherRoot, 0, await previewRoadmapImport(otherRoot));
        const seen: string[] = [];
        const observer = new RoadmapLinkedObserver(value => store.read(value), value => seen.push(value));
        await observer.observe(root);
        await writeFile(file, document.replace('Objective: old', 'Objective: external'));
        await new Promise(resolve => setTimeout(resolve, 350));
        assert.deepEqual(seen, [root]);
        await observer.observe(otherRoot);
        await writeFile(file, document.replace('Objective: old', 'Objective: another'));
        await new Promise(resolve => setTimeout(resolve, 250));
        assert.deepEqual(seen, [root]);
        observer.dispose();
    } finally { await rm(otherRoot, { recursive: true, force: true }); }
}));

test('approved local document write does not feed back as an external source event', async () => fixture(async (root, _file, store) => {
    const apply = await approvedEdit(root, store);
    const seen: string[] = [];
    const observer = new RoadmapLinkedObserver(value => store.read(value), value => seen.push(value));
    try {
        await observer.observe(root);
        await apply();
        await new Promise(resolve => setTimeout(resolve, 300));
        assert.deepEqual(seen, []);
    } finally { observer.dispose(); }
}));
