import { canCloseOut, detectActiveConflicts, sameSemanticBasis, suggestWorkItems } from '@dope/visual-planning';
import type { CrossMapConflict, MapStatus, PlanningMap, RebaseResult, StaleResult, WorkItem, WorkItemSuggestion, WorkStatus } from '@dope/visual-planning';
import type { RebaseDecision } from '@dope/visual-planning/lib/rebase';
import { acceptSuggestion } from '@dope/visual-planning/lib/work';
import type { PlannedTransformation } from '@dope/visual-planning';
import type { EditCommand } from '@dope/visual-planning/lib/editing';
import type { PlanningCollection, PlanningOperation, VisualPlanningService } from '@dope/visual-planning/lib/service';
import type { AdoptionPreview, AdoptionScope } from '@dope/visual-planning/lib/adoption';
import type { SoftwareMapController } from './software-map-controller';
import type { PlanningView } from './planning-map-projection';

const transitions: Record<MapStatus, MapStatus[]> = {
    draft: ['active', 'archived'], active: ['superseded', 'archived'],
    completed: ['archived'], superseded: ['archived'], archived: []
};
export class PlanningMapController {
    private readonly listeners = new Set<() => void>();
    private readonly mapListener;
    private connection?: VisualPlanningService;
    private handle?: string;
    private workspace?: string;
    private request = 0;
    private staleRequest = 0;
    private disposed = false;
    collection?: PlanningCollection;
    selectedMapId?: string;
    selectedWorkItemId?: string;
    selectedTransformationId?: string;
    suggestions?: WorkItemSuggestion[];
    private acceptedSuggestionIds = new Map<number, string>();
    planningMode = false;
    view: PlanningView = 'diff';
    showHistory = false;
    loading = false;
    error = '';
    preview?: { transformation: PlannedTransformation; mapId: string; collectionRevision: number; mapRevision: number; basis: PlanningMap['basis']; observationGeneration: number };
    adoptionPreview?: { result: AdoptionPreview; mapId: string; collectionRevision: number; mapRevision: number; basis: PlanningMap['basis']; observationGeneration: number };
    stale?: StaleResult;
    rebasePreview?: { result: RebaseResult; mapId: string; collectionRevision: number; mapRevision: number; decisions: RebaseDecision[] };

    constructor(private readonly map: SoftwareMapController, private readonly connect: () => VisualPlanningService) {
        this.mapListener = map.onChange(() => { if (this.workspace !== map.workspace) void this.attach(); else void this.refreshStale(); });
        void this.attach();
    }
    onChange(listener: () => void): { dispose(): void } {
        this.listeners.add(listener);
        return { dispose: () => { this.listeners.delete(listener); } };
    }
    private notify(): void { for (const listener of this.listeners) listener(); }
    get selected(): PlanningMap | undefined { return this.collection?.maps.find(map => map.id === this.selectedMapId); }
    get canCreate(): boolean { return !!(this.map.status?.state === 'ready' && this.map.status.inputFingerprint &&
        this.map.initialization?.declarationFingerprint && this.handle && this.map.workspace === this.workspace); }
    get visibleMaps(): PlanningMap[] { return this.collection?.maps.filter(map => this.showHistory || map.status === 'draft' || map.status === 'active') ?? []; }
    get conflicts(): CrossMapConflict[] { return detectActiveConflicts(this.collection?.maps ?? []); }
    get allowedTransitions(): MapStatus[] { return this.selected ? transitions[this.selected.status] : []; }
    get canCloseOut(): boolean { return !!this.selected && this.selected.status === 'active' && canCloseOut(this.selected); }
    reconcile(): Promise<void> { const map = this.selected; return map ? this.mutate({ type: 'reconcile', mapId: map.id, expectedMapRevision: map.revision }) : Promise.resolve(); }
    disposition(transformationId: string, resolution: PlannedTransformation['resolution'], deferredToMapId?: string): Promise<void> {
        const map = this.selected;
        return map && resolution ? this.mutate({ type: 'disposition', mapId: map.id, transformationId, resolution, deferredToMapId }) : Promise.resolve();
    }
    closeout(): Promise<void> { const map = this.selected; return map && this.canCloseOut ?
        this.mutate({ type: 'closeout', mapId: map.id, expectedMapRevision: map.revision }) : Promise.resolve(); }
    setMode(value: boolean): void { this.planningMode = value; this.notify(); }
    setView(value: PlanningView): void { this.view = value; this.notify(); }
    setHistory(value: boolean): void {
        this.showHistory = value;
        if (!value && this.selected && !this.visibleMaps.includes(this.selected)) this.selectedMapId = this.visibleMaps[0]?.id;
        this.notify();
    }
    select(id: string): void { if (this.collection?.maps.some(map => map.id === id)) { this.preview = undefined; this.adoptionPreview = undefined; this.rebasePreview = undefined; this.stale = undefined; this.selectedMapId = id;
        this.selectedWorkItemId = undefined; this.selectedTransformationId = undefined; this.suggestions = undefined; this.notify(); void this.refreshStale(); } }
    async refreshStale(): Promise<void> {
        const connection = this.connection, handle = this.handle, workspace = this.workspace, map = this.selected, request = ++this.staleRequest;
        if (!connection || !handle || !workspace || !map || this.map.status?.state !== 'ready') { this.stale = undefined; this.notify(); return; }
        try {
            const stale = await connection.staleness(handle, map.id);
            if (request !== this.staleRequest || this.disposed || this.map.workspace !== workspace || this.selected?.id !== map.id) return;
            this.stale = stale; this.notify();
        } catch (error) { if (request === this.staleRequest && !this.disposed) { this.stale = undefined; this.error = String(error); this.notify(); } }
    }
    async beginRebase(): Promise<void> {
        const map = this.selected, collection = this.collection, connection = this.connection, handle = this.handle;
        const workspace = this.workspace, request = ++this.request, status = this.map.status, fingerprint = this.map.initialization?.declarationFingerprint;
        if (!this.stale?.stale || !map || !collection || !connection || !handle || !workspace || !status?.inputFingerprint || !fingerprint) return;
        this.loading = true; this.error = ''; this.rebasePreview = undefined; this.notify();
        try {
            const result = await connection.previewRebase({ projectHandle: handle, mapId: map.id, expectedRevision: collection.revision,
                expectedMapRevision: map.revision, expectedBasis: map.basis, expectedCurrentBasis: { architectureRevision: 0,
                    architectureFingerprint: fingerprint, physicalInputFingerprint: status.inputFingerprint, physicalGeneration: status.generation } });
            if (request !== this.request || this.disposed || this.map.workspace !== workspace ||
                this.map.status?.generation !== status.generation) return;
            this.rebasePreview = { result, mapId: map.id, collectionRevision: collection.revision, mapRevision: map.revision, decisions: [] };
        } catch (error) { if (request === this.request && !this.disposed) this.error = String(error); }
        finally { if (request === this.request && !this.disposed) { this.loading = false; this.notify(); } }
    }
    decideRebase(decision: RebaseDecision): void {
        const preview = this.rebasePreview;
        if (!preview || !preview.result.conflicts.some(c => c.transformationId === decision.transformationId &&
            c.identityId === decision.identityId && c.reason === decision.reason)) return;
        const same = (a: RebaseDecision, b: RebaseDecision) => a.transformationId === b.transformationId && a.identityId === b.identityId && a.reason === b.reason;
        preview.decisions = [...preview.decisions.filter(d => !same(d, decision)),
            ...(decision.action === 'replace-reference' && !decision.replacementId?.trim() ? [] : [decision])]; this.notify();
    }
    cancelRebase(): void { this.rebasePreview = undefined; this.notify(); }
    async acceptRebase(): Promise<void> {
        const preview = this.rebasePreview, map = this.selected, collection = this.collection, connection = this.connection;
        const handle = this.handle, workspace = this.workspace, request = ++this.request;
        if (!preview || !map || !collection || !connection || !handle || !workspace || preview.mapId !== map.id ||
            preview.mapRevision !== map.revision || preview.collectionRevision !== collection.revision ||
            preview.decisions.length !== preview.result.conflicts.length ||
            this.map.status?.generation !== preview.result.currentBasis.physicalGeneration) { this.error = 'Rebase preview is unresolved or stale'; this.notify(); return; }
        this.loading = true; this.error = ''; this.notify();
        try {
            const snapshot = await connection.acceptRebase({ projectHandle: handle, mapId: map.id, expectedRevision: collection.revision,
                expectedMapRevision: map.revision, expectedBasis: preview.result.oldBasis,
                expectedCurrentBasis: preview.result.currentBasis, decisions: preview.decisions });
            if (request !== this.request || this.disposed || this.map.workspace !== workspace) return;
            this.collection = snapshot; this.rebasePreview = undefined; this.stale = undefined; this.suggestions = undefined; void this.refreshStale();
        } catch (error) { if (request === this.request && !this.disposed) this.error = String(error); }
        finally { if (request === this.request && !this.disposed) { this.loading = false; this.notify(); } }
    }
    get selectedWorkItem(): WorkItem | undefined { return this.selected?.workItems.find(item => item.id === this.selectedWorkItemId); }
    requestSuggestions(): void { this.suggestions = this.selected ? suggestWorkItems(this.selected) : [];
        this.acceptedSuggestionIds.clear(); this.notify(); }
    splitSuggestion(index: number, parts: [string[], string[]]): void {
        const suggestion = this.suggestions?.[index];
        if (!suggestion || this.acceptedSuggestionIds.has(index) || parts.some(part => !part.length || part.some(id => !suggestion.transformationIds.includes(id))) ||
            suggestion.transformationIds.some(id => !parts.some(part => part.includes(id)))) throw new Error('Invalid suggestion split');
        const split = parts.map((refs, part) => ({ ...suggestion, transformationIds: [...new Set(refs)].sort(),
            objective: `${suggestion.objective} (${part + 1})` }));
        this.suggestions = this.suggestions!.flatMap((candidate, i) => i === index ? split : [{ ...candidate,
            dependsOn: candidate.dependsOn.flatMap(dep => dep === index ? [index, index + 1] : [dep > index ? dep + 1 : dep]) }]);
        this.acceptedSuggestionIds = new Map([...this.acceptedSuggestionIds].map(([i, id]) => [i > index ? i + 1 : i, id]));
        this.notify();
    }
    selectWorkItem(id?: string): void { this.selectedWorkItemId = this.selected?.workItems.some(item => item.id === id) ? id : undefined;
        this.selectedTransformationId = undefined; this.notify(); }
    selectTransformation(id?: string): void { this.selectedTransformationId = this.selected?.transformations.some(item => item.id === id) ? id : undefined;
        this.selectedWorkItemId = undefined; this.notify(); }
    get linkedWorkItems(): WorkItem[] { return this.selected?.workItems.filter(item => item.transformationIds.includes(this.selectedTransformationId ?? '')) ?? []; }
    async acceptSuggestion(index: number): Promise<void> {
        const map = this.selected, suggestion = this.suggestions?.[index];
        if (!map || !suggestion) return;
        const dependencies = suggestion.dependsOn.map(i => this.acceptedSuggestionIds.get(i) ?? map.workItems.find(item =>
            this.suggestions?.[i] && item.transformationIds.join('|') === this.suggestions[i].transformationIds.join('|'))?.id)
            .filter((id): id is string => !!id);
        if (dependencies.length !== suggestion.dependsOn.length) { this.error = 'Accept predecessor suggestions first'; this.notify(); return; }
        const item = { ...acceptSuggestion(map, suggestion, `work-${crypto.randomUUID()}`), dependsOn: dependencies };
        await this.mutate({ type: 'put-work-item', mapId: map.id, workItem: item });
        if (this.selected?.workItems.some(work => work.id === item.id)) { this.acceptedSuggestionIds.set(index, item.id); this.selectWorkItem(item.id); }
    }
    putWorkItem(item: WorkItem): Promise<void> { return this.selected ?
        this.mutate({ type: 'put-work-item', mapId: this.selected.id, workItem: item }) : Promise.resolve(); }
    splitWorkItem(sourceId: string, parts: [WorkItem, WorkItem]): Promise<void> { return this.selected ?
        this.mutate({ type: 'split-work-item', mapId: this.selected.id, sourceId, parts }) : Promise.resolve(); }
    mergeWorkItems(sourceIds: [string, string], merged: WorkItem): Promise<void> { return this.selected ?
        this.mutate({ type: 'merge-work-items', mapId: this.selected.id, sourceIds, merged }) : Promise.resolve(); }
    transitionWorkItem(status: WorkStatus, completionNotes?: string): Promise<void> {
        const item = this.selectedWorkItem;
        return item ? this.putWorkItem({ ...item, status, ...(status === 'completed' ? { completionNotes } : { completionNotes: undefined }) }) : Promise.resolve();
    }
    get canUndo(): boolean { return !!this.selected?.editHistory?.undo.length; }
    get canRedo(): boolean { return !!this.selected?.editHistory?.redo.length; }
    private basisMatches(map: PlanningMap): boolean {
        const status = this.map.status, fingerprint = this.map.initialization?.declarationFingerprint;
        return !!(status?.state === 'ready' && status.inputFingerprint && fingerprint && sameSemanticBasis(map.basis,
            { architectureRevision: map.basis.architectureRevision, architectureFingerprint: fingerprint,
                physicalInputFingerprint: status.inputFingerprint, physicalGeneration: status.generation }));
    }
    async beginEdit(command: EditCommand): Promise<void> {
        const connection = this.connection, handle = this.handle, collection = this.collection, map = this.selected;
        const workspace = this.workspace, request = ++this.request;
        const observationGeneration = this.map.status?.generation;
        this.preview = undefined;
        if (!connection || !handle || !collection || !map || !workspace || this.map.workspace !== workspace || !this.basisMatches(map)) {
            this.error = 'Planning Map basis is stale or unavailable'; this.notify(); return;
        }
        this.loading = true; this.error = ''; this.notify();
        try {
            const transformation = await connection.preview(handle, map.id, collection.revision, map.revision,
                command, `change-${crypto.randomUUID()}`);
            if (request !== this.request || this.disposed || this.map.workspace !== workspace ||
                this.map.status?.generation !== observationGeneration) return;
            this.preview = { transformation, mapId: map.id, collectionRevision: collection.revision, mapRevision: map.revision,
                basis: map.basis, observationGeneration: observationGeneration! };
        } catch (error) { if (request === this.request && !this.disposed) this.error = String(error); }
        finally { if (request === this.request && !this.disposed) { this.loading = false; this.notify(); } }
    }
    cancelEdit(): void { this.preview = undefined; this.notify(); }
    async beginAdoption(scope: AdoptionScope): Promise<void> {
        const connection = this.connection, handle = this.handle, collection = this.collection, map = this.selected;
        const workspace = this.workspace, request = ++this.request;
        const observationGeneration = this.map.status?.generation;
        this.adoptionPreview = undefined;
        this.rebasePreview = undefined;
        if (!connection || !handle || !collection || !map || !workspace || this.map.workspace !== workspace) return;
        this.loading = true; this.error = ''; this.notify();
        try {
            const result = await connection.previewAdoption({ projectHandle: handle, mapId: map.id,
                expectedRevision: collection.revision, expectedMapRevision: map.revision, expectedBasis: map.basis, scope });
            if (request !== this.request || this.disposed || this.map.workspace !== workspace ||
                this.map.status?.generation !== observationGeneration) return;
            this.adoptionPreview = { result, mapId: map.id, collectionRevision: collection.revision, mapRevision: map.revision,
                basis: map.basis, observationGeneration: observationGeneration! };
        } catch (error) { if (request === this.request && !this.disposed) this.error = String(error); }
        finally { if (request === this.request && !this.disposed) { this.loading = false; this.notify(); } }
    }
    cancelAdoption(): void { this.adoptionPreview = undefined; this.notify(); }
    async acceptAdoption(): Promise<void> {
        const preview = this.adoptionPreview, map = this.selected, collection = this.collection;
        const connection = this.connection, handle = this.handle, workspace = this.workspace, request = ++this.request;
        if (!preview || !map || !collection || !connection || !handle || !workspace || this.map.workspace !== workspace ||
            preview.result.blockers.length || preview.mapId !== map.id || preview.mapRevision !== map.revision ||
            preview.collectionRevision !== collection.revision || this.map.status?.generation !== preview.observationGeneration) {
            this.error = 'Adoption preview is blocked or stale'; this.adoptionPreview = undefined; this.notify(); return;
        }
        this.loading = true; this.error = ''; this.notify();
        try {
            const snapshot = await connection.adoptTarget({ projectHandle: handle, mapId: map.id,
                expectedRevision: collection.revision, expectedMapRevision: map.revision, expectedBasis: preview.basis,
                scope: preview.result.scope, acceptedChanges: preview.result.changes,
                acceptedTransformationIds: [...preview.result.selectedTransformationIds, ...preview.result.includedDependentTransformationIds].sort() });
            if (request !== this.request || this.disposed || this.map.workspace !== workspace) return;
            this.collection = snapshot; this.adoptionPreview = undefined; this.stale = undefined; this.suggestions = undefined;
            void this.map.attach(workspace);
        } catch (error) { if (request === this.request && !this.disposed) this.error = String(error); }
        finally { if (request === this.request && !this.disposed) { this.loading = false; this.notify(); } }
    }
    async commitEdit(): Promise<void> {
        const preview = this.preview, map = this.selected;
        if (!preview || !map || map.id !== preview.mapId || map.revision !== preview.mapRevision ||
            this.collection?.revision !== preview.collectionRevision || !this.basisMatches(map) ||
            this.map.status?.generation !== preview.observationGeneration) {
            this.error = 'Planning preview is stale'; this.preview = undefined; this.notify(); return;
        }
        this.preview = undefined;
        await this.mutate({ type: 'put-transformation', mapId: map.id, transformation: preview.transformation,
            expectedMapRevision: preview.mapRevision, expectedBasis: preview.basis });
    }
    undo(): Promise<void> { const map = this.selected; return map && this.canUndo && this.basisMatches(map) ?
        this.mutate({ type: 'undo', mapId: map.id, expectedMapRevision: map.revision, expectedBasis: map.basis }) : Promise.resolve(); }
    redo(): Promise<void> { const map = this.selected; return map && this.canRedo && this.basisMatches(map) ?
        this.mutate({ type: 'redo', mapId: map.id, expectedMapRevision: map.revision, expectedBasis: map.basis }) : Promise.resolve(); }

    async attach(): Promise<void> {
        const workspace = this.map.workspace;
        const request = ++this.request;
        this.workspace = workspace;
        this.connection = undefined;
        this.handle = undefined;
        this.collection = undefined;
        this.stale = undefined;
        this.rebasePreview = undefined;
        this.selectedMapId = undefined;
        this.selectedWorkItemId = undefined;
        this.selectedTransformationId = undefined;
        this.suggestions = undefined;
        this.acceptedSuggestionIds.clear();
        this.preview = undefined;
        this.adoptionPreview = undefined;
        this.rebasePreview = undefined;
        this.planningMode = false;
        this.loading = !!workspace;
        this.error = '';
        this.notify();
        if (!workspace || this.disposed) return;
        try {
            const connection = this.connect();
            const { projectHandle, snapshot } = await connection.attach(workspace);
            if (request !== this.request || this.disposed || this.map.workspace !== workspace) return;
            this.connection = connection;
            this.handle = projectHandle;
            this.collection = snapshot;
            this.stale = undefined;
            this.preview = undefined;
            this.adoptionPreview = undefined;
            this.selectedMapId = snapshot.maps.find(map => map.status === 'active')?.id ?? snapshot.maps.find(map => map.status === 'draft')?.id;
            void this.refreshStale();
        } catch (error) { if (request === this.request && !this.disposed) this.error = String(error); }
        finally { if (request === this.request && !this.disposed) { this.loading = false; this.notify(); } }
    }
    async refresh(): Promise<void> {
        const connection = this.connection, handle = this.handle, workspace = this.workspace, request = ++this.request;
        if (!connection || !handle || !workspace) return;
        try {
            const snapshot = await connection.read(handle);
            if (request !== this.request || this.disposed || this.map.workspace !== workspace) return;
            this.collection = snapshot;
            this.stale = undefined;
            this.preview = undefined;
            this.adoptionPreview = undefined;
            this.rebasePreview = undefined;
            if (!snapshot.maps.some(map => map.id === this.selectedMapId)) this.selectedMapId = snapshot.maps.find(map => map.status === 'active')?.id ?? snapshot.maps[0]?.id;
            if (!this.selected?.workItems.some(item => item.id === this.selectedWorkItemId)) this.selectedWorkItemId = undefined;
            if (!this.selected?.transformations.some(item => item.id === this.selectedTransformationId)) this.selectedTransformationId = undefined;
            this.suggestions = undefined;
            this.acceptedSuggestionIds.clear();
            if (!this.showHistory && this.selected && !this.visibleMaps.includes(this.selected)) this.selectedMapId = this.visibleMaps[0]?.id;
            this.error = '';
            void this.refreshStale();
            this.notify();
        } catch (error) { if (request === this.request && !this.disposed) { this.error = String(error); this.notify(); } }
    }
    async mutate(operation: PlanningOperation): Promise<void> {
        const connection = this.connection, handle = this.handle, collection = this.collection, workspace = this.workspace;
        const request = ++this.request;
        if (!connection || !handle || !collection || !workspace || this.map.workspace !== workspace) return;
        this.loading = true; this.error = ''; this.notify();
        try {
            const snapshot = await connection.mutate({ projectHandle: handle, expectedRevision: collection.revision, operation });
            if (request !== this.request || this.disposed || this.map.workspace !== workspace) return;
            this.collection = snapshot;
            this.stale = undefined;
            if (operation.type === 'put-transformation' || operation.type === 'remove-transformation' || operation.type === 'undo' || operation.type === 'redo') this.suggestions = undefined;
            if (operation.type === 'create') this.selectedMapId = operation.id;
            if (operation.type === 'duplicate') this.selectedMapId = operation.newId;
            if (!this.showHistory && this.selected && !this.visibleMaps.includes(this.selected)) this.selectedMapId = this.visibleMaps[0]?.id;
            void this.refreshStale();
        } catch (error) {
            if (request === this.request && !this.disposed) { this.error = String(error); this.loading = false; this.notify(); }
            return;
        } finally { if (request === this.request && !this.disposed) { this.loading = false; this.notify(); } }
    }
    create(title: string, objective: string): Promise<void> {
        const status = this.map.status;
        if (!this.canCreate || !status?.inputFingerprint || !this.map.initialization?.declarationFingerprint) return Promise.resolve();
        return this.mutate({ type: 'create', id: `map-${crypto.randomUUID()}`, title, objective,
            basis: { architectureRevision: 0, architectureFingerprint: this.map.initialization.declarationFingerprint,
                physicalInputFingerprint: status.inputFingerprint, physicalGeneration: status.generation } });
    }
    duplicate(): Promise<void> { return this.selected ? this.mutate({ type: 'duplicate', mapId: this.selected.id, newId: `map-${crypto.randomUUID()}` }) : Promise.resolve(); }
    transition(status: MapStatus): Promise<void> { return this.selected && this.allowedTransitions.includes(status) ?
        this.mutate({ type: 'transition', mapId: this.selected.id, status }) : Promise.resolve(); }
    dispose(): void { this.disposed = true; ++this.request; this.mapListener.dispose(); this.listeners.clear(); }
}
