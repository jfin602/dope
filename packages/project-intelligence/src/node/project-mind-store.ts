import { randomUUID } from 'node:crypto';
import { open, lstat, mkdir, readFile, realpath, rename, rm, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNote } from '@dope/contracts/lib/note';
import type { Artifact, ProjectMind, ProjectMindOperation } from '@dope/contracts/lib/project-mind';
import { addArtifact, archive, createProjectMind, linkArtifact, parseProjectMind, replaceArtifact, supersede, transition, unlinkArtifact } from '../index';

const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

async function ordinary(path: string): Promise<boolean> {
    try {
        const info = await lstat(path);
        if (info.isSymbolicLink() || !info.isFile()) throw new Error(`Unsafe Project Mind path: ${path}`);
        return true;
    } catch (error) { if (missing(error)) return false; throw error; }
}

export class ProjectMindStore {
    private readonly listeners = new Set<(root: string, snapshot: ProjectMind) => void>();

    onChange(listener: (root: string, snapshot: ProjectMind) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    async root(uri: string): Promise<string> {
        if (typeof uri !== 'string') throw new Error('Project Mind requires a local folder');
        const url = new URL(uri);
        if (url.protocol !== 'file:' || url.host) throw new Error('Project Mind requires a local folder');
        const path = await realpath(fileURLToPath(url));
        if (!(await stat(path)).isDirectory()) throw new Error('Project Mind requires a folder');
        return path;
    }

    private async paths(root: string): Promise<{ directory: string; file: string; lock: string; legacy: string }> {
        const directory = join(root, '.dope');
        try {
            const info = await lstat(directory);
            if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(`Unsafe Project Mind directory: ${directory}`);
        } catch (error) { if (!missing(error)) throw error; }
        return { directory, file: join(directory, 'project-mind.json'), lock: join(directory, 'project-mind.lock'), legacy: join(directory, 'note.json') };
    }

    private async readFile(root: string): Promise<ProjectMind | undefined> {
        const { file } = await this.paths(root);
        if (!(await ordinary(file))) return undefined;
        try {
            const snapshot = parseProjectMind(JSON.parse(await readFile(file, 'utf8')));
            await this.checkLinks(root, snapshot);
            return snapshot;
        }
        catch { throw new Error(`Corrupt or unsupported Project Mind snapshot: ${file}`); }
    }

    async read(root: string): Promise<ProjectMind | undefined> { return this.readFile(root); }

    private async checkLinks(root: string, project: ProjectMind): Promise<void> {
        for (const artifact of project.artifacts) for (const link of artifact.links) {
            if (link.target.type !== 'file') continue;
            let path = root;
            for (const segment of link.target.path.split('/')) {
                path = join(path, segment);
                try {
                    const info = await lstat(path);
                    if (info.isSymbolicLink()) throw new Error(`Unsafe Project Mind file link: ${link.target.path}`);
                } catch (error) { if (!missing(error)) throw error; }
            }
            const pathFromRoot = relative(root, path);
            if (pathFromRoot === '..' || pathFromRoot.startsWith(`..${sep}`) || pathFromRoot.startsWith(sep)) throw new Error(`Unsafe Project Mind file link: ${link.target.path}`);
        }
    }

    private async replace(root: string, project: ProjectMind): Promise<void> {
        // ponytail: whole-snapshot writes grow linearly; revisit only when measured project size demands it.
        const { directory, file } = await this.paths(root);
        await this.checkLinks(root, parseProjectMind(project));
        const temporary = join(directory, `project-mind.${randomUUID()}.tmp`);
        let replaced = false;
        try {
            const handle = await open(temporary, 'wx', 0o600);
            try { await handle.writeFile(`${JSON.stringify(project, null, 2)}\n`); await handle.sync(); }
            finally { await handle.close(); }
            await ordinary(file);
            await rename(temporary, file);
            replaced = true;
            const parent = await open(directory, 'r');
            try { await parent.sync(); } finally { await parent.close(); }
        } catch (error) {
            if (replaced) throw new Error(`Project Mind write outcome uncertain; re-read the snapshot before retrying: ${String(error)}`);
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
        const handle = await open(lock, 'wx', 0o600).catch(error => {
            if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Project Mind locked; stop writers and inspect ${lock}`);
            throw error;
        });
        try { return await work(); }
        finally {
            const acquired = await handle.stat();
            await handle.close();
            try {
                if ((await lstat(lock)).ino !== acquired.ino) throw new Error(`Project Mind lock changed; inspect ${lock}`);
                await rm(lock);
            } catch (error) { if (!missing(error)) throw error; }
        }
    }

    async withLock<T>(root: string, work: () => Promise<T>): Promise<T> { return this.locked(root, work); }

    private notify(root: string, snapshot: ProjectMind): void {
        for (const listener of this.listeners) {
            try { listener(root, snapshot); } catch { /* A closed connection cannot undo a committed write. */ }
        }
    }

    async mutate(root: string, expectedRevision: number, operation: ProjectMindOperation, expectedProjectId?: string): Promise<ProjectMind> {
        if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !operation || typeof operation !== 'object') throw new Error('Invalid Project Mind mutation');
        const snapshot = await this.locked(root, async () => {
            const current = await this.readFile(root);
            if (expectedProjectId && current?.projectId !== expectedProjectId) throw new Error('Project Mind identity changed; reattach after inspecting the snapshot');
            if ((current?.revision ?? 0) !== expectedRevision) throw new Error(`Stale Project Mind revision; expected ${expectedRevision}, current ${current?.revision ?? 0}`);
            const now = new Date().toISOString();
            let next: ProjectMind;
            if (!current) {
                if (operation.type !== 'create') throw new Error('Project Mind is empty; create an artifact first');
                if (operation.artifact?.migration || operation.artifact?.createdAt === null || operation.artifact?.updatedAt === null) throw new Error('Invalid new artifact provenance');
                next = createProjectMind(randomUUID(), operation.artifact);
            } else {
                switch (operation.type) {
                    case 'create':
                        if (operation.artifact?.migration || operation.artifact?.createdAt === null || operation.artifact?.updatedAt === null) throw new Error('Invalid new artifact provenance');
                        next = addArtifact(current, operation.artifact); break;
                    case 'replace': next = replaceArtifact(current, operation.artifact); break;
                    case 'transition': next = transition(current, operation.artifactId, operation.status, now, operation.answer); break;
                    case 'archive':
                        if (typeof operation.archived !== 'boolean') throw new Error('Invalid archive request');
                        next = archive(current, operation.artifactId, operation.archived, now); break;
                    case 'link': next = linkArtifact(current, operation.artifactId, operation.link, now); break;
                    case 'unlink': next = unlinkArtifact(current, operation.artifactId, operation.link, now); break;
                    case 'supersede': next = supersede(current, operation.oldId, operation.replacementId, now); break;
                    default: throw new Error('Invalid Project Mind operation');
                }
            }
            await this.replace(root, next);
            return next;
        });
        this.notify(root, snapshot);
        return snapshot;
    }

    async migrate(root: string): Promise<ProjectMind> {
        const snapshot = await this.locked(root, async () => {
            if (await this.readFile(root)) throw new Error('Project Mind already exists; legacy Note is retained history');
            const { legacy } = await this.paths(root);
            if (!(await ordinary(legacy))) throw new Error('No legacy Note to migrate');
            let note;
            try { note = parseNote(JSON.parse(await readFile(legacy, 'utf8'))); }
            catch { throw new Error(`Corrupt legacy Dope Note: ${legacy}`); }
            const artifact: Artifact = {
                schemaVersion: 2, type: 'note', id: note.id, title: note.title, body: note.body,
                status: 'active', provenance: note.provenance, createdAt: null, updatedAt: null,
                archivedAt: null, links: [], migration: { sourcePath: '.dope/note.json', sourceSchemaVersion: 1, migratedAt: new Date().toISOString() }
            };
            const next = createProjectMind(randomUUID(), artifact);
            await this.replace(root, next);
            return next;
        });
        this.notify(root, snapshot);
        return snapshot;
    }
}
