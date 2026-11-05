import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { lstat, open, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { ChatRepository } from '@dope/chat/lib/node/chat-repository';
import { parsePlanningCollection } from '@dope/visual-planning/lib/node/planning-store';
import { parseProjectMind } from '@dope/project-intelligence';
import { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { HistoryEntry, HistoryProject, HistorySource } from '@dope/contracts/lib/history';
import { projectRoadmapEvidenceRevision } from './history-roadmap-evidence';

export interface HistoryOwnerMetadata {
    entries: HistoryEntry[];
    diagnostics: { source: 'chat' | 'planning' | 'project-mind' | 'roadmap'; message: string }[];
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
        { source: 'planning', message: 'Invalid project root' }, { source: 'project-mind', message: 'Invalid project root' },
        { source: 'roadmap', message: 'Invalid project root' }] }; }
    const diagnostic = (source: HistorySource, error: unknown): void => {
        if (source === 'chat' || source === 'planning' || source === 'project-mind' || source === 'roadmap')
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
    try {
        const store = new RoadmapStore();
        const index = await store.read(root);
        if (index.revision) {
            const revisions = await store.listRevisions(root, index.projectId, undefined, MAX_ITEMS);
            for (const record of revisions.revisions) {
                // The revision archive is the authority for actual changes. A current color,
                // a run-complete message, or a repeated delivery creates no History event.
                const after = JSON.parse((await store.fetchRevision(root, index.projectId, record.revision)).snapshot) as RoadmapGateIndex;
                let before: RoadmapGateIndex | undefined;
                if (record.revision > 1) try {
                    before = JSON.parse((await store.fetchRevision(root,
                        index.projectId, record.revision - 1)).snapshot) as RoadmapGateIndex;
                } catch { /* Retired history has no preceding comparison basis. */ }
                result.entries.push(...projectRoadmapEvidenceRevision(project, before, after, record.capturedAt));
                const from = record.receipt.restoredFromRevision;
                const operationIds = record.receipt.operationIds;
                if (from !== undefined && record.receipt.previousHeadRevision === record.revision - 1 &&
                    operationIds?.some(item => /^restore-approval:/.test(item))) {
                    result.entries.push({ ...project, kind: 'event', source: 'roadmap',
                        sourceId: `restore:${index.projectId}:${record.revision}`,
                        owner: { kind: 'editor', projectRelativePath: '.dope/roadmap.json' },
                        title: `Roadmap restored from R${from} as R${record.revision}`,
                        status: { kind: 'owner', label: 'Reviewed restore' }, availability: 'available',
                        ownerRevision: record.revision, ownerProjectId: index.projectId,
                        occurredAt: record.capturedAt, observedAt: null });
                } else if (from === undefined && record.provenance === 'owner-write' &&
                    record.receipt.kind === 'committed-owner-write' && operationIds?.length === 2 &&
                    operationIds[0].startsWith('phase-finish-planning:') &&
                    operationIds[1].startsWith('planning-approval:')) {
                    const phaseId = operationIds[0].slice('phase-finish-planning:'.length);
                    const approvalId = operationIds[1].slice('planning-approval:'.length);
                    const snapshot = JSON.parse((await store.fetchRevision(root, index.projectId, record.revision)).snapshot) as RoadmapGateIndex;
                    if (snapshot.phases.find(phase => phase.id === phaseId)?.planningLock?.approvalId === approvalId)
                        result.entries.push({ ...project, kind: 'event', source: 'roadmap',
                            sourceId: `finish-planning:${index.projectId}:${record.revision}`,
                            owner: { kind: 'editor', projectRelativePath: '.dope/roadmap.json' },
                            title: `Phase planning locked (R${record.revision})`,
                            status: { kind: 'owner', label: 'Reviewed Finish Planning' }, availability: 'available',
                            ownerRevision: record.revision, ownerProjectId: index.projectId,
                            occurredAt: record.capturedAt, observedAt: null });
                } else if (from === undefined && record.provenance === 'owner-write' &&
                    record.receipt.kind === 'committed-owner-write' && operationIds?.length === 2 &&
                    operationIds[0].startsWith('phase-work-review:') &&
                    operationIds[1].startsWith('phase-work-approved-by:')) {
                    const phaseId = operationIds[0].slice('phase-work-review:'.length);
                    const snapshot = JSON.parse((await store.fetchRevision(root, index.projectId, record.revision)).snapshot) as RoadmapGateIndex;
                    const previous = JSON.parse((await store.fetchRevision(root, index.projectId, record.revision - 1)).snapshot) as RoadmapGateIndex;
                    const links = snapshot.phases.find(phase => phase.id === phaseId)?.workLinks;
                    if (links?.length && JSON.stringify(links) !== JSON.stringify(previous.phases.find(phase => phase.id === phaseId)?.workLinks))
                        result.entries.push({ ...project, kind: 'event', source: 'roadmap',
                            sourceId: `phase-work:${index.projectId}:${record.revision}`,
                            owner: { kind: 'editor', projectRelativePath: '.dope/roadmap.json' },
                            title: `Phase Work links reviewed (R${record.revision})`,
                            status: { kind: 'owner', label: `${links.length} WorkItem links` }, availability: 'available',
                            ownerRevision: record.revision, ownerProjectId: index.projectId,
                            occurredAt: record.capturedAt, observedAt: null });
                } else if (from === undefined && record.provenance === 'owner-write' &&
                    record.receipt.kind === 'committed-owner-write' && operationIds?.length === 3 &&
                    operationIds[0].startsWith('phase-reopen-planning:') &&
                    operationIds[1].startsWith('planning-reopen-approval:') &&
                    operationIds[2].startsWith('planning-reopened-by:')) {
                    const phaseId = operationIds[0].slice('phase-reopen-planning:'.length);
                    const current = JSON.parse((await store.fetchRevision(root, index.projectId, record.revision)).snapshot) as RoadmapGateIndex;
                    const before = JSON.parse((await store.fetchRevision(root, index.projectId, record.revision - 1)).snapshot) as RoadmapGateIndex;
                    if (!current.phases.find(phase => phase.id === phaseId)?.planningLock &&
                        before.phases.find(phase => phase.id === phaseId)?.planningLock)
                        result.entries.push({ ...project, kind: 'event', source: 'roadmap',
                            sourceId: `reopen-planning:${index.projectId}:${record.revision}`,
                            owner: { kind: 'editor', projectRelativePath: '.dope/roadmap.json' },
                            title: `Phase planning reopened (R${record.revision})`,
                            status: { kind: 'owner', label: 'Reviewed Reopen Planning' }, availability: 'available',
                            ownerRevision: record.revision, ownerProjectId: index.projectId,
                            occurredAt: record.capturedAt, observedAt: null });
                } else if (record.provenance === 'owner-write' && record.receipt.kind === 'committed-owner-write' &&
                    from === undefined && record.receipt.previousHeadRevision === undefined &&
                    operationIds?.length && new Set(operationIds).size === operationIds.length &&
                    operationIds.every(item => /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(item))) {
                    // Only the reviewed native Apply path persists its accepted operation UUIDs.
                    // Other owner writes and linked Markdown sync have no such receipt.
                    const count = operationIds.length;
                    const eventHash = createHash('sha256').update(JSON.stringify(operationIds)).digest('hex');
                    result.entries.push({ ...project, kind: 'event', source: 'roadmap',
                        sourceId: `apply:${index.projectId}:${record.revision}:${eventHash}`,
                        owner: { kind: 'editor', projectRelativePath: '.dope/roadmap.json' },
                        title: `Roadmap Apply: ${count} accepted operation${count === 1 ? '' : 's'} (R${record.revision})`,
                        status: { kind: 'owner', label: 'Reviewed Apply' }, availability: 'available',
                        ownerRevision: record.revision, ownerProjectId: index.projectId,
                        occurredAt: record.capturedAt, observedAt: null });
                }
            }
            result.truncated ||= !!revisions.nextBefore;
        }
    } catch (error) { diagnostic('roadmap', error); }
    return result;
}
