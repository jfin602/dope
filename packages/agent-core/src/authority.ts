import { AGENT_SCHEMA_VERSION, bool, freeze, id, integer, projectPath, record, select, timestamp } from './contracts';

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
/** The 8B profile is fixed; a later broader profile needs an explicit product decision. */
export function parseExecutionGrant(value: unknown): ExecutionGrant {
    const x = record(value, ['version', 'id', 'revision', 'taskId', 'projectRoot',
        'acceptedAt', 'acceptedBy', 'permissions']);
    if (x.version !== AGENT_SCHEMA_VERSION || x.projectRoot !== '.' || x.acceptedBy !== 'developer')
        throw new Error('Invalid accepted execution grant');
    const permissions = record(x.permissions, EFFECT_KINDS);
    if (Object.keys(permissions).length !== EFFECT_KINDS.length) throw new Error('Incomplete grant permissions');
    const parsed = {} as Record<EffectKind, boolean>;
    for (const kind of EFFECT_KINDS) {
        parsed[kind] = bool(permissions[kind]);
        if (parsed[kind] !== defaults[kind]) throw new Error('Unsupported 8B grant permission');
    }
    return freeze({ version: AGENT_SCHEMA_VERSION, id: id(x.id), revision: integer(x.revision),
        taskId: id(x.taskId), projectRoot: '.', acceptedAt: timestamp(x.acceptedAt),
        acceptedBy: 'developer', permissions: parsed });
}
export function createDefaultExecutionGrant(input: { id: string; revision: number; taskId: string;
    acceptedAt: string }): ExecutionGrant {
    return parseExecutionGrant({ version: AGENT_SCHEMA_VERSION, ...input, projectRoot: '.',
        acceptedBy: 'developer', permissions: defaults });
}
/** A new revision is a new accepted record. Prior revisions remain unchanged. */
export function reviseExecutionGrant(previous: ExecutionGrant, acceptedAt: string): ExecutionGrant {
    const accepted = parseExecutionGrant(previous);
    return createDefaultExecutionGrant({ id: accepted.id, revision: accepted.revision + 1,
        taskId: accepted.taskId, acceptedAt });
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
