import assert from 'node:assert/strict';
import test from 'node:test';
import { AI_ROLE_IDS } from '../../packages/ai/lib/index.js';
import type { AIConnectionHealth, AIModel, AIRoleHardConstraints, AIRolePolicyEntry } from
    '../../packages/ai/lib/index.js';
import { ModelRuntimeFailure } from '../../packages/contracts/lib/model-runtime.js';
import type { ConversationEvent } from '../../packages/contracts/lib/model-runtime.js';
import { AIRoleRoutingService, RoleRoutingFailure, exactRoutingProvenance } from
    '../../packages/theia-extension/lib/node/ai-role-routing.js';

const hard = (): AIRoleHardConstraints => ({ requiredCapabilities: [], locality: 'any', enabledOnly: true,
    usableOnly: true, hostedProjectData: 'requires-feature-authorization' });
const exact = (connectionId: string): AIRolePolicyEntry =>
    ({ type: 'exact', target: { connectionId, modelId: 'model' } });
const known = (value: boolean | number) => ({ source: 'configured' as const, value });
const unknown = { source: 'unknown' as const };
const model = (connectionId: string, locality: AIModel['locality'] = 'hosted'): AIModel =>
    ({ version: 1, connectionId, providerModelKey: 'model', label: `Model ${connectionId}`, locality,
        enabled: true, state: 'ready', capabilities: { conversationalText: known(true), streaming: known(true),
            structuredOutput: unknown, toolCalling: known(false) }, limits: { contextWindowTokens: known(8192),
            maxInputTokens: unknown, maxOutputTokens: unknown } });
const complete = (text: string): ConversationEvent => ({ type: 'complete', text,
    usage: { tokenMeasurement: 'unavailable' } });
type Step = ConversationEvent | Error;

function harness(options: { preferred?: string; fallbacks?: string[]; models?: AIModel[];
    policyFallback?: boolean; scripts?: Record<string, Step[]>; onGenerate?: () => void;
    health?: Record<string, AIConnectionHealth> } = {}) {
    const models = options.models ?? [model('a'), model('b')];
    const state = { policy: { version: 1 as const, revision: 4, policies: AI_ROLE_IDS.map(roleId => ({
        roleId, preferred: exact(options.preferred ?? 'a'), fallbacks: (options.fallbacks ?? ['b']).map(exact),
        hard: hard(), preferences: [], allowFallback: options.policyFallback ?? true })) },
        registry: { version: 1 as const, revision: 2, connections: models.map(item => ({
            version: 1 as const, id: item.connectionId, alias: `Connection ${item.connectionId}`,
            lifecycle: 'enabled' as const, config: { type: 'openai' as const } })), models } };
    const calls: string[] = [];
    const service = new AIRoleRoutingService({ read: async () => state.policy }, {
        inventory: async () => ({ registry: state.registry,
            observations: state.registry.connections.map(item => ({ connectionId: item.id,
                health: options.health?.[item.id] ?? 'ready' as const })),
            tests: [] }), loadedLocalModelsSnapshot: () => models.filter(item => item.locality === 'local').map(item =>
            ({ connectionId: item.connectionId, providerModelKey: item.providerModelKey,
                contextWindowTokens: 8192 })) }, {
        async *generate(target) {
            calls.push(target.connectionId);
            options.onGenerate?.();
            for (const step of options.scripts?.[target.connectionId] ?? [complete(target.connectionId)]) {
                if (step instanceof Error) throw step;
                yield step;
            }
        }
    });
    const request = (changes: Partial<Parameters<typeof service.generate>[0]> = {}) => ({
        roleId: 'interactive' as const, requestHard: hard(), hostedProjectDataAuthorized: true,
        allowFallback: true, conversation: { messages: [{ role: 'user' as const, content: 'hello' }] }, ...changes });
    const run = async (changes: Partial<Parameters<typeof service.generate>[0]> = {}) => {
        const events = [];
        for await (const event of service.generate(request(changes))) events.push(event);
        return events;
    };
    return { service, state, calls, request, run };
}

async function rejected(run: () => Promise<unknown>, expected: string[]) {
    await assert.rejects(run, error => {
        assert.ok(error instanceof RoleRoutingFailure);
        assert.deepEqual(error.attempts.map(attempt => attempt.outcome), expected);
        if (error.attempts.length) assert.ok(Object.isFrozen(error.attempts[0].target));
        return true;
    });
}

test('preflight ineligible or unavailable preferred falls back only when authorized', async () => {
    const base = harness({ preferred: 'gone', models: [model('b')] });
    const events = await base.run();
    assert.deepEqual(base.calls, ['b']);
    assert.deepEqual(events.at(-1)?.type, 'complete');
    if (events.at(-1)?.type !== 'complete') throw Error('Expected completion');
    assert.deepEqual(events.at(-1)?.routingProvenance.attempts.map(item => item.outcome), ['unavailable', 'selected']);
    await rejected(() => base.run({ allowFallback: false }), ['unavailable']);
    assert.deepEqual(base.calls, ['b']);
    const disabled = harness({ models: [{ ...model('a'), enabled: false }, model('b')] });
    const selected = await disabled.run();
    if (selected[0].type !== 'complete') throw Error('Expected completion');
    assert.deepEqual(selected[0].routingProvenance.attempts.map(item => item.outcome), ['disabled', 'selected']);
    const first = model('a');
    const ineligible = harness({ models: [{ ...first, capabilities: { ...first.capabilities,
        streaming: known(false) } }, model('b')] });
    const routed = await ineligible.run({ requestHard: { ...hard(), requiredCapabilities: ['streaming'] } });
    if (routed[0].type !== 'complete') throw Error('Expected completion');
    assert.deepEqual(routed[0].routingProvenance.attempts.map(item => item.outcome), ['ineligible', 'selected']);
    assert.deepEqual(ineligible.calls, ['b']);
});

test('preflight exclusions retain policy order and authentication, invalid config and consent stop routing', async () => {
    const ordered = harness({ preferred: 'gone', fallbacks: ['absent', 'b'], models: [model('b')] });
    const result = await ordered.run();
    if (result[0].type !== 'complete') throw Error('Expected completion');
    assert.deepEqual(result[0].routingProvenance.attempts.map(item => item.outcome),
        ['unavailable', 'unavailable', 'selected']);
    for (const health of ['needs-authentication', 'invalid-configuration'] as const) {
        const base = harness({ health: { a: health } });
        await rejected(() => base.run(), [health === 'needs-authentication' ? 'authentication' :
            'invalid-configuration']);
        assert.deepEqual(base.calls, []);
    }
    const hosted = harness({ models: [model('a'), model('b', 'local')] });
    await rejected(() => hosted.run({ hostedProjectDataAuthorized: false }), ['consent-required']);
    assert.deepEqual(hosted.calls, []);
});

test('transient fallback is bounded; selected output and actual runtime identity are recorded', async () => {
    const base = harness({ scripts: { a: [new ModelRuntimeFailure('temporary', 'transient-transport')],
        b: [{ type: 'delta', text: 'B' }, { ...complete('B'), actualModelId: 'snapshot-b',
            provenance: { connectionId: 'b', modelId: 'snapshot-b', providerId: 'openai', modelLabel: 'Snapshot B' } }] } });
    const events = await base.run();
    assert.deepEqual(base.calls, ['a', 'b']);
    assert.deepEqual(events.map(item => item.type), ['delta', 'complete']);
    if (events[1].type !== 'complete') throw Error('Expected completion');
    const provenance = events[1].routingProvenance;
    assert.equal(provenance.policyRevision, 4);
    assert.deepEqual(provenance.preferredTarget, { connectionId: 'a', modelId: 'model' });
    assert.deepEqual(provenance.actualTarget, { connectionId: 'b', modelId: 'snapshot-b' });
    assert.deepEqual(provenance.attempts.map(item => item.outcome), ['transient-transport', 'selected']);
    assert.ok(Object.isFrozen(provenance.executionLabels));
    assert.equal(base.service.explain(provenance).executionLabels.model, 'Snapshot B');
    assert.deepEqual(base.state.policy.revision, 4);
});

test('normalized unavailable failures fallback once, but cancellation before a candidate sends nothing', async () => {
    for (const failureClass of ['connection-unavailable', 'model-unavailable'] as const) {
        const base = harness({ scripts: { a: [new ModelRuntimeFailure('gone', failureClass)] } });
        const result = await base.run();
        if (result[0].type !== 'complete') throw Error('Expected completion');
        assert.deepEqual(result[0].routingProvenance.attempts.map(item => item.outcome),
            ['unavailable', 'selected']);
        assert.deepEqual(base.calls, ['a', 'b']);
    }
    const abort = new AbortController();
    abort.abort();
    const base = harness();
    await rejected(() => base.run({ conversation: { messages: [], signal: abort.signal } }), []);
    assert.deepEqual(base.calls, []);
});

test('cancel, auth, invalid JSON, rejected provider, unsupported capability and unknown errors never fallback', async () => {
    for (const failureClass of ['cancelled', 'authentication', 'invalid-json', 'nonretryable-provider',
        'unsupported-capability'] as const) {
        const base = harness({ scripts: { a: [new ModelRuntimeFailure('failure', failureClass)] } });
        await rejected(() => base.run(), [failureClass === 'cancelled' ? 'cancelled' :
            failureClass === 'authentication' ? 'authentication' : failureClass === 'unsupported-capability' ?
                'ineligible' : 'semantic-failure']);
        assert.deepEqual(base.calls, ['a']);
    }
    const unknown = harness({ scripts: { a: [new Error('invalid configuration')] } });
    await rejected(() => unknown.run(), ['semantic-failure']);
});

test('a meaningful delta forbids fallback even on transient failure; no duplicate candidates', async () => {
    const base = harness({ fallbacks: ['a', 'b', 'b'], scripts: { a: [
        { type: 'delta', text: 'partial' }, new ModelRuntimeFailure('timeout', 'transient-upstream')] } });
    const events: string[] = [];
    await rejected(async () => {
        for await (const event of base.service.generate(base.request())) events.push(event.type);
    }, ['partial-output']);
    assert.deepEqual(events, ['delta']);
    assert.deepEqual(base.calls, ['a']);
    const other = harness({ fallbacks: ['a', 'b', 'b'], scripts: { a: [new ModelRuntimeFailure('temporary',
        'transient-upstream')] } });
    await other.run();
    assert.deepEqual(other.calls, ['a', 'b']);
});

test('feature and policy fallback decisions, locality and egress cannot be widened', async () => {
    const base = harness({ scripts: { a: [new ModelRuntimeFailure('temporary', 'transient-upstream')] } });
    await rejected(() => base.run({ allowFallback: false }), ['transient-upstream']);
    assert.deepEqual(base.calls, ['a']);
    const policy = harness({ policyFallback: false, scripts: { a: [new ModelRuntimeFailure('temporary',
        'transient-transport')] } });
    await rejected(() => policy.run(), ['transient-transport']);
    const local = harness({ models: [model('a', 'local'), model('b', 'hosted')], scripts: {
        a: [new ModelRuntimeFailure('temporary', 'transient-transport')] } });
    await rejected(() => local.run({ hostedProjectDataAuthorized: false }),
        ['transient-transport', 'consent-required']);
    assert.deepEqual(local.calls, ['a']);
    await rejected(() => local.run({ requestHard: { ...hard(), locality: 'local-only' } }),
        ['transient-transport', 'ineligible']);
    assert.deepEqual(local.calls, ['a', 'a']);
});

test('exact provenance is one target only; policy and inventory changes affect only the next resolution', async () => {
    const exactProvenance = exactRoutingProvenance('explicit-turn', { connectionId: 'a', modelId: 'model' }, hard(),
        { connection: 'A', provider: 'openai', model: 'Model A' });
    assert.deepEqual(exactProvenance.attempts.map(item => item.outcome), ['selected']);
    assert.ok(Object.isFrozen(exactProvenance));
    let changed = false;
    const base = harness({ onGenerate: () => {
        if (changed) return;
        changed = true;
        base.state.policy.revision++;
        base.state.policy.policies[0].preferred = exact('b');
        base.state.registry.models[0].label = 'Changed';
    } });
    const first = await base.run();
    if (first[0].type !== 'complete') throw Error('Expected completion');
    assert.equal(first[0].routingProvenance.policyRevision, 4);
    assert.equal(first[0].routingProvenance.executionLabels.model, 'Model a');
    assert.deepEqual(base.calls, ['a']);
    const next = await base.run();
    if (next[0].type !== 'complete') throw Error('Expected completion');
    assert.deepEqual(base.calls, ['a', 'b']);
    assert.equal(next[0].routingProvenance.policyRevision, 5);
});
