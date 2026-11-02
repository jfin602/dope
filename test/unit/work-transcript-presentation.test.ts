import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { WorkSelectionController, workManualGateReady, workRunOverview } from '../../packages/theia-extension/lib/browser/work-selection-controller.js';
import { agentTranscriptWidgetId, openAgentTranscript, restoreWorkScroll, workCommandLabel,
    workCommandOutput, workToolLabel, workToolDetails, workToolStatus } from '../../packages/theia-extension/lib/browser/work-transcript-presentation.js';
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
        async sequenceEvidence() { return { head: 'fixture', packageVersion: '0.12.7', worktreeFingerprint: 'fixture' }; },
        async codingAgentReady() { return true; },
        async listTasks() { return []; }, async listRuns() { return []; },
        async readRun() { return { id: 'run', taskId: 'task', status: 'completed' }; },
        async readTask() { return { id: 'task', origin: { kind: 'direct' } }; },
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
        async sequenceEvidence() { return { head: 'fixture', packageVersion: '0.12.7', worktreeFingerprint: 'fixture' }; },
        async codingAgentReady() { return true; },
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

test('Work tool cards report recorded request, result and error fields without grant metadata', () => {
    const base: any = { kind: 'work', toolId: 'pi-1', toolName: 'read_file' };
    const events = [
        { ...base, phase: 'requested', detail: '{"fields":["path","offset"],"argumentType":"object"}' },
        { ...base, phase: 'validating', detail: '{"path":"src/main.ts","offset":100,"maxBytes":512,"sourceIdentitySupplied":true}' },
        { ...base, phase: 'completed', detail: '{"endOffset":612,"nextOffset":612,"outputBytes":512,"grantRevision":4}',
            stage: 'broker-execute', brokerInvoked: true, effectExecuted: false }
    ];
    assert.equal(workToolLabel(events[2], events), 'read_file · src/main.ts · Completed');
    const details = workToolDetails(events);
    assert.deepEqual(details.slice(0, 2), ['Request', 'fields: path, offset']);
    assert.ok(details.includes('sourceIdentitySupplied: true'));
    assert.ok(details.includes('Result'));
    assert.ok(details.includes('nextOffset: 612'));
    assert.ok(details.includes('Broker invoked: yes'));
    assert.doesNotMatch(details.join('\n'), /grantRevision/u);
    assert.equal(workToolStatus('recoverable'), 'Invalid arguments');
    assert.equal(workToolStatus('denied'), 'Authority denied');
    assert.equal(workToolStatus('cancelled'), 'Cancelled');
    assert.deepEqual(workToolDetails([{ ...base, phase: 'recoverable', code: 'INVALID_ARGUMENTS' }]),
        ['Request', 'Metadata unavailable.', 'Execution', 'Lifecycle: Invalid arguments',
            'Result', 'Metadata unavailable.', 'Code: INVALID_ARGUMENTS']);
});

test('Work widget uses safe Markdown, correlated cards, incremental reads and clean final separation', async () => {
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/agent-transcript-widget.ts', import.meta.url), 'utf8');
    const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
    assert.match(widget, /new ReasoningRevealBuffer\('paragraphs'\)/u);
    assert.match(widget, /this\.tools\.get\(entry\.toolId\)/u);
    assert.match(widget, /readTranscript\(this\.handle, run\.id, cursor, 100\)/u);
    assert.match(widget, /entry\.kind === 'message'/u);
    assert.match(widget, /heading\.textContent = 'Final result'/u);
    assert.match(widget, /renderUntrustedMessageMarkdown\(this\.markdown, entry\.text\)/u);
    assert.match(widget, /this\.follow\.jump\(\)/u);
    assert.match(css, /prefers-reduced-motion: reduce/u);
    const follow = new ChatScrollFollow();
    follow.select('run:one');
    assert.equal(restoreWorkScroll(follow, 0, 1000, 200, true), 0);
    follow.scrolled(250, 1800, 200);
    assert.equal(restoreWorkScroll(follow, 250, 2200, 200, false), 250);
    assert.equal(follow.latestBelow, true);
    follow.jump();
    assert.equal(restoreWorkScroll(follow, 250, 2200, 200, false), 2200);
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
