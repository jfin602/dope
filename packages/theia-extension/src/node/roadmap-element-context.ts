import { evaluateGateQualification, evaluatePhaseQualification,
    type RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { ChatContextSelection } from '@dope/chat/lib/service';

/** Build one complete, selective payload from the current structured owner snapshot. */
export function roadmapElementContext(index: RoadmapGateIndex, selections: ChatContextSelection[]): string {
    if (!selections.length || selections.length > 20 || selections.some(item =>
        item.kind !== 'roadmap' || !item.elementKind || item.projectId !== index.projectId ||
        item.ownerRevision !== index.revision || item.sourceHash !== index.linkedDocument?.sourceHash))
        throw new Error('Stale or invalid Roadmap element selection; select the elements again');

    const entities = new Map<string, unknown>();
    const ancestors = new Map<string, unknown>();
    const selected = new Set<string>();
    const identity = (kind: string, id: string) => `${kind}:${id}`;
    const publication = (state: 'proposed' | 'accepted' | 'published') =>
        state === 'published' ? 'canonical published' : state === 'accepted' ?
            'accepted draft, not yet canonical' : 'unaccepted draft';
    const phase = (id: string) => {
        const value = index.phases.find(item => item.id === id);
        if (!value) throw new Error('Selected Roadmap Phase is missing; select it again');
        return value;
    };
    const gate = (id: string) => {
        const value = index.gates.find(item => item.id === id);
        if (!value) throw new Error('Selected Roadmap Gate is missing; select it again');
        return value;
    };
    const addPhaseAncestor = (id: string) => {
        const value = phase(id), key = identity('phase', id);
        if (!entities.has(key)) ancestors.set(key, { kind: 'phase', id: value.id, title: value.title,
            objective: value.objective, order: value.order, draftAcceptance: value.draftAcceptance,
            publicationState: publication(value.draftAcceptance),
            qualificationStatus: value.qualificationStatus });
    };
    const addGateAncestor = (id: string) => {
        const value = gate(id), key = identity('gate', id);
        addPhaseAncestor(value.parentPhaseId);
        if (!entities.has(key)) ancestors.set(key, { kind: 'gate', id: value.id, parentPhaseId: value.parentPhaseId,
            designation: value.designation, title: value.title, purpose: value.purpose,
            draftAcceptance: value.draftAcceptance, publicationState: publication(value.draftAcceptance),
            qualificationStatus: value.qualificationStatus });
    };
    const addCriterion = (parentId: string, id: string) => {
        const parent = gate(parentId);
        const value = parent.criteria.find(item => item.id === id);
        if (!value) throw new Error('Selected Roadmap Criterion is missing; select it again');
        addGateAncestor(parent.id);
        entities.set(identity('criterion', id), { kind: 'criterion', parentGateId: parent.id,
            parentPhaseId: parent.parentPhaseId, publicationState: publication(parent.draftAcceptance), ...value });
    };
    const addCorrection = (id: string) => {
        const value = index.corrections.find(item => item.id === id);
        if (!value) throw new Error('Selected Roadmap Correction is missing; select it again');
        if (value.parent.kind === 'gate') addGateAncestor(value.parent.id);
        else addPhaseAncestor(value.parent.id);
        entities.set(identity('correction', id), { kind: 'correction', ...value,
            publicationState: publication(value.draftAcceptance) });
    };
    const addGate = (id: string) => {
        const value = gate(id);
        addPhaseAncestor(value.parentPhaseId);
        ancestors.delete(identity('gate', id));
        entities.set(identity('gate', id), { kind: 'gate', ...value,
            publicationState: publication(value.draftAcceptance),
            criteria: undefined, criterionIds: value.criteria.map(item => item.id),
            actualQualification: evaluateGateQualification(value, value.qualificationSource) });
        for (const item of value.criteria) addCriterion(id, item.id);
        for (const item of index.corrections.filter(item => item.parent.kind === 'gate' && item.parent.id === id))
            addCorrection(item.id);
    };
    const addPhase = (id: string) => {
        const value = phase(id);
        ancestors.delete(identity('phase', id));
        entities.set(identity('phase', id), { kind: 'phase', ...value,
            publicationState: publication(value.draftAcceptance),
            gateIds: index.gates.filter(item => item.parentPhaseId === id).map(item => item.id),
            correctionIds: index.corrections.filter(item => item.parent.kind === 'phase' && item.parent.id === id)
                .map(item => item.id),
            actualQualification: evaluatePhaseQualification(index, id, value.qualificationSource) });
        for (const item of index.gates.filter(item => item.parentPhaseId === id)) addGate(item.id);
        for (const item of index.corrections.filter(item => item.parent.kind === 'phase' && item.parent.id === id))
            addCorrection(item.id);
    };

    for (const item of selections) {
        const key = identity(item.elementKind!, item.id);
        if (selected.has(key)) throw new Error('Duplicate Roadmap element selection');
        selected.add(key);
        if (item.elementKind === 'phase') addPhase(item.id);
        else if (item.elementKind === 'gate') addGate(item.id);
        else if (item.elementKind === 'criterion') {
            const parent = index.gates.find(gate => gate.criteria.some(criterion => criterion.id === item.id));
            if (!parent) throw new Error('Selected Roadmap Criterion is missing; select it again');
            addCriterion(parent.id, item.id);
        } else if (item.elementKind === 'correction') addCorrection(item.id);
        else throw new Error('Unsupported Roadmap element selection');
    }
    const includedIds = new Set([...entities.keys()].map(key => key.slice(key.indexOf(':') + 1)));
    const linked = index.linkedDocument;
    return JSON.stringify({
        source: { projectId: index.projectId, projectRoot: index.projectRoot, ownerRevision: index.revision,
            linkedDocument: linked ? { path: linked.path, sourceHash: linked.sourceHash,
                syncState: linked.syncState,
                mappedSections: linked.sections.filter(item => includedIds.has(item.id)) } : null,
            publicationNote: linked ? 'Linked Markdown publication is separately reviewed' :
                'Accepted structure is not automatically published as Markdown' },
        selected: selections.map(item => ({ kind: item.elementKind, id: item.id })),
        ancestors: [...ancestors.values()], entities: [...entities.values()],
        unrecordedFields: ['description when absent', 'evidence when no evidence records exist']
    });
}
