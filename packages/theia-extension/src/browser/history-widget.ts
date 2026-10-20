import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import type { HistoryEntry, HistoryNavigableOwnerRef } from '@dope/contracts/lib/history';
import type { HistoryService, HistorySnapshot } from '@dope/contracts/lib/history-service';
import { HISTORY_PREVIEW_MAX_ITEMS } from '@dope/contracts/lib/history-context-preview';
import type { HistorySelection } from '@dope/contracts/lib/history-context-preview';
import type { HistoryContextPreview } from '@dope/contracts/lib/history-context-preview';
import { navigateHistory, type HistoryNavigationOwners } from './history-navigation';
import { historyFocusDescription, historyPreviewDescription, historyReadableTime } from './history-presentation';

export const HISTORY_WIDGET_ID = 'dope-history';
const HISTORY_LOAD_TIMEOUT_MS = 15_000;
function boundedHistoryRead<T>(work: Promise<T>, stage: string): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${stage} did not respond; check the backend connection and retry.`)), HISTORY_LOAD_TIMEOUT_MS);
        work.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
    });
}
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
            const roots = await boundedHistoryRead(this.workspaces.roots, 'Workspace roots');
            if (this.isDisposed || request !== this.request) return;
            if (roots.length !== 1 || roots[0].resource.scheme !== 'file') {
                this.status.textContent = 'History is available for one local project folder.';
                return;
            }
            const service = this.connect();
            const { projectHandle } = await boundedHistoryRead(service.attach(roots[0].resource.toString()), 'History attach');
            const snapshot = await boundedHistoryRead(service.read(projectHandle), 'History read');
            if (this.isDisposed || request !== this.request) return;
            const currentRoots = await boundedHistoryRead(this.workspaces.roots, 'Workspace roots');
            if (this.isDisposed || request !== this.request) return;
            if (currentRoots.length !== 1 || currentRoots[0].resource.toString() !== roots[0].resource.toString())
                throw new Error('Project changed while loading History; refresh for the current project.');
            this.projectUri = roots[0].resource.toString();
            this.handle = projectHandle;
            this.render(snapshot);
        } catch (error) {
            if (this.isDisposed || request !== this.request) return;
            this.status.textContent = 'History unavailable';
            const panel = document.createElement('section'); panel.className = 'dope-history-diagnostics';
            const heading = document.createElement('h2'); heading.textContent = 'History could not load';
            const guidance = document.createElement('p');
            guidance.textContent = error instanceof Error && error.message.includes('did not respond') ?
                'Check the backend connection. After restarting the backend, reload Dope and refresh History. No source data was changed.' :
                'Check this project’s metadata and read permissions, then refresh History. No source data was changed.';
            const details = document.createElement('details');
            const summary = document.createElement('summary'); summary.textContent = 'Technical detail';
            const message = document.createElement('code');
            message.textContent = error instanceof Error ? error.message : 'Unable to read project metadata';
            details.append(summary, message);
            const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Refresh History';
            retry.onclick = () => { void this.refresh(); };
            panel.append(heading, guidance, details, retry);
            this.content.replaceChildren(panel);
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
        const diagnosticPanel = document.createElement('section');
        if (snapshot.diagnostics.length || snapshot.truncated) {
            diagnosticPanel.className = 'dope-history-diagnostics';
            const summary = document.createElement('p');
            summary.textContent = 'Some History sources could not be read completely. Refresh after checking the source data or file access.';
            diagnosticPanel.append(summary);
            const list = document.createElement('ul');
            for (const diagnostic of snapshot.diagnostics) {
                const item = document.createElement('li');
                const source = document.createElement('strong'); source.textContent = sourceNames[diagnostic.source];
                const guidance = document.createElement('span');
                guidance.textContent = diagnostic.source === 'git' ? 'Check the project Git repository, then refresh.' :
                    diagnostic.source === 'workbench' ? 'Open a valid target and refresh; inspect History focus metadata if this persists.' :
                        `Check this project's ${sourceNames[diagnostic.source]} metadata and read permissions, then refresh.`;
                const details = document.createElement('details');
                const technical = document.createElement('summary'); technical.textContent = 'Technical detail';
                const message = document.createElement('code'); message.textContent = diagnostic.message;
                details.append(technical, message); item.append(source, guidance, details); list.append(item);
            }
            if (snapshot.truncated && !snapshot.diagnostics.some(item => /truncat|limit/iu.test(item.message))) {
                const item = document.createElement('li'); item.textContent = 'Results are limited. Refresh after reducing source records.';
                list.append(item);
            }
            diagnosticPanel.append(list);
        }
        const continueCard = document.createElement('section'); continueCard.className = 'dope-history-continue';
        const focus = historyFocusDescription(snapshot.continueWith, snapshot.entries);
        const continueTitle = document.createElement('h3'); continueTitle.textContent = focus.heading;
        continueCard.append(continueTitle);
        if (focus.destination) {
            const destination = document.createElement('strong'); destination.className = 'dope-history-destination';
            destination.textContent = focus.destination; continueCard.append(destination);
        }
        const continueText = document.createElement('p'); continueText.textContent = focus.message;
        continueCard.append(continueText);
        if (focus.time) {
            const time = document.createElement('small'); time.textContent = `Last focused ${historyReadableTime(focus.time)}`;
            time.title = focus.time; continueCard.append(time);
        }
        if (snapshot.continueWith.kind === 'verified-focus' || snapshot.continueWith.kind === 'recent-activity-suggestion') {
            const choice = snapshot.continueWith;
            const button = document.createElement('button'); button.type = 'button';
            button.textContent = choice.kind === 'verified-focus' ? 'Continue' : 'Open suggestion';
            button.setAttribute('aria-label', choice.kind === 'verified-focus' ? `Continue to ${focus.destination ?? focus.heading}` : 'Open suggested recent activity');
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
            const empty = document.createElement('p'); empty.textContent = snapshot.diagnostics.length || snapshot.truncated ?
                'No activity could be shown from the available sources. Review the diagnostics above and refresh.' :
                'No recent project activity yet. Open a file to set Continue, or use Chat or Work to build recent activity.';
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
                const privacy = document.createElement('p');
                privacy.textContent = 'Selected project metadata only. No model call or external transfer.';
                const list = document.createElement('ol'); list.className = 'dope-history-preview-items';
                preview.items.forEach((item, index) => {
                    const description = historyPreviewDescription(item);
                    const row = document.createElement('li');
                    const title = document.createElement('h5'); title.textContent = `${index + 1}. ${description.title}`;
                    const summary = document.createElement('p'); summary.textContent = description.summary;
                    const status = document.createElement('p'); status.textContent = `Known status: ${description.status}`;
                    const uncertainty = document.createElement('p'); uncertainty.textContent = description.uncertainty;
                    row.append(title, summary, status);
                    if (description.time) {
                        const time = document.createElement('p'); time.textContent = description.time;
                        row.append(time);
                    }
                    row.append(uncertainty);
                    const details = document.createElement('details');
                    const detailsLabel = document.createElement('summary'); detailsLabel.textContent = 'Technical evidence details';
                    const metadata = document.createElement('dl');
                    const fields = [
                        ['Category', item.category], ['Owner type', item.ownerKind], ['Source', item.source],
                        ['Source ID', item.sourceId], ['Original metadata summary', item.summary],
                        ['Event timestamp', item.occurredAt ?? 'unknown'],
                        ['Observation timestamp', item.observedAt ?? 'unknown'], ['Fingerprint', item.fingerprint]
                    ];
                    for (const [label, value] of fields) {
                        const term = document.createElement('dt'); term.textContent = label;
                        const definition = document.createElement('dd'); definition.textContent = value;
                        metadata.append(term, definition);
                    }
                    details.append(detailsLabel, metadata); row.append(details); list.append(row);
                });
                const omitted = document.createElement('p');
                omitted.textContent = preview.omissions.length ? preview.omissions.join('; ') : '';
                const technical = document.createElement('details');
                const technicalLabel = document.createElement('summary'); technicalLabel.textContent = 'Technical evidence details for preview';
                const budget = document.createElement('p');
                budget.textContent = `${preview.items.length} items · ${preview.bytes}/${4096} bytes · estimated ${preview.estimatedTokens}/${1024} tokens · basis ${preview.evidenceBasis} · project ${preview.projectId}`;
                const privacyContract = document.createElement('p'); privacyContract.textContent = preview.privacy;
                technical.append(technicalLabel, budget, privacyContract);
                output.replaceChildren(heading, privacy, list, omitted, technical);
                confirmedPreview = preview; explain.disabled = !preview.items.length;
            } catch (error) {
                if (request === this.request && revision === previewRevision)
                    output.textContent = `Preview invalid: ${error instanceof Error ? error.message : 'Unable to verify evidence'}`;
            }
        };
        understanding.append(understandingTitle, action, explanation, output, explain, cancel, result);
        this.content.replaceChildren(header, diagnosticPanel, continueCard, recent, understanding);
    }

    override dispose(): void { this.cancelExplanation(); ++this.request; ++this.navigation; this.rootsListener.dispose(); super.dispose(); }
}
