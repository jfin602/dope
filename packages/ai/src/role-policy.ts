import type { AIConnectionId, AIModel } from './index';

export const AI_ROLE_POLICY_VERSION = 1 as const;
export const AI_ROLE_IDS = Object.freeze(['interactive', 'deep-reasoning', 'background', 'software-map', 'coding-agent'] as const);
export type AIRoleId = typeof AI_ROLE_IDS[number];
export type AIRoleLocality = 'any' | 'local-only' | 'hosted-only';
export type AIRoleCapability = keyof AIModel['capabilities'];
export type AIRoleSoftPreference = 'prefer-local' | 'prefer-hosted' | 'prefer-reasoning-capable' | 'prefer-larger-context';
export type AIRoleHealth = 'ready' | 'using-fallback' | 'needs-configuration' | 'broken' | 'unavailable';

export interface AIRoleHardConstraints {
    requiredCapabilities: readonly AIRoleCapability[];
    locality: AIRoleLocality;
    minimumKnownContextTokens?: number;
    enabledOnly: boolean;
    usableOnly: boolean;
    hostedProjectData: 'forbidden' | 'requires-feature-authorization';
}

export interface AIRoleTarget { readonly connectionId: AIConnectionId; readonly modelId: string }
export interface AIRoleLastKnownTarget {
    readonly connectionLabel: string;
    readonly modelLabel: string;
    readonly locality: 'local' | 'hosted';
}
export type AIRolePolicyEntry =
    | { readonly type: 'exact'; readonly target: AIRoleTarget; readonly lastKnown?: AIRoleLastKnownTarget }
    | { readonly type: 'constraints'; readonly hard: AIRoleHardConstraints;
        readonly preferences: readonly AIRoleSoftPreference[] };
export interface AIRolePolicy {
    readonly roleId: AIRoleId;
    readonly preferred?: AIRolePolicyEntry;
    readonly fallbacks: readonly AIRolePolicyEntry[];
    readonly hard: AIRoleHardConstraints;
    readonly preferences: readonly AIRoleSoftPreference[];
    readonly allowFallback: boolean;
}
export interface AIRolePolicySnapshot {
    readonly version: typeof AI_ROLE_POLICY_VERSION;
    readonly revision: number;
    readonly policies: readonly AIRolePolicy[];
}
export interface AIRolePolicyMutationRequest {
    readonly version: typeof AI_ROLE_POLICY_VERSION;
    readonly expectedRevision: number;
    readonly policy: AIRolePolicy;
}

export type AIRoutingSource = 'explicit-turn' | 'explicit-feature' | 'chat-exact-default' | 'role-policy';
export type AIRoutingAttemptOutcome = 'selected' | 'disabled' | 'unavailable' | 'ineligible' |
    'transient-transport' | 'transient-upstream' | 'cancelled' | 'authentication' | 'invalid-configuration' |
    'consent-required' | 'partial-output' | 'semantic-failure';
export interface AIRoutingAttempt {
    readonly target: AIRoleTarget;
    readonly outcome: AIRoutingAttemptOutcome;
}
export interface AIRoutingExecutionLabels {
    readonly connection: string;
    readonly provider: string;
    readonly model: string;
}
export interface RoutingProvenance {
    readonly version: typeof AI_ROLE_POLICY_VERSION;
    readonly source: AIRoutingSource;
    readonly requestedRole?: AIRoleId;
    readonly policyRevision?: number;
    readonly effectiveHard: AIRoleHardConstraints;
    readonly preferredTarget?: AIRoleTarget;
    readonly actualTarget: AIRoleTarget;
    readonly executionLabels: AIRoutingExecutionLabels;
    readonly attempts: readonly AIRoutingAttempt[];
}

export interface AIRoleResolveRequest {
    readonly roleId: AIRoleId;
    readonly requestHard: AIRoleHardConstraints;
}
export interface AIRoleResolution {
    readonly roleId: AIRoleId;
    readonly policyRevision: number;
    readonly health: AIRoleHealth;
    readonly policyAllowsFallback: boolean;
    readonly effectiveHard: AIRoleHardConstraints;
    readonly preferredTarget?: AIRoleTarget;
    readonly selectedTarget?: AIRoleTarget;
}
export interface AIRoleExecuteRequest {
    readonly resolution: AIRoleResolution;
    readonly featureAllowsFallback: boolean;
}
export interface AIRoleExecuteResult { readonly provenance: RoutingProvenance }
export interface AIRoleExplainRequest { readonly provenance: RoutingProvenance }
export interface AIRoleExplanation {
    readonly source: AIRoutingSource;
    readonly roleId?: AIRoleId;
    readonly health?: AIRoleHealth;
    readonly attempts: readonly AIRoutingAttempt[];
}

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(key => !keys.includes(key))) throw new Error('Invalid AI role value');
    return value as Record<string, unknown>;
}
function select<Value extends string>(value: unknown, choices: readonly Value[]): Value {
    if (!choices.includes(value as Value)) throw new Error('Invalid AI role choice');
    return value as Value;
}
function integer(value: unknown): number {
    if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('Invalid AI role number');
    return value as number;
}
function label(value: unknown, maximum = 120): string {
    if (typeof value !== 'string' || !value.trim() || value.length > maximum ||
        /[\x00-\x1f\x7f]/.test(value)) throw new Error('Invalid AI role label');
    return value;
}
function displayLabel(value: unknown): string {
    const result = label(value);
    if (/(?:\b(?:api[_-]?key|token|secret|password|authorization)\s*[:=]|\bbearer\s+|\bsk-[a-z0-9]{8,}|:\/\/)/i.test(result))
        throw new Error('Unsafe AI role label');
    return result;
}
function bool(value: unknown): boolean {
    if (typeof value !== 'boolean') throw new Error('Invalid AI role boolean');
    return value;
}
function unique<Value extends string>(value: unknown, choices: readonly Value[]): Value[] {
    if (!Array.isArray(value) || value.length > choices.length) throw new Error('Invalid AI role list');
    const parsed = value.map(item => select(item, choices));
    if (new Set(parsed).size !== parsed.length) throw new Error('Duplicate AI role value');
    return parsed;
}
const capabilities = ['conversationalText', 'streaming', 'structuredOutput', 'toolCalling'] as const;
const preferences = ['prefer-local', 'prefer-hosted', 'prefer-reasoning-capable', 'prefer-larger-context'] as const;

export function parseAIRoleId(value: unknown): AIRoleId { return select(value, AI_ROLE_IDS); }
export function parseAIRoleHealth(value: unknown): AIRoleHealth {
    return select(value, ['ready', 'using-fallback', 'needs-configuration', 'broken', 'unavailable'] as const);
}
export function parseAIRoleHardConstraints(value: unknown): AIRoleHardConstraints {
    const item = object(value, ['requiredCapabilities', 'locality', 'minimumKnownContextTokens',
        'enabledOnly', 'usableOnly', 'hostedProjectData']);
    const result: AIRoleHardConstraints = {
        requiredCapabilities: unique(item.requiredCapabilities, capabilities),
        locality: select(item.locality, ['any', 'local-only', 'hosted-only'] as const),
        enabledOnly: bool(item.enabledOnly), usableOnly: bool(item.usableOnly),
        hostedProjectData: select(item.hostedProjectData, ['forbidden', 'requires-feature-authorization'] as const),
        ...(item.minimumKnownContextTokens === undefined ? {} :
            { minimumKnownContextTokens: integer(item.minimumKnownContextTokens) })
    };
    return result;
}
export function intersectAIRoleHardConstraints(left: AIRoleHardConstraints, right: AIRoleHardConstraints): AIRoleHardConstraints {
    const first = parseAIRoleHardConstraints(left);
    const second = parseAIRoleHardConstraints(right);
    if (first.locality !== 'any' && second.locality !== 'any' && first.locality !== second.locality)
        throw new Error('Contradictory AI role locality constraints');
    return {
        requiredCapabilities: capabilities.filter(capability => first.requiredCapabilities.includes(capability) ||
            second.requiredCapabilities.includes(capability)),
        locality: first.locality === 'any' ? second.locality : first.locality,
        ...(first.minimumKnownContextTokens === undefined && second.minimumKnownContextTokens === undefined ? {} :
            { minimumKnownContextTokens: Math.max(first.minimumKnownContextTokens ?? 0, second.minimumKnownContextTokens ?? 0) }),
        enabledOnly: first.enabledOnly || second.enabledOnly,
        usableOnly: first.usableOnly || second.usableOnly,
        hostedProjectData: first.hostedProjectData === 'forbidden' || second.hostedProjectData === 'forbidden' ?
            'forbidden' : 'requires-feature-authorization'
    };
}
export function parseAIRoleTarget(value: unknown): AIRoleTarget {
    const item = object(value, ['connectionId', 'modelId']);
    return { connectionId: label(item.connectionId, 200), modelId: label(item.modelId, 200) };
}
export function parseAIRolePolicyEntry(value: unknown): AIRolePolicyEntry {
    const type = object(value, ['type', 'target', 'lastKnown', 'hard', 'preferences']).type;
    if (type === 'exact') {
        const item = object(value, ['type', 'target', 'lastKnown']);
        const descriptor = item.lastKnown === undefined ? undefined : object(item.lastKnown, ['connectionLabel', 'modelLabel', 'locality']);
        return { type, target: parseAIRoleTarget(item.target), ...(descriptor === undefined ? {} : { lastKnown: {
            connectionLabel: displayLabel(descriptor.connectionLabel), modelLabel: displayLabel(descriptor.modelLabel),
            locality: select(descriptor.locality, ['local', 'hosted'] as const)
        } }) };
    }
    if (type === 'constraints') {
        const item = object(value, ['type', 'hard', 'preferences']);
        return { type, hard: parseAIRoleHardConstraints(item.hard), preferences: unique(item.preferences, preferences) };
    }
    throw new Error('Invalid AI role entry');
}
export function parseAIRolePolicy(value: unknown): AIRolePolicy {
    const item = object(value, ['roleId', 'preferred', 'fallbacks', 'hard', 'preferences', 'allowFallback']);
    if (!Array.isArray(item.fallbacks) || item.fallbacks.length > 8 ||
        (item.preferred === undefined && item.fallbacks.length)) throw new Error('Invalid AI role fallbacks');
    const hard = parseAIRoleHardConstraints(item.hard);
    const preferred = item.preferred === undefined ? undefined : parseAIRolePolicyEntry(item.preferred);
    const fallbacks = item.fallbacks.map(parseAIRolePolicyEntry);
    for (const entry of [preferred, ...fallbacks]) if (entry?.type === 'constraints')
        intersectAIRoleHardConstraints(hard, entry.hard);
    return { roleId: parseAIRoleId(item.roleId), ...(preferred === undefined ? {} : { preferred }),
        fallbacks, hard, preferences: unique(item.preferences, preferences), allowFallback: bool(item.allowFallback) };
}
export function parseAIRolePolicySnapshot(value: unknown): AIRolePolicySnapshot {
    const item = object(value, ['version', 'revision', 'policies']);
    if (item.version !== AI_ROLE_POLICY_VERSION || !Array.isArray(item.policies) || item.policies.length !== AI_ROLE_IDS.length)
        throw new Error('Invalid AI role policy snapshot');
    const policies = item.policies.map(parseAIRolePolicy);
    if (policies.some((policy, index) => policy.roleId !== AI_ROLE_IDS[index])) throw new Error('Invalid AI role policy identities');
    return { version: AI_ROLE_POLICY_VERSION, revision: integer(item.revision), policies };
}
export function parseAIRolePolicyMutationRequest(value: unknown): AIRolePolicyMutationRequest {
    const item = object(value, ['version', 'expectedRevision', 'policy']);
    if (item.version !== AI_ROLE_POLICY_VERSION) throw new Error('Invalid AI role policy version');
    return { version: AI_ROLE_POLICY_VERSION, expectedRevision: integer(item.expectedRevision), policy: parseAIRolePolicy(item.policy) };
}

function freeze<Value>(value: Value): Value {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        for (const nested of Object.values(value)) freeze(nested);
        Object.freeze(value);
    }
    return value;
}
export function parseRoutingProvenance(value: unknown): RoutingProvenance {
    const item = object(value, ['version', 'source', 'requestedRole', 'policyRevision', 'effectiveHard',
        'preferredTarget', 'actualTarget', 'executionLabels', 'attempts']);
    if (item.version !== AI_ROLE_POLICY_VERSION) throw new Error('Invalid AI routing version');
    const source = select(item.source, ['explicit-turn', 'explicit-feature', 'chat-exact-default', 'role-policy'] as const);
    if ((source === 'role-policy') !== (item.requestedRole !== undefined && item.policyRevision !== undefined))
        throw new Error('Invalid AI routing role source');
    if (!Array.isArray(item.attempts) || item.attempts.length > 9) throw new Error('Invalid AI routing attempts');
    const attempts = item.attempts.map(value => {
        const attempt = object(value, ['target', 'outcome']);
        return { target: parseAIRoleTarget(attempt.target), outcome: select(attempt.outcome,
            ['selected', 'disabled', 'unavailable', 'ineligible', 'transient-transport', 'transient-upstream',
                'cancelled', 'authentication', 'invalid-configuration', 'consent-required', 'partial-output',
                'semantic-failure'] as const) };
    });
    const labels = object(item.executionLabels, ['connection', 'provider', 'model']);
    const actualTarget = parseAIRoleTarget(item.actualTarget);
    if (attempts.filter(attempt => attempt.outcome === 'selected').length !== 1 ||
        new Set(attempts.map(attempt => `${attempt.target.connectionId.length}:${attempt.target.connectionId}${attempt.target.modelId}`)).size !== attempts.length ||
        (source !== 'role-policy' && attempts.length !== 1) ||
        attempts.some((attempt, index) => attempt.outcome === 'selected' && (index !== attempts.length - 1 ||
            attempt.target.connectionId !== actualTarget.connectionId || attempt.target.modelId !== actualTarget.modelId)))
        throw new Error('Invalid AI routing selection');
    return freeze({ version: AI_ROLE_POLICY_VERSION, source,
        ...(item.requestedRole === undefined ? {} : { requestedRole: parseAIRoleId(item.requestedRole) }),
        ...(item.policyRevision === undefined ? {} : { policyRevision: integer(item.policyRevision) }),
        effectiveHard: parseAIRoleHardConstraints(item.effectiveHard),
        ...(item.preferredTarget === undefined ? {} : { preferredTarget: parseAIRoleTarget(item.preferredTarget) }),
        actualTarget,
        executionLabels: { connection: displayLabel(labels.connection), provider: displayLabel(labels.provider),
            model: displayLabel(labels.model) },
        attempts });
}
