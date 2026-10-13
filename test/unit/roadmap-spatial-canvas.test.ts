import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RoadmapProjection } from '../../packages/project-intelligence/src/roadmap-projection.ts';
import { roadmapSpatialLayout } from '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';

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
    assert.equal(positions.get('phase-1')?.x, positions.get('phase-2')?.x);
    assert.ok(positions.get('correction')!.x > positions.get('phase-1')!.x);
    assert.ok(positions.get('prompt-1')!.x > positions.get('stack')!.x);
    assert.equal(positions.get('prompt-1')?.x, positions.get('prompt-2')?.x);
    assert.ok(positions.get('phase-2')!.y > positions.get('prompt-2')!.y);
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
    assert.match(widget, /panOnDrag: true, zoomOnScroll: true, zoomOnPinch: true/);
    assert.match(widget, /nodesDraggable: false, nodesConnectable: false/);
    assert.match(widget, /this\.flow\?\.zoomIn\(\)/);
    assert.match(widget, /this\.flow\?\.zoomOut\(\)/);
    assert.match(widget, /this\.flow\?\.fitView/);
    assert.doesNotMatch(widget, /onNodeDragStop|onConnect:|fitView\(\).*refresh/);
    assert.doesNotMatch(widget, /openChatPanel|CHAT_PANEL_ID|ChatPanelWidget|shell\.addWidget/);
    assert.match(css, /\.dope-roadmap-stage \{ flex: 1 1 auto; min-height: 160px; min-width: 0/);
    assert.match(css, /\.dope-roadmap-node :is\(small, strong, span\) \{ overflow-wrap: anywhere; white-space: normal/);
    assert.match(css, /@media \(max-width: 480px\).*\.dope-roadmap-stage/);
    const rules = css.slice(css.indexOf('.dope-roadmap-canvas'), css.indexOf('.dope-history-panel'));
    assert.match(rules, /var\(--theia-editor-background\)/);
    assert.match(rules, /var\(--theia-editor-foreground\)/);
    assert.doesNotMatch(rules, /#[0-9a-fA-F]{3,8}\b/);
});
