import type { ExecutionGrant } from './authority';

/** Ephemeral provider observations. The runtime decides what bounded subset to persist. */
export type AgentExecutionEvent =
    | { kind: 'agent-message'; summary: string; text: string; truncated: boolean; redacted: boolean }
    | { kind: 'command-started' | 'command-completed'; summary: string; commandId?: string;
        command?: string; commandTruncated?: boolean; commandRedacted?: boolean; commandDropped?: boolean; cwd?: string;
        status: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted'; exitCode?: number;
        stdout?: string; stderr?: string; output?: string; stdoutPresent?: boolean; stderrPresent?: boolean;
        stdoutTruncated?: boolean; stderrTruncated?: boolean; outputTruncated?: boolean;
        stdoutDropped?: boolean; stderrDropped?: boolean; outputDropped?: boolean }
    | { kind: 'file-changed'; summary: string; path: string }
    | { kind: 'status' | 'warning' | 'authority-denied' | 'provider-event'; summary: string };

export interface AgentExecutionRequest {
    projectRoot: string; executionRoot: string; grant: ExecutionGrant; taskId: string;
    connectionId: string; registrationId: string; modelId: string;
    prompt: string; reasoningEffort?: 'low' | 'medium' | 'high' | 'xhigh';
    onEvent(event: AgentExecutionEvent): void;
}

export interface AgentExecutionHandle {
    /** Provider thread identity is ephemeral and never canonical task identity. */
    readonly recovery?: { adapterId: string; handle: string };
    readonly result: Promise<void>;
    cancel(): Promise<void>;
    /** Emergency termination of this run's dedicated process when interruption fails. */
    terminate?(): void;
}

export interface AgentExecutionAdapter {
    readonly id: string;
    start(request: AgentExecutionRequest): Promise<AgentExecutionHandle>;
    dispose(): void;
}
