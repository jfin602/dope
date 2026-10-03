import type { GraphNode } from '@dope/software-map';

export function outlineLabel(node: GraphNode): string {
    if (node.kind !== 'code') return `${node.kind} - ${node.name}`;
    return `${node.codeKind} - ${node.codeKind === 'file' ? node.path : node.name}`;
}

export function revealOutlineAncestors(nodes: GraphNode[], selectedId: string, expanded: Set<string>): boolean {
    const byId = new Map(nodes.map(node => [node.id, node]));
    if (!byId.has(selectedId)) return false;
    const seen = new Set<string>([selectedId]);
    for (let parentId = byId.get(selectedId)?.parentId; parentId && !seen.has(parentId); parentId = byId.get(parentId)?.parentId) {
        seen.add(parentId);
        expanded.add(parentId);
    }
    return true;
}
