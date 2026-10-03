import { GoogleGenAI } from '@google/genai';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ConnectedModel, ConversationEvent, ConversationRequest, ConversationUsage,
    ConversationalModelRuntime } from '@dope/contracts/lib/model-runtime';
import { count, discoverGeminiModels, localModelIds, normalizeSynthesisEndpoint,
    sanitizedGeminiFailure as sanitized } from './provider-transport';

const TIMEOUT_MS = 120_000;
const model = (id: string): ConnectedModel => ({ id, label: id,
    capabilities: { conversationalText: true, streaming: true } });
const failure = (provider: string, status: number): ModelRuntimeFailure => {
    if (status === 401 || status === 403) return new ModelRuntimeFailure(`${provider} authentication failed`, 'authentication');
    if (status === 404) return new ModelRuntimeFailure(`${provider} model or endpoint unavailable`, 'model-unavailable');
    if (status >= 500) return new ModelRuntimeFailure(`${provider} service unavailable`, 'transient-upstream');
    return new ModelRuntimeFailure(`${provider} request rejected (HTTP ${status})`, 'nonretryable-provider');
};
const cancelled = () => new ModelRuntimeFailure('Conversation cancelled', 'cancelled');

/** Chat has its own runtime instance; it never changes Software Map's selected provider or warm state. */
export class LocalConversationalProvider implements ConversationalModelRuntime {
    private readonly endpoint: string;
    private readonly token?: string;
    private readonly timeoutMs: number;
    private models: string[] = [];
    private generation = 0;
    constructor(options: { endpoint?: string; token?: string; timeoutMs?: number; fetch?: typeof globalThis.fetch } = {}) {
        this.endpoint = normalizeSynthesisEndpoint(options.endpoint);
        if (options.token !== undefined && !/^[^\s]+$/.test(options.token)) throw new Error('Invalid local token');
        if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1))
            throw new Error('Invalid local timeout');
        this.token = options.token;
        this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
        this.fetch = options.fetch ?? globalThis.fetch;
    }
    private readonly fetch: typeof globalThis.fetch;
    private headers(): HeadersInit { return this.token ? { Authorization: `Bearer ${this.token}` } : {}; }
    async discoverModels(): Promise<ConnectedModel[]> {
        const generation = ++this.generation;
        this.models = [];
        try {
            const response = await this.fetch(`${this.endpoint}/models`, {
                headers: this.headers(), signal: AbortSignal.timeout(this.timeoutMs) });
            if (!response.ok) throw failure('Local', response.status);
            const ids = localModelIds(await response.json());
            if (generation !== this.generation) return [];
            this.models = ids;
            return ids.map(model);
        } catch (error) {
            if (error instanceof ModelRuntimeFailure) throw error;
            if (error instanceof SyntaxError || error instanceof Error && error.message === 'Invalid synthesis model list')
                throw new ModelRuntimeFailure('Invalid local model inventory', 'invalid-json');
            throw new ModelRuntimeFailure('Local connection failed or timed out', 'transient-transport');
        }
    }
    async *generateConversation(request: ConversationRequest): AsyncIterable<ConversationEvent> {
        if (!this.models.includes(request.modelId)) throw new ModelRuntimeFailure('Selected local model unavailable', 'model-unavailable');
        if (request.controls && Object.keys(request.controls).length)
            throw new ModelRuntimeFailure('Local model control unsupported', 'unsupported-capability');
        if (request.signal?.aborted) throw cancelled();
        const generation = this.generation;
        const signal = AbortSignal.any([request.signal ?? new AbortController().signal, AbortSignal.timeout(this.timeoutMs)]);
        let response: Response;
        try {
            response = await this.fetch(`${this.endpoint}/chat/completions`, {
                method: 'POST', headers: { ...this.headers(), 'Content-Type': 'application/json' }, signal,
                body: JSON.stringify({ model: request.modelId, messages: request.messages, stream: true,
                    stream_options: { include_usage: true } }),
            });
        } catch { throw signal.aborted ? cancelled() :
            new ModelRuntimeFailure('Local connection failed', 'transient-transport'); }
        if (!response.ok) throw failure('Local', response.status);
        if (!response.body) throw new ModelRuntimeFailure('Local stream unavailable', 'invalid-json');
        let buffer = '';
        let output = '';
        let usage: ConversationUsage = { tokenMeasurement: 'unavailable' };
        let finishReason: string | undefined;
        let done = false;
        const decoder = new TextDecoder();
        try {
            for await (const chunk of response.body) {
                if (signal.aborted) throw cancelled();
                if (generation !== this.generation) throw new ModelRuntimeFailure('Local connection changed', 'connection-unavailable');
                buffer += decoder.decode(chunk, { stream: true });
                buffer = buffer.replaceAll('\r\n', '\n');
                let boundary: number;
                while ((boundary = buffer.indexOf('\n\n')) >= 0) {
                    const frame = buffer.slice(0, boundary).replaceAll('\r', '');
                    buffer = buffer.slice(boundary + 2);
                    const data = frame.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
                    if (!data) continue;
                    if (data === '[DONE]') { done = true; break; }
                    let event: any;
                    try { event = JSON.parse(data); } catch { throw new ModelRuntimeFailure('Invalid local stream event', 'invalid-json'); }
                    if (event?.error) throw new ModelRuntimeFailure('Local generation failed', 'nonretryable-provider');
                    const delta = event?.choices?.[0]?.delta?.content;
                    if (delta !== undefined && typeof delta !== 'string')
                        throw new ModelRuntimeFailure('Invalid local stream event', 'invalid-json');
                    if (delta) { output += delta; yield { type: 'delta', text: delta }; }
                    if (typeof event?.choices?.[0]?.finish_reason === 'string') finishReason = event.choices[0].finish_reason;
                    const reported = event?.usage;
                    if (reported) {
                        const inputTokens = count(reported.prompt_tokens);
                        const outputTokens = count(reported.completion_tokens);
                        const totalTokens = count(reported.total_tokens);
                        usage = { ...(inputTokens === undefined ? {} : { inputTokens }),
                            ...(outputTokens === undefined ? {} : { outputTokens }),
                            ...(totalTokens === undefined ? {} : { totalTokens }),
                            tokenMeasurement: inputTokens !== undefined || outputTokens !== undefined || totalTokens !== undefined
                                ? 'provider-reported' : 'unavailable' };
                    }
                }
                if (done) break;
            }
        } catch (error) {
            if (error instanceof ModelRuntimeFailure) throw error;
            throw signal.aborted ? cancelled() : new ModelRuntimeFailure('Local stream failed', 'transient-transport');
        }
        if (signal.aborted) throw cancelled();
        if (generation !== this.generation) throw new ModelRuntimeFailure('Local connection changed', 'connection-unavailable');
        if (!done) throw new ModelRuntimeFailure('Local stream ended early', 'transient-transport');
        yield { type: 'complete', text: output, usage, ...(finishReason ? { finishReason } : {}) };
    }
}

export class GeminiConversationalProvider implements ConversationalModelRuntime {
    private readonly client: GoogleGenAI;
    private readonly timeoutMs: number;
    private models: string[] = [];
    private generation = 0;
    constructor(options: { apiKey: string; timeoutMs?: number; fetch?: typeof globalThis.fetch }) {
        if (typeof options.apiKey !== 'string' || !options.apiKey.trim() || /\s/.test(options.apiKey))
            throw new Error('Invalid Gemini API key');
        if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1))
            throw new Error('Invalid Gemini timeout');
        this.timeoutMs = options.timeoutMs ?? TIMEOUT_MS;
        this.client = new GoogleGenAI({ apiKey: options.apiKey,
            ...(options.fetch ? { httpOptions: { fetch: options.fetch } } : {}) });
    }
    async discoverModels(): Promise<ConnectedModel[]> {
        const generation = ++this.generation;
        this.models = [];
        try {
            const ids = await discoverGeminiModels(this.client, this.timeoutMs);
            if (generation !== this.generation) return [];
            this.models = ids;
            return ids.map(model);
        } catch (error) { throw sanitized(error, false, 'model discovery'); }
    }
    async *generateConversation(request: ConversationRequest): AsyncIterable<ConversationEvent> {
        if (!this.models.includes(request.modelId)) throw new ModelRuntimeFailure('Selected Gemini model unavailable', 'model-unavailable');
        if (request.controls && Object.keys(request.controls).length)
            throw new ModelRuntimeFailure('Gemini model control unsupported', 'unsupported-capability');
        if (request.signal?.aborted) throw cancelled();
        const generation = this.generation;
        const signal = AbortSignal.any([request.signal ?? new AbortController().signal, AbortSignal.timeout(this.timeoutMs)]);
        const systemInstruction = request.messages.filter(message => message.role === 'system').map(message => message.content).join('\n\n');
        const contents = request.messages.filter(message => message.role !== 'system').map(message => ({
            role: message.role === 'assistant' ? 'model' : 'user', parts: [{ text: message.content }] }));
        let output = '';
        let usage: ConversationUsage = { tokenMeasurement: 'unavailable' };
        let finishReason: string | undefined;
        try {
            const stream = await this.client.models.generateContentStream({ model: request.modelId, contents,
                config: { ...(systemInstruction ? { systemInstruction } : {}), abortSignal: signal } });
            for await (const chunk of stream) {
                if (signal.aborted) throw cancelled();
                if (generation !== this.generation) throw new ModelRuntimeFailure('Gemini connection changed', 'connection-unavailable');
                const delta = chunk.text;
                if (delta) { output += delta; yield { type: 'delta', text: delta }; }
                if (chunk.candidates?.[0]?.finishReason) finishReason = chunk.candidates[0].finishReason;
                if (chunk.usageMetadata) {
                    const inputTokens = count(chunk.usageMetadata.promptTokenCount);
                    const outputTokens = count(chunk.usageMetadata.candidatesTokenCount);
                    const totalTokens = count(chunk.usageMetadata.totalTokenCount);
                    usage = { ...(inputTokens === undefined ? {} : { inputTokens }),
                        ...(outputTokens === undefined ? {} : { outputTokens }),
                        ...(totalTokens === undefined ? {} : { totalTokens }),
                        tokenMeasurement: inputTokens !== undefined || outputTokens !== undefined || totalTokens !== undefined
                            ? 'provider-reported' : 'unavailable' };
                }
            }
        } catch (error) {
            if (error instanceof ModelRuntimeFailure) throw error;
            throw sanitized(error, signal.aborted, 'conversation');
        }
        if (signal.aborted) throw cancelled();
        if (generation !== this.generation) throw new ModelRuntimeFailure('Gemini connection changed', 'connection-unavailable');
        yield { type: 'complete', text: output, usage, ...(finishReason ? { finishReason } : {}) };
    }
}
