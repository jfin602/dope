import { AI_REGISTRY_VERSION } from '@dope/ai';
import type { AIConnection, AIConnectionConfig, AIRegistryMutation, AIConnectionHealth } from '@dope/ai';
import type { AIModel } from '@dope/ai';
import type { AIRegistryService, AIInventoryState, ProviderSetupDescription } from '@dope/contracts/lib/ai-registry-service';
import type { AICredentialService, AICredentialStatus } from '@dope/contracts/lib/ai-credential-service';

export function connectionHealth(state: AIInventoryState, connection: AIConnection): AIConnectionHealth {
    return connection.lifecycle === 'disabled' ? 'disabled' :
        state.observations.find(item => item.connectionId === connection.id)?.health ?? 'unknown';
}

export function connectionWarning(state: AIInventoryState): boolean {
    return state.registry.connections.some(connection =>
        ['needs-authentication', 'invalid-configuration', 'unavailable', 'degraded'].includes(connectionHealth(state, connection)));
}

export function usableModelSummary(models: readonly AIModel[], connection: AIConnection): string {
    models = models.filter(model => model.connectionId === connection.id);
    return models.length ? `${models.length} usable ${models.length === 1 ? 'model' : 'models'}` : 'No usable models';
}

export class AICenterController {
    state?: AIInventoryState;
    usableModels: AIModel[] = [];
    setups: ProviderSetupDescription[] = [];
    selectedId?: string;
    credential?: AICredentialStatus;
    busy = false;
    message = '';
    private serial = 0;

    constructor(private readonly registry: AIRegistryService, private readonly credentials: AICredentialService,
        private readonly changed: () => void) {}

    async load(): Promise<void> {
        const serial = ++this.serial;
        try {
            const [state, setups, eligible] = await Promise.all([this.registry.inventory(), this.registry.providerSetups(),
                this.registry.findEligibleModels({ usableOnly: true })]);
            if (serial !== this.serial) return;
            this.state = state;
            this.usableModels = eligible.models;
            this.setups = setups;
            if (this.selectedId && !state.registry.connections.some(connection => connection.id === this.selectedId)) this.selectedId = undefined;
            await this.select(this.selectedId ?? state.registry.connections[0]?.id);
        } catch {
            if (serial === this.serial) { this.message = 'AI connections could not be loaded. Try again.'; this.changed(); }
        }
    }

    async select(id?: string): Promise<void> {
        this.selectedId = id;
        this.credential = undefined;
        this.changed();
        if (!id) return;
        const serial = ++this.serial;
        try {
            const credential = await this.credentials.status(id);
            if (serial === this.serial) { this.credential = credential; this.changed(); }
        } catch {
            if (serial === this.serial) { this.message = 'Credential status is unavailable.'; this.changed(); }
        }
    }

    async run(action: () => Promise<unknown>, failure: string): Promise<boolean> {
        if (this.busy) return false;
        this.busy = true;
        this.message = '';
        this.changed();
        try {
            await action();
            await this.load();
            return true;
        } catch {
            await this.load();
            this.message = failure;
            return false;
        } finally {
            this.busy = false;
            this.changed();
        }
    }

    async mutate(mutation: AIRegistryMutation): Promise<void> {
        const revision = this.state?.registry.revision ?? (await this.registry.list()).revision;
        await this.registry.mutate({ version: AI_REGISTRY_VERSION, expectedRevision: revision, mutation });
    }

    async save(connection: AIConnection, creating: boolean, secret?: string, source?: 'session' | 'secure'): Promise<boolean> {
        return this.run(async () => {
            await this.mutate(creating ? { type: 'create-connection', connection } :
                { type: 'update-connection', id: connection.id, changes: {
                    alias: connection.alias, lifecycle: connection.lifecycle, config: connection.config,
                    preferredModelId: connection.preferredModelId ?? null, credential: connection.credential ?? null } });
            if (secret && source) await this.credentials.replace(connection.id, source, secret);
            this.selectedId = connection.id;
        }, 'Connection or credential could not be saved. Review its fields and status before retrying.');
    }

    async check(id: string, kind: 'refresh' | 'reconnect' | 'test'): Promise<boolean> {
        return this.run(async () => {
            if (kind === 'test') await this.registry.testConnection(id);
            else if (kind === 'reconnect') await this.registry.reconnect(id);
            else await this.registry.refreshModels(id);
        }, 'Connection check failed. Review its configuration and credentials.');
    }

    async toggleModel(connectionId: string, providerModelKey: string, enabled: boolean): Promise<boolean> {
        return this.run(() => this.mutate({ type: 'set-model-enabled', connectionId, providerModelKey, enabled }),
            'Model state could not be changed. Try again.');
    }

    async remove(connectionId: string): Promise<boolean> {
        return this.run(async () => {
            const status = await this.credentials.status(connectionId);
            if (this.state?.registry.connections.find(connection => connection.id === connectionId)?.credential?.source === 'secure' &&
                status.sources.find(source => source.source === 'secure')?.status === 'unavailable')
                throw new Error('Secure storage unavailable');
            for (const source of status.sources) if (source.status === 'available' && source.source !== 'environment')
                await this.credentials.remove(connectionId, source.source);
            await this.mutate({ type: 'remove-connection', id: connectionId });
        },
            'Connection could not be removed. Try again.');
    }

    async detectLocal(): Promise<AIConnectionConfig | undefined> { return this.registry.detectLocalRuntime(); }
    async testDisclosure(id: string): Promise<boolean> {
        return (await this.registry.testConnectionDisclosure(id)).hostedCostPossible;
    }
}
