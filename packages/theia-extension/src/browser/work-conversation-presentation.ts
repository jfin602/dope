import type { AgentRunEvent, AgentTranscriptEntry, WorkSession } from '@dope/agent-core';
import type { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import { renderUntrustedMessageMarkdown } from './untrusted-message-markdown';
import { workCommandLabel, workCommandOutput, workToolDetails, workToolLabel,
    type WorkToolEntry } from './work-transcript-presentation';

export function workConversationTimeline(entries: readonly AgentTranscriptEntry[],
    session?: WorkSession, events: readonly AgentRunEvent[] = []): Array<{ at: string; entry: AgentTranscriptEntry } |
        { at: string; message: WorkSession['messages'][number] } | { at: string; event: AgentRunEvent }> {
    return [
        ...entries.map(entry => ({ at: entry.at, entry })),
        ...(session?.messages ?? []).map(message => ({ at: message.queuedAt, message })),
        ...events.map(event => ({ at: event.at, event }))
    ].sort((a, b) => a.at.localeCompare(b.at));
}

/** Render only persisted Work evidence. All untrusted strings cross a text or safe-Markdown boundary. */
export function renderWorkConversation(markdown: MarkdownRenderer, entries: readonly AgentTranscriptEntry[],
    session?: WorkSession, events: readonly AgentRunEvent[] = []): HTMLElement {
    const root = document.createElement('section');
    root.className = 'dope-work-transcript';
    root.setAttribute('aria-label', 'Saved Work conversation');
    const note = (text: string, parent: HTMLElement = root) => {
        const element = document.createElement('p');
        element.className = 'dope-work-system';
        element.textContent = text;
        parent.append(element);
    };
    const tools = new Map<string, WorkToolEntry[]>();
    const timeline = workConversationTimeline(entries, session, events);
    for (const item of timeline) {
        if ('event' in item) {
            const event = document.createElement('p');
            event.className = `dope-work-system dope-work-event dope-work-event-${item.event.kind}`;
            event.textContent = `${item.event.kind === 'authority' ? 'Approval' :
                item.event.kind[0].toUpperCase() + item.event.kind.slice(1)} · ${item.event.summary}`;
            root.append(event);
            continue;
        }
        if ('message' in item) {
            const article = document.createElement('article');
            article.className = 'dope-chat-message dope-chat-message-user dope-work-queued-message';
            const body = document.createElement('p'); body.textContent = item.message.text;
            const status = document.createElement('small');
            status.textContent = item.message.status === 'delivered' ? 'Delivered' :
                item.message.status === 'abandoned' ? 'Not delivered · recovery required' :
                item.message.status === 'delivering' ? session?.status === 'recovery-required' ?
                    'Delivery unconfirmed · recovery required' : 'Delivering · acknowledgment pending' : 'Queued';
            status.textContent += ` · Message ID ${item.message.id}`;
            article.append(body, status); root.append(article);
            continue;
        }
        const entry = item.entry;
        if (entry.kind === 'message' || entry.kind === 'reasoning') {
            const article = document.createElement(entry.kind === 'reasoning' ? 'details' : 'article');
            article.className = entry.kind === 'reasoning' ? 'dope-work-reasoning' :
                'dope-chat-message dope-chat-message-assistant dope-work-message';
            if (entry.kind === 'reasoning') {
                const summary = document.createElement('summary');
                summary.textContent = 'Reasoning';
                article.append(summary);
            }
            const body = document.createElement('div');
            body.className = 'dope-chat-message-content';
            body.append(renderUntrustedMessageMarkdown(markdown, entry.text));
            article.append(body);
            if (entry.truncated) note('Saved text was truncated.', article);
            root.append(article);
        } else if (entry.kind === 'work') {
            const toolKey = `${entry.runId}\u0000${entry.toolId}`;
            const history = [...(tools.get(toolKey) ?? []), entry];
            tools.set(toolKey, history);
            const node = document.createElement('details');
            node.className = 'dope-work-tool dope-work-command';
            node.dataset.status = entry.phase;
            const summary = document.createElement('summary');
            const label = workToolLabel(entry, history);
            summary.textContent = `⚙ ${label}`;
            summary.setAttribute('aria-label', `Tool ${label}`);
            const body = document.createElement('div'); body.className = 'dope-work-tool-body';
            node.append(summary, body); root.append(node);
            for (const line of workToolDetails(history)) note(line, body);
        } else if (entry.kind === 'command') {
            const command = document.createElement('details');
            command.className = `dope-work-command dope-work-command-${entry.status}`;
            const summary = document.createElement('summary');
            summary.textContent = workCommandLabel(entry);
            command.append(summary);
            const pre = document.createElement('pre');
            pre.textContent = entry.command;
            command.append(pre);
            for (const output of workCommandOutput(entry)) {
                const block = document.createElement('pre'); block.textContent = output; command.append(block);
            }
            root.append(command);
        } else {
            note(entry.code === 'run-started' ? 'Run started.' :
                entry.code === 'run-ended' ? 'Run ended.' :
                entry.code === 'transcript-incomplete' ? 'Transcript truncated: recording limit reached.' :
                    'Some activity was omitted from the saved transcript.');
        }
    }
    if (!timeline.length) note(session ? 'No transcript entries have been recorded yet.' :
        'Transcript not recorded for this historical run.');
    return root;
}
