import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import type { HistoryEntry, HistoryNavigableOwnerRef } from '@dope/contracts/lib/history';
import type { HistoryService, HistorySnapshot } from '@dope/contracts/lib/history-service';
import { HISTORY_PREVIEW_MAX_ITEMS } from '@dope/contracts/lib/history-context-preview';
import type { HistorySelection } from '@dope/contracts/lib/history-context-preview';
import type { HistoryContextPreview } from '@dope/contracts/lib/history-context-preview';
import { navigateHistory, type HistoryNavigationOwners } from './history-navigation';

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
    private navigation = 0;
    private projectUri?: string;
    private handle?: string;
    private explanationId?: string;

    constructor(private readonly connect: () => HistoryService, private readonly workspaces: WorkspaceService,
        private readonly owners: (handle: string, project: HistorySnapshot['project']) => HistoryNavigationOwners) {
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
        this.cancelExplanation();
        const request = ++this.request;
        ++this.navigation;
        this.projectUri = undefined;
        this.handle = undefined;
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
            this.projectUri = roots[0].resource.toString();
            this.handle = projectHandle;
            this.render(snapshot);
        } catch (error) {
            if (this.isDisposed || request !== this.request) return;
            this.status.textContent = `History unavailable: ${error instanceof Error ? error.message : 'Unable to read project metadata'}`;
        }
    }

    private cancelExplanation(): void {
        if (this.explanationId) { void this.connect().cancelExplanation(this.explanationId).catch(() => {});
            this.explanationId = undefined; }
    }

    private async navigate(snapshot: HistorySnapshot, owner: HistoryNavigableOwnerRef,
        sourceId?: string, observedAt?: string): Promise<void> {
        const navigation = ++this.navigation, request = this.request, uri = this.projectUri, handle = this.handle;
        if (!uri || !handle) return;
        const current = async () => {
            if (this.isDisposed || navigation !== this.navigation || request !== this.request) return false;
            const roots = await this.workspaces.roots;
            return !this.isDisposed && navigation === this.navigation && request === this.request &&
                roots.length === 1 && roots[0].resource.toString() === uri;
        };
        this.status.textContent = 'Verifying exact History target…';
        const result = await navigateHistory(snapshot, owner, sourceId, observedAt,
            () => this.connect().read(handle), current, this.owners(handle, snapshot.project));
        if (await current()) this.status.textContent = result.message;
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
        continueText.textContent = snapshot.continueWith.kind === 'verified-focus' ?
            `Last focused ${snapshot.continueWith.owner.kind} at ${snapshot.continueWith.observedAt}.` :
            snapshot.continueWith.kind === 'recent-activity-suggestion' ?
            `Recent activity suggests: ${snapshot.continueWith.title}.` :
            'No verified place to continue yet.';
        continueCard.append(continueTitle, continueText);
        if (snapshot.continueWith.kind !== 'none') {
            const choice = snapshot.continueWith;
            const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Continue';
            button.setAttribute('aria-label', choice.kind === 'verified-focus' ? 'Continue last verified focus' : 'Open suggested recent activity');
            button.onclick = () => { void this.navigate(snapshot, choice.owner,
                choice.kind === 'recent-activity-suggestion' ? choice.sourceId : undefined,
                choice.kind === 'verified-focus' ? choice.observedAt : undefined); };
            continueCard.append(button);
        }
        const selected = new Map<string, HistorySelection>();
        let confirmedPreview: HistoryContextPreview | undefined;
        let previewRevision = 0;
        const invalidatePreview = () => { ++previewRevision; confirmedPreview = undefined; this.cancelExplanation();
            explain.disabled = true; output.replaceChildren(); result.replaceChildren(); };
        const recent = document.createElement('section');
        const recentTitle = document.createElement('h3'); recentTitle.textContent = 'Recent Activity';
        recent.append(recentTitle);
        if (!snapshot.entries.length) {
            const empty = document.createElement('p'); empty.textContent = 'No source-backed activity is available for this project.';
            recent.append(empty);
        }
        if (snapshot.entries.length) {
            const list = document.createElement('ul');
            for (const entry of snapshot.entries) {
                const row = document.createElement('li');
                const name = document.createElement('strong'); name.textContent = entry.title;
                const meta = document.createElement('small');
                const status = entry.status.kind === 'owner' ? entry.status.label :
                    entry.status.kind === 'work-item' ? `WorkItem: ${entry.status.state}` :
                        `Run: ${entry.status.state} · validation ${entry.status.validation} · promotion ${entry.status.promotion}`;
                meta.textContent = `${historyTimeLabel(entry)} · ${sourceNames[entry.source]} · ${status} · ${entry.availability}`;
                const pick = document.createElement('input'); pick.type = 'checkbox';
                pick.setAttribute('aria-label', `Select ${entry.source} ${entry.sourceId} for evidence preview`);
                pick.onchange = () => {
                    invalidatePreview();
                    const key = JSON.stringify([entry.source, entry.sourceId]);
                    if (pick.checked) {
                        if (selected.size >= HISTORY_PREVIEW_MAX_ITEMS) { pick.checked = false; this.status.textContent = 'Select at most 8 items.'; return; }
                        selected.set(key, { source: entry.source, sourceId: entry.sourceId });
                    } else selected.delete(key);
                };
                row.append(pick, name, meta);
                if (entry.availability === 'available' && entry.owner.kind !== 'git-dirty' && entry.owner.kind !== 'git-commit') {
                    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Open';
                    button.setAttribute('aria-label', `Open ${entry.title} in its owner view`);
                    button.onclick = () => { void this.navigate(snapshot, entry.owner as HistoryNavigableOwnerRef, entry.sourceId); };
                    row.append(button);
                } else if (entry.owner.kind === 'git-commit') {
                    const note = document.createElement('small'); note.textContent = 'Exact commit navigation is unsupported.';
                    row.append(note);
                }
                list.append(row);
            }
            recent.append(list);
        }
        const understanding = document.createElement('section'); understanding.className = 'dope-history-understanding';
        const understandingTitle = document.createElement('h3'); understandingTitle.textContent = 'Understand recent work';
        const action = document.createElement('button'); action.type = 'button'; action.textContent = 'Preview selected evidence';
        action.setAttribute('aria-describedby', 'dope-history-understanding-explanation');
        const explanation = document.createElement('p'); explanation.id = 'dope-history-understanding-explanation';
        explanation.textContent = 'Select up to 8 items. Preview reads only project-local owner metadata. No model runs or data leaves this machine.';
        const output = document.createElement('div'); output.setAttribute('aria-live', 'polite');
        const result = document.createElement('div'); result.setAttribute('aria-live', 'polite');
        const explain = document.createElement('button'); explain.type = 'button';
        explain.textContent = 'Confirm preview and explain locally'; explain.disabled = true;
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel explanation';
        cancel.disabled = true;
        cancel.onclick = () => { this.cancelExplanation(); cancel.disabled = true; explain.disabled = !confirmedPreview;
            result.textContent = 'Local explanation cancelled.'; };
        explain.onclick = async () => {
            const preview = confirmedPreview, handle = this.handle, uri = this.projectUri, request = this.request;
            if (!preview || !handle || !uri) return;
            const roots = await this.workspaces.roots;
            if (request !== this.request || roots.length !== 1 || roots[0].resource.toString() !== uri) return;
            const id = crypto.randomUUID(); this.explanationId = id; explain.disabled = true; cancel.disabled = false;
            result.textContent = 'Requesting a local explanation…';
            try {
                const explanation = await this.connect().explain(handle, preview, [...selected.values()], id, true);
                const currentRoots = await this.workspaces.roots;
                if (request !== this.request || this.explanationId !== id || currentRoots.length !== 1 ||
                    currentRoots[0].resource.toString() !== uri) return;
                const provenance = document.createElement('p');
                provenance.textContent = `Local model: ${explanation.provenance.modelLabel} · ${explanation.provenance.providerId} · ${explanation.provenance.connectionId}/${explanation.provenance.modelId}`;
                const sections = (['facts', 'interpretations', 'unknowns'] as const).map(kind => {
                    const section = document.createElement('section');
                    const heading = document.createElement('h4'); heading.textContent = kind === 'facts' ? 'Facts from selected metadata' :
                        kind === 'interpretations' ? 'Model interpretations' : 'Unknowns';
                    const list = document.createElement('ul');
                    for (const line of explanation[kind]) {
                        const row = document.createElement('li'); row.textContent = `${line.text} [${line.citations.join(', ')}]`;
                        list.append(row);
                    }
                    section.append(heading, list); return section;
                });
                result.replaceChildren(provenance, ...sections);
            } catch (error) {
                if (request === this.request && this.explanationId === id)
                    result.textContent = `Local explanation unavailable: ${error instanceof Error ? error.message : 'Unable to explain preview'}`;
            } finally {
                if (this.explanationId === id) { this.explanationId = undefined; cancel.disabled = true; explain.disabled = !confirmedPreview; }
            }
        };
        action.onclick = async () => {
            invalidatePreview(); explain.disabled = true; result.replaceChildren();
            const revision = previewRevision, request = this.request, handle = this.handle, uri = this.projectUri;
            if (!handle || !uri || !selected.size) { output.textContent = 'Select at least one item.'; return; }
            output.textContent = 'Checking current evidence…';
            try {
                const roots = await this.workspaces.roots;
                if (request !== this.request || revision !== previewRevision || roots.length !== 1 || roots[0].resource.toString() !== uri) return;
                const preview = await this.connect().preview(handle, snapshot.evidenceBasis, [...selected.values()]);
                const currentRoots = await this.workspaces.roots;
                if (request !== this.request || revision !== previewRevision || currentRoots.length !== 1 || currentRoots[0].resource.toString() !== uri) return;
                const heading = document.createElement('h4'); heading.textContent = 'Local evidence preview';
                const privacy = document.createElement('p'); privacy.textContent = preview.privacy;
                const budget = document.createElement('p');
                budget.textContent = `${preview.items.length} items · ${preview.bytes}/${4096} bytes · estimated ${preview.estimatedTokens}/${1024} tokens · basis ${preview.evidenceBasis}`;
                const list = document.createElement('ul');
                for (const item of preview.items) {
                    const row = document.createElement('li');
                    row.textContent = `${item.category} · ${item.ownerKind} · ${item.source}:${item.sourceId} · ${item.summary} · event ${item.occurredAt ?? 'unknown'} · observed ${item.observedAt ?? 'unknown'} · fingerprint ${item.fingerprint}`;
                    list.append(row);
                }
                const omitted = document.createElement('p'); omitted.textContent = preview.omissions.join('; ');
                output.replaceChildren(heading, privacy, budget, list, omitted);
                confirmedPreview = preview; explain.disabled = !preview.items.length;
            } catch (error) {
                if (request === this.request && revision === previewRevision)
                    output.textContent = `Preview invalid: ${error instanceof Error ? error.message : 'Unable to verify evidence'}`;
            }
        };
        understanding.append(understandingTitle, action, explanation, output, explain, cancel, result);
        this.content.replaceChildren(header, continueCard, recent, understanding);
    }

    override dispose(): void { this.cancelExplanation(); ++this.request; ++this.navigation; this.rootsListener.dispose(); super.dispose(); }
}
