import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { WorkSelectionController } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
import { restoreWorkScroll, workCommandLabel, workCommandOutput } from '../../packages/theia-extension/lib/browser/work-transcript-presentation.js';
import { ChatScrollFollow } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';

test('command is compact and output is only claimed when recorded', () => {
    const command: any = { kind: 'command', command: 'npm test', commandTruncated: false,
        status: 'completed', exitCode: 0, durationMs: 42 };
    assert.equal(workCommandLabel(command), 'npm test · completed · exit 0 · 42 ms');
    assert.deepEqual(workCommandOutput(command), ['Output not recorded by adapter.']);
    assert.deepEqual(workCommandOutput({ ...command, cwd: 'project', stdout: 'partial', stdoutTruncated: true,
        stderr: '', stderrTruncated: false }), ['cwd: project', 'stdout [truncated]:\npartial', 'stderr:\n']);
});

test('Work reads every saved page from the beginning, including truncation state', async () => {
    const cursors: number[] = [];
    const runtime = {
        async attach() { return { projectHandle: 'handle' }; },
        async listTaskStacks() { return []; }, async listSequences() { return []; },
        async listTasks() { return []; }, async listRuns() { return []; },
        async readRun() { return { id: 'run', taskId: 'task', status: 'completed' }; },
        async readTask() { return undefined; },
        async readTranscript(_handle: string, _runId: string, cursor: number) {
            cursors.push(cursor);
            return { state: 'recorded', entries: [{ kind: 'message', sequence: cursor + 1,
                text: `message ${cursor + 1}`, truncated: false }], nextSequence: cursor + 1,
                hasMore: cursor < 30, incomplete: cursor === 30 };
        }
    } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {});
    await controller.attach('file:///project');
    await controller.select({ kind: 'run', id: 'run' });
    assert.equal(controller.transcript.length, 31);
    assert.equal(controller.transcript[0].kind, 'message');
    assert.deepEqual([cursors[0], cursors.at(-1)], [0, 30]);
    assert.equal(controller.transcriptIncomplete, true);
});

test('Work keeps untrusted Markdown sanitized, commands collapsed and follow independent', async () => {
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/chat-panel-widget.ts', import.meta.url), 'utf8');
    assert.match(widget, /new MarkdownStringImpl\(entry\.text,\s*\{ supportHtml: false, isTrusted: false \}\)/);
    assert.match(widget, /safeChatLink\(link\.getAttribute\('href'\)!/);
    assert.match(widget, /document\.createElement\('details'\); item\.className = 'dope-work-command'/);
    assert.match(widget, /private readonly workFollow = new ChatScrollFollow\(\)/);
    assert.match(widget, /this\.workFollow\.scrolled\(scroll\.scrollTop, scroll\.scrollHeight, scroll\.clientHeight\)/);
    assert.match(widget, /this\.workFollow\.jump\(\)/);
    const follow = new ChatScrollFollow();
    follow.select('run:one');
    assert.equal(restoreWorkScroll(follow, 0, 1000, 200, true), 0);
    assert.equal(restoreWorkScroll(follow, 100, 1200, 200, false), 100);
    assert.equal(follow.latestBelow, true);
    follow.jump();
    assert.equal(restoreWorkScroll(follow, 100, 1200, 200, false), 1200);
    follow.select('run:two');
    assert.equal(restoreWorkScroll(follow, 1200, 1200, 200, true), 0);
});
