import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const { MapViewport, mapFitContext } = require('../../packages/theia-extension/lib/browser/map-viewport.js') as
  typeof import('../../packages/theia-extension/src/browser/map-viewport.ts');
const { mapLabel } = require('../../packages/theia-extension/lib/browser/map-label.js') as
  typeof import('../../packages/theia-extension/src/browser/map-label.ts');
const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');

test('relative semantic zoom has a fitted baseline and hysteresis', () => {
  const viewport = new MapViewport();
  assert.equal(viewport.detail(1, 'architecture'), 'architecture');
  viewport.fitted(0.4);
  assert.equal(viewport.detail(0.25, 'architecture'), 'overview');
  assert.equal(viewport.detail(0.3, 'overview'), 'overview');
  assert.equal(viewport.detail(0.34, 'overview'), 'architecture');
  assert.equal(viewport.detail(0.62, 'architecture'), 'implementation');
  assert.equal(viewport.detail(0.53, 'implementation'), 'implementation');
  assert.equal(viewport.detail(0.49, 'implementation'), 'architecture');
  viewport.fitted(0.8);
  assert.equal(viewport.detail(0.8, 'overview'), 'architecture');
});

test('fit identity changes for navigation but stays stable across LOD node changes', () => {
  const original = mapFitContext('workspace', 1, undefined, 'physical', undefined, 'current');
  assert.equal(original, mapFitContext('workspace', 1, undefined, 'physical', undefined, 'current'));
  assert.notEqual(original, mapFitContext('workspace', 1, 'system', 'physical', undefined, 'current'));
  assert.notEqual(original, mapFitContext('workspace', 2, undefined, 'physical', undefined, 'current'));
  const widget = read('packages/theia-extension/src/browser/physical-map-widget.ts');
  assert.match(widget, /if \(context !== this\.fitContext\)[\s\S]*?this\.fitRequested = true/);
  assert.match(widget, /onMoveEnd:[\s\S]*?this\.controller\.setDetail\(this\.viewport\.detail/);
  assert.match(widget, /private fitArchitecture\(\)[\s\S]*?this\.fitRequested = true/);
  assert.match(widget, /if \(!this\.fitRequested \|\| this\.fitQueued/);
  assert.doesNotMatch(widget, /renderedGraph|fitView: true/);
  assert.equal((widget.match(/\.fitView\(/g) ?? []).length, 1);
});

test('node identity renders in full with path breaks and theme-aware wrapping', () => {
  const name = 'source/long-path/module_name.ts:Handler';
  const markup = renderToStaticMarkup(React.createElement('strong', null, mapLabel(name)));
  assert.match(markup, /<wbr\/>/);
  assert.equal(markup.replace(/<[^>]*>/g, ''), name);
  const widget = read('packages/theia-extension/src/browser/physical-map-widget.ts');
  assert.match(widget, /React\.createElement\('strong', null, mapLabel\(item\.name\)\)/);
  assert.match(widget, /this\.breadcrumbs\.append\(overview\)/);
  assert.match(widget, /button\.textContent = item\.name/);
  assert.match(widget, /button\.onclick = \(\) => \{ this\.controller\.setDetail\('architecture'\); this\.controller\.focus\(item\.id\); \}/);
  assert.match(widget, /dope-map-\$\{item\.kind\} dope-map-\$\{item\.state\}/);
  assert.match(widget, /dope-plan-stale/);
  assert.match(widget, /dope-plan-conflicted/);
  assert.match(widget, /dope-plan-\$\{item\.intent\}/);
  assert.match(widget, /dope-plan-edge-\$\{item\.intent\}/);
  const css = read('packages/theia-extension/src/browser/dope.css');
  const mapCss = css.slice(css.indexOf('.dope-physical-map-view'), css.indexOf('.dope-dark {'));
  assert.doesNotMatch(mapCss, /text-overflow:\s*ellipsis|white-space:\s*nowrap|overflow:\s*hidden/);
  assert.match(mapCss, /\.dope-map-node strong \{[^}]*white-space: normal; overflow-wrap: anywhere/);
  assert.match(mapCss, /\.dope-map-node \{[^}]*color: var\(--theia-editor-foreground\); background: var\(--theia-editorWidget-background/);
  assert.match(mapCss, /\.dope-map-edge-selected .*stroke-width: 4/);
  for (const kind of ['system', 'subsystem', 'component', 'code', 'unassigned', 'detected-only', 'declared-only', 'drifted'])
    assert.match(mapCss, new RegExp(`\\.dope-map-${kind}\\b`));
  for (const intent of ['add', 'modify', 'remove', 'move', 'relationship', 'contract'])
    assert.match(mapCss, new RegExp(`\\.dope-plan-${intent}\\b`));
});
