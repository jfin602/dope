import type { MCPServerRegistryMutationRequest } from '@dope/ai';
import type { MCPServerRegistryClient, MCPServerRegistryService } from '@dope/contracts/lib/mcp-server-registry-service';
import { MCPServerRegistryStore } from './mcp-server-registry-store';

export class MCPServerRegistryBackend implements MCPServerRegistryService {
    private readonly unlisten: () => void;
    constructor(private readonly store: MCPServerRegistryStore, client: MCPServerRegistryClient) {
        this.unlisten = store.onChange(snapshot => client.notifyMCPServerRegistryChanged(snapshot.revision));
    }
    list() { return this.store.read(); }
    mutate(request: MCPServerRegistryMutationRequest) { return this.store.mutate(request); }
    dispose(): void { this.unlisten(); }
}
