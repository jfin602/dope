import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readRoadmapViewport, roadmapGestures, roadmapInitialCamera, roadmapInitialTarget, roadmapKeyboardAction, roadmapKeyboardCamera,
    roadmapUserViewportEvent, roadmapViewportKey, roadmapLegacyViewportKey, roadmapViewportSnapshot } from
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
    assert.equal(restored.viewportIntent, 'user');
    assert.equal(restored.selectedId, 'c1');
    assert.deepEqual(restored.expanded, ['p1']);
    assert.deepEqual(restored.collapsed, ['p2']);
    assert.deepEqual(restored.placements.c1, { x: 111, y: 222 });
    assert.deepEqual(readRoadmapViewport({ ...saved, placements: { bad: { x: Infinity, y: 0 } } }, 'id').placements, {});
    assert.deepEqual(readRoadmapViewport(saved, 'other').placements, {});
    assert.equal(readRoadmapViewport(saved, 'other').selectedId, undefined);
    assert.deepEqual(readRoadmapViewport(saved, 'other').expanded, []);
    assert.deepEqual(readRoadmapViewport(saved, 'other').collapsed, []);
    const legacy = { ...saved, version: 1, orientation: undefined };
    const migrated = readRoadmapViewport(legacy, 'id');
    assert.equal(migrated.selectedId, 'c1');
    assert.deepEqual(migrated.expanded, ['p1']);
    assert.equal(migrated.viewport, undefined);
    assert.deepEqual(migrated.placements, {});
    assert.deepEqual(readRoadmapViewport({ ...saved, orientation: 'vertical' }, 'id').placements, {});
    assert.equal(readRoadmapViewport({ ...saved, viewport: { x: 0, y: 0, zoom: 99 } }, 'id').viewport, undefined);
    assert.equal(readRoadmapViewport({ ...saved, viewportIntent: undefined,
        viewport: { x: -50, y: 20, zoom: 0.2 } }, 'id').viewport, undefined);
    assert.deepEqual(readRoadmapViewport({ ...saved, viewport: { x: -50, y: 20, zoom: 0.2 } }, 'id').viewport,
        { x: -50, y: 20, zoom: 0.2 }); // Explicit Fit is intentional, even at world zoom.
    assert.deepEqual(readRoadmapViewport({ ...saved, viewportIntent: undefined }, 'id').viewport, saved.viewport);
    assert.deepEqual(readRoadmapViewport(JSON.parse(JSON.stringify(restored)), 'id'), restored);
    assert.match(widget, /roadmapLegacyViewportKey\(projectUri, index\.projectId\)/);
    assert.doesNotMatch(widget, /else requestAnimationFrame\(\(\) => .*fitView/);
    assert.match(widget, /this\.intentionalCamera\(flow => flow\.fitView\(\{ padding: 0\.12, maxZoom: 1 \}\)\)/);
    assert.match(widget, /setTimeout\(\(\) => this\.flushPresentation\(\), 350\)/);
    assert.match(widget, /this\.flow\.setViewport\(this\.viewport/);
    assert.match(widget, /state\.expanded\.forEach\(id => this\.expanded\.add\(id\)\)/);
    assert.match(widget, /if \(restoredTask\) this\.inspector\.selectTask\(restoredTask\)/);
});

test('current work uses authoritative phase statuses and a readable centered camera', () => {
    const nodes = [
        { id: 'old-active-correction', kind: 'correction', order: 13, status: 'active' },
        { id: 'phase-9', kind: 'phase', order: 24, status: 'green' },
        { id: 'phase-10', kind: 'phase', order: 25, status: 'not-green' },
        { id: 'phase-11', kind: 'phase', order: 26, status: 'not-implemented' },
    ];
    assert.equal(roadmapInitialTarget(nodes)?.id, 'phase-10');
    assert.equal(roadmapInitialTarget(nodes.filter(node => node.kind !== 'phase'))?.id, 'old-active-correction');
    const camera = roadmapInitialCamera({ x: 4200, y: 640 }, 1100, 700);
    assert.equal(camera.zoom, 0.9);
    assert.equal(4200 * camera.zoom + camera.x + 140 * camera.zoom, 550);
    assert.equal(640 * camera.zoom + camera.y + 80 * camera.zoom, 350);
    assert.ok((4200 - 420) * camera.zoom + camera.x > 0);
    assert.ok((4200 + 420) * camera.zoom + camera.x < 1100);
});

test('keyboard navigation reveals an offscreen checkpoint at the current zoom', () => {
    const current = { x: -4000, y: -400, zoom: 0.9 };
    const target = { x: 6000, y: 500 };
    const next = roadmapKeyboardCamera(target, 700, 470, current);
    assert.ok(next);
    assert.equal(next.zoom, current.zoom);
    assert.equal(next.x + (target.x + 140) * next.zoom, 350);
    assert.equal(next.y + (target.y + 40) * next.zoom, 235);
    assert.equal(roadmapKeyboardCamera(target, 700, 470, next), undefined);
    const tall = roadmapKeyboardCamera({ x: 0, y: 300 }, 700, 470,
        { x: 80, y: 0, zoom: 1 }, 280, 170);
    assert.ok(tall);
    assert.equal(tall.y + 300 + 85, 235);
    assert.match(widget, /this\.select\(next, true\)/);
    assert.match(widget, /onFocus: event => data\.reveal\(item\.id, event\.currentTarget as HTMLButtonElement\)/);
    assert.match(widget, /roadmapKeyboardCamera\(position, this\.stage\.clientWidth, this\.stage\.clientHeight/);
});

test('keyboard and Focus Selection camera changes honor reduced motion', () => {
    assert.match(widget, /duration: window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches \? 0 : 160/);
    assert.match(widget, /duration: window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)\.matches \? 0 : 320/);
});

test('widget initializes after project projection and saves only intentional camera changes', () => {
    assert.match(widget, /this\.initialCameraPending = !state\.viewport/);
    assert.match(widget, /this\.projection = projectRoadmapTasks\(index, tasks, owners/);
    assert.match(widget, /this\.queueInitialCamera\(\)/);
    assert.match(widget, /generation === this\.cameraGeneration && uri === this\.projectUri && flow === this\.flow/);
    assert.match(widget, /cameraGeneration !== this\.cameraGeneration \|\|[\s\S]*?cameraProjectUri !== this\.projectUri\) return;[\s\S]*?if \(roadmapUserViewportEvent\(event\)\) this\.recordUserCamera\(viewport\)/);
    assert.match(widget, /flow !== this\.flow \|\| generation !== this\.cameraGeneration \|\| uri !== this\.projectUri/);
    assert.match(widget, /this\.displayedViewport = camera;[\s\S]*?void this\.flow\.setViewport\(camera\)/);
    assert.match(widget, /if \(this\.flow\) this\.displayedViewport = this\.flow\.getViewport\(\)/);
    assert.doesNotMatch(widget, /void this\.flow\.fitView\(\{ padding: 0\.12 \}\)/);
});

test('automatic graph measurement cannot become saved user camera intent', () => {
    assert.equal(roadmapUserViewportEvent(undefined), false);
    assert.equal(roadmapUserViewportEvent({ type: 'zoom', isTrusted: true }), false);
    assert.equal(roadmapUserViewportEvent({ type: 'wheel', isTrusted: false }), false);
    assert.equal(roadmapUserViewportEvent({ type: 'wheel', isTrusted: true }), true);
    assert.equal(roadmapUserViewportEvent({ type: 'pointerup', isTrusted: true }), true);
    assert.match(widget, /if \(roadmapUserViewportEvent\(event\)\) this\.recordUserCamera\(viewport\)/);
    assert.match(widget, /this\.automaticCamera = camera;[\s\S]*?this\.flow\.setViewport\(camera\)/);
});

test('keyboard navigation has pan and arrangement equivalents without overriding ordinary selection', () => {
    assert.equal(roadmapKeyboardAction('ArrowLeft', true, false, false), 'pan-left');
    assert.equal(roadmapKeyboardAction('ArrowUp', false, true, true), 'move-up');
    assert.equal(roadmapKeyboardAction('ArrowUp', false, true, false), undefined);
    assert.equal(roadmapKeyboardAction('ArrowDown', false, false, true), undefined);
    assert.match(widget, /this\.path\.tabIndex = 0/);
    assert.match(widget, /aria-pressed/);
});
