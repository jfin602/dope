/** Portable, provider-neutral Phase 8B execution records. All persisted input goes through parsers. */
export const AGENT_SCHEMA_VERSION = 1 as const;
export type AgentOrigin =
    | { kind: 'direct' }
    | { kind: 'phase-stack'; promptId: string }
    | { kind: 'work-item'; workItemId: string }
    | { kind: 'future-session'; sessionId: string };
export type AgentModelPolicy =
    | { kind: 'follow-coding-agent' }
    | { kind: 'exact'; connectionId: string; modelId: string };
export type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
export interface ExecutionControls { reasoningEffort?: ReasoningEffort }
export interface ValidationTarget { kind: 'test' | 'build' | 'typecheck'; label: string; command?: string }
export interface CompletionPolicy { validation: ValidationTarget[]; requireValidationPass: boolean }
export interface AgentTask {
    version: typeof AGENT_SCHEMA_VERSION; id: string; createdAt: string;
    objective: string; instructions: string; projectRoot: '.';
    projectId?: string; modelPolicy: AgentModelPolicy; controls: ExecutionControls;
    authority: { profile: 'phase-8b-project' }; completion: CompletionPolicy;
    origin: AgentOrigin; planningMapId?: string;
}
export type AgentRunStatus = 'pending' | 'running' | 'blocked' | 'cancelling' |
    'cancelled' | 'failed' | 'completed' | 'interrupted';
export interface ExecutionProvenance {
    version: typeof AGENT_SCHEMA_VERSION; connectionId: string; modelId: string;
    providerId: string; runtimeKind: 'local' | 'hosted'; adapterId: string; policyRevision?: number;
}
export interface ValidationResult {
    version: typeof AGENT_SCHEMA_VERSION; kind: ValidationTarget['kind']; label: string;
    status: 'passed' | 'failed' | 'skipped'; durationMs?: number; summary?: string;
}
export interface ChangeSummary {
    version: typeof AGENT_SCHEMA_VERSION; filesChanged: number; insertions: number;
    deletions: number; summary: string; truncated: boolean;
}
export interface GitBasis { head: string | null; clean: boolean; metadataChanged?: boolean }
export interface GitFinal {
    head: string | null; clean: boolean; headChanged: boolean; metadataChanged: boolean;
    statuses: { code: string; path: string; previousPath?: string }[]; truncated: boolean;
}
export interface CommandEvidence {
    version: typeof AGENT_SCHEMA_VERSION; commandSummary: string; durationMs: number;
    exitCode: number; result: 'passed' | 'failed'; matchedTargets: string[];
}
export interface AgentRun {
    version: typeof AGENT_SCHEMA_VERSION; id: string; taskId: string; status: AgentRunStatus;
    grantId: string; grantRevision: number; requestedPolicy: AgentModelPolicy;
    projectRoot: '.'; projectId?: string; createdAt: string; startedAt?: string; endedAt?: string;
    provenance?: ExecutionProvenance; basis?: GitBasis; finalGit?: GitFinal; changedFiles: string[];
    commandEvidence?: CommandEvidence[];
    validationResults: ValidationResult[]; changeSummary?: ChangeSummary;
    recovery?: { adapterId: string; handle: string }; outcome?: { code: 'authority-denied' | 'provider-error' |
        'validation-failed' | 'cancelled' | 'interrupted' | 'other'; summary: string };
}
export interface AgentRunEvent {
    version: typeof AGENT_SCHEMA_VERSION; runId: string; sequence: number; at: string;
    kind: 'status' | 'file' | 'process' | 'validation' | 'authority' | 'message';
    summary: string; path?: string; status?: AgentRunStatus;
}

export function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (value === null || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(key => !keys.includes(key))) throw new Error('Invalid agent record fields');
    return value as Record<string, unknown>;
}
export function select<T extends string>(value: unknown, values: readonly T[]): T {
    if (typeof value !== 'string' || !values.includes(value as T)) throw new Error('Invalid agent enum');
    return value as T;
}
export function bounded(value: unknown, max: number, name = 'text'): string {
    if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))
        throw new Error(`Invalid agent ${name}`);
    return value;
}
export function id(value: unknown): string {
    const result = bounded(value, 120, 'identity');
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(result) || result === '.' || result === '..')
        throw new Error('Invalid agent identity');
    return result;
}
export function modelKey(value: unknown): string {
    const result = bounded(value, 200, 'model key');
    if (!/^[A-Za-z0-9][A-Za-z0-9._:/+-]*$/u.test(result) || result.includes('://'))
        throw new Error('Invalid model key');
    return result;
}
export function integer(value: unknown, max = Number.MAX_SAFE_INTEGER): number {
    if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > max)
        throw new Error('Invalid agent integer');
    return value as number;
}
export function bool(value: unknown): boolean {
    if (typeof value !== 'boolean') throw new Error('Invalid agent boolean');
    return value;
}
export function timestamp(value: unknown): string {
    const result = bounded(value, 35, 'timestamp');
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/u.test(result) ||
        Number.isNaN(Date.parse(result))) throw new Error('Invalid agent timestamp');
    return result;
}
export function projectPath(value: unknown, root = false): string {
    if (root && value === '.') return '.';
    const path = bounded(value, 1024, 'project path');
    if (path === '.' || path.startsWith('/') || path.includes('\\') || path.includes(':') ||
        path.split('/').some(segment => !segment || segment === '.' || segment === '..') ||
        path.startsWith('~') || path.split('/').some(segment => segment.toLowerCase() === '.git'))
        throw new Error('Invalid project path');
    return path;
}
export function array<T>(value: unknown, limit: number, parse: (item: unknown) => T): T[] {
    if (!Array.isArray(value) || value.length > limit) throw new Error('Invalid agent array');
    return value.map(parse);
}
export function freeze<T>(value: T): T {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const nested of Object.values(value)) freeze(nested);
        Object.freeze(value);
    }
    return value;
}
function version(value: unknown): typeof AGENT_SCHEMA_VERSION {
    if (value !== AGENT_SCHEMA_VERSION) throw new Error('Invalid agent schema version');
    return AGENT_SCHEMA_VERSION;
}
export function parseAgentModelPolicy(value: unknown): AgentModelPolicy {
    const kind = record(value, ['kind', 'connectionId', 'modelId']).kind;
    if (kind === 'follow-coding-agent') {
        record(value, ['kind']); return { kind };
    }
    if (kind === 'exact') {
        const item = record(value, ['kind', 'connectionId', 'modelId']);
        return { kind, connectionId: id(item.connectionId), modelId: modelKey(item.modelId) };
    }
    throw new Error('Invalid agent model policy');
}
export function parseAgentTask(value: unknown): AgentTask {
    const x = record(value, ['version', 'id', 'createdAt', 'objective', 'instructions', 'projectRoot',
        'projectId', 'modelPolicy', 'controls', 'authority', 'completion', 'origin', 'planningMapId']);
    const controls = record(x.controls, ['reasoningEffort']);
    const authority = record(x.authority, ['profile']);
    const completion = record(x.completion, ['validation', 'requireValidationPass']);
    const origin = record(x.origin, ['kind', 'promptId', 'workItemId', 'sessionId']);
    const kind = select(origin.kind, ['direct', 'phase-stack', 'work-item', 'future-session'] as const);
    const originKeys = { direct: ['kind'], 'phase-stack': ['kind', 'promptId'],
        'work-item': ['kind', 'workItemId'], 'future-session': ['kind', 'sessionId'] } as const;
    record(x.origin, originKeys[kind]);
    const parsedOrigin: AgentOrigin = kind === 'direct' ? { kind } : kind === 'phase-stack' ?
        { kind, promptId: id(origin.promptId) } : kind === 'work-item' ?
            { kind, workItemId: id(origin.workItemId) } : { kind, sessionId: id(origin.sessionId) };
    const validation = array(completion.validation, 12, item => {
        const target = record(item, ['kind', 'label', 'command']);
        return { kind: select(target.kind, ['test', 'build', 'typecheck'] as const), label: bounded(target.label, 160),
            ...(target.command === undefined ? {} : { command: bounded(target.command, 160) }) };
    });
    if (authority.profile !== 'phase-8b-project') throw new Error('Invalid authority profile');
    if (projectPath(x.projectRoot, true) !== '.') throw new Error('Invalid project root');
    return freeze({ version: version(x.version), id: id(x.id), createdAt: timestamp(x.createdAt),
        objective: bounded(x.objective, 1000), instructions: bounded(x.instructions, 20000), projectRoot: '.',
        ...(x.projectId === undefined ? {} : { projectId: id(x.projectId) }),
        modelPolicy: parseAgentModelPolicy(x.modelPolicy),
        controls: { ...(controls.reasoningEffort === undefined ? {} :
            { reasoningEffort: select(controls.reasoningEffort, ['low', 'medium', 'high', 'xhigh'] as const) }) },
        authority: { profile: 'phase-8b-project' },
        completion: { validation, requireValidationPass: bool(completion.requireValidationPass) },
        origin: parsedOrigin, ...(x.planningMapId === undefined ? {} : { planningMapId: id(x.planningMapId) }) });
}
export function parseExecutionProvenance(value: unknown): ExecutionProvenance {
    const x = record(value, ['version', 'connectionId', 'modelId', 'providerId', 'runtimeKind', 'adapterId', 'policyRevision']);
    return freeze({ version: version(x.version), connectionId: id(x.connectionId), modelId: modelKey(x.modelId),
        providerId: id(x.providerId), runtimeKind: select(x.runtimeKind, ['local', 'hosted'] as const), adapterId: id(x.adapterId),
        ...(x.policyRevision === undefined ? {} : { policyRevision: integer(x.policyRevision) }) });
}
export function parseValidationResult(value: unknown): ValidationResult {
    const x = record(value, ['version', 'kind', 'label', 'status', 'durationMs', 'summary']);
    return freeze({ version: version(x.version), kind: select(x.kind, ['test', 'build', 'typecheck'] as const),
        label: bounded(x.label, 160), status: select(x.status, ['passed', 'failed', 'skipped'] as const),
        ...(x.durationMs === undefined ? {} : { durationMs: integer(x.durationMs, 86_400_000) }),
        ...(x.summary === undefined ? {} : { summary: bounded(x.summary, 1000) }) });
}
export function parseChangeSummary(value: unknown): ChangeSummary {
    const x = record(value, ['version', 'filesChanged', 'insertions', 'deletions', 'summary', 'truncated']);
    return freeze({ version: version(x.version), filesChanged: integer(x.filesChanged, 100_000),
        insertions: integer(x.insertions, 10_000_000), deletions: integer(x.deletions, 10_000_000),
        summary: bounded(x.summary, 2000), truncated: bool(x.truncated) });
}
export function parseGitFinal(value: unknown): GitFinal {
    const x = record(value, ['head', 'clean', 'headChanged', 'metadataChanged', 'statuses', 'truncated']);
    return freeze({ head: x.head === null ? null : id(x.head), clean: bool(x.clean),
        headChanged: bool(x.headChanged), metadataChanged: bool(x.metadataChanged),
        statuses: array(x.statuses, 500, item => {
            const entry = record(item, ['code', 'path', 'previousPath']);
            return { code: bounded(entry.code, 2), path: projectPath(entry.path),
                ...(entry.previousPath === undefined ? {} : { previousPath: projectPath(entry.previousPath) }) };
        }), truncated: bool(x.truncated) });
}
export function parseCommandEvidence(value: unknown): CommandEvidence {
    const x = record(value, ['version', 'commandSummary', 'durationMs', 'exitCode', 'result', 'matchedTargets']);
    if (typeof x.exitCode !== 'number' || !Number.isSafeInteger(x.exitCode) || x.exitCode < -1 || x.exitCode > 255)
        throw new Error('Invalid command exit code');
    return freeze({ version: version(x.version), commandSummary: bounded(x.commandSummary, 160),
        durationMs: integer(x.durationMs, 86_400_000), exitCode: x.exitCode,
        result: select(x.result, ['passed', 'failed'] as const),
        matchedTargets: array(x.matchedTargets, 12, item => bounded(item, 160)) });
}
export const RUN_STATUSES = freeze(['pending', 'running', 'blocked', 'cancelling',
    'cancelled', 'failed', 'completed', 'interrupted'] as const);
export function parseAgentRunStatus(value: unknown): AgentRunStatus { return select(value, RUN_STATUSES); }
export function parseAgentRun(value: unknown): AgentRun {
    const x = record(value, ['version', 'id', 'taskId', 'status', 'grantId', 'grantRevision', 'requestedPolicy',
        'projectRoot', 'projectId', 'createdAt', 'startedAt', 'endedAt', 'provenance', 'basis',
        'changedFiles', 'validationResults', 'changeSummary', 'finalGit', 'commandEvidence', 'recovery', 'outcome']);
    if (projectPath(x.projectRoot, true) !== '.') throw new Error('Invalid project root');
    const status = parseAgentRunStatus(x.status);
    const basis = x.basis === undefined ? undefined : record(x.basis, ['head', 'clean', 'metadataChanged']);
    const recovery = x.recovery === undefined ? undefined : record(x.recovery, ['adapterId', 'handle']);
    const outcome = x.outcome === undefined ? undefined : record(x.outcome, ['code', 'summary']);
    const changedFiles = array(x.changedFiles, 500, item => projectPath(item));
    if (new Set(changedFiles).size !== changedFiles.length) throw new Error('Duplicate changed file');
    const startedAt = x.startedAt === undefined ? undefined : timestamp(x.startedAt);
    const endedAt = x.endedAt === undefined ? undefined : timestamp(x.endedAt);
    const terminal = ['cancelled', 'failed', 'completed', 'interrupted'].includes(status);
    if (x.finalGit !== undefined && !terminal) throw new Error('Final Git evidence requires terminal run');
    if ((status === 'pending' && (startedAt || endedAt)) ||
        (status !== 'pending' && !startedAt) || terminal !== Boolean(endedAt))
        throw new Error('Invalid run lifecycle timestamps');
    if (startedAt && startedAt < timestamp(x.createdAt) || endedAt && startedAt && endedAt < startedAt)
        throw new Error('Invalid run timestamp order');
    return freeze({ version: version(x.version), id: id(x.id), taskId: id(x.taskId), status,
        grantId: id(x.grantId), grantRevision: integer(x.grantRevision),
        requestedPolicy: parseAgentModelPolicy(x.requestedPolicy), projectRoot: '.',
        ...(x.projectId === undefined ? {} : { projectId: id(x.projectId) }),
        createdAt: timestamp(x.createdAt), ...(startedAt ? { startedAt } : {}), ...(endedAt ? { endedAt } : {}),
        ...(x.provenance === undefined ? {} : { provenance: parseExecutionProvenance(x.provenance) }),
        ...(basis === undefined ? {} : { basis: { head: basis.head === null ? null : id(basis.head),
            clean: bool(basis.clean), ...(basis.metadataChanged === undefined ? {} :
                { metadataChanged: bool(basis.metadataChanged) }) } }), changedFiles,
        validationResults: array(x.validationResults, 24, parseValidationResult),
        ...(x.commandEvidence === undefined ? {} : { commandEvidence: array(x.commandEvidence, 24, parseCommandEvidence) }),
        ...(x.finalGit === undefined ? {} : { finalGit: parseGitFinal(x.finalGit) }),
        ...(x.changeSummary === undefined ? {} : { changeSummary: parseChangeSummary(x.changeSummary) }),
        ...(recovery === undefined ? {} : { recovery: { adapterId: id(recovery.adapterId),
            handle: bounded(recovery.handle, 256) } }),
        ...(outcome === undefined ? {} : { outcome: { code: select(outcome.code,
            ['authority-denied', 'provider-error', 'validation-failed', 'cancelled', 'interrupted', 'other'] as const),
            summary: bounded(outcome.summary, 1000) } }) });
}
export function parseAgentRunEvent(value: unknown): AgentRunEvent {
    const x = record(value, ['version', 'runId', 'sequence', 'at', 'kind', 'summary', 'path', 'status']);
    const kind = select(x.kind, ['status', 'file', 'process', 'validation', 'authority', 'message'] as const);
    if ((kind === 'file') !== (x.path !== undefined) || (kind === 'status') !== (x.status !== undefined))
        throw new Error('Invalid agent event details');
    return freeze({ version: version(x.version), runId: id(x.runId), sequence: integer(x.sequence),
        at: timestamp(x.at), kind, summary: bounded(x.summary, 1000),
        ...(x.path === undefined ? {} : { path: projectPath(x.path) }),
        ...(x.status === undefined ? {} : { status: parseAgentRunStatus(x.status) }) });
}
