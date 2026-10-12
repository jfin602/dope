import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { previewRoadmapImport } from './roadmap-import';
import type { RoadmapCitation, RoadmapImportPreview, RoadmapStatus } from './roadmap-import';

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_CHECKPOINTS = 4096;
const MAX_LINKS = 128;
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const revision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const id = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 256 && !/[\x00-\x1f]/.test(value);
const text = (value: unknown, limit: number): value is string => typeof value === 'string' && value.length <= limit && !value.includes('\0');
const status = (value: unknown): value is RoadmapStatus =>
    ['green', 'not-green', 'not-implemented', 'waived', 'active', 'unknown'].includes(value as string);
const fail = (reason: string): never => { throw new Error(`Invalid Roadmap index: ${reason}`); };

export interface RoadmapLink {
    owner: 'document' | 'project-mind' | 'issue' | 'planning-map' | 'work-item' | 'evidence';
    targetId: string;
    ownerRevision?: number;
    sourceHash?: string;
}
export interface RoadmapCheckpoint {
    id: string;
    kind: 'phase' | 'correction' | 'milestone';
    title: string;
    objective: string;
    order: number;
    dependencies: string[];
    links: RoadmapLink[];
    status: RoadmapStatus;
    readOnly: boolean;
    source?: RoadmapCitation;
    evidence: RoadmapCitation[];
}
export interface RoadmapIndex {
    schemaVersion: 1;
    projectId: string;
    projectRoot: string;
    revision: number;
    checkpoints: RoadmapCheckpoint[];
}
export interface RoadmapChange { root: string; projectId: string; revision: number; changedIds: string[] }
export type RoadmapMutation =
    | { type: 'create'; id: string; kind: RoadmapCheckpoint['kind']; title: string; objective: string; order: number; dependencies?: string[]; links?: RoadmapLink[] }
    | { type: 'update'; id: string; title: string; objective: string; order: number; dependencies: string[]; links: RoadmapLink[] };

function citation(value: unknown): value is RoadmapCitation {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    return text(item.path, 512) && !item.path.startsWith('/') && !item.path.split('/').includes('..') &&
        typeof item.sha256 === 'string' && /^[a-f0-9]{64}$/.test(item.sha256) &&
        Number.isSafeInteger(item.line) && (item.line as number) > 0 && text(item.text, 4096) &&
        (item.status === undefined || status(item.status)) && (item.statusText === undefined || text(item.statusText, 4096));
}
function link(value: unknown): value is RoadmapLink {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    return ['document', 'project-mind', 'issue', 'planning-map', 'work-item', 'evidence'].includes(item.owner as string) &&
        id(item.targetId) && (item.ownerRevision === undefined || revision(item.ownerRevision)) &&
        (item.sourceHash === undefined || typeof item.sourceHash === 'string' && /^[a-f0-9]{64}$/.test(item.sourceHash));
}

/** Reject unknown versions and malformed persisted state rather than normalizing it into new authority. */
export function parseRoadmapIndex(value: unknown, root: string): RoadmapIndex {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('document');
    const raw = value as Record<string, unknown>;
    if (Object.keys(raw).sort().join(',') !== 'checkpoints,projectId,projectRoot,revision,schemaVersion' ||
        raw.schemaVersion !== 1 || !id(raw.projectId) || raw.projectId === 'uninitialized' ||
        raw.projectRoot !== root || !revision(raw.revision) || raw.revision === 0 || !Array.isArray(raw.checkpoints) ||
        raw.checkpoints.length > MAX_CHECKPOINTS) fail('schema or project root');
    const checkpoints = raw.checkpoints as unknown[];
    const seen = new Set<string>();
    for (const value of checkpoints) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) fail('checkpoint');
        const item = value as Record<string, unknown>;
        if (Object.keys(item).sort().join(',') !== (item.source === undefined ?
            'dependencies,evidence,id,kind,links,objective,order,readOnly,status,title' :
            'dependencies,evidence,id,kind,links,objective,order,readOnly,source,status,title') ||
            !id(item.id) || seen.has(item.id) || !['phase', 'correction', 'milestone'].includes(item.kind as string) ||
            !text(item.title, 512) || !text(item.objective, 8192) || !Number.isSafeInteger(item.order) ||
            (item.order as number) < 0 || !Array.isArray(item.dependencies) || item.dependencies.length > MAX_LINKS ||
            item.dependencies.some(dep => !id(dep) || dep === item.id) || new Set(item.dependencies).size !== item.dependencies.length ||
            !Array.isArray(item.links) || item.links.length > MAX_LINKS || item.links.some(ref => !link(ref)) ||
            !status(item.status) || typeof item.readOnly !== 'boolean' ||
            (item.source === undefined ? item.readOnly : !citation(item.source)) ||
            !Array.isArray(item.evidence) || item.evidence.length > MAX_LINKS || item.evidence.some(ref => !citation(ref))) fail('checkpoint fields');
        seen.add(item.id as string);
    }
    const byId = new Map((checkpoints as RoadmapCheckpoint[]).map(item => [item.id, item]));
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (checkpointId: string): void => {
        if (visiting.has(checkpointId)) fail('dependency cycle');
        if (visited.has(checkpointId)) return;
        const checkpoint = byId.get(checkpointId);
        if (!checkpoint) throw new Error('Invalid Roadmap index: missing dependency');
        visiting.add(checkpointId);
        for (const dependency of checkpoint.dependencies) visit(dependency);
        visiting.delete(checkpointId);
        visited.add(checkpointId);
    };
    for (const checkpointId of byId.keys()) visit(checkpointId);
    return value as RoadmapIndex;
}

export class RoadmapStore {
    private readonly listeners = new Set<(change: RoadmapChange) => void>();

    onChange(listener: (change: RoadmapChange) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private async paths(root: string): Promise<{ directory: string; file: string; lock: string }> {
        if (typeof root !== 'string' || !isAbsolute(root) || resolve(root) !== root ||
            await realpath(root) !== root || !(await stat(root)).isDirectory()) throw new Error('Roadmap requires a canonical local root');
        const directory = join(root, '.dope');
        try {
            const info = await lstat(directory);
            if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory) throw new Error('Unsafe Roadmap directory');
        } catch (error) { if (!missing(error)) throw error; }
        return { directory, file: join(directory, 'roadmap.json'), lock: join(directory, 'roadmap.lock') };
    }

    private async regular(file: string): Promise<boolean> {
        try {
            const info = await lstat(file);
            if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsafe Roadmap file: ${file}`);
            if (info.size > MAX_BYTES) throw new Error('Roadmap index size limit exceeded');
            return true;
        } catch (error) { if (missing(error)) return false; throw error; }
    }

    async read(root: string): Promise<RoadmapIndex> {
        const { file } = await this.paths(root);
        if (!(await this.regular(file))) return { schemaVersion: 1, projectId: 'uninitialized', projectRoot: root, revision: 0, checkpoints: [] };
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const info = await handle.stat();
            if (!info.isFile() || info.size > MAX_BYTES) throw new Error('Unsafe Roadmap file');
            const bytes = await handle.readFile();
            if (bytes.length > MAX_BYTES) throw new Error('Roadmap index size limit exceeded');
            try { return parseRoadmapIndex(JSON.parse(bytes.toString('utf8')), root); }
            catch { throw new Error(`Corrupt or unsupported Roadmap index: ${file}`); }
        } finally { await handle.close(); }
    }

    private async replace(root: string, next: RoadmapIndex): Promise<void> {
        const { directory, file } = await this.paths(root);
        parseRoadmapIndex(next, root);
        const bytes = Buffer.from(`${JSON.stringify(next, null, 2)}\n`);
        if (bytes.length > MAX_BYTES) throw new Error('Roadmap index size limit exceeded');
        const temporary = join(directory, `roadmap.${randomUUID()}.tmp`);
        let replaced = false;
        try {
            const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
            await this.regular(file);
            await rename(temporary, file);
            replaced = true;
            const parent = await open(directory, 'r');
            try { await parent.sync(); } finally { await parent.close(); }
        } catch (error) {
            if (replaced) throw new Error(`Roadmap write outcome uncertain; re-read before retrying: ${String(error)}`);
            throw error;
        } finally { await rm(temporary, { force: true }); }
    }

    private async locked<T>(root: string, work: () => Promise<T>): Promise<T> {
        const { directory, lock } = await this.paths(root);
        let created = false;
        try { await lstat(directory); } catch (error) { if (missing(error)) created = true; else throw error; }
        await mkdir(directory, { recursive: true });
        await this.paths(root);
        if (created) {
            const parent = await open(root, 'r');
            try { await parent.sync(); } finally { await parent.close(); }
        }
        let handle: import('node:fs/promises').FileHandle | undefined;
        for (let attempt = 0; attempt < 2 && !handle; attempt++) {
            try {
                const acquired = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                try { await acquired.writeFile(`${process.pid}\n`); await acquired.sync(); handle = acquired; }
                catch (error) { await acquired.close(); await rm(lock); throw error; }
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                await this.regular(lock);
                const info = await lstat(lock);
                const reader = await open(lock, constants.O_RDONLY | constants.O_NOFOLLOW);
                let owner: string;
                try { owner = (await reader.readFile({ encoding: 'utf8' })).trim(); }
                finally { await reader.close(); }
                if (!/^[1-9]\d*$/.test(owner)) throw new Error(`Roadmap locked; inspect ${lock}`);
                try { process.kill(Number(owner), 0); throw new Error(`Roadmap locked; inspect ${lock}`); }
                catch (probe) { if ((probe as NodeJS.ErrnoException).code !== 'ESRCH') throw probe; }
                if ((await lstat(lock)).ino !== info.ino) throw new Error('Roadmap lock changed; inspect it');
                await rm(lock);
            }
        }
        if (!handle) throw new Error(`Roadmap locked; inspect ${lock}`);
        try { return await work(); }
        finally {
            const info = await handle.stat();
            await handle.close();
            try { if ((await lstat(lock)).ino !== info.ino) throw new Error('Roadmap lock changed; inspect it'); await rm(lock); }
            catch (error) { if (!missing(error)) throw error; }
        }
    }

    private publish(change: RoadmapChange): void {
        for (const listener of this.listeners) { try { listener(change); } catch { /* A listener cannot roll back a committed index. */ } }
    }

    private async commit(root: string, expectedRevision: number, expectedProjectId: string | undefined,
        transform: (current: RoadmapIndex) => Promise<{ checkpoints: RoadmapCheckpoint[]; changedIds: string[] }>): Promise<RoadmapIndex> {
        if (!revision(expectedRevision)) throw new Error('Invalid Roadmap revision');
        const result = await this.locked(root, async () => {
            const current = await this.read(root);
            if (expectedProjectId && current.projectId !== expectedProjectId) throw new Error('Roadmap identity changed; reattach');
            if (current.revision !== expectedRevision) throw new Error(`Stale Roadmap revision; current ${current.revision}`);
            const { checkpoints, changedIds } = await transform(current);
            if (!changedIds.length) return { snapshot: current, changedIds };
            const next = parseRoadmapIndex({ schemaVersion: 1, projectId: current.revision ? current.projectId : randomUUID(),
                projectRoot: root, revision: current.revision + 1, checkpoints }, root);
            await this.replace(root, next);
            return { snapshot: next, changedIds };
        });
        if (result.changedIds.length) this.publish({ root, projectId: result.snapshot.projectId,
            revision: result.snapshot.revision, changedIds: result.changedIds });
        return result.snapshot;
    }

    /** Accept exactly the preview the developer saw, after re-reading every source under the lock. */
    async acceptImport(root: string, expectedRevision: number, preview: RoadmapImportPreview,
        expectedProjectId?: string): Promise<RoadmapIndex> {
        return this.commit(root, expectedRevision, expectedProjectId, async current => {
            const fresh = await previewRoadmapImport(root);
            if (JSON.stringify(preview) !== JSON.stringify(fresh)) throw new Error('Stale Roadmap import preview');
            const checkpoints = [...current.checkpoints];
            const changedIds: string[] = [];
            const duplicate = new Set<string>();
            for (const item of preview.checkpoints) {
                if (duplicate.has(item.id)) continue;
                if (preview.checkpoints.filter(other => other.id === item.id).length > 1) { duplicate.add(item.id); continue; }
                const existing = checkpoints.find(checkpoint => checkpoint.id === item.id);
                if (existing && !existing.source) continue; // A later import cannot overwrite a roadmap-owned checkpoint.
                const imported: RoadmapCheckpoint = { id: item.id, kind: item.kind, title: item.title,
                    objective: existing?.objective ?? '',
                    order: existing?.order ?? checkpoints.length, dependencies: existing?.dependencies ?? [],
                    links: existing?.links ?? [], status: item.status, readOnly: item.readOnly, source: item.source, evidence: item.evidence };
                if (existing) {
                    if (JSON.stringify(existing) === JSON.stringify(imported)) continue;
                    checkpoints[checkpoints.indexOf(existing)] = imported;
                } else checkpoints.push(imported);
                changedIds.push(item.id);
            }
            return { checkpoints, changedIds };
        });
    }

    /** Low-level roadmap-owned field storage; P3 owns user/model authorization and cross-owner validation. */
    async mutate(root: string, expectedRevision: number, operation: RoadmapMutation,
        expectedProjectId?: string): Promise<RoadmapIndex> {
        return this.commit(root, expectedRevision, expectedProjectId, async current => {
            if (!operation || !id(operation.id) || !['create', 'update'].includes(operation.type)) throw new Error('Invalid Roadmap mutation');
            const checkpoints = [...current.checkpoints];
            const index = checkpoints.findIndex(item => item.id === operation.id);
            if (operation.type === 'create') {
                if (index >= 0) throw new Error('Roadmap checkpoint already exists');
                checkpoints.push({ id: operation.id, kind: operation.kind, title: operation.title,
                    objective: operation.objective, order: operation.order, dependencies: operation.dependencies ?? [],
                    links: operation.links ?? [], status: 'unknown', readOnly: false, evidence: [] });
            } else {
                if (index < 0) throw new Error('Unknown Roadmap checkpoint');
                if (checkpoints[index].readOnly) throw new Error('Source-backed Roadmap checkpoint is read-only');
                if (checkpoints[index].source) {
                    if (operation.title !== checkpoints[index].title) throw new Error('Markdown owns the source checkpoint title');
                    const fresh = await previewRoadmapImport(root);
                    const source = fresh.checkpoints.find(item => item.id === operation.id);
                    if (!source || source.readOnly || source.source.sha256 !== checkpoints[index].source.sha256 ||
                        source.title !== checkpoints[index].title || source.status !== checkpoints[index].status)
                        throw new Error('Stale Roadmap source; preview and accept import again');
                }
                checkpoints[index] = { ...checkpoints[index], title: operation.title, objective: operation.objective,
                    order: operation.order, dependencies: operation.dependencies, links: operation.links };
                if (JSON.stringify(checkpoints[index]) === JSON.stringify(current.checkpoints[index])) return { checkpoints, changedIds: [] };
            }
            return { checkpoints, changedIds: [operation.id] };
        });
    }
}
