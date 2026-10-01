import type { AnalysisStatus, ArchitectureViolation, Evidence, GraphNode, GraphRelationship, RelationshipKind } from './contracts';
import type { ArchitectureDeclaration } from './contracts';
import type { ArchitectureEvidencePacket, ArchitectureProposal, ProposedArchitectureKind } from './synthesis';
import type { AnalysisProgressEvent, SynthesisCallAttempt } from './hierarchical-synthesis';
import type { TargetedRefinementInput, TargetedRefinementResult } from './refinement';

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
export interface SoftwareMapClient {
    notifySoftwareMapChanged(status: SoftwareMapStatus): void;
    /** P7 orchestration will emit these events; clients must not infer progress from provider logs. */
    notifySoftwareMapAnalysisProgress?(projectHandle: string, event: AnalysisProgressEvent): void;
}
export interface SoftwareMapInitializationStatus {
    state: 'uninitialized' | 'analyzing' | 'failed' | 'review_required' | 'initialized';
    declarationPresent: boolean;
    /** Hash of the exact declaration bytes, or the absent-file sentinel. Supply it on manual acceptance. */
    declarationFingerprint: string;
    bootstrap?: { modules: boolean; readme: boolean };
    resumable?: { runId: string; failedStage?: string; failedSubject?: string;
        failedProviderKind?: 'local' | 'gemini'; failedModelLabel?: string; message: string;
        completed: { stage: string; subject?: string; providerKind: 'local' | 'gemini'; modelLabel: string }[] };
}
export interface ArchitectureReviewNode {
    proposalKey: string;
    kind: ProposedArchitectureKind;
    id: string;
    name: string;
    purpose: string;
    parentProposalKey: string | null;
    roots: string[];
}
export interface ArchitectureReview {
    reviewId: string;
    /** Starts at zero for reviews written before draft persistence. */
    revision: number;
    packet: ArchitectureEvidencePacket;
    proposal: ArchitectureProposal;
    draft: ArchitectureReviewNode[];
    coverageLedger?: import('./hierarchical-synthesis').CoverageLedgerEntry[];
    componentDescents?: import('./hierarchical-synthesis').ComponentDescentDisposition[];
}
export type SynthesisSetup = { kind: 'local'; endpoint?: string; token?: string; contextWindowTokens?: number } |
    { kind: 'gemini'; apiKey?: string };
export interface SynthesisSetupResult { models: string[] }
export interface SynthesisDryRunReport {
    inputFingerprint?: string;
    evidence: { kind: string; count: number }[];
    documents: { category: string; count: number }[];
    diagnostics: string[];
    savedRun?: {
        runId: string;
        state: 'analyzing' | 'failed' | 'review_required';
        completedCount: number;
        completed: { stage: string; subject?: string; providerKind: 'local' | 'gemini'; modelLabel: string }[];
        failed?: { stage: string; subject?: string };
        pending: { stage: string; subject?: string }[];
    };
    untested: string[];
}
export interface SoftwareMapService {
    attach(folderUri: string): Promise<{ projectHandle: string; status: SoftwareMapStatus }>;
    synthesisEnvironment(projectHandle: string): Promise<{ geminiKeyAvailable: boolean }>;
    configureSynthesis(projectHandle: string, options: SynthesisSetup): Promise<SynthesisSetupResult>;
    refreshSynthesisModels(projectHandle: string): Promise<SynthesisSetupResult>;
    clearSynthesis(projectHandle: string): Promise<void>;
    selectSynthesisModel(projectHandle: string, modelId: string): Promise<void>;
    probeSynthesis(projectHandle: string): Promise<void>;
    synthesisReady(projectHandle: string): Promise<boolean>;
    synthesisAttempts(projectHandle: string): Promise<SynthesisCallAttempt[]>;
    dryRunSynthesis(projectHandle: string): Promise<SynthesisDryRunReport>;
    initializationStatus(projectHandle: string): Promise<SoftwareMapInitializationStatus>;
    startInitialization(projectHandle: string): Promise<ArchitectureReview>;
    retryFailedStage(projectHandle: string): Promise<ArchitectureReview>;
    review(projectHandle: string): Promise<ArchitectureReview | undefined>;
    saveReviewDraft(projectHandle: string, reviewId: string, expectedRevision: number, draft: ArchitectureReviewNode[]): Promise<number>;
    searchDeeper(projectHandle: string, input: TargetedRefinementInput): Promise<TargetedRefinementResult>;
    resolveReviewSource(projectHandle: string, reviewId: string, evidenceRef: string): Promise<SoftwareMapSourceLocation | undefined>;
    resolveReviewDocument(projectHandle: string, reviewId: string, path: string): Promise<SoftwareMapSourceLocation | undefined>;
    cancelInitialization(projectHandle: string): Promise<void>;
    acceptReview(projectHandle: string, reviewId: string, draft: ArchitectureReviewNode[]): Promise<SoftwareMapStatus>;
    acceptExisting(projectHandle: string, expectedFingerprint: string): Promise<SoftwareMapStatus>;
    acceptManual(projectHandle: string, declaration: ArchitectureDeclaration, expectedFingerprint: string): Promise<SoftwareMapStatus>;
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
