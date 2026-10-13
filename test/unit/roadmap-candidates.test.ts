import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { discoverRoadmapCandidates, previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';

const fixture = async (run: (root: string) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-candidates-'));
    try { await run(root); }
    finally { await rm(root, { recursive: true, force: true }); }
};

test('discovers bounded project Markdown and previews selected phases, corrections and checklists without writes', async () => fixture(async root => {
    await mkdir(join(root, 'docs'));
    const markdown = '# Roadmap\n\n## Phase 1 — Start\nStatus: ACTIVE\n- [x] Set up\n- [ ] Ship\n\n## Correction — Repair\nStatus: NOT GREEN\n';
    await writeFile(join(root, 'ROADMAP.md'), markdown);
    await writeFile(join(root, 'docs/roadmap.md'), '# Roadmap\n## Phase 2 — Next\nStatus: PENDING REVIEW\n');
    const discovered = await discoverRoadmapCandidates(root);
    assert.deepEqual(discovered.candidates.map(candidate => candidate.path), ['ROADMAP.md', 'docs/roadmap.md']);
    assert.equal(discovered.candidates[0].sha256, createHash('sha256').update(markdown).digest('hex'));
    const before = await readFile(join(root, 'ROADMAP.md'));
    const preview = await previewRoadmapImport(root, 'ROADMAP.md');
    assert.equal(preview.roadmapPath, 'ROADMAP.md');
    assert.deepEqual(preview.checkpoints.map(item => item.sectionKey), [
        'phase-1', 'phase-1/checklist-set-up', 'phase-1/checklist-ship', 'correction-repair',
    ]);
    assert.deepEqual(preview.checkpoints.map(item => item.source.line), [3, 5, 6, 8]);
    assert.ok(preview.checkpoints.every(item => item.source.sha256 === discovered.candidates[0].sha256));
    assert.equal(preview.checkpoints[1].status, 'unknown'); // A checked box is not a Green gate.
    assert.equal(preview.checkpoints[1].readOnly, true);
    assert.equal(preview.checkpoints[3].status, 'not-green');
    assert.deepEqual(await readFile(join(root, 'ROADMAP.md')), before);
    assert.equal(preview.mind, undefined);
}));

test('missing, duplicate, ambiguous and unsupported selected source remains explicit', async () => fixture(async root => {
    await assert.rejects(previewRoadmapImport(root, 'ROADMAP.md'), /Missing roadmap source/);
    await writeFile(join(root, 'ROADMAP.md'), '# Roadmap\n## Phase 1 — One\nStatus: GREEN and NOT GREEN\n- [ ] Same\n- [ ] Same\n## Phase 1 — Two\nStatus: GREEN\n## Unmapped prose\nText\n');
    const preview = await previewRoadmapImport(root, 'ROADMAP.md');
    assert.ok(preview.checkpoints.filter(item => item.sectionKey === 'phase-1').every(item => item.readOnly && item.diagnostics.includes('Duplicate checkpoint heading/key')));
    assert.ok(preview.checkpoints.filter(item => item.sectionKey === 'phase-1/checklist-same').every(item => item.readOnly && item.diagnostics.includes('Duplicate checklist item/key')));
    assert.ok(preview.checkpoints[0].diagnostics.includes('Ambiguous status'));
    assert.ok(preview.diagnostics.some(item => item.includes('Unsupported roadmap section')));
}));

test('rejects selected symlinks, outside paths and oversized sources; discovery does not follow symlinks', async () => fixture(async root => {
    await mkdir(join(root, 'docs'));
    const outside = await mkdtemp(join(tmpdir(), 'dope-roadmap-outside-'));
    try {
        await writeFile(join(outside, 'outside.md'), '## Phase 1\nStatus: GREEN\n');
        await symlink(join(outside, 'outside.md'), join(root, 'ROADMAP.md'));
        const discovered = await discoverRoadmapCandidates(root);
        assert.deepEqual(discovered.candidates, []);
        assert.ok(discovered.diagnostics.some(item => item.includes('Unsafe candidate skipped')));
        await assert.rejects(previewRoadmapImport(root, 'ROADMAP.md'), /Unsafe roadmap source path/);
        await assert.rejects(previewRoadmapImport(root, '../outside.md'), /Unsafe roadmap source path/);
        await assert.rejects(previewRoadmapImport(root, join(outside, 'outside.md')), /Unsafe roadmap source path/);
        await writeFile(join(root, 'docs/roadmap.md'), Buffer.alloc(2 * 1024 * 1024 + 1));
        const oversized = await discoverRoadmapCandidates(root);
        assert.ok(oversized.diagnostics.some(item => item.includes('Oversized')));
        await assert.rejects(previewRoadmapImport(root, 'docs/roadmap.md'), /Roadmap source inventory limit exceeded/);
    } finally { await rm(outside, { recursive: true, force: true }); }
}));
