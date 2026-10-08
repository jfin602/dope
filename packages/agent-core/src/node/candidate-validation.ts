import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cp, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, dirname, isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import { AGENT_SCHEMA_VERSION, ValidationResult, ValidationTarget } from '../contracts';
import { fingerprintCandidate } from './execution-workspace';

const execute = promisify(execFile);
const OUTPUT_LIMIT = 8192;
const MAX_DURATION_MS = 10 * 60_000;

function sanitized(value: string): string {
    return value.replace(/-----BEGIN [\s\S]*?-----END [^-]+-----/gu, '[redacted]')
        .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|AKIA[A-Z0-9]{16})\b/gu, '[redacted]')
        .replace(/\b(?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|authorization|password|secret)\s*[:=]\s*\S+/giu, '[redacted]')
        .replace(/\b[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|PASSWORD|SECRET)\s*=\s*\S+/gu, '[redacted]')
        .replace(/\bBearer\s+[A-Za-z0-9._~-]{8,}/giu, '[redacted]')
        .replace(/(?:^|[\s"'(])\/[A-Za-z0-9._~-]+\/[^\s"')]+/gmu, match =>
            `${match[0] === '/' ? '' : match[0]}[path]`)
        .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '');
}

async function nodeInstallation(): Promise<string> {
    for (const directory of (process.env.PATH ?? '').split(delimiter).filter(isAbsolute)) {
        const node = await realpath(join(directory, 'node')).catch(() => undefined);
        if (!node) continue;
        const version = await execute(node, ['--version'], { timeout: 3000 }).then(result =>
            result.stdout.trim()).catch(() => '');
        if (!/^v24\.\d+\.\d+$/u.test(version)) continue;
        const installation = dirname(dirname(node));
        const npm = join(installation, 'lib/node_modules/npm');
        if (await realpath(join(installation, 'bin/npm')).catch(() => '') !== join(npm, 'bin/npm-cli.js')) continue;
        if (JSON.parse(await readFile(join(npm, 'package.json'), 'utf8')).name === 'npm') return installation;
    }
    throw new Error('Node 24/npm toolchain unavailable');
}

interface ProcessResult {
    exitCode: number; stdout: string; stderr: string;
    stdoutTruncated: boolean; stderrTruncated: boolean; cancelled: boolean; timedOut: boolean;
}

function processCommand(executable: string, args: string[], signal: AbortSignal, timeoutMs: number): Promise<ProcessResult> {
    return new Promise((resolve, reject) => {
        if (signal.aborted) { resolve({ exitCode: 1, stdout: '', stderr: '', stdoutTruncated: false,
            stderrTruncated: false, cancelled: true, timedOut: false }); return; }
        const child = spawn(executable, args, { detached: true, stdio: ['ignore', 'pipe', 'pipe'],
            env: { PATH: '/usr/bin:/bin' } });
        let stdout = '', stderr = '', stdoutTail = '', stderrTail = '';
        let stdoutTruncated = false, stderrTruncated = false;
        let cancelled = false, timedOut = false, settled = false;
        const stop = () => {
            if (!child.pid) return;
            try { process.kill(-child.pid, 'SIGTERM'); } catch { /* Already gone. */ }
            setTimeout(() => { try { process.kill(-child.pid!, 'SIGKILL'); } catch { /* Already gone. */ } }, 1000).unref();
        };
        const onAbort = () => { cancelled = true; stop(); };
        signal.addEventListener('abort', onAbort, { once: true });
        const timer = setTimeout(() => { timedOut = true; stop(); }, timeoutMs);
        const collect = (chunk: Buffer, stream: 'stdout' | 'stderr') => {
            const data = chunk.toString('utf8');
            if (stream === 'stdout') {
                if (!stdoutTruncated) {
                    const next = stdout + data;
                    if (next.length <= OUTPUT_LIMIT) stdout = next;
                    else { stdout = next.slice(0, 3900); stdoutTail = next.slice(-3900); stdoutTruncated = true; }
                } else stdoutTail = (stdoutTail + data).slice(-3900);
            } else if (!stderrTruncated) {
                const next = stderr + data;
                if (next.length <= OUTPUT_LIMIT) stderr = next;
                else { stderr = next.slice(0, 3900); stderrTail = next.slice(-3900); stderrTruncated = true; }
            } else stderrTail = (stderrTail + data).slice(-3900);
        };
        child.stdout.on('data', chunk => collect(chunk as Buffer, 'stdout'));
        child.stderr.on('data', chunk => collect(chunk as Buffer, 'stderr'));
        const done = (error?: Error, code?: number | null) => {
            if (settled) return;
            settled = true; clearTimeout(timer); signal.removeEventListener('abort', onAbort);
            stop(); // Reap any validation child/fixture still in the process group.
            if (error) reject(error);
            else resolve({ exitCode: code ?? 1,
                stdout: sanitized(stdoutTruncated ? `${stdout}\n...[truncated]...\n${stdoutTail}` : stdout),
                stderr: sanitized(stderrTruncated ? `${stderr}\n...[truncated]...\n${stderrTail}` : stderr),
                stdoutTruncated, stderrTruncated, cancelled, timedOut });
        };
        child.on('error', error => done(error));
        child.on('close', code => done(undefined, code));
    });
}

function sandboxArgs(work: string, installation: string, command: string[]): string[] {
    return ['--unshare-user', '--unshare-net', '--unshare-pid', '--unshare-ipc', '--unshare-uts',
        '--die-with-parent', '--ro-bind', '/usr', '/usr', '--symlink', 'usr/bin', '/bin',
        '--symlink', 'usr/lib', '/lib', '--symlink', 'usr/lib64', '/lib64',
        '--ro-bind', installation, '/node', '--bind', work, '/work',
        '--size', String(256 * 1024 * 1024), '--tmpfs', '/tmp',
        '--size', String(64 * 1024 * 1024), '--tmpfs', '/home', '--dir', '/home/validation',
        '--proc', '/proc', '--dev', '/dev', '--chdir', '/work',
        '--setenv', 'HOME', '/home/validation', '--setenv', 'TMPDIR', '/tmp',
        '--setenv', 'PATH', '/work/node_modules/.bin:/node/bin:/usr/bin:/bin',
        '--setenv', 'XDG_CACHE_HOME', '/tmp/cache', '--', ...command];
}

export interface CandidateValidationInput {
    candidateRoot: string; candidateFingerprint: string; target: ValidationTarget;
    signal: AbortSignal; timeoutMs?: number;
}

/** Required validation has its own process and namespace, independent of the provider adapter. */
export class CandidateValidationRunner {
    constructor(private readonly bwrapExecutable = '/usr/bin/bwrap') {}
    async run(input: CandidateValidationInput, persist: (result: ValidationResult) => Promise<void>): Promise<ValidationResult> {
        const command = input.target.command ?? input.target.label;
        const base = { version: AGENT_SCHEMA_VERSION, kind: input.target.kind, label: input.target.label,
            command, owner: 'dope' as const, candidateFingerprint: input.candidateFingerprint };
        let parent: string | undefined;
        let result: ValidationResult;
        try {
            if (input.signal.aborted) throw new Error('cancelled');
            const installation = await nodeInstallation();
            parent = await mkdtemp(join(tmpdir(), 'dope-validation-'));
            const work = join(parent, 'work');
            await cp(input.candidateRoot, work, { recursive: true, verbatimSymlinks: true });
            if (await fingerprintCandidate(work) !== input.candidateFingerprint)
                throw new Error('Validation copy differs from frozen candidate');
            if (input.signal.aborted) throw new Error('cancelled');
            const workspaceId = randomUUID();
            const probe = await processCommand(this.bwrapExecutable, sandboxArgs(work, installation,
                ['/node/bin/node', '-e', 'const fs=require("node:fs");const net=require("node:net");fs.writeFileSync("/tmp/dope-probe","ok");const s=net.createServer();s.listen(0,"127.0.0.1",()=>s.close())']),
            input.signal, 5000);
            if (probe.cancelled) throw new Error('cancelled');
            if (probe.exitCode !== 0 || probe.timedOut) throw new Error('validation namespace unavailable');
            const started = Date.now();
            const execution = await processCommand(this.bwrapExecutable, sandboxArgs(work, installation,
                ['/bin/sh', '-c', command]), input.signal,
            Math.min(MAX_DURATION_MS, Math.max(1000, input.timeoutMs ?? MAX_DURATION_MS)));
            const durationMs = Math.min(86_400_000, Date.now() - started);
            result = { ...base, workspaceId, durationMs, exitCode: execution.exitCode,
                stdout: execution.stdout, stderr: execution.stderr,
                stdoutTruncated: execution.stdoutTruncated, stderrTruncated: execution.stderrTruncated,
                status: execution.cancelled ? 'cancelled' : execution.exitCode === 0 && !execution.timedOut ?
                    'passed' : 'failed',
                ...(execution.cancelled ? { reason: 'Validation cancelled' } : execution.timedOut ?
                    { reason: 'Validation timed out' } : {}) };
        } catch (error) {
            result = { ...base, status: input.signal.aborted || error instanceof Error && error.message === 'cancelled' ?
                'cancelled' : 'not-started', reason: input.signal.aborted ? 'Validation cancelled' :
                    error instanceof Error && error.message === 'cancelled' ? 'Validation cancelled' :
                        error instanceof Error && error.message.includes('namespace') ?
                            'Validation namespace unavailable' : 'Validation infrastructure unavailable' };
        }
        try { await persist(result); }
        finally { if (parent) await rm(parent, { recursive: true, force: true }); }
        return result;
    }
}
