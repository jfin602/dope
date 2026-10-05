import type { ExecutionGrant } from './authority';

/** Ephemeral provider observations. The runtime decides what bounded subset to persist. */
export type AgentExecutionEvent =
    | { kind: 'agent-message'; summary: string }
    | { kind: 'command-started' | 'command-completed'; summary: string; exitCode?: number }
    | { kind: 'file-changed'; summary: string; path: string }
    | { kind: 'status' | 'warning' | 'authority-denied' | 'provider-event'; summary: string };

export interface AgentExecutionRequest {
    projectRoot: string; grant: ExecutionGrant; taskId: string;
    connectionId: string; registrationId: string; modelId: string;
    prompt: string; reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
    onEvent(event: AgentExecutionEvent): void;
}

export interface AgentExecutionHandle {
    /** Provider thread identity is ephemeral and never canonical task identity. */
    readonly recovery?: { adapterId: string; handle: string };
    readonly result: Promise<void>;
    cancel(): Promise<void>;
}

export interface AgentExecutionAdapter {
    readonly id: string;
    start(request: AgentExecutionRequest): Promise<AgentExecutionHandle>;
    dispose(): void;
}
