import { randomUUID } from 'node:crypto';
import { readFile, mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseNote } from '@dope/contracts/lib/note';
import type { Note, NoteDraft } from '@dope/contracts/lib/note';

export class NoteStore {
    // ponytail: one Note per workspace is enough for the spike; use a collection when Project Mind needs multiple artifacts.
    private readonly listeners = new Set<(workspaceUri: string, note: Note) => void>();
    private readonly pending = new Map<string, Promise<unknown>>();

    onChange(listener: (workspaceUri: string, note: Note) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private async file(workspaceUri: string): Promise<string> {
        const url = new URL(workspaceUri);
        if (url.protocol !== 'file:') throw new Error('Dope notes require a local workspace');
        const root = fileURLToPath(url);
        if (!(await stat(root)).isDirectory()) throw new Error('Dope workspace must be a directory');
        return join(root, '.dope', 'note.json');
    }

    async read(workspaceUri: string): Promise<Note | undefined> {
        const file = await this.file(workspaceUri);
        let text: string;
        try { text = await readFile(file, 'utf8'); }
        catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
            throw error;
        }
        try { return parseNote(JSON.parse(text)); }
        catch { throw new Error(`Corrupt Dope note: ${file}`); }
    }

    async save(workspaceUri: string, draft: NoteDraft): Promise<Note> {
        if (!draft || typeof draft.title !== 'string' || typeof draft.body !== 'string') throw new Error('Invalid Dope note draft');
        const previous = this.pending.get(workspaceUri) ?? Promise.resolve();
        const work = previous.catch(() => undefined).then(async () => {
            const file = await this.file(workspaceUri);
            const existing = await this.read(workspaceUri);
            const note: Note = { id: existing?.id ?? randomUUID(), schemaVersion: 1, type: 'note', title: draft.title, body: draft.body, provenance: 'developer' };
            await mkdir(dirname(file), { recursive: true });
            const temporary = `${file}.${randomUUID()}.tmp`;
            try {
                await writeFile(temporary, `${JSON.stringify(note, null, 2)}\n`, { flag: 'wx' });
                await rename(temporary, file);
            } finally { await rm(temporary, { force: true }); }
            for (const listener of this.listeners) {
                try { listener(workspaceUri, note); }
                catch { /* A disconnected view cannot turn a committed save into a failed save. */ }
            }
            return note;
        });
        this.pending.set(workspaceUri, work);
        try { return await work; }
        finally { if (this.pending.get(workspaceUri) === work) this.pending.delete(workspaceUri); }
    }
}
