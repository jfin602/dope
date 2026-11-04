import { evaluateGateQualification, evaluatePhaseQualification,
    type RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { ChatContextSelection } from '@dope/chat/lib/service';

/** Build one complete, selective payload from the current structured owner snapshot. */
export function roadmapElementContext(index: RoadmapGateIndex, selections: ChatContextSelection[],
    request = ''): string {
    if (!selections.length || selections.length > 20 || selections.some(item =>
        item.kind !== 'roadmap' || !item.elementKind || item.projectId !== index.projectId ||
        item.ownerRevision !== index.revision || item.sourceHash !== index.linkedDocument?.sourceHash))
        throw new Error('Stale or invalid Roadmap element selection; select the elements again');

    const entities = new Map<string, unknown>();
    const ancestors = new Map<string, unknown>();
    const selected = new Set<string>();
    // A field edit needs the current fields and exact identities, not archived
    // verification records. Keep those records for read-only and proof requests.
    const fieldEdit = /\b(?:change|edit|rename|set|update)\b/i.test(request) &&
        /\b(?:title|objective|purpose|expected\s+result)\b/i.test(request);
    const includeVerification = !fieldEdit ||
        /\b(?:evidence|qualification|qualify|status|pass|fail|green|verify|verification|proof|review)\b/i.test(request);
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
        const { evidence, ...fields } = value;
        entities.set(identity('criterion', id), { kind: 'criterion', parentGateId: parent.id,
            parentPhaseId: parent.parentPhaseId, publicationState: publication(parent.draftAcceptance), ...fields,
            ...(includeVerification ? { evidence } : {}) });
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
        const { qualificationSource, ...fields } = value;
        entities.set(identity('gate', id), { kind: 'gate', ...fields,
            publicationState: publication(value.draftAcceptance),
            criteria: undefined, criterionIds: value.criteria.map(item => item.id),
            ...(includeVerification ? { qualificationSource,
                actualQualification: evaluateGateQualification(value, qualificationSource) } : {}) });
        for (const item of value.criteria) addCriterion(id, item.id);
        for (const item of index.corrections.filter(item => item.parent.kind === 'gate' && item.parent.id === id))
            addCorrection(item.id);
    };
    const addPhase = (id: string) => {
        const value = phase(id);
        ancestors.delete(identity('phase', id));
        const { qualificationSource, ...fields } = value;
        entities.set(identity('phase', id), { kind: 'phase', ...fields,
            publicationState: publication(value.draftAcceptance),
            gateIds: index.gates.filter(item => item.parentPhaseId === id).map(item => item.id),
            correctionIds: index.corrections.filter(item => item.parent.kind === 'phase' && item.parent.id === id)
                .map(item => item.id),
            ...(includeVerification ? { qualificationSource,
                actualQualification: evaluatePhaseQualification(index, id, qualificationSource) } : {}) });
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
    // Relationship edits need complete sibling order, even when the user
    // selected just one element. Ordinary field edits keep sibling data out.
    const needsSiblingOrder = /\b(?:reorder|move|reparent|before|after)\b/i.test(request);
    const selectedGateIds = new Set(selections.flatMap(item => {
        if (item.elementKind === 'gate') return [item.id];
        if (item.elementKind === 'criterion') {
            const parent = index.gates.find(gate => gate.criteria.some(criterion => criterion.id === item.id));
            return parent ? [parent.id] : [];
        }
        return [];
    }));
    const siblingGateOrder = !needsSiblingOrder ? undefined :
        [...new Set([...selectedGateIds].map(id => gate(id).parentPhaseId))].map(parentPhaseId => ({
            parentPhaseId,
            gates: index.gates.filter(item => item.parentPhaseId === parentPhaseId)
                .sort((a, b) => a.order - b.order)
                .map(item => ({ id: item.id, designation: item.designation, order: item.order }))
        }));
    const siblingCriterionOrder = !needsSiblingOrder ? undefined : [...selectedGateIds].map(gateId => ({ gateId,
        criteria: gate(gateId).criteria.map(item => ({ id: item.id, order: item.order })) }));
    const movingToPhase = /\b(?:move|reparent)\b/i.test(request);
    const mentions = (value: string) => !!value && new RegExp(
        `(^|[^a-z0-9])${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`, 'i').test(request);
    const destinationPhases = !movingToPhase ? undefined : index.phases.filter(item =>
        mentions(item.id) || mentions(item.title)).map(item => ({
            id: item.id, title: item.title, objective: item.objective, order: item.order,
            dependencies: item.dependencies,
            siblingGates: index.gates.filter(gate => gate.parentPhaseId === item.id)
                .sort((a, b) => a.order - b.order)
                .map(gate => ({ id: gate.id, designation: gate.designation, order: gate.order }))
        }));
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
        ...(needsSiblingOrder ? { siblingGateOrder, siblingCriterionOrder } : {}),
        ...(movingToPhase ? { destinationPhases } : {}),
        unrecordedFields: ['description when absent', 'evidence when no evidence records exist']
    });
}
