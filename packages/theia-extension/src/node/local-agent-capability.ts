import { randomUUID } from 'node:crypto';
import type { AIConnection } from '@dope/ai';
import type { AIInventoryState } from '@dope/contracts/lib/ai-registry-service';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import { preflightLocalToolSandbox } from '@dope/agent-core/lib/node/local-tool-sandbox';
import { LocalContextBudget } from './local-context-budget';
import { LocalToolTurnTransport } from './local-tool-turn';
import type { LocalTurnMessage } from './local-tool-turn';

export type LocalCapabilityResult = 'supported' | 'unsupported' | 'unavailable' | 'cancelled' | 'timed-out' | 'failed';

/** No project root or broker is passed to this probe. Its only tool result is synthetic. */
export class LocalAgentCapabilityProbe {
    constructor(private readonly transport: Pick<LocalToolTurnTransport, 'turn'> = new LocalToolTurnTransport(),
        private readonly sandbox = preflightLocalToolSandbox, private readonly timeoutMs = 120_000) {}

    async probe(connection: AIConnection, modelId: string, inventory: () => Promise<AIInventoryState>,
        credential?: string, signal?: AbortSignal): Promise<LocalCapabilityResult> {
        const timeout = AbortSignal.timeout(this.timeoutMs);
        const abort = AbortSignal.any([signal ?? new AbortController().signal, timeout]);
        const bounded = <T>(operation: Promise<T>): Promise<T> => new Promise<T>((resolve, reject) => {
            if (abort.aborted) { reject(abort.reason); return; }
            const cancelled = () => { abort.removeEventListener('abort', cancelled); reject(abort.reason); };
            abort.addEventListener('abort', cancelled, { once: true });
            operation.then(value => { abort.removeEventListener('abort', cancelled); resolve(value); },
                error => { abort.removeEventListener('abort', cancelled); reject(error); });
        });
        try {
            if (abort.aborted) return timeout.aborted ? 'timed-out' : 'cancelled';
            const before = await bounded(inventory());
            const loaded = before.loadedLocalModels?.find(item => item.connectionId === connection.id &&
                item.providerModelKey === modelId);
            if (connection.config.type !== 'local' || connection.config.runtime !== 'lm-studio' ||
                !loaded || !Number.isSafeInteger(loaded.contextWindowTokens) || loaded.contextWindowTokens <= 0)
                return 'unavailable';
            if (!(await bounded(this.sandbox())).available) return 'unavailable';
            if (abort.aborted) return timeout.aborted ? 'timed-out' : 'cancelled';
            const budget = new LocalContextBudget(connection.id, modelId, before);
            const nonce = randomUUID();
            const path = 'dope-synthetic-capability-probe.txt';
            const messages: LocalTurnMessage[] = [
                { role: 'system', content: 'This is a synthetic tool protocol check. Call read on dope-synthetic-capability-probe.txt with maxBytes 128. Then include the exact value returned by the tool in your final answer.' },
                { role: 'user', content: 'Read the synthetic probe file and report its value.' }
            ];
            const common = { connection, modelId, loadedModelIds: [modelId], inventory, budget,
                ...(credential === undefined ? {} : { credential }), signal: abort, timeoutMs: this.timeoutMs,
                maxOutputTokens: 128 };
            const first = await bounded(this.transport.turn({ ...common, messages }));
            if (first.kind !== 'tools' || first.calls.length !== 1) return 'unsupported';
            const call = first.calls[0];
            if (call.name !== 'read' || call.arguments.path !== path) return 'unsupported';
            messages.push({ role: 'assistant', content: '', tool_calls: [{ id: call.id, type: 'function',
                function: { name: call.name, arguments: JSON.stringify(call.arguments) } }] });
            messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ id: call.id,
                name: call.name, status: 'completed', output: nonce, truncated: false }) });
            const second = await bounded(this.transport.turn({ ...common, messages }));
            return second.kind === 'final' && second.text.includes(nonce) ? 'supported' : 'unsupported';
        } catch (error) {
            return timeout.aborted ? 'timed-out' : abort.aborted ? 'cancelled' : error instanceof ModelRuntimeFailure &&
                error.failureClass === 'unsupported-capability' ? 'unsupported' :
                error instanceof ModelRuntimeFailure && /context|capacity|reserve/iu.test(error.message) ?
                    'unavailable' : 'failed';
        }
    }
}
