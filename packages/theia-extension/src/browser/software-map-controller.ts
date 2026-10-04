import { parseArchitecture, parseAnalysisProgressEvent, branchFingerprint, targetBranch, suggestArchitectureId, reviewDeclaration, reviewDiagnostics } from '@dope/software-map';
import type { ArchitectureDeclaration, ArchitectureReview, ArchitectureReviewNode, ArchitectureViolation, CurrentArchitecture, SaveArchitectureResult, Evidence, FlowQuery, FlowQueryResult, GraphNode, SoftwareMapPage, SoftwareMapRelationshipRequest, GraphRelationship, SoftwareMapStatus, SoftwareMapClient, SoftwareMapService, SoftwareMapInitializationStatus, AnalysisProgressEvent, SynthesisDryRunReport, TargetedRefinementResult, ProposedArchitectureNode } from '@dope/software-map';
import type { AIInventoryState, AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import type { AICredentialService } from '@dope/contracts/lib/ai-credential-service';
import { AI_REGISTRY_VERSION } from '@dope/ai';

export type SoftwareMapConnection = SoftwareMapService & { setClient(client: SoftwareMapClient | undefined): void };
export interface SynthesisPreferenceStore {
    getData<T>(key: string): Promise<T | undefined>;
    setData<T>(key: string, value: T): Promise<void>;
}
const preferenceKey = 'dope.smap.synthesis';
const declinedThisSession = new Set<string>();
type SynthesisChoice = { kind: 'local' | 'gemini'; endpoint: string; model: string; geminiModel?: string };

export function declarationFromDraft(draft: ArchitectureReviewNode[]): ArchitectureDeclaration {
    const issues = reviewDiagnostics(draft);
    if (issues.length) throw new Error(`Invalid architecture review draft: ${issues[0].message}`);
    return parseArchitecture(reviewDeclaration(draft));
}

export class SoftwareMapController {
    private readonly listeners = new Set<() => void>();
    onChange(listener: () => void): { dispose(): void } {
        this.listeners.add(listener);
        return { dispose: () => { this.listeners.delete(listener); } };
    }
    private notify(): void { this.changed(); for (const listener of this.listeners) listener(); }
    draftChanged(): void {
        if (this.refinementPreview && branchFingerprint(targetBranch(this.draft, this.refinementPreview.targetKey),
            this.draft.find(node => node.proposalKey === this.refinementPreview!.parentKey)) !== this.refinementPreview.branchFingerprint)
            this.refinementPreview = undefined;
        if (this.flow === 'review' && this.review) {
            this.draftDirty = true;
            if (this.draftTimer) clearTimeout(this.draftTimer);
            this.draftTimer = setTimeout(() => { void this.flushReviewDraft().catch(error => { this.error = String(error); this.notify(); }); }, 250);
        }
        this.notify();
    }
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
    flow: 'none' | 'offer' | 'setup' | 'dry-run' | 'review' | 'manual' = 'none';
    review?: ArchitectureReview;
    draft: ArchitectureReviewNode[] = [];
    refinementPreview?: TargetedRefinementResult;
    readonly refinedEvidence = new Map<string, ProposedArchitectureNode>();
    readonly refinedSources = new Map<string, TargetedRefinementResult['evidence']>();
    refinementBusyKey?: string;
    refinementError?: { key: string; message: string };
    private refinementRequest = 0;
    inventory?: AIInventoryState;
    connectionId = '';
    modelId = '';
    contextWindowTokens = 0;
    private configuredTarget?: string;
    private readonly consentedTargets = new Set<string>();
    private reviewConsentTarget?: string;
    setupReady = false;
    setupBusy = false;
    dryRunBusy = false;
    dryRunReport?: SynthesisDryRunReport;
    dryRunError = '';
    private dryRunRequest = 0;
    progressEvents: AnalysisProgressEvent[] = [];
    private analysisStartedAt?: number;
    reviewElapsedMs?: number;
    private setupRequest = 0;
    private clearingSetup?: Promise<void>;
    private nextKey = 0;
    private draftRevision = 0;
    private draftDirty = false;
    private draftTimer?: ReturnType<typeof setTimeout>;
    private saving?: Promise<void>;
    private connection?: SoftwareMapConnection;
    private handle?: string;
    private project = 0;
    private request = 0;
    private detailRequest = 0;
    private originRequest = 0;
    private disposed = false;

    constructor(private readonly connect: () => SoftwareMapConnection, private readonly changed: () => void,
        private readonly preferences?: SynthesisPreferenceStore, private readonly registry?: AIRegistryService,
        private readonly credentials?: AICredentialService) { }

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
    private flushReviewDraft(): Promise<void> {
        if (this.draftTimer) clearTimeout(this.draftTimer);
        this.draftTimer = undefined;
        if (this.saving) return this.saving;
        const save = async () => {
            while (this.draftDirty && this.connection && this.handle && this.review && this.flow === 'review') {
                const connection = this.connection, handle = this.handle, reviewId = this.review.reviewId;
                const draft = structuredClone(this.draft), expectedRevision = this.draftRevision;
                this.draftDirty = false;
                try {
                    this.draftRevision = await connection.saveReviewDraft(handle, reviewId, expectedRevision, draft);
                    this.review.revision = this.draftRevision;
                } catch (error) { this.draftDirty = true; throw error; }
            }
        };
        this.saving = save().finally(() => { this.saving = undefined; });
        return this.saving;
    }
    async attach(workspace?: string): Promise<void> {
        if (this.disposed) return;
        try { await this.flushReviewDraft(); }
        catch (error) { this.error = String(error); this.notify(); return; }
        const project = ++this.project;
        ++this.request;
        ++this.detailRequest;
        ++this.setupRequest;
        ++this.dryRunRequest;
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
        this.draftRevision = 0;
        this.draftDirty = false;
        this.refinementPreview = undefined; this.refinementBusyKey = undefined; this.refinementError = undefined; ++this.refinementRequest;
        this.refinedEvidence.clear();
        this.refinedSources.clear();
        this.inventory = undefined;
        this.connectionId = '';
        this.modelId = '';
        this.setupReady = false;
        this.setupBusy = false;
        this.dryRunBusy = false;
        this.dryRunReport = undefined;
        this.dryRunError = '';
        this.configuredTarget = undefined;
        this.reviewConsentTarget = undefined;
        this.consentedTargets.clear();
        this.clearingSetup = undefined;
        this.progressEvents = [];
        this.analysisStartedAt = undefined;
        this.reviewElapsedMs = undefined;
        this.loading = !!workspace;
        this.notify();
        if (!workspace) return;
        try {
            const connection = this.connect();
            this.connection = connection;
            connection.setClient({ notifySoftwareMapAnalysisProgress: (handle, raw) => {
                if (this.disposed || project !== this.project || handle !== this.handle ||
                    !this.analysisStartedAt) return;
                const event = parseAnalysisProgressEvent(raw);
                const previous = this.progressEvents.at(-1);
                if (previous && event.elapsedMs < previous.elapsedMs) return;
                this.progressEvents.push(event);
                this.notify();
            }, notifySoftwareMapChanged: status => {
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
                    this.notify();
                } else if (status.state === 'ready') void this.load(status);
            } });
            const attached = await connection.attach(workspace);
            if (this.disposed || project !== this.project) return;
            this.handle = attached.projectHandle;
            this.status = attached.status;
            this.loading = false;
            this.notify();
            const latest = attached.status.state === 'analyzing' ? await connection.status(attached.projectHandle) : attached.status;
            if (this.disposed || project !== this.project) return;
            if (attached.status.state === 'analyzing' && this.status?.state === 'ready' && this.status.generation >= latest.generation) return;
            this.status = latest;
            if (latest.state === 'ready') await this.load(latest);
            else if (latest.state === 'analyzing') { this.loading = true; this.notify(); }
            if (this.disposed || project !== this.project) return;
            this.initialization = await connection.initializationStatus(attached.projectHandle);
            if (this.disposed || project !== this.project) return;
            if (this.initialization.state === 'review_required') {
                const review = await connection.review(attached.projectHandle);
                if (this.disposed || project !== this.project) return;
                if (review) { this.review = review; this.draft = structuredClone(review.draft); this.draftRevision = review.revision;
                    this.nextKey = Math.max(0, ...this.draft.map(node => /^draft:(\d+)$/.exec(node.proposalKey)?.[1] ?? '0').map(Number));
                    this.flow = 'review'; }
            }
            if (this.initialization.state === 'uninitialized' && !declinedThisSession.has(workspace)) this.flow = 'offer';
            if (this.initialization.state === 'failed') await this.setup();
            this.notify();
        } catch (error) {
            if (!this.disposed && project === this.project) { this.error = String(error); this.loading = false; this.notify(); }
        }
    }
    begin(): void { if (this.initialization?.state === 'uninitialized') { this.flow = 'offer'; this.error = ''; this.notify(); } }
    decline(): void {
        if (this.workspace) declinedThisSession.add(this.workspace);
        this.flow = 'none';
        this.error = '';
        this.notify();
    }
    async setup(forAccepted = false): Promise<void> {
        if (!this.handle || !this.connection) return;
        const project = this.project;
        const request = ++this.setupRequest;
        if (!forAccepted) this.flow = 'setup';
        this.setupReady = false;
        this.error = '';
        this.notify();
        try {
            await this.refreshInventory();
            const choice = await this.preferences?.getData<SynthesisChoice>(preferenceKey);
            if (choice && this.inventory && this.registry) await this.convergeLegacyChoice(choice);
            if (project !== this.project || request !== this.setupRequest) return;
            this.notify();
        } catch (error) {
            if (project === this.project && request === this.setupRequest) { this.error = String(error); this.notify(); }
        }
    }
    private async convergeLegacyChoice(choice: SynthesisChoice): Promise<void> {
        if (!this.registry || !this.inventory || !this.preferences) return;
        const modelId = choice.kind === 'gemini' ? choice.geminiModel : choice.model;
        if (!modelId) return;
        const matches = this.inventory.registry.connections.filter(item => item.config.type === choice.kind &&
            (choice.kind === 'gemini' ? item.id === 'dope-smap-legacy-gemini' :
                item.config.type === 'local' && item.config.endpoint === choice.endpoint));
        if (matches.length > 1) return;
        let match = matches[0];
        if (!match) {
            const id = `dope-smap-legacy-${choice.kind}`;
            if (this.inventory.registry.connections.some(item => item.id === id)) return;
            const config = choice.kind === 'gemini' ? { type: 'gemini' as const } :
                { type: 'local' as const, runtime: 'lm-studio' as const, endpoint: choice.endpoint };
            const connection = { version: AI_REGISTRY_VERSION, id, alias: `Migrated Software Map ${choice.kind}`,
                lifecycle: 'enabled' as const, config, preferredModelId: modelId };
            await this.registry.mutate({ version: AI_REGISTRY_VERSION, expectedRevision: this.inventory.registry.revision,
                mutation: { type: 'create-connection', connection } });
            match = connection;
            await this.refreshInventory();
        }
        if (choice.kind === 'gemini' && this.credentials) {
            const copied = await this.credentials.reuseSoftwareMapGemini(match.id);
            if (copied) {
                const snapshot = await this.registry.list();
                await this.registry.mutate({ version: AI_REGISTRY_VERSION, expectedRevision: snapshot.revision,
                    mutation: { type: 'update-connection', id: match.id, changes: { alias: match.alias,
                        lifecycle: match.lifecycle, config: match.config, credential: { source: 'secure', status: 'available' } } } });
            }
        }
        if (!this.inventory?.registry.models.some(item => item.connectionId === match.id && item.providerModelKey === modelId)) {
            await this.registry.refreshModels(match.id);
            await this.refreshInventory();
        }
        if (!this.inventory?.registry.models.some(item => item.connectionId === match.id && item.providerModelKey === modelId)) return;
        this.connectionId = match.id; this.modelId = modelId;
        const capacity = this.selectedModel()?.limits.contextWindowTokens;
        this.contextWindowTokens = capacity?.source === 'configured' ? capacity.value ?? 0 : 0;
        if (choice.kind === 'gemini' && this.credentials && (await this.credentials.status(match.id)).sources.some(
            source => source.source === 'secure' && source.status === 'available'))
            await this.credentials.retireSoftwareMapGemini(match.id);
        await this.preferences.setData(preferenceKey, undefined);
    }
    async dryRun(): Promise<void> {
        if (!this.connection || !this.handle || this.initialization?.state === 'analyzing') return;
        const project = this.project, request = ++this.dryRunRequest;
        const connection = this.connection, handle = this.handle;
        this.flow = 'dry-run';
        this.dryRunBusy = true;
        this.dryRunReport = undefined;
        this.dryRunError = '';
        this.notify();
        try {
            const report = await connection.dryRunSynthesis(handle);
            if (project === this.project && request === this.dryRunRequest) this.dryRunReport = report;
        } catch {
            if (project === this.project && request === this.dryRunRequest)
                this.dryRunError = 'Dry run could not complete. Check repository inputs or saved analysis work.';
        } finally {
            if (project === this.project && request === this.dryRunRequest) { this.dryRunBusy = false; this.notify(); }
        }
    }
    returnToSetup(): void { if (this.flow === 'dry-run') { this.flow = 'setup'; this.notify(); } }
    async refreshInventory(): Promise<void> {
        const project = this.project;
        let inventory: AIInventoryState | undefined;
        try { inventory = await this.registry?.inventory(); }
        catch {
            if (!this.disposed && project === this.project) {
                this.inventory = undefined;
                this.invalidateSetup();
                this.error = 'AI Center inventory is unavailable. Reopen AI Center and retry.';
                this.notify();
            }
            return;
        }
        if (this.disposed || project !== this.project) return;
        this.inventory = inventory;
        const connection = this.selectedConnection(), model = this.selectedModel();
        if (this.connectionId && (!connection || !model || connection.lifecycle !== 'enabled' ||
            this.configuredTarget && this.configuredTarget !== JSON.stringify([connection.id, model.providerModelKey,
                connection.config, this.contextWindowTokens, this.inventory?.registry.revision]))) this.invalidateSetup();
        this.notify();
    }
    credentialChanged(connectionId: string): void {
        if (connectionId === this.connectionId) this.invalidateSetup();
    }
    selectedConnection() { return this.inventory?.registry.connections.find(item => item.id === this.connectionId); }
    selectedModel() { return this.inventory?.registry.models.find(item => item.connectionId === this.connectionId &&
        item.providerModelKey === this.modelId && item.enabled && item.state !== 'unavailable' && item.state !== 'disabled'); }
    selectTarget(connectionId: string, modelId: string): void {
        if (connectionId !== this.connectionId || modelId !== this.modelId) {
            this.invalidateSetup();
            this.connectionId = connectionId;
            this.modelId = modelId;
            const capacity = this.selectedModel()?.limits.contextWindowTokens;
            this.contextWindowTokens = capacity?.source === 'configured' ? capacity.value ?? 0 : 0;
            this.notify();
        }
    }
    changeContextTokens(value: string): void {
        const tokens = Number(value);
        this.contextWindowTokens = Number.isSafeInteger(tokens) ? tokens : 0;
        this.invalidateSetup();
    }
    private invalidateSetup(): void {
        const hadSetup = this.setupReady || !!this.configuredTarget;
        this.setupReady = false; this.configuredTarget = undefined; ++this.setupRequest;
        this.consentedTargets.clear(); this.reviewConsentTarget = undefined;
        if (hadSetup && this.connection && this.handle) {
            const connection = this.connection, handle = this.handle;
            this.clearingSetup = (this.clearingSetup ?? Promise.resolve()).then(() => connection.clearSynthesis(handle)).catch(() => {});
        }
        this.notify();
    }
    analysisElapsedMs(): number {
        const reported = this.progressEvents.at(-1)?.elapsedMs ?? 0;
        return this.analysisStartedAt && this.initialization?.state === 'analyzing'
            ? Math.max(reported, Date.now() - this.analysisStartedAt) : this.reviewElapsedMs ?? reported;
    }
    async probe(): Promise<void> {
        if (!this.connection || !this.handle || !this.registry) return;
        const connection = this.selectedConnection(), model = this.selectedModel();
        if (!connection || !model || connection.lifecycle !== 'enabled' ||
            this.inventory?.observations.some(item => item.connectionId === connection.id &&
                ['unavailable', 'needs-authentication', 'invalid-configuration', 'disabled'].includes(item.health)) ||
            !['local', 'gemini'].includes(connection.config.type)) {
            this.invalidateSetup(); this.error = 'Selected target is missing or unsupported. Set it up in AI Center.'; this.notify(); return;
        }
        if (connection.config.type === 'local' && this.contextWindowTokens < 8192) {
            this.error = 'Configure or confirm the loaded context capacity (at least 8192 tokens).'; this.setupReady = false; this.notify(); return;
        }
        const project = this.project, request = ++this.setupRequest;
        this.setupBusy = true; this.setupReady = false; this.error = ''; this.notify();
        try {
            await this.clearingSetup;
            const target = JSON.stringify([connection.id, model.providerModelKey, connection.config,
                this.contextWindowTokens, this.inventory?.registry.revision]);
            await this.connection.configureSynthesis(this.handle, { connectionId: connection.id,
                modelId: model.providerModelKey, ...(connection.config.type === 'local' ?
                    { contextWindowTokens: this.contextWindowTokens } : {}) });
            if (project !== this.project || request !== this.setupRequest) return;
            await this.connection.probeSynthesis(this.handle);
            if (project !== this.project || request !== this.setupRequest) return;
            this.configuredTarget = target;
            this.setupReady = true;
        } catch (error) {
            if (project === this.project && request === this.setupRequest) this.error = String(error);
        } finally {
            if (project === this.project && request === this.setupRequest) { this.setupBusy = false; this.notify(); }
        }
    }
    async synthesize(retry = false): Promise<void> {
        if (!this.setupReady || this.setupBusy || !this.connection || !this.handle ||
            retry && !this.initialization?.resumable) return;
        const connection = this.selectedConnection(), model = this.selectedModel();
        if (!connection || !model || connection.lifecycle !== 'enabled' || !this.configuredTarget ||
            this.configuredTarget !== JSON.stringify([connection.id, model.providerModelKey, connection.config,
                this.contextWindowTokens, this.inventory?.registry.revision])) {
            this.error = 'Selected AI Center target changed. Run the Software Map probe again.';
            this.invalidateSetup(); return;
        }
        if (connection.config.type === 'gemini' && !this.consentedTargets.has(this.configuredTarget)) {
            this.error = 'Confirm hosted repository-evidence disclosure before analysis.'; this.notify(); return;
        }
        if (connection.config.type === 'gemini') {
            this.reviewConsentTarget = this.configuredTarget;
            this.consentedTargets.delete(this.configuredTarget);
        }
        const project = this.project;
        ++this.dryRunRequest;
        this.dryRunBusy = false;
        this.dryRunReport = undefined;
        this.dryRunError = '';
        const request = ++this.setupRequest;
        this.setupBusy = true;
        if (this.initialization) this.initialization = { ...this.initialization, state: 'analyzing' };
        this.analysisStartedAt = Date.now();
        this.reviewElapsedMs = undefined;
        this.progressEvents = [];
        this.review = undefined;
        this.draft = [];
        this.refinementPreview = undefined; this.refinementBusyKey = undefined; this.refinementError = undefined; ++this.refinementRequest;
        this.error = '';
        this.notify();
        try {
            const review = retry ? await this.connection.retryFailedStage(this.handle) :
                await this.connection.startInitialization(this.handle);
            if (project !== this.project || request !== this.setupRequest) return;
            this.reviewElapsedMs = Date.now() - this.analysisStartedAt!;
            this.review = review;
            this.draft = structuredClone(review.draft);
            this.draftRevision = review.revision;
            this.draftDirty = false;
            if (this.initialization) this.initialization = { ...this.initialization, state: 'review_required', resumable: undefined };
            this.flow = 'review';
            this.notify();
        } catch (error) {
            if (project === this.project && request === this.setupRequest) {
                this.review = undefined; this.draft = [];
                this.initialization = await this.connection.initializationStatus(this.handle);
                try { this.setupReady = await this.connection.synthesisReady(this.handle); }
                catch { this.setupReady = false; }
                if (project !== this.project || request !== this.setupRequest) return;
                this.error = String(error);
            }
        } finally {
            if (project === this.project && request === this.setupRequest) { this.setupBusy = false; this.notify(); }
        }
    }
    consentToHostedEvidence(): void {
        if (this.configuredTarget && this.selectedConnection()?.config.type === 'gemini') {
            this.consentedTargets.add(this.configuredTarget); this.notify();
        }
    }
    revokeHostedEvidenceConsent(): void {
        if (this.configuredTarget) this.consentedTargets.delete(this.configuredTarget);
        this.reviewConsentTarget = undefined;
        this.notify();
    }
    hostedConsentGranted(): boolean { return !!this.configuredTarget && this.consentedTargets.has(this.configuredTarget); }
    manual(): void {
        if (this.initialization?.state !== 'uninitialized') return;
        this.flow = 'manual';
        this.draft = [];
        this.error = '';
        this.add('system');
    }
    add(kind: ArchitectureReviewNode['kind'], parentProposalKey: string | null = null): void {
        this.draft.push({ proposalKey: `draft:${++this.nextKey}`, kind, id: '', name: '', purpose: '', parentProposalKey, roots: [] });
        this.draftChanged();
    }
    remove(key: string): void {
        const removed = new Set([key]);
        for (let changed = true; changed;) {
            changed = false;
            for (const node of this.draft) if (node.parentProposalKey && removed.has(node.parentProposalKey) && !removed.has(node.proposalKey)) { removed.add(node.proposalKey); changed = true; }
        }
        this.draft = this.draft.filter(node => !removed.has(node.proposalKey));
        for (const key of removed) this.refinedEvidence.delete(key);
        this.draftChanged();
    }
    invalidateRefinement(notify = true): void {
        ++this.refinementRequest;
        this.refinementPreview = undefined; this.refinementBusyKey = undefined; this.refinementError = undefined;
        if (notify) this.notify();
    }
    async searchDeeper(key: string, accepted?: { draft: ArchitectureReviewNode[]; fingerprint: string; current: () => boolean }): Promise<void> {
        if (!this.connection || !this.handle || this.refinementBusyKey ||
            !accepted && (!this.review || this.flow !== 'review') ||
            accepted && (!this.setupReady || this.setupBusy || this.initialization?.state !== 'initialized')) {
            if (accepted) { this.refinementError = { key, message: 'Set up and test a selected provider/model before Search Deeper.' }; this.notify(); }
            return;
        }
        if (this.selectedConnection()?.config.type === 'gemini' && this.configuredTarget &&
            !this.consentedTargets.has(this.configuredTarget) &&
            !(this.flow === 'review' && !accepted && this.reviewConsentTarget === this.configuredTarget)) {
            this.refinementError = { key, message: 'Confirm hosted repository-evidence disclosure before Search Deeper.' };
            this.notify(); return;
        }
        if (accepted && this.configuredTarget) this.consentedTargets.delete(this.configuredTarget);
        const draft = accepted?.draft ?? this.draft;
        const target = draft.find(node => node.proposalKey === key);
        if (!target || target.kind === 'component') return;
        const project = this.project, reviewId = this.review?.reviewId, request = ++this.refinementRequest;
        const providerKind = this.selectedConnection()?.config.type === 'gemini' ? 'gemini' : 'local', modelLabel = this.modelId;
        const branch = structuredClone(targetBranch(draft, key));
        const parentContext = draft.find(node => node.proposalKey === target.parentProposalKey);
        const fingerprint = branchFingerprint(branch, parentContext);
        this.refinementPreview = undefined; this.refinementError = undefined; this.refinementBusyKey = key; this.notify();
        try {
            const result = await this.connection.searchDeeper(this.handle, { ...(accepted ? {
                expectedCanonicalFingerprint: accepted.fingerprint, providerKind, modelLabel } : { reviewId: reviewId! }), targetKey: key,
                targetKind: target.kind, parentKey: target.parentProposalKey,
                ...(parentContext ? { parentContext: structuredClone(parentContext) } : {}), branchFingerprint: fingerprint, branch });
            if (project !== this.project || request !== this.refinementRequest ||
                (accepted ? !accepted.current() : this.review?.reviewId !== reviewId)) return;
            if (result.reviewId !== reviewId || result.expectedCanonicalFingerprint !== accepted?.fingerprint ||
                result.targetKey !== key || result.branchFingerprint !== fingerprint ||
                accepted && (!this.setupReady || (this.selectedConnection()?.config.type === 'gemini' ? 'gemini' : 'local') !== providerKind ||
                    this.modelId !== modelLabel ||
                    result.providerKind !== providerKind || result.modelLabel !== modelLabel) ||
                accepted && this.initialization?.declarationFingerprint !== accepted.fingerprint ||
                branchFingerprint(targetBranch(draft, key), draft.find(node => node.proposalKey === target.parentProposalKey)) !== fingerprint)
                throw new Error('Target branch changed during Search Deeper');
            this.refinementPreview = result;
        } catch (error) {
            if (project === this.project && request === this.refinementRequest && (!accepted || accepted.current()))
                this.refinementError = { key, message: String(error) };
        } finally {
            if (project === this.project && request === this.refinementRequest) { this.refinementBusyKey = undefined; this.notify(); }
        }
    }
    rejectRefinement(): void { this.refinementPreview = undefined; this.refinementError = undefined; this.notify(); }
    acceptRefinement(acceptedDraft?: ArchitectureReviewNode[]): ArchitectureReviewNode[] | undefined {
        const preview = this.refinementPreview;
        const draft = acceptedDraft ?? this.draft;
        if (!preview || (acceptedDraft ? !preview.expectedCanonicalFingerprint ||
            this.initialization?.declarationFingerprint !== preview.expectedCanonicalFingerprint :
            this.review?.reviewId !== preview.reviewId) ||
            branchFingerprint(targetBranch(draft, preview.targetKey),
                draft.find(node => node.proposalKey === preview.parentKey)) !== preview.branchFingerprint) {
            this.refinementPreview = undefined; this.refinementError = preview ? { key: preview.targetKey, message: 'Target branch changed' } : undefined;
            this.notify(); return undefined;
        }
        const omittedAnchor = preview.targetKind === 'subsystem' ? preview.proposal.nodes.find(node => node.kind === 'system')?.proposalKey : undefined;
        const replacements = preview.proposal.nodes.filter(node => node.proposalKey !== omittedAnchor);
        const keys = new Map(replacements.map(node => [node.proposalKey, `draft:${++this.nextKey}`]));
        const removed = new Set(targetBranch(draft, preview.targetKey).map(node => node.proposalKey));
        const usedIds = new Set(draft.filter(node => !removed.has(node.proposalKey)).map(node => node.id));
        const replacementNodes: ArchitectureReviewNode[] = replacements.map(node => {
            const roots = [...new Set(node.evidenceRefs.flatMap(ref => {
                const item = this.review?.packet.items.find(fact => fact.id === ref) ?? preview.evidence?.find(fact => fact.id === ref);
                return item?.kind === 'configuration' && 'sourcePaths' in item ? item.sourcePaths ?? [] : item ? [item.path] : [];
            }))].sort();
            const id = suggestArchitectureId(node.name, usedIds);
            usedIds.add(id);
            return { proposalKey: keys.get(node.proposalKey)!, kind: node.kind, id, name: node.name, purpose: node.purpose,
                parentProposalKey: node.parentProposalKey === null || node.parentProposalKey === omittedAnchor ? preview.parentKey : keys.get(node.parentProposalKey)!, roots };
        });
        const next = [...draft.filter(node => !removed.has(node.proposalKey)), ...replacementNodes];
        if (acceptedDraft) {
            const replacementKeys = new Set(replacementNodes.map(node => node.proposalKey));
            const blocker = reviewDiagnostics(next).find(issue => issue.proposalKeys.some(key => replacementKeys.has(key)));
            if (blocker) {
                this.refinementError = { key: preview.targetKey,
                    message: `Refinement cannot be accepted: ${blocker.code} — ${blocker.message}. Each boundary needs a distinct source path; keep this branch at its current depth or separate the implementation first.` };
                this.notify();
                return undefined;
            }
        }
        for (const key of removed) { this.refinedEvidence.delete(key); this.refinedSources.delete(key); }
        for (const node of replacements) {
            this.refinedEvidence.set(keys.get(node.proposalKey)!, node);
            if (preview.evidence) this.refinedSources.set(keys.get(node.proposalKey)!, preview.evidence);
        }
        if (!acceptedDraft) this.draft = next;
        this.refinementPreview = undefined;
        if (acceptedDraft) this.notify(); else this.draftChanged();
        return next;
    }
    draftError(): string | undefined {
        try { declarationFromDraft(this.draft); return undefined; } catch (error) { return String(error); }
    }
    draftDiagnostics() { return reviewDiagnostics(this.draft); }
    async readCurrentArchitecture(): Promise<CurrentArchitecture> {
        if (!this.connection || !this.handle || this.initialization?.state !== 'initialized') throw new Error('Architecture is not initialized');
        const project = this.project, connection = this.connection, handle = this.handle;
        const current = await connection.readArchitecture(handle);
        if (project !== this.project || connection !== this.connection) throw new Error('Workspace changed while loading Architecture');
        return current;
    }
    async saveCurrentArchitecture(expectedFingerprint: string, declaration: ArchitectureDeclaration): Promise<SaveArchitectureResult> {
        if (!this.connection || !this.handle || this.initialization?.state !== 'initialized') throw new Error('Architecture is not initialized');
        const project = this.project, connection = this.connection, handle = this.handle;
        const result = await connection.saveArchitecture(handle, expectedFingerprint, declaration);
        if (project !== this.project || connection !== this.connection) throw new Error('Workspace changed while saving Architecture');
        this.initialization = { ...this.initialization, declarationFingerprint: result.declarationFingerprint };
        this.status = result.status;
        this.notify();
        if (result.status.state === 'ready') void this.load(result.status);
        return result;
    }
    async accept(): Promise<void> {
        if (!this.connection || !this.handle || !this.initialization || this.draftError()) return;
        const project = this.project;
        const request = ++this.setupRequest;
        this.setupBusy = true;
        this.error = '';
        this.notify();
        try {
            if (this.review && this.flow === 'review') await this.flushReviewDraft();
            const status = this.review && this.flow === 'review'
                ? await this.connection.acceptReview(this.handle, this.review.reviewId, this.draft)
                : await this.connection.acceptManual(this.handle, declarationFromDraft(this.draft), this.initialization.declarationFingerprint);
            if (project !== this.project || request !== this.setupRequest) return;
            this.initialization = { ...this.initialization, state: 'initialized' };
            this.flow = 'none'; this.review = undefined; this.draft = [];
            this.refinementPreview = undefined;
            this.refinementBusyKey = undefined; this.refinementError = undefined; ++this.refinementRequest;
            this.refinedEvidence.clear();
            this.refinedSources.clear();
            this.status = status;
            if (status.state === 'ready') await this.load(status);
        } catch (error) {
            if (project === this.project && request === this.setupRequest) this.error = String(error);
        } finally {
            if (project === this.project && request === this.setupRequest) { this.setupBusy = false; this.notify(); }
        }
    }
    async useExisting(): Promise<void> {
        if (!this.connection || !this.handle || !this.initialization?.declarationPresent) return;
        const project = this.project;
        const request = ++this.setupRequest;
        this.setupBusy = true;
        this.error = '';
        this.notify();
        try {
            const status = await this.connection.acceptExisting(this.handle, this.initialization.declarationFingerprint);
            if (project !== this.project || request !== this.setupRequest) return;
            this.initialization = { ...this.initialization, state: 'initialized' };
            this.flow = 'none'; this.status = status;
            if (status.state === 'ready') await this.load(status);
        } catch (error) {
            if (project === this.project && request === this.setupRequest) this.error = String(error);
        } finally {
            if (project === this.project && request === this.setupRequest) { this.setupBusy = false; this.notify(); }
        }
    }
    async cancel(): Promise<void> {
        const connection = this.connection, handle = this.handle, project = this.project;
        const wasAnalyzing = this.initialization?.state === 'analyzing';
        const request = ++this.setupRequest;
        this.setupBusy = true;
        this.error = '';
        this.notify();
        try {
            if (this.draftTimer) clearTimeout(this.draftTimer);
            this.draftTimer = undefined;
            this.draftDirty = false;
            await this.saving?.catch(() => {});
            if (connection && handle) await connection.cancelInitialization(handle);
            if (project !== this.project || request !== this.setupRequest) return;
            if (connection && handle) await connection.clearSynthesis(handle);
            this.review = undefined; this.draft = []; this.setupReady = false; this.flow = wasAnalyzing ? 'setup' : 'none';
            this.configuredTarget = undefined; this.reviewConsentTarget = undefined;
            this.refinementPreview = undefined; this.refinementBusyKey = undefined; this.refinementError = undefined; ++this.refinementRequest;
            this.refinedEvidence.clear();
            this.refinedSources.clear();
            this.analysisStartedAt = undefined;
            if (this.initialization?.state !== 'initialized' && this.initialization) this.initialization = { ...this.initialization, state: 'uninitialized' };
        } catch (error) {
            if (project === this.project && request === this.setupRequest) this.error = String(error);
        } finally {
            if (project === this.project && request === this.setupRequest) { this.setupBusy = false; this.notify(); }
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
    async reviewDocument(path: string) {
        if (!this.connection || !this.handle || !this.review) return undefined;
        const project = this.project, reviewId = this.review.reviewId;
        const location = await this.connection.resolveReviewDocument(this.handle, reviewId, path);
        return project === this.project && this.review?.reviewId === reviewId && this.flow === 'review' ? location : undefined;
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
        this.notify();
        try {
            const status = await this.connection.analyze(this.handle);
            if (!this.current(project, request)) return;
            this.status = status;
            this.loading = false;
            this.notify();
            if (status.state === 'ready') await this.load(status);
        } catch (error) {
            if (this.current(project, request)) { this.error = String(error); this.loading = false; this.notify(); }
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
    async relationshipPage(request: Omit<SoftwareMapRelationshipRequest, 'projectHandle'>, generation: number): Promise<SoftwareMapPage<GraphRelationship>> {
        if (!this.connection || !this.handle || !this.published(generation) || this.loading || this.disposed)
            throw new Error('Software Map is not published for this project');
        const project = this.project, currentRequest = this.request;
        const page = await this.connection.relationships({ ...request, projectHandle: this.handle });
        if (!this.current(project, currentRequest) || !this.published(generation) || page.generation !== generation)
            throw new Error('Software Map changed during relationship query');
        return page;
    }
    async flowQuery(request: Omit<FlowQuery, 'projectId'>): Promise<FlowQueryResult> {
        if (!this.connection || !this.handle || !this.published(request.generation) || this.loading || this.disposed)
            throw new Error('Software Map is not published for this project');
        const project = this.project, currentRequest = this.request;
        const result = await this.connection.flow({ ...request, projectId: 'project:root', projectHandle: this.handle });
        if (!this.current(project, currentRequest) || !this.published(request.generation) ||
            result.generation !== request.generation || result.projectId !== 'project:root')
            throw new Error('Software Map changed during Flow query');
        return result;
    }
    async evidenceDetails(ids: string[], generation: number): Promise<Evidence[]> {
        if (!this.connection || !this.handle || !this.published(generation) || this.loading || this.disposed)
            throw new Error('Software Map is not published for this project');
        const project = this.project, currentRequest = this.request;
        const result = await this.evidenceFor(ids, this.connection, this.handle, generation);
        if (!this.current(project, currentRequest) || !this.published(generation))
            throw new Error('Software Map changed during evidence query');
        return result;
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
        this.notify();
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
            this.notify();
            if (this.selectedId && nodes.some(node => node.id === this.selectedId)) await this.select(this.selectedId);
            else this.selectedId = undefined;
        } catch (error) {
            if (this.current(project, request)) { this.error = String(error); this.loading = false; this.notify(); }
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
        this.notify();
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
            this.notify();
        } catch (error) {
            if (this.current(project, request) && detail === this.detailRequest) { this.error = String(error); this.notify(); }
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
        this.notify();
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
            this.notify();
        } catch (error) {
            if (this.current(project, request) && detail === this.detailRequest) { this.error = String(error); this.notify(); }
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
        this.notify();
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
            this.notify();
        } catch (error) {
            if (this.current(project, request) && origin === this.originRequest) { this.error = String(error); this.notify(); }
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
        void this.flushReviewDraft().catch(() => {});
        this.disposed = true;
        ++this.project;
        ++this.request;
        ++this.detailRequest;
        this.disconnect();
    }
}
