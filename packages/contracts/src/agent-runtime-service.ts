import type { AgentModelPolicy, AgentRun, AgentRunEvent, AgentTask, AgentTaskSequence,
    CompletionPolicy, ExecutionGrant, ImportedStack } from '@dope/agent-core';

export const agentRuntimeServicePath = '/services/dope/agent-runtime';
export const AgentRuntimeService = Symbol('AgentRuntimeService');

export interface AgentStoreChange { kind: 'task' | 'run' | 'event' | 'sequence'; id: string }
export interface AgentRuntimeClient { notifyAgentStateChanged(change: AgentStoreChange): void }
export interface AgentRuntimeService {
    attach(folderUri: string): Promise<{ projectHandle: string }>;
    createTask(projectHandle: string, task: AgentTask): Promise<AgentTask>;
    readTask(projectHandle: string, taskId: string): Promise<AgentTask | undefined>;
    listTasks(projectHandle: string): Promise<AgentTask[]>;
    readRun(projectHandle: string, runId: string): Promise<AgentRun | undefined>;
    listRuns(projectHandle: string): Promise<AgentRun[]>;
    importSequence(projectHandle: string, folderName: string): Promise<AgentTaskSequence>;
    createSequence(projectHandle: string, stack: ImportedStack): Promise<AgentTaskSequence>;
    readSequence(projectHandle: string, sequenceId: string): Promise<AgentTaskSequence | undefined>;
    listSequences(projectHandle: string): Promise<AgentTaskSequence[]>;
    sequenceEvidence(projectHandle: string): Promise<{ head: string; packageVersion: string; clean: boolean; worktreeFingerprint: string }>;
    reconcileSequence(projectHandle: string, sequenceId: string): Promise<AgentTaskSequence>;
    reconcileManualGate(projectHandle: string, sequenceId: string): Promise<AgentTaskSequence>;
    prepareSequenceTask(projectHandle: string, sequenceId: string, modelPolicy: AgentModelPolicy,
        completion: CompletionPolicy, acceptDirty?: boolean): Promise<AgentTask>;
    startSequence(projectHandle: string, folderUri: string, sequenceId: string, grant: ExecutionGrant,
        hostedProjectDataAuthorized: boolean): Promise<AgentRun>;
    stopSequence(projectHandle: string, sequenceId: string): Promise<AgentTaskSequence>;
    checkpointSequence(projectHandle: string, sequenceId: string): Promise<AgentTaskSequence>;
    readEvents(projectHandle: string, runId: string, afterSequence: number, limit: number): Promise<{
        events: AgentRunEvent[]; nextSequence: number; hasMore: boolean;
    }>;
    start(projectHandle: string, folderUri: string, taskId: string, grant: ExecutionGrant,
        hostedProjectDataAuthorized: boolean): Promise<AgentRun>;
    stop(projectHandle: string, runId: string): Promise<AgentRun>;
}
