import { parseSessionArtifactRef } from '@dope/contracts/lib/developer-session';
import type { DeveloperSession, SessionArtifactRef, SessionCollection, SessionProjectIdentity } from '@dope/contracts/lib/developer-session';
import type { DeveloperSessionService, SessionMutationResult, SessionOperation, SessionResolveResult, SessionCandidateResult } from '@dope/contracts/lib/developer-session-service';
import type { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';

type SessionConnection = DeveloperSessionService & { dispose(): void | Promise<void> };
export interface SessionDraft { title: string; objective: string; notes: string; nextActions: string[] }
export interface SessionLayoutSelection { workspace: string; project: SessionProjectIdentity; selectedId: string }
type SessionField = keyof SessionDraft;
export interface SessionLinkDraft {
    kind: SessionArtifactRef['kind'];
    chatId: string; mapId: string; workItemId: string; taskId: string; runId: string;
    sequenceId: string; artifactId: string; artifactType: 'decision' | 'idea';
}

export function emptyLinkDraft(): SessionLinkDraft {
    return { kind: 'chat', chatId: '', mapId: '', workItemId: '', taskId: '', runId: '',
        sequenceId: '', artifactId: '', artifactType: 'decision' };
}

/** Accept only the fields of the selected v2 variant; the shared contract checks ID grammar. */
export function linkRefFromDraft(draft: SessionLinkDraft): SessionArtifactRef {
    switch (draft.kind) {
        case 'chat': return parseSessionArtifactRef({ kind: draft.kind, chatId: draft.chatId.trim() });
        case 'planning-map': return parseSessionArtifactRef({ kind: draft.kind, mapId: draft.mapId.trim() });
        case 'work-item': return parseSessionArtifactRef({ kind: draft.kind, mapId: draft.mapId.trim(),
            workItemId: draft.workItemId.trim() });
        case 'agent-task': return parseSessionArtifactRef({ kind: draft.kind, taskId: draft.taskId.trim() });
        case 'agent-run': return parseSessionArtifactRef({ kind: draft.kind, taskId: draft.taskId.trim(),
            runId: draft.runId.trim() });
        case 'agent-sequence': return parseSessionArtifactRef({ kind: draft.kind, sequenceId: draft.sequenceId.trim() });
        case 'project-mind': return parseSessionArtifactRef({ kind: draft.kind, artifactId: draft.artifactId.trim(),
            artifactType: draft.artifactType });
        default: throw new Error('Invalid session reference kind');
    }
}

function draftOf(session: DeveloperSession): SessionDraft {
    return { title: session.title, objective: session.objective, notes: session.notes,
        nextActions: [...session.nextActions] };
}

function valid(field: SessionField, value: string | string[]): string {
    if (field === 'nextActions') {
        const actions = value as string[];
        if (actions.length > 50 || actions.some(action => !action.trim() || action.length > 1000))
            return 'Next actions need 1–50 nonempty entries, each at most 1000 characters.';
        return '';
    }
    const text = value as string;
    const limit = { title: 160, objective: 4000, notes: 16000 }[field];
    if (text.length > limit || field === 'title' && !text.trim())
        return `${field === 'title' ? 'Title' : field === 'objective' ? 'Objective' : 'Notes'} must be ${field === 'title' ? 'nonempty and ' : ''}at most ${limit} characters.`;
    return '';
}

/** Presentation state only. The backend snapshot and its revisions remain authoritative. */
export class DeveloperSessionController {
    workspace?: string;
    snapshot?: SessionCollection;
    selectedId?: string;
    resolution?: SessionResolveResult;
    candidates?: SessionCandidateResult;
    candidatesLoading = false;
    loading = false;
    pending = false;
    error = '';
    notice = '';
    createDraft = { title: '', objective: '' };
    private readonly drafts = new Map<string, SessionDraft>();
    private readonly linkDrafts = new Map<string, SessionLinkDraft>();
    private connection?: SessionConnection;
    private handle?: string;
    private token = 0;
    private candidateRequest = 0;
    private disposed = false;
    private restoredSelection?: SessionLayoutSelection;
    private readonly rootsListener;

    constructor(private readonly connect: () => SessionConnection, private readonly workspaces: WorkspaceService,
        private readonly changed: () => void) {
        this.rootsListener = workspaces.onWorkspaceChanged(() => { this.restoredSelection = undefined; void this.attach(); });
    }

    get revision(): number { return this.snapshot?.revision ?? 0; }
    get selected(): DeveloperSession | undefined {
        return this.snapshot?.sessions.find(session => session.id === this.selectedId);
    }
    get attached(): boolean { return !!this.handle; }
    /** Layout remembers only a reference; the Session collection stays in the project store. */
    layoutSelection(): SessionLayoutSelection | undefined {
        const project = this.snapshot?.project;
        return this.workspace && project && this.selectedId && this.selected
            ? { workspace: this.workspace, project: { ...project }, selectedId: this.selectedId } : undefined;
    }

    restoreSelection(value: unknown): void {
        if (this.disposed || !value || typeof value !== 'object' || Array.isArray(value)) return;
        const state = value as Record<string, unknown>;
        const project = state.project;
        if (typeof state.workspace !== 'string' || !state.workspace.startsWith('file:') ||
            !project || typeof project !== 'object' || Array.isArray(project) ||
            typeof (project as Record<string, unknown>).canonicalRoot !== 'string' ||
            (project as Record<string, unknown>).canonicalRoot === '' ||
            ((project as Record<string, unknown>).projectMindId !== null &&
                typeof (project as Record<string, unknown>).projectMindId !== 'string') ||
            typeof state.selectedId !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(state.selectedId)) return;
        this.restoredSelection = { workspace: state.workspace,
            project: { canonicalRoot: (project as SessionProjectIdentity).canonicalRoot,
                projectMindId: (project as SessionProjectIdentity).projectMindId }, selectedId: state.selectedId };
        this.applyRestoredSelection();
    }

    private applyRestoredSelection(): void {
        const stored = this.restoredSelection, actual = this.snapshot?.project;
        if (!stored || !this.handle || !actual || !this.workspace) return;
        this.restoredSelection = undefined;
        if (stored.workspace !== this.workspace || stored.project.canonicalRoot !== actual.canonicalRoot ||
            stored.project.projectMindId !== actual.projectMindId ||
            !this.snapshot?.sessions.some(session => session.id === stored.selectedId)) return;
        if (this.select(stored.selectedId)) void this.resolveSelected();
    }
    get selectedDraft(): SessionDraft | undefined {
        const selected = this.selected;
        const project = this.snapshot?.project;
        if (!selected || !project) return undefined;
        const key = `${project.canonicalRoot}\0${project.projectMindId ?? ''}\0${selected.id}`;
        let draft = this.drafts.get(key);
        if (!draft) { draft = draftOf(selected); this.drafts.set(key, draft); }
        return draft;
    }
    get selectedLinkDraft(): SessionLinkDraft | undefined {
        const selected = this.selected;
        const project = this.snapshot?.project;
        if (!selected || !project) return undefined;
        const key = `${project.canonicalRoot}\0${project.projectMindId ?? ''}\0${selected.id}`;
        let draft = this.linkDrafts.get(key);
        if (!draft) { draft = emptyLinkDraft(); this.linkDrafts.set(key, draft); }
        return draft;
    }

    setLinkDraft<K extends keyof SessionLinkDraft>(field: K, value: SessionLinkDraft[K]): void {
        const draft = this.selectedLinkDraft;
        if (draft) {
            draft[field] = value;
            if (field === 'kind') { ++this.candidateRequest; this.candidates = undefined; this.candidatesLoading = false; }
        }
    }

    async browseCandidates(): Promise<boolean> {
        const connection = this.connection, handle = this.handle, selected = this.selected;
        const kind = this.selectedLinkDraft?.kind;
        if (this.disposed || !connection || !handle || !selected || !kind || selected.status === 'closed') return false;
        const token = this.token, request = ++this.candidateRequest;
        this.candidates = undefined;
        this.candidatesLoading = true;
        this.changed();
        try {
            const result = await connection.candidates(handle, kind);
            if (this.disposed || token !== this.token || request !== this.candidateRequest ||
                this.selectedId !== selected.id || this.selectedLinkDraft?.kind !== kind) return false;
            this.candidates = result;
            this.candidatesLoading = false;
            this.changed();
            return result.availability === 'ready';
        } catch {
            if (this.disposed || token !== this.token || request !== this.candidateRequest) return false;
            this.candidates = { kind, availability: 'unavailable', candidates: [], truncated: false,
                diagnostic: 'Owner metadata is unavailable; enter a verified exact ID or retry later.' };
            this.candidatesLoading = false;
            this.changed();
            return false;
        }
    }

    chooseCandidate(index: number): boolean {
        const choice = this.candidates?.availability === 'ready' ? this.candidates.candidates[index] : undefined;
        const draft = this.selectedLinkDraft;
        if (!choice || !draft || choice.ref.kind !== draft.kind) return false;
        const ref = parseSessionArtifactRef(choice.ref);
        Object.assign(draft, ref);
        this.changed();
        return true;
    }

    setCreateDraft(field: 'title' | 'objective', value: string): void {
        this.createDraft[field] = value;
    }

    setSelectedDraft(field: SessionField, value: string | string[]): void {
        const draft = this.selectedDraft;
        if (draft) (draft as unknown as Record<SessionField, string | string[]>)[field] = value;
    }

    async create(): Promise<boolean> {
        const { title, objective } = this.createDraft;
        this.error = valid('title', title) || valid('objective', objective);
        if (this.error) { this.changed(); return false; }
        const saved = await this.mutate({ type: 'create', title, objective });
        if (saved) { this.createDraft = { title: '', objective: '' }; this.changed(); }
        return saved;
    }

    async saveSelected(field: SessionField): Promise<boolean> {
        const session = this.selected;
        const draft = this.selectedDraft;
        if (!session || !draft || session.status === 'closed') return false;
        const value = draft[field];
        this.error = valid(field, value);
        if (this.error) { this.changed(); return false; }
        const operation: SessionOperation = field === 'title' ? { type: 'rename', sessionId: session.id, title: draft.title }
            : field === 'objective' ? { type: 'set-objective', sessionId: session.id, objective: draft.objective }
            : field === 'notes' ? { type: 'set-notes', sessionId: session.id, notes: draft.notes }
            : { type: 'set-next-actions', sessionId: session.id, nextActions: [...draft.nextActions] };
        return this.mutate(operation);
    }

    private retire(): number {
        const token = ++this.token;
        const connection = this.connection;
        this.connection = undefined;
        this.handle = undefined;
        if (connection) void Promise.resolve(connection.dispose()).catch(() => {});
        this.workspace = undefined;
        this.createDraft = { title: '', objective: '' };
        this.snapshot = undefined;
        this.selectedId = undefined;
        this.resolution = undefined;
        ++this.candidateRequest; this.candidates = undefined; this.candidatesLoading = false;
        this.loading = false;
        this.pending = false;
        this.error = '';
        this.notice = '';
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
            if (attached.project.canonicalRoot !== attached.snapshot.project.canonicalRoot ||
                attached.project.projectMindId !== attached.snapshot.project.projectMindId)
                throw new Error('Development Sessions attachment project identity mismatch');
            this.handle = attached.projectHandle;
            this.snapshot = attached.snapshot;
            this.loading = false;
            this.changed();
            this.applyRestoredSelection();
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
        ++this.candidateRequest; this.candidates = undefined; this.candidatesLoading = false;
        this.loading = false;
        this.error = '';
        this.notice = '';
        this.changed();
        return true;
    }

    async refresh(): Promise<boolean> {
        const connection = this.connection;
        const handle = this.handle;
        if (this.disposed || !connection || !handle || this.pending) return false;
        const token = ++this.token;
        ++this.candidateRequest; this.candidates = undefined; this.candidatesLoading = false;
        this.loading = true;
        this.resolution = undefined;
        this.error = '';
        this.notice = '';
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
        ++this.candidateRequest; this.candidates = undefined; this.candidatesLoading = false;
        this.resolution = undefined;
        this.error = '';
        this.notice = '';
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
            operation.type !== 'create' && (!selected || operation.sessionId !== selected.id || selected.status === 'closed')) return false;
        const token = ++this.token;
        ++this.candidateRequest; this.candidates = undefined; this.candidatesLoading = false;
        this.pending = true;
        this.error = '';
        this.notice = '';
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
            this.error = /revision conflict/i.test(String(error))
                ? `${String(error)}. Refresh and review the saved Session before retrying; your draft is preserved.`
                : String(error);
            this.changed();
            return false;
        }
    }

    async attachLink(): Promise<boolean> {
        const draft = this.selectedLinkDraft;
        if (!draft) return false;
        let ref: SessionArtifactRef;
        try { ref = linkRefFromDraft(draft); }
        catch (error) { this.error = String(error); this.notice = ''; this.changed(); return false; }
        return this.changeLink('attach', ref);
    }

    async detachLink(ref: SessionArtifactRef): Promise<boolean> {
        let parsed: SessionArtifactRef;
        try { parsed = parseSessionArtifactRef(ref); }
        catch (error) { this.error = String(error); this.notice = ''; this.changed(); return false; }
        return this.changeLink('detach', parsed);
    }

    private async changeLink(action: 'attach' | 'detach', ref: SessionArtifactRef): Promise<boolean> {
        const connection = this.connection;
        const handle = this.handle;
        const snapshot = this.snapshot;
        const selected = this.selected;
        if (this.disposed || !connection || !handle || !snapshot || !selected ||
            selected.status === 'closed' || this.loading || this.pending) return false;
        const token = ++this.token;
        ++this.candidateRequest; this.candidates = undefined; this.candidatesLoading = false;
        this.pending = true;
        this.error = '';
        this.notice = '';
        this.changed();
        try {
            const request = { projectHandle: handle, sessionId: selected.id,
                expectedCollectionRevision: snapshot.revision, expectedSessionRevision: selected.revision, ref };
            const result = await (action === 'attach' ? connection.attachLink(request) : connection.detachLink(request));
            if (this.disposed || token !== this.token || this.selectedId !== selected.id) {
                this.settleInvalidatedMutation(connection, handle);
                return false;
            }
            this.snapshot = result.snapshot;
            this.resolution = undefined;
            this.pending = false;
            this.notice = action === 'attach'
                ? result.snapshot.revision === snapshot.revision ? 'Artifact was already linked.' : 'Artifact linked.'
                : 'Link detached. The original artifact is unchanged.';
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
            this.error = /revision conflict|\bStale\b/i.test(String(error))
                ? `${String(error)}. Refresh and review the saved Session before retrying.` : String(error);
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
