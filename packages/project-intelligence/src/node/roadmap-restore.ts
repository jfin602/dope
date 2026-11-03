import { criterionHash } from './roadmap-gate-domain';
import type { Criterion, RoadmapGateIndex, RoadmapGate, RoadmapPhase } from './roadmap-gate-domain';

/** Only definitions cross the historical boundary. Current audit and review records stay current. */
export function restoreEditableStructure(current: RoadmapGateIndex, historical: RoadmapGateIndex): RoadmapGateIndex {
    if (current.projectId !== historical.projectId || current.projectRoot !== historical.projectRoot)
        throw new Error('Foreign Roadmap revision');
    const oldPhases = new Map(current.phases.map(item => [item.id, item]));
    const oldGates = new Map(current.gates.map(item => [item.id, item]));
    const oldCriteria = new Map(current.gates.flatMap(gate => gate.criteria.map(item => [item.id, item] as const)));
    const oldCorrections = new Map(current.corrections.map(item => [item.id, item]));
    const nextPhaseIds = new Set(historical.phases.map(item => item.id));
    const nextGateIds = new Set(historical.gates.map(item => item.id));
    const nextCriterionIds = new Set(historical.gates.flatMap(gate => gate.criteria.map(item => item.id)));
    for (const phase of current.phases) if (!nextPhaseIds.has(phase.id) &&
        (phase.gateSetCoverage.status === 'approved' || phase.exception || phase.qualificationSource))
        throw new Error(`Protected Phase review prevents removal: ${phase.id}`);
    for (const gate of current.gates) if (!nextGateIds.has(gate.id) &&
        (gate.waiver || gate.qualificationSource || gate.criteria.some(item => item.evidence.length)))
        throw new Error(`Protected Gate audit prevents removal: ${gate.id}`);
    for (const criterion of oldCriteria.values()) if (!nextCriterionIds.has(criterion.id) && criterion.evidence.length)
        throw new Error(`Protected criterion evidence prevents removal: ${criterion.id}`);

    const phases: RoadmapPhase[] = historical.phases.map(source => {
        const prior = oldPhases.get(source.id);
        const definition = { title: source.title, objective: source.objective, order: source.order,
            dependencies: structuredClone(source.dependencies) };
        if (!prior) return { id: source.id, projectId: current.projectId, ...definition,
            implementationStatus: 'unknown', qualificationStatus: 'unknown', draftAcceptance: 'accepted',
            gateSetCoverage: { status: 'unreviewed' } };
        const changed = JSON.stringify(definition) !== JSON.stringify({ title: prior.title,
            objective: prior.objective, order: prior.order, dependencies: prior.dependencies });
        if (changed && prior.exception) throw new Error(`Protected Phase waiver requires separate review: ${prior.id}`);
        return { ...structuredClone(prior), ...definition,
            ...(changed ? { gateSetCoverage: { status: 'unreviewed' } as const,
                qualificationStatus: prior.qualificationStatus === 'green' || prior.qualificationStatus === 'waived' ?
                    'stale' as const : 'unknown' as const } : {}) };
    });
    const gates: RoadmapGate[] = historical.gates.map(source => {
        const prior = oldGates.get(source.id);
        const criteria: Criterion[] = source.criteria.map(item => {
            const previous = oldCriteria.get(item.id);
            if (!previous) return { id: item.id, projectId: current.projectId, title: item.title,
                expectedResult: item.expectedResult, order: item.order, evidence: [] };
            const changed = criterionHash(previous) !== criterionHash(item) ||
                !prior?.criteria.some(entry => entry.id === item.id);
            return { ...structuredClone(previous), title: item.title, expectedResult: item.expectedResult,
                order: item.order, evidence: previous.evidence.map(evidence => changed ?
                    { ...structuredClone(evidence), validation: { status: 'stale' as const,
                        reason: 'Criterion definition changed by reviewed restore' } } : structuredClone(evidence)) };
        });
        const definition = { parentPhaseId: source.parentPhaseId, designation: source.designation,
            title: source.title, purpose: source.purpose, order: source.order,
            dependencies: structuredClone(source.dependencies), criteria };
        if (!prior) return { id: source.id, projectId: current.projectId, ...definition,
            implementationStatus: 'unknown', qualificationStatus: 'unknown', draftAcceptance: 'accepted' };
        const changed = JSON.stringify({ ...definition, criteria: criteria.map(item =>
            [item.id, item.title, item.expectedResult, item.order]) }) !== JSON.stringify({
            parentPhaseId: prior.parentPhaseId, designation: prior.designation, title: prior.title,
            purpose: prior.purpose, order: prior.order, dependencies: prior.dependencies,
            criteria: prior.criteria.map(item => [item.id, item.title, item.expectedResult, item.order]) });
        if (changed && prior.waiver) throw new Error(`Protected Gate waiver requires separate review: ${prior.id}`);
        return { ...structuredClone(prior), ...definition,
            ...(changed ? { qualificationStatus: prior.qualificationStatus === 'green' ||
                prior.qualificationStatus === 'waived' ? 'stale' as const : 'unknown' as const } : {}) };
    });
    const corrections = historical.corrections.map(source => {
        const prior = oldCorrections.get(source.id);
        const definition = { parent: structuredClone(source.parent), title: source.title,
            objective: source.objective, order: source.order,
            ...(source.criterionId ? { criterionId: source.criterionId } : {}) };
        if (!prior) return { id: source.id, projectId: current.projectId, ...definition,
            implementationStatus: 'unknown' as const, qualificationStatus: 'unknown' as const,
            draftAcceptance: 'accepted' as const };
        const copy = structuredClone(prior);
        delete copy.criterionId;
        return { ...copy, ...definition };
    });
    const result: RoadmapGateIndex = { ...structuredClone(current), revision: current.revision + 1,
        phases, gates, corrections };
    for (const phase of result.phases) {
        const old = oldPhases.get(phase.id);
        const ownedCorrections = (index: RoadmapGateIndex): unknown[] => index.corrections.filter(item =>
            (item.parent.kind === 'phase' ? item.parent.id :
                index.gates.find(gate => gate.id === item.parent.id)?.parentPhaseId) === phase.id)
            .map(item => [item.id, item.parent, item.criterionId, item.title, item.objective, item.order]);
        const oldGatesForPhase = current.gates.filter(item => item.parentPhaseId === phase.id)
            .map(item => [item.id, item.designation, item.title, item.purpose, item.order, item.dependencies,
                item.criteria.map(c => [c.id, c.title, c.expectedResult, c.order])]);
        const newGatesForPhase = result.gates.filter(item => item.parentPhaseId === phase.id)
            .map(item => [item.id, item.designation, item.title, item.purpose, item.order, item.dependencies,
                item.criteria.map(c => [c.id, c.title, c.expectedResult, c.order])]);
        if (JSON.stringify(oldGatesForPhase) !== JSON.stringify(newGatesForPhase) ||
            JSON.stringify(ownedCorrections(current)) !== JSON.stringify(ownedCorrections(result))) {
            if (phase.exception) throw new Error(`Protected Phase waiver requires separate review: ${phase.id}`);
            phase.gateSetCoverage = { status: 'unreviewed' };
            phase.qualificationStatus = old?.qualificationStatus === 'green' || old?.qualificationStatus === 'waived' ?
                'stale' : 'unknown';
        }
    }
    return result;
}

export function editableStructure(index: RoadmapGateIndex): unknown {
    return { phases: index.phases.map(item => [item.id, item.title, item.objective, item.order, item.dependencies]),
        gates: index.gates.map(item => [item.id, item.parentPhaseId, item.designation, item.title, item.purpose,
            item.order, item.dependencies, item.criteria.map(c => [c.id, c.title, c.expectedResult, c.order])]),
        corrections: index.corrections.map(item => [item.id, item.parent, item.criterionId,
            item.title, item.objective, item.order]) };
}

export function describeEditableChanges(current: RoadmapGateIndex, target: RoadmapGateIndex): string[] {
    const groups = [
        ['Phase', current.phases, target.phases, ['title', 'objective', 'order', 'dependencies']],
        ['Gate', current.gates, target.gates, ['parentPhaseId', 'designation', 'title', 'purpose', 'order', 'dependencies']],
        ['Criterion', current.gates.flatMap(gate => gate.criteria), target.gates.flatMap(gate => gate.criteria),
            ['title', 'expectedResult', 'order']],
        ['Correction', current.corrections, target.corrections,
            ['parent', 'criterionId', 'title', 'objective', 'order']],
    ] as const;
    const changes: string[] = [];
    for (const [kind, before, after, fields] of groups) {
        const old = new Map(before.map(item => [item.id, item]));
        const next = new Map(after.map(item => [item.id, item]));
        for (const key of new Set([...old.keys(), ...next.keys()])) {
            if (!old.has(key)) { changes.push(`${kind} ${key}: added`); continue; }
            if (!next.has(key)) { changes.push(`${kind} ${key}: removed`); continue; }
            const a = old.get(key)! as unknown as Record<string, unknown>;
            const b = next.get(key)! as unknown as Record<string, unknown>;
            for (const field of fields) if (JSON.stringify(a[field]) !== JSON.stringify(b[field]))
                changes.push(`${kind} ${key} ${field}: ${JSON.stringify(a[field] ?? null)} → ${JSON.stringify(b[field] ?? null)}`);
        }
    }
    return changes;
}
