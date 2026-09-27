import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandContribution, CommandRegistry, MenuContribution, MenuModelRegistry } from '@theia/core/lib/common';
import { AbstractViewContribution, ApplicationShell, FrontendApplication, FrontendApplicationContribution, StatusBar, StatusBarAlignment, ViewContainer, WidgetFactory, WidgetManager } from '@theia/core/lib/browser';
import { BaseWidget } from '@theia/core/lib/browser/widgets/widget';
import { WindowTitleService } from '@theia/core/lib/browser/window/window-title-service';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import { NavigatorWidgetFactory } from '@theia/navigator/lib/browser/navigator-widget-factory';
import { OpenEditorsWidget } from '@theia/navigator/lib/browser/open-editors-widget/navigator-open-editors-widget';
import { WorkspaceMode, WorkspaceModeService, parseWorkspaceMode } from '@dope/contracts';
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

export const spikeWidgetFactories: WidgetFactory[] = [
    { id: PROJECT_MIND_ID, createWidget: () => new DopeSpikeWidget(PROJECT_MIND_ID, 'Project Mind', 'Project Mind', 'A place for durable project knowledge. Spike view; persistence arrives in P3.') },
    { id: PLANNING_ID, createWidget: () => new DopeSpikeWidget(PLANNING_ID, 'Planning', 'Planning', 'A focused surface for decisions and plans. Spike view; live planning arrives later.') }
];
