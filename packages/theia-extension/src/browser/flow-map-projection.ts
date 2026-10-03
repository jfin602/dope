import type { FlowProjectionRelationship, FlowQueryResult, PhysicalFlowEndpoint, PhysicalFlowFact } from '@dope/software-map';

export type FlowRole = 'Input' | 'Boundary' | 'Processing' | 'Store' | 'External' | 'Output';
export type FlowShape = 'entry' | 'boundary' | 'process' | 'store' | 'external' | 'exit' | 'queue';
export interface FlowCanvasNode {
    id: string; name: string; role: FlowRole; shape: FlowShape;
    x: number; y: number; width: number; height: number;
    selected: boolean; subdued: boolean;
}
export interface FlowCanvasEdge {
    id: string; source: string; target: string; kind: PhysicalFlowFact['kind']; label: string;
    originFlowFactIds: string[]; evidenceIds: string[];
    originParticipants: NonNullable<FlowProjectionRelationship['originParticipants']>;
    projectionVariants: NonNullable<FlowProjectionRelationship['projectionVariants']>;
    enrichment: { kind: 'data' | 'type' | 'schema' | 'event'; label: string; evidenceIds: string[] }[];
    behaviorEvidenceIds: string[];
    backEdge: boolean; async: boolean; retry: boolean; error: boolean;
    selected: boolean; subdued: boolean;
}
export interface FlowCanvasProjection {
    kind: FlowQueryResult['kind'];
    nodes: FlowCanvasNode[]; edges: FlowCanvasEdge[];
    coverageStatus: FlowQueryResult['coverageStatus'];
    coverage: FlowQueryResult['coverage']; diagnostics: FlowQueryResult['diagnostics'];
    truncated: boolean; truncation: FlowQueryResult['truncation'];
}
export interface FlowPresentation { selectedId?: string; traceFactIds?: readonly string[] }
export interface FlowArchitectureFocus { kind?: 'system' | 'subsystem' }

const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
const endpointName = (endpoint: PhysicalFlowEndpoint): string => {
    const { method, path } = endpoint.identity;
    return [[method, path].filter(Boolean).join(' '), ...(['protocol', 'service', 'store', 'channel', 'connection', 'sourceScope'] as const)
        .flatMap(key => endpoint.identity[key] ? [`${key}: ${endpoint.identity[key]}`] : [])].filter(Boolean).join(' · ') || endpoint.id;
};
const shapeOf = (role: FlowRole, endpoint?: PhysicalFlowEndpoint): FlowShape =>
    endpoint && ['queue', 'event', 'job'].includes(endpoint.kind) ? 'queue' :
        ({ Input: 'entry', Boundary: 'boundary', Processing: 'process', Store: 'store', External: 'external', Output: 'exit' } as const)[role];
const size = (name: string): { width: number; height: number } => {
    const longest = Math.max(1, ...name.split(/[\s/\\._:-]+/).map(part => part.length));
    const width = Math.max(200, Math.min(480, longest * 10 + 36));
    return { width, height: 64 + Math.ceil(name.length * 10 / (width - 32)) * 22 };
};

/** Disposable geometry over a bounded, generation-scoped Static Flow result. */
export function projectFlowMap(result: FlowQueryResult, focus: FlowArchitectureFocus = {}, presentation: FlowPresentation = {}): FlowCanvasProjection {
    const nodes = new Map(result.nodes.map(node => [node.id, node]));
    const endpoints = new Map(result.endpoints.map(endpoint => [endpoint.id, endpoint]));
    const groups = new Map((result.groups ?? []).map(group => [group.id, group]));
    const memberGroup = new Map((result.groups ?? []).flatMap(group => group.memberIds.map(id => [id, group.id] as const)));
    const systemOverview = (focus.kind ?? nodes.get(result.focusId ?? '')?.kind) === 'system';
    const owner = (id: string): string => {
        if (!systemOverview) return id;
        if (memberGroup.has(id)) return memberGroup.get(id)!;
        if (endpoints.has(id)) return id;
        const node = nodes.get(id);
        return node?.kind === 'code' ? node.ownership.subsystemId ?? id : id;
    };
    const facts = [...(result.projectionLevel === 'detail' ? result.facts : result.aggregates)]
        .sort((a, b) => compare(a.id, b.id));
    const shown = new Set(facts.flatMap(fact => [fact.sourceId, fact.targetId]));
    for (const group of result.groups ?? []) if (group.role === 'Processing') shown.add(group.id);
    if (result.selectedId && (nodes.has(result.selectedId) || endpoints.has(result.selectedId))) shown.add(result.selectedId);
    const selectedId = presentation.selectedId ?? result.selectedId;
    const trace = presentation.traceFactIds && new Set(presentation.traceFactIds);
    const emphasis = !!selectedId || !!trace;
    const activeFacts = new Set(facts.filter(fact => trace ? trace.has(fact.id) || fact.originFlowFactIds?.some(id => trace.has(id)) :
        selectedId && (fact.sourceId === selectedId || fact.targetId === selectedId ||
            owner(selectedId) === fact.sourceId || owner(selectedId) === fact.targetId)).map(fact => fact.id));
    const activeNodes = new Set(facts.filter(fact => activeFacts.has(fact.id)).flatMap(fact => [fact.sourceId, fact.targetId]));
    if (selectedId) activeNodes.add(selectedId);
    const canvasEdges: FlowCanvasEdge[] = facts.map(fact => ({
        id: fact.id, source: fact.sourceId, target: fact.targetId, kind: fact.kind,
        label: fact.kind.replaceAll('-', ' '), originFlowFactIds: [...(fact.originFlowFactIds ?? [fact.id])],
        originParticipants: (fact as FlowProjectionRelationship).originParticipants?.map(item => ({ ...item })) ?? [],
        projectionVariants: (fact as FlowProjectionRelationship).projectionVariants?.map(item => ({
            originFlowFactIds: [...item.originFlowFactIds], enrichment: item.enrichment?.map(value => ({ ...value, evidenceIds: [...value.evidenceIds] })),
            behavior: item.behavior && { ...item.behavior, evidenceIds: [...item.behavior.evidenceIds] }
        })) ?? [],
        evidenceIds: [...fact.evidenceIds],
        enrichment: fact.enrichment?.map(item => ({ ...item, evidenceIds: [...item.evidenceIds] })) ?? [],
        behaviorEvidenceIds: [...(fact.behavior?.evidenceIds ?? [])], backEdge: false,
        async: fact.behavior?.async === true, retry: fact.behavior?.retry === true, error: fact.behavior?.error === true,
        selected: activeFacts.has(fact.id), subdued: emphasis && !activeFacts.has(fact.id)
    }));
    const bySource = new Map<string, FlowCanvasEdge[]>();
    for (const edge of canvasEdges) bySource.set(edge.source, [...(bySource.get(edge.source) ?? []), edge]);
    const visited = new Set<string>(), visiting = new Set<string>(), finished: string[] = [];
    const visit = (id: string): void => {
        visiting.add(id);
        for (const edge of bySource.get(id) ?? []) {
            if (visiting.has(edge.target)) edge.backEdge = true;
            else if (!visited.has(edge.target)) visit(edge.target);
        }
        visiting.delete(id); visited.add(id); finished.push(id);
    };
    for (const id of [...shown].sort(compare)) if (!visited.has(id)) visit(id);
    const layer = new Map([...shown].map(id => [id, 0]));
    for (const id of finished.reverse()) for (const edge of bySource.get(id) ?? []) if (!edge.backEdge)
        layer.set(edge.target, Math.max(layer.get(edge.target) ?? 0, (layer.get(id) ?? 0) + 1));
    for (const edge of canvasEdges) if ((layer.get(edge.target) ?? 0) <= (layer.get(edge.source) ?? 0)) edge.backEdge = true;
    const inbound = new Set(canvasEdges.map(edge => edge.target));
    const outbound = new Set(canvasEdges.map(edge => edge.source));
    const canvasNodes: FlowCanvasNode[] = [...shown].map(id => {
        const endpoint = endpoints.get(id), node = nodes.get(id), group = groups.get(id);
        const role: FlowRole = group?.role ?? (endpoint?.kind === 'http-input' ? 'Input' : endpoint?.kind === 'http-output' ? 'Output' :
            endpoint && ['store', 'file-store'].includes(endpoint.kind) ? 'Store' :
            endpoint && ['external-service', 'external-client'].includes(endpoint.kind) ? 'External' :
            endpoint && ['queue', 'event', 'job'].includes(endpoint.kind) ? 'Boundary' :
            node && node.kind !== 'code' ? 'Processing' :
            !inbound.has(id) && outbound.has(id) ? 'Input' : inbound.has(id) && !outbound.has(id) ? 'Output' : 'Processing');
        const name = group?.name ?? (endpoint ? endpointName(endpoint) : node?.name ?? id);
        return { id, name, role, shape: shapeOf(role, endpoint), x: 0, y: 0, ...size(name),
            selected: !!selectedId && (id === selectedId || systemOverview && id === owner(selectedId)),
            subdued: emphasis && !activeNodes.has(id) };
    });
    const roleOrder: Record<FlowRole, number> = { Input: 0, Boundary: 1, Processing: 2, Store: 3, External: 4, Output: 5 };
    canvasNodes.sort((a, b) => (layer.get(a.id) ?? 0) - (layer.get(b.id) ?? 0) ||
        roleOrder[a.role] - roleOrder[b.role] || compare(a.name, b.name) || compare(a.id, b.id));
    const columns = new Map<number, FlowCanvasNode[]>();
    for (const node of canvasNodes) {
        const index = layer.get(node.id) ?? 0;
        columns.set(index, [...(columns.get(index) ?? []), node]);
    }
    let x = 32;
    for (const column of [...columns].sort(([a], [b]) => a - b).map(([, items]) => items)) {
        let y = 32;
        for (const node of column) { node.x = x; node.y = y; y += node.height + 32; }
        x += Math.max(...column.map(node => node.width)) + 96;
    }
    return { kind: result.kind, nodes: canvasNodes, edges: canvasEdges, coverageStatus: result.coverageStatus,
        coverage: result.coverage.map(item => ({ ...item, diagnosticIds: [...item.diagnosticIds] })),
        diagnostics: result.diagnostics.map(item => ({ ...item, evidenceIds: [...item.evidenceIds] })),
        truncated: result.truncated, truncation: { ...result.truncation, continueFromIds: [...result.truncation.continueFromIds] } };
}
