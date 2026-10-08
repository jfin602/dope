import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { MarkdownStringImpl } from '@theia/core/lib/common/markdown-rendering/markdown-string';
import type { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import type { AgentTranscriptEntry } from '@dope/agent-core';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { ChatScrollFollow, safeChatLink } from './chat-panel-presentation';
import { agentTranscriptWidgetId, workCommandLabel, workCommandOutput,
    type AgentTranscriptOptions } from './work-transcript-presentation';
import { workTitle } from './work-selection-controller';

/** Read-only center observation. Work panels retain all execution controls. */
export class AgentTranscriptWidget extends BaseWidget {
    private readonly status = document.createElement('p');
    private readonly content = document.createElement('div');
    private readonly follow = new ChatScrollFollow();
    private entries: AgentTranscriptEntry[] = [];
    private request = 0;
    private scrollTop = 0;
    private state: 'recorded' | 'not-recorded' = 'not-recorded';
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
        this.content.className = 'dope-chat-content dope-chat-content-work';
        this.status.setAttribute('role', 'status');
        this.node.append(this.status, this.content);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { ++this.request; void this.refresh(); });
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
                return;
            }
            const { projectHandle } = await this.runtime.attach(this.options.project);
            const run = await this.runtime.readRun(projectHandle, this.options.runId);
            if (!run) throw new Error('Work run could not be found.');
            const task = await this.runtime.readTask(projectHandle, run.taskId);
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
            this.entries = entries; this.state = state; this.incomplete = incomplete;
            this.title.label = this.title.caption = workTitle({ kind: 'run', id: run.id }, run, task);
            this.status.textContent = `Work transcript · ${run.status}`;
            this.render();
        } catch (error) {
            if (request !== this.request || this.isDisposed) return;
            this.status.textContent = error instanceof Error ? error.message : 'Transcript could not be loaded.';
            const retry = document.createElement('button'); retry.textContent = 'Retry';
            retry.onclick = () => void this.refresh();
            this.status.append(' ', retry);
        }
    }

    private render(): void {
        const previous = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
        if (previous) this.scrollTop = previous.scrollTop;
        const region = document.createElement('section'); region.className = 'dope-chat-transcript-region';
        const scroll = document.createElement('div'); scroll.className = 'dope-chat-scroll dope-work-scroll';
        scroll.setAttribute('role', 'log'); scroll.setAttribute('aria-label', 'AgentRun transcript');
        const latest = document.createElement('button'); latest.textContent = 'Latest';
        latest.className = 'dope-chat-latest dope-work-latest';
        latest.onclick = () => { this.follow.jump(); scroll.scrollTop = scroll.scrollHeight; latest.hidden = true; };
        scroll.onscroll = () => { this.scrollTop = scroll.scrollTop;
            this.follow.scrolled(scroll.scrollTop, scroll.scrollHeight, scroll.clientHeight);
            latest.hidden = !this.follow.latestBelow; };
        if (this.state === 'not-recorded') {
            const note = document.createElement('p'); note.textContent = 'Transcript not recorded for this historical run.';
            scroll.append(note);
        }
        for (const entry of this.entries) {
            if (entry.kind === 'message') {
                const article = document.createElement('article');
                article.className = 'dope-work-message dope-chat-message-content';
                const rendered = this.markdown.render(new MarkdownStringImpl(entry.text,
                    { supportHtml: false, isTrusted: false })).element;
                for (const link of rendered.querySelectorAll('a[href]')) {
                    if (!safeChatLink(link.getAttribute('href')!, document.baseURI)) link.removeAttribute('href');
                    else link.setAttribute('rel', 'noopener noreferrer');
                }
                article.append(rendered);
                if (entry.truncated) article.append(' [Message truncated]');
                scroll.append(article);
            } else if (entry.kind === 'command') {
                const details = document.createElement('details'); details.className = 'dope-work-command';
                const summary = document.createElement('summary'); summary.textContent = workCommandLabel(entry);
                details.append(summary);
                for (const output of workCommandOutput(entry)) {
                    const pre = document.createElement('pre'); pre.textContent = output; details.append(pre);
                }
                scroll.append(details);
            } else {
                const note = document.createElement('small'); note.className = 'dope-work-system';
                note.textContent = entry.code === 'transcript-incomplete' ? 'Transcript truncated: recording limit reached.' :
                    'System event';
                scroll.append(note);
            }
        }
        if (this.incomplete && !this.entries.some(entry => entry.kind === 'marker' && entry.code === 'transcript-incomplete')) {
            const note = document.createElement('p'); note.textContent = 'Transcript truncated: recording limit reached.';
            scroll.append(note);
        }
        region.append(scroll, latest);
        this.content.replaceChildren(region);
        scroll.scrollTop = this.follow.restore(this.scrollTop, scroll.scrollHeight, scroll.clientHeight);
        latest.hidden = !this.follow.latestBelow;
    }

    override dispose(): void { ++this.request; this.rootsListener.dispose(); super.dispose(); }
}
