import { assembleArchitectureProposal, parseSynthesisStageResult, SYNTHESIS_STAGE_VERSION } from './hierarchical-synthesis';
import { planArchitectureEvidence } from './evidence-planner';
import { isProductionEvidencePath, validateArchitectureEvidencePacket } from './synthesis';
import type { ArchitectureEvidencePacket, ArchitectureProposal } from './synthesis';
import type { AnalysisProgressEvent } from './hierarchical-synthesis';
import type { ReconciliationResult, SubsystemDiscoveryResult, SynthesisFinding, SynthesisProvider,
    SynthesisStage, SynthesisStageContext, SynthesisStageRequest, SynthesisStageResult, SystemCandidate,
    SystemChallengeResult, SystemDiscoveryResult, VerificationResult, SynthesisIssueCode } from './hierarchical-synthesis';

export const SYNTHESIS_PROMPT_VERSION = 2;
export const MAX_VERIFICATION_CALLS = 2;
export const MAX_VERIFICATION_TARGETS = 4;
export const MAX_EVIDENCE_REFINEMENT_ROUNDS = 2;
export const MAX_STAGE_RETRIES = 0;

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
}

/** Exact serialized identity avoids hash collisions; cached values are always revalidated against the parent packet. */
export function stageWorkIdentity(request: SynthesisStageRequest, providerIdentity: string,
    promptVersion = SYNTHESIS_PROMPT_VERSION): string {
    if (!providerIdentity.trim() || !Number.isSafeInteger(promptVersion) || promptVersion < 1)
        throw new Error('Invalid synthesis work identity');
    return JSON.stringify([request.parentPacketFingerprint, request.view.viewId, request.stage,
        request.stageVersion, promptVersion, request.context, providerIdentity]);
}

class StageResultFailure extends Error {
    constructor(error: unknown, readonly durationMs: number,
        readonly usage: import('./hierarchical-synthesis').SynthesisStageUsage) {
        super(error instanceof Error ? error.message : 'Invalid synthesis stage result');
    }
}

export class SynthesisStageCache {
    private readonly results = new Map<string, { provider: SynthesisProvider; result: SynthesisStageResult }>();
    constructor(private readonly maximum = 64) {
        if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error('Invalid synthesis cache bound');
    }
    async run(request: SynthesisStageRequest, packet: ArchitectureEvidencePacket, provider: SynthesisProvider,
        providerIdentity: string, promptVersion = SYNTHESIS_PROMPT_VERSION,
        checkpoint: () => void = () => {}): Promise<{ result: SynthesisStageResult; reused: boolean; durationMs: number;
            usage?: import('./hierarchical-synthesis').SynthesisStageUsage }> {
        const identity = stageWorkIdentity(request, providerIdentity, promptVersion);
        const cached = this.results.get(identity);
        if (cached && cached.provider === provider) {
            try {
                const result = parseSynthesisStageResult(structuredClone(cached.result), request, packet);
                return { result, reused: true, durationMs: 0 };
            } catch { this.results.delete(identity); }
        }
        const start = performance.now();
        const execution = await provider.runStage(request);
        const durationMs = performance.now() - start;
        let result: SynthesisStageResult;
        try {
            checkpoint();
            result = parseSynthesisStageResult(execution.output, request, packet);
            checkpoint();
        } catch (error) { throw new StageResultFailure(error, durationMs, execution.usage); }
        this.results.set(identity, { provider, result: structuredClone(result) });
        if (this.results.size > this.maximum) this.results.delete(this.results.keys().next().value!);
        return { result, reused: false, durationMs, usage: execution.usage };
    }
    clear(): void { this.results.clear(); }
}

const unique = (items: string[]): string[] => [...new Set(items)].sort();
const area = (path: string): string => {
    const parts = path.split('/');
    return parts[0] === 'packages' || parts[0] === 'apps' ? parts.slice(0, 2).join('/') : parts[0];
};

/** Deterministic structural audit. Findings are proposal uncertainty, never physical facts or canonical ownership. */
export function detectReconciliationConflicts(packet: ArchitectureEvidencePacket, systems: SystemCandidate[],
    subtrees: SubsystemDiscoveryResult[]): SynthesisFinding[] {
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
        let subsystemTotal: number | undefined;
        let verificationCompleted = 0;
        let verificationTotal: number | undefined;
        let firstCall = true;
        const run = async (stage: SynthesisStage, context: SynthesisStageContext) => {
            const subject = stage === 'subsystem-discovery' ? context.systems.find(system => system.candidateKey === context.subjectSystemKey)
                ?.name.replace(/[\x00-\x1f\x7f]/g, ' ').slice(0, 120) : undefined;
            const units = stage === 'subsystem-discovery' ? { completedUnits: subsystemCompleted, totalUnits: subsystemTotal } :
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
            record({ operation: 'planning', stage, subject: context.subjectSystemKey ?? undefined,
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
            let executed;
            const callStart = performance.now();
            try { executed = await this.cache.run(plan.request, packet, this.provider, identity, this.promptVersion, this.checkpoint); }
            catch (error) {
                record({ operation: stage === 'verification' ? 'verification-call' : 'stage-call', stage,
                    subject: context.subjectSystemKey ?? undefined,
                    durationMs: error instanceof StageResultFailure ? error.durationMs : performance.now() - callStart,
                    reused: false, providerKind: this.provider.kind, modelLabel: capability.modelLabel,
                    status: 'failed', attempt: 1, usage: error instanceof StageResultFailure ? error.usage : undefined });
                throw error;
            }
            this.checkpoint();
            record({ operation: stage === 'verification' ? 'verification-call' : 'stage-call', stage,
                subject: context.subjectSystemKey ?? undefined, durationMs: executed.durationMs, reused: executed.reused,
                providerKind: this.provider.kind, modelLabel: capability.modelLabel, status: 'completed', attempt: 1,
                usage: executed.usage });
            emit(stage, 'started', 'Model call complete', { subject, ...units, callPurpose: stage,
                providerKind: this.provider.kind, providerModelLabel: capability.modelLabel,
                callDurationMs: executed.durationMs, reused: executed.reused, usage: executed.usage });
            if (stage === 'subsystem-discovery') subsystemCompleted++;
            if (stage === 'verification') verificationCompleted++;
            emit(stage, stage === 'subsystem-discovery' && subsystemCompleted < subsystemTotal! ||
                stage === 'verification' ? 'started' : 'completed',
                `${stage.replaceAll('-', ' ')} ${stage === 'verification' ? 'check complete' : 'complete'}`, { subject,
                ...(stage === 'subsystem-discovery' ? { completedUnits: subsystemCompleted, totalUnits: subsystemTotal } :
                    stage === 'verification' ? { completedUnits: verificationCompleted, totalUnits: verificationTotal } : {}) });
            return { plan, result: executed.result };
        };
        const context = (systems: SystemCandidate[] = [], subtrees: SubsystemDiscoveryResult[] = [],
            subjectSystemKey: string | null = null, targetCandidateKeys: string[] = []): SynthesisStageContext =>
            ({ systems, subtrees, subjectSystemKey, targetCandidateKeys });
        const discovered = await run('system-discovery', context());
        const first = discovered.result as SystemDiscoveryResult;
        if (!first.systems.length) throw new Error('System Discovery produced no Systems to challenge');
        const challenged = await run('system-challenge', context(first.systems));
        const challenge = challenged.result as SystemChallengeResult;
        const systems = challenge.decisions.flatMap(decision => decision.systems);
        if (!systems.length) throw new Error('System Challenge rejected every System');
        subsystemTotal = systems.length;
        const subtrees: SubsystemDiscoveryResult[] = [];
        // Serial is the safe default; P5's separately exported scheduler retains explicit provider concurrency support.
        for (const system of systems) {
            const pass = await run('subsystem-discovery', context(systems, [], system.candidateKey));
            subtrees.push(pass.result as SubsystemDiscoveryResult);
        }
        const structural = detectReconciliationConflicts(packet, systems, subtrees);
        const reconciliation: ReconciliationResult = structural.length || systems.some(system => system.ambiguityCodes.length) ||
            subtrees.some(tree => tree.subdivisionAssessment.ambiguityCodes.length || tree.nodes.some(node => node.ambiguityCodes.length))
            ? (await run('reconciliation', context(systems, subtrees))).result as ReconciliationResult
            : { schemaVersion: 1, stageVersion: SYNTHESIS_STAGE_VERSION, parentPacketFingerprint: packet.inputFingerprint,
                viewId: 'deterministic:no-conflicts', stage: 'reconciliation' as const, findings: [], unresolved: [] };
        if (!structural.length && reconciliation.viewId === 'deterministic:no-conflicts') {
            emit('reconciliation', 'started', 'Reconciling architecture');
            emit('reconciliation', 'completed', 'No cross-System conflicts found');
        }
        const findings = [...structural, ...reconciliation.findings];
        const pendingFindings = findings.filter(item => item.status !== 'supported');
        const unresolved = unique([...reconciliation.unresolved.map(item => item.candidateKey),
            ...pendingFindings.flatMap(item => item.candidateKeys)]);
        const verifications: VerificationResult[] = [];
        const groups = pendingFindings.filter(item => item.candidateKeys.length <= MAX_VERIFICATION_TARGETS &&
            item.candidateKeys.some(key => unresolved.includes(key)))
            .slice(0, MAX_VERIFICATION_CALLS);
        verificationTotal = groups.length;
        if (!groups.length) emit('verification', 'started', 'Verifying uncertain boundaries', { completedUnits: 0, totalUnits: 0 });
        for (const group of groups) {
            const targetKeys = new Set(group.candidateKeys);
            const scopedTrees = subtrees.filter(tree => tree.nodes.some(node => targetKeys.has(node.candidateKey)))
                .map(tree => ({ ...tree, nodes: tree.nodes.filter(node => targetKeys.has(node.candidateKey) ||
                    tree.nodes.some(child => targetKeys.has(child.candidateKey) && child.parentCandidateKey === node.candidateKey)) }));
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
        return { proposal, timings, findings, verificationCalls: verifications.length };
    }
}
