import { randomUUID } from 'node:crypto';
import { constants, watch, type FSWatcher } from 'node:fs';
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { AI_ROLE_IDS, AI_ROLE_POLICY_VERSION, parseAIRolePolicyMutationRequest,
    parseAIRolePolicySnapshot } from '@dope/ai';
import type { AIRolePolicyMutationRequest, AIRolePolicySnapshot } from '@dope/ai';
import { aiConfigDirectory } from './ai-config-directory';

const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const initial = (): AIRolePolicySnapshot => ({ version: AI_ROLE_POLICY_VERSION, revision: 0,
    policies: AI_ROLE_IDS.map(roleId => ({ roleId, fallbacks: [], hard: {
        requiredCapabilities: [], locality: 'any', enabledOnly: true, usableOnly: true,
        hostedProjectData: 'requires-feature-authorization' }, preferences: [], allowFallback: false })) });

export class AIRolePolicyStore {
    readonly path: string;
    private readonly lockPath: string;
    private readonly recoveryPath: string;
    private readonly markerPath: string;
    private readonly listeners = new Set<(snapshot: AIRolePolicySnapshot) => void>();
    private watcher?: FSWatcher;
    private observedRevision?: number;
    constructor(directory = aiConfigDirectory()) {
        this.path = join(directory, 'ai-role-policy.json');
        this.lockPath = join(directory, '.ai-role-policy.lock');
        this.recoveryPath = join(directory, '.ai-role-policy-recovery.lock');
        this.markerPath = join(directory, '.ai-role-policy-initialized');
    }
    onChange(listener: (snapshot: AIRolePolicySnapshot) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private publish(snapshot: AIRolePolicySnapshot): void {
        if (this.observedRevision === snapshot.revision) return;
        this.observedRevision = snapshot.revision;
        for (const listener of this.listeners) {
            try { listener(snapshot); } catch {}
        }
    }
    private async directory(): Promise<void> {
        await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
        if (!(await lstat(dirname(this.path))).isDirectory()) throw new Error('Unsafe AI role policy directory');
    }
    private observe(): void {
        if (this.watcher) return;
        this.watcher = watch(dirname(this.path), (_event, filename) => {
            if (filename?.toString() !== 'ai-role-policy.json') return;
            void this.readDisk().then(snapshot => { if (snapshot) this.publish(snapshot); }, () => {});
        });
        this.watcher.on('error', () => { this.watcher?.close(); this.watcher = undefined; });
        this.watcher.unref();
    }
    dispose(): void { this.watcher?.close(); this.watcher = undefined; this.listeners.clear(); }
    private async safeRead(path: string): Promise<string | undefined> {
        try {
            const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                if (!(await handle.stat()).isFile()) throw new Error(`Unsafe AI role policy file: ${path}`);
                return await handle.readFile('utf8');
            } finally { await handle.close(); }
        } catch (error) { if (absent(error)) return undefined; throw error; }
    }
    private async readDisk(): Promise<AIRolePolicySnapshot | undefined> {
        const bytes = await this.safeRead(this.path);
        if (bytes === undefined) return undefined;
        try { return parseAIRolePolicySnapshot(JSON.parse(bytes)); }
        catch { throw new Error(`Corrupt or unsupported AI role policy: ${this.path}; repair or restore it manually`); }
    }
    private async current(): Promise<AIRolePolicySnapshot> {
        const snapshot = await this.readDisk();
        if (snapshot) return snapshot;
        if (await this.safeRead(this.markerPath) !== undefined)
            throw new Error(`Missing initialized AI role policy: ${this.path}; restore it manually`);
        return initial();
    }
    async read(): Promise<AIRolePolicySnapshot> {
        await this.directory();
        const snapshot = await this.current();
        this.observedRevision ??= snapshot.revision;
        this.observe();
        return snapshot;
    }
    private async replace(snapshot: AIRolePolicySnapshot): Promise<void> {
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
            if (replaced) throw new Error(`AI role policy write outcome uncertain; re-read before retrying: ${String(error)}`);
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
                if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsafe AI role policy lock: ${this.lockPath}`);
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
        if (!handle) throw new Error(`AI role policy locked; inspect ${this.lockPath} and ${this.recoveryPath}`);
        try { return await work(); }
        finally {
            const info = await handle.stat();
            await handle.close();
            if ((await lstat(this.lockPath)).ino !== info.ino) throw new Error('AI role policy lock changed; inspect it');
            await rm(this.lockPath);
        }
    }
    async mutate(request: AIRolePolicyMutationRequest): Promise<AIRolePolicySnapshot> {
        return this.locked(async () => {
            const current = await this.current();
            const parsed = parseAIRolePolicyMutationRequest(request);
            if (parsed.expectedRevision !== current.revision) throw new Error('Stale AI role policy revision');
            const index = AI_ROLE_IDS.indexOf(parsed.policy.roleId);
            const previous = current.policies[index];
            const entries = [previous.preferred, ...previous.fallbacks].filter(entry => entry?.type === 'exact');
            const retain = (entry: typeof parsed.policy.preferred) => {
                if (entry?.type !== 'exact' || entry.lastKnown) return entry;
                const known = entries.find(old => old?.type === 'exact' && old.target.connectionId === entry.target.connectionId &&
                    old.target.modelId === entry.target.modelId);
                return known?.type === 'exact' && known.lastKnown ? { ...entry, lastKnown: known.lastKnown } : entry;
            };
            const policy = { ...parsed.policy, preferred: retain(parsed.policy.preferred),
                fallbacks: parsed.policy.fallbacks.map(retain) };
            const next = parseAIRolePolicySnapshot({ version: AI_ROLE_POLICY_VERSION, revision: current.revision + 1,
                policies: current.policies.map((existing, position) => position === index ? policy : existing) });
            await this.replace(next);
            this.publish(next);
            return next;
        });
    }
}
