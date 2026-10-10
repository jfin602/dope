import { spawn } from 'node:child_process';
import { lstat, mkdtemp, readFile, readdir, realpath, rm, symlink, writeFile, mkdir, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, sep } from 'node:path';

/** A process boundary for future Dope-authorized Local tools. This is not a grant or broker. */
export interface LocalSandboxPolicy {
    workspaceRoot: string;
    bwrapExecutable?: string;
    unshareExecutable?: string;
}

export interface LocalSandboxResult {
    exitCode: number; stdout: string; stderr: string; timedOut: boolean; cancelled: boolean;
}
export class LocalSandboxUnavailable extends Error {
    constructor(reason: string) { super(`Local tool sandbox unavailable: ${reason}`); }
}

// Read results are base64 encoded inside the sandbox; 32 KiB of file data needs over 43 KiB.
const MAX_OUTPUT = 65_536;
const MAX_ENTRIES = 100_000;
const SAFE_ENV = { PATH: '/usr/bin:/bin', HOME: '/home/local', TMPDIR: '/tmp',
    XDG_CACHE_HOME: '/tmp/cache', LC_ALL: 'C' };
const PRIVATE_NAMES = new Set(['.git', '.dope', '.codex', '.agents', '.ssh', '.aws', '.config',
    '.gnupg', '.kube', '.docker', '.azure', 'secrets', 'secret', 'credentials']);
const privateFile = (name: string): boolean => ['.npmrc', '.yarnrc', '.yarnrc.yml', '.netrc',
    '.pypirc', '.gitconfig', '.git-credentials', 'id_rsa', 'id_ed25519', 'credentials.json'].includes(name) ||
    name === '.env' || name.startsWith('.env.') || name.startsWith('secret.') ||
    name.startsWith('token.') || name.startsWith('credential.') ||
    ['.pem', '.key', '.p12', '.pfx'].some(suffix => name.endsWith(suffix));

// A fresh network namespace alone still permits creating and binding loopback sockets.
// Bubblewrap loads this cBPF filter before exec: reject other ABIs/x32 and every
// socket(2) request, including IPv4, IPv6 and packet sockets. No network socket
// descriptor is inherited by the sandboxed process.
function noNetworkSocketsFilter(): Buffer {
    const instructions: Array<[number, number, number, number]> = [
        [0x20, 0, 0, 4], [0x15, 1, 0, 0xc000003e], [0x06, 0, 0, 0x80000000],
        [0x20, 0, 0, 0], [0x35, 0, 1, 0x40000000], [0x06, 0, 0, 0x80000000],
        [0x15, 0, 1, 41], [0x06, 0, 0, 0x00050001], [0x06, 0, 0, 0x7fff0000]
    ];
    const buffer = Buffer.alloc(instructions.length * 8);
    instructions.forEach(([code, jt, jf, value], index) => {
        const offset = index * 8;
        buffer.writeUInt16LE(code, offset);
        buffer.writeUInt8(jt, offset + 2);
        buffer.writeUInt8(jf, offset + 3);
        buffer.writeUInt32LE(value, offset + 4);
    });
    return buffer;
}

async function protectedEntries(root: string): Promise<string[]> {
    const masks: string[] = [];
    let count = 0;
    async function visit(directory: string): Promise<void> {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
            if (++count > MAX_ENTRIES) throw new LocalSandboxUnavailable('workspace scan limit exceeded');
            const path = join(directory, entry.name);
            const name = entry.name.toLowerCase();
            if (PRIVATE_NAMES.has(name)) {
                // The mount targets must already exist. Never create a mount target in the candidate.
                if (!entry.isDirectory() || entry.isSymbolicLink())
                    throw new LocalSandboxUnavailable('protected directory is not a real directory');
                masks.push(path + '/');
            } else if (privateFile(name)) {
                if (!entry.isFile() || entry.isSymbolicLink())
                    throw new LocalSandboxUnavailable('environment file is not a regular file');
                masks.push(path);
            } else if (entry.isDirectory() && !entry.isSymbolicLink()) await visit(path);
        }
    }
    await visit(root);
    for (const name of ['.git', '.dope']) {
        if (!masks.includes(join(root, name) + '/'))
            throw new LocalSandboxUnavailable(`workspace ${name} mount target missing`);
    }
    return masks;
}

async function executable(value: string, expected: string): Promise<string> {
    if (!isAbsolute(value) || value.includes('\0')) throw new LocalSandboxUnavailable('malformed executable policy');
    const info = await lstat(value).catch(() => undefined);
    if (!info?.isFile() && !info?.isSymbolicLink())
        throw new LocalSandboxUnavailable('required Linux sandbox executable missing');
    // A caller-supplied executable must never become a host-side execution escape.
    if (value !== expected || await realpath(value) !== await realpath(expected).catch(() => ''))
        throw new LocalSandboxUnavailable('malformed executable policy');
    return value;
}

/** Runs only after checking mount targets and binaries. No raw-spawn fallback exists. */
export async function launchLocalSandboxedTool(policy: LocalSandboxPolicy, command: readonly string[],
    timeoutMs = 5000, signal?: AbortSignal): Promise<LocalSandboxResult> {
    if (process.platform !== 'linux' || process.arch !== 'x64')
        throw new LocalSandboxUnavailable('Linux x86-64 is the only supported platform');
    if (!policy || typeof policy.workspaceRoot !== 'string' || !isAbsolute(policy.workspaceRoot) ||
        !Array.isArray(command) || command.length === 0 || command.some(arg => typeof arg !== 'string' || arg.includes('\0')) ||
        !Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000)
        throw new LocalSandboxUnavailable('malformed policy or command');
    const root = policy.workspaceRoot;
    if (await realpath(root).catch(() => '') !== root || !(await lstat(root)).isDirectory())
        throw new LocalSandboxUnavailable('workspace root is not canonical');
    const bwrap = await executable(policy.bwrapExecutable ?? '/usr/bin/bwrap', '/usr/bin/bwrap');
    const unshare = await executable(policy.unshareExecutable ?? '/usr/bin/unshare', '/usr/bin/unshare');
    const masks = await protectedEntries(root);
    // The current Node runtime is a trusted executable, mounted read-only at a fixed path.
    // No caller-selected host executable or private home is exposed to the namespace.
    const node = command.some(arg => arg.includes('/dope-node')) ?
        await realpath(process.execPath) : undefined;
    if (node && !(await lstat(node)).isFile())
        throw new LocalSandboxUnavailable('Node executable unavailable');
    if (signal?.aborted) throw new LocalSandboxUnavailable('cancelled');
    const args = ['--user', '--map-root-user', '--net', '--', bwrap,
        '--unshare-user', '--unshare-pid', '--unshare-ipc', '--unshare-uts', '--die-with-parent',
        '--ro-bind', '/usr', '/usr', '--symlink', 'usr/bin', '/bin',
        '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64',
        '--bind', root, '/work', '--size', String(64 * 1024 * 1024), '--tmpfs', '/tmp',
        '--size', String(16 * 1024 * 1024), '--tmpfs', '/home', '--dir', '/home/local',
        '--proc', '/proc', '--dev', '/dev'];
    if (node) args.push('--ro-bind', node, '/dope-node');
    for (const mask of masks) {
        const destination = '/work/' + relative(root, mask.replace(/\/$/u, '')).split(sep).join('/');
        args.push(...(mask.endsWith('/') ? ['--tmpfs', destination, '--remount-ro', destination] :
            ['--ro-bind', '/dev/null', destination]));
    }
    args.push('--seccomp', '3', '--new-session', '--chdir', '/work', '--clearenv');
    for (const [name, value] of Object.entries(SAFE_ENV)) args.push('--setenv', name, value);
    args.push('--', ...command);
    const filterDirectory = await mkdtemp(join(tmpdir(), 'dope-local-seccomp-'));
    const filterPath = join(filterDirectory, 'filter.bpf');
    let filter: Awaited<ReturnType<typeof open>>;
    try {
        await writeFile(filterPath, noNetworkSocketsFilter(), { mode: 0o600 });
        filter = await open(filterPath, 'r');
    } catch {
        await rm(filterDirectory, { recursive: true, force: true });
        throw new LocalSandboxUnavailable('network seccomp filter unavailable');
    }
    return new Promise((resolve, reject) => {
        let child: ReturnType<typeof spawn>;
        try {
            child = spawn(unshare, args, { env: SAFE_ENV,
                stdio: ['ignore', 'pipe', 'pipe', filter.fd], detached: true });
        } catch {
            void filter.close().finally(() => rm(filterDirectory, { recursive: true, force: true }));
            reject(new LocalSandboxUnavailable('sandbox process could not start'));
            return;
        }
        void filter.close().finally(() => rm(filterDirectory, { recursive: true, force: true }));
        let stdout = '', stderr = '', settled = false, timedOut = false, cancelled = false;
        const kill = () => { if (child.pid) try { process.kill(-child.pid, 'SIGKILL'); } catch { /* exited */ } };
        const abort = () => { cancelled = true; kill(); };
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
        const timer = setTimeout(() => { timedOut = true; kill(); }, timeoutMs);
        const done = (error?: Error, code?: number | null) => {
            if (settled) return;
            settled = true; clearTimeout(timer); signal?.removeEventListener('abort', abort);
            if (error) reject(new LocalSandboxUnavailable('sandbox process could not start'));
            else resolve({ exitCode: code ?? 1, stdout, stderr, timedOut, cancelled });
        };
        child.stdout!.on('data', chunk => { stdout = (stdout + chunk).slice(0, MAX_OUTPUT); });
        child.stderr!.on('data', chunk => { stderr = (stderr + chunk).slice(0, MAX_OUTPUT); });
        child.on('error', error => done(error));
        child.on('close', code => done(undefined, code));
    });
}

export interface LocalSandboxPreflight { available: boolean; reason?: string; evidence?: string }

/** Independently executable host feasibility check; uses only disposable canaries. */
export async function preflightLocalToolSandbox(overrides: Pick<LocalSandboxPolicy,
    'bwrapExecutable' | 'unshareExecutable'> = {}): Promise<LocalSandboxPreflight> {
    const parent = await mkdtemp(join(tmpdir(), 'dope-local-sandbox-'));
    try {
        const work = join(parent, 'work');
        await mkdir(join(work, '.git'), { recursive: true });
        await mkdir(join(work, '.dope'));
        await writeFile(join(work, '.git', 'secret'), 'git-private');
        await writeFile(join(work, '.dope', 'secret'), 'dope-private');
        await writeFile(join(work, '.env'), 'env-private');
        await writeFile(join(parent, 'private'), 'host-private');
        await symlink(join(parent, 'private'), join(work, 'escape'));
        const script = `import os,socket,pathlib,sys\n` +
            `w=pathlib.Path('/work'); private=sys.argv[1]\n` +
            `def denied(label,fn):\n try: fn(); raise AssertionError(label+' allowed')\n except (OSError,PermissionError): pass\n` +
            `denied('private read',lambda: pathlib.Path(private).read_text())\n` +
            `denied('outside write',lambda: pathlib.Path(sys.argv[2]).write_text('bad'))\n` +
            `denied('git write',lambda: (w/'.git/secret').write_text('bad'))\n` +
            `denied('dope write',lambda: (w/'.dope/secret').write_text('bad'))\n` +
            `assert (w/'.git/secret').exists()==False and (w/'.dope/secret').exists()==False\n` +
            `try: assert (w/'.env').read_text() != 'env-private'\nexcept OSError: pass\n` +
            `denied('symlink escape',lambda: (w/'escape').read_text())\n` +
            `assert os.getenv('HOME')=='/home/local' and os.getenv('DOPE_PRIVATE_TOKEN') is None\n` +
            `assert not pathlib.Path(sys.argv[3]).exists()\n` +
            `for kind,address in [('bind',('127.0.0.1',0)),('connect',('127.0.0.1',9)),('external',('1.1.1.1',443))]:\n` +
            ` s=None\n try:\n  s=socket.socket(); s.settimeout(.5)\n  if kind=='bind': s.bind(address)\n  else: s.connect(address)\n  raise AssertionError(kind+' allowed')\n except OSError: pass\n finally:\n  if s: s.close()\n` +
            `(w/'legitimate').write_text('ok')\nprint('all-denials-and-workspace-write-proved')`;
        const policy = { workspaceRoot: work, ...overrides };
        const result = await launchLocalSandboxedTool(policy,
            ['/usr/bin/python3', '-c', script, join(parent, 'private'), join(parent, 'outside'), process.env.HOME ?? '/home/unknown']);
        if (result.exitCode !== 0 || !result.stdout.includes('all-denials-and-workspace-write-proved') ||
            await readFile(join(work, 'legitimate'), 'utf8').catch(() => '') !== 'ok' ||
            await readFile(join(work, '.git', 'secret'), 'utf8') !== 'git-private' ||
            await readFile(join(work, '.dope', 'secret'), 'utf8') !== 'dope-private' ||
            await readFile(join(work, '.env'), 'utf8') !== 'env-private')
            return { available: false, reason: `sandbox canary failed: ${result.stderr.slice(0, 500)}` };
        return { available: true, evidence: result.stdout.trim() };
    } catch (error) {
        return { available: false, reason: error instanceof Error ? error.message : 'unknown sandbox failure' };
    } finally { await rm(parent, { recursive: true, force: true }); }
}
