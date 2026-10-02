import type { ArchitectureViolation, GraphNode, GraphRelationship } from '@dope/software-map';

export type SemanticDetail = 'overview' | 'architecture' | 'implementation';
export interface MapPresentation { detail?: SemanticDetail; selectedId?: string }
export type CanvasState = 'realized' | 'declared-only' | 'detected-only' | 'drifted' | 'unassigned';
export interface CanvasNode {
    id: string;
    kind: 'system' | 'subsystem' | 'component' | 'code' | 'unassigned';
    name: string;
    state: CanvasState;
    badge: string;
    x: number; y: number; width: number; height: number;
    parentId?: string;
    context?: boolean;
}
export interface CanvasEdge {
    id: string; source: string; target: string;
    kind: 'containment' | 'dependency';
    state: CanvasState; label: string;
}
export interface CanvasProjection { nodes: CanvasNode[]; edges: CanvasEdge[]; oneSystem: boolean }

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const byIdentity = (a: GraphNode, b: GraphNode): number => compare(a.name, b.name) || compare(a.id, b.id);
const badge: Record<CanvasState, string> = {
    realized: 'Realized', 'declared-only': 'Declared only', 'detected-only': 'Detected only',
    drifted: 'Drift', unassigned: 'Unassigned'
};

// Deterministic browser estimate for wrapping; no DOM or domain measurement.
function size(name: string, minimum: number): { width: number; height: number } {
    const longest = Math.max(...name.split(/[\s/._:-]+/).map(part => part.length));
    const width = Math.max(minimum, Math.min(520, longest * 8 + 32));
    return { width, height: 58 + Math.max(1, Math.ceil(name.length * 8 / (width - 32))) * 20 };
}

/** Disposable browser geometry; canonical graph and planning state never own detail or coordinates. */
export function projectPhysicalMap(nodes: GraphNode[], relationships: GraphRelationship[], violations: ArchitectureViolation[],
    focusId?: string, presentation: MapPresentation = {}): CanvasProjection {
    const byId = new Map(nodes.map(node => [node.id, node]));
    const focus = focusId ? byId.get(focusId) : undefined;
    if (focusId && (!focus || focus.kind === 'project')) return { nodes: [], edges: [], oneSystem: false };
    const detail = presentation.detail ?? 'architecture';
    const systems = nodes.filter(node => node.kind === 'system').sort(byIdentity);
    const oneSystem = systems.length === 1;
    const children = (id: string) => nodes.filter(node => node.parentId === id && node.kind !== 'project').sort(byIdentity);
    const depth = !focus ? detail === 'overview' ? 0 : 1 :
        focus.kind === 'system' && detail === 'implementation' || focus.kind === 'subsystem' && detail === 'implementation' ? 2 : 1;
    const drift = new Set(violations.flatMap(item => [item.sourceSubsystemId, item.targetSubsystemId]));
    const driftEdges = new Set(violations.map(item => `${item.sourceSubsystemId}\0${item.targetSubsystemId}`));
    const realized = new Set<string>();
    for (const node of nodes) if (node.kind === 'code' && node.ownership.state === 'assigned') {
        realized.add(node.id);
        for (const id of [node.ownership.systemId, node.ownership.subsystemId, node.ownership.componentId]) if (id) realized.add(id);
    }
    const stateOf = (node: GraphNode): CanvasState => drift.has(node.id) || node.kind === 'system' &&
        children(node.id).some(child => drift.has(child.id)) ? 'drifted' :
        node.kind === 'code' && node.ownership.state === 'unassigned' ? 'unassigned' :
        realized.has(node.id) ? 'realized' : 'declared-only';
    const result: CanvasNode[] = [], edges: CanvasEdge[] = [];
    const place = (node: GraphNode, level: number, minimum: number, parentId?: string): CanvasNode => {
        const descendants = level > 0 ? children(node.id).filter(child => child.kind !== 'code' || node.kind === 'component' || node.kind === 'code') : [];
        const nested = descendants.map(child => place(child, level - 1,
            child.kind === 'code' ? 214 : node.kind === 'system' && !oneSystem && !focus ? 158 : 214, node.id));
        const columns = Math.min(3, Math.max(1, nested.length));
        const rows: CanvasNode[][] = [];
        for (let i = 0; i < nested.length; i += columns) rows.push(nested.slice(i, i + columns));
        const innerWidth = Math.max(0, ...rows.map(row => row.reduce((sum, child) => sum + child.width, 0) + (row.length - 1) * 16));
        const measured = size(node.name, minimum);
        const width = Math.max(measured.width, nested.length ? innerWidth + 48 : 0);
        let nextY = Math.max(78, measured.height + 16);
        for (const row of rows) {
            let nextX = 24;
            for (const child of row) { child.x = nextX; child.y = nextY; nextX += child.width + 16; }
            nextY += Math.max(...row.map(child => child.height)) + 16;
        }
        const state = stateOf(node);
        const item: CanvasNode = { id: node.id, kind: node.kind === 'project' ? 'unassigned' : node.kind,
            name: node.name, state, badge: badge[state], x: 0, y: 0, width,
            height: nested.length ? nextY + 8 : measured.height, parentId };
        result.push(item);
        for (const child of nested) edges.push({ id: `containment:${node.id}:${child.id}`, source: node.id,
            target: child.id, kind: 'containment', state: child.state, label: 'Contains' });
        return item;
    };
    const roots = focus ? [focus] : systems;
    const rootLayouts = roots.map(node => place(node, depth, focus || oneSystem ? 760 : 380));
    // React Flow requires parents before nested children.
    const order = new Map<string, number>();
    const walk = (node: CanvasNode): void => { order.set(node.id, order.size); for (const child of result.filter(item => item.parentId === node.id)) walk(child); };
    for (const root of rootLayouts) walk(root);
    result.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    let rowY = 32;
    for (let i = 0; i < rootLayouts.length; i += focus || oneSystem ? 1 : 2) {
        const row = rootLayouts.slice(i, i + (focus || oneSystem ? 1 : 2));
        let nextX = 32;
        for (const root of row) { root.x = nextX; root.y = rowY; nextX += root.width + 40; }
        rowY += Math.max(...row.map(root => root.height)) + 32;
    }
    if (!focus) {
        const unassigned = nodes.filter(node => node.kind === 'code' && node.ownership.state === 'unassigned').length;
        if (unassigned) result.push({ id: 'canvas:unassigned', kind: 'unassigned', name: `${unassigned} unassigned code entities`,
            state: systems.length ? 'unassigned' : 'detected-only', badge: systems.length ? badge.unassigned : 'Detected only · Unassigned',
            x: 32, y: rowY, ...size(`${unassigned} unassigned code entities`, oneSystem ? 760 : 380) });
    }
    const visible = new Set(result.map(node => node.id));
    const selected = presentation.selectedId && visible.has(presentation.selectedId) ? presentation.selectedId : undefined;
    const dependency = relationships.filter(edge => edge.sourceId !== edge.targetId &&
        (edge.kind === 'depends-on' && edge.originRelationshipIds?.length ||
            ['imports', 'depends-on', 'references', 'extends', 'implements'].includes(edge.kind) &&
            (focus?.kind === 'code' || result.some(node => node.kind === 'code'))) &&
        (edge.sourceId === selected || edge.targetId === selected || !!focus &&
            (visible.has(edge.sourceId) !== visible.has(edge.targetId))));
    const context = [...new Set(dependency.flatMap(edge => [edge.sourceId, edge.targetId]))]
        .filter(id => !visible.has(id)).map(id => byId.get(id))
        .filter((node): node is Exclude<GraphNode, { kind: 'project' }> => !!node && node.kind !== 'project').sort(byIdentity);
    let contextX = 32;
    for (const node of context) {
        const state = stateOf(node), geometry = size(node.name, 214);
        result.push({ id: node.id, kind: node.kind, name: node.name, state,
            badge: `Outside focus · ${badge[state]}`, x: contextX, y: rowY + 16, ...geometry, context: true });
        contextX += geometry.width + 24;
    }
    const shown = new Set(result.map(node => node.id));
    for (const edge of dependency.sort((a, b) => compare(a.id, b.id))) if (shown.has(edge.sourceId) && shown.has(edge.targetId)) {
        const state: CanvasState = driftEdges.has(`${edge.sourceId}\0${edge.targetId}`) ? 'drifted' : 'realized';
        edges.push({ id: edge.id, source: edge.sourceId, target: edge.targetId, kind: 'dependency', state,
            label: state === 'drifted' ? 'Dependency · drift' : 'Dependency' });
    }
    return { nodes: result, edges, oneSystem: focus?.kind === 'system' || !focus && oneSystem };
}
