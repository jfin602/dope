import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import { createHash } from 'node:crypto';
import type { ConversationContinuation, ConversationEvent, ConversationRequest, ModelSelection } from '@dope/contracts/lib/model-runtime';
import type { PiModelBridge } from './pi-model-bridge';
import type { PiRuntimeFactory, PiRuntimeHost, PiTurnResult } from './pi-runtime-host';

type ToolHandler = (call: { id: number; name: string; arguments: unknown }) => Promise<unknown>;
const MAX_AGGREGATE_BYTES = 65536;

/** The only owner of a paused worker. A decision consumes its current segment exactly once. */
export class PiConversationLease implements ConversationContinuation {
    private state: 'paused' | 'running' | 'closed' = 'paused';
    private timer?: NodeJS.Timeout;
    private expired = false;
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
            throw new ModelRuntimeFailure('Local Pi continuation changed model or answer', 'incomplete-answer');
        this.result = result;
    }

    resume(): AsyncIterable<ConversationEvent> {
        if (this.expired)
            throw new ModelRuntimeFailure('Pi continuation expired', 'connection-unavailable');
        if (this.state !== 'paused' || this.signal?.aborted)
            throw new ModelRuntimeFailure('Pi continuation unavailable or stale', 'incomplete-answer');
        this.state = 'running';
        this.clear();
        this.arm(900_000);
        return this.run();
    }

    private async *run(): AsyncIterable<ConversationEvent> {
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
            throw new ModelRuntimeFailure('Local Pi continuation failed or expired', 'connection-unavailable');
        } finally {
            if (this.state === 'running') this.dispose();
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
            throw new ModelRuntimeFailure('Pi continuation expired', 'connection-unavailable');
        if (this.state !== 'paused' || this.signal?.aborted)
            throw new ModelRuntimeFailure('Pi continuation unavailable or stale', 'incomplete-answer');
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
        catch {
            throw new ModelRuntimeFailure('Bundled Pi worker unavailable; restart or reinstall Dope, then retry',
                'connection-unavailable');
        }
        const binding = await bridge.bind(selection, host, request.projectTools?.root ?? process.cwd(),
            { ...(request.projectTools ? { chatTools: true,
                ...(request.projectTools.roadmapTools ? { roadmapTools: true } : {}),
                ...(request.projectTools.roadmapGeneration ? { roadmapGeneration: true } : {}),
                ...(request.projectTools.proposalTools ? { proposalTools: true } : {}) } : {}),
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
            const output = await request.projectTools!.execute(call.name, call.arguments, request.signal, call.id);
            return { status: 'completed', output };
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
