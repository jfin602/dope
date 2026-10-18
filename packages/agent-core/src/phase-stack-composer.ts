import { importPhaseStack, phaseStackFolder } from './sequence';
import type { PromptSource } from './sequence';

/** The accepted Planning WorkItem fields needed to author a draft. No new task owner. */
export interface ComposableWorkItem {
    id: string; title: string; objective: string; dependsOn: readonly string[];
    requirements: readonly string[]; constraints: readonly string[];
    acceptanceCriteria: readonly string[]; validationTargets: readonly string[];
    workingSet: readonly string[]; status: string;
}
export type ComposerModel = 'GPT-6 Sol Medium' | 'GPT-6 Sol High' | 'GPT-6 Sol XHigh';
export interface WorkPromptChoice {
    workItem: ComposableWorkItem;
    tier: 'T1' | 'T2';
    model: ComposerModel;
    estimatedMinutes: number;
    integrationChecks?: readonly string[];
}
export interface CloseoutChoice {
    title: string; objective: string; manualReason: string;
    acceptanceCriteria: readonly string[]; model: ComposerModel;
    browserRequired: boolean;
}
export interface ComposeStackInput {
    folderName: string;
    /** Correction unchanged version, or the first assigned phase version. */
    version: string;
    /** Exact version of the source checkout being drafted from. */
    sourceVersion: string;
    work: readonly WorkPromptChoice[];
    closeout: CloseoutChoice;
}
export interface DraftStack {
    folderName: string; sourcePath: string; files: readonly (PromptSource & { path: string })[];
    manifest: string; diagnostics: readonly string[];
}

const MAX_PROMPT_CHARS = 12_000;
const MAX_ITEMS = 48;
const safePath = (path: string) => path.length <= 256 &&
    !/[\\:\u0000-\u001f\u007f]/u.test(path) && !path.startsWith('/') &&
    path.split('/').every(part => part && part !== '.' && part !== '..' && !part.startsWith('.'));
function line(value: string, label: string): string {
    if (typeof value !== 'string' || !value.trim() || value.length > 500 || /[\r\n\u0000-\u001f\u007f]/u.test(value))
        throw new Error(`Invalid ${label}`);
    return value.trim();
}
function lines(values: readonly string[], label: string, required = true): string[] {
    if (!Array.isArray(values) || values.length > 12 || (required && !values.length)) throw new Error(`Invalid ${label}`);
    return values.map(value => line(value, label));
}
function slug(title: string): string {
    const result = title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '').slice(0, 64).replace(/-$/u, '');
    if (!result) throw new Error('Title needs a usable filename slug');
    return result;
}
function bullets(values: readonly string[]): string { return values.map(value => `- ${value}`).join('\n'); }
function versionFor(input: ComposeStackInput, mode: 'phase' | 'correction', number: number): string {
    if (mode === 'correction') return input.version;
    const [major, minor, patch] = input.version.split('.').map(Number);
    return `${major}.${minor}.${patch + number - 1}`;
}
function orderWork(choices: readonly WorkPromptChoice[]): WorkPromptChoice[] {
    if (!choices.length || choices.length > MAX_ITEMS) throw new Error('Draft needs 1–48 accepted WorkItems');
    const byId = new Map<string, WorkPromptChoice>();
    for (const choice of choices) {
        const id = line(choice.workItem.id, 'WorkItem ID');
        if (byId.has(id)) throw new Error(`Duplicate WorkItem ID: ${id}`);
        if (choice.workItem.status !== 'ready') throw new Error(`WorkItem ${id} is not accepted/ready`);
        byId.set(id, choice);
    }
    const result: WorkPromptChoice[] = [], active = new Set<string>(), done = new Set<string>();
    const visit = (id: string) => {
        if (active.has(id)) throw new Error(`WorkItem dependency cycle: ${id}`);
        if (done.has(id)) return;
        const choice = byId.get(id);
        if (!choice) throw new Error(`Unknown WorkItem dependency: ${id}`);
        active.add(id);
        for (const dependency of [...choice.workItem.dependsOn].sort()) visit(dependency);
        active.delete(id); done.add(id); result.push(choice);
    };
    for (const id of [...byId.keys()].sort()) visit(id);
    return result;
}

/** Pure authoring: no file, Git, provider, approval, or execution side effects. */
export async function composePhaseStackDraft(input: ComposeStackInput): Promise<DraftStack> {
    const { mode, phase } = phaseStackFolder(input.folderName);
    const semver = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
    if (!semver.test(input.version) || !semver.test(input.sourceVersion))
        throw new Error('Invalid project version');
    const [major, minor, patch] = input.version.split('.').map(Number);
    const expectedSource = mode === 'correction' ? input.version : `${major}.${minor}.${patch - 1}`;
    if (input.sourceVersion !== expectedSource)
        throw new Error(`Source version ${input.sourceVersion} does not match expected ${expectedSource}`);
    const ordered = orderWork(input.work);
    const diagnostics: string[] = [];
    const files: Array<PromptSource & { path: string }> = [];
    const seenSlugs = new Set<string>();
    for (const [index, choice] of ordered.entries()) {
        const item = choice.workItem, number = index + 1;
        const title = line(item.title, 'WorkItem title');
        if (/\bcloseout\b/iu.test(title)) throw new Error('Only the final prompt may be a closeout');
        const name = slug(title);
        if (seenSlugs.has(name)) throw new Error(`Duplicate prompt slug: ${name}`);
        seenSlugs.add(name);
        if (!['GPT-6 Sol Medium', 'GPT-6 Sol High', 'GPT-6 Sol XHigh'].includes(choice.model))
            throw new Error('Unknown recommended configuration');
        if (choice.tier !== 'T1' && choice.tier !== 'T2') throw new Error('Work prompt must be T1 or T2');
        if (!Number.isFinite(choice.estimatedMinutes) || choice.estimatedMinutes <= 0 || choice.estimatedMinutes > 15)
            throw new Error('Regular prompt exceeds the 15-minute hard budget');
        if (choice.estimatedMinutes > 8) diagnostics.push(`P${number}: estimated ${choice.estimatedMinutes} minutes exceeds the 8-minute target${choice.estimatedMinutes > 10 ? ' and 10-minute soft ceiling' : ''}; split or review.`);
        const paths = lines(item.workingSet, 'working set');
        if (paths.some(path => !safePath(path))) throw new Error(`Unsafe working set path in ${item.id}`);
        const checks = lines(choice.integrationChecks ?? [], 'T2 integration check', choice.tier === 'T2');
        const dependencies = [...item.dependsOn].sort().map(id => `P${ordered.findIndex(entry => entry.workItem.id === id) + 1} (${id})`);
        const version = versionFor(input, mode, number);
        const text = [
            `TASK: ${mode === 'phase' ? 'Phase' : 'Correction'} ${phase} / P${number} — ${title}`,
            '', 'MODEL / REASONING / USAGE', `- Recommended configuration: \`${choice.model}\`.`, '- Browser required: no.',
            '', 'VERSIONING', mode === 'phase' ? `The assigned project version is \`${version}\`.` : `- Required unchanged project version: \`${version}\`.`,
            '', 'SOURCE AND AUTHORITY', `- Accepted WorkItem: ${line(item.id, 'WorkItem ID')}.`,
            `- Depends on: ${dependencies.length ? dependencies.join(', ') : 'none'}.`,
            '- Recheck current source, project ownership, approval and version before effects; this draft grants no Run or write authority.',
            '', 'SCOPE', line(item.objective, 'objective'),
            'Working set:', bullets(paths),
            'Requirements:', bullets(lines(item.requirements, 'requirements', false)),
            'Constraints:', bullets(lines(item.constraints, 'constraints', false)),
            '', 'ACCEPTANCE', bullets(lines(item.acceptanceCriteria, 'acceptance criteria')),
            '', 'VALIDATION', `- ${choice.tier} work. Run focused T1 checks for the changed behavior.`,
            bullets(lines(item.validationTargets, 'validation targets')),
            ...(choice.tier === 'T2' ? ['Required affected-system T2 integration:', bullets(checks)] : []),
            '- Report observed commands/results and remaining evidence gaps; leave manual T3 to the final closeout.',
        ].join('\n') + '\n';
        if (text.length > MAX_PROMPT_CHARS) throw new Error(`P${number} exceeds prompt size limit`);
        const filename = `P${number}-${name}.txt`;
        files.push({ filename, text, path: `docs/tasks/${input.folderName}/${filename}` });
    }
    if (!ordered.some(choice => choice.tier === 'T2'))
        throw new Error('Draft needs an explicit affected-system T2 integration prompt');
    const closeout = input.closeout, number = files.length + 1;
    const closeoutTitle = line(closeout.title, 'closeout title');
    if (!/\bcloseout\b/iu.test(closeoutTitle)) throw new Error('Final title must say closeout');
    if (!['GPT-6 Sol Medium', 'GPT-6 Sol High', 'GPT-6 Sol XHigh'].includes(closeout.model))
        throw new Error('Unknown recommended configuration');
    const closeoutSlug = slug(closeoutTitle);
    if (!/(?:^|-)closeout(?:-|$)/u.test(closeoutSlug)) throw new Error('Final filename must say closeout');
    const closeoutText = [
        `TASK: ${mode === 'phase' ? 'Phase' : 'Correction'} ${phase} / P${number} — ${closeoutTitle}`,
        '', 'MODEL / REASONING / USAGE', `- Recommended configuration: \`${closeout.model}\`.`,
        `- Browser required: ${closeout.browserRequired ? 'yes' : 'no'}.`,
        '', 'VERSIONING', mode === 'phase' ? `The assigned project version is \`${versionFor(input, mode, number)}\`.` : `- Required unchanged project version: \`${input.version}\`.`,
        '', 'MANUAL T3 CLOSEOUT', line(closeout.objective, 'closeout objective'),
        `- Manual evidence reason: ${line(closeout.manualReason, 'manual reason')}.`,
        '- Operate independently on exact source; do not substitute unit tests for live evidence or infer Green.',
        'Acceptance:', bullets(lines(closeout.acceptanceCriteria, 'closeout acceptance')),
        '- Record PASS, FAIL, BLOCKED or NOT RUN for each gate; owner signoff remains separate.',
    ].join('\n') + '\n';
    if (closeoutText.length > MAX_PROMPT_CHARS) throw new Error(`P${number} exceeds prompt size limit`);
    const filename = `P${number}-${closeoutSlug}.txt`;
    files.push({ filename, text: closeoutText, path: `docs/tasks/${input.folderName}/${filename}` });
    await importPhaseStack(input.folderName, files.map(({ filename, text }) => ({ filename, text })), `docs/tasks/${input.folderName}`);
    const manifest = [`# Draft ${input.folderName}`, '', `Source version: ${input.sourceVersion}. Review the exact source before approval; approval does not Run.`, '',
        ...files.map((file, index) => `- P${index + 1}: ${file.path} — ${index === files.length - 1 ? 'manual T3 closeout' : `${ordered[index].tier}, WorkItem ${ordered[index].workItem.id}`}`),
        '', ...diagnostics.map(message => `- Efficiency: ${message}`)].join('\n') + '\n';
    return { folderName: input.folderName, sourcePath: `docs/tasks/${input.folderName}`, files, manifest, diagnostics };
}
