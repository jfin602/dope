import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RoadmapProjection } from '../../packages/project-intelligence/src/roadmap-projection.ts';
import { roadmapCanvasOrder, roadmapNextId } from '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';

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
    assert.match(widget, /title\.textContent = node\.title/);
    assert.match(widget, /state\.textContent = node\.statusLabel/);
    assert.doesNotMatch(widget, /innerHTML|insertAdjacentHTML/);
    assert.match(widget, /aria-current/);
    assert.match(widget, /aria-live/);
    assert.match(widget, /Use Refresh to retry/);
    assert.match(css, /\.dope-roadmap-canvas.*var\(--theia-editor-background\)/);
    assert.match(css, /\.dope-roadmap-canvas li button\[aria-current="true"\].*var\(--dope-primary, var\(--theia-focusBorder\)\)/);
    const rules = css.slice(css.indexOf('.dope-roadmap-canvas'), css.indexOf('.dope-history-panel'));
    assert.doesNotMatch(rules, /#[0-9a-fA-F]{3,8}\b/);
    assert.match(rules, /max-width: 480px/);
});
