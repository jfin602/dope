import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { projectRoadmap, type RoadmapProjection } from '@dope/project-intelligence/lib/roadmap-projection';
import type { RoadmapService } from '../roadmap-service';
import { roadmapCanvasOrder, roadmapNextId } from './roadmap-canvas-model';
import { RoadmapInspectorModel } from './roadmap-inspector-model';

export const ROADMAP_CANVAS_ID = 'dope-roadmap-canvas';

/** A single ordinary center tab; it neither owns nor opens a ChatPanel. */
export class RoadmapCanvasWidget extends BaseWidget {
    private readonly status = document.createElement('p');
    private readonly path = document.createElement('ol');
    private readonly toolbar = document.createElement('header');
    private readonly reload = document.createElement('button');
    private readonly details = document.createElement('button');
    private readonly rootsListener;
    private readonly modelListener;
    private request = 0;
    private projectUri?: string;
    private projection?: RoadmapProjection;
    private selectedId?: string;

    constructor(private readonly service: RoadmapService, private readonly workspaces: WorkspaceService,
        private readonly inspector: RoadmapInspectorModel, private readonly openInspector: () => Promise<unknown>) {
        super();
        this.id = ROADMAP_CANVAS_ID;
        this.title.label = this.title.caption = 'Roadmap';
        this.title.iconClass = codicon('milestone');
        this.title.closable = true;
        this.addClass('dope-roadmap-canvas');
        const heading = document.createElement('h2');
        heading.textContent = 'Roadmap';
        this.reload.type = 'button';
        this.reload.textContent = 'Refresh';
        this.reload.setAttribute('aria-label', 'Refresh Roadmap');
        this.reload.onclick = () => { void this.refresh(); };
        this.details.type = 'button';
        this.details.textContent = 'Details';
        this.details.setAttribute('aria-label', 'Show Roadmap details in left sidebar');
        this.details.onclick = () => { void this.openInspector(); };
        this.toolbar.append(heading, this.details, this.reload);
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.path.setAttribute('aria-label', 'Roadmap checkpoints');
        this.path.onkeydown = event => this.onPathKey(event);
        this.node.append(this.toolbar, this.status, this.path);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.refresh(); });
        this.modelListener = inspector.onChange(() => {
            if (!this.projectUri || inspector.projectUri !== this.projectUri || !inspector.index) return;
            this.selectedId = inspector.selectedId;
            this.projection = projectRoadmap(inspector.index, [], { projectId: inspector.index.projectId, selectedId: this.selectedId });
            this.render();
        });
        void this.refresh();
    }

    async refresh(): Promise<void> {
        const request = ++this.request;
        this.projection = undefined;
        this.path.replaceChildren();
        this.status.textContent = 'Loading Roadmap…';
        try {
            const roots = await this.workspaces.roots;
            if (this.isDisposed || request !== this.request) return;
            if (roots.length !== 1 || roots[0].resource.scheme !== 'file') {
                this.projectUri = undefined;
                this.selectedId = undefined;
                this.status.textContent = 'Open one local project folder to view its Roadmap.';
                this.inspector.setSnapshot(undefined, undefined);
                return;
            }
            const projectUri = roots[0].resource.toString();
            const index = await this.service.read(projectUri);
            if (this.isDisposed || request !== this.request) return;
            if (this.projectUri !== projectUri) this.selectedId = undefined;
            this.projectUri = projectUri;
            this.inspector.setSnapshot(projectUri, index);
            if (index.revision === 0) {
                this.status.textContent = 'No Roadmap index yet. Refresh after checkpoints are created or imported.';
                return;
            }
            this.projection = projectRoadmap(index, [], { projectId: index.projectId, selectedId: this.selectedId });
            this.render();
        } catch (error) {
            if (this.isDisposed || request !== this.request) return;
            this.status.textContent = `Roadmap unavailable: ${error instanceof Error ? error.message : 'Unable to read Roadmap'}. Use Refresh to retry.`;
            this.inspector.setSnapshot(undefined, undefined);
        }
    }

    private render(): void {
        const projection = this.projection;
        if (!projection) return;
        const nodes = roadmapCanvasOrder(projection);
        if (!nodes.some(node => node.id === this.selectedId)) this.selectedId = undefined;
        this.path.replaceChildren();
        for (const node of nodes) {
            const item = document.createElement('li');
            item.className = `dope-roadmap-${node.lane}`;
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.checkpointId = node.id;
            button.setAttribute('aria-current', String(node.id === this.selectedId));
            const predecessors = projection.edges.filter(edge => edge.to === node.id)
                .map(edge => projection.nodes.find(candidate => candidate.id === edge.from)?.title ?? edge.from);
            const relation = predecessors.length ? `${node.lane === 'branch' ? 'Branches from' : 'Depends on'} ${predecessors.join(', ')}` : '';
            button.setAttribute('aria-label', `${node.kind}: ${node.title}; ${node.statusLabel}${relation ? `; ${relation}` : ''}`);
            button.tabIndex = node.id === (this.selectedId ?? nodes[0]?.id) ? 0 : -1;
            const kind = document.createElement('small');
            kind.textContent = node.kind;
            const title = document.createElement('strong');
            title.textContent = node.title;
            const state = document.createElement('span');
            state.className = 'dope-roadmap-status';
            state.textContent = node.statusLabel;
            const context = document.createElement('small');
            context.className = 'dope-roadmap-relation';
            context.textContent = relation;
            button.append(kind, title, context, state);
            button.onclick = () => this.select(node.id);
            item.append(button);
            this.path.append(item);
        }
        const diagnostic = projection.diagnostics.length ? ` · ${projection.diagnostics.length} unresolved reference(s)` : '';
        this.status.textContent = `${nodes.length} checkpoints · Roadmap revision ${projection.revision}${diagnostic}`;
    }

    private select(id: string, focus = false): void {
        if (!this.projection?.nodes.some(node => node.id === id)) return;
        this.selectedId = id;
        this.inspector.select(id);
        this.render();
        if (focus) [...this.path.querySelectorAll<HTMLButtonElement>('button')]
            .find(button => button.dataset.checkpointId === id)?.focus();
    }

    private onPathKey(event: KeyboardEvent): void {
        const target = event.target as HTMLElement;
        const current = target.closest<HTMLButtonElement>('button[data-checkpoint-id]');
        if (!current || !this.path.contains(current)) return;
        const ids = this.projection ? roadmapCanvasOrder(this.projection).map(node => node.id) : [];
        const next = roadmapNextId(ids, current.dataset.checkpointId, event.key);
        if (next === undefined) return;
        event.preventDefault();
        this.select(next, true);
    }

    override dispose(): void { ++this.request; this.rootsListener.dispose(); this.modelListener(); super.dispose(); }
}
