import { constants } from 'node:fs';
import { lstat, open, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { ChatRepository } from '@dope/chat/lib/node/chat-repository';
import { parsePlanningCollection } from '@dope/visual-planning/lib/node/planning-store';
import { parseProjectMind } from '@dope/project-intelligence';
import type { HistoryEntry, HistoryProject, HistorySource } from '@dope/contracts/lib/history';

export interface HistoryOwnerMetadata {
    entries: HistoryEntry[];
    diagnostics: { source: 'chat' | 'planning' | 'project-mind'; message: string }[];
    truncated: boolean;
}

const MAX_ITEMS = 50;
const MAX_OWNER_BYTES = 2 * 1024 * 1024;
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

async function canonicalRoot(root: string): Promise<void> {
    if (typeof root !== 'string' || !isAbsolute(root) || resolve(root) !== root ||
        await realpath(root) !== root || !(await stat(root)).isDirectory())
        throw new Error('History requires a canonical project root');
}

/** A missing owner is distinct from corrupt, oversized and linked owner paths. */
async function ownerJson(root: string, name: string): Promise<unknown | undefined> {
    const directory = join(root, '.dope');
    let info;
    try { info = await lstat(directory); } catch (error) { if (missing(error)) return undefined; throw error; }
    if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory)
        throw new Error('Unsafe .dope directory');
    const file = join(directory, name);
    try { info = await lstat(file); } catch (error) { if (missing(error)) return undefined; throw error; }
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsafe ${name}`);
    if (info.size > MAX_OWNER_BYTES) throw new Error(`${name} exceeds metadata bound`);
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.size > MAX_OWNER_BYTES) throw new Error(`${name} exceeds metadata bound`);
        const bytes = Buffer.alloc(opened.size + 1);
        let offset = 0;
        while (offset < bytes.length) {
            const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset);
            if (!bytesRead) break;
            offset += bytesRead;
        }
        if (offset !== opened.size) throw new Error(`${name} changed during metadata read`);
        return JSON.parse(bytes.subarray(0, offset).toString('utf8'));
    } finally { await handle.close(); }
}

export async function readHistoryOwnerMetadata(project: HistoryProject, observedAt: string,
    chatRepository = new ChatRepository()): Promise<HistoryOwnerMetadata> {
    const result: HistoryOwnerMetadata = { entries: [], diagnostics: [], truncated: false };
    const { projectRoot: root } = project;
    try { await canonicalRoot(root); }
    catch { return { ...result, diagnostics: [{ source: 'chat', message: 'Invalid project root' },
        { source: 'planning', message: 'Invalid project root' }, { source: 'project-mind', message: 'Invalid project root' }] }; }
    const diagnostic = (source: HistorySource, error: unknown): void => {
        if (source === 'chat' || source === 'planning' || source === 'project-mind')
            result.diagnostics.push({ source, message: error instanceof Error ? error.message : String(error) });
    };
    try {
        const candidates = await chatRepository.peekCandidateIds(root, MAX_ITEMS);
        result.truncated ||= candidates.truncated;
        if (candidates.truncated) diagnostic('chat', 'Chat candidates truncated at 50');
        for (const chatId of candidates.ids) {
            try {
                const meta = await chatRepository.peekMetadata(root, chatId);
                if (!meta) { diagnostic('chat', `Chat ${chatId} missing`); continue; }
                result.entries.push({ ...project, kind: 'event', source: 'chat', sourceId: chatId,
                    owner: { kind: 'chat', chatId }, title: meta.title, status: { kind: 'owner', label: 'Chat' },
                    availability: 'available', ownerRevision: meta.revision, occurredAt: meta.lastInteractedAt, observedAt: null });
            } catch (error) { diagnostic('chat', `Chat ${chatId}: ${String(error)}`); }
        }
    } catch (error) { diagnostic('chat', error); }
    try {
        const raw = await ownerJson(root, 'planning-maps.json');
        if (raw !== undefined) {
            const planning = parsePlanningCollection(raw);
            let count = 0;
            for (const map of planning.maps) {
                if (count >= MAX_ITEMS) {
                    result.truncated = true; diagnostic('planning', 'Planning metadata truncated at 50'); break;
                }
                const latest = map.history.at(-1);
                result.entries.push({ ...project, kind: 'event', source: 'planning', sourceId: `map:${map.id}`,
                    owner: { kind: 'planning-map', mapId: map.id }, title: map.title,
                    status: { kind: 'owner', label: map.status }, availability: 'available', ownerRevision: map.revision,
                    occurredAt: latest?.at ?? null, observedAt: null });
                count++;
                for (const item of map.workItems) {
                    if (count >= MAX_ITEMS) {
                        result.truncated = true; diagnostic('planning', 'Planning metadata truncated at 50'); break;
                    }
                    result.entries.push({ ...project, kind: 'snapshot', source: 'planning',
                        sourceId: `work:${map.id}:${item.id}`, owner: { kind: 'work-item', mapId: map.id, workItemId: item.id },
                        title: item.title, status: { kind: 'work-item', state: item.status },
                        availability: 'available', ownerRevision: map.revision, occurredAt: null, observedAt });
                    count++;
                }
            }
        }
    } catch (error) { diagnostic('planning', error); }
    try {
        const raw = await ownerJson(root, 'project-mind.json');
        if (raw !== undefined) {
            const mind = parseProjectMind(raw);
            for (const artifact of mind.artifacts.slice(0, MAX_ITEMS)) {
                result.entries.push({ ...project, kind: 'event', source: 'project-mind', sourceId: artifact.id,
                    owner: { kind: 'project-mind', artifactId: artifact.id }, title: artifact.title,
                    status: { kind: 'owner', label: `${artifact.type}: ${artifact.status}` }, availability: 'available',
                    ownerRevision: mind.revision, ownerProjectId: mind.projectId,
                    occurredAt: artifact.updatedAt, observedAt: null });
            }
            if (mind.artifacts.length > MAX_ITEMS) {
                result.truncated = true; diagnostic('project-mind', 'Project Mind metadata truncated at 50');
            }
        }
    } catch (error) { diagnostic('project-mind', error); }
    return result;
}
