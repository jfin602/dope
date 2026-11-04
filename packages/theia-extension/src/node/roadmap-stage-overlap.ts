import type { GatePlanningAction } from '@dope/project-intelligence/lib/node/project-planning-actions';

/** Direct mutations of the same entity cannot own separate inline review tabs. */
export function assertRoadmapStageTargets(operations: readonly { action: GatePlanningAction }[]): void {
    const directOwners = new Map<string, string>();
    for (const operation of operations) {
        const action = operation.action;
        const reorder = /\.(?:reorder)$/u.test(action.type);
        if (!/^(?:phase|gate|criterion|correction)\.(?:create|add|attach|edit|delete|remove|reparent|dependencies|reorder)$/u.test(action.type))
            continue;
        const ids = reorder && 'ids' in action ? action.ids : 'id' in action && action.id ? [action.id] : [];
        for (const id of ids) {
            const previous = directOwners.get(id);
            if (previous && !(reorder && /\.(?:create|add|attach)$/u.test(previous)))
                throw new Error('ROADMAP_STAGE_OVERLAPPING_TARGETS: use one direct operation per entity');
            if (!previous) directOwners.set(id, action.type);
        }
    }
}
