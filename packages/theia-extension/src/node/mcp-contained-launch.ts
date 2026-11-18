import { spawn, type ChildProcess } from 'node:child_process';
import type { Writable } from 'node:stream';
import { createServer, connect, type Server, type Socket } from 'node:net';
import { access, lstat, mkdtemp, open, readlink, readdir, realpath, rm, stat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { mcpProjectKey } from './mcp-project-preferences-store';

/** P5-R1 launch foundation. Only a trusted backend may supply this policy. No MCP tool is invoked here. */
export interface MCPContainedLaunchPolicy {
    command: string;
    installRoot: string;
    projectRoot: string;
    projectKey: string;
    bridgePort: number;
    bridgeToken: string;
    environment: { bridgeUrl: string; bridgeToken: string; projectRoot: string };
    maxLifetimeMs?: number;
    signal?: AbortSignal;
}

export interface MCPContainedSession {
    readonly stdio: ChildProcess;
    readonly exited: Promise<void>;
    close(): Promise<void>;
}

export class MCPContainmentUnavailable extends Error {
    constructor(reason: string) { super(`MCP containment unavailable: ${reason}`); }
}

const safeEnv = { PATH: '/usr/bin:/bin', HOME: '/home/mcp', TMPDIR: '/tmp', LC_ALL: 'C' };
const privateNames = new Set(['.git', '.dope', '.codex', '.agents', '.ssh', '.aws', '.config',
    '.gnupg', '.kube', '.docker', '.azure', 'secrets', 'secret', 'credentials']);
const privateFile = (name: string): boolean => name === '.env' || name.startsWith('.env.') ||
    name.startsWith('secret.') || name.startsWith('token.') || name.startsWith('credential.') ||
    ['.npmrc', '.netrc', '.gitconfig', '.git-credentials', 'id_rsa', 'id_ed25519', 'credentials.json'].includes(name) ||
    ['.pem', '.key', '.p12', '.pfx'].some(suffix => name.endsWith(suffix));
const validEnvironmentName = (name: unknown): name is string => typeof name === 'string' &&
    /^[A-Z][A-Z0-9_]{1,63}$/.test(name) && !/^(?:LD_|DYLD_|PYTHON|NODE_|DOPE_)/.test(name) &&
    !['PATH', 'HOME', 'TMPDIR', 'IFS', 'ENV', 'BASH_ENV', 'SHELLOPTS', 'BASHOPTS', 'CDPATH'].includes(name);

async function privatePaths(root: string): Promise<string[]> {
    const result: string[] = [];
    let count = 0;
    async function visit(folder: string): Promise<void> {
        for (const entry of await readdir(folder, { withFileTypes: true })) {
            if (++count > 100_000) throw new MCPContainmentUnavailable('project scan limit exceeded');
            const path = join(folder, entry.name), name = entry.name.toLowerCase();
            const hidden = name.startsWith('.');
            if (privateNames.has(name) || hidden || privateFile(name)) {
                if (entry.isSymbolicLink() || !(entry.isDirectory() || entry.isFile()))
                    throw new MCPContainmentUnavailable('unsafe private project path');
                result.push(path + (entry.isDirectory() ? '/' : ''));
            } else if (entry.isDirectory() && !entry.isSymbolicLink()) await visit(path);
        }
    }
    await visit(root);
    return result;
}

function directoryComponents(path: string): string[] {
    const parts = dirname(path).split('/').filter(Boolean);
    return parts.map((_, index) => '/' + parts.slice(0, index + 1).join('/'));
}

interface RuntimeMount { root: string; alias?: string }

/** A uv tool may use a Python interpreter in its sibling uv/python installation. */
async function runtimeMount(command: string, installRoot: string,
    projectRoot: string): Promise<RuntimeMount | undefined> {
    const file = await open(command, 'r');
    const header = Buffer.alloc(512);
    let length: number;
    try { ({ bytesRead: length } = await file.read(header, 0, header.length, 0)); }
    finally { await file.close(); }
    const shebang = /^#!\s*(\/[^\s\r\n]+)/u.exec(header.toString('utf8', 0, length));
    if (!shebang) return undefined;
    const interpreter = shebang[1];
    if (!interpreter.startsWith('/home/')) return undefined;
    if (!interpreter.startsWith(installRoot + '/'))
        throw new MCPContainmentUnavailable('interpreter outside narrow installation');
    const resolved = await realpath(interpreter).catch(() => '');
    if (resolved.startsWith(installRoot + '/')) return undefined;
    const uvRoot = resolve(installRoot, '../..');
    const pythonRoot = join(uvRoot, 'python');
    if (basename(uvRoot) !== 'uv' || basename(dirname(installRoot)) !== 'tools' ||
        await realpath(pythonRoot).catch(() => '') !== pythonRoot)
        throw new MCPContainmentUnavailable('interpreter outside narrow installation');
    const link = await readlink(interpreter).catch(() => '');
    const target = link ? resolve(dirname(interpreter), link) : '';
    if (!target.startsWith(pythonRoot + '/') || !resolved.startsWith(pythonRoot + '/'))
        throw new MCPContainmentUnavailable('interpreter outside narrow installation');
    const alias = join(pythonRoot, relative(pythonRoot, target).split(sep)[0]);
    const root = join(pythonRoot, relative(pythonRoot, resolved).split(sep)[0]);
    if (!resolved.startsWith(root + '/bin/') || root === projectRoot ||
        root.startsWith(projectRoot + '/') || projectRoot.startsWith(root + '/') ||
        await realpath(root).catch(() => '') !== root ||
        await realpath(alias).catch(() => '') !== root ||
        !(await stat(root).catch(() => undefined))?.isDirectory())
        throw new MCPContainmentUnavailable('interpreter outside narrow installation');
    return { root, alias: alias === root ? undefined : alias };
}

async function validate(policy: MCPContainedLaunchPolicy): Promise<{ command: string; masks: string[];
    runtime?: RuntimeMount }> {
    if (process.platform !== 'linux' || process.arch !== 'x64')
        throw new MCPContainmentUnavailable('Linux x86-64 is required');
    if (!policy || !isAbsolute(policy.command) || !isAbsolute(policy.installRoot) ||
        !isAbsolute(policy.projectRoot) || policy.installRoot !== resolve(policy.installRoot) ||
        policy.projectRoot !== resolve(policy.projectRoot) || policy.command.includes('\0') ||
        policy.installRoot.includes('\0') || policy.projectRoot.includes('\0') ||
        !Number.isSafeInteger(policy.bridgePort) || policy.bridgePort < 1024 || policy.bridgePort > 65535 ||
        !policy.environment || Object.keys(policy.environment).length !== 3 ||
        !validEnvironmentName(policy.environment.bridgeUrl) ||
        !validEnvironmentName(policy.environment.bridgeToken) ||
        !validEnvironmentName(policy.environment.projectRoot) ||
        new Set(Object.values(policy.environment)).size !== 3 ||
        typeof policy.bridgeToken !== 'string' || policy.bridgeToken.length < 32 ||
        policy.bridgeToken.length > 256 || /[\x00-\x1f\x7f]/.test(policy.bridgeToken) ||
        !Number.isSafeInteger(policy.maxLifetimeMs ?? 60_000) ||
        (policy.maxLifetimeMs ?? 60_000) < 1000 || (policy.maxLifetimeMs ?? 60_000) > 600_000)
        throw new MCPContainmentUnavailable('invalid launch policy');
    if (policy.signal?.aborted) throw new MCPContainmentUnavailable('cancelled');
    const root = await realpath(policy.installRoot).catch(() => '');
    const command = await realpath(policy.command).catch(() => '');
    if (root !== policy.installRoot || !root.startsWith('/home/') || root.split('/').length < 7 ||
        root === policy.projectRoot || root.startsWith(policy.projectRoot + '/') ||
        policy.projectRoot.startsWith(root + '/') ||
        !command.startsWith(root + '/') || !(await stat(command).catch(() => undefined))?.isFile() ||
        await access(command, constants.X_OK).then(() => false, () => true))
        throw new MCPContainmentUnavailable('executable is outside a canonical narrow installation');
    if (await mcpProjectKey(policy.projectRoot).catch(() => '') !== policy.projectKey)
        throw new MCPContainmentUnavailable('project identity changed');
    for (const path of ['/usr/bin/unshare', '/usr/bin/bwrap', '/usr/bin/socat', '/usr/bin/ip', '/usr/bin/prlimit']) {
        if (!(await stat(path).catch(() => undefined))?.isFile())
            throw new MCPContainmentUnavailable('required isolation utility missing');
    }
    return { command, masks: await privatePaths(policy.projectRoot),
        runtime: await runtimeMount(command, root, policy.projectRoot) };
}

const launchScript = 'set -eu; IFS= read -r bridge_token < /run/bridge-token; export "$3=ws://127.0.0.1:$1" "$4=$bridge_token" "$5=/work"; /usr/bin/socat "UNIX-LISTEN:/relay/bridge.sock,fork,unlink-early,mode=0600" "TCP:127.0.0.1:$1" </dev/null >/dev/null 2>/dev/null & exec "$2"';

/** The host listener is owned by this session; the child sees only a private loopback namespace. */
export async function launchContainedMCPServer(policy: MCPContainedLaunchPolicy): Promise<MCPContainedSession> {
    const { command, masks, runtime } = await validate(policy);
    const directory = await mkdtemp(join(tmpdir(), 'dope-mcp-relay-'));
    const socketPath = join(directory, 'bridge.sock');
    let child: ChildProcess | undefined, server: Server | undefined, timer: NodeJS.Timeout | undefined;
    let finished = false;
    const peers = new Set<Socket>();
    let finish!: () => void;
    const exited = new Promise<void>(resolve => { finish = resolve; });
    const close = async (): Promise<void> => {
        if (finished) return exited;
        finished = true;
        if (timer) clearTimeout(timer);
        policy.signal?.removeEventListener('abort', onAbort);
        server?.close();
        for (const peer of peers) peer.destroy();
        if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ } }
        if (child && child.exitCode === null && !child.killed)
            await new Promise<void>(resolve => { child!.once('close', () => resolve()); setTimeout(resolve, 2000).unref(); });
        await rm(directory, { recursive: true, force: true });
        finish();
    };
    const onAbort = () => { void close(); };
    try {
        const args = ['--user', '--map-root-user', '--net', '--fork', '--kill-child=SIGKILL', '--',
            '/bin/sh', '-c', 'set -eu; /usr/bin/ip link set lo up; exec "$@"', 'dope-mcp-net', '/usr/bin/bwrap',
            '--unshare-user', '--unshare-pid', '--unshare-ipc', '--unshare-uts', '--die-with-parent',
            '--ro-bind', '/usr', '/usr', '--symlink', 'usr/bin', '/bin', '--symlink', 'usr/lib', '/lib',
            '--symlink', 'usr/lib64', '/lib64', '--size', String(64 * 1024 * 1024), '--tmpfs', '/tmp',
            '--size', String(16 * 1024 * 1024), '--tmpfs', '/home', '--dir', '/home/mcp',
            '--tmpfs', '/run', '--dir', '/relay', '--dir', '/work'];
        const components = new Set([...directoryComponents(policy.installRoot),
            ...(runtime ? directoryComponents(runtime.root) : [])]);
        for (const component of components)
            if (component !== '/home') args.push('--dir', component);
        args.push('--ro-bind', policy.installRoot, policy.installRoot);
        if (runtime) {
            args.push('--ro-bind', runtime.root, runtime.root);
            if (runtime.alias) args.push('--symlink', runtime.root, runtime.alias);
        }
        args.push('--ro-bind', policy.projectRoot, '/work', '--bind', directory, '/relay',
            '--ro-bind-data', '3', '/run/bridge-token', '--proc', '/proc', '--dev', '/dev');
        for (const mask of masks) {
            const destination = '/work/' + relative(policy.projectRoot, mask.replace(/\/$/u, '')).split(sep).join('/');
            args.push(...(mask.endsWith('/') ? ['--tmpfs', destination, '--remount-ro', destination] :
                ['--ro-bind', '/dev/null', destination]));
        }
        args.push('--chdir', '/work', '--clearenv');
        for (const [name, value] of Object.entries(safeEnv)) args.push('--setenv', name, value);
        args.push('--', '/usr/bin/prlimit', '--cpu=60:60', '--as=4294967296:4294967296',
            '--nproc=128:128', '--nofile=128:128', '--fsize=67108864:67108864', '--',
            '/bin/sh', '-c', launchScript, 'dope-mcp-launch', String(policy.bridgePort), command,
            policy.environment.bridgeUrl, policy.environment.bridgeToken, policy.environment.projectRoot);
        child = spawn('/usr/bin/unshare', args, { env: safeEnv, detached: true,
            stdio: ['pipe', 'pipe', 'pipe', 'pipe'] });
        // Drain untrusted server diagnostics without logging raw project data or credentials.
        child.stderr?.on('data', () => {});
        for (const stream of child.stdio) stream?.on('error', () => { void close(); });
        (child.stdio[3] as Writable).end(policy.bridgeToken + '\n');
        child.on('close', () => { void close(); });
        child.on('error', () => { void close(); });
        policy.signal?.addEventListener('abort', onAbort, { once: true });
        timer = setTimeout(() => { void close(); }, policy.maxLifetimeMs ?? 60_000);
        for (let attempt = 0; attempt < 100; attempt++) {
            if (finished) throw new MCPContainmentUnavailable('isolated process exited during startup');
            if ((await lstat(socketPath).catch(() => undefined))?.isSocket()) break;
            await new Promise(resolve => setTimeout(resolve, 20));
            if (attempt === 99) throw new MCPContainmentUnavailable('private bridge did not start');
        }
        server = createServer(socket => {
            if (finished || peers.size >= 1 || socket.remoteAddress !== '127.0.0.1') { socket.destroy(); return; }
            peers.add(socket);
            const inner = connect(socketPath);
            inner.on('error', () => socket.destroy());
            socket.on('error', () => inner.destroy());
            socket.on('close', () => { peers.delete(socket); inner.destroy(); });
            inner.on('close', () => socket.destroy());
            socket.pipe(inner); inner.pipe(socket);
        });
        await new Promise<void>((resolve, reject) => {
            server!.once('error', reject);
            server!.listen({ host: '127.0.0.1', port: policy.bridgePort, exclusive: true }, () => {
                server!.off('error', reject); resolve();
            });
        });
        if (finished || policy.signal?.aborted) throw new MCPContainmentUnavailable('cancelled during startup');
        return { stdio: child, exited, close };
    } catch (error) {
        await close();
        throw error instanceof MCPContainmentUnavailable ? error :
            new MCPContainmentUnavailable(error instanceof Error ? error.message : 'launch failed');
    }
}
