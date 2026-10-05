import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { AIConnection, AIModel, AIRegistrySnapshot } from '../../packages/ai/src/index.ts';
import type { AIRegistryService, AIInventoryState } from '../../packages/contracts/src/ai-registry-service.ts';
import type { AICredentialService } from '../../packages/contracts/src/ai-credential-service.ts';
import type { CodexAuthService, CodexAccountStatus } from '../../packages/contracts/src/codex-auth-service.ts';
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
                mutation.type === 'reconcile-models' ? [...snapshot.models.filter(item => item.connectionId !== mutation.connectionId),
                    ...mutation.models] :
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
    return { controller, registry, credentials, calls, connection, model, setModels: (models: AIModel[]) => { snapshot = { ...snapshot, models }; },
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

test('Codex account actions preserve separate connections and do not use API-key credentials', async () => {
    const fixtureState = fixture();
    const { controller, calls } = fixtureState;
    const profiles = new Map<string, CodexAccountStatus[]>();
    const authCalls: string[] = [];
    const auth: CodexAuthService = {
        async list(id) { return profiles.get(id) ?? []; },
        async signIn(id, accountId) { authCalls.push(`signIn:${id}:${accountId ?? 'new'}`); },
        async signOut(id, accountId) {
            authCalls.push(`signOut:${id}:${accountId}`);
            profiles.set(id, (profiles.get(id) ?? []).map(item => item.id === accountId ?
                { ...item, status: 'signed-out', planUsage: 'unavailable' } : item));
            return { revocationConfirmed: true };
        },
        async disconnect(id, accountId) { authCalls.push(`disconnect:${id}:${accountId}`); return { revocationConfirmed: true }; }
    };
    const codex = new AICenterController(fixtureState.registry, fixtureState.credentials, () => {}, auth);
    await codex.load();
    const first: AIConnection = { version: 1, id: 'one', alias: 'Work', lifecycle: 'enabled',
        config: { type: 'codex', runtime: 'app-server' } };
    const second: AIConnection = { ...first, id: 'two', alias: 'Personal' };
    assert.equal(await codex.save(first, true), true);
    assert.equal(await codex.save(second, true), true);
    await codex.select('one');
    assert.equal(await codex.refreshAccounts('one'), true);
    assert.match(codex.message, /No completed ChatGPT sign-in yet/);
    profiles.set('one', [{ id: 'registration-one', connectionId: 'one', label: 'work@example.test', clientId: 'client-one',
        status: 'signed-in', planUsage: 'available' },
    { id: 'registration-alt', connectionId: 'one', label: 'other@example.test', clientId: 'client-alt',
        status: 'signed-in', planUsage: 'available' }]);
    profiles.set('two', [{ id: 'registration-two', connectionId: 'two', label: 'personal@example.test', clientId: 'client-two',
        status: 'signed-in', planUsage: 'available' }]);
    await codex.select('one');
    assert.equal(await codex.signIn('one'), true);
    assert.match(codex.message, /Complete sign-in in your browser/);
    assert.equal(await codex.refreshAccounts('one'), true);
    assert.equal(codex.state?.registry.connections.find(item => item.id === 'one')?.codexAccount?.accountLabel, 'work@example.test');
    assert.match(codex.message, /account authorized/);
    fixtureState.setModels([{ ...model, connectionId: 'one', locality: 'hosted' }]);
    await codex.load();
    assert.equal(await codex.selectAccount(codex.state!.registry.connections.find(item => item.id === 'one')!, codex.accounts[1]), true);
    assert.equal(codex.state?.registry.connections.find(item => item.id === 'one')?.codexAccount?.accountLabel, 'other@example.test');
    assert.equal(codex.state?.registry.models.some(item => item.connectionId === 'one'), false);
    await codex.select('two');
    assert.equal(await codex.refreshAccounts('two'), true);
    assert.equal(codex.state?.registry.connections.find(item => item.id === 'two')?.codexAccount?.accountLabel, 'personal@example.test');
    assert.equal(await codex.signIn('two', 'registration-two'), true);
    assert.equal(await codex.signOut(codex.state!.registry.connections.find(item => item.id === 'two')!, codex.accounts[0]), true);
    assert.equal(codex.state?.registry.connections.find(item => item.id === 'two')?.codexAccount?.status, 'signed-out');
    assert.equal(codex.state?.registry.connections.find(item => item.id === 'one')?.codexAccount?.status, 'signed-in');
    assert.equal(await codex.remove('two'), true);
    assert.deepEqual(authCalls, ['signIn:one:new', 'signIn:two:registration-two', 'signOut:two:registration-two',
        'disconnect:two:registration-two']);
    assert.equal(calls.some(item => item.startsWith('credential:') || item.startsWith('remove:')), false);
});

test('Codex auth errors remain safe, and account selection cannot cross connections', async () => {
    const fixtureState = fixture();
    const codex = new AICenterController(fixtureState.registry, fixtureState.credentials, () => {}, {
            async list() { return []; }, async signIn() { throw new Error('secret authorization URL'); },
            async signOut() { throw new Error('secret token'); }, async disconnect() { throw new Error('secret token'); }
        });
    await codex.load();
    const connection: AIConnection = { version: 1, id: 'one', alias: 'Work', lifecycle: 'enabled',
        config: { type: 'codex', runtime: 'app-server' } };
    await codex.save(connection, true);
    assert.equal(await codex.signIn('one'), false);
    assert.doesNotMatch(codex.message, /secret|URL|token/);
    assert.equal(await codex.selectAccount(connection, { id: 'wrong', connectionId: 'other', label: 'Other',
        clientId: 'other', status: 'signed-in', planUsage: 'available' }), false);
    assert.equal(codex.state?.registry.connections[0].codexAccount, undefined);
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
    assert.match(contribution, /void this\.shell\.revealWidget\(chatPanelId\)/);
    assert.doesNotMatch(contribution, /tryGetWidget\(chatPanelId\)/);
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
    assert.match(widget, /setup\.credential === 'optional'/);
    assert.match(widget, /option = element\('option', 'none'\); option\.value = ''/);
    assert.match(widget, /setup\.credential === 'optional' \? '' : setup\.environmentVariable \? 'environment' : 'session'/);
    assert.match(widget, /option\.selected = source === defaultSource/);
    assert.match(widget, /hidden = !credentialSelect\.value \|\| credentialSelect\.value === 'environment'/);
    assert.doesNotMatch(widget, /innerHTML/);
    assert.match(widget, /safeEndpoint\(connection\.config\.endpoint\)/);
    assert.match(widget, /Codex \/ Agent Runtime · ChatGPT plan/);
    assert.match(widget, /Continue with ChatGPT/);
    assert.match(widget, /Reauthorize/);
    assert.match(widget, /Sign out/);
    assert.match(widget, /Refresh account status/);
    assert.match(widget, /zero project data.*tiny amount of ChatGPT plan usage/);
    assert.match(widget, /https:\/\/chatgpt\.com\/settings\/usage/);
    assert.match(widget, /Agent Runtime \(not general Chat\)/);
    assert.match(widget, /registered\.label/);
    assert.match(widget, /registered\.id === account\?\.accountId/);
    assert.match(widget, /setAttribute\('role', 'status'\)/);
    assert.match(widget, /option\.disabled = !!existing && \(setup\.type === 'codex'\)/);
    assert.match(module, /codexAuthServicePath/);
    assert.doesNotMatch(widget, /(?:accessToken|refreshToken|idToken|authorizationUrl|innerHTML)/);
    assert.match(css, /\.dope-ai-center :is\(button, input, select\):focus-visible/);
    assert.match(css, /var\(--theia-editor-background\)/);
});
