import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { AIConnection, AIModel, AIRegistrySnapshot } from '../../packages/ai/src/index.ts';
import type { AIRegistryService, AIInventoryState } from '../../packages/contracts/src/ai-registry-service.ts';
import type { AICredentialService } from '../../packages/contracts/src/ai-credential-service.ts';
import { AICenterController, connectionWarning, usableModelSummary } from '../../packages/theia-extension/lib/browser/ai-center-controller.js';

const connection = (id: string): AIConnection => ({ version: 1, id, alias: id, lifecycle: 'enabled',
    config: { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234/v1' } });
const model: AIModel = { version: 1, connectionId: 'desk', providerModelKey: 'tiny', label: 'Tiny', locality: 'local',
    enabled: true, state: 'ready', capabilities: {
        conversationalText: { source: 'adapter-known', value: true }, streaming: { source: 'adapter-known', value: true },
        structuredOutput: { source: 'unknown' }, toolCalling: { source: 'unknown' }
    }, limits: { contextWindowTokens: { source: 'unknown' }, maxInputTokens: { source: 'unknown' },
        maxOutputTokens: { source: 'unknown' } } };

function fixture() {
    let snapshot: AIRegistrySnapshot = { version: 1, revision: 0, connections: [], models: [] };
    let observations: AIInventoryState['observations'] = [];
    let fail = false;
    const calls: string[] = [];
    const inventory = (): AIInventoryState => ({ registry: snapshot, observations, tests: [] });
    const registry: AIRegistryService = {
        async list() { return snapshot; }, async inventory() { return inventory(); },
        async providerSetups() { return [{ type: 'local', fields: ['runtime', 'endpoint'], locality: 'local',
            credential: 'optional', credentialSources: ['environment', 'session', 'secure'], modelSource: 'discovered' }]; },
        async findEligibleModels() { return { models: snapshot.models.filter(item => item.enabled && item.state === 'ready') }; },
        async mutate({ expectedRevision, mutation }) {
            assert.equal(expectedRevision, snapshot.revision);
            calls.push(mutation.type);
            if (fail) throw new Error('secret-provider-error');
            const connections = mutation.type === 'create-connection' ? [...snapshot.connections, mutation.connection] :
                mutation.type === 'remove-connection' ? snapshot.connections.filter(item => item.id !== mutation.id) :
                    mutation.type === 'update-connection' ? snapshot.connections.map(item => item.id === mutation.id ?
                        { ...item, ...mutation.changes } : item) : snapshot.connections;
            const models = mutation.type === 'set-model-enabled' ? snapshot.models.map(item =>
                item.connectionId === mutation.connectionId && item.providerModelKey === mutation.providerModelKey ?
                    { ...item, enabled: mutation.enabled } : item) :
                mutation.type === 'remove-connection' ? snapshot.models.filter(item => item.connectionId !== mutation.id) : snapshot.models;
            snapshot = { ...snapshot, revision: snapshot.revision + 1, connections, models };
            return snapshot;
        },
        async refreshModels() { calls.push('refresh'); return inventory(); },
        async reconnect() { calls.push('reconnect'); return inventory(); },
        async testConnection() { calls.push('test'); return { connectionId: 'desk', modelId: 'tiny', latencyMs: 10, hostedCostPossible: false }; },
        async testConnectionDisclosure() { return { hostedCostPossible: false }; },
        async detectLocalRuntime() { return connection('desk').config; },
        async useDetectedRuntime() { return snapshot; }
    };
    const credentials: AICredentialService = {
        async status(id) { return { connectionId: id, effectiveSource: 'session', sources: [
            { source: 'session', status: 'available' }, { source: 'secure', status: 'missing' }] }; },
        async replace(_id, source) { calls.push(`credential:${source}`); return this.status(_id); },
        async remove(_id, source) { calls.push(`remove:${source}`); return this.status(_id); }
    };
    const controller = new AICenterController(registry, credentials, () => {});
    return { controller, calls, connection, model, setModels: (models: AIModel[]) => { snapshot = { ...snapshot, models }; },
        setHealth: (health: AIInventoryState['observations']) => { observations = health; },
        inventory, fail: () => { fail = true; } };
}

test('global AI Center supports empty state, add/edit, model state, checks, disable, and removal', async () => {
    const fixtureState = fixture();
    const { controller, calls } = fixtureState;
    await controller.load();
    assert.equal(controller.state?.registry.connections.length, 0);
    assert.equal(controller.selectedId, undefined);
    assert.equal(await controller.save(connection('desk'), true, 'not persisted', 'session'), true);
    assert.equal(controller.selectedId, 'desk');
    assert.equal(controller.credential?.effectiveSource, 'session');
    fixtureState.setModels([model]);
    await controller.load();
    assert.equal(usableModelSummary(controller.usableModels, connection('desk')), '1 usable model');
    assert.equal(await controller.toggleModel('desk', 'tiny', false), true);
    assert.equal(controller.state?.registry.models[0].enabled, false);
    assert.equal(await controller.check('desk', 'refresh'), true);
    assert.equal(await controller.check('desk', 'reconnect'), true);
    assert.equal(await controller.check('desk', 'test'), true);
    assert.equal(await controller.save({ ...connection('desk'), alias: 'Updated', lifecycle: 'disabled' }, false), true);
    assert.equal(controller.state?.registry.connections[0].alias, 'Updated');
    assert.equal(controller.state?.registry.connections[0].lifecycle, 'disabled');
    assert.equal(await controller.remove('desk'), true);
    assert.equal(controller.state?.registry.connections.length, 0);
    assert.deepEqual(calls, ['create-connection', 'credential:session', 'set-model-enabled', 'refresh', 'reconnect',
        'test', 'update-connection', 'remove:session', 'remove-connection']);
});

test('warnings only indicate actionable connection faults; errors do not disclose provider details', async () => {
    const fixtureState = fixture();
    const { controller } = fixtureState;
    await controller.load();
    assert.equal(connectionWarning(fixtureState.inventory()), false);
    await controller.save(connection('desk'), true);
    for (const health of ['unknown', 'checking', 'ready', 'disabled'] as const) {
        fixtureState.setHealth([{ connectionId: 'desk', health }]);
        assert.equal(connectionWarning(fixtureState.inventory()), false, health);
    }
    for (const health of ['needs-authentication', 'invalid-configuration', 'unavailable', 'degraded'] as const) {
        fixtureState.setHealth([{ connectionId: 'desk', health }]);
        assert.equal(connectionWarning(fixtureState.inventory()), true, health);
    }
    await controller.save({ ...connection('desk'), lifecycle: 'disabled' }, false);
    assert.equal(connectionWarning(fixtureState.inventory()), false);
    fixtureState.fail();
    assert.equal(await controller.toggleModel('desk', 'tiny', false), false);
    assert.doesNotMatch(controller.message, /secret-provider-error/);
});

test('workbench integration uses a singleton main tab, supported account replacement and Settings route', async () => {
    const module = await readFile(new URL('../../packages/theia-extension/src/browser/frontend-module.ts', import.meta.url), 'utf8');
    const contribution = await readFile(new URL('../../packages/theia-extension/src/browser/ai-center-contribution.ts', import.meta.url), 'utf8');
    const widget = await readFile(new URL('../../packages/theia-extension/src/browser/ai-center-widget.ts', import.meta.url), 'utf8');
    const launcher = await readFile(new URL('../../packages/theia-extension/src/browser/ai-center-launcher.ts', import.meta.url), 'utf8');
    const css = await readFile(new URL('../../packages/theia-extension/src/browser/dope.css', import.meta.url), 'utf8');
    assert.match(module, /bind\(WidgetFactory\).*id: AI_CENTER_ID/);
    assert.match(contribution, /getOrCreateWidget<AICenterWidget>\(AI_CENTER_ID\)/);
    assert.match(contribution, /if \(!widget\.isAttached\) await this\.shell\.addWidget\(widget, \{ area: 'main' \}\)/);
    assert.match(contribution, /await this\.shell\.activateWidget\(widget\.id\)/);
    assert.match(contribution, /removeBottomMenu\('accounts-menu'\)/);
    assert.match(contribution, /linkCompoundMenuNode\(\{ newParentPath: MANAGE_MENU, submenuPath: ACCOUNTS_MENU/);
    assert.match(module, /rebind\(SidebarBottomMenuWidget\)\.to\(AICenterBottomMenuWidget\)/);
    assert.match(launcher, /extends SidebarBottomMenuWidget/);
    assert.match(launcher, /executeCommand\(AI_CENTER_COMMAND\)/);
    assert.match(launcher, /React\.createElement\('button'/);
    assert.match(launcher, /item\.badge \? React\.createElement\('span'.*!/);
    assert.doesNotMatch(`${widget}\n${contribution}`, /WorkspaceService/);
    assert.match(widget, /setAttribute\('aria-current'/);
    assert.match(widget, /setAttribute\('aria-expanded'/);
    assert.match(widget, /setAttribute\('aria-live', 'polite'\)/);
    assert.match(widget, /input\.type = secret \? 'password'/);
    assert.doesNotMatch(widget, /innerHTML/);
    assert.match(widget, /safeEndpoint\(connection\.config\.endpoint\)/);
    assert.match(css, /\.dope-ai-center :is\(button, input, select\):focus-visible/);
    assert.match(css, /var\(--theia-editor-background\)/);
});
