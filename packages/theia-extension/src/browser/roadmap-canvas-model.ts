import type { CheckpointNode, CheckpointEdge, RoadmapProjection } from '@dope/project-intelligence/lib/roadmap-projection';

export type RoadmapDetail = 'world' | 'phase' | 'checkpoint';

/** Absolute zoom thresholds with a dead band at each boundary. */
export function roadmapDetailAtZoom(zoom: number, current: RoadmapDetail): RoadmapDetail {
    if (!Number.isFinite(zoom) || zoom <= 0) return current;
    if (current === 'world') return zoom >= 0.72 ? 'phase' : 'world';
    if (current === 'checkpoint') return zoom <= 1.12 ? 'phase' : 'checkpoint';
    return zoom < 0.56 ? 'world' : zoom > 1.36 ? 'checkpoint' : 'phase';
}

export interface RoadmapVisibleGraph {
    nodes: CheckpointNode[];
    edges: CheckpointEdge[];
    /** Counts hidden prompt children on their stable stack identity. */
    omittedByStack: Map<string, number>;
}

export interface RoadmapCanvasConnector {
    id: string;
    from: string;
    to: string;
    kind: 'progression' | 'membership' | 'containment' | 'dependency';
    label: string;
}

/** Relationships for drawing only. None are written back to RoadmapIndex. */
export function roadmapCanvasConnectors(projection: Pick<RoadmapProjection, 'nodes' | 'edges'>): RoadmapCanvasConnector[] {
    const byId = new Map(projection.nodes.map(node => [node.id, node]));
    const visible = (id: string): boolean => byId.has(id);
    const phases = projection.nodes.filter(node => node.kind === 'phase')
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const connectors: RoadmapCanvasConnector[] = [];
    for (let i = 1; i < phases.length; i++) connectors.push({
        id: `view:progression:${phases[i - 1].id}:${phases[i].id}`,
        from: phases[i - 1].id, to: phases[i].id, kind: 'progression',
        label: 'Chronological phase progression; no release gate implied',
    });
    for (const node of projection.nodes) if ((node.kind === 'correction' ||
        node.kind === 'task-stack' && roadmapUpperBranch(node)) &&
        node.phaseAssociation?.phaseId && visible(node.phaseAssociation.phaseId)) connectors.push({
        id: `view:membership:${node.phaseAssociation.phaseId}:${node.id}`,
        from: node.phaseAssociation.phaseId, to: node.id, kind: 'membership',
        label: `Correction belongs to ${byId.get(node.phaseAssociation.phaseId)!.title}`,
    });
    for (const edge of projection.edges) if (visible(edge.from) && visible(edge.to)) {
        const kind = edge.kind === 'dependency' || edge.id.startsWith('dependency:') ? 'dependency' : 'containment';
        connectors.push({ id: `view:${edge.id}`, from: edge.from, to: edge.to, kind,
            label: kind === 'dependency' ? `Stored Roadmap dependency: ${edge.label}` :
                `Supporting task or prompt: ${edge.label}` });
    }
    return connectors;
}

/** Presentation disclosure only. The projection and its evidence are never changed. */
export function roadmapVisibleGraph(projection: RoadmapProjection, detail: RoadmapDetail,
    selectedId?: string, expanded: ReadonlySet<string> = new Set(), collapsed: ReadonlySet<string> = new Set(),
    promptLimit = 96, window?: { stackId: string; start: number }): RoadmapVisibleGraph {
    const byId = new Map(projection.nodes.map(node => [node.id, node]));
    const stackForPrompt = new Map<string, string>();
    const promptsByStack = new Map<string, CheckpointNode[]>();
    for (const edge of projection.edges) {
        const source = byId.get(edge.from), target = byId.get(edge.to);
        if (source?.kind === 'task-stack' && target?.kind === 'prompt') stackForPrompt.set(target.id, source.id);
    }
    for (const node of projection.nodes) if (node.kind === 'prompt') {
        const stack = stackForPrompt.get(node.id) ?? projection.nodes.find(candidate =>
            candidate.kind === 'task-stack' && candidate.taskSource?.stackPath === node.taskSource?.stackPath)?.id;
        if (stack) {
            stackForPrompt.set(node.id, stack);
            promptsByStack.set(stack, [...(promptsByStack.get(stack) ?? []), node]);
        }
    }
    const selectedStack = selectedId ? stackForPrompt.get(selectedId) : undefined;
    const priorityStack = window?.stackId ?? selectedStack ??
        (byId.get(selectedId ?? '')?.kind === 'task-stack' ? selectedId : undefined);
    const showStack = (node: CheckpointNode): boolean => {
        if (node.kind !== 'task-stack') return true;
        if (node.id === selectedId || node.id === selectedStack) return true;
        if (expanded.has(node.id)) return true;
        const parent = projection.edges.find(edge => edge.to === node.id && edge.id.startsWith('task-parent:'))?.from;
        if (parent && expanded.has(parent)) return true;
        if (parent && collapsed.has(parent)) return false;
        return detail !== 'world' || (node.taskSource?.segment ?? node.title).startsWith('Correction ');
    };
    const visible = new Set(projection.nodes.filter(node => node.kind !== 'prompt' && showStack(node)).map(node => node.id));
    const candidates = [...promptsByStack].filter(([stack]) => visible.has(stack) &&
        (stack === selectedStack || (!collapsed.has(stack) && (expanded.has(stack) || detail === 'checkpoint'))))
        .sort(([a], [b]) => a === priorityStack ? -1 : b === priorityStack ? 1 : 0);
    // Reserve room for the selected prompt and immediate sequence context even in a large graph.
    const budget = Math.max(1, Math.min(256, Math.floor(promptLimit)));
    const selected = byId.get(selectedId ?? '');
    if (selected?.kind === 'prompt') visible.add(selected.id);
    let remaining = Math.max(0, budget - (selected?.kind === 'prompt' ? 1 : 0));
    for (const [stack, prompts] of candidates) {
        const ordered = [...prompts].sort((a, b) => (a.taskSource?.number ?? 0) - (b.taskSource?.number ?? 0) || a.id.localeCompare(b.id));
        const selectedIndex = ordered.findIndex(node => node.id === selectedId);
        const neighborhood = selectedIndex < 0 ? [] : ordered.slice(Math.max(0, selectedIndex - 2), selectedIndex + 3);
        for (const node of neighborhood) if (!visible.has(node.id) && remaining > 0) { visible.add(node.id); remaining--; }
        const offset = stack === window?.stackId && Number.isSafeInteger(window.start) ?
            Math.max(0, Math.min(ordered.length - 1, window.start)) : 0;
        for (const node of [...ordered.slice(offset), ...ordered.slice(0, offset)])
            if (!visible.has(node.id) && remaining > 0) { visible.add(node.id); remaining--; }
    }
    const omittedByStack = new Map<string, number>();
    for (const [stack, prompts] of promptsByStack) if (visible.has(stack))
        omittedByStack.set(stack, prompts.filter(node => !visible.has(node.id)).length);
    return { nodes: projection.nodes.filter(node => visible.has(node.id)),
        edges: projection.edges.filter(edge => visible.has(edge.from) && visible.has(edge.to)), omittedByStack };
}

/** DOM order and keyboard order are the same, including correction branches. */
export function roadmapCanvasOrder(projection: Pick<RoadmapProjection, 'nodes' | 'edges'>): CheckpointNode[] {
    const phases = projection.nodes.filter(node => node.lane === 'path');
    const branches = projection.nodes.filter(node => node.lane === 'branch');
    const byId = new Map(projection.nodes.map(node => [node.id, node]));
    const children = new Map<string, CheckpointNode[]>();
    for (const node of branches) {
        const parent = node.phaseAssociation?.unresolvedReason ? undefined : node.phaseAssociation?.phaseId ??
            projection.edges.find(edge => edge.to === node.id && edge.kind === 'branch')?.from;
        if (parent && byId.has(parent)) children.set(parent, [...(children.get(parent) ?? []), node]);
    }
    const compare = (a: CheckpointNode, b: CheckpointNode): number =>
        Number(roadmapUpperBranch(b)) - Number(roadmapUpperBranch(a)) || a.order - b.order || a.id.localeCompare(b.id);
    for (const group of children.values()) group.sort(compare);
    const seen = new Set<string>();
    const ordered: CheckpointNode[] = [];
    const visit = (node: CheckpointNode): void => {
        if (seen.has(node.id)) return;
        seen.add(node.id);
        ordered.push(node);
        for (const child of children.get(node.id) ?? []) visit(child);
    };
    for (const phase of [...phases].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) visit(phase);
    for (const branch of [...branches].sort(compare)) visit(branch);
    return ordered;
}

export function roadmapNextId(ids: readonly string[], current: string | undefined, key: string): string | undefined {
    if (!ids.length) return undefined;
    const index = current ? ids.indexOf(current) : -1;
    if (key === 'Home') return ids[0];
    if (key === 'End') return ids[ids.length - 1];
    if (key === 'ArrowDown' || key === 'ArrowRight') return ids[Math.min(ids.length - 1, index + 1)];
    if (key === 'ArrowUp' || key === 'ArrowLeft') return ids[Math.max(0, index < 0 ? 0 : index - 1)];
    return undefined;
}

const roadmapUpperBranch = (node: CheckpointNode): boolean => node.kind === 'correction' ||
    (node.kind === 'task-stack' && (node.taskSource?.segment ?? node.title).startsWith('Correction ')) ||
    /qualification/i.test(node.title) && node.kind !== 'phase';

/** Arrow keys choose the closest displayed card in the requested direction; Tab follows canvas order. */
export function roadmapSpatialNextId(ids: readonly string[], positions: ReadonlyMap<string, { x: number; y: number }>,
    current: string | undefined, key: string): string | undefined {
    if (key === 'Home' || key === 'End') return roadmapNextId(ids, current, key);
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return undefined;
    const origin = current && positions.get(current);
    if (!origin) return ids[0];
    const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    const sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
    return ids.filter(id => id !== current && positions.has(id)).map(id => {
        const point = positions.get(id)!;
        const primary = (horizontal ? point.x - origin.x : point.y - origin.y) * sign;
        const cross = Math.abs(horizontal ? point.y - origin.y : point.x - origin.x);
        return { id, primary, cross };
    }).filter(candidate => candidate.primary > 0).sort((a, b) =>
        a.cross - b.cross || a.primary - b.primary || ids.indexOf(a.id) - ids.indexOf(b.id))[0]?.id;
}

/** A displayed edge retains its real graph endpoints; only its presentation handles change. */
export function roadmapEdgeHandles(edge: { from: string; to: string; kind: RoadmapCanvasConnector['kind'] | CheckpointEdge['kind'] },
    positions: ReadonlyMap<string, { x: number; y: number }>): { sourceHandle: string; targetHandle: string } {
    const from = positions.get(edge.from), to = positions.get(edge.to);
    // A stored gate between consecutive phases must not paint over the chronological line.
    if (edge.kind === 'dependency' && from && to && Math.abs(to.y - from.y) <= 20)
        return { sourceHandle: 'bottom', targetHandle: 'bottom' };
    if (edge.kind !== 'progression' && edge.kind !== 'dependency' && from && to && Math.abs(to.y - from.y) > 20)
        return to.y < from.y ? { sourceHandle: 'top', targetHandle: 'bottom' } :
            { sourceHandle: 'bottom', targetHandle: 'top' };
    return { sourceHandle: 'right', targetHandle: 'left' };
}

/** Stable phase columns with correction space above and supporting work below. */
export function roadmapSpatialLayout(projection: RoadmapProjection): Map<string, { x: number; y: number }> {
    const placed = new Map<string, { x: number; y: number }>();
    const byId = new Map(projection.nodes.map(node => [node.id, node]));
    const children = new Map<string, CheckpointNode[]>();
    const incoming = new Set<string>();
    for (const edge of projection.edges.filter(item => item.kind === 'branch')) {
        const child = byId.get(edge.to);
        if (child && !child.phaseAssociation?.unresolvedReason && byId.has(edge.from)) {
            children.set(edge.from, [...(children.get(edge.from) ?? []), child]);
            incoming.add(child.id);
        }
    }
    for (const node of projection.nodes) if (node.phaseAssociation?.phaseId && byId.has(node.phaseAssociation.phaseId)) {
        const parent = node.phaseAssociation.phaseId;
        // A task with an explicit failed-prompt parent keeps that source-backed attachment.
        if (!incoming.has(node.id)) {
            children.set(parent, [...(children.get(parent) ?? []), node]);
            incoming.add(node.id);
        }
    }
    const compare = (a: CheckpointNode, b: CheckpointNode): number =>
        a.order - b.order || a.id.localeCompare(b.id, 'en');
    for (const group of children.values()) group.sort(compare);
    const baseline = 640;
    const column = 28;
    const cardHeight = (node: CheckpointNode): number =>
        Math.max(160, 100 + Math.ceil(node.title.length / 20) * 22);
    let nextBandX = 64;
    const visitBand = (root: CheckpointNode): void => {
        const x = nextBandX;
        const cursor = { upper: baseline - 70, lower: baseline + cardHeight(root) + 70 };
        const visit = (node: CheckpointNode, depth: number, upper: boolean): void => {
            if (placed.has(node.id)) return;
            const height = cardHeight(node);
            const y = node === root ? baseline : upper ? cursor.upper - height : cursor.lower;
            placed.set(node.id, { x: x + Math.min(depth, 3) * column, y });
            if (node !== root) {
                if (upper) cursor.upper = y - 44;
                else cursor.lower = y + height + 44;
            }
            for (const child of children.get(node.id) ?? [])
                visit(child, node.kind === 'prompt' && child.kind === 'prompt' ? depth : depth + 1,
                    node === root ? roadmapUpperBranch(child) : upper);
        };
        visit(root, 0, false);
        nextBandX += 420;
    };
    for (const phase of projection.nodes.filter(node => node.kind === 'phase').sort(compare)) visitBand(phase);
    // Unmatched work stays in a distinct, discoverable region past the phase route.
    nextBandX += 120;
    for (const node of [...projection.nodes].filter(item => !incoming.has(item.id)).sort(compare))
        if (!placed.has(node.id)) visitBand(node);
    for (const node of [...projection.nodes].sort(compare)) if (!placed.has(node.id)) visitBand(node);
    return placed;
}
