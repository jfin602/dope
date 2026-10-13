import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';

const fixture = async (run: (root: string) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-greenfield-'));
    try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
};

test('model-free draft edits, preview and approved acceptance create one linked Markdown owner', async () => fixture(async root => {
    const store = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(store);
    const { handle } = await greenfield.begin(root);
    const phase = greenfield.edit(handle, 0, { type: 'create-phase', title: 'Build', objective: 'Ship it' });
    const phaseId = phase.phases[0].id;
    assert.throws(() => greenfield.preview(handle, 'ROADMAP.md'), /phase and checkpoint/);
    assert.deepEqual(await readdir(root), []);
    const checkpoint = greenfield.edit(handle, 1, { type: 'create-checkpoint', phaseId, title: 'First slice' });
    const checkpointId = checkpoint.phases[0].checkpoints[0].id;
    greenfield.edit(handle, 2, { type: 'edit-checkpoint', phaseId, checkpointId,
        objective: 'Finish the first slice' });
    greenfield.edit(handle, 3, { type: 'reorder-checkpoint', phaseId, checkpointId, order: 0 });
    const preview = greenfield.preview(handle, 'ROADMAP.md');
    assert.equal((await store.read(root)).revision, 0);
    assert.deepEqual(await readdir(root), []);
    await assert.rejects(greenfield.accept(handle, preview, false), /approval/);
    assert.deepEqual(await readdir(root), []);
    const accepted = await greenfield.accept(handle, preview, true);
    assert.equal(accepted.revision, 2);
    assert.equal(accepted.linkedDocument?.path, 'ROADMAP.md');
    assert.deepEqual(accepted.checkpoints.map(item => item.kind), ['phase', 'milestone']);
    assert.deepEqual(accepted.checkpoints.map(item => item.objective), ['Ship it', 'Finish the first slice']);
    assert.equal((await readFile(join(root, 'ROADMAP.md'), 'utf8')), preview.markdown);
    const reopened = await new RoadmapStore().read(root);
    assert.equal(reopened.revision, accepted.revision);
    assert.deepEqual(reopened.checkpoints.map(item => item.id), accepted.checkpoints.map(item => item.id));
    assert.equal(reopened.linkedDocument?.path, 'ROADMAP.md');
    assert.equal(reopened.linkedDocument?.syncState, 'synced');
    assert.equal((await store.previewDocumentSync(root)).state, 'unchanged');
}));

test('cancellation and duplicate headings cannot publish a Roadmap', async () => fixture(async root => {
    const store = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(store);
    const { handle } = await greenfield.begin(root);
    const phase = greenfield.edit(handle, 0, { type: 'create-phase', title: 'Build' });
    const phaseId = phase.phases[0].id;
    greenfield.edit(handle, 1, { type: 'create-checkpoint', phaseId, title: 'Same' });
    assert.throws(() => greenfield.edit(handle, 2, { type: 'create-checkpoint', phaseId, title: 'Same' }), /Duplicate/);
    assert.equal(greenfield.read(handle).revision, 2);
    greenfield.cancel(handle);
    assert.throws(() => greenfield.preview(handle, 'ROADMAP.md'), /Unknown/);
    assert.deepEqual(await readdir(root), []);
    assert.equal((await store.read(root)).revision, 0);
}));

test('existing, symlinked, missing and stale targets are refused without overwriting', async () => fixture(async root => {
    const store = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(store);
    const { handle } = await greenfield.begin(root);
    const phase = greenfield.edit(handle, 0, { type: 'create-phase', title: 'Build' });
    greenfield.edit(handle, 1, { type: 'create-checkpoint', phaseId: phase.phases[0].id, title: 'First' });
    await writeFile(join(root, 'ROADMAP.md'), 'owned\n');
    const preview = greenfield.preview(handle, 'ROADMAP.md');
    await assert.rejects(greenfield.accept(handle, preview, true), /already exists/);
    assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), 'owned\n');
    await symlink(join(root, 'ROADMAP.md'), join(root, 'alias.md'));
    await assert.rejects(greenfield.accept(handle, greenfield.preview(handle, 'alias.md'), true), /already exists/);
    await assert.rejects(greenfield.accept(handle, greenfield.preview(handle, 'missing/ROADMAP.md'), true), /ENOENT/);
    await assert.rejects(greenfield.accept(handle, { ...preview, markdown: 'forged' }, true), /preview/);
    assert.equal((await store.read(root)).revision, 0);
    const other = await mkdtemp(join(tmpdir(), 'dope-greenfield-other-'));
    try { await assert.rejects(new RoadmapGreenfield(store).begin(join(other, 'missing')), /ENOENT/); }
    finally { await rm(other, { recursive: true, force: true }); }
}));

test('a Roadmap revision race invalidates an approved greenfield preview', async () => fixture(async root => {
    const store = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(store);
    const { handle } = await greenfield.begin(root);
    const phase = greenfield.edit(handle, 0, { type: 'create-phase', title: 'Build' });
    greenfield.edit(handle, 1, { type: 'create-checkpoint', phaseId: phase.phases[0].id, title: 'First' });
    const preview = greenfield.preview(handle, 'ROADMAP.md');
    await store.mutate(root, 0, { type: 'create', id: 'manual', kind: 'phase', title: 'Manual',
        objective: '', order: 0 });
    await assert.rejects(greenfield.accept(handle, preview, true), /Stale Roadmap revision/);
    assert.equal((await store.read(root)).checkpoints[0].id, 'manual');
    await assert.rejects(readFile(join(root, 'ROADMAP.md')), /ENOENT/);
}));

test('pending accepted creation survives failed index finalization and restarts idempotently', async () => fixture(async root => {
    const store = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(store);
    const { handle } = await greenfield.begin(root);
    const phase = greenfield.edit(handle, 0, { type: 'create-phase', title: 'Build' });
    greenfield.edit(handle, 1, { type: 'create-checkpoint', phaseId: phase.phases[0].id, title: 'First' });
    const preview = greenfield.preview(handle, 'ROADMAP.md');
    const internals = store as unknown as { replace: (root: string, next: { revision: number }) => Promise<void> };
    const original = internals.replace.bind(store);
    internals.replace = async (root, next) => {
        if (next.revision === 2) throw new Error('injected index failure');
        return original(root, next);
    };
    await assert.rejects(greenfield.accept(handle, preview, true), /injected index failure/);
    assert.equal((await store.read(root)).pendingCreation?.path, 'ROADMAP.md');
    assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), preview.markdown);
    await assert.rejects(store.mutate(root, 1, { type: 'create', id: 'other', kind: 'phase', title: 'Other',
        objective: '', order: 0 }), /Pending greenfield/);
    await writeFile(join(root, 'ROADMAP.md'), 'external change\n');
    await assert.rejects(new RoadmapStore().recoverGreenfield(root), /source changed/);
    assert.equal((await store.read(root)).pendingCreation?.path, 'ROADMAP.md');
    assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), 'external change\n');
    await writeFile(join(root, 'ROADMAP.md'), preview.markdown);
    const recovered = await new RoadmapStore().recoverGreenfield(root);
    assert.equal(recovered.revision, 2);
    assert.equal(recovered.linkedDocument?.syncState, 'synced');
    assert.equal((await new RoadmapStore().recoverGreenfield(root)).revision, 2);
    await assert.rejects(greenfield.accept(handle, preview, true), /Stale/);
}));
