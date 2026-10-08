import type { AgentModelPolicy, AgentRun, AgentRunEvent, AgentTask, AgentTaskSequence, AgentTranscriptEntry,
    CompletionPolicy, ExecutionGrant, StackMode, SequenceStatus } from '@dope/agent-core';

export const agentRuntimeServicePath = '/services/dope/agent-runtime';
export const AgentRuntimeService = Symbol('AgentRuntimeService');

export interface AgentStoreChange { kind: 'task' | 'run' | 'event' | 'sequence' | 'transcript'; id: string }
export interface AgentRuntimeClient { notifyAgentStateChanged(change: AgentStoreChange): void }
export interface DiscoveredTaskStack {
    folderName: string; path: string; mode: StackMode; phase: number;
    valid: boolean; error?: string; fingerprint?: string;
    sequenceId?: string; sequenceStatus?: SequenceStatus;
}
export type OpenTaskStackResult = { kind: 'opened'; sequence: AgentTaskSequence } |
    { kind: 'invalid-stack' | 'version-mismatch' | 'unsafe-source' | 'source-changed' | 'checkpoint-mismatch' };
export interface AgentRuntimeService {
    attach(folderUri: string): Promise<{ projectHandle: string }>;
    createTask(projectHandle: string, task: AgentTask): Promise<AgentTask>;
    readTask(projectHandle: string, taskId: string): Promise<AgentTask | undefined>;
    listTasks(projectHandle: string): Promise<AgentTask[]>;
    readRun(projectHandle: string, runId: string): Promise<AgentRun | undefined>;
    listRuns(projectHandle: string): Promise<AgentRun[]>;
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
        hostedProjectDataAuthorized: boolean): Promise<AgentRun>;
    stop(projectHandle: string, runId: string): Promise<AgentRun>;
}
