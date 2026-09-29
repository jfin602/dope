import type { AnalysisStatus, CodeEntityNode, Evidence, GraphRelationship } from '@dope/software-map';

/** Paths in public results are relative to the attached project root. */
export interface AnalysisProject { configPath: string; sourcePaths: string[] }
export interface CodeAnalysisResult {
    projects: AnalysisProject[];
    nodes: CodeEntityNode[];
    relationships: GraphRelationship[];
    evidence: Evidence[];
    status: AnalysisStatus;
    /** Diagnostic only: unchanged compiler source units reused from the previous pass. */
    reusedSourceFiles?: number;
}
export interface CodeAnalyzer {
    analyze(projectRoot: string): CodeAnalysisResult;
}
