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

export interface SessionLinkMutationRequest {
    projectHandle: string;
    expectedCollectionRevision: number;
    expectedSessionRevision: number;
    sessionId: string;
    ref: SessionArtifactRef;
}

export interface SessionResolveRequest {
    projectHandle: string;
    sessionId: string;
}

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
    availability: 'resolved' | 'missing' | 'stale' | 'unavailable';
    diagnostic: string;
    title?: string;
    objective?: string;
    status?: string;
    observedRevision?: number;
    observedBasis?: { architectureRevision: number; architectureFingerprint: string;
        physicalInputFingerprint: string; physicalGeneration: number };
    taskOrigin?: string;
    validationStatus?: 'passed' | 'failed' | 'incomplete' | 'unavailable';
    reviewDecision?: 'accept' | 'reject';
    promotionStatus?: 'applied' | 'not-applied';
    source?: 'agent-task' | 'agent-run' | 'agent-sequence' | 'project-mind';
}

export interface SessionResolveResult {
    sessionId: string;
    collectionRevision: number;
    sessionRevision: number;
    artifacts: SessionArtifactResolution[];
}

/** Bounded owner metadata for an explicit browse action. No owner payload is copied. */
export interface SessionCandidate {
    ref: SessionArtifactRef;
    label: string;
}
export interface SessionCandidateResult {
    kind: SessionArtifactRef['kind'];
    availability: 'ready' | 'unavailable';
    candidates: SessionCandidate[];
    truncated: boolean;
    diagnostic: string;
}

export interface DeveloperSessionService {
    attach(folderUri: string): Promise<SessionAttachment>;
    read(projectHandle: string): Promise<SessionCollection>;
    list(projectHandle: string): Promise<DeveloperSession[]>;
    get(projectHandle: string, sessionId: string): Promise<DeveloperSession | undefined>;
    mutate(request: SessionMutationRequest): Promise<SessionMutationResult>;
    attachLink(request: SessionLinkMutationRequest): Promise<SessionMutationResult>;
    detachLink(request: SessionLinkMutationRequest): Promise<SessionMutationResult>;
    resolve(request: SessionResolveRequest): Promise<SessionResolveResult>;
    candidates(projectHandle: string, kind: SessionArtifactRef['kind']): Promise<SessionCandidateResult>;
}
