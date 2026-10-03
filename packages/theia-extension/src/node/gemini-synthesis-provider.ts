import { GoogleGenAI } from '@google/genai';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { StructuredGenerationRequest, ModelCapabilities, ModelGenerationExecution } from '@dope/contracts/lib/model-runtime';
import { count, discoverGeminiModels, sanitizedGeminiFailure as sanitized } from './provider-transport';

const DEFAULT_TIMEOUT_MS = 900_000;
const schemaKeywords = new Set(['type', 'enum', 'items', 'minItems', 'maxItems', 'minimum', 'maximum',
    'properties', 'additionalProperties', 'required', 'anyOf', 'oneOf', 'description']);

/** Gemini accepts only part of JSON Schema. Dope's complete result parser remains authoritative. */
export function geminiStageSchema(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(geminiStageSchema);
    if (!value || typeof value !== 'object') return value;
    const projected: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
        if (key === 'const') projected.enum = [child];
        else if (key === 'pattern' && typeof child === 'string') projected.description = `Must match ${child}`;
        else if (key === 'properties' && child && typeof child === 'object' && !Array.isArray(child))
            projected.properties = Object.fromEntries(Object.entries(child).map(([name, property]) => [name, geminiStageSchema(property)]));
        else if (schemaKeywords.has(key)) projected[key] = geminiStageSchema(child);
    }
    return projected;
}

export class GeminiSynthesisProvider {
    readonly kind = 'gemini' as const;
    private readonly client: GoogleGenAI;
    private readonly timeoutMs: number;
    private capability?: ModelCapabilities;
    private models: string[] = [];
    private model?: string;
    private probed = false;
    get runtimeIdentity(): string { return this.kind; }
    get isReady(): boolean { return this.probed; }

    constructor(options: { apiKey: string; timeoutMs?: number; fetch?: typeof globalThis.fetch }) {
        if (typeof options.apiKey !== 'string' || !options.apiKey.trim() || /\s/.test(options.apiKey))
            throw new Error('Invalid Gemini API key');
        if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1))
            throw new Error('Invalid Gemini synthesis timeout');
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.client = new GoogleGenAI({ apiKey: options.apiKey,
            ...(options.fetch ? { httpOptions: { fetch: options.fetch } } : {}) });
    }

    async discoverModels(): Promise<string[]> {
        this.models = [];
        this.model = undefined;
        this.capability = undefined;
        this.probed = false;
        try {
            this.models = await discoverGeminiModels(this.client, this.timeoutMs);
            return this.models;
        } catch (error) { throw sanitized(error, false); }
    }

    selectModel(modelId: string): void {
        if (!this.models.includes(modelId)) throw new Error('Select a discovered Gemini model');
        this.model = modelId;
        this.capability = undefined;
        this.probed = false;
    }

    get selectedModel(): string | undefined { return this.model; }

    private requireModel(): string {
        if (!this.model) throw new Error('Select a Gemini model');
        return this.model;
    }

    /** Synthetic structured-output check; repository evidence is never used. */
    async probe(): Promise<void> {
        const model = this.requireModel();
        this.probed = false;
        await this.capabilities();
        try {
            const response = await this.client.models.generateContent({ model,
                contents: 'Return readiness for this synthetic request.', config: {
                    systemInstruction: 'Return only {"ready":true}.', responseMimeType: 'application/json',
                    responseJsonSchema: { type: 'object', properties: { ready: { type: 'boolean' } },
                        required: ['ready'], additionalProperties: false }, maxOutputTokens: 1024,
                    abortSignal: AbortSignal.timeout(this.timeoutMs) } });
            let ready: unknown;
            try { ready = JSON.parse(response.text ?? '')?.ready; } catch { throw new Error('Invalid readiness response'); }
            if (ready !== true) throw new Error('Invalid readiness response');
            this.probed = true;
        } catch (error) { throw new Error(`Gemini readiness: ${sanitized(error, false).message}`); }
    }

    async capabilities(): Promise<ModelCapabilities> {
        if (this.capability) return this.capability;
        const selectedModel = this.requireModel();
        try {
            const model = await this.client.models.get({ model: selectedModel,
                config: { httpOptions: { timeout: this.timeoutMs } } });
            const limit = model.inputTokenLimit;
            if (!Number.isSafeInteger(limit) || !limit || limit < 8192) throw new Error('Invalid model capacity');
            // Keep the model's large context as headroom; planner requests use a small fraction of its input limit.
            this.capability = { modelLabel: selectedModel, contextWindowTokens: limit,
                maxInputTokens: Math.max(8192, Math.floor(limit / 16)), reservedInstructionTokens: 2048,
                reservedOutputTokens: 4096, reservedOverheadTokens: 1024,
                tokenEstimate: 'conservative', maxConcurrentGenerations: 1 };
            return this.capability;
        } catch (error) { throw new Error(`Gemini model metadata: ${sanitized(error, false).message}`); }
    }

    /** Local byte estimate avoids countTokens calls in the evidence planner's search loop. */
    async estimateTokens(input: string): Promise<number> { return Buffer.byteLength(input); }

    async generateStructured(request: StructuredGenerationRequest): Promise<ModelGenerationExecution> {
        if (request.signal?.aborted) throw sanitized(undefined, true);
        const model = this.requireModel();
        const schema = geminiStageSchema(request.schema);
        const body = { model, contents: request.input, config: { systemInstruction: request.instruction,
            responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0, maxOutputTokens: 32768 } };
        const timeout = AbortSignal.timeout(this.timeoutMs);
        const abortSignal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
        let response;
        try {
            response = await this.client.models.generateContent({ ...body,
                config: { ...body.config, abortSignal } });
        } catch (error) { throw sanitized(error, abortSignal.aborted); }
        if (abortSignal.aborted) throw sanitized(undefined, true);
        if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS')
            throw new ModelRuntimeFailure('Gemini stage output truncated at token limit', 'nonretryable-provider');
        let output: unknown;
        let content: string;
        try {
            content = response.text!;
            if (typeof content !== 'string' || !content.trim()) throw new Error('Empty response');
            output = JSON.parse(content);
        } catch { throw new ModelRuntimeFailure('Invalid Gemini stage JSON', 'invalid-json'); }
        const usage = response.usageMetadata;
        const inputTokens = count(usage?.promptTokenCount);
        const outputTokens = count(usage?.candidatesTokenCount);
        const totalTokens = count(usage?.totalTokenCount);
        return { output, usage: { providerKind: 'gemini', modelLabel: model,
            requestBytes: Buffer.byteLength(request.input), outputBytes: Buffer.byteLength(content),
            ...(inputTokens === undefined ? {} : { inputTokens }),
            ...(outputTokens === undefined ? {} : { outputTokens }),
            ...(totalTokens === undefined ? {} : { totalTokens }),
            tokenMeasurement: inputTokens !== undefined || outputTokens !== undefined || totalTokens !== undefined
                ? 'provider-reported' : 'unavailable' } };
    }
}
