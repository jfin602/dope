import { createHash } from 'node:crypto';
import type { Chat, ChatAssistantMessage, ChatUserMessage } from '@dope/chat';
import { composePhaseStackDraft, type ComposeStackInput, type DraftStack } from '@dope/agent-core/lib/phase-stack-composer';
import { phaseStackFolder } from '@dope/agent-core/lib/sequence';
import { boundPromptStage } from './chat-skills';
import type { ChatProjectGrounder } from './chat-project-grounder';

export type PromptStage = 'prompt-ass' | 'prompt-plan' | 'prompt-write';
const heading = { 'prompt-ass': '# Unpublished prompt assessment',
    'prompt-plan': '# Unpublished prompt plan', 'prompt-write': '# Unpublished prompt stack draft' } as const;
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

export function promptStageCommand(content: string, bound: PromptStage | undefined):
    { stage: PromptStage; folder?: string } | undefined {
    if (!bound) return undefined;
    if (!content.startsWith(`/${bound}`) || !/^\/prompt-(?:ass|plan|write)(?=\s|$)/u.test(content))
        throw new Error('Protected prompt command must be a fresh leading slash invocation');
    if (bound !== 'prompt-write') return { stage: bound };
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
    if (command.stage === 'prompt-ass') return `${common}\nReturn a Markdown assessment with headings Scope, Preservation, Dependencies, Risks, Source basis, Authority, and Evidence (T1/T2/T3).`;
    if (command.stage === 'prompt-plan') return `${common}\n${inherited}\nReturn a Markdown plan with ordered steps, exact likely files, focused tests/build dependency order, manual checkpoints, explicit deferrals and prompt-efficiency decisions.`;
    const planTests = prior.plan?.execution?.sourceRefs?.filter(ref => ref.kind === 'file' &&
        (/(?:^|\/)test(?:s)?\//u.test(ref.id) || /\.test\.[^.]+$/u.test(ref.id))).map(ref => ref.id) ?? [];
    return `${common}\n${inherited}\nReturn ONLY valid JSON, no fences, prose, code snippets or shell commands. ` +
        `Dope supplies folder ${JSON.stringify(command.folder)} and source version ${JSON.stringify(sourceVersion)}; omit those fields. ` +
        `The saved plan read these test files: ${JSON.stringify(planTests)}. Include each in a work step workingSet when the plan calls for changing tests. ` +
        'Use exactly this compact shape: {"work":[{"id":"step-1","title":"Implement change","objective":"Change the relevant behavior","tier":"T1","dependsOn":[],"workingSet":["src/feature.js"],"requirements":["Preserve existing behavior"],"constraints":["Stay within the project"],"acceptanceCriteria":["Requested behavior works"],"validationTargets":["Run focused test"]},{"id":"step-2","title":"Integrate change","objective":"Check affected system","tier":"T2","dependsOn":["step-1"],"workingSet":["src/feature.js"],"requirements":["Use verified source"],"constraints":["Do not claim Green"],"acceptanceCriteria":["Affected system passes"],"validationTargets":["Run affected integration test"],"integrationChecks":["Run affected integration test"]}],"closeout":{"title":"Manual closeout","objective":"Observe final behavior","manualReason":"Human interaction needs inspection","acceptanceCriteria":["Observe expected behavior"],"browserRequired":true}}. ' +
        'Replace every example title, objective, path, requirement, acceptance criterion, and validation target with concrete details from the saved plan. Acceptance must name observable project behavior and validation must name the affected check. Do not copy placeholder text. Use one to four work entries, including a T2 entry. The closeout is separate and never in work. All strings are short plain prose, and arrays contain strings only. Use plan-step IDs, never accepted WorkItem IDs. Keep prompts narrow; include UI and usability gates only when relevant. Do not claim approval, publication or execution.';
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
    Promise<{ text: string; draft: DraftStack }> {
    if (Buffer.byteLength(modelText, 'utf8') > 48_000) throw new Error('Prompt stack input exceeds draft limit');
    let parsed: unknown;
    try { parsed = JSON.parse(modelText.trim().replace(/^```(?:json)?\s*/u, '').replace(/\s*```$/u, '')); }
    catch { throw new Error('Prompt stack needs one valid ComposeStackInput JSON object'); }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid prompt stack input');
    const proposed = parsed as ComposeStackInput;
    if (proposed.folderName && proposed.folderName !== folder ||
        proposed.sourceKind && proposed.sourceKind !== 'chat-plan' ||
        proposed.sourceVersion && proposed.sourceVersion !== sourceVersion ||
        proposed.version && proposed.version !== sourceVersion ||
        !Array.isArray(proposed.work) || proposed.work.length > 4)
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
    if (Buffer.byteLength(payload, 'utf8') > 48_000) throw new Error('Validated prompt stack exceeds saved draft limit');
    return { text: `${heading['prompt-write']}\n\n\`\`\`json\n${payload}\n\`\`\`\n`, draft };
}
