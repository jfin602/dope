import { findEligibleModels } from '@dope/ai';
import type { AIRegistryMutationRequest } from '@dope/ai';
import type { AIRegistryClient, AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import { AIRegistryStore } from './ai-registry-store';
import { detectLocalRuntime, providerSetupDescriptions, useDetectedRuntime } from './provider-setup';

export class AIRegistryBackend implements AIRegistryService {
    private readonly unlisten: () => void;
    constructor(private readonly store: AIRegistryStore, client: AIRegistryClient,
        private readonly detect: typeof detectLocalRuntime = detectLocalRuntime) {
        this.unlisten = store.onChange(snapshot => client.notifyAIRegistryChanged(snapshot.revision));
    }
    list() { return this.store.read(); }
    mutate(request: AIRegistryMutationRequest) { return this.store.mutate(request); }
    async providerSetups() { return providerSetupDescriptions(); }
    detectLocalRuntime() { return this.detect(); }
    async useDetectedRuntime(connectionId: string, expectedRevision: number) {
        const config = await this.detect();
        if (!config) throw new Error('No known Local runtime detected');
        const connection = (await this.store.read()).connections.find(item => item.id === connectionId);
        if (!connection || connection.config.type !== 'local') throw new Error('Local connection missing');
        const updated = useDetectedRuntime(connection, config);
        return this.store.mutate({ version: updated.version, expectedRevision,
            mutation: { type: 'update-connection', id: connectionId, changes: {
                alias: updated.alias, lifecycle: updated.lifecycle, config: updated.config } } });
    }
    async findEligibleModels(query: Parameters<typeof findEligibleModels>[1]) {
        return findEligibleModels(await this.store.read(), query);
    }
    dispose(): void { this.unlisten(); }
}
