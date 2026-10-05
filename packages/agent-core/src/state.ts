import { AgentRunStatus, parseAgentRunStatus } from './contracts';

/** Blocked work can resume only through an explicit runtime decision; terminal attempts never resume. */
const transitions: Readonly<Record<AgentRunStatus, readonly AgentRunStatus[]>> = {
    pending: ['running'],
    running: ['blocked', 'cancelling', 'failed', 'completed', 'interrupted'],
    blocked: ['running', 'cancelling', 'failed', 'interrupted'],
    cancelling: ['cancelled', 'interrupted', 'failed'],
    cancelled: [], failed: [], completed: [], interrupted: []
};
export function canTransitionAgentRun(from: AgentRunStatus, to: AgentRunStatus): boolean {
    return transitions[parseAgentRunStatus(from)].includes(parseAgentRunStatus(to));
}
export function transitionAgentRun(from: AgentRunStatus, to: AgentRunStatus): AgentRunStatus {
    if (!canTransitionAgentRun(from, to)) throw new Error(`Illegal AgentRun transition: ${from} -> ${to}`);
    return to;
}
