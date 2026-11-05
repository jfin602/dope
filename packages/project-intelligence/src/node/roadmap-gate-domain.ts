/** Schema-2 Roadmap domain. RoadmapStore remains the only persisted owner. */
import { createHash } from 'node:crypto';
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
    source?: RoadmapSourceProof;
    /** A manual check without source needs an attributable reviewer and action. */
    observedAction?: string;
    criterionHash: string;
    review: { status: 'proposed' } | { status: 'approved' | 'revoked'; reviewerId: string; reviewedAt: string };
    validation?: { status: 'stale'; reason: string };
    /** Checked Dope intake provenance; a proposal alone is never qualification. */
    receipt?: { eventId: string; origin: 'dope-validation' | 'reviewed-observation';
        ownerId: string; workOwnerId?: string; phaseId: string; gateId: string; workItemId?: string;
        taskId?: string; runId?: string; grantId?: string; testedHead: string;
        candidateFingerprint?: string; method: string; checkId?: string; artifactSha256: string;
        artifactLocation: string; assertionSha256: string; scope: string; recordedAt: string;
        reviewerId: string; reviewedAt: string };
}
export const criterionHash = (criterion: Pick<Criterion, 'title' | 'expectedResult'>): string =>
    createHash('sha256').update(JSON.stringify([criterion.title, criterion.expectedResult])).digest('hex');
export const sameRoadmapSource = (a: RoadmapSourceProof, b: RoadmapSourceProof): boolean =>
    a.projectId === b.projectId && a.revision === b.revision && a.sha256 === b.sha256 && a.path === b.path;
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
    qualificationSource?: RoadmapSourceProof;
    qualificationBlockers?: string[];
    waiver?: { authorizedBy: string; authorizedAt: string; reason: string; source: RoadmapSourceProof };
}
export type GateQualification = { status: 'green' | 'not-green' | 'unknown' | 'blocked' | 'stale' | 'waived'; reasons: string[] };
/** Read-only decision. A stored color or implementation status is never evidence. */
export function evaluateGateQualification(gate: RoadmapGate, currentSource = gate.qualificationSource,
    phase?: RoadmapPhase): GateQualification {
    if (gate.waiver) return !currentSource || !sameRoadmapSource(gate.waiver.source, currentSource) ?
        { status: 'stale', reasons: ['Exceptional Gate waiver source changed'] } :
        { status: 'waived', reasons: [`Exceptional Gate waiver: ${gate.waiver.reason}`] };
    if (gate.qualificationBlockers?.length) return { status: 'blocked', reasons: [...gate.qualificationBlockers] };
    if (gate.draftAcceptance === 'proposed') return { status: 'unknown', reasons: ['Gate definition is proposed'] };
    if (!gate.criteria.length) return { status: 'unknown', reasons: ['Gate has no criteria'] };
    const reasons: string[] = [];
    let stale = false;
    let failed = false;
    for (const criterion of gate.criteria) {
        // A locked Phase has an explicit Work-to-Criterion plan. Each linked WorkItem is
        // a required check; unrelated or legacy evidence cannot satisfy that check.
        const requiredWork = phase?.planningLock ? [...new Set((phase.workLinks ?? [])
            .filter(link => link.criterionIds.includes(criterion.id)).map(link => link.workItemId))] : undefined;
        if (requiredWork && !requiredWork.length) {
            reasons.push(`${criterion.id}: no reviewed Work check is linked`);
            continue;
        }
        for (const workItemId of requiredWork ?? [undefined]) {
            const requiredChecks = workItemId ? phase?.workLinks?.find(link => link.workItemId === workItemId)?.requiredChecks : undefined;
            for (const checkId of requiredChecks?.length ? requiredChecks : [undefined]) {
                const reviewed = criterion.evidence.filter(e => e.review.status === 'approved' &&
                    (workItemId === undefined || e.receipt?.workItemId === workItemId &&
                        e.receipt.phaseId === phase?.id && e.receipt.gateId === gate.id &&
                        e.receipt.ownerId === gate.projectId && e.receipt.eventId === e.id &&
                        !!e.source &&
                        e.receipt.assertionSha256 !== '0'.repeat(64) &&
                        (checkId === undefined || e.receipt.checkId === checkId)));
                const check = [criterion.id, workItemId, checkId].filter(Boolean).join('/');
                if (!reviewed.length) { reasons.push(`${check}: missing approved evidence`); continue; }
                const current = reviewed.filter(e => {
                    const drift = e.validation?.status === 'stale' || e.criterionHash !== criterionHash(criterion) ||
                        !!e.source && (!currentSource || !sameRoadmapSource(e.source, currentSource));
                    return !drift;
                });
                if (!current.length) {
                    stale = true;
                    const detail = reviewed.at(-1)!;
                    reasons.push(`${check}: ${detail.validation?.reason ??
                        (detail.criterionHash !== criterionHash(criterion) ? 'Criterion definition changed' : 'Tested source changed')}`);
                    continue;
                }
                const latestAt = Math.max(...current.map(item => Date.parse(item.observedAt)));
                const latest = current.filter(item => Date.parse(item.observedAt) === latestAt);
                if (latest.some(item => item.result !== 'pass')) {
                    failed = true;
                    reasons.push(`${check}: ${latest.some(item => item.result === 'fail') ? 'fail' : 'inconclusive'}`);
                }
            }
        }
    }
    if (stale) return { status: 'stale', reasons };
    if (failed) return { status: 'not-green', reasons };
    if (reasons.length) return { status: 'unknown', reasons };
    return { status: 'green', reasons: [] };
}
export interface PhaseWorkLink { planningProjectId: string; mapId: string; mapRevision: number;
    basis: { architectureRevision: number; architectureFingerprint: string;
        physicalInputFingerprint: string; physicalGeneration: number };
    workItemId: string; transformationIds: string[]; criterionIds: string[];
    /** Exact validation labels approved with the Work handoff. Legacy links lack this list. */
    requiredChecks?: string[] }
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
    gateSetCoverage: { status: 'unreviewed' } | { status: 'approved'; approvedBy: string; reviewedAt: string;
        approvedAtRevision: number; requiredGateIds: string[]; source: RoadmapSourceProof };
    /** The reviewed planning basis is phase scoped and retained in the canonical Roadmap revision. */
    planningLock?: { approvalId: string; lockedBy: string; lockedAt: string; basisRevision: number;
        requiredGateIds: string[]; criteria: { id: string; expectedResult: string }[];
        source: RoadmapSourceProof };
    /** Reviewed references into the existing Planning Map owner; no Work grant or qualification. */
    workLinks?: PhaseWorkLink[];
    qualificationSource?: RoadmapSourceProof;
    qualificationBlockers?: string[];
    /** An exceptional disposition is recorded separately and never counts as Green. */
    exception?: { kind: 'waived'; authorizedBy: string; authorizedAt: string; reason: string; source: RoadmapSourceProof };
}
export type PhaseQualification = { status: 'unplanned' | 'planned' | 'green' | 'not-green' | 'blocked' | 'stale' | 'waived';
    qualified: number; required: number; reasons: string[] };
/** Coverage is an owner decision about the complete required set, independent of Gate evidence. */
export function evaluatePhaseQualification(index: RoadmapGateIndex, phaseId: string,
    currentSource?: RoadmapSourceProof): PhaseQualification {
    const phase = index.phases.find(item => item.id === phaseId);
    if (!phase) throw new Error('Missing Roadmap Phase');
    const gates = index.gates.filter(item => item.parentPhaseId === phaseId && item.draftAcceptance !== 'proposed');
    const required = gates.length;
    const results = gates.map(gate => {
        const evidence = evaluateGateQualification(gate, currentSource, phase);
        const result = gate.qualificationStatus === 'stale' && evidence.status === 'green' ?
                { status: 'stale', reasons: ['Gate status requires requalification'] } : evidence;
        return { gate, result };
    });
    const qualified = results.filter(item => item.result.status === 'green').length;
    const reasons: string[] = [];
    let stale = results.some(item => item.result.status === 'stale');
    if (!required) reasons.push('Phase has no accepted Gates');
    if (phase.gateSetCoverage.status !== 'approved') reasons.push('Complete required Gate set is not approved');
    else {
        const approved = phase.gateSetCoverage;
        const ids = gates.map(item => item.id).sort();
        if (JSON.stringify(ids) !== JSON.stringify([...approved.requiredGateIds].sort())) {
            reasons.push('Required Gate set changed since approval'); stale = true;
        }
        if (!currentSource || !sameRoadmapSource(approved.source, currentSource) ||
            !phase.qualificationSource || !sameRoadmapSource(approved.source, phase.qualificationSource)) {
            reasons.push('Phase source changed since Gate-set approval'); stale = true;
        }
        if (index.linkedDocument && (approved.source.path !== index.linkedDocument.path ||
            approved.source.sha256 !== index.linkedDocument.sourceHash || index.linkedDocument.syncState !== 'synced')) {
            reasons.push('Linked Roadmap source changed since Gate-set approval'); stale = true;
        }
    }
    for (const { gate, result } of results) {
        if (result.status !== 'green') reasons.push(`${gate.id}: ${result.status}${result.reasons.length ? ` (${result.reasons.join('; ')})` : ''}`);
    }
    for (const blocker of phase.qualificationBlockers ?? []) reasons.push(`Phase blocker: ${blocker}`);
    if (!required) return { status: 'unplanned', qualified, required, reasons };
    if (phase.exception) {
        reasons.push(`Exceptional Phase waiver: ${phase.exception.reason}`);
        if (!currentSource || !sameRoadmapSource(phase.exception.source, currentSource)) {
            reasons.push('Exceptional Phase waiver source changed');
            return { status: 'stale', qualified, required, reasons };
        }
        return { status: 'waived', qualified, required, reasons };
    }
    if (phase.qualificationBlockers?.length || results.some(item => item.result.status === 'blocked'))
        return { status: 'blocked', qualified, required, reasons };
    if (stale) return { status: 'stale', qualified, required, reasons };
    if (phase.gateSetCoverage.status !== 'approved') return { status: 'planned', qualified, required, reasons };
    return { status: reasons.length ? 'not-green' : 'green', qualified, required, reasons };
}
/** Eligibility only: the owner closeout is a separate reviewed action, never a Work or Gate side effect. */
export function phaseCloseoutEligibility(index: RoadmapGateIndex, phaseId: string, ownerId: string,
    currentSource?: RoadmapSourceProof): { eligible: boolean; reasons: string[] } {
    const phase = index.phases.find(item => item.id === phaseId);
    if (!phase) throw new Error('Missing Roadmap Phase');
    const qualification = evaluatePhaseQualification(index, phaseId, currentSource);
    const reasons = [...qualification.reasons];
    if (!phase.planningLock || phase.planningLock.lockedBy !== ownerId)
        reasons.push('Explicit locked Phase owner is required for closeout');
    if (qualification.status !== 'green' && !reasons.length)
        reasons.push('Current Phase qualification is required for closeout');
    return { eligible: qualification.status === 'green' && !!phase.planningLock &&
        phase.planningLock.lockedBy === ownerId, reasons };
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
    syncState: 'synced' | 'source-changed' | 'conflict' | 'pending-sync' | 'missing' | 'syncing' | 'failed' | 'recoverable';
    /** Committed with the Roadmap revision; the side journal records only its file outcome. */
    syncIntent?: { revision: number; indexDigest: string; path: string; expectedSourceHash: string };
    /** Hash of the reviewed publisher intent, for safe result replay after response loss. */
    publicationIntentHash?: string;
    sections: { sectionKey: string; kind: 'phase' | 'gate' | 'criterion' | 'correction'; id: string }[];
    lastSynced?: { sourceHash: string; fields: { kind: 'phase' | 'gate' | 'criterion' | 'correction'; id: string;
        title: string; detail: string }[]; structure?: {
        phases: { id: string; order: number; dependencies: string[] }[];
        gates: { id: string; parentPhaseId: string; designation: string; order: number;
            dependencies: string[]; criteria: string[] }[];
        corrections: { id: string; parent: { kind: 'phase' | 'gate'; id: string };
            criterionId?: string; order: number }[] } };
    pending?: { basisRevision: number; beforeHash: string; afterHash: string; edit: { kind: 'phase' | 'gate' | 'criterion';
        id: string; title?: string; detail?: string }; outcome: 'prepared' | 'document-written' | 'conflict' };
}
export interface RoadmapGateIndex {
    schemaVersion: 2;
    projectId: string;
    projectRoot: string;
    revision: number;
    phases: RoadmapPhase[];
    gates: RoadmapGate[];
    corrections: RoadmapCorrection[];
    /** Historical revisions at or before this boundary cannot be restored into the active Roadmap. */
    retiredBeforeRevision?: number;
    linkedDocument?: RoadmapGateLinkedDocument;
    /** Durable approved file creation intent. A pending intent is never canonical. */
    pendingPublication?: { approvalId: string; basisRevision: number; path: string;
        sourceHash: string; content: string };
}

const MAX_INDEX_BYTES = 4 * 1024 * 1024;
const MAX_ENTITIES = 4096;
const MAX_NESTED = 128;
const identifier = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 256 && !/[\x00-\x1f\x7f]/.test(v) && v.trim() === v;
const prose = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
const natural = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const gitHead = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{40}$/.test(v);
const timestamp = (v: unknown): v is string => typeof v === 'string' &&
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v) && !Number.isNaN(Date.parse(v));
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
    assertion(keys(raw, ['schemaVersion', 'projectId', 'projectRoot', 'revision', 'phases', 'gates', 'corrections'],
        ['linkedDocument', 'pendingPublication', 'retiredBeforeRevision']) &&
        identifier(projectId) && projectId !== 'uninitialized' && raw.projectId === projectId &&
        raw.projectRoot === projectRoot && natural(raw.revision) && (raw.revision as number) > 0 &&
        (raw.retiredBeforeRevision === undefined || natural(raw.retiredBeforeRevision) &&
            (raw.retiredBeforeRevision as number) < (raw.revision as number)), 'project or index fields');
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
            'implementationStatus', 'qualificationStatus', 'draftAcceptance', 'gateSetCoverage'],
            ['qualificationSource', 'qualificationBlockers', 'exception', 'planningLock', 'workLinks']) &&
            identity(item, projectId) && prose(item.title, 512) && prose(item.objective, 8192) && ordered(item.order) &&
            references(item.dependencies, item.id as string) && states(item) &&
            (item.qualificationSource === undefined || source(item.qualificationSource, projectId)) &&
            (item.qualificationBlockers === undefined || Array.isArray(item.qualificationBlockers) &&
                item.qualificationBlockers.length <= MAX_NESTED && item.qualificationBlockers.every(v => prose(v, 1024))) &&
            (item.exception === undefined || record(item.exception) &&
                keys(item.exception, ['kind', 'authorizedBy', 'authorizedAt', 'reason', 'source']) &&
                item.exception.kind === 'waived' && identifier(item.exception.authorizedBy) &&
                timestamp(item.exception.authorizedAt) && prose(item.exception.reason, 1024) &&
                source(item.exception.source, projectId)), 'phase fields');
        const p = item as unknown as RoadmapPhase;
        assertion(!phaseOrders.has(p.order), 'duplicate phase order');
        phaseOrders.add(p.order); claim(p.id);
        const coverage = p.gateSetCoverage;
        assertion(record(coverage) && (coverage.status === 'unreviewed' ? keys(coverage, ['status']) :
            coverage.status === 'approved' && keys(coverage, ['status', 'approvedBy', 'reviewedAt',
                'approvedAtRevision', 'requiredGateIds', 'source']) && identifier(coverage.approvedBy) &&
            timestamp(coverage.reviewedAt) && natural(coverage.approvedAtRevision) &&
            (coverage.approvedAtRevision as number) <= (raw.revision as number) &&
            Array.isArray(coverage.requiredGateIds) && coverage.requiredGateIds.length > 0 &&
            coverage.requiredGateIds.length <= MAX_ENTITIES && coverage.requiredGateIds.every(identifier) &&
            new Set(coverage.requiredGateIds).size === coverage.requiredGateIds.length &&
            source(coverage.source, projectId)), 'phase gate-set coverage');
        if (p.planningLock) {
            const lock = p.planningLock;
            assertion(keys(lock, ['approvalId', 'lockedBy', 'lockedAt', 'basisRevision', 'requiredGateIds', 'criteria',
                'source']) && identifier(lock.approvalId) && identifier(lock.lockedBy) && timestamp(lock.lockedAt) &&
                natural(lock.basisRevision) && lock.basisRevision < (raw.revision as number) &&
                Array.isArray(lock.requiredGateIds) && lock.requiredGateIds.length > 0 &&
                lock.requiredGateIds.every(identifier) && new Set(lock.requiredGateIds).size === lock.requiredGateIds.length &&
                Array.isArray(lock.criteria) && lock.criteria.length > 0 &&
                lock.criteria.every(c => record(c) && keys(c, ['id', 'expectedResult']) &&
                    identifier(c.id) && prose(c.expectedResult, 4096)) &&
                new Set(lock.criteria.map(c => c.id)).size === lock.criteria.length &&
                source(lock.source, projectId), 'phase planning lock');
        }
        if (p.workLinks !== undefined) {
            assertion(!!p.planningLock && Array.isArray(p.workLinks) && p.workLinks.length > 0 &&
                p.workLinks.length <= MAX_NESTED && new Set(p.workLinks.map(link =>
                    `${link.planningProjectId}/${link.mapId}/${link.workItemId}`)).size === p.workLinks.length &&
                p.workLinks.every(link => record(link) && keys(link, ['planningProjectId', 'mapId', 'mapRevision',
                    'basis', 'workItemId', 'transformationIds', 'criterionIds'], ['requiredChecks']) &&
                    identifier(link.planningProjectId) && identifier(link.mapId) && natural(link.mapRevision) &&
                    identifier(link.workItemId) && record(link.basis) &&
                    keys(link.basis, ['architectureRevision', 'architectureFingerprint', 'physicalInputFingerprint', 'physicalGeneration']) &&
                    natural(link.basis.architectureRevision) && natural(link.basis.physicalGeneration) &&
                    identifier(link.basis.architectureFingerprint) && identifier(link.basis.physicalInputFingerprint) &&
                    Array.isArray(link.transformationIds) && link.transformationIds.length > 0 &&
                    link.transformationIds.every(identifier) && new Set(link.transformationIds).size === link.transformationIds.length &&
                    Array.isArray(link.criterionIds) && link.criterionIds.length > 0 &&
                    link.criterionIds.every(identifier) && new Set(link.criterionIds).size === link.criterionIds.length &&
                    (link.requiredChecks === undefined || Array.isArray(link.requiredChecks) &&
                        link.requiredChecks.length > 0 && link.requiredChecks.length <= MAX_NESTED &&
                        link.requiredChecks.every(v => prose(v, 256)) &&
                        new Set(link.requiredChecks).size === link.requiredChecks.length)),
            'phase Work links');
        }
    }
    const gateOrder = new Set<string>();
    const designation = new Set<string>();
    for (const item of gates) {
        assertion(record(item) && keys(item, ['id', 'projectId', 'parentPhaseId', 'designation', 'title', 'purpose',
            'order', 'dependencies', 'criteria', 'implementationStatus', 'qualificationStatus', 'draftAcceptance'],
            ['qualificationSource', 'qualificationBlockers', 'waiver']) &&
            identity(item, projectId) && identifier(item.parentPhaseId) && /^G[1-9][0-9]*$/.test(item.designation as string) &&
            prose(item.title, 512) && prose(item.purpose, 8192) && ordered(item.order) &&
            references(item.dependencies, item.id as string) && Array.isArray(item.criteria) &&
            item.criteria.length > 0 && item.criteria.length <= MAX_NESTED && states(item) &&
            (item.qualificationSource === undefined || source(item.qualificationSource, projectId)) &&
            (item.qualificationBlockers === undefined || Array.isArray(item.qualificationBlockers) &&
                item.qualificationBlockers.length <= MAX_NESTED && item.qualificationBlockers.every(v => prose(v, 1024))) &&
            (item.waiver === undefined || record(item.waiver) &&
                keys(item.waiver, ['authorizedBy', 'authorizedAt', 'reason', 'source']) &&
                identifier(item.waiver.authorizedBy) && timestamp(item.waiver.authorizedAt) &&
                prose(item.waiver.reason, 1024) && source(item.waiver.source, projectId)), 'gate fields');
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
                    'kind', 'summary', 'verifiedBy', 'observedAt', 'criterionHash', 'review'],
                    ['source', 'observedAction', 'validation', 'receipt']) && identity(candidateEvidence, projectId) &&
                    candidateEvidence.criterionId === criterion.id && member(candidateEvidence.result, ['pass', 'fail', 'inconclusive']) &&
                    member(candidateEvidence.kind, ['test', 'observation', 'artifact', 'manual-check', 'approval']) &&
                    prose(candidateEvidence.summary, 4096) && identifier(candidateEvidence.verifiedBy) &&
                    timestamp(candidateEvidence.observedAt) && hash(candidateEvidence.criterionHash) &&
                    (candidateEvidence.source === undefined ? candidateEvidence.kind === 'manual-check' &&
                        prose(candidateEvidence.observedAction, 4096) : source(candidateEvidence.source, projectId)) &&
                    record(candidateEvidence.review) && (candidateEvidence.review.status === 'proposed' ?
                        keys(candidateEvidence.review, ['status']) :
                        member(candidateEvidence.review.status, ['approved', 'revoked']) &&
                        keys(candidateEvidence.review, ['status', 'reviewerId', 'reviewedAt']) &&
                        identifier(candidateEvidence.review.reviewerId) &&
                        timestamp(candidateEvidence.review.reviewedAt)) &&
                    (candidateEvidence.receipt === undefined || record(candidateEvidence.receipt) &&
                        keys(candidateEvidence.receipt, ['eventId', 'origin', 'ownerId', 'phaseId', 'gateId',
                            'testedHead', 'method', 'artifactSha256', 'artifactLocation', 'assertionSha256', 'scope', 'recordedAt',
                            'reviewerId', 'reviewedAt'], ['workOwnerId', 'workItemId', 'taskId', 'runId', 'grantId', 'candidateFingerprint', 'checkId']) &&
                        candidateEvidence.receipt.eventId === candidateEvidence.id &&
                        member(candidateEvidence.receipt.origin, ['dope-validation', 'reviewed-observation']) &&
                        candidateEvidence.receipt.ownerId === projectId &&
                        candidateEvidence.receipt.phaseId === gate.parentPhaseId &&
                        candidateEvidence.receipt.gateId === gate.id &&
                        (candidateEvidence.receipt.origin !== 'dope-validation' ||
                            identifier(candidateEvidence.receipt.workOwnerId) &&
                            identifier(candidateEvidence.receipt.workItemId) &&
                            identifier(candidateEvidence.receipt.taskId) &&
                            identifier(candidateEvidence.receipt.runId) &&
                            identifier(candidateEvidence.receipt.grantId) &&
                            hash(candidateEvidence.receipt.candidateFingerprint)) &&
                        (candidateEvidence.receipt.workItemId === undefined || identifier(candidateEvidence.receipt.workItemId)) &&
                        (candidateEvidence.receipt.workOwnerId === undefined || identifier(candidateEvidence.receipt.workOwnerId)) &&
                        (candidateEvidence.receipt.taskId === undefined || identifier(candidateEvidence.receipt.taskId)) &&
                        (candidateEvidence.receipt.runId === undefined || identifier(candidateEvidence.receipt.runId)) &&
                        (candidateEvidence.receipt.grantId === undefined || identifier(candidateEvidence.receipt.grantId)) &&
                        gitHead(candidateEvidence.receipt.testedHead) &&
                        (candidateEvidence.receipt.candidateFingerprint === undefined || hash(candidateEvidence.receipt.candidateFingerprint)) &&
                        prose(candidateEvidence.receipt.method, 256) &&
                        (candidateEvidence.receipt.checkId === undefined || prose(candidateEvidence.receipt.checkId, 256)) &&
                        hash(candidateEvidence.receipt.artifactSha256) &&
                        prose(candidateEvidence.receipt.artifactLocation, 512) && hash(candidateEvidence.receipt.assertionSha256) &&
                        prose(candidateEvidence.receipt.scope, 1024) &&
                        timestamp(candidateEvidence.receipt.recordedAt) && identifier(candidateEvidence.receipt.reviewerId) &&
                        timestamp(candidateEvidence.receipt.reviewedAt)) &&
                    (candidateEvidence.validation === undefined || record(candidateEvidence.validation) &&
                        keys(candidateEvidence.validation, ['status', 'reason']) &&
                        candidateEvidence.validation.status === 'stale' && prose(candidateEvidence.validation.reason, 1024)),
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
    for (const gate of gates as RoadmapGate[]) {
        if (gate.qualificationStatus === 'green')
            assertion(evaluateGateQualification(gate, gate.qualificationSource,
                (phases as RoadmapPhase[]).find(phase => phase.id === gate.parentPhaseId)).status === 'green',
            'unverified Gate Green');
        if (gate.qualificationStatus === 'waived') assertion(!!gate.waiver, 'unreviewed Gate waiver');
    }
    for (const phase of phases as RoadmapPhase[]) {
        if (phase.gateSetCoverage.status === 'approved') {
            assertion(phase.gateSetCoverage.requiredGateIds.every(id => (gates as RoadmapGate[])
                .some(gate => gate.id === id && gate.parentPhaseId === phase.id && gate.draftAcceptance !== 'proposed')),
            'approved Gate set membership');
        }
        if (phase.planningLock) {
            const gatesForPhase = (gates as RoadmapGate[]).filter(gate => gate.parentPhaseId === phase.id &&
                gate.draftAcceptance !== 'proposed').sort((a, b) => a.order - b.order);
            assertion(phase.gateSetCoverage.status === 'approved' &&
                sameRoadmapSource(phase.planningLock.source, phase.gateSetCoverage.source) &&
                JSON.stringify(phase.planningLock.requiredGateIds) === JSON.stringify(gatesForPhase.map(gate => gate.id)) &&
                JSON.stringify(phase.planningLock.criteria) === JSON.stringify(gatesForPhase.flatMap(gate =>
                    [...gate.criteria].sort((a, b) => a.order - b.order).map(c => ({ id: c.id, expectedResult: c.expectedResult })))),
                'phase planning lock basis');
        }
        if (phase.workLinks) {
            const criterionIds = new Set(phase.planningLock?.criteria.map(item => item.id));
            assertion(phase.workLinks.every(link => link.criterionIds.every(id => criterionIds.has(id))),
                'phase Work criterion membership');
        }
        if (phase.qualificationStatus === 'green')
            assertion(evaluatePhaseQualification(raw as unknown as RoadmapGateIndex, phase.id,
                phase.qualificationSource).status === 'green', 'unverified Phase Green');
        if (phase.qualificationStatus === 'waived') assertion(!!phase.exception, 'unreviewed Phase waiver');
    }
    if (raw.pendingPublication !== undefined) {
        const pending = raw.pendingPublication;
        assertion(record(pending) && keys(pending, ['approvalId', 'basisRevision', 'path', 'sourceHash', 'content']) &&
            identifier(pending.approvalId) && natural(pending.basisRevision) &&
            pending.basisRevision === (raw.revision as number) - 1 && path(pending.path) &&
            !String(pending.path).split('/').includes('.dope') && /\.md$/i.test(pending.path as string) &&
            hash(pending.sourceHash) && typeof pending.content === 'string' &&
            Buffer.byteLength(pending.content) <= 2 * 1024 * 1024 &&
            createHash('sha256').update(pending.content).digest('hex') === pending.sourceHash &&
            raw.linkedDocument === undefined, 'pending publication');
    }
    if (raw.linkedDocument !== undefined) {
        const doc = raw.linkedDocument;
        assertion(record(doc) && keys(doc, ['projectId', 'projectRoot', 'path', 'sourceHash', 'syncState', 'sections'],
            ['lastSynced', 'pending', 'publicationIntentHash', 'syncIntent']) &&
            doc.projectId === projectId && doc.projectRoot === projectRoot && path(doc.path) && /\.md$/i.test(doc.path) &&
            (doc.publicationIntentHash === undefined || hash(doc.publicationIntentHash)) &&
            hash(doc.sourceHash) && member(doc.syncState, ['synced', 'source-changed', 'conflict', 'pending-sync', 'missing',
                'syncing', 'failed', 'recoverable']) &&
            Array.isArray(doc.sections) && doc.sections.length <= MAX_ENTITIES, 'linked document');
        const sections = (doc as unknown as RoadmapGateLinkedDocument).sections;
        const sectionKeys = new Set<string>();
        const sectionIds = new Set<string>();
        for (const section of sections) {
            assertion(record(section) && keys(section, ['sectionKey', 'kind', 'id']) && identifier(section.sectionKey) &&
                member(section.kind, ['phase', 'gate', 'criterion', 'correction']) && identifier(section.id) &&
                ((doc as RoadmapGateLinkedDocument).syncIntent !== undefined || (section.kind === 'criterion' ? (gates as RoadmapGate[]).flatMap(gate => gate.criteria) :
                    section.kind === 'phase' ? phases : section.kind === 'gate' ? gates : corrections)
                    .some(e => (e as { id: string }).id === section.id)) &&
                !sectionKeys.has(section.sectionKey) && !sectionIds.has(section.id), 'linked section');
            sectionKeys.add(section.sectionKey); sectionIds.add(section.id);
        }
        const linked = doc as RoadmapGateLinkedDocument;
        if (linked.syncIntent !== undefined) {
            const intent = linked.syncIntent;
            assertion(record(intent) && keys(intent, ['revision', 'indexDigest', 'path', 'expectedSourceHash']) &&
                intent.revision === raw.revision && hash(intent.indexDigest) &&
                intent.path === linked.path && intent.expectedSourceHash === linked.sourceHash &&
                member(linked.syncState, ['pending-sync', 'syncing', 'failed', 'conflict', 'recoverable']),
            'linked automatic sync intent');
        }
        if (linked.lastSynced !== undefined) {
            const basis = linked.lastSynced;
            assertion(record(basis) && keys(basis, ['sourceHash', 'fields'], ['structure']) && hash(basis.sourceHash) &&
                Array.isArray(basis.fields) && basis.fields.length === sections.length &&
                basis.fields.every((field: unknown) => record(field) && keys(field, ['kind', 'id', 'title', 'detail']) &&
                    member(field.kind, ['phase', 'gate', 'criterion', 'correction']) && identifier(field.id) &&
                    prose(field.title, 512) && typeof field.detail === 'string' && field.detail.length <= 8192 &&
                    sections.some(section => section.id === field.id && section.kind === field.kind)) &&
                new Set(basis.fields.map((field: { id: string }) => field.id)).size === sections.length, 'linked basis');
            if (basis.structure !== undefined) {
                const shape = basis.structure;
                assertion(record(shape) && keys(shape, ['phases', 'gates', 'corrections']) &&
                    (['phases', 'gates', 'corrections'] as const).every(name => Array.isArray(shape[name]) &&
                        shape[name].length <= MAX_ENTITIES) &&
                    shape.phases.every((item: unknown) => record(item) && keys(item, ['id', 'order', 'dependencies']) &&
                        identifier(item.id) && natural(item.order) && Array.isArray(item.dependencies) &&
                        item.dependencies.every(identifier)) &&
                    shape.gates.every((item: unknown) => record(item) &&
                        keys(item, ['id', 'parentPhaseId', 'designation', 'order', 'dependencies', 'criteria']) &&
                        identifier(item.id) && identifier(item.parentPhaseId) && identifier(item.designation) &&
                        natural(item.order) && Array.isArray(item.dependencies) && item.dependencies.every(identifier) &&
                        Array.isArray(item.criteria) && item.criteria.every(identifier)) &&
                    shape.corrections.every((item: unknown) => record(item) &&
                        keys(item, ['id', 'parent', 'order'], ['criterionId']) && identifier(item.id) &&
                        record(item.parent) && keys(item.parent, ['kind', 'id']) &&
                        member(item.parent.kind, ['phase', 'gate']) && identifier(item.parent.id) &&
                        (item.criterionId === undefined || identifier(item.criterionId)) && natural(item.order)),
                'linked basis structure');
            }
        }
        if (linked.pending !== undefined) {
            const pending = linked.pending;
            assertion(record(pending) && keys(pending, ['basisRevision', 'beforeHash', 'afterHash', 'edit', 'outcome']) &&
                natural(pending.basisRevision) && hash(pending.beforeHash) && hash(pending.afterHash) &&
                member(pending.outcome, ['prepared', 'document-written', 'conflict']) &&
                record(pending.edit) && keys(pending.edit, ['kind', 'id'], ['title', 'detail']) &&
                member(pending.edit.kind, ['phase', 'gate', 'criterion']) && identifier(pending.edit.id) &&
                (pending.edit.title === undefined || prose(pending.edit.title, 512)) &&
                (pending.edit.detail === undefined || prose(pending.edit.detail, 8192)) &&
                linked.syncState === 'pending-sync', 'linked pending patch');
        }
    }
    return value as RoadmapGateIndex;
}
