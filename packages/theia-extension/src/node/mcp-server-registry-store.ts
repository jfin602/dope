import { randomUUID } from 'node:crypto';
import { constants, watch, type FSWatcher } from 'node:fs';
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { MCP_SERVER_REGISTRY_VERSION, applyMCPServerRegistryMutation,
    parseMCPServerRegistrySnapshot } from '@dope/ai';
import type { MCPServerRegistryMutationRequest, MCPServerRegistrySnapshot } from '@dope/ai';
import { aiConfigDirectory } from './ai-config-directory';
import { osSecureStore, type SecureCredentialStore } from './ai-credential-manager';

const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const empty = (): MCPServerRegistrySnapshot => ({ version: MCP_SERVER_REGISTRY_VERSION, revision: 0, servers: [] });
const credentialService = 'Dope MCP Servers';

/** One OS-user catalog, separate from AI model connections and project preferences. */
export class MCPServerRegistryStore {
    readonly path: string;
    private readonly lockPath: string;
    private readonly recoveryPath: string;
    private readonly markerPath: string;
    private readonly listeners = new Set<(snapshot: MCPServerRegistrySnapshot) => void>();
    private watcher?: FSWatcher;
    private observedRevision?: number;
    constructor(directory = aiConfigDirectory(),
        private readonly secureStore: () => Promise<SecureCredentialStore | undefined> = osSecureStore) {
        this.path = join(directory, 'mcp-servers.json');
        this.lockPath = join(directory, '.mcp-servers.lock');
        this.recoveryPath = join(directory, '.mcp-servers-recovery.lock');
        this.markerPath = join(directory, '.mcp-servers-initialized');
    }
    onChange(listener: (snapshot: MCPServerRegistrySnapshot) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private publish(snapshot: MCPServerRegistrySnapshot): void {
        if (this.observedRevision === snapshot.revision) return;
        this.observedRevision = snapshot.revision;
        for (const listener of this.listeners) { try { listener(snapshot); } catch {} }
    }
    private async directory(): Promise<void> {
        await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
        if (!(await lstat(dirname(this.path))).isDirectory()) throw new Error('Unsafe MCP registry directory');
    }
    private observe(): void {
        if (this.watcher) return;
        this.watcher = watch(dirname(this.path), (_event, filename) => {
            if (filename?.toString() !== 'mcp-servers.json') return;
            void this.readDisk().then(snapshot => { if (snapshot) this.publish(snapshot); }, () => {});
        });
        this.watcher.on('error', () => { this.watcher?.close(); this.watcher = undefined; });
        this.watcher.unref();
    }
    dispose(): void { this.watcher?.close(); this.watcher = undefined; this.listeners.clear(); }
    /** Backend-only retrieval. A catalog reference never contains the bridge secret. */
    async readBridgeToken(serverId: string): Promise<string> {
        const server = (await this.read()).servers.find(item => item.id === serverId);
        if (!server?.config.launch || server.configStatus !== 'configured' ||
            server.credential?.source !== 'secure' || server.credential.account !== serverId)
            throw new Error('MCP bridge credential unavailable');
        const secure = await this.secureStore().catch(() => undefined);
        if (!secure) throw new Error('MCP bridge credential unavailable');
        const token = await secure.getPassword(credentialService, serverId).catch(() => undefined);
        if (!token || token.length < 32 || token.length > 256 || /[\x00-\x1f\x7f]/u.test(token))
            throw new Error('MCP bridge credential unavailable');
        return token;
    }
    private async safeRead(path: string): Promise<string | undefined> {
        try {
            const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                const info = await handle.stat();
                if (!info.isFile() || info.size > 128 * 1024) throw new Error(`Unsafe MCP registry file: ${path}`);
                return await handle.readFile('utf8');
            } finally { await handle.close(); }
        } catch (error) { if (absent(error)) return undefined; throw error; }
    }
    private async readDisk(): Promise<MCPServerRegistrySnapshot | undefined> {
        const bytes = await this.safeRead(this.path);
        if (bytes === undefined) return undefined;
        try { return parseMCPServerRegistrySnapshot(JSON.parse(bytes)); }
        catch { throw new Error(`Corrupt or unsupported MCP registry: ${this.path}; restore it manually`); }
    }
    async read(): Promise<MCPServerRegistrySnapshot> {
        await this.directory();
        const snapshot = await this.readDisk();
        if (!snapshot && await this.safeRead(this.markerPath) !== undefined)
            throw new Error(`Missing initialized MCP registry: ${this.path}; restore it manually`);
        const result = snapshot ?? empty();
        this.observedRevision ??= result.revision;
        this.observe();
        return result;
    }
    private async replace(snapshot: MCPServerRegistrySnapshot): Promise<void> {
        const temporary = `${this.path}.${randomUUID()}.tmp`;
        let replaced = false;
        try {
            if (await this.safeRead(this.markerPath) === undefined) {
                const marker = await open(this.markerPath, 'wx', 0o600);
                try { await marker.writeFile('1\n'); await marker.sync(); } finally { await marker.close(); }
                const folder = await open(dirname(this.path), 'r');
                try { await folder.sync(); } finally { await folder.close(); }
            }
            const handle = await open(temporary, 'wx', 0o600);
            try { await handle.writeFile(`${JSON.stringify(snapshot, null, 2)}\n`); await handle.sync(); }
            finally { await handle.close(); }
            await this.safeRead(this.path);
            await rename(temporary, this.path);
            replaced = true;
            const folder = await open(dirname(this.path), 'r');
            try { await folder.sync(); } finally { await folder.close(); }
        } catch (error) {
            if (replaced) throw new Error(`MCP registry write outcome uncertain; re-read before retrying: ${String(error)}`);
            throw error;
        } finally { await rm(temporary, { force: true }); }
    }
    private async locked<Result>(work: () => Promise<Result>): Promise<Result> {
        await this.directory();
        let handle: Awaited<ReturnType<typeof open>> | undefined;
        for (let attempt = 0; attempt < 100; attempt++) {
            try {
                handle = await open(this.lockPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                try { await handle.writeFile(`${process.pid}\n`); await handle.sync(); }
                catch (failure) { await handle.close(); await rm(this.lockPath); throw failure; }
                break;
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                const info = await lstat(this.lockPath).catch(() => undefined);
                if (!info) continue;
                if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsafe MCP registry lock: ${this.lockPath}`);
                const owner = (await this.safeRead(this.lockPath))?.trim();
                if (owner === undefined) continue;
                if (/^[1-9]\d*$/.test(owner)) {
                    try { process.kill(Number(owner), 0); }
                    catch (failure) {
                        if ((failure as NodeJS.ErrnoException).code === 'ESRCH') {
                            let recovery: Awaited<ReturnType<typeof open>>;
                            try { recovery = await open(this.recoveryPath, 'wx', 0o600); }
                            catch (recoveryError) {
                                if ((recoveryError as NodeJS.ErrnoException).code === 'EEXIST') {
                                    await new Promise(resolve => setTimeout(resolve, 10)); continue;
                                }
                                throw recoveryError;
                            }
                            try {
                                await recovery.writeFile(`${process.pid}\n`); await recovery.sync();
                                const current = await lstat(this.lockPath).catch(() => undefined);
                                if (current?.ino === info.ino && (await this.safeRead(this.lockPath))?.trim() === owner)
                                    await rm(this.lockPath);
                            } finally { await recovery.close(); await rm(this.recoveryPath); }
                            continue;
                        }
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        if (!handle) throw new Error(`MCP registry locked; inspect ${this.lockPath}`);
        try { return await work(); }
        finally {
            const info = await handle.stat();
            await handle.close();
            if ((await lstat(this.lockPath)).ino !== info.ino) throw new Error('MCP registry lock changed; inspect it');
            await rm(this.lockPath);
        }
    }
    async mutate(request: MCPServerRegistryMutationRequest): Promise<MCPServerRegistrySnapshot> {
        return this.locked(async () => {
            const existing = await this.readDisk();
            if (!existing && await this.safeRead(this.markerPath) !== undefined)
                throw new Error(`Missing initialized MCP registry: ${this.path}; restore it manually`);
            const current = existing ?? empty();
            const next = applyMCPServerRegistryMutation(current, request);
            const changed = request.mutation.type === 'remove' ? undefined : request.mutation.server;
            if (changed?.credential) {
                const secure = await this.secureStore().catch(() => undefined);
                if (!secure) throw new Error('OS secure storage unavailable');
                try {
                    const value = await secure.getPassword(credentialService, changed.id);
                    if (changed.configStatus === 'configured' && !value) throw new Error('MCP credential missing');
                } catch (error) {
                    if (error instanceof Error && error.message === 'MCP credential missing') throw error;
                    throw new Error('OS secure storage unavailable');
                }
            }
            await this.replace(next);
            this.publish(next);
            return next;
        });
    }
}
