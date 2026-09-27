import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { AbstractViewContribution, ApplicationShell, FrontendApplication, FrontendApplicationContribution, StatusBar, StatusBarAlignment, ViewContainer, WidgetManager } from '@theia/core/lib/browser';
import type { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { BaseWidget } from '@theia/core/lib/browser/widgets/widget';
import { WindowTitleService } from '@theia/core/lib/browser/window/window-title-service';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { NavigatorWidgetFactory } from '@theia/navigator/lib/browser/navigator-widget-factory';
import { OpenEditorsWidget } from '@theia/navigator/lib/browser/open-editors-widget/navigator-open-editors-widget';
import { WorkspaceMode, WorkspaceModeService, parseWorkspaceMode } from '@dope/contracts';
import type { Note } from '@dope/contracts/lib/note';
import type { NoteClient, NoteService } from '@dope/contracts/lib/note-service';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
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

export class ProjectMindWidget extends DopeSpikeWidget {
    private readonly titleInput = document.createElement('input');
    private readonly bodyInput = document.createElement('textarea');
    private readonly state = document.createElement('p');
    private readonly identity = document.createElement('small');
    private workspaceUri: string | undefined;
    private readonly rootsListener;
    private readonly client: NoteClient = { notifyNoteChanged: (workspaceUri, note) => {
        if (workspaceUri === this.workspaceUri) this.render(note);
    } };

    constructor(private readonly notes: NoteService & RpcServer<NoteClient>, private readonly workspaceService: WorkspaceService) {
        super(PROJECT_MIND_ID, 'Project Mind', 'Project Mind', 'Spike Note in this workspace.');
        this.titleInput.placeholder = 'Note title';
        this.titleInput.setAttribute('aria-label', 'Spike Note title');
        this.bodyInput.placeholder = 'Note body';
        this.bodyInput.setAttribute('aria-label', 'Spike Note body');
        const save = document.createElement('button');
        save.textContent = 'Save spike Note';
        save.onclick = () => void this.save();
        this.node.append(this.titleInput, this.bodyInput, save, this.identity, this.state);
        this.notes.setClient(this.client);
        this.rootsListener = workspaceService.onWorkspaceChanged(() => void this.load());
        void this.load();
    }

    private async load(): Promise<void> {
        const roots = await this.workspaceService.roots;
        this.workspaceUri = roots.length === 1 ? roots[0].resource.toString() : undefined;
        this.render(undefined);
        if (!this.workspaceUri) {
            this.state.textContent = 'Open one local folder to use the spike Note.';
            return;
        }
        const uri = this.workspaceUri;
        try {
            const note = await this.notes.read(uri);
            if (this.workspaceUri === uri) this.render(note);
        } catch (error) { if (this.workspaceUri === uri) this.state.textContent = String(error); }
    }

    private render(note: Note | undefined): void {
        this.titleInput.value = note?.title ?? '';
        this.bodyInput.value = note?.body ?? '';
        this.identity.textContent = note ? `Note ID: ${note.id}` : '';
        this.state.textContent = note ? 'Saved developer Note' : 'No spike Note yet.';
    }

    private async save(): Promise<void> {
        if (!this.workspaceUri) return;
        try { this.render(await this.notes.save(this.workspaceUri, { title: this.titleInput.value, body: this.bodyInput.value })); }
        catch (error) { this.state.textContent = String(error); }
    }

    override dispose(): void {
        this.rootsListener.dispose();
        this.notes.setClient(undefined);
        super.dispose();
    }
}

@injectable()
export class ProjectMindView extends AbstractViewContribution<DopeSpikeWidget> {
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
    @inject(ProjectMindView) protected readonly projectMind!: ProjectMindView;
    @inject(PlanningView) protected readonly planning!: PlanningView;
    @inject(ApplicationShell) protected readonly shell!: ApplicationShell;
    @inject(StatusBar) protected readonly statusBar!: StatusBar;
    @inject(WidgetManager) protected readonly widgets!: WidgetManager;

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

    async initializeLayout(): Promise<void> {
        await this.projectMind.openView({ reveal: true });
    }

    async onDidInitializeLayout(_app: FrontendApplication): Promise<void> {
        // Open Editors duplicates the main editor tabs in this spike's compact explorer.
        const explorer = await this.widgets.getOrCreateWidget<ViewContainer>(NavigatorWidgetFactory.ID);
        const openEditors = this.widgets.tryGetWidget<OpenEditorsWidget>(OpenEditorsWidget.ID);
        if (openEditors) explorer.removeWidget(openEditors);
        let storedMode: string | null = null;
        try { storedMode = window.localStorage.getItem('dope.workspaceMode'); } catch { /* Storage may be disabled. */ }
        await this.applyMode(parseWorkspaceMode(storedMode));
    }

    async applyMode(mode: WorkspaceMode): Promise<void> {
        if (mode === WorkspaceMode.PLAN) {
            await this.planning.openView({ activate: true });
            await this.shell.collapsePanel('right');
        } else {
            if (this.planning.tryGetWidget()?.isAttached) await this.planning.closeView();
            await this.projectMind.openView({ reveal: true });
        }
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
