import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, open, readdir, readlink, realpath } from 'node:fs/promises';
import { constants, createReadStream } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { AgentTaskSequence, ImportedStack, PromptSource, SequenceBlockReason,
    SequenceCheckpoint, hasPhaseStackSourceDrift, importPhaseStack, parseImportedStack } from '../sequence';
import { versionCoherent } from './sequence-checkpoint';

const execute = promisify(execFile);
const sha = /^[0-9a-f]{40,64}$/u;
const maxOutput = 2 * 1024 * 1024;
export type TaskStackSnapshotFailure = 'invalid-stack' |
    'version-mismatch' | 'unsafe-source' | 'source-changed' | 'checkpoint-mismatch';
export class TaskStackSnapshotError extends Error {
    constructor(readonly code: TaskStackSnapshotFailure) { super(code); }
}

async function git(root: string, args: string[]): Promise<string> {
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
    const result = await execute('git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
        cwd: root, encoding: 'utf8', maxBuffer: maxOutput,
        env: { ...env, GIT_OPTIONAL_LOCKS: '0', GIT_EXTERNAL_DIFF: '0',
            GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
    });
    return result.stdout;
}

async function checkedRoot(root: string): Promise<void> {
    if (await realpath(root) !== root || await realpath((await git(root, ['rev-parse', '--show-toplevel'])).trim()) !== root)
        throw new Error('Sequence requires canonical Git project root');
}

export function normalizeTasksRoot(value = 'docs/tasks'): string {
    const normalized = value.replace(/\/$/u, '');
    if (!normalized || normalized.startsWith('/') || normalized.includes('\\') || normalized.includes(':') ||
        /[\u0000-\u001f\u007f]/u.test(normalized) ||
        normalized.split('/').some(part => !part || part === '.' || part === '..' || part.startsWith('.')))
        throw new Error('Tasks folder must be inside the current project.');
    return normalized;
}

export async function checkedTasksRoot(root: string, value = 'docs/tasks'): Promise<{ relative: string; absolute: string }> {
    const relative = normalizeTasksRoot(value);
    await checkedRoot(root);
    let path = root;
    for (const part of relative.split('/')) {
        path = join(path, part);
        let info;
        try { info = await lstat(path); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error(`Tasks folder not found: ${relative}/`);
            throw error;
        }
        if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Tasks folder must be inside the current project.');
    }
    return { relative, absolute: path };
}

export async function readStackSources(root: string, folderName: string, tasksRoot = 'docs/tasks'): Promise<PromptSource[]> {
    // The parser owns the naming grammar; filesystem reads use the already validated name.
    if (folderName.includes('/') || folderName.includes('\\') || folderName === '.' || folderName === '..')
        throw new Error('Invalid stack folder');
    const { absolute } = await checkedTasksRoot(root, tasksRoot);
    const path = join(absolute, folderName);
    const directory = await lstat(path);
    if (!directory.isDirectory() || directory.isSymbolicLink()) throw new Error('Unsafe stack directory');
    const names = (await readdir(path)).filter(name => /^P\d+.*\.txt$/u.test(name)).sort();
    if (!names.length || names.length > 100) throw new Error('Invalid stack source count');
    if (names.some(name => !/^P\d+-[a-z0-9-]+\.txt$/u.test(name))) throw new Error('Invalid stack prompt filename');
    return Promise.all(names.map(async filename => {
        const file = join(path, filename), info = await lstat(file);
        if (!info.isFile() || info.isSymbolicLink() || info.size > 1_000_000)
            throw new Error('Unsafe or oversized stack source');
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const opened = await handle.stat();
            if (!opened.isFile() || opened.size > 1_000_000) throw new Error('Unsafe or oversized stack source');
            const bytes = await handle.readFile();
            if (bytes.length > 1_000_000) throw new Error('Oversized stack source');
            return { filename, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
        } finally { await handle.close(); }
    }));
}

export interface SequenceGitEvidence {
    head: string; packageVersion: string; worktreeFingerprint: string; clean: boolean;
    history: { sha: string; subject: string }[];
}

export async function captureSequenceEvidence(root: string): Promise<SequenceGitEvidence> {
    await checkedRoot(root);
    const head = (await git(root, ['rev-parse', '--verify', 'HEAD'])).trim();
    if (!sha.test(head)) throw new Error('Invalid Git HEAD');
    const raw = await git(root, ['log', '--format=%H%x09%s', 'HEAD']);
    const history = raw.trimEnd().split('\n').map(line => {
        const tab = line.indexOf('\t');
        const item = { sha: line.slice(0, tab), subject: line.slice(tab + 1) };
        if (tab < 0 || !sha.test(item.sha)) throw new Error('Invalid Git history');
        return item;
    });
    const status = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    const fields = status.split('\0');
    if (fields.pop() !== '') throw new Error('Invalid Git status');
    const material: string[] = [];
    for (let index = 0; index < fields.length; index++) {
        const field = fields[index];
        if (field.length < 4 || field[2] !== ' ') throw new Error('Invalid Git status entry');
        const previous = /[RC]/u.test(field.slice(0, 2)) ? fields[++index] : undefined;
        if (previous === undefined && /[RC]/u.test(field.slice(0, 2))) throw new Error('Invalid Git rename status');
        const path = field.slice(3);
        if (path === '.dope/agent' || path.startsWith('.dope/agent/')) continue;
        material.push(field, ...(previous ? [previous] : []));
        if (material.length > 4000) throw new Error('Git status exceeds sequence limit');
        const target = join(root, path);
        try {
            const info = await lstat(target);
            material.push(String(info.mode), String(info.size));
            if (info.isSymbolicLink()) material.push(await readlink(target));
            else if (info.isFile()) {
                const hash = createHash('sha256');
                for await (const chunk of createReadStream(target)) hash.update(chunk as Buffer);
                material.push(hash.digest('hex'));
            } else material.push('non-file');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
            material.push('missing');
        }
    }
    const packageFile = join(root, 'package.json');
    const packageInfo = await lstat(packageFile);
    if (!packageInfo.isFile() || packageInfo.isSymbolicLink() || packageInfo.size > 128 * 1024)
        throw new Error('Unsafe root package');
    const handle = await open(packageFile, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes: Buffer;
    try {
        if ((await handle.stat()).size > 128 * 1024) throw new Error('Oversized root package');
        bytes = await handle.readFile();
    } finally { await handle.close(); }
    if (bytes.length > 128 * 1024) throw new Error('Oversized root package');
    const pkg: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    const version = (pkg as { version?: unknown })?.version;
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/u.test(version)) throw new Error('Invalid root package version');
    if ((await git(root, ['rev-parse', '--verify', 'HEAD'])).trim() !== head)
        throw new Error('Git HEAD changed during sequence evidence capture');
    const index = await git(root, ['diff', '--cached', '--raw', '-z', 'HEAD', '--', '.',
        ':(exclude).dope/agent', ':(exclude).dope/agent/**']);
    return { head, packageVersion: version, clean: material.length === 0,
        worktreeFingerprint: createHash('sha256').update(material.join('\0')).update(index).digest('hex'), history };
}

function subject(stack: ImportedStack, number: number): string {
    const entry = stack.entries[number - 1];
    return stack.mode === 'phase' ? entry.versionPolicy.version : `${stack.folderName}/P${number}: ${entry.title}`;
}

/** Exact reachable checkpoint prefix; no state mutation or Git writes. */
export function gitCheckpointPrefix(stack: ImportedStack, evidence: SequenceGitEvidence): SequenceCheckpoint[] {
    const matches = stack.entries.map(entry => {
        const found = evidence.history.filter(commit => commit.subject === subject(stack, entry.number));
        if (found.length > 1)
            throw new Error(`Ambiguous correction checkpoint P${entry.number}`);
        return found[0];
    });
    const missing = matches.findIndex(value => !value);
    const count = missing < 0 ? matches.length : missing;
    if (matches.some((value, index) => index > count && value)) throw new Error('Later checkpoint has missing earlier task');
    const result = matches.slice(0, count).map((match, index) => ({ entryNumber: stack.entries[index].number, sha: match.sha }));
    for (let index = 1; index < result.length; index++) {
        const older = evidence.history.findIndex(item => item.sha === result[index - 1].sha);
        const newer = evidence.history.findIndex(item => item.sha === result[index].sha);
        if (older <= newer) throw new Error('Git checkpoint order is invalid');
    }
    return result;
}

export function expectedSequenceVersion(stack: ImportedStack, completed: number): string {
    if (stack.mode === 'correction') return stack.unchangedVersion!;
    if (completed) return stack.entries[completed - 1].versionPolicy.version;
    const first = stack.entries[0].versionPolicy.version.split('.').map(Number);
    return `${first[0]}.${first[1]}.${first[2] - 1}`;
}

export function sequenceBlockReason(sequence: AgentTaskSequence, evidence: SequenceGitEvidence,
    sourceDrift: boolean): SequenceBlockReason | undefined {
    if (sourceDrift) return 'source-drift';
    let prefix: SequenceCheckpoint[];
    try { prefix = gitCheckpointPrefix(sequence.stack, evidence); }
    catch { return 'git-history'; }
    const current = sequence.stack.entries[sequence.currentEntryNumber - 1];
    const manualCandidate = current?.execution === 'manual-gate' &&
        prefix.length === sequence.checkpoints.length + 1 && prefix.at(-1)?.sha === evidence.head;
    if (prefix.length !== sequence.checkpoints.length + (manualCandidate ? 1 : 0) ||
        sequence.checkpoints.some((item, index) => prefix[index]?.sha !== item.sha)) return 'checkpoint-mismatch';
    if (!manualCandidate && evidence.head !== (sequence.checkpoints.at(-1)?.sha ?? sequence.basis.head)) return 'head-drift';
    // P3 has applied candidate bytes but no checkpoint authority. The version and worktree may
    // reflect that successful task; the pending checkpoint remains the only safe next action.
    if (sequence.status === 'blocked' &&
        ['checkpoint-pending', 'checkpoint-failed'].includes(sequence.blockedReason ?? '')) return undefined;
    if (evidence.packageVersion !== expectedSequenceVersion(sequence.stack, prefix.length)) return 'version-mismatch';
    if (sequence.status === 'completed') return undefined;
    if (evidence.worktreeFingerprint !== sequence.basis.worktreeFingerprint ||
        (sequence.basis.clean ?? true) !== evidence.clean && !sequence.acceptedDirty) return 'worktree-drift';
    if (!evidence.clean && !sequence.acceptedDirty) return 'dirty-acceptance-required';
    if (sequence.status === 'running') return 'interrupted';
    return undefined;
}

export interface ManualGateReconciliation { sha?: string; reason?: SequenceBlockReason; message: string }

export function manualGateDecision(sequence: AgentTaskSequence, evidence: SequenceGitEvidence,
    sourceDrift: boolean, parent?: string, changed?: readonly string[], coherentVersion = false): ManualGateReconciliation {
    const entry = sequence.stack.entries[sequence.currentEntryNumber - 1];
    if (!entry || entry.execution !== 'manual-gate' || sequence.status === 'completed')
        throw new Error('Sequence has no pending manual gate');
    const previous = sequence.checkpoints.at(-1)?.sha ?? sequence.basis.head;
    if (sourceDrift) return { reason: 'source-drift', message: 'Restore the snapshotted prompt stack before resuming this gate.' };
    if (evidence.head === previous) {
        const basic = sequenceBlockReason(sequence, evidence, false);
        if (basic) return { reason: basic, message: basic === 'worktree-drift' ?
            'Commit or remove the uncommitted manual changes before resuming.' : basic === 'version-mismatch' ?
                'Restore the pre-gate package version or complete the manual checkpoint.' :
                'The completed checkpoint prefix is no longer reachable; restore the expected history.' };
        return { message: 'Complete the snapshotted manual prompt and create one checkpoint commit, then request Resume.' };
    }
    const basic = sequenceBlockReason(sequence, evidence, false);
    if (basic) return { reason: basic, message: basic === 'worktree-drift' ?
        'Commit or remove the uncommitted manual changes before resuming.' :
        'The external checkpoint does not match this gate. Restore the expected history and version, then retry.' };
    if (parent !== previous) return { reason: 'git-history',
        message: 'Manual completion needs one non-merge commit directly after the pre-gate HEAD.' };
    if (!changed?.length || changed.some(path => path === '.dope/agent' || path.startsWith('.dope/agent/') ||
        path === 'package-lock.json' || path === 'npm-shrinkwrap.json'))
        return { reason: 'git-history',
            message: 'The manual checkpoint must contain project changes and exclude runtime state and root npm locks.' };
    if (!coherentVersion) return { reason: 'version-mismatch',
        message: 'Make every workspace and internal reference match the gate version; remove forbidden root npm locks.' };
    return { sha: evidence.head, message: `Verified external checkpoint ${evidence.head}.` };
}

/** Read-only proof for one external checkpoint. A request to resume is never completion evidence. */
export async function verifyManualGate(root: string, sequence: AgentTaskSequence): Promise<ManualGateReconciliation> {
    const entry = sequence.stack.entries[sequence.currentEntryNumber - 1];
    if (!entry || entry.execution !== 'manual-gate' || sequence.status === 'completed')
        throw new Error('Sequence has no pending manual gate');
    const [evidence, drift] = await Promise.all([
        captureSequenceEvidence(root), stackSourceDrift(root, sequence.stack)]);
    if (drift || evidence.head === (sequence.checkpoints.at(-1)?.sha ?? sequence.basis.head) ||
        sequenceBlockReason(sequence, evidence, false))
        return manualGateDecision(sequence, evidence, drift);
    const parents = (await git(root, ['rev-list', '--parents', '-n', '1', 'HEAD'])).trim().split(' ');
    const changed = (await git(root, ['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD']))
        .split('\0').filter(Boolean);
    const coherent = await versionCoherent(root, entry.versionPolicy.version).then(() => true, () => false);
    const decision = manualGateDecision(sequence, evidence, false,
        parents.length === 2 && parents[0] === evidence.head ? parents[1] : undefined, changed, coherent);
    if (!decision.sha) return decision;
    const [again, sourceDrift] = await Promise.all([
        captureSequenceEvidence(root), stackSourceDrift(root, sequence.stack)]);
    if (sourceDrift || again.head !== evidence.head || !again.clean ||
        again.packageVersion !== evidence.packageVersion ||
        again.worktreeFingerprint !== evidence.worktreeFingerprint)
        return { reason: 'git-history', message: 'Repository or prompt stack changed during reconciliation; inspect it and retry.' };
    return decision;
}

export async function snapshotTaskStack(root: string, folderName: string,
    tasksRoot = 'docs/tasks'): Promise<AgentTaskSequence> {
    let stack: ImportedStack;
    try { stack = await importPhaseStack(folderName, await readStackSources(root, folderName, tasksRoot),
        normalizeTasksRoot(tasksRoot) === 'docs/tasks' ? undefined : `${normalizeTasksRoot(tasksRoot)}/${folderName}`);
        await parseImportedStack(stack); }
    catch (error) {
        const unsafe = error instanceof Error && /^(Invalid stack folder|Unsafe stack|Unsafe or oversized|Oversized stack|Sequence requires canonical Git project root|Invalid stack source count|Invalid stack prompt filename)/u.test(error.message);
        const unavailable = error && typeof error === 'object' && 'code' in error &&
            ['ENOENT', 'ELOOP', 'ENOTDIR', 'EACCES', 'EPERM'].includes(String(error.code));
        if (unsafe || unavailable)
            throw new TaskStackSnapshotError('unsafe-source');
        throw new TaskStackSnapshotError('invalid-stack');
    }
    let evidence: SequenceGitEvidence;
    try { evidence = await captureSequenceEvidence(root); }
    catch (error) {
        if (error instanceof SyntaxError || error instanceof Error && /Invalid root package version/u.test(error.message))
            throw new TaskStackSnapshotError('version-mismatch');
        throw error;
    }
    let checkpoints: SequenceCheckpoint[];
    try { checkpoints = gitCheckpointPrefix(stack, evidence); }
    catch { throw new TaskStackSnapshotError('checkpoint-mismatch'); }
    if (evidence.packageVersion !== expectedSequenceVersion(stack, checkpoints.length))
        throw new TaskStackSnapshotError('version-mismatch');
    if (checkpoints.length && evidence.head !== checkpoints.at(-1)!.sha)
        throw new TaskStackSnapshotError('checkpoint-mismatch');
    const again = await captureSequenceEvidence(root);
    if (again.head !== evidence.head || again.packageVersion !== evidence.packageVersion ||
        again.worktreeFingerprint !== evidence.worktreeFingerprint || again.clean !== evidence.clean)
        throw new TaskStackSnapshotError('checkpoint-mismatch');
    if (await stackSourceDrift(root, stack)) throw new TaskStackSnapshotError('source-changed');
    const now = new Date().toISOString();
    const currentEntryNumber = checkpoints.length + 1;
    return { version: 1, id: randomUUID(), createdAt: now, updatedAt: now, stack, checkpoints,
        currentEntryNumber, status: currentEntryNumber > stack.entries.length ? 'completed' :
            !evidence.clean ? 'blocked' :
            stack.entries[currentEntryNumber - 1]?.execution === 'manual-gate' ? 'waiting-manual' : 'ready',
        ...(!evidence.clean && currentEntryNumber <= stack.entries.length ?
            { blockedReason: 'dirty-acceptance-required' as const } : {}),
        basis: { head: evidence.head, packageVersion: evidence.packageVersion,
            worktreeFingerprint: evidence.worktreeFingerprint, clean: evidence.clean } };
}

export async function stackSourceDrift(root: string, stack: ImportedStack): Promise<boolean> {
    try { return await hasPhaseStackSourceDrift(stack, await readStackSources(root, stack.folderName,
        stack.sourcePath?.slice(0, -(stack.folderName.length + 1)) ?? 'docs/tasks')); }
    catch { return true; }
}
