import type { ArchitectureViolation, GraphNode, GraphRelationship } from '@dope/software-map';

export type CanvasState = 'realized' | 'declared-only' | 'detected-only' | 'drifted' | 'unassigned';
export interface CanvasNode {
    id: string;
    kind: 'system' | 'subsystem' | 'unassigned';
    name: string;
    state: CanvasState;
    badge: string;
    x: number;
    y: number;
    width: number;
    height: number;
    parentId?: string;
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
export function projectPhysicalMap(nodes: GraphNode[], relationships: GraphRelationship[], violations: ArchitectureViolation[]): CanvasProjection {
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
