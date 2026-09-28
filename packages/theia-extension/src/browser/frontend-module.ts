import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';
import { WindowTitleService } from '@theia/core/lib/browser/window/window-title-service';
import { bindViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { WorkspaceModeService } from '@dope/contracts';
import { NoteService, noteServicePath } from '@dope/contracts/lib/note-service';
import { ProjectMindClient, ProjectMindService, projectMindServicePath } from '@dope/contracts/lib/project-mind-service';
import type { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { OpenerService } from '@theia/core/lib/browser';
import { DopeWindowTitleService, DopeWorkbench, PlanningView, ProjectMindView, ProjectMindWidget, PLANNING_ID, PROJECT_MIND_ID, DopeSpikeWidget } from './dope-workbench';

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(WorkspaceModeService).toConstantValue(new WorkspaceModeService());
    bindViewContribution(bind, ProjectMindView);
    bindViewContribution(bind, PlanningView);
    bind(NoteService).toDynamicValue(context => ServiceConnectionProvider.createProxy<NoteService>(context.container, noteServicePath)).inSingletonScope();
    bind(ProjectMindService).toDynamicValue(context => ServiceConnectionProvider.createProxy<ProjectMindService & RpcServer<ProjectMindClient>>(context.container, projectMindServicePath));
    bind(WidgetFactory).toDynamicValue(context => ({ id: PROJECT_MIND_ID, createWidget: () => new ProjectMindWidget(
        () => context.container.get(ProjectMindService) as ProjectMindService & RpcServer<ProjectMindClient>,
        context.container.get(WorkspaceService), context.container.get(FileService), context.container.get(OpenerService)
    ) })).inSingletonScope();
    bind(WidgetFactory).toConstantValue({ id: PLANNING_ID, createWidget: () => new DopeSpikeWidget(PLANNING_ID, 'Planning', 'Planning', 'A focused surface for decisions and plans. Spike view; live planning arrives later.') });
    bind(DopeWorkbench).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(DopeWorkbench);
    bind(CommandContribution).toService(DopeWorkbench);
    bind(MenuContribution).toService(DopeWorkbench);
    rebind(WindowTitleService).to(DopeWindowTitleService).inSingletonScope();
});
