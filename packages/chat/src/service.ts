import type { Chat, ChatCollection, ChatFolderPath, ChatId, ChatMessage,
    ChatModelProvenance, ChatSettings } from './index';

export const chatServicePath = '/services/dope/chat';
export const ChatService = Symbol('ChatService');

/** Every mutation carries the project handle and expected collection revision. */
export type ChatOperation =
    | { type: 'create-folder'; path: ChatFolderPath }
    | { type: 'move-folder'; path: ChatFolderPath; destination: ChatFolderPath }
    | { type: 'rename-folder'; path: ChatFolderPath; name: string }
    | { type: 'create-chat'; id: ChatId; folderPath: ChatFolderPath; title?: string }
    | { type: 'move-chat'; chatId: ChatId; folderPath: ChatFolderPath }
    | { type: 'rename-chat'; chatId: ChatId; title: string }
    | { type: 'automatic-title'; chatId: ChatId; title: string }
    | { type: 'set-settings'; chatId: ChatId; settings: ChatSettings }
    | { type: 'append-user'; chatId: ChatId; message: ChatMessage & { role: 'user' } }
    | { type: 'begin-assistant'; chatId: ChatId; message: ChatMessage & { role: 'assistant' } }
    | { type: 'finish-assistant'; chatId: ChatId; messageId: string; outcome: 'complete' | 'failed' | 'cancelled';
        content: string; actualModel?: ChatModelProvenance; failure?: string };
export interface ChatMutation { projectHandle: string; expectedRevision: number; operation: ChatOperation }
export interface ChatSearchRequest { projectHandle: string; query: string; limit: number; excludeChatId?: ChatId }
export interface ChatSearchHit { chatId: ChatId; messageId: string; title: string; excerpt: string; createdAt: string }
export interface ChatLeaseRequest { projectHandle: string; chatId: ChatId; ownerId: string }
export type ChatLeaseResult = { acquired: true; token: string } | { acquired: false; ownerId: string };
export type ChatEvent =
    | { projectHandle: string; revision: number; kind: 'changed' | 'lease-changed'; chatId?: ChatId }
    /** Transient visible output; persistence happens at turn lifecycle boundaries. */
    | { projectHandle: string; revision: number; kind: 'assistant-delta'; chatId: ChatId;
        messageId: string; executionId: string; sequence: number; delta: string };
export interface ChatClient { notifyChatEvent(event: ChatEvent): void }

/** Transport-neutral service. The backend owns persistence, revisions and lease enforcement. */
export interface ChatService {
    attach(folderUri: string): Promise<{ projectHandle: string; snapshot: ChatCollection }>;
    read(projectHandle: string): Promise<ChatCollection>;
    list(projectHandle: string): Promise<Chat[]>;
    get(projectHandle: string, chatId: ChatId): Promise<Chat | undefined>;
    mutate(request: ChatMutation): Promise<ChatCollection>;
    search(request: ChatSearchRequest): Promise<ChatSearchHit[]>;
    claim(request: ChatLeaseRequest): Promise<ChatLeaseResult>;
    release(projectHandle: string, chatId: ChatId, token: string): Promise<void>;
}
