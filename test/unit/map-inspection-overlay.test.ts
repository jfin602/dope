import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
const widget = read('packages/theia-extension/src/browser/physical-map-widget.ts');
const css = read('packages/theia-extension/src/browser/dope.css');

test('inspection states change only overlay DOM and retain map/controller state', () => {
  const body = widget.match(/private setInspectionState\(state: 'expanded' \| 'compact' \| 'minimized'\): void \{([\s\S]*?)\n    \}\n\n    private inspectionActionFor/)?.[1];
  assert.ok(body);
  assert.doesNotMatch(body, /controller|planning|flow|fit|render|query|root/);
  const attributes = new Map<string, string>();
  const button = () => ({ hidden: false, setAttribute: (name: string, value: string) => attributes.set(name, value) });
  const state = {
    inspection: { dataset: { state: '' } }, expandInspection: button(), compactInspection: button(), minimizeInspection: button(),
    controller: { selectedId: 'node', flowSelectedId: 'input', selectedFlowEdgeId: 'edge', focusId: 'system', direction: 'downstream' },
    planning: { selectedWorkItemId: 'work' }, fitContext: 'stable', fitRequested: false,
  };
  const before = structuredClone({ controller: state.controller, planning: state.planning, fitContext: state.fitContext, fitRequested: state.fitRequested });
  const transition = new Function('state', body) as (this: typeof state, state: string) => void;
  for (const value of ['compact', 'minimized', 'expanded']) {
    transition.call(state, value);
    assert.equal(state.inspection.dataset.state, value);
    assert.deepEqual({ controller: state.controller, planning: state.planning, fitContext: state.fitContext, fitRequested: state.fitRequested }, before);
  }
  assert.equal(state.expandInspection.hidden, true);
  assert.equal(state.compactInspection.hidden, false);
  assert.equal(state.minimizeInspection.hidden, false);
  assert.equal(attributes.get('aria-pressed'), 'false');
  assert.match(widget, /this\.inspection\.append\(inspectionHeader, this\.flowPanel, this\.planningOverlay\)/);
  assert.match(widget, /stage\.append\(this\.canvas, this\.inspection, this\.status\)/);
  assert.match(css, /\.dope-map-inspection \{[^}]*position: absolute; top: 8px; right: 8px;[^}]*max-height: calc\(100% - 48px\); overflow: auto/);
  assert.match(css, /\[data-state="compact"\][\s\S]*?\.dope-flow-panel/);
  assert.match(css, /\[data-state="minimized"\][\s\S]*?Inspect map/);
});

test('expanded inspection retains Flow evidence and Planning work while compact keeps context', () => {
  for (const text of ['Coverage:', 'coverage areas', 'diagnostics', 'Flow participants', 'Flow edges',
    'Selected Flow edge', 'originFlowFactIds', 'Data semantics', 'Evidence:', 'Open edge source']) assert.ok(widget.includes(text), text);
  for (const text of ['this.planningDetails, this.workPanel', 'Selected ${item.id}', 'Edit ${field}',
    'Preview branch adoption', 'Analyze and reconcile', 'Close out Planning Map']) assert.ok(widget.includes(text), text);
  assert.match(widget, /this\.inspectionSummary\.textContent = planningMode \?[\s\S]*?selectedWorkItem[\s\S]*?selectedMap/);
  assert.match(widget, /this\.inspectionSummary\.textContent = `\$\{selectedEdge[\s\S]*?coverageStatus[\s\S]*?truncated/);
  assert.match(widget, /this\.inspectionActionFor\(selectedEdge \? 'Open selected Flow edge evidence source'/);
  assert.doesNotMatch(css, /\.dope-flow-panel, \.dope-planning-inspection \{[^}]*position: absolute/);
  const inspector = read('packages/theia-extension/src/browser/software-map-widget.ts');
  assert.match(inspector, /this\.renderEvidence\(this\.controller\.evidence/);
  assert.match(inspector, /this\.controller\.source\(item\.id\)/);
});

test('icon controls use native buttons with labels, hover help and non-color states', () => {
  const body = widget.match(/function iconButton\([^)]*\): void \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const element = { className: '', setAttribute(name: string, value: string) { assert.equal(name, 'aria-hidden'); assert.equal(value, 'true'); } };
  const button = { type: '', title: '', label: '', replaceChildren(child: unknown) { assert.strictEqual(child, element); },
    setAttribute(name: string, value: string) { assert.equal(name, 'aria-label'); this.label = value; } };
  (new Function('button', 'label', 'icon', 'document', 'codicon', body) as (...args: unknown[]) => void)(
    button, 'Trace possible execution downstream from selection', 'arrow-right', { createElement: () => element }, (name: string) => `codicon codicon-${name}`);
  assert.equal(button.type, 'button');
  assert.equal(button.title, button.label);
  assert.equal(element.className, 'codicon codicon-arrow-right');
  for (const label of ['Move up one map level', 'Focus selected map object', 'Zoom in on map', 'Zoom out on map',
    'Fit current map to canvas', 'Open selected object source', 'Open selected object in a map tab',
    'Trace possible execution downstream from selection', 'Trace possible execution upstream from selection',
    'Clear current Flow trace', 'Expand map inspection', 'Compact map inspection', 'Minimize map inspection'])
    assert.ok(widget.includes(label), label);
  assert.match(widget, /control\.disabled = disabled; control\.onclick = action/);
  assert.match(widget, /aria-pressed', String\(controller\.direction === 'downstream'\)/);
  assert.match(css, /\.dope-physical-map-view button:focus-visible \{ outline: 2px solid var\(--theia-focusBorder\)/);
  assert.match(css, /\.dope-physical-map-view button:disabled \{ opacity: \.5/);
  assert.match(css, /\.dope-flow-bar button\[aria-pressed="true"\][^}]*outline: 2px solid/);
});

test('Flow context is legible and selected paths remain stronger across themes', () => {
  assert.doesNotMatch(css, /\.dope-flow-subdued \{ opacity: \.45/);
  assert.match(css, /\.react-flow__node\.dope-flow-subdued,[\s\S]*?\.react-flow__edge\.dope-flow-subdued \{ opacity: \.82/);
  assert.match(css, /\.react-flow__node\.dope-flow-selected,[\s\S]*?\.react-flow__edge\.dope-flow-selected \{ opacity: 1/);
  assert.match(css, /\.dope-flow-selected \.dope-flow-node \{ outline: 4px solid var\(--theia-focusBorder\);[^}]*border-width: 3px/);
  assert.match(css, /\.dope-flow-edge\.dope-flow-selected \.react-flow__edge-path \{[^}]*stroke-width: 5/);
  assert.match(css, /\.dope-flow-node strong \{ color: var\(--theia-editor-foreground\); font-weight: 700/);
  assert.match(css, /\.dope-flow-edge \.react-flow__edge-textbg \{ fill: var\(--theia-editorWidget-background, var\(--theia-editor-background\)\)/);
  const mapCss = css.slice(css.indexOf('.dope-physical-map-view'), css.indexOf('.dope-dark {'));
  assert.doesNotMatch(mapCss, /--dope-|#[0-9a-f]{6}\b/i);
  assert.match(mapCss, /\.dope-map-inspection \{[^}]*color: var\(--theia-editor-foreground\); background: var\(--theia-editorWidget-background, var\(--theia-editor-background\)\)/);
});
