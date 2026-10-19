import { canCloseOut, detectActiveConflicts, sameObservation, sameSemanticBasis, suggestWorkItems } from '@dope/visual-planning';
import type { CrossMapConflict, MapStatus, PlanningMap, RebaseResult, StaleResult, WorkItem, WorkItemSuggestion, WorkStatus } from '@dope/visual-planning';
import type { RebaseDecision } from '@dope/visual-planning/lib/rebase';
import { acceptSuggestion } from '@dope/visual-planning/lib/work';
import type { PlannedTransformation } from '@dope/visual-planning';
import type { EditCommand } from '@dope/visual-planning/lib/editing';
import type { PlanningCollection, PlanningOperation, VisualPlanningService, CurrentSoftwareImpactPacket, TargetDesignReview, PlanningStackOutline, PlanningStackPreview, PlanningStackRecord } from '@dope/visual-planning/lib/service';
import type { AdoptionPreview, AdoptionScope } from '@dope/visual-planning/lib/adoption';
import type { SoftwareMapController } from './software-map-controller';
import type { PlanningView } from './planning-map-projection';
import type { AgentTask, AgentRun } from '@dope/agent-core';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import type { HistoryService } from '@dope/contracts/lib/history-service';

const transitions: Record<MapStatus, MapStatus[]> = {
    draft: ['active', 'archived'], active: ['superseded', 'archived'],
    completed: ['archived'], superseded: ['archived'], archived: []
};
export class PlanningMapController {
    scopeReview?: { token: string; checkpointId: string; roadmapRevision: number; roadmapSourceHash: string };
    stackOutline?: PlanningStackOutline;
    stackPreview?: PlanningStackPreview;
    stackRecord?: PlanningStackRecord;
    stackFolder = '';
    private stackBranchIds: string[] = [];
    async reviewScope(): Promise<void> {
        const context = this.prepareWorkContext;
        if (!context || !this.connection || !this.handle || context.workspace !== this.workspace) return;
        this.loading = true; this.error = ''; this.notify();
        try { this.scopeReview = await this.connection.previewScopeApproval(this.handle, context.checkpointId); }
        catch (error) { this.error = String(error); }
        finally { this.loading = false; this.notify(); }
    }
    async approveScope(): Promise<void> {
        const preview = this.scopeReview, context = this.prepareWorkContext;
        if (!preview || !context || preview.checkpointId !== context.checkpointId ||
            !this.connection || !this.handle) return;
        this.loading = true; this.error = ''; this.notify();
        try { await this.connection.approveScope(this.handle, preview.token, true); this.scopeReview = undefined; }
        catch (error) { this.error = String(error); this.scopeReview = undefined; }
        finally { this.loading = false; this.notify(); }
    }
    async prepareStackOutline(): Promise<void> {
        const context = this.prepareWorkContext, branches = this.approvedTargetBranches;
        if (!context || !branches || branches.context !== context || !this.connection || !this.handle) {
            this.error = 'Review the current checkpoint and target branches before preparing a stack'; this.notify(); return;
        }
        this.loading = true; this.error = ''; this.notify();
        try {
            const outline = await this.connection.stackOutline(this.handle, context.checkpointId, branches.ids);
            if (this.prepareWorkContext !== context || this.selected?.id !== outline.mapId ||
                this.selected.revision !== outline.mapRevision) throw new Error('Planning selection changed during outline review');
            this.stackOutline = outline; this.stackBranchIds = [...branches.ids];
            this.stackPreview = undefined; this.stackRecord = undefined; this.stackFolder = '';
        } catch (error) { this.error = String(error); }
        finally { this.loading = false; this.notify(); }
    }
    async moveStackOutline(id: string, direction: -1 | 1): Promise<void> {
        const outline = this.stackOutline, context = this.prepareWorkContext;
        if (!outline || !context || !this.connection || !this.handle || this.stackRecord) return;
        const order = outline.items.map(item => item.id), index = order.indexOf(id), next = index + direction;
        if (index < 0 || next < 0 || next >= order.length) return;
        [order[index], order[next]] = [order[next], order[index]];
        try {
            this.stackOutline = await this.connection.reorderStackOutline(this.handle, context.checkpointId,
                this.stackBranchIds, order);
            this.stackPreview = undefined; this.error = '';
        } catch (error) { this.error = String(error); }
        this.notify();
    }
    async reviewStack(folderName: string): Promise<void> {
        const outline = this.stackOutline, context = this.prepareWorkContext;
        if (!outline || !context || !this.connection || !this.handle || this.stackRecord) return;
        this.loading = true; this.error = ''; this.notify();
        try {
            this.stackPreview = await this.connection.previewStackPublication(this.handle, context.checkpointId,
                this.stackBranchIds, folderName, outline.items.map(item => item.id));
            this.stackFolder = folderName;
        } catch (error) { this.error = String(error); }
        finally { this.loading = false; this.notify(); }
    }
    async publishStack(): Promise<void> {
        const preview = this.stackPreview;
        if (!preview || !this.connection || !this.handle) return;
        this.loading = true; this.error = ''; this.notify();
        try { this.stackRecord = await this.connection.publishStack(this.handle, preview.token, true); this.stackPreview = undefined; }
        catch (error) { this.error = String(error); this.stackPreview = undefined; }
        finally { this.loading = false; this.notify(); }
    }
    async attemptAuthoredStackReorder(): Promise<void> {
        const record = this.stackRecord, outline = this.stackOutline;
        if (!record || !outline || !this.connection || !this.handle) return;
        try {
            await this.connection.attemptAuthoredStackReorder(this.handle, record.folderName,
                [...outline.items].reverse().map(item => item.id));
            this.error = 'Authored reorder unexpectedly succeeded; review the stack source';
        } catch (error) { this.error = String(error); }
        this.notify();
    }
    prepareWorkContext?: { workspace: string; projectId: string; planningProjectId: string; checkpointId: string; title: string;
        objective: string; requirements: string[]; impactReferences: string[]; mapId?: string; mapRevision?: number };
    setPrepareWorkContext(context: PlanningMapController['prepareWorkContext']): void {
        if (this.prepareWorkContext !== context) {
            this.scopeReview = undefined; this.stackOutline = undefined; this.stackPreview = undefined;
            this.stackRecord = undefined; this.stackFolder = ''; this.stackBranchIds = [];
        }
        this.prepareWorkContext = context; this.notify();
    }
    private readonly listeners = new Set<() => void>();
    private readonly mapListener;
    private connection?: VisualPlanningService;
    private handle?: string;
    private workspace?: string;
    private request = 0;
    private staleRequest = 0;
    private linkedEvidenceRequest = 0;
    private launchRequest?: { basis: string; key: string };
    private disposed = false;
    collection?: PlanningCollection;
    selectedMapId?: string;
    get focusWorkspace(): string | undefined { return this.workspace; }
    selectedWorkItemId?: string;
    linkedTasks: AgentTask[] = [];
    linkedRuns: AgentRun[] = [];
    historyReferences: { source: string; sourceId: string }[] = [];
    historyReferenceState: 'unavailable' | 'checking' | 'observed' | 'not-observed' = 'unavailable';
    launchingWork = false;
    selectedTransformationId?: string;
    selectedSuggestionIndex?: number;
    suggestions?: WorkItemSuggestion[];
    private approvedSuggestionContext?: PlanningMapController['prepareWorkContext'];
    private suggestionMapRevision?: number;
    private acceptedSuggestionIds = new Map<number, string>();
    targetApproval?: { token: string; context: NonNullable<PlanningMapController['prepareWorkContext']>;
        mapId: string; mapRevision: number; collectionRevision: number; branchIds: string[];
        impact: CurrentSoftwareImpactPacket; design: TargetDesignReview };
    approvedTargetBranches?: { context: NonNullable<PlanningMapController['prepareWorkContext']>; ids: string[] };
    planningMode = false;
    view: PlanningView = 'diff';
    showHistory = false;
    loading = false;
    error = '';
    preview?: { transformation: PlannedTransformation; mapId: string; collectionRevision: number; mapRevision: number; basis: PlanningMap['basis']; observationGeneration: number };
    adoptionPreview?: { result: AdoptionPreview; mapId: string; collectionRevision: number; mapRevision: number; basis: PlanningMap['basis']; observationGeneration: number };
    stale?: StaleResult;
    rebasePreview?: { result: RebaseResult; mapId: string; collectionRevision: number; mapRevision: number; decisions: RebaseDecision[] };

    constructor(private readonly map: SoftwareMapController, private readonly connect: () => VisualPlanningService,
        private readonly agent?: AgentRuntimeService, private readonly history?: HistoryService) {
        this.mapListener = map.onChange(() => { if (this.workspace !== map.workspace) {
            this.setPrepareWorkContext(undefined); void this.attach();
        } else void this.refreshStale(); });
        void this.attach();
    }
    onChange(listener: () => void): { dispose(): void } {
        this.listeners.add(listener);
        return { dispose: () => { this.listeners.delete(listener); } };
    }
    private notify(): void { for (const listener of this.listeners) listener(); }
    get selected(): PlanningMap | undefined { return this.collection?.maps.find(map => map.id === this.selectedMapId); }
    get projectWorkspace(): string | undefined { return this.workspace; }
    get canCreate(): boolean { return !!(this.map.status?.state === 'ready' && this.map.status.inputFingerprint &&
        this.map.initialization?.declarationFingerprint && this.handle && this.map.workspace === this.workspace); }
    get visibleMaps(): PlanningMap[] { return this.collection?.maps.filter(map => this.showHistory || map.status === 'draft' || map.status === 'active') ?? []; }
    get conflicts(): CrossMapConflict[] { return detectActiveConflicts(this.collection?.maps ?? []); }
    get allowedTransitions(): MapStatus[] { return this.selected ? transitions[this.selected.status] : []; }
    get canCloseOut(): boolean { return !!this.selected && this.selected.status === 'active' && canCloseOut(this.selected); }
    async reviewTarget(branchIds: string[]): Promise<void> {
        const context = this.prepareWorkContext, map = this.selected, collection = this.collection;
        const connection = this.connection, handle = this.handle;
        if (!context?.mapId || !map || !collection || !connection || !handle ||
            context.workspace !== this.workspace || context.planningProjectId !== collection.projectId ||
            context.mapId !== map.id || context.mapRevision !== map.revision ||
            !this.stale || this.stale.stale || !this.basisMatches(map)) {
            this.error = 'Select a current linked checkpoint Planning Map before target review'; this.notify(); return;
        }
        if (this.targetApproval) await this.rejectTarget();
        this.loading = true; this.error = ''; this.notify();
        try {
            const preview = await connection.previewTargetApproval(handle, context.checkpointId, branchIds);
            if (this.prepareWorkContext !== context || this.selected?.id !== map.id ||
                this.selected.revision !== map.revision || this.collection?.revision !== collection.revision ||
                this.workspace !== context.workspace) {
                await connection.rejectTarget(handle, preview.token);
                throw new Error('Planning target changed during review. Prepare Work again.');
            }
            this.targetApproval = { token: preview.token, context, mapId: map.id, mapRevision: map.revision,
                branchIds: [...branchIds],
                collectionRevision: collection.revision, impact: preview.impact, design: preview.design };
        } catch (error) { this.error = String(error); }
        finally { this.loading = false; this.notify(); }
    }
    async rejectTarget(): Promise<void> {
        const preview = this.targetApproval;
        this.targetApproval = undefined; this.notify();
        if (preview && this.connection && this.handle) {
            try { await this.connection.rejectTarget(this.handle, preview.token); }
            catch (error) { this.error = String(error); this.notify(); }
        }
    }
    async approveReviewedTarget(): Promise<void> {
        const preview = this.targetApproval, map = this.selected, collection = this.collection;
        if (!preview || !map || !collection || this.prepareWorkContext !== preview.context ||
            map.id !== preview.mapId || map.revision !== preview.mapRevision ||
            collection.revision !== preview.collectionRevision || this.workspace !== preview.context.workspace ||
            !this.connection || !this.handle || !this.stale || this.stale.stale || !this.basisMatches(map)) {
            this.error = 'Planning target changed after review. Prepare Work again.'; this.notify(); return;
        }
        this.loading = true; this.error = ''; this.notify();
        try {
            await this.connection.approveTarget(this.handle, preview.token, true);
            this.approvedTargetBranches = { context: preview.context, ids: [...preview.branchIds] };
            this.targetApproval = undefined;
        } catch (error) { this.targetApproval = undefined; this.error = String(error); }
        finally { this.loading = false; this.notify(); }
    }
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
    select(id: string): void { if (this.collection?.maps.some(map => map.id === id)) { ++this.linkedEvidenceRequest; this.preview = undefined; this.adoptionPreview = undefined; this.rebasePreview = undefined; this.stale = undefined; this.selectedMapId = id;
        this.targetApproval = undefined;
        this.approvedTargetBranches = undefined;
        if (this.prepareWorkContext?.mapId !== id) this.prepareWorkContext = undefined;
        this.selectedWorkItemId = undefined; this.linkedTasks = []; this.linkedRuns = []; this.historyReferences = [];
        this.historyReferenceState = 'unavailable'; this.selectedTransformationId = undefined; this.selectedSuggestionIndex = undefined; this.suggestions = undefined; this.notify(); void this.refreshStale(); } }
    clearSelection(): void {
        this.targetApproval = undefined;
        this.approvedTargetBranches = undefined;
        ++this.linkedEvidenceRequest;
        this.selectedMapId = undefined; this.selectedWorkItemId = undefined; this.selectedTransformationId = undefined;
        this.linkedTasks = []; this.linkedRuns = []; this.historyReferences = []; this.historyReferenceState = 'unavailable';
        this.preview = undefined; this.adoptionPreview = undefined; this.rebasePreview = undefined;
        this.stale = undefined; this.suggestions = undefined; this.selectedSuggestionIndex = undefined; this.notify();
    }
    /** Fresh owner read for exact Session navigation; leaves Planning presentation and drafts untouched. */
    async navigationMap(id: string): Promise<PlanningMap | undefined> {
        const connection = this.connection, handle = this.handle, workspace = this.workspace;
        if (!connection || !handle || !workspace || this.map.workspace !== workspace || !this.collection) return;
        try {
            const snapshot = await connection.read(handle);
            if (this.disposed || this.workspace !== workspace || this.map.workspace !== workspace ||
                snapshot.projectId !== this.collection?.projectId) return;
            return snapshot.maps.find(map => map.id === id);
        } catch { return; }
    }
    /** Fresh, read-only linked-map check for the Roadmap handoff. */
    async navigationCurrentMap(id: string): Promise<PlanningMap | undefined> {
        const connection = this.connection, handle = this.handle, workspace = this.workspace;
        const collection = this.collection;
        if (!connection || !handle || !workspace || !collection || this.map.workspace !== workspace) return;
        try {
            const before = await connection.read(handle);
            const map = before.maps.find(item => item.id === id);
            if (before.projectId !== collection.projectId || before.revision !== collection.revision ||
                !map || map.projectId !== before.projectId) return;
            const stale = await connection.staleness(handle, id);
            const currentBasis = await connection.currentBasis(handle);
            const after = await connection.read(handle);
            const current = after.maps.find(item => item.id === id);
            if (this.disposed || this.workspace !== workspace || this.map.workspace !== workspace ||
                this.collection?.projectId !== before.projectId || after.projectId !== before.projectId ||
                after.revision !== before.revision || !current || current.revision !== map.revision ||
                current.projectId !== after.projectId || !sameObservation(current.basis, map.basis) ||
                !sameSemanticBasis(map.basis, currentBasis) || stale.stale || stale.conflicts.length)
                return;
            return map;
        } catch { return; }
    }
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
            this.collection = snapshot; this.rebasePreview = undefined; this.stale = undefined; this.suggestions = undefined; this.selectedSuggestionIndex = undefined; void this.refreshStale();
        } catch (error) { if (request === this.request && !this.disposed) this.error = String(error); }
        finally { if (request === this.request && !this.disposed) { this.loading = false; this.notify(); } }
    }
    get selectedWorkItem(): WorkItem | undefined { return this.selected?.workItems.find(item => item.id === this.selectedWorkItemId); }
    get canLaunchWork(): boolean {
        const item = this.selectedWorkItem, map = this.selected;
        const contains = (parent: string, child: string) => child === parent || child.startsWith(`${parent}/`);
        return !!(this.agent && item && map?.status === 'active' && ['ready', 'in-progress'].includes(item.status) &&
            (item.assignment === 'AI' || item.assignment === 'SHARED') && item.delegablePaths?.length &&
            item.delegablePaths.every(path => item.workingSet.some(root => contains(root, path)) &&
                !item.humanReservedPaths?.some(reserved => contains(path, reserved) || contains(reserved, path))) &&
            (item.assignment === 'AI' ? !item.humanReservedPaths?.length : !!item.humanReservedPaths?.length) &&
            !this.stale?.stale && this.stale && this.basisMatches(map) && this.collection && this.handle &&
            this.workspace === this.map.workspace && !this.loading && !this.launchingWork);
    }
    async refreshLinkedTasks(): Promise<void> {
        const item = this.selectedWorkItem, map = this.selected, workspace = this.workspace;
        const request = ++this.linkedEvidenceRequest;
        this.linkedTasks = []; this.linkedRuns = []; this.historyReferences = [];
        this.historyReferenceState = this.history ? 'checking' : 'unavailable'; this.notify();
        if (!item || !map || !workspace || !this.agent) {
            this.historyReferenceState = 'unavailable'; this.notify(); return;
        }
        try {
            const { projectHandle } = await this.agent.attach(workspace);
            const tasks = (await this.agent.listWorkItemTasks(projectHandle, map.id, item.id)).filter(task =>
                task.projectId === map.projectId && task.origin.kind === 'work-item' &&
                task.origin.projectId === map.projectId && task.origin.planningMapId === map.id &&
                task.origin.workItemId === item.id);
            const taskIds = new Set(tasks.map(task => task.id));
            const runs = (await this.agent.listRuns(projectHandle)).filter(run =>
                run.projectId === map.projectId && taskIds.has(run.taskId));
            let references: typeof this.historyReferences = [];
            let referenceState: 'unavailable' | 'observed' | 'not-observed' = 'unavailable';
            if (this.history) try {
                const historyHandle = (await this.history.attach(workspace)).projectHandle;
                const snapshot = await this.history.read(historyHandle);
                if (snapshot.project.projectId === map.projectId) {
                    const runIds = new Set(runs.map(run => run.id));
                    references = snapshot.entries.filter(entry => entry.projectId === map.projectId &&
                        entry.projectRoot === snapshot.project.projectRoot &&
                        (!entry.ownerProjectId || entry.ownerProjectId === map.projectId) && entry.availability === 'available' &&
                        (entry.owner.kind === 'work-item' && entry.owner.mapId === map.id && entry.owner.workItemId === item.id ||
                            entry.owner.kind === 'agent-run' && runIds.has(entry.owner.runId)))
                        .map(entry => ({ source: entry.source, sourceId: entry.sourceId }));
                    referenceState = references.length ? 'observed' : 'not-observed';
                }
            } catch { referenceState = 'unavailable'; }
            if (request === this.linkedEvidenceRequest && !this.disposed && this.workspace === workspace &&
                this.selected?.id === map.id && this.selectedWorkItemId === item.id) {
                this.linkedTasks = tasks; this.linkedRuns = runs; this.historyReferences = references;
                this.historyReferenceState = referenceState; this.notify();
            }
        } catch (error) { if (request === this.linkedEvidenceRequest && this.workspace === workspace && this.selectedWorkItemId === item.id) {
            this.error = String(error); this.notify(); } }
    }
    async launchWork(validationCommand?: string, validationApproved = false): Promise<AgentTask | undefined> {
        if (!this.canLaunchWork || !this.agent) return;
        const command = validationCommand?.trim();
        if (!validationApproved || !command || command.length > 160 || /[\r\n\0]/u.test(command)) {
            this.error = 'Launch Work requires explicit approval of one local required test command (1–160 characters).';
            this.notify();
            return;
        }
        const item = this.selectedWorkItem!, map = this.selected!, collection = this.collection!, workspace = this.workspace!;
        const basis = `${workspace}\0${collection.revision}\0${map.id}\0${map.revision}\0${item.id}\0${item.delegablePaths!.join('\0')}\0${command}`;
        if (this.launchRequest?.basis !== basis) this.launchRequest = { basis, key: crypto.randomUUID() };
        const requestKey = this.launchRequest.key;
        this.launchingWork = true; this.error = ''; this.notify();
        try {
            const { projectHandle } = await this.agent.attach(workspace);
            if (this.disposed || this.workspace !== workspace || this.selected?.id !== map.id ||
                this.selectedWorkItemId !== item.id || this.collection?.revision !== collection.revision ||
                this.selected.revision !== map.revision || !this.canLaunchBasis(map)) return;
            const task = await this.agent.launchWorkItem(projectHandle, { requestKey,
                expectedProjectRevision: collection.revision, expectedMapRevision: map.revision,
                planningMapId: map.id, workItemId: item.id, delegablePaths: [...item.delegablePaths!],
                modelPolicy: { kind: 'follow-coding-agent' }, controls: {},
                completion: { validation: [{ kind: 'test', label: 'Required WorkItem validation', command }], requireValidationPass: true },
                validationApproved: true });
            if (this.disposed || this.workspace !== workspace || this.selected?.id !== map.id || this.selectedWorkItemId !== item.id) return;
            if (this.launchRequest?.key === requestKey) this.launchRequest = undefined;
            await this.refreshLinkedTasks();
            return task;
        } catch (error) { if (this.workspace === workspace && !this.disposed) { this.error = String(error); this.notify(); } }
        finally { this.launchingWork = false; this.notify(); }
    }
    private canLaunchBasis(map: PlanningMap): boolean { return !!(this.stale && !this.stale.stale && this.basisMatches(map)); }
    requestSuggestions(): void { this.approvedSuggestionContext = undefined; if (this.prepareWorkContext) {
            this.suggestions = undefined; this.error = 'Approve the current target and request its reviewed WorkItem suggestions first';
            this.notify(); return;
        }
        this.suggestions = this.selected ? suggestWorkItems(this.selected) : [];
        this.suggestionMapRevision = this.selected?.revision; this.selectedSuggestionIndex = undefined;
        this.acceptedSuggestionIds.clear(); this.notify(); }
    async requestApprovedSuggestions(branchIds: string[]): Promise<void> {
        const context = this.prepareWorkContext, map = this.selected, connection = this.connection, handle = this.handle;
        if (!context || !map || !connection || !handle || context.workspace !== this.workspace ||
            context.planningProjectId !== map.projectId || context.mapId !== map.id) { this.error = 'Select the linked checkpoint Planning Map'; this.notify(); return; }
        this.loading = true; this.error = ''; this.notify();
        try {
            const suggestions = await connection.suggestApprovedWorkItems(handle, context.checkpointId, branchIds);
            if (this.prepareWorkContext !== context || this.selected?.id !== map.id ||
                this.selected.revision !== map.revision || this.workspace !== context.workspace) return;
            this.suggestions = suggestions; this.approvedSuggestionContext = context;
            this.suggestionMapRevision = map.revision;
            this.selectedSuggestionIndex = undefined;
            this.acceptedSuggestionIds.clear();
        } catch (error) { this.error = String(error); this.suggestions = undefined; }
        finally { this.loading = false; this.notify(); }
    }
    get canReviewSuggestions(): boolean {
        const map = this.selected, context = this.prepareWorkContext;
        return !!(map && (map.status === 'draft' || map.status === 'active') && context && context.workspace === this.workspace && context.planningProjectId === map.projectId &&
            context.mapId === map.id && !this.loading && this.stale && !this.stale.stale && this.basisMatches(map));
    }
    get suggestionBlocker(): string | undefined {
        const map = this.selected;
        if (!map) return 'Select a Planning Map';
        if (map.status !== 'draft' && map.status !== 'active') return 'Planning Map is closed for preparation';
        if (this.loading) return 'Planning Map is busy';
        if (!this.stale || this.stale.stale || !this.basisMatches(map)) return 'Physical Map basis is stale or unavailable; refresh or rebase';
        if (this.prepareWorkContext && (this.approvedSuggestionContext !== this.prepareWorkContext ||
            this.prepareWorkContext.mapId !== map.id || this.prepareWorkContext.planningProjectId !== map.projectId))
            return 'Request suggestions for the approved current checkpoint target';
        if (this.suggestionMapRevision === undefined || map.revision !== this.suggestionMapRevision)
            return 'Planning target changed; request suggestions again';
        return undefined;
    }
    get workItemBlocker(): string | undefined {
        const map = this.selected, context = this.prepareWorkContext;
        if (!map || this.loading || !this.stale || this.stale.stale || !this.basisMatches(map))
            return 'Planning Map or Physical Map basis is stale or unavailable';
        if (map.status !== 'draft' && map.status !== 'active') return 'Planning Map is closed for editing';
        if (context && (context.workspace !== this.workspace || context.planningProjectId !== map.projectId || context.mapId !== map.id))
            return 'Checkpoint scope changed; review the linked Planning Map';
        return undefined;
    }
    canAcceptSuggestion(index: number): boolean {
        const suggestion = this.suggestions?.[index];
        return !!(suggestion && !this.suggestionBlocker && !this.isSuggestionAccepted(index) &&
            suggestion.dependsOn.every(i => !!this.suggestionWorkItemId(i)));
    }
    private suggestionWorkItemId(index: number): string | undefined {
        const suggestion = this.suggestions?.[index];
        return this.acceptedSuggestionIds.get(index) ?? (suggestion && this.selected?.workItems.find(item =>
            item.status !== 'cancelled' && item.transformationIds.join('|') === suggestion.transformationIds.join('|'))?.id);
    }
    isSuggestionAccepted(index: number): boolean { return !!this.suggestionWorkItemId(index); }
    rejectSuggestion(index: number): void {
        if (!this.suggestions?.[index] || this.isSuggestionAccepted(index)) return;
        if (this.suggestions.some((suggestion, i) => i !== index && suggestion.dependsOn.includes(index))) {
            this.error = 'Reject dependent suggestions first'; this.notify(); return;
        }
        this.suggestions.splice(index, 1);
        if (this.selectedSuggestionIndex === index) this.selectedSuggestionIndex = undefined;
        else if (this.selectedSuggestionIndex !== undefined && this.selectedSuggestionIndex > index) this.selectedSuggestionIndex--;
        this.suggestions = this.suggestions.map(suggestion => ({ ...suggestion,
            dependsOn: suggestion.dependsOn.map(i => i > index ? i - 1 : i) }));
        this.acceptedSuggestionIds = new Map([...this.acceptedSuggestionIds].map(([i, id]) => [i > index ? i - 1 : i, id]));
        this.error = ''; this.notify();
    }
    editSuggestion(index: number, objective: string, acceptanceCriteria: string[], validationTargets: string[]): void {
        const suggestion = this.suggestions?.[index];
        if (!suggestion || this.isSuggestionAccepted(index) || !objective.trim() ||
            !acceptanceCriteria.length || !validationTargets.length) {
            this.error = 'Suggestion needs an objective, acceptance criteria and validation targets'; this.notify(); return;
        }
        this.suggestions![index] = { ...suggestion, objective: objective.trim(), acceptanceCriteria, validationTargets };
        this.error = ''; this.notify();
    }
    selectSuggestion(index: number): void {
        this.selectedSuggestionIndex = this.suggestions?.[index] ? index : undefined;
        this.selectedWorkItemId = undefined; this.selectedTransformationId = undefined; this.notify();
    }
    splitSuggestion(index: number, parts: [string[], string[]]): void {
        const suggestion = this.suggestions?.[index];
        if (!suggestion || this.isSuggestionAccepted(index) || parts.some(part => !part.length || part.some(id => !suggestion.transformationIds.includes(id))) ||
            suggestion.transformationIds.some(id => !parts.some(part => part.includes(id)))) throw new Error('Invalid suggestion split');
        const split = parts.map((refs, part) => {
            const selectedRefs = [...new Set(refs)].sort(), selected = this.selected!.transformations.filter(t => selectedRefs.includes(t.id));
            const workingSet = [...new Set(selected.flatMap(t => [
                ...t.futureNodes.flatMap(node => node.roots),
                ...(this.selected!.basisSnapshot?.physicalNodes ?? []).filter(node => t.currentIds.includes(node.id) && node.path).map(node => node.path!)
            ]))].sort();
            return { ...suggestion, transformationIds: selectedRefs, objective: `${suggestion.objective} (${part + 1})`,
                requirements: selectedRefs.map(id => `Implement approved transformation ${id}`),
                acceptanceCriteria: selected.map(t => `Target ${t.futureNodes.map(node => node.id).join(', ') || t.currentIds.join(', ') || 'relationship'} matches approved ${t.kind} ${t.id}`),
                validationTargets: selectedRefs.map(id => `Reinspect source and Physical Map for ${id}`),
                workingSet, humanReservedPaths: workingSet,
                dependsOn: [...new Set([...suggestion.dependsOn,
                    ...selected.flatMap(t => t.dependsOn.filter(id => parts[1 - part].includes(id)).map(() => index + (1 - part)))])].sort((a, b) => a - b) };
        });
        this.suggestions = this.suggestions!.flatMap((candidate, i) => i === index ? split : [{ ...candidate,
            dependsOn: candidate.dependsOn.flatMap(dep => dep === index ? [index, index + 1] : [dep > index ? dep + 1 : dep]) }]);
        this.acceptedSuggestionIds = new Map([...this.acceptedSuggestionIds].map(([i, id]) => [i > index ? i + 1 : i, id]));
        this.notify();
    }
    selectWorkItem(id?: string): void { this.selectedWorkItemId = this.selected?.workItems.some(item => item.id === id) ? id : undefined;
        ++this.linkedEvidenceRequest;
        this.selectedSuggestionIndex = undefined;
        this.selectedTransformationId = undefined; this.linkedTasks = []; this.linkedRuns = [];
        this.historyReferences = []; this.historyReferenceState = 'unavailable'; this.notify(); void this.refreshLinkedTasks(); }
    selectTransformation(id?: string): void { this.selectedTransformationId = this.selected?.transformations.some(item => item.id === id) ? id : undefined;
        this.selectedSuggestionIndex = undefined;
        this.selectedWorkItemId = undefined; this.notify(); }
    get linkedWorkItems(): WorkItem[] { return this.selected?.workItems.filter(item => item.transformationIds.includes(this.selectedTransformationId ?? '')) ?? []; }
    async acceptSuggestion(index: number): Promise<void> {
        const map = this.selected, suggestion = this.suggestions?.[index];
        if (!map || !suggestion) return;
        if (!this.canAcceptSuggestion(index)) { this.error = this.suggestionBlocker ?? 'Accept predecessor suggestions first'; this.notify(); return; }
        const dependencies = suggestion.dependsOn.map(i => this.suggestionWorkItemId(i))
            .filter((id): id is string => !!id);
        if (dependencies.length !== suggestion.dependsOn.length) { this.error = 'Accept predecessor suggestions first'; this.notify(); return; }
        let item: WorkItem;
        try { item = { ...acceptSuggestion(map, suggestion, `work-${crypto.randomUUID()}`), dependsOn: dependencies }; }
        catch (error) { this.error = String(error); this.notify(); return; }
        await this.mutate({ type: 'put-work-item', mapId: map.id, workItem: item });
        if (this.selected?.workItems.some(work => work.id === item.id)) {
            this.suggestionMapRevision = this.selected.revision;
            this.acceptedSuggestionIds.set(index, item.id); this.selectWorkItem(item.id);
        }
    }
    private mutateWorkItem(operation: PlanningOperation): Promise<void> {
        const blocker = this.workItemBlocker;
        if (blocker) { this.error = blocker; this.notify(); return Promise.resolve(); }
        return this.mutate(operation);
    }
    putWorkItem(item: WorkItem): Promise<void> { return this.selected ?
        this.mutateWorkItem({ type: 'put-work-item', mapId: this.selected.id, workItem: item }) : Promise.resolve(); }
    splitWorkItem(sourceId: string, parts: [WorkItem, WorkItem]): Promise<void> { return this.selected ?
        this.mutateWorkItem({ type: 'split-work-item', mapId: this.selected.id, sourceId, parts }) : Promise.resolve(); }
    mergeWorkItems(sourceIds: [string, string], merged: WorkItem): Promise<void> { return this.selected ?
        this.mutateWorkItem({ type: 'merge-work-items', mapId: this.selected.id, sourceIds, merged }) : Promise.resolve(); }
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
        ++this.linkedEvidenceRequest;
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
        this.launchRequest = undefined;
        this.linkedTasks = [];
        this.linkedRuns = [];
        this.historyReferences = [];
        this.historyReferenceState = 'unavailable';
        this.selectedTransformationId = undefined;
        this.suggestions = undefined;
        this.selectedSuggestionIndex = undefined;
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
            if (!snapshot.maps.some(map => map.id === this.selectedMapId)) this.selectedMapId =
                this.prepareWorkContext && !this.prepareWorkContext.mapId ? undefined :
                    snapshot.maps.find(map => map.status === 'active')?.id ?? snapshot.maps[0]?.id;
            if (!this.selected?.workItems.some(item => item.id === this.selectedWorkItemId)) this.selectedWorkItemId = undefined;
            void this.refreshLinkedTasks();
            if (!this.selected?.transformations.some(item => item.id === this.selectedTransformationId)) this.selectedTransformationId = undefined;
            this.suggestions = undefined;
            this.selectedSuggestionIndex = undefined;
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
            this.stackOutline = undefined; this.stackPreview = undefined;
            this.stale = undefined;
            if (operation.type === 'put-transformation' || operation.type === 'remove-transformation' || operation.type === 'undo' || operation.type === 'redo') {
                this.suggestions = undefined; this.selectedSuggestionIndex = undefined;
            }
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
