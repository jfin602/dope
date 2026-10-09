import { AGENT_SCHEMA_VERSION, bounded, freeze, id, integer, projectPath, record, select, timestamp } from './contracts';
import { checkEffect, createDefaultExecutionGrant, ExecutionGrant, EFFECT_KINDS, ProposedEffect } from './authority';

export type ProposedActionDecision = 'acknowledged' | 'rejected';
export interface ProposedAction {
    version: typeof AGENT_SCHEMA_VERSION; id: string; revision: number;
    taskId: string; runId: string; createdAt: string;
    effect: ProposedEffect;
    requiredAuthority: 'expanded-grant' | 'delegation-scope' | 'human-reserved-scope';
    rationale: string;
    decision?: { kind: ProposedActionDecision; at: string; by: 'developer' };
}

/** A record describes a blocked request. It carries no execution capability. */
export function parseProposedAction(value: unknown): ProposedAction {
    const x = record(value, ['version', 'id', 'revision', 'taskId', 'runId', 'createdAt',
        'effect', 'requiredAuthority', 'rationale', 'decision']);
    if (x.version !== AGENT_SCHEMA_VERSION) throw new Error('Invalid ProposedAction version');
    const target = record(x.effect, ['kind', 'scope', 'path']);
    const kind = select(target.kind, EFFECT_KINDS);
    const scope = select(target.scope, ['workspace', 'project', 'outside-root'] as const);
    // Never retain an absolute/private host path in project-local state.
    if (scope === 'outside-root' && target.path !== undefined) throw new Error('Outside-root path cannot be persisted');
    const effect: ProposedEffect = { kind, scope,
        ...(target.path === undefined ? {} : { path: projectPath(target.path) }) };
    const requiredAuthority = select(x.requiredAuthority, ['expanded-grant', 'delegation-scope', 'human-reserved-scope'] as const);
    if (requiredAuthority !== 'expanded-grant' &&
        (scope !== 'project' || !['project-create', 'project-modify'].includes(kind) || !effect.path))
        throw new Error('Invalid human-reserved action');
    if (requiredAuthority === 'expanded-grant' && checkEffect(createDefaultExecutionGrant({
        id: 'proposed-action-profile', revision: 0, taskId: id(x.taskId),
        acceptedAt: '2026-01-01T00:00:00Z' }), effect).allowed)
        throw new Error('Routine in-grant effect needs no ProposedAction');
    let decision: ProposedAction['decision'];
    if (x.decision !== undefined) {
        const d = record(x.decision, ['kind', 'at', 'by']);
        if (d.by !== 'developer') throw new Error('Only developer decisions are recorded');
        decision = { kind: select(d.kind, ['acknowledged', 'rejected'] as const),
            at: timestamp(d.at), by: 'developer' };
    }
    const createdAt = timestamp(x.createdAt);
    if (decision && decision.at < createdAt) throw new Error('Decision predates action');
    const revision = integer(x.revision);
    if (revision !== (decision ? 1 : 0)) throw new Error('Invalid ProposedAction revision');
    return freeze({ version: AGENT_SCHEMA_VERSION, id: id(x.id), revision,
        taskId: id(x.taskId), runId: id(x.runId), createdAt, effect,
        requiredAuthority, rationale: bounded(x.rationale, 1000, 'action rationale'),
        ...(decision ? { decision } : {}) });
}

/** Routine in-grant effects do not produce actions. Human-reserved scope is independently blocking. */
export function createBlockedProposedAction(input: Omit<ProposedAction, 'version' | 'revision' | 'decision' | 'requiredAuthority'> &
    { grant: ExecutionGrant; scopeBlock?: 'delegation-scope' | 'human-reserved-scope' }): ProposedAction {
    const { grant, scopeBlock, ...fields } = input;
    if (grant.taskId !== fields.taskId) throw new Error('ProposedAction task/grant mismatch');
    const effect = fields.effect;
    const denied = checkEffect(grant, effect);
    if (denied.allowed && !scopeBlock) throw new Error('Routine in-grant effect needs no ProposedAction');
    return parseProposedAction({ version: AGENT_SCHEMA_VERSION, revision: 0, ...fields,
        requiredAuthority: denied.allowed ? scopeBlock : 'expanded-grant' });
}

export function decideProposedAction(action: ProposedAction, kind: ProposedActionDecision,
    at: string, expectedRevision: number): ProposedAction {
    const current = parseProposedAction(action);
    if (expectedRevision !== current.revision) throw new Error('Stale ProposedAction revision');
    if (current.decision) throw new Error('ProposedAction already decided');
    return parseProposedAction({ ...current, revision: 1,
        decision: { kind, at, by: 'developer' } });
}
