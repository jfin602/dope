import type { ArchitectureEvidencePacket } from './synthesis';
import { planArchitectureEvidence } from './evidence-planner';
import { parseSynthesisStageResult } from './hierarchical-synthesis';
import type { EvidencePlan } from './evidence-planner';
import type { SynthesisProvider, SynthesisStageContext, SystemDiscoveryResult } from './hierarchical-synthesis';

/** First reasoning pass. The provider sees only the planned global view; the parent packet stays here. */
export async function discoverCandidateSystems(packet: ArchitectureEvidencePacket,
    provider: SynthesisProvider): Promise<{ plan: EvidencePlan; result: SystemDiscoveryResult }> {
    const context: SynthesisStageContext = { systems: [], subjectSystemKey: null, subtrees: [], targetCandidateKeys: [] };
    const plan = await planArchitectureEvidence(packet, 'system-discovery', context,
        await provider.capabilities(), provider);
    const response = await provider.runStage(plan.request);
    const result = parseSynthesisStageResult(response, plan.request, packet);
    return { plan, result: result as SystemDiscoveryResult };
}
