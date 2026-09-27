import type { Note, NoteDraft } from './note';

export const noteServicePath = '/services/dope/note';
export const NoteService = Symbol('NoteService');

export interface NoteClient {
    notifyNoteChanged(workspaceUri: string, note: Note): void;
}

export interface NoteService {
    read(workspaceUri: string): Promise<Note | undefined>;
    save(workspaceUri: string, draft: NoteDraft): Promise<Note>;
}
