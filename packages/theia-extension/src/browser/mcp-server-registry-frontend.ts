import type { MCPServerRegistryService } from '@dope/contracts/lib/mcp-server-registry-service';

/** Keep every catalog RPC available when adding the browser change event. */
export function mcpServerRegistryFrontendService(
    proxy: MCPServerRegistryService, onDidChange: NonNullable<MCPServerRegistryService['onDidChange']>
): MCPServerRegistryService {
    return {
        list: () => proxy.list(),
        mutate: request => proxy.mutate(request),
        bridgeCredentialStatus: serverId => proxy.bridgeCredentialStatus(serverId),
        replaceBridgeToken: (serverId, expectedRevision, secret) =>
            proxy.replaceBridgeToken(serverId, expectedRevision, secret),
        onDidChange
    };
}
