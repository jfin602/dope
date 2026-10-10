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

export interface DeveloperSession {
    schemaVersion: 1;
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
}

export interface SessionCollection {
    schemaVersion: 1;
    project: SessionProjectIdentity;
    revision: number;
    sessions: DeveloperSession[];
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
    const data = object(value, ['schemaVersion', 'id', 'project', 'revision', 'title', 'objective',
        'createdAt', 'updatedAt', 'status', 'notes', 'nextActions', 'closeout'], 'DeveloperSession');
    if (data.schemaVersion !== 1 || typeof data.id !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.id)) {
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
    return { schemaVersion: 1, id: data.id, project, revision, title, objective,
        createdAt, updatedAt, status: data.status, notes, nextActions, closeout };
}

export function parseSessionCollection(value: unknown): SessionCollection {
    const data = object(value, ['schemaVersion', 'project', 'revision', 'sessions'], 'SessionCollection');
    if (data.schemaVersion !== 1) throw new Error('Invalid session collection schema');
    const project = parseSessionProjectIdentity(data.project);
    const revision = integer(data.revision, 0, 'collection revision');
    if (!Array.isArray(data.sessions) || data.sessions.length > 10000) throw new Error('Invalid sessions');
    const sessions = data.sessions.map(parseDeveloperSession);
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
    return { schemaVersion: 1, project, revision, sessions };
}
