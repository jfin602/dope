import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';

const fixture = async (run: (root: string) => Promise<void>): Promise<void> => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-import-'));
    try {
        await mkdir(join(root, 'docs/roadmap'), { recursive: true });
        await mkdir(join(root, 'docs/planning/p1'), { recursive: true });
        await mkdir(join(root, 'docs/tasks/p1'), { recursive: true });
        await writeFile(join(root, 'docs/planning/p1/phase-1-plan.md'), '# Phase 1 Plan\n');
        await writeFile(join(root, 'docs/tasks/p1/closeout.md'), '# Phase 1 closeout — NOT GREEN\n');
        await writeFile(join(root, 'known-issues.md'), '# Known Issues\n');
        await run(root);
    } finally { await rm(root, { recursive: true, force: true }); }
};
const source = (body: string) => `# Dope Roadmap\n\n${body}`;

test('previews real shaped headings and linked evidence without initializing Mind or touching source bytes', async () => fixture(async root => {
    const path = join(root, 'docs/roadmap/mvp-roadmap.md');
    const markdown = source('## Product Phase 1 — IDE Alive\n\nStatus: **NOT QUALIFIED — OWNER AUTHORIZED PHASE 2 SEQUENCING**\n\nSee `docs/planning/p1/phase-1-plan.md`.\n');
    await writeFile(path, markdown);
    const before = await readFile(path);
    const preview = await previewRoadmapImport(root);
    assert.equal(preview.checkpoints.length, 1);
    const checkpoint = preview.checkpoints[0];
    assert.equal(checkpoint.id, 'roadmap:docs/roadmap/mvp-roadmap.md#phase-1');
    assert.equal(checkpoint.status, 'not-green');
    assert.match(checkpoint.statusText!, /NOT QUALIFIED/);
    assert.equal(checkpoint.source.sha256, createHash('sha256').update(before).digest('hex'));
    assert.ok(checkpoint.evidence.some(ref => ref.path === 'docs/tasks/p1/closeout.md'));
    assert.equal(checkpoint.readOnly, false);
    assert.deepEqual(await readFile(path), before);
    assert.deepEqual(await readdir(root), ['docs', 'known-issues.md']);
    assert.equal(preview.mind, undefined);
}));

test('reordering preserves path/section IDs while duplicate and unknown statuses stay read-only', async () => fixture(async root => {
    const path = join(root, 'docs/roadmap/mvp-roadmap.md');
    const first = '## Product Phase 1 — IDE Alive\nStatus: **GREEN / QUALIFIED**\n';
    const second = '## Mandatory correction — `c1-repair`\nStatus: **NOT GREEN**\n';
    await writeFile(path, source(`${first}\n${second}`));
    const a = await previewRoadmapImport(root);
    await writeFile(path, source(`${second}\n${first}`));
    const b = await previewRoadmapImport(root);
    assert.deepEqual(a.checkpoints.map(item => item.id).sort(), b.checkpoints.map(item => item.id).sort());
    await writeFile(path, source(`${first}\n${first}\n## Product Phase 2 — Mind\nStatus: **PENDING REVIEW**\n`));
    const c = await previewRoadmapImport(root);
    assert.ok(c.checkpoints.slice(0, 2).every(item => item.readOnly && item.diagnostics.includes('Duplicate checkpoint heading/key')));
    assert.equal(c.checkpoints[2].status, 'unknown');
    assert.equal(c.checkpoints[2].readOnly, true);
}));

test('unsafe and missing references remain read-only; symlink sources are not followed', async () => fixture(async root => {
    const path = join(root, 'docs/roadmap/mvp-roadmap.md');
    await writeFile(path, source('## Product Phase 1 — IDE Alive\nStatus: **GREEN**\nSee `docs/planning/../escape.md` and `docs/tasks/p1/missing.md`.\n'));
    const preview = await previewRoadmapImport(root);
    assert.equal(preview.checkpoints[0].readOnly, true);
    assert.ok(preview.checkpoints[0].diagnostics.some(message => message.startsWith('Unsafe reference:')));
    assert.ok(preview.checkpoints[0].diagnostics.some(message => message.startsWith('Missing reference:')));
    await symlink(join(root, 'known-issues.md'), join(root, 'docs/planning/p1/linked.md'));
    const linked = await previewRoadmapImport(root);
    assert.ok(linked.diagnostics.some(message => message.startsWith('Unsafe source skipped:')));
    await rm(path);
    await symlink(join(root, 'known-issues.md'), path);
    await assert.rejects(previewRoadmapImport(root), /Unsafe roadmap source path/);
}));

test('ambiguous verdicts and unsupported fenced headings cannot become editable checkpoints', async () => fixture(async root => {
    await writeFile(join(root, 'docs/roadmap/mvp-roadmap.md'), source(
        '## Product Phase 1 — IDE Alive\nStatus: **GREEN and NOT GREEN**\n\n```md\n## Product Phase 99 — example\nStatus: GREEN\n```\n'));
    const preview = await previewRoadmapImport(root);
    assert.equal(preview.checkpoints.length, 1);
    assert.equal(preview.checkpoints[0].readOnly, true);
    assert.ok(preview.checkpoints[0].diagnostics.includes('Ambiguous status'));
    assert.ok(preview.diagnostics.some(message => message.startsWith('Unsupported fenced roadmap heading')));
}));

test('existing Mind is observed without changing its revision or bytes', async () => fixture(async root => {
    await writeFile(join(root, 'docs/roadmap/mvp-roadmap.md'), source('## Product Phase 1 — IDE Alive\nStatus: **GREEN**\n'));
    await mkdir(join(root, '.dope'));
    const mindPath = join(root, '.dope/project-mind.json');
    const bytes = JSON.stringify({ schemaVersion: 2, projectId: randomUUID(), revision: 4, artifacts: [] });
    await writeFile(mindPath, bytes);
    const preview = await previewRoadmapImport(root);
    assert.deepEqual(preview.mind, { revision: 4, artifactIds: [] });
    assert.equal(await readFile(mindPath, 'utf8'), bytes);
}));

test('actual Dope sources keep qualified Phase 9 distinct from retained Phase 5 Not Green evidence', async () => {
    const root = process.cwd();
    const path = join(root, 'docs/roadmap/mvp-roadmap.md');
    const before = await readFile(path);
    const preview = await previewRoadmapImport(root);
    const phase5 = preview.checkpoints.find(item => item.id.endsWith('#phase-5'))!;
    const phase9 = preview.checkpoints.find(item => item.id.endsWith('#phase-9'))!;
    const phase10 = preview.checkpoints.find(item => item.id.endsWith('#phase-10'))!;
    const colorTheme = preview.checkpoints.find(item => item.id.endsWith('#c4-color-theme'))!;
    assert.equal(phase5.roadmapStatus, 'active');
    assert.equal(phase5.status, 'not-green');
    assert.equal(phase5.waived, true);
    assert.equal(phase5.readOnly, true);
    assert.ok(phase5.evidence.some(ref => ref.path === 'docs/tasks/p5/closeout.md' && ref.status === 'not-green'));
    assert.equal(phase9.status, 'green');
    assert.ok(phase9.evidence.some(ref => ref.path === 'docs/tasks/p9d/final-qualification.md' && ref.status === 'green'));
    assert.equal(phase10.status, 'not-green');
    assert.ok(phase10.evidence.some(ref => ref.path === 'docs/tasks/p10/closeout.md' && ref.status === 'not-green'));
    assert.equal(colorTheme.status, 'green');
    assert.equal(preview.checkpoints.find(item => item.id.endsWith('#c9-codex-chat'))?.status, 'not-implemented');
    assert.deepEqual(await readFile(path), before);
});

test('actual mixed correction headings retain stable source identities on repeated preview', async () => {
    const root = process.cwd();
    const first = await previewRoadmapImport(root);
    const again = await previewRoadmapImport(root);
    assert.deepEqual(first.checkpoints.map(item => item.id), again.checkpoints.map(item => item.id));
    assert.ok(first.checkpoints.length >= 31);
    for (const suffix of ['c4-color-theme', 'c5-physical-map-load', 'c9-codex-chat']) {
        const item = first.checkpoints.find(entry => entry.id.endsWith(`#${suffix}`))!;
        assert.equal(item.kind, 'correction');
        assert.equal(item.source.path, 'docs/roadmap/mvp-roadmap.md');
        assert.ok(item.source.line > 0);
    }
    assert.ok(first.checkpoints.filter(item => item.kind === 'correction').length >= 16);
});
