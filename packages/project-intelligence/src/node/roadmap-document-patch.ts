import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { RoadmapIndex } from './roadmap-store';
import { roadmapSectionKey } from './roadmap-import';

const MAX_FILE = 2 * 1024 * 1024;
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
export interface RoadmapDocumentEdit { checkpointId: string; sourceHash: string; title?: string; objective?: string; order?: number; prose?: string }
export interface RoadmapDocumentPatch {
    path: string; checkpointId: string; beforeHash: string; afterHash: string;
    before: string; after: string; changedLines: { before: string; after: string }[];
    prose?: string;
    requiresApproval: boolean;
}

export async function checkedRoadmapDocumentFile(root: string, path: string): Promise<{ file: string; directory: string; bytes: Buffer; mode: number }> {
    if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory() ||
        !path || isAbsolute(path) || !/\.md$/i.test(path) || path.includes('\\') || path.includes(':') ||
        path.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe linked Roadmap path');
    let current = root;
    for (const part of path.split('/')) {
        current = join(current, part);
        const info = await lstat(current);
        if (info.isSymbolicLink()) throw new Error('Unsafe linked Roadmap symlink');
    }
    const info = await lstat(current);
    if (!info.isFile() || info.size > MAX_FILE) throw new Error('Unsafe linked Roadmap file');
    const handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.size > MAX_FILE || opened.ino !== info.ino || opened.dev !== info.dev)
            throw new Error('Linked Roadmap changed during read');
        const bytes = await handle.readFile();
        if (bytes.length > MAX_FILE) throw new Error('Linked Roadmap size limit');
        return { file: current, directory: join(current, '..'), bytes, mode: opened.mode & 0o777 };
    } finally { await handle.close(); }
}
const checkedFile = checkedRoadmapDocumentFile;

export async function planRoadmapDocumentPatch(root: string, index: RoadmapIndex, edit: RoadmapDocumentEdit): Promise<RoadmapDocumentPatch> {
    const linked = index.linkedDocument;
    const checkpoint = index.checkpoints.find(item => item.id === edit.checkpointId);
    if (!linked || linked.syncState !== 'synced' || linked.projectRoot !== root || linked.projectId !== index.projectId ||
        linked.lastSynced.sourceHash !== linked.sourceHash || !checkpoint?.source || checkpoint.readOnly ||
        checkpoint.source.path !== linked.path || checkpoint.source.sha256 !== linked.sourceHash ||
        edit.sourceHash !== linked.sourceHash || !linked.sections.some(section => section.checkpointId === edit.checkpointId))
        throw new Error('Stale or unsupported linked Roadmap section');
    if (edit.title === undefined && edit.objective === undefined && edit.order === undefined && edit.prose === undefined)
        throw new Error('Empty linked Roadmap edit');
    if (edit.title !== undefined && (!edit.title.trim() || edit.title.length > 512 || /[\r\n\0]/.test(edit.title)) ||
        edit.objective !== undefined && (edit.objective.length > 8192 || /[\r\n\0]/.test(edit.objective)) ||
        edit.prose !== undefined && (edit.prose.length > 8192 || /[\r\n\0]/.test(edit.prose)) ||
        edit.order !== undefined && (!Number.isSafeInteger(edit.order) || edit.order < 0))
        throw new Error('Invalid linked Roadmap field');
    const source = await checkedFile(root, linked.path);
    if (hash(source.bytes) !== linked.sourceHash) throw new Error('Stale linked Roadmap source fingerprint');
    const before = source.bytes.toString('utf8');
    if (!Buffer.from(before).equals(source.bytes)) throw new Error('Unsupported linked Roadmap encoding');
    const pieces = before.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)!.filter((piece, i, array) => piece || i < array.length - 1);
    const lines = pieces.map(piece => piece.replace(/\r\n|\n|\r$/, ''));
    const line = checkpoint.source.line - 1;
    if (line < 0 || line >= lines.length || lines[line] !== checkpoint.source.text || !/^#{2,3} /.test(lines[line]))
        throw new Error('Stale linked Roadmap section heading');
    let end = line + 1;
    let fence: string | undefined;
    const fenced = new Set<number>();
    for (; end < lines.length; end++) {
        const marker = /^\s*(`{3,}|~{3,})/.exec(lines[end]);
        if (marker) {
            fenced.add(end);
            if (!fence) fence = marker[1][0];
            else if (fence === marker[1][0]) fence = undefined;
            continue;
        }
        if (fence) { fenced.add(end); continue; }
        if (/^#{2,3} /.test(lines[end])) break;
    }
    if (fence) throw new Error('Unsupported unclosed Roadmap fence');
    const changedLines: RoadmapDocumentPatch['changedLines'] = [];
    const replaceLine = (at: number, next: string): void => {
        if (lines[at] !== next) { changedLines.push({ before: lines[at], after: next }); pieces[at] = next + (pieces[at].match(/\r\n|\n|\r$/)?.[0] ?? ''); }
    };
    if (edit.title !== undefined) {
        const prefix = /^#{2,3} /.exec(lines[line])![0];
        const stable = linked.sections.find(section => section.checkpointId === edit.checkpointId)!.sectionKey;
        if (stable.includes('/checklist-')) throw new Error('Title would change Roadmap section identity');
        replaceLine(line, prefix + edit.title);
        const proposed = pieces.join('');
        const generic = linked.path !== 'docs/roadmap/mvp-roadmap.md' || !/^## Product Phase \d+\b/m.test(proposed);
        if (roadmapSectionKey(edit.title, generic) !== stable)
            throw new Error('Title would change Roadmap section identity');
    }
    const mappedLine = (label: 'Objective' | 'Order' | 'Prose'): number => {
        const matches: number[] = [];
        for (let at = line + 1; at < end; at++) if (!fenced.has(at) && new RegExp(`^\\s*${label}:\\s*`, 'i').test(lines[at])) matches.push(at);
        if (matches.length !== 1) throw new Error(`Unsupported or ambiguous Roadmap ${label} field`);
        return matches[0];
    };
    if (edit.objective !== undefined) {
        const at = mappedLine('Objective');
        replaceLine(at, lines[at].replace(/^(\s*Objective:\s*).*/i, (_, prefix: string) => prefix + edit.objective));
    }
    if (edit.prose !== undefined) {
        const at = mappedLine('Prose');
        replaceLine(at, lines[at].replace(/^(\s*Prose:\s*).*/i, (_, prefix: string) => prefix + edit.prose));
    }
    if (edit.order !== undefined) {
        const at = mappedLine('Order');
        if (!/^\s*Order:\s*\d+\s*$/i.test(lines[at])) throw new Error('Unsupported Roadmap Order value');
        replaceLine(at, lines[at].replace(/^(\s*Order:\s*)\d+(\s*)$/i, (_, prefix: string, suffix: string) => prefix + edit.order + suffix));
    }
    if (!changedLines.length) throw new Error('Linked Roadmap edit makes no change');
    const after = pieces.join('');
    if (Buffer.byteLength(after) > MAX_FILE) throw new Error('Linked Roadmap size limit');
    const changedBytes = changedLines.reduce((sum, entry) => sum + Buffer.byteLength(entry.before) + Buffer.byteLength(entry.after), 0);
    return { path: linked.path, checkpointId: edit.checkpointId, beforeHash: linked.sourceHash,
        afterHash: hash(Buffer.from(after)), before, after, changedLines,
        ...(edit.prose !== undefined ? { prose: edit.prose } : {}),
        requiresApproval: changedLines.length > 2 || changedBytes > 2048 || changedBytes > source.bytes.length / 4 };
}

/** The caller holds the Roadmap owner lock. Revalidate the source immediately before atomic publication. */
export async function publishRoadmapDocumentPatch(root: string, patch: RoadmapDocumentPatch): Promise<void> {
    const source = await checkedFile(root, patch.path);
    if (hash(source.bytes) !== patch.beforeHash || source.bytes.toString('utf8') !== patch.before)
        throw new Error('Stale linked Roadmap source fingerprint');
    const temporary = join(source.directory, `.dope-roadmap-${randomUUID()}.tmp`);
    let published = false;
    try {
        const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, source.mode);
        try { await handle.writeFile(patch.after); await handle.chmod(source.mode); await handle.sync(); } finally { await handle.close(); }
        const fresh = await checkedFile(root, patch.path);
        if (hash(fresh.bytes) !== patch.beforeHash || !fresh.bytes.equals(source.bytes))
            throw new Error('Stale linked Roadmap source fingerprint');
        await rename(temporary, source.file);
        published = true;
        const parent = await open(source.directory, 'r');
        try { await parent.sync(); } finally { await parent.close(); }
    } catch (error) {
        if (published) throw new Error(`Linked Roadmap write outcome uncertain; re-read before retrying: ${String(error)}`);
        throw error;
    } finally { await rm(temporary, { force: true }); }
}
