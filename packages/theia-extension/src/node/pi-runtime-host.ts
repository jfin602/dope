import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface PiRuntimeDiagnostics {
    version: string;
    transport: 'supervised-worker';
    tools: string[];
}

export type PiWorkEvent = { type: 'work'; sequence: number;
    kind: 'agent_start' | 'turn_start' | 'turn_end' | 'agent_end' | 'agent_settled' |
        'tool_execution_start' | 'tool_execution_end' | 'reasoning' | 'reasoning_omitted' |
        'compaction_succeeded' | 'compaction_failed';
    toolName?: string; isError?: boolean; aborted?: boolean; text?: string; truncated?: boolean;
    reason?: 'threshold' | 'overflow' | 'manual'; durationMs?: number;
    tokensBeforeEstimate?: number; tokensAfterEstimate?: number; summaryBytes?: number;
    summarizationTokensReported?: number };
export interface PiContextRecord { originalSha256: string; compactedSha256: string; tokensBefore: number }
export interface PiTokenUsage { inputTokens?: number; outputTokens?: number; totalTokens?: number;
    reasoningTokens?: number;
    tokenMeasurement: 'provider-reported' | 'unavailable' }
export interface PiTurnResult { text: string; novelText?: string; segmentIndex: number; modelId: string;
    finishReason: 'stop' | 'length'; outputCeilingTokens?: number; lastCallOutputTokens?: number;
    usage: PiTokenUsage; segmentUsage?: PiTokenUsage;
    usageSegments?: PiTokenUsage[]; compaction?: PiContextRecord }
export type PiTurnEvent = { type: 'delta'; text: string } |
    { type: 'reset' } |
    { type: 'activity'; kind: 'thinking' | 'provisional'; text: string } |
    { type: 'complete' | 'paused'; result: PiTurnResult };
const validUsage = (usage: PiTokenUsage | undefined): usage is PiTokenUsage =>
    !!usage && ['provider-reported', 'unavailable'].includes(usage.tokenMeasurement) &&
    ['inputTokens', 'outputTokens', 'totalTokens', 'reasoningTokens'].every(key => {
        const value = usage[key as keyof PiTokenUsage];
        return value === undefined || typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
    }) && (usage.reasoningTokens === undefined || usage.outputTokens === undefined ||
        usage.reasoningTokens <= usage.outputTokens);
const consistentUsage = (result: PiTurnResult): boolean => {
    const segments = result.usageSegments;
    if (!segments) return true;
    if (result.segmentUsage && JSON.stringify(result.segmentUsage) !== JSON.stringify(segments.at(-1))) return false;
    if (segments.some(segment => segment.tokenMeasurement !== 'provider-reported'))
        return result.usage.tokenMeasurement === 'unavailable';
    if (result.usage.tokenMeasurement !== 'provider-reported') return false;
    return (['inputTokens', 'outputTokens', 'totalTokens', 'reasoningTokens'] as const).every(key => {
        if (segments.some(segment => segment[key] === undefined)) return result.usage[key] === undefined;
        return result.usage[key] === segments.reduce((sum, segment) => sum + (segment[key] ?? 0), 0);
    });
};
type Pending = { resolve(value: unknown): void; reject(error: Error): void; timer: NodeJS.Timeout;
    lastWorkSequence?: number;
    onEvent?: (event: { type: 'delta'; text: string } | { type: 'reset' } |
        { type: 'activity'; kind: 'thinking' | 'provisional'; text: string } | PiWorkEvent) => void;
    onTool?: (call: { id: number; name: string; arguments: unknown }) => Promise<unknown> };

/** Only Dope-owned paths are considered. No PATH lookup or user Pi installation is used. */
export function resolvePiWorkerPath(runtimeDir = __dirname, resourcesPath = process.resourcesPath): string {
    const packaged = resourcesPath && join(resourcesPath, 'app/pi-runtime/worker.mjs');
    if (packaged && existsSync(packaged)) return packaged;
    // The extension runs from packages/theia-extension/lib/node in unit tests,
    // but Theia bundles it into apps/{browser,electron}/lib/backend at runtime.
    for (const development of [
        resolve(runtimeDir, '../../../pi-runtime/worker.mjs'),
        resolve(runtimeDir, '../../../../packages/pi-runtime/worker.mjs')
    ]) {
        if (existsSync(development)) return development;
    }
    throw new Error('Bundled Pi runtime unavailable');
}

export class PiRuntimeHost {
    private child?: ChildProcessWithoutNullStreams;
    private nextId = 0;
    private stdout = '';
    private readonly pending = new Map<number, Pending>();
    private paused?: { id: number; segmentIndex: number; maxOutputTokens: number };

    constructor(private readonly workerPath = resolvePiWorkerPath(),
        private readonly executable = process.execPath) {}

    async start(): Promise<PiRuntimeDiagnostics> {
        if (this.child) throw new Error('Pi runtime already started');
        const child = spawn(this.executable, [this.workerPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ELECTRON_RUN_AS_NODE: '1',
                PI_OFFLINE: '1',
                PI_TELEMETRY: '0',
                ...(process.env.DOPE_PI_CONTINUATION_TRACE === '1' ? { DOPE_PI_CONTINUATION_TRACE: '1' } : {})
            }
        });
        this.child = child;
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => this.acceptOutput(chunk));
        child.stderr.on('data', (chunk: Buffer) => {
            if (process.env.DOPE_PI_CONTINUATION_TRACE === '1' ||
                String(chunk).includes('[dope-roadmap-generation]'))
                console.info(String(chunk).slice(0, 4096));
        });
        child.on('error', error => this.fail(error));
        child.on('exit', () => this.fail(new Error('Bundled Pi worker exited')));
        try {
            const diagnostics = await this.request<PiRuntimeDiagnostics>({ type: 'diagnostics' });
            if (diagnostics.version !== '1.4.0' || diagnostics.transport !== 'supervised-worker' ||
                !Array.isArray(diagnostics.tools) || diagnostics.tools.length)
                throw new Error('Bundled Pi runtime identity mismatch');
            return diagnostics;
        } catch (error) {
            this.dispose();
            throw error;
        }
    }

    /** P2 supplies the exact local model. P1 never prompts or changes live routing. */
    openNoToolSession(model: { baseUrl: string; [key: string]: unknown }, cwd: string, credential?: string,
        thinkingLevel?: string):
        Promise<{ version: string; tools: string[]; resources: string }> {
        return this.request({ type: 'open', model, cwd, ...(credential ? { credential } : {}), thinkingLevel });
    }

    openWorkSession(model: { baseUrl: string; [key: string]: unknown }, cwd: string, credential?: string,
        thinkingLevel?: string, processAvailable = true):
        Promise<{ version: string; tools: string[]; resources: string }> {
        return this.request({ type: 'open', mode: 'work', model, cwd,
            ...(credential ? { credential } : {}), thinkingLevel, workProcessAvailable: processAvailable });
    }

    openChatToolsSession(model: { baseUrl: string; [key: string]: unknown }, cwd: string, credential?: string,
        thinkingLevel?: string, roadmapTools = false, roadmapGeneration = false):
        Promise<{ version: string; tools: string[]; resources: string }> {
        return this.request({ type: 'open', mode: 'chat-tools', model, cwd, roadmapTools, roadmapGeneration,
            ...(credential ? { credential } : {}), thinkingLevel });
    }

    runWork(prompt: string, onTool: NonNullable<Pending['onTool']>, onEvent?: (event: PiWorkEvent) => void,
        recoveryContext?: string):
        Promise<{ text: string; textTruncated?: boolean; modelId: string; usage?: PiTokenUsage; compaction?: PiContextRecord }> {
        return this.request({ type: 'work', prompt, ...(recoveryContext ? { recoveryContext } : {}) }, event => {
            if (event.type !== 'work') throw new Error('Invalid Pi Work stream event');
            onEvent?.(event);
        }, onTool);
    }

    closeSession(): Promise<{ closed: boolean }> {
        return this.request({ type: 'close' });
    }

    /** P2 fixture only; P3 owns streamed Chat and cancellation. */
    completeSynthetic(prompt: string): Promise<{ text: string }> {
        return this.request({ type: 'complete', prompt });
    }

    async *streamTurn(messages: readonly { role: 'system' | 'user' | 'assistant'; content: string }[],
        maxOutputTokens: number, signal?: AbortSignal,
        onTool?: NonNullable<Pending['onTool']>, generationId?: string): AsyncIterable<PiTurnEvent> {
        if (this.paused) throw new Error('Pi turn is awaiting a continuation decision');
        const id = ++this.nextId;
        yield* this.streamSegment({ type: 'turn', messages, maxOutputTokens,
            ...(generationId ? { generationId } : {}) }, id, signal, onTool);
    }

    async *resumeTurn(segmentIndex: number, signal?: AbortSignal,
        onTool?: NonNullable<Pending['onTool']>): AsyncIterable<PiTurnEvent> {
        const paused = this.paused;
        if (!paused || segmentIndex !== paused.segmentIndex + 1)
            throw new Error('Pi continuation unavailable or stale');
        this.paused = undefined; // Claim before the first await: duplicate resumes cannot replay tools.
        yield* this.streamSegment({ type: 'resume', segmentIndex,
            maxOutputTokens: paused.maxOutputTokens }, paused.id, signal, onTool);
    }

    async stopTurn(segmentIndex: number): Promise<{ stopped: true; segmentIndex: number }> {
        const paused = this.paused;
        if (!paused || paused.segmentIndex !== segmentIndex)
            throw new Error('Pi continuation unavailable or stale');
        this.paused = undefined;
        try {
            const result = await this.request<{ stopped: true; segmentIndex: number }>(
                { type: 'stop', segmentIndex }, undefined, undefined, paused.id);
            if (result?.stopped !== true || result.segmentIndex !== segmentIndex)
                throw new Error('Invalid Pi stop result');
            return result;
        } finally { this.dispose(); }
    }

    private async *streamSegment(record: Record<string, unknown>, id: number, signal?: AbortSignal,
        onTool?: NonNullable<Pending['onTool']>): AsyncIterable<PiTurnEvent> {
        if (signal?.aborted) throw new Error('Pi turn cancelled');
        const queue: ({ type: 'delta'; text: string } | { type: 'reset' } |
            { type: 'activity'; kind: 'thinking' | 'provisional'; text: string })[] = [];
        let queueBytes = 0;
        let wake: (() => void) | undefined;
        let settled = false;
        let result: PiTurnResult | undefined;
        let failure: unknown;
        const notify = () => { wake?.(); wake = undefined; };
        const onAbort = () => this.dispose();
        signal?.addEventListener('abort', onAbort, { once: true });
        const task = this.request<PiTurnResult>(record, event => {
            if (event.type !== 'delta' && event.type !== 'activity' && event.type !== 'reset')
                throw new Error('Invalid Pi Chat stream event');
            const bytes = event.type === 'reset' ? 0 : Buffer.byteLength(event.text, 'utf8');
            if (bytes > 8192 || queue.length >= 8192 || queueBytes + bytes > 16 * 1024 * 1024)
                throw new Error('Pi Chat stream backpressure limit exceeded');
            queueBytes += bytes; queue.push(event); notify();
        }, onTool, id).then(value => { result = value; }, error => { failure = error; })
            .finally(() => { settled = true; notify(); });
        try {
            while (!settled || queue.length) {
                if (signal?.aborted) throw new Error('Pi turn cancelled');
                if (queue.length) {
                    const next = queue.shift()!;
                    queueBytes -= next.type === 'reset' ? 0 : Buffer.byteLength(next.text, 'utf8');
                    yield next; continue;
                }
                await new Promise<void>(resolve => { wake = resolve; });
            }
            await task;
            if (signal?.aborted) throw new Error('Pi turn cancelled');
            if (failure) throw failure;
            if (!result) throw new Error('Pi turn ended without completion');
            if (result.segmentIndex !== (record.type === 'resume' ? record.segmentIndex : 1) ||
                !['length', 'stop'].includes(result.finishReason) ||
                !Number.isSafeInteger(result.segmentIndex) || result.segmentIndex < 1 ||
                typeof result.text !== 'string' || Buffer.byteLength(result.text, 'utf8') > 65536 ||
                typeof result.modelId !== 'string' || !validUsage(result.usage) ||
                (result.segmentUsage !== undefined && !validUsage(result.segmentUsage)) ||
                (result.usageSegments !== undefined && (!Array.isArray(result.usageSegments) ||
                    result.usageSegments.length !== result.segmentIndex || result.usageSegments.length > 4 ||
                    !result.usageSegments.every(validUsage))) ||
                !consistentUsage(result) ||
                (result.lastCallOutputTokens !== undefined &&
                    (!Number.isSafeInteger(result.lastCallOutputTokens) || result.lastCallOutputTokens < 0 ||
                        result.lastCallOutputTokens > Number(record.maxOutputTokens) ||
                        result.segmentUsage?.outputTokens !== undefined &&
                        result.lastCallOutputTokens > result.segmentUsage.outputTokens)) ||
                (result.lastCallOutputTokens === undefined && result.segmentUsage?.outputTokens !== undefined &&
                    result.segmentUsage.outputTokens > Number(record.maxOutputTokens)) ||
                (record.type === 'resume' && typeof result.novelText !== 'string'))
                throw new Error('Invalid Pi turn result');
            if (result.finishReason === 'length') this.paused = { id, segmentIndex: result.segmentIndex,
                maxOutputTokens: Number(record.maxOutputTokens) };
            yield { type: result.finishReason === 'length' ? 'paused' : 'complete',
                result: { ...result, outputCeilingTokens: Number(record.maxOutputTokens) } };
        } finally { signal?.removeEventListener('abort', onAbort); }
    }

    private request<T>(record: Record<string, unknown>, onEvent?: Pending['onEvent'],
        onTool?: Pending['onTool'], requestId?: number): Promise<T> {
        const child = this.child;
        if (!child || child.exitCode !== null || child.killed) return Promise.reject(new Error('Pi worker unavailable'));
        const id = requestId ?? ++this.nextId;
        if (this.pending.has(id)) return Promise.reject(new Error('Pi worker request already active'));
        const line = `${JSON.stringify({ ...record, id })}\n`;
        if (Buffer.byteLength(line, 'utf8') > 600_000 || child.stdin.writableLength > 600_000)
            return Promise.reject(new Error('Pi worker request exceeds bounded input capacity'));
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error('Pi worker response timed out'));
                this.dispose();
            }, record.type === 'work' ? 1_800_000 :
                ['complete', 'turn', 'resume'].includes(String(record.type)) ? 900_000 : 10_000);
            this.pending.set(id, { resolve: value => resolve(value as T), reject, timer, onEvent, onTool });
            child.stdin.write(line, error => {
                if (error) this.fail(error);
            });
        });
    }

    private acceptOutput(chunk: string): void {
        this.stdout += chunk;
        if (this.stdout.length > 1_000_000) {
            this.fail(new Error('Pi worker output limit exceeded'));
            return;
        }
        let newline: number;
        while ((newline = this.stdout.indexOf('\n')) >= 0) {
            const line = this.stdout.slice(0, newline);
            this.stdout = this.stdout.slice(newline + 1);
            try {
                const record = JSON.parse(line) as { id: number; ok?: boolean; data?: unknown; error?: string;
                    event?: { type: 'delta'; text: string } | { type: 'reset' } |
                        { type: 'activity'; kind: 'thinking' | 'provisional'; text: string } | PiWorkEvent;
                    tool?: { id: number; name: string; arguments: unknown } };
                const pending = this.pending.get(record.id);
                if (!pending) throw new Error('Unexpected Pi worker response');
                if (record.tool) {
                    if (!pending.onTool || !Number.isSafeInteger(record.tool.id) || record.tool.id < 1 ||
                        typeof record.tool.name !== 'string') throw new Error('Unexpected Pi tool call');
                    if (process.env.DOPE_PI_CONTINUATION_TRACE === '1')
                        console.info('[dope-pi-continuation]', JSON.stringify({ at: new Date().toISOString(),
                            stage: 'broker-received', requestId: record.id, toolId: record.tool.id,
                            toolName: record.tool.name }));
                    void pending.onTool(record.tool).then(result => {
                        if (!this.pending.has(record.id)) return;
                        if (process.env.DOPE_PI_CONTINUATION_TRACE === '1')
                            console.info('[dope-pi-continuation]', JSON.stringify({ at: new Date().toISOString(),
                                stage: 'broker-completed', requestId: record.id, toolId: record.tool!.id,
                                status: (result as { status?: string })?.status,
                                outputBytes: Buffer.byteLength((result as { output?: string })?.output ?? '') }));
                        return this.request({ type: 'tool-result', toolId: record.tool!.id, result });
                    }, () => {
                        if (!this.pending.has(record.id)) return;
                        return this.request({ type: 'tool-result', toolId: record.tool!.id,
                            result: { status: 'denied', output: '' } });
                    }).catch(() => this.fail(new Error('Pi tool reply failed')));
                    continue;
                }
                if (record.event) {
                    if (record.event.type === 'work') {
                        const event = record.event;
                        if (!pending.onTool || !pending.onEvent || !Number.isSafeInteger(event.sequence) ||
                            event.sequence !== (pending.lastWorkSequence ?? 0) + 1 || event.sequence > 512 ||
                            Object.keys(event).some(key => !['type', 'sequence', 'kind', 'toolName', 'isError', 'aborted', 'text', 'truncated',
                                'reason', 'durationMs', 'tokensBeforeEstimate', 'tokensAfterEstimate', 'summaryBytes', 'summarizationTokensReported'].includes(key)) ||
                            !['agent_start', 'turn_start', 'turn_end', 'agent_end', 'agent_settled',
                                'tool_execution_start', 'tool_execution_end', 'reasoning', 'reasoning_omitted',
                                'compaction_succeeded', 'compaction_failed'].includes(event.kind) ||
                            (event.toolName !== undefined && (!['read_file', 'list_files', 'edit_file', 'run_command', 'read_command_output']
                                .includes(event.toolName) || !event.kind.startsWith('tool_execution_'))) ||
                            (event.kind.startsWith('tool_execution_') !== (event.toolName !== undefined)) ||
                            (event.kind === 'reasoning' ? typeof event.text !== 'string' ||
                                Buffer.byteLength(event.text, 'utf8') > 8000 ||
                                (event.truncated !== undefined && typeof event.truncated !== 'boolean') :
                                event.text !== undefined || event.truncated !== undefined) ||
                            (event.isError !== undefined && (event.kind !== 'tool_execution_end' || typeof event.isError !== 'boolean')) ||
                            (event.aborted !== undefined && (event.kind !== 'agent_settled' || typeof event.aborted !== 'boolean')) ||
                            (event.kind.startsWith('compaction_') ?
                                !['threshold', 'overflow', 'manual'].includes(event.reason ?? '') ||
                                ['durationMs', 'tokensBeforeEstimate', 'tokensAfterEstimate', 'summaryBytes',
                                    'summarizationTokensReported'].some(key => {
                                    const value = event[key as keyof PiWorkEvent];
                                    return value !== undefined && (typeof value !== 'number' ||
                                        !Number.isSafeInteger(value) || value < 0);
                                }) || event.kind === 'compaction_succeeded' &&
                                (event.durationMs === undefined || event.tokensBeforeEstimate === undefined ||
                                    event.summaryBytes === undefined) :
                                event.reason !== undefined || event.durationMs !== undefined ||
                                event.tokensBeforeEstimate !== undefined || event.tokensAfterEstimate !== undefined ||
                                event.summaryBytes !== undefined || event.summarizationTokensReported !== undefined))
                            throw new Error('Invalid Pi Work event');
                        pending.lastWorkSequence = event.sequence;
                    } else if (record.event.type === 'reset' ?
                        Object.keys(record.event).length !== 1 : (record.event.type !== 'delta' &&
                        !(record.event.type === 'activity' &&
                            ['thinking', 'provisional'].includes(record.event.kind))) ||
                        typeof record.event.text !== 'string' || Buffer.byteLength(record.event.text, 'utf8') > 8192)
                        throw new Error('Invalid Pi stream event');
                    pending.onEvent?.(record.event);
                    continue;
                }
                this.pending.delete(record.id);
                clearTimeout(pending.timer);
                if (record.ok) pending.resolve(record.data);
                else pending.reject(new Error(record.error ?? 'Pi worker rejected request'));
            } catch (error) {
                this.fail(error instanceof Error && error.message === 'Pi Chat stream backpressure limit exceeded' ?
                    error : new Error('Invalid Pi worker protocol'));
                return;
            }
        }
    }

    private fail(error: Error): void {
        this.paused = undefined;
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pending.clear();
        this.stdout = '';
        this.child?.kill();
        this.child = undefined;
    }

    dispose(): void { this.fail(new Error('Pi runtime disposed')); }
}

/** Injectable host factory. An unexpected exit fails current work; a new host is explicit. */
export class PiRuntimeFactory {
    private readonly hosts = new Set<PiRuntimeHost>();

    create(): PiRuntimeHost {
        const host = new PiRuntimeHost();
        this.hosts.add(host);
        return host;
    }

    release(host: PiRuntimeHost): void {
        host.dispose();
        this.hosts.delete(host);
    }

    dispose(): void {
        for (const host of this.hosts) host.dispose();
        this.hosts.clear();
    }
}
