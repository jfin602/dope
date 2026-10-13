import assert from 'node:assert/strict';
import test from 'node:test';
import type { CheckpointNode, RoadmapProjection } from '../../packages/project-intelligence/src/roadmap-projection.ts';
import { roadmapDetailAtZoom, roadmapSpatialLayout, roadmapVisibleGraph } from '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';

const node = (id: string, kind: CheckpointNode['kind'], title = id): CheckpointNode => ({
    id, kind, title, order: kind === 'phase' ? 1 : 2, lane: kind === 'phase' ? 'path' : 'branch',
    status: id === 'phase' ? 'not-green' : 'unknown', statusLabel: id === 'phase' ? 'Not Green' : 'Unknown',
    evidence: id === 'phase' ? [{ path: 'docs/gate.md', sha256: 'a'.repeat(64), line: 1, text: 'Failed',
        status: 'not-green', statusText: 'Not Green' }] : [], readOnly: kind === 'prompt' || kind === 'task-stack',
    ...(kind === 'task-stack' || kind === 'prompt' ? { taskSource: {
        stackPath: id.startsWith('fix') ? 'docs/tasks/c10-fix' : 'docs/tasks/p10', fingerprint: 'a'.repeat(64),
        segment: id.startsWith('fix') ? 'Correction fix' : 'Phase 10 prompts',
        ...(kind === 'prompt' ? { number: Number(id.replace(/\D/g, '')) || 1 } : {}),
    } } : {}),
});
const graph = (): RoadmapProjection => ({ projectId: 'project', revision: 3,
    nodes: [node('phase', 'phase'), node('milestone', 'milestone'), node('correction', 'correction'),
        node('stack', 'task-stack'), node('prompt1', 'prompt', 'P1 — Full readable prompt title'),
        node('prompt2', 'prompt'), node('fix-stack', 'task-stack', 'Correction fix'),
        node('fix1', 'prompt')],
    edges: [
        { id: 'milestone', from: 'phase', to: 'milestone', kind: 'branch', label: 'Milestone' },
        { id: 'correction', from: 'phase', to: 'correction', kind: 'branch', label: 'Correction' },
        { id: 'task-parent:phase:stack', from: 'phase', to: 'stack', kind: 'branch', label: 'Prompt segment' },
        { id: 'task-next:stack:prompt1', from: 'stack', to: 'prompt1', kind: 'branch', label: 'First' },
        { id: 'task-next:prompt1:prompt2', from: 'prompt1', to: 'prompt2', kind: 'branch', label: 'Next' },
        { id: 'task-parent:phase:fix-stack', from: 'phase', to: 'fix-stack', kind: 'branch', label: 'Correction branch' },
        { id: 'task-next:fix-stack:fix1', from: 'fix-stack', to: 'fix1', kind: 'branch', label: 'First' },
    ], pools: { ideas: [], issues: [] }, diagnostics: [] });
const ids = (view: ReturnType<typeof roadmapVisibleGraph>): string[] => view.nodes.map(item => item.id);

test('three semantic levels show strategic, grouped and individual detail on stable IDs', () => {
    const source = graph();
    const before = structuredClone(source);
    assert.deepEqual(ids(roadmapVisibleGraph(source, 'world')),
        ['phase', 'milestone', 'correction', 'fix-stack']);
    assert.deepEqual(ids(roadmapVisibleGraph(source, 'phase')),
        ['phase', 'milestone', 'correction', 'stack', 'fix-stack']);
    const near = roadmapVisibleGraph(source, 'checkpoint');
    assert.deepEqual(ids(near), source.nodes.map(item => item.id));
    assert.equal(near.nodes.find(item => item.id === 'prompt1')?.title, 'P1 — Full readable prompt title');
    assert.ok(near.edges.some(edge => edge.from === 'prompt1' && edge.to === 'prompt2'));
    assert.deepEqual(source, before);
    assert.equal(source.nodes[0].statusLabel, 'Not Green');
});

test('explicit disclosure and selected context override zoom without changing semantic selection', () => {
    const source = graph();
    const expanded = roadmapVisibleGraph(source, 'world', undefined, new Set(['stack']));
    assert.ok(ids(expanded).includes('stack'));
    assert.ok(ids(expanded).includes('prompt1'));
    const collapsed = roadmapVisibleGraph(source, 'checkpoint', undefined, new Set(), new Set(['stack']));
    assert.ok(ids(collapsed).includes('stack'));
    assert.ok(!ids(collapsed).includes('prompt1'));
    const selected = roadmapVisibleGraph(source, 'world', 'prompt2');
    assert.ok(ids(selected).includes('stack'));
    assert.ok(ids(selected).includes('prompt2'));
    assert.equal(selected.nodes.find(item => item.id === 'prompt2'), source.nodes.find(item => item.id === 'prompt2'));
    const layout = roadmapSpatialLayout(source);
    assert.ok(layout.get('fix-stack')!.x > layout.get('stack')!.x);
    assert.ok(layout.get('fix1')!.x > layout.get('prompt1')!.x);
    assert.deepEqual(layout, roadmapSpatialLayout(source));
});

test('hysteresis avoids detail flicker at zoom boundaries', () => {
    assert.equal(roadmapDetailAtZoom(0.55, 'phase'), 'world');
    assert.equal(roadmapDetailAtZoom(0.6, 'world'), 'world');
    assert.equal(roadmapDetailAtZoom(0.73, 'world'), 'phase');
    assert.equal(roadmapDetailAtZoom(1.37, 'phase'), 'checkpoint');
    assert.equal(roadmapDetailAtZoom(1.2, 'checkpoint'), 'checkpoint');
    assert.equal(roadmapDetailAtZoom(1.1, 'checkpoint'), 'phase');
});

test('large prompt graphs keep a bounded visible neighborhood and report omitted children', () => {
    const source = graph();
    source.nodes = source.nodes.filter(item => item.kind !== 'prompt');
    source.edges = source.edges.filter(item => !item.id.startsWith('task-next:'));
    for (let n = 1; n <= 300; n++) source.nodes.push({ ...node(`prompt${n}`, 'prompt'),
        taskSource: { stackPath: 'docs/tasks/p10', fingerprint: 'a'.repeat(64), number: n,
            segment: 'Phase 10 prompts' } });
    const selected = roadmapVisibleGraph(source, 'checkpoint', 'prompt250', new Set(), new Set(), 24);
    assert.ok(selected.nodes.length <= 29);
    assert.ok(ids(selected).includes('prompt250'));
    assert.ok(ids(selected).includes('prompt249'));
    assert.equal(selected.omittedByStack.get('stack'), 276);
    const next = roadmapVisibleGraph(source, 'checkpoint', 'stack', new Set(), new Set(), 24,
        { stackId: 'stack', start: 24 });
    assert.ok(ids(next).includes('prompt25'));
    assert.ok(!ids(next).includes('prompt1'));
    assert.equal(next.omittedByStack.get('stack'), 276);
    assert.equal(source.nodes.length, 305);
});
