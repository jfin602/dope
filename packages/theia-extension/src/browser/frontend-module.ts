import { ContainerModule } from '@theia/core/shared/inversify';
import { ApplicationShell, FrontendApplicationContribution, WidgetFactory, WidgetManager } from '@theia/core/lib/browser';
import { CommandContribution, CommandRegistry } from '@theia/core/lib/common';
import { WindowTitleService } from '@theia/core/lib/browser/window/window-title-service';
import { bindViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { NoteService, noteServicePath } from '@dope/contracts/lib/note-service';
import { ProjectMindClient, ProjectMindService, projectMindServicePath } from '@dope/contracts/lib/project-mind-service';
import type { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { OpenerService } from '@theia/core/lib/browser';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import { ThemeService } from '@theia/core/lib/browser/theming';
import { dopeDarkTheme } from './dope-theme';
import './dope.css';
import { DopeWindowTitleService, ProjectMindView, ProjectMindWidget, PROJECT_MIND_ID } from './dope-workbench';
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
import { ChatService, chatServicePath } from '@dope/chat/lib/service';
import { ModelConnectionsService, modelConnectionsServicePath } from '@dope/contracts/lib/model-connections-service';
import type { ModelConnectionsClient } from '@dope/contracts/lib/model-connections-service';
import type { ChatClient } from '@dope/chat/lib/service';
import { ChatPanelWidget } from './chat-panel-widget';
import { ChatOpenOwners } from './chat-panel-controller';
import { CHAT_PANEL_ID, chatAreas, openChatPanel, type ChatArea, type ChatPanelOptions } from './chat-panel-presentation';

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(ModelConnectionsService).toDynamicValue(context =>
        ServiceConnectionProvider.createProxy<ModelConnectionsService & RpcServer<ModelConnectionsClient>>(
            context.container, modelConnectionsServicePath,
            { notifyModelConnectionsChanged() {} } satisfies ModelConnectionsClient)).inSingletonScope();
    bind(FrontendApplicationContribution).toDynamicValue(context => ({
        initialize: () => context.container.get(ThemeService).register(dopeDarkTheme),
    })).inSingletonScope();
    bindViewContribution(bind, ProjectMindView);
    bindViewContribution(bind, SoftwareMapView);
    bind(FrontendApplicationContribution).toService(SoftwareMapView);
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
    bind(CommandContribution).toDynamicValue(context => ({ registerCommands: (commands: CommandRegistry) => {
        for (const name of Object.keys(chatAreas) as ChatArea[]) commands.registerCommand(
            { id: `dope.chat.open.${name}`, label: `Dope: Open Chat Panel in ${name[0].toUpperCase()}${name.slice(1)}` },
            { execute: () => openChatPanel(name, options => context.container.get(WidgetManager)
                .getOrCreateWidget<ChatPanelWidget>(CHAT_PANEL_ID, options), context.container.get(ApplicationShell)) });
    } })).inSingletonScope();
    bind(NoteService).toDynamicValue(context => ServiceConnectionProvider.createProxy<NoteService>(context.container, noteServicePath)).inSingletonScope();
    bind(ProjectMindService).toDynamicValue(context => ServiceConnectionProvider.createProxy<ProjectMindService & RpcServer<ProjectMindClient>>(context.container, projectMindServicePath));
    bind(ChatService).toDynamicValue(context => ServiceConnectionProvider.createProxy<ChatService & RpcServer<ChatClient>>(context.container, chatServicePath));
    bind(ChatOpenOwners).toSelf().inSingletonScope();
    bind(SoftwareMapService).toDynamicValue(context => ServiceConnectionProvider.createProxy<SoftwareMapService & RpcServer<SoftwareMapClient>>(context.container, softwareMapServicePath)).inSingletonScope();
    bind(SoftwareMapController).toDynamicValue(context => new SoftwareMapController(
        () => context.container.get(SoftwareMapService) as SoftwareMapService & RpcServer<SoftwareMapClient>,
        () => {}, context.container.get(StorageService))).inSingletonScope();
    bind(PlanningMapController).toDynamicValue(context => new PlanningMapController(context.container.get(SoftwareMapController),
        () => ServiceConnectionProvider.createProxy<VisualPlanningService>(context.container, visualPlanningServicePath))).inSingletonScope();
    bind(SmapPresentationState).toDynamicValue(context => new SmapPresentationState(context.container.get(StorageService))).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: SOFTWARE_MAP_ID, createWidget: () => new SoftwareMapWidget(
        context.container.get(SoftwareMapController), context.container.get(WorkspaceService), context.container.get(OpenerService),
        async () => {
            const manager = context.container.get(WidgetManager);
            const shell = context.container.get(ApplicationShell);
            const widget = await manager.getOrCreateWidget<SoftwareMapReviewWidget>(SOFTWARE_MAP_REVIEW_ID);
            if (!widget.isAttached) await shell.addWidget(widget, { area: 'main' });
            await shell.activateWidget(widget.id);
        }, () => openPhysicalMap(context.container.get(WidgetManager), context.container.get(ApplicationShell))
    ) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: PHYSICAL_MAP_ID, createWidget: (options?: PhysicalMapTabOptions) =>
        new PhysicalMapWidget(context.container.get(SoftwareMapController),
            context.container.get(OpenerService), id => openFocusedMap(context.container.get(WidgetManager),
                context.container.get(ApplicationShell), context.container.get(SoftwareMapController), id),
            context.container.get(PlanningMapController), context.container.get(SmapPresentationState), options) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: SOFTWARE_MAP_REVIEW_ID, createWidget: () =>
        new SoftwareMapReviewWidget(context.container.get(SoftwareMapController), context.container.get(WorkspaceService),
            context.container.get(OpenerService)) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: PROJECT_MIND_ID, createWidget: () => new ProjectMindWidget(
        () => context.container.get(ProjectMindService) as ProjectMindService & RpcServer<ProjectMindClient>,
        context.container.get(WorkspaceService), context.container.get(FileService), context.container.get(OpenerService)
    ) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: CHAT_PANEL_ID, createWidget: (options: ChatPanelOptions) =>
        new ChatPanelWidget(() => context.container.get(ChatService) as ChatService & RpcServer<ChatClient>,
            context.container.get(WorkspaceService), context.container.get(ApplicationShell),
            context.container.get(ChatOpenOwners), options) })).inSingletonScope();
    rebind(WindowTitleService).to(DopeWindowTitleService).inSingletonScope();
});
