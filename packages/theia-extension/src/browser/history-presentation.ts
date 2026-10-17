import type { HistoryContinuation, HistoryEntry, HistoryOwnerRef } from '@dope/contracts/lib/history';

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
