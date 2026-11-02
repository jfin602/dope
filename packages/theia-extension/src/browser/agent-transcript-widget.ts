import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import type { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import type { AgentRunEvent, AgentTranscriptEntry } from '@dope/agent-core';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { ChatScrollFollow } from './chat-panel-presentation';
import { ReasoningRevealBuffer } from './reasoning-reveal';
import { renderUntrustedMessageMarkdown } from './untrusted-message-markdown';
import { agentTranscriptWidgetId, workCommandLabel, workCommandOutput, workDisclosureKeydown,
    workToolDetails, workToolLabel, type WorkToolEntry, type AgentTranscriptOptions } from './work-transcript-presentation';
import { workTitle } from './work-selection-controller';

type ToolCard = { node: HTMLDetailsElement; events: WorkToolEntry[]; summary: HTMLElement; body: HTMLElement };
type CommandEntry = Extract<AgentTranscriptEntry, { kind: 'command' }>;

/** Read-only center observation. Work panels retain all execution controls. */
export class AgentTranscriptWidget extends BaseWidget {
    private readonly status = document.createElement('p');
    private readonly content = document.createElement('div');
    private readonly follow = new ChatScrollFollow();
    private readonly tools = new Map<string, ToolCard>();
    private readonly commands = new Map<string, HTMLDetailsElement>();
    private readonly commandEntries = new Map<string, CommandEntry>();
    private entries: AgentTranscriptEntry[] = [];
    private events: AgentRunEvent[] = [];
    private request = 0;
    private cursor = 0;
    private eventCursor = 0;
    private handle?: string;
    private running = false;
    private loading = false;
    private pending = false;
    private refreshTimer?: ReturnType<typeof setTimeout>;
    private scroll?: HTMLElement;
    private transcript?: HTMLElement;
    private latest?: HTMLButtonElement;
    private resizeObserver?: ResizeObserver;
    private reasoning?: { node: HTMLDetailsElement; body: HTMLElement; buffer: ReasoningRevealBuffer; text: string };
    private incomplete = false;
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
        this.rootsListener = workspaces.onWorkspaceChanged(() => { this.reset(); void this.refresh(); });
        void this.refresh();
    }

    private reset(): void {
        ++this.request;
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = undefined;
        this.resizeObserver?.disconnect();
        this.content.replaceChildren();
        this.scroll = this.transcript = this.latest = undefined;
        this.entries = []; this.events = []; this.cursor = this.eventCursor = 0;
        this.tools.clear(); this.commands.clear(); this.commandEntries.clear(); this.reasoning = undefined;
        this.handle = undefined; this.running = false; this.incomplete = false;
        this.follow.select(undefined);
    }

    /** Store notifications can be frequent. One bounded read coalesces them without touching Pi execution. */
    scheduleRefresh(): void {
        if (this.isDisposed || this.refreshTimer) return;
        this.refreshTimer = setTimeout(() => { this.refreshTimer = undefined; void this.refresh(); }, 120);
    }

    async refresh(): Promise<void> {
        if (this.loading) { this.pending = true; return; }
        this.loading = true;
        const request = this.request;
        try {
            const roots = await this.workspaces.roots;
            if (request !== this.request || this.isDisposed) return;
            if (roots.length !== 1 || roots[0].resource.toString() !== this.options.project) {
                this.reset();
                this.status.textContent = 'Open the original project to view this transcript.';
                return;
            }
            if (!this.handle) this.handle = (await this.runtime.attach(this.options.project)).projectHandle;
            if (request !== this.request || this.isDisposed) return;
            const run = await this.runtime.readRun(this.handle, this.options.runId);
            if (!run) throw new Error('Work run could not be found.');
            const task = await this.runtime.readTask(this.handle, run.taskId);
            if (request !== this.request || this.isDisposed) return;
            this.title.label = this.title.caption = workTitle({ kind: 'run', id: run.id }, run, task);
            this.status.textContent = `Work transcript · Run ${run.status}`;
            const wasRunning = this.running;
            this.running = run.status === 'pending' || run.status === 'running' || run.status === 'blocked';
            const fresh: AgentTranscriptEntry[] = [];
            let cursor = this.cursor;
            let state: 'recorded' | 'not-recorded' = 'not-recorded';
            for (;;) {
                const page = await this.runtime.readTranscript(this.handle, run.id, cursor, 100);
                if (request !== this.request || this.isDisposed) return;
                fresh.push(...page.entries.filter(entry => entry.sequence > this.cursor));
                state = page.state; this.incomplete ||= page.incomplete;
                if (!page.hasMore) { cursor = page.nextSequence; break; }
                if (page.nextSequence <= cursor) throw new Error('Transcript pagination did not advance.');
                cursor = page.nextSequence;
            }
            // Legacy event-only runs retain their original activity view.
            if (state === 'not-recorded') {
                for (;;) {
                    const page = await this.runtime.readEvents(this.handle, run.id, this.eventCursor, 100);
                    if (request !== this.request || this.isDisposed) return;
                    this.events.push(...page.events);
                    if (this.transcript) for (const event of page.events)
                        this.appendNote(`${event.summary}${event.path ? ` · ${event.path}` : ''}`);
                    if (page.hasMore && page.nextSequence <= this.eventCursor)
                        throw new Error('Activity pagination did not advance.');
                    this.eventCursor = page.nextSequence;
                    if (!page.hasMore) break;
                }
            }
            const historical = !this.transcript;
            if (historical) this.createView(state);
            if (fresh.length) this.transcript?.querySelector('.dope-work-empty')?.remove();
            if (state === 'recorded') {
                this.transcript?.querySelector('.dope-work-unrecorded')?.remove();
                this.transcript?.querySelector('.dope-work-activity')?.remove();
            }
            for (const entry of fresh) this.append(entry, historical);
            this.entries.push(...fresh);
            this.cursor = cursor;
            if (historical && this.running && this.reasoning)
                for (const chunk of this.reasoning.buffer.flush()) this.appendReasoningChunk(this.reasoning.body, chunk, false);
            if (!this.running) this.flushReasoning(!historical);
            // Command finishes update their original stored entry, so reconcile those only once at run end.
            if (wasRunning && !this.running && this.commandEntries.size) {
                let commandCursor = 0;
                for (;;) {
                    const page = await this.runtime.readTranscript(this.handle, run.id, commandCursor, 100);
                    if (request !== this.request || this.isDisposed) return;
                    for (const entry of page.entries) if (entry.kind === 'command') this.append(entry, true);
                    if (!page.hasMore) break;
                    if (page.nextSequence <= commandCursor) break;
                    commandCursor = page.nextSequence;
                }
            }
            if (this.incomplete && !this.transcript?.querySelector('.dope-work-incomplete'))
                this.appendNote('Transcript truncated: recording limit reached.', 'dope-work-incomplete');
            this.updateScroll();
        } catch (error) {
            if (request !== this.request || this.isDisposed) return;
            this.status.textContent = `Transcript could not be loaded. ${error instanceof Error ? error.message : ''}`;
            const retry = document.createElement('button'); retry.textContent = 'Retry';
            retry.onclick = () => void this.refresh(); this.status.append(' ', retry);
        } finally {
            this.loading = false;
            if (this.pending) { this.pending = false; this.scheduleRefresh(); }
        }
    }

    private createView(state: 'recorded' | 'not-recorded'): void {
        const region = document.createElement('section'); region.className = 'dope-chat-transcript-region';
        const scroll = document.createElement('div'); scroll.className = 'dope-chat-scroll dope-work-scroll';
        scroll.setAttribute('role', 'log'); scroll.setAttribute('aria-label', 'AgentRun transcript');
        scroll.setAttribute('aria-live', 'off'); scroll.addEventListener('keydown', workDisclosureKeydown);
        const latest = document.createElement('button'); latest.textContent = 'Latest'; latest.type = 'button';
        latest.setAttribute('aria-label', 'Go to latest transcript entry');
        latest.className = 'dope-chat-latest dope-work-latest';
        latest.onclick = () => { this.follow.jump(); scroll.scrollTop = scroll.scrollHeight; latest.hidden = true; };
        scroll.onscroll = () => { this.follow.scrolled(scroll.scrollTop, scroll.scrollHeight, scroll.clientHeight);
            latest.hidden = !this.follow.latestBelow; };
        const transcript = document.createElement('div');
        transcript.className = 'dope-chat-transcript dope-work-transcript';
        if (state === 'not-recorded') {
            this.appendNote('Transcript not recorded for this historical run.', 'dope-work-unrecorded', transcript);
            if (this.events.length) {
                const activity = document.createElement('section'); activity.className = 'dope-work-activity';
                const heading = document.createElement('h3'); heading.textContent = 'Live activity'; activity.append(heading);
                for (const event of this.events) this.appendNote(`${event.summary}${event.path ? ` · ${event.path}` : ''}`, '', activity);
                transcript.append(activity);
            }
        } else if (!this.entries.length) {
            this.appendNote('No transcript entries have been recorded yet.', 'dope-work-empty', transcript);
        }
        scroll.append(transcript); region.append(scroll, latest); this.content.replaceChildren(region);
        this.scroll = scroll; this.transcript = transcript; this.latest = latest;
        this.resizeObserver = new ResizeObserver(() => {
            if (this.isDisposed || !this.content.contains(region)) return;
            this.updateScroll();
        });
        this.resizeObserver.observe(scroll); this.resizeObserver.observe(transcript);
    }

    private appendNote(text: string, className = '', parent = this.transcript): void {
        if (!parent) return;
        const note = document.createElement('p'); note.className = `dope-work-system ${className}`;
        note.textContent = text; parent.append(note);
    }

    private flushReasoning(animate: boolean): void {
        const reasoning = this.reasoning;
        if (!reasoning) return;
        for (const chunk of reasoning.buffer.flush()) this.appendReasoningChunk(reasoning.body, chunk, animate);
        this.reasoning = undefined;
    }

    private appendReasoningChunk(body: HTMLElement, text: string, animate: boolean): void {
        const prose = renderUntrustedMessageMarkdown(this.markdown, text);
        prose.className = 'dope-chat-stream-prose dope-chat-reasoning-chunk';
        if (animate) prose.classList.add('dope-chat-reasoning-fade');
        body.append(prose);
    }

    private append(entry: AgentTranscriptEntry, historical: boolean): void {
        const transcript = this.transcript;
        if (!transcript) return;
        if (entry.kind === 'reasoning') {
            if (!this.reasoning) {
                const node = document.createElement('details'); node.className = 'dope-work-reasoning';
                node.open = this.running;
                const summary = document.createElement('summary'); summary.textContent = 'Reasoning'; node.append(summary);
                const body = document.createElement('div'); body.className = 'dope-work-reasoning-body'; node.append(body);
                transcript.append(node);
                this.reasoning = { node, body, buffer: new ReasoningRevealBuffer('paragraphs'), text: '' };
            }
            const reasoning = this.reasoning;
            reasoning.text += entry.text;
            for (const chunk of reasoning.buffer.update(reasoning.text))
                this.appendReasoningChunk(reasoning.body, chunk, !historical);
            if (entry.truncated) this.appendNote('Reasoning excerpt truncated.', '', reasoning.body);
            return;
        }
        this.flushReasoning(!historical);
        if (entry.kind === 'work') {
            let card = this.tools.get(entry.toolId);
            if (!card) {
                const node = document.createElement('details'); node.className = 'dope-work-tool dope-work-command';
                const summary = document.createElement('summary'); node.append(summary);
                const body = document.createElement('div'); body.className = 'dope-work-tool-body'; node.append(body);
                card = { node, summary, body, events: [] }; this.tools.set(entry.toolId, card);
                transcript.append(node);
            }
            card.events.push(entry);
            card.node.dataset.status = entry.phase;
            card.summary.textContent = `⚙ ${workToolLabel(entry, card.events)}`;
            card.summary.setAttribute('aria-label', `Tool ${workToolLabel(entry, card.events)}`);
            card.body.replaceChildren();
            for (const line of workToolDetails(card.events)) this.appendNote(line, 'dope-work-tool-detail', card.body);
            const command = this.commandEntries.get(entry.toolId);
            if (command) this.appendCommandOutput(card.body, command);
            this.commands.get(entry.toolId)?.remove(); this.commands.delete(entry.toolId);
        } else if (entry.kind === 'message') {
            const article = document.createElement('article');
            article.className = 'dope-chat-message dope-chat-message-assistant dope-work-message';
            const divider = document.createElement('hr'); divider.className = 'dope-work-final-divider'; article.append(divider);
            const heading = document.createElement('h3'); heading.textContent = 'Final result'; article.append(heading);
            const content = document.createElement('div'); content.className = 'dope-chat-message-content';
            content.append(renderUntrustedMessageMarkdown(this.markdown, entry.text));
            if (entry.truncated) this.appendNote('Final response truncated in the saved transcript.', 'dope-work-warning', content);
            article.append(content); transcript.append(article);
        } else if (entry.kind === 'command') {
            this.commandEntries.set(entry.commandId, entry);
            const tool = this.tools.get(entry.commandId);
            if (tool) { this.appendCommandOutput(tool.body, entry); return; }
            // R4-A command output has no toolId correlation. Preserve its separate legacy timeline truth.
            let details = this.commands.get(entry.commandId);
            if (!details) {
                details = document.createElement('details'); details.className = 'dope-work-command';
                this.commands.set(entry.commandId, details); transcript.append(details);
            }
            details.replaceChildren(); details.className = `dope-work-command dope-work-command-${entry.status}`;
            const summary = document.createElement('summary'); summary.textContent = workCommandLabel(entry); details.append(summary);
            const correlation = document.createElement('small'); correlation.className = 'dope-work-command-correlation';
            correlation.textContent = `Started at entry ${entry.sequence}` +
                (entry.completedSequence === undefined ? ' · finish not recorded' : ` · finished at entry ${entry.completedSequence}`);
            details.append(correlation);
            const fullCommand = document.createElement('pre');
            fullCommand.textContent = `command${entry.commandTruncated ? ' [truncated]' : ''}:\n${entry.command}`;
            details.append(fullCommand);
            for (const output of workCommandOutput(entry)) { const pre = document.createElement('pre'); pre.textContent = output; details.append(pre); }
        } else {
            this.appendNote(entry.code === 'transcript-incomplete' ? 'Transcript truncated: recording limit reached.' :
                entry.code === 'run-started' ? 'Run started.' :
                entry.code === 'observation-omitted' ? 'Some reasoning activity was omitted from the saved transcript.' : 'Run ended.',
                entry.code === 'transcript-incomplete' ? 'dope-work-incomplete' : '');
        }
    }

    private appendCommandOutput(body: HTMLElement, entry: CommandEntry): void {
        body.querySelector('.dope-work-command-output')?.remove();
        const output = document.createElement('div'); output.className = 'dope-work-command-output';
        for (const line of workCommandOutput(entry)) {
            const pre = document.createElement('pre'); pre.textContent = line; output.append(pre);
        }
        body.append(output);
    }

    private updateScroll(): void {
        if (!this.scroll || !this.latest) return;
        if (this.follow.following) this.scroll.scrollTop = this.scroll.scrollHeight;
        this.follow.scrolled(this.scroll.scrollTop, this.scroll.scrollHeight, this.scroll.clientHeight);
        this.latest.hidden = !this.follow.latestBelow;
    }

    override dispose(): void {
        this.flushReasoning(false);
        this.reset(); this.rootsListener.dispose(); super.dispose();
    }
}
