import type { ChatPlanningProposal } from '@dope/chat/lib/service';

/** Resolve visible entities to pending server operations. A gate.create owns its embedded Criteria. */
export function proposalEntityOperations(proposal: ChatPlanningProposal, entityId: string,
    descendants = false): string[] {
    const pending = proposal.operations?.filter(operation => operation.status === 'Pending') ?? [];
    const entities = proposal.preview?.entities ?? [];
    const selected = new Set([entityId]);
    if (descendants) {
        let changed = true;
        while (changed) {
            changed = false;
            for (const entity of entities) {
                const parent = entity.after?.parentId ?? entity.before?.parentId;
                if (parent && selected.has(parent) && !selected.has(entity.id)) {
                    selected.add(entity.id); changed = true;
                }
                const gate = entity.after?.kind === 'gate' ? entity.after : undefined;
                if (gate && selected.has(gate.id)) for (const criterion of gate.criteria ?? []) {
                    if (!selected.has(criterion.id)) { selected.add(criterion.id); changed = true; }
                }
            }
        }
    }
    const owners = new Set(selected);
    for (const entity of entities) {
        const gate = entity.after?.kind === 'gate' ? entity.after : undefined;
        if (gate?.criteria?.some(criterion => selected.has(criterion.id) &&
            !proposal.operations?.some(operation => operation.targetId === criterion.id))) owners.add(gate.id);
    }
    return pending.filter(operation => owners.has(operation.targetId)).map(operation => operation.id);
}
