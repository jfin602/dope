import { BaseWidget, Message, codicon } from '@theia/core/lib/browser/widgets/widget';
import type { DeveloperSessionService } from '@dope/contracts/lib/developer-session-service';
import type { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import type { SessionArtifactRef } from '@dope/contracts/lib/developer-session';
import { DeveloperSessionController } from './developer-session-controller';
import { visibleSessions, sessionListState, sessionOverview, sessionLinkGroups } from './developer-session-presentation';
import { navigateSessionArtifact, type SessionNavigationOwners } from './developer-session-navigation';

export const DEVELOPER_SESSION_ID = 'dope-developer-sessions';
export const DEVELOPER_SESSION_LAUNCHER_ID = 'dope-developer-sessions-launcher';

function element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function dateLabel(value: string): string {
    const time = Date.parse(value);
    return Number.isFinite(time) ? new Date(time).toLocaleString() : value;
}

const linkKinds: SessionArtifactRef['kind'][] = ['chat', 'planning-map', 'work-item', 'agent-task',
    'agent-run', 'agent-sequence', 'project-mind'];
const kindNames: Record<SessionArtifactRef['kind'], string> = {
    chat: 'Chats', 'planning-map': 'Planning Maps', 'work-item': 'WorkItems',
    'agent-task': 'AgentTasks', 'agent-run': 'AgentRuns', 'agent-sequence': 'AgentTaskSequences',
    'project-mind': 'Project Mind',
};

function linkLabel(ref: SessionArtifactRef): string {
    switch (ref.kind) {
        case 'chat': return `Chat · ${ref.chatId}`;
        case 'planning-map': return `Planning Map · ${ref.mapId}`;
        case 'work-item': return `WorkItem · ${ref.mapId} / ${ref.workItemId}`;
        case 'agent-task': return `AgentTask · ${ref.taskId}`;
        case 'agent-run': return `AgentRun · ${ref.taskId} / ${ref.runId}`;
        case 'agent-sequence': return `AgentTaskSequence · ${ref.sequenceId}`;
        case 'project-mind': return `Project Mind ${ref.artifactType} · ${ref.artifactId}`;
    }
}

export class DeveloperSessionWidget extends BaseWidget {
    readonly controller: DeveloperSessionController;
    private readonly status = element('p');
    private readonly list = element('div');
    private readonly overview = element('section');
    private readonly createForm = element('form');
    private readonly filter = element('input');
    private attachedOnce = false;

    constructor(connect: () => DeveloperSessionService & { dispose(): void | Promise<void> }, workspace: WorkspaceService,
        private readonly navigation: SessionNavigationOwners) {
        super();
        this.id = DEVELOPER_SESSION_ID;
        this.title.label = 'Sessions';
        this.title.caption = 'Development Sessions';
        this.title.iconClass = codicon('layers');
        this.title.closable = true;
        this.node.tabIndex = -1;
        this.addClass('dope-session-view');
        this.controller = new DeveloperSessionController(connect, workspace, () => this.render());

        const heading = element('h2', 'Development Sessions');
        const refresh = element('button', 'Refresh');
        refresh.type = 'button';
        refresh.addEventListener('click', () => void this.refresh());
        const toolbar = element('header');
        toolbar.append(heading, refresh);
        this.createForm.addEventListener('submit', event => { event.preventDefault(); void this.controller.create(); });
        const label = element('label', 'Filter sessions');
        this.filter.type = 'search';
        this.filter.placeholder = 'Find by title';
        this.filter.addEventListener('input', () => this.render());
        label.append(this.filter);
        this.status.setAttribute('role', 'status');
        const layout = element('div', undefined, 'dope-session-layout');
        const selector = element('nav');
        selector.setAttribute('aria-label', 'Project sessions');
        selector.append(label, this.status, this.createForm, this.list);
        this.overview.setAttribute('aria-label', 'Selected session overview');
        layout.append(selector, this.overview);
        this.node.append(toolbar, layout);
        this.render();
    }

    private render(): void {
        const controller = this.controller;
        const sessions = visibleSessions(controller.snapshot?.sessions ?? [], this.filter.value);
        this.status.textContent = controller.pending ? 'Saving Session…' : sessionListState(controller, sessions);
        this.createForm.replaceChildren();
        const createTitle = this.input('New Session title', controller.createDraft.title, 160,
            value => controller.setCreateDraft('title', value));
        const createObjective = this.input('New Session objective', controller.createDraft.objective, 4000,
            value => controller.setCreateDraft('objective', value), true);
        const createButton = element('button', controller.pending ? 'Saving…' : 'New Session');
        createButton.type = 'submit';
        createButton.disabled = !controller.attached || controller.pending || controller.loading;
        this.createForm.append(createTitle, createObjective, createButton);
        this.list.replaceChildren();
        for (const session of sessions) {
            const row = element('button', undefined, 'dope-session-row');
            row.type = 'button';
            row.setAttribute('aria-current', session.id === controller.selectedId ? 'true' : 'false');
            row.append(element('strong', session.title),
                element('span', `${session.status} · Updated ${dateLabel(session.updatedAt)}`));
            row.addEventListener('click', () => {
                if (controller.select(session.id)) void controller.resolveSelected();
            });
            this.list.append(row);
        }
        this.overview.replaceChildren();
        const selected = controller.selected;
        if (!selected) {
            this.overview.append(element('p', controller.snapshot?.sessions.length ?
                'Select a session to inspect its metadata.' : 'Sessions organize existing project work.'));
            return;
        }
        const overview = sessionOverview(selected);
        this.overview.append(element('h3', overview.title), element('p', `Status: ${overview.status}`),
            element('p', `Last updated: ${dateLabel(overview.updatedAt)}`));
        if (selected.status !== 'closed') {
            const draft = controller.selectedDraft!;
            this.editor('Title', draft.title, 160, value => controller.setSelectedDraft('title', value), 'title');
            this.editor('Objective', draft.objective, 4000, value => controller.setSelectedDraft('objective', value), 'objective', true);
            this.editor('Notes', draft.notes, 16000, value => controller.setSelectedDraft('notes', value), 'notes', true);
            this.editor('Next actions (one per line)', draft.nextActions.join('\n'), 50050,
                value => controller.setSelectedDraft('nextActions', value.split('\n').filter(line => line.length > 0)),
                'nextActions', true);
        } else {
            this.overview.append(element('p', 'Closed Session: read-only.'),
                element('h4', 'Objective'), element('p', overview.objective || 'No objective recorded.'),
                element('h4', 'Notes'), element('p', overview.notes || 'No notes recorded.'),
                element('h4', 'Next actions'));
        }
        if (overview.nextActions.length) {
            const actions = element('ul');
            for (const action of overview.nextActions) actions.append(element('li', action));
            this.overview.append(actions);
        } else this.overview.append(element('p', 'No next actions recorded.'));
        this.overview.append(element('p', `${overview.links} linked artifact${overview.links === 1 ? '' : 's'}.`));
        if (controller.notice) {
            const notice = element('p', controller.notice);
            notice.setAttribute('role', 'status');
            this.overview.append(notice);
        }
        for (const group of sessionLinkGroups(selected, controller.revision, controller.resolution)) {
            const section = element('section');
            section.append(element('h4', kindNames[group.kind]));
            const links = element('ul');
            for (const { ref, resolution } of group.entries) {
                const row = element('li');
                row.append(element('strong', linkLabel(ref)));
                if (ref.kind === 'chat' || ref.kind === 'planning-map' || ref.kind === 'work-item' ||
                    ref.kind === 'agent-task' || ref.kind === 'agent-run' || ref.kind === 'agent-sequence' ||
                    ref.kind === 'project-mind') {
                    const open = element('button', 'Open in owner');
                    open.type = 'button';
                    open.disabled = !resolution || resolution.availability !== 'resolved';
                    open.setAttribute('aria-label', `Open ${linkLabel(ref)} in owner panel`);
                    open.addEventListener('click', () => void this.navigate(ref));
                    row.append(open);
                }
                if (resolution) {
                    row.append(element('span', ` · ${resolution.availability}`));
                    if (resolution.title) row.append(element('span', ` · ${resolution.title}`));
                    if (resolution.objective) row.append(element('span', ` · ${resolution.objective}`));
                    if (resolution.status) row.append(element('span', ` · ${resolution.status}`));
                    if (resolution.validationStatus) row.append(element('span', ` · Validation: ${resolution.validationStatus}`));
                    if (resolution.reviewDecision) row.append(element('span', ` · Review: ${resolution.reviewDecision}`));
                    if (resolution.promotionStatus) row.append(element('span', ` · Promotion: ${resolution.promotionStatus}`));
                    row.append(element('p', resolution.diagnostic));
                } else row.append(element('span', controller.error
                    ? ' · Owner metadata unavailable; refresh to retry.' : ' · Resolving owner metadata…'));
                if (selected.status !== 'closed') {
                    const detach = element('button', 'Detach');
                    detach.type = 'button';
                    detach.disabled = controller.pending;
                    detach.setAttribute('aria-label', `Detach ${linkLabel(ref)}`);
                    detach.addEventListener('click', () => void this.detach(ref));
                    row.append(detach);
                }
                links.append(row);
            }
            section.append(links);
            this.overview.append(section);
        }
        if (selected.status !== 'closed') this.renderLinkForm();
    }

    private async refresh(): Promise<void> {
        if (await this.controller.refresh()) await this.controller.resolveSelected();
    }

    private async navigate(ref: SessionArtifactRef): Promise<void> {
        const controller = this.controller;
        const workspace = controller.workspace, collection = controller.snapshot, session = controller.selected;
        if (!workspace || !collection || !session || !await controller.resolveSelected()) return;
        const current = () => !this.isDisposed && controller.workspace === workspace &&
            controller.snapshot === collection && controller.selected?.id === session.id &&
            controller.selected?.revision === session.revision;
        const result = await navigateSessionArtifact({ workspace, collection, session,
            resolution: controller.resolution, current }, ref, this.navigation);
        if (current()) { controller.notice = result.message; this.render(); }
    }

    private async detach(ref: SessionArtifactRef): Promise<void> {
        if (await this.controller.detachLink(ref)) await this.controller.resolveSelected();
    }

    private async attachLink(): Promise<void> {
        if (await this.controller.attachLink()) await this.controller.resolveSelected();
    }

    private async saveSelected(field: 'title' | 'objective' | 'notes' | 'nextActions'): Promise<void> {
        if (await this.controller.saveSelected(field)) await this.controller.resolveSelected();
    }

    private renderLinkForm(): void {
        const draft = this.controller.selectedLinkDraft!;
        const form = element('form');
        form.setAttribute('aria-label', 'Link existing artifact by ID');
        form.append(element('h4', 'Link existing artifact'));
        const kindLabel = element('label', 'Artifact type');
        const kind = element('select');
        for (const value of linkKinds) {
            const option = element('option', value);
            option.value = value;
            kind.append(option);
        }
        kind.value = draft.kind;
        kind.disabled = this.controller.pending;
        kind.addEventListener('change', () => {
            this.controller.setLinkDraft('kind', kind.value as SessionArtifactRef['kind']);
            this.render();
        });
        kindLabel.append(kind);
        form.append(kindLabel);
        const field = (label: string, key: 'chatId' | 'mapId' | 'workItemId' | 'taskId' | 'runId' |
            'sequenceId' | 'artifactId') => form.append(this.input(label, draft[key], 4096,
            value => this.controller.setLinkDraft(key, value)));
        switch (draft.kind) {
            case 'chat': field('Existing Chat ID', 'chatId'); break;
            case 'planning-map': field('Existing Planning Map ID', 'mapId'); break;
            case 'work-item': field('Planning Map ID', 'mapId'); field('WorkItem ID', 'workItemId'); break;
            case 'agent-task': field('Existing AgentTask ID', 'taskId'); break;
            case 'agent-run': field('AgentTask ID', 'taskId'); field('AgentRun ID', 'runId'); break;
            case 'agent-sequence': field('Existing AgentTaskSequence ID', 'sequenceId'); break;
            case 'project-mind': {
                const typeLabel = element('label', 'Project Mind artifact type');
                const type = element('select');
                for (const value of ['decision', 'idea'] as const) {
                    const option = element('option', value);
                    option.value = value;
                    type.append(option);
                }
                type.value = draft.artifactType;
                type.disabled = this.controller.pending;
                type.addEventListener('change', () => this.controller.setLinkDraft('artifactType',
                    type.value as 'decision' | 'idea'));
                typeLabel.append(type);
                form.append(typeLabel);
                field('Existing Project Mind artifact ID', 'artifactId');
                break;
            }
        }
        const browse = element('button', this.controller.candidatesLoading ? 'Browsing…' : 'Browse existing');
        browse.type = 'button';
        browse.disabled = this.controller.candidatesLoading || this.controller.pending;
        browse.addEventListener('click', () => void this.controller.browseCandidates());
        form.append(browse);
        const result = this.controller.candidates;
        if (result?.kind === draft.kind) {
            const status = element('p', result.diagnostic || `${result.candidates.length} existing artifacts available.`);
            status.setAttribute('role', 'status');
            form.append(status);
            if (result.availability === 'ready' && result.candidates.length) {
                const pickerLabel = element('label', 'Choose existing artifact');
                const picker = element('select');
                const placeholder = element('option', 'Select an artifact');
                placeholder.value = '';
                picker.append(placeholder);
                result.candidates.forEach((candidate, index) => {
                    const option = element('option', candidate.label);
                    option.value = String(index);
                    picker.append(option);
                });
                picker.addEventListener('change', () => {
                    if (picker.value) this.controller.chooseCandidate(Number(picker.value));
                });
                pickerLabel.append(picker);
                form.append(pickerLabel);
            }
        }
        const submit = element('button', this.controller.pending ? 'Linking…' : 'Attach link');
        submit.type = 'submit';
        submit.disabled = this.controller.pending;
        form.append(submit);
        form.addEventListener('submit', event => { event.preventDefault(); void this.attachLink(); });
        this.overview.append(form);
    }

    private input(label: string, value: string, maxLength: number, changed: (value: string) => void,
        multiline = false): HTMLLabelElement {
        const wrapper = element('label', label);
        const control = multiline ? element('textarea') : element('input');
        control.value = value;
        control.maxLength = maxLength;
        control.disabled = this.controller.pending;
        control.addEventListener('input', () => changed(control.value));
        wrapper.append(control);
        return wrapper;
    }

    private editor(label: string, value: string, maxLength: number, changed: (value: string) => void,
        field: 'title' | 'objective' | 'notes' | 'nextActions', multiline = false): void {
        const form = element('form');
        form.append(this.input(label, value, maxLength, changed, multiline));
        const save = element('button', this.controller.pending ? 'Saving…' : `Save ${label.split(' (')[0]}`);
        save.type = 'submit';
        save.disabled = this.controller.pending;
        form.append(save);
        form.addEventListener('submit', event => { event.preventDefault(); void this.saveSelected(field); });
        this.overview.append(form);
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        if (!this.attachedOnce) { this.attachedOnce = true; void this.controller.attach(); }
    }

    storeState(): object { return this.controller.layoutSelection() ?? {}; }

    restoreState(state: object): void { this.controller.restoreSelection(state); }

    protected override onActivateRequest(msg: Message): void { super.onActivateRequest(msg); this.node.focus(); }

    override dispose(): void { this.controller.dispose(); super.dispose(); }
}

/** Activity Bar entry; the center widget remains the only Session workspace. */
export class DeveloperSessionsLauncherWidget extends BaseWidget {
    constructor(open: () => Promise<unknown>) {
        super();
        this.id = DEVELOPER_SESSION_LAUNCHER_ID;
        this.title.label = 'Sessions';
        this.title.caption = 'Open Development Sessions';
        this.title.iconClass = codicon('layers');
        this.addClass('dope-session-launcher');
        const button = element('button', 'Open Sessions');
        button.type = 'button';
        button.addEventListener('click', () => void open());
        this.node.append(button);
    }
}
