import { parseRoutingProvenance, type RoutingProvenance } from '@dope/ai';

/** Project Chat identity belongs to Dope; neither storage paths nor runtime IDs define it. */
export type ChatId = string;
export type ChatFolderPath = string; // Root is ''. Other paths use slash-separated safe names.
export type ChatTitleSource = 'placeholder' | 'automatic' | 'developer';
export const CHAT_COLORS = ['blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo'] as const;
export type ChatColor = typeof CHAT_COLORS[number];
export type AssistantStatus = 'pending' | 'streaming' | 'complete' | 'failed' | 'cancelled';
export type ChatContextKind = 'editor' | 'selection' | 'file' | 'project-mind' | 'architecture' |
    'physical-map' | 'flow' | 'planning-map' | 'work-item' | 'saved-chat' | 'directory' | 'path-search' | 'text-search' | 'project-orientation' | 'grounding-status';

export interface ChatContextRef {
    schemaVersion: 1;
    kind: ChatContextKind;
    id: string; // Project-relative path or Dope-owned artifact identity, according to kind.
    label: string;
    origin?: 'manual' | 'automatic'; // Omitted on older persisted refs; those are manual.
    excerpt?: string;
    estimatedTokens: number;
    includedBytes?: number;
    contentHash?: string;
    projectId?: string;
    generation?: number;
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
}
export interface ChatUserMessage {
    schemaVersion: 1;
    id: string;
    role: 'user';
    createdAt: string;
    content: string;
    contextRefs: ChatContextRef[];
}
export interface ChatAssistantMessage {
    schemaVersion: 1;
    id: string;
    role: 'assistant';
    createdAt: string;
    content: string; // Visible answer only; hidden reasoning is not durable state.
    execution: ChatExecution;
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
    'physical-map', 'flow', 'planning-map', 'work-item', 'saved-chat', 'directory', 'path-search', 'text-search', 'project-orientation', 'grounding-status'];
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
        'includedBytes', 'contentHash', 'projectId', 'generation', 'messageId', 'start', 'end'],
        ['schemaVersion', 'kind', 'id', 'label', 'estimatedTokens']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported context reference schema');
    const ref: ChatContextRef = { schemaVersion: 1, kind: choice(v.kind, contextKinds, 'context kind'), id: string(v.id, 'context ID'),
        label: string(v.label, 'context label'), estimatedTokens: count(v.estimatedTokens, 'context tokens') };
    if (v.origin !== undefined) ref.origin = choice(v.origin, ['manual', 'automatic'] as const, 'context origin');
    if (v.excerpt !== undefined) ref.excerpt = string(v.excerpt, 'context excerpt', false);
    if (v.includedBytes !== undefined) ref.includedBytes = count(v.includedBytes, 'included bytes');
    if (v.contentHash !== undefined) {
        if (typeof v.contentHash !== 'string' || !/^[0-9a-f]{64}$/.test(v.contentHash)) throw new Error('Invalid context hash');
        ref.contentHash = v.contentHash;
    }
    if (v.projectId !== undefined) ref.projectId = string(v.projectId, 'context project ID');
    if (v.generation !== undefined) ref.generation = count(v.generation, 'context generation');
    if (v.messageId !== undefined) ref.messageId = string(v.messageId, 'context message ID');
    if (v.start !== undefined) ref.start = count(v.start, 'context start');
    if (v.end !== undefined) ref.end = count(v.end, 'context end');
    if (ref.end !== undefined && (ref.start === undefined || ref.end <= ref.start)) throw new Error('Invalid context bounds');
    return ref;
}
export function parseChatSettings(value: unknown): ChatSettings {
    const v = record(value, ['schemaVersion', 'modelPolicy', 'defaultModel', 'reasoningControls', 'context'], ['schemaVersion', 'context']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported Chat settings schema');
    if (v.modelPolicy !== undefined && v.defaultModel !== undefined) throw new Error('Ambiguous Chat model policy');
    const c = record(v.context, ['maxInputTokens', 'reservedOutputTokens', 'history', 'savedChatSearch', 'allowedSources'],
        ['maxInputTokens', 'reservedOutputTokens', 'history', 'savedChatSearch', 'allowedSources']);
    if (typeof c.savedChatSearch !== 'boolean' || !Array.isArray(c.allowedSources)) throw new Error('Invalid context policy');
    const allowedSources = c.allowedSources.map(source => choice(source, contextKinds, 'context source'));
    if (new Set(allowedSources).size !== allowedSources.length) throw new Error('Duplicate context source');
    const settings: ChatSettings = { schemaVersion: 1,
        modelPolicy: v.modelPolicy === undefined ? v.defaultModel === undefined ? { type: 'follow-interactive' } :
            { type: 'exact', model: parseChatModelSelection(v.defaultModel) } : parseChatModelPolicy(v.modelPolicy), context: {
        maxInputTokens: count(c.maxInputTokens, 'input budget', true),
        reservedOutputTokens: count(c.reservedOutputTokens, 'output reserve'),
        history: choice(c.history, ['recent', 'none'], 'history policy'),
        savedChatSearch: c.savedChatSearch, allowedSources,
    } };
    if (v.reasoningControls !== undefined) {
        if (!v.reasoningControls || typeof v.reasoningControls !== 'object' || Array.isArray(v.reasoningControls))
            throw new Error('Invalid reasoning controls');
        settings.reasoningControls = Object.fromEntries(Object.entries(v.reasoningControls).map(([key, value]) =>
            [string(key, 'reasoning control'), string(value, 'reasoning value')]));
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
    const v = record(value, ['schemaVersion', 'id', 'status', 'selectedModel', 'resolutionSource', 'actualModel', 'routingProvenance', 'startedAt', 'finishedAt', 'failure'],
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
    const v = record(value, ['schemaVersion', 'id', 'role', 'createdAt', 'content', 'contextRefs', 'execution'],
        ['schemaVersion', 'id', 'role', 'createdAt', 'content']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported message schema');
    const base = { schemaVersion: 1 as const, id: identifier(v.id), createdAt: time(v.createdAt), content: string(v.content, 'message content', false) };
    if (v.role === 'user') {
        if (!Array.isArray(v.contextRefs) || v.execution !== undefined || !base.content.trim()) throw new Error('Invalid user message');
        return { ...base, role: 'user', contextRefs: v.contextRefs.map(parseChatContextRef) };
    }
    if (v.role === 'assistant') {
        if (v.contextRefs !== undefined) throw new Error('Invalid assistant message');
        return { ...base, role: 'assistant', execution: parseExecution(v.execution) };
    }
    throw new Error('Invalid Chat role');
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
        chat.messages.some((message, index) => Date.parse(message.createdAt) < created ||
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
