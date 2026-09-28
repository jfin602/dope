import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PlanningDocument, PlanningOperation, PlanningResult } from '@dope/contracts/lib/planning';
import { applyPlanningOperation, emptyPlanningDocument, parsePlanningDocument } from '../index';

const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

export class PlanningStore {
    private readonly listeners = new Set<(root: string, snapshot: PlanningDocument) => void>();

    constructor(private readonly io: typeof fs = fs) { }

    onChange(listener: (root: string, snapshot: PlanningDocument) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    async root(uri: string): Promise<string> {
        if (typeof uri !== 'string') throw new Error('Planning requires a local folder');
        const url = new URL(uri);
        if (url.protocol !== 'file:' || url.host) throw new Error('Planning requires a local folder');
        const root = await this.io.realpath(fileURLToPath(url));
        if (!(await this.io.stat(root)).isDirectory()) throw new Error('Planning requires a folder');
        return root;
    }

    private async ordinary(path: string): Promise<boolean> {
        try {
            const info = await this.io.lstat(path);
            if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsafe Planning path: ${path}`);
            return true;
        } catch (error) { if (missing(error)) return false; throw error; }
    }

    private async paths(root: string) {
        const directory = join(root, '.dope');
        try {
            const info = await this.io.lstat(directory);
            if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Unsafe Planning directory: ${directory}`);
        } catch (error) { if (!missing(error)) throw error; }
        return { directory, file: join(directory, 'planning.json'), lock: join(directory, 'planning.lock') };
    }

    private async checkFiles(root: string, snapshot: PlanningDocument): Promise<void> {
        const links = [...snapshot.plans.flatMap(plan => plan.links.filter(link => link.type === 'file')),
            ...snapshot.tasks.flatMap(task => task.workingSet)];
        for (const link of links) {
            let target = root;
            for (const segment of link.path.split('/')) {
                target = join(target, segment);
                try {
                    if ((await this.io.lstat(target)).isSymbolicLink()) throw new Error(`Unsafe Planning file link: ${link.path}`);
                } catch (error) { if (!missing(error)) throw error; }
            }
            const fromRoot = relative(root, target);
            if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || fromRoot.startsWith(sep)) throw new Error(`Unsafe Planning file link: ${link.path}`);
        }
    }

    async read(root: string): Promise<PlanningDocument | undefined> {
        const { file } = await this.paths(root);
        if (!(await this.ordinary(file))) return undefined;
        let snapshot: PlanningDocument;
        try { snapshot = parsePlanningDocument(JSON.parse(await this.io.readFile(file, 'utf8'))); }
        catch { throw new Error(`Corrupt or unsupported Planning snapshot: ${file}`); }
        await this.checkFiles(root, snapshot);
        return snapshot;
    }

    private async replace(root: string, snapshot: PlanningDocument): Promise<void> {
        // ponytail: full snapshots scale linearly; move to indexed storage only if project sizes demand it.
        const { directory, file } = await this.paths(root);
        await this.checkFiles(root, parsePlanningDocument(snapshot));
        const temporary = join(directory, `planning.${randomUUID()}.tmp`);
        let replaced = false;
        try {
            const handle = await this.io.open(temporary, 'wx', 0o600);
            try { await handle.writeFile(`${JSON.stringify(snapshot, null, 2)}\n`); await handle.sync(); }
            finally { await handle.close(); }
            await this.ordinary(file);
            await this.io.rename(temporary, file);
            replaced = true;
            const parent = await this.io.open(directory, 'r');
            try { await parent.sync(); } finally { await parent.close(); }
        } catch (error) {
            if (replaced) throw new Error(`Planning write outcome uncertain; re-read the snapshot before retrying: ${String(error)}`);
            throw error;
        } finally { await this.io.rm(temporary, { force: true }); }
    }

    async mutate(root: string, projectId: string, expectedRevision: number, operation: PlanningOperation,
        validate?: (current: PlanningDocument, next: PlanningDocument) => Promise<void>): Promise<PlanningResult> {
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !operation || typeof operation !== 'object') throw new Error('Invalid Planning mutation');
        if (!projectId) throw new Error('Project Mind identity required before Planning writes');
        const initial = emptyPlanningDocument(projectId);
        const { directory, lock } = await this.paths(root);
        let created = false;
        try { await this.io.lstat(directory); } catch (error) { if (missing(error)) created = true; else throw error; }
        await this.io.mkdir(directory, { recursive: true });
        await this.paths(root);
        if (created) {
            const parent = await this.io.open(root, 'r');
            try { await parent.sync(); } finally { await parent.close(); }
        }
        const handle = await this.io.open(lock, 'wx', 0o600).catch(error => {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Planning locked; stop writers and inspect ${lock}`);
            throw error;
        });
        let result: PlanningResult;
        try {
            const stored = await this.read(root);
            if (stored && stored.projectId !== projectId) throw new Error('Planning project identity mismatch; inspect both stores');
            if ((stored?.revision ?? 0) !== expectedRevision) throw new Error(`Stale Planning revision; expected ${expectedRevision}, current ${stored?.revision ?? 0}`);
            const current = stored ?? initial;
            result = applyPlanningOperation(current, expectedRevision, operation, new Date().toISOString(), randomUUID());
            await validate?.(current, result.snapshot);
            await this.replace(root, result.snapshot);
        } finally {
            const acquired = await handle.stat();
            await handle.close();
            try {
                if ((await this.io.lstat(lock)).ino !== acquired.ino) throw new Error(`Planning lock changed; inspect ${lock}`);
                await this.io.rm(lock);
            } catch (error) { if (!missing(error)) throw error; }
        }
        for (const listener of this.listeners) {
            try { listener(root, result.snapshot); } catch { /* A closed connection cannot undo a committed write. */ }
        }
        return result;
    }
}
