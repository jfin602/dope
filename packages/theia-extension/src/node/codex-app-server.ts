import { createHash } from 'node:crypto';
import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { CodexAuthManager } from './codex-auth-manager';

type Failure = ModelRuntimeFailure['failureClass'];
const failure = (message: string, kind: Failure) => new ModelRuntimeFailure(message, kind);
const object = (value: unknown): Record<string, any> | undefined =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : undefined;
const tokenHash = (value: string) => createHash('sha256').update(value).digest('hex');
const appVersion: string = require('../../package.json').version;
function providerFailure(value: unknown): ModelRuntimeFailure {
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
const config = [
    'model_provider="openai_chatgpt_plan"',
    'model_providers.openai_chatgpt_plan.name="ChatGPT plan"',
    'model_providers.openai_chatgpt_plan.base_url="https://api.openai.com/v1"',
    'model_providers.openai_chatgpt_plan.env_key="ACCESS_TOKEN"',
    'model_providers.openai_chatgpt_plan.wire_api="responses"',
    'model_providers.openai_chatgpt_plan.requires_openai_auth=false',
    'model_providers.openai_chatgpt_plan.supports_websockets=false',
    'sandbox_mode="read-only"',
    'approval_policy="never"',
    'features.shell_tool=false',
    'agents.enabled=false',
    'project_doc_max_bytes=0',
    'web_search="disabled"'
];

export interface CodexProcessOptions {
    executable?: string;
    spawnChild?: typeof spawn;
    version?: (executable: string) => Promise<string>;
    fetcher?: typeof fetch;
    timeoutMs?: number;
    idleMs?: number;
}

class RpcProcess {
    private nextId = 0;
    private buffer = '';
    private readonly pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: NodeJS.Timeout }>();
    private readonly subscribers = new Set<(method: string, params: any) => void>();
    private dead = false;

    constructor(readonly child: ChildProcessWithoutNullStreams, private readonly timeoutMs: number) {
        child.stdout.setEncoding('utf8');
        child.stdout.on('data', (chunk: string) => {
            this.buffer += chunk;
            if (this.buffer.length > 1024 * 1024) { this.stop(); return; }
            let newline: number;
            while ((newline = this.buffer.indexOf('\n')) !== -1) {
                const line = this.buffer.slice(0, newline).trim();
                this.buffer = this.buffer.slice(newline + 1);
                if (!line) continue;
                try { this.message(JSON.parse(line)); } catch {}
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
        if (!message || message.jsonrpc && message.jsonrpc !== '2.0') return;
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
        if (this.child.exitCode === null) {
            this.child.kill('SIGTERM');
            const timer = setTimeout(() => { if (this.child.exitCode === null) this.child.kill('SIGKILL'); }, 1000);
            timer.unref();
            this.child.once('exit', () => clearTimeout(timer));
        }
    }
}

interface Session { rpc: RpcProcess; root: string; fingerprint: string; registrationId: string; idle?: NodeJS.Timeout }

export class CodexAppServer {
    private readonly sessions = new Map<string, Session>();
    private readonly starting = new Map<string, Promise<Session>>();
    private readonly executable: string;
    private readonly spawnChild: typeof spawn;
    private readonly version: (executable: string) => Promise<string>;
    private readonly fetcher: typeof fetch;
    private readonly timeoutMs: number;
    private readonly idleMs: number;
    private disposed = false;

    constructor(private readonly auth: Pick<CodexAuthManager, 'accessToken'>, options: CodexProcessOptions = {}) {
        this.executable = options.executable ?? 'codex';
        this.spawnChild = options.spawnChild ?? spawn;
        this.version = options.version ?? (executable => new Promise((resolve, reject) =>
            execFile(executable, ['--version'], { timeout: 3000, cwd: tmpdir() },
                (error, stdout) => error ? reject(error) : resolve(stdout))));
        this.fetcher = options.fetcher ?? fetch;
        this.timeoutMs = options.timeoutMs ?? 8000;
        this.idleMs = options.idleMs ?? 60_000;
    }
    async resolveExecutable(): Promise<string> {
        let version: string;
        try { version = await this.version(this.executable); }
        catch { throw failure('Codex executable unavailable', 'connection-unavailable'); }
        if (!/^codex(?:-cli)?\s+\d+\.\d+\.\d+/.test(version.trim()))
            throw failure('Codex executable version incompatible', 'unsupported-capability');
        return this.executable;
    }
    disconnect(connectionId: string): void { this.close(connectionId); }
    private close(connectionId: string, preserveRoot = false): void {
        const session = this.sessions.get(connectionId);
        if (!session) return;
        this.sessions.delete(connectionId);
        if (session.idle) clearTimeout(session.idle);
        session.rpc.stop();
        if (!preserveRoot) void rm(session.root, { recursive: true, force: true }).catch(() => {});
    }
    dispose(): void {
        this.disposed = true;
        for (const id of this.sessions.keys()) this.close(id);
    }
    private touch(id: string, session: Session): void {
        if (session.idle) clearTimeout(session.idle);
        session.idle = setTimeout(() => this.close(id), this.idleMs);
        session.idle.unref();
    }
    private async session(connectionId: string, registrationId: string): Promise<Session> {
        const accessToken = await this.accessToken(connectionId, registrationId);
        const fingerprint = tokenHash(accessToken);
        const existing = this.sessions.get(connectionId);
        if (existing?.rpc.alive && existing.fingerprint === fingerprint && existing.registrationId === registrationId) {
            this.touch(connectionId, existing); return existing;
        }
        if (this.starting.has(connectionId)) {
            await this.starting.get(connectionId);
            return this.session(connectionId, registrationId);
        }
        const start = (async () => {
            await this.resolveExecutable();
            if (this.disposed) throw failure('Codex adapter disposed', 'connection-unavailable');
            const reusable = this.sessions.get(connectionId) === existing && existing?.registrationId === registrationId;
            const root = reusable ? existing.root : await mkdtemp(join(tmpdir(), 'dope-codex-'));
            this.close(connectionId, reusable);
            try {
                const child = this.spawnChild(this.executable, ['app-server', '--strict-config', '--listen', 'stdio://',
                    ...config.flatMap(value => ['-c', value])], {
                    cwd: root, env: { PATH: process.env.PATH, LANG: process.env.LANG, LC_ALL: process.env.LC_ALL,
                        TMPDIR: process.env.TMPDIR, CODEX_HOME: root, HOME: root, ACCESS_TOKEN: accessToken }, stdio: 'pipe'
                }) as ChildProcessWithoutNullStreams;
                const rpc = new RpcProcess(child, this.timeoutMs);
                const session = { rpc, root, fingerprint, registrationId };
                this.sessions.set(connectionId, session);
                await rpc.request('initialize', { clientInfo: { name: 'Dope', title: 'Dope', version: appVersion } });
                rpc.notify('initialized');
                if (this.disposed) throw failure('Codex adapter disposed', 'connection-unavailable');
                this.touch(connectionId, session);
                return session;
            } catch (error) { this.close(connectionId); await rm(root, { recursive: true, force: true }); throw error; }
        })();
        this.starting.set(connectionId, start);
        try { return await start; } finally { this.starting.delete(connectionId); }
    }
    async models(connectionId: string, registrationId: string): Promise<{ id: string; label: string }[]> {
        const token = await this.accessToken(connectionId, registrationId);
        let response: Response;
        try { response = await this.fetcher('https://api.openai.com/v1/models', {
            headers: { Authorization: `Bearer ${token}` }, redirect: 'error', signal: AbortSignal.timeout(this.timeoutMs)
        }); } catch { throw failure('ChatGPT model catalog unavailable', 'transient-transport'); }
        if (!response.ok) throw failure('ChatGPT model catalog unavailable', response.status === 401 || response.status === 403 ?
            'authentication' : response.status === 429 || response.status >= 500 ? 'transient-upstream' : 'nonretryable-provider');
        let body: unknown;
        try { body = await response.json(); } catch { throw failure('Invalid ChatGPT model catalog', 'invalid-json'); }
        const models = object(body)?.models;
        if (!Array.isArray(models)) throw failure('Invalid ChatGPT model catalog', 'invalid-json');
        return models.filter(model => object(model)?.visibility === 'list' && typeof model.slug === 'string' && model.slug &&
            typeof model.display_name === 'string').map(model => ({ id: model.slug, label: model.display_name }));
    }
    async test(connectionId: string, registrationId: string, model: string): Promise<{ threadId: string; text: string }> {
        const { rpc } = await this.session(connectionId, registrationId);
        const scratch = await mkdtemp(join(tmpdir(), 'dope-codex-test-'));
        try {
            const thread = await rpc.request('thread/start', { model, cwd: scratch, approvalPolicy: 'never', sandbox: 'read-only' });
            const threadId = object(thread)?.thread?.id;
            if (typeof threadId !== 'string' || !threadId) throw failure('Invalid Codex thread', 'invalid-json');
            return { threadId, text: await this.turn(rpc, threadId, scratch) };
        } catch (error) { this.close(connectionId); throw error; }
        finally { await rm(scratch, { recursive: true, force: true }); }
    }
    async resume(connectionId: string, registrationId: string, threadId: string): Promise<void> {
        if (!threadId) throw failure('Invalid Codex thread', 'invalid-json');
        const { rpc, root } = await this.session(connectionId, registrationId);
        await rpc.request('thread/resume', { threadId, cwd: root, approvalPolicy: 'never', sandbox: 'read-only' });
    }
    private async turn(rpc: RpcProcess, threadId: string, cwd: string): Promise<string> {
        let turnId: string | undefined;
        let completed: { status?: string; error?: unknown } | undefined;
        let completedTurnId: string | undefined;
        let text = '';
        let finish!: (error?: Error) => void;
        const terminal = new Promise<void>((resolve, reject) => { finish = error => error ? reject(error) : resolve(); });
        terminal.catch(() => {});
        const unsubscribe = rpc.subscribe((method, params) => {
            if (method === '__process/exit') { finish(failure('Codex process unavailable', 'connection-unavailable')); return; }
            if (method === 'item/agentMessage/delta' && params?.threadId === threadId &&
                typeof params.delta === 'string') { text = (text + params.delta).slice(-4096); return; }
            if (method !== 'turn/completed' || params?.threadId !== threadId ||
                (turnId && params?.turn?.id !== turnId)) return;
            completed = params.turn;
            completedTurnId = params?.turn?.id;
            finish(completed?.status === 'completed' ? undefined : completed?.error ? providerFailure(completed.error) :
                failure('Codex turn did not complete', 'nonretryable-provider'));
        });
        try {
            const result = await rpc.request('turn/start', { threadId, cwd, approvalPolicy: 'never',
                sandboxPolicy: { type: 'readOnly', networkAccess: false }, input: [{ type: 'text', text: 'Reply with OK. Do not use tools.' }] });
            turnId = object(result)?.turn?.id;
            if (typeof turnId !== 'string') throw failure('Invalid Codex turn', 'invalid-json');
            if (completed && completedTurnId !== turnId) throw failure('Invalid Codex turn', 'invalid-json');
            await Promise.race([terminal, new Promise<never>((_, reject) => {
                const timer = setTimeout(() => reject(failure('Codex turn timed out', 'transient-transport')), this.timeoutMs);
                terminal.finally(() => clearTimeout(timer)).catch(() => {});
            })]);
            return text;
        } finally { unsubscribe(); }
    }
    private async accessToken(connectionId: string, registrationId: string): Promise<string> {
        try { return await this.auth.accessToken(connectionId, registrationId); }
        catch { throw failure('ChatGPT account needs authorization', 'authentication'); }
    }
}
