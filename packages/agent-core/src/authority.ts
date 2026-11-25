import { AGENT_SCHEMA_VERSION, bool, freeze, id, integer, modelKey, projectPath, record, select, timestamp } from './contracts';
import { parseWorkToolSelection, type WorkToolSelection } from './work-tool-selection';

export type EffectKind = 'workspace-read' | 'workspace-write' | 'workspace-process' | 'workspace-test' |
    'workspace-build' | 'project-create' | 'project-modify' | 'project-delete' | 'project-rename' |
    'git-inspect' | 'git-write' | 'git-history' | 'network' | 'secrets' |
    'private-state' | 'outside-root' | 'destructive' | 'system' | 'package-admin';
export const EFFECT_KINDS: readonly EffectKind[] = freeze(['workspace-read', 'workspace-write',
    'workspace-process', 'workspace-test', 'workspace-build', 'project-create', 'project-modify',
    'project-delete', 'project-rename', 'git-inspect', 'git-write',
    'git-history', 'network', 'secrets', 'private-state', 'outside-root',
    'destructive', 'system', 'package-admin'] as const);
export interface ExecutionGrant {
    version: typeof AGENT_SCHEMA_VERSION; id: string; revision: number; taskId: string;
    projectRoot: '.'; acceptedAt: string; acceptedBy: 'developer';
    permissions: Readonly<Record<EffectKind, boolean>>;
    /** Separately accepted, single-call external observation. Absent in the default 8B grant. */
    mcpObservation?: WorkMCPObservationScope;
    /** Immutable per-run Pi exposure approval; absent on historical grants and hosted adapters. */
    toolSelection?: WorkToolSelection;
}
export interface WorkMCPObservationScope {
    projectKey: string; serverId: string; registrationRevision: number; catalogRevision: number; toolName: string;
    connectionId: string; modelId: string; maxCalls: 1; expiresAt: string;
}
/** A Work UI approval must be issued for this exact call after the candidate exists. */
export interface WorkMCPObservationCallApproval {
    grantId: string; grantRevision: number; taskId: string; projectKey: string;
    serverId: string; registrationRevision: number; catalogRevision: number; toolName: string;
    connectionId: string; modelId: string; workspaceId: string; candidateFingerprint: string;
    callId: string; approvedAt: string; approvedBy: 'developer';
}
/** Safe durable evidence shape: never store external response text or credentials here. */
export interface WorkMCPObservationReceipt {
    approval: WorkMCPObservationCallApproval; status: 'completed' | 'denied' | 'failed' | 'cancelled';
    dispatched: boolean; endedAt: string; outputSha256?: string;
}
export interface ProposedEffect { kind: EffectKind; path?: string; scope: 'workspace' | 'project' | 'outside-root' }
export type EffectDecision = { allowed: true; kind: EffectKind; grantId: string; grantRevision: number } |
    { allowed: false; kind: EffectKind; grantId: string; grantRevision: number;
        reason: 'outside-grant' | 'invalid-target' | 'unapproved-effect' };

const defaults: Readonly<Record<EffectKind, boolean>> = freeze({
    'workspace-read': true, 'workspace-write': true, 'workspace-process': true,
    'workspace-test': true, 'workspace-build': true, 'project-create': true,
    'project-modify': true, 'project-delete': false, 'project-rename': false,
    'git-inspect': true,
    'git-write': false, 'git-history': false, network: false, secrets: false,
    'private-state': false, 'outside-root': false, destructive: false,
    system: false, 'package-admin': false
});
/** Maximum permissions of the existing 8B Work profile; a reviewed grant may be narrower. */
export const WORK_PERMISSION_MAXIMUM = defaults;
/** The 8B profile is fixed; a later broader profile needs an explicit product decision. */
export function parseExecutionGrant(value: unknown): ExecutionGrant {
    const x = record(value, ['version', 'id', 'revision', 'taskId', 'projectRoot',
        'acceptedAt', 'acceptedBy', 'permissions', 'mcpObservation', 'toolSelection']);
    if (x.version !== AGENT_SCHEMA_VERSION || x.projectRoot !== '.' || x.acceptedBy !== 'developer')
        throw new Error('Invalid accepted execution grant');
    const permissions = record(x.permissions, EFFECT_KINDS);
    if (Object.keys(permissions).length !== EFFECT_KINDS.length) throw new Error('Incomplete grant permissions');
    const parsed = {} as Record<EffectKind, boolean>;
    for (const kind of EFFECT_KINDS) {
        parsed[kind] = bool(permissions[kind]);
        if (parsed[kind] && !defaults[kind]) throw new Error('Unsupported 8B grant permission');
    }
    const acceptedAt = timestamp(x.acceptedAt);
    const toolSelection = x.toolSelection === undefined ? undefined : parseWorkToolSelection(x.toolSelection);
    if (toolSelection && (toolSelection.taskId !== x.taskId || toolSelection.grantRevision !== x.revision))
        throw new Error('Work tool selection does not match grant');
    let mcpObservation: WorkMCPObservationScope | undefined;
    if (x.mcpObservation !== undefined) {
        const scope = record(x.mcpObservation, ['projectKey', 'serverId', 'registrationRevision', 'catalogRevision',
            'toolName', 'connectionId', 'modelId', 'maxCalls', 'expiresAt']);
        const projectKey = scope.projectKey;
        const serverId = scope.serverId;
        const toolName = scope.toolName;
        if (typeof projectKey !== 'string' || !/^[a-f0-9]{64}$/u.test(projectKey) ||
            typeof serverId !== 'string' || !/^[a-z][a-z0-9-]{0,79}$/u.test(serverId) ||
            typeof toolName !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/u.test(toolName) ||
            integer(scope.registrationRevision) < 1 || integer(scope.catalogRevision) < 1 || scope.maxCalls !== 1)
            throw new Error('Invalid Work MCP observation scope');
        const expiresAt = timestamp(scope.expiresAt);
        if (Date.parse(expiresAt) <= Date.parse(acceptedAt) ||
            Date.parse(expiresAt) - Date.parse(acceptedAt) > 30 * 60_000)
            throw new Error('Invalid Work MCP observation expiry');
        mcpObservation = { projectKey, serverId, registrationRevision: scope.registrationRevision as number,
            catalogRevision: scope.catalogRevision as number,
            toolName, connectionId: id(scope.connectionId), modelId: modelKey(scope.modelId),
            maxCalls: 1, expiresAt };
    }
    return freeze({ version: AGENT_SCHEMA_VERSION, id: id(x.id), revision: integer(x.revision),
        taskId: id(x.taskId), projectRoot: '.', acceptedAt,
        acceptedBy: 'developer', permissions: parsed, ...(mcpObservation ? { mcpObservation } : {}),
        ...(toolSelection ? { toolSelection } : {}) });
}
export function createDefaultExecutionGrant(input: { id: string; revision: number; taskId: string;
    acceptedAt: string; toolSelection?: WorkToolSelection }): ExecutionGrant {
    return parseExecutionGrant({ version: AGENT_SCHEMA_VERSION, ...input, projectRoot: '.',
        acceptedBy: 'developer', permissions: defaults });
}
/** A new revision is a new accepted record. Prior revisions remain unchanged. */
export function reviseExecutionGrant(previous: ExecutionGrant, acceptedAt: string): ExecutionGrant {
    const accepted = parseExecutionGrant(previous);
    return createDefaultExecutionGrant({ id: accepted.id, revision: accepted.revision + 1,
        taskId: accepted.taskId, acceptedAt });
}
/** Called only after the developer accepts the named server/method in Work review. */
export function createMCPObservationExecutionGrant(input: { id: string; revision: number; taskId: string;
    acceptedAt: string; mcpObservation: WorkMCPObservationScope; toolSelection?: WorkToolSelection }): ExecutionGrant {
    return parseExecutionGrant({ version: AGENT_SCHEMA_VERSION, ...input, projectRoot: '.',
        acceptedBy: 'developer', permissions: defaults });
}
export function parseWorkMCPObservationCallApproval(value: unknown): WorkMCPObservationCallApproval {
    const x = record(value, ['grantId', 'grantRevision', 'taskId', 'projectKey', 'serverId',
        'registrationRevision', 'catalogRevision', 'toolName', 'connectionId', 'modelId', 'workspaceId',
        'candidateFingerprint', 'callId', 'approvedAt', 'approvedBy']);
    if (x.approvedBy !== 'developer' || typeof x.projectKey !== 'string' ||
        !/^[a-f0-9]{64}$/u.test(x.projectKey) || typeof x.serverId !== 'string' ||
        !/^[a-z][a-z0-9-]{0,79}$/u.test(x.serverId) ||
        typeof x.toolName !== 'string' || !/^[A-Za-z][A-Za-z0-9_.-]{0,127}$/u.test(x.toolName) ||
        typeof x.candidateFingerprint !== 'string' || !/^[a-f0-9]{64}$/u.test(x.candidateFingerprint) ||
        integer(x.registrationRevision) < 1 || integer(x.catalogRevision) < 1)
        throw new Error('Invalid Work MCP observation approval');
    return freeze({ grantId: id(x.grantId), grantRevision: integer(x.grantRevision),
        taskId: id(x.taskId), projectKey: x.projectKey, serverId: x.serverId,
        registrationRevision: x.registrationRevision as number, catalogRevision: x.catalogRevision as number,
        toolName: x.toolName,
        connectionId: id(x.connectionId), modelId: modelKey(x.modelId),
        workspaceId: id(x.workspaceId), candidateFingerprint: x.candidateFingerprint,
        callId: id(x.callId), approvedAt: timestamp(x.approvedAt), approvedBy: 'developer' });
}
export function parseWorkMCPObservationReceipt(value: unknown): WorkMCPObservationReceipt {
    const x = record(value, ['approval', 'status', 'dispatched', 'endedAt', 'outputSha256']);
    const approval = parseWorkMCPObservationCallApproval(x.approval);
    const status = select(x.status, ['completed', 'denied', 'failed', 'cancelled'] as const);
    const dispatched = bool(x.dispatched);
    const endedAt = timestamp(x.endedAt);
    if (Date.parse(endedAt) < Date.parse(approval.approvedAt) ||
        (status === 'completed') !== (x.outputSha256 !== undefined) ||
        status === 'completed' && !dispatched || status === 'denied' && dispatched ||
        x.outputSha256 !== undefined && (typeof x.outputSha256 !== 'string' ||
            !/^[a-f0-9]{64}$/u.test(x.outputSha256)))
        throw new Error('Invalid Work MCP observation receipt');
    return freeze({ approval, status, dispatched, endedAt,
        ...(x.outputSha256 === undefined ? {} : { outputSha256: x.outputSha256 as string }) });
}
/** A pure gate; P7 must obtain the approval from its trusted UI owner and count consumed calls. */
export function checkWorkMCPObservationApproval(grant: ExecutionGrant,
    approval: WorkMCPObservationCallApproval, current: Omit<WorkMCPObservationCallApproval,
        'approvedAt' | 'approvedBy'>, callsUsed: number, now = new Date().toISOString()): boolean {
    const accepted = parseExecutionGrant(grant);
    const scope = accepted.mcpObservation;
    let checkedApproval: WorkMCPObservationCallApproval;
    let checkedNow: string;
    try { checkedApproval = parseWorkMCPObservationCallApproval(approval); checkedNow = timestamp(now); }
    catch { return false; }
    if (!scope || !Number.isSafeInteger(callsUsed) || callsUsed !== 0 ||
        Date.parse(checkedNow) > Date.parse(scope.expiresAt) ||
        Date.parse(checkedApproval.approvedAt) < Date.parse(accepted.acceptedAt) ||
        Date.parse(checkedApproval.approvedAt) > Date.parse(checkedNow) ||
        Date.parse(checkedApproval.approvedAt) > Date.parse(scope.expiresAt)) return false;
    for (const key of ['grantId', 'grantRevision', 'taskId', 'projectKey', 'serverId',
        'registrationRevision', 'catalogRevision', 'toolName', 'connectionId', 'modelId', 'workspaceId',
        'candidateFingerprint', 'callId'] as const)
        if (checkedApproval[key] !== current[key]) return false;
    return checkedApproval.grantId === accepted.id && checkedApproval.grantRevision === accepted.revision &&
        checkedApproval.taskId === accepted.taskId && checkedApproval.projectKey === scope.projectKey &&
        checkedApproval.serverId === scope.serverId &&
        checkedApproval.registrationRevision === scope.registrationRevision &&
        checkedApproval.catalogRevision === scope.catalogRevision &&
        checkedApproval.toolName === scope.toolName && checkedApproval.connectionId === scope.connectionId &&
        checkedApproval.modelId === scope.modelId;
}
export function parseProposedEffect(value: unknown): ProposedEffect {
    const x = record(value, ['kind', 'path', 'scope']);
    const kind = select(x.kind, EFFECT_KINDS);
    const scope = select(x.scope, ['workspace', 'project', 'outside-root'] as const);
    if (x.path !== undefined && typeof x.path !== 'string') throw new Error('Invalid effect path');
    return { kind, scope, ...(x.path === undefined ? {} : { path: x.path }) };
}
/** Fail closed on malformed or unscoped targets. The caller must classify effects from observed
 * operation and canonicalized host paths; provider prose is never an effect classification. */
export function checkEffect(grant: ExecutionGrant, proposed: unknown): EffectDecision {
    const approved = parseExecutionGrant(grant);
    let effect: ProposedEffect;
    try { effect = parseProposedEffect(proposed); }
    catch { return { allowed: false, kind: 'outside-root', grantId: approved.id,
        grantRevision: approved.revision, reason: 'invalid-target' }; }
    const base = { kind: effect.kind, grantId: approved.id, grantRevision: approved.revision };
    if (effect.scope === 'outside-root') return { ...base, allowed: false, reason: 'outside-grant' };
    if (effect.kind.startsWith('workspace-') && effect.scope !== 'workspace' ||
        effect.kind.startsWith('project-') && effect.scope !== 'project' ||
        effect.kind === 'git-inspect' && effect.scope !== 'workspace')
        return { ...base, allowed: false, reason: 'invalid-target' };
    if (effect.path !== undefined) {
        try { projectPath(effect.path, ['workspace-read', 'workspace-process', 'workspace-test', 'workspace-build', 'git-inspect'].includes(effect.kind)); }
        catch { return { ...base, allowed: false, reason: 'invalid-target' }; }
    }
    if (approved.permissions[effect.kind] && !effect.path)
        return { ...base, allowed: false, reason: 'invalid-target' };
    return approved.permissions[effect.kind] ? { ...base, allowed: true } :
        { ...base, allowed: false, reason: 'unapproved-effect' };
}
