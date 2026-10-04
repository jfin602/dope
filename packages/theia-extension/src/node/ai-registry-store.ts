import { randomUUID } from 'node:crypto';
import { constants, watch, type FSWatcher } from 'node:fs';
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import { AI_REGISTRY_VERSION, applyAIRegistryMutation, parseAIRegistrySnapshot } from '@dope/ai';
import type { AIConnection, AIRegistryMutationRequest, AIRegistrySnapshot } from '@dope/ai';
import { providerSetup } from './provider-setup';

const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const empty = (): AIRegistrySnapshot => ({ version: AI_REGISTRY_VERSION, revision: 0, connections: [], models: [] });
export const aiConfigDirectory = (): string => join(process.env.XDG_CONFIG_HOME && isAbsolute(process.env.XDG_CONFIG_HOME) ?
    process.env.XDG_CONFIG_HOME : join(homedir(), '.config'), 'dope');

function legacyConnection(value: unknown): AIConnection {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid legacy connection');
    const entry = value as Record<string, unknown>;
    if (Object.keys(entry).some(key => !['id', 'providerId', 'label', 'preferredModelId'].includes(key)) ||
        typeof entry.id !== 'string' || !entry.id.trim() || typeof entry.label !== 'string' || !entry.label.trim() ||
        (entry.preferredModelId !== undefined && (typeof entry.preferredModelId !== 'string' || !entry.preferredModelId.trim())))
        throw new Error('Invalid legacy connection');
    const config = entry.providerId === 'local' ? { type: 'local' as const, runtime: 'lm-studio' as const,
        endpoint: 'http://127.0.0.1:1234/v1' } : entry.providerId === 'openai' ? { type: 'openai' as const } :
        entry.providerId === 'gemini' ? { type: 'gemini' as const } : undefined;
    if (!config) throw new Error(`Unsupported legacy provider: ${String(entry.providerId)}`);
    return { version: AI_REGISTRY_VERSION, id: entry.id, alias: entry.label, lifecycle: 'enabled', config,
        ...(entry.preferredModelId === undefined ? {} : { preferredModelId: entry.preferredModelId as string }) };
}

/** One OS-user registry; project paths are never accepted as input. */
export class AIRegistryStore {
    readonly path: string;
    private readonly legacyPath: string;
    private readonly lockPath: string;
    private readonly recoveryPath: string;
    private readonly markerPath: string;
    private readonly listeners = new Set<(snapshot: AIRegistrySnapshot) => void>();
    private watcher?: FSWatcher;
    private observedRevision?: number;
    constructor(directory = aiConfigDirectory()) {
        this.path = join(directory, 'ai-registry.json');
        this.legacyPath = join(directory, 'model-connections.json');
        this.lockPath = join(directory, '.ai-registry.lock');
        this.recoveryPath = join(directory, '.ai-registry-recovery.lock');
        this.markerPath = join(directory, '.ai-registry-initialized');
    }
    onChange(listener: (snapshot: AIRegistrySnapshot) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private publish(snapshot: AIRegistrySnapshot): void {
        if (this.observedRevision === snapshot.revision) return;
        this.observedRevision = snapshot.revision;
        for (const listener of this.listeners) {
            try { listener(snapshot); } catch { /* An observer cannot undo an accepted write. */ }
        }
    }
    private async directory(): Promise<void> {
        await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
        if (!(await lstat(dirname(this.path))).isDirectory()) throw new Error('Unsafe AI registry directory');
    }
    private observe(): void {
        if (this.watcher) return;
        this.watcher = watch(dirname(this.path), (_event, filename) => {
            if (filename?.toString() !== 'ai-registry.json') return;
            void this.readDisk().then(snapshot => { if (snapshot) this.publish(snapshot); }, () => {
                // A corrupt external replacement is rejected by read/mutate, not rewritten here.
            });
        });
        this.watcher.on('error', () => { this.watcher?.close(); this.watcher = undefined; });
        this.watcher.unref();
    }
    dispose(): void { this.watcher?.close(); this.watcher = undefined; this.listeners.clear(); }
    private async safeRead(path: string): Promise<string | undefined> {
        try {
            const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                if (!(await handle.stat()).isFile()) throw new Error(`Unsafe AI registry file: ${path}`);
                return await handle.readFile('utf8');
            } finally { await handle.close(); }
        } catch (error) { if (absent(error)) return undefined; throw error; }
    }
    private async readDisk(): Promise<AIRegistrySnapshot | undefined> {
        const bytes = await this.safeRead(this.path);
        if (bytes === undefined) return undefined;
        try { return parseAIRegistrySnapshot(JSON.parse(bytes)); }
        catch { throw new Error(`Corrupt or unsupported AI registry: ${this.path}; repair or restore the file manually`); }
    }
    private async initial(): Promise<AIRegistrySnapshot> {
        const bytes = await this.safeRead(this.legacyPath);
        if (bytes === undefined) return empty();
        try {
            const value: unknown = JSON.parse(bytes);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid legacy file');
            const document = value as Record<string, unknown>;
            if (Object.keys(document).sort().join(',') !== 'connections,version' || document.version !== 1 ||
                !Array.isArray(document.connections)) throw new Error('Unsupported legacy file');
            return parseAIRegistrySnapshot({ ...empty(), revision: 1, connections: document.connections.map(legacyConnection) });
        } catch { throw new Error(`Corrupt or unsupported legacy Model Connections: ${this.legacyPath}; repair or restore it manually`); }
    }
    async read(): Promise<AIRegistrySnapshot> {
        await this.directory();
        let snapshot = await this.readDisk();
        if (!snapshot && await this.safeRead(this.markerPath) !== undefined)
            throw new Error(`Missing initialized AI registry: ${this.path}; restore the snapshot manually`);
        if (!snapshot && await this.safeRead(this.legacyPath) !== undefined) {
            snapshot = await this.locked(async () => {
                const existing = await this.readDisk();
                if (existing) return existing;
                if (await this.safeRead(this.markerPath) !== undefined)
                    throw new Error(`Missing initialized AI registry: ${this.path}; restore the snapshot manually`);
                const migrated = await this.initial();
                await this.replace(migrated);
                return migrated;
            });
        }
        snapshot ??= empty();
        this.observedRevision ??= snapshot.revision;
        this.observe();
        return snapshot;
    }
    private async replace(snapshot: AIRegistrySnapshot): Promise<void> {
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
            if (replaced) throw new Error(`AI registry write outcome uncertain; re-read before retrying: ${String(error)}`);
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
                if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsafe AI registry lock: ${this.lockPath}`);
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
                                await recovery.writeFile(`${process.pid}\n`);
                                await recovery.sync();
                                const current = await lstat(this.lockPath).catch(() => undefined);
                                if (current?.ino === info.ino && (await this.safeRead(this.lockPath))?.trim() === owner)
                                    await rm(this.lockPath);
                            } finally {
                                await recovery.close();
                                await rm(this.recoveryPath);
                            }
                            continue;
                        }
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        if (!handle) throw new Error(`AI registry locked; stop writers and inspect ${this.lockPath} and ${this.recoveryPath}`);
        try { return await work(); }
        finally {
            const info = await handle.stat();
            await handle.close();
            if ((await lstat(this.lockPath)).ino !== info.ino) throw new Error('AI registry lock changed; inspect it');
            await rm(this.lockPath);
        }
    }
    async mutate(request: AIRegistryMutationRequest): Promise<AIRegistrySnapshot> {
        return this.locked(async () => {
            const existing = await this.readDisk();
            if (!existing && await this.safeRead(this.markerPath) !== undefined)
                throw new Error(`Missing initialized AI registry: ${this.path}; restore the snapshot manually`);
            const current = existing ?? await this.initial();
            const next = applyAIRegistryMutation(current, request);
            if (request.mutation.type === 'create-connection' || request.mutation.type === 'update-connection') {
                const id = request.mutation.type === 'create-connection' ? request.mutation.connection.id : request.mutation.id;
                const connection = next.connections.find(item => item.id === id)!;
                const previous = current.connections.find(item => item.id === id);
                if (previous && previous.config.type !== connection.config.type && previous.credential &&
                    request.mutation.type === 'update-connection' && request.mutation.changes.credential !== null)
                    throw new Error('Clear the previous provider credential before changing type');
                providerSetup(connection);
            }
            await this.replace(next);
            this.publish(next);
            return next;
        });
    }
}
