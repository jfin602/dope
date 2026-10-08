import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { chatLauncherIds, openChatPanel, shouldSendChatInput, workLauncherIds } from
    '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
import { SharedPanelState, WorkOpenOwners } from '../../packages/theia-extension/lib/browser/shared-panel-state.js';

test('Chat and Work have distinct left/right launchers; center and bottom keep requested areas', async () => {
    assert.notEqual(workLauncherIds.left, chatLauncherIds.left);
    assert.notEqual(workLauncherIds.right, chatLauncherIds.right);
    const placed: string[] = [];
    const shell = { async addWidget(_widget: { id: string }, options: { area: string }) { placed.push(options.area); },
        async activateWidget(id: string) { placed.push(id); } };
    for (const area of ['center', 'bottom'] as const) {
        const widget = await openChatPanel(area, async options => ({ id: options.instanceId }), shell);
        assert.equal(placed.at(-1), widget.id);
    }
    assert.deepEqual([placed[0], placed[2]], ['main', 'bottom']);
    const module = await readFile(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
    assert.match(module, /bindViewContribution\(bind, LeftWorkLauncher\)/);
    assert.match(module, /bindViewContribution\(bind, RightWorkLauncher\)/);
    for (const command of ['dope.work.open', 'dope.work.openPromptStack', 'dope.agentRun.open', 'dope.phaseStack.open'])
        assert.ok(module.includes(`id: '${command}'`), command);
    assert.match(module, /id: 'dope\.agentRun\.open' \}, \{ execute: \(\) => openWork\('center'\) \}/);
    assert.match(module, /id: 'dope\.phaseStack\.open' \}, \{ execute: \(\) => openWork\('center', true\) \}/);
    assert.doesNotMatch(module, /AgentRunWidget|PhaseStackWidget/);
});

test('Work composer submits Enter, retains Shift+Enter and never stops from navigation', async () => {
    assert.equal(shouldSendChatInput({ key: 'Enter', shiftKey: false, isComposing: false, keyCode: 13 }), true);
    assert.equal(shouldSendChatInput({ key: 'Enter', shiftKey: true, isComposing: false, keyCode: 13 }), false);
    const owners = new WorkOpenOwners();
    const panel = new SharedPanelState(owners, 'panel', () => {}, () => {});
    panel.attach('file:///project');
    assert.equal(panel.selectWork({ kind: 'run', id: 'saved-run' }), true);
    panel.setMode('chat'); panel.setMode('work'); panel.selectWork(undefined); panel.dispose();
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    assert.match(widget, /if \(shouldSendChatInput\(event\)\)/);
    assert.match(widget, /if \(!controller\.canStart\) return/);
    assert.match(widget, /this\.directController\.select\(run\.id\)\.then\(\(\) => this\.directController\?\.stop\(\)\)/);
    assert.doesNotMatch(widget.slice(widget.indexOf('private selectWork('), widget.indexOf('private renderWorkComposer')),
        /\.stop\(/);
    assert.doesNotMatch(widget.slice(widget.indexOf('override dispose(): void')), /\.stop\(/);
});
