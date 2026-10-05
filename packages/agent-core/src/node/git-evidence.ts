import { execFile } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { promisify } from 'node:util';
import { isAbsolute, join, relative, sep } from 'node:path';
import { AGENT_SCHEMA_VERSION, projectPath } from '../contracts';
import type { ChangeSummary, GitBasis, GitFinal } from '../contracts';

const execute = promisify(execFile);
const metadata = (path: string): boolean => path === '.dope/agent' || path.startsWith('.dope/agent/');
const MAX_OUTPUT = 2 * 1024 * 1024;

async function git(root: string, args: string[]): Promise<string> {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
    const result = await execute('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
        cwd: root, encoding: 'utf8', maxBuffer: MAX_OUTPUT,
        env: { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_EXTERNAL_DIFF: '0',
            GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
    });
    return result.stdout;
}

async function approvedRoot(root: string): Promise<void> {
    if (!isAbsolute(root) || await realpath(root) !== root) throw new Error('Git evidence requires canonical project root');
    const top = (await git(root, ['rev-parse', '--show-toplevel'])).trim();
    if (await realpath(top) !== root) throw new Error('Git evidence root is not the approved repository');
}

async function safePath(root: string, value: string): Promise<string> {
    const path = projectPath(value);
    let cursor = root;
    for (const segment of path.split('/')) {
        cursor = join(cursor, segment);
        try {
            const info = await lstat(cursor);
            if (info.isSymbolicLink()) throw new Error('Git evidence path traverses a symlink');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
    }
    if (relative(root, cursor).startsWith('..' + sep)) throw new Error('Git evidence path escapes project');
    return path;
}

interface StatusEntry { code: string; path: string; previousPath?: string }
async function status(root: string): Promise<StatusEntry[]> {
    const raw = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    const fields = raw.split('\0');
    if (fields.pop() !== '') throw new Error('Invalid Git status output');
    const result: StatusEntry[] = [];
    for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        if (field.length < 4 || field[2] !== ' ') throw new Error('Invalid Git status entry');
        const code = field.slice(0, 2);
        const path = await safePath(root, field.slice(3));
        const previousPath = /[RC]/.test(code) ? await safePath(root, fields[++i] ?? '') : undefined;
        result.push({ code, path, ...(previousPath ? { previousPath } : {}) });
        if (result.length > 2000) throw new Error('Git status evidence exceeds limit');
    }
    return result;
}

async function head(root: string): Promise<string | null> {
    try { return (await git(root, ['rev-parse', '--verify', 'HEAD'])).trim(); }
    catch { return null; }
}

export async function captureGitBasis(root: string): Promise<GitBasis> {
    await approvedRoot(root);
    const revision = await head(root);
    const entries = await status(root);
    if (await head(root) !== revision) throw new Error('Git HEAD changed during basis capture');
    return { head: revision, clean: entries.every(entry => metadata(entry.path) &&
        (!entry.previousPath || metadata(entry.previousPath))),
        metadataChanged: entries.some(entry => metadata(entry.path) || Boolean(entry.previousPath && metadata(entry.previousPath))) };
}

export async function captureGitFinal(root: string, basis: GitBasis): Promise<{
    final: GitFinal; changedFiles: string[]; changeSummary: ChangeSummary }> {
    await approvedRoot(root);
    const revision = await head(root);
    const entries = await status(root);
    const taskEntries = entries.filter(entry => !metadata(entry.path));
    const pathSet = new Set(taskEntries.flatMap(entry =>
        [entry.path, ...(entry.previousPath && !metadata(entry.previousPath) ? [entry.previousPath] : [])]));
    let insertions = 0, deletions = 0;
    if (basis.head) {
        const raw = await git(root, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--numstat', '-z', basis.head, '--']);
        for (const line of raw.split('\0').filter(Boolean)) {
            const match = /^(\d+|-)\t(\d+|-)\t(.+)$/s.exec(line);
            if (!match) throw new Error('Invalid Git diff stat output');
            const path = await safePath(root, match[3]);
            if (metadata(path)) continue;
            pathSet.add(path);
            if (match[1] !== '-') insertions += Number(match[1]);
            if (match[2] !== '-') deletions += Number(match[2]);
        }
    }
    const paths = [...pathSet].sort();
    let untrackedBytes = 0;
    for (const entry of taskEntries.filter(item => item.code === '??')) {
        const absolute = join(root, entry.path);
        const info = await lstat(absolute);
        if (!info.isFile()) continue;
        untrackedBytes += info.size;
        if (info.size <= 64 * 1024) {
            const bytes = await readFile(absolute);
            if (!bytes.includes(0)) insertions += bytes.length === 0 ? 0 :
                bytes.toString('utf8').split('\n').length - (bytes.at(-1) === 10 ? 1 : 0);
        }
    }
    const statuses = taskEntries.slice(0, 500).map(entry => ({ code: entry.code, path: entry.path,
        ...(entry.previousPath && !metadata(entry.previousPath) ? { previousPath: entry.previousPath } : {}) }));
    const final: GitFinal = { head: revision, clean: taskEntries.length === 0,
        headChanged: revision !== basis.head, metadataChanged: entries.some(entry =>
            metadata(entry.path) || Boolean(entry.previousPath && metadata(entry.previousPath))), statuses,
        truncated: taskEntries.length > statuses.length || paths.length > 500 };
    const changeSummary: ChangeSummary = { version: AGENT_SCHEMA_VERSION,
        filesChanged: Math.min(paths.length, 100_000), insertions: Math.min(insertions, 10_000_000),
        deletions: Math.min(deletions, 10_000_000),
        summary: `${paths.length} task files changed; ${insertions} bounded text insertions, ${deletions} deletions; ${untrackedBytes} untracked bytes`,
        truncated: final.truncated || untrackedBytes > 64 * 1024 ||
            paths.length > 100_000 || insertions > 10_000_000 || deletions > 10_000_000 };
    if (await head(root) !== revision) throw new Error('Git HEAD changed during final evidence capture');
    return { final, changedFiles: paths.slice(0, 500), changeSummary };
}
