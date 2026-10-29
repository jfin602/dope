import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';

const fixture = async (run: (root: string) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-gate-create-sync-'));
    try { await run(root); } finally { await rm(root, { recursive: true, force: true }); }
};

test('reviewed Gate creation accepts schema-two structure without publishing the proposed Markdown', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const { handle } = await drafts.begin(root);
    const phase = drafts.edit(handle, 0, { type: 'create-phase', title: 'Build', objective: 'Playable build' });
    const phaseId = phase.phases[0].id;
    const gatePreview = drafts.previewEdit(handle, 1, { type: 'create-gate', phaseId,
        title: 'Smoke check', purpose: 'Verify startup' });
    assert.equal(drafts.read(handle).phases[0].gates?.length ?? 0, 0);
    const gateDraft = await drafts.applyEdit(handle, gatePreview, true);
    const gateId = gateDraft.phases[0].gates![0].id;
    const criterionPreview = drafts.previewEdit(handle, 2, { type: 'add-criterion', phaseId, gateId,
        title: 'Startup', expectedResult: 'Application starts without errors' });
    await drafts.applyEdit(handle, criterionPreview, true);
    const preview = drafts.preview(handle, 'ROADMAP.md');
    assert.match(preview.markdown, new RegExp(`\\[phase: ${phaseId}\\]`));
    assert.match(preview.unresolvedCoverage.join(' '), /Gate-set coverage is not approved/);
    await assert.rejects(drafts.accept(handle, preview, false), /approval/);
    assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
    const index = await drafts.accept(handle, preview, true);
    assert.equal(index.linkedDocument, undefined);
    assert.equal(index.gates[0].parentPhaseId, phaseId);
    assert.equal(index.gates[0].criteria.length, 1);
    assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
    assert.equal((await store.read<typeof index>(root)).gates.length, 1);
    // A later publication is a distinct owner action; parsing these bytes does not change the accepted index.
    await writeFile(join(root, 'ROADMAP.md'), preview.markdown);
    const importPreview = await previewRoadmapImport(root, 'ROADMAP.md');
    assert.deepEqual(importPreview.gateSource.diagnostics, []);
    assert.equal(importPreview.gateSource.gates[0].parentPhaseId, phaseId);
    assert.equal((await store.read<typeof index>(root)).linkedDocument, undefined);
    assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), preview.markdown);
}));

test('a phase-only accepted draft remains unplanned and has no canonical source', async () => fixture(async root => {
    const store = new RoadmapStore(), drafts = new RoadmapGreenfield(store);
    const { handle } = await drafts.begin(root);
    drafts.edit(handle, 0, { type: 'create-phase', title: 'Investigate', objective: 'Discover scope' });
    const preview = drafts.preview(handle, 'ROADMAP.md');
    assert.equal(preview.gates.length, 0);
    assert.match(preview.unresolvedCoverage.join(' '), /no accepted Gates/);
    const index = await drafts.accept(handle, preview, true);
    assert.equal(index.gates.length, 0);
    assert.equal(index.phases[0].gateSetCoverage.status, 'unreviewed');
    assert.equal((await readdir(root)).includes('ROADMAP.md'), false);
}));
