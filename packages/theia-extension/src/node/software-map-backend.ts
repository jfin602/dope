import { randomUUID } from 'node:crypto';
import { realpath } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { KeyStoreService } from '@theia/core/lib/common/key-store';
import { canonicalLocalRoot } from '@dope/code-analysis/lib/node/architecture-file';
import { readInitialization, acceptInitialization } from '@dope/code-analysis/lib/node/smap-initialization-file';
import { bootstrapDocumentPresence } from '@dope/code-analysis/lib/node/architecture-evidence';
import { readSynthesisRun, writeSynthesisRun, clearSynthesisRun } from '@dope/code-analysis/lib/node/smap-analysis-file';
import type { SavedSynthesisRun } from '@dope/code-analysis/lib/node/smap-analysis-file';
import { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';
import { hierarchy, projectPath, relationshipsFor, parseArchitecture, parseAnalysisProgressEvent, suggestArchitectureId,
    HierarchicalSynthesisOrchestrator, SynthesisStageCache, planTargetedRefinement, parseTargetedRefinement } from '@dope/software-map';
import type { ArchitectureViolation, Evidence, GraphNode, SoftwareMapPage, SoftwareMapPageRequest, GraphRelationship, SoftwareMapRelationshipRequest,
    PhysicalMapSnapshot, SoftwareMapClient, SoftwareMapService, ArchitectureEvidencePacket, ArchitectureReview, ArchitectureReviewNode,
    ArchitectureDeclaration, SoftwareMapInitializationStatus, SynthesisProvider, SynthesisSetup, SynthesisSetupResult, AnalysisProgressEvent,
    TargetedRefinementInput, TargetedRefinementResult } from '@dope/software-map';
import { LmStudioSynthesisProvider } from './lmstudio-synthesis-provider';
import { GeminiSynthesisProvider } from './gemini-synthesis-provider';

const geminiCredentialService = 'Dope Gemini';
const geminiCredentialAccount = 'AI Studio API key';

function geminiAnalysisError(error: unknown): Error {
    const message = error instanceof Error ? error.message : '';
    if (/^Invalid hierarchical synthesis: [A-Za-z0-9 .\[\]/-]+$/.test(message) ||
        ['Invalid Gemini stage JSON', 'Gemini stage output truncated at token limit',
            'System Discovery produced no Systems to challenge', 'System Challenge rejected every System'].includes(message) ||
        /^Gemini (synthesis cancelled or timed out|synthesis request failed|SDK or transport type error|response JSON error|authentication failed \(HTTP 40[13]\)|quota or rate limit exceeded \(HTTP 429\)|upstream service failed \(HTTP 5\d\d\)|request rejected \(HTTP 4\d\d\))$/.test(message))
        return new Error(`Gemini analysis failed: ${message}`);
    return new Error('Gemini analysis failed. Review setup and retry.');
}

export class SoftwareMapBackend implements SoftwareMapService {
    private root?: string;
    private handle?: string;
    private attaching = 0;
    private disposed = false;
    private initialized = false;
    private run = 0;
    private phase: 'analyzing' | 'review_required' | 'failed' | undefined;
    private analysisRun?: SavedSynthesisRun;
    private pending?: ArchitectureReview & { fingerprint: string };
    private provider?: SynthesisProvider;
    private readonly synthesisCache = new SynthesisStageCache(Number.MAX_SAFE_INTEGER);
    private analysisStarted?: number;
    private localProvider?: LmStudioSynthesisProvider;
    private geminiProvider?: GeminiSynthesisProvider;
    private geminiProbed = false;
    private readonly unlisten: () => void;
    private idleStatus() {
        return { generation: 0, publishedGeneration: 0, state: 'idle' as const,
            analysis: { completeness: 'failed' as const, errors: [{ producer: '@dope/software-map', code: 'uninitialized', message: 'Software Map is not initialized' }] },
            reusedSourceFiles: 0 };
    }

    constructor(private readonly index: SoftwareMapIndex, private readonly client: SoftwareMapClient,
        provider?: SynthesisProvider,
        private readonly makeGemini = (apiKey: string) => new GeminiSynthesisProvider({ apiKey }),
        private readonly credentials?: Pick<KeyStoreService, 'getPassword' | 'setPassword'>) {
        this.provider = provider;
        this.unlisten = index.onChange((root, status) => {
            if (!this.disposed && this.initialized && root === this.root) client.notifySoftwareMapChanged(status);
        });
    }

    async attach(folderUri: string) {
        if (this.disposed) throw new Error('Disposed Software Map connection');
        const request = ++this.attaching;
        const root = await canonicalLocalRoot(folderUri);
        if (this.disposed || request !== this.attaching) throw new Error('Superseded Software Map attachment');
        if (this.root !== root || !this.handle) {
            if (this.handle) this.clearProvider();
            this.handle = randomUUID();
            this.run++;
            this.phase = undefined;
            this.pending = undefined;
            this.localProvider = undefined;
            this.geminiProvider = undefined;
            this.geminiProbed = false;
        } else {
            this.clearProvider();
        }
        this.root = root;
        this.initialized = (await readInitialization(root)).initialized;
        this.analysisRun = this.initialized ? undefined : await readSynthesisRun(root);
        if (this.analysisRun) {
            this.synthesisCache.restore(this.analysisRun.checkpoints, this.analysisRun.attempts, this.analysisRun.packet);
            if (this.synthesisCache.checkpoints().length !== this.analysisRun.checkpoints.length) {
                const invalid = this.analysisRun.checkpoints.find(item => !this.synthesisCache.checkpoints().some(saved => saved.identity === item.identity))!;
                this.analysisRun = { ...this.analysisRun, status: 'failed', review: undefined,
                    current: { stage: invalid.request.stage,
                        subject: invalid.request.context.subjectSubsystemKey ?? invalid.request.context.subjectSystemKey ?? undefined,
                        providerKind: invalid.providerKind, modelLabel: invalid.modelLabel },
                    checkpoints: this.synthesisCache.checkpoints(), failure: undefined };
                await writeSynthesisRun(root, this.analysisRun);
            }
            this.phase = this.analysisRun.status === 'review_required' ? 'review_required' : 'failed';
            this.pending = this.analysisRun.review;
        }
        return { projectHandle: this.handle, status: this.initialized ? this.index.status(root) : this.idleStatus() };
    }

    private active(handle: string): string {
        if (this.disposed || !this.root || handle !== this.handle) throw new Error('Invalid or detached Software Map handle');
        return this.root;
    }
    private async snapshot(handle: string): Promise<PhysicalMapSnapshot> {
        const root = this.active(handle);
        if (!(await readInitialization(root)).initialized) throw new Error('Software Map is not initialized');
        const snapshot = this.index.snapshot(root);
        if (!snapshot) throw new Error('Software Map has no current analysis');
        return snapshot;
    }
    private page<T>(snapshot: PhysicalMapSnapshot, request: SoftwareMapPageRequest, items: T[]): SoftwareMapPage<T> {
        const offset = request.offset ?? 0;
        const limit = request.limit ?? 100;
        if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(limit) || limit < 1 || limit > 200) throw new Error('Invalid Software Map page');
        return { generation: snapshot.metadata.generation, total: items.length, items: items.slice(offset, offset + limit) };
    }

    private clearProvider(): void {
        this.run++;
        this.phase = undefined;
        this.pending = undefined;
        this.analysisStarted = undefined;
        this.provider = undefined;
        this.localProvider = undefined;
        this.geminiProvider = undefined;
        this.geminiProbed = false;
        this.synthesisCache.clear();
    }
    async clearSynthesis(projectHandle: string): Promise<void> {
        this.active(projectHandle);
        this.clearProvider();
    }
    async synthesisEnvironment(projectHandle: string): Promise<{ geminiKeyAvailable: boolean }> {
        this.active(projectHandle);
        let storedKey: string | undefined;
        try { storedKey = await this.credentials?.getPassword(geminiCredentialService, geminiCredentialAccount); }
        catch { throw new Error('Could not access Gemini credential store'); }
        this.active(projectHandle);
        return { geminiKeyAvailable: !!(storedKey || process.env.GEMINI_API_KEY?.trim()) };
    }
    async configureSynthesis(projectHandle: string, options: SynthesisSetup): Promise<SynthesisSetupResult> {
        this.active(projectHandle);
        if (this.phase === 'analyzing') throw new Error('Synthesis analysis is active');
        this.clearProvider();
        const run = this.run;
        if (options.kind === 'local') {
            const provider = new LmStudioSynthesisProvider(options);
            const models = await provider.discoverModels();
            this.active(projectHandle);
            if (run !== this.run) throw new Error('Superseded synthesis setup');
            this.localProvider = provider;
            this.provider = provider;
            return { models };
        }
        if (options.kind !== 'gemini') throw new Error('Invalid synthesis provider');
        const suppliedKey = options.apiKey?.trim();
        let storedKey: string | undefined;
        if (!suppliedKey) {
            try { storedKey = await this.credentials?.getPassword(geminiCredentialService, geminiCredentialAccount); }
            catch { throw new Error('Could not access Gemini credential store'); }
        }
        const key = suppliedKey || storedKey || process.env.GEMINI_API_KEY?.trim();
        if (!key) throw new Error('Gemini API key required');
        let provider: GeminiSynthesisProvider;
        try { provider = this.makeGemini(key); }
        catch { throw new Error('Gemini configuration failed'); }
        const models = await provider.discoverModels();
        this.active(projectHandle);
        if (run !== this.run) throw new Error('Superseded synthesis setup');
        if (suppliedKey && this.credentials) {
            try { await this.credentials.setPassword(geminiCredentialService, geminiCredentialAccount, suppliedKey); }
            catch { throw new Error('Could not save Gemini API key in credential store'); }
            this.active(projectHandle);
            if (run !== this.run) throw new Error('Superseded synthesis setup');
        }
        this.geminiProvider = provider;
        this.provider = provider;
        return { models };
    }
    async refreshSynthesisModels(projectHandle: string): Promise<SynthesisSetupResult> {
        this.active(projectHandle);
        if (this.phase === 'analyzing') throw new Error('Synthesis analysis is active');
        if (!this.geminiProvider) throw new Error('Gemini is not configured');
        this.geminiProbed = false;
        const run = ++this.run;
        const models = await this.geminiProvider.discoverModels();
        this.active(projectHandle);
        if (run !== this.run) throw new Error('Superseded synthesis setup');
        return { models };
    }
    async selectSynthesisModel(projectHandle: string, modelId: string): Promise<void> {
        this.active(projectHandle);
        if (this.phase === 'analyzing') throw new Error('Synthesis analysis is active');
        if (this.localProvider) this.localProvider.selectModel(modelId);
        else if (this.geminiProvider) { ++this.run; this.geminiProbed = false; this.geminiProvider.selectModel(modelId); }
        else throw new Error('Synthesis provider is not configured');
    }
    async probeSynthesis(projectHandle: string): Promise<void> {
        this.active(projectHandle);
        if (this.phase === 'analyzing') throw new Error('Synthesis analysis is active');
        const run = this.run;
        if (this.localProvider) await this.localProvider.probe();
        else if (this.geminiProvider) {
            this.geminiProbed = false;
            await this.geminiProvider.probe();
        } else throw new Error('Synthesis provider is not configured');
        this.active(projectHandle);
        if (run !== this.run) throw new Error('Superseded synthesis setup');
        if (this.geminiProvider) this.geminiProbed = true;
    }
    async synthesisReady(projectHandle: string): Promise<boolean> {
        this.active(projectHandle);
        return !!this.provider && (this.localProvider?.isProbed ?? (this.geminiProvider ? this.geminiProbed : true));
    }
    async synthesisAttempts(projectHandle: string) {
        this.active(projectHandle);
        return this.synthesisCache.attempts();
    }
    async initializationStatus(projectHandle: string): Promise<SoftwareMapInitializationStatus> {
        const root = this.active(projectHandle);
        const state = await readInitialization(root);
        this.initialized = state.initialized;
        return { state: state.initialized ? 'initialized' : this.analysisRun && this.phase !== 'analyzing' && this.phase !== 'review_required' ? 'failed' : this.phase ?? 'uninitialized',
            declarationPresent: state.declarationPresent, declarationFingerprint: state.declarationFingerprint,
            ...(this.analysisRun && !state.initialized && this.phase === 'failed' ? { resumable: { runId: this.analysisRun.runId,
                failedStage: this.analysisRun.failure?.stage ?? this.analysisRun.current?.stage,
                failedSubject: this.analysisRun.failure?.subject ?? this.analysisRun.current?.subject,
                failedProviderKind: this.analysisRun.failure?.providerKind ?? this.analysisRun.current?.providerKind,
                failedModelLabel: this.analysisRun.failure?.modelLabel ?? this.analysisRun.current?.modelLabel,
                message: this.analysisRun.failure?.message ?? 'Analysis was interrupted. Retry the failed stage.',
                completed: this.analysisRun.checkpoints.map(item => ({ stage: item.request.stage,
                    subject: item.request.context.subjectSubsystemKey ?? item.request.context.subjectSystemKey ?? undefined,
                    providerKind: item.providerKind, modelLabel: item.modelLabel })) } } : {}),
            ...(state.initialized ? {} : { bootstrap: await bootstrapDocumentPresence(root) }) };
    }
    private still(handle: string, root: string, run: number): void {
        if (this.active(handle) !== root || this.run !== run) throw new Error('Superseded Software Map initialization');
    }
    async startInitialization(projectHandle: string): Promise<ArchitectureReview> {
        const root = this.active(projectHandle);
        if ((await readInitialization(root)).initialized || this.phase === 'analyzing' || this.phase === 'review_required') throw new Error('Software Map initialization is already active');
        if (!this.provider || !(await this.synthesisReady(projectHandle))) throw new Error('Synthesis provider is not ready');
        this.analysisRun = undefined;
        this.synthesisCache.clear();
        await clearSynthesisRun(root);
        return this.executeInitialization(projectHandle);
    }
    async retryFailedStage(projectHandle: string): Promise<ArchitectureReview> {
        const root = this.active(projectHandle);
        if ((await readInitialization(root)).initialized || this.phase === 'analyzing' || this.phase === 'review_required')
            throw new Error('Software Map initialization is already active');
        const saved = this.analysisRun ?? await readSynthesisRun(root);
        if (!saved || saved.status === 'review_required' || !saved.current) throw new Error('No failed analysis stage to retry');
        if (!this.provider || !(await this.synthesisReady(projectHandle))) throw new Error('Synthesis provider is not ready');
        if ((await readInitialization(root)).declarationFingerprint !== saved.declarationFingerprint)
            throw new Error('Architecture declaration changed; restart analysis');
        this.synthesisCache.restore(saved.checkpoints, saved.attempts, saved.packet);
        this.analysisRun = saved;
        return this.executeInitialization(projectHandle, saved);
    }
    private async executeInitialization(projectHandle: string, saved?: SavedSynthesisRun): Promise<ArchitectureReview> {
        const root = this.active(projectHandle);
        const provider = this.provider;
        if (!provider) throw new Error('Synthesis provider is not ready');
        const run = ++this.run;
        const started = performance.now();
        this.analysisStarted = started;
        const stageStarted = new Map<AnalysisProgressEvent['stage'], number>();
        let currentStage: AnalysisProgressEvent['stage'] = saved?.current?.stage ?? 'collecting-evidence';
        let lastElapsed = 0;
        const emit = (event: AnalysisProgressEvent): void => {
            this.still(projectHandle, root, run);
            const now = performance.now();
            if (event.status === 'started' && !stageStarted.has(event.stage)) stageStarted.set(event.stage, now);
            if (event.stage !== 'failed' && event.stage !== 'cancelled') currentStage = event.stage;
            const elapsedMs = Math.max(lastElapsed, Math.floor(now - started));
            lastElapsed = elapsedMs;
            this.client.notifySoftwareMapAnalysisProgress?.(projectHandle, parseAnalysisProgressEvent({ ...event,
                elapsedMs, stageElapsedMs: Math.max(0, Math.floor(now - (stageStarted.get(event.stage) ?? now))) }));
        };
        this.phase = 'analyzing';
        this.pending = undefined;
        try {
            if (!saved) emit({ stage: 'collecting-evidence', status: 'started', elapsedMs: 0, message: 'Collecting repository evidence' });
            const fingerprint = saved?.declarationFingerprint ?? (await readInitialization(root)).declarationFingerprint;
            const packet = saved?.packet ?? await this.index.collectEvidence(root);
            this.still(projectHandle, root, run);
            if (!saved) {
                this.analysisRun = { schemaVersion: 1, runId: randomUUID(), packet, declarationFingerprint: fingerprint,
                    status: 'analyzing', checkpoints: [], attempts: [] };
                await writeSynthesisRun(root, this.analysisRun, () => this.still(projectHandle, root, run));
                emit({ stage: 'collecting-evidence', status: 'completed', elapsedMs: 0, message: 'Repository evidence collected' });
            }
            this.synthesisCache.onStageStart = async (stage, subject, providerKind, modelLabel, checkpoints) => {
                this.still(projectHandle, root, run);
                const next = { ...this.analysisRun!, status: 'analyzing' as const,
                    current: { stage, subject, providerKind, modelLabel }, checkpoints, failure: undefined };
                await writeSynthesisRun(root, next, () => this.still(projectHandle, root, run));
                this.still(projectHandle, root, run);
                this.analysisRun = next;
            };
            this.synthesisCache.onCheckpoint = async (checkpoints, attempts) => {
                this.still(projectHandle, root, run);
                const next = { ...this.analysisRun!, checkpoints, attempts };
                await writeSynthesisRun(root, next, () => this.still(projectHandle, root, run));
                this.still(projectHandle, root, run);
                this.analysisRun = next;
            };
            const localProvider = this.localProvider;
            const orchestrator = new HierarchicalSynthesisOrchestrator(provider,
                localProvider?.endpoint ?? provider.kind, undefined, undefined, emit,
                () => this.still(projectHandle, root, run), localProvider ? () => localProvider.warmUp() : undefined,
                this.synthesisCache);
            const { proposal, coverageLedger, componentDescents } = await orchestrator.analyze(packet);
            this.still(projectHandle, root, run);
            emit({ stage: 'preparing-review', status: 'started', elapsedMs: 0, message: 'Preparing sMap for review' });
            if ((await readInitialization(root)).declarationFingerprint !== fingerprint) throw new Error('Stale Software Map architecture declaration');
            const usedIds = new Set<string>();
            const draft: ArchitectureReviewNode[] = proposal.nodes.map(node => {
                const roots = new Set<string>();
                for (const ref of node.evidenceRefs) {
                    const item = packet.items.find(item => item.id === ref)!;
                    if (item.kind === 'configuration') for (const path of item.sourcePaths ?? []) roots.add(path);
                    if (item.kind === 'entrypoint' || item.kind === 'semantic' || item.kind === 'framework') roots.add(item.path);
                }
                const id = suggestArchitectureId(node.name, usedIds);
                usedIds.add(id);
                return { proposalKey: node.proposalKey, kind: node.kind, id, name: node.name,
                    purpose: node.purpose, parentProposalKey: node.parentProposalKey, roots: [...roots].sort() };
            });
            const childRoots = new Set(draft.filter(node => node.kind !== 'system').flatMap(node => node.roots));
            for (const system of draft.filter(node => node.kind === 'system'))
                system.roots = system.roots.filter(root => !childRoots.has(root));
            this.still(projectHandle, root, run);
            const reviewId = randomUUID();
            this.pending = { reviewId, packet, proposal, draft, coverageLedger, componentDescents, fingerprint };
            this.analysisRun = { ...this.analysisRun!, status: 'review_required', review: this.pending,
                checkpoints: this.synthesisCache.checkpoints(), attempts: this.synthesisCache.attempts(), current: undefined, failure: undefined };
            await writeSynthesisRun(root, this.analysisRun, () => this.still(projectHandle, root, run));
            this.phase = 'review_required';
            this.analysisStarted = undefined;
            emit({ stage: 'preparing-review', status: 'completed', elapsedMs: 0, message: 'Validated review ready' });
            emit({ stage: 'completed', status: 'completed', elapsedMs: 0, message: 'Analysis complete' });
            return structuredClone({ reviewId, packet, proposal, draft, coverageLedger, componentDescents });
        } catch (error) {
            if (this.run === run) {
                this.phase = this.analysisRun ? 'failed' : undefined; this.pending = undefined;
                this.analysisStarted = undefined;
                if (this.analysisRun) {
                    const capability = await provider.capabilities().catch(() => undefined);
                    const message = error instanceof Error && (/^Invalid hierarchical synthesis:/.test(error.message) ||
                        error.message === 'System Discovery produced no Systems to challenge' ||
                        error.message === 'System Challenge rejected every System') ? error.message :
                        provider.kind === 'gemini' ? geminiAnalysisError(error).message : 'Provider request failed. Retry the failed stage.';
                    this.analysisRun = { ...this.analysisRun, status: 'failed', attempts: this.synthesisCache.attempts(),
                        failure: { stage: this.analysisRun.current?.stage ?? 'system-discovery',
                            subject: this.analysisRun.current?.subject, message,
                            providerKind: provider.kind, modelLabel: capability?.modelLabel ?? 'unknown' } };
                    await writeSynthesisRun(root, this.analysisRun, () => this.still(projectHandle, root, run));
                }
                emit({ stage: 'failed', status: 'failed', elapsedMs: 0,
                    message: this.analysisRun?.failure?.message ?? `Analysis failed during ${currentStage.replaceAll('-', ' ')}.`,
                    subject: this.analysisRun?.failure?.subject ?? currentStage });
            }
            throw provider.kind === 'gemini' && this.run === run ? geminiAnalysisError(error) : error;
        }
    }
    async review(projectHandle: string): Promise<ArchitectureReview | undefined> {
        this.active(projectHandle);
        if (!this.pending) return undefined;
        const { reviewId, packet, proposal, draft, coverageLedger, componentDescents } = this.pending;
        return structuredClone({ reviewId, packet, proposal, draft, coverageLedger, componentDescents });
    }
    async searchDeeper(projectHandle: string, input: TargetedRefinementInput): Promise<TargetedRefinementResult> {
        const root = this.active(projectHandle), pending = this.pending, run = this.run;
        if (this.phase !== 'review_required' || !pending || pending.reviewId !== input.reviewId)
            throw new Error('No matching architecture review');
        const provider = this.provider;
        const refine = provider?.runRefinement;
        if (!provider || !(await this.synthesisReady(projectHandle)) || !refine)
            throw new Error('Synthesis provider is not ready');
        const modelLabel = (await provider.capabilities()).modelLabel;
        const request = await planTargetedRefinement(input, pending.packet, pending.coverageLedger ?? [], provider, pending.proposal);
        this.still(projectHandle, root, run);
        const startedAt = new Date().toISOString(), start = performance.now();
        let execution: Awaited<ReturnType<NonNullable<SynthesisProvider['runRefinement']>>> | undefined;
        let result: TargetedRefinementResult | undefined;
        let failureClass: 'invalid-stage-result' | 'provider-failure' | 'cancelled' | undefined;
        try {
            execution = await refine.call(provider, request);
            this.still(projectHandle, root, run);
            if (this.pending?.reviewId !== input.reviewId) throw new Error('Stale architecture review');
            result = parseTargetedRefinement(execution.output, request, pending.packet);
            return structuredClone(result);
        } catch (error) {
            failureClass = execution ? 'invalid-stage-result' : this.run !== run ? 'cancelled' : 'provider-failure';
            throw provider.kind === 'gemini' && this.run === run ? geminiAnalysisError(error) : error;
        } finally {
            if (this.run === run) this.synthesisCache.recordTargetAttempt({ stage: 'target-refinement', subject: input.targetKey,
                providerKind: provider.kind, modelLabel,
                startedAt, durationMs: performance.now() - start, requestBytes: Buffer.byteLength(JSON.stringify(request)),
                ...(execution ? { outputBytes: execution.usage.outputBytes, inputTokens: execution.usage.inputTokens,
                    outputTokens: execution.usage.outputTokens, totalTokens: execution.usage.totalTokens } : {}),
                tokenMeasurement: execution?.usage.tokenMeasurement ?? 'unavailable',
                ...(failureClass ? { failureClass } : {}), consumed: !!result });
        }
    }
    async resolveReviewSource(projectHandle: string, reviewId: string, evidenceRef: string) {
        const root = this.active(projectHandle);
        if (!this.pending || this.pending.reviewId !== reviewId) return undefined;
        const item = this.pending.packet.items.find(item => item.id === evidenceRef);
        if (!item) return undefined;
        const path = join(root, projectPath(item.path));
        const canonical = await realpath(path);
        this.active(projectHandle);
        if (this.pending?.reviewId !== reviewId) return undefined;
        const local = relative(root, canonical);
        if (!local || local === '..' || local.startsWith(`..${sep}`)) throw new Error('Unsafe Software Map source path');
        return { uri: pathToFileURL(canonical).href, path: item.path };
    }
    async resolveReviewDocument(projectHandle: string, reviewId: string, path: string) {
        const root = this.active(projectHandle);
        if (!this.pending || this.pending.reviewId !== reviewId ||
            !this.pending.packet.documents?.some(doc => doc.path === path)) return undefined;
        const canonical = await realpath(join(root, projectPath(path)));
        this.active(projectHandle);
        if (this.pending?.reviewId !== reviewId) return undefined;
        const local = relative(root, canonical);
        if (!local || local === '..' || local.startsWith(`..${sep}`)) throw new Error('Unsafe Software Map document path');
        return { uri: pathToFileURL(canonical).href, path };
    }
    async cancelInitialization(projectHandle: string): Promise<void> {
        const root = this.active(projectHandle);
        if (this.phase === 'analyzing') this.client.notifySoftwareMapAnalysisProgress?.(projectHandle,
            parseAnalysisProgressEvent({ stage: 'cancelled', status: 'cancelled', elapsedMs: Math.max(0, Math.floor(performance.now() - (this.analysisStarted ?? performance.now()))),
                message: 'Analysis cancelled' }));
        this.run++;
        this.analysisStarted = undefined;
        this.phase = undefined;
        this.pending = undefined;
        this.analysisRun = undefined;
        this.synthesisCache.onCheckpoint = undefined;
        this.synthesisCache.onStageStart = undefined;
        await clearSynthesisRun(root);
    }
    private declaration(draft: ArchitectureReviewNode[]): ArchitectureDeclaration {
        if (!Array.isArray(draft) || !draft.length) throw new Error('Invalid architecture review draft');
        const keys = new Set(draft.map(node => node.proposalKey));
        if (keys.size !== draft.length || draft.some(node => !['system', 'subsystem', 'component'].includes(node.kind) ||
            typeof node.id !== 'string' || !node.id || !Array.isArray(node.roots))) throw new Error('Invalid architecture review draft');
        const systems = draft.filter(node => node.kind === 'system').map(system => ({
            id: system.id, name: system.name, purpose: system.purpose,
            ...(system.roots.length ? { roots: system.roots } : {}),
            subsystems: draft.filter(node => node.kind === 'subsystem' && node.parentProposalKey === system.proposalKey).map(subsystem => ({
                id: subsystem.id, name: subsystem.name, purpose: subsystem.purpose, roots: subsystem.roots,
                components: draft.filter(node => node.kind === 'component' && node.parentProposalKey === subsystem.proposalKey).map(component => ({
                    id: component.id, name: component.name, purpose: component.purpose, roots: component.roots,
                })),
            })),
        }));
        if (draft.some(node => node.kind !== 'system' && !draft.some(parent => parent.proposalKey === node.parentProposalKey &&
            parent.kind === (node.kind === 'subsystem' ? 'system' : 'subsystem')))) throw new Error('Invalid architecture review parent');
        return parseArchitecture({ schemaVersion: 1, systems });
    }
    async acceptReview(projectHandle: string, reviewId: string, draft: ArchitectureReviewNode[]) {
        const root = this.active(projectHandle);
        if (this.phase !== 'review_required' || !this.pending || reviewId !== this.pending.reviewId) throw new Error('No matching architecture review to accept');
        const declaration = this.declaration(draft);
        if ((await this.index.collectEvidence(root)).sourceFingerprint !== this.pending.packet.sourceFingerprint) throw new Error('Stale Software Map evidence');
        await acceptInitialization(root, this.pending.fingerprint, declaration);
        this.initialized = true;
        this.phase = undefined;
        this.pending = undefined;
        this.analysisRun = undefined;
        await clearSynthesisRun(root);
        return this.index.analyze(root);
    }
    async acceptExisting(projectHandle: string, expectedFingerprint: string) {
        const root = this.active(projectHandle);
        if (this.phase) throw new Error('Software Map initialization is active');
        await acceptInitialization(root, expectedFingerprint);
        this.initialized = true;
        return this.index.analyze(root);
    }
    async acceptManual(projectHandle: string, declaration: ArchitectureDeclaration, expectedFingerprint: string) {
        const root = this.active(projectHandle);
        if (this.phase) throw new Error('Software Map initialization is active');
        await acceptInitialization(root, expectedFingerprint, parseArchitecture(declaration));
        this.initialized = true;
        return this.index.analyze(root);
    }
    async analyze(projectHandle: string) {
        const root = this.active(projectHandle);
        if (!(await readInitialization(root)).initialized) throw new Error('Software Map is not initialized');
        return this.index.analyze(root);
    }
    async status(projectHandle: string) {
        const root = this.active(projectHandle);
        this.initialized = (await readInitialization(root)).initialized;
        return this.initialized ? this.index.status(root) : this.idleStatus();
    }
    async hierarchy(request: SoftwareMapPageRequest & { parentId?: string; descendants?: boolean }): Promise<SoftwareMapPage<GraphNode>> {
        const snapshot = await this.snapshot(request.projectHandle);
        return this.page(snapshot, request, hierarchy(snapshot, request.parentId ?? snapshot.metadata.projectId, request.descendants));
    }
    async node(projectHandle: string, nodeId: string) {
        const snapshot = await this.snapshot(projectHandle);
        return { generation: snapshot.metadata.generation, item: snapshot.nodes.find(node => node.id === nodeId) };
    }
    async relationships(request: SoftwareMapRelationshipRequest): Promise<SoftwareMapPage<GraphRelationship>> {
        const snapshot = await this.snapshot(request.projectHandle);
        if (!['incoming', 'outgoing'].includes(request.direction) || request.scope && !['direct', 'aggregated', 'all'].includes(request.scope) ||
            request.kinds && (!Array.isArray(request.kinds) || request.kinds.some(kind => !['contains', 'owns', 'imports', 'depends-on', 'exports', 'references', 'extends', 'implements'].includes(kind)))) throw new Error('Invalid Software Map relationship query');
        const items = relationshipsFor(snapshot, request.nodeId, request.direction, request.kinds).filter(edge =>
            request.scope === 'aggregated' ? !!edge.originRelationshipIds?.length : request.scope === 'direct' ? !edge.originRelationshipIds?.length : true);
        return this.page(snapshot, request, items);
    }
    async relationshipEdges(request: SoftwareMapPageRequest & { relationshipIds: string[] }): Promise<SoftwareMapPage<GraphRelationship>> {
        const snapshot = await this.snapshot(request.projectHandle);
        if (!Array.isArray(request.relationshipIds) || request.relationshipIds.length > 200 || request.relationshipIds.some(id => typeof id !== 'string')) throw new Error('Invalid Software Map relationship IDs');
        const ids = new Set(request.relationshipIds);
        return this.page(snapshot, request, snapshot.relationships.filter(edge => ids.has(edge.id)));
    }
    async evidence(request: SoftwareMapPageRequest & { evidenceIds: string[] }): Promise<SoftwareMapPage<Evidence>> {
        const snapshot = await this.snapshot(request.projectHandle);
        if (!Array.isArray(request.evidenceIds) || request.evidenceIds.length > 200 || request.evidenceIds.some(id => typeof id !== 'string')) throw new Error('Invalid Software Map evidence query');
        const ids = new Set(request.evidenceIds);
        return this.page(snapshot, request, snapshot.evidence.filter(item => ids.has(item.id)));
    }
    async violations(request: SoftwareMapPageRequest & { subsystemId?: string; rule?: ArchitectureViolation['rule'] }): Promise<SoftwareMapPage<ArchitectureViolation>> {
        const snapshot = await this.snapshot(request.projectHandle);
        if (request.rule && !['forbidden-dependency', 'unlisted-dependency'].includes(request.rule)) throw new Error('Invalid Software Map violation query');
        return this.page(snapshot, request, snapshot.violations.filter(item =>
            (!request.subsystemId || item.sourceSubsystemId === request.subsystemId || item.targetSubsystemId === request.subsystemId) &&
            (!request.rule || item.rule === request.rule)));
    }
    async resolveSource(projectHandle: string, evidenceId: string) {
        const root = this.active(projectHandle);
        const evidence = (await this.snapshot(projectHandle)).evidence.find(item => item.id === evidenceId);
        if (!evidence?.path) return undefined;
        const path = join(root, projectPath(evidence.path));
        const canonical = await realpath(path);
        const local = relative(root, canonical);
        if (!local || local === '..' || local.startsWith(`..${sep}`)) throw new Error('Unsafe Software Map source path');
        return { uri: pathToFileURL(canonical).href, path: evidence.path, span: evidence.span };
    }
    dispose(): void { if (!this.disposed) { this.disposed = true; this.clearProvider(); this.unlisten(); } }
}
