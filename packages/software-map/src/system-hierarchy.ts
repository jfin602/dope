import type { ArchitectureEvidencePacket } from './synthesis';
import { planArchitectureEvidence } from './evidence-planner';
import type { EvidencePlan } from './evidence-planner';
import { parseSynthesisStageResult } from './hierarchical-synthesis';
import type { ComponentDiscoveryResult, SubsystemCandidate, SubsystemChallengeResult, SubsystemDiscoveryResult,
    SynthesisProvider, SynthesisStageContext, SystemCandidate, SystemChallengeResult, SystemSubtree } from './hierarchical-synthesis';

const context = (systems: SystemCandidate[], systemKey: string, subsystems: SubsystemCandidate[] = [],
    subsystemKey: string | null = null, challengedBy?: SubsystemChallengeResult): SynthesisStageContext => ({ systems,
    subjectSystemKey: systemKey, subsystems, subjectSubsystemKey: subsystemKey, subtrees: [], targetCandidateKeys: [],
    ...(challengedBy ? { challengedBy } : {}) });

async function call(packet: ArchitectureEvidencePacket, provider: SynthesisProvider,
    stage: 'subsystem-discovery' | 'subsystem-challenge' | 'component-discovery', scope: SynthesisStageContext) {
    const plan = await planArchitectureEvidence(packet, stage, scope, await provider.capabilities(), provider);
    const raw = await provider.runStage(plan.request);
    return { plan, result: parseSynthesisStageResult(raw.output, plan.request, packet) };
}

/** Bounded primitives for one challenged System; no candidate becomes canonical. */
export async function discoverSystemHierarchy(packet: ArchitectureEvidencePacket,
    challengeInput: { plan: EvidencePlan; result: SystemChallengeResult },
    systemKey: string, provider: SynthesisProvider): Promise<{ discovery: { plan: EvidencePlan; result: SubsystemDiscoveryResult };
        challenge: { plan: EvidencePlan; result: SubsystemChallengeResult };
        components: { plan: EvidencePlan; result: ComponentDiscoveryResult }[]; tree: SystemSubtree }> {
    if (challengeInput.plan.request.stage !== 'system-challenge') throw new Error('Subsystem Discovery requires System Challenge');
    const verified = parseSynthesisStageResult(challengeInput.result, challengeInput.plan.request, packet) as SystemChallengeResult;
    const systems = verified.decisions.flatMap(decision => decision.systems);
    if (!systems.some(system => system.candidateKey === systemKey)) throw new Error('Subsystem Discovery requires challenged System');
    const discovery = await call(packet, provider, 'subsystem-discovery', context(systems, systemKey)) as
        { plan: EvidencePlan; result: SubsystemDiscoveryResult };
    const challenge = await call(packet, provider, 'subsystem-challenge',
        context(systems, systemKey, discovery.result.subsystems)) as { plan: EvidencePlan; result: SubsystemChallengeResult };
    const subsystems = [...challenge.result.decisions.flatMap(decision => decision.subsystems),
        ...(challenge.result.recovered ?? []).map(item => item.subsystem)];
    const components: { plan: EvidencePlan; result: ComponentDiscoveryResult }[] = [];
    for (const subsystem of subsystems) {
        components.push(await call(packet, provider, 'component-discovery',
            context(systems, systemKey, subsystems, subsystem.candidateKey, challenge.result)) as
            { plan: EvidencePlan; result: ComponentDiscoveryResult });
    }
    return { discovery, challenge, components, tree: { systemKey,
        nodes: [...subsystems, ...components.flatMap(pass => pass.result.components)] } };
}
