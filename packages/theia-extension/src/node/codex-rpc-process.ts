import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';

const failure = (message: string, kind: ModelRuntimeFailure['failureClass']) => new ModelRuntimeFailure(message, kind);
const object = (value: unknown): Record<string, any> | undefined =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : undefined;
export function providerFailure(value: unknown): ModelRuntimeFailure {
    const error = object(value);
    const code = typeof error?.code === 'string' ? error.code :
        typeof object(error?.error)?.code === 'string' ? object(error?.error)!.code as string : '';
    if (['subscription_sharing_usage_limit_exceeded', 'subscription_sharing_usage_unavailable',
        'subscription_sharing_user_unavailable'].includes(code)) return failure('ChatGPT plan usage unavailable', 'transient-upstream');
    if (['subscription_sharing_invalid_user', 'chatpass_v2_scope_not_authorized',
        'chatpass_v2_invalid_authorization_context', 'subscription_sharing_user_not_eligible'].includes(code))
        return failure('ChatGPT account needs authorization', 'authentication');
    if (code === 'model_not_found') return failure('Codex model unavailable', 'model-unavailable');
    return failure('Codex request failed', 'nonretryable-provider');
}

export class RpcProcess {
    private nextId = 0;
    private buffer = '';
    private readonly pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
    private readonly subscribers = new Set<(method: string, params: any) => void>();
    private dead = false;

    constructor(readonly child: ChildProcessWithoutNullStreams, private readonly timeoutMs: number,
        private readonly strict = false, private readonly killGroup = false) {
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
            this.buffer += chunk;
            if (this.buffer.length > 1024 * 1024) { this.stop(); return; }
            let newline: number;
            while ((newline = this.buffer.indexOf('\n')) !== -1) {
                const line = this.buffer.slice(0, newline).trim();
                this.buffer = this.buffer.slice(newline + 1);
                if (!line) continue;
                try { this.message(JSON.parse(line)); } catch { if (this.strict) this.stop(); }
            }
        });
        child.stdin.on('error', () => this.stop());
        child.stdout.on('error', () => this.stop());
        child.stderr.resume();
        child.on('error', () => this.stop());
        child.on('exit', () => this.stop());
    }
    private message(value: unknown): void {
        const message = object(value);
        if (!message || message.jsonrpc && message.jsonrpc !== '2.0') {
            if (this.strict) this.stop();
            return;
        }
        if (typeof message.id === 'number') {
            const pending = this.pending.get(message.id);
            if (!pending) return;
            this.pending.delete(message.id);
            clearTimeout(pending.timer);
            if (message.error !== undefined) {
                const error = object(message.error);
                pending.reject(error?.code === -32601 ? failure('Codex protocol incompatible', 'unsupported-capability') :
                    error?.code === 401 || error?.code === 403 ? failure('ChatGPT account needs authorization', 'authentication') :
                        providerFailure(error?.data ?? error));
            } else if (message.result !== undefined) pending.resolve(message.result);
            else pending.reject(failure('Invalid Codex response', 'invalid-json'));
        } else if (typeof message.method === 'string') {
            if (message.id !== undefined) {
                for (const subscriber of this.subscribers) subscriber('__server/request', { method: message.method });
                this.notifyResponse(message.id);
                return;
            }
            for (const subscriber of this.subscribers) subscriber(message.method, message.params);
        }
    }
    private notifyResponse(id: unknown): void {
        if (!this.dead) this.child.stdin.write(`${JSON.stringify({ id, error: { code: -32601, message: 'Unsupported client request' } })}\n`);
    }
    subscribe(listener: (method: string, params: any) => void): () => void {
        this.subscribers.add(listener);
        return () => this.subscribers.delete(listener);
    }
    notify(method: string): void {
        if (this.dead) throw failure('Codex process unavailable', 'connection-unavailable');
        this.child.stdin.write(`${JSON.stringify({ method, params: {} })}\n`);
    }
    request(method: string, params: object, timeoutMs = this.timeoutMs): Promise<any> {
        if (this.dead) return Promise.reject(failure('Codex process unavailable', 'connection-unavailable'));
        const id = ++this.nextId;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pending.delete(id);
                reject(failure('Codex request timed out', 'transient-transport'));
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
            this.child.stdin.write(`${JSON.stringify({ id, method, params })}\n`, error => {
                if (error && this.pending.delete(id)) { clearTimeout(timer); reject(failure('Codex process unavailable', 'connection-unavailable')); }
            });
        });
    }
    get alive(): boolean { return !this.dead; }
    private signal(signal: NodeJS.Signals): void {
        if (this.killGroup && process.platform !== 'win32' && this.child.pid) {
            try { process.kill(-this.child.pid, signal); return; } catch {}
        }
        this.child.kill(signal);
    }
    stop(): void {
        if (this.dead) return;
        this.dead = true;
        for (const subscriber of this.subscribers) subscriber('__process/exit', {});
        for (const pending of this.pending.values()) {
            clearTimeout(pending.timer);
            pending.reject(failure('Codex process unavailable', 'connection-unavailable'));
        }
        this.pending.clear();
        this.subscribers.clear();
        this.child.stdin.end();
        if (this.killGroup && this.child.pid || this.child.exitCode === null) {
            this.signal('SIGTERM');
            const timer = setTimeout(() => {
                if (this.killGroup && this.child.pid) this.signal('SIGKILL');
                else if (this.child.exitCode === null) this.signal('SIGKILL');
            }, 1000);
            timer.unref();
            if (!this.killGroup || !this.child.pid) this.child.once('exit', () => clearTimeout(timer));
        }
    }
}
