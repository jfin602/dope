import type { AgentRun, AgentRunEvent, AgentTask } from '@dope/agent-core';

export const agentRuntimeServicePath = '/services/dope/agent-runtime';
export const AgentRuntimeService = Symbol('AgentRuntimeService');

export interface AgentStoreChange { kind: 'task' | 'run' | 'event'; id: string }
export interface AgentRuntimeClient { notifyAgentStateChanged(change: AgentStoreChange): void }
export interface AgentRuntimeService {
    attach(folderUri: string): Promise<{ projectHandle: string }>;
    createTask(projectHandle: string, task: AgentTask): Promise<AgentTask>;
    readTask(projectHandle: string, taskId: string): Promise<AgentTask | undefined>;
    listTasks(projectHandle: string): Promise<AgentTask[]>;
    createRun(projectHandle: string, run: AgentRun): Promise<AgentRun>;
    readRun(projectHandle: string, runId: string): Promise<AgentRun | undefined>;
    listRuns(projectHandle: string): Promise<AgentRun[]>;
    updateRun(projectHandle: string, expected: AgentRun, next: AgentRun): Promise<AgentRun>;
    appendEvent(projectHandle: string, event: AgentRunEvent): Promise<AgentRunEvent>;
    readEvents(projectHandle: string, runId: string, afterSequence: number, limit: number): Promise<{
        events: AgentRunEvent[]; nextSequence: number; hasMore: boolean;
    }>;
}
