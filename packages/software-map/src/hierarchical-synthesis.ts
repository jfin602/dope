import { ArchitectureEvidenceItem, ArchitectureEvidencePacket, ArchitectureProposal, ProposedArchitectureNode,
    validateArchitectureEvidencePacket, parseArchitectureProposal, isProductionEvidencePath } from './synthesis';

/** The adapter supplies model-specific limits and a conservative estimate when exact counting is unavailable. */
export interface SynthesisCapabilities {
    modelLabel: string;
    contextWindowTokens: number;
    /** Provider input ceiling, including instructions and provider overhead but excluding generated output. */
    maxInputTokens: number;
    reservedInstructionTokens: number;
    reservedOutputTokens: number;
    reservedOverheadTokens: number;
    tokenEstimate: 'exact' | 'conservative';
    /** Omitted means one active generation. Values above one require explicit provider qualification. */
    maxConcurrentGenerations?: number;
}
export interface SynthesisProvider {
    readonly kind: 'local' | 'gemini';
    capabilities(): Promise<SynthesisCapabilities>;
    estimateTokens(input: string): Promise<number>;
    runStage(request: SynthesisStageRequest, signal?: AbortSignal): Promise<SynthesisStageExecution>;
}
export interface SynthesisStageUsage {
    providerKind: 'local' | 'gemini';
    modelLabel: string;
    requestBytes: number;
    outputBytes: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    tokenMeasurement: 'provider-reported' | 'tokenizer' | 'estimated' | 'unavailable';
}
export interface SynthesisStageExecution { output: unknown; usage: SynthesisStageUsage }
export function usableEvidenceTokens(capability: SynthesisCapabilities): number {
    const capabilityFields = ['modelLabel', 'contextWindowTokens', 'maxInputTokens', 'reservedInstructionTokens',
        'reservedOutputTokens', 'reservedOverheadTokens', 'tokenEstimate'];
    exact(capability, capability.maxConcurrentGenerations === undefined ? capabilityFields :
        [...capabilityFields, 'maxConcurrentGenerations'], 'capabilities');
    label(capability.modelLabel, 'modelLabel');
    for (const key of ['contextWindowTokens', 'maxInputTokens', 'reservedInstructionTokens',
        'reservedOutputTokens', 'reservedOverheadTokens'] as const) {
        const value = capability[key];
        if (!Number.isSafeInteger(value) || value < (key === 'reservedOverheadTokens' ? 0 : 1)) invalid(key);
    }
    if (capability.tokenEstimate !== 'exact' && capability.tokenEstimate !== 'conservative') invalid('tokenEstimate');
    if (capability.maxConcurrentGenerations !== undefined &&
        (!Number.isSafeInteger(capability.maxConcurrentGenerations) || capability.maxConcurrentGenerations < 1 ||
            capability.maxConcurrentGenerations > 8)) invalid('maxConcurrentGenerations');
    const usable = Math.min(capability.maxInputTokens - capability.reservedInstructionTokens - capability.reservedOverheadTokens,
        capability.contextWindowTokens - capability.reservedInstructionTokens - capability.reservedOutputTokens - capability.reservedOverheadTokens);
    if (usable < 1) invalid('insufficient context budget');
    return usable;
}
export async function assertSynthesisInputBudget(provider: Pick<SynthesisProvider, 'estimateTokens'>,
    capability: SynthesisCapabilities, input: string): Promise<number> {
    const ceiling = usableEvidenceTokens(capability);
    const count = await provider.estimateTokens(input);
    if (!Number.isSafeInteger(count) || count < 0) invalid('token estimate');
    if (count > ceiling) invalid('input exceeds synthesis budget');
    return count;
}

export const SYNTHESIS_VIEW_VERSION = 1;
export interface ArchitectureEvidenceView {
    schemaVersion: 1;
    viewVersion: 1;
    /** Fingerprint of the entire deterministic packet, including refinements. */
    parentPacketFingerprint: string;
    /** Hash of version, parent fingerprint, and the complete selected evidence items. */
    viewId: string;
    items: ArchitectureEvidenceItem[];
}
// View IDs are cache keys, never evidence authority. Exact item equality is checked separately.
const digest = (value: unknown) => {
    let hash = 0xcbf29ce484222325n;
    for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
        hash = (hash ^ BigInt(byte)) * 0x100000001b3n & 0xffffffffffffffffn;
    }
    return `view:v1:${hash.toString(16).padStart(16, '0')}`;
};
export function createArchitectureEvidenceView(packet: ArchitectureEvidencePacket, evidenceIds: readonly string[]): ArchitectureEvidenceView {
    validateArchitectureEvidencePacket(packet);
    if (!Array.isArray(evidenceIds) || new Set(evidenceIds).size !== evidenceIds.length) invalid('view evidence IDs');
    const byId = new Map(packet.items.map(item => [item.id, item]));
    const items = evidenceIds.map(id => {
        const item = byId.get(id);
        if (!item) invalid('unknown view evidence ID');
        return item;
    });
    const ordered = [...items].sort((a, b) => a.id.localeCompare(b.id));
    return { schemaVersion: 1, viewVersion: SYNTHESIS_VIEW_VERSION, parentPacketFingerprint: packet.inputFingerprint,
        viewId: digest([SYNTHESIS_VIEW_VERSION, packet.inputFingerprint, ordered]), items: structuredClone(ordered) };
}
export function validateArchitectureEvidenceView(view: ArchitectureEvidenceView, packet: ArchitectureEvidencePacket): void {
    validateArchitectureEvidencePacket(packet);
    exact(view, ['schemaVersion', 'viewVersion', 'parentPacketFingerprint', 'viewId', 'items'], 'view');
    if (view.schemaVersion !== 1 || view.viewVersion !== SYNTHESIS_VIEW_VERSION ||
        view.parentPacketFingerprint !== packet.inputFingerprint || !Array.isArray(view.items)) invalid('view identity');
    const expected = createArchitectureEvidenceView(packet, view.items.map(item => item?.id));
    if (view.viewId !== expected.viewId || JSON.stringify(view.items) !== JSON.stringify(expected.items)) invalid('view items or identity');
}

export const SYNTHESIS_STAGE_VERSION = 2;
const nonempty = { type: 'string', minLength: 1 } as const;
const shortName = { ...nonempty, maxLength: 80 } as const;
const shortResponsibility = { ...nonempty, maxLength: 160 } as const;
export const SYNTHESIS_ISSUE_CODES = ['insufficient-evidence', 'unclear-subdivision', 'boundary-overlap',
    'ownership-conflict', 'weak-support', 'cross-system-dependency', 'outside-system',
    'duplicate-responsibility', 'same-source-region'] as const;
export type SynthesisIssueCode = typeof SYNTHESIS_ISSUE_CODES[number];
const issueCodes = { type: 'array', items: { enum: SYNTHESIS_ISSUE_CODES }, uniqueItems: true } as const;
export type SynthesisStage = 'system-discovery' | 'system-challenge' | 'subsystem-discovery' | 'reconciliation' | 'verification';
export interface SystemCandidate {
    candidateKey: string;
    kind: 'system';
    name: string;
    responsibility: string;
    confidence: number;
    ambiguityCodes: SynthesisIssueCode[];
    evidenceRefs: string[];
}
export interface SubtreeCandidate {
    candidateKey: string;
    kind: 'subsystem' | 'component';
    parentCandidateKey: string;
    name: string;
    responsibility: string;
    confidence: number;
    ambiguityCodes: SynthesisIssueCode[];
    evidenceRefs: string[];
    /** Direct implementation facts claimed by this node, a subset of evidenceRefs. */
    ownershipEvidenceRefs: string[];
}
export type ChallengeDecision = {
    action: 'keep' | 'merge' | 'split' | 'reject';
    sourceKeys: string[];
    systems: SystemCandidate[];
    evidenceRefs: string[];
};
export interface SynthesisFinding {
    candidateKeys: string[];
    evidenceRefs: string[];
    status: 'supported' | 'uncertain' | 'contradicted';
    code: SynthesisIssueCode;
}
export interface UnresolvedCandidate { candidateKey: string; code: SynthesisIssueCode }
export interface SynthesisStageContext {
    /** All challenge input candidates; empty outside System Challenge. */
    systems: SystemCandidate[];
    /** Required for per-System discovery. */
    subjectSystemKey: string | null;
    /** Required for reconciliation and verification. */
    subtrees: SubsystemDiscoveryResult[];
    /** Only targeted verification may supply candidate targets. */
    targetCandidateKeys: string[];
    /** Typed issue for targeted verification; omitted outside verification. */
    boundaryCode?: SynthesisIssueCode;
}
export interface SynthesisStageRequest {
    schemaVersion: 1;
    stage: SynthesisStage;
    stageVersion: 2;
    parentPacketFingerprint: string;
    view: ArchitectureEvidenceView;
    context: SynthesisStageContext;
}
export const synthesisStageRequestSchema = { type: 'object', additionalProperties: false,
    required: ['schemaVersion', 'stage', 'stageVersion', 'parentPacketFingerprint', 'view', 'context'],
    properties: { schemaVersion: { const: 1 }, stage: { enum: ['system-discovery', 'system-challenge',
        'subsystem-discovery', 'reconciliation', 'verification'] }, stageVersion: { const: 2 },
        parentPacketFingerprint: nonempty, view: { type: 'object' }, context: { type: 'object' } },
} as const;
interface StageResultBase { schemaVersion: 1; stageVersion: 2; parentPacketFingerprint: string; viewId: string }
export interface SystemDiscoveryResult extends StageResultBase { stage: 'system-discovery'; systems: SystemCandidate[] }
export interface SystemChallengeResult extends StageResultBase { stage: 'system-challenge'; decisions: ChallengeDecision[] }
export interface SubsystemDiscoveryResult extends StageResultBase {
    stage: 'subsystem-discovery'; systemKey: string; nodes: SubtreeCandidate[];
    subdivisionAssessment: { confidence: number; ambiguityCodes: SynthesisIssueCode[] };
}
export interface ReconciliationResult extends StageResultBase { stage: 'reconciliation'; findings: SynthesisFinding[]; unresolved: UnresolvedCandidate[] }
export interface VerificationResult extends StageResultBase { stage: 'verification'; findings: SynthesisFinding[] }
export type SynthesisStageResult = SystemDiscoveryResult | SystemChallengeResult | SubsystemDiscoveryResult |
    ReconciliationResult | VerificationResult;

/** Provider JSON schemas reject surplus fields; domain validators additionally resolve cross-stage references. */
const refs = { type: 'array', items: nonempty, uniqueItems: true } as const;
const candidate = { type: 'object', additionalProperties: false,
    required: ['candidateKey', 'kind', 'name', 'responsibility', 'confidence', 'ambiguityCodes', 'evidenceRefs'],
    properties: { candidateKey: { type: 'string', pattern: '^candidate:[A-Za-z0-9._-]+$' }, kind: { const: 'system' },
        name: shortName, responsibility: shortResponsibility, confidence: { type: 'number', minimum: 0, maximum: 1 },
        ambiguityCodes: issueCodes, evidenceRefs: { ...refs, minItems: 1 } } } as const;
const subtreeNode = { type: 'object', additionalProperties: false,
    required: ['candidateKey', 'kind', 'parentCandidateKey', 'name', 'responsibility',
        'confidence', 'ambiguityCodes', 'evidenceRefs', 'ownershipEvidenceRefs'],
    properties: { candidateKey: candidate.properties.candidateKey, kind: { enum: ['subsystem', 'component'] },
        parentCandidateKey: candidate.properties.candidateKey, name: shortName, responsibility: shortResponsibility,
        confidence: candidate.properties.confidence, ambiguityCodes: issueCodes,
        evidenceRefs: { ...refs, minItems: 1 }, ownershipEvidenceRefs: { ...refs, minItems: 1 } } } as const;
const finding = { type: 'object', additionalProperties: false,
    required: ['candidateKeys', 'evidenceRefs', 'status', 'code'],
    properties: { candidateKeys: { ...refs, minItems: 1 }, evidenceRefs: { ...refs, minItems: 1 },
        status: { enum: ['supported', 'uncertain', 'contradicted'] }, code: { enum: SYNTHESIS_ISSUE_CODES } } } as const;
const base = { schemaVersion: { const: 1 }, stageVersion: { const: 2 }, parentPacketFingerprint: nonempty, viewId: nonempty } as const;
const schema = (stage: SynthesisStage, name: string, property: unknown) => ({ type: 'object', additionalProperties: false,
    required: ['schemaVersion', 'stageVersion', 'parentPacketFingerprint', 'viewId', 'stage', name],
    properties: { ...base, stage: { const: stage }, [name]: property } });
export const synthesisStageResultSchemas = {
    'system-discovery': schema('system-discovery', 'systems', { type: 'array', items: candidate }),
    'system-challenge': schema('system-challenge', 'decisions', { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['action', 'sourceKeys', 'systems', 'evidenceRefs'], properties: {
            action: { enum: ['keep', 'merge', 'split', 'reject'] }, sourceKeys: { ...refs, minItems: 1 },
            systems: { type: 'array', items: candidate }, evidenceRefs: { ...refs, minItems: 1 },
        } } }),
    'subsystem-discovery': { type: 'object', additionalProperties: false,
        required: ['schemaVersion', 'stageVersion', 'parentPacketFingerprint', 'viewId', 'stage', 'systemKey', 'nodes', 'subdivisionAssessment'],
        properties: { ...base, stage: { const: 'subsystem-discovery' }, systemKey: nonempty, nodes: { type: 'array', items: subtreeNode },
            subdivisionAssessment: { type: 'object', additionalProperties: false,
                required: ['confidence', 'ambiguityCodes'], properties: {
                    confidence: candidate.properties.confidence, ambiguityCodes: issueCodes } } } },
    reconciliation: { type: 'object', additionalProperties: false,
        required: ['schemaVersion', 'stageVersion', 'parentPacketFingerprint', 'viewId', 'stage', 'findings', 'unresolved'],
        properties: { ...base, stage: { const: 'reconciliation' }, findings: { type: 'array', items: finding },
            unresolved: { type: 'array', items: { type: 'object', additionalProperties: false,
                required: ['candidateKey', 'code'], properties: { candidateKey: candidate.properties.candidateKey,
                    code: { enum: SYNTHESIS_ISSUE_CODES } } } } } },
    verification: schema('verification', 'findings', { type: 'array', items: finding }),
} as const;

function invalid(detail: string): never { throw new Error(`Invalid hierarchical synthesis: ${detail}`); }
function record(value: unknown, at: string): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(at);
    return value as Record<string, unknown>;
}
function exact(value: unknown, names: readonly string[], at: string): void {
    const data = record(value, at);
    if (Object.keys(data).length !== names.length || names.some(name => !Object.hasOwn(data, name))) invalid(`${at} fields`);
}
function label(value: unknown, at: string): string {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim()) invalid(at);
    return value;
}
function shortLabel(value: unknown, at: string, max: number): void {
    const text = label(value, at);
    if (text.length > max || /[\x00-\x1f\x7f]/.test(text)) invalid(at);
}
function strings(value: unknown, at: string, min = 0): string[] {
    if (!Array.isArray(value) || value.length < min) invalid(at);
    const result = value.map((item, i) => label(item, `${at}[${i}]`));
    if (new Set(result).size !== result.length) invalid(`duplicate ${at}`);
    return result;
}
function key(value: unknown, at: string): string {
    const result = label(value, at);
    if (!/^candidate:[A-Za-z0-9._-]+$/.test(result)) invalid(at);
    return result;
}
function confidence(value: unknown, at: string): void {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) invalid(at);
}
function codes(value: unknown, at: string): void {
    if (!Array.isArray(value) || new Set(value).size !== value.length ||
        value.some(code => typeof code !== 'string' || !(SYNTHESIS_ISSUE_CODES as readonly string[]).includes(code))) invalid(at);
}
function evidence(value: unknown, allowed: Set<string>, at: string, min = 1): void {
    if (strings(value, at, min).some(ref => !allowed.has(ref))) invalid(`unknown ${at}`);
}
function system(value: unknown, allowed: Set<string>, at: string): SystemCandidate {
    exact(value, candidate.required, at);
    const item = value as SystemCandidate;
    key(item.candidateKey, `${at}.candidateKey`);
    if (item.kind !== 'system') invalid(`${at}.kind`);
    shortLabel(item.name, `${at}.name`, 80);
    shortLabel(item.responsibility, `${at}.responsibility`, 160);
    confidence(item.confidence, `${at}.confidence`);
    codes(item.ambiguityCodes, `${at}.ambiguityCodes`);
    evidence(item.evidenceRefs, allowed, `${at}.evidenceRefs`);
    return item;
}
function systems(values: unknown, allowed: Set<string>, at: string): SystemCandidate[] {
    if (!Array.isArray(values)) invalid(at);
    const result = values.map((item, i) => system(item, allowed, `${at}[${i}]`));
    strings(result.map(item => item.candidateKey), `${at} keys`);
    return result;
}
function subtree(value: unknown, systemKey: string, allowed: Set<string>, at: string): SubsystemDiscoveryResult {
    const data = record(value, at);
    if (data.systemKey !== systemKey || !Array.isArray(data.nodes)) invalid(`${at}.systemKey or nodes`);
    exact(data.subdivisionAssessment, ['confidence', 'ambiguityCodes'], `${at}.subdivisionAssessment`);
    const assessment = data.subdivisionAssessment as SubsystemDiscoveryResult['subdivisionAssessment'];
    confidence(assessment.confidence, `${at}.subdivisionAssessment.confidence`);
    codes(assessment.ambiguityCodes, `${at}.subdivisionAssessment.ambiguityCodes`);
    const nodes = data.nodes.map((raw, i) => {
        const where = `${at}.nodes[${i}]`;
        exact(raw, subtreeNode.required, where);
        const node = raw as SubtreeCandidate;
        key(node.candidateKey, `${where}.candidateKey`); key(node.parentCandidateKey, `${where}.parentCandidateKey`);
        if (node.kind !== 'subsystem' && node.kind !== 'component') invalid(`${where}.kind`);
        shortLabel(node.name, `${where}.name`, 80);
        shortLabel(node.responsibility, `${where}.responsibility`, 160);
        confidence(node.confidence, `${where}.confidence`); codes(node.ambiguityCodes, `${where}.ambiguityCodes`);
        evidence(node.evidenceRefs, allowed, `${where}.evidenceRefs`);
        evidence(node.ownershipEvidenceRefs, allowed, `${where}.ownershipEvidenceRefs`);
        if (node.ownershipEvidenceRefs.some(ref => !node.evidenceRefs.includes(ref))) invalid(`${where} ownership outside evidence`);
        return node;
    });
    strings(nodes.map(node => node.candidateKey), `${at} candidate keys`);
    if (nodes.some(node => node.candidateKey === systemKey)) invalid(`${at} reuses System key`);
    const kinds = new Map<string, string>([[systemKey, 'system'], ...nodes.map(node => [node.candidateKey, node.kind] as const)]);
    for (const node of nodes) if (kinds.get(node.parentCandidateKey) !== (node.kind === 'subsystem' ? 'system' : 'subsystem')) invalid(`${at} parent`);
    if (!nodes.some(node => node.kind === 'subsystem') && nodes.length) invalid(`${at} components without Subsystem`);
    return data as unknown as SubsystemDiscoveryResult;
}
function candidateIndex(context: SynthesisStageContext): Set<string> {
    const keys = [...context.systems.map(item => item.candidateKey), ...context.subtrees.flatMap(tree => tree.nodes.map(item => item.candidateKey))];
    strings(keys, 'cross-stage candidate keys');
    return new Set(keys);
}
export function validateSynthesisStageRequest(request: SynthesisStageRequest, packet: ArchitectureEvidencePacket): void {
    exact(request, ['schemaVersion', 'stage', 'stageVersion', 'parentPacketFingerprint', 'view', 'context'], 'request');
    if (request.schemaVersion !== 1 || request.stageVersion !== SYNTHESIS_STAGE_VERSION ||
        !Object.hasOwn(synthesisStageResultSchemas, request.stage)) invalid('request stage/version');
    validateArchitectureEvidenceView(request.view, packet);
    if (request.parentPacketFingerprint !== packet.inputFingerprint) invalid('request parent packet');
    exact(request.context, request.context.boundaryCode === undefined ?
        ['systems', 'subjectSystemKey', 'subtrees', 'targetCandidateKeys'] :
        ['systems', 'subjectSystemKey', 'subtrees', 'targetCandidateKeys', 'boundaryCode'], 'request context');
    const allRefs = new Set(packet.items.map(item => item.id));
    systems(request.context.systems, allRefs, 'request systems');
    if (!Array.isArray(request.context.subtrees)) invalid('request subtrees');
    for (const [i, tree] of request.context.subtrees.entries()) {
        exact(tree, synthesisStageResultSchemas['subsystem-discovery'].required, `request subtree[${i}]`);
        if (tree.stage !== 'subsystem-discovery' || tree.stageVersion !== SYNTHESIS_STAGE_VERSION || tree.schemaVersion !== 1 ||
            tree.parentPacketFingerprint !== packet.inputFingerprint) invalid('request subtree identity');
        label(tree.viewId, 'request subtree view identity');
        if (!request.context.systems.some(item => item.candidateKey === tree.systemKey)) invalid('request subtree System');
        subtree(tree, tree.systemKey, allRefs, `request subtree[${i}]`);
    }
    strings(request.context.subtrees.map(tree => tree.systemKey), 'request subtree System keys');
    const keys = candidateIndex(request.context);
    const targets = strings(request.context.targetCandidateKeys, 'request targets');
    if (targets.some(item => !keys.has(item))) invalid('unknown request target');
    const subject = request.context.subjectSystemKey;
    if (subject !== null) key(subject, 'request subject');
    if (request.context.boundaryCode !== undefined) {
        if (request.stage !== 'verification') invalid('question outside verification');
        if (!SYNTHESIS_ISSUE_CODES.includes(request.context.boundaryCode)) invalid('verification code');
    }
    switch (request.stage) {
        case 'system-discovery':
            if (request.context.systems.length || request.context.subtrees.length || targets.length || subject !== null) invalid('discovery context'); break;
        case 'system-challenge':
            if (!request.context.systems.length || request.context.subtrees.length || targets.length || subject !== null) invalid('challenge context'); break;
        case 'subsystem-discovery':
            if (!request.context.systems.some(item => item.candidateKey === subject) || request.context.subtrees.length || targets.length) invalid('subsystem context'); break;
        case 'reconciliation':
            if (!request.context.systems.length || subject !== null || targets.length ||
                request.context.subtrees.length !== request.context.systems.length) invalid('reconciliation context'); break;
        case 'verification':
            if (!request.context.systems.length || subject !== null || !targets.length || !request.context.boundaryCode) invalid('verification context'); break;
    }
}
export function parseSynthesisStageResult(input: unknown, request: SynthesisStageRequest,
    packet: ArchitectureEvidencePacket): SynthesisStageResult {
    validateSynthesisStageRequest(request, packet);
    const data = record(input, 'result');
    const schema = synthesisStageResultSchemas[request.stage];
    exact(data, schema.required, 'result');
    if (data.schemaVersion !== 1 || data.stageVersion !== SYNTHESIS_STAGE_VERSION || data.stage !== request.stage ||
        data.parentPacketFingerprint !== packet.inputFingerprint || data.viewId !== request.view.viewId) invalid('result stage/identity');
    const allowed = new Set(request.view.items.map(item => item.id));
    if (request.stage === 'system-discovery') {
        const discovered = systems(data.systems, allowed, 'result systems');
        const byId = new Map(request.view.items.map(item => [item.id, item]));
        for (const [index, candidate] of discovered.entries()) {
            if (!candidate.evidenceRefs.some(ref => isProductionEvidencePath(byId.get(ref)!.path)))
                invalid(`result systems[${index}] lacks production evidence`);
        }
    } else if (request.stage === 'system-challenge') {
        if (!Array.isArray(data.decisions)) invalid('decisions');
        const source = new Set(request.context.systems.map(item => item.candidateKey));
        const seen: string[] = []; const output: string[] = [];
        const byId = new Map(request.view.items.map(item => [item.id, item]));
        for (const [i, raw] of data.decisions.entries()) {
            const at = `decisions[${i}]`;
            exact(raw, ['action', 'sourceKeys', 'systems', 'evidenceRefs'], at);
            const decision = raw as ChallengeDecision;
            if (!['keep', 'merge', 'split', 'reject'].includes(decision.action)) invalid(`${at}.action`);
            const sourceKeys = strings(decision.sourceKeys, `${at}.sourceKeys`, 1);
            if (sourceKeys.some(item => !source.has(item))) invalid(`${at} unknown source`);
            seen.push(...sourceKeys);
            const produced = systems(decision.systems, allowed, `${at}.systems`);
            output.push(...produced.map(item => item.candidateKey));
            const validShape = decision.action === 'keep' && sourceKeys.length === 1 && produced.length === 1 && produced[0].candidateKey === sourceKeys[0] ||
                decision.action === 'merge' && sourceKeys.length >= 2 && produced.length === 1 && !source.has(produced[0].candidateKey) ||
                decision.action === 'split' && sourceKeys.length === 1 && produced.length >= 2 && produced.every(item => !source.has(item.candidateKey)) ||
                decision.action === 'reject' && sourceKeys.length === 1 && produced.length === 0;
            if (!validShape) invalid(`${at} merge/split/keep/reject shape`);
            evidence(decision.evidenceRefs, allowed, `${at}.evidenceRefs`);
            for (const [j, candidate] of produced.entries()) {
                if (!candidate.evidenceRefs.some(ref => {
                    const item = byId.get(ref)!;
                    return isProductionEvidencePath(item.path) && item.kind !== 'topology' && item.kind !== 'configuration' &&
                        (item.sourceEvidenceIds.length > 0 || item.kind === 'entrypoint' ||
                            item.kind === 'framework' && item.concept === 'manifest-extension');
                })) invalid(`${at}.systems[${j}] lacks directly source-backed production behavior`);
            }
        }
        strings(seen, 'challenge source keys'); strings(output, 'challenge output keys');
        if (seen.length !== source.size) invalid('incomplete challenge coverage');
    } else if (request.stage === 'subsystem-discovery') {
        const tree = subtree(data, request.context.subjectSystemKey!, allowed, 'result');
        const otherRefs = new Set(request.context.systems.filter(system => system.candidateKey !== tree.systemKey)
            .flatMap(system => system.evidenceRefs));
        const byId = new Map(request.view.items.map(item => [item.id, item]));
        for (const node of tree.nodes) for (const ref of node.ownershipEvidenceRefs) {
            const fact = byId.get(ref)!;
            if (otherRefs.has(ref) && !request.context.systems.find(system => system.candidateKey === tree.systemKey)!.evidenceRefs.includes(ref))
                invalid('ownership claims another System supporting fact');
            if (!isProductionEvidencePath(fact.path) || fact.kind === 'topology' || fact.kind === 'configuration' ||
                fact.kind === 'dependency') invalid('ownership requires direct production behavior');
        }
    } else {
        if (!Array.isArray(data.findings)) invalid('findings');
        const known = candidateIndex(request.context);
        if (request.stage === 'reconciliation') {
            if (!Array.isArray(data.unresolved)) invalid('unresolved');
            const unresolved = data.unresolved.map((raw, i) => {
                exact(raw, ['candidateKey', 'code'], `unresolved[${i}]`);
                const item = raw as UnresolvedCandidate;
                if (!known.has(key(item.candidateKey, `unresolved[${i}].candidateKey`)) ||
                    !SYNTHESIS_ISSUE_CODES.includes(item.code)) invalid(`unresolved[${i}]`);
                return item.candidateKey;
            });
            strings(unresolved, 'unresolved candidate keys');
        }
        for (const [i, raw] of data.findings.entries()) {
            const at = `findings[${i}]`;
            exact(raw, finding.required, at);
            const item = raw as SynthesisFinding;
            const candidates = strings(item.candidateKeys, `${at}.candidateKeys`, 1);
            if (candidates.some(candidate => !known.has(candidate)) ||
                request.stage === 'verification' && candidates.some(candidate => !request.context.targetCandidateKeys.includes(candidate))) invalid(`${at} unknown candidate`);
            evidence(item.evidenceRefs, allowed, `${at}.evidenceRefs`);
            if (!['supported', 'uncertain', 'contradicted'].includes(item.status)) invalid(`${at}.status`);
            if (!SYNTHESIS_ISSUE_CODES.includes(item.code)) invalid(`${at}.code`);
            if (request.stage === 'verification' && item.code !== request.context.boundaryCode) invalid(`${at} verification code`);
        }
    }
    return data as unknown as SynthesisStageResult;
}

export interface ArchitectureProposalAssemblyInput {
    parentPacketFingerprint: string;
    summary: string;
    systems: SystemCandidate[];
    subtrees: SubsystemDiscoveryResult[];
    reconciliation: ReconciliationResult;
    verifications: VerificationResult[];
}
/** Assembly rechecks all provenance and creates proposal-only keys; canonical IDs remain developer-authored. */
export function assembleArchitectureProposal(input: ArchitectureProposalAssemblyInput,
    packet: ArchitectureEvidencePacket): ArchitectureProposal {
    validateArchitectureEvidencePacket(packet);
    exact(input, ['parentPacketFingerprint', 'summary', 'systems', 'subtrees', 'reconciliation', 'verifications'], 'assembly');
    if (input.parentPacketFingerprint !== packet.inputFingerprint) invalid('assembly parent packet');
    label(input.summary, 'assembly summary');
    const allowed = new Set(packet.items.map(item => item.id));
    systems(input.systems, allowed, 'assembly systems');
    if (!Array.isArray(input.subtrees) || input.subtrees.length !== input.systems.length) invalid('assembly subtrees');
    const allKeys = [...input.systems.map(item => item.candidateKey)];
    for (const [i, tree] of input.subtrees.entries()) {
        if (!input.systems.some(item => item.candidateKey === tree.systemKey) || tree.stage !== 'subsystem-discovery' ||
            tree.schemaVersion !== 1 || tree.stageVersion !== SYNTHESIS_STAGE_VERSION || tree.parentPacketFingerprint !== packet.inputFingerprint) invalid('assembly subtree identity');
        subtree(tree, tree.systemKey, allowed, `assembly subtree[${i}]`);
        allKeys.push(...tree.nodes.map(item => item.candidateKey));
    }
    strings(allKeys, 'assembly candidate keys');
    const treeKeys = input.subtrees.map(item => item.systemKey);
    strings(treeKeys, 'assembly subtree systems');
    const known = new Set(allKeys);
    const checkAnalysis = (result: ReconciliationResult | VerificationResult, stage: 'reconciliation' | 'verification') => {
        const required = synthesisStageResultSchemas[stage].required;
        exact(result, required, `assembly ${stage}`);
        if (result.stage !== stage || result.schemaVersion !== 1 || result.stageVersion !== SYNTHESIS_STAGE_VERSION ||
            result.parentPacketFingerprint !== packet.inputFingerprint) invalid(`assembly ${stage} identity`);
        label(result.viewId, `assembly ${stage} view`);
        if (!Array.isArray(result.findings)) invalid(`assembly ${stage} findings`);
        for (const item of result.findings) {
            exact(item, finding.required, `assembly ${stage} finding`);
            if (strings(item.candidateKeys, 'assembly finding keys', 1).some(key => !known.has(key))) invalid('assembly unknown candidate');
            evidence(item.evidenceRefs, allowed, 'assembly finding evidence');
            if (!['supported', 'uncertain', 'contradicted'].includes(item.status)) invalid('assembly finding status');
            if (!SYNTHESIS_ISSUE_CODES.includes(item.code)) invalid('assembly finding code');
        }
    };
    checkAnalysis(input.reconciliation, 'reconciliation');
    if (!Array.isArray(input.reconciliation.unresolved)) invalid('assembly unresolved');
    for (const item of input.reconciliation.unresolved) {
        exact(item, ['candidateKey', 'code'], 'assembly unresolved item');
        if (!known.has(key(item.candidateKey, 'assembly unresolved key')) || !SYNTHESIS_ISSUE_CODES.includes(item.code))
            invalid('assembly unresolved item');
    }
    strings(input.reconciliation.unresolved.map(item => item.candidateKey), 'assembly unresolved keys');
    if (!Array.isArray(input.verifications)) invalid('assembly verifications');
    for (const result of input.verifications) checkAnalysis(result, 'verification');
    const candidates: (SystemCandidate | SubtreeCandidate)[] = [...input.systems, ...input.subtrees.flatMap(item => item.nodes)];
    const proposalKeys = new Map(candidates.map((item, i) => [item.candidateKey, `proposal:stage-${i + 1}`]));
    const explain = (code: SynthesisIssueCode): string => code.replaceAll('-', ' ');
    const nodes: ProposedArchitectureNode[] = candidates.map(item => ({
        proposalKey: proposalKeys.get(item.candidateKey)!, kind: item.kind, name: item.name, purpose: item.responsibility,
        parentProposalKey: item.kind === 'system' ? null : proposalKeys.get(item.parentCandidateKey)!,
        confidence: item.confidence, rationale: `${item.kind} ${item.name}: ${item.responsibility}.` +
            (item.kind === 'system' ? '' : ` Parent: ${candidates.find(parent => parent.candidateKey === item.parentCandidateKey)!.name}.`) +
            (item.ambiguityCodes.length ? ` Review ${item.ambiguityCodes.map(explain).join(', ')}.` : '') +
            ` Source: ${item.evidenceRefs.map(ref => packet.items.find(fact => fact.id === ref)!.path).join(', ')}.`,
        evidenceRefs: item.evidenceRefs, evidence: item.evidenceRefs.map(ref => packet.items.find(fact => fact.id === ref)!.path),
    }));
    const unresolved = new Set(input.reconciliation.unresolved.map(item => item.candidateKey));
    for (const verification of input.verifications) for (const finding of verification.findings)
        if (finding.status !== 'supported') finding.candidateKeys.forEach(key => unresolved.add(key));
    const openFindings = [...input.reconciliation.findings, ...input.verifications.flatMap(result => result.findings)]
        .filter(item => item.status !== 'supported' && item.candidateKeys.some(key => unresolved.has(key)));
    const questions = openFindings
        .map(item => `${item.candidateKeys.map(key => candidates.find(candidate => candidate.candidateKey === key)?.name ?? key).join(' / ')}: ${explain(item.code)} (${item.evidenceRefs.map(ref => packet.items.find(fact => fact.id === ref)!.path).join(', ')}).`);
    const resolved = new Set(input.verifications.flatMap(result => result.findings.filter(item => item.status === 'supported')
        .flatMap(item => item.candidateKeys.map(key => `${key}:${item.code}`))));
    for (const item of candidates) for (const code of item.ambiguityCodes)
        if (!resolved.has(`${item.candidateKey}:${code}`))
            questions.push(`${item.name}: review ${explain(code)} (${item.evidenceRefs.map(ref => packet.items.find(fact => fact.id === ref)!.path).join(', ')}).`);
    for (const tree of input.subtrees) for (const code of tree.subdivisionAssessment.ambiguityCodes)
        if (!resolved.has(`${tree.systemKey}:${code}`))
            questions.push(`${input.systems.find(system => system.candidateKey === tree.systemKey)!.name}: review subdivision ${explain(code)}.`);
    const explained = new Set(openFindings.flatMap(item => item.candidateKeys));
    for (const item of input.reconciliation.unresolved) if (!explained.has(item.candidateKey))
        questions.push(`${candidates.find(candidate => candidate.candidateKey === item.candidateKey)?.name ?? item.candidateKey}: review ${explain(item.code)}.`);
    return parseArchitectureProposal({ schemaVersion: 1, summary: input.summary, needsMoreEvidence: false,
        nodes, unassignedEvidenceRefs: [], openQuestions: [...new Set(questions)], evidenceRequests: [] }, packet);
}

export type AnalysisProgressStage = 'collecting-evidence' | 'planning-evidence' | 'building-skeleton' |
    SynthesisStage | 'preparing-review' | 'completed' | 'failed' | 'cancelled';
export type AnalysisProgressStatus = 'started' | 'completed' | 'retrying' | 'failed' | 'cancelled';
export interface AnalysisProgressEvent {
    stage: AnalysisProgressStage;
    status: AnalysisProgressStatus;
    elapsedMs: number;
    stageElapsedMs?: number;
    message: string;
    callPurpose?: SynthesisStage | 'model-warm-up';
    subject?: string;
    completedUnits?: number;
    totalUnits?: number;
    providerModelLabel?: string;
    attempt?: number;
}
const progressStages: AnalysisProgressStage[] = ['collecting-evidence', 'planning-evidence', 'building-skeleton',
    'system-discovery', 'system-challenge', 'subsystem-discovery', 'reconciliation', 'verification',
    'preparing-review', 'completed', 'failed', 'cancelled'];
export function parseAnalysisProgressEvent(input: unknown): AnalysisProgressEvent {
    const data = record(input, 'progress');
    const allowed = ['stage', 'status', 'elapsedMs', 'stageElapsedMs', 'message', 'callPurpose', 'subject', 'completedUnits', 'totalUnits', 'providerModelLabel', 'attempt'];
    if (Object.keys(data).some(key => !allowed.includes(key)) ||
        !['stage', 'status', 'elapsedMs', 'message'].every(key => Object.hasOwn(data, key))) invalid('progress fields');
    if (!progressStages.includes(data.stage as AnalysisProgressStage) ||
        !['started', 'completed', 'retrying', 'failed', 'cancelled'].includes(data.status as string)) invalid('progress stage/status');
    if (data.stage === 'completed' && data.status !== 'completed' || data.stage === 'failed' && data.status !== 'failed' ||
        data.stage === 'cancelled' && data.status !== 'cancelled') invalid('terminal progress status');
    if (data.callPurpose !== undefined && ![...progressStages, 'model-warm-up'].includes(data.callPurpose as string)) invalid('progress call purpose');
    for (const key of ['elapsedMs', 'stageElapsedMs', 'completedUnits', 'totalUnits', 'attempt'] as const) {
        const value = data[key];
        if (value !== undefined && (!Number.isSafeInteger(value) || (value as number) < (key === 'attempt' ? 1 : 0))) invalid(`progress ${key}`);
    }
    if (data.totalUnits !== undefined && data.completedUnits !== undefined && (data.completedUnits as number) > (data.totalUnits as number)) invalid('progress units');
    const safeText = (value: unknown, at: string, max: number) => {
        const text = label(value, at);
        if (text.length > max || /[\x00-\x1f\x7f]/.test(text)) invalid(at);
    };
    safeText(data.message, 'progress message', 240);
    for (const key of ['subject', 'providerModelLabel'] as const) if (data[key] !== undefined) safeText(data[key], `progress ${key}`, 120);
    return data as unknown as AnalysisProgressEvent;
}
