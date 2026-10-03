import { randomUUID } from 'node:crypto';
import type { ChatClient, ChatDeltaRequest, ChatLeaseRequest, ChatMutation, ChatSearchRequest, ChatService,
    ChatTurnRequest, ChatOperation } from '@dope/chat/lib/service';
import type { ChatAssistantMessage, ChatModelProvenance, ChatUserMessage } from '@dope/chat';
import { ChatRepository } from '@dope/chat/lib/node';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ConversationMessage } from '@dope/contracts/lib/model-runtime';
import { ModelConnectionsRegistry } from './model-connections';

/** One RPC connection owns one project handle; the repository shares durable state and events. */
export class ChatBackend implements ChatService {
    private root?: string;
    private handle?: string;
    private disposed = false;
    private attaching = 0;
    private readonly unlisten: () => void;
    private readonly turns = new Map<string, { token: string; abort: AbortController }>();
    private readonly pendingCancel = new Map<string, string>();

    constructor(private readonly repository: ChatRepository, client: ChatClient,
        private readonly models?: ModelConnectionsRegistry) {
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
    async runTurn(request: ChatTurnRequest): Promise<void> {
        const root = this.active(request.projectHandle);
        if (!this.models || this.turns.has(request.chatId)) throw new Error('Chat turn already active or runtime unavailable');
        const snapshot = await this.repository.read(root);
        const chat = snapshot.chats.find(item => item.id === request.chatId);
        if (!chat) throw new Error('Chat not found');
        const connection = (await this.models.list()).connections.find(item => item.id === request.selectedModel.connectionId);
        const model = connection?.ready && connection.models.find(item => item.id === request.selectedModel.modelId && item.usable);
        if (!connection || !model) throw new ModelRuntimeFailure('Selected model is unavailable; open Model Connections to set up a model', 'model-unavailable');
        const controls = chat.settings.reasoningControls ?? {};
        for (const [id, value] of Object.entries(controls))
            if (!model.capabilities.reasoningControls?.some(control => control.id === id && control.values.includes(value)))
                throw new ModelRuntimeFailure('Selected model does not support the saved reasoning control', 'unsupported-capability');
        const key = request.chatId;
        const abort = new AbortController();
        this.turns.set(key, { token: request.leaseToken, abort });
        const mutate = async (operation: ChatOperation) => {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    return await this.repository.mutate(root, (await this.repository.read(root)).revision,
                        operation, request.leaseToken);
                } catch (error) {
                    if (attempt === 2 || !String(error).includes('Stale Chat revision')) throw error;
                }
            }
            throw new Error('Chat mutation conflict');
        };
        let assistant: ChatAssistantMessage | undefined;
        let output = '';
        let actual: ChatModelProvenance = { schemaVersion: 1, connectionId: connection.id,
            modelId: model.id, providerId: connection.providerId, modelLabel: model.label };
        try {
            if (this.pendingCancel.get(key) === request.leaseToken) abort.abort();
            if (request.retryMessageId) {
                const index = chat.messages.findIndex(item => item.id === request.retryMessageId);
                if (index < 1 || chat.messages[index].role !== 'assistant' ||
                    !['failed', 'cancelled'].includes((chat.messages[index] as ChatAssistantMessage).execution.status) ||
                    chat.messages[index - 1].role !== 'user') throw new Error('Only a failed or cancelled attempt can be retried');
            } else {
                if (!request.content?.trim()) throw new Error('Enter a message before sending');
                const user: ChatUserMessage = { schemaVersion: 1, id: randomUUID(), role: 'user',
                    createdAt: new Date().toISOString(), content: request.content.trim(), contextRefs: [] };
                await mutate({ type: 'append-user', chatId: key, message: user });
            }
            const now = new Date().toISOString();
            assistant = { schemaVersion: 1, id: randomUUID(), role: 'assistant', createdAt: now, content: '',
                execution: { schemaVersion: 1, id: randomUUID(), status: 'pending',
                    selectedModel: { ...request.selectedModel }, startedAt: now } };
            const next = await mutate({ type: 'begin-assistant', chatId: key, message: assistant });
            const messages = next.chats.find(item => item.id === key)!.messages;
            const prior = messages.slice(0, -1).filter(item => item.role === 'user' ||
                item.role === 'assistant' && item.execution.status === 'complete');
            const budget = Math.max(1, Math.min(chat.settings.context.maxInputTokens,
                (model.capabilities.contextWindowTokens ?? chat.settings.context.maxInputTokens) - chat.settings.context.reservedOutputTokens));
            let remaining = budget * 4;
            const selected: ConversationMessage[] = [];
            for (const item of (chat.settings.context.history === 'none' ? prior.slice(-1) : prior).reverse()) {
                if (item.content.length > remaining) break;
                selected.unshift({ role: item.role === 'user' ? 'user' : 'assistant', content: item.content });
                remaining -= item.content.length;
            }
            await mutate({ type: 'start-assistant', chatId: key, messageId: assistant.id, actualModel: actual });
            let sequence = 0;
            for await (const event of this.models.generate(request.selectedModel,
                { messages: selected, controls, signal: abort.signal })) {
                if (event.type === 'delta') {
                    output += event.text;
                    await this.repository.publishDelta(root, key, assistant.id, assistant.execution.id,
                        sequence++, event.text, request.leaseToken);
                } else {
                    output = event.text;
                    if (event.provenance) actual = { schemaVersion: 1, ...event.provenance };
                    await mutate({ type: 'finish-assistant', chatId: key, messageId: assistant.id,
                        outcome: 'complete', content: output, actualModel: actual });
                    return;
                }
            }
            throw new Error('Model stream ended without completion');
        } catch (error) {
            if (assistant) {
                const cancelled = abort.signal.aborted || error instanceof ModelRuntimeFailure && error.failureClass === 'cancelled';
                const failure = error instanceof ModelRuntimeFailure ? error.message : 'Conversation failed';
                try { await mutate({ type: 'finish-assistant', chatId: key, messageId: assistant.id,
                    outcome: cancelled ? 'cancelled' : 'failed', content: output,
                    ...(!cancelled ? { failure } : {}) }); }
                catch { /* A lost lease or newer revision is recovered by ChatRepository. */ }
            }
            throw error;
        } finally {
            if (this.turns.get(key)?.abort === abort) this.turns.delete(key);
            if (this.pendingCancel.get(key) === request.leaseToken) this.pendingCancel.delete(key);
        }
    }
    async cancelTurn(projectHandle: string, chatId: string, leaseToken: string): Promise<void> {
        this.active(projectHandle);
        const turn = this.turns.get(chatId);
        if (turn && turn.token !== leaseToken) throw new Error('Chat turn is not owned by this panel');
        if (turn) turn.abort.abort();
        else this.pendingCancel.set(chatId, leaseToken);
    }
    dispose(): void {
        this.disposed = true;
        for (const turn of this.turns.values()) turn.abort.abort();
        this.unlisten();
    }
}
