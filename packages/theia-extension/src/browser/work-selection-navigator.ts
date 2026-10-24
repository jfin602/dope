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
        if (!selection) {
            // Back must work even if an earlier detail RPC never settles.
            this.panel.selectWork(undefined);
            this.pending = Promise.resolve();
            return this.controller.select(undefined).then(() => undefined);
        }
        const operation = this.pending.then(async () => {
            if (request !== this.request || workspace !== this.panel.workspace ||
                workspace !== this.controller.project) return;
            // Keep the exact owner reserved while its detail is re-read. Releasing
            // it here lets a concurrent History open create a second Work panel.
            if (!selection || this.panel.work?.kind !== selection.kind || this.panel.work.id !== selection.id)
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
