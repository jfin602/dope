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

test('whole strategic draft is one reviewed noncanonical transaction with stable dependency identities', async () => fixture(async root => {
    const store = new RoadmapStore(), greenfield = new RoadmapGreenfield(store);
    const sourceHash = 'a'.repeat(64), projectId = (await store.read(root)).projectId;
    const chatId = '123e4567-e89b-42d3-a456-426614174000';
    const phases = ['Foundation', 'First playable', 'Expansion'].map((title, phase) => ({
        title, objective: `Deliver ${title.toLowerCase()} outcome`,
        checkpoints: [{ title: `${title} milestone`, objective: `Verify ${title.toLowerCase()} outcome`,
            dependsOn: phase ? [phase] : [] }] }));
    const input = { projectId, ownerRevision: 0, phases };
    const preview = await greenfield.previewStrategicDraft(root, input, sourceHash);
    assert.equal(preview.after.phases.length, 3);
    assert.equal(preview.after.phases[2].checkpoints[0].dependencies?.[0],
        preview.after.phases[1].checkpoints[0].id);
    assert.equal((await greenfield.readOpportunity(root)).drafts, 0);
    assert.equal((await store.read(root)).revision, 0);
    assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
    await assert.rejects(greenfield.acceptStrategicDraft(root, chatId, preview, 'b'.repeat(64)), /source/);
    const review = await greenfield.previewStrategicDraft(root, input, sourceHash);
    assert.equal((await greenfield.acceptStrategicDraft(root, chatId, review, sourceHash)).revision, 1);
    assert.equal((await greenfield.readOpportunity(root)).drafts, 1);
    assert.equal((await store.read(root)).revision, 0);
    assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
    const restored = new RoadmapGreenfield(store);
    assert.equal((await restored.restore(root))[0]?.draft.phases.length, 3);
    await assert.rejects(greenfield.acceptStrategicDraft(root, chatId, review, sourceHash), /Stale/);
}));

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
