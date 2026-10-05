import { AI_REGISTRY_VERSION, findEligibleModels, nextAIConnectionHealth } from '@dope/ai';
import type { AIConnection, AIConnectionHealth, AIModel, AIRegistryMutationRequest, AIEligibilityQuery } from '@dope/ai';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ConnectedModel, ConversationUsage } from '@dope/contracts/lib/model-runtime';
import type { AIInventoryState, AITestConnectionResult, AIRegistryClient, AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import { AIRegistryStore } from './ai-registry-store';
import { AICredentialManager } from './ai-credential-manager';
import { ModelConnectionsRegistry } from './model-connections';
import { detectLocalRuntime, providerSetup, providerSetupDescriptions, useDetectedRuntime } from './provider-setup';
import { CodexAppServer } from './codex-app-server';

const unknown = <Value>(): { source: 'unknown'; value?: Value } => ({ source: 'unknown' });
const known = <Value>(value: Value | undefined, source: 'adapter-known' | 'provider-reported' | 'configured') =>
    value === undefined ? unknown<Value>() : { source, value };

function inventoryModel(connection: AIConnection, model: ConnectedModel): AIModel {
    const locality = providerSetup(connection).locality;
    const coldLocal = locality === 'local' && !model.capabilities.contextWindowTokens;
    return { version: AI_REGISTRY_VERSION, connectionId: connection.id, providerModelKey: model.id,
        label: model.label, locality, enabled: true, state: 'ready',
        capabilities: { conversationalText: coldLocal ? unknown<boolean>() : known(model.capabilities.conversationalText, 'adapter-known'),
            streaming: coldLocal ? unknown<boolean>() : known(model.capabilities.streaming, 'adapter-known'),
            structuredOutput: unknown(), toolCalling: unknown(), agentExecution: unknown() },
        limits: { contextWindowTokens: locality === 'local' ? unknown() :
            known(model.capabilities.contextWindowTokens, 'adapter-known'),
            maxInputTokens: known(model.capabilities.maxInputTokens, 'adapter-known'),
            maxOutputTokens: known(model.capabilities.maxOutputTokens, 'adapter-known') } };
}

export class AIInventoryController {
    private readonly health = new Map<string, AIConnectionHealth>();
    private readonly tested = new Map<string, AITestConnectionResult>();
    private readonly loadedLocalModels = new Map<string, number>();
    private readonly fingerprints = new Map<string, string>();
    private readonly inFlight = new Set<string>();
    private readonly changes = new Map<string, number>();
    private readonly credentialChanges = new Map<string, number>();
    private readonly listeners = new Set<() => void>();
    private readonly unlisten: (() => void)[];

    constructor(private readonly store: AIRegistryStore, private readonly runtimes: ModelConnectionsRegistry,
        private readonly credentials: AICredentialManager, private readonly codex?: CodexAppServer) {
        this.unlisten = [store.onChange(snapshot => {
            for (const connection of snapshot.connections) {
                const fingerprint = JSON.stringify([connection.config, connection.lifecycle,
                    connection.credential, connection.codexAccount, connection.preferredModelId]);
                if (this.fingerprints.has(connection.id) && this.fingerprints.get(connection.id) !== fingerprint) {
                    this.health.delete(connection.id);
                    this.clearLoaded(connection.id);
                    if (connection.config.type === 'codex') this.codex?.disconnect(connection.id);
                }
                this.changes.set(connection.id, (this.changes.get(connection.id) ?? 0) + 1);
                this.fingerprints.set(connection.id, fingerprint);
            }
            for (const id of this.fingerprints.keys()) if (!snapshot.connections.some(connection => connection.id === id)) {
                this.fingerprints.delete(id); this.health.delete(id); this.clearLoaded(id);
                this.codex?.disconnect(id);
            }
            this.tested.clear();
            this.changed();
        }), credentials.onChange(id => {
            this.health.delete(id); this.tested.delete(id); this.clearLoaded(id);
            this.changes.set(id, (this.changes.get(id) ?? 0) + 1);
            this.credentialChanges.set(id, (this.credentialChanges.get(id) ?? 0) + 1);
            this.changed();
        }), runtimes.onChange(() => this.changed()), runtimes.onExecutionFailure((id, error) => {
            if (error instanceof ModelRuntimeFailure && error.failureClass === 'authentication') {
                this.health.set(id, 'needs-authentication'); this.tested.delete(id);
                this.changed();
            }
        })];
    }
    dispose(): void { this.unlisten.forEach(unlisten => unlisten()); }
    onChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private changed(): void {
        for (const listener of this.listeners) { try { listener(); } catch {} }
    }
    private clearLoaded(id: string): void {
        for (const key of this.loadedLocalModels.keys()) if (JSON.parse(key)[0] === id) this.loadedLocalModels.delete(key);
    }
    private async connection(id: string): Promise<AIConnection> {
        const connection = (await this.store.read()).connections.find(item => item.id === id);
        if (!connection) throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        return connection;
    }
    async testConnectionDisclosure(id: string): Promise<{ hostedCostPossible: boolean }> {
        return { hostedCostPossible: providerSetup(await this.connection(id)).locality === 'hosted' };
    }
    async inventory(): Promise<AIInventoryState> {
        const registry = await this.store.read();
        const live = await this.runtimes.list();
        const health = (connection: AIConnection): AIConnectionHealth => {
            if (connection.lifecycle === 'disabled') return 'disabled';
            const state = this.health.get(connection.id) ?? 'unknown';
            return state === 'ready' && connection.config.type !== 'codex' &&
                !live.connections.find(item => item.id === connection.id)?.ready ? 'unknown' : state;
        };
        return { registry: { ...registry, models: registry.models.map(model => {
            const connection = registry.connections.find(item => item.id === model.connectionId)!;
            const state = !model.enabled || connection.lifecycle === 'disabled' ? 'disabled' :
                model.state === 'unavailable' ? 'unavailable' :
                    health(connection) === 'ready' ? 'ready' : 'unknown';
            return { ...model, state };
        }) }, observations: registry.connections.map(connection => ({ connectionId: connection.id,
            health: health(connection) })),
            loadedLocalModels: this.loadedLocalModelsSnapshot(), tests: [...this.tested.values()] };
    }
    loadedLocalModelsSnapshot(): { connectionId: string; providerModelKey: string; contextWindowTokens: number }[] {
        return [...this.loadedLocalModels].map(([key, contextWindowTokens]) => {
            const [connectionId, providerModelKey] = JSON.parse(key) as [string, string];
            return { connectionId, providerModelKey, contextWindowTokens };
        });
    }
    private failure(error: unknown): AIConnectionHealth {
        if (error instanceof ModelRuntimeFailure) {
            if (error.failureClass === 'authentication') return 'needs-authentication';
            if (error.failureClass === 'transient-transport' || error.failureClass === 'transient-upstream' ||
                error.failureClass === 'nonretryable-provider') return 'degraded';
            if (error.failureClass === 'connection-unavailable') return 'unavailable';
            if (error.failureClass === 'cancelled') return 'unknown';
        }
        return 'unavailable';
    }
    async refreshModels(id: string, reconnect = false): Promise<AIInventoryState> {
        if (this.inFlight.has(id)) throw new Error('Connection check already in progress');
        const connection = await this.connection(id);
        if (connection.lifecycle === 'disabled') throw new ModelRuntimeFailure('Connection disabled', 'connection-unavailable');
        this.inFlight.add(id);
        this.health.set(id, 'checking'); this.tested.delete(id); this.clearLoaded(id); this.changed();
        const startingCredentialGeneration = this.credentialChanges.get(id);
        try {
            try { providerSetup(connection); }
            catch { this.health.set(id, 'invalid-configuration'); throw new Error('Invalid connection configuration'); }
            if (connection.config.type === 'codex') {
                if (!connection.codexAccount?.accountId || connection.codexAccount.status !== 'signed-in' ||
                    connection.codexAccount.planUsage !== 'available')
                    throw new ModelRuntimeFailure('ChatGPT account needs authorization', 'authentication');
                if (!this.codex) throw new ModelRuntimeFailure('Codex runtime unavailable', 'connection-unavailable');
                await this.codex.resolveExecutable();
                const models = await this.codex.models(id, connection.codexAccount.accountId);
                const current = await this.connection(id);
                if (JSON.stringify(current) !== JSON.stringify(connection))
                    throw new ModelRuntimeFailure('Connection changed during discovery', 'connection-unavailable');
                const snapshot = await this.store.read();
                await this.store.mutate({ version: AI_REGISTRY_VERSION, expectedRevision: snapshot.revision,
                    mutation: { type: 'reconcile-models', connectionId: id, models: models.map(model => ({
                        version: AI_REGISTRY_VERSION, connectionId: id, providerModelKey: model.id, label: model.label,
                        locality: 'hosted' as const, enabled: true, state: 'ready' as const,
                        capabilities: { conversationalText: unknown(), streaming: unknown(), structuredOutput: unknown(),
                            toolCalling: unknown(), agentExecution: known(true, 'adapter-known') },
                        limits: { contextWindowTokens: unknown(), maxInputTokens: unknown(), maxOutputTokens: unknown() }
                    })) } });
                this.health.set(id, models.length ? 'unknown' : 'degraded'); this.changed();
                return this.inventory();
            }
            if (providerSetup(connection).credential === 'required' || connection.credential) {
                const status = await this.credentials.status(id);
                if (!status.effectiveSource) {
                    this.health.set(id, 'needs-authentication');
                    throw new ModelRuntimeFailure('Connection needs a credential', 'authentication');
                }
            }
            const live = await this.runtimes.list();
            if (reconnect || !live.connections.find(item => item.id === id)?.ready) await this.runtimes.activate(id);
            else await this.runtimes.refresh(id);
            const discovered = (await this.runtimes.list()).connections.find(item => item.id === id)?.models ?? [];
            const current = await this.connection(id);
            if (startingCredentialGeneration !== this.credentialChanges.get(id))
                throw new ModelRuntimeFailure('Connection changed during discovery', 'connection-unavailable');
            if (JSON.stringify([current.config, current.credential, current.lifecycle, current.preferredModelId]) !==
                JSON.stringify([connection.config, connection.credential, connection.lifecycle, connection.preferredModelId]))
                throw new ModelRuntimeFailure('Connection changed during discovery', 'connection-unavailable');
            let updated = false;
            for (let attempt = 0; attempt < 3 && !updated; attempt++) {
                const snapshot = await this.store.read();
                if (startingCredentialGeneration !== this.credentialChanges.get(id))
                    throw new ModelRuntimeFailure('Connection changed during discovery', 'connection-unavailable');
                if (JSON.stringify(snapshot.connections.find(item => item.id === id)) !== JSON.stringify(current))
                    throw new ModelRuntimeFailure('Connection changed during discovery', 'connection-unavailable');
                try {
                    await this.store.mutate({ version: AI_REGISTRY_VERSION, expectedRevision: snapshot.revision,
                        mutation: { type: 'reconcile-models', connectionId: id,
                            models: discovered.map(model => inventoryModel(connection, model)) } });
                    updated = true;
                } catch (error) { if (!(error instanceof Error) || !error.message.includes('Stale AI registry revision') || attempt === 2) throw error; }
            }
            if (connection.config.type === 'local') for (const model of discovered) {
                const context = model.capabilities.contextWindowTokens;
                if (model.capabilities.conversationalText && context && Number.isSafeInteger(context) && context > 0)
                    this.loadedLocalModels.set(JSON.stringify([id, model.id]), context);
            }
            this.health.set(id, discovered.length ? 'ready' : 'degraded'); this.changed();
            return this.inventory();
        } catch (error) {
            if (this.health.get(id) === 'checking') this.health.set(id, this.failure(error));
            this.changed();
            throw error;
        } finally { this.inFlight.delete(id); }
    }
    async testConnection(id: string): Promise<AITestConnectionResult> {
        await this.refreshModels(id);
        const connection = await this.connection(id);
        if (connection.config.type === 'codex') {
            const model = (await this.store.read()).models.find(item => item.connectionId === id && item.enabled &&
                item.state !== 'unavailable' &&
                item.providerModelKey === connection.preferredModelId) ??
                (await this.store.read()).models.find(item => item.connectionId === id && item.enabled && item.state !== 'unavailable');
            if (!model || !connection.codexAccount?.accountId || !this.codex)
                throw new ModelRuntimeFailure('No usable Codex model', 'model-unavailable');
            const generation = this.changes.get(id);
            const start = performance.now();
            try {
                await this.codex.test(id, connection.codexAccount.accountId, model.providerModelKey);
                if (generation !== this.changes.get(id))
                    throw new ModelRuntimeFailure('Connection changed during test', 'connection-unavailable');
                const result = { connectionId: id, modelId: model.providerModelKey,
                    latencyMs: Math.round(performance.now() - start), hostedCostPossible: true };
                this.tested.set(id, result); this.health.set(id, 'ready'); this.changed();
                return result;
            } catch (error) {
                this.tested.delete(id); this.health.set(id, this.failure(error)); this.changed();
                throw error;
            }
        }
        const inventory = await this.inventory();
        const live = (await this.runtimes.list()).connections.find(item => item.id === id);
        const usable = live?.models.filter(model => model.usable &&
            inventory.registry.models.some(record => record.connectionId === id && record.providerModelKey === model.id && record.enabled));
        const model = usable?.find(item => item.id === connection.preferredModelId) ?? usable?.[0];
        if (!model) throw new ModelRuntimeFailure('No usable model for connection test', 'model-unavailable');
        const start = performance.now();
        const generation = this.changes.get(id);
        let usage: ConversationUsage | undefined;
        try {
            const signal = AbortSignal.timeout(15_000);
            for await (const event of this.runtimes.generate({ connectionId: id, modelId: model.id },
                { messages: [{ role: 'user', content: 'Reply with OK.' }], maxOutputTokens: 64, signal })) {
                if (event.type === 'complete' && event.text.trim()) usage = event.usage;
            }
            if (!usage) throw new ModelRuntimeFailure('Incomplete connection test', 'invalid-json');
            if (generation !== this.changes.get(id))
                throw new ModelRuntimeFailure('Connection changed during test', 'connection-unavailable');
            const result = { connectionId: id, modelId: model.id, latencyMs: Math.round(performance.now() - start),
                usage, hostedCostPossible: providerSetup(connection).locality === 'hosted' };
            this.tested.set(id, result);
            this.health.set(id, 'ready'); this.changed();
            return result;
        } catch (error) {
            this.tested.delete(id);
            const next = this.failure(error);
            if (next === 'needs-authentication' || next === 'invalid-configuration') this.health.set(id, next);
            else this.health.set(id, nextAIConnectionHealth(this.health.get(id) ?? 'unknown', connection.lifecycle,
                'transient-request-failure'));
            this.changed();
            throw error;
        }
    }
    async findEligibleModels(query: AIEligibilityQuery) {
        const inventory = await this.inventory();
        const loadedLocalModels = this.loadedLocalModelsSnapshot();
        return findEligibleModels(inventory.registry, { ...query, loadedLocalModels }, inventory.observations);
    }
}

export class AIRegistryBackend implements AIRegistryService {
    private readonly unlisten: (() => void)[];
    constructor(private readonly store: AIRegistryStore, client: AIRegistryClient,
        private readonly detect: typeof detectLocalRuntime = detectLocalRuntime,
        private readonly inventoryController?: AIInventoryController) {
        this.unlisten = [store.onChange(snapshot => client.notifyAIRegistryChanged(snapshot.revision))];
        if (inventoryController && client.notifyAIInventoryChanged)
            this.unlisten.push(inventoryController.onChange(() => client.notifyAIInventoryChanged?.()));
    }
    list() { return this.store.read(); }
    async mutate(request: AIRegistryMutationRequest) {
        const before = await this.store.read();
        const result = await this.store.mutate(request);
        const mutation = request.mutation;
        const id = mutation.type === 'create-connection' ? mutation.connection.id :
            mutation.type === 'update-connection' ? mutation.id : undefined;
        if (id && this.inventoryController) {
            const previous = before.connections.find(connection => connection.id === id);
            const current = result.connections.find(connection => connection.id === id);
            if (current?.lifecycle === 'enabled' && (!previous ||
                JSON.stringify([previous.config, previous.credential, previous.lifecycle]) !==
                JSON.stringify([current.config, current.credential, current.lifecycle])))
                void this.inventoryController.refreshModels(id, true).catch(() => {});
        }
        return result;
    }
    async providerSetups() { return providerSetupDescriptions(); }
    detectLocalRuntime() { return this.detect(); }
    async useDetectedRuntime(connectionId: string, expectedRevision: number) {
        const config = await this.detect();
        if (!config) throw new Error('No known Local runtime detected');
        const connection = (await this.store.read()).connections.find(item => item.id === connectionId);
        if (!connection || connection.config.type !== 'local') throw new Error('Local connection missing');
        const updated = useDetectedRuntime(connection, config);
        const result = await this.store.mutate({ version: updated.version, expectedRevision,
            mutation: { type: 'update-connection', id: connectionId, changes: {
                alias: updated.alias, lifecycle: updated.lifecycle, config: updated.config } } });
        if (this.inventoryController && connection.lifecycle === 'enabled' &&
            JSON.stringify(connection.config) !== JSON.stringify(updated.config))
            void this.inventoryController.refreshModels(connectionId, true).catch(() => {});
        return result;
    }
    async findEligibleModels(query: Parameters<typeof findEligibleModels>[1]) {
        return this.inventoryController ? this.inventoryController.findEligibleModels(query) :
            findEligibleModels(await this.store.read(), { ...query, loadedLocalModels: [] });
    }
    inventory() { if (!this.inventoryController) throw new Error('AI inventory unavailable'); return this.inventoryController.inventory(); }
    refreshModels(id: string) { if (!this.inventoryController) throw new Error('AI inventory unavailable'); return this.inventoryController.refreshModels(id); }
    reconnect(id: string) { if (!this.inventoryController) throw new Error('AI inventory unavailable'); return this.inventoryController.refreshModels(id, true); }
    testConnection(id: string) { if (!this.inventoryController) throw new Error('AI inventory unavailable'); return this.inventoryController.testConnection(id); }
    testConnectionDisclosure(id: string) { if (!this.inventoryController) throw new Error('AI inventory unavailable'); return this.inventoryController.testConnectionDisclosure(id); }
    dispose(): void { this.unlisten.forEach(unlisten => unlisten()); }
}
