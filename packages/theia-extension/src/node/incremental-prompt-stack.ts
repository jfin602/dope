import type { ChatAssistantMessage, ChatPromptStackProposal } from '@dope/chat';
import type { ComposeStackInput, WorkPromptChoice, CloseoutChoice } from '@dope/agent-core/lib/phase-stack-composer';
import type { ProposalDomainHandler, ProposalSnapshot, ProposalStage } from './incremental-proposal-controller';
import { composeSavedPromptStack, isAssessmentWireframe, requestedPaths, verifyPromptDraftSource, type AssessmentRecord,
    type PlanRecord } from './prompt-authoring-stage';
import { capturePromptSourceEvidence, createPromptStackProposal } from './prompt-stack-proposal';
import type { ChatProjectGrounder } from './chat-project-grounder';
import { importPhaseStack, phaseStackFolder } from '@dope/agent-core/lib/sequence';
import type { DraftStack } from '@dope/agent-core/lib/phase-stack-composer';

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

/** Direct files are model-authored bodies with only runner metadata supplied by Dope. */
export class DirectPromptStack implements ProposalDomainHandler<ChatPromptStackProposal> {
    constructor(private readonly root: string, private readonly folder: string,
        private readonly sourceVersion: string, private readonly revision: number,
        private readonly expectedSource: { head: string; worktreeFingerprint: string },
        private readonly chatId: string, private readonly messageId: string,
        private readonly ownerId: string, private readonly leaseToken: string,
        private readonly readPaths: () => readonly string[]) {}

    async validateStage(): Promise<void> { throw new Error('PROPOSAL_DIRECT_USE_STAGE_FILE'); }

    async preview(snapshot: Readonly<ProposalSnapshot>): Promise<{ target: string; path: string;
        original: null; proposed: string }[]> {
        const groups = this.groups(snapshot, false);
        return groups.map(group => ({ target: group.handle, path: `staging/${group.filename}`,
            original: null, proposed: group.body }));
    }

    private groups(snapshot: Readonly<ProposalSnapshot>, complete: boolean) {
        const grouped = new Map<string, { handle: string; title: string; kind: 'work' | 'manual-closeout';
            chunks: string[]; done: boolean }>();
        for (const stage of snapshot.stages) {
            const prior = grouped.get(stage.target);
            if (!stage.title || !stage.kind || prior && (prior.title !== stage.title || prior.kind !== stage.kind || prior.done))
                throw new Error(`PROPOSAL_${stage.target}_STAGE: title, kind or chunk order changed`);
            const group = prior ?? { handle: stage.target, title: stage.title, kind: stage.kind, chunks: [], done: false };
            group.chunks.push(stage.content); group.done = stage.complete; grouped.set(stage.target, group);
        }
        return [...grouped.values()].map((group, index) => {
            if (group.handle !== `P${index + 1}` || complete && !group.done)
                throw new Error(`PROPOSAL_${group.handle}_STAGE: contiguous complete P numbers required`);
            const slug = group.title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/gu, '-')
                .replace(/^-+|-+$/gu, '').slice(0, 64).replace(/-+$/u, '') || 'prompt';
            return { ...group, filename: `${group.handle}-${slug}.txt`, body: group.chunks.join('') };
        });
    }

    async validateComplete(snapshot: Readonly<ProposalSnapshot>): Promise<ChatPromptStackProposal> {
        const groups = this.groups(snapshot, true);
        if (groups.length < 2 || groups.length > 49 ||
            groups.slice(0, -1).some(group => group.kind !== 'work') ||
            groups.at(-1)?.kind !== 'manual-closeout')
            throw new Error('PROPOSAL_CLOSEOUT: one terminal manual T3 closeout after 1–48 work files is required');
        const { mode, phase } = phaseStackFolder(this.folder, this.sourceVersion);
        const seen = new Set<string>();
        const files = groups.map((group, index) => {
            const label = group.handle;
            if (seen.has(group.filename)) throw new Error(`PROPOSAL_${label}_TITLE: duplicate safe filename`);
            seen.add(group.filename);
            const body = group.body.trim();
            const section = (heading: string) => new RegExp(`^${heading}\\s*$`, 'mi').test(body);
            if (/^\s*(?:TASK:|MODEL \/ REASONING \/ USAGE|VERSIONING|- Browser required:|- Recommended configuration:)/gmi.test(body))
                throw new Error(`PROPOSAL_${label}_METADATA: supply substantive body only; Dope adds runner fields`);
            if (body.length < 160 || !section('SCOPE') || !section('ACCEPTANCE') || !section('VALIDATION') ||
                group.kind === 'work' && !section('SOURCE BASIS'))
                throw new Error(`PROPOSAL_${label}_SECTIONS: provide SOURCE BASIS, SCOPE, ACCEPTANCE and VALIDATION sections`);
            if (!/^\s*-\s+\S.+$/mu.test(body.split(/^ACCEPTANCE\s*$/mi)[1] ?? ''))
                throw new Error(`PROPOSAL_${label}_ACCEPTANCE: add observable acceptance bullets`);
            if (!/\b(?:test|check|build|typecheck)\b/iu.test(body.split(/^VALIDATION\s*$/mi)[1] ?? ''))
                throw new Error(`PROPOSAL_${label}_VALIDATION: name focused test or build commands`);
            if (/\b(?:tests? (?:already )?pass(?:ed)?|implemented and verified|gate (?:is )?green)\b/iu.test(body))
                throw new Error(`PROPOSAL_${label}_EVIDENCE: remove unobserved completion or PASS claims`);
            const statedVersion = /\b(?:project|product) version[^\n]{0,24}?\b(\d+\.\d+\.\d+)\b/iu.exec(body)?.[1];
            if (statedVersion && statedVersion !== this.sourceVersion)
                throw new Error(`PROPOSAL_${label}_VERSION: stated ${statedVersion} contradicts source ${this.sourceVersion}`);
            if (group.kind === 'work') {
                if (!/^Source (?:evidence|uncertainty):\s*\S.+$/mi.test(body))
                    throw new Error(`PROPOSAL_${label}_SOURCE_BASIS: cite a broker-read existing file or state explicit uncertainty`);
                if (!/^Depends on:\s*(?:none|P[1-9]\d*(?:\s*,\s*P[1-9]\d*)*)\s*$/mi.test(body))
                    throw new Error(`PROPOSAL_${label}_DEPENDENCIES: use Depends on: none or earlier P numbers`);
                const depends = /^Depends on:\s*(.+)$/mi.exec(body)![1];
                const numbers = depends === 'none' ? [] : [...depends.matchAll(/P(\d+)/gu)].map(match => Number(match[1]));
                if (new Set(numbers).size !== numbers.length || numbers.some(number => number >= index + 1))
                    throw new Error(`PROPOSAL_${label}_DEPENDENCIES: only distinct earlier work prompts may be dependencies`);
                if (!/^Tier:\s*T[12]\s*$/mi.test(body))
                    throw new Error(`PROPOSAL_${label}_ROLE: use Tier: T1 or Tier: T2`);
                const minutes = /^Estimated minutes:\s*(\d+)\s*$/mi.exec(body)?.[1];
                if (!minutes || Number(minutes) < 1 || Number(minutes) >
                    (/^Tier:\s*T1\s*$/mi.test(body) ? 8 : 15))
                    throw new Error(`PROPOSAL_${label}_EFFICIENCY: T1 needs a 1–8 minute estimate; T2 must stay within 15 minutes`);
                if (/^Tier:\s*T2\s*$/mi.test(body) && !/\bintegration\b/iu.test(body))
                    throw new Error(`PROPOSAL_${label}_VALIDATION: T2 requires an affected-system integration check`);
            } else {
                if (!section('MANUAL T3 CLOSEOUT') || !/\b(?:real browser|native|manual|owner)\b/iu.test(body))
                    throw new Error(`PROPOSAL_${label}_CLOSEOUT: specify independent manual T3 evidence`);
                const labels = ['Single responsibility', 'Runtime feasibility', 'Test precision',
                    'Build precision', 'Evidence distribution', 'Command deduplication',
                    'Model economy and deferral', 'Runnable and traceable contract',
                    'UI Design Compliance', 'Human Usability'];
                const gates = body.match(/^\s*(?:[1-9]|10)\.\s+.{20,}$/gmu) ?? [];
                if (gates.length !== 10 || gates.some((gate, gateIndex) =>
                    !new RegExp(`^\\s*${gateIndex + 1}\\.\\s*${labels[gateIndex]}:`, 'iu').test(gate)))
                    throw new Error(`PROPOSAL_${label}_EFFICIENCY: include ten numbered, specific Prompt Efficiency Gate findings`);
            }
            if (group.kind === 'work' && /\b(?:UI|interface|frontend|browser layout)\b/iu.test(body) &&
                !/ADR\s*0016/iu.test(body) || /\b(?:UI|interface|frontend|browser layout)\b/iu.test(body) &&
                group.kind === 'work' &&
                !/ADR\s*0037/iu.test(body))
                throw new Error(`PROPOSAL_${label}_UI: cite ADR 0016 and ADR 0037 for UI work`);
            const metadata = [`TASK: ${mode === 'phase' ? 'Phase' : 'Correction'} ${phase} / ${label} — ${group.title}`,
                '', 'MODEL / REASONING / USAGE',
                `- Recommended configuration: \`${group.kind === 'work' && /^Tier:\s*T1\s*$/mi.test(body) ?
                    'GPT-6 Sol Medium' : 'GPT-6 Sol High'}\`.`,
                `- Browser required: ${group.kind === 'manual-closeout' ? 'yes' : 'no'}.`, '', 'VERSIONING',
                mode === 'phase' ? `The assigned project version is \`${this.sourceVersion}\`.` :
                    `- Required unchanged project version: \`${this.sourceVersion}\`.`, ''].join('\n');
            return { filename: group.filename, path: `docs/tasks/${this.folder}/${group.filename}`,
                text: `${metadata}\n${body}\n` };
        });
        let imported;
        try { imported = await importPhaseStack(this.folder,
            files.map(({ filename, text }) => ({ filename, text })), `docs/tasks/${this.folder}`); }
        catch (error) { throw new Error(`PROPOSAL_IMPORTER: ${String(error)}`); }
        if (imported.mode === 'correction' && imported.unchangedVersion !== this.sourceVersion)
            throw new Error('PROPOSAL_VERSION: prompt version differs from project source');
        const source = await capturePromptSourceEvidence(this.root);
        if (source.head !== this.expectedSource.head || source.packageVersion !== this.sourceVersion ||
            source.worktreeFingerprint !== this.expectedSource.worktreeFingerprint)
            throw new Error('PROPOSAL_SOURCE_CHANGED');
        const readPaths = new Set(this.readPaths());
        for (const group of groups) {
            for (const line of group.body.split('\n')) {
                const claim = /^Source evidence:\s*([^\s]+)\s*$/iu.exec(line);
                if (claim && !readPaths.has(claim[1]))
                    throw new Error(`PROPOSAL_${group.handle}_SOURCE_BASIS: ${claim[1]} needs a brokered read_file receipt`);
            }
        }
        const draft: DraftStack = { folderName: this.folder, sourcePath: `docs/tasks/${this.folder}`,
            files, diagnostics: [], manifest: [`# ${this.folder} — Direct Prompt Stack`, '',
                `Source HEAD: ${source.head}`, `Source version: ${this.sourceVersion}`,
                `Source worktree fingerprint: ${source.worktreeFingerprint}`, '',
                ...files.map((file, index) => `- ${file.filename}: ${index === files.length - 1 ? 'manual T3 closeout' :
                    /^Tier:\s*T2\s*$/mi.test(groups[index].body) ? 'T2 work' : 'T1 work'}`), '',
                'Generated for review. Publication requires explicit owner Accept; Work requires a separate grant and Run.', ''].join('\n') };
        return createPromptStackProposal(this.root, this.chatId, this.messageId, this.ownerId,
            this.leaseToken, draft, [], undefined, undefined, this.revision, 'direct-prompt');
    }
}
