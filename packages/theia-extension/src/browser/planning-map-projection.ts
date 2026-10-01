import type { GraphNode, GraphRelationship, ArchitectureViolation } from '@dope/software-map';
import type { PlanningMap, PlannedTransformation } from '@dope/visual-planning';
import { projectPhysicalMap } from './physical-map-projection';
import type { CanvasProjection } from './physical-map-projection';

export type PlanningView = 'current' | 'target' | 'diff';
export type PlanningIntent = 'add' | 'modify' | 'remove' | 'move' | 'relationship' | 'contract';
export interface PlanningProjection extends CanvasProjection {
    nodes: (CanvasProjection['nodes'][number] & { intent?: PlanningIntent })[];
    edges: (CanvasProjection['edges'][number] & { intent?: PlanningIntent })[];
}
const intentOf = (item: PlannedTransformation): PlanningIntent => item.kind === 'redirect-relationship' ? 'relationship' :
    item.kind === 'change-contract' ? 'contract' : item.kind === 'split' || item.kind === 'merge' ? 'modify' : item.kind;
const caption: Record<PlanningIntent, string> = { add: 'Planned addition', modify: 'Planned change', remove: 'Planned removal',
    move: 'Planned move', relationship: 'Planned relationship', contract: 'Planned contract change' };

/** A disposable canvas projection. The PlanningMap remains the only target authority. */
export function projectPlanningMap(nodes: GraphNode[], relationships: GraphRelationship[], violations: ArchitectureViolation[],
    map: PlanningMap, view: PlanningView, focusId?: string): PlanningProjection {
    const current = projectPhysicalMap(nodes, relationships, violations, focusId);
    if (view === 'current') return current;
    const target = new Map(nodes.map(node => [node.id, node]));
    const intent = new Map<string, Set<PlanningIntent>>();
    const mark = (id: string, kind: PlanningIntent) => {
        if (!intent.has(id)) intent.set(id, new Set());
        intent.get(id)!.add(kind);
    };
    for (const change of map.transformations) {
        const kind = intentOf(change);
        for (const id of change.currentIds) mark(id, kind);
        if (['remove', 'split', 'merge'].includes(change.kind)) for (const id of change.currentIds) target.delete(id);
        for (const future of change.futureNodes) {
            mark(future.id, kind);
            target.set(future.id, { id: future.id, kind: future.kind, name: future.name, purpose: future.purpose,
                parentId: future.parentId, evidenceIds: nodes.find(node => node.id === future.id)?.evidenceIds ?? [] } as GraphNode);
        }
        if (change.redirect) for (const id of [change.redirect.from.sourceId, change.redirect.to.sourceId]) mark(id, 'relationship');
    }
    const projected = projectPhysicalMap([...target.values()], relationships, violations, focusId);
    const beforeById = new Map(nodes.map(node => [node.id, node]));
    const detail = (id: string): string => {
        const before = beforeById.get(id), after = target.get(id);
        if (!before || !after) return '';
        const differences = [before.name !== after.name ? `${before.name} → ${after.name}` : '',
            before.parentId !== after.parentId ? `${before.parentId ?? 'project'} → ${after.parentId ?? 'project'}` : ''].filter(Boolean);
        return differences.length ? ` · ${differences.join(' · ')}` : '';
    };
    const currentById = new Map(current.nodes.map(node => [node.id, node]));
    const targetById = new Map(projected.nodes.map(node => [node.id, node]));
    const result: PlanningProjection = { ...projected, nodes: projected.nodes.map(node => {
        const meanings = [...(intent.get(node.id) ?? [])];
        return meanings.length ? { ...node, intent: meanings[0], badge: `${node.badge} · ${meanings.map(value => caption[value]).join(' · ')}${detail(node.id)}` } : node;
    }), edges: projected.edges.map(edge => ({ ...edge })) };
    if (view === 'diff') for (const [id, node] of currentById) if (!targetById.has(id)) {
        const meanings = [...(intent.get(id) ?? [])];
        result.nodes.push({ ...node, intent: meanings[0], badge: meanings.length ? `${node.badge} · ${meanings.map(value => caption[value]).join(' · ')}` : node.badge });
    }
    // Physical dependency edges remain evidence; policy redirects are separate target intent.
    for (const change of map.transformations) if (change.redirect) {
        const { from, to } = change.redirect;
        if (view === 'diff' && result.nodes.some(node => node.id === from.sourceId) && result.nodes.some(node => node.id === from.targetId))
            result.edges.push({ id: `planned-remove:${change.id}`, source: from.sourceId, target: from.targetId,
                kind: 'dependency', state: 'declared-only', intent: 'remove', label: `Planned removal of ${from.policy} relationship` });
        if (result.nodes.some(node => node.id === to.sourceId) && result.nodes.some(node => node.id === to.targetId))
            result.edges.push({ id: `planned:${change.id}`, source: to.sourceId, target: to.targetId,
                kind: 'dependency', state: 'declared-only', intent: 'relationship', label: `Planned ${to.policy} relationship` });
    }
    if (view === 'diff') for (const edge of current.edges) if (!result.edges.some(item => item.id === edge.id) &&
        result.nodes.some(node => node.id === edge.source) && result.nodes.some(node => node.id === edge.target)) result.edges.push(edge);
    if (view === 'target') result.edges = result.edges.filter(edge => result.nodes.some(node => node.id === edge.source) &&
        result.nodes.some(node => node.id === edge.target));
    return result;
}
