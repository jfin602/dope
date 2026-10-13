import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RoadmapProjection } from '../../packages/project-intelligence/src/roadmap-projection.ts';
import { roadmapCanvasOrder, roadmapNextId } from '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';
import { roadmapEdgeStatus, roadmapStatusMark, type RoadmapStatus } from '../../packages/theia-extension/src/browser/roadmap-status-style.ts';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
const node = (id: string, lane: 'path' | 'branch', order: number) => ({
    id, lane, order, kind: lane === 'path' ? 'phase' as const : 'correction' as const,
    title: id, status: 'unknown' as const, statusLabel: 'Unknown', evidence: [], readOnly: false,
});

test('one keyboard order follows the checkpoint path and attached branches', () => {
    const projection: RoadmapProjection = { projectId: 'project', revision: 1,
        nodes: [node('p1', 'path', 1), node('p2', 'path', 2), node('c1', 'branch', 3)],
        edges: [{ id: 'branch', from: 'p1', to: 'c1', kind: 'branch', label: 'Correction branch' }],
        pools: { ideas: [], issues: [] }, diagnostics: [] };
    const ids = roadmapCanvasOrder(projection).map(item => item.id);
    assert.deepEqual(ids, ['p1', 'c1', 'p2']);
    assert.equal(roadmapNextId(ids, 'p1', 'ArrowDown'), 'c1');
    assert.equal(roadmapNextId(ids, 'c1', 'ArrowRight'), 'p2');
    assert.equal(roadmapNextId(ids, 'p2', 'ArrowUp'), 'c1');
    assert.equal(roadmapNextId(ids, 'p2', 'Home'), 'p1');
    assert.equal(roadmapNextId(ids, 'p1', 'End'), 'p2');
    assert.equal(roadmapNextId(ids, 'p1', 'Enter'), undefined);
});

test('one ordinary center tab, safe labels, recovery, semantic dark/light tokens and no Chat docking effects', () => {
    const module = read('packages/theia-extension/src/browser/frontend-module.ts');
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(module, /id: ROADMAP_CANVAS_ID, createWidget:/);
    assert.match(module, /getOrCreateWidget<RoadmapCanvasWidget>\(ROADMAP_CANVAS_ID\)/);
    assert.match(module, /shell\.addWidget\(widget, \{ area: 'main' \}\)/);
    assert.match(module, /dope\.roadmap\.open/);
    assert.doesNotMatch(widget, /openChatPanel|CHAT_PANEL_ID|ChatPanelWidget|split/);
    assert.match(widget, /React\.createElement\('strong', null, item\.title\)/);
    assert.match(widget, /className: `dope-roadmap-node dope-roadmap-status-\$\{item\.status\}`/);
    assert.match(widget, /roadmapStatusMark\[item\.status\]/);
    assert.match(widget, /item\.statusLabel\)/);
    assert.doesNotMatch(widget, /innerHTML|insertAdjacentHTML/);
    assert.match(widget, /aria-current/);
    assert.match(widget, /aria-live/);
    assert.match(widget, /Use Refresh to retry/);
    assert.match(widget, /this\.node\.append\(this\.toolbar, this\.stage\)/);
    assert.match(widget, /this\.sourceButton\.setAttribute\('aria-controls', 'dope-roadmap-source-panel'\)/);
    assert.match(widget, /this\.sourceButton\.dataset\.review = String\(needsReview\)/);
    assert.match(widget, /this\.importEntry\.hidden = !open/);
    assert.match(css, /\.dope-roadmap-stage-host > \[hidden\] \{ display: none !important; \}/);
    assert.match(css, /\.dope-roadmap-canvas.*var\(--theia-editor-background\)/);
    assert.match(css, /\.dope-roadmap-node\[aria-current="true"\].*var\(--dope-primary, var\(--theia-focusBorder\)\)/);
    const rules = css.slice(css.indexOf('.dope-roadmap-canvas'), css.indexOf('.dope-history-panel'));
    assert.doesNotMatch(rules, /#[0-9a-fA-F]{3,8}\b/);
    assert.match(rules, /max-width: 480px/);
});

test('all six status marks and semantic colors remain distinct from selection and keyboard focus', () => {
    const css = read('packages/theia-extension/src/browser/dope.css');
    const states: RoadmapStatus[] = ['green', 'active', 'not-green', 'waived', 'not-implemented', 'unknown'];
    assert.equal(new Set(states.map(status => roadmapStatusMark[status])).size, states.length);
    for (const status of states) {
        assert.match(css, new RegExp(`\\.dope-roadmap-status-${status} \\{ --roadmap-status-color: var\\(--dope-roadmap-${status},`));
        assert.match(css, new RegExp(`\\.dope-roadmap-edge-${status} \\.react-flow__edge-path`));
    }
    for (const status of states.filter(value => value !== 'green')) {
        assert.doesNotMatch(css.match(new RegExp(`\\.dope-roadmap-status-${status} \\{[^}]+`))?.[0] ?? '', /--dope-roadmap-green/);
    }
    assert.match(css, /\.dope-roadmap-node\[aria-current="true"\]/);
    assert.match(css, /\.dope-roadmap-canvas button:focus-visible/);
    assert.match(css, /\.dope-roadmap-status-mark/);
    assert.match(read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts'), /'aria-hidden': true.*roadmapStatusMark\[item\.status\]/);
});

test('only actual Green to Green dependencies or branches look completed', () => {
    const states: RoadmapStatus[] = ['green', 'active', 'not-green', 'waived', 'not-implemented', 'unknown'];
    for (const from of states) for (const to of states) {
        assert.equal(roadmapEdgeStatus(from, to) === 'green', from === 'green' && to === 'green');
    }
    assert.equal(roadmapEdgeStatus(undefined, 'green'), 'unknown');
    assert.equal(roadmapEdgeStatus('green', undefined), 'unknown');
    assert.equal(roadmapEdgeStatus('green', 'waived'), 'waived');
    assert.equal(roadmapEdgeStatus('not-green', 'green'), 'not-green');
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    assert.match(widget, /roadmapEdgeStatus\(statuses\.get\(item\.from\), statuses\.get\(item\.to\)\)/);
    assert.match(widget, /dope-roadmap-edge-\$\{item\.kind\} dope-roadmap-edge-\$\{status\}/);
    assert.match(widget, /ariaLabel: `\$\{item\.label\};/);
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(css, /\.dope-roadmap-edge-branch \.react-flow__edge-path \{ stroke-dasharray: 6 4; \}/);
    assert.match(css, /\.dope-roadmap-edge-active \.react-flow__edge-path \{[^}]*stroke-dasharray:/);
});
