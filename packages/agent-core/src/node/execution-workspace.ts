import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { constants } from 'node:fs';
import { cp, lstat, mkdir, mkdtemp, open, readdir, readlink, realpath, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { AGENT_SCHEMA_VERSION, projectPath } from '../contracts';
import type { AuthorityDecision, CandidateDelta, CandidateEffect } from '../contracts';
import { checkEffect, parseExecutionGrant } from '../authority';
import type { ExecutionGrant } from '../authority';
import { captureGitBasis } from './git-evidence';

const execute = promisify(execFile);
const MAX_FILES = 50_000;
const MAX_FILE_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const MAX_DEPENDENCY_BYTES = 2 * 1024 * 1024 * 1024;
const protectedPath = (path: string): boolean => path.split('/').some(part =>
    part === '.git' || part === '.codex' || part === '.dope' || part === '.ssh' ||
    part === '.aws' || part === '.npmrc' || part === '.yarnrc' || part === '.env' ||
    part.startsWith('.env.') || part.endsWith('.pem') || part.endsWith('.key'));
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

type FileState = { hash: string; size: number };
export class PromotionFailure extends Error {
    constructor(readonly appliedFiles: string[]) { super('Authoritative promotion failed after applying candidate files'); }
}

async function scan(root: string): Promise<Map<string, FileState>> {
    const files = new Map<string, FileState>();
    let total = 0;
    let totalBytes = 0;
    const visit = async (directory: string, prefix: string): Promise<void> => {
        for (const item of await readdir(directory, { withFileTypes: true })) {
            const path = prefix ? `${prefix}/${item.name}` : item.name;
            if (path === '.git') continue;
            if (item.name === 'node_modules') continue; // disposable dependencies are never promoted
            projectPath(path);
            const absolute = join(directory, item.name);
            const info = await lstat(absolute);
            if (info.isSymbolicLink() || (!info.isFile() && !info.isDirectory()))
                throw new Error(`Unsafe execution workspace entry: ${path}`);
            if (info.isDirectory()) { await visit(absolute, path); continue; }
            if (++total > MAX_FILES || info.size > MAX_FILE_BYTES)
                throw new Error('Execution workspace exceeds file limits');
            const handle = await open(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
            try {
                const current = await handle.stat();
                if (!current.isFile() || current.ino !== info.ino || current.size !== info.size)
                    throw new Error('Execution workspace file changed while scanning');
                const bytes = await handle.readFile();
                files.set(path, { hash: createHash('sha256').update(bytes).digest('hex'), size: bytes.length });
                totalBytes += bytes.length;
                if (totalBytes > MAX_TOTAL_BYTES)
                    throw new Error('Execution workspace exceeds byte limit');
            } finally { await handle.close(); }
        }
    };
    await visit(root, '');
    return files;
}

async function safeTarget(root: string, path: string, expect: 'file' | 'absent',
    allowProtectedRead = false): Promise<string> {
    projectPath(path);
    if (protectedPath(path) && !(allowProtectedRead && expect === 'file')) throw new Error('Protected project path');
    let cursor = root;
    const parts = path.split('/');
    for (let index = 0; index < parts.length; index++) {
        cursor = join(cursor, parts[index]);
        try {
            const info = await lstat(cursor);
            if (info.isSymbolicLink() || index < parts.length - 1 && !info.isDirectory() ||
                index === parts.length - 1 && (expect === 'absent' || !info.isFile()))
                throw new Error('Project path substituted or unsafe');
        } catch (error) {
            if (!missing(error)) throw error;
            if (index === parts.length - 1 && expect === 'file') throw new Error('Project file disappeared');
        }
    }
    if (relative(root, cursor).startsWith('..' + sep)) throw new Error('Project path escaped');
    return cursor;
}

async function fileHash(path: string): Promise<string> {
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        if (!(await handle.stat()).isFile()) throw new Error('Project entry is not a file');
        return createHash('sha256').update(await handle.readFile()).digest('hex');
    } finally { await handle.close(); }
}

/** Dope-owned authoritative ToolExecutor. Called only after the complete delta passes Authority. */
class AuthoritativeToolExecutor {
    constructor(private readonly projectRoot: string, private readonly candidateRoot: string) {}

    async apply(effects: CandidateEffect[]): Promise<string[]> {
        const applied: string[] = [];
        try {
            for (const effect of effects) {
                if (effect.kind !== 'create' && effect.kind !== 'modify') throw new Error('Unauthorized candidate effect');
                const source = await safeTarget(this.candidateRoot, effect.path, 'file');
                const sourceHandle = await open(source, constants.O_RDONLY | constants.O_NOFOLLOW);
                let bytes: Buffer;
                let mode: number;
                try {
                    const info = await sourceHandle.stat();
                    if (!info.isFile() || info.size > MAX_FILE_BYTES) throw new Error('Unsafe candidate file');
                    bytes = await sourceHandle.readFile(); mode = info.mode & 0o777;
                    if (createHash('sha256').update(bytes).digest('hex') !== effect.after)
                        throw new Error('Candidate file changed during promotion');
                } finally { await sourceHandle.close(); }
                const parts = effect.path.split('/');
                const leaf = parts.pop()!;
                let parent = await open(this.projectRoot,
                    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
                let expected = this.projectRoot;
                try {
                    if (await realpath(`/proc/self/fd/${parent.fd}`) !== expected)
                        throw new Error('Project root substituted');
                    for (const part of parts) {
                        const anchored = `/proc/self/fd/${parent.fd}/${part}`;
                        try { await mkdir(anchored); }
                        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
                        const next = await open(anchored,
                            constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
                        if (parent.fd !== -1) await parent.close();
                        parent = next; expected = join(expected, part);
                        if (await realpath(`/proc/self/fd/${parent.fd}`) !== expected)
                            throw new Error('Project directory substituted');
                    }
                    const anchoredTarget = `/proc/self/fd/${parent.fd}/${leaf}`;
                    const temp = `/proc/self/fd/${parent.fd}/.dope-${randomUUID()}.tmp`;
                    const tempHandle = await open(temp, constants.O_WRONLY | constants.O_CREAT |
                        constants.O_EXCL | constants.O_NOFOLLOW, mode || 0o600);
                    try {
                        await tempHandle.writeFile(bytes);
                        await tempHandle.chmod(mode);
                        await tempHandle.sync();
                    } finally { await tempHandle.close(); }
                    try {
                        if (await realpath(`/proc/self/fd/${parent.fd}`) !== expected)
                            throw new Error('Project directory moved during promotion');
                        const existing = await lstat(anchoredTarget).catch(error => {
                            if (missing(error)) return undefined;
                            throw error;
                        });
                        if (effect.kind === 'create' && existing || effect.kind === 'modify' &&
                            (!existing?.isFile() || existing.isSymbolicLink() ||
                                await fileHash(anchoredTarget) !== effect.before))
                            throw new Error('Project target changed before promotion');
                        await rename(temp, anchoredTarget);
                        applied.push(effect.path);
                        if (await fileHash(anchoredTarget) !== effect.after)
                            throw new Error('Authoritative apply mismatch');
                    } finally { await rm(temp, { force: true }); }
                } finally { await parent.close(); }
            }
        } catch { throw new PromotionFailure(applied); }
        return applied;
    }
}

/** The clone has independent Git objects and no worktree/control link to the developer project. */
export class ExecutionWorkspace {
    private constructor(readonly projectRoot: string, readonly root: string,
        private readonly parent: string, private readonly basis: Map<string, FileState>, readonly head: string,
        readonly id: string) {}

    static async create(projectRoot: string): Promise<ExecutionWorkspace> {
        if (!isAbsolute(projectRoot) || await realpath(projectRoot) !== projectRoot)
            throw new Error('Execution workspace requires canonical project root');
        const parent = await mkdtemp(join(tmpdir(), 'dope-execution-'));
        const root = join(parent, 'work');
        try {
            const env = { PATH: process.env.PATH, HOME: parent, GIT_CONFIG_NOSYSTEM: '1',
                GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0' };
            await execute('git', ['clone', '--no-local', '--quiet', '--', projectRoot, root],
                { cwd: parent, env, timeout: 120_000, maxBuffer: 1024 * 1024 });
            const [head, sourceHead] = await Promise.all([
                execute('git', ['rev-parse', 'HEAD'], { cwd: root, env }),
                execute('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, env })]);
            if (head.stdout.trim() !== sourceHead.stdout.trim()) throw new Error('Project HEAD moved during workspace creation');
            const tracked = await execute('git', ['ls-files', '-z'], { cwd: root, env, maxBuffer: 16 * 1024 * 1024 });
            if (tracked.stdout.split('\0').some(path => path.split('/').includes('node_modules')))
                throw new Error('Tracked node_modules cannot be excluded from candidate comparison');
            const alternates = join(root, '.git/objects/info/alternates');
            try { await lstat(alternates); throw new Error('Execution Git shares authoritative objects'); }
            catch (error) { if (!missing(error)) throw error; }
            const dependencyPaths: string[] = [];
            const findDependencies = async (directory: string, depth: number): Promise<void> => {
                if (depth > 4) return;
                for (const item of await readdir(directory, { withFileTypes: true })) {
                    if (item.name === '.git' || item.name === '.dope' || item.name === '.codex') continue;
                    const source = join(directory, item.name);
                    if (item.name === 'node_modules') {
                        if (!item.isDirectory() || item.isSymbolicLink()) throw new Error('Unsafe project dependencies');
                        dependencyPaths.push(source);
                    } else if (item.isDirectory()) await findDependencies(source, depth + 1);
                }
            };
            await findDependencies(projectRoot, 0);
            let dependencyBytes = 0;
            for (const dependencies of dependencyPaths) {
                await cp(dependencies, join(root, relative(projectRoot, dependencies)), {
                    recursive: true, verbatimSymlinks: true,
                    filter: async source => {
                        if (source !== dependencies && protectedPath(relative(dependencies, source))) return false;
                        const entry = await lstat(source);
                        if (entry.isSymbolicLink()) {
                            const link = await readlink(source);
                            if (isAbsolute(link)) throw new Error('Absolute dependency symlink');
                            const target = await realpath(resolve(source, '..', link));
                            if (target !== projectRoot && !target.startsWith(projectRoot + sep))
                                throw new Error('Dependency symlink escapes project');
                        } else if (!entry.isDirectory() && !entry.isFile()) throw new Error('Unsafe dependency entry');
                        if (entry.isFile()) dependencyBytes += entry.size;
                        if (dependencyBytes > MAX_DEPENDENCY_BYTES) throw new Error('Project dependencies exceed workspace limit');
                        return true;
                    } });
            }
            const basis = await scan(root);
            // A clean 8B project has the same tracked worktree bytes as the independent clone.
            for (const [path, state] of basis) {
                const source = await safeTarget(projectRoot, path, 'file', true);
                if (await fileHash(source) !== state.hash) throw new Error('Project basis changed during workspace creation');
            }
            return new ExecutionWorkspace(projectRoot, root, parent, basis, head.stdout.trim(), randomUUID());
        } catch (error) { await rm(parent, { recursive: true, force: true }); throw error; }
    }

    async delta(): Promise<CandidateDelta> {
        const current = await scan(this.root);
        const effects: CandidateEffect[] = [];
        for (const [path, before] of this.basis) {
            const after = current.get(path);
            if (!after) effects.push({ kind: 'delete', path, before: before.hash });
            else if (after.hash !== before.hash) effects.push({ kind: 'modify', path, before: before.hash, after: after.hash });
        }
        for (const [path, after] of current) if (!this.basis.has(path))
            effects.push({ kind: 'create', path, after: after.hash });
        // No path identity is inferred from matching bytes. Moves are create + delete.
        return { version: AGENT_SCHEMA_VERSION, effects: effects.sort((a, b) => a.path.localeCompare(b.path)) };
    }

    /** Check the *whole* delta before applying any file. Model events are never consulted. */
    async promote(grant: ExecutionGrant, delta: CandidateDelta): Promise<{
        decision: AuthorityDecision; applied: string[] }> {
        const accepted = parseExecutionGrant(grant);
        if (delta.version !== AGENT_SCHEMA_VERSION || JSON.stringify(delta) !== JSON.stringify(await this.delta()))
            throw new Error('Candidate delta changed before promotion');
        if (await realpath(this.projectRoot) !== this.projectRoot) throw new Error('Project root changed');
        const env = { PATH: process.env.PATH, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0' };
        const { stdout } = await execute('git', ['rev-parse', 'HEAD'], { cwd: this.projectRoot, env });
        if (stdout.trim() !== this.head) throw new Error('Project Git identity changed');
        const blocked: AuthorityDecision['blocked'] = [];
        for (const effect of delta.effects) {
            const kind = `project-${effect.kind}` as const;
            if (protectedPath(effect.path)) {
                blocked.push({ kind: effect.kind, path: effect.path });
                continue;
            }
            if (!checkEffect(accepted, { kind, scope: 'project', path: effect.path }).allowed || effect.kind === 'rename')
                blocked.push({ kind: effect.kind, path: effect.path });
            if (effect.kind === 'create') await safeTarget(this.projectRoot, effect.path, 'absent');
            else {
                const target = await safeTarget(this.projectRoot, effect.path, 'file');
                if (await fileHash(target) !== effect.before) throw new Error('Authoritative project basis changed');
            }
        }
        if (!(await captureGitBasis(this.projectRoot)).clean)
            throw new Error('Authoritative project changed during execution');
        if (blocked.length) return { decision: { allowed: false, blocked }, applied: [] };
        const applied = await new AuthoritativeToolExecutor(this.projectRoot, this.root).apply(delta.effects);
        return { decision: { allowed: true, blocked: [] }, applied };
    }

    async dispose(): Promise<void> { await rm(this.parent, { recursive: true, force: true }); }
}
