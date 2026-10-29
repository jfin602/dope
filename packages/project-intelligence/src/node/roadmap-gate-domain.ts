/** Schema-2 Roadmap domain. RoadmapStore remains the only persisted owner (P2). */
export type RoadmapImplementationStatus = 'unknown' | 'not-implemented' | 'active' | 'implemented' | 'blocked';
export type RoadmapQualificationStatus = 'unknown' | 'not-green' | 'green' | 'blocked' | 'stale' | 'waived';
export type RoadmapDraftAcceptance = 'proposed' | 'accepted' | 'published';

export interface RoadmapSourceProof {
    projectId: string;
    revision: number;
    sha256: string;
    path?: string;
}
export interface GateEvidence {
    id: string;
    projectId: string;
    criterionId: string;
    result: 'pass' | 'fail' | 'inconclusive';
    kind: 'test' | 'observation' | 'artifact' | 'manual-check' | 'approval';
    summary: string;
    verifiedBy: string;
    observedAt: string;
    source: RoadmapSourceProof;
}
export interface Criterion {
    id: string;
    projectId: string;
    title: string;
    expectedResult: string;
    order: number;
    evidence: GateEvidence[];
}
export interface RoadmapGate {
    id: string;
    projectId: string;
    parentPhaseId: string;
    designation: string;
    title: string;
    purpose: string;
    order: number;
    dependencies: string[];
    criteria: Criterion[];
    implementationStatus: RoadmapImplementationStatus;
    qualificationStatus: RoadmapQualificationStatus;
    draftAcceptance: RoadmapDraftAcceptance;
}
export interface RoadmapPhase {
    id: string;
    projectId: string;
    title: string;
    objective: string;
    order: number;
    dependencies: string[];
    implementationStatus: RoadmapImplementationStatus;
    qualificationStatus: RoadmapQualificationStatus;
    draftAcceptance: RoadmapDraftAcceptance;
    gateSetCoverage: { status: 'unreviewed' } | { status: 'approved'; approvedBy: string; source: RoadmapSourceProof };
}
export interface RoadmapCorrection {
    id: string;
    projectId: string;
    parent: { kind: 'phase' | 'gate'; id: string };
    criterionId?: string;
    title: string;
    objective: string;
    order: number;
    implementationStatus: RoadmapImplementationStatus;
    qualificationStatus: RoadmapQualificationStatus;
    draftAcceptance: RoadmapDraftAcceptance;
}
export interface RoadmapGateLinkedDocument {
    projectId: string;
    projectRoot: string;
    path: string;
    sourceHash: string;
    syncState: 'synced' | 'source-changed' | 'conflict' | 'pending-sync' | 'missing';
    sections: { sectionKey: string; kind: 'phase' | 'gate' | 'correction'; id: string }[];
}
export interface RoadmapGateIndex {
    schemaVersion: 2;
    projectId: string;
    projectRoot: string;
    revision: number;
    phases: RoadmapPhase[];
    gates: RoadmapGate[];
    corrections: RoadmapCorrection[];
    linkedDocument?: RoadmapGateLinkedDocument;
}

const MAX_INDEX_BYTES = 4 * 1024 * 1024;
const MAX_ENTITIES = 4096;
const MAX_NESTED = 128;
const identifier = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256 && !/[\x00-\x1f\x7f]/.test(v) && v.trim() === v;
const prose = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
const natural = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, required: string[], optional: string[] = []): boolean =>
    required.every(k => Object.hasOwn(v, k)) && Object.keys(v).every(k => required.includes(k) || optional.includes(k));
const member = (v: unknown, choices: readonly string[]): boolean => typeof v === 'string' && choices.includes(v);
const failure = (message: string): never => { throw new Error(`Invalid Roadmap gate index: ${message}`); };
const assertion = (ok: unknown, message: string): void => { if (!ok) failure(message); };
const identity = (v: Record<string, unknown>, projectId: string): boolean => identifier(v.id) && v.projectId === projectId;
const states = (v: Record<string, unknown>): boolean =>
    member(v.implementationStatus, ['unknown', 'not-implemented', 'active', 'implemented', 'blocked']) &&
    member(v.qualificationStatus, ['unknown', 'not-green', 'green', 'blocked', 'stale', 'waived']) &&
    member(v.draftAcceptance, ['proposed', 'accepted', 'published']);
const path = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 512 &&
    !v.includes('\\') && !v.includes(':') && !v.startsWith('/') && !v.split('/').some(p => !p || p === '.' || p === '..') &&
    !/[\x00-\x1f\x7f]/.test(v);

function source(v: unknown, projectId: string): v is RoadmapSourceProof {
    if (!record(v) || !keys(v, ['projectId', 'revision', 'sha256'], ['path'])) return false;
    return v.projectId === projectId && natural(v.revision) && hash(v.sha256) && (v.path === undefined || path(v.path));
}
function references(v: unknown, ownerId: string): v is string[] {
    return Array.isArray(v) && v.length <= MAX_NESTED && v.every(identifier) &&
        !v.includes(ownerId) && new Set(v).size === v.length;
}
function ordered(v: unknown): v is number { return natural(v); }
function cycleCheck<T extends { id: string; dependencies: string[] }>(entries: T[], label: string): void {
    const byId = new Map(entries.map(e => [e.id, e]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
        assertion(byId.has(id), `${label} dependency parent`);
        if (visiting.has(id)) failure(`${label} dependency cycle`);
        if (visited.has(id)) return;
        visiting.add(id);
        for (const dep of byId.get(id)!.dependencies) visit(dep);
        visiting.delete(id);
        visited.add(id);
    };
    for (const entry of entries) visit(entry.id);
}

/** A discriminator only: it never upgrades schema 1 or changes the active store. */
export function isRoadmapGateSchemaShape(value: unknown): boolean {
    return record(value) && value.schemaVersion === 2 && Array.isArray(value.phases) &&
        Array.isArray(value.gates) && Array.isArray(value.corrections);
}

/** Strict, pure validation of a schema-2 candidate against its actual project owner. */
export function parseRoadmapGateIndex(value: unknown, projectRoot: string, projectId: string): RoadmapGateIndex {
    assertion(isRoadmapGateSchemaShape(value), 'schema 2 shape');
    const raw = value as Record<string, unknown>;
    assertion(keys(raw, ['schemaVersion', 'projectId', 'projectRoot', 'revision', 'phases', 'gates', 'corrections'], ['linkedDocument']) &&
        identifier(projectId) && projectId !== 'uninitialized' && raw.projectId === projectId &&
        raw.projectRoot === projectRoot && natural(raw.revision) && (raw.revision as number) > 0, 'project or index fields');
    let bytes: number;
    try { bytes = Buffer.byteLength(JSON.stringify(value)); } catch { return failure('serialization'); }
    assertion(bytes <= MAX_INDEX_BYTES, 'size limit');
    const phases = raw.phases as unknown[];
    const gates = raw.gates as unknown[];
    const corrections = raw.corrections as unknown[];
    assertion(phases.length <= MAX_ENTITIES && gates.length <= MAX_ENTITIES && corrections.length <= MAX_ENTITIES, 'entity limit');
    const seen = new Set<string>();
    const claim = (id: string): void => { assertion(!seen.has(id), 'duplicate identity'); seen.add(id); };
    const phaseOrders = new Set<number>();
    for (const item of phases) {
        assertion(record(item) && keys(item, ['id', 'projectId', 'title', 'objective', 'order', 'dependencies',
            'implementationStatus', 'qualificationStatus', 'draftAcceptance', 'gateSetCoverage']) &&
            identity(item, projectId) && prose(item.title, 512) && prose(item.objective, 8192) && ordered(item.order) &&
            references(item.dependencies, item.id as string) && states(item), 'phase fields');
        const p = item as unknown as RoadmapPhase;
        assertion(!phaseOrders.has(p.order), 'duplicate phase order');
        phaseOrders.add(p.order); claim(p.id);
        const coverage = p.gateSetCoverage;
        assertion(record(coverage) && (coverage.status === 'unreviewed' ? keys(coverage, ['status']) :
            coverage.status === 'approved' && keys(coverage, ['status', 'approvedBy', 'source']) &&
            identifier(coverage.approvedBy) && source(coverage.source, projectId)), 'phase gate-set coverage');
    }
    const gateOrder = new Set<string>();
    const designation = new Set<string>();
    for (const item of gates) {
        assertion(record(item) && keys(item, ['id', 'projectId', 'parentPhaseId', 'designation', 'title', 'purpose',
            'order', 'dependencies', 'criteria', 'implementationStatus', 'qualificationStatus', 'draftAcceptance']) &&
            identity(item, projectId) && identifier(item.parentPhaseId) && /^G[1-9][0-9]*$/.test(item.designation as string) &&
            prose(item.title, 512) && prose(item.purpose, 8192) && ordered(item.order) &&
            references(item.dependencies, item.id as string) && Array.isArray(item.criteria) &&
            item.criteria.length > 0 && item.criteria.length <= MAX_NESTED && states(item), 'gate fields');
        const gate = item as unknown as RoadmapGate;
        assertion(phases.some(p => (p as RoadmapPhase).id === gate.parentPhaseId), 'gate parent phase');
        const localOrder = `${gate.parentPhaseId}\0${gate.order}`;
        const localDesignation = `${gate.parentPhaseId}\0${gate.designation}`;
        assertion(!gateOrder.has(localOrder) && !designation.has(localDesignation), 'duplicate phase-local gate order or designation');
        gateOrder.add(localOrder); designation.add(localDesignation); claim(gate.id);
        const criterionOrders = new Set<number>();
        for (const candidate of gate.criteria) {
            assertion(record(candidate) && keys(candidate, ['id', 'projectId', 'title', 'expectedResult', 'order', 'evidence']) &&
                identity(candidate, projectId) && prose(candidate.title, 512) && prose(candidate.expectedResult, 4096) &&
                ordered(candidate.order) && Array.isArray(candidate.evidence) && candidate.evidence.length <= MAX_NESTED,
                'criterion fields');
            const criterion = candidate as Criterion;
            assertion(!criterionOrders.has(criterion.order), 'duplicate criterion order');
            criterionOrders.add(criterion.order); claim(criterion.id);
            for (const candidateEvidence of criterion.evidence) {
                assertion(record(candidateEvidence) && keys(candidateEvidence, ['id', 'projectId', 'criterionId', 'result',
                    'kind', 'summary', 'verifiedBy', 'observedAt', 'source']) && identity(candidateEvidence, projectId) &&
                    candidateEvidence.criterionId === criterion.id && member(candidateEvidence.result, ['pass', 'fail', 'inconclusive']) &&
                    member(candidateEvidence.kind, ['test', 'observation', 'artifact', 'manual-check', 'approval']) &&
                    prose(candidateEvidence.summary, 4096) && identifier(candidateEvidence.verifiedBy) &&
                    typeof candidateEvidence.observedAt === 'string' &&
                    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(candidateEvidence.observedAt) &&
                    !Number.isNaN(Date.parse(candidateEvidence.observedAt)) && source(candidateEvidence.source, projectId),
                    'evidence fields');
                claim(candidateEvidence.id as string);
            }
        }
    }
    for (const item of corrections) {
        assertion(record(item) && keys(item, ['id', 'projectId', 'parent', 'title', 'objective', 'order',
            'implementationStatus', 'qualificationStatus', 'draftAcceptance'], ['criterionId']) &&
            identity(item, projectId) && record(item.parent) && keys(item.parent, ['kind', 'id']) &&
            member(item.parent.kind, ['phase', 'gate']) && identifier(item.parent.id) &&
            prose(item.title, 512) && prose(item.objective, 8192) && ordered(item.order) && states(item), 'correction fields');
        const correction = item as unknown as RoadmapCorrection;
        const parent = correction.parent.kind === 'phase' ? phases.find(p => (p as RoadmapPhase).id === correction.parent.id) :
            gates.find(g => (g as RoadmapGate).id === correction.parent.id);
        assertion(parent, 'correction parent');
        assertion(correction.criterionId === undefined || correction.parent.kind === 'gate' &&
            (parent as RoadmapGate).criteria.some(c => c.id === correction.criterionId), 'correction criterion parent');
        claim(correction.id);
    }
    cycleCheck(phases as RoadmapPhase[], 'phase');
    cycleCheck(gates as RoadmapGate[], 'gate');
    if (raw.linkedDocument !== undefined) {
        const doc = raw.linkedDocument;
        assertion(record(doc) && keys(doc, ['projectId', 'projectRoot', 'path', 'sourceHash', 'syncState', 'sections']) &&
            doc.projectId === projectId && doc.projectRoot === projectRoot && path(doc.path) && /\.md$/i.test(doc.path) &&
            hash(doc.sourceHash) && member(doc.syncState, ['synced', 'source-changed', 'conflict', 'pending-sync', 'missing']) &&
            Array.isArray(doc.sections) && doc.sections.length <= MAX_ENTITIES, 'linked document');
        const sections = (doc as unknown as RoadmapGateLinkedDocument).sections;
        const sectionKeys = new Set<string>();
        const sectionIds = new Set<string>();
        for (const section of sections) {
            assertion(record(section) && keys(section, ['sectionKey', 'kind', 'id']) && identifier(section.sectionKey) &&
                member(section.kind, ['phase', 'gate', 'correction']) && identifier(section.id) &&
                (section.kind === 'phase' ? phases : section.kind === 'gate' ? gates : corrections)
                    .some(e => (e as { id: string }).id === section.id) &&
                !sectionKeys.has(section.sectionKey) && !sectionIds.has(section.id), 'linked section');
            sectionKeys.add(section.sectionKey); sectionIds.add(section.id);
        }
    }
    return value as RoadmapGateIndex;
}
