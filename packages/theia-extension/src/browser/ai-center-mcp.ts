import { MCP_SERVER_REGISTRY_VERSION } from '@dope/ai';
import type { MCPServer, MCPServerRegistrySnapshot } from '@dope/ai';
import type { MCPServerRegistryService } from '@dope/contracts/lib/mcp-server-registry-service';
import type { MCPProjectActivationService, MCPProjectActivationSnapshot } from '@dope/contracts/lib/mcp-project-activation-service';

/** Presentation adapter only. Registry and project preference writes remain with their existing services. */
export class AICenterMCPController {
    registry?: MCPServerRegistrySnapshot;
    project?: MCPProjectActivationSnapshot;
    credentialStatuses = new Map<string, 'available' | 'missing' | 'unavailable'>();
    message = '';
    busy = false;
    private serial = 0;
    private root?: string;
    constructor(private readonly servers: MCPServerRegistryService, private readonly activation: MCPProjectActivationService,
        private readonly changed: () => void) {}

    async attach(root?: string): Promise<void> {
        if (root !== this.root) {
            this.root = root;
            this.project = undefined;
            const serial = ++this.serial;
            this.changed();
            try {
                const project = await this.activation.switchProject(root);
                if (serial !== this.serial) return;
                this.project = project;
            } catch {
                if (serial !== this.serial) return;
                this.message = 'Project MCP selection is unavailable. Check the workspace and retry.';
            }
        }
        await this.load();
    }

    async load(): Promise<void> {
        const serial = ++this.serial;
        try {
            const [registry, project] = await Promise.all([this.servers.list(), this.activation.current()]);
            const statuses = await Promise.all(registry.servers.map(async server => [server.id,
                await this.servers.bridgeCredentialStatus(server.id).catch(() => 'unavailable' as const)] as const));
            if (serial !== this.serial) return;
            this.registry = registry;
            this.project = project;
            this.credentialStatuses = new Map(statuses);
            this.message = '';
        } catch {
            if (serial !== this.serial) return;
            this.message = 'MCP catalog or project selection is unavailable. Check the configuration and retry.';
        }
        this.changed();
    }

    private async run(action: () => Promise<unknown>, failure: string, success: string): Promise<boolean> {
        if (this.busy) return false;
        this.busy = true; this.message = ''; this.changed();
        try {
            await action();
            await this.load();
            this.message = success;
            return true;
        } catch {
            await this.load();
            this.message = failure;
            return false;
        } finally { this.busy = false; this.changed(); }
    }

    async save(server: MCPServer, creating: boolean): Promise<boolean> {
        return this.run(() => this.servers.mutate({ version: MCP_SERVER_REGISTRY_VERSION,
            expectedRevision: this.registry?.revision ?? -1,
            mutation: creating ? { type: 'create', server: {
                version: server.version, id: server.id, name: server.name, lifecycle: server.lifecycle,
                configStatus: server.configStatus, config: server.config,
                ...(server.credential ? { credential: server.credential } : {}) } } :
                { type: 'update', id: server.id, server } }),
        'Server could not be saved. The catalog may have changed or the configuration may be invalid. Review and retry.',
        creating ? 'Server registered globally. Enable it separately for a project.' : 'Global server configuration saved.');
    }

    async remove(id: string): Promise<boolean> {
        return this.run(() => this.servers.mutate({ version: MCP_SERVER_REGISTRY_VERSION,
            expectedRevision: this.registry?.revision ?? -1, mutation: { type: 'remove', id } }),
        'Server could not be removed. Refresh the catalog and retry.', 'Server removed from the global catalog.');
    }

    async setBridgeToken(server: MCPServer, secret: string): Promise<boolean> {
        return this.run(() => this.servers.replaceBridgeToken(server.id, this.registry?.revision ?? -1, secret),
            'Bridge token could not be saved. Disable a configured server before rotating its token, then refresh and retry.',
            'Bridge token saved in OS secure storage. Review the launch profile before enabling this project.');
    }

    async setEnabled(server: MCPServer, enabled: boolean): Promise<boolean> {
        const project = this.project;
        if (!project?.projectKey) { this.message = 'Open one project to change its MCP selection.'; this.changed(); return false; }
        return this.run(() => this.activation.setEnabled({ projectKey: project.projectKey!, serverId: server.id,
            registrationRevision: server.registrationRevision, expectedRevision: project.preferencesRevision, enabled }),
        'Project selection could not be changed. The project or server may have changed; refresh and retry.',
        enabled ? 'Enabled for this project. Tool calls still require separate authorization.' : 'Disabled for this project.');
    }
}
