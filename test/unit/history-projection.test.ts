import assert from 'node:assert/strict';
import test from 'node:test';
import { projectHistory, proposeHistoryContinuation, type HistoryEntry } from
    '../../packages/contracts/lib/history.js';

const project = { projectId: 'a', projectRoot: '/projects/a' };
const other = { projectId: 'b', projectRoot: '/projects/b' };
const at = '2026-10-12T12:00:00.000Z';
const entry = (sourceId: string, changes: Partial<HistoryEntry> = {}): HistoryEntry => ({
    ...project, sourceId, source: 'chat', owner: { kind: 'chat', chatId: sourceId },
    title: sourceId, status: { kind: 'owner', label: 'updated' }, availability: 'available',
    kind: 'event', occurredAt: at, observedAt: null, ...changes
});

test('History sorts, deduplicates by source ID, caps, and isolates both project identity and root', () => {
    const newer = entry('new', { occurredAt: '2026-10-12T13:00:00.000Z' });
    const older = entry('old', { occurredAt: '2026-10-12T11:00:00.000Z' });
    const foreign = entry('foreign', { ...other, occurredAt: '2026-10-12T14:00:00.000Z' });
    const moved = entry('moved', { projectRoot: '/projects/moved' });
    const input = [older, foreign, moved, newer, newer, entry('unknown', { occurredAt: null })];
    assert.deepEqual(projectHistory(input, project).map(item => item.sourceId), ['new', 'old', 'unknown']);
    assert.deepEqual(projectHistory([...input].reverse(), project, 2).map(item => item.sourceId), ['new', 'old']);
    assert.deepEqual(projectHistory(input, project, 0), []);
    assert.deepEqual(projectHistory(input, other).map(item => item.sourceId), ['foreign']);
    assert.equal(projectHistory(Array.from({ length: 60 }, (_, i) => entry(`id-${i}`)), project, 500).length, 50);
    assert.equal(projectHistory([entry('long', { title: 'x'.repeat(500) })], project)[0].title.length, 120);
});

test('unknown owner time stays unknown; dirty Git is only an observed snapshot', () => {
    const dirty = entry('working-tree', { source: 'git', owner: { kind: 'git-dirty' },
        title: 'Working tree has changes', kind: 'snapshot', occurredAt: null, observedAt: at });
    const unknown = entry('mind', { source: 'project-mind', occurredAt: null, observedAt: null });
    assert.deepEqual(projectHistory([unknown, dirty], project), [dirty, unknown]);
    assert.equal(dirty.occurredAt, null);
    assert.equal(projectHistory([dirty], project)[0].observedAt, at);
});

test('WorkItem and AgentRun status and validation/promotion remain independent owner facts', () => {
    const work = entry('work-1', { source: 'planning', owner: { kind: 'work-item', mapId: 'map-1',
        workItemId: 'work-1' }, status: { kind: 'work-item', state: 'ready' } });
    const run = entry('run-1', { source: 'agent', owner: { kind: 'agent-run', runId: 'run-1' },
        status: { kind: 'agent-run', state: 'completed', validation: 'passed', promotion: 'applied' } });
    const pending = entry('run-2', { source: 'agent', owner: { kind: 'agent-run', runId: 'run-2' },
        status: { kind: 'agent-run', state: 'blocked', validation: 'passed', promotion: 'not-applied' } });
    assert.deepEqual(projectHistory([work, run, pending], project).find(item => item.sourceId === 'work-1')?.status,
        { kind: 'work-item', state: 'ready' });
    assert.equal(pending.status.kind === 'agent-run' && pending.status.promotion, 'not-applied');
    assert.equal(run.status.kind === 'agent-run' && run.status.promotion, 'applied');
});

test('continuation distinguishes verified focus from recent suggestion and never crosses roots', () => {
    const chat = entry('chat-1');
    const dirty = entry('working-tree', { source: 'git', owner: { kind: 'git-dirty' },
        kind: 'snapshot', occurredAt: null, observedAt: '2026-10-12T14:00:00.000Z' });
    const focus = { ...project, owner: { kind: 'chat' as const, chatId: 'chat-1' }, observedAt: at,
        availability: 'available' as const, verified: true as const };
    assert.deepEqual(proposeHistoryContinuation(project, [chat, dirty], focus),
        { kind: 'verified-focus', owner: focus.owner, observedAt: at });
    assert.deepEqual(proposeHistoryContinuation(project, [chat, dirty]),
        { kind: 'recent-activity-suggestion', owner: chat.owner, sourceId: 'chat-1', title: 'chat-1' });
    assert.deepEqual(proposeHistoryContinuation(other, [chat, dirty], focus), { kind: 'none' });
    assert.deepEqual(proposeHistoryContinuation(project, [dirty]), { kind: 'none' });
});
