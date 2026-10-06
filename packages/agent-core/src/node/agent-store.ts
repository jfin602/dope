import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRun, AgentRunEvent, AgentTask, id, integer, parseAgentRun, parseAgentRunEvent, parseAgentTask } from '../contracts';
import { canTransitionAgentRun } from '../state';
import { AgentTaskSequence, canTransitionSequence, parseAgentTaskSequence } from '../sequence';

export const AGENT_EVENT_LIMIT = 10_000;
export const AGENT_EVENT_PAGE_LIMIT = 100;
export const AGENT_EVENT_BYTES_LIMIT = 2048;
const JSON_BYTES_LIMIT = 128 * 1024;
const SEQUENCE_BYTES_LIMIT = 4 * 1024 * 1024;
const EVENTS_BYTES_LIMIT = AGENT_EVENT_LIMIT * AGENT_EVENT_BYTES_LIMIT;
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/** Free text is user/provider content. Reject credential and private-path shapes before writing it. */
function safeText(value: unknown): void {
    if (typeof value === 'string') {
        if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:sk-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9_]{16,}|AKIA[A-Z0-9]{16})\b|\b(?:access[_-]?token|refresh[_-]?token|id[_-]?token|api[_-]?key|authorization|password|secret|hidden[_ -]?reasoning|chain[_ -]?of[_ -]?thought)\s*[:=]\s*\S+|\b[A-Z][A-Z0-9_]*(?:API_KEY|TOKEN|PASSWORD|SECRET)\s*=\s*\S+|\bBearer\s+[A-Za-z0-9._~-]{8,}|(?:^|[\s"'(])\/[A-Za-z0-9._~-]+\/[^\s"')]+/iu.test(value))
            throw new Error('Agent state contains credential or private-path shaped text');
    } else if (Array.isArray(value)) value.forEach(safeText);
    else if (value && typeof value === 'object') Object.values(value).forEach(safeText);
}

function checked<T>(value: unknown, parse: (value: unknown) => T): T {
    const result = parse(value);
    safeText(result);
    return result;
}

export class AgentStore {
    private readonly listeners = new Set<(root: string, change: { kind: 'task' | 'run' | 'event' | 'sequence'; id: string }) => void>();

    onChange(listener: (root: string, change: { kind: 'task' | 'run' | 'event' | 'sequence'; id: string }) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(root: string, kind: 'task' | 'run' | 'event' | 'sequence', id: string): void {
        for (const listener of this.listeners) try { listener(root, { kind, id }); } catch { /* Committed writes stay committed. */ }
    }

    async root(uri: string): Promise<string> {
        let url: URL;
        try {
            if (typeof uri !== 'string' || !uri.startsWith('file://') || uri.includes('\\') ||
                uri.slice('file://'.length).split('/').some(segment => decodeURIComponent(segment) === '..'))
                throw new Error('Invalid root URI');
            url = new URL(uri);
        } catch { throw new Error('Agent store requires a local file folder without traversal'); }
        if (url.protocol !== 'file:' || url.host || url.search || url.hash) throw new Error('Agent store requires a local file folder');
        const root = await realpath(fileURLToPath(url));
        if (!(await stat(root)).isDirectory()) throw new Error('Agent store requires a folder');
        return root;
    }

    private async canonical(root: string): Promise<void> {
        if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
            throw new Error('Agent store requires an attached canonical root');
    }

    private async projectPath(root: string, path: string): Promise<void> {
        let current = root;
        for (const segment of path.split('/')) {
            current = join(current, segment);
            try {
                if ((await lstat(current)).isSymbolicLink()) throw new Error('Agent project path traverses a symlink');
            } catch (error) { if (!missing(error)) throw error; }
        }
    }

    private async directory(path: string, create: boolean): Promise<boolean> {
        try {
            const info = await lstat(path);
            if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path) throw new Error('Unsafe agent directory');
            return true;
        } catch (error) {
            if (!missing(error)) throw error;
            if (!create) return false;
            try { await mkdir(path, { mode: 0o700 }); }
            catch (createError) { if ((createError as NodeJS.ErrnoException).code !== 'EEXIST') throw createError; }
            return this.directory(path, false);
        }
    }

    private async base(root: string, create: boolean): Promise<string | undefined> {
        await this.canonical(root);
        let path = root;
        for (const part of ['.dope', 'agent']) {
            path = join(path, part);
            if (!await this.directory(path, create)) return undefined;
        }
        return path;
    }

    private async collection(root: string, name: 'tasks' | 'runs' | 'sequences', create: boolean): Promise<string | undefined> {
        const base = await this.base(root, create);
        if (!base) return undefined;
        const path = join(base, name);
        return await this.directory(path, create) ? path : undefined;
    }

    private async runDir(root: string, runId: string, create: boolean): Promise<string | undefined> {
        const collection = await this.collection(root, 'runs', create);
        if (!collection) return undefined;
        const path = join(collection, id(runId));
        return await this.directory(path, create) ? path : undefined;
    }

    private async file(file: string): Promise<boolean> {
        try {
            const info = await lstat(file);
            if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe agent file');
            return true;
        } catch (error) { if (missing(error)) return false; throw error; }
    }

    private async bytes(file: string, max: number): Promise<string | undefined> {
        if (!await this.file(file)) return undefined;
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const info = await handle.stat();
            if (!info.isFile() || info.size > max) throw new Error('Oversized agent file');
            try { return new TextDecoder('utf-8', { fatal: true }).decode(await handle.readFile()); }
            catch { throw new Error('Corrupt or unsupported agent bytes'); }
        } finally { await handle.close(); }
    }

    private async json<T>(file: string, parse: (value: unknown) => T | Promise<T>, limit = JSON_BYTES_LIMIT): Promise<T | undefined> {
        const bytes = await this.bytes(file, limit);
        if (bytes === undefined) return undefined;
        try { const result = await parse(JSON.parse(bytes)); safeText(result); return result; }
        catch { throw new Error('Corrupt or unsupported agent state'); }
    }

    private async atomic(file: string, value: unknown, limit = JSON_BYTES_LIMIT): Promise<void> {
        const bytes = `${JSON.stringify(value, null, 2)}\n`;
        if (Buffer.byteLength(bytes) > limit) throw new Error('Agent record exceeds size limit');
        const temp = `${file}.${randomUUID()}.tmp`;
        let replaced = false;
        try {
            const handle = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
            await this.file(file);
            await rename(temp, file);
            replaced = true;
            const parent = await open(resolve(file, '..'), constants.O_RDONLY);
            try { await parent.sync(); } finally { await parent.close(); }
        } catch (error) {
            if (replaced) throw new Error('Agent write outcome uncertain; re-read before retrying');
            throw error;
        } finally { await rm(temp, { force: true }); }
    }

    private async locked<T>(directory: string, work: () => Promise<T>): Promise<T> {
        const lock = join(directory, '.write.lock');
        const handle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
            .catch(error => { if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Agent state locked by another writer'); throw error; });
        try { return await work(); }
        finally {
            const acquired = await handle.stat();
            await handle.close();
            if ((await lstat(lock)).ino !== acquired.ino) throw new Error('Agent lock changed; inspect state');
            await rm(lock);
        }
    }

    async readSequence(root: string, sequenceId: string): Promise<AgentTaskSequence | undefined> {
        const dir = await this.collection(root, 'sequences', false);
        const sequence = dir ? await this.json(join(dir, `${id(sequenceId)}.json`), parseAgentTaskSequence,
            SEQUENCE_BYTES_LIMIT) : undefined;
        if (sequence && sequence.id !== sequenceId) throw new Error('Corrupt agent sequence identity');
        return sequence;
    }

    async listSequences(root: string): Promise<AgentTaskSequence[]> {
        const dir = await this.collection(root, 'sequences', false);
        if (!dir) return [];
        const names = (await readdir(dir)).filter(name => name.endsWith('.json')).sort();
        if (names.length > 1000) throw new Error('Too many agent sequences');
        const sequences: AgentTaskSequence[] = [];
        for (const name of names) {
            const sequence = await this.readSequence(root, name.slice(0, -5));
            if (!sequence || `${sequence.id}.json` !== name) throw new Error('Corrupt agent sequence identity');
            sequences.push(sequence);
        }
        return sequences;
    }

    async createSequence(root: string, value: AgentTaskSequence): Promise<AgentTaskSequence> {
        const sequence = await parseAgentTaskSequence(value);
        safeText(sequence);
        const dir = (await this.collection(root, 'sequences', true))!;
        await this.locked(dir, async () => {
            if (await this.readSequence(root, sequence.id)) throw new Error('Agent sequence already exists');
            await this.atomic(join(dir, `${sequence.id}.json`), sequence, SEQUENCE_BYTES_LIMIT);
        });
        this.notify(root, 'sequence', sequence.id);
        return sequence;
    }

    async updateSequence(root: string, expected: AgentTaskSequence, value: AgentTaskSequence): Promise<AgentTaskSequence> {
        const old = await parseAgentTaskSequence(expected), next = await parseAgentTaskSequence(value);
        safeText(next);
        if (old.id !== next.id) throw new Error('Agent sequence identity changed');
        const dir = await this.collection(root, 'sequences', false);
        if (!dir) throw new Error('Agent sequence missing');
        await this.locked(dir, async () => {
            const current = await this.readSequence(root, old.id);
            if (!current || !same(current, old)) throw new Error('Stale agent sequence; re-read before updating');
            const advanced = next.currentEntryNumber > current.currentEntryNumber &&
                next.checkpoints.some(checkpoint => checkpoint.entryNumber === current.currentEntryNumber &&
                    checkpoint.taskId === current.taskId && checkpoint.runId === current.runIds?.at(-1));
            if (!same(current.stack, next.stack) || !same(current.basis, next.basis) ||
                current.createdAt !== next.createdAt || next.updatedAt < current.updatedAt ||
                !advanced && current.taskId && current.taskId !== next.taskId ||
                !advanced && (current.runIds ?? []).some((runId, index) => next.runIds?.[index] !== runId) ||
                next.checkpoints.length < current.checkpoints.length ||
                current.checkpoints.some((checkpoint, index) => !same(checkpoint, next.checkpoints[index])) ||
                next.currentEntryNumber < current.currentEntryNumber &&
                    !(current.status === 'completed' && next.status === 'blocked' && next.blockedReason &&
                        next.currentEntryNumber === current.currentEntryNumber - 1) ||
                current.status !== next.status && !canTransitionSequence(current.status, next.status) &&
                    !(current.status === 'completed' && next.status === 'blocked' && next.blockedReason))
                throw new Error('Illegal AgentTaskSequence update');
            await this.atomic(join(dir, `${next.id}.json`), next, SEQUENCE_BYTES_LIMIT);
        });
        this.notify(root, 'sequence', next.id);
        return next;
    }

    async readTask(root: string, taskId: string): Promise<AgentTask | undefined> {
        const dir = await this.collection(root, 'tasks', false);
        return dir ? this.json(join(dir, `${id(taskId)}.json`), parseAgentTask) : undefined;
    }

    async listTasks(root: string): Promise<AgentTask[]> {
        const dir = await this.collection(root, 'tasks', false);
        if (!dir) return [];
        const names = (await readdir(dir)).filter(name => name.endsWith('.json')).sort();
        if (names.length > 1000) throw new Error('Too many agent tasks');
        const tasks: AgentTask[] = [];
        for (const name of names) {
            const item = await this.json(join(dir, name), parseAgentTask);
            if (!item || `${item.id}.json` !== name) throw new Error('Corrupt agent task identity');
            tasks.push(item);
        }
        return tasks;
    }

    async createTask(root: string, value: AgentTask): Promise<AgentTask> {
        const task = checked(value, parseAgentTask);
        const dir = (await this.collection(root, 'tasks', true))!;
        await this.locked(dir, async () => {
            if (await this.readTask(root, task.id)) throw new Error('Agent task already exists');
            await this.atomic(join(dir, `${task.id}.json`), task);
        });
        this.notify(root, 'task', task.id);
        return task;
    }

    async readRun(root: string, runId: string): Promise<AgentRun | undefined> {
        const dir = await this.runDir(root, runId, false);
        const run = dir ? await this.json(join(dir, 'run.json'), parseAgentRun) : undefined;
        if (run && run.id !== runId) throw new Error('Corrupt agent run identity');
        if (run) {
            const task = await this.readTask(root, run.taskId);
            if (!task || task.projectId !== run.projectId || !same(task.modelPolicy, run.requestedPolicy))
                throw new Error('Corrupt agent run/task relationship');
        }
        return run;
    }

    async listRuns(root: string): Promise<AgentRun[]> {
        const dir = await this.collection(root, 'runs', false);
        if (!dir) return [];
        const names = (await readdir(dir)).filter(name => !name.startsWith('.')).sort();
        if (names.length > 1000) throw new Error('Too many agent runs');
        const runs: AgentRun[] = [];
        for (const name of names) {
            id(name);
            const run = await this.readRun(root, name);
            if (!run) throw new Error('Corrupt agent run directory');
            runs.push(run);
        }
        return runs;
    }

    async createRun(root: string, value: AgentRun): Promise<AgentRun> {
        const run = checked(value, parseAgentRun);
        if (run.status !== 'pending' || run.changedFiles.length || run.validationResults.length || run.changeSummary || run.outcome || run.finalGit || run.commandEvidence?.length ||
            run.candidateDelta || run.authorityDecision || run.appliedFiles?.length || run.capacityRetries)
            throw new Error('New agent run must be empty and pending');
        const task = await this.readTask(root, run.taskId);
        if (!task || task.projectId !== run.projectId || !same(task.modelPolicy, run.requestedPolicy)) throw new Error('Agent run does not match task');
        const parent = (await this.collection(root, 'runs', true))!;
        await this.locked(parent, async () => {
            const dir = join(parent, run.id);
            if (await this.directory(dir, false)) throw new Error('Agent run already exists');
            await this.directory(dir, true);
            await this.atomic(join(dir, 'run.json'), run);
        });
        this.notify(root, 'run', run.id);
        return run;
    }

    async updateRun(root: string, expected: AgentRun, value: AgentRun): Promise<AgentRun> {
        const old = checked(expected, parseAgentRun);
        const next = checked(value, parseAgentRun);
        for (const file of next.changedFiles) await this.projectPath(root, file);
        if (old.id !== next.id) throw new Error('Agent run identity changed');
        const dir = await this.runDir(root, old.id, false);
        if (!dir) throw new Error('Agent run missing');
        await this.locked(dir, async () => {
            const current = await this.readRun(root, old.id);
            if (!current || !same(current, old)) throw new Error('Stale agent run; re-read before updating');
            if (!canTransitionAgentRun(current.status, next.status) && (current.status !== next.status ||
                ['completed', 'cancelled', 'failed', 'interrupted'].includes(current.status))) throw new Error('Illegal AgentRun transition');
            for (const key of ['version', 'id', 'taskId', 'grantId', 'grantRevision', 'requestedPolicy', 'projectRoot', 'projectId', 'createdAt', 'executionWorkspace'] as const)
                if (!same(current[key], next[key])) throw new Error('Immutable AgentRun field changed');
            if (current.startedAt && current.startedAt !== next.startedAt || current.endedAt && current.endedAt !== next.endedAt ||
                current.provenance && !same(current.provenance, next.provenance) || current.basis && !same(current.basis, next.basis) ||
                current.recovery && !same(current.recovery, next.recovery) || current.outcome && !same(current.outcome, next.outcome) ||
                current.finalGit && !same(current.finalGit, next.finalGit) ||
                current.candidateDelta && !same(current.candidateDelta, next.candidateDelta) ||
                current.authorityDecision && !same(current.authorityDecision, next.authorityDecision) ||
                current.appliedFiles && !same(current.appliedFiles, next.appliedFiles) ||
                current.validationBasis && current.validationBasis !== next.validationBasis ||
                (current.capacityRetries ?? 0) > (next.capacityRetries ?? 0) ||
                (!next.finalGit && current.changedFiles.some((file, index) => next.changedFiles[index] !== file)) ||
                current.validationResults.some((item, index) => !same(item, next.validationResults[index])) ||
                current.commandEvidence?.some((item, index) => !same(item, next.commandEvidence?.[index])))
                throw new Error('Immutable AgentRun evidence changed');
            await this.atomic(join(dir, 'run.json'), next);
        });
        this.notify(root, 'run', next.id);
        return next;
    }

    private async events(root: string, runId: string): Promise<AgentRunEvent[]> {
        const dir = await this.runDir(root, runId, false);
        if (!dir) return [];
        const bytes = await this.bytes(join(dir, 'events.jsonl'), EVENTS_BYTES_LIMIT);
        if (bytes === undefined) return [];
        try {
            if (!bytes.endsWith('\n')) throw new Error('Partial event');
            const lines = bytes.slice(0, -1).split('\n');
            if (lines.length > AGENT_EVENT_LIMIT) throw new Error('Too many events');
            return lines.map((line, index) => {
                if (Buffer.byteLength(`${line}\n`) > AGENT_EVENT_BYTES_LIMIT) throw new Error('Oversized event');
                const event = checked(JSON.parse(line), parseAgentRunEvent);
                if (event.runId !== runId || event.sequence !== index + 1) throw new Error('Invalid event order');
                return event;
            });
        } catch { throw new Error('Corrupt or unsupported agent events'); }
    }

    async readEvents(root: string, runId: string, afterSequence: number, limit: number): Promise<{ events: AgentRunEvent[]; nextSequence: number; hasMore: boolean }> {
        integer(afterSequence, AGENT_EVENT_LIMIT);
        integer(limit, AGENT_EVENT_PAGE_LIMIT);
        if (!limit) throw new Error('Invalid agent event page size');
        if (!await this.readRun(root, runId)) throw new Error('Agent run missing');
        const all = await this.events(root, runId);
        if (afterSequence > all.length) throw new Error('Agent event cursor exceeds log');
        const page = all.slice(afterSequence, afterSequence + limit);
        return { events: page, nextSequence: afterSequence + page.length, hasMore: afterSequence + page.length < all.length };
    }

    async appendEvent(root: string, value: AgentRunEvent): Promise<AgentRunEvent> {
        const event = checked(value, parseAgentRunEvent);
        if (event.path) await this.projectPath(root, event.path);
        const dir = await this.runDir(root, event.runId, false);
        if (!dir) throw new Error('Agent run missing');
        await this.locked(dir, async () => {
            if (!await this.readRun(root, event.runId)) throw new Error('Agent run missing');
            const prior = await this.events(root, event.runId);
            if (prior.length >= AGENT_EVENT_LIMIT || event.sequence !== prior.length + 1) throw new Error('Agent event limit or sequence mismatch');
            if (prior.length && event.at < prior[prior.length - 1].at) throw new Error('Agent event timestamp order mismatch');
            const line = `${JSON.stringify(event)}\n`;
            if (Buffer.byteLength(line) > AGENT_EVENT_BYTES_LIMIT) throw new Error('Agent event exceeds size limit');
            const file = join(dir, 'events.jsonl');
            await this.file(file);
            const handle = await open(file, constants.O_WRONLY | constants.O_APPEND | constants.O_CREAT | constants.O_NOFOLLOW, 0o600);
            try {
                const info = await handle.stat();
                if (!info.isFile() || info.size + Buffer.byteLength(line) > EVENTS_BYTES_LIMIT) throw new Error('Agent event log exceeds size limit');
                await handle.writeFile(line);
                await handle.sync();
            } finally { await handle.close(); }
        });
        this.notify(root, 'event', event.runId);
        return event;
    }
}
