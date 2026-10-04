import type { Chat, ChatCollection, ChatColor, ChatContextKind, ChatContextRef, ChatFolderPath, ChatId, ChatMessage,
    ChatModelProvenance, ChatModelSelection, ChatSettings } from './index';

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
    | { type: 'automatic-title'; chatId: ChatId; title: string; firstUserMessageId: string; firstAssistantMessageId: string }
    | { type: 'set-settings'; chatId: ChatId; settings: ChatSettings }
    | { type: 'set-color'; chatId: ChatId; color: ChatColor }
    | { type: 'append-user'; chatId: ChatId; message: ChatMessage & { role: 'user' } }
    | { type: 'begin-assistant'; chatId: ChatId; message: ChatMessage & { role: 'assistant' } }
    | { type: 'start-assistant'; chatId: ChatId; messageId: string; actualModel: ChatModelProvenance }
    | { type: 'finish-assistant'; chatId: ChatId; messageId: string; outcome: 'complete' | 'failed' | 'cancelled';
        content: string; actualModel?: ChatModelProvenance; failure?: string };
export interface ChatMutation { projectHandle: string; expectedRevision: number; operation: ChatOperation; leaseToken?: string }
export interface ChatSearchRequest { projectHandle: string; query: string; limit: number; excludeChatId?: ChatId }
export interface ChatSearchHit { chatId: ChatId; messageId: string; title: string; excerpt: string; createdAt: string }
export interface ChatLeaseRequest { projectHandle: string; chatId: ChatId; ownerId: string }
export type ChatLeaseResult = { acquired: true; token: string } | { acquired: false; ownerId: string };
export interface ChatDeltaRequest { projectHandle: string; chatId: ChatId; messageId: string;
    executionId: string; sequence: number; delta: string; leaseToken: string }
export interface ChatTurnRequest { projectHandle: string; chatId: ChatId; leaseToken: string;
    selectedModel: ChatModelSelection; content?: string; retryMessageId?: string; context?: ChatContextSelection[] }
/** Captured editor text is transport-only. Other IDs are resolved against current project authorities. */
export interface ChatContextSelection { kind: ChatContextKind; id: string; projectId?: string; generation?: number;
    messageId?: string; text?: string; start?: number; end?: number; direction?: 'upstream' | 'downstream' }
export interface ChatContextDiagnostic { kind: 'omitted' | 'truncated' | 'history'; source: string; message: string }
export interface ChatContextPreview { refs: ChatContextRef[]; diagnostics: ChatContextDiagnostic[]; usedTokens: number; budgetTokens: number }
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
    previewContext(request: { projectHandle: string; chatId: ChatId; selectedModel: ChatModelSelection;
        content: string; context: ChatContextSelection[] }): Promise<ChatContextPreview>;
    claim(request: ChatLeaseRequest): Promise<ChatLeaseResult>;
    renew(projectHandle: string, chatId: ChatId, token: string): Promise<void>;
    release(projectHandle: string, chatId: ChatId, token: string): Promise<void>;
    publishDelta(request: ChatDeltaRequest): Promise<void>;
    runTurn(request: ChatTurnRequest): Promise<ChatContextPreview>;
    cancelTurn(projectHandle: string, chatId: ChatId, leaseToken: string): Promise<void>;
}
