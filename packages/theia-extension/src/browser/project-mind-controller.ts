import type { Artifact, ProjectMind, ProjectMindOperation } from '@dope/contracts/lib/project-mind';
import type { ProjectMindClient, ProjectMindService } from '@dope/contracts/lib/project-mind-service';

export type MindConnection = ProjectMindService & { setClient(client: ProjectMindClient | undefined): void; dispose(): void };

export class ProjectMindController {
    workspace: string | undefined;
    snapshot: ProjectMind | undefined;
    selectedId: string | undefined;
    draft: Artifact | undefined;
    dirty = false;
    pending = false;
    pendingOperation: ProjectMindOperation['type'] | 'migrate' | undefined;
    baseRevision = 0;
    stale = false;
    loading = false;
    error = '';
    private connection: MindConnection | undefined;
    private handle: string | undefined;
    private generation = 0;
    private request = 0;
    private eventRevision = 0;
    private draftVersion = 0;
    private disposed = false;

    constructor(private readonly connect: () => MindConnection, private readonly changed: () => void) { }

    get canLeave(): boolean { return !this.dirty && !this.pending; }
    get attached(): boolean { return !!this.handle; }
    get projectId(): string | undefined { return this.snapshot?.projectId; }
    get revision(): number { return this.snapshot?.revision ?? 0; }

    private disconnect(): void {
        this.connection?.setClient(undefined);
        if (this.connection) void Promise.resolve(this.connection.dispose()).catch(() => {});
        this.connection = undefined;
    }

    async attach(workspace: string | undefined, discard = false): Promise<boolean> {
        if (this.disposed || !discard && !this.canLeave) return false;
        const generation = ++this.generation;
        ++this.request;
        this.disconnect();
        this.handle = undefined;
        this.workspace = workspace;
        this.snapshot = undefined;
        this.selectedId = undefined;
        this.draft = undefined;
        this.dirty = false;
        this.pending = false;
        this.pendingOperation = undefined;
        this.baseRevision = 0;
        this.stale = false;
        this.eventRevision = 0;
        this.error = '';
        this.loading = !!workspace;
        this.changed();
        if (!workspace) return true;
        try {
            const connection = this.connect();
            this.connection = connection;
            connection.setClient({ notifyProjectMindChanged: event => {
                if (this.disposed || generation !== this.generation || this.projectId && event.projectId !== this.projectId) return;
                if (event.revision <= this.revision) return;
                this.eventRevision = Math.max(this.eventRevision, event.revision);
                if (this.dirty || this.pending) { this.stale = true; this.changed(); }
                else void this.refresh();
            } });
            const attached = await connection.attach(workspace);
            if (generation !== this.generation || this.disposed) return true;
            this.handle = attached.projectHandle;
            this.snapshot = attached.snapshot;
            this.baseRevision = this.revision;
            this.loading = false;
            this.changed();
            if (this.eventRevision > this.revision) void this.refresh();
        } catch (error) {
            if (generation === this.generation && !this.disposed) { this.loading = false; this.error = String(error); this.changed(); }
        }
        return true;
    }

    select(id: string | undefined): boolean {
        if (!this.canLeave) return false;
        const artifact = this.snapshot?.artifacts.find(item => item.id === id);
        if (id && !artifact) return false;
        this.selectedId = id;
        this.draft = artifact ? structuredClone(artifact) : undefined;
        this.dirty = false;
        this.error = '';
        this.changed();
        return true;
    }

    create(type: Artifact['type']): boolean {
        if (!this.canLeave || !this.handle) return false;
        const now = new Date().toISOString();
        const base = { schemaVersion: 2 as const, id: crypto.randomUUID(), title: '', createdAt: now, updatedAt: now,
            provenance: 'developer' as const, archivedAt: null, links: [] };
        this.selectedId = undefined;
        this.draft = type === 'decision' ? { ...base, type, status: 'proposed', decision: '', context: '', rationale: '', consequences: '', alternatives: '', revisitConditions: '' } :
            type === 'question' ? { ...base, type, status: 'open', body: '' } :
            type === 'idea' ? { ...base, type, status: 'captured', body: '' } : { ...base, type, status: 'active', body: '' };
        this.dirty = true;
        this.error = '';
        this.changed();
        return true;
    }

    edit(field: string, value: string): void {
        if (!this.draft || this.pending || !(field in this.draft) && field !== 'answer') return;
        this.draft = { ...this.draft, [field]: value } as Artifact;
        ++this.draftVersion;
        this.dirty = true;
    }

    async save(): Promise<boolean> {
        if (!this.draft || !this.dirty) return true;
        const artifact = { ...this.draft, updatedAt: new Date().toISOString() };
        return this.mutate({ type: this.selectedId ? 'replace' : 'create', artifact });
    }

    async mutate(operation: ProjectMindOperation): Promise<boolean> {
        if (this.pending || this.dirty && operation.type !== 'create' && operation.type !== 'replace' || !this.connection || !this.handle || this.stale) {
            this.error = this.stale ? 'Project Mind changed elsewhere. Copy your draft, then reload and reconcile.' : 'Save or discard the current draft first.';
            this.changed();
            return false;
        }
        const generation = this.generation;
        const connection = this.connection;
        const projectId = this.projectId;
        const currentRequest = ++this.request;
        this.pending = true;
        this.pendingOperation = operation.type;
        this.error = '';
        this.changed();
        try {
            const snapshot = await connection.mutate({ projectHandle: this.handle, expectedRevision: this.baseRevision, operation });
            if (this.disposed || generation !== this.generation || currentRequest !== this.request) return false;
            if (projectId && snapshot.projectId !== projectId) throw new Error('Project Mind identity changed; inspect before retrying');
            this.snapshot = snapshot;
            this.baseRevision = snapshot.revision;
            this.selectedId = operation.type === 'create' || operation.type === 'replace' ? operation.artifact.id : this.selectedId;
            this.draft = this.snapshot.artifacts.find(item => item.id === this.selectedId);
            this.dirty = false;
            this.stale = this.eventRevision > snapshot.revision;
            this.pending = false;
            this.pendingOperation = undefined;
            this.changed();
            if (this.stale) void this.refresh();
            return true;
        } catch (error) {
            if (!this.disposed && generation === this.generation) {
                this.pending = false;
                this.pendingOperation = undefined;
                this.error = `${String(error)}. Draft retained; copy it or reload and reconcile before retrying.`;
                this.stale = true;
                this.changed();
            }
            return false;
        }
    }

    async refresh(discard = false): Promise<boolean> {
        if (!this.connection || !this.handle || this.pending || this.dirty && !discard) return false;
        const generation = this.generation;
        const currentRequest = ++this.request;
        const selected = this.selectedId;
        const projectId = this.projectId;
        const draftVersion = this.draftVersion;
        try {
            const snapshot = await this.connection.read(this.handle);
            if (this.disposed || generation !== this.generation || currentRequest !== this.request) return false;
            if (this.draftVersion !== draftVersion || this.dirty && !discard) {
                if (this.eventRevision > this.revision) { this.stale = true; this.changed(); }
                return false;
            }
            if (projectId && snapshot?.projectId !== projectId) throw new Error('Project Mind identity changed; inspect the project');
            this.snapshot = snapshot;
            this.baseRevision = this.revision;
            this.selectedId = snapshot?.artifacts.some(item => item.id === selected) ? selected : undefined;
            this.draft = snapshot?.artifacts.find(item => item.id === this.selectedId);
            this.dirty = false;
            this.stale = false;
            this.error = '';
            this.changed();
            return true;
        } catch (error) {
            if (!this.disposed && generation === this.generation) { this.error = String(error); this.changed(); }
            return false;
        }
    }

    async migrate(): Promise<boolean> {
        if (!this.connection || !this.handle || !this.canLeave || this.snapshot) return false;
        const generation = this.generation;
        this.pending = true;
        this.pendingOperation = 'migrate';
        this.changed();
        try {
            const snapshot = await this.connection.migrate(this.handle);
            if (this.disposed || generation !== this.generation) return false;
            this.snapshot = snapshot;
            this.baseRevision = snapshot.revision;
            this.pending = false;
            this.pendingOperation = undefined;
            this.stale = this.eventRevision > snapshot.revision;
            this.error = '';
            this.changed();
            if (this.stale) void this.refresh();
            return true;
        } catch (error) {
            if (!this.disposed && generation === this.generation) { this.pending = false; this.pendingOperation = undefined; this.error = String(error); this.changed(); }
            return false;
        }
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        ++this.generation;
        ++this.request;
        this.disconnect();
    }
}
