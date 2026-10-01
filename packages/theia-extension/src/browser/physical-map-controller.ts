import type { GraphNode, GraphRelationship, SoftwareMapPage, SoftwareMapService } from '@dope/software-map';
import type { SoftwareMapController } from './software-map-controller';
import { projectPhysicalMap } from './physical-map-projection';
import type { CanvasProjection } from './physical-map-projection';

export interface PhysicalMapTabOptions { workspace: string; focusId: string }
export const physicalMapTabOptions = (workspace: string, focusId: string): PhysicalMapTabOptions => ({ workspace, focusId });
export const physicalMapTabId = (options: PhysicalMapTabOptions): string =>
    `dope-physical-map-canvas:${encodeURIComponent(options.workspace)}:${encodeURIComponent(options.focusId)}`;

/** Reads the inspector's published graph and fetches only visible dependency edges. */
export class PhysicalMapController {
    projection: CanvasProjection = { nodes: [], edges: [], oneSystem: false };
    loading = false;
    error = '';
    private request = 0;
    private loadedKey = '';
    private disposed = false;
    private readonly listener;
    private relationships: GraphRelationship[] = [];
    private activeWorkspace?: string;
    focusId?: string;

    constructor(private readonly map: SoftwareMapController, private readonly service: SoftwareMapService,
        private readonly changed: () => void, private readonly workspace?: string, focusId?: string) {
        this.focusId = focusId;
        this.activeWorkspace = map.workspace;
        this.listener = map.onChange(() => { this.changed(); void this.refresh(); });
        void this.refresh();
    }

    get selectedId(): string | undefined { return this.map.selectedId; }
    get projectMatches(): boolean { return !this.workspace || this.workspace === this.map.workspace; }
    get breadcrumbs(): GraphNode[] {
        const path: GraphNode[] = [];
        for (let node = this.map.nodes.find(item => item.id === this.focusId); node;
            node = this.map.nodes.find(item => item.id === node!.parentId)) path.unshift(node);
        return path;
    }
    select(id: string): void { if (this.available()) void this.map.select(id); }
    focus(id = this.selectedId): void {
        if (!this.available() || !id || !this.map.nodes.some(node => node.id === id && node.kind !== 'project')) return;
        this.focusId = id;
        this.loadedKey = '';
        void this.refresh();
    }
    up(): void {
        const parent = this.map.nodes.find(node => node.id === this.focusId)?.parentId;
        if (parent && this.map.nodes.some(node => node.id === parent && node.kind !== 'project')) this.focus(parent);
        else this.fit();
    }
    fit(): void { this.focusId = undefined; this.loadedKey = ''; void this.refresh(); }
    private available(): boolean { return !this.disposed && !!this.map.workspace && (!this.workspace || this.workspace === this.map.workspace); }
    async source() {
        if (!this.available()) return;
        const node = this.map.nodes.find(item => item.id === this.selectedId);
        if (!node) return;
        for (const id of node.evidenceIds) {
            const location = await this.map.source(id);
            if (!this.available() || this.selectedId !== node.id) return;
            if (location) return location;
        }
    }

    private async pages(fetch: (offset: number) => Promise<SoftwareMapPage<GraphRelationship>>, generation: number): Promise<GraphRelationship[]> {
        const items: GraphRelationship[] = [];
        for (let offset = 0; ; offset += 200) {
            const page = await fetch(offset);
            if (page.generation !== generation) throw new Error('Software Map changed while loading the canvas');
            items.push(...page.items);
            if (items.length >= page.total) return items;
        }
    }

    async refresh(): Promise<void> {
        if (!this.workspace && this.activeWorkspace !== this.map.workspace) {
            this.activeWorkspace = this.map.workspace;
            this.focusId = undefined;
        }
        const status = this.map.status;
        if (!this.available() || this.map.loading || status?.state !== 'ready' || status.generation !== status.publishedGeneration) {
            ++this.request;
            this.loadedKey = '';
            this.projection = { nodes: [], edges: [], oneSystem: false };
            this.loading = !!this.map.workspace && !!this.map.loading;
            this.changed();
            return;
        }
        const workspace = this.map.workspace!;
        if (this.focusId && this.map.nodes.length && !this.map.nodes.some(node => node.id === this.focusId)) this.focusId = undefined;
        const key = `${workspace}:${status.generation}:${this.map.nodes.length}:${this.map.violations.length}:${this.focusId ?? ''}`;
        if (key === this.loadedKey) return;
        const request = ++this.request;
        this.loadedKey = key;
        this.projection = { nodes: [], edges: [], oneSystem: false };
        this.loading = true;
        this.error = '';
        this.changed();
        try {
            const attached = await this.service.attach(workspace);
            if (request !== this.request || !this.available() || this.map.workspace !== workspace || attached.status.publishedGeneration !== status.generation) return;
            const visible = this.focusId ? this.map.nodes.filter(node => node.id === this.focusId || node.parentId === this.focusId) :
                this.map.nodes.filter(node => node.kind === 'system' || node.kind === 'subsystem');
            const groups = await Promise.all(visible.flatMap(node => (['incoming', 'outgoing'] as const).map(direction => this.pages(offset => this.service.relationships({
                projectHandle: attached.projectHandle, nodeId: node.id, direction,
                kinds: node.kind === 'code' ? ['imports', 'depends-on', 'references', 'extends', 'implements'] : ['depends-on'],
                scope: node.kind === 'code' ? 'direct' : 'aggregated', offset, limit: 200
            }), status.generation))));
            if (request !== this.request || !this.available() || this.map.workspace !== workspace || this.map.status?.generation !== status.generation) return;
            this.relationships = [...new Map(groups.flat().map(edge => [edge.id, edge])).values()];
            this.projection = projectPhysicalMap(this.map.nodes, this.relationships, this.map.violations, this.focusId);
        } catch (error) {
            if (request === this.request && this.available()) this.error = String(error);
        } finally {
            if (request === this.request) { this.loading = false; this.changed(); }
        }
    }

    dispose(): void { this.disposed = true; ++this.request; this.listener.dispose(); }
}
