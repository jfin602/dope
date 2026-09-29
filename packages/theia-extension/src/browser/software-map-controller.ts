import { parseArchitecture } from '@dope/software-map';
import type { ArchitectureDeclaration, ArchitectureReview, ArchitectureReviewNode, ArchitectureViolation, Evidence, GraphNode, SoftwareMapPage, GraphRelationship, SoftwareMapStatus, SoftwareMapClient, SoftwareMapService, SoftwareMapInitializationStatus } from '@dope/software-map';

export type SoftwareMapConnection = SoftwareMapService & { setClient(client: SoftwareMapClient | undefined): void };
export interface SynthesisPreferenceStore {
    getData<T>(key: string): Promise<T | undefined>;
    setData<T>(key: string, value: T): Promise<void>;
}
const preferenceKey = 'dope.smap.synthesis';
const declinedThisSession = new Set<string>();
type SynthesisChoice = { endpoint: string; model: string };

export function declarationFromDraft(draft: ArchitectureReviewNode[]): ArchitectureDeclaration {
    if (draft.some(node => node.kind === 'system' && node.parentProposalKey !== null)) throw new Error('Systems cannot have a parent');
    const systems = draft.filter(node => node.kind === 'system').map(system => ({
        id: system.id, name: system.name, purpose: system.purpose,
        ...(system.roots.length ? { roots: system.roots } : {}),
        subsystems: draft.filter(node => node.kind === 'subsystem' && node.parentProposalKey === system.proposalKey).map(subsystem => ({
            id: subsystem.id, name: subsystem.name, purpose: subsystem.purpose, roots: subsystem.roots,
            components: draft.filter(node => node.kind === 'component' && node.parentProposalKey === subsystem.proposalKey).map(component => ({
                id: component.id, name: component.name, purpose: component.purpose, roots: component.roots
            }))
        }))
    }));
    if (draft.some(node => node.kind !== 'system' && !draft.some(parent => parent.proposalKey === node.parentProposalKey &&
        parent.kind === (node.kind === 'subsystem' ? 'system' : 'subsystem')))) throw new Error('Every boundary needs a valid parent');
    return parseArchitecture({ schemaVersion: 1, systems });
}

export class SoftwareMapController {
    workspace?: string;
    status?: SoftwareMapStatus;
    nodes: GraphNode[] = [];
    selectedId?: string;
    selectedViolation?: ArchitectureViolation;
    incoming: GraphRelationship[] = [];
    outgoing: GraphRelationship[] = [];
    offending: GraphRelationship[] = [];
    originEdges: GraphRelationship[] = [];
    originEvidence: Evidence[] = [];
    selectedAggregateId?: string;
    evidence: Evidence[] = [];
    violations: ArchitectureViolation[] = [];
    loading = false;
    error = '';
    initialization?: SoftwareMapInitializationStatus;
    flow: 'none' | 'offer' | 'setup' | 'review' | 'manual' = 'none';
    review?: ArchitectureReview;
    draft: ArchitectureReviewNode[] = [];
    endpoint = 'http://127.0.0.1:1234/v1';
    model = '';
    token = '';
    models: string[] = [];
    setupReady = false;
    setupBusy = false;
    private setupRequest = 0;
    private nextKey = 0;
    private connection?: SoftwareMapConnection;
    private handle?: string;
    private project = 0;
    private request = 0;
    private detailRequest = 0;
    private originRequest = 0;
    private disposed = false;

    constructor(private readonly connect: () => SoftwareMapConnection, private readonly changed: () => void,
        private readonly preferences?: SynthesisPreferenceStore) { }

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
        ++this.setupRequest;
        this.disconnect();
        this.workspace = workspace;
        this.handle = undefined;
        this.status = undefined;
        this.nodes = [];
        this.selectedId = undefined;
        this.clearDetails();
        this.violations = [];
        this.error = '';
        this.initialization = undefined;
        this.flow = 'none';
        this.review = undefined;
        this.draft = [];
        this.models = [];
        this.setupReady = false;
        this.setupBusy = false;
        this.token = '';
        this.loading = !!workspace;
        this.changed();
        if (!workspace) return;
        try {
            const connection = this.connect();
            this.connection = connection;
            connection.setClient({ notifySoftwareMapChanged: status => {
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
            if (this.disposed || project !== this.project) return;
            this.initialization = await connection.initializationStatus(attached.projectHandle);
            if (this.disposed || project !== this.project) return;
            if (this.initialization.state === 'uninitialized' && !declinedThisSession.has(workspace)) this.flow = 'offer';
            this.changed();
        } catch (error) {
            if (!this.disposed && project === this.project) { this.error = String(error); this.loading = false; this.changed(); }
        }
    }
    begin(): void { if (this.initialization?.state === 'uninitialized') { this.flow = 'offer'; this.error = ''; this.changed(); } }
    decline(): void {
        if (this.workspace) declinedThisSession.add(this.workspace);
        this.flow = 'none';
        this.error = '';
        this.changed();
    }
    async setup(): Promise<void> {
        if (!this.handle || !this.connection) return;
        const project = this.project;
        const request = ++this.setupRequest;
        this.flow = 'setup';
        this.setupReady = false;
        this.error = '';
        this.changed();
        try {
            const choice = await this.preferences?.getData<SynthesisChoice>(preferenceKey);
            if (project !== this.project || request !== this.setupRequest) return;
            this.endpoint = choice?.endpoint || this.endpoint;
            this.model = choice?.model || '';
            await this.discover();
        } catch (error) {
            if (project === this.project && request === this.setupRequest) { this.error = String(error); this.changed(); }
        }
    }
    async discover(): Promise<void> {
        if (!this.connection || !this.handle) return;
        const project = this.project;
        const request = ++this.setupRequest;
        const connection = this.connection;
        const handle = this.handle;
        this.setupBusy = true;
        this.setupReady = false;
        this.models = [];
        this.error = '';
        this.changed();
        try {
            const models = await connection.configureSynthesis(handle, { endpoint: this.endpoint, ...(this.token ? { token: this.token } : {}) });
            if (project !== this.project || request !== this.setupRequest) return;
            this.models = models;
            this.model = models.includes(this.model) ? this.model : models.find(id => /qwen3[-_. ]coder[-_. ]30b[-_. ]a3b[-_. ]instruct/i.test(id)) ?? models[0] ?? '';
        } catch (error) {
            if (project === this.project && request === this.setupRequest) this.error = String(error);
        } finally {
            if (project === this.project && request === this.setupRequest) { this.setupBusy = false; this.changed(); }
        }
    }
    changeEndpoint(value: string): void { this.endpoint = value; this.setupReady = false; ++this.setupRequest; }
    changeModel(value: string): void { this.model = value; this.setupReady = false; ++this.setupRequest; }
    changeToken(value: string): void { this.token = value; this.setupReady = false; ++this.setupRequest; }
    async probe(): Promise<void> {
        if (!this.connection || !this.handle || !this.model || !this.models.includes(this.model)) return;
        const project = this.project;
        const request = ++this.setupRequest;
        this.setupBusy = true;
        this.setupReady = false;
        this.error = '';
        this.changed();
        try {
            await this.connection.selectSynthesisModel(this.handle, this.model);
            if (project !== this.project || request !== this.setupRequest) return;
            await this.connection.probeSynthesis(this.handle);
            if (project !== this.project || request !== this.setupRequest) return;
            await this.preferences?.setData(preferenceKey, { endpoint: this.endpoint, model: this.model });
            if (project !== this.project || request !== this.setupRequest) return;
            this.setupReady = true;
        } catch (error) {
            if (project === this.project && request === this.setupRequest) this.error = String(error);
        } finally {
            if (project === this.project && request === this.setupRequest) { this.setupBusy = false; this.changed(); }
        }
    }
    async synthesize(): Promise<void> {
        if (!this.setupReady || !this.connection || !this.handle) return;
        const project = this.project;
        const request = ++this.setupRequest;
        this.setupBusy = true;
        if (this.initialization) this.initialization = { ...this.initialization, state: 'analyzing' };
        this.error = '';
        this.changed();
        try {
            const review = await this.connection.startInitialization(this.handle);
            if (project !== this.project || request !== this.setupRequest) return;
            this.review = review;
            this.draft = structuredClone(review.draft);
            if (this.initialization) this.initialization = { ...this.initialization, state: 'review_required' };
            this.flow = 'review';
        } catch (error) {
            if (project === this.project && request === this.setupRequest) {
                if (this.initialization) this.initialization = { ...this.initialization, state: 'uninitialized' };
                this.error = String(error);
            }
        } finally {
            if (project === this.project && request === this.setupRequest) { this.setupBusy = false; this.changed(); }
        }
    }
    manual(): void {
        if (this.initialization?.state !== 'uninitialized') return;
        this.flow = 'manual';
        this.draft = [];
        this.error = '';
        this.add('system');
    }
    add(kind: ArchitectureReviewNode['kind'], parentProposalKey: string | null = null): void {
        this.draft.push({ proposalKey: `draft:${++this.nextKey}`, kind, id: '', name: '', purpose: '', parentProposalKey, roots: [] });
        this.changed();
    }
    remove(key: string): void {
        const removed = new Set([key]);
        for (let changed = true; changed;) {
            changed = false;
            for (const node of this.draft) if (node.parentProposalKey && removed.has(node.parentProposalKey) && !removed.has(node.proposalKey)) { removed.add(node.proposalKey); changed = true; }
        }
        this.draft = this.draft.filter(node => !removed.has(node.proposalKey));
        this.changed();
    }
    draftError(): string | undefined {
        try { declarationFromDraft(this.draft); return undefined; } catch (error) { return String(error); }
    }
    async accept(): Promise<void> {
        if (!this.connection || !this.handle || !this.initialization || this.draftError()) return;
        const project = this.project;
        const request = ++this.setupRequest;
        this.setupBusy = true;
        this.error = '';
        this.changed();
        try {
            const status = this.review && this.flow === 'review'
                ? await this.connection.acceptReview(this.handle, this.review.reviewId, this.draft)
                : await this.connection.acceptManual(this.handle, declarationFromDraft(this.draft), this.initialization.declarationFingerprint);
            if (project !== this.project || request !== this.setupRequest) return;
            this.initialization = { ...this.initialization, state: 'initialized' };
            this.flow = 'none'; this.review = undefined; this.draft = [];
            this.status = status;
            if (status.state === 'ready') await this.load(status);
        } catch (error) {
            if (project === this.project && request === this.setupRequest) this.error = String(error);
        } finally {
            if (project === this.project && request === this.setupRequest) { this.setupBusy = false; this.changed(); }
        }
    }
    async useExisting(): Promise<void> {
        if (!this.connection || !this.handle || !this.initialization?.declarationPresent) return;
        const project = this.project;
        const request = ++this.setupRequest;
        this.setupBusy = true;
        this.error = '';
        this.changed();
        try {
            const status = await this.connection.acceptExisting(this.handle, this.initialization.declarationFingerprint);
            if (project !== this.project || request !== this.setupRequest) return;
            this.initialization = { ...this.initialization, state: 'initialized' };
            this.flow = 'none'; this.status = status;
            if (status.state === 'ready') await this.load(status);
        } catch (error) {
            if (project === this.project && request === this.setupRequest) this.error = String(error);
        } finally {
            if (project === this.project && request === this.setupRequest) { this.setupBusy = false; this.changed(); }
        }
    }
    async cancel(): Promise<void> {
        const connection = this.connection, handle = this.handle, project = this.project;
        const request = ++this.setupRequest;
        this.setupBusy = true;
        this.error = '';
        this.changed();
        try {
            if (connection && handle) await connection.cancelInitialization(handle);
            if (project !== this.project || request !== this.setupRequest) return;
            this.review = undefined; this.draft = []; this.setupReady = false; this.flow = 'none'; this.token = '';
            if (this.initialization?.state !== 'initialized' && this.initialization) this.initialization = { ...this.initialization, state: 'uninitialized' };
        } catch (error) {
            if (project === this.project && request === this.setupRequest) this.error = String(error);
        } finally {
            if (project === this.project && request === this.setupRequest) { this.setupBusy = false; this.changed(); }
        }
    }
    async reviewSource(ref: string) {
        if (!this.connection || !this.handle || !this.review) return undefined;
        const project = this.project, request = this.setupRequest;
        try {
            const location = await this.connection.resolveReviewSource(this.handle, this.review.reviewId, ref);
            return project === this.project && request === this.setupRequest && this.flow === 'review' ? location : undefined;
        } catch (error) {
            if (project === this.project && request === this.setupRequest) throw error;
            return undefined;
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
    private async pages<T>(fetch: (offset: number) => Promise<SoftwareMapPage<T>>, generation: number): Promise<T[]> {
        const items: T[] = [];
        for (let offset = 0; ; offset += 200) {
            const page = await fetch(offset);
            if (page.generation !== generation) throw new Error('Software Map generation changed during query');
            items.push(...page.items);
            if (items.length >= page.total) return items;
        }
    }
    private async load(status: SoftwareMapStatus): Promise<void> {
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
    private async evidenceFor(ids: string[], connection: SoftwareMapConnection, handle: string, generation: number): Promise<Evidence[]> {
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
    async origins(edge: GraphRelationship): Promise<void> {
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
