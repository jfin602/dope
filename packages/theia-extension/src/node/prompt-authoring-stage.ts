import { createHash, randomUUID } from 'node:crypto';
import { lstat } from 'node:fs/promises';
import { join } from 'node:path';
import type { Chat, ChatAssistantMessage, ChatPromptDraftIdentity, ChatUserMessage } from '@dope/chat';
import { composePhaseStackDraft, type ComposeStackInput, type DraftStack } from '@dope/agent-core/lib/phase-stack-composer';
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
    chatId: string, userMessageId: string, leaseToken: string,
    reclaimedLease = false): ChatPromptDraftIdentity {
    if (!draft || draft.schemaVersion !== 1 || draft.revision !== 1 ||
        draft.projectId !== hash(root) || draft.chatId !== chatId ||
        draft.userMessageId !== userMessageId || !/^[a-f0-9]{64}$/u.test(draft.leaseDigest) ||
        !reclaimedLease && draft.leaseDigest !== hash(leaseToken))
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
    if (!/^\/prompt-write(?:[ \t]+[^\r\n][\s\S]*)?$/u.test(content))
        throw new Error('Usage: /prompt-write [revision instructions] from the selected Plan card');
    if (/^\/prompt-write[ \t]+(?:docs\/tasks\/|\.\.?\/|[cp]\d+(?:-|\b))/u.test(content) ||
        /^\/prompt-write[ \t]+[a-z0-9]+(?:-[a-z0-9]+)*[ \t]*$/u.test(content))
        throw new Error('Prompt destination comes from the selected Plan card');
    return { stage: bound };
}

/** The saved assistant and its paired protected invocation are the durable draft owner. */
export function priorPromptDraft(chat: Chat, stage: 'prompt-ass' | 'prompt-plan', before = chat.messages.length):
    { assistant: ChatAssistantMessage; user: ChatUserMessage } | undefined {
    for (let index = Math.min(before, chat.messages.length) - 1; index > 0; index--) {
        const assistant = chat.messages[index];
        if (assistant.role !== 'assistant' || assistant.execution.status !== 'complete' ||
            !assistant.content.startsWith(heading[stage] + '\n')) continue;
        if (stage === 'prompt-ass' && assistant.planningActivity?.kind === 'prompt-assessment-revision' &&
            assistant.planningActivity.status !== 'applied') continue;
        // Retry saves another assistant attempt after the same user invocation.
        let userIndex = index - 1;
        while (userIndex >= 0 && chat.messages[userIndex].role === 'assistant') userIndex--;
        const user = chat.messages[userIndex];
        if (user?.role === 'user' && boundPromptStage(user.skill) === stage) {
            if (stage === 'prompt-ass' && assistant.planningActivity?.kind === 'prompt-assessment-revision') {
                const owner = chat.messages.find(message => message.role === 'user' &&
                    message.id === assistant.planningActivity?.assessmentRevision?.ownerUserMessageId);
                if (owner?.role === 'user' && owner.promptDraft?.id ===
                    assistant.planningActivity.assessmentRevision?.draftId) return { assistant, user: owner };
                continue;
            }
            return { assistant, user };
        }
    }
    return undefined;
}

export async function verifyPromptDraftSource(root: string, assistant: ChatAssistantMessage,
    grounder: ChatProjectGrounder): Promise<void> {
    if (!assistant.execution.sourceRefs?.some(ref => ref.kind === 'file')) {
        if (assistant.content.startsWith(heading['prompt-ass'] + '\n')) return;
        throw new Error('Saved prompt draft lacks broker-read source identity');
    }
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
    const common = 'Use the saved Chat discussion and only brokered project reads. Do not write canonical files, publish prompts, grant or run Work, or award Roadmap status. For each claim distinguish listed/searched paths from files actually read. Read source and tests with read_file when making factual claims; report omissions. Keep the final response under 12,000 characters.';
    if (command.stage === 'prompt-ass') return `${common}\nThe owner selected immutable task name ${JSON.stringify(command.folder)}. Decide only the work-prompt count and task division. Honor an explicit owner count; otherwise justify a bounded count. One work prompt is valid. Read only relevant source with read_file; factual source claims need short exact quotes from successful reads. Submit one assessment_stage call with {objective:"Clarify the requested behavior",rationale:"One bounded task covers the change",work:[{title:"Clarify behavior",objective:"Define the behavior",boundary:"Behavioral contract"}],closeout:{title:"Manual closeout",objective:"Check the result",manualReason:"Independent human review"}}. For two tasks, use work:[{title:"Define behavior",objective:"Specify behavior",boundary:"Contract"},{title:"Implement behavior",objective:"Apply the contract",boundary:"Source",dependsOn:[1]}]; omit dependsOn for independent tasks. Add constraints, deferrals and grounded {claim,path,quote} sourceClaims only when needed. Dope derives count and step IDs. If rejected, correct the named field and retry while the turn remains authorized. Then call assessment_finish after an accepted stage receipt. Do not produce detailed implementation, T1/T2/T3 or efficiency gates here. Final prose is a brief summary; the tool receipt seals the draft.`;
    if (command.stage === 'prompt-plan') return `${common}\n${inherited}\nExpand the selected checked Assessment without changing its count, IDs, titles, boundaries or dependencies. Read actual source and tests. Use plan_status, then stage each approved work step in order with plan_stage_step. To revise an accepted step, use plan_correct_step with the current accepted step hash from plan_status and a fully corrected step; never silently replace it. Each bounded step has {id,title,assessmentObjective,boundary,objective,tier,dependsOn,workingSet,requirements,preservedBehavior,risks,deferrals,validationTargets,buildNeeds,acceptanceCriteria,sourceClaims,estimatedMinutes}. Copy reviewed fields exactly. Cite source with {claim,path,quote} from brokered read_file; read each working file and test in this turn. T1 ordinary work targets <=8 minutes; use T2 for integration. Stage one separate {title,objective,manualReason,browserRequired:true,acceptanceCriteria,tier:"T3"} with plan_stage_closeout. Stage ten concise findings one at a time with plan_stage_efficiency({index,finding}) in docs/workflow.md order: responsibility, 8/10/15-minute runtime, tests, builds, evidence, deduplication, model economy, runnable grammar, UI design/ADR 0016, usability/ADR 0037. State genuinely inapplicable non-UI gates. Call plan_finish only after status says eligible. Dope owns the checked Plan and source identities. Final prose is a brief summary, never a Plan JSON packet or completion receipt.`;
    const planTests = prior.plan?.execution?.sourceRefs?.filter(ref => ref.kind === 'file' &&
        (/(?:^|\/)test(?:s)?\//u.test(ref.id) || /\.test\.[^.]+$/u.test(ref.id))).map(ref => ref.id) ?? [];
    const requestedCount = planRecord?.work.length ??
        requestedWorkPromptCount(prior.plan?.content ?? '', prior.assessment?.content ?? '');
    return `${common}\n${inherited}\nDope supplies folder ${JSON.stringify(command.folder)} and source version ${JSON.stringify(sourceVersion)}. ` +
        (requestedCount ? `Stage exactly ${requestedCount} work prompts plus one separate manual closeout. ` : '') +
        `The saved plan read these test files: ${JSON.stringify(planTests)}. Preserve its exact per-step working sets and validation targets; request a Plan revision for a changed test path. ` +
        'Use proposal_status for progress. Stage one ordered plan step per proposal_stage_prompt call with direct typed fields: target:stable step ID, kind:work, title, objective, tier:T1 or T2, dependsOn, workingSet, requirements, constraints, acceptanceCriteria, validationTargets, complete. For T2 include integrationChecks. Optional detailed sections use the same target, kind:section, heading, text, complete:true on the last section. Stage exactly one final target closeout with kind:closeout, title, objective, manualReason, acceptanceCriteria, browserRequired:true, efficiencyAudit:exactly ten findings, complete:true. The ten findings follow docs/workflow.md order: responsibility, runtime, tests, builds, evidence, deduplication, model economy, runnable grammar, UI design and usability. Dope owns counters, hashes and stage identity; supply none. Keep all prior candidate bytes in Dope, use only compact status receipts, and call proposal_finish({finalMessage:"Short factual review message"}) after all requested work steps and the closeout. Copy each selected Plan step ID, title, objective, tier, dependencies, working set, requirements, acceptance and validation exactly. Leave constraints empty; Dope renders saved preservation, risks, deferrals and build needs. For T2, copy its validation targets into integrationChecks. Optional sections may elaborate the Plan but must name only its declared files and tests. Copy the saved ten efficiency findings and closeout exactly. Use plan-step IDs, dependency order, T2 only when present in the saved Plan, and one terminal manual closeout. Do not return a whole-stack JSON answer or claim publication.';
}

/** Only an explicit small numeric request binds a count; a vague plan never invents one. */
export function requestedWorkPromptCount(...texts: string[]): number | undefined {
    const source = texts.join('\n');
    const matched = /\b(?:change|increase|reduce|expand|revise)[^\n.]{0,100}?\bto[ \t]+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b/iu.exec(source) ??
        /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)[-\s]+(?:(?:substantial|dependency-ordered|ordered|implementation|work)[-\s]+){0,4}(?:work[-\s]+)?(?:prompts?|steps?|tasks?)\b/iu.exec(source);
    if (!matched) return undefined;
    const words = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'eleven', 'twelve'];
    const word = words.indexOf(matched[1].toLowerCase());
    const count = word >= 0 ? word + 1 : Number(matched[1]);
    return count >= 1 && count <= 48 ? count : undefined;
}

export interface AssessmentFinding { claim: string; path: string; start: number; end: number;
    sourceHash: string; quote: string }
interface AssessmentCitation { claim: string; path: string; quote: string }
export interface AssessmentRead { path: string; start: number; end: number; sourceHash: string; text: string }
export interface LegacyAssessmentRecord {
    scope: string; observations: AssessmentFinding[]; preservation: AssessmentFinding[];
    dependencies: AssessmentFinding[]; risks: AssessmentFinding[];
    tiers: { T1: string; T2: string; T3: string };
    emptyReasons?: Partial<Record<'observations' | 'preservation' | 'dependencies' | 'risks', string>>;
    omittedRequestedFiles: string[];
}
export interface AssessmentWireframe {
    kind: 'wireframe'; objective: string; count: number; rationale: string;
    work: { id: string; title: string; objective: string; boundary: string; dependsOn: string[] }[];
    constraints: string[]; deferrals: string[];
    closeout: { title: string; objective: string; manualReason: string };
    sourceClaims: AssessmentFinding[];
}
export type AssessmentRecord = LegacyAssessmentRecord | AssessmentWireframe;
export function isAssessmentWireframe(value: AssessmentRecord): value is AssessmentWireframe {
    return 'kind' in value && value.kind === 'wireframe';
}
/** Only new model submissions use this interface; saved canonical records are never migrated. */
export function normalizeAssessmentSubmission(raw: unknown, ownerCount?: number):
    Omit<AssessmentWireframe, 'sourceClaims'> & { sourceClaims: AssessmentCitation[] } {
    const fail = (code: string, path: string, rule: string, correction: string): never => {
        throw new Error(`${code}: ${path} ${rule}. ${correction}`);
    };
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
        fail('ASSESSMENT_WIREFRAME_SHAPE', 'assessment_stage', 'must be an object', 'Submit the documented fields.');
    if (Buffer.byteLength(JSON.stringify(raw), 'utf8') > 16_000)
        fail('ASSESSMENT_PAYLOAD_LIMIT', 'assessment_stage', 'exceeds 16,000 bytes', 'Shorten the wireframe.');
    const value = raw as Record<string, unknown>;
    const allowed = ['objective', 'rationale', 'work', 'constraints', 'deferrals', 'closeout', 'sourceClaims'];
    const safeKey = (key: string): string => /^[A-Za-z][A-Za-z0-9_]{0,40}$/u.test(key) ? key : 'extraField';
    for (const key of Object.keys(value)) if (!allowed.includes(key))
        fail('ASSESSMENT_FIELD_UNSUPPORTED', safeKey(key), 'is unsupported', 'Remove this field; Dope owns count and IDs.');
    const bounded = (v: unknown, limit: number): v is string => typeof v === 'string' &&
        !!v.trim() && v.length <= limit && !/[\u0000-\u001f\u007f]/u.test(v);
    const required = (v: unknown, path: string, limit: number, code: string): string => {
        if (!bounded(v, limit)) fail(code, path, `must be a nonempty string of at most ${limit} characters without control characters`,
            `Correct ${path} and resubmit.`);
        return v as string;
    };
    const objective = required(value.objective, 'objective', 1000, 'ASSESSMENT_OBJECTIVE_REQUIRED');
    const rationale = required(value.rationale, 'rationale', 500, 'ASSESSMENT_RATIONALE_REQUIRED');
    if (!Array.isArray(value.work) || value.work.length === 0 || value.work.length > 48)
        fail('ASSESSMENT_WORK_COUNT', 'work', 'must contain 1–48 ordered tasks', 'Submit a bounded nonempty work array.');
    const items = value.work as unknown[];
    if (ownerCount !== undefined && items.length !== ownerCount)
        fail('ASSESSMENT_OWNER_COUNT_MISMATCH', 'work', `must contain the owner-requested ${ownerCount} tasks; received ${items.length}`,
            'Match the owner count or request a reviewed change.');
    const signatures = new Set<string>();
    const boundaries = new Set<string>();
    const work = items.map((item: unknown, index: number) => {
        const path = `work[${index}]`;
        if (!item || typeof item !== 'object' || Array.isArray(item))
            fail('ASSESSMENT_WORK_ITEM_SHAPE', path, 'must be an object', 'Supply title, objective and boundary.');
        const step = item as Record<string, unknown>;
        for (const key of Object.keys(step)) if (!['title', 'objective', 'boundary', 'dependsOn'].includes(key))
            fail('ASSESSMENT_FIELD_UNSUPPORTED', `${path}.${safeKey(key)}`, 'is unsupported', 'Remove this field.');
        const title = required(step.title, `${path}.title`, 120, 'ASSESSMENT_WORK_ITEM_TITLE_REQUIRED');
        const stepObjective = required(step.objective, `${path}.objective`, 500,
            'ASSESSMENT_WORK_ITEM_OBJECTIVE_REQUIRED');
        const boundary = required(step.boundary, `${path}.boundary`, 300,
            'ASSESSMENT_WORK_ITEM_BOUNDARY_REQUIRED');
        if (/^(?:tbd|todo|n\/a|none|task(?: \d+)?|work item(?: \d+)?|do work|implement it)$/iu.test(stepObjective.trim()))
            fail('ASSESSMENT_WORK_ITEM_OBJECTIVE_REQUIRED', `${path}.objective`,
                'must describe a meaningful task outcome', 'State what this task will accomplish.');
        const signature = `${title.trim().toLowerCase()}\n${stepObjective.trim().toLowerCase()}`;
        const boundarySignature = `${stepObjective.trim().toLowerCase()}\n${boundary.trim().toLowerCase()}`;
        if (signatures.has(signature) || boundaries.has(boundarySignature))
            fail('ASSESSMENT_WORK_ITEM_DUPLICATE', path, 'duplicates an earlier objective or responsibility boundary',
                'Give each task a distinct responsibility.');
        signatures.add(signature);
        boundaries.add(boundarySignature);
        const dependencies = step.dependsOn === undefined ? [] : step.dependsOn;
        if (!Array.isArray(dependencies) || dependencies.length > 12)
            fail('ASSESSMENT_DEPENDENCY_REFERENCE_INVALID', `${path}.dependsOn`,
                'must be an array of at most 12 earlier one-based work-item numbers',
                'Use [1] for the first task, or omit dependsOn.');
        const references = dependencies as unknown[];
        const seen = new Set<number>();
        const dependsOn = references.map((reference: unknown, position: number) => {
            const property = `${path}.dependsOn[${position}]`;
            if (!Number.isSafeInteger(reference) || (reference as number) < 1 ||
                (reference as number) > items.length)
                fail('ASSESSMENT_DEPENDENCY_REFERENCE_INVALID', property,
                    'must be an existing one-based work-item number', 'Use an earlier task number.');
            if ((reference as number) >= index + 1)
                fail('ASSESSMENT_DEPENDENCY_REFERENCE_INVALID', property,
                    'must reference an earlier work item, never itself or a future task',
                    'Use an earlier task number or omit dependsOn.');
            if (seen.has(reference as number))
                fail('ASSESSMENT_DEPENDENCY_DUPLICATE', property, 'repeats a dependency',
                    'List each earlier task only once.');
            seen.add(reference as number);
            return `step-${reference}`;
        });
        return { id: `step-${index + 1}`, title, objective: stepObjective, boundary, dependsOn };
    });
    const strings = (rawItems: unknown, path: string): string[] => {
        if (rawItems === undefined) return [];
        if (!Array.isArray(rawItems) || rawItems.length > 12)
            fail('ASSESSMENT_LIST_INVALID', path, 'must be an array of at most 12 bounded strings',
                'Omit this field or supply short entries.');
        return (rawItems as unknown[]).map((item, index) =>
            required(item, `${path}[${index}]`, 300, 'ASSESSMENT_LIST_INVALID'));
    };
    const constraints = strings(value.constraints, 'constraints');
    const deferrals = strings(value.deferrals, 'deferrals');
    if (!value.closeout || typeof value.closeout !== 'object' || Array.isArray(value.closeout))
        fail('ASSESSMENT_CLOSEOUT_REQUIRED', 'closeout', 'must be an object',
            'Supply title, objective and manualReason.');
    const closeout = value.closeout as Record<string, unknown>;
    for (const key of Object.keys(closeout)) if (!['title', 'objective', 'manualReason'].includes(key))
        fail('ASSESSMENT_FIELD_UNSUPPORTED', `closeout.${safeKey(key)}`, 'is unsupported', 'Remove this field.');
    const manual = { title: required(closeout.title, 'closeout.title', 300, 'ASSESSMENT_CLOSEOUT_REQUIRED'),
        objective: required(closeout.objective, 'closeout.objective', 300, 'ASSESSMENT_CLOSEOUT_REQUIRED'),
        manualReason: required(closeout.manualReason, 'closeout.manualReason', 300, 'ASSESSMENT_CLOSEOUT_REQUIRED') };
    if (value.sourceClaims !== undefined && (!Array.isArray(value.sourceClaims) || value.sourceClaims.length > 8))
        fail('ASSESSMENT_WIREFRAME_SOURCE', 'sourceClaims', 'must be an array of at most eight claims',
            'Omit it or supply bounded claims.');
    return { kind: 'wireframe', objective, count: work.length, rationale, work,
        constraints, deferrals, closeout: manual,
        sourceClaims: (value.sourceClaims ?? []) as AssessmentCitation[] };
}
/** One bounded submission; claims are checked only against successful brokered reads. */
export function validatedAssessmentWireframe(raw: unknown,
    refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']>,
    evidence: readonly AssessmentRead[], ownerCount?: number): AssessmentWireframe {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        Buffer.byteLength(JSON.stringify(raw), 'utf8') > 16_000 ||
        !planKeys(raw, ['kind', 'objective', 'count', 'rationale', 'work', 'constraints',
            'deferrals', 'closeout', 'sourceClaims']))
        throw new Error('ASSESSMENT_WIREFRAME_SHAPE: Submit one bounded wireframe');
    const value = raw as Record<string, unknown>;
    if (value.kind !== 'wireframe' || !planText(value.objective, 1000) ||
        !planText(value.rationale, 500) || !Number.isSafeInteger(value.count) ||
        (value.count as number) < 1 || (value.count as number) > 48 ||
        ownerCount !== undefined && value.count !== ownerCount ||
        !Array.isArray(value.work) || value.work.length !== value.count)
        throw new Error('ASSESSMENT_WIREFRAME_COUNT: Use the owner count or justify 1–48 work prompts');
    const seen = new Set<string>();
    const work = value.work.map((rawStep: unknown, index: number) => {
        if (!rawStep || typeof rawStep !== 'object' || Array.isArray(rawStep) ||
            !planKeys(rawStep, ['id', 'title', 'objective', 'boundary', 'dependsOn']))
            throw new Error('ASSESSMENT_WIREFRAME_STEP: Supply a compact step and primary boundary');
        const step = rawStep as AssessmentWireframe['work'][number];
        if (step.id !== `step-${index + 1}` || !planText(step.title, 120) ||
            !planText(step.objective, 500) || !planText(step.boundary, 300) ||
            !Array.isArray(step.dependsOn) || step.dependsOn.length > 12 ||
            new Set(step.dependsOn).size !== step.dependsOn.length ||
            step.dependsOn.some(id => typeof id !== 'string' || !seen.has(id)))
            throw new Error('ASSESSMENT_WIREFRAME_STEP: Stable ordered IDs and earlier dependencies required');
        seen.add(step.id);
        return step;
    });
    const strings = (items: unknown): items is string[] => Array.isArray(items) &&
        items.length <= 12 && items.every(item => planText(item, 300));
    const closeout = value.closeout;
    if (!strings(value.constraints) || !strings(value.deferrals) || !closeout ||
        typeof closeout !== 'object' || Array.isArray(closeout) ||
        !planKeys(closeout, ['title', 'objective', 'manualReason']) ||
        !Object.values(closeout).every(item => planText(item, 300)))
        throw new Error('ASSESSMENT_WIREFRAME_CLOSEOUT: Include constraints, deferrals and one manual closeout');
    if (!Array.isArray(value.sourceClaims) || value.sourceClaims.length > 8)
        throw new Error('ASSESSMENT_WIREFRAME_SOURCE: Supply at most eight grounded source claims');
    const sourceClaims = value.sourceClaims.map((item, index) => {
        try { return validatedAssessmentFinding(item, 'observations', refs, evidence); }
        catch (error) {
            if (!(error instanceof Error) || !error.message.startsWith('ASSESSMENT_')) throw error;
            const [code, detail] = error.message.split(/:\s*/u, 2);
            throw new Error(`${code}: sourceClaims[${index}] ${detail}`);
        }
    });
    const claimedPaths = new Set(sourceClaims.map(item => item.path));
    const narrative = [value.objective, value.rationale, ...work.flatMap(step =>
        [step.title, step.objective, step.boundary]), ...value.constraints, ...value.deferrals,
        ...(Object.values(closeout) as string[])].join(' ');
    for (const path of requestedPaths(narrative)) if (!claimedPaths.has(path))
        throw new Error(`ASSESSMENT_WIREFRAME_SOURCE: ${path} is named without a broker-grounded source claim`);
    return { kind: 'wireframe', objective: value.objective as string, count: value.count as number,
        rationale: value.rationale as string, work, constraints: value.constraints,
        deferrals: value.deferrals, closeout: closeout as AssessmentWireframe['closeout'], sourceClaims };
}
export interface PlanWorkRecord { id: string; title: string; objective: string; tier: 'T1' | 'T2';
    dependsOn: string[]; workingSet: string[]; validationTargets: string[]; buildNeeds: string;
    acceptanceCriteria: string[]; assessmentObjective?: string; boundary?: string;
    requirements?: string[]; preservedBehavior?: string[]; risks?: string[]; deferrals?: string[];
    sourceClaims?: AssessmentFinding[]; estimatedMinutes?: number }
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
    refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']>, requestedCount?: number,
    evidence: readonly AssessmentRead[] = []): PlanRecord {
    if (Buffer.byteLength(modelText, 'utf8') > 128_000) throw new Error('PLAN_PAYLOAD_LIMIT: Shorten the structured plan');
    let parsed: unknown;
    try { parsed = JSON.parse(modelText.trim()); } catch { throw new Error('PLAN_JSON: Return one structured JSON object'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
        !planKeys(parsed, ['work', 'closeout', 'efficiencyAudit']))
        throw new Error('PLAN_SHAPE: Supply work, closeout and efficiencyAudit only');
    const value = parsed as Record<string, unknown>;
    if (!Array.isArray(value.work) || value.work.length < 1 || value.work.length > 48 ||
        isAssessmentWireframe(assessment) && value.work.length !== assessment.count ||
        requestedCount !== undefined && value.work.length !== requestedCount)
        throw new Error(isAssessmentWireframe(assessment) ?
            `PLAN_REDIVISION_REVIEW_REQUIRED: Preserve ${assessment.count} reviewed work tasks; request an Assessment revision for a material count change` :
            `PLAN_WORK_COUNT: Supply ${requestedCount ?? '1–48'} work tasks plus a separate closeout`);
    const readPaths = new Set(refs.filter(ref => ref.kind === 'file' && ref.origin === 'tool' && ref.sourceHash)
        .map(ref => ref.id));
    if (!readPaths.size) throw new Error('PLAN_READ_REQUIRED: Read actual source with read_file before planning');
    const assessedPaths = new Set((isAssessmentWireframe(assessment) ? assessment.sourceClaims :
        [...assessment.observations, ...assessment.preservation, ...assessment.dependencies, ...assessment.risks])
        .map(item => item.path));
    const supported = new Set([...readPaths, ...assessedPaths]);
    if (!isAssessmentWireframe(assessment) && assessment.omittedRequestedFiles.some(path => !readPaths.has(path)))
        throw new Error(`PLAN_MISSING_SOURCE: Read requested file ${assessment.omittedRequestedFiles.find(path => !readPaths.has(path))} before planning`);
    let t2 = 0;
    const seen = new Set<string>();
    const work = value.work.map((raw: unknown, index: number) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
            !planKeys(raw, isAssessmentWireframe(assessment) ?
                ['id', 'title', 'assessmentObjective', 'boundary', 'objective', 'tier', 'dependsOn',
                    'workingSet', 'requirements', 'preservedBehavior', 'risks', 'deferrals',
                    'validationTargets', 'buildNeeds', 'acceptanceCriteria', 'sourceClaims', 'estimatedMinutes'] :
                ['id', 'title', 'objective', 'tier', 'dependsOn', 'workingSet',
                    'validationTargets', 'buildNeeds', 'acceptanceCriteria']))
            throw new Error(`PLAN_WORK_SHAPE: Step ${index + 1} needs responsibility, files, tests and build needs`);
        const item = raw as PlanWorkRecord;
        if (item.id !== `step-${index + 1}` || seen.has(item.id))
            throw new Error(`PLAN_STEP_ID: Expected stable step-${index + 1}`);
        const outline = isAssessmentWireframe(assessment) ? assessment.work[index] : undefined;
        if (outline && (item.title !== outline.title || item.assessmentObjective !== outline.objective ||
            item.boundary !== outline.boundary || !Array.isArray(item.dependsOn) ||
            JSON.stringify(item.dependsOn) !== JSON.stringify(outline.dependsOn)))
            throw new Error(`PLAN_REDIVISION_REVIEW_REQUIRED: ${item.id} changes a reviewed task boundary; request an Assessment revision`);
        if (!planText(item.title) || !planText(item.objective) ||
            !(item.tier === 'T2' ? /\b(?:integrate|validate|implement|change|repair|wire|add|remove)\b/iu :
                /\b(?:implement|change|repair|wire|add|remove)\b/iu).test(item.objective) ||
            !planStrings(item.workingSet) || !planStrings(item.validationTargets) ||
            !planStrings(item.acceptanceCriteria) || !planText(item.buildNeeds) ||
            !Array.isArray(item.dependsOn) || item.dependsOn.some(id => typeof id !== 'string' || !seen.has(id)) ||
            !['T1', 'T2'].includes(item.tier))
            throw new Error(`PLAN_WORK_CONTENT: ${item.id} needs genuine implementation responsibility, prior dependencies, focused validation and build needs`);
        if (outline && (!planStrings(item.requirements) || !planStrings(item.preservedBehavior) ||
            !planStrings(item.risks) || !planStrings(item.deferrals, 0) ||
            !Number.isSafeInteger(item.estimatedMinutes) || item.estimatedMinutes! < 1 ||
            item.tier === 'T1' && item.estimatedMinutes! > 8 ||
            !Array.isArray(item.sourceClaims) || item.sourceClaims.length < 1 ||
            item.sourceClaims.length > 6))
            throw new Error(`PLAN_DETAIL: ${item.id} needs requirements, preservation, risk, deferral, source claims and a feasible estimate`);
        if (/\b(?:read tiers?|T[123] read|source read only)\b/iu.test(item.objective) ||
            !outline && /\b(?:CI pipeline|CommonJS|browser demo|npm install|new dependency)\b/iu.test(
                [item.title, item.objective, item.buildNeeds, ...item.validationTargets].join(' ')) &&
            !(isAssessmentWireframe(assessment) ? assessment.sourceClaims :
                [...assessment.observations, ...assessment.dependencies]).some(finding =>
                /\b(?:CI pipeline|CommonJS|browser demo|npm install|new dependency)\b/iu.test(finding.claim)))
            throw new Error(`PLAN_UNSUPPORTED_ASSUMPTION: ${item.id} asserts a read tier or unverified infrastructure`);
        for (const path of item.workingSet) if (!(outline ? readPaths : supported).has(path))
            throw new Error(`PLAN_UNSUPPORTED_SOURCE: ${item.id} names ${path} without broker-read assessment or plan evidence`);
        const targets = item.validationTargets.flatMap(target => requestedPaths(target));
        if (!targets.length || targets.some(path => !(outline ? readPaths : supported).has(path)))
            throw new Error(`PLAN_TEST_TARGET: ${item.id} needs an actual broker-read test target`);
        if (outline) {
            const claims = item.sourceClaims!.map(({ claim, path, quote }) =>
                validatedAssessmentFinding({ claim, path, quote }, 'observations', refs, evidence));
            if (claims.some(claim => !readPaths.has(claim.path)))
                throw new Error(`PLAN_UNSUPPORTED_SOURCE: ${item.id} claim was not read in this Plan turn`);
            if (/\b(?:CI pipeline|CommonJS|browser demo|npm install|new dependency)\b/iu.test(
                [item.title, item.objective, item.buildNeeds, ...item.requirements!].join(' ')) &&
                !claims.some(claim => /(?:package\.json|\.github\/workflows\/|\.ya?ml$)/u.test(claim.path)))
                throw new Error(`PLAN_UNSUPPORTED_ASSUMPTION: ${item.id} needs brokered project configuration evidence`);
            const cited = new Set(claims.map(claim => claim.path));
            for (const path of requestedPaths([item.objective, ...item.requirements!,
                ...item.preservedBehavior!, ...item.risks!, ...item.deferrals!, item.buildNeeds,
                ...item.acceptanceCriteria].join(' '))) if (!cited.has(path))
                throw new Error(`PLAN_UNSUPPORTED_SOURCE: ${item.id} names ${path} without a verified source claim`);
            item.sourceClaims = claims;
        }
        if (item.tier === 'T2') t2++;
        seen.add(item.id);
        return item;
    });
    if (isAssessmentWireframe(assessment) && assessment.work.some((step, index) =>
        /\b(?:integration|cross.boundary)\b/iu.test(step.boundary) && work[index].tier !== 'T2'))
        throw new Error('PLAN_T2_REQUIRED: The reviewed integration boundary needs T2');
    if (!isAssessmentWireframe(assessment) && !t2 && value.work.length > 1)
        throw new Error('PLAN_T2_REQUIRED: Include an explicit cross-boundary integration work task');
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
    if (isAssessmentWireframe(assessment) &&
        ((closeout as PlanRecord['closeout']).title !== assessment.closeout.title ||
            (closeout as PlanRecord['closeout']).objective !== assessment.closeout.objective))
        throw new Error('PLAN_REDIVISION_REVIEW_REQUIRED: Final closeout changed; request an Assessment revision');
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
    if (isAssessmentWireframe(assessment)) {
        const ui = work.some(step => step.workingSet.some(path =>
            /(?:^|\/)(?:browser|frontend|ui)\/|\.(?:css|scss|tsx|jsx)$/iu.test(path)));
        if (ui && (!/ADR 0016/iu.test(audit[8]) || !/theme|token/iu.test(audit[8]) ||
            !/ADR 0037/iu.test(audit[9]) || !/entry/iu.test(audit[9]) ||
            !/feedback|recovery/iu.test(audit[9]) || !/keyboard|narrow/iu.test(audit[9]) ||
            /not applicable|inapplicable|non-UI/iu.test(audit[8] + audit[9])))
            throw new Error('PLAN_UI_GATES: UI work needs applicable design and usability evidence');
        if (!ui && (!/not applicable|inapplicable|non-UI/iu.test(audit[8]) ||
            !/not applicable|inapplicable|non-UI/iu.test(audit[9])))
            throw new Error('PLAN_UI_GATES: Mark non-UI gates truthfully not applicable');
    }
    return { work, closeout: closeout as PlanRecord['closeout'], efficiencyAudit: audit };
}

export function renderPlan(record: PlanRecord): string {
    return `${heading['prompt-plan']}\n\nDraft only. This command did not change project files or start Work.\n\n` +
        record.work.map(step => `- ${step.id} (${step.tier}): ${step.title} — ${step.objective}\n` +
            `  Assessment objective: ${step.assessmentObjective ?? 'legacy plan'}; ` +
            `boundary: ${step.boundary ?? 'legacy plan'}; depends on: ${step.dependsOn.join(', ') || 'none'}; ` +
            `estimate: ${step.estimatedMinutes ?? 'unrecorded'} minutes\n` +
            `  Requirements: ${step.requirements?.join('; ') ?? 'legacy plan'}; ` +
            `preserve: ${step.preservedBehavior?.join('; ') ?? 'legacy plan'}; ` +
            `risks: ${step.risks?.join('; ') ?? 'legacy plan'}; ` +
            `deferrals: ${step.deferrals?.join('; ') || 'none'}\n` +
            `  Files: ${step.workingSet.join(', ')}; validation: ${step.validationTargets.join('; ')}; ` +
            `build: ${step.buildNeeds}; acceptance: ${step.acceptanceCriteria.join('; ')}\n` +
            `  Source: ${step.sourceClaims?.map(claim => `${claim.claim} — “${claim.quote}” ` +
                `(${claim.path} bytes ${claim.start}–${claim.end})`).join('; ') || 'legacy plan'}`).join('\n') +
        `\n\nFinal manual closeout (T3): ${record.closeout.title} — ${record.closeout.objective}\n` +
        `Manual reason: ${record.closeout.manualReason}; browser required: yes; ` +
        `acceptance: ${record.closeout.acceptanceCriteria.join('; ')}\n\n` +
        `Prompt Efficiency Gates:\n${record.efficiencyAudit.map((finding, index) => `${index + 1}. ${finding}`).join('\n')}\n`;
}
export function planReceiptCurrent(content: string, contentHash: string | undefined,
    revision: number | undefined): boolean {
    const match = /Plan record sha256: ([a-f0-9]{64}); revision: ([1-9]\d*)/u.exec(content);
    return !!match && match[1] === contentHash && Number(match[2]) === revision;
}
function compactAssessmentContext(record: AssessmentRecord): string {
    if (isAssessmentWireframe(record)) return JSON.stringify(record);
    const section = (items: AssessmentFinding[]) => ({ count: items.length,
        sample: items.slice(0, 4).map(item => ({ claim: item.claim.slice(0, 180), path: item.path,
            start: item.start, end: item.end, sourceHash: item.sourceHash })) });
    return JSON.stringify({ scope: record.scope.slice(0, 500),
        observations: section(record.observations), preservation: section(record.preservation),
        dependencies: section(record.dependencies), risks: section(record.risks), tiers: record.tiers,
        emptyReasons: record.emptyReasons ?? {},
        omittedRequestedFiles: record.omittedRequestedFiles.slice(0, 16) });
}
const assessmentFields = ['scope', 'observations', 'preservation', 'dependencies', 'risks', 'tiers'];
export const requestedPaths = (text: string): string[] => [...new Set(text.match(/\b(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*\.(?:md|txt|json|js|jsx|ts|tsx)\b/gu) ?? [])];
export type AssessmentCategory = 'observations' | 'preservation' | 'dependencies' | 'risks';
/** The same content contract applies to incremental staging and final sealing. */
export function validateAssessmentTiers(raw: unknown): asserts raw is LegacyAssessmentRecord['tiers'] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        Object.keys(raw).sort().join(',') !== 'T1,T2,T3')
        throw new Error('ASSESSMENT_TIERS: Supply exactly T1, T2 and T3');
    const tiers = raw as Record<string, unknown>;
    const bounded = (value: unknown): value is string => typeof value === 'string' &&
        !!value.trim() && value.length <= 500 && !/[\u0000-\u001f\u007f]/u.test(value);
    for (const tier of ['T1', 'T2', 'T3'] as const)
        if (!bounded(tiers[tier]))
            throw new Error(`ASSESSMENT_TIERS: ${tier} needs bounded nonempty text (max 500 characters)`);
    if (!/\bfocused\b/iu.test(tiers.T1 as string) ||
        !/\b(?:source|unit)\b/iu.test(tiers.T1 as string))
        throw new Error('ASSESSMENT_TIERS: T1 must describe focused source or unit validation');
    if (!/\b(?:integration|cross.boundary)\b/iu.test(tiers.T2 as string))
        throw new Error('ASSESSMENT_TIERS: T2 must describe integration or cross-boundary validation');
    if (!/\bindependent\b/iu.test(tiers.T3 as string) ||
        !/\bmanual\b/iu.test(tiers.T3 as string) || !/\bbrowser\b/iu.test(tiers.T3 as string))
        throw new Error('ASSESSMENT_TIERS: T3 must describe independent manual browser qualification');
}
/** Resolve a model citation only within bytes returned by a successful brokered read. */
export function validatedAssessmentFinding(raw: unknown, kind: AssessmentCategory,
    refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']>,
    evidence: readonly AssessmentRead[]): AssessmentFinding {
    const short = (v: unknown, limit = 500): v is string => typeof v === 'string' &&
        !!v.trim() && v.length <= limit && !/[\u0000-\u001f\u007f]/u.test(v);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) ||
        Object.keys(raw).sort().join(',') !== 'claim,path,quote')
        throw new Error(`ASSESSMENT_CITATION: ${kind} requires exactly {claim,path,quote}; remove offsets, hashes and other fields`);
    const item = raw as AssessmentCitation;
    if (!short(item.claim) || typeof item.quote !== 'string' || !item.quote.trim() ||
        item.quote.length > 200 || /[\u0000-\u0009\u000b-\u001f\u007f]/u.test(item.quote) ||
        typeof item.path !== 'string')
        throw new Error(`ASSESSMENT_CITATION: ${kind} needs a nonempty claim (max 500 characters), project-relative path and verbatim quote (max 200 characters, no control characters)`);
    const read = refs.filter(ref => ref.kind === 'file' && ref.origin === 'tool' && ref.sourceHash &&
        Number.isSafeInteger(ref.start) && Number.isSafeInteger(ref.end) && ref.end! > ref.start!);
    const quoteBytes = Buffer.from(item.quote, 'utf8');
    const matches = new Map<string, AssessmentFinding>();
    for (const page of evidence) {
        if (page.path !== item.path || page.end !== page.start + Buffer.byteLength(page.text, 'utf8') ||
            !read.some(ref => ref.id === page.path && ref.sourceHash === page.sourceHash &&
                ref.start === page.start && ref.end === page.end)) continue;
        const bytes = Buffer.from(page.text, 'utf8');
        for (let at = bytes.indexOf(quoteBytes); at >= 0; at = bytes.indexOf(quoteBytes, at + 1)) {
            const start = page.start + at, end = start + quoteBytes.length;
            matches.set(`${page.sourceHash}:${start}:${end}`,
                { claim: item.claim, path: item.path, quote: item.quote, start, end,
                    sourceHash: page.sourceHash });
        }
    }
    if (matches.size !== 1) {
        const pathRead = evidence.some(page => page.path === item.path && read.some(ref =>
            ref.id === page.path && ref.sourceHash === page.sourceHash &&
            ref.start === page.start && ref.end === page.end));
        throw new Error(`ASSESSMENT_UNSUPPORTED_SOURCE: ${kind} ${matches.size ?
            'quote has ambiguous repeated matches in brokered pages; use a longer unique verbatim substring' :
            pathRead ? 'quote is not present verbatim in the brokered read for this path; copy a shorter exact substring, using real newlines rather than literal backslash-n' :
                'path has no successful matching brokered read; read that project-relative file before citing it'}`);
    }
    return [...matches.values()][0];
}
/** Validate model claims against successful broker reads; metadata searches never count. */
export function validatedAssessment(modelText: string,
    refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']>, requestedText: string,
    evidence: readonly AssessmentRead[]): LegacyAssessmentRecord {
    if (Buffer.byteLength(modelText, 'utf8') > 20_000) throw new Error('ASSESSMENT_PAYLOAD_LIMIT: Return fewer, shorter findings');
    let parsed: unknown;
    try { parsed = JSON.parse(modelText.trim()); }
    catch { throw new Error('ASSESSMENT_JSON: Return one structured JSON object'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
        !Object.keys(parsed).every(key => [...assessmentFields, 'emptyReasons'].includes(key)) ||
        assessmentFields.some(key => !Object.hasOwn(parsed, key)))
        throw new Error('ASSESSMENT_SHAPE: Use scope, observations, preservation, dependencies, risks and tiers');
    const value = parsed as Record<string, unknown>;
    const short = (v: unknown, limit = 500): v is string => typeof v === 'string' &&
        !!v.trim() && v.length <= limit && !/[\u0000-\u001f\u007f]/u.test(v);
    if (!short(value.scope, 1000)) throw new Error('ASSESSMENT_SCOPE: Supply a bounded scope');
    if (value.emptyReasons !== undefined && (!value.emptyReasons ||
        typeof value.emptyReasons !== 'object' || Array.isArray(value.emptyReasons) ||
        Object.keys(value.emptyReasons).some(key =>
            !['observations', 'preservation', 'dependencies', 'risks'].includes(key))))
        throw new Error('ASSESSMENT_EMPTY_REASON: Use category-specific reasons only');
    const read = refs.filter(ref => ref.kind === 'file' && ref.origin === 'tool' && ref.sourceHash &&
        Number.isSafeInteger(ref.start) && Number.isSafeInteger(ref.end) && ref.end! > ref.start!);
    if (!read.length) throw new Error('ASSESSMENT_READ_REQUIRED: Read source with read_file before assessment');
    const findings = {} as Pick<LegacyAssessmentRecord, 'observations' | 'preservation' | 'dependencies' | 'risks'>;
    for (const kind of ['observations', 'preservation', 'dependencies', 'risks'] as const) {
        const items = value[kind];
        if (!Array.isArray(items) || items.length > 12)
            throw new Error(`ASSESSMENT_${kind.toUpperCase()}: Supply 0–12 source-backed findings`);
        if (items.length && (value.emptyReasons as Record<string, unknown> | undefined)?.[kind] !== undefined)
            throw new Error(`ASSESSMENT_${kind.toUpperCase()}_EMPTY: A populated category cannot have an empty reason`);
        if (!items.length) {
            const reasons = value.emptyReasons as Record<string, unknown> | undefined;
            if (!reasons || !short(reasons[kind]) || !read.length ||
                requestedPaths(requestedText).some(path => !read.some(ref => ref.id === path)))
                throw new Error(`ASSESSMENT_${kind.toUpperCase()}_EMPTY: A justified empty category requires all requested source reads`);
        }
        findings[kind] = items.map((raw: unknown) => validatedAssessmentFinding(raw, kind, refs, evidence));
    }
    const tiers = value.tiers;
    validateAssessmentTiers(tiers);
    const omittedRequestedFiles = requestedPaths(requestedText).filter(path =>
        !read.some(ref => ref.id === path));
    return { scope: value.scope as string, ...findings,
        ...(value.emptyReasons ? { emptyReasons: value.emptyReasons as LegacyAssessmentRecord['emptyReasons'] } : {}),
        tiers, omittedRequestedFiles };
}

export function renderAssessment(record: AssessmentRecord): string {
    if (isAssessmentWireframe(record)) return `${heading['prompt-ass']}\n\nDraft only. This command did not change project files or start Work.\n\n` +
        `## Objective\n${record.objective}\n\n## Work prompts (${record.count})\n${record.rationale}\n\n` +
        record.work.map(step => `- ${step.id}: ${step.title} — ${step.objective}; boundary: ${step.boundary}; depends on: ${step.dependsOn.join(', ') || 'none'}`).join('\n') +
        `\n\n## Constraints\n${record.constraints.map(item => `- ${item}`).join('\n') || '- None stated'}\n\n` +
        `## Deferrals\n${record.deferrals.map(item => `- ${item}`).join('\n') || '- None stated'}\n\n` +
        `## Final manual closeout\n${record.closeout.title} — ${record.closeout.objective}; ${record.closeout.manualReason}\n\n` +
        `## Source claims\n${record.sourceClaims.map(item => `- ${item.claim} — “${item.quote}” (${item.path})`).join('\n') || '- None'}\n`;
    const section = (title: string, items: AssessmentFinding[]) =>
        `## ${title}\n${items.length ? items.map(item => `- ${item.claim} — “${item.quote}” (${item.path} bytes ${item.start}–${item.end}, sha256 ${item.sourceHash})`).join('\n') :
            `- None: ${record.emptyReasons?.[title.toLowerCase() as keyof NonNullable<LegacyAssessmentRecord['emptyReasons']>] ?? 'Not justified'}`}`;
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
    sourceVersion: string, prior: { assessment: ChatAssistantMessage; plan: ChatAssistantMessage },
    records?: { assessment: AssessmentRecord; plan: PlanRecord }):
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
    if (records && (!isAssessmentWireframe(records.assessment) ||
        records.assessment.count !== records.plan.work.length ||
        records.assessment.work.some((step, index) =>
            step.id !== records.plan.work[index]?.id ||
            step.title !== records.plan.work[index]?.title ||
            step.objective !== records.plan.work[index]?.assessmentObjective ||
            step.boundary !== records.plan.work[index]?.boundary ||
            JSON.stringify(step.dependsOn) !== JSON.stringify(records.plan.work[index]?.dependsOn)) ||
        input.work.length !== records.plan.work.length ||
        input.work.some((choice, index) => {
            const planned = records.plan.work[index], item = choice.workItem;
            return item.id !== planned.id || item.title !== planned.title ||
                item.objective !== planned.objective || choice.tier !== planned.tier ||
                JSON.stringify(item.dependsOn) !== JSON.stringify(planned.dependsOn) ||
                JSON.stringify(item.workingSet) !== JSON.stringify(planned.workingSet) ||
                JSON.stringify(item.requirements) !== JSON.stringify(planned.requirements) ||
                JSON.stringify(item.validationTargets) !== JSON.stringify(planned.validationTargets) ||
                JSON.stringify(item.acceptanceCriteria) !== JSON.stringify(planned.acceptanceCriteria);
        }) || JSON.stringify(input.efficiencyAudit) !== JSON.stringify(records.plan.efficiencyAudit) ||
        input.closeout.title !== records.plan.closeout.title ||
        input.closeout.objective !== records.plan.closeout.objective ||
        input.closeout.manualReason !== records.plan.closeout.manualReason ||
        input.closeout.browserRequired !== records.plan.closeout.browserRequired ||
        JSON.stringify(input.closeout.acceptanceCriteria) !==
            JSON.stringify(records.plan.closeout.acceptanceCriteria)))
        throw new Error('PROMPT_PLAN_MISMATCH: Revise the checked Plan before changing prompt responsibilities');
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
    const supportingFiles = records ? [
        { path: `docs/tasks/${folder}/prompt-assessment.md`, text: renderAssessment(records.assessment) },
        { path: `docs/tasks/${folder}/implementation-plan.md`, text: renderPlan(records.plan) }
    ] : ([['prompt-assessment.md', prior.assessment, 'Prompt assessment'],
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
