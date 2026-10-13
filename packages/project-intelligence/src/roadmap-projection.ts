import type { RoadmapCheckpoint, RoadmapIndex, RoadmapLink } from './node/roadmap-store';
import type { RoadmapOwnerRecord } from './node/roadmap-owner-links';

export interface RoadmapPresentation {
    projectId?: string;
    selectedId?: string;
    viewport?: { x: number; y: number; zoom: number };
    placements?: Record<string, { x: number; y: number }>;
    colors?: Record<string, string>;
}
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
    lane: 'path' | 'branch';
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
export interface RoadmapProjection {
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
export function projectRoadmap(index: RoadmapIndex, owners: readonly RoadmapOwnerRecord[] = [],
    presentation: RoadmapPresentation = {}): RoadmapProjection {
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
