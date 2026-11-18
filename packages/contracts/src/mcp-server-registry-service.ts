import type { MCPServerRegistryMutationRequest, MCPServerRegistrySnapshot } from '@dope/ai/lib/mcp-server-registry';

export const mcpServerRegistryServicePath = '/services/dope/mcp-servers';
export const MCPServerRegistryService = Symbol('MCPServerRegistryService');

export interface MCPServerRegistryService {
    list(): Promise<MCPServerRegistrySnapshot>;
    mutate(request: MCPServerRegistryMutationRequest): Promise<MCPServerRegistrySnapshot>;
    bridgeCredentialStatus(serverId: string): Promise<'available' | 'missing' | 'unavailable'>;
    /** Explicit user configuration. The secret is never returned or stored in the catalog. */
    replaceBridgeToken(serverId: string, expectedRevision: number, secret: string): Promise<MCPServerRegistrySnapshot>;
    /** Browser proxy event; the backend RPC service supplies notifications through the client. */
    onDidChange?: (listener: (revision: number) => void) => { dispose(): void };
}
export interface MCPServerRegistryClient {
    notifyMCPServerRegistryChanged(revision: number): void;
}
