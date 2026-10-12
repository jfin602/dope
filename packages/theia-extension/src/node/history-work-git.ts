import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import type { AgentRun, ValidationResult } from '@dope/agent-core/lib/contracts';
import type { HistoryEntry, HistoryProject } from '@dope/contracts/lib/history';

const execute = promisify(execFile);
const LIMIT = 50;
const GIT_BYTES = 64 * 1024;
const GIT_TIMEOUT_MS = 3000;
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

export interface HistoryWorkGitMetadata {
    entries: HistoryEntry[];
    dirtyPaths: string[];
    gitBasis: string;
    diagnostics: { source: 'agent' | 'git'; message: string }[];
    truncated: boolean;
}

async function canonicalRoot(root: string): Promise<void> {
    if (typeof root !== 'string' || !isAbsolute(root) || resolve(root) !== root ||
        await realpath(root) !== root || !(await stat(root)).isDirectory())
        throw new Error('History requires a canonical project root');
}

/** Enumerate bounded owner JSON only; never open transcript, event, or separate candidate files. */
async function recordIds(root: string, collection: string): Promise<{ ids: string[]; truncated: boolean }> {
    let path = root;
    for (const segment of ['.dope', 'agent', collection]) {
        path = join(path, segment);
        let info;
        try { info = await lstat(path); } catch (error) { if (missing(error)) return { ids: [], truncated: false }; throw error; }
        if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path)
            throw new Error('Unsafe agent metadata path');
    }
    const names = (await readdir(path)).filter(name => collection === 'runs' ? !name.startsWith('.') : name.endsWith('.json'));
    const ids = names.map(name => collection === 'runs' ? name : name.slice(0, -5))
        .filter(name => /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(name) && name !== '.' && name !== '..')
        .sort();
    return { ids: ids.slice(0, LIMIT), truncated: names.length > LIMIT || ids.length !== names.length };
}

function dopeValidation(results: readonly ValidationResult[]): Extract<HistoryEntry['status'], { kind: 'agent-run' }>['validation'] {
    const owned = results.filter(result => result.owner === 'dope');
    if (!owned.length) return 'unknown';
    if (owned.some(result => result.status === 'failed')) return 'failed';
    if (owned.some(result => result.status === 'cancelled')) return 'cancelled';
    if (owned.some(result => result.status === 'not-started')) return 'not-started';
    if (owned.some(result => result.status === 'skipped')) return 'skipped';
    return owned.every(result => result.status === 'passed') ? 'passed' : 'unknown';
}

export function historyAgentRunStatus(run: AgentRun): HistoryEntry['status'] {
    return { kind: 'agent-run', state: run.status, validation: dopeValidation(run.validationResults),
        review: run.reviewDecision?.kind ?? (run.candidateReview?.state === 'ready' ? 'pending' : 'none'),
        ...(run.provenance ? { provenance: { connectionId: run.provenance.connectionId,
            modelId: run.provenance.modelId, adapterId: run.provenance.adapterId,
            runtimeKind: run.provenance.runtimeKind } } : {}),
        promotion: run.reviewDecision?.kind === 'accept' && run.authorityDecision?.allowed === true &&
            run.appliedFiles !== undefined && run.status === 'completed' ? 'applied' : 'not-applied' };
}

async function git(root: string, args: string[]): Promise<string> {
    const { stdout } = await execute('git', ['--no-pager', '--no-optional-locks',
        '-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', ...args], {
        cwd: root, encoding: 'utf8', timeout: GIT_TIMEOUT_MS, maxBuffer: GIT_BYTES,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0',
            GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
    });
    return stdout;
}

/** No user-controlled Git arguments, shell, paging, optional index locks, or ancestor-repository fallback. */
export async function readHistoryWorkGitMetadata(project: HistoryProject, observedAt: string,
    store = new AgentStore()): Promise<HistoryWorkGitMetadata> {
    const result: HistoryWorkGitMetadata = { entries: [], dirtyPaths: [], gitBasis: '', diagnostics: [], truncated: false };
    const root = project.projectRoot;
    try { await canonicalRoot(root); }
    catch { result.diagnostics.push({ source: 'agent', message: 'Invalid project root' },
        { source: 'git', message: 'Invalid project root' }); return result; }
    const diagnostic = (source: 'agent' | 'git', error: unknown): void => {
        result.diagnostics.push({ source, message: error instanceof Error ? error.message : String(error) });
    };
    try {
        const tasks = new Map<string, Awaited<ReturnType<AgentStore['readTask']>>>();
        const taskIds = await recordIds(root, 'tasks');
        result.truncated ||= taskIds.truncated;
        for (const id of taskIds.ids) {
            const task = await store.readTask(root, id);
            if (!task || task.id !== id) { diagnostic('agent', `Task ${id} missing`); continue; }
            if (task.projectId !== undefined && task.projectId !== project.projectId) continue;
            tasks.set(id, task);
            result.entries.push({ ...project, kind: 'event', source: 'agent', sourceId: `task:${id}`,
                owner: { kind: 'agent-task', taskId: id }, title: task.objective.slice(0, 120),
                status: { kind: 'owner', label: `AgentTask (${task.origin.kind})` }, availability: 'available',
                occurredAt: task.createdAt, observedAt: null });
        }
        const runIds = await recordIds(root, 'runs');
        result.truncated ||= runIds.truncated;
        for (const id of runIds.ids) {
            const run = await store.readRun(root, id);
            if (!run || run.id !== id) { diagnostic('agent', `Run ${id} missing`); continue; }
            const task = tasks.get(run.taskId) ?? await store.readTask(root, run.taskId);
            if (!task || task.projectId !== run.projectId ||
                (task.projectId !== undefined && task.projectId !== project.projectId) ||
                (run.projectId !== undefined && run.projectId !== project.projectId) ||
                (task.projectId !== undefined && run.projectId !== undefined && task.projectId !== run.projectId)) {
                diagnostic('agent', `Run ${id} has no matching project task`); continue;
            }
            result.entries.push({ ...project, kind: 'event', source: 'agent', sourceId: `run:${id}`,
                owner: { kind: 'agent-run', runId: id }, title: `Agent run: ${task.objective.slice(0, 100)}`,
                status: historyAgentRunStatus(run), availability: 'available',
                occurredAt: run.endedAt ?? run.startedAt ?? run.createdAt, observedAt: null });
        }
        const sequenceIds = await recordIds(root, 'sequences');
        result.truncated ||= sequenceIds.truncated;
        for (const id of sequenceIds.ids) {
            const sequence = await store.readSequence(root, id);
            if (!sequence || sequence.id !== id) { diagnostic('agent', `Sequence ${id} missing`); continue; }
            result.entries.push({ ...project, kind: 'event', source: 'agent', sourceId: `sequence:${id}`,
                owner: { kind: 'agent-sequence', sequenceId: id },
                title: `Agent sequence: ${sequence.stack.folderName.slice(0, 96)}`,
                status: { kind: 'owner', label: sequence.status }, availability: 'available',
                occurredAt: sequence.updatedAt, observedAt: null });
        }
        if (result.truncated) diagnostic('agent', 'Agent metadata truncated at 50 records per collection');
    } catch (error) { diagnostic('agent', error); }
    try {
        const top = (await git(root, ['rev-parse', '--show-toplevel'])).trimEnd();
        if (top !== root) throw new Error('Git repository root differs from project root');
        try {
            const log = await git(root, ['log', '-n', '20', '--format=%H%x00%cI%x00%s%x00%x00']);
            for (const row of log.split('\0\0').filter(Boolean)) {
                const [sha, at, subject] = row.replace(/^\n/u, '').split('\0');
                if (!/^[a-f0-9]{40,64}$/u.test(sha) || !at) continue;
                result.entries.push({ ...project, kind: 'event', source: 'git', sourceId: `commit:${sha}`,
                    owner: { kind: 'git-commit', commitId: sha }, title: (subject || 'Git commit').slice(0, 120),
                    status: { kind: 'owner', label: 'Commit' }, availability: 'available',
                    occurredAt: at, observedAt: null });
            }
        } catch (error) { diagnostic('git', error); }
        const porcelain = await git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--no-renames']);
        const records = porcelain.split('\0').filter(Boolean);
        result.truncated ||= records.length > LIMIT;
        result.dirtyPaths = records.slice(0, LIMIT).map(row => row.slice(3));
        const dirtyStats: unknown[] = [];
        for (const path of result.dirtyPaths) {
            const candidate = resolve(root, path);
            if (!candidate.startsWith(root + sep)) { dirtyStats.push('unsafe'); continue; }
            try {
                const info = await lstat(candidate);
                dirtyStats.push([info.size, info.mtimeMs, info.mode]);
            } catch { dirtyStats.push('missing'); }
        }
        result.gitBasis = createHash('sha256').update(JSON.stringify([porcelain, dirtyStats])).digest('hex');
        if (records.length) result.entries.push({ ...project, kind: 'snapshot', source: 'git', sourceId: 'working-tree',
            owner: { kind: 'git-dirty' }, title: `Working tree has changes (${records.length} paths)`,
            status: { kind: 'owner', label: 'Current dirty snapshot' }, availability: 'available',
            occurredAt: null, observedAt });
    } catch (error) { diagnostic('git', error); }
    return result;
}
