import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { WorkSelectionController } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
import { agentTranscriptWidgetId, openAgentTranscript, restoreWorkScroll, workCommandLabel,
    workCommandOutput } from '../../packages/theia-extension/lib/browser/work-transcript-presentation.js';
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
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/agent-transcript-widget.ts', import.meta.url), 'utf8');
    const markdown = await readFile(new URL('../../packages/theia-extension/src/browser/untrusted-message-markdown.ts', import.meta.url), 'utf8');
    const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
    assert.match(widget, /renderUntrustedMessageMarkdown\(this\.markdown, entry\.text\)/);
    assert.match(markdown, /new MarkdownStringImpl\(text,\s*\{ supportHtml: false, isTrusted: false \}\)/);
    assert.match(markdown, /safeChatLink\(link\.getAttribute\('href'\)!/);
    assert.match(widget, /transcript\.className = 'dope-chat-transcript dope-work-transcript'/);
    assert.match(widget, /article\.className = 'dope-chat-message dope-chat-message-assistant dope-work-message'/);
    assert.match(widget, /transcript\.append\(article\)/);
    assert.doesNotMatch(widget, /dope-chat-message-user|textContent = 'Assistant'/);
    assert.match(widget, /document\.createElement\('details'\); details\.className = 'dope-work-command'/);
    assert.doesNotMatch(widget, /details\.open\s*=/);
    assert.match(widget, /summary\.textContent = workCommandLabel\(entry\)/);
    assert.match(widget, /transcript\.append\(details\)/);
    assert.match(widget, /cursor = page\.nextSequence/);
    assert.match(widget, /let cursor = 0/);
    assert.match(widget, /Transcript not recorded for this historical run/);
    assert.match(css, /\.dope-chat-panel \.dope-chat-message-content ul \{[^}]*list-style: disc outside/);
    assert.match(css, /\.dope-chat-panel \.dope-chat-message-content ol \{[^}]*list-style: decimal outside/);
    assert.match(css, /\.dope-work-transcript \{[^}]*width: 100%/);
    assert.match(css, /\.dope-chat-message-content pre \{[^}]*max-width: 100%; overflow: auto/);
    assert.match(css, /\.dope-chat-message-content table \{[^}]*max-width: 100%; overflow: auto/);
    assert.match(widget, /private readonly follow = new ChatScrollFollow\(\)/);
    assert.match(widget, /this\.follow\.scrolled\(scroll\.scrollTop, scroll\.scrollHeight, scroll\.clientHeight\)/);
    assert.match(widget, /this\.follow\.jump\(\)/);
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

test('explicit center transcript action reuses one tab for the same project and run', async () => {
    const options = { project: 'file:///project', runId: 'saved-run' };
    const widgets = new Map<string, { id: string; isAttached: boolean }>();
    let added = 0, activated = 0;
    const create = async (input: typeof options) => {
        const id = agentTranscriptWidgetId(input);
        if (!widgets.has(id)) widgets.set(id, { id, isAttached: false });
        return widgets.get(id)!;
    };
    const shell = { async addWidget(widget: { id: string; isAttached: boolean }, location: { area: 'main' }) {
        assert.equal(location.area, 'main'); added++; widget.isAttached = true;
    }, async activateWidget(id: string) { assert.equal(id, agentTranscriptWidgetId(options)); activated++; } };
    await openAgentTranscript(options, create, shell);
    await openAgentTranscript(options, create, shell);
    assert.equal(widgets.size, 1);
    assert.equal(added, 1);
    assert.equal(activated, 2);
    assert.notEqual(agentTranscriptWidgetId({ ...options, project: 'file:///other' }), agentTranscriptWidgetId(options));
});
