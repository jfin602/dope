import type { AIEligibilityQuery, AIEligibilityResult, AIRegistryMutationRequest,
    AIRegistrySnapshot, AIConnectionConfig, AIConnectionObservation } from '@dope/ai/lib/index';
import type { ConversationUsage } from './model-runtime';

export interface AITestConnectionResult {
    connectionId: string;
    modelId: string;
    latencyMs: number;
    usage?: ConversationUsage;
    hostedCostPossible: boolean;
}
export interface AIInventoryState {
    registry: AIRegistrySnapshot;
    observations: AIConnectionObservation[];
    loadedLocalModels?: NonNullable<AIEligibilityQuery['loadedLocalModels']>;
    tests: AITestConnectionResult[];
}

export interface ProviderSetupDescription {
    type: AIConnectionConfig['type'];
    connectionClass: 'model-runtime' | 'agent-runtime';
    fields: readonly ('endpoint' | 'runtime' | 'preferredModelId')[];
    locality: 'local' | 'hosted';
    credential: 'required' | 'optional' | 'managed';
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
    inventory(): Promise<AIInventoryState>;
    refreshModels(connectionId: string): Promise<AIInventoryState>;
    reconnect(connectionId: string): Promise<AIInventoryState>;
    testConnection(connectionId: string): Promise<AITestConnectionResult>;
    testConnectionDisclosure(connectionId: string): Promise<{ hostedCostPossible: boolean }>;
}
export interface AIRegistryClient {
    notifyAIRegistryChanged(revision: number): void;
    notifyAIInventoryChanged?(): void;
}
