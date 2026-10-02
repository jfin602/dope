import { flowFactId } from './flow';
import type { FlowProjectionRelationship, FlowQuery, FlowQueryResult, GraphNode, PhysicalFlowFact, PhysicalMapSnapshot } from './contracts';

const order = <T extends { id: string }>(items: T[]): T[] => items.sort((a, b) => a.id.localeCompare(b.id));
const unique = (items: string[]): string[] => [...new Set(items)].sort();

/** Query one published snapshot. Structural relationships never enter this traversal. */
export function queryStaticFlow(snapshot: PhysicalMapSnapshot, query: FlowQuery): FlowQueryResult {
    if (query.projectId !== snapshot.metadata.projectId || query.generation !== snapshot.metadata.generation)
        throw new Error('Stale Flow project or generation');
    const maxNodes = query.maxNodes ?? 100, maxFacts = query.maxFacts ?? 200, maxHops = query.maxHops ?? 32;
    if ([maxNodes, maxFacts, maxHops].some((value, i) => !Number.isSafeInteger(value) || value < 1 || value > [100, 200, 32][i]) ||
        query.direction && !['upstream', 'downstream'].includes(query.direction) || query.direction && !query.selectedId)
        throw new Error('Invalid Flow query');
    const nodes = new Map(snapshot.nodes.map(node => [node.id, node]));
    const endpoints = new Map(snapshot.flowEndpoints.map(endpoint => [endpoint.id, endpoint]));
    const focus = query.focusId ? nodes.get(query.focusId) : undefined;
    if (query.focusId && !['system', 'subsystem', 'component', 'code'].includes(focus?.kind ?? '')) throw new Error('Invalid Flow focus');
    if (query.selectedId && !nodes.has(query.selectedId) && !endpoints.has(query.selectedId)) throw new Error('Invalid Flow selection');
    const inFocus = (id: string): boolean => {
        if (!focus) return true;
        const node = nodes.get(id);
        if (!node) return false;
        if (node.id === focus.id) return true;
        if (node.kind === 'code' && (focus.kind === 'system' || focus.kind === 'subsystem'))
            return node.ownership[focus.kind === 'system' ? 'systemId' : 'subsystemId'] === focus.id;
        for (let parent = node.parentId; parent; parent = nodes.get(parent)?.parentId) if (parent === focus.id) return true;
        return false;
    };
    const facts = order(snapshot.flowFacts.filter(fact => !fact.observationId && !fact.originFlowFactIds?.length));
    const factInFocus = (fact: PhysicalFlowFact): boolean =>
        inFocus(fact.sourceId) || inFocus(fact.targetId);
    if (query.selectedId && focus && !inFocus(query.selectedId) &&
        !facts.some(fact => (fact.sourceId === query.selectedId || fact.targetId === query.selectedId) && factInFocus(fact)))
        throw new Error('Flow selection outside focus');
    const outgoing = new Map<string, PhysicalFlowFact[]>(), incoming = new Map<string, PhysicalFlowFact[]>();
    for (const fact of facts) {
        const from = outgoing.get(fact.sourceId) ?? [], to = incoming.get(fact.targetId) ?? [];
        from.push(fact); to.push(fact);
        outgoing.set(fact.sourceId, from); incoming.set(fact.targetId, to);
    }
    const selected = new Set<string>();
    const visible = new Set<string>();
    const frontier = new Set<string>();
    const truncation = { nodes: false, facts: false, hops: false, continueDeeper: false, continueFromIds: [] as string[] };
    const add = (fact: PhysicalFlowFact, fromId = fact.sourceId): boolean => {
        if (selected.has(fact.id)) return true;
        if (selected.size >= maxFacts) { truncation.facts = true; frontier.add(fromId); return false; }
        const added = unique([fact.sourceId, fact.targetId].filter(id => !visible.has(id)));
        if (visible.size + added.length > maxNodes) { truncation.nodes = true; frontier.add(fromId); return false; }
        selected.add(fact.id);
        added.forEach(id => visible.add(id));
        return true;
    };
    const overview = !!focus && !query.direction && (focus.kind === 'system' || focus.kind === 'subsystem');
    if (query.selectedId && query.direction) {
        const start = query.selectedId;
        const seeds = nodes.get(start)?.kind === 'system' || nodes.get(start)?.kind === 'subsystem'
            ? unique([...nodes.keys(), ...endpoints.keys()].filter(id => inFocus(id) ||
                facts.some(fact => (fact.sourceId === id || fact.targetId === id) && factInFocus(fact)))) : [start];
        const queue = seeds.map(id => ({ id, depth: 0 }));
        const visitedNodes = new Set(seeds);
        const visitedFacts = new Set<string>();
        visible.add(start);
        for (let position = 0; position < queue.length; position++) {
            const { id, depth } = queue[position];
            for (const fact of (query.direction === 'downstream' ? outgoing : incoming).get(id) ?? []) {
                if (visitedFacts.has(fact.id)) continue;
                visitedFacts.add(fact.id);
                if (depth >= maxHops) { truncation.hops = true; frontier.add(id); continue; }
                if (!add(fact, id)) continue;
                const next = query.direction === 'downstream' ? fact.targetId : fact.sourceId;
                if (!visitedNodes.has(next)) { visitedNodes.add(next); queue.push({ id: next, depth: depth + 1 }); }
            }
        }
    } else if (!overview) {
        if (query.selectedId) visible.add(query.selectedId);
        for (const fact of facts) if (factInFocus(fact)) add(fact);
    }
    const outputFacts = facts.filter(fact => selected.has(fact.id));
    const level = focus?.kind === 'system' ? 'subsystem' : focus?.kind === 'subsystem' ? 'component' : undefined;
    const unassignedId = `flow:group:unassigned:${focus?.id ?? ''}`;
    const owner = (id: string): string => {
        if (!level || endpoints.has(id)) return id;
        const node = nodes.get(id);
        if (node?.kind === 'code') {
            if (level === 'subsystem') return node.ownership.subsystemId ??
                (node.ownership.systemId === focus?.id ? focus!.id : unassignedId);
            if (node.ownership.componentId) return node.ownership.componentId;
            for (let parent = node.parentId; parent; parent = nodes.get(parent)?.parentId) {
                const ancestor = nodes.get(parent);
                if (ancestor?.kind === 'code' && ancestor.codeKind === 'file') return parent;
            }
            return id;
        }
        if (node?.kind === level) return id;
        for (let parent = node?.parentId; parent; parent = nodes.get(parent)?.parentId)
            if (nodes.get(parent)?.kind === level) return parent;
        return id;
    };
    const rawById = new Map(facts.map(fact => [fact.id, fact]));
    const priority = (visibleFact: PhysicalFlowFact): number => {
        const fact = rawById.get(visibleFact.originFlowFactIds?.[0] ?? visibleFact.id) ?? visibleFact;
        if (fact.kind === 'receives') return 0;
        if (fact.kind === 'responds') return 1;
        if (fact.kind !== 'invokes') return 2;
        const source = nodes.get(fact.sourceId), target = nodes.get(fact.targetId);
        return focus?.kind === 'subsystem' && source?.kind === 'code' && target?.kind === 'code' &&
            source.ownership.subsystemId === focus.id && target.ownership.subsystemId === focus.id ? 4 :
            owner(fact.sourceId) !== owner(fact.targetId) ? 3 : 4;
    };
    const semanticShape = (fact: Pick<PhysicalFlowFact, 'enrichment' | 'behavior'>): string => JSON.stringify([
        (fact.enrichment ?? []).map(item => [item.kind, item.label.trim()]).sort((a, b) =>
            JSON.stringify(a).localeCompare(JSON.stringify(b))),
        [fact.behavior?.async ?? false, fact.behavior?.retry ?? false, fact.behavior?.error ?? false]
    ]);
    const signature = (fact: PhysicalFlowFact, sourceId: string, targetId: string): string => JSON.stringify([
        sourceId, targetId, fact.kind, focus?.kind === 'system' ? '' : semanticShape(fact)
    ]);
    const participantGroups = new Map<string, { id: string; name: string; memberIds: string[]; members: { id: string; name: string }[];
        focusId?: string; role: 'Input' | 'Output' | 'Processing' }>();
    const visibleId = (id: string): string => {
        const mapped = owner(id);
        if (!overview || focus?.kind !== 'system') return mapped;
        const endpoint = endpoints.get(id);
        if (mapped !== unassignedId && endpoint?.kind !== 'http-input' && endpoint?.kind !== 'http-output') return mapped;
        const scopeId = endpoint ? focus.id : unassignedId;
        const scope = nodes.get(scopeId);
        const role = endpoint?.kind === 'http-input' ? 'Input' : endpoint?.kind === 'http-output' ? 'Output' : 'Processing';
        const groupId = endpoint ? `flow:group:${endpoint.kind}:${scopeId}` : unassignedId;
        const group = participantGroups.get(groupId) ?? { id: groupId,
            name: `${role === 'Processing' ? 'Unassigned code' : `${role}s · ${scope?.name ?? 'Unassigned code'}`}`,
            memberIds: [], members: [], focusId: scope?.kind === 'subsystem' ? scopeId : undefined, role };
        if (!group.memberIds.includes(id)) {
            group.memberIds.push(id);
            group.members.push({ id, name: endpoint ? `${endpoint.identity.method?.toUpperCase() ?? ''} ${endpoint.identity.path ?? id}`.trim() : nodes.get(id)?.name ?? id });
        }
        participantGroups.set(groupId, group);
        return groupId;
    };
    const groups = new Map<string, FlowProjectionRelationship>();
    let unassignedInvocations = 0;
    if (overview) for (const fact of facts.filter(factInFocus)) {
        const sourceId = visibleId(fact.sourceId), targetId = visibleId(fact.targetId);
        if (focus?.kind === 'system' && fact.kind === 'invokes' && (sourceId === unassignedId || targetId === unassignedId)) {
            // An unassigned code hop has no accepted architecture owner to connect on a System canvas.
            unassignedInvocations++;
            visible.add(unassignedId);
            continue;
        }
        if (sourceId === targetId) continue;
        const key = signature(fact, sourceId, targetId);
        const existing = groups.get(key);
        if (existing) {
            existing.originFlowFactIds = unique([...existing.originFlowFactIds!, fact.id]);
            existing.originParticipants!.push({ id: fact.id, sourceId: fact.sourceId, targetId: fact.targetId });
            existing.evidenceIds = unique([...existing.evidenceIds, ...fact.evidenceIds]);
            let variant = existing.projectionVariants!.find(item => semanticShape(item) === semanticShape(fact));
            if (!variant) {
                variant = { originFlowFactIds: [], enrichment: fact.enrichment?.map(item => ({ ...item, evidenceIds: [] })),
                    behavior: fact.behavior && { ...fact.behavior, evidenceIds: [] } };
                existing.projectionVariants!.push(variant);
            }
            variant.originFlowFactIds = unique([...variant.originFlowFactIds, fact.id]);
            variant.enrichment?.forEach(item => item.evidenceIds = unique([...item.evidenceIds,
                ...(fact.enrichment ?? []).filter(other => other.kind === item.kind && other.label.trim() === item.label.trim())
                    .flatMap(other => other.evidenceIds)]));
            if (variant.behavior) variant.behavior.evidenceIds = unique([...variant.behavior.evidenceIds, ...fact.behavior?.evidenceIds ?? []]);
            existing.enrichment = existing.projectionVariants!.length === 1 ? variant.enrichment : undefined;
            existing.behavior = existing.projectionVariants!.length === 1 ? variant.behavior : undefined;
        } else {
            const variant = { originFlowFactIds: [fact.id], enrichment: fact.enrichment?.map(item => ({ ...item, evidenceIds: [...item.evidenceIds] })),
                behavior: fact.behavior && { ...fact.behavior, evidenceIds: [...fact.behavior.evidenceIds] } };
            groups.set(key, { ...fact, id: flowFactId(fact.kind, sourceId, targetId, `overview:${key}`),
            sourceId, targetId, discriminator: `overview:${key}`, originFlowFactIds: [fact.id],
            evidenceIds: [...fact.evidenceIds],
            enrichment: variant.enrichment, behavior: variant.behavior, projectionVariants: [variant],
            originParticipants: [{ id: fact.id, sourceId: fact.sourceId, targetId: fact.targetId }] });
        }
    }
    const candidates = overview ? [...groups.values()].map(fact => ({ ...fact,
        originParticipants: fact.originParticipants!.sort((a, b) => a.id.localeCompare(b.id)),
        projectionVariants: fact.projectionVariants!.sort((a, b) => semanticShape(a).localeCompare(semanticShape(b)))
    })).sort((a, b) => priority(a) - priority(b) || a.id.localeCompare(b.id)) :
        order(outputFacts.flatMap(fact => {
            const sourceId = owner(fact.sourceId), targetId = owner(fact.targetId);
            if (sourceId === fact.sourceId && targetId === fact.targetId || sourceId === targetId) return [];
            return [{ ...fact, id: flowFactId(fact.kind, sourceId, targetId, `aggregate:${fact.id}`),
                sourceId, targetId, discriminator: `aggregate:${fact.id}`, originFlowFactIds: [fact.id] }];
        }));
    const aggregates: FlowProjectionRelationship[] = [];
    for (const fact of candidates) {
        if (outputFacts.length + aggregates.length >= maxFacts) { truncation.facts = true; frontier.add(fact.sourceId); continue; }
        const extra = unique([fact.sourceId, fact.targetId].filter(id => !visible.has(id)));
        if (visible.size + extra.length > maxNodes) { truncation.nodes = true; frontier.add(fact.sourceId); continue; }
        extra.forEach(id => visible.add(id));
        aggregates.push(fact);
    }
    const relevant = new Set([...visible, ...[...visible].map(owner)]);
    const shownGroups = [...participantGroups.values()].filter(group => visible.has(group.id)).map(group => ({ ...group,
        memberIds: unique(group.memberIds), members: group.members.sort((a, b) => a.id.localeCompare(b.id)) }))
        .sort((a, b) => a.id.localeCompare(b.id));
    const coverage = snapshot.flowCoverage.filter(item => !item.scopeId || relevant.has(item.scopeId) || inFocus(item.scopeId))
        .sort((a, b) => a.scopeId.localeCompare(b.scopeId));
    const diagnosticIds = new Set(coverage.flatMap(item => item.diagnosticIds));
    const diagnostics = order(snapshot.flowDiagnostics.filter(item => diagnosticIds.has(item.id) ||
        !item.scopeId || relevant.has(item.scopeId) || inFocus(item.scopeId)));
    truncation.continueDeeper = truncation.nodes || truncation.facts || truncation.hops;
    truncation.continueFromIds = [...frontier].sort();
    const coverageStatus = truncation.continueDeeper ? 'truncated' :
        coverage.some(item => item.status === 'unsupported') ? 'unsupported' :
        coverage.some(item => item.status === 'partial') || diagnostics.length ? 'partial' :
        coverage.length && coverage.every(item => item.status === 'complete') ? 'complete' : 'unknown';
    return { kind: 'static', projectId: snapshot.metadata.projectId, generation: snapshot.metadata.generation,
        inputFingerprint: snapshot.metadata.inputFingerprint, focusId: query.focusId, selectedId: query.selectedId,
        direction: query.direction, projectionLevel: overview ? focus!.kind as 'system' | 'subsystem' : 'detail',
        nodes: order([...visible].flatMap(id => nodes.has(id) ? [nodes.get(id)!] : [])),
        facts: outputFacts, aggregates, groups: shownGroups,
        aggregation: overview ? { sourceFacts: facts.filter(factInFocus).length, shownRelationships: aggregates.length,
            groupedParticipants: shownGroups.reduce((count, group) => count + group.memberIds.length, 0), unassignedInvocations } : undefined,
        endpoints: order([...visible].flatMap(id => endpoints.has(id) ? [endpoints.get(id)!] : [])),
        coverage, coverageStatus, diagnostics, truncated: truncation.continueDeeper, truncation };
}
