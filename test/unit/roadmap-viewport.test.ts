import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readRoadmapViewport, roadmapGestures, roadmapKeyboardAction, roadmapViewportKey, roadmapLegacyViewportKey, roadmapViewportSnapshot } from
    '../../packages/theia-extension/src/browser/roadmap-viewport.ts';

const widget = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/roadmap-canvas-widget.ts'), 'utf8');

test('gesture policy keeps navigation separate from arrangement and semantic edges', () => {
    assert.deepEqual(roadmapGestures(false), { panOnDrag: true, zoomOnScroll: true, zoomOnPinch: true,
        nodesDraggable: false, nodesConnectable: false });
    assert.deepEqual(roadmapGestures(true), { panOnDrag: true, zoomOnScroll: true, zoomOnPinch: true,
        nodesDraggable: true, nodesConnectable: false });
    assert.match(widget, /onNodeDragStop:/);
    assert.match(widget, /this\.placements\.set\(node\.id/);
    assert.doesNotMatch(widget, /onConnect:/);
});

test('viewport state restores only within matching project and rejects corrupt coordinates', () => {
    const keyA = roadmapViewportKey('file:///one', 'id');
    const keyB = roadmapViewportKey('file:///two', 'id');
    assert.notEqual(keyA, keyB);
    assert.notEqual(keyA, roadmapLegacyViewportKey('file:///one', 'id'));
    const saved = roadmapViewportSnapshot('id', { x: -123, y: 45, zoom: 1.4 }, 'c1',
        new Set(['p1']), new Set(['p2']), new Map([['c1', { x: 111, y: 222 }]]));
    const restored = readRoadmapViewport(JSON.parse(JSON.stringify(saved)), 'id');
    assert.equal(restored.version, 2);
    assert.equal(restored.orientation, 'horizontal');
    assert.deepEqual(restored.viewport, saved.viewport);
    assert.equal(restored.selectedId, 'c1');
    assert.deepEqual(restored.expanded, ['p1']);
    assert.deepEqual(restored.placements.c1, { x: 111, y: 222 });
    assert.deepEqual(readRoadmapViewport({ ...saved, placements: { bad: { x: Infinity, y: 0 } } }, 'id').placements, {});
    assert.deepEqual(readRoadmapViewport(saved, 'other').placements, {});
    assert.equal(readRoadmapViewport(saved, 'other').selectedId, undefined);
    const legacy = { ...saved, version: 1, orientation: undefined };
    const migrated = readRoadmapViewport(legacy, 'id');
    assert.equal(migrated.selectedId, 'c1');
    assert.deepEqual(migrated.expanded, ['p1']);
    assert.equal(migrated.viewport, undefined);
    assert.deepEqual(migrated.placements, {});
    assert.deepEqual(readRoadmapViewport({ ...saved, orientation: 'vertical' }, 'id').placements, {});
    assert.equal(readRoadmapViewport({ ...saved, viewport: { x: 0, y: 0, zoom: 99 } }, 'id').viewport, undefined);
    assert.deepEqual(readRoadmapViewport(JSON.parse(JSON.stringify(restored)), 'id'), restored);
    assert.match(widget, /roadmapLegacyViewportKey\(projectUri, index\.projectId\)/);
    assert.match(widget, /flow\.fitView\(\{ padding: 0\.12 \}\)/);
    assert.match(widget, /setTimeout\(\(\) => this\.flushPresentation\(\), 350\)/);
    assert.match(widget, /this\.flow\.setViewport\(this\.viewport/);
});

test('keyboard navigation has pan and arrangement equivalents without overriding ordinary selection', () => {
    assert.equal(roadmapKeyboardAction('ArrowLeft', true, false, false), 'pan-left');
    assert.equal(roadmapKeyboardAction('ArrowUp', false, true, true), 'move-up');
    assert.equal(roadmapKeyboardAction('ArrowUp', false, true, false), undefined);
    assert.equal(roadmapKeyboardAction('ArrowDown', false, false, true), undefined);
    assert.match(widget, /this\.path\.tabIndex = 0/);
    assert.match(widget, /aria-pressed/);
});
