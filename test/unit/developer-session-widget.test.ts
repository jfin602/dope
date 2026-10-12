import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { visibleSessions, sessionListState, sessionOverview, sessionLinkGroups, revealSessionWidget } =
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

test('grouped resolution preserves all exact links and distinct WorkItem and AgentRun facts', () => {
    const work = { kind: 'work-item', mapId: 'map', workItemId: 'work' };
    const run = { kind: 'agent-run', taskId: 'task', runId: 'run' };
    const missing = { kind: 'chat', chatId: 'c433482f-9576-4402-af45-ef246414c9c0' };
    const stale = { kind: 'planning-map', mapId: 'old' };
    const unavailable = { kind: 'project-mind', artifactType: 'idea', artifactId: '5852ad1b-6ab5-4632-bb64-9cac4a9469f8' };
    const selected = { ...fixture('session', 'Session'), revision: 3,
        links: [work, run, missing, stale, unavailable] };
    const result = { sessionId: 'session', collectionRevision: 7, sessionRevision: 3, artifacts: [
        { ref: work, availability: 'resolved', diagnostic: 'Planning owner metadata', title: 'Fix math', status: 'ready' },
        { ref: run, availability: 'resolved', diagnostic: 'Agent run owner metadata', status: 'completed',
            validationStatus: 'passed', reviewDecision: 'accept', promotionStatus: 'applied' },
        { ref: missing, availability: 'missing', diagnostic: 'Chat is absent' },
        { ref: stale, availability: 'stale', diagnostic: 'Planning basis changed', status: 'active' },
        { ref: unavailable, availability: 'unavailable', diagnostic: 'Owner metadata unavailable' },
    ] };
    const groups = sessionLinkGroups(selected, 7, result);
    assert.deepEqual(groups.map((group: any) => group.kind),
        ['work-item', 'agent-run', 'chat', 'planning-map', 'project-mind']);
    assert.equal(groups[0].entries[0].resolution.status, 'ready');
    assert.equal(groups[0].entries[0].resolution.promotionStatus, undefined);
    assert.equal(groups[1].entries[0].resolution.status, 'completed');
    assert.equal(groups[1].entries[0].resolution.promotionStatus, 'applied');
    assert.deepEqual(groups.slice(2).map((group: any) => group.entries[0].resolution.availability),
        ['missing', 'stale', 'unavailable']);
    assert.equal(groups[3].entries[0].resolution.diagnostic, 'Planning basis changed');
    assert.equal(sessionLinkGroups(selected, 8, result)[0].entries[0].resolution, undefined);
    assert.equal(sessionLinkGroups(selected, 7, { ...result, sessionId: 'another' })[0].entries[0].resolution, undefined);
    assert.equal(sessionLinkGroups(selected, 7, { ...result, sessionRevision: 2 })[0].entries[0].resolution, undefined);
    assert.equal(sessionLinkGroups(selected, 7, { ...result, artifacts: [{ ...result.artifacts[0], ref: { ...work, workItemId: 'other' } }] })[0].entries[0].resolution, undefined);
});

test('linked owner text is rendered with textContent and resolution has no owner mutation path', () => {
    const widget = readFileSync(new URL('../../packages/theia-extension/src/browser/developer-session-widget.ts', import.meta.url), 'utf8');
    assert.match(widget, /node\.textContent = text/);
    assert.match(widget, /resolution\.diagnostic/);
    assert.match(widget, /resolution\.validationStatus/);
    assert.doesNotMatch(widget, /innerHTML|insertAdjacentHTML|dangerouslySetInnerHTML/);
    const presentation = readFileSync(new URL('../../packages/theia-extension/src/browser/developer-session-presentation.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(presentation, /\.mutate\(|\.attachLink\(|\.detachLink\(/);
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

test('center widget layout stores only the selected Session reference and exposes every owner navigation route', () => {
    const widget = readFileSync(new URL('../../packages/theia-extension/src/browser/developer-session-widget.ts', import.meta.url), 'utf8');
    assert.match(widget, /storeState\(\): object \{ return this\.controller\.layoutSelection\(\) \?\? \{\}; \}/);
    assert.match(widget, /restoreState\(state: object\): void \{ this\.controller\.restoreSelection\(state\); \}/);
    for (const kind of ['planning-map', 'work-item', 'project-mind'])
        assert.match(widget, new RegExp(`ref\\.kind === '${kind}'`));
    assert.match(widget, /open\.addEventListener\('click', \(\) => void this\.navigate\(ref\)\)/);
});
