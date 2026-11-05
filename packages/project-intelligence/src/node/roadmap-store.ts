import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link as hardLink, lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { discoverRoadmapCandidates, previewRoadmapImport } from './roadmap-import';
import { checkedRoadmapDocumentFile, planRoadmapDocumentPatch, publishRoadmapDocumentPatch } from './roadmap-document-patch';
import { readRoadmapMappedSections, previewRoadmapDocumentSync, previewRoadmapPendingRecovery } from './roadmap-document-sync';
import type { RoadmapMappedSection, RoadmapSyncPreview, RoadmapRelinkPreview, RoadmapPendingRecoveryPreview } from './roadmap-document-sync';
import type { RoadmapDocumentPatch } from './roadmap-document-patch';
import { gateField, gateIndexStructure, planGateDocumentPatch, previewGateDocumentSync, previewGateDocumentRelink, structureDiagnostics,
    readGateMappedDocument } from './roadmap-gate-document';
import type { GateDocumentEdit, GateDocumentPatch, GateDocumentSyncPreview, GateDocumentRelinkPreview,
    GateMappedField } from './roadmap-gate-document';
import type { RoadmapCitation, RoadmapImportPreview, RoadmapStatus } from './roadmap-import';
import { criterionHash, evaluateGateQualification, evaluatePhaseQualification, parseRoadmapGateIndex,
    sameRoadmapSource } from './roadmap-gate-domain';
import type { Criterion, GateEvidence, RoadmapCorrection, RoadmapGate, RoadmapGateIndex, RoadmapPhase, RoadmapSourceProof, PhaseWorkLink } from './roadmap-gate-domain';
import { checkedPublicationDestination, checkedPublicationPath, publicationHash, serializeRoadmapPublication,
    verifiedPublicationFile } from './roadmap-publication';
import type { RoadmapPublicationPreview, RoadmapExistingLinkPreview } from './roadmap-publication';
import { RoadmapRevisionArchive } from './roadmap-revision-archive';
import type { RoadmapRevisionList, RoadmapRevisionRecord } from './roadmap-revision-archive';
import { autoSyncIndexDigest, journalMatches, overlayAutoSync, prepareAutoSync, publishAutoSync, recoverAutoSyncBackup,
    readAutoSyncJournal, verifyAutoSync, withAutoSyncIntent, writeAutoSyncJournal } from './roadmap-auto-sync';
import type { RoadmapAutoSyncJournal } from './roadmap-auto-sync';
import type { RoadmapAutoSyncReconciliationPreview } from './roadmap-auto-sync';
import { describeEditableChanges, editableStructure, restoreEditableStructure } from './roadmap-restore';

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CHECKPOINTS = 4096;
const MAX_LINKS = 128;
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const autoSyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
const autoSyncInFlight = new Map<string, Promise<RoadmapGateIndex>>();
const autoSyncReschedule = new Set<string>();
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x1f]/.test(value);
const text = (value: unknown, limit: number): value is string => typeof value === 'string' && value.length <= limit && !value.includes('\0');
const status = (value: unknown): value is RoadmapStatus =>
    ['green', 'not-green', 'not-implemented', 'waived', 'active', 'unknown'].includes(value as string);
const fail = (reason: string): never => { throw new Error(`Invalid Roadmap index: ${reason}`); };

export interface RoadmapLink {
    owner: 'document' | 'project-mind' | 'issue' | 'planning-map' | 'transformation' | 'work-item' | 'evidence';
    targetId: string;
    ownerRevision?: number;
    sourceHash?: string;
    ownerProjectId?: string;
    basis?: { architectureRevision: number; architectureFingerprint: string; physicalInputFingerprint: string; physicalGeneration: number };
}
export interface RoadmapCheckpoint {
    id: string;
    kind: 'phase' | 'correction' | 'milestone';
    title: string;
    objective: string;
    order: number;
    dependencies: string[];
    /** Explicit correction membership, separate from graph dependencies. */
    parentPhaseId?: string;
    links: RoadmapLink[];
    status: RoadmapStatus;
    readOnly: boolean;
    source?: RoadmapCitation;
    evidence: RoadmapCitation[];
}
/** Bookkeeping for one explicitly accepted Markdown owner. No document write is implied. */
export interface RoadmapLinkedDocument {
    projectRoot: string;
    projectId: string;
    path: string;
    sourceHash: string;
    sections: { sectionKey: string; checkpointId: string }[];
    lastSynced: { sourceHash: string; roadmapRevision: number; fields?: Omit<RoadmapMappedSection, 'line' | 'heading'>[] };
    syncState: 'synced' | 'source-changed' | 'conflict' | 'pending-sync' | 'missing';
    pending?: { basisRevision: number; checkpointId: string; beforeHash: string; afterHash: string;
        title: string; objective: string; order: number; prose?: string; outcome: 'prepared' | 'document-written' | 'conflict' };
}
export interface RoadmapIndex {
    schemaVersion: 1;
    projectId: string;
    projectRoot: string;
    revision: number;
    checkpoints: RoadmapCheckpoint[];
    linkedDocument?: RoadmapLinkedDocument;
    /** Accepted creation intent. It is not a published Roadmap or a second draft store. */
    pendingCreation?: { path: string; sourceHash: string; content: string;
        topology?: { sectionKey: string; dependencies: string[]; parentPhaseKey?: string }[];
        planOrigin?: PendingPlanOrigin };
    /** Frozen provenance from a reviewed plan. The Roadmap and its linked source remain authoritative. */
    planOrigin?: RoadmapPlanOrigin;
}
export interface PendingPlanOrigin { planRevision: number; planHash: string; constraints: string[];
    steps: { stepId: string; sectionKey: string; expectedOutputs: string[] }[] }
export interface RoadmapPlanOrigin { planRevision: number; planHash: string; sourceHash: string; constraints: string[];
    steps: { stepId: string; checkpointId: string; expectedOutputs: string[] }[] }
export type GreenfieldTopology = NonNullable<RoadmapIndex['pendingCreation']>['topology'];
function validPlanOrigin(value: unknown, pending: boolean): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const origin = value as Record<string, unknown>;
    const keys = pending ? 'constraints,planHash,planRevision,steps' : 'constraints,planHash,planRevision,sourceHash,steps';
    if (Object.keys(origin).sort().join(',') !== keys || !revision(origin.planRevision) ||
        typeof origin.planHash !== 'string' || !/^[a-f0-9]{64}$/.test(origin.planHash) ||
        !pending && (typeof origin.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(origin.sourceHash)) ||
        !Array.isArray(origin.constraints) || origin.constraints.length > 32 ||
        origin.constraints.some(item => !text(item, 2048)) ||
        !Array.isArray(origin.steps) || !origin.steps.length || origin.steps.length > 128) return false;
    const seen = new Set<string>();
    return origin.steps.every((value: unknown) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const step = value as Record<string, unknown>;
        const key = pending ? 'sectionKey' : 'checkpointId';
        if (Object.keys(step).sort().join(',') !== ['expectedOutputs', key, 'stepId'].sort().join(',') ||
            !id(step.stepId) || !id(step[key]) || seen.has(step.stepId) ||
            !Array.isArray(step.expectedOutputs) || step.expectedOutputs.length > 16 ||
            step.expectedOutputs.some(item => !text(item, 1024))) return false;
        seen.add(step.stepId as string);
        return true;
    });
}
function validGreenfieldTopology(value: unknown): value is GreenfieldTopology {
    return Array.isArray(value) && value.length <= MAX_CHECKPOINTS &&
        value.every(item => item && typeof item === 'object' && !Array.isArray(item) &&
            Object.keys(item).sort().join(',') === (item.parentPhaseKey === undefined ?
                'dependencies,sectionKey' : 'dependencies,parentPhaseKey,sectionKey') &&
            typeof item.sectionKey === 'string' && item.sectionKey.length > 0 && item.sectionKey.length <= 256 &&
            (item.parentPhaseKey === undefined || typeof item.parentPhaseKey === 'string' &&
                item.parentPhaseKey.length > 0 && item.parentPhaseKey.length <= 256 && item.parentPhaseKey !== item.sectionKey) &&
            Array.isArray(item.dependencies) && item.dependencies.length <= MAX_LINKS &&
            item.dependencies.every((key: unknown) => typeof key === 'string' && key.length > 0 && key.length <= 256) &&
            new Set(item.dependencies).size === item.dependencies.length) &&
        new Set(value.map(item => item.sectionKey)).size === value.length;
}
/** Read-only evidence for a deliberate change of the active Markdown owner. */
export interface RoadmapReplacementPreview {
    state: 'ready' | 'review';
    projectId: string;
    revision: number;
    previousPath: string;
    previousHash: string;
    observedPreviousHash?: string;
    path: string;
    sourceHash: string;
    removedCheckpointIds: string[];
    addedCheckpointIds: string[];
    retainedCheckpointIds: string[];
    manualCheckpointIds: string[];
    /** Active checkpoint data and links on these IDs need an explicit P2 disposition. */
    atRiskCheckpointIds: string[];
    atRiskCheckpoints: { id: string; title: string; status: RoadmapStatus; dependencies: number; links: number }[];
    /** A replacement changes the active owner; it never deletes the previous Markdown. */
    replacementWarning: string;
    sections: { sectionKey: string; checkpointId: string; line: number }[];
    diagnostics: { path: string; line?: number; checkpointId?: string; message: string; severity: 'blocking' | 'warning' }[];
}
export interface RoadmapChange { root: string; projectId: string; revision: number; changedIds: string[] }
export interface RoadmapRestorePreview {
    approvalId: string;
    expiresAt: number;
    projectRoot: string;
    projectId: string;
    fromRevision: number;
    previousHeadRevision: number;
    historyHash: string;
    headHash: string;
    structureHash: string;
    changes: string[];
    resultingStructure: ReturnType<typeof editableStructure>;
    linkedDiff?: { path: string; beforeHash: string; afterHash: string; before: string; after: string };
    warnings: string[];
}
export interface FinishPlanningPreview {
    approvalId: string; projectRoot: string; projectId: string; phaseId: string; revision: number;
    headHash: string; expiresAt: number; requiredGateIds: string[];
    criteria: { id: string; expectedResult: string }[];
    source: RoadmapSourceProof;
}
export interface PhaseCoverageReview extends FinishPlanningPreview {}
export interface PhaseWorkReview {
    approvalId: string; projectRoot: string; projectId: string; phaseId: string;
    revision: number; headHash: string; expiresAt: number; planningRevision: number;
    lockApprovalId: string; links: PhaseWorkLink[];
    items: { id: string; title: string; acceptanceCriteria: string[]; validationTargets: string[];
        criterionIds: string[] }[];
}
export interface PhaseAmendmentReview {
    approvalId: string; projectRoot: string; projectId: string; phaseId: string;
    revision: number; headHash: string; expiresAt: number; reviewerId: string;
    operations: RoadmapGateMutation[]; before: string; after: string;
    affectedGateIds: string[]; affectedCriterionIds: string[]; affectedWorkItemIds: string[];
    source: RoadmapSourceProof;
}
export interface PhaseWorkPlanningSnapshot { projectId: string; revision: number;
    maps: { id: string; projectId: string; revision: number; status: string; basis: PhaseWorkLink['basis'];
        transformations: { id: string }[]; workItems: { id: string; title: string; status: string;
            transformationIds: string[]; acceptanceCriteria: string[]; validationTargets: string[] }[] }[] }
function phasePlanningDefinition(index: RoadmapGateIndex, phaseId: string): string {
    const phase = index.phases.find(item => item.id === phaseId);
    return JSON.stringify({ phase: phase && [phase.title, phase.objective, phase.order, phase.dependencies, phase.draftAcceptance],
        gates: index.gates.filter(item => item.parentPhaseId === phaseId).sort((a, b) => a.order - b.order)
            .map(item => [item.id, item.designation, item.title, item.purpose, item.order, item.dependencies,
                item.draftAcceptance, item.criteria.map(c => [c.id, c.title, c.expectedResult, c.order])]),
        corrections: index.corrections.filter(item => item.parent.kind === 'phase' ? item.parent.id === phaseId :
            index.gates.find(gate => gate.id === item.parent.id)?.parentPhaseId === phaseId)
            .map(item => [item.id, item.parent, item.criterionId, item.title, item.objective, item.order, item.draftAcceptance]) });
}
function amendmentImpact(before: RoadmapGateIndex, after: RoadmapGateIndex, phaseId: string):
    Pick<PhaseAmendmentReview, 'affectedGateIds' | 'affectedCriterionIds' | 'affectedWorkItemIds'> {
    const oldPhase = before.phases.find(item => item.id === phaseId);
    const newPhase = after.phases.find(item => item.id === phaseId);
    if (!oldPhase?.planningLock || !newPhase) throw new Error('Amendment requires an existing locked Phase');
    const phaseChanged = JSON.stringify([oldPhase.title, oldPhase.objective, oldPhase.dependencies]) !==
        JSON.stringify([newPhase.title, newPhase.objective, newPhase.dependencies]);
    const gateBasis = (index: RoadmapGateIndex, id: string): unknown => {
        const gate = index.gates.find(item => item.id === id && item.parentPhaseId === phaseId);
        return gate && [gate.designation, gate.title, gate.purpose, gate.dependencies, gate.draftAcceptance];
    };
    const gateIds = new Set([...before.gates, ...after.gates]
        .filter(item => item.parentPhaseId === phaseId).map(item => item.id));
    const affectedCriterionIds: string[] = [];
    const affectedGateIds = [...gateIds].filter(id => {
        const oldGate = before.gates.find(item => item.id === id);
        const newGate = after.gates.find(item => item.id === id);
        const gateChanged = phaseChanged || JSON.stringify(gateBasis(before, id)) !==
            JSON.stringify(gateBasis(after, id));
        const criterionIds = new Set([...(oldGate?.criteria ?? []), ...(newGate?.criteria ?? [])]
            .map(item => item.id));
        for (const criterionId of criterionIds) {
            const oldCriterion = oldGate?.criteria.find(item => item.id === criterionId);
            const newCriterion = newGate?.criteria.find(item => item.id === criterionId);
            if (gateChanged || JSON.stringify(oldCriterion && [oldCriterion.title, oldCriterion.expectedResult]) !==
                JSON.stringify(newCriterion && [newCriterion.title, newCriterion.expectedResult]))
                affectedCriterionIds.push(criterionId);
        }
        return gateChanged || affectedCriterionIds.some(criterionId => criterionIds.has(criterionId));
    });
    const affectedWorkItemIds = [...new Set((oldPhase.workLinks ?? [])
        .filter(link => link.criterionIds.some(id => affectedCriterionIds.includes(id)))
        .map(link => link.workItemId))];
    return { affectedGateIds, affectedCriterionIds, affectedWorkItemIds };
}
export type RoadmapMutation =
    | { type: 'create'; id: string; kind: RoadmapCheckpoint['kind']; title: string; objective: string; order: number; dependencies?: string[]; links?: RoadmapLink[] }
    | { type: 'update'; id: string; title: string; objective: string; order: number; dependencies: string[]; links: RoadmapLink[] };

/** Explicit owner actions. Model suggestions must be reviewed before becoming one of these operations. */
export type RoadmapGateMutation =
    | { type: 'phase.create'; id: string; title: string; objective: string }
    | { type: 'phase.edit'; id: string; title: string; objective: string }
    | { type: 'phase.delete'; id: string }
    | { type: 'phase.reorder'; ids: string[] }
    | { type: 'phase.dependencies'; id: string; dependencies: string[] }
    | { type: 'gate.create'; id: string; parentPhaseId: string; designation: string; title: string; purpose: string;
        criteria: { id: string; title: string; expectedResult: string }[] }
    | { type: 'gate.edit'; id: string; title: string; purpose: string }
    | { type: 'gate.delete'; id: string }
    | { type: 'gate.reparent'; id: string; parentPhaseId: string; order: number }
    | { type: 'gate.reorder'; parentPhaseId: string; ids: string[] }
    | { type: 'gate.dependencies'; id: string; dependencies: string[] }
    | { type: 'criterion.add'; gateId: string; id: string; title: string; expectedResult: string }
    | { type: 'criterion.edit'; gateId: string; id: string; title: string; expectedResult: string }
    | { type: 'criterion.remove'; gateId: string; id: string }
    | { type: 'criterion.reorder'; gateId: string; ids: string[] }
    | { type: 'correction.attach'; id: string; parent: RoadmapCorrection['parent']; criterionId?: string;
        title: string; objective: string }
    | { type: 'correction.edit'; id: string; title: string; objective: string }
    | { type: 'correction.reparent'; id: string; parent: RoadmapCorrection['parent']; criterionId?: string }
    | { type: 'correction.delete'; id: string }
    | { type: 'evidence.propose'; gateId: string; criterionId: string; id: string;
        result: GateEvidence['result']; kind: GateEvidence['kind']; summary: string; verifiedBy: string;
        observedAt: string; source?: RoadmapSourceProof; observedAction?: string;
        receipt?: GateEvidence['receipt'] }
    | { type: 'evidence.approve'; gateId: string; criterionId: string; id: string;
        reviewerId: string; reviewedAt: string; currentSource?: RoadmapSourceProof }
    | { type: 'evidence.revoke'; gateId: string; criterionId: string; id: string;
        reviewerId: string; reviewedAt: string }
    | { type: 'gate.source'; id: string; source: RoadmapSourceProof }
    | { type: 'gate.blockers'; id: string; reasons: string[] }
    | { type: 'gate.waiver.approve'; id: string; authorizedBy: string; authorizedAt: string;
        reason: string; source: RoadmapSourceProof }
    | { type: 'gate.waiver.revoke'; id: string }
    | { type: 'phase.coverage.approve'; id: string; requiredGateIds: string[];
        approvedBy: string; reviewedAt: string; source: RoadmapSourceProof }
    | { type: 'phase.coverage.revoke'; id: string }
    | { type: 'phase.source'; id: string; source: RoadmapSourceProof }
    | { type: 'phase.blockers'; id: string; reasons: string[] }
    | { type: 'phase.waiver.approve'; id: string; authorizedBy: string; authorizedAt: string;
        reason: string; source: RoadmapSourceProof }
    | { type: 'phase.waiver.revoke'; id: string };

function citation(value: unknown): value is RoadmapCitation {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    return text(item.path, 512) && !item.path.startsWith('/') && !item.path.split('/').includes('..') &&
        typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256) &&
        Number.isSafeInteger(item.line) && (item.line as number) > 0 && text(item.text, 4096) &&
        (item.status === undefined || status(item.status)) && (item.statusText === undefined || text(item.statusText, 4096));
}
function link(value: unknown): value is RoadmapLink {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    const planning = ['planning-map', 'transformation', 'work-item'].includes(item.owner as string);
    const basis = item.basis as Record<string, unknown> | undefined;
    return ['document', 'project-mind', 'issue', 'planning-map', 'transformation', 'work-item', 'evidence'].includes(item.owner as string) &&
        id(item.targetId) && (item.ownerRevision === undefined || revision(item.ownerRevision)) &&
        (item.sourceHash === undefined || typeof item.sourceHash === 'string' && /^[a-f0-9]{64}$/.test(item.sourceHash)) &&
        (planning ? id(item.ownerProjectId) && item.ownerRevision !== undefined && item.sourceHash === undefined &&
            !!basis && typeof basis === 'object' && !Array.isArray(basis) &&
            Object.keys(basis).sort().join(',') === 'architectureFingerprint,architectureRevision,physicalGeneration,physicalInputFingerprint' &&
            revision(basis.architectureRevision) && revision(basis.physicalGeneration) &&
            typeof basis.architectureFingerprint === 'string' && !!basis.architectureFingerprint &&
            typeof basis.physicalInputFingerprint === 'string' && !!basis.physicalInputFingerprint :
            item.ownerProjectId === undefined && item.basis === undefined);
}
function linkedDocument(value: unknown, raw: Record<string, unknown>, checkpoints: RoadmapCheckpoint[]): value is RoadmapLinkedDocument {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    if (Object.keys(item).sort().join(',') !== (item.pending === undefined ?
        'lastSynced,path,projectId,projectRoot,sections,sourceHash,syncState' :
        'lastSynced,path,pending,projectId,projectRoot,sections,sourceHash,syncState') ||
        item.projectRoot !== raw.projectRoot || item.projectId !== raw.projectId ||
        !text(item.path, 512) || !item.path || isAbsolute(item.path) || !/\.md$/i.test(item.path) ||
        item.path.includes('\\') || item.path.includes(':') ||
        item.path.split('/').some(part => !part || part === '.' || part === '..') ||
        typeof item.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(item.sourceHash) ||
        !['synced', 'source-changed', 'conflict', 'pending-sync', 'missing'].includes(item.syncState as string) ||
        !Array.isArray(item.sections) || item.sections.length > MAX_CHECKPOINTS) return false;
    const pending = item.pending as Record<string, unknown> | undefined;
    if ((item.syncState === 'pending-sync') !== !!pending) return false;
    if (pending && (typeof pending !== 'object' || Array.isArray(pending) ||
        Object.keys(pending).sort().join(',') !== (pending.prose === undefined ?
            'afterHash,basisRevision,beforeHash,checkpointId,objective,order,outcome,title' :
            'afterHash,basisRevision,beforeHash,checkpointId,objective,order,outcome,prose,title') ||
        !revision(pending.basisRevision) || (raw.revision as number) - (pending.basisRevision as number) < 1 ||
            (raw.revision as number) - (pending.basisRevision as number) > 3 ||
        !id(pending.checkpointId) || !text(pending.title, 512) || !text(pending.objective, 8192) ||
        !revision(pending.order) || pending.prose !== undefined && !text(pending.prose, 8192) ||
        typeof pending.beforeHash !== 'string' || !/^[a-f0-9]{64}$/.test(pending.beforeHash) ||
        typeof pending.afterHash !== 'string' || !/^[a-f0-9]{64}$/.test(pending.afterHash) ||
        !['prepared', 'document-written', 'conflict'].includes(pending.outcome as string) ||
        pending.beforeHash !== item.sourceHash || !checkpoints.some(checkpoint => (checkpoint as RoadmapCheckpoint).id === pending.checkpointId))) return false;
    const basis = item.lastSynced as Record<string, unknown> | undefined;
    if (!basis || typeof basis !== 'object' || Array.isArray(basis) ||
        Object.keys(basis).sort().join(',') !== (basis.fields === undefined ? 'roadmapRevision,sourceHash' : 'fields,roadmapRevision,sourceHash') ||
        !revision(basis.roadmapRevision) || (basis.roadmapRevision as number) > (raw.revision as number) ||
        typeof basis.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(basis.sourceHash)) return false;
    if (basis.fields !== undefined && (!Array.isArray(basis.fields) || basis.fields.length !== item.sections.length ||
        basis.fields.some((value: unknown) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
            const field = value as Record<string, unknown>;
            return !id(field.checkpointId) || !text(field.title, 512) ||
                (field.objective !== undefined && !text(field.objective, 8192)) ||
                (field.prose !== undefined && !text(field.prose, 8192)) ||
                (field.order !== undefined && !revision(field.order)) ||
                Object.keys(field).some(key => !['checkpointId', 'title', 'objective', 'order', 'prose'].includes(key));
        }))) return false;
    const keys = new Set<string>();
    const ids = new Set<string>();
    const byId = new Map(checkpoints.map(checkpoint => [checkpoint.id, checkpoint]));
    for (const entry of item.sections) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
        const section = entry as Record<string, unknown>;
        if (Object.keys(section).sort().join(',') !== 'checkpointId,sectionKey' ||
            !id(section.sectionKey) || !id(section.checkpointId) ||
            keys.has(section.sectionKey) || ids.has(section.checkpointId)) return false;
        const checkpoint = byId.get(section.checkpointId);
        if (!checkpoint?.source || checkpoint.source.path !== item.path) return false;
        keys.add(section.sectionKey);
        ids.add(section.checkpointId);
    }
    if (basis.fields && (new Set((basis.fields as RoadmapMappedSection[]).map(field => field.checkpointId)).size !== item.sections.length ||
        (basis.fields as RoadmapMappedSection[]).some(field => !ids.has(field.checkpointId)))) return false;
    return true;
}

/** The authoritative schema-2 validator used by both reads and writes. */
export function parseRoadmapIndex(value: unknown, root: string): RoadmapGateIndex {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('document');
    const candidate = value as Record<string, unknown>;
    if (candidate.schemaVersion !== 2 || !id(candidate.projectId)) fail('schema');
    return parseRoadmapGateIndex(value, root, candidate.projectId as string);
}

/** Compile-only bridge for the checkpoint callers being removed by P17. Never reads or writes schema 1. */
export function parseRetiredCheckpointIndex(value: unknown, root: string): RoadmapIndex {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('document');
    const raw = value as Record<string, unknown>;
    if (Object.keys(raw).sort().join(',') !== ['checkpoints', 'projectId', 'projectRoot', 'revision', 'schemaVersion',
        ...(raw.linkedDocument === undefined ? [] : ['linkedDocument']),
        ...(raw.pendingCreation === undefined ? [] : ['pendingCreation']),
        ...(raw.planOrigin === undefined ? [] : ['planOrigin'])].sort().join(',') ||
        raw.schemaVersion !== 1 || !id(raw.projectId) || raw.projectId === 'uninitialized' ||
        raw.projectRoot !== root || !revision(raw.revision) || raw.revision === 0 || !Array.isArray(raw.checkpoints) ||
        raw.checkpoints.length > MAX_CHECKPOINTS) fail('schema or project root');
    if (raw.pendingCreation !== undefined) {
        const pending = raw.pendingCreation as Record<string, unknown>;
        if (!pending || typeof pending !== 'object' || Array.isArray(pending) ||
            Object.keys(pending).sort().join(',') !== ['content', 'path', 'sourceHash',
                ...(pending.topology === undefined ? [] : ['topology']),
                ...(pending.planOrigin === undefined ? [] : ['planOrigin'])].sort().join(',') ||
            (pending.topology !== undefined && !validGreenfieldTopology(pending.topology)) ||
            (pending.planOrigin !== undefined && !validPlanOrigin(pending.planOrigin, true)) ||
            !text(pending.path, 512) || !pending.path || isAbsolute(pending.path) ||
            !/\.md$/i.test(pending.path) || pending.path.includes('\\') || pending.path.includes(':') ||
            pending.path.split('/').some(part => !part || part === '.' || part === '..') ||
            pending.path.split('/')[0] === '.dope' ||
            !text(pending.content, 2 * 1024 * 1024) ||
            Buffer.byteLength(pending.content as string) > 2 * 1024 * 1024 ||
            createHash('sha256').update(pending.content as string).digest('hex') !== pending.sourceHash ||
            raw.linkedDocument !== undefined || (raw.checkpoints as unknown[]).length !== 0 || raw.revision !== 1)
            fail('pending creation');
    }
    const checkpoints = raw.checkpoints as unknown[];
    const seen = new Set<string>();
    for (const value of checkpoints) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) fail('checkpoint');
        const item = value as Record<string, unknown>;
        if (Object.keys(item).sort().join(',') !== [
            'dependencies', 'evidence', 'id', 'kind', 'links', 'objective', 'order', 'readOnly', 'status', 'title',
            ...(item.source === undefined ? [] : ['source']),
            ...(item.parentPhaseId === undefined ? [] : ['parentPhaseId'])].sort().join(',') ||
            !id(item.id) || seen.has(item.id) || !['phase', 'correction', 'milestone'].includes(item.kind as string) ||
            !text(item.title, 512) || !text(item.objective, 8192) || !Number.isSafeInteger(item.order) ||
            (item.order as number) < 0 || !Array.isArray(item.dependencies) || item.dependencies.length > MAX_LINKS ||
            item.dependencies.some(dep => !id(dep) || dep === item.id) || new Set(item.dependencies).size !== item.dependencies.length ||
            (item.parentPhaseId !== undefined && (item.kind !== 'correction' || !id(item.parentPhaseId) || item.parentPhaseId === item.id)) ||
            !Array.isArray(item.links) || item.links.length > MAX_LINKS || item.links.some(ref => !link(ref)) ||
            !status(item.status) || typeof item.readOnly !== 'boolean' ||
            (item.source === undefined ? item.readOnly : !citation(item.source)) ||
            !Array.isArray(item.evidence) || item.evidence.length > MAX_LINKS || item.evidence.some(ref => !citation(ref))) fail('checkpoint fields');
        seen.add(item.id as string);
    }
    const byId = new Map((checkpoints as RoadmapCheckpoint[]).map(item => [item.id, item]));
    if (raw.planOrigin !== undefined && (!validPlanOrigin(raw.planOrigin, false) ||
        raw.pendingCreation !== undefined || !raw.linkedDocument))
        fail('plan provenance');
    for (const item of checkpoints as RoadmapCheckpoint[]) if (item.parentPhaseId &&
        byId.get(item.parentPhaseId)?.kind !== 'phase') fail('correction phase membership');
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (checkpointId: string): void => {
        if (visiting.has(checkpointId)) fail('dependency cycle');
        if (visited.has(checkpointId)) return;
        const checkpoint = byId.get(checkpointId);
        if (!checkpoint) throw new Error('Invalid Roadmap index: missing dependency');
        visiting.add(checkpointId);
        for (const dependency of checkpoint.dependencies) visit(dependency);
        visiting.delete(checkpointId);
        visited.add(checkpointId);
    };
    for (const checkpointId of byId.keys()) visit(checkpointId);
    if (raw.linkedDocument !== undefined && !linkedDocument(raw.linkedDocument, raw, checkpoints as RoadmapCheckpoint[]))
        fail('linked document');
    return value as RoadmapIndex;
}

export class RoadmapStore {
    private readonly archive = new RoadmapRevisionArchive();
    private readonly listeners = new Set<(change: RoadmapChange) => void>();
    private readonly publicationReviews = new Map<string, RoadmapPublicationPreview>();
    private readonly existingLinkReviews = new Map<string, RoadmapExistingLinkPreview>();
    private readonly reconciliationReviews = new Map<string, RoadmapAutoSyncReconciliationPreview>();
    private readonly restoreReviews = new Map<string, RoadmapRestorePreview>();
    private readonly planningReviews = new Map<string, FinishPlanningPreview>();
    private readonly coverageReviews = new Map<string, PhaseCoverageReview>();
    private readonly reopenReviews = new Map<string, FinishPlanningPreview>();
    private readonly phaseWorkReviews = new Map<string, PhaseWorkReview>();
    private readonly amendmentReviews = new Map<string, PhaseAmendmentReview>();
    private readonly planningConflictProbes = new Set<(root: string, projectId: string) => boolean | Promise<boolean>>();

    /** Chat proposal owners register their live pending state with the canonical writer. */
    onPlanningConflict(probe: (root: string, projectId: string) => boolean | Promise<boolean>): () => void {
        this.planningConflictProbes.add(probe);
        return () => this.planningConflictProbes.delete(probe);
    }

    onChange(listener: (change: RoadmapChange) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private async paths(root: string): Promise<{ directory: string; file: string; lock: string }> {
        if (typeof root !== 'string' || !isAbsolute(root) || resolve(root) !== root ||
            await realpath(root) !== root || !(await stat(root)).isDirectory()) throw new Error('Roadmap requires a canonical local root');
        const directory = join(root, '.dope');
        try {
            const info = await lstat(directory);
            if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory) throw new Error('Unsafe Roadmap directory');
        } catch (error) { if (!missing(error)) throw error; }
        return { directory, file: join(directory, 'roadmap.json'), lock: join(directory, 'roadmap.lock') };
    }

    private async regular(file: string): Promise<boolean> {
        try {
            const info = await lstat(file);
            if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsafe Roadmap file: ${file}`);
            if (info.size > MAX_BYTES) throw new Error('Roadmap index size limit exceeded');
            return true;
        } catch (error) { if (missing(error)) return false; throw error; }
    }

    /** Runtime value is schema 2; the generic default temporarily keeps downstream checkpoint imports compiling. */
    async read<T extends RoadmapIndex | RoadmapGateIndex = RoadmapIndex>(root: string,
        options?: { scheduleAutoSync?: boolean }): Promise<T> {
        const { file } = await this.paths(root);
        if (!(await this.regular(file))) return { schemaVersion: 2, projectId: 'uninitialized', projectRoot: root,
            revision: 0, phases: [], gates: [], corrections: [] } as unknown as T;
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const info = await handle.stat();
            if (!info.isFile() || info.size > MAX_BYTES) throw new Error('Unsafe Roadmap file');
            const bytes = await handle.readFile();
            if (bytes.length > MAX_BYTES) throw new Error('Roadmap index size limit exceeded');
            const guidance = 'Review the index before an explicitly approved reinitialize or reimport; no source files were changed';
            let parsed: unknown;
            try { parsed = JSON.parse(bytes.toString('utf8')); }
            catch { throw new Error(`Corrupt or unsupported Roadmap index: ${file}. ${guidance}`); }
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
                'schemaVersion' in parsed && parsed.schemaVersion !== 2)
                throw new Error(`Incompatible Roadmap index schema: ${file}. ${guidance}`);
            try {
                const index = parseRoadmapIndex(parsed, root);
                const journal = index.linkedDocument?.syncIntent ? await readAutoSyncJournal(root) : undefined;
                if (options?.scheduleAutoSync !== false && index.linkedDocument?.syncIntent && (!journalMatches(index, journal) ||
                    journal?.status === 'pending' || journal?.status === 'recoverable' || journal?.status === 'syncing'))
                    this.scheduleAutoSync(root);
                return overlayAutoSync(index, journal) as T;
            }
            catch { throw new Error(`Corrupt or unsupported Roadmap index: ${file}. ${guidance}`); }
        } finally { await handle.close(); }
    }

    private async canonicalBytes(root: string): Promise<Buffer | undefined> {
        const { file } = await this.paths(root);
        if (!(await this.regular(file))) return undefined;
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try { const bytes = await handle.readFile(); if (bytes.length > MAX_BYTES) throw new Error('Roadmap index size limit exceeded');
            parseRoadmapIndex(JSON.parse(bytes.toString('utf8')), root); return bytes; }
        finally { await handle.close(); }
    }

    /** Explicit one-time capture; callers may activate history without changing the current index. */
    async initializeRevisionArchive(root: string, expectedProjectId: string): Promise<void> {
        await this.locked(root, async () => {
            const bytes = await this.canonicalBytes(root);
            if (!bytes || JSON.parse(bytes.toString('utf8')).projectId !== expectedProjectId)
                throw new Error('Foreign or uninitialized Roadmap archive');
            await this.archive.initialize(root, bytes);
        });
    }
    async listRevisions(root: string, expectedProjectId: string, before?: number, limit?: number): Promise<RoadmapRevisionList> {
        return this.archive.list(root, await this.canonicalBytes(root), expectedProjectId, before, limit);
    }
    async fetchRevision(root: string, expectedProjectId: string, revision: number): Promise<RoadmapRevisionRecord> {
        return this.archive.fetch(root, await this.canonicalBytes(root), expectedProjectId, revision);
    }

    private async coverageBasis(root: string, index: RoadmapGateIndex, phaseId: string): Promise<
        Pick<PhaseCoverageReview, 'requiredGateIds' | 'criteria' | 'source'>> {
        const phase = index.phases.find(item => item.id === phaseId);
        if (!phase || phase.draftAcceptance === 'proposed' || phase.planningLock && !phase.amendment)
            throw new Error('Missing, proposed or locked Roadmap Phase');
        if (index.pendingPublication || index.linkedDocument?.pending || index.linkedDocument?.syncIntent ||
            autoSyncInFlight.has(root)) throw new Error('Pending Roadmap source operation requires recovery');
        for (const probe of this.planningConflictProbes)
            if (await probe(root, index.projectId)) throw new Error('Pending Roadmap proposal requires review');
        const gates = index.gates.filter(item => item.parentPhaseId === phaseId).sort((a, b) => a.order - b.order);
        if (!gates.length || gates.some(item => item.draftAcceptance === 'proposed'))
            throw new Error('Required Gate set is empty or has unresolved proposals');
        if (index.corrections.some(item => item.draftAcceptance === 'proposed' &&
            (item.parent.kind === 'phase' ? item.parent.id === phaseId :
                gates.some(gate => gate.id === item.parent.id))))
            throw new Error('Phase has unresolved correction proposals');
        if (phase.dependencies.some(id => !index.phases.some(item => item.id === id &&
            item.draftAcceptance !== 'proposed')) || gates.some(gate => gate.dependencies.some(id =>
            !index.gates.some(item => item.id === id && item.draftAcceptance !== 'proposed'))))
            throw new Error('Phase or Gate dependency is unresolved');
        if (gates.some(gate => !gate.title.trim() || !gate.purpose.trim() || !gate.criteria.length ||
            gate.criteria.some(item => !item.title.trim() || !item.expectedResult.trim())))
            throw new Error('Required Gate Criteria are incomplete');
        const criteria = gates.flatMap(gate => [...gate.criteria].sort((a, b) => a.order - b.order)
            .map(item => ({ id: item.id, expectedResult: item.expectedResult })));
        const headHash = await this.gateIndexHash(root);
        if (!headHash) throw new Error('Missing Roadmap source');
        const linked = index.linkedDocument;
        if (linked) {
            if (linked.projectId !== index.projectId || linked.projectRoot !== root ||
                linked.syncState !== 'synced' || linked.lastSynced?.sourceHash !== linked.sourceHash)
                throw new Error('Linked Roadmap source is stale or unresolved');
            const mapped = await readGateMappedDocument(root, linked);
            if (mapped.hash !== linked.sourceHash || mapped.diagnostics.length ||
                structureDiagnostics(index, mapped).length)
                throw new Error('Linked Roadmap source is stale or ambiguous');
        }
        return { requiredGateIds: gates.map(item => item.id), criteria,
            source: { projectId: index.projectId, revision: index.revision,
                ...(linked ? { path: linked.path, sha256: linked.sourceHash } : { sha256: headHash }) } };
    }

    async previewPhaseCoverage(root: string, projectId: string, revision: number,
        phaseId: string): Promise<PhaseCoverageReview> {
        const index = await this.read<RoadmapGateIndex>(root);
        if (!index.revision || index.projectId !== projectId || index.revision !== revision)
            throw new Error('Stale or foreign Roadmap coverage basis');
        const basis = await this.coverageBasis(root, index, phaseId);
        const headHash = await this.gateIndexHash(root);
        if (!headHash) throw new Error('Missing Roadmap source');
        const review: PhaseCoverageReview = { approvalId: randomUUID(), projectRoot: root, projectId,
            phaseId, revision, headHash, expiresAt: Date.now() + 5 * 60_000, ...basis };
        this.coverageReviews.set(review.approvalId, structuredClone(review));
        if (this.coverageReviews.size > 32) this.coverageReviews.delete(this.coverageReviews.keys().next().value!);
        return review;
    }

    async approvePhaseCoverage(root: string, review: PhaseCoverageReview, approved: boolean,
        reviewerId: string): Promise<RoadmapGateIndex> {
        const issued = this.coverageReviews.get(review.approvalId);
        this.coverageReviews.delete(review.approvalId);
        if (!approved || !id(reviewerId) || !issued || JSON.stringify(issued) !== JSON.stringify(review) ||
            review.expiresAt < Date.now() || review.projectRoot !== root)
            throw new Error('Stale or unissued Gate-set coverage approval');
        const index = await this.read<RoadmapGateIndex>(root);
        if (index.projectId !== review.projectId || index.revision !== review.revision ||
            await this.gateIndexHash(root) !== review.headHash ||
            JSON.stringify(await this.coverageBasis(root, index, review.phaseId)) !==
                JSON.stringify({ requiredGateIds: review.requiredGateIds, criteria: review.criteria, source: review.source }))
            throw new Error('Reviewed Gate-set coverage basis changed');
        return this.mutateGateIndex(root, review.revision, review.projectId,
            { type: 'phase.coverage.approve', id: review.phaseId, requiredGateIds: review.requiredGateIds,
                approvedBy: reviewerId, reviewedAt: new Date().toISOString(), source: review.source }, false,
            { indexHash: review.headHash, operationIds: [`phase-coverage-approve:${review.phaseId}`,
                `coverage-approval:${review.approvalId}`] });
    }

    private async checkedPlanningBasis(root: string, index: RoadmapGateIndex, phaseId: string): Promise<
        Pick<FinishPlanningPreview, 'requiredGateIds' | 'criteria' | 'source'>> {
        const phase = index.phases.find(item => item.id === phaseId);
        if (!phase || phase.draftAcceptance === 'proposed') throw new Error('Missing or proposed Roadmap Phase');
        if (phase.planningLock) throw new Error('Phase planning is already locked');
        if (index.pendingPublication || index.linkedDocument?.pending || index.linkedDocument?.syncIntent ||
            autoSyncInFlight.has(root)) throw new Error('Pending Roadmap source operation requires recovery');
        for (const probe of this.planningConflictProbes)
            if (await probe(root, index.projectId)) throw new Error('Pending Roadmap proposal requires review');
        const owned = index.gates.filter(item => item.parentPhaseId === phaseId).sort((a, b) => a.order - b.order);
        if (!owned.length || owned.some(item => item.draftAcceptance === 'proposed'))
            throw new Error('Required Gate set is empty or has unresolved proposals');
        if (index.corrections.some(item => item.draftAcceptance === 'proposed' &&
            (item.parent.kind === 'phase' ? item.parent.id === phaseId :
                owned.some(gate => gate.id === item.parent.id))))
            throw new Error('Phase has unresolved correction proposals');
        if (phase.dependencies.some(id => !index.phases.some(item => item.id === id &&
            item.draftAcceptance !== 'proposed')) || owned.some(gate => gate.dependencies.some(id =>
            !index.gates.some(item => item.id === id && item.draftAcceptance !== 'proposed'))))
            throw new Error('Phase or Gate dependency is unresolved');
        if (phase.gateSetCoverage.status !== 'approved') throw new Error('Complete Gate-set coverage approval required');
        const requiredGateIds = owned.map(item => item.id);
        if (JSON.stringify([...requiredGateIds].sort()) !== JSON.stringify([...phase.gateSetCoverage.requiredGateIds].sort()))
            throw new Error('Approved Gate set changed');
        const criteria = owned.flatMap(gate => [...gate.criteria].sort((a, b) => a.order - b.order)
            .map(item => ({ id: item.id, expectedResult: item.expectedResult })));
        if (!criteria.length || criteria.some(item => !item.expectedResult.trim()) ||
            owned.some(gate => !gate.title.trim() || !gate.purpose.trim() || !gate.criteria.length ||
                gate.criteria.some(item => !item.title.trim())))
            throw new Error('Required Gate Criteria are incomplete');
        const coverageSource = phase.gateSetCoverage.source;
        if (coverageSource.projectId !== index.projectId ||
            coverageSource.revision > index.revision || !phase.qualificationSource ||
            !sameRoadmapSource(coverageSource, phase.qualificationSource))
            throw new Error('Gate-set approval source is stale or foreign');
        if (index.linkedDocument) {
            const linked = index.linkedDocument;
            if (linked.projectId !== index.projectId || linked.projectRoot !== root ||
                linked.syncState !== 'synced' || linked.lastSynced?.sourceHash !== linked.sourceHash ||
                coverageSource.path !== linked.path || coverageSource.sha256 !== linked.sourceHash)
                throw new Error('Linked Roadmap source or coverage hash changed');
            const mapped = await readGateMappedDocument(root, linked);
            if (mapped.hash !== linked.sourceHash || mapped.diagnostics.length ||
                structureDiagnostics(index, mapped).length)
                throw new Error('Linked Roadmap source is stale or ambiguous');
        }
        return { requiredGateIds, criteria, source: structuredClone(coverageSource) };
    }

    /** Issue an exact review of the Phase, required Gate order, expected results and source. */
    async previewFinishPlanning(root: string, expectedProjectId: string, expectedRevision: number,
        phaseId: string): Promise<FinishPlanningPreview> {
        const current = await this.read<RoadmapGateIndex>(root);
        if (!current.revision || current.projectId !== expectedProjectId || current.revision !== expectedRevision)
            throw new Error('Stale or foreign Roadmap planning basis');
        const basis = await this.checkedPlanningBasis(root, current, phaseId);
        const headHash = await this.gateIndexHash(root);
        if (!headHash) throw new Error('Missing Roadmap planning basis');
        const preview: FinishPlanningPreview = { approvalId: randomUUID(), projectRoot: root,
            projectId: expectedProjectId, phaseId, revision: current.revision, headHash,
            expiresAt: Date.now() + 5 * 60_000, ...basis };
        this.planningReviews.set(preview.approvalId, structuredClone(preview));
        if (this.planningReviews.size > 32) this.planningReviews.delete(this.planningReviews.keys().next().value!);
        return preview;
    }

    /** One-use owner confirmation writes only the canonical Phase lock and one History revision. */
    async finishPlanning(root: string, preview: FinishPlanningPreview, approved: boolean,
        reviewerId: string): Promise<RoadmapGateIndex> {
        if (!approved) { this.planningReviews.delete(preview.approvalId); throw new Error('Planning approval required'); }
        const issued = this.planningReviews.get(preview.approvalId);
        this.planningReviews.delete(preview.approvalId);
        if (!id(reviewerId) || !issued || JSON.stringify(issued) !== JSON.stringify(preview) ||
            preview.expiresAt < Date.now() || preview.projectRoot !== root)
            throw new Error('Stale or unissued planning approval');
        const next = await this.locked(root, async () => {
            const { file } = await this.paths(root);
            const hash = await this.indexHash(file);
            const current = await this.read<RoadmapGateIndex>(root);
            if (hash !== preview.headHash || current.projectId !== preview.projectId ||
                current.revision !== preview.revision) throw new Error('Stale Roadmap planning revision');
            const basis = await this.checkedPlanningBasis(root, current, preview.phaseId);
            if (JSON.stringify(basis) !== JSON.stringify({ requiredGateIds: preview.requiredGateIds,
                criteria: preview.criteria, source: preview.source }))
                throw new Error('Reviewed Gate-set basis changed');
            const result = structuredClone(current);
            result.revision++;
            result.phases.find(item => item.id === preview.phaseId)!.planningLock = {
                approvalId: preview.approvalId, lockedBy: reviewerId, lockedAt: new Date().toISOString(),
                basisRevision: current.revision, requiredGateIds: basis.requiredGateIds,
                criteria: basis.criteria, source: basis.source };
            await this.replace(root, result, hash, [`phase-finish-planning:${preview.phaseId}`,
                `planning-approval:${preview.approvalId}`]);
            return result;
        });
        this.publish({ root, projectId: next.projectId, revision: next.revision, changedIds: [preview.phaseId] });
        return next;
    }

    private async checkedPhaseWork(root: string, index: RoadmapGateIndex, phaseId: string,
        links: PhaseWorkLink[], planning: PhaseWorkPlanningSnapshot): Promise<PhaseWorkReview['items']> {
        const phase = index.phases.find(item => item.id === phaseId);
        if (!phase?.planningLock || phase.draftAcceptance === 'proposed')
            throw new Error('Finish and lock Phase planning before Prepare Work');
        if (phase.amendment && phase.gateSetCoverage.status !== 'approved')
            throw new Error('Review amended Gate-set coverage before preparing Work');
        if (JSON.stringify(phase.workLinks) === JSON.stringify(links))
            throw new Error('Phase Work links are already reviewed; no change to apply');
        if (index.pendingPublication || index.linkedDocument?.pending || index.linkedDocument?.syncIntent ||
            autoSyncInFlight.has(root)) throw new Error('Pending Roadmap source operation requires recovery');
        for (const probe of this.planningConflictProbes)
            if (await probe(root, index.projectId)) throw new Error('Pending Roadmap proposal requires review');
        if (index.linkedDocument) {
            const linked = index.linkedDocument;
            if (linked.projectRoot !== root || linked.projectId !== index.projectId || linked.syncState !== 'synced' ||
                linked.lastSynced?.sourceHash !== linked.sourceHash || phase.planningLock.source.path !== linked.path ||
                phase.planningLock.source.sha256 !== linked.sourceHash)
                throw new Error('Linked Roadmap source changed; review Phase planning');
            const mapped = await readGateMappedDocument(root, linked);
            if (mapped.hash !== linked.sourceHash || mapped.diagnostics.length || structureDiagnostics(index, mapped).length)
                throw new Error('Linked Roadmap source is stale or ambiguous');
        }
        if (!Array.isArray(links) || !links.length || links.length > 128 ||
            new Set(links.map(link => `${link.planningProjectId}/${link.mapId}/${link.workItemId}`)).size !== links.length)
            throw new Error('Select distinct WorkItems for Phase handoff');
        if (!planning.projectId || !Number.isSafeInteger(planning.revision) || planning.revision < 0)
            throw new Error('Planning owner is unavailable');
        const required = new Set(phase.planningLock.criteria.map(item => item.id));
        const covered = new Set<string>();
        const items: PhaseWorkReview['items'] = [];
        for (const link of links) {
            if (link.planningProjectId !== planning.projectId || !Array.isArray(link.criterionIds) ||
                !link.criterionIds.length || new Set(link.criterionIds).size !== link.criterionIds.length ||
                link.criterionIds.some(id => !required.has(id)))
                throw new Error('Foreign, duplicate or unknown Criterion ID in Work handoff');
            if (JSON.stringify(link.criterionIds) !== JSON.stringify(phase.planningLock.criteria
                .map(item => item.id).filter(id => link.criterionIds.includes(id))))
                throw new Error('Work Criterion IDs must follow the locked Gate and Criterion order');
            const map = planning.maps.find(item => item.id === link.mapId);
            if (!map || map.projectId !== planning.projectId || map.revision !== link.mapRevision ||
                !['draft', 'active'].includes(map.status) || JSON.stringify(map.basis) !== JSON.stringify(link.basis))
                throw new Error('Missing, foreign or stale Planning Map link');
            const work = map.workItems.find(item => item.id === link.workItemId);
            if (!work || work.status !== 'ready' ||
                !work.acceptanceCriteria.length || !work.validationTargets.length ||
                link.requiredChecks !== undefined &&
                    JSON.stringify(link.requiredChecks) !== JSON.stringify(work.validationTargets) ||
                !link.transformationIds.length ||
                JSON.stringify([...work.transformationIds].sort()) !== JSON.stringify([...link.transformationIds].sort()) ||
                link.transformationIds.some(id => !map.transformations.some(item => item.id === id)))
                throw new Error('Ready WorkItem or acceptance and validation targets require review');
            link.criterionIds.forEach(id => covered.add(id));
            items.push({ id: work.id, title: work.title, acceptanceCriteria: [...work.acceptanceCriteria],
                validationTargets: [...work.validationTargets], criterionIds: [...link.criterionIds] });
        }
        if ([...required].some(id => !covered.has(id)))
            throw new Error(`Link every required Criterion to a WorkItem: ${[...required].filter(id => !covered.has(id)).join(', ')}`);
        return items;
    }

    /** Review exact WorkItem coverage and targets; no task, grant, execution or adoption is created. */
    async previewPhaseWork(root: string, projectId: string, revision: number, phaseId: string,
        links: PhaseWorkLink[], readPlanning: () => Promise<PhaseWorkPlanningSnapshot>): Promise<PhaseWorkReview> {
        const index = await this.read<RoadmapGateIndex>(root);
        if (index.projectId !== projectId || index.revision !== revision) throw new Error('Stale or foreign Phase revision');
        const planning = await readPlanning();
        const items = await this.checkedPhaseWork(root, index, phaseId, links, planning);
        const headHash = await this.gateIndexHash(root);
        if (!headHash) throw new Error('Missing Roadmap source');
        const review: PhaseWorkReview = { approvalId: randomUUID(), projectRoot: root, projectId, phaseId,
            revision, headHash, expiresAt: Date.now() + 5 * 60_000, planningRevision: planning.revision,
            lockApprovalId: index.phases.find(item => item.id === phaseId)!.planningLock!.approvalId,
            links: links.map(link => ({ ...structuredClone(link),
                requiredChecks: [...items.find(item => item.id === link.workItemId)!.validationTargets] })), items };
        this.phaseWorkReviews.set(review.approvalId, structuredClone(review));
        if (this.phaseWorkReviews.size > 32) this.phaseWorkReviews.delete(this.phaseWorkReviews.keys().next().value!);
        return review;
    }

    async applyPhaseWork(root: string, review: PhaseWorkReview, approved: boolean, reviewerId: string,
        readPlanning: () => Promise<PhaseWorkPlanningSnapshot>): Promise<RoadmapGateIndex> {
        const issued = this.phaseWorkReviews.get(review.approvalId);
        this.phaseWorkReviews.delete(review.approvalId);
        if (!approved || !id(reviewerId) || !issued || JSON.stringify(issued) !== JSON.stringify(review) ||
            review.projectRoot !== root || review.expiresAt < Date.now())
            throw new Error('Explicit current Phase Work review approval required');
        const next = await this.locked(root, async () => {
            const current = await this.read<RoadmapGateIndex>(root);
            if (current.projectId !== review.projectId || current.revision !== review.revision ||
                await this.gateIndexHash(root) !== review.headHash ||
                current.phases.find(item => item.id === review.phaseId)?.planningLock?.approvalId !== review.lockApprovalId)
                throw new Error('Phase Work review source changed');
            const planning = await readPlanning();
            if (planning.revision !== review.planningRevision ||
                JSON.stringify(await this.checkedPhaseWork(root, current, review.phaseId, review.links, planning)) !==
                    JSON.stringify(review.items)) throw new Error('Planning or WorkItem review changed');
            const result = structuredClone(current);
            result.revision++;
            const phase = result.phases.find(item => item.id === review.phaseId)!;
            phase.workLinks = structuredClone(review.links);
            for (const gate of result.gates.filter(item => item.parentPhaseId === phase.id))
                gate.qualificationStatus = evaluateGateQualification(gate, gate.qualificationSource, phase).status;
            const qualification = evaluatePhaseQualification(result, phase.id, phase.qualificationSource);
            phase.qualificationStatus = qualification.status === 'planned' || qualification.status === 'unplanned' ?
                'unknown' : qualification.status;
            await this.replace(root, result, review.headHash, [`phase-work-review:${review.phaseId}`,
                `phase-work-approved-by:${reviewerId}`]);
            return result;
        });
        this.publish({ root, projectId: next.projectId, revision: next.revision, changedIds: [review.phaseId] });
        return next;
    }

    /** Review the exact locked definition change and the Work/evidence that it displaces. */
    async previewPhaseAmendment(root: string, projectId: string, revision: number, phaseId: string,
        operations: RoadmapGateMutation[], reviewerId: string): Promise<PhaseAmendmentReview> {
        if (!id(reviewerId) || !operations.length || operations.length > 48)
            throw new Error('Invalid Phase amendment review');
        const current = await this.read<RoadmapGateIndex>(root);
        const phase = current.phases.find(item => item.id === phaseId);
        if (current.projectId !== projectId || current.revision !== revision ||
            !phase?.planningLock || phase.planningLock.lockedBy !== reviewerId)
            throw new Error('Only the current Phase owner can review an amendment');
        if (current.pendingPublication || current.linkedDocument &&
            (current.linkedDocument.syncState !== 'synced' || current.linkedDocument.pending ||
                current.linkedDocument.syncIntent || autoSyncInFlight.has(root)))
            throw new Error('Linked Roadmap source conflict requires recovery before amendment');
        for (const probe of this.planningConflictProbes)
            if (await probe(root, projectId)) throw new Error('Pending Roadmap proposal requires review');
        if (current.linkedDocument) {
            const mapped = await readGateMappedDocument(root, current.linkedDocument);
            if (mapped.hash !== current.linkedDocument.sourceHash || mapped.diagnostics.length ||
                structureDiagnostics(current, mapped).length)
                throw new Error('Linked Roadmap source changed before amendment');
        }
        const headHash = await this.gateIndexHash(root);
        if (!headHash) throw new Error('Missing Roadmap amendment source');
        const approvalId = randomUUID();
        const candidate = await this.mutateGateIndex(root, revision, projectId, operations, true,
            { indexHash: headHash, amendment: { phaseId, approvalId } });
        const impact = amendmentImpact(current, candidate, phaseId);
        const review: PhaseAmendmentReview = { approvalId, projectRoot: root, projectId, phaseId,
            revision, headHash, expiresAt: Date.now() + 5 * 60_000, reviewerId,
            operations: structuredClone(operations), before: phasePlanningDefinition(current, phaseId),
            after: phasePlanningDefinition(candidate, phaseId), ...impact,
            source: structuredClone(phase.planningLock.source) };
        this.amendmentReviews.set(approvalId, structuredClone(review));
        if (this.amendmentReviews.size > 32) this.amendmentReviews.delete(this.amendmentReviews.keys().next().value!);
        return review;
    }

    async applyPhaseAmendment(root: string, review: PhaseAmendmentReview, approved: boolean,
        reviewerId: string): Promise<RoadmapGateIndex> {
        const issued = this.amendmentReviews.get(review.approvalId);
        if (!approved || !id(reviewerId) || reviewerId !== review.reviewerId || !issued ||
            JSON.stringify(issued) !== JSON.stringify(review) || review.expiresAt < Date.now() ||
            review.projectRoot !== root) {
            this.amendmentReviews.delete(review.approvalId);
            throw new Error('Explicit current Phase amendment approval required');
        }
        const current = await this.read<RoadmapGateIndex>(root);
        if (current.projectId !== review.projectId || current.revision !== review.revision ||
            await this.gateIndexHash(root) !== review.headHash ||
            current.phases.find(item => item.id === review.phaseId)?.planningLock?.lockedBy !== reviewerId ||
            phasePlanningDefinition(current, review.phaseId) !== review.before)
            throw new Error('Phase amendment source changed; review again');
        try {
            return await this.mutateGateIndex(root, review.revision, review.projectId,
                review.operations, false, { indexHash: review.headHash,
                    operationIds: [`phase-amendment-review:${review.phaseId}`,
                        `phase-amendment-approval:${review.approvalId}`, `phase-amended-by:${reviewerId}`],
                    amendment: { phaseId: review.phaseId, approvalId: review.approvalId } });
        } finally { this.amendmentReviews.delete(review.approvalId); }
    }

    /** Reopening is a separate reviewed transition and cannot erase a running Phase. */
    async previewReopenPlanning(root: string, expectedProjectId: string, expectedRevision: number,
        phaseId: string): Promise<FinishPlanningPreview> {
        const current = await this.read<RoadmapGateIndex>(root);
        const phase = current.phases.find(item => item.id === phaseId);
        if (current.projectId !== expectedProjectId || current.revision !== expectedRevision ||
            !phase?.planningLock || phase.workLinks?.length || ['active', 'implemented'].includes(phase.implementationStatus))
            throw new Error('Stale, foreign or executing Phase planning lock');
        const headHash = await this.gateIndexHash(root);
        if (!headHash) throw new Error('Missing Roadmap planning basis');
        const preview: FinishPlanningPreview = { approvalId: randomUUID(), projectRoot: root,
            projectId: expectedProjectId, phaseId, revision: current.revision, headHash,
            expiresAt: Date.now() + 5 * 60_000, requiredGateIds: [...phase.planningLock.requiredGateIds],
            criteria: structuredClone(phase.planningLock.criteria),
            source: { ...phase.planningLock.source } };
        this.reopenReviews.set(preview.approvalId, structuredClone(preview));
        if (this.reopenReviews.size > 32) this.reopenReviews.delete(this.reopenReviews.keys().next().value!);
        return preview;
    }

    async reopenPlanning(root: string, preview: FinishPlanningPreview, approved: boolean,
        reviewerId: string): Promise<RoadmapGateIndex> {
        if (!approved) { this.reopenReviews.delete(preview.approvalId); throw new Error('Planning reopen approval required'); }
        const issued = this.reopenReviews.get(preview.approvalId);
        this.reopenReviews.delete(preview.approvalId);
        if (!id(reviewerId) || !issued || JSON.stringify(issued) !== JSON.stringify(preview) ||
            preview.expiresAt < Date.now() || preview.projectRoot !== root)
            throw new Error('Stale or unissued planning reopen approval');
        const next = await this.locked(root, async () => {
            const { file } = await this.paths(root);
            const hash = await this.indexHash(file);
            const current = await this.read<RoadmapGateIndex>(root);
            const phase = current.phases.find(item => item.id === preview.phaseId);
            if (hash !== preview.headHash || current.projectId !== preview.projectId ||
                current.revision !== preview.revision || !phase?.planningLock ||
                phase.workLinks?.length || ['active', 'implemented'].includes(phase.implementationStatus) ||
                JSON.stringify({ requiredGateIds: phase.planningLock.requiredGateIds,
                    criteria: phase.planningLock.criteria, source: phase.planningLock.source }) !==
                JSON.stringify({ requiredGateIds: preview.requiredGateIds, criteria: preview.criteria,
                    source: preview.source }))
                throw new Error('Stale Phase planning reopen basis');
            const result = structuredClone(current);
            result.revision++;
            delete result.phases.find(item => item.id === preview.phaseId)!.planningLock;
            await this.replace(root, result, hash, [`phase-reopen-planning:${preview.phaseId}`,
                `planning-reopen-approval:${preview.approvalId}`, `planning-reopened-by:${reviewerId}`]);
            return result;
        });
        this.publish({ root, projectId: next.projectId, revision: next.revision, changedIds: [preview.phaseId] });
        return next;
    }

    /** Exact retained revision compared to the current owner and checked linked source. */
    async previewRestore(root: string, expectedProjectId: string, fromRevision: number): Promise<RoadmapRestorePreview> {
        const bytes = await this.canonicalBytes(root);
        if (!bytes) throw new Error('Roadmap is not initialized');
        const canonical = parseRoadmapIndex(JSON.parse(bytes.toString('utf8')), root);
        const current = overlayAutoSync(canonical, await readAutoSyncJournal(root));
        if (current.projectId !== expectedProjectId || fromRevision >= current.revision ||
            fromRevision <= (current.retiredBeforeRevision ?? 0))
            throw new Error('Foreign or current Roadmap revision');
        const record = await this.archive.fetch(root, bytes, expectedProjectId, fromRevision);
        const historical = parseRoadmapIndex(JSON.parse(record.snapshot), root);
        if (current.pendingPublication || current.linkedDocument &&
            (current.linkedDocument.syncState !== 'synced' || current.linkedDocument.syncIntent || current.linkedDocument.pending))
            throw new Error('Pending Roadmap source operation requires recovery before restore');
        const result = restoreEditableStructure(current, historical);
        if (!result.linkedDocument) parseRoadmapIndex(result, root);
        const beforeStructure = editableStructure(current), resultingStructure = editableStructure(result);
        if (JSON.stringify(beforeStructure) === JSON.stringify(resultingStructure))
            throw new Error('Historical editable structure already matches current Roadmap');
        const changes = describeEditableChanges(current, result);
        let linkedDiff: RoadmapRestorePreview['linkedDiff'];
        if (result.linkedDocument) {
            withAutoSyncIntent(result);
            if (!result.linkedDocument.syncIntent)
                throw new Error('Linked structural restore has no checked sync intent');
            parseRoadmapIndex(result, root);
            const patch = await prepareAutoSync(root, result);
            linkedDiff = { path: result.linkedDocument.path, beforeHash: result.linkedDocument.sourceHash,
                afterHash: patch.targetHash, before: patch.before, after: patch.content };
        }
        const preview: RoadmapRestorePreview = { approvalId: randomUUID(), expiresAt: Date.now() + 5 * 60_000,
            projectRoot: root, projectId: expectedProjectId, fromRevision,
            previousHeadRevision: current.revision, historyHash: record.hash,
            headHash: createHash('sha256').update(bytes).digest('hex'),
            structureHash: createHash('sha256').update(JSON.stringify(resultingStructure)).digest('hex'),
            changes, resultingStructure, ...(linkedDiff ? { linkedDiff } : {}),
            warnings: ['Historical qualification, evidence, waivers, coverage and source ownership are not restored.',
                'Changed requirements require fresh qualification and Gate-set review.'] };
        this.restoreReviews.set(preview.approvalId, structuredClone(preview));
        if (this.restoreReviews.size > 32) this.restoreReviews.delete(this.restoreReviews.keys().next().value!);
        return preview;
    }

    /** One-use developer approval. A repeated acknowledgement returns the exact committed head. */
    async applyRestore(root: string, preview: RoadmapRestorePreview, approved: boolean): Promise<RoadmapGateIndex> {
        if (!approved) { this.restoreReviews.delete(preview.approvalId); return this.read<RoadmapGateIndex>(root); }
        const issued = this.restoreReviews.get(preview.approvalId);
        this.restoreReviews.delete(preview.approvalId);
        const result = await this.locked(root, async () => {
            const bytes = await this.canonicalBytes(root);
            if (!bytes) throw new Error('Roadmap is not initialized');
            const canonical = parseRoadmapIndex(JSON.parse(bytes.toString('utf8')), root);
            const current = overlayAutoSync(canonical, await readAutoSyncJournal(root));
            const receipt = await this.archive.fetch(root, bytes, current.projectId, current.revision);
            if (receipt.receipt.operationIds?.includes(`restore-approval:${preview.approvalId}`) &&
                receipt.receipt.operationIds.includes(`restore-from:${preview.fromRevision}`))
                return { next: current, wrote: false };
            if (!issued || JSON.stringify(issued) !== JSON.stringify(preview) || preview.expiresAt < Date.now() ||
                preview.projectRoot !== root || preview.projectId !== current.projectId ||
                preview.fromRevision <= (current.retiredBeforeRevision ?? 0) ||
                preview.previousHeadRevision !== current.revision || preview.headHash !== receipt.hash)
                throw new Error('Stale or unissued Roadmap restore approval');
            if (current.pendingPublication || current.linkedDocument &&
                (current.linkedDocument.syncState !== 'synced' || current.linkedDocument.syncIntent || current.linkedDocument.pending))
                throw new Error('Pending Roadmap source operation requires recovery before restore');
            const historical = await this.archive.fetch(root, bytes, current.projectId, preview.fromRevision);
            if (historical.hash !== preview.historyHash) throw new Error('Historical Roadmap revision changed');
            const next = restoreEditableStructure(current, parseRoadmapIndex(JSON.parse(historical.snapshot), root));
            const structure = editableStructure(next);
            if (JSON.stringify(structure) !== JSON.stringify(preview.resultingStructure) ||
                createHash('sha256').update(JSON.stringify(structure)).digest('hex') !== preview.structureHash)
                throw new Error('Reviewed Roadmap restore result changed');
            if (next.linkedDocument) {
                withAutoSyncIntent(next);
                parseRoadmapIndex(next, root);
                const prepared = await prepareAutoSync(root, next);
                if (!preview.linkedDiff || next.linkedDocument.path !== preview.linkedDiff.path ||
                    next.linkedDocument.sourceHash !== preview.linkedDiff.beforeHash ||
                    prepared.targetHash !== preview.linkedDiff.afterHash ||
                    prepared.before !== preview.linkedDiff.before || prepared.content !== preview.linkedDiff.after)
                    throw new Error('Linked Roadmap source changed after restore review');
            } else { parseRoadmapIndex(next, root);
                if (preview.linkedDiff) throw new Error('Linked Roadmap ownership changed'); }
            await this.replace(root, next, receipt.hash,
                [`restore-from:${preview.fromRevision}`, `restore-previous:${current.revision}`,
                    `restore-approval:${preview.approvalId}`]);
            return { next, wrote: true };
        });
        if (result.wrote) {
            this.publish({ root, projectId: result.next.projectId, revision: result.next.revision,
                changedIds: result.next.phases.map(item => item.id).concat(result.next.gates.map(item => item.id)) });
            if (result.next.linkedDocument?.syncIntent) return this.recoverAutoSync(root);
        }
        return result.next;
    }

    private async replace(root: string, next: RoadmapGateIndex | RoadmapIndex, expectedHash?: string | null,
        operationIds?: string[]): Promise<void> {
        const { directory, file } = await this.paths(root);
        if (next.schemaVersion !== 2 || expectedHash === undefined)
            throw new Error('Checkpoint Roadmap writes are retired; review and reimport into schema 2');
        const currentBytes = await this.canonicalBytes(root);
        const current = currentBytes ? parseRoadmapIndex(JSON.parse(currentBytes.toString('utf8')), root) : undefined;
        if (current) {
            for (const phase of current.phases) {
                const following = next.schemaVersion === 2 ? next.phases.find(item => item.id === phase.id) : undefined;
                if (phase.planningLock) {
                    const amendmentId = operationIds?.find(item => item.startsWith('phase-amendment-approval:'))
                        ?.slice('phase-amendment-approval:'.length);
                    const reviewedAmendment = amendmentId ? this.amendmentReviews.get(amendmentId) : undefined;
                    const amended = reviewedAmendment?.phaseId === phase.id &&
                        reviewedAmendment.projectRoot === root && reviewedAmendment.projectId === current.projectId &&
                        reviewedAmendment.revision === current.revision &&
                        reviewedAmendment.before === phasePlanningDefinition(current, phase.id) &&
                        reviewedAmendment.after === phasePlanningDefinition(next as RoadmapGateIndex, phase.id);
                    if (!following || phasePlanningDefinition(current, phase.id) !== phasePlanningDefinition(next as RoadmapGateIndex, phase.id) && !amended)
                        throw new Error('Locked Phase requirements require reviewed reopen or amendment');
                    if (JSON.stringify(following.gateSetCoverage) !== JSON.stringify(phase.gateSetCoverage) &&
                        !amended && !operationIds?.includes(`phase-coverage-approve:${phase.id}`))
                        throw new Error('Locked Phase Gate-set coverage cannot change silently');
                    if (JSON.stringify(following.planningLock) !== JSON.stringify(phase.planningLock) &&
                        !operationIds?.includes(`phase-reopen-planning:${phase.id}`) && !amended &&
                        !operationIds?.includes(`phase-coverage-approve:${phase.id}`))
                        throw new Error('Planning lock requires reviewed reopen');
                    if (JSON.stringify(following.workLinks) !== JSON.stringify(phase.workLinks) &&
                        !operationIds?.includes(`phase-work-review:${phase.id}`) && !amended)
                        throw new Error('Phase Work links require reviewed handoff');
                    if (JSON.stringify(following.amendment) !== JSON.stringify(phase.amendment) &&
                        !amended && !operationIds?.includes(`phase-coverage-approve:${phase.id}`))
                        throw new Error('Phase amendment metadata requires reviewed transition');
                } else if (following?.planningLock && !operationIds?.includes(`phase-finish-planning:${phase.id}`))
                    throw new Error('Planning lock requires checked Finish Planning');
            }
        }
        if (current?.projectId === next.projectId && current.retiredBeforeRevision !== undefined)
            next.retiredBeforeRevision = Math.max(next.retiredBeforeRevision ?? 0, current.retiredBeforeRevision);
        parseRoadmapIndex(next, root);
        const bytes = Buffer.from(`${JSON.stringify(next, null, 2)}\n`);
        if (bytes.length > MAX_BYTES) throw new Error('Roadmap index size limit exceeded');
        const temporary = join(directory, `roadmap.${randomUUID()}.tmp`);
        let replaced = false;
        try {
            const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
            const currentHash = await this.indexHash(file);
            if (currentHash !== expectedHash) throw new Error('Roadmap index changed before publication; review and retry');
            if ((currentBytes ? createHash('sha256').update(currentBytes).digest('hex') : null) !== expectedHash)
                throw new Error('Roadmap index changed before archive preparation; review and retry');
            await this.archive.prepare(root, currentBytes, bytes, operationIds);
            await rename(temporary, file);
            replaced = true;
            const parent = await open(directory, 'r');
            try { await parent.sync(); } finally { await parent.close(); }
        } catch (error) {
            if (replaced) throw new Error(`Roadmap write outcome uncertain; re-read before retrying: ${String(error)}`);
            throw error;
        } finally { await rm(temporary, { force: true }); }
    }

    private async indexHash(file: string): Promise<string | null> {
        if (!(await this.regular(file))) return null;
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try { return createHash('sha256').update(await handle.readFile()).digest('hex'); }
        finally { await handle.close(); }
    }

    /** Exact canonical bytes used by a reviewed native subset. */
    async gateIndexHash(root: string): Promise<string | null> {
        return this.indexHash((await this.paths(root)).file);
    }

    /** Revisioned lifecycle change. External Markdown and immutable archive records are never removed. */
    async manageGateIndex(root: string, expectedRevision: number, expectedProjectId: string,
        action: 'unlink' | 'empty'): Promise<RoadmapGateIndex> {
        if (action !== 'unlink' && action !== 'empty') throw new Error('Invalid Roadmap lifecycle action');
        const next = await this.locked(root, async () => {
            const { file } = await this.paths(root);
            const hash = await this.indexHash(file);
            const current = await this.read<RoadmapGateIndex>(root);
            if (current.revision !== expectedRevision || current.projectId !== expectedProjectId)
                throw new Error('Stale Roadmap lifecycle approval');
            if (current.pendingPublication || current.linkedDocument?.syncIntent ||
                current.linkedDocument?.pending || autoSyncInFlight.has(root))
                throw new Error('Pending Roadmap source operation requires recovery before lifecycle change');
            if (action === 'unlink' && !current.linkedDocument)
                throw new Error('Roadmap has no linked Markdown document');
            const result: RoadmapGateIndex = current.revision === 0 ?
                { schemaVersion: 2, projectId: randomUUID(), projectRoot: root, revision: 1,
                    phases: [], gates: [], corrections: [] } : { ...current, revision: current.revision + 1 };
            delete result.linkedDocument;
            if (action === 'empty') {
                result.phases = []; result.gates = []; result.corrections = [];
                result.retiredBeforeRevision = current.revision;
            }
            parseRoadmapIndex(result, root);
            await this.replace(root, result, hash, [`roadmap-${action}:${current.revision}`]);
            const timer = autoSyncTimers.get(root);
            if (timer) { clearTimeout(timer); autoSyncTimers.delete(root); }
            return result;
        });
        this.publish({ root, projectId: next.projectId, revision: next.revision, changedIds: [] });
        return next;
    }

    /** Persist one reviewed schema-2 revision without changing a linked Markdown source. */
    async saveGateIndex(root: string, expectedRevision: number, expectedProjectId: string | undefined,
        candidate: RoadmapGateIndex): Promise<RoadmapGateIndex> {
        if (!revision(expectedRevision) || !id(candidate.projectId) || candidate.projectId === 'uninitialized')
            throw new Error('Invalid Roadmap owner or revision');
        if (candidate.pendingPublication) throw new Error('Publication intent requires reviewed publisher');
        const next = await this.locked(root, async () => {
            const { file } = await this.paths(root);
            const expectedHash = await this.indexHash(file);
            const current = await this.read<RoadmapGateIndex>(root);
            if (current.pendingPublication) throw new Error('Pending Roadmap publication requires recovery');
            if (current.revision !== expectedRevision) throw new Error('Stale Roadmap revision');
            if (expectedProjectId !== current.projectId) throw new Error('Roadmap identity changed; reattach');
            if (current.revision > 0 && candidate.projectId !== current.projectId)
                throw new Error('Roadmap identity changed; reattach');
            if (candidate.projectRoot !== root || candidate.revision !== expectedRevision + 1)
                throw new Error('Roadmap root or revision changed');
            // This general definition saver cannot manufacture reviewed qualification.
            for (const item of candidate.phases) {
                const previous = current.phases.find(entry => entry.id === item.id);
                if (item.gateSetCoverage.status === 'approved' &&
                    JSON.stringify(item.gateSetCoverage) !== JSON.stringify(previous?.gateSetCoverage) ||
                    item.qualificationStatus === 'green' && previous?.qualificationStatus !== 'green' ||
                    item.qualificationStatus === 'waived' && previous?.qualificationStatus !== 'waived' ||
                    previous && (JSON.stringify(item.qualificationSource) !== JSON.stringify(previous.qualificationSource) ||
                        JSON.stringify(item.qualificationBlockers) !== JSON.stringify(previous.qualificationBlockers) ||
                        JSON.stringify(item.exception) !== JSON.stringify(previous.exception)))
                    throw new Error('Phase qualification requires typed review operations');
                if (previous && JSON.stringify(item.amendment) !== JSON.stringify(previous.amendment))
                    throw new Error('Phase amendment requires typed owner review');
                if (item.gateSetCoverage.status === 'approved' && previous && (
                    item.title !== previous.title || item.objective !== previous.objective ||
                    item.draftAcceptance !== previous.draftAcceptance ||
                    JSON.stringify(item.dependencies) !== JSON.stringify(previous.dependencies) ||
                    JSON.stringify(candidate.gates.filter(gate => gate.parentPhaseId === item.id).map(gate =>
                        [gate.id, gate.designation, gate.title, gate.purpose, gate.order, gate.draftAcceptance,
                            gate.dependencies, gate.criteria.map(criterion => [criterion.id, criterion.title,
                                criterion.expectedResult, criterion.order])])) !==
                    JSON.stringify(current.gates.filter(gate => gate.parentPhaseId === item.id).map(gate =>
                        [gate.id, gate.designation, gate.title, gate.purpose, gate.order, gate.draftAcceptance,
                            gate.dependencies, gate.criteria.map(criterion => [criterion.id, criterion.title,
                                criterion.expectedResult, criterion.order])]))))
                    throw new Error('Phase requirements changed; revoke Gate-set coverage before saving');
            }
            for (const previous of current.gates) {
                for (const priorCriterion of previous.criteria) {
                    if (!priorCriterion.evidence.length) continue;
                    const nextEvidence = candidate.gates.find(item => item.id === previous.id)?.criteria
                        .find(item => item.id === priorCriterion.id)?.evidence;
                    if (JSON.stringify(nextEvidence) !== JSON.stringify(priorCriterion.evidence))
                        throw new Error('Gate evidence and qualification require typed review operations');
                }
            }
            for (const gate of candidate.gates) {
                const previous = current.gates.find(item => item.id === gate.id);
                if (gate.qualificationStatus === 'green' && previous?.qualificationStatus !== 'green' ||
                    gate.qualificationStatus === 'waived' && previous?.qualificationStatus !== 'waived' ||
                    !previous && gate.criteria.some(item => item.evidence.length) ||
                    previous && (gate.qualificationStatus !== previous.qualificationStatus ||
                        JSON.stringify(gate.qualificationSource) !== JSON.stringify(previous.qualificationSource) ||
                        JSON.stringify(gate.qualificationBlockers) !== JSON.stringify(previous.qualificationBlockers) ||
                        JSON.stringify(gate.waiver) !== JSON.stringify(previous.waiver) ||
                        gate.criteria.some(item => JSON.stringify(item.evidence) !==
                            JSON.stringify(previous.criteria.find(entry => entry.id === item.id)?.evidence ?? []))))
                    throw new Error('Gate evidence and qualification require typed review operations');
            }
            if (current.linkedDocument && JSON.stringify(candidate.linkedDocument) !== JSON.stringify(current.linkedDocument))
                throw new Error('Linked Roadmap source requires separate reviewed synchronization');
            if (current.linkedDocument) withAutoSyncIntent(candidate);
            parseRoadmapIndex(candidate, root);
            if (!current.linkedDocument && candidate.linkedDocument) {
                if (candidate.linkedDocument.syncState !== 'synced')
                    throw new Error('A new linked Roadmap source requires a verified fingerprint');
                const source = await checkedRoadmapDocumentFile(root, candidate.linkedDocument.path);
                if (createHash('sha256').update(source.bytes).digest('hex') !== candidate.linkedDocument.sourceHash)
                    throw new Error('Linked Roadmap source fingerprint changed');
            }
            await this.replace(root, candidate, expectedHash);
            return candidate;
        });
        this.publish({ root, projectId: next.projectId, revision: next.revision,
            changedIds: [...next.phases, ...next.gates, ...next.corrections].map(item => item.id) });
        if (next.linkedDocument?.syncIntent) this.scheduleAutoSync(root);
        return next;
    }

    /** Accept an exact, reviewed Markdown preview into an empty schema-2 owner. The source is never edited. */
    async acceptGateImport(root: string, expectedRevision: number, projectId: string,
        preview: RoadmapImportPreview): Promise<RoadmapGateIndex> {
        if (!id(projectId) || projectId === 'uninitialized') throw new Error('Invalid Roadmap project identity');
        const current = await this.read<RoadmapGateIndex>(root);
        if (current.revision !== expectedRevision || current.projectId !== 'uninitialized' && current.projectId !== projectId)
            throw new Error('Stale Roadmap import owner or revision');
        if (current.phases.length || current.gates.length || current.corrections.length || current.linkedDocument)
            throw new Error('Existing Roadmap requires separate reviewed replacement');
        const fresh = await previewRoadmapImport(root, preview.roadmapPath);
        if (JSON.stringify(fresh) !== JSON.stringify(preview)) throw new Error('Roadmap import preview or source changed');
        const source = fresh.sources.find(item => item.path === fresh.roadmapPath);
        const parsed = fresh.gateSource;
        if (!source || !parsed.phases.length || parsed.diagnostics.length)
            throw new Error(`Roadmap Gate source is incomplete or ambiguous: ${parsed.diagnostics.join('; ')}`);
        const phases: RoadmapPhase[] = parsed.phases.map((phase, order) => ({
            id: phase.id, projectId, title: phase.title, objective: phase.objective, order,
            dependencies: [], implementationStatus: 'unknown', qualificationStatus: 'unknown',
            draftAcceptance: 'published', gateSetCoverage: { status: 'unreviewed' } }));
        const gates: RoadmapGate[] = parsed.gates.map(gate => ({
            id: gate.id, projectId, parentPhaseId: gate.parentPhaseId, designation: gate.designation,
            title: gate.title, purpose: gate.purpose, order: parsed.gates.filter(item =>
                item.parentPhaseId === gate.parentPhaseId).findIndex(item => item.id === gate.id),
            dependencies: [], criteria: gate.criteria.map((criterion, criterionOrder) => ({
                id: criterion.id, projectId, title: criterion.title, expectedResult: criterion.expectedResult,
                order: criterionOrder, evidence: [] })), implementationStatus: 'unknown',
            qualificationStatus: 'unknown', draftAcceptance: 'published' }));
        const corrections: RoadmapCorrection[] = parsed.corrections.map((correction, order) => ({
            id: correction.id, projectId, parent: correction.parent, title: correction.title,
            ...(correction.criterionId ? { criterionId: correction.criterionId } : {}),
            objective: correction.objective, order: correction.order ?? order, implementationStatus: 'unknown',
            qualificationStatus: 'unknown', draftAcceptance: 'published' }));
        const sections = [
            ...parsed.phases.map(item => ({ sectionKey: item.sectionKey, kind: 'phase' as const, id: item.id })),
            ...parsed.gates.flatMap(item => [{ sectionKey: item.sectionKey, kind: 'gate' as const, id: item.id },
                ...item.criteria.map(criterion => ({ sectionKey: criterion.sectionKey, kind: 'criterion' as const,
                    id: criterion.id }))]),
            ...parsed.corrections.map(item => ({ sectionKey: item.sectionKey, kind: 'correction' as const, id: item.id }))];
        const linked: RoadmapGateIndex['linkedDocument'] = { projectId, projectRoot: root,
            path: fresh.roadmapPath, sourceHash: source.sha256, syncState: 'synced', sections };
        const mapped = await readGateMappedDocument(root, linked);
        if (mapped.hash !== source.sha256 || mapped.diagnostics.length || mapped.fields.length !== sections.length)
            throw new Error('Gate source changed or mapped sections are ambiguous');
        linked.lastSynced = { sourceHash: source.sha256, fields: mapped.fields, structure: mapped.structure };
        const next: RoadmapGateIndex = { schemaVersion: 2, projectId, projectRoot: root, revision: expectedRevision + 1,
            phases, gates, corrections, linkedDocument: linked };
        return this.saveGateIndex(root, expectedRevision, current.projectId, next);
    }

    /** One revisioned, project-owned schema-2 mutation. Linked Markdown remains a separate reviewed writer. */
    async mutateGateIndex(root: string, expectedRevision: number, expectedProjectId: string,
        operation: RoadmapGateMutation | RoadmapGateMutation[], previewOnly = false,
        nativeBasis?: { indexHash: string | null; operationIds?: string[]; replace?: boolean;
            amendment?: { phaseId: string; approvalId: string } }): Promise<RoadmapGateIndex> {
        const operations = Array.isArray(operation) ? operation : [operation];
        if (!revision(expectedRevision) || !id(expectedProjectId) || !operations.length ||
            operations.length > (previewOnly || nativeBasis ? 48 : 3) ||
            operations.some(item => !item || typeof item !== 'object'))
            throw new Error('Invalid Roadmap mutation authority');
        const next = await this.locked(root, async () => {
            const { file } = await this.paths(root);
            const expectedHash = await this.indexHash(file);
            if (nativeBasis && (nativeBasis.indexHash !== null && typeof nativeBasis.indexHash !== 'string' ||
                nativeBasis.indexHash !== expectedHash)) throw new Error('Stale native Roadmap index hash');
            const current = await this.read<RoadmapGateIndex>(root);
            if (current.pendingPublication) throw new Error('Pending Roadmap publication requires recovery');
            if (nativeBasis?.replace && (current.linkedDocument?.syncIntent || current.linkedDocument?.pending ||
                autoSyncInFlight.has(root)))
                throw new Error('Pending linked Roadmap sync requires recovery before replacement');
            const initial = current.revision === 0 && current.projectId === 'uninitialized' &&
                expectedHash === null && (previewOnly || nativeBasis !== undefined) &&
                expectedProjectId !== 'uninitialized' && current.phases.length === 0 &&
                current.gates.length === 0 && current.corrections.length === 0 && !current.linkedDocument;
            if (initial) {
                const discovered = await discoverRoadmapCandidates(root);
                if (discovered.candidates.length || discovered.diagnostics.length)
                    throw new Error('Existing or unsafe Roadmap Markdown requires reviewed import before native creation');
            }
            if (!initial && (!current.revision || current.projectId !== expectedProjectId))
                throw new Error('Roadmap identity changed; reattach');
            if (current.revision !== expectedRevision) throw new Error('Stale Roadmap revision');
            const candidate: RoadmapGateIndex = nativeBasis?.replace ? {
                schemaVersion: 2, projectId: initial ? expectedProjectId : current.projectId,
                projectRoot: root, revision: current.revision, phases: [], gates: [], corrections: [],
                retiredBeforeRevision: current.revision
            } : structuredClone(current);
            if (initial) candidate.projectId = expectedProjectId;
            const owned = (_entityId: string): void => { /* The checked automatic writer owns linked definitions. */ };
            const unique = (entityId: string): void => {
                if ([...candidate.phases, ...candidate.gates, ...candidate.corrections,
                    ...candidate.gates.flatMap(gate => gate.criteria.flatMap(criterion => [criterion, ...criterion.evidence]))]
                    .some(item => item.id === entityId)) throw new Error('Duplicate Roadmap identity');
            };
            const phase = (entityId: string): RoadmapPhase => {
                const found = candidate.phases.find(item => item.id === entityId);
                if (!found) throw new Error('Missing Roadmap Phase');
                return found;
            };
            const gate = (entityId: string): RoadmapGate => {
                const found = candidate.gates.find(item => item.id === entityId);
                if (!found) throw new Error('Missing Roadmap Gate');
                return found;
            };
            const criterion = (gateId: string, criterionId: string): Criterion => {
                const found = gate(gateId).criteria.find(item => item.id === criterionId);
                if (!found) throw new Error('Missing Roadmap criterion');
                return found;
            };
            const correction = (entityId: string): RoadmapCorrection => {
                const found = candidate.corrections.find(item => item.id === entityId);
                if (!found) throw new Error('Missing Roadmap Correction');
                return found;
            };
            const parent = (value: RoadmapCorrection['parent'], criterionId?: string): void => {
                if (value?.kind === 'phase') {
                    phase(value.id);
                    if (criterionId !== undefined) throw new Error('A Phase correction cannot own a criterion');
                } else if (value?.kind === 'gate') {
                    const target = gate(value.id);
                    if (criterionId !== undefined && !target.criteria.some(item => item.id === criterionId))
                        throw new Error('Missing correction criterion parent');
                } else throw new Error('Invalid correction parent');
            };
            const reorder = <T extends { id: string; order: number }>(items: T[], ids: string[]): void => {
                if (!Array.isArray(ids) || ids.length !== items.length || new Set(ids).size !== ids.length ||
                    ids.some(entityId => !items.some(item => item.id === entityId)))
                    throw new Error('Reorder must contain every owned identity exactly once');
                ids.forEach((entityId, order) => {
                    const item = items.find(entry => entry.id === entityId)!;
                    if (item.order !== order) owned(entityId);
                    item.order = order;
                });
            };
            const nextOrder = (items: { order: number }[]): number =>
                items.reduce((highest, item) => Math.max(highest, item.order), -1) + 1;
            const defaults = { implementationStatus: 'unknown', qualificationStatus: 'unknown',
                draftAcceptance: 'accepted' } as const;
            for (const operation of operations) {
            switch (operation.type) {
                case 'phase.create':
                    unique(operation.id);
                    candidate.phases.push({ id: operation.id, projectId: expectedProjectId, title: operation.title,
                        objective: operation.objective, order: nextOrder(candidate.phases), dependencies: [], ...defaults,
                        gateSetCoverage: { status: 'unreviewed' } });
                    break;
                case 'phase.edit': {
                    const item = phase(operation.id); owned(item.id);
                    item.title = operation.title; item.objective = operation.objective; break;
                }
                case 'phase.delete': {
                    phase(operation.id); owned(operation.id);
                    if (candidate.gates.some(item => item.parentPhaseId === operation.id) ||
                        candidate.corrections.some(item => item.parent.kind === 'phase' && item.parent.id === operation.id) ||
                        candidate.phases.some(item => item.dependencies.includes(operation.id)))
                        throw new Error('Phase still has owned or dependent definitions');
                    candidate.phases = candidate.phases.filter(item => item.id !== operation.id);
                    candidate.phases.sort((a, b) => a.order - b.order).forEach((item, order) => {
                        if (item.order !== order) owned(item.id);
                        item.order = order;
                    });
                    break;
                }
                case 'phase.reorder': reorder(candidate.phases, operation.ids); break;
                case 'phase.dependencies':
                    owned(operation.id); phase(operation.id).dependencies = operation.dependencies; break;
                case 'gate.create': {
                    phase(operation.parentPhaseId); unique(operation.id);
                    owned(operation.parentPhaseId);
                    const siblings = candidate.gates.filter(item => item.parentPhaseId === operation.parentPhaseId);
                    const criteria = operation.criteria.map((item, order): Criterion => {
                        unique(item.id);
                        return { ...item, projectId: expectedProjectId, order, evidence: [] };
                    });
                    candidate.gates.push({ id: operation.id, projectId: expectedProjectId,
                        parentPhaseId: operation.parentPhaseId, designation: operation.designation,
                        title: operation.title, purpose: operation.purpose, order: nextOrder(siblings),
                        dependencies: [], criteria, ...defaults });
                    break;
                }
                case 'gate.edit': {
                    const item = gate(operation.id); owned(item.id);
                    item.title = operation.title; item.purpose = operation.purpose; break;
                }
                case 'gate.reparent': {
                    const item = gate(operation.id); owned(item.id); phase(operation.parentPhaseId);
                    owned(operation.parentPhaseId);
                    if (!Number.isSafeInteger(operation.order) || operation.order < 0)
                        throw new Error('Invalid Gate destination order');
                    const former = item.parentPhaseId;
                    const siblings = candidate.gates.filter(entry => entry.parentPhaseId === operation.parentPhaseId && entry.id !== item.id)
                        .sort((a, b) => a.order - b.order);
                    if (operation.order > siblings.length) throw new Error('Gate destination order exceeds Phase');
                    item.parentPhaseId = operation.parentPhaseId;
                    siblings.splice(operation.order, 0, item);
                    siblings.forEach((entry, order) => { entry.order = order; });
                    candidate.gates.filter(entry => entry.parentPhaseId === former && entry.id !== item.id)
                        .sort((a, b) => a.order - b.order).forEach((entry, order) => { entry.order = order; });
                    break;
                }
                case 'gate.delete': {
                    const item = gate(operation.id); owned(item.id);
                    if (item.criteria.some(criterion => criterion.evidence.length))
                        throw new Error('Gate evidence must be retained');
                    if (candidate.gates.some(entry => entry.dependencies.includes(item.id)) ||
                        candidate.corrections.some(entry => entry.parent.kind === 'gate' && entry.parent.id === item.id))
                        throw new Error('Gate still has dependent definitions');
                    candidate.gates = candidate.gates.filter(entry => entry.id !== item.id);
                    candidate.gates.filter(entry => entry.parentPhaseId === item.parentPhaseId)
                        .sort((a, b) => a.order - b.order).forEach((entry, order) => {
                            if (entry.order !== order || entry.designation !== `G${order + 1}`) owned(entry.id);
                            entry.order = order;
                            entry.designation = `G${order + 1}`;
                        });
                    break;
                }
                case 'gate.reorder':
                    phase(operation.parentPhaseId);
                    reorder(candidate.gates.filter(item => item.parentPhaseId === operation.parentPhaseId), operation.ids);
                    break;
                case 'gate.dependencies': owned(operation.id); gate(operation.id).dependencies = operation.dependencies; break;
                case 'criterion.add': {
                    const item = gate(operation.gateId); owned(item.id); unique(operation.id);
                    item.criteria.push({ id: operation.id, projectId: expectedProjectId, title: operation.title,
                        expectedResult: operation.expectedResult, order: nextOrder(item.criteria), evidence: [] });
                    break;
                }
                case 'criterion.edit': {
                    const item = gate(operation.gateId); owned(item.id);
                    const criterion = item.criteria.find(entry => entry.id === operation.id);
                    if (!criterion) throw new Error('Missing Roadmap criterion');
                    if (criterion.title !== operation.title || criterion.expectedResult !== operation.expectedResult)
                        for (const evidence of criterion.evidence)
                            evidence.validation = { status: 'stale', reason: 'Criterion definition changed' };
                    criterion.title = operation.title; criterion.expectedResult = operation.expectedResult; break;
                }
                case 'criterion.remove': {
                    const item = gate(operation.gateId); owned(item.id);
                    const target = item.criteria.find(entry => entry.id === operation.id);
                    if (!target) throw new Error('Missing Roadmap criterion');
                    if (target.evidence.length) throw new Error('Criterion evidence must be retained');
                    if (item.criteria.length === 1 || candidate.corrections.some(entry => entry.criterionId === operation.id))
                        throw new Error('Criterion is required or owns a correction');
                    item.criteria = item.criteria.filter(entry => entry.id !== operation.id);
                    item.criteria.sort((a, b) => a.order - b.order).forEach((entry, order) => { entry.order = order; });
                    break;
                }
                case 'criterion.reorder': {
                    const item = gate(operation.gateId); owned(item.id); reorder(item.criteria, operation.ids); break;
                }
                case 'correction.attach':
                    unique(operation.id); parent(operation.parent, operation.criterionId);
                    candidate.corrections.push({ id: operation.id, projectId: expectedProjectId,
                        parent: operation.parent, ...(operation.criterionId === undefined ? {} : { criterionId: operation.criterionId }),
                        title: operation.title, objective: operation.objective,
                        order: nextOrder(candidate.corrections), ...defaults });
                    break;
                case 'correction.edit': {
                    const item = correction(operation.id); owned(item.id);
                    item.title = operation.title; item.objective = operation.objective; break;
                }
                case 'correction.reparent': {
                    const item = correction(operation.id); owned(item.id); parent(operation.parent, operation.criterionId);
                    item.parent = operation.parent;
                    if (operation.criterionId === undefined) delete item.criterionId;
                    else item.criterionId = operation.criterionId;
                    break;
                }
                case 'correction.delete':
                    correction(operation.id); owned(operation.id);
                    candidate.corrections = candidate.corrections.filter(item => item.id !== operation.id);
                    candidate.corrections.sort((a, b) => a.order - b.order).forEach((item, order) => {
                        if (item.order !== order) owned(item.id);
                        item.order = order;
                    });
                    break;
                case 'evidence.propose': {
                    unique(operation.id);
                    const target = criterion(operation.gateId, operation.criterionId);
                    target.evidence.push({ id: operation.id, projectId: expectedProjectId,
                        criterionId: target.id, result: operation.result, kind: operation.kind,
                        summary: operation.summary, verifiedBy: operation.verifiedBy,
                        observedAt: operation.observedAt, ...(operation.source && { source: operation.source }),
                        ...(operation.observedAction && { observedAction: operation.observedAction }),
                        ...(operation.receipt && { receipt: operation.receipt }),
                        criterionHash: criterionHash(target), review: { status: 'proposed' } });
                    break;
                }
                case 'evidence.approve': {
                    const item = criterion(operation.gateId, operation.criterionId).evidence.find(e => e.id === operation.id);
                    if (!item) throw new Error('Missing Roadmap evidence');
                    if (item.review.status !== 'proposed') throw new Error('Evidence is not awaiting review');
                    if (item.source && !operation.currentSource) throw new Error('Current tested source is required');
                    if (operation.currentSource && operation.currentSource.projectId !== expectedProjectId)
                        throw new Error('Foreign tested source');
                    if (!item.source && operation.currentSource) throw new Error('Source-free manual evidence has no tested source');
                    if (item.source && operation.currentSource &&
                        !sameRoadmapSource(item.source, operation.currentSource))
                        throw new Error('Tested evidence source changed');
                    if (item.receipt && (item.receipt.reviewerId !== operation.reviewerId ||
                        item.receipt.reviewedAt !== operation.reviewedAt ||
                        item.receipt.ownerId !== expectedProjectId ||
                        item.receipt.phaseId !== gate(operation.gateId).parentPhaseId ||
                        item.receipt.gateId !== operation.gateId ||
                        item.receipt.eventId !== item.id || !item.source))
                        throw new Error('Checked evidence receipt review differs from approval');
                    item.review = { status: 'approved', reviewerId: operation.reviewerId, reviewedAt: operation.reviewedAt };
                    if (operation.currentSource) gate(operation.gateId).qualificationSource = operation.currentSource;
                    break;
                }
                case 'evidence.revoke': {
                    const item = criterion(operation.gateId, operation.criterionId).evidence.find(e => e.id === operation.id);
                    if (!item) throw new Error('Missing Roadmap evidence');
                    if (item.review.status !== 'approved') throw new Error('Only approved evidence can be revoked');
                    item.review = { status: 'revoked', reviewerId: operation.reviewerId, reviewedAt: operation.reviewedAt };
                    break;
                }
                case 'gate.source':
                    if (operation.source.projectId !== expectedProjectId) throw new Error('Foreign tested source');
                    gate(operation.id).qualificationSource = operation.source;
                    if (gate(operation.id).waiver && !sameRoadmapSource(gate(operation.id).waiver!.source, operation.source))
                        delete gate(operation.id).waiver;
                    break;
                case 'gate.blockers':
                    gate(operation.id).qualificationBlockers = operation.reasons;
                    break;
                case 'gate.waiver.approve': {
                    const item = gate(operation.id);
                    if (operation.source.projectId !== expectedProjectId || !item.qualificationSource ||
                        !sameRoadmapSource(operation.source, item.qualificationSource))
                        throw new Error('Exceptional Gate waiver requires current owned source');
                    item.waiver = { authorizedBy: operation.authorizedBy, authorizedAt: operation.authorizedAt,
                        reason: operation.reason, source: operation.source };
                    break;
                }
                case 'gate.waiver.revoke':
                    if (!gate(operation.id).waiver) throw new Error('Gate has no exceptional waiver');
                    delete gate(operation.id).waiver;
                    break;
                case 'phase.coverage.approve': {
                    const item = phase(operation.id);
                    const requiredGateIds = candidate.gates.filter(entry => entry.parentPhaseId === item.id &&
                        entry.draftAcceptance !== 'proposed').map(entry => entry.id);
                    if (!requiredGateIds.length || !Array.isArray(operation.requiredGateIds) ||
                        operation.requiredGateIds.length !== requiredGateIds.length ||
                        new Set(operation.requiredGateIds).size !== requiredGateIds.length ||
                        operation.requiredGateIds.some(entityId => !requiredGateIds.includes(entityId)))
                        throw new Error('Approval must review the complete nonempty required Gate set');
                    if (operation.source.projectId !== expectedProjectId)
                        throw new Error('Foreign Phase approval source');
                    if (candidate.linkedDocument && (operation.source.path !== candidate.linkedDocument.path ||
                        operation.source.sha256 !== candidate.linkedDocument.sourceHash))
                        throw new Error('Phase approval source differs from linked Roadmap');
                    item.gateSetCoverage = { status: 'approved', approvedBy: operation.approvedBy,
                        reviewedAt: operation.reviewedAt, approvedAtRevision: current.revision + 1,
                        requiredGateIds: [...requiredGateIds].sort(), source: operation.source };
                    item.qualificationSource = operation.source;
                    if (item.amendment && item.planningLock)
                        item.planningLock.source = operation.source;
                    break;
                }
                case 'phase.coverage.revoke':
                    if (phase(operation.id).gateSetCoverage.status !== 'approved')
                        throw new Error('Phase Gate-set coverage is not approved');
                    phase(operation.id).gateSetCoverage = { status: 'unreviewed' };
                    break;
                case 'phase.source': {
                    const item = phase(operation.id);
                    if (operation.source.projectId !== expectedProjectId) throw new Error('Foreign Phase source');
                    item.qualificationSource = operation.source;
                    if (item.gateSetCoverage.status === 'approved' &&
                        !sameRoadmapSource(item.gateSetCoverage.source, operation.source))
                        item.gateSetCoverage = { status: 'unreviewed' };
                    break;
                }
                case 'phase.blockers':
                    phase(operation.id).qualificationBlockers = operation.reasons;
                    break;
                case 'phase.waiver.approve': {
                    const item = phase(operation.id);
                    if (!candidate.gates.some(entry => entry.parentPhaseId === item.id &&
                        entry.draftAcceptance !== 'proposed'))
                        throw new Error('Unplanned Phase cannot receive a waiver');
                    if (operation.source.projectId !== expectedProjectId || !item.qualificationSource ||
                        !sameRoadmapSource(operation.source, item.qualificationSource))
                        throw new Error('Exceptional Phase waiver requires current owned source');
                    item.exception = { kind: 'waived', authorizedBy: operation.authorizedBy,
                        authorizedAt: operation.authorizedAt, reason: operation.reason, source: operation.source };
                    break;
                }
                case 'phase.waiver.revoke':
                    if (!phase(operation.id).exception) throw new Error('Phase has no exceptional waiver');
                    delete phase(operation.id).exception;
                    break;
                default: throw new Error('Unknown Roadmap Gate mutation');
            }
            if (operation.type === 'evidence.propose' || operation.type === 'evidence.approve' ||
                operation.type === 'evidence.revoke' || operation.type === 'gate.source' || operation.type === 'gate.blockers' ||
                operation.type === 'gate.waiver.approve' || operation.type === 'gate.waiver.revoke') {
                const changedGate = gate(operation.type === 'gate.source' || operation.type === 'gate.blockers' ||
                    operation.type === 'gate.waiver.approve' || operation.type === 'gate.waiver.revoke' ?
                    operation.id : operation.gateId);
                changedGate.qualificationStatus = evaluateGateQualification(changedGate,
                    changedGate.qualificationSource, phase(changedGate.parentPhaseId)).status;
            }
            // Definition changes invalidate prior qualification. Evidence review alone does not
            // invalidate the phase's approved gate-set definition.
            const definitionChange = !operation.type.startsWith('evidence.') &&
                operation.type !== 'gate.source' && operation.type !== 'gate.blockers' &&
                !operation.type.startsWith('gate.waiver.') &&
                !operation.type.startsWith('phase.coverage.') && !operation.type.startsWith('phase.waiver.') &&
                operation.type !== 'phase.source' && operation.type !== 'phase.blockers';
            const affectedPhases = new Set<string>();
            for (const item of definitionChange ? candidate.gates : []) {
                const previous = current.gates.find(entry => entry.id === item.id);
                if (!previous || JSON.stringify(previous) !== JSON.stringify(item)) {
                    affectedPhases.add(item.parentPhaseId);
                    if (item.waiver) delete item.waiver;
                    if (item.qualificationStatus === 'green' || item.criteria.some(criterion =>
                        criterion.evidence.some(evidence => evidence.review.status === 'approved' &&
                            evidence.validation?.status === 'stale'))) item.qualificationStatus = 'stale';
                }
            }
            for (const item of definitionChange ? current.gates : []) {
                if (!candidate.gates.some(entry => entry.id === item.id)) affectedPhases.add(item.parentPhaseId);
            }
            for (const item of definitionChange ? candidate.corrections : []) {
                const previous = current.corrections.find(entry => entry.id === item.id);
                if (!previous || JSON.stringify(previous) !== JSON.stringify(item)) {
                    const owner = item.parent.kind === 'phase' ? item.parent.id : gate(item.parent.id).parentPhaseId;
                    affectedPhases.add(owner);
                    if (previous) affectedPhases.add(previous.parent.kind === 'phase' ? previous.parent.id :
                        current.gates.find(entry => entry.id === previous.parent.id)!.parentPhaseId);
                }
            }
            for (const item of definitionChange ? current.corrections : []) {
                if (!candidate.corrections.some(entry => entry.id === item.id))
                    affectedPhases.add(item.parent.kind === 'phase' ? item.parent.id :
                        current.gates.find(entry => entry.id === item.parent.id)!.parentPhaseId);
            }
            for (const item of candidate.phases) {
                const previous = current.phases.find(entry => entry.id === item.id);
                if (affectedPhases.has(item.id)) item.gateSetCoverage = { status: 'unreviewed' };
                if (definitionChange && previous && (item.title !== previous.title ||
                    item.objective !== previous.objective || item.draftAcceptance !== previous.draftAcceptance ||
                    JSON.stringify(item.dependencies) !== JSON.stringify(previous.dependencies)))
                    item.gateSetCoverage = { status: 'unreviewed' };
                if (item.exception && (affectedPhases.has(item.id) || item.qualificationSource &&
                    !sameRoadmapSource(item.exception.source, item.qualificationSource))) delete item.exception;
                const result = evaluatePhaseQualification(candidate, item.id, item.qualificationSource);
                item.qualificationStatus = result.status === 'green' ? 'green' : result.status === 'blocked' ? 'blocked' :
                    result.status === 'waived' ? 'waived' : result.status === 'stale' ||
                    previous?.qualificationStatus === 'green' || previous?.gateSetCoverage.status === 'approved' &&
                    item.gateSetCoverage.status !== 'approved' ? 'stale' :
                    result.status === 'not-green' ? 'not-green' : 'unknown';
            }
            }
            if (JSON.stringify(candidate) === JSON.stringify(current)) throw new Error('Roadmap mutation has no changes');
            candidate.revision = current.revision + 1;
            if (nativeBasis?.amendment) {
                const { phaseId, approvalId } = nativeBasis.amendment;
                const review = this.amendmentReviews.get(approvalId);
                if (!previewOnly && (!review || review.phaseId !== phaseId ||
                    review.revision !== current.revision || review.headHash !== expectedHash ||
                    review.after !== phasePlanningDefinition(candidate, phaseId)))
                    throw new Error('Stale or unissued Phase amendment');
                if (current.pendingPublication || current.linkedDocument &&
                    (current.linkedDocument.syncState !== 'synced' || current.linkedDocument.pending ||
                        current.linkedDocument.syncIntent || autoSyncInFlight.has(root)))
                    throw new Error('Linked Roadmap source conflict requires recovery before amendment');
                if (current.linkedDocument) {
                    const mapped = await readGateMappedDocument(root, current.linkedDocument);
                    if (mapped.hash !== current.linkedDocument.sourceHash || mapped.diagnostics.length ||
                        structureDiagnostics(current, mapped).length)
                        throw new Error('Linked Roadmap source changed; review amendment again');
                }
                for (const item of current.phases.filter(item => item.id !== phaseId))
                    if (phasePlanningDefinition(current, item.id) !== phasePlanningDefinition(candidate, item.id))
                        throw new Error('Amendment affects another Phase');
                const impact = amendmentImpact(current, candidate, phaseId);
                const oldPhase = current.phases.find(item => item.id === phaseId)!;
                const changed = phasePlanningDefinition(current, phaseId) !== phasePlanningDefinition(candidate, phaseId);
                if (!changed) throw new Error('Phase amendment has no definition change');
                const amended = candidate.phases.find(item => item.id === phaseId)!;
                amended.planningLock = { ...structuredClone(oldPhase.planningLock!), approvalId,
                    lockedAt: new Date().toISOString(), basisRevision: current.revision,
                    requiredGateIds: candidate.gates.filter(item => item.parentPhaseId === phaseId &&
                        item.draftAcceptance !== 'proposed').sort((a, b) => a.order - b.order).map(item => item.id),
                    criteria: candidate.gates.filter(item => item.parentPhaseId === phaseId &&
                        item.draftAcceptance !== 'proposed').sort((a, b) => a.order - b.order)
                        .flatMap(gate => [...gate.criteria].sort((a, b) => a.order - b.order)
                            .map(item => ({ id: item.id, expectedResult: item.expectedResult }))) };
                if (!amended.planningLock.requiredGateIds.length || !amended.planningLock.criteria.length)
                    throw new Error('Amendment cannot empty a locked Phase');
                if (impact.affectedGateIds.length) {
                    amended.gateSetCoverage = { status: 'unreviewed' };
                    amended.qualificationStatus = 'stale';
                    const retainedLinks = (oldPhase.workLinks ?? []).filter(link =>
                        !impact.affectedWorkItemIds.includes(link.workItemId));
                    if (retainedLinks.length) amended.workLinks = structuredClone(retainedLinks);
                    else delete amended.workLinks;
                    for (const gate of candidate.gates.filter(item => impact.affectedGateIds.includes(item.id))) {
                        gate.qualificationStatus = 'stale';
                        for (const criterion of gate.criteria.filter(item =>
                            impact.affectedCriterionIds.includes(item.id)))
                            for (const evidence of criterion.evidence)
                                evidence.validation = { status: 'stale', reason: 'Reviewed Phase amendment changed the requirement basis' };
                    }
                } else {
                    amended.gateSetCoverage = structuredClone(oldPhase.gateSetCoverage);
                    amended.qualificationStatus = oldPhase.qualificationStatus;
                    if (oldPhase.exception) amended.exception = structuredClone(oldPhase.exception);
                    for (const gate of candidate.gates.filter(item => item.parentPhaseId === phaseId)) {
                        const oldGate = current.gates.find(item => item.id === gate.id);
                        if (!oldGate) continue;
                        gate.qualificationStatus = oldGate.qualificationStatus;
                        if (oldGate.waiver) gate.waiver = structuredClone(oldGate.waiver);
                    }
                }
                amended.amendment = { approvalId, reviewedBy: oldPhase.planningLock!.lockedBy,
                    reviewedAt: new Date().toISOString(), oldRevision: current.revision,
                    newRevision: candidate.revision, oldSource: structuredClone(oldPhase.planningLock!.source),
                    ...impact };
            }
            if (candidate.linkedDocument) withAutoSyncIntent(candidate);
            parseRoadmapIndex(candidate, root);
            if (!previewOnly) await this.replace(root, candidate, expectedHash, nativeBasis?.operationIds);
            return candidate;
        });
        if (!previewOnly) this.publish({ root, projectId: next.projectId, revision: next.revision,
            changedIds: [...next.phases, ...next.gates, ...next.corrections].map(item => item.id) });
        if (!previewOnly && next.linkedDocument?.syncIntent) this.scheduleAutoSync(root);
        return next;
    }

    private scheduleAutoSync(root: string): void {
        if (autoSyncInFlight.has(root)) { autoSyncReschedule.add(root); return; }
        if (autoSyncTimers.has(root)) return;
        const timer = setTimeout(() => {
            autoSyncTimers.delete(root);
            void this.recoverAutoSync(root).catch(error => {
                if (/Roadmap locked/.test(String(error))) setTimeout(() => this.scheduleAutoSync(root), 100);
            });
        }, 20);
        autoSyncTimers.set(root, timer);
    }

    /** Safe to call after restart or retry. The index intent survives a crash before any side journal write. */
    async recoverAutoSync(root: string): Promise<RoadmapGateIndex> {
        const timer = autoSyncTimers.get(root);
        if (timer) { clearTimeout(timer); autoSyncTimers.delete(root); }
        const existing = autoSyncInFlight.get(root);
        if (existing) return existing;
        const work = this.recoverAutoSyncNow(root);
        autoSyncInFlight.set(root, work);
        try { return await work; }
        finally {
            if (autoSyncInFlight.get(root) === work) autoSyncInFlight.delete(root);
            if (autoSyncReschedule.delete(root)) this.scheduleAutoSync(root);
        }
    }

    private async recoverAutoSyncNow(root: string): Promise<RoadmapGateIndex> {
        const result = await this.locked(root, async () => {
            const bytes = await this.canonicalBytes(root);
            if (!bytes) throw new Error('Roadmap is not initialized');
            const index = parseRoadmapIndex(JSON.parse(bytes.toString('utf8')), root);
            const intent = index.linkedDocument?.syncIntent;
            if (!intent) return index;
            if (intent.indexDigest !== autoSyncIndexDigest(index) || intent.revision !== index.revision)
                throw new Error('Roadmap sync intent differs from canonical index');
            const existing = await readAutoSyncJournal(root);
            let journal: RoadmapAutoSyncJournal = journalMatches(index, existing) ? existing! :
                { version: 1, projectId: index.projectId, intent, status: 'pending' };
            try {
                await recoverAutoSyncBackup(root, index, journal.targetHash, journal.beforeHash);
                if (journal.status === 'synced' && journal.targetHash && journal.sections && journal.fields) {
                    await verifyAutoSync(root, index, journal);
                    return overlayAutoSync(index, journal);
                }
                if (!journal.content || !journal.targetHash || !journal.sections || !journal.fields) {
                    const prepared = await prepareAutoSync(root, index, journal.beforeHash);
                    journal = { ...journal, status: 'pending', content: prepared.content,
                        targetHash: prepared.targetHash, sections: prepared.sections, fields: prepared.fields };
                    await writeAutoSyncJournal(root, journal);
                }
                // Persist the expected post-write bytes before touching the source.
                journal.status = 'syncing';
                await writeAutoSyncJournal(root, journal);
                await publishAutoSync(root, index, journal);
                journal.status = 'synced';
                delete journal.reason;
                await writeAutoSyncJournal(root, journal);
            } catch (error) {
                const message = String(error);
                journal.status = /changed externally|mapping differs|structure differs|Unsafe|symlink|missing|collision|Stale linked/.test(message) ?
                    'conflict' : 'failed';
                journal.reason = message.slice(0, 1024);
                await writeAutoSyncJournal(root, journal);
            }
            return overlayAutoSync(index, journal);
        });
        this.publish({ root, projectId: result.projectId, revision: result.revision, changedIds: [] });
        return result;
    }

    /** Review only a prose-only external source change against the last verified mapping. */
    async previewAutoSyncReconciliation(root: string): Promise<RoadmapAutoSyncReconciliationPreview> {
        const bytes = await this.canonicalBytes(root);
        if (!bytes) throw new Error('Roadmap is not initialized');
        const index = parseRoadmapIndex(JSON.parse(bytes.toString('utf8')), root);
        const linked = index.linkedDocument;
        if (!linked?.syncIntent || linked.projectRoot !== root || linked.projectId !== index.projectId)
            throw new Error('No pending linked Roadmap synchronization');
        const preview: RoadmapAutoSyncReconciliationPreview = { approvalId: randomUUID(),
            projectId: index.projectId, revision: index.revision, path: linked.path,
            acceptedHash: linked.sourceHash, compatible: false, diagnostics: [] };
        try {
            const source = await checkedRoadmapDocumentFile(root, linked.path);
            preview.externalHash = publicationHash(source.bytes);
            if (preview.externalHash === linked.sourceHash)
                preview.diagnostics.push('Source matches the accepted bytes; retry synchronization');
            else {
                const prepared = await prepareAutoSync(root, index, preview.externalHash);
                preview.targetHash = prepared.targetHash;
                preview.before = prepared.before;
                preview.after = prepared.content;
                preview.compatible = true;
                this.reconciliationReviews.set(preview.approvalId, structuredClone(preview));
                if (this.reconciliationReviews.size > 32)
                    this.reconciliationReviews.delete(this.reconciliationReviews.keys().next().value!);
            }
        } catch (error) { preview.diagnostics.push(String(error)); }
        return preview;
    }

    async applyAutoSyncReconciliation(root: string, preview: RoadmapAutoSyncReconciliationPreview,
        approved: boolean): Promise<RoadmapGateIndex> {
        const reviewed = this.reconciliationReviews.get(preview.approvalId);
        this.reconciliationReviews.delete(preview.approvalId);
        if (!approved) return this.read<RoadmapGateIndex>(root);
        if (!reviewed || !preview.compatible || JSON.stringify(reviewed) !== JSON.stringify(preview))
            throw new Error('Stale or unissued Roadmap reconciliation review');
        await this.locked(root, async () => {
            const bytes = await this.canonicalBytes(root);
            if (!bytes) throw new Error('Roadmap is not initialized');
            const index = parseRoadmapIndex(JSON.parse(bytes.toString('utf8')), root);
            const linked = index.linkedDocument;
            if (!linked?.syncIntent || index.projectId !== preview.projectId || index.revision !== preview.revision ||
                linked.sourceHash !== preview.acceptedHash || linked.path !== preview.path ||
                linked.syncIntent.indexDigest !== autoSyncIndexDigest(index))
                throw new Error('Stale Roadmap reconciliation revision');
            const prepared = await prepareAutoSync(root, index, preview.externalHash);
            if (prepared.before !== preview.before || prepared.content !== preview.after ||
                prepared.targetHash !== preview.targetHash || !preview.externalHash)
                throw new Error('Stale Roadmap reconciliation source or result');
            const journal: RoadmapAutoSyncJournal = { version: 1, projectId: index.projectId,
                intent: linked.syncIntent, status: 'pending', beforeHash: preview.externalHash,
                content: prepared.content, targetHash: prepared.targetHash,
                sections: prepared.sections, fields: prepared.fields };
            await writeAutoSyncJournal(root, journal);
        });
        return this.recoverAutoSync(root);
    }

    private async inspectExistingRoadmapLink(root: string, current: RoadmapGateIndex,
        path: string): Promise<Omit<RoadmapExistingLinkPreview, 'approvalId'>> {
        if (current.pendingPublication || current.linkedDocument)
            throw new Error('Roadmap already has a linked or pending publication');
        await checkedPublicationPath(root, path);
        // The serializer verifies that every accepted record has a supported Markdown mapping.
        const expected = serializeRoadmapPublication(current, path);
        const linked: NonNullable<RoadmapGateIndex['linkedDocument']> = {
            projectId: current.projectId, projectRoot: root, path,
            sourceHash: expected.sourceHash, syncState: 'synced', sections: expected.sections,
        };
        const mapped = await readGateMappedDocument(root, linked);
        const diagnostics = [...mapped.diagnostics, ...mapped.missingMetadata, ...structureDiagnostics(current, mapped)];
        for (const field of expected.fields) {
            const source = mapped.fields.find(item => item.kind === field.kind && item.id === field.id);
            if (!source) diagnostics.push(`Missing ${field.kind} ${field.id}`);
            else if (JSON.stringify(source) !== JSON.stringify(field))
                diagnostics.push(`${field.kind} ${field.id} title or detail differs from accepted Roadmap`);
        }
        if (mapped.fields.length !== expected.fields.length)
            diagnostics.push('Mapped section count differs from accepted Roadmap');
        return { projectId: current.projectId, projectRoot: root, revision: current.revision,
            path, sourceHash: mapped.hash, phaseCount: expected.phaseCount, gateCount: expected.gateCount,
            criterionCount: expected.criterionCount, compatible: diagnostics.length === 0,
            diagnostics, sections: expected.sections, fields: mapped.fields };
    }

    async previewExistingRoadmapLink(root: string, path: string): Promise<RoadmapExistingLinkPreview> {
        const current = await this.read<RoadmapGateIndex>(root);
        const preview = { ...await this.inspectExistingRoadmapLink(root, current, path), approvalId: randomUUID() };
        if (preview.compatible) {
            this.existingLinkReviews.set(preview.approvalId, preview);
            if (this.existingLinkReviews.size > 32)
                this.existingLinkReviews.delete(this.existingLinkReviews.keys().next().value!);
        }
        return preview;
    }

    async applyExistingRoadmapLink(root: string, preview: RoadmapExistingLinkPreview,
        approved: boolean): Promise<RoadmapGateIndex> {
        if (!approved) { this.existingLinkReviews.delete(preview.approvalId);
            return this.read<RoadmapGateIndex>(root); }
        let applied = false;
        const result = await this.locked(root, async () => {
            const { file } = await this.paths(root);
            const expectedHash = await this.indexHash(file);
            const current = await this.read<RoadmapGateIndex>(root);
            const intentHash = publicationHash(JSON.stringify(preview));
            if (current.linkedDocument?.publicationIntentHash === intentHash &&
                current.linkedDocument.path === preview.path && current.linkedDocument.sourceHash === preview.sourceHash &&
                current.projectId === preview.projectId && current.projectRoot === preview.projectRoot &&
                await verifiedPublicationFile(root, preview.path, preview.sourceHash)) return current;
            if (!preview.compatible ||
                JSON.stringify(this.existingLinkReviews.get(preview.approvalId)) !== JSON.stringify(preview) ||
                current.projectId !== preview.projectId || current.projectRoot !== preview.projectRoot ||
                current.revision !== preview.revision)
                throw new Error('Stale or incompatible existing Markdown review; preview again');
            const fresh = await this.inspectExistingRoadmapLink(root, current, preview.path);
            const { approvalId: _approvalId, ...reviewed } = preview;
            if (JSON.stringify(fresh) !== JSON.stringify(reviewed) ||
                !(await verifiedPublicationFile(root, preview.path, preview.sourceHash)))
                throw new Error('Stale existing Markdown source or Roadmap; preview again');
            const linked: NonNullable<RoadmapGateIndex['linkedDocument']> = {
                projectId: current.projectId, projectRoot: root, path: preview.path,
                sourceHash: preview.sourceHash, publicationIntentHash: intentHash, syncState: 'synced',
                sections: preview.sections,
                lastSynced: { sourceHash: preview.sourceHash, fields: preview.fields,
                    structure: gateIndexStructure(current) },
            };
            const next: RoadmapGateIndex = { ...current, revision: current.revision + 1,
                phases: current.phases.map(phase => ({ ...phase, draftAcceptance: 'published' })),
                gates: current.gates.map(gate => ({ ...gate, draftAcceptance: 'published' })),
                corrections: current.corrections.map(correction => ({ ...correction, draftAcceptance: 'published' })),
                linkedDocument: linked };
            await this.replace(root, next, expectedHash);
            applied = true;
            return next;
        });
        this.existingLinkReviews.delete(preview.approvalId);
        if (applied) this.publish({ root, projectId: result.projectId, revision: result.revision,
            changedIds: [...result.phases, ...result.gates, ...result.corrections].map(item => item.id) });
        return result;
    }

    /** A review is issued by this owner, never reconstructed from caller-provided Markdown. */
    async previewRoadmapPublication(root: string, path = 'ROADMAP.md'): Promise<RoadmapPublicationPreview> {
        const current = await this.read<RoadmapGateIndex>(root);
        if (current.pendingPublication) throw new Error('Pending Roadmap publication requires recovery');
        await checkedPublicationDestination(root, path);
        const preview: RoadmapPublicationPreview = { ...serializeRoadmapPublication(current, path),
            approvalId: randomUUID() };
        this.publicationReviews.set(preview.approvalId, preview);
        if (this.publicationReviews.size > 32) this.publicationReviews.delete(this.publicationReviews.keys().next().value!);
        return preview;
    }

    private async settleRoadmapPublication(root: string, current: RoadmapGateIndex,
        expectedHash: string | null): Promise<RoadmapGateIndex> {
        const pending = current.pendingPublication;
        if (!pending) throw new Error('No pending Roadmap publication');
        const destination = join(root, pending.path);
        const temporary = join(dirname(destination), `.${pending.approvalId}.dope-roadmap-publish.tmp`);
        if (!(await verifiedPublicationFile(root, pending.path, pending.sourceHash))) {
            await checkedPublicationDestination(root, pending.path);
            let tempExists = false;
            try { await lstat(temporary); tempExists = true; }
            catch (error) { if (!missing(error)) throw error; }
            if (!tempExists) {
                const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL |
                    constants.O_NOFOLLOW, 0o600);
                try { await handle.writeFile(pending.content); await handle.sync(); }
                finally { await handle.close(); }
            }
            if (!(await verifiedPublicationFile(root, temporary.slice(root.length + 1), pending.sourceHash, true)))
                throw new Error('Pending publication staging file is missing');
            try { await hardLink(temporary, destination); }
            catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST' ||
                    !(await verifiedPublicationFile(root, pending.path, pending.sourceHash))) throw error;
            }
            const parent = await open(dirname(destination), 'r');
            try { await parent.sync(); } finally { await parent.close(); }
        }
        if (!(await verifiedPublicationFile(root, pending.path, pending.sourceHash)))
            throw new Error('Publication file is missing or differs from approved bytes');
        const basis = { ...current, revision: pending.basisRevision };
        delete basis.pendingPublication;
        const generated = serializeRoadmapPublication(basis, pending.path);
        if (generated.sourceHash !== pending.sourceHash || generated.content !== pending.content)
            throw new Error('Pending publication no longer matches the accepted Roadmap');
        const linked: NonNullable<RoadmapGateIndex['linkedDocument']> = {
            projectId: current.projectId, projectRoot: root, path: pending.path, sourceHash: pending.sourceHash,
            publicationIntentHash: publicationHash(JSON.stringify({ ...generated, approvalId: pending.approvalId })),
            syncState: 'synced', sections: generated.sections,
            lastSynced: { sourceHash: pending.sourceHash, fields: generated.fields,
                structure: gateIndexStructure(basis) } };
        const mapped = await readGateMappedDocument(root, linked);
        if (mapped.hash !== pending.sourceHash || mapped.diagnostics.length ||
            JSON.stringify(mapped.fields) !== JSON.stringify(generated.fields))
            throw new Error('Published document failed linked-source mapping; recovery remains pending');
        const next: RoadmapGateIndex = { ...basis, revision: current.revision + 1,
            phases: current.phases.map(phase => ({ ...phase, draftAcceptance: 'published' })),
            gates: current.gates.map(gate => ({ ...gate, draftAcceptance: 'published' })),
            corrections: current.corrections.map(correction => ({ ...correction, draftAcceptance: 'published' })),
            linkedDocument: linked };
        await this.replace(root, next, expectedHash);
        await rm(temporary, { force: true });
        return next;
    }

    async applyRoadmapPublication(root: string, preview: RoadmapPublicationPreview,
        approved: boolean): Promise<RoadmapGateIndex> {
        if (!approved) { this.publicationReviews.delete(preview.approvalId); return this.read<RoadmapGateIndex>(root); }
        let settled = false;
        const result = await this.locked(root, async () => {
            const { file } = await this.paths(root);
            let expectedHash = await this.indexHash(file);
            const current = await this.read<RoadmapGateIndex>(root);
            if (current.linkedDocument?.path === preview.path &&
                current.linkedDocument.sourceHash === preview.sourceHash &&
                current.linkedDocument.publicationIntentHash === publicationHash(JSON.stringify(preview)) &&
                current.projectId === preview.projectId && current.projectRoot === preview.projectRoot &&
                await verifiedPublicationFile(root, preview.path, preview.sourceHash)) return current;
            if (current.pendingPublication) throw new Error('Pending Roadmap publication requires recovery');
            if (JSON.stringify(this.publicationReviews.get(preview.approvalId)) !== JSON.stringify(preview) ||
                current.projectId !== preview.projectId || current.projectRoot !== preview.projectRoot ||
                current.revision !== preview.revision)
                throw new Error('Stale or foreign Roadmap publication approval; preview again');
            await checkedPublicationDestination(root, preview.path);
            const fresh = serializeRoadmapPublication(current, preview.path);
            const { approvalId: _approvalId, ...reviewed } = preview;
            if (JSON.stringify(fresh) !== JSON.stringify(reviewed))
                throw new Error('Roadmap publication preview changed; preview again');
            const marker: RoadmapGateIndex = { ...current, revision: current.revision + 1,
                pendingPublication: { approvalId: preview.approvalId, basisRevision: current.revision,
                    path: preview.path, sourceHash: preview.sourceHash, content: preview.content } };
            await this.replace(root, marker, expectedHash);
            expectedHash = await this.indexHash(file);
            const next = await this.settleRoadmapPublication(root, marker, expectedHash);
            settled = true;
            return next;
        });
        this.publicationReviews.delete(preview.approvalId);
        if (settled) this.publish({ root, projectId: result.projectId, revision: result.revision,
            changedIds: [...result.phases, ...result.gates, ...result.corrections].map(item => item.id) });
        return result;
    }

    async recoverRoadmapPublication(root: string): Promise<RoadmapGateIndex> {
        let settled = false;
        const result = await this.locked(root, async () => {
            const { file } = await this.paths(root);
            const current = await this.read<RoadmapGateIndex>(root);
            if (!current.pendingPublication) return current;
            const next = await this.settleRoadmapPublication(root, current, await this.indexHash(file));
            settled = true;
            return next;
        });
        if (settled) this.publish({ root, projectId: result.projectId, revision: result.revision,
            changedIds: [...result.phases, ...result.gates, ...result.corrections].map(item => item.id) });
        return result;
    }

    private async readRetired(root: string): Promise<RoadmapIndex> {
        const current = await this.read<RoadmapGateIndex>(root);
        throw new Error(`Checkpoint Roadmap operations are retired for schema ${current.schemaVersion}; use Gate actions`);
    }

    /** An accepted Gate draft is independent from publication of its linked Markdown. */
    async previewGateDocumentPatch(root: string, edit: GateDocumentEdit): Promise<GateDocumentPatch> {
        return planGateDocumentPatch(root, await this.read<RoadmapGateIndex>(root), edit);
    }

    private gateDocumentCandidate(current: RoadmapGateIndex, fields: GateMappedField[], sourceHash: string): RoadmapGateIndex {
        const next = structuredClone(current);
        const previousHash = current.linkedDocument!.sourceHash;
        for (const field of fields) {
            const prior = gateField(current, field.kind, field.id);
            if (!prior) throw new Error('Missing linked Gate owner');
            if (field.kind === 'phase') {
                const phase = next.phases.find(item => item.id === field.id)!;
                phase.title = field.title; phase.objective = field.detail;
                if (['green', 'waived', 'not-green'].includes(phase.qualificationStatus)) phase.qualificationStatus = 'stale';
                if (field.title !== prior.title || field.detail !== prior.detail) phase.gateSetCoverage = { status: 'unreviewed' };
            } else if (field.kind === 'gate') {
                const gate = next.gates.find(item => item.id === field.id)!;
                gate.title = field.title; gate.purpose = field.detail;
                if (['green', 'waived', 'not-green'].includes(gate.qualificationStatus)) gate.qualificationStatus = 'stale';
                if (field.title !== prior.title || field.detail !== prior.detail)
                    next.phases.find(item => item.id === gate.parentPhaseId)!.gateSetCoverage = { status: 'unreviewed' };
            } else if (field.kind === 'criterion') {
                const gate = next.gates.find(item => item.criteria.some(c => c.id === field.id))!;
                const criterion = gate.criteria.find(item => item.id === field.id)!;
                criterion.title = field.title; criterion.expectedResult = field.detail;
                if (['green', 'waived', 'not-green'].includes(gate.qualificationStatus)) gate.qualificationStatus = 'stale';
                if (field.title !== prior.title || field.detail !== prior.detail)
                    next.phases.find(item => item.id === gate.parentPhaseId)!.gateSetCoverage = { status: 'unreviewed' };
            } else {
                const correction = next.corrections.find(item => item.id === field.id)!;
                correction.title = field.title; correction.objective = field.detail;
            }
        }
        if (sourceHash !== previousHash) {
            for (const phase of next.phases) if (['green', 'waived', 'not-green'].includes(phase.qualificationStatus))
                phase.qualificationStatus = 'stale';
            for (const gate of next.gates) if (['green', 'waived', 'not-green'].includes(gate.qualificationStatus))
                gate.qualificationStatus = 'stale';
        }
        next.linkedDocument = { ...next.linkedDocument!, sourceHash, syncState: 'synced', pending: undefined,
            lastSynced: { sourceHash, fields, structure: gateIndexStructure(next) } };
        return next;
    }

    async previewGateDocumentSync(root: string): Promise<GateDocumentSyncPreview> {
        return previewGateDocumentSync(root, await this.read<RoadmapGateIndex>(root));
    }

    async applyGateDocumentSync(root: string, expected: GateDocumentSyncPreview, approved: boolean): Promise<RoadmapGateIndex> {
        if (!approved) return this.read<RoadmapGateIndex>(root);
        if (expected.state !== 'source-changed' || !expected.sourceHash) throw new Error('No safe Gate source change to accept');
        const result = await this.locked(root, async () => {
            const { file } = await this.paths(root); const expectedHash = await this.indexHash(file);
            const current = await this.read<RoadmapGateIndex>(root);
            if (current.projectId !== expected.projectId || current.revision !== expected.revision)
                throw new Error('Stale Gate sync owner or revision');
            const fresh = await previewGateDocumentSync(root, current);
            if (fresh.state !== 'source-changed' || JSON.stringify(fresh) !== JSON.stringify(expected))
                throw new Error('Stale Gate sync preview');
            const mapped = await readGateMappedDocument(root, current.linkedDocument!);
            if (mapped.hash !== expected.sourceHash || mapped.diagnostics.length) throw new Error('Stale Gate source');
            const next = this.gateDocumentCandidate(current, mapped.fields, mapped.hash);
            next.revision++;
            await this.replace(root, next, expectedHash);
            return next;
        });
        this.publish({ root, projectId: result.projectId, revision: result.revision,
            changedIds: [...result.phases, ...result.gates, ...result.corrections].map(item => item.id) });
        return result;
    }

    async previewGateRelink(root: string, path: string): Promise<GateDocumentRelinkPreview> {
        return previewGateDocumentRelink(root, await this.read<RoadmapGateIndex>(root), path);
    }

    async applyGateRelink(root: string, expected: GateDocumentRelinkPreview, approved: boolean): Promise<RoadmapGateIndex> {
        if (!approved) return this.read<RoadmapGateIndex>(root);
        if (expected.state !== 'ready' || !expected.sourceHash) throw new Error('Relink requires a safe approved preview');
        const next = await this.locked(root, async () => {
            const { file } = await this.paths(root); const expectedHash = await this.indexHash(file);
            const current = await this.read<RoadmapGateIndex>(root);
            if (current.projectId !== expected.projectId || current.revision !== expected.revision)
                throw new Error('Stale Gate relink owner or revision');
            const fresh = await previewGateDocumentRelink(root, current, expected.path);
            if (fresh.state !== 'ready' || JSON.stringify(fresh) !== JSON.stringify(expected))
                throw new Error('Stale Gate relink preview');
            const candidate: RoadmapGateIndex = { ...structuredClone(current), revision: current.revision + 1,
                linkedDocument: { ...current.linkedDocument!, path: fresh.path, sourceHash: fresh.sourceHash!, syncState: 'synced' } };
            for (const phase of candidate.phases)
                if (['green', 'waived', 'not-green'].includes(phase.qualificationStatus)) phase.qualificationStatus = 'stale';
            for (const gate of candidate.gates)
                if (['green', 'waived', 'not-green'].includes(gate.qualificationStatus)) gate.qualificationStatus = 'stale';
            await this.replace(root, candidate, expectedHash); return candidate;
        });
        this.publish({ root, projectId: next.projectId, revision: next.revision, changedIds: [] });
        return next;
    }

    /** Persist intent before the independent Markdown write, then settle the single Roadmap owner. */
    async publishGateDocumentPatch(root: string, expected: GateDocumentPatch, approved: boolean): Promise<RoadmapGateIndex> {
        if (!approved) return this.read<RoadmapGateIndex>(root);
        const result = await this.locked(root, async () => {
            const { file } = await this.paths(root); let expectedHash = await this.indexHash(file);
            const current = await this.read<RoadmapGateIndex>(root);
            if (current.projectId !== expected.projectId || current.revision !== expected.revision)
                throw new Error('Stale Gate patch owner or revision');
            const fresh = await planGateDocumentPatch(root, current, expected.edit);
            if (JSON.stringify(fresh) !== JSON.stringify(expected)) throw new Error('Stale Gate document patch preview');
            const marker: RoadmapGateIndex = { ...current, revision: current.revision + 1,
                linkedDocument: { ...current.linkedDocument!, syncState: 'pending-sync', pending: {
                    basisRevision: current.revision, beforeHash: expected.beforeHash, afterHash: expected.afterHash,
                    edit: { kind: expected.edit.kind, id: expected.edit.id,
                        ...(expected.edit.title === undefined ? {} : { title: expected.edit.title }),
                        ...(expected.edit.detail === undefined ? {} : { detail: expected.edit.detail }) }, outcome: 'prepared' } } };
            await this.replace(root, marker, expectedHash);
            try { await publishRoadmapDocumentPatch(root, expected); }
            catch (error) { throw new Error(`Linked Gate pending sync; recover before retrying: ${String(error)}`); }
            expectedHash = await this.indexHash(file);
            const mapped = await readGateMappedDocument(root, marker.linkedDocument!);
            if (mapped.hash !== expected.afterHash || mapped.diagnostics.length)
                throw new Error('Linked Gate pending sync; source changed after publication');
            const next = this.gateDocumentCandidate(marker, mapped.fields, mapped.hash);
            next.revision++;
            await this.replace(root, next, expectedHash);
            return next;
        });
        this.publish({ root, projectId: result.projectId, revision: result.revision,
            changedIds: [expected.edit.id] });
        return result;
    }

    async recoverGateDocumentPatch(root: string, approved: boolean): Promise<RoadmapGateIndex> {
        if (!approved) return this.read<RoadmapGateIndex>(root);
        return this.locked(root, async () => {
            const { file } = await this.paths(root); const expectedHash = await this.indexHash(file);
            const current = await this.read<RoadmapGateIndex>(root);
            const linked = current.linkedDocument; const pending = linked?.pending;
            if (!linked || !pending || linked.syncState !== 'pending-sync') throw new Error('No pending Gate patch');
            const backup = join(root, `${linked.path}.dope-pending-backup`);
            let backupPresent = false;
            let backupConflict = false;
            try {
                const info = await lstat(backup);
                if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024)
                    throw new Error('Unsafe pending Gate backup');
                if (info.size === 0) {
                    await lstat(join(root, linked.path));
                    await rm(backup);
                } else {
                    const handle = await open(backup, constants.O_RDONLY | constants.O_NOFOLLOW);
                    try {
                        if (createHash('sha256').update(await handle.readFile()).digest('hex') !== pending.beforeHash)
                            backupConflict = true;
                    } finally { await handle.close(); }
                    if (!backupConflict) {
                        backupPresent = true;
                        try { await lstat(join(root, linked.path)); }
                        catch (error) {
                            if (!missing(error)) throw error;
                            await hardLink(backup, join(root, linked.path));
                        }
                    }
                }
            } catch (error) { if (!missing(error)) throw error; }
            const mapped = backupConflict ? undefined : await readGateMappedDocument(root, linked).catch(() => undefined);
            if (backupConflict || !mapped || mapped.diagnostics.length ||
                mapped.hash !== pending.beforeHash && mapped.hash !== pending.afterHash) {
                if (pending.outcome === 'conflict') return current;
                const conflict: RoadmapGateIndex = { ...current, revision: current.revision + 1,
                    linkedDocument: { ...linked, pending: { ...pending, outcome: 'conflict' } } };
                await this.replace(root, conflict, expectedHash); return conflict;
            }
            const next = mapped.hash === pending.beforeHash ? { ...current, revision: current.revision + 1,
                linkedDocument: { ...linked, syncState: 'synced' as const, pending: undefined } } :
                this.gateDocumentCandidate(current, mapped.fields, mapped.hash);
            if (mapped.hash === pending.afterHash) next.revision++;
            await this.replace(root, next, expectedHash);
            if (backupPresent) await rm(backup);
            return next;
        });
    }

    private async locked<T>(root: string, work: () => Promise<T>): Promise<T> {
        const { directory, lock } = await this.paths(root);
        let created = false;
        try { await lstat(directory); } catch (error) { if (missing(error)) created = true; else throw error; }
        await mkdir(directory, { recursive: true });
        await this.paths(root);
        if (created) {
            const parent = await open(root, 'r');
            try { await parent.sync(); } finally { await parent.close(); }
        }
        let handle: import('node:fs/promises').FileHandle | undefined;
        for (let attempt = 0; attempt < 2 && !handle; attempt++) {
            try {
                const acquired = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                try { await acquired.writeFile(`${process.pid}\n`); await acquired.sync(); handle = acquired; }
                catch (error) { await acquired.close(); await rm(lock); throw error; }
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                await this.regular(lock);
                const info = await lstat(lock);
                const reader = await open(lock, constants.O_RDONLY | constants.O_NOFOLLOW);
                let owner: string;
                try { owner = (await reader.readFile({ encoding: 'utf8' })).trim(); }
                finally { await reader.close(); }
                if (!/^[1-9]\d*$/.test(owner)) throw new Error(`Roadmap locked; inspect ${lock}`);
                try { process.kill(Number(owner), 0); throw new Error(`Roadmap locked; inspect ${lock}`); }
                catch (probe) { if ((probe as NodeJS.ErrnoException).code !== 'ESRCH') throw probe; }
                if ((await lstat(lock)).ino !== info.ino) throw new Error('Roadmap lock changed; inspect it');
                await rm(lock);
            }
        }
        if (!handle) throw new Error(`Roadmap locked; inspect ${lock}`);
        try { return await work(); }
        finally {
            const info = await handle.stat();
            await handle.close();
            try { if ((await lstat(lock)).ino !== info.ino) throw new Error('Roadmap lock changed; inspect it'); await rm(lock); }
            catch (error) { if (!missing(error)) throw error; }
        }
    }

    private publish(change: RoadmapChange): void {
        for (const listener of this.listeners) { try { listener(change); } catch { /* A listener cannot roll back a committed index. */ } }
    }

    private async commit(root: string, expectedRevision: number, expectedProjectId: string | undefined,
        transform: (current: RoadmapIndex) => Promise<{ checkpoints: RoadmapCheckpoint[]; changedIds: string[];
            linkedDocument?: RoadmapLinkedDocument }>): Promise<RoadmapIndex> {
        if (!revision(expectedRevision)) throw new Error('Invalid Roadmap revision');
        const result = await this.locked(root, async () => {
            const current = await this.readRetired(root);
            if (current.pendingCreation) throw new Error('Pending greenfield Roadmap creation requires recovery');
            if (current.linkedDocument?.syncState === 'pending-sync') throw new Error('Pending linked Roadmap sync requires recovery');
            if (expectedProjectId && current.projectId !== expectedProjectId) throw new Error('Roadmap identity changed; reattach');
            if (current.revision !== expectedRevision) throw new Error(`Stale Roadmap revision; current ${current.revision}`);
            const { checkpoints, changedIds, linkedDocument: proposedLink } = await transform(current);
            const nextProjectId = current.revision ? current.projectId : randomUUID();
            const nextRevision = current.revision + 1;
            const nextLink = proposedLink ? { ...proposedLink, projectRoot: root, projectId: nextProjectId,
                lastSynced: { ...proposedLink.lastSynced, sourceHash: proposedLink.sourceHash, roadmapRevision: nextRevision } } : current.linkedDocument;
            if (!changedIds.length && JSON.stringify(nextLink) === JSON.stringify(current.linkedDocument))
                return { snapshot: current, changedIds };
            const next = parseRetiredCheckpointIndex({ schemaVersion: 1, projectId: nextProjectId,
                projectRoot: root, revision: nextRevision, checkpoints, ...(nextLink ? { linkedDocument: nextLink } : {}),
                ...(nextProjectId === current.projectId && current.planOrigin ?
                    { planOrigin: current.planOrigin } : {}) }, root);
            if (proposedLink && (await readRoadmapMappedSections(root, nextLink!)).hash !== nextLink!.sourceHash)
                throw new Error('Linked Roadmap source changed before index publication');
            await this.replace(root, next);
            return { snapshot: next, changedIds };
        });
        if (result.snapshot.revision !== expectedRevision) this.publish({ root, projectId: result.snapshot.projectId,
            revision: result.snapshot.revision, changedIds: result.changedIds });
        return result.snapshot;
    }

    /** Accept exactly the preview the developer saw, after re-reading every source under the lock. */
    async acceptImport(root: string, expectedRevision: number, preview: RoadmapImportPreview,
        expectedProjectId?: string): Promise<RoadmapIndex> {
        return this.commit(root, expectedRevision, expectedProjectId, async current => {
            const fresh = await previewRoadmapImport(root, preview.roadmapPath);
            if (JSON.stringify(preview) !== JSON.stringify(fresh)) throw new Error('Stale Roadmap import preview');
            if (current.linkedDocument && current.linkedDocument.path !== fresh.roadmapPath)
                throw new Error('Roadmap linked document differs; explicit relink is required');
            const selected = fresh.sources.find(source => source.path === fresh.roadmapPath);
            if (!selected) throw new Error('Selected Roadmap source missing');
            const checkpoints = [...current.checkpoints];
            const changedIds: string[] = [];
            const sections: RoadmapLinkedDocument['sections'] = [];
            const duplicate = new Set<string>();
            for (const item of preview.checkpoints) {
                if (duplicate.has(item.id)) continue;
                if (preview.checkpoints.filter(other => other.id === item.id).length > 1) { duplicate.add(item.id); continue; }
                const existing = checkpoints.find(checkpoint => checkpoint.id === item.id);
                if (existing && !existing.source) continue; // A later import cannot overwrite a roadmap-owned checkpoint.
                // Unsupported checklist entries stay visible with stable IDs, but have no
                // lossless mapped section for document sync or approved source patches.
                if (item.source.path === fresh.roadmapPath && !item.readOnly)
                    sections.push({ sectionKey: item.sectionKey, checkpointId: item.id });
                const imported: RoadmapCheckpoint = { id: item.id, kind: item.kind, title: item.title,
                    objective: existing?.objective ?? '',
                    order: existing?.order ?? checkpoints.length, dependencies: existing?.dependencies ?? [],
                    ...(item.kind === 'correction' && existing?.parentPhaseId ? { parentPhaseId: existing.parentPhaseId } : {}),
                    links: existing?.links ?? [], status: item.status, readOnly: item.readOnly, source: item.source, evidence: item.evidence };
                if (existing) {
                    if (JSON.stringify(existing) === JSON.stringify(imported)) continue;
                    checkpoints[checkpoints.indexOf(existing)] = imported;
                } else checkpoints.push(imported);
                changedIds.push(item.id);
            }
            if (!sections.length) return { checkpoints, changedIds };
            const linkedDocument: RoadmapLinkedDocument = { projectRoot: root, projectId: current.projectId,
                path: fresh.roadmapPath, sourceHash: selected.sha256, sections,
                lastSynced: { sourceHash: selected.sha256, roadmapRevision: current.revision + 1 }, syncState: 'synced' };
            const mapped = await readRoadmapMappedSections(root, linkedDocument);
            if (mapped.hash !== selected.sha256) throw new Error('Linked Roadmap changed during acceptance; preview again');
            if (mapped.diagnostics.length || mapped.sections.length !== sections.length) linkedDocument.syncState = 'conflict';
            else {
                linkedDocument.lastSynced.fields = mapped.sections.map(({ line, heading, ...field }) => field);
                for (const section of mapped.sections) {
                    const target = checkpoints.find(checkpoint => checkpoint.id === section.checkpointId);
                    if (target && !target.readOnly) {
                        if (section.objective !== undefined) target.objective = section.objective;
                        if (section.order !== undefined) target.order = section.order;
                    }
                }
            }
            if (!changedIds.length && current.linkedDocument?.path === linkedDocument.path &&
                current.linkedDocument.sourceHash === linkedDocument.sourceHash &&
                current.linkedDocument.syncState === 'synced' &&
                JSON.stringify(current.linkedDocument.sections) === JSON.stringify(sections))
                return { checkpoints, changedIds };
            return { checkpoints, changedIds, linkedDocument };
        });
    }

    private async creationFile(root: string, path: string): Promise<string> {
        await this.paths(root);
        if (!path || path.length > 512 || isAbsolute(path) || !/\.md$/i.test(path) ||
            path.includes('\\') || path.includes(':') ||
            path.split('/').some(part => !part || part === '.' || part === '..') || path.split('/')[0] === '.dope')
            throw new Error('Unsafe greenfield Roadmap path');
        let directory = root;
        for (const part of path.split('/').slice(0, -1)) {
            directory = join(directory, part);
            const info = await lstat(directory);
            if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory)
                throw new Error('Unsafe greenfield Roadmap directory');
        }
        return join(root, path);
    }

    /** Approval is checked by the caller; persist intent before the first source-file effect. */
    async acceptGreenfield(root: string, expectedRevision: number, path: string, content: string,
        topology?: GreenfieldTopology, planOrigin?: PendingPlanOrigin): Promise<RoadmapIndex> {
        if (expectedRevision !== 0 || !text(content, 2 * 1024 * 1024) ||
            Buffer.byteLength(content) > 2 * 1024 * 1024 || !content.startsWith('# Roadmap\n') ||
            (topology !== undefined && !validGreenfieldTopology(topology)) ||
            (planOrigin !== undefined && !validPlanOrigin(planOrigin, true)))
            throw new Error('Invalid greenfield Roadmap creation');
        const result = await this.locked(root, async () => {
            const current = await this.readRetired(root);
            if (current.revision !== expectedRevision || current.linkedDocument || current.pendingCreation)
                throw new Error('Stale Roadmap revision or pending creation');
            const file = await this.creationFile(root, path);
            try { await lstat(file); throw new Error('Greenfield Roadmap path already exists'); }
            catch (error) { if (!missing(error)) throw error; }
            const marker = parseRetiredCheckpointIndex({ schemaVersion: 1, projectId: randomUUID(), projectRoot: root,
                revision: 1, checkpoints: [], pendingCreation: { path, content,
                    sourceHash: createHash('sha256').update(content).digest('hex'),
                    ...(topology?.length ? { topology } : {}), ...(planOrigin ? { planOrigin } : {}) } }, root);
            await this.replace(root, marker);
            return marker;
        });
        this.publish({ root, projectId: result.projectId, revision: result.revision, changedIds: [] });
        return this.recoverGreenfield(root);
    }

    /** Idempotent after a crash: only the exact reserved bytes may be accepted. */
    async recoverGreenfield(root: string): Promise<RoadmapIndex> {
        const result = await this.locked(root, async () => {
            const current = await this.readRetired(root);
            const pending = current.pendingCreation;
            if (!pending) return { snapshot: current, changedIds: [] as string[] };
            const file = await this.creationFile(root, pending.path);
            let exists = false;
            try {
                const info = await lstat(file);
                if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe greenfield Roadmap file');
                exists = true;
            } catch (error) { if (!missing(error)) throw error; }
            if (!exists) {
                const temporary = join(dirname(file), `.dope-roadmap-${randomUUID()}.tmp`);
                try {
                    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                    try { await handle.writeFile(pending.content); await handle.sync(); } finally { await handle.close(); }
                    await hardLink(temporary, file); // Exclusive publication: an existing path is never replaced.
                    const parent = await open(dirname(file), 'r');
                    try { await parent.sync(); } finally { await parent.close(); }
                } finally { await rm(temporary, { force: true }); }
            }
            const preview = await previewRoadmapImport(root, pending.path);
            const source = preview.sources.find(item => item.path === pending.path);
            if (source?.sha256 !== pending.sourceHash || !preview.checkpoints.length ||
                preview.checkpoints.some(item => item.source.path === pending.path && item.readOnly))
                throw new Error('Greenfield Roadmap source changed or cannot be mapped; pending creation requires review');
            const checkpoints: RoadmapCheckpoint[] = preview.checkpoints.filter(item => item.source.path === pending.path)
                .map((item, order) => ({ id: item.id, kind: item.kind, title: item.title, objective: '', order,
                    dependencies: [], links: [], status: item.status, readOnly: false,
                    source: item.source, evidence: item.evidence }));
            if (pending.topology?.length) {
                const byKey = new Map(preview.checkpoints.filter(item => item.source.path === pending.path)
                    .map(item => [item.sectionKey, item.id]));
                for (const item of pending.topology) {
                    const target = checkpoints.find(checkpoint => checkpoint.id === byKey.get(item.sectionKey));
                    if (!target || item.dependencies.some(key => !byKey.has(key)) ||
                        (item.parentPhaseKey !== undefined && (target.kind !== 'correction' ||
                            checkpoints.find(checkpoint => checkpoint.id === byKey.get(item.parentPhaseKey!))?.kind !== 'phase')))
                        throw new Error('Greenfield graph mapping changed; pending creation requires review');
                    target.dependencies = item.dependencies.map(key => byKey.get(key)!);
                    if (item.parentPhaseKey) target.parentPhaseId = byKey.get(item.parentPhaseKey)!;
                }
            }
            const sections = checkpoints.map(item => ({ sectionKey: preview.checkpoints.find(entry => entry.id === item.id)!.sectionKey,
                checkpointId: item.id }));
            const linked: RoadmapLinkedDocument = { projectRoot: root, projectId: current.projectId, path: pending.path,
                sourceHash: pending.sourceHash, sections, lastSynced: { sourceHash: pending.sourceHash, roadmapRevision: 2 },
                syncState: 'synced' };
            const mapped = await readRoadmapMappedSections(root, linked);
            if (mapped.hash !== pending.sourceHash || mapped.diagnostics.length || mapped.sections.length !== sections.length)
                throw new Error('Greenfield Roadmap mapping changed; pending creation requires review');
            linked.lastSynced.fields = mapped.sections.map(({ line, heading, ...field }) => field);
            for (const section of mapped.sections) {
                const target = checkpoints.find(item => item.id === section.checkpointId)!;
                target.objective = section.objective ?? '';
                target.order = section.order ?? target.order;
            }
            const planOrigin = pending.planOrigin && { planRevision: pending.planOrigin.planRevision,
                planHash: pending.planOrigin.planHash, sourceHash: pending.sourceHash,
                constraints: pending.planOrigin.constraints,
                steps: pending.planOrigin.steps.map(step => {
                    const checkpointId = sections.find(section => section.sectionKey === step.sectionKey)?.checkpointId;
                    if (!checkpointId) throw new Error('Reviewed plan step lost its Roadmap source mapping');
                    return { stepId: step.stepId, checkpointId, expectedOutputs: step.expectedOutputs };
                }) };
            const next = parseRetiredCheckpointIndex({ schemaVersion: 1, projectId: current.projectId, projectRoot: root,
                revision: 2, checkpoints, linkedDocument: linked, ...(planOrigin ? { planOrigin } : {}) }, root);
            await this.replace(root, next);
            return { snapshot: next, changedIds: checkpoints.map(item => item.id) };
        });
        if (result.changedIds.length) this.publish({ root, projectId: result.snapshot.projectId,
            revision: result.snapshot.revision, changedIds: result.changedIds });
        return result.snapshot;
    }

    async previewDocumentSync(root: string): Promise<RoadmapSyncPreview> {
        await this.recoverGreenfield(root);
        await this.recoverDocumentSync(root);
        return previewRoadmapDocumentSync(root, await this.readRetired(root));
    }

    async previewPendingRecovery(root: string): Promise<RoadmapPendingRecoveryPreview> {
        await this.recoverDocumentSync(root);
        return previewRoadmapPendingRecovery(root, await this.readRetired(root));
    }

    /** Explicitly accept checked source bytes after reviewing an interrupted write. */
    async applyPendingRecovery(root: string, expected: RoadmapPendingRecoveryPreview,
        approved: boolean): Promise<RoadmapIndex> {
        if (!approved) return this.readRetired(root);
        if (expected.state !== 'ready' || !expected.sourceHash)
            throw new Error('Pending Roadmap recovery requires a safe approved preview');
        const result = await this.locked(root, async () => {
            const current = await this.readRetired(root);
            if (current.revision !== expected.revision || current.projectId !== expected.projectId)
                throw new Error('Stale pending Roadmap recovery revision or project identity');
            const fresh = await previewRoadmapPendingRecovery(root, current);
            if (fresh.state !== 'ready' || JSON.stringify(fresh) !== JSON.stringify(expected))
                throw new Error('Stale pending Roadmap recovery preview');
            const linked = current.linkedDocument!;
            const mapped = await readRoadmapMappedSections(root, linked);
            if (mapped.hash !== expected.sourceHash || mapped.diagnostics.length)
                throw new Error('Stale pending Roadmap source');
            const byId = new Map(mapped.sections.map(section => [section.checkpointId, section]));
            const checkpoints = current.checkpoints.map(item => {
                if (item.source?.path !== linked.path) return item;
                const section = byId.get(item.id)!;
                return { ...item, title: section.title, objective: section.objective ?? '',
                    order: section.order ?? item.order,
                    source: { ...item.source, sha256: mapped.hash, line: section.line, text: section.heading } };
            });
            const nextRevision = current.revision + 1;
            const { pending: _pending, ...settled } = linked;
            const next = parseRetiredCheckpointIndex({ ...current, revision: nextRevision, checkpoints,
                linkedDocument: { ...settled, sourceHash: mapped.hash, syncState: 'synced',
                    lastSynced: { sourceHash: mapped.hash, roadmapRevision: nextRevision,
                        fields: mapped.sections.map(({ line, heading, ...field }) => field) } } }, root);
            if ((await readRoadmapMappedSections(root, linked)).hash !== mapped.hash)
                throw new Error('Stale pending Roadmap source');
            const backup = join(root, `${linked.path}.dope-pending-backup`);
            let backupPresent = false;
            try {
                const info = await lstat(backup);
                if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024)
                    throw new Error('Unsafe pending Roadmap backup');
                const handle = await open(backup, constants.O_RDONLY | constants.O_NOFOLLOW);
                try {
                    const backupHash = createHash('sha256').update(await handle.readFile()).digest('hex');
                    if (![linked.pending!.beforeHash, mapped.hash].includes(backupHash))
                        throw new Error('Unresolved pending Roadmap backup');
                } finally { await handle.close(); }
                backupPresent = true;
            } catch (error) { if (!missing(error)) throw error; }
            await this.replace(root, next);
            if (backupPresent) await rm(backup);
            return { snapshot: next, changedIds: checkpoints.filter((item, at) =>
                JSON.stringify(item) !== JSON.stringify(current.checkpoints[at])).map(item => item.id) };
        });
        if (result.changedIds.length) this.publish({ root, projectId: result.snapshot.projectId,
            revision: result.snapshot.revision, changedIds: result.changedIds });
        return result.snapshot;
    }

    /** Inspect a different Markdown owner without initializing, recovering or writing Roadmap state. */
    async previewReplacement(root: string, path: string): Promise<RoadmapReplacementPreview> {
        const current = await this.readRetired(root);
        const linked = current.linkedDocument;
        if (!linked || linked.projectRoot !== root || linked.projectId !== current.projectId)
            throw new Error('Roadmap has no linked document for this project');
        if (typeof path !== 'string' || path.length > 512 || path.split('/')[0] === '.dope' || path === linked.path)
            throw new Error('Choose a different safe project Markdown path');
        // Import and document readers independently check containment, every component for
        // symlinks, source bounds and candidate bytes. Neither initializes an owner.
        const candidate = await previewRoadmapImport(root, path);
        const selected = candidate.sources.find(source => source.path === path);
        if (!selected) throw new Error('Selected Roadmap source missing');
        const diagnostics: RoadmapReplacementPreview['diagnostics'] = [];
        const report = (sourcePath: string, message: string, line?: number, checkpointId?: string,
            severity: 'blocking' | 'warning' = 'blocking'): void => {
            diagnostics.push({ path: sourcePath, ...(line === undefined ? {} : { line }),
                ...(checkpointId === undefined ? {} : { checkpointId }), message, severity });
        };
        if (current.pendingCreation) report(linked.path, 'Pending Roadmap creation requires recovery.');
        if (linked.pending || linked.syncState === 'pending-sync')
            report(linked.path, 'Pending linked Roadmap sync requires recovery.');
        if (linked.syncState !== 'synced') report(linked.path, `Linked Roadmap is ${linked.syncState}; reconcile it first.`);
        if (linked.lastSynced.sourceHash !== linked.sourceHash)
            report(linked.path, 'Accepted source basis differs from the active link.');
        if (linked.lastSynced.roadmapRevision !== current.revision)
            report(linked.path, 'Roadmap changed after the last linked sync; preserve or reconcile local state first.');
        let observedPreviousHash: string | undefined;
        try {
            const source = await checkedRoadmapDocumentFile(root, linked.path);
            observedPreviousHash = createHash('sha256').update(source.bytes).digest('hex');
            if (observedPreviousHash !== linked.sourceHash)
                report(linked.path, 'Linked Markdown changed since acceptance; reconcile it first.');
        } catch (error) {
            if (missing(error) || /Unsafe linked Roadmap|Unsupported linked Roadmap/.test(String(error)))
                report(linked.path, 'Linked Markdown is missing or unsafe; review before replacement.');
            else throw error;
        }
        for (const section of linked.sections) {
            const accepted = linked.lastSynced.fields?.find(field => field.checkpointId === section.checkpointId);
            const checkpoint = current.checkpoints.find(item => item.id === section.checkpointId);
            if (!accepted || !checkpoint || checkpoint.source?.path !== linked.path ||
                checkpoint.source.sha256 !== linked.sourceHash ||
                checkpoint.title !== accepted.title || checkpoint.objective !== (accepted.objective ?? '') ||
                checkpoint.order !== (accepted.order ?? checkpoint.order))
                report(linked.path, 'Active Roadmap has unsynced or unsupported mapped state; preserve or reconcile it first.',
                    checkpoint?.source?.line, section.checkpointId);
        }
        for (const message of candidate.diagnostics) {
            const line = /\bat line (\d+)/.exec(message);
            const referencedPath = /^(?:Missing source(?: directory)?|Unsafe source skipped): (.+)$/.exec(message)?.[1];
            report(referencedPath ?? path, message, line ? Number(line[1]) : undefined, undefined,
                /^(Missing source|Unsafe source skipped)/.test(message) ? 'warning' : 'blocking');
        }
        for (const checkpoint of candidate.checkpoints)
            for (const message of checkpoint.diagnostics)
                report(checkpoint.source.path, message, checkpoint.source.line, checkpoint.id,
                    checkpoint.sectionKey.includes('/checklist-') ? 'warning' : 'blocking');
        const supported = candidate.checkpoints.filter(item => item.source.path === path && !item.readOnly);
        const sections = supported.map(item => ({ sectionKey: item.sectionKey, checkpointId: item.id, line: item.source.line }));
        if (!sections.length) report(path, 'Candidate has no supported, source-mapped Roadmap checkpoints.');
        if (sections.length) {
            const mapped = await readRoadmapMappedSections(root, { ...linked, path, sourceHash: selected.sha256,
                sections: sections.map(({ sectionKey, checkpointId }) => ({ sectionKey, checkpointId })) });
            if (mapped.hash !== selected.sha256) report(path, 'Candidate changed during preview; retry.');
            for (const message of mapped.diagnostics) report(path, message);
            if (mapped.sections.length !== sections.length)
                report(path, 'Candidate checkpoint mapping is incomplete.');
        }
        const oldIds = current.checkpoints.map(item => item.id);
        const newIds = [...new Set(candidate.checkpoints.map(item => item.id))];
        const oldSet = new Set(oldIds);
        const newSet = new Set(newIds);
        const removedCheckpointIds = oldIds.filter(id => !newSet.has(id));
        const atRiskCheckpointIds = removedCheckpointIds;
        const atRiskCheckpoints = current.checkpoints.filter(item => !newSet.has(item.id)).map(item => ({
            id: item.id, title: item.title, status: item.status,
            dependencies: item.dependencies.length, links: item.links.length }));
        return { state: diagnostics.some(item => item.severity === 'blocking') ? 'review' : 'ready',
            projectId: current.projectId, revision: current.revision,
            previousPath: linked.path, previousHash: linked.sourceHash, ...(observedPreviousHash ? { observedPreviousHash } : {}),
            path, sourceHash: selected.sha256, removedCheckpointIds,
            addedCheckpointIds: newIds.filter(id => !oldSet.has(id)),
            retainedCheckpointIds: oldIds.filter(id => newSet.has(id)),
            manualCheckpointIds: current.checkpoints.filter(item => !item.source).map(item => item.id),
            atRiskCheckpointIds, atRiskCheckpoints,
            replacementWarning: 'Replacing the active project Roadmap may remove checkpoint state and links. The previous Markdown file remains on disk.',
            sections, diagnostics };
    }

    /** Replace the active Roadmap only after the exact approved source and owner basis still match. */
    async applyReplacement(root: string, expected: RoadmapReplacementPreview, approved: boolean): Promise<RoadmapIndex> {
        if (!approved) return this.readRetired(root);
        if (!expected || expected.state !== 'ready' || !expected.observedPreviousHash)
            throw new Error('Replacement requires a safe approved preview');
        return this.commit(root, expected.revision, expected.projectId, async current => {
            const fresh = await this.previewReplacement(root, expected.path);
            if (fresh.state !== 'ready' || JSON.stringify(fresh) !== JSON.stringify(expected))
                throw new Error('Stale Roadmap replacement preview');
            const candidate = await previewRoadmapImport(root, fresh.path);
            const selected = candidate.sources.find(source => source.path === fresh.path);
            const supported = candidate.checkpoints.filter(item => item.source.path === fresh.path && !item.readOnly);
            const sectionIdentity = supported.map(item => ({ sectionKey: item.sectionKey,
                checkpointId: item.id, line: item.source.line }));
            if (!selected || selected.sha256 !== fresh.sourceHash ||
                JSON.stringify(sectionIdentity) !== JSON.stringify(fresh.sections) ||
                new Set(candidate.checkpoints.map(item => item.id)).size !== candidate.checkpoints.length)
                throw new Error('Roadmap replacement candidate changed; preview again');
            const linkedDocument: RoadmapLinkedDocument = { projectRoot: root, projectId: current.projectId,
                path: fresh.path, sourceHash: selected.sha256,
                sections: supported.map(item => ({ sectionKey: item.sectionKey, checkpointId: item.id })),
                lastSynced: { sourceHash: selected.sha256, roadmapRevision: current.revision + 1 }, syncState: 'synced' };
            const mapped = await readRoadmapMappedSections(root, linkedDocument);
            if (mapped.hash !== selected.sha256 || mapped.diagnostics.length ||
                mapped.sections.length !== linkedDocument.sections.length)
                throw new Error('Roadmap replacement mapping changed; preview again');
            linkedDocument.lastSynced.fields = mapped.sections.map(({ line, heading, ...field }) => field);
            const byId = new Map(mapped.sections.map(item => [item.checkpointId, item]));
            const checkpoints: RoadmapCheckpoint[] = candidate.checkpoints.map((item, order) => {
                const fields = byId.get(item.id);
                return { id: item.id, kind: item.kind, title: item.title,
                    objective: fields?.objective ?? '', order: fields?.order ?? order,
                    dependencies: [], links: [], status: item.status, readOnly: item.readOnly,
                    source: item.source, evidence: item.evidence };
            });
            const previous = await checkedRoadmapDocumentFile(root, fresh.previousPath);
            if (createHash('sha256').update(previous.bytes).digest('hex') !== fresh.previousHash)
                throw new Error('Previous linked Roadmap changed; preview again');
            return { checkpoints, changedIds: [...new Set([...current.checkpoints.map(item => item.id),
                ...checkpoints.map(item => item.id)])], linkedDocument };
        });
    }

    /** Relink changes only the accepted owner reference. A changed document needs separate reconciliation. */
    async previewRelink(root: string, path: string): Promise<RoadmapRelinkPreview> {
        const current = await this.readRetired(root);
        const linked = current.linkedDocument;
        if (!linked || linked.projectRoot !== root || linked.projectId !== current.projectId)
            throw new Error('Roadmap has no linked document for this project');
        if (linked.syncState === 'pending-sync') throw new Error('Pending linked Roadmap sync requires recovery');
        if (linked.syncState === 'conflict' || linked.syncState === 'source-changed')
            throw new Error('Linked Roadmap conflict requires separate reconciliation before relink');
        const previous = await previewRoadmapDocumentSync(root, current);
        if (previous.state !== 'relink-needed') throw new Error('Linked Roadmap source is still available; reconcile it first');
        if (path === linked.path) throw new Error('Choose a different project Markdown path');
        if (typeof path !== 'string' || path.length > 512 || path.split('/')[0] === '.dope')
            throw new Error('Unsafe linked Roadmap path');
        const base: RoadmapRelinkPreview = { state: 'review', projectId: current.projectId,
            revision: current.revision, previousPath: linked.path, path, sections: [], diagnostics: [] };
        // The checked reader rejects absolute, foreign, traversal and symlink paths before reading bytes.
        const mapped = await readRoadmapMappedSections(root, { ...linked, path });
        base.sourceHash = mapped.hash;
        base.sections = linked.sections.map(section => ({ ...section,
            line: mapped.sections.find(item => item.checkpointId === section.checkpointId)?.line ?? 0 }));
        if (mapped.hash !== linked.sourceHash || mapped.hash !== linked.lastSynced.sourceHash)
            base.diagnostics.push('Candidate contents differ from the accepted source; review and reconcile separately.');
        base.diagnostics.push(...mapped.diagnostics);
        if (mapped.sections.length !== linked.sections.length || base.sections.some(section => !section.line))
            base.diagnostics.push('Mapped section identities are missing or ambiguous.');
        if (!linked.lastSynced.fields || mapped.sections.some(section => {
            const accepted = linked.lastSynced.fields!.find(field => field.checkpointId === section.checkpointId);
            const { line: _line, heading: _heading, ...fields } = section;
            return !accepted || JSON.stringify(fields) !== JSON.stringify(accepted);
        })) base.diagnostics.push('Mapped fields differ from the accepted basis.');
        if (!base.diagnostics.length) base.state = 'ready';
        return base;
    }

    async applyRelink(root: string, expected: RoadmapRelinkPreview, approved: boolean): Promise<RoadmapIndex> {
        if (!approved) return this.readRetired(root);
        if (expected.state !== 'ready' || !expected.sourceHash) throw new Error('Relink requires a safe approved preview');
        return this.commit(root, expected.revision, expected.projectId, async current => {
            const fresh = await this.previewRelink(root, expected.path);
            if (fresh.state !== 'ready' || JSON.stringify(fresh) !== JSON.stringify(expected))
                throw new Error('Stale linked Roadmap relink preview');
            const linked = current.linkedDocument!;
            const lines = new Map(fresh.sections.map(section => [section.checkpointId, section.line]));
            const checkpoints = current.checkpoints.map(item => item.source?.path === linked.path && lines.has(item.id) ?
                { ...item, source: { ...item.source, path: fresh.path, line: lines.get(item.id)!, sha256: fresh.sourceHash! } } : item);
            return { checkpoints, changedIds: checkpoints.filter((item, at) => item !== current.checkpoints[at]).map(item => item.id),
                linkedDocument: { ...linked, path: fresh.path, sourceHash: fresh.sourceHash!, syncState: 'synced' } };
        });
    }

    /** Finish an approved edit after restart. Unknown source bytes are never overwritten. */
    async recoverDocumentSync(root: string): Promise<RoadmapIndex> {
        const result = await this.locked(root, async () => {
            let current = await this.readRetired(root);
            const linked = current.linkedDocument;
            const pending = linked?.pending;
            if (!linked || !pending) return { snapshot: current, changedIds: [] as string[] };
            const conflict = async (): Promise<RoadmapIndex> => {
                if (pending.outcome === 'conflict') return current;
                const next = parseRetiredCheckpointIndex({ ...current, revision: current.revision + 1,
                    linkedDocument: { ...linked, pending: { ...pending, outcome: 'conflict' as const } } }, root);
                await this.replace(root, next);
                return next;
            };
            const backup = join(root, `${linked.path}.dope-pending-backup`);
            let backupPresent = false;
            try {
                const info = await lstat(backup);
                if (!info.isFile() || info.isSymbolicLink()) return { snapshot: await conflict(), changedIds: [] as string[] };
                if (info.size === 0) {
                    try { await lstat(join(root, linked.path)); await rm(backup); }
                    catch (error) { if (!missing(error)) throw error;
                        return { snapshot: await conflict(), changedIds: [] as string[] }; }
                } else backupPresent = true;
            } catch (error) { if (!missing(error)) throw error; }
            if (backupPresent) {
                const handle = await open(backup, constants.O_RDONLY | constants.O_NOFOLLOW);
                let backupHash: string;
                try {
                    const info = await handle.stat();
                    if (!info.isFile() || info.size > 2 * 1024 * 1024) return { snapshot: await conflict(), changedIds: [] as string[] };
                    backupHash = createHash('sha256').update(await handle.readFile()).digest('hex');
                } finally { await handle.close(); }
                if (backupHash !== pending.beforeHash) return { snapshot: await conflict(), changedIds: [] as string[] };
                try { await lstat(join(root, linked.path)); }
                catch (error) {
                    if (!missing(error)) throw error;
                    await hardLink(backup, join(root, linked.path)).catch(linkError => {
                        if ((linkError as NodeJS.ErrnoException).code !== 'EEXIST') throw linkError;
                    });
                }
            }
            let mapped: Awaited<ReturnType<typeof readRoadmapMappedSections>>;
            try { mapped = await readRoadmapMappedSections(root, linked); }
            catch { return { snapshot: await conflict(), changedIds: [] as string[] }; }
            if (mapped.diagnostics.length || mapped.sections.length !== linked.sections.length ||
                ![pending.beforeHash, pending.afterHash].includes(mapped.hash))
                return { snapshot: await conflict(), changedIds: [] as string[] };
            if (mapped.hash === pending.beforeHash) {
                if (pending.outcome === 'conflict') return { snapshot: current, changedIds: [] as string[] };
                if (backupPresent) { await rm(backup); backupPresent = false; }
                const patch = await planRoadmapDocumentPatch(root, { ...current,
                    linkedDocument: { ...linked, syncState: 'synced', pending: undefined } }, {
                    checkpointId: pending.checkpointId, sourceHash: pending.beforeHash,
                    ...(current.checkpoints.find(item => item.id === pending.checkpointId)?.title !== pending.title ? { title: pending.title } : {}),
                    ...(current.checkpoints.find(item => item.id === pending.checkpointId)?.objective !== pending.objective ? { objective: pending.objective } : {}),
                    ...(current.checkpoints.find(item => item.id === pending.checkpointId)?.order !== pending.order ? { order: pending.order } : {}),
                    ...(pending.prose !== undefined ? { prose: pending.prose } : {})
                }).catch(() => undefined);
                if (!patch || patch.afterHash !== pending.afterHash)
                    return { snapshot: await conflict(), changedIds: [] as string[] };
                try { await publishRoadmapDocumentPatch(root, patch); }
                catch { return { snapshot: await conflict(), changedIds: [] as string[] }; }
                mapped = await readRoadmapMappedSections(root, linked);
                if (mapped.hash !== pending.afterHash || mapped.diagnostics.length)
                    return { snapshot: await conflict(), changedIds: [] as string[] };
            }
            const target = mapped.sections.find(section => section.checkpointId === pending.checkpointId);
            const priorOrder = current.checkpoints.find(item => item.id === pending.checkpointId)?.order;
            if (!target || target.title !== pending.title || target.objective !== pending.objective ||
                (target.order ?? priorOrder) !== pending.order || pending.prose !== undefined && target.prose !== pending.prose)
                return { snapshot: await conflict(), changedIds: [] as string[] };
            const byId = new Map(mapped.sections.map(section => [section.checkpointId, section]));
            const checkpoints = current.checkpoints.map(item => {
                if (item.source?.path !== linked.path) return item;
                const section = byId.get(item.id);
                if (!section) return item;
                return { ...item, title: item.id === pending.checkpointId ? pending.title : item.title,
                    objective: item.id === pending.checkpointId ? pending.objective : item.objective,
                    order: item.id === pending.checkpointId ? pending.order : item.order,
                    source: { ...item.source, sha256: pending.afterHash, line: section.line, text: section.heading } };
            });
            const nextRevision = current.revision + 1;
            const { pending: _resolved, ...settledLink } = linked;
            const next = parseRetiredCheckpointIndex({ ...current, revision: nextRevision, checkpoints,
                linkedDocument: { ...settledLink, sourceHash: pending.afterHash, syncState: 'synced',
                    lastSynced: { sourceHash: pending.afterHash, roadmapRevision: nextRevision,
                        fields: mapped.sections.map(({ line, heading, ...field }) => field) } } }, root);
            await this.replace(root, next);
            if (backupPresent) await rm(backup);
            return { snapshot: next, changedIds: checkpoints.filter((item, i) =>
                JSON.stringify(item) !== JSON.stringify(current.checkpoints[i])).map(item => item.id) };
        });
        if (result.changedIds.length) this.publish({ root, projectId: result.snapshot.projectId,
            revision: result.snapshot.revision, changedIds: result.changedIds });
        return result.snapshot;
    }

    /** Explicit reconciliation; the preview is re-created under the owner lock before any index write. */
    async applyDocumentSync(root: string, expected: RoadmapSyncPreview): Promise<RoadmapIndex> {
        if (expected.state !== 'source-changed' || !expected.sourceHash) throw new Error('No applicable linked Roadmap change');
        return this.commit(root, expected.revision, expected.projectId, async current => {
            const fresh = await previewRoadmapDocumentSync(root, current);
            if (fresh.state !== 'source-changed' || JSON.stringify(fresh) !== JSON.stringify(expected))
                throw new Error('Stale linked Roadmap sync preview');
            const linked = current.linkedDocument!;
            const mapped = await readRoadmapMappedSections(root, linked);
            if (mapped.hash !== expected.sourceHash || mapped.diagnostics.length) throw new Error('Stale linked Roadmap source');
            const checkpoints = current.checkpoints.map(item => ({ ...item, source: item.source ? { ...item.source } : undefined }));
            const byId = new Map(mapped.sections.map(section => [section.checkpointId, section]));
            const changedIds: string[] = [];
            for (const checkpoint of checkpoints) {
                const section = byId.get(checkpoint.id);
                if (!section) continue;
                for (const change of fresh.changes.filter(change => change.checkpointId === checkpoint.id)) {
                    if (change.field === 'prose') continue;
                    if (change.field === 'title' && typeof change.source === 'string') checkpoint.title = change.source;
                    if (change.field === 'objective' && typeof change.source === 'string') checkpoint.objective = change.source;
                    if (change.field === 'order' && typeof change.source === 'number') checkpoint.order = change.source;
                }
                if (checkpoint.source) {
                    checkpoint.source.sha256 = mapped.hash;
                    checkpoint.source.line = section.line;
                    checkpoint.source.text = section.heading;
                }
                if (JSON.stringify(checkpoint) !== JSON.stringify(current.checkpoints.find(item => item.id === checkpoint.id)))
                    changedIds.push(checkpoint.id);
            }
            return { checkpoints, changedIds, linkedDocument: { ...linked, sourceHash: mapped.hash, syncState: 'synced',
                lastSynced: { sourceHash: mapped.hash, roadmapRevision: current.revision + 1,
                    fields: mapped.sections.map(({ line, heading, ...field }) => field) } } };
        });
    }

    /** Low-level roadmap-owned field storage; P3 owns user/model authorization and cross-owner validation. */
    async mutate(root: string, expectedRevision: number, operation: RoadmapMutation,
        expectedProjectId?: string): Promise<RoadmapIndex> {
        return this.commit(root, expectedRevision, expectedProjectId, async current => {
            if (!operation || !id(operation.id) || !['create', 'update'].includes(operation.type)) throw new Error('Invalid Roadmap mutation');
            const checkpoints = [...current.checkpoints];
            const index = checkpoints.findIndex(item => item.id === operation.id);
            if (operation.type === 'create') {
                if (index >= 0) throw new Error('Roadmap checkpoint already exists');
                checkpoints.push({ id: operation.id, kind: operation.kind, title: operation.title,
                    objective: operation.objective, order: operation.order, dependencies: operation.dependencies ?? [],
                    links: operation.links ?? [], status: 'unknown', readOnly: false, evidence: [] });
            } else {
                if (index < 0) throw new Error('Unknown Roadmap checkpoint');
                if (checkpoints[index].readOnly) throw new Error('Source-backed Roadmap checkpoint is read-only');
                if (checkpoints[index].source) {
                    if (operation.title !== checkpoints[index].title) throw new Error('Markdown owns the source checkpoint title');
                    if (operation.objective !== checkpoints[index].objective || operation.order !== checkpoints[index].order)
                        throw new Error('Markdown owns mapped Roadmap prose and order');
                    const fresh = await previewRoadmapImport(root, current.linkedDocument?.path);
                    const source = fresh.checkpoints.find(item => item.id === operation.id);
                    if (!source || source.readOnly || source.source.sha256 !== checkpoints[index].source.sha256 ||
                        source.title !== checkpoints[index].title || source.status !== checkpoints[index].status)
                        throw new Error('Stale Roadmap source; preview and accept import again');
                }
                checkpoints[index] = { ...checkpoints[index], title: operation.title, objective: operation.objective,
                    order: operation.order, dependencies: operation.dependencies, links: operation.links };
                if (JSON.stringify(checkpoints[index]) === JSON.stringify(current.checkpoints[index])) return { checkpoints, changedIds: [] };
            }
            return { checkpoints, changedIds: [operation.id] };
        });
    }

    /** One revisioned Roadmap-owner transaction for validated planning actions. */
    async transact(root: string, expectedRevision: number, expectedProjectId: string,
        transform: (current: RoadmapIndex) => Promise<RoadmapCheckpoint[]>): Promise<RoadmapIndex> {
        return this.commit(root, expectedRevision, expectedProjectId, async current => {
            if (!current.revision) throw new Error('Roadmap is not initialized');
            const checkpoints = await transform(current);
            const before = new Map(current.checkpoints.map(item => [item.id, item]));
            const after = new Map(checkpoints.map(item => [item.id, item]));
            if (before.size !== current.checkpoints.length || after.size !== checkpoints.length ||
                [...before.keys()].some(key => !after.has(key))) throw new Error('Roadmap deletion requires separate authority');
            const changedIds = checkpoints.filter(item => JSON.stringify(item) !== JSON.stringify(before.get(item.id))).map(item => item.id);
            const sourceChanges = changedIds.filter(key => before.get(key)?.source);
            if (sourceChanges.length) {
                const fresh = await previewRoadmapImport(root, current.linkedDocument?.path);
                for (const key of sourceChanges) {
                    const old = before.get(key)!;
                    const next = after.get(key)!;
                    const source = fresh.checkpoints.find(item => item.id === key);
                    if (old.readOnly || !source || source.readOnly || source.source.sha256 !== old.source!.sha256 ||
                        source.title !== old.title || source.status !== old.status || next.title !== old.title ||
                        next.objective !== old.objective || next.order !== old.order ||
                        next.status !== old.status || JSON.stringify(next.source) !== JSON.stringify(old.source) ||
                        JSON.stringify(next.evidence) !== JSON.stringify(old.evidence))
                        throw new Error('Stale or immutable Roadmap source');
                }
            }
            return { checkpoints, changedIds };
        });
    }

    /** The document and index have separate atomic writes; persist intent before touching the document. */
    async transactDocument(root: string, expectedRevision: number, expectedProjectId: string,
        transform: (current: RoadmapIndex) => Promise<{ next: RoadmapIndex; patch: RoadmapDocumentPatch }>): Promise<RoadmapIndex> {
        const prepared = await this.locked(root, async () => {
                const current = await this.readRetired(root);
                if (current.projectId !== expectedProjectId || current.revision !== expectedRevision)
                    throw new Error('Stale Roadmap revision or project identity');
                if (current.linkedDocument?.syncState === 'pending-sync')
                    throw new Error('Pending linked Roadmap sync requires recovery');
                const { next, patch } = await transform(current);
                if (!current.linkedDocument || current.linkedDocument.syncState !== 'synced' ||
                    patch.path !== current.linkedDocument.path || patch.beforeHash !== current.linkedDocument.sourceHash ||
                    patch.afterHash === patch.beforeHash || next.checkpoints.length !== current.checkpoints.length)
                    throw new Error('Invalid linked Roadmap transaction');
                const oldTarget = current.checkpoints.find(item => item.id === patch.checkpointId);
                const target = next.checkpoints.find(item => item.id === patch.checkpointId);
                if (!oldTarget?.source || !target || oldTarget.readOnly) throw new Error('Invalid linked Roadmap target');
                const planned = await planRoadmapDocumentPatch(root, current, {
                    checkpointId: patch.checkpointId, sourceHash: patch.beforeHash,
                    ...(target.title !== oldTarget.title ? { title: target.title } : {}),
                    ...(target.objective !== oldTarget.objective ? { objective: target.objective } : {}),
                    ...(target.order !== oldTarget.order ? { order: target.order } : {}),
                    ...(patch.prose !== undefined ? { prose: patch.prose } : {})
                });
                if (planned.after !== patch.after || planned.afterHash !== patch.afterHash)
                    throw new Error('Invalid linked Roadmap document patch');
                for (let index = 0; index < current.checkpoints.length; index++) {
                    const old = current.checkpoints[index];
                    const actual = next.checkpoints[index];
                    const expected: RoadmapCheckpoint = JSON.parse(JSON.stringify(old)) as RoadmapCheckpoint;
                    if (expected.source?.path === patch.path) expected.source.sha256 = patch.afterHash;
                    if (expected.id === patch.checkpointId) {
                        expected.title = target.title;
                        expected.objective = target.objective;
                        expected.order = target.order;
                        if (expected.source && target.title !== oldTarget.title)
                            expected.source.text = patch.after.split(/\r?\n/)[expected.source.line - 1];
                    }
                    if (JSON.stringify(actual) !== JSON.stringify(expected))
                        throw new Error('Invalid linked Roadmap field change');
                }
                const changedIds = next.checkpoints.filter((item, index) => JSON.stringify(item) !== JSON.stringify(current.checkpoints[index])).map(item => item.id);
                if (!changedIds.includes(patch.checkpointId) || changedIds.some(id =>
                    !current.linkedDocument!.sections.some(section => section.checkpointId === id)))
                    throw new Error('Invalid linked Roadmap change set');
                const marker = parseRetiredCheckpointIndex({ ...current, revision: current.revision + 1,
                    linkedDocument: { ...current.linkedDocument, syncState: 'pending-sync',
                        pending: { basisRevision: current.revision, checkpointId: patch.checkpointId,
                            beforeHash: patch.beforeHash, afterHash: patch.afterHash,
                            title: target.title, objective: target.objective, order: target.order,
                            ...(patch.prose !== undefined ? { prose: patch.prose } : {}),
                            outcome: 'prepared' } } }, root);
                await this.replace(root, marker);
                try { await publishRoadmapDocumentPatch(root, patch); }
                catch (error) { throw new Error(`Linked Roadmap pending sync; recover before retrying: ${String(error)}`); }
                const written = parseRetiredCheckpointIndex({ ...marker, revision: marker.revision + 1,
                    linkedDocument: { ...marker.linkedDocument, pending: { ...marker.linkedDocument!.pending!, outcome: 'document-written' } } }, root);
                await this.replace(root, written);
                return { marker, changedIds };
        });
        const recovered = await this.recoverDocumentSync(root);
        if (recovered.linkedDocument?.syncState !== 'synced' ||
            recovered.revision <= prepared.marker.revision)
            throw new Error('Linked Roadmap pending sync; review recovery before retrying');
        return recovered;
    }
}
