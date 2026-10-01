import { assembleArchitectureProposal, parseSynthesisStageResult, SYNTHESIS_STAGE_VERSION, SynthesisProviderFailure,
    buildCoverageLedger } from './hierarchical-synthesis';
import { planArchitectureEvidence } from './evidence-planner';
import { isProductionEvidencePath, validateArchitectureEvidencePacket } from './synthesis';
import type { ArchitectureEvidencePacket, ArchitectureProposal } from './synthesis';
import type { AnalysisProgressEvent, SynthesisCallAttempt } from './hierarchical-synthesis';
import type { ReconciliationResult, SubsystemCandidate, SubsystemDiscoveryResult, SubsystemChallengeResult, ComponentDiscoveryResult, SystemSubtree, SynthesisFinding, SynthesisProvider,
    SynthesisStage, SynthesisStageContext, SynthesisStageRequest, SynthesisStageResult, SystemCandidate,
    SystemChallengeResult, SystemDiscoveryResult, VerificationResult, SynthesisIssueCode } from './hierarchical-synthesis';

export const SYNTHESIS_PROMPT_VERSION = 6;
export const MAX_VERIFICATION_CALLS = 2;
export const MAX_VERIFICATION_TARGETS = 4;
export const MAX_EVIDENCE_REFINEMENT_ROUNDS = 2;
export const MAX_GEMINI_ATTEMPTS = 3;

export interface SynthesisTiming {
    operation: 'planning' | 'stage-call' | 'verification-call' | 'assembly';
    stage?: SynthesisStage;
    subject?: string;
    durationMs: number;
    reused: boolean;
    providerKind?: SynthesisProvider['kind'];
    modelLabel?: string;
    status?: 'completed' | 'failed';
    attempt?: number;
    usage?: import('./hierarchical-synthesis').SynthesisStageUsage;
}
export interface HierarchicalAnalysis {
    proposal: ArchitectureProposal;
    timings: SynthesisTiming[];
    findings: SynthesisFinding[];
    verificationCalls: number;
    coverageLedger: import('./hierarchical-synthesis').CoverageLedgerEntry[];
    componentDescents: import('./hierarchical-synthesis').ComponentDescentDisposition[];
}

/** Exact serialized identity avoids hash collisions; cached values are always revalidated against the parent packet. */
export function stageWorkIdentity(request: SynthesisStageRequest, _providerIdentity: string,
    promptVersion = SYNTHESIS_PROMPT_VERSION): string {
    if (!_providerIdentity.trim() || !Number.isSafeInteger(promptVersion) || promptVersion < 1)
        throw new Error('Invalid synthesis work identity');
    return JSON.stringify([request.parentPacketFingerprint, request.view.viewId, request.stage,
        request.stageVersion, promptVersion, request.context]);
}

export interface SynthesisCheckpoint {
    identity: string;
    request: SynthesisStageRequest;
    result: SynthesisStageResult;
    providerKind: SynthesisProvider['kind'];
    modelLabel: string;
    attempt: number;
    completedAt: string;
    outputFingerprint: string;
    promptVersion: number;
}

export class SynthesisStageCache {
    private readonly results = new Map<string, SynthesisCheckpoint>();
    private readonly ledger: SynthesisCallAttempt[] = [];
    private nextCall = 0;
    constructor(private readonly maximum = 64) {
        if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error('Invalid synthesis cache bound');
    }
    onCheckpoint?: (checkpoints: SynthesisCheckpoint[], attempts: SynthesisCallAttempt[]) => Promise<void>;
    onStageStart?: (stage: SynthesisStage, subject: string | undefined, providerKind: SynthesisProvider['kind'],
        modelLabel: string, checkpoints: SynthesisCheckpoint[]) => Promise<void>;
    checkpoints(): SynthesisCheckpoint[] { return structuredClone([...this.results.values()]); }
    private scope(request: SynthesisStageRequest): string { return request.stage === 'verification' ?
        `${request.context.targetCandidateKeys.join(',')}:${request.context.boundaryCode ?? ''}` :
        request.context.subjectSubsystemKey ?? request.context.subjectSystemKey ?? ''; }
    private invalidate(request: SynthesisStageRequest): void {
        for (const [key, item] of this.results) {
            const sameSystem = item.request.context.subjectSystemKey === request.context.subjectSystemKey;
            const dependent = request.stage === 'system-discovery' ||
                request.stage === 'system-challenge' && item.request.stage !== 'system-discovery' ||
                request.stage === 'subsystem-discovery' && (sameSystem && ['subsystem-challenge', 'component-discovery'].includes(item.request.stage) ||
                    ['reconciliation', 'verification'].includes(item.request.stage)) ||
                request.stage === 'subsystem-challenge' && (sameSystem && item.request.stage === 'component-discovery' ||
                    ['reconciliation', 'verification'].includes(item.request.stage)) ||
                request.stage === 'component-discovery' && ['reconciliation', 'verification'].includes(item.request.stage) ||
                request.stage === 'reconciliation' && item.request.stage === 'verification';
            if (item.request.stage === request.stage && this.scope(item.request) === this.scope(request) || dependent) this.results.delete(key);
        }
    }
    restore(checkpoints: SynthesisCheckpoint[], attempts: SynthesisCallAttempt[] = [], packet?: ArchitectureEvidencePacket): void {
        this.clear();
        const invalid: SynthesisStageRequest[] = [];
        for (const item of checkpoints) {
            if (item.promptVersion !== SYNTHESIS_PROMPT_VERSION || item.request.stageVersion !== SYNTHESIS_STAGE_VERSION) {
                invalid.push(item.request); continue;
            }
            if (item.identity !== stageWorkIdentity(item.request, 'restored', item.promptVersion) ||
                item.outputFingerprint !== JSON.stringify(item.result)) throw new Error('Invalid synthesis checkpoint');
            if (packet) {
                try { parseSynthesisStageResult(item.result, item.request, packet); }
                catch { invalid.push(item.request); continue; }
            }
            this.results.set(item.identity, structuredClone(item));
        }
        invalid.forEach(request => this.invalidate(request));
        this.ledger.push(...structuredClone(attempts));
        this.nextCall = attempts.reduce((max, item) => Math.max(max, Number(item.callId.slice(5)) || 0), 0);
    }
    async run(request: SynthesisStageRequest, packet: ArchitectureEvidencePacket, provider: SynthesisProvider,
        providerIdentity: string, promptVersion = SYNTHESIS_PROMPT_VERSION,
        checkpoint: () => void = () => {}, onAttempt?: (attempt: SynthesisCallAttempt, retrying: boolean) => void,
        modelLabel = providerIdentity, onRetryStart?: (attempt: number) => void): Promise<{ result: SynthesisStageResult; reused: boolean; durationMs: number;
            usage?: import('./hierarchical-synthesis').SynthesisStageUsage; provenance: { providerKind: SynthesisProvider['kind']; modelLabel: string } }> {
        const identity = stageWorkIdentity(request, providerIdentity, promptVersion);
        const cached = this.results.get(identity);
        if (cached) {
            try {
                const result = parseSynthesisStageResult(structuredClone(cached.result), request, packet);
                return { result, reused: true, durationMs: 0,
                    provenance: { providerKind: cached.providerKind, modelLabel: cached.modelLabel } };
            } catch { this.results.delete(identity); }
        }
        const subjectScope = this.scope(request);
        const replaced = [...this.results.values()].some(item => item.request.stage === request.stage &&
            this.scope(item.request) === subjectScope && item.identity !== identity);
        if (replaced) this.invalidate(request);
        const callId = `call:${++this.nextCall}`;
        const requestBytes = new TextEncoder().encode(JSON.stringify(request)).length;
        const subject = request.context.subjectSubsystemKey ?? request.context.subjectSystemKey ?? undefined;
        await this.onStageStart?.(request.stage, subject, provider.kind, modelLabel, this.checkpoints());
        const previous = this.ledger.filter(item => item.stage === request.stage && item.subject === subject);
        const previousAttempt = previous.at(-1)?.consumed ? undefined : previous.at(-1);
        for (let number = 1; ; number++) {
            if (number > 1) onRetryStart?.(previous.length + number);
            const startedAt = new Date().toISOString();
            const start = performance.now();
            let execution: import('./hierarchical-synthesis').SynthesisStageExecution | undefined;
            let result: SynthesisStageResult | undefined;
            let failure: unknown;
            let failureClass: SynthesisCallAttempt['failureClass'];
            try {
                execution = await provider.runStage(request);
            } catch (error) {
                failure = error;
                failureClass = error instanceof SynthesisProviderFailure ? error.failureClass : 'provider-failure';
            }
            const durationMs = performance.now() - start;
            if (execution) {
                try {
                    checkpoint();
                    try { result = parseSynthesisStageResult(execution.output, request, packet); }
                    catch (error) {
                        failure = error;
                        failureClass = 'invalid-stage-result';
                    }
                    if (result) checkpoint();
                } catch (error) {
                    failure = error;
                    result = undefined;
                    failureClass = 'cancelled';
                }
            }
            const attempt: SynthesisCallAttempt = { callId, attemptId: `${callId}:${number}`,
                ...(number > 1 ? { retryOf: `${callId}:${number - 1}` } : previousAttempt ? { retryOf: previousAttempt.attemptId } : {}),
                stage: request.stage, subject,
                providerKind: provider.kind, modelLabel, attempt: previous.length + number, startedAt, durationMs, requestBytes,
                ...(execution ? { outputBytes: execution.usage.outputBytes,
                    inputTokens: execution.usage.inputTokens, outputTokens: execution.usage.outputTokens,
                    totalTokens: execution.usage.totalTokens } : {}),
                tokenMeasurement: execution?.usage.tokenMeasurement ?? 'unavailable',
                ...(failureClass ? { failureClass } : {}), reused: false, consumed: !!result };
            this.ledger.push(attempt);
            if (result) {
                const saved: SynthesisCheckpoint = { identity, request: structuredClone(request), result: structuredClone(result),
                    providerKind: provider.kind, modelLabel, attempt: attempt.attempt, completedAt: new Date().toISOString(),
                    outputFingerprint: JSON.stringify(result), promptVersion };
                this.results.set(identity, saved);
                try { await this.onCheckpoint?.(this.checkpoints(), this.attempts()); }
                catch (error) { this.results.delete(identity); attempt.consumed = false; throw error; }
                if (this.results.size > this.maximum) this.results.delete(this.results.keys().next().value!);
            }
            const retrying = provider.kind === 'gemini' && (failure instanceof SynthesisProviderFailure &&
                (['transient-transport', 'transient-upstream'].includes(failure.failureClass) && number < MAX_GEMINI_ATTEMPTS ||
                    failure.failureClass === 'invalid-json' && number < 2));
            onAttempt?.(structuredClone(attempt), retrying);
            if (result) {
                return { result, reused: false, durationMs, usage: execution!.usage,
                    provenance: { providerKind: provider.kind, modelLabel } };
            }
            if (!retrying) throw failure;
            checkpoint();
        }
    }
    attempts(): SynthesisCallAttempt[] { return structuredClone(this.ledger); }
    recordTargetAttempt(attempt: Omit<SynthesisCallAttempt, 'callId' | 'attemptId' | 'attempt' | 'reused'>): void {
        const callId = `call:${++this.nextCall}`;
        this.ledger.push({ ...attempt, callId, attemptId: `${callId}:1`, attempt: 1, reused: false });
    }
    clear(): void { this.results.clear(); this.ledger.length = 0; this.nextCall = 0; }
}

const unique = (items: string[]): string[] => [...new Set(items)].sort();
const area = (path: string): string => {
    const parts = path.split('/');
    return parts[0] === 'packages' || parts[0] === 'apps' ? parts.slice(0, 2).join('/') : parts[0];
};

/** Deterministic structural audit. Findings are proposal uncertainty, never physical facts or canonical ownership. */
export function detectReconciliationConflicts(packet: ArchitectureEvidencePacket, systems: SystemCandidate[],
    subtrees: SystemSubtree[]): SynthesisFinding[] {
    validateArchitectureEvidencePacket(packet);
    const refs = new Map(packet.items.map(item => [item.id, item]));
    const systemKeys = new Set(systems.map(system => system.candidateKey));
    if (!systems.length || systemKeys.size !== systems.length || subtrees.length !== systems.length ||
        new Set(subtrees.map(tree => tree.systemKey)).size !== systems.length ||
        subtrees.some(tree => !systemKeys.has(tree.systemKey))) throw new Error('Missing or duplicated challenged System subtree');
    const findings: SynthesisFinding[] = [];
    const add = (keys: string[], evidenceRefs: string[], code: SynthesisIssueCode): void => {
        const ids = unique(evidenceRefs).filter(ref => refs.has(ref));
        if (ids.length) findings.push({ candidateKeys: unique(keys), evidenceRefs: ids, status: 'uncertain', code });
    };
    const claims = new Map<string, { keys: string[]; systems: string[] }>();
    const pathClaims = new Map<string, { keys: string[]; systems: string[]; refs: string[] }>();
    const nodes = subtrees.flatMap(tree => tree.nodes.map(node => ({ node, systemKey: tree.systemKey })));
    for (const { node, systemKey } of nodes) {
        if (!systemKeys.has(systemKey) || node.kind === 'subsystem' && node.parentCandidateKey !== systemKey ||
            node.kind === 'component' && !subtrees.find(tree => tree.systemKey === systemKey)?.nodes.some(parent =>
                parent.kind === 'subsystem' && parent.candidateKey === node.parentCandidateKey))
            throw new Error(`Candidate escaped challenged System: ${node.candidateKey}`);
        for (const ref of node.ownershipEvidenceRefs) {
            const claim = claims.get(ref) ?? { keys: [], systems: [] };
            claim.keys.push(node.candidateKey); claim.systems.push(systemKey); claims.set(ref, claim);
            const path = refs.get(ref)?.path;
            if (path) {
                const pathClaim = pathClaims.get(path) ?? { keys: [], systems: [], refs: [] };
                pathClaim.keys.push(node.candidateKey); pathClaim.systems.push(systemKey); pathClaim.refs.push(ref);
                pathClaims.set(path, pathClaim);
            }
        }
        const own = systems.find(system => system.candidateKey === systemKey)!;
        // A root manifest locates the repository, not a System's exclusive source area.
        const ownAreas = new Set(own.evidenceRefs.map(ref => refs.get(ref)).filter(item => item && item.path !== 'package.json')
            .map(item => area(item!.path)));
        const nodeAreas = node.ownershipEvidenceRefs.map(ref => refs.get(ref)).filter(Boolean).map(item => area(item!.path));
        if (ownAreas.size && nodeAreas.length && nodeAreas.every(group => !ownAreas.has(group)) &&
            !node.evidenceRefs.some(ref => own.evidenceRefs.includes(ref)))
            add([systemKey, node.candidateKey], node.ownershipEvidenceRefs, 'outside-system');
        if (!node.ownershipEvidenceRefs.some(ref => {
            const item = refs.get(ref);
            return item && isProductionEvidencePath(item.path) && item.sourceEvidenceIds.length > 0;
        })) add([node.candidateKey], node.evidenceRefs, 'weak-support');
    }
    for (const [ref, claim] of claims) if (new Set(claim.systems).size > 1)
        add(claim.keys, [ref], 'ownership-conflict');
    for (const claim of pathClaims.values()) if (new Set(claim.systems).size > 1 && new Set(claim.refs).size > 1)
        add(claim.keys, claim.refs, 'same-source-region');
    // Compare peers only: a parent and its child may legitimately cite the same source fact.
    const peers = new Map<string, typeof nodes>();
    for (const entry of nodes) {
        const peerKey = `${entry.systemKey}:${entry.node.kind}:${entry.node.parentCandidateKey}`;
        const group = peers.get(peerKey) ?? [];
        group.push(entry);
        peers.set(peerKey, group);
    }
    for (const group of peers.values()) for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
        const a = group[i].node, b = group[j].node;
        const shared = a.ownershipEvidenceRefs.filter(ref => b.ownershipEvidenceRefs.includes(ref));
        if (shared.length) add([a.candidateKey, b.candidateKey], shared, 'ownership-conflict');
        if (a.responsibility.toLowerCase() === b.responsibility.toLowerCase())
            add([a.candidateKey, b.candidateKey], [...a.evidenceRefs, ...b.evidenceRefs], 'duplicate-responsibility');
        if (a.kind === 'subsystem' && b.kind === 'subsystem') {
            const aPaths = new Set(a.ownershipEvidenceRefs.map(ref => refs.get(ref)?.path));
            const bPaths = new Set(b.ownershipEvidenceRefs.map(ref => refs.get(ref)?.path));
            const dependencies = packet.items.filter(item => item.kind === 'dependency' &&
                (aPaths.has(item.path) && bPaths.has(item.targetPath) || bPaths.has(item.path) && aPaths.has(item.targetPath)));
            if (dependencies.length) add([a.candidateKey, b.candidateKey], dependencies.slice(0, 4).map(item => item.id),
                'cross-subsystem-dependency');
        }
    }
    for (const { node } of nodes) if (node.kind === 'subsystem' &&
        /^(front.?end|back.?end|client|server|database|repository|worker|http|framework|package)(\s|$)/i.test(node.name) &&
        !node.ownershipEvidenceRefs.some(ref => {
            const item = refs.get(ref);
            return item && isProductionEvidencePath(item.path) && item.sourceEvidenceIds.length > 0;
        })) add([node.candidateKey], node.evidenceRefs, 'technical-layer-boundary');
    for (let i = 0; i < systems.length; i++) for (let j = i + 1; j < systems.length; j++) {
        const a = systems[i], b = systems[j];
        const shared = a.evidenceRefs.filter(ref => b.evidenceRefs.includes(ref));
        if (shared.length) add([a.candidateKey, b.candidateKey], shared, 'boundary-overlap');
        if (a.name.toLowerCase() === b.name.toLowerCase() ||
            a.responsibility.toLowerCase() === b.responsibility.toLowerCase())
            add([a.candidateKey, b.candidateKey], [...a.evidenceRefs, ...b.evidenceRefs],
                'duplicate-responsibility');
        const aPaths = new Set(a.evidenceRefs.map(ref => refs.get(ref)?.path));
        const bPaths = new Set(b.evidenceRefs.map(ref => refs.get(ref)?.path));
        const samePaths = a.evidenceRefs.filter(ref => bPaths.has(refs.get(ref)?.path));
        if (samePaths.length && !shared.length) add([a.candidateKey, b.candidateKey], samePaths,
            'same-source-region');
        const cross = packet.items.filter(item => item.kind === 'dependency' && (
            aPaths.has(item.path) && bPaths.has(item.targetPath) || bPaths.has(item.path) && aPaths.has(item.targetPath)));
        if (cross.length) add([a.candidateKey, b.candidateKey], cross.slice(0, 4).map(item => item.id),
            'cross-system-dependency');
    }
    return findings.sort((a, b) => a.candidateKeys.join().localeCompare(b.candidateKeys.join()) ||
        a.code.localeCompare(b.code));
}

export class HierarchicalSynthesisOrchestrator {
    readonly cache: SynthesisStageCache;
    constructor(private readonly provider: SynthesisProvider, private readonly providerIdentity: string,
        private readonly promptVersion = SYNTHESIS_PROMPT_VERSION,
        private readonly onTiming?: (timing: SynthesisTiming) => void,
        private readonly onProgress?: (event: AnalysisProgressEvent) => void,
        private readonly checkpoint: () => void = () => {},
        private readonly beforeFirstCall?: () => Promise<void>, cache?: SynthesisStageCache) {
        this.cache = cache ?? new SynthesisStageCache();
    }

    async analyze(packet: ArchitectureEvidencePacket): Promise<HierarchicalAnalysis> {
        validateArchitectureEvidencePacket(packet);
        this.checkpoint();
        const analysisStart = performance.now();
        const emit = (stage: AnalysisProgressEvent['stage'], status: AnalysisProgressEvent['status'], message: string,
            extra: Partial<AnalysisProgressEvent> = {}) => {
            this.checkpoint();
            this.onProgress?.({ stage, status, message, elapsedMs: Math.max(0, Math.floor(performance.now() - analysisStart)), ...extra });
        };
        const timings: SynthesisTiming[] = [];
        const record = (timing: SynthesisTiming): void => { timings.push(timing); this.onTiming?.(timing); };
        const capability = await this.provider.capabilities();
        this.checkpoint();
        const identity = `${this.provider.kind}:${this.providerIdentity}:${capability.modelLabel}`;
        let subsystemCompleted = 0;
        let subsystemChallengeCompleted = 0;
        let componentCompleted = 0;
        let componentTotal = 0;
        let subsystemTotal: number | undefined;
        let verificationCompleted = 0;
        let verificationTotal: number | undefined;
        let firstCall = true;
        const run = async (stage: SynthesisStage, context: SynthesisStageContext) => {
            const subjectName = stage === 'component-discovery' ? context.subsystems.find(subsystem => subsystem.candidateKey === context.subjectSubsystemKey)?.name :
                ['subsystem-discovery', 'subsystem-challenge'].includes(stage) ? context.systems.find(system => system.candidateKey === context.subjectSystemKey)?.name : undefined;
            const subject = subjectName?.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 120);
            const units = stage === 'subsystem-discovery' ? { completedUnits: subsystemCompleted, totalUnits: subsystemTotal } :
                stage === 'subsystem-challenge' ? { completedUnits: subsystemChallengeCompleted, totalUnits: subsystemTotal } :
                stage === 'component-discovery' ? { completedUnits: componentCompleted, totalUnits: componentTotal } :
                stage === 'verification' ? { completedUnits: verificationCompleted, totalUnits: verificationTotal } : {};
            if (stage === 'system-discovery') emit('building-skeleton', 'started', 'Building architecture skeleton');
            else emit(stage, 'started', stage === 'subsystem-discovery' ? 'Discovering Subsystems' : stage.replaceAll('-', ' '), { subject, ...units });
            const start = performance.now();
            const plan = await planArchitectureEvidence(packet, stage, context, capability, this.provider);
            this.checkpoint();
            if (stage === 'system-discovery') {
                emit('building-skeleton', 'completed', 'Architecture skeleton ready');
                emit(stage, 'started', 'Discovering Systems');
            }
            record({ operation: 'planning', stage, subject: context.subjectSubsystemKey ?? context.subjectSystemKey ?? undefined,
                durationMs: performance.now() - start, reused: false });
            if (firstCall) {
                firstCall = false;
                if (this.beforeFirstCall) {
                    emit(stage, 'started', 'Preparing selected model', { callPurpose: 'model-warm-up',
                        providerKind: this.provider.kind, providerModelLabel: capability.modelLabel });
                    await this.beforeFirstCall();
                    this.checkpoint();
                }
            }
            emit(stage, 'started', `Analyzing ${stage.replaceAll('-', ' ')}`, { subject, ...units,
                callPurpose: stage, providerKind: this.provider.kind, providerModelLabel: capability.modelLabel, attempt: 1 });
            const executed = await this.cache.run(plan.request, packet, this.provider, identity, this.promptVersion,
                this.checkpoint, (attempt, retrying) => {
                    const usage = attempt.outputBytes === undefined ? undefined : {
                        providerKind: attempt.providerKind, modelLabel: attempt.modelLabel,
                        requestBytes: attempt.requestBytes, outputBytes: attempt.outputBytes,
                        inputTokens: attempt.inputTokens, outputTokens: attempt.outputTokens,
                        totalTokens: attempt.totalTokens, tokenMeasurement: attempt.tokenMeasurement };
                    record({ operation: stage === 'verification' ? 'verification-call' : 'stage-call', stage,
                        subject: context.subjectSubsystemKey ?? context.subjectSystemKey ?? undefined,
                        durationMs: attempt.durationMs, reused: false, providerKind: attempt.providerKind,
                        modelLabel: attempt.modelLabel, status: attempt.consumed ? 'completed' : 'failed',
                        attempt: attempt.attempt, usage });
                    emit(stage, retrying ? 'retrying' :
                        attempt.failureClass ? 'failed' : 'started',
                    attempt.failureClass ? `Model call ${attempt.failureClass.replaceAll('-', ' ')}` : 'Model call complete',
                    { subject, ...units, callPurpose: stage, providerKind: attempt.providerKind,
                        providerModelLabel: attempt.modelLabel, callDurationMs: attempt.durationMs,
                        attempt: attempt.attempt, usage });
            }, capability.modelLabel, attempt => emit(stage, 'started', `Model call attempt ${attempt}`, { subject, ...units,
                callPurpose: stage, providerKind: this.provider.kind, providerModelLabel: capability.modelLabel, attempt }));
            this.checkpoint();
            if (executed.reused) {
                record({ operation: stage === 'verification' ? 'verification-call' : 'stage-call', stage,
                    subject: context.subjectSubsystemKey ?? context.subjectSystemKey ?? undefined,
                    durationMs: 0, reused: true, providerKind: executed.provenance.providerKind,
                    modelLabel: executed.provenance.modelLabel, status: 'completed' });
                emit(stage, 'started', 'Cached stage reused', { subject, ...units, callPurpose: stage,
                    providerKind: executed.provenance.providerKind, providerModelLabel: executed.provenance.modelLabel,
                    callDurationMs: 0, reused: true });
            }
            if (stage === 'subsystem-discovery') subsystemCompleted++;
            if (stage === 'subsystem-challenge') subsystemChallengeCompleted++;
            if (stage === 'component-discovery') componentCompleted++;
            if (stage === 'verification') verificationCompleted++;
            emit(stage, stage === 'subsystem-discovery' && subsystemCompleted < subsystemTotal! ||
                stage === 'subsystem-challenge' && subsystemChallengeCompleted < subsystemTotal! ||
                stage === 'component-discovery' && componentCompleted < componentTotal ||
                stage === 'verification' ? 'started' : 'completed',
                `${stage.replaceAll('-', ' ')} ${stage === 'verification' ? 'check complete' : 'complete'}`, { subject,
                ...(stage === 'subsystem-discovery' ? { completedUnits: subsystemCompleted, totalUnits: subsystemTotal } :
                    stage === 'subsystem-challenge' ? { completedUnits: subsystemChallengeCompleted, totalUnits: subsystemTotal } :
                    stage === 'component-discovery' ? { completedUnits: componentCompleted, totalUnits: componentTotal } :
                    stage === 'verification' ? { completedUnits: verificationCompleted, totalUnits: verificationTotal } : {}) });
            return { plan, result: executed.result };
        };
        const context = (systems: SystemCandidate[] = [], subtrees: SystemSubtree[] = [],
            subjectSystemKey: string | null = null, targetCandidateKeys: string[] = [],
            subsystems: SubsystemCandidate[] = [], subjectSubsystemKey: string | null = null,
            challengedBy?: SubsystemChallengeResult): SynthesisStageContext =>
            ({ systems, subtrees, subjectSystemKey, targetCandidateKeys, subsystems, subjectSubsystemKey,
                ...(challengedBy ? { challengedBy } : {}) });
        const discovered = await run('system-discovery', context());
        const first = discovered.result as SystemDiscoveryResult;
        if (!first.systems.length) throw new Error('System Discovery produced no Systems to challenge');
        const challenged = await run('system-challenge', context(first.systems));
        const challenge = challenged.result as SystemChallengeResult;
        const systems = challenge.decisions.flatMap(decision => decision.systems);
        if (!systems.length) throw new Error('System Challenge rejected every System');
        subsystemTotal = systems.length;
        const subtrees: SystemSubtree[] = [];
        const recoveredKeys = new Set<string>();
        for (const system of systems) {
            const branch = [system];
            const discovered = (await run('subsystem-discovery', context(branch, [], system.candidateKey))).result as SubsystemDiscoveryResult;
            const challenged = (await run('subsystem-challenge', context(branch, [], system.candidateKey, [],
                discovered.subsystems))).result as SubsystemChallengeResult;
            for (const decision of challenged.decisions) if (decision.action === 'merge' || decision.action === 'split')
                for (const item of decision.subsystems) recoveredKeys.add(item.candidateKey);
            const subsystems = [...challenged.decisions.flatMap(decision => decision.subsystems),
                ...(challenged.recovered ?? []).map(item => item.subsystem)];
            for (const item of challenged.recovered ?? []) recoveredKeys.add(item.subsystem.candidateKey);
            const nodes: SystemSubtree['nodes'] = [...subsystems];
            const componentDescents: NonNullable<SystemSubtree['componentDescents']> = [];
            componentCompleted = 0; componentTotal = subsystems.length;
            for (const subsystem of subsystems) {
                const components = (await run('component-discovery', context(branch, [], system.candidateKey, [],
                    subsystems, subsystem.candidateKey, challenged))).result as ComponentDiscoveryResult;
                nodes.push(...components.components);
                if (components.disposition) componentDescents.push(components.disposition);
            }
            subtrees.push({ systemKey: system.candidateKey, nodes, componentDescents });
        }
        const structural = detectReconciliationConflicts(packet, systems, subtrees);
        const descentFindings: SynthesisFinding[] = subtrees.flatMap(tree => (tree.componentDescents ?? [])
            .filter(item => item.kind !== 'leaf-responsibility').map(item => ({
                candidateKeys: [item.subsystemKey], evidenceRefs: item.evidenceRefs, status: 'uncertain' as const,
                code: item.kind === 'insufficient-evidence' ? 'insufficient-evidence' as const :
                    item.kind === 'responsibility-belongs-elsewhere' ? 'outside-system' as const : 'unclear-subdivision' as const })));
        const reconciliation: ReconciliationResult = structural.length || systems.some(system => system.ambiguityCodes.length) ||
            descentFindings.length || subtrees.some(tree => tree.nodes.some(node => node.ambiguityCodes.length))
            ? (await run('reconciliation', context(systems, subtrees))).result as ReconciliationResult
            : { schemaVersion: 1, stageVersion: SYNTHESIS_STAGE_VERSION, parentPacketFingerprint: packet.inputFingerprint,
                viewId: 'deterministic:no-conflicts', stage: 'reconciliation' as const, findings: [], unresolved: [] };
        if (!structural.length && reconciliation.viewId === 'deterministic:no-conflicts') {
            emit('reconciliation', 'started', 'Reconciling architecture');
            emit('reconciliation', 'completed', 'No cross-System conflicts found');
        }
        const findings = [...structural, ...reconciliation.findings, ...descentFindings];
        const pendingFindings = findings.filter(item => item.status !== 'supported');
        const unresolved = unique([...reconciliation.unresolved.map(item => item.candidateKey),
            ...pendingFindings.flatMap(item => item.candidateKeys)]);
        const verifications: VerificationResult[] = [];
        const groups = pendingFindings.filter(item => !descentFindings.includes(item) && item.candidateKeys.length <= MAX_VERIFICATION_TARGETS &&
            item.candidateKeys.some(key => unresolved.includes(key)))
            .slice(0, MAX_VERIFICATION_CALLS);
        verificationTotal = groups.length;
        if (!groups.length) emit('verification', 'started', 'Verifying uncertain boundaries', { completedUnits: 0, totalUnits: 0 });
        for (const group of groups) {
            const targetKeys = new Set(group.candidateKeys);
            const scopedTrees = subtrees.filter(tree => tree.nodes.some(node => targetKeys.has(node.candidateKey)))
                .map(tree => ({ ...tree, nodes: tree.nodes.filter(node => targetKeys.has(node.candidateKey) ||
                    tree.nodes.some(child => targetKeys.has(child.candidateKey) && child.parentCandidateKey === node.candidateKey)),
                    componentDescents: tree.componentDescents?.filter(item => targetKeys.has(item.subsystemKey)) }));
            const scopedSystems = systems.filter(system => targetKeys.has(system.candidateKey) ||
                scopedTrees.some(tree => tree.systemKey === system.candidateKey));
            const verificationContext = { ...context(scopedSystems, scopedTrees, null, group.candidateKeys),
                boundaryCode: group.code };
            const checked = await run('verification', verificationContext);
            const verification = checked.result as VerificationResult;
            verifications.push(verification);
            if (verification.findings.length && verification.findings.every(item => item.status === 'supported') &&
                group.candidateKeys.every(key => verification.findings.some(item => item.candidateKeys.includes(key))))
                pendingFindings.splice(pendingFindings.indexOf(group), 1);
        }
        emit('verification', 'completed', 'Boundary verification complete',
            { completedUnits: verificationCompleted, totalUnits: groups.length });
        const unresolvedWithoutFinding = reconciliation.unresolved.filter(item =>
            !findings.some(finding => finding.candidateKeys.includes(item.candidateKey)));
        const finalReconciliation: ReconciliationResult = { ...reconciliation, findings: pendingFindings,
            unresolved: [...new Map([...unresolvedWithoutFinding, ...pendingFindings.flatMap(item =>
                item.candidateKeys.map(candidateKey => ({ candidateKey, code: item.code })))].map(item => [item.candidateKey, item])).values()] };
        const start = performance.now();
        const firstNames = new Map(first.systems.map(system => [system.candidateKey, system.name]));
        const changes = challenge.decisions.filter(decision => decision.action !== 'keep').map(decision =>
            `${decision.action} ${decision.sourceKeys.map(key => firstNames.get(key)!).join(' / ')}` +
            (decision.systems.length ? ` → ${decision.systems.map(system => system.name).join(' / ')}` : ''));
        const proposal = assembleArchitectureProposal({ parentPacketFingerprint: packet.inputFingerprint,
            summary: `Architecture proposal with ${systems.length} challenged System${systems.length === 1 ? '' : 's'}.` +
                (changes.length ? ` Challenge: ${changes.slice(0, 5).join('; ')}${changes.length > 5 ? `; ${changes.length - 5} more changes` : ''}.` : ''),
            systems, subtrees, reconciliation: finalReconciliation, verifications }, packet);
        this.checkpoint();
        record({ operation: 'assembly', durationMs: performance.now() - start, reused: false });
        return { proposal, timings, findings, verificationCalls: verifications.length,
            coverageLedger: buildCoverageLedger(packet, subtrees, recoveredKeys),
            componentDescents: subtrees.flatMap(tree => tree.componentDescents ?? []) };
    }
}
