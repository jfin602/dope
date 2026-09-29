import type { AnalysisStatus, ArchitectureViolation, Evidence, ModelNode, ModelRelationship, RelationshipKind } from './contracts';

export const softwareModelServicePath = '/services/dope/software-model';
export const SoftwareModelService = Symbol('SoftwareModelService');

export interface ModelStatus {
    generation: number;
    publishedGeneration: number;
    state: 'idle' | 'analyzing' | 'ready' | 'failed';
    analysis: AnalysisStatus;
    inputFingerprint?: string;
    reusedSourceFiles: number;
    declarationPresent?: boolean;
}
export interface ModelPage<T> { generation: number; total: number; items: T[] }
export interface ModelPageRequest { projectHandle: string; offset?: number; limit?: number }
export interface ModelRelationshipRequest extends ModelPageRequest {
    nodeId: string;
    direction: 'incoming' | 'outgoing';
    kinds?: RelationshipKind[];
    scope?: 'direct' | 'aggregated' | 'all';
}
export interface ModelSourceLocation {
    uri: string;
    path: string;
    span?: Evidence['span'];
}
export interface SoftwareModelClient { notifySoftwareModelChanged(status: ModelStatus): void }
export interface SoftwareModelService {
    attach(folderUri: string): Promise<{ projectHandle: string; status: ModelStatus }>;
    analyze(projectHandle: string): Promise<ModelStatus>;
    status(projectHandle: string): Promise<ModelStatus>;
    hierarchy(request: ModelPageRequest & { parentId?: string; descendants?: boolean }): Promise<ModelPage<ModelNode>>;
    node(projectHandle: string, nodeId: string): Promise<{ generation: number; item?: ModelNode }>;
    relationships(request: ModelRelationshipRequest): Promise<ModelPage<ModelRelationship>>;
    relationshipEdges(request: ModelPageRequest & { relationshipIds: string[] }): Promise<ModelPage<ModelRelationship>>;
    evidence(request: ModelPageRequest & { evidenceIds: string[] }): Promise<ModelPage<Evidence>>;
    violations(request: ModelPageRequest & { subsystemId?: string; rule?: ArchitectureViolation['rule'] }): Promise<ModelPage<ArchitectureViolation>>;
    resolveSource(projectHandle: string, evidenceId: string): Promise<ModelSourceLocation | undefined>;
}
