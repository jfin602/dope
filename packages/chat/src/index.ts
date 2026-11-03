import { parseRoutingProvenance, type RoutingProvenance } from '@dope/ai';
import { parseExecutionActivity, type ChatExecutionActivity } from './activity';
export { ChatActivityRecorder, parseExecutionActivity, safeChatToolPath } from './activity';
export type { ChatActivityEvent, ChatActivityKind, ChatExecutionActivity } from './activity';

/** Project Chat identity belongs to Dope; neither storage paths nor runtime IDs define it. */
export type ChatId = string;
export type ChatFolderPath = string; // Root is ''. Other paths use slash-separated safe names.
export type ChatTitleSource = 'placeholder' | 'automatic' | 'developer';
export const CHAT_COLORS = ['blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo'] as const;
export type ChatColor = typeof CHAT_COLORS[number];
export type AssistantStatus = 'pending' | 'streaming' | 'complete' | 'failed' | 'cancelled';
export type ChatContextKind = 'editor' | 'selection' | 'file' | 'project-mind' | 'architecture' |
    'physical-map' | 'flow' | 'planning-map' | 'work-item' | 'roadmap-checkpoint' | 'roadmap' | 'saved-chat' | 'directory' | 'path-search' | 'text-search' | 'project-orientation' | 'grounding-status';
/** Sources a person can explicitly attach. Saved Chat also requires savedChatSearch. */
export const MANUAL_CHAT_CONTEXT_SOURCES: readonly ChatContextKind[] = ['editor', 'selection', 'file',
    'project-mind', 'architecture', 'physical-map', 'flow', 'planning-map', 'work-item',
    'roadmap-checkpoint', 'roadmap', 'saved-chat'];

export interface ChatContextRef {
    schemaVersion: 1;
    kind: ChatContextKind;
    id: string; // Project-relative path or Dope-owned artifact identity, according to kind.
    label: string;
    origin?: 'manual' | 'automatic' | 'tool'; // Omitted on older persisted refs; those are manual.
    excerpt?: string;
    estimatedTokens: number;
    includedBytes?: number;
    contentHash?: string;
    projectId?: string;
    generation?: number;
    ownerRevision?: number;
    sourceHash?: string;
    draftHandle?: string;
    draftRevision?: number;
    elementKind?: 'phase' | 'gate' | 'criterion' | 'correction';
    messageId?: string;
    start?: number;
    end?: number;
}

/** A connection is a runtime configuration reference, never a credential or canonical Chat identity. */
export interface ChatModelSelection { connectionId: string; modelId: string }
export interface ChatModelProvenance extends ChatModelSelection { schemaVersion: 1; providerId: string; modelLabel: string }
export type ChatModelPolicy = { type: 'exact'; model: ChatModelSelection } | { type: 'follow-interactive' };

export interface ChatContextPolicy {
    maxInputTokens: number;
    reservedOutputTokens: number;
    history: 'recent' | 'none';
    savedChatSearch: boolean;
    allowedSources: ChatContextKind[];
}
export interface ChatSettings {
    schemaVersion: 1;
    modelPolicy: ChatModelPolicy;
    reasoningControls?: Record<string, string>;
    reasoningDisplay?: { mode: 'paragraphs' | 'short-chunks' | 'live-tokens'; fadeIn: boolean };
    context: ChatContextPolicy;
}

export interface ChatExecution {
    schemaVersion: 1;
    id: string;
    status: AssistantStatus;
    selectedModel: ChatModelSelection; // Snapshotted at Send; never rewritten by settings.
    resolutionSource?: 'explicit-turn' | 'chat-exact-default' | 'role-policy';
    actualModel?: ChatModelProvenance; // Set when a runtime starts, then immutable.
    routingProvenance?: RoutingProvenance;
    startedAt: string;
    finishedAt?: string;
    failure?: string; // User-safe summary; no raw provider payload.
    contextUsage?: { usedTokens: number; budgetTokens: number };
    tokenUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number;
        tokenMeasurement: 'provider-reported' | 'tokenizer' | 'estimated' | 'unavailable' };
    compaction?: { canonicalContextSha256: string; originalSha256: string;
        compactedSha256: string; tokensBefore: number };
    finishReason?: string;
    sourceRefs?: ChatContextRef[];
    toolEvents?: { name: 'read_file' | 'list_files' | 'search_paths' | 'search_text' | 'run_command' |
        'dope_read' | 'dope_list' | 'dope_search_paths' | 'dope_search_text' | 'dope_command' |
        'roadmap_read' | 'roadmap_stage' | 'roadmap_cancel';
        status: 'completed' | 'failed' | 'denied'; truncated: boolean;
        code?: string; stage?: string; brokerExecuted?: boolean;
        offset?: number; pageSize?: number; sourceHashSupplied?: boolean; endOffset?: number;
        commandMode?: 'ask' | 'allow'; approval?: 'granted' | 'denied' | 'expired';
        commandExecuted?: boolean; commandDigest?: string }[];
}
export interface ChatUserMessage {
    schemaVersion: 1;
    id: string;
    role: 'user';
    createdAt: string;
    content: string;
    contextRefs: ChatContextRef[];
    skill?: import('./service').ChatSkillSnapshot;
}
export interface ChatAssistantMessage {
    schemaVersion: 1;
    id: string;
    role: 'assistant';
    createdAt: string;
    content: string; // Only successfully completed final answer is conversational content.
    execution: ChatExecution;
    activity?: ChatExecutionActivity; // Isolated diagnostics; never prompt context or search content.
    planningActivity?: ChatPlanningActivity; // Backend-verified projection; content remains the exact model output.
    roadmapAction?: ChatRoadmapAction;
}
/** Durable, backend-verified outcome. An approval token is deliberately never saved here. */
export interface ChatRoadmapAction {
    schemaVersion: 1;
    offerId: string;
    /** The completed assistant response that owns this action. */
    sourceMessageId?: string;
    sourceContentHash?: string;
    projectId: string;
    chatId: string;
    ownerRevision: number;
    status: 'offered' | 'generating' | 'ready' | 'accepted' | 'rejected' | 'declined' | 'failed' | 'cancelled' | 'stale';
    stage?: 'checking-owner' | 'generating-draft' | 'validating-draft' | 'preparing-draft';
    draftRevision?: number;
    diagnostic?: string;
}
export interface ChatPlanningActivity {
    schemaVersion: 1;
    kind: 'roadmap-intent' | 'roadmap-proposal' | 'roadmap-sequence' | 'roadmap-gate-proposal' | 'roadmap-gate-undo' | 'roadmap-publication' | 'roadmap-gate-focus' | 'roadmap-draft-proposal' | 'roadmap-draft-sequence' | 'implementation-plan' | 'implementation-plan-revision' | 'bridge-proposal' | 'no-action' | 'error' | 'cancelled';
    status: 'pending' | 'suggested' | 'no-action' | 'rejected' | 'denied' | 'stale' | 'superseded' | 'applied' | 'failed' | 'cancelled';
    refs: ChatContextRef[];
    proposalId?: string;
    appliedRevision?: number;
    /** Bounded, inert review presentation. Saved history never grants approval authority. */
    proposal?: import('./service').ChatPlanningProposal;
    diagnostic?: string;
    /** Backend-verified UI guidance captured for this turn; model content remains untouched. */
    verifiedGuidance?: { capabilityId: string; version: string; text: string };
}
export type ChatMessage = ChatUserMessage | ChatAssistantMessage;

export interface Chat {
    schemaVersion: 1;
    id: ChatId;
    revision: number;
    folderPath: ChatFolderPath;
    title: string;
    titleSource: ChatTitleSource;
    color: ChatColor;
    createdAt: string;
    updatedAt: string;
    lastInteractedAt: string; // Changes on conversation activity, never on view/restore.
    settings: ChatSettings;
    messages: ChatMessage[];
}
export interface ChatFolder {
    schemaVersion: 1;
    path: ChatFolderPath;
    createdAt: string;
}
export interface ChatCollection {
    schemaVersion: 1;
    revision: number;
    folders: ChatFolder[];
    chats: Chat[];
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const contextKinds: readonly ChatContextKind[] = ['editor', 'selection', 'file', 'project-mind', 'architecture',
    'physical-map', 'flow', 'planning-map', 'work-item', 'roadmap-checkpoint', 'roadmap', 'saved-chat', 'directory', 'path-search', 'text-search', 'project-orientation', 'grounding-status'];
const statuses: readonly AssistantStatus[] = ['pending', 'streaming', 'complete', 'failed', 'cancelled'];

export function parseChatColor(value: unknown): ChatColor { return choice(value, CHAT_COLORS, 'Chat color'); }

/** FNV-1a over the stable Chat ID; no mutable Chat metadata affects the default. */
export function assignedChatColor(id: ChatId): ChatColor {
    let hash = 2166136261;
    for (const character of identifier(id).toLowerCase()) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
    return CHAT_COLORS[(hash >>> 0) % CHAT_COLORS.length];
}

function record(value: unknown, keys: readonly string[], required: readonly string[]): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Chat record');
    const result = value as Record<string, unknown>;
    if (Object.keys(result).some(key => !keys.includes(key)) || required.some(key => !Object.hasOwn(result, key)))
        throw new Error('Invalid Chat fields');
    return result;
}
function string(value: unknown, label: string, nonempty = true): string {
    if (typeof value !== 'string' || (nonempty && !value.trim())) throw new Error(`Invalid ${label}`);
    return value;
}
function identifier(value: unknown): string {
    const id = string(value, 'Chat ID');
    if (!uuid.test(id)) throw new Error('Invalid Chat ID');
    return id;
}
function time(value: unknown): string {
    const timestamp = string(value, 'timestamp');
    if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(timestamp) ||
        !Number.isFinite(Date.parse(timestamp))) throw new Error('Invalid timestamp');
    return timestamp;
}
function count(value: unknown, label: string, positive = false): number {
    if (!Number.isSafeInteger(value) || (value as number) < (positive ? 1 : 0)) throw new Error(`Invalid ${label}`);
    return value as number;
}
function boolean(value: unknown, label: string): boolean {
    if (typeof value !== 'boolean') throw new Error(`Invalid ${label}`);
    return value;
}
function nonnegativeInteger(value: unknown, label: string): number { return count(value, label); }
function sha256(value: unknown, label: string): string {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/u.test(value)) throw new Error(`Invalid ${label}`);
    return value;
}
function choice<T extends string>(value: unknown, values: readonly T[], label: string): T {
    if (!values.includes(value as T)) throw new Error(`Invalid ${label}`);
    return value as T;
}

/** Validates a project-local organization path without silently normalizing traversal or separators. */
export function parseChatFolderPath(value: unknown): ChatFolderPath {
    if (typeof value !== 'string' || value.startsWith('/') || value.includes('\\') ||
        value.split('/').some(part => part === '.' || part === '..' || part.includes('\0') ||
            /[\u0000-\u001f\u007f]/.test(part) || part.trim() !== part || (!part && value !== '')))
        throw new Error('Invalid Chat folder path');
    return value;
}
export function joinChatFolderPath(parent: ChatFolderPath, name: string): ChatFolderPath {
    parseChatFolderPath(parent);
    if (!name || name.includes('/')) throw new Error('Invalid Chat folder name');
    parseChatFolderPath(name);
    return parent ? `${parent}/${name}` : name;
}
export function isChatFolderWithin(path: ChatFolderPath, ancestor: ChatFolderPath): boolean {
    parseChatFolderPath(path);
    parseChatFolderPath(ancestor);
    return ancestor === '' || path === ancestor || path.startsWith(`${ancestor}/`);
}

export function parseChatModelSelection(value: unknown): ChatModelSelection {
    const v = record(value, ['connectionId', 'modelId'], ['connectionId', 'modelId']);
    return { connectionId: string(v.connectionId, 'connection ID'), modelId: string(v.modelId, 'model ID') };
}
export function parseChatModelPolicy(value: unknown): ChatModelPolicy {
    const v = record(value, ['type', 'model'], ['type']);
    if (v.type === 'follow-interactive' && v.model === undefined) return { type: 'follow-interactive' };
    if (v.type === 'exact') return { type: 'exact', model: parseChatModelSelection(v.model) };
    throw new Error('Invalid Chat model policy');
}
function parseModelProvenance(value: unknown): ChatModelProvenance {
    const v = record(value, ['schemaVersion', 'connectionId', 'modelId', 'providerId', 'modelLabel'],
        ['schemaVersion', 'connectionId', 'modelId', 'providerId', 'modelLabel']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported model provenance schema');
    return { schemaVersion: 1, ...parseChatModelSelection({ connectionId: v.connectionId, modelId: v.modelId }),
        providerId: string(v.providerId, 'provider ID'), modelLabel: string(v.modelLabel, 'model label') };
}
export function parseChatContextRef(value: unknown): ChatContextRef {
    const v = record(value, ['schemaVersion', 'kind', 'id', 'label', 'origin', 'excerpt', 'estimatedTokens',
        'includedBytes', 'contentHash', 'projectId', 'generation', 'ownerRevision', 'sourceHash', 'draftHandle', 'draftRevision', 'elementKind', 'messageId', 'start', 'end'],
        ['schemaVersion', 'kind', 'id', 'label', 'estimatedTokens']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported context reference schema');
    const ref: ChatContextRef = { schemaVersion: 1, kind: choice(v.kind, contextKinds, 'context kind'), id: string(v.id, 'context ID'),
        label: string(v.label, 'context label'), estimatedTokens: count(v.estimatedTokens, 'context tokens') };
    if (v.origin !== undefined) ref.origin = choice(v.origin, ['manual', 'automatic', 'tool'] as const, 'context origin');
    if (v.excerpt !== undefined) ref.excerpt = string(v.excerpt, 'context excerpt', false);
    if (v.includedBytes !== undefined) ref.includedBytes = count(v.includedBytes, 'included bytes');
    if (v.contentHash !== undefined) {
        if (typeof v.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(v.contentHash)) throw new Error('Invalid context hash');
        ref.contentHash = v.contentHash;
    }
    if (v.projectId !== undefined) ref.projectId = string(v.projectId, 'context project ID');
    if (v.generation !== undefined) ref.generation = count(v.generation, 'context generation');
    if (v.ownerRevision !== undefined) ref.ownerRevision = count(v.ownerRevision, 'context owner revision');
    if (v.draftHandle !== undefined) ref.draftHandle = string(v.draftHandle, 'context draft handle');
    if (v.draftRevision !== undefined) ref.draftRevision = count(v.draftRevision, 'context draft revision');
    if ((ref.draftHandle === undefined) !== (ref.draftRevision === undefined) ||
        ref.draftHandle !== undefined && (ref.kind !== 'roadmap' || ref.elementKind === undefined && v.elementKind === undefined))
        throw new Error('Invalid Roadmap draft context');
    if (v.elementKind !== undefined) {
        if (ref.kind !== 'roadmap') throw new Error('Roadmap element kind requires Roadmap context');
        ref.elementKind = choice(v.elementKind, ['phase', 'gate', 'criterion', 'correction'] as const,
            'Roadmap element kind');
    }
    if (v.sourceHash !== undefined) {
        if (typeof v.sourceHash !== 'string' || !/^[0-9a-f]{64}$/.test(v.sourceHash)) throw new Error('Invalid context source hash');
        ref.sourceHash = v.sourceHash;
    }
    if (v.messageId !== undefined) ref.messageId = string(v.messageId, 'context message ID');
    if (v.start !== undefined) ref.start = count(v.start, 'context start');
    if (v.end !== undefined) ref.end = count(v.end, 'context end');
    if (ref.end !== undefined && (ref.start === undefined || ref.end <= ref.start)) throw new Error('Invalid context bounds');
    return ref;
}
export function parseChatSettings(value: unknown): ChatSettings {
    const v = record(value, ['schemaVersion', 'modelPolicy', 'defaultModel', 'reasoningControls', 'reasoningDisplay', 'context'], ['schemaVersion', 'context']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported Chat settings schema');
    if (v.modelPolicy !== undefined && v.defaultModel !== undefined) throw new Error('Ambiguous Chat model policy');
    const c = record(v.context, ['maxInputTokens', 'reservedOutputTokens', 'history', 'savedChatSearch', 'allowedSources'],
        ['maxInputTokens', 'reservedOutputTokens', 'history', 'savedChatSearch', 'allowedSources']);
    if (typeof c.savedChatSearch !== 'boolean' || !Array.isArray(c.allowedSources)) throw new Error('Invalid context policy');
    const legacySources = c.allowedSources.map(source => choice(source, contextKinds, 'context source'));
    if (new Set(legacySources).size !== legacySources.length) throw new Error('Duplicate context source');
    const settings: ChatSettings = { schemaVersion: 1,
        modelPolicy: v.modelPolicy === undefined ? v.defaultModel === undefined ? { type: 'follow-interactive' } :
            { type: 'exact', model: parseChatModelSelection(v.defaultModel) } : parseChatModelPolicy(v.modelPolicy), context: {
        maxInputTokens: count(c.maxInputTokens, 'input budget', true),
        reservedOutputTokens: count(c.reservedOutputTokens, 'output reserve'),
        history: choice(c.history, ['recent', 'none'], 'history policy'),
        // Old per-source choices are accepted for saved Chat compatibility, then retired.
        savedChatSearch: c.savedChatSearch, allowedSources: [...MANUAL_CHAT_CONTEXT_SOURCES],
    } };
    if (v.reasoningControls !== undefined) {
        if (!v.reasoningControls || typeof v.reasoningControls !== 'object' || Array.isArray(v.reasoningControls))
            throw new Error('Invalid reasoning controls');
        settings.reasoningControls = Object.fromEntries(Object.entries(v.reasoningControls).map(([key, value]) =>
            [string(key, 'reasoning control'), string(value, 'reasoning value')]));
    }
    if (v.reasoningDisplay !== undefined) {
        const display = record(v.reasoningDisplay, ['mode', 'fadeIn'], ['mode', 'fadeIn']);
        if (typeof display.fadeIn !== 'boolean') throw new Error('Invalid reasoning animation preference');
        settings.reasoningDisplay = { mode: choice(display.mode,
            ['paragraphs', 'short-chunks', 'live-tokens'], 'reasoning display mode'), fadeIn: display.fadeIn };
    }
    return settings;
}
export function availableChatContextTokens(policy: ChatContextPolicy, modelWindowTokens: number): number {
    count(policy.maxInputTokens, 'input budget', true);
    count(policy.reservedOutputTokens, 'output reserve');
    count(modelWindowTokens, 'model window', true);
    return Math.max(0, Math.min(policy.maxInputTokens, modelWindowTokens - policy.reservedOutputTokens));
}

function parseExecution(value: unknown): ChatExecution {
    const v = record(value, ['schemaVersion', 'id', 'status', 'selectedModel', 'resolutionSource', 'actualModel', 'routingProvenance', 'startedAt', 'finishedAt', 'failure', 'contextUsage', 'tokenUsage', 'compaction', 'finishReason', 'sourceRefs', 'toolEvents'],
        ['schemaVersion', 'id', 'status', 'selectedModel', 'startedAt']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported execution schema');
    const execution: ChatExecution = { schemaVersion: 1, id: identifier(v.id), status: choice(v.status, statuses, 'assistant status'),
        selectedModel: parseChatModelSelection(v.selectedModel), startedAt: time(v.startedAt) };
    if (v.actualModel !== undefined) execution.actualModel = parseModelProvenance(v.actualModel);
    if (v.resolutionSource !== undefined) execution.resolutionSource = choice(v.resolutionSource,
        ['explicit-turn', 'chat-exact-default', 'role-policy'] as const, 'resolution source');
    if (v.routingProvenance !== undefined) execution.routingProvenance = parseRoutingProvenance(v.routingProvenance);
    if (v.finishedAt !== undefined) execution.finishedAt = time(v.finishedAt);
    if (v.failure !== undefined) execution.failure = string(v.failure, 'failure');
    const tokens = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0 &&
        (value as number) <= 1_000_000_000;
    if (v.contextUsage !== undefined) {
        const context = record(v.contextUsage, ['usedTokens', 'budgetTokens'], ['usedTokens', 'budgetTokens']);
        if (!tokens(context.usedTokens) || !tokens(context.budgetTokens) ||
            (context.usedTokens as number) > (context.budgetTokens as number)) throw new Error('Invalid Chat context usage');
        execution.contextUsage = { usedTokens: context.usedTokens as number, budgetTokens: context.budgetTokens as number };
    }
    if (v.tokenUsage !== undefined) {
        const usage = record(v.tokenUsage, ['inputTokens', 'outputTokens', 'totalTokens', 'reasoningTokens', 'tokenMeasurement'], ['tokenMeasurement']);
        if (usage.inputTokens !== undefined && !tokens(usage.inputTokens) ||
            usage.outputTokens !== undefined && !tokens(usage.outputTokens) ||
            usage.totalTokens !== undefined && !tokens(usage.totalTokens) ||
            usage.reasoningTokens !== undefined && (!tokens(usage.reasoningTokens) ||
                usage.outputTokens !== undefined && (usage.reasoningTokens as number) > (usage.outputTokens as number)))
            throw new Error('Invalid Chat token usage');
        execution.tokenUsage = { ...(usage.inputTokens === undefined ? {} : { inputTokens: usage.inputTokens as number }),
            ...(usage.outputTokens === undefined ? {} : { outputTokens: usage.outputTokens as number }),
            ...(usage.totalTokens === undefined ? {} : { totalTokens: usage.totalTokens as number }),
            ...(usage.reasoningTokens === undefined ? {} : { reasoningTokens: usage.reasoningTokens as number }),
            tokenMeasurement: choice(usage.tokenMeasurement,
                ['provider-reported', 'tokenizer', 'estimated', 'unavailable'] as const, 'token measurement') };
    }
    if (v.compaction !== undefined) {
        const compact = record(v.compaction, ['canonicalContextSha256', 'originalSha256', 'compactedSha256', 'tokensBefore'],
            ['canonicalContextSha256', 'originalSha256', 'compactedSha256', 'tokensBefore']);
        const sha = (item: unknown): item is string => typeof item === 'string' && /^[a-f0-9]{64}$/.test(item);
        if (!sha(compact.canonicalContextSha256) || !sha(compact.originalSha256) ||
            !sha(compact.compactedSha256) || !tokens(compact.tokensBefore)) throw new Error('Invalid Chat compaction identity');
        execution.compaction = { canonicalContextSha256: compact.canonicalContextSha256,
            originalSha256: compact.originalSha256, compactedSha256: compact.compactedSha256,
            tokensBefore: compact.tokensBefore as number };
    }
    if (v.finishReason !== undefined) execution.finishReason = string(v.finishReason, 'finish reason');
    if (v.sourceRefs !== undefined) {
        if (!Array.isArray(v.sourceRefs) || v.sourceRefs.length > 16) throw new Error('Invalid Chat source refs');
        execution.sourceRefs = v.sourceRefs.map(parseChatContextRef);
    }
    if (v.toolEvents !== undefined) {
        if (!Array.isArray(v.toolEvents) || v.toolEvents.length > 128) throw new Error('Invalid Chat tool events');
        execution.toolEvents = v.toolEvents.map(item => {
            const event = record(item, ['name', 'status', 'truncated', 'code', 'stage', 'brokerExecuted',
                'offset', 'pageSize', 'sourceHashSupplied', 'endOffset', 'commandMode', 'approval',
                'commandExecuted', 'commandDigest'], ['name', 'status', 'truncated']);
            if (typeof event.truncated !== 'boolean') throw new Error('Invalid Chat tool truncation');
            return { name: choice(event.name, ['read_file', 'list_files', 'search_paths', 'search_text', 'run_command',
                'dope_read', 'dope_list', 'dope_search_paths', 'dope_search_text', 'dope_command',
                'roadmap_read', 'roadmap_stage', 'roadmap_cancel'] as const,
                'Chat tool'), status: choice(event.status, ['completed', 'failed', 'denied'] as const, 'Chat tool status'),
                truncated: event.truncated,
                ...(event.code === undefined ? {} : { code: choice(event.code, ['INVALID_ARGUMENTS',
                    'INVALID_OFFSET', 'INVALID_PAGE_SIZE', 'SOURCE_IDENTITY_REQUIRED',
                    'INVALID_SOURCE_IDENTITY', 'STALE_SOURCE', 'OUTPUT_BUDGET', 'AUTHORITY_DENIED',
                    'COMMAND_INVALID', 'COMMAND_DENIED', 'COMMAND_EXPIRED'] as const, 'Chat tool code') }),
                ...(event.stage === undefined ? {} : { stage: choice(event.stage,
                    ['schema', 'argument-validation', 'source-identity', 'output-budget', 'broker', 'authority'] as const,
                    'Chat tool stage') }),
                ...(event.brokerExecuted === undefined ? {} : { brokerExecuted: boolean(event.brokerExecuted, 'broker execution') }),
                ...(event.offset === undefined ? {} : { offset: nonnegativeInteger(event.offset, 'tool offset') }),
                ...(event.pageSize === undefined ? {} : { pageSize: nonnegativeInteger(event.pageSize, 'tool page size') }),
                ...(event.sourceHashSupplied === undefined ? {} : { sourceHashSupplied: boolean(event.sourceHashSupplied, 'source hash supplied') }),
                ...(event.endOffset === undefined ? {} : { endOffset: nonnegativeInteger(event.endOffset, 'tool end offset') }),
                ...(event.commandMode === undefined ? {} : { commandMode: choice(event.commandMode, ['ask', 'allow'] as const, 'command mode') }),
                ...(event.approval === undefined ? {} : { approval: choice(event.approval,
                    ['granted', 'denied', 'expired'] as const, 'command approval') }),
                ...(event.commandExecuted === undefined ? {} : { commandExecuted: boolean(event.commandExecuted, 'command executed') }),
                ...(event.commandDigest === undefined ? {} : { commandDigest: sha256(event.commandDigest, 'command digest') }) };
        });
    }
    if (execution.actualModel && execution.actualModel.connectionId !== execution.selectedModel.connectionId &&
        execution.resolutionSource !== 'role-policy')
        throw new Error('Execution connection differs from selection');
    if (execution.routingProvenance && execution.actualModel &&
        (execution.routingProvenance.actualTarget.connectionId !== execution.actualModel.connectionId ||
            execution.routingProvenance.actualTarget.modelId !== execution.actualModel.modelId))
        throw new Error('Routing provenance differs from actual model');
    if (['complete', 'failed', 'cancelled'].includes(execution.status) !== Boolean(execution.finishedAt) ||
        (execution.status === 'failed') !== Boolean(execution.failure) ||
        (['streaming', 'complete'].includes(execution.status) && !execution.actualModel) ||
        (execution.finishedAt && Date.parse(execution.finishedAt) < Date.parse(execution.startedAt)))
        throw new Error('Invalid execution lifecycle');
    return execution;
}
export function parseChatMessage(value: unknown): ChatMessage {
    const v = record(value, ['schemaVersion', 'id', 'role', 'createdAt', 'content', 'contextRefs', 'skill', 'execution', 'activity', 'planningActivity', 'roadmapAction'],
        ['schemaVersion', 'id', 'role', 'createdAt', 'content']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported message schema');
    const base = { schemaVersion: 1 as const, id: identifier(v.id), createdAt: time(v.createdAt), content: string(v.content, 'message content', false) };
    if (v.role === 'user') {
        if (!Array.isArray(v.contextRefs) || v.execution !== undefined || v.activity !== undefined || v.planningActivity !== undefined || v.roadmapAction !== undefined || !base.content.trim()) throw new Error('Invalid user message');
        const skill = v.skill === undefined ? undefined : (() => {
            const s = record(v.skill, ['id', 'name', 'title', 'description', 'body', 'version', 'digest'],
                ['id', 'name', 'body', 'version', 'digest']);
            if (typeof s.id !== 'string' || typeof s.name !== 'string' || typeof s.body !== 'string' ||
                s.body.length > 1500 || !Number.isSafeInteger(s.version) || typeof s.digest !== 'string' ||
                s.title !== undefined && (typeof s.title !== 'string' || s.title.length > 80) ||
                s.description !== undefined && (typeof s.description !== 'string' || s.description.length > 240) ||
                !/^[a-f0-9]{64}$/.test(s.digest)) throw new Error('Invalid saved skill');
            return { id: s.id, name: s.name, body: s.body, version: s.version as number, digest: s.digest,
                ...(s.title ? { title: s.title } : {}), ...(s.description ? { description: s.description } : {}) };
        })();
        return { ...base, role: 'user', contextRefs: v.contextRefs.map(parseChatContextRef), ...(skill ? { skill } : {}) };
    }
    if (v.role === 'assistant') {
        if (v.contextRefs !== undefined) throw new Error('Invalid assistant message');
        const execution = parseExecution(v.execution);
        const activity = v.activity === undefined ? undefined : parseExecutionActivity(v.activity,
            (v.activity as ChatExecutionActivity).chatId, base.id, execution.id);
        const planningActivity = v.planningActivity === undefined ? undefined : parsePlanningActivity(v.planningActivity);
        const roadmapAction = v.roadmapAction === undefined ? undefined : parseChatRoadmapAction(v.roadmapAction);
        if (planningActivity && !['complete', 'failed', 'cancelled'].includes(execution.status))
            throw new Error('Planning activity requires a completed execution');
        if (planningActivity && (planningActivity.kind === 'error' ? execution.status !== 'failed' :
            planningActivity.kind === 'cancelled' ? execution.status !== 'cancelled' : execution.status !== 'complete'))
            throw new Error('Planning activity differs from execution outcome');
        return { ...base, role: 'assistant', execution, ...(activity ? { activity } : {}),
            ...(planningActivity ? { planningActivity } : {}),
            ...(roadmapAction ? { roadmapAction } : {}) };
    }
    throw new Error('Invalid Chat role');
}
export function parseChatRoadmapAction(value: unknown): ChatRoadmapAction {
    const v = record(value, ['schemaVersion', 'offerId', 'sourceMessageId', 'sourceContentHash', 'projectId', 'chatId', 'ownerRevision', 'status', 'stage', 'draftRevision', 'diagnostic'],
        ['schemaVersion', 'offerId', 'projectId', 'chatId', 'ownerRevision', 'status']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported Roadmap action schema');
    const status = choice(v.status, ['offered', 'generating', 'ready', 'accepted', 'rejected', 'declined', 'failed', 'cancelled', 'stale'] as const, 'Roadmap action status');
    if (v.stage !== undefined && status !== 'generating' || v.draftRevision !== undefined && !['ready', 'accepted'].includes(status))
        throw new Error('Invalid Roadmap action state');
    return { schemaVersion: 1, offerId: identifier(v.offerId),
        ...(v.sourceMessageId === undefined ? {} : { sourceMessageId: identifier(v.sourceMessageId) }),
        ...(v.sourceContentHash === undefined ? {} : { sourceContentHash: string(v.sourceContentHash, 'Roadmap source hash') }),
        projectId: string(v.projectId, 'Roadmap project ID'),
        chatId: identifier(v.chatId), ownerRevision: count(v.ownerRevision, 'Roadmap owner revision'), status,
        ...(v.stage === undefined ? {} : { stage: choice(v.stage,
            ['checking-owner', 'generating-draft', 'validating-draft', 'preparing-draft'] as const, 'Roadmap stage') }),
        ...(v.draftRevision === undefined ? {} : { draftRevision: count(v.draftRevision, 'draft revision') }),
        ...(v.diagnostic === undefined ? {} : { diagnostic: string(v.diagnostic, 'Roadmap diagnostic') }) };
}
export function parsePlanningActivity(value: unknown): ChatPlanningActivity {
    const v = record(value, ['schemaVersion', 'kind', 'status', 'refs', 'proposalId', 'appliedRevision', 'proposal', 'diagnostic', 'verifiedGuidance'],
        ['schemaVersion', 'kind', 'status', 'refs']);
    if (v.schemaVersion !== 1 || !Array.isArray(v.refs)) throw new Error('Invalid planning activity');
    const kind = choice(v.kind, ['roadmap-intent', 'roadmap-proposal', 'roadmap-sequence', 'roadmap-gate-proposal', 'roadmap-gate-undo', 'roadmap-publication', 'roadmap-gate-focus', 'roadmap-draft-proposal', 'roadmap-draft-sequence', 'implementation-plan', 'implementation-plan-revision', 'bridge-proposal', 'no-action',
        'error', 'cancelled'] as const, 'planning activity kind');
    const status = choice(v.status, ['pending', 'suggested', 'no-action', 'rejected', 'denied', 'stale', 'superseded', 'applied',
        'failed', 'cancelled'] as const, 'planning activity status');
    if ((kind === 'no-action') !== (status === 'no-action') ||
        (kind === 'bridge-proposal') !== (status === 'suggested') ||
        (status === 'suggested' && v.proposalId !== undefined) ||
        (kind === 'error') !== (status === 'failed') ||
        (kind === 'cancelled' ? status !== 'cancelled' :
            status === 'cancelled' && kind !== 'roadmap-gate-proposal' && kind !== 'roadmap-gate-undo' && kind !== 'roadmap-publication') ||
        (['pending', 'denied', 'stale', 'superseded', 'applied'].includes(status) && v.proposalId === undefined) ||
        (status === 'cancelled' && kind !== 'cancelled' && v.proposalId === undefined) ||
        (['no-action', 'failed'].includes(status) && v.proposalId !== undefined) ||
        (status === 'cancelled' && kind === 'cancelled' && v.proposalId !== undefined) ||
        (status === 'applied') !== (v.appliedRevision !== undefined) ||
        (v.verifiedGuidance !== undefined && kind !== 'no-action')) throw new Error('Invalid planning activity state');
    const guidance = v.verifiedGuidance === undefined ? undefined : record(v.verifiedGuidance,
        ['capabilityId', 'version', 'text'], ['capabilityId', 'version', 'text']);
    let proposal: import('./service').ChatPlanningProposal | undefined;
    if (v.proposal !== undefined) {
        if (kind !== 'roadmap-gate-proposal' && kind !== 'roadmap-gate-undo' && kind !== 'roadmap-publication' ||
            v.proposalId === undefined || JSON.stringify(v.proposal).length > 65536)
            throw new Error('Invalid saved Roadmap proposal');
        const p = record(v.proposal, ['id', 'chatId', 'messageId', 'ownerId', 'revision', 'generation', 'sourceHash',
            'changedIds', 'counts', 'warnings', 'action', 'summary', 'preview', 'publication', 'previewOnly', 'operations'],
            ['id', 'chatId', 'messageId', 'ownerId', 'revision', 'changedIds', 'action', 'summary']);
        const action = record(p.action, ['type', 'id'], ['type', 'id']);
        if (p.previewOnly !== undefined && p.previewOnly !== true) throw new Error('Invalid preview-only flag');
        if (p.id !== v.proposalId || !Array.isArray(p.changedIds) || p.changedIds.length > 64 ||
            p.changedIds.some(id => typeof id !== 'string'))
            throw new Error('Invalid saved Roadmap proposal');
        if (p.operations !== undefined && (kind !== 'roadmap-gate-proposal' || p.publication !== undefined))
            throw new Error('Invalid native Roadmap proposal');
        const counts = p.counts === undefined ? undefined : record(p.counts,
            ['phases', 'gates', 'criteria'], ['phases', 'gates', 'criteria']);
        if (counts && Object.values(counts).some(value => !Number.isSafeInteger(value) ||
            (value as number) < 0 || (value as number) > 64))
            throw new Error('Invalid saved Roadmap counts');
        if (p.warnings !== undefined && (!Array.isArray(p.warnings) || p.warnings.length > 16 ||
            p.warnings.some(item => typeof item !== 'string' || item.length > 512)))
            throw new Error('Invalid saved Roadmap warnings');
        if (p.operations !== undefined && (!Array.isArray(p.operations) || p.operations.length > 48 ||
            p.operations.some((item: unknown) => {
                try { const op = record(item, ['id', 'type', 'targetId', 'status'],
                    ['id', 'type', 'targetId', 'status']);
                    identifier(op.id); string(op.type, 'operation type'); identifier(op.targetId);
                    choice(op.status, ['Pending', 'Applied', 'Rejected', 'Stale', 'Conflict', 'Denied',
                        'Failed', 'Superseded'] as const, 'operation status'); return false;
                } catch { return true; }
            }))) throw new Error('Invalid saved Roadmap operations');
        const parseEntity = (value: unknown): import('./service').ChatRoadmapPreviewEntity => {
            const e = record(value, ['kind', 'id', 'title', 'detail', 'designation', 'parentId', 'order',
                'dependencies', 'criteria', 'additionalCriteria'], ['kind', 'id']);
            if (e.dependencies !== undefined && (!Array.isArray(e.dependencies) || e.dependencies.length > 32) ||
                e.criteria !== undefined && (!Array.isArray(e.criteria) || e.criteria.length > 12))
                throw new Error('Invalid saved Roadmap entity');
            return { kind: choice(e.kind, ['phase', 'gate', 'criterion', 'correction'] as const, 'Roadmap entity'),
                id: string(e.id, 'Roadmap entity ID'),
                ...(e.title === undefined ? {} : { title: string(e.title, 'Roadmap title') }),
                ...(e.detail === undefined ? {} : { detail: string(e.detail, 'Roadmap detail', false) }),
                ...(e.designation === undefined ? {} : { designation: string(e.designation, 'Gate designation') }),
                ...(e.parentId === undefined ? {} : { parentId: string(e.parentId, 'Roadmap parent') }),
                ...(e.order === undefined ? {} : { order: count(e.order, 'Roadmap order') }),
                ...(e.dependencies === undefined ? {} : { dependencies: e.dependencies.map((id: unknown) => string(id, 'Roadmap dependency')) }),
                ...(e.criteria === undefined ? {} : { criteria: e.criteria.map((item: unknown) => {
                    const criterion = record(item, ['id', 'title', 'expectedResult'], ['id', 'title', 'expectedResult']);
                    return { id: string(criterion.id, 'criterion ID'), title: string(criterion.title, 'criterion title'),
                        expectedResult: string(criterion.expectedResult, 'criterion expected result') };
                }) }),
                ...(e.additionalCriteria === undefined ? {} : { additionalCriteria: count(e.additionalCriteria, 'additional criteria') }) };
        };
        let savedPreview: import('./service').ChatPlanningProposal['preview'];
        if (p.preview !== undefined) {
            const q = record(p.preview, ['source', 'steps', 'entities', 'totalChanged', 'additionalChanges',
                'parentTitles', 'sourceChanges', 'additionalSourceChanges'],
                ['source', 'steps', 'entities', 'totalChanged', 'additionalChanges', 'parentTitles']);
            if (!Array.isArray(q.steps) || q.steps.length > 48 || !Array.isArray(q.entities) ||
                q.entities.length > 64 || !q.parentTitles || typeof q.parentTitles !== 'object' ||
                Array.isArray(q.parentTitles) || q.sourceChanges !== undefined &&
                (!Array.isArray(q.sourceChanges) || q.sourceChanges.length > 8))
                throw new Error('Invalid saved Roadmap preview');
            const parentTitles = Object.fromEntries(Object.entries(q.parentTitles).map(([id, title]) =>
                [string(id, 'Roadmap parent ID'), string(title, 'Roadmap parent title')]));
            savedPreview = { source: choice(q.source, ['validated-roadmap', 'validated-markdown-patch'] as const, 'Roadmap preview source'),
                steps: q.steps.map((item: unknown) => {
                    const step = record(item, ['type', 'id', 'title', 'affectedCount'], ['type', 'id', 'title', 'affectedCount']);
                    return { type: string(step.type, 'Roadmap action'), id: string(step.id, 'Roadmap action ID'),
                        title: string(step.title, 'Roadmap action title'), affectedCount: count(step.affectedCount, 'affected count') };
                }),
                entities: q.entities.map((item: unknown) => {
                    const e = record(item, ['id', 'action', 'before', 'after'], ['id', 'action']);
                    return { id: string(e.id, 'Roadmap change ID'),
                        action: choice(e.action, ['create', 'edit', 'delete'] as const, 'Roadmap change'),
                        ...(e.before === undefined ? {} : { before: parseEntity(e.before) }),
                        ...(e.after === undefined ? {} : { after: parseEntity(e.after) }) };
                }),
                totalChanged: count(q.totalChanged, 'Roadmap change count'),
                additionalChanges: count(q.additionalChanges, 'additional changes'), parentTitles,
                ...(q.sourceChanges === undefined ? {} : { sourceChanges: q.sourceChanges.map((item: unknown) => {
                    const line = record(item, ['before', 'after'], ['before', 'after']);
                    return { before: string(line.before, 'source before', false),
                        after: string(line.after, 'source after', false) };
                }) }),
                ...(q.additionalSourceChanges === undefined ? {} :
                    { additionalSourceChanges: count(q.additionalSourceChanges, 'additional source changes') }) };
        }
        const publication = p.publication === undefined ? undefined : record(p.publication,
            ['mode', 'path', 'sourceHash', 'phaseCount', 'gateCount', 'criterionCount', 'warnings', 'content', 'compatible', 'diagnostics'],
            ['mode', 'path', 'sourceHash', 'phaseCount', 'gateCount', 'criterionCount', 'warnings']);
        const publicationWarnings = publication?.warnings;
        const publicationDiagnostics = publication?.diagnostics;
        if (publication && (kind !== 'roadmap-publication' || !Array.isArray(publicationWarnings) ||
            publicationWarnings.length > 32 || publication.content !== undefined &&
            (typeof publication.content !== 'string' || publication.content.length > 32768) ||
            publicationDiagnostics !== undefined && !Array.isArray(publicationDiagnostics)))
            throw new Error('Invalid saved publication preview');
        proposal = { id: identifier(p.id), chatId: identifier(p.chatId), messageId: identifier(p.messageId),
            ownerId: string(p.ownerId, 'Roadmap owner'), revision: count(p.revision, 'Roadmap revision'),
            ...(p.generation === undefined ? {} : { generation: count(p.generation, 'Roadmap proposal generation') }),
            ...(counts === undefined ? {} : { counts: { phases: count(counts.phases, 'phase count'),
                gates: count(counts.gates, 'gate count'), criteria: count(counts.criteria, 'criterion count') } }),
            ...(p.warnings === undefined ? {} : { warnings: (p.warnings as unknown[]).map(item =>
                string(item, 'Roadmap warning')) }),
            changedIds: p.changedIds.map(id => string(id, 'changed Roadmap ID')),
            action: { type: string(action.type, 'proposal action'), id: string(action.id, 'proposal target') },
            summary: string(p.summary, 'proposal summary'),
            ...(p.operations === undefined ? {} : { operations: (p.operations as unknown[]).map(item => {
                const op = item as Record<string, unknown>;
                return { id: identifier(op.id), type: string(op.type, 'operation type'),
                    targetId: identifier(op.targetId), status: choice(op.status,
                        ['Pending', 'Applied', 'Rejected', 'Stale', 'Conflict', 'Denied', 'Failed',
                            'Superseded'] as const, 'operation status') };
            }) }),
            ...(p.previewOnly === undefined ? {} : { previewOnly: true as const }),
            ...(p.sourceHash === undefined ? {} : { sourceHash: string(p.sourceHash, 'source hash') }),
            ...(savedPreview === undefined ? {} : { preview: savedPreview }),
            ...(publication === undefined ? {} : { publication: {
                mode: choice(publication.mode, ['publish', 'link'] as const, 'publication mode'),
                path: string(publication.path, 'publication path'),
                sourceHash: string(publication.sourceHash, 'publication hash'),
                phaseCount: count(publication.phaseCount, 'phase count'),
                gateCount: count(publication.gateCount, 'gate count'),
                criterionCount: count(publication.criterionCount, 'criterion count'),
                warnings: (publicationWarnings as unknown[]).map((item: unknown) => string(item, 'publication warning')),
                ...(publication.content === undefined ? {} : { content: string(publication.content, 'publication content', false) }),
                ...(publication.compatible === undefined ? {} : { compatible: publication.compatible === true }),
                ...(publicationDiagnostics === undefined ? {} : { diagnostics: (publicationDiagnostics as unknown[]).map((item: unknown) => string(item, 'publication diagnostic')) })
            } }) };
    }
    return { schemaVersion: 1, kind, status, refs: v.refs.map(parseChatContextRef),
        ...(v.proposalId === undefined ? {} : { proposalId: string(v.proposalId, 'proposal ID') }),
        ...(v.appliedRevision === undefined ? {} : { appliedRevision: count(v.appliedRevision, 'applied revision') }),
        ...(proposal === undefined ? {} : { proposal }),
        ...(v.diagnostic === undefined ? {} : { diagnostic: string(v.diagnostic, 'planning diagnostic').slice(0, 2000) }),
        ...(guidance === undefined ? {} : { verifiedGuidance: {
            capabilityId: string(guidance.capabilityId, 'guidance capability'),
            version: string(guidance.version, 'guidance version'),
            text: string(guidance.text, 'verified guidance'),
        } }) };
}
export function parseChat(value: unknown): Chat {
    const v = record(value, ['schemaVersion', 'id', 'revision', 'folderPath', 'title', 'titleSource',
        'color', 'createdAt', 'updatedAt', 'lastInteractedAt', 'settings', 'messages'],
        ['schemaVersion', 'id', 'revision', 'folderPath', 'title', 'titleSource', 'color',
            'createdAt', 'updatedAt', 'lastInteractedAt', 'settings', 'messages']);
    if (v.schemaVersion !== 1 || !Array.isArray(v.messages)) throw new Error('Unsupported Chat schema');
    const chat: Chat = { schemaVersion: 1, id: identifier(v.id), revision: count(v.revision, 'Chat revision'),
        folderPath: parseChatFolderPath(v.folderPath), title: string(v.title, 'Chat title'),
        titleSource: choice(v.titleSource, ['placeholder', 'automatic', 'developer'], 'title source'), color: parseChatColor(v.color),
        createdAt: time(v.createdAt), updatedAt: time(v.updatedAt), lastInteractedAt: time(v.lastInteractedAt),
        settings: parseChatSettings(v.settings), messages: v.messages.map(parseChatMessage) };
    const ids = chat.messages.flatMap(message => message.role === 'assistant' ? [message.id, message.execution.id] : [message.id]);
    const created = Date.parse(chat.createdAt);
    const updated = Date.parse(chat.updatedAt);
    if (new Set(ids).size !== ids.length || updated < created ||
        Date.parse(chat.lastInteractedAt) < created || Date.parse(chat.lastInteractedAt) > updated ||
        chat.messages.some((message, index) => message.role === 'assistant' && message.activity?.chatId !== undefined &&
            message.activity.chatId !== chat.id || Date.parse(message.createdAt) < created ||
            Date.parse(message.createdAt) > updated ||
            (index > 0 && Date.parse(message.createdAt) < Date.parse(chat.messages[index - 1].createdAt)) ||
            (message.role === 'assistant' && (Date.parse(message.execution.startedAt) < Date.parse(message.createdAt) ||
                Date.parse(message.execution.startedAt) > updated ||
                (message.execution.finishedAt && Date.parse(message.execution.finishedAt) > updated)))))
        throw new Error('Invalid Chat chronology or duplicate ID');
    return chat;
}
export function parseChatFolder(value: unknown): ChatFolder {
    const v = record(value, ['schemaVersion', 'path', 'createdAt'], ['schemaVersion', 'path', 'createdAt']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported Chat folder schema');
    const path = parseChatFolderPath(v.path);
    if (!path) throw new Error('Root folder is implicit');
    return { schemaVersion: 1, path, createdAt: time(v.createdAt) };
}
export function parseChatCollection(value: unknown): ChatCollection {
    const v = record(value, ['schemaVersion', 'revision', 'folders', 'chats'],
        ['schemaVersion', 'revision', 'folders', 'chats']);
    if (v.schemaVersion !== 1 || !Array.isArray(v.folders) || !Array.isArray(v.chats))
        throw new Error('Unsupported Chat collection schema');
    const folders = v.folders.map(parseChatFolder);
    const chats = v.chats.map(parseChat);
    const paths = new Set(folders.map(folder => folder.path));
    if (paths.size !== folders.length || new Set(chats.map(chat => chat.id)).size !== chats.length ||
        folders.some(folder => folder.path.includes('/') && !paths.has(folder.path.slice(0, folder.path.lastIndexOf('/')))) ||
        chats.some(chat => chat.folderPath && !paths.has(chat.folderPath))) throw new Error('Invalid Chat hierarchy');
    return { schemaVersion: 1, revision: count(v.revision, 'collection revision'), folders, chats };
}

/** Descending real interaction order; deterministic ties use creation time then stable ID. */
export function compareChatsByInteraction(a: Chat, b: Chat): number {
    return Date.parse(b.lastInteractedAt) - Date.parse(a.lastInteractedAt) ||
        Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id);
}
export function suggestedChatTitle(content: string, maxLength = 80): string {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (!normalized || !Number.isSafeInteger(maxLength) || maxLength < 1) throw new Error('Invalid title input');
    return normalized.slice(0, maxLength).trimEnd();
}
export function withAutomaticChatTitle(chat: Chat, title: string): Chat {
    if (chat.titleSource === 'developer') return chat;
    return { ...chat, title: string(title, 'Chat title').trim(), titleSource: 'automatic' };
}
