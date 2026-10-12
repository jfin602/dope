import { BaseWidget, Message, codicon } from '@theia/core/lib/browser/widgets/widget';
import type { DeveloperSessionService } from '@dope/contracts/lib/developer-session-service';
import type { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { DeveloperSessionController } from './developer-session-controller';
import { visibleSessions, sessionListState, sessionOverview } from './developer-session-presentation';

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

export class DeveloperSessionWidget extends BaseWidget {
    readonly controller: DeveloperSessionController;
    private readonly status = element('p');
    private readonly list = element('div');
    private readonly overview = element('section');
    private readonly createForm = element('form');
    private readonly filter = element('input');
    private attachedOnce = false;

    constructor(connect: () => DeveloperSessionService & { dispose(): void | Promise<void> }, workspace: WorkspaceService) {
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
        refresh.addEventListener('click', () => void this.controller.refresh());
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
            row.addEventListener('click', () => controller.select(session.id));
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
        form.addEventListener('submit', event => { event.preventDefault(); void this.controller.saveSelected(field); });
        this.overview.append(form);
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        if (!this.attachedOnce) { this.attachedOnce = true; void this.controller.attach(); }
    }

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
