import type { ChatPlanningProposal } from '@dope/chat/lib/service';

/** A decided operation remains in the saved proposal preview, but its entity now belongs to the accepted Roadmap. */
export function proposalPendingChanges(proposal: ChatPlanningProposal): NonNullable<ChatPlanningProposal['preview']>['entities'] {
    return (proposal.preview?.entities ?? []).filter(entity => proposalEntityOperations(proposal, entity.id).length > 0);
}

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
    return pending.filter(operation => owners.has(operation.targetId) ||
        ('targetIds' in operation && Array.isArray(operation.targetIds) &&
            operation.targetIds.some((id: unknown) => typeof id === 'string' && owners.has(id)))).map(operation => operation.id);
}

/** Close a visible review request over pending creators without adding unrelated branches. */
export function proposalReviewScope(proposal: ChatPlanningProposal, ids: readonly string[],
    decision: 'apply' | 'reject'): string[] {
    const pending = proposal.operations?.filter(item => item.status === 'Pending') ?? [];
    const selected = new Set(ids.filter(id => pending.some(item => item.id === id)));
    const entities = proposal.preview?.entities ?? [];
    const byId = new Map(entities.map(entity => [entity.id, entity]));
    let changed = true;
    while (changed) {
        changed = false;
        for (const item of pending) {
            const entity = byId.get(item.targetId);
            const parent = entity?.after?.parentId ?? entity?.before?.parentId;
            if (decision === 'apply' && selected.has(item.id) && parent) {
                for (const creator of pending.filter(candidate => candidate.targetId === parent &&
                    ['phase.create', 'gate.create', 'correction.attach'].includes(candidate.type))) {
                    if (!selected.has(creator.id)) { selected.add(creator.id); changed = true; }
                }
            }
            if (decision === 'reject' && !selected.has(item.id) &&
                pending.some(candidate => selected.has(candidate.id) && candidate.id !== item.id &&
                    (candidate.targetId === parent || candidate.targetId === item.targetId) &&
                    ['phase.create', 'gate.create', 'correction.attach'].includes(candidate.type))) {
                selected.add(item.id); changed = true;
            }
        }
    }
    return pending.filter(item => selected.has(item.id)).map(item => item.id);
}
