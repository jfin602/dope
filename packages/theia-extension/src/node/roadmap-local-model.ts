import { createHash } from 'node:crypto';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { ConversationMessage, ConversationModelCapabilities, ConversationUsage } from '@dope/contracts/lib/model-runtime';
import type { StrategicDraftInput } from '@dope/project-intelligence/lib/node/roadmap-greenfield';

const SYSTEM_RESERVE = 512;
const SAFETY_RESERVE = 256;
const MAX_ATTEMPTS = 2;
const MAX_PLANNING_OUTPUT_TOKENS = 4096;
const MAX_PLANNING_JSON_BYTES = 32768;
const EMPTY_NO_ACTION_MESSAGES = new Set(['source-backed answer', 'brief source-backed reason', 'brief reason']);

/** Pass 1 asks for readable planning prose; it grants no Roadmap authority. */
export const naturalRoadmapPlanInstruction = `Write a complete, readable implementation Roadmap for the user's request. Use ordered Phase 1, Phase 2, ... headings. Under each Phase describe its objective, named Gates, and bullet acceptance checks that someone can observe or test. Keep each Gate and its checks under its owning Phase. Cover every requirement in the request; for a tower-defense game include waypoints, enemy motion and health, tower targeting, projectiles and cooldowns, waves, earned and spent currency, persistent main-tower health, and loss at zero health. Do not write RM1, JSON, operation IDs, source hashes, approvals, tool calls, or implementation code. Finish the full plan in the final answer.`;

export interface NaturalRoadmapPlanCheck { complete: boolean; phaseCount: number; gateCount: number;
    acceptanceCount: number; coverageWarnings: string[] }
const NATURAL_MECHANICS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
    { label: 'waypoints', pattern: /\bwaypoints?\b/i },
    { label: 'enemy movement and health', pattern: /\benem(?:y|ies)\b[\s\S]*?\b(?:mov(?:e|es|ing|ement)|travel|travers(?:e|es|al))\b[\s\S]*?\bhealth\b|\benem(?:y|ies)\b[\s\S]*?\bhealth\b[\s\S]*?\b(?:mov(?:e|es|ing|ement)|travel|travers(?:e|es|al))\b/i },
    { label: 'tower targeting', pattern: /\btower\b[\s\S]*?\btarget(?:s|ing)?\b|\btarget(?:s|ing)?\b[\s\S]*?\btower\b/i },
    { label: 'projectiles', pattern: /\bprojectiles?\b/i },
    { label: 'cooldowns', pattern: /\bcooldowns?\b/i },
    { label: 'waves', pattern: /\bwaves?\b/i },
    { label: 'currency earned and spent', pattern: /\b(?:currency|money|coins?)\b[\s\S]*?\b(?:earn|gain|reward)\b[\s\S]*?\b(?:spend|cost|buy|purchase)\b|\b(?:earn|gain|reward)\b[\s\S]*?\b(?:currency|money|coins?)\b[\s\S]*?\b(?:spend|cost|buy|purchase)\b/i },
    { label: 'persistent main-tower health', pattern: /\bmain[ -]?tower\b[\s\S]*?\bhealth\b[\s\S]*?\b(?:persist\w*|carr\w*|remain\w*|retain\w*)\b|\bhealth\b[\s\S]*?\b(?:persist\w*|carr\w*|remain\w*|retain\w*)\b[\s\S]*?\bmain[ -]?tower\b/i },
    { label: 'loss at zero health', pattern: /\b(?:zero|0)\b[\s\S]*?\b(?:health|defeat|lose|loss|game over)\b|\b(?:health|defeat|lose|loss|game over)\b[\s\S]*?\b(?:zero|0)\b/i }
];
/** Only a completed final answer can become a lock; activity/reasoning is excluded by the caller. */
export function checkNaturalRoadmapPlan(text: string, finishReason: string | undefined,
    originalRequest: string, outputTokenLimit = 4096): NaturalRoadmapPlanCheck {
    if (!finishReason || !['stop', 'eos', 'end_turn'].includes(finishReason))
        throw new LocalPlanningOutputFailure('Natural Roadmap plan did not complete', '', 'incomplete-answer');
    if (!Number.isSafeInteger(outputTokenLimit) || outputTokenLimit < 256 || outputTokenLimit > 8192)
        throw new Error('Invalid natural Roadmap output limit');
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes < 200 || bytes > Math.min(32768, outputTokenLimit * 8) ||
        /[\0-\x08\x0b\x0c\x0e-\x1f\u007f]|<\/?(?:script|iframe|object)\b|\[\[.*?\]\]|\b(?:api[_-]?key|bearer\s+\S+|"(?:arguments|tool_calls)"\s*:)|\bsk-[A-Za-z0-9]{12,}/iu.test(text))
        throw new LocalPlanningOutputFailure('Natural Roadmap plan is empty, oversized, or unsafe', '', 'incomplete-answer');
    const lines = text.split(/\r?\n/u);
    let phaseCount = 0, gateCount = 0, acceptanceCount = 0;
    for (const line of lines) {
        const phase = /^\s*(?:#{1,4}\s*)?(?:\*\*)?Phase\s+(\d+)\s*(?:[:.\-–—]|\*\*)\s*\S/iu.exec(line);
        if (phase) {
            if (Number(phase[1]) !== phaseCount + 1) throw new LocalPlanningOutputFailure('Natural Roadmap Phases are not ordered', '', 'incomplete-answer');
            phaseCount++; continue;
        }
        if (/^\s*(?:#{1,5}\s*)?(?:[-*]\s*)?(?:\*\*)?Gate\s*(?:\d+\s*)?(?:[:.\-–—]|\*\*)\s*\S/iu.test(line)) {
            if (!phaseCount) throw new LocalPlanningOutputFailure('Gate appears before a Phase', '', 'incomplete-answer');
            gateCount++; continue;
        }
        if (/^\s*[-*]\s+(?:(?:Acceptance|Check|Criterion)\s*[:.\-–—]\s*)?\S/iu.test(line) && gateCount)
            acceptanceCount++;
    }
    const towerDefense = /\btower[ -]?defen[sc]e\b|\bmain[ -]?tower\b/iu.test(originalRequest);
    const warnings = towerDefense ? NATURAL_MECHANICS.filter(item => !item.pattern.test(text)).map(item =>
        `Natural plan does not clearly cover ${item.label}`) : [];
    if (towerDefense && phaseCount < 5) warnings.unshift('Tower-defense plan needs at least five Phases');
    return { complete: phaseCount >= (towerDefense ? 5 : 2) && phaseCount <= 12 &&
        gateCount >= phaseCount && acceptanceCount >= gateCount && warnings.length === 0,
        phaseCount, gateCount, acceptanceCount, coverageWarnings: warnings };
}

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
    allowPlainNoAction?: boolean;
    onRetry?: (cause: 'invalid-envelope' | 'missing-owner-revision') => void;
    onActivity?: (kind: 'thinking' | 'provisional' | 'answer' | 'tool', text: string) => void;
    validateBridge?: (value: Record<string, unknown>) => Promise<boolean>;
}

/** Read-only Gate turns may finish in prose; only typed envelopes can propose a write. */
export function allowsPlainGateAnswer(request: string): boolean {
    const withoutNegatedEdits = request.replace(/\b(?:do not|don't|no)\s+(?:edit|change|modify)\b/gi, '');
    return /^\s*(?:what|why|how|when|where|which|who|is|are|does|do|can|could|would|read|inspect|show|summarize|explain)\b/i.test(request) &&
        !/\b(?:propos(?:e|al)|apply|approve|reject|create|add|remove|delete|reparent|reorder|edit|change|modify)\b/i.test(withoutNegatedEdits);
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

/** Model-facing greenfield format. It deliberately contains no owner or approval fields. */
export interface TypedRoadmapDraftV1 {
    type: 'roadmap-draft';
    schemaVersion: 1;
    phases: Array<{ title: string; objective: string; dependsOn?: number[];
        gates: Array<{ title: string; purpose: string;
            criteria: Array<{ title: string; expectedResult: string }> }> }>;
}

export interface RoadmapMechanicRequirement { label: string; terms: readonly string[] }
export interface UntrustedTypedRoadmapCandidate {
    kind: 'untrusted-typed-roadmap-draft';
    draft: TypedRoadmapDraftV1;
    /** Text matching only; the trusted proposal owner must decide actual coverage. */
    coverageWarnings: string[];
}

const TYPED_DRAFT_MAX_BYTES = 32768;
const TYPED_DRAFT_MAX_OPERATIONS = 48;
const TYPED_DRAFT_MAX_ENTITIES = 64;

export function typedRoadmapDraftInstruction(requiredMechanics: readonly string[] = []): string {
    const requirements = requiredMechanics.length ?
        ` Include an observable C result for each required mechanic: ${requiredMechanics.join('; ')}.` : '';
    return 'Return one complete Roadmap Markers v1 answer, exactly:\nRM1\n' +
        'P|Phase title|Phase objective\nG|Gate title|Gate purpose\n' +
        'C|One observable expected-result sentence\nEND\n' +
        'Output the lines immediately, without analysis, an outline, or commentary. ' +
        'For each Phase, write its P row, then each Gate G row immediately followed by its C rows; then write the next P row. ' +
        'A P or G row has exactly two separator bars; a C row has exactly one. Never put a bar inside a field. ' +
        'Use 2–12 Phases; if at least five are requested, use five unless more are explicitly required. Use 1–8 necessary Gates per Phase and ' +
        '1–6 distinct observable C sentences per Gate. Cover every named MVP mechanic; keep optional features outside the MVP. ' +
        'End with END. No JSON, fences, tool calls, IDs, dependencies, authority fields, or verification claims.' +
        requirements;
}

/** Bounded, content-free diagnostics for the one-pass marker completion. */
export function roadmapMarkerCompletionDiagnostic(complete: { text: string; finishReason?: string;
    usage?: ConversationUsage } | undefined, requestedOutputTokens: number, measuredContextTokens: number): string {
    const usage = complete?.usage;
    const reported = usage?.tokenMeasurement === 'provider-reported';
    const token = (value: number | undefined) => reported && Number.isSafeInteger(value) && value! >= 0 ? value : 'unavailable';
    const reasoning = token(usage?.reasoningTokens);
    const final = typeof reasoning === 'number' && typeof token(usage?.outputTokens) === 'number' ?
        (usage!.outputTokens! - reasoning) : 'unavailable';
    const finish = complete?.finishReason;
    const safeFinish = finish && ['stop', 'eos', 'end_turn', 'length'].includes(finish) ? finish :
        finish ? 'other' : 'unavailable';
    const hasFinal = complete ? complete.text.length > 0 : false;
    const ended = complete ? /(?:^|\n)END\r?\n?$/.test(complete.text) : false;
    return `RM1 completion: requestedOutputTokens=${requestedOutputTokens}, ` +
        `measuredContextTokens=${measuredContextTokens}, finishReason=${safeFinish}, ` +
        `completedFinalText=${hasFinal ? 'present' : 'absent'}, markerEND=${ended ? 'yes' : 'no'}, ` +
        `reasoningTokens=${reasoning}, finalTokens=${final}, totalTokens=${token(usage?.totalTokens)}`;
}

/** A complete answer is an untrusted candidate, never a canonical Roadmap mutation. */
export function parseTypedRoadmapDraft(text: string, finishReason: string | undefined,
    requiredMechanics: readonly RoadmapMechanicRequirement[] = [],
    maxOutputBytes = TYPED_DRAFT_MAX_BYTES): UntrustedTypedRoadmapCandidate {
    if (finishReason && !['stop', 'eos', 'end_turn'].includes(finishReason))
        return fail('Typed Roadmap draft was truncated before completion', text, 'incomplete-answer');
    if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 ||
        Buffer.byteLength(text, 'utf8') > Math.min(maxOutputBytes, TYPED_DRAFT_MAX_BYTES))
        return fail('Typed Roadmap draft exceeds the reserved output byte limit', text, 'incomplete-answer');
    let value: unknown;
    try { value = JSON.parse(text); } catch {
        return fail('Typed Roadmap draft is incomplete or malformed JSON', text, 'incomplete-answer');
    }
    const object = (item: unknown, path: string): Record<string, unknown> => {
        if (!item || typeof item !== 'object' || Array.isArray(item))
            return fail(`${path} must be an object`, text);
        return item as Record<string, unknown>;
    };
    const exact = (item: Record<string, unknown>, required: string[], optional: string[], path: string) => {
        const missing = required.find(key => !Object.hasOwn(item, key));
        if (missing) fail(`${path}.${missing} is required`, text, 'incomplete-answer');
        const extra = Object.keys(item).find(key => !required.includes(key) && !optional.includes(key));
        if (extra) fail(`${path}.${extra} is not allowed in a model draft`, text);
    };
    const line = (item: unknown, max: number, path: string): string => {
        if (typeof item !== 'string' || !item.trim() || item.length > max ||
            /[\p{Cc}\p{Cf}]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(item) ||
            /<\/?[a-z][^>]*>|javascript:|!\[[^\]]*\]\(https?:/iu.test(item))
            return fail(`${path} must be safe nonempty text of at most ${max} characters`, text);
        return item.trim();
    };
    const list = (item: unknown, min: number, max: number, path: string): unknown[] => {
        if (!Array.isArray(item) || item.length < min || item.length > max)
            return fail(`${path} needs ${min}–${max} entries`, text, 'incomplete-answer');
        return item;
    };
    const unique = (values: string[], path: string) => {
        if (new Set(values.map(item => item.normalize('NFKC').toLocaleLowerCase())).size !== values.length)
            fail(`${path} has duplicate titles`, text);
    };
    const root = object(value, 'draft');
    exact(root, ['type', 'schemaVersion', 'phases'], [], 'draft');
    if (root.type !== 'roadmap-draft' || root.schemaVersion !== 1)
        return fail('draft.type/schemaVersion must be roadmap-draft/1', text);
    let operationCount = 0;
    let entityCount = 0;
    const phases = list(root.phases, 2, 12, 'draft.phases').map((entry, phaseIndex) => {
        const path = `draft.phases[${phaseIndex}]`;
        const phase = object(entry, path);
        exact(phase, ['title', 'objective', 'gates'], ['dependsOn'], path);
        operationCount++;
        entityCount++;
        const title = line(phase.title, 120, `${path}.title`);
        const objective = line(phase.objective, 360, `${path}.objective`);
        let dependsOn: number[] | undefined;
        if (phase.dependsOn !== undefined) {
            if (phaseIndex === 0) fail(`${path}.dependsOn has no earlier Phase to reference`, text);
            dependsOn = list(phase.dependsOn, 1, phaseIndex, `${path}.dependsOn`) as number[];
            if (dependsOn.some(index => !Number.isSafeInteger(index) || index < 1 || index > phaseIndex) ||
                new Set(dependsOn).size !== dependsOn.length)
                fail(`${path}.dependsOn must name distinct earlier 1-based Phase positions`, text);
            operationCount++;
        }
        const gates = list(phase.gates, 1, 8, `${path}.gates`).map((gateEntry, gateIndex) => {
            const gatePath = `${path}.gates[${gateIndex}]`;
            const gate = object(gateEntry, gatePath);
            exact(gate, ['title', 'purpose', 'criteria'], [], gatePath);
            operationCount++;
            entityCount++;
            const gateTitle = line(gate.title, 120, `${gatePath}.title`);
            const purpose = line(gate.purpose, 280, `${gatePath}.purpose`);
            const criteria = list(gate.criteria, 1, 6, `${gatePath}.criteria`).map((criterionEntry, criterionIndex) => {
                const criterionPath = `${gatePath}.criteria[${criterionIndex}]`;
                const criterion = object(criterionEntry, criterionPath);
                exact(criterion, ['title', 'expectedResult'], [], criterionPath);
                entityCount++;
                const criterionTitle = line(criterion.title, 120, `${criterionPath}.title`);
                const expectedResult = line(criterion.expectedResult, 300, `${criterionPath}.expectedResult`);
                if (/^(?:done|works?|complete|green|passed|verified|test(?:ed)?|tbd)[.! ]*$/i.test(expectedResult))
                    fail(`${criterionPath}.expectedResult must describe observable behavior`, text);
                return { title: criterionTitle, expectedResult };
            });
            unique(criteria.map(item => item.title), `${gatePath}.criteria`);
            return { title: gateTitle, purpose, criteria };
        });
        unique(gates.map(item => item.title), `${path}.gates`);
        return { title, objective, ...(dependsOn ? { dependsOn } : {}), gates };
    });
    unique(phases.map(item => item.title), 'draft.phases');
    if (operationCount > TYPED_DRAFT_MAX_OPERATIONS)
        return fail(`Typed Roadmap draft has ${operationCount} operations; at most 48 are supported`, text);
    if (entityCount > TYPED_DRAFT_MAX_ENTITIES)
        return fail(`Typed Roadmap draft has ${entityCount} entities; at most 64 are supported`, text);
    const gateEvidence = phases.flatMap(phase => phase.gates.flatMap(gate =>
        [gate.title, gate.purpose, ...gate.criteria.flatMap(criterion => [criterion.title, criterion.expectedResult])]))
        .join(' ').normalize('NFKC').toLocaleLowerCase();
    const coverageWarnings = requiredMechanics.filter(item => item.terms.length > 0 &&
        !item.terms.some(term => gateEvidence.includes(term.normalize('NFKC').toLocaleLowerCase())))
        .map(item => `No Gate/Criterion text explicitly covers ${item.label}`);
    return { kind: 'untrusted-typed-roadmap-draft',
        draft: { type: 'roadmap-draft', schemaVersion: 1, phases }, coverageWarnings };
}

/** Parse one complete RM1 answer. The result has no authority beyond the existing typed candidate. */
export function parseRoadmapMarkers(text: string, finishReason: string | undefined,
    requiredMechanics: readonly RoadmapMechanicRequirement[] = [],
    maxOutputBytes = TYPED_DRAFT_MAX_BYTES): UntrustedTypedRoadmapCandidate {
    if (!finishReason || !['stop', 'eos', 'end_turn'].includes(finishReason))
        return fail('RM1 output was truncated or has no completed finish reason', text, 'incomplete-answer');
    if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 ||
        Buffer.byteLength(text, 'utf8') > Math.min(maxOutputBytes, TYPED_DRAFT_MAX_BYTES))
        return fail('RM1 output exceeds the reserved output byte limit', text, 'incomplete-answer');
    const lines = text.replace(/\r\n/g, '\n').split('\n');
    if (lines.at(-1) === '') lines.pop(); // exactly one ordinary final newline is permitted
    if (lines.length > 700) return fail('RM1 line 701 exceeds the safe line limit', text);
    if (lines[0] !== 'RM1') return fail('RM1 line 1 must be exactly RM1', text);
    if (lines.length < 3 || lines.at(-1) !== 'END')
        return fail(`RM1 line ${lines.length} must be exactly END`, text, 'incomplete-answer');
    const field = (value: string, max: number, at: number, name: string): string => {
        if (!value.trim() || value !== value.trim() || value.length > max ||
            /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value) ||
            /<\/?[a-z][^>]*>|javascript:|!\[[^\]]*\]\(https?:/iu.test(value))
            return fail(`RM1 line ${at} ${name} must be safe nonempty text of at most ${max} characters`, text);
        return value.trim();
    };
    const seen = (values: Set<string>, value: string, at: number, name: string) => {
        const key = value.normalize('NFKC').toLocaleLowerCase();
        if (values.has(key)) fail(`RM1 line ${at} ${name} is duplicate`, text);
        values.add(key);
    };
    const phases: TypedRoadmapDraftV1['phases'] = [];
    const phaseTitles = new Set<string>();
    let phase: TypedRoadmapDraftV1['phases'][number] | undefined;
    let gate: TypedRoadmapDraftV1['phases'][number]['gates'][number] | undefined;
    let gateTitles = new Set<string>();
    const results = new Set<string>();
    let titles = new Set<string>();
    let operations = 0;
    let entities = 0;
    for (let index = 1; index < lines.length - 1; index++) {
        const at = index + 1;
        const parts = lines[index].split('|');
        const kind = parts[0];
        const expected = kind === 'P' || kind === 'G' ? 3 : kind === 'C' ? 2 : 0;
        if (!expected || parts.length !== expected)
            return fail(`RM1 line ${at} has an unknown kind or incorrect field count`, text);
        if (kind === 'P') {
            if (phase && !phase.gates.length)
                return fail(`RM1 line ${at} previous Phase needs a Gate`, text, 'incomplete-answer');
            if (gate && !gate.criteria.length)
                return fail(`RM1 line ${at} previous Gate needs a Criterion`, text, 'incomplete-answer');
            const title = field(parts[1], 120, at, 'Phase title');
            seen(phaseTitles, title, at, 'Phase title');
            phase = { title, objective: field(parts[2], 360, at, 'Phase objective'), gates: [] };
            phases.push(phase);
            operations++;
            entities++;
            if (phases.length > 12) return fail(`RM1 line ${at} exceeds 12 Phases`, text);
            gate = undefined;
            gateTitles = new Set();
        } else if (kind === 'G') {
            if (!phase) return fail(`RM1 line ${at} Gate needs a preceding Phase`, text);
            if (gate && !gate.criteria.length)
                return fail(`RM1 line ${at} previous Gate needs a Criterion`, text, 'incomplete-answer');
            const title = field(parts[1], 120, at, 'Gate title');
            seen(gateTitles, title, at, 'Gate title');
            gate = { title, purpose: field(parts[2], 280, at, 'Gate purpose'), criteria: [] };
            phase.gates.push(gate);
            operations++;
            entities++;
            if (phase.gates.length > 8) return fail(`RM1 line ${at} exceeds 8 Gates in Phase`, text);
            titles = new Set();
        } else {
            if (!gate) return fail(`RM1 line ${at} Criterion needs a preceding Gate`, text);
            const expectedResult = field(parts[1], 300, at, 'Criterion expectedResult');
            if (/^(?:done|works?|complete|green|passed|verified|test(?:ed)?|tbd)[.! ]*$/i.test(expectedResult))
                return fail(`RM1 line ${at} Criterion expectedResult must describe observable behavior`, text);
            seen(results, expectedResult, at, 'Criterion expectedResult');
            const digest = createHash('sha256').update(expectedResult).digest('hex').slice(0, 10);
            let prefix = '';
            for (const char of expectedResult) {
                if (prefix.length + char.length > 106) break;
                prefix += char;
            }
            const title = `${prefix.trimEnd()} [${digest}]`;
            seen(titles, title, at, 'derived Criterion title');
            gate.criteria.push({ title, expectedResult });
            entities++;
            if (gate.criteria.length > 6) return fail(`RM1 line ${at} exceeds 6 Criteria in Gate`, text);
        }
        if (operations > TYPED_DRAFT_MAX_OPERATIONS)
            return fail(`RM1 line ${at} exceeds at most 48 staging operations`, text);
        if (entities > TYPED_DRAFT_MAX_ENTITIES)
            return fail(`RM1 line ${at} exceeds at most 64 entities`, text);
    }
    if (phase && !phase.gates.length)
        return fail(`RM1 line ${lines.length} final Phase needs a Gate`, text, 'incomplete-answer');
    if (gate && !gate.criteria.length)
        return fail(`RM1 line ${lines.length} final Gate needs a Criterion`, text, 'incomplete-answer');
    if (phases.length < 2) return fail(`RM1 line ${lines.length} needs 2–12 complete Phases`, text, 'incomplete-answer');
    // Reuse strict JSON-candidate validation for operation/entity ceilings and coverage warnings.
    return parseTypedRoadmapDraft(JSON.stringify({ type: 'roadmap-draft', schemaVersion: 1, phases }),
        finishReason, requiredMechanics, TYPED_DRAFT_MAX_BYTES);
}

/** One normal model generation. No partial answer, retry, or prose gains proposal authority. */
export async function generateTypedRoadmapDraft<T extends { type: string; text: string; finishReason?: string }>(
    generate: () => AsyncIterable<T>, signal: AbortSignal, maxOutputBytes: number,
    requiredMechanics: readonly RoadmapMechanicRequirement[] = []): Promise<UntrustedTypedRoadmapCandidate> {
    if (signal.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
    let complete: T | undefined;
    let streamedBytes = 0;
    for await (const event of generate()) {
        if (signal.aborted) throw new ModelRuntimeFailure('Conversation cancelled', 'cancelled');
        if (event.type === 'delta') {
            streamedBytes += Buffer.byteLength(event.text, 'utf8');
            if (streamedBytes > Math.min(maxOutputBytes, TYPED_DRAFT_MAX_BYTES))
                return fail('Typed Roadmap draft stream exceeds the reserved output byte limit', '', 'incomplete-answer');
        } else if (event.type === 'complete') {
            if (complete) return fail('Typed Roadmap draft stream completed more than once', '', 'invalid-json');
            complete = event;
        }
        else if (event.type === 'activity' && (event as T & { kind?: string }).kind === 'tool')
            return fail('Typed Roadmap draft generation attempted a tool call', '', 'invalid-json');
    }
    if (!complete) return fail('Typed Roadmap draft stream ended without completion', '', 'incomplete-answer');
    return parseRoadmapMarkers(complete.text, complete.finishReason, requiredMechanics, maxOutputBytes);
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
            else if (event.type === 'activity') {
                const kind = (event as T & { kind?: string }).kind;
                if (kind === 'thinking' || kind === 'provisional' || kind === 'answer' || kind === 'tool')
                    check.onActivity?.(kind, event.text);
            }
        }
        if (!complete) throw new LocalPlanningOutputFailure('Local planning stream ended without completion', lastInvalid);
        if (Buffer.byteLength(complete.text, 'utf8') <= maxOutputBytes) lastInvalid = complete.text;
        incompleteOwnerRevision = false;
        try {
            if (complete.finishReason && !['stop', 'eos', 'end_turn'].includes(complete.finishReason))
                throw new Error('unfinished');
            if (Buffer.byteLength(complete.text, 'utf8') > maxOutputBytes) throw new Error('oversized');
            const plain = complete.text.trim();
            if (mode === 'gate' && check.allowPlainNoAction && check.requiredOwnerRevision === undefined &&
                plain.length > 0 && plain.length <= 4000 && !plain.startsWith('{') &&
                !plain.startsWith('[') && !plain.startsWith('```') &&
                !EMPTY_NO_ACTION_MESSAGES.has(plain.toLowerCase()))
                return { ...complete, text: JSON.stringify({ type: 'no-action', message: plain }) };
            const value: unknown = JSON.parse(complete.text);
            if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('object required');
            const raw = value as Record<string, unknown>;
            if (mode === 'gate' && (
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
        if (attempt + 1 < MAX_ATTEMPTS) {
            if (mode === 'gate' && !incompleteOwnerRevision)
                retryInstruction = 'The previous response was not an accepted read-only schema-2 Roadmap answer. Return exactly one JSON object with no prose or fences: {"type":"no-action","message":"your concrete answer"}. To change Roadmap, the developer must use protected /roadmap tools and review the staged proposal. Never claim an unapproved write.';
            check.onRetry?.(incompleteOwnerRevision ? 'missing-owner-revision' : 'invalid-envelope');
        }
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
