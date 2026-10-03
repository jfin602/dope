import { randomUUID } from 'node:crypto';
import type { ChatClient, ChatDeltaRequest, ChatLeaseRequest, ChatMutation, ChatSearchRequest, ChatService } from '@dope/chat/lib/service';
import { ChatRepository } from '@dope/chat/lib/node';

/** One RPC connection owns one project handle; the repository shares durable state and events. */
export class ChatBackend implements ChatService {
    private root?: string;
    private handle?: string;
    private disposed = false;
    private attaching = 0;
    private readonly unlisten: () => void;

    constructor(private readonly repository: ChatRepository, client: ChatClient) {
        this.unlisten = repository.onChange((root, event) => {
            if (!this.disposed && root === this.root && this.handle)
                client.notifyChatEvent({ ...event, projectHandle: this.handle });
        });
    }

    async attach(folderUri: string) {
        if (this.disposed) throw new Error('Disposed Chat connection');
        const request = ++this.attaching;
        const root = await this.repository.root(folderUri);
        if (this.disposed || request !== this.attaching) throw new Error('Superseded Chat attachment');
        if (this.root && this.root !== root) throw new Error('A different Chat project is already attached');
        const snapshot = await this.repository.read(root);
        if (this.disposed || request !== this.attaching) throw new Error('Superseded Chat attachment');
        this.root = root;
        this.handle ??= randomUUID();
        return { projectHandle: this.handle, snapshot };
    }

    private active(handle: string): string {
        if (this.disposed || !this.root || handle !== this.handle) throw new Error('Invalid or disposed Chat handle');
        return this.root;
    }

    read(projectHandle: string) { return this.repository.read(this.active(projectHandle)); }
    async list(projectHandle: string) { return (await this.read(projectHandle)).chats; }
    async get(projectHandle: string, chatId: string) {
        return (await this.read(projectHandle)).chats.find(chat => chat.id === chatId);
    }
    mutate(request: ChatMutation) {
        if (!request || typeof request !== 'object') throw new Error('Invalid Chat mutation');
        return this.repository.mutate(this.active(request.projectHandle), request.expectedRevision,
            request.operation, request.leaseToken);
    }
    search(request: ChatSearchRequest) {
        if (!request || typeof request !== 'object') throw new Error('Invalid Chat search request');
        return this.repository.search(this.active(request.projectHandle), request.query, request.limit, request.excludeChatId);
    }
    claim(request: ChatLeaseRequest) {
        if (!request || typeof request !== 'object') throw new Error('Invalid Chat lease request');
        return this.repository.claim(this.active(request.projectHandle), request.chatId, request.ownerId);
    }
    renew(projectHandle: string, chatId: string, token: string) {
        return this.repository.renew(this.active(projectHandle), chatId, token);
    }
    release(projectHandle: string, chatId: string, token: string) {
        return this.repository.release(this.active(projectHandle), chatId, token);
    }
    publishDelta(request: ChatDeltaRequest) {
        if (!request || typeof request !== 'object') throw new Error('Invalid Chat delta request');
        return this.repository.publishDelta(this.active(request.projectHandle), request.chatId,
            request.messageId, request.executionId, request.sequence, request.delta, request.leaseToken);
    }
    dispose(): void { this.disposed = true; this.unlisten(); }
}
