import { parseRoutingProvenance, type RoutingProvenance } from '@dope/ai';
import { parseExecutionActivity, type ChatExecutionActivity } from './activity';
export { ChatActivityRecorder, parseExecutionActivity, safeChatToolPath, sanitizeChatDiagnosticText } from './activity';
export type { ChatActivityEvent, ChatActivityKind, ChatExecutionActivity } from './activity';

/** Project Chat identity belongs to Dope; neither storage paths nor runtime IDs define it. */
export type ChatId = string;
export type ChatFolderPath = string; // Root is ''. Other paths use slash-separated safe names.
export type ChatTitleSource = 'placeholder' | 'automatic' | 'developer';
export const CHAT_COLORS = ['blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo'] as const;
export type ChatColor = typeof CHAT_COLORS[number];
export type AssistantStatus = 'pending' | 'streaming' | 'paused-output-limit' | 'complete' | 'stopped-incomplete' | 'failed' | 'cancelled' | 'interrupted';
export type ChatOutputLimitPolicy = 'ask' | 'allow' | 'cancel';
/** Noncanonical answer bytes. Cursor counts UTF-8 bytes, not JavaScript code units. */
export interface ChatAnswerPartial {
    schemaVersion: 1;
    text: string;
    cursor: number;
    segments: { number: number; start: number; end: number; finishReason: string;
        outputCeilingTokens?: number;
        tokenUsage?: ChatExecution['tokenUsage'] }[];
}
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
    outputLimitPolicy: ChatOutputLimitPolicy;
    reasoningControls?: Record<string, string>;
    reasoningDisplay?: { mode: 'paragraphs' | 'short-chunks' | 'live-tokens'; fadeIn: boolean };
    context: ChatContextPolicy;
}

export interface ChatExecution {
    schemaVersion: 1;
    id: string;
    status: AssistantStatus;
    selectedModel: ChatModelSelection; // Snapshotted at Send; never rewritten by settings.
    outputLimitPolicy?: ChatOutputLimitPolicy; // Snapshot for this execution; older records omit it.
    resolutionSource?: 'explicit-turn' | 'chat-exact-default' | 'role-policy';
    actualModel?: ChatModelProvenance; // Set when a runtime starts, then immutable.
    routingProvenance?: RoutingProvenance;
    startedAt: string;
    finishedAt?: string;
    failure?: string; // User-safe summary; no raw provider payload.
    failureCode?: 'session_init' | 'provider_http' | 'provider_connection' | 'tool_protocol' |
        'model_generation' | 'worker_exit' | 'worker_protocol' | 'context_limit' | 'output_limit' |
        'worker_timeout' | 'resource_limit' | 'policy_limit' | 'policy_invalid' | 'chat_lease' | 'model_tool_call_invalid' |
        'broker_tool_denied' | 'broker_tool_failed' | 'tool_reply_invalid' |
        'tool_reply_unmatched' | 'tool_reply_duplicate' | 'tool_reply_delivery_failed' |
        'worker_dispatch_failed' | 'session_closed_with_pending_tool' | 'tool_protocol_unknown' |
        'continuation_unavailable' | 'continuation_expired' | 'continuation_result_invalid' |
        'continuation_pi_rejected' | 'continuation_model_drift';
    toolFailure?: { stage: string; requestId?: number; toolId?: number; toolName?: string;
        lastConfirmed?: { requestId: number; toolId: number; toolName: string; outcome: string };
        brokerResultAcknowledged: boolean; elapsedMs?: number;
        failureOrigin?: 'tool_budget' | 'model_call_budget' | 'generation_budget' | 'operation_policy' | 'attempted_tool' |
            'missing_final_assistant' | 'response_aborted' | 'provider_failure' |
            'invalid_final_tool_call' | 'invalid_final_assistant';
        toolStarts?: number; toolAcknowledgements?: number;
        failedToolStart?: { ordinal: number; toolName: string } };
    contextUsage?: { usedTokens: number; budgetTokens: number };
    tokenUsage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; reasoningTokens?: number;
        tokenMeasurement: 'provider-reported' | 'tokenizer' | 'estimated' | 'unavailable' };
    compaction?: { canonicalContextSha256: string; originalSha256: string;
        compactedSha256: string; tokensBefore: number };
    finishReason?: string;
    sourceRefs?: ChatContextRef[];
    toolEvents?: { name: 'read_file' | 'list_files' | 'search_paths' | 'search_text' | 'run_command' |
        'dope_read' | 'dope_list' | 'dope_search_paths' | 'dope_search_text' | 'dope_command' |
        'roadmap_read' | 'roadmap_stage' | 'roadmap_cancel' | 'roadmap_phase' | 'roadmap_finish' |
        'proposal_status' | 'proposal_stage_document' | 'proposal_stage_prompt' | 'proposal_finish' |
        'assessment_status' | 'assessment_stage' | 'assessment_finish';
        status: 'completed' | 'failed' | 'denied'; truncated: boolean;
        code?: string; stage?: string; brokerExecuted?: boolean;
        assessment?: { ordinal: number; category: 'scope' | 'tiers' | 'observations' | 'preservation' |
            'dependencies' | 'risks' | 'unrecognized'; shape: 'finding' | 'empty' | 'scope' |
            'tiers' | 'invalid'; code: string; field: 'none' | 'shape' | 'category' |
            'citation' | 'source' | 'authority' | 'resource' | 'internal';
            previousFindingsPreserved: boolean; acceptedFindings: number };
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
    /** Trusted, inert identity of an unpublished named prompt draft. */
    promptDraft?: ChatPromptDraftIdentity;
}
export interface ChatPromptDraftIdentity {
    schemaVersion: 1; id: string; revision: number; slug: string;
    projectId: string; chatId: string; userMessageId: string;
    leaseDigest: string; sourceHead: string; sourceVersion: string; sourceFingerprint: string;
}
export interface ChatAssistantMessage {
    schemaVersion: 1;
    id: string;
    role: 'assistant';
    createdAt: string;
    content: string; // Only successfully completed final answer is conversational content.
    execution: ChatExecution;
    activity?: ChatExecutionActivity; // Isolated diagnostics; never prompt context or search content.
    answerPartial?: ChatAnswerPartial; // Inspectable incomplete answer, never conversational content.
    planningActivity?: ChatPlanningActivity; // Backend-verified projection; content remains the exact model output.
    proposalProgress?: ChatProposalProgress; // Inert, bounded staging projection; never an approval token.
    roadmapAction?: ChatRoadmapAction;
    lockedRoadmapPlan?: ChatLockedRoadmapPlan; // Inert evidence, never an approval or proposal.
}
export interface ChatProposalProgress {
    schemaVersion: 1; domain: 'document' | 'prompt'; proposalId: string;
    root: string; worktreeId: string; ownerId: string; revision: number;
    state: 'staging' | 'ready-for-review' | 'cancelled' | 'stale' | 'blocked';
    targets: { target: string; path: string; chunks: number; bytes: number; complete: boolean;
        original: string | null; proposed: string; truncated: boolean }[];
    diagnostic?: string; reviewDigest?: string;
}
export interface ChatLockedRoadmapPlan {
    schemaVersion: 1;
    status: 'planning-only';
    text: string;
    sha256: string;
    projectRoot: string;
    projectId: string;
    chatId: string;
    userMessageId: string;
    assistantMessageId: string;
    executionId: string;
    turnId: string;
    leaseDigest: string;
    ownerRevision: number;
    sourceHash: string | null;
    createdAt: string;
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
    kind: 'roadmap-intent' | 'roadmap-proposal' | 'roadmap-sequence' | 'roadmap-gate-proposal' | 'roadmap-gate-undo' | 'roadmap-publication' | 'roadmap-gate-focus' | 'roadmap-draft-proposal' | 'roadmap-draft-sequence' | 'implementation-plan' | 'implementation-plan-revision' | 'bridge-proposal' | 'documentation-proposal' | 'prompt-stack-proposal' | 'no-action' | 'error' | 'cancelled';
    status: 'pending' | 'approved' | 'suggested' | 'no-action' | 'rejected' | 'denied' | 'stale' | 'superseded' | 'applied' | 'failed' | 'cancelled';
    refs: ChatContextRef[];
    proposalId?: string;
    appliedRevision?: number;
    /** Bounded, inert review presentation. Saved history never grants approval authority. */
    proposal?: import('./service').ChatPlanningProposal;
    documentProposal?: ChatDocumentationProposal;
    promptStackProposal?: ChatPromptStackProposal;
    /** Broker-owned inventory and successful range reads; never model-authored. */
    documentationDiscovery?: { detected: number | null; omitted: string[];
        reads: { path: string; count: number }[] };
    diagnostic?: string;
    /** Backend-verified UI guidance captured for this turn; model content remains untouched. */
    verifiedGuidance?: { capabilityId: string; version: string; text: string };
}
/** Inert, source-bound review bytes. A saved proposal is never an application grant. */
export interface ChatDocumentationProposal {
    id: string; digest: string; root: string; projectId: string; worktreeId: string;
    ownerId: string; chatId: string; messageId: string; leaseDigest: string;
    roadmapRevision: number; createdAt: string; expiresAt: string;
    proposalRevision?: number;
    reviewIntent?: string;
    /** Absent on historical proposals, which remain readable but cannot be applied. */
    dependencySnapshotVersion?: 1;
    /** Immutable broker-read file identities. Empty only for a direct review without source reads. */
    dependencies: { path: string; contentHash: string; dev: number; ino: number }[];
    targets: { path: string; operation: 'create' | 'update'; before: string | null;
        beforeHash: string | null; after: string; afterHash: string; diff: string }[];
}
/** Exact, noncanonical prompt bytes. The saved object grants neither publication nor Work. */
export interface ChatPromptStackProposal {
    id: string; digest: string; root: string; projectId: string; ownerId: string;
    chatId: string; messageId: string; leaseDigest: string; revision: number;
    folder: string; sourceVersion: string; gitHead: string; worktreeId: string;
    assessmentMessageId: string; planMessageId: string; createdAt: string;
    files: { path: string; after: string; afterHash: string; before: null }[];
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
const statuses: readonly AssistantStatus[] = ['pending', 'streaming', 'paused-output-limit', 'complete', 'stopped-incomplete', 'failed', 'cancelled', 'interrupted'];
const outputPolicies: readonly ChatOutputLimitPolicy[] = ['ask', 'allow', 'cancel'];
const partialBytes = (text: string): number => new TextEncoder().encode(text).length;
export function parseChatAnswerPartial(value: unknown): ChatAnswerPartial {
    const v = record(value, ['schemaVersion', 'text', 'cursor', 'segments'], ['schemaVersion', 'text', 'cursor', 'segments']);
    if (v.schemaVersion !== 1 || typeof v.text !== 'string' || !Array.isArray(v.segments) || v.segments.length > 32 ||
        partialBytes(v.text) > 131_072 || v.cursor !== partialBytes(v.text)) throw new Error('Invalid Chat answer partial');
    let end = 0;
    const segments = v.segments.map((item, index) => {
        const s = record(item, ['number', 'start', 'end', 'finishReason', 'outputCeilingTokens', 'tokenUsage'], ['number', 'start', 'end', 'finishReason']);
        if (s.number !== index + 1 || s.start !== end || !Number.isSafeInteger(s.start) || !Number.isSafeInteger(s.end) ||
            (s.end as number) < end || (s.end as number) > (v.cursor as number)) throw new Error('Invalid Chat answer segment');
        end = s.end as number;
        if (s.outputCeilingTokens !== undefined && (!Number.isSafeInteger(s.outputCeilingTokens) ||
            (s.outputCeilingTokens as number) < 1)) throw new Error('Invalid Chat output ceiling');
        return { number: s.number as number, start: s.start as number, end,
            ...(s.outputCeilingTokens === undefined ? {} : { outputCeilingTokens: s.outputCeilingTokens as number }),
            finishReason: (() => { const reason = string(s.finishReason, 'segment finish reason');
                if (reason.length > 80) throw new Error('Invalid Chat segment finish reason');
                return reason; })(),
            ...(s.tokenUsage === undefined ? {} : { tokenUsage: parseExecution({ schemaVersion: 1,
                id: '00000000-0000-4000-8000-000000000000', status: 'pending',
                selectedModel: { connectionId: 'partial', modelId: 'partial' }, startedAt: '2026-01-01T00:00:00.000Z',
                tokenUsage: s.tokenUsage }).tokenUsage }) };
    });
    if (end > (v.cursor as number)) throw new Error('Invalid Chat answer cursor');
    return { schemaVersion: 1, text: v.text, cursor: v.cursor as number, segments };
}

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
    const v = record(value, ['schemaVersion', 'modelPolicy', 'defaultModel', 'outputLimitPolicy', 'reasoningControls', 'reasoningDisplay', 'context'], ['schemaVersion', 'context']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported Chat settings schema');
    if (v.modelPolicy !== undefined && v.defaultModel !== undefined) throw new Error('Ambiguous Chat model policy');
    const c = record(v.context, ['maxInputTokens', 'reservedOutputTokens', 'history', 'savedChatSearch', 'allowedSources'],
        ['maxInputTokens', 'reservedOutputTokens', 'history', 'savedChatSearch', 'allowedSources']);
    if (typeof c.savedChatSearch !== 'boolean' || !Array.isArray(c.allowedSources)) throw new Error('Invalid context policy');
    const legacySources = c.allowedSources.map(source => choice(source, contextKinds, 'context source'));
    if (new Set(legacySources).size !== legacySources.length) throw new Error('Duplicate context source');
    const settings: ChatSettings = { schemaVersion: 1,
        outputLimitPolicy: v.outputLimitPolicy === undefined ? 'ask' : choice(v.outputLimitPolicy, outputPolicies, 'output limit policy'),
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
    const v = record(value, ['schemaVersion', 'id', 'status', 'selectedModel', 'outputLimitPolicy', 'resolutionSource', 'actualModel', 'routingProvenance', 'startedAt', 'finishedAt', 'failure', 'failureCode', 'toolFailure', 'contextUsage', 'tokenUsage', 'compaction', 'finishReason', 'sourceRefs', 'toolEvents'],
        ['schemaVersion', 'id', 'status', 'selectedModel', 'startedAt']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported execution schema');
    const execution: ChatExecution = { schemaVersion: 1, id: identifier(v.id), status: choice(v.status, statuses, 'assistant status'),
        selectedModel: parseChatModelSelection(v.selectedModel), startedAt: time(v.startedAt) };
    if (v.outputLimitPolicy !== undefined) execution.outputLimitPolicy = choice(v.outputLimitPolicy, outputPolicies, 'output limit policy');
    if (v.actualModel !== undefined) execution.actualModel = parseModelProvenance(v.actualModel);
    if (v.resolutionSource !== undefined) execution.resolutionSource = choice(v.resolutionSource,
        ['explicit-turn', 'chat-exact-default', 'role-policy'] as const, 'resolution source');
    if (v.routingProvenance !== undefined) execution.routingProvenance = parseRoutingProvenance(v.routingProvenance);
    if (v.finishedAt !== undefined) execution.finishedAt = time(v.finishedAt);
    if (v.failure !== undefined) execution.failure = string(v.failure, 'failure');
    if (v.failureCode !== undefined) execution.failureCode = choice(v.failureCode,
        ['session_init', 'provider_http', 'provider_connection', 'tool_protocol',
            'model_generation', 'worker_exit', 'worker_protocol', 'context_limit', 'output_limit',
            'worker_timeout', 'resource_limit', 'policy_limit', 'policy_invalid', 'chat_lease', 'model_tool_call_invalid',
            'broker_tool_denied', 'broker_tool_failed', 'tool_reply_invalid',
            'tool_reply_unmatched', 'tool_reply_duplicate', 'tool_reply_delivery_failed',
            'worker_dispatch_failed', 'session_closed_with_pending_tool', 'tool_protocol_unknown',
            'continuation_unavailable', 'continuation_expired', 'continuation_result_invalid',
            'continuation_pi_rejected', 'continuation_model_drift'] as const, 'failure code');
    if (v.toolFailure !== undefined) {
        const detail = record(v.toolFailure, ['stage', 'requestId', 'toolId', 'toolName',
            'lastConfirmed', 'brokerResultAcknowledged', 'elapsedMs', 'failureOrigin',
            'toolStarts', 'toolAcknowledgements', 'failedToolStart'], ['stage', 'brokerResultAcknowledged']);
        const stage = choice(detail.stage, ['session_init', 'provider_http', 'provider_connection',
            'tool_protocol', 'model_generation', 'worker_exit', 'worker_protocol', 'context_limit',
            'output_limit', 'worker_timeout', 'resource_limit', 'policy_limit', 'policy_invalid', 'model_tool_call_invalid',
            'broker_tool_denied', 'broker_tool_failed', 'tool_reply_invalid',
            'tool_reply_unmatched', 'tool_reply_duplicate', 'tool_reply_delivery_failed',
            'worker_dispatch_failed', 'session_closed_with_pending_tool', 'tool_protocol_unknown',
            'continuation_unavailable', 'continuation_expired', 'continuation_result_invalid',
            'continuation_pi_rejected', 'continuation_model_drift'] as const,
        'Pi tool failure stage');
        if (typeof detail.brokerResultAcknowledged !== 'boolean' ||
            [detail.requestId, detail.toolId].some(id => id !== undefined &&
                (!Number.isSafeInteger(id) || (id as number) < 1)) ||
            detail.elapsedMs !== undefined && (!Number.isSafeInteger(detail.elapsedMs) ||
                (detail.elapsedMs as number) < 0 || (detail.elapsedMs as number) > 1_800_000) ||
            detail.toolName !== undefined && (typeof detail.toolName !== 'string' ||
                !/^[a-z_]{1,64}$/u.test(detail.toolName))) throw new Error('Invalid Pi tool failure');
        let lastConfirmed: NonNullable<ChatExecution['toolFailure']>['lastConfirmed'];
        const failureOrigin = detail.failureOrigin === undefined ? undefined : choice(detail.failureOrigin,
            ['tool_budget', 'model_call_budget', 'generation_budget', 'operation_policy', 'attempted_tool', 'missing_final_assistant',
                'response_aborted', 'provider_failure', 'invalid_final_tool_call',
                'invalid_final_assistant'] as const, 'Pi failure origin');
        const boundedCount = (value: unknown) => Number.isSafeInteger(value) && (value as number) >= 0 &&
            (value as number) <= 1_000_000;
        if (detail.toolStarts !== undefined && !boundedCount(detail.toolStarts) ||
            detail.toolAcknowledgements !== undefined && (!boundedCount(detail.toolAcknowledgements) ||
                detail.toolStarts !== undefined && (detail.toolAcknowledgements as number) > (detail.toolStarts as number)))
            throw new Error('Invalid Pi failure counters');
        let failedToolStart: NonNullable<ChatExecution['toolFailure']>['failedToolStart'];
        if (detail.failedToolStart !== undefined) {
            const failed = record(detail.failedToolStart, ['ordinal', 'toolName'], ['ordinal', 'toolName']);
            if (!boundedCount(failed.ordinal) || (failed.ordinal as number) < 1 ||
                typeof failed.toolName !== 'string' || !/^[a-z_]{1,64}$/u.test(failed.toolName) ||
                detail.toolStarts !== undefined && (failed.ordinal as number) > (detail.toolStarts as number) ||
                detail.brokerResultAcknowledged)
                throw new Error('Invalid failed Pi tool start');
            failedToolStart = failed as NonNullable<ChatExecution['toolFailure']>['failedToolStart'];
        }
        if (detail.lastConfirmed !== undefined) {
            const last = record(detail.lastConfirmed, ['requestId', 'toolId', 'toolName', 'outcome'],
                ['requestId', 'toolId', 'toolName', 'outcome']);
            if (!Number.isSafeInteger(last.requestId) || (last.requestId as number) < 1 ||
                !Number.isSafeInteger(last.toolId) || (last.toolId as number) < 1 ||
                typeof last.toolName !== 'string' || !/^[a-z_]{1,64}$/u.test(last.toolName) ||
                !['completed', 'failed', 'denied'].includes(String(last.outcome)))
                throw new Error('Invalid last Pi tool receipt');
            lastConfirmed = last as NonNullable<ChatExecution['toolFailure']>['lastConfirmed'];
        }
        execution.toolFailure = { stage, brokerResultAcknowledged: detail.brokerResultAcknowledged,
            ...(detail.requestId !== undefined ? { requestId: detail.requestId as number } : {}),
            ...(detail.toolId !== undefined ? { toolId: detail.toolId as number } : {}),
            ...(detail.elapsedMs !== undefined ? { elapsedMs: detail.elapsedMs as number } : {}),
            ...(detail.toolName !== undefined ? { toolName: detail.toolName as string } : {}),
            ...(lastConfirmed ? { lastConfirmed } : {}),
            ...(failureOrigin ? { failureOrigin } : {}),
            ...(detail.toolStarts !== undefined ? { toolStarts: detail.toolStarts as number } : {}),
            ...(detail.toolAcknowledgements !== undefined ?
                { toolAcknowledgements: detail.toolAcknowledgements as number } : {}),
            ...(failedToolStart ? { failedToolStart } : {}) };
    }
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
        if (!Array.isArray(v.toolEvents) || v.toolEvents.length > 512) throw new Error('Invalid Chat tool events');
        execution.toolEvents = v.toolEvents.map(item => {
            const event = record(item, ['name', 'status', 'truncated', 'code', 'stage', 'brokerExecuted',
                'offset', 'pageSize', 'sourceHashSupplied', 'endOffset', 'commandMode', 'approval',
                'commandExecuted', 'commandDigest', 'assessment'], ['name', 'status', 'truncated']);
            if (typeof event.truncated !== 'boolean') throw new Error('Invalid Chat tool truncation');
            let assessment: NonNullable<NonNullable<ChatExecution['toolEvents']>[number]['assessment']> | undefined;
            if (event.assessment !== undefined) {
                if (event.name !== 'assessment_stage') throw new Error('Invalid Assessment diagnostic tool');
                const detail = record(event.assessment, ['ordinal', 'category', 'shape', 'code', 'field',
                    'previousFindingsPreserved', 'acceptedFindings'], ['ordinal', 'category', 'shape', 'code',
                    'field', 'previousFindingsPreserved', 'acceptedFindings']);
                if (!Number.isSafeInteger(detail.ordinal) || (detail.ordinal as number) < 1 ||
                    (detail.ordinal as number) > 512 || !Number.isSafeInteger(detail.acceptedFindings) ||
                    (detail.acceptedFindings as number) < 0 || (detail.acceptedFindings as number) > 48 ||
                    typeof detail.code !== 'string' || !/^ASSESSMENT_[A-Z_]{2,64}$/u.test(detail.code) ||
                    typeof detail.previousFindingsPreserved !== 'boolean')
                    throw new Error('Invalid Assessment diagnostic');
                assessment = { ordinal: detail.ordinal as number,
                    category: choice(detail.category, ['scope', 'tiers', 'observations', 'preservation',
                        'dependencies', 'risks', 'unrecognized'] as const, 'Assessment category'),
                    shape: choice(detail.shape, ['finding', 'empty', 'scope', 'tiers', 'invalid'] as const, 'Assessment shape'),
                    code: detail.code, field: choice(detail.field, ['none', 'shape', 'category', 'citation',
                        'source', 'authority', 'resource', 'internal'] as const, 'Assessment field'),
                    previousFindingsPreserved: detail.previousFindingsPreserved,
                    acceptedFindings: detail.acceptedFindings as number };
            }
            return { name: choice(event.name, ['read_file', 'list_files', 'search_paths', 'search_text', 'run_command',
                'dope_read', 'dope_list', 'dope_search_paths', 'dope_search_text', 'dope_command',
                'roadmap_read', 'roadmap_stage', 'roadmap_cancel', 'roadmap_phase', 'roadmap_finish',
                'proposal_status', 'proposal_stage_document', 'proposal_stage_prompt', 'proposal_finish',
                'assessment_status', 'assessment_stage', 'assessment_finish'] as const,
                'Chat tool'), status: choice(event.status, ['completed', 'failed', 'denied'] as const, 'Chat tool status'),
                truncated: event.truncated, ...(assessment ? { assessment } : {}),
                ...(event.code === undefined ? {} : { code: choice(event.code, ['INVALID_ARGUMENTS',
                    'INVALID_OFFSET', 'INVALID_PAGE_SIZE', 'SOURCE_IDENTITY_REQUIRED',
                    'INVALID_SOURCE_IDENTITY', 'STALE_SOURCE', 'OUTPUT_BUDGET', 'AUTHORITY_DENIED',
                    'NOT_A_DIRECTORY', 'MISSING_FILE', 'UNSAFE_PATH',
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
    if (['complete', 'stopped-incomplete', 'failed', 'cancelled', 'interrupted'].includes(execution.status) !== Boolean(execution.finishedAt) ||
        (execution.status === 'failed' && !execution.failure ||
            !['failed', 'interrupted'].includes(execution.status) && Boolean(execution.failure)) ||
        (['streaming', 'paused-output-limit', 'complete', 'stopped-incomplete'].includes(execution.status) && !execution.actualModel) ||
        (execution.finishedAt && Date.parse(execution.finishedAt) < Date.parse(execution.startedAt)))
        throw new Error('Invalid execution lifecycle');
    return execution;
}
export function parseChatMessage(value: unknown): ChatMessage {
    const v = record(value, ['schemaVersion', 'id', 'role', 'createdAt', 'content', 'contextRefs', 'skill', 'promptDraft', 'execution', 'activity', 'answerPartial', 'planningActivity', 'proposalProgress', 'roadmapAction', 'lockedRoadmapPlan'],
        ['schemaVersion', 'id', 'role', 'createdAt', 'content']);
    if (v.schemaVersion !== 1) throw new Error('Unsupported message schema');
    const base = { schemaVersion: 1 as const, id: identifier(v.id), createdAt: time(v.createdAt), content: string(v.content, 'message content', false) };
    if (v.role === 'user') {
        if (!Array.isArray(v.contextRefs) || v.execution !== undefined || v.activity !== undefined || v.answerPartial !== undefined || v.planningActivity !== undefined || v.proposalProgress !== undefined || v.roadmapAction !== undefined || v.lockedRoadmapPlan !== undefined || !base.content.trim()) throw new Error('Invalid user message');
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
        const promptDraft = v.promptDraft === undefined ? undefined : (() => {
            const draft = record(v.promptDraft, ['schemaVersion', 'id', 'revision', 'slug', 'projectId', 'chatId',
                'userMessageId', 'leaseDigest', 'sourceHead', 'sourceVersion', 'sourceFingerprint'],
            ['schemaVersion', 'id', 'revision', 'slug', 'projectId', 'chatId', 'userMessageId', 'leaseDigest',
                'sourceHead', 'sourceVersion', 'sourceFingerprint']);
            if (draft.schemaVersion !== 1 || draft.revision !== 1 ||
                !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(draft.slug as string) ||
                (draft.slug as string).length < 3 || (draft.slug as string).length > 32 ||
                !/^[a-f0-9]{64}$/u.test(draft.projectId as string) ||
                !/^[a-f0-9]{64}$/u.test(draft.leaseDigest as string) ||
                typeof draft.sourceHead !== 'string' || typeof draft.sourceVersion !== 'string' ||
                !/^[a-f0-9]{64}$/u.test(draft.sourceFingerprint as string) ||
                draft.userMessageId !== base.id) throw new Error('Invalid named prompt draft identity');
            return { schemaVersion: 1 as const, id: identifier(draft.id), revision: 1 as const,
                slug: draft.slug as string, projectId: draft.projectId as string,
                chatId: identifier(draft.chatId), userMessageId: base.id,
                leaseDigest: draft.leaseDigest as string, sourceHead: draft.sourceHead,
                sourceVersion: draft.sourceVersion, sourceFingerprint: draft.sourceFingerprint as string };
        })();
        return { ...base, role: 'user', contextRefs: v.contextRefs.map(parseChatContextRef),
            ...(skill ? { skill } : {}), ...(promptDraft ? { promptDraft } : {}) };
    }
    if (v.role === 'assistant') {
        if (v.contextRefs !== undefined) throw new Error('Invalid assistant message');
        const execution = parseExecution(v.execution);
        const activity = v.activity === undefined ? undefined : parseExecutionActivity(v.activity,
            (v.activity as ChatExecutionActivity).chatId, base.id, execution.id);
        const answerPartial = v.answerPartial === undefined ? undefined : parseChatAnswerPartial(v.answerPartial);
        if ((answerPartial || ['paused-output-limit', 'stopped-incomplete', 'interrupted'].includes(execution.status)) && base.content ||
            answerPartial && execution.status === 'pending') throw new Error('Incomplete assistant cannot commit content');
        const planningActivity = v.planningActivity === undefined ? undefined : parsePlanningActivity(v.planningActivity);
        const proposalProgress = v.proposalProgress === undefined ? undefined : parseProposalProgress(v.proposalProgress);
        const roadmapAction = v.roadmapAction === undefined ? undefined : parseChatRoadmapAction(v.roadmapAction);
        const lockedRoadmapPlan = v.lockedRoadmapPlan === undefined ? undefined : parseChatLockedRoadmapPlan(v.lockedRoadmapPlan);
        if (lockedRoadmapPlan && (lockedRoadmapPlan.assistantMessageId !== base.id || lockedRoadmapPlan.executionId !== execution.id))
            throw new Error('Locked Roadmap plan message identity mismatch');
        if (planningActivity && !['complete', 'failed', 'cancelled'].includes(execution.status))
            throw new Error('Planning activity requires a completed execution');
        if (planningActivity && (planningActivity.kind === 'error' ? execution.status !== 'failed' :
            planningActivity.kind === 'cancelled' ? execution.status !== 'cancelled' : execution.status !== 'complete'))
            throw new Error('Planning activity differs from execution outcome');
        return { ...base, role: 'assistant', execution, ...(activity ? { activity } : {}),
            ...(answerPartial ? { answerPartial } : {}),
            ...(planningActivity ? { planningActivity } : {}),
            ...(proposalProgress ? { proposalProgress } : {}),
            ...(roadmapAction ? { roadmapAction } : {}),
            ...(lockedRoadmapPlan ? { lockedRoadmapPlan } : {}) };
    }
    throw new Error('Invalid Chat role');
}
export function parseProposalProgress(value: unknown): ChatProposalProgress {
    const v = record(value, ['schemaVersion', 'domain', 'proposalId', 'root', 'worktreeId', 'ownerId',
        'revision', 'state', 'targets', 'diagnostic', 'reviewDigest'], ['schemaVersion', 'domain', 'proposalId', 'root',
        'worktreeId', 'ownerId', 'revision', 'state', 'targets']);
    if (v.schemaVersion !== 1 || !Number.isSafeInteger(v.revision) || (v.revision as number) < 0 ||
        !Array.isArray(v.targets) || v.targets.length > 64 ||
        v.diagnostic !== undefined && (typeof v.diagnostic !== 'string' || v.diagnostic.length > 300) ||
        v.reviewDigest !== undefined && (v.state !== 'ready-for-review' ||
            typeof v.reviewDigest !== 'string' || !/^[a-f0-9]{64}$/u.test(v.reviewDigest)))
        throw new Error('Invalid proposal progress');
    const targets = v.targets.map(raw => {
        const target = record(raw, ['target', 'path', 'chunks', 'bytes', 'complete', 'original',
            'proposed', 'truncated'], ['target', 'path', 'chunks', 'bytes', 'complete', 'original',
            'proposed', 'truncated']);
        if (typeof target.target !== 'string' || target.target.length > 240 ||
            typeof target.path !== 'string' || target.path.length > 300 ||
            !/^[a-zA-Z0-9_.-]+(?:\/[a-zA-Z0-9_.-]+)*\.(?:md|txt)$/u.test(target.path) ||
            target.path.split('/').some(part => part === '.' || part === '..') ||
            !Number.isSafeInteger(target.chunks) || (target.chunks as number) < 1 ||
            !Number.isSafeInteger(target.bytes) || (target.bytes as number) < 1 ||
            typeof target.complete !== 'boolean' || typeof target.proposed !== 'string' ||
            target.proposed.length > 8192 || target.original !== null &&
                (typeof target.original !== 'string' || target.original.length > 8192) ||
            typeof target.truncated !== 'boolean') throw new Error('Invalid proposal progress target');
        return target as unknown as ChatProposalProgress['targets'][number];
    });
    return { schemaVersion: 1, domain: choice(v.domain, ['document', 'prompt'] as const, 'proposal domain'),
        proposalId: identifier(v.proposalId), root: string(v.root, 'proposal root'),
        worktreeId: string(v.worktreeId, 'proposal worktree'), ownerId: string(v.ownerId, 'proposal owner'),
        revision: v.revision as number,
        state: choice(v.state, ['staging', 'ready-for-review', 'cancelled', 'stale', 'blocked'] as const, 'proposal state'),
        targets, ...(v.diagnostic ? { diagnostic: v.diagnostic as string } : {}),
        ...(v.reviewDigest ? { reviewDigest: v.reviewDigest as string } : {}) };
}
export function parseChatLockedRoadmapPlan(value: unknown): ChatLockedRoadmapPlan {
    const v = record(value, ['schemaVersion', 'status', 'text', 'sha256', 'projectRoot', 'projectId',
        'chatId', 'userMessageId', 'assistantMessageId', 'executionId', 'turnId', 'leaseDigest', 'ownerRevision', 'sourceHash', 'createdAt'],
    ['schemaVersion', 'status', 'text', 'sha256', 'projectRoot', 'projectId', 'chatId', 'userMessageId',
        'assistantMessageId', 'executionId', 'turnId', 'leaseDigest', 'ownerRevision', 'sourceHash', 'createdAt']);
    if (v.schemaVersion !== 1 || v.status !== 'planning-only' || typeof v.text !== 'string' ||
        new TextEncoder().encode(v.text).length < 200 || new TextEncoder().encode(v.text).length > 32768 ||
        /[\0-\x08\x0b\x0c\x0e-\x1f\u007f]|\b(?:api[_-]?key|bearer\s+\S+|"(?:arguments|tool_calls)"\s*:)|\bsk-[A-Za-z0-9]{12,}/iu.test(v.text))
        throw new Error('Invalid locked Roadmap plan');
    const sourceHash = v.sourceHash === null ? null : sha256(v.sourceHash, 'plan source hash');
    const ownerRevision = count(v.ownerRevision, 'plan owner revision');
    if (ownerRevision > 0 && !sourceHash) throw new Error('Locked plan requires source hash');
    const projectRoot = string(v.projectRoot, 'plan project root');
    if (!projectRoot.startsWith('/') || projectRoot.includes('\0')) throw new Error('Invalid plan project root');
    return { schemaVersion: 1, status: 'planning-only', text: v.text,
        sha256: sha256(v.sha256, 'plan hash'), projectRoot, projectId: string(v.projectId, 'plan project ID'),
        chatId: identifier(v.chatId), userMessageId: identifier(v.userMessageId),
        assistantMessageId: identifier(v.assistantMessageId), executionId: identifier(v.executionId),
        turnId: identifier(v.turnId), leaseDigest: sha256(v.leaseDigest, 'plan lease digest'),
        ownerRevision, sourceHash, createdAt: time(v.createdAt) };
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
    const v = record(value, ['schemaVersion', 'kind', 'status', 'refs', 'proposalId', 'appliedRevision', 'proposal', 'documentProposal', 'promptStackProposal', 'documentationDiscovery', 'diagnostic', 'verifiedGuidance'],
        ['schemaVersion', 'kind', 'status', 'refs']);
    if (v.schemaVersion !== 1 || !Array.isArray(v.refs)) throw new Error('Invalid planning activity');
    const kind = choice(v.kind, ['roadmap-intent', 'roadmap-proposal', 'roadmap-sequence', 'roadmap-gate-proposal', 'roadmap-gate-undo', 'roadmap-publication', 'roadmap-gate-focus', 'roadmap-draft-proposal', 'roadmap-draft-sequence', 'implementation-plan', 'implementation-plan-revision', 'bridge-proposal', 'documentation-proposal', 'prompt-stack-proposal', 'no-action',
        'error', 'cancelled'] as const, 'planning activity kind');
    const status = choice(v.status, ['pending', 'approved', 'suggested', 'no-action', 'rejected', 'denied', 'stale', 'superseded', 'applied',
        'failed', 'cancelled'] as const, 'planning activity status');
    if ((kind === 'no-action') !== (status === 'no-action') ||
        (kind === 'bridge-proposal') !== (status === 'suggested') ||
        (status === 'suggested' && v.proposalId !== undefined) ||
        (kind === 'error' ? status !== 'failed' : status === 'failed' && kind !== 'documentation-proposal' && kind !== 'prompt-stack-proposal') ||
        (kind === 'cancelled' ? status !== 'cancelled' :
            status === 'cancelled' && kind !== 'roadmap-gate-proposal' && kind !== 'roadmap-gate-undo' && kind !== 'roadmap-publication' && kind !== 'documentation-proposal' && kind !== 'prompt-stack-proposal') ||
        (['pending', 'approved', 'denied', 'stale', 'superseded', 'applied'].includes(status) && v.proposalId === undefined) ||
        (status === 'cancelled' && kind !== 'cancelled' && v.proposalId === undefined) ||
        (['no-action', 'failed'].includes(status) && v.proposalId !== undefined && kind !== 'documentation-proposal' && kind !== 'prompt-stack-proposal') ||
        (status === 'cancelled' && kind === 'cancelled' && v.proposalId !== undefined) ||
        (!['documentation-proposal', 'prompt-stack-proposal'].includes(kind) ?
            (status === 'applied') !== (v.appliedRevision !== undefined) : v.appliedRevision !== undefined) ||
        (v.verifiedGuidance !== undefined && kind !== 'no-action') ||
        (kind === 'documentation-proposal' && (v.documentProposal === undefined || v.proposalId === undefined ||
            !['pending', 'approved', 'applied', 'failed', 'stale', 'superseded', 'denied', 'cancelled'].includes(status))) ||
        (kind !== 'documentation-proposal' && v.documentProposal !== undefined) ||
        (kind === 'prompt-stack-proposal' && (v.promptStackProposal === undefined || v.proposalId === undefined ||
            !['pending', 'approved', 'applied', 'failed', 'stale', 'superseded', 'denied', 'cancelled'].includes(status))) ||
        (kind !== 'prompt-stack-proposal' && v.promptStackProposal !== undefined))
        throw new Error('Invalid planning activity state');
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
                try { const op = record(item, ['id', 'type', 'targetId', 'targetIds', 'status'],
                    ['id', 'type', 'targetId', 'status']);
                    identifier(op.id); string(op.type, 'operation type'); string(op.targetId, 'Roadmap target ID');
                    if (op.targetIds !== undefined && (!Array.isArray(op.targetIds) || op.targetIds.length > 64))
                        throw new Error('Invalid Roadmap operation targets');
                    for (const id of op.targetIds ?? []) string(id, 'Roadmap target ID');
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
                    targetId: string(op.targetId, 'Roadmap target ID'),
                    ...(op.targetIds === undefined ? {} : { targetIds: (op.targetIds as unknown[]).map(id =>
                        string(id, 'Roadmap target ID')) }),
                    status: choice(op.status,
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
    let documentProposal: ChatDocumentationProposal | undefined;
    if (v.documentProposal !== undefined) {
        if (kind !== 'documentation-proposal' || JSON.stringify(v.documentProposal).length > 4 * 1024 * 1024)
            throw new Error('Invalid saved documentation proposal');
        const p = record(v.documentProposal, ['id', 'digest', 'root', 'projectId', 'worktreeId', 'ownerId',
            'chatId', 'messageId', 'leaseDigest', 'roadmapRevision', 'createdAt', 'expiresAt', 'targets',
            'dependencies', 'dependencySnapshotVersion', 'proposalRevision', 'reviewIntent'],
            ['id', 'digest', 'root', 'projectId', 'worktreeId', 'ownerId', 'chatId', 'messageId',
                'leaseDigest', 'roadmapRevision', 'createdAt', 'expiresAt', 'targets']);
        const hash = (value: unknown): string => {
            const result = string(value, 'documentation hash');
            if (!/^[a-f0-9]{64}$/u.test(result)) throw new Error('Invalid documentation hash');
            return result;
        };
        if (p.id !== v.proposalId || !Array.isArray(p.targets) || !p.targets.length || p.targets.length > 16 ||
            (p.dependencies !== undefined && (!Array.isArray(p.dependencies) || p.dependencies.length > 16)) ||
            (p.dependencySnapshotVersion !== undefined && p.dependencySnapshotVersion !== 1) ||
            (p.proposalRevision !== undefined && (!Number.isSafeInteger(p.proposalRevision) ||
                (p.proposalRevision as number) < 1)) ||
            (p.reviewIntent !== undefined && (typeof p.reviewIntent !== 'string' || p.reviewIntent.length > 4000)))
            throw new Error('Invalid documentation targets');
        const dependencies = (p.dependencies ?? [] as unknown[]).map((item: unknown) => {
            const d = record(item, ['path', 'contentHash', 'dev', 'ino'], ['path', 'contentHash', 'dev', 'ino']);
            if (!Number.isSafeInteger(d.dev) || (d.dev as number) < 0 ||
                !Number.isSafeInteger(d.ino) || (d.ino as number) < 0)
                throw new Error('Invalid documentation dependency identity');
            return { path: string(d.path, 'documentation dependency path'), contentHash: hash(d.contentHash),
                dev: d.dev as number, ino: d.ino as number };
        });
        if (new Set(dependencies.map(item => item.path)).size !== dependencies.length)
            throw new Error('Duplicate documentation dependency');
        const targets = p.targets.map((item: unknown) => {
            const t = record(item, ['path', 'operation', 'before', 'beforeHash', 'after', 'afterHash', 'diff'],
                ['path', 'operation', 'before', 'beforeHash', 'after', 'afterHash', 'diff']);
            const before = t.before === null ? null : string(t.before, 'before text', false);
            const beforeHash = t.beforeHash === null ? null : hash(t.beforeHash);
            if ((before === null) !== (beforeHash === null) ||
                (t.operation === 'create') !== (before === null)) throw new Error('Invalid documentation basis');
            return { path: string(t.path, 'documentation path'),
                operation: choice(t.operation, ['create', 'update'] as const, 'documentation operation'),
                before, beforeHash, after: string(t.after, 'after text', false),
                afterHash: hash(t.afterHash), diff: string(t.diff, 'documentation diff', false) };
        });
        documentProposal = { id: identifier(p.id), digest: hash(p.digest), root: string(p.root, 'documentation root'),
            projectId: string(p.projectId, 'documentation project'), worktreeId: hash(p.worktreeId),
            ownerId: string(p.ownerId, 'documentation owner'), chatId: identifier(p.chatId), messageId: identifier(p.messageId),
            leaseDigest: hash(p.leaseDigest), roadmapRevision: count(p.roadmapRevision, 'Roadmap revision'),
            createdAt: time(p.createdAt), expiresAt: time(p.expiresAt), targets, dependencies,
            ...(p.proposalRevision === undefined ? {} : { proposalRevision: p.proposalRevision as number }),
            ...(p.reviewIntent === undefined ? {} : { reviewIntent: p.reviewIntent as string }),
            ...(p.dependencySnapshotVersion === 1 ? { dependencySnapshotVersion: 1 as const } : {}) };
    }
    let documentationDiscovery: ChatPlanningActivity['documentationDiscovery'];
    let promptStackProposal: ChatPromptStackProposal | undefined;
    if (v.promptStackProposal !== undefined) {
        if (kind !== 'prompt-stack-proposal' || JSON.stringify(v.promptStackProposal).length > 384_000)
            throw new Error('Invalid saved prompt stack proposal');
        const p = record(v.promptStackProposal, ['id', 'digest', 'root', 'projectId', 'ownerId', 'chatId',
            'messageId', 'leaseDigest', 'revision', 'folder', 'sourceVersion', 'gitHead', 'worktreeId',
            'assessmentMessageId', 'planMessageId', 'createdAt', 'files'],
            ['id', 'digest', 'root', 'projectId', 'ownerId', 'chatId', 'messageId', 'leaseDigest',
                'revision', 'folder', 'sourceVersion', 'gitHead', 'worktreeId',
                'assessmentMessageId', 'planMessageId', 'createdAt', 'files']);
        const hash = (x: unknown) => {
            const s = string(x, 'prompt stack hash');
            if (!/^[a-f0-9]{64}$/u.test(s)) throw new Error('Invalid prompt stack hash');
            return s;
        };
        const folder = string(p.folder, 'prompt stack folder');
        if (!/^[cp][a-z0-9-]{0,99}$/u.test(folder) || !Array.isArray(p.files) ||
            p.files.length < 5 || p.files.length > 52 || !Number.isSafeInteger(p.revision) ||
            (p.revision as number) < 1 || !/^[a-f0-9]{40,64}$/u.test(String(p.gitHead)) ||
            !/^\d+\.\d+\.\d+$/u.test(String(p.sourceVersion)) || p.id !== v.proposalId)
            throw new Error('Invalid prompt stack identity');
        const files = p.files.map(item => {
            const f = record(item, ['path', 'after', 'afterHash', 'before'],
                ['path', 'after', 'afterHash', 'before']);
            const path = string(f.path, 'prompt stack path');
            const after = string(f.after, 'prompt stack text', false);
            if (f.before !== null || !new RegExp(`^docs/tasks/${folder}/(?:prompt-assessment\\.md|implementation-plan\\.md|README\\.md|P[1-9]\\d*-[a-z0-9-]+\\.txt)$`, 'u').test(path) ||
                partialBytes(after) > 32_000) throw new Error('Invalid prompt stack file');
            return { path, after, afterHash: hash(f.afterHash), before: null as null };
        });
        if (new Set(files.map(file => file.path)).size !== files.length ||
            files[0].path !== `docs/tasks/${folder}/prompt-assessment.md` ||
            files[1].path !== `docs/tasks/${folder}/implementation-plan.md` ||
            files[2].path !== `docs/tasks/${folder}/README.md`)
            throw new Error('Invalid prompt stack file order');
        promptStackProposal = { id: identifier(p.id), digest: hash(p.digest),
            root: string(p.root, 'prompt stack root'), projectId: hash(p.projectId),
            ownerId: string(p.ownerId, 'prompt stack owner'), chatId: identifier(p.chatId),
            messageId: identifier(p.messageId), leaseDigest: hash(p.leaseDigest),
            revision: p.revision as number, folder, sourceVersion: string(p.sourceVersion, 'source version'),
            gitHead: string(p.gitHead, 'Git head'), worktreeId: hash(p.worktreeId),
            assessmentMessageId: identifier(p.assessmentMessageId),
            planMessageId: identifier(p.planMessageId), createdAt: time(p.createdAt), files };
    }
    if (v.documentationDiscovery !== undefined) {
        if (kind !== 'documentation-proposal') throw new Error('Invalid documentation discovery');
        const d = record(v.documentationDiscovery, ['detected', 'omitted', 'reads'], ['detected', 'omitted', 'reads']);
        if (d.detected !== null && (!Number.isSafeInteger(d.detected) || (d.detected as number) < 0) ||
            !Array.isArray(d.omitted) || d.omitted.length > 30 || !Array.isArray(d.reads) || d.reads.length > 16)
            throw new Error('Invalid documentation discovery');
        const reads = d.reads.map(item => {
            const r = record(item, ['path', 'count'], ['path', 'count']);
            const path = string(r.path, 'documentation read path');
            if (!/^(?!\/)(?!.*(?:^|\/)\.\.?\/)[^\\\x00-\x1f]+\.(?:md|txt)$/iu.test(path) ||
                !Number.isSafeInteger(r.count) || (r.count as number) < 1) throw new Error('Invalid documentation read');
            return { path, count: r.count as number };
        });
        if (new Set(reads.map(item => item.path)).size !== reads.length)
            throw new Error('Duplicate documentation read');
        documentationDiscovery = { detected: d.detected as number | null,
            omitted: d.omitted.map(item => string(item, 'documentation omission').slice(0, 300)), reads };
    }
    return { schemaVersion: 1, kind, status, refs: v.refs.map(parseChatContextRef),
        ...(v.proposalId === undefined ? {} : { proposalId: string(v.proposalId, 'proposal ID') }),
        ...(v.appliedRevision === undefined ? {} : { appliedRevision: count(v.appliedRevision, 'applied revision') }),
        ...(proposal === undefined ? {} : { proposal }),
        ...(documentProposal === undefined ? {} : { documentProposal }),
        ...(promptStackProposal === undefined ? {} : { promptStackProposal }),
        ...(documentationDiscovery === undefined ? {} : { documentationDiscovery }),
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
