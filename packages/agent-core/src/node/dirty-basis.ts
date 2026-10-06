import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { lstat, open, realpath } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { promisify } from 'node:util';
import { projectPath } from '../contracts';

const execute = promisify(execFile);
const sha = /^[a-f0-9]{40,64}$/u;
export interface DirtyPath { path: string; code: string; hash: string | null; size: number; mode: number | null }
export interface AcceptedDirtyBasis { head: string; paths: DirtyPath[] }
export const agentState = (path: string): boolean => path === '.dope/agent' || path.startsWith('.dope/agent/');

export async function safeGit(root: string, args: string[]): Promise<string> {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
    const result = await execute('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
        cwd: root, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
        env: { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_EXTERNAL_DIFF: '0',
            GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
    });
    return result.stdout;
}

export async function captureDirtyBasis(root: string): Promise<AcceptedDirtyBasis> {
    if (!isAbsolute(root) || await realpath(root) !== root ||
        await realpath((await safeGit(root, ['rev-parse', '--show-toplevel'])).trim()) !== root)
        throw new Error('Dirty basis requires canonical Git project root');
    const head = (await safeGit(root, ['rev-parse', '--verify', 'HEAD'])).trim();
    if (!sha.test(head)) throw new Error('Invalid dirty-basis HEAD');
    const raw = await safeGit(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    const fields = raw.split('\0');
    if (fields.pop() !== '') throw new Error('Invalid Git status');
    const paths: DirtyPath[] = [];
    let total = 0;
    for (let index = 0; index < fields.length; index++) {
        const field = fields[index];
        if (field.length < 4 || field[2] !== ' ') throw new Error('Invalid Git status entry');
        const code = field.slice(0, 2), path = projectPath(field.slice(3));
        if (/[RC]/u.test(code)) throw new Error('Dirty continuation does not accept rename/copy status');
        if (agentState(path)) continue;
        if (code[0] !== ' ' && code !== '??') throw new Error('External staged changes block dirty continuation');
        if (![' M', ' D', '??'].includes(code)) throw new Error('Unsupported dirty status');
        if (path.split('/').some(part => ['.dope', '.codex', '.ssh', '.aws', '.npmrc', '.yarnrc'].includes(part) ||
            part === '.env' || part.startsWith('.env.') || part.endsWith('.pem') || part.endsWith('.key')))
            throw new Error('Protected dirty path');
        let cursor = root;
        for (const part of path.split('/')) {
            cursor = join(cursor, part);
            try { if ((await lstat(cursor)).isSymbolicLink()) throw new Error('Dirty path traverses symlink'); }
            catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
        }
        let hash: string | null = null, size = 0, mode: number | null = null;
        if (code !== ' D') {
            const handle = await open(join(root, path), constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                const info = await handle.stat();
                if (!info.isFile() || info.size > 32 * 1024 * 1024) throw new Error('Unsafe dirty file');
                const bytes = await handle.readFile();
                size = bytes.length; mode = info.mode & 0o777;
                hash = createHash('sha256').update(bytes).digest('hex');
            } finally { await handle.close(); }
        }
        total += size;
        if (paths.length >= 500 || total > 128 * 1024 * 1024) throw new Error('Dirty basis exceeds limits');
        paths.push({ path, code, hash, size, mode });
    }
    if ((await safeGit(root, ['rev-parse', '--verify', 'HEAD'])).trim() !== head)
        throw new Error('HEAD changed during dirty-basis capture');
    return { head, paths: paths.sort((a, b) => a.path.localeCompare(b.path)) };
}

export function parseAcceptedDirtyBasis(value: unknown): AcceptedDirtyBasis {
    const item = value as AcceptedDirtyBasis;
    if (!item || typeof item !== 'object' || !sha.test(item.head) || !Array.isArray(item.paths) || item.paths.length > 500)
        throw new Error('Invalid accepted dirty basis');
    const paths = item.paths.map(entry => {
        if (!entry || ![' M', ' D', '??'].includes(entry.code) ||
            !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > 32 * 1024 * 1024 ||
            (entry.code === ' D' ? entry.hash !== null || entry.size !== 0 || entry.mode !== null :
                typeof entry.hash !== 'string' || !/^[a-f0-9]{64}$/u.test(entry.hash)))
            throw new Error('Invalid accepted dirty path');
        if (entry.code !== ' D' && (!Number.isInteger(entry.mode) || entry.mode! < 0 || entry.mode! > 0o777))
            throw new Error('Invalid accepted dirty mode');
        return { path: projectPath(entry.path), code: entry.code, hash: entry.hash, size: entry.size, mode: entry.mode };
    });
    if (new Set(paths.map(entry => entry.path)).size !== paths.length ||
        paths.some(entry => agentState(entry.path) || entry.path.split('/').some(part =>
            ['.dope', '.codex', '.ssh', '.aws', '.npmrc', '.yarnrc'].includes(part) ||
            part === '.env' || part.startsWith('.env.') || part.endsWith('.pem') || part.endsWith('.key'))))
        throw new Error('Invalid accepted dirty scope');
    return { head: item.head, paths };
}

export async function assertDirtyBasis(root: string, expected: AcceptedDirtyBasis): Promise<void> {
    if (JSON.stringify(await captureDirtyBasis(root)) !== JSON.stringify(parseAcceptedDirtyBasis(expected)))
        throw new Error('Authoritative dirty basis changed during execution');
}
