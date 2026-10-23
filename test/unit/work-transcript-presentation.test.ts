import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { WorkSelectionController, workManualGateReady, workRunOverview } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
import { agentTranscriptWidgetId, openAgentTranscript, restoreWorkScroll, workCommandLabel,
    workCommandOutput } from '../../packages/theia-extension/lib/browser/work-transcript-presentation.js';
import { ChatScrollFollow } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
import { renderUntrustedMessageHtml } from '../../packages/theia-extension/lib/browser/untrusted-message-markdown.js';
import type { AgentRuntimeService } from '../../packages/contracts/src/agent-runtime-service.ts';

test('command is compact and output is only claimed when recorded', () => {
    const command: any = { kind: 'command', command: 'npm test', commandTruncated: false,
        status: 'completed', exitCode: 0, durationMs: 42 };
    assert.equal(workCommandLabel(command), 'Command · npm test · completed · exit 0 · 42 ms');
    assert.equal(workCommandLabel({ ...command, command: '[redacted] -lc "node --test a.test.js && git status"' }),
        'Command · node --test a.test.js · completed · exit 0 · 42 ms');
    assert.equal(workCommandLabel({ ...command, command: "[redacted] -lc 'npm run check'" }),
        'Command · npm run check · completed · exit 0 · 42 ms');
    assert.match(workCommandLabel({ ...command, command: "[redacted] -lc 'find . -name '\"'\"'*.key'\"'\"'\nstatus'" }),
        /^Command · find \. -name /u);
    assert.match(workCommandLabel({ ...command, command: 'a'.repeat(100) }), /^Command · a{69}… · completed/u);
    assert.deepEqual(workCommandOutput(command), ['Output not recorded by adapter.']);
    assert.deepEqual(workCommandOutput({ ...command, cwd: '.', output: 'hello', outputTruncated: false }),
        ['cwd: .', 'output (combined):\nhello']);
    assert.deepEqual(workCommandOutput({ ...command, cwd: 'project', stdout: 'partial', stdoutTruncated: true,
        stderr: '', stderrTruncated: false }), ['cwd: project', 'stdout [truncated]:\npartial', 'stderr:\n']);
    assert.deepEqual(workCommandOutput({ ...command, stdout: 'out', stderr: 'err', output: 'legacy', outputTruncated: true }),
        ['stdout:\nout', 'stderr:\nerr', 'output (combined) [truncated]:\nlegacy']);
});

test('transcript Markdown keeps document structure, readable code labels and no image elements', () => {
    const html = renderUntrustedMessageHtml('# Heading\n\nParagraph one.\n\nParagraph two.\n\n- bullet\n\n1. step\n\n> quote\n\n| A | B |\n| - | - |\n| long | cell |\n\n`inline`\n\n```ts\n  const x = 1;\n```\n\n![remote](https://example.test/receiver)');
    for (const tag of ['h1', 'p', 'ul', 'ol', 'blockquote', 'table', 'code', 'pre'])
        assert.match(html, new RegExp(`<${tag}\\b`), tag);
    assert.match(html, /dope-message-code-language[^>]*>ts</);
    assert.match(html, /  const x = 1;/);
    assert.match(html, /\[Image omitted: remote\]/);
    assert.doesNotMatch(html, /<(?:img|script|picture|svg|video|audio)\b/i);
    assert.doesNotMatch(html, /<[^>]+\s(?:src|srcset|poster)=/i);
    const hostile = renderUntrustedMessageHtml('```ts"><img src="https://example.test/fence">\n\tconst safe = true;\n```\n\n![nested](https://example.test/pixel)\n\n<script src="https://example.test/script"></script>\n\n[unsafe](javascript:alert(1))');
    assert.doesNotMatch(hostile, /<(?:img|script|picture|svg|video|audio)\b/i);
    assert.doesNotMatch(hostile, /<[^>]+\s(?:src|srcset|poster)=/i);
    assert.match(hostile, /\[Image omitted: nested\]/);
    assert.doesNotMatch(hostile, /href="javascript:/i);
});

test('Work overview separates agent completion, required validation and candidate decision', () => {
    const task: any = { id: 'task', projectId: 'project', origin: { kind: 'work-item' },
        reviewPolicy: { kind: 'required' }, completion: { validation: [{ kind: 'command', label: 'check' }] } };
    const run: any = { id: 'run', taskId: 'task', projectId: 'project', status: 'completed',
        changedFiles: ['src/file.js'], validationResults: [], appliedFiles: [] };
    assert.deepEqual(workRunOverview(run, task), {
        state: 'Agent run completed; review and qualification remain separate',
        validation: 'Required validation has not passed',
        next: 'Inspect the transcript and validation before continuing.'
    });
    const accepted = { ...run, reviewDecision: { kind: 'accept' },
        candidateReview: { state: 'ready', candidateFingerprint: 'current' },
        appliedFiles: ['src/file.js'], validationResults: [{ owner: 'dope', kind: 'command', label: 'check', status: 'passed',
            candidateFingerprint: 'current' }] };
    assert.equal(workRunOverview(accepted, task).state, 'Candidate accepted; 1 file applied');
    assert.equal(workRunOverview(accepted, task).validation, 'Required validation passed');
    assert.equal(workRunOverview({ ...accepted, validationResults: [{ ...accepted.validationResults[0],
        candidateFingerprint: 'previous' }] } as any, task).validation, 'Required validation has not passed');
    assert.equal(workRunOverview({ ...accepted, validationResults: [{ owner: 'dope', kind: 'test', label: 'other',
        status: 'failed', candidateFingerprint: 'current' }] } as any, task).validation,
    'Required validation has not passed');
    const rejected = { ...accepted, reviewDecision: { kind: 'reject' }, appliedFiles: [] };
    assert.equal(workRunOverview(rejected, task).state, 'Candidate rejected; no changes applied');
});

test('blocked Prompt Stack cannot offer manual verification', () => {
    const sequence: any = { status: 'waiting-manual', currentEntryNumber: 2, stack: { entries: [
        { execution: 'agent-task' }, { execution: 'manual-gate' }] } };
    assert.equal(workManualGateReady(sequence), true);
    assert.equal(workManualGateReady({ ...sequence, status: 'blocked', blockedReason: 'worktree-drift' }), false);
    assert.equal(workManualGateReady({ ...sequence, currentEntryNumber: 1 }), false);
});

test('Work reads every saved page from the beginning, including truncation state', async () => {
    const cursors: number[] = [];
    const runtime = {
        async attach() { return { projectHandle: 'handle' }; },
        async listTaskStacks() { return []; }, async listSequences() { return []; },
        async listTasks() { return []; }, async listRuns() { return []; },
        async readRun() { return { id: 'run', taskId: 'task', status: 'completed' }; },
        async readTask() { return undefined; },
        async readSteering() { return undefined; }, async listActions() { return []; },
        async readMapImpact() { return undefined; },
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
    assert.equal(controller.message, '');
    assert.equal(controller.transcript.length, 31);
    assert.equal(controller.transcript[0].kind, 'message');
    assert.deepEqual(cursors, Array.from({ length: 31 }, (_, index) => index));
    assert.equal(controller.transcript.at(-1)?.kind, 'message');
    assert.equal((controller.transcript.at(-1) as { text: string }).text, 'message 31');
    assert.equal(controller.transcriptState, 'recorded');
    assert.equal(controller.transcriptIncomplete, true);
});

test('a late transcript page cannot repopulate a cleared Work selection', async () => {
    let began!: () => void;
    let finish!: (page: unknown) => void;
    const reading = new Promise<void>(resolve => { began = resolve; });
    const page = new Promise<unknown>(resolve => { finish = resolve; });
    const runtime = {
        async attach() { return { projectHandle: 'handle' }; },
        async listTaskStacks() { return []; }, async listSequences() { return []; },
        async listTasks() { return []; }, async listRuns() { return []; },
        async readRun() { return { id: 'run', taskId: 'task', status: 'completed' }; },
        async readTask() { return undefined; },
        async readSteering() { return undefined; }, async listActions() { return []; },
        async readMapImpact() { return undefined; },
        readTranscript() { began(); return page; }
    } as unknown as AgentRuntimeService;
    const controller = new WorkSelectionController(runtime, () => {});
    await controller.attach('file:///project');
    const selecting = controller.select({ kind: 'run', id: 'run' });
    await reading;
    await controller.select(undefined);
    finish({ state: 'recorded', entries: [{ kind: 'message', text: 'stale', sequence: 1 }],
        nextSequence: 1, hasMore: false, incomplete: false });
    await selecting;
    assert.equal(controller.selectedRun, undefined);
    assert.deepEqual(controller.transcript, []);
    assert.equal(controller.message, '');
});

test('Work keeps untrusted Markdown sanitized, commands collapsed and follow independent', async () => {
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/agent-transcript-widget.ts', import.meta.url), 'utf8');
    const markdown = await readFile(new URL('../../packages/theia-extension/src/browser/untrusted-message-markdown.ts', import.meta.url), 'utf8');
    const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
    assert.match(widget, /renderUntrustedMessageMarkdown\(this\.markdown, entry\.text\)/);
    assert.match(markdown, /messageMarkdown\.renderer\.rules\.image =/);
    assert.match(markdown, /DOMPurify\.sanitize\(renderUntrustedMessageHtml\(text\)/);
    assert.match(markdown, /safeChatLink\(link\.getAttribute\('href'\)!/);
    assert.match(widget, /transcript\.className = 'dope-chat-transcript dope-work-transcript'/);
    assert.match(widget, /article\.className = 'dope-chat-message dope-chat-message-assistant dope-work-message'/);
    assert.match(widget, /transcript\.append\(article\)/);
    assert.doesNotMatch(widget, /dope-chat-message-user|textContent = 'Assistant'/);
    assert.match(widget, /document\.createElement\('details'\); details\.className = 'dope-work-command'/);
    assert.match(widget, /details\.open = this\.expandedCommands\.has\(key\)/);
    assert.match(widget, /summary\.textContent = workCommandLabel\(entry\)/);
    assert.match(widget, /fullCommand\.textContent = `command/);
    assert.match(widget, /entry\.completedSequence === undefined \? ' · finish not recorded'/);
    assert.match(widget, /this\.expandedCommands\.add\(key\)/);
    assert.match(widget, /this\.content\.replaceChildren\(\);\s*this\.entries = \[\]/);
    assert.match(widget, /transcript\.append\(details\)/);
    assert.doesNotMatch(widget, /entries\.sort\(/);
    assert.match(widget, /cursor = page\.nextSequence/);
    assert.match(widget, /let cursor = 0/);
    assert.match(widget, /Transcript not recorded for this historical run/);
    assert.match(css, /\.dope-chat-panel \.dope-chat-message-content ul \{[^}]*list-style: disc outside/);
    assert.match(css, /\.dope-chat-panel \.dope-chat-message-content ol \{[^}]*list-style: decimal outside/);
    assert.match(css, /\.dope-work-transcript \{[^}]*width: 100%/);
    assert.match(css, /\.dope-agent-transcript-panel \.dope-work-transcript \{[^}]*max-width: 78ch/);
    assert.match(css, /\.dope-chat-message-content \.dope-message-code pre \{[^}]*white-space: pre; overflow: auto/);
    assert.match(css, /\.dope-agent-transcript-panel \.dope-work-command pre \{[^}]*max-height: 18rem;[^}]*white-space: pre/);
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
    follow.scrolled(250, 1800, 200);
    assert.equal(restoreWorkScroll(follow, 250, 2200, 200, false), 250);
    assert.equal(follow.latestBelow, true);
    follow.select('run:two');
    assert.equal(restoreWorkScroll(follow, 1200, 1200, 200, true), 0);
});

test('explicit center transcript action reuses one tab for the same project and run', async () => {
    const options = { project: 'file:///project', runId: 'saved-run' };
    const widgets = new Map<string, { id: string; isAttached: boolean }>();
    let added = 0;
    const activated: string[] = [];
    const create = async (input: typeof options) => {
        const id = agentTranscriptWidgetId(input);
        if (!widgets.has(id)) widgets.set(id, { id, isAttached: false });
        return widgets.get(id)!;
    };
    const shell = { async addWidget(widget: { id: string; isAttached: boolean }, location: { area: 'main' }) {
        assert.equal(location.area, 'main'); added++; widget.isAttached = true;
    }, async activateWidget(id: string) { activated.push(id); } };
    await openAgentTranscript(options, create, shell);
    await openAgentTranscript(options, create, shell);
    const otherRun = { ...options, runId: 'different-run' };
    await openAgentTranscript(otherRun, create, shell);
    assert.equal(widgets.size, 2);
    assert.equal(added, 2);
    assert.deepEqual(activated, [agentTranscriptWidgetId(options), agentTranscriptWidgetId(options),
        agentTranscriptWidgetId(otherRun)]);
    assert.notEqual(agentTranscriptWidgetId({ ...options, project: 'file:///other' }), agentTranscriptWidgetId(options));
});
