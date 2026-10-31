import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');

test('blank Roadmap exposes model-free draft, preview, approval, cancellation and recovery', () => {
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    const service = read('packages/theia-extension/src/roadmap-service.ts');
    const backend = read('packages/theia-extension/src/node/backend-module.ts');
    assert.match(widget, /button\('Create Manually', \(\) => \{ void this\.beginCreate\('manual'\)/);
    assert.match(widget, /editDraft\(state\.handle, state\.draft\.revision, action\)/);
    assert.match(widget, /type: 'create-phase'/);
    assert.match(widget, /previewDraft\(state\.handle, state\.path\)/);
    assert.match(widget, /acceptDraft\(state\.handle, state\.preview, true\)/);
    assert.match(widget, /this\.createState = undefined;\s*await this\.refresh\(\)/);
    assert.match(widget, /type: 'create-gate'/);
    assert.match(widget, /type: 'add-criterion'/);
    assert.match(widget, /Accept Roadmap structure \(no Markdown publication\)/);
    assert.match(widget, /if \(this\.createState\) \{\s*const draft = await this\.service\.readDraft\(this\.createState\.handle\)/);
    assert.match(widget, /cancelDraft\(state\.handle\)/);
    assert.match(widget, /role', 'alert'/);
    assert.match(widget, /Refresh to recover/);
    for (const name of ['beginDraft', 'editDraft', 'previewDraft', 'acceptDraft', 'cancelDraft']) {
        assert.match(service, new RegExp(`${name}\\(`));
        assert.match(backend, new RegExp(`${name}:`));
    }
    assert.match(backend, /new RoadmapGreenfield\(context\.container\.get\(RoadmapStore\)\)/);
});

test('retired plan submission has no Chat, Roadmap, or Pi entry point', () => {
    for (const path of ['packages/theia-extension/src/node/chat-backend.ts',
        'packages/theia-extension/src/browser/roadmap-canvas-widget.ts',
        'packages/theia-extension/src/roadmap-service.ts',
        'packages/pi-runtime/worker.mjs']) {
        const source = read(path);
        assert.doesNotMatch(source, /submit_plan|planOnly|beginImplementationPlan|Plan with Chat|previewImplementationPlanProjection/);
    }
});

test('creation controls have labels, keyboard forms, narrow layout and semantic theme tokens', () => {
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(widget, /form\.onsubmit = event => \{ event\.preventDefault\(\)/);
    assert.match(widget, /gateForm\.onsubmit = event => \{ event\.preventDefault\(\)/);
    assert.match(widget, /Roadmap creation preview/);
    assert.match(widget, /Proposed Markdown path \(publication requires separate approval\)/);
    assert.match(css, /\.dope-roadmap-create \{ display: grid/);
    assert.match(css, /\.dope-roadmap-create :is\(input, select\):focus-visible/);
    const rules = css.slice(css.indexOf('.dope-roadmap-create'), css.indexOf('.dope-roadmap-canvas header button'));
    assert.doesNotMatch(rules, /#[0-9a-fA-F]{3,8}\b/);
});
