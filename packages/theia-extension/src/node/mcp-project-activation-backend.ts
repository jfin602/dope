import { MCP_PROJECT_PREFERENCES_VERSION, mcpProjectServerState } from '@dope/ai';
import type { MCPServer } from '@dope/ai';
import type { MCPProjectActivationClient, MCPProjectActivationEvent, MCPProjectActivationService,
    MCPProjectActivationSnapshot, MCPProjectServerView } from '@dope/contracts/lib/mcp-project-activation-service';
import { MCPServerRegistryStore } from './mcp-server-registry-store';
import { MCPProjectPreferencesStore, mcpProjectKey } from './mcp-project-preferences-store';
import { launchContainedMCPServer, type MCPContainedSession } from './mcp-contained-launch';

/** Connection-scoped project context. Every switch revokes before reading the new project. */
export class MCPProjectActivationBackend implements MCPProjectActivationService {
    private projectKey?: string;
    private projectRoot?: string;
    private launchAbort = new AbortController();
    private generation = 0;
    private disposed = false;
    private readonly unlistenPreferences: () => void;
    private readonly unlistenRegistry: () => void;
    constructor(private readonly preferences: MCPProjectPreferencesStore,
        private readonly registry: MCPServerRegistryStore, private readonly client: MCPProjectActivationClient,
        /** Supplied only by the backend operation owner for this connection, never by global recent-workspace state. */
        private readonly trustedActiveRoot?: () => Promise<string | undefined>) {
        this.unlistenPreferences = preferences.onChange(() => this.revoke('selection-changed'));
        this.unlistenRegistry = registry.onChange(() => this.revoke('registry-changed'));
    }
    private revoke(kind: MCPProjectActivationEvent['kind']): void {
        this.launchAbort.abort();
        this.launchAbort = new AbortController();
        const event: MCPProjectActivationEvent = { generation: ++this.generation,
            projectKey: this.projectKey, kind, revokePrevious: true };
        try { this.client.notifyMCPProjectActivationChanged(event); } catch {}
    }
    async switchProject(root?: string): Promise<MCPProjectActivationSnapshot> {
        if (this.disposed) throw new Error('Disposed MCP activation connection');
        this.projectKey = undefined;
        this.projectRoot = undefined;
        this.revoke('project-switch');
        const generation = this.generation;
        const key = root === undefined ? undefined : await mcpProjectKey(root);
        if (generation !== this.generation) throw new Error('MCP project context changed');
        this.projectKey = key;
        this.projectRoot = root;
        return this.current();
    }
    /** Internal backend entry for P5. It never grants MCP tool calls or exposes a launch RPC. */
    async launchContained(serverId: string): Promise<MCPContainedSession> {
        if (this.disposed || !this.projectKey || !this.projectRoot || !this.trustedActiveRoot)
            throw new Error('No trusted active MCP project');
        const generation = this.generation, projectKey = this.projectKey, projectRoot = this.projectRoot;
        const signal = this.launchAbort.signal;
        if (await this.trustedActiveRoot() !== projectRoot || generation !== this.generation)
            throw new Error('MCP active project mismatch');
        const [preferences, registry] = await Promise.all([this.preferences.read(), this.registry.read()]);
        const server = registry.servers.find(item => item.id === serverId);
        if (generation !== this.generation || signal.aborted ||
            !server || server.lifecycle !== 'installed' || server.configStatus !== 'configured' ||
            !server.config.launch || !server.credential ||
            preferences.preferences.find(item => item.projectKey === projectKey &&
                item.serverId === server.id && item.registrationRevision === server.registrationRevision)?.enabled !== true)
            throw new Error('MCP launch unavailable for this project');
        if (await mcpProjectKey(projectRoot) !== projectKey || generation !== this.generation)
            throw new Error('MCP project identity changed');
        const bridgeToken = await this.registry.readBridgeToken(serverId);
        if (generation !== this.generation || signal.aborted ||
            await this.trustedActiveRoot() !== projectRoot) throw new Error('MCP project changed before launch');
        return launchContainedMCPServer({ command: server.config.command,
            installRoot: server.config.launch.installRoot, bridgePort: server.config.launch.bridgePort,
            bridgeToken, environment: server.config.launch.environment, projectRoot, projectKey, signal });
    }
    async current(): Promise<MCPProjectActivationSnapshot> {
        if (this.disposed) throw new Error('Disposed MCP activation connection');
        const generation = this.generation, projectKey = this.projectKey;
        const [preferences, registry] = await Promise.all([this.preferences.read(), this.registry.read()]);
        if (generation !== this.generation) throw new Error('MCP project context changed');
        const servers: MCPProjectServerView[] = registry.servers.map((server: MCPServer) => {
            const selected = preferences.preferences.find(entry => entry.projectKey === projectKey &&
                entry.serverId === server.id && entry.registrationRevision === server.registrationRevision)?.enabled === true;
            const state = mcpProjectServerState(server, selected);
            return { serverId: server.id, registrationRevision: server.registrationRevision,
                state, eligible: state === 'active' };
        });
        if (projectKey) for (const preference of preferences.preferences) {
            if (preference.projectKey === projectKey && !registry.servers.some(server => server.id === preference.serverId))
                servers.push({ serverId: preference.serverId, state: 'uninstalled', eligible: false });
        }
        return { projectKey, preferencesRevision: preferences.revision, registryRevision: registry.revision, servers };
    }
    async setEnabled(request: { projectKey: string; serverId: string; registrationRevision: number;
        expectedRevision: number; enabled: boolean }): Promise<MCPProjectActivationSnapshot> {
        if (this.disposed || !this.projectKey || request.projectKey !== this.projectKey)
            throw new Error('MCP project context mismatch');
        const generation = this.generation;
        const registry = await this.registry.read();
        const server = registry.servers.find(item => item.id === request.serverId);
        if (!server || server.registrationRevision !== request.registrationRevision ||
            server.lifecycle !== 'installed' || server.configStatus !== 'configured')
            throw new Error('MCP server unavailable or registration changed');
        if (generation !== this.generation) throw new Error('MCP project context changed');
        await this.preferences.mutate({ version: MCP_PROJECT_PREFERENCES_VERSION, ...request });
        if (this.projectKey !== request.projectKey) throw new Error('MCP project context changed');
        return this.current();
    }
    dispose(): void {
        if (this.disposed) return;
        this.projectKey = undefined; this.revoke('disposed'); this.disposed = true;
        this.projectRoot = undefined;
        this.unlistenPreferences(); this.unlistenRegistry();
    }
}
