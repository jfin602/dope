/**
 * Identity is the real path of the attached local project root, verified by the
 * service/store boundary. A pre-existing Project Mind ID may corroborate it,
 * but is never minted merely to create a session. Planning IDs are independent.
 * A moved/copied project has a different root and requires an explicit future
 * rebind; opening it must not silently accept the old binding or write to
 * Project Mind. No AI or Project Mind content is required for a manual session.
 */
export interface SessionProjectIdentity {
    canonicalRoot: string;
    projectMindId: string | null;
}

export type DeveloperSessionStatus = 'active' | 'paused' | 'closed';

export interface SessionCloseout {
    achieved: string;
    unresolved: string;
    deferred: string;
    closedAt: string;
}

/** Membership only. The named artifact remains owned by its existing project store. */
export type SessionArtifactRef =
    | { kind: 'chat'; chatId: string }
    | { kind: 'planning-map'; mapId: string }
    | { kind: 'work-item'; mapId: string; workItemId: string }
    | { kind: 'agent-task'; taskId: string }
    | { kind: 'agent-run'; taskId: string; runId: string }
    | { kind: 'agent-sequence'; sequenceId: string }
    | { kind: 'project-mind'; artifactId: string; artifactType: 'decision' | 'idea' };

export const MAX_SESSION_LINKS = 100;
export const MAX_COLLECTION_LINKS = 10000;

export interface DeveloperSession {
    schemaVersion: 2;
    id: string;
    project: SessionProjectIdentity;
    revision: number;
    title: string;
    objective: string;
    createdAt: string;
    updatedAt: string;
    status: DeveloperSessionStatus;
    notes: string;
    nextActions: string[];
    closeout: SessionCloseout | null;
    links: SessionArtifactRef[];
}

export interface SessionCollection {
    schemaVersion: 2;
    project: SessionProjectIdentity;
    revision: number;
    sessions: DeveloperSession[];
}

export type LegacyDeveloperSession = Omit<DeveloperSession, 'schemaVersion' | 'links'> & { schemaVersion: 1 };
export type LegacySessionCollection = Omit<SessionCollection, 'schemaVersion' | 'sessions'> & {
    schemaVersion: 1;
    sessions: LegacyDeveloperSession[];
};

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const planningId = /^[A-Za-z][A-Za-z0-9._-]*$/;
const agentId = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function referenceId(value: unknown, kind: 'uuid' | 'planning' | 'agent', label: string): string {
    // Planning's owner accepts unbounded lexical IDs; cap serialized references
    // without imposing the agent domain's shorter identity limit on them.
    const maximum = kind === 'agent' ? 120 : kind === 'planning' ? 4096 : 36;
    if (typeof value !== 'string' || value.length > maximum ||
        !(kind === 'uuid' ? uuid : kind === 'planning' ? planningId : agentId).test(value) ||
        (kind === 'agent' && (value === '.' || value === '..'))) throw new Error(`Invalid ${label}`);
    return value;
}

export function parseSessionArtifactRef(value: unknown): SessionArtifactRef {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Invalid session reference');
    const kind = (value as Record<string, unknown>).kind;
    switch (kind) {
        case 'chat': {
            const ref = object(value, ['kind', 'chatId'], 'chat reference');
            return { kind, chatId: referenceId(ref.chatId, 'uuid', 'Chat ID') };
        }
        case 'planning-map': {
            const ref = object(value, ['kind', 'mapId'], 'planning-map reference');
            return { kind, mapId: referenceId(ref.mapId, 'planning', 'map ID') };
        }
        case 'work-item': {
            const ref = object(value, ['kind', 'mapId', 'workItemId'], 'work-item reference');
            return { kind, mapId: referenceId(ref.mapId, 'planning', 'map ID'),
                workItemId: referenceId(ref.workItemId, 'planning', 'WorkItem ID') };
        }
        case 'agent-task': {
            const ref = object(value, ['kind', 'taskId'], 'agent-task reference');
            return { kind, taskId: referenceId(ref.taskId, 'agent', 'task ID') };
        }
        case 'agent-run': {
            const ref = object(value, ['kind', 'taskId', 'runId'], 'agent-run reference');
            return { kind, taskId: referenceId(ref.taskId, 'agent', 'task ID'),
                runId: referenceId(ref.runId, 'agent', 'run ID') };
        }
        case 'agent-sequence': {
            const ref = object(value, ['kind', 'sequenceId'], 'agent-sequence reference');
            return { kind, sequenceId: referenceId(ref.sequenceId, 'agent', 'sequence ID') };
        }
        case 'project-mind': {
            const ref = object(value, ['kind', 'artifactId', 'artifactType'], 'Project Mind reference');
            if (ref.artifactType !== 'decision' && ref.artifactType !== 'idea') throw new Error('Invalid artifact type');
            return { kind, artifactId: referenceId(ref.artifactId, 'uuid', 'artifact ID'), artifactType: ref.artifactType };
        }
        default: throw new Error('Invalid session reference kind');
    }
}

export function sessionArtifactRefKey(value: SessionArtifactRef): string {
    const ref = parseSessionArtifactRef(value);
    switch (ref.kind) {
        case 'chat': return JSON.stringify([ref.kind, ref.chatId.toLowerCase()]);
        case 'planning-map': return JSON.stringify([ref.kind, ref.mapId]);
        case 'work-item': return JSON.stringify([ref.kind, ref.mapId, ref.workItemId]);
        case 'agent-task': return JSON.stringify([ref.kind, ref.taskId]);
        case 'agent-run': return JSON.stringify([ref.kind, ref.taskId, ref.runId]);
        case 'agent-sequence': return JSON.stringify([ref.kind, ref.sequenceId]);
        case 'project-mind': return JSON.stringify([ref.kind, ref.artifactType, ref.artifactId.toLowerCase()]);
    }
}

function object(value: unknown, keys: readonly string[], label: string): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value) ||
        Object.keys(value).sort().join(',') !== [...keys].sort().join(',')) {
        throw new Error(`Invalid ${label} shape`);
    }
    return value as Record<string, unknown>;
}

function integer(value: unknown, minimum: number, label: string): number {
    if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error(`Invalid ${label}`);
    return value as number;
}

function bounded(value: unknown, maximum: number, label: string, nonempty = false): string {
    if (typeof value !== 'string' || value.length > maximum || (nonempty && !value.trim()) ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) throw new Error(`Invalid ${label}`);
    return value;
}

function instant(value: unknown, label: string): string {
    if (typeof value !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) ||
        !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
        throw new Error(`Invalid ${label}`);
    }
    return value;
}

export function parseSessionProjectIdentity(value: unknown): SessionProjectIdentity {
    const data = object(value, ['canonicalRoot', 'projectMindId'], 'session project identity');
    const root = bounded(data.canonicalRoot, 4096, 'canonical root', true);
    // Lexical checks here; the Node attachment/store must also compare realpath.
    if (!root.startsWith('/') || root.includes('\\') ||
        (root !== '/' && (root.endsWith('/') || root.split('/').slice(1).some(segment => !segment || segment === '.' || segment === '..')))) {
        throw new Error('Invalid canonical root');
    }
    const id = data.projectMindId;
    if (id !== null && (typeof id !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]{0,127}$/.test(id))) {
        throw new Error('Invalid Project Mind ID');
    }
    return { canonicalRoot: root, projectMindId: id as string | null };
}

export function parseDeveloperSession(value: unknown): DeveloperSession {
    const version = typeof value === 'object' && value !== null && !Array.isArray(value) ?
        (value as Record<string, unknown>).schemaVersion : undefined;
    if (version !== 1 && version !== 2) throw new Error('Invalid session schema');
    const data = object(value, ['schemaVersion', 'id', 'project', 'revision', 'title', 'objective',
        'createdAt', 'updatedAt', 'status', 'notes', 'nextActions', 'closeout', ...(version === 2 ? ['links'] : [])], 'DeveloperSession');
    if (typeof data.id !== 'string' || !uuid.test(data.id)) {
        throw new Error('Invalid session schema or ID');
    }
    const project = parseSessionProjectIdentity(data.project);
    const revision = integer(data.revision, 1, 'session revision');
    const title = bounded(data.title, 160, 'session title', true);
    const objective = bounded(data.objective, 4000, 'session objective');
    const createdAt = instant(data.createdAt, 'created timestamp');
    const updatedAt = instant(data.updatedAt, 'updated timestamp');
    if (updatedAt < createdAt) throw new Error('Session updated before creation');
    if (data.status !== 'active' && data.status !== 'paused' && data.status !== 'closed') throw new Error('Invalid session status');
    const notes = bounded(data.notes, 16000, 'session notes');
    if (!Array.isArray(data.nextActions) || data.nextActions.length > 50) throw new Error('Invalid next actions');
    const nextActions = data.nextActions.map((item: unknown) => bounded(item, 1000, 'next action', true));
    let closeout: SessionCloseout | null = null;
    if (data.closeout !== null) {
        const outcome = object(data.closeout, ['achieved', 'unresolved', 'deferred', 'closedAt'], 'session closeout');
        closeout = {
            achieved: bounded(outcome.achieved, 4000, 'achieved outcomes'),
            unresolved: bounded(outcome.unresolved, 4000, 'unresolved outcomes'),
            deferred: bounded(outcome.deferred, 4000, 'deferred outcomes'),
            closedAt: instant(outcome.closedAt, 'closeout timestamp'),
        };
        if (closeout.closedAt < createdAt || closeout.closedAt > updatedAt) throw new Error('Invalid closeout time');
    }
    if ((data.status === 'closed') !== (closeout !== null)) throw new Error('Session status and closeout disagree');
    const rawLinks = version === 1 ? [] : data.links;
    if (!Array.isArray(rawLinks) || rawLinks.length > MAX_SESSION_LINKS) throw new Error('Invalid session links');
    const links = rawLinks.map(parseSessionArtifactRef);
    const keys = links.map(sessionArtifactRefKey);
    if (new Set(keys).size !== keys.length) throw new Error('Duplicate session reference');
    return { schemaVersion: 2, id: data.id, project, revision, title, objective,
        createdAt, updatedAt, status: data.status, notes, nextActions, closeout, links };
}

export function parseSessionCollection(value: unknown): SessionCollection {
    const data = object(value, ['schemaVersion', 'project', 'revision', 'sessions'], 'SessionCollection');
    if (data.schemaVersion !== 1 && data.schemaVersion !== 2) throw new Error('Invalid session collection schema');
    const project = parseSessionProjectIdentity(data.project);
    const revision = integer(data.revision, 0, 'collection revision');
    if (!Array.isArray(data.sessions) || data.sessions.length > 10000) throw new Error('Invalid sessions');
    if (data.sessions.some((raw: unknown) => typeof raw !== 'object' || raw === null || Array.isArray(raw) ||
        (raw as Record<string, unknown>).schemaVersion !== data.schemaVersion)) throw new Error('Mixed session schemas');
    const sessions = data.sessions.map(parseDeveloperSession);
    if (sessions.reduce((count, session) => count + session.links.length, 0) > MAX_COLLECTION_LINKS) {
        throw new Error('Too many session links');
    }
    const ids = new Set<string>();
    for (const session of sessions) {
        const id = session.id.toLowerCase();
        if (ids.has(id)) throw new Error('Duplicate session ID');
        ids.add(id);
        if (session.project.canonicalRoot !== project.canonicalRoot || session.project.projectMindId !== project.projectMindId) {
            throw new Error('Foreign session project');
        }
    }
    if (revision === 0 && sessions.length) throw new Error('Unwritten collection contains sessions');
    return { schemaVersion: 2, project, revision, sessions };
}
