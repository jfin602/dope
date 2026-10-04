import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ConnectedModel, ConversationEvent, ConversationRequest, ConversationUsage,
    ConversationalModelRuntime } from '@dope/contracts/lib/model-runtime';
import { count } from './provider-transport';

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1';
const DEFAULT_TIMEOUT_MS = 120_000;
const efforts = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'] as const;
type ReasoningEffort = typeof efforts[number];
export interface OpenAIConversationModel {
    id: string;
    /** Declare only values confirmed for this model and account. Omit to expose no reasoning control. */
    reasoningEfforts?: readonly ReasoningEffort[];
}

const failure = (status: number): ModelRuntimeFailure => {
    if (status === 401 || status === 403) return new ModelRuntimeFailure('OpenAI authentication failed', 'authentication');
    if (status === 404) return new ModelRuntimeFailure('OpenAI model or endpoint unavailable', 'model-unavailable');
    if (status === 429) return new ModelRuntimeFailure('OpenAI quota or rate limit exceeded', 'nonretryable-provider');
    if (status >= 500) return new ModelRuntimeFailure('OpenAI service unavailable', 'transient-upstream');
    return new ModelRuntimeFailure(`OpenAI request rejected (HTTP ${status})`, 'nonretryable-provider');
};
const cancelled = () => new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
const malformed = () => new ModelRuntimeFailure('Invalid OpenAI stream event', 'invalid-json');
const streamFailure = (event: any): ModelRuntimeFailure => {
    const code = event?.response?.error?.code ?? event?.error?.code ?? event?.code;
    if (code === 'invalid_api_key') return new ModelRuntimeFailure('OpenAI authentication failed', 'authentication');
    if (code === 'insufficient_quota' || code === 'rate_limit_exceeded')
        return new ModelRuntimeFailure('OpenAI quota or rate limit exceeded', 'nonretryable-provider');
    if (code === 'server_error' || code === 'service_unavailable')
        return new ModelRuntimeFailure('OpenAI service unavailable', 'transient-upstream');
    return new ModelRuntimeFailure('OpenAI generation rejected or incomplete', 'nonretryable-provider');
};

/** A connection-scoped Responses adapter. Dope supplies every turn; provider response IDs are not conversation state. */
export class OpenAIConversationalProvider implements ConversationalModelRuntime {
    private readonly endpoint: string;
    private readonly timeoutMs: number;
    private readonly fetch: typeof globalThis.fetch;
    private readonly models: ReadonlyMap<string, ConnectedModel>;
    constructor(private readonly options: { apiKey: string; models: readonly OpenAIConversationModel[];
        endpoint?: string; timeoutMs?: number; fetch?: typeof globalThis.fetch }) {
        if (typeof options.apiKey !== 'string' || !options.apiKey.trim() || /\s/.test(options.apiKey))
            throw new Error('Invalid OpenAI API key');
        if (options.timeoutMs !== undefined && (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1))
            throw new Error('Invalid OpenAI timeout');
        let url: URL;
        try { url = new URL(options.endpoint ?? DEFAULT_ENDPOINT); }
        catch { throw new Error('Invalid OpenAI endpoint'); }
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
            !['/', '/v1', '/v1/'].includes(url.pathname)) throw new Error('Invalid OpenAI endpoint');
        this.endpoint = `${url.origin}/v1`;
        this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
        this.fetch = options.fetch ?? globalThis.fetch;
        if (!Array.isArray(options.models) || !options.models.length) throw new Error('OpenAI models must be configured');
        const models = options.models.map(({ id, reasoningEfforts }) => {
            if (typeof id !== 'string' || !id.trim() || reasoningEfforts &&
                (!Array.isArray(reasoningEfforts) || !reasoningEfforts.length ||
                    reasoningEfforts.some(value => !efforts.includes(value)))) throw new Error('Invalid OpenAI model configuration');
            return { id, label: id, capabilities: { conversationalText: true, streaming: true,
                ...(reasoningEfforts ? { reasoningControls: [{ id: 'reasoning.effort', values: [...reasoningEfforts] }] } : {}) } };
        });
        if (new Set(models.map(model => model.id)).size !== models.length) throw new Error('Duplicate OpenAI model ID');
        this.models = new Map(models.map(model => [model.id, model]));
    }
    async discoverModels(): Promise<ConnectedModel[]> { return [...this.models.values()]; }

    async *generateConversation(request: ConversationRequest): AsyncIterable<ConversationEvent> {
        const selected = this.models.get(request.modelId);
        if (!selected) throw new ModelRuntimeFailure('Selected OpenAI model unavailable', 'model-unavailable');
        for (const [id, value] of Object.entries(request.controls ?? {})) {
            if (!selected.capabilities.reasoningControls?.some(control => control.id === id && control.values.includes(value)))
                throw new ModelRuntimeFailure('OpenAI model control unsupported', 'unsupported-capability');
        }
        if (request.signal?.aborted) throw cancelled();
        const signal = AbortSignal.any([request.signal ?? new AbortController().signal,
            AbortSignal.timeout(this.timeoutMs)]);
        let response: Response;
        try {
            response = await this.fetch(`${this.endpoint}/responses`, {
                method: 'POST', signal,
                headers: { Authorization: `Bearer ${this.options.apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: request.modelId, input: request.messages, stream: true,
                    store: false, truncation: 'disabled',
                    ...(request.maxOutputTokens ? { max_output_tokens: request.maxOutputTokens } : {}),
                    ...(request.controls?.['reasoning.effort'] ?
                        { reasoning: { effort: request.controls['reasoning.effort'] } } : {}) }),
            });
        } catch { throw request.signal?.aborted ? cancelled() :
            new ModelRuntimeFailure('OpenAI connection failed or timed out', 'transient-transport'); }
        if (!response.ok) throw failure(response.status);
        if (!response.body) throw malformed();

        let buffer = '';
        let output = '';
        let completed = false;
        let usage: ConversationUsage = { tokenMeasurement: 'unavailable' };
        let finishReason: string | undefined;
        let actualModelId: string | undefined;
        const decoder = new TextDecoder();
        try {
            for await (const chunk of response.body) {
                if (signal.aborted) throw request.signal?.aborted ? cancelled() :
                    new ModelRuntimeFailure('OpenAI connection timed out', 'transient-transport');
                buffer += decoder.decode(chunk, { stream: true });
                buffer = buffer.replaceAll('\r\n', '\n');
                let boundary: number;
                while ((boundary = buffer.indexOf('\n\n')) >= 0) {
                    const frame = buffer.slice(0, boundary);
                    buffer = buffer.slice(boundary + 2);
                    const data = frame.split('\n').filter(line => line.startsWith('data:'))
                        .map(line => line.slice(5).trimStart()).join('\n');
                    if (!data) continue;
                    if (data === '[DONE]') break;
                    let event: any;
                    try { event = JSON.parse(data); } catch { throw malformed(); }
                    if (!event || typeof event.type !== 'string') throw malformed();
                    if (event.type === 'response.output_text.delta') {
                        if (completed || typeof event.delta !== 'string') throw malformed();
                        if (event.delta) { output += event.delta; yield { type: 'delta', text: event.delta }; }
                    } else if (event.type === 'response.completed') {
                        if (completed || event.response?.status !== 'completed' ||
                            typeof event.response?.model !== 'string' || !event.response.model.trim()) throw malformed();
                        completed = true;
                        actualModelId = event.response.model;
                        const reported = event.response.usage;
                        const inputTokens = count(reported?.input_tokens);
                        const outputTokens = count(reported?.output_tokens);
                        const totalTokens = count(reported?.total_tokens);
                        usage = { ...(inputTokens === undefined ? {} : { inputTokens }),
                            ...(outputTokens === undefined ? {} : { outputTokens }),
                            ...(totalTokens === undefined ? {} : { totalTokens }),
                            tokenMeasurement: inputTokens !== undefined || outputTokens !== undefined || totalTokens !== undefined
                                ? 'provider-reported' : 'unavailable' };
                        finishReason = 'completed';
                    } else if (event.type === 'response.failed' || event.type === 'response.incomplete' ||
                        event.type === 'error' || event.type === 'response.refusal.delta') {
                        throw streamFailure(event);
                    }
                }
                if (buffer.length > 1_000_000) throw malformed();
                if (completed) break;
            }
        } catch (error) {
            if (error instanceof ModelRuntimeFailure) throw error;
            throw request.signal?.aborted ? cancelled() :
                new ModelRuntimeFailure('OpenAI stream failed', 'transient-transport');
        }
        if (request.signal?.aborted) throw cancelled();
        if (!completed) throw new ModelRuntimeFailure('OpenAI stream ended early', 'transient-transport');
        yield { type: 'complete', text: output, usage, finishReason, actualModelId };
    }
}
