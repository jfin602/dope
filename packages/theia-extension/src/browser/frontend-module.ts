import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser';
import { WindowTitleService } from '@theia/core/lib/browser/window/window-title-service';
import { bindViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { NoteService, noteServicePath } from '@dope/contracts/lib/note-service';
import { ProjectMindClient, ProjectMindService, projectMindServicePath } from '@dope/contracts/lib/project-mind-service';
import type { RpcServer } from '@theia/core/lib/common/messaging/proxy-factory';
import { ServiceConnectionProvider } from '@theia/core/lib/browser/messaging/service-connection-provider';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { OpenerService } from '@theia/core/lib/browser';
import { DopeWindowTitleService, ProjectMindView, ProjectMindWidget, PROJECT_MIND_ID } from './dope-workbench';
import { SoftwareModelService, softwareModelServicePath } from '@dope/software-model';
import type { SoftwareModelClient } from '@dope/software-model';
import { SoftwareModelView, SoftwareModelWidget, SOFTWARE_MODEL_ID } from './software-model-widget';

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bindViewContribution(bind, ProjectMindView);
    bindViewContribution(bind, SoftwareModelView);
    bind(NoteService).toDynamicValue(context => ServiceConnectionProvider.createProxy<NoteService>(context.container, noteServicePath)).inSingletonScope();
    bind(ProjectMindService).toDynamicValue(context => ServiceConnectionProvider.createProxy<ProjectMindService & RpcServer<ProjectMindClient>>(context.container, projectMindServicePath));
    bind(SoftwareModelService).toDynamicValue(context => ServiceConnectionProvider.createProxy<SoftwareModelService & RpcServer<SoftwareModelClient>>(context.container, softwareModelServicePath)).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: SOFTWARE_MODEL_ID, createWidget: () => new SoftwareModelWidget(
        () => context.container.get(SoftwareModelService) as SoftwareModelService & RpcServer<SoftwareModelClient>,
        context.container.get(WorkspaceService), context.container.get(OpenerService)
    ) })).inSingletonScope();
    bind(WidgetFactory).toDynamicValue(context => ({ id: PROJECT_MIND_ID, createWidget: () => new ProjectMindWidget(
        () => context.container.get(ProjectMindService) as ProjectMindService & RpcServer<ProjectMindClient>,
        context.container.get(WorkspaceService), context.container.get(FileService), context.container.get(OpenerService)
    ) })).inSingletonScope();
    rebind(WindowTitleService).to(DopeWindowTitleService).inSingletonScope();
});
