import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { composeAffectedCorrectionDraft, correctionFailure, directWorkFastLane, planCorrectionRework } from
    '../../packages/theia-extension/lib/node/planning-correction.js';
import type { RoadmapIndex } from '../../packages/project-intelligence/src/node/roadmap-store.ts';
import type { PlanningMap } from '../../packages/visual-planning/src/index.ts';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const fingerprint = 'a'.repeat(64);
const phase = { folderName: 'p11', path: 'docs/tasks/p11', mode: 'phase' as const, phase: 11,
    fingerprint, prompts: [{ number: 1, title: 'Original', kind: 'implementation' as const,
        path: 'docs/tasks/p11/P1-original.txt', fingerprint, browserRequired: false, version: '0.11.8' }] };
const branch = { ...phase, folderName: 'c11-repair', path: 'docs/tasks/c11-repair', mode: 'correction' as const,
    prompts: [{ ...phase.prompts[0], path: 'docs/tasks/c11-repair/P1-repair.txt' }] };

test('correction lineage requires exact typed failed prompt and Not Green citation', () => {
    const evidencePath = 'docs/tasks/p11/closeout.md', evidenceHash = 'b'.repeat(64);
    const proof = { correctionPath: branch.path, failedPrompt: { stackPath: phase.path,
        number: 1, fingerprint }, evidencePath, evidenceHash };
    const roadmap = { projectId: 'project', checkpoints: [{ id: 'repair', kind: 'correction',
        evidence: [{ path: evidencePath, sha256: evidenceHash, line: 1, text: 'Not Green', status: 'not-green' }],
        links: [
            { owner: 'evidence', targetId: `phase-focus-prompt:${encodeURIComponent(phase.path)}:P1:${fingerprint}`, sourceHash: evidenceHash },
            { owner: 'evidence', targetId: `phase-focus-correction:${encodeURIComponent(branch.path)}`, sourceHash: evidenceHash }
        ] }] } as unknown as RoadmapIndex;
    assert.equal(correctionFailure(roadmap, 'repair', proof, [branch, phase]), true);
    assert.equal(correctionFailure(roadmap, 'repair', { ...proof, failedPrompt: { ...proof.failedPrompt, number: 2 } }, [branch, phase]), false);
    assert.equal(correctionFailure(roadmap, 'repair', { ...proof, evidenceHash: 'c'.repeat(64) }, [branch, phase]), false);
    assert.equal(correctionFailure(roadmap, 'repair', proof, [{ ...phase, prompts: [{ ...phase.prompts[0], fingerprint: 'c'.repeat(64) }] }, branch]), false);
    assert.equal(correctionFailure({ ...roadmap, checkpoints: [{ ...roadmap.checkpoints[0], evidence: [] }] }, 'repair', proof, [branch, phase]), false);
});

test('target replan touches only unexecuted affected work and leaves historical work unchanged', () => {
    const item = (id: string, transformationId: string, status: 'ready' | 'completed' = 'ready', dependsOn: string[] = []) =>
        ({ id, title: id, objective: id, transformationIds: [transformationId], dependsOn,
            requirements: [], constraints: [], acceptanceCriteria: ['review'], validationTargets: ['test'],
            workingSet: ['src/a.ts'], status });
    const map = { transformations: [{ id: 'a' }, { id: 'b' }], workItems: [
        item('affected', 'a'), item('dependent', 'b', 'ready', ['affected']), item('unrelated', 'b'),
        item('historical', 'a', 'completed')] } as PlanningMap;
    const before = JSON.stringify(map);
    const plan = planCorrectionRework(map, ['a']);
    assert.deepEqual(plan.affectedWorkItemIds, ['affected', 'dependent']);
    assert.deepEqual(plan.preservedWorkItemIds, ['unrelated']);
    assert.deepEqual(plan.blockedExecutedWorkItemIds, ['historical']);
    assert.equal(plan.invalidateTargetAndStackApproval, true);
    assert.equal(plan.requiresNewDraft, true);
    assert.equal(JSON.stringify(map), before);
    assert.throws(() => planCorrectionRework(map, ['unknown']), /exact changed target/);
});

test('affected-only correction draft leaves unrelated and authored prompt sources outside its new folder', async () => {
    const work = (id: string, transformationId: string) => ({ id, title: `Implement ${id}`,
        objective: `Implement ${id}`, transformationIds: [transformationId], dependsOn: [],
        requirements: ['Preserve source'], constraints: ['No automatic Run'],
        acceptanceCriteria: ['Review result'], validationTargets: ['Focused test'],
        workingSet: ['src/a.ts'], status: 'ready' as const });
    const affected = work('affected', 'a'), unrelated = work('unrelated', 'b');
    const map = { transformations: [{ id: 'a' }, { id: 'b' }], workItems: [affected, unrelated] } as PlanningMap;
    const choice = { workItem: affected, tier: 'T2' as const, model: 'GPT-6 Sol High' as const,
        estimatedMinutes: 7, integrationChecks: ['Check integration'] };
    const input = { folderName: 'c11-new-repair', version: '0.11.8', sourceVersion: '0.11.8',
        work: [choice], closeout: { title: 'Manual closeout', objective: 'Review evidence',
            manualReason: 'Real qualification', acceptanceCriteria: ['Owner reviews'],
            model: 'GPT-6 Sol High' as const, browserRequired: true } };
    const before = JSON.stringify(map);
    const draft = await composeAffectedCorrectionDraft(map, ['a'], input, 'docs/tasks/c11-old-repair');
    assert.equal(draft.files.length, 2);
    assert.ok(draft.files.every(file => file.path.startsWith('docs/tasks/c11-new-repair/')));
    assert.equal(draft.files[0].text.includes('unrelated'), false);
    assert.equal(JSON.stringify(map), before);
    await assert.rejects(composeAffectedCorrectionDraft(map, ['a'],
        { ...input, work: [{ ...choice, workItem: { ...affected, title: 'Stale' } }] }, 'docs/tasks/c11-old-repair'),
    /newly reviewed/);
    await assert.rejects(composeAffectedCorrectionDraft(map, ['a'],
        { ...input, folderName: 'c11-old-repair' }, 'docs/tasks/c11-old-repair'), /new affected-only/);
});

test('small issue route checks actual source bytes and retains Work grants and qualification', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-fast-lane-'));
    try {
        await writeFile(join(root, 'fix.ts'), 'before\n');
        const impact = [{ path: 'fix.ts', sha256: hash('before\n') }];
        const roadmap = { projectRoot: root, projectId: 'project', checkpoints: [{ id: 'fix', kind: 'milestone',
            readOnly: false, links: [{ owner: 'issue', targetId: 'issue-1', ownerProjectId: 'project' }] }] } as RoadmapIndex;
        const prior = await readFile(join(root, 'fix.ts'), 'utf8');
        const route = await directWorkFastLane(root, roadmap, 'fix', impact,
            { reason: 'No architecture contract or dependency changes', developerApproved: true },
            undefined, async id => id === 'issue-1');
        assert.equal(route.route, 'direct-work');
        assert.equal(route.architecture, 'not-applicable');
        assert.deepEqual(route.requires, ['explicit-work-run', 'execution-grants', 'source-validation', 'qualification']);
        assert.equal(await readFile(join(root, 'fix.ts'), 'utf8'), prior);
        await assert.rejects(directWorkFastLane(root, roadmap, 'fix', impact,
            { reason: 'N/A', developerApproved: true }, undefined, async () => false), /owned issue/);
        await assert.rejects(directWorkFastLane(root, roadmap, 'fix', impact,
            { reason: 'N/A', developerApproved: false } as never, undefined, async () => true), /owned issue/);
        await writeFile(join(root, 'fix.ts'), 'after\n');
        await assert.rejects(directWorkFastLane(root, roadmap, 'fix', impact,
            { reason: 'N/A', developerApproved: true }, undefined, async () => true), /Source impact changed/);
    } finally { await rm(root, { recursive: true, force: true }); }
});

test('correction direct route rejects stale failed-prompt evidence without changing source', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-correction-lane-'));
    try {
        await mkdir(join(root, 'docs/tasks/p11'), { recursive: true });
        const report = 'Not Green: P1 failed source-bound qualification.\n';
        await writeFile(join(root, 'docs/tasks/p11/closeout.md'), report);
        await writeFile(join(root, 'fix.ts'), 'old\n');
        const evidenceHash = hash(report), evidencePath = 'docs/tasks/p11/closeout.md';
        const proof = { correctionPath: branch.path, failedPrompt: { stackPath: phase.path,
            number: 1, fingerprint }, evidencePath, evidenceHash };
        const roadmap = { projectRoot: root, projectId: 'project', checkpoints: [{ id: 'repair',
            kind: 'correction', readOnly: false,
            evidence: [{ path: evidencePath, sha256: evidenceHash, line: 1,
                text: 'Not Green:', status: 'not-green' }],
            links: [
                { owner: 'evidence', targetId: `phase-focus-prompt:${encodeURIComponent(phase.path)}:P1:${fingerprint}`, sourceHash: evidenceHash },
                { owner: 'evidence', targetId: `phase-focus-correction:${encodeURIComponent(branch.path)}`, sourceHash: evidenceHash }
            ] }] } as RoadmapIndex;
        const impact = [{ path: 'fix.ts', sha256: hash('old\n') }];
        const decision = { reason: 'No architecture change', developerApproved: true as const };
        assert.equal((await directWorkFastLane(root, roadmap, 'repair', impact, decision,
            { evidence: proof, stacks: [phase, branch] })).route, 'direct-work');
        await writeFile(join(root, evidencePath), 'Not Green: different bytes.\n');
        await assert.rejects(directWorkFastLane(root, roadmap, 'repair', impact, decision,
            { evidence: proof, stacks: [phase, branch] }), /evidence changed/);
        assert.equal(await readFile(join(root, 'fix.ts'), 'utf8'), 'old\n');
    } finally { await rm(root, { recursive: true, force: true }); }
});
