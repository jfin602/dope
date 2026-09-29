import type { ArchitectureViolation, Evidence, ModelNode, ModelPage, ModelRelationship, ModelStatus, SoftwareModelClient, SoftwareModelService } from '@dope/software-model';

export type ModelConnection = SoftwareModelService & { setClient(client: SoftwareModelClient | undefined): void };

export class SoftwareModelController {
    workspace?: string;
    status?: ModelStatus;
    nodes: ModelNode[] = [];
    selectedId?: string;
    selectedViolation?: ArchitectureViolation;
    incoming: ModelRelationship[] = [];
    outgoing: ModelRelationship[] = [];
    offending: ModelRelationship[] = [];
    originEdges: ModelRelationship[] = [];
    originEvidence: Evidence[] = [];
    selectedAggregateId?: string;
    evidence: Evidence[] = [];
    violations: ArchitectureViolation[] = [];
    loading = false;
    error = '';
    private connection?: ModelConnection;
    private handle?: string;
    private project = 0;
    private request = 0;
    private detailRequest = 0;
    private originRequest = 0;
    private disposed = false;

    constructor(private readonly connect: () => ModelConnection, private readonly changed: () => void) { }

    private current(project: number, request: number): boolean {
        return !this.disposed && project === this.project && request === this.request;
    }
    private published(generation: number): boolean {
        return this.status?.state === 'ready' && this.status.publishedGeneration === generation && this.status.generation === generation;
    }
    private disconnect(): void {
        // Theia owns one channel per service path; reattach the shared proxy to switch roots.
        this.connection?.setClient(undefined);
        this.connection = undefined;
    }
    async attach(workspace?: string): Promise<void> {
        if (this.disposed) return;
        const project = ++this.project;
        ++this.request;
        ++this.detailRequest;
        this.disconnect();
        this.workspace = workspace;
        this.handle = undefined;
        this.status = undefined;
        this.nodes = [];
        this.selectedId = undefined;
        this.clearDetails();
        this.violations = [];
        this.error = '';
        this.loading = !!workspace;
        this.changed();
        if (!workspace) return;
        try {
            const connection = this.connect();
            this.connection = connection;
            connection.setClient({ notifySoftwareModelChanged: status => {
                if (this.disposed || project !== this.project || !this.handle || status.generation < (this.status?.generation ?? 0) ||
                    status.generation === this.status?.generation && this.status.state === 'ready' && status.state === 'analyzing') return;
                this.status = status;
                if (status.state === 'analyzing' || status.state === 'failed') {
                    ++this.request;
                    ++this.detailRequest;
                    this.nodes = [];
                    this.violations = [];
                    this.clearDetails();
                    this.loading = status.state === 'analyzing';
                    this.changed();
                } else if (status.state === 'ready') void this.load(status);
            } });
            const attached = await connection.attach(workspace);
            if (this.disposed || project !== this.project) return;
            this.handle = attached.projectHandle;
            this.status = attached.status;
            this.loading = false;
            this.changed();
            const latest = attached.status.state === 'analyzing' ? await connection.status(attached.projectHandle) : attached.status;
            if (this.disposed || project !== this.project) return;
            if (attached.status.state === 'analyzing' && this.status?.state === 'ready' && this.status.generation >= latest.generation) return;
            this.status = latest;
            if (latest.state === 'ready') await this.load(latest);
            else if (latest.state === 'analyzing') { this.loading = true; this.changed(); }
        } catch (error) {
            if (!this.disposed && project === this.project) { this.error = String(error); this.loading = false; this.changed(); }
        }
    }
    async analyze(): Promise<void> {
        if (!this.connection || !this.handle || this.disposed) return;
        const project = this.project;
        const request = ++this.request;
        ++this.detailRequest;
        this.nodes = [];
        this.violations = [];
        this.clearDetails();
        this.loading = true;
        this.error = '';
        this.changed();
        try {
            const status = await this.connection.analyze(this.handle);
            if (!this.current(project, request)) return;
            this.status = status;
            this.loading = false;
            this.changed();
            if (status.state === 'ready') await this.load(status);
        } catch (error) {
            if (this.current(project, request)) { this.error = String(error); this.loading = false; this.changed(); }
        }
    }
    private async pages<T>(fetch: (offset: number) => Promise<ModelPage<T>>, generation: number): Promise<T[]> {
        const items: T[] = [];
        for (let offset = 0; ; offset += 200) {
            const page = await fetch(offset);
            if (page.generation !== generation) throw new Error('Software Model generation changed during query');
            items.push(...page.items);
            if (items.length >= page.total) return items;
        }
    }
    private async load(status: ModelStatus): Promise<void> {
        if (!this.connection || !this.handle || status.state !== 'ready' || status.generation !== status.publishedGeneration) return;
        const project = this.project;
        const request = ++this.request;
        const connection = this.connection;
        const handle = this.handle;
        const generation = status.generation;
        this.loading = true;
        this.nodes = [];
        this.violations = [];
        this.clearDetails();
        this.changed();
        try {
            const [nodes, violations] = await Promise.all([
                this.pages(offset => connection.hierarchy({ projectHandle: handle, descendants: true, offset, limit: 200 }), generation),
                this.pages(offset => connection.violations({ projectHandle: handle, offset, limit: 200 }), generation)
            ]);
            if (!this.current(project, request) || !this.published(generation)) return;
            this.nodes = nodes;
            this.violations = violations;
            this.loading = false;
            this.error = '';
            this.changed();
            if (this.selectedId && nodes.some(node => node.id === this.selectedId)) await this.select(this.selectedId);
            else this.selectedId = undefined;
        } catch (error) {
            if (this.current(project, request)) { this.error = String(error); this.loading = false; this.changed(); }
        }
    }
    private clearDetails(): void {
        ++this.originRequest;
        this.incoming = [];
        this.outgoing = [];
        this.offending = [];
        this.evidence = [];
        this.selectedViolation = undefined;
        this.selectedAggregateId = undefined;
        this.originEdges = [];
        this.originEvidence = [];
    }
    async select(id: string): Promise<void> {
        if (!this.connection || !this.handle || !this.nodes.some(node => node.id === id) || !this.status || !this.published(this.status.generation)) return;
        const project = this.project;
        const request = this.request;
        const detail = ++this.detailRequest;
        const generation = this.status.generation;
        const connection = this.connection;
        const handle = this.handle;
        this.selectedId = id;
        this.clearDetails();
        this.changed();
        try {
            const [incoming, outgoing] = await Promise.all((['incoming', 'outgoing'] as const).map(direction =>
                this.pages(offset => connection.relationships({ projectHandle: handle, nodeId: id, direction, scope: 'all', offset, limit: 200 }), generation)));
            const node = this.nodes.find(item => item.id === id)!;
            const ids = [...new Set([...node.evidenceIds, ...incoming.flatMap(edge => edge.evidenceIds), ...outgoing.flatMap(edge => edge.evidenceIds)])];
            const evidence = await this.evidenceFor(ids, connection, handle, generation);
            if (!this.current(project, request) || detail !== this.detailRequest || !this.published(generation)) return;
            this.incoming = incoming;
            this.outgoing = outgoing;
            this.evidence = evidence;
            this.changed();
        } catch (error) {
            if (this.current(project, request) && detail === this.detailRequest) { this.error = String(error); this.changed(); }
        }
    }
    private async evidenceFor(ids: string[], connection: ModelConnection, handle: string, generation: number): Promise<Evidence[]> {
        const batches = [];
        for (let i = 0; i < ids.length; i += 200) batches.push(this.pages(offset => connection.evidence({ projectHandle: handle, evidenceIds: ids.slice(i, i + 200), offset, limit: 200 }), generation));
        return (await Promise.all(batches)).flat();
    }
    async selectViolation(violation: ArchitectureViolation): Promise<void> {
        if (!this.connection || !this.handle || !this.status || !this.published(this.status.generation)) return;
        const project = this.project;
        const request = this.request;
        const detail = ++this.detailRequest;
        const generation = this.status.generation;
        const connection = this.connection;
        const handle = this.handle;
        this.selectedId = undefined;
        this.clearDetails();
        this.selectedViolation = violation;
        this.changed();
        try {
            const batches = [];
            for (let i = 0; i < violation.originRelationshipIds.length; i += 200) {
                const ids = violation.originRelationshipIds.slice(i, i + 200);
                batches.push(this.pages(offset => connection.relationshipEdges({ projectHandle: handle, relationshipIds: ids, offset, limit: 200 }), generation));
            }
            const [offending, evidence] = await Promise.all([Promise.all(batches).then(items => items.flat()), this.evidenceFor(violation.evidenceIds, connection, handle, generation)]);
            if (!this.current(project, request) || detail !== this.detailRequest || !this.published(generation)) return;
            this.offending = offending;
            this.evidence = evidence;
            this.changed();
        } catch (error) {
            if (this.current(project, request) && detail === this.detailRequest) { this.error = String(error); this.changed(); }
        }
    }
    async origins(edge: ModelRelationship): Promise<void> {
        if (!edge.originRelationshipIds?.length || !this.connection || !this.handle || !this.status || !this.published(this.status.generation)) return;
        const project = this.project;
        const request = this.request;
        const detail = this.detailRequest;
        const origin = ++this.originRequest;
        const generation = this.status.generation;
        const connection = this.connection;
        const handle = this.handle;
        this.selectedAggregateId = edge.id;
        this.originEdges = [];
        this.originEvidence = [];
        this.changed();
        try {
            const batches = [];
            for (let i = 0; i < edge.originRelationshipIds.length; i += 200) {
                const ids = edge.originRelationshipIds.slice(i, i + 200);
                batches.push(this.pages(offset => connection.relationshipEdges({ projectHandle: handle, relationshipIds: ids, offset, limit: 200 }), generation));
            }
            const edges = (await Promise.all(batches)).flat();
            if (!this.current(project, request) || detail !== this.detailRequest || origin !== this.originRequest || !this.published(generation)) return;
            const evidence = await this.evidenceFor([...new Set(edges.flatMap(item => item.evidenceIds))], connection, handle, generation);
            if (!this.current(project, request) || detail !== this.detailRequest || origin !== this.originRequest || !this.published(generation)) return;
            this.originEdges = edges;
            this.originEvidence = evidence;
            this.changed();
        } catch (error) {
            if (this.current(project, request) && origin === this.originRequest) { this.error = String(error); this.changed(); }
        }
    }
    async source(evidenceId: string) {
        if (!this.connection || !this.handle || !this.status || !this.published(this.status.generation)) return;
        const project = this.project;
        const request = this.request;
        const generation = this.status.generation;
        const location = await this.connection.resolveSource(this.handle, evidenceId);
        return this.current(project, request) && this.published(generation) ? location : undefined;
    }
    dispose(): void {
        this.disposed = true;
        ++this.project;
        ++this.request;
        ++this.detailRequest;
        this.disconnect();
    }
}
