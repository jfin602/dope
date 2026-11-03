import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, open, rename, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { checkedRoadmapDocumentFile, publishRoadmapDocumentPatch } from './roadmap-document-patch';
import { readGateMappedDocument, structureDiagnostics } from './roadmap-gate-document';
import { checkedPublicationPath, serializeRoadmapPublication, publicationHash } from './roadmap-publication';
import { parseGateSource } from './roadmap-import';
import type { RoadmapGateIndex, RoadmapGateLinkedDocument } from './roadmap-gate-domain';
import type { GateMappedField } from './roadmap-gate-document';

type Intent = NonNullable<RoadmapGateLinkedDocument['syncIntent']>;
export interface RoadmapAutoSyncJournal {
    version: 1;
    projectId: string;
    intent: Intent;
    status: 'pending' | 'syncing' | 'synced' | 'conflict' | 'failed' | 'recoverable';
    targetHash?: string;
    content?: string;
    sections?: RoadmapGateLinkedDocument['sections'];
    fields?: GateMappedField[];
    reason?: string;
}
const MAX_JOURNAL = 4 * 1024 * 1024;
const digest = (value: string | Buffer): string => createHash('sha256').update(value).digest('hex');
const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const journalPath = (root: string): string => join(root, '.dope', 'roadmap-auto-sync.json');

/** The digest excludes only the self-referential intent; every other canonical field is bound. */
export function autoSyncIndexDigest(index: RoadmapGateIndex): string {
    const copy = structuredClone(index);
    if (copy.linkedDocument) delete copy.linkedDocument.syncIntent;
    return digest(JSON.stringify(copy));
}

export function withAutoSyncIntent(index: RoadmapGateIndex): RoadmapGateIndex {
    const linked = index.linkedDocument;
    if (!linked || linked.pending || index.pendingPublication) return index;
    linked.syncState = 'pending-sync';
    delete linked.syncIntent;
    linked.syncIntent = { revision: index.revision, path: linked.path,
        expectedSourceHash: linked.sourceHash, indexDigest: autoSyncIndexDigest(index) };
    return index;
}

export async function readAutoSyncJournal(root: string): Promise<RoadmapAutoSyncJournal | undefined> {
    const path = journalPath(root);
    let info;
    try { info = await lstat(path); } catch (error) { if (absent(error)) return undefined; throw error; }
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_JOURNAL)
        throw new Error('Unsafe Roadmap sync journal');
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.ino !== info.ino || opened.dev !== info.dev || opened.size > MAX_JOURNAL)
            throw new Error('Roadmap sync journal changed during read');
        const value = JSON.parse((await handle.readFile()).toString('utf8')) as RoadmapAutoSyncJournal;
        if (value.version !== 1 || !value.intent || !Number.isSafeInteger(value.intent.revision) ||
            !/^[a-f0-9]{64}$/.test(value.intent.indexDigest) ||
            !/^[a-f0-9]{64}$/.test(value.intent.expectedSourceHash) ||
            !['pending', 'syncing', 'synced', 'conflict', 'failed', 'recoverable'].includes(value.status) ||
            value.targetHash !== undefined && (!/^[a-f0-9]{64}$/.test(value.targetHash) ||
                typeof value.content !== 'string' || digest(value.content) !== value.targetHash))
            throw new Error('Corrupt Roadmap sync journal');
        return value;
    } finally { await handle.close(); }
}

export function journalMatches(index: RoadmapGateIndex, journal: RoadmapAutoSyncJournal | undefined): boolean {
    const intent = index.linkedDocument?.syncIntent;
    return !!intent && !!journal && journal.projectId === index.projectId &&
        JSON.stringify(journal.intent) === JSON.stringify(intent) &&
        intent.indexDigest === autoSyncIndexDigest(index);
}

export async function writeAutoSyncJournal(root: string, journal: RoadmapAutoSyncJournal): Promise<void> {
    const target = journalPath(root);
    const temporary = join(dirname(target), `roadmap-auto-sync.${randomUUID()}.tmp`);
    const bytes = Buffer.from(`${JSON.stringify(journal)}\n`);
    if (bytes.length > MAX_JOURNAL) throw new Error('Roadmap sync journal exceeds size limit');
    try {
        const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL |
            constants.O_NOFOLLOW, 0o600);
        try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
        const previous = await readAutoSyncJournal(root);
        if (previous && previous.projectId !== journal.projectId)
            throw new Error('Foreign Roadmap sync journal');
        await rename(temporary, target);
        const parent = await open(dirname(target), 'r');
        try { await parent.sync(); } finally { await parent.close(); }
    } finally { await rm(temporary, { force: true }); }
}

/** A journal may outlive a newer index; it never changes the canonical plan by itself. */
export function overlayAutoSync(index: RoadmapGateIndex, journal: RoadmapAutoSyncJournal | undefined): RoadmapGateIndex {
    if (!journalMatches(index, journal)) return index;
    const copy = structuredClone(index);
    const linked = copy.linkedDocument!;
    if (journal!.status === 'synced' && journal!.targetHash && journal!.sections && journal!.fields) {
        linked.sourceHash = journal!.targetHash;
        linked.sections = journal!.sections;
        linked.lastSynced = { sourceHash: journal!.targetHash, fields: journal!.fields };
        linked.syncState = 'synced';
        delete linked.syncIntent;
    } else linked.syncState = journal!.status === 'pending' ? 'pending-sync' : journal!.status;
    return copy;
}

interface PreparedSync { content: string; targetHash: string;
    sections: RoadmapGateLinkedDocument['sections']; fields: GateMappedField[]; before: string }

/** Replace only the mapped grammar. Unmapped prose stays attached to its section, including on moves. */
export async function prepareAutoSync(root: string, index: RoadmapGateIndex): Promise<PreparedSync> {
    const linked = index.linkedDocument;
    if (!linked?.syncIntent || linked.syncIntent.indexDigest !== autoSyncIndexDigest(index))
        throw new Error('Stale Roadmap synchronization revision');
    const source = await checkedRoadmapDocumentFile(root, linked.path);
    if (digest(source.bytes) !== linked.sourceHash) throw new Error('Linked Markdown changed externally');
    const before = source.bytes.toString('utf8');
    if (!Buffer.from(before).equals(source.bytes)) throw new Error('Unsupported linked Markdown encoding');
    const mapped = await readGateMappedDocument(root, linked);
    if (mapped.diagnostics.length || mapped.missingMetadata.length ||
        !linked.lastSynced || JSON.stringify(mapped.fields) !== JSON.stringify(linked.lastSynced.fields))
        throw new Error('Linked Markdown mapping differs from accepted source');
    const generated = serializeRoadmapPublication(index, linked.path, true);
    const lines = before.split(/\r\n|\n|\r/);
    const owned = new Set<number>();
    const byHeading = new Map<number, string>();
    for (const section of linked.sections) {
        const position = mapped.lines.get(`${section.kind}:${section.id}`);
        if (!position) throw new Error('Missing linked Roadmap section');
        owned.add(position.title);
        if (section.kind !== 'criterion') {
            owned.add(position.title + 1);
            if (section.kind === 'phase' || section.kind === 'gate') {
                owned.add(position.title + 2); owned.add(position.title + 3);
            } else owned.add(position.title + 2);
            byHeading.set(position.title, section.id);
        }
    }
    // Preserve every nonblank line outside the accepted grammar. Blank lines are regenerated.
    const notes = new Map<string, string[]>();
    let active = '';
    for (let at = 0; at < lines.length; at++) {
        if (byHeading.has(at)) active = byHeading.get(at)!;
        if (owned.has(at) || at === 0 && lines[at] === '# Roadmap' || !lines[at].trim()) continue;
        const group = notes.get(active) ?? [];
        group.push(lines[at]); notes.set(active, group);
    }
    const generatedLines = generated.content.trimEnd().split('\n');
    const output: string[] = [];
    const used = new Set<string>();
    const emit = (key: string): void => {
        const extras = notes.get(key);
        if (!extras?.length) return;
        output.push('', ...extras, ''); used.add(key);
    };
    let current = '';
    for (const line of generatedLines) {
        const heading = /^#{2,3} (?:Phase|Gate|Correction)\b.*?\[id: ([a-z0-9-]+)\]/i.exec(line);
        if (heading) { emit(current); current = heading[1]; }
        output.push(line);
        if (line === '# Roadmap') emit('');
    }
    emit(current);
    for (const [key, extras] of notes) if (!used.has(key) && key !== current) {
        output.push('', ...extras, '');
    }
    const ending = before.includes('\r\n') ? '\r\n' : '\n';
    const content = `${output.join('\n').trimEnd().replace(/\n/g, ending)}${ending}`;
    if (Buffer.byteLength(content) > 2 * 1024 * 1024) throw new Error('Linked Markdown exceeds size limit');
    const finalLines = content.split(/\r\n|\n|\r/);
    const fenced = new Set<number>();
    let fence: string | undefined;
    finalLines.forEach((value, at) => {
        const marker = /^\s*(`{3,}|~{3,})/.exec(value);
        if (marker) { fenced.add(at); fence = !fence ? marker[1][0] : fence === marker[1][0] ? undefined : fence; }
        else if (fence) fenced.add(at);
    });
    if (fence) throw new Error('Unclosed Markdown fence');
    const parsed = parseGateSource(linked.path, publicationHash(content), finalLines, fenced);
    const identities = [...parsed.phases.map(p => p.id), ...parsed.gates.flatMap(g => [g.id, ...g.criteria.map(c => c.id)]),
        ...parsed.corrections.map(c => c.id)];
    if (parsed.diagnostics.length || identities.length !== generated.sections.length ||
        generated.sections.some(section => !identities.includes(section.id)))
        throw new Error('Synchronized Markdown failed parser identity round trip');
    return { before, content, targetHash: publicationHash(content), sections: generated.sections,
        fields: generated.fields };
}

export async function verifyAutoSync(root: string, index: RoadmapGateIndex,
    journal: RoadmapAutoSyncJournal): Promise<void> {
    if (!journal.targetHash || !journal.sections || !journal.fields) throw new Error('Incomplete Roadmap sync journal');
    const linked = { ...index.linkedDocument!, sourceHash: journal.targetHash,
        sections: journal.sections, lastSynced: { sourceHash: journal.targetHash, fields: journal.fields } };
    const mapped = await readGateMappedDocument(root, linked);
    if (mapped.hash !== journal.targetHash || mapped.diagnostics.length || mapped.missingMetadata.length ||
        structureDiagnostics(index, mapped).length || JSON.stringify(mapped.fields) !== JSON.stringify(journal.fields))
        throw new Error('Written Markdown failed mapping or structure verification');
}

export async function publishAutoSync(root: string, index: RoadmapGateIndex,
    journal: RoadmapAutoSyncJournal): Promise<void> {
    if (!journal.content || !journal.targetHash) throw new Error('Incomplete Roadmap sync journal');
    const linked = index.linkedDocument!;
    const source = await checkedRoadmapDocumentFile(root, linked.path);
    const actual = digest(source.bytes);
    if (actual === journal.targetHash) { await verifyAutoSync(root, index, journal); return; }
    if (actual !== linked.sourceHash) throw new Error('Linked Markdown changed externally');
    await publishRoadmapDocumentPatch(root, {
        path: linked.path, checkpointId: 'automatic-sync', beforeHash: linked.sourceHash,
        afterHash: journal.targetHash, before: source.bytes.toString('utf8'), after: journal.content,
        changedLines: [], requiresApproval: true });
    await verifyAutoSync(root, index, journal);
}

/** The source-aware patcher can be interrupted after moving the old file to its backup. */
export async function recoverAutoSyncBackup(root: string, index: RoadmapGateIndex,
    targetHash?: string): Promise<void> {
    const linked = index.linkedDocument!;
    const file = await checkedPublicationPath(root, linked.path);
    const backup = `${file}.dope-pending-backup`;
    let info;
    try { info = await lstat(backup); } catch (error) { if (absent(error)) return; throw error; }
    if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024)
        throw new Error('Unsafe linked Markdown backup');
    const handle = await open(backup, constants.O_RDONLY | constants.O_NOFOLLOW);
    let backupHash: string;
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.ino !== info.ino || opened.dev !== info.dev)
            throw new Error('Linked Markdown backup changed');
        backupHash = digest(await handle.readFile());
    } finally { await handle.close(); }
    if (backupHash !== linked.sourceHash) throw new Error('Linked Markdown backup differs from accepted source');
    let sourceHash: string | undefined;
    try { sourceHash = digest((await checkedRoadmapDocumentFile(root, linked.path)).bytes); }
    catch (error) { if (!absent(error)) throw error; }
    if (!sourceHash) {
        try { await link(backup, file); }
        catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
        sourceHash = digest((await checkedRoadmapDocumentFile(root, linked.path)).bytes);
    }
    if (sourceHash !== linked.sourceHash && sourceHash !== targetHash)
        throw new Error('Linked Markdown source collision during recovery');
    const parent = await open(dirname(file), 'r');
    try { await parent.sync(); } finally { await parent.close(); }
    await rm(backup);
}
