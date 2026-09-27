import type { Note, NoteDraft } from '@dope/contracts/lib/note';
import type { NoteClient, NoteService } from '@dope/contracts/lib/note-service';

export interface NotePersistence extends NoteService {
    onChange(listener: (workspaceUri: string, note: Note) => void): () => void;
}

export class NoteBackend implements NoteService {
    private readonly unlisten: () => void;
    private readonly store: NotePersistence;

    constructor(store: NotePersistence, client: NoteClient) {
        this.store = store;
        this.unlisten = store.onChange((workspaceUri, note) => client.notifyNoteChanged(workspaceUri, note));
    }

    read(workspaceUri: string): Promise<Note | undefined> { return this.store.read(workspaceUri); }
    save(workspaceUri: string, draft: NoteDraft): Promise<Note> { return this.store.save(workspaceUri, draft); }
    dispose(): void { this.unlisten(); }
}
