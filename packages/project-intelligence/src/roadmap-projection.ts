import type { RoadmapCheckpoint, RoadmapIndex, RoadmapLink } from './node/roadmap-store';
import type { RoadmapOwnerRecord } from './node/roadmap-owner-links';
import type { GateEvidence, RoadmapGateIndex, RoadmapImplementationStatus, RoadmapQualificationStatus,
    RoadmapDraftAcceptance } from './node/roadmap-gate-domain';
import { evaluateGateQualification, evaluatePhaseQualification } from './node/roadmap-gate-domain';
import { correctionIdentifier, resolveCorrectionPhase, roadmapPhaseNumber, type PhaseAssociation } from './roadmap-phase-association';

export interface RoadmapPresentation {
    projectId?: string;
    selectedId?: string;
    viewport?: { x: number; y: number; zoom: number };
    placements?: Record<string, { x: number; y: number }>;
    colors?: Record<string, string>;
}
/** @deprecated P17 removes this compile-only schema-1 canvas shape. */
export interface CheckpointNode {
    id: string;
    kind: RoadmapCheckpoint['kind'] | 'task-stack' | 'prompt';
    title: string;
    order: number;
    status: RoadmapCheckpoint['status'];
    statusLabel: string;
    evidence: RoadmapCheckpoint['evidence'];
    source?: RoadmapCheckpoint['source'];
    readOnly: boolean;
    /** Presentation-only draft truth; never persisted as a canonical Roadmap status. */
    draftState?: 'accepted' | 'proposed';
    lane: 'path' | 'branch';
    phaseAssociation?: PhaseAssociation;
    taskSource?: { stackPath: string; path?: string; fingerprint: string; number?: number; version?: string;
        browserRequired?: boolean; segment?: string; diagnostic?: string };
}
export interface CheckpointEdge {
    id: string;
    from: string;
    to: string;
    kind: 'dependency' | 'branch';
    label: string;
}
export interface PoolNode {
    id: string;
    owner: 'project-mind' | 'issue';
    targetId: string;
    title: string;
    status: string;
    ownerRevision?: number;
    sourceHash?: string;
    readOnly: boolean;
    provenance: string;
}
/** @deprecated P17 removes the old checkpoint canvas contract. */
export interface LegacyRoadmapProjection {
    projectId: string;
    revision: number;
    nodes: CheckpointNode[];
    edges: CheckpointEdge[];
    pools: { ideas: PoolNode[]; issues: PoolNode[] };
    diagnostics: string[];
    selection?: { node: CheckpointNode; neighbors: CheckpointNode[]; links: RoadmapLink[]; omittedNeighbors: number; omittedLinks: number };
}

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const statusLabel: Record<RoadmapCheckpoint['status'], string> = {
    green: 'Green', 'not-green': 'Not Green', 'not-implemented': 'Not implemented',
    waived: 'Waived', active: 'Active', unknown: 'Unknown',
};
const ownerKey = (owner: string, id: string): string => `${owner}\0${id}`;
const nodeOrder = (a: CheckpointNode, b: CheckpointNode): number => a.order - b.order ||
    (a.lane === b.lane ? 0 : a.lane === 'path' ? -1 : 1) || compare(a.id, b.id);

/** Read-only semantic graph. Layout, colors and viewport belong to the caller's presentation state. */
/** @deprecated Compile-only seam for the old canvas/task projection; P17 removes it. Store reads reject schema 1. */
export function projectLegacyRoadmap(index: RoadmapIndex, owners: readonly RoadmapOwnerRecord[] = [],
    presentation: RoadmapPresentation = {}): LegacyRoadmapProjection {
    const nodes: CheckpointNode[] = index.checkpoints.map((item): CheckpointNode => ({
        id: item.id, kind: item.kind, title: item.title, order: item.order, status: item.status,
        statusLabel: item.status === 'waived' && item.evidence.some(citation =>
            citation.status === 'waived' && /owner.closed for sequencing/i.test(citation.statusText ?? ''))
            ? 'Owner-closed for sequencing' : statusLabel[item.status],
        evidence: item.evidence.map(citation => ({ ...citation })),
        source: item.source && { ...item.source }, readOnly: item.readOnly,
        lane: item.kind === 'phase' ? 'path' : 'branch',
    })).sort(nodeOrder);
    const byId = new Map(nodes.map(node => [node.id, node]));
    const edges: CheckpointEdge[] = [];
    const diagnostics: string[] = [];
    const phases = new Map<number, string[]>();
    for (const node of nodes) if (node.kind === 'phase') {
        const number = roadmapPhaseNumber(node.title);
        if (number !== undefined) phases.set(number, [...(phases.get(number) ?? []), node.id]);
    }
    for (const item of index.checkpoints) if (item.kind === 'correction') {
        const explicit = item.parentPhaseId ? [item.parentPhaseId] :
            item.dependencies.filter(id => byId.get(id)?.kind === 'phase' || /#phase-\d+$/.test(id));
        const association = resolveCorrectionPhase(correctionIdentifier(item.id, item.title,
            [item.source?.path ?? '', ...item.evidence.map(citation => citation.path)]), explicit, phases);
        byId.get(item.id)!.phaseAssociation = association;
        if (association.unresolvedReason) diagnostics.push(`Unresolved correction phase: ${item.id}: ${association.unresolvedReason}`);
    }
    for (const item of index.checkpoints) {
        const differing = item.evidence.filter(citation => citation.status && citation.status !== 'unknown' && citation.status !== item.status);
        if (differing.length) diagnostics.push(`Historical status differs for ${item.id}: ${differing.map(citation =>
            `${citation.path}:${citation.line} (${citation.status})`).sort(compare).join(', ')}`);
    }
    const knownOwners = new Map(owners.map(record => [ownerKey(record.owner, record.targetId), record]));
    const linkedOwners = new Set<string>();
    for (const item of index.checkpoints) {
        for (const dependency of item.dependencies) {
            if (!byId.has(dependency)) {
                diagnostics.push(`Missing dependency: ${item.id} -> ${dependency}`);
                continue;
            }
            const kind = item.kind === 'phase' ? 'dependency' : 'branch';
            edges.push({ id: `dependency:${dependency}:${item.id}`, from: dependency, to: item.id,
                kind, label: kind === 'branch' ? `${item.kind} branch` : 'Depends on' });
        }
        for (const link of item.links) {
            if (link.owner !== 'project-mind' && link.owner !== 'issue') continue;
            const key = ownerKey(link.owner, link.targetId);
            linkedOwners.add(key);
            const record = knownOwners.get(key);
            if (!record) diagnostics.push(`Missing ${link.owner} reference: ${item.id} -> ${link.targetId}`);
            else if (record.owner === 'issue' ? link.sourceHash !== record.sourceHash : link.ownerRevision !== record.ownerRevision)
                diagnostics.push(`Changed ${link.owner} reference: ${item.id} -> ${link.targetId}`);
        }
    }
    edges.sort((a, b) => compare(a.from, b.from) || compare(a.to, b.to) || compare(a.id, b.id));
    diagnostics.sort(compare);
    const detached = owners.filter(record => (record.owner === 'issue' || record.artifact.type === 'idea') &&
        !linkedOwners.has(ownerKey(record.owner, record.targetId)));
    const pool = (record: RoadmapOwnerRecord): PoolNode => ({
        id: `${record.owner}:${record.targetId}`, owner: record.owner, targetId: record.targetId,
        title: record.title, status: record.status, readOnly: record.readOnly,
        provenance: record.owner === 'issue' ? 'known-issues.md' : record.artifact.provenance,
        ...(record.owner === 'issue' ? { sourceHash: record.sourceHash } : { ownerRevision: record.ownerRevision }),
    });
    const poolOrder = (a: PoolNode, b: PoolNode): number => compare(a.title, b.title) || compare(a.id, b.id);
    const pools = {
        ideas: detached.filter(record => record.owner === 'project-mind').map(pool).sort(poolOrder),
        issues: detached.filter(record => record.owner === 'issue').map(pool).sort(poolOrder),
    };
    const selected = (presentation.projectId === undefined || presentation.projectId === index.projectId) &&
        presentation.selectedId && byId.get(presentation.selectedId);
    const checkpoint = selected && index.checkpoints.find(item => item.id === selected.id);
    const adjacent = selected ? new Set(edges.filter(edge => edge.from === selected.id || edge.to === selected.id)
        .map(edge => edge.from === selected.id ? edge.to : edge.from)) : new Set<string>();
    const neighbors = nodes.filter(node => adjacent.has(node.id));
    const selection = selected && checkpoint ? {
        node: selected, neighbors: neighbors.slice(0, 16), links: checkpoint.links.slice(0, 16).map(link => ({ ...link })),
        omittedNeighbors: Math.max(0, neighbors.length - 16), omittedLinks: Math.max(0, checkpoint.links.length - 16),
    } : undefined;
    return { projectId: index.projectId, revision: index.revision, nodes, edges, pools, diagnostics, selection };
}

export interface GateRoadmapNode {
    id: string;
    kind: 'phase' | 'gate' | 'correction';
    title: string;
    order: number;
    parentId?: string;
    parentKind?: 'phase' | 'gate';
    implementationStatus: RoadmapImplementationStatus;
    qualificationStatus: RoadmapQualificationStatus | 'planned' | 'unplanned';
    draftAcceptance: RoadmapDraftAcceptance;
    evidenceStatus: 'none' | 'proposed' | 'approved' | 'failed' | 'stale';
    evidence: GateEvidence[];
}
export interface RoadmapProjection {
    projectId: string;
    revision: number;
    nodes: GateRoadmapNode[];
    edges: CheckpointEdge[];
    pools: { ideas: PoolNode[]; issues: PoolNode[]; corrections: GateRoadmapNode[] };
    diagnostics: string[];
    selection?: { node: GateRoadmapNode; neighbors: GateRoadmapNode[] };
}

/** The schema-2 canonical view used by RoadmapService. No task stack creates a Gate. */
export function projectRoadmap(index: RoadmapGateIndex, owners: readonly RoadmapOwnerRecord[] = [],
    presentation: RoadmapPresentation = {}): RoadmapProjection {
    if (index.schemaVersion !== 2) throw new Error('Roadmap projection requires schema 2');
    const diagnostics: string[] = [];
    const phases: GateRoadmapNode[] = [...index.phases].sort((a, b) => a.order - b.order || compare(a.id, b.id)).map(phase => ({
        id: phase.id, kind: 'phase', title: phase.title, order: phase.order,
        implementationStatus: phase.implementationStatus,
        qualificationStatus: evaluatePhaseQualification(index, phase.id, phase.qualificationSource).status,
        draftAcceptance: phase.draftAcceptance, evidenceStatus: 'none', evidence: [],
    }));
    const gates: GateRoadmapNode[] = [...index.gates].sort((a, b) =>
        compare(a.parentPhaseId, b.parentPhaseId) || a.order - b.order || compare(a.id, b.id)).map(gate => {
        const evidence = gate.criteria.flatMap(criterion => criterion.evidence.map(item => ({ ...item })));
        const evaluated = evaluateGateQualification(gate, gate.qualificationSource).status;
        const qualificationStatus = evaluated === 'green' && (gate.qualificationStatus === 'stale' ||
            index.linkedDocument && index.linkedDocument.syncState !== 'synced') ? 'stale' : evaluated;
        return { id: gate.id, kind: 'gate', title: gate.title, order: gate.order,
            parentId: gate.parentPhaseId, parentKind: 'phase', implementationStatus: gate.implementationStatus,
            qualificationStatus, draftAcceptance: gate.draftAcceptance, evidence,
            evidenceStatus: qualificationStatus === 'stale' ? 'stale' : qualificationStatus === 'not-green' ? 'failed' :
                evidence.some(item => item.review.status === 'approved') ? 'approved' : evidence.length ? 'proposed' : 'none' };
    });
    const corrections: GateRoadmapNode[] = [...index.corrections].sort((a, b) =>
        a.order - b.order || compare(a.id, b.id)).map(item => ({
        id: item.id, kind: 'correction', title: item.title, order: item.order,
        parentId: item.parent.id, parentKind: item.parent.kind, implementationStatus: item.implementationStatus,
        qualificationStatus: item.qualificationStatus, draftAcceptance: item.draftAcceptance,
        evidenceStatus: 'none', evidence: [],
    }));
    const nodes = [...phases, ...gates, ...corrections];
    const byId = new Map(nodes.map(node => [node.id, node]));
    const edges: CheckpointEdge[] = [];
    for (const node of [...gates, ...corrections]) {
        if (!node.parentId || byId.get(node.parentId)?.kind !== node.parentKind) {
            diagnostics.push(`Unassigned ${node.kind}: ${node.id}`); continue;
        }
        edges.push({ id: `parent:${node.parentId}:${node.id}`, from: node.parentId, to: node.id,
            kind: 'branch', label: `${node.kind} parent` });
    }
    for (const entity of [...index.phases, ...index.gates]) for (const dependency of entity.dependencies) {
        if (byId.get(dependency)?.kind !== byId.get(entity.id)?.kind) {
            diagnostics.push(`Invalid dependency: ${dependency} -> ${entity.id}`); continue;
        }
        edges.push({ id: `dependency:${dependency}:${entity.id}`, from: dependency, to: entity.id,
            kind: 'dependency', label: 'Depends on' });
    }
    edges.sort((a, b) => compare(a.from, b.from) || compare(a.to, b.to) || compare(a.id, b.id));
    const ownerPool = (owner: RoadmapOwnerRecord): PoolNode => ({
        id: `${owner.owner}:${owner.targetId}`, owner: owner.owner, targetId: owner.targetId,
        title: owner.title, status: owner.status, readOnly: owner.readOnly,
        provenance: owner.owner === 'issue' ? 'known-issues.md' : owner.artifact.provenance,
        ...(owner.owner === 'issue' ? { sourceHash: owner.sourceHash } : { ownerRevision: owner.ownerRevision }),
    });
    const poolOrder = (a: PoolNode, b: PoolNode): number => compare(a.title, b.title) || compare(a.id, b.id);
    const pools = { ideas: owners.filter(owner => owner.owner === 'project-mind' && owner.artifact.type === 'idea').map(ownerPool).sort(poolOrder),
        issues: owners.filter(owner => owner.owner === 'issue').map(ownerPool).sort(poolOrder),
        corrections: corrections.filter(node => !node.parentId || byId.get(node.parentId)?.kind !== node.parentKind) };
    const selected = (presentation.projectId === undefined || presentation.projectId === index.projectId) &&
        presentation.selectedId ? byId.get(presentation.selectedId) : undefined;
    const neighborIds = selected ? new Set(edges.filter(edge => edge.from === selected.id || edge.to === selected.id)
        .map(edge => edge.from === selected.id ? edge.to : edge.from)) : new Set<string>();
    return { projectId: index.projectId, revision: index.revision, nodes, edges, pools,
        diagnostics: diagnostics.sort(compare),
        selection: selected ? { node: selected, neighbors: nodes.filter(node => neighborIds.has(node.id)) } : undefined };
}
