import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ConversationRequest } from '@dope/contracts/lib/model-runtime';

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

export type PiWorkerFailureCode = 'session_init' | 'provider_http' | 'provider_connection' |
    'tool_protocol' | 'model_generation' | 'worker_exit' | 'worker_protocol' |
    'context_limit' | 'output_limit' | 'worker_timeout' | 'resource_limit' | 'policy_limit' | 'policy_invalid' |
    'model_tool_call_invalid' | 'broker_tool_denied' | 'broker_tool_failed' |
    'tool_reply_invalid' | 'tool_reply_unmatched' | 'tool_reply_duplicate' |
    'tool_reply_delivery_failed' | 'worker_dispatch_failed' |
    'session_closed_with_pending_tool' | 'tool_protocol_unknown' |
    'continuation_unavailable' | 'continuation_expired' | 'continuation_result_invalid' |
    'continuation_pi_rejected' | 'continuation_model_drift';
export interface PiToolFailureDetail { stage: PiWorkerFailureCode; requestId?: number;
    toolId?: number; toolName?: string; lastConfirmed?: { requestId: number;
        toolId: number; toolName: string; outcome: string }; brokerResultAcknowledged: boolean;
    elapsedMs?: number; failureOrigin?: 'tool_budget' | 'model_call_budget' | 'attempted_tool' |
        'missing_final_assistant' | 'response_aborted' | 'provider_failure' |
        'invalid_final_tool_call' | 'invalid_final_assistant';
    toolStarts?: number; toolAcknowledgements?: number;
    failedToolStart?: { ordinal: number; toolName: string } }
export class PiWorkerFailure extends Error {
    constructor(readonly code: PiWorkerFailureCode, readonly httpStatus?: number,
        readonly toolFailure?: PiToolFailureDetail) {
        super(`Pi worker ${code}`);
    }
}
const workerFailureCodes = new Set<PiWorkerFailureCode>(['session_init', 'provider_http',
    'provider_connection', 'tool_protocol', 'model_generation', 'worker_exit', 'worker_protocol',
    'context_limit', 'output_limit', 'worker_timeout', 'resource_limit', 'policy_limit', 'policy_invalid',
    'model_tool_call_invalid', 'broker_tool_denied', 'broker_tool_failed',
    'tool_reply_invalid', 'tool_reply_unmatched', 'tool_reply_duplicate',
    'tool_reply_delivery_failed', 'worker_dispatch_failed',
    'session_closed_with_pending_tool', 'tool_protocol_unknown',
    'continuation_unavailable', 'continuation_expired', 'continuation_result_invalid',
    'continuation_pi_rejected', 'continuation_model_drift']);
const failureOrigins = new Set(['tool_budget', 'model_call_budget', 'generation_budget', 'operation_policy', 'attempted_tool',
    'missing_final_assistant', 'response_aborted', 'provider_failure',
    'invalid_final_tool_call', 'invalid_final_assistant']);
const boundedCount = (value: unknown): value is number =>
    Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 1_000_000;
const offeredToolNames = new Set(['read_file', 'list_files', 'search_paths', 'search_text',
    'run_command', 'edit_file', 'read_command_output', 'roadmap_read', 'roadmap_stage',
    'roadmap_cancel', 'roadmap_phase', 'roadmap_finish', 'proposal_status',
    'proposal_stage_document', 'proposal_stage_prompt', 'proposal_finish',
    'assessment_status', 'assessment_stage', 'assessment_finish']);

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
    private readonly seenToolIds = new Set<number>();
    private readonly toolReplyRequestIds = new Set<number>();
    private readonly activeTools = new Map<number, { requestId: number; name: string; startedAt: number }>();
    private lastConfirmed?: PiToolFailureDetail['lastConfirmed'];
    private paused?: { id: number; segmentIndex: number; maxOutputTokens: number };

    constructor(private readonly workerPath = resolvePiWorkerPath(),
        private readonly executable = process.execPath) {}

    async start(): Promise<PiRuntimeDiagnostics> {
        if (this.child) throw new Error('Pi runtime already started');
        this.seenToolIds.clear();
        this.toolReplyRequestIds.clear();
        this.activeTools.clear();
        this.lastConfirmed = undefined;
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
        child.on('error', () => this.fail(new PiWorkerFailure(this.activeTools.size ?
            'session_closed_with_pending_tool' : 'worker_exit')));
        child.on('exit', () => this.fail(new PiWorkerFailure(this.activeTools.size ?
            'session_closed_with_pending_tool' : 'worker_exit')));
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
        thinkingLevel?: string, roadmapTools = false, roadmapGeneration = false, proposalTools = false,
        assessmentTools = false, operationPolicy?: NonNullable<ConversationRequest['projectTools']>['operationPolicy']):
        Promise<{ version: string; tools: string[]; resources: string }> {
        return this.request({ type: 'open', mode: 'chat-tools', model, cwd, roadmapTools, roadmapGeneration,
            proposalTools, assessmentTools,
            ...(operationPolicy ? { operationPolicy } : {}),
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
        onTool?: NonNullable<Pending['onTool']>, generationId?: string,
        operationPolicy?: NonNullable<ConversationRequest['projectTools']>['operationPolicy']): AsyncIterable<PiTurnEvent> {
        if (this.paused) throw new Error('Pi turn is awaiting a continuation decision');
        const id = ++this.nextId;
        yield* this.streamSegment({ type: 'turn', messages, maxOutputTokens,
            ...(generationId ? { generationId } : {}),
            ...(operationPolicy ? { operationPolicy } : {}) }, id, signal, onTool);
    }

    async *resumeTurn(segmentIndex: number, signal?: AbortSignal,
        onTool?: NonNullable<Pending['onTool']>): AsyncIterable<PiTurnEvent> {
        const paused = this.paused;
        if (!paused || segmentIndex !== paused.segmentIndex + 1)
            throw new PiWorkerFailure('continuation_unavailable');
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
                throw new PiWorkerFailure('resource_limit');
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
                throw new PiWorkerFailure(record.type === 'resume' ?
                    'continuation_result_invalid' : 'worker_protocol');
            if (result.finishReason === 'length') this.paused = { id, segmentIndex: result.segmentIndex,
                maxOutputTokens: Number(record.maxOutputTokens) };
            yield { type: result.finishReason === 'length' ? 'paused' : 'complete',
                result: { ...result, outputCeilingTokens: Number(record.maxOutputTokens) } };
        } finally { signal?.removeEventListener('abort', onAbort); }
    }

    private request<T>(record: Record<string, unknown>, onEvent?: Pending['onEvent'],
        onTool?: Pending['onTool'], requestId?: number): Promise<T> {
        const child = this.child;
        if (!child || child.exitCode !== null || child.killed) return Promise.reject(
            new PiWorkerFailure(record.type === 'tool-result' ? 'tool_reply_delivery_failed' : 'worker_exit',
                undefined, this.toolDetail(record.type === 'tool-result' ?
                    'tool_reply_delivery_failed' : 'worker_exit')));
        const id = requestId ?? ++this.nextId;
        if (this.pending.has(id)) return Promise.reject(new Error('Pi worker request already active'));
        const line = `${JSON.stringify({ ...record, id })}\n`;
        if (Buffer.byteLength(line, 'utf8') > 600_000 || child.stdin.writableLength > 600_000)
            return Promise.reject(new PiWorkerFailure('resource_limit'));
        if (record.type === 'tool-result') this.toolReplyRequestIds.add(id);
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                const code = record.type === 'tool-result' ?
                    'tool_reply_delivery_failed' : 'worker_timeout';
                const failure = new PiWorkerFailure(code, undefined, this.toolDetail(code));
                reject(failure);
                this.fail(failure);
            }, record.type === 'work' ? 1_800_000 :
                ['complete', 'turn', 'resume'].includes(String(record.type)) ? 900_000 : 10_000);
            this.pending.set(id, { resolve: value => resolve(value as T), reject, timer, onEvent, onTool });
            child.stdin.write(line, error => {
                if (error) this.fail(new PiWorkerFailure(record.type === 'tool-result' ?
                    'tool_reply_delivery_failed' : 'worker_protocol'));
            });
        });
    }

    private acceptOutput(chunk: string): void {
        this.stdout += chunk;
        if (this.stdout.length > 1_000_000) {
            this.fail(new PiWorkerFailure('resource_limit'));
            return;
        }
        let newline: number;
        while ((newline = this.stdout.indexOf('\n')) >= 0) {
            const line = this.stdout.slice(0, newline);
            this.stdout = this.stdout.slice(newline + 1);
            try {
                const record = JSON.parse(line) as { id: number; ok?: boolean; data?: unknown; error?: string;
                    errorCode?: PiWorkerFailureCode; httpStatus?: number;
                    failureOrigin?: unknown; toolStarts?: unknown; toolAcknowledgements?: unknown;
                    failedToolStart?: unknown;
                    lastToolReceipt?: PiToolFailureDetail['lastConfirmed'];
                    event?: { type: 'delta'; text: string } | { type: 'reset' } |
                        { type: 'activity'; kind: 'thinking' | 'provisional'; text: string } | PiWorkEvent;
                    tool?: { id: number; name: string; arguments: unknown } };
                const pending = this.pending.get(record.id);
                if (!pending) throw new PiWorkerFailure(this.toolReplyRequestIds.has(record.id) ?
                    'tool_reply_duplicate' : 'tool_reply_unmatched');
                if (record.tool) {
                    if (!pending.onTool || !Number.isSafeInteger(record.tool.id) || record.tool.id < 1 ||
                        typeof record.tool.name !== 'string') throw new PiWorkerFailure('tool_reply_invalid');
                    if (!offeredToolNames.has(record.tool.name))
                        throw new PiWorkerFailure('model_tool_call_invalid');
                    if (this.seenToolIds.has(record.tool.id)) throw new PiWorkerFailure('tool_reply_duplicate');
                    this.seenToolIds.add(record.tool.id);
                    this.activeTools.set(record.tool.id, { requestId: record.id,
                        name: record.tool.name, startedAt: Date.now() });
                    if (process.env.DOPE_PI_CONTINUATION_TRACE === '1')
                        console.info('[dope-pi-continuation]', JSON.stringify({ at: new Date().toISOString(),
                            stage: 'broker-received', requestId: record.id, toolId: record.tool.id,
                            toolName: record.tool.name }));
                    void pending.onTool(record.tool).then(result => {
                        if (!this.pending.has(record.id)) return;
                        if (!result || typeof result !== 'object' ||
                            !['completed', 'failed', 'denied'].includes((result as { status?: string }).status ?? '') ||
                            typeof (result as { output?: unknown }).output !== 'string')
                            throw new PiWorkerFailure('tool_reply_invalid');
                        if (process.env.DOPE_PI_CONTINUATION_TRACE === '1')
                            console.info('[dope-pi-continuation]', JSON.stringify({ at: new Date().toISOString(),
                                stage: 'broker-completed', requestId: record.id, toolId: record.tool!.id,
                                status: (result as { status?: string })?.status,
                                outputBytes: Buffer.byteLength((result as { output?: string })?.output ?? '') }));
                        return this.request({ type: 'tool-result', requestId: record.id,
                            toolId: record.tool!.id, result }).then(ack => {
                            if (!ack || typeof ack !== 'object' ||
                                (ack as { received?: unknown }).received !== true ||
                                (ack as { requestId?: unknown }).requestId !== record.id ||
                                (ack as { toolId?: unknown }).toolId !== record.tool!.id)
                                throw new PiWorkerFailure('tool_reply_invalid');
                            this.lastConfirmed = { requestId: record.id, toolId: record.tool!.id,
                                toolName: record.tool!.name, outcome: (result as { status: string }).status };
                            this.activeTools.delete(record.tool!.id);
                        });
                    }, () => {
                        if (!this.pending.has(record.id)) return;
                        return this.request({ type: 'tool-result', requestId: record.id,
                            toolId: record.tool!.id, result: { status: 'failed', output: '' } }).then(ack => {
                            if (!ack || typeof ack !== 'object' ||
                                (ack as { received?: unknown }).received !== true ||
                                (ack as { requestId?: unknown }).requestId !== record.id ||
                                (ack as { toolId?: unknown }).toolId !== record.tool!.id)
                                throw new PiWorkerFailure('tool_reply_invalid');
                            this.lastConfirmed = { requestId: record.id, toolId: record.tool!.id,
                                toolName: record.tool!.name, outcome: 'failed' };
                            this.activeTools.delete(record.tool!.id);
                        });
                    }).catch(error => this.fail(error instanceof PiWorkerFailure ? error :
                        new PiWorkerFailure('tool_reply_delivery_failed')));
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
                else pending.reject(record.errorCode && workerFailureCodes.has(record.errorCode) ?
                    new PiWorkerFailure(record.errorCode,
                        Number.isSafeInteger(record.httpStatus) && record.httpStatus! >= 400 &&
                        record.httpStatus! <= 599 ? record.httpStatus : undefined,
                        this.toolDetail(record.errorCode, record.lastToolReceipt, record)) :
                    new PiWorkerFailure('worker_protocol'));
            } catch (error) {
                this.fail(error instanceof PiWorkerFailure ? error : new PiWorkerFailure('worker_protocol'));
                return;
            }
        }
    }

    private fail(error: Error): void {
        if (error instanceof PiWorkerFailure && !error.toolFailure)
            error = new PiWorkerFailure(error.code, error.httpStatus, this.toolDetail(error.code));
        this.paused = undefined;
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(error);
        }
        this.pending.clear();
        this.activeTools.clear();
        this.stdout = '';
        this.child?.kill();
        this.child = undefined;
    }

    dispose(): void { this.fail(new Error('Pi runtime disposed')); }

    private toolDetail(stage: PiWorkerFailureCode,
        workerReceipt?: PiToolFailureDetail['lastConfirmed'],
        frame?: { failureOrigin?: unknown; toolStarts?: unknown; toolAcknowledgements?: unknown;
            failedToolStart?: unknown }): PiToolFailureDetail {
        const active = this.activeTools.entries().next().value as
            [number, { requestId: number; name: string; startedAt: number }] | undefined;
        const lastConfirmed = workerReceipt && Number.isSafeInteger(workerReceipt.requestId) &&
            workerReceipt.requestId > 0 && Number.isSafeInteger(workerReceipt.toolId) &&
            workerReceipt.toolId > 0 && typeof workerReceipt.toolName === 'string' &&
            /^[a-z_]{1,64}$/u.test(workerReceipt.toolName) &&
            ['completed', 'failed', 'denied'].includes(workerReceipt.outcome) ?
            workerReceipt : this.lastConfirmed;
        const failed = frame?.failedToolStart;
        const failedToolStart = failed && typeof failed === 'object' && !Array.isArray(failed) &&
            boundedCount((failed as { ordinal?: unknown }).ordinal) &&
            (failed as { ordinal: number }).ordinal > 0 &&
            (frame?.toolStarts === undefined || boundedCount(frame.toolStarts) &&
                (failed as { ordinal: number }).ordinal <= frame.toolStarts) &&
            typeof (failed as { toolName?: unknown }).toolName === 'string' &&
            /^[a-z_]{1,64}$/u.test((failed as { toolName: string }).toolName) ?
            failed as PiToolFailureDetail['failedToolStart'] : undefined;
        const toolStarts = boundedCount(frame?.toolStarts) ? frame.toolStarts : undefined;
        const toolAcknowledgements = boundedCount(frame?.toolAcknowledgements) &&
            (toolStarts === undefined || frame.toolAcknowledgements <= toolStarts) ?
            frame.toolAcknowledgements : undefined;
        return { stage, ...(active ? { toolId: active[0], requestId: active[1].requestId,
            toolName: active[1].name, elapsedMs: Math.min(1_800_000,
                Math.max(0, Date.now() - active[1].startedAt)) } : {}),
            ...(lastConfirmed ? { lastConfirmed } : {}),
            ...(failureOrigins.has(String(frame?.failureOrigin)) ?
                { failureOrigin: frame!.failureOrigin as PiToolFailureDetail['failureOrigin'] } : {}),
            ...(toolStarts !== undefined ? { toolStarts } : {}),
            ...(toolAcknowledgements !== undefined ? { toolAcknowledgements } : {}),
            ...(failedToolStart ? { failedToolStart } : {}),
            // lastConfirmed describes a prior result, never proof that the failed attempt arrived.
            brokerResultAcknowledged: false };
    }
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
