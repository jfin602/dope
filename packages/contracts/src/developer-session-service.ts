import type { DeveloperSession, SessionArtifactRef, SessionCloseout, SessionCollection, SessionProjectIdentity } from './developer-session';

export const developerSessionServicePath = '/services/dope/developer-session';
export const DeveloperSessionService = Symbol('DeveloperSessionService');

/** The handle scopes requests to one verified attachment; it is not authority. */
export interface SessionAttachment {
    projectHandle: string;
    project: SessionProjectIdentity;
    snapshot: SessionCollection;
}

export type SessionOperation =
    | { type: 'create'; title: string; objective: string }
    | { type: 'rename'; sessionId: string; title: string }
    | { type: 'set-objective'; sessionId: string; objective: string }
    | { type: 'set-notes'; sessionId: string; notes: string }
    | { type: 'set-next-actions'; sessionId: string; nextActions: string[] }
    | { type: 'pause' | 'resume' | 'reopen'; sessionId: string }
    | { type: 'close'; sessionId: string; closeout: Pick<SessionCloseout, 'achieved' | 'unresolved' | 'deferred'> };

export interface SessionMutationRequest {
    projectHandle: string;
    expectedCollectionRevision: number;
    expectedSessionRevision: number | null; // null only for create
    operation: SessionOperation;
}

export interface SessionMutationResult {
    snapshot: SessionCollection;
    session: DeveloperSession;
}

/** Compact, read-only owner truth for a link. P3/P4 supply the resolver. */
export interface SessionArtifactResolution {
    ref: SessionArtifactRef;
    state: 'resolved' | 'missing' | 'stale' | 'unavailable';
    ownerStatus?: string;
}

/** Session membership is independent of artifact origin and execution authority. */
export interface SessionArtifactMembership {
    sessionId: string;
    ref: SessionArtifactRef;
}

export interface DeveloperSessionService {
    attach(folderUri: string): Promise<SessionAttachment>;
    read(projectHandle: string): Promise<SessionCollection>;
    list(projectHandle: string): Promise<DeveloperSession[]>;
    get(projectHandle: string, sessionId: string): Promise<DeveloperSession | undefined>;
    mutate(request: SessionMutationRequest): Promise<SessionMutationResult>;
}
