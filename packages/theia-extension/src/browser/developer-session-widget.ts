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
        const label = element('label', 'Filter sessions');
        this.filter.type = 'search';
        this.filter.placeholder = 'Find by title';
        this.filter.addEventListener('input', () => this.render());
        label.append(this.filter);
        this.status.setAttribute('role', 'status');
        const layout = element('div', undefined, 'dope-session-layout');
        const selector = element('nav');
        selector.setAttribute('aria-label', 'Project sessions');
        selector.append(label, this.status, this.list);
        this.overview.setAttribute('aria-label', 'Selected session overview');
        layout.append(selector, this.overview);
        this.node.append(toolbar, layout);
        this.render();
    }

    private render(): void {
        const controller = this.controller;
        const sessions = visibleSessions(controller.snapshot?.sessions ?? [], this.filter.value);
        this.status.textContent = sessionListState(controller, sessions);
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
            element('p', `Last updated: ${dateLabel(overview.updatedAt)}`),
            element('h4', 'Objective'), element('p', overview.objective || 'No objective recorded.'),
            element('h4', 'Notes'), element('p', overview.notes || 'No notes recorded.'),
            element('h4', 'Next actions'));
        if (overview.nextActions.length) {
            const actions = element('ul');
            for (const action of overview.nextActions) actions.append(element('li', action));
            this.overview.append(actions);
        } else this.overview.append(element('p', 'No next actions recorded.'));
        this.overview.append(element('p', `${overview.links} linked artifact${overview.links === 1 ? '' : 's'}.`));
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
