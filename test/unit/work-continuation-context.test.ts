import assert from 'node:assert/strict';
import test from 'node:test';
import { AgentExecutionRuntime } from '../../packages/theia-extension/lib/node/agent-execution-runtime.js';

test('linked continuation uses only recorded turns and labels unavailable legacy evidence', async () => {
    const store: any = {
        async readTask() { return { objective: 'Accepted objective' }; },
        async readTranscript(_root: string, runId: string) { return runId === 'legacy' ?
            { state: 'not-recorded', entries: [], hasMore: false, incomplete: false } :
            { state: 'recorded', entries: [{ kind: 'message', at: '2026-11-24T00:00:02Z',
                text: 'Observed assistant reply' }], hasMore: false, incomplete: false }; }
    };
    const runtime: any = new AgentExecutionRuntime(store, {} as any, {} as any, new Map());
    const context = await runtime.workContinuationContext('/project', {
        segments: [{ runId: 'legacy', taskId: 'task', startedAt: '2026-11-24T00:00:00Z' },
            { runId: 'second', taskId: 'task', startedAt: '2026-11-24T00:00:01Z' }],
        messages: [{ id: 'delivered', text: 'Actual developer follow-up',
            queuedAt: '2026-11-24T00:00:03Z', status: 'delivered' },
            { id: 'pending', text: 'Do not claim this was delivered',
                queuedAt: '2026-11-24T00:00:04Z', status: 'queued' }]
    });
    assert.match(context, /incomplete turns are unavailable/);
    assert.match(context, /Observed assistant reply/);
    assert.match(context, /Actual developer follow-up/);
    assert.doesNotMatch(context, /Do not claim this was delivered/);
});
