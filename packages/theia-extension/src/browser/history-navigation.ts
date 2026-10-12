import type { HistoryEntry, HistoryNavigableOwnerRef } from '@dope/contracts/lib/history';
import type { HistorySnapshot } from '@dope/contracts/lib/history-service';

export type HistoryNavigationResult = { opened: boolean; message: string };
export interface HistoryNavigationOwners {
    open(owner: HistoryNavigableOwnerRef, current: () => Promise<boolean>, entry?: HistoryEntry): Promise<boolean>;
}

export async function navigateHistory(input: HistorySnapshot, owner: HistoryNavigableOwnerRef,
    sourceId: string | undefined, observedAt: string | undefined,
    read: () => Promise<HistorySnapshot>, current: () => Promise<boolean>, owners: HistoryNavigationOwners
): Promise<HistoryNavigationResult> {
    const stale = { opened: false, message: 'History target or project changed. Refresh History and retry.' };
    const identity = (entry: HistoryEntry) => JSON.stringify([entry.source, entry.sourceId, entry.owner, entry.ownerRevision,
        entry.ownerProjectId, entry.title, entry.status]);
    const matches = (snapshot: HistorySnapshot): boolean => {
        if (snapshot.project.projectId !== input.project.projectId || snapshot.project.projectRoot !== input.project.projectRoot) return false;
        if (sourceId !== undefined) {
            const original = input.entries.find(entry => entry.sourceId === sourceId && JSON.stringify(entry.owner) === JSON.stringify(owner));
            return !!original && original.availability === 'available' && snapshot.entries.some(entry =>
                entry.availability === 'available' && identity(entry) === identity(original));
        }
        return observedAt !== undefined && input.continueWith.kind === 'verified-focus' &&
            input.continueWith.observedAt === observedAt && JSON.stringify(input.continueWith.owner) === JSON.stringify(owner) &&
            snapshot.continueWith.kind === 'verified-focus' && snapshot.continueWith.observedAt === observedAt &&
            JSON.stringify(snapshot.continueWith.owner) === JSON.stringify(owner);
    };
    try {
        if (!await current() || !matches(await read()) || !await current()) return stale;
        const opened = await owners.open(owner, current, sourceId === undefined ? undefined :
            input.entries.find(entry => entry.sourceId === sourceId && JSON.stringify(entry.owner) === JSON.stringify(owner)));
        if (!await current() || !matches(await read()) || !await current()) return stale;
        return opened ? { opened: true, message: 'Opened the exact owner target.' } :
            { opened: false, message: 'Exact owner target is missing, stale, or cannot be opened. Refresh History.' };
    } catch {
        return { opened: false, message: 'Exact target could not be verified or opened. Refresh History.' };
    }
}
