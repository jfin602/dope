import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ConnectedModel, ConversationEvent, ConversationRequest, ConversationalModelRuntime,
    ModelSelection } from '@dope/contracts/lib/model-runtime';
import type { ModelConnectionMetadata, ModelConnectionsClient, ModelConnectionsService,
    ModelConnectionsSnapshot } from '@dope/contracts/lib/model-connections-service';

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
    private readonly listeners = new Set<() => void>();
    private readonly loaded: Promise<void>;
    private saving: Promise<void> = Promise.resolve();

    constructor(private readonly store: ModelConnectionStore = new FileModelConnectionStore()) {
        this.loaded = store.read().then(entries => { for (const entry of entries) this.connections.set(entry.id, metadata(entry)); });
    }
    onChange(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
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
        return { connections: [...this.connections.values()].map(entry => {
            const live = this.live.get(entry.id);
            return { ...entry, ready: !!live?.ready, models: live?.ready ? live.models.map(model =>
                ({ ...model, capabilities: { ...model.capabilities }, usable: model.capabilities.conversationalText })) : [] };
        }) };
    }
    async upsert(value: ModelConnectionMetadata): Promise<ModelConnectionsSnapshot> {
        await this.loaded;
        const entry = metadata(value);
        const previous = this.connections.get(entry.id);
        if (previous && previous.providerId !== entry.providerId) {
            this.disconnect(entry.id);
            this.credentials.delete(entry.id);
        }
        this.connections.set(entry.id, entry);
        await this.save();
        return this.list();
    }
    async remove(connectionId: string): Promise<ModelConnectionsSnapshot> {
        await this.loaded;
        this.disconnect(connectionId);
        this.credentials.delete(connectionId);
        if (this.connections.delete(connectionId)) await this.save();
        return this.list();
    }
    async setPreferred(selection: ModelSelection): Promise<ModelConnectionsSnapshot> {
        await this.loaded;
        const entry = this.connections.get(selection.connectionId);
        if (!entry) throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        if (!selection.modelId?.trim()) throw new Error('Invalid model ID');
        this.connections.set(entry.id, { ...entry, preferredModelId: selection.modelId });
        await this.save();
        return this.list();
    }
    async setSessionCredential(connectionId: string, credential: string | null): Promise<void> {
        await this.loaded;
        if (!this.connections.has(connectionId)) throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        if (credential !== null && (typeof credential !== 'string' || !credential.trim())) throw new Error('Invalid credential');
        if (credential === null) this.credentials.delete(connectionId);
        else this.credentials.set(connectionId, credential);
        this.disconnect(connectionId);
    }
    /** For provider setup on the backend only; never part of the RPC inventory. */
    sessionCredential(connectionId: string): string | undefined { return this.credentials.get(connectionId); }
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
        const live = this.live.get(selection.connectionId);
        if (!live?.ready) throw new ModelRuntimeFailure('Connection unavailable', 'connection-unavailable');
        const model = live.models.find(item => item.id === selection.modelId);
        if (!model) throw new ModelRuntimeFailure('Selected model unavailable', 'model-unavailable');
        if (!model.capabilities.conversationalText) throw new ModelRuntimeFailure('Model lacks conversational text', 'unsupported-capability');
        for (const [id, value] of Object.entries(request.controls ?? {})) {
            if (!model.capabilities.reasoningControls?.some(control => control.id === id && control.values.includes(value)))
                throw new ModelRuntimeFailure('Model does not support the selected control', 'unsupported-capability');
        }
        if (request.signal?.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
        for await (const event of live.runtime.generateConversation({ ...request, modelId: selection.modelId })) {
            if (this.live.get(selection.connectionId) !== live || !live.ready)
                throw new ModelRuntimeFailure('Connection changed during generation', 'connection-unavailable');
            if (request.signal?.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
            yield event;
        }
    }
}

export class ModelConnectionsBackend implements ModelConnectionsService {
    private readonly unlisten: () => void;
    constructor(private readonly registry: ModelConnectionsRegistry, client: ModelConnectionsClient) {
        this.unlisten = registry.onChange(() => client.notifyModelConnectionsChanged());
    }
    list() { return this.registry.list(); }
    upsert(value: ModelConnectionMetadata) { return this.registry.upsert(value); }
    remove(id: string) { return this.registry.remove(id); }
    setPreferred(selection: ModelSelection) { return this.registry.setPreferred(selection); }
    setSessionCredential(connectionId: string, credential: string | null) {
        return this.registry.setSessionCredential(connectionId, credential);
    }
    dispose(): void { this.unlisten(); }
}
