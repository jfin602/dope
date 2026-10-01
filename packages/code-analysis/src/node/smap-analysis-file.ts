import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { validateArchitectureEvidencePacket } from '@dope/software-map';
import type { ArchitectureEvidencePacket, ArchitectureReview, ArchitectureReviewNode, SynthesisCallAttempt, SynthesisCheckpoint, SynthesisStage } from '@dope/software-map';

export interface SavedSynthesisRun {
    schemaVersion: 1;
    runId: string;
    packet: ArchitectureEvidencePacket;
    declarationFingerprint: string;
    status: 'analyzing' | 'failed' | 'review_required';
    review?: ArchitectureReview & { fingerprint: string };
    current?: { stage: SynthesisStage; subject?: string; providerKind: 'local' | 'gemini'; modelLabel: string };
    failure?: { stage: SynthesisStage; subject?: string; message: string; providerKind: 'local' | 'gemini'; modelLabel: string };
    checkpoints: SynthesisCheckpoint[];
    attempts: SynthesisCallAttempt[];
}

const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
export function validateReviewDraft(draft: ArchitectureReviewNode[]): void {
    if (!Array.isArray(draft) || draft.length > 10000 || draft.some(node => !node || typeof node !== 'object' ||
        typeof node.proposalKey !== 'string' || !node.proposalKey || node.proposalKey.length > 512 ||
        Object.keys(node).some(key => !['proposalKey', 'kind', 'id', 'name', 'purpose', 'parentProposalKey', 'roots'].includes(key)) ||
        !['system', 'subsystem', 'component'].includes(node.kind) ||
        ![node.id, node.name, node.purpose].every(value => typeof value === 'string' && value.length <= 10000) ||
        node.parentProposalKey !== null && (typeof node.parentProposalKey !== 'string' || node.parentProposalKey.length > 512) ||
        !Array.isArray(node.roots) || node.roots.length > 1000 ||
        node.roots.some(root => typeof root !== 'string' || root.length > 4096)) ||
        Buffer.byteLength(JSON.stringify(draft)) > 16 * 1024 * 1024)
        throw new Error('Invalid Software Map review draft');
}
const locks = new Map<string, Promise<void>>();
async function locked<T>(root: string, action: () => Promise<T>): Promise<T> {
    const previous = locks.get(root) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    locks.set(root, current);
    await previous;
    try { return await action(); } finally { release(); if (locks.get(root) === current) locks.delete(root); }
}
async function location(root: string, create: boolean): Promise<string | undefined> {
    const dir = join(root, '.dope');
    try {
        const entry = await lstat(dir);
        if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Unsafe Software Map directory');
    } catch (error) {
        if (!absent(error)) throw error;
        if (!create) return undefined;
        await mkdir(dir);
    }
    return join(dir, 'smap-analysis.json');
}
async function safeFile(path: string): Promise<boolean> {
    try {
        const entry = await lstat(path);
        if (!entry.isFile() || entry.isSymbolicLink()) throw new Error('Unsafe Software Map analysis file');
        return true;
    } catch (error) { if (absent(error)) return false; throw error; }
}
export async function readSynthesisRun(root: string): Promise<SavedSynthesisRun | undefined> {
    const path = await location(root, false);
    if (!path || !await safeFile(path)) return undefined;
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const info = await file.stat();
        if (!info.isFile() || info.size > 256 * 1024 * 1024) throw new Error('Unsafe Software Map analysis file');
        const value: unknown = JSON.parse(await file.readFile('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Software Map analysis run');
        const run = value as SavedSynthesisRun;
        if (run.schemaVersion !== 1 || typeof run.runId !== 'string' || !run.runId ||
            !['analyzing', 'failed', 'review_required'].includes(run.status) || !Array.isArray(run.checkpoints) ||
            !Array.isArray(run.attempts) || typeof run.declarationFingerprint !== 'string')
            throw new Error('Invalid Software Map analysis run');
        validateArchitectureEvidencePacket(run.packet);
        if (run.status === 'review_required' && (!run.review ||
            run.review.packet.inputFingerprint !== run.packet.inputFingerprint))
            throw new Error('Invalid Software Map analysis review');
        if (run.review) {
            if (typeof run.review.reviewId !== 'string' || !run.review.reviewId ||
                typeof run.review.fingerprint !== 'string' ||
                run.review.revision !== undefined && (!Number.isSafeInteger(run.review.revision) || run.review.revision < 0))
                throw new Error('Invalid Software Map analysis review');
            validateReviewDraft(run.review.draft);
            run.review.revision ??= 0;
        }
        return run;
    } catch (error) {
        if (error instanceof SyntaxError) throw new Error('Invalid Software Map analysis run');
        throw error;
    } finally { await file.close(); }
}
export async function writeSynthesisRun(root: string, run: SavedSynthesisRun, stillCurrent: () => void = () => {}): Promise<void> {
    await locked(root, () => writeUnlocked(root, run, stillCurrent));
}
async function writeUnlocked(root: string, run: SavedSynthesisRun, stillCurrent: () => void): Promise<void> {
    const path = (await location(root, true))!;
    await safeFile(path);
    const content = `${JSON.stringify(run)}\n`;
    if (Buffer.byteLength(content) > 256 * 1024 * 1024) throw new Error('Software Map analysis run is too large');
    const temp = `${path}.${randomUUID()}.tmp`;
    try {
        const file = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try {
            await file.writeFile(content);
            await file.sync();
        } finally { await file.close(); }
        stillCurrent();
        await rename(temp, path);
    } finally { await rm(temp, { force: true }); }
}
export async function saveSynthesisReviewDraft(root: string, reviewId: string, expectedRevision: number,
    draft: ArchitectureReviewNode[]): Promise<number> {
    validateReviewDraft(draft);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision === Number.MAX_SAFE_INTEGER)
        throw new Error('Invalid Software Map review revision');
    return locked(root, async () => {
        const run = await readSynthesisRun(root);
        if (run?.status !== 'review_required' || run.review?.reviewId !== reviewId)
            throw new Error('No matching architecture review');
        if (run.review.revision !== expectedRevision) throw new Error('Stale architecture review revision');
        const revision = expectedRevision + 1;
        await writeUnlocked(root, { ...run, review: { ...run.review, draft: structuredClone(draft), revision } }, () => {});
        return revision;
    });
}
export async function clearSynthesisRun(root: string): Promise<void> {
    await locked(root, async () => {
        const path = await location(root, false);
        if (path && await safeFile(path)) await rm(path);
    });
}
