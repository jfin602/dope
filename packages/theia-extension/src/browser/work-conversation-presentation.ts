import type { AgentRun, AgentRunEvent, AgentSteeringState, AgentTask, AgentTranscriptEntry, WorkSession } from '@dope/agent-core';
import type { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import { renderUntrustedMessageMarkdown } from './untrusted-message-markdown';
import { workCommandLabel, workCommandOutput, workToolCall, workToolFeedback, workToolLabel,
    type WorkToolEntry } from './work-transcript-presentation';
import { formatRunElapsedCompact } from './run-elapsed';
import { copyChatText } from './chat-copy-text';

export function workSegmentReviewEnabled(text: string, busy: boolean, reviewOpen: boolean,
    targetsBusy: boolean, targetSelected: boolean): boolean {
    return !!text.trim() && !busy && (!reviewOpen || !targetsBusy && targetSelected);
}

/** Legacy segments may display their linked run mode; they never acquire a synthetic saved mode. */
export function lockedWorkMode(run: AgentRun, segment: WorkSession['segments'][number] | undefined,
    task?: AgentTask): { mode?: 'direct' | 'isolated'; description: string } {
    if (!segment || segment.runId !== run.id || segment.taskId !== run.taskId ||
        !run.executionMode || segment.executionMode && segment.executionMode !== run.executionMode ||
        task && (task.id !== run.taskId || task.executionMode && task.executionMode !== run.executionMode))
        return { description: 'Execution mode unavailable: saved run, task, and segment evidence is missing or inconsistent.' };
    return run.executionMode === 'direct' ?
        { mode: 'direct', description: 'Direct Work · brokered edits apply to the open project immediately; review and safe revert are available.' } :
        { mode: 'isolated', description: 'Isolated Work · edits remain in a separate candidate until reviewed and accepted.' };
}

export function workConversationTimeline(entries: readonly AgentTranscriptEntry[],
    session?: WorkSession, events: readonly AgentRunEvent[] = [], steering?: AgentSteeringState): Array<
        { at: string; entry: AgentTranscriptEntry } | { at: string; message: WorkSession['messages'][number] } |
        { at: string; event: AgentRunEvent } | { at: string; steering: AgentSteeringState['entries'][number] }> {
    return [
        ...entries.map(entry => ({ at: entry.at, entry })),
        ...(session?.messages ?? []).map(message => ({ at: message.queuedAt, message })),
        ...events.map(event => ({ at: event.at, event })),
        ...(steering?.entries ?? []).map(entry => ({ at: entry.requestedAt, steering: entry }))
    ].sort((a, b) => a.at.localeCompare(b.at));
}

/** Render Work conversation evidence, including a just-submitted prompt awaiting its run. */
export function renderWorkConversation(markdown: MarkdownRenderer, entries: readonly AgentTranscriptEntry[],
    session?: WorkSession, initialPrompt?: string, steering?: AgentSteeringState,
    runs: readonly AgentRun[] = [], selectedRun?: AgentRun): HTMLElement {
    const root = document.createElement('section');
    root.className = 'dope-work-transcript dope-chat-transcript';
    root.setAttribute('aria-label', 'Saved Work conversation');
    const note = (text: string, parent: HTMLElement = root) => {
        const element = document.createElement('p');
        element.className = 'dope-work-system';
        element.textContent = text;
        parent.append(element);
    };
    const time = (at?: string): HTMLTimeElement | undefined => {
        if (!at || !Number.isFinite(Date.parse(at))) return undefined;
        const value = document.createElement('time');
        value.dateTime = at;
        value.textContent = new Date(at).toLocaleString();
        return value;
    };
    const userMessage = (text: string, label: string, at?: string, delivery?: string): void => {
        const article = document.createElement('article');
        article.className = 'dope-chat-message dope-chat-message-user dope-work-message-user';
        article.setAttribute('aria-label', label);
        const body = document.createElement('div'); body.className = 'dope-chat-message-content';
        body.textContent = text;
        article.append(body);
        const timestamp = time(at);
        if (timestamp || delivery) {
            const meta = document.createElement('small'); meta.className = 'dope-chat-message-meta';
            if (delivery) { const status = document.createElement('span'); status.textContent = delivery; meta.append(status); }
            if (timestamp) meta.append(timestamp);
            article.append(meta);
        }
        root.append(article);
    };
    const answerMessage = (text: string, at?: string, run?: AgentRun, truncated = false,
        systemGenerated = false): void => {
        const article = document.createElement('article');
        article.className = 'dope-chat-message dope-chat-message-assistant dope-work-message dope-work-final-answer';
        if (systemGenerated) article.classList.add('dope-chat-message-alert', 'dope-work-system-answer');
        article.setAttribute('aria-label', 'Coding Agent');
        const body = document.createElement('div');
        body.className = 'dope-chat-message-content dope-chat-final-answer';
        body.append(renderUntrustedMessageMarkdown(markdown, text));
        article.append(body);
        if (truncated) note('Saved text was truncated.', article);
        const info = document.createElement('div'); info.className = 'dope-chat-response-info'; info.hidden = true;
        info.id = `dope-work-response-info-${root.querySelectorAll('.dope-chat-response-info').length}`;
        const status = document.createElement('div');
        status.textContent = `Status: ${run?.status ?? 'saved'}${run?.outcome ? ` · ${run.outcome.summary}` : ''}`;
        info.append(status);
        const footer = document.createElement('div'); footer.className = 'dope-chat-response-footer';
        const actions = document.createElement('div'); actions.className = 'dope-chat-response-actions';
        const copy = document.createElement('button'); copy.type = 'button';
        copy.className = 'dope-chat-copy-response'; copy.setAttribute('aria-label', 'Copy Response');
        copy.title = 'Copy Response';
        const copyIcon = document.createElement('span'); copyIcon.className = 'codicon codicon-copy';
        copyIcon.setAttribute('aria-hidden', 'true'); copy.append(copyIcon);
        copy.onclick = () => void copyChatText(text).then(() => {
            copyIcon.className = 'codicon codicon-check'; copy.title = 'Copied';
            setTimeout(() => { copyIcon.className = 'codicon codicon-copy'; copy.title = 'Copy Response'; }, 2000);
        }, () => { copy.title = 'Copy failed'; });
        const infoButton = document.createElement('button'); infoButton.type = 'button';
        infoButton.className = 'dope-chat-response-info-button';
        infoButton.setAttribute('aria-label', 'Show response info'); infoButton.setAttribute('aria-expanded', 'false');
        infoButton.setAttribute('aria-controls', info.id);
        infoButton.title = 'Show response info';
        const infoIcon = document.createElement('span'); infoIcon.className = 'codicon codicon-info';
        infoIcon.setAttribute('aria-hidden', 'true'); infoButton.append(infoIcon);
        infoButton.onclick = () => {
            info.hidden = !info.hidden;
            infoButton.setAttribute('aria-expanded', String(!info.hidden));
            infoButton.setAttribute('aria-label', info.hidden ? 'Show response info' : 'Hide response info');
            infoButton.title = info.hidden ? 'Show response info' : 'Hide response info';
        };
        actions.append(copy, infoButton); footer.append(actions);
        const timestamp = time(at);
        if (timestamp) footer.append(timestamp);
        article.append(info, footer); root.append(article);
    };
    const segments = session?.segments ?? [];
    const initialSegment = segments[0];
    const initialRun = selectedRun ?? runs.find(run => run.id === (initialSegment?.runId ?? entries[0]?.runId)) ??
        (runs.length === 1 ? runs[0] : undefined);
    const firstPrompt = initialPrompt ?? initialSegment?.prompt;
    if (firstPrompt?.trim()) userMessage(firstPrompt, 'Work request',
        initialSegment?.startedAt ?? initialRun?.createdAt);
    const tools = new Map<string, { history: WorkToolEntry[]; node: HTMLDetailsElement; summary: HTMLElement;
        call: HTMLElement; feedback: HTMLElement }>();
    let reasoningGroup: { runId: string; body: HTMLElement } | undefined;
    let previousRunId = initialSegment?.runId ?? entries[0]?.runId ?? initialRun?.id;
    const activities = new Map<string, HTMLElement>();
    const answeredRuns = new Set<string>();
    const finishedRuns = new Set<string>();
    const activityFor = (runId: string): HTMLElement => {
        const existing = activities.get(runId);
        if (existing) return existing;
        const run = runs.find(value => value.id === runId);
        const disclosure = document.createElement('details');
        disclosure.className = 'dope-chat-stream-activity dope-work-run-activity';
        disclosure.open = true;
        const summary = document.createElement('summary');
        const label = document.createElement('span');
        label.textContent = `${run?.status === 'failed' ? 'Error' :
            run?.status === 'completed' ? 'Finished' : run?.status === 'interrupted' ? 'Error' :
                run?.status === 'cancelled' ? 'Canceled' : run?.status === 'running' ? 'Working...' :
                    run?.status ?? 'Saved activity'} `;
        summary.append(label);
        if (run?.startedAt) {
            const clock = document.createElement('span');
            clock.className = 'dope-elapsed-time';
            clock.dataset.startedAt = run.startedAt;
            clock.dataset.compact = 'true';
            if (run.status === 'running') clock.dataset.running = 'true';
            clock.textContent = formatRunElapsedCompact(run.startedAt,
                run.endedAt ? Date.parse(run.endedAt) : Date.now()) ?? '0s';
            summary.append(clock);
        }
        const body = document.createElement('div'); body.className = 'dope-work-run-activity-body';
        disclosure.append(summary, body); root.append(disclosure);
        activities.set(runId, body);
        return body;
    };
    const finishRun = (runId?: string): void => {
        if (!runId || finishedRuns.has(runId)) return;
        finishedRuns.add(runId);
        const run = runs.find(value => value.id === runId);
        activityFor(runId);
        if (run && run.status !== 'running' && (!answeredRuns.has(runId) ||
            ['cancelled', 'interrupted'].includes(run.status))) {
            const fallback = run.status === 'failed' ? `Agent run failed${run.outcome?.summary ? `: ${run.outcome.summary}` : '.'}` :
                run.status === 'completed' ? run.outcome?.summary ?? 'Work finished.' :
                    run.status === 'cancelled' ? 'Work canceled.' : run.status === 'interrupted' ?
                        'Work interrupted.' : run.status === 'blocked' ? 'Work blocked.' : `Work ended: ${run.status}.`;
            answerMessage(fallback, run.endedAt, run, false, true);
        }
    };
    const timeline = workConversationTimeline(entries, session, [], steering);
    for (const item of timeline) {
        if ('event' in item) continue;
        if ('steering' in item) {
            reasoningGroup = undefined;
            userMessage(item.steering.request.text, 'Your steering request', item.steering.requestedAt,
                `Steering · ${item.steering.acknowledgement.status}`);
            continue;
        }
        if ('message' in item) {
            reasoningGroup = undefined;
            const delivery = item.message.status === 'delivered' ? 'Delivered' :
                item.message.status === 'abandoned' ? 'Not delivered · recovery required' :
                item.message.status === 'delivering' ? session?.status === 'recovery-required' ?
                    'Delivery unconfirmed · recovery required' : 'Delivering · acknowledgment pending' : 'Queued';
            userMessage(item.message.text, 'Your Work message', item.message.queuedAt, delivery);
            continue;
        }
        const entry = item.entry;
        if (session && entry.runId !== previousRunId) {
            const previousIndex = segments.findIndex(value => value.runId === previousRunId);
            const nextIndex = segments.findIndex(value => value.runId === entry.runId);
            if (nextIndex > previousIndex) {
                for (const segment of segments.slice(previousIndex + 1, nextIndex + 1)) {
                    finishRun(previousRunId);
                    if (segment.prompt) userMessage(segment.prompt, 'New Work request', segment.startedAt);
                    previousRunId = segment.runId;
                }
            } else {
                finishRun(previousRunId);
                previousRunId = entry.runId;
            }
        }
        const activity = activityFor(entry.runId);
        if (entry.kind === 'reasoning') {
            if (!reasoningGroup || reasoningGroup.runId !== entry.runId) {
                const article = document.createElement('div');
                article.className = 'dope-work-reasoning';
                const body = document.createElement('div'); body.className = 'dope-chat-message-content dope-work-reasoning-body';
                article.append(body); activity.append(article);
                reasoningGroup = { runId: entry.runId, body };
            }
            reasoningGroup.body.append(renderUntrustedMessageMarkdown(markdown, entry.text));
            if (entry.truncated) note('Saved text was truncated.', reasoningGroup.body);
        } else if (entry.kind === 'message') {
            reasoningGroup = undefined;
            answeredRuns.add(entry.runId);
            answerMessage(entry.text, entry.at, runs.find(run => run.id === entry.runId), entry.truncated);
        } else if (entry.kind === 'work') {
            reasoningGroup = undefined;
            const toolKey = `${entry.runId}\u0000${entry.toolId}`;
            let tool = tools.get(toolKey);
            if (!tool) {
                const node = document.createElement('details');
                node.className = 'dope-work-tool dope-work-command';
                const summary = document.createElement('summary');
                const call = document.createElement('code'); call.className = 'dope-work-tool-call';
                const feedback = document.createElement('p'); feedback.className = 'dope-work-tool-feedback';
                node.append(summary, call, feedback); activity.append(node);
                tool = { history: [], node, summary, call, feedback };
                tools.set(toolKey, tool);
            }
            tool.history.push(entry);
            tool.node.dataset.status = entry.phase;
            const label = workToolLabel(entry, tool.history);
            tool.summary.textContent = `⚙ ${label}`;
            tool.summary.setAttribute('aria-label', `Tool ${label}`);
            tool.call.textContent = workToolCall(tool.history);
            tool.feedback.textContent = workToolFeedback(entry) ?? '';
            tool.feedback.hidden = !tool.feedback.textContent;
        } else if (entry.kind === 'command') {
            reasoningGroup = undefined;
            const command = document.createElement('div');
            command.className = `dope-work-command dope-work-command-${entry.status}`;
            const label = document.createElement('div'); label.className = 'dope-work-command-label';
            label.textContent = workCommandLabel(entry);
            command.append(label);
            const pre = document.createElement('pre');
            pre.textContent = entry.command;
            command.append(pre);
            for (const output of workCommandOutput(entry)) {
                const block = document.createElement('pre'); block.textContent = output; command.append(block);
            }
            activity.append(command);
        } else if (entry.code === 'transcript-incomplete' || entry.code === 'observation-omitted') {
            reasoningGroup = undefined;
            note(entry.code === 'transcript-incomplete' ? 'Transcript truncated: recording limit reached.' :
                'Some activity was omitted from the saved transcript.', activity);
        }
    }
    finishRun(previousRunId);
    if (session) {
        const lastIndex = segments.findIndex(value => value.runId === previousRunId);
        for (const segment of segments.slice(lastIndex + 1)) {
            if (segment.prompt) userMessage(segment.prompt, 'New Work request', segment.startedAt);
            finishRun(segment.runId);
        }
    }
    if (!timeline.length && (session || runs.length || selectedRun))
        note(session ? 'No transcript entries have been recorded yet.' :
            'Transcript not recorded for this historical run.');
    return root;
}
