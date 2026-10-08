import { spawn, execFile, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { cp, lstat, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { AgentExecutionAdapter, AgentExecutionEvent, AgentExecutionHandle, AgentExecutionRequest } from '@dope/agent-core';
import { parseExecutionGrant } from '@dope/agent-core';
import { ModelRuntimeFailure } from '@dope/contracts/lib/model-runtime';
import type { CodexAuthManager } from './codex-auth-manager';
import { RpcProcess, providerFailure } from './codex-rpc-process';

const appVersion: string = require('../../package.json').version;
const ADAPTER_ID = 'codex-app-server-execution';
const VERIFIED_VERSION = 'codex-cli 0.155.1';
const fail = (message: string, kind: ModelRuntimeFailure['failureClass'] = 'unsupported-capability') =>
    new ModelRuntimeFailure(message, kind);
const object = (value: unknown): Record<string, any> | undefined =>
    value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : undefined;

const unsafeVisible = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]|<\/?think(?:\s[^>]*)?>|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|^\s*(?:hidden reasoning|chain of thought)\s*:|^\s*\{[^\n]{0,256}"(?:jsonrpc|method|params)"\s*:/imu;
const sensitiveVisible = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|AKIA[A-Z0-9]{16})\b|\b(?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|authorization|password|secret)\s*[:=]\s*\S+|\b[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|PASSWORD|SECRET)\s*=\s*\S+|\bBearer\s+\S+|--(?:token|password|api-key)(?:=|\s+)\S+|(?:^|[\s"'(])(?:\/[A-Za-z0-9._~-]+\/[^\s"')]+|[A-Za-z]:\\Users\\[^\s"')]+)/giu;

function visible(value: unknown, limit: number): { text: string; truncated: boolean; redacted: boolean } | undefined {
    if (typeof value !== 'string' || value.length > limit * 16 || unsafeVisible.test(value) ||
        (value.match(/^\s*[A-Za-z_][A-Za-z0-9_]*=\S+/gmu)?.length ?? 0) >= 3) return undefined;
    const sanitized = value.replace(sensitiveVisible, match =>
        (/^[\s"'(]/u.test(match) ? match[0] : '') + '[redacted]');
    const encoder = new TextEncoder();
    let text = '';
    let bytes = 0;
    for (const character of sanitized) {
        const size = encoder.encode(character).length;
        if (bytes + size > limit) break;
        text += character;
        bytes += size;
    }
    return { text, truncated: text.length !== sanitized.length, redacted: sanitized !== value };
}

/** The named profile is intentionally stronger than a bare workspace-write sandbox: it denies
 * reads outside the workspace, while inheriting Codex's .git/.codex write protection. */
export function mutationConfig(root?: string, executablePath?: string, nodePath?: string): string {
    return `model_provider = "openai_chatgpt_plan"
approval_policy = "never"
sandbox_mode = "workspace-write"
default_permissions = "dope_run"
project_doc_max_bytes = 0
web_search = "disabled"
show_raw_agent_reasoning = false

[model_providers.openai_chatgpt_plan]
name = "ChatGPT plan"
base_url = "https://api.openai.com/v1"
env_key = "ACCESS_TOKEN"
wire_api = "responses"
requires_openai_auth = false
supports_websockets = false

[sandbox_workspace_write]
writable_roots = []
network_access = false
exclude_tmpdir_env_var = true
exclude_slash_tmp = true

[shell_environment_policy]
inherit = "none"
experimental_use_profile = false
ignore_default_excludes = false

[shell_environment_policy.set]
PATH = ${JSON.stringify(root ? `${join(root, 'node_modules', '.dope-bin')}:/usr/local/bin:/usr/bin:/bin` :
    '/usr/local/bin:/usr/bin:/bin')}

[features]
apps = false
browser_use = false
image_generation = false
skill_search = false

[agents]
enabled = false

[permissions.dope_run]
extends = ":workspace"

[permissions.dope_run.filesystem]
glob_scan_max_depth = 64
":root" = "deny"
":minimal" = "read"
":tmpdir" = "deny"
":slash_tmp" = "deny"
${executablePath ? `${JSON.stringify(executablePath)} = "read"` : ''}
${nodePath ? `${JSON.stringify(nodePath)} = "read"` : ''}

[permissions.dope_run.filesystem.":workspace_roots"]
"." = "write"
".git" = "read"
".codex" = "read"
"**/.env" = "deny"
"**/.env.*" = "deny"
"**/.npmrc" = "deny"
"**/.yarnrc" = "deny"
"**/.ssh" = "deny"
"**/.aws" = "deny"
"**/*.pem" = "deny"
"**/*.key" = "deny"

[permissions.dope_run.network]
enabled = false
${root ? `
[projects.${JSON.stringify(root)}]
trust_level = "untrusted"
` : ''}`;
}

export interface CodexExecutionOptions {
    executable?: string;
    spawnChild?: typeof spawn;
    version?: (executable: string) => Promise<string>;
    runtimeDirectory?: string;
    timeoutMs?: number;
    turnTimeoutMs?: number;
    /** Injection point for deterministic fixture tests. Production always probes the installed sandbox. */
    verifySandbox?: (executable: string, home: string, runtimeBase: string,
        authoritativeRoot: string) => Promise<void>;
    prepareToolchain?: (root: string, nodeExecutable: string) => Promise<void>;
}

export async function resolveSandboxNode(pathValue = process.env.PATH ?? ''): Promise<string> {
    for (const directory of pathValue.split(delimiter).filter(isAbsolute)) {
        const candidate = await realpath(join(directory, 'node')).catch(() => undefined);
        if (!candidate) continue;
        const version = await new Promise<string | undefined>(resolveVersion =>
            execFile(candidate, ['--version'], { timeout: 3000 }, (error, stdout) =>
                resolveVersion(error ? undefined : stdout.trim())));
        if (!/^v24\.\d+\.\d+$/u.test(version ?? '')) continue;
        // Yarn can prepend a temporary Node shim to PATH. Its binary reports Node 24,
        // but it has no npm installation beside it for the isolated workspace.
        const installation = dirname(dirname(candidate));
        const npmCli = await realpath(join(installation, 'bin', 'npm')).catch(() => undefined);
        if (npmCli !== join(installation, 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')) continue;
        try {
            if (JSON.parse(await readFile(join(installation, 'lib', 'node_modules', 'npm', 'package.json'),
                'utf8')).name === 'npm') return candidate;
        } catch { /* Keep looking for a complete Node/npm installation. */ }
    }
    throw fail('Node 24 npm installation unavailable for sandbox execution', 'connection-unavailable');
}

const shellQuote = (value: string): string => `'${value.replaceAll("'", "'\\''")}'`;

/** Give the isolated agent a project-local Node/npm toolchain without granting reads into
 * the host's npm installation. node_modules is disposable and excluded from CandidateDelta. */
export async function prepareSandboxNpm(root: string, nodeExecutable: string): Promise<void> {
    const installation = dirname(dirname(nodeExecutable));
    const npmCli = await realpath(join(installation, 'bin', 'npm')).catch(() => {
        throw fail('Node 24 npm executable unavailable', 'connection-unavailable');
    });
    const npmPackage = join(installation, 'lib', 'node_modules', 'npm');
    if (npmCli !== join(npmPackage, 'bin', 'npm-cli.js') ||
        JSON.parse(await readFile(join(npmPackage, 'package.json'), 'utf8')).name !== 'npm')
        throw fail('Node 24 npm installation is unsupported', 'connection-unavailable');
    const dependencyRoot = join(root, 'node_modules');
    const bin = join(dependencyRoot, '.dope-bin');
    await mkdir(bin, { recursive: true });
    await cp(npmPackage, join(dependencyRoot, '.dope-npm'), { recursive: true });
    await writeFile(join(bin, 'node'), `#!/bin/sh\nexec ${shellQuote(nodeExecutable)} "$@"\n`,
        { mode: 0o755, flag: 'wx' });
    await writeFile(join(bin, 'npm'), `#!/bin/sh\nexec ${shellQuote(join(bin, 'node'))} ${shellQuote(join(dependencyRoot,
        '.dope-npm', 'bin', 'npm-cli.js'))} "$@"\n`, { mode: 0o755, flag: 'wx' });
}

export async function verifyInstalledSandbox(executable: string, home: string, runtimeBase: string,
    authoritativeRoot = '', nodeExecutable = process.execPath): Promise<void> {
    const probe = await mkdtemp(join(runtimeBase, 'sandbox-probe-'));
    const project = join(probe, 'project');
    const deniedFile = join(probe, 'private');
    try {
        await mkdir(join(project, '.git'), { recursive: true });
        await writeFile(deniedFile, 'private', { mode: 0o600 });
        await writeFile(join(project, '.git', 'config'), 'protected');
        await writeFile(join(project, '.env'), 'private');
        await writeFile(join(project, 'destructive-canary'), 'preserve');
        const script = `set -eu
printf allowed > allowed
if ! grep -q allowed allowed; then exit 26; fi
if test -r "$1"; then exit 11; fi
if (printf denied > .git/config) 2>/dev/null; then exit 12; fi
if (printf denied > "$2") 2>/dev/null; then exit 13; fi
if (printf denied > /etc/dope-agent-sandbox-probe) 2>/dev/null; then exit 24; fi
if test -r .env; then exit 14; fi
if (printf denied > .env) 2>/dev/null; then exit 18; fi
if test -r "$3"; then exit 15; fi
if test -n "$5" && test -r "$5"; then exit 23; fi
if test -n "$5" && test -r "/proc/$PPID/root$5"; then exit 25; fi
if test -n "\${ACCESS_TOKEN:-}"; then exit 21; fi
if test -r "/proc/$PPID/environ" && grep -q 'dope-probe-marker' "/proc/$PPID/environ"; then exit 22; fi
ln -s .git git-control-link
if (printf denied > git-control-link/config) 2>/dev/null; then exit 19; fi
ln -s "$1" outside-link
if (printf denied > outside-link) 2>/dev/null; then exit 20; fi
if ! "$4" -e 'const server = require("node:net").createServer(); server.on("error", () => process.exit(0)); server.listen(0, "127.0.0.1", () => process.exit(1));'; then exit 17; fi
rm destructive-canary
if test -e destructive-canary; then exit 16; fi`;
        await new Promise<void>((resolveProbe, reject) => execFile(executable,
            ['sandbox', '-P', 'dope_run', '-C', project, '/bin/sh', '-c', script,
                'dope-probe', deniedFile, join(tmpdir(), 'dope-sandbox-denied-probe'),
                join(home, 'config.toml'), nodeExecutable, authoritativeRoot],
            { cwd: project, timeout: 5000, env: { PATH: process.env.PATH, HOME: home,
                CODEX_HOME: home, ACCESS_TOKEN: 'dope-probe-marker' } },
            error => error ? reject(fail(`Codex sandbox preflight failed (${error.code ?? 'startup'})`)) : resolveProbe()));
    } finally {
        await rm(probe, { recursive: true, force: true }).catch(() => {});
    }
}

/** One App Server and private CODEX_HOME per run. No 8A Test Connection session is reused. */
export class CodexAgentExecutionAdapter implements AgentExecutionAdapter {
    readonly id = ADAPTER_ID;
    private readonly active = new Set<RpcProcess>();
    private disposed = false;
    constructor(private readonly auth: Pick<CodexAuthManager, 'accessToken'>,
        private readonly options: CodexExecutionOptions = {}) {}

    async start(request: AgentExecutionRequest): Promise<AgentExecutionHandle> {
        if (this.disposed) throw fail('Codex execution adapter disposed', 'connection-unavailable');
        const grant = parseExecutionGrant(request.grant);
        if (grant.taskId !== request.taskId || !request.connectionId || !request.registrationId || !request.modelId ||
            !request.prompt.trim() || request.prompt.length > 32_000 || !/^[A-Za-z0-9][A-Za-z0-9._:/+-]*$/u.test(request.modelId))
            throw fail('Invalid Agent execution request');
        if (process.platform !== 'linux') throw fail('Codex execution sandbox unsupported on this platform');
        const approved = await realpath(request.projectRoot).catch(() => { throw fail('Approved project root unavailable'); });
        const root = await realpath(request.executionRoot).catch(() => { throw fail('Execution workspace unavailable'); });
        if (!isAbsolute(request.projectRoot) || request.projectRoot !== approved || approved === sep ||
            !isAbsolute(request.executionRoot) || request.executionRoot !== root || root === sep ||
            root === approved || root.startsWith(approved + sep) || approved.startsWith(root + sep))
            throw fail('Execution workspace must be canonical and separate from project');
        const git = await lstat(join(root, '.git')).catch(() => { throw fail('Project Git control unavailable'); });
        if (!git.isDirectory() || git.isSymbolicLink()) throw fail('Unsupported Git control layout');
        const runtimeBase = resolve(this.options.runtimeDirectory ?? join(tmpdir(), 'dope-agent-runtime'));
        if (runtimeBase === root || runtimeBase.startsWith(root + sep) || root.startsWith(runtimeBase + sep))
            throw fail('Runtime home must be separate from the project');
        const executable = this.options.executable ?? 'codex';
        const resolvedExecutable = await (async () => {
            const paths = isAbsolute(executable) ? [executable] :
                (process.env.PATH ?? '').split(delimiter).map(directory => join(directory, executable));
            for (const path of paths) {
                const resolved = await realpath(path).catch(() => undefined);
                if (resolved) return resolved;
            }
            throw fail('Codex executable unavailable', 'connection-unavailable');
        })();
        const version = this.options.version ?? (path => new Promise<string>((resolveVersion, reject) =>
            execFile(path, ['--version'], { timeout: 3000, cwd: tmpdir() }, (error, stdout) =>
                error ? reject(error) : resolveVersion(stdout))));
        let actualVersion: string;
        try { actualVersion = (await version(executable)).trim(); }
        catch { throw fail('Codex executable unavailable', 'connection-unavailable'); }
        if (actualVersion !== VERIFIED_VERSION) throw fail('Codex execution protocol version unverified');
        await mkdir(runtimeBase, { recursive: true, mode: 0o700 });
        const realRuntimeBase = await realpath(runtimeBase);
        const runtimeStat = await lstat(runtimeBase);
        if (realRuntimeBase !== runtimeBase || !runtimeStat.isDirectory() || runtimeStat.isSymbolicLink() ||
            runtimeStat.uid !== process.getuid?.() || (runtimeStat.mode & 0o077) !== 0 ||
            realRuntimeBase === root || realRuntimeBase.startsWith(root + sep) || root.startsWith(realRuntimeBase + sep))
            throw fail('Runtime home must be a canonical Dope-owned location outside the project');
        const home = await mkdtemp(join(runtimeBase, 'codex-run-'));
        let rpc: RpcProcess | undefined;
        try {
            const nodeExecutable = await resolveSandboxNode();
            await (this.options.prepareToolchain ?? prepareSandboxNpm)(root, nodeExecutable);
            await writeFile(join(home, 'config.toml'), mutationConfig(root, resolvedExecutable,
                nodeExecutable), { mode: 0o600, flag: 'wx' });
            if (this.options.verifySandbox) await this.options.verifySandbox(executable, home, runtimeBase, approved);
            else await verifyInstalledSandbox(executable, home, runtimeBase, approved, nodeExecutable);
            let token: string;
            try { token = await this.auth.accessToken(request.connectionId, request.registrationId); }
            catch { throw fail('ChatGPT account needs authorization', 'authentication'); }
            if (!token) throw fail('ChatGPT account needs authorization', 'authentication');
            if (this.disposed) throw fail('Codex execution adapter disposed', 'connection-unavailable');
            const child = (this.options.spawnChild ?? spawn)(executable,
                ['app-server', '--strict-config', '--listen', 'stdio://'], {
                    cwd: root, env: { PATH: process.env.PATH, LANG: process.env.LANG,
                        LC_ALL: process.env.LC_ALL, HOME: home, CODEX_HOME: home, ACCESS_TOKEN: token },
                    stdio: 'pipe', detached: true
                }) as ChildProcessWithoutNullStreams;
            rpc = new RpcProcess(child, this.options.timeoutMs ?? 8000, true, true);
            this.active.add(rpc);
            await rpc.request('initialize', { clientInfo: { name: 'Dope', title: 'Dope', version: appVersion },
                capabilities: { experimentalApi: true } });
            if (this.disposed) throw fail('Codex execution adapter disposed', 'connection-unavailable');
            rpc.notify('initialized');
            const thread = await rpc.request('thread/start', { model: request.modelId,
                modelProvider: 'openai_chatgpt_plan', allowProviderModelFallback: false,
                cwd: root, runtimeWorkspaceRoots: [root], approvalPolicy: 'never',
                permissions: 'dope_run', ephemeral: true,
                multiAgentMode: 'explicitRequestOnly' });
            const threadId = object(object(thread)?.thread)?.id;
            if (typeof threadId !== 'string' || !/^[A-Za-z0-9-]{1,200}$/u.test(threadId))
                throw fail('Invalid Codex thread', 'invalid-json');
            const profile = object(object(thread)?.activePermissionProfile);
            if (thread.model !== request.modelId || thread.modelProvider !== 'openai_chatgpt_plan' ||
                thread.cwd !== root || thread.approvalPolicy !== 'never' || profile?.id !== 'dope_run' ||
                !Array.isArray(thread.runtimeWorkspaceRoots) ||
                thread.runtimeWorkspaceRoots.length !== 1 || thread.runtimeWorkspaceRoots[0] !== root)
                throw fail('Codex did not apply the accepted execution configuration');
            const running = this.turn(rpc, request, root, threadId);
            const currentRpc = rpc;
            const result = running.result.finally(async () => {
                currentRpc.stop(); this.active.delete(currentRpc);
                await rm(home, { recursive: true, force: true }).catch(() => {});
            });
            result.catch(() => {});
            return { recovery: { adapterId: ADAPTER_ID, handle: threadId }, result,
                cancel: running.cancel, terminate: () => currentRpc.stop() };
        } catch (error) {
            rpc?.stop(); if (rpc) this.active.delete(rpc);
            await rm(home, { recursive: true, force: true }).catch(() => {});
            throw error;
        }
    }

    private turn(rpc: RpcProcess, request: AgentExecutionRequest, root: string, threadId: string):
        { result: Promise<void>; cancel: () => Promise<void> } {
        let turnId: string | undefined;
        let completedTurnId: string | undefined;
        let cancelled = false;
        let settled = false;
        let eventCount = 0;
        const commands = new Map<string, { command?: ReturnType<typeof visible>; stdout?: ReturnType<typeof visible>;
            stderr?: ReturnType<typeof visible>; commandDropped?: boolean; stdoutDropped?: boolean;
            stderrDropped?: boolean }>();
        const messages = new Map<string, string>();
        let finish!: (error?: Error) => void;
        const done = new Promise<void>((resolveDone, reject) => {
            finish = error => { if (settled) return; settled = true; error ? reject(error) : resolveDone(); };
        });
        done.catch(() => {});
        const emit = (event: AgentExecutionEvent) => {
            if (++eventCount > 1000) {
                if (eventCount === 1001) {
                    try { request.onEvent({ kind: 'warning', summary: 'Codex event limit exceeded' }); } catch {}
                    finish(fail('Codex event limit exceeded')); rpc.stop();
                }
                return;
            }
            try { request.onEvent(event); } catch {}
        };
        const denied = (summary: string) => {
            emit({ kind: 'authority-denied', summary });
            finish(fail(summary)); rpc.stop();
        };
        const unsubscribe = rpc.subscribe((method, params) => {
            if (method === '__process/exit') { finish(fail('Codex execution process stopped',
                cancelled ? 'nonretryable-provider' : 'connection-unavailable')); return; }
            if (method === '__server/request') { denied('Unexpected Codex approval or tool request'); return; }
            if (method === 'configWarning') { denied('Codex execution configuration warning'); return; }
            if (method === 'model/rerouted' && params?.threadId === threadId) {
                denied('Codex changed the selected model'); return;
            }
            if (params?.threadId !== threadId || (turnId && params?.turnId && params.turnId !== turnId)) return;
            if (method === 'item/completed' || method === 'item/started' || method === 'item/updated') {
                const item = object(params?.item);
                if (!item) return;
                if (['mcpToolCall', 'dynamicToolCall', 'collabAgentToolCall', 'subAgentActivity', 'webSearch'].includes(item.type)) {
                    denied('Codex attempted an unavailable tool'); return;
                }
                if (item.type === 'commandExecution') {
                    if (typeof item.cwd !== 'string' || resolve(item.cwd) !== root &&
                        !resolve(item.cwd).startsWith(root + sep)) { denied('Command cwd outside approved project'); return; }
                    const commandId = typeof item.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(item.id) ?
                        item.id : undefined;
                    const observed = commandId ? commands.get(commandId) ?? {} : {};
                    if (typeof item.command === 'string') {
                        observed.command = visible(item.command, 2_000);
                        observed.commandDropped = !observed.command?.text;
                        if (!observed.command?.text) emit({ kind: 'warning', summary: 'Unsafe provider command dropped' });
                        else if (observed.command.truncated || observed.command.redacted)
                            emit({ kind: 'warning', summary: 'Provider command redacted or truncated' });
                    }
                    for (const stream of ['stdout', 'stderr'] as const) {
                        if (item[stream] === undefined) continue;
                        observed[stream] = visible(item[stream], 4_000);
                        if (stream === 'stdout') observed.stdoutDropped = observed.stdout === undefined;
                        else observed.stderrDropped = observed.stderr === undefined;
                        if (!observed[stream]) emit({ kind: 'warning', summary: `Unsafe provider ${stream} dropped` });
                        else if (observed[stream].truncated || observed[stream].redacted)
                            emit({ kind: 'warning', summary: `Provider ${stream} redacted or truncated` });
                    }
                    if (commandId && (method === 'item/started' || commands.has(commandId))) {
                        if (method === 'item/completed') commands.delete(commandId);
                        else commands.set(commandId, observed);
                    }
                    if (method === 'item/updated') return;
                    const status = method === 'item/started' ? 'running' :
                        item.status === 'completed' ? (Number.isSafeInteger(item.exitCode) && item.exitCode !== 0 ?
                            'failed' : 'completed') :
                            item.status === 'failed' ? 'failed' : item.status === 'interrupted' ? 'interrupted' :
                                item.status === 'cancelled' ? 'cancelled' : 'failed';
                    emit({ kind: method === 'item/started' ? 'command-started' : 'command-completed',
                        summary: method === 'item/started' ? 'Project command started' : `Project command ${status}`,
                        status, ...(commandId ? { commandId } : {}),
                        ...(observed.command?.text ? { command: observed.command.text,
                            commandTruncated: observed.command.truncated, commandRedacted: observed.command.redacted } : {}),
                        commandDropped: observed.commandDropped === true,
                        cwd: relative(root, resolve(item.cwd)),
                        ...(Number.isSafeInteger(item.exitCode) && item.exitCode >= 0 ? { exitCode: item.exitCode } : {}),
                        ...(method === 'item/completed' ? {
                            stdoutPresent: observed.stdout !== undefined, stderrPresent: observed.stderr !== undefined,
                            stdoutDropped: observed.stdoutDropped === true, stderrDropped: observed.stderrDropped === true,
                            ...(observed.stdout ? { stdout: observed.stdout.text, stdoutTruncated: observed.stdout.truncated } : {}),
                            ...(observed.stderr ? { stderr: observed.stderr.text, stderrTruncated: observed.stderr.truncated } : {})
                        } : {}) });
                } else if (item.type === 'agentMessage') {
                    const messageId = typeof item.id === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(item.id) ?
                        item.id : undefined;
                    if (typeof item.text !== 'string') return;
                    if (!messageId && method !== 'item/completed') return;
                    const normalized = visible(item.text, 12_000);
                    if (!normalized?.text) {
                        if (item.text === '' && method !== 'item/completed') return;
                        emit({ kind: 'warning', summary: 'Unsafe or oversized agent message dropped' }); return;
                    }
                    const previous = messageId ? messages.get(messageId) ?? '' : '';
                    if (!normalized.text.startsWith(previous)) {
                        emit({ kind: 'warning', summary: 'Changed provider message snapshot dropped' }); return;
                    }
                    if (messageId) messages.set(messageId, normalized.text);
                    const delta = normalized.text.slice(previous.length);
                    if (delta) emit({ kind: 'agent-message', summary: 'Agent message', text: delta,
                        truncated: normalized.truncated, redacted: normalized.redacted });
                    if (delta && (normalized.truncated || normalized.redacted))
                        emit({ kind: 'warning', summary: 'Agent message redacted or truncated' });
                } else if (method === 'item/completed' && item.type === 'fileChange' && Array.isArray(item.changes)) {
                    if (item.status !== 'completed') {
                        emit({ kind: 'warning', summary: 'Codex file change did not complete' });
                        return;
                    }
                    for (const change of item.changes.slice(0, 100)) {
                        const path = object(change)?.path;
                        if (typeof path !== 'string') continue;
                        const absolute = resolve(root, path);
                        const local = relative(root, absolute);
                        if (!local || local.startsWith('..' + sep) || local === '..' || isAbsolute(local) ||
                            local.split(sep).some(segment => segment === '.git' || segment === '.codex')) {
                            denied('File change outside approved project or protected control path'); return;
                        }
                        emit({ kind: 'file-changed', summary: 'Project file changed', path: local });
                    }
                    if (item.changes.length > 100) emit({ kind: 'warning', summary: 'Provider file list truncated' });
                }
                return;
            }
            if (method === 'turn/completed') {
                const turn = object(params?.turn);
                if (!turn || typeof turn.id !== 'string') { finish(fail('Invalid Codex turn', 'invalid-json')); return; }
                if (turnId && turn.id !== turnId) return;
                completedTurnId = turn.id;
                emit({ kind: 'status', summary: `Codex turn ${['completed', 'failed', 'interrupted'].includes(turn.status) ? turn.status : 'stopped'}` });
                finish(turn.status === 'completed' && !cancelled ? undefined :
                    turn.error ? providerFailure(turn.error) : fail(cancelled ? 'Codex turn cancelled' : 'Codex turn failed', 'nonretryable-provider'));
            }
        });
        const result = (async () => {
            try {
                const response = await rpc.request('turn/start', { threadId, cwd: root,
                    runtimeWorkspaceRoots: [root], model: request.modelId, approvalPolicy: 'never',
                    permissions: 'dope_run', multiAgentMode: 'explicitRequestOnly',
                    ...(request.reasoningEffort ? { effort: request.reasoningEffort } : {}),
                    input: [{ type: 'text', text: request.prompt }] });
                turnId = object(object(response)?.turn)?.id;
                if (typeof turnId !== 'string' || !/^[A-Za-z0-9-]{1,200}$/u.test(turnId))
                    throw fail('Invalid Codex turn', 'invalid-json');
                if (completedTurnId && completedTurnId !== turnId)
                    throw fail('Mismatched Codex turn', 'invalid-json');
                emit({ kind: 'status', summary: 'Codex turn running' });
                await Promise.race([done, new Promise<never>((_, reject) => {
                    const timer = setTimeout(() => reject(fail('Codex turn timed out', 'transient-transport')),
                        this.options.turnTimeoutMs ?? 20 * 60_000);
                    done.finally(() => clearTimeout(timer)).catch(() => {});
                })]);
            } finally { unsubscribe(); }
        })();
        result.catch(() => {});
        return { result, cancel: async () => {
            if (settled) return;
            cancelled = true;
            if (turnId && rpc.alive) {
                await Promise.race([rpc.request('turn/interrupt', { threadId, turnId }, 1000).catch(() => {}),
                    new Promise<void>(resolveWait => setTimeout(resolveWait, 1000))]);
            }
            finish(fail('Codex turn cancelled', 'nonretryable-provider'));
            rpc.stop();
        } };
    }

    dispose(): void {
        this.disposed = true;
        for (const rpc of this.active) rpc.stop();
        this.active.clear();
    }
}
