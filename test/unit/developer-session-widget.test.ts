import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { visibleSessions, sessionListState, sessionOverview, revealSessionWidget } =
    require('../../packages/theia-extension/lib/browser/developer-session-presentation.js');
const fixture = (id: string, title: string) => ({ id, title, status: 'paused',
    updatedAt: '2026-10-11T12:00:00Z', objective: '<script>objective</script>', notes: '<img src=x>',
    nextActions: ['<b>action</b>'], links: [{ kind: 'chat', chatId: id }] });

test('selector filters current snapshot and reports loading, empty, filter and error states', () => {
    const records = [fixture('a', 'Fix Parser'), fixture('b', 'Map review')];
    assert.deepEqual(visibleSessions(records, '  PARSER ').map((item: any) => item.id), ['a']);
    assert.equal(sessionListState({ loading: true, error: '' }, []), 'Loading Development Sessions…');
    assert.equal(sessionListState({ loading: false, error: '', snapshot: { sessions: [] } }, []),
        'No sessions in this project yet.');
    assert.equal(sessionListState({ loading: false, error: '', snapshot: { sessions: records } }, []),
        'No sessions match this filter.');
    assert.equal(sessionListState({ loading: false, error: 'Read failed', snapshot: { sessions: records } }, records),
        'Read failed');
    assert.match(sessionListState({ loading: false, error: '' }, []), /Open one local project/);
});

test('overview preserves owner metadata as plain text values; widget uses textContent only', () => {
    const overview = sessionOverview(fixture('a', '<script>session</script>'));
    assert.equal(overview.title, '<script>session</script>');
    assert.equal(overview.objective, '<script>objective</script>');
    assert.equal(overview.notes, '<img src=x>');
    assert.deepEqual(overview.nextActions, ['<b>action</b>']);
    assert.equal(overview.status, 'paused');
    assert.equal(overview.links, 1);
    const widget = readFileSync(new URL('../../packages/theia-extension/src/browser/developer-session-widget.ts', import.meta.url), 'utf8');
    assert.match(widget, /node\.textContent = text/);
    assert.doesNotMatch(widget, /innerHTML|insertAdjacentHTML|dangerouslySetInnerHTML/);
});

test('repeat activation reveals one stable center widget and focuses it again', async () => {
    const widget = { id: 'dope-developer-sessions', isAttached: false };
    const calls: string[] = [];
    const get = async () => { calls.push('get'); return widget; };
    const add = async (item: typeof widget) => { calls.push('add'); item.isAttached = true; };
    const activate = async (id: string) => { calls.push(`activate:${id}`); };
    assert.equal(await revealSessionWidget(get, add, activate), widget);
    assert.equal(await revealSessionWidget(get, add, activate), widget);
    assert.deepEqual(calls, ['get', 'add', `activate:${widget.id}`, 'get', `activate:${widget.id}`]);
});

test('Theia registration wires the left launcher, center factory and palette command once', () => {
    const module = readFileSync(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
    assert.match(module, /defaultWidgetOptions: \{ area: 'left', rank: 252 \}/);
    assert.match(module, /id: DEVELOPER_SESSION_ID, createWidget:/);
    assert.match(module, /id: DEVELOPER_SESSION_LAUNCHER_ID, createWidget:/);
    assert.equal((module.match(/id: 'dope\.sessions\.open'/g) ?? []).length, 1);
    assert.match(module, /revealSessionWidget\(\(\) => manager\.getOrCreateWidget<DeveloperSessionWidget>\(DEVELOPER_SESSION_ID\)/);
});
