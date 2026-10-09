import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AgentRun, AgentRunEvent, AgentTask, CandidateDelta, id, integer, parseAgentRun, parseAgentRunEvent, parseAgentTask, projectPath } from '../contracts';
import { canTransitionAgentRun } from '../state';
import { AgentTaskSequence, canTransitionSequence, parseAgentTaskSequence } from '../sequence';
import { ProposedAction, parseProposedAction } from '../proposed-action';
import { AgentSteeringRequest, AgentSteeringState, parseAgentSteeringRequest, parseAgentSteeringState } from '../steering';
import { AGENT_TRANSCRIPT_BYTES_LIMIT, AGENT_TRANSCRIPT_ENTRY_LIMIT, AGENT_TRANSCRIPT_PAGE_LIMIT,
    AGENT_TRANSCRIPT_RECORD_BYTES_LIMIT, AgentTranscriptEntry, AgentTranscriptInput, AgentTranscriptRecord, AgentTranscriptStorage,
    parseAgentTranscriptRecord, prepareAgentTranscriptRecord } from '../transcript';

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

export class AgentStore implements AgentTranscriptStorage {
    private readonly transcriptCache = new Map<string, { identity: string; records: AgentTranscriptRecord[];
        entries: AgentTranscriptEntry[]; text: string; recorded: boolean }>();
    private readonly listeners = new Set<(root: string, change: { kind: 'task' | 'run' | 'event' | 'sequence' | 'transcript' | 'action' | 'steering'; id: string }) => void>();

    onChange(listener: (root: string, change: { kind: 'task' | 'run' | 'event' | 'sequence' | 'transcript' | 'action' | 'steering'; id: string }) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify(root: string, kind: 'task' | 'run' | 'event' | 'sequence' | 'transcript' | 'action' | 'steering', id: string): void {
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

    private async collection(root: string, name: 'tasks' | 'runs' | 'sequences' | 'actions', create: boolean): Promise<string | undefined> {
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

    /** Keep the frozen changed bytes beneath the run; a later review decision can verify them. */
    async saveReviewCandidate(root: string, runId: string, candidateRoot: string, delta: CandidateDelta): Promise<void> {
        const dir = await this.runDir(root, runId, false);
        if (!dir) throw new Error('Agent run missing');
        const target = join(dir, 'review-candidate');
        if (await this.directory(target, false)) throw new Error('Review candidate already exists');
        await this.directory(target, true);
        let total = 0;
        try {
            for (const effect of delta.effects) {
                if (effect.kind !== 'create' && effect.kind !== 'modify') continue;
                const path = projectPath(effect.path);
                await this.projectPath(candidateRoot, path);
                const source = await open(join(candidateRoot, path), constants.O_RDONLY | constants.O_NOFOLLOW);
                let bytes: Buffer;
                try {
                    const info = await source.stat();
                    if (!info.isFile() || info.size > 32 * 1024 * 1024 || (total += info.size) > 64 * 1024 * 1024)
                        throw new Error('Review candidate exceeds size limit');
                    bytes = await source.readFile();
                } finally { await source.close(); }
                if (createHash('sha256').update(bytes).digest('hex') !== effect.after)
                    throw new Error('Frozen review candidate changed');
                const parts = path.split('/');
                const leaf = parts.pop()!;
                let parent = target;
                for (const part of parts) {
                    parent = join(parent, part);
                    await this.directory(parent, true);
                }
                const file = await open(join(parent, leaf), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                try { await file.writeFile(bytes); await file.sync(); } finally { await file.close(); }
            }
        } catch (error) { await rm(target, { recursive: true, force: true }); throw error; }
    }

    async reviewCandidateRoot(root: string, runId: string): Promise<string | undefined> {
        const dir = await this.runDir(root, runId, false);
        if (!dir) return undefined;
        const path = join(dir, 'review-candidate');
        return await this.directory(path, false) ? path : undefined;
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

    private async atomicTranscript(file: string, text: string): Promise<void> {
        if (Buffer.byteLength(text) > AGENT_TRANSCRIPT_BYTES_LIMIT) throw new Error('Agent transcript exceeds size limit');
        const temp = `${file}.${randomUUID()}.tmp`;
        let replaced = false;
        try {
            const handle = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            try { await handle.writeFile(text); await handle.sync(); } finally { await handle.close(); }
            await this.file(file);
            await rename(temp, file);
            replaced = true;
            const parent = await open(resolve(file, '..'), constants.O_RDONLY);
            try { await parent.sync(); } finally { await parent.close(); }
        } catch (error) {
            if (replaced) throw new Error('Agent transcript write outcome uncertain; re-read before retrying');
            throw error;
        } finally { await rm(temp, { force: true }); }
    }

    private async transcript(root: string, runId: string): Promise<{ records: AgentTranscriptRecord[];
        entries: AgentTranscriptEntry[]; text: string; recorded: boolean }> {
        const dir = await this.runDir(root, runId, false);
        if (!dir || !await this.readRun(root, runId)) throw new Error('Agent run missing');
        const file = join(dir, 'transcript.jsonl');
        const exists = await this.file(file);
        const info = exists ? await stat(file) : undefined;
        if (info && info.size > AGENT_TRANSCRIPT_BYTES_LIMIT) throw new Error('Oversized agent file');
        const identity = info && `${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`;
        const cached = this.transcriptCache.get(file);
        if (cached && identity && cached.identity === identity) return cached;
        this.transcriptCache.delete(file);
        const text = exists ? await this.bytes(file, AGENT_TRANSCRIPT_BYTES_LIMIT) : undefined;
        if (text === undefined) return { records: [], entries: [], text: '', recorded: false };
        try {
            if (text && !text.endsWith('\n')) throw new Error('Partial transcript');
            const lines = text ? text.slice(0, -1).split('\n') : [];
            if (lines.length > AGENT_TRANSCRIPT_ENTRY_LIMIT) throw new Error('Too many transcript records');
            const records: AgentTranscriptRecord[] = [];
            const entries: AgentTranscriptEntry[] = [];
            const commands = new Map<string, number>();
            for (const [index, line] of lines.entries()) {
                if (Buffer.byteLength(`${line}\n`) > AGENT_TRANSCRIPT_RECORD_BYTES_LIMIT) throw new Error('Oversized transcript record');
                const item = parseAgentTranscriptRecord(JSON.parse(line));
                const previous = records[index - 1];
                if (item.runId !== runId || item.sequence !== index + 1 ||
                    (previous && item.at < previous.at) ||
                    (previous?.kind === 'marker' && previous.code === 'transcript-incomplete'))
                    throw new Error('Invalid transcript order');
                records.push(item);
                if (item.kind === 'command') {
                    if (commands.has(item.commandId)) throw new Error('Duplicate transcript command');
                    commands.set(item.commandId, entries.length);
                    entries.push(item);
                } else if (item.kind === 'command-finish') {
                    const position = commands.get(item.commandId);
                    if (position === undefined) throw new Error('Orphan transcript command finish');
                    const start = entries[position];
                    if (start.kind !== 'command' || start.status !== 'running') throw new Error('Duplicate transcript command finish');
                    entries[position] = Object.freeze({ ...start, status: item.status, completedSequence: item.sequence,
                        ...(item.exitCode === undefined ? {} : { exitCode: item.exitCode }),
                        ...(item.durationMs === undefined ? {} : { durationMs: item.durationMs }),
                        ...(item.stdout === undefined ? {} : { stdout: item.stdout, stdoutTruncated: item.stdoutTruncated }),
                        ...(item.stderr === undefined ? {} : { stderr: item.stderr, stderrTruncated: item.stderrTruncated }),
                        ...(item.output === undefined ? {} : { output: item.output, outputTruncated: item.outputTruncated }) });
                } else entries.push(item);
            }
            const snapshot = { records, entries, text, recorded: true, identity: identity! };
            this.transcriptCache.set(file, snapshot);
            if (this.transcriptCache.size > 4) this.transcriptCache.delete(this.transcriptCache.keys().next().value!);
            return snapshot;
        } catch { throw new Error('Corrupt or unsupported agent transcript'); }
    }

    async readTranscript(root: string, runId: string, afterSequence: number, limit: number): Promise<{
        state: 'recorded' | 'not-recorded'; entries: AgentTranscriptEntry[]; nextSequence: number;
        hasMore: boolean; incomplete: boolean }> {
        integer(afterSequence, AGENT_TRANSCRIPT_ENTRY_LIMIT);
        integer(limit, AGENT_TRANSCRIPT_PAGE_LIMIT);
        if (!limit) throw new Error('Invalid agent transcript page size');
        const { records, entries, recorded } = await this.transcript(root, runId);
        if (afterSequence > records.length) throw new Error('Agent transcript cursor exceeds log');
        const available = entries.filter(entry => entry.sequence > afterSequence);
        const page = available.slice(0, limit);
        return { state: recorded ? 'recorded' : 'not-recorded', entries: page,
            nextSequence: page.length ? page[page.length - 1].sequence : afterSequence,
            hasMore: available.length > page.length,
            incomplete: records.some(item => item.kind === 'marker' && item.code === 'transcript-incomplete') };
    }

    async appendTranscript(root: string, runId: string, input: AgentTranscriptInput): Promise<{
        recorded: boolean; incomplete: boolean; sequence: number }> {
        const dir = await this.runDir(root, runId, false);
        if (!dir) throw new Error('Agent run missing');
        return this.locked(dir, async () => {
            const { records, text } = await this.transcript(root, runId);
            if (records.some(item => item.kind === 'marker' && item.code === 'transcript-incomplete'))
                return { recorded: false, incomplete: true, sequence: records.length };
            const item = prepareAgentTranscriptRecord(runId, records.length + 1, input);
            if (records.length && item.at < records[records.length - 1].at) throw new Error('Agent transcript timestamp order mismatch');
            if (item.kind === 'command' && records.some(previous =>
                (previous.kind === 'command' || previous.kind === 'command-finish') && previous.commandId === item.commandId))
                throw new Error('Duplicate transcript command');
            if (item.kind === 'command-finish') {
                if (!records.some(previous => previous.kind === 'command' && previous.commandId === item.commandId) ||
                    records.some(previous => previous.kind === 'command-finish' && previous.commandId === item.commandId))
                    throw new Error('Invalid transcript command finish');
            }
            const line = `${JSON.stringify(item)}\n`;
            const marker = `${JSON.stringify({ version: 1, runId, sequence: records.length + 1,
                at: item.at, kind: 'marker', code: 'transcript-incomplete' })}\n`;
            const limited = records.length + 2 > AGENT_TRANSCRIPT_ENTRY_LIMIT ||
                Buffer.byteLength(line) > AGENT_TRANSCRIPT_RECORD_BYTES_LIMIT ||
                Buffer.byteLength(text) + Buffer.byteLength(line) + Buffer.byteLength(marker) > AGENT_TRANSCRIPT_BYTES_LIMIT;
            const file = join(dir, 'transcript.jsonl');
            await this.atomicTranscript(file, text + (limited ? marker : line));
            const storedRecord: AgentTranscriptRecord = limited ? { version: 1, runId,
                sequence: records.length + 1, at: item.at, kind: 'marker', code: 'transcript-incomplete' } : item;
            const nextEntries = [...(this.transcriptCache.get(file)?.entries ?? [])];
            if (storedRecord.kind === 'command-finish') {
                const index = nextEntries.findIndex(entry => entry.kind === 'command' && entry.commandId === storedRecord.commandId);
                const start = nextEntries[index];
                if (start?.kind === 'command') nextEntries[index] = Object.freeze({ ...start, status: storedRecord.status,
                    completedSequence: storedRecord.sequence,
                    ...(storedRecord.exitCode === undefined ? {} : { exitCode: storedRecord.exitCode }),
                    ...(storedRecord.durationMs === undefined ? {} : { durationMs: storedRecord.durationMs }),
                    ...(storedRecord.stdout === undefined ? {} : { stdout: storedRecord.stdout,
                        stdoutTruncated: storedRecord.stdoutTruncated }),
                    ...(storedRecord.stderr === undefined ? {} : { stderr: storedRecord.stderr,
                        stderrTruncated: storedRecord.stderrTruncated }),
                    ...(storedRecord.output === undefined ? {} : { output: storedRecord.output,
                        outputTruncated: storedRecord.outputTruncated }) });
            } else nextEntries.push(storedRecord);
            const info = await stat(file);
            this.transcriptCache.set(file, { identity: `${info.ino}:${info.size}:${info.mtimeMs}:${info.ctimeMs}`,
                records: [...records, storedRecord], entries: nextEntries, text: text + (limited ? marker : line), recorded: true });
            if (this.transcriptCache.size > 4) this.transcriptCache.delete(this.transcriptCache.keys().next().value!);
            this.notify(root, 'transcript', runId);
            return { recorded: !limited, incomplete: limited, sequence: records.length + 1 };
        });
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
            const advanced = next.currentEntryNumber === current.currentEntryNumber + 1 &&
                next.checkpoints.length === current.checkpoints.length + 1 &&
                next.checkpoints.at(-1)?.entryNumber === current.currentEntryNumber &&
                (current.stack.entries[current.currentEntryNumber - 1]?.execution === 'manual-gate' ?
                    !current.taskId && !current.runIds?.length && !next.checkpoints.at(-1)?.taskId &&
                        !next.checkpoints.at(-1)?.runId :
                    next.checkpoints.at(-1)?.taskId === current.taskId &&
                        next.checkpoints.at(-1)?.runId === current.runIds?.at(-1));
            const nextBasis = advanced && next.basis.head === next.checkpoints.at(-1)?.sha &&
                next.basis.packageVersion === current.stack.entries[current.currentEntryNumber - 1]?.versionPolicy.version &&
                (next.basis.clean ?? true) === true;
            if (!same(current.stack, next.stack) || !(advanced ? nextBasis : same(current.basis, next.basis)) ||
                current.createdAt !== next.createdAt || next.updatedAt < current.updatedAt ||
                !advanced && current.taskId && current.taskId !== next.taskId ||
                !advanced && (current.runIds ?? []).some((runId, index) => next.runIds?.[index] !== runId) ||
                next.checkpoints.length < current.checkpoints.length ||
                current.checkpoints.some((checkpoint, index) => !same(checkpoint, next.checkpoints[index])) ||
                next.currentEntryNumber > current.currentEntryNumber && !advanced ||
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

    async readAction(root: string, actionId: string): Promise<ProposedAction | undefined> {
        const dir = await this.collection(root, 'actions', false);
        const action = dir ? await this.json(join(dir, `${id(actionId)}.json`), parseProposedAction) : undefined;
        if (action && action.id !== actionId) throw new Error('Corrupt ProposedAction identity');
        return action;
    }

    async listActions(root: string, taskId?: string): Promise<ProposedAction[]> {
        if (taskId !== undefined) id(taskId);
        const dir = await this.collection(root, 'actions', false);
        if (!dir) return [];
        const names = (await readdir(dir)).filter(name => name.endsWith('.json')).sort();
        if (names.length > 1000) throw new Error('Too many ProposedActions');
        const actions: ProposedAction[] = [];
        for (const name of names) {
            const action = await this.readAction(root, name.slice(0, -5));
            if (!action || `${action.id}.json` !== name) throw new Error('Corrupt ProposedAction identity');
            if (taskId === undefined || action.taskId === taskId) actions.push(action);
        }
        return actions;
    }

    async createAction(root: string, value: ProposedAction): Promise<ProposedAction> {
        const action = checked(value, parseProposedAction);
        if (action.revision !== 0) throw new Error('ProposedAction must begin blocked');
        const dir = (await this.collection(root, 'actions', true))!;
        await this.locked(dir, async () => {
            const task = await this.readTask(root, action.taskId);
            const run = await this.readRun(root, action.runId);
            if (!task || !run || run.taskId !== task.id) throw new Error('ProposedAction source task/run missing');
            if (await this.readAction(root, action.id)) throw new Error('ProposedAction already exists');
            await this.atomic(join(dir, `${action.id}.json`), action);
        });
        this.notify(root, 'action', action.id);
        return action;
    }

    async decideAction(root: string, expected: ProposedAction, value: ProposedAction): Promise<ProposedAction> {
        const old = checked(expected, parseProposedAction), next = checked(value, parseProposedAction);
        if (old.id !== next.id || old.taskId !== next.taskId || old.runId !== next.runId ||
            !same(old.effect, next.effect) || old.requiredAuthority !== next.requiredAuthority ||
            old.rationale !== next.rationale || old.createdAt !== next.createdAt ||
            old.decision || !next.decision || next.revision !== old.revision + 1)
            throw new Error('Invalid ProposedAction decision');
        const dir = await this.collection(root, 'actions', false);
        if (!dir) throw new Error('ProposedAction missing');
        await this.locked(dir, async () => {
            const current = await this.readAction(root, old.id);
            if (!current || !same(current, old)) throw new Error('Stale ProposedAction revision');
            await this.atomic(join(dir, `${old.id}.json`), next);
        });
        this.notify(root, 'action', old.id);
        return next;
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

    async readSteering(root: string, runId: string): Promise<AgentSteeringState | undefined> {
        const dir = await this.runDir(root, runId, false);
        const state = dir ? await this.json(join(dir, 'steering.json'), parseAgentSteeringState) : undefined;
        if (state) {
            const run = await this.readRun(root, runId);
            if (!run || state.runId !== runId || state.taskId !== run.taskId ||
                state.projectId !== run.projectId) throw new Error('Corrupt steering source identity');
        }
        return state;
    }

    /** Persist the request and truthful unsupported acknowledgement as one revisioned write. */
    async requestSteering(root: string, taskId: string, runId: string, expectedRevision: number,
        input: AgentSteeringRequest): Promise<AgentSteeringState> {
        const request = checked(input, parseAgentSteeringRequest);
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0)
            throw new Error('Invalid steering revision');
        const dir = await this.runDir(root, runId, false);
        if (!dir) throw new Error('Agent run missing');
        let next!: AgentSteeringState;
        await this.locked(dir, async () => {
            const run = await this.readRun(root, runId);
            const task = await this.readTask(root, taskId);
            if (!run || !task || run.taskId !== task.id || run.projectId !== task.projectId)
                throw new Error('Steering project/task/run mismatch');
            if (run.status !== 'running' || run.candidateReview || run.candidateDelta)
                throw new Error('Agent run has no steerable active turn');
            const current = await this.readSteering(root, runId);
            if ((current?.revision ?? 0) !== expectedRevision) throw new Error('Stale steering revision');
            if (current && (current.taskId !== task.id || current.projectId !== task.projectId))
                throw new Error('Steering project/task/run mismatch');
            const at = new Date().toISOString();
            next = checked({ version: 1, projectId: task.projectId, taskId: task.id, runId,
                revision: expectedRevision + 1, entries: [...(current?.entries ?? []), {
                    revision: expectedRevision + 1, requestedAt: at, request,
                    acknowledgement: { status: 'unsupported', at,
                        reason: 'active-turn-steering-unavailable', nextStep: 'explicit-stop-and-new-task' }
                }] }, parseAgentSteeringState);
            await this.atomic(join(dir, 'steering.json'), next);
        });
        this.notify(root, 'steering', runId);
        return next;
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
            run.candidateDelta || run.candidateFingerprint || run.authorityDecision || run.appliedFiles?.length || run.capacityRetries)
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
            if (current.status === 'blocked' && ['completed', 'cancelled'].includes(next.status) &&
                (!current.candidateReview || next.reviewDecision?.kind !==
                    (next.status === 'completed' ? 'accept' : 'reject')))
                throw new Error('Blocked run requires an explicit candidate review decision');
            for (const key of ['version', 'id', 'taskId', 'grantId', 'grantRevision', 'requestedPolicy', 'projectRoot', 'projectId', 'createdAt', 'executionWorkspace'] as const)
                if (!same(current[key], next[key])) throw new Error('Immutable AgentRun field changed');
            if (current.startedAt && current.startedAt !== next.startedAt || current.endedAt && current.endedAt !== next.endedAt ||
                current.provenance && !same(current.provenance, next.provenance) || current.basis && !same(current.basis, next.basis) ||
                current.recovery && !same(current.recovery, next.recovery) || current.outcome && !same(current.outcome, next.outcome) ||
                current.finalGit && !same(current.finalGit, next.finalGit) ||
                current.candidateDelta && !same(current.candidateDelta, next.candidateDelta) ||
                current.candidateFingerprint && current.candidateFingerprint !== next.candidateFingerprint ||
                current.candidateReview && !same(current.candidateReview, next.candidateReview) ||
                current.reviewDecision && !same(current.reviewDecision, next.reviewDecision) ||
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
