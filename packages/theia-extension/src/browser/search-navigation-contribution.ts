import { injectable } from '@theia/core/shared/inversify';
import { SearchInWorkspaceFrontendContribution } from '@theia/search-in-workspace/lib/browser/search-in-workspace-frontend-contribution';
import { SEARCH_VIEW_CONTAINER_ID } from '@theia/search-in-workspace/lib/browser/search-in-workspace-factory';

/** Retains all Theia search commands and keybindings, while placing its view outside the Activity Bar. */
@injectable()
export class SearchNavigationContribution extends SearchInWorkspaceFrontendContribution {
    constructor() {
        super();
        this.options.defaultWidgetOptions.area = 'bottom';
    }

    override async initializeLayout(): Promise<void> {
        // Search is opened by its existing commands and keybindings when requested.
    }

    async onDidInitializeLayout(): Promise<void> {
        const view = this.widgetManager.tryGetWidget(SEARCH_VIEW_CONTAINER_ID);
        if (view && this.shell.getAreaFor(view) === 'left') {
            await this.shell.addWidget(view, { area: 'bottom' });
        }
    }
}
