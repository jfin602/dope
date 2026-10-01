import type { PlanningMap } from '@dope/visual-planning';

export function affectedArchitecture(map: PlanningMap, transformationIds: string[], currentNodes: { id: string; parentId?: string }[] = []): string[] {
    const ids = new Set<string>();
    for (const change of map.transformations) if (transformationIds.includes(change.id)) {
        for (const id of change.currentIds) ids.add(id);
        for (const node of change.futureNodes) { ids.add(node.id); if (node.parentId) ids.add(node.parentId); }
        if (change.redirect) for (const id of [change.redirect.from.sourceId, change.redirect.from.targetId,
            change.redirect.to.sourceId, change.redirect.to.targetId]) ids.add(id);
    }
    const nodes = new Map([...currentNodes, ...map.transformations.flatMap(change => change.futureNodes)].map(node => [node.id, node]));
    for (const id of [...ids]) {
        let parent = nodes.get(id)?.parentId;
        const seen = new Set([id]);
        while (parent && !seen.has(parent)) { ids.add(parent); seen.add(parent); parent = nodes.get(parent)?.parentId; }
    }
    return [...ids].sort();
}

export function transformationsForArchitecture(map: PlanningMap, nodeId: string, currentNodes: { id: string; parentId?: string }[] = []): string[] {
    return map.transformations.filter(change => affectedArchitecture(map, [change.id], currentNodes).includes(nodeId)).map(change => change.id);
}
