import type { ChatPlanningProposal, ChatRoadmapPreviewEntity } from '@dope/chat/lib/service';
import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { GatePlanningAction } from '@dope/project-intelligence/lib/node/project-planning-actions';

type Preview = NonNullable<ChatPlanningProposal['preview']>;
type Entity = Preview['entities'][number];
const limit = (value: string | undefined): string | undefined => value === undefined ? undefined :
    value.length > 320 ? `${value.slice(0, 319)}…` : value;
const parents = (before: RoadmapGateIndex, after: RoadmapGateIndex, entities: Entity[]): Record<string, string> => {
    const ids = new Set(entities.flatMap(item => [item.before?.parentId, item.after?.parentId]).filter(
        (id): id is string => !!id));
    return Object.fromEntries([...before.phases, ...after.phases, ...before.gates, ...after.gates]
        .filter(item => ids.has(item.id)).map(item => [item.id, limit(item.title)!]));
};

function find(index: RoadmapGateIndex, id: string): ChatRoadmapPreviewEntity | undefined {
    const phase = index.phases.find(item => item.id === id);
    if (phase) return { kind: 'phase', id, title: limit(phase.title), detail: limit(phase.objective),
        order: phase.order, dependencies: phase.dependencies.slice(0, 12) };
    const gate = index.gates.find(item => item.id === id);
    if (gate) return { kind: 'gate', id, title: limit(gate.title), detail: limit(gate.purpose),
        designation: limit(gate.designation), parentId: gate.parentPhaseId, order: gate.order,
        dependencies: gate.dependencies.slice(0, 12), criteria: gate.criteria.slice(0, 8).map(item => ({
            id: item.id, title: limit(item.title)!, expectedResult: limit(item.expectedResult)! })),
        additionalCriteria: Math.max(0, gate.criteria.length - 8) };
    for (const parent of index.gates) {
        const criterion = parent.criteria.find(item => item.id === id);
        if (criterion) return { kind: 'criterion', id, title: limit(criterion.title),
            detail: limit(criterion.expectedResult), parentId: parent.id, order: criterion.order };
    }
    const correction = index.corrections.find(item => item.id === id);
    if (correction) return { kind: 'correction', id, title: limit(correction.title),
        detail: limit(correction.objective), parentId: correction.parent.id, order: correction.order };
    return undefined;
}

/** Only validated owner snapshots enter this projection. No approval token or model envelope crosses to the UI. */
export function roadmapProposalPreview(before: RoadmapGateIndex, after: RoadmapGateIndex,
    actions: readonly GatePlanningAction[], changedIds: readonly string[]): Preview {
    const entities = changedIds.slice(0, 12).map(id => {
        const previous = find(before, id), next = find(after, id);
        const action = !previous ? 'create' : !next ? 'delete' : 'edit';
        return { id, action, before: previous, after: next } as Entity;
    });
    const steps = actions.map(action => {
        const ids = 'ids' in action ? action.ids : 'id' in action && action.id ? [action.id] :
            'gateId' in action ? [action.gateId] : [];
        const id = ids[0] ?? before.projectId;
        const entity = find(after, id) ?? find(before, id);
        return { type: action.type, id, title: entity?.title ?? id, affectedCount: ids.length };
    });
    return { source: 'validated-roadmap', steps, entities, totalChanged: changedIds.length,
        additionalChanges: Math.max(0, changedIds.length - entities.length),
        parentTitles: parents(before, after, entities) };
}

export function linkedRoadmapProposalPreview(before: RoadmapGateIndex, kind: 'phase' | 'gate' | 'criterion',
    id: string, lines: readonly { before: string; after: string }[]): Preview {
    const entity = find(before, id);
    const entities: Entity[] = [{ id, action: 'edit', before: entity, after: entity }];
    return { source: 'validated-markdown-patch', steps: [{ type: `${kind}.edit`, id,
        title: entity?.title ?? id, affectedCount: 1 }],
        entities, totalChanged: 1,
        additionalChanges: 0, parentTitles: parents(before, before, entities),
        sourceChanges: lines.slice(0, 8).map(line => ({ before: line.before.length > 8192 ?
            `${line.before.slice(0, 8191)}…` : line.before, after: line.after.length > 8192 ?
            `${line.after.slice(0, 8191)}…` : line.after })),
        additionalSourceChanges: Math.max(0, lines.length - 8) };
}
