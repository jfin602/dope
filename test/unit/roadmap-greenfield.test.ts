import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { reviseImplementationPlan, type ImplementationPlanInput } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { projectRoadmap } from '../../packages/project-intelligence/lib/roadmap-projection.js';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';

const fixture = async (run: (root: string) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-greenfield-'));
    try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
};

test('a capped draft sequence is provisional until approved and checks each projected step', async () => fixture(async root => {
    const store = new RoadmapStore();
    const drafts = new RoadmapGreenfield(store);
    const { handle } = await drafts.begin(root);
    const preview = drafts.previewEditSequence(handle, 0, [
        { type: 'create-phase', title: 'Design' }, { type: 'create-phase', title: 'Build' }]);
    assert.equal(preview.after.phases.length, 2);
    assert.equal(drafts.read(handle).revision, 0);
    assert.equal((await store.read(root)).revision, 0);
    await assert.rejects(drafts.applyEdit(handle, preview, false), /approval/);
    assert.throws(() => drafts.previewEditSequence(handle, 0, [
        { type: 'create-phase', title: 'Design' },
        { type: 'create-checkpoint', phaseId: 'missing', title: 'Unsafe' }]), /Unknown/);
    assert.equal((await drafts.applyEdit(handle, preview, true)).revision, 2);
    assert.deepEqual(drafts.read(handle).phases.map(phase => phase.title), ['Design', 'Build']);
    assert.equal((await store.read(root)).revision, 0);
    assert.throws(() => drafts.previewEditSequence(handle, 0, [
        { type: 'create-phase', title: 'Late' }, { type: 'create-phase', title: 'Later' }]), /Stale/);
    const stale = drafts.previewEditSequence(handle, 2, [
        { type: 'create-phase', title: 'Verify' }, { type: 'create-phase', title: 'Release' }]);
    drafts.edit(handle, 2, { type: 'edit-phase', phaseId: drafts.read(handle).phases[0].id,
        objective: 'Human revision' });
    await assert.rejects(drafts.applyEdit(handle, stale, true), /Stale/);
    assert.equal(drafts.read(handle).phases.length, 2);
}));

test('model-free draft edits, preview and approved acceptance create one linked Markdown owner', async () => fixture(async root => {
    const store = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(store);
    const { handle } = await greenfield.begin(root);
    const phase = greenfield.edit(handle, 0, { type: 'create-phase', title: 'Build', objective: 'Ship it' });
    const phaseId = phase.phases[0].id;
    assert.throws(() => greenfield.preview(handle, 'ROADMAP.md'), /phase and checkpoint/);
    assert.deepEqual(await readdir(root), ['.dope']);
    const checkpoint = greenfield.edit(handle, 1, { type: 'create-checkpoint', phaseId, title: 'First slice' });
    const checkpointId = checkpoint.phases[0].checkpoints[0].id;
    greenfield.edit(handle, 2, { type: 'edit-checkpoint', phaseId, checkpointId,
        objective: 'Finish the first slice' });
    greenfield.edit(handle, 3, { type: 'reorder-checkpoint', phaseId, checkpointId, order: 0 });
    const preview = greenfield.preview(handle, 'ROADMAP.md');
    assert.equal((await store.read(root)).revision, 0);
    assert.deepEqual(await readdir(root), ['.dope']);
    await assert.rejects(greenfield.accept(handle, preview, false), /approval/);
    assert.deepEqual(await readdir(root), ['.dope']);
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

test('typed split, move, dependencies and correction branch share manual preview, undo and canonical recovery', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const { handle } = await drafts.begin(root);
    let draft = drafts.edit(handle, 0, { type: 'create-phase', title: 'Build' });
    const firstPhase = draft.phases[0].id;
    draft = drafts.edit(handle, 1, { type: 'create-phase', title: 'Verify' });
    const secondPhase = draft.phases[1].id;
    draft = drafts.edit(handle, 2, { type: 'create-checkpoint', phaseId: firstPhase, title: 'First' });
    const first = draft.phases[0].checkpoints[0].id;
    const split = drafts.previewEdit(handle, 3, { type: 'split-checkpoint', phaseId: firstPhase,
        checkpointId: first, title: 'Second' });
    assert.equal(drafts.read(handle).phases[0].checkpoints.length, 1);
    await assert.rejects(drafts.applyEdit(handle, split, false), /approval/);
    draft = await drafts.applyEdit(handle, split, true);
    const second = draft.phases[0].checkpoints[1].id;
    assert.deepEqual(draft.phases[0].checkpoints[1].dependencies, [first]);
    draft = drafts.undoEdit(handle, 4);
    assert.equal(draft.phases[0].checkpoints.length, 1);
    draft = drafts.redoEdit(handle, 5);
    assert.equal(draft.phases[0].checkpoints[1].id, second);
    assert.throws(() => drafts.edit(handle, 6, { type: 'move-checkpoint', phaseId: firstPhase,
        checkpointId: second, targetPhaseId: secondPhase, order: 0 }), /reviewed preview/);
    draft = await drafts.applyEdit(handle, drafts.previewEdit(handle, 6, { type: 'move-checkpoint',
        phaseId: firstPhase, checkpointId: second, targetPhaseId: secondPhase, order: 0 }), true);
    assert.equal(draft.phases[1].checkpoints[0].id, second);
    assert.throws(() => drafts.previewEdit(handle, 7, { type: 'add-dependency', checkpointId: first,
        dependencyId: second }), /cyclic/i);
    assert.throws(() => drafts.previewEdit(handle, 7, { type: 'add-dependency', checkpointId: first,
        dependencyId: '123e4567-e89b-42d3-a456-426614174000' }), /Foreign/);
    draft = await drafts.applyEdit(handle, drafts.previewEdit(handle, 7,
        { type: 'create-correction', parentId: second, title: 'Repair' }), true);
    const correction = draft.phases[2].id;
    assert.equal(draft.phases[2].parentId, second);
    draft = await drafts.applyEdit(handle, drafts.previewEdit(handle, 8,
        { type: 'attach-correction', correctionId: correction, parentId: first }), true);
    assert.equal(draft.phases[2].parentId, first);
    const stale = drafts.previewEdit(handle, 9, { type: 'add-dependency', checkpointId: second,
        dependencyId: draft.phases[0].id });
    drafts.edit(handle, 9, { type: 'edit-checkpoint', phaseId: firstPhase, checkpointId: first,
        objective: 'Human edit' });
    await assert.rejects(drafts.applyEdit(handle, stale, true), /Stale/);
    const creation = drafts.preview(handle, 'ROADMAP.md');
    const canonical = await drafts.accept(handle, creation, true);
    const byTitle = new Map(canonical.checkpoints.map(item => [item.title, item]));
    assert.equal(byTitle.get('Milestone Second')?.dependencies[0], byTitle.get('Milestone First')?.id);
    assert.equal(byTitle.get('Correction Repair')?.kind, 'correction');
    assert.equal(byTitle.get('Correction Repair')?.dependencies[0], byTitle.get('Milestone First')?.id);
    assert.equal(byTitle.get('Correction Repair')?.parentPhaseId, byTitle.get('Phase 1 — Build')?.id);
    const projection = projectRoadmap(canonical);
    assert.equal(projection.nodes.find(node => node.id === byTitle.get('Correction Repair')?.id)
        ?.phaseAssociation?.phaseId, byTitle.get('Phase 1 — Build')?.id);
    assert.equal(projection.nodes.find(node => node.id === byTitle.get('Correction Repair')?.id)
        ?.phaseAssociation?.unresolvedReason, undefined);
    assert.equal((await store.previewDocumentSync(root)).state, 'unchanged');
    assert.deepEqual((await new RoadmapStore().read(root)).checkpoints, canonical.checkpoints);
    const reimported = await store.acceptImport(root, canonical.revision,
        await previewRoadmapImport(root, 'ROADMAP.md'), canonical.projectId);
    assert.equal(reimported.checkpoints.find(item => item.kind === 'correction')?.parentPhaseId,
        byTitle.get('Phase 1 — Build')?.id);
}));

test('nested correction keeps strategic phase membership while retaining its immediate branch dependency', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const { handle } = await drafts.begin(root);
    const phase = drafts.edit(handle, 0, { type: 'create-phase', title: 'Build' });
    const phaseId = phase.phases[0].id;
    drafts.edit(handle, 1, { type: 'create-checkpoint', phaseId, title: 'First' });
    const first = await drafts.applyEdit(handle,
        drafts.previewEdit(handle, 2, { type: 'create-correction', parentId: phaseId, title: 'Repair' }), true);
    await drafts.applyEdit(handle, drafts.previewEdit(handle, 3,
        { type: 'create-correction', parentId: first.phases[1].id, title: 'Followup' }), true);
    const canonical = await drafts.accept(handle, drafts.preview(handle, 'ROADMAP.md'), true);
    const strategic = canonical.checkpoints.find(item => item.kind === 'phase')!;
    const repair = canonical.checkpoints.find(item => item.title === 'Correction Repair')!;
    const followup = canonical.checkpoints.find(item => item.title === 'Correction Followup')!;
    assert.equal(repair.parentPhaseId, strategic.id);
    assert.equal(followup.parentPhaseId, strategic.id);
    assert.deepEqual(followup.dependencies, [repair.id]);
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
    assert.deepEqual(await readdir(root), ['.dope']);
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
    await assert.rejects(greenfield.accept(handle, preview, true), /Stale/);
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
    await assert.rejects(greenfield.accept(handle, preview, true), /Stale|preview and approval/);
}));

test('accepted draft and Chat association restore without publishing a canonical Roadmap', async () => fixture(async root => {
    const store = new RoadmapStore();
    const first = new RoadmapGreenfield(store);
    const { handle } = await first.begin(root);
    const chatId = '123e4567-e89b-42d3-a456-426614174000';
    first.bindChat(root, handle, chatId);
    const phase = first.edit(handle, 0, { type: 'create-phase', title: 'Build' });
    first.edit(handle, 1, { type: 'create-checkpoint', phaseId: phase.phases[0].id, title: 'First' });
    const oldPreview = first.previewEdit(handle, 2, { type: 'edit-phase', phaseId: phase.phases[0].id, title: 'Unapproved' });
    const restored = new RoadmapGreenfield(new RoadmapStore());
    assert.deepEqual((await restored.restore(root)).map(item => ({ handle: item.handle, chatId: item.chatId })), [{ handle, chatId }]);
    assert.equal(restored.chatDraft(root, chatId)?.draft.revision, 2);
    await assert.rejects(restored.applyEdit(handle, oldPreview, true), /preview or approval/);
    assert.equal(restored.read(handle).phases[0].title, 'Build');
    assert.equal((await store.read(root)).revision, 0);
    await assert.rejects(readFile(join(root, 'ROADMAP.md')), /ENOENT/);
    const renewed = restored.previewEdit(handle, 2, oldPreview.action);
    assert.equal((await restored.applyEdit(handle, renewed, true)).revision, 3);
    assert.equal((await new RoadmapGreenfield(store).restore(root))[0].draft.revision, 3);
    restored.cancel(handle);
    const cancelled = new RoadmapGreenfield(store);
    assert.deepEqual(await cancelled.restore(root), []);
    assert.equal(cancelled.chatDraft(root, chatId), undefined);
    assert.equal((await store.read(root)).revision, 0);
}));

test('cancel, project isolation, concurrent edits, corrupt state and symlinked storage fail closed', async () => fixture(async root => {
    const other = await mkdtemp(join(tmpdir(), 'dope-greenfield-isolation-'));
    try {
        const first = new RoadmapGreenfield(new RoadmapStore());
        const { handle } = await first.begin(root);
        const second = new RoadmapGreenfield(new RoadmapStore());
        await second.restore(root);
        assert.deepEqual(await second.restore(other), []);
        assert.equal(second.read(handle).revision, 0);
        const otherHandle = (await second.begin(other)).handle;
        assert.throws(() => second.bindChat(root, otherHandle, '123e4567-e89b-42d3-a456-426614174000'), /Foreign/);
        first.edit(handle, 0, { type: 'create-phase', title: 'First' });
        assert.throws(() => second.edit(handle, 0, { type: 'create-phase', title: 'Racing' }), /Concurrent/);
        assert.equal((await new RoadmapGreenfield(new RoadmapStore()).restore(root))[0].draft.revision, 1);
        first.cancel(handle);
        assert.deepEqual(await new RoadmapGreenfield(new RoadmapStore()).restore(root), []);
        await writeFile(join(root, '.dope', 'roadmap-drafts.json'), '{bad');
        await assert.rejects(new RoadmapGreenfield(new RoadmapStore()).restore(root), /Corrupt/);
        await rm(join(root, '.dope', 'roadmap-drafts.json'));
        await symlink(join(root, 'outside.json'), join(root, '.dope', 'roadmap-drafts.json'));
        await assert.rejects(new RoadmapGreenfield(new RoadmapStore()).restore(root), /Unsafe/);
        await rm(join(root, '.dope', 'roadmap-drafts.json'));
        await writeFile(join(root, '.dope', 'roadmap-drafts.json'), ' '.repeat(512 * 1024 + 1));
        await assert.rejects(new RoadmapGreenfield(new RoadmapStore()).restore(root), /oversized/);
    } finally { await rm(other, { recursive: true, force: true }); }
}));

test('restored draft refuses a changed canonical Roadmap owner', async () => fixture(async root => {
    const store = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(store);
    const { handle } = await greenfield.begin(root);
    await store.mutate(root, 0, { type: 'create', id: 'owned', kind: 'phase', title: 'Canonical',
        objective: '', order: 0 });
    await assert.rejects(new RoadmapGreenfield(store).restore(root), /Stale greenfield draft owner/);
    assert.throws(() => greenfield.edit(handle, 0, { type: 'create-phase', title: 'Stale' }), /Stale/);
    assert.equal((await store.read(root)).checkpoints[0].title, 'Canonical');
    assert.ok(handle);
}));

const planInput = (): ImplementationPlanInput => ({ objective: 'Add history', constraints: ['Keep permissions explicit'],
    evidence: [{ id: '123e4567-e89b-42d3-a456-426614174000', path: 'src/history.ts', sha256: 'a'.repeat(64) }],
    decisions: [{ text: 'Reuse the diff editor', origin: 'developer' }], steps: [
        { title: 'Inspect history', detail: 'Find current history owner', expectedOutputs: ['Owner map'],
            dependencies: [], evidenceIds: ['123e4567-e89b-42d3-a456-426614174000'] },
        { title: 'Build history', detail: 'Add the view', expectedOutputs: ['History view'],
            dependencies: [], evidenceIds: [] }] });
const projectionInput = (): ImplementationPlanInput => {
    const input = planInput(); input.evidence = []; input.steps.forEach(step => { step.evidenceIds = []; });
    return input;
};

test('reviewed plan projects once into the existing draft and keeps Markdown behind its own approval', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const { handle } = await drafts.beginImplementationPlan(root);
    const input = projectionInput();
    const accepted = await drafts.applyImplementationPlan(handle,
        await drafts.previewImplementationPlan(handle, 0, 0, input), true);
    const changed = projectionInput();
    changed.steps[0].id = accepted.steps[0].id;
    changed.steps[1].id = accepted.steps[1].id;
    changed.steps[1].dependencies = [accepted.steps[0].id];
    await drafts.applyImplementationPlan(handle,
        await drafts.previewImplementationPlan(handle, 0, 1, changed), true);
    const preview = await drafts.previewImplementationPlanProjection(root, handle);
    assert.equal(preview.draft.phases.length, 2);
    const [first, second] = preview.draft.phases.flatMap(phase => phase.checkpoints);
    assert.deepEqual(second.dependencies, [first.id]);
    assert.equal((await store.read(root)).revision, 0);
    assert.deepEqual(await readdir(root), ['.dope']);
    await assert.rejects(drafts.applyImplementationPlanProjection(root, preview, false), /approval/);
    const projected = await drafts.applyImplementationPlanProjection(root, preview, true);
    assert.deepEqual(projected, preview.draft);
    await assert.rejects(drafts.applyImplementationPlanProjection(root, preview, true), /approval/);
    const recovered = new RoadmapGreenfield(new RoadmapStore());
    assert.equal((await recovered.list(root))[0].handle, handle);
    assert.equal((await recovered.list(root))[0].plan?.revision, 2);
    assert.deepEqual(recovered.read(handle), projected);
    assert.equal((await store.read(root)).revision, 0);
    const document = recovered.preview(handle, 'ROADMAP.md');
    assert.equal((await store.read(root)).revision, 0);
    assert.deepEqual(await readdir(root), ['.dope']);
    const canonical = await recovered.accept(handle, document, true);
    assert.equal(canonical.linkedDocument?.path, 'ROADMAP.md');
    assert.equal(canonical.checkpoints.filter(item => item.kind === 'milestone').length, 2);
    assert.equal((await readFile(join(root, 'ROADMAP.md'), 'utf8')), document.markdown);
}));

test('plan projection rejects stale review, foreign project and existing linked source without writing', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const { handle } = await drafts.beginImplementationPlan(root);
    const first = await drafts.applyImplementationPlan(handle,
        await drafts.previewImplementationPlan(handle, 0, 0, projectionInput()), true);
    const preview = await drafts.previewImplementationPlanProjection(root, handle);
    const updated = projectionInput(); updated.steps[0].id = first.steps[0].id;
    updated.steps[1].id = first.steps[1].id; updated.steps[0].detail = 'New review';
    await drafts.applyImplementationPlan(handle,
        await drafts.previewImplementationPlan(handle, 0, 1, updated), true);
    await assert.rejects(drafts.applyImplementationPlanProjection(root, preview, true), /Stale/);
    const foreign = await mkdtemp(join(tmpdir(), 'dope-plan-foreign-'));
    try { await assert.rejects(drafts.previewImplementationPlanProjection(foreign, handle), /unavailable/); }
    finally { await rm(foreign, { recursive: true, force: true }); }
    const oldBytes = await readFile(join(root, '.dope', 'roadmap-drafts.json'), 'utf8');
    const { handle: roadmap } = await drafts.begin(root);
    await assert.rejects(drafts.previewImplementationPlanProjection(root, handle), /Existing Roadmap draft/);
    const phase = drafts.edit(roadmap, 0, { type: 'create-phase', title: 'Existing' });
    drafts.edit(roadmap, phase.revision, { type: 'create-checkpoint', phaseId: phase.phases[0].id, title: 'Scope' });
    await drafts.accept(roadmap, drafts.preview(roadmap, 'ROADMAP.md'), true);
    const markdown = await readFile(join(root, 'ROADMAP.md'), 'utf8');
    await assert.rejects(drafts.previewImplementationPlanProjection(root, handle), /Existing or changed Roadmap/);
    assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), markdown);
    assert.notEqual(await readFile(join(root, '.dope', 'roadmap-drafts.json'), 'utf8'), oldBytes);
}));

test('source change and invalid outcome graph leave reviewed plan recoverable without Roadmap writes', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const path = join(root, 'history.ts');
    await writeFile(path, 'export const history = 1;\n');
    const { handle } = await drafts.beginImplementationPlan(root);
    const input = projectionInput();
    input.evidence = [{ id: '123e4567-e89b-42d3-a456-426614174000', path: 'history.ts',
        sha256: createHash('sha256').update('export const history = 1;\n').digest('hex') }];
    input.steps[0].evidenceIds = [input.evidence[0].id];
    await drafts.applyImplementationPlan(handle,
        await drafts.previewImplementationPlan(handle, 0, 0, input), true);
    const preview = await drafts.previewImplementationPlanProjection(root, handle);
    await writeFile(path, 'export const history = 2;\n');
    await assert.rejects(drafts.applyImplementationPlanProjection(root, preview, true), /source changed/);
    assert.equal((await store.read(root)).revision, 0);
    assert.equal(drafts.read(handle).phases.length, 0);
    assert.equal((await drafts.listImplementationPlans(root))[0].handle, handle);
    await assert.rejects(drafts.previewImplementationPlanProjection(root, handle), /source changed/);
    await writeFile(path, 'export const history = 1;\n');
    const duplicate = projectionInput(); duplicate.steps[1].title = duplicate.steps[0].title;
    const accepted = drafts.readImplementationPlan(handle)!;
    duplicate.steps[0].id = accepted.steps[0].id; duplicate.steps[1].id = accepted.steps[1].id;
    await drafts.applyImplementationPlan(handle,
        await drafts.previewImplementationPlan(handle, 0, 1, duplicate), true);
    await assert.rejects(drafts.previewImplementationPlanProjection(root, handle), /unique Roadmap graph/);
    assert.equal((await store.read(root)).revision, 0);
}));

test('reviewed plan revisions preserve IDs and decisions, and reject invalid order', async () => fixture(async root => {
    const drafts = new RoadmapGreenfield(new RoadmapStore());
    const { handle } = await drafts.beginImplementationPlan(root);
    const first = await drafts.previewImplementationPlan(handle, 0, 0, planInput());
    const accepted = await drafts.applyImplementationPlan(handle, first, true);
    const common = { type: 'implementation-plan-revision' as const, baseRevision: 1,
        constraintsAdd: [], decisionsAdd: ['Use existing editor'], question: '' };
    const split = reviseImplementationPlan(accepted, { ...common,
        edits: [{ type: 'split', step: 2, title: 'Test history', detail: 'Add focused tests' }] });
    assert.deepEqual(split.steps.slice(0, 2).map(step => step.id), accepted.steps.map(step => step.id));
    assert.equal(split.steps[2].id, undefined);
    assert.deepEqual(split.decisions[0], accepted.decisions[0]);
    assert.equal(split.decisions[1].origin, 'model-assumption');
    const preview = await drafts.previewImplementationPlan(handle, 0, 1, split, 'model');
    assert.deepEqual(drafts.readImplementationPlan(handle), accepted);
    assert.deepEqual(preview.after.decisions[0], accepted.decisions[0]);
    const revised = await drafts.applyImplementationPlan(handle, preview, true);
    assert.equal(revised.steps[2].dependencies[0], revised.steps[1].id);
    const merge = reviseImplementationPlan(revised, { ...common, baseRevision: 2,
        edits: [{ type: 'merge', first: 2, second: 3, title: 'Build and test', detail: 'Use existing editor' }] });
    assert.equal(merge.steps[1].id, revised.steps[1].id);
    assert.equal(merge.steps.length, 2);
    assert.deepEqual(merge.decisions.slice(0, 2), revised.decisions);
    const moved = reviseImplementationPlan(accepted, { ...common,
        edits: [{ type: 'move', step: 2, before: 1 }] });
    assert.deepEqual(moved.steps.map(step => step.id), [accepted.steps[1].id, accepted.steps[0].id]);
    assert.throws(() => reviseImplementationPlan(revised, { ...common, baseRevision: 2,
        edits: [{ type: 'move', step: 3, before: 2 }] }), /order|cycle/);
    await assert.rejects(drafts.previewImplementationPlan(handle, 0, 1, merge, 'model'), /Stale/);
}));

test('accepted implementation plan survives restart and Chat binding without changing canonical owners', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const { handle } = await drafts.begin(root);
    const chatId = '123e4567-e89b-42d3-a456-426614174001';
    drafts.bindChat(root, handle, chatId);
    const before = await store.read(root);
    const input = planInput();
    const first = await drafts.previewImplementationPlan(handle, 0, 0, input);
    assert.equal(first.after.status, 'proposed');
    assert.equal(drafts.readImplementationPlan(handle), undefined);
    await assert.rejects(drafts.applyImplementationPlan(handle, first, false), /approval/);
    const accepted = await drafts.applyImplementationPlan(handle, first, true);
    assert.equal(accepted.status, 'accepted');
    assert.deepEqual(accepted.constraints, ['Keep permissions explicit']);
    assert.deepEqual(accepted.decisions, [{ text: 'Reuse the diff editor', origin: 'developer' }]);
    const saved = await readFile(join(root, '.dope', 'roadmap-drafts.json'), 'utf8');
    const restored = new RoadmapGreenfield(store);
    await restored.restore(root);
    assert.equal(restored.chatDraft(root, chatId)?.handle, handle);
    assert.deepEqual(restored.readImplementationPlan(handle), accepted);
    const revised = planInput();
    revised.steps[0].id = accepted.steps[0].id;
    revised.steps[1].id = accepted.steps[1].id;
    revised.steps[1].dependencies = [accepted.steps[0].id];
    const update = await restored.previewImplementationPlan(handle, 0, 1, revised);
    assert.deepEqual(restored.readImplementationPlan(handle), accepted);
    const second = await restored.applyImplementationPlan(handle, update, true);
    assert.deepEqual(second.steps.map(step => step.id), accepted.steps.map(step => step.id));
    assert.deepEqual(second.steps[1].dependencies, [accepted.steps[0].id]);
    assert.equal((await store.read(root)).revision, before.revision);
    assert.deepEqual((await store.read(root)).checkpoints, before.checkpoints);
    assert.deepEqual(await readdir(root), ['.dope']);
    assert.notEqual(await readFile(join(root, '.dope', 'roadmap-drafts.json'), 'utf8'), saved);
}));

test('plan validation, review, owner handoff and corrupt storage fail closed', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const { handle } = await drafts.begin(root);
    const empty = planInput(); empty.steps = [];
    const emptyPreview = await drafts.previewImplementationPlan(handle, 0, 0, empty);
    assert.equal((await drafts.applyImplementationPlan(handle, emptyPreview, true)).steps.length, 0);
    const proposed = await drafts.previewImplementationPlan(handle, 0, 1, planInput(), 'model');
    assert.equal(proposed.after.decisions[0].origin, 'developer');
    drafts.clearImplementationPlanPreview(handle);
    await assert.rejects(drafts.applyImplementationPlan(handle, proposed, true), /Stale/);
    const valid = await drafts.previewImplementationPlan(handle, 0, 1, planInput());
    assert.equal((await drafts.applyImplementationPlan(handle, valid, true)).steps.length, 2);
    const current = drafts.readImplementationPlan(handle)!;
    const duplicate = planInput(); duplicate.steps[0].id = current.steps[0].id;
    duplicate.steps[1].id = current.steps[0].id;
    await assert.rejects(drafts.previewImplementationPlan(handle, 0, 2, duplicate), /cyclic/);
    const cyclic = planInput(); cyclic.steps[0].id = current.steps[0].id;
    cyclic.steps[1].id = current.steps[1].id;
    cyclic.steps[0].dependencies = [current.steps[1].id];
    cyclic.steps[1].dependencies = [current.steps[0].id];
    await assert.rejects(drafts.previewImplementationPlan(handle, 0, 2, cyclic), /cyclic/);
    await assert.rejects(drafts.previewImplementationPlan(handle, 0, 1, planInput()), /Stale/);
    const oversized = planInput(); oversized.steps[0].detail = 'x'.repeat(8193);
    const unchangedBytes = await readFile(join(root, '.dope', 'roadmap-drafts.json'), 'utf8');
    await assert.rejects(drafts.previewImplementationPlan(handle, 0, 2, oversized), /Invalid/);
    assert.equal(await readFile(join(root, '.dope', 'roadmap-drafts.json'), 'utf8'), unchangedBytes);
    const stale = await drafts.previewImplementationPlan(handle, 0, 2, planInput());
    drafts.bindChat(root, handle, '123e4567-e89b-42d3-a456-426614174002');
    await assert.rejects(drafts.applyImplementationPlan(handle, stale, true), /Stale/);
    assert.deepEqual(drafts.readImplementationPlan(handle), current);
    const saved = await readFile(join(root, '.dope', 'roadmap-drafts.json'), 'utf8');
    const parsed = JSON.parse(saved);
    delete parsed.drafts[0].implementationPlan;
    await writeFile(join(root, '.dope', 'roadmap-drafts.json'), JSON.stringify(parsed));
    const legacy = new RoadmapGreenfield(store);
    await legacy.restore(root);
    assert.equal(legacy.readImplementationPlan(handle), undefined);
    const invalid = JSON.parse(saved);
    invalid.drafts[0].implementationPlan.status = 'proposed';
    await writeFile(join(root, '.dope', 'roadmap-drafts.json'), JSON.stringify(invalid));
    await assert.rejects(new RoadmapGreenfield(store).restore(root), /Corrupt/);
    await writeFile(join(root, '.dope', 'roadmap-drafts.json'), saved.slice(0, 40));
    await assert.rejects(new RoadmapGreenfield(store).restore(root), /Corrupt/);
    assert.equal((await store.read(root)).revision, 0);
}));

test('plan-only handle on an existing Roadmap keeps canonical state and denies stale source', async () => fixture(async root => {
    const store = new RoadmapStore();
    await store.mutate(root, 0, { type: 'create', id: 'owned', kind: 'phase', title: 'Existing',
        objective: '', order: 0 });
    const before = await store.read(root);
    const drafts = new RoadmapGreenfield(store);
    const { handle, ownerRevision } = await drafts.beginImplementationPlan(root);
    assert.equal(ownerRevision, before.revision);
    const chatId = '123e4567-e89b-42d3-a456-426614174003';
    drafts.bindChat(root, handle, chatId);
    assert.equal(drafts.chatDraft(root, chatId), undefined);
    assert.equal(drafts.chatImplementationPlan(root, chatId)?.handle, handle);
    assert.deepEqual(await drafts.list(root), []);
    assert.throws(() => drafts.edit(handle, 0, { type: 'create-phase', title: 'Wrong owner' }), /Stale/);
    const preview = await drafts.previewImplementationPlan(handle, 0, 0, planInput());
    const accepted = await drafts.applyImplementationPlan(handle, preview, true);
    assert.equal(accepted.source.roadmapRevision, before.revision);
    const restored = new RoadmapGreenfield(store);
    assert.deepEqual(await restored.restore(root), []);
    assert.deepEqual(restored.chatImplementationPlan(root, chatId)?.plan, accepted);
    assert.deepEqual(await store.read(root), before);
    const stale = await restored.previewImplementationPlan(handle, 0, 1, planInput());
    await store.mutate(root, before.revision, { type: 'create', id: 'new', kind: 'phase', title: 'Changed',
        objective: '', order: 1 });
    await assert.rejects(restored.applyImplementationPlan(handle, stale, true), /Stale/);
    assert.deepEqual(restored.readImplementationPlan(handle), accepted);
    const reopened = new RoadmapGreenfield(store);
    await reopened.restore(root);
    assert.deepEqual(reopened.readImplementationPlan(handle), accepted);
    await assert.rejects(reopened.previewImplementationPlan(handle, 0, 1, planInput()), /Stale/);
}));
