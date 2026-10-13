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
export function roadmapCanvasOrder(projection: RoadmapProjection): CheckpointNode[] {
    const phases = projection.nodes.filter(node => node.lane === 'path');
    const branches = projection.nodes.filter(node => node.lane === 'branch');
    const byId = new Map(projection.nodes.map(node => [node.id, node]));
    const children = new Map<string, CheckpointNode[]>();
    for (const node of branches) {
        const parent = projection.edges.find(edge => edge.to === node.id && edge.kind === 'branch')?.from;
        if (parent && byId.has(parent)) children.set(parent, [...(children.get(parent) ?? []), node]);
    }
    const seen = new Set<string>();
    const ordered: CheckpointNode[] = [];
    const visit = (node: CheckpointNode): void => {
        if (seen.has(node.id)) return;
        seen.add(node.id);
        ordered.push(node);
        for (const child of children.get(node.id) ?? []) visit(child);
    };
    for (const phase of phases) visit(phase);
    for (const branch of branches) visit(branch);
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

/** Stable presentation-only coordinates. Branch descendants reserve vertical space before the next phase. */
export function roadmapSpatialLayout(projection: RoadmapProjection): Map<string, { x: number; y: number }> {
    const placed = new Map<string, { x: number; y: number }>();
    const byId = new Map(projection.nodes.map(node => [node.id, node]));
    const children = new Map<string, CheckpointNode[]>();
    for (const edge of projection.edges.filter(item => item.kind === 'branch')) {
        const child = byId.get(edge.to);
        if (child) children.set(edge.from, [...(children.get(edge.from) ?? []), child]);
    }
    const compare = (a: CheckpointNode, b: CheckpointNode): number =>
        a.order - b.order || a.id.localeCompare(b.id, 'en');
    for (const group of children.values()) group.sort(compare);
    let y = 64;
    const visit = (node: CheckpointNode, depth: number, correctionLane = false): void => {
        if (placed.has(node.id)) return;
        const correction = correctionLane || node.kind === 'correction' ||
            (node.kind === 'task-stack' && (node.taskSource?.segment ?? node.title).startsWith('Correction '));
        const column = node.kind === 'phase' ? 0 : correction ? Math.max(3, depth + 2) :
            node.kind === 'prompt' ? Math.max(2, depth) : depth;
        placed.set(node.id, { x: 64 + column * 340, y });
        y += Math.max(120, 65 + Math.ceil(Math.min(200, node.title.length) / 24) * 20) + 24;
        for (const child of children.get(node.id) ?? [])
            visit(child, node.kind === 'prompt' && child.kind === 'prompt' ? depth : depth + 1, correction);
    };
    for (const phase of projection.nodes.filter(node => node.lane === 'path').sort(compare)) visit(phase, 0);
    for (const node of [...projection.nodes].sort(compare)) visit(node, node.lane === 'branch' ? 1 : 0);
    return placed;
}
