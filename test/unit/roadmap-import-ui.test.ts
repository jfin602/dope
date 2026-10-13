import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(import.meta.dirname, '../..', path), 'utf8');
const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
const service = read('packages/theia-extension/src/roadmap-service.ts');
const backend = read('packages/theia-extension/src/node/backend-module.ts');

test('empty Roadmap exposes three clear actions without moving or creating Chat', () => {
    assert.match(widget, /button\('Import Roadmap',/);
    assert.match(widget, /button\('Plan with Chat',/);
    assert.match(widget, /button\('Create Manually',/);
    assert.match(widget, /index\.revision !== 0\) return/);
    assert.doesNotMatch(widget, /openChatPanel|CHAT_PANEL_ID|ChatPanelWidget|shell\.addWidget/);
    assert.match(widget, /No Roadmap yet\. Import one, create manually, or plan with an existing Chat/);
});

test('candidate choice is preview only; cancel and unsupported content cannot accept', () => {
    assert.match(widget, /this\.service\.discoverImports\(uri\)/);
    assert.match(widget, /select\.onchange = \(\) => void this\.previewImport\(select\.value\)/);
    assert.match(widget, /this\.service\.previewImport\(state\.uri, path\)/);
    assert.match(widget, /private cancelImport\(\): void \{ \+\+this\.importSerial; this\.importState = undefined/);
    assert.match(widget, /!preview\.checkpoints\.length \|\| !preview\.checkpoints\.some/);
    assert.match(widget, /Import diagnostics/);
    assert.match(widget, /Not Green checkpoint/);
    assert.match(widget, /Linked Markdown:/);
});

test('acceptance is checked at UI and store boundaries; stale project or preview cannot write', () => {
    assert.match(widget, /current\.projectId !== state\.projectId \|\| current\.revision !== state\.revision/);
    assert.match(widget, /this\.service\.acceptImport\(state\.uri, state\.revision, state\.projectId, state\.preview\)/);
    assert.match(widget, /serial === this\.importSerial && this\.projectUri === uri/);
    assert.match(service, /acceptImport\(projectUri: string, expectedRevision: number, expectedProjectId: string, preview: RoadmapImportPreview\)/);
    assert.match(backend, /\.acceptImport\(await context\.container\.get\(PlanningStore\)\.root\(uri\), revision, importPreview, projectId\)/);
    const store = read('packages/project-intelligence/src/node/roadmap-store.ts');
    assert.match(store, /JSON\.stringify\(preview\) !== JSON\.stringify\(fresh\)/);
    assert.match(store, /linked document differs; explicit relink is required/);
});

test('chooser uses native keyboard controls and semantic focus tokens at narrow width', () => {
    assert.match(widget, /document\.createElement\('select'\)/);
    assert.match(widget, /document\.createElement\('button'\)/);
    assert.match(widget, /querySelector<HTMLSelectElement>\('select'\)\?\.focus\(\)/);
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(css, /\.dope-roadmap-import select:focus-visible/);
    assert.match(css, /\.dope-roadmap-import-chooser label \{[^}]*flex: 1 1 16rem/);
    const rules = css.slice(css.indexOf('.dope-roadmap-import {'), css.indexOf('.dope-roadmap-canvas header button'));
    assert.doesNotMatch(rules, /#[0-9a-fA-F]{3,8}\b/);
});
