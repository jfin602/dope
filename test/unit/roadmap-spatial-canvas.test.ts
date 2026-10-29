import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RoadmapProjection } from '../../packages/project-intelligence/src/roadmap-projection.ts';
import type { RoadmapIndex } from '../../packages/project-intelligence/src/node/roadmap-store.ts';
import { projectLegacyRoadmap as projectRoadmap } from '../../packages/project-intelligence/lib/roadmap-projection.js';
import { roadmapCanvasOrder, roadmapCanvasConnectors, roadmapConnectorTouchesSelection, roadmapDetailAtZoom, roadmapEdgeHandles, roadmapBranchPath, roadmapSpatialLayout, roadmapSpatialNextId, roadmapVisibleGraph } from
    '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';
import { roadmapInitialCamera, roadmapInitialTarget } from '../../packages/theia-extension/src/browser/roadmap-viewport.ts';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
const node = (id: string, kind: 'phase' | 'correction' | 'task-stack' | 'prompt', order: number) => ({
    id, kind, order, lane: kind === 'phase' ? 'path' as const : 'branch' as const,
    title: id, status: 'unknown' as const, statusLabel: 'Unknown', evidence: [], readOnly: kind === 'prompt',
});

test('only rendered connectors touching selection receive motion emphasis', () => {
    const graph: RoadmapProjection = { projectId: 'project', revision: 9,
        nodes: [node('phase-1', 'phase', 1), node('phase-2', 'phase', 2), node('correction', 'correction', 3)],
        edges: [{ id: 'stored', from: 'phase-2', to: 'correction', kind: 'dependency', label: 'Depends on' }],
        pools: { ideas: [], issues: [] }, diagnostics: [] };
    const original = JSON.stringify(graph);
    const visible = roadmapVisibleGraph(graph, 'phase');
    const connectors = roadmapCanvasConnectors(visible);
    assert.deepEqual(connectors.filter(edge => roadmapConnectorTouchesSelection(edge, 'phase-1')).map(edge => edge.kind),
        ['progression']);
    assert.deepEqual(connectors.filter(edge => roadmapConnectorTouchesSelection(edge, 'correction')).map(edge => edge.kind),
        ['dependency']);
    assert.equal(connectors.some(edge => roadmapConnectorTouchesSelection(edge, undefined)), false);
    assert.equal(JSON.stringify(graph), original);
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    assert.match(widget, /\(visible \? roadmapCanvasConnectors\(visible\) : \[\]\)\.map/);
    assert.match(widget, /roadmapConnectorTouchesSelection\(item, this\.selectedId\) \? ' dope-roadmap-edge-related' : ''/);
});

test('branch routes use the card gutter and duplicate membership segments are suppressed', () => {
    const graph: RoadmapProjection = { projectId: 'project', revision: 1,
        nodes: [node('phase', 'phase', 1),
            { ...node('correction', 'correction', 2), phaseAssociation: { phaseId: 'phase', source: 'identifier' } }],
        edges: [{ id: 'branch', from: 'phase', to: 'correction', kind: 'branch', label: 'Correction' }],
        pools: { ideas: [], issues: [] }, diagnostics: [] };
    const connectors = roadmapCanvasConnectors(graph);
    assert.deepEqual(connectors.map(item => item.kind), ['membership']);
    assert.equal(graph.edges.length, 1);
    const route = roadmapBranchPath(204, 640, 372, 300, true);
    assert.equal(route, 'M 204 640 L 204 614 L 444 614 L 444 300 L 372 300');
    assert.ok(444 > 372); // The long vertical segment is outside the correction card.
    assert.equal(roadmapBranchPath(204, 800, 372, 980, false),
        'M 204 800 L 204 826 L 444 826 L 444 980 L 372 980');
});

test('stored correction dependency uses one routed edge while unresolved parents remain visible', () => {
    const graph: RoadmapProjection = { projectId: 'project', revision: 2,
        nodes: [node('phase', 'phase', 1),
            { ...node('correction', 'correction', 2), phaseAssociation: { phaseId: 'phase', source: 'explicit' } },
            { ...node('missing', 'correction', 3), phaseAssociation: { unresolvedReason: 'Phase 99 is absent.' } }],
        edges: [{ id: 'dependency:phase:correction', from: 'phase', to: 'correction',
            kind: 'branch', label: 'correction branch' }],
        pools: { ideas: [], issues: [] }, diagnostics: ['Unresolved correction phase: missing: Phase 99 is absent.'] };
    const before = JSON.stringify(graph);
    const connectors = roadmapCanvasConnectors(graph);
    assert.equal(connectors.filter(item => item.from === 'phase' && item.to === 'correction').length, 1);
    assert.equal(connectors.find(item => item.to === 'correction')?.kind, 'dependency');
    assert.match(connectors.find(item => item.to === 'correction')?.label ?? '', /dependency and correction membership/);
    const positions = roadmapSpatialLayout(graph);
    assert.deepEqual(roadmapEdgeHandles(connectors.find(item => item.to === 'correction')!, positions),
        { sourceHandle: 'top', targetHandle: 'right-target' });
    assert.ok(positions.has('missing'));
    assert.equal(JSON.stringify(graph), before);
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    assert.match(widget, /Parent unresolved: \$\{item\.phaseAssociation\.unresolvedReason\}/);
});

test('hidden implementation never reserves layout space and disclosure preserves strategic coordinates', () => {
    const graph: RoadmapProjection = { projectId: 'project', revision: 3,
        nodes: [node('phase-1', 'phase', 1), node('phase-2', 'phase', 2),
            node('correction', 'correction', 1), node('stack', 'task-stack', 1),
            node('prompt-1', 'prompt', 1), node('prompt-2', 'prompt', 1)],
        edges: [
            { id: 'e1', from: 'phase-1', to: 'phase-2', kind: 'dependency', label: 'Depends on' },
            { id: 'e2', from: 'phase-1', to: 'correction', kind: 'branch', label: 'Correction' },
            { id: 'task-parent:correction:stack', from: 'correction', to: 'stack', kind: 'branch', label: 'Prompts' },
            { id: 'e4', from: 'stack', to: 'prompt-1', kind: 'branch', label: 'First prompt' },
            { id: 'e5', from: 'prompt-1', to: 'prompt-2', kind: 'branch', label: 'Next prompt' },
        ], pools: { ideas: [], issues: [] }, diagnostics: [] };
    const original = JSON.stringify(graph);
    const hidden = roadmapVisibleGraph(graph, 'checkpoint');
    const positions = roadmapSpatialLayout({ ...graph, ...hidden });
    assert.deepEqual(positions, roadmapSpatialLayout({ ...graph, ...hidden }));
    assert.equal(JSON.stringify(graph), original);
    assert.equal(positions.size, 3);
    assert.ok(positions.get('phase-1')!.x < positions.get('phase-2')!.x);
    assert.equal(positions.get('phase-1')?.y, positions.get('phase-2')?.y);
    assert.ok(positions.get('correction')!.x > positions.get('phase-1')!.x);
    assert.ok(positions.get('correction')!.y < positions.get('phase-1')!.y);
    const open = roadmapVisibleGraph(graph, 'world', 'correction', new Set(['correction']));
    const opened = roadmapSpatialLayout({ ...graph, ...open });
    assert.deepEqual(opened.get('phase-1'), positions.get('phase-1'));
    assert.deepEqual(opened.get('phase-2'), positions.get('phase-2'));
    assert.deepEqual(opened.get('correction'), positions.get('correction'));
    assert.ok(opened.get('prompt-1')!.y < opened.get('correction')!.y);
    assert.ok(opened.get('prompt-2')!.y < opened.get('prompt-1')!.y);
});

test('dense expanded prompts have separate cards without moving phase columns', () => {
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
    const strategic = { ...graph, nodes: graph.nodes.filter(item => item.kind !== 'task-stack' && item.kind !== 'prompt'),
        edges: graph.edges.filter(item => item.id === 'path' || item.id === 'upper') };
    const base = roadmapSpatialLayout(strategic);
    const disclosed = { ...strategic, nodes: [...strategic.nodes, ...prompts],
        edges: [...strategic.edges, { id: 'disclosure:phase-1:prompt-0', from: 'phase-1', to: 'prompt-0',
            kind: 'branch' as const, label: 'Disclosed implementation prompt' },
        ...graph.edges.filter(item => item.id.startsWith('prompt-edge-') && item.from !== 'support')] };
    const positions = roadmapSpatialLayout(disclosed);
    assert.deepEqual(positions, roadmapSpatialLayout(disclosed));
    assert.equal(JSON.stringify(graph), original);
    assert.ok(positions.get('correction')!.y < positions.get('phase-1')!.y);
    assert.deepEqual(positions.get('phase-2'), base.get('phase-2'));
    assert.equal(positions.has('support'), false);
    assert.equal(positions.has('orphan'), false);
    const boxes = disclosed.nodes.map(item => ({ id: item.id, ...positions.get(item.id)!,
        height: Math.max(160, 100 + Math.ceil(item.title.length / 20) * 22) }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++)
        assert.ok(boxes[i].x + 280 <= boxes[j].x || boxes[j].x + 280 <= boxes[i].x ||
            boxes[i].y + boxes[i].height <= boxes[j].y || boxes[j].y + boxes[j].height <= boxes[i].y,
            `${boxes[i].id} overlaps ${boxes[j].id}`);
    assert.equal(graph.edges.some(edge => edge.to === 'orphan'), false);
    assert.deepEqual(graph.edges.map(edge => [edge.from, edge.to]), JSON.parse(original).edges.map((edge: {from: string; to: string}) => [edge.from, edge.to]));
    assert.deepEqual(roadmapEdgeHandles(graph.edges[0], positions), { sourceHandle: 'bottom', targetHandle: 'bottom' });
    assert.deepEqual(roadmapEdgeHandles(graph.edges[1], positions), { sourceHandle: 'top', targetHandle: 'right-target' });
    assert.deepEqual(roadmapEdgeHandles(disclosed.edges[2], positions), { sourceHandle: 'bottom', targetHandle: 'right-target' });
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
    assert.match(widget, /this\.intentionalCamera\(flow => flow\.zoomIn\(\)\)/);
    assert.match(widget, /this\.intentionalCamera\(flow => flow\.zoomOut\(\)\)/);
    assert.match(widget, /this\.intentionalCamera\(flow => flow\.fitView/);
    assert.match(widget, /onNodeDragStop:.*\{/);
    assert.match(widget, /if \(!this\.arranging \|\| !this\.projection\?\.nodes\.some/);
    assert.doesNotMatch(widget, /onConnect:|fitView\(\).*refresh/);
    assert.doesNotMatch(widget, /openChatPanel|CHAT_PANEL_ID|ChatPanelWidget|shell\.addWidget/);
    assert.match(css, /\.dope-roadmap-stage-host \{ position: relative; flex: 1 1 auto; min-height: 0; min-width: 0/);
    assert.match(css, /\.dope-roadmap-stage \{ position: absolute; inset: 0; min-height: 0; min-width: 0/);
    assert.match(css, /\.dope-roadmap-node :is\(small, strong, span\) \{ overflow-wrap: anywhere; white-space: normal/);
    assert.match(css, /@media \(max-width: 480px\).*\.dope-roadmap-stage-host/);
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
    assert.match(widget, /const handles = roadmapEdgeHandles\(item, displayed\)/);
    assert.match(widget, /type: handles\.targetHandle === 'right-target' \? 'branchRoute' : 'smoothstep'/);
});

test('world, phase and checkpoint detail keep implementation closed until explicit disclosure', () => {
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
    assert.deepEqual(roadmapVisibleGraph(graph, 'phase').nodes.map(item => item.id), ['phase-1', 'correction']);
    assert.deepEqual(roadmapVisibleGraph(graph, 'checkpoint').nodes.map(item => item.id), ['phase-1', 'correction']);
    assert.deepEqual(roadmapVisibleGraph(graph, 'world', undefined, new Set(['correction'])).nodes.map(item => item.id),
        ['phase-1', 'correction', 'prompt']);
    assert.equal(JSON.stringify(graph), original);
});

test('actual full Dope import plus current c10 correction labels has a route and vertical branches without stored edges', () => {
    const index = JSON.parse(read('docs/tasks/c10-roadmap-qualify/qualification/loop-1-markdown/evidence/cycle-2-full-import-after.json')) as RoadmapIndex;
    for (const [i, slug] of ['c10-roadmap-create-sync', 'c10-roadmap-qualify', 'c10-horizontal-color'].entries()) {
        const source = index.checkpoints.find(item => item.kind === 'correction')!;
        index.checkpoints.push({ ...source, id: `roadmap:docs/roadmap/mvp-roadmap.md#${slug}`,
            title: `Correction — \`${slug}\``, order: 32 + i, dependencies: [], status: 'not-green' });
    }
    const before = JSON.stringify(index);
    const graph = projectRoadmap(index);
    const positions = roadmapSpatialLayout(graph);
    const current = roadmapInitialTarget(graph.nodes)!;
    assert.ok(current.id.endsWith('#phase-10'), current.id);
    const camera = roadmapInitialCamera(positions.get(current.id)!, 1100, 700);
    assert.ok(camera.zoom >= 0.72 && camera.zoom <= 1.12);
    const neighbors = ['#phase-9', '#phase-10', '#phase-11'].map(suffix =>
        positions.get(graph.nodes.find(node => node.id.endsWith(suffix))!.id)!);
    assert.ok(neighbors.every(position => position.x * camera.zoom + camera.x > -280 &&
        position.x * camera.zoom + camera.x < 1100));
    const connectors = roadmapCanvasConnectors(graph);
    const phase10 = graph.nodes.find(item => item.id.endsWith('#phase-10'))!;
    const c10 = graph.nodes.filter(item => item.kind === 'correction' && item.phaseAssociation?.phaseId === phase10.id);
    assert.ok(c10.length >= 3);
    assert.ok(c10.some(item => item.title.includes('c10-horizontal-color')));
    for (const item of c10) {
        assert.ok(positions.get(item.id)!.y < positions.get(phase10.id)!.y, item.title);
        assert.ok(Math.abs(positions.get(item.id)!.x - positions.get(phase10.id)!.x) < 100);
        assert.ok(connectors.some(edge => edge.kind === 'membership' && edge.from === phase10.id && edge.to === item.id));
    }
    const phases = graph.nodes.filter(item => item.kind === 'phase').sort((a, b) => a.order - b.order);
    assert.equal(connectors.filter(edge => edge.kind === 'progression').length, phases.length - 1);
    assert.equal(connectors.filter(edge => edge.kind === 'dependency').length, 0);
    assert.equal(graph.edges.length, 0);
    assert.equal(index.revision, graph.revision);
    assert.equal(JSON.stringify(index), before);
    const order = roadmapCanvasOrder(graph);
    assert.ok(order.indexOf(phase10) < order.indexOf(c10[0]));
    assert.ok(order.indexOf(c10[0]) < order.findIndex(item => item.id.endsWith('#phase-11')));
});

test('unresolved corrections stay detached and connector classes retain visible endpoints at every detail', () => {
    const phase = node('phase-10', 'phase', 10);
    const next = node('phase-11', 'phase', 11);
    const matched = { ...node('c10-repair', 'correction', 12), phaseAssociation: { phaseId: phase.id, source: 'identifier' as const } };
    const missing = { ...node('c12-missing', 'correction', 13), phaseAssociation: { unresolvedReason: 'Phase 12 is absent.' } };
    const c100 = { ...node('c100-other', 'correction', 14), phaseAssociation: { unresolvedReason: 'Phase 100 is absent.' } };
    const stack = { ...node('stack', 'task-stack', 15), taskSource: { stackPath: 'docs/tasks/p10', fingerprint: 'f', segment: 'Phase 10 prompts' } };
    const prompt = { ...node('prompt', 'prompt', 16), taskSource: { stackPath: 'docs/tasks/p10', fingerprint: 'f', number: 1 } };
    const graph: RoadmapProjection = { projectId: 'fixture', revision: 4,
        nodes: [phase, next, matched, missing, c100, stack, prompt], edges: [
            { id: 'dependency:phase-10:phase-11', from: phase.id, to: next.id, kind: 'dependency', label: 'Depends on' },
            { id: 'dependency:phase-10:c100-other', from: phase.id, to: c100.id, kind: 'branch', label: 'Conflicting explicit dependency' },
            { id: 'task-parent:phase-10:stack', from: phase.id, to: stack.id, kind: 'branch', label: 'Prompt segment' },
            { id: 'task-next:stack:prompt', from: stack.id, to: prompt.id, kind: 'branch', label: 'First prompt' },
        ], pools: { ideas: [], issues: [] }, diagnostics: [] };
    const positions = roadmapSpatialLayout(graph);
    assert.ok(positions.get(matched.id)!.y < positions.get(phase.id)!.y);
    assert.equal(positions.has(stack.id), false);
    assert.ok(positions.get(missing.id)!.x > positions.get(next.id)!.x);
    assert.ok(positions.get(c100.id)!.x > positions.get(next.id)!.x);
    for (const detail of ['world', 'phase', 'checkpoint'] as const) {
        const visible = roadmapVisibleGraph(graph, detail);
        const ids = new Set(visible.nodes.map(item => item.id));
        const edges = roadmapCanvasConnectors(visible);
        assert.ok(edges.every(edge => ids.has(edge.from) && ids.has(edge.to)));
        assert.ok(edges.some(edge => edge.kind === 'progression'));
        assert.ok(edges.some(edge => edge.kind === 'membership'));
        assert.ok(edges.some(edge => edge.kind === 'dependency'));
        assert.ok(!edges.some(edge => edge.kind === 'membership' && (edge.to === missing.id || edge.to === c100.id)));
        assert.ok(edges.some(edge => edge.kind === 'dependency' && edge.to === c100.id));
        assert.deepEqual(roadmapEdgeHandles(edges.find(edge => edge.kind === 'progression')!, positions),
            { sourceHandle: 'right', targetHandle: 'left' });
        assert.deepEqual(roadmapEdgeHandles(edges.find(edge => edge.kind === 'dependency')!, positions),
            { sourceHandle: 'bottom', targetHandle: 'bottom' });
        assert.deepEqual(roadmapEdgeHandles(edges.find(edge => edge.kind === 'membership')!, positions),
            { sourceHandle: 'top', targetHandle: 'right-target' });
        assert.ok(!edges.some(edge => edge.to === stack.id || edge.to === prompt.id));
    }
    assert.equal(graph.edges.length, 4);
});
