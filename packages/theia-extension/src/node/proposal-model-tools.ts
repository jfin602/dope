import type { ChatDocumentationProposal } from '@dope/chat';
import type { DocumentationReadPage } from './documentation-skill-review';

type ModelStage = { target: string; content: string; complete: boolean };
const object = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('PROPOSAL_STAGE_OBJECT_REQUIRED');
    return value as Record<string, unknown>;
};
const shape = (value: Record<string, unknown>, required: string[], optional: string[] = []): void => {
    const invalid = Object.keys(value).find(key => !required.includes(key) && !optional.includes(key));
    if (invalid) throw new Error(`PROPOSAL_STAGE_UNSUPPORTED_FIELD:${invalid}`);
    const missing = required.find(key => !(key in value));
    if (missing) throw new Error(`PROPOSAL_STAGE_REQUIRED_FIELD:${missing}`);
};
const string = (value: unknown, field: string): string => {
    if (typeof value !== 'string' || !value.length) throw new Error(`PROPOSAL_STAGE_INVALID_FIELD:${field}`);
    return value;
};
const complete = (value: unknown): boolean => {
    if (typeof value !== 'boolean') throw new Error('PROPOSAL_STAGE_INVALID_FIELD:complete');
    return value;
};

export function documentModelStage(raw: unknown, pages: readonly DocumentationReadPage[],
    prior?: ChatDocumentationProposal): ModelStage {
    const value = object(raw);
    const path = string(value.path, 'path');
    const done = complete(value.complete);
    let operation: object;
    switch (value.operation) {
        case 'replace': {
            shape(value, ['path', 'operation', 'before', 'after', 'complete']);
            const before = string(value.before, 'before'), after = string(value.after, 'after');
            const saved = prior?.targets.find(target => target.path === path);
            const sourceHash = saved?.afterHash ?? pages.find(page => page.path === path &&
                page.text.includes(before))?.fullHash;
            if (!sourceHash) throw new Error('PROPOSAL_DOCUMENT_BEFORE_UNREAD:before');
            operation = { operation: 'replace', before, after, sourceHash };
            break;
        }
        case 'create':
            shape(value, ['path', 'operation', 'chunk', 'complete']);
            operation = { operation: 'create', chunk: string(value.chunk, 'chunk') };
            break;
        case 'remove':
            shape(value, ['path', 'operation', 'complete']);
            if (!prior?.targets.some(target => target.path === path))
                throw new Error('PROPOSAL_DOCUMENT_REMOVE_UNSAVED:operation');
            operation = { operation: 'remove' };
            break;
        default: throw new Error('PROPOSAL_STAGE_INVALID_FIELD:operation');
    }
    return { target: path, content: JSON.stringify(operation), complete: done };
}

export function promptModelStage(raw: unknown): ModelStage {
    const value = object(raw);
    const target = string(value.target, 'target');
    const done = complete(value.complete);
    const common = ['target', 'kind', 'complete'];
    let fields: string[];
    switch (value.kind) {
        case 'work': fields = ['title', 'objective', 'tier', 'workingSet', 'acceptanceCriteria',
            'validationTargets'];
            shape(value, [...common, ...fields], ['dependsOn', 'requirements', 'constraints', 'integrationChecks']);
            if (done && !Array.isArray(value.validationTargets))
                throw new Error('PROPOSAL_STAGE_INVALID_FIELD:validationTargets');
            break;
        case 'section': fields = ['heading', 'text']; shape(value, [...common, ...fields]); break;
        case 'closeout': fields = ['title', 'objective', 'manualReason', 'acceptanceCriteria',
            'browserRequired', 'efficiencyAudit'];
            shape(value, [...common, ...fields]);
            if (target !== 'closeout') throw new Error('PROPOSAL_STAGE_INVALID_FIELD:target');
            break;
        default: throw new Error('PROPOSAL_STAGE_INVALID_FIELD:kind');
    }
    const content = Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'target' && key !== 'complete'));
    if (value.kind === 'work') content.id = target;
    return { target, content: JSON.stringify(content), complete: done };
}

/** Safe, bounded model guidance; never echo source text or protected identities. */
export function proposalToolError(error: unknown): { version: 1; error: string; field?: string;
    expected: string; recovery: string } {
    const message = error instanceof Error ? error.message : '';
    const matched = /^(PROPOSAL_[A-Z_]+)(?::([a-zA-Z]+))?$/u.exec(message);
    const knownPrompt = /^(PROMPT_(?:WORK_STAGE|SECTION_STAGE|CLOSEOUT_STAGE|DEPENDENCY_ORDER|SECTION_ORDER|ORDER|INCOMPLETE_STACK|SOURCE_CHANGED))$/u.exec(message);
    const code = matched?.[1] ?? (knownPrompt ? `PROPOSAL_${knownPrompt[1]}` :
        /Exact replacement is missing or ambiguous/u.test(message) ? 'PROPOSAL_DOCUMENT_ANCHOR' :
        /Update source changed|Documentation source changed/u.test(message) ? 'PROPOSAL_DOCUMENT_SOURCE_CHANGED' :
        /Created document is already complete/u.test(message) ? 'PROPOSAL_DOCUMENT_ALREADY_COMPLETE' :
        'PROPOSAL_TOOL_FAILED');
    const field = matched?.[2] ?? (code === 'PROPOSAL_DOCUMENT_ANCHOR' ? 'before' : undefined);
    const expected = code === 'PROPOSAL_STAGE_REQUIRED_FIELD' ? 'Supply the named required field.' :
        code === 'PROPOSAL_STAGE_UNSUPPORTED_FIELD' ? 'Use only fields in the exposed typed tool schema.' :
        code === 'PROPOSAL_DOCUMENT_BEFORE_UNREAD' ? 'Use an exact excerpt from a brokered read_file page.' :
        code === 'PROPOSAL_DOCUMENT_REMOVE_UNSAVED' ? 'Remove only a target in the selected unpublished proposal.' :
        code === 'PROPOSAL_REPLAY_CONFLICT' ? 'A tool call ID must retain its original arguments.' :
        code === 'PROPOSAL_PROMPT_WORK_COUNT' ? 'Stage the exact requested number of work prompts before the one manual closeout.' :
        code === 'PROPOSAL_DOCUMENT_ANCHOR' ? 'Use a unique exact excerpt from the verified source or selected proposal.' :
        code === 'PROPOSAL_DOCUMENT_SOURCE_CHANGED' ? 'The verified source must still match its pinned full-file hash.' :
        code === 'PROPOSAL_DOCUMENT_ALREADY_COMPLETE' ? 'The created target is complete; stage another target.' :
        code === 'PROPOSAL_PROMPT_WORK_STAGE' ? 'Supply one valid work step with concrete working files and tests.' :
        code === 'PROPOSAL_PROMPT_SECTION_STAGE' ? 'Supply a bounded section with heading and nonempty text.' :
        code === 'PROPOSAL_PROMPT_CLOSEOUT_STAGE' ? 'Supply one terminal manual closeout with ten efficiency findings.' :
        code === 'PROPOSAL_PROMPT_DEPENDENCY_ORDER' ? 'Finish dependency steps before staging their dependents.' :
        code === 'PROPOSAL_PROMPT_T2_GATE' ? 'Include exactly one explicit T2 integration gate among requested work prompts.' :
        code === 'PROPOSAL_PROMPT_UNGROUNDED_MODULE_TEST' ? 'A CommonJS test requires a matching actually read source file in the saved plan.' :
        code === 'PROPOSAL_PROMPT_UNGROUNDED_DEPENDENCY' ? 'A new dependency requires a saved plan source read and explicit dependency rationale.' :
        code === 'PROPOSAL_INCOMPLETE' ? 'Complete every staged target and required requested target.' :
        'Use a valid bounded operation matching the current protected proposal session.';
    return { version: 1, error: code, ...(field ? { field } : {}), expected,
        recovery: code === 'PROPOSAL_REPLAY_CONFLICT' ? 'Start a new stage call with corrected content.' :
            'Check proposal_status, correct the named field or operation, then retry.' };
}
