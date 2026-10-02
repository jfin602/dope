import type { AnalysisStatus, ArchitectureEvidenceItem, CodeEntityNode, Evidence, FlowCoverage, FlowDiagnostic, GraphRelationship, PhysicalFlowEndpoint, PhysicalFlowFact } from '@dope/software-map';

/** Paths in public results are relative to the attached project root. */
export interface AnalysisProject { configPath: string; sourcePaths: string[] }
export type FrameworkFact = Omit<Extract<ArchitectureEvidenceItem, { kind: 'framework' }>, 'id'> & { detail?: boolean };
export interface CodeAnalysisResult {
    projects: AnalysisProject[];
    nodes: CodeEntityNode[];
    relationships: GraphRelationship[];
    evidence: Evidence[];
    flowFacts: PhysicalFlowFact[];
    flowEndpoints: PhysicalFlowEndpoint[];
    flowCoverage: FlowCoverage[];
    flowDiagnostics: FlowDiagnostic[];
    frameworkFacts?: FrameworkFact[];
    status: AnalysisStatus;
    /** Diagnostic only: unchanged compiler source units reused from the previous pass. */
    reusedSourceFiles?: number;
}
export interface CodeAnalyzer {
    analyze(projectRoot: string): CodeAnalysisResult;
}
