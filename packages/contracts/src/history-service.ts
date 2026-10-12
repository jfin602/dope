import type { HistoryEntry, HistoryProject, HistorySource, HistoryContinuation, HistoryFocusTarget } from './history';
import type { HistorySelection, HistoryContextPreview } from './history-context-preview';

export const historyServicePath = '/services/dope/history';
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
    recordFocus(projectHandle: string, owner: HistoryFocusTarget): Promise<void>;
    resolveEditor(projectHandle: string, projectRelativePath: string): Promise<string>;
}
