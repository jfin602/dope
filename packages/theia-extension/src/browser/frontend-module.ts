import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';
import { WindowTitleService } from '@theia/core/lib/browser/window/window-title-service';
import { bindViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { WorkspaceModeService } from '@dope/contracts';
import { NoteService, noteServicePath } from '@dope/contracts/lib/note-service';
import { ProjectMindClient, ProjectMindService, projectMindServicePath } from '@dope/contracts/lib/project-mind-service';
import { PlanningClient, PlanningService, planningServicePath } from '@dope/contracts/lib/planning-service';
import type { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { OpenerService } from '@theia/core/lib/browser';
import { DopeWindowTitleService, DopeWorkbench, PlanningView, ProjectMindView, ProjectMindWidget, PLANNING_ID, PROJECT_MIND_ID } from './dope-workbench';
import { PlanningWidget } from './planning-widget';

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(WorkspaceModeService).toConstantValue(new WorkspaceModeService());
    bindViewContribution(bind, ProjectMindView);
    bindViewContribution(bind, PlanningView);
    bind(NoteService).toDynamicValue(context => ServiceConnectionProvider.createProxy<NoteService>(context.container, noteServicePath)).inSingletonScope();
    bind(ProjectMindService).toDynamicValue(context => ServiceConnectionProvider.createProxy<ProjectMindService & RpcServer<ProjectMindClient>>(context.container, projectMindServicePath));
    bind(PlanningService).toDynamicValue(context => ServiceConnectionProvider.createProxy<PlanningService & RpcServer<PlanningClient>>(context.container, planningServicePath));
    bind(WidgetFactory).toDynamicValue(context => ({ id: PROJECT_MIND_ID, createWidget: () => new ProjectMindWidget(
        () => context.container.get(ProjectMindService) as ProjectMindService & RpcServer<ProjectMindClient>,
        context.container.get(WorkspaceService), context.container.get(FileService), context.container.get(OpenerService),
        () => context.container.get(PlanningService) as PlanningService & RpcServer<PlanningClient>,
        id => context.container.get(PlanningView).showPlan(id)
    ) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: PLANNING_ID, createWidget: () => new PlanningWidget(
        () => context.container.get(PlanningService) as PlanningService & RpcServer<PlanningClient>,
        () => context.container.get(ProjectMindService) as ProjectMindService & RpcServer<ProjectMindClient>,
        context.container.get(WorkspaceService), context.container.get(FileService), context.container.get(OpenerService),
        async id => { const widget = await context.container.get(ProjectMindView).openView({ activate: true }); await widget.openArtifact(id); }
    ) })).inSingletonScope();
    bind(DopeWorkbench).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(DopeWorkbench);
    bind(CommandContribution).toService(DopeWorkbench);
    bind(MenuContribution).toService(DopeWorkbench);
    rebind(WindowTitleService).to(DopeWindowTitleService).inSingletonScope();
});
