import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { AI_ROLE_IDS } from '../../packages/ai/lib/index.js';
import type { AIModel, AIRolePolicySnapshot } from '../../packages/ai/src/index.ts';
import type { AIInventoryState } from '../../packages/contracts/src/ai-registry-service.ts';
import type { AIRolePolicyService } from '../../packages/contracts/src/ai-role-policy-service.ts';
import { AICenterRolesController, ROLE_DETAILS, ROLE_REASON_LABELS, roleEntryLabel, roleResolution,
    roleWarning } from '../../packages/theia-extension/lib/browser/ai-center-roles.js';

const known = (value: boolean | number) => ({ source: 'configured' as const, value });
const hard = () => ({ requiredCapabilities: [], locality: 'any' as const, enabledOnly: true, usableOnly: true,
    hostedProjectData: 'requires-feature-authorization' as const });
const policies = (): AIRolePolicySnapshot => ({ version: 1, revision: 0, policies: AI_ROLE_IDS.map(roleId => ({
    roleId, fallbacks: [], hard: hard(), preferences: [], allowFallback: false })) });
const model = (connectionId: string, locality: AIModel['locality']): AIModel => ({ version: 1,
    connectionId, providerModelKey: 'model', label: `${connectionId} model`, locality, enabled: true,
    state: 'ready', capabilities: { conversationalText: known(true), streaming: known(true),
        structuredOutput: { source: 'unknown' }, toolCalling: known(false) },
    limits: { contextWindowTokens: known(8192), maxInputTokens: { source: 'unknown' },
        maxOutputTokens: { source: 'unknown' } } });
const inventory = (): AIInventoryState => ({ registry: { version: 1, revision: 0,
    connections: ['local', 'hosted'].map(id => ({ version: 1, id, alias: id,
        lifecycle: 'enabled', config: id === 'local' ?
            { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234/v1' } : { type: 'openai' } })),
    models: [model('local', 'local'), model('hosted', 'hosted')] },
    observations: ['local', 'hosted'].map(connectionId => ({ connectionId, health: 'ready' })),
    loadedLocalModels: [{ connectionId: 'local', providerModelKey: 'model', contextWindowTokens: 4096 }], tests: [] });

test('five fixed roles show canonical descriptions, derived health and quiet future warnings', () => {
    const snapshot = policies(); const state = inventory();
    assert.deepEqual(Object.keys(ROLE_DETAILS), [...AI_ROLE_IDS]);
    assert.equal(ROLE_DETAILS['coding-agent'].name, 'Coding Agent');
    for (const id of AI_ROLE_IDS) assert.equal(roleResolution(snapshot, state, id, true).health, 'needs-configuration');
    assert.equal(roleWarning(snapshot, state), false);
    const configured = { ...snapshot, policies: snapshot.policies.map(policy => policy.roleId === 'coding-agent' ?
        { ...policy, preferred: { type: 'constraints' as const, hard: hard(), preferences: [] } } : policy) };
    assert.equal(roleResolution(configured, state, 'coding-agent', true).health, 'broken');
    assert.equal(roleWarning(configured, state), false);
    assert.equal(roleEntryLabel(undefined, state), 'Not configured');
});

test('role editor saves exact/constraint entries, fallback order and rejects stale or invalid edits safely', async () => {
    let snapshot = policies(); let fail = false;
    const service: AIRolePolicyService = { async list() { return snapshot; },
        async mutate({ expectedRevision, policy }) {
            if (fail) throw new Error('secret-provider-error');
            if (expectedRevision !== snapshot.revision) throw new Error('Stale role policy revision');
            snapshot = { ...snapshot, revision: snapshot.revision + 1,
                policies: snapshot.policies.map(item => item.roleId === policy.roleId ? policy : item) };
            return snapshot;
        } };
    const controller = new AICenterRolesController(service, () => {});
    await controller.load(); controller.select('interactive');
    controller.edit(policy => ({ ...policy, preferred: { type: 'exact',
        target: { connectionId: 'local', modelId: 'model' } }, allowFallback: true,
        fallbacks: [{ type: 'exact', target: { connectionId: 'hosted', modelId: 'model' } },
            { type: 'constraints', hard: hard(), preferences: ['prefer-local'] }] }));
    controller.move(1, 0);
    assert.equal(controller.draft?.fallbacks[0].type, 'constraints');
    assert.equal(await controller.save(), true);
    assert.equal(snapshot.revision, 1);
    assert.equal(roleResolution(snapshot, inventory(), 'interactive', true).health, 'ready');
    controller.edit(policy => ({ ...policy, preferences: ['prefer-local'] }));
    snapshot = { ...snapshot, revision: 2 };
    await controller.load();
    assert.equal(controller.dirty, true);
    // A live refresh must not silently change the revision of an unsaved draft.
    assert.equal(await controller.save(), false);
    fail = true;
    controller.edit(policy => ({ ...policy, hard: { ...policy.hard, locality: 'local-only' } }));
    assert.equal(await controller.save(), false);
    assert.doesNotMatch(controller.message, /secret-provider-error/);
    assert.equal(controller.dirty, true);
});

test('eligibility explains capability, loaded context, locality, disabled and hosted authority', () => {
    const state = inventory();
    const snapshot = policies();
    const configured = { ...snapshot, policies: snapshot.policies.map(policy => policy.roleId === 'interactive' ?
        { ...policy, preferred: { type: 'constraints' as const, hard: hard(), preferences: [] } } : policy) };
    assert.equal(roleResolution(configured, state, 'interactive', false).excluded.find(item =>
        item.target?.connectionId === 'hosted')?.reason, 'hosted-egress-not-authorized');
    assert.match(ROLE_REASON_LABELS['hosted-egress-not-authorized'], /feature approval/);
    assert.equal(roleResolution(configured, state, 'interactive', true).health, 'ready');
    const restricted = { ...configured, policies: configured.policies.map(policy => policy.roleId === 'interactive' ?
        { ...policy, hard: { ...policy.hard, locality: 'local-only' as const,
            minimumKnownContextTokens: 8192 } } : policy) };
    assert.equal(roleResolution(restricted, state, 'interactive', true).excluded.find(item =>
        item.target?.connectionId === 'local')?.reason, 'context-too-small');
    assert.equal(roleResolution(restricted, state, 'interactive', true).excluded.find(item =>
        item.target?.connectionId === 'hosted')?.reason, 'locality');
    const capability = { ...configured, policies: configured.policies.map(policy => policy.roleId === 'interactive' ?
        { ...policy, hard: { ...policy.hard, requiredCapabilities: ['toolCalling' as const] } } : policy) };
    assert.equal(roleResolution(capability, state, 'interactive', true).excluded.find(item =>
        item.target?.connectionId === 'local')?.reason, 'capability-unsupported');
    state.registry.models[0].enabled = false;
    assert.equal(roleResolution(configured, state, 'interactive', true).excluded.find(item =>
        item.target?.connectionId === 'local')?.reason, 'disabled');
});

test('AI Center offers keyboard move controls, pointer reorder, deep link focus and theme-safe text', async () => {
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/ai-center-widget.ts', import.meta.url), 'utf8');
    const contribution = await readFile(new URL('../../packages/theia-extension/src/browser/ai-center-contribution.ts', import.meta.url), 'utf8');
    const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
    assert.match(widget, /Move Up/); assert.match(widget, /Move Down/);
    assert.match(widget, /dragstart/); assert.match(widget, /addEventListener\('drop'/);
    assert.match(widget, /focusRole\(id: AIRoleId\)/);
    assert.match(widget, /await this\.roles\.load\(\);\s*this\.content\.querySelector<HTMLElement>\('\.dope-ai-role-editor h3'\)\?\.focus\(\)/);
    assert.match(contribution, /openRole\(roleId: AIRoleId\)/);
    assert.match(contribution, /await widget\.focusRole\(roleId\)/);
    assert.match(widget, /Eligible under current policy/);
    assert.match(widget, /Available model suggestions/);
    assert.match(widget, /a preferred entry may narrow them/);
    assert.match(css, /\.dope-ai-role-entry:focus-within/);
    assert.match(css, /var\(--theia-editor-background\)/);
    assert.match(css, /var\(--theia-editor-foreground\)/);
    assert.doesNotMatch(widget, /innerHTML|\.message = .*error|\.textContent = .*error/);
});
