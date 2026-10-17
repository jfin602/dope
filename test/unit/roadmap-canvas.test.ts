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
    assert.doesNotMatch(widget, /openChatPanel|CHAT_PANEL_ID|ChatPanelWidget|shell\.addWidget/);
    assert.match(widget, /React\.createElement\('strong', null, item\.title\)/);
    assert.match(widget, /className: `dope-roadmap-node dope-roadmap-status-\$\{item\.status\}\$\{item\.draftState/);
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
    assert.match(css, /\.dope-roadmap-node\[aria-current="true"\].*var\(--dope-primary, var\(--dope-roadmap-focus, var\(--theia-focusBorder\)\)\)/);
    const rules = css.slice(css.indexOf('.dope-roadmap-canvas'), css.indexOf('.dope-history-panel'));
    assert.doesNotMatch(rules, /#[0-9a-fA-F]{3,8}\b/);
    assert.match(rules, /max-width: 480px/);
});

test('Details command and selection use one mounted inspector model in the canvas with safe overlay states', () => {
    const module = read('packages/theia-extension/src/browser/frontend-module.ts');
    const canvas = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    const inspector = read('packages/theia-extension/src/browser/roadmap-inspector-widget.ts');
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(canvas, /this\.inspectionEditor = new RoadmapInspectorWidget\(inspector\)/);
    assert.match(canvas, /this\.stage\.append\(this\.path, this\.status, this\.importEntry, this\.inspection/);
    assert.match(canvas, /this\.setInspectionView\('compact'\);\s*this\.setInspectionOpen\(!node\.draftState\)/);
    assert.match(canvas, /this\.details\.onclick = \(\) => this\.openDetails\(\)/);
    assert.match(module, /id: 'dope\.roadmap\.inspector'.*Show Roadmap Details/);
    assert.match(module, /widget\.openDetails\(\)/);
    assert.doesNotMatch(module, /RoadmapInspectorView/);
    assert.match(module, /new RoadmapInspectorWidget\(context\.container\.get\(RoadmapInspectorModel\), false\)/);
    assert.doesNotMatch(inspector, /AbstractViewContribution/);
    assert.match(inspector, /this\.editable && !item\.readOnly && this\.model\.draft/);
    assert.match(canvas, /this\.inspection\.onkeydown = event => \{ if \(event\.key === 'Escape'\)/);
    assert.match(canvas, /this\.inspectionReturnFocus/);
    assert.match(canvas, /this\.inspectionFocus/);
    assert.match(canvas, /this\.inspectionExpand\.focus\(\)/);
    assert.match(canvas, /else this\.path\.focus\(\)/);
    assert.match(canvas, /this\.inspection\.hidden = !open/);
    assert.match(canvas, /this\.inspection\.dataset\.state = view/);
    assert.match(canvas, /this\.inspector\.dirty \|\| this\.inspector\.requiresApproval/);
    assert.match(canvas, /this\.stage\.clientWidth < 1240/);
    assert.match(canvas, /this\.setSourceOpen\(false\)/);
    assert.match(css, /\.dope-roadmap-inspection\[data-state="compact"\]/);
    assert.match(css, /\.dope-roadmap-inspection\[data-state="minimized"\]/);
    assert.doesNotMatch(canvas, /openChatPanel|CHAT_PANEL_ID|ChatPanelWidget/);
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

test('the whole Roadmap card keeps its status tint through hover, selection and focus', () => {
    const css = read('packages/theia-extension/src/browser/dope.css');
    const rule = (selector: string) => css.match(new RegExp(`${selector} \\{([^}]+)\\}`))?.[1] ?? '';
    const card = rule('\\.dope-roadmap-node');
    const hover = rule('\\.dope-roadmap-node:hover');
    const selected = rule('\\.dope-roadmap-node\\[aria-current="true"\\]');
    assert.match(card, /color: var\(--theia-editor-foreground\)/);
    assert.match(card, /background: color-mix\(in srgb, var\(--roadmap-status-color, var\(--theia-descriptionForeground\)\)/);
    assert.match(card, /var\(--roadmap-status-fill, 13%\)/);
    assert.match(card, /var\(--theia-editorWidget-background, var\(--theia-editor-background\)\)/);
    assert.match(card, /border: 2px solid color-mix\(in srgb, var\(--roadmap-status-color/);
    assert.match(card, /var\(--theia-widget-border, var\(--theia-descriptionForeground\)\)/);
    assert.match(card, /border-left-width: 5px/);
    assert.match(hover, /background: color-mix\(in srgb, var\(--roadmap-status-color/);
    assert.match(hover, /var\(--roadmap-status-hover-fill, 19%\)/);
    assert.doesNotMatch(selected, /background:|border-left:/);
    assert.match(selected, /box-shadow: 0 0 0 2px var\(--dope-primary, var\(--dope-roadmap-focus, var\(--theia-focusBorder\)\)\)/);
    assert.match(css, /\.dope-roadmap-canvas button:focus-visible \{ outline: 2px solid var\(--dope-roadmap-focus, var\(--theia-focusBorder\)\)/);
    assert.doesNotMatch(rule('\\.dope-roadmap-node:disabled'), /opacity:|background:/);
    for (const status of ['green', 'active', 'not-green', 'waived', 'not-implemented', 'unknown']) {
        assert.match(rule(`\\.dope-roadmap-status-${status}`), /--roadmap-status-color: var\(--dope-roadmap-/);
    }
    assert.match(rule('\\.dope-roadmap-status-not-implemented'), /--roadmap-status-fill: 9%/);
    assert.match(rule('\\.dope-roadmap-status-unknown'), /--roadmap-status-fill: 6%/);
    assert.doesNotMatch(card + hover, /#[0-9a-fA-F]{3,8}\b/);
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
    assert.match(widget, /item\.kind === 'dependency' \? ` dope-roadmap-edge-\$\{status\}` : ''/);
    assert.match(widget, /roadmapCanvasConnectors\(visible\)/);
    assert.match(widget, /ariaLabel: `\$\{item\.label\};/);
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(css, /\.dope-roadmap-edge-branch \.react-flow__edge-path \{ stroke-dasharray: 6 4; \}/);
    assert.match(css, /\.dope-roadmap-edge-active \.react-flow__edge-path \{[^}]*stroke-dasharray:/);
});

test('relationship motion is brief, selection-only and static under reduced motion', () => {
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(css, /\.dope-roadmap-edge-related \.react-flow__edge-path \{[^}]*animation: dope-roadmap-relationship-focus 420ms ease-out 1/);
    assert.match(css, /\.dope-roadmap-stage:not\(\.dope-roadmap-arranging\) \.react-flow__node \{ transition: transform 180ms ease-out/);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.dope-roadmap-edge-related \.react-flow__edge-path \{ animation: none; \}/);
    assert.doesNotMatch(css, /\.dope-roadmap-edge-active \.react-flow__edge-path \{[^}]*animation:/);
    assert.doesNotMatch(css, /animation-iteration-count:\s*infinite/);
});

test('Roadmap status ink uses theme-scoped contrast corrections', () => {
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(css, /body\.theia-light:not\(\.dope-dark\) \{[\s\S]*?--dope-roadmap-active:/);
    assert.match(css, /body\.theia-light:not\(\.dope-dark\) \{[\s\S]*?--dope-roadmap-unknown:/);
    assert.match(css, /body\.theia-light:not\(\.dope-dark\) \{[\s\S]*?--dope-roadmap-focus:/);
    assert.match(css, /--dope-roadmap-not-implemented: color-mix\(in srgb, var\(--theia-foreground\) 80%/);
});

test('closing details restores focus captured before the panel becomes hidden', () => {
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    assert.match(widget, /const hadFocus = this\.inspection\.contains\(document\.activeElement\);[\s\S]*?this\.inspection\.hidden = !open;[\s\S]*?else if \(hadFocus\)/);
});
