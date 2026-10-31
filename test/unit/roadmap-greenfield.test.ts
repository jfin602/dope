import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
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

test('retired accepted plans stay readable and do not own new Roadmap drafts', async () => fixture(async root => {
    const store = new RoadmapStore(), projectId = (await store.read(root)).projectId;
    const handle = '123e4567-e89b-42d3-a456-426614174000';
    const chatId = '123e4567-e89b-42d3-a456-426614174001';
    const plan = { schemaVersion: 1, revision: 1, status: 'accepted', objective: 'Historical plan',
        constraints: [], steps: [], evidence: [], decisions: [],
        source: { projectId, roadmapRevision: 0, draftRevision: 0 } };
    await mkdir(join(root, '.dope'));
    await writeFile(join(root, '.dope', 'roadmap-drafts.json'), JSON.stringify({ schemaVersion: 1,
        revision: 1, drafts: [{ handle, projectId, value: { revision: 0, phases: [] },
            chatId, planOnly: true, ownerRevision: 0, implementationPlan: plan }] }));
    const drafts = new RoadmapGreenfield(store);
    assert.deepEqual(await drafts.restore(root), []);
    assert.equal((await drafts.listImplementationPlans(root))[0].plan.objective, 'Historical plan');
    assert.equal((await drafts.readOpportunity(root)).drafts, 0);
    const created = await drafts.begin(root);
    assert.notEqual(created.handle, handle);
    assert.equal((await drafts.listImplementationPlans(root))[0].plan.objective, 'Historical plan');
    assert.equal((await drafts.list(root)).length, 1);
    drafts.cancel(created.handle);
    const sourceHash = 'a'.repeat(64);
    const preview = await drafts.previewStrategicDraft(root, { projectId, ownerRevision: 0,
        phases: [{ title: 'New Roadmap', objective: 'Keep planning', checkpoints: [
            { title: 'First step', objective: 'Deliver it', dependsOn: [] }] }] }, sourceHash);
    await drafts.acceptStrategicDraft(root, chatId, preview, sourceHash);
    assert.equal(drafts.chatDraft(root, chatId)?.handle, preview.handle);
    assert.equal((await drafts.listImplementationPlans(root))[0].plan.objective, 'Historical plan');
    const saved = JSON.parse(await readFile(join(root, '.dope', 'roadmap-drafts.json'), 'utf8'));
    assert.equal(saved.drafts.find((item: { handle: string }) => item.handle === handle).chatId, undefined);
}));

test('eight historical plans cannot exhaust the live draft allowance', async () => fixture(async root => {
    const store = new RoadmapStore(), projectId = (await store.read(root)).projectId;
    const plan = { schemaVersion: 1, revision: 1, status: 'accepted', objective: 'Historical plan',
        constraints: [], steps: [], evidence: [], decisions: [],
        source: { projectId, roadmapRevision: 0, draftRevision: 0 } };
    await mkdir(join(root, '.dope'));
    await writeFile(join(root, '.dope', 'roadmap-drafts.json'), JSON.stringify({ schemaVersion: 1,
        revision: 1, drafts: Array.from({ length: 8 }, (_, index) => ({
            handle: `123e4567-e89b-42d3-a456-42661417400${index}`, projectId,
            value: { revision: 0, phases: [] }, planOnly: true, ownerRevision: 0,
            implementationPlan: plan })) }));
    const drafts = new RoadmapGreenfield(store);
    assert.equal((await drafts.listImplementationPlans(root)).length, 8);
    await drafts.begin(root);
    assert.equal((await drafts.list(root)).length, 1);
    assert.equal((await drafts.listImplementationPlans(root)).length, 8);
}));
