import type { MCPServerRegistryMutationRequest, MCPServerRegistrySnapshot } from '@dope/ai/lib/mcp-server-registry';

export const mcpServerRegistryServicePath = '/services/dope/mcp-servers';
export const MCPServerRegistryService = Symbol('MCPServerRegistryService');

export interface MCPServerRegistryService {
    list(): Promise<MCPServerRegistrySnapshot>;
    mutate(request: MCPServerRegistryMutationRequest): Promise<MCPServerRegistrySnapshot>;
    /** Browser proxy event; the backend RPC service supplies notifications through the client. */
    onDidChange?: (listener: (revision: number) => void) => { dispose(): void };
}
export interface MCPServerRegistryClient {
    notifyMCPServerRegistryChanged(revision: number): void;
}
