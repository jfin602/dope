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

export function workCommandLabel(entry: Extract<AgentTranscriptEntry, { kind: 'command' }>): string {
    const status = entry.exitCode === undefined ? entry.status : `${entry.status} · exit ${entry.exitCode}`;
    return `${entry.command}${entry.commandTruncated ? ' [truncated]' : ''} · ${status}` +
        (entry.durationMs === undefined ? '' : ` · ${entry.durationMs} ms`);
}

export function workCommandOutput(entry: Extract<AgentTranscriptEntry, { kind: 'command' }>): string[] {
    const lines = entry.cwd ? [`cwd: ${entry.cwd}`] : [];
    if (entry.stdout !== undefined) lines.push(`stdout${entry.stdoutTruncated ? ' [truncated]' : ''}:\n${entry.stdout}`);
    if (entry.stderr !== undefined) lines.push(`stderr${entry.stderrTruncated ? ' [truncated]' : ''}:\n${entry.stderr}`);
    if (entry.stdout === undefined && entry.stderr === undefined) lines.push('Output not recorded by adapter.');
    return lines;
}
