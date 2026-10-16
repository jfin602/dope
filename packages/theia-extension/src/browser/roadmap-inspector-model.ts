import type { RoadmapCheckpoint, RoadmapIndex } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { RoadmapChange } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { PlanningAction, PlanningActionPreview, PlanningActionRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import type { RoadmapService } from '../roadmap-service';
import type { CheckpointNode } from '@dope/project-intelligence/lib/roadmap-projection';

/** Presentation state only. All writes pass through the backend planning authority. */
export class RoadmapInspectorModel {
    private readonly service: RoadmapService;
    private readonly openSource: (uri: string) => Promise<void>;
    private readonly listeners = new Set<() => void>();
    private serial = 0;
    private handle?: string;
    private pending?: { request: PlanningActionRequest; preview: PlanningActionPreview; serial: number };
    projectUri?: string;
    index?: RoadmapIndex;
    selectedId?: string;
    selectedPrompt?: CheckpointNode;
    draft?: { title: string; objective: string; status: RoadmapCheckpoint['status'] };
    dirty = false;
    busy = false;
    error?: string;
    undo?: { token: string; revision: number };

    constructor(service: RoadmapService, openSource: (uri: string) => Promise<void> = async () => {}) {
        this.service = service;
        this.openSource = openSource;
    }
    onChange(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    private emit(): void { for (const listener of this.listeners) listener(); }
    async remoteChange(change: RoadmapChange): Promise<void> {
        const uri = this.projectUri;
        if (!uri || !this.index || change.root !== this.index.projectRoot || change.projectId !== this.index.projectId ||
            change.revision <= this.index.revision) return;
        try {
            const next = await this.service.read(uri);
            if (uri === this.projectUri && next.projectId === change.projectId) this.setSnapshot(uri, next);
        } catch (error) { if (uri === this.projectUri) { this.error = error instanceof Error ? error.message : String(error); this.emit(); } }
    }
    get selected(): RoadmapCheckpoint | undefined { return this.index?.checkpoints.find(item => item.id === this.selectedId); }
    get requiresApproval(): boolean { return !!this.pending?.preview.requiresApproval; }
    get previewSummary(): string | undefined {
        const pending = this.pending;
        if (!pending) return undefined;
        if (pending.preview.documentDiff) {
            const diff = pending.preview.documentDiff;
            return `Document: ${diff.path}\n${diff.changedLines.map(line => `- ${line.before}\n+ ${line.after}`).join('\n')}`;
        }
        const next = pending.preview.next.checkpoints.find(item => item.id === this.selectedId);
        return next && `Proposed: ${next.title}; ${next.status.replaceAll('-', ' ')}; objective: ${next.objective}`;
    }

    setSnapshot(uri: string | undefined, index: RoadmapIndex | undefined): void {
        const foreign = uri !== this.projectUri || !!index && !!this.index && index.projectId !== this.index.projectId;
        if (foreign) {
            ++this.serial;
            if (this.handle) void this.service.detach(this.handle);
            this.handle = undefined;
            this.selectedId = undefined;
            this.selectedPrompt = undefined;
            this.draft = undefined;
            this.dirty = false;
            this.undo = undefined;
            this.pending = undefined;
            this.error = undefined;
            this.busy = false;
        }
        this.projectUri = uri;
        if (index && uri) {
            if (this.index && !foreign && index.revision < this.index.revision) return;
            this.index = index;
            if (this.undo && this.undo.revision !== index.revision) {
                this.undo = undefined;
                this.error = 'Undo is no longer available because the Roadmap changed. Review the current revision before editing again.';
            }
            if (this.pending && this.pending.request.expectedRevision !== index.revision && !this.busy) {
                this.pending = undefined;
                this.error = 'Roadmap changed before approval. Review the current revision and preview again.';
            }
            if (this.selectedId && !this.selected) this.select(undefined);
            if (!this.dirty && !this.pending) this.resetDraft();
        } else this.index = undefined;
        this.emit();
    }

    select(id: string | undefined): void {
        if (id && !this.index?.checkpoints.some(item => item.id === id)) return;
        ++this.serial;
        this.selectedId = id;
        this.selectedPrompt = undefined;
        this.pending = undefined;
        this.error = undefined;
        this.busy = false;
        this.dirty = false;
        this.resetDraft();
        this.emit();
    }

    selectTask(node: CheckpointNode): void {
        if (!node.taskSource || !this.projectUri || !this.index) return;
        ++this.serial;
        this.selectedId = undefined;
        this.selectedPrompt = node;
        this.pending = undefined;
        this.draft = undefined;
        this.dirty = false;
        this.error = undefined;
        this.emit();
    }

    async openPrompt(node = this.selectedPrompt): Promise<void> {
        const uri = this.projectUri, index = this.index, source = node?.taskSource;
        if (!uri || !index || node?.kind !== 'prompt' || !source?.path || !source.fingerprint ||
            this.selectedPrompt?.id !== node.id) return;
        const serial = this.serial;
        this.error = undefined; this.emit();
        try {
            const target = await this.service.resolvePromptSource(uri, source.path, source.fingerprint);
            if (serial !== this.serial || uri !== this.projectUri || index.projectId !== this.index?.projectId ||
                this.selectedPrompt?.id !== node.id) return;
            await this.openSource(target);
        } catch (error) {
            if (serial === this.serial && uri === this.projectUri) {
                this.error = error instanceof Error ? error.message : String(error);
                this.emit();
            }
        }
    }

    private resetDraft(): void {
        const item = this.selected;
        this.draft = item && { title: item.title, objective: item.objective, status: item.status };
    }
    change(field: 'title' | 'objective' | 'status', value: string): void {
        if (!this.draft || !this.selected || this.selected.readOnly) return;
        this.draft = { ...this.draft, [field]: value };
        this.dirty = true;
        this.pending = undefined;
        this.error = undefined;
        this.busy = false;
        ++this.serial;
        this.emit();
    }

    discardEdit(): void {
        if (this.busy || (!this.dirty && !this.pending)) return;
        ++this.serial;
        this.pending = undefined;
        this.dirty = false;
        this.error = undefined;
        this.resetDraft();
        this.emit();
    }

    async save(): Promise<void> {
        const item = this.selected, draft = this.draft, index = this.index, uri = this.projectUri;
        if (!item || !draft || !index || !uri || item.readOnly || this.busy) return;
        const serial = ++this.serial;
        this.busy = true; this.error = undefined; this.emit();
        try {
            if (!this.handle) {
                const attached = await this.service.attach(uri);
                if (serial !== this.serial || uri !== this.projectUri || attached.snapshot.projectId !== index.projectId) {
                    await this.service.detach(attached.projectHandle);
                    return;
                }
                this.handle = attached.projectHandle;
            }
            const actions: PlanningAction[] = [];
            if (draft.title !== item.title || draft.objective !== item.objective) actions.push({ type: item.source ? 'document-edit' : 'edit', id: item.id,
                ...(draft.title !== item.title ? { title: draft.title } : {}),
                ...(draft.objective !== item.objective ? { objective: draft.objective } : {}) });
            if (draft.status !== item.status) {
                if (draft.status === 'green' || draft.status === 'waived') throw new Error('Gate Green and waiver require evidence authority');
                actions.push({ type: 'status', id: item.id, status: draft.status });
            }
            if (!actions.length) { this.dirty = false; return; }
            const request: PlanningActionRequest = { projectHandle: this.handle!, ownerId: index.projectId,
                expectedRevision: index.revision, sourceHashes: item.source ? { [item.id]: item.source.sha256 } : undefined, actions };
            const preview = await this.service.preview(request);
            if (serial !== this.serial || this.selectedId !== item.id || this.index?.projectId !== preview.ownerId) return;
            if (this.index?.revision !== index.revision) {
                this.error = 'Roadmap changed while previewing. Review the current revision and retry.';
                return;
            }
            if (preview.requiresApproval) { this.pending = { request, preview, serial }; return; }
            await this.apply(request, preview, false, serial);
        } catch (error) { if (serial === this.serial) this.error = error instanceof Error ? error.message : String(error); }
        finally { if (serial === this.serial) { this.busy = false; this.emit(); } }
    }

    async approve(): Promise<void> {
        const pending = this.pending;
        if (!pending || pending.serial !== this.serial || this.busy) return;
        this.busy = true; this.emit();
        try { await this.apply(pending.request, pending.preview, true, pending.serial); }
        catch (error) { if (pending.serial === this.serial) this.error = error instanceof Error ? error.message : String(error); }
        finally { if (pending.serial === this.serial) { this.busy = false; this.emit(); } }
    }

    private async apply(request: PlanningActionRequest, preview: PlanningActionPreview, approved: boolean, serial: number): Promise<void> {
        const result = await this.service.apply(request, preview.token, approved);
        if (serial !== this.serial || this.index?.projectId !== result.projectId || this.projectUri === undefined) return;
        this.pending = undefined;
        this.index = result;
        this.dirty = false;
        this.resetDraft();
        const token = await this.service.undoToken(request.projectHandle, result.projectId);
        if (serial === this.serial) this.undo = token ? { token, revision: result.revision } : undefined;
        this.emit();
    }

    async undoEdit(): Promise<void> {
        const undo = this.undo, index = this.index, handle = this.handle;
        if (!undo || !index || !handle || this.busy) return;
        const serial = ++this.serial;
        this.busy = true; this.emit();
        try {
            const result = await this.service.undo({ projectHandle: handle, ownerId: index.projectId,
                expectedRevision: undo.revision, token: undo.token });
            if (serial !== this.serial || this.index?.projectId !== result.projectId) return;
            this.index = result; this.undo = undefined; this.dirty = false; this.resetDraft();
        } catch (error) { if (serial === this.serial) this.error = error instanceof Error ? error.message : String(error); }
        finally { if (serial === this.serial) { this.busy = false; this.emit(); } }
    }
}
