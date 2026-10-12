/** Read-only, project-scoped navigation metadata. Owner stores remain authoritative. */
export interface HistoryProject {
    projectId: string;
    projectRoot: string;
}

export type HistoryOwnerRef =
    | { kind: 'chat'; chatId: string }
    | { kind: 'planning-map'; mapId: string }
    | { kind: 'work-item'; mapId: string; workItemId: string }
    | { kind: 'agent-task'; taskId: string }
    | { kind: 'agent-run'; runId: string }
    | { kind: 'agent-sequence'; sequenceId: string }
    | { kind: 'project-mind'; artifactId: string }
    | { kind: 'git-commit'; commitId: string }
    | { kind: 'git-dirty' }
    | { kind: 'editor'; projectRelativePath: string };
export type HistoryNavigableOwnerRef = Exclude<HistoryOwnerRef, { kind: 'git-dirty' }>;

export type HistorySource = 'chat' | 'planning' | 'project-mind' | 'agent' | 'git' | 'workbench';
export type HistoryAvailability = 'available' | 'missing' | 'stale' | 'unavailable';

/** These facts are independent: a passed validation does not imply promotion. */
export type HistoryStatus =
    | { kind: 'owner'; label: string }
    | { kind: 'work-item'; state: 'proposed' | 'ready' | 'in-progress' | 'completed' | 'cancelled' }
    | { kind: 'agent-run'; state: 'pending' | 'running' | 'blocked' | 'cancelling' |
        'cancelled' | 'completed' | 'failed' | 'interrupted';
        validation: 'unknown' | 'not-started' | 'pending' | 'passed' | 'failed' | 'skipped' | 'cancelled';
        review?: 'none' | 'pending' | 'accept' | 'reject';
        provenance?: { connectionId: string; modelId: string; adapterId: string; runtimeKind: 'local' | 'hosted' };
        promotion: 'not-applied' | 'applied' | 'unknown' };

interface HistoryEntryBase extends HistoryProject {
    /** Stable within its owner source; distinct events from one owner need distinct IDs. */
    sourceId: string;
    source: HistorySource;
    owner: HistoryOwnerRef;
    title: string;
    status: HistoryStatus;
    availability: HistoryAvailability;
    ownerRevision?: number;
    ownerProjectId?: string;
}
export type HistoryEntry = HistoryEntryBase & (
    /** Actual owner event time, or null when the owner has no known event time. */
    | { kind: 'event'; occurredAt: string | null; observedAt: null }
    /** A current-state observation; never an assertion of when the underlying change occurred. */
    | { kind: 'snapshot'; occurredAt: null; observedAt: string }
);

export interface VerifiedHistoryFocus extends HistoryProject {
    owner: HistoryNavigableOwnerRef;
    observedAt: string;
    availability: 'available';
    verified: true;
}

/** A single observed owner target, never a record of owner contents or activity. */
export type HistoryFocusTarget = Extract<HistoryNavigableOwnerRef,
    { kind: 'chat' | 'planning-map' | 'work-item' | 'agent-task' | 'agent-run' | 'agent-sequence' | 'editor' }>;

export type HistoryContinuation =
    | { kind: 'verified-focus'; owner: HistoryNavigableOwnerRef; observedAt: string }
    | { kind: 'recent-activity-suggestion'; owner: HistoryNavigableOwnerRef; sourceId: string; title: string }
    | { kind: 'none' };

const ownerKey = (owner: HistoryOwnerRef): string => JSON.stringify(owner);
const sameProject = (a: HistoryProject, b: HistoryProject): boolean =>
    a.projectId === b.projectId && a.projectRoot === b.projectRoot;
const effectiveTime = (entry: HistoryEntry): string | null =>
    entry.kind === 'snapshot' ? entry.observedAt : entry.occurredAt;

/** Sorting is stable across input order, including equal and unknown timestamps. */
export function projectHistory(entries: readonly HistoryEntry[], project: HistoryProject, limit = 50): HistoryEntry[] {
    const cap = Number.isFinite(limit) ? Math.min(50, Math.max(0, Math.floor(limit))) : 0;
    if (cap === 0) return [];
    const scoped = entries.filter(entry => sameProject(entry, project));
    scoped.sort((a, b) => {
        const aTime = effectiveTime(a);
        const bTime = effectiveTime(b);
        if (aTime !== bTime) {
            if (aTime === null) return 1;
            if (bTime === null) return -1;
            const order = bTime.localeCompare(aTime);
            if (order) return order;
        }
        return `${a.source}\0${a.sourceId}\0${ownerKey(a.owner)}\0${JSON.stringify(a)}`.localeCompare(
            `${b.source}\0${b.sourceId}\0${ownerKey(b.owner)}\0${JSON.stringify(b)}`);
    });
    const seen = new Set<string>();
    const result: HistoryEntry[] = [];
    for (const entry of scoped) {
        const key = `${entry.source}\0${entry.sourceId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push({ ...entry, title: entry.title.slice(0, 120) });
        if (result.length === cap) break;
    }
    return result;
}

/** Focus verification belongs to the owner adapter; this pure step never opens it. */
export function proposeHistoryContinuation(
    project: HistoryProject, entries: readonly HistoryEntry[], focus?: VerifiedHistoryFocus | null
): HistoryContinuation {
    if (focus?.verified === true && focus.availability === 'available' && sameProject(focus, project)) {
        return { kind: 'verified-focus', owner: focus.owner, observedAt: focus.observedAt };
    }
    for (const entry of projectHistory(entries, project)) {
        if (entry.availability === 'available' && entry.owner.kind !== 'git-dirty' && entry.owner.kind !== 'git-commit') {
            return { kind: 'recent-activity-suggestion', owner: entry.owner,
                sourceId: entry.sourceId, title: entry.title };
        }
    }
    return { kind: 'none' };
}
