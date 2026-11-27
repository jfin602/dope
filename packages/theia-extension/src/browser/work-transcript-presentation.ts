import type { AgentTranscriptEntry } from '@dope/agent-core';
import { ChatScrollFollow } from './chat-panel-presentation';

export function restoreWorkScroll(follow: ChatScrollFollow, previousTop: number,
    height: number, viewport: number, selectionChanged: boolean): number {
    if (selectionChanged) {
        follow.scrolled(0, height, viewport);
        return 0;
    }
    return follow.restore(previousTop, height, viewport);
}

/** Keep native Work disclosures operable with Space in the embedded browser. */
export function workDisclosureKeydown(event: KeyboardEvent): void {
    if (event.key !== ' ' || !(event.target instanceof HTMLElement) || event.target.tagName !== 'SUMMARY') return;
    const details = event.target.parentElement;
    if (!(details instanceof HTMLDetailsElement)) return;
    event.preventDefault();
    details.open = !details.open;
}

export function workCommandLabel(entry: Extract<AgentTranscriptEntry, { kind: 'command' }>): string {
    const status = entry.exitCode === undefined ? entry.status : `${entry.status} · exit ${entry.exitCode}`;
    const shell = /^.*?\s-lc\s+(['"])/u.exec(entry.command);
    const firstLine = (shell ? entry.command.slice(shell[0].length) : entry.command)
        .split(/\n|&&|;/u, 1)[0].trim();
    const summary = shell && firstLine.endsWith(shell[1]) && entry.command.endsWith(shell[1]) ?
        firstLine.slice(0, -1).trimEnd() : firstLine;
    const label = summary.length > 72 ? `${summary.slice(0, 69)}…` : summary;
    return `Command · ${label || 'unnamed'}${entry.commandTruncated ? ' [truncated]' : ''} · ${status}` +
        (entry.durationMs === undefined ? '' : ` · ${entry.durationMs} ms`);
}

export function workCommandOutput(entry: Extract<AgentTranscriptEntry, { kind: 'command' }>): string[] {
    const lines = entry.cwd === undefined ? [] : [`cwd: ${entry.cwd}`];
    if (entry.stdout !== undefined) lines.push(`stdout${entry.stdoutTruncated ? ' [truncated]' : ''}:\n${entry.stdout}`);
    if (entry.stderr !== undefined) lines.push(`stderr${entry.stderrTruncated ? ' [truncated]' : ''}:\n${entry.stderr}`);
    if (entry.output !== undefined)
        lines.push(`output (combined)${entry.outputTruncated ? ' [truncated]' : ''}:\n${entry.output}`);
    if (entry.stdout === undefined && entry.stderr === undefined && entry.output === undefined)
        lines.push('Output not recorded by adapter.');
    return lines;
}

export type WorkToolEntry = Extract<AgentTranscriptEntry, { kind: 'work' }>;
function metadata(detail?: string): Record<string, unknown> {
    if (!detail) return {};
    try {
        const value: unknown = JSON.parse(detail);
        return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
    } catch { return {}; }
}
export function workToolStatus(phase: WorkToolEntry['phase']): string {
    return ({ requested: 'Running', validating: 'Validating', executing: 'Running', completed: 'Completed',
        failed: 'Failed', recoverable: 'Needs action', denied: 'Authority denied', cancelled: 'Cancelled',
        interrupted: 'Interrupted' })[phase];
}

/** Keep the concise saved-tool summary separate from its call-shaped detail. */
export function workToolLabel(entry: WorkToolEntry, history: WorkToolEntry[] = [entry]): string {
    const data = history.map(item => metadata(item.detail)).find(item => typeof item.path === 'string' ||
        typeof item.commandId === 'string') ?? {};
    const context = typeof data.path === 'string' ? data.path :
        typeof data.commandId === 'string' ? data.commandId : undefined;
    const concise = context && context.length > 72 ? `${context.slice(0, 69)}…` : context;
    return `${entry.toolName}${concise ? ` · ${concise}` : ''} · ${workToolStatus(entry.phase)}`;
}

export function workToolFeedback(entry: WorkToolEntry): string | undefined {
    if (entry.phase !== 'recoverable' || !entry.code || !/^[A-Z_]{3,40}$/u.test(entry.code)) return undefined;
    const feedback = metadata(entry.detail).feedback;
    return typeof feedback === 'string' && feedback.startsWith(`${entry.code}:`) &&
        feedback.length <= 240 && !/[\u0000-\u001f\u007f]/u.test(feedback) ? feedback : entry.code;
}

/** Reconstruct a CLI-style call from the saved, bounded metadata; raw arguments are intentionally not recorded. */
export function workToolCall(entries: WorkToolEntry[]): string {
    const latest = entries.at(-1);
    if (!latest) return 'tool()';
    const validated = entries.find(entry => entry.phase === 'validating' &&
        Object.keys(metadata(entry.detail)).length > 0);
    const safeValues = metadata(validated?.detail);
    const valueKeys = new Set(['path', 'offset', 'maxBytes', 'maxEntries', 'commandId', 'kind', 'operation']);
    const names = entries.flatMap(entry => {
        const data = metadata(entry.detail);
        return Array.isArray(data.fields) ? data.fields.filter((name): name is string =>
            typeof name === 'string' && /^[A-Za-z][A-Za-z0-9]{0,40}$/u.test(name)) : [];
    }).slice(0, 8);
    if (!names.length) names.push(...Object.keys(safeValues).filter(name => valueKeys.has(name)));
    const args = [...new Set(names)].map(name => {
        const value = safeValues[name];
        return `${name}: ${valueKeys.has(name) && (typeof value === 'string' ||
            typeof value === 'number' || typeof value === 'boolean') ? JSON.stringify(value) : '[withheld]'}`;
    }).join(', ');
    return `${latest.toolName}(${args ? `{ ${args} }` : ''})`;
}
