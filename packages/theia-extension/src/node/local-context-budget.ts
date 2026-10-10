import type { AIInventoryState } from '@dope/contracts/lib/ai-registry-service';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';

const OUTPUT_RESERVE = 512;
const SYSTEM_RESERVE = 512;
const TOOL_RESERVE = 512;
const SAFETY_RESERVE = 256;
const MAX_INPUT_BYTES = 32_768;
const MAX_RESULT_BYTES = 8_192;
const MAX_RESULT_TOTAL_BYTES = 32_768;
const MAX_TURNS = 12;
const MAX_TOOLS = 32;
const MARKER = '\n[Local output truncated by Dope context budget]';

function capacityFailure(message: string): never {
    throw new ModelRuntimeFailure(message, 'nonretryable-provider');
}

function observed(inventory: AIInventoryState, connectionId: string, modelId: string): number {
    const model = inventory.registry.models.find(item => item.connectionId === connectionId &&
        item.providerModelKey === modelId);
    const connection = inventory.registry.connections.find(item => item.id === connectionId);
    const loaded = inventory.loadedLocalModels?.find(item => item.connectionId === connectionId &&
        item.providerModelKey === modelId);
    if (!connection || connection.lifecycle !== 'enabled' || connection.config.type !== 'local' ||
        !model || !model.enabled || model.state !== 'ready' || !loaded)
        throw new ModelRuntimeFailure('Selected local model is not loaded', 'model-unavailable');
    if (!Number.isSafeInteger(loaded.contextWindowTokens) || loaded.contextWindowTokens <= 0)
        capacityFailure('Local loaded context capacity is unknown');
    return loaded.contextWindowTokens;
}

/** Ephemeral adapter budget. UTF-8 bytes are counted as a conservative token upper bound;
 * essential history and tool state are rejected instead of silently shortened. */
export class LocalContextBudget {
    readonly maxOutputTokens = OUTPUT_RESERVE;
    readonly inputBytes: number;
    private readonly capacity: number;
    private readonly revision: number;
    private readonly configuration: string;
    private turns = 0;
    private tools = 0;
    private resultBytes = 0;
    private totalBytes = 0;

    constructor(private readonly connectionId: string, private readonly modelId: string,
        inventory: AIInventoryState) {
        this.capacity = observed(inventory, connectionId, modelId);
        this.revision = inventory.registry.revision;
        this.configuration = JSON.stringify(inventory.registry.connections.find(item => item.id === connectionId)?.config);
        this.inputBytes = Math.min(MAX_INPUT_BYTES, this.capacity - OUTPUT_RESERVE -
            SYSTEM_RESERVE - TOOL_RESERVE - SAFETY_RESERVE);
        if (this.inputBytes < 512) capacityFailure('Local loaded context is insufficient');
    }

    /** Call with fresh AI Center inventory immediately before each model request. */
    prepareTurn(inventory: AIInventoryState, messages: readonly { content: string }[],
        toolCount = 0, wireBytes?: number): void {
        const current = observed(inventory, this.connectionId, this.modelId);
        if (inventory.registry.revision !== this.revision || current !== this.capacity ||
            JSON.stringify(inventory.registry.connections.find(item => item.id === this.connectionId)?.config) !== this.configuration)
            capacityFailure('Local model or loaded context changed');
        if (!Number.isSafeInteger(toolCount) || toolCount < 0 || this.tools + toolCount > MAX_TOOLS ||
            this.turns >= MAX_TURNS) capacityFailure('Local turn or tool limit reached');
        if (!Array.isArray(messages) || messages.some(item => typeof item.content !== 'string'))
            capacityFailure('Invalid Local history');
        const bytes = wireBytes ?? messages.reduce((sum, item) => sum + Buffer.byteLength(item.content, 'utf8') + 64, 0);
        if (!Number.isSafeInteger(bytes) || bytes < 0) capacityFailure('Invalid Local history size');
        if (bytes > this.inputBytes || this.totalBytes + bytes > 131_072)
            capacityFailure('Local context history exceeds budget');
        this.turns++;
        this.tools += toolCount;
        this.totalBytes += bytes;
    }

    recordToolCalls(count: number): void {
        if (!Number.isSafeInteger(count) || count < 0 || this.tools + count > MAX_TOOLS)
            capacityFailure('Local tool limit reached');
        this.tools += count;
    }

    /** Only callers that explicitly mark display output nonessential may request clipping. */
    recordResult(output: string, nonessential = false): string {
        if (typeof output !== 'string') capacityFailure('Invalid Local tool output');
        const available = Math.min(MAX_RESULT_BYTES, MAX_RESULT_TOTAL_BYTES - this.resultBytes,
            131_072 - this.totalBytes);
        const value = this.bound(output, available, nonessential);
        const bytes = Buffer.byteLength(value, 'utf8');
        this.resultBytes += bytes;
        this.totalBytes += bytes;
        return value;
    }

    recordOutput(output: string, nonessential = false): string {
        if (typeof output !== 'string') capacityFailure('Invalid Local model output');
        const value = this.bound(output, Math.min(OUTPUT_RESERVE, 131_072 - this.totalBytes), nonessential);
        this.totalBytes += Buffer.byteLength(value, 'utf8');
        return value;
    }

    private bound(value: string, limit: number, nonessential: boolean): string {
        if (Buffer.byteLength(value, 'utf8') <= limit) return value;
        if (!nonessential || limit <= Buffer.byteLength(MARKER, 'utf8'))
            capacityFailure('Essential Local output exceeds context budget');
        let clipped = Buffer.from(value, 'utf8').subarray(0, limit - Buffer.byteLength(MARKER, 'utf8'));
        while (clipped.length && clipped.toString('utf8').includes('\ufffd')) clipped = clipped.subarray(0, -1);
        return clipped.toString('utf8') + MARKER;
    }
}
