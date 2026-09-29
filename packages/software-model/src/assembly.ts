import { assignOwnership, aggregateDependencies, createSnapshot, relationshipId, validateSubsystemDependencies } from './graph';
import type { ArchitectureDeclaration, Evidence, ModelNode, ModelRelationship, PhysicalModelSnapshot, SnapshotMetadata } from './contracts';

export interface AnalyzedCode {
    nodes: Extract<ModelNode, { kind: 'code' }>[];
    relationships: ModelRelationship[];
    evidence: Evidence[];
}

/** Combine canonical declarations with source facts without persisting the result. */
export function assembleModel(metadata: SnapshotMetadata, architecture: ArchitectureDeclaration, code: AnalyzedCode): PhysicalModelSnapshot {
    const nodes: ModelNode[] = [{ id: metadata.projectId, kind: 'project', name: 'Project', evidenceIds: [] }];
    const relationships = [...code.relationships];
    const evidence = [...code.evidence];
    const addBoundary = (id: string, kind: 'system' | 'subsystem' | 'component', name: string, purpose: string, parentId: string): void => {
        const evidenceId = `declaration:${encodeURIComponent(id)}`;
        evidence.push({ id: evidenceId, class: 'declaration', producer: 'architecture', producerVersion: '1', path: '.dope/architecture.json' });
        nodes.push({ id, kind, name, purpose, parentId, evidenceIds: [evidenceId] });
        relationships.push({ id: relationshipId('contains', parentId, id), kind: 'contains', sourceId: parentId, targetId: id, evidenceIds: [evidenceId] });
    };
    for (const system of architecture.systems) {
        addBoundary(system.id, 'system', system.name, system.purpose, metadata.projectId);
        for (const subsystem of system.subsystems) {
            addBoundary(subsystem.id, 'subsystem', subsystem.name, subsystem.purpose, system.id);
            for (const component of subsystem.components ?? []) addBoundary(component.id, 'component', component.name, component.purpose, subsystem.id);
        }
    }
    for (const raw of code.nodes) {
        const node = assignOwnership(raw, architecture, metadata.projectId);
        nodes.push(node);
        if (node.codeKind === 'file' && node.ownership.state === 'assigned') {
            const owner = node.ownership.componentId ?? node.ownership.subsystemId ?? node.ownership.systemId!;
            relationships.push({ id: relationshipId('owns', owner, node.id), kind: 'owns', sourceId: owner, targetId: node.id,
                evidenceIds: [`declaration:${encodeURIComponent(owner)}`, ...node.evidenceIds] });
        }
    }
    const base = createSnapshot(metadata, nodes, relationships, evidence);
    const aggregates = (['component', 'subsystem', 'system'] as const).flatMap(level => aggregateDependencies(base, level));
    return createSnapshot(metadata, nodes, [...relationships, ...aggregates], evidence,
        validateSubsystemDependencies(architecture, aggregates.filter(edge => nodes.some(node => node.id === edge.sourceId && node.kind === 'subsystem'))));
}
