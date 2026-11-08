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
    if (command.stage === 'prompt-ass') return `${common}\nReturn a Markdown assessment with headings Scope, Preservation, Dependencies, Risks, Source basis, Authority, and Evidence. In Source basis use separate Read:, Listed:, and Uninspected: lines naming paths; a search/list is never a read. Disclose each explicitly requested path not actually read. Define T1 as focused source/unit verification, T2 as cross-boundary integration, and T3 as manual/browser/native/release or independent qualification. Never use T1/T2/T3 for retrieval levels.`;
    if (command.stage === 'prompt-plan') {
        const count = requestedWorkPromptCount(prior.assessment?.content ?? '');
        const structured = count ? `\nFor this explicit ${count}-work-step request, use exactly ${count} headings \"### Work N: specific responsibility\" in dependency order. Under each put separate \"- Tier: T1\" or T2, \"- Depends on: none\" or earlier numbers, \"- Files: path\" (prefix a genuinely new file with NEW), \"- Tests: path or focused command\", and \"- Acceptance: observable result\" lines. Include one dedicated T2 integration step with an \"- Integration: concrete cross-boundary check\" line. Add exactly one \"### Manual closeout\" section after work, including \"- Tier: T3\" and a concrete manual acceptance. Add \"### Efficiency gates\" with numbered 1–10 findings in docs/workflow.md order: Single responsibility, Runtime feasibility, Test precision, Build precision, Evidence distribution, Command deduplication, Model economy and deferral, Runnable/traceable contract, UI Design Compliance, Human Usability. Mark UI checks N/A with a reason for non-UI steps. Do not make prompt writing an implementation step. Mark unverified or proposed files/CI explicitly; never state them as observed.` : '';
        return `${common}\n${inherited}\nReturn a Markdown plan with ordered implementation responsibilities, affected source and tests, focused build order, manual checkpoint and explicit deferrals.${structured}`;
    }
    const planTests = prior.plan?.execution?.sourceRefs?.filter(ref => ref.kind === 'file' &&
        (/(?:^|\/)test(?:s)?\//u.test(ref.id) || /\.test\.[^.]+$/u.test(ref.id))).map(ref => ref.id) ?? [];
    const requestedCount = requestedWorkPromptCount(prior.plan?.content ?? '', prior.assessment?.content ?? '');
    return `${common}\n${inherited}\nDope supplies folder ${JSON.stringify(command.folder)} and source version ${JSON.stringify(sourceVersion)}. ` +
        (requestedCount ? `Stage exactly ${requestedCount} work prompts plus one separate manual closeout. ` : '') +
        `The saved plan read these test files: ${JSON.stringify(planTests)}. Include each in a step workingSet when changing tests. ` +
        'Call proposal_status first. For each work step call proposal_stage_prompt with target (stable step ID), kind:"work", title, objective, tier:"T1" or "T2", dependsOn, workingSet, acceptanceCriteria, validationTargets and complete:true. T2 also needs nonempty integrationChecks. To add detail, set work complete:false, then call the same target with kind:"section", heading, text and complete:true on its last section. Finish the current step before starting the next. Stage target:"closeout" separately with kind:"closeout", title, objective, manualReason, acceptanceCriteria, browserRequired:true, efficiencyAudit (ten distinct findings in docs/workflow.md order) and complete:true. On a rejection, correct the returned named field; the rejected call was not staged. Check proposal_status for progress. When all targets are complete, call proposal_finish with finalMessage. Do not resend whole prompt files, return a JSON packet, or claim publication.';
}

const requestedPaths = (text: string): string[] => [...new Set(text.match(/\b(?:[a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+\.(?:md|txt|json|js|jsx|ts|tsx)\b/gu) ?? [])];
export function validatePromptAssessment(body: string, refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']>,
    request: string): void {
    const read = [...new Set(refs.filter(ref => ref.kind === 'file').map(ref => ref.id))];
    const source = /(?:^|\n)#{1,3} Source basis\s*\n([\s\S]*?)(?=\n#{1,3} |$)/iu.exec(body)?.[1] ?? '';
    const readLine = /^Read:\s*(.+)$/imu.exec(source)?.[1] ?? '';
    const uninspected = /^Uninspected:\s*(.+)$/imu.exec(source)?.[1] ?? '';
    if (!read.length || !read.some(path => readLine.includes(path)))
        throw new Error('Assessment Source basis must name a broker-read file on its Read: line');
    const falselyRead = requestedPaths(readLine).filter(path => !read.includes(path));
    if (falselyRead.length) throw new Error(`Assessment claims unread source: ${falselyRead[0]}`);
    const omitted = requestedPaths(request).filter(path => !read.includes(path));
    if (omitted.some(path => !uninspected.includes(path)))
        throw new Error(`Assessment must disclose requested uninspected path: ${omitted.find(path => !uninspected.includes(path))}`);
    const evidence = /(?:^|\n)#{1,3} Evidence(?:\s*\([^\n]*\))?\s*\n([\s\S]*?)(?=\n#{1,3} |$)/iu.exec(body)?.[1] ?? '';
    if (!/T1[^\n]*focused[^\n]*(?:source|unit)/iu.test(evidence) ||
        !/T2[^\n]*(?:integration|cross.boundary)/iu.test(evidence) ||
        !/T3[^\n]*(?:manual|browser|native|release|independent)/iu.test(evidence))
        throw new Error('Assessment Evidence must define T1 focused source/unit, T2 integration, T3 manual or independent qualification');
}

const gateNames = ['Single responsibility', 'Runtime feasibility', 'Test precision', 'Build precision',
    'Evidence distribution', 'Command deduplication', 'Model economy and deferral',
    'Runnable/traceable contract', 'UI Design Compliance', 'Human Usability'];
export function validatePromptPlan(body: string, refs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']>,
    count: number, priorRefs: NonNullable<ChatAssistantMessage['execution']['sourceRefs']> = []): void {
    const read = new Set([...priorRefs, ...refs].filter(ref => ref.kind === 'file').map(ref => ref.id));
    if (!refs.some(ref => ref.kind === 'file')) throw new Error('Plan needs an actual brokered source read');
    const headings = [...body.matchAll(/^### Work (\d+):\s*(.+)$/gmu)];
    if (headings.length !== count) throw new Error(`Plan needs ${count} distinct executable Work headings; found ${headings.length}`);
    const titles = new Set<string>();
    let t2 = 0;
    for (let index = 0; index < headings.length; index++) {
        const [, number, title] = headings[index];
        if (Number(number) !== index + 1 || !title.trim() || /write (?:the )?(?:implementation )?prompts/iu.test(title))
            throw new Error(`Plan Work ${index + 1} has wrong order or prompt-writing responsibility`);
        if (titles.has(title.trim().toLowerCase())) throw new Error(`Plan Work ${index + 1} repeats a responsibility`);
        titles.add(title.trim().toLowerCase());
        const section = body.slice(headings[index].index! + headings[index][0].length,
            headings[index + 1]?.index ?? body.length).split(/^### /mu)[0];
        const line = (label: string) => new RegExp(`^- ${label}:\\s*(.+)$`, 'imu').exec(section)?.[1]?.trim();
        const tier = line('Tier');
        if (tier !== 'T1' && tier !== 'T2' || !line('Depends on') || !line('Files') || !line('Tests') ||
            !line('Acceptance') || /^(?:works|passes|done|implement change|test)$/iu.test(line('Acceptance')!))
            throw new Error(`Plan Work ${index + 1} needs tier, dependencies, files, tests and observable acceptance`);
        if (tier === 'T2') {
            t2++;
            if (!line('Integration') || !/integrat|cross.boundary|end.to.end/iu.test(line('Integration')!))
                throw new Error(`Plan Work ${index + 1} needs a concrete cross-boundary integration check`);
        }
        if (/\bwrite (?:the )?(?:implementation )?prompts\b/iu.test(section))
            throw new Error(`Plan Work ${index + 1} assigns prompt writing as implementation`);
        const dependencies = line('Depends on')!;
        const dependencyNumbers = [...dependencies.matchAll(/\b\d+\b/gu)];
        if (dependencies !== 'none' && (!dependencyNumbers.length || dependencyNumbers.some(match =>
            Number(match[0]) < 1 || Number(match[0]) >= index + 1)))
            throw new Error(`Plan Work ${index + 1} depends on an unfinished step`);
        const paths = requestedPaths(line('Files')!);
        if (!paths.length || paths.some(path => !read.has(path) && !line('Files')!.includes(`NEW ${path}`)))
            throw new Error(`Plan Work ${index + 1} names an unverified file as observed; read it or mark NEW`);
        const tests = requestedPaths(line('Tests')!);
        if (!tests.length || tests.some(path => !read.has(path) && !line('Tests')!.includes(`NEW ${path}`)))
            throw new Error(`Plan Work ${index + 1} needs a source-backed focused test path or an explicit NEW test`);
        if (/\b(?:CI|index\.html)\b/iu.test(section) && ![...read].some(path =>
            /(?:^|\/)(?:\.github\/workflows\/|index\.html$)/u.test(path)) && !/\b(?:proposed|unverified|NEW)\b/iu.test(section))
            throw new Error(`Plan Work ${index + 1} presents unverified CI or index.html as observed`);
    }
    if (t2 !== 1) throw new Error('Plan needs exactly one dedicated T2 integration responsibility');
    const closeouts = [...body.matchAll(/^### Manual closeout\s*$/gmu)];
    const closeout = closeouts[0];
    if (closeouts.length !== 1 || !closeout || closeout.index! < headings.at(-1)!.index! ||
        !/^- Tier: T3\s*$/imu.test(body.slice(closeout.index!, closeout.index! + 700)) ||
        !/browser|manual|native|independent/iu.test(body.slice(closeout.index!, closeout.index! + 700)))
        throw new Error('Plan needs one separate terminal manual closeout');
    const gates = /### Efficiency gates\s*\n([\s\S]*)/iu.exec(body)?.[1] ?? '';
    const gateLines = [...gates.matchAll(/^(\d+)\.\s+(.+)$/gmu)];
    for (let index = 0; index < gateNames.length; index++)
        if (Number(gateLines[index]?.[1]) !== index + 1 ||
            !gateLines[index][2].replaceAll('*', '').startsWith(gateNames[index]))
            throw new Error(`Plan efficiency gate ${index + 1} must be ${gateNames[index]}`);
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
