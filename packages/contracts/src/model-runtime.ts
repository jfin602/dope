import type { AIConnectionId, ProviderModelKey } from '@dope/ai/lib/index';

/** Structured-generation limits remain the Software Map synthesis contract. */
export interface ModelCapabilities {
    modelLabel: string;
    contextWindowTokens: number;
    maxInputTokens: number;
    reservedInstructionTokens: number;
    reservedOutputTokens: number;
    reservedOverheadTokens: number;
    tokenEstimate: 'exact' | 'conservative';
    maxConcurrentGenerations?: number;
}

export interface ModelGenerationUsage {
    providerKind: 'local' | 'gemini';
    modelLabel: string;
    requestBytes: number;
    outputBytes: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    tokenMeasurement: 'provider-reported' | 'tokenizer' | 'estimated' | 'unavailable';
}
export interface ModelGenerationExecution { output: unknown; usage: ModelGenerationUsage }

/** Adapter-classified, safe failure. Raw provider errors stay inside the adapter. */
export class ModelRuntimeFailure extends Error {
    constructor(message: string, readonly failureClass: 'transient-transport' | 'transient-upstream' |
        'cancelled' | 'invalid-json' | 'incomplete-answer' | 'authentication' | 'nonretryable-provider' |
        'connection-unavailable' | 'model-unavailable' | 'unsupported-capability') {
        super(message);
    }
}

export interface ModelRuntimeSession {
    readonly runtimeIdentity: string;
    readonly isReady: boolean;
    discoverModels(): Promise<string[]>;
    selectModel(modelId: string): void;
    probe(): Promise<void>;
    /** A ready hosted runtime can omit a separate warm-up call. */
    warmUp?(): Promise<void>;
}

export interface StructuredGenerationRequest {
    name: string;
    instruction: string;
    input: string;
    schema: object;
    signal?: AbortSignal;
}

export interface ModelRuntime extends ModelRuntimeSession {
    readonly kind: ModelGenerationUsage['providerKind'];
    capabilities(): Promise<ModelCapabilities>;
    estimateTokens(input: string): Promise<number>;
    generateStructured(request: StructuredGenerationRequest): Promise<ModelGenerationExecution>;
}

/** IDs are opaque and stable within a connection; neither encodes provider behavior. */
export type ModelConnectionId = AIConnectionId;
export type ModelId = ProviderModelKey;
export interface ModelSelection { connectionId: ModelConnectionId; modelId: ModelId }

export interface ConversationModelCapabilities {
    conversationalText: boolean;
    streaming: boolean;
    contextWindowTokens?: number;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    /** Adapter-defined controls and their supported values, e.g. reasoning effort. */
    reasoningControls?: ReadonlyArray<{ id: string; values: readonly string[] }>;
}
export interface ConnectedModel {
    id: ModelId;
    label: string;
    capabilities: ConversationModelCapabilities;
}
export interface ConversationMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface ConversationRequest {
    modelId: ModelId;
    messages: readonly ConversationMessage[];
    maxOutputTokens?: number;
    controls?: Readonly<Record<string, string>>;
    signal?: AbortSignal;
    /** Backend-only authority for eligible local Pi project discovery. Never serialized to a provider. */
    projectTools?: { root: string;
        execute(name: string, args: unknown, signal?: AbortSignal): Promise<string> };
}
export interface ConversationUsage {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    tokenMeasurement: ModelGenerationUsage['tokenMeasurement'];
}
export type ConversationEvent =
    | { type: 'delta'; text: string }
    | { type: 'activity'; kind: 'thinking' | 'provisional' | 'answer'; text: string }
    | { type: 'complete'; text: string; usage: ConversationUsage; finishReason?: string;
        /** Ephemeral Pi context projection; the saved Dope messages remain canonical. */
        compaction?: { canonicalContextSha256: string; originalSha256: string;
            compactedSha256: string; tokensBefore: number };
        /** Provider-reported resolved model, when an explicit model alias resolves to a snapshot. */
        actualModelId?: string;
        /** Filled by the connection registry from the runtime actually used. */
        provenance?: { connectionId: ModelConnectionId; modelId: ModelId; providerId: string; modelLabel: string } };

/** A conversational adapter never chooses another model after explicit routing. */
export interface ConversationalModelRuntime {
    discoverModels(): Promise<ConnectedModel[]>;
    generateConversation(request: ConversationRequest): AsyncIterable<ConversationEvent>;
}
