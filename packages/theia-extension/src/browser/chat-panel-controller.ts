import { compareChatsByInteraction, joinChatFolderPath } from '@dope/chat';
import type { Chat, ChatCollection, ChatFolderPath } from '@dope/chat';
import type { ChatClient, ChatOperation, ChatService } from '@dope/chat/lib/service';
import type { ChatModelSelection } from '@dope/chat';

export type ChatConnection = ChatService & { setClient(client: ChatClient | undefined): void; dispose(): void };
export type ChatMode = 'select-chat' | 'chat';
export interface ChatTree { path: ChatFolderPath; folders: ChatTree[]; chats: Chat[] }

/** A renderer-local reservation, keyed by project URI and durable Chat identity. */
export class ChatOpenOwners {
    private readonly owners = new Map<string, { panelId: string; focus: () => void }>();
    private key(workspace: string, chatId: string): string { return JSON.stringify([workspace, chatId]); }
    reserve(workspace: string, chatId: string, panelId: string, focus: () => void): boolean {
        const key = this.key(workspace, chatId);
        const owner = this.owners.get(key);
        if (owner && owner.panelId !== panelId) { owner.focus(); return false; }
        this.owners.set(key, { panelId, focus });
        return true;
    }
    release(workspace: string, chatId: string, panelId: string): void {
        const key = this.key(workspace, chatId);
        if (this.owners.get(key)?.panelId === panelId) this.owners.delete(key);
    }
}

export function chatTree(collection: ChatCollection): ChatTree {
    const root: ChatTree = { path: '', folders: [], chats: [] };
    const nodes = new Map<string, ChatTree>([['', root]]);
    for (const folder of [...collection.folders].sort((a, b) => a.path.localeCompare(b.path)))
        nodes.set(folder.path, { path: folder.path, folders: [], chats: [] });
    for (const folder of collection.folders) {
        const parent = folder.path.includes('/') ? folder.path.slice(0, folder.path.lastIndexOf('/')) : '';
        nodes.get(parent)?.folders.push(nodes.get(folder.path)!);
    }
    for (const node of nodes.values()) node.folders.sort((a, b) => a.path.localeCompare(b.path));
    for (const chat of collection.chats) nodes.get(chat.folderPath)?.chats.push(chat);
    for (const node of nodes.values()) node.chats.sort(compareChatsByInteraction);
    return root;
}

/** Panel-local navigation over the shared project service. */
export class ChatPanelController {
    workspace: string | undefined;
    snapshot: ChatCollection | undefined;
    mode: ChatMode = 'select-chat';
    chatId: string | undefined;
    loading = false;
    pending = false;
    error = '';
    draft = '';
    turnModel: ChatModelSelection | undefined;
    running = false;
    stream: { messageId: string; executionId: string; content: string; sequence: number } | undefined;
    private connection?: ChatConnection;
    private handle?: string;
    private generation = 0;
    private request = 0;
    private eventRevision = 0;
    private disposed = false;
    private selection = 0;
    private lease?: { workspace: string; chatId: string; connection: ChatConnection; handle: string; token: string };
    private renewal?: ReturnType<typeof setInterval>;
    private restored?: { workspace: string; chatId: string };
    private departing?: Promise<void>;
    private readonly selections = new Set<Promise<boolean>>();

    constructor(private readonly connect: () => ChatConnection, private readonly changed: () => void,
        private readonly owners = new ChatOpenOwners(), private readonly panelId: string = crypto.randomUUID(),
        private readonly focus = () => {}) { }
    get chat(): Chat | undefined { return this.snapshot?.chats.find(chat => chat.id === this.chatId); }
    get attached(): boolean { return !!this.handle; }

    async attach(workspace: string | undefined): Promise<void> {
        if (this.disposed || workspace && workspace === this.workspace && this.handle) return;
        const generation = ++this.generation;
        ++this.request;
        ++this.selection;
        this.workspace = undefined;
        this.snapshot = undefined;
        this.mode = 'select-chat';
        this.chatId = undefined;
        this.handle = undefined;
        this.loading = !!workspace;
        this.pending = false;
        this.error = '';
        this.draft = ''; this.turnModel = undefined; this.stream = undefined;
        this.changed();
        await this.leave();
        this.running = false;
        await Promise.allSettled([...this.selections]);
        if (this.disposed || generation !== this.generation) return;
        this.connection?.setClient(undefined);
        if (this.connection) void Promise.resolve(this.connection.dispose()).catch(() => {});
        this.connection = undefined;
        this.workspace = workspace;
        this.eventRevision = 0;
        this.changed();
        if (!workspace) return;
        try {
            const connection = this.connect();
            this.connection = connection;
            connection.setClient({ notifyChatEvent: event => {
                if (this.disposed || generation !== this.generation || this.handle && event.projectHandle !== this.handle) return;
                if (event.kind === 'assistant-delta') {
                    if (!this.running || event.chatId !== this.chatId) return;
                    const current = this.stream;
                    if (current && (current.messageId !== event.messageId || current.executionId !== event.executionId ||
                        event.sequence !== current.sequence + 1)) return;
                    if (!current && event.sequence !== 0) return;
                    this.stream = { messageId: event.messageId, executionId: event.executionId,
                        content: (current?.content ?? '') + event.delta, sequence: event.sequence };
                    this.changed();
                    return;
                }
                this.eventRevision = Math.max(this.eventRevision, event.revision);
                if (!this.pending && !this.running && this.handle && event.revision > (this.snapshot?.revision ?? -1)) void this.refresh();
            } });
            const attached = await connection.attach(workspace);
            if (this.disposed || generation !== this.generation) return;
            this.handle = attached.projectHandle;
            this.snapshot = attached.snapshot;
            this.loading = false;
            this.changed();
            if (this.eventRevision > attached.snapshot.revision) void this.refresh();
            if (this.restored) {
                const restored = this.restored;
                this.restored = undefined;
                if (restored.workspace === workspace) void this.select(restored.chatId, true);
            }
        } catch (error) {
            if (generation === this.generation && !this.disposed) {
                this.connection?.setClient(undefined);
                if (this.connection) void Promise.resolve(this.connection.dispose()).catch(() => {});
                this.connection = undefined;
                this.loading = false; this.error = String(error); this.changed();
            }
        }
    }

    restore(workspace: string, mode: ChatMode, chatId?: string): void {
        if (this.disposed) return;
        this.restored = mode === 'chat' && chatId ? { workspace, chatId } : undefined;
        if (this.restored && this.workspace === workspace && this.handle) {
            const restored = this.restored;
            this.restored = undefined;
            void this.select(restored.chatId, true);
        }
    }

    private async leave(): Promise<void> {
        if (this.running) await this.cancel();
        if (this.renewal) clearInterval(this.renewal);
        this.renewal = undefined;
        const lease = this.lease;
        this.lease = undefined;
        if (lease) {
            const previous = this.departing;
            const departing = (async () => {
                await previous;
                try { await lease.connection.release(lease.handle, lease.chatId, lease.token); }
                catch { /* An expired or replaced token must never release its successor. */ }
                finally { this.owners.release(lease.workspace, lease.chatId, this.panelId); }
            })();
            this.departing = departing;
        }
        await this.departing;
    }

    select(chatId: string | undefined, restoring = false): Promise<boolean> {
        const selection = this.doSelect(chatId, restoring);
        this.selections.add(selection);
        void selection.finally(() => this.selections.delete(selection));
        return selection;
    }

    private async doSelect(chatId: string | undefined, restoring: boolean): Promise<boolean> {
        const selection = ++this.selection;
        const previous = [...this.selections];
        if (chatId && !this.snapshot?.chats.some(chat => chat.id === chatId)) {
            this.error = restoring ? 'Restored Chat is unavailable; select a Chat.' : 'Chat is unavailable.';
            this.changed();
            return false;
        }
        if (chatId === this.chatId && this.mode === 'chat' && this.lease) return true;
        this.chatId = undefined; this.mode = 'select-chat'; this.error = '';
        this.draft = ''; this.turnModel = undefined; this.stream = undefined;
        this.changed();
        await this.leave();
        await Promise.allSettled(previous);
        if (selection !== this.selection || this.disposed || !chatId) return !chatId;
        const workspace = this.workspace, connection = this.connection, handle = this.handle;
        if (!workspace || !connection || !handle) return false;
        if (!this.owners.reserve(workspace, chatId, this.panelId, this.focus)) {
            this.error = restoring ? 'Chat already restored in another panel; select a Chat.' :
                'Chat is already open in another panel.';
            this.changed();
            return false;
        }
        try {
            const claim = await connection.claim({ projectHandle: handle, chatId, ownerId: this.panelId });
            if (selection !== this.selection || this.disposed || workspace !== this.workspace) {
                if (claim.acquired) await connection.release(handle, chatId, claim.token).catch(() => {});
                this.owners.release(workspace, chatId, this.panelId);
                return false;
            }
            if (!claim.acquired) {
                this.error = `Chat is open in another window (${claim.ownerId}).`;
                this.owners.release(workspace, chatId, this.panelId);
                this.changed();
                return false;
            }
            this.lease = { workspace, chatId, connection, handle, token: claim.token };
            this.chatId = chatId; this.mode = 'chat'; this.stream = undefined; this.changed();
            this.renewal = setInterval(() => {
                if (this.lease?.token !== claim.token) return;
                void connection.renew(handle, chatId, claim.token).catch(() => {
                    if (this.lease?.token === claim.token) {
                        void this.select(undefined).then(() => {
                            if (!this.disposed && this.workspace === workspace) {
                                this.error = 'Chat ownership lease was lost; select the Chat again.';
                                this.changed();
                            }
                        });
                    }
                });
            }, 20_000);
            return true;
        } catch (error) {
            this.owners.release(workspace, chatId, this.panelId);
            if (selection === this.selection && !this.disposed) { this.error = String(error); this.changed(); }
            return false;
        }
    }

    async refresh(retainError = false): Promise<void> {
        if (!this.connection || !this.handle || this.disposed) return;
        const generation = this.generation, request = ++this.request;
        const connection = this.connection, handle = this.handle;
        try {
            const snapshot = await connection.read(handle);
            if (this.disposed || generation !== this.generation || request !== this.request ||
                snapshot.revision < (this.snapshot?.revision ?? -1)) return;
            this.snapshot = snapshot;
            if (this.stream && !snapshot.chats.find(chat => chat.id === this.chatId)?.messages.some(message =>
                message.id === this.stream?.messageId && message.role === 'assistant' &&
                message.execution.id === this.stream.executionId && message.execution.status === 'streaming'))
                this.stream = undefined;
            if (this.chatId && !snapshot.chats.some(chat => chat.id === this.chatId)) void this.select(undefined);
            if (!retainError) this.error = '';
            this.changed();
            if (this.eventRevision > snapshot.revision) void this.refresh(retainError);
        } catch (error) {
            if (!this.disposed && generation === this.generation && request === this.request) {
                this.error = String(error); this.changed();
            }
        }
    }

    async mutate(operation: ChatOperation): Promise<boolean> {
        if (!this.connection || !this.handle || !this.snapshot || this.pending || this.running || this.disposed) return false;
        const generation = this.generation, connection = this.connection, handle = this.handle;
        const request = ++this.request;
        this.pending = true;
        this.error = '';
        this.changed();
        try {
            const snapshot = await connection.mutate({ projectHandle: handle,
                expectedRevision: this.snapshot.revision, operation,
                ...('chatId' in operation && this.lease?.chatId === operation.chatId ?
                    { leaseToken: this.lease.token } : {}) });
            if (this.disposed || generation !== this.generation || request !== this.request) return false;
            this.snapshot = snapshot;
            this.pending = false;
            if (operation.type === 'create-chat') {
                const selected = await this.select(operation.id);
                if (this.eventRevision > snapshot.revision) void this.refresh();
                return selected;
            }
            this.changed();
            if (this.eventRevision > snapshot.revision) void this.refresh();
            return true;
        } catch (error) {
            if (!this.disposed && generation === this.generation && request === this.request) {
                this.pending = false; this.error = String(error); this.changed();
                void this.refresh(true);
            }
            return false;
        }
    }

    async newChat(folderPath: ChatFolderPath): Promise<boolean> {
        return this.mutate({ type: 'create-chat', id: crypto.randomUUID(), folderPath });
    }
    async runTurn(model: ChatModelSelection, retryMessageId?: string): Promise<boolean> {
        const lease = this.lease;
        if (!lease || this.running || this.pending || !this.chat || !retryMessageId && !this.draft.trim()) return false;
        const content = this.draft;
        const generation = this.generation, chatId = this.chatId;
        this.running = true; this.error = ''; this.stream = undefined;
        if (!retryMessageId) this.draft = '';
        this.turnModel = undefined;
        this.changed();
        try {
            await lease.connection.runTurn({ projectHandle: lease.handle, chatId: lease.chatId,
                leaseToken: lease.token, selectedModel: model,
                ...(retryMessageId ? { retryMessageId } : { content }) });
            return true;
        } catch (error) {
            if (!this.disposed && generation === this.generation && chatId === this.chatId) {
                this.error = String(error);
                if (!retryMessageId && !this.chat?.messages.some(message => message.role === 'user' && message.content === content))
                    this.draft = content;
                this.changed();
            }
            return false;
        } finally {
            if (!this.disposed && generation === this.generation && chatId === this.chatId) {
                this.running = false; this.stream = undefined; this.changed();
                await this.refresh(true);
            }
        }
    }
    async cancel(): Promise<void> {
        const lease = this.lease;
        if (lease && this.running) await lease.connection.cancelTurn(lease.handle, lease.chatId, lease.token).catch(() => {});
    }
    async newFolder(parent: ChatFolderPath, name: string): Promise<boolean> {
        try { return this.mutate({ type: 'create-folder', path: joinChatFolderPath(parent, name) }); }
        catch (error) { this.error = String(error); this.changed(); return false; }
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        ++this.generation; ++this.request;
        ++this.selection;
        const connection = this.connection;
        void (async () => { await this.leave(); await Promise.allSettled([...this.selections]); })().finally(() => {
            connection?.setClient(undefined);
            if (connection) void Promise.resolve(connection.dispose()).catch(() => {});
        });
        this.connection = undefined;
    }
}
