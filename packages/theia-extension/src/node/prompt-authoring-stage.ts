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
            } else await grounder.readFileRange(root, file.id, 0, 1, file.sourceHash);
        }
        catch { throw new Error(`Saved prompt draft source changed or is unavailable: ${file.id}`); }
    }
}

export function promptStageInstruction(command: { stage: PromptStage; folder?: string },
    prior: { assessment?: ChatAssistantMessage; plan?: ChatAssistantMessage }, sourceVersion?: string): string {
    const inherited = [prior.assessment && `Selected assessment ${prior.assessment.id}:\n${prior.assessment.content.slice(0, 12_000)}`,
        prior.plan && `Selected plan ${prior.plan.id}:\n${prior.plan.content.slice(0, 12_000)}`].filter(Boolean).join('\n\n');
    const common = 'Use the saved Chat discussion and only brokered project reads. Do not write canonical files, publish prompts, grant or run Work, or award Roadmap status. For each claim distinguish listed/searched paths from files actually read. Read relevant source and tests with read_file; report omissions. Keep the final response under 12,000 characters.';
    if (command.stage === 'prompt-ass') return `${common}\nThe owner selected immutable task name ${JSON.stringify(command.folder)}. Assess only the supplied task details. Return a Markdown assessment with headings Scope, Preservation, Dependencies, Risks, Source basis, Authority, and Evidence (T1/T2/T3).`;
    if (command.stage === 'prompt-plan') return `${common}\n${inherited}\nReturn a Markdown plan with ordered steps, exact likely files, focused tests/build dependency order, manual checkpoints, explicit deferrals and prompt-efficiency decisions.`;
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
    const matched = /\b(\d{1,2}|ten)\s+(?:(?:substantial|dependency-ordered|ordered|implementation|work)\s+){0,4}(?:work\s+)?(?:prompts|steps)\b/iu.exec(source);
    if (!matched) return undefined;
    const count = matched[1].toLowerCase() === 'ten' ? 10 : Number(matched[1]);
    return count >= 1 && count <= 48 ? count : undefined;
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
