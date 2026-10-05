export const AI_REGISTRY_VERSION = 1 as const;
export * from './role-policy';

export type AIConnectionId = string;
export type ProviderModelKey = string;
export type AIConnectionLifecycle = 'enabled' | 'disabled';
export type AIConnectionHealth = 'unknown' | 'checking' | 'ready' | 'degraded' |
    'needs-authentication' | 'unavailable' | 'invalid-configuration' | 'disabled';
export type AIModelState = 'unknown' | 'ready' | 'unavailable' | 'disabled';
export type MetadataSource = 'provider-reported' | 'adapter-known' | 'configured' | 'unknown';
export type AIModelLocality = 'local' | 'hosted';

export type AIConnectionConfig =
    | { type: 'local'; runtime: 'lm-studio'; endpoint: string }
    | { type: 'openai'; endpoint?: string }
    | { type: 'openai-compatible'; endpoint: string }
    | { type: 'codex'; runtime: 'app-server' }
    | { type: 'gemini'; endpoint?: string };

export interface AICodexAccountProjection {
    status: 'unknown' | 'signed-out' | 'signed-in' | 'needs-authentication';
    accountLabel?: string;
    accountId?: string;
    clientId?: string;
    planUsage?: 'unknown' | 'available' | 'unavailable';
}

export type AICredentialReference =
    | { source: 'environment'; name: string; status: 'available' | 'missing' | 'unknown' }
    | { source: 'session' | 'secure'; status: 'available' | 'missing' | 'unknown' };

export interface AIConnection {
    version: typeof AI_REGISTRY_VERSION;
    id: AIConnectionId;
    alias: string;
    lifecycle: AIConnectionLifecycle;
    config: AIConnectionConfig;
    preferredModelId?: string;
    credential?: AICredentialReference;
    codexAccount?: AICodexAccountProjection;
}

export interface KnownValue<Value> {
    source: MetadataSource;
    value?: Value;
}

export interface AIModel {
    version: typeof AI_REGISTRY_VERSION;
    connectionId: AIConnectionId;
    providerModelKey: ProviderModelKey;
    label: string;
    locality: AIModelLocality;
    enabled: boolean;
    state: AIModelState;
    capabilities: {
        conversationalText: KnownValue<boolean>;
        streaming: KnownValue<boolean>;
        structuredOutput: KnownValue<boolean>;
        toolCalling: KnownValue<boolean>;
        agentExecution?: KnownValue<boolean>;
    };
    limits: {
        contextWindowTokens: KnownValue<number>;
        maxInputTokens: KnownValue<number>;
        maxOutputTokens: KnownValue<number>;
    };
}

export interface AIRegistrySnapshot {
    version: typeof AI_REGISTRY_VERSION;
    revision: number;
    connections: AIConnection[];
    models: AIModel[];
}

export type AIRegistryMutation =
    | { type: 'create-connection'; connection: AIConnection }
    | { type: 'update-connection'; id: AIConnectionId; changes: Pick<AIConnection, 'alias' | 'lifecycle' | 'config'> &
        { preferredModelId?: string | null } &
        { credential?: AICredentialReference | null; codexAccount?: AICodexAccountProjection | null } }
    | { type: 'remove-connection'; id: AIConnectionId }
    | { type: 'upsert-model'; model: AIModel }
    | { type: 'reconcile-models'; connectionId: AIConnectionId; models: AIModel[] }
    | { type: 'set-model-enabled'; connectionId: AIConnectionId; providerModelKey: ProviderModelKey; enabled: boolean };

export interface AIRegistryMutationRequest { version: typeof AI_REGISTRY_VERSION; expectedRevision: number; mutation: AIRegistryMutation }

export interface AIEligibilityQuery {
    capabilities?: readonly (keyof AIModel['capabilities'])[];
    locality?: AIModelLocality;
    minimumKnownContextTokens?: number;
    enabledOnly?: boolean;
    usableOnly?: boolean;
    /** Ephemeral observed runtime capacity, not model metadata or health. */
    loadedLocalModels?: readonly { connectionId: AIConnectionId; providerModelKey: ProviderModelKey; contextWindowTokens: number }[];
}
export interface AIEligibilityResult { models: AIModel[] }

export interface AIConnectionObservation { connectionId: AIConnectionId; health: AIConnectionHealth }
export type AIHealthEvent = Exclude<AIConnectionHealth, 'disabled'> | 'transient-request-failure';

export function nextAIConnectionHealth(current: AIConnectionHealth, lifecycle: AIConnectionLifecycle,
    event: AIHealthEvent): AIConnectionHealth {
    if (lifecycle === 'disabled') return 'disabled';
    if (event === 'transient-request-failure') return current === 'disabled' ? 'unknown' : current;
    return event;
}

function record(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(key => !keys.includes(key))) throw new Error('Invalid AI registry value');
    return value as Record<string, unknown>;
}
function text(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid AI registry text');
    return value;
}
function choice<Value extends string>(value: unknown, values: readonly Value[]): Value {
    if (!values.includes(value as Value)) throw new Error('Invalid AI registry choice');
    return value as Value;
}
function integer(value: unknown, minimum = 0): number {
    if (!Number.isSafeInteger(value) || (value as number) < minimum) throw new Error('Invalid AI registry number');
    return value as number;
}
function endpoint(value: unknown): string {
    const address = text(value);
    let url: URL;
    try { url = new URL(address); } catch { throw new Error('Invalid AI endpoint'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash)
        throw new Error('Unsafe AI endpoint');
    return address;
}
function config(value: unknown): AIConnectionConfig {
    const item = record(value, ['type', 'runtime', 'endpoint']);
    const type = choice(item.type, ['local', 'openai', 'openai-compatible', 'gemini', 'codex'] as const);
    if (type === 'local') {
        if (item.runtime !== 'lm-studio' || item.endpoint === undefined) throw new Error('Invalid local configuration');
        return { type, runtime: 'lm-studio', endpoint: endpoint(item.endpoint) };
    }
    if (type === 'codex') {
        if (item.runtime !== 'app-server' || item.endpoint !== undefined) throw new Error('Invalid Codex configuration');
        return { type, runtime: 'app-server' };
    }
    if (item.runtime !== undefined || (type === 'openai-compatible' && item.endpoint === undefined))
        throw new Error('Invalid provider configuration');
    if (type === 'openai-compatible') return { type, endpoint: endpoint(item.endpoint) };
    return item.endpoint === undefined ? { type } : { type, endpoint: endpoint(item.endpoint) };
}
function credential(value: unknown): AICredentialReference {
    const item = record(value, ['source', 'name', 'status']);
    const source = choice(item.source, ['environment', 'session', 'secure'] as const);
    const status = choice(item.status, ['available', 'missing', 'unknown'] as const);
    if (source === 'environment') {
        const name = text(item.name);
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new Error('Invalid environment variable');
        return { source, name, status };
    }
    if (item.name !== undefined) throw new Error('Invalid credential reference');
    return { source, status };
}
function codexAccount(value: unknown): AICodexAccountProjection {
    const item = record(value, ['status', 'accountLabel', 'accountId', 'clientId', 'planUsage']);
    const status = choice(item.status, ['unknown', 'signed-out', 'signed-in', 'needs-authentication'] as const);
    const label = (value: unknown): string => {
        const result = text(value);
        if (result.length > 160 || /[\x00-\x1f\x7f]/.test(result)) throw new Error('Invalid Codex account label');
        return result;
    };
    return { status,
        ...(item.accountLabel === undefined ? {} : { accountLabel: label(item.accountLabel) }),
        ...(item.accountId === undefined ? {} : { accountId: label(item.accountId) }),
        ...(item.clientId === undefined ? {} : { clientId: label(item.clientId) }),
        ...(item.planUsage === undefined ? {} : { planUsage: choice(item.planUsage, ['unknown', 'available', 'unavailable'] as const) }) };
}
export function parseAIConnection(value: unknown): AIConnection {
    const item = record(value, ['version', 'id', 'alias', 'lifecycle', 'config', 'credential', 'preferredModelId', 'codexAccount']);
    if (item.version !== AI_REGISTRY_VERSION) throw new Error('Unsupported AI connection version');
    const parsedConfig = config(item.config);
    if (parsedConfig.type === 'codex' ? item.credential !== undefined : item.codexAccount !== undefined)
        throw new Error('Invalid provider authentication projection');
    return { version: AI_REGISTRY_VERSION, id: text(item.id), alias: text(item.alias),
        lifecycle: choice(item.lifecycle, ['enabled', 'disabled'] as const), config: parsedConfig,
        ...(item.preferredModelId === undefined ? {} : { preferredModelId: text(item.preferredModelId) }),
        ...(item.credential === undefined ? {} : { credential: credential(item.credential) }),
        ...(item.codexAccount === undefined ? {} : { codexAccount: codexAccount(item.codexAccount) }) };
}
function known<Value>(value: unknown, validate: (value: unknown) => Value): KnownValue<Value> {
    const item = record(value, ['source', 'value']);
    const source = choice(item.source, ['provider-reported', 'adapter-known', 'configured', 'unknown'] as const);
    if ((source === 'unknown') !== (item.value === undefined)) throw new Error('Invalid metadata quality');
    return source === 'unknown' ? { source } : { source, value: validate(item.value) };
}
function bool(value: unknown): boolean {
    if (typeof value !== 'boolean') throw new Error('Invalid AI registry boolean');
    return value;
}
export function parseAIModel(value: unknown): AIModel {
    const item = record(value, ['version', 'connectionId', 'providerModelKey', 'label', 'locality', 'enabled', 'state', 'capabilities', 'limits']);
    if (item.version !== AI_REGISTRY_VERSION) throw new Error('Unsupported AI model version');
    const capabilities = record(item.capabilities, ['conversationalText', 'streaming', 'structuredOutput', 'toolCalling', 'agentExecution']);
    const limits = record(item.limits, ['contextWindowTokens', 'maxInputTokens', 'maxOutputTokens']);
    return { version: AI_REGISTRY_VERSION, connectionId: text(item.connectionId), providerModelKey: text(item.providerModelKey),
        label: text(item.label), locality: choice(item.locality, ['local', 'hosted'] as const), enabled: bool(item.enabled),
        state: choice(item.state, ['unknown', 'ready', 'unavailable', 'disabled'] as const),
        capabilities: { conversationalText: known(capabilities.conversationalText, bool), streaming: known(capabilities.streaming, bool),
            structuredOutput: known(capabilities.structuredOutput, bool), toolCalling: known(capabilities.toolCalling, bool),
            ...(capabilities.agentExecution === undefined ? {} : { agentExecution: known(capabilities.agentExecution, bool) }) },
        limits: { contextWindowTokens: known(limits.contextWindowTokens, value => integer(value, 1)),
            maxInputTokens: known(limits.maxInputTokens, value => integer(value, 1)),
            maxOutputTokens: known(limits.maxOutputTokens, value => integer(value, 1)) } };
}
export function parseAIRegistrySnapshot(value: unknown): AIRegistrySnapshot {
    const item = record(value, ['version', 'revision', 'connections', 'models']);
    if (item.version !== AI_REGISTRY_VERSION || !Array.isArray(item.connections) || !Array.isArray(item.models))
        throw new Error('Invalid AI registry snapshot');
    const connections = item.connections.map(parseAIConnection);
    const models = item.models.map(parseAIModel);
    if (new Set(connections.map(connection => connection.id)).size !== connections.length ||
        models.some(model => !connections.some(connection => connection.id === model.connectionId)) ||
        models.some(model => connections.find(connection => connection.id === model.connectionId)?.config.type === 'codex' &&
            model.locality !== 'hosted') ||
        models.some((model, index) => models.findIndex(other => other.connectionId === model.connectionId &&
            other.providerModelKey === model.providerModelKey) !== index)) throw new Error('Invalid AI registry identities');
    return { version: AI_REGISTRY_VERSION, revision: integer(item.revision), connections, models };
}
export function parseAIRegistryMutation(value: unknown): AIRegistryMutation {
    const item = record(value, ['type', 'connection', 'id', 'changes', 'model', 'models', 'connectionId', 'providerModelKey', 'enabled']);
    switch (item.type) {
        case 'create-connection':
            record(value, ['type', 'connection']);
            return { type: item.type, connection: parseAIConnection(item.connection) };
        case 'update-connection': {
            record(value, ['type', 'id', 'changes']);
            const changes = record(item.changes, ['alias', 'lifecycle', 'config', 'credential', 'preferredModelId', 'codexAccount']);
            if (changes.alias === undefined || changes.lifecycle === undefined || changes.config === undefined)
                throw new Error('Incomplete AI connection update');
            const parsedConfig = config(changes.config);
            if (parsedConfig.type === 'codex' ? changes.credential !== undefined && changes.credential !== null :
                changes.codexAccount !== undefined && changes.codexAccount !== null)
                throw new Error('Invalid provider authentication projection');
            return { type: item.type, id: text(item.id), changes: { alias: text(changes.alias),
                lifecycle: choice(changes.lifecycle, ['enabled', 'disabled'] as const), config: parsedConfig,
                ...(changes.preferredModelId === undefined ? {} : { preferredModelId: changes.preferredModelId === null ? null : text(changes.preferredModelId) }),
                ...(changes.credential === undefined ? {} : { credential: changes.credential === null ? null : credential(changes.credential) }),
                ...(changes.codexAccount === undefined ? {} : { codexAccount: changes.codexAccount === null ? null : codexAccount(changes.codexAccount) }) } };
        }
        case 'remove-connection':
            record(value, ['type', 'id']);
            return { type: item.type, id: text(item.id) };
        case 'upsert-model':
            record(value, ['type', 'model']);
            return { type: item.type, model: parseAIModel(item.model) };
        case 'reconcile-models': {
            record(value, ['type', 'connectionId', 'models']);
            const connectionId = text(item.connectionId);
            if (!Array.isArray(item.models)) throw new Error('Invalid model inventory');
            const models = item.models.map(parseAIModel);
            if (models.some(model => model.connectionId !== connectionId) ||
                new Set(models.map(model => model.providerModelKey)).size !== models.length)
                throw new Error('Invalid model inventory identities');
            return { type: item.type, connectionId, models };
        }
        case 'set-model-enabled':
            record(value, ['type', 'connectionId', 'providerModelKey', 'enabled']);
            return { type: item.type, connectionId: text(item.connectionId),
                providerModelKey: text(item.providerModelKey), enabled: bool(item.enabled) };
        default: throw new Error('Invalid AI registry mutation');
    }
}
export function applyAIRegistryMutation(snapshot: AIRegistrySnapshot, request: AIRegistryMutationRequest): AIRegistrySnapshot {
    const current = parseAIRegistrySnapshot(snapshot);
    const input = record(request, ['version', 'expectedRevision', 'mutation']);
    if (input.version !== AI_REGISTRY_VERSION) throw new Error('Unsupported AI registry mutation version');
    if (integer(input.expectedRevision) !== current.revision) throw new Error('Stale AI registry revision');
    const mutation = parseAIRegistryMutation(input.mutation);
    let { connections, models } = current;
    switch (mutation.type) {
        case 'create-connection':
            if (connections.some(connection => connection.id === mutation.connection.id)) throw new Error('AI connection ID already exists');
            connections = [...connections, mutation.connection];
            break;
        case 'update-connection':
            if (!connections.some(connection => connection.id === mutation.id)) throw new Error('AI connection missing');
            connections = connections.map(connection => connection.id === mutation.id ?
                { ...connection, ...mutation.changes,
                    preferredModelId: mutation.changes.preferredModelId === null ? undefined :
                        mutation.changes.preferredModelId ?? connection.preferredModelId,
                    credential: mutation.changes.credential === null ? undefined :
                        mutation.changes.credential ?? connection.credential,
                    codexAccount: mutation.changes.codexAccount === null ? undefined :
                        mutation.changes.codexAccount ?? connection.codexAccount } : connection);
            break;
        case 'remove-connection':
            if (!connections.some(connection => connection.id === mutation.id)) throw new Error('AI connection missing');
            connections = connections.filter(connection => connection.id !== mutation.id);
            models = models.filter(model => model.connectionId !== mutation.id);
            break;
        case 'upsert-model':
            if (!connections.some(connection => connection.id === mutation.model.connectionId)) throw new Error('AI connection missing');
            const previous = models.find(model => model.connectionId === mutation.model.connectionId &&
                model.providerModelKey === mutation.model.providerModelKey);
            models = [...models.filter(model => model.connectionId !== mutation.model.connectionId ||
                model.providerModelKey !== mutation.model.providerModelKey),
            { ...mutation.model, enabled: previous?.enabled ?? mutation.model.enabled }];
            break;
        case 'reconcile-models':
            if (!connections.some(connection => connection.id === mutation.connectionId)) throw new Error('AI connection missing');
            models = [
                ...models.filter(model => model.connectionId !== mutation.connectionId),
                ...mutation.models.map(model => ({ ...model, enabled: models.find(previous =>
                    previous.connectionId === mutation.connectionId && previous.providerModelKey === model.providerModelKey)?.enabled ?? model.enabled })),
                ...models.filter(model => model.connectionId === mutation.connectionId &&
                    !mutation.models.some(discovered => discovered.providerModelKey === model.providerModelKey))
                    .map(model => ({ ...model, state: 'unavailable' as const }))
            ];
            break;
        case 'set-model-enabled':
            if (!models.some(model => model.connectionId === mutation.connectionId && model.providerModelKey === mutation.providerModelKey))
                throw new Error('AI model missing');
            models = models.map(model => model.connectionId === mutation.connectionId && model.providerModelKey === mutation.providerModelKey ?
                { ...model, enabled: mutation.enabled } : model);
    }
    return parseAIRegistrySnapshot({ version: AI_REGISTRY_VERSION, revision: current.revision + 1, connections, models });
}

export function findEligibleModels(snapshot: AIRegistrySnapshot, query: AIEligibilityQuery,
    observations: readonly AIConnectionObservation[] = []): AIEligibilityResult {
    const current = parseAIRegistrySnapshot(snapshot);
    if (query.minimumKnownContextTokens !== undefined) integer(query.minimumKnownContextTokens, 1);
    const capabilities = query.capabilities ?? [];
    if (capabilities.some(capability => !['conversationalText', 'streaming', 'structuredOutput', 'toolCalling', 'agentExecution'].includes(capability)))
        throw new Error('Invalid capability query');
    return { models: current.models.filter(model => {
        const connection = current.connections.find(item => item.id === model.connectionId)!;
        const health = observations.find(item => item.connectionId === connection.id)?.health ?? 'unknown';
        const loaded = query.loadedLocalModels?.find(item => item.connectionId === model.connectionId &&
            item.providerModelKey === model.providerModelKey);
        const context = model.locality === 'local' ? loaded?.contextWindowTokens : model.limits.contextWindowTokens.value;
        return (query.locality === undefined || model.locality === query.locality) &&
            (!query.enabledOnly || (connection.lifecycle === 'enabled' && model.enabled)) &&
            (!query.usableOnly || (connection.lifecycle === 'enabled' && model.enabled && model.state === 'ready' &&
                health === 'ready' && (model.locality !== 'local' || (loaded !== undefined &&
                    context !== undefined && Number.isSafeInteger(context) && context > 0)))) &&
            (query.minimumKnownContextTokens === undefined || (context !== undefined &&
                Number.isSafeInteger(context) && context >= query.minimumKnownContextTokens)) &&
            capabilities.every(capability => model.capabilities[capability]?.value === true);
    }).sort((left, right) => left.connectionId.localeCompare(right.connectionId) ||
        left.providerModelKey.localeCompare(right.providerModelKey)) };
}
