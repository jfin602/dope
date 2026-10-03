/** Only the provider-neutral capabilities needed by current structured generation. */
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
        'cancelled' | 'invalid-json' | 'authentication' | 'nonretryable-provider') {
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
