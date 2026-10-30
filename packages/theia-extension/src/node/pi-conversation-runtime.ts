import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
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
        const binding = await bridge.bind(selection, host, process.cwd());
        if (request.signal?.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
        const maxOutputTokens = request.maxOutputTokens ?? Math.min(1024, binding.maxOutputTokens);
        if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 ||
            maxOutputTokens > binding.maxOutputTokens)
            throw new ModelRuntimeFailure('Selected Local model has insufficient output capacity; load a larger model in AI Center',
                'unsupported-capability');
        const inputBytes = Buffer.byteLength(JSON.stringify(request.messages), 'utf8');
        if (!request.messages.length || request.messages.at(-1)?.role !== 'user' ||
            inputBytes > 512 * 1024 || Math.ceil(inputBytes / 3) + maxOutputTokens + 1024 > binding.contextWindowTokens)
            throw new ModelRuntimeFailure('Local Chat context exceeds the measured model budget; shorten the turn or select a larger model',
                'unsupported-capability');
        for await (const event of host.streamTurn(request.messages, maxOutputTokens, request.signal)) {
            if (event.type === 'delta') { yield event; continue; }
            if (event.modelId !== selection.modelId)
                throw new ModelRuntimeFailure('Local server answered with a different model; reselect the loaded model in AI Center',
                    'model-unavailable');
            if (event.finishReason !== 'stop')
                throw new ModelRuntimeFailure('Local answer reached its output limit; shorten the request or use a larger model',
                    'incomplete-answer');
            yield { type: 'complete', text: event.text, usage: event.usage,
                finishReason: event.finishReason, actualModelId: event.modelId };
        }
    } catch (error) {
        if (request.signal?.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
        if (error instanceof ModelRuntimeFailure) throw error;
        throw new ModelRuntimeFailure('Local Pi session failed; check the selected model and Local server in AI Center',
            'connection-unavailable');
    } finally {
        if (host) factory.release(host);
    }
}
