import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { discoverRoadmapTaskStacks } from '../../packages/agent-core/lib/node/roadmap-task-discovery.js';
import { readStackSources } from '../../packages/agent-core/lib/node/sequence-reconciliation.js';
import { importPhaseStack } from '../../packages/agent-core/lib/sequence.js';
import { selectPhaseFocus } from '../../packages/project-intelligence/lib/roadmap-task-projection.js';
import { readPhaseFocusEvidence, resolvePhaseFocusLink } from '../../packages/theia-extension/lib/node/phase-focus-evidence.js';
import type { RoadmapIndex } from '../../packages/project-intelligence/src/node/roadmap-store.ts';

const digest = (value: string): string => createHash('sha256').update(value).digest('hex');
const git = (root: string, ...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8',
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } }).trim();
const prompt = (mode: 'Phase' | 'Correction', number: number, closeout = false): string =>
    `TASK: ${mode} 11 / P${number} — ${closeout ? 'Closeout' : 'Task'}\n` +
    '- Recommended configuration: `GPT-6 Sol High`.\n' +
    `- Browser required: ${closeout ? 'yes' : 'no'}.\n` +
    (mode === 'Correction' ? '- Required unchanged project version: `0.11.8`.\n' :
        `The assigned project version is \`0.11.${number}\`.\n`);

test('runner checkpoints require root-local report, exact source, reachable ordered Git and leave manual pending', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-phase-evidence-'));
    const clone = await mkdtemp(join(tmpdir(), 'dope-phase-evidence-clone-'));
    try {
        git(root, 'init', '-q');
        git(root, 'config', 'user.name', 'Fixture');
        git(root, 'config', 'user.email', 'fixture@example.invalid');
        await mkdir(join(root, 'docs/tasks/p11'), { recursive: true });
        await mkdir(join(root, 'docs/tasks/c11-repair'), { recursive: true });
        const phaseFile = join(root, 'docs/tasks/p11/P1-task.txt');
        const correctionFile = join(root, 'docs/tasks/c11-repair/P1-task.txt');
        await writeFile(phaseFile, prompt('Phase', 1));
        await writeFile(join(root, 'docs/tasks/p11/P2-closeout.txt'), prompt('Phase', 2, true));
        await writeFile(correctionFile, prompt('Correction', 1));
        await writeFile(join(root, 'docs/tasks/c11-repair/P2-closeout.txt'), prompt('Correction', 2, true));
        await writeFile(join(root, 'package.json'), '{"version":"0.11.8"}\n');
        git(root, 'add', '.'); git(root, 'commit', '-qm', 'fixture baseline');
        await writeFile(join(root, 'implementation.txt'), 'verified change\n');
        git(root, 'add', '.'); git(root, 'commit', '-qm', 'c11-repair/P1: Task');
        const commit = git(root, 'rev-parse', 'HEAD');
        const runDir = join(root, '.codex-runs/c11-repair/2026-10-18T04-00-00-000Z');
        await mkdir(runDir, { recursive: true });
        const reportFile = join(runDir, 'run.json');
        const report = { taskFolder: 'c11-repair', phase: 11, stackMode: 'correction',
            status: 'implementation_complete', prompts: [
                { number: 1, filename: 'P1-task.txt', kind: 'implementation', status: 'passed', commitSha: commit },
                { number: 2, filename: 'P2-closeout.txt', kind: 'closeout', status: 'manual' }] };
        await writeFile(reportFile, JSON.stringify(report));
        const citationText = 'NOT GREEN';
        const citationPath = 'docs/tasks/p11/closeout.md';
        await writeFile(join(root, citationPath), citationText + '\n');
        const citationHash = digest(citationText + '\n');
        const stacks = await discoverRoadmapTaskStacks(root);
        const phase = stacks.find(item => item.folderName === 'p11')!;
        const correction = stacks.find(item => item.folderName === 'c11-repair')!;
        const failed = phase.prompts[0];
        const index: RoadmapIndex = { schemaVersion: 1, projectId: 'fixture-project', projectRoot: root,
            revision: 1, checkpoints: [
                { id: 'phase-11', kind: 'phase', title: 'Phase 11 — Human workflow', objective: '', order: 11,
                    dependencies: [], links: [], status: 'unknown', readOnly: false, evidence: [] },
                { id: 'correction', kind: 'correction', title: '`c11-repair`', objective: '', order: 12,
                    parentPhaseId: 'phase-11', dependencies: [], status: 'not-green', readOnly: false,
                    links: [
                        { owner: 'evidence', targetId: `phase-focus-correction:${encodeURIComponent(correction.path)}`,
                            sourceHash: citationHash },
                        { owner: 'evidence', targetId: `phase-focus-prompt:${encodeURIComponent(phase.path)}:P1:${failed.fingerprint}`,
                            sourceHash: citationHash }],
                    evidence: [{ path: citationPath, sha256: citationHash, line: 1, text: citationText,
                        statusText: citationText, status: 'not-green' }] }
            ] };
        const store = new AgentStore();
        assert.equal(await resolvePhaseFocusLink(root, index, stacks, index.checkpoints[1].links[1]), true);
        assert.equal(await resolvePhaseFocusLink(root, index, stacks,
            { ...index.checkpoints[1].links[1], sourceHash: 'f'.repeat(64) }), false);
        const value = await readPhaseFocusEvidence(root, index, stacks, store);
        assert.deepEqual(value.checkpoints.map(item => item.entryNumber), [1]);
        assert.equal(value.checkpoints[0].sha, commit);
        assert.equal(value.checkpoints[0].runnerReport?.endsWith('/run.json'), true);
        assert.equal(value.qualifications[0]?.status, 'not-green');
        assert.equal(value.failedPromptEvidence[0]?.failedPrompt.fingerprint, failed.fingerprint);
        const selected = selectPhaseFocus(index, stacks, 'phase-11', value.checkpoints,
            value.qualifications, value.failedPromptEvidence, value.blocked)!;
        assert.equal(selected.stacks.find(item => item.path === correction.path)?.prompts[0].implementation, 'completed');
        assert.equal(selected.stacks.find(item => item.path === correction.path)?.prompts[1].implementation, 'manual');
        assert.equal(selected.stacks.find(item => item.path === correction.path)?.failedPrompt?.number, 1);
        assert.equal(selected.stacks.find(item => item.path === phase.path)?.prompts[0].qualification, 'not-green');

        await writeFile(reportFile, JSON.stringify({ ...report, prompts: [
            { ...report.prompts[0], status: 'previously_completed' }, report.prompts[1]] }));
        assert.equal((await readPhaseFocusEvidence(root, index, stacks, store)).checkpoints.length, 1);
        await writeFile(reportFile, JSON.stringify({ ...report, prompts: [
            { ...report.prompts[0], commitSha: 'a'.repeat(40) }, report.prompts[1]] }));
        assert.equal((await readPhaseFocusEvidence(root, index, stacks, store)).checkpoints.length, 0);
        await writeFile(reportFile, JSON.stringify(report));

        const workStack = await importPhaseStack('c11-repair', await readStackSources(root, 'c11-repair'), correction.path);
        const at = '2026-10-18T04:00:00Z';
        await store.createTask(root, { version: 1, id: 'work-task', createdAt: at,
            objective: 'Task', instructions: prompt('Correction', 1), projectRoot: '.', projectId: index.projectId,
            modelPolicy: { kind: 'follow-coding-agent' }, controls: { reasoningEffort: 'high' },
            authority: { profile: 'phase-8b-project' }, completion: { validation: [], requireValidationPass: false },
            origin: { kind: 'phase-stack', promptId: `c11-repair-P1-${workStack.fingerprint.slice(0, 12)}` },
            phaseStack: { stackFingerprint: workStack.fingerprint, recommendedModel: 'gpt-6-sol',
                versionPolicy: { kind: 'unchanged', version: '0.11.8' } } });
        const pendingRun = { version: 1 as const, id: 'work-run', taskId: 'work-task', status: 'pending' as const,
            grantId: 'grant', grantRevision: 0, requestedPolicy: { kind: 'follow-coding-agent' },
            projectRoot: '.' as const, projectId: index.projectId, createdAt: at,
            changedFiles: [], validationResults: [] };
        await store.createRun(root, pendingRun);
        const runningRun = { ...pendingRun, status: 'running' as const, startedAt: at };
        await store.updateRun(root, pendingRun, runningRun);
        await store.updateRun(root, runningRun, { ...runningRun, status: 'completed', endedAt: at });
        await store.createSequence(root, { version: 1, id: 'work-sequence', createdAt: at, updatedAt: at,
            status: 'waiting-manual', currentEntryNumber: 2, stack: workStack,
            checkpoints: [{ entryNumber: 1, sha: commit, taskId: 'work-task', runId: 'work-run' }],
            basis: { head: commit, packageVersion: '0.11.8', worktreeFingerprint: 'a'.repeat(64) } });
        const work = await readPhaseFocusEvidence(root, index, stacks, store);
        assert.equal(work.checkpoints.length, 1);
        assert.equal(work.checkpoints[0].taskId, 'work-task');
        assert.equal(work.checkpoints[0].runId, 'work-run');
        assert.equal(work.checkpoints[0].runnerReport, undefined);

        await writeFile(join(root, citationPath), 'GREEN\n');
        assert.equal(await resolvePhaseFocusLink(root, index, stacks, index.checkpoints[1].links[1]), false);
        const stale = await readPhaseFocusEvidence(root, index, stacks, store);
        assert.equal(stale.qualifications.length, 0);
        assert.equal(stale.failedPromptEvidence.length, 0);
        const closeoutFile = join(root, 'docs/tasks/c11-repair/P2-closeout.txt');
        await writeFile(closeoutFile, prompt('Correction', 2, true) + 'External edit\n');
        const changed = await discoverRoadmapTaskStacks(root);
        const drift = await readPhaseFocusEvidence(root, index, changed, store);
        assert.equal(drift.checkpoints.length, 0);
        assert.equal(drift.blocked.some(item => item.reason === 'source-drift' && item.entryNumber === 2), true);
        await writeFile(closeoutFile, prompt('Correction', 2, true));
        await writeFile(correctionFile, prompt('Correction', 1) + 'External edit\n');
        const firstDrift = await readPhaseFocusEvidence(root, index, await discoverRoadmapTaskStacks(root), store);
        assert.equal(firstDrift.blocked.some(item => item.reason === 'source-drift' && item.entryNumber === 1), true);

        git(root, 'clone', '-q', root, clone);
        const cloneStacks = await discoverRoadmapTaskStacks(clone);
        const empty = await readPhaseFocusEvidence(clone, { ...index, projectRoot: clone,
            projectId: 'clone-project', checkpoints: [] }, cloneStacks, store);
        assert.equal(empty.checkpoints.length, 0);
        assert.equal(empty.qualifications.length, 0);
    } finally { await rm(root, { recursive: true, force: true }); await rm(clone, { recursive: true, force: true }); }
});
