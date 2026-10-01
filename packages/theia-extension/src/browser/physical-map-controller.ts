import type { GraphRelationship, SoftwareMapPage, SoftwareMapService } from '@dope/software-map';
import type { SoftwareMapController } from './software-map-controller';
import { projectPhysicalMap } from './physical-map-projection';
import type { CanvasProjection } from './physical-map-projection';

/** Reads the inspector's published graph and fetches only visible dependency edges. */
export class PhysicalMapController {
    projection: CanvasProjection = { nodes: [], edges: [], oneSystem: false };
    loading = false;
    error = '';
    private request = 0;
    private loadedKey = '';
    private readonly listener;

    constructor(private readonly map: SoftwareMapController, private readonly service: SoftwareMapService,
        private readonly changed: () => void) {
        this.listener = map.onChange(() => void this.refresh());
        void this.refresh();
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
        const status = this.map.status;
        if (!this.map.workspace || this.map.loading || status?.state !== 'ready' || status.generation !== status.publishedGeneration) {
            ++this.request;
            this.loadedKey = '';
            this.projection = { nodes: [], edges: [], oneSystem: false };
            this.loading = !!this.map.workspace && !!this.map.loading;
            this.changed();
            return;
        }
        const workspace = this.map.workspace;
        const key = `${workspace}:${status.generation}:${this.map.nodes.length}:${this.map.violations.length}`;
        if (key === this.loadedKey) return;
        const request = ++this.request;
        this.loadedKey = key;
        this.loading = true;
        this.error = '';
        this.changed();
        try {
            const attached = await this.service.attach(workspace);
            if (request !== this.request || attached.status.publishedGeneration !== status.generation) return;
            const visible = this.map.nodes.filter(node => node.kind === 'system' || node.kind === 'subsystem');
            const groups = await Promise.all(visible.map(node => this.pages(offset => this.service.relationships({
                projectHandle: attached.projectHandle, nodeId: node.id, direction: 'outgoing', kinds: ['depends-on'],
                scope: 'aggregated', offset, limit: 200
            }), status.generation)));
            if (request !== this.request || this.map.workspace !== workspace || this.map.status?.generation !== status.generation) return;
            this.projection = projectPhysicalMap(this.map.nodes, groups.flat(), this.map.violations);
        } catch (error) {
            if (request === this.request) this.error = String(error);
        } finally {
            if (request === this.request) { this.loading = false; this.changed(); }
        }
    }

    dispose(): void { ++this.request; this.listener.dispose(); }
}
