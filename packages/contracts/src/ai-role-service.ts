import type { AIRolePolicySnapshot, AIRolePolicyMutationRequest, AIRoleResolveRequest, AIRoleResolution,
    AIRoleExecuteRequest, AIRoleExecuteResult, AIRoleExplainRequest, AIRoleExplanation } from '@dope/ai/lib/index';

export const aiRoleServicePath = '/services/dope/ai-roles';
export const AIRoleService = Symbol('AIRoleService');

export interface AIRoleService {
    list(): Promise<AIRolePolicySnapshot>;
    mutate(request: AIRolePolicyMutationRequest): Promise<AIRolePolicySnapshot>;
    resolve(request: AIRoleResolveRequest): Promise<AIRoleResolution>;
    execute(request: AIRoleExecuteRequest): Promise<AIRoleExecuteResult>;
    explain(request: AIRoleExplainRequest): Promise<AIRoleExplanation>;
}
