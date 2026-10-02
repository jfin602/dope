import { projectPath } from './architecture';
import type { Evidence, FlowCoverage, FlowDiagnostic, FlowEndpointIdentity, FlowEndpointKind, FlowInteractionKind, GraphNode, PhysicalFlowEndpoint, PhysicalFlowFact } from './contracts';

const interactions: FlowInteractionKind[] = ['receives', 'invokes', 'reads', 'writes', 'calls-external', 'publishes', 'consumes', 'responds'];
const endpointKinds: FlowEndpointKind[] = ['http-input', 'http-output', 'store', 'queue', 'event', 'job', 'external-service', 'external-client', 'file-store'];
const identityKeys: (keyof FlowEndpointIdentity)[] = ['protocol', 'method', 'path', 'service', 'store', 'channel', 'connection', 'sourceScope'];
const unique = (ids: string[]): string[] => [...new Set(ids)].sort();
const valid = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value === value.trim();
const fail = (what: string): never => { throw new Error(`Invalid Physical Map: ${what}`); };

function normalizedIdentity(kind: FlowEndpointKind, identity: FlowEndpointIdentity): FlowEndpointIdentity {
    if (!endpointKinds.includes(kind) || !identity || Object.keys(identity).some(key => !identityKeys.includes(key as keyof FlowEndpointIdentity))) fail('Flow endpoint identity');
    const result: FlowEndpointIdentity = {};
    for (const key of identityKeys) {
        const value = identity[key];
        if (value === undefined) continue;
        if (!valid(value)) fail('Flow endpoint identity');
        result[key] = ['protocol', 'method', 'service'].includes(key) ? value.toLowerCase() : value;
    }
    if (!Object.keys(result).length ||
        ['store', 'file-store'].includes(kind) && !result.connection && !result.sourceScope ||
        ['external-service', 'external-client'].includes(kind) && !result.service && !result.sourceScope ||
        ['queue', 'event', 'job'].includes(kind) && !result.channel && !result.sourceScope ||
        ['http-input', 'http-output'].includes(kind) && !(result.method && result.path) && !result.sourceScope) fail('Flow endpoint scope');
    return result;
}

export function flowEndpointId(kind: FlowEndpointKind, identity: FlowEndpointIdentity): string {
    return `flow:endpoint:${encodeURIComponent(kind)}:${encodeURIComponent(JSON.stringify(normalizedIdentity(kind, identity)))}`;
}
export function flowFactId(kind: FlowInteractionKind, sourceId: string, targetId: string, discriminator = '', observationId?: string): string {
    if (!interactions.includes(kind) || !valid(sourceId) || !valid(targetId) || typeof discriminator !== 'string' || discriminator !== discriminator.trim() ||
        observationId !== undefined && !valid(observationId)) fail('Flow fact identity');
    return `flow:fact:${[kind, sourceId, targetId, discriminator, observationId ?? ''].map(encodeURIComponent).join(':')}`;
}
/** Anonymous source callable, distinct from a named symbol and stable across analyses. */
export function anonymousCallableId(path: string, start: number, length: number): string {
    if (!Number.isSafeInteger(start) || start < 0 || !Number.isSafeInteger(length) || length < 0) fail('anonymous callable span');
    return `code:anonymous:${encodeURIComponent(projectPath(path))}:${start}:${length}`;
}

function physicalEvidence(ids: string[], evidence: Map<string, Evidence>, kind?: FlowInteractionKind): boolean {
    return ids.some(id => {
        const item = evidence.get(id);
        return item && (kind === undefined || item.flowKind === kind) &&
            (item.class === 'runtime' ? !!item.observationId : ['syntax', 'semantic', 'framework'].includes(item.class) && !!item.path && !!item.span);
    });
}

export function validateFlow(nodes: Map<string, GraphNode>, evidence: Map<string, Evidence>,
    endpoints: PhysicalFlowEndpoint[], facts: PhysicalFlowFact[], coverage: FlowCoverage[], diagnostics: FlowDiagnostic[]):
    Pick<import('./contracts').PhysicalMapSnapshot, 'flowEndpoints' | 'flowFacts' | 'flowCoverage' | 'flowDiagnostics'> {
    const byEndpoint = new Map<string, PhysicalFlowEndpoint>();
    for (const raw of endpoints) {
        if (!nodes.has(raw.anchorNodeId) || !Array.isArray(raw.evidenceIds) || !raw.evidenceIds.length ||
            raw.evidenceIds.some(id => !evidence.has(id)) || !raw.evidenceIds.some(id => evidence.get(id)?.flowKind && physicalEvidence([id], evidence)) ||
            raw.id !== flowEndpointId(raw.kind, raw.identity)) fail(`Flow endpoint ${raw.id}`);
        const item = { ...raw, identity: normalizedIdentity(raw.kind, raw.identity), evidenceIds: unique(raw.evidenceIds) };
        const prior = byEndpoint.get(item.id);
        if (prior) {
            if (prior.kind !== item.kind || prior.anchorNodeId !== item.anchorNodeId || JSON.stringify(prior.identity) !== JSON.stringify(item.identity)) fail(`conflicting Flow endpoint ${item.id}`);
            prior.evidenceIds = unique([...prior.evidenceIds, ...item.evidenceIds]);
        } else byEndpoint.set(item.id, item);
    }
    const known = (id: string): boolean => nodes.has(id) || byEndpoint.has(id);
    const byFact = new Map<string, PhysicalFlowFact>();
    for (const raw of facts) {
        if (!Array.isArray(raw.evidenceIds)) fail(`Flow fact ${raw.id}`);
        const directProof = raw.evidenceIds.filter(id => evidence.get(id)?.flowKind === raw.kind);
        const runtimeProof = directProof.filter(id => evidence.get(id)?.class === 'runtime');
        if (!known(raw.sourceId) || !known(raw.targetId) || !raw.evidenceIds.length ||
            raw.evidenceIds.some(id => !evidence.has(id)) || raw.id !== flowFactId(raw.kind, raw.sourceId, raw.targetId, raw.discriminator, raw.observationId) ||
            raw.originFlowFactIds !== undefined && (!raw.originFlowFactIds.length || raw.originFlowFactIds.some(id => !valid(id))) ||
            !raw.originFlowFactIds?.length && raw.evidenceIds.some(id => evidence.get(id)?.flowKind && evidence.get(id)?.flowKind !== raw.kind) ||
            !raw.originFlowFactIds?.length && !physicalEvidence(raw.evidenceIds, evidence, raw.kind) ||
            !raw.originFlowFactIds?.length && (raw.observationId !== undefined && (!runtimeProof.length || directProof.some(id => evidence.get(id)?.class !== 'runtime') ||
                runtimeProof.some(id => evidence.get(id)?.observationId !== raw.observationId)) ||
                raw.observationId === undefined && runtimeProof.length > 0)) fail(`Flow fact ${raw.id}`);
        const origins = raw.originFlowFactIds && unique(raw.originFlowFactIds);
        const enrichment = raw.enrichment?.map(item => {
            if (!['data', 'type', 'schema', 'event'].includes(item.kind) || !valid(item.label) || !Array.isArray(item.evidenceIds) ||
                !item.evidenceIds.length || item.evidenceIds.some(id => raw.evidenceIds.includes(id) || evidence.get(id)?.flowEnrichmentKind !== item.kind) ||
                !physicalEvidence(item.evidenceIds, evidence)) fail(`Flow enrichment ${raw.id}`);
            return { ...item, evidenceIds: unique(item.evidenceIds) };
        }).sort((a, b) => `${a.kind}:${a.label}`.localeCompare(`${b.kind}:${b.label}`));
        if (raw.behavior && !Array.isArray(raw.behavior.evidenceIds)) fail(`Flow behavior ${raw.id}`);
        const behavior = raw.behavior && { ...raw.behavior, evidenceIds: unique(raw.behavior.evidenceIds) };
        if (behavior && (!Array.isArray(raw.behavior!.evidenceIds) || !raw.behavior!.evidenceIds.length ||
            raw.behavior!.evidenceIds.some(id => raw.evidenceIds.includes(id) || !evidence.has(id)) ||
            !physicalEvidence(raw.behavior!.evidenceIds, evidence) ||
            (['async', 'retry', 'error'] as const).some(kind => behavior[kind] && !behavior.evidenceIds.some(id => evidence.get(id)?.flowBehavior === kind)) ||
            ![behavior.async, behavior.retry, behavior.error].some(value => value === true))) fail(`Flow behavior ${raw.id}`);
        const item = { ...raw, evidenceIds: unique(raw.evidenceIds), originFlowFactIds: origins, enrichment, behavior };
        const prior = byFact.get(item.id);
        if (prior) {
            const shape = (fact: PhysicalFlowFact): string => JSON.stringify([fact.kind, fact.sourceId, fact.targetId, fact.discriminator, fact.observationId,
                fact.originFlowFactIds, fact.enrichment?.map(e => [e.kind, e.label]), fact.behavior && [fact.behavior.async, fact.behavior.retry, fact.behavior.error]]);
            if (shape(prior) !== shape(item)) fail(`conflicting Flow fact ${item.id}`);
            prior.evidenceIds = unique([...prior.evidenceIds, ...item.evidenceIds]);
            prior.enrichment?.forEach((entry, index) => { entry.evidenceIds = unique([...entry.evidenceIds, ...item.enrichment![index].evidenceIds]); });
            if (prior.behavior) prior.behavior.evidenceIds = unique([...prior.behavior.evidenceIds, ...item.behavior!.evidenceIds]);
        } else byFact.set(item.id, item);
    }
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const visit = (id: string): void => {
        if (visiting.has(id)) fail(`Flow origin cycle ${id}`);
        if (visited.has(id)) return;
        const origins = byFact.get(id)?.originFlowFactIds;
        if (!byFact.has(id)) fail(`Flow origin ${id}`);
        visiting.add(id);
        for (const origin of origins ?? []) visit(origin);
        visiting.delete(id);
        visited.add(id);
    };
    for (const id of byFact.keys()) visit(id);
    const byDiagnostic = new Map<string, FlowDiagnostic>();
    for (const raw of diagnostics) {
        if (!valid(raw.id) || !valid(raw.code) || !valid(raw.message) || raw.scopeId && !known(raw.scopeId) ||
            !Array.isArray(raw.evidenceIds) || raw.evidenceIds.some(id => !evidence.has(id))) fail(`Flow diagnostic ${raw.id}`);
        const item = { ...raw, evidenceIds: unique(raw.evidenceIds) };
        if (byDiagnostic.has(item.id) && JSON.stringify(byDiagnostic.get(item.id)) !== JSON.stringify(item)) fail(`conflicting Flow diagnostic ${item.id}`);
        byDiagnostic.set(item.id, item);
    }
    const byCoverage = new Map<string, FlowCoverage>();
    for (const raw of coverage) {
        if (!known(raw.scopeId) || !['complete', 'partial', 'unsupported', 'truncated'].includes(raw.status) ||
            !Array.isArray(raw.diagnosticIds) || raw.diagnosticIds.some(id => !byDiagnostic.has(id))) fail(`Flow coverage ${raw.scopeId}`);
        const item = { ...raw, diagnosticIds: unique(raw.diagnosticIds) };
        if (byCoverage.has(item.scopeId) && JSON.stringify(byCoverage.get(item.scopeId)) !== JSON.stringify(item)) fail(`conflicting Flow coverage ${item.scopeId}`);
        byCoverage.set(item.scopeId, item);
    }
    const ordered = <T extends { id?: string; scopeId?: string }>(values: Map<string, T>): T[] => [...values.values()].sort((a, b) => (a.id ?? a.scopeId!).localeCompare(b.id ?? b.scopeId!));
    return { flowEndpoints: ordered(byEndpoint), flowFacts: ordered(byFact), flowDiagnostics: ordered(byDiagnostic), flowCoverage: ordered(byCoverage) };
}
