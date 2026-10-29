import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { evaluatePhaseQualification } from '../../packages/project-intelligence/lib/node/roadmap-gate-domain.js';

const fixture = async (run: (root: string) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-greenfield-'));
    try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
};
const chatId = '123e4567-e89b-42d3-a456-426614174000';
const hash = 'a'.repeat(64);

test('schema-two Gate draft is proposed, explicitly accepted, and remains unqualified without Markdown', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const input = { projectId: 'uninitialized', ownerRevision: 0, phases: [{
        title: 'Release', objective: 'Release a playable build', checkpoints: [], gates: [{
            title: 'Player completion', purpose: 'Verify a complete game run',
            criteria: [{ title: 'Win path', expectedResult: 'A full run reaches the victory screen' }] }] }] };
    const proposal = await drafts.previewStrategicDraft(root, input, hash);
    const gate = proposal.after.phases[0].gates![0];
    assert.equal(gate.parentPhaseId, proposal.after.phases[0].id);
    assert.equal(gate.designation, 'G1');
    assert.equal(gate.criteria.length, 1);
    assert.equal((await drafts.readOpportunity(root)).proposedGates, 1);
    assert.equal((await drafts.readOpportunity(root)).draftGates, 0);
    assert.equal((await store.read(root)).revision, 0);
    await assert.rejects(drafts.acceptStrategicDraft(root, chatId, proposal, 'b'.repeat(64)), /source/);
    const reviewed = await drafts.previewStrategicDraft(root, input, hash);
    const acceptedDraft = await drafts.acceptStrategicDraft(root, chatId, reviewed, hash);
    assert.equal(acceptedDraft.phases[0].gates![0].id, gate.id);
    assert.equal((await drafts.readOpportunity(root)).proposedGates, 0);
    assert.equal((await drafts.readOpportunity(root)).draftGates, 1);
    assert.equal((await drafts.readOpportunity(root)).gates, 0);
    const restored = new RoadmapGreenfield(store);
    assert.equal((await restored.restore(root))[0].draft.phases[0].gates![0].id, gate.id);
    assert.equal(restored.chatDraft(root, chatId)?.draft.phases[0].gates![0].id, gate.id);
    const phaseId = acceptedDraft.phases[0].id;
    const criterionId = gate.criteria[0].id;
    const edit = restored.previewEdit(reviewed.handle, 1, { type: 'edit-criterion', phaseId,
        gateId: gate.id, criterionId, expectedResult: 'A full run reaches victory with zero errors' });
    await assert.rejects(restored.applyEdit(reviewed.handle, edit, false), /approval/);
    await restored.applyEdit(reviewed.handle, edit, true);
    const publicationPreview = restored.preview(reviewed.handle, 'ROADMAP.md');
    assert.equal(publicationPreview.gates.length, 1);
    await assert.rejects(restored.accept(reviewed.handle, publicationPreview, false), /approval/);
    const index = await restored.accept(reviewed.handle, publicationPreview, true);
    assert.equal(index.schemaVersion, 2);
    assert.equal(index.gates.length, 1);
    assert.equal(index.gates[0].parentPhaseId, phaseId);
    assert.equal(index.gates[0].criteria[0].id, criterionId);
    assert.equal(index.gates[0].draftAcceptance, 'accepted');
    assert.deepEqual(index.phases[0].gateSetCoverage, { status: 'unreviewed' });
    assert.equal(evaluatePhaseQualification(index, phaseId).status, 'planned');
    assert.equal(index.linkedDocument, undefined);
    assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
    assert.equal((await new RoadmapStore().read<typeof index>(root)).gates.length, 1);
    assert.equal((await restored.readOpportunity(root)).gates, 1);
    assert.equal((await restored.readOpportunity(root)).draftGates, 0);
    assert.equal((await restored.readOpportunity(root)).proposedGates, 0);
}));

test('phase-only and task-only drafts remain reviewable with zero accepted Gates', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const proposal = await drafts.previewStrategicDraft(root, { projectId: 'uninitialized', ownerRevision: 0,
        allowIncomplete: true, phases: [{ title: 'Build', objective: 'Playable game', checkpoints: [
            { title: 'Implement movement', objective: '', dependsOn: [] }] }] }, hash);
    assert.equal(proposal.after.phases[0].gates?.length, 0);
    const accepted = await drafts.acceptStrategicDraft(root, chatId, proposal, hash);
    const preview = drafts.preview(proposal.handle, 'ROADMAP.md');
    assert.match(preview.unresolvedCoverage.join(' '), /not Gates/);
    assert.equal(preview.gates.length, 0);
    const index = await drafts.accept(proposal.handle, preview, true);
    assert.equal(index.gates.length, 0);
    assert.equal(evaluatePhaseQualification(index, accepted.phases[0].id).status, 'unplanned');
    assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
}));

test('duplicate, foreign and stale Gate reviews cannot cross project or write a canonical file', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const input = { projectId: 'uninitialized', ownerRevision: 0, phases: [{ title: 'Verify',
        objective: 'Verified product', checkpoints: [], gates: [{ title: 'Smoke', purpose: 'Check startup',
            criteria: [{ title: 'Startup', expectedResult: 'App starts without error' }] }] }] };
    const preview = await drafts.previewStrategicDraft(root, input, hash);
    await assert.rejects(drafts.previewStrategicDraft(root, input, hash), /awaits review/);
    await assert.rejects(drafts.acceptStrategicDraft(root, chatId, { ...preview, projectId: 'foreign' }, hash), /Stale/);
    await assert.rejects(drafts.acceptStrategicDraft(root, chatId, preview, hash), /Stale/);
    const next = await drafts.previewStrategicDraft(root, input, hash);
    drafts.rejectStrategicDraft(next.token);
    await assert.rejects(drafts.acceptStrategicDraft(root, chatId, next, hash), /Stale/);
    assert.equal((await store.read(root)).revision, 0);
    assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
}));

test('stale Gate edit, foreign parent and existing Markdown source fail closed', async () => fixture(async root => {
    const drafts = new RoadmapGreenfield(new RoadmapStore());
    const { handle } = await drafts.begin(root);
    const first = drafts.edit(handle, 0, { type: 'create-phase', title: 'Build', objective: 'Playable build' });
    const phaseId = first.phases[0].id;
    assert.throws(() => drafts.previewEdit(handle, 1, { type: 'create-gate', phaseId: chatId,
        title: 'Smoke', purpose: 'Verify startup' }), /Unknown/);
    const stale = drafts.previewEdit(handle, 1, { type: 'create-gate', phaseId,
        title: 'Smoke', purpose: 'Verify startup' });
    drafts.edit(handle, 1, { type: 'edit-phase', phaseId, objective: 'Revised build' });
    await assert.rejects(drafts.applyEdit(handle, stale, true), /Stale/);
    await writeFile(join(root, 'ROADMAP.md'), '# Existing Roadmap\n');
    assert.throws(() => drafts.preview(handle, 'ROADMAP.md'), /Existing canonical Roadmap/);
    await assert.rejects(drafts.acceptStrategicDraft(root, chatId, { token: 'fake' } as never, hash), /Stale/);
    assert.equal((await readdir(root)).includes('ROADMAP.md'), true);
}));

test('symlinked proposed Markdown target is refused before structural review', async () => fixture(async root => {
    const drafts = new RoadmapGreenfield(new RoadmapStore());
    const { handle } = await drafts.begin(root);
    drafts.edit(handle, 0, { type: 'create-phase', title: 'Build', objective: 'Playable build' });
    await symlink('/tmp/elsewhere.md', join(root, 'PLAN.md'));
    assert.throws(() => drafts.preview(handle, 'PLAN.md'), /unsafe/);
    assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
}));

test('an existing recognized Roadmap source requires import before a greenfield owner is created', async () => fixture(async root => {
    await mkdir(join(root, 'docs/roadmap'), { recursive: true });
    await writeFile(join(root, 'docs/roadmap/mvp-roadmap.md'), '# Roadmap\n\n## Phase 1: Existing\n');
    const drafts = new RoadmapGreenfield(new RoadmapStore());
    await assert.rejects(drafts.begin(root), /candidate requires reviewed import/);
    assert.equal((await readdir(root)).includes('.dope'), false);
}));
