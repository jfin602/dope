import { createHash, randomUUID } from 'node:crypto';
import { constants, watch, type FSWatcher } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { applyMCPProjectPreference, MCP_PROJECT_PREFERENCES_VERSION, parseMCPProjectPreferences } from '@dope/ai';
import type { MCPProjectPreferenceMutation, MCPProjectPreferencesSnapshot } from '@dope/ai';
import { aiConfigDirectory } from './ai-config-directory';

const missing = (error: unknown) => (error as NodeJS.ErrnoException).code === 'ENOENT';
const empty = (): MCPProjectPreferencesSnapshot => ({ version: MCP_PROJECT_PREFERENCES_VERSION,
    revision: 0, preferences: [] });

/** Reject lexical aliases and symlink components. Path plus filesystem identity is machine-local. */
export async function mcpProjectKey(root: string): Promise<string> {
    if (!isAbsolute(root) || resolve(root) !== root || root === dirname(root) ||
        root.includes('\0') || await realpath(root) !== root) throw new Error('Unsafe MCP project root');
    const info = await stat(root);
    if (!info.isDirectory()) throw new Error('MCP project root is not a directory');
    return createHash('sha256').update(`${root}\0${info.dev}\0${info.ino}`).digest('hex');
}

/** One OS-user store, never placed in the project or copied with Git. */
export class MCPProjectPreferencesStore {
    readonly path: string;
    private readonly lockPath: string;
    private readonly recoveryPath: string;
    private readonly markerPath: string;
    private readonly listeners = new Set<(snapshot: MCPProjectPreferencesSnapshot) => void>();
    private watcher?: FSWatcher;
    private observedRevision?: number;
    constructor(directory = aiConfigDirectory()) {
        this.path = join(directory, 'mcp-project-preferences.json');
        this.lockPath = join(directory, '.mcp-project-preferences.lock');
        this.recoveryPath = join(directory, '.mcp-project-preferences-recovery.lock');
        this.markerPath = join(directory, '.mcp-project-preferences-initialized');
    }
    onChange(listener: (snapshot: MCPProjectPreferencesSnapshot) => void): () => void {
        this.listeners.add(listener); return () => this.listeners.delete(listener);
    }
    private publish(snapshot: MCPProjectPreferencesSnapshot): void {
        if (this.observedRevision === snapshot.revision) return;
        this.observedRevision = snapshot.revision;
        for (const listener of this.listeners) { try { listener(snapshot); } catch {} }
    }
    private async directory(): Promise<void> {
        await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
        const folder = await lstat(dirname(this.path));
        if (!folder.isDirectory() || folder.isSymbolicLink() || folder.mode & 0o022)
            throw new Error('Unsafe MCP preferences directory');
    }
    private async safeRead(path: string): Promise<string | undefined> {
        try {
            const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                const info = await handle.stat();
                if (!info.isFile() || info.size > 512 * 1024 || info.mode & 0o022)
                    throw new Error('Unsafe MCP preferences file');
                return await handle.readFile('utf8');
            } finally { await handle.close(); }
        } catch (error) { if (missing(error)) return undefined; throw error; }
    }
    private async current(): Promise<MCPProjectPreferencesSnapshot> {
        const bytes = await this.safeRead(this.path);
        if (bytes === undefined) {
            if (await this.safeRead(this.markerPath) !== undefined) throw new Error('Missing initialized MCP project preferences');
            return empty();
        }
        try { return parseMCPProjectPreferences(JSON.parse(bytes)); }
        catch { throw new Error('Corrupt or unsupported MCP project preferences; restore manually'); }
    }
    private observe(): void {
        if (this.watcher) return;
        this.watcher = watch(dirname(this.path), (_event, filename) => {
            if (filename?.toString() !== 'mcp-project-preferences.json') return;
            void this.current().then(snapshot => this.publish(snapshot), () => {});
        });
        this.watcher.on('error', () => { this.watcher?.close(); this.watcher = undefined; });
        this.watcher.unref();
    }
    dispose(): void { this.watcher?.close(); this.watcher = undefined; this.listeners.clear(); }
    async read(): Promise<MCPProjectPreferencesSnapshot> {
        await this.directory();
        const result = await this.current();
        this.observedRevision ??= result.revision;
        this.observe();
        return result;
    }
    private async replace(next: MCPProjectPreferencesSnapshot): Promise<void> {
        const temporary = `${this.path}.${randomUUID()}.tmp`;
        let replaced = false;
        try {
            if (await this.safeRead(this.markerPath) === undefined) {
                const marker = await open(this.markerPath, 'wx', 0o600);
                try { await marker.writeFile('1\n'); await marker.sync(); } finally { await marker.close(); }
            }
            const handle = await open(temporary, 'wx', 0o600);
            try { await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`); await handle.sync(); }
            finally { await handle.close(); }
            await this.safeRead(this.path);
            await rename(temporary, this.path);
            replaced = true;
            const folder = await open(dirname(this.path), 'r');
            try { await folder.sync(); } finally { await folder.close(); }
        } catch (error) {
            if (replaced) throw new Error(`MCP preference write outcome uncertain; re-read before retry: ${String(error)}`);
            throw error;
        } finally { await rm(temporary, { force: true }); }
    }
    private async locked<T>(work: () => Promise<T>): Promise<T> {
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
                const lock = await lstat(this.lockPath).catch(() => undefined);
                if (!lock) continue;
                if (!lock.isFile() || lock.isSymbolicLink()) throw new Error('Unsafe MCP preferences lock');
                const owner = (await this.safeRead(this.lockPath))?.trim();
                if (owner && /^[1-9]\d*$/.test(owner)) {
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
                                if (current?.ino === lock.ino && (await this.safeRead(this.lockPath))?.trim() === owner)
                                    await rm(this.lockPath);
                            } finally { await recovery.close(); await rm(this.recoveryPath); }
                            continue;
                        }
                    }
                }
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }
        if (!handle) throw new Error('MCP preferences locked');
        try { return await work(); }
        finally {
            const info = await handle.stat(); await handle.close();
            if ((await lstat(this.lockPath)).ino !== info.ino) throw new Error('MCP preferences lock changed');
            await rm(this.lockPath);
        }
    }
    async mutate(request: MCPProjectPreferenceMutation): Promise<MCPProjectPreferencesSnapshot> {
        return this.locked(async () => {
            const next = applyMCPProjectPreference(await this.current(), request);
            await this.replace(next);
            this.publish(next);
            return next;
        });
    }
}
