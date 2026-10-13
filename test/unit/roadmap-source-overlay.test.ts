import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const widget = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/roadmap-canvas-widget.ts'), 'utf8');
const css = readFileSync(resolve(import.meta.dirname, '../../packages/theia-extension/src/browser/dope.css'), 'utf8');

test('Linked Markdown close, minimize and reopen preserve the existing draft and preview state', () => {
    const presentation = widget.slice(widget.indexOf('private setSourceOpen('), widget.indexOf('private setPoolOpen('));
    assert.match(presentation, /this\.importEntry\.hidden = !open/);
    assert.match(presentation, /this\.sourceFocus\?\.isConnected/);
    assert.match(presentation, /this\.sourceView === 'minimized'\) this\.setSourceView\('compact'\)/);
    assert.match(presentation, /this\.importEntry\.dataset\.state = view/);
    assert.doesNotMatch(presentation, /renderImportEntry|refresh\(|cancelDraft|acceptDraft|applyDocumentSync|applyRelink|applyPendingRecovery/);
    assert.match(css, /\.dope-roadmap-import\[data-state="minimized"\] > :not\(\.dope-roadmap-source-header\) \{ display: none/);
});

test('toolbar still exposes every source warning and approval while the overlay is closed', () => {
    const render = widget.slice(widget.indexOf('private renderImportEntry('), widget.indexOf('private async applySync('));
    for (const state of ['source-changed', 'conflict', 'relink-needed', 'pending', 'approvalPending', 'sourceError']) {
        assert.match(render, new RegExp(state));
    }
    assert.match(render, /this\.sourceButton\.dataset\.review = String\(needsReview\)/);
    assert.match(render, /this\.sourceLabel\.textContent =/);
    assert.match(widget, /this\.sourceLabel\.setAttribute\('aria-live', 'polite'\)/);
    assert.match(render, /Apply source changes/);
    assert.match(render, /Review interrupted sync/);
    assert.match(render, /Relink Markdown/);
    assert.match(render, /Import Roadmap/);
    assert.match(render, /Imported checkpoints and source mapping/);
    assert.match(render, /Accepted source SHA-256/);
    assert.match(render, /Plan with Chat/);
    assert.match(render, /Create Manually/);
    assert.match(widget, /Approve and create \$\{state\.preview\.path\}/);
    assert.match(widget, /Cancel draft/);
    assert.match(widget, /this\.syncPreview !== preview \|\| this\.syncApplying/);
});
