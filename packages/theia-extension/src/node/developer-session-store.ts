import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSessionCollection, parseSessionProjectIdentity } from '@dope/contracts/lib/developer-session';
import type { SessionCollection, SessionProjectIdentity } from '@dope/contracts/lib/developer-session';

const MAX_BYTES = 16 * 1024 * 1024;
const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const uncertain = (error: unknown): Error =>
    new Error(`Development Sessions write outcome uncertain; re-read before retrying: ${String(error)}`);

/** Filesystem only. Session lifecycle and ID allocation belong to the caller. */
export class DeveloperSessionStore {
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
        if (!(await this.regular(file))) return { schemaVersion: 1, project, revision: 0, sessions: [] };
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
        change: (current: SessionCollection) => SessionCollection | Promise<SessionCollection>): Promise<SessionCollection> {
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
            const next = parseSessionCollection(await change(structuredClone(current)));
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
