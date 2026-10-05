import { AI_REGISTRY_VERSION, parseAIConnection } from '@dope/ai';
import type { AIConnection, AIConnectionConfig } from '@dope/ai';
import type { ConversationalModelRuntime } from '@dope/contracts/lib/model-runtime';
import type { ProviderSetupDescription } from '@dope/contracts/lib/ai-registry-service';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import { LocalConversationalProvider, GeminiConversationalProvider } from './conversational-providers';
import { OpenAIConversationalProvider } from './openai-conversational-provider';
import { localModelIds } from './provider-transport';

export interface ProviderSetupAdapter extends ProviderSetupDescription {
    readonly defaultConfig?: AIConnectionConfig;
    validate(connection: AIConnection): void;
    createRuntime(connection: AIConnection, credential?: string): ConversationalModelRuntime;
}

const sources = ['environment', 'session', 'secure'] as const;
const required = (credential?: string): string => {
    if (!credential) throw new ModelRuntimeFailure('Connection needs a credential', 'connection-unavailable');
    return credential;
};

export const providerSetupAdapters: Readonly<Record<AIConnectionConfig['type'], ProviderSetupAdapter>> = {
    local: {
        type: 'local', connectionClass: 'model-runtime', fields: ['runtime', 'endpoint'], locality: 'local', credential: 'optional', credentialSources: sources,
        modelSource: 'discovered', defaultConfig: { type: 'local', runtime: 'lm-studio', endpoint: 'http://127.0.0.1:1234/v1' },
        validate(connection) {
            const config = connection.config;
            if (config.type !== 'local') throw new Error('Invalid local configuration');
            const host = new URL(config.endpoint).hostname;
            if (!['localhost', '127.0.0.1', '[::1]'].includes(host) ||
                !['/', '/v1', '/v1/'].includes(new URL(config.endpoint).pathname))
                throw new Error('Local runtime must use a localhost /v1 endpoint');
        },
        createRuntime(connection, credential) {
            const config = connection.config;
            if (config.type !== 'local') throw new Error('Invalid local configuration');
            return new LocalConversationalProvider({ endpoint: config.endpoint, ...(credential ? { token: credential } : {}) });
        }
    },
    openai: {
        type: 'openai', connectionClass: 'model-runtime', fields: ['preferredModelId'], locality: 'hosted', credential: 'required', credentialSources: sources,
        environmentVariable: 'OPENAI_API_KEY', modelSource: 'configured', defaultConfig: { type: 'openai' },
        validate(connection) {
            const config = connection.config;
            if (config.type !== 'openai') throw new Error('Invalid OpenAI configuration');
            if (config.endpoint && (new URL(config.endpoint).origin !== 'https://api.openai.com' ||
                !['/', '/v1', '/v1/'].includes(new URL(config.endpoint).pathname)))
                throw new Error('Use OpenAI-compatible for a custom endpoint');
        },
        createRuntime(connection, credential) {
            const config = connection.config;
            if (config.type !== 'openai') throw new Error('Invalid OpenAI configuration');
            if (!connection.preferredModelId) throw new ModelRuntimeFailure('Connection needs a configured model', 'connection-unavailable');
            return new OpenAIConversationalProvider({ apiKey: required(credential),
                models: [{ id: connection.preferredModelId }], endpoint: config.endpoint });
        }
    },
    'openai-compatible': {
        type: 'openai-compatible', connectionClass: 'model-runtime', fields: ['endpoint', 'preferredModelId'], locality: 'hosted', credential: 'optional',
        credentialSources: sources, modelSource: 'configured-or-discovered',
        validate(connection) {
            if (connection.config.type !== 'openai-compatible') throw new Error('Invalid compatible configuration');
        },
        createRuntime(connection, credential) {
            const config = connection.config;
            if (config.type !== 'openai-compatible') throw new Error('Invalid compatible configuration');
            return new LocalConversationalProvider({ endpoint: config.endpoint, compatible: true,
                configuredModel: connection.preferredModelId, ...(credential ? { token: credential } : {}) });
        }
    },
    gemini: {
        type: 'gemini', connectionClass: 'model-runtime', fields: [], locality: 'hosted', credential: 'required', credentialSources: sources,
        environmentVariable: 'GEMINI_API_KEY', modelSource: 'discovered', defaultConfig: { type: 'gemini' },
        validate(connection) {
            if (connection.config.type !== 'gemini' || connection.config.endpoint)
                throw new Error('Gemini custom endpoint unsupported');
        },
        createRuntime(_connection, credential) { return new GeminiConversationalProvider({ apiKey: required(credential) }); }
    },
    codex: {
        type: 'codex', connectionClass: 'agent-runtime', fields: ['runtime', 'preferredModelId'], locality: 'hosted',
        credential: 'managed', credentialSources: [], modelSource: 'discovered',
        validate(connection) {
            if (connection.config.type !== 'codex' || connection.config.runtime !== 'app-server' || connection.credential)
                throw new Error('Invalid Codex connection');
        },
        createRuntime() { throw new ModelRuntimeFailure('Codex requires an agent execution adapter', 'unsupported-capability'); }
    }
};

export function providerSetup(connection: AIConnection): ProviderSetupAdapter {
    const parsed = parseAIConnection(connection);
    const adapter = providerSetupAdapters[parsed.config.type];
    adapter.validate(parsed);
    if (parsed.credential?.source === 'environment' && adapter.environmentVariable &&
        parsed.credential.name !== adapter.environmentVariable) throw new Error('Invalid provider environment variable');
    return adapter;
}

export function providerEnvironmentName(connection: AIConnection): string | undefined {
    const adapter = providerSetupAdapters[connection.config.type];
    return adapter.environmentVariable ?? (connection.credential?.source === 'environment' ? connection.credential.name : undefined);
}

export function providerSetupDescriptions(): ProviderSetupDescription[] {
    return Object.values(providerSetupAdapters).map(({ type, connectionClass, fields, locality, credential, credentialSources,
        environmentVariable, modelSource }) => ({ type, connectionClass, fields, locality, credential, credentialSources,
        ...(environmentVariable ? { environmentVariable } : {}), modelSource }));
}

export async function detectLocalRuntime(fetcher: typeof globalThis.fetch = globalThis.fetch): Promise<AIConnectionConfig | undefined> {
    const endpoint = 'http://127.0.0.1:1234/v1';
    try {
        const response = await fetcher(`${endpoint}/models`, { signal: AbortSignal.timeout(1000) });
        if (!response.ok) return undefined;
        localModelIds(await response.json());
        return { type: 'local', runtime: 'lm-studio', endpoint };
    } catch { return undefined; }
}

export function useDetectedRuntime(connection: AIConnection, config: AIConnectionConfig): AIConnection {
    if (config.type !== 'local') throw new Error('Invalid detected runtime');
    const updated = { ...connection, config, version: AI_REGISTRY_VERSION };
    providerSetup(updated);
    return updated;
}
