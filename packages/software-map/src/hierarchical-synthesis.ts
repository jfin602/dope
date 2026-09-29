import { ArchitectureEvidenceItem, ArchitectureEvidencePacket, ArchitectureProposal, ProposedArchitectureNode,
    validateArchitectureEvidencePacket, parseArchitectureProposal } from './synthesis';

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
}
export interface SynthesisProvider {
    capabilities(): Promise<SynthesisCapabilities>;
    estimateTokens(input: string): Promise<number>;
    runStage(request: SynthesisStageRequest): Promise<unknown>;
}
export function usableEvidenceTokens(capability: SynthesisCapabilities): number {
    exact(capability, ['modelLabel', 'contextWindowTokens', 'maxInputTokens', 'reservedInstructionTokens',
        'reservedOutputTokens', 'reservedOverheadTokens', 'tokenEstimate'], 'capabilities');
    label(capability.modelLabel, 'modelLabel');
    for (const key of ['contextWindowTokens', 'maxInputTokens', 'reservedInstructionTokens',
        'reservedOutputTokens', 'reservedOverheadTokens'] as const) {
        const value = capability[key];
        if (!Number.isSafeInteger(value) || value < (key === 'reservedOverheadTokens' ? 0 : 1)) invalid(key);
    }
    if (capability.tokenEstimate !== 'exact' && capability.tokenEstimate !== 'conservative') invalid('tokenEstimate');
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

export const SYNTHESIS_STAGE_VERSION = 1;
const nonempty = { type: 'string', minLength: 1 } as const;
export type SynthesisStage = 'system-discovery' | 'system-challenge' | 'subsystem-discovery' | 'reconciliation' | 'verification';
export interface SystemCandidate {
    candidateKey: string;
    kind: 'system';
    name: string;
    purpose: string;
    confidence: number;
    uncertainty: string[];
    evidenceRefs: string[];
}
export interface SubtreeCandidate {
    candidateKey: string;
    kind: 'subsystem' | 'component';
    parentCandidateKey: string;
    name: string;
    purpose: string;
    confidence: number;
    uncertainty: string[];
    evidenceRefs: string[];
}
export type ChallengeDecision = {
    action: 'keep' | 'merge' | 'split' | 'reject';
    sourceKeys: string[];
    systems: SystemCandidate[];
    rationale: string;
    evidenceRefs: string[];
};
export interface SynthesisFinding {
    candidateKeys: string[];
    evidenceRefs: string[];
    status: 'supported' | 'uncertain' | 'contradicted';
    message: string;
}
export interface SynthesisStageContext {
    /** All challenge input candidates; empty outside System Challenge. */
    systems: SystemCandidate[];
    /** Required for per-System discovery. */
    subjectSystemKey: string | null;
    /** Required for reconciliation and verification. */
    subtrees: SubsystemDiscoveryResult[];
    /** Only targeted verification may supply candidate targets. */
    targetCandidateKeys: string[];
}
export interface SynthesisStageRequest {
    schemaVersion: 1;
    stage: SynthesisStage;
    stageVersion: 1;
    parentPacketFingerprint: string;
    view: ArchitectureEvidenceView;
    context: SynthesisStageContext;
}
export const synthesisStageRequestSchema = { type: 'object', additionalProperties: false,
    required: ['schemaVersion', 'stage', 'stageVersion', 'parentPacketFingerprint', 'view', 'context'],
    properties: { schemaVersion: { const: 1 }, stage: { enum: ['system-discovery', 'system-challenge',
        'subsystem-discovery', 'reconciliation', 'verification'] }, stageVersion: { const: 1 },
        parentPacketFingerprint: nonempty, view: { type: 'object' }, context: { type: 'object' } },
} as const;
interface StageResultBase { schemaVersion: 1; stageVersion: 1; parentPacketFingerprint: string; viewId: string }
export interface SystemDiscoveryResult extends StageResultBase { stage: 'system-discovery'; systems: SystemCandidate[] }
export interface SystemChallengeResult extends StageResultBase { stage: 'system-challenge'; decisions: ChallengeDecision[] }
export interface SubsystemDiscoveryResult extends StageResultBase { stage: 'subsystem-discovery'; systemKey: string; nodes: SubtreeCandidate[] }
export interface ReconciliationResult extends StageResultBase { stage: 'reconciliation'; findings: SynthesisFinding[]; unresolvedCandidateKeys: string[] }
export interface VerificationResult extends StageResultBase { stage: 'verification'; findings: SynthesisFinding[] }
export type SynthesisStageResult = SystemDiscoveryResult | SystemChallengeResult | SubsystemDiscoveryResult |
    ReconciliationResult | VerificationResult;

/** Provider JSON schemas reject surplus fields; domain validators additionally resolve cross-stage references. */
const refs = { type: 'array', items: nonempty, uniqueItems: true } as const;
const candidate = { type: 'object', additionalProperties: false,
    required: ['candidateKey', 'kind', 'name', 'purpose', 'confidence', 'uncertainty', 'evidenceRefs'],
    properties: { candidateKey: { type: 'string', pattern: '^candidate:[A-Za-z0-9._-]+$' }, kind: { const: 'system' },
        name: nonempty, purpose: nonempty, confidence: { type: 'number', minimum: 0, maximum: 1 },
        uncertainty: refs, evidenceRefs: { ...refs, minItems: 1 } } } as const;
const subtreeNode = { type: 'object', additionalProperties: false,
    required: ['candidateKey', 'kind', 'parentCandidateKey', 'name', 'purpose', 'confidence', 'uncertainty', 'evidenceRefs'],
    properties: { ...candidate.properties, kind: { enum: ['subsystem', 'component'] }, parentCandidateKey: nonempty } } as const;
const finding = { type: 'object', additionalProperties: false,
    required: ['candidateKeys', 'evidenceRefs', 'status', 'message'],
    properties: { candidateKeys: { ...refs, minItems: 1 }, evidenceRefs: { ...refs, minItems: 1 },
        status: { enum: ['supported', 'uncertain', 'contradicted'] }, message: nonempty } } as const;
const base = { schemaVersion: { const: 1 }, stageVersion: { const: 1 }, parentPacketFingerprint: nonempty, viewId: nonempty } as const;
const schema = (stage: SynthesisStage, name: string, property: unknown) => ({ type: 'object', additionalProperties: false,
    required: ['schemaVersion', 'stageVersion', 'parentPacketFingerprint', 'viewId', 'stage', name],
    properties: { ...base, stage: { const: stage }, [name]: property } });
export const synthesisStageResultSchemas = {
    'system-discovery': schema('system-discovery', 'systems', { type: 'array', items: candidate }),
    'system-challenge': schema('system-challenge', 'decisions', { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['action', 'sourceKeys', 'systems', 'rationale', 'evidenceRefs'], properties: {
            action: { enum: ['keep', 'merge', 'split', 'reject'] }, sourceKeys: { ...refs, minItems: 1 },
            systems: { type: 'array', items: candidate }, rationale: nonempty, evidenceRefs: { ...refs, minItems: 1 },
        } } }),
    'subsystem-discovery': { type: 'object', additionalProperties: false,
        required: ['schemaVersion', 'stageVersion', 'parentPacketFingerprint', 'viewId', 'stage', 'systemKey', 'nodes'],
        properties: { ...base, stage: { const: 'subsystem-discovery' }, systemKey: nonempty, nodes: { type: 'array', items: subtreeNode } } },
    reconciliation: { type: 'object', additionalProperties: false,
        required: ['schemaVersion', 'stageVersion', 'parentPacketFingerprint', 'viewId', 'stage', 'findings', 'unresolvedCandidateKeys'],
        properties: { ...base, stage: { const: 'reconciliation' }, findings: { type: 'array', items: finding }, unresolvedCandidateKeys: refs } },
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
function evidence(value: unknown, allowed: Set<string>, at: string, min = 1): void {
    if (strings(value, at, min).some(ref => !allowed.has(ref))) invalid(`unknown ${at}`);
}
function system(value: unknown, allowed: Set<string>, at: string): SystemCandidate {
    exact(value, candidate.required, at);
    const item = value as SystemCandidate;
    key(item.candidateKey, `${at}.candidateKey`);
    if (item.kind !== 'system') invalid(`${at}.kind`);
    label(item.name, `${at}.name`); label(item.purpose, `${at}.purpose`);
    confidence(item.confidence, `${at}.confidence`);
    strings(item.uncertainty, `${at}.uncertainty`);
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
    const nodes = data.nodes.map((raw, i) => {
        const where = `${at}.nodes[${i}]`;
        exact(raw, subtreeNode.required, where);
        const node = raw as SubtreeCandidate;
        key(node.candidateKey, `${where}.candidateKey`); key(node.parentCandidateKey, `${where}.parentCandidateKey`);
        if (node.kind !== 'subsystem' && node.kind !== 'component') invalid(`${where}.kind`);
        label(node.name, `${where}.name`); label(node.purpose, `${where}.purpose`);
        confidence(node.confidence, `${where}.confidence`); strings(node.uncertainty, `${where}.uncertainty`);
        evidence(node.evidenceRefs, allowed, `${where}.evidenceRefs`);
        return node;
    });
    strings(nodes.map(node => node.candidateKey), `${at} candidate keys`);
    if (nodes.some(node => node.candidateKey === systemKey)) invalid(`${at} reuses System key`);
    const kinds = new Map<string, string>([[systemKey, 'system'], ...nodes.map(node => [node.candidateKey, node.kind] as const)]);
    for (const node of nodes) if (kinds.get(node.parentCandidateKey) !== (node.kind === 'subsystem' ? 'system' : 'subsystem')) invalid(`${at} parent`);
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
    exact(request.context, ['systems', 'subjectSystemKey', 'subtrees', 'targetCandidateKeys'], 'request context');
    const allRefs = new Set(packet.items.map(item => item.id));
    systems(request.context.systems, allRefs, 'request systems');
    if (!Array.isArray(request.context.subtrees)) invalid('request subtrees');
    for (const [i, tree] of request.context.subtrees.entries()) {
        exact(tree, synthesisStageResultSchemas['subsystem-discovery'].required, `request subtree[${i}]`);
        if (tree.stage !== 'subsystem-discovery' || tree.stageVersion !== 1 || tree.schemaVersion !== 1 ||
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
            if (!request.context.systems.length || subject !== null || !targets.length) invalid('verification context'); break;
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
        systems(data.systems, allowed, 'result systems');
    } else if (request.stage === 'system-challenge') {
        if (!Array.isArray(data.decisions)) invalid('decisions');
        const source = new Set(request.context.systems.map(item => item.candidateKey));
        const seen: string[] = []; const output: string[] = [];
        for (const [i, raw] of data.decisions.entries()) {
            const at = `decisions[${i}]`;
            exact(raw, ['action', 'sourceKeys', 'systems', 'rationale', 'evidenceRefs'], at);
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
            label(decision.rationale, `${at}.rationale`); evidence(decision.evidenceRefs, allowed, `${at}.evidenceRefs`);
        }
        strings(seen, 'challenge source keys'); strings(output, 'challenge output keys');
        if (seen.length !== source.size) invalid('incomplete challenge coverage');
    } else if (request.stage === 'subsystem-discovery') {
        subtree(data, request.context.subjectSystemKey!, allowed, 'result');
    } else {
        if (!Array.isArray(data.findings)) invalid('findings');
        const known = candidateIndex(request.context);
        if (request.stage === 'reconciliation') {
            const unresolved = strings(data.unresolvedCandidateKeys, 'unresolvedCandidateKeys');
            if (unresolved.some(item => !known.has(item))) invalid('unknown unresolved candidate');
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
            label(item.message, `${at}.message`);
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
            tree.schemaVersion !== 1 || tree.stageVersion !== 1 || tree.parentPacketFingerprint !== packet.inputFingerprint) invalid('assembly subtree identity');
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
        if (result.stage !== stage || result.schemaVersion !== 1 || result.stageVersion !== 1 ||
            result.parentPacketFingerprint !== packet.inputFingerprint) invalid(`assembly ${stage} identity`);
        label(result.viewId, `assembly ${stage} view`);
        if (!Array.isArray(result.findings)) invalid(`assembly ${stage} findings`);
        for (const item of result.findings) {
            exact(item, finding.required, `assembly ${stage} finding`);
            if (strings(item.candidateKeys, 'assembly finding keys', 1).some(key => !known.has(key))) invalid('assembly unknown candidate');
            evidence(item.evidenceRefs, allowed, 'assembly finding evidence');
            if (!['supported', 'uncertain', 'contradicted'].includes(item.status)) invalid('assembly finding status');
            label(item.message, 'assembly finding message');
        }
    };
    checkAnalysis(input.reconciliation, 'reconciliation');
    if (strings(input.reconciliation.unresolvedCandidateKeys, 'assembly unresolved').some(key => !known.has(key))) invalid('assembly unresolved candidate');
    if (!Array.isArray(input.verifications)) invalid('assembly verifications');
    for (const result of input.verifications) checkAnalysis(result, 'verification');
    const candidates: (SystemCandidate | SubtreeCandidate)[] = [...input.systems, ...input.subtrees.flatMap(item => item.nodes)];
    const proposalKeys = new Map(candidates.map((item, i) => [item.candidateKey, `proposal:stage-${i + 1}`]));
    const nodes: ProposedArchitectureNode[] = candidates.map(item => ({
        proposalKey: proposalKeys.get(item.candidateKey)!, kind: item.kind, name: item.name, purpose: item.purpose,
        parentProposalKey: item.kind === 'system' ? null : proposalKeys.get(item.parentCandidateKey)!,
        confidence: item.confidence, rationale: item.uncertainty.length ? item.uncertainty.join('; ') : item.purpose,
        evidenceRefs: item.evidenceRefs, evidence: item.evidenceRefs.map(ref => packet.items.find(fact => fact.id === ref)!.path),
    }));
    return parseArchitectureProposal({ schemaVersion: 1, summary: input.summary, needsMoreEvidence: false,
        nodes, unassignedEvidenceRefs: [], openQuestions: [], evidenceRequests: [] }, packet);
}

export type AnalysisProgressStage = 'collecting-evidence' | 'planning-evidence' | 'building-skeleton' |
    SynthesisStage | 'preparing-review' | 'completed' | 'failed' | 'cancelled';
export type AnalysisProgressStatus = 'started' | 'completed' | 'retrying' | 'failed' | 'cancelled';
export interface AnalysisProgressEvent {
    stage: AnalysisProgressStage;
    status: AnalysisProgressStatus;
    elapsedMs: number;
    message: string;
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
    const allowed = ['stage', 'status', 'elapsedMs', 'message', 'subject', 'completedUnits', 'totalUnits', 'providerModelLabel', 'attempt'];
    if (Object.keys(data).some(key => !allowed.includes(key)) ||
        !['stage', 'status', 'elapsedMs', 'message'].every(key => Object.hasOwn(data, key))) invalid('progress fields');
    if (!progressStages.includes(data.stage as AnalysisProgressStage) ||
        !['started', 'completed', 'retrying', 'failed', 'cancelled'].includes(data.status as string)) invalid('progress stage/status');
    if (data.stage === 'completed' && data.status !== 'completed' || data.stage === 'failed' && data.status !== 'failed' ||
        data.stage === 'cancelled' && data.status !== 'cancelled') invalid('terminal progress status');
    for (const key of ['elapsedMs', 'completedUnits', 'totalUnits', 'attempt'] as const) {
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
