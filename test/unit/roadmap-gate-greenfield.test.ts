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
