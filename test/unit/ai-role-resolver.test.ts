import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_ROLE_IDS, futureFeatureRoleRequest, resolveAIRole } from '../../packages/ai/lib/index.js';
import type { AIConnection, AIModel, AIRegistrySnapshot, AIRoleHardConstraints, AIRolePolicy,
    AIRolePolicyEntry, AIRoleResolverInput } from '../../packages/ai/lib/index.js';

const known = (value: boolean | number) => ({ source: 'configured' as const, value });
const unknown = { source: 'unknown' as const };
const hard = (): AIRoleHardConstraints => ({ requiredCapabilities: [], locality: 'any',
    enabledOnly: true, usableOnly: true, hostedProjectData: 'requires-feature-authorization' });
const exact = (connectionId: string, modelId = 'model'): AIRolePolicyEntry =>
    ({ type: 'exact', target: { connectionId, modelId } });
const constraints = (changes: Partial<AIRoleHardConstraints> = {}, preferences: AIRolePolicy['preferences'] = []): AIRolePolicyEntry =>
    ({ type: 'constraints', hard: { ...hard(), ...changes }, preferences });
const connection = (id: string): AIConnection => ({ version: 1, id, alias: id, lifecycle: 'enabled',
    config: { type: 'openai' } });
const model = (connectionId: string, modelId = 'model', locality: AIModel['locality'] = 'hosted',
    context = 8192): AIModel => ({ version: 1, connectionId, providerModelKey: modelId, label: modelId,
    locality, enabled: true, state: 'ready', capabilities: { conversationalText: known(true),
        streaming: known(true), structuredOutput: unknown, toolCalling: known(false) },
    limits: { contextWindowTokens: known(context), maxInputTokens: unknown, maxOutputTokens: unknown } });
const inventory = (...models: AIModel[]): AIRegistrySnapshot => ({ version: 1, revision: 2,
    connections: [...new Set(models.map(item => item.connectionId))].map(connection), models });
const policy = (roleId: AIRolePolicy['roleId'], preferred?: AIRolePolicyEntry,
    fallbacks: AIRolePolicyEntry[] = []): AIRolePolicy => ({ roleId, ...(preferred ? { preferred } : {}),
    fallbacks, hard: hard(), preferences: [], allowFallback: true });
const input = (preferred?: AIRolePolicyEntry, fallbacks: AIRolePolicyEntry[] = [],
    models: AIModel[] = [model('a'), model('b')]): AIRoleResolverInput => ({
    policy: { version: 1, revision: 7, policies: AI_ROLE_IDS.map(id => policy(id, preferred, fallbacks)) },
    inventory: inventory(...models), roleId: 'interactive', requestHard: hard(),
    observations: [...new Set(models.map(item => item.connectionId))].map(connectionId =>
        ({ connectionId, health: 'ready' as const })), loadedLocalModels: [], hostedProjectDataAuthorized: true
});
const targets = (result: ReturnType<typeof resolveAIRole>) => result.candidates.map(item => item.target.connectionId);

test('unconfigured roles never select an arbitrary model, for every fixed role', () => {
    const base = input();
    for (const roleId of AI_ROLE_IDS) {
        const result = resolveAIRole({ ...base, roleId });
        assert.equal(result.health, 'needs-configuration');
        assert.deepEqual(result.candidates, []);
        assert.equal(result.selectedTarget, undefined);
    }
});

test('future Background stays Local and Coding Agent is policy identity without authority', () => {
    const base = input(exact('hosted'), [exact('local')],
        [model('hosted'), model('local', 'model', 'local')]);
    const background = futureFeatureRoleRequest('background');
    const coding = futureFeatureRoleRequest('coding-agent');
    const policies = base.policy.policies.map(item => ({ ...item, allowFallback: true }));
    const loadedLocalModels = [{ connectionId: 'local', providerModelKey: 'model', contextWindowTokens: 32768 }];
    const result = resolveAIRole({ ...base, policy: { ...base.policy, policies }, loadedLocalModels, ...background });
    assert.deepEqual(result.candidates.map(candidate => candidate.target.connectionId), ['local']);
    assert.equal(result.excluded.find(item => item.target?.connectionId === 'hosted')?.reason, 'locality');
    assert.equal(background.allowFallback, false);
    assert.equal(background.hostedProjectDataAuthorized, false);
    assert.equal(futureFeatureRoleRequest('background', true).hostedProjectDataAuthorized, false);
    assert.equal(coding.roleId, 'coding-agent');
    assert.equal(coding.hostedProjectDataAuthorized, false);
    assert.equal(coding.requestHard.hostedProjectData, 'requires-feature-authorization');
    assert.equal(futureFeatureRoleRequest('coding-agent', true).hostedProjectDataAuthorized, true);
    assert.equal(coding.allowFallback, false);
    assert.deepEqual(Object.keys(coding).sort(), ['allowFallback', 'hostedProjectDataAuthorized', 'requestHard', 'roleId']);
});

test('every built-in role uses the same configured resolution path', () => {
    const base = input(exact('a'));
    for (const roleId of AI_ROLE_IDS) {
        const result = resolveAIRole({ ...base, roleId, policy: { ...base.policy,
            policies: base.policy.policies.map(item => item.roleId === roleId ? { ...item,
                preferred: exact('a') } : item) } });
        assert.equal(result.health, 'ready');
        assert.deepEqual(result.selectedTarget, { connectionId: 'a', modelId: 'model' });
        assert.equal(result.policyRevision, 7);
    }
});

test('exact preferred precedes constraint candidates and fallback entries; stable across inventory order', () => {
    const base = input(exact('b'), [constraints(), exact('a')]);
    const result = resolveAIRole(base);
    assert.deepEqual(targets(result), ['b', 'a']);
    assert.deepEqual(result.candidates.map(item => item.entryIndex), [0, 1]);
    assert.equal(result.preferredTarget?.connectionId, 'b');
    assert.equal(result.health, 'ready');
    assert.deepEqual(resolveAIRole({ ...base, inventory: inventory(...base.inventory.models.toReversed()) }), result);
    assert.equal(result.excluded.find(item => item.entryIndex === 1 && item.target?.connectionId === 'b')?.reason,
        'already-candidate');
});

test('policy sequence beats preferences; preference priority, loaded context and immutable IDs break ties', () => {
    const base = input(constraints({}, ['prefer-hosted', 'prefer-larger-context']), [exact('local')],
        [model('local', 'model', 'local'), model('z', 'model', 'hosted', 8192),
            model('a', 'model', 'hosted', 8192), model('b', 'model', 'hosted', 16384)]);
    const ready = { ...base, loadedLocalModels: [{ connectionId: 'local', providerModelKey: 'model', contextWindowTokens: 32768 }] };
    assert.deepEqual(targets(resolveAIRole(ready)), ['b', 'a', 'z', 'local']);
    assert.deepEqual(targets(resolveAIRole({ ...ready, policy: { ...ready.policy,
        policies: ready.policy.policies.map(item => ({ ...item,
            preferred: constraints({}, ['prefer-reasoning-capable', 'prefer-larger-context']) })) } })),
    ['local', 'b', 'a', 'z']);
    assert.deepEqual(targets(resolveAIRole({ ...ready, policy: { ...ready.policy,
        policies: ready.policy.policies.map(item => ({ ...item, preferences: ['prefer-local' as const] })) } })),
    ['local', 'b', 'a', 'z']);
    const first = input(exact('a'), [constraints({}, ['prefer-local'])], base.inventory.models as AIModel[]);
    assert.deepEqual(targets(resolveAIRole({ ...first, loadedLocalModels: ready.loadedLocalModels })),
        ['a', 'local', 'b', 'z']);
});

test('Unknown capability and Local loaded capacity cannot satisfy hard requirements', () => {
    const base = input(constraints({ requiredCapabilities: ['structuredOutput'], minimumKnownContextTokens: 4096 }),
        [], [model('local', 'model', 'local'), model('hosted')]);
    const noAuth = resolveAIRole({ ...base, hostedProjectDataAuthorized: false });
    assert.equal(noAuth.health, 'broken');
    assert.equal(noAuth.excluded.find(item => item.target?.connectionId === 'local')?.reason, 'capability-unknown');
    const capable = { ...base, inventory: inventory({ ...base.inventory.models[0], capabilities: {
        ...base.inventory.models[0].capabilities, structuredOutput: known(true) } }, base.inventory.models[1]) };
    assert.equal(resolveAIRole({ ...capable, hostedProjectDataAuthorized: false }).excluded[0].reason, 'context-unknown');
    const loaded = [{ connectionId: 'local', providerModelKey: 'model', contextWindowTokens: 2048 }];
    assert.equal(resolveAIRole({ ...capable, hostedProjectDataAuthorized: false, loadedLocalModels: loaded })
        .excluded[0].reason, 'context-too-small');
    assert.equal(resolveAIRole({ ...capable, hostedProjectDataAuthorized: false, loadedLocalModels: [
        { ...loaded[0], contextWindowTokens: 4096 }] }).selectedTarget?.connectionId, 'local');
});

test('locality intersection, entry contradiction, and hosted egress are conservative', () => {
    const base = input(constraints({ locality: 'hosted-only' }), [exact('local')],
        [model('hosted'), model('local', 'model', 'local')]);
    const requestHard = { ...hard(), locality: 'local-only' as const };
    const result = resolveAIRole({ ...base, requestHard, hostedProjectDataAuthorized: false,
        loadedLocalModels: [{ connectionId: 'local', providerModelKey: 'model', contextWindowTokens: 8192 }] });
    assert.equal(result.health, 'using-fallback');
    assert.equal(result.excluded[0].reason, 'contradictory-constraints');
    assert.equal(result.selectedTarget?.connectionId, 'local');
    assert.throws(() => resolveAIRole({ ...base, requestHard, policy: { ...base.policy,
        policies: base.policy.policies.map(item => ({ ...item, hard: { ...hard(), locality: 'hosted-only' } })) } }),
    /Contradictory/);
    const hosted = input(exact('hosted'), [], [model('hosted')]);
    assert.equal(resolveAIRole({ ...hosted, hostedProjectDataAuthorized: false })
        .excluded[0].reason, 'hosted-egress-not-authorized');
    const forbidden = input(exact('hosted'), [], [model('hosted')]);
    assert.equal(resolveAIRole({ ...forbidden, requestHard: { ...hard(), hostedProjectData: 'forbidden' } })
        .excluded[0].reason, 'hosted-egress-forbidden');
});

test('disabled or removed preferred yields fallback health and recovers without policy writes', () => {
    const base = input(exact('a'), [exact('b')]);
    const disabled = { ...base, inventory: inventory({ ...base.inventory.models[0], enabled: false }, base.inventory.models[1]) };
    assert.equal(resolveAIRole(disabled).health, 'using-fallback');
    assert.equal(resolveAIRole(disabled).excluded[0].reason, 'disabled');
    assert.equal(resolveAIRole({ ...base, inventory: inventory(base.inventory.models[1]) }).excluded[0].reason,
        'missing-connection');
    assert.equal(resolveAIRole({ ...base, inventory: { ...base.inventory,
        models: [base.inventory.models[1]] } }).excluded[0].reason, 'missing-model');
    assert.equal(resolveAIRole(base).health, 'ready');
    assert.equal(resolveAIRole(base).selectedTarget?.connectionId, 'a');
    assert.equal(resolveAIRole({ ...disabled, policy: { ...disabled.policy, policies: disabled.policy.policies.map(item =>
        ({ ...item, allowFallback: false })) } }).health, 'broken');
    assert.equal(resolveAIRole({ ...base, observations: [] }).health, 'unavailable');
    assert.equal(base.policy.revision, 7);
});

test('observed readiness, eligibility exclusions and caller consent do not change snapshots', () => {
    const base = input(constraints({ requiredCapabilities: ['toolCalling'] }), [exact('b')]);
    const before = structuredClone(base);
    const result = resolveAIRole(base);
    assert.equal(result.selectedTarget?.connectionId, 'b');
    assert.equal(result.excluded.find(item => item.target?.connectionId === 'a')?.reason, 'capability-unsupported');
    assert.deepEqual(base, before);
    assert.deepEqual(resolveAIRole(base), result);
    assert.throws(() => resolveAIRole({ ...base, hostedProjectDataAuthorized: undefined as unknown as boolean }),
        /authorization/);
});

test('agentExecution hard constraint excludes unknown and generic conversational models', () => {
    const agent = { ...model('agent'), capabilities: { ...model('agent').capabilities,
        conversationalText: unknown, agentExecution: known(true) } };
    const base = input(constraints({ requiredCapabilities: ['agentExecution'] }), [],
        [model('ordinary'), agent, { ...model('unknown'), capabilities: { ...model('unknown').capabilities, agentExecution: unknown } }]);
    const result = resolveAIRole({ ...base, roleId: 'coding-agent', requestHard: {
        ...hard(), requiredCapabilities: ['agentExecution'] } });
    assert.deepEqual(targets(result), ['agent']);
    assert.equal(result.excluded.find(item => item.target?.connectionId === 'ordinary')?.reason, 'capability-unknown');
    assert.equal(result.excluded.find(item => item.target?.connectionId === 'unknown')?.reason, 'capability-unknown');
});
