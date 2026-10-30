import type { AIInventoryState } from '@dope/contracts/lib/ai-registry-service';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import { providerSetup } from './provider-setup';
import type { PiRuntimeHost } from './pi-runtime-host';

export interface PiLocalSelection { connectionId: string; modelId: string; registryRevision?: number; loadedContextTokens?: number }
export interface PiLocalBinding {
    connectionId: string;
    modelId: string;
    endpoint: string;
    contextWindowTokens: number;
    maxOutputTokens: number;
    credentialReference?: { source: 'environment' | 'session' | 'secure'; name?: string };
}

export interface PiModelBridgeDependencies {
    inventory(): Promise<AIInventoryState>;
    refreshModels(connectionId: string): Promise<AIInventoryState>;
    credential(connectionId: string): Promise<string | undefined>;
    verifyLocalAgentExecution?(connectionId: string, modelId: string): Promise<string>;
}

const unavailable = (message: string) => new ModelRuntimeFailure(message, 'model-unavailable');

/** Exact, explicit AI Center selection. A fresh LM Studio probe is required for every binding. */
export class PiModelBridge {
    constructor(private readonly dependencies: PiModelBridgeDependencies) {}

    /** A Work tool invocation must still use the exact approved Local selection. */
    async assertWorkSelection(selection: PiLocalSelection, endpoint: string): Promise<void> {
        const state = await this.dependencies.inventory();
        const connection = state.registry.connections.find(item => item.id === selection.connectionId);
        const model = state.registry.models.find(item => item.connectionId === selection.connectionId &&
            item.providerModelKey === selection.modelId);
        const loaded = state.loadedLocalModels?.find(item => item.connectionId === selection.connectionId &&
            item.providerModelKey === selection.modelId)?.contextWindowTokens;
        if (!connection || connection.lifecycle !== 'enabled' || connection.config.type !== 'local' ||
            connection.config.runtime !== 'lm-studio' || connection.config.endpoint.replace(/\/$/, '') !== endpoint ||
            !model || !model.enabled || model.state !== 'ready' || model.locality !== 'local' ||
            model.capabilities.agentExecution?.source !== 'adapter-known' ||
            model.capabilities.agentExecution.value !== true || model.capabilities.toolCalling.value === false ||
            state.observations.find(item => item.connectionId === selection.connectionId)?.health !== 'ready' ||
            selection.registryRevision !== state.registry.revision || selection.loadedContextTokens !== loaded)
            throw unavailable('Local Work model changed during execution');
    }

    async bind(selection: PiLocalSelection, host: Pick<PiRuntimeHost, 'openNoToolSession' | 'openWorkSession'>,
        cwd: string, options: { tools?: boolean } = {}): Promise<PiLocalBinding> {
        if (!selection.connectionId?.trim() || !selection.modelId?.trim())
            throw unavailable('Select a Local model in AI Center first');
        const before = await this.dependencies.inventory();
        if (selection.registryRevision !== undefined && selection.registryRevision !== before.registry.revision)
            throw unavailable('AI Center selection changed; reselect the Local model');
        const original = before.registry.connections.find(item => item.id === selection.connectionId);
        if (!original || original.lifecycle !== 'enabled' || original.config.type !== 'local' ||
            original.config.runtime !== 'lm-studio')
            throw unavailable('Select an enabled Local LM Studio connection in AI Center');
        const selectedEndpoint = original.config.endpoint;
        try { providerSetup(original); }
        catch { throw unavailable('Check the Local LM Studio endpoint in AI Center'); }
        let refreshed: AIInventoryState;
        try { refreshed = await this.dependencies.refreshModels(selection.connectionId); }
        catch { throw unavailable('Local server unreachable; check the AI Center connection and retry'); }
        if (options.tools) {
            const result = await this.dependencies.verifyLocalAgentExecution?.(selection.connectionId, selection.modelId);
            if (result !== 'supported')
                throw unavailable('Verify Local agent execution in AI Center before using tools');
            refreshed = await this.dependencies.inventory();
        }
        const connection = refreshed.registry.connections.find(item => item.id === selection.connectionId);
        if (!connection || connection.lifecycle !== 'enabled' || connection.config.type !== 'local' ||
            connection.config.runtime !== 'lm-studio' || connection.config.endpoint !== selectedEndpoint)
            throw unavailable('Local endpoint changed; reselect the model in AI Center');
        try { providerSetup(connection); }
        catch { throw unavailable('Check the Local LM Studio endpoint in AI Center'); }
        const model = refreshed.registry.models.find(item => item.connectionId === selection.connectionId &&
            item.providerModelKey === selection.modelId);
        const loaded = refreshed.loadedLocalModels?.find(item => item.connectionId === selection.connectionId &&
            item.providerModelKey === selection.modelId)?.contextWindowTokens;
        if (!model || !model.enabled || model.state !== 'ready' || model.locality !== 'local' ||
            refreshed.observations.find(item => item.connectionId === selection.connectionId)?.health !== 'ready' ||
            model.capabilities.conversationalText.value !== true ||
            model.capabilities.streaming.value !== true ||
            !Number.isSafeInteger(loaded) || !loaded || loaded < 2048)
            throw unavailable('Selected Local model is unavailable or unloaded; load and refresh it in AI Center');
        if (selection.loadedContextTokens !== undefined && selection.loadedContextTokens !== loaded)
            throw unavailable('Local selection or loaded context changed; reselect in AI Center');
        if (options.tools && (model.capabilities.agentExecution?.source !== 'adapter-known' ||
            model.capabilities.agentExecution.value !== true || model.capabilities.toolCalling.value === false))
            throw unavailable('Selected Local model is not verified for tools in AI Center');
        const declared = model.limits.maxOutputTokens.value;
        const maxOutputTokens = Math.min(4096, loaded - 1536,
            Number.isSafeInteger(declared) && declared! > 0 ? declared! : Infinity);
        if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1)
            throw unavailable('Selected Local model has insufficient output budget');
        const credential = await this.dependencies.credential(selection.connectionId)
            .catch(() => { throw unavailable('Local credential unavailable; restore it in AI Center'); });
        if (connection.credential && !credential)
            throw unavailable('Local credential unavailable; restore it in AI Center');
        const latest = await this.dependencies.inventory();
        if (latest.registry.revision !== refreshed.registry.revision ||
            JSON.stringify(latest.registry.connections.find(item => item.id === selection.connectionId)) !== JSON.stringify(connection) ||
            latest.loadedLocalModels?.find(item => item.connectionId === selection.connectionId &&
                item.providerModelKey === selection.modelId)?.contextWindowTokens !== loaded ||
            latest.observations.find(item => item.connectionId === selection.connectionId)?.health !== 'ready')
            throw unavailable('Local model changed during binding; refresh AI Center and retry');
        const endpoint = connection.config.endpoint.replace(/\/$/, '');
        const opened = await (options.tools ? host.openWorkSession : host.openNoToolSession).call(host,
            { id: selection.modelId, name: model.label,
            provider: 'dope-local', api: 'openai-completions', baseUrl: endpoint,
            reasoning: false, input: ['text'],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: loaded, maxTokens: maxOutputTokens }, cwd, credential);
        const expected = options.tools ? ['dope_edit', 'dope_list', 'dope_process', 'dope_read'] : [];
        if (opened.version !== '1.4.0' || opened.resources !== 'isolated' ||
            JSON.stringify(opened.tools?.slice().sort()) !== JSON.stringify(expected))
            throw unavailable('Pi tool boundary changed; restart Dope');
        return { connectionId: selection.connectionId, modelId: selection.modelId, endpoint,
            contextWindowTokens: loaded, maxOutputTokens,
            ...(connection.credential ? { credentialReference: { source: connection.credential.source,
                ...(connection.credential.source === 'environment' ? { name: connection.credential.name } : {}) } } : {}) };
    }
}
