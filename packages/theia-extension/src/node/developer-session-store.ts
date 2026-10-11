import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAX_COLLECTION_LINKS, MAX_SESSION_LINKS, parseDeveloperSession, parseSessionArtifactRef,
    parseSessionCollection, parseSessionProjectIdentity, sessionArtifactRefKey } from '@dope/contracts/lib/developer-session';
import type { DeveloperSession, SessionCollection, SessionProjectIdentity } from '@dope/contracts/lib/developer-session';
import type { SessionLinkMutationRequest, SessionMutationRequest, SessionMutationResult } from '@dope/contracts/lib/developer-session-service';

const MAX_BYTES = 16 * 1024 * 1024;
const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const uncertain = (error: unknown): Error =>
    new Error(`Development Sessions write outcome uncertain; re-read before retrying: ${String(error)}`);

/** Filesystem only. Session lifecycle and ID allocation belong to the caller. */
export class DeveloperSessionStore {
    /** Owner validation happens before this call. The lock protects Session membership only. */
    async mutateLink(root: string, projectMindId: string | null, request: SessionLinkMutationRequest,
        action: 'attach' | 'detach', verifyHandle: () => void): Promise<SessionMutationResult> {
        if (!request || !Number.isSafeInteger(request.expectedSessionRevision) || request.expectedSessionRevision < 1 ||
            typeof request.sessionId !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.sessionId) ||
            typeof verifyHandle !== 'function') throw new Error('Invalid Session link request');
        const ref = parseSessionArtifactRef(request.ref);
        const key = sessionArtifactRefKey(ref);
        let changed!: DeveloperSession;
        const snapshot = await this.transact(root, projectMindId, request.expectedCollectionRevision, current => {
            verifyHandle();
            const index = current.sessions.findIndex(session => session.id === request.sessionId);
            if (index < 0) throw new Error('Unknown Development Session');
            const previous = current.sessions[index];
            if (previous.revision !== request.expectedSessionRevision)
                throw new Error('Stale Development Session revision');
            if (previous.status === 'closed') throw new Error('Closed Development Session is immutable until reopened');
            const present = previous.links.some(link => sessionArtifactRefKey(link) === key);
            if (action === 'attach' ? present : !present) {
                changed = previous;
                return null;
            }
            if (action === 'attach' && (previous.links.length >= MAX_SESSION_LINKS ||
                current.sessions.reduce((count, session) => count + session.links.length, 0) >= MAX_COLLECTION_LINKS))
                throw new Error('Too many Session links');
            changed = parseDeveloperSession({ ...previous, revision: previous.revision + 1,
                updatedAt: this.nextInstant(Date.parse(previous.updatedAt)),
                links: action === 'attach' ? [...previous.links, ref] :
                    previous.links.filter(link => sessionArtifactRefKey(link) !== key) });
            const sessions = [...current.sessions];
            sessions[index] = changed;
            return { ...current, revision: current.revision + 1, sessions };
        });
        return { snapshot, session: changed };
    }

    /** Apply one developer-authored lifecycle edit under the collection's atomic revision lock. */
    async mutate(root: string, projectMindId: string | null, request: SessionMutationRequest): Promise<SessionMutationResult> {
        if (!request || !request.operation || !Number.isSafeInteger(request.expectedCollectionRevision) ||
            request.expectedCollectionRevision < 0) throw new Error('Invalid session mutation request');
        const operation = request.operation;
        let changed!: DeveloperSession;
        const snapshot = await this.transact(root, projectMindId, request.expectedCollectionRevision, current => {
            const sessions = [...current.sessions];
            if (operation.type === 'create') {
                if (request.expectedSessionRevision !== null) throw new Error('Create requires no session revision');
                const id = randomUUID();
                if (sessions.some(session => session.id.toLowerCase() === id.toLowerCase())) throw new Error('Duplicate session ID');
                const latest = sessions.reduce((time, session) => Math.max(time, Date.parse(session.updatedAt)), 0);
                const createdAt = this.nextInstant(latest);
                changed = parseDeveloperSession({ schemaVersion: 2, id, project: current.project, revision: 1,
                    title: operation.title, objective: operation.objective, createdAt, updatedAt: createdAt,
                    status: 'active', notes: '', nextActions: [], closeout: null, links: [] });
                sessions.push(changed);
            } else {
                const index = sessions.findIndex(session => session.id === operation.sessionId);
                if (index < 0) throw new Error('Unknown Development Session');
                const previous = sessions[index];
                if (!Number.isSafeInteger(request.expectedSessionRevision) ||
                    request.expectedSessionRevision !== previous.revision) throw new Error('Stale Development Session revision');
                if (previous.status === 'closed' && operation.type !== 'reopen')
                    throw new Error('Closed Development Session is immutable until reopened');
                const updatedAt = this.nextInstant(Date.parse(previous.updatedAt));
                const next: DeveloperSession = { ...previous, revision: previous.revision + 1, updatedAt };
                switch (operation.type) {
                    case 'rename': next.title = operation.title; break;
                    case 'set-objective': next.objective = operation.objective; break;
                    case 'set-notes': next.notes = operation.notes; break;
                    case 'set-next-actions': next.nextActions = operation.nextActions; break;
                    case 'pause':
                        if (previous.status !== 'active') throw new Error('Only an active session can pause');
                        next.status = 'paused'; break;
                    case 'resume':
                        if (previous.status !== 'paused') throw new Error('Only a paused session can resume');
                        next.status = 'active'; break;
                    case 'close':
                        next.status = 'closed';
                        next.closeout = { ...operation.closeout, closedAt: updatedAt }; break;
                    case 'reopen':
                        if (previous.status !== 'closed') throw new Error('Only a closed session can reopen');
                        next.status = 'active'; next.closeout = null; break;
                    default: throw new Error('Unknown Development Session operation');
                }
                changed = parseDeveloperSession(next);
                sessions[index] = changed;
            }
            return { ...current, revision: current.revision + 1, sessions };
        });
        return { snapshot, session: changed };
    }

    private nextInstant(previous: number): string {
        const value = Math.max(Date.now(), previous + 1);
        if (!Number.isFinite(value) || value > 8_640_000_000_000_000)
            throw new Error('Development Session timestamp exhausted');
        return new Date(value).toISOString();
    }

    async root(uri: string): Promise<string> {
        if (typeof uri !== 'string') throw new Error('Development Sessions require a local file folder');
        let rawPath: string;
        try { rawPath = decodeURIComponent(uri.slice('file:'.length).split(/[?#]/, 1)[0]); }
        catch { throw new Error('Invalid Development Sessions file URI'); }
        if (!uri.startsWith('file:') || rawPath.includes('\\') ||
            rawPath.split('/').some(segment => segment === '.' || segment === '..'))
            throw new Error('Unsafe Development Sessions file URI');
        let url: URL;
        try { url = new URL(uri); } catch { throw new Error('Development Sessions require a local file folder'); }
        if (url.protocol !== 'file:' || url.host || url.search || url.hash)
            throw new Error('Development Sessions require a local file folder');
        const root = await realpath(fileURLToPath(url));
        if (!(await stat(root)).isDirectory()) throw new Error('Development Sessions require a folder');
        return root;
    }

    private async paths(root: string) {
        if (typeof root !== 'string' || !isAbsolute(root) || resolve(root) !== root ||
            await realpath(root) !== root || !(await stat(root)).isDirectory())
            throw new Error('Development Sessions require a canonical local root');
        const directory = join(root, '.dope');
        try {
            const info = await lstat(directory);
            if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory)
                throw new Error('Unsafe Development Sessions directory');
        } catch (error) { if (!absent(error)) throw error; }
        const lock = join(directory, 'development-sessions.lock');
        await this.regular(lock);
        return { directory, file: join(directory, 'development-sessions.json'),
            lock };
    }

    private identity(root: string, projectMindId: string | null): SessionProjectIdentity {
        return parseSessionProjectIdentity({ canonicalRoot: root, projectMindId });
    }

    private async regular(path: string): Promise<boolean> {
        try {
            const info = await lstat(path);
            if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsafe Development Sessions file: ${path}`);
            return true;
        } catch (error) { if (absent(error)) return false; throw error; }
    }

    private async readBounded(handle: FileHandle): Promise<string> {
        const info = await handle.stat();
        if (!info.isFile() || info.size > MAX_BYTES) throw new Error('Oversize Development Sessions collection');
        const chunks: Buffer[] = [];
        let size = 0;
        while (true) {
            const chunk = Buffer.allocUnsafe(Math.min(64 * 1024, MAX_BYTES + 1 - size));
            const { bytesRead } = await handle.read(chunk, 0, chunk.length, null);
            if (!bytesRead) break;
            size += bytesRead;
            if (size > MAX_BYTES) throw new Error('Oversize Development Sessions collection');
            chunks.push(chunk.subarray(0, bytesRead));
        }
        return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
    }

    async read(root: string, projectMindId: string | null = null): Promise<SessionCollection> {
        const { directory, file } = await this.paths(root);
        const project = this.identity(root, projectMindId);
        if (!(await this.regular(file))) return { schemaVersion: 2, project, revision: 0, sessions: [] };
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const opened = await handle.stat();
            const named = await lstat(file);
            if (!opened.isFile() || opened.ino !== named.ino || opened.dev !== named.dev ||
                await realpath(directory) !== directory) throw new Error('Unsafe Development Sessions file');
            let collection: SessionCollection;
            try { collection = parseSessionCollection(JSON.parse(await this.readBounded(handle))); }
            catch (error) { throw new Error(`Corrupt or unsupported Development Sessions collection: ${String(error)}`); }
            if (collection.revision === 0 || collection.project.canonicalRoot !== project.canonicalRoot ||
                collection.project.projectMindId !== project.projectMindId)
                throw new Error('Development Sessions project identity changed; reattach or explicitly rebind');
            return collection;
        } finally { await handle.close(); }
    }

    private async acquire(lock: string): Promise<FileHandle> {
        // Existing locks require inspection/recovery; never unlink a lock another writer may own.
        await this.regular(lock);
        let handle: FileHandle;
        try { handle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
                await this.regular(lock);
                throw new Error(`Development Sessions locked; inspect ${lock}`);
            }
            throw error;
        }
        try { await handle.writeFile(`${process.pid} ${randomUUID()}\n`); await handle.sync(); return handle; }
        catch (error) { await this.release(lock, handle); throw error; }
    }

    private async release(lock: string, handle: FileHandle): Promise<void> {
        const owned = await handle.stat();
        await handle.close();
        const current = await lstat(lock);
        if (!current.isFile() || current.isSymbolicLink() || current.dev !== owned.dev || current.ino !== owned.ino)
            throw new Error('Development Sessions lock changed; inspect it');
        await rm(lock);
    }

    private async write(root: string, next: SessionCollection): Promise<void> {
        const { directory, file } = await this.paths(root);
        const temporary = join(directory, `development-sessions.${randomUUID()}.tmp`);
        const bytes = Buffer.from(`${JSON.stringify(next, null, 2)}\n`);
        if (bytes.length > MAX_BYTES) throw new Error('Oversize Development Sessions collection');
        let replaced = false;
        let created = false;
        try {
            const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            created = true;
            try { await handle.writeFile(bytes); await handle.sync(); }
            finally { await handle.close(); }
            await this.paths(root);
            await this.regular(file);
            await rename(temporary, file);
            replaced = true;
            const parent = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
            try { await parent.sync(); } finally { await parent.close(); }
        } catch (error) {
            if (replaced) throw uncertain(error);
            throw error;
        } finally {
            if (created && !replaced) await rm(temporary, { force: true });
        }
    }

    async transact(root: string, projectMindId: string | null, expectedRevision: number,
        change: (current: SessionCollection) => SessionCollection | null | Promise<SessionCollection | null>): Promise<SessionCollection> {
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || typeof change !== 'function')
            throw new Error('Invalid Development Sessions transaction');
        const { directory, lock } = await this.paths(root);
        this.identity(root, projectMindId);
        let created = false;
        try { await lstat(directory); } catch (error) { if (absent(error)) created = true; else throw error; }
        if (created) {
            await mkdir(directory);
            await this.paths(root);
            const parent = await open(root, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
            try { await parent.sync(); } finally { await parent.close(); }
        }
        const handle = await this.acquire(lock);
        let writeStarted = false;
        try {
            const current = await this.read(root, projectMindId);
            if (current.revision !== expectedRevision) throw new Error(`Stale Development Sessions revision; current ${current.revision}`);
            const proposed = await change(structuredClone(current));
            if (proposed === null) return current;
            const next = parseSessionCollection(proposed);
            if (next.project.canonicalRoot !== root || next.project.projectMindId !== projectMindId ||
                next.revision !== current.revision + 1)
                throw new Error('Invalid Development Sessions project identity or next revision');
            writeStarted = true;
            await this.write(root, next);
            return next;
        } finally {
            try { await this.release(lock, handle); }
            catch (error) { if (writeStarted) throw uncertain(error); throw error; }
        }
    }
}
