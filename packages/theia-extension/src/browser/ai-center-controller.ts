import { AI_REGISTRY_VERSION } from '@dope/ai';
import type { AIConnection, AIConnectionConfig, AIRegistryMutation, AIConnectionHealth } from '@dope/ai';
import type { AIModel } from '@dope/ai';
import type { AIRegistryService, AIInventoryState, ProviderSetupDescription } from '@dope/contracts/lib/ai-registry-service';
import type { AICredentialService, AICredentialStatus } from '@dope/contracts/lib/ai-credential-service';
import type { CodexAuthService, CodexAccountStatus } from '@dope/contracts/lib/codex-auth-service';

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
    accounts: CodexAccountStatus[] = [];
    busy = false;
    message = '';
    private serial = 0;

    constructor(private readonly registry: AIRegistryService, private readonly credentials: AICredentialService,
        private readonly changed: () => void, private readonly codex?: CodexAuthService) {}

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
        this.accounts = [];
        this.changed();
        if (!id) return;
        const serial = ++this.serial;
        try {
            const connection = this.state?.registry.connections.find(item => item.id === id);
            if (connection?.config.type === 'codex') {
                if (!this.codex) throw new Error('Codex auth unavailable');
                const accounts = await this.codex.list(id);
                if (serial === this.serial) { this.accounts = accounts; this.changed(); }
            } else {
                const credential = await this.credentials.status(id);
                if (serial === this.serial) { this.credential = credential; this.changed(); }
            }
        } catch {
            if (serial === this.serial) { this.message = 'Account or credential status is unavailable.'; this.changed(); }
        }
    }

    async refreshAccounts(id: string): Promise<boolean> {
        if (!this.codex || this.busy || this.selectedId !== id) return false;
        let signedIn = false;
        const refreshed = await this.run(async () => {
            const accounts = await this.codex!.list(id);
            const connection = this.state?.registry.connections.find(item => item.id === id);
            if (connection?.config.type !== 'codex') throw new Error('Connection unavailable');
            const current = accounts.find(item => item.id === connection.codexAccount?.accountId);
            const active = current?.status === 'signed-in' ? current : accounts.find(item => item.status === 'signed-in') ?? current;
            if (active) await this.setCodexAccount(connection, active);
            signedIn = active?.status === 'signed-in' && active.planUsage === 'available';
        }, 'ChatGPT account status could not be refreshed. Try again.');
        if (refreshed) {
            this.message = signedIn ? 'ChatGPT account authorized. Refresh Models to discover available agent models.' :
                this.accounts.some(item => item.status === 'signed-in') ?
                    'ChatGPT account signed in, but eligible plan use is unavailable.' :
                    'No completed ChatGPT sign-in yet. Finish in your browser, then refresh account status.';
            this.changed();
        }
        return refreshed;
    }

    async selectAccount(connection: AIConnection, account: CodexAccountStatus): Promise<boolean> {
        const selected = await this.run(() => this.setCodexAccount(connection, account), 'ChatGPT account could not be selected.');
        if (selected) { this.message = 'ChatGPT account selected. Refresh Models to discover its available agent models.'; this.changed(); }
        return selected;
    }

    private async setCodexAccount(connection: AIConnection, account: CodexAccountStatus): Promise<void> {
        if (connection.config.type !== 'codex' || account.connectionId !== connection.id) throw new Error('Invalid account');
        const previous = connection.codexAccount;
        if (previous?.accountId === account.id && previous.accountLabel === account.label &&
            previous.clientId === account.clientId && previous.status === account.status && previous.planUsage === account.planUsage) return;
        await this.mutate({ type: 'update-connection', id: connection.id, changes: {
            alias: connection.alias, lifecycle: connection.lifecycle, config: connection.config,
            codexAccount: { accountId: account.id, accountLabel: account.label, clientId: account.clientId,
                status: account.status, planUsage: account.planUsage }
        } });
        if (previous?.accountId !== account.id || account.status !== 'signed-in') {
            const snapshot = await this.registry.list();
            if (snapshot.models.some(model => model.connectionId === connection.id))
                await this.registry.mutate({ version: AI_REGISTRY_VERSION, expectedRevision: snapshot.revision,
                    mutation: { type: 'reconcile-models', connectionId: connection.id, models: [] } });
        }
    }

    async signIn(id: string, registrationId?: string): Promise<boolean> {
        if (!this.codex) return false;
        const started = await this.run(() => this.codex!.signIn(id, registrationId),
            'ChatGPT sign-in could not start. Check secure storage and try again.');
        if (started) { this.message = 'Complete sign-in in your browser, then Refresh account status here.'; this.changed(); }
        return started;
    }

    async signOut(connection: AIConnection, account: CodexAccountStatus): Promise<boolean> {
        if (!this.codex || connection.config.type !== 'codex') return false;
        return this.run(async () => {
            const result = await this.codex!.signOut(connection.id, account.id);
            if (connection.codexAccount?.accountId === account.id)
                await this.setCodexAccount(connection, { ...account, status: 'signed-out', planUsage: 'unavailable' });
            if (!result.revocationConfirmed) this.message = 'Signed out locally; remote revocation could not be confirmed.';
        }, 'Sign-out could not be completed. Try again.');
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

    async verifyLocalAgentExecution(connectionId: string, modelId: string): Promise<boolean> {
        let result: Awaited<ReturnType<AIRegistryService['verifyLocalAgentExecution']>> = 'unavailable';
        const completed = await this.run(async () => {
            result = await this.registry.verifyLocalAgentExecution(connectionId, modelId);
        }, 'Local tool capability probe failed.');
        if (completed) {
            this.message = `Local tool capability: ${result}. Only a successful synthetic tool loop enables Coding Agent eligibility.`;
            this.changed();
        }
        return completed;
    }

    async toggleModel(connectionId: string, providerModelKey: string, enabled: boolean): Promise<boolean> {
        return this.run(() => this.mutate({ type: 'set-model-enabled', connectionId, providerModelKey, enabled }),
            'Model state could not be changed. Try again.');
    }

    async remove(connectionId: string): Promise<boolean> {
        return this.run(async () => {
            if (this.state?.registry.connections.find(connection => connection.id === connectionId)?.config.type === 'codex') {
                if (!this.codex) throw new Error('Codex auth unavailable');
                for (const account of await this.codex.list(connectionId)) await this.codex.disconnect(connectionId, account.id);
                await this.mutate({ type: 'remove-connection', id: connectionId });
                return;
            }
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
