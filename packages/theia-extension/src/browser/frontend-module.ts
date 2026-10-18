import { ContainerModule } from '@theia/core/shared/inversify';
import { injectable } from '@theia/core/shared/inversify';
import { AbstractViewContribution, ApplicationShell, FrontendApplicationContribution, WidgetFactory, WidgetManager, open } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { CommandContribution, CommandRegistry, Emitter, MenuContribution } from '@theia/core/lib/common';
import { WindowTitleService } from '@theia/core/lib/browser/window/window-title-service';
import { bindViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { NoteService, noteServicePath } from '@dope/contracts/lib/note-service';
import { ProjectMindClient, ProjectMindService, projectMindServicePath } from '@dope/contracts/lib/project-mind-service';
import { AgentRuntimeService, agentRuntimeServicePath, type AgentRuntimeClient } from '@dope/contracts/lib/agent-runtime-service';
import type { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { OpenerService } from '@theia/core/lib/browser';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { ThemeService } from '@theia/core/lib/browser/theming';
import { CoreMarkdownRenderer, type MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import { dopeDarkTheme } from './dope-theme';
import './dope.css';
import { DopeWindowTitleService, ProjectMindWidget, PROJECT_MIND_ID } from './dope-workbench';
import { openProjectMindOwner } from './project-mind-navigation';
import { SoftwareMapService, softwareMapServicePath } from '@dope/software-map';
import type { SoftwareMapClient } from '@dope/software-map';
import { SoftwareMapView, SoftwareMapWidget, SOFTWARE_MAP_ID } from './software-map-widget';
import { SoftwareMapController } from './software-map-controller';
import { SoftwareMapReviewWidget, SOFTWARE_MAP_REVIEW_ID } from './software-map-review-widget';
import { PhysicalMapWidget, PHYSICAL_MAP_ID } from './physical-map-widget';
import { physicalMapTabOptions, type PhysicalMapTabOptions } from './physical-map-controller';
import { PlanningMapController } from './planning-map-controller';
import { SmapPresentationState } from './smap-presentation-state';
import { VisualPlanningService, visualPlanningServicePath } from '@dope/visual-planning/lib/service';
import { chatServicePath, type ChatService } from '@dope/chat/lib/service';
import { ModelConnectionsService, modelConnectionsServicePath } from '@dope/contracts/lib/model-connections-service';
import { AICredentialService, aiCredentialServicePath } from '@dope/contracts/lib/ai-credential-service';
import { codexAuthServicePath, type CodexAuthService } from '@dope/contracts/lib/codex-auth-service';
import type { AICredentialClient } from '@dope/contracts/lib/ai-credential-service';
import type { ModelConnectionsClient } from '@dope/contracts/lib/model-connections-service';
import type { ChatClient } from '@dope/chat/lib/service';
import { ChatPanelWidget } from './chat-panel-widget';
import { AgentTranscriptWidget } from './agent-transcript-widget';
import { AGENT_TRANSCRIPT_ID, openAgentTranscript, type AgentTranscriptOptions } from './work-transcript-presentation';
import { bindSharedAgentRuntime } from './agent-runtime-connection';
import { ChatOpenOwners } from './chat-panel-controller';
import { ChatPlanningSelection } from './chat-planning-selection';
import { WorkOpenOwners } from './shared-panel-state';
import { AIRegistryService, aiRegistryServicePath, type AIRegistryClient } from '@dope/contracts/lib/ai-registry-service';
import { AIRolePolicyService, aiRolePolicyServicePath, type AIRolePolicyClient } from '@dope/contracts/lib/ai-role-policy-service';
import type { AIRolePolicyMutationRequest } from '@dope/ai';
import { AICenterWidget, AI_CENTER_ID } from './ai-center-widget';
import { AICenterContribution } from './ai-center-contribution';
import { AICenterBottomMenuWidget } from './ai-center-launcher';
import { SidebarBottomMenuWidget } from '@theia/core/lib/browser/shell/sidebar-bottom-menu-widget';
import { CHAT_PANEL_ID, chatAreas, chatLauncherIds, chatLauncherOptions, workLauncherIds, workLauncherOptions, openChatPanel, type ChatArea, type ChatPanelOptions } from './chat-panel-presentation';
import { historyServicePath, historyFocusServicePath, HistoryService } from '@dope/contracts/lib/history-service';
import { HistoryWidget, HISTORY_WIDGET_ID } from './history-widget';
import { HistoryFocusContribution } from './history-focus-contribution';
import { historyOwnerNavigation } from './history-owner-navigation';
import { RoadmapCanvasWidget, ROADMAP_CANVAS_ID } from './roadmap-canvas-widget';
import { roadmapServicePath, type RoadmapClient, type RoadmapService } from '../roadmap-service';
import { RoadmapInspectorModel } from './roadmap-inspector-model';
import { RoadmapInspectorWidget, ROADMAP_INSPECTOR_ID } from './roadmap-inspector-widget';
import { FileNavigatorWidget } from '@theia/navigator/lib/browser/navigator-widget';
import { createFileNavigatorContainer } from '@theia/navigator/lib/browser/navigator-container';
import { SearchInWorkspaceFrontendContribution } from '@theia/search-in-workspace/lib/browser/search-in-workspace-frontend-contribution';
import { ExplorerSearchWidget } from './explorer-search-widget';
import { SearchNavigationContribution } from './search-navigation-contribution';
import { RoadmapNavigationContribution, roadmapLauncherFactory } from './roadmap-navigation-contribution';
import type { RoadmapChange } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { GreenfieldChange } from '@dope/project-intelligence/lib/node/roadmap-greenfield';

const modelInventoryChanged = new Emitter<void>();

abstract class ChatLauncherView extends AbstractViewContribution<ChatPanelWidget> implements FrontendApplicationContribution {
    private observed?: ChatPanelWidget;
    protected constructor(side: 'left' | 'right') {
        super({ widgetId: chatLauncherIds[side], widgetName: 'Chat', defaultWidgetOptions: { area: side, rank: 250 } });
    }
    async onDidInitializeLayout(): Promise<void> { this.observe(await this.openView()); }
    async openLauncher(): Promise<ChatPanelWidget> {
        const widget = await this.widget;
        await widget.selectChatLauncher();
        this.observe(await this.openView({ activate: true }));
        return widget;
    }
    private observe(widget: ChatPanelWidget): void {
        if (this.observed === widget) return;
        const tabBar = this.shell.getTabBarFor(widget);
        if (!tabBar) return;
        const activated = (_sender: typeof tabBar, { title }: { title: typeof widget.title }) => {
            if (title.owner === widget && widget.panel.mode === 'chat') void widget.selectChatLauncher();
        };
        tabBar.tabActivateRequested.connect(activated);
        widget.disposed.connect(() => tabBar.tabActivateRequested.disconnect(activated));
        this.observed = widget;
    }
}

@injectable()
class LeftChatLauncher extends ChatLauncherView { constructor() { super('left'); } }

@injectable()
class RightChatLauncher extends ChatLauncherView { constructor() { super('right'); } }

abstract class WorkLauncherView extends AbstractViewContribution<ChatPanelWidget> implements FrontendApplicationContribution {
    protected constructor(side: 'left' | 'right') {
        super({ widgetId: workLauncherIds[side], widgetName: 'Work', defaultWidgetOptions: { area: side, rank: 251 } });
    }
    async onDidInitializeLayout(): Promise<void> {
        const widget = await this.openView();
        const tabBar = this.shell.getTabBarFor(widget);
        if (tabBar) {
            const activated = (_sender: typeof tabBar, { title }: { title: typeof widget.title }) => {
                if (title.owner === widget && widget.panel.mode === 'chat') void widget.selectWorkLauncher();
            };
            tabBar.tabActivateRequested.connect(activated);
            widget.disposed.connect(() => tabBar.tabActivateRequested.disconnect(activated));
        }
    }
    async openLauncher(): Promise<ChatPanelWidget> {
        const widget = await this.openView({ activate: true });
        await widget.selectWorkLauncher();
        return widget;
    }
}

@injectable()
class LeftWorkLauncher extends WorkLauncherView { constructor() { super('left'); } }

@injectable()
class RightWorkLauncher extends WorkLauncherView { constructor() { super('right'); } }

@injectable()
class RightHistoryLauncher extends AbstractViewContribution<HistoryWidget> implements FrontendApplicationContribution {
    constructor() {
        super({ widgetId: HISTORY_WIDGET_ID, widgetName: 'History', defaultWidgetOptions: { area: 'right', rank: 252 } });
    }
    async onDidInitializeLayout(): Promise<void> { await this.openView(); }
    async openLauncher(): Promise<HistoryWidget> {
        const widget = await this.openView({ activate: true });
        await widget.refresh();
        return widget;
    }
    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand({ id: 'dope.history.open', label: 'Dope: Open History' },
            { execute: () => this.openLauncher() });
    }
}

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    rebind(FileNavigatorWidget).toDynamicValue(context => {
        const child = createFileNavigatorContainer(context.container);
        child.rebind(FileNavigatorWidget).to(ExplorerSearchWidget);
        return child.get(FileNavigatorWidget);
    });
    rebind(SearchInWorkspaceFrontendContribution).to(SearchNavigationContribution).inSingletonScope();
    bind(RoadmapNavigationContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(RoadmapNavigationContribution);
    bind(WidgetFactory).toDynamicValue(context =>
        roadmapLauncherFactory(context.container.get(RoadmapNavigationContribution))).inSingletonScope();
    rebind(SidebarBottomMenuWidget).to(AICenterBottomMenuWidget);
    bind(AICenterContribution).toSelf().inSingletonScope();
    bind(codexAuthServicePath).toDynamicValue(context =>
        ServiceConnectionProvider.createProxy<CodexAuthService>(context.container, codexAuthServicePath)).inSingletonScope();
    bind(CommandContribution).toService(AICenterContribution);
    bind(MenuContribution).toService(AICenterContribution);
    bind(FrontendApplicationContribution).toService(AICenterContribution);
    bind(AIRegistryService).toDynamicValue(context => ServiceConnectionProvider.createProxy<AIRegistryService & RpcServer<AIRegistryClient>>(
        context.container, aiRegistryServicePath, {
            notifyAIRegistryChanged: () => { modelInventoryChanged.fire(); void context.container.get(AICenterContribution).refresh();
                void context.container.get(SoftwareMapController).refreshInventory(); },
            notifyAIInventoryChanged: () => { modelInventoryChanged.fire(); void context.container.get(AICenterContribution).refresh();
                void context.container.get(SoftwareMapController).refreshInventory(); }
        })).inSingletonScope();
    bind(AIRolePolicyService).toDynamicValue(context => {
        const changed = new Emitter<number>();
        const proxy = ServiceConnectionProvider.createProxy<AIRolePolicyService & RpcServer<AIRolePolicyClient>>(
            context.container, aiRolePolicyServicePath, { notifyAIRolePolicyChanged: (revision: number) => {
                changed.fire(revision); modelInventoryChanged.fire(); void context.container.get(AICenterContribution).refresh();
            } });
        return { list: () => proxy.list(), mutate: (request: AIRolePolicyMutationRequest) => proxy.mutate(request),
            onDidChange: changed.event };
    }).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: AI_CENTER_ID, createWidget: () => new AICenterWidget(
        context.container.get(AIRegistryService), context.container.get(AICredentialService),
        context.container.get(AIRolePolicyService), context.container.get<CodexAuthService>(codexAuthServicePath)) })).inSingletonScope();
    bind(ModelConnectionsService).toDynamicValue(context =>
        ServiceConnectionProvider.createProxy<ModelConnectionsService & RpcServer<ModelConnectionsClient>>(
            context.container, modelConnectionsServicePath,
            { notifyModelConnectionsChanged() { modelInventoryChanged.fire(); } } satisfies ModelConnectionsClient)).inSingletonScope();
    bind(FrontendApplicationContribution).toDynamicValue(context => ({
        initialize: () => context.container.get(ThemeService).register(dopeDarkTheme),
    })).inSingletonScope();
    bindViewContribution(bind, SoftwareMapView);
    bindViewContribution(bind, LeftChatLauncher);
    bindViewContribution(bind, RightChatLauncher);
    bindViewContribution(bind, LeftWorkLauncher);
    bindViewContribution(bind, RightWorkLauncher);
    bindViewContribution(bind, RightHistoryLauncher);
    bind(FrontendApplicationContribution).toService(SoftwareMapView);
    bind(FrontendApplicationContribution).toService(LeftChatLauncher);
    bind(FrontendApplicationContribution).toService(RightChatLauncher);
    bind(FrontendApplicationContribution).toService(LeftWorkLauncher);
    bind(FrontendApplicationContribution).toService(RightWorkLauncher);
    bind(FrontendApplicationContribution).toService(RightHistoryLauncher);
    bind(HistoryService).toDynamicValue(context => ServiceConnectionProvider.createProxy<HistoryService>(
        context.container, historyServicePath)).inSingletonScope();
    bind('HistoryFocusService').toDynamicValue(context => ServiceConnectionProvider.createProxy<HistoryService>(
        context.container, historyFocusServicePath)).inSingletonScope();
    bind(HistoryFocusContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(HistoryFocusContribution);
    bind(WidgetFactory).toDynamicValue(context => ({ id: HISTORY_WIDGET_ID, createWidget: () => new HistoryWidget(
        () => context.container.get(HistoryService), context.container.get(WorkspaceService), (handle, project) =>
            historyOwnerNavigation({ shell: context.container.get(ApplicationShell), manager: context.container.get(WidgetManager),
                chats: context.container.get(ChatOpenOwners), work: context.container.get(WorkOpenOwners),
                planning: context.container.get(PlanningMapController), map: context.container.get(SoftwareMapController),
                history: context.container.get(HistoryService), editors: context.container.get(EditorManager),
                opener: context.container.get(OpenerService) }, handle, project)) })).inSingletonScope();
    const openPhysicalMap = async (manager: WidgetManager, shell: ApplicationShell,
        map?: SoftwareMapController, options?: PhysicalMapTabOptions) => {
        const widget = await manager.getOrCreateWidget<PhysicalMapWidget>(PHYSICAL_MAP_ID, options);
        if (options && (map?.workspace !== options.workspace || !map.nodes.some(node => node.id === options.focusId) || widget.isDisposed)) return;
        if (!widget.isAttached) await shell.addWidget(widget, { area: 'main' });
        if (options && (map?.workspace !== options.workspace || widget.isDisposed)) return;
        await shell.activateWidget(widget.id);
    };
    const openFocusedMap = (manager: WidgetManager, shell: ApplicationShell, map: SoftwareMapController, id: string) => {
        if (!map.workspace || !map.nodes.some(node => node.id === id && node.kind !== 'project')) return Promise.resolve();
        return openPhysicalMap(manager, shell, map,
            physicalMapTabOptions(map.workspace, id));
    };
    bind(CommandContribution).toDynamicValue(context => ({ registerCommands: (commands: CommandRegistry) =>
        commands.registerCommand({ id: 'dope.physicalMap.open', label: 'Dope: Open Physical Map' },
            { execute: () => openPhysicalMap(context.container.get(WidgetManager), context.container.get(ApplicationShell)) }) })).inSingletonScope();
    bind(CommandContribution).toDynamicValue(context => ({ registerCommands: (commands: CommandRegistry) =>
        commands.registerCommand({ id: 'dope.roadmap.open', label: 'Dope: Open Roadmap' }, { execute: async () => {
            const manager = context.container.get(WidgetManager);
            const shell = context.container.get(ApplicationShell);
            const widget = await manager.getOrCreateWidget<RoadmapCanvasWidget>(ROADMAP_CANVAS_ID);
            if (!widget.isAttached) await shell.addWidget(widget, { area: 'main' });
            await shell.activateWidget(widget.id);
        } }) })).inSingletonScope();
    bind(CommandContribution).toDynamicValue(context => ({ registerCommands: (commands: CommandRegistry) =>
        commands.registerCommand({ id: 'dope.roadmap.inspector', label: 'Dope: Show Roadmap Details' }, { execute: async () => {
            const manager = context.container.get(WidgetManager);
            const shell = context.container.get(ApplicationShell);
            const widget = await manager.getOrCreateWidget<RoadmapCanvasWidget>(ROADMAP_CANVAS_ID);
            if (!widget.isAttached) await shell.addWidget(widget, { area: 'main' });
            await shell.activateWidget(widget.id);
            widget.openDetails();
        } }) })).inSingletonScope();
    const openMind = (context: { container: import('@theia/core/shared/inversify').interfaces.Context['container'] },
        id?: string, workspace?: string) => openProjectMindOwner(
        () => context.container.get(WidgetManager).getOrCreateWidget<ProjectMindWidget>(PROJECT_MIND_ID),
        async widget => {
            const shell = context.container.get(ApplicationShell);
            const mind = widget as ProjectMindWidget;
            if (!mind.isAttached) await shell.addWidget(mind, { area: 'right' });
            await shell.activateWidget(mind.id);
        }, id, workspace);
    bind(CommandContribution).toDynamicValue(context => ({ registerCommands: (commands: CommandRegistry) =>
        commands.registerCommand({ id: 'dope.projectMind.open', label: 'Dope: Show Project Mind' },
            { execute: () => openMind(context) }) })).inSingletonScope();
    bind(CommandContribution).toDynamicValue(context => ({ registerCommands: (commands: CommandRegistry) => {
        for (const name of Object.keys(chatAreas) as ChatArea[]) commands.registerCommand(
            { id: `dope.chat.open.${name}`, label: `Dope: Open Chat Panel in ${name[0].toUpperCase()}${name.slice(1)}` },
            { execute: () => name === 'left' ? context.container.get(LeftChatLauncher).openLauncher() :
                name === 'right' ? context.container.get(RightChatLauncher).openLauncher() :
                openChatPanel(name, options => context.container.get(WidgetManager)
                    .getOrCreateWidget<ChatPanelWidget>(CHAT_PANEL_ID, options), context.container.get(ApplicationShell)) });
    } })).inSingletonScope();
    bind(CommandContribution).toDynamicValue(context => ({ registerCommands: (commands: CommandRegistry) => {
        const openWork = async (area: ChatArea, promptStack = false): Promise<ChatPanelWidget> => {
            const widget = area === 'left' ? await context.container.get(LeftWorkLauncher).openLauncher() :
                area === 'right' ? await context.container.get(RightWorkLauncher).openLauncher() :
                    await openChatPanel<ChatPanelWidget>(area, options => context.container.get(WidgetManager)
                        .getOrCreateWidget<ChatPanelWidget>(CHAT_PANEL_ID, options), context.container.get(ApplicationShell), 'work');
            if (promptStack) await widget.selectPromptStacks();
            else await widget.selectWorkLauncher();
            return widget;
        };
        for (const area of Object.keys(chatAreas) as ChatArea[]) commands.registerCommand(
            { id: `dope.work.open.${area}`, label: `Dope: Open Work in ${area[0].toUpperCase()}${area.slice(1)}` },
            { execute: () => openWork(area) });
        commands.registerCommand({ id: 'dope.work.open', label: 'Dope: Open Work' },
            { execute: () => openWork('center') });
        commands.registerCommand({ id: 'dope.work.openPromptStack', label: 'Dope: Open Prompt Stack' },
            { execute: () => openWork('center', true) });
        commands.registerCommand({ id: 'dope.agentRun.open' }, { execute: () => openWork('center') });
        commands.registerCommand({ id: 'dope.phaseStack.open' }, { execute: () => openWork('center', true) });
    } })).inSingletonScope();
    bind(NoteService).toDynamicValue(context => ServiceConnectionProvider.createProxy<NoteService>(context.container, noteServicePath)).inSingletonScope();
    bind(ProjectMindService).toDynamicValue(context => ServiceConnectionProvider.createProxy<ProjectMindService & RpcServer<ProjectMindClient>>(context.container, projectMindServicePath));
    bindSharedAgentRuntime(bind, (container, client) => ServiceConnectionProvider.createProxy<AgentRuntimeService & RpcServer<AgentRuntimeClient>>(
        container, agentRuntimeServicePath, client), (container, change) => {
            const widgets = container.get(WidgetManager);
            for (const widget of [...widgets.getWidgets(CHAT_PANEL_ID),
                ...(['left', 'right'] as const).flatMap(side => [widgets.tryGetWidget(chatLauncherIds[side]),
                    widgets.tryGetWidget(workLauncherIds[side])])].filter(Boolean) as ChatPanelWidget[])
                void widget.refreshWork();
            for (const widget of widgets.getWidgets(AGENT_TRANSCRIPT_ID) as AgentTranscriptWidget[])
                if ((change.kind === 'run' || change.kind === 'transcript') && widget.options.runId === change.id)
                    void widget.refresh();
        });
    bind(ChatOpenOwners).toSelf().inSingletonScope();
    bind(WorkOpenOwners).toSelf().inSingletonScope();
    bind(SoftwareMapService).toDynamicValue(context => ServiceConnectionProvider.createProxy<SoftwareMapService & RpcServer<SoftwareMapClient>>(context.container, softwareMapServicePath)).inSingletonScope();
    bind(AICredentialService).toDynamicValue(context => ServiceConnectionProvider.createProxy<AICredentialService & RpcServer<AICredentialClient>>(
        context.container, aiCredentialServicePath, {
            notifyAICredentialChanged: (id: string) => { void context.container.get(AICenterContribution).refresh();
                context.container.get(SoftwareMapController).credentialChanged(id); }
        })).inSingletonScope();
    bind(SoftwareMapController).toDynamicValue(context => new SoftwareMapController(
        () => context.container.get(SoftwareMapService) as SoftwareMapService & RpcServer<SoftwareMapClient>,
        () => {}, context.container.get(StorageService), context.container.get(AIRegistryService),
        context.container.get(AICredentialService), context.container.get(AIRolePolicyService))).inSingletonScope();
    bind(PlanningMapController).toDynamicValue(context => new PlanningMapController(context.container.get(SoftwareMapController),
        () => ServiceConnectionProvider.createProxy<VisualPlanningService>(context.container, visualPlanningServicePath),
        context.container.get(AgentRuntimeService))).inSingletonScope();
    bind<RoadmapService>('RoadmapService').toDynamicValue(context => ServiceConnectionProvider.createProxy<RoadmapService & RpcServer<RoadmapClient>>(
        context.container, roadmapServicePath, { notifyRoadmapChanged: (change: RoadmapChange) => {
            void context.container.get(RoadmapInspectorModel).remoteChange(change);
        }, notifyDraftChanged: (change: GreenfieldChange) => {
            void context.container.get(WidgetManager).getWidget<RoadmapCanvasWidget>(ROADMAP_CANVAS_ID)
                .then(widget => widget?.draftChanged(change));
        }, notifyLinkedDocumentChanged: (root: string, projectId: string) => {
            void context.container.get(WidgetManager).getWidget<RoadmapCanvasWidget>(ROADMAP_CANVAS_ID)
                .then(widget => widget?.linkedSourceChanged(root, projectId));
        }, notifyPhaseFocusEvidenceChanged: (root: string) => {
            void context.container.get(WidgetManager).getWidget<RoadmapCanvasWidget>(ROADMAP_CANVAS_ID)
                .then(widget => widget?.phaseEvidenceChanged(root));
        } })).inSingletonScope();
    bind(RoadmapInspectorModel).toDynamicValue(context => new RoadmapInspectorModel(
        context.container.get<RoadmapService>('RoadmapService'),
        async uri => { await open(context.container.get(OpenerService), new URI(uri)); },
        async selection => {
            const planning = context.container.get(PlanningMapController);
            const map = context.container.get(SoftwareMapController);
            if (map.workspace !== selection.workspace || planning.focusWorkspace !== selection.workspace ||
                planning.collection?.projectId !== selection.projectId)
                throw new Error('Planning Map is unavailable for this project. Open its Software Map and retry.');
            if (selection.mapId) {
                const exact = await planning.navigationMap(selection.mapId);
                if (!exact || exact.revision !== selection.mapRevision)
                    throw new Error('Linked Planning Map is missing or stale. Review the Roadmap link before preparing work.');
            }
            const manager = context.container.get(WidgetManager);
            const shell = context.container.get(ApplicationShell);
            const widget = await manager.getOrCreateWidget<PhysicalMapWidget>(PHYSICAL_MAP_ID);
            if (map.workspace !== selection.workspace || planning.focusWorkspace !== selection.workspace ||
                planning.collection?.projectId !== selection.projectId || widget.isDisposed)
                throw new Error('Project changed while opening Planning Map. Select the checkpoint again.');
            if (selection.mapId) planning.select(selection.mapId);
            else planning.clearSelection();
            planning.setPrepareWorkContext(selection);
            planning.setMode(true);
            if (!widget.isAttached) await shell.addWidget(widget, { area: 'main' });
            if (map.workspace !== selection.workspace || planning.focusWorkspace !== selection.workspace ||
                planning.collection?.projectId !== selection.projectId) {
                planning.setPrepareWorkContext(undefined);
                throw new Error('Project changed while opening Planning Map. Select the checkpoint again.');
            }
            await shell.activateWidget(widget.id);
        })).inSingletonScope();
    bind(ChatPlanningSelection).toDynamicValue(context => new ChatPlanningSelection(context.container.get(RoadmapInspectorModel),
        context.container.get(PlanningMapController), context.container.get<RoadmapService>('RoadmapService'))).inSingletonScope();
    bind(SmapPresentationState).toDynamicValue(context => new SmapPresentationState(context.container.get(StorageService))).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: SOFTWARE_MAP_ID, createWidget: () => new SoftwareMapWidget(
        context.container.get(SoftwareMapController), context.container.get(WorkspaceService), context.container.get(OpenerService),
        async () => {
            const manager = context.container.get(WidgetManager);
            const shell = context.container.get(ApplicationShell);
            const widget = await manager.getOrCreateWidget<SoftwareMapReviewWidget>(SOFTWARE_MAP_REVIEW_ID);
            if (!widget.isAttached) await shell.addWidget(widget, { area: 'main' });
            await shell.activateWidget(widget.id);
        }, () => openPhysicalMap(context.container.get(WidgetManager), context.container.get(ApplicationShell)),
        () => context.container.get(AICenterContribution).openFromSoftwareMap()
    ) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: PHYSICAL_MAP_ID, createWidget: (options?: PhysicalMapTabOptions) =>
        new PhysicalMapWidget(context.container.get(SoftwareMapController),
            context.container.get(OpenerService), id => openFocusedMap(context.container.get(WidgetManager),
                context.container.get(ApplicationShell), context.container.get(SoftwareMapController), id),
            context.container.get(PlanningMapController), context.container.get(SmapPresentationState), options,
            async taskId => {
                const widget = await openChatPanel<ChatPanelWidget>('center', panelOptions => context.container.get(WidgetManager)
                    .getOrCreateWidget<ChatPanelWidget>(CHAT_PANEL_ID, panelOptions), context.container.get(ApplicationShell), 'work');
                await widget.selectWorkLauncher({ kind: 'task', id: taskId });
            }) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: ROADMAP_CANVAS_ID, createWidget: () =>
        new RoadmapCanvasWidget(context.container.get<RoadmapService>('RoadmapService'), context.container.get(WorkspaceService),
            context.container.get(RoadmapInspectorModel),
            (id, workspace) => openMind(context, id, workspace), workspace => {
                const chats = new Map<string, string>();
                const widgets = context.container.get(WidgetManager);
                const openChats = [...widgets.getWidgets(CHAT_PANEL_ID),
                    ...(['left', 'right'] as const).map(side => widgets.tryGetWidget(chatLauncherIds[side]))]
                    .filter(Boolean) as ChatPanelWidget[];
                for (const widget of openChats) {
                    if (widget.moduleKind !== 'chat' || widget.controller.workspace !== workspace || !widget.controller.chat) continue;
                    chats.set(widget.controller.chat.id, widget.controller.chat.title);
                }
                return [...chats].map(([id, title]) => ({ id, title }));
            }, context.container.get(StorageService)) })).inSingletonScope();
    // Saved pre-overlay workbench layouts may restore this sidebar. It shares the model but cannot edit.
    bind(WidgetFactory).toDynamicValue(context => ({ id: ROADMAP_INSPECTOR_ID, createWidget: () =>
        new RoadmapInspectorWidget(context.container.get(RoadmapInspectorModel), false) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: SOFTWARE_MAP_REVIEW_ID, createWidget: () =>
        new SoftwareMapReviewWidget(context.container.get(SoftwareMapController), context.container.get(WorkspaceService),
            context.container.get(OpenerService), () => context.container.get(AICenterContribution).openFromSoftwareMapReview()) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: PROJECT_MIND_ID, createWidget: () => new ProjectMindWidget(
        () => context.container.get(ProjectMindService) as ProjectMindService & RpcServer<ProjectMindClient>,
        context.container.get(WorkspaceService), context.container.get(FileService), context.container.get(OpenerService)
    ) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: AGENT_TRANSCRIPT_ID,
        createWidget: (options: AgentTranscriptOptions) => new AgentTranscriptWidget(
            context.container.get(AgentRuntimeService), context.container.get<MarkdownRenderer>(CoreMarkdownRenderer),
            context.container.get(WorkspaceService), options)
    })).inSingletonScope();
    const createChatWidget = (context: { container: import('@theia/core/shared/inversify').interfaces.Context['container'] }, options: ChatPanelOptions) =>
        new ChatPanelWidget(() => ServiceConnectionProvider.createProxy<ChatService & RpcServer<ChatClient>>(
            context.container, `${chatServicePath}/${options.instanceId}`),
            context.container.get(WorkspaceService), context.container.get(ApplicationShell),
            context.container.get(ChatOpenOwners), context.container.get(WorkOpenOwners), options,
            context.container.get<MarkdownRenderer>(CoreMarkdownRenderer),
            context.container.get(ModelConnectionsService), context.container.get(EditorManager),
            context.container.get(SoftwareMapController), context.container.get(AICenterContribution), modelInventoryChanged.event,
            context.container.get(AgentRuntimeService), context.container.get(AIRegistryService),
            context.container.get(AIRolePolicyService), async (project: string, runId: string) => {
                await openAgentTranscript({ project, runId }, options =>
                    context.container.get(WidgetManager).getOrCreateWidget<AgentTranscriptWidget>(
                        AGENT_TRANSCRIPT_ID, options), context.container.get(ApplicationShell));
            }, context.container.get(ChatPlanningSelection));
    bind(WidgetFactory).toDynamicValue(context => ({ id: CHAT_PANEL_ID, createWidget: (options: ChatPanelOptions) =>
        createChatWidget(context, options) })).inSingletonScope();
    for (const side of ['left', 'right'] as const) bind(WidgetFactory).toDynamicValue(context => ({
        id: chatLauncherIds[side], createWidget: () => createChatWidget(context, chatLauncherOptions[side])
    })).inSingletonScope();
    for (const side of ['left', 'right'] as const) bind(WidgetFactory).toDynamicValue(context => ({
        id: workLauncherIds[side], createWidget: () => createChatWidget(context, workLauncherOptions[side])
    })).inSingletonScope();
    rebind(WindowTitleService).to(DopeWindowTitleService).inSingletonScope();
});
