import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { AbstractViewContribution, FrontendApplicationContribution, StatusBar, StatusBarAlignment } from '@theia/core/lib/browser';
import { BaseWidget } from '@theia/core/lib/browser/widgets/widget';
import { Message } from '@theia/core/lib/browser/widgets/widget';
import { WindowTitleService } from '@theia/core/lib/browser/window/window-title-service';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { WorkspaceMode, WorkspaceModeService, parseWorkspaceMode } from '@dope/contracts';
import type { Artifact, ArtifactLink, ArtifactStatus } from '@dope/contracts/lib/project-mind';
import { queryArtifacts } from '@dope/project-intelligence';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { OpenerService, open } from '@theia/core/lib/browser';
import { ConfirmDialog, ConfirmSaveDialog, SingleTextInputDialog } from '@theia/core/lib/browser/dialogs';
import URI from '@theia/core/lib/common/uri';
import { MindConnection, ProjectMindController } from './project-mind-controller';
import './dope.css';

export const PROJECT_MIND_ID = 'dope-project-mind';
export const PLANNING_ID = 'dope-planning';

export class DopeSpikeWidget extends BaseWidget {
    constructor(id: string, label: string, heading: string, detail: string) {
        super();
        this.id = id;
        this.title.label = label;
        this.title.caption = label;
        this.title.closable = true;
        this.addClass('dope-spike-view');
        const eyebrow = document.createElement('p');
        eyebrow.className = 'dope-spike-eyebrow';
        eyebrow.textContent = 'DOPE / FOUNDATION SPIKE';
        const title = document.createElement('h2');
        title.textContent = heading;
        const copy = document.createElement('p');
        copy.textContent = detail;
        this.node.append(eyebrow, title, copy);
    }
}

export class ProjectMindWidget extends BaseWidget {
    readonly controller: ProjectMindController;
    private readonly rootsListener;
    private readonly status = document.createElement('p');
    private readonly list = document.createElement('div');
    private readonly editor = document.createElement('div');
    private readonly search = document.createElement('input');
    private readonly typeFilter = document.createElement('select');
    private readonly statusFilter = document.createElement('select');
    private readonly archived = document.createElement('input');
    private formKey = '';
    private workspaceRequest = 0;
    private fileRequest = 0;
    private readonly beforeUnload = (event: BeforeUnloadEvent) => {
        if (!this.controller.canLeave) { event.preventDefault(); event.returnValue = ''; }
    };

    constructor(connect: () => MindConnection, private readonly workspaceService: WorkspaceService,
        private readonly files: FileService, private readonly opener: OpenerService) {
        super();
        this.id = PROJECT_MIND_ID;
        this.title.label = this.title.caption = 'Project Mind';
        this.title.closable = true;
        this.addClass('dope-spike-view');
        this.addClass('dope-mind-view');
        this.controller = new ProjectMindController(connect, () => this.render());
        const heading = document.createElement('h2');
        heading.textContent = 'Project Mind';
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.search.placeholder = 'Search title and content';
        this.search.setAttribute('aria-label', 'Search Project Mind');
        this.search.oninput = () => this.renderList();
        for (const [select, label, values] of [
            [this.typeFilter, 'Filter type', ['', 'note', 'idea', 'question', 'decision']],
            [this.statusFilter, 'Filter status', ['', 'active', 'captured', 'parked', 'open', 'answered', 'proposed', 'accepted', 'rejected', 'superseded']]
        ] as const) {
            select.setAttribute('aria-label', label);
            for (const value of values) select.add(new Option(value || `All ${label === 'Filter type' ? 'types' : 'statuses'}`, value));
            select.onchange = () => this.renderList();
        }
        this.archived.type = 'checkbox';
        this.archived.onchange = () => this.renderList();
        const archivedLabel = document.createElement('label');
        archivedLabel.append(this.archived, ' Show archived');
        const filters = document.createElement('div');
        filters.className = 'dope-mind-filters';
        filters.append(this.search, this.typeFilter, this.statusFilter, archivedLabel);
        this.node.append(heading, this.status, filters, this.list, this.editor);
        this.rootsListener = workspaceService.onWorkspaceChanged(() => void this.load());
        window.addEventListener('beforeunload', this.beforeUnload);
        void this.load();
    }

    private button(label: string, action: () => void, disabled = false): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.onclick = action;
        return button;
    }

    private async leave(): Promise<boolean> {
        if (this.controller.canLeave) return true;
        if (this.controller.pending) return !!await new ConfirmDialog({ title: 'Project Mind', msg: 'A save is in progress. It may still commit. Leave this editor and inspect the old project before retrying?' }).open();
        const choice = await new ConfirmSaveDialog({ title: 'Unsaved Project Mind draft', msg: 'Save this draft before leaving?', save: 'Save', dontSave: 'Discard', cancel: 'Cancel' }).open();
        if (choice === undefined) return false;
        return choice ? this.controller.save() : this.controller.refresh(true);
    }

    private async load(): Promise<void> {
        const request = ++this.workspaceRequest;
        const roots = await this.workspaceService.roots;
        if (this.isDisposed || request !== this.workspaceRequest) return;
        const workspace = roots.length === 1 ? roots[0].resource.toString() : undefined;
        if (workspace === this.controller.workspace) return;
        if (!await this.leave() || request !== this.workspaceRequest || this.isDisposed) {
            this.status.textContent = 'Workspace changed; draft remains attached to its original project. Use Switch workspace when ready.';
            this.editor.append(this.button('Switch workspace', () => void this.load()));
            return;
        }
        this.formKey = '';
        await this.controller.attach(workspace, true);
    }

    private async navigate(id: string | undefined, type?: Artifact['type']): Promise<void> {
        if (!await this.leave()) return;
        if (this.controller.pending) return;
        if (this.controller.dirty) this.controller.select(this.controller.selectedId);
        this.formKey = '';
        if (type) this.controller.create(type);
        else this.controller.select(id);
        this.editor.querySelector<HTMLInputElement | HTMLTextAreaElement>('input, textarea')?.focus();
    }

    private render(): void {
        const mind = this.controller;
        this.status.textContent = mind.error || (mind.loading ? 'Loading Project Mind…' : mind.pending ? `${mind.pendingOperation ?? 'Operation'} pending; awaiting committed acknowledgement…` :
            mind.stale ? 'Project changed elsewhere. Copy your draft, then reload and reconcile.' :
            mind.dirty ? 'Unsaved draft' : mind.workspace ? mind.snapshot ? `Saved · revision ${mind.revision}` : 'Empty Project Mind. Create an artifact or migrate a legacy Note explicitly.' :
                'Open one local folder to use Project Mind. Multiple roots and remote contexts are unsupported.');
        this.renderList();
        const key = `${mind.workspace}:${mind.revision}:${mind.draft?.id ?? ''}:${mind.selectedId ?? 'new'}`;
        if (key === this.formKey) {
            const buttons = this.editor.querySelectorAll<HTMLButtonElement>('.dope-mind-actions button');
            buttons.forEach((button, index) => { button.disabled = index === 0 ? mind.pending || !mind.dirty || mind.stale : index === 1 ? mind.pending : mind.pending || mind.dirty || mind.stale; });
            this.editor.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach(input => { input.disabled = mind.pending; });
            return;
        }
        this.formKey = key;
        this.editor.replaceChildren();
        if (!mind.workspace || mind.loading) {
            return;
        }
        if (!mind.draft) {
            if (mind.error && !mind.snapshot) this.editor.append(this.button('Retry attachment', () => void mind.attach(mind.workspace)));
            this.editor.append(this.button('Migrate legacy Note', () => void mind.migrate(), !!mind.snapshot || mind.pending || !mind.attached));
            if (mind.snapshot && !mind.selectedId) this.editor.append(document.createTextNode('Select an artifact to edit, or create one.'));
            return;
        }
        const artifact = mind.draft;
        const heading = document.createElement('h3');
        heading.textContent = `${artifact.type.toUpperCase()} · ${artifact.status}${artifact.archivedAt ? ' · archived' : ''}`;
        const identity = document.createElement('small');
        identity.textContent = `ID ${artifact.id} · developer${artifact.migration ? ` · migrated from ${artifact.migration.sourcePath} at ${artifact.migration.migratedAt}` : ''} · created ${artifact.createdAt ?? 'unknown'} · updated ${artifact.updatedAt ?? 'unknown'}`;
        this.editor.append(heading, identity);
        for (const field of artifact.type === 'decision' ? ['title', 'decision', 'context', 'rationale', 'consequences', 'alternatives', 'revisitConditions'] :
            artifact.type === 'question' ? ['title', 'body', 'answer'] : ['title', 'body']) {
            const label = document.createElement('label');
            label.textContent = field.replace(/([A-Z])/g, ' $1');
            const input = field === 'title' ? document.createElement('input') : document.createElement('textarea');
            input.value = String((artifact as unknown as Record<string, unknown>)[field] ?? '');
            input.disabled = mind.pending;
            input.oninput = () => {
                mind.edit(field, input.value);
                this.status.textContent = mind.stale ? 'Project changed elsewhere. Copy your draft, then reload and reconcile.' : 'Unsaved draft';
                actions.querySelectorAll<HTMLButtonElement>('button').forEach((button, index) => { button.disabled = index === 0 ? mind.stale : index > 1; });
            };
            label.append(input);
            this.editor.append(label);
        }
        const actions = document.createElement('div');
        actions.className = 'dope-mind-actions';
        actions.append(this.button('Save', () => void mind.save(), mind.pending || !mind.dirty || mind.stale),
            this.button('Discard / reload', () => void this.discard(), mind.pending));
        if (mind.selectedId) this.renderActions(actions, artifact);
        this.editor.append(actions);
        this.renderLinks(artifact);
    }

    private renderList(): void {
        const mind = this.controller;
        this.list.replaceChildren();
        if (!mind.workspace || mind.loading) return;
        const create = document.createElement('div');
        create.className = 'dope-mind-actions';
        for (const type of ['note', 'idea', 'question', 'decision'] as const) create.append(this.button(`New ${type}`, () => void this.navigate(undefined, type), mind.pending || !mind.attached));
        this.list.append(create);
        if (!mind.snapshot) return;
        const list = document.createElement('ul');
        for (const artifact of queryArtifacts(mind.snapshot, {
            text: this.search.value, types: this.typeFilter.value ? [this.typeFilter.value as Artifact['type']] : undefined,
            statuses: this.statusFilter.value ? [this.statusFilter.value as ArtifactStatus] : undefined, archived: this.archived.checked
        })) {
            const row = document.createElement('li');
            const button = this.button(`${artifact.title || '(untitled)'} · ${artifact.type} · ${artifact.status}`, () => void this.navigate(artifact.id));
            if (artifact.id === mind.selectedId) button.setAttribute('aria-current', 'true');
            row.append(button);
            list.append(row);
        }
        this.list.append(list);
        if (!list.childElementCount) this.list.append(document.createTextNode('No matching artifacts.'));
    }

    private renderActions(actions: HTMLElement, artifact: Artifact): void {
        const mind = this.controller;
        const perform = (operation: Parameters<ProjectMindController['mutate']>[0]) => void mind.mutate(operation);
        const transition = (label: string, status: ArtifactStatus, answer?: string) => actions.append(this.button(label, () => perform({ type: 'transition', artifactId: artifact.id, status, answer }), mind.pending || mind.dirty || mind.stale));
        if (artifact.type === 'idea') transition(artifact.status === 'captured' ? 'Park idea' : 'Recapture idea', artifact.status === 'captured' ? 'parked' : 'captured');
        if (artifact.type === 'question') transition(artifact.status === 'open' ? 'Answer question' : 'Reopen question', artifact.status === 'open' ? 'answered' : 'open', artifact.status === 'open' ? artifact.answer : undefined);
        if (artifact.type === 'decision') {
            if (artifact.status === 'proposed') { transition('Accept decision', 'accepted'); transition('Reject decision', 'rejected'); }
            if (artifact.status === 'rejected') transition('Reopen proposal', 'proposed');
            if (artifact.status === 'accepted') {
                const replacements = mind.snapshot?.artifacts.filter(item => item.type === 'decision' && item.status === 'accepted' && item.id !== artifact.id) ?? [];
                if (replacements.length) {
                    const select = document.createElement('select');
                    select.setAttribute('aria-label', 'Accepted replacement decision');
                    for (const item of replacements) select.add(new Option(item.title || item.id, item.id));
                    actions.append(select, this.button('Supersede with selected decision', () => perform({ type: 'supersede', oldId: artifact.id, replacementId: select.value }), mind.pending || mind.dirty || mind.stale));
                }
            }
        }
        actions.append(this.button(artifact.archivedAt ? 'Unarchive' : 'Archive', () => perform({ type: 'archive', artifactId: artifact.id, archived: !artifact.archivedAt }), mind.pending || mind.dirty || mind.stale));
    }

    private renderLinks(artifact: Artifact): void {
        const section = document.createElement('section');
        const heading = document.createElement('h4');
        heading.textContent = 'Links';
        section.append(heading);
        for (const replacement of this.controller.snapshot?.artifacts.filter(item => item.links.some(link =>
            link.relation === 'supersedes' && link.target.type === 'artifact' && link.target.id === artifact.id)) ?? []) {
            section.append(this.button(`Superseded by · ${replacement.title || replacement.id}`, () => void this.navigate(replacement.id)));
        }
        const request = ++this.fileRequest;
        for (const link of artifact.links) {
            const row = document.createElement('div');
            const target = link.target;
            const name = target.type === 'file' ? `${target.path}${target.line ? `:${target.line}` : ''}` :
                this.controller.snapshot?.artifacts.find(item => item.id === target.id)?.title ?? `${target.id} (unresolved artifact)`;
            const go = this.button(`${link.relation} · ${name}`, () => {
                if (target.type === 'artifact') void this.navigate(target.id);
                else if (this.controller.workspace) void open(this.opener, new URI(this.controller.workspace).resolve(target.path), target.line ? { selection: { start: { line: target.line - 1, character: 0 } } } : undefined);
            });
            if (target.type === 'artifact' && !this.controller.snapshot?.artifacts.some(item => item.id === target.id)) go.disabled = true;
            if (target.type === 'file' && this.controller.workspace) {
                void this.files.exists(new URI(this.controller.workspace).resolve(target.path)).then(exists => {
                    if (request === this.fileRequest && !exists) { go.disabled = true; go.textContent += ' (unresolved file)'; }
                }).catch(() => { if (request === this.fileRequest) { go.disabled = true; go.textContent += ' (file unavailable)'; } });
            }
            row.append(go, this.button('Remove link', () => void this.controller.mutate({ type: 'unlink', artifactId: artifact.id, link }), this.controller.pending || this.controller.dirty || this.controller.stale));
            section.append(row);
        }
        const targets = this.controller.snapshot?.artifacts.filter(item => item.id !== artifact.id) ?? [];
        if (targets.length) {
            const select = document.createElement('select');
            select.setAttribute('aria-label', 'Artifact link target');
            for (const item of targets) select.add(new Option(`${item.title || '(untitled)'} · ${item.type}`, item.id));
            section.append(select, this.button('Link related artifact', () => void this.controller.mutate({ type: 'link', artifactId: artifact.id,
                link: { relation: 'related', target: { type: 'artifact', id: select.value } } }), this.controller.pending || this.controller.dirty || this.controller.stale));
            if (artifact.type === 'note' || artifact.type === 'decision') section.append(this.button('Link as answer to question', () => {
                const target = targets.find(item => item.id === select.value);
                if (target?.type === 'question') void this.controller.mutate({ type: 'link', artifactId: artifact.id,
                    link: { relation: 'answers', target: { type: 'artifact', id: target.id } } });
                else this.status.textContent = 'Select a Question to link an answer.';
            }, this.controller.pending || this.controller.dirty || this.controller.stale));
        }
        section.append(this.button('Link file…', () => void (async () => {
            const value = await new SingleTextInputDialog({ title: 'Project-relative file path (optional :line)', confirmButtonLabel: 'Link file' }).open();
            if (!value) return;
            const match = /^(.*?)(?::(\d+))?$/.exec(value.trim());
            const link: ArtifactLink = { relation: 'related', target: { type: 'file', path: match![1], ...(match![2] ? { line: Number(match![2]) } : {}) } };
            void this.controller.mutate({ type: 'link', artifactId: artifact.id, link });
        })(), this.controller.pending || this.controller.dirty || this.controller.stale));
        this.editor.append(section);
    }

    private async discard(): Promise<void> {
        if (!await new ConfirmDialog({ title: 'Reload Project Mind', msg: 'Discard this draft and reload committed Project Mind state?' }).open()) return;
        this.formKey = '';
        await this.controller.refresh(true);
    }

    protected override onCloseRequest(msg: Message): void {
        if (this.controller.canLeave) { super.onCloseRequest(msg); return; }
        void this.leave().then(leave => {
            if (!leave) return;
            if (this.controller.pending) this.controller.dispose();
            else if (this.controller.dirty) this.controller.select(this.controller.selectedId);
            super.onCloseRequest(msg);
        });
    }

    override dispose(): void {
        ++this.workspaceRequest;
        ++this.fileRequest;
        window.removeEventListener('beforeunload', this.beforeUnload);
        this.rootsListener.dispose();
        this.controller.dispose();
        super.dispose();
    }
}

@injectable()
export class ProjectMindView extends AbstractViewContribution<ProjectMindWidget> {
    constructor() {
        super({ widgetId: PROJECT_MIND_ID, widgetName: 'Project Mind', defaultWidgetOptions: { area: 'right' } });
    }
    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand({ id: 'dope.projectMind.open', label: 'Dope: Show Project Mind' }, {
            execute: () => this.openView({ activate: true })
        });
    }
    override registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.VIEW_VIEWS, { commandId: 'dope.projectMind.open', label: 'Project Mind' });
    }
}

@injectable()
export class PlanningView extends AbstractViewContribution<DopeSpikeWidget> {
    constructor() {
        super({ widgetId: PLANNING_ID, widgetName: 'Planning', defaultWidgetOptions: { area: 'main' } });
    }
    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand({ id: 'dope.planning.open', label: 'Dope: Show Planning' }, {
            execute: () => this.openView({ activate: true })
        });
    }
    override registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.VIEW_VIEWS, { commandId: 'dope.planning.open', label: 'Planning' });
    }
}

@injectable()
export class DopeWindowTitleService extends WindowTitleService {
    @inject(WorkspaceModeService) protected readonly workspaceMode!: WorkspaceModeService;

    protected override init(): void {
        super.init();
        this.workspaceMode.onChange(() => this.update({}));
        this.update({});
    }

    override update(parts: Record<string, string | undefined>): void {
        super.update({ ...parts, appName: `Dope · ${this.workspaceMode.current}` });
    }
}

@injectable()
export class DopeWorkbench implements FrontendApplicationContribution, CommandContribution, MenuContribution {
    @inject(WorkspaceModeService) protected readonly workspaceMode!: WorkspaceModeService;
    @inject(StatusBar) protected readonly statusBar!: StatusBar;

    registerCommands(commands: CommandRegistry): void {
        for (const mode of [WorkspaceMode.BUILD, WorkspaceMode.PLAN]) {
            commands.registerCommand({ id: `dope.mode.${mode.toLowerCase()}`, label: `Dope: ${mode} Mode` }, {
                execute: () => this.applyMode(mode)
            });
        }
        commands.registerCommand({ id: 'dope.mode.toggle', label: 'Dope: Switch Workspace Mode' }, {
            execute: () => this.applyMode(this.workspaceMode.current === WorkspaceMode.BUILD ? WorkspaceMode.PLAN : WorkspaceMode.BUILD)
        });
    }

    registerMenus(menus: MenuModelRegistry): void {
        for (const mode of [WorkspaceMode.BUILD, WorkspaceMode.PLAN]) {
            menus.registerMenuAction(CommonMenus.VIEW_VIEWS, { commandId: `dope.mode.${mode.toLowerCase()}`, label: `${mode} Mode` });
        }
    }

    async onDidInitializeLayout(): Promise<void> {
        let storedMode: string | null = null;
        try { storedMode = window.localStorage.getItem('dope.workspaceMode'); } catch { /* Storage may be disabled. */ }
        await this.applyMode(parseWorkspaceMode(storedMode));
    }

    async applyMode(mode: WorkspaceMode): Promise<void> {
        this.workspaceMode.set(mode);
        try { window.localStorage.setItem('dope.workspaceMode', mode); } catch { /* Keep the mode usable without storage. */ }
        document.body.dataset.dopeMode = mode.toLowerCase();
        await this.statusBar.setElement('dope-workspace-mode', {
            text: `DOPE · ${mode}`,
            name: 'Dope workspace mode',
            tooltip: 'Switch between BUILD and PLAN',
            command: 'dope.mode.toggle',
            alignment: StatusBarAlignment.LEFT,
            priority: 1000,
            className: 'dope-mode-status'
        });
    }
}
