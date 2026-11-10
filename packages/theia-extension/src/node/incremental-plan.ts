import { createHash } from 'node:crypto';
import type { ChatAssistantMessage, ChatPromptDraftIdentity } from '@dope/chat';
import { PromptDraftStore, planStepHash, type StoredPromptDraft } from './prompt-draft-store';
import { type AssessmentRead, type AssessmentWireframe, type PlanRecord, type PlanWorkRecord,
    validatedAssessmentFinding, validatedPlan, verifyPromptSourceRefs, requestedPaths } from './prompt-authoring-stage';
import type { ChatProjectGrounder } from './chat-project-grounder';

type Refs = NonNullable<ChatAssistantMessage['execution']['sourceRefs']>;
type Partial = NonNullable<StoredPromptDraft['partialPlan']>;
const json = (value: unknown): string => JSON.stringify(value);
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim() &&
    value.length <= 500 && !/[\u0000-\u001f\u007f]/u.test(value);
const strings = (value: unknown, min = 1): value is string[] => Array.isArray(value) &&
    value.length >= min && value.length <= 12 && value.every(text);
const refsFor = (root: string, refs: Refs): Partial['sourceRefs'] => {
    const projectId = createProjectId(root);
    return refs.filter(ref => ref.kind === 'file' && ref.origin === 'tool' && ref.sourceHash &&
        ref.projectId === projectId && ref.start !== undefined && ref.end !== undefined)
        .map(ref => ({ id: ref.id, sourceHash: ref.sourceHash!, projectId,
            ...(ref.contentHash ? { contentHash: ref.contentHash } : {}),
            start: ref.start, end: ref.end }));
};
function createProjectId(root: string): string {
    return createHash('sha256').update(root).digest('hex');
}
const publicRefs = (stored: Partial['sourceRefs']): Refs => stored.map(ref => ({ ...ref,
    schemaVersion: 1, kind: 'file', label: ref.id, origin: 'tool', estimatedTokens: 0 }));

/** One authorized Plan turn; each accepted record is committed by the existing draft owner. */
export class IncrementalPlan {
    constructor(private readonly store: PromptDraftStore, private readonly grounder: ChatProjectGrounder,
        private readonly root: string, private readonly identity: ChatPromptDraftIdentity,
        private readonly lease: string, private readonly assessment: AssessmentWireframe) {}

    private async current(): Promise<{ draft: StoredPromptDraft; partial: Partial }> {
        const draft = await this.store.read(this.root, this.identity, this.lease);
        if (!draft.assessment || draft.assessment.record.kind !== 'wireframe' ||
            json(draft.assessment.record) !== json(this.assessment))
            throw new Error('PLAN_STALE: Reviewed Assessment changed');
        return { draft, partial: draft.partialPlan ?? { assessmentHash: draft.assessment.contentHash,
            assessmentRevision: draft.assessment.revision, work: [], efficiencyAudit: Array(10).fill(null),
            sourceRefs: [] } };
    }

    async status(): Promise<object> {
        const { draft, partial } = await this.current();
        if (draft.plan) return { assessmentRevision: draft.assessment!.revision,
            assessmentHash: draft.assessment!.contentHash, expectedWorkCount: this.assessment.count,
            acceptedStepIds: draft.plan.record.work && Array.isArray(draft.plan.record.work) ?
                (draft.plan.record.work as PlanWorkRecord[]).map(step => step.id) : [],
            missingStepIds: [], closeoutReady: true, efficiencyReady: true, blocking: [],
            planRevision: draft.plan.revision, finishEligible: true,
            nextAction: 'Plan already sealed; use the checked Prompt Write handoff' };
        const missing = this.assessment.work.slice(partial.work.length).map(item => item.id);
        const efficiencyMissing = partial.efficiencyAudit.flatMap((item, index) => item === null ? [index + 1] : []);
        const eligible = !missing.length && !!partial.closeout && !efficiencyMissing.length;
        return { assessmentRevision: draft.assessment!.revision, assessmentHash: draft.assessment!.contentHash,
            expectedWorkCount: this.assessment.count, acceptedStepIds: partial.work.map(item => item.id),
            acceptedSteps: partial.work.map(item => ({ id: item.id, hash: planStepHash(item) })),
            missingStepIds: missing, closeoutReady: !!partial.closeout,
            efficiencyReady: efficiencyMissing.length === 0, missingEfficiencyGates: efficiencyMissing,
            blocking: eligible ? [] : [missing.length ? 'missing steps' : '',
                !partial.closeout ? 'missing closeout' : '', efficiencyMissing.length ? 'missing efficiency gates' : ''].filter(Boolean),
            planRevision: 0, finishEligible: eligible,
            nextAction: missing.length ? `Stage ${missing[0]}` : !partial.closeout ?
                'Stage the separate T3 closeout' : efficiencyMissing.length ?
                `Stage efficiency gate ${efficiencyMissing[0]}` : 'Call plan_finish' };
    }

    async stageStep(raw: unknown, refs: Refs, reads: readonly AssessmentRead[],
        replacementHash?: string): Promise<object> {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
            Buffer.byteLength(json(raw), 'utf8') > 12_000)
            throw new Error('PLAN_INVALID_STEP: Submit one bounded typed work step');
        const { draft, partial } = await this.current();
        if (draft.plan) throw new Error('PLAN_AUTHORITY: Current Plan is sealed; use a reviewed revision path');
        const item = raw as PlanWorkRecord;
        const index = this.assessment.work.findIndex(step => step.id === item.id);
        if (index < 0) throw new Error('PLAN_INVALID_STEP: Use an approved Assessment step ID');
        if (index < partial.work.length) {
            const accepted = partial.work[index];
            const rawAccepted = { ...accepted, sourceClaims: accepted.sourceClaims?.map(({ claim, path, quote }) =>
                ({ claim, path, quote })) };
            if (json(rawAccepted) === json(raw)) return { accepted: item.id, idempotent: true };
            if (!replacementHash || planStepHash(accepted) !== replacementHash)
                throw new Error('PLAN_CONFLICTING_REPLAY: Use plan_correct_step with the current checked step hash');
        }
        if (index !== partial.work.length && !replacementHash)
            throw new Error(`PLAN_INCOMPLETE: Stage ${this.assessment.work[partial.work.length].id} first`);
        const outline = this.assessment.work[index];
        if (item.title !== outline.title || item.assessmentObjective !== outline.objective ||
            item.boundary !== outline.boundary || json(item.dependsOn) !== json(outline.dependsOn))
            throw new Error('PLAN_INVALID_STEP: Preserve reviewed title, objective, boundary and dependencies');
        if (!text(item.objective) || !['T1', 'T2'].includes(item.tier) ||
            !/\b(?:implement|change|repair|wire|add|remove|integrate|validate)\b/iu.test(item.objective) ||
            !strings(item.workingSet) || !strings(item.requirements) || !strings(item.preservedBehavior) ||
            !strings(item.risks) || !strings(item.deferrals, 0) || !strings(item.validationTargets) ||
            !strings(item.acceptanceCriteria) || !text(item.buildNeeds) ||
            !Number.isSafeInteger(item.estimatedMinutes) || item.estimatedMinutes! < 1 ||
            item.tier === 'T1' && item.estimatedMinutes! > 8 ||
            !Array.isArray(item.sourceClaims) || item.sourceClaims.length < 1 || item.sourceClaims.length > 6)
            throw new Error('PLAN_INVALID_STEP: Supply detailed bounded requirements, evidence, validation and estimate');
        if (/\b(?:integration|cross.boundary)\b/iu.test(outline.boundary) && item.tier !== 'T2')
            throw new Error('PLAN_INVALID_STEP: Reviewed integration work needs T2');
        const currentRefs = refsFor(this.root, refs);
        const paths = new Set(currentRefs.map(ref => ref.id));
        if (item.workingSet.some(path => !paths.has(path)) ||
            !item.validationTargets.flatMap(target => requestedPaths(target)).length ||
            item.validationTargets.flatMap(target => requestedPaths(target)).some(path => !paths.has(path)))
            throw new Error('PLAN_UNSUPPORTED_SOURCE: Read each working file and validation target in this Plan turn');
        const claims = item.sourceClaims.map(({ claim, path, quote }) =>
            validatedAssessmentFinding({ claim, path, quote }, 'observations', refs, reads));
        if (claims.some(claim => !paths.has(claim.path)))
            throw new Error('PLAN_UNSUPPORTED_SOURCE: Claim needs a brokered read in this Plan turn');
        const cited = new Set(claims.map(claim => claim.path));
        if (/\b(?:CI pipeline|CommonJS|browser demo|npm install|new dependency)\b/iu.test(
            [item.title, item.objective, item.buildNeeds, ...item.requirements].join(' ')) &&
            !claims.some(claim => /(?:package\.json|\.github\/workflows\/|\.ya?ml$)/u.test(claim.path)))
            throw new Error('PLAN_UNSUPPORTED_SOURCE: Project configuration claim needs a brokered configuration read');
        for (const path of requestedPaths([item.objective, ...item.requirements,
            ...item.preservedBehavior, ...item.risks, ...item.deferrals!, item.buildNeeds,
            ...item.acceptanceCriteria].join(' '))) if (!cited.has(path))
            throw new Error(`PLAN_UNSUPPORTED_SOURCE: ${path} needs a verified source claim`);
        const merged = [...partial.sourceRefs];
        for (const ref of currentRefs) if (!merged.some(old => json(old) === json(ref))) merged.push(ref);
        const checked = { ...item, sourceClaims: claims };
        const work = replacementHash ? partial.work.map((old, i) => i === index ? checked : old) :
            [...partial.work, checked];
        const next = { ...partial, work, sourceRefs: merged };
        if (replacementHash)
            await this.store.correctPartialPlanStep(this.root, this.identity, this.lease,
                draft.revision, index, replacementHash, next);
        else await this.store.updatePartialPlan(this.root, this.identity, this.lease, draft.revision, next);
        return { accepted: item.id, idempotent: false,
            ...(replacementHash ? { corrected: true } : {}),
            remaining: this.assessment.count - next.work.length };
    }

    async correctStep(raw: unknown, refs: Refs, reads: readonly AssessmentRead[]): Promise<object> {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
            Object.keys(raw).sort().join(',') !== 'expectedHash,step')
            throw new Error('PLAN_INVALID_STEP: Supply {expectedHash,step}');
        const value = raw as { expectedHash: unknown; step: unknown };
        if (typeof value.expectedHash !== 'string' || !/^[a-f0-9]{64}$/u.test(value.expectedHash))
            throw new Error('PLAN_INVALID_STEP: Use the current accepted step hash from plan_status');
        return this.stageStep(value.step, refs, reads, value.expectedHash);
    }

    async stageCloseout(raw: unknown): Promise<object> {
        const { draft, partial } = await this.current();
        if (draft.plan) throw new Error('PLAN_AUTHORITY: Current Plan is sealed; use a reviewed revision path');
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Buffer.byteLength(json(raw), 'utf8') > 4_000)
            throw new Error('PLAN_INVALID_CLOSEOUT: Supply one bounded manual closeout');
        const item = raw as PlanRecord['closeout'];
        if (item.title !== this.assessment.closeout.title || item.objective !== this.assessment.closeout.objective ||
            item.tier !== 'T3' || item.browserRequired !== true || !text(item.manualReason) ||
            !strings(item.acceptanceCriteria))
            throw new Error('PLAN_INVALID_CLOSEOUT: Preserve the reviewed separate T3 manual closeout');
        if (partial.closeout) {
            if (json(partial.closeout) === json(item)) return { accepted: true, idempotent: true };
            throw new Error('PLAN_CONFLICTING_REPLAY: Closeout already accepted');
        }
        await this.store.updatePartialPlan(this.root, this.identity, this.lease, draft.revision,
            { ...partial, closeout: item });
        return { accepted: true, idempotent: false };
    }

    async stageEfficiency(raw: unknown): Promise<object> {
        const { draft, partial } = await this.current();
        if (draft.plan) throw new Error('PLAN_AUTHORITY: Current Plan is sealed; use a reviewed revision path');
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
            Object.keys(raw).sort().join(',') !== 'finding,index')
            throw new Error('PLAN_INVALID_EFFICIENCY: Supply {index,finding}');
        const { index, finding } = raw as { index: number; finding: unknown };
        if (!Number.isSafeInteger(index) || index < 1 || index > 10 || !text(finding))
            throw new Error('PLAN_INVALID_EFFICIENCY: Use gate 1–10 and a bounded finding');
        const gates = [/responsib|boundary/iu, /8.{0,30}10.{0,30}15|runtime|minute/iu,
            /test|validation/iu, /build|compil|lib\//iu, /evidence|integration|T2|T3/iu,
            /dedup|repeat|aggregate/iu, /model|deferr/iu, /runnable|trace|grammar|version/iu,
            /(?:UI design|ADR 0016|non-UI).*(?:theme|token|not applicable)|(?:theme|token).*(?:UI design|ADR 0016)/iu,
            /(?:human usability|ADR 0037|non-UI).*(?:keyboard|recovery|entry|not applicable)|(?:keyboard|recovery).*(?:human usability|ADR 0037)/iu];
        if (!gates[index - 1].test(finding))
            throw new Error(`PLAN_INVALID_EFFICIENCY: Finding ${index} does not match its workflow gate`);
        const old = partial.efficiencyAudit[index - 1];
        if (old !== null) {
            if (old === finding) return { accepted: index, idempotent: true };
            throw new Error('PLAN_CONFLICTING_REPLAY: Efficiency finding already accepted');
        }
        const audit = [...partial.efficiencyAudit]; audit[index - 1] = finding;
        await this.store.updatePartialPlan(this.root, this.identity, this.lease, draft.revision,
            { ...partial, efficiencyAudit: audit });
        return { accepted: index, idempotent: false };
    }

    async finish(): Promise<{ record: PlanRecord; saved: StoredPromptDraft }> {
        const { draft, partial } = await this.current();
        if (draft.plan && draft.plan.dependencyHash === draft.assessment!.contentHash)
            return { record: draft.plan.record as unknown as PlanRecord, saved: draft };
        if (partial.work.length !== this.assessment.count || !partial.closeout ||
            partial.efficiencyAudit.some(item => item === null))
            throw new Error('PLAN_INCOMPLETE: Complete every reviewed step, T3 closeout and ten efficiency gates');
        const refs = publicRefs(partial.sourceRefs);
        await verifyPromptSourceRefs(this.root, refs, this.grounder);
        const reads: AssessmentRead[] = [];
        for (const ref of partial.sourceRefs) {
            if (ref.start === undefined || ref.end === undefined || ref.end - ref.start > 4096) continue;
            const page = await this.grounder.readFileRange(this.root, ref.id, ref.start,
                Math.max(1, ref.end - ref.start), ref.start ? ref.sourceHash : undefined);
            if (page.sourceHash !== ref.sourceHash || page.endOffset !== ref.end)
                throw new Error('PLAN_STALE: Source changed after staging');
            reads.push({ path: ref.id, start: ref.start, end: ref.end, sourceHash: ref.sourceHash,
                text: page.text });
        }
        const work = partial.work.map(step => ({ ...step, sourceClaims: step.sourceClaims?.map(
            ({ claim, path, quote }) => ({ claim, path, quote })) }));
        const record = validatedPlan(json({ work, closeout: partial.closeout,
            efficiencyAudit: partial.efficiencyAudit }), this.assessment, refs,
            this.assessment.count, reads);
        const saved = await this.store.stage(this.root, this.identity, this.lease, 'plan', draft.revision,
            record as unknown as Record<string, unknown>, partial.sourceRefs);
        return { record, saved };
    }
}
