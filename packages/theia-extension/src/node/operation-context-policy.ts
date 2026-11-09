import type { ConversationModelCapabilities } from '@dope/contracts/lib/model-runtime';

/** Supplied only by the backend after its command/skill identity checks. Never parse request prose here. */
export type TrustedChatOperation = 'chat' | 'investigation' | 'docs-review' |
    'prompt-ass' | 'prompt-plan' | 'prompt-write' | 'phase-roadmap' | 'roadmap-edit';
export type ContextLimitMode = 'managed' | 'unmanaged';

export function trustedOperationForTurn(dispatch: { promptStage?: 'prompt-ass' | 'prompt-plan' | 'prompt-write';
    docsReview: boolean; roadmapEdit: boolean; investigation: boolean }): TrustedChatOperation {
    if (dispatch.promptStage) return dispatch.promptStage;
    if (dispatch.docsReview) return 'docs-review';
    if (dispatch.roadmapEdit) return 'roadmap-edit';
    return dispatch.investigation ? 'investigation' : 'chat';
}

export interface OperationContextPolicy {
    schemaVersion: 1;
    mode: ContextLimitMode;
    operation: TrustedChatOperation;
    model: { contextWindowTokens?: number; maxInputTokens?: number; maxOutputTokens?: number;
        reasoningSupported: boolean; reasoningEnabled: boolean };
    /** Null means no Dope discretionary quota. Provider capacity and broker safety checks still apply. */
    discretionary: null | { inputCompositionTokens: number; modelOutputTokens: number;
        toolResultPageBytes: number; toolResultPayloadBytes: number;
        run: { modelCalls: number; toolCalls: number; generationTokens: number } };
}

// One owner for Managed candidates. These are policy starting values, not benchmarked model recommendations.
const presets: Record<TrustedChatOperation, { input: number; output: number; page: number;
    payload: number; calls: number; tools: number; generation: number }> = {
    chat: { input: 4096, output: 2048, page: 4096, payload: 8192, calls: 4, tools: 12, generation: 8192 },
    investigation: { input: 6144, output: 3072, page: 8192, payload: 16384, calls: 12, tools: 48, generation: 24576 },
    'docs-review': { input: 8192, output: 4096, page: 8192, payload: 24576, calls: 24, tools: 96, generation: 49152 },
    'prompt-ass': { input: 8192, output: 4096, page: 8192, payload: 24576, calls: 32, tools: 128, generation: 65536 },
    'prompt-plan': { input: 8192, output: 6144, page: 8192, payload: 24576, calls: 24, tools: 96, generation: 65536 },
    'prompt-write': { input: 8192, output: 6144, page: 8192, payload: 32768, calls: 48, tools: 192, generation: 131072 },
    'phase-roadmap': { input: 8192, output: 4096, page: 8192, payload: 16384, calls: 32, tools: 128, generation: 65536 },
    'roadmap-edit': { input: 6144, output: 4096, page: 8192, payload: 16384, calls: 16, tools: 64, generation: 32768 }
};

function capacity(value: number | undefined): number | undefined {
    return Number.isSafeInteger(value) && value! > 0 ? value : undefined;
}

export function resolveOperationContextPolicy(mode: ContextLimitMode, operation: TrustedChatOperation,
    capabilities: ConversationModelCapabilities, controls: Readonly<Record<string, string>> = {}): OperationContextPolicy {
    const contextWindowTokens = capacity(capabilities.contextWindowTokens);
    const maxInputTokens = capacity(capabilities.maxInputTokens);
    const maxOutputTokens = capacity(capabilities.maxOutputTokens);
    const reasoningSupported = !!capabilities.localReasoning ||
        !!capabilities.reasoningControls?.some(control => control.id === 'reasoning.effort');
    const reasoningEnabled = reasoningSupported &&
        (controls['reasoning.effort'] ?? capabilities.localReasoning?.default ?? 'auto') !== 'off';
    const model = { contextWindowTokens, maxInputTokens, maxOutputTokens, reasoningSupported, reasoningEnabled };
    if (mode === 'unmanaged') return { schemaVersion: 1, mode, operation, model, discretionary: null };
    const preset = presets[operation];
    if (!preset) throw new Error('Unknown trusted Chat operation');
    // Leave space for system instructions, tool schemas and the current message. Reasoning needs more
    // generation headroom; neither estimate replaces the provider's own capacity checks.
    const headroom = reasoningEnabled ? 2048 : 1024;
    if (contextWindowTokens !== undefined && contextWindowTokens <= headroom + 1)
        throw new Error('Loaded model context cannot fit the managed operation and safety headroom');
    const output = Math.max(1, Math.min(preset.output, maxOutputTokens ?? Infinity,
        contextWindowTokens === undefined ? Infinity : Math.max(1, contextWindowTokens - headroom - 1)));
    const input = Math.max(0, Math.min(preset.input, maxInputTokens ?? Infinity,
        contextWindowTokens === undefined ? Infinity : Math.max(0, contextWindowTokens - output - headroom)));
    return { schemaVersion: 1, mode, operation, model, discretionary: {
        inputCompositionTokens: input, modelOutputTokens: output,
        toolResultPageBytes: preset.page, toolResultPayloadBytes: preset.payload,
        run: { modelCalls: preset.calls, toolCalls: preset.tools, generationTokens: preset.generation }
    } };
}
