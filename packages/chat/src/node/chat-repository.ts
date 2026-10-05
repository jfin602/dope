import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, rename, rm, rmdir, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assignedChatColor, compareChatsByInteraction, isChatFolderWithin, joinChatFolderPath, parseChat,
    parseChatCollection, parseChatColor, parseChatFolderPath, parseChatMessage, parseChatSettings, withAutomaticChatTitle } from '../index';
import type { Chat, ChatCollection, ChatFolder } from '../index';
import type { ChatEvent, ChatLeaseResult, ChatOperation, ChatSearchHit } from '../service';

const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const DEFAULT_SETTINGS = { schemaVersion: 1 as const, modelPolicy: { type: 'follow-interactive' as const }, context: { maxInputTokens: 8192, reservedOutputTokens: 1024,
    history: 'recent' as const, savedChatSearch: false, allowedSources: [] } };
const interrupted = 'Interrupted before completion';
const leaseDuration = 60_000;
type Entry = { id: string; folderPath: string; file: string; revision: number };
type Manifest = { schemaVersion: 1; revision: number; folders: ChatFolder[]; entries: Entry[] };
type Lease = { schemaVersion: 1; chatId: string; ownerId: string; token: string; pid: number; expiresAt: number; root: string };
type RepositoryEvent = ChatEvent extends infer E ? E extends ChatEvent ? Omit<E, 'projectHandle'> : never : never;

function uuid(value: unknown): string {
    if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
        throw new Error('Invalid Chat ID');
    return value;
}
function revision(value: unknown): number {
    if (!Number.isSafeInteger(value) || (value as number) < 0) throw new Error('Invalid Chat revision');
    return value as number;
}
function parseManifest(value: unknown): Manifest {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Chat manifest');
    const v = value as Record<string, unknown>;
    if (Object.keys(v).sort().join(',') !== 'entries,folders,revision,schemaVersion' || v.schemaVersion !== 1 ||
        !Array.isArray(v.folders) || !Array.isArray(v.entries)) throw new Error('Unsupported Chat manifest');
    const entries = v.entries.map((item: unknown): Entry => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Invalid Chat entry');
        const e = item as Record<string, unknown>;
        if (Object.keys(e).sort().join(',') !== 'file,folderPath,id,revision') throw new Error('Invalid Chat entry');
        const id = uuid(e.id), folderPath = parseChatFolderPath(e.folderPath), rev = revision(e.revision);
        if (typeof e.file !== 'string' || !new RegExp(`^${id}\\.${rev}\\.[0-9a-f-]{36}\\.json$`, 'i').test(e.file))
            throw new Error('Invalid Chat filename');
        return { id, folderPath, file: e.file, revision: rev };
    });
    const folders = parseChatCollection({ schemaVersion: 1, revision: v.revision, folders: v.folders,
        chats: [] }).folders;
    if (new Set(entries.map(e => e.id)).size !== entries.length ||
        entries.some(e => e.folderPath && !folders.some(f => f.path === e.folderPath))) throw new Error('Invalid Chat entries');
    return { schemaVersion: 1, revision: revision(v.revision), folders, entries };
}
function parseLease(value: unknown): Lease {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Chat lease');
    const v = value as Record<string, unknown>;
    if (Object.keys(v).sort().join(',') !== 'chatId,expiresAt,ownerId,pid,root,schemaVersion,token' || v.schemaVersion !== 1 ||
        typeof v.ownerId !== 'string' || !v.ownerId.trim() || typeof v.token !== 'string' || !v.token.trim() ||
        typeof v.root !== 'string' || !isAbsolute(v.root) ||
        !Number.isSafeInteger(v.pid) || (v.pid as number) < 1 || !Number.isSafeInteger(v.expiresAt)) throw new Error('Invalid Chat lease');
    return v as Lease;
}
function live(pid: number): boolean {
    try { process.kill(pid, 0); return true; }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false; throw error; }
}
async function regular(path: string): Promise<boolean> {
    try { const info = await lstat(path); if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsafe Chat file: ${path}`); return true; }
    catch (error) { if (absent(error)) return false; throw error; }
}
async function safeText(path: string): Promise<string> {
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        if (!(await handle.stat()).isFile()) throw new Error(`Unsafe Chat file: ${path}`);
        return await handle.readFile('utf8');
    } finally { await handle.close(); }
}
async function directory(path: string, create = false): Promise<boolean> {
    try {
        const info = await lstat(path);
        if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path) throw new Error(`Unsafe Chat directory: ${path}`);
        return true;
    } catch (error) {
        if (!absent(error)) throw error;
        if (!create) return false;
        await mkdir(path);
        const parent = await open(resolve(path, '..'), 'r');
        try { await parent.sync(); } finally { await parent.close(); }
        return directory(path);
    }
}
async function syncedJson(path: string, value: unknown): Promise<void> {
    const temporary = `${path}.${randomUUID()}.tmp`;
    let replaced = false;
    try {
        const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try { await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`); await handle.sync(); } finally { await handle.close(); }
        await regular(path);
        await rename(temporary, path);
        replaced = true;
        const parent = await open(resolve(path, '..'), 'r');
        try { await parent.sync(); } finally { await parent.close(); }
    } catch (error) {
        if (replaced) throw new Error(`Chat write outcome uncertain; re-read before retrying: ${String(error)}`);
        throw error;
    } finally { await rm(temporary, { force: true }); }
}

export class ChatRepository {
    private readonly listeners = new Set<(root: string, event: RepositoryEvent) => void>();
    onChange(listener: (root: string, event: RepositoryEvent) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
    private emit(root: string, event: RepositoryEvent): void {
        for (const listener of this.listeners) {
            try { listener(root, event); } catch { /* A disconnected client cannot undo a committed write. */ }
        }
    }
    async root(uri: string): Promise<string> {
        if (typeof uri !== 'string') throw new Error('Chat requires a local folder');
        let url: URL;
        try { url = new URL(uri); } catch { throw new Error('Chat requires a local folder'); }
        if (url.protocol !== 'file:' || url.host) throw new Error('Chat requires a local folder');
        const root = await realpath(fileURLToPath(url));
        if (!(await stat(root)).isDirectory()) throw new Error('Chat requires a folder');
        return root;
    }
    private async paths(root: string, create = false) {
        if (typeof root !== 'string' || !isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root ||
            !(await stat(root)).isDirectory()) throw new Error('Chat requires a canonical local root');
        const dope = join(root, '.dope'), base = join(dope, 'chats');
        if (!await directory(dope, create)) return { base, exists: false };
        if (!await directory(base, create)) return { base, exists: false };
        return { base, exists: true };
    }
    private async folder(base: string, path: string, create = false): Promise<string> {
        parseChatFolderPath(path);
        let at = join(base, 'folders');
        if (!await directory(at, create)) throw new Error('Missing Chat folders directory');
        for (const part of path ? path.split('/') : []) {
            at = join(at, part);
            if (!await directory(at, create)) throw new Error(`Missing Chat folder: ${path}`);
        }
        return at;
    }
    private async manifest(base: string): Promise<Manifest> {
        const path = join(base, 'index.json');
        if (!await regular(path)) {
            const folders = join(base, 'folders');
            if ((await directory(folders)) && (await readdir(folders)).length) throw new Error(`Missing Chat manifest: ${path}`);
            return { schemaVersion: 1, revision: 0, folders: [], entries: [] };
        }
        try { return parseManifest(JSON.parse(await safeText(path))); }
        catch { throw new Error(`Corrupt or unsupported Chat manifest: ${path}`); }
    }
    private async raw(root: string, legacyIds = new Set<string>()): Promise<ChatCollection> {
        const { base, exists } = await this.paths(root);
        if (!exists) return { schemaVersion: 1, revision: 0, folders: [], chats: [] };
        const manifest = await this.manifest(base);
        for (const folder of manifest.folders) await this.folder(base, folder.path);
        const chats: Chat[] = [];
        for (const entry of manifest.entries) {
            const parent = await this.folder(base, entry.folderPath);
            const file = join(parent, entry.file);
            if (!await regular(file)) throw new Error(`Missing Chat file: ${file}`);
            let chat: Chat;
            try {
                const stored = JSON.parse(await safeText(file));
                if (stored && typeof stored === 'object' && !Array.isArray(stored) &&
                    (!Object.hasOwn(stored, 'color') || !Object.hasOwn(stored.settings ?? {}, 'modelPolicy'))) {
                    chat = parseChat({ ...stored, color: stored.color ?? assignedChatColor(stored.id) });
                    legacyIds.add(chat.id);
                } else chat = parseChat(stored);
            }
            catch { throw new Error(`Corrupt or unsupported Chat file: ${file}`); }
            if (chat.id !== entry.id || chat.folderPath !== entry.folderPath || chat.revision !== entry.revision)
                throw new Error(`Chat manifest/file mismatch: ${file}`);
            chats.push(chat);
        }
        return parseChatCollection({ schemaVersion: 1, revision: manifest.revision, folders: manifest.folders, chats });
    }
    private async acquire(base: string): Promise<import('node:fs/promises').FileHandle> {
        const path = join(base, '.mutation.lock');
        for (let attempt = 0; attempt < 100; attempt++) {
            try {
                const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                try { await handle.writeFile(`${process.pid}\n`); await handle.sync(); return handle; }
                catch (error) { await handle.close(); await rm(path); throw error; }
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                if (!await regular(path)) { await new Promise(resolve => setTimeout(resolve, 10)); continue; }
                const info = await lstat(path);
                const owner = (await safeText(path)).trim();
                if (!/^[1-9]\d*$/.test(owner) || live(Number(owner))) {
                    await new Promise(resolve => setTimeout(resolve, 10));
                    continue;
                }
                // ponytail: PID locks assume no PID reuse; use OS file locks if collisions become practical.
                if ((await lstat(path)).ino !== info.ino) throw new Error('Chat lock changed; retry');
                await rm(path);
            }
        }
        throw new Error('Chat locked; retry');
    }
    private async locked<T>(root: string, work: (base: string) => Promise<T>): Promise<T> {
        const { base } = await this.paths(root, true);
        const handle = await this.acquire(base);
        try { return await work(base); }
        finally {
            const info = await handle.stat(); await handle.close();
            const path = join(base, '.mutation.lock');
            try { if ((await lstat(path)).ino !== info.ino) throw new Error('Chat lock changed; inspect it'); await rm(path); }
            catch (error) { if (!absent(error)) throw error; }
        }
    }
    private async lease(base: string, chatId: string): Promise<Lease | undefined> {
        const dir = join(base, '.leases');
        if (!await directory(dir)) return undefined;
        const file = join(dir, `${uuid(chatId)}.json`);
        if (!await regular(file)) return undefined;
        let lease: Lease;
        try { lease = parseLease(JSON.parse(await safeText(file))); }
        catch { throw new Error(`Corrupt Chat lease: ${file}`); }
        if (lease.chatId !== chatId) throw new Error(`Chat lease identity mismatch: ${file}`);
        // A copied project carries conversation state, never the original project's live ownership.
        return lease.root === base ? lease : undefined;
    }
    private active(lease: Lease | undefined): lease is Lease { return !!lease && lease.expiresAt > Date.now() && live(lease.pid); }
    private async write(root: string, next: ChatCollection): Promise<void> {
        const { base } = await this.paths(root, true);
        const current = await this.manifest(base);
        if (current.revision !== next.revision - 1) throw new Error('Chat manifest changed during mutation; re-read before retrying');
        const previous = new Map(current.entries.map(e => [e.id, e]));
        const entries: Entry[] = [];
        for (const folder of next.folders) await this.folder(base, folder.path, true);
        for (const chat of next.chats) {
            const old = previous.get(chat.id);
            if (old && old.folderPath === chat.folderPath && old.revision === chat.revision) { entries.push(old); continue; }
            const parent = await this.folder(base, chat.folderPath, true);
            const file = `${chat.id}.${chat.revision}.${randomUUID()}.json`;
            await syncedJson(join(parent, file), chat);
            entries.push({ id: chat.id, folderPath: chat.folderPath, file, revision: chat.revision });
        }
        await syncedJson(join(base, 'index.json'), { schemaVersion: 1, revision: next.revision, folders: next.folders, entries });
        // Old files are now unreachable. A crash before manifest replacement can leave harmless orphan files.
        try {
            for (const old of current.entries) if (!entries.some(e => e.id === old.id && e.file === old.file && e.folderPath === old.folderPath)) {
                const parent = await this.folder(base, old.folderPath);
                await rm(join(parent, old.file), { force: true });
            }
            for (const old of current.folders.map(f => f.path).filter(path => !next.folders.some(f => f.path === path))
                .sort((a, b) => b.length - a.length)) {
                const path = await this.folder(base, old);
                try { await rmdir(path); }
                catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOTEMPTY') throw error; }
            }
        } catch (error) { throw new Error(`Chat write outcome uncertain; re-read before retrying: ${String(error)}`); }
    }
    private async recover(root: string, base: string): Promise<ChatCollection> {
        const legacyIds = new Set<string>();
        const current = await this.raw(root, legacyIds);
        const now = new Date().toISOString();
        const chats: Chat[] = [];
        let changed = false;
        for (const chat of current.chats) {
            const active = this.active(await this.lease(base, chat.id));
            const messages = chat.messages.map(message => {
                if (active) return message;
                if (message.role !== 'assistant' || !['pending', 'streaming'].includes(message.execution.status)) return message;
                changed = true;
                return { ...message, execution: { ...message.execution, status: 'failed' as const,
                    finishedAt: now, failure: interrupted } };
            });
            const wasInterrupted = messages.some((message, i) => message !== chat.messages[i]);
            if (legacyIds.has(chat.id)) changed = true;
            chats.push(!wasInterrupted && !legacyIds.has(chat.id) ? chat : parseChat({ ...chat,
                revision: chat.revision + 1, updatedAt: wasInterrupted ? now : chat.updatedAt, messages }));
        }
        if (!changed) return current;
        const next = parseChatCollection({ ...current, revision: current.revision + 1, chats });
        await this.write(root, next);
        this.emit(root, { revision: next.revision, kind: 'changed' });
        return next;
    }
    async read(root: string): Promise<ChatCollection> {
        const legacyIds = new Set<string>();
        const current = await this.raw(root, legacyIds);
        if (legacyIds.size) return this.locked(root, base => this.recover(root, base));
        const active = current.chats.filter(chat => chat.messages.some(m => m.role === 'assistant' &&
            ['pending', 'streaming'].includes(m.execution.status)));
        if (!active.length) return current;
        const { base } = await this.paths(root);
        if ((await Promise.all(active.map(chat => this.lease(base, chat.id)))).every(lease => this.active(lease)))
            return current;
        return this.locked(root, base => this.recover(root, base));
    }
    async mutate(root: string, expectedRevision: number, operation: ChatOperation, leaseToken?: string): Promise<ChatCollection> {
        revision(expectedRevision);
        return this.locked(root, async base => {
            const current = await this.recover(root, base);
            if (current.revision !== expectedRevision) throw new Error(`Stale Chat revision; current ${current.revision}`);
            if (['append-user', 'begin-assistant', 'start-assistant', 'finish-assistant'].includes(operation.type)) {
                const chatId = (operation as Extract<ChatOperation, { chatId: string }>).chatId;
                const lease = await this.lease(base, chatId);
                if (!lease || !this.active(lease) || lease.token !== leaseToken) throw new Error('Chat ownership lease required');
            }
            const now = new Date().toISOString();
            let folders = [...current.folders], chats = [...current.chats];
            const index = 'chatId' in operation ? chats.findIndex(c => c.id === operation.chatId) : -1;
            const update = (edit: (chat: Chat) => Chat): void => {
                if (index < 0) throw new Error('Chat not found');
                const original = chats[index];
                chats[index] = parseChat({ ...edit(original), revision: original.revision + 1, updatedAt: now });
            };
            switch (operation.type) {
                case 'create-folder': {
                    const path = parseChatFolderPath(operation.path);
                    if (!path || folders.some(f => f.path === path) ||
                        (path.includes('/') && !folders.some(f => f.path === path.slice(0, path.lastIndexOf('/'))))) throw new Error('Invalid or duplicate Chat folder');
                    folders.push({ schemaVersion: 1, path, createdAt: now }); break;
                }
                case 'move-folder':
                case 'rename-folder': {
                    const source = parseChatFolderPath(operation.path);
                    if (!source || !folders.some(f => f.path === source)) throw new Error('Chat folder not found');
                    const destination = operation.type === 'move-folder' ? parseChatFolderPath(operation.destination) :
                        joinChatFolderPath(source.includes('/') ? source.slice(0, source.lastIndexOf('/')) : '', operation.name);
                    if (operation.type === 'move-folder' && destination && !folders.some(f => f.path === destination)) throw new Error('Destination folder not found');
                    if (isChatFolderWithin(destination, source)) throw new Error('Cannot move folder into itself');
                    const target = operation.type === 'move-folder' ? joinChatFolderPath(destination, source.split('/').at(-1)!) : destination;
                    const remap = (path: string) => isChatFolderWithin(path, source) ? target + path.slice(source.length) : path;
                    if (folders.some(f => !isChatFolderWithin(f.path, source) && isChatFolderWithin(f.path, target))) throw new Error('Destination Chat folder exists');
                    folders = folders.map(f => ({ ...f, path: remap(f.path) }));
                    chats = chats.map(c => isChatFolderWithin(c.folderPath, source) ? parseChat({ ...c,
                        folderPath: remap(c.folderPath), revision: c.revision + 1, updatedAt: now }) : c);
                    break;
                }
                case 'create-chat': {
                    uuid(operation.id); parseChatFolderPath(operation.folderPath);
                    if (chats.some(c => c.id === operation.id)) throw new Error('Chat already exists');
                    chats.push(parseChat({ schemaVersion: 1, id: operation.id, revision: 0, folderPath: operation.folderPath,
                        title: operation.title?.trim() || 'New Chat', titleSource: operation.title ? 'developer' : 'placeholder',
                        color: assignedChatColor(operation.id), createdAt: now, updatedAt: now, lastInteractedAt: now,
                        settings: DEFAULT_SETTINGS, messages: [] })); break;
                }
                case 'move-chat': update(c => ({ ...c, folderPath: parseChatFolderPath(operation.folderPath) })); break;
                case 'rename-chat': update(c => ({ ...c, title: operation.title.trim(), titleSource: 'developer' })); break;
                case 'automatic-title': {
                    const chat = chats[index];
                    const assistantIndex = chat?.messages.findIndex(message => message.id === operation.firstAssistantMessageId) ?? -1;
                    const assistant = chat?.messages[assistantIndex];
                    if (!chat || chat.titleSource !== 'placeholder' || assistantIndex < 1 ||
                        chat.messages[assistantIndex - 1].id !== operation.firstUserMessageId ||
                        assistant?.role !== 'assistant' || assistant.execution.status !== 'complete' ||
                        chat.messages.slice(0, assistantIndex).some(message =>
                            message.role === 'assistant' && message.execution.status === 'complete')) break;
                    update(c => withAutomaticChatTitle(c, operation.title)); break;
                }
                case 'set-settings': update(c => ({ ...c, settings: parseChatSettings(operation.settings) })); break;
                case 'set-color': update(c => ({ ...c, color: parseChatColor(operation.color) })); break;
                case 'append-user': {
                    const message = parseChatMessage(operation.message);
                    if (message.role !== 'user') throw new Error('Expected user message');
                    update(c => ({ ...c, lastInteractedAt: now, messages: [...c.messages, message] })); break;
                }
                case 'revise-user-context': update(c => {
                    const at = c.messages.findIndex(message => message.id === operation.assistantMessageId);
                    const userAt = c.messages.findIndex(message => message.id === operation.userMessageId);
                    const assistant = c.messages[at], user = c.messages[userAt];
                    if (at <= userAt || assistant?.role !== 'assistant' || assistant.execution.status !== 'pending' ||
                        user?.role !== 'user' || c.messages.slice(userAt + 1, at).some(message =>
                            message.role !== 'assistant' || !['failed', 'cancelled'].includes(message.execution.status)))
                        throw new Error('User context can only change before assistant execution');
                    const messages = [...c.messages];
                    messages[userAt] = parseChatMessage({ ...user, contextRefs: operation.contextRefs });
                    return { ...c, messages };
                }); break;
                case 'begin-assistant': {
                    const message = parseChatMessage(operation.message);
                    if (message.role !== 'assistant' || message.execution.status !== 'pending') throw new Error('Expected pending assistant');
                    update(c => ({ ...c, lastInteractedAt: now, messages: [...c.messages, message] })); break;
                }
                case 'start-assistant': update(c => {
                    const at = c.messages.findIndex(m => m.id === operation.messageId);
                    const message = c.messages[at];
                    if (!message || message.role !== 'assistant' || message.execution.status !== 'pending')
                        throw new Error('Assistant execution is not pending');
                    const messages = [...c.messages];
                    messages[at] = parseChatMessage({ ...message, execution: {
                        ...message.execution, status: 'streaming', actualModel: operation.actualModel,
                        ...(operation.routingProvenance ? { routingProvenance: operation.routingProvenance } : {}) } });
                    return { ...c, lastInteractedAt: now, messages };
                }); break;
                case 'finish-assistant': update(c => {
                    const at = c.messages.findIndex(m => m.id === operation.messageId);
                    const message = c.messages[at];
                    if (!message || message.role !== 'assistant' || !['pending', 'streaming'].includes(message.execution.status))
                        throw new Error('Assistant execution is not active');
                    if (message.execution.routingProvenance && operation.routingProvenance &&
                        JSON.stringify(message.execution.routingProvenance) !== JSON.stringify(operation.routingProvenance))
                        throw new Error('Assistant routing provenance is immutable');
                    if (message.execution.actualModel && operation.actualModel &&
                        (message.execution.actualModel.connectionId !== operation.actualModel.connectionId ||
                        message.execution.actualModel.providerId !== operation.actualModel.providerId))
                        throw new Error('Assistant model provenance is immutable');
                    const messages = [...c.messages];
                    messages[at] = parseChatMessage({ ...message, content: operation.content, execution: {
                        ...message.execution, status: operation.outcome, actualModel: operation.actualModel ?? message.execution.actualModel,
                        routingProvenance: operation.routingProvenance ?? message.execution.routingProvenance,
                        finishedAt: now, ...(operation.outcome === 'failed' ? { failure: operation.failure } : {}) } });
                    return { ...c, lastInteractedAt: now, messages };
                }); break;
                default: throw new Error('Invalid Chat operation');
            }
            const next = parseChatCollection({ schemaVersion: 1, revision: current.revision + 1, folders, chats });
            await this.write(root, next);
            this.emit(root, { revision: next.revision, kind: 'changed',
                ...('chatId' in operation ? { chatId: operation.chatId } : {}) });
            return next;
        });
    }
    async claim(root: string, chatId: string, ownerId: string): Promise<ChatLeaseResult> {
        uuid(chatId);
        if (!ownerId.trim()) throw new Error('Invalid Chat owner');
        return this.locked(root, async base => {
            if (!(await this.recover(root, base)).chats.some(c => c.id === chatId)) throw new Error('Chat not found');
            const old = await this.lease(base, chatId);
            if (this.active(old)) return { acquired: false, ownerId: old.ownerId };
            await directory(join(base, '.leases'), true);
            const token = randomUUID();
            await syncedJson(join(base, '.leases', `${chatId}.json`), { schemaVersion: 1, chatId, ownerId, token,
                pid: process.pid, expiresAt: Date.now() + leaseDuration, root: base });
            this.emit(root, { revision: (await this.raw(root)).revision, kind: 'lease-changed', chatId });
            return { acquired: true, token };
        });
    }
    async renew(root: string, chatId: string, token: string): Promise<void> {
        await this.locked(root, async base => {
            const lease = await this.lease(base, uuid(chatId));
            if (!lease || lease.token !== token || !this.active(lease)) throw new Error('Chat lease lost');
            await syncedJson(join(base, '.leases', `${chatId}.json`), { ...lease, expiresAt: Date.now() + leaseDuration });
        });
    }
    async release(root: string, chatId: string, token: string): Promise<void> {
        await this.locked(root, async base => {
            const lease = await this.lease(base, uuid(chatId));
            if (!lease || lease.token !== token) throw new Error('Chat lease lost');
            await rm(join(base, '.leases', `${chatId}.json`));
            this.emit(root, { revision: (await this.raw(root)).revision, kind: 'lease-changed', chatId });
        });
    }
    async publishDelta(root: string, chatId: string, messageId: string, executionId: string,
        sequence: number, delta: string, token: string): Promise<void> {
        const { base, exists } = await this.paths(root);
        if (!exists || !Number.isSafeInteger(sequence) || sequence < 0 || typeof delta !== 'string' ||
            !delta || delta.length > 65_536)
            throw new Error('Invalid Chat delta');
        const lease = await this.lease(base, uuid(chatId));
        if (!lease || !this.active(lease) || lease.token !== token) throw new Error('Chat ownership lease required');
        const snapshot = await this.read(root);
        const message = snapshot.chats.find(chat => chat.id === chatId)?.messages.find(item => item.id === messageId);
        if (!message || message.role !== 'assistant' || message.execution.id !== executionId ||
            message.execution.status !== 'streaming') throw new Error('Assistant execution is not streaming');
        this.emit(root, { revision: snapshot.revision, kind: 'assistant-delta', chatId,
            messageId, executionId, sequence, delta });
    }
    async search(root: string, query: string, limit: number, excludeChatId?: string): Promise<ChatSearchHit[]> {
        const needle = query.trim().toLocaleLowerCase('en-US');
        if (!needle || needle.length > 200 || !Number.isSafeInteger(limit) || limit < 1 || limit > 50)
            throw new Error('Invalid Chat search request');
        if (excludeChatId) uuid(excludeChatId);
        const hits: ChatSearchHit[] = [];
        let scanned = 0;
        for (const chat of (await this.read(root)).chats.sort(compareChatsByInteraction)) {
            if (chat.id === excludeChatId) continue;
            if (++scanned > 5_000) return hits;
            const titleHit = chat.title.toLocaleLowerCase('en-US').includes(needle) && chat.messages.length > 0;
            if (titleHit) {
                const message = chat.messages[0];
                hits.push({ chatId: chat.id, messageId: message.id, title: chat.title,
                    excerpt: message.content.replace(/\s+/g, ' ').slice(0, 240), createdAt: message.createdAt });
                if (hits.length === limit) return hits;
            }
            for (const message of chat.messages) {
                // ponytail: a fixed scan budget keeps retrieval bounded; add an index only if archives outgrow it.
                if (++scanned > 5_000) return hits;
                if (titleHit && message === chat.messages[0]) continue;
                const content = message.content.replace(/\s+/g, ' ');
                const at = content.toLocaleLowerCase('en-US').indexOf(needle);
                if (at < 0) continue;
                hits.push({ chatId: chat.id, messageId: message.id, title: chat.title,
                    excerpt: content.slice(Math.max(0, at - 60), Math.max(0, at - 60) + 240), createdAt: message.createdAt });
                if (hits.length === limit) return hits;
            }
        }
        return hits;
    }
}
