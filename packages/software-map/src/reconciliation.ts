import { assembleArchitectureProposal, parseSynthesisStageResult, SYNTHESIS_STAGE_VERSION } from './hierarchical-synthesis';
import { planArchitectureEvidence } from './evidence-planner';
import { isProductionEvidencePath, validateArchitectureEvidencePacket } from './synthesis';
import type { ArchitectureEvidencePacket, ArchitectureProposal } from './synthesis';
import type { ReconciliationResult, SubsystemDiscoveryResult, SynthesisFinding, SynthesisProvider,
    SynthesisStage, SynthesisStageContext, SynthesisStageRequest, SynthesisStageResult, SystemCandidate,
    SystemChallengeResult, SystemDiscoveryResult, VerificationResult } from './hierarchical-synthesis';

export const SYNTHESIS_PROMPT_VERSION = 1;
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

export class SynthesisStageCache {
    private readonly results = new Map<string, { provider: SynthesisProvider; result: SynthesisStageResult }>();
    constructor(private readonly maximum = 64) {
        if (!Number.isSafeInteger(maximum) || maximum < 1) throw new Error('Invalid synthesis cache bound');
    }
    async run(request: SynthesisStageRequest, packet: ArchitectureEvidencePacket, provider: SynthesisProvider,
        providerIdentity: string, promptVersion = SYNTHESIS_PROMPT_VERSION): Promise<{ result: SynthesisStageResult; reused: boolean; durationMs: number }> {
        const identity = stageWorkIdentity(request, providerIdentity, promptVersion);
        const cached = this.results.get(identity);
        if (cached && cached.provider === provider) {
            try {
                const result = parseSynthesisStageResult(structuredClone(cached.result), request, packet);
                return { result, reused: true, durationMs: 0 };
            } catch { this.results.delete(identity); }
        }
        const start = performance.now();
        const result = parseSynthesisStageResult(await provider.runStage(request), request, packet);
        this.results.set(identity, { provider, result: structuredClone(result) });
        if (this.results.size > this.maximum) this.results.delete(this.results.keys().next().value!);
        return { result, reused: false, durationMs: performance.now() - start };
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
    const add = (keys: string[], evidenceRefs: string[], message: string): void => {
        const ids = unique(evidenceRefs).filter(ref => refs.has(ref));
        if (ids.length) findings.push({ candidateKeys: unique(keys), evidenceRefs: ids, status: 'uncertain', message });
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
        const ownAreas = new Set(own.evidenceRefs.map(ref => refs.get(ref)).filter(Boolean).map(item => area(item!.path)));
        const nodeAreas = node.ownershipEvidenceRefs.map(ref => refs.get(ref)).filter(Boolean).map(item => area(item!.path));
        if (ownAreas.size && nodeAreas.length && nodeAreas.every(group => !ownAreas.has(group)) &&
            !node.evidenceRefs.some(ref => own.evidenceRefs.includes(ref)))
            add([systemKey, node.candidateKey], node.ownershipEvidenceRefs, 'Candidate responsibility lies outside the challenged System evidence region.');
        if (!node.ownershipEvidenceRefs.some(ref => {
            const item = refs.get(ref);
            return item && isProductionEvidencePath(item.path) && item.sourceEvidenceIds.length > 0;
        })) add([node.candidateKey], node.evidenceRefs, 'Candidate has weak direct production support.');
    }
    for (const [ref, claim] of claims) if (new Set(claim.systems).size > 1)
        add(claim.keys, [ref], 'The same implementation fact is claimed by multiple Systems.');
    for (const claim of pathClaims.values()) if (new Set(claim.systems).size > 1 && new Set(claim.refs).size > 1)
        add(claim.keys, claim.refs, 'Multiple Systems claim behavior in the same source file.');
    for (let i = 0; i < systems.length; i++) for (let j = i + 1; j < systems.length; j++) {
        const a = systems[i], b = systems[j];
        const shared = a.evidenceRefs.filter(ref => b.evidenceRefs.includes(ref));
        if (shared.length) add([a.candidateKey, b.candidateKey], shared, 'System boundaries share supporting evidence; review responsibility overlap.');
        if (a.name.toLowerCase() === b.name.toLowerCase() ||
            a.purpose.toLowerCase() === b.purpose.toLowerCase())
            add([a.candidateKey, b.candidateKey], [...a.evidenceRefs, ...b.evidenceRefs],
                'System candidates describe the same name or responsibility.');
        const aPaths = new Set(a.evidenceRefs.map(ref => refs.get(ref)?.path));
        const bPaths = new Set(b.evidenceRefs.map(ref => refs.get(ref)?.path));
        const samePaths = a.evidenceRefs.filter(ref => bPaths.has(refs.get(ref)?.path));
        if (samePaths.length && !shared.length) add([a.candidateKey, b.candidateKey], samePaths,
            'System evidence occupies the same source region.');
        const cross = packet.items.filter(item => item.kind === 'dependency' && (
            aPaths.has(item.path) && bPaths.has(item.targetPath) || bPaths.has(item.path) && aPaths.has(item.targetPath)));
        if (cross.length) add([a.candidateKey, b.candidateKey], cross.slice(0, 4).map(item => item.id),
            'Direct cross-System dependency may indicate a boundary problem.');
    }
    return findings.sort((a, b) => a.candidateKeys.join().localeCompare(b.candidateKeys.join()) ||
        a.message.localeCompare(b.message));
}

export class HierarchicalSynthesisOrchestrator {
    readonly cache = new SynthesisStageCache();
    constructor(private readonly provider: SynthesisProvider, private readonly providerIdentity: string,
        private readonly promptVersion = SYNTHESIS_PROMPT_VERSION,
        private readonly onTiming?: (timing: SynthesisTiming) => void) {}

    async analyze(packet: ArchitectureEvidencePacket): Promise<HierarchicalAnalysis> {
        validateArchitectureEvidencePacket(packet);
        const timings: SynthesisTiming[] = [];
        const record = (timing: SynthesisTiming): void => { timings.push(timing); this.onTiming?.(timing); };
        const capability = await this.provider.capabilities();
        const identity = `${this.providerIdentity}:${capability.modelLabel}`;
        const run = async (stage: SynthesisStage, context: SynthesisStageContext) => {
            const start = performance.now();
            const plan = await planArchitectureEvidence(packet, stage, context, capability, this.provider);
            record({ operation: 'planning', stage, subject: context.subjectSystemKey ?? undefined,
                durationMs: performance.now() - start, reused: false });
            const executed = await this.cache.run(plan.request, packet, this.provider, identity, this.promptVersion);
            record({ operation: stage === 'verification' ? 'verification-call' : 'stage-call', stage,
                subject: context.subjectSystemKey ?? undefined, durationMs: executed.durationMs, reused: executed.reused });
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
        const subtrees: SubsystemDiscoveryResult[] = [];
        // Serial is the safe default; P5's separately exported scheduler retains explicit provider concurrency support.
        for (const system of systems) {
            const pass = await run('subsystem-discovery', context(systems, [], system.candidateKey));
            subtrees.push(pass.result as SubsystemDiscoveryResult);
        }
        const structural = detectReconciliationConflicts(packet, systems, subtrees);
        const reconciliation: ReconciliationResult = structural.length || systems.some(system => system.uncertainty.length) ||
            subtrees.some(tree => tree.subdivisionAssessment.uncertainty.length || tree.nodes.some(node => node.uncertainty.length))
            ? (await run('reconciliation', context(systems, subtrees))).result as ReconciliationResult
            : { schemaVersion: 1, stageVersion: SYNTHESIS_STAGE_VERSION, parentPacketFingerprint: packet.inputFingerprint,
                viewId: 'deterministic:no-conflicts', stage: 'reconciliation' as const, findings: [], unresolvedCandidateKeys: [] };
        const findings = [...structural, ...reconciliation.findings];
        const pendingFindings = findings.filter(item => item.status !== 'supported');
        const unresolved = unique([...reconciliation.unresolvedCandidateKeys,
            ...pendingFindings.flatMap(item => item.candidateKeys)]);
        const verifications: VerificationResult[] = [];
        const groups = pendingFindings.filter(item => item.candidateKeys.length <= MAX_VERIFICATION_TARGETS &&
            item.candidateKeys.some(key => unresolved.includes(key)))
            .slice(0, MAX_VERIFICATION_CALLS);
        for (const group of groups) {
            const targetKeys = new Set(group.candidateKeys);
            const scopedTrees = subtrees.filter(tree => tree.nodes.some(node => targetKeys.has(node.candidateKey)))
                .map(tree => ({ ...tree, nodes: tree.nodes.filter(node => targetKeys.has(node.candidateKey) ||
                    tree.nodes.some(child => targetKeys.has(child.candidateKey) && child.parentCandidateKey === node.candidateKey)) }));
            const scopedSystems = systems.filter(system => targetKeys.has(system.candidateKey) ||
                scopedTrees.some(tree => tree.systemKey === system.candidateKey));
            const verificationContext = { ...context(scopedSystems, scopedTrees, null, group.candidateKeys),
                boundaryQuestion: group.message };
            const checked = await run('verification', verificationContext);
            const verification = checked.result as VerificationResult;
            verifications.push(verification);
            if (verification.findings.length && verification.findings.every(item => item.status === 'supported') &&
                group.candidateKeys.every(key => verification.findings.some(item => item.candidateKeys.includes(key))))
                pendingFindings.splice(pendingFindings.indexOf(group), 1);
        }
        const unresolvedWithoutFinding = reconciliation.unresolvedCandidateKeys.filter(key =>
            !findings.some(item => item.candidateKeys.includes(key)));
        const finalReconciliation: ReconciliationResult = { ...reconciliation, findings: pendingFindings,
            unresolvedCandidateKeys: unique([...unresolvedWithoutFinding, ...pendingFindings.flatMap(item => item.candidateKeys)]) };
        const start = performance.now();
        const proposal = assembleArchitectureProposal({ parentPacketFingerprint: packet.inputFingerprint,
            summary: `Architecture proposal with ${systems.length} challenged System${systems.length === 1 ? '' : 's'}.`,
            systems, subtrees, reconciliation: finalReconciliation, verifications }, packet);
        record({ operation: 'assembly', durationMs: performance.now() - start, reused: false });
        return { proposal, timings, findings, verificationCalls: verifications.length };
    }
}
