import type { GenerationIdentity, GenerationPhase } from './roadmap-generation-controller';
import { RoadmapNativeStageOwner, type NativeStageSnapshot } from './roadmap-native-stage';

/** Translates one bounded controller Phase into the existing checked proposal owner. */
export class RoadmapGenerationNativeStage {
    private nextStage = 1;
    private readonly names = new Set<string>();
    constructor(private readonly owner: RoadmapNativeStageOwner,
        private readonly lease: string, private readonly identity: GenerationIdentity) {}

    private context() { return { root: this.identity.root, projectId: this.identity.projectId,
        chatId: this.identity.chatId, turnId: this.identity.turnId, lease: this.lease }; }

    validate(phase: GenerationPhase, identity: GenerationIdentity, signal: AbortSignal): boolean {
        if (signal.aborted || identity !== this.identity || !Number.isSafeInteger(phase.subcalls) ||
            phase.subcalls < 1 || phase.gates.length < 1 || phase.gates.length > 12) return false;
        const valid = (value: string) => typeof value === 'string' && !!value.trim() && value.length <= 2048 &&
            !/[\p{Cc}\p{Cf}]/u.test(value) && !/<\/?[a-z][^>]*>|javascript:|!\[[^\]]*\]\(https?:/iu.test(value);
        if (!valid(phase.title) || !valid(phase.objective) || this.names.has(phase.title.trim().toLowerCase())) return false;
        const gateNames = new Set<string>();
        for (const gate of phase.gates) {
            const name = gate.title.trim().toLowerCase();
            if (!valid(gate.title) || !valid(gate.purpose) || gateNames.has(name) ||
                gate.criteria.length < 1 || gate.criteria.length > 12) return false;
            gateNames.add(name);
            const criteriaNames = new Set<string>();
            for (const criterion of gate.criteria) {
                const criterionName = criterion.title.trim().toLowerCase();
                if (!valid(criterion.title) || !valid(criterion.expectedResult) ||
                    criteriaNames.has(criterionName)) return false;
                criteriaNames.add(criterionName);
            }
        }
        // One Phase create plus one Gate create per Gate; each batch is at most eight.
        return phase.subcalls === Math.ceil((phase.gates.length + 1) / 8);
    }

    async stage(phase: GenerationPhase, identity: GenerationIdentity, signal: AbortSignal): Promise<string> {
        if (!this.validate(phase, identity, signal)) throw new Error('ROADMAP_GENERATION_INVALID_PHASE');
        const phaseAlias = `new:p-${this.nextStage}`;
        const actions: Record<string, unknown>[] = [{ type: 'phase.create', id: phaseAlias,
            title: phase.title.trim(), objective: phase.objective.trim() }];
        phase.gates.forEach((gate, at) => actions.push({ type: 'gate.create', id: `new:g-${this.nextStage}-${at + 1}`,
            parentPhaseId: phaseAlias, designation: `G${at + 1}`, title: gate.title.trim(),
            purpose: gate.purpose.trim(), criteria: gate.criteria.map((criterion, criterionAt) => ({
                id: `new:c-${this.nextStage}-${at + 1}-${criterionAt + 1}`,
                title: criterion.title.trim(), expectedResult: criterion.expectedResult.trim() })) }));
        const existing = this.owner.get(identity.chatId);
        const proposalId = existing?.id;
        for (let offset = 0; offset < actions.length; offset += 8) {
            if (signal.aborted) throw new Error('ROADMAP_GENERATION_CANCELLED');
            const result = await this.owner.stage(this.context(), { version: 1,
                expectedRevision: identity.revision, expectedSourceHash: identity.sourceHash,
                expectedStage: this.nextStage, strategy: 'full', done: false,
                actions: actions.slice(offset, offset + 8) }) as { proposalId: string;
                    acceptedOperationIds: string[]; nextStage: number };
            if (signal.aborted || result.acceptedOperationIds.length !== Math.min(8, actions.length - offset) ||
                result.nextStage !== this.nextStage + 1 || proposalId && result.proposalId !== proposalId)
                throw new Error('ROADMAP_GENERATION_STAGE_CHANGED');
            this.nextStage++;
        }
        this.names.add(phase.title.trim().toLowerCase());
        return phase.title.trim().slice(0, 160);
    }

    async complete(identity: GenerationIdentity, signal: AbortSignal): Promise<boolean> {
        if (signal.aborted || identity !== this.identity) return false;
        await this.owner.finish(this.context(), identity.revision, identity.sourceHash);
        return true;
    }

    snapshot(): Promise<NativeStageSnapshot | undefined> { return this.owner.snapshot(this.context()); }
}
