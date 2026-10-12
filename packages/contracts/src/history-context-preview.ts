import type { HistoryEntry, HistoryProject } from './history';

export interface HistorySelection { source: HistoryEntry['source']; sourceId: string }
export interface HistoryPreviewItem {
    source: HistoryEntry['source']; sourceId: string; ownerKind: HistoryEntry['owner']['kind'];
    category: 'observation' | 'unknown-or-unavailable' | 'git-snapshot';
    occurredAt: string | null; observedAt: string | null; fingerprint: string;
    summary: string;
}
export interface HistoryContextPreview {
    projectId: string; evidenceBasis: string; items: HistoryPreviewItem[];
    omissions: string[]; bytes: number; estimatedTokens: number;
    privacy: string;
}
export const HISTORY_PREVIEW_MAX_ITEMS = 8;
export const HISTORY_PREVIEW_MAX_BYTES = 4096;
export const HISTORY_PREVIEW_MAX_TOKENS = 1024;
const bytes = (value: unknown): number => Buffer.byteLength(JSON.stringify(value), 'utf8');
const tokens = (value: unknown): number => Math.ceil(bytes(value) / 4);
const PRIVACY = 'Local preview only. No model call or egress. Only these selected metadata items could be sent after a separate local-only confirmation; no transcripts, prompts, diffs, secrets, file contents or unselected context.';

/** Only an allowlisted, generated account of owner state enters the evidence package. */
function summary(entry: HistoryEntry): string {
    if (entry.availability !== 'available') return `Owner metadata ${entry.availability}`;
    if (entry.status.kind === 'work-item') return `WorkItem state: ${entry.status.state}`;
    if (entry.status.kind === 'agent-run') return `Run ${entry.status.state}; validation ${entry.status.validation}; review ${entry.status.review ?? 'unknown'}; promotion ${entry.status.promotion}`;
    if (entry.owner.kind === 'git-dirty') return 'Current working tree has changes; change time and author are unknown';
    if (entry.owner.kind === 'git-commit') return 'Git commit metadata observed';
    return `${entry.owner.kind} metadata observed`;
}

/** Pure, on-demand selection. Never uses titles, transcripts, objectives, paths or provider content. */
export function buildHistoryContextPreview(project: HistoryProject, basis: string,
    entries: readonly HistoryEntry[], selection: readonly HistorySelection[], fingerprint: (entry: HistoryEntry) => string): HistoryContextPreview {
    if (!Array.isArray(selection) || selection.length > HISTORY_PREVIEW_MAX_ITEMS || !selection.length)
        throw new Error('Select 1–8 History items');
    const seen = new Set<string>();
    const items: HistoryPreviewItem[] = [];
    const omissions: string[] = [];
    for (const selected of selection) {
        if (typeof selected.sourceId !== 'string' || selected.sourceId.length > 160) throw new Error('Invalid History selection ID');
        const key = JSON.stringify([selected.source, selected.sourceId]);
        if (seen.has(key)) throw new Error('Duplicate History selection');
        seen.add(key);
        const entry = entries.find(candidate => candidate.source === selected.source && candidate.sourceId === selected.sourceId &&
            candidate.projectId === project.projectId && candidate.projectRoot === project.projectRoot);
        if (!entry) throw new Error('Selected History item is unavailable; refresh History');
        const item: HistoryPreviewItem = { source: entry.source, sourceId: entry.sourceId, ownerKind: entry.owner.kind,
            category: entry.source === 'git' && entry.kind === 'snapshot' ? 'git-snapshot' :
                entry.availability !== 'available' || (entry.kind === 'event' && !entry.occurredAt) ? 'unknown-or-unavailable' : 'observation',
            occurredAt: entry.kind === 'event' ? entry.occurredAt : null,
            observedAt: entry.kind === 'snapshot' ? entry.observedAt : null,
            fingerprint: fingerprint(entry), summary: summary(entry) };
        const next = { projectId: project.projectId, evidenceBasis: basis, items: [...items, item],
            omissions, privacy: PRIVACY };
        if (bytes(next) > HISTORY_PREVIEW_MAX_BYTES - 32 || tokens(next) > HISTORY_PREVIEW_MAX_TOKENS - 8) {
            omissions.push('One selected item omitted by byte/token budget');
            continue;
        }
        items.push(item);
    }
    const payload = { projectId: project.projectId, evidenceBasis: basis, items, omissions, privacy: PRIVACY };
    const result = { ...payload, bytes: bytes(payload), estimatedTokens: tokens(payload) };
    if (bytes(result) > HISTORY_PREVIEW_MAX_BYTES || tokens(result) > HISTORY_PREVIEW_MAX_TOKENS)
        throw new Error('History preview exceeds byte/token budget');
    return result;
}
