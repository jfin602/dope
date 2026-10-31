import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import { createHash } from 'node:crypto';
import type { ConversationEvent, ConversationRequest, ModelSelection } from '@dope/contracts/lib/model-runtime';
import type { PiModelBridge } from './pi-model-bridge';
import type { PiRuntimeFactory } from './pi-runtime-host';

/** One Dope-owned turn, reconstructed from saved Chat context. Pi never owns the transcript. */
export async function* piConversation(selection: ModelSelection, request: Omit<ConversationRequest, 'modelId'>,
    bridge: PiModelBridge, factory: PiRuntimeFactory): AsyncIterable<ConversationEvent> {
    if (request.signal?.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
    let host: ReturnType<PiRuntimeFactory['create']> | undefined;
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
            request.projectTools ? { chatTools: true } : {});
        if (request.signal?.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
        const maxOutputTokens = request.maxOutputTokens ?? Math.min(1024, binding.maxOutputTokens);
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
            const output = await request.projectTools!.execute(call.name, call.arguments, request.signal);
            return { status: 'completed', output };
        } : undefined;
        for await (const event of host.streamTurn(request.messages, maxOutputTokens, request.signal, onTool)) {
            if (event.type === 'delta' || event.type === 'activity') { yield event; continue; }
            if (event.modelId !== selection.modelId)
                throw new ModelRuntimeFailure('Local server answered with a different model; reselect the loaded model in AI Center',
                    'model-unavailable');
            if (event.finishReason !== 'stop')
                throw new ModelRuntimeFailure('Local answer reached its output limit; shorten the request or use a larger model',
                    'incomplete-answer');
            yield { type: 'complete', text: event.text, usage: event.usage,
                ...(event.compaction ? { compaction: { canonicalContextSha256:
                    createHash('sha256').update(JSON.stringify(request.messages)).digest('hex'),
                    ...event.compaction } } : {}),
                finishReason: event.finishReason, actualModelId: event.modelId };
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
        if (host) factory.release(host);
    }
}
