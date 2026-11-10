import type { ChatAssistantMessage, ChatPromptStackProposal } from '@dope/chat';
import type { ComposeStackInput, WorkPromptChoice, CloseoutChoice } from '@dope/agent-core/lib/phase-stack-composer';
import type { ProposalDomainHandler, ProposalSnapshot, ProposalStage } from './incremental-proposal-controller';
import { composeSavedPromptStack, isAssessmentWireframe, requestedPaths, verifyPromptDraftSource, type AssessmentRecord,
    type PlanRecord } from './prompt-authoring-stage';
import { capturePromptSourceEvidence, createPromptStackProposal } from './prompt-stack-proposal';
import type { ChatProjectGrounder } from './chat-project-grounder';

type Work = { kind: 'work'; id: string; title: string; objective: string; tier: 'T1' | 'T2';
    dependsOn?: string[]; workingSet: string[]; requirements?: string[]; constraints?: string[];
    acceptanceCriteria: string[]; validationTargets: string[]; integrationChecks?: string[];
    model?: WorkPromptChoice['model']; estimatedMinutes?: number };
type Section = { kind: 'section'; heading: string; text: string };
type Closeout = { kind: 'closeout'; title: string; objective: string; manualReason: string;
    acceptanceCriteria: string[]; browserRequired: boolean; model?: CloseoutChoice['model'];
    efficiencyAudit: string[] };
const parse = (content: string): Work | Section | Closeout => {
    let value: unknown;
    try { value = JSON.parse(content); } catch { throw new Error('PROMPT_STAGE_JSON'); }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PROMPT_STAGE_SHAPE');
    return value as Work | Section | Closeout;
};
const identifier = (id: unknown): id is string => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/u.test(id);
const strings = (value: unknown, required = true): value is string[] => Array.isArray(value) &&
    value.length <= 12 && (!required || value.length > 0) && value.every(item =>
        typeof item === 'string' && !!item.trim() && item.length <= 500 && !/[\r\n\u0000-\u001f\u007f]/u.test(item));
const field = (value: unknown): value is string => typeof value === 'string' &&
    !!value.trim() && value.length <= 500 && !/[\r\n\u0000-\u001f\u007f]/u.test(value);
const keys = (value: object, allowed: string[], required: string[]): boolean =>
    Object.keys(value).every(key => allowed.includes(key)) && required.every(key => key in value);

/** Pure stage validation plus exact R3B proposal construction; publication remains with Accept. */
export class IncrementalPromptStack implements ProposalDomainHandler<ChatPromptStackProposal> {
    constructor(private readonly root: string, private readonly folder: string,
        private readonly sourceVersion: string, private readonly prior: {
            assessment: ChatAssistantMessage; plan: ChatAssistantMessage },
        private readonly grounder: ChatProjectGrounder, private readonly revision: number,
        private readonly expectedSource: { head: string; worktreeFingerprint: string },
        private readonly requestedWorkCount?: number,
        private readonly selected?: { assessment: AssessmentRecord; plan: PlanRecord }) {}

    readyForFinish(snapshot: Readonly<ProposalSnapshot>): { ready: boolean; nextAction?: string } {
        const count = new Set(snapshot.stages.map(stage => stage.target).filter(target => target !== 'closeout')).size;
        const required = this.selected?.plan.work.length ?? this.requestedWorkCount;
        return required && count !== required ?
            { ready: false, nextAction: `Stage ${required - count} remaining requested work prompts before closeout.` } :
            { ready: true };
    }

    async validateStage(snapshot: Readonly<ProposalSnapshot>, stage: Readonly<ProposalStage>): Promise<void> {
        const value = parse(stage.content);
        const prior = snapshot.stages.filter(item => item.target === stage.target);
        if (stage.target === 'closeout') {
            if (this.readyForFinish(snapshot).ready === false)
                throw new Error('PROPOSAL_PROMPT_WORK_COUNT');
            if (prior.length || !snapshot.stages.length || !snapshot.stages.at(-1)?.complete ||
                stage.chunkIndex !== 0 || !stage.complete || value.kind !== 'closeout' ||
                !keys(value, ['kind', 'title', 'objective', 'manualReason', 'acceptanceCriteria', 'browserRequired', 'model', 'efficiencyAudit'],
                    ['kind', 'title', 'objective', 'manualReason', 'acceptanceCriteria', 'browserRequired', 'efficiencyAudit']) ||
                !field(value.title) || !field(value.objective) || !field(value.manualReason) ||
                !strings(value.acceptanceCriteria) || value.browserRequired !== true ||
                !Array.isArray(value.efficiencyAudit) || value.efficiencyAudit.length !== 10 ||
                value.efficiencyAudit.some(item => !field(item) || item.trim().length < 20) ||
                new Set(value.efficiencyAudit.map(item => item.toLowerCase().replace(/\b(?:gate|check|finding)\s*\d+\b/gu, '')
                    .replace(/\s+/gu, ' ').trim())).size !== 10)
                throw new Error('PROMPT_CLOSEOUT_STAGE');
            const planned = this.selected?.plan.closeout;
            if (planned && (value.title !== planned.title || value.objective !== planned.objective ||
                value.manualReason !== planned.manualReason ||
                JSON.stringify(value.acceptanceCriteria) !== JSON.stringify(planned.acceptanceCriteria) ||
                JSON.stringify(value.efficiencyAudit) !== JSON.stringify(this.selected!.plan.efficiencyAudit) ||
                value.model !== undefined && value.model !== 'GPT-6 Sol High'))
                throw new Error('PROMPT_CLOSEOUT_PLAN_MISMATCH');
            return;
        }
        if (!identifier(stage.target) || snapshot.stages.some(item => item.target === 'closeout'))
            throw new Error('PROMPT_ORDER');
        if (!prior.length) {
            if (stage.chunkIndex !== 0 || value.kind !== 'work' || value.id !== stage.target ||
                !keys(value, ['kind', 'id', 'title', 'objective', 'tier', 'dependsOn', 'workingSet',
                    'requirements', 'constraints', 'acceptanceCriteria', 'validationTargets',
                    'integrationChecks', 'model', 'estimatedMinutes'],
                    ['kind', 'id', 'title', 'objective', 'tier', 'workingSet', 'acceptanceCriteria', 'validationTargets']) ||
                !field(value.title) || !field(value.objective) || !['T1', 'T2'].includes(value.tier) ||
                !strings(value.dependsOn ?? [], false) || !strings(value.workingSet) ||
                !strings(value.requirements ?? [], false) || !strings(value.constraints ?? [], false) ||
                !strings(value.acceptanceCriteria) || !strings(value.validationTargets) ||
                !strings(value.integrationChecks ?? [], value.tier === 'T2') ||
                (value.estimatedMinutes !== undefined && (!Number.isInteger(value.estimatedMinutes) ||
                    value.estimatedMinutes < 1 || value.estimatedMinutes > 15)))
                throw new Error('PROMPT_WORK_STAGE');
            const planned = this.selected?.plan.work[new Set(snapshot.stages.map(item => item.target)).size];
            if (this.selected && (!planned || stage.target !== planned.id ||
                value.title !== planned.title || value.objective !== planned.objective ||
                value.tier !== planned.tier ||
                JSON.stringify(value.dependsOn ?? []) !== JSON.stringify(planned.dependsOn) ||
                JSON.stringify(value.workingSet) !== JSON.stringify(planned.workingSet) ||
                JSON.stringify(value.requirements ?? []) !== JSON.stringify(planned.requirements ?? []) ||
                (value.constraints?.length ?? 0) !== 0 ||
                JSON.stringify(value.acceptanceCriteria) !== JSON.stringify(planned.acceptanceCriteria) ||
                JSON.stringify(value.validationTargets) !== JSON.stringify(planned.validationTargets) ||
                value.estimatedMinutes !== undefined && value.estimatedMinutes !== planned.estimatedMinutes ||
                value.model !== undefined && value.model !== (planned.tier === 'T2' ? 'GPT-6 Sol High' : 'GPT-6 Sol Medium') ||
                value.tier === 'T2' && JSON.stringify(value.integrationChecks) !==
                    JSON.stringify(planned.validationTargets)))
                throw new Error('PROMPT_WORK_PLAN_MISMATCH');
            const completed = new Set(snapshot.stages.filter(item => item.complete).map(item => item.target));
            if (snapshot.stages.length && !snapshot.stages.at(-1)!.complete ||
                (value.dependsOn ?? []).some(id => id === stage.target || !completed.has(id)))
                throw new Error('PROMPT_DEPENDENCY_ORDER');
        } else {
            if (value.kind !== 'section' || !keys(value, ['kind', 'heading', 'text'], ['kind', 'heading', 'text']) ||
                !field(value.heading) || typeof value.text !== 'string' || !value.text.trim() ||
                value.text.length > 8_000 || /[\u0000-\u0008\u000b-\u001f\u007f]/u.test(value.text))
                throw new Error('PROMPT_SECTION_STAGE');
            if (snapshot.stages.at(-1)?.target !== stage.target) throw new Error('PROMPT_SECTION_ORDER');
            const planned = this.selected?.plan.work.find(item => item.id === stage.target);
            if (planned) {
                const allowed = new Set([...planned.workingSet,
                    ...planned.validationTargets.flatMap(target => requestedPaths(target))]);
                if (requestedPaths(value.text).some(path => !allowed.has(path)))
                    throw new Error('PROMPT_SECTION_PLAN_MISMATCH: Revise the checked Plan for new files or tests');
            }
        }
    }

    async preview(snapshot: Readonly<ProposalSnapshot>): Promise<{ target: string; path: string;
        original: null; proposed: string }[]> {
        const groups = new Map<string, string[]>();
        for (const stage of snapshot.stages) {
            const parts = groups.get(stage.target) ?? [];
            const value = parse(stage.content);
            parts.push(value.kind === 'section' ? `${value.heading}\n\n${value.text}` :
                JSON.stringify(value, null, 2));
            groups.set(stage.target, parts);
        }
        return [...groups].map(([target, parts]) => ({ target,
            path: `staging/${target}.txt`, original: null,
            proposed: `Provisional prompt stage · ${target}\nFinal composed file is available only after finish.\n\n${parts.join('\n\n')}` }));
    }

    async validateComplete(snapshot: Readonly<ProposalSnapshot>): Promise<ChatPromptStackProposal> {
        const groups = new Map<string, (Work | Section | Closeout)[]>();
        for (const stage of snapshot.stages) {
            const values = groups.get(stage.target) ?? [];
            values.push(parse(stage.content)); groups.set(stage.target, values);
        }
        if (groups.size < 2 || groups.size > 49 || [...groups.keys()].at(-1) !== 'closeout')
            throw new Error('PROMPT_INCOMPLETE_STACK');
        if ((this.selected?.plan.work.length ?? this.requestedWorkCount) &&
            groups.size - 1 !== (this.selected?.plan.work.length ?? this.requestedWorkCount))
            throw new Error('PROPOSAL_PROMPT_WORK_COUNT');
        const closeout = groups.get('closeout')![0] as Closeout;
        const work: WorkPromptChoice[] = [...groups.entries()].slice(0, -1).map(([id, values], index) => {
            const meta = values[0] as Work;
            const planned = this.selected?.plan.work[index];
            const planDetails: Section[] = planned ? [
                { kind: 'section', heading: 'Reviewed boundary', text: [planned.assessmentObjective,
                    planned.boundary].filter(Boolean).map(v => `- ${v}`).join('\n') || '- Use the checked Plan boundary' },
                { kind: 'section', heading: 'Preserved behavior', text: planned.preservedBehavior?.map(v => `- ${v}`).join('\n') || '- Keep existing behavior' },
                { kind: 'section', heading: 'Risks', text: planned.risks?.map(v => `- ${v}`).join('\n') || '- Check affected behavior' },
                { kind: 'section', heading: 'Deferrals', text: planned.deferrals?.map(v => `- ${v}`).join('\n') || '- None' },
                { kind: 'section', heading: 'Build and typecheck', text: planned.buildNeeds || 'No build required' }
            ] : [];
            if (planned && this.selected && isAssessmentWireframe(this.selected.assessment)) {
                if (this.selected.assessment.constraints.length) planDetails.push({ kind: 'section',
                    heading: 'Wireframe constraints',
                    text: this.selected.assessment.constraints.map(v => `- ${v}`).join('\n') });
                if (this.selected.assessment.deferrals.length) planDetails.push({ kind: 'section',
                    heading: 'Wireframe deferrals',
                    text: this.selected.assessment.deferrals.map(v => `- ${v}`).join('\n') });
            }
            return { tier: meta.tier, model: planned?.tier === 'T2' ? 'GPT-6 Sol High' : meta.model ?? 'GPT-6 Sol Medium',
                estimatedMinutes: planned?.estimatedMinutes ?? meta.estimatedMinutes ?? 6,
                integrationChecks: planned?.tier === 'T2' ? planned.validationTargets : meta.integrationChecks,
                detailSections: [...planDetails, ...values.slice(1) as Section[]],
                workItem: { id, title: meta.title, objective: meta.objective,
                    dependsOn: meta.dependsOn ?? [], workingSet: meta.workingSet,
                    requirements: planned?.requirements ?? meta.requirements ?? [],
                    constraints: planned ? [] : meta.constraints ?? [],
                    acceptanceCriteria: meta.acceptanceCriteria, validationTargets: meta.validationTargets,
                    status: 'draft', delegablePaths: meta.workingSet, humanReservedPaths: [] } };
        });
        if (!this.selected && !work.some(item => item.tier === 'T2') ||
            this.selected && work.filter(item => item.tier === 'T2').length !==
            this.selected.plan.work.filter(item => item.tier === 'T2').length)
            throw new Error('PROPOSAL_PROMPT_T2_GATE');
        const allInstructionText = snapshot.stages.map(stage => stage.content).join('\n');
        if (/\.cjs\b/iu.test(allInstructionText) &&
            !this.prior.plan.execution.sourceRefs?.some(ref => ref.kind === 'file' && /\.cjs$/u.test(ref.id)))
            throw new Error('PROPOSAL_PROMPT_UNGROUNDED_MODULE_TEST');
        if (/\b(?:npm\s+install|yarn\s+add|pnpm\s+add)\b/iu.test(allInstructionText) &&
            (!this.prior.plan.execution.sourceRefs?.some(ref => ref.kind === 'file' && /(?:^|\/)package\.json$/u.test(ref.id)) ||
                !/\bdependenc(?:y|ies)\b/iu.test(this.prior.plan.content)))
            throw new Error('PROPOSAL_PROMPT_UNGROUNDED_DEPENDENCY');
        const input: ComposeStackInput = { folderName: this.folder, sourceKind: 'chat-plan',
            version: this.sourceVersion, sourceVersion: this.sourceVersion, work,
            efficiencyAudit: closeout.efficiencyAudit,
            closeout: { title: closeout.title, objective: closeout.objective,
                manualReason: closeout.manualReason, acceptanceCriteria: closeout.acceptanceCriteria,
                browserRequired: closeout.browserRequired, model: closeout.model ?? 'GPT-6 Sol High' } };
        await verifyPromptDraftSource(this.root, this.prior.assessment, this.grounder);
        await verifyPromptDraftSource(this.root, this.prior.plan, this.grounder);
        const composed = await composeSavedPromptStack(input, this.folder, this.sourceVersion,
            this.prior, this.selected);
        const source = await capturePromptSourceEvidence(this.root);
        if (source.head !== this.expectedSource.head ||
            source.worktreeFingerprint !== this.expectedSource.worktreeFingerprint)
            throw new Error('PROMPT_SOURCE_CHANGED');
        return createPromptStackProposal(this.root, snapshot.identity.chatId,
            snapshot.identity.messageId, snapshot.identity.ownerId, snapshot.identity.leaseToken,
            composed.draft, composed.supportingFiles, this.prior.assessment.id,
            this.prior.plan.id, this.revision);
    }
}
