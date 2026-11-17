/** Machine-local server configuration. Project activation and runtime health have separate owners. */
export const MCP_SERVER_REGISTRY_VERSION = 1 as const;
export type MCPServerLifecycle = 'installed' | 'disabled';
export type MCPServerConfigStatus = 'configured' | 'needs-credential';

export interface MCPServer {
    version: typeof MCP_SERVER_REGISTRY_VERSION;
    id: string;
    /** Changes on remove/recreate; P3 must bind preferences to this value as well as id. */
    registrationRevision: number;
    name: string;
    lifecycle: MCPServerLifecycle;
    configStatus: MCPServerConfigStatus;
    /** P1-qualified descriptor has no arguments; future argument forms need a separate secret-safe contract. */
    config: { transport: 'stdio'; command: string; args: [] };
    credential?: { source: 'secure'; account: string };
}
export interface MCPServerRegistrySnapshot {
    version: typeof MCP_SERVER_REGISTRY_VERSION;
    revision: number;
    servers: MCPServer[];
}
export type MCPServerRegistryMutation =
    | { type: 'create'; server: Omit<MCPServer, 'registrationRevision'> }
    | { type: 'update'; id: string; server: MCPServer }
    | { type: 'remove'; id: string };
export interface MCPServerRegistryMutationRequest {
    version: typeof MCP_SERVER_REGISTRY_VERSION;
    expectedRevision: number;
    mutation: MCPServerRegistryMutation;
}

const MAX_SERVERS = 64;
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        Object.keys(value).some(key => !keys.includes(key))) throw new Error('Invalid MCP registry object');
    return value as Record<string, unknown>;
}
function bounded(value: unknown, maximum: number): string {
    if (typeof value !== 'string' || !value.trim() || value.length > maximum || /[\x00-\x1f\x7f]/.test(value))
        throw new Error('Invalid MCP registry text');
    return value;
}
function id(value: unknown): string {
    const result = bounded(value, 80);
    if (!/^[a-z][a-z0-9-]{0,79}$/.test(result)) throw new Error('Invalid MCP server ID');
    return result;
}
function command(value: unknown): string {
    const result = bounded(value, 1024);
    if (!result.startsWith('/') || result.includes('//') || result.split('/').includes('..') ||
        result.split('/').includes('.') || result.endsWith('/')) throw new Error('Invalid MCP executable path');
    return result;
}
export function parseMCPServer(value: unknown): MCPServer {
    const item = object(value, ['version', 'id', 'registrationRevision', 'name', 'lifecycle', 'configStatus', 'config', 'credential']);
    if (item.version !== MCP_SERVER_REGISTRY_VERSION) throw new Error('Unsupported MCP server version');
    const serverId = id(item.id);
    if (!Number.isSafeInteger(item.registrationRevision) || (item.registrationRevision as number) < 1)
        throw new Error('Invalid MCP registration revision');
    const name = bounded(item.name, 120);
    if (name.trim() !== name) throw new Error('Invalid MCP server name');
    if (item.lifecycle !== 'installed' && item.lifecycle !== 'disabled') throw new Error('Invalid MCP lifecycle');
    if (item.configStatus !== 'configured' && item.configStatus !== 'needs-credential')
        throw new Error('Invalid MCP configuration status');
    const config = object(item.config, ['transport', 'command', 'args']);
    if (config.transport !== 'stdio') throw new Error('Unsupported MCP transport');
    if (!Array.isArray(config.args) || config.args.length !== 0)
        throw new Error('Invalid MCP arguments');
    const credential = item.credential === undefined ? undefined : object(item.credential, ['source', 'account']);
    if (credential && (credential.source !== 'secure' || credential.account !== serverId))
        throw new Error('Invalid MCP credential reference');
    if (item.configStatus === 'needs-credential' && !credential)
        throw new Error('Missing MCP credential reference');
    return { version: MCP_SERVER_REGISTRY_VERSION, id: serverId,
        registrationRevision: item.registrationRevision as number, name,
        lifecycle: item.lifecycle, configStatus: item.configStatus,
        config: { transport: 'stdio', command: command(config.command), args: [] },
        ...(credential ? { credential: { source: 'secure', account: serverId } } : {}) };
}
export function parseMCPServerRegistrySnapshot(value: unknown): MCPServerRegistrySnapshot {
    const item = object(value, ['version', 'revision', 'servers']);
    if (item.version !== MCP_SERVER_REGISTRY_VERSION || !Number.isSafeInteger(item.revision) ||
        (item.revision as number) < 0 || !Array.isArray(item.servers) || item.servers.length > MAX_SERVERS)
        throw new Error('Unsupported MCP registry snapshot');
    const servers = item.servers.map(parseMCPServer);
    if (new Set(servers.map(server => server.id)).size !== servers.length)
        throw new Error('Duplicate MCP server ID');
    if (servers.some(server => server.registrationRevision > (item.revision as number)) ||
        JSON.stringify(item).length > 64 * 1024) throw new Error('Invalid MCP registry bounds');
    return { version: MCP_SERVER_REGISTRY_VERSION, revision: item.revision as number, servers };
}
export function applyMCPServerRegistryMutation(snapshot: MCPServerRegistrySnapshot,
    request: MCPServerRegistryMutationRequest): MCPServerRegistrySnapshot {
    const current = parseMCPServerRegistrySnapshot(snapshot);
    const input = object(request, ['version', 'expectedRevision', 'mutation']);
    if (input.version !== MCP_SERVER_REGISTRY_VERSION) throw new Error('Unsupported MCP mutation version');
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision !== current.revision)
        throw new Error('Stale MCP registry revision');
    const mutation = object(input.mutation, ['type', 'id', 'server']);
    let servers: MCPServer[];
    if (mutation.type === 'create') {
        if (mutation.id !== undefined) throw new Error('Invalid MCP create mutation');
        const raw = object(mutation.server, ['version', 'id', 'registrationRevision', 'name', 'lifecycle', 'configStatus', 'config', 'credential']);
        if (raw.registrationRevision !== undefined) throw new Error('MCP registration revision is server owned');
        const server = parseMCPServer({ ...raw, registrationRevision: current.revision + 1 });
        if (current.servers.some(existing => existing.id === server.id)) throw new Error('Duplicate MCP server ID');
        servers = [...current.servers, server];
    } else if (mutation.type === 'update') {
        const serverId = id(mutation.id), server = parseMCPServer(mutation.server);
        const previous = current.servers.find(existing => existing.id === serverId);
        if (server.id !== serverId || !previous || server.registrationRevision !== previous.registrationRevision)
            throw new Error('MCP server missing or identity changed');
        servers = current.servers.map(existing => existing.id === serverId ? server : existing);
    } else if (mutation.type === 'remove') {
        if (mutation.server !== undefined) throw new Error('Invalid MCP remove mutation');
        const serverId = id(mutation.id);
        if (!current.servers.some(existing => existing.id === serverId)) throw new Error('MCP server missing');
        servers = current.servers.filter(existing => existing.id !== serverId);
    } else throw new Error('Unsupported MCP mutation');
    return parseMCPServerRegistrySnapshot({ version: MCP_SERVER_REGISTRY_VERSION,
        revision: current.revision + 1, servers });
}
