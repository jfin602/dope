import { canCloseOut, detectActiveConflicts } from '@dope/visual-planning';
import type { CrossMapConflict, MapStatus, PlanningMap } from '@dope/visual-planning';
import type { PlannedTransformation } from '@dope/visual-planning';
import type { EditCommand } from '@dope/visual-planning/lib/editing';
import type { PlanningCollection, PlanningOperation, VisualPlanningService } from '@dope/visual-planning/lib/service';
import type { SoftwareMapController } from './software-map-controller';
import type { PlanningView } from './planning-map-projection';

const transitions: Record<MapStatus, MapStatus[]> = {
    draft: ['active', 'archived'], active: ['completed', 'superseded', 'archived'],
    completed: ['archived'], superseded: ['archived'], archived: []
};
export class PlanningMapController {
    private readonly listeners = new Set<() => void>();
    private readonly mapListener;
    private connection?: VisualPlanningService;
    private handle?: string;
    private workspace?: string;
    private request = 0;
    private disposed = false;
    collection?: PlanningCollection;
    selectedMapId?: string;
    planningMode = false;
    view: PlanningView = 'diff';
    showHistory = false;
    loading = false;
    error = '';
    preview?: { transformation: PlannedTransformation; mapId: string; collectionRevision: number; mapRevision: number; basis: PlanningMap['basis'] };

    constructor(private readonly map: SoftwareMapController, private readonly connect: () => VisualPlanningService) {
        this.mapListener = map.onChange(() => { if (this.workspace !== map.workspace) void this.attach(); });
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
    get allowedTransitions(): MapStatus[] { return this.selected ? transitions[this.selected.status].filter(status => status !== 'completed' || canCloseOut(this.selected!)) : []; }
    setMode(value: boolean): void { this.planningMode = value; this.notify(); }
    setView(value: PlanningView): void { this.view = value; this.notify(); }
    setHistory(value: boolean): void {
        this.showHistory = value;
        if (!value && this.selected && !this.visibleMaps.includes(this.selected)) this.selectedMapId = this.visibleMaps[0]?.id;
        this.notify();
    }
    select(id: string): void { if (this.collection?.maps.some(map => map.id === id)) { this.preview = undefined; this.selectedMapId = id; this.notify(); } }
    get canUndo(): boolean { return !!this.selected?.editHistory?.undo.length; }
    get canRedo(): boolean { return !!this.selected?.editHistory?.redo.length; }
    private basisMatches(map: PlanningMap): boolean {
        return this.map.initialization?.declarationFingerprint === map.basis.architectureFingerprint &&
            this.map.status?.inputFingerprint === map.basis.physicalInputFingerprint &&
            this.map.status?.generation === map.basis.physicalGeneration && this.map.status?.state === 'ready';
    }
    async beginEdit(command: EditCommand): Promise<void> {
        const connection = this.connection, handle = this.handle, collection = this.collection, map = this.selected;
        const workspace = this.workspace, request = ++this.request;
        this.preview = undefined;
        if (!connection || !handle || !collection || !map || !workspace || this.map.workspace !== workspace || !this.basisMatches(map)) {
            this.error = 'Planning Map basis is stale or unavailable'; this.notify(); return;
        }
        this.loading = true; this.error = ''; this.notify();
        try {
            const transformation = await connection.preview(handle, map.id, collection.revision, map.revision,
                command, `change-${crypto.randomUUID()}`);
            if (request !== this.request || this.disposed || this.map.workspace !== workspace) return;
            this.preview = { transformation, mapId: map.id, collectionRevision: collection.revision, mapRevision: map.revision, basis: map.basis };
        } catch (error) { if (request === this.request && !this.disposed) this.error = String(error); }
        finally { if (request === this.request && !this.disposed) { this.loading = false; this.notify(); } }
    }
    cancelEdit(): void { this.preview = undefined; this.notify(); }
    async commitEdit(): Promise<void> {
        const preview = this.preview, map = this.selected;
        if (!preview || !map || map.id !== preview.mapId || map.revision !== preview.mapRevision ||
            this.collection?.revision !== preview.collectionRevision || !this.basisMatches(map)) {
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
        this.selectedMapId = undefined;
        this.preview = undefined;
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
            this.preview = undefined;
            this.selectedMapId = snapshot.maps.find(map => map.status === 'active')?.id ?? snapshot.maps.find(map => map.status === 'draft')?.id;
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
            this.preview = undefined;
            if (!snapshot.maps.some(map => map.id === this.selectedMapId)) this.selectedMapId = snapshot.maps.find(map => map.status === 'active')?.id ?? snapshot.maps[0]?.id;
            if (!this.showHistory && this.selected && !this.visibleMaps.includes(this.selected)) this.selectedMapId = this.visibleMaps[0]?.id;
            this.error = '';
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
            if (operation.type === 'create') this.selectedMapId = operation.id;
            if (operation.type === 'duplicate') this.selectedMapId = operation.newId;
            if (!this.showHistory && this.selected && !this.visibleMaps.includes(this.selected)) this.selectedMapId = this.visibleMaps[0]?.id;
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
