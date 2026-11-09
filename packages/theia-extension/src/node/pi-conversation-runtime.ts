import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import { createHash } from 'node:crypto';
import type { ConversationContinuation, ConversationEvent, ConversationRequest, ModelSelection } from '@dope/contracts/lib/model-runtime';
import type { PiModelBridge } from './pi-model-bridge';
import { PiWorkerFailure, type PiWorkerFailureCode, type PiToolFailureDetail,
    type PiRuntimeFactory, type PiRuntimeHost, type PiTurnResult } from './pi-runtime-host';

type ToolHandler = (call: { id: number; name: string; arguments: unknown }) => Promise<unknown>;
const MAX_AGGREGATE_BYTES = 65536;
export class PiConversationFailure extends ModelRuntimeFailure {
    constructor(message: string, failureClass: ModelRuntimeFailure['failureClass'],
        readonly boundaryCode: PiWorkerFailureCode, readonly toolFailure?: PiToolFailureDetail) {
        super(message, failureClass);
    }
}
export function classifyPiFailure(error: unknown): PiConversationFailure | undefined {
    if (!(error instanceof PiWorkerFailure)) return undefined;
    const failure = (message: string, failureClass: ModelRuntimeFailure['failureClass']) =>
        new PiConversationFailure(message, failureClass, error.code, error.toolFailure);
    switch (error.code) {
        case 'session_init': return failure(
            'Pi session could not open. Restart Dope and retry with the selected Local model.', 'connection-unavailable');
        case 'provider_http': return failure(
            `Local provider returned HTTP ${error.httpStatus ?? 'error'} during generation. Check LM Studio and retry.`,
            'transient-upstream');
        case 'provider_connection': return failure(
            'Local provider connection failed during generation. Check LM Studio and retry.', 'transient-transport');
        case 'tool_protocol': return failure(
            'Pi tool execution or protocol failed. Retry the turn; inspect the saved tool outcomes.',
            'incomplete-answer');
        case 'model_tool_call_invalid': return failure(
            'The local model sent an invalid tool call. Start a new authorized turn with the current source.',
            'incomplete-answer');
        case 'broker_tool_denied': return failure(
            'Project authority denied a tool call. Review the saved tool outcome before retrying.',
            'incomplete-answer');
        case 'broker_tool_failed': return failure(
            'A project tool failed. Review the saved tool outcome before retrying.', 'incomplete-answer');
        case 'tool_reply_invalid':
        case 'tool_reply_unmatched':
        case 'tool_reply_duplicate':
        case 'tool_reply_delivery_failed':
        case 'worker_dispatch_failed':
        case 'session_closed_with_pending_tool':
        case 'tool_protocol_unknown': return failure(
            'Pi tool transport stopped. Review the saved failure stage and start a new authorized turn.',
            'incomplete-answer');
        case 'worker_exit': return failure(
            'Pi worker exited during the turn. Restart Dope and retry.', 'connection-unavailable');
        case 'worker_protocol': return failure(
            'Pi worker protocol failed. Restart Dope and retry.', 'connection-unavailable');
        case 'context_limit': return failure(
            'Pi context budget was exhausted. Shorten the turn or choose a larger loaded model.',
            'unsupported-capability');
        case 'output_limit': return failure(
            'Pi output budget was exhausted. Increase the Chat output limit or shorten the requested answer.',
            'incomplete-answer');
        case 'model_generation': return failure(
            'Local model generation failed. Check the selected model in LM Studio and retry.',
            'nonretryable-provider');
        case 'worker_timeout': return failure(
            'Pi worker stopped responding. Check LM Studio and retry the turn.', 'connection-unavailable');
        case 'resource_limit': return failure(error.toolFailure?.failureOrigin === 'tool_budget' ?
            'Pi tool-call policy budget was reached. The saved tool count identifies the boundary.' :
            error.toolFailure?.failureOrigin === 'model_call_budget' ?
                'Pi model-call policy budget was reached. The saved call origin identifies the boundary.' :
                'Pi worker resource limit was reached. Shorten the turn or reduce tool output, then retry.',
            'unsupported-capability');
        case 'continuation_unavailable': return failure(
            'Pi continuation unavailable or stale. Start a new authorized turn from the saved partial work.',
            'incomplete-answer');
        case 'continuation_expired': return failure(
            'Pi continuation expired. Start a new authorized turn from the saved partial work.',
            'connection-unavailable');
        case 'continuation_result_invalid': return failure(
            'Pi returned an invalid continuation segment. The saved partial work remains incomplete.',
            'incomplete-answer');
        case 'continuation_pi_rejected': return failure(
            'Pi rejected the continuation in the retained session. Review the saved partial work before retrying.',
            'incomplete-answer');
        case 'continuation_model_drift': return failure(
            'The continuation changed the selected model. Start a new authorized turn with the original model.',
            'incomplete-answer');
    }
}

/** The only owner of a paused worker. A decision consumes its current segment exactly once. */
export class PiConversationLease implements ConversationContinuation {
    private state: 'paused' | 'running' | 'closed' = 'paused';
    private timer?: NodeJS.Timeout;
    private expired = false;
    private resumeGeneration = 0;
    private readonly onAbort = () => this.dispose();
    private result: PiTurnResult;

    constructor(private readonly host: PiRuntimeHost, private readonly factory: PiRuntimeFactory,
        private readonly modelId: string, private readonly onTool: ToolHandler | undefined,
        private readonly signal: AbortSignal | undefined, initial: PiTurnResult,
        private readonly idleMs = 120_000) {
        this.result = initial;
        signal?.addEventListener('abort', this.onAbort, { once: true });
        if (signal?.aborted) this.dispose();
        else this.arm();
    }

    private arm(ms = this.idleMs): void {
        this.timer = setTimeout(() => { this.expired = true; this.dispose(); }, ms);
        this.timer.unref?.();
    }

    private clear(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
    }

    private accept(result: PiTurnResult): void {
        if (result.modelId !== this.modelId || result.segmentIndex !== this.result.segmentIndex + 1 ||
            typeof result.novelText !== 'string' || result.text !== this.result.text + result.novelText ||
            Buffer.byteLength(result.text, 'utf8') > MAX_AGGREGATE_BYTES ||
            !Array.isArray(result.usageSegments) || result.usageSegments.length !== result.segmentIndex)
            throw new PiConversationFailure('Pi returned an invalid continuation segment. The saved partial work remains incomplete.',
                'incomplete-answer', 'continuation_result_invalid');
        this.result = result;
    }

    resume(): AsyncIterable<ConversationEvent> {
        if (this.expired)
            throw new PiConversationFailure('Pi continuation expired. Start a new authorized turn from the saved partial work.',
                'connection-unavailable', 'continuation_expired');
        if (this.state !== 'paused' || this.signal?.aborted)
            throw new PiConversationFailure('Pi continuation unavailable or stale. Start a new authorized turn from the saved partial work.',
                'incomplete-answer', 'continuation_unavailable');
        this.state = 'running';
        this.clear();
        this.arm(900_000);
        return this.run(++this.resumeGeneration);
    }

    private async *run(generation: number): AsyncIterable<ConversationEvent> {
        try {
            for await (const event of this.host.resumeTurn(this.result.segmentIndex + 1,
                this.signal, this.onTool)) {
                if (this.state === 'closed' || this.signal?.aborted)
                    throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
                if (event.type === 'delta' || event.type === 'activity' || event.type === 'reset') {
                    yield event; continue;
                }
                this.accept(event.result);
                if (event.type === 'paused') {
                    this.state = 'paused';
                    this.arm();
                    yield this.pausedEvent();
                } else {
                    const result = this.result;
                    this.dispose();
                    yield { type: 'complete', text: result.text, usage: result.usage,
                        segmentUsage: result.segmentUsage, segmentIndex: result.segmentIndex,
                        originalFinishReason: 'length', finishReason: 'stop', actualModelId: result.modelId };
                }
            }
        } catch (error) {
            this.dispose();
            if (this.signal?.aborted)
                throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
            if (error instanceof ModelRuntimeFailure) throw error;
            const classified = classifyPiFailure(error);
            if (classified) throw classified;
            throw new PiConversationFailure('Pi rejected the continuation in the retained session. Review the saved partial work before retrying.',
                'incomplete-answer', 'continuation_pi_rejected');
        } finally {
            // The backend can begin the next segment before closing this paused iterator.
            // Its cleanup must not release the worker now owned by that newer segment.
            if (this.state === 'running' && this.resumeGeneration === generation) this.dispose();
        }
    }

    pausedEvent(): Extract<ConversationEvent, { type: 'paused' }> {
        const result = this.result;
        return { type: 'paused', text: result.text, novelText: result.novelText ?? result.text,
            segmentIndex: result.segmentIndex, usage: result.usage,
            segmentUsage: result.segmentUsage ?? result.usage,
            ...(result.outputCeilingTokens ? { outputCeilingTokens: result.outputCeilingTokens } : {}),
            finishReason: 'length',
            actualModelId: result.modelId, continuation: this };
    }

    async stop(): Promise<Extract<ConversationEvent, { type: 'stopped-incomplete' }>> {
        if (this.expired)
            throw new PiConversationFailure('Pi continuation expired. Start a new authorized turn from the saved partial work.',
                'connection-unavailable', 'continuation_expired');
        if (this.state !== 'paused' || this.signal?.aborted)
            throw new PiConversationFailure('Pi continuation unavailable or stale. Start a new authorized turn from the saved partial work.',
                'incomplete-answer', 'continuation_unavailable');
        this.state = 'running';
        this.clear();
        const result = this.result;
        try {
            await this.host.stopTurn(result.segmentIndex);
            return { type: 'stopped-incomplete', text: result.text, segmentIndex: result.segmentIndex,
                usage: result.usage, originalFinishReason: 'length', finishReason: 'owner-stop',
                actualModelId: result.modelId };
        } finally { this.dispose(); }
    }

    dispose(): void {
        if (this.state === 'closed') return;
        this.state = 'closed';
        this.clear();
        this.signal?.removeEventListener('abort', this.onAbort);
        this.factory.release(this.host);
    }
}

/** One Dope-owned turn, reconstructed from saved Chat context. Pi never owns the transcript. */
export async function* piConversation(selection: ModelSelection, request: Omit<ConversationRequest, 'modelId'>,
    bridge: PiModelBridge, factory: PiRuntimeFactory): AsyncIterable<ConversationEvent> {
    if (request.signal?.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
    let host: ReturnType<PiRuntimeFactory['create']> | undefined;
    let retained = false;
    try {
        try { host = factory.create(); }
        catch {
            throw new ModelRuntimeFailure('Bundled Pi worker unavailable; restart or reinstall Dope, then retry',
                'connection-unavailable');
        }
        try { await host.start(); }
        catch (error) {
            const classified = classifyPiFailure(error);
            if (classified?.message.includes('worker exited')) throw classified;
            throw new ModelRuntimeFailure('Bundled Pi worker unavailable; restart or reinstall Dope, then retry',
                'connection-unavailable');
        }
        const binding = await bridge.bind(selection, host, request.projectTools?.root ?? process.cwd(),
            { ...(request.projectTools ? { chatTools: true,
                ...(request.projectTools.roadmapTools ? { roadmapTools: true } : {}),
                ...(request.projectTools.roadmapGeneration ? { roadmapGeneration: true } : {}),
                ...(request.projectTools.proposalTools ? { proposalTools: true } : {}),
                ...(request.projectTools.assessmentTools ? { assessmentTools: true } : {}) } : {}),
                reasoningMode: request.controls?.['reasoning.effort'] });
        if (request.signal?.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
        const maxOutputTokens = request.maxOutputTokens ?? Math.min(binding.reasoningEnabled ? 2048 : 1024,
            binding.maxOutputTokens);
        if (binding.reasoningEnabled && maxOutputTokens < 2048)
            throw new ModelRuntimeFailure('Reasoning needs at least 2048 output tokens including the final answer; increase the Chat budget or load a larger model',
                'unsupported-capability');
        if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 ||
            maxOutputTokens > binding.maxOutputTokens)
            throw new ModelRuntimeFailure('Selected Local model has insufficient output capacity; load a larger model in AI Center',
                'unsupported-capability');
        const inputBytes = Buffer.byteLength(JSON.stringify(request.messages), 'utf8');
        const immutableBytes = Buffer.byteLength(JSON.stringify(request.messages.filter(item => item.role === 'system')),
            'utf8') + Buffer.byteLength(request.messages.at(-1)?.content ?? '', 'utf8');
        if (!request.messages.length || request.messages.at(-1)?.role !== 'user' ||
            inputBytes > 512 * 1024 || Math.ceil(immutableBytes / 3) + maxOutputTokens + 1024 > binding.contextWindowTokens)
            throw new ModelRuntimeFailure('Local Chat context exceeds the measured model budget; shorten the turn or select a larger model',
                'unsupported-capability');
        if (process.env.DOPE_PI_CHAT_CONTEXT_TRACE === '1') {
            // Qualification trace at the exact Pi handoff; never persist prompt text or credentials.
            console.info('[dope-pi-chat-context]', JSON.stringify({ modelId: selection.modelId,
                messages: request.messages.map(message => ({ role: message.role,
                    bytes: Buffer.byteLength(message.content, 'utf8'),
                    sha256: createHash('sha256').update(message.content).digest('hex') })) }));
        }
        const onTool = request.projectTools ? async (call: { id: number; name: string; arguments: unknown }) => {
            try {
                const output = await request.projectTools!.execute(call.name, call.arguments, request.signal, call.id);
                return { status: 'completed', output };
            } catch (error) {
                if (error instanceof Error && /\bdenied\b/iu.test(error.message))
                    return { status: 'denied', output: '' };
                throw error;
            }
        } : undefined;
        for await (const event of host.streamTurn(request.messages, maxOutputTokens, request.signal, onTool,
            request.projectTools?.generationId)) {
            if (event.type === 'delta' || event.type === 'activity' || event.type === 'reset') {
                yield event; continue;
            }
            const result = event.result;
            if (result.modelId !== selection.modelId)
                throw new ModelRuntimeFailure('Local server answered with a different model; reselect the loaded model in AI Center',
                    'model-unavailable');
            if (event.type === 'paused') {
                if (request.projectTools?.roadmapTools || request.projectTools?.roadmapGeneration)
                    throw new ModelRuntimeFailure('Structured Roadmap generation did not complete', 'incomplete-answer');
                const lease = new PiConversationLease(host, factory, selection.modelId, onTool,
                    request.signal, result);
                retained = true;
                yield lease.pausedEvent();
                return;
            }
            yield { type: 'complete', text: result.text, usage: result.usage,
                ...(result.compaction ? { compaction: { canonicalContextSha256:
                    createHash('sha256').update(JSON.stringify(request.messages)).digest('hex'),
                    ...result.compaction } } : {}),
                finishReason: result.finishReason, actualModelId: result.modelId };
        }
    } catch (error) {
        if (request.signal?.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
        if (error instanceof ModelRuntimeFailure) throw error;
        const classified = classifyPiFailure(error);
        if (classified) throw classified;
        if (error instanceof Error && /cannot be compacted/.test(error.message))
            throw new ModelRuntimeFailure('Local history cannot be compacted safely; shorten the turn or select a larger loaded model',
                'unsupported-capability');
        if (error instanceof Error && /Repeated unchanged project evidence/.test(error.message))
            throw new ModelRuntimeFailure('Local Chat stopped after repeated unchanged project evidence; ask a narrower question or retry',
                'incomplete-answer');
        throw new ModelRuntimeFailure('Local Pi session failed; check the selected model and Local server in AI Center',
            'connection-unavailable');
    } finally {
        if (host && !retained) factory.release(host);
    }
}
