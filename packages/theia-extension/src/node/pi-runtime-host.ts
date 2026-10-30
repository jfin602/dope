import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export interface PiRuntimeDiagnostics {
    version: string;
    transport: 'supervised-worker';
    tools: string[];
}

type Pending = { resolve(value: unknown): void; reject(error: Error): void; timer: NodeJS.Timeout;
    onEvent?: (event: { type: 'delta'; text: string }) => void };

/** Only Dope-owned paths are considered. No PATH lookup or user Pi installation is used. */
export function resolvePiWorkerPath(): string {
    const packaged = process.resourcesPath && join(process.resourcesPath, 'app/pi-runtime/worker.mjs');
    if (packaged && existsSync(packaged)) return packaged;
    const development = resolve(__dirname, '../../../pi-runtime/worker.mjs');
    if (existsSync(development)) return development;
    throw new Error('Bundled Pi runtime unavailable');
}

export class PiRuntimeHost {
    private child?: ChildProcessWithoutNullStreams;
    private nextId = 0;
    private stdout = '';
    private readonly pending = new Map<number, Pending>();

    constructor(private readonly workerPath = resolvePiWorkerPath(),
        private readonly executable = process.execPath) {}

    async start(): Promise<PiRuntimeDiagnostics> {
        if (this.child) throw new Error('Pi runtime already started');
        const child = spawn(this.executable, [this.workerPath], {
            stdio: ['pipe', 'pipe', 'pipe'],
            env: {
                ELECTRON_RUN_AS_NODE: '1',
                PI_OFFLINE: '1',
                PI_TELEMETRY: '0'
            }
        });
        this.child = child;
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => this.acceptOutput(chunk));
        child.stderr.on('data', () => { /* Diagnostics never enter user-facing responses. */ });
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
    openNoToolSession(model: { baseUrl: string; [key: string]: unknown }, cwd: string, credential?: string):
        Promise<{ version: string; tools: string[]; resources: string }> {
        return this.request({ type: 'open', model, cwd, ...(credential ? { credential } : {}) });
    }

    closeSession(): Promise<{ closed: boolean }> {
        return this.request({ type: 'close' });
    }

    /** P2 fixture only; P3 owns streamed Chat and cancellation. */
    completeSynthetic(prompt: string): Promise<{ text: string }> {
        return this.request({ type: 'complete', prompt });
    }

    async *streamTurn(messages: readonly { role: 'system' | 'user' | 'assistant'; content: string }[],
        maxOutputTokens: number, signal?: AbortSignal): AsyncIterable<
        { type: 'delta'; text: string } | { type: 'complete'; text: string; modelId: string;
            finishReason: string; usage: { inputTokens?: number; outputTokens?: number;
                totalTokens?: number; tokenMeasurement: 'provider-reported' | 'unavailable' } }> {
        if (signal?.aborted) throw new Error('Pi turn cancelled');
        const queue: { type: 'delta'; text: string }[] = [];
        let wake: (() => void) | undefined;
        let settled = false;
        let result: { text: string; modelId: string; finishReason: string;
            usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number;
                tokenMeasurement: 'provider-reported' | 'unavailable' } } | undefined;
        let failure: unknown;
        const notify = () => { wake?.(); wake = undefined; };
        const onAbort = () => this.dispose();
        signal?.addEventListener('abort', onAbort, { once: true });
        const task = this.request<typeof result>({ type: 'turn', messages, maxOutputTokens }, event => {
            queue.push(event); notify();
        }).then(value => { result = value; }, error => { failure = error; })
            .finally(() => { settled = true; notify(); });
        try {
            while (!settled || queue.length) {
                if (signal?.aborted) throw new Error('Pi turn cancelled');
                if (queue.length) { yield queue.shift()!; continue; }
                await new Promise<void>(resolve => { wake = resolve; });
            }
            await task;
            if (signal?.aborted) throw new Error('Pi turn cancelled');
            if (failure) throw failure;
            if (!result) throw new Error('Pi turn ended without completion');
            yield { type: 'complete', ...result };
        } finally { signal?.removeEventListener('abort', onAbort); }
    }

    private request<T>(record: Record<string, unknown>, onEvent?: Pending['onEvent']): Promise<T> {
        const child = this.child;
        if (!child || child.exitCode !== null || child.killed) return Promise.reject(new Error('Pi worker unavailable'));
        const id = ++this.nextId;
        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(new Error('Pi worker response timed out'));
                this.dispose();
            }, record.type === 'complete' || record.type === 'turn' ? 300_000 : 10_000);
            this.pending.set(id, { resolve: value => resolve(value as T), reject, timer, onEvent });
            child.stdin.write(`${JSON.stringify({ ...record, id })}\n`, error => {
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
                    event?: { type: 'delta'; text: string } };
                const pending = this.pending.get(record.id);
                if (!pending) throw new Error('Unexpected Pi worker response');
                if (record.event) {
                    if (record.event.type !== 'delta' || typeof record.event.text !== 'string')
                        throw new Error('Invalid Pi stream event');
                    pending.onEvent?.(record.event);
                    continue;
                }
                this.pending.delete(record.id);
                clearTimeout(pending.timer);
                if (record.ok) pending.resolve(record.data);
                else pending.reject(new Error(record.error ?? 'Pi worker rejected request'));
            } catch {
                this.fail(new Error('Invalid Pi worker protocol'));
                return;
            }
        }
    }

    private fail(error: Error): void {
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
