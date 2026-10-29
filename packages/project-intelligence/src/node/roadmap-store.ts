import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link as hardLink, lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { previewRoadmapImport } from './roadmap-import';
import { checkedRoadmapDocumentFile, planRoadmapDocumentPatch, publishRoadmapDocumentPatch } from './roadmap-document-patch';
import { readRoadmapMappedSections, previewRoadmapDocumentSync, previewRoadmapPendingRecovery } from './roadmap-document-sync';
import type { RoadmapMappedSection, RoadmapSyncPreview, RoadmapRelinkPreview, RoadmapPendingRecoveryPreview } from './roadmap-document-sync';
import type { RoadmapDocumentPatch } from './roadmap-document-patch';
import type { RoadmapCitation, RoadmapImportPreview, RoadmapStatus } from './roadmap-import';
import { parseRoadmapGateIndex } from './roadmap-gate-domain';
import type { RoadmapGateIndex } from './roadmap-gate-domain';

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
    owner: 'document' | 'project-mind' | 'issue' | 'planning-map' | 'transformation' | 'work-item' | 'evidence';
    targetId: string;
    ownerRevision?: number;
    sourceHash?: string;
    ownerProjectId?: string;
    basis?: { architectureRevision: number; architectureFingerprint: string; physicalInputFingerprint: string; physicalGeneration: number };
}
export interface RoadmapCheckpoint {
    id: string;
    kind: 'phase' | 'correction' | 'milestone';
    title: string;
    objective: string;
    order: number;
    dependencies: string[];
    /** Explicit correction membership, separate from graph dependencies. */
    parentPhaseId?: string;
    links: RoadmapLink[];
    status: RoadmapStatus;
    readOnly: boolean;
    source?: RoadmapCitation;
    evidence: RoadmapCitation[];
}
/** Bookkeeping for one explicitly accepted Markdown owner. No document write is implied. */
export interface RoadmapLinkedDocument {
    projectRoot: string;
    projectId: string;
    path: string;
    sourceHash: string;
    sections: { sectionKey: string; checkpointId: string }[];
    lastSynced: { sourceHash: string; roadmapRevision: number; fields?: Omit<RoadmapMappedSection, 'line' | 'heading'>[] };
    syncState: 'synced' | 'source-changed' | 'conflict' | 'pending-sync' | 'missing';
    pending?: { basisRevision: number; checkpointId: string; beforeHash: string; afterHash: string;
        title: string; objective: string; order: number; prose?: string; outcome: 'prepared' | 'document-written' | 'conflict' };
}
export interface RoadmapIndex {
    schemaVersion: 1;
    projectId: string;
    projectRoot: string;
    revision: number;
    checkpoints: RoadmapCheckpoint[];
    linkedDocument?: RoadmapLinkedDocument;
    /** Accepted creation intent. It is not a published Roadmap or a second draft store. */
    pendingCreation?: { path: string; sourceHash: string; content: string;
        topology?: { sectionKey: string; dependencies: string[]; parentPhaseKey?: string }[];
        planOrigin?: PendingPlanOrigin };
    /** Frozen provenance from a reviewed plan. The Roadmap and its linked source remain authoritative. */
    planOrigin?: RoadmapPlanOrigin;
}
export interface PendingPlanOrigin { planRevision: number; planHash: string; constraints: string[];
    steps: { stepId: string; sectionKey: string; expectedOutputs: string[] }[] }
export interface RoadmapPlanOrigin { planRevision: number; planHash: string; sourceHash: string; constraints: string[];
    steps: { stepId: string; checkpointId: string; expectedOutputs: string[] }[] }
export type GreenfieldTopology = NonNullable<RoadmapIndex['pendingCreation']>['topology'];
function validPlanOrigin(value: unknown, pending: boolean): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const origin = value as Record<string, unknown>;
    const keys = pending ? 'constraints,planHash,planRevision,steps' : 'constraints,planHash,planRevision,sourceHash,steps';
    if (Object.keys(origin).sort().join(',') !== keys || !revision(origin.planRevision) ||
        typeof origin.planHash !== 'string' || !/^[a-f0-9]{64}$/.test(origin.planHash) ||
        !pending && (typeof origin.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(origin.sourceHash)) ||
        !Array.isArray(origin.constraints) || origin.constraints.length > 32 ||
        origin.constraints.some(item => !text(item, 2048)) ||
        !Array.isArray(origin.steps) || !origin.steps.length || origin.steps.length > 128) return false;
    const seen = new Set<string>();
    return origin.steps.every((value: unknown) => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
        const step = value as Record<string, unknown>;
        const key = pending ? 'sectionKey' : 'checkpointId';
        if (Object.keys(step).sort().join(',') !== ['expectedOutputs', key, 'stepId'].sort().join(',') ||
            !id(step.stepId) || !id(step[key]) || seen.has(step.stepId) ||
            !Array.isArray(step.expectedOutputs) || step.expectedOutputs.length > 16 ||
            step.expectedOutputs.some(item => !text(item, 1024))) return false;
        seen.add(step.stepId as string);
        return true;
    });
}
function validGreenfieldTopology(value: unknown): value is GreenfieldTopology {
    return Array.isArray(value) && value.length <= MAX_CHECKPOINTS &&
        value.every(item => item && typeof item === 'object' && !Array.isArray(item) &&
            Object.keys(item).sort().join(',') === (item.parentPhaseKey === undefined ?
                'dependencies,sectionKey' : 'dependencies,parentPhaseKey,sectionKey') &&
            typeof item.sectionKey === 'string' && item.sectionKey.length > 0 && item.sectionKey.length <= 256 &&
            (item.parentPhaseKey === undefined || typeof item.parentPhaseKey === 'string' &&
                item.parentPhaseKey.length > 0 && item.parentPhaseKey.length <= 256 && item.parentPhaseKey !== item.sectionKey) &&
            Array.isArray(item.dependencies) && item.dependencies.length <= MAX_LINKS &&
            item.dependencies.every((key: unknown) => typeof key === 'string' && key.length > 0 && key.length <= 256) &&
            new Set(item.dependencies).size === item.dependencies.length) &&
        new Set(value.map(item => item.sectionKey)).size === value.length;
}
/** Read-only evidence for a deliberate change of the active Markdown owner. */
export interface RoadmapReplacementPreview {
    state: 'ready' | 'review';
    projectId: string;
    revision: number;
    previousPath: string;
    previousHash: string;
    observedPreviousHash?: string;
    path: string;
    sourceHash: string;
    removedCheckpointIds: string[];
    addedCheckpointIds: string[];
    retainedCheckpointIds: string[];
    manualCheckpointIds: string[];
    /** Active checkpoint data and links on these IDs need an explicit P2 disposition. */
    atRiskCheckpointIds: string[];
    atRiskCheckpoints: { id: string; title: string; status: RoadmapStatus; dependencies: number; links: number }[];
    /** A replacement changes the active owner; it never deletes the previous Markdown. */
    replacementWarning: string;
    sections: { sectionKey: string; checkpointId: string; line: number }[];
    diagnostics: { path: string; line?: number; checkpointId?: string; message: string; severity: 'blocking' | 'warning' }[];
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
    const planning = ['planning-map', 'transformation', 'work-item'].includes(item.owner as string);
    const basis = item.basis as Record<string, unknown> | undefined;
    return ['document', 'project-mind', 'issue', 'planning-map', 'transformation', 'work-item', 'evidence'].includes(item.owner as string) &&
        id(item.targetId) && (item.ownerRevision === undefined || revision(item.ownerRevision)) &&
        (item.sourceHash === undefined || typeof item.sourceHash === 'string' && /^[a-f0-9]{64}$/.test(item.sourceHash)) &&
        (planning ? id(item.ownerProjectId) && item.ownerRevision !== undefined && item.sourceHash === undefined &&
            !!basis && typeof basis === 'object' && !Array.isArray(basis) &&
            Object.keys(basis).sort().join(',') === 'architectureFingerprint,architectureRevision,physicalGeneration,physicalInputFingerprint' &&
            revision(basis.architectureRevision) && revision(basis.physicalGeneration) &&
            typeof basis.architectureFingerprint === 'string' && !!basis.architectureFingerprint &&
            typeof basis.physicalInputFingerprint === 'string' && !!basis.physicalInputFingerprint :
            item.ownerProjectId === undefined && item.basis === undefined);
}
function linkedDocument(value: unknown, raw: Record<string, unknown>, checkpoints: RoadmapCheckpoint[]): value is RoadmapLinkedDocument {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const item = value as Record<string, unknown>;
    if (Object.keys(item).sort().join(',') !== (item.pending === undefined ?
        'lastSynced,path,projectId,projectRoot,sections,sourceHash,syncState' :
        'lastSynced,path,pending,projectId,projectRoot,sections,sourceHash,syncState') ||
        item.projectRoot !== raw.projectRoot || item.projectId !== raw.projectId ||
        !text(item.path, 512) || !item.path || isAbsolute(item.path) || !/\.md$/i.test(item.path) ||
        item.path.includes('\\') || item.path.includes(':') ||
        item.path.split('/').some(part => !part || part === '.' || part === '..') ||
        typeof item.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(item.sourceHash) ||
        !['synced', 'source-changed', 'conflict', 'pending-sync', 'missing'].includes(item.syncState as string) ||
        !Array.isArray(item.sections) || item.sections.length > MAX_CHECKPOINTS) return false;
    const pending = item.pending as Record<string, unknown> | undefined;
    if ((item.syncState === 'pending-sync') !== !!pending) return false;
    if (pending && (typeof pending !== 'object' || Array.isArray(pending) ||
        Object.keys(pending).sort().join(',') !== (pending.prose === undefined ?
            'afterHash,basisRevision,beforeHash,checkpointId,objective,order,outcome,title' :
            'afterHash,basisRevision,beforeHash,checkpointId,objective,order,outcome,prose,title') ||
        !revision(pending.basisRevision) || (raw.revision as number) - (pending.basisRevision as number) < 1 ||
            (raw.revision as number) - (pending.basisRevision as number) > 3 ||
        !id(pending.checkpointId) || !text(pending.title, 512) || !text(pending.objective, 8192) ||
        !revision(pending.order) || pending.prose !== undefined && !text(pending.prose, 8192) ||
        typeof pending.beforeHash !== 'string' || !/^[a-f0-9]{64}$/.test(pending.beforeHash) ||
        typeof pending.afterHash !== 'string' || !/^[a-f0-9]{64}$/.test(pending.afterHash) ||
        !['prepared', 'document-written', 'conflict'].includes(pending.outcome as string) ||
        pending.beforeHash !== item.sourceHash || !checkpoints.some(checkpoint => (checkpoint as RoadmapCheckpoint).id === pending.checkpointId))) return false;
    const basis = item.lastSynced as Record<string, unknown> | undefined;
    if (!basis || typeof basis !== 'object' || Array.isArray(basis) ||
        Object.keys(basis).sort().join(',') !== (basis.fields === undefined ? 'roadmapRevision,sourceHash' : 'fields,roadmapRevision,sourceHash') ||
        !revision(basis.roadmapRevision) || (basis.roadmapRevision as number) > (raw.revision as number) ||
        typeof basis.sourceHash !== 'string' || !/^[a-f0-9]{64}$/.test(basis.sourceHash)) return false;
    if (basis.fields !== undefined && (!Array.isArray(basis.fields) || basis.fields.length !== item.sections.length ||
        basis.fields.some((value: unknown) => {
            if (!value || typeof value !== 'object' || Array.isArray(value)) return true;
            const field = value as Record<string, unknown>;
            return !id(field.checkpointId) || !text(field.title, 512) ||
                (field.objective !== undefined && !text(field.objective, 8192)) ||
                (field.prose !== undefined && !text(field.prose, 8192)) ||
                (field.order !== undefined && !revision(field.order)) ||
                Object.keys(field).some(key => !['checkpointId', 'title', 'objective', 'order', 'prose'].includes(key));
        }))) return false;
    const keys = new Set<string>();
    const ids = new Set<string>();
    const byId = new Map(checkpoints.map(checkpoint => [checkpoint.id, checkpoint]));
    for (const entry of item.sections) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
        const section = entry as Record<string, unknown>;
        if (Object.keys(section).sort().join(',') !== 'checkpointId,sectionKey' ||
            !id(section.sectionKey) || !id(section.checkpointId) ||
            keys.has(section.sectionKey) || ids.has(section.checkpointId)) return false;
        const checkpoint = byId.get(section.checkpointId);
        if (!checkpoint?.source || checkpoint.source.path !== item.path) return false;
        keys.add(section.sectionKey);
        ids.add(section.checkpointId);
    }
    if (basis.fields && (new Set((basis.fields as RoadmapMappedSection[]).map(field => field.checkpointId)).size !== item.sections.length ||
        (basis.fields as RoadmapMappedSection[]).some(field => !ids.has(field.checkpointId)))) return false;
    return true;
}

/** The authoritative schema-2 validator used by both reads and writes. */
export function parseRoadmapIndex(value: unknown, root: string): RoadmapGateIndex {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('document');
    const candidate = value as Record<string, unknown>;
    if (candidate.schemaVersion !== 2 || !id(candidate.projectId)) fail('schema');
    return parseRoadmapGateIndex(value, root, candidate.projectId as string);
}

/** Compile-only bridge for the checkpoint callers being removed by P17. Never reads or writes schema 1. */
export function parseRetiredCheckpointIndex(value: unknown, root: string): RoadmapIndex {
    if (!value || typeof value !== 'object' || Array.isArray(value)) fail('document');
    const raw = value as Record<string, unknown>;
    if (Object.keys(raw).sort().join(',') !== ['checkpoints', 'projectId', 'projectRoot', 'revision', 'schemaVersion',
        ...(raw.linkedDocument === undefined ? [] : ['linkedDocument']),
        ...(raw.pendingCreation === undefined ? [] : ['pendingCreation']),
        ...(raw.planOrigin === undefined ? [] : ['planOrigin'])].sort().join(',') ||
        raw.schemaVersion !== 1 || !id(raw.projectId) || raw.projectId === 'uninitialized' ||
        raw.projectRoot !== root || !revision(raw.revision) || raw.revision === 0 || !Array.isArray(raw.checkpoints) ||
        raw.checkpoints.length > MAX_CHECKPOINTS) fail('schema or project root');
    if (raw.pendingCreation !== undefined) {
        const pending = raw.pendingCreation as Record<string, unknown>;
        if (!pending || typeof pending !== 'object' || Array.isArray(pending) ||
            Object.keys(pending).sort().join(',') !== ['content', 'path', 'sourceHash',
                ...(pending.topology === undefined ? [] : ['topology']),
                ...(pending.planOrigin === undefined ? [] : ['planOrigin'])].sort().join(',') ||
            (pending.topology !== undefined && !validGreenfieldTopology(pending.topology)) ||
            (pending.planOrigin !== undefined && !validPlanOrigin(pending.planOrigin, true)) ||
            !text(pending.path, 512) || !pending.path || isAbsolute(pending.path) ||
            !/\.md$/i.test(pending.path) || pending.path.includes('\\') || pending.path.includes(':') ||
            pending.path.split('/').some(part => !part || part === '.' || part === '..') ||
            pending.path.split('/')[0] === '.dope' ||
            !text(pending.content, 2 * 1024 * 1024) ||
            Buffer.byteLength(pending.content as string) > 2 * 1024 * 1024 ||
            createHash('sha256').update(pending.content as string).digest('hex') !== pending.sourceHash ||
            raw.linkedDocument !== undefined || (raw.checkpoints as unknown[]).length !== 0 || raw.revision !== 1)
            fail('pending creation');
    }
    const checkpoints = raw.checkpoints as unknown[];
    const seen = new Set<string>();
    for (const value of checkpoints) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) fail('checkpoint');
        const item = value as Record<string, unknown>;
        if (Object.keys(item).sort().join(',') !== [
            'dependencies', 'evidence', 'id', 'kind', 'links', 'objective', 'order', 'readOnly', 'status', 'title',
            ...(item.source === undefined ? [] : ['source']),
            ...(item.parentPhaseId === undefined ? [] : ['parentPhaseId'])].sort().join(',') ||
            !id(item.id) || seen.has(item.id) || !['phase', 'correction', 'milestone'].includes(item.kind as string) ||
            !text(item.title, 512) || !text(item.objective, 8192) || !Number.isSafeInteger(item.order) ||
            (item.order as number) < 0 || !Array.isArray(item.dependencies) || item.dependencies.length > MAX_LINKS ||
            item.dependencies.some(dep => !id(dep) || dep === item.id) || new Set(item.dependencies).size !== item.dependencies.length ||
            (item.parentPhaseId !== undefined && (item.kind !== 'correction' || !id(item.parentPhaseId) || item.parentPhaseId === item.id)) ||
            !Array.isArray(item.links) || item.links.length > MAX_LINKS || item.links.some(ref => !link(ref)) ||
            !status(item.status) || typeof item.readOnly !== 'boolean' ||
            (item.source === undefined ? item.readOnly : !citation(item.source)) ||
            !Array.isArray(item.evidence) || item.evidence.length > MAX_LINKS || item.evidence.some(ref => !citation(ref))) fail('checkpoint fields');
        seen.add(item.id as string);
    }
    const byId = new Map((checkpoints as RoadmapCheckpoint[]).map(item => [item.id, item]));
    if (raw.planOrigin !== undefined && (!validPlanOrigin(raw.planOrigin, false) ||
        raw.pendingCreation !== undefined || !raw.linkedDocument))
        fail('plan provenance');
    for (const item of checkpoints as RoadmapCheckpoint[]) if (item.parentPhaseId &&
        byId.get(item.parentPhaseId)?.kind !== 'phase') fail('correction phase membership');
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
    if (raw.linkedDocument !== undefined && !linkedDocument(raw.linkedDocument, raw, checkpoints as RoadmapCheckpoint[]))
        fail('linked document');
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

    /** Runtime value is schema 2; the generic default temporarily keeps downstream checkpoint imports compiling. */
    async read<T extends RoadmapIndex | RoadmapGateIndex = RoadmapIndex>(root: string): Promise<T> {
        const { file } = await this.paths(root);
        if (!(await this.regular(file))) return { schemaVersion: 2, projectId: 'uninitialized', projectRoot: root,
            revision: 0, phases: [], gates: [], corrections: [] } as unknown as T;
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try {
            const info = await handle.stat();
            if (!info.isFile() || info.size > MAX_BYTES) throw new Error('Unsafe Roadmap file');
            const bytes = await handle.readFile();
            if (bytes.length > MAX_BYTES) throw new Error('Roadmap index size limit exceeded');
            const guidance = 'Review the index before an explicitly approved reinitialize or reimport; no source files were changed';
            let parsed: unknown;
            try { parsed = JSON.parse(bytes.toString('utf8')); }
            catch { throw new Error(`Corrupt or unsupported Roadmap index: ${file}. ${guidance}`); }
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
                'schemaVersion' in parsed && parsed.schemaVersion !== 2)
                throw new Error(`Incompatible Roadmap index schema: ${file}. ${guidance}`);
            try { return parseRoadmapIndex(parsed, root) as T; }
            catch { throw new Error(`Corrupt or unsupported Roadmap index: ${file}. ${guidance}`); }
        } finally { await handle.close(); }
    }

    private async replace(root: string, next: RoadmapGateIndex | RoadmapIndex, expectedHash?: string | null): Promise<void> {
        const { directory, file } = await this.paths(root);
        if (next.schemaVersion !== 2 || expectedHash === undefined)
            throw new Error('Checkpoint Roadmap writes are retired; review and reimport into schema 2');
        parseRoadmapIndex(next, root);
        const bytes = Buffer.from(`${JSON.stringify(next, null, 2)}\n`);
        if (bytes.length > MAX_BYTES) throw new Error('Roadmap index size limit exceeded');
        const temporary = join(directory, `roadmap.${randomUUID()}.tmp`);
        let replaced = false;
        try {
            const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
            const currentHash = await this.indexHash(file);
            if (currentHash !== expectedHash) throw new Error('Roadmap index changed before publication; review and retry');
            await rename(temporary, file);
            replaced = true;
            const parent = await open(directory, 'r');
            try { await parent.sync(); } finally { await parent.close(); }
        } catch (error) {
            if (replaced) throw new Error(`Roadmap write outcome uncertain; re-read before retrying: ${String(error)}`);
            throw error;
        } finally { await rm(temporary, { force: true }); }
    }

    private async indexHash(file: string): Promise<string | null> {
        if (!(await this.regular(file))) return null;
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try { return createHash('sha256').update(await handle.readFile()).digest('hex'); }
        finally { await handle.close(); }
    }

    /** Persist one reviewed schema-2 revision without changing a linked Markdown source. */
    async saveGateIndex(root: string, expectedRevision: number, expectedProjectId: string | undefined,
        candidate: RoadmapGateIndex): Promise<RoadmapGateIndex> {
        if (!revision(expectedRevision) || !id(candidate.projectId) || candidate.projectId === 'uninitialized')
            throw new Error('Invalid Roadmap owner or revision');
        const next = await this.locked(root, async () => {
            const { file } = await this.paths(root);
            const expectedHash = await this.indexHash(file);
            const current = await this.read<RoadmapGateIndex>(root);
            if (current.revision !== expectedRevision) throw new Error('Stale Roadmap revision');
            if (expectedProjectId !== current.projectId) throw new Error('Roadmap identity changed; reattach');
            if (current.revision > 0 && candidate.projectId !== current.projectId)
                throw new Error('Roadmap identity changed; reattach');
            if (candidate.projectRoot !== root || candidate.revision !== expectedRevision + 1)
                throw new Error('Roadmap root or revision changed');
            if (current.linkedDocument && JSON.stringify(candidate.linkedDocument) !== JSON.stringify(current.linkedDocument))
                throw new Error('Linked Roadmap source requires separate reviewed synchronization');
            parseRoadmapIndex(candidate, root);
            if (!current.linkedDocument && candidate.linkedDocument) {
                if (candidate.linkedDocument.syncState !== 'synced')
                    throw new Error('A new linked Roadmap source requires a verified fingerprint');
                const source = await checkedRoadmapDocumentFile(root, candidate.linkedDocument.path);
                if (createHash('sha256').update(source.bytes).digest('hex') !== candidate.linkedDocument.sourceHash)
                    throw new Error('Linked Roadmap source fingerprint changed');
            }
            await this.replace(root, candidate, expectedHash);
            return candidate;
        });
        this.publish({ root, projectId: next.projectId, revision: next.revision,
            changedIds: [...next.phases, ...next.gates, ...next.corrections].map(item => item.id) });
        return next;
    }

    private async readRetired(root: string): Promise<RoadmapIndex> {
        const current = await this.read<RoadmapGateIndex>(root);
        throw new Error(`Checkpoint Roadmap operations are retired for schema ${current.schemaVersion}; use Gate actions`);
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
        transform: (current: RoadmapIndex) => Promise<{ checkpoints: RoadmapCheckpoint[]; changedIds: string[];
            linkedDocument?: RoadmapLinkedDocument }>): Promise<RoadmapIndex> {
        if (!revision(expectedRevision)) throw new Error('Invalid Roadmap revision');
        const result = await this.locked(root, async () => {
            const current = await this.readRetired(root);
            if (current.pendingCreation) throw new Error('Pending greenfield Roadmap creation requires recovery');
            if (current.linkedDocument?.syncState === 'pending-sync') throw new Error('Pending linked Roadmap sync requires recovery');
            if (expectedProjectId && current.projectId !== expectedProjectId) throw new Error('Roadmap identity changed; reattach');
            if (current.revision !== expectedRevision) throw new Error(`Stale Roadmap revision; current ${current.revision}`);
            const { checkpoints, changedIds, linkedDocument: proposedLink } = await transform(current);
            const nextProjectId = current.revision ? current.projectId : randomUUID();
            const nextRevision = current.revision + 1;
            const nextLink = proposedLink ? { ...proposedLink, projectRoot: root, projectId: nextProjectId,
                lastSynced: { ...proposedLink.lastSynced, sourceHash: proposedLink.sourceHash, roadmapRevision: nextRevision } } : current.linkedDocument;
            if (!changedIds.length && JSON.stringify(nextLink) === JSON.stringify(current.linkedDocument))
                return { snapshot: current, changedIds };
            const next = parseRetiredCheckpointIndex({ schemaVersion: 1, projectId: nextProjectId,
                projectRoot: root, revision: nextRevision, checkpoints, ...(nextLink ? { linkedDocument: nextLink } : {}),
                ...(nextProjectId === current.projectId && current.planOrigin ?
                    { planOrigin: current.planOrigin } : {}) }, root);
            if (proposedLink && (await readRoadmapMappedSections(root, nextLink!)).hash !== nextLink!.sourceHash)
                throw new Error('Linked Roadmap source changed before index publication');
            await this.replace(root, next);
            return { snapshot: next, changedIds };
        });
        if (result.snapshot.revision !== expectedRevision) this.publish({ root, projectId: result.snapshot.projectId,
            revision: result.snapshot.revision, changedIds: result.changedIds });
        return result.snapshot;
    }

    /** Accept exactly the preview the developer saw, after re-reading every source under the lock. */
    async acceptImport(root: string, expectedRevision: number, preview: RoadmapImportPreview,
        expectedProjectId?: string): Promise<RoadmapIndex> {
        return this.commit(root, expectedRevision, expectedProjectId, async current => {
            const fresh = await previewRoadmapImport(root, preview.roadmapPath);
            if (JSON.stringify(preview) !== JSON.stringify(fresh)) throw new Error('Stale Roadmap import preview');
            if (current.linkedDocument && current.linkedDocument.path !== fresh.roadmapPath)
                throw new Error('Roadmap linked document differs; explicit relink is required');
            const selected = fresh.sources.find(source => source.path === fresh.roadmapPath);
            if (!selected) throw new Error('Selected Roadmap source missing');
            const checkpoints = [...current.checkpoints];
            const changedIds: string[] = [];
            const sections: RoadmapLinkedDocument['sections'] = [];
            const duplicate = new Set<string>();
            for (const item of preview.checkpoints) {
                if (duplicate.has(item.id)) continue;
                if (preview.checkpoints.filter(other => other.id === item.id).length > 1) { duplicate.add(item.id); continue; }
                const existing = checkpoints.find(checkpoint => checkpoint.id === item.id);
                if (existing && !existing.source) continue; // A later import cannot overwrite a roadmap-owned checkpoint.
                // Unsupported checklist entries stay visible with stable IDs, but have no
                // lossless mapped section for document sync or approved source patches.
                if (item.source.path === fresh.roadmapPath && !item.readOnly)
                    sections.push({ sectionKey: item.sectionKey, checkpointId: item.id });
                const imported: RoadmapCheckpoint = { id: item.id, kind: item.kind, title: item.title,
                    objective: existing?.objective ?? '',
                    order: existing?.order ?? checkpoints.length, dependencies: existing?.dependencies ?? [],
                    ...(item.kind === 'correction' && existing?.parentPhaseId ? { parentPhaseId: existing.parentPhaseId } : {}),
                    links: existing?.links ?? [], status: item.status, readOnly: item.readOnly, source: item.source, evidence: item.evidence };
                if (existing) {
                    if (JSON.stringify(existing) === JSON.stringify(imported)) continue;
                    checkpoints[checkpoints.indexOf(existing)] = imported;
                } else checkpoints.push(imported);
                changedIds.push(item.id);
            }
            if (!sections.length) return { checkpoints, changedIds };
            const linkedDocument: RoadmapLinkedDocument = { projectRoot: root, projectId: current.projectId,
                path: fresh.roadmapPath, sourceHash: selected.sha256, sections,
                lastSynced: { sourceHash: selected.sha256, roadmapRevision: current.revision + 1 }, syncState: 'synced' };
            const mapped = await readRoadmapMappedSections(root, linkedDocument);
            if (mapped.hash !== selected.sha256) throw new Error('Linked Roadmap changed during acceptance; preview again');
            if (mapped.diagnostics.length || mapped.sections.length !== sections.length) linkedDocument.syncState = 'conflict';
            else {
                linkedDocument.lastSynced.fields = mapped.sections.map(({ line, heading, ...field }) => field);
                for (const section of mapped.sections) {
                    const target = checkpoints.find(checkpoint => checkpoint.id === section.checkpointId);
                    if (target && !target.readOnly) {
                        if (section.objective !== undefined) target.objective = section.objective;
                        if (section.order !== undefined) target.order = section.order;
                    }
                }
            }
            if (!changedIds.length && current.linkedDocument?.path === linkedDocument.path &&
                current.linkedDocument.sourceHash === linkedDocument.sourceHash &&
                current.linkedDocument.syncState === 'synced' &&
                JSON.stringify(current.linkedDocument.sections) === JSON.stringify(sections))
                return { checkpoints, changedIds };
            return { checkpoints, changedIds, linkedDocument };
        });
    }

    private async creationFile(root: string, path: string): Promise<string> {
        await this.paths(root);
        if (!path || path.length > 512 || isAbsolute(path) || !/\.md$/i.test(path) ||
            path.includes('\\') || path.includes(':') ||
            path.split('/').some(part => !part || part === '.' || part === '..') || path.split('/')[0] === '.dope')
            throw new Error('Unsafe greenfield Roadmap path');
        let directory = root;
        for (const part of path.split('/').slice(0, -1)) {
            directory = join(directory, part);
            const info = await lstat(directory);
            if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory)
                throw new Error('Unsafe greenfield Roadmap directory');
        }
        return join(root, path);
    }

    /** Approval is checked by the caller; persist intent before the first source-file effect. */
    async acceptGreenfield(root: string, expectedRevision: number, path: string, content: string,
        topology?: GreenfieldTopology, planOrigin?: PendingPlanOrigin): Promise<RoadmapIndex> {
        if (expectedRevision !== 0 || !text(content, 2 * 1024 * 1024) ||
            Buffer.byteLength(content) > 2 * 1024 * 1024 || !content.startsWith('# Roadmap\n') ||
            (topology !== undefined && !validGreenfieldTopology(topology)) ||
            (planOrigin !== undefined && !validPlanOrigin(planOrigin, true)))
            throw new Error('Invalid greenfield Roadmap creation');
        const result = await this.locked(root, async () => {
            const current = await this.readRetired(root);
            if (current.revision !== expectedRevision || current.linkedDocument || current.pendingCreation)
                throw new Error('Stale Roadmap revision or pending creation');
            const file = await this.creationFile(root, path);
            try { await lstat(file); throw new Error('Greenfield Roadmap path already exists'); }
            catch (error) { if (!missing(error)) throw error; }
            const marker = parseRetiredCheckpointIndex({ schemaVersion: 1, projectId: randomUUID(), projectRoot: root,
                revision: 1, checkpoints: [], pendingCreation: { path, content,
                    sourceHash: createHash('sha256').update(content).digest('hex'),
                    ...(topology?.length ? { topology } : {}), ...(planOrigin ? { planOrigin } : {}) } }, root);
            await this.replace(root, marker);
            return marker;
        });
        this.publish({ root, projectId: result.projectId, revision: result.revision, changedIds: [] });
        return this.recoverGreenfield(root);
    }

    /** Idempotent after a crash: only the exact reserved bytes may be accepted. */
    async recoverGreenfield(root: string): Promise<RoadmapIndex> {
        const result = await this.locked(root, async () => {
            const current = await this.readRetired(root);
            const pending = current.pendingCreation;
            if (!pending) return { snapshot: current, changedIds: [] as string[] };
            const file = await this.creationFile(root, pending.path);
            let exists = false;
            try {
                const info = await lstat(file);
                if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe greenfield Roadmap file');
                exists = true;
            } catch (error) { if (!missing(error)) throw error; }
            if (!exists) {
                const temporary = join(dirname(file), `.dope-roadmap-${randomUUID()}.tmp`);
                try {
                    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                    try { await handle.writeFile(pending.content); await handle.sync(); } finally { await handle.close(); }
                    await hardLink(temporary, file); // Exclusive publication: an existing path is never replaced.
                    const parent = await open(dirname(file), 'r');
                    try { await parent.sync(); } finally { await parent.close(); }
                } finally { await rm(temporary, { force: true }); }
            }
            const preview = await previewRoadmapImport(root, pending.path);
            const source = preview.sources.find(item => item.path === pending.path);
            if (source?.sha256 !== pending.sourceHash || !preview.checkpoints.length ||
                preview.checkpoints.some(item => item.source.path === pending.path && item.readOnly))
                throw new Error('Greenfield Roadmap source changed or cannot be mapped; pending creation requires review');
            const checkpoints: RoadmapCheckpoint[] = preview.checkpoints.filter(item => item.source.path === pending.path)
                .map((item, order) => ({ id: item.id, kind: item.kind, title: item.title, objective: '', order,
                    dependencies: [], links: [], status: item.status, readOnly: false,
                    source: item.source, evidence: item.evidence }));
            if (pending.topology?.length) {
                const byKey = new Map(preview.checkpoints.filter(item => item.source.path === pending.path)
                    .map(item => [item.sectionKey, item.id]));
                for (const item of pending.topology) {
                    const target = checkpoints.find(checkpoint => checkpoint.id === byKey.get(item.sectionKey));
                    if (!target || item.dependencies.some(key => !byKey.has(key)) ||
                        (item.parentPhaseKey !== undefined && (target.kind !== 'correction' ||
                            checkpoints.find(checkpoint => checkpoint.id === byKey.get(item.parentPhaseKey!))?.kind !== 'phase')))
                        throw new Error('Greenfield graph mapping changed; pending creation requires review');
                    target.dependencies = item.dependencies.map(key => byKey.get(key)!);
                    if (item.parentPhaseKey) target.parentPhaseId = byKey.get(item.parentPhaseKey)!;
                }
            }
            const sections = checkpoints.map(item => ({ sectionKey: preview.checkpoints.find(entry => entry.id === item.id)!.sectionKey,
                checkpointId: item.id }));
            const linked: RoadmapLinkedDocument = { projectRoot: root, projectId: current.projectId, path: pending.path,
                sourceHash: pending.sourceHash, sections, lastSynced: { sourceHash: pending.sourceHash, roadmapRevision: 2 },
                syncState: 'synced' };
            const mapped = await readRoadmapMappedSections(root, linked);
            if (mapped.hash !== pending.sourceHash || mapped.diagnostics.length || mapped.sections.length !== sections.length)
                throw new Error('Greenfield Roadmap mapping changed; pending creation requires review');
            linked.lastSynced.fields = mapped.sections.map(({ line, heading, ...field }) => field);
            for (const section of mapped.sections) {
                const target = checkpoints.find(item => item.id === section.checkpointId)!;
                target.objective = section.objective ?? '';
                target.order = section.order ?? target.order;
            }
            const planOrigin = pending.planOrigin && { planRevision: pending.planOrigin.planRevision,
                planHash: pending.planOrigin.planHash, sourceHash: pending.sourceHash,
                constraints: pending.planOrigin.constraints,
                steps: pending.planOrigin.steps.map(step => {
                    const checkpointId = sections.find(section => section.sectionKey === step.sectionKey)?.checkpointId;
                    if (!checkpointId) throw new Error('Reviewed plan step lost its Roadmap source mapping');
                    return { stepId: step.stepId, checkpointId, expectedOutputs: step.expectedOutputs };
                }) };
            const next = parseRetiredCheckpointIndex({ schemaVersion: 1, projectId: current.projectId, projectRoot: root,
                revision: 2, checkpoints, linkedDocument: linked, ...(planOrigin ? { planOrigin } : {}) }, root);
            await this.replace(root, next);
            return { snapshot: next, changedIds: checkpoints.map(item => item.id) };
        });
        if (result.changedIds.length) this.publish({ root, projectId: result.snapshot.projectId,
            revision: result.snapshot.revision, changedIds: result.changedIds });
        return result.snapshot;
    }

    async previewDocumentSync(root: string): Promise<RoadmapSyncPreview> {
        await this.recoverGreenfield(root);
        await this.recoverDocumentSync(root);
        return previewRoadmapDocumentSync(root, await this.readRetired(root));
    }

    async previewPendingRecovery(root: string): Promise<RoadmapPendingRecoveryPreview> {
        await this.recoverDocumentSync(root);
        return previewRoadmapPendingRecovery(root, await this.readRetired(root));
    }

    /** Explicitly accept checked source bytes after reviewing an interrupted write. */
    async applyPendingRecovery(root: string, expected: RoadmapPendingRecoveryPreview,
        approved: boolean): Promise<RoadmapIndex> {
        if (!approved) return this.readRetired(root);
        if (expected.state !== 'ready' || !expected.sourceHash)
            throw new Error('Pending Roadmap recovery requires a safe approved preview');
        const result = await this.locked(root, async () => {
            const current = await this.readRetired(root);
            if (current.revision !== expected.revision || current.projectId !== expected.projectId)
                throw new Error('Stale pending Roadmap recovery revision or project identity');
            const fresh = await previewRoadmapPendingRecovery(root, current);
            if (fresh.state !== 'ready' || JSON.stringify(fresh) !== JSON.stringify(expected))
                throw new Error('Stale pending Roadmap recovery preview');
            const linked = current.linkedDocument!;
            const mapped = await readRoadmapMappedSections(root, linked);
            if (mapped.hash !== expected.sourceHash || mapped.diagnostics.length)
                throw new Error('Stale pending Roadmap source');
            const byId = new Map(mapped.sections.map(section => [section.checkpointId, section]));
            const checkpoints = current.checkpoints.map(item => {
                if (item.source?.path !== linked.path) return item;
                const section = byId.get(item.id)!;
                return { ...item, title: section.title, objective: section.objective ?? '',
                    order: section.order ?? item.order,
                    source: { ...item.source, sha256: mapped.hash, line: section.line, text: section.heading } };
            });
            const nextRevision = current.revision + 1;
            const { pending: _pending, ...settled } = linked;
            const next = parseRetiredCheckpointIndex({ ...current, revision: nextRevision, checkpoints,
                linkedDocument: { ...settled, sourceHash: mapped.hash, syncState: 'synced',
                    lastSynced: { sourceHash: mapped.hash, roadmapRevision: nextRevision,
                        fields: mapped.sections.map(({ line, heading, ...field }) => field) } } }, root);
            if ((await readRoadmapMappedSections(root, linked)).hash !== mapped.hash)
                throw new Error('Stale pending Roadmap source');
            const backup = join(root, `${linked.path}.dope-pending-backup`);
            let backupPresent = false;
            try {
                const info = await lstat(backup);
                if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024)
                    throw new Error('Unsafe pending Roadmap backup');
                const handle = await open(backup, constants.O_RDONLY | constants.O_NOFOLLOW);
                try {
                    const backupHash = createHash('sha256').update(await handle.readFile()).digest('hex');
                    if (![linked.pending!.beforeHash, mapped.hash].includes(backupHash))
                        throw new Error('Unresolved pending Roadmap backup');
                } finally { await handle.close(); }
                backupPresent = true;
            } catch (error) { if (!missing(error)) throw error; }
            await this.replace(root, next);
            if (backupPresent) await rm(backup);
            return { snapshot: next, changedIds: checkpoints.filter((item, at) =>
                JSON.stringify(item) !== JSON.stringify(current.checkpoints[at])).map(item => item.id) };
        });
        if (result.changedIds.length) this.publish({ root, projectId: result.snapshot.projectId,
            revision: result.snapshot.revision, changedIds: result.changedIds });
        return result.snapshot;
    }

    /** Inspect a different Markdown owner without initializing, recovering or writing Roadmap state. */
    async previewReplacement(root: string, path: string): Promise<RoadmapReplacementPreview> {
        const current = await this.readRetired(root);
        const linked = current.linkedDocument;
        if (!linked || linked.projectRoot !== root || linked.projectId !== current.projectId)
            throw new Error('Roadmap has no linked document for this project');
        if (typeof path !== 'string' || path.length > 512 || path.split('/')[0] === '.dope' || path === linked.path)
            throw new Error('Choose a different safe project Markdown path');
        // Import and document readers independently check containment, every component for
        // symlinks, source bounds and candidate bytes. Neither initializes an owner.
        const candidate = await previewRoadmapImport(root, path);
        const selected = candidate.sources.find(source => source.path === path);
        if (!selected) throw new Error('Selected Roadmap source missing');
        const diagnostics: RoadmapReplacementPreview['diagnostics'] = [];
        const report = (sourcePath: string, message: string, line?: number, checkpointId?: string,
            severity: 'blocking' | 'warning' = 'blocking'): void => {
            diagnostics.push({ path: sourcePath, ...(line === undefined ? {} : { line }),
                ...(checkpointId === undefined ? {} : { checkpointId }), message, severity });
        };
        if (current.pendingCreation) report(linked.path, 'Pending Roadmap creation requires recovery.');
        if (linked.pending || linked.syncState === 'pending-sync')
            report(linked.path, 'Pending linked Roadmap sync requires recovery.');
        if (linked.syncState !== 'synced') report(linked.path, `Linked Roadmap is ${linked.syncState}; reconcile it first.`);
        if (linked.lastSynced.sourceHash !== linked.sourceHash)
            report(linked.path, 'Accepted source basis differs from the active link.');
        if (linked.lastSynced.roadmapRevision !== current.revision)
            report(linked.path, 'Roadmap changed after the last linked sync; preserve or reconcile local state first.');
        let observedPreviousHash: string | undefined;
        try {
            const source = await checkedRoadmapDocumentFile(root, linked.path);
            observedPreviousHash = createHash('sha256').update(source.bytes).digest('hex');
            if (observedPreviousHash !== linked.sourceHash)
                report(linked.path, 'Linked Markdown changed since acceptance; reconcile it first.');
        } catch (error) {
            if (missing(error) || /Unsafe linked Roadmap|Unsupported linked Roadmap/.test(String(error)))
                report(linked.path, 'Linked Markdown is missing or unsafe; review before replacement.');
            else throw error;
        }
        for (const section of linked.sections) {
            const accepted = linked.lastSynced.fields?.find(field => field.checkpointId === section.checkpointId);
            const checkpoint = current.checkpoints.find(item => item.id === section.checkpointId);
            if (!accepted || !checkpoint || checkpoint.source?.path !== linked.path ||
                checkpoint.source.sha256 !== linked.sourceHash ||
                checkpoint.title !== accepted.title || checkpoint.objective !== (accepted.objective ?? '') ||
                checkpoint.order !== (accepted.order ?? checkpoint.order))
                report(linked.path, 'Active Roadmap has unsynced or unsupported mapped state; preserve or reconcile it first.',
                    checkpoint?.source?.line, section.checkpointId);
        }
        for (const message of candidate.diagnostics) {
            const line = /\bat line (\d+)/.exec(message);
            const referencedPath = /^(?:Missing source(?: directory)?|Unsafe source skipped): (.+)$/.exec(message)?.[1];
            report(referencedPath ?? path, message, line ? Number(line[1]) : undefined, undefined,
                /^(Missing source|Unsafe source skipped)/.test(message) ? 'warning' : 'blocking');
        }
        for (const checkpoint of candidate.checkpoints)
            for (const message of checkpoint.diagnostics)
                report(checkpoint.source.path, message, checkpoint.source.line, checkpoint.id,
                    checkpoint.sectionKey.includes('/checklist-') ? 'warning' : 'blocking');
        const supported = candidate.checkpoints.filter(item => item.source.path === path && !item.readOnly);
        const sections = supported.map(item => ({ sectionKey: item.sectionKey, checkpointId: item.id, line: item.source.line }));
        if (!sections.length) report(path, 'Candidate has no supported, source-mapped Roadmap checkpoints.');
        if (sections.length) {
            const mapped = await readRoadmapMappedSections(root, { ...linked, path, sourceHash: selected.sha256,
                sections: sections.map(({ sectionKey, checkpointId }) => ({ sectionKey, checkpointId })) });
            if (mapped.hash !== selected.sha256) report(path, 'Candidate changed during preview; retry.');
            for (const message of mapped.diagnostics) report(path, message);
            if (mapped.sections.length !== sections.length)
                report(path, 'Candidate checkpoint mapping is incomplete.');
        }
        const oldIds = current.checkpoints.map(item => item.id);
        const newIds = [...new Set(candidate.checkpoints.map(item => item.id))];
        const oldSet = new Set(oldIds);
        const newSet = new Set(newIds);
        const removedCheckpointIds = oldIds.filter(id => !newSet.has(id));
        const atRiskCheckpointIds = removedCheckpointIds;
        const atRiskCheckpoints = current.checkpoints.filter(item => !newSet.has(item.id)).map(item => ({
            id: item.id, title: item.title, status: item.status,
            dependencies: item.dependencies.length, links: item.links.length }));
        return { state: diagnostics.some(item => item.severity === 'blocking') ? 'review' : 'ready',
            projectId: current.projectId, revision: current.revision,
            previousPath: linked.path, previousHash: linked.sourceHash, ...(observedPreviousHash ? { observedPreviousHash } : {}),
            path, sourceHash: selected.sha256, removedCheckpointIds,
            addedCheckpointIds: newIds.filter(id => !oldSet.has(id)),
            retainedCheckpointIds: oldIds.filter(id => newSet.has(id)),
            manualCheckpointIds: current.checkpoints.filter(item => !item.source).map(item => item.id),
            atRiskCheckpointIds, atRiskCheckpoints,
            replacementWarning: 'Replacing the active project Roadmap may remove checkpoint state and links. The previous Markdown file remains on disk.',
            sections, diagnostics };
    }

    /** Replace the active Roadmap only after the exact approved source and owner basis still match. */
    async applyReplacement(root: string, expected: RoadmapReplacementPreview, approved: boolean): Promise<RoadmapIndex> {
        if (!approved) return this.readRetired(root);
        if (!expected || expected.state !== 'ready' || !expected.observedPreviousHash)
            throw new Error('Replacement requires a safe approved preview');
        return this.commit(root, expected.revision, expected.projectId, async current => {
            const fresh = await this.previewReplacement(root, expected.path);
            if (fresh.state !== 'ready' || JSON.stringify(fresh) !== JSON.stringify(expected))
                throw new Error('Stale Roadmap replacement preview');
            const candidate = await previewRoadmapImport(root, fresh.path);
            const selected = candidate.sources.find(source => source.path === fresh.path);
            const supported = candidate.checkpoints.filter(item => item.source.path === fresh.path && !item.readOnly);
            const sectionIdentity = supported.map(item => ({ sectionKey: item.sectionKey,
                checkpointId: item.id, line: item.source.line }));
            if (!selected || selected.sha256 !== fresh.sourceHash ||
                JSON.stringify(sectionIdentity) !== JSON.stringify(fresh.sections) ||
                new Set(candidate.checkpoints.map(item => item.id)).size !== candidate.checkpoints.length)
                throw new Error('Roadmap replacement candidate changed; preview again');
            const linkedDocument: RoadmapLinkedDocument = { projectRoot: root, projectId: current.projectId,
                path: fresh.path, sourceHash: selected.sha256,
                sections: supported.map(item => ({ sectionKey: item.sectionKey, checkpointId: item.id })),
                lastSynced: { sourceHash: selected.sha256, roadmapRevision: current.revision + 1 }, syncState: 'synced' };
            const mapped = await readRoadmapMappedSections(root, linkedDocument);
            if (mapped.hash !== selected.sha256 || mapped.diagnostics.length ||
                mapped.sections.length !== linkedDocument.sections.length)
                throw new Error('Roadmap replacement mapping changed; preview again');
            linkedDocument.lastSynced.fields = mapped.sections.map(({ line, heading, ...field }) => field);
            const byId = new Map(mapped.sections.map(item => [item.checkpointId, item]));
            const checkpoints: RoadmapCheckpoint[] = candidate.checkpoints.map((item, order) => {
                const fields = byId.get(item.id);
                return { id: item.id, kind: item.kind, title: item.title,
                    objective: fields?.objective ?? '', order: fields?.order ?? order,
                    dependencies: [], links: [], status: item.status, readOnly: item.readOnly,
                    source: item.source, evidence: item.evidence };
            });
            const previous = await checkedRoadmapDocumentFile(root, fresh.previousPath);
            if (createHash('sha256').update(previous.bytes).digest('hex') !== fresh.previousHash)
                throw new Error('Previous linked Roadmap changed; preview again');
            return { checkpoints, changedIds: [...new Set([...current.checkpoints.map(item => item.id),
                ...checkpoints.map(item => item.id)])], linkedDocument };
        });
    }

    /** Relink changes only the accepted owner reference. A changed document needs separate reconciliation. */
    async previewRelink(root: string, path: string): Promise<RoadmapRelinkPreview> {
        const current = await this.readRetired(root);
        const linked = current.linkedDocument;
        if (!linked || linked.projectRoot !== root || linked.projectId !== current.projectId)
            throw new Error('Roadmap has no linked document for this project');
        if (linked.syncState === 'pending-sync') throw new Error('Pending linked Roadmap sync requires recovery');
        if (linked.syncState === 'conflict' || linked.syncState === 'source-changed')
            throw new Error('Linked Roadmap conflict requires separate reconciliation before relink');
        const previous = await previewRoadmapDocumentSync(root, current);
        if (previous.state !== 'relink-needed') throw new Error('Linked Roadmap source is still available; reconcile it first');
        if (path === linked.path) throw new Error('Choose a different project Markdown path');
        if (typeof path !== 'string' || path.length > 512 || path.split('/')[0] === '.dope')
            throw new Error('Unsafe linked Roadmap path');
        const base: RoadmapRelinkPreview = { state: 'review', projectId: current.projectId,
            revision: current.revision, previousPath: linked.path, path, sections: [], diagnostics: [] };
        // The checked reader rejects absolute, foreign, traversal and symlink paths before reading bytes.
        const mapped = await readRoadmapMappedSections(root, { ...linked, path });
        base.sourceHash = mapped.hash;
        base.sections = linked.sections.map(section => ({ ...section,
            line: mapped.sections.find(item => item.checkpointId === section.checkpointId)?.line ?? 0 }));
        if (mapped.hash !== linked.sourceHash || mapped.hash !== linked.lastSynced.sourceHash)
            base.diagnostics.push('Candidate contents differ from the accepted source; review and reconcile separately.');
        base.diagnostics.push(...mapped.diagnostics);
        if (mapped.sections.length !== linked.sections.length || base.sections.some(section => !section.line))
            base.diagnostics.push('Mapped section identities are missing or ambiguous.');
        if (!linked.lastSynced.fields || mapped.sections.some(section => {
            const accepted = linked.lastSynced.fields!.find(field => field.checkpointId === section.checkpointId);
            const { line: _line, heading: _heading, ...fields } = section;
            return !accepted || JSON.stringify(fields) !== JSON.stringify(accepted);
        })) base.diagnostics.push('Mapped fields differ from the accepted basis.');
        if (!base.diagnostics.length) base.state = 'ready';
        return base;
    }

    async applyRelink(root: string, expected: RoadmapRelinkPreview, approved: boolean): Promise<RoadmapIndex> {
        if (!approved) return this.readRetired(root);
        if (expected.state !== 'ready' || !expected.sourceHash) throw new Error('Relink requires a safe approved preview');
        return this.commit(root, expected.revision, expected.projectId, async current => {
            const fresh = await this.previewRelink(root, expected.path);
            if (fresh.state !== 'ready' || JSON.stringify(fresh) !== JSON.stringify(expected))
                throw new Error('Stale linked Roadmap relink preview');
            const linked = current.linkedDocument!;
            const lines = new Map(fresh.sections.map(section => [section.checkpointId, section.line]));
            const checkpoints = current.checkpoints.map(item => item.source?.path === linked.path && lines.has(item.id) ?
                { ...item, source: { ...item.source, path: fresh.path, line: lines.get(item.id)!, sha256: fresh.sourceHash! } } : item);
            return { checkpoints, changedIds: checkpoints.filter((item, at) => item !== current.checkpoints[at]).map(item => item.id),
                linkedDocument: { ...linked, path: fresh.path, sourceHash: fresh.sourceHash!, syncState: 'synced' } };
        });
    }

    /** Finish an approved edit after restart. Unknown source bytes are never overwritten. */
    async recoverDocumentSync(root: string): Promise<RoadmapIndex> {
        const result = await this.locked(root, async () => {
            let current = await this.readRetired(root);
            const linked = current.linkedDocument;
            const pending = linked?.pending;
            if (!linked || !pending) return { snapshot: current, changedIds: [] as string[] };
            const conflict = async (): Promise<RoadmapIndex> => {
                if (pending.outcome === 'conflict') return current;
                const next = parseRetiredCheckpointIndex({ ...current, revision: current.revision + 1,
                    linkedDocument: { ...linked, pending: { ...pending, outcome: 'conflict' as const } } }, root);
                await this.replace(root, next);
                return next;
            };
            const backup = join(root, `${linked.path}.dope-pending-backup`);
            let backupPresent = false;
            try {
                const info = await lstat(backup);
                if (!info.isFile() || info.isSymbolicLink()) return { snapshot: await conflict(), changedIds: [] as string[] };
                if (info.size === 0) {
                    try { await lstat(join(root, linked.path)); await rm(backup); }
                    catch (error) { if (!missing(error)) throw error;
                        return { snapshot: await conflict(), changedIds: [] as string[] }; }
                } else backupPresent = true;
            } catch (error) { if (!missing(error)) throw error; }
            if (backupPresent) {
                const handle = await open(backup, constants.O_RDONLY | constants.O_NOFOLLOW);
                let backupHash: string;
                try {
                    const info = await handle.stat();
                    if (!info.isFile() || info.size > 2 * 1024 * 1024) return { snapshot: await conflict(), changedIds: [] as string[] };
                    backupHash = createHash('sha256').update(await handle.readFile()).digest('hex');
                } finally { await handle.close(); }
                if (backupHash !== pending.beforeHash) return { snapshot: await conflict(), changedIds: [] as string[] };
                try { await lstat(join(root, linked.path)); }
                catch (error) {
                    if (!missing(error)) throw error;
                    await hardLink(backup, join(root, linked.path)).catch(linkError => {
                        if ((linkError as NodeJS.ErrnoException).code !== 'EEXIST') throw linkError;
                    });
                }
            }
            let mapped: Awaited<ReturnType<typeof readRoadmapMappedSections>>;
            try { mapped = await readRoadmapMappedSections(root, linked); }
            catch { return { snapshot: await conflict(), changedIds: [] as string[] }; }
            if (mapped.diagnostics.length || mapped.sections.length !== linked.sections.length ||
                ![pending.beforeHash, pending.afterHash].includes(mapped.hash))
                return { snapshot: await conflict(), changedIds: [] as string[] };
            if (mapped.hash === pending.beforeHash) {
                if (pending.outcome === 'conflict') return { snapshot: current, changedIds: [] as string[] };
                if (backupPresent) { await rm(backup); backupPresent = false; }
                const patch = await planRoadmapDocumentPatch(root, { ...current,
                    linkedDocument: { ...linked, syncState: 'synced', pending: undefined } }, {
                    checkpointId: pending.checkpointId, sourceHash: pending.beforeHash,
                    ...(current.checkpoints.find(item => item.id === pending.checkpointId)?.title !== pending.title ? { title: pending.title } : {}),
                    ...(current.checkpoints.find(item => item.id === pending.checkpointId)?.objective !== pending.objective ? { objective: pending.objective } : {}),
                    ...(current.checkpoints.find(item => item.id === pending.checkpointId)?.order !== pending.order ? { order: pending.order } : {}),
                    ...(pending.prose !== undefined ? { prose: pending.prose } : {})
                }).catch(() => undefined);
                if (!patch || patch.afterHash !== pending.afterHash)
                    return { snapshot: await conflict(), changedIds: [] as string[] };
                try { await publishRoadmapDocumentPatch(root, patch); }
                catch { return { snapshot: await conflict(), changedIds: [] as string[] }; }
                mapped = await readRoadmapMappedSections(root, linked);
                if (mapped.hash !== pending.afterHash || mapped.diagnostics.length)
                    return { snapshot: await conflict(), changedIds: [] as string[] };
            }
            const target = mapped.sections.find(section => section.checkpointId === pending.checkpointId);
            const priorOrder = current.checkpoints.find(item => item.id === pending.checkpointId)?.order;
            if (!target || target.title !== pending.title || target.objective !== pending.objective ||
                (target.order ?? priorOrder) !== pending.order || pending.prose !== undefined && target.prose !== pending.prose)
                return { snapshot: await conflict(), changedIds: [] as string[] };
            const byId = new Map(mapped.sections.map(section => [section.checkpointId, section]));
            const checkpoints = current.checkpoints.map(item => {
                if (item.source?.path !== linked.path) return item;
                const section = byId.get(item.id);
                if (!section) return item;
                return { ...item, title: item.id === pending.checkpointId ? pending.title : item.title,
                    objective: item.id === pending.checkpointId ? pending.objective : item.objective,
                    order: item.id === pending.checkpointId ? pending.order : item.order,
                    source: { ...item.source, sha256: pending.afterHash, line: section.line, text: section.heading } };
            });
            const nextRevision = current.revision + 1;
            const { pending: _resolved, ...settledLink } = linked;
            const next = parseRetiredCheckpointIndex({ ...current, revision: nextRevision, checkpoints,
                linkedDocument: { ...settledLink, sourceHash: pending.afterHash, syncState: 'synced',
                    lastSynced: { sourceHash: pending.afterHash, roadmapRevision: nextRevision,
                        fields: mapped.sections.map(({ line, heading, ...field }) => field) } } }, root);
            await this.replace(root, next);
            if (backupPresent) await rm(backup);
            return { snapshot: next, changedIds: checkpoints.filter((item, i) =>
                JSON.stringify(item) !== JSON.stringify(current.checkpoints[i])).map(item => item.id) };
        });
        if (result.changedIds.length) this.publish({ root, projectId: result.snapshot.projectId,
            revision: result.snapshot.revision, changedIds: result.changedIds });
        return result.snapshot;
    }

    /** Explicit reconciliation; the preview is re-created under the owner lock before any index write. */
    async applyDocumentSync(root: string, expected: RoadmapSyncPreview): Promise<RoadmapIndex> {
        if (expected.state !== 'source-changed' || !expected.sourceHash) throw new Error('No applicable linked Roadmap change');
        return this.commit(root, expected.revision, expected.projectId, async current => {
            const fresh = await previewRoadmapDocumentSync(root, current);
            if (fresh.state !== 'source-changed' || JSON.stringify(fresh) !== JSON.stringify(expected))
                throw new Error('Stale linked Roadmap sync preview');
            const linked = current.linkedDocument!;
            const mapped = await readRoadmapMappedSections(root, linked);
            if (mapped.hash !== expected.sourceHash || mapped.diagnostics.length) throw new Error('Stale linked Roadmap source');
            const checkpoints = current.checkpoints.map(item => ({ ...item, source: item.source ? { ...item.source } : undefined }));
            const byId = new Map(mapped.sections.map(section => [section.checkpointId, section]));
            const changedIds: string[] = [];
            for (const checkpoint of checkpoints) {
                const section = byId.get(checkpoint.id);
                if (!section) continue;
                for (const change of fresh.changes.filter(change => change.checkpointId === checkpoint.id)) {
                    if (change.field === 'prose') continue;
                    if (change.field === 'title' && typeof change.source === 'string') checkpoint.title = change.source;
                    if (change.field === 'objective' && typeof change.source === 'string') checkpoint.objective = change.source;
                    if (change.field === 'order' && typeof change.source === 'number') checkpoint.order = change.source;
                }
                if (checkpoint.source) {
                    checkpoint.source.sha256 = mapped.hash;
                    checkpoint.source.line = section.line;
                    checkpoint.source.text = section.heading;
                }
                if (JSON.stringify(checkpoint) !== JSON.stringify(current.checkpoints.find(item => item.id === checkpoint.id)))
                    changedIds.push(checkpoint.id);
            }
            return { checkpoints, changedIds, linkedDocument: { ...linked, sourceHash: mapped.hash, syncState: 'synced',
                lastSynced: { sourceHash: mapped.hash, roadmapRevision: current.revision + 1,
                    fields: mapped.sections.map(({ line, heading, ...field }) => field) } } };
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
                    if (operation.objective !== checkpoints[index].objective || operation.order !== checkpoints[index].order)
                        throw new Error('Markdown owns mapped Roadmap prose and order');
                    const fresh = await previewRoadmapImport(root, current.linkedDocument?.path);
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

    /** One revisioned Roadmap-owner transaction for validated planning actions. */
    async transact(root: string, expectedRevision: number, expectedProjectId: string,
        transform: (current: RoadmapIndex) => Promise<RoadmapCheckpoint[]>): Promise<RoadmapIndex> {
        return this.commit(root, expectedRevision, expectedProjectId, async current => {
            if (!current.revision) throw new Error('Roadmap is not initialized');
            const checkpoints = await transform(current);
            const before = new Map(current.checkpoints.map(item => [item.id, item]));
            const after = new Map(checkpoints.map(item => [item.id, item]));
            if (before.size !== current.checkpoints.length || after.size !== checkpoints.length ||
                [...before.keys()].some(key => !after.has(key))) throw new Error('Roadmap deletion requires separate authority');
            const changedIds = checkpoints.filter(item => JSON.stringify(item) !== JSON.stringify(before.get(item.id))).map(item => item.id);
            const sourceChanges = changedIds.filter(key => before.get(key)?.source);
            if (sourceChanges.length) {
                const fresh = await previewRoadmapImport(root, current.linkedDocument?.path);
                for (const key of sourceChanges) {
                    const old = before.get(key)!;
                    const next = after.get(key)!;
                    const source = fresh.checkpoints.find(item => item.id === key);
                    if (old.readOnly || !source || source.readOnly || source.source.sha256 !== old.source!.sha256 ||
                        source.title !== old.title || source.status !== old.status || next.title !== old.title ||
                        next.objective !== old.objective || next.order !== old.order ||
                        next.status !== old.status || JSON.stringify(next.source) !== JSON.stringify(old.source) ||
                        JSON.stringify(next.evidence) !== JSON.stringify(old.evidence))
                        throw new Error('Stale or immutable Roadmap source');
                }
            }
            return { checkpoints, changedIds };
        });
    }

    /** The document and index have separate atomic writes; persist intent before touching the document. */
    async transactDocument(root: string, expectedRevision: number, expectedProjectId: string,
        transform: (current: RoadmapIndex) => Promise<{ next: RoadmapIndex; patch: RoadmapDocumentPatch }>): Promise<RoadmapIndex> {
        const prepared = await this.locked(root, async () => {
                const current = await this.readRetired(root);
                if (current.projectId !== expectedProjectId || current.revision !== expectedRevision)
                    throw new Error('Stale Roadmap revision or project identity');
                if (current.linkedDocument?.syncState === 'pending-sync')
                    throw new Error('Pending linked Roadmap sync requires recovery');
                const { next, patch } = await transform(current);
                if (!current.linkedDocument || current.linkedDocument.syncState !== 'synced' ||
                    patch.path !== current.linkedDocument.path || patch.beforeHash !== current.linkedDocument.sourceHash ||
                    patch.afterHash === patch.beforeHash || next.checkpoints.length !== current.checkpoints.length)
                    throw new Error('Invalid linked Roadmap transaction');
                const oldTarget = current.checkpoints.find(item => item.id === patch.checkpointId);
                const target = next.checkpoints.find(item => item.id === patch.checkpointId);
                if (!oldTarget?.source || !target || oldTarget.readOnly) throw new Error('Invalid linked Roadmap target');
                const planned = await planRoadmapDocumentPatch(root, current, {
                    checkpointId: patch.checkpointId, sourceHash: patch.beforeHash,
                    ...(target.title !== oldTarget.title ? { title: target.title } : {}),
                    ...(target.objective !== oldTarget.objective ? { objective: target.objective } : {}),
                    ...(target.order !== oldTarget.order ? { order: target.order } : {}),
                    ...(patch.prose !== undefined ? { prose: patch.prose } : {})
                });
                if (planned.after !== patch.after || planned.afterHash !== patch.afterHash)
                    throw new Error('Invalid linked Roadmap document patch');
                for (let index = 0; index < current.checkpoints.length; index++) {
                    const old = current.checkpoints[index];
                    const actual = next.checkpoints[index];
                    const expected: RoadmapCheckpoint = JSON.parse(JSON.stringify(old)) as RoadmapCheckpoint;
                    if (expected.source?.path === patch.path) expected.source.sha256 = patch.afterHash;
                    if (expected.id === patch.checkpointId) {
                        expected.title = target.title;
                        expected.objective = target.objective;
                        expected.order = target.order;
                        if (expected.source && target.title !== oldTarget.title)
                            expected.source.text = patch.after.split(/\r?\n/)[expected.source.line - 1];
                    }
                    if (JSON.stringify(actual) !== JSON.stringify(expected))
                        throw new Error('Invalid linked Roadmap field change');
                }
                const changedIds = next.checkpoints.filter((item, index) => JSON.stringify(item) !== JSON.stringify(current.checkpoints[index])).map(item => item.id);
                if (!changedIds.includes(patch.checkpointId) || changedIds.some(id =>
                    !current.linkedDocument!.sections.some(section => section.checkpointId === id)))
                    throw new Error('Invalid linked Roadmap change set');
                const marker = parseRetiredCheckpointIndex({ ...current, revision: current.revision + 1,
                    linkedDocument: { ...current.linkedDocument, syncState: 'pending-sync',
                        pending: { basisRevision: current.revision, checkpointId: patch.checkpointId,
                            beforeHash: patch.beforeHash, afterHash: patch.afterHash,
                            title: target.title, objective: target.objective, order: target.order,
                            ...(patch.prose !== undefined ? { prose: patch.prose } : {}),
                            outcome: 'prepared' } } }, root);
                await this.replace(root, marker);
                try { await publishRoadmapDocumentPatch(root, patch); }
                catch (error) { throw new Error(`Linked Roadmap pending sync; recover before retrying: ${String(error)}`); }
                const written = parseRetiredCheckpointIndex({ ...marker, revision: marker.revision + 1,
                    linkedDocument: { ...marker.linkedDocument, pending: { ...marker.linkedDocument!.pending!, outcome: 'document-written' } } }, root);
                await this.replace(root, written);
                return { marker, changedIds };
        });
        const recovered = await this.recoverDocumentSync(root);
        if (recovered.linkedDocument?.syncState !== 'synced' ||
            recovered.revision <= prepared.marker.revision)
            throw new Error('Linked Roadmap pending sync; review recovery before retrying');
        return recovered;
    }
}
