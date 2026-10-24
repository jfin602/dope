import type { SharedPanelState, WorkSelection } from './shared-panel-state';
import type { WorkSelectionController } from './work-selection-controller';

/** Reserve a Work owner only after a discovered stack has a saved sequence identity. */
export class WorkSelectionNavigator {
    private pending: Promise<void> = Promise.resolve();
    private request = 0;

    constructor(private readonly panel: SharedPanelState, private readonly controller: WorkSelectionController) {}

    select(selection?: WorkSelection, navigationOnly = false): Promise<WorkSelection | undefined> {
        const request = ++this.request;
        const workspace = this.panel.workspace;
        const operation = this.pending.then(async () => {
            if (request !== this.request || workspace !== this.panel.workspace ||
                workspace !== this.controller.project) return;
            this.panel.selectWork(undefined);
            const canonical = await this.controller.select(selection, navigationOnly);
            if (request !== this.request || workspace !== this.panel.workspace ||
                workspace !== this.controller.project) return;
            if (!canonical) return;
            if (!this.panel.selectWork(canonical)) {
                await this.controller.select(undefined);
                return;
            }
            return canonical;
        });
        this.pending = operation.then(() => {}, () => {});
        return operation;
    }
}
