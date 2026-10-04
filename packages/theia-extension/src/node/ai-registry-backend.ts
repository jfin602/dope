import { findEligibleModels } from '@dope/ai';
import type { AIRegistryMutationRequest } from '@dope/ai';
import type { AIRegistryClient, AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import { AIRegistryStore } from './ai-registry-store';

export class AIRegistryBackend implements AIRegistryService {
    private readonly unlisten: () => void;
    constructor(private readonly store: AIRegistryStore, client: AIRegistryClient) {
        this.unlisten = store.onChange(snapshot => client.notifyAIRegistryChanged(snapshot.revision));
    }
    list() { return this.store.read(); }
    mutate(request: AIRegistryMutationRequest) { return this.store.mutate(request); }
    async findEligibleModels(query: Parameters<typeof findEligibleModels>[1]) {
        return findEligibleModels(await this.store.read(), query);
    }
    dispose(): void { this.unlisten(); }
}
