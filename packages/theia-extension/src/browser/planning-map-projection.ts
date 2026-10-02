import type { GraphNode, GraphRelationship, ArchitectureViolation } from '@dope/software-map';
import type { PlanningMap, PlannedTransformation, RebaseConflict, RebaseResult, ReconciliationResult, StaleResult } from '@dope/visual-planning';
import { projectPhysicalMap } from './physical-map-projection';
import type { CanvasProjection, MapPresentation } from './physical-map-projection';

export type PlanningView = 'current' | 'target' | 'diff';
export const projectReconciliationResult = (result: ReconciliationResult): string =>
    `${result.transformationId ?? 'Unexpected'} · ${result.identityId}: ${result.outcome} · ${result.explanation} · evidence ${result.evidenceIds.join(', ') || 'none'}${result.branchIds?.length ? ` · branches ${result.branchIds.join(', ')}` : ''}`;
export type PlanningIntent = 'add' | 'modify' | 'remove' | 'move' | 'relationship' | 'contract';
export interface PlanningProjection extends CanvasProjection {
    nodes: (CanvasProjection['nodes'][number] & { intent?: PlanningIntent; stale?: boolean; conflict?: boolean })[];
    edges: (CanvasProjection['edges'][number] & { intent?: PlanningIntent; stale?: boolean; conflict?: boolean })[];
}
const intentOf = (item: PlannedTransformation): PlanningIntent => item.kind === 'redirect-relationship' ? 'relationship' :
    item.kind === 'change-contract' ? 'contract' : item.kind === 'split' || item.kind === 'merge' ? 'modify' : item.kind;
const caption: Record<PlanningIntent, string> = { add: 'Planned addition', modify: 'Planned change', remove: 'Planned removal',
    move: 'Planned move', relationship: 'Planned relationship', contract: 'Planned contract change' };

export function projectRebaseConflict(map: PlanningMap, preview: RebaseResult, conflict: RebaseConflict): { old: string; current: string; target: string } {
    const describe = (reality: RebaseResult['currentReality'] | undefined): string => {
        if (!reality) return 'Old graph unavailable';
        const physical = reality.physicalNodes.find(n => n.id === conflict.identityId);
        const canonical = reality.architecture.systems.flatMap(system => [system, ...system.subsystems.flatMap(sub => [sub, ...(sub.components ?? [])])])
            .find(n => n.id === conflict.identityId);
        return canonical ? `${canonical.name} · ${canonical.purpose}${physical ? ` · physical ${physical.kind}` : ' · no physical node'}` :
            physical ? `${physical.name} · physical ${physical.kind}` : 'Absent';
    };
    const change = map.transformations.find(t => t.id === conflict.transformationId);
    return { old: describe(preview.oldReality), current: describe(preview.currentReality),
        target: change ? `${change.kind} · ${change.futureNodes.map(n => `${n.id}: ${n.name}`).join(', ') || change.redirect && `${change.redirect.from.sourceId} → ${change.redirect.to.targetId}` || 'removal'}` : 'Unknown transformation' };
}

/** A disposable canvas projection. The PlanningMap remains the only target authority. */
export function projectPlanningMap(nodes: GraphNode[], relationships: GraphRelationship[], violations: ArchitectureViolation[],
    map: PlanningMap, view: PlanningView, focusId?: string, stale?: StaleResult, presentation: MapPresentation = {}): PlanningProjection {
    const current = projectPhysicalMap(nodes, relationships, violations, focusId, presentation);
    const markStale = (result: PlanningProjection): PlanningProjection => {
        if (!stale?.stale) return result;
        const affected = new Set(stale.affectedTransformationIds);
        const ids = new Set(stale.conflicts.map(c => c.identityId));
        for (const change of map.transformations.filter(t => affected.has(t.id))) {
            for (const id of change.currentIds) ids.add(id);
            for (const future of change.futureNodes) ids.add(future.id);
            if (change.redirect) for (const relation of [change.redirect.from, change.redirect.to]) {
                ids.add(relation.sourceId); ids.add(relation.targetId);
            }
        }
        return { ...result, nodes: result.nodes.map(node => {
            if (!ids.has(node.id) && !stale.affectedBranchIds.includes(node.id)) return node;
            const conflict = ids.has(node.id);
            return { ...node, stale: true, conflict, badge: `${node.badge} · ${conflict ? '⚠ Conflict' : '⚠ Stale branch'}` };
        }), edges: result.edges.map(edge => {
            if (!ids.has(edge.source) && !ids.has(edge.target) && ![...affected].some(id => edge.id.endsWith(`:${id}`))) return edge;
            return { ...edge, stale: true, conflict: true, label: `${edge.label} · ⚠ Conflict` };
        }) };
    };
    if (view === 'current') return markStale(current);
    const target = new Map(nodes.map(node => [node.id, node]));
    const intent = new Map<string, Set<PlanningIntent>>();
    const adopted = new Set<string>(), adoptedRemoved = new Set<string>();
    const mark = (id: string, kind: PlanningIntent) => {
        if (!intent.has(id)) intent.set(id, new Set());
        intent.get(id)!.add(kind);
    };
    const byTransformationId = new Map(map.transformations.map(change => [change.id, change]));
    const ordered: PlannedTransformation[] = [], seen = new Set<string>();
    const visit = (change: PlannedTransformation): void => {
        if (seen.has(change.id)) return;
        seen.add(change.id);
        for (const id of change.dependsOn) { const dependency = byTransformationId.get(id); if (dependency) visit(dependency); }
        ordered.push(change);
    };
    for (const change of [...map.transformations].sort((a, b) => Number(!!b.adopted) - Number(!!a.adopted) || a.id.localeCompare(b.id))) visit(change);
    for (const change of ordered) {
        const kind = intentOf(change);
        for (const id of change.currentIds) if (!change.adopted) mark(id, kind);
        if (['remove', 'split', 'merge'].includes(change.kind)) for (const id of change.currentIds) {
            target.delete(id);
            if (change.adopted) adoptedRemoved.add(id);
        }
        for (const future of change.futureNodes) {
            if (change.adopted) adopted.add(future.id); else mark(future.id, kind);
            target.set(future.id, { id: future.id, kind: future.kind, name: future.name, purpose: future.purpose,
                parentId: future.parentId, evidenceIds: nodes.find(node => node.id === future.id)?.evidenceIds ?? [] } as GraphNode);
        }
        if (change.redirect && !change.adopted) for (const id of [change.redirect.from.sourceId, change.redirect.to.sourceId]) mark(id, 'relationship');
    }
    const projected = projectPhysicalMap([...target.values()], relationships, violations, focusId, presentation);
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
        if (meanings.length) return { ...node, intent: meanings[0], badge: `${node.badge} · ${meanings.map(value => caption[value]).join(' · ')}${detail(node.id)}` };
        if (adopted.has(node.id)) {
            const before = beforeById.get(node.id), after = target.get(node.id);
            const pending = !before || before.parentId !== after?.parentId || before.name !== after?.name;
            return { ...node, state: pending ? 'declared-only' as const : node.state,
                badge: pending ? 'Adopted target · Physical Map refresh pending' : `${node.badge} · Adopted target` };
        }
        return node;
    }), edges: projected.edges.map(edge => ({ ...edge })) };
    if (view === 'diff') for (const [id, node] of currentById) if (!targetById.has(id)) {
        const meanings = [...(intent.get(id) ?? [])];
        result.nodes.push({ ...node, intent: meanings[0], badge: adoptedRemoved.has(id) ? `${node.badge} · Adopted removal · Physical Map refresh pending` :
            meanings.length ? `${node.badge} · ${meanings.map(value => caption[value]).join(' · ')}` : node.badge });
    }
    // Physical dependency edges remain evidence; policy redirects are separate target intent.
    for (const change of map.transformations.filter(change => !change.adopted)) if (change.redirect) {
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
    return markStale(result);
}
