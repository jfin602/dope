import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { ChatRepository } from '@dope/chat/lib/node/chat-repository';
import { AgentStore } from '@dope/agent-core/lib/node/agent-store';
import { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import type { HistoryContinuation, HistoryFocusTarget, HistoryProject, VerifiedHistoryFocus } from '@dope/contracts/lib/history';

interface FocusRecord extends HistoryProject {
    schemaVersion: 1;
    owner: HistoryFocusTarget;
    observedAt: string;
    basis: string;
}

const MAX_BYTES = 2048;
const safeId = (id: unknown): id is string => typeof id === 'string' &&
    id.length > 0 && id.length <= 120 && /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(id);
const own = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === 'object' && !Array.isArray(value);

function validOwner(value: unknown): value is HistoryFocusTarget {
    if (!own(value)) return false;
    switch (value.kind) {
        case 'chat': return Object.keys(value).sort().join() === 'chatId,kind' && safeId(value.chatId);
        case 'planning-map': return Object.keys(value).sort().join() === 'kind,mapId' && safeId(value.mapId);
        case 'work-item': return Object.keys(value).sort().join() === 'kind,mapId,workItemId' &&
            safeId(value.mapId) && safeId(value.workItemId);
        case 'agent-task': return Object.keys(value).sort().join() === 'kind,taskId' && safeId(value.taskId);
        case 'agent-run': return Object.keys(value).sort().join() === 'kind,runId' && safeId(value.runId);
        case 'agent-sequence': return Object.keys(value).sort().join() === 'kind,sequenceId' && safeId(value.sequenceId);
        case 'editor': return Object.keys(value).sort().join() === 'kind,projectRelativePath' &&
            typeof value.projectRelativePath === 'string' && value.projectRelativePath.length <= 512 &&
            value.projectRelativePath.length > 0 && !isAbsolute(value.projectRelativePath) &&
            value.projectRelativePath.split(/[\\/]/u).every(part => part !== '..' && part !== '.' && part !== '');
        default: return false;
    }
}

async function filePath(project: HistoryProject, create = false): Promise<string> {
    const root = project.projectRoot;
    if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
        throw new Error('History focus requires a canonical project root');
    const directory = join(root, '.dope');
    if (create) {
        try { await mkdir(directory); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
    }
    const info = await lstat(directory);
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory)
        throw new Error('Unsafe History focus directory');
    return join(directory, 'history-focus.json');
}

/** Identity evidence is read from the exact owner; these reads do not recover or write owners. */
async function basis(project: HistoryProject, owner: HistoryFocusTarget): Promise<string | undefined> {
    const root = project.projectRoot;
    switch (owner.kind) {
        case 'chat': {
            const chat = await new ChatRepository().peekMetadata(root, owner.chatId);
            return chat ? `chat:${chat.revision}:${chat.updatedAt}` : undefined;
        }
        case 'planning-map':
        case 'work-item': {
            const collection = await new PlanningStore().read(root);
            if (collection.projectId !== project.projectId) return undefined;
            const map = collection.maps.find(item => item.id === owner.mapId);
            if (!map || owner.kind === 'work-item' && !map.workItems.some(item => item.id === owner.workItemId)) return undefined;
            return `map:${map.revision}:${map.history[0]?.at ?? 'unknown'}`;
        }
        case 'agent-task': {
            const task = await new AgentStore().readTask(root, owner.taskId);
            return task && task.id === owner.taskId && (task.projectId === undefined || task.projectId === project.projectId) ?
                `task:${task.id}:${task.createdAt}` : undefined;
        }
        case 'agent-run': {
            const store = new AgentStore();
            const run = await store.readRun(root, owner.runId);
            const task = run && await store.readTask(root, run.taskId);
            return run && task && (run.projectId === undefined || run.projectId === project.projectId) &&
                (task.projectId === undefined || task.projectId === project.projectId) &&
                (run.projectId === undefined || task.projectId === undefined || run.projectId === task.projectId) &&
                task.id === run.taskId ? `run:${run.id}:${run.taskId}:${run.createdAt}` : undefined;
        }
        case 'agent-sequence': {
            const sequence = await new AgentStore().readSequence(root, owner.sequenceId);
            return sequence && sequence.id === owner.sequenceId ?
                `sequence:${sequence.id}:${sequence.createdAt}` : undefined;
        }
        case 'editor': {
            const path = join(root, owner.projectRelativePath);
            const rel = relative(root, path);
            if (!rel || rel.startsWith(`..${sep}`) || rel === '..') return undefined;
            const info = await lstat(path);
            if (!info.isFile() || info.isSymbolicLink() || await realpath(path) !== path) return undefined;
            return `file:${info.dev}:${info.ino}`;
        }
    }
}

export async function writeHistoryFocus(project: HistoryProject, owner: HistoryFocusTarget,
    stillCurrent: () => boolean): Promise<void> {
    if (!validOwner(owner)) throw new Error('Unsupported History focus target');
    const ownerBasis = await basis(project, owner);
    if (!ownerBasis || !stillCurrent()) return;
    const path = await filePath(project, true);
    const record: FocusRecord = { schemaVersion: 1, ...project, owner, observedAt: new Date().toISOString(), basis: ownerBasis };
    const bytes = JSON.stringify(record);
    if (Buffer.byteLength(bytes) > MAX_BYTES) throw new Error('History focus exceeds metadata bound');
    try {
        const existing = await lstat(path);
        if (!existing.isFile() || existing.isSymbolicLink()) throw new Error('Unsafe History focus file');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    if (!stillCurrent()) return;
    const temporary = `${path}.${randomUUID()}.tmp`;
    if (await realpath(join(project.projectRoot, '.dope')) !== join(project.projectRoot, '.dope'))
        throw new Error('Unsafe History focus directory');
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
        await handle.writeFile(bytes);
        await handle.sync();
    } finally { await handle.close(); }
    try {
        if (stillCurrent() && await realpath(project.projectRoot) === project.projectRoot &&
            await realpath(join(project.projectRoot, '.dope')) === join(project.projectRoot, '.dope')) await rename(temporary, path);
    } finally { await rm(temporary, { force: true }); }
}

export interface HistoryFocusState {
    verified?: VerifiedHistoryFocus;
    unavailable?: Extract<HistoryContinuation, { kind: 'unavailable-focus' }>;
    diagnostic?: string;
}

/** Display evidence is never navigation authority. Only `verified` can enable Continue. */
export async function readHistoryFocusState(project: HistoryProject): Promise<HistoryFocusState> {
    try {
        const path = await filePath(project);
        const info = await lstat(path);
        if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_BYTES)
            return { unavailable: { kind: 'unavailable-focus', reason: 'unverified' },
                diagnostic: 'History focus metadata is unsafe or exceeds its size limit' };
        const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        let raw: string;
        try {
            if ((await handle.stat()).size > MAX_BYTES)
                return { unavailable: { kind: 'unavailable-focus', reason: 'unverified' },
                    diagnostic: 'History focus metadata changed during read' };
            const bytes = Buffer.alloc(MAX_BYTES + 1);
            const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
            if (bytesRead > MAX_BYTES || bytesRead !== info.size)
                return { unavailable: { kind: 'unavailable-focus', reason: 'unverified' },
                    diagnostic: 'History focus metadata changed during read' };
            raw = bytes.subarray(0, bytesRead).toString('utf8');
        } finally { await handle.close(); }
        const value: unknown = JSON.parse(raw);
        if (!own(value) || Object.keys(value).sort().join() !==
            'basis,observedAt,owner,projectId,projectRoot,schemaVersion' || value.schemaVersion !== 1 ||
            value.projectId !== project.projectId || value.projectRoot !== project.projectRoot ||
            !validOwner(value.owner) || typeof value.basis !== 'string' ||
            typeof value.observedAt !== 'string' || !Number.isFinite(Date.parse(value.observedAt)))
            return { unavailable: { kind: 'unavailable-focus', reason: 'unverified' },
                diagnostic: 'History focus metadata is invalid or belongs to another project' };
        const target = { kind: 'unavailable-focus' as const, owner: value.owner,
            observedAt: value.observedAt };
        let currentBasis: string | undefined;
        try { currentBasis = await basis(project, value.owner); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT')
                return { unavailable: { ...target, reason: 'missing' } };
            return { unavailable: { ...target, reason: 'unverified' },
                diagnostic: 'Previously focused target could not be verified safely' };
        }
        if (!currentBasis) return { unavailable: { ...target, reason: 'unverified' },
            diagnostic: 'Previously focused target could not be verified safely' };
        if (currentBasis !== value.basis) return { unavailable: { ...target, reason: 'stale' } };
        return { verified: { ...project, owner: value.owner, observedAt: value.observedAt,
            availability: 'available', verified: true } };
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
        return { unavailable: { kind: 'unavailable-focus', reason: 'unverified' },
            diagnostic: 'History focus metadata could not be read or verified' };
    }
}

export async function readHistoryFocus(project: HistoryProject): Promise<VerifiedHistoryFocus | undefined> {
    return (await readHistoryFocusState(project)).verified;
}
