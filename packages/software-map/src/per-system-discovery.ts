import type { ArchitectureEvidencePacket } from './synthesis';
import { planArchitectureEvidence } from './evidence-planner';
import type { EvidencePlan } from './evidence-planner';
import { parseSynthesisStageResult, usableEvidenceTokens } from './hierarchical-synthesis';
import type { SubsystemDiscoveryResult, SynthesisProvider, SynthesisStageContext, SystemCandidate,
    SystemChallengeResult } from './hierarchical-synthesis';

export interface PerSystemDiscovery {
    systems: SystemCandidate[];
    passes: { plan: EvidencePlan; result: SubsystemDiscoveryResult }[];
    /** Direct fact claimed by nodes in separate Systems. P6 must resolve these claims. */
    ownershipConflicts: { evidenceRef: string; systemKeys: string[]; candidateKeys: string[] }[];
}

/** One bounded model pass per challenged System. No ownership becomes canonical here. */
export async function discoverPerSystemSubtrees(packet: ArchitectureEvidencePacket,
    challenge: { plan: EvidencePlan; result: SystemChallengeResult; systems: SystemCandidate[] },
    provider: SynthesisProvider): Promise<PerSystemDiscovery> {
    if (challenge.plan.request.stage !== 'system-challenge') throw new Error('Per-System discovery requires System Challenge');
    const verified = parseSynthesisStageResult(challenge.result, challenge.plan.request, packet) as SystemChallengeResult;
    const systems = verified.decisions.flatMap(decision => decision.systems);
    if (JSON.stringify(systems) !== JSON.stringify(challenge.systems)) throw new Error('Challenged System set changed');
    const capability = await provider.capabilities();
    usableEvidenceTokens(capability);
    const concurrency = capability.maxConcurrentGenerations ?? 1;
    const passes = new Array<{ plan: EvidencePlan; result: SubsystemDiscoveryResult }>(systems.length);
    let next = 0;
    let stopped = false;
    const settled = await Promise.allSettled(Array.from({ length: Math.min(concurrency, systems.length) }, async () => {
        while (!stopped && next < systems.length) {
            const index = next++;
            try {
                const context: SynthesisStageContext = { systems, subjectSystemKey: systems[index].candidateKey,
                    subtrees: [], targetCandidateKeys: [] };
                const plan = await planArchitectureEvidence(packet, 'subsystem-discovery', context, capability, provider);
                const raw = await provider.runStage(plan.request);
                const result = parseSynthesisStageResult(raw.output, plan.request, packet) as SubsystemDiscoveryResult;
                passes[index] = { plan, result };
            } catch (error) { stopped = true; throw error; }
        }
    }));
    const failure = settled.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
    const keys = systems.map(system => system.candidateKey);
    const claims = new Map<string, { systemKeys: Set<string>; candidateKeys: Set<string> }>();
    for (const pass of passes) for (const node of pass.result.nodes) {
        if (keys.includes(node.candidateKey)) throw new Error('Duplicate cross-System candidate identity');
        keys.push(node.candidateKey);
        for (const ref of node.ownershipEvidenceRefs) {
            const claim = claims.get(ref) ?? { systemKeys: new Set<string>(), candidateKeys: new Set<string>() };
            claim.systemKeys.add(pass.result.systemKey);
            claim.candidateKeys.add(node.candidateKey);
            claims.set(ref, claim);
        }
    }
    const ownershipConflicts = [...claims].filter(([, claim]) => claim.systemKeys.size > 1)
        .map(([evidenceRef, claim]) => ({ evidenceRef, systemKeys: [...claim.systemKeys].sort(),
            candidateKeys: [...claim.candidateKeys].sort() })).sort((a, b) => a.evidenceRef.localeCompare(b.evidenceRef));
    return { systems, passes, ownershipConflicts };
}
