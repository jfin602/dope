import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ConversationMessage, ConversationModelCapabilities } from '@dope/contracts/lib/model-runtime';
import type { StrategicDraftInput } from '@dope/project-intelligence/lib/node/roadmap-greenfield';
import { validGateChatEnvelope } from './roadmap-gate-chat';

const SYSTEM_RESERVE = 512;
const SAFETY_RESERVE = 256;
const MAX_ATTEMPTS = 2;
const MAX_PLANNING_OUTPUT_TOKENS = 4096;
const MAX_PLANNING_JSON_BYTES = 32768;
const EMPTY_NO_ACTION_MESSAGES = new Set(['source-backed answer', 'brief source-backed reason', 'brief reason']);

export class LocalPlanningOutputFailure extends ModelRuntimeFailure {
    constructor(message: string, readonly rawText: string,
        kind: 'invalid-json' | 'incomplete-answer' = 'invalid-json') { super(message, kind); }
}
const fail = (message: string, rawText = '', kind: 'invalid-json' | 'incomplete-answer' = 'invalid-json'): never => {
    throw new LocalPlanningOutputFailure(message, rawText, kind);
};

/** Only current, typed Roadmap context may supply this value; Chat history is not authority. */
export function requestsRoadmapOwnerRevision(question: string): boolean {
    return /\b(?:roadmap\s+)?owner\s+rev(?:ision)?\b/i.test(question);
}

function citesOwnerRevision(answer: string, revision: number): boolean {
    const citations = answer.matchAll(/\b(?:roadmap\s+)?owner\s+rev(?:ision)?\s*(?::|=|is|at)?\s*#?\s*(\d+)\b/gi);
    return [...citations].some(match => Number(match[1]) === revision);
}

export interface LocalPlanningAnswerCheck {
    requiredOwnerRevision?: number;
    maxSteps?: 2 | 3;
    onRetry?: (cause: 'invalid-envelope' | 'missing-owner-revision') => void;
    validateBridge?: (value: Record<string, unknown>) => Promise<boolean>;
}

/** One completed model envelope; a Gate is a proposed requirement with explicit criteria, never a task. */
export function parseStrategicDraft(text: string, finishReason: string | undefined,
    projectId: string, ownerRevision: number): StrategicDraftInput {
    if (finishReason && !['stop', 'eos', 'end_turn'].includes(finishReason))
        throw new LocalPlanningOutputFailure('Strategic draft output was truncated; generate it again', text, 'incomplete-answer');
    if (Buffer.byteLength(text, 'utf8') > 32768)
        throw new LocalPlanningOutputFailure('Strategic draft exceeds the model output byte limit', text);
    let value: unknown;
    try { value = JSON.parse(text); } catch {
        throw new LocalPlanningOutputFailure('Strategic draft is incomplete or invalid JSON', text);
    }
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new LocalPlanningOutputFailure('Strategic draft must be one JSON object', text);
    const raw = value as Record<string, unknown>;
    if (Object.keys(raw).sort().join(',') !== 'ownerRevision,phases,projectId,type' ||
        raw.type !== 'strategic-roadmap-draft' || raw.projectId !== projectId || raw.ownerRevision !== ownerRevision)
        throw new LocalPlanningOutputFailure('Strategic draft targets a stale or foreign Roadmap owner', text);
    const input = { projectId, ownerRevision, phases: raw.phases } as StrategicDraftInput;
    if (!Array.isArray(input.phases) || input.phases.length < 2 || input.phases.length > 32)
        throw new LocalPlanningOutputFailure('Strategic draft needs 2–32 complete phases', text);
    const keys = (value: object) => Object.keys(value).sort().join(',');
    const line = (value: unknown, max: number) => typeof value === 'string' && !!value.trim() &&
        value.length <= max && !/[\r\n\0-\x1f]/.test(value);
    if (!input.phases.every(phase => phase && typeof phase === 'object' &&
        ['checkpoints,objective,title', 'checkpoints,gates,objective,title'].includes(keys(phase)) &&
        line(phase.title, 200) && typeof phase.objective === 'string' && phase.objective.length <= 8192 &&
        Array.isArray(phase.checkpoints) && phase.checkpoints.length <= 16 &&
        phase.checkpoints.every(item => item && keys(item) === 'dependsOn,objective,title' &&
            line(item.title, 200) && typeof item.objective === 'string' &&
            Array.isArray(item.dependsOn) && item.dependsOn.every(value => Number.isSafeInteger(value) && value > 0)) &&
        (phase.gates === undefined || Array.isArray(phase.gates) && phase.gates.length <= 16 &&
            phase.gates.every(gate => gate && keys(gate) === 'criteria,purpose,title' &&
                line(gate.title, 200) && typeof gate.purpose === 'string' &&
                Array.isArray(gate.criteria) && gate.criteria.length <= 16 &&
                gate.criteria.every(criterion => criterion && keys(criterion) === 'expectedResult,title' &&
                    line(criterion.title, 200) && line(criterion.expectedResult, 512))))))
        throw new LocalPlanningOutputFailure('Strategic draft Phase/Gate/Criterion shape is invalid', text);
    return input;
}
/** The loaded local context is observed by model discovery, never inferred from a model name. */
export function roadmapLocalBudget(measuredContext: number | undefined, requestedOutput: number,
    limits: Pick<ConversationModelCapabilities, 'maxInputTokens' | 'maxOutputTokens'> = {}) {
    if (!Number.isSafeInteger(measuredContext) || !measuredContext || measuredContext < 1024)
        throw new ModelRuntimeFailure('Local planning needs a measured loaded context capacity', 'unsupported-capability');
    if (!Number.isSafeInteger(requestedOutput) || requestedOutput < 1 ||
        limits.maxInputTokens !== undefined && (!Number.isSafeInteger(limits.maxInputTokens) || limits.maxInputTokens < 1) ||
        limits.maxOutputTokens !== undefined && (!Number.isSafeInteger(limits.maxOutputTokens) || limits.maxOutputTokens < 1))
        throw new ModelRuntimeFailure('Invalid local planning input or output limit', 'unsupported-capability');
    const total = measuredContext;
    const output = Math.min(requestedOutput, limits.maxOutputTokens ?? Infinity, MAX_PLANNING_OUTPUT_TOKENS);
    // Without an adapter tokenizer, one UTF-8 byte is charged as at least one token.
    // This overestimates typical text but is a safe final check for serialized messages.
    const inputBytes = Math.min(total - output - SYSTEM_RESERVE - SAFETY_RESERVE,
        limits.maxInputTokens ?? Infinity);
    if (inputBytes < 512)
        throw new ModelRuntimeFailure('Local planning context is too small', 'unsupported-capability');
    return { total, output, inputBytes, composerInputTokens: Math.floor(inputBytes / 3),
        maxOutputBytes: Math.min(MAX_PLANNING_JSON_BYTES, output * 4 + 256) };
}

export function verifyRoadmapLocalInput(messages: readonly ConversationMessage[],
    budget: ReturnType<typeof roadmapLocalBudget>): void {
    const bytes = Buffer.byteLength(JSON.stringify(messages), 'utf8');
    if (bytes > budget.inputBytes || bytes + budget.output + SYSTEM_RESERVE + SAFETY_RESERVE > budget.total)
        throw new ModelRuntimeFailure('Local planning context exceeds the measured budget; reduce the request',
            'unsupported-capability');
}

/** Completed output is buffered so invalid attempts cannot become actionable Chat text. */
export async function localPlanningJson<T extends { type: string; text: string; finishReason?: string }>(
    generate: (retryInstruction?: string) => AsyncIterable<T>, signal: AbortSignal, maxOutputBytes = MAX_PLANNING_JSON_BYTES,
    mode: 'linked' | 'unlinked' | 'draft' | 'gate' | 'help' | 'bridge' = 'unlinked', eligibleObjective = true,
    check: LocalPlanningAnswerCheck = {}): Promise<T> {
    let lastInvalid = '';
    let retryInstruction: string | undefined;
    let incompleteOwnerRevision = false;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (signal.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
        let complete: T | undefined;
        let streamedBytes = 0;
        for await (const event of generate(retryInstruction)) {
            if (signal.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
            if (event.type === 'delta') {
                streamedBytes += Buffer.byteLength(event.text, 'utf8');
                if (streamedBytes > maxOutputBytes) fail('Local planning output exceeds the reserved size');
            } else if (event.type === 'complete') complete = event;
        }
        if (!complete) throw new LocalPlanningOutputFailure('Local planning stream ended without completion', lastInvalid);
        if (Buffer.byteLength(complete.text, 'utf8') <= maxOutputBytes) lastInvalid = complete.text;
        incompleteOwnerRevision = false;
        try {
            if (complete.finishReason && !['stop', 'eos', 'end_turn'].includes(complete.finishReason))
                throw new Error('unfinished');
            if (Buffer.byteLength(complete.text, 'utf8') > maxOutputBytes) throw new Error('oversized');
            const value: unknown = JSON.parse(complete.text);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required');
            const raw = value as Record<string, unknown>;
            if (mode === 'gate' && (validGateChatEnvelope(raw) ||
                raw.type === 'roadmap-gate-undo' && Object.keys(raw).sort().join(',') === 'type' ||
                raw.type === 'roadmap-gate-focus' && Object.keys(raw).sort().join(',') === 'id,type' &&
                typeof raw.id === 'string')) return complete;
            const proposal = (raw.type === 'roadmap-proposal' && mode === 'unlinked' &&
                Object.keys(raw).sort().join(',') === 'action,ownerRevision,projectId,type' &&
                Number.isSafeInteger(raw.ownerRevision) || raw.type === 'roadmap-draft-proposal' && mode === 'draft' &&
                Object.keys(raw).sort().join(',') === 'action,draftRevision,projectId,type' &&
                Number.isSafeInteger(raw.draftRevision)) &&
                typeof raw.projectId === 'string' &&
                validNestedAction(raw.action, mode);
            const sequence = raw.type === 'roadmap-sequence' && mode === 'unlinked' &&
                check.maxSteps !== undefined &&
                Object.keys(raw).sort().join(',') === 'actions,ownerRevision,projectId,type' &&
                Number.isSafeInteger(raw.ownerRevision) && typeof raw.projectId === 'string' &&
                Array.isArray(raw.actions) && raw.actions.length >= 2 && raw.actions.length <= check.maxSteps &&
                raw.actions.every(action => validNestedAction(action, 'unlinked'));
            const draftSequence = raw.type === 'roadmap-draft-sequence' && mode === 'draft' &&
                check.maxSteps !== undefined &&
                Object.keys(raw).sort().join(',') === 'actions,draftRevision,projectId,type' &&
                Number.isSafeInteger(raw.draftRevision) && typeof raw.projectId === 'string' &&
                Array.isArray(raw.actions) && raw.actions.length >= 2 && raw.actions.length <= check.maxSteps &&
                raw.actions.every(action => validNestedAction(action, 'draft'));
            const intent = mode === 'linked' && eligibleObjective && raw.type === 'roadmap-intent' &&
                Object.keys(raw).sort().join(',') === 'intent,type,value' && raw.intent === 'set-objective' &&
                typeof raw.value === 'string' && raw.value.length <= 8192 && !/[\r\n\0]/.test(raw.value);
            const noAction = raw.type === 'no-action' && Object.keys(raw).sort().join(',') === 'message,type' &&
                typeof raw.message === 'string' && raw.message.trim().length > 0 && raw.message.length <= 4000 &&
                !EMPTY_NO_ACTION_MESSAGES.has(raw.message.trim().toLowerCase());
            if (mode === 'bridge' && raw.type === 'bridge-proposal' &&
                await check.validateBridge?.(raw)) return complete;
            if (mode !== 'help' && mode !== 'bridge' && (proposal || sequence || draftSequence || intent)) return complete;
            if (noAction) {
                if (check.requiredOwnerRevision === undefined ||
                    citesOwnerRevision(raw.message as string, check.requiredOwnerRevision)) return complete;
                incompleteOwnerRevision = true;
                retryInstruction = `Previous answer omitted current Roadmap owner revision ${check.requiredOwnerRevision}. Re-answer all requested facts from attached evidence as strict JSON no-action.`;
            } else {
                incompleteOwnerRevision = false;
                retryInstruction = undefined;
            }
        } catch {
            // A retry must change the model's task, especially when Pi starts a fresh tool session.

        }
        if (attempt + 1 < MAX_ATTEMPTS)
            check.onRetry?.(incompleteOwnerRevision ? 'missing-owner-revision' : 'invalid-envelope');
    }
    return fail(incompleteOwnerRevision ?
        'Local planning answer omitted the requested current Roadmap owner revision after two attempts' :
        'Local planning did not return strict JSON after two attempts', lastInvalid,
        incompleteOwnerRevision ? 'incomplete-answer' : 'invalid-json');
}

function validNestedAction(value: unknown, mode: 'linked' | 'unlinked' | 'draft'): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const action = value as Record<string, unknown>;
    const specs: Record<string, [string[], string[]]> = mode === 'draft' ? {
        'create-phase': [['type', 'title'], ['objective']],
        'create-gate': [['type', 'phaseId', 'title', 'purpose'], []],
        'edit-gate': [['type', 'phaseId', 'gateId'], ['title', 'purpose']],
        'add-criterion': [['type', 'phaseId', 'gateId', 'title', 'expectedResult'], []],
        'edit-criterion': [['type', 'phaseId', 'gateId', 'criterionId'], ['title', 'expectedResult']],
        'create-checkpoint': [['type', 'phaseId', 'title'], ['objective']],
        'edit-phase': [['type', 'phaseId'], ['title', 'objective']],
        'edit-checkpoint': [['type', 'phaseId', 'checkpointId'], ['title', 'objective']],
        'reorder-phase': [['type', 'phaseId', 'order'], []],
        'reorder-checkpoint': [['type', 'phaseId', 'checkpointId', 'order'], []],
        'split-checkpoint': [['type', 'phaseId', 'checkpointId', 'title'], ['objective']],
        'move-checkpoint': [['type', 'phaseId', 'checkpointId', 'targetPhaseId', 'order'], []],
        'add-dependency': [['type', 'checkpointId', 'dependencyId'], []],
        'remove-dependency': [['type', 'checkpointId', 'dependencyId'], []],
        'create-correction': [['type', 'parentId', 'title'], ['objective']],
        'attach-correction': [['type', 'correctionId', 'parentId'], []]
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
