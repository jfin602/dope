import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { projectRoadmap } from '../../packages/project-intelligence/lib/roadmap-projection.js';
import type { RoadmapIndex } from '../../packages/project-intelligence/lib/node/roadmap-store.js';

test('current owner dispositions beat historical status without erasing failed gates', async () => {
    const preview = await previewRoadmapImport(process.cwd());
    const phase = (number: number) => preview.checkpoints.find(item => item.sectionKey === `phase-${number}`)!;
    assert.equal(phase(4).status, 'green');
    assert.ok(phase(4).evidence.some(item => item.path === 'docs/tasks/p4/closeout.md' && item.status === 'green'));
    assert.equal(phase(5).status, 'not-green');
    assert.equal(phase(5).waived, true);
    assert.equal(phase(6).roadmapStatus, 'active');
    assert.equal(phase(6).status, 'waived');
    assert.equal(phase(7).roadmapStatus, 'unknown');
    assert.equal(phase(7).status, 'green');
    assert.equal(phase(9).status, 'green');
    assert.equal(phase(10).status, 'not-green');
    assert.ok(phase(6).evidence.some(item => item.path === 'docs/tasks/p6/closeout.md' && item.status === 'waived' && item.line === 3));
    assert.ok(phase(7).evidence.some(item => item.path === 'docs/tasks/p7/closeout.md' && item.status === 'not-green'));
    assert.ok(phase(7).evidence.some(item => item.path === 'docs/planning/p7/phase-7-plan.md' && item.status === 'green'));
    assert.ok(phase(7).diagnostics.includes('Conflicting historical status evidence'));
    assert.ok(phase(10).evidence.some(item => item.path === 'docs/tasks/p10/closeout.md' && item.status === 'not-green'));
    const index: RoadmapIndex = { schemaVersion: 1, projectId: 'truth', projectRoot: process.cwd(), revision: 1,
        checkpoints: [5, 6, 7, 9, 10].map((number, order) => {
            const item = phase(number);
            return { id: item.id, kind: item.kind, title: item.title, objective: '', order, dependencies: [], links: [],
                status: item.status, readOnly: item.readOnly, source: item.source, evidence: item.evidence };
        }) };
    const projection = projectRoadmap(index);
    assert.equal(projection.nodes[1].status, 'waived');
    assert.equal(projection.nodes[1].statusLabel, 'Owner-closed for sequencing');
    assert.ok(projection.diagnostics.some(message => message.includes('phase-7') && message.includes('docs/tasks/p7/closeout.md')));
});

test('source order, reimport, linked Markdown edit and restart retain status provenance', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-status-'));
    try {
        await mkdir(join(root, 'docs/roadmap'), { recursive: true });
        await mkdir(join(root, 'docs/planning/p7'), { recursive: true });
        await mkdir(join(root, 'docs/tasks/p7'), { recursive: true });
        const path = join(root, 'docs/roadmap/mvp-roadmap.md');
        const roadmap = (status: string) => `# Roadmap\n\n## Product Phase 7 — AI Presence\nStatus: **${status}**\n`;
        await writeFile(path, roadmap('ACTIVE'));
        await writeFile(join(root, 'docs/tasks/p7/closeout.md'), '# Phase 7 evidence closeout\n\nDate: October 3. **Decision: Not Qualified.** Evidence-only, not an owner closeout.\n');
        await writeFile(join(root, 'docs/planning/p7/phase-7-plan.md'), '# Phase 7 Plan\n\nStatus: **OWNER APPROVED / QUALIFIED / CLOSED AT ACTUAL 0.7.31**\n');
        const first = await previewRoadmapImport(root);
        const checkpoint = first.checkpoints[0];
        assert.equal(checkpoint.status, 'green');
        assert.equal(checkpoint.roadmapStatus, 'active');
        assert.ok(checkpoint.diagnostics.includes('Conflicting historical status evidence'));
        const store = new RoadmapStore();
        const accepted = await store.acceptImport(root, 0, first);
        const reopened = await new RoadmapStore().read(root);
        assert.equal(reopened.checkpoints[0].status, 'green');
        assert.deepEqual(reopened.checkpoints[0].evidence, accepted.checkpoints[0].evidence);
        const projected = projectRoadmap(reopened);
        assert.equal(projected.nodes[0].statusLabel, 'Green');
        assert.ok(projected.diagnostics.some(message => message.includes('docs/tasks/p7/closeout.md')));
        await writeFile(path, roadmap('UNKNOWN'));
        const changed = await previewRoadmapImport(root);
        assert.equal(changed.checkpoints[0].status, 'green');
        assert.equal(changed.checkpoints[0].roadmapStatus, 'unknown');
        assert.notEqual(changed.checkpoints[0].source.sha256, checkpoint.source.sha256);
        assert.equal((await readFile(join(root, 'docs/tasks/p7/closeout.md'), 'utf8')).includes('Not Qualified'), true);
        await assert.rejects(store.acceptImport(root, 1, first), /Stale Roadmap import preview/);
        const imported = await store.acceptImport(root, 1, changed, accepted.projectId);
        assert.equal((await new RoadmapStore().read(root)).checkpoints[0].status, 'green');
        assert.equal(imported.checkpoints[0].evidence.find(item => item.path === 'docs/roadmap/mvp-roadmap.md')?.status, 'unknown');
        assert.deepEqual((await previewRoadmapImport(root)).checkpoints[0], changed.checkpoints[0]);
        const planPath = join(root, 'docs/planning/p7/phase-7-plan.md');
        const closeoutPath = join(root, 'docs/tasks/p7/closeout.md');
        const plan = await readFile(planPath);
        const closeout = await readFile(closeoutPath);
        await rm(planPath);
        await rm(closeoutPath);
        await writeFile(closeoutPath, closeout);
        await writeFile(planPath, plan);
        assert.deepEqual((await previewRoadmapImport(root)).checkpoints[0], changed.checkpoints[0]);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('contradictory current owner records fail closed independent of directory order', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-conflict-'));
    try {
        await mkdir(join(root, 'docs/roadmap'), { recursive: true });
        await mkdir(join(root, 'docs/planning/p7'), { recursive: true });
        await writeFile(join(root, 'docs/roadmap/mvp-roadmap.md'), '# Roadmap\n\n## Product Phase 7 — AI Presence\nStatus: **ACTIVE**\n');
        const plan = join(root, 'docs/planning/p7/phase-7-plan.md');
        const activation = join(root, 'docs/planning/p7/activation.md');
        await writeFile(plan, '# Phase 7 Plan\n\nStatus: **OWNER APPROVED / QUALIFIED / CLOSED**\n');
        await writeFile(activation, '# Phase 7 Activation\n\nStatus: **OWNER-CLOSED FOR SEQUENCING**\n');
        const first = (await previewRoadmapImport(root)).checkpoints[0];
        assert.equal(first.status, 'active');
        assert.ok(first.diagnostics.includes('Conflicting current owner evidence'));
        await rm(plan);
        await rm(activation);
        await writeFile(activation, '# Phase 7 Activation\n\nStatus: **OWNER-CLOSED FOR SEQUENCING**\n');
        await writeFile(plan, '# Phase 7 Plan\n\nStatus: **OWNER APPROVED / QUALIFIED / CLOSED**\n');
        assert.deepEqual((await previewRoadmapImport(root)).checkpoints[0], first);
    } finally { await rm(root, { recursive: true, force: true }); }
});
