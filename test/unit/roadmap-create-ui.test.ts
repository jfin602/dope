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
    assert.match(widget, /type: 'create-checkpoint'/);
    assert.match(widget, /type: 'edit-checkpoint'/);
    assert.match(widget, /previewDraft\(state\.handle, state\.path\)/);
    assert.match(widget, /acceptDraft\(state\.handle, state\.preview, true\)/);
    assert.match(widget, /this\.createState = undefined;\s*this\.inspector\.setSnapshot\(state\.uri, result\);\s*await this\.refresh\(\)/);
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

test('Chat entry associates an existing selected saved Chat without opening or moving a panel', () => {
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    const module = read('packages/theia-extension/src/browser/frontend-module.ts');
    assert.match(widget, /button\('Plan with Chat', \(\) => \{ void this\.beginCreate\('chat'\)/);
    assert.match(widget, /this\.savedChats\(state\.uri\)/);
    assert.match(widget, /await this\.service\.bindDraftChat\(state\.uri, state\.handle, chatId\)/);
    assert.match(widget, /state\.chatId = chatId \|\| undefined/);
    assert.match(widget, /Build the draft manually now|build the draft manually now/);
    assert.match(module, /getWidgets\(CHAT_PANEL_ID\)/);
    assert.match(module, /\['left', 'right'\] as const\)\.map\(side => widgets\.tryGetWidget\(chatLauncherIds\[side\]\)\)/);
    assert.match(module, /widget\.controller\.workspace !== workspace/);
    assert.match(module, /widget\.controller\.chat\.id/);
    assert.doesNotMatch(widget, /openChatPanel|shell\.addWidget|shell\.activateWidget|sendTurn|invokeModel/);
});

test('creation controls have labels, keyboard forms, narrow layout and semantic theme tokens', () => {
    const widget = read('packages/theia-extension/src/browser/roadmap-canvas-widget.ts');
    const css = read('packages/theia-extension/src/browser/dope.css');
    assert.match(widget, /form\.onsubmit = event => \{ event\.preventDefault\(\)/);
    assert.match(widget, /checkpointForm\.onsubmit = event => \{ event\.preventDefault\(\)/);
    assert.match(widget, /Roadmap creation preview/);
    assert.match(widget, /New Markdown path in this project/);
    assert.match(css, /\.dope-roadmap-create \{ display: grid/);
    assert.match(css, /\.dope-roadmap-create :is\(input, select\):focus-visible/);
    const rules = css.slice(css.indexOf('.dope-roadmap-create'), css.indexOf('.dope-roadmap-canvas header button'));
    assert.doesNotMatch(rules, /#[0-9a-fA-F]{3,8}\b/);
});
