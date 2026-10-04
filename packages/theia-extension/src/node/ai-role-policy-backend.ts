import { parseAIRolePolicyMutationRequest } from '@dope/ai';
import type { AIRolePolicyEntry, AIRolePolicyMutationRequest } from '@dope/ai';
import type { AIRolePolicyClient, AIRolePolicyService } from '@dope/contracts/lib/ai-role-policy-service';
import { AIRegistryStore } from './ai-registry-store';
import { AIRolePolicyStore } from './ai-role-policy-store';

export class AIRolePolicyBackend implements AIRolePolicyService {
    private readonly unlisten: () => void;
    constructor(private readonly store: AIRolePolicyStore, private readonly registry: AIRegistryStore,
        client: AIRolePolicyClient) {
        this.unlisten = store.onChange(snapshot => client.notifyAIRolePolicyChanged(snapshot.revision));
    }
    list() { return this.store.read(); }
    async mutate(request: AIRolePolicyMutationRequest) {
        const parsed = parseAIRolePolicyMutationRequest(request);
        const inventory = await this.registry.read();
        const describe = (entry: AIRolePolicyEntry): AIRolePolicyEntry => {
            if (entry.type !== 'exact') return entry;
            const connection = inventory.connections.find(candidate => candidate.id === entry.target.connectionId);
            const model = inventory.models.find(candidate => candidate.connectionId === entry.target.connectionId &&
                candidate.providerModelKey === entry.target.modelId);
            if (!connection || !model) return entry;
            return { ...entry, lastKnown: { connectionLabel: connection.alias, modelLabel: model.label,
                locality: model.locality } };
        };
        const policy = parsed.policy;
        return this.store.mutate({ ...parsed, policy: { ...policy,
            ...(policy.preferred ? { preferred: describe(policy.preferred) } : {}),
            fallbacks: policy.fallbacks.map(describe) } });
    }
    dispose(): void { this.unlisten(); }
}
