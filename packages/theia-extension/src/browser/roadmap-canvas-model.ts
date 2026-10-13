import type { CheckpointNode, RoadmapProjection } from '@dope/project-intelligence/lib/roadmap-projection';

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
    const visit = (node: CheckpointNode, depth: number): void => {
        if (placed.has(node.id)) return;
        const column = node.kind === 'phase' ? 0 : node.kind === 'prompt' ? Math.max(2, depth) : depth;
        placed.set(node.id, { x: 64 + column * 340, y });
        y += Math.max(120, 65 + Math.ceil(Math.min(200, node.title.length) / 24) * 20) + 24;
        for (const child of children.get(node.id) ?? []) visit(child, node.kind === 'prompt' && child.kind === 'prompt' ? depth : depth + 1);
    };
    for (const phase of projection.nodes.filter(node => node.lane === 'path').sort(compare)) visit(phase, 0);
    for (const node of [...projection.nodes].sort(compare)) visit(node, node.lane === 'branch' ? 1 : 0);
    return placed;
}
