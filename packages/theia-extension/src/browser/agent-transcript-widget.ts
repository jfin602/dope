import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import type { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import type { AgentRunEvent, AgentTranscriptEntry } from '@dope/agent-core';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { ChatScrollFollow } from './chat-panel-presentation';
import { renderUntrustedMessageMarkdown } from './untrusted-message-markdown';
import { agentTranscriptWidgetId, workCommandLabel, workCommandOutput, workDisclosureKeydown,
    type AgentTranscriptOptions } from './work-transcript-presentation';
import { workTitle } from './work-selection-controller';

/** Read-only center observation. Work panels retain all execution controls. */
export class AgentTranscriptWidget extends BaseWidget {
    private readonly status = document.createElement('p');
    private readonly content = document.createElement('div');
    private readonly follow = new ChatScrollFollow();
    private entries: AgentTranscriptEntry[] = [];
    private events: AgentRunEvent[] = [];
    private request = 0;
    private scrollTop = 0;
    private state: 'recorded' | 'not-recorded' = 'not-recorded';
    private incomplete = false;
    private readonly expandedCommands = new Set<string>();
    private resizeObserver?: ResizeObserver;
    private readonly rootsListener;

    constructor(private readonly runtime: AgentRuntimeService, private readonly markdown: MarkdownRenderer,
        private readonly workspaces: WorkspaceService, readonly options: AgentTranscriptOptions) {
        super();
        this.id = agentTranscriptWidgetId(options);
        this.title.label = this.title.caption = `Work - ${options.runId.slice(0, 8)}`;
        this.title.iconClass = codicon('output');
        this.title.closable = true;
        this.addClass('dope-chat-panel');
        this.addClass('dope-agent-transcript-panel');
        this.content.className = 'dope-chat-content dope-chat-content-work';
        this.status.setAttribute('role', 'status');
        this.status.className = 'dope-work-transcript-status';
        this.follow.select(this.id);
        this.node.append(this.status, this.content);
        this.rootsListener = workspaces.onWorkspaceChanged(() => {
            ++this.request;
            const previous = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
            if (previous) {
                this.scrollTop = previous.scrollTop;
                for (const details of previous.querySelectorAll<HTMLDetailsElement>('.dope-work-command')) {
                    const key = details.dataset.commandKey;
                    if (key) {
                        if (details.open) this.expandedCommands.add(key);
                        else this.expandedCommands.delete(key);
                    }
                }
            }
            this.content.replaceChildren();
            void this.refresh();
        });
        void this.refresh();
    }

    async refresh(): Promise<void> {
        const request = ++this.request;
        this.status.textContent = 'Loading transcript…';
        try {
            const roots = await this.workspaces.roots;
            if (request !== this.request || this.isDisposed) return;
            if (roots.length !== 1 || roots[0].resource.toString() !== this.options.project) {
                this.status.textContent = 'Open the original project to view this transcript.';
                this.content.replaceChildren();
                this.entries = [];
                this.events = [];
                this.expandedCommands.clear();
                this.scrollTop = 0;
                this.follow.select(undefined);
                return;
            }
            const { projectHandle } = await this.runtime.attach(this.options.project);
            const run = await this.runtime.readRun(projectHandle, this.options.runId);
            if (!run) throw new Error('Work run could not be found.');
            const task = await this.runtime.readTask(projectHandle, run.taskId);
            const events: AgentRunEvent[] = [];
            let eventCursor = 0;
            while (true) {
                const page = await this.runtime.readEvents(projectHandle, run.id, eventCursor, 100);
                if (request !== this.request || this.isDisposed) return;
                events.push(...page.events);
                if (!page.hasMore) break;
                if (page.nextSequence <= eventCursor) throw new Error('Activity pagination did not advance.');
                eventCursor = page.nextSequence;
            }
            const entries: AgentTranscriptEntry[] = [];
            let cursor = 0;
            let state: 'recorded' | 'not-recorded' = 'not-recorded';
            let incomplete = false;
            while (true) {
                const page = await this.runtime.readTranscript(projectHandle, run.id, cursor, 100);
                if (request !== this.request || this.isDisposed) return;
                entries.push(...page.entries);
                state = page.state; incomplete ||= page.incomplete;
                if (!page.hasMore) break;
                if (page.nextSequence <= cursor) throw new Error('Transcript pagination did not advance.');
                cursor = page.nextSequence;
            }
            if (request !== this.request || this.isDisposed) return;
            this.entries = entries; this.events = events.slice(-100); this.state = state; this.incomplete = incomplete;
            this.follow.select(this.id);
            this.title.label = this.title.caption = workTitle({ kind: 'run', id: run.id }, run, task);
            this.status.textContent = `Work transcript · Run ${run.status}`;
            this.render();
        } catch (error) {
            if (request !== this.request || this.isDisposed) return;
            this.status.textContent = `Transcript could not be loaded. ${error instanceof Error ? error.message : ''}`;
            const retry = document.createElement('button'); retry.textContent = 'Retry';
            retry.onclick = () => void this.refresh();
            this.status.append(' ', retry);
        }
    }

    private render(): void {
        this.resizeObserver?.disconnect();
        const previous = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
        if (previous) {
            this.scrollTop = previous.scrollTop;
            for (const details of previous.querySelectorAll<HTMLDetailsElement>('.dope-work-command')) {
                const key = details.dataset.commandKey;
                if (key) {
                    if (details.open) this.expandedCommands.add(key);
                    else this.expandedCommands.delete(key);
                }
            }
        }
        const region = document.createElement('section'); region.className = 'dope-chat-transcript-region';
        const scroll = document.createElement('div'); scroll.className = 'dope-chat-scroll dope-work-scroll';
        scroll.setAttribute('role', 'log'); scroll.setAttribute('aria-label', 'AgentRun transcript');
        scroll.setAttribute('aria-live', 'off');
        scroll.addEventListener('keydown', workDisclosureKeydown);
        const latest = document.createElement('button'); latest.textContent = 'Latest';
        latest.type = 'button'; latest.setAttribute('aria-label', 'Go to latest transcript entry');
        latest.className = 'dope-chat-latest dope-work-latest';
        latest.onclick = () => { this.follow.jump(); scroll.scrollTop = scroll.scrollHeight; latest.hidden = true; };
        scroll.onscroll = () => { this.scrollTop = scroll.scrollTop;
            this.follow.scrolled(scroll.scrollTop, scroll.scrollHeight, scroll.clientHeight);
            latest.hidden = !this.follow.latestBelow; };
        const transcript = document.createElement('div');
        transcript.className = 'dope-chat-transcript dope-work-transcript';
        if (this.events.length) {
            const activity = document.createElement('section'); activity.className = 'dope-work-activity';
            const heading = document.createElement('h3'); heading.textContent = 'Live activity'; activity.append(heading);
            for (const event of this.events) {
                const note = document.createElement('p'); note.className = 'dope-work-system';
                note.textContent = `${event.summary}${event.path ? ` · ${event.path}` : ''}`;
                activity.append(note);
            }
            transcript.append(activity);
        }
        if (this.state === 'not-recorded') {
            const note = document.createElement('p'); note.className = 'dope-work-system';
            note.textContent = 'Transcript not recorded for this historical run.';
            transcript.append(note);
        } else if (this.entries.length === 0) {
            const note = document.createElement('p'); note.className = 'dope-work-system';
            note.textContent = 'No transcript entries have been recorded yet.';
            transcript.append(note);
        }
        for (const entry of this.entries) {
            if (entry.kind === 'message') {
                const article = document.createElement('article');
                article.className = 'dope-chat-message dope-chat-message-assistant dope-work-message';
                const content = document.createElement('div'); content.className = 'dope-chat-message-content';
                content.append(renderUntrustedMessageMarkdown(this.markdown, entry.text));
                if (entry.truncated) {
                    const warning = document.createElement('small'); warning.className = 'dope-work-system dope-work-warning';
                    warning.textContent = 'Message truncated in the saved transcript.';
                    content.append(warning);
                }
                article.append(content);
                transcript.append(article);
            } else if (entry.kind === 'command') {
                const details = document.createElement('details'); details.className = 'dope-work-command';
                details.classList.add(`dope-work-command-${entry.status}`);
                const key = `${entry.sequence}:${entry.commandId}`;
                details.dataset.commandKey = key;
                details.open = this.expandedCommands.has(key);
                details.addEventListener('toggle', () => {
                    if (details.open) this.expandedCommands.add(key);
                    else this.expandedCommands.delete(key);
                });
                const summary = document.createElement('summary'); summary.textContent = workCommandLabel(entry);
                details.append(summary);
                const correlation = document.createElement('small'); correlation.className = 'dope-work-command-correlation';
                correlation.textContent = `Started at entry ${entry.sequence}` +
                    (entry.completedSequence === undefined ? ' · finish not recorded' : ` · finished at entry ${entry.completedSequence}`);
                details.append(correlation);
                const fullCommand = document.createElement('pre');
                fullCommand.textContent = `command${entry.commandTruncated ? ' [truncated]' : ''}:\n${entry.command}`;
                details.append(fullCommand);
                for (const output of workCommandOutput(entry)) {
                    const pre = document.createElement('pre'); pre.textContent = output; details.append(pre);
                }
                transcript.append(details);
            } else {
                const note = document.createElement('small'); note.className = 'dope-work-system';
                note.textContent = entry.code === 'transcript-incomplete' ? 'Transcript truncated: recording limit reached.' :
                    entry.code === 'run-started' ? 'Run started.' : 'Run ended.';
                transcript.append(note);
            }
        }
        if (this.incomplete && !this.entries.some(entry => entry.kind === 'marker' && entry.code === 'transcript-incomplete')) {
            const note = document.createElement('p'); note.className = 'dope-work-system';
            note.textContent = 'Transcript truncated: recording limit reached.';
            transcript.append(note);
        }
        scroll.append(transcript);
        region.append(scroll, latest);
        this.content.replaceChildren(region);
        scroll.scrollTop = this.follow.restore(this.scrollTop, scroll.scrollHeight, scroll.clientHeight);
        latest.hidden = !this.follow.latestBelow;
        this.resizeObserver = new ResizeObserver(() => {
            if (this.isDisposed || !this.content.contains(region)) return;
            if (this.follow.following) scroll.scrollTop = scroll.scrollHeight;
            this.follow.scrolled(scroll.scrollTop, scroll.scrollHeight, scroll.clientHeight);
            latest.hidden = !this.follow.latestBelow;
        });
        this.resizeObserver.observe(scroll);
        this.resizeObserver.observe(transcript);
    }

    override dispose(): void { ++this.request; this.resizeObserver?.disconnect(); this.rootsListener.dispose(); super.dispose(); }
}
