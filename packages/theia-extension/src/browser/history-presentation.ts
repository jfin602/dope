import type { HistoryContinuation, HistoryEntry, HistoryOwnerRef } from '@dope/contracts/lib/history';
import type { HistoryPreviewItem } from '@dope/contracts/lib/history-context-preview';

const ownerNames: Record<HistoryOwnerRef['kind'], string> = {
    chat: 'Chat', 'planning-map': 'Planning Map', 'work-item': 'Work item',
    'agent-task': 'Work task', 'agent-run': 'Work run', 'agent-sequence': 'Work sequence',
    'project-mind': 'Project Mind item', 'git-commit': 'Git commit', 'git-dirty': 'Working tree', editor: 'File'
};

export function historyFocusDescription(choice: HistoryContinuation, entries: readonly HistoryEntry[]):
    { heading: string; destination?: string; message: string; time?: string } {
    if (choice.kind === 'none') return { heading: 'No place recorded yet',
        message: 'Open a file, Chat, Work, or Planning Map to establish a place to continue.' };
    if (choice.kind === 'recent-activity-suggestion') return { heading: 'Suggested from recent activity',
        destination: choice.title, message: 'This is a suggestion, not your last focused place. Open verifies it again.' };
    const owner = choice.owner;
    const kind = owner ? ownerNames[owner.kind] : 'place';
    const match = choice.kind === 'verified-focus' && owner ? entries.find(entry => entry.availability === 'available' &&
        JSON.stringify(entry.owner) === JSON.stringify(owner)) : undefined;
    const destination = owner?.kind === 'editor' ? owner.projectRelativePath :
        match?.title.replace(/[\u0000-\u001f\u007f]/gu, ' ').slice(0, 120) || kind;
    if (choice.kind === 'verified-focus') return { heading: `Continue ${kind}`, destination,
        message: `Continue opens this exact ${kind.toLowerCase()} in this project.`, time: choice.observedAt };
    const target = owner?.kind === 'editor' ? ` at ${owner.projectRelativePath}` : '';
    if (choice.reason === 'missing') return { heading: `Previously focused ${kind} unavailable`, destination,
        message: `The previously focused ${kind.toLowerCase()} is no longer available${target}. Find its new location or open another place. History will not guess a replacement.`,
        time: choice.observedAt };
    if (choice.reason === 'stale') return { heading: `Previously focused ${kind} changed`, destination,
        message: `The previously focused ${kind.toLowerCase()} has changed since it was recorded. Open it directly or choose another place.`,
        time: choice.observedAt };
    return { heading: 'Previous place cannot be verified',
        message: 'History cannot verify the last focused place safely. Open a place directly, then refresh History.',
        time: choice.observedAt };
}

export function historyReadableTime(value: string): string {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined,
        { dateStyle: 'medium', timeStyle: 'short' }).format(date) : 'time unavailable';
}

/** Describe only fields in the bounded preview; owner titles and contents are deliberately absent. */
export function historyPreviewDescription(item: HistoryPreviewItem):
    { title: string; summary: string; status: string; time?: string; uncertainty: string } {
    const title = ownerNames[item.ownerKind];
    const time = item.occurredAt ? `Recorded event ${historyReadableTime(item.occurredAt)}` :
        item.observedAt ? `Observed ${historyReadableTime(item.observedAt)}` : undefined;
    if (item.ownerKind === 'git-dirty') return {
        title: 'Working tree changes',
        summary: 'Dope detected uncommitted changes in this project.',
        status: 'Changes present when observed', time,
        uncertainty: 'Change author and exact change time are unknown. File contents and diffs are not included.'
    };
    if (item.category === 'unknown-or-unavailable' && item.summary.startsWith('Owner metadata ')) {
        const availability = item.summary.slice('Owner metadata '.length);
        return { title, summary: `Selected ${title.toLowerCase()} metadata could not be verified.`,
            status: `Metadata ${availability}`, time,
            uncertainty: 'The available metadata does not establish what happened. Refresh History before relying on this item.' };
    }
    if (item.ownerKind === 'agent-run') return {
        title, summary: 'Dope observed the selected Work run metadata.',
        status: item.summary.replace(/^Run ([^;]+); validation ([^;]+); review ([^;]+); promotion (.+)$/u,
            (_full, run: string, validation: string, review: string, promotion: string) =>
                `Run: ${run} · Validation: ${validation} · Review: ${review} · Promotion: ${promotion.replaceAll('-', ' ')}`), time,
        uncertainty: 'Run state, validation, review, and promotion are separate. This preview does not include run contents.'
    };
    if (item.ownerKind === 'work-item') return {
        title, summary: 'Dope observed the selected work item metadata.',
        status: item.summary.replace(/^WorkItem state: /u, 'Work item: ').replaceAll('in-progress', 'in progress'), time,
        uncertainty: 'This state alone does not verify implementation or approval.'
    };
    if (item.ownerKind === 'git-commit') return {
        title, summary: 'Dope observed Git commit metadata for this project.',
        status: 'Commit metadata observed', time,
        uncertainty: 'This preview does not include the commit contents or establish its significance.'
    };
    return { title, summary: `Dope observed selected ${title.toLowerCase()} metadata in this project.`,
        status: 'Metadata observed', time,
        uncertainty: item.occurredAt || item.observedAt ?
            'Metadata observation does not establish a completed development action. Contents are not included.' :
            'When this occurred is unknown. Metadata observation does not establish a completed development action. Contents are not included.' };
}
