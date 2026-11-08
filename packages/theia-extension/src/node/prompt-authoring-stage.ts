import { createHash, randomUUID } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Chat, ChatAssistantMessage, ChatPromptDraftIdentity, ChatUserMessage } from '@dope/chat';
import { composePhaseStackDraft, type ComposeStackInput, type DraftStack } from '@dope/agent-core/lib/phase-stack-composer';
import { phaseStackFolder } from '@dope/agent-core/lib/sequence';
import { boundPromptStage } from './chat-skills';
import type { ChatProjectGrounder } from './chat-project-grounder';

export type PromptStage = 'prompt-ass' | 'prompt-plan' | 'prompt-write';
const heading = { 'prompt-ass': '# Unpublished prompt assessment',
    'prompt-plan': '# Unpublished prompt plan', 'prompt-write': '# Unpublished prompt stack draft' } as const;
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');
const reservedSlugs = new Set(['drafts', 'docs', 'tasks', 'prompt-ass', 'prompt-plan', 'prompt-write',
    'readme', 'index', 'new', 'current', 'latest', 'null', 'undefined']);

export function promptDraftSlug(slug: string): string {
    if (slug.length < 3 || slug.length > 32 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) ||
        reservedSlugs.has(slug))
        throw new Error('Choose a unique 3–32 character lowercase task name using letters, digits and single hyphens');
    return slug;
}

export function newPromptDraftIdentity(slug: string, root: string, chatId: string,
    userMessageId: string, leaseToken: string, sourceHead: string, sourceVersion: string,
    sourceFingerprint: string): ChatPromptDraftIdentity {
    return { schemaVersion: 1, id: randomUUID(), revision: 1, slug: promptDraftSlug(slug),
        projectId: hash(root), chatId, userMessageId, leaseDigest: hash(leaseToken), sourceHead,
        sourceVersion, sourceFingerprint };
}

export function verifyPromptDraftIdentity(draft: ChatPromptDraftIdentity | undefined, root: string,
    chatId: string, userMessageId: string, leaseToken: string): ChatPromptDraftIdentity {
    if (!draft || draft.schemaVersion !== 1 || draft.revision !== 1 ||
        draft.projectId !== hash(root) || draft.chatId !== chatId ||
        draft.userMessageId !== userMessageId || draft.leaseDigest !== hash(leaseToken))
        throw new Error('Named prompt draft belongs to another project, Chat or owner lease; start /prompt-ass <name> <task details>');
    promptDraftSlug(draft.slug);
    return draft;
}

export function verifyPromptDraftSourceBasis(draft: ChatPromptDraftIdentity,
    source: { head: string; packageVersion: string; worktreeFingerprint: string }): void {
    if (draft.sourceHead !== source.head || draft.sourceVersion !== source.packageVersion ||
        draft.sourceFingerprint !== source.worktreeFingerprint)
        throw new Error('Named prompt draft source changed; start a fresh /prompt-ass assessment');
}

export async function assertPromptDraftNameAvailable(root: string, chats: readonly Chat[], slug: string): Promise<void> {
    promptDraftSlug(slug);
    if (chats.some(chat => chat.messages.some(message => message.role === 'user' &&
        message.promptDraft?.slug === slug)))
        throw new Error(`Prompt draft name ${slug} already exists; choose a different name`);
    try {
        await lstat(join(root, 'docs', 'tasks', slug));
        throw new Error(`Task directory docs/tasks/${slug} already exists; choose a different name`);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
}

export function promptStageCommand(content: string, bound: PromptStage | undefined):
    { stage: PromptStage; folder?: string; details?: string } | undefined {
    if (!bound) return undefined;
    if (!content.startsWith(`/${bound}`) || !/^\/prompt-(?:ass|plan|write)(?=\s|$)/u.test(content))
        throw new Error('Protected prompt command must be a fresh leading slash invocation');
    if (bound === 'prompt-ass') {
        const match = /^\/prompt-ass[ \t]+([^\s]+)[ \t]+([\s\S]*\S)[ \t]*$/u.exec(content);
        if (!match) throw new Error('Usage: /prompt-ass <name> <task details> — supply a new lowercase task name and description');
        return { stage: bound, folder: promptDraftSlug(match[1]), details: match[2] };
    }
    if (bound === 'prompt-plan') return { stage: bound };
    const match = /^\/prompt-write\s+(\S+)(?:\s+[\s\S]*)?$/u.exec(content);
    if (!match) throw new Error('Usage: /prompt-write <folder> [revision instructions]');
    phaseStackFolder(match[1]);
    return { stage: bound, folder: match[1] };
}

/** The saved assistant and its paired protected invocation are the durable draft owner. */
export function priorPromptDraft(chat: Chat, stage: 'prompt-ass' | 'prompt-plan', before = chat.messages.length):
    { assistant: ChatAssistantMessage; user: ChatUserMessage } | undefined {
    for (let index = Math.min(before, chat.messages.length) - 1; index > 0; index--) {
        const assistant = chat.messages[index];
        if (assistant.role !== 'assistant' || assistant.execution.status !== 'complete' ||
            !assistant.content.startsWith(heading[stage] + '\n')) continue;
        // Retry saves another assistant attempt after the same user invocation.
        let userIndex = index - 1;
        while (userIndex >= 0 && chat.messages[userIndex].role === 'assistant') userIndex--;
        const user = chat.messages[userIndex];
        if (user?.role === 'user' && boundPromptStage(user.skill) === stage)
            return { assistant, user };
    }
    return undefined;
}

export async function verifyPromptDraftSource(root: string, assistant: ChatAssistantMessage,
    grounder: ChatProjectGrounder): Promise<void> {
    await verifyPromptSourceRefs(root, assistant.execution.sourceRefs ?? [], grounder);
}

export async function verifyPromptSourceRefs(root: string,
    refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']>,
    grounder: ChatProjectGrounder): Promise<void> {
    const files = refs.filter(ref => ref.kind === 'file');
    const projectId = hash(root);
    if (!files.length || files.length > 32 || files.some(ref => !ref.sourceHash || ref.projectId !== projectId))
        throw new Error('Saved prompt draft lacks complete broker-read source identity; reassess the project');
    for (const file of files) {
        try {
            if (file.sourceHash === file.contentHash) {
                const reread = await grounder.readFile(root, file.id);
                if (reread.blocks[0]?.ref.sourceHash !== file.sourceHash)
                    throw new Error('Full-file source changed');
            } else {
                const current = await grounder.readFileRange(root, file.id, 0, 1);
                // Legacy path-only reads expose a full-content hash; ranged reads expose a
                // project/path-bound source hash. Both are brokered identities.
                if (current.sourceHash !== file.sourceHash && current.fullHash !== file.sourceHash)
                    throw new Error('File source changed');
            }
        }
        catch { throw new Error(`Saved prompt draft source changed or is unavailable: ${file.id}`); }
    }
}

export function promptStageInstruction(command: { stage: PromptStage; folder?: string },
    prior: { assessment?: ChatAssistantMessage; plan?: ChatAssistantMessage }, sourceVersion?: string,
    assessmentRecord?: AssessmentRecord, planRecord?: PlanRecord): string {
    const inherited = [prior.assessment && `Selected assessment ${prior.assessment.id}:\n${assessmentRecord ?
        compactAssessmentContext(assessmentRecord) : prior.assessment.content.slice(0, 8_000)}`,
        prior.plan && `Selected plan ${prior.plan.id}:\n${planRecord ? JSON.stringify(planRecord) :
            prior.plan.content.slice(0, 12_000)}`].filter(Boolean).join('\n\n');
    const common = 'Use the saved Chat discussion and only brokered project reads. Do not write canonical files, publish prompts, grant or run Work, or award Roadmap status. For each claim distinguish listed/searched paths from files actually read. Read relevant source and tests with read_file; report omissions. Keep the final response under 12,000 characters.';
    if (command.stage === 'prompt-ass') return `${common}\nThe owner selected immutable task name ${JSON.stringify(command.folder)}. Assess only the supplied task details. Return only one JSON object with exact keys scope, observations, preservation, dependencies, risks, tiers. scope is a short string. Each of observations, preservation, dependencies, risks is an array of {claim,path,start,end,sourceHash,quote}; quote is an exact short UTF-8 excerpt occupying start..end within a successful read_file result. Cite only brokered file ranges, using the sourceHash returned by the broker. A listed or searched path is not read evidence. tiers has T1, T2, T3 short strings: T1 focused source/unit work, T2 cross-boundary integration, T3 independent manual browser qualification. Do not include a Markdown report or invent omitted-file lists; Dope checks retrieval and renders the assessment.`;
    if (command.stage === 'prompt-plan') return `${common}\n${inherited}\nReturn one compact JSON object with exact keys work, closeout, efficiencyAudit. work is an ordered array of bounded {id,title,objective,tier,dependsOn,workingSet,validationTargets,buildNeeds,acceptanceCriteria} records; tier is T1 for focused implementation or T2 for explicit cross-boundary integration. Use stable step-N IDs and prior IDs for dependencies. workingSet contains only broker-read source/test paths; read_file each relevant source and late page before claiming it. buildNeeds states the actual narrow compiled-output requirement or "none". closeout has {title,objective,manualReason,browserRequired:true,acceptanceCriteria,tier:"T3"} and is separate from work. efficiencyAudit has exactly ten concise findings in docs/workflow.md order: single responsibility, 8/10/15-minute runtime, test precision, build precision, evidence distribution, command deduplication, model economy and deferral, runnable/traceable contract, UI Design Compliance (ADR 0016 and theme tokens if applicable), Human Usability (ADR 0037, entry/feedback/recovery/keyboard/narrow if applicable). Never invent CI, browser demo files, CommonJS adapters or dependencies. Do not return Markdown or claim publication.`;
    const planTests = prior.plan?.execution?.sourceRefs?.filter(ref => ref.kind === 'file' &&
        (/(?:^|\/)test(?:s)?\//u.test(ref.id) || /\.test\.[^.]+$/u.test(ref.id))).map(ref => ref.id) ?? [];
    const requestedCount = requestedWorkPromptCount(prior.plan?.content ?? '', prior.assessment?.content ?? '');
    return `${common}\n${inherited}\nDope supplies folder ${JSON.stringify(command.folder)} and source version ${JSON.stringify(sourceVersion)}. ` +
        (requestedCount ? `Stage exactly ${requestedCount} work prompts plus one separate manual closeout. ` : '') +
        `The saved plan read these test files: ${JSON.stringify(planTests)}. Include each in a step workingSet when changing tests. ` +
        'Use proposal_status for progress. Stage one ordered plan step per proposal_stage_prompt call with direct typed fields: target:stable step ID, kind:work, title, objective, tier:T1 or T2, dependsOn, workingSet, requirements, constraints, acceptanceCriteria, validationTargets, complete. For T2 include integrationChecks. Optional detailed sections use the same target, kind:section, heading, text, complete:true on the last section. Stage exactly one final target closeout with kind:closeout, title, objective, manualReason, acceptanceCriteria, browserRequired:true, efficiencyAudit:exactly ten findings, complete:true. The ten findings follow docs/workflow.md order: responsibility, runtime, tests, builds, evidence, deduplication, model economy, runnable grammar, UI design and usability. Dope owns counters, hashes and stage identity; supply none. Keep all prior candidate bytes in Dope, use only compact status receipts, and call proposal_finish({finalMessage:"Short factual review message"}) after all requested work steps and the closeout. Use plan-step IDs, dependency order, concrete tests and criteria, an explicit T2 gate, and one terminal manual closeout. Do not return a whole-stack JSON answer or claim publication.';
}

/** Only an explicit small numeric request binds a count; a vague plan never invents one. */
export function requestedWorkPromptCount(...texts: string[]): number | undefined {
    const source = texts.join('\n');
    const matched = /\b(\d{1,2}|ten)[-\s]+(?:(?:substantial|dependency-ordered|ordered|implementation|work)[-\s]+){0,4}(?:work[-\s]+)?(?:prompts?|steps?|tasks?)\b/iu.exec(source);
    if (!matched) return undefined;
    const count = matched[1].toLowerCase() === 'ten' ? 10 : Number(matched[1]);
    return count >= 1 && count <= 48 ? count : undefined;
}

export interface AssessmentFinding { claim: string; path: string; start: number; end: number;
    sourceHash: string; quote: string }
export interface AssessmentRead { path: string; start: number; end: number; sourceHash: string; text: string }
export interface AssessmentRecord {
    scope: string; observations: AssessmentFinding[]; preservation: AssessmentFinding[];
    dependencies: AssessmentFinding[]; risks: AssessmentFinding[];
    tiers: { T1: string; T2: string; T3: string };
    omittedRequestedFiles: string[];
}
export interface PlanWorkRecord { id: string; title: string; objective: string; tier: 'T1' | 'T2';
    dependsOn: string[]; workingSet: string[]; validationTargets: string[]; buildNeeds: string;
    acceptanceCriteria: string[] }
export interface PlanRecord { work: PlanWorkRecord[]; closeout: { title: string; objective: string;
    manualReason: string; browserRequired: true; acceptanceCriteria: string[]; tier: 'T3' };
    efficiencyAudit: string[] }
const planKeys = (value: object, expected: string[]): boolean =>
    Object.keys(value).sort().join(',') === expected.sort().join(',');
const planText = (value: unknown, limit = 300): value is string =>
    typeof value === 'string' && !!value.trim() && value.length <= limit && !/[\u0000-\u001f\u007f]/u.test(value);
const planStrings = (value: unknown, min = 1, max = 12): value is string[] =>
    Array.isArray(value) && value.length >= min && value.length <= max && value.every(item => planText(item));
/** A noncanonical plan may be staged only after its requested count, source and gate claims check out. */
export function validatedPlan(modelText: string, assessment: AssessmentRecord,
    refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']>, requestedCount?: number): PlanRecord {
    if (Buffer.byteLength(modelText, 'utf8') > 32_000) throw new Error('PLAN_PAYLOAD_LIMIT: Shorten the structured plan');
    let parsed: unknown;
    try { parsed = JSON.parse(modelText.trim()); } catch { throw new Error('PLAN_JSON: Return one structured JSON object'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
        !planKeys(parsed, ['work', 'closeout', 'efficiencyAudit']))
        throw new Error('PLAN_SHAPE: Supply work, closeout and efficiencyAudit only');
    const value = parsed as Record<string, unknown>;
    if (!Array.isArray(value.work) || value.work.length < 2 || value.work.length > 48 ||
        requestedCount !== undefined && value.work.length !== requestedCount)
        throw new Error(`PLAN_WORK_COUNT: Supply ${requestedCount ?? '2–48'} work tasks plus a separate closeout`);
    const readPaths = new Set(refs.filter(ref => ref.kind === 'file' && ref.origin === 'tool' && ref.sourceHash)
        .map(ref => ref.id));
    if (!readPaths.size) throw new Error('PLAN_READ_REQUIRED: Read actual source with read_file before planning');
    const assessedPaths = new Set([...assessment.observations, ...assessment.preservation,
        ...assessment.dependencies, ...assessment.risks].map(item => item.path));
    const supported = new Set([...readPaths, ...assessedPaths]);
    if (assessment.omittedRequestedFiles.some(path => !readPaths.has(path)))
        throw new Error(`PLAN_MISSING_SOURCE: Read requested file ${assessment.omittedRequestedFiles.find(path => !readPaths.has(path))} before planning`);
    let t2 = 0;
    const seen = new Set<string>();
    const work = value.work.map((raw: unknown, index: number) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
            !planKeys(raw, ['id', 'title', 'objective', 'tier', 'dependsOn', 'workingSet',
                'validationTargets', 'buildNeeds', 'acceptanceCriteria']))
            throw new Error(`PLAN_WORK_SHAPE: Step ${index + 1} needs responsibility, files, tests and build needs`);
        const item = raw as PlanWorkRecord;
        if (item.id !== `step-${index + 1}` || seen.has(item.id))
            throw new Error(`PLAN_STEP_ID: Expected stable step-${index + 1}`);
        if (!planText(item.title) || !planText(item.objective) ||
            !(item.tier === 'T2' ? /\b(?:integrate|validate|implement|change|repair|wire|add|remove)\b/iu :
                /\b(?:implement|change|repair|wire|add|remove)\b/iu).test(item.objective) ||
            !planStrings(item.workingSet) || !planStrings(item.validationTargets) ||
            !planStrings(item.acceptanceCriteria) || !planText(item.buildNeeds) ||
            !Array.isArray(item.dependsOn) || item.dependsOn.some(id => typeof id !== 'string' || !seen.has(id)) ||
            !['T1', 'T2'].includes(item.tier))
            throw new Error(`PLAN_WORK_CONTENT: ${item.id} needs genuine implementation responsibility, prior dependencies, focused validation and build needs`);
        if (/\b(?:read tiers?|T[123] read|source read only)\b/iu.test(item.objective) ||
            /\b(?:CI pipeline|CommonJS|browser demo|npm install|new dependency)\b/iu.test(
                [item.title, item.objective, item.buildNeeds, ...item.validationTargets].join(' ')) &&
            ![...assessment.observations, ...assessment.dependencies].some(finding =>
                /\b(?:CI pipeline|CommonJS|browser demo|npm install|new dependency)\b/iu.test(finding.claim)))
            throw new Error(`PLAN_UNSUPPORTED_ASSUMPTION: ${item.id} asserts a read tier or unverified infrastructure`);
        for (const path of item.workingSet) if (!supported.has(path))
            throw new Error(`PLAN_UNSUPPORTED_SOURCE: ${item.id} names ${path} without broker-read assessment or plan evidence`);
        const targets = item.validationTargets.flatMap(target => requestedPaths(target));
        if (!targets.length || targets.some(path => !supported.has(path)))
            throw new Error(`PLAN_TEST_TARGET: ${item.id} needs an actual broker-read test target`);
        if (item.tier === 'T2') t2++;
        seen.add(item.id);
        return item;
    });
    if (!t2) throw new Error('PLAN_T2_REQUIRED: Include an explicit cross-boundary integration work task');
    const closeout = value.closeout;
    if (!closeout || typeof closeout !== 'object' || Array.isArray(closeout) ||
        !planKeys(closeout, ['title', 'objective', 'manualReason', 'browserRequired', 'acceptanceCriteria', 'tier']) ||
        !planText((closeout as PlanRecord['closeout']).title) ||
        !planText((closeout as PlanRecord['closeout']).objective) ||
        !planText((closeout as PlanRecord['closeout']).manualReason) ||
        !planStrings((closeout as PlanRecord['closeout']).acceptanceCriteria) ||
        (closeout as PlanRecord['closeout']).browserRequired !== true ||
        (closeout as PlanRecord['closeout']).tier !== 'T3')
        throw new Error('PLAN_T3_CLOSEOUT: Supply exactly one separate final manual browser closeout');
    const audit = value.efficiencyAudit;
    const gates = [/responsib|boundary/iu, /8.{0,30}10.{0,30}15|runtime|minute/iu,
        /test|validation/iu, /build|compil|lib\//iu, /evidence|integration|T2|T3/iu,
        /dedup|repeat|aggregate/iu, /model|deferr/iu, /runnable|trace|grammar|version/iu,
        /(?:UI design|ADR 0016|non-UI).*(?:theme|token|not applicable)|(?:theme|token).*(?:UI design|ADR 0016)/iu,
        /(?:human usability|ADR 0037|non-UI).*(?:keyboard|recovery|entry|not applicable)|(?:keyboard|recovery).*(?:human usability|ADR 0037)/iu];
    if (!planStrings(audit, 10, 10)) throw new Error('PLAN_EFFICIENCY_COUNT: Supply all ten workflow gates');
    if (new Set(audit.map(item => item.toLowerCase().trim())).size !== 10)
        throw new Error('PLAN_EFFICIENCY_DUPLICATE: Supply ten distinct workflow findings');
    for (let index = 0; index < gates.length; index++) if (!gates[index].test(audit[index]))
        throw new Error(`PLAN_EFFICIENCY_GATE_${index + 1}: Wrong or missing docs/workflow.md gate`);
    return { work, closeout: closeout as PlanRecord['closeout'], efficiencyAudit: audit };
}

export function renderPlan(record: PlanRecord): string {
    return `${heading['prompt-plan']}\n\nDraft only. This command did not change project files or start Work.\n\n` +
        record.work.map(step => `- ${step.id} (${step.tier}): ${step.title} — ${step.objective}\n  Files: ${step.workingSet.join(', ')}; depends on: ${step.dependsOn.join(', ') || 'none'}; validation: ${step.validationTargets.join('; ')}; build: ${step.buildNeeds}`).join('\n') +
        `\n\nFinal manual closeout (T3): ${record.closeout.title} — ${record.closeout.objective}\n\n` +
        `Prompt Efficiency Gates:\n${record.efficiencyAudit.map((finding, index) => `${index + 1}. ${finding}`).join('\n')}\n`;
}
export function planReceiptCurrent(content: string, contentHash: string | undefined,
    revision: number | undefined): boolean {
    const match = /Plan record sha256: ([a-f0-9]{64}); revision: ([1-9]\d*)/u.exec(content);
    return !!match && match[1] === contentHash && Number(match[2]) === revision;
}
function compactAssessmentContext(record: AssessmentRecord): string {
    const section = (items: AssessmentFinding[]) => ({ count: items.length,
        sample: items.slice(0, 4).map(item => ({ claim: item.claim.slice(0, 180), path: item.path,
            start: item.start, end: item.end, sourceHash: item.sourceHash })) });
    return JSON.stringify({ scope: record.scope.slice(0, 500),
        observations: section(record.observations), preservation: section(record.preservation),
        dependencies: section(record.dependencies), risks: section(record.risks), tiers: record.tiers,
        omittedRequestedFiles: record.omittedRequestedFiles.slice(0, 16) });
}
const assessmentFields = ['scope', 'observations', 'preservation', 'dependencies', 'risks', 'tiers'];
const requestedPaths = (text: string): string[] => [...new Set(text.match(/\b(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.(?:md|txt|json|js|jsx|ts|tsx)\b/gu) ?? [])];
/** Validate model claims against successful broker reads; metadata searches never count. */
export function validatedAssessment(modelText: string,
    refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']>, requestedText: string,
    evidence: readonly AssessmentRead[]): AssessmentRecord {
    if (Buffer.byteLength(modelText, 'utf8') > 20_000) throw new Error('ASSESSMENT_PAYLOAD_LIMIT: Return fewer, shorter findings');
    let parsed: unknown;
    try { parsed = JSON.parse(modelText.trim()); }
    catch { throw new Error('ASSESSMENT_JSON: Return one structured JSON object'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
        Object.keys(parsed).sort().join(',') !== assessmentFields.sort().join(','))
        throw new Error('ASSESSMENT_SHAPE: Use scope, observations, preservation, dependencies, risks and tiers');
    const value = parsed as Record<string, unknown>;
    const short = (v: unknown, limit = 500): v is string => typeof v === 'string' &&
        !!v.trim() && v.length <= limit && !/[\u0000-\u001f\u007f]/u.test(v);
    if (!short(value.scope, 1000)) throw new Error('ASSESSMENT_SCOPE: Supply a bounded scope');
    const read = refs.filter(ref => ref.kind === 'file' && ref.origin === 'tool' && ref.sourceHash &&
        Number.isSafeInteger(ref.start) && Number.isSafeInteger(ref.end) && ref.end! > ref.start!);
    if (!read.length) throw new Error('ASSESSMENT_READ_REQUIRED: Read source with read_file before assessment');
    const findings = {} as Pick<AssessmentRecord, 'observations' | 'preservation' | 'dependencies' | 'risks'>;
    for (const kind of ['observations', 'preservation', 'dependencies', 'risks'] as const) {
        const items = value[kind];
        if (!Array.isArray(items) || items.length < 1 || items.length > 12)
            throw new Error(`ASSESSMENT_${kind.toUpperCase()}: Supply 1–12 source-backed findings`);
        findings[kind] = items.map((raw: unknown) => {
            if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
                Object.keys(raw).sort().join(',') !== 'claim,end,path,quote,sourceHash,start')
                throw new Error(`ASSESSMENT_CITATION: ${kind} requires claim, path, start, end, sourceHash and quote`);
            const item = raw as AssessmentFinding;
            if (!short(item.claim) || !short(item.quote, 200) || typeof item.path !== 'string' ||
                !Number.isSafeInteger(item.start) || !Number.isSafeInteger(item.end) ||
                !read.some(ref => ref.id === item.path && ref.sourceHash === item.sourceHash &&
                    item.start >= ref.start! && item.end <= ref.end! && item.end > item.start) ||
                !evidence.some(page => page.path === item.path && page.sourceHash === item.sourceHash &&
                    item.start >= page.start && item.end <= page.end &&
                    page.text.includes(item.quote) &&
                    Buffer.from(page.text, 'utf8').subarray(item.start - page.start,
                        item.end - page.start).toString('utf8') === item.quote))
                throw new Error(`ASSESSMENT_UNSUPPORTED_SOURCE: ${kind} cites ${String(item.path).slice(0, 100)} outside a brokered read_file range or the quote differs; read that range and retry`);
            return item;
        });
    }
    const tiers = value.tiers as Record<string, unknown> | undefined;
    if (!tiers || typeof tiers !== 'object' || Array.isArray(tiers) ||
        Object.keys(tiers).sort().join(',') !== 'T1,T2,T3' ||
        !short(tiers.T1) || !short(tiers.T2) || !short(tiers.T3))
        throw new Error('ASSESSMENT_TIERS: Supply T1 focused, T2 integration and T3 manual qualification');
    const omittedRequestedFiles = requestedPaths(requestedText).filter(path =>
        !read.some(ref => ref.id === path));
    return { scope: value.scope as string, ...findings,
        tiers: tiers as AssessmentRecord['tiers'], omittedRequestedFiles };
}

export function renderAssessment(record: AssessmentRecord): string {
    const section = (title: string, items: AssessmentFinding[]) =>
        `## ${title}\n${items.map(item => `- ${item.claim} — “${item.quote}” (${item.path} bytes ${item.start}–${item.end}, sha256 ${item.sourceHash})`).join('\n')}`;
    return `${heading['prompt-ass']}\n\nDraft only. This command did not change project files or start Work.\n\n` +
        `## Scope\n${record.scope}\n\n${section('Observations', record.observations)}\n\n` +
        `${section('Preservation', record.preservation)}\n\n${section('Dependencies', record.dependencies)}\n\n` +
        `${section('Risks', record.risks)}\n\n## Evidence tiers\n` +
        `- T1 focused source and unit checks: ${record.tiers.T1}\n` +
        `- T2 cross-boundary integration: ${record.tiers.T2}\n` +
        `- T3 independent manual browser qualification: ${record.tiers.T3}\n\n` +
        `## Requested files not read\n${record.omittedRequestedFiles.join(', ') || 'none'}\n`;
}

export function finishedPromptText(stage: 'prompt-ass' | 'prompt-plan', modelText: string,
    refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']> = [], requestedText = ''): string {
    const body = modelText.trim();
    if (!body || Buffer.byteLength(body, 'utf8') > 12_000)
        throw new Error('Prompt stage output is empty or exceeds its bounded draft size');
    const read = [...new Set(refs.filter(ref => ref.kind === 'file').map(ref => ref.id))];
    const listed = refs.filter(ref => ref.kind === 'directory').length;
    const searched = refs.filter(ref => ref.kind === 'path-search' || ref.kind === 'text-search').length;
    const requested = [...new Set(requestedText.match(/\b(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:md|txt|json|js|jsx|ts|tsx)\b/gu) ?? [])];
    const omitted = requested.filter(path => !read.includes(path));
    return `${heading[stage]}\n\nDraft only. This command did not change project files or start Work.\n\n${body}\n\n` +
        `## Verified retrieval\n${listed} directory listing(s), ${searched} search result(s), ` +
        `${read.length} file(s) actually read: ${read.join(', ') || 'none'}.\n` +
        `Explicitly requested paths not read: ${omitted.join(', ') || 'none'}.\n`;
}

export async function finishedPromptStack(modelText: string, folder: string,
    sourceVersion: string, prior: { assessment: ChatAssistantMessage; plan: ChatAssistantMessage }):
    Promise<{ text: string; draft: DraftStack; supportingFiles: { path: string; text: string }[] }> {
    if (Buffer.byteLength(modelText, 'utf8') > 256_000) throw new Error('Prompt stack input exceeds draft limit');
    let parsed: unknown;
    try { parsed = JSON.parse(modelText.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')); }
    catch { throw new Error('Prompt stack needs one valid ComposeStackInput JSON object'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid prompt stack input');
    return composeSavedPromptStack(parsed as ComposeStackInput, folder, sourceVersion, prior);
}

/** Compose exact noncanonical bytes from independently persisted prompt stages. */
export async function composeSavedPromptStack(proposed: ComposeStackInput, folder: string,
    sourceVersion: string, prior: { assessment: ChatAssistantMessage; plan: ChatAssistantMessage }):
    Promise<{ text: string; draft: DraftStack; supportingFiles: { path: string; text: string }[] }> {
    if (proposed.folderName && proposed.folderName !== folder ||
        proposed.sourceKind && proposed.sourceKind !== 'chat-plan' ||
        proposed.sourceVersion && proposed.sourceVersion !== sourceVersion ||
        proposed.version && proposed.version !== sourceVersion ||
        !Array.isArray(proposed.work) || proposed.work.length > 48)
        throw new Error('Prompt stack folder, source version, plan source or size changed');
    type CompactChoice = { id: string; title: string; objective: string; tier: 'T1' | 'T2';
        dependsOn?: string[]; workingSet: string[]; requirements?: string[]; constraints?: string[];
        acceptanceCriteria: string[]; validationTargets: string[]; integrationChecks?: string[] };
    const input: ComposeStackInput = { ...proposed, folderName: folder, sourceKind: 'chat-plan',
        version: sourceVersion, sourceVersion,
        work: proposed.work.map(choice => {
            if ('workItem' in choice) return choice;
            const step = choice as unknown as CompactChoice;
            return { tier: step.tier, model: 'GPT-6 Sol Medium', estimatedMinutes: 6,
                integrationChecks: step.integrationChecks,
                workItem: { id: step.id, title: step.title, objective: step.objective,
                    dependsOn: step.dependsOn ?? [], requirements: step.requirements ?? [],
                    constraints: step.constraints ?? [], acceptanceCriteria: step.acceptanceCriteria,
                    validationTargets: step.validationTargets, workingSet: step.workingSet,
                    status: 'draft', delegablePaths: step.workingSet, humanReservedPaths: [] } };
        }),
        closeout: { ...proposed.closeout, model: proposed.closeout?.model ?? 'GPT-6 Sol High' } };
    const examplePhrases = /^(?:Implement change|Integrate change|Check affected system|Requested behavior works|Affected system passes|Run focused test|Run affected integration test|Observe expected behavior)$/iu;
    if (input.work.some(choice =>
        choice.workItem.acceptanceCriteria.some(value => examplePhrases.test(value)) ||
        choice.workItem.validationTargets.some(value => examplePhrases.test(value))) ||
        input.closeout.acceptanceCriteria.some(value => examplePhrases.test(value)))
        throw new Error('Prompt stack copied generic example text instead of saved-plan specifics');
    const requiredTests = prior.plan.execution?.sourceRefs?.filter(ref => ref.kind === 'file' &&
        (/(?:^|\/)test(?:s)?\//u.test(ref.id) || /\.test\.[^.]+$/u.test(ref.id))).map(ref => ref.id) ?? [];
    const plannedTestChange = /(?:update|change|add|extend|modify)\s+(?:the\s+)?(?:test|assertion)/iu.test(prior.plan.content);
    if (plannedTestChange && requiredTests.some(path =>
        !input.work.some(choice => choice.workItem.workingSet?.includes(path))))
        throw new Error('Prompt stack omitted a test file required by the saved plan');
    const draft = await composePhaseStackDraft(input);
    const supportingFiles = ([['prompt-assessment.md', prior.assessment, 'Prompt assessment'],
        ['implementation-plan.md', prior.plan, 'Implementation plan']] as const).map(([filename, message, title]) => {
        const body = message.content.replace(/^# Unpublished prompt (?:assessment|plan)\n\nDraft only\.[^\n]*\n\n/u, '');
        return { path: `docs/tasks/${folder}/${filename}`, text: `# ${title}\n\n${body}` };
    });
    const identity = { assessmentMessageId: prior.assessment.id, planMessageId: prior.plan.id,
        sourceVersion, draft, supportingFiles };
    const payload = JSON.stringify({ schemaVersion: 1, id: hash(JSON.stringify(identity)), ...identity }, null, 2);
    if (Buffer.byteLength(payload, 'utf8') > 384_000) throw new Error('Validated prompt stack exceeds saved draft limit');
    return { text: `${heading['prompt-write']}\n\n\`\`\`json\n${payload}\n\`\`\`\n`, draft, supportingFiles };
}
