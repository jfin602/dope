/** Machine-local selection only. This grants no tool invocation or project-data access. */
export const MCP_PROJECT_PREFERENCES_VERSION = 1 as const;
export interface MCPProjectPreference {
    projectKey: string;
    serverId: string;
    registrationRevision: number;
    enabled: boolean;
}
export interface MCPProjectPreferencesSnapshot {
    version: typeof MCP_PROJECT_PREFERENCES_VERSION;
    revision: number;
    preferences: MCPProjectPreference[];
}
export interface MCPProjectPreferenceMutation {
    version: typeof MCP_PROJECT_PREFERENCES_VERSION;
    expectedRevision: number;
    projectKey: string;
    serverId: string;
    registrationRevision: number;
    enabled: boolean;
}
export type MCPProjectServerState = 'disabled' | 'unconfigured' | 'uninstalled' | 'unavailable' | 'active';

/** Active means selected and eligible, not connected or permitted to call a tool. */
export function mcpProjectServerState(server: { lifecycle: 'installed' | 'disabled';
    configStatus: 'configured' | 'needs-credential' } | undefined,
    selected: boolean, available = true): MCPProjectServerState {
    if (!server) return 'uninstalled';
    if (server.lifecycle === 'disabled' || !selected) return 'disabled';
    if (server.configStatus === 'needs-credential') return 'unconfigured';
    return available ? 'active' : 'unavailable';
}

const key = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const id = (value: unknown): value is string => typeof value === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(value);
const revision = (value: unknown, minimum = 0): value is number =>
    Number.isSafeInteger(value) && (value as number) >= minimum;
const fields = (value: unknown, names: string[]): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === names.sort().join(',');

export function parseMCPProjectPreferences(value: unknown): MCPProjectPreferencesSnapshot {
    if (!fields(value, ['version', 'revision', 'preferences']) ||
        value.version !== MCP_PROJECT_PREFERENCES_VERSION || !revision(value.revision) ||
        !Array.isArray(value.preferences) || value.preferences.length > 4096 ||
        JSON.stringify(value).length > 512 * 1024) throw new Error('Invalid MCP project preferences');
    const seen = new Set<string>();
    for (const entry of value.preferences) {
        if (!fields(entry, ['projectKey', 'serverId', 'registrationRevision', 'enabled']) ||
            !key(entry.projectKey) || !id(entry.serverId) || !revision(entry.registrationRevision, 1) ||
            typeof entry.enabled !== 'boolean') throw new Error('Invalid MCP project preference');
        const pair = `${entry.projectKey}:${entry.serverId}`;
        if (seen.has(pair)) throw new Error('Duplicate MCP project preference');
        seen.add(pair);
    }
    return value as unknown as MCPProjectPreferencesSnapshot;
}
export function applyMCPProjectPreference(snapshot: MCPProjectPreferencesSnapshot,
    mutation: MCPProjectPreferenceMutation): MCPProjectPreferencesSnapshot {
    const current = parseMCPProjectPreferences(snapshot);
    if (!fields(mutation, ['version', 'expectedRevision', 'projectKey', 'serverId', 'registrationRevision', 'enabled']) ||
        mutation.version !== MCP_PROJECT_PREFERENCES_VERSION || mutation.expectedRevision !== current.revision ||
        !key(mutation.projectKey) || !id(mutation.serverId) || !revision(mutation.registrationRevision, 1) ||
        typeof mutation.enabled !== 'boolean') throw new Error('Stale or invalid MCP project preference mutation');
    return parseMCPProjectPreferences({ version: MCP_PROJECT_PREFERENCES_VERSION, revision: current.revision + 1,
        preferences: [...current.preferences.filter(entry =>
            entry.projectKey !== mutation.projectKey || entry.serverId !== mutation.serverId),
        { projectKey: mutation.projectKey, serverId: mutation.serverId,
            registrationRevision: mutation.registrationRevision, enabled: mutation.enabled }] });
}
