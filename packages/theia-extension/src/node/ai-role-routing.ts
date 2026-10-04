import { AI_ROLE_POLICY_VERSION, explainAIRouting, parseAIRegistrySnapshot, parseAIRolePolicySnapshot,
    parseRoutingProvenance, resolveAIRole } from '@dope/ai';
import type { AIRoleHardConstraints, AIRoleId, AIRoleTarget, AIRoutingAttempt, AIRoutingAttemptOutcome,
    AIRoutingSource, RoutingProvenance } from '@dope/ai';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ConversationEvent, ConversationRequest } from '@dope/contracts/lib/model-runtime';
import type { AIRolePolicyStore } from './ai-role-policy-store';
import type { AIInventoryController } from './ai-registry-backend';
import type { ModelConnectionsRegistry } from './model-connections';

type Complete = Extract<ConversationEvent, { type: 'complete' }>;
export type RoutedConversationEvent = Extract<ConversationEvent, { type: 'delta' }> |
    (Complete & { routingProvenance: RoutingProvenance });
export interface RoleConversationRequest {
    roleId: AIRoleId;
    requestHard: AIRoleHardConstraints;
    hostedProjectDataAuthorized: boolean;
    allowFallback: boolean;
    conversation: Omit<ConversationRequest, 'modelId'>;
}

export class RoleRoutingFailure extends Error {
    constructor(readonly attempts: readonly AIRoutingAttempt[], message = 'No eligible role execution completed') {
        super(message);
        this.attempts = Object.freeze(attempts.map(attempt => Object.freeze({
            target: Object.freeze({ ...attempt.target }), outcome: attempt.outcome })));
    }
}

export function exactRoutingProvenance(source: Exclude<AIRoutingSource, 'role-policy'>,
    target: AIRoleTarget, hard: AIRoleHardConstraints, labels: RoutingProvenance['executionLabels']): RoutingProvenance {
    return parseRoutingProvenance({ version: AI_ROLE_POLICY_VERSION, source, effectiveHard: hard,
        actualTarget: target, executionLabels: labels, attempts: [{ target, outcome: 'selected' }] });
}

function outcome(error: unknown): AIRoutingAttemptOutcome {
    if (!(error instanceof ModelRuntimeFailure)) return 'semantic-failure';
    switch (error.failureClass) {
        case 'connection-unavailable': case 'model-unavailable': return 'unavailable';
        case 'transient-transport': case 'transient-upstream': return error.failureClass;
        case 'cancelled': return 'cancelled';
        case 'authentication': return 'authentication';
        case 'unsupported-capability': return 'ineligible';
        default: return 'semantic-failure';
    }
}

/** Role routing owns only candidate sequencing; the registry still owns exact model execution. */
export class AIRoleRoutingService {
    constructor(private readonly policies: Pick<AIRolePolicyStore, 'read'>,
        private readonly inventory: Pick<AIInventoryController, 'inventory' | 'loadedLocalModelsSnapshot'>,
        private readonly runtime: Pick<ModelConnectionsRegistry, 'generate'>) {}

    async *generate(request: RoleConversationRequest): AsyncIterable<RoutedConversationEvent> {
        if (typeof request.allowFallback !== 'boolean' || typeof request.hostedProjectDataAuthorized !== 'boolean')
            throw new Error('Explicit fallback and hosted egress decisions required');
        const policy = parseAIRolePolicySnapshot(await this.policies.read());
        const state = await this.inventory.inventory();
        const inventory = parseAIRegistrySnapshot(state.registry);
        const resolution = resolveAIRole({ policy, inventory, observations: state.observations,
            loadedLocalModels: this.inventory.loadedLocalModelsSnapshot(), roleId: request.roleId,
            requestHard: request.requestHard, hostedProjectDataAuthorized: request.hostedProjectDataAuthorized });
        const attempts: AIRoutingAttempt[] = [];
        const mayFallback = request.allowFallback && resolution.policyAllowsFallback;
        const rolePolicy = policy.policies.find(item => item.roleId === resolution.roleId)!;
        const entries = [rolePolicy.preferred, ...rolePolicy.fallbacks];
        const preflight = resolution.excluded.filter(item => {
            const entry = entries[item.entryIndex];
            return item.target && entry?.type === 'exact' &&
                entry.target.connectionId === item.target.connectionId && entry.target.modelId === item.target.modelId &&
                item.reason !== 'already-candidate' && item.reason !== 'fallback-disabled';
        });
        const sequence = [
            ...preflight.map(item => ({ entryIndex: item.entryIndex, excluded: item })),
            ...resolution.candidates.map(candidate => ({ entryIndex: candidate.entryIndex, candidate }))
        ].sort((left, right) => left.entryIndex - right.entryIndex);
        for (const step of sequence) {
            if (request.conversation.signal?.aborted) throw new RoleRoutingFailure(attempts, 'Role execution cancelled');
            if (attempts.length >= 9) break;
            if ('excluded' in step) {
                const excluded = step.excluded;
                const excludedTarget = excluded.target;
                if (!excludedTarget) continue;
                const health = state.observations.find(item => item.connectionId === excludedTarget.connectionId)?.health;
                const category: AIRoutingAttemptOutcome = health === 'needs-authentication' ? 'authentication' :
                    health === 'invalid-configuration' ? 'invalid-configuration' :
                    excluded.reason === 'disabled' ? 'disabled' :
                        excluded.reason === 'hosted-egress-not-authorized' ? 'consent-required' :
                            excluded.reason === 'unavailable' || excluded.reason.startsWith('missing-') ?
                                'unavailable' : 'ineligible';
                attempts.push({ target: excludedTarget, outcome: category });
                if (!mayFallback || ['authentication', 'invalid-configuration', 'consent-required'].includes(category))
                    throw new RoleRoutingFailure(attempts);
                continue;
            }
            if (!('candidate' in step)) continue;
            const candidate = step.candidate;
            const target = candidate.target;
            const model = inventory.models.find(item => item.connectionId === target.connectionId &&
                item.providerModelKey === target.modelId)!;
            if (model.locality === 'hosted' && (!request.hostedProjectDataAuthorized ||
                candidate.effectiveHard.hostedProjectData === 'forbidden'))
                throw new RoleRoutingFailure([...attempts, { target, outcome: 'consent-required' }]);
            let meaningfulOutput = false;
            try {
                for await (const event of this.runtime.generate(target, request.conversation)) {
                    if (event.type === 'delta') {
                        if (event.text.length) { meaningfulOutput = true; yield event; }
                    } else {
                        meaningfulOutput = true;
                        const actualTarget = { connectionId: target.connectionId,
                            modelId: event.provenance?.modelId ?? event.actualModelId ?? target.modelId };
                        const connection = inventory.connections.find(item => item.id === target.connectionId)!;
                        const provenance = parseRoutingProvenance({ version: AI_ROLE_POLICY_VERSION,
                            source: 'role-policy', requestedRole: resolution.roleId,
                            policyRevision: resolution.policyRevision, effectiveHard: candidate.effectiveHard,
                            preferredTarget: resolution.preferredTarget, actualTarget,
                            executionLabels: { connection: connection.alias,
                                provider: event.provenance?.providerId ?? connection.config.type,
                                model: event.provenance?.modelLabel ?? model.label },
                            attempts: [...attempts, { target: actualTarget, outcome: 'selected' }] });
                        yield { ...event, routingProvenance: provenance };
                        return;
                    }
                }
                throw new ModelRuntimeFailure('Incomplete model output', 'nonretryable-provider');
            } catch (error) {
                const category = meaningfulOutput ? 'partial-output' :
                    request.conversation.signal?.aborted ? 'cancelled' : outcome(error);
                attempts.push({ target, outcome: category });
                if (request.conversation.signal?.aborted || !mayFallback || meaningfulOutput ||
                    !['unavailable', 'transient-transport', 'transient-upstream'].includes(category))
                    throw new RoleRoutingFailure(attempts);
            }
        }
        throw new RoleRoutingFailure(attempts);
    }

    explain = explainAIRouting;
}
