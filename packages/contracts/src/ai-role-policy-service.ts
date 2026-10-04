import type { AIRolePolicyMutationRequest, AIRolePolicySnapshot } from '@dope/ai/lib/index';

export const aiRolePolicyServicePath = '/services/dope/ai-role-policy';
export const AIRolePolicyService = Symbol('AIRolePolicyService');

export interface AIRolePolicyService {
    list(): Promise<AIRolePolicySnapshot>;
    mutate(request: AIRolePolicyMutationRequest): Promise<AIRolePolicySnapshot>;
    onDidChange?: (listener: (revision: number) => void) => { dispose(): void };
}
export interface AIRolePolicyClient {
    notifyAIRolePolicyChanged(revision: number): void;
}
