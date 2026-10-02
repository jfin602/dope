import { flowFactId } from './flow';
import type { FlowQuery, FlowQueryResult, GraphNode, PhysicalFlowFact, PhysicalMapSnapshot } from './contracts';

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
        const anchored = endpoints.get(id)?.anchorNodeId ?? id;
        const node = nodes.get(anchored);
        if (!node) return false;
        if (node.id === focus.id) return true;
        if (node.kind === 'code' && (focus.kind === 'system' || focus.kind === 'subsystem'))
            return node.ownership[focus.kind === 'system' ? 'systemId' : 'subsystemId'] === focus.id;
        for (let parent = node.parentId; parent; parent = nodes.get(parent)?.parentId) if (parent === focus.id) return true;
        return false;
    };
    if (query.selectedId && !inFocus(query.selectedId)) throw new Error('Flow selection outside focus');
    const facts = order(snapshot.flowFacts.filter(fact => !fact.observationId && !fact.originFlowFactIds?.length));
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
    if (query.selectedId && query.direction) {
        const start = query.selectedId;
        const seeds = nodes.get(start)?.kind === 'system' || nodes.get(start)?.kind === 'subsystem'
            ? unique([...nodes.keys(), ...endpoints.keys()].filter(inFocus)) : [start];
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
    } else {
        if (query.selectedId) visible.add(query.selectedId);
        for (const fact of facts) if (inFocus(fact.sourceId) || inFocus(fact.targetId)) add(fact);
    }
    const outputFacts = facts.filter(fact => selected.has(fact.id));
    const level = focus?.kind === 'system' ? 'subsystem' : focus?.kind === 'subsystem' ? 'component' : undefined;
    const owner = (id: string): string => {
        if (!level || endpoints.has(id)) return id;
        const node = nodes.get(id);
        if (node?.kind === 'code') return node.ownership[level === 'subsystem' ? 'subsystemId' : 'componentId'] ?? id;
        if (node?.kind === level) return id;
        for (let parent = node?.parentId; parent; parent = nodes.get(parent)?.parentId)
            if (nodes.get(parent)?.kind === level) return parent;
        return id;
    };
    // Each summary has exactly one proven origin. Do not merge separate routes or payload claims.
    const candidates = order(outputFacts.flatMap(fact => {
        const sourceId = owner(fact.sourceId), targetId = owner(fact.targetId);
        if (sourceId === fact.sourceId && targetId === fact.targetId || sourceId === targetId) return [];
        return [{ ...fact, id: flowFactId(fact.kind, sourceId, targetId, `aggregate:${fact.id}`),
            sourceId, targetId, discriminator: `aggregate:${fact.id}`, originFlowFactIds: [fact.id] }];
    }));
    const aggregates: PhysicalFlowFact[] = [];
    for (const fact of candidates) {
        if (outputFacts.length + aggregates.length >= maxFacts) { truncation.facts = true; frontier.add(fact.sourceId); continue; }
        const extra = unique([fact.sourceId, fact.targetId].filter(id => !visible.has(id)));
        if (visible.size + extra.length > maxNodes) { truncation.nodes = true; frontier.add(fact.sourceId); continue; }
        extra.forEach(id => visible.add(id));
        aggregates.push(fact);
    }
    const relevant = new Set([...visible, ...[...visible].map(owner)]);
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
        direction: query.direction, nodes: order([...visible].flatMap(id => nodes.has(id) ? [nodes.get(id)!] : [])),
        facts: outputFacts, aggregates, endpoints: order([...visible].flatMap(id => endpoints.has(id) ? [endpoints.get(id)!] : [])),
        coverage, coverageStatus, diagnostics, truncated: truncation.continueDeeper, truncation };
}
