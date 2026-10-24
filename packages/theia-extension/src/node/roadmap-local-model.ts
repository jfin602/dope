import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ConversationMessage, ConversationModelCapabilities } from '@dope/contracts/lib/model-runtime';

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

export interface LocalImplementationPlan {
    type: 'implementation-plan'; objective: string; successCriteria: string[]; constraints: string[];
    assumptions: string[]; steps: { title: string; detail: string; deliverables: string[];
        dependsOn: number[]; reuse: { path: string; reason: string }[] }[];
    tests: string[]; guiQualification: string; risks: string[]; alternatives: string[]; question: string;
}
export function validImplementationPlanRevision(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const raw = value as Record<string, unknown>;
    if (Object.keys(raw).sort().join(',') !== 'baseRevision,constraintsAdd,decisionsAdd,edits,question,type' ||
        raw.type !== 'implementation-plan-revision' || !Number.isSafeInteger(raw.baseRevision) ||
        !planLines(raw.constraintsAdd, 8, 512) || !planLines(raw.decisionsAdd, 8, 512) ||
        typeof raw.question !== 'string' || raw.question.length > 512 || /[\0-\x1f]/.test(raw.question) ||
        !Array.isArray(raw.edits) || !raw.edits.length || raw.edits.length > 8 ||
        Buffer.byteLength(JSON.stringify(raw), 'utf8') > 12000) return false;
    return raw.edits.every(value => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const edit = value as Record<string, unknown>;
        const keys = Object.keys(edit).sort().join(',');
        const number = (key: string) => Number.isSafeInteger(edit[key]) && (edit[key] as number) > 0;
        if (edit.type === 'update') return ['step,type,title', 'detail,step,type', 'detail,step,title,type'].includes(keys) &&
            number('step') && (edit.title === undefined || planLine(edit.title, 200)) &&
            (edit.detail === undefined || planLine(edit.detail, 2048));
        if (edit.type === 'merge') return keys === 'detail,first,second,title,type' &&
            number('first') && number('second') && planLine(edit.title, 200) && planLine(edit.detail, 2048);
        if (edit.type === 'move') return keys === 'before,step,type' && number('step') && number('before');
        if (edit.type === 'split') return keys === 'detail,step,title,type' && number('step') &&
            planLine(edit.title, 200) && planLine(edit.detail, 2048);
        return edit.type === 'add' && keys === 'before,detail,title,type' && number('before') &&
            planLine(edit.title, 200) && planLine(edit.detail, 2048);
    });
}
const planLine = (value: unknown, limit: number): value is string =>
    typeof value === 'string' && !!value.trim() && value.length <= limit && !/[\0-\x1f]/.test(value);
const planLines = (value: unknown, max: number, limit: number): value is string[] =>
    Array.isArray(value) && value.length <= max && value.every(item => planLine(item, limit));
export function validImplementationPlan(value: unknown): value is LocalImplementationPlan {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const raw = value as Record<string, unknown>;
    if (Object.keys(raw).sort().join(',') !==
        'alternatives,assumptions,constraints,guiQualification,objective,question,risks,steps,successCriteria,tests,type' ||
        raw.type !== 'implementation-plan' || !planLine(raw.objective, 2048) ||
        !planLines(raw.successCriteria, 8, 512) || !raw.successCriteria.length ||
        !planLines(raw.constraints, 16, 512) || !planLines(raw.assumptions, 8, 512) ||
        !planLines(raw.tests, 12, 512) || !raw.tests.length || !planLine(raw.guiQualification, 1024) ||
        !planLines(raw.risks, 8, 512) || !planLines(raw.alternatives, 8, 512) ||
        typeof raw.question !== 'string' || raw.question.length > 512 || /[\0-\x1f]/.test(raw.question) ||
        !Array.isArray(raw.steps) || raw.steps.length < 2 || raw.steps.length > 16) return false;
    const steps = raw.steps as unknown[];
    if (Buffer.byteLength(JSON.stringify(raw), 'utf8') > 16000 ||
        new Set(steps.flatMap(value => value && typeof value === 'object' && !Array.isArray(value) &&
            Array.isArray((value as Record<string, unknown>).reuse) ?
            ((value as Record<string, unknown>).reuse as { path?: string }[]).map(item => item?.path) : [])).size > 64)
        return false;
    return steps.every((value, index) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const step = value as Record<string, unknown>;
        return Object.keys(step).sort().join(',') === 'deliverables,dependsOn,detail,reuse,title' &&
            planLine(step.title, 200) && !/[\r\n]/.test(step.title) && planLine(step.detail, 2048) &&
            planLines(step.deliverables, 8, 512) && step.deliverables.length > 0 &&
            Array.isArray(step.dependsOn) && step.dependsOn.length <= index &&
            new Set(step.dependsOn).size === step.dependsOn.length &&
            step.dependsOn.every(item => Number.isSafeInteger(item) && item >= 1 && item <= index) &&
            Array.isArray(step.reuse) && step.reuse.length <= 8 && step.reuse.every(item =>
                item && typeof item === 'object' && !Array.isArray(item) &&
                Object.keys(item).sort().join(',') === 'path,reason' &&
                planLine(item.path, 512) && planLine(item.reason, 512)) &&
            (step.detail as string).length + (index === steps.length - 1 ?
                JSON.stringify([raw.tests, raw.guiQualification, raw.risks, raw.alternatives, raw.question]).length : 0) +
                JSON.stringify(step.reuse).length < 8192;
    });
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
    mode: 'linked' | 'unlinked' | 'draft' | 'help' | 'bridge' | 'plan' | 'plan-revision' = 'unlinked', eligibleObjective = true,
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
            if (mode === 'plan' && validImplementationPlan(raw)) return complete;
            if (mode === 'plan-revision' && validImplementationPlanRevision(raw)) return complete;
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
            if (noAction && mode !== 'plan') {
                if (check.requiredOwnerRevision === undefined ||
                    citesOwnerRevision(raw.message as string, check.requiredOwnerRevision)) return complete;
                incompleteOwnerRevision = true;
                retryInstruction = `Previous answer omitted current Roadmap owner revision ${check.requiredOwnerRevision}. Re-answer all requested facts from attached evidence as strict JSON no-action.`;
            } else {
                incompleteOwnerRevision = false;
                retryInstruction = undefined;
            }
        } catch { /* One bounded repair attempt; no mutation or provider switch. */ }
        if (attempt + 1 < MAX_ATTEMPTS)
            check.onRetry?.(incompleteOwnerRevision ? 'missing-owner-revision' : 'invalid-envelope');
    }
    return fail(mode === 'plan' ?
        'Local implementation plan incomplete or invalid strict JSON after two attempts; no draft change accepted' :
        incompleteOwnerRevision ?
        'Local planning answer omitted the requested current Roadmap owner revision after two attempts' :
        'Local planning did not return strict JSON after two attempts', lastInvalid,
        mode === 'plan' || incompleteOwnerRevision ? 'incomplete-answer' : 'invalid-json');
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
