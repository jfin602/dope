import { ownershipForPath, projectPath } from './architecture';
import type { ArchitectureDeclaration, ArchitectureViolation, CodeEntityNode, Evidence, ModelNode, ModelRelationship, NodeKind, PhysicalModelSnapshot, RelationshipKind, SnapshotMetadata, SubsystemDeclaration } from './contracts';

function invalid(message: string): never { throw new Error(`Invalid physical model: ${message}`); }
function name(value: unknown): value is string { return typeof value === 'string' && !!value.trim() && value === value.trim(); }
function sortedUnique(values: string[]): string[] { return [...new Set(values)].sort(); }
function same(a: unknown, b: unknown): boolean { return JSON.stringify(a) === JSON.stringify(b); }
const kinds: NodeKind[] = ['project', 'system', 'subsystem', 'component', 'code'];
const relations: RelationshipKind[] = ['contains', 'owns', 'imports', 'depends-on', 'exports', 'references', 'extends', 'implements'];

/** Derived IDs use semantic parts; renames and moves intentionally change identity. */
export function derivedId(kind: 'file' | 'module' | 'symbol', path: string, symbol?: string): string {
    const normalized = projectPath(path);
    if (kind === 'symbol' && !name(symbol)) invalid('symbol identity');
    if (kind !== 'symbol' && symbol !== undefined) invalid('unexpected symbol identity');
    return `code:${kind}:${encodeURIComponent(normalized)}${symbol === undefined ? '' : `:${encodeURIComponent(symbol)}`}`;
}
export function relationshipId(kind: RelationshipKind, sourceId: string, targetId: string, discriminator = ''): string {
    if (!relations.includes(kind) || !name(sourceId) || !name(targetId)) invalid('relationship identity');
    return `edge:${[kind, sourceId, targetId, discriminator].map(encodeURIComponent).join(':')}`;
}

export function assignOwnership(node: CodeEntityNode, architecture: ArchitectureDeclaration, projectId: string): CodeEntityNode {
    const ownership = ownershipForPath(architecture, node.path);
    return { ...node, ownership, parentId: ownership.componentId ?? ownership.subsystemId ?? ownership.systemId ?? projectId };
}

function validateEvidence(value: Evidence): Evidence {
    if (!name(value.id) || !name(value.producer) || !name(value.producerVersion) ||
        !['declaration', 'syntax', 'semantic', 'framework', 'aggregate', 'runtime', 'inference'].includes(value.class)) invalid('evidence identity/class/producer');
    if (value.path !== undefined) projectPath(value.path);
    if (value.span && (!Number.isSafeInteger(value.span.start) || value.span.start < 0 || !Number.isSafeInteger(value.span.length) || value.span.length < 0 ||
        value.path === undefined || value.span.line !== undefined && (!Number.isSafeInteger(value.span.line) || value.span.line < 1) ||
        value.span.column !== undefined && (!Number.isSafeInteger(value.span.column) || value.span.column < 1))) invalid(`evidence span ${value.id}`);
    if (['syntax', 'semantic', 'framework'].includes(value.class) && !value.path) invalid(`source evidence path ${value.id}`);
    if (value.class === 'aggregate' && !value.originRelationshipIds?.length) invalid(`aggregate origins ${value.id}`);
    if (value.class === 'runtime' && !name(value.observationId)) invalid(`runtime observation ${value.id}`);
    if (value.class === 'inference' && !name(value.inferenceLabel)) invalid(`inference label ${value.id}`);
    return { ...value, originRelationshipIds: value.originRelationshipIds && sortedUnique(value.originRelationshipIds) };
}

/** Validates references and returns stable, deduplicated, read-only-friendly arrays. */
export function createSnapshot(metadata: SnapshotMetadata, nodes: ModelNode[], relationships: ModelRelationship[], evidence: Evidence[], violations: ArchitectureViolation[] = []): PhysicalModelSnapshot {
    if (!name(metadata.projectId) || !name(metadata.inputFingerprint) || !Number.isSafeInteger(metadata.generation) || metadata.generation < 0 ||
        !['complete', 'partial', 'failed'].includes(metadata.analysis.completeness) || !Array.isArray(metadata.analysis.errors) ||
        metadata.analysis.completeness === 'complete' && metadata.analysis.errors.length) invalid('metadata');
    const byEvidence = new Map<string, Evidence>();
    for (const raw of evidence) {
        const entry = validateEvidence(raw);
        if (byEvidence.has(entry.id)) invalid(`duplicate evidence ${entry.id}`);
        byEvidence.set(entry.id, entry);
    }
    const byNode = new Map<string, ModelNode>();
    for (const raw of nodes) {
        if (!name(raw.id) || !name(raw.name) || !kinds.includes(raw.kind) || !Array.isArray(raw.evidenceIds) ||
            raw.kind !== 'project' && !raw.evidenceIds.length || raw.evidenceIds.some(id => !byEvidence.has(id))) invalid(`node ${raw.id}`);
        if (raw.kind === 'code') {
            projectPath(raw.path);
            if (!['file', 'module', 'symbol', 'other'].includes(raw.codeKind) ||
                !['assigned', 'unassigned'].includes(raw.ownership.state) ||
                raw.ownership.state === 'unassigned' && (raw.ownership.systemId || raw.ownership.subsystemId || raw.ownership.componentId) ||
                raw.ownership.state === 'assigned' && !raw.ownership.systemId ||
                !raw.evidenceIds.some(id => ['syntax', 'semantic', 'framework', 'runtime'].includes(byEvidence.get(id)!.class))) invalid(`code node ${raw.id}`);
        }
        if (byNode.has(raw.id)) invalid(`duplicate node ${raw.id}`);
        byNode.set(raw.id, { ...raw, evidenceIds: sortedUnique(raw.evidenceIds) });
    }
    if (byNode.get(metadata.projectId)?.kind !== 'project') invalid('project node');
    for (const node of byNode.values()) {
        if (node.id !== metadata.projectId && (!node.parentId || !byNode.has(node.parentId))) invalid(`parent ${node.id}`);
        const allowed: Record<NodeKind, NodeKind[]> = { project: [], system: ['project'], subsystem: ['system'], component: ['subsystem'], code: ['project', 'system', 'subsystem', 'component', 'code'] };
        if (node.parentId && !allowed[node.kind].includes(byNode.get(node.parentId)!.kind)) invalid(`hierarchy ${node.id}`);
        if (node.kind === 'code') {
            const ownership = node.ownership;
            for (const [id, kind] of [[ownership.systemId, 'system'], [ownership.subsystemId, 'subsystem'], [ownership.componentId, 'component']] as const) {
                if (id && byNode.get(id)?.kind !== kind) invalid(`ownership ${node.id}`);
            }
            if (ownership.subsystemId && byNode.get(ownership.subsystemId)?.parentId !== ownership.systemId ||
                ownership.componentId && byNode.get(ownership.componentId)?.parentId !== ownership.subsystemId) invalid(`ownership hierarchy ${node.id}`);
        }
        const visited = new Set<string>([node.id]);
        for (let parent = node.parentId; parent; parent = byNode.get(parent)?.parentId) {
            if (visited.has(parent)) invalid(`hierarchy cycle ${node.id}`);
            visited.add(parent);
        }
    }
    const byRelationship = new Map<string, ModelRelationship>();
    for (const raw of relationships) {
        if (!name(raw.id) || !relations.includes(raw.kind) || !byNode.has(raw.sourceId) || !byNode.has(raw.targetId) ||
            !raw.evidenceIds.length || raw.evidenceIds.some(id => !byEvidence.has(id))) invalid(`relationship ${raw.id}`);
        if (['imports', 'depends-on', 'exports', 'references', 'extends', 'implements'].includes(raw.kind) && !raw.originRelationshipIds?.length &&
            !raw.evidenceIds.some(id => ['syntax', 'semantic', 'framework', 'runtime'].includes(byEvidence.get(id)!.class))) invalid(`physical relationship evidence ${raw.id}`);
        const entry = { ...raw, evidenceIds: sortedUnique(raw.evidenceIds), originRelationshipIds: raw.originRelationshipIds && sortedUnique(raw.originRelationshipIds) };
        const prior = byRelationship.get(entry.id);
        if (prior) {
            if (prior.kind !== entry.kind || prior.sourceId !== entry.sourceId || prior.targetId !== entry.targetId ||
                !same(prior.originRelationshipIds, entry.originRelationshipIds)) invalid(`conflicting relationship ${entry.id}`);
            prior.evidenceIds = sortedUnique([...prior.evidenceIds, ...entry.evidenceIds]);
        } else byRelationship.set(entry.id, entry);
    }
    for (const edge of byRelationship.values()) {
        if (edge.originRelationshipIds?.some(id => id === edge.id || !byRelationship.has(id))) invalid(`missing origin ${edge.id}`);
    }
    for (const item of byEvidence.values()) {
        if (item.originRelationshipIds?.some(id => !byRelationship.has(id))) invalid(`evidence origin ${item.id}`);
    }
    const byViolation = new Map<string, ArchitectureViolation>();
    for (const raw of violations) {
        if (!name(raw.id) || !['forbidden-dependency', 'unlisted-dependency'].includes(raw.rule) ||
            byNode.get(raw.sourceSubsystemId)?.kind !== 'subsystem' || byNode.get(raw.targetSubsystemId)?.kind !== 'subsystem' ||
            raw.sourceSubsystemId === raw.targetSubsystemId || !raw.originRelationshipIds.length || !raw.evidenceIds.length ||
            raw.originRelationshipIds.some(id => !byRelationship.has(id)) || raw.evidenceIds.some(id => !byEvidence.has(id)) ||
            byViolation.has(raw.id)) invalid(`violation ${raw.id}`);
        byViolation.set(raw.id, { ...raw, originRelationshipIds: sortedUnique(raw.originRelationshipIds), evidenceIds: sortedUnique(raw.evidenceIds) });
    }
    return {
        metadata,
        nodes: [...byNode.values()].sort((a, b) => a.id.localeCompare(b.id)),
        relationships: [...byRelationship.values()].sort((a, b) => a.id.localeCompare(b.id)),
        evidence: [...byEvidence.values()].sort((a, b) => a.id.localeCompare(b.id)),
        violations: [...byViolation.values()].sort((a, b) => a.id.localeCompare(b.id)),
    };
}

export function hierarchy(snapshot: PhysicalModelSnapshot, parentId: string, descendants = false): ModelNode[] {
    const ids = new Set([parentId]);
    if (descendants) {
        let priorSize: number;
        do {
            priorSize = ids.size;
            for (const node of snapshot.nodes) if (node.parentId && ids.has(node.parentId)) ids.add(node.id);
        } while (ids.size !== priorSize);
    }
    return snapshot.nodes.filter(node => node.parentId && ids.has(node.parentId) && node.id !== parentId);
}
export function relationshipsFor(snapshot: PhysicalModelSnapshot, nodeId: string, direction: 'incoming' | 'outgoing', kinds?: RelationshipKind[]): ModelRelationship[] {
    return snapshot.relationships.filter(edge => (direction === 'incoming' ? edge.targetId : edge.sourceId) === nodeId && (!kinds || kinds.includes(edge.kind)));
}

type Level = 'system' | 'subsystem' | 'component';
function owner(node: ModelNode, level: Level): string | undefined {
    if (node.kind === level) return node.id;
    if (node.kind === 'code') return node.ownership[`${level}Id`];
    return undefined;
}
/** Aggregates only concrete lower-level dependency edges and keeps every origin/evidence ID. */
export function aggregateDependencies(snapshot: PhysicalModelSnapshot, level: Level): ModelRelationship[] {
    const nodes = new Map(snapshot.nodes.map(node => [node.id, node]));
    const groups = new Map<string, ModelRelationship>();
    for (const edge of snapshot.relationships) {
        if (!['imports', 'depends-on', 'references', 'extends', 'implements'].includes(edge.kind) || edge.originRelationshipIds?.length) continue;
        const source = owner(nodes.get(edge.sourceId)!, level);
        const target = owner(nodes.get(edge.targetId)!, level);
        if (!source || !target || source === target) continue;
        const id = relationshipId('depends-on', source, target, `aggregate:${level}`);
        const group = groups.get(id) ?? { id, kind: 'depends-on', sourceId: source, targetId: target, evidenceIds: [], originRelationshipIds: [] };
        group.evidenceIds.push(...edge.evidenceIds);
        group.originRelationshipIds!.push(edge.id);
        groups.set(id, group);
    }
    return [...groups.values()].map(edge => ({ ...edge, evidenceIds: sortedUnique(edge.evidenceIds), originRelationshipIds: sortedUnique(edge.originRelationshipIds!) })).sort((a, b) => a.id.localeCompare(b.id));
}

export function validateSubsystemDependencies(architecture: ArchitectureDeclaration, aggregates: ModelRelationship[]): ArchitectureViolation[] {
    const subsystems = new Map<string, SubsystemDeclaration>();
    for (const system of architecture.systems) for (const subsystem of system.subsystems) subsystems.set(subsystem.id, subsystem);
    const violations: ArchitectureViolation[] = [];
    for (const edge of aggregates) {
        const source = subsystems.get(edge.sourceId);
        if (!source || !subsystems.has(edge.targetId) || edge.sourceId === edge.targetId) continue;
        const rule = source.forbiddenDependencies?.includes(edge.targetId) ? 'forbidden-dependency' :
            source.allowedDependencies !== undefined && !source.allowedDependencies.includes(edge.targetId) ? 'unlisted-dependency' : undefined;
        if (rule) violations.push({
            id: `violation:${encodeURIComponent(rule)}:${encodeURIComponent(edge.sourceId)}:${encodeURIComponent(edge.targetId)}`,
            rule, sourceSubsystemId: edge.sourceId, targetSubsystemId: edge.targetId,
            originRelationshipIds: sortedUnique(edge.originRelationshipIds ?? [edge.id]), evidenceIds: sortedUnique(edge.evidenceIds),
        });
    }
    return violations.sort((a, b) => a.id.localeCompare(b.id));
}
