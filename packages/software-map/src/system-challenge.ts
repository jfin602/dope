import type { ArchitectureEvidencePacket } from './synthesis';
import { planArchitectureEvidence } from './evidence-planner';
import type { EvidencePlan } from './evidence-planner';
import { parseSynthesisStageResult } from './hierarchical-synthesis';
import type { SynthesisProvider, SynthesisStageContext, SystemCandidate, SystemChallengeResult,
    SystemDiscoveryResult } from './hierarchical-synthesis';

export interface ChallengedSystemMapping {
    sourceCandidateKey: string;
    action: 'keep' | 'merge' | 'split' | 'reject';
    challengedSystemKeys: string[];
}

/** P3 is validated against its original view before it can become challenge context. */
export async function challengeCandidateSystems(packet: ArchitectureEvidencePacket,
    discovery: { plan: EvidencePlan; result: SystemDiscoveryResult }, provider: SynthesisProvider):
    Promise<{ plan: EvidencePlan; result: SystemChallengeResult; systems: SystemCandidate[]; mapping: ChallengedSystemMapping[] }> {
    if (discovery.plan.request.stage !== 'system-discovery') throw new Error('System Challenge requires System Discovery');
    const verified = parseSynthesisStageResult(discovery.result, discovery.plan.request, packet) as SystemDiscoveryResult;
    const context: SynthesisStageContext = { systems: verified.systems, subjectSystemKey: null,
        subtrees: [], targetCandidateKeys: [] };
    const plan = await planArchitectureEvidence(packet, 'system-challenge', context,
        await provider.capabilities(), provider);
    const response = await provider.runStage(plan.request);
    const result = parseSynthesisStageResult(response, plan.request, packet) as SystemChallengeResult;
    return { plan, result, systems: result.decisions.flatMap(decision => decision.systems),
        mapping: result.decisions.flatMap(decision => decision.sourceKeys.map(sourceCandidateKey => ({
            sourceCandidateKey, action: decision.action,
            challengedSystemKeys: decision.systems.map(system => system.candidateKey),
        }))) };
}
