import type { HistoryEntry, HistoryProject, HistorySource, HistoryContinuation, HistoryFocusTarget } from './history';
import type { HistorySelection, HistoryContextPreview } from './history-context-preview';

export interface HistoryExplanationLine { text: string; citations: string[] }
export interface HistoryLocalExplanation {
    facts: HistoryExplanationLine[]; interpretations: HistoryExplanationLine[]; unknowns: HistoryExplanationLine[];
    provenance: { connectionId: string; modelId: string; providerId: string; modelLabel: string };
}

export const historyServicePath = '/services/dope/history';
/** Focus observation uses its own RPC connection and project handle. */
export const historyFocusServicePath = '/services/dope/history-focus';
/** Planning references use an independent handle from the History panel and focus observer. */
export const historyPlanningServicePath = '/services/dope/history-planning';
export const HistoryService = Symbol('HistoryService');

export interface HistorySnapshot {
    project: HistoryProject;
    entries: HistoryEntry[];
    continueWith: HistoryContinuation;
    diagnostics: { source: HistorySource; message: string }[];
    truncated: boolean;
    evidenceBasis: string;
}

/** A connection is attached to one local project at a time; reads require its current handle. */
export interface HistoryService {
    attach(folderUri: string): Promise<{ projectHandle: string }>;
    read(projectHandle: string): Promise<HistorySnapshot>;
    preview(projectHandle: string, expectedBasis: string, selection: HistorySelection[]): Promise<HistoryContextPreview>;
    verifyPreviewBasis(projectHandle: string, expectedBasis: string): Promise<boolean>;
    explain(projectHandle: string, preview: HistoryContextPreview, selection: HistorySelection[],
        requestId: string, confirmed: boolean): Promise<HistoryLocalExplanation>;
    cancelExplanation(requestId: string): Promise<void>;
    recordFocus(projectHandle: string, owner: HistoryFocusTarget): Promise<void>;
    resolveEditor(projectHandle: string, projectRelativePath: string): Promise<string>;
}
