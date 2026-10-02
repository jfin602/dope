import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
const widget = read('packages/theia-extension/src/browser/physical-map-widget.ts');
const css = read('packages/theia-extension/src/browser/dope.css');

test('one map toolbar owns shared, Flow and Planning controls; details overlay the fill stage', () => {
  assert.equal((widget.match(/document\.createElement\('header'\)/g) ?? []).length, 1);
  assert.match(widget, /bar\.className = 'dope-map-toolbar'/);
  assert.match(widget, /bar\.append\([\s\S]*?this\.flowBar, this\.planningBar, this\.breadcrumbs\)/);
  assert.match(widget, /stage\.append\(this\.canvas, this\.inspection, this\.status\)/);
  assert.match(widget, /this\.inspection\.append\(inspectionHeader, this\.flowPanel, this\.planningOverlay\)/);
  assert.match(widget, /this\.planningOverlay\.append\(this\.planningDetails, this\.workPanel\)/);
  assert.match(widget, /this\.planningOverlay\.hidden = !planningMode/);
  assert.match(widget, /this\.flowBar\.append\(control\)/);
  assert.match(widget, /control\.onclick = action; parent\.append\(control\)/);
  assert.match(widget, /this\.planning\.setView\(view\), this\.planning\.view === view, bar/);
  assert.match(widget, /this\.breadcrumbs\.setAttribute\('aria-label', 'Map focus'\)/);
  assert.match(widget, /this\.status\.setAttribute\('aria-live', 'polite'\)/);
  assert.match(css, /\.dope-map-stage \{[^}]*flex: 1 1 auto; min-height: 0; min-width: 0/);
  assert.match(css, /\.dope-physical-map-canvas \{[^}]*position: absolute; inset: 0/);
  assert.match(css, /\.dope-map-inspection \{[^}]*position: absolute/);
  assert.doesNotMatch(css, /\.dope-flow-panel \{[^}]*max-height: 190px|\.dope-work-panel \{[^}]*max-height: 210px/);
});

test('one React Flow surface uses toolbar zoom and explicit fit without shell-triggered refits', () => {
  assert.doesNotMatch(widget, /\bControls\b|showInteractive/);
  assert.match(widget, /zoomIn\.onclick = \(\) => void this\.flow\?\.zoomIn\(\)/);
  assert.match(widget, /zoomOut\.onclick = \(\) => void this\.flow\?\.zoomOut\(\)/);
  assert.match(widget, /fit\.onclick = \(\) => this\.fitArchitecture\(\)/);
  assert.match(widget, /button\('Trace downstream', \(\) => controller\.trace\('downstream'\)/);
  assert.match(widget, /button\('Trace upstream', \(\) => controller\.trace\('upstream'\)/);
  assert.match(widget, /button\('Clear trace', \(\) => controller\.trace\(\)/);
  assert.match(widget, /if \(context !== this\.fitContext\)[\s\S]*?this\.fitRequested = true/);
  assert.match(widget, /onMoveEnd:[\s\S]*?this\.viewport\.detail/);
  assert.equal((widget.match(/\.fitView\(/g) ?? []).length, 1);
});
