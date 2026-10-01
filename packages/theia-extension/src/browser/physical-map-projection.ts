import type { ArchitectureViolation, GraphNode, GraphRelationship } from '@dope/software-map';

export type CanvasState = 'realized' | 'declared-only' | 'detected-only' | 'drifted' | 'unassigned';
export interface CanvasNode {
    id: string;
    kind: 'system' | 'subsystem' | 'component' | 'code' | 'unassigned';
    name: string;
    state: CanvasState;
    badge: string;
    x: number;
    y: number;
    width: number;
    height: number;
    parentId?: string;
    context?: boolean;
}
export interface CanvasEdge {
    id: string;
    source: string;
    target: string;
    kind: 'containment' | 'dependency';
    state: CanvasState;
    label: string;
}
export interface CanvasProjection { nodes: CanvasNode[]; edges: CanvasEdge[]; oneSystem: boolean }

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const byIdentity = (a: GraphNode, b: GraphNode): number => compare(a.name, b.name) || compare(a.id, b.id);
const badge: Record<CanvasState, string> = {
    realized: 'Realized', 'declared-only': 'Declared only', 'detected-only': 'Detected only',
    drifted: 'Drift', unassigned: 'Unassigned'
};

/** Plain presentation geometry. Canonical state and service contracts never contain these coordinates. */
export function projectPhysicalMap(nodes: GraphNode[], relationships: GraphRelationship[], violations: ArchitectureViolation[], focusId?: string): CanvasProjection {
    if (focusId) {
        const byId = new Map(nodes.map(node => [node.id, node]));
        const focus = byId.get(focusId);
        if (!focus || focus.kind === 'project') return { nodes: [], edges: [], oneSystem: false };
        const children = nodes.filter(node => node.parentId === focusId && node.kind !== 'project').sort(byIdentity);
        const drift = new Set(violations.flatMap(item => [item.sourceSubsystemId, item.targetSubsystemId]));
        const driftEdges = new Set(violations.map(item => `${item.sourceSubsystemId}\0${item.targetSubsystemId}`));
        const realized = new Set<string>();
        for (const node of nodes) if (node.kind === 'code') {
            realized.add(node.id);
            if (node.ownership.systemId) realized.add(node.ownership.systemId);
            if (node.ownership.subsystemId) realized.add(node.ownership.subsystemId);
            if (node.ownership.componentId) realized.add(node.ownership.componentId);
        }
        const stateOf = (node: GraphNode): CanvasState => drift.has(node.id) || node.kind === 'system' &&
            nodes.some(child => child.parentId === node.id && drift.has(child.id)) ? 'drifted' :
            node.kind === 'code' && node.ownership.state === 'unassigned' ? 'unassigned' :
            realized.has(node.id) ? 'realized' : 'declared-only';
        const visible = [focus, ...children];
        const visibleIds = new Set(visible.map(node => node.id));
        const dependencies = relationships.filter(edge => (edge.kind === 'depends-on' && edge.originRelationshipIds?.length ||
            (focus.kind === 'code' || children.some(node => node.kind === 'code')) &&
            ['imports', 'depends-on', 'references', 'extends', 'implements'].includes(edge.kind)) &&
            (visibleIds.has(edge.sourceId) || visibleIds.has(edge.targetId)) && edge.sourceId !== edge.targetId);
        const context = [...new Set(dependencies.flatMap(edge => [edge.sourceId, edge.targetId]))]
            .filter(id => !visibleIds.has(id)).map(id => byId.get(id)).filter((node): node is Exclude<GraphNode, { kind: 'project' }> => !!node && node.kind !== 'project').sort(byIdentity);
        const width = 760;
        const columns = 3;
        const height = Math.max(150, 104 + Math.ceil(children.length / columns) * 112);
        const canvasNodes: CanvasNode[] = [{ id: focus.id, kind: focus.kind, name: focus.name,
            state: stateOf(focus), badge: badge[stateOf(focus)],
            x: 32, y: 32, width, height }];
        children.forEach((node, index) => canvasNodes.push({ id: node.id, kind: node.kind === 'project' ? 'unassigned' : node.kind, name: node.name,
            state: stateOf(node), badge: badge[stateOf(node)],
            parentId: focus.id, x: 24 + index % columns * 238, y: 78 + Math.floor(index / columns) * 112, width: 214, height: 82 }));
        context.forEach((node, index) => canvasNodes.push({ id: node.id, kind: node.kind, name: node.name,
            state: stateOf(node), badge: `Outside focus · ${badge[stateOf(node)]}`,
            x: 32 + index % columns * 250, y: 32 + height + 40 + Math.floor(index / columns) * 100,
            width: 214, height: 72, context: true }));
        const shown = new Set(canvasNodes.map(node => node.id));
        const edges: CanvasEdge[] = children.map(node => ({ id: `containment:${focus.id}:${node.id}`,
            source: focus.id, target: node.id, kind: 'containment', state: 'realized', label: 'Contains' }));
        for (const edge of dependencies.sort((a, b) => compare(a.id, b.id))) if (shown.has(edge.sourceId) && shown.has(edge.targetId)) {
            const state: CanvasState = driftEdges.has(`${edge.sourceId}\0${edge.targetId}`) ? 'drifted' : 'realized';
            edges.push({ id: edge.id, source: edge.sourceId, target: edge.targetId, kind: 'dependency', state,
                label: state === 'drifted' ? 'Dependency · drift' : 'Dependency' });
        }
        return { nodes: canvasNodes, edges, oneSystem: focus.kind === 'system' };
    }
    const systems = nodes.filter(node => node.kind === 'system').sort(byIdentity);
    const subsystems = nodes.filter(node => node.kind === 'subsystem');
    const code = nodes.filter(node => node.kind === 'code');
    const drift = new Set(violations.flatMap(item => [item.sourceSubsystemId, item.targetSubsystemId]));
    const driftEdges = new Set(violations.map(item => `${item.sourceSubsystemId}\0${item.targetSubsystemId}`));
    const realized = new Set<string>();
    for (const node of code) if (node.kind === 'code' && node.ownership.state === 'assigned') {
        if (node.ownership.systemId) realized.add(node.ownership.systemId);
        if (node.ownership.subsystemId) realized.add(node.ownership.subsystemId);
    }
    const oneSystem = systems.length === 1;
    const result: CanvasNode[] = [];
    let rowY = 32;
    for (let row = 0; row < systems.length; row += oneSystem ? 1 : 2) {
        const group = systems.slice(row, row + (oneSystem ? 1 : 2));
        let rowHeight = 0;
        group.forEach((system, column) => {
            const children = subsystems.filter(node => node.parentId === system.id).sort(byIdentity);
            const width = oneSystem ? 760 : 380;
            const columns = oneSystem ? 3 : 2;
            const height = Math.max(150, 104 + Math.ceil(children.length / columns) * 112);
            const x = 32 + column * 420;
            const state: CanvasState = children.some(node => drift.has(node.id)) ? 'drifted' : realized.has(system.id) ? 'realized' : 'declared-only';
            result.push({ id: system.id, kind: 'system', name: system.name, state, badge: badge[state], x, y: rowY, width, height });
            children.forEach((child, index) => {
                const childState: CanvasState = drift.has(child.id) ? 'drifted' : realized.has(child.id) ? 'realized' : 'declared-only';
                result.push({ id: child.id, kind: 'subsystem', name: child.name, state: childState, badge: badge[childState],
                    parentId: system.id, x: 24 + index % columns * (oneSystem ? 238 : 174),
                    y: 78 + Math.floor(index / columns) * 112, width: oneSystem ? 214 : 158, height: 82 });
            });
            rowHeight = Math.max(rowHeight, height);
        });
        rowY += rowHeight + 32;
    }
    const unassigned = code.filter(node => node.kind === 'code' && node.ownership.state === 'unassigned').length;
    if (unassigned) {
        const state: CanvasState = systems.length ? 'unassigned' : 'detected-only';
        result.push({ id: 'canvas:unassigned', kind: 'unassigned', name: `${unassigned} unassigned code entities`,
            state, badge: systems.length ? badge.unassigned : 'Detected only · Unassigned',
            x: 32, y: rowY, width: oneSystem ? 760 : 380, height: 72 });
    }
    const visible = new Set(result.map(node => node.id));
    const edges: CanvasEdge[] = result.filter(node => node.kind === 'subsystem').map(node => ({
        id: `containment:${node.parentId}:${node.id}`, source: node.parentId!, target: node.id,
        kind: 'containment', state: node.state, label: 'Contains'
    }));
    for (const edge of relationships.filter(edge => edge.kind === 'depends-on' && edge.originRelationshipIds?.length &&
        visible.has(edge.sourceId) && visible.has(edge.targetId) && edge.sourceId !== edge.targetId).sort((a, b) => compare(a.id, b.id))) {
        const state: CanvasState = driftEdges.has(`${edge.sourceId}\0${edge.targetId}`) ? 'drifted' : 'realized';
        edges.push({ id: edge.id, source: edge.sourceId, target: edge.targetId,
            kind: 'dependency', state, label: state === 'drifted' ? 'Dependency · drift' : 'Dependency' });
    }
    return { nodes: result, edges, oneSystem };
}
