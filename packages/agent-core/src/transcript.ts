import { bool, bounded, freeze, id, integer, projectPath, record, select, timestamp } from './contracts';

export const AGENT_TRANSCRIPT_VERSION = 1 as const;
export const AGENT_TRANSCRIPT_ENTRY_LIMIT = 2_000;
export const AGENT_TRANSCRIPT_PAGE_LIMIT = 100;
export const AGENT_TRANSCRIPT_BYTES_LIMIT = 8 * 1024 * 1024;
export const AGENT_TRANSCRIPT_RECORD_BYTES_LIMIT = 16 * 1024;

export type AgentTranscriptInput =
    | { kind: 'message'; at: string; text: string }
    | { kind: 'command-start'; at: string; commandId: string; command: string; cwd?: string }
    | { kind: 'command-finish'; at: string; commandId: string; status: 'completed' | 'failed' | 'cancelled' | 'interrupted';
        exitCode?: number; durationMs?: number; stdout?: string; stderr?: string; output?: string;
        stdoutTruncated?: boolean; stderrTruncated?: boolean; outputTruncated?: boolean }
    | { kind: 'marker'; at: string; code: 'run-started' | 'run-ended' };

export type AgentTranscriptEntry =
    | { version: 1; runId: string; sequence: number; at: string; kind: 'message'; text: string; truncated: boolean }
    | { version: 1; runId: string; sequence: number; at: string; kind: 'command'; commandId: string;
        command: string; commandTruncated: boolean; cwd?: string; status: 'running' | 'completed' | 'failed' | 'cancelled' | 'interrupted';
        completedSequence?: number; exitCode?: number; durationMs?: number; stdout?: string; stderr?: string; output?: string;
        stdoutTruncated?: boolean; stderrTruncated?: boolean; outputTruncated?: boolean }
    | { version: 1; runId: string; sequence: number; at: string; kind: 'marker';
        code: 'run-started' | 'run-ended' | 'transcript-incomplete' };

export type AgentTranscriptRecord = AgentTranscriptEntry | {
    version: 1; runId: string; sequence: number; at: string; kind: 'command-finish'; commandId: string;
    status: 'completed' | 'failed' | 'cancelled' | 'interrupted'; exitCode?: number; durationMs?: number;
    stdout?: string; stderr?: string; output?: string;
    stdoutTruncated?: boolean; stderrTruncated?: boolean; outputTruncated?: boolean;
};

export interface AgentTranscriptStorage {
    appendTranscript(root: string, runId: string, input: AgentTranscriptInput): Promise<{
        recorded: boolean; incomplete: boolean; sequence: number }>;
    readTranscript(root: string, runId: string, afterSequence: number, limit: number): Promise<{
        state: 'recorded' | 'not-recorded'; entries: AgentTranscriptEntry[];
        nextSequence: number; hasMore: boolean; incomplete: boolean }>;
}

const sensitive = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|AKIA[A-Z0-9]{16})\b|\b(?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|authorization|password|secret)\s*[:=]\s*\S+|\b[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|PASSWORD|SECRET)\s*=\s*\S+|\bBearer\s+[A-Za-z0-9._~-]{8,}|(?:^|[\s"'(])(?:\/[A-Za-z0-9._~-]+\/[^\s"')]+|[A-Za-z]:\\Users\\[^\s"')]+)/giu;

function clean(value: unknown, max: number): { text: string; truncated: boolean } {
    if (typeof value !== 'string' || value.length > max * 16) throw new Error('Invalid transcript text');
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value) ||
        /<think(?:\s[^>]*)?>|<\/think>|^\s*(?:hidden reasoning|chain of thought)\s*:/imu.test(value) ||
        /^\s*\{[^\n]{0,256}"(?:jsonrpc|method|params)"\s*:/u.test(value) ||
        (value.match(/^\s*[A-Za-z_][A-Za-z0-9_]*=\S+/gmu)?.length ?? 0) >= 3)
        throw new Error('Unsafe transcript content');
    const redacted = value.replace(sensitive, '[redacted]');
    const encoder = new TextEncoder();
    let text = '';
    let bytes = 0;
    for (const character of redacted) {
        const size = encoder.encode(character).length;
        if (bytes + size > max) break;
        bytes += size;
        text += character;
    }
    return { text, truncated: text.length !== redacted.length };
}

function safe(value: unknown, max: number, allowEmpty = false): string {
    if (allowEmpty && value === '') return '';
    const text = bounded(value, max, 'transcript text');
    if (clean(text, max).text !== text) throw new Error('Unsafe transcript text');
    return text;
}

export function prepareAgentTranscriptRecord(runId: string, sequence: number, input: AgentTranscriptInput): AgentTranscriptRecord {
    const base = { version: AGENT_TRANSCRIPT_VERSION, runId: id(runId), sequence: integer(sequence, AGENT_TRANSCRIPT_ENTRY_LIMIT), at: timestamp(input.at) };
    let result: AgentTranscriptRecord;
    switch (input.kind) {
        case 'message': {
            record(input, ['kind', 'at', 'text']);
            const { text, truncated } = clean(input.text, 12_000);
            if (!text) throw new Error('Empty transcript message');
            result = { ...base, kind: 'message', text, truncated }; break;
        }
        case 'command-start': {
            record(input, ['kind', 'at', 'commandId', 'command', 'cwd']);
            const { text, truncated } = clean(input.command, 2_000);
            if (!text) throw new Error('Empty transcript command');
            result = { ...base, kind: 'command', commandId: id(input.commandId), command: text, commandTruncated: truncated,
                ...(input.cwd === undefined ? {} : { cwd: projectPath(input.cwd, true) }), status: 'running' }; break;
        }
        case 'command-finish': {
            record(input, ['kind', 'at', 'commandId', 'status', 'exitCode', 'durationMs', 'stdout', 'stderr', 'output',
                'stdoutTruncated', 'stderrTruncated', 'outputTruncated']);
            const stdout = input.stdout === undefined ? undefined : clean(input.stdout, 4_000);
            const stderr = input.stderr === undefined ? undefined : clean(input.stderr, 4_000);
            const output = input.output === undefined ? undefined : clean(input.output, 4_000);
            if ((input.stdoutTruncated !== undefined && input.stdout === undefined) ||
                (input.stderrTruncated !== undefined && input.stderr === undefined) ||
                (input.outputTruncated !== undefined && input.output === undefined)) throw new Error('Invalid transcript output flags');
            result = { ...base, kind: 'command-finish', commandId: id(input.commandId),
                status: select(input.status, ['completed', 'failed', 'cancelled', 'interrupted'] as const),
                ...(input.exitCode === undefined ? {} : { exitCode: integer(input.exitCode, 255) }),
                ...(input.durationMs === undefined ? {} : { durationMs: integer(input.durationMs) }),
                ...(stdout === undefined ? {} : { stdout: stdout.text, stdoutTruncated: stdout.truncated || input.stdoutTruncated === true }),
                ...(stderr === undefined ? {} : { stderr: stderr.text, stderrTruncated: stderr.truncated || input.stderrTruncated === true }),
                ...(output === undefined ? {} : { output: output.text, outputTruncated: output.truncated || input.outputTruncated === true }) }; break;
        }
        case 'marker':
            record(input, ['kind', 'at', 'code']);
            result = { ...base, kind: 'marker', code: select(input.code, ['run-started', 'run-ended'] as const) }; break;
        default: throw new Error('Invalid transcript kind');
    }
    return parseAgentTranscriptRecord(result);
}

export function parseAgentTranscriptRecord(value: unknown): AgentTranscriptRecord {
    const common = record(value, ['version', 'runId', 'sequence', 'at', 'kind', 'text', 'truncated', 'commandId', 'command', 'commandTruncated',
        'cwd', 'status', 'completedSequence', 'exitCode', 'durationMs', 'stdout', 'stderr', 'output',
        'stdoutTruncated', 'stderrTruncated', 'outputTruncated', 'code']);
    if (common.version !== AGENT_TRANSCRIPT_VERSION) throw new Error('Unsupported transcript version');
    const base = { version: AGENT_TRANSCRIPT_VERSION, runId: id(common.runId),
        sequence: integer(common.sequence, AGENT_TRANSCRIPT_ENTRY_LIMIT), at: timestamp(common.at) };
    if (!base.sequence) throw new Error('Invalid transcript sequence');
    const kind = select(common.kind, ['message', 'command', 'command-finish', 'marker'] as const);
    const allowed = {
        message: ['version', 'runId', 'sequence', 'at', 'kind', 'text', 'truncated'],
        command: ['version', 'runId', 'sequence', 'at', 'kind', 'commandId', 'command', 'commandTruncated', 'cwd', 'status'],
        'command-finish': ['version', 'runId', 'sequence', 'at', 'kind', 'commandId', 'status', 'exitCode', 'durationMs',
            'stdout', 'stderr', 'output', 'stdoutTruncated', 'stderrTruncated', 'outputTruncated'],
        marker: ['version', 'runId', 'sequence', 'at', 'kind', 'code']
    } as const;
    record(value, allowed[kind]);
    if (kind === 'message') {
        const text = safe(common.text, 12_000);
        if (!text) throw new Error('Empty transcript message');
        return freeze({ ...base, kind, text, truncated: bool(common.truncated) });
    }
    if (kind === 'marker') return freeze({ ...base, kind, code: select(common.code, ['run-started', 'run-ended', 'transcript-incomplete'] as const) });
    const commandId = id(common.commandId);
    if (kind === 'command') {
        if (common.status !== 'running') throw new Error('Invalid transcript command start');
        const command = safe(common.command, 2_000);
        if (!command) throw new Error('Empty transcript command');
        return freeze({ ...base, kind, commandId, command, commandTruncated: bool(common.commandTruncated),
            ...(common.cwd === undefined ? {} : { cwd: projectPath(common.cwd, true) }), status: 'running' });
    }
    if ((common.stdoutTruncated !== undefined && common.stdout === undefined) ||
        (common.stderrTruncated !== undefined && common.stderr === undefined) ||
        (common.outputTruncated !== undefined && common.output === undefined)) throw new Error('Invalid transcript output flags');
    return freeze({ ...base, kind, commandId,
        status: select(common.status, ['completed', 'failed', 'cancelled', 'interrupted'] as const),
        ...(common.exitCode === undefined ? {} : { exitCode: integer(common.exitCode, 255) }),
        ...(common.durationMs === undefined ? {} : { durationMs: integer(common.durationMs) }),
        ...(common.stdout === undefined ? {} : { stdout: safe(common.stdout, 4_000, true), stdoutTruncated: bool(common.stdoutTruncated) }),
        ...(common.stderr === undefined ? {} : { stderr: safe(common.stderr, 4_000, true), stderrTruncated: bool(common.stderrTruncated) }),
        ...(common.output === undefined ? {} : { output: safe(common.output, 4_000, true), outputTruncated: bool(common.outputTruncated) }) });
}
