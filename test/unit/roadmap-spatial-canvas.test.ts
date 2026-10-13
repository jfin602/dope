import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RoadmapProjection } from '../../packages/project-intelligence/src/roadmap-projection.ts';
import { roadmapCanvasOrder, roadmapDetailAtZoom, roadmapEdgeHandles, roadmapSpatialLayout, roadmapSpatialNextId, roadmapVisibleGraph } from
    '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
const node = (id: string, kind: 'phase' | 'correction' | 'task-stack' | 'prompt', order: number) => ({
    id, kind, order, lane: kind === 'phase' ? 'path' as const : 'branch' as const,
    title: id, status: 'unknown' as const, statusLabel: 'Unknown', evidence: [], readOnly: kind === 'prompt',
});

test('phase, correction, and prompt coordinates are deterministic and leave the semantic graph untouched', () => {
    const graph: RoadmapProjection = { projectId: 'project', revision: 3,
        nodes: [node('phase-1', 'phase', 1), node('phase-2', 'phase', 2),
            node('correction', 'correction', 1), node('stack', 'task-stack', 1),
            node('prompt-1', 'prompt', 1), node('prompt-2', 'prompt', 1)],
        edges: [
            { id: 'e1', from: 'phase-1', to: 'phase-2', kind: 'dependency', label: 'Depends on' },
            { id: 'e2', from: 'phase-1', to: 'correction', kind: 'branch', label: 'Correction' },
            { id: 'e3', from: 'correction', to: 'stack', kind: 'branch', label: 'Prompts' },
            { id: 'e4', from: 'stack', to: 'prompt-1', kind: 'branch', label: 'First prompt' },
            { id: 'e5', from: 'prompt-1', to: 'prompt-2', kind: 'branch', label: 'Next prompt' },
        ], pools: { ideas: [], issues: [] }, diagnostics: [] };
    const original = JSON.stringify(graph);
    const positions = roadmapSpatialLayout(graph);
    assert.deepEqual(positions, roadmapSpatialLayout(graph));
    assert.equal(JSON.stringify(graph), original);
    assert.equal(positions.size, graph.nodes.length);
    assert.ok(positions.get('phase-1')!.x < positions.get('phase-2')!.x);
    assert.equal(positions.get('phase-1')?.y, positions.get('phase-2')?.y);
    assert.ok(positions.get('correction')!.x > positions.get('phase-1')!.x);
    assert.ok(positions.get('correction')!.y < positions.get('phase-1')!.y);
    assert.ok(positions.get('prompt-1')!.x > positions.get('stack')!.x);
    assert.equal(positions.get('prompt-1')?.x, positions.get('prompt-2')?.x);
    assert.ok(positions.get('prompt-2')!.y < positions.get('prompt-1')!.y);
});

test('dense descendants, long titles, support lane, and disconnected sources have separate cards and true edges', () => {
    const prompts = Array.from({ length: 80 }, (_, i) => ({ ...node(`prompt-${i}`, 'prompt', i),
        title: `${i} ${'long prompt title '.repeat(14)}` }));
    const graph: RoadmapProjection = { projectId: 'dense', revision: 5,
        nodes: [node('phase-1', 'phase', 1), node('phase-2', 'phase', 2),
            node('correction', 'correction', 1), node('support', 'task-stack', 2),
            node('orphan', 'task-stack', 3), ...prompts],
        edges: [
            { id: 'path', from: 'phase-1', to: 'phase-2', kind: 'dependency', label: '' },
            { id: 'upper', from: 'phase-1', to: 'correction', kind: 'branch', label: '' },
            { id: 'lower', from: 'phase-1', to: 'support', kind: 'branch', label: '' },
            ...prompts.map((item, i) => ({ id: `prompt-edge-${i}`, from: i ? prompts[i - 1].id : 'support',
                to: item.id, kind: 'branch' as const, label: '' })),
        ], pools: { ideas: [], issues: [] }, diagnostics: [] };
    const original = JSON.stringify(graph);
    const positions = roadmapSpatialLayout(graph);
    assert.deepEqual(positions, roadmapSpatialLayout(graph));
    assert.equal(JSON.stringify(graph), original);
    assert.ok(positions.get('correction')!.y < positions.get('phase-1')!.y);
    assert.ok(positions.get('support')!.y > positions.get('phase-1')!.y);
    assert.ok(positions.get('phase-2')!.x > positions.get('prompt-79')!.x);
    assert.ok(positions.get('orphan')!.x > positions.get('phase-2')!.x);
    const boxes = graph.nodes.map(item => ({ id: item.id, ...positions.get(item.id)!,
        height: Math.max(160, 100 + Math.ceil(item.title.length / 20) * 22) }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
        assert.ok(boxes[i].x + 280 <= boxes[j].x || boxes[j].x + 280 <= boxes[i].x ||
            boxes[i].y + boxes[i].height <= boxes[j].y || boxes[j].y + boxes[j].height <= boxes[i].y,
            `${boxes[i].id} overlaps ${boxes[j].id}`);
    assert.equal(graph.edges.some(edge => edge.to === 'orphan'), false);
    assert.deepEqual(graph.edges.map(edge => [edge.from, edge.to]), JSON.parse(original).edges.map((edge: {from: string; to: string}) => [edge.from, edge.to]));
    assert.deepEqual(roadmapEdgeHandles(graph.edges[0], positions), { sourceHandle: 'right', targetHandle: 'left' });
    assert.deepEqual(roadmapEdgeHandles(graph.edges[1], positions), { sourceHandle: 'top', targetHandle: 'bottom' });
    assert.deepEqual(roadmapEdgeHandles(graph.edges[2], positions), { sourceHandle: 'bottom', targetHandle: 'top' });
});

test('Roadmap mounts React Flow with selection, pan, zoom and fit but no graph mutation gestures or Chat docking', () => {
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    const backend = read('packages/theia-extension/src/node/backend-module.ts');
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(widget, /createRoot\(this\.path\)/);
    assert.match(widget, /React\.createElement\(ReactFlow/);
    assert.match(widget, /projectRoadmapTasks\(index, tasks/);
    assert.match(backend, /discoverTasks: async \(uri\) => \{/);
    assert.match(backend, /return await discoverRoadmapTaskStacks\(root\)/);
    assert.match(widget, /onNodeClick: .*this\.select\(node\.id\)/);
    assert.match(widget, /\.\.\.roadmapGestures\(this\.arranging\)/);
    assert.match(widget, /draggable: this\.arranging/);
    assert.match(widget, /this\.flow\?\.zoomIn\(\)/);
    assert.match(widget, /this\.flow\?\.zoomOut\(\)/);
    assert.match(widget, /this\.flow\?\.fitView/);
    assert.match(widget, /onNodeDragStop:.*\{/);
    assert.match(widget, /if \(!this\.arranging \|\| !this\.projection\?\.nodes\.some/);
    assert.doesNotMatch(widget, /onConnect:|fitView\(\).*refresh/);
    assert.doesNotMatch(widget, /openChatPanel|CHAT_PANEL_ID|ChatPanelWidget|shell\.addWidget/);
    assert.match(css, /\.dope-roadmap-stage \{ flex: 1 1 auto; min-height: 160px; min-width: 0/);
    assert.match(css, /\.dope-roadmap-node :is\(small, strong, span\) \{ overflow-wrap: anywhere; white-space: normal/);
    assert.match(css, /@media \(max-width: 480px\).*\.dope-roadmap-stage/);
    const rules = css.slice(css.indexOf('.dope-roadmap-canvas'), css.indexOf('.dope-history-panel'));
    assert.match(rules, /var\(--theia-editor-background\)/);
    assert.match(rules, /var\(--theia-editor-foreground\)/);
    assert.doesNotMatch(rules, /#[0-9a-fA-F]{3,8}\b/);
});

test('rendered Tab order follows the same branch traversal as arrow keys', () => {
    const graph: RoadmapProjection = { projectId: 'project', revision: 1,
        nodes: [node('phase-1', 'phase', 1), node('phase-2', 'phase', 2), node('correction', 'correction', 1)],
        edges: [{ id: 'branch', from: 'phase-1', to: 'correction', kind: 'branch', label: 'Correction' }],
        pools: { ideas: [], issues: [] }, diagnostics: [] };
    assert.deepEqual(roadmapCanvasOrder(graph).map(item => item.id), ['phase-1', 'correction', 'phase-2']);
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    assert.match(widget, /const nodes: Node\[\] = \(visible \? roadmapCanvasOrder\(visible\) : \[\]\)\.map/);
    assert.match(widget, /roadmapSpatialNextId\(ids, positions, current\.dataset\.checkpointId, event\.key\)/);
    const positions = roadmapSpatialLayout(graph);
    const ids = roadmapCanvasOrder(graph).map(item => item.id);
    assert.equal(roadmapSpatialNextId(ids, positions, 'phase-1', 'ArrowRight'), 'phase-2');
    assert.equal(roadmapSpatialNextId(ids, positions, 'phase-1', 'ArrowUp'), 'correction');
    assert.equal(roadmapSpatialNextId(ids, positions, 'phase-2', 'Home'), 'phase-1');
    assert.equal(roadmapSpatialNextId(ids, positions, 'phase-1', 'End'), 'phase-2');
    assert.match(widget, /\.\.\.roadmapEdgeHandles\(item, displayed\)/);
});

test('world, phase and checkpoint detail disclose a correction stack without changing source graph', () => {
    const graph: RoadmapProjection = { projectId: 'project', revision: 4,
        nodes: [node('phase-1', 'phase', 1), node('correction', 'correction', 2),
            node('stack', 'task-stack', 3), node('prompt', 'prompt', 4)],
        edges: [
            { id: 'branch-1', from: 'phase-1', to: 'correction', kind: 'branch', label: 'Correction' },
            { id: 'task-parent:correction:stack', from: 'correction', to: 'stack', kind: 'branch', label: 'Stack' },
            { id: 'branch-3', from: 'stack', to: 'prompt', kind: 'branch', label: 'Prompt' },
        ], pools: { ideas: [], issues: [] }, diagnostics: [] };
    const original = JSON.stringify(graph);
    assert.equal(roadmapDetailAtZoom(0.5, 'phase'), 'world');
    assert.equal(roadmapDetailAtZoom(0.85, 'world'), 'phase');
    assert.equal(roadmapDetailAtZoom(1.5, 'phase'), 'checkpoint');
    assert.deepEqual(roadmapVisibleGraph(graph, 'world').nodes.map(item => item.id), ['phase-1', 'correction']);
    assert.deepEqual(roadmapVisibleGraph(graph, 'phase').nodes.map(item => item.id), ['phase-1', 'correction', 'stack']);
    assert.deepEqual(roadmapVisibleGraph(graph, 'checkpoint').nodes.map(item => item.id),
        ['phase-1', 'correction', 'stack', 'prompt']);
    assert.deepEqual(roadmapVisibleGraph(graph, 'world', undefined, new Set(['correction'])).nodes.map(item => item.id),
        ['phase-1', 'correction', 'stack']);
    assert.equal(JSON.stringify(graph), original);
});
