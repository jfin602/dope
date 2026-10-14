import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CheckpointNode, RoadmapProjection } from '../../packages/project-intelligence/src/roadmap-projection.ts';
import { roadmapDetailAtZoom, roadmapImplementationStacks, roadmapSpatialLayout, roadmapVisibleGraph } from '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';

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
        { id: 'task-parent:correction:fix-stack', from: 'correction', to: 'fix-stack', kind: 'branch', label: 'Correction branch' },
        { id: 'task-next:fix-stack:fix1', from: 'fix-stack', to: 'fix1', kind: 'branch', label: 'First' },
    ], pools: { ideas: [], issues: [] }, diagnostics: [] });
const ids = (view: ReturnType<typeof roadmapVisibleGraph>): string[] => view.nodes.map(item => item.id);

test('zoom changes detail without exposing implementation containers or prompts', () => {
    const source = graph();
    const before = structuredClone(source);
    for (const detail of ['world', 'phase', 'checkpoint'] as const) {
        const visible = roadmapVisibleGraph(source, detail);
        assert.deepEqual(ids(visible), ['phase', 'milestone', 'correction']);
        assert.ok(visible.edges.every(edge => ids(visible).includes(edge.from) && ids(visible).includes(edge.to)));
    }
    assert.deepEqual(source, before);
    assert.equal(source.nodes[0].statusLabel, 'Not Green');
});

test('explicit disclosure reveals only the selected checkpoint prompts and collapse removes their edges', () => {
    const source = graph();
    const expanded = roadmapVisibleGraph(source, 'world', 'phase', new Set(['phase']));
    assert.ok(!ids(expanded).includes('stack'));
    assert.ok(ids(expanded).includes('prompt1'));
    assert.ok(ids(expanded).includes('prompt2'));
    assert.ok(!ids(expanded).includes('fix1'));
    assert.ok(expanded.edges.some(edge => edge.from === 'phase' && edge.to === 'prompt1'));
    const collapsed = roadmapVisibleGraph(source, 'checkpoint', 'phase', new Set(['phase']), new Set(['phase']));
    assert.ok(!ids(collapsed).includes('prompt1'));
    assert.ok(collapsed.edges.every(edge => edge.to !== 'prompt1'));
    const selected = roadmapVisibleGraph(source, 'world', 'prompt2');
    assert.ok(!ids(selected).includes('prompt2'));
    const correction = roadmapVisibleGraph(source, 'world', 'correction', new Set(['correction']));
    assert.ok(ids(correction).includes('fix1'));
    assert.ok(!ids(correction).includes('prompt1'));
    assert.deepEqual(roadmapImplementationStacks(source, 'phase').map(stack => stack.promptCount), [2]);
    assert.deepEqual(roadmapImplementationStacks(source, 'correction').map(stack => stack.promptCount), [1]);
    const base = roadmapSpatialLayout(roadmapVisibleGraph(source, 'world') as RoadmapProjection);
    const open = roadmapSpatialLayout(correction as RoadmapProjection);
    assert.deepEqual(open.get('phase'), base.get('phase'));
    assert.deepEqual(open.get('correction'), base.get('correction'));
    assert.ok(open.get('fix1')!.y < open.get('correction')!.y);
});

test('the displayed count follows the same visible graph as prompt disclosure without a Roadmap refresh', () => {
    const widget = readFileSync(resolve(import.meta.dirname,
        '../../packages/theia-extension/src/browser/roadmap-canvas-widget.ts'), 'utf8');
    const render = widget.slice(widget.indexOf('    private render(): void {'), widget.indexOf('    private renderImplementationSummary('));
    const expansion = widget.slice(widget.indexOf('    private setExpansion('), widget.indexOf('    private focusSelection('));
    const next = widget.slice(widget.indexOf('    private nextPrompts('), widget.indexOf('    protected override onAfterAttach('));
    assert.match(render, /const visible = roadmapVisibleGraph\([\s\S]*?this\.renderFlow\(visible\);[\s\S]*?const displayedCount = visible\.nodes\.length/);
    assert.match(expansion, /this\.schedulePresentation\(\);\s*this\.render\(\);/);
    assert.match(next, /this\.schedulePresentation\(\);\s*this\.render\(\);/);
    assert.doesNotMatch(expansion + next, /this\.refresh\(/);

    const source = graph();
    const before = structuredClone(source);
    const expanded = new Set<string>();
    const collapsed = new Set<string>();
    const visible = (selected = 'phase') => roadmapVisibleGraph(source, 'phase', selected, expanded, collapsed);
    const initial = visible();
    assert.equal(initial.nodes.length, 3);
    for (let cycle = 0; cycle < 3; cycle++) {
        expanded.add('phase'); collapsed.delete('phase');
        const open = visible();
        assert.equal(open.nodes.length, initial.nodes.length + 2);
        assert.equal(open.nodes.filter(item => item.kind === 'prompt').length, 2);
        expanded.delete('phase'); collapsed.add('phase');
        const closed = visible();
        assert.equal(closed.nodes.length, initial.nodes.length);
        assert.ok(closed.edges.every(edge => closed.nodes.some(item => item.id === edge.from) &&
            closed.nodes.some(item => item.id === edge.to)));
    }
    expanded.add('correction'); collapsed.delete('correction');
    const other = visible('correction');
    assert.equal(other.nodes.length, initial.nodes.length + 1);
    assert.ok(other.nodes.some(item => item.id === 'fix1'));
    assert.ok(!other.nodes.some(item => item.id === 'prompt1'));
    assert.equal(roadmapVisibleGraph(source, 'phase').nodes.length, initial.nodes.length);
    assert.deepEqual(source, before);
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
    const selected = roadmapVisibleGraph(source, 'checkpoint', 'prompt250', new Set(['phase']), new Set(), 24);
    assert.ok(selected.nodes.length <= 29);
    assert.ok(ids(selected).includes('prompt250'));
    assert.ok(ids(selected).includes('prompt249'));
    assert.equal(selected.omittedByStack.get('stack'), 276);
    const next = roadmapVisibleGraph(source, 'checkpoint', 'phase', new Set(['phase']), new Set(), 24,
        { stackId: 'stack', start: 24 });
    assert.ok(ids(next).includes('prompt25'));
    assert.ok(!ids(next).includes('prompt1'));
    assert.equal(next.omittedByStack.get('stack'), 276);
    assert.equal(source.nodes.length, 305);
});

test('bounded disclosure keeps multiple phase stacks discoverable and anchors each visible prompt run', () => {
    const source = graph();
    source.nodes.push({ ...node('second-stack', 'task-stack'), taskSource: {
        stackPath: 'docs/tasks/p10a', fingerprint: 'b'.repeat(64), segment: 'Continuation a' } });
    source.edges.push({ id: 'task-parent:phase:second-stack', from: 'phase', to: 'second-stack',
        kind: 'branch', label: 'Prompt segment' });
    for (let number = 1; number <= 40; number++) {
        const id = `second-${number}`;
        source.nodes.push({ ...node(id, 'prompt'), taskSource: {
            stackPath: 'docs/tasks/p10a', fingerprint: 'b'.repeat(64), number } });
        source.edges.push({ id: `task-next:${number === 1 ? 'second-stack' : `second-${number - 1}`}:${id}`,
            from: number === 1 ? 'second-stack' : `second-${number - 1}`, to: id,
            kind: 'branch', label: 'Next prompt' });
    }
    const view = roadmapVisibleGraph(source, 'checkpoint', 'phase', new Set(['phase']), new Set(), 12,
        { stackId: 'second-stack', start: 25 });
    assert.ok(view.nodes.some(item => item.id === 'prompt1'));
    assert.ok(view.nodes.some(item => item.id === 'second-26'));
    assert.ok(!view.nodes.some(item => item.kind === 'task-stack'));
    assert.ok(view.nodes.filter(item => item.kind === 'prompt').length <= 12);
    assert.ok(view.edges.every(edge => view.nodes.some(item => item.id === edge.from) &&
        view.nodes.some(item => item.id === edge.to)));
    assert.ok(view.edges.some(edge => edge.from === 'phase' && edge.to === 'second-26'));
});
