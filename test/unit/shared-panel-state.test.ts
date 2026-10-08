import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readSharedPanelLayout, SharedPanelState, WorkOpenOwners } from '../../packages/theia-extension/lib/browser/shared-panel-state.js';

const project = 'file:///projects/example';
const work = { kind: 'task' as const, id: 'task-1' };
const other = { kind: 'sequence' as const, id: 'stack-1' };

test('mode toggle retains independent Chat and Work selections without runtime effects', () => {
    const owners = new WorkOpenOwners();
    let changed = 0;
    const panel = new SharedPanelState(owners, 'panel-a', () => {}, () => changed++);
    panel.attach(project);
    assert.equal(panel.selectWork(work), true);
    panel.setMode('work');
    assert.deepEqual(panel.layout('chat-1'), { version: 2, workspace: project, panelMode: 'work',
        chatId: 'chat-1', work });
    panel.setMode('chat');
    assert.equal(panel.layout('chat-1').chatId, 'chat-1');
    assert.deepEqual(panel.work, work);
    assert.ok(changed > 0);
});

test('same Work focuses its owner; distinct Work selections coexist and release on close', () => {
    const owners = new WorkOpenOwners();
    let focused = 0;
    const first = new SharedPanelState(owners, 'panel-a', () => focused++, () => {});
    const second = new SharedPanelState(owners, 'panel-b', () => {}, () => {});
    first.attach(project); second.attach(project);
    assert.equal(first.selectWork(work), true);
    assert.equal(second.selectWork(work), false);
    assert.equal(focused, 1);
    assert.equal(second.selectWork(other), true);
    assert.equal(second.mode, 'work');
    assert.deepEqual(first.work, work);
    second.selectWork(undefined);
    first.dispose();
    assert.equal(second.selectWork(work), true);
});

test('legacy Chat-only layout migrates and Work restoration resolves duplicate panels by stable ID', () => {
    const legacy = readSharedPanelLayout({ version: 1, workspace: project, mode: 'chat', chatId: 'chat-1' });
    assert.deepEqual(legacy, { version: 2, workspace: project, panelMode: 'chat', chatId: 'chat-1' });
    assert.equal(readSharedPanelLayout({ version: 1, workspace: project, mode: 'chat' }), undefined);
    const layout = readSharedPanelLayout({ version: 2, workspace: project, panelMode: 'work',
        chatId: 'chat-1', work });
    assert.ok(layout);
    const owners = new WorkOpenOwners();
    const later = new SharedPanelState(owners, 'panel-z', () => {}, () => {});
    const earlier = new SharedPanelState(owners, 'panel-a', () => {}, () => {});
    later.restore(layout); earlier.restore(layout);
    later.attach(project); earlier.attach(project);
    assert.equal(later.work, undefined);
    assert.deepEqual(earlier.work, work);
    assert.equal(earlier.layout('chat-1').chatId, 'chat-1');
    later.dispose(); earlier.dispose();
});

test('project switch and close release presentation only, ignore stale restored project', async () => {
    const owners = new WorkOpenOwners();
    const first = new SharedPanelState(owners, 'panel-a', () => {}, () => {});
    const next = new SharedPanelState(owners, 'panel-b', () => {}, () => {});
    first.attach(project);
    first.selectWork(work);
    first.attach(undefined);
    first.attach('file:///projects/other');
    next.attach(project);
    assert.equal(next.selectWork(work), true);
    first.restore({ version: 2, workspace: project, panelMode: 'work', work: other });
    assert.equal(first.work, undefined);
    assert.equal(first.mode, 'work');
    const pending = new SharedPanelState(owners, 'panel-c', () => {}, () => {});
    pending.restore({ version: 2, workspace: project, panelMode: 'work', work: other });
    pending.attach('file:///projects/other');
    assert.equal(pending.mode, 'chat');
    assert.equal(pending.work, undefined);
    first.dispose(); next.dispose();
    pending.dispose();
    const source = await readFile(new URL('../../packages/theia-extension/src/browser/shared-panel-state.ts', import.meta.url), 'utf8');
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /AgentRuntime|\.stop\(/);
    assert.doesNotMatch(widget.slice(widget.indexOf('override dispose():')), /\.stop\(/);
});
