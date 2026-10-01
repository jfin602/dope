import { ContainerModule } from '@theia/core/shared/inversify';
import { ApplicationShell, FrontendApplicationContribution, WidgetFactory, WidgetManager } from '@theia/core/lib/browser';
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

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(FrontendApplicationContribution).toDynamicValue(context => ({
        initialize: () => context.container.get(ThemeService).register(dopeDarkTheme),
    })).inSingletonScope();
    bindViewContribution(bind, ProjectMindView);
    bindViewContribution(bind, SoftwareMapView);
    bind(FrontendApplicationContribution).toService(SoftwareMapView);
    bind(NoteService).toDynamicValue(context => ServiceConnectionProvider.createProxy<NoteService>(context.container, noteServicePath)).inSingletonScope();
    bind(ProjectMindService).toDynamicValue(context => ServiceConnectionProvider.createProxy<ProjectMindService & RpcServer<ProjectMindClient>>(context.container, projectMindServicePath));
    bind(SoftwareMapService).toDynamicValue(context => ServiceConnectionProvider.createProxy<SoftwareMapService & RpcServer<SoftwareMapClient>>(context.container, softwareMapServicePath)).inSingletonScope();
    bind(SoftwareMapController).toDynamicValue(context => new SoftwareMapController(
        () => context.container.get(SoftwareMapService) as SoftwareMapService & RpcServer<SoftwareMapClient>,
        () => {}, context.container.get(StorageService))).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: SOFTWARE_MAP_ID, createWidget: () => new SoftwareMapWidget(
        context.container.get(SoftwareMapController), context.container.get(WorkspaceService), context.container.get(OpenerService),
        async () => {
            const manager = context.container.get(WidgetManager);
            const shell = context.container.get(ApplicationShell);
            const widget = await manager.getOrCreateWidget<SoftwareMapReviewWidget>(SOFTWARE_MAP_REVIEW_ID);
            if (!widget.isAttached) await shell.addWidget(widget, { area: 'main' });
            await shell.activateWidget(widget.id);
        }
    ) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: SOFTWARE_MAP_REVIEW_ID, createWidget: () =>
        new SoftwareMapReviewWidget(context.container.get(SoftwareMapController), context.container.get(WorkspaceService),
            context.container.get(OpenerService)) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: PROJECT_MIND_ID, createWidget: () => new ProjectMindWidget(
        () => context.container.get(ProjectMindService) as ProjectMindService & RpcServer<ProjectMindClient>,
        context.container.get(WorkspaceService), context.container.get(FileService), context.container.get(OpenerService)
    ) })).inSingletonScope();
    rebind(WindowTitleService).to(DopeWindowTitleService).inSingletonScope();
});
