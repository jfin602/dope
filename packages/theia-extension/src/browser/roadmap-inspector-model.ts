import type { RoadmapCheckpoint, RoadmapIndex } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { RoadmapChange } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { PlanningAction, PlanningActionPreview, PlanningActionRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import type { GatePlanningAction } from '@dope/project-intelligence/lib/node/project-planning-actions';
import type { RoadmapGate, RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { RoadmapService } from '../roadmap-service';
import type { CheckpointNode } from '@dope/project-intelligence/lib/roadmap-projection';
import type { PlanningBasis } from '@dope/visual-planning';

/** Presentation state only. All writes pass through the backend planning authority. */
export class RoadmapInspectorModel {
    private readonly service: RoadmapService;
    private readonly openSource: (uri: string) => Promise<void>;
    private readonly openPlanning: (selection: { workspace: string; projectId: string; checkpointId: string;
        title: string; objective: string; requirements: string[]; impactReferences: string[]; mapId?: string;
        mapRevision?: number; mapOwnerProjectId?: string; mapBasis?: PlanningBasis }) => Promise<void>;
    private readonly listeners = new Set<() => void>();
    private serial = 0;
    private handle?: string;
    private pending?: { request: PlanningActionRequest; preview: PlanningActionPreview; serial: number };
    projectUri?: string;
    index?: RoadmapIndex;
    selectedId?: string;
    selectedPrompt?: CheckpointNode;
    draft?: { title: string; objective: string; status: RoadmapCheckpoint['status'] };
    gateDraft?: { title: string; purpose: string };
    dirty = false;
    busy = false;
    error?: string;
    undo?: { token: string; revision: number };

    constructor(service: RoadmapService, openSource: (uri: string) => Promise<void> = async () => {},
        openPlanning: RoadmapInspectorModel['openPlanning'] = async () => {}) {
        this.service = service;
        this.openSource = openSource;
        this.openPlanning = openPlanning;
    }
    onChange(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
    private emit(): void { for (const listener of this.listeners) listener(); }
    async remoteChange(change: RoadmapChange): Promise<void> {
        const uri = this.projectUri;
        if (!uri || !this.index || change.root !== this.index.projectRoot ||
            (this.index.projectId !== 'uninitialized' && change.projectId !== this.index.projectId) ||
            change.revision <= this.index.revision) return;
        try {
            const next = await this.service.read(uri);
            if (uri === this.projectUri && next.projectRoot === change.root && next.projectId === change.projectId &&
                next.revision >= change.revision && (!this.index || next.revision >= this.index.revision) &&
                (!this.index || this.index.projectId === 'uninitialized' || next.projectId === this.index.projectId))
                this.setSnapshot(uri, next);
        } catch (error) { if (uri === this.projectUri) { this.error = error instanceof Error ? error.message : String(error); this.emit(); } }
    }
    get selected(): RoadmapCheckpoint | undefined { return this.index?.checkpoints?.find(item => item.id === this.selectedId); }
    get gateIndex(): RoadmapGateIndex | undefined {
        return (this.index as unknown as RoadmapGateIndex | undefined)?.schemaVersion === 2 ?
            this.index as unknown as RoadmapGateIndex : undefined;
    }
    get selectedGate(): RoadmapGate | undefined { return this.gateIndex?.gates.find(item => item.id === this.selectedId); }
    get selectedPhase(): RoadmapGateIndex['phases'][number] | undefined {
        return this.gateIndex?.phases.find(item => item.id === this.selectedId);
    }
    get prepareWorkBlockedReason(): string | undefined {
        if (this.gateIndex) return 'Gate-scoped Prepare Work needs planning. The Gate-to-Planning handoff is not available yet.';
        const index = this.index, item = this.selected;
        if (!index || !this.projectUri || index.projectId === 'uninitialized' || !index.revision)
            return 'Initialize and approve a canonical Roadmap before preparing work.';
        if (!item) return 'Select an approved canonical checkpoint first. Provisional or rejected drafts cannot prepare work.';
        if (!item.objective.trim()) return 'Add checkpoint requirements before preparing work.';
        if (this.busy || this.pending || this.dirty) return 'Finish or discard the pending Roadmap change first.';
        if (index.linkedDocument && index.linkedDocument.syncState !== 'synced')
            return 'Linked Roadmap source is stale or unresolved. Review and sync it first.';
        const planOrigin = index.planOrigin;
        const planStep = planOrigin?.steps.find(step => step.checkpointId === item.id);
        if (planOrigin && planStep && (planOrigin.sourceHash !== index.linkedDocument?.sourceHash ||
            item.source?.sha256 !== planOrigin.sourceHash))
            return 'Approved plan source changed. Review the Roadmap scope before preparing work.';
        const planningLinks = item.links.filter(link => link.owner === 'planning-map');
        if (planningLinks.length > 1) return 'Select one reviewed Planning Map link before preparing work.';
        if (planningLinks.some(link => !link.ownerProjectId || link.ownerRevision === undefined || !link.basis))
            return 'A Planning Map link is incomplete. Review and relink it before preparing work.';
        return undefined;
    }
    async prepareWork(): Promise<void> {
        const uri = this.projectUri, index = this.index, item = this.selected, serial = this.serial;
        if (!uri || !index || !item || this.prepareWorkBlockedReason) return;
        this.busy = true; this.error = undefined; this.emit();
        try {
            const fresh = await this.service.read(uri);
            if (serial !== this.serial || uri !== this.projectUri || index.revision !== this.index?.revision ||
                item.id !== this.selectedId || fresh.projectId !== index.projectId || fresh.revision !== index.revision)
                throw new Error('Roadmap changed. Refresh and review the checkpoint before preparing work.');
            const current = fresh.checkpoints.find(checkpoint => checkpoint.id === item.id);
            if (!current || current.objective !== item.objective ||
                fresh.linkedDocument?.syncState !== index.linkedDocument?.syncState ||
                fresh.linkedDocument && fresh.linkedDocument.syncState !== 'synced')
                throw new Error('Checkpoint source changed. Refresh and review it before preparing work.');
            if (fresh.linkedDocument) {
                const sync = await this.service.previewDocumentSync(uri);
                if (sync.state !== 'unchanged' || sync.projectId !== index.projectId || sync.revision !== index.revision)
                    throw new Error('Linked Roadmap source changed. Review and sync it before preparing work.');
            }
            if (serial !== this.serial || uri !== this.projectUri || this.index?.revision !== index.revision ||
                this.selectedId !== item.id)
                throw new Error('Selection changed while preparing work. Select the checkpoint again.');
            const map = current.links.find(link => link.owner === 'planning-map');
            const planOrigin = fresh.planOrigin;
            const planStep = planOrigin?.steps.find(step => step.checkpointId === current.id);
            if (planOrigin && planStep && (planOrigin.sourceHash !== fresh.linkedDocument?.sourceHash ||
                current.source?.sha256 !== planOrigin.sourceHash))
                throw new Error('Approved plan source changed. Review the Roadmap scope before preparing work.');
            await this.openPlanning({ workspace: uri, projectId: index.projectId, checkpointId: item.id,
                title: current.title, objective: current.objective,
                requirements: [current.objective, ...(planStep ? planOrigin!.constraints : []),
                    ...(planStep?.expectedOutputs ?? []), ...current.dependencies.map(id =>
                    fresh.checkpoints.find(candidate => candidate.id === id)?.objective ?? `Unresolved dependency: ${id}`)],
                impactReferences: current.links.filter(link => link.owner !== 'planning-map').map(link =>
                    `${link.owner}: ${link.targetId}`).concat(planStep ?
                    [`Reviewed plan ${planOrigin!.planHash}, step ${planStep.stepId}`] : []),
                mapId: map?.targetId, mapRevision: map?.ownerRevision,
                mapOwnerProjectId: map?.ownerProjectId, mapBasis: map?.basis });
        } catch (error) {
            if (serial === this.serial && uri === this.projectUri) this.error = error instanceof Error ? error.message : String(error);
        } finally { if (serial === this.serial && uri === this.projectUri) { this.busy = false; this.emit(); } }
    }
    get requiresApproval(): boolean { return !!this.pending?.preview.requiresApproval; }
    get previewSummary(): string | undefined {
        const pending = this.pending;
        if (!pending) return undefined;
        if (pending.preview.documentDiff) {
            const diff = pending.preview.documentDiff;
            return `Document: ${diff.path}\n${diff.changedLines.map(line => `- ${line.before}\n+ ${line.after}`).join('\n')}`;
        }
        const gate = pending.preview.next.gates?.find(item => item.id === this.selectedId) ??
            pending.preview.next.gates?.find(item => item.id === pending.preview.changedIds[0]);
        if (gate) return `Proposed Gate ${gate.designation}: ${gate.title}; purpose: ${gate.purpose}; ${gate.criteria.length} criteria. Qualification: ${gate.qualificationStatus}.`;
        const next = pending.preview.next.checkpoints?.find(item => item.id === this.selectedId);
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
            this.gateDraft = undefined;
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
            if (this.selectedId && !this.selected && !this.selectedGate &&
                !this.gateIndex?.phases.some(item => item.id === this.selectedId)) this.select(undefined);
            if (!this.dirty && !this.pending) this.resetDraft();
        } else this.index = undefined;
        this.emit();
    }

    select(id: string | undefined): void {
        if (id && !this.index?.checkpoints?.some(item => item.id === id) &&
            !this.gateIndex?.gates.some(item => item.id === id) && !this.gateIndex?.phases.some(item => item.id === id)) return;
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
        const gate = this.selectedGate;
        this.gateDraft = gate && { title: gate.title, purpose: gate.purpose };
    }
    changeGate(field: 'title' | 'purpose', value: string): void {
        if (!this.gateDraft || !this.selectedGate) return;
        this.gateDraft = { ...this.gateDraft, [field]: value };
        this.dirty = true; this.pending = undefined; this.error = undefined;
        ++this.serial; this.emit();
    }
    async proposeGate(parentPhaseId: string, id: string, designation: string, title: string, purpose: string,
        criteria: { id: string; title: string; expectedResult: string }[]): Promise<void> {
        await this.previewGateAction({ type: 'gate.create', parentPhaseId, id, designation, title, purpose, criteria }, id);
    }
    async saveGate(): Promise<void> {
        const item = this.selectedGate, draft = this.gateDraft;
        if (!item || !draft || !this.dirty) return;
        await this.previewGateAction({ type: 'gate.edit', id: item.id, title: draft.title, purpose: draft.purpose }, item.id);
    }
    async editCriterion(gateId: string, id: string, title: string, expectedResult: string): Promise<void> {
        await this.previewGateAction({ type: 'criterion.edit', gateId, id, title, expectedResult }, gateId);
    }
    private async previewGateAction(action: GatePlanningAction, selectedId: string): Promise<void> {
        const uri = this.projectUri, index = this.gateIndex;
        if (!uri || !index || this.busy || !index.phases.some(item => item.id ===
            (action.type === 'gate.create' ? action.parentPhaseId :
                index.gates.find(gate => gate.id === selectedId)?.parentPhaseId))) return;
        const serial = ++this.serial;
        this.busy = true; this.error = undefined; this.emit();
        try {
            if (!this.handle) {
                const attached = await this.service.attach(uri);
                if (serial !== this.serial || uri !== this.projectUri || attached.snapshot.projectId !== index.projectId ||
                    attached.snapshot.revision !== index.revision) { await this.service.detach(attached.projectHandle); return; }
                this.handle = attached.projectHandle;
            }
            const request: PlanningActionRequest = { projectHandle: this.handle!, ownerId: index.projectId,
                expectedRevision: index.revision,
                sourceHashes: index.linkedDocument ? { [selectedId]: index.linkedDocument.sourceHash } : undefined,
                actions: [action] };
            const preview = await this.service.preview(request);
            if (serial !== this.serial || uri !== this.projectUri || this.gateIndex?.revision !== index.revision ||
                preview.ownerId !== index.projectId) throw new Error('Roadmap changed during Gate preview');
            this.pending = { request, preview, serial };
        } catch (error) { if (serial === this.serial) this.error = error instanceof Error ? error.message : String(error); }
        finally { if (serial === this.serial) { this.busy = false; this.emit(); } }
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
        if ((result as unknown as RoadmapGateIndex).schemaVersion === 2 && request.actions[0].type === 'gate.create')
            this.selectedId = request.actions[0].id;
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
