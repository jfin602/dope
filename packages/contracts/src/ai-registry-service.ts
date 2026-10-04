import type { AIEligibilityQuery, AIEligibilityResult, AIRegistryMutationRequest,
    AIRegistrySnapshot } from '@dope/ai/lib/index';

export const aiRegistryServicePath = '/services/dope/ai-registry';
export const AIRegistryService = Symbol('AIRegistryService');

export interface AIRegistryService {
    list(): Promise<AIRegistrySnapshot>;
    mutate(request: AIRegistryMutationRequest): Promise<AIRegistrySnapshot>;
    findEligibleModels(query: AIEligibilityQuery): Promise<AIEligibilityResult>;
}
export interface AIRegistryClient { notifyAIRegistryChanged(revision: number): void }
