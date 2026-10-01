import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { validateArchitectureEvidencePacket } from '@dope/software-map';
import type { ArchitectureEvidencePacket, ArchitectureReview, SynthesisCallAttempt, SynthesisCheckpoint, SynthesisStage } from '@dope/software-map';

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
        if (!(await file.stat()).isFile()) throw new Error('Unsafe Software Map analysis file');
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
        return run;
    } catch (error) {
        if (error instanceof SyntaxError) throw new Error('Invalid Software Map analysis run');
        throw error;
    } finally { await file.close(); }
}
export async function writeSynthesisRun(root: string, run: SavedSynthesisRun, stillCurrent: () => void = () => {}): Promise<void> {
    await locked(root, async () => {
        const path = (await location(root, true))!;
        await safeFile(path);
        const temp = `${path}.${randomUUID()}.tmp`;
        try {
            const file = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            try {
                await file.writeFile(`${JSON.stringify(run)}\n`);
                await file.sync();
            } finally { await file.close(); }
            stillCurrent();
            await rename(temp, path);
        } finally { await rm(temp, { force: true }); }
    });
}
export async function clearSynthesisRun(root: string): Promise<void> {
    await locked(root, async () => {
        const path = await location(root, false);
        if (path && await safeFile(path)) await rm(path);
    });
}
