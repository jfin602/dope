import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { RoadmapIndex } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { PlanningBasis, PlanningMap } from '@dope/visual-planning';
import { checkedRoadmapDocumentFile } from '@dope/project-intelligence/lib/node/roadmap-document-patch';
import { discoverRoadmapTaskStacks } from '@dope/agent-core/lib/node/roadmap-task-discovery';

export type BridgeGate = 'scope' | 'target' | 'stack';
export interface BridgeOwnerSnapshot {
    roadmap: RoadmapIndex;
    /** Fresh current physical/architecture observation, supplied by the existing owner. */
    basis: PlanningBasis;
    planning?: { projectId: string; collectionRevision: number; map: PlanningMap };
    /** Explicit branch selection used for the target impact review, when supplied by the live target adapter. */
    targetBranchIds?: string[];
    /** Fingerprint of the checked prompt stack source, never proposed model text. */
    stack?: { path: string; fingerprint: string };
}
export interface BridgeReference {
    projectRoot: string; roadmapProjectId: string; roadmapRevision: number; checkpointId: string;
    roadmapSourceHash: string; planningProjectId?: string; collectionRevision?: number;
    mapId?: string; mapRevision?: number; basis: PlanningBasis;
    stackPath?: string; stackFingerprint?: string; approvedDigest: string;
}
export interface BridgeApproval { gate: BridgeGate; reference: BridgeReference; at: string }
export interface BridgeApprovalDocument {
    schemaVersion: 1; projectRoot: string; roadmapProjectId: string; revision: number;
    approvals: Partial<Record<BridgeGate, BridgeApproval>>;
}
export interface BridgePreview { token: string; gate: BridgeGate; reference: BridgeReference; revision: number }

const hash = (value: unknown): string => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hex = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const name = (value: unknown): value is string => typeof value === 'string' && value.length > 0 &&
    value.length <= 512 && !/[\x00-\x1f]/.test(value);
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const gates: BridgeGate[] = ['scope', 'target', 'stack'];

async function reference(root: string, checkpointId: string, gate: BridgeGate, source: BridgeOwnerSnapshot): Promise<BridgeReference> {
    const { roadmap, basis, planning, stack, targetBranchIds } = source;
    const checkpoint = roadmap.checkpoints.find(item => item.id === checkpointId);
    if (roadmap.projectRoot !== root || !name(roadmap.projectId) || !positive(roadmap.revision) ||
        !checkpoint || !name(checkpointId) || !basis || !positive(basis.architectureRevision) ||
        !positive(basis.physicalGeneration) || !name(basis.architectureFingerprint) ||
        !name(basis.physicalInputFingerprint)) throw new Error('Missing or foreign Bridge owner identity');
    const linked = roadmap.linkedDocument;
    if (!linked || linked.projectRoot !== root || linked.projectId !== roadmap.projectId ||
        linked.syncState !== 'synced' || linked.pending || !hex(linked.sourceHash) ||
        linked.lastSynced.sourceHash !== linked.sourceHash) throw new Error('Roadmap source requires review');
    if (!checkpoint.source || checkpoint.source.path !== linked.path ||
        checkpoint.source.sha256 !== linked.sourceHash ||
        !linked.sections.some(item => item.checkpointId === checkpointId))
        throw new Error('Checkpoint is not mapped to current Roadmap source');
    const document = await checkedRoadmapDocumentFile(root, linked.path);
    if (createHash('sha256').update(document.bytes).digest('hex') !== linked.sourceHash)
        throw new Error('Roadmap source changed; review again');
    if (planning && (!name(planning.projectId) || !positive(planning.collectionRevision) ||
        planning.map.projectId !== planning.projectId || !positive(planning.map.revision) ||
        JSON.stringify(planning.map.basis) !== JSON.stringify(basis))) throw new Error('Stale or foreign Planning basis');
    if (gate !== 'scope' && (!planning || !planning.map.id || !planning.map.transformations.length))
        throw new Error('Planning target is unavailable');
    if (gate !== 'scope' && !checkpoint.links.some(link => link.owner === 'planning-map' &&
        link.targetId === planning!.map.id && link.ownerProjectId === planning!.projectId &&
        link.ownerRevision === planning!.map.revision && JSON.stringify(link.basis) === JSON.stringify(basis)))
        throw new Error('Missing, foreign or stale Roadmap Planning link');
    if (gate === 'stack' && (!stack || !name(stack.path) || !hex(stack.fingerprint) ||
        isAbsolute(stack.path) || stack.path.split('/').some(part => !part || part === '.' || part === '..') ||
        !stack.path.startsWith('docs/tasks/'))) throw new Error('Stack source is unavailable');
    if (gate === 'stack' && stack) {
        const sources = await discoverRoadmapTaskStacks(root, 'docs/tasks', { expectedPaths: [stack.path] });
        if (!sources.some(item => item.path === stack.path && !item.diagnostic &&
            item.fingerprint === stack.fingerprint)) throw new Error('Stack source changed; review again');
    }
    const scope = { id: checkpoint.id, kind: checkpoint.kind, title: checkpoint.title,
        objective: checkpoint.objective, order: checkpoint.order, dependencies: checkpoint.dependencies,
        parentPhaseId: checkpoint.parentPhaseId, links: checkpoint.links, source: checkpoint.source,
        status: checkpoint.status, readOnly: checkpoint.readOnly };
    const target = planning && { id: planning.map.id, revision: planning.map.revision,
        title: planning.map.title, objective: planning.map.objective, status: planning.map.status,
        transformations: planning.map.transformations, basis: planning.map.basis };
    const approvedDigest = hash(gate === 'scope' ? scope : gate === 'target' ? { scope, target, targetBranchIds } :
        { scope, target, targetBranchIds, stack });
    return { projectRoot: root, roadmapProjectId: roadmap.projectId, roadmapRevision: roadmap.revision,
        checkpointId, roadmapSourceHash: linked.sourceHash,
        ...(gate !== 'scope' && planning ? { planningProjectId: planning.projectId, collectionRevision: planning.collectionRevision,
            mapId: planning.map.id, mapRevision: planning.map.revision } : {}), basis,
        ...(gate === 'stack' && stack ? { stackPath: stack.path, stackFingerprint: stack.fingerprint } : {}),
        approvedDigest };
}

function parse(value: unknown, root: string): BridgeApprovalDocument {
    const data = value as BridgeApprovalDocument;
    if (!data || typeof data !== 'object' || Array.isArray(data) || data.schemaVersion !== 1 ||
        data.projectRoot !== root || !name(data.roadmapProjectId) || !positive(data.revision) ||
        !data.approvals || typeof data.approvals !== 'object' || Array.isArray(data.approvals) ||
        Object.keys(data).sort().join(',') !== 'approvals,projectRoot,revision,roadmapProjectId,schemaVersion' ||
        Object.keys(data.approvals).some(key => !gates.includes(key as BridgeGate))) throw new Error('Invalid Bridge approval bytes');
    for (const gate of gates) {
        const approval = data.approvals[gate];
        if (!approval) continue;
        const ref = approval.reference;
        if (approval.gate !== gate || !name(approval.at) || !ref || ref.projectRoot !== root ||
            ref.roadmapProjectId !== data.roadmapProjectId || !name(ref.checkpointId) ||
            !positive(ref.roadmapRevision) || !hex(ref.roadmapSourceHash) || !hex(ref.approvedDigest) ||
            !ref.basis || !positive(ref.basis.architectureRevision) || !positive(ref.basis.physicalGeneration) ||
            !name(ref.basis.architectureFingerprint) || !name(ref.basis.physicalInputFingerprint) ||
            (gate !== 'scope' && (!name(ref.planningProjectId) || !name(ref.mapId) ||
                !positive(ref.collectionRevision) || !positive(ref.mapRevision))) ||
            (gate === 'stack' && (!name(ref.stackPath) || !hex(ref.stackFingerprint))))
            throw new Error('Invalid Bridge approval bytes');
    }
    return data;
}

/** Project-local metadata only. The reader must resolve fresh Roadmap, Planning and stack owner state. */
export class PlanningBridgeApprovals {
    private readonly pending = new Map<string, BridgePreview>();
    constructor(private readonly readOwners: (root: string) => Promise<BridgeOwnerSnapshot>) {}

    private async paths(root: string) {
        if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
            throw new Error('Bridge requires a canonical project root');
        const directory = join(root, '.dope');
        try {
            const info = await lstat(directory);
            if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory)
                throw new Error('Unsafe Bridge directory');
        } catch (error) { if (!missing(error)) throw error; }
        return { directory, file: join(directory, 'planning-bridge-approvals.json'),
            lock: join(directory, 'planning-bridge-approvals.lock') };
    }
    private async regular(file: string): Promise<boolean> {
        try { const info = await lstat(file); if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unsafe Bridge file'); return true; }
        catch (error) { if (missing(error)) return false; throw error; }
    }
    private async acquire(lock: string): Promise<import('node:fs/promises').FileHandle> {
        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const handle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
                try { await handle.writeFile(`${process.pid}\n`); await handle.sync(); return handle; }
                catch (error) { await handle.close(); await rm(lock); throw error; }
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
                await this.regular(lock);
                const info = await lstat(lock);
                const reader = await open(lock, constants.O_RDONLY | constants.O_NOFOLLOW);
                let owner: string;
                try { owner = (await reader.readFile('utf8')).trim(); }
                finally { await reader.close(); }
                if (!/^[1-9]\d*$/.test(owner)) throw new Error('Bridge locked; inspect lock');
                try { process.kill(Number(owner), 0); throw new Error('Bridge locked; inspect lock'); }
                catch (probe) { if ((probe as NodeJS.ErrnoException).code !== 'ESRCH') throw probe; }
                if ((await lstat(lock)).ino !== info.ino) throw new Error('Bridge lock changed; inspect it');
                await rm(lock);
            }
        }
        throw new Error('Bridge locked; inspect lock');
    }
    async read(root: string): Promise<BridgeApprovalDocument | undefined> {
        const { file } = await this.paths(root);
        if (!await this.regular(file)) return undefined;
        const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
        try { if (!(await handle.stat()).isFile()) throw new Error('Unsafe Bridge file');
            return parse(JSON.parse(await handle.readFile('utf8')), root);
        } catch (error) { throw new Error(`Invalid Bridge approval bytes: ${String(error)}`); }
        finally { await handle.close(); }
    }
    async preview(root: string, checkpointId: string, gate: BridgeGate): Promise<BridgePreview> {
        if (!gates.includes(gate)) throw new Error('Unknown Bridge approval gate');
        const current = await this.read(root);
        const ref = await reference(root, checkpointId, gate, await this.readOwners(root));
        if (current && current.roadmapProjectId !== ref.roadmapProjectId) throw new Error('Foreign Bridge project');
        const preview = { token: randomUUID(), gate, reference: ref, revision: current?.revision ?? 0 };
        this.pending.set(preview.token, preview);
        return preview;
    }
    reject(token: string): void { if (!this.pending.delete(token)) throw new Error('Unknown or consumed Bridge preview'); }
    async approved(root: string, checkpointId: string, gate: BridgeGate): Promise<boolean> {
        const saved = (await this.read(root))?.approvals[gate];
        if (!saved || saved.reference.checkpointId !== checkpointId) return false;
        try { return JSON.stringify(saved.reference) === JSON.stringify(await reference(root, checkpointId, gate, await this.readOwners(root))); }
        catch { return false; }
    }
    async approve(root: string, token: string, developerAction: boolean): Promise<BridgeApprovalDocument> {
        const preview = this.pending.get(token);
        if (!preview || !developerAction || preview.reference.projectRoot !== root) throw new Error('Explicit developer preview approval required');
        this.pending.delete(token); // a failed/stale approval is never replayable
        const { directory, file, lock } = await this.paths(root);
        await mkdir(directory, { recursive: true });
        await this.paths(root);
        const lockHandle = await this.acquire(lock);
        let temporary: string | undefined;
        try {
            const current = await this.read(root);
            if ((current?.revision ?? 0) !== preview.revision ||
                current && current.roadmapProjectId !== preview.reference.roadmapProjectId) throw new Error('Stale Bridge revision');
            const fresh = await reference(root, preview.reference.checkpointId, preview.gate, await this.readOwners(root));
            if (JSON.stringify(fresh) !== JSON.stringify(preview.reference)) throw new Error('Bridge owner changed; preview again');
            const next = parse({ schemaVersion: 1, projectRoot: root, roadmapProjectId: fresh.roadmapProjectId,
                revision: preview.revision + 1, approvals: { ...current?.approvals,
                    [preview.gate]: { gate: preview.gate, reference: fresh, at: new Date().toISOString() } } }, root);
            temporary = join(directory, `planning-bridge-approvals.${randomUUID()}.tmp`);
            const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            try { await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`); await handle.sync(); }
            finally { await handle.close(); }
            await this.regular(file);
            await rename(temporary, file);
            temporary = undefined;
            const parent = await open(directory, 'r');
            try { await parent.sync(); } catch (error) { throw new Error(`Bridge write outcome uncertain; re-read: ${String(error)}`); }
            finally { await parent.close(); }
            return next;
        } finally {
            if (temporary) await rm(temporary, { force: true });
            const inode = (await lockHandle.stat()).ino;
            await lockHandle.close();
            if ((await lstat(lock)).ino !== inode) throw new Error('Bridge lock changed; inspect it');
            await rm(lock);
        }
    }
}
