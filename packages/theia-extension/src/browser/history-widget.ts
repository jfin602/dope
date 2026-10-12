import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import type { HistoryEntry } from '@dope/contracts/lib/history';
import type { HistoryService, HistorySnapshot } from '@dope/contracts/lib/history-service';

export const HISTORY_WIDGET_ID = 'dope-history';
const sourceNames = { chat: 'Chat', planning: 'Planning', 'project-mind': 'Project Mind',
    agent: 'Work', git: 'Git', workbench: 'Workbench' } as const;

export function historyTimeLabel(entry: HistoryEntry): string {
    if (entry.kind === 'snapshot') return `Current snapshot · observed ${entry.observedAt}`;
    return entry.occurredAt ? `Event · ${entry.occurredAt}` : 'Event · time unknown';
}

export class HistoryWidget extends BaseWidget {
    private readonly status = document.createElement('p');
    private readonly content = document.createElement('div');
    private readonly rootsListener;
    private request = 0;

    constructor(private readonly connect: () => HistoryService, private readonly workspaces: WorkspaceService) {
        super();
        this.id = HISTORY_WIDGET_ID;
        this.title.label = this.title.caption = 'History';
        this.title.iconClass = codicon('history');
        this.title.closable = false;
        this.addClass('dope-history-panel');
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.content.className = 'dope-history-content';
        this.node.append(this.status, this.content);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.refresh(); });
        void this.refresh();
    }

    async refresh(): Promise<void> {
        const request = ++this.request;
        this.content.replaceChildren();
        this.status.textContent = 'Loading History…';
        try {
            const roots = await this.workspaces.roots;
            if (this.isDisposed || request !== this.request) return;
            if (roots.length !== 1 || roots[0].resource.scheme !== 'file') {
                this.status.textContent = 'History is available for one local project folder.';
                return;
            }
            const service = this.connect();
            const { projectHandle } = await service.attach(roots[0].resource.toString());
            const snapshot = await service.read(projectHandle);
            if (this.isDisposed || request !== this.request) return;
            this.render(snapshot);
        } catch (error) {
            if (this.isDisposed || request !== this.request) return;
            this.status.textContent = `History unavailable: ${error instanceof Error ? error.message : 'Unable to read project metadata'}`;
        }
    }

    private render(snapshot: HistorySnapshot): void {
        this.status.textContent = snapshot.diagnostics.length || snapshot.truncated ?
            `Partial History · ${snapshot.diagnostics.length} source diagnostics${snapshot.truncated ? ' · results limited' : ''}` : '';
        const header = document.createElement('header');
        const title = document.createElement('h2'); title.textContent = 'History';
        const refresh = document.createElement('button'); refresh.type = 'button'; refresh.textContent = 'Refresh';
        refresh.setAttribute('aria-label', 'Refresh History');
        refresh.onclick = () => { void this.refresh(); };
        header.append(title, refresh);
        const continueCard = document.createElement('section'); continueCard.className = 'dope-history-continue';
        const continueTitle = document.createElement('h3'); continueTitle.textContent = 'Continue';
        const continueText = document.createElement('p');
        continueText.textContent = snapshot.continueWith.kind === 'recent-activity-suggestion' ?
            `Recent activity suggests: ${snapshot.continueWith.title}. Exact continuation arrives in a later step.` :
            'No verified place to continue yet. Exact continuation arrives in a later step.';
        continueCard.append(continueTitle, continueText);
        const recent = document.createElement('section');
        const recentTitle = document.createElement('h3'); recentTitle.textContent = 'Recent Activity';
        recent.append(recentTitle);
        if (!snapshot.entries.length) {
            const empty = document.createElement('p'); empty.textContent = 'No source-backed activity is available for this project.';
            recent.append(empty);
        }
        for (const source of Object.keys(sourceNames) as (keyof typeof sourceNames)[]) {
            const entries = snapshot.entries.filter(entry => entry.source === source);
            if (!entries.length) continue;
            const group = document.createElement('div'); group.className = 'dope-history-group';
            const heading = document.createElement('h4'); heading.textContent = sourceNames[source];
            const list = document.createElement('ul');
            for (const entry of entries) {
                const row = document.createElement('li');
                const name = document.createElement('strong'); name.textContent = entry.title;
                const meta = document.createElement('small');
                const status = entry.status.kind === 'owner' ? entry.status.label :
                    entry.status.kind === 'work-item' ? `WorkItem: ${entry.status.state}` :
                        `Run: ${entry.status.state} · validation ${entry.status.validation} · promotion ${entry.status.promotion}`;
                meta.textContent = `${historyTimeLabel(entry)} · ${status} · ${entry.availability}`;
                row.append(name, meta); list.append(row);
            }
            group.append(heading, list); recent.append(group);
        }
        const understanding = document.createElement('section'); understanding.className = 'dope-history-understanding';
        const understandingTitle = document.createElement('h3'); understandingTitle.textContent = 'Understand recent work';
        const action = document.createElement('button'); action.type = 'button'; action.textContent = 'Explain'; action.disabled = true;
        action.setAttribute('aria-describedby', 'dope-history-understanding-explanation');
        const explanation = document.createElement('p'); explanation.id = 'dope-history-understanding-explanation';
        explanation.textContent = 'Explicit local understanding is planned for a later step. No model runs when History opens.';
        understanding.append(understandingTitle, action, explanation);
        this.content.replaceChildren(header, continueCard, recent, understanding);
    }

    override dispose(): void { ++this.request; this.rootsListener.dispose(); super.dispose(); }
}
