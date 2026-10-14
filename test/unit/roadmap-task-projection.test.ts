import assert from 'node:assert/strict';
import test from 'node:test';
import { projectRoadmapTasks } from '../../packages/project-intelligence/lib/roadmap-task-projection.js';
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
    correctionSlug: mode === 'correction' ? folderName : undefined,
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
    assert.equal(first.edges.find(edge => edge.to === correction.id)?.from, 'p10');
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
    assert.equal(linked.edges.find(edge => edge.to === correctionId)?.from,
        linked.nodes.find(node => node.kind === 'prompt' && node.taskSource?.stackPath === phase.path)!.id);
    const stale = projectRoadmapTasks(source, [phase, correction], [], {},
        [{ ...proof, failedPrompt: { ...proof.failedPrompt, fingerprint: 'b'.repeat(64) } }]);
    assert.equal(stale.edges.find(edge => edge.to === correctionId)?.from, 'p10');
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
