import { ContainerModule } from '@theia/core/shared/inversify';
import { CommandContribution, MenuContribution } from '@theia/core/lib/common';
import { ApplicationShellOptions, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';
import { WindowTitleService } from '@theia/core/lib/browser/window/window-title-service';
import { bindViewContribution } from '@theia/core/lib/browser/shell/view-contribution';
import { WorkspaceModeService } from '@dope/contracts';
import { DopeWindowTitleService, DopeWorkbench, PlanningView, ProjectMindView, spikeWidgetFactories } from './dope-workbench';

export default new ContainerModule((bind, _unbind, _isBound, rebind) => {
    bind(WorkspaceModeService).toConstantValue(new WorkspaceModeService());
    bindViewContribution(bind, ProjectMindView);
    bindViewContribution(bind, PlanningView);
    for (const factory of spikeWidgetFactories) bind(WidgetFactory).toConstantValue(factory);
    bind(DopeWorkbench).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(DopeWorkbench);
    bind(CommandContribution).toService(DopeWorkbench);
    bind(MenuContribution).toService(DopeWorkbench);
    rebind(WindowTitleService).to(DopeWindowTitleService).inSingletonScope();
    rebind(ApplicationShellOptions).toConstantValue({ leftPanel: { initialSizeRatio: 0.24 }, rightPanel: { initialSizeRatio: 0.28 } });
});
