import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArchitectureJson } from '@dope/software-map';
import type { ArchitectureDeclaration } from '@dope/software-map';
import { readArchitecture } from './architecture-file';

const hash = (bytes?: string): string => createHash('sha256').update(bytes ?? '<missing>').digest('hex');
const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const locks = new Map<string, Promise<void>>();

async function directory(root: string, create = false): Promise<string | undefined> {
    const path = join(root, '.dope');
    try {
        const entry = await lstat(path);
        if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Unsafe Software Map directory');
        return path;
    } catch (error) {
        if (!absent(error)) throw error;
        if (!create) return undefined;
        await mkdir(path);
        return path;
    }
}
async function safeFile(path: string): Promise<boolean> {
    try {
        const entry = await lstat(path);
        if (!entry.isFile() || entry.isSymbolicLink()) throw new Error(`Unsafe Software Map file: ${path}`);
        return true;
    } catch (error) {
        if (absent(error)) return false;
        throw error;
    }
}
async function marker(root: string): Promise<{ schemaVersion: 1; architectureFingerprint: string } | undefined> {
    const dir = await directory(root);
    if (!dir || !await safeFile(join(dir, 'smap.json'))) return undefined;
    const handle = await open(join(dir, 'smap.json'), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        if (!(await handle.stat()).isFile()) throw new Error('Unsafe Software Map marker');
        const value: unknown = JSON.parse(await handle.readFile('utf8'));
        if (!value || typeof value !== 'object' || Array.isArray(value) ||
            Object.keys(value).sort().join(',') !== 'architectureFingerprint,schemaVersion' ||
            (value as { schemaVersion?: unknown }).schemaVersion !== 1 ||
            !/^[a-f0-9]{64}$/.test((value as { architectureFingerprint?: string }).architectureFingerprint ?? '')) throw new Error('Invalid Software Map marker');
        return value as { schemaVersion: 1; architectureFingerprint: string };
    } catch (error) {
        if (error instanceof SyntaxError) throw new Error('Invalid Software Map marker');
        throw error;
    } finally { await handle.close(); }
}
export async function readInitialization(root: string): Promise<{ initialized: boolean; declarationPresent: boolean; declarationFingerprint: string }> {
    const { text } = await readArchitecture(root);
    const accepted = await marker(root);
    if (accepted && (!text || accepted.architectureFingerprint !== hash(text))) throw new Error('Software Map marker does not match canonical architecture');
    return { initialized: !!accepted, declarationPresent: text !== undefined, declarationFingerprint: hash(text) };
}
async function stage(path: string, bytes: string): Promise<string> {
    const temp = `${path}.${randomUUID()}.tmp`;
    const handle = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    return temp;
}
async function locked<T>(root: string, action: () => Promise<T>): Promise<T> {
    const previous = locks.get(root) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>(resolve => { release = resolve; });
    locks.set(root, current);
    await previous;
    try { return await action(); } finally { release(); if (locks.get(root) === current) locks.delete(root); }
}
/** The marker is the commit point. On a marker failure restore the exact prior declaration bytes. */
export async function acceptInitialization(root: string, expectedFingerprint: string, declaration?: ArchitectureDeclaration,
    beforeMarkerCommit?: () => Promise<void>): Promise<void> {
    await locked(root, async () => {
        const before = await readInitialization(root);
        if (before.initialized || before.declarationFingerprint !== expectedFingerprint) throw new Error('Stale Software Map architecture declaration');
        const existing = await readArchitecture(root);
        const text = declaration === undefined ? existing.text : `${JSON.stringify(declaration, null, 2)}\n`;
        if (!text) throw new Error('No architecture declaration to accept');
        parseArchitectureJson(text);
        const dir = await directory(root, true);
        if (!dir) throw new Error('Software Map directory unavailable');
        const architecturePath = join(dir, 'architecture.json');
        const markerPath = join(dir, 'smap.json');
        if (await safeFile(markerPath)) throw new Error('Software Map already initialized');
        const rewrite = declaration !== undefined;
        let architectureStage: string | undefined;
        let markerStage: string | undefined;
        let architectureReplaced = false;
        try {
            if (rewrite) architectureStage = await stage(architecturePath, text);
            markerStage = await stage(markerPath, `${JSON.stringify({ schemaVersion: 1, architectureFingerprint: hash(text) }, null, 2)}\n`);
            // Reject edits that occurred while staging, including a replacement with different bytes.
            if ((await readInitialization(root)).declarationFingerprint !== expectedFingerprint) throw new Error('Stale Software Map architecture declaration');
            if (rewrite) {
                if (await safeFile(architecturePath) !== before.declarationPresent) throw new Error('Stale Software Map architecture declaration');
                await rename(architectureStage!, architecturePath);
                architectureStage = undefined;
                architectureReplaced = true;
            }
            await beforeMarkerCommit?.();
            if (await safeFile(markerPath)) throw new Error('Software Map already initialized');
            await rename(markerStage, markerPath);
            markerStage = undefined;
        } catch (error) {
            if (architectureReplaced) {
                if (existing.text === undefined) await rm(architecturePath);
                else {
                    const restore = await stage(architecturePath, existing.text);
                    await rename(restore, architecturePath);
                }
            }
            throw error;
        } finally {
            if (architectureStage) await rm(architectureStage, { force: true });
            if (markerStage) await rm(markerStage, { force: true });
        }
        if (!(await readInitialization(root)).initialized) throw new Error('Software Map initialization verification failed');
    });
}

/** Replaces initialized canonical authority; the marker remains the commit point. */
export async function replaceArchitecture(root: string, expectedFingerprint: string, declaration: ArchitectureDeclaration,
    beforeMarkerCommit: () => Promise<() => Promise<void>>): Promise<string> {
    return locked(root, async () => {
        const before = await readInitialization(root);
        if (!before.initialized || before.declarationFingerprint !== expectedFingerprint) throw new Error('Stale Software Map architecture declaration');
        const original = (await readArchitecture(root)).text!;
        const text = `${JSON.stringify(parseArchitectureJson(JSON.stringify(declaration)), null, 2)}\n`;
        const dir = await directory(root);
        if (!dir) throw new Error('Missing Software Map directory');
        const architecturePath = join(dir, 'architecture.json'), markerPath = join(dir, 'smap.json');
        const markerBefore = await readFile(markerPath, 'utf8');
        let architectureStage: string | undefined;
        let markerStage: string | undefined;
        let replaced = false;
        let rollback: (() => Promise<void>) | undefined;
        try {
            architectureStage = await stage(architecturePath, text);
            markerStage = await stage(markerPath, `${JSON.stringify({ schemaVersion: 1, architectureFingerprint: hash(text) }, null, 2)}\n`);
            if ((await readInitialization(root)).declarationFingerprint !== expectedFingerprint || !await safeFile(architecturePath) || !await safeFile(markerPath))
                throw new Error('Stale Software Map architecture declaration');
            await rename(architectureStage, architecturePath);
            architectureStage = undefined;
            replaced = true;
            rollback = await beforeMarkerCommit();
            if (await readFile(markerPath, 'utf8') !== markerBefore) throw new Error('Stale Software Map marker');
            await rename(markerStage, markerPath);
            markerStage = undefined;
            return hash(text);
        } catch (error) {
            // A failed companion planning write never leaves the new declaration authoritative.
            try {
                await rollback?.();
                if (replaced) await rename(await stage(architecturePath, original), architecturePath);
            } catch (restore) { throw new Error(`Architecture adoption outcome uncertain: ${String(restore)}; original error: ${String(error)}`); }
            throw error;
        } finally {
            if (architectureStage) await rm(architectureStage, { force: true });
            if (markerStage) await rm(markerStage, { force: true });
        }
    });
}
