import type { HistoryEntry, HistoryProject, HistorySource, HistoryContinuation, HistoryFocusTarget } from './history';

export const historyServicePath = '/services/dope/history';
export const HistoryService = Symbol('HistoryService');

export interface HistorySnapshot {
    project: HistoryProject;
    entries: HistoryEntry[];
    continueWith: HistoryContinuation;
    diagnostics: { source: HistorySource; message: string }[];
    truncated: boolean;
}

/** A connection is attached to one local project at a time; reads require its current handle. */
export interface HistoryService {
    attach(folderUri: string): Promise<{ projectHandle: string }>;
    read(projectHandle: string): Promise<HistorySnapshot>;
    recordFocus(projectHandle: string, owner: HistoryFocusTarget): Promise<void>;
}
