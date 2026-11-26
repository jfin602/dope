import type { AgentModelPolicy, AgentMapImpact, AgentRun, AgentRunEvent, AgentTask, AgentTaskSequence, AgentTranscriptEntry, ProposedAction, WorkSession,
    AgentSteeringRequest, AgentSteeringState,
    CompletionPolicy, ExecutionControls, ExecutionGrant, StackMode, SequenceStatus } from '@dope/agent-core';
import type { WorkMCPObservationScope } from '@dope/agent-core/lib/authority';

export const agentRuntimeServicePath = '/services/dope/agent-runtime';
export const AgentRuntimeService = Symbol('AgentRuntimeService');

export interface AgentStoreChange { kind: 'task' | 'run' | 'event' | 'sequence' | 'transcript' | 'action' | 'steering' | 'map-impact' | 'work-session' | 'mcp-approval'; id: string }
export interface PendingWorkMCPObservation {
    id: string; runId: string; taskId: string; projectKey: string;
    serverId: string; toolName: string; expiresAt: string;
}
export interface AgentRuntimeClient {
    notifyAgentStateChanged(change: AgentStoreChange): void;
    /** Checked immediately before a Direct Work canonical write. A disconnected editor fails closed. */
    hasUnsavedEditor(fileUri: string): Promise<boolean>;
}
export interface DiscoveredTaskStack {
    folderName: string; path: string; mode: StackMode; phase: number;
    valid: boolean; error?: string; fingerprint?: string;
    sequenceId?: string; sequenceStatus?: SequenceStatus;
}
export type OpenTaskStackResult = { kind: 'opened'; sequence: AgentTaskSequence } |
    { kind: 'invalid-stack' | 'version-mismatch' | 'unsafe-source' | 'source-changed' | 'checkpoint-mismatch' };
export interface WorkItemLaunchRequest {
    requestKey: string; expectedProjectRevision: number; expectedMapRevision: number;
    planningMapId: string; workItemId: string; delegablePaths: string[];
    modelPolicy: AgentModelPolicy; controls: ExecutionControls; completion: CompletionPolicy;
    executionMode?: 'isolated' | 'direct';
    /** Set only after the developer explicitly approves the supplied validation commands. */
    validationApproved?: boolean;
}
export interface CandidateResumePreview {
    eligible: boolean; reason?: string; sourceRunId: string; task?: AgentTask;
    candidateFingerprint?: string; effects?: AgentRun['candidateDelta'];
    outcome?: AgentRun['outcome']; uncertainCommands?: string[]; transcriptIncomplete?: boolean;
}
export interface WorktreeReview { clean: boolean; fingerprint: string; paths: string[]; head?: string }
export interface DirectWorkReview {
    files: { path: string; operation: 'create' | 'modify'; before: string | null; after: string;
        diff: string; conflict: boolean; reverted: boolean }[];
    uncertain: boolean;
    validationCurrent: boolean;
}
export interface AgentRuntimeService {
    attach(folderUri: string): Promise<{ projectHandle: string }>;
    workMCPObservationOffer(projectHandle: string, connectionId: string, modelId: string): Promise<WorkMCPObservationScope | undefined>;
    pendingWorkMCPObservations(projectHandle: string): Promise<PendingWorkMCPObservation[]>;
    decideWorkMCPObservation(projectHandle: string, runId: string, requestId: string, approved: boolean): Promise<void>;
    createTask(projectHandle: string, task: AgentTask): Promise<AgentTask>;
    previewWorktree(projectHandle: string): Promise<WorktreeReview>;
    commitWorktree(projectHandle: string, fingerprint: string, message: string): Promise<void>;
    launchWorkItem(projectHandle: string, request: WorkItemLaunchRequest): Promise<AgentTask>;
    listWorkItemTasks(projectHandle: string, planningMapId: string, workItemId: string): Promise<AgentTask[]>;
    readTask(projectHandle: string, taskId: string): Promise<AgentTask | undefined>;
    listTasks(projectHandle: string): Promise<AgentTask[]>;
    readRun(projectHandle: string, runId: string): Promise<AgentRun | undefined>;
    readWorkSession(projectHandle: string, sessionId: string): Promise<WorkSession | undefined>;
    readWorkSessionForRun(projectHandle: string, runId: string): Promise<WorkSession | undefined>;
    submitWorkMessage(projectHandle: string, sessionId: string, messageId: string, text: string): Promise<WorkSession>;
    finishWorkSession(projectHandle: string, sessionId: string): Promise<WorkSession>;
    previewCandidateResume(projectHandle: string, runId: string): Promise<CandidateResumePreview>;
    resumeCandidate(projectHandle: string, folderUri: string, runId: string,
        expectedFingerprint: string, newTask: AgentTask, grant: ExecutionGrant,
        hostedProjectDataAuthorized: boolean): Promise<AgentRun>;
    readMapImpact(projectHandle: string, runId: string): Promise<AgentMapImpact | undefined>;
    readSteering(projectHandle: string, runId: string): Promise<AgentSteeringState | undefined>;
    requestSteering(projectHandle: string, taskId: string, runId: string, expectedRevision: number,
        request: AgentSteeringRequest): Promise<AgentSteeringState>;
    decideCandidate(projectHandle: string, runId: string, expectedRevision: number,
        candidateFingerprint: string, decision: 'accept' | 'reject', grant?: ExecutionGrant): Promise<AgentRun>;
    reviewDirectWork(projectHandle: string, runId: string): Promise<DirectWorkReview>;
    revertDirectWork(projectHandle: string, runId: string, paths: string[]): Promise<DirectWorkReview>;
    listRuns(projectHandle: string): Promise<AgentRun[]>;
    listActions(projectHandle: string, taskId?: string): Promise<ProposedAction[]>;
    readAction(projectHandle: string, actionId: string): Promise<ProposedAction | undefined>;
    decideAction(projectHandle: string, actionId: string, expectedRevision: number,
        decision: 'acknowledged' | 'rejected'): Promise<ProposedAction>;
    listTaskStacks(projectHandle: string, tasksRoot: string): Promise<DiscoveredTaskStack[]>;
    openTaskStack(projectHandle: string, tasksRoot: string, folderName: string): Promise<OpenTaskStackResult>;
    acceptSequenceDirtyBasis(projectHandle: string, sequenceId: string, worktreeFingerprint: string): Promise<AgentTaskSequence>;
    readSequence(projectHandle: string, sequenceId: string): Promise<AgentTaskSequence | undefined>;
    listSequences(projectHandle: string): Promise<AgentTaskSequence[]>;
    sequenceEvidence(projectHandle: string): Promise<{ head: string; packageVersion: string; clean: boolean; worktreeFingerprint: string }>;
    codingAgentReady(projectHandle: string): Promise<boolean>;
    reconcileSequence(projectHandle: string, sequenceId: string): Promise<AgentTaskSequence>;
    reconcileManualGate(projectHandle: string, sequenceId: string): Promise<AgentTaskSequence>;
    prepareSequenceTask(projectHandle: string, sequenceId: string, modelPolicy: AgentModelPolicy,
        completion: CompletionPolicy): Promise<AgentTask>;
    startSequence(projectHandle: string, folderUri: string, sequenceId: string, grant: ExecutionGrant,
        hostedProjectDataAuthorized: boolean): Promise<AgentRun>;
    stopSequence(projectHandle: string, sequenceId: string): Promise<AgentTaskSequence>;
    checkpointSequence(projectHandle: string, sequenceId: string): Promise<AgentTaskSequence>;
    readEvents(projectHandle: string, runId: string, afterSequence: number, limit: number): Promise<{
        events: AgentRunEvent[]; nextSequence: number; hasMore: boolean;
    }>;
    readTranscript(projectHandle: string, runId: string, afterSequence: number, limit: number): Promise<{
        state: 'recorded' | 'not-recorded'; entries: AgentTranscriptEntry[];
        nextSequence: number; hasMore: boolean; incomplete: boolean;
    }>;
    start(projectHandle: string, folderUri: string, taskId: string, grant: ExecutionGrant,
        hostedProjectDataAuthorized: boolean, acceptedDirtyFingerprint?: string): Promise<AgentRun>;
    startWorkSession(projectHandle: string, folderUri: string, taskId: string, grant: ExecutionGrant,
        hostedProjectDataAuthorized: boolean, acceptedDirtyFingerprint?: string): Promise<AgentRun>;
    continueWorkSession(projectHandle: string, folderUri: string, sessionId: string,
        previousRunId: string, newTaskId: string, grant: ExecutionGrant,
        hostedProjectDataAuthorized: boolean, expectedSourceHead: string,
        discardUnverifiedCandidate: boolean, acceptedDirtyFingerprint?: string): Promise<AgentRun>;
    stop(projectHandle: string, runId: string): Promise<AgentRun>;
}
