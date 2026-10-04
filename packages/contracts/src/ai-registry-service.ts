import type { AIEligibilityQuery, AIEligibilityResult, AIRegistryMutationRequest,
    AIRegistrySnapshot, AIConnectionConfig } from '@dope/ai/lib/index';

export interface ProviderSetupDescription {
    type: AIConnectionConfig['type'];
    fields: readonly ('endpoint' | 'runtime' | 'preferredModelId')[];
    locality: 'local' | 'hosted';
    credential: 'required' | 'optional';
    credentialSources: readonly ('environment' | 'session' | 'secure')[];
    environmentVariable?: string;
    modelSource: 'configured' | 'discovered' | 'configured-or-discovered';
}

export const aiRegistryServicePath = '/services/dope/ai-registry';
export const AIRegistryService = Symbol('AIRegistryService');

export interface AIRegistryService {
    list(): Promise<AIRegistrySnapshot>;
    mutate(request: AIRegistryMutationRequest): Promise<AIRegistrySnapshot>;
    findEligibleModels(query: AIEligibilityQuery): Promise<AIEligibilityResult>;
    providerSetups(): Promise<ProviderSetupDescription[]>;
    detectLocalRuntime(): Promise<AIConnectionConfig | undefined>;
    useDetectedRuntime(connectionId: string, expectedRevision: number): Promise<AIRegistrySnapshot>;
}
export interface AIRegistryClient { notifyAIRegistryChanged(revision: number): void }
