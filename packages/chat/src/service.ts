import type { Chat, ChatCollection, ChatColor, ChatContextKind, ChatContextRef, ChatFolderPath, ChatId, ChatMessage,
    ChatExecution, ChatModelProvenance, ChatModelSelection, ChatPlanningActivity, ChatSettings } from './index';
import type { RoutingProvenance } from '@dope/ai';
import type { ChatExecutionActivity, ChatActivityKind } from './activity';

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
    | { type: 'delete-chat'; chatId: ChatId }
    | { type: 'automatic-title'; chatId: ChatId; title: string; firstUserMessageId: string; firstAssistantMessageId: string }
    | { type: 'set-settings'; chatId: ChatId; settings: ChatSettings }
    | { type: 'set-color'; chatId: ChatId; color: ChatColor }
    | { type: 'append-user'; chatId: ChatId; message: ChatMessage & { role: 'user' } }
    | { type: 'revise-user-context'; chatId: ChatId; userMessageId: string; assistantMessageId: string;
        contextRefs: ChatContextRef[] }
    | { type: 'begin-assistant'; chatId: ChatId; message: ChatMessage & { role: 'assistant' } }
    | { type: 'start-assistant'; chatId: ChatId; messageId: string; actualModel: ChatModelProvenance;
        routingProvenance?: RoutingProvenance }
    | { type: 'record-assistant-activity'; chatId: ChatId; messageId: string; activity: ChatExecutionActivity }
    | { type: 'finish-assistant'; chatId: ChatId; messageId: string; outcome: 'complete' | 'failed' | 'cancelled';
        content: string; activity?: ChatExecutionActivity; actualModel?: ChatModelProvenance; routingProvenance?: RoutingProvenance; failure?: string;
        planningActivity?: ChatPlanningActivity;
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
export interface ChatSkill { id: string; name: string; title: string; description: string; body: string;
    enabled: boolean; provenance: 'builtin' | 'user'; version: number }
export interface ChatSkillSnapshot { id: string; name: string; title?: string; description?: string;
    body: string; version: number; digest: string }
export type ChatSkillChange = { type: 'add'; name: string; title?: string; description: string; body: string } |
    { type: 'edit'; id: string; name: string; title?: string; description: string; body: string } |
    { type: 'enable'; id: string; enabled: boolean } | { type: 'delete'; id: string };
/** Captured editor text is transport-only. Other IDs are resolved against current project authorities. */
export interface ChatContextSelection { kind: ChatContextKind; id: string; projectId?: string; generation?: number;
    ownerRevision?: number; sourceHash?: string; draftHandle?: string; draftRevision?: number;
    elementKind?: 'phase' | 'gate' | 'criterion' | 'correction';
    label?: string;
    messageId?: string; text?: string; start?: number; end?: number; direction?: 'upstream' | 'downstream' }
export interface ChatContextDiagnostic { kind: 'omitted' | 'truncated' | 'history'; source: string; message: string }
export interface ChatContextPreview { refs: ChatContextRef[]; diagnostics: ChatContextDiagnostic[]; usedTokens: number; budgetTokens: number }
export interface ChatPlanningProposal { id: string; chatId: ChatId; messageId: string; ownerId: string;
    revision: number; generation?: number; sourceHash?: string; changedIds: string[];
    counts?: { phases: number; gates: number; criteria: number }; warnings?: string[];
    action: { type: string; id: string }; summary: string;
    operations?: { id: string; type: string; targetId: string; targetIds?: string[];
        status: 'Pending' | 'Applied' | 'Rejected' | 'Stale' | 'Conflict' | 'Denied' | 'Failed' | 'Superseded' }[];
    previewOnly?: boolean;
    publication?: { mode: 'publish' | 'link'; path: string; sourceHash: string;
        phaseCount: number; gateCount: number; criterionCount: number;
        warnings: string[]; content?: string; compatible?: boolean; diagnostics?: string[] };
    preview?: { source: 'validated-roadmap' | 'validated-markdown-patch';
        steps: { type: string; id: string; title: string; affectedCount: number }[];
        entities: { id: string; action: 'create' | 'edit' | 'delete'; before?: ChatRoadmapPreviewEntity;
            after?: ChatRoadmapPreviewEntity }[];
        totalChanged: number; additionalChanges: number; parentTitles: Record<string, string>;
        sourceChanges?: { before: string; after: string }[]; additionalSourceChanges?: number } }
export interface ChatRoadmapPreviewEntity { kind: 'phase' | 'gate' | 'criterion' | 'correction'; id: string;
    title?: string; detail?: string; designation?: string; parentId?: string; order?: number;
    dependencies?: string[]; criteria?: { id: string; title: string; expectedResult: string }[];
    additionalCriteria?: number }
export interface ChatTurnResult extends ChatContextPreview { proposal?: ChatPlanningProposal;
    roadmapFocus?: { projectId: string; revision: number; id: string };
    proposalError?: string }
export type ChatCommandMode = 'ask' | 'allow';
export interface ChatCommandPreview { id: string; command: string; project: string; cwd: string;
    sandbox: string; effect: string; expiresAt: number }
export type ChatEvent =
    | { projectHandle: string; revision: number; kind: 'changed' | 'lease-changed'; chatId?: ChatId }
    | { projectHandle: string; kind: 'planning-progress'; chatId: ChatId; messageId: string;
        stage: 'waiting' | 'validating' | 'failed' | 'cancelled' }
    | { projectHandle: string; kind: 'roadmap-stage'; chatId: ChatId; messageId: string;
        snapshot: ChatRoadmapStageSnapshot | null; reason?: 'cancelled' | 'failed' | 'stale';
        generation?: { generationId: string; proposalId: string; seq: number;
            status: 'generating' | 'ready' | 'incomplete' | 'failed' | 'cancelled' | 'stale';
            counts: ChatRoadmapStageSnapshot['counts']; projectionRevision: number } }
    /** Transient visible output; persistence happens at turn lifecycle boundaries. */
    | { projectHandle: string; revision: number; kind: 'assistant-delta'; chatId: ChatId;
        messageId: string; executionId: string; sequence: number; delta: string }
    | { projectHandle: string; kind: 'assistant-activity'; chatId: ChatId;
        messageId: string; executionId: string; sequence: number; activityKind: ChatActivityKind; text: string }
    | { projectHandle: string; kind: 'command-pending'; chatId: ChatId; preview: ChatCommandPreview }
    | { projectHandle: string; kind: 'command-settled'; chatId: ChatId; id: string }
    | { projectHandle: string; kind: 'tool-progress'; chatId: ChatId; messageId: string;
        name: NonNullable<ChatExecution['toolEvents']>[number]['name'];
        status: 'running' | 'completed' | 'failed' | 'denied'; truncated?: boolean; detail?: string; target?: string };
export interface ChatClient { notifyChatEvent(event: ChatEvent): void }
/** Observation only: this contains no approval lease or canonical write authority. */
export interface ChatRoadmapStageSnapshot {
    proposalId: string; chatId: ChatId; turnId: string; projectId: string; ownerId: string;
    revision: number; sourceHash: string | null; sequence: number; expiresAt: number;
    operationIds: string[]; entityIds: string[];
    counts: { phases: number; gates: number; criteria: number };
    incompletePhaseIds: string[]; complete: boolean; isolated?: boolean;
    preview: NonNullable<ChatPlanningProposal['preview']>;
}

/** Transport-neutral service. The backend owns persistence, revisions and lease enforcement. */
export interface ChatService {
    listSkills(): Promise<ChatSkill[]>;
    changeSkill(change: ChatSkillChange): Promise<ChatSkill[]>;
    attach(folderUri: string): Promise<{ projectHandle: string; snapshot: ChatCollection }>;
    read(projectHandle: string): Promise<ChatCollection>;
    list(projectHandle: string): Promise<Chat[]>;
    get(projectHandle: string, chatId: ChatId): Promise<Chat | undefined>;
    readNativeRoadmapStage(projectHandle: string, chatId: ChatId, turnId: string,
        leaseToken: string): Promise<ChatRoadmapStageSnapshot | undefined>;
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
    /** Protected review staging. Proposed bytes are inert until a separate approved apply. */
    reviewDocumentation(projectHandle: string, chatId: ChatId, leaseToken: string, messageId: string,
        changes: { path: string; after: string }[]): Promise<import('./index').ChatDocumentationProposal>;
    dismissDocumentation(projectHandle: string, chatId: ChatId, leaseToken: string,
        proposalId: string, decision: 'deny' | 'cancel'): Promise<void>;
    reviewNativeRoadmap(projectHandle: string, chatId: ChatId, leaseToken: string, proposalId: string,
        operationIds: string[], decision: 'apply' | 'reject'):
        Promise<{ token: string; summary: string; preview?: ChatPlanningProposal['preview'] }>;
    reviseNativeRoadmap(projectHandle: string, chatId: ChatId, leaseToken: string, proposalId: string,
        expectedGeneration: number, operationId: string, entityId: string,
        field: 'title' | 'objective' | 'purpose' | 'expectedResult', value: string): Promise<ChatPlanningProposal>;
    decideNativeRoadmap(projectHandle: string, chatId: ChatId, leaseToken: string, proposalId: string,
        operationIds: string[], decision: 'apply' | 'reject', token: string):
        Promise<{ revision?: number; changedIds: string[]; proposal?: ChatPlanningProposal }>;
    cancelTurn(projectHandle: string, chatId: ChatId, leaseToken: string): Promise<void>;
}
