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
