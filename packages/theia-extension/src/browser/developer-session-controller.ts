import type { DeveloperSession, SessionCollection } from '@dope/contracts/lib/developer-session';
import type { DeveloperSessionService, SessionMutationResult, SessionOperation, SessionResolveResult } from '@dope/contracts/lib/developer-session-service';
import type { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';

type SessionConnection = DeveloperSessionService & { dispose(): void | Promise<void> };

/** Presentation state only. The backend snapshot and its revisions remain authoritative. */
export class DeveloperSessionController {
    workspace?: string;
    snapshot?: SessionCollection;
    selectedId?: string;
    resolution?: SessionResolveResult;
    loading = false;
    pending = false;
    error = '';
    private connection?: SessionConnection;
    private handle?: string;
    private token = 0;
    private disposed = false;
    private readonly rootsListener;

    constructor(private readonly connect: () => SessionConnection, private readonly workspaces: WorkspaceService,
        private readonly changed: () => void) {
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.attach(); });
    }

    get revision(): number { return this.snapshot?.revision ?? 0; }
    get selected(): DeveloperSession | undefined {
        return this.snapshot?.sessions.find(session => session.id === this.selectedId);
    }
    get attached(): boolean { return !!this.handle; }

    private retire(): number {
        const token = ++this.token;
        const connection = this.connection;
        this.connection = undefined;
        this.handle = undefined;
        if (connection) void Promise.resolve(connection.dispose()).catch(() => {});
        this.workspace = undefined;
        this.snapshot = undefined;
        this.selectedId = undefined;
        this.resolution = undefined;
        this.loading = false;
        this.pending = false;
        this.error = '';
        this.changed();
        return token;
    }

    /** Called on first display and by the workspace event. Only one local root is supported. */
    async attach(): Promise<void> {
        if (this.disposed) return;
        const token = this.retire();
        this.loading = true;
        this.changed();
        try {
            const roots = await this.workspaces.roots;
            if (this.disposed || token !== this.token) return;
            if (roots.length !== 1) {
                this.loading = false;
                this.error = 'Open one local project folder to use Development Sessions.';
                this.changed();
                return;
            }
            const workspace = roots[0].resource.toString();
            this.workspace = workspace;
            const connection = this.connect();
            this.connection = connection;
            const attached = await connection.attach(workspace);
            if (this.disposed || token !== this.token) return;
            this.handle = attached.projectHandle;
            this.snapshot = attached.snapshot;
            this.loading = false;
            this.changed();
        } catch (error) {
            if (this.disposed || token !== this.token) return;
            this.handle = undefined;
            this.snapshot = undefined;
            this.loading = false;
            this.error = String(error);
            this.changed();
        }
    }

    select(id?: string): boolean {
        if (this.disposed || id && !this.snapshot?.sessions.some(session => session.id === id)) return false;
        if (id === this.selectedId) return true;
        ++this.token;
        this.selectedId = id;
        this.resolution = undefined;
        this.loading = false;
        this.error = '';
        this.changed();
        return true;
    }

    async refresh(): Promise<boolean> {
        const connection = this.connection;
        const handle = this.handle;
        if (this.disposed || !connection || !handle || this.pending) return false;
        const token = ++this.token;
        this.loading = true;
        this.resolution = undefined;
        this.error = '';
        this.changed();
        try {
            const snapshot = await connection.read(handle);
            if (this.disposed || token !== this.token) return false;
            this.snapshot = snapshot;
            if (this.selectedId && !snapshot.sessions.some(session => session.id === this.selectedId)) this.selectedId = undefined;
            this.loading = false;
            this.changed();
            return true;
        } catch (error) {
            if (this.disposed || token !== this.token) return false;
            if (/Invalid or disposed Development Sessions handle/i.test(String(error))) {
                this.retire();
                this.error = String(error);
                this.changed();
                return false;
            }
            this.loading = false;
            this.error = String(error);
            this.changed();
            return false;
        }
    }

    async resolveSelected(): Promise<boolean> {
        const connection = this.connection;
        const handle = this.handle;
        const sessionId = this.selectedId;
        if (this.disposed || !connection || !handle || !sessionId || this.loading || this.pending) return false;
        const token = ++this.token;
        this.resolution = undefined;
        this.error = '';
        this.changed();
        try {
            const result = await connection.resolve({ projectHandle: handle, sessionId });
            if (this.disposed || token !== this.token || this.selectedId !== sessionId) return false;
            this.resolution = result;
            this.changed();
            return true;
        } catch (error) {
            if (this.disposed || token !== this.token) return false;
            if (/Invalid or disposed Development Sessions handle/i.test(String(error))) {
                this.retire();
                this.error = String(error);
                this.changed();
                return false;
            }
            this.error = String(error);
            this.changed();
            return false;
        }
    }

    /** Explicit UI action only; use the exact revisions currently displayed. */
    async mutate(operation: SessionOperation): Promise<boolean> {
        const connection = this.connection;
        const handle = this.handle;
        const snapshot = this.snapshot;
        const selected = this.selected;
        if (this.disposed || !connection || !handle || !snapshot || this.loading || this.pending ||
            operation.type !== 'create' && (!selected || operation.sessionId !== selected.id)) return false;
        const token = ++this.token;
        this.pending = true;
        this.error = '';
        this.changed();
        try {
            const result: SessionMutationResult = await connection.mutate({ projectHandle: handle,
                expectedCollectionRevision: snapshot.revision,
                expectedSessionRevision: operation.type === 'create' ? null : selected!.revision,
                operation });
            if (this.disposed || token !== this.token) {
                this.settleInvalidatedMutation(connection, handle);
                return false;
            }
            this.snapshot = result.snapshot;
            this.selectedId = result.session.id;
            this.resolution = undefined;
            this.pending = false;
            this.changed();
            return true;
        } catch (error) {
            if (this.disposed || token !== this.token) {
                this.settleInvalidatedMutation(connection, handle);
                return false;
            }
            if (/Invalid or disposed Development Sessions handle/i.test(String(error))) {
                this.retire();
                this.error = String(error);
                this.changed();
                return false;
            }
            this.pending = false;
            this.error = String(error);
            this.changed();
            return false;
        }
    }

    private settleInvalidatedMutation(connection: SessionConnection, handle: string): void {
        if (this.disposed || connection !== this.connection || handle !== this.handle) return;
        this.pending = false;
        void this.refresh();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.rootsListener.dispose();
        this.retire();
    }
}
