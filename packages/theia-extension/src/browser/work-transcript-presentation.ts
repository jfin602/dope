import type { AgentTranscriptEntry } from '@dope/agent-core';
import { ChatScrollFollow } from './chat-panel-presentation';

export const AGENT_TRANSCRIPT_ID = 'dope-agent-transcript';
export interface AgentTranscriptOptions { project: string; runId: string }
export function agentTranscriptWidgetId(options: AgentTranscriptOptions): string {
    return `${AGENT_TRANSCRIPT_ID}:${encodeURIComponent(options.project)}:${options.runId}`;
}
export async function openAgentTranscript<W extends { id: string; isAttached: boolean }>(
    options: AgentTranscriptOptions, create: (options: AgentTranscriptOptions) => Promise<W>,
    shell: { addWidget(widget: W, options: { area: 'main' }): Promise<void>; activateWidget(id: string): Promise<unknown> }): Promise<W> {
    const widget = await create(options);
    if (!widget.isAttached) await shell.addWidget(widget, { area: 'main' });
    await shell.activateWidget(widget.id);
    return widget;
}

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
const requestKeys = ['path', 'offset', 'maxBytes', 'maxEntries', 'sourceIdentitySupplied',
    'commandId', 'kind', 'operation', 'contentBytes', 'contentSha256', 'outputRecordSupplied',
    'fields', 'argumentType'];
const resultKeys = ['endOffset', 'nextOffset', 'outputBytes', 'sourceHash', 'outputIdentity',
    'captureTruncated', 'truncated', 'count', 'resultCount', 'fileBytes'];
function fields(value: Record<string, unknown>, keys: string[]): string[] {
    return keys.flatMap(key => value[key] === undefined ? [] :
        [`${key}: ${Array.isArray(value[key]) ? (value[key] as unknown[]).join(', ') : String(value[key])}`]);
}
export function workToolStatus(phase: WorkToolEntry['phase']): string {
    return ({ requested: 'Running', validating: 'Validating', executing: 'Running', completed: 'Completed',
        failed: 'Failed', recoverable: 'Invalid arguments', denied: 'Authority denied', cancelled: 'Cancelled' })[phase];
}

/** R4-A detail is a bounded, sanitized summary; preserve its actual words rather than guessing fields. */
export function workToolLabel(entry: WorkToolEntry, history: WorkToolEntry[] = [entry]): string {
    const data = history.map(item => metadata(item.detail)).find(item => typeof item.path === 'string' ||
        typeof item.commandId === 'string') ?? {};
    const context = typeof data.path === 'string' ? data.path :
        typeof data.commandId === 'string' ? data.commandId : undefined;
    const concise = context && context.length > 72 ? `${context.slice(0, 69)}…` : context;
    return `${entry.toolName}${concise ? ` · ${concise}` : ''} · ${workToolStatus(entry.phase)}`;
}

export function workToolDetails(entries: WorkToolEntry[]): string[] {
    const latest = entries.at(-1);
    if (!latest) return ['Metadata unavailable.'];
    const request = entries.flatMap(entry => fields(metadata(entry.detail), requestKeys));
    const result = entries.flatMap(entry => fields(metadata(entry.detail), resultKeys));
    const lines = ['Request', ...(request.length ? [...new Set(request)] : ['Metadata unavailable.']),
        'Execution', `Lifecycle: ${workToolStatus(latest.phase)}`];
    if (latest.stage) lines.push(`Stage: ${latest.stage}`);
    if (latest.brokerInvoked !== undefined) lines.push(`Broker invoked: ${latest.brokerInvoked ? 'yes' : 'no'}`);
    if (latest.effectExecuted !== undefined) lines.push(`Effect executed: ${latest.effectExecuted ? 'yes' : 'no'}`);
    lines.push('Result', ...(result.length ? [...new Set(result)] : ['Metadata unavailable.']));
    if (latest.code) lines.push(`Code: ${latest.code}`);
    return lines;
}
