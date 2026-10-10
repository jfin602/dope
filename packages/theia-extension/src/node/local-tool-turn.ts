import type { AIConnection } from '@dope/ai';
import type { AIInventoryState } from '@dope/contracts/lib/ai-registry-service';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import { LOCAL_TOOL_LIMITS, parseLocalToolRequests } from '@dope/agent-core/lib/node/local-tool-contracts';
import type { LocalToolRequest } from '@dope/agent-core/lib/node/local-tool-contracts';
import { providerSetup } from './provider-setup';
import { LocalContextBudget } from './local-context-budget';

const MAX_RESPONSE_BYTES = 131_072;
const MAX_TEXT_BYTES = 32_768;
const MAX_INPUT_BYTES = 131_072;
const MAX_OUTPUT_TOKENS = 1024;
const MAX_TIMEOUT_MS = 120_000;

export type LocalToolTurn =
    | { kind: 'final'; text: string }
    | { kind: 'tools'; calls: readonly LocalToolRequest[] };

export interface LocalToolTurnRequest {
    connection: AIConnection;
    credential?: string;
    modelId: string;
    loadedModelIds: readonly string[];
    budget: LocalContextBudget;
    inventory: () => Promise<AIInventoryState>;
    messages: readonly { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string }[];
    signal?: AbortSignal;
    timeoutMs?: number;
    maxOutputTokens?: number;
}

const parameters = {
    read: { type: 'object', additionalProperties: false, required: ['path', 'maxBytes'], properties: {
        path: { type: 'string' }, maxBytes: { type: 'integer', minimum: 1, maximum: LOCAL_TOOL_LIMITS.readBytes } } },
    list: { type: 'object', additionalProperties: false, required: ['path', 'maxEntries'], properties: {
        path: { type: 'string' }, maxEntries: { type: 'integer', minimum: 1, maximum: LOCAL_TOOL_LIMITS.listEntries } } },
    edit: { type: 'object', additionalProperties: false, required: ['operation', 'path', 'content'], properties: {
        operation: { type: 'string', enum: ['create', 'modify'] }, path: { type: 'string' }, content: { type: 'string' } } },
    process: { type: 'object', additionalProperties: false, required: ['kind', 'commandId'], properties: {
        kind: { type: 'string', enum: ['test', 'build'] }, commandId: { type: 'string' } } },
} as const;
const tools = Object.entries(parameters).map(([name, schema]) => ({ type: 'function', function: {
    name, description: `Request the bounded ${name} operation; Dope checks authority independently.`, parameters: schema } }));

function failure(message: string, kind: ConstructorParameters<typeof ModelRuntimeFailure>[1]): ModelRuntimeFailure {
    return new ModelRuntimeFailure(message, kind);
}

/** Transport only: no tool broker, workspace, or authoritative repository effects. */
export class LocalToolTurnTransport {
    constructor(private readonly fetcher: typeof globalThis.fetch = globalThis.fetch) {}

    async turn(request: LocalToolTurnRequest): Promise<LocalToolTurn> {
        let endpoint: string;
        try {
            providerSetup(request.connection);
            const config = request.connection.config;
            if (config.type !== 'local' || config.runtime !== 'lm-studio') throw new Error();
            const url = new URL(config.endpoint);
            if (url.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
                !['/', '/v1', '/v1/'].includes(url.pathname) || url.username || url.password || url.search || url.hash)
                throw new Error();
            endpoint = `${url.origin}/v1/chat/completions`;
        } catch { throw failure('Local LM Studio endpoint is misconfigured', 'connection-unavailable'); }
        if (!request.modelId?.trim() || !request.loadedModelIds.includes(request.modelId))
            throw failure('Selected local model is not loaded', 'model-unavailable');
        if (request.credential !== undefined && (!request.credential || /[\r\n]/u.test(request.credential)))
            throw failure('Invalid Local credential', 'connection-unavailable');
        const timeoutMs = request.timeoutMs ?? 30_000;
        const maxOutputTokens = request.maxOutputTokens ?? request.budget?.maxOutputTokens;
        if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS ||
            !Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > MAX_OUTPUT_TOKENS)
            throw failure('Invalid Local turn limits', 'nonretryable-provider');
        if (!Array.isArray(request.messages) || request.messages.length < 1 ||
            !request.messages.every(item => ['system', 'user', 'assistant', 'tool'].includes(item.role) &&
                typeof item.content === 'string' && (!item.tool_call_id || typeof item.tool_call_id === 'string')))
            throw failure('Invalid Local turn messages', 'nonretryable-provider');
        if (!(request.budget instanceof LocalContextBudget) || typeof request.inventory !== 'function')
            throw failure('Local context budget unavailable', 'nonretryable-provider');
        if (maxOutputTokens > request.budget.maxOutputTokens)
            throw failure('Local output reserve exceeded', 'nonretryable-provider');
        const body = JSON.stringify({ model: request.modelId, messages: request.messages, tools,
            tool_choice: 'auto', stream: false, temperature: 0, max_tokens: maxOutputTokens });
        if (Buffer.byteLength(body) > MAX_INPUT_BYTES) throw failure('Local turn input too large', 'nonretryable-provider');
        request.budget.prepareTurn(await request.inventory(), request.messages, 0, Buffer.byteLength(body));
        const signal = AbortSignal.any([request.signal ?? new AbortController().signal, AbortSignal.timeout(timeoutMs)]);
        if (signal.aborted) throw failure('Local turn cancelled or timed out', 'cancelled');
        let response: Response;
        try {
            response = await this.fetcher(endpoint, { method: 'POST', redirect: 'error', signal,
                headers: { 'Content-Type': 'application/json', ...(request.credential ? { Authorization: `Bearer ${request.credential}` } : {}) }, body });
        } catch { throw failure(signal.aborted ? 'Local turn cancelled or timed out' : 'Local runtime unavailable',
            signal.aborted ? 'cancelled' : 'transient-transport'); }
        if (!response.ok) {
            await response.body?.cancel().catch(() => {});
            if (response.status === 400 || response.status === 422)
                throw failure('Local runtime does not support the declared tool-call request', 'unsupported-capability');
            throw failure(response.status >= 500 ? 'Local runtime unavailable' : 'Local turn rejected',
                response.status >= 500 ? 'transient-upstream' : 'nonretryable-provider');
        }
        let bytes = 0;
        const chunks: Uint8Array[] = [];
        try {
            if (!response.body) throw new Error();
            for await (const chunk of response.body) {
                if (signal.aborted) throw failure('Local turn cancelled or timed out', 'cancelled');
                bytes += chunk.byteLength;
                if (bytes > MAX_RESPONSE_BYTES) throw failure('Local turn output too large', 'invalid-json');
                chunks.push(chunk);
            }
        } catch (error) {
            await response.body?.cancel().catch(() => {});
            if (error instanceof ModelRuntimeFailure) throw error;
            throw failure(signal.aborted ? 'Local turn cancelled or timed out' : 'Local response unavailable',
                signal.aborted ? 'cancelled' : 'transient-transport');
        }
        if (signal.aborted) throw failure('Local turn cancelled or timed out', 'cancelled');
        let data: any;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { throw failure('Invalid Local turn JSON', 'invalid-json'); }
        if (data?.error) throw failure('Local runtime rejected generation', 'nonretryable-provider');
        if (data?.model !== undefined && data.model !== request.modelId)
            throw failure('Local runtime changed the selected model', 'model-unavailable');
        if (!Array.isArray(data?.choices) || data.choices.length !== 1 || data.choices[0]?.message?.role !== 'assistant')
            throw failure('Invalid Local turn envelope', 'invalid-json');
        const choice = data.choices[0];
        const message = choice.message;
        if (message.refusal || message.reasoning || message.reasoning_content)
            throw failure('Unsupported Local assistant response', 'unsupported-capability');
        if (Array.isArray(message.tool_calls) && message.tool_calls.length) {
            if (choice.finish_reason !== 'tool_calls' || (message.content !== null && message.content !== undefined && message.content !== ''))
                throw failure('Ambiguous Local assistant response', 'invalid-json');
            const normalized = message.tool_calls.map((call: any) => {
                if (call?.type !== 'function' || typeof call.id !== 'string' ||
                    typeof call.function?.name !== 'string' || typeof call.function?.arguments !== 'string')
                    throw failure('Invalid Local tool-call envelope', 'invalid-json');
                let args: unknown;
                try { args = JSON.parse(call.function.arguments); }
                catch { throw failure('Invalid Local tool arguments', 'invalid-json'); }
                return { id: call.id, name: call.function.name, arguments: args };
            });
            let calls: readonly LocalToolRequest[];
            try { calls = parseLocalToolRequests(JSON.stringify(normalized)); }
            catch { throw failure('Unsupported or invalid Local tool request', 'unsupported-capability'); }
            request.budget.recordToolCalls(calls.length);
            request.budget.recordOutput(JSON.stringify(calls));
            return { kind: 'tools', calls };
        }
        if (message.tool_calls !== undefined && message.tool_calls !== null || choice.finish_reason === 'tool_calls')
            throw failure('Local runtime returned incompatible tool calls', 'unsupported-capability');
        if (choice.finish_reason !== 'stop' || typeof message.content !== 'string' ||
            Buffer.byteLength(message.content, 'utf8') > MAX_TEXT_BYTES)
            throw failure('Invalid or oversized Local final text', 'invalid-json');
        return { kind: 'final', text: request.budget.recordOutput(message.content, true) };
    }
}
