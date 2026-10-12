import { injectable, inject } from '@theia/core/shared/inversify';
import { ApplicationShell, FrontendApplicationContribution } from '@theia/core/lib/browser';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { EditorWidget } from '@theia/editor/lib/browser/editor-widget';
import type { HistoryFocusTarget } from '@dope/contracts/lib/history';
import type { HistoryService } from '@dope/contracts/lib/history-service';
import { ChatPanelWidget } from './chat-panel-widget';
import { PhysicalMapWidget } from './physical-map-widget';
import { editorFocusTarget } from './history-focus-target';

/** Observe actual foreground focus. Layout restoration remains Theia-owned. */
@injectable()
export class HistoryFocusContribution implements FrontendApplicationContribution {
    private generation = 0;
    private projectUri?: string;
    private handle?: string;
    private pending?: ReturnType<typeof setTimeout>;
    private ready = false;
    private attaching: Promise<void> = Promise.resolve();

    constructor(@inject(ApplicationShell) private readonly shell: ApplicationShell,
        @inject(WorkspaceService) private readonly workspaces: WorkspaceService,
        @inject('HistoryFocusService') private readonly service: HistoryService) {}

    async onDidInitializeLayout(): Promise<void> {
        this.workspaces.onWorkspaceChanged(() => { void this.attach(); });
        this.shell.onDidChangeActiveWidget(() => this.schedule());
        const foreground = (event: Event) => {
            const widget = this.shell.activeWidget;
            if (widget && event.target instanceof Node && widget.node.contains(event.target)) this.schedule();
        };
        document.addEventListener('focusin', foreground);
        document.addEventListener('click', foreground);
        document.addEventListener('change', foreground);
        await this.attach();
        this.ready = true;
    }

    private attach(): Promise<void> {
        const generation = ++this.generation;
        if (this.pending) clearTimeout(this.pending);
        this.pending = undefined;
        this.projectUri = undefined;
        this.handle = undefined;
        const next = this.attaching.then(async () => {
            try {
                const roots = await this.workspaces.roots;
                if (generation !== this.generation || roots.length !== 1 || roots[0].resource.scheme !== 'file') return;
                const uri = roots[0].resource.toString();
                const { projectHandle } = await this.service.attach(uri);
                if (generation !== this.generation) return;
                this.projectUri = uri;
                this.handle = projectHandle;
            } catch { /* Focus is optional; normal work stays available. */ }
        });
        this.attaching = next;
        return next;
    }

    private target(): HistoryFocusTarget | undefined {
        const widget = this.shell.activeWidget;
        if (widget instanceof ChatPanelWidget) return widget.historyFocusTarget(this.projectUri);
        if (widget instanceof PhysicalMapWidget) return widget.historyFocusTarget(this.projectUri);
        if (widget instanceof EditorWidget) return editorFocusTarget(this.projectUri, widget.getResourceUri()?.toString());
        return undefined;
    }

    private schedule(): void {
        if (!this.ready || !this.handle) return;
        if (this.pending) clearTimeout(this.pending);
        const generation = this.generation, handle = this.handle;
        this.pending = setTimeout(() => {
            this.pending = undefined;
            if (generation !== this.generation) return;
            const owner = this.target();
            if (owner) void this.service.recordFocus(handle, owner).catch(() => {});
        }, 250);
    }
}
