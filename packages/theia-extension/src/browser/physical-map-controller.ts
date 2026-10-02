import type { Evidence, FlowQueryResult, GraphNode, GraphRelationship, SoftwareMapPage } from '@dope/software-map';
import type { SoftwareMapController } from './software-map-controller';
import { projectPhysicalMap } from './physical-map-projection';
import type { CanvasProjection, SemanticDetail } from './physical-map-projection';
import { projectFlowMap } from './flow-map-projection';
import type { FlowCanvasProjection } from './flow-map-projection';

export interface PhysicalMapTabOptions { workspace: string; focusId: string }
export const physicalMapTabOptions = (workspace: string, focusId: string): PhysicalMapTabOptions => ({ workspace, focusId });
export const physicalMapTabId = (options: PhysicalMapTabOptions): string =>
    `dope-physical-map-canvas:${encodeURIComponent(options.workspace)}:${encodeURIComponent(options.focusId)}`;

/** Reads the inspector's published graph and fetches only visible dependency edges. */
export class PhysicalMapController {
    projection: CanvasProjection = { nodes: [], edges: [], oneSystem: false };
    flowProjection?: FlowCanvasProjection;
    flowResult?: FlowQueryResult;
    flowEvidence: Evidence[] = [];
    mode: 'architecture' | 'flow' = 'architecture';
    direction?: 'upstream' | 'downstream';
    selectedEndpointId?: string;
    selectedFlowEdgeId?: string;
    loading = false;
    error = '';
    private request = 0;
    private loadedKey = '';
    private disposed = false;
    private readonly listener;
    private relationships: GraphRelationship[] = [];
    private activeWorkspace?: string;
    private selectedPlannedId?: string;
    focusId?: string;
    detail: SemanticDetail = 'architecture';

    constructor(private readonly map: SoftwareMapController, private readonly changed: () => void,
        private readonly workspace?: string, focusId?: string) {
        this.focusId = focusId;
        this.activeWorkspace = map.workspace;
        this.listener = map.onChange(() => { this.changed(); void this.refresh(); });
        void this.refresh();
    }

    get selectedId(): string | undefined { return this.projectMatches ? this.selectedPlannedId ?? this.map.selectedId : undefined; }
    get flowSelectedId(): string | undefined { return this.mode === 'flow' ? this.selectedEndpointId ?? this.map.selectedId : undefined; }
    get selectedFlowEdge() { return this.flowProjection?.edges.find(edge => edge.id === this.selectedFlowEdgeId); }
    get sourceNodes(): GraphNode[] { return this.projectMatches && !this.loading ? this.map.nodes : []; }
    get sourceRelationships(): GraphRelationship[] { return this.projectMatches && !this.loading ? this.relationships : []; }
    get sourceViolations() { return this.projectMatches && !this.loading ? this.map.violations : []; }
    get projectMatches(): boolean { return !this.workspace || this.workspace === this.map.workspace; }
    get mapWorkspace(): string | undefined { return this.map.workspace; }
    get mapGeneration(): number | undefined { return this.map.status?.generation; }
    get breadcrumbs(): GraphNode[] {
        const path: GraphNode[] = [];
        for (let node = this.map.nodes.find(item => item.id === this.focusId); node;
            node = this.map.nodes.find(item => item.id === node!.parentId)) path.unshift(node);
        return path;
    }
    select(id: string): void {
        if (!this.available()) return;
        this.selectedFlowEdgeId = undefined; this.flowEvidence = [];
        if (this.mode === 'flow' && !this.map.nodes.some(node => node.id === id)) {
            this.selectedEndpointId = id; this.direction = undefined; void this.refresh(); return;
        }
        this.selectedEndpointId = undefined; this.direction = undefined;
        this.selectedPlannedId = undefined; void this.map.select(id);
    }
    setMode(mode: 'architecture' | 'flow'): void {
        if (this.mode === mode) return;
        this.mode = mode; this.direction = undefined; this.selectedFlowEdgeId = undefined; this.flowEvidence = [];
        this.loadedKey = ''; void this.refresh();
    }
    trace(direction?: 'upstream' | 'downstream'): void {
        if (this.mode !== 'flow' || direction && (!this.flowSelectedId || !this.flowResult ||
            ![...this.flowResult.nodes, ...this.flowResult.endpoints].some(item => item.id === this.flowSelectedId))) return;
        this.direction = direction; this.loadedKey = ''; void this.refresh();
    }
    async inspectFlowEdge(id: string): Promise<void> {
        if (this.mode !== 'flow' || !this.available()) return;
        const edge = this.flowProjection?.edges.find(item => item.id === id);
        if (!edge) return;
        this.selectedFlowEdgeId = id; this.flowEvidence = []; this.changed();
        const request = this.request, workspace = this.map.workspace, generation = this.map.status?.generation;
        if (!generation) return;
        try {
            const ids = [...new Set([...edge.evidenceIds, ...edge.behaviorEvidenceIds,
                ...edge.enrichment.flatMap(item => item.evidenceIds)])];
            const evidence = await this.map.evidenceDetails(ids, generation);
            if (request === this.request && this.available() && this.mode === 'flow' &&
                this.map.workspace === workspace && this.map.status?.generation === generation && this.selectedFlowEdgeId === id) {
                this.flowEvidence = evidence; this.changed();
            }
        } catch (error) {
            if (request === this.request && this.selectedFlowEdgeId === id) { this.error = String(error); this.changed(); }
        }
    }
    async flowSource() {
        const edge = this.selectedFlowEdge;
        if (!edge || !this.available()) return;
        const request = this.request, id = edge.id;
        for (const evidenceId of edge.evidenceIds) {
            const location = await this.map.source(evidenceId);
            if (request !== this.request || this.mode !== 'flow' || this.selectedFlowEdgeId !== id || !this.available()) return;
            if (location) return location;
        }
    }
    selectPlanned(id: string): void { if (this.available()) { this.selectedPlannedId = id; this.changed(); } }
    setDetail(detail: SemanticDetail): void {
        if (this.detail === detail) return;
        this.detail = detail;
        void this.refresh();
    }
    clearPlannedSelectionIfAbsent(ids: string[]): void {
        if (this.selectedPlannedId && !ids.includes(this.selectedPlannedId)) this.selectedPlannedId = undefined;
    }
    focus(id = this.selectedId): void {
        if (!this.available() || !id || !this.map.nodes.some(node => node.id === id && node.kind !== 'project')) return;
        this.focusId = id;
        this.loadedKey = ''; this.selectedEndpointId = undefined; this.direction = undefined; this.selectedFlowEdgeId = undefined;
        void this.refresh();
    }
    up(): void {
        const parent = this.map.nodes.find(node => node.id === this.focusId)?.parentId;
        if (parent && this.map.nodes.some(node => node.id === parent && node.kind !== 'project')) this.focus(parent);
        else this.fit();
    }
    fit(): void { this.focusId = undefined; this.loadedKey = ''; this.selectedEndpointId = undefined; this.direction = undefined; this.selectedFlowEdgeId = undefined; void this.refresh(); }
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
            this.selectedPlannedId = undefined;
            this.selectedEndpointId = undefined; this.selectedFlowEdgeId = undefined; this.direction = undefined; this.flowEvidence = [];
        }
        const status = this.map.status;
        if (!this.available() || this.map.loading || status?.state !== 'ready' || status.generation !== status.publishedGeneration) {
            ++this.request;
            this.loadedKey = '';
            this.projection = { nodes: [], edges: [], oneSystem: false };
            this.flowProjection = undefined; this.flowResult = undefined; this.flowEvidence = [];
            this.loading = !!this.map.workspace && !!this.map.loading;
            this.changed();
            return;
        }
        const workspace = this.map.workspace!;
        if (this.focusId && this.map.nodes.length && !this.map.nodes.some(node => node.id === this.focusId)) this.focusId = undefined;
        if (this.mode === 'flow') { await this.refreshFlow(status.generation); return; }
        const selectedId = this.map.nodes.some(node => node.id === this.selectedId && node.kind !== 'project') ? this.selectedId : undefined;
        const key = `${workspace}:${status.generation}:${this.map.nodes.length}:${this.map.violations.length}:${this.focusId ?? ''}:${this.detail}:${selectedId ?? ''}`;
        if (key === this.loadedKey) return;
        const request = ++this.request;
        this.loadedKey = key;
        this.projection = { nodes: [], edges: [], oneSystem: false };
        this.loading = true;
        this.error = '';
        this.changed();
        try {
            const visibleIds = projectPhysicalMap(this.map.nodes, [], this.map.violations, this.focusId,
                { detail: this.detail }).nodes.map(node => node.id);
            if (selectedId) visibleIds.push(selectedId);
            const visible = [...new Set(visibleIds)].map(id => this.map.nodes.find(node => node.id === id))
                .filter((node): node is GraphNode => !!node);
            const groups = await Promise.all(visible.flatMap(node => (['incoming', 'outgoing'] as const).map(direction => this.pages(offset => this.map.relationshipPage({
                nodeId: node.id, direction,
                kinds: node.kind === 'code' ? ['imports', 'depends-on', 'references', 'extends', 'implements'] : ['depends-on'],
                scope: node.kind === 'code' ? 'direct' : 'aggregated', offset, limit: 200
            }, status.generation), status.generation))));
            if (request !== this.request || !this.available() || this.map.workspace !== workspace || this.map.status?.generation !== status.generation) return;
            this.relationships = [...new Map(groups.flat().map(edge => [edge.id, edge])).values()];
            this.projection = projectPhysicalMap(this.map.nodes, this.relationships, this.map.violations, this.focusId,
                { detail: this.detail, selectedId });
        } catch (error) {
            if (request === this.request && this.available() && this.map.status?.generation === status.generation) {
                this.loadedKey = ''; this.error = String(error);
            }
        } finally {
            if (request === this.request) { this.loading = false; this.changed(); }
        }
    }

    private async refreshFlow(generation: number): Promise<void> {
        const workspace = this.map.workspace!;
        const systems = this.map.nodes.filter(node => node.kind === 'system');
        const focus = this.focusId ? this.map.nodes.find(node => node.id === this.focusId) :
            systems.find(node => node.id === this.map.selectedId) ?? (systems.length === 1 ? systems[0] : undefined);
        const selected = this.flowSelectedId;
        const key = `${workspace}:${generation}:flow:${focus?.id ?? ''}:${selected ?? ''}:${this.direction ?? ''}`;
        if (key === this.loadedKey) return;
        const request = ++this.request;
        this.loadedKey = key; this.flowProjection = undefined; this.flowResult = undefined;
        this.selectedFlowEdgeId = undefined; this.flowEvidence = [];
        this.loading = !!focus; this.error = ''; this.changed();
        if (!focus) return;
        try {
            const result = await this.map.flowQuery({ generation, focusId: focus.id });
            const trace = this.direction && selected &&
                (result.nodes.some(node => node.id === selected) || result.endpoints.some(endpoint => endpoint.id === selected))
                ? await this.map.flowQuery({ generation, focusId: focus.id, selectedId: selected, direction: this.direction }) : undefined;
            if (request !== this.request || !this.available() || this.mode !== 'flow' ||
                this.map.workspace !== workspace || this.map.status?.generation !== generation) return;
            this.flowResult = result;
            const visibleSelection = selected && (result.nodes.some(node => node.id === selected) ||
                result.endpoints.some(endpoint => endpoint.id === selected)) ? selected : undefined;
            this.flowProjection = projectFlowMap(result, { kind: focus.kind === 'system' ? 'system' : 'subsystem' },
                { selectedId: visibleSelection, traceFactIds: trace?.facts.map(fact => fact.id) });
            if (trace?.truncated) {
                this.flowProjection.truncated = true;
                this.flowProjection.coverageStatus = 'truncated';
                this.flowProjection.truncation = trace.truncation;
            }
        } catch (error) {
            if (request === this.request && this.available() && this.mode === 'flow' &&
                this.map.workspace === workspace && this.map.status?.generation === generation) {
                this.loadedKey = ''; this.error = String(error);
            }
        } finally {
            if (request === this.request) { this.loading = false; this.changed(); }
        }
    }

    dispose(): void { this.disposed = true; ++this.request; this.listener.dispose(); }
}
