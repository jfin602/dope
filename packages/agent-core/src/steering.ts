import { AGENT_SCHEMA_VERSION, array, bounded, freeze, id, integer, record, select, timestamp } from './contracts';

export interface AgentSteeringRequest {
    kind: 'instruction' | 'focus'; text: string;
}
export interface AgentSteeringEntry {
    revision: number; requestedAt: string; request: AgentSteeringRequest;
    acknowledgement: { status: 'unsupported'; at: string; reason: 'active-turn-steering-unavailable';
        nextStep: 'explicit-stop-and-new-task' };
}
export interface AgentSteeringState {
    version: typeof AGENT_SCHEMA_VERSION; projectId?: string; taskId: string; runId: string;
    revision: number; entries: AgentSteeringEntry[];
}

export function parseAgentSteeringRequest(value: unknown): AgentSteeringRequest {
    const x = record(value, ['kind', 'text']);
    return freeze({ kind: select(x.kind, ['instruction', 'focus'] as const),
        text: bounded(x.text, 4000, 'steering text') });
}

export function parseAgentSteeringState(value: unknown): AgentSteeringState {
    const x = record(value, ['version', 'projectId', 'taskId', 'runId', 'revision', 'entries']);
    if (x.version !== AGENT_SCHEMA_VERSION) throw new Error('Invalid steering version');
    const entries = array(x.entries, 100, item => {
        const entry = record(item, ['revision', 'requestedAt', 'request', 'acknowledgement']);
        const acknowledgement = record(entry.acknowledgement, ['status', 'at', 'reason', 'nextStep']);
        if (acknowledgement.status !== 'unsupported' ||
            acknowledgement.reason !== 'active-turn-steering-unavailable' ||
            acknowledgement.nextStep !== 'explicit-stop-and-new-task')
            throw new Error('Invalid steering acknowledgement');
        const requestedAt = timestamp(entry.requestedAt), at = timestamp(acknowledgement.at);
        if (at < requestedAt) throw new Error('Steering acknowledgement predates request');
        return freeze({ revision: integer(entry.revision), requestedAt,
            request: parseAgentSteeringRequest(entry.request), acknowledgement: freeze({
                status: 'unsupported' as const, at,
                reason: 'active-turn-steering-unavailable' as const,
                nextStep: 'explicit-stop-and-new-task' as const }) });
    });
    const revision = integer(x.revision);
    if (revision !== entries.length || entries.some((entry, index) => entry.revision !== index + 1))
        throw new Error('Invalid steering revision');
    return freeze({ version: AGENT_SCHEMA_VERSION,
        ...(x.projectId === undefined ? {} : { projectId: id(x.projectId) }),
        taskId: id(x.taskId), runId: id(x.runId), revision, entries });
}
