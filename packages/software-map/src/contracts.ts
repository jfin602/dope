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
    /** Dedicated interaction proof; structural evidence alone is never Flow proof. */
    flowKind?: FlowInteractionKind;
    flowEnrichmentKind?: FlowEnrichment['kind'];
    flowBehavior?: 'async' | 'retry' | 'error';
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
    flowFacts: PhysicalFlowFact[];
    flowEndpoints: PhysicalFlowEndpoint[];
    flowCoverage: FlowCoverage[];
    flowDiagnostics: FlowDiagnostic[];
}
export type FlowInteractionKind = 'receives' | 'invokes' | 'reads' | 'writes' | 'calls-external' | 'publishes' | 'consumes' | 'responds';
export type FlowEndpointKind = 'http-input' | 'http-output' | 'store' | 'queue' | 'event' | 'job' | 'external-service' | 'external-client' | 'file-store';
/** Identity fields are evidence-backed. sourceScope keeps unidentified boundaries distinct. */
export interface FlowEndpointIdentity {
    protocol?: string;
    method?: string;
    path?: string;
    service?: string;
    store?: string;
    channel?: string;
    connection?: string;
    sourceScope?: string;
}
export interface PhysicalFlowEndpoint {
    id: string;
    kind: FlowEndpointKind;
    identity: FlowEndpointIdentity;
    anchorNodeId: string;
    evidenceIds: string[];
}
export interface FlowEnrichment {
    kind: 'data' | 'type' | 'schema' | 'event';
    label: string;
    evidenceIds: string[];
}
export interface FlowBehaviorMetadata {
    async?: boolean;
    retry?: boolean;
    error?: boolean;
    evidenceIds: string[];
}
export interface PhysicalFlowFact {
    id: string;
    kind: FlowInteractionKind;
    sourceId: string;
    targetId: string;
    /** Stable call site or observation discriminator, empty only for unique boundary facts. */
    discriminator: string;
    /** Required for an observed fact; keeps observation truth distinct from static possibility. */
    observationId?: string;
    evidenceIds: string[];
    /** Present only on an aggregate over existing lower-level Flow facts. */
    originFlowFactIds?: string[];
    enrichment?: FlowEnrichment[];
    behavior?: FlowBehaviorMetadata;
}
export interface FlowProjectionRelationship extends PhysicalFlowFact {
    /** System summaries keep differing detail semantics as separate evidenced variants. */
    projectionVariants?: { originFlowFactIds: string[]; enrichment?: FlowEnrichment[]; behavior?: FlowBehaviorMetadata }[];
    originParticipants?: { id: string; sourceId: string; targetId: string }[];
}
export interface FlowDiagnostic {
    id: string;
    code: string;
    message: string;
    scopeId?: string;
    evidenceIds: string[];
}
export interface FlowCoverage {
    scopeId: string;
    status: 'complete' | 'partial' | 'unsupported' | 'truncated';
    diagnosticIds: string[];
}
export interface FlowQuery {
    projectId: string;
    generation: number;
    /** Architectural scope or CodeEntity whose known Flow is shown. */
    focusId?: string;
    /** Selected GraphNode or derived endpoint. Omit to clear a trace. */
    selectedId?: string;
    direction?: 'upstream' | 'downstream';
    maxNodes?: number;
    maxFacts?: number;
    maxHops?: number;
}
export interface FlowQueryResult {
    kind: 'static';
    projectId: string;
    generation: number;
    inputFingerprint: string;
    focusId?: string;
    selectedId?: string;
    direction?: 'upstream' | 'downstream';
    nodes: GraphNode[];
    facts: PhysicalFlowFact[];
    /** Direct, one-hop architecture summaries. Traversal always uses facts. */
    aggregates: FlowProjectionRelationship[];
    projectionLevel: 'system' | 'subsystem' | 'detail';
    /** Derived overview participants; members retain selectable physical identities. */
    groups?: { id: string; name: string; memberIds: string[]; members: { id: string; name: string }[]; focusId?: string;
        role: 'Input' | 'Output' | 'Processing' }[];
    /** Semantic summarization is independent of incomplete analysis/query truncation. */
    aggregation?: { sourceFacts: number; shownRelationships: number; groupedParticipants: number; unassignedInvocations: number };
    endpoints: PhysicalFlowEndpoint[];
    coverage: FlowCoverage[];
    coverageStatus: FlowCoverage['status'] | 'unknown';
    diagnostics: FlowDiagnostic[];
    truncated: boolean;
    truncation: { nodes: boolean; facts: boolean; hops: boolean; continueDeeper: boolean; continueFromIds: string[] };
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
