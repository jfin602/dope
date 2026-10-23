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
