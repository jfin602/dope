import type { AnalysisStatus, CodeEntityNode, Evidence, ModelRelationship } from '@dope/software-model';

/** Paths in public results are relative to the attached project root. */
export interface AnalysisProject { configPath: string; sourcePaths: string[] }
export interface CodeAnalysisResult {
    projects: AnalysisProject[];
    nodes: CodeEntityNode[];
    relationships: ModelRelationship[];
    evidence: Evidence[];
    status: AnalysisStatus;
    /** Diagnostic only: unchanged compiler source units reused from the previous pass. */
    reusedSourceFiles?: number;
}
export interface CodeAnalyzer {
    analyze(projectRoot: string): CodeAnalysisResult;
}
