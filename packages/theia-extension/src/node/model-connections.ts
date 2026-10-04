import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ConnectedModel, ConversationEvent, ConversationRequest, ConversationalModelRuntime,
    ModelSelection } from '@dope/contracts/lib/model-runtime';
import type { ModelConnectionMetadata, ModelConnectionsClient, ModelConnectionsService,
    ModelConnectionsSnapshot } from '@dope/contracts/lib/model-connections-service';
import { AI_REGISTRY_VERSION } from '@dope/ai';
import type { AIRegistryMutation, AIRegistrySnapshot } from '@dope/ai';
import { AIRegistryStore } from './ai-registry-store';
import type { AICredentialManager } from './ai-credential-manager';
import { providerSetup, providerSetupAdapters } from './provider-setup';

export interface ModelConnectionStore {
    read(): Promise<ModelConnectionMetadata[]>;
    write(connections: readonly ModelConnectionMetadata[]): Promise<void>;
}

function metadata(value: ModelConnectionMetadata): ModelConnectionMetadata {
    if (!value || typeof value.id !== 'string' || !value.id.trim() ||
        typeof value.providerId !== 'string' || !value.providerId.trim() ||
        typeof value.label !== 'string' || !value.label.trim() ||
        (value.preferredModelId !== undefined &&
            (typeof value.preferredModelId !== 'string' || !value.preferredModelId.trim())))
        throw new Error('Invalid model connection metadata');
    // Explicit projection: unknown fields, including secrets or endpoints, never reach disk.
    return { id: value.id, providerId: value.providerId, label: value.label,
        ...(value.preferredModelId === undefined ? {} : { preferredModelId: value.preferredModelId }) };
}

export class FileModelConnectionStore implements ModelConnectionStore {
    readonly path: string;
    constructor(path = join(process.env.XDG_CONFIG_HOME && isAbsolute(process.env.XDG_CONFIG_HOME) ?
        process.env.XDG_CONFIG_HOME : join(homedir(), '.config'), 'dope', 'model-connections.json')) {
        this.path = path;
    }
    async read(): Promise<ModelConnectionMetadata[]> {
        let contents: string;
        try { contents = await readFile(this.path, 'utf8'); }
        catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []; throw error; }
        const value: unknown = JSON.parse(contents);
        if (!value || typeof value !== 'object' || (value as { version?: unknown }).version !== 1 ||
            !Array.isArray((value as { connections?: unknown }).connections)) throw new Error('Invalid model connections file');
        const entries = (value as { connections: ModelConnectionMetadata[] }).connections.map(metadata);
        if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Duplicate model connection ID');
        return entries;
    }
    async write(connections: readonly ModelConnectionMetadata[]): Promise<void> {
        const folder = dirname(this.path);
        await mkdir(folder, { recursive: true, mode: 0o700 });
        const temporary = `${this.path}.${randomUUID()}.tmp`;
        await writeFile(temporary, JSON.stringify({ version: 1, connections: connections.map(metadata) }), { mode: 0o600 });
        await rename(temporary, this.path);
    }
}

type Live = { runtime: ConversationalModelRuntime; generation: number; ready: boolean; models: ConnectedModel[] };

/** Application inventory; Chat history and Software Map synthesis never own its state. */
export class ModelConnectionsRegistry implements ModelConnectionsService {
    private readonly connections = new Map<string, ModelConnectionMetadata>();
    private readonly credentials = new Map<string, string>();
    private readonly live = new Map<string, Live>();
    private readonly globalConfiguration = new Map<string, string>();
    private readonly listeners = new Set<() => void>();
    private readonly executionListeners = new Set<(connectionId: string, error: unknown) => void>();
    private readonly loaded: Promise<void>;
    private readonly store: ModelConnectionStore;
    private saving: Promise<void> = Promise.resolve();
    private revision = 0;

    constructor(store?: ModelConnectionStore,
        private readonly globalStore: AIRegistryStore | undefined = store ? undefined : new AIRegistryStore(),
        private readonly credentialManager?: AICredentialManager) {
        this.store = store ?? new FileModelConnectionStore();
        credentialManager?.onChange(id => this.disconnect(id));
        if (globalStore) {
            globalStore.onChange(snapshot => { this.absorb(snapshot); this.changed(); });
            this.loaded = globalStore.read().then(snapshot => this.absorb(snapshot));
        } else this.loaded = this.store.read().then(entries => { for (const entry of entries) this.connections.set(entry.id, metadata(entry)); });
    }
    private absorb(snapshot: AIRegistrySnapshot): void {
        this.revision = snapshot.revision;
        const incoming = new Set(snapshot.connections.map(connection => connection.id));
        for (const id of this.connections.keys()) if (!incoming.has(id)) {
            this.connections.delete(id); this.live.delete(id); this.credentials.delete(id);
            this.globalConfiguration.delete(id);
        }
        for (const connection of snapshot.connections) {
            const entry = { id: connection.id, providerId: connection.config.type, label: connection.alias,
                ...(connection.preferredModelId ? { preferredModelId: connection.preferredModelId } : {}) };
            const previous = this.connections.get(entry.id);
            const configuration = JSON.stringify(connection.config);
            const configChanged = this.globalConfiguration.get(entry.id) !== configuration;
            if (previous && (configChanged || previous.preferredModelId !== entry.preferredModelId ||
                connection.lifecycle === 'disabled')) {
                this.live.delete(entry.id);
                if (configChanged || connection.lifecycle === 'disabled') this.credentials.delete(entry.id);
            }
            this.globalConfiguration.set(entry.id, configuration);
            this.connections.set(entry.id, entry);
        }
    }
    private async globalMutation(mutation: AIRegistryMutation, expectedRevision?: number): Promise<ModelConnectionsSnapshot> {
        if (expectedRevision === undefined) throw new Error('Expected AI registry revision required');
        const snapshot = await this.globalStore!.mutate({ version: AI_REGISTRY_VERSION, expectedRevision, mutation });
        this.absorb(snapshot);
        this.changed();
        return this.list();
    }
    onChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    onExecutionFailure(listener: (connectionId: string, error: unknown) => void): () => void {
        this.executionListeners.add(listener);
        return () => this.executionListeners.delete(listener);
    }
    private changed(): void { for (const listener of this.listeners) listener(); }
    private async save(): Promise<void> {
        const snapshot = [...this.connections.values()];
        this.saving = this.saving.catch(() => {}).then(() => this.store.write(snapshot));
        await this.saving;
        this.changed();
    }
    async list(): Promise<ModelConnectionsSnapshot> {
        await this.loaded;
        const registry = this.globalStore ? await this.globalStore.read() : undefined;
        if (registry) this.absorb(registry);
        return { revision: this.globalStore ? this.revision : undefined, connections: [...this.connections.values()].map(entry => {
            const live = this.live.get(entry.id);
            const enabled = !registry || registry.connections.find(connection => connection.id === entry.id)?.lifecycle === 'enabled';
            return { ...entry, ready: !!live?.ready && enabled, models: live?.ready && enabled ? live.models.map(model =>
                ({ ...model, capabilities: { ...model.capabilities }, usable: model.capabilities.conversationalText &&
                    (!registry || !!registry.models.find(item => item.connectionId === entry.id &&
                        item.providerModelKey === model.id && item.enabled && item.state === 'ready')) })) : [] };
        }) };
    }
    async upsert(value: ModelConnectionMetadata, expectedRevision?: number): Promise<ModelConnectionsSnapshot> {
        await this.loaded;
        const entry = metadata(value);
        if (this.globalStore) {
            const existing = (await this.globalStore.read()).connections.find(connection => connection.id === entry.id);
            if (existing && existing.config.type !== entry.providerId)
                throw new Error('Change provider type through the AI registry configuration');
            const config = existing?.config ?? providerSetupAdapters[entry.providerId as keyof typeof providerSetupAdapters]?.defaultConfig;
            if (!config) throw new Error('Configure the provider through the AI registry');
            return this.globalMutation(existing ? { type: 'update-connection', id: entry.id,
                changes: { alias: entry.label, lifecycle: existing.lifecycle,
                    config,
                    ...(entry.preferredModelId ? { preferredModelId: entry.preferredModelId } : {}) } } :
                { type: 'create-connection', connection: { version: AI_REGISTRY_VERSION, id: entry.id,
                    alias: entry.label, lifecycle: 'enabled', config,
                    ...(entry.preferredModelId ? { preferredModelId: entry.preferredModelId } : {}) } }, expectedRevision);
        }
        const previous = this.connections.get(entry.id);
        if (previous && previous.providerId !== entry.providerId) {
            this.disconnect(entry.id);
            this.credentials.delete(entry.id);
        }
        this.connections.set(entry.id, entry);
        await this.save();
        return this.list();
    }
    async remove(connectionId: string, expectedRevision?: number): Promise<ModelConnectionsSnapshot> {
        await this.loaded;
        if (this.globalStore) return this.globalMutation({ type: 'remove-connection', id: connectionId }, expectedRevision);
        this.disconnect(connectionId);
        this.credentials.delete(connectionId);
        if (this.connections.delete(connectionId)) await this.save();
        return this.list();
    }
    async setPreferred(selection: ModelSelection, expectedRevision?: number): Promise<ModelConnectionsSnapshot> {
        await this.loaded;
        const entry = this.connections.get(selection.connectionId);
        if (!entry) throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        if (!selection.modelId?.trim()) throw new Error('Invalid model ID');
        if (this.globalStore) {
            const connection = (await this.globalStore.read()).connections.find(item => item.id === entry.id)!;
            return this.globalMutation({ type: 'update-connection', id: entry.id, changes: { alias: connection.alias,
                lifecycle: connection.lifecycle, config: connection.config, preferredModelId: selection.modelId } }, expectedRevision);
        }
        this.connections.set(entry.id, { ...entry, preferredModelId: selection.modelId });
        await this.save();
        return this.list();
    }
    async setSessionCredential(connectionId: string, credential: string | null): Promise<void> {
        await this.loaded;
        if (!this.connections.has(connectionId)) throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        if (credential !== null && (typeof credential !== 'string' || !credential.trim())) throw new Error('Invalid credential');
        if (this.credentialManager) {
            if (credential === null) await this.credentialManager.remove(connectionId, 'session');
            else await this.credentialManager.replace(connectionId, 'session', credential);
            if (credential === null) this.credentials.delete(connectionId);
            else this.credentials.set(connectionId, credential);
            this.disconnect(connectionId);
            return;
        }
        if (credential === null) this.credentials.delete(connectionId);
        else this.credentials.set(connectionId, credential);
        this.disconnect(connectionId);
    }
    /** For provider setup on the backend only; never part of the RPC inventory. */
    sessionCredential(connectionId: string): string | undefined { return this.credentials.get(connectionId); }
    async activate(connectionId: string): Promise<ModelConnectionsSnapshot> {
        await this.loaded;
        const entry = this.connections.get(connectionId);
        if (!entry) throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        if (!this.globalStore) throw new ModelRuntimeFailure('AI registry unavailable', 'connection-unavailable');
        const connection = (await this.globalStore.read()).connections.find(item => item.id === connectionId);
        if (!connection || connection.lifecycle !== 'enabled')
            throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        const adapter = providerSetup(connection);
        const credential = adapter.credential === 'optional' && !connection.credential ? this.credentials.get(connectionId) :
            this.credentialManager ? await this.credentialManager.readForExecution(connectionId) :
                this.credentials.get(connectionId);
        const current = (await this.globalStore.read()).connections.find(item => item.id === connectionId);
        if (!current || current.lifecycle !== 'enabled' || JSON.stringify(current.config) !== JSON.stringify(connection.config))
            throw new ModelRuntimeFailure('Connection changed during activation', 'connection-unavailable');
        if ((adapter.credential === 'required' || connection.credential) && !credential)
            throw new ModelRuntimeFailure('Connection needs a credential', 'connection-unavailable');
        const runtime = adapter.createRuntime(connection, credential);
        await this.connect(connectionId, runtime);
        return this.list();
    }
    /** Runtime bindings and credentials are session-only and never enter the store. */
    async connect(connectionId: string, runtime: ConversationalModelRuntime): Promise<void> {
        await this.loaded;
        if (!this.connections.has(connectionId)) throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        this.live.set(connectionId, { runtime, generation: (this.live.get(connectionId)?.generation ?? 0) + 1,
            ready: false, models: [] });
        this.changed();
        await this.refresh(connectionId);
    }
    disconnect(connectionId: string): void {
        if (this.live.delete(connectionId)) this.changed();
    }
    async refresh(connectionId: string): Promise<void> {
        const live = this.live.get(connectionId);
        if (!live) throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        const generation = ++live.generation;
        live.ready = false;
        live.models = [];
        this.changed();
        const models = await live.runtime.discoverModels();
        if (this.live.get(connectionId) !== live || live.generation !== generation) return;
        if (new Set(models.map(model => model.id)).size !== models.length ||
            models.some(model => !model.id?.trim() || !model.label?.trim())) throw new Error('Invalid model inventory');
        live.models = models;
        live.ready = true;
        this.changed();
    }
    async *generate(selection: ModelSelection, request: Omit<ConversationRequest, 'modelId'>): AsyncIterable<ConversationEvent> {
        await this.loaded;
        if (this.globalStore && !(await this.list()).connections.find(item => item.id === selection.connectionId)
            ?.models.some(item => item.id === selection.modelId && item.usable))
            throw new ModelRuntimeFailure('Selected model unavailable', 'model-unavailable');
        const live = this.live.get(selection.connectionId);
        if (!live?.ready) throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        const model = live.models.find(item => item.id === selection.modelId);
        if (!model) throw new ModelRuntimeFailure('Selected model unavailable', 'model-unavailable');
        const connection = this.connections.get(selection.connectionId);
        if (!connection) throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        if (!model.capabilities.conversationalText) throw new ModelRuntimeFailure('Model lacks conversational text', 'unsupported-capability');
        for (const [id, value] of Object.entries(request.controls ?? {})) {
            if (!model.capabilities.reasoningControls?.some(control => control.id === id && control.values.includes(value)))
                throw new ModelRuntimeFailure('Model does not support the selected control', 'unsupported-capability');
        }
        if (request.signal?.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
        try {
            for await (const event of live.runtime.generateConversation({ ...request, modelId: selection.modelId })) {
                if (this.live.get(selection.connectionId) !== live || !live.ready)
                    throw new ModelRuntimeFailure('Connection changed during generation', 'connection-unavailable');
                if (request.signal?.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
                yield event.type === 'complete' ? { ...event, provenance: { connectionId: connection.id,
                    modelId: event.actualModelId ?? model.id, providerId: connection.providerId,
                    modelLabel: event.actualModelId ?? model.label } } : event;
            }
        } catch (error) {
            for (const listener of this.executionListeners) listener(selection.connectionId, error);
            throw error;
        }
    }
}

export class ModelConnectionsBackend implements ModelConnectionsService {
    private readonly unlisten: () => void;
    constructor(private readonly registry: ModelConnectionsRegistry, client: ModelConnectionsClient) {
        this.unlisten = registry.onChange(() => client.notifyModelConnectionsChanged());
    }
    list() { return this.registry.list(); }
    upsert(value: ModelConnectionMetadata, expectedRevision: number) { return this.registry.upsert(value, expectedRevision); }
    remove(id: string, expectedRevision: number) { return this.registry.remove(id, expectedRevision); }
    setPreferred(selection: ModelSelection, expectedRevision: number) { return this.registry.setPreferred(selection, expectedRevision); }
    setSessionCredential(connectionId: string, credential: string | null) {
        return this.registry.setSessionCredential(connectionId, credential);
    }
    activate(connectionId: string) { return this.registry.activate(connectionId); }
    dispose(): void { this.unlisten(); }
}
