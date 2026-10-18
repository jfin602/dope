import assert from 'node:assert/strict';
import test from 'node:test';
import { projectRoadmapTasks, selectPhaseFocus } from '../../packages/project-intelligence/lib/roadmap-task-projection.js';
import { roadmapCanvasOrder } from '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';
import type { TaskStackSource } from '../../packages/project-intelligence/src/roadmap-task-projection.ts';
import type { RoadmapCheckpoint, RoadmapIndex } from '../../packages/project-intelligence/src/node/roadmap-store.ts';

const hash = 'a'.repeat(64);
const checkpoint = (id: string, title: string, order: number,
    status: RoadmapCheckpoint['status'] = 'unknown'): RoadmapCheckpoint => ({
    id, kind: 'phase', title, objective: '', order, dependencies: [], links: [], status,
    readOnly: false, evidence: [],
});
const index = (projectId = 'project'): RoadmapIndex => ({ schemaVersion: 1, projectId,
    projectRoot: '/example', revision: 2, checkpoints: [
        checkpoint('p8', 'Product Phase 8 — Agents', 8, 'waived'),
        checkpoint('p10', 'Product Phase 10 — Roadmap', 10, 'not-green'),
    ] });
const stack = (folderName: string, phase: number, mode: 'phase' | 'correction',
    count = 2): TaskStackSource => ({ folderName, phase, mode, path: `docs/tasks/${folderName}`,
    fingerprint: hash, continuationSlice: /^p\d+[a-z]$/.test(folderName) ? folderName.at(-1) : undefined,
    correctionSlug: mode === 'correction' ? folderName.replace(/^c\d+-/, '') : undefined,
    prompts: Array.from({ length: count }, (_, i) => ({ number: i + 1, title: `Prompt ${i + 1}`,
        kind: i === count - 1 ? 'closeout' : 'implementation',
        path: `docs/tasks/${folderName}/P${i + 1}-task.txt`, fingerprint: hash,
        browserRequired: i === count - 1, version: '0.10.16' })),
});

test('p10 prompts, p8 slices, and c10 correction are source-backed and never promote gate status', () => {
    const stacks = [stack('c10-roadmap-create-sync', 10, 'correction'), stack('p8b', 8, 'phase'),
        stack('p10', 10, 'phase'), stack('p8a', 8, 'phase')];
    const first = projectRoadmapTasks(index(), stacks);
    const second = projectRoadmapTasks(index(), [...stacks].reverse(), [],
        { placements: { p10: { x: 9, y: 10 } }, colors: { p10: 'green' } });
    assert.deepEqual(first, second);
    const task = first.nodes.find(node => node.kind === 'prompt' && node.taskSource?.stackPath === 'docs/tasks/p10');
    assert.equal(task?.taskSource?.path, 'docs/tasks/p10/P1-task.txt');
    assert.equal(task?.status, 'unknown');
    assert.equal(first.nodes.find(node => node.id === 'p10')?.status, 'not-green');
    assert.equal(first.nodes.find(node => node.id === 'p8')?.status, 'waived');
    assert.equal(first.nodes.filter(node => node.id === 'p8').length, 1);
    assert.ok(first.nodes.some(node => node.taskSource?.segment === 'Continuation a'));
    assert.ok(first.nodes.some(node => node.taskSource?.segment === 'Continuation b'));
    const correction = first.nodes.find(node => node.kind === 'task-stack' &&
        node.taskSource?.stackPath === 'docs/tasks/c10-roadmap-create-sync')!;
    const sourceOnly = first.nodes.find(node => node.kind === 'correction' &&
        node.taskSource?.stackPath === 'docs/tasks/c10-roadmap-create-sync')!;
    assert.equal(sourceOnly.status, 'unknown');
    assert.equal(sourceOnly.statusLabel, 'Source only · status unknown');
    assert.equal(sourceOnly.phaseAssociation?.phaseId, 'p10');
    assert.equal(first.edges.find(edge => edge.to === correction.id)?.from, sourceOnly.id);
    const keyboard = roadmapCanvasOrder(first).map(node => node.id);
    assert.ok(keyboard.indexOf(correction.id) > keyboard.indexOf('p10'));
    assert.ok(keyboard.indexOf(first.nodes.find(node => node.kind === 'prompt' &&
        node.taskSource?.stackPath === 'docs/tasks/c10-roadmap-create-sync')!.id) > keyboard.indexOf(correction.id));
    assert.deepEqual(first.pools, { ideas: [], issues: [] });
});

test('exact failed prompt edge needs typed matching evidence; stale proof attaches to phase', () => {
    const phase = stack('p10', 10, 'phase');
    const correction = stack('c10-roadmap-create-sync', 10, 'correction');
    const proof = { correctionPath: correction.path,
        failedPrompt: { stackPath: phase.path, number: 1, fingerprint: hash },
        evidencePath: 'docs/tasks/p10/closeout.md', evidenceHash: hash };
    const source = index();
    source.checkpoints[1].evidence = [{ path: proof.evidencePath, sha256: hash, line: 1,
        text: 'P1 failed', status: 'not-green' }];
    const linked = projectRoadmapTasks(source, [correction, phase], [], {}, [proof]);
    const correctionId = linked.nodes.find(node => node.kind === 'task-stack' &&
        node.taskSource?.stackPath === correction.path)!.id;
    const sourceOnly = linked.nodes.find(node => node.kind === 'correction' &&
        node.taskSource?.stackPath === correction.path)!;
    assert.equal(linked.edges.find(edge => edge.to === correctionId)?.from, sourceOnly.id);
    assert.ok(linked.edges.some(edge => edge.from === linked.nodes.find(node =>
        node.kind === 'prompt' && node.taskSource?.stackPath === phase.path)!.id && edge.to === sourceOnly.id));
    const stale = projectRoadmapTasks(source, [phase, correction], [], {},
        [{ ...proof, failedPrompt: { ...proof.failedPrompt, fingerprint: 'b'.repeat(64) } }]);
    assert.equal(stale.edges.find(edge => edge.to === correctionId)?.from, sourceOnly.id);
    assert.equal(stale.edges.some(edge => edge.id.startsWith('task-failure:')), false);
    assert.ok(stale.diagnostics.some(message => message.includes('Unresolved failed prompt')));
});

test('unresolved and superseded stacks stay unlinked; selection is scoped to project', () => {
    const superseded = { ...stack('p8a', 8, 'phase'), diagnostic: { code: 'superseded', message: 'Superseded' } };
    const unresolved = stack('p11', 11, 'phase');
    const result = projectRoadmapTasks(index(), [superseded, unresolved]);
    assert.deepEqual(result.unlinkedTasks.map(item => item.path), [unresolved.path, superseded.path]);
    assert.equal(result.nodes.filter(node => node.kind === 'prompt').length, 0);
    const valid = projectRoadmapTasks(index(), [stack('p10', 10, 'phase')]);
    const selectedId = valid.nodes.find(node => node.kind === 'prompt')!.id;
    assert.equal(projectRoadmapTasks(index(), [stack('p10', 10, 'phase')], [],
        { projectId: 'project', selectedId }).selection?.node.id, selectedId);
    assert.equal(projectRoadmapTasks(index('other'), [stack('p10', 10, 'phase')], [],
        { projectId: 'project', selectedId }).selection, undefined);
    assert.notEqual(projectRoadmapTasks(index('other'), [stack('p10', 10, 'phase')]).nodes.find(node =>
        node.kind === 'prompt')?.id, selectedId);
});

test('large stacks have an explicit bounded projection', () => {
    const stacks = Array.from({ length: 256 }, (_, i) => stack(`c10-correction-${i}`, 10, 'correction', 4));
    const result = projectRoadmapTasks(index(), stacks);
    assert.ok(result.nodes.length <= index().checkpoints.length + 512);
    assert.ok(result.omittedTaskNodes > 0);
    assert.ok(result.diagnostics.some(message => message.includes('omitted')));
});

test('multiple c10 task stacks retain distinct identities; typed phase conflict stays unlinked', () => {
    const names = ['c10-roadmap-create-sync', 'c10-horizontal-color', 'c10-roadmap-qualify'];
    const source = index();
    const before = JSON.stringify(source);
    const result = projectRoadmapTasks(source, [...names.map(name => stack(name, 10, 'correction')),
        stack('c100-other', 10, 'correction')]);
    assert.equal(JSON.stringify(source), before);
    assert.equal(result.revision, 2);
    assert.equal(result.nodes.filter(node => node.kind === 'task-stack').length, 3);
    assert.deepEqual(result.nodes.filter(node => node.kind === 'task-stack').map(node => node.phaseAssociation?.phaseId),
        ['p10', 'p10', 'p10']);
    assert.match(result.unlinkedTasks[0].reason, /conflicts/);
    assert.equal(result.edges.filter(edge => edge.id.startsWith('task-parent:')).length, 3);
});

test('canonical correction absorbs its matching stack without a duplicate source-only correction', () => {
    const source = index();
    source.checkpoints.push({ ...checkpoint('roadmap:docs/roadmap/mvp-roadmap.md#c10-roadmap-create-sync',
        'Correction — `c10-roadmap-create-sync`', 11, 'not-green'), kind: 'correction' });
    const original = JSON.stringify(source);
    const result = projectRoadmapTasks(source, [stack('c10-roadmap-create-sync', 10, 'correction')]);
    const corrections = result.nodes.filter(node => node.kind === 'correction');
    assert.equal(corrections.length, 1);
    assert.equal(corrections[0].status, 'not-green');
    assert.equal(result.edges.find(edge => edge.id.startsWith('task-parent:'))?.from, corrections[0].id);
    assert.equal(result.revision, source.revision);
    assert.equal(JSON.stringify(source), original);
});

test('unique descriptive correction with an explicit phase parent absorbs its named task folder', () => {
    const source = index();
    source.checkpoints.push({ ...checkpoint('roadmap:docs/roadmap/mvp-roadmap.md#october-map-canvas',
        'October 2 — Phase 10 map canvas priority correction', 11), kind: 'correction', parentPhaseId: 'p10' });
    const result = projectRoadmapTasks(source, [stack('c10-map-canvas-priority', 10, 'correction')]);
    assert.equal(result.nodes.filter(node => node.kind === 'correction').length, 1);
    assert.equal(result.nodes.find(node => node.kind === 'correction')?.phaseAssociation?.phaseId, 'p10');
    assert.equal(result.edges.find(edge => edge.id.startsWith('task-parent:'))?.from,
        'roadmap:docs/roadmap/mvp-roadmap.md#october-map-canvas');
});

test('Phase Focus preserves authored order and keeps source, Work completion, and qualification separate', () => {
    const source = index();
    const phase = stack('p10', 10, 'phase', 3);
    const continuation = { ...stack('p10b', 10, 'phase'), continuationSlice: 'b' };
    const correction = stack('c10-fix', 10, 'correction');
    const stacks = [correction, continuation, phase];
    const selected = selectPhaseFocus(source, stacks, 'p10');
    assert.deepEqual(selected?.stacks.map(item => item.path),
        ['docs/tasks/p10', 'docs/tasks/p10b', 'docs/tasks/c10-fix']);
    assert.deepEqual(selected?.stacks[0].prompts.map(item => item.number), [1, 2, 3]);
    assert.equal(selected?.stacks[0].prompts[0].implementation, 'unknown');
    assert.equal(selected?.stacks[0].prompts[2].kind, 'closeout');
    assert.equal(selected?.stacks[0].prompts[2].implementation, 'manual');
    assert.equal(selected?.stacks[0].prompts[2].qualification, 'unknown');
    assert.equal(selected?.qualification, 'not-green');
    assert.deepEqual(selectPhaseFocus(source, [...stacks].reverse(), 'p10'), selected);
    // Canvas Arrange is presentation state; it cannot reorder the authored sequence.
    projectRoadmapTasks(source, stacks, [], { projectId: source.projectId,
        placements: { p10: { x: 900, y: -100 } }, colors: { p10: 'green' } });
    assert.deepEqual(selectPhaseFocus(source, stacks, 'p10'), selected);
    assert.equal(selectPhaseFocus(source, stacks, 'missing'), undefined);
});

test('Phase Focus requires reconciled exact project, stack, Git, Work and citation proof', () => {
    const source = index();
    const phase = stack('p10', 10, 'phase');
    source.checkpoints[1].evidence = [{ path: 'docs/tasks/p10/closeout.md', sha256: hash, line: 1,
        text: 'Not Green', status: 'not-green' }];
    const basis = { projectId: source.projectId, stackPath: phase.path, stackFingerprint: hash,
        entryNumber: 1, sha: 'b'.repeat(40), verified: true };
    const qualification = { projectId: source.projectId, stackPath: phase.path,
        promptNumber: 1, promptFingerprint: hash, evidencePath: 'docs/tasks/p10/closeout.md',
        evidenceHash: hash, status: 'not-green' as const };
    const incomplete = selectPhaseFocus(source, [phase], 'p10', [basis], [qualification])!;
    assert.equal(incomplete.stacks[0].prompts[0].implementation, 'unknown');
    assert.equal(incomplete.stacks[0].prompts[0].qualification, 'not-green');
    const completed = selectPhaseFocus(source, [phase], 'p10',
        [{ ...basis, taskId: 'task', runId: 'run' },
            { ...basis, entryNumber: 2, sha: 'c'.repeat(40), manualGate: true }])!;
    assert.equal(completed.stacks[0].prompts[0].implementation, 'completed');
    assert.equal(completed.stacks[0].prompts[1].implementation, 'completed');
    assert.equal(completed.stacks[0].prompts[1].qualification, 'unknown');
    const foreign = selectPhaseFocus(source, [phase], 'p10',
        [{ ...basis, projectId: 'foreign', taskId: 'task', runId: 'run' }],
        [{ ...qualification, evidenceHash: 'c'.repeat(64) }])!;
    assert.equal(foreign.stacks[0].prompts[0].implementation, 'unknown');
    assert.equal(foreign.stacks[0].prompts[0].qualification, 'unknown');
});

test('Phase Focus diagnoses malformed, missing, wrong-parent and stale failed-prompt sources', () => {
    const source = index();
    source.checkpoints.push({ ...checkpoint('c10-fix', 'Correction `c10-fix`', 11),
        kind: 'correction', parentPhaseId: 'p8' });
    const phase = stack('p10', 10, 'phase');
    const correction = stack('c10-fix', 10, 'correction');
    const missing = { ...stack('c10-missing', 10, 'correction'), prompts: [], fingerprint: undefined,
        diagnostic: { code: 'missing', message: 'Source missing' } };
    const proof = { correctionPath: correction.path, failedPrompt: { stackPath: phase.path,
        number: 1, fingerprint: 'c'.repeat(64) }, evidencePath: 'docs/tasks/p10/closeout.md', evidenceHash: hash };
    source.checkpoints[1].evidence = [{ path: proof.evidencePath, sha256: hash, line: 1,
        text: 'Failure', status: 'not-green' }];
    const result = selectPhaseFocus(source, [correction, missing, phase], 'p10', [], [], [proof])!;
    assert.deepEqual(result.stacks.map(item => item.path), [phase.path]);
    assert.ok(projectRoadmapTasks(source, [correction]).unlinkedTasks.some(item => item.path === correction.path));
    assert.ok(result.diagnostics.some(item => item.includes('Source missing')));
    assert.ok(result.diagnostics.some(item => item.includes('parent')));
    const validSource = index();
    validSource.checkpoints[1].evidence = source.checkpoints[1].evidence;
    const valid = selectPhaseFocus(validSource, [phase, correction], 'p10', [], [], [proof])!;
    assert.equal(valid.stacks[1].failedPrompt, undefined);
    assert.ok(valid.diagnostics.some(item => item.includes('stale')));
});

test('Phase Focus has an empty state and refuses orphan checkpoints, stale source and foreign proof', () => {
    const source = index();
    assert.deepEqual(selectPhaseFocus(source, [], 'p10')?.stacks, []);
    const phase = stack('p10', 10, 'phase', 3);
    const proof = { projectId: source.projectId, stackPath: phase.path, stackFingerprint: hash,
        entryNumber: 2, sha: 'b'.repeat(40), taskId: 'task', runId: 'run', verified: true };
    const selected = selectPhaseFocus(source, [phase], 'p10', [proof,
        { ...proof, entryNumber: 1, stackFingerprint: 'c'.repeat(64) },
        { ...proof, entryNumber: 3, projectId: 'foreign', manualGate: true }], [], [],
        [{ projectId: source.projectId, stackPath: phase.path, stackFingerprint: hash,
            entryNumber: 1, reason: 'source-drift', verified: true }])!;
    assert.deepEqual(selected.stacks[0].prompts.map(item => item.implementation),
        ['blocked', 'unknown', 'manual']);
    assert.ok(selected.diagnostics.some(item => item.includes('Stale')));
    assert.ok(selected.diagnostics.some(item => item.includes('prefix')));
});
