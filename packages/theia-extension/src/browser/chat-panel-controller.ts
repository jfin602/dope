import { compareChatsByInteraction, joinChatFolderPath } from '@dope/chat';
import type { Chat, ChatCollection, ChatFolderPath } from '@dope/chat';
import type { ChatClient, ChatOperation, ChatService } from '@dope/chat/lib/service';

export type ChatConnection = ChatService & { setClient(client: ChatClient | undefined): void; dispose(): void };
export type ChatMode = 'select-chat' | 'chat';
export interface ChatTree { path: ChatFolderPath; folders: ChatTree[]; chats: Chat[] }

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

/** Panel-local navigation over the shared project service. P5 adds live-owner semantics. */
export class ChatPanelController {
    workspace: string | undefined;
    snapshot: ChatCollection | undefined;
    mode: ChatMode = 'select-chat';
    chatId: string | undefined;
    loading = false;
    pending = false;
    error = '';
    private connection?: ChatConnection;
    private handle?: string;
    private generation = 0;
    private request = 0;
    private eventRevision = 0;
    private disposed = false;

    constructor(private readonly connect: () => ChatConnection, private readonly changed: () => void) { }
    get chat(): Chat | undefined { return this.snapshot?.chats.find(chat => chat.id === this.chatId); }
    get attached(): boolean { return !!this.handle; }

    async attach(workspace: string | undefined): Promise<void> {
        if (this.disposed || workspace === this.workspace && (this.handle || !workspace)) return;
        const generation = ++this.generation;
        ++this.request;
        this.connection?.setClient(undefined);
        if (this.connection) void Promise.resolve(this.connection.dispose()).catch(() => {});
        this.connection = undefined;
        this.handle = undefined;
        this.workspace = workspace;
        this.snapshot = undefined;
        this.mode = 'select-chat';
        this.chatId = undefined;
        this.loading = !!workspace;
        this.pending = false;
        this.error = '';
        this.eventRevision = 0;
        this.changed();
        if (!workspace) return;
        try {
            const connection = this.connect();
            this.connection = connection;
            connection.setClient({ notifyChatEvent: event => {
                if (this.disposed || generation !== this.generation || event.kind === 'assistant-delta' ||
                    this.handle && event.projectHandle !== this.handle) return;
                this.eventRevision = Math.max(this.eventRevision, event.revision);
                if (!this.pending && this.handle && event.revision > (this.snapshot?.revision ?? -1)) void this.refresh();
            } });
            const attached = await connection.attach(workspace);
            if (this.disposed || generation !== this.generation) return;
            this.handle = attached.projectHandle;
            this.snapshot = attached.snapshot;
            this.loading = false;
            this.changed();
            if (this.eventRevision > attached.snapshot.revision) void this.refresh();
        } catch (error) {
            if (generation === this.generation && !this.disposed) {
                this.connection?.setClient(undefined);
                if (this.connection) void Promise.resolve(this.connection.dispose()).catch(() => {});
                this.connection = undefined;
                this.loading = false; this.error = String(error); this.changed();
            }
        }
    }

    select(chatId: string | undefined): boolean {
        if (chatId && !this.snapshot?.chats.some(chat => chat.id === chatId)) return false;
        this.chatId = chatId;
        this.mode = chatId ? 'chat' : 'select-chat';
        this.error = '';
        this.changed();
        return true;
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
            if (this.chatId && !snapshot.chats.some(chat => chat.id === this.chatId)) this.select(undefined);
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
        if (!this.connection || !this.handle || !this.snapshot || this.pending || this.disposed) return false;
        const generation = this.generation, connection = this.connection, handle = this.handle;
        const request = ++this.request;
        this.pending = true;
        this.error = '';
        this.changed();
        try {
            const snapshot = await connection.mutate({ projectHandle: handle,
                expectedRevision: this.snapshot.revision, operation });
            if (this.disposed || generation !== this.generation || request !== this.request) return false;
            this.snapshot = snapshot;
            this.pending = false;
            if (operation.type === 'create-chat') this.select(operation.id);
            else this.changed();
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
    async newFolder(parent: ChatFolderPath, name: string): Promise<boolean> {
        try { return this.mutate({ type: 'create-folder', path: joinChatFolderPath(parent, name) }); }
        catch (error) { this.error = String(error); this.changed(); return false; }
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        ++this.generation; ++this.request;
        this.connection?.setClient(undefined);
        if (this.connection) void Promise.resolve(this.connection.dispose()).catch(() => {});
        this.connection = undefined;
    }
}
