export interface ProjectArtifact {
    id: string;
    schemaVersion: 1;
    type: 'note';
    title: string;
    provenance: 'developer';
}

export interface Note extends ProjectArtifact {
    body: string;
}

export interface NoteDraft { title: string; body: string }

export function parseNote(value: unknown): Note {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid Dope note');
    const note = value as Record<string, unknown>;
    if (note.schemaVersion !== 1 || note.type !== 'note' || note.provenance !== 'developer' ||
        typeof note.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(note.id) ||
        typeof note.title !== 'string' || typeof note.body !== 'string' ||
        Object.keys(note).some(key => !['id', 'schemaVersion', 'type', 'title', 'body', 'provenance'].includes(key))) throw new Error('Invalid Dope note');
    return { id: note.id, schemaVersion: 1, type: 'note', title: note.title, body: note.body, provenance: 'developer' };
}
