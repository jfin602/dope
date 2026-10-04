import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_ROLE_IDS, intersectAIRoleHardConstraints, parseAIRoleHardConstraints, parseAIRoleId, parseAIRoleHealth,
    parseAIRolePolicy, parseAIRolePolicyEntry, parseAIRolePolicyMutationRequest, parseAIRolePolicySnapshot,
    parseRoutingProvenance } from '../../packages/ai/lib/index.js';
import type { AIRoleHardConstraints, AIRolePolicy, RoutingProvenance } from '../../packages/ai/lib/index.js';

const hard = (): AIRoleHardConstraints => ({ requiredCapabilities: [], locality: 'any',
    enabledOnly: false, usableOnly: false, hostedProjectData: 'requires-feature-authorization' });
const target = { connectionId: 'connection-1', modelId: 'model-1' };
const policy = (roleId: AIRolePolicy['roleId']): AIRolePolicy => ({ roleId, hard: hard(), preferences: [],
    preferred: { type: 'exact', target }, fallbacks: [], allowFallback: true });

test('fixed role identities and a revisioned complete snapshot', () => {
    assert.deepEqual(AI_ROLE_IDS, ['interactive', 'deep-reasoning', 'background', 'software-map', 'coding-agent']);
    for (const id of AI_ROLE_IDS) assert.equal(parseAIRoleId(id), id);
    assert.equal(Object.isFrozen(AI_ROLE_IDS), true);
    assert.equal(parseAIRoleHealth('using-fallback'), 'using-fallback');
    assert.throws(() => parseAIRoleHealth('custom'));
    assert.throws(() => parseAIRoleId('custom'));
    const snapshot = { version: 1, revision: 3, policies: AI_ROLE_IDS.map(policy) };
    assert.deepEqual(parseAIRolePolicySnapshot(snapshot), snapshot);
    assert.throws(() => parseAIRolePolicySnapshot({ ...snapshot, policies: snapshot.policies.slice(1) }));
    assert.throws(() => parseAIRolePolicySnapshot({ ...snapshot, policies: [...snapshot.policies].reverse() }));
    assert.throws(() => parseAIRolePolicySnapshot({ ...snapshot, revision: -1 }));
    assert.throws(() => parseAIRolePolicy({ ...policy('interactive'), name: 'rename' }));
    assert.deepEqual(parseAIRolePolicyMutationRequest({ version: 1, expectedRevision: 3,
        policy: policy('interactive') }).policy, policy('interactive'));
    assert.throws(() => parseAIRolePolicyMutationRequest({ version: 1, expectedRevision: -1,
        policy: policy('interactive') }));
    assert.deepEqual(parseAIRolePolicy({ ...policy('background'), preferred: undefined, allowFallback: false }),
        { roleId: 'background', hard: hard(), preferences: [], allowFallback: false, fallbacks: [] });
});

test('exact identities, tombstones and bounded constraint targets reject extra data', () => {
    const exact = { type: 'exact', target, lastKnown: { connectionLabel: 'Old connection',
        modelLabel: 'Old model', locality: 'local' } };
    assert.deepEqual(parseAIRolePolicyEntry(exact), exact);
    assert.throws(() => parseAIRolePolicyEntry({ ...exact, lastKnown: { ...exact.lastKnown, credential: 'secret' } }));
    assert.throws(() => parseAIRolePolicyEntry({ ...exact, target: { ...target, endpoint: 'https://secret' } }));
    assert.throws(() => parseAIRolePolicyEntry({ ...exact, lastKnown: {
        ...exact.lastKnown, modelLabel: 'x'.repeat(121) } }));
    assert.throws(() => parseAIRolePolicyEntry({ ...exact, lastKnown: {
        ...exact.lastKnown, modelLabel: 'Bearer sk-private-token' } }));
    const constraints = { type: 'constraints', hard: { ...hard(), locality: 'hosted-only',
        requiredCapabilities: ['structuredOutput'] }, preferences: ['prefer-larger-context'] };
    assert.deepEqual(parseAIRolePolicyEntry(constraints), constraints);
    assert.throws(() => parseAIRolePolicyEntry({ ...constraints, preferences: ['prefer-price'] }));
    assert.throws(() => parseAIRolePolicyEntry({ ...constraints, hard: { ...hard(), consent: true } }));
    assert.throws(() => parseAIRolePolicy({ ...policy('software-map'), preferred: constraints,
        hard: { ...hard(), locality: 'local-only' } }));
    assert.throws(() => parseAIRolePolicy({ ...policy('interactive'), preferred: undefined,
        fallbacks: [exact] }));
});

test('hard constraints intersect monotonically and contradictory locality fails', () => {
    const left = { ...hard(), requiredCapabilities: ['streaming'] as const,
        minimumKnownContextTokens: 4096, locality: 'local-only' as const, enabledOnly: true };
    const right = { ...hard(), requiredCapabilities: ['toolCalling'] as const,
        minimumKnownContextTokens: 8192, usableOnly: true, hostedProjectData: 'forbidden' as const };
    assert.deepEqual(intersectAIRoleHardConstraints(left, right), {
        requiredCapabilities: ['streaming', 'toolCalling'], minimumKnownContextTokens: 8192,
        locality: 'local-only', enabledOnly: true, usableOnly: true, hostedProjectData: 'forbidden'
    });
    assert.deepEqual(intersectAIRoleHardConstraints(right, left).requiredCapabilities,
        ['streaming', 'toolCalling']);
    assert.throws(() => intersectAIRoleHardConstraints(left, { ...right, locality: 'hosted-only' }),
        /Contradictory/);
    assert.throws(() => parseAIRoleHardConstraints({ ...hard(), requiredCapabilities: ['streaming', 'streaming'] }));
    assert.throws(() => parseAIRoleHardConstraints({ ...hard(), minimumKnownContextTokens: -1 }));
    assert.throws(() => parseAIRoleHardConstraints({ ...hard(), hostedProjectData: 'authorized' }));
});

test('routing provenance snapshots are immutable, bounded, and reject secret/provider payload fields', () => {
    const input: RoutingProvenance = { version: 1, source: 'role-policy', requestedRole: 'interactive',
        policyRevision: 4, effectiveHard: hard(), preferredTarget: target, actualTarget: target,
        executionLabels: { connection: 'Local', provider: 'LM Studio', model: 'Example' },
        attempts: [{ target, outcome: 'selected' }] };
    const parsed = parseRoutingProvenance(input);
    assert.deepEqual(parsed, input);
    assert.notEqual(parsed, input);
    assert.equal(Object.isFrozen(parsed), true);
    assert.equal(Object.isFrozen(parsed.attempts[0].target), true);
    assert.equal(Object.isFrozen(parsed.effectiveHard.requiredCapabilities), true);
    assert.throws(() => (parsed.attempts as Array<unknown>).push({ target, outcome: 'selected' }));
    assert.throws(() => parseRoutingProvenance({ ...input, secret: 'sk-private' }));
    assert.throws(() => parseRoutingProvenance({ ...input, chainOfThought: 'private' }));
    assert.throws(() => parseRoutingProvenance({ ...input, executionLabels: { ...input.executionLabels,
        apiKey: 'private' } }));
    assert.throws(() => parseRoutingProvenance({ ...input, executionLabels: { ...input.executionLabels,
        provider: 'https://user:password@private.example' } }));
    assert.throws(() => parseRoutingProvenance({ ...input, attempts: [{ ...input.attempts[0], payload: 'private' }] }));
    assert.throws(() => parseRoutingProvenance({ ...input, attempts: Array(10).fill(input.attempts[0]) }));
    assert.throws(() => parseRoutingProvenance({ ...input, attempts: [{ target, outcome: 'disabled' }] }));
    assert.throws(() => parseRoutingProvenance({ ...input, attempts: [input.attempts[0], input.attempts[0]] }));
    assert.throws(() => parseRoutingProvenance({ ...input, source: 'explicit-turn' }));
});
