import { inject, injectable } from '@theia/core/shared/inversify';
import { CommandRegistry } from '@theia/core/lib/common/command';
import { open } from '@theia/core/lib/browser/opener-service';
import { WidgetManager } from '@theia/core/lib/browser/widget-manager';
import { FILE_NAVIGATOR_ID } from '@theia/navigator/lib/browser/navigator-widget';
import { WorkspaceCommandContribution, WorkspaceCommands } from '@theia/workspace/lib/browser/workspace-commands';
import { ExplorerSearchWidget } from './explorer-search-widget';

/** Keep Theia's file creation and validation, but collect the name inside Explorer. */
@injectable()
export class ExplorerInlineNewFileCommands extends WorkspaceCommandContribution {
    @inject(WidgetManager) protected readonly widgetManager!: WidgetManager;

    override registerCommands(registry: CommandRegistry): void {
        super.registerCommands(registry);
        registry.registerHandler(WorkspaceCommands.NEW_FILE.id,
            this.newWorkspaceRootUriAwareCommandHandler({
                execute: async uri => {
                    const parent = await this.getDirectory(uri);
                    if (!parent) return;
                    const explorer = await this.widgetManager.getOrCreateWidget<ExplorerSearchWidget>(FILE_NAVIGATOR_ID);
                    await explorer.startFileCreation(parent.resource, async name => {
                        const error = await this.validateFileName(name, parent, true);
                        if (error) return error;
                        try {
                            const fileUri = parent.resource.resolve(name);
                            await this.fileService.create(fileUri);
                            this.fireCreateNewFile({ parent: parent.resource, uri: fileUri });
                            await open(this.openerService, fileUri);
                            return undefined;
                        } catch (cause) {
                            return cause instanceof Error ? cause.message : String(cause);
                        }
                    });
                }
            }));
    }
}
