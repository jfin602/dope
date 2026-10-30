import type { Chat, ChatCollection, ChatColor, ChatContextKind, ChatContextRef, ChatFolderPath, ChatId, ChatMessage,
    ChatExecution, ChatModelProvenance, ChatModelSelection, ChatSettings } from './index';
import type { RoutingProvenance } from '@dope/ai';

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
    | { type: 'revise-user-context'; chatId: ChatId; userMessageId: string; assistantMessageId: string;
        contextRefs: ChatContextRef[] }
    | { type: 'begin-assistant'; chatId: ChatId; message: ChatMessage & { role: 'assistant' } }
    | { type: 'start-assistant'; chatId: ChatId; messageId: string; actualModel: ChatModelProvenance;
        routingProvenance?: RoutingProvenance }
    | { type: 'finish-assistant'; chatId: ChatId; messageId: string; outcome: 'complete' | 'failed' | 'cancelled';
        content: string; actualModel?: ChatModelProvenance; routingProvenance?: RoutingProvenance; failure?: string;
        contextUsage?: ChatExecution['contextUsage']; tokenUsage?: ChatExecution['tokenUsage'];
        compaction?: ChatExecution['compaction']; finishReason?: string;
        sourceRefs?: ChatExecution['sourceRefs']; toolEvents?: ChatExecution['toolEvents'] };
export interface ChatMutation { projectHandle: string; expectedRevision: number; operation: ChatOperation; leaseToken?: string }
export interface ChatSearchRequest { projectHandle: string; query: string; limit: number; excludeChatId?: ChatId }
export interface ChatSearchHit { chatId: ChatId; messageId: string; title: string; excerpt: string; createdAt: string }
export interface ChatLeaseRequest { projectHandle: string; chatId: ChatId; ownerId: string }
export type ChatLeaseResult = { acquired: true; token: string } | { acquired: false; ownerId: string; retryAfterMs: number };
export interface ChatDeltaRequest { projectHandle: string; chatId: ChatId; messageId: string;
    executionId: string; sequence: number; delta: string; leaseToken: string }
export interface ChatTurnRequest { projectHandle: string; chatId: ChatId; leaseToken: string;
    selectedModel?: ChatModelSelection; hostedProjectDataAuthorized?: boolean;
    content?: string; retryMessageId?: string; context?: ChatContextSelection[];
    /** Explicit, capped opt-in for an atomic preview of small unlinked Roadmap edits. */
    planningSteps?: 2 | 3;
    /** Explicit selected-checkpoint, local-only Bridge suggestion; never a write grant. */
    bridgeProposal?: { projectId: string; checkpointId: string; roadmapRevision: number;
        mapId: string; mapRevision: number; branchIds: string[] } }
/** Captured editor text is transport-only. Other IDs are resolved against current project authorities. */
export interface ChatContextSelection { kind: ChatContextKind; id: string; projectId?: string; generation?: number;
    ownerRevision?: number; sourceHash?: string;
    messageId?: string; text?: string; start?: number; end?: number; direction?: 'upstream' | 'downstream' }
export interface ChatContextDiagnostic { kind: 'omitted' | 'truncated' | 'history'; source: string; message: string }
export interface ChatContextPreview { refs: ChatContextRef[]; diagnostics: ChatContextDiagnostic[]; usedTokens: number; budgetTokens: number }
export interface ChatPlanningProposal { id: string; chatId: ChatId; messageId: string; ownerId: string;
    revision: number; changedIds: string[]; action: { type: string; id: string }; summary: string }
/** A transient, noncanonical permission to attempt one draft generation. Never a draft or publication grant. */
export interface ChatRoadmapOffer { id: string; token: string; projectHandle: string; projectId: string; chatId: ChatId; messageId: string;
    ownerId: string; ownerRevision: number; basis: 'empty-owner'; expiresAt: number }
export interface ChatStrategicDraftReview { token: string; projectId: string; revision: number; diagnostic?: string;
    draft: { revision: number; phases: { id: string; title: string; objective: string;
        kind?: 'correction'; parentId?: string; gates?: { id: string; parentPhaseId: string; designation: string;
            title: string; purpose: string; criteria: { id: string; title: string; expectedResult: string }[] }[];
        checkpoints: { id: string; title: string; objective: string;
            dependencies?: string[] }[] }[] };
    phases: { title: string; objective: string; gates?: { id: string; parentPhaseId: string; designation: string;
        title: string; purpose: string; criteria: { id: string; title: string; expectedResult: string }[] }[];
        checkpoints: { id: string; title: string; objective: string;
        dependencies: string[] }[] }[] }
export interface ChatPlanPreview { coverage: { id: string; text: string;
    status: 'covered' | 'needs-review' | 'missing'; explanation: string; stepNumbers: number[] }[] }
export interface ChatTurnResult extends ChatContextPreview { proposal?: ChatPlanningProposal;
    roadmapFocus?: { projectId: string; revision: number; id: string };
    proposalError?: string; planPreview?: ChatPlanPreview; roadmapOffer?: ChatRoadmapOffer;
    roadmapDraftReview?: ChatStrategicDraftReview }
export type ChatCommandMode = 'ask' | 'allow';
export interface ChatCommandPreview { id: string; command: string; project: string; cwd: string;
    sandbox: string; effect: string; expiresAt: number }
export type ChatEvent =
    | { projectHandle: string; revision: number; kind: 'changed' | 'lease-changed'; chatId?: ChatId }
    | { projectHandle: string; kind: 'planning-progress'; chatId: ChatId; messageId: string;
        stage: 'waiting' | 'validating' | 'checking-owner' | 'generating-draft' | 'validating-draft' | 'preparing-draft' | 'draft-ready' | 'cancelled' | 'failed' }
    /** Transient visible output; persistence happens at turn lifecycle boundaries. */
    | { projectHandle: string; revision: number; kind: 'assistant-delta'; chatId: ChatId;
        messageId: string; executionId: string; sequence: number; delta: string }
    | { projectHandle: string; kind: 'command-pending'; chatId: ChatId; preview: ChatCommandPreview }
    | { projectHandle: string; kind: 'command-settled'; chatId: ChatId; id: string }
    | { projectHandle: string; kind: 'tool-progress'; chatId: ChatId; messageId: string;
        name: NonNullable<ChatExecution['toolEvents']>[number]['name'];
        status: 'running' | 'completed' | 'failed' | 'denied'; truncated?: boolean };
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
    runTurn(request: ChatTurnRequest): Promise<ChatTurnResult>;
    setCommandMode(projectHandle: string, chatId: ChatId, leaseToken: string, mode: ChatCommandMode): Promise<void>;
    decideCommand(projectHandle: string, chatId: ChatId, leaseToken: string,
        requestId: string, allowOnce: boolean): Promise<void>;
    decidePlanningProposal(projectHandle: string, chatId: ChatId, leaseToken: string,
        proposalId: string, approve: boolean): Promise<{ revision: number; changedIds: string[] } | undefined>;
    decideRoadmapOffer(projectHandle: string, chatId: ChatId, leaseToken: string,
        offerId: string, token: string, approve: boolean, selectedModel?: ChatModelSelection): Promise<'declined' | ChatStrategicDraftReview>;
    decideStrategicDraft(projectHandle: string, chatId: ChatId, leaseToken: string,
        token: string, approve: boolean): Promise<number | undefined>;
    undoPlanningRevision(projectHandle: string, chatId: ChatId, leaseToken: string,
        expectedRevision: number): Promise<number>;
    cancelTurn(projectHandle: string, chatId: ChatId, leaseToken: string): Promise<void>;
}
