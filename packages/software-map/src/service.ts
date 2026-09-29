import type { AnalysisStatus, ArchitectureViolation, Evidence, GraphNode, GraphRelationship, RelationshipKind } from './contracts';

export const softwareMapServicePath = '/services/dope/software-map';
export const SoftwareMapService = Symbol('SoftwareMapService');

export interface SoftwareMapStatus {
    generation: number;
    publishedGeneration: number;
    state: 'idle' | 'analyzing' | 'ready' | 'failed';
    analysis: AnalysisStatus;
    inputFingerprint?: string;
    reusedSourceFiles: number;
    declarationPresent?: boolean;
}
export interface SoftwareMapPage<T> { generation: number; total: number; items: T[] }
export interface SoftwareMapPageRequest { projectHandle: string; offset?: number; limit?: number }
export interface SoftwareMapRelationshipRequest extends SoftwareMapPageRequest {
    nodeId: string;
    direction: 'incoming' | 'outgoing';
    kinds?: RelationshipKind[];
    scope?: 'direct' | 'aggregated' | 'all';
}
export interface SoftwareMapSourceLocation {
    uri: string;
    path: string;
    span?: Evidence['span'];
}
export interface SoftwareMapClient { notifySoftwareMapChanged(status: SoftwareMapStatus): void }
export interface SoftwareMapService {
    attach(folderUri: string): Promise<{ projectHandle: string; status: SoftwareMapStatus }>;
    analyze(projectHandle: string): Promise<SoftwareMapStatus>;
    status(projectHandle: string): Promise<SoftwareMapStatus>;
    hierarchy(request: SoftwareMapPageRequest & { parentId?: string; descendants?: boolean }): Promise<SoftwareMapPage<GraphNode>>;
    node(projectHandle: string, nodeId: string): Promise<{ generation: number; item?: GraphNode }>;
    relationships(request: SoftwareMapRelationshipRequest): Promise<SoftwareMapPage<GraphRelationship>>;
    relationshipEdges(request: SoftwareMapPageRequest & { relationshipIds: string[] }): Promise<SoftwareMapPage<GraphRelationship>>;
    evidence(request: SoftwareMapPageRequest & { evidenceIds: string[] }): Promise<SoftwareMapPage<Evidence>>;
    violations(request: SoftwareMapPageRequest & { subsystemId?: string; rule?: ArchitectureViolation['rule'] }): Promise<SoftwareMapPage<ArchitectureViolation>>;
    resolveSource(projectHandle: string, evidenceId: string): Promise<SoftwareMapSourceLocation | undefined>;
}
