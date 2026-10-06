import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { lstat, open, readdir, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { AgentTaskSequence, ImportedStack, PromptSource, SequenceBlockReason,
    SequenceCheckpoint, hasPhaseStackSourceDrift, importPhaseStack, parseImportedStack } from '../sequence';

const execute = promisify(execFile);
const sha = /^[0-9a-f]{40,64}$/u;
const maxOutput = 2 * 1024 * 1024;

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

export async function readStackSources(root: string, folderName: string): Promise<PromptSource[]> {
    if (!/^(?:p\d+[a-z]?|p[12]-\d+|c\d+-[a-z0-9]+(?:-[a-z0-9]+)*)$/u.test(folderName))
        throw new Error('Invalid stack folder');
    await checkedRoot(root);
    let path = root;
    for (const part of ['docs', 'tasks', folderName]) {
        path = join(path, part);
        const info = await lstat(path);
        if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Unsafe stack directory');
    }
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
    return { head, packageVersion: version, clean: material.length === 0,
        worktreeFingerprint: createHash('sha256').update(material.join('\0')).digest('hex'), history };
}

function subject(stack: ImportedStack, number: number): string {
    const entry = stack.entries[number - 1];
    return stack.mode === 'phase' ? entry.versionPolicy.version : `${stack.folderName}/P${number}: ${entry.title}`;
}

/** Exact reachable checkpoint prefix; no state mutation or Git writes. */
export function gitCheckpointPrefix(stack: ImportedStack, evidence: SequenceGitEvidence): SequenceCheckpoint[] {
    const entries = stack.entries.filter(entry => entry.kind === 'implementation');
    const gate = entries.findIndex(entry => entry.execution === 'manual-gate');
    if (gate >= 0 && entries.slice(gate).some(entry => evidence.history.some(commit =>
        commit.subject === subject(stack, entry.number))))
        throw new Error('Manual gate checkpoint requires explicit reconciliation');
    const implementations = gate < 0 ? entries : entries.slice(0, gate);
    const matches = implementations.map(entry => {
        const found = evidence.history.filter(commit => commit.subject === subject(stack, entry.number));
        if (stack.mode === 'correction' && found.length > 1)
            throw new Error(`Ambiguous correction checkpoint P${entry.number}`);
        return found[0];
    });
    const missing = matches.findIndex(value => !value);
    const count = missing < 0 ? matches.length : missing;
    if (matches.some((value, index) => index > count && value)) throw new Error('Later checkpoint has missing earlier task');
    const result = matches.slice(0, count).map((match, index) => ({ entryNumber: implementations[index].number, sha: match.sha }));
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
    if (prefix.length !== sequence.checkpoints.length || prefix.some((item, index) =>
        item.sha !== sequence.checkpoints[index].sha)) return 'checkpoint-mismatch';
    if (evidence.head !== (sequence.checkpoints.at(-1)?.sha ?? sequence.basis.head)) return 'head-drift';
    // P3 has applied candidate bytes but no checkpoint authority. The version and worktree may
    // reflect that successful task; the pending checkpoint remains the only safe next action.
    if (sequence.status === 'blocked' &&
        ['checkpoint-pending', 'checkpoint-failed'].includes(sequence.blockedReason ?? '')) return undefined;
    if (evidence.packageVersion !== expectedSequenceVersion(sequence.stack, prefix.length)) return 'version-mismatch';
    if (!evidence.clean || evidence.worktreeFingerprint !== sequence.basis.worktreeFingerprint) return 'worktree-drift';
    if (sequence.status === 'completed') return 'completion-unsupported';
    if (sequence.status === 'running') return 'interrupted';
    return undefined;
}

export async function importSequenceSnapshot(root: string, folderName: string): Promise<AgentTaskSequence> {
    const stack = await importPhaseStack(folderName, await readStackSources(root, folderName));
    await parseImportedStack(stack);
    const evidence = await captureSequenceEvidence(root);
    if (!evidence.clean) throw new Error('Sequence import requires clean worktree');
    const checkpoints = gitCheckpointPrefix(stack, evidence);
    if (evidence.packageVersion !== expectedSequenceVersion(stack, checkpoints.length))
        throw new Error('Sequence import version mismatch');
    if (checkpoints.length && evidence.head !== checkpoints.at(-1)!.sha)
        throw new Error('Sequence import HEAD does not match checkpoint');
    const now = new Date().toISOString();
    const currentEntryNumber = checkpoints.length + 1;
    return { version: 1, id: randomUUID(), createdAt: now, updatedAt: now, stack, checkpoints,
        currentEntryNumber, status: stack.entries[currentEntryNumber - 1]?.execution === 'manual-gate' ? 'waiting-manual' : 'ready',
        basis: { head: evidence.head, packageVersion: evidence.packageVersion,
            worktreeFingerprint: evidence.worktreeFingerprint } };
}

export async function stackSourceDrift(root: string, stack: ImportedStack): Promise<boolean> {
    try { return await hasPhaseStackSourceDrift(stack, await readStackSources(root, stack.folderName)); }
    catch { return true; }
}
