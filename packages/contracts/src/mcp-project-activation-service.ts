import type { MCPProjectPreferencesSnapshot, MCPProjectServerState } from '@dope/ai/lib/mcp-project-activation';

export const mcpProjectActivationServicePath = '/services/dope/mcp-project-activation';
export const MCPProjectActivationService = Symbol('MCPProjectActivationService');
export interface MCPProjectServerView {
    serverId: string;
    registrationRevision?: number;
    state: MCPProjectServerState;
    /** Eligibility only; no tool permission, connection, or project-data authorization. */
    eligible: boolean;
}
export interface MCPProjectActivationSnapshot {
    projectKey?: string;
    preferencesRevision: number;
    registryRevision: number;
    servers: MCPProjectServerView[];
}
export interface MCPProjectActivationEvent {
    generation: number;
    projectKey?: string;
    kind: 'project-switch' | 'selection-changed' | 'registry-changed' | 'disposed';
    /** Adapters must cancel pending calls and discard sessions before using the new generation. */
    revokePrevious: true;
}
export interface MCPProjectActivationService {
    switchProject(root?: string): Promise<MCPProjectActivationSnapshot>;
    current(): Promise<MCPProjectActivationSnapshot>;
    setEnabled(request: { projectKey: string; serverId: string; registrationRevision: number;
        expectedRevision: number; enabled: boolean }): Promise<MCPProjectActivationSnapshot>;
}
export interface MCPProjectActivationClient {
    notifyMCPProjectActivationChanged(event: MCPProjectActivationEvent): void;
}
export type { MCPProjectPreferencesSnapshot };
