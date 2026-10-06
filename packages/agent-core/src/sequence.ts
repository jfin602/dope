import { ExecutionControls, array, freeze, id, integer, record, select, timestamp } from './contracts';
import type { AcceptedDirtyBasis } from './node/dirty-basis';

export const SEQUENCE_SCHEMA_VERSION = 1 as const;
export type StackMode = 'phase' | 'correction';
export type SequenceStatus = 'ready' | 'running' | 'waiting-manual' | 'blocked' | 'interrupted' | 'completed';
export type StackEntryKind = 'implementation' | 'closeout';
export type StackExecution = 'agent-task' | 'manual-gate';
export type VersionPolicy = { kind: 'target'; version: string } | { kind: 'unchanged'; version: string };
export interface SequenceEntry {
    version: typeof SEQUENCE_SCHEMA_VERSION; number: number; filename: string; task: string; title: string;
    promptText: string; kind: StackEntryKind; execution: StackExecution;
    recommendation: { label: 'GPT-6 Sol Medium' | 'GPT-6 Sol High' | 'GPT-6 Sol XHigh';
        model: 'gpt-6-sol'; reasoning: 'medium' | 'high' | 'xhigh' };
    browserRequired: boolean; versionPolicy: VersionPolicy;
}
export interface ImportedStack {
    version: typeof SEQUENCE_SCHEMA_VERSION; folderName: string; mode: StackMode; phase: number;
    roadmapFamily?: 'pre-1.0' | 'post-1.0' | 'post-2.0'; versionOffset?: number;
    continuationSlice?: string; correctionSlug?: string; unchangedVersion?: string;
    entries: SequenceEntry[]; fingerprint: string;
}
export interface AgentTaskSequence {
    version: typeof SEQUENCE_SCHEMA_VERSION; id: string; createdAt: string; updatedAt: string;
    status: SequenceStatus; currentEntryNumber: number; stack: ImportedStack;
    basis: SequenceBasis; checkpoints: SequenceCheckpoint[]; blockedReason?: SequenceBlockReason;
    taskId?: string; runIds?: string[]; acceptedDirty?: AcceptedDirtyBasis;
}
export interface SequenceBasis { head: string; packageVersion: string; worktreeFingerprint: string }
export interface SequenceCheckpoint { entryNumber: number; sha: string; taskId?: string; runId?: string }
export type SequenceBlockReason = 'source-drift' | 'git-history' | 'checkpoint-mismatch' |
    'version-mismatch' | 'head-drift' | 'worktree-drift' | 'interrupted' | 'completion-unsupported' |
    'run-failed' | 'run-cancelled' | 'authority-denied' | 'validation-failed' |
    'capacity-exhausted' | 'checkpoint-pending' | 'checkpoint-failed';
export interface PhaseStackTaskMetadata {
    objective: string; instructions: string; origin: { kind: 'phase-stack'; promptId: string }; controls: ExecutionControls;
    recommendedModel: 'gpt-6-sol'; versionPolicy: VersionPolicy; stackFingerprint: string;
}
export interface PromptSource { filename: string; text: string }

const labels = {
    'GPT-6 Sol Medium': 'medium', 'GPT-6 Sol High': 'high', 'GPT-6 Sol XHigh': 'xhigh'
} as const;
const semver = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u;
const folderError = 'Task folder must have the form p<number>, p<number><slice>, p1-<phase>, p2-<phase>, or c<phase>-<lower-kebab-slug>.';
function exactlyOne(text: string, expression: RegExp, label: string): string {
    const matches = [...text.matchAll(expression)];
    if (matches.length !== 1) throw new Error(`Expected exactly one ${label}; found ${matches.length}.`);
    return matches[0][1].trim();
}
function promptSource(value: unknown): PromptSource {
    const x = record(value, ['filename', 'text']);
    if (typeof x.filename !== 'string' || typeof x.text !== 'string' || x.text.length > 1_000_000)
        throw new Error('Invalid prompt source');
    return { filename: x.filename, text: x.text };
}
function parsePrompt(source: PromptSource): { entry: SequenceEntry; mode: StackMode; phase: number } {
    const { filename, text } = source;
    const fileMatch = /^P([1-9]\d*)-([a-z0-9]+(?:-[a-z0-9]+)*)\.txt$/u.exec(filename);
    if (!fileMatch) throw new Error(`Prompt filename must have the form P<number>-<lower-kebab-slug>.txt: ${filename}`);
    const number = Number(fileMatch[1]);
    if (!Number.isSafeInteger(number)) throw new Error('Invalid prompt number');
    const task = exactlyOne(text, /^TASK:\s*(.+)$/gm, 'TASK title');
    const taskMatch = /^(Phase|Correction) (0|[1-9]\d*) \/ P([1-9]\d*) — (.+)$/u.exec(task);
    if (!taskMatch || !taskMatch[4].trim()) throw new Error(`Invalid TASK title: ${filename}`);
    const mode = taskMatch[1] === 'Phase' ? 'phase' : 'correction';
    const phase = Number(taskMatch[2]);
    if (!Number.isSafeInteger(phase) || !Number.isSafeInteger(Number(taskMatch[3]))) throw new Error('Invalid TASK number');
    if (Number(taskMatch[3]) !== number) throw new Error(`TASK prompt number does not match filename P${number}`);
    const title = taskMatch[4].trim();
    const label = exactlyOne(text, /^- Recommended configuration: `([^`]+)`\.$/gm, 'recommended configuration');
    if (!Object.hasOwn(labels, label)) throw new Error(`Unknown recommended configuration: ${label}`);
    const recommendation = { label: label as keyof typeof labels, model: 'gpt-6-sol' as const,
        reasoning: labels[label as keyof typeof labels] };
    const browserFields = [...text.matchAll(/^- Browser required:\s*(.*)$/gm)];
    if (browserFields.length > 1) throw new Error(`Expected at most one Browser required field; found ${browserFields.length}.`);
    const browserValue = browserFields[0]?.[1].trim();
    if (browserValue !== undefined && browserValue !== 'yes.' && browserValue !== 'no.')
        throw new Error(`Browser required must be exactly yes. or no.: ${filename}`);
    const browserRequired = browserValue === 'yes.';
    const assignedPhrases = [...text.matchAll(/assigned project version is/gi)];
    const unchangedFields = [...text.matchAll(/^- Required unchanged project version: `([^`]+)`\.$/gm)];
    let versionPolicy: VersionPolicy;
    if (mode === 'phase') {
        if (unchangedFields.length) throw new Error(`Phase prompt must not contain correction unchanged-version metadata: ${filename}`);
        if (assignedPhrases.length !== 1) throw new Error(`Expected exactly one assigned project version; found ${assignedPhrases.length}.`);
        const version = exactlyOne(text, /assigned project version is\s*`(\d+\.\d+\.\d+)`/gi, 'assigned project version');
        versionPolicy = { kind: 'target', version };
    } else {
        if (assignedPhrases.length) throw new Error(`Correction prompt must not contain assigned project version metadata: ${filename}`);
        if (unchangedFields.length !== 1) throw new Error(`Expected exactly one required unchanged project version; found ${unchangedFields.length}.`);
        const version = unchangedFields[0][1].trim();
        if (!semver.test(version)) throw new Error(`Required unchanged project version must be a semantic version: ${filename}`);
        versionPolicy = { kind: 'unchanged', version };
    }
    const filenameSignal = /(?:^|-)closeout(?:-|$)/u.test(fileMatch[2]);
    const titleSignal = /\bcloseout\b/iu.test(title);
    if (filenameSignal !== titleSignal) throw new Error(`Ambiguous closeout classification for ${filename}.`);
    const kind = filenameSignal ? 'closeout' : 'implementation';
    return { mode, phase, entry: { version: SEQUENCE_SCHEMA_VERSION, number, filename, task, title,
        promptText: text, kind, execution: kind === 'closeout' || browserRequired ? 'manual-gate' : 'agent-task',
        recommendation, browserRequired, versionPolicy } };
}
function folder(name: string) {
    const historical = /^p(0|[1-9]\d*)$/u.exec(name);
    const continuation = /^p(0|[1-9]\d*)([a-z])$/u.exec(name);
    const post1 = /^p1-(0|[1-9]\d*)$/u.exec(name);
    const post2 = /^p2-(0|[1-9]\d*)$/u.exec(name);
    const correction = /^c(0|[1-9]\d*)-([a-z0-9]+(?:-[a-z0-9]+)*)$/u.exec(name);
    const match = historical ?? continuation ?? post1 ?? post2 ?? correction;
    if (!match || !Number.isSafeInteger(Number(match[1]))) throw new Error(folderError);
    const phase = Number(match[1]);
    if (correction) return { mode: 'correction' as const, phase, correctionSlug: correction[2] };
    return { mode: 'phase' as const, phase,
        roadmapFamily: (post2 ? 'post-2.0' : post1 ? 'post-1.0' : 'pre-1.0') as 'pre-1.0' | 'post-1.0' | 'post-2.0',
        roadmapMajor: post2 ? 2 : post1 ? 1 : 0,
        ...(continuation ? { continuationSlice: continuation[2].toUpperCase() } : {}) };
}
function normalizedStack(folderName: string, sources: readonly PromptSource[]): Omit<ImportedStack, 'fingerprint'> {
    const info = folder(folderName);
    if (!Array.isArray(sources) || !sources.length || sources.length > 100) throw new Error('No valid prompt files were found.');
    const prompts = sources.map(source => parsePrompt(promptSource(source)));
    prompts.sort((a, b) => a.entry.number - b.entry.number);
    for (let index = 0; index < prompts.length; index++) {
        const prompt = prompts[index];
        if (index && prompt.entry.number === prompts[index - 1].entry.number)
            throw new Error(`Duplicate prompt number P${prompt.entry.number}.`);
        if (prompt.entry.number !== index + 1) throw new Error(`Prompt numbering must be contiguous from P1; expected P${index + 1}.`);
        if (prompt.phase !== info.phase) throw new Error(`P${prompt.entry.number} TASK phase ${prompt.phase} does not match folder phase ${info.phase}.`);
        if (prompt.mode !== info.mode) throw new Error(`P${prompt.entry.number} TASK stack mode ${prompt.mode} does not match folder stack mode ${info.mode}.`);
    }
    const entries = prompts.map(prompt => prompt.entry);
    if (entries.filter(entry => entry.kind === 'closeout').length !== 1 || entries.at(-1)?.kind !== 'closeout')
        throw new Error('Exactly one unambiguous final closeout prompt is required.');
    if (info.mode === 'correction') {
        const unchangedVersion = entries[0].versionPolicy.version;
        for (const entry of entries) if (entry.versionPolicy.version !== unchangedVersion)
            throw new Error(`P${entry.number} unchanged version ${entry.versionPolicy.version} does not match stack version ${unchangedVersion}.`);
        return { version: SEQUENCE_SCHEMA_VERSION, folderName, mode: info.mode, phase: info.phase,
            correctionSlug: info.correctionSlug, unchangedVersion, entries };
    }
    let versionOffset = 0;
    if (info.continuationSlice) {
        const parts = entries[0].versionPolicy.version.split('.').map(Number);
        const minimum = info.continuationSlice === 'A' ? 1 : 2;
        if (parts[0] !== 0 || parts[1] !== info.phase || !Number.isSafeInteger(parts[2]) || parts[2] < minimum)
            throw new Error(`Continuation ${folderName} P1 must target 0.${info.phase}.<patch> with patch >= ${minimum}.`);
        versionOffset = parts[2] - 1;
    }
    for (const entry of entries) {
        const expected = `${info.roadmapMajor}.${info.phase}.${versionOffset + entry.number}`;
        if (entry.versionPolicy.version !== expected) throw new Error(`P${entry.number} target ${entry.versionPolicy.version} does not match ${expected}.`);
    }
    return { version: SEQUENCE_SCHEMA_VERSION, folderName, mode: info.mode, phase: info.phase,
        roadmapFamily: info.roadmapFamily, versionOffset,
        ...(info.continuationSlice ? { continuationSlice: info.continuationSlice } : {}), entries };
}
async function fingerprint(snapshot: Omit<ImportedStack, 'fingerprint'>): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** Import from already-read text. File access, execution and Git reconciliation belong to adapters. */
export async function importPhaseStack(folderName: string, sources: readonly PromptSource[]): Promise<ImportedStack> {
    const snapshot = normalizedStack(folderName, sources);
    return freeze({ ...snapshot, fingerprint: await fingerprint(snapshot) });
}
export function parseSequenceEntry(value: unknown): SequenceEntry {
    const x = record(value, ['version', 'number', 'filename', 'task', 'title', 'promptText', 'kind',
        'execution', 'recommendation', 'browserRequired', 'versionPolicy']);
    const canonical = parsePrompt(promptSource({ filename: x.filename, text: x.promptText })).entry;
    if (!sameStructure(value, canonical)) throw new Error('Sequence entry does not match snapshotted prompt');
    return freeze(canonical);
}
export async function parseImportedStack(value: unknown): Promise<ImportedStack> {
    const x = record(value, ['version', 'folderName', 'mode', 'phase', 'roadmapFamily', 'versionOffset',
        'continuationSlice', 'correctionSlug', 'unchangedVersion', 'entries', 'fingerprint']);
    if (x.version !== SEQUENCE_SCHEMA_VERSION || typeof x.folderName !== 'string' || !Array.isArray(x.entries) ||
        typeof x.fingerprint !== 'string' || !/^[a-f0-9]{64}$/u.test(x.fingerprint)) throw new Error('Invalid imported stack');
    const sources = x.entries.map(value => {
        const entry = parseSequenceEntry(value);
        return { filename: entry.filename, text: entry.promptText };
    });
    const canonical = await importPhaseStack(x.folderName, sources);
    if (!sameStructure(value, canonical)) throw new Error('Imported stack snapshot or fingerprint mismatch');
    return canonical;
}
function sameStructure(left: unknown, right: unknown): boolean {
    if (left === right) return true;
    if (!left || !right || typeof left !== 'object' || typeof right !== 'object' || Array.isArray(left) !== Array.isArray(right)) return false;
    const a = left as Record<string, unknown>, b = right as Record<string, unknown>;
    const keys = Object.keys(a).sort();
    return keys.length === Object.keys(b).length && keys.every(key => Object.hasOwn(b, key) && sameStructure(a[key], b[key]));
}
export async function hasPhaseStackSourceDrift(stack: ImportedStack, sources: readonly PromptSource[]): Promise<boolean> {
    const stored = await parseImportedStack(stack);
    try { return (await importPhaseStack(stored.folderName, sources)).fingerprint !== stored.fingerprint; }
    catch { return true; }
}

export const SEQUENCE_STATUSES = freeze(['ready', 'running', 'waiting-manual', 'blocked', 'interrupted', 'completed'] as const);
const transitions: Readonly<Record<SequenceStatus, readonly SequenceStatus[]>> = {
    ready: ['running', 'waiting-manual', 'blocked', 'interrupted'],
    running: ['ready', 'waiting-manual', 'blocked', 'interrupted'],
    'waiting-manual': ['ready', 'blocked', 'interrupted', 'completed'],
    blocked: ['ready', 'waiting-manual', 'interrupted'],
    interrupted: ['ready', 'waiting-manual', 'blocked'], completed: []
};
export function canTransitionSequence(from: SequenceStatus, to: SequenceStatus): boolean {
    return transitions[select(from, SEQUENCE_STATUSES)].includes(select(to, SEQUENCE_STATUSES));
}
export function transitionSequence(from: SequenceStatus, to: SequenceStatus): SequenceStatus {
    if (!canTransitionSequence(from, to)) throw new Error(`Illegal AgentTaskSequence transition: ${from} -> ${to}`);
    return to;
}
export async function parseAgentTaskSequence(value: unknown): Promise<AgentTaskSequence> {
    const x = record(value, ['version', 'id', 'createdAt', 'updatedAt', 'status', 'currentEntryNumber', 'stack',
        'basis', 'checkpoints', 'blockedReason', 'taskId', 'runIds', 'acceptedDirty']);
    if (x.version !== SEQUENCE_SCHEMA_VERSION) throw new Error('Invalid sequence schema version');
    const stack = await parseImportedStack(x.stack);
    const status = select(x.status, SEQUENCE_STATUSES);
    const currentEntryNumber = integer(x.currentEntryNumber, stack.entries.length + 1);
    if (currentEntryNumber < 1 || status === 'completed' !== (currentEntryNumber === stack.entries.length + 1) ||
        status === 'running' && stack.entries[currentEntryNumber - 1]?.execution !== 'agent-task' ||
        status === 'waiting-manual' && stack.entries[currentEntryNumber - 1]?.execution !== 'manual-gate')
        throw new Error('Invalid sequence position or status');
    const createdAt = timestamp(x.createdAt), updatedAt = timestamp(x.updatedAt);
    if (updatedAt < createdAt) throw new Error('Invalid sequence timestamps');
    const basisValue = record(x.basis, ['head', 'packageVersion', 'worktreeFingerprint']);
    const sha = /^[0-9a-f]{40,64}$/u;
    if (typeof basisValue.head !== 'string' || !sha.test(basisValue.head) ||
        typeof basisValue.packageVersion !== 'string' || !semver.test(basisValue.packageVersion) ||
        typeof basisValue.worktreeFingerprint !== 'string' || !/^[0-9a-f]{64}$/u.test(basisValue.worktreeFingerprint))
        throw new Error('Invalid sequence basis');
    if (!Array.isArray(x.checkpoints) || x.checkpoints.length > stack.entries.length)
        throw new Error('Invalid sequence checkpoints');
    const checkpoints = x.checkpoints.map((value, index) => {
        const checkpoint = record(value, ['entryNumber', 'sha', 'taskId', 'runId']);
        if (checkpoint.entryNumber !== index + 1 || typeof checkpoint.sha !== 'string' || !sha.test(checkpoint.sha) ||
            stack.entries[index]?.execution !== 'agent-task') throw new Error('Invalid sequence checkpoint prefix');
        return { entryNumber: index + 1, sha: checkpoint.sha,
            ...(checkpoint.taskId === undefined ? {} : { taskId: id(checkpoint.taskId) }),
            ...(checkpoint.runId === undefined ? {} : { runId: id(checkpoint.runId) }) };
    });
    const expectedCheckpoints = status === 'completed' ? currentEntryNumber - 2 : currentEntryNumber - 1;
    if (checkpoints.length !== expectedCheckpoints ||
        status === 'completed' && stack.entries.at(-1)?.execution !== 'manual-gate' ||
        new Set(checkpoints.map(checkpoint => checkpoint.sha)).size !== checkpoints.length)
        throw new Error('Sequence position disagrees with checkpoints');
    const reasons: SequenceBlockReason[] = ['source-drift', 'git-history', 'checkpoint-mismatch',
        'version-mismatch', 'head-drift', 'worktree-drift', 'interrupted', 'completion-unsupported',
        'run-failed', 'run-cancelled', 'authority-denied', 'validation-failed', 'capacity-exhausted', 'checkpoint-pending', 'checkpoint-failed'];
    const blockedReason = x.blockedReason === undefined ? undefined : select(x.blockedReason, reasons);
    if (blockedReason && status !== 'blocked' && status !== 'interrupted') throw new Error('Invalid sequence block reason');
    const taskId = x.taskId === undefined ? undefined : id(x.taskId);
    const runIds = x.runIds === undefined ? [] : array(x.runIds, 20, id);
    if (runIds.length && !taskId || new Set(runIds).size !== runIds.length ||
        taskId && stack.entries[currentEntryNumber - 1]?.execution !== 'agent-task')
        throw new Error('Invalid sequence task/run identity');
    const acceptedDirty = x.acceptedDirty === undefined ? undefined : parseSequenceDirty(x.acceptedDirty);
    if (acceptedDirty && acceptedDirty.head !== (checkpoints.at(-1)?.sha ?? basisValue.head))
        throw new Error('Accepted dirty HEAD differs from sequence basis');
    return freeze({ version: SEQUENCE_SCHEMA_VERSION, id: id(x.id), createdAt, updatedAt,
        status, currentEntryNumber, stack, basis: { head: basisValue.head, packageVersion: basisValue.packageVersion,
            worktreeFingerprint: basisValue.worktreeFingerprint }, checkpoints,
        ...(blockedReason ? { blockedReason } : {}), ...(taskId ? { taskId } : {}),
        ...(runIds.length ? { runIds } : {}), ...(acceptedDirty ? { acceptedDirty } : {}) });
}
function parseSequenceDirty(value: unknown): AcceptedDirtyBasis {
    const basis = record(value, ['head', 'paths']);
    if (typeof basis.head !== 'string' || !/^[a-f0-9]{40,64}$/u.test(basis.head)) throw new Error('Invalid dirty HEAD');
    const paths = array(basis.paths, 500, item => {
        const entry = record(item, ['path', 'code', 'hash', 'size', 'mode']);
        const path = String(entry.path);
        if (path === '.dope/agent' || path.startsWith('.dope/agent/') ||
            path.split('/').some(part => ['.dope', '.codex', '.ssh', '.aws', '.npmrc', '.yarnrc'].includes(part) ||
                part === '.env' || part.startsWith('.env.') || part.endsWith('.pem') || part.endsWith('.key')))
            throw new Error('Invalid dirty path');
        const code = select(entry.code, [' M', ' D', '??'] as const);
        const size = integer(entry.size, 32 * 1024 * 1024);
        if (code === ' D' ? entry.hash !== null || size !== 0 || entry.mode !== null :
            typeof entry.hash !== 'string' || !/^[a-f0-9]{64}$/u.test(entry.hash))
            throw new Error('Invalid dirty hash');
        const mode = code === ' D' ? null : integer(entry.mode, 0o777);
        return { path: idPath(path), code, hash: entry.hash as string | null, size, mode };
    });
    if (new Set(paths.map(item => item.path)).size !== paths.length) throw new Error('Duplicate dirty path');
    return { head: basis.head, paths };
}
function idPath(path: string): string {
    if (path.startsWith('/') || path.includes('\\') || path.includes(':') ||
        path.split('/').some(part => !part || part === '.' || part === '..' || part === '.git'))
        throw new Error('Invalid dirty path');
    return path;
}
export function phaseStackTaskMetadata(stack: ImportedStack, entryNumber: number): PhaseStackTaskMetadata {
    const entry = stack.entries[entryNumber - 1];
    if (!entry || entry.number !== entryNumber || entry.execution !== 'agent-task')
        throw new Error('Entry is not an executable AgentTask');
    return freeze({ objective: entry.title, instructions: entry.promptText,
        origin: { kind: 'phase-stack', promptId: `${stack.folderName}-P${entry.number}-${stack.fingerprint.slice(0, 12)}` },
        controls: { reasoningEffort: entry.recommendation.reasoning },
        recommendedModel: entry.recommendation.model, versionPolicy: entry.versionPolicy,
        stackFingerprint: stack.fingerprint });
}
