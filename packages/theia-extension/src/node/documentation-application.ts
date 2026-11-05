import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, readdir, realpath, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { ChatDocumentationProposal } from '@dope/chat';
import { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import { checkedDocumentationParent, documentationReviewApplicability, readDocumentationBasis } from './documentation-review';

const hash = (bytes: string | Buffer): string => createHash('sha256').update(bytes).digest('hex');
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const uuid = (value: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
const MAX_RECORD = 96_000;
const BASE = 'documentation-applications';

export interface DocumentationApplication {
    schemaVersion: 1; id: string; proposalDigest: string; root: string; projectId: string;
    worktreeId: string; ownerId: string; chatId: string; messageId: string;
    model?: { connectionId: string; modelId: string; providerId: string; modelLabel: string };
    leaseDigest: string; roadmapRevision: number; approvedAt: string;
    status: 'applying' | 'complete' | 'partial' | 'failed' | 'uncertain';
    /** A null time means interruption occurred after a file effect but before the time was recorded. */
    effects: { path: string; operation: 'create' | 'update'; beforeHash: string | null;
        afterHash: string; diff: string; appliedAt: string | null }[];
    targets: ChatDocumentationProposal['targets'];
    diagnostic?: string;
}

async function checkedDirectory(path: string, create = false): Promise<void> {
    try {
        const info = await lstat(path);
        if (!info.isDirectory() || info.isSymbolicLink() || await realpath(path) !== path)
            throw new Error('Unsafe documentation application directory');
    } catch (error) {
        if (!missing(error) || !create) throw error;
        await mkdir(path).catch(async failure => { if ((failure as NodeJS.ErrnoException).code !== 'EEXIST') throw failure; });
        await checkedDirectory(path);
    }
}
async function location(root: string, create = false): Promise<string> {
    if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
        throw new Error('Documentation project root changed');
    const dope = join(root, '.dope');
    await checkedDirectory(dope, create);
    const directory = join(dope, BASE);
    await checkedDirectory(directory, create);
    return directory;
}
function validate(record: DocumentationApplication, root: string, id: string): void {
    if (!record || record.schemaVersion !== 1 || record.root !== root || record.id !== id || !uuid(id) ||
        !['applying', 'complete', 'partial', 'failed', 'uncertain'].includes(record.status) ||
        !Array.isArray(record.targets) || !record.targets.length || record.targets.length > 4 ||
        !Array.isArray(record.effects) || record.effects.length > record.targets.length ||
        !/^[a-f0-9]{64}$/u.test(record.proposalDigest) ||
        !record.effects.every(effect => record.targets.some(target => target.path === effect.path &&
            target.operation === effect.operation && target.beforeHash === effect.beforeHash &&
            target.afterHash === effect.afterHash && target.diff === effect.diff)) ||
        new Set(record.effects.map(effect => effect.path)).size !== record.effects.length)
        throw new Error('Invalid documentation application journal');
}
async function readRecord(root: string, id: string): Promise<DocumentationApplication | undefined> {
    if (!uuid(id)) throw new Error('Invalid documentation application ID');
    let directory: string;
    try { directory = await location(root); } catch (error) { if (missing(error)) return undefined; throw error; }
    const file = join(directory, `${id}.json`);
    let info;
    try { info = await lstat(file); } catch (error) { if (missing(error)) return undefined; throw error; }
    // The initial exclusive journal is hard-linked from its synced temporary file. A
    // crash before temporary cleanup can leave two names for the same durable bytes.
    if (!info.isFile() || info.isSymbolicLink() || info.nlink < 1 || info.nlink > 2 || info.size > MAX_RECORD)
        throw new Error('Unsafe documentation application journal');
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.dev !== info.dev || opened.ino !== info.ino || opened.size > MAX_RECORD)
            throw new Error('Documentation journal changed during read');
        const bytes = await handle.readFile();
        if (bytes.length !== opened.size) throw new Error('Documentation journal changed during read');
        const record = JSON.parse(bytes.toString('utf8')) as DocumentationApplication;
        validate(record, root, id);
        return record;
    } finally { await handle.close(); }
}
async function saveRecord(record: DocumentationApplication, first = false): Promise<void> {
    validate(record, record.root, record.id);
    const directory = await location(record.root, true);
    const file = join(directory, `${record.id}.json`);
    const temporary = join(directory, `${record.id}.${randomUUID()}.tmp`);
    const bytes = Buffer.from(`${JSON.stringify(record)}\n`);
    if (bytes.length > MAX_RECORD) throw new Error('Documentation journal exceeds size limit');
    try {
        const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
        if (first) await link(temporary, file);
        else {
            const previous = await readRecord(record.root, record.id);
            if (!previous || previous.proposalDigest !== record.proposalDigest ||
                previous.projectId !== record.projectId || previous.chatId !== record.chatId ||
                previous.ownerId !== record.ownerId || previous.leaseDigest !== record.leaseDigest ||
                JSON.stringify(previous.model) !== JSON.stringify(record.model) ||
                JSON.stringify(previous.targets) !== JSON.stringify(record.targets))
                throw new Error('Documentation journal identity changed');
            await rename(temporary, file);
        }
        const parent = await open(directory, 'r');
        try { await parent.sync(); } finally { await parent.close(); }
    } finally { await rm(temporary, { force: true }); }
}
async function withLock<T>(root: string, task: () => Promise<T>): Promise<T> {
    const directory = await location(root, true);
    const lock = join(directory, '.apply-lock');
    let handle;
    try { handle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const info = await lstat(lock);
        if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 32)
            throw new Error('Unsafe documentation application lock');
        const held = await open(lock, constants.O_RDONLY | constants.O_NOFOLLOW);
        let owner: string;
        try { owner = (await held.readFile('utf8')).trim(); } finally { await held.close(); }
        if (Date.now() - info.mtimeMs < 5_000 || owner && !/^\d+$/u.test(owner))
            throw new Error('Documentation application already in progress; retry after recovery');
        if (owner) {
            try { process.kill(Number(owner), 0); throw new Error('Documentation application already in progress'); }
            catch (failure) { if ((failure as NodeJS.ErrnoException).code !== 'ESRCH') throw failure; }
        }
        const fresh = await lstat(lock);
        if (fresh.dev !== info.dev || fresh.ino !== info.ino)
            throw new Error('Documentation application lock changed');
        await rm(lock);
        handle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    }
    try {
        await handle.writeFile(`${process.pid}\n`); await handle.sync();
        return await task();
    } finally {
        try {
            const held = await handle.stat();
            const current = await lstat(lock).catch(error => { if (missing(error)) return undefined; throw error; });
            if (current && current.dev === held.dev && current.ino === held.ino) await rm(lock);
            else if (current) throw new Error('Documentation application lock changed during publication');
        } finally { await handle.close(); }
    }
}
function sidePath(root: string, path: string, id: string, side: 'stage' | 'backup'): string {
    return join(root, `${path}.dope-${id}.${side}`);
}
async function fileIdentity(path: string): Promise<{ hash: string; dev: number; ino: number } | undefined> {
    let info;
    try { info = await lstat(path); } catch (error) { if (missing(error)) return undefined; throw error; }
    if (!info.isFile() || info.isSymbolicLink() || info.nlink > 2 || info.size > 16_384)
        throw new Error('Unsafe documentation publication file');
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.dev !== info.dev || opened.ino !== info.ino || opened.size > 16_384)
            throw new Error('Documentation publication file changed');
        const bytes = await handle.readFile();
        return { hash: hash(bytes), dev: opened.dev, ino: opened.ino };
    } finally { await handle.close(); }
}
const sameInode = (a?: { dev: number; ino: number }, b?: { dev: number; ino: number }): boolean =>
    !!a && !!b && a.dev === b.dev && a.ino === b.ino;
async function syncParent(file: string): Promise<void> {
    const parent = await open(resolve(file, '..'), 'r');
    try { await parent.sync(); } finally { await parent.close(); }
}
async function stage(path: string, bytes: string, mode: number): Promise<void> {
    const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, mode);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    await syncParent(path);
}
async function publishTarget(record: DocumentationApplication, target: ChatDocumentationProposal['targets'][number]): Promise<void> {
    const root = record.root, file = join(root, target.path);
    const staged = sidePath(root, target.path, record.id, 'stage');
    const backup = sidePath(root, target.path, record.id, 'backup');
    const basis = await readDocumentationBasis(root, target.path);
    if (basis.beforeHash !== target.beforeHash || basis.before !== target.before)
        throw new Error('Documentation source changed before publication');
    if (await fileIdentity(staged) || await fileIdentity(backup)) throw new Error('Documentation publication side-file collision');
    const mode = target.operation === 'update' ? (await lstat(file)).mode & 0o777 : 0o644;
    await stage(staged, target.after, mode);
    let recorded = false;
    try {
        if (target.operation === 'create') await link(staged, file);
        else {
            const current = await readDocumentationBasis(root, target.path);
            if (current.beforeHash !== target.beforeHash) throw new Error('Documentation source changed before effect');
            const reserve = await open(backup, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            await reserve.close();
            await rename(file, backup);
            const moved = await fileIdentity(backup);
            if (moved?.hash !== target.beforeHash) {
                await link(backup, file).catch(error => { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; });
                throw new Error('Documentation source changed during publication');
            }
            await link(staged, file);
        }
        await syncParent(file);
        const retained = await fileIdentity(file), source = await fileIdentity(staged);
        if (!sameInode(retained, source) || retained?.hash !== target.afterHash)
            throw new Error('Documentation effect could not be verified');
        if (target.operation === 'update' && (await fileIdentity(backup))?.hash !== target.beforeHash)
            throw new Error('Documentation source changed in the backup during publication');
        record.effects.push({ path: target.path, operation: target.operation, beforeHash: target.beforeHash,
            afterHash: target.afterHash, diff: target.diff, appliedAt: new Date().toISOString() });
        await saveRecord(record);
        recorded = true;
    } finally {
        // Side files remain when a write outcome is uncertain; reconciliation inspects them first.
        if (recorded) {
            if (target.operation === 'update' && (await fileIdentity(backup))?.hash !== target.beforeHash)
                throw new Error('Documentation backup changed after verification; retain for recovery');
            await rm(backup, { force: true }); await rm(staged, { force: true });
        }
    }
}
async function reconcileLocked(record: DocumentationApplication): Promise<DocumentationApplication> {
    if (record.status === 'complete' || record.status === 'failed') return record;
    let uncertain = false;
    for (const target of record.targets) {
        const file = join(record.root, target.path), staged = sidePath(record.root, target.path, record.id, 'stage');
        const backup = sidePath(record.root, target.path, record.id, 'backup');
        if (record.effects.some(effect => effect.path === target.path)) {
            try {
                await checkedDocumentationParent(record.root, target.path);
                const stageInfo = await fileIdentity(staged), backupInfo = await fileIdentity(backup);
                if (stageInfo && stageInfo.hash !== target.afterHash || backupInfo && backupInfo.hash !== target.beforeHash)
                    uncertain = true;
                else { await rm(staged, { force: true }); await rm(backup, { force: true }); }
            } catch { uncertain = true; }
            continue;
        }
        let current: Awaited<ReturnType<typeof fileIdentity>>, stageInfo: Awaited<ReturnType<typeof fileIdentity>>;
        let backupInfo: Awaited<ReturnType<typeof fileIdentity>>;
        try {
            await checkedDocumentationParent(record.root, target.path);
            current = await fileIdentity(file); stageInfo = await fileIdentity(staged); backupInfo = await fileIdentity(backup);
        } catch { uncertain = true; continue; }
        if (stageInfo?.hash !== target.afterHash && stageInfo) { uncertain = true; continue; }
        if (backupInfo && backupInfo.hash !== target.beforeHash) { uncertain = true; continue; }
        if (sameInode(current, stageInfo) && current?.hash === target.afterHash) {
            record.effects.push({ path: target.path, operation: target.operation, beforeHash: target.beforeHash,
                afterHash: target.afterHash, diff: target.diff, appliedAt: null });
            await saveRecord(record);
            await rm(backup, { force: true }); await rm(staged, { force: true });
        } else if (backupInfo && !current && target.operation === 'update') {
            // Restore only into a still-absent name. A concurrent editor wins every collision.
            try { await link(backup, file); await syncParent(file); await rm(backup); await rm(staged, { force: true }); }
            catch { uncertain = true; }
        } else if (current?.hash === target.beforeHash || !current && target.operation === 'create') {
            if (backupInfo) uncertain = true;
            else await rm(staged, { force: true });
        } else uncertain = true;
    }
    record.status = uncertain ? 'uncertain' : record.effects.length === record.targets.length ? 'complete' :
        record.effects.length ? 'partial' : 'failed';
    if (uncertain) record.diagnostic = 'Some effects could not be verified. Inspect the source and side files; no automatic overwrite was made.';
    else if (record.status === 'partial') record.diagnostic = 'Only the verified retained subset was applied; review remaining changes again.';
    else delete record.diagnostic;
    await saveRecord(record);
    return record;
}

/** Called only by the backend after a distinct, durable developer approval. */
export async function applyDocumentationProposal(store: RoadmapStore, proposal: ChatDocumentationProposal,
    root: string, leaseToken: string,
    model?: { connectionId: string; modelId: string; providerId: string; modelLabel: string }): Promise<DocumentationApplication> {
    if (hash(leaseToken) !== proposal.leaseDigest || root !== proposal.root)
        throw new Error('Documentation approval lease or project changed');
    return withLock(root, async () => {
        const existing = await readRecord(root, proposal.id);
        if (existing) {
            if (existing.proposalDigest !== proposal.digest || existing.chatId !== proposal.chatId ||
                existing.ownerId !== proposal.ownerId) throw new Error('Foreign documentation application');
            return reconcileLocked(existing);
        }
        if (await documentationReviewApplicability(store, proposal, root) !== 'applicable')
            throw new Error('Reviewed documentation source or owner is stale');
        // Reserve every side name before journaling: an existing side file is never adopted as ours.
        for (const target of proposal.targets) {
            if (await fileIdentity(sidePath(root, target.path, proposal.id, 'stage')) ||
                await fileIdentity(sidePath(root, target.path, proposal.id, 'backup')))
                throw new Error('Documentation publication side-file collision');
        }
        const record: DocumentationApplication = { schemaVersion: 1, id: proposal.id, proposalDigest: proposal.digest,
            root, projectId: proposal.projectId, worktreeId: proposal.worktreeId, ownerId: proposal.ownerId,
            chatId: proposal.chatId, messageId: proposal.messageId, leaseDigest: proposal.leaseDigest,
            ...(model ? { model } : {}),
            roadmapRevision: proposal.roadmapRevision, approvedAt: new Date().toISOString(),
            status: 'applying', effects: [], targets: proposal.targets };
        await saveRecord(record, true);
        try {
            for (const target of proposal.targets) {
                const index = await store.read(root);
                if (index.projectRoot !== root || index.revision !== proposal.roadmapRevision ||
                    (index.projectId === 'uninitialized' ? `root:${hash(root)}` : index.projectId) !== proposal.projectId ||
                    index.linkedDocument?.syncState && index.linkedDocument.syncState !== 'synced' ||
                    index.linkedDocument?.path === target.path)
                    throw new Error('Documentation owner changed during application');
                await publishTarget(record, target);
            }
        } catch (error) {
            const result = await reconcileLocked(record);
            result.diagnostic = `Application stopped: ${String(error)}. ${result.diagnostic ?? ''}`.slice(0, 1000);
            await saveRecord(result);
            return result;
        }
        record.status = 'complete';
        await saveRecord(record);
        return record;
    });
}

/** Explicit recovery is an owner action. History reads never call this. */
export async function reconcileDocumentationApplication(root: string, id: string,
    expectedDigest?: string): Promise<DocumentationApplication | undefined> {
    return withLock(root, async () => {
        const record = await readRecord(root, id);
        if (record && expectedDigest && record.proposalDigest !== expectedDigest)
            throw new Error('Foreign documentation application journal');
        return record && reconcileLocked(record);
    });
}

/** Bounded, read-only projection of durable verified effects. */
export async function readDocumentationApplications(root: string): Promise<DocumentationApplication[]> {
    let directory: string;
    try { directory = await location(root); } catch (error) { if (missing(error)) return []; throw error; }
    const files = (await readdir(directory)).filter(name => /^[0-9a-f-]{36}\.json$/iu.test(name)).slice(0, 100);
    const records = await Promise.all(files.map(name => readRecord(root, name.slice(0, -5))));
    return records.filter((record): record is DocumentationApplication => !!record && record.effects.length > 0);
}
