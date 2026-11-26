import { bounded, freeze, id, integer, record, select, timestamp } from './contracts';
import { EFFECT_KINDS, WORK_PERMISSION_MAXIMUM, type EffectKind, type ExecutionGrant } from './authority';
import type { AgentRun, ExecutionMode } from './contracts';

export type WorkSessionStatus = 'running' | 'awaiting-input' | 'finishing' |
    'completed' | 'stopped' | 'recovery-required';
export type WorkMessageStatus = 'queued' | 'delivering' | 'delivered' | 'abandoned';

/** A terminal authority denial is no-effect only when saved run and Git receipts agree. */
export function verifiedNoEffectWorkRun(run: AgentRun): boolean {
    return run.status === 'failed' && run.outcome?.code === 'authority-denied' &&
        !!run.basis?.clean && !run.basis.metadataChanged && !!run.finalGit?.clean &&
        !run.finalGit.truncated && !run.finalGit.statuses.length &&
        !run.finalGit.headChanged && !run.finalGit.metadataChanged &&
        run.finalGit.head === run.basis.head && !run.changedFiles.length &&
        !!run.candidateDelta && !run.candidateDelta.effects.length && !run.appliedFiles?.length &&
        !run.commandEvidence?.length && !run.candidateReview;
}

/** Unacknowledged delivery remains uncertain even when the Git tree is clean. */
export function verifiedNoEffectWorkSegment(run: AgentRun, session: WorkSession): boolean {
    return verifiedNoEffectWorkRun(run) && !session.messages.some(message =>
        (!run.startedAt || message.queuedAt >= run.startedAt) &&
        (message.status === 'delivering' || message.status === 'abandoned' && !!message.deliveryStartedAt)) &&
        session.candidateSnapshot?.runId !== run.id;
}

export interface WorkSessionMessage {
    id: string; text: string; queuedAt: string; status: WorkMessageStatus;
    deliveryStartedAt?: string; deliveredAt?: string; abandonedAt?: string;
}

export interface WorkSessionSegment {
    runId: string; taskId: string; grantId: string; grantRevision: number;
    basisHead: string; startedAt: string;
    /** Required for new segments. Absence on saved segments is preserved as legacy evidence. */
    executionMode?: ExecutionMode;
    /** Present for new segments; older saved segments retain their original run/task evidence. */
    connectionId?: string; modelId?: string; toolSelectionHash?: string; sandboxHash?: string;
    permissions?: ExecutionGrant['permissions'];
    prompt?: string;
}
export interface WorkCandidateSnapshot {
    id: string; runId: string; sequence: number; at: string; fingerprint: string; deltaHash: string;
}

/** A Work session is the durable conversation owner; an AgentRun remains immutable execution evidence. */
export interface WorkSession {
    version: 1; id: string; taskId: string; runId: string; createdAt: string;
    grantId: string; grantRevision: number; connectionId: string; modelId: string;
    toolSelectionHash: string; sandboxHash: string;
    permissionCeiling: ExecutionGrant['permissions'];
    status: WorkSessionStatus; revision: number; messages: WorkSessionMessage[];
    segments: WorkSessionSegment[]; candidateSnapshot?: WorkCandidateSnapshot;
}

const statusTransitions: Readonly<Record<WorkSessionStatus, readonly WorkSessionStatus[]>> = {
    running: ['awaiting-input', 'finishing', 'stopped', 'recovery-required'],
    'awaiting-input': ['running', 'finishing', 'stopped', 'recovery-required'],
    finishing: ['completed', 'stopped', 'recovery-required'],
    completed: ['running'], stopped: ['running'], 'recovery-required': ['running', 'stopped']
};
export function canTransitionWorkSession(from: WorkSessionStatus, to: WorkSessionStatus): boolean {
    return from === to || statusTransitions[from].includes(to);
}

const hash = (value: unknown): string => {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value))
        throw new Error('Invalid Work session binding hash');
    return value;
};

export function parseWorkSession(value: unknown): WorkSession {
    const x = record(value, ['version', 'id', 'taskId', 'runId', 'createdAt', 'grantId',
        'grantRevision', 'connectionId', 'modelId', 'toolSelectionHash', 'sandboxHash',
        'permissionCeiling', 'status', 'revision', 'messages', 'segments', 'candidateSnapshot']);
    if (x.version !== 1 || !Array.isArray(x.messages) || x.messages.length > 128 ||
        !Array.isArray(x.segments) || !x.segments.length || x.segments.length > 32)
        throw new Error('Invalid Work session');
    const segments = x.segments.map(raw => {
        const s = record(raw, ['runId', 'taskId', 'grantId', 'grantRevision', 'basisHead', 'startedAt',
            'connectionId', 'modelId', 'toolSelectionHash', 'sandboxHash', 'permissions', 'prompt', 'executionMode']);
        if (typeof s.basisHead !== 'string' || !/^[a-f0-9]{40}$/u.test(s.basisHead))
            throw new Error('Invalid Work segment basis');
        const permissions = s.permissions === undefined ? undefined : record(s.permissions, EFFECT_KINDS);
        if (permissions && EFFECT_KINDS.some(kind => typeof permissions[kind] !== 'boolean' ||
            permissions[kind] && !WORK_PERMISSION_MAXIMUM[kind]))
            throw new Error('Invalid Work segment permissions');
        return { runId: id(s.runId), taskId: id(s.taskId), grantId: id(s.grantId),
            grantRevision: integer(s.grantRevision), basisHead: s.basisHead, startedAt: timestamp(s.startedAt),
            ...(s.executionMode === undefined ? {} : { executionMode: select(s.executionMode, ['direct', 'isolated'] as const) }),
            ...(s.connectionId === undefined ? {} : { connectionId: id(s.connectionId) }),
            ...(s.modelId === undefined ? {} : { modelId: bounded(s.modelId, 200, 'model') }),
            ...(s.toolSelectionHash === undefined ? {} : { toolSelectionHash: hash(s.toolSelectionHash) }),
            ...(s.sandboxHash === undefined ? {} : { sandboxHash: hash(s.sandboxHash) }),
            ...(permissions === undefined ? {} : { permissions: freeze(permissions as Record<EffectKind, boolean>) }),
            ...(s.prompt === undefined ? {} : { prompt: bounded(s.prompt, 20_000, 'Work segment prompt') }) };
    });
    if (new Set(segments.map(segment => segment.runId)).size !== segments.length ||
        segments[0].runId !== x.runId || segments[0].taskId !== x.taskId ||
        segments[0].grantId !== x.grantId || segments[0].grantRevision !== x.grantRevision ||
        segments.some((segment, index) => index > 0 && segment.startedAt < segments[index - 1].startedAt))
        throw new Error('Invalid Work segment order');
    let candidateSnapshot: WorkCandidateSnapshot | undefined;
    const rawPermissions = record(x.permissionCeiling, EFFECT_KINDS);
    const permissionCeiling = {} as Record<EffectKind, boolean>;
    for (const kind of EFFECT_KINDS) {
        if (typeof rawPermissions[kind] !== 'boolean') throw new Error('Invalid Work permission ceiling');
        permissionCeiling[kind] = rawPermissions[kind] as boolean;
    }
    if (x.candidateSnapshot !== undefined) {
        const snapshot = record(x.candidateSnapshot, ['id', 'runId', 'sequence', 'at', 'fingerprint', 'deltaHash']);
        const fingerprint = hash(snapshot.fingerprint);
        const deltaHash = hash(snapshot.deltaHash);
        const runId = id(snapshot.runId);
        if (!segments.some(segment => segment.runId === runId) || integer(snapshot.sequence) < 1)
            throw new Error('Invalid Work candidate snapshot');
        candidateSnapshot = { id: id(snapshot.id), runId, sequence: snapshot.sequence as number, at: timestamp(snapshot.at),
            fingerprint, deltaHash };
    }
    const messages = x.messages.map(raw => {
        const m = record(raw, ['id', 'text', 'queuedAt', 'status', 'deliveryStartedAt', 'deliveredAt', 'abandonedAt']);
        const status = select(m.status, ['queued', 'delivering', 'delivered', 'abandoned'] as const);
        const queuedAt = timestamp(m.queuedAt);
        const deliveryStartedAt = m.deliveryStartedAt === undefined ? undefined : timestamp(m.deliveryStartedAt);
        const deliveredAt = m.deliveredAt === undefined ? undefined : timestamp(m.deliveredAt);
        const abandonedAt = m.abandonedAt === undefined ? undefined : timestamp(m.abandonedAt);
        if ((status === 'queued' || status === 'abandoned' && !deliveryStartedAt) !== (deliveryStartedAt === undefined) ||
            (status === 'delivered') !== (deliveredAt !== undefined) ||
            (status === 'abandoned') !== (abandonedAt !== undefined) ||
            deliveryStartedAt && deliveryStartedAt < queuedAt ||
            deliveredAt && deliveredAt < deliveryStartedAt! ||
            abandonedAt && (abandonedAt < queuedAt || deliveryStartedAt && abandonedAt < deliveryStartedAt))
            throw new Error('Invalid Work message delivery evidence');
        return { id: id(m.id), text: bounded(m.text, 16_000, 'Work message'), queuedAt,
            status, ...(deliveryStartedAt ? { deliveryStartedAt } : {}),
            ...(deliveredAt ? { deliveredAt } : {}), ...(abandonedAt ? { abandonedAt } : {}) };
    });
    if (new Set(messages.map(message => message.id)).size !== messages.length ||
        messages.some((message, index) => index > 0 && message.queuedAt < messages[index - 1].queuedAt) ||
        messages.some((message, index) => message.status !== 'queued' &&
            messages.slice(0, index).some(previous => previous.status === 'queued')) ||
        messages.filter(message => message.status === 'delivering').length > 1)
        throw new Error('Invalid Work message order');
    return freeze({ version: 1 as const, id: id(x.id), taskId: id(x.taskId), runId: id(x.runId),
        createdAt: timestamp(x.createdAt), grantId: id(x.grantId),
        grantRevision: integer(x.grantRevision), connectionId: id(x.connectionId),
        modelId: bounded(x.modelId, 200, 'model'), toolSelectionHash: hash(x.toolSelectionHash),
        sandboxHash: hash(x.sandboxHash), permissionCeiling: freeze(permissionCeiling),
        status: select(x.status, ['running', 'awaiting-input',
            'finishing', 'completed', 'stopped', 'recovery-required'] as const),
        revision: integer(x.revision), messages, segments,
        ...(candidateSnapshot ? { candidateSnapshot } : {}) });
}
