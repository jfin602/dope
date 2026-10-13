import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ConversationMessage } from '@dope/contracts/lib/model-runtime';

const TOTAL_PROFILE = 4096;
const SYSTEM_RESERVE = 512;
const SAFETY_RESERVE = 256;
const MAX_ATTEMPTS = 2;

const fail = (message: string): never => { throw new ModelRuntimeFailure(message, 'invalid-json'); };

/** The loaded local context is observed by model discovery, never inferred from a model name. */
export function roadmapLocalBudget(measuredContext: number | undefined, requestedOutput: number) {
    if (!Number.isSafeInteger(measuredContext) || !measuredContext || measuredContext < 1024)
        throw new ModelRuntimeFailure('Local planning needs a measured loaded context capacity', 'unsupported-capability');
    const total = Math.min(measuredContext, TOTAL_PROFILE);
    const output = Math.min(Math.max(requestedOutput, 256), 512);
    const inputBytes = total - output - SYSTEM_RESERVE - SAFETY_RESERVE;
    if (inputBytes < 512)
        throw new ModelRuntimeFailure('Local planning context is too small', 'unsupported-capability');
    // Composer estimates UTF-8 bytes / 3. This lower cap makes its result fit even
    // when each byte is a separate token; the final serialized request is checked too.
    return { total, output, inputBytes, composerInputTokens: Math.floor(inputBytes / 3) };
}

export function verifyRoadmapLocalInput(messages: readonly ConversationMessage[],
    budget: ReturnType<typeof roadmapLocalBudget>): void {
    const bytes = messages.reduce((sum, item) => sum + Buffer.byteLength(item.content, 'utf8') + 32, 0);
    if (bytes > budget.inputBytes || bytes + budget.output + SYSTEM_RESERVE + SAFETY_RESERVE > budget.total)
        throw new ModelRuntimeFailure('Local planning context exceeds the measured budget; reduce the request',
            'unsupported-capability');
}

/** Completed output is buffered so invalid attempts cannot become actionable Chat text. */
export async function localPlanningJson<T extends { type: string; text: string; finishReason?: string }>(
    generate: () => AsyncIterable<T>, signal: AbortSignal, maxOutputBytes = 512,
    mode: 'linked' | 'unlinked' | 'draft' = 'unlinked', eligibleObjective = true): Promise<T> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (signal.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
        let complete: T | undefined;
        let streamedBytes = 0;
        for await (const event of generate()) {
            if (signal.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
            if (event.type === 'delta') {
                streamedBytes += Buffer.byteLength(event.text, 'utf8');
                if (streamedBytes > maxOutputBytes) fail('Local planning output exceeds the reserved size');
            } else if (event.type === 'complete') complete = event;
        }
        if (!complete) throw new ModelRuntimeFailure('Local planning stream ended without completion', 'invalid-json');
        try {
            if (complete.finishReason && !['stop', 'eos', 'end_turn'].includes(complete.finishReason))
                throw new Error('unfinished');
            if (Buffer.byteLength(complete.text, 'utf8') > maxOutputBytes) throw new Error('oversized');
            const value: unknown = JSON.parse(complete.text);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required');
            const raw = value as Record<string, unknown>;
            const proposal = (raw.type === 'roadmap-proposal' && mode === 'unlinked' &&
                Object.keys(raw).sort().join(',') === 'action,ownerRevision,projectId,type' &&
                Number.isSafeInteger(raw.ownerRevision) || raw.type === 'roadmap-draft-proposal' && mode === 'draft' &&
                Object.keys(raw).sort().join(',') === 'action,draftRevision,projectId,type' &&
                Number.isSafeInteger(raw.draftRevision)) &&
                typeof raw.projectId === 'string' &&
                validNestedAction(raw.action, mode);
            const intent = mode === 'linked' && eligibleObjective && raw.type === 'roadmap-intent' &&
                Object.keys(raw).sort().join(',') === 'intent,type,value' && raw.intent === 'set-objective' &&
                typeof raw.value === 'string' && raw.value.length <= 8192 && !/[\r\n\0]/.test(raw.value);
            const noAction = raw.type === 'no-action' && Object.keys(raw).sort().join(',') === 'message,type' &&
                typeof raw.message === 'string' && raw.message.length <= 1000;
            if (proposal || intent || noAction) return complete;
        } catch { /* One bounded repair attempt; no mutation or provider switch. */ }
    }
    return fail('Local planning did not return strict JSON after two attempts');
}

function validNestedAction(value: unknown, mode: 'linked' | 'unlinked' | 'draft'): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const action = value as Record<string, unknown>;
    const specs: Record<string, [string[], string[]]> = mode === 'draft' ? {
        'create-phase': [['type', 'title'], ['objective']],
        'create-checkpoint': [['type', 'phaseId', 'title'], ['objective']],
        'edit-phase': [['type', 'phaseId'], ['title', 'objective']],
        'edit-checkpoint': [['type', 'phaseId', 'checkpointId'], ['title', 'objective']],
        'reorder-phase': [['type', 'phaseId', 'order'], []],
        'reorder-checkpoint': [['type', 'phaseId', 'checkpointId', 'order'], []]
    } : {
        create: [['type', 'id', 'kind', 'title', 'objective', 'order'], []],
        edit: [['type', 'id'], ['title', 'objective']],
        link: [['type', 'id', 'link'], []], unlink: [['type', 'id', 'link'], []],
        depend: [['type', 'id', 'dependencyId'], []], undepend: [['type', 'id', 'dependencyId'], []],
        reorder: [['type', 'id', 'order'], []], status: [['type', 'id', 'status'], []]
    };
    if (typeof action.type !== 'string' || !Object.hasOwn(specs, action.type)) return false;
    const [required, optional] = specs[action.type];
    if (!required.every(key => Object.hasOwn(action, key)) ||
        !Object.keys(action).every(key => required.includes(key) || optional.includes(key))) return false;
    for (const [key, field] of Object.entries(action)) {
        if (key === 'link') {
            if (!field || typeof field !== 'object' || Array.isArray(field)) return false;
        } else if (key === 'order') {
            if (!Number.isSafeInteger(field) || (field as number) < 0) return false;
        } else if (typeof field !== 'string') return false;
    }
    return true;
}
