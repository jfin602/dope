import { GoogleGenAI } from '@google/genai';
import { architectureProposalSchema, assertSynthesisInputBudget, synthesisStageResultSchemas, SynthesisProviderFailure } from '@dope/software-map';
import type { SynthesisCapabilities, SynthesisStageExecution, SynthesisStageRequest, TargetedRefinementRequest } from '@dope/software-map';
import { COMPONENT_DISCOVERY_INSTRUCTION, RECONCILIATION_INSTRUCTION, SUBSYSTEM_CHALLENGE_INSTRUCTION,
    SUBSYSTEM_DISCOVERY_INSTRUCTION, SYSTEM_CHALLENGE_INSTRUCTION,
    SYSTEM_DISCOVERY_INSTRUCTION, TARGET_REFINEMENT_INSTRUCTION, VERIFICATION_INSTRUCTION } from './lmstudio-synthesis-provider';

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

function count(value: unknown): number | undefined {
    return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : undefined;
}

function sanitized(error: unknown, aborted: boolean): Error {
    if (aborted || (error as { name?: unknown } | null)?.name === 'AbortError' ||
        (error as { name?: unknown } | null)?.name === 'TimeoutError')
        return new SynthesisProviderFailure('Gemini synthesis cancelled or timed out', 'cancelled');
    const status = (error as { status?: unknown } | null)?.status;
    if (error instanceof Error && ['Invalid model capacity', 'Invalid readiness response'].includes(error.message)) return error;
    if (status === 401 || status === 403)
        return new SynthesisProviderFailure(`Gemini authentication failed (HTTP ${status})`, 'authentication');
    if (status === 429) return new SynthesisProviderFailure('Gemini quota or rate limit exceeded (HTTP 429)', 'nonretryable-provider');
    if (typeof status === 'number' && status >= 500 && status <= 599)
        return new SynthesisProviderFailure(`Gemini upstream service failed (HTTP ${status})`, 'transient-upstream');
    if (typeof status === 'number' && status >= 400)
        return new SynthesisProviderFailure(`Gemini request rejected (HTTP ${status})`, 'nonretryable-provider');
    if (error instanceof TypeError) return new SynthesisProviderFailure('Gemini SDK or transport type error', 'transient-transport');
    if (error instanceof SyntaxError) return new SynthesisProviderFailure('Gemini response JSON error', 'invalid-json');
    return new SynthesisProviderFailure('Gemini synthesis request failed', 'nonretryable-provider');
}

export class GeminiSynthesisProvider {
    readonly kind = 'gemini' as const;
    private readonly client: GoogleGenAI;
    private readonly timeoutMs: number;
    private capability?: SynthesisCapabilities;
    private models: string[] = [];
    private model?: string;

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
        try {
            const pager = await this.client.models.list({ config: { httpOptions: { timeout: this.timeoutMs } } });
            const models: string[] = [];
            for await (const item of pager) {
                const id = item.name?.replace(/^models\//, '');
                if (id && /^gemini-/i.test(id) && !/(?:embedding|image|audio|tts|live|robotics|computer-use)/i.test(id) &&
                    item.supportedActions?.includes('generateContent')) models.push(id);
            }
            this.models = [...new Set(models)].sort();
            return this.models;
        } catch (error) { throw sanitized(error, false); }
    }

    selectModel(modelId: string): void {
        if (!this.models.includes(modelId)) throw new Error('Select a discovered Gemini model');
        this.model = modelId;
        this.capability = undefined;
    }

    get selectedModel(): string | undefined { return this.model; }

    private requireModel(): string {
        if (!this.model) throw new Error('Select a Gemini model');
        return this.model;
    }

    /** Synthetic structured-output check; repository evidence is never used. */
    async probe(): Promise<void> {
        const model = this.requireModel();
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
        } catch (error) { throw new Error(`Gemini readiness: ${sanitized(error, false).message}`); }
    }

    async capabilities(): Promise<SynthesisCapabilities> {
        if (this.capability) return this.capability;
        const selectedModel = this.requireModel();
        try {
            const model = await this.client.models.get({ model: selectedModel,
                config: { httpOptions: { timeout: this.timeoutMs } } });
            const limit = model.inputTokenLimit;
            if (!Number.isSafeInteger(limit) || !limit || limit < 8192) throw new Error('Invalid model capacity');
            // Keep the model's large context as headroom; planner requests use a small fraction of its input limit.
            this.capability = { modelLabel: selectedModel, contextWindowTokens: limit,
                maxInputTokens: Math.max(8192, Math.floor(limit / 32)), reservedInstructionTokens: 2048,
                reservedOutputTokens: 4096, reservedOverheadTokens: 1024,
                tokenEstimate: 'conservative', maxConcurrentGenerations: 1 };
            return this.capability;
        } catch (error) { throw new Error(`Gemini model metadata: ${sanitized(error, false).message}`); }
    }

    /** Local byte estimate avoids countTokens calls in the evidence planner's search loop. */
    async estimateTokens(input: string): Promise<number> { return Buffer.byteLength(input); }

    async runRefinement(request: TargetedRefinementRequest, signal?: AbortSignal): Promise<SynthesisStageExecution> { return this.runStage(request, signal); }

    async runStage(request: SynthesisStageRequest | TargetedRefinementRequest, signal?: AbortSignal): Promise<SynthesisStageExecution> {
        if (signal?.aborted) throw sanitized(undefined, true);
        const model = this.requireModel();
        const capability = await this.capabilities();
        const input = JSON.stringify(request);
        await assertSynthesisInputBudget(this, capability, input);
        const instruction = request.stage === 'system-challenge' ? SYSTEM_CHALLENGE_INSTRUCTION :
            request.stage === 'target-refinement' ? TARGET_REFINEMENT_INSTRUCTION :
            request.stage === 'subsystem-discovery' ? SUBSYSTEM_DISCOVERY_INSTRUCTION :
            request.stage === 'subsystem-challenge' ? SUBSYSTEM_CHALLENGE_INSTRUCTION :
            request.stage === 'component-discovery' ? COMPONENT_DISCOVERY_INSTRUCTION :
            request.stage === 'reconciliation' ? RECONCILIATION_INSTRUCTION :
            request.stage === 'verification' ? VERIFICATION_INSTRUCTION : SYSTEM_DISCOVERY_INSTRUCTION;
        const schema = geminiStageSchema(request.stage === 'target-refinement' ? architectureProposalSchema : synthesisStageResultSchemas[request.stage]);
        const body = { model, contents: input, config: { systemInstruction: instruction,
            responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0, maxOutputTokens: 32768 } };
        const timeout = AbortSignal.timeout(this.timeoutMs);
        const abortSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
        let response;
        try {
            response = await this.client.models.generateContent({ ...body,
                config: { ...body.config, abortSignal } });
        } catch (error) { throw sanitized(error, abortSignal.aborted); }
        if (abortSignal.aborted) throw sanitized(undefined, true);
        if (response.candidates?.[0]?.finishReason === 'MAX_TOKENS')
            throw new SynthesisProviderFailure('Gemini stage output truncated at token limit', 'invalid-json');
        let output: unknown;
        let content: string;
        try {
            content = response.text!;
            if (typeof content !== 'string' || !content.trim()) throw new Error('Empty response');
            output = JSON.parse(content);
        } catch { throw new SynthesisProviderFailure('Invalid Gemini stage JSON', 'invalid-json'); }
        const usage = response.usageMetadata;
        const inputTokens = count(usage?.promptTokenCount);
        const outputTokens = count(usage?.candidatesTokenCount);
        const totalTokens = count(usage?.totalTokenCount);
        return { output, usage: { providerKind: 'gemini', modelLabel: model,
            requestBytes: Buffer.byteLength(input), outputBytes: Buffer.byteLength(content),
            ...(inputTokens === undefined ? {} : { inputTokens }),
            ...(outputTokens === undefined ? {} : { outputTokens }),
            ...(totalTokens === undefined ? {} : { totalTokens }),
            tokenMeasurement: inputTokens !== undefined || outputTokens !== undefined || totalTokens !== undefined
                ? 'provider-reported' : 'unavailable' } };
    }
}
