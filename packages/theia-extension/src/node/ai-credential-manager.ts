import type { AIConnection, AIConnectionId } from '@dope/ai';
import type { AICredentialStatus } from '@dope/contracts/lib/ai-credential-service';
import { AIRegistryStore } from './ai-registry-store';
import { providerEnvironmentName, providerSetupAdapters } from './provider-setup';

export interface SecureCredentialStore {
    getPassword(service: string, account: string): Promise<string | null | undefined>;
    setPassword(service: string, account: string, secret: string): Promise<unknown>;
    deletePassword(service: string, account: string): Promise<unknown>;
    findCredentials(service: string): Promise<unknown>;
}

const service = 'Dope AI Connections';
const legacyService = 'Dope Gemini';
const legacyAccount = 'AI Studio API key';

export async function osSecureStore(): Promise<SecureCredentialStore | undefined> {
    try {
        const keytar: SecureCredentialStore = require('keytar');
        await keytar.findCredentials('Dope AI keyring availability');
        return keytar;
    } catch { return undefined; }
}

export class AICredentialManager {
    private readonly session = new Map<string, string>();
    private readonly listeners = new Set<(connectionId: string) => void>();
    constructor(private readonly registry: Pick<AIRegistryStore, 'read'>,
        private readonly secureStore: () => Promise<SecureCredentialStore | undefined> = osSecureStore,
        private readonly environment: NodeJS.ProcessEnv = process.env) {}

    onChange(listener: (connectionId: string) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private changed(id: string): void {
        for (const listener of this.listeners) { try { listener(id); } catch {} }
    }
    private async connection(id: AIConnectionId): Promise<AIConnection> {
        if (typeof id !== 'string' || !id.trim()) throw new Error('Invalid connection ID');
        const connection = (await this.registry.read()).connections.find(item => item.id === id);
        if (!connection) throw new Error('Unknown connection');
        return connection;
    }
    private async store(): Promise<SecureCredentialStore | undefined> {
        try { return await this.secureStore(); } catch { return undefined; }
    }
    private async secureValue(store: SecureCredentialStore, id: string): Promise<string | undefined> {
        try { return (await store.getPassword(service, id)) || undefined; }
        catch { throw new Error('OS secure storage unavailable'); }
    }
    async status(id: AIConnectionId): Promise<AICredentialStatus> {
        const connection = await this.connection(id);
        const name = providerEnvironmentName(connection);
        const store = await this.store();
        let secure: string | undefined;
        let secureAvailable = !!store;
        if (store) {
            try { secure = await this.secureValue(store, id); }
            catch { secureAvailable = false; }
        }
        const sources: AICredentialStatus['sources'] = [];
        if (name) sources.push({ source: 'environment', name, status: this.environment[name]?.trim() ? 'available' : 'missing' });
        sources.push({ source: 'session', status: this.session.has(id) ? 'available' : 'missing' });
        sources.push({ source: 'secure', status: !secureAvailable ? 'unavailable' : secure ? 'available' : 'missing' });
        const preferred = connection.credential?.source;
        const candidates = preferred ? [preferred] : providerSetupAdapters[connection.config.type].credential === 'optional' ?
            [] : ['session', 'secure', 'environment'] as const;
        const effectiveSource = candidates.find(source =>
            sources.some(item => item.source === source && item.status === 'available'));
        return { connectionId: id, effectiveSource, sources };
    }
    async replace(id: AIConnectionId, source: 'session' | 'secure', secret: string): Promise<AICredentialStatus> {
        await this.connection(id);
        if (source !== 'session' && source !== 'secure') throw new Error('Invalid credential source');
        if (typeof secret !== 'string' || !secret.trim()) throw new Error('Invalid credential');
        if (source === 'session') this.session.set(id, secret);
        else {
            const store = await this.store();
            if (!store) throw new Error('OS secure storage unavailable');
            try { await store.setPassword(service, id, secret); }
            catch { throw new Error('OS secure storage unavailable'); }
        }
        this.changed(id);
        return this.status(id);
    }
    async remove(id: AIConnectionId, source: 'session' | 'secure'): Promise<AICredentialStatus> {
        await this.connection(id);
        if (source === 'session') this.session.delete(id);
        else if (source === 'secure') {
            const store = await this.store();
            if (!store) throw new Error('OS secure storage unavailable');
            try { await store.deletePassword(service, id); }
            catch { throw new Error('OS secure storage unavailable'); }
        } else throw new Error('Invalid credential source');
        this.changed(id);
        return this.status(id);
    }
    async readForExecution(id: AIConnectionId): Promise<string | undefined> {
        const connection = await this.connection(id);
        const preferred = connection.credential?.source;
        if ((!preferred || preferred === 'session') && this.session.has(id)) return this.session.get(id);
        if (preferred === 'session') return undefined;
        const store = await this.store();
        if (preferred === 'secure' && !store) throw new Error('OS secure storage unavailable');
        const secure = store && await this.secureValue(store, id);
        if (preferred === 'secure') return secure || undefined;
        const name = providerEnvironmentName(connection);
        return preferred === 'environment' ? (name ? this.environment[name]?.trim() : undefined) :
            secure || (name ? this.environment[name]?.trim() : undefined);
    }
    async reuseSoftwareMapGemini(id: AIConnectionId): Promise<boolean> {
        const connection = await this.connection(id);
        if (connection.config.type !== 'gemini') throw new Error('Invalid credential migration target');
        const store = await this.store();
        if (!store) throw new Error('OS secure storage unavailable');
        try {
            if (await store.getPassword(service, id)) return false;
            const legacy = await store.getPassword(legacyService, legacyAccount);
            if (!legacy) return false;
            await store.setPassword(service, id, legacy);
        } catch { throw new Error('OS secure storage unavailable'); }
        this.changed(id);
        return true;
    }
}
