import { ArchitectureEvidenceItem, ArchitectureEvidencePacket, ArchitectureProposal, ProposedArchitectureNode, DocumentSupport,
    validateArchitectureEvidencePacket, parseArchitectureProposal, isProductionEvidencePath,
    isDirectSystemResponsibilityEvidence } from './synthesis';

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
    runRefinement?(request: import('./refinement').TargetedRefinementRequest, signal?: AbortSignal): Promise<SynthesisStageExecution>;
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
/** Adapter-classified, safe failure. Raw provider errors must never cross this boundary. */
export class SynthesisProviderFailure extends Error {
    constructor(message: string, readonly failureClass: 'transient-transport' | 'transient-upstream' |
        'cancelled' | 'invalid-json' | 'authentication' | 'nonretryable-provider') {
        super(message);
    }
}
export interface SynthesisCallAttempt {
    callId: string;
    attemptId: string;
    retryOf?: string;
    stage: SynthesisStage | 'target-refinement';
    subject?: string;
    providerKind: SynthesisProvider['kind'];
    modelLabel: string;
    attempt: number;
    startedAt: string;
    durationMs: number;
    requestBytes: number;
    outputBytes?: number;
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    tokenMeasurement: SynthesisStageUsage['tokenMeasurement'];
    failureClass?: SynthesisProviderFailure['failureClass'] | 'invalid-stage-result' | 'provider-failure' | 'cancelled';
    reused: false;
    consumed: boolean;
}
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

export const SYNTHESIS_VIEW_VERSION = 2;
export interface ResponsibilitySignal {
    /** Rebuildable view-local planning identity, never an architecture identity. */
    key: string;
    concept: string;
    evidenceRefs: string[];
    sourceAreas: string[];
    strength?: 'behavior' | 'recurrence';
}
export interface CoverageLedgerEntry {
    cueKey: string;
    concept: string;
    evidenceRefs: string[];
    status: 'represented' | 'mapped' | 'unresolved';
    candidateKeys: string[];
    componentDescents: ComponentDescentDisposition[];
}
/** Diagnostic only: a document can annotate a cue, never create or cover one. */
export function buildCoverageLedger(packet: ArchitectureEvidencePacket, subtrees: readonly SystemSubtree[],
    recoveredKeys: ReadonlySet<string> = new Set()): CoverageLedgerEntry[] {
    const nodes = subtrees.flatMap(tree => tree.nodes.filter(node => node.kind === 'subsystem'));
    const components = subtrees.flatMap(tree => tree.nodes.filter(node => node.kind === 'component'));
    const descents = subtrees.flatMap(tree => tree.componentDescents ?? []);
    return deriveResponsibilitySignals(packet.items).map(cue => {
        const matching = nodes.filter(node => cue.evidenceRefs.some(ref => node.ownershipEvidenceRefs.includes(ref) ||
            components.some(child => child.parentCandidateKey === node.candidateKey && child.ownershipEvidenceRefs.includes(ref))));
        const covered = matching.filter(node => {
            const disposition = descents.find(item => item.subsystemKey === node.candidateKey);
            return components.some(child => child.parentCandidateKey === node.candidateKey &&
                cue.evidenceRefs.some(ref => child.ownershipEvidenceRefs.includes(ref))) ||
                disposition && ['leaf-responsibility', 'no-stable-component-boundary'].includes(disposition.kind) &&
                cue.evidenceRefs.some(ref => disposition.evidenceRefs.includes(ref));
        });
        return { cueKey: cue.key, concept: cue.concept, evidenceRefs: cue.evidenceRefs,
            status: covered.length ? covered.some(node => recoveredKeys.has(node.candidateKey)) ? 'mapped' : 'represented' : 'unresolved',
            candidateKeys: matching.map(node => node.candidateKey),
            componentDescents: descents.filter(item => matching.some(node => node.candidateKey === item.subsystemKey)) };
    });
}
export const evidenceSourceArea = (path: string): string => {
    const parts = path.split('/');
    const area = parts[0] === 'packages' || parts[0] === 'apps' || parts[0] === 'src'
        ? parts.slice(0, 2).join('/') : parts[0];
    return area.length <= 80 ? area : `${area.slice(0, 48)}:${digest(area).slice(-16)}`;
};
const genericConcepts = new Set(['application', 'backend', 'client', 'component', 'config', 'controller',
    'create', 'data', 'default', 'delete', 'fetch', 'find', 'frontend', 'handler', 'index', 'input',
    'interface', 'json', 'list', 'load', 'main', 'module', 'output', 'page', 'provider', 'read',
    'repository', 'request', 'response', 'result', 'route', 'save', 'server', 'service', 'state',
    'store', 'type', 'update', 'util', 'view', 'worker', 'write']);
/** Only recurring source-backed behavior terms across source areas; no inferred ownership. */
export function deriveResponsibilitySignals(items: readonly ArchitectureEvidenceItem[]): ResponsibilitySignal[] {
    const strong = items.filter(item => isDirectSystemResponsibilityEvidence(item) &&
        (item.kind === 'semantic' && item.relation.includes(':exported') || item.kind === 'framework' || item.kind === 'entrypoint' && item.path !== 'package.json'))
        .sort((a, b) => a.path.localeCompare(b.path) || a.id.localeCompare(b.id)).slice(0, 24)
        .map(item => ({ key: digest(['behavior', item.id]).replace('view:v1:', 'signal:v1:'),
            concept: item.kind === 'semantic' ? item.symbol : item.kind === 'framework' ? item.name :
                item.kind === 'entrypoint' ? item.role : item.path,
            evidenceRefs: [item.id], sourceAreas: [evidenceSourceArea(item.path)], strength: 'behavior' as const }));
    const concepts = new Map<string, ArchitectureEvidenceItem[]>();
    for (const item of items) {
        if (!isDirectSystemResponsibilityEvidence(item) && !(item.kind === 'framework' &&
            isProductionEvidencePath(item.path) && item.sourceEvidenceIds.length > 0 &&
            item.concept !== 'manifest-extension' && item.concept !== 'container-module' && item.concept !== 'import')) continue;
        const names = item.kind === 'semantic' ? [item.symbol] : item.kind === 'framework' ? [item.name, item.target ?? ''] : [];
        const words = new Set(names.flatMap(name => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
            .split(/[^A-Za-z0-9]+/).map(word => word.toLowerCase())
            .filter(word => word.length >= 4 && word.length <= 32 && !genericConcepts.has(word))));
        for (const word of words) {
            if (!concepts.has(word)) concepts.set(word, []);
            concepts.get(word)!.push(item);
        }
    }
    const recurring: ResponsibilitySignal[] = [...concepts].flatMap(([concept, facts]) => {
        const ordered = [...facts].sort((a, b) => evidenceSourceArea(a.path).localeCompare(evidenceSourceArea(b.path)) ||
            a.path.localeCompare(b.path) || a.id.localeCompare(b.id));
        const areas = [...new Set(ordered.map(item => evidenceSourceArea(item.path)))];
        if (areas.length < 2) return [];
        const selected = areas.slice(0, 4).flatMap(area => ordered.filter(item => evidenceSourceArea(item.path) === area).slice(0, 2));
        return [{ key: digest([concept, selected.map(item => item.id)]).replace('view:v1:', 'signal:v1:'), concept,
            evidenceRefs: selected.map(item => item.id).sort(), sourceAreas: areas.slice(0, 4), strength: 'recurrence' as const }];
    }).sort((a, b) => b.sourceAreas.length - a.sourceAreas.length || a.concept.localeCompare(b.concept)).slice(0, 8);
    return [...strong, ...recurring];
}
export interface ArchitectureEvidenceView {
    schemaVersion: 1;
    viewVersion: 2;
    /** Fingerprint of the entire deterministic packet, including refinements. */
    parentPacketFingerprint: string;
    /** Hash of version, parent fingerprint, and the complete selected evidence items. */
    viewId: string;
    items: ArchitectureEvidenceItem[];
    /** Derived hints, never parent evidence or canonical architecture. */
    responsibilitySignals: ResponsibilitySignal[];
    /** Documented context, never eligible for evidenceRefs or ownershipEvidenceRefs. */
    documents?: DocumentSupport[];
}
// View IDs are cache keys, never evidence authority. Exact item equality is checked separately.
const digest = (value: unknown) => {
    let hash = 0xcbf29ce484222325n;
    for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
        hash = (hash ^ BigInt(byte)) * 0x100000001b3n & 0xffffffffffffffffn;
    }
    return `view:v1:${hash.toString(16).padStart(16, '0')}`;
};
export function createArchitectureEvidenceView(packet: ArchitectureEvidencePacket, evidenceIds: readonly string[], stage?: SynthesisStage): ArchitectureEvidenceView {
    validateArchitectureEvidencePacket(packet);
    if (!Array.isArray(evidenceIds) || new Set(evidenceIds).size !== evidenceIds.length) invalid('view evidence IDs');
    const byId = new Map(packet.items.map(item => [item.id, item]));
    const items = evidenceIds.map(id => {
        const item = byId.get(id);
        if (!item) invalid('unknown view evidence ID');
        return item;
    });
    const ordered = [...items].sort((a, b) => a.id.localeCompare(b.id));
    const responsibilitySignals = deriveResponsibilitySignals(ordered);
    const documents = packet.documents?.filter(doc => stage === 'system-discovery' || stage === 'system-challenge' ?
        ['modules-seed', 'readme-orientation'].includes(doc.class) || packet.documents!.indexOf(doc) < 10 :
        stage === 'subsystem-discovery' || stage === 'subsystem-challenge' ?
            doc.class !== 'readme-orientation' && doc.class !== 'modules-seed' &&
            (doc.path.startsWith('docs/') || ordered.some(item => item.path.startsWith(doc.path.split('/').slice(0, 2).join('/')))) : false);
    const selectedDocuments = documents?.slice(0, stage === 'system-discovery' || stage === 'system-challenge' ? 10 : 4);
    return { schemaVersion: 1, viewVersion: SYNTHESIS_VIEW_VERSION, parentPacketFingerprint: packet.inputFingerprint,
        viewId: digest([SYNTHESIS_VIEW_VERSION, packet.inputFingerprint, ordered, responsibilitySignals, selectedDocuments]),
        items: structuredClone(ordered), responsibilitySignals,
        ...(selectedDocuments?.length ? { documents: structuredClone(selectedDocuments) } : {}) };
}
export function validateArchitectureEvidenceView(view: ArchitectureEvidenceView, packet: ArchitectureEvidencePacket, stage?: SynthesisStage): void {
    validateArchitectureEvidencePacket(packet);
    exact(view, ['schemaVersion', 'viewVersion', 'parentPacketFingerprint', 'viewId', 'items', 'responsibilitySignals',
        ...(view.documents === undefined ? [] : ['documents'])], 'view');
    if (view.schemaVersion !== 1 || view.viewVersion !== SYNTHESIS_VIEW_VERSION ||
        view.parentPacketFingerprint !== packet.inputFingerprint || !Array.isArray(view.items)) invalid('view identity');
    const expected = createArchitectureEvidenceView(packet, view.items.map(item => item?.id), stage);
    if (view.viewId !== expected.viewId || JSON.stringify(view.items) !== JSON.stringify(expected.items) ||
        JSON.stringify(view.responsibilitySignals) !== JSON.stringify(expected.responsibilitySignals) ||
        JSON.stringify(view.documents) !== JSON.stringify(expected.documents)) invalid('view items, signals or identity');
}

export const SYNTHESIS_STAGE_VERSION = 3;
const nonempty = { type: 'string', minLength: 1 } as const;
const shortName = { ...nonempty, maxLength: 80 } as const;
const shortResponsibility = { ...nonempty, maxLength: 160 } as const;
export const SYNTHESIS_ISSUE_CODES = ['insufficient-evidence', 'unclear-subdivision', 'boundary-overlap',
    'ownership-conflict', 'weak-support', 'cross-system-dependency', 'outside-system',
    'duplicate-responsibility', 'same-source-region', 'cross-subsystem-dependency', 'technical-layer-boundary'] as const;
export type SynthesisIssueCode = typeof SYNTHESIS_ISSUE_CODES[number];
const issueCodes = { type: 'array', items: { enum: SYNTHESIS_ISSUE_CODES }, uniqueItems: true } as const;
export type SynthesisStage = 'system-discovery' | 'system-challenge' | 'subsystem-discovery' | 'subsystem-challenge' |
    'component-discovery' | 'reconciliation' | 'verification';
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
export type SubsystemCandidate = SubtreeCandidate & { kind: 'subsystem' };
export type ComponentCandidate = SubtreeCandidate & { kind: 'component' };
export const COMPONENT_DESCENT_KINDS = ['leaf-responsibility', 'insufficient-evidence',
    'responsibility-belongs-elsewhere', 'no-stable-component-boundary'] as const;
export interface ComponentDescentDisposition {
    kind: typeof COMPONENT_DESCENT_KINDS[number];
    systemKey: string;
    subsystemKey: string;
    evidenceRefs: string[];
    parentPacketFingerprint: string;
    viewId: string;
}
/** Local assembly of challenged Subsystems and their Components; never a provider result. */
export interface SystemSubtree { systemKey: string; nodes: SubtreeCandidate[]; componentDescents?: ComponentDescentDisposition[] }
export type ChallengeDecision = {
    action: 'keep' | 'merge' | 'split' | 'reject';
    sourceKeys: string[];
    systems: SystemCandidate[];
    evidenceRefs: string[];
};
export type SubsystemChallengeDecision = { action: ChallengeDecision['action']; sourceKeys: string[];
    subsystems: SubsystemCandidate[]; evidenceRefs: string[] };
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
    /** Initial candidates for challenge, challenged candidates for Component descent. */
    subsystems: SubsystemCandidate[];
    subjectSubsystemKey: string | null;
    /** Required for Component descent; identifies the validated challenge output being descended. */
    challengedBy?: SubsystemChallengeResult;
    /** Required for reconciliation and verification. */
    subtrees: SystemSubtree[];
    /** Only targeted verification may supply candidate targets. */
    targetCandidateKeys: string[];
    /** Typed issue for targeted verification; omitted outside verification. */
    boundaryCode?: SynthesisIssueCode;
}
export interface SynthesisStageRequest {
    schemaVersion: 1;
    stage: SynthesisStage;
    stageVersion: 3;
    parentPacketFingerprint: string;
    view: ArchitectureEvidenceView;
    context: SynthesisStageContext;
}
export const synthesisStageRequestSchema = { type: 'object', additionalProperties: false,
    required: ['schemaVersion', 'stage', 'stageVersion', 'parentPacketFingerprint', 'view', 'context'],
    properties: { schemaVersion: { const: 1 }, stage: { enum: ['system-discovery', 'system-challenge',
        'subsystem-discovery', 'subsystem-challenge', 'component-discovery', 'reconciliation', 'verification'] }, stageVersion: { const: 3 },
        parentPacketFingerprint: nonempty, view: { type: 'object' }, context: { type: 'object' } },
} as const;
interface StageResultBase { schemaVersion: 1; stageVersion: 3; parentPacketFingerprint: string; viewId: string }
export interface SystemDiscoveryResult extends StageResultBase { stage: 'system-discovery'; systems: SystemCandidate[] }
export interface SystemChallengeResult extends StageResultBase { stage: 'system-challenge'; decisions: ChallengeDecision[] }
export interface SubsystemDiscoveryResult extends StageResultBase {
    stage: 'subsystem-discovery'; systemKey: string; subsystems: SubsystemCandidate[];
}
export interface SubsystemChallengeResult extends StageResultBase {
    stage: 'subsystem-challenge'; systemKey: string; decisions: SubsystemChallengeDecision[];
    recovered?: { cueKey: string; subsystem: SubsystemCandidate }[];
}
export interface ComponentDiscoveryResult extends StageResultBase {
    stage: 'component-discovery'; systemKey: string; subsystemKey: string; components: ComponentCandidate[];
    disposition?: ComponentDescentDisposition;
}
export interface ReconciliationResult extends StageResultBase { stage: 'reconciliation'; findings: SynthesisFinding[]; unresolved: UnresolvedCandidate[] }
export interface VerificationResult extends StageResultBase { stage: 'verification'; findings: SynthesisFinding[] }
export type SynthesisStageResult = SystemDiscoveryResult | SystemChallengeResult | SubsystemDiscoveryResult |
    SubsystemChallengeResult | ComponentDiscoveryResult | ReconciliationResult | VerificationResult;

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
const base = { schemaVersion: { const: 1 }, stageVersion: { const: 3 }, parentPacketFingerprint: nonempty, viewId: nonempty } as const;
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
        required: ['schemaVersion', 'stageVersion', 'parentPacketFingerprint', 'viewId', 'stage', 'systemKey', 'subsystems'],
        properties: { ...base, stage: { const: 'subsystem-discovery' }, systemKey: nonempty,
            subsystems: { type: 'array', items: { ...subtreeNode, properties: { ...subtreeNode.properties, kind: { const: 'subsystem' } } } } } },
    'subsystem-challenge': { type: 'object', additionalProperties: false,
        required: ['schemaVersion', 'stageVersion', 'parentPacketFingerprint', 'viewId', 'stage', 'systemKey', 'decisions'],
        properties: { ...base, stage: { const: 'subsystem-challenge' }, systemKey: nonempty,
            recovered: { type: 'array', maxItems: 4, items: { type: 'object', additionalProperties: false,
                required: ['cueKey', 'subsystem'], properties: { cueKey: nonempty,
                    subsystem: { ...subtreeNode, properties: { ...subtreeNode.properties, kind: { const: 'subsystem' } } } } } },
            decisions: { type: 'array', items: { type: 'object', additionalProperties: false,
                required: ['action', 'sourceKeys', 'subsystems', 'evidenceRefs'], properties: {
                    action: { enum: ['keep', 'merge', 'split', 'reject'] }, sourceKeys: { ...refs, minItems: 1 },
                    subsystems: { type: 'array', items: { ...subtreeNode, properties: { ...subtreeNode.properties, kind: { const: 'subsystem' } } } },
                    evidenceRefs: { ...refs, minItems: 1 } } } } } },
    'component-discovery': { type: 'object', additionalProperties: false,
        required: ['schemaVersion', 'stageVersion', 'parentPacketFingerprint', 'viewId', 'stage', 'systemKey', 'subsystemKey', 'components'],
        properties: { ...base, stage: { const: 'component-discovery' }, systemKey: nonempty, subsystemKey: nonempty,
            disposition: { type: 'object', additionalProperties: false,
                required: ['kind', 'systemKey', 'subsystemKey', 'evidenceRefs', 'parentPacketFingerprint', 'viewId'],
                properties: { kind: { enum: COMPONENT_DESCENT_KINDS }, systemKey: nonempty, subsystemKey: nonempty,
                    evidenceRefs: { ...refs, minItems: 1 }, parentPacketFingerprint: nonempty, viewId: nonempty } },
            components: { type: 'array', items: { ...subtreeNode, properties: { ...subtreeNode.properties, kind: { const: 'component' } } } } } },
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
function lowerNodes(values: unknown, kind: 'subsystem' | 'component', parent: string,
    allowed: Set<string>, packet: ArchitectureEvidencePacket, at: string): SubtreeCandidate[] {
    if (!Array.isArray(values)) invalid(at);
    const facts = new Map(packet.items.map(item => [item.id, item]));
    const nodes = values.map((raw, i) => {
        const where = `${at}[${i}]`;
        exact(raw, subtreeNode.required, where);
        const node = raw as SubtreeCandidate;
        key(node.candidateKey, `${where}.candidateKey`);
        if (node.kind !== kind || node.parentCandidateKey !== parent || node.candidateKey === parent) invalid(`${where} parent/kind`);
        shortLabel(node.name, `${where}.name`, 80);
        shortLabel(node.responsibility, `${where}.responsibility`, 160);
        confidence(node.confidence, `${where}.confidence`); codes(node.ambiguityCodes, `${where}.ambiguityCodes`);
        evidence(node.evidenceRefs, allowed, `${where}.evidenceRefs`);
        evidence(node.ownershipEvidenceRefs, allowed, `${where}.ownershipEvidenceRefs`);
        if (node.ownershipEvidenceRefs.some(ref => {
            const fact = facts.get(ref)!;
            return !node.evidenceRefs.includes(ref) || !isProductionEvidencePath(fact.path) ||
                !fact.sourceEvidenceIds.length || !(fact.kind === 'semantic' || fact.kind === 'entrypoint' ||
                    fact.kind === 'framework' && !['import', 'container-module', 'manifest-extension'].includes(fact.concept));
        })) invalid(`${where} ownership requires direct production behavior`);
        return node;
    });
    strings(nodes.map(node => node.candidateKey), `${at} candidate keys`);
    return nodes;
}
function validateDescent(value: unknown, systemKey: string, parent: SubsystemCandidate,
    allowed: Set<string>, packet: ArchitectureEvidencePacket, viewId: string): ComponentDescentDisposition {
    exact(value, synthesisStageResultSchemas['component-discovery'].properties.disposition.required, 'Component disposition');
    const item = value as ComponentDescentDisposition;
    if (!COMPONENT_DESCENT_KINDS.includes(item.kind) || item.systemKey !== systemKey ||
        item.subsystemKey !== parent.candidateKey || item.parentPacketFingerprint !== packet.inputFingerprint ||
        item.viewId !== viewId) invalid('Component disposition parent/identity/kind');
    evidence(item.evidenceRefs, allowed, 'Component disposition evidence');
    if (!item.evidenceRefs.some(ref => {
        const fact = packet.items.find(candidate => candidate.id === ref)!;
        return parent.ownershipEvidenceRefs.includes(ref) && (item.kind !== 'leaf-responsibility' ||
            !/\.(?:md|mdx)$/i.test(fact.path) && isDirectSystemResponsibilityEvidence(fact));
    }))
        invalid('Component disposition requires parent implementation evidence');
    return item;
}
function subtree(value: SystemSubtree, systemKey: string, allowed: Set<string>, packet: ArchitectureEvidencePacket, at: string): void {
    exact(value, ['systemKey', 'nodes', ...(value.componentDescents === undefined ? [] : ['componentDescents'])], at);
    if (value.systemKey !== systemKey || !Array.isArray(value.nodes)) invalid(`${at} System/nodes`);
    const subsystems = value.nodes.filter(node => node.kind === 'subsystem');
    lowerNodes(subsystems, 'subsystem', systemKey, allowed, packet, `${at}.subsystems`);
    for (const subsystem of subsystems) lowerNodes(value.nodes.filter(node => node.kind === 'component' &&
        node.parentCandidateKey === subsystem.candidateKey), 'component', subsystem.candidateKey, allowed, packet, `${at}.components`);
    if (value.nodes.some(node => node.kind !== 'subsystem' && node.kind !== 'component' ||
        node.kind === 'component' && !subsystems.some(parent => parent.candidateKey === node.parentCandidateKey))) invalid(`${at} parent`);
    if (value.componentDescents !== undefined) {
        if (!Array.isArray(value.componentDescents)) invalid(`${at} descents`);
        strings(value.componentDescents.map(item => item.subsystemKey), `${at} descent keys`);
        for (const descent of value.componentDescents) {
            const parent = subsystems.find(node => node.candidateKey === descent.subsystemKey);
            if (!parent || value.nodes.some(node => node.kind === 'component' && node.parentCandidateKey === parent.candidateKey))
                invalid(`${at} descent parent/components`);
            validateDescent(descent, systemKey, parent as SubsystemCandidate, allowed, packet, descent.viewId);
        }
    }
    strings(value.nodes.map(node => node.candidateKey), `${at} candidate keys`);
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
    validateArchitectureEvidenceView(request.view, packet, request.stage);
    if (request.parentPacketFingerprint !== packet.inputFingerprint) invalid('request parent packet');
    exact(request.context, ['systems', 'subjectSystemKey', 'subsystems', 'subjectSubsystemKey', 'subtrees',
        'targetCandidateKeys', ...(request.context.challengedBy === undefined ? [] : ['challengedBy']),
        ...(request.context.boundaryCode === undefined ? [] : ['boundaryCode'])], 'request context');
    const allRefs = new Set(packet.items.map(item => item.id));
    systems(request.context.systems, allRefs, 'request systems');
    if (!Array.isArray(request.context.subsystems)) invalid('request subsystems');
    strings(request.context.subsystems.map(item => item.candidateKey), 'request subsystem keys');
    for (const node of request.context.subsystems) lowerNodes([node], 'subsystem', node.parentCandidateKey, allRefs, packet, 'request subsystem');
    if (!Array.isArray(request.context.subtrees)) invalid('request subtrees');
    for (const [i, tree] of request.context.subtrees.entries()) {
        if (!request.context.systems.some(item => item.candidateKey === tree.systemKey)) invalid('request subtree System');
        subtree(tree, tree.systemKey, allRefs, packet, `request subtree[${i}]`);
    }
    strings(request.context.subtrees.map(tree => tree.systemKey), 'request subtree System keys');
    const keys = candidateIndex(request.context);
    const targets = strings(request.context.targetCandidateKeys, 'request targets');
    if (targets.some(item => !keys.has(item))) invalid('unknown request target');
    const subject = request.context.subjectSystemKey;
    if (subject !== null) key(subject, 'request subject');
    const subsystemSubject = request.context.subjectSubsystemKey;
    if (subsystemSubject !== null) key(subsystemSubject, 'request Subsystem subject');
    if (request.context.boundaryCode !== undefined) {
        if (request.stage !== 'verification') invalid('question outside verification');
        if (!SYNTHESIS_ISSUE_CODES.includes(request.context.boundaryCode)) invalid('verification code');
    }
    if (request.context.challengedBy !== undefined) {
        if (request.stage !== 'component-discovery') invalid('challenge output outside Component Discovery');
        const challenge = request.context.challengedBy;
        exact(challenge, [...synthesisStageResultSchemas['subsystem-challenge'].required,
            ...(challenge.recovered === undefined ? [] : ['recovered'])], 'request challenge output');
        if (challenge.stage !== 'subsystem-challenge' || challenge.schemaVersion !== 1 ||
            challenge.stageVersion !== SYNTHESIS_STAGE_VERSION || challenge.parentPacketFingerprint !== packet.inputFingerprint ||
            challenge.systemKey !== subject || !challenge.viewId || !Array.isArray(challenge.decisions)) invalid('request challenge identity');
        for (const [i, decision] of challenge.decisions.entries()) {
            exact(decision, ['action', 'sourceKeys', 'subsystems', 'evidenceRefs'], `request challenge decision[${i}]`);
            evidence(decision.evidenceRefs, allRefs, `request challenge decision[${i}].evidenceRefs`);
            strings(decision.sourceKeys, `request challenge decision[${i}].sourceKeys`, 1);
        }
        if (JSON.stringify([...challenge.decisions.flatMap(decision => decision.subsystems),
            ...(challenge.recovered ?? []).map(item => item.subsystem)]) !== JSON.stringify(request.context.subsystems))
            invalid('request challenged Subsystem set');
    }
    switch (request.stage) {
        case 'system-discovery':
            if (request.context.systems.length || request.context.subsystems.length || request.context.subtrees.length || targets.length || subject !== null || subsystemSubject !== null) invalid('discovery context'); break;
        case 'system-challenge':
            if (!request.context.systems.length || request.context.subsystems.length || request.context.subtrees.length || targets.length || subject !== null || subsystemSubject !== null) invalid('challenge context'); break;
        case 'subsystem-discovery':
            if (!request.context.systems.some(item => item.candidateKey === subject) || request.context.subsystems.length ||
                request.context.subtrees.length || targets.length || subsystemSubject !== null) invalid('subsystem context'); break;
        case 'subsystem-challenge':
            if (!request.context.systems.some(item => item.candidateKey === subject) ||
                request.context.subsystems.some(item => item.parentCandidateKey !== subject) || request.context.subtrees.length ||
                targets.length || subsystemSubject !== null) invalid('Subsystem Challenge context'); break;
        case 'component-discovery':
            if (!request.context.systems.some(item => item.candidateKey === subject) ||
                !request.context.challengedBy ||
                request.context.subsystems.some(item => item.parentCandidateKey !== subject) ||
                !request.context.subsystems.some(item => item.candidateKey === subsystemSubject && item.parentCandidateKey === subject) ||
                request.context.subtrees.length || targets.length) invalid('Component Discovery requires challenged Subsystem'); break;
        case 'reconciliation':
            if (!request.context.systems.length || request.context.subsystems.length || subject !== null || subsystemSubject !== null || targets.length ||
                request.context.subtrees.length !== request.context.systems.length) invalid('reconciliation context'); break;
        case 'verification':
            if (!request.context.systems.length || request.context.subsystems.length || subject !== null || subsystemSubject !== null || !targets.length || !request.context.boundaryCode) invalid('verification context'); break;
    }
}
export function parseSynthesisStageResult(input: unknown, request: SynthesisStageRequest,
    packet: ArchitectureEvidencePacket): SynthesisStageResult {
    validateSynthesisStageRequest(request, packet);
    const data = record(input, 'result');
    const schema = synthesisStageResultSchemas[request.stage];
    exact(data, [...schema.required, ...(request.stage === 'subsystem-challenge' && data.recovered !== undefined ? ['recovered'] : []),
        ...(request.stage === 'component-discovery' && data.disposition !== undefined ? ['disposition'] : [])], 'result');
    if (data.schemaVersion !== 1 || data.stageVersion !== SYNTHESIS_STAGE_VERSION || data.stage !== request.stage ||
        data.parentPacketFingerprint !== packet.inputFingerprint || data.viewId !== request.view.viewId) invalid('result stage/identity');
    const allowed = new Set(request.view.items.map(item => item.id));
    if (request.stage === 'system-discovery') {
        const discovered = systems(data.systems, allowed, 'result systems');
        for (const [index, candidate] of discovered.entries()) {
            if (!candidate.evidenceRefs.some(ref => isDirectSystemResponsibilityEvidence(packet.items.find(item => item.id === ref)!)))
                invalid(`result systems[${index}] lacks direct production evidence for responsibility`);
        }
    } else if (request.stage === 'system-challenge') {
        if (!Array.isArray(data.decisions)) invalid('decisions');
        const source = new Set(request.context.systems.map(item => item.candidateKey));
        const seen: string[] = []; const output: string[] = [];
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
                if (!candidate.evidenceRefs.some(ref => isDirectSystemResponsibilityEvidence(packet.items.find(item => item.id === ref)!)))
                    invalid(`${at}.systems[${j}] lacks directly source-backed production behavior`);
            }
        }
        strings(seen, 'challenge source keys'); strings(output, 'challenge output keys');
        if (seen.length !== source.size) invalid('incomplete challenge coverage');
    } else if (request.stage === 'subsystem-discovery') {
        if (data.systemKey !== request.context.subjectSystemKey) invalid('Subsystem Discovery System');
        const nodes = lowerNodes(data.subsystems, 'subsystem', data.systemKey as string, allowed, packet, 'result subsystems');
        if (nodes.some(node => request.context.systems.some(system => system.candidateKey === node.candidateKey))) invalid('Subsystem key reuses System key');
    } else if (request.stage === 'subsystem-challenge') {
        if (data.systemKey !== request.context.subjectSystemKey || !Array.isArray(data.decisions)) invalid('Subsystem Challenge System/decisions');
        const source = new Set(request.context.subsystems.map(item => item.candidateKey));
        const seen: string[] = [], output: string[] = [];
        for (const [i, raw] of data.decisions.entries()) {
            const at = `decisions[${i}]`;
            exact(raw, ['action', 'sourceKeys', 'subsystems', 'evidenceRefs'], at);
            const decision = raw as SubsystemChallengeDecision;
            const keys = strings(decision.sourceKeys, `${at}.sourceKeys`, 1);
            if (keys.some(item => !source.has(item))) invalid(`${at} unknown source`);
            seen.push(...keys);
            const produced = lowerNodes(decision.subsystems, 'subsystem', data.systemKey as string, allowed, packet, `${at}.subsystems`);
            output.push(...produced.map(item => item.candidateKey));
            const shape = decision.action === 'keep' && keys.length === 1 && produced.length === 1 && produced[0].candidateKey === keys[0] ||
                decision.action === 'merge' && keys.length >= 2 && produced.length === 1 && !source.has(produced[0].candidateKey) ||
                decision.action === 'split' && keys.length === 1 && produced.length >= 2 && produced.every(item => !source.has(item.candidateKey)) ||
                decision.action === 'reject' && keys.length === 1 && produced.length === 0;
            if (!shape) invalid(`${at} merge/split/keep/reject shape`);
            evidence(decision.evidenceRefs, allowed, `${at}.evidenceRefs`);
        }
        strings(seen, 'Subsystem Challenge source keys'); strings(output, 'Subsystem Challenge output keys');
        if (seen.length !== source.size || output.some(item => request.context.systems.some(system => system.candidateKey === item))) invalid('Subsystem Challenge coverage/key');
        if (data.recovered !== undefined) {
            if (!Array.isArray(data.recovered) || data.recovered.length > 4) invalid('Subsystem recovery bound');
            const cues = new Map(request.view.responsibilitySignals.filter(cue => cue.strength === 'behavior').map(cue => [cue.key, cue]));
            for (const [i, raw] of data.recovered.entries()) {
                exact(raw, ['cueKey', 'subsystem'], `recovered[${i}]`);
                const recovery = raw as { cueKey: string; subsystem: SubsystemCandidate };
                const cue = cues.get(recovery.cueKey);
                if (!cue || !cue.evidenceRefs.some(ref => recovery.subsystem.ownershipEvidenceRefs?.includes(ref)))
                    invalid(`recovered[${i}] uncovered implementation cue`);
                const [node] = lowerNodes([recovery.subsystem], 'subsystem', data.systemKey as string, allowed, packet, `recovered[${i}].subsystem`);
                if (source.has(node.candidateKey) || output.includes(node.candidateKey) ||
                    data.recovered.slice(0, i).some((entry: { subsystem: SubsystemCandidate }) => entry.subsystem.candidateKey === node.candidateKey) ||
                    request.context.subsystems.some(item => item.ownershipEvidenceRefs.includes(cue.evidenceRefs[0])))
                    invalid(`recovered[${i}] already covered`);
            }
        }
    } else if (request.stage === 'component-discovery') {
        if (data.systemKey !== request.context.subjectSystemKey || data.subsystemKey !== request.context.subjectSubsystemKey)
            invalid('Component Discovery parent');
        const nodes = lowerNodes(data.components, 'component', data.subsystemKey as string, allowed, packet, 'result components');
        if (!nodes.length !== (data.disposition !== undefined)) invalid('Component Discovery empty result disposition');
        if (data.disposition !== undefined) {
            const parent = request.context.subsystems.find(item => item.candidateKey === data.subsystemKey)!;
            validateDescent(data.disposition, data.systemKey as string, parent, allowed, packet, request.view.viewId);
        }
        if (nodes.some(node => request.context.systems.some(system => system.candidateKey === node.candidateKey) ||
            request.context.subsystems.some(subsystem => subsystem.candidateKey === node.candidateKey))) invalid('Component key reuses ancestor');
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
    subtrees: SystemSubtree[];
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
    for (const candidate of input.systems) if (!candidate.evidenceRefs.some(ref =>
        isDirectSystemResponsibilityEvidence(packet.items.find(item => item.id === ref)!)))
        invalid('assembly System lacks direct production responsibility evidence');
    if (!Array.isArray(input.subtrees) || input.subtrees.length !== input.systems.length) invalid('assembly subtrees');
    const allKeys = [...input.systems.map(item => item.candidateKey)];
    for (const [i, tree] of input.subtrees.entries()) {
        if (!input.systems.some(item => item.candidateKey === tree.systemKey)) invalid('assembly subtree identity');
        subtree(tree, tree.systemKey, allowed, packet, `assembly subtree[${i}]`);
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
    providerKind?: SynthesisProvider['kind'];
    usage?: SynthesisStageUsage;
    callDurationMs?: number;
    reused?: boolean;
    attempt?: number;
}
const progressStages: AnalysisProgressStage[] = ['collecting-evidence', 'planning-evidence', 'building-skeleton',
    'system-discovery', 'system-challenge', 'subsystem-discovery', 'subsystem-challenge', 'component-discovery', 'reconciliation', 'verification',
    'preparing-review', 'completed', 'failed', 'cancelled'];
export function parseAnalysisProgressEvent(input: unknown): AnalysisProgressEvent {
    const data = record(input, 'progress');
    const allowed = ['stage', 'status', 'elapsedMs', 'stageElapsedMs', 'message', 'callPurpose', 'subject', 'completedUnits', 'totalUnits', 'providerModelLabel', 'providerKind', 'usage', 'callDurationMs', 'reused', 'attempt'];
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
    if (data.providerKind !== undefined && !['local', 'gemini'].includes(data.providerKind as string)) invalid('progress provider');
    if (data.callDurationMs !== undefined && (typeof data.callDurationMs !== 'number' || !Number.isFinite(data.callDurationMs) || data.callDurationMs < 0)) invalid('progress duration');
    if (data.reused !== undefined && typeof data.reused !== 'boolean') invalid('progress reuse');
    if (data.usage !== undefined) {
        const usage = record(data.usage, 'progress usage');
        if (Object.keys(usage).some(key => !['providerKind', 'modelLabel', 'requestBytes', 'outputBytes', 'inputTokens', 'outputTokens', 'totalTokens', 'tokenMeasurement'].includes(key)) ||
            usage.providerKind !== data.providerKind || usage.modelLabel !== data.providerModelLabel ||
            !['provider-reported', 'tokenizer', 'estimated', 'unavailable'].includes(usage.tokenMeasurement as string)) invalid('progress usage');
        safeText(usage.modelLabel, 'progress usage model', 120);
        for (const key of ['requestBytes', 'outputBytes', 'inputTokens', 'outputTokens', 'totalTokens'])
            if (usage[key] !== undefined && (!Number.isSafeInteger(usage[key]) || (usage[key] as number) < 0)) invalid('progress usage');
    }
    return data as unknown as AnalysisProgressEvent;
}
