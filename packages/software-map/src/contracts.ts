/** Canonical developer state is read from .dope/architecture.json; snapshots are derived. */
export const ARCHITECTURE_PATH = '.dope/architecture.json';
export const ARCHITECTURE_SCHEMA_VERSION = 1;

export interface ArchitectureDeclaration {
    schemaVersion: 1;
    systems: SystemDeclaration[];
}
export interface DeclaredBoundary {
    id: string;
    name: string;
    purpose: string;
    roots?: string[];
}
export interface SystemDeclaration extends DeclaredBoundary { subsystems: SubsystemDeclaration[] }
export interface SubsystemDeclaration extends DeclaredBoundary {
    roots: string[];
    components?: ComponentDeclaration[];
    allowedDependencies?: string[];
    forbiddenDependencies?: string[];
}
export interface ComponentDeclaration extends DeclaredBoundary { roots: string[] }

export type NodeKind = 'project' | 'system' | 'subsystem' | 'component' | 'code';
export type CodeKind = 'file' | 'module' | 'symbol' | 'other';
export interface Ownership {
    state: 'assigned' | 'unassigned';
    systemId?: string;
    subsystemId?: string;
    componentId?: string;
    matchedRoot?: string;
}
export interface BaseNode { id: string; kind: NodeKind; name: string; parentId?: string; evidenceIds: string[] }
export interface ProjectNode extends BaseNode { kind: 'project' }
export interface SystemNode extends BaseNode { kind: 'system'; purpose: string }
export interface SubsystemNode extends BaseNode { kind: 'subsystem'; purpose: string }
export interface ComponentNode extends BaseNode { kind: 'component'; purpose: string }
export interface CodeEntityNode extends BaseNode {
    kind: 'code';
    codeKind: CodeKind;
    language?: string;
    analyzerKind?: string;
    path: string;
    symbol?: string;
    ownership: Ownership;
}
export type GraphNode = ProjectNode | SystemNode | SubsystemNode | ComponentNode | CodeEntityNode;

export type RelationshipKind = 'contains' | 'owns' | 'imports' | 'depends-on' | 'exports' | 'references' | 'extends' | 'implements';
export interface GraphRelationship {
    id: string;
    kind: RelationshipKind;
    sourceId: string;
    targetId: string;
    evidenceIds: string[];
    /** Present only on an aggregate; each ID names a concrete lower-level relationship. */
    originRelationshipIds?: string[];
}
export type EvidenceClass = 'declaration' | 'syntax' | 'semantic' | 'framework' | 'aggregate' | 'runtime' | 'inference';
export interface Evidence {
    id: string;
    class: EvidenceClass;
    producer: string;
    producerVersion: string;
    path?: string;
    span?: { start: number; length: number; line?: number; column?: number };
    symbol?: string;
    originRelationshipIds?: string[];
    observationId?: string;
    inferenceLabel?: string;
}
export interface AnalysisError { producer: string; code: string; message: string; path?: string }
export interface AnalysisStatus { completeness: 'complete' | 'partial' | 'failed'; errors: AnalysisError[] }
export interface SnapshotMetadata {
    generation: number;
    /** Stable fingerprint supplied by the coordinator for source, config and declaration inputs. */
    inputFingerprint: string;
    projectId: string;
    analysis: AnalysisStatus;
}
export interface PhysicalMapSnapshot {
    metadata: SnapshotMetadata;
    nodes: GraphNode[];
    relationships: GraphRelationship[];
    evidence: Evidence[];
    violations: ArchitectureViolation[];
}
export interface ArchitectureViolation {
    id: string;
    rule: 'forbidden-dependency' | 'unlisted-dependency';
    sourceSubsystemId: string;
    targetSubsystemId: string;
    originRelationshipIds: string[];
    evidenceIds: string[];
}

export interface HierarchyQuery { parentId?: string; descendants?: boolean }
export interface RelationshipQuery { nodeId: string; direction: 'incoming' | 'outgoing'; kinds?: RelationshipKind[] }
export interface EvidenceQuery { evidenceIds: string[] }
export interface ViolationQuery { subsystemId?: string; rule?: ArchitectureViolation['rule'] }
export interface QueryResult<T> { generation: number; items: T[] }
