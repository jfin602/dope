import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { UntrustedTypedRoadmapCandidate } from './roadmap-local-model';
import { RoadmapNativeStageOwner, type NativeRoadmapStage } from './roadmap-native-stage';

type Context = { root: string; projectId: string; chatId: string; turnId: string; lease: string };
type Basis = { expectedRevision: number; expectedSourceHash: string | null };

/** Translate content only. The native stage owner assigns durable IDs and owns all review authority. */
export async function stageTypedRoadmapDraft(owner: RoadmapNativeStageOwner, context: Context,
    candidate: UntrustedTypedRoadmapCandidate, assertActive: () => void = () => {}): Promise<NativeRoadmapStage> {
    assertActive();
    if (candidate.kind !== 'untrusted-typed-roadmap-draft' || candidate.draft.type !== 'roadmap-draft' ||
        candidate.draft.schemaVersion !== 1) throw new Error('ROADMAP_TYPED_CANDIDATE_INVALID');
    const read = await owner.read(context, { version: 1 }) as { revision: number; projectId: string;
        link: unknown; stage: unknown; stageBasis: Basis };
    if (read.revision !== 0 || read.projectId !== context.projectId || read.link || read.stage)
        throw new Error('ROADMAP_TYPED_OWNER_NOT_EMPTY: start a fresh protected Roadmap turn');
    const actions: Record<string, unknown>[] = [];
    for (const [phaseAt, phase] of candidate.draft.phases.entries()) {
        const phaseAlias = `new:p${phaseAt + 1}`;
        actions.push({ type: 'phase.create', id: phaseAlias, title: phase.title, objective: phase.objective });
        if (phase.dependsOn?.length) actions.push({ type: 'phase.dependencies', id: phaseAlias,
            dependencies: phase.dependsOn.map(position => `new:p${position}`) });
        for (const [gateAt, gate] of phase.gates.entries()) actions.push({ type: 'gate.create',
            id: `new:g${phaseAt + 1}-${gateAt + 1}`, parentPhaseId: phaseAlias,
            designation: `G${gateAt + 1}`, title: gate.title, purpose: gate.purpose,
            criteria: gate.criteria.map((criterion, criterionAt) => ({
                id: `new:c${phaseAt + 1}-${gateAt + 1}-${criterionAt + 1}`,
                title: criterion.title, expectedResult: criterion.expectedResult })) });
    }
    if (!actions.length || actions.length > 48) throw new Error('ROADMAP_TYPED_OPERATION_LIMIT');
    let offset = 0, sequence = 1;
    try {
        while (offset < actions.length) {
            assertActive();
            const batch: Record<string, unknown>[] = [];
            while (offset + batch.length < actions.length && batch.length < 8) {
                const next = [...batch, actions[offset + batch.length]];
                const request = { version: 1, expectedRevision: read.stageBasis.expectedRevision,
                    expectedSourceHash: read.stageBasis.expectedSourceHash,
                    expectedStage: sequence, strategy: 'full', done: offset + next.length === actions.length,
                    actions: next };
                if (Buffer.byteLength(JSON.stringify(request), 'utf8') > 16_000) break;
                batch.push(actions[offset + batch.length]);
            }
            if (!batch.length) throw new Error(`ROADMAP_TYPED_BATCH_TOO_LARGE_${offset}`);
            await owner.stage(context, { version: 1, expectedRevision: read.stageBasis.expectedRevision,
                expectedSourceHash: read.stageBasis.expectedSourceHash, expectedStage: sequence++, strategy: 'full',
                done: offset + batch.length === actions.length, actions: batch });
            offset += batch.length;
        }
        assertActive();
        const { stage, after } = await owner.complete(context);
        const expectedPhases = candidate.draft.phases.length;
        const expectedGates = candidate.draft.phases.reduce((count, phase) => count + phase.gates.length, 0);
        const expectedCriteria = candidate.draft.phases.reduce((count, phase) => count +
            phase.gates.reduce((gateCount, gate) => gateCount + gate.criteria.length, 0), 0);
        if (after.phases.length !== expectedPhases || after.gates.length !== expectedGates ||
            after.gates.reduce((count, gate) => count + gate.criteria.length, 0) !== expectedCriteria)
            throw new Error('ROADMAP_TYPED_COUNT_MISMATCH');
        return stage;
    } catch (error) {
        owner.forget(context.chatId);
        throw error;
    }
}

export function typedRoadmapCounts(index: RoadmapGateIndex): { phases: number; gates: number; criteria: number } {
    return { phases: index.phases.length, gates: index.gates.length,
        criteria: index.gates.reduce((count, gate) => count + gate.criteria.length, 0) };
}
