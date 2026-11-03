import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, readdir, rm, link } from 'node:fs/promises';
import { join } from 'node:path';
import { parseRoadmapIndex } from './roadmap-store';
import type { RoadmapGateIndex } from './roadmap-gate-domain';

const MAX_SNAPSHOT = 4 * 1024 * 1024;
const MAX_RECORDS = 256;
const MAX_TOTAL = 128 * 1024 * 1024;
const digest = (bytes: Buffer | string): string => createHash('sha256').update(bytes).digest('hex');
const name = (revision: number): string => `r-${String(revision).padStart(12, '0')}.json`;
const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

export interface RoadmapRevisionRecord {
    archiveVersion: 1;
    projectRoot: string;
    projectId: string;
    schemaVersion: 2;
    revision: number;
    hash: string;
    predecessor?: { revision: number; hash: string };
    capturedAt: string;
    provenance: 'baseline' | 'owner-write';
    source?: { path: string; hash: string };
    receipt: { kind: 'baseline' | 'committed-owner-write'; beforeHash?: string; afterHash: string;
        operationIds?: string[] };
    /** Exact canonical JSON bytes, including trailing newline. Historical status and evidence are as-of facts. */
    snapshot: string;
}
export interface RoadmapRevisionList {
    headRevision: number;
    earliestAvailable?: number;
    unavailableBefore: number;
    revisions: Omit<RoadmapRevisionRecord, 'snapshot'>[];
    nextBefore?: number;
    pendingIntent?: { revision: number; hash: string };
}

export class RoadmapRevisionArchive {
    private directory(root: string): string { return join(root, '.dope', 'roadmap-revisions'); }
    private async checkedDirectory(root: string, create = false): Promise<string | undefined> {
        const directory = this.directory(root);
        if (create) {
            try {
                await mkdir(directory, { mode: 0o700 });
                const parent = await open(join(root, '.dope'), 'r');
                try { await parent.sync(); } finally { await parent.close(); }
            } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error; }
        }
        try {
            const info = await lstat(directory);
            if (!info.isDirectory() || info.isSymbolicLink() || info.nlink !== 2)
                throw new Error('Unsafe Roadmap revision archive directory');
            return directory;
        } catch (error) { if (absent(error) && !create) return undefined; throw error; }
    }
    /** Explicit recovery only, under the owner lock. Archive list/fetch never call this. */
    private async discardOrphanedTemps(root: string): Promise<void> {
        const directory = await this.checkedDirectory(root);
        if (!directory) return;
        for (const item of await readdir(directory)) {
            if (!/^\.revision-[a-f0-9-]{36}\.tmp$/.test(item)) continue;
            const path = join(directory, item);
            const info = await lstat(path);
            if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_SNAPSHOT * 2 + 8192)
                throw new Error('Unsafe Roadmap revision staging file');
            await rm(path);
        }
    }
    private async file(root: string, revision: number): Promise<RoadmapRevisionRecord | undefined> {
        const directory = await this.checkedDirectory(root);
        if (!directory) return undefined;
        const path = join(directory, name(revision));
        let handle: Awaited<ReturnType<typeof open>>;
        try { handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW); }
        catch (error) { if (absent(error)) return undefined; throw error; }
        try {
            const info = await handle.stat();
            if (!info.isFile() || info.nlink !== 1 || info.size > MAX_SNAPSHOT * 2 + 8192)
                throw new Error('Unsafe or oversized Roadmap revision record');
            const bytes = await handle.readFile();
            let value: RoadmapRevisionRecord;
            try { value = JSON.parse(bytes.toString('utf8')) as RoadmapRevisionRecord; }
            catch { throw new Error('Corrupt Roadmap revision record'); }
            if (value.archiveVersion !== 1 || value.schemaVersion !== 2 || value.projectRoot !== root ||
                value.revision !== revision || !Number.isSafeInteger(revision) || revision < 1 ||
                typeof value.snapshot !== 'string' || Buffer.byteLength(value.snapshot) > MAX_SNAPSHOT ||
                typeof value.projectId !== 'string' || typeof value.hash !== 'string' ||
                digest(value.snapshot) !== value.hash || !['baseline', 'owner-write'].includes(value.provenance) ||
                !value.receipt || value.receipt.afterHash !== value.hash ||
                !['baseline', 'committed-owner-write'].includes(value.receipt.kind) ||
                value.receipt.kind !== (value.provenance === 'baseline' ? 'baseline' : 'committed-owner-write') ||
                value.receipt.beforeHash !== value.predecessor?.hash ||
                value.predecessor !== undefined && (value.predecessor.revision !== revision - 1 ||
                    !/^[a-f0-9]{64}$/.test(value.predecessor.hash)) ||
                value.receipt.operationIds !== undefined && (!Array.isArray(value.receipt.operationIds) ||
                    value.receipt.operationIds.length > 48 ||
                    value.receipt.operationIds.some(id => typeof id !== 'string' || id.length > 256)))
                throw new Error('Corrupt Roadmap revision record');
            let parsed: RoadmapGateIndex;
            try { parsed = parseRoadmapIndex(JSON.parse(value.snapshot), root); }
            catch { throw new Error('Corrupt Roadmap revision snapshot'); }
            if (parsed.projectId !== value.projectId || parsed.revision !== revision ||
                value.source?.path !== parsed.linkedDocument?.path ||
                value.source?.hash !== parsed.linkedDocument?.sourceHash)
                throw new Error('Roadmap revision identity or source mismatch');
            return value;
        } finally { await handle.close(); }
    }
    private async put(root: string, record: RoadmapRevisionRecord): Promise<void> {
        const directory = await this.checkedDirectory(root, true);
        const target = join(directory!, name(record.revision));
        const existing = await this.file(root, record.revision);
        if (existing) {
            if (existing.hash !== record.hash || existing.projectId !== record.projectId)
                throw new Error('Conflicting Roadmap revision hash');
            if (JSON.stringify(existing.receipt.operationIds) !== JSON.stringify(record.receipt.operationIds))
                throw new Error('Conflicting Roadmap revision receipt');
            return;
        }
        const temporary = join(directory!, `.revision-${randomUUID()}.tmp`);
        try {
            const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL |
                constants.O_NOFOLLOW, 0o600);
            try { await handle.writeFile(`${JSON.stringify(record)}\n`); await handle.sync(); } finally { await handle.close(); }
            // The owner lock serializes writers; hard link prevents replacement of an immutable record.
            await link(temporary, target);
            const parent = await open(directory!, 'r');
            try { await parent.sync(); } finally { await parent.close(); }
        } finally { await rm(temporary, { force: true }); }
    }
    private record(root: string, bytes: Buffer, provenance: RoadmapRevisionRecord['provenance'],
        predecessor?: RoadmapRevisionRecord, operationIds?: string[]): RoadmapRevisionRecord {
        const index = parseRoadmapIndex(JSON.parse(bytes.toString('utf8')), root);
        return { archiveVersion: 1, projectRoot: root, projectId: index.projectId, schemaVersion: 2,
            revision: index.revision, hash: digest(bytes), ...(predecessor ?
                { predecessor: { revision: predecessor.revision, hash: predecessor.hash } } : {}),
            capturedAt: new Date().toISOString(), provenance,
            ...(index.linkedDocument ? { source: { path: index.linkedDocument.path, hash: index.linkedDocument.sourceHash } } : {}),
            receipt: { kind: provenance === 'baseline' ? 'baseline' : 'committed-owner-write',
                ...(predecessor ? { beforeHash: predecessor.hash } : {}), afterHash: digest(bytes),
                ...(operationIds ? { operationIds } : {}) }, snapshot: bytes.toString('utf8') };
    }
    /** Called under the Roadmap owner lock before index rename. An entry beyond the head is an intent, not a committed revision. */
    async prepare(root: string, current: Buffer | undefined, next: Buffer, operationIds?: string[]): Promise<void> {
        const previousIndex = current ? parseRoadmapIndex(JSON.parse(current.toString('utf8')), root) : undefined;
        const nextIndex = parseRoadmapIndex(JSON.parse(next.toString('utf8')), root);
        if (nextIndex.revision !== (previousIndex?.revision ?? 0) + 1)
            throw new Error('Roadmap archive requires a sequential revision');
        if (previousIndex?.revision && nextIndex.projectId !== previousIndex.projectId)
            throw new Error('Roadmap archive owner identity changed');
        await this.discardOrphanedTemps(root);
        const directory = await this.checkedDirectory(root);
        const entries = directory ? await readdir(directory) : [];
        if (entries.some(item => !/^r-\d{12}\.json$/.test(item))) throw new Error('Unsafe Roadmap revision archive entry');
        if (entries.length >= MAX_RECORDS || (await Promise.all(entries.map(async item =>
            (await lstat(join(directory!, item))).size))).reduce((a, b) => a + b, 0) + next.length > MAX_TOTAL)
            throw new Error('Roadmap revision archive quota reached');
        let predecessor: RoadmapRevisionRecord | undefined;
        if (previousIndex?.revision) {
            predecessor = await this.file(root, previousIndex.revision);
            if (!predecessor) {
                if (entries.length) throw new Error('Roadmap revision history gap');
                predecessor = this.record(root, current!, 'baseline');
                await this.put(root, predecessor);
            } else if (predecessor.hash !== digest(current!))
                throw new Error('Roadmap current index differs from archived head');
            else await this.list(root, current, previousIndex.projectId, undefined, 1);
        } else if (entries.length) {
            // A crash before the first index rename may leave only the prepared R1 intent.
            if (entries.length !== 1 || entries[0] !== name(1))
                throw new Error('Unexpected archive for uninitialized Roadmap');
            await this.file(root, 1); // validate before discarding the uncommitted intent
        }
        // A future record may be a prepared intent or evidence of a regressed index.
        // Never erase it automatically: exact retry is safe, conflict blocks for review.
        await this.put(root, this.record(root, next, 'owner-write', predecessor, operationIds));
    }
    async initialize(root: string, current: Buffer): Promise<void> {
        await this.discardOrphanedTemps(root);
        const index = parseRoadmapIndex(JSON.parse(current.toString('utf8')), root);
        if (!index.revision) return;
        const existing = await this.file(root, index.revision);
        if (existing) { if (existing.hash !== digest(current)) throw new Error('Roadmap current index differs from archived head'); return; }
        if ((await this.checkedDirectory(root)) && (await readdir(this.directory(root))).length)
            throw new Error('Roadmap revision history gap');
        await this.put(root, this.record(root, current, 'baseline'));
    }
    async list(root: string, current: Buffer | undefined, projectId: string, before?: number, limit = 50): Promise<RoadmapRevisionList> {
        if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 ||
            before !== undefined && (!Number.isSafeInteger(before) || before < 1))
            throw new Error('Invalid Roadmap revision page');
        const head = current ? parseRoadmapIndex(JSON.parse(current.toString('utf8')), root) : undefined;
        if (!head || head.projectId !== projectId || !head.revision) throw new Error('Foreign or uninitialized Roadmap archive');
        const directory = await this.checkedDirectory(root);
        if (!directory) return { headRevision: head.revision, unavailableBefore: head.revision + 1, revisions: [] };
        const entries = await readdir(directory);
        if (entries.length > MAX_RECORDS || entries.some(item => !/^r-\d{12}\.json$/.test(item)))
            throw new Error('Unsafe Roadmap revision archive entries');
        const sizes = await Promise.all(entries.map(async item => (await lstat(join(directory, item))).size));
        if (sizes.reduce((a, b) => a + b, 0) > MAX_TOTAL) throw new Error('Roadmap revision archive quota exceeded');
        const numbers = entries.map(item => Number(item.slice(2, 14))).filter(value => value <= head.revision).sort((a, b) => a - b);
        const future = entries.map(item => Number(item.slice(2, 14))).filter(value => value > head.revision);
        if (future.length > 1 || future.length && future[0] !== head.revision + 1)
            throw new Error('Roadmap revision archive has an invalid future intent');
        const pending = future.length ? await this.file(root, future[0]) : undefined;
        if (!numbers.length) throw new Error('Roadmap revision archive has no committed baseline');
        for (let i = 1; i < numbers.length; i++) if (numbers[i] !== numbers[i - 1] + 1)
            throw new Error('Roadmap revision history gap');
        const records = await Promise.all(numbers.map(value => this.file(root, value)));
        if (records[0]!.predecessor) throw new Error('Roadmap revision history start is missing');
        for (let i = 0; i < records.length; i++) {
            const record = records[i]!;
            if (record.projectId !== projectId || i && (record.predecessor?.revision !== records[i - 1]!.revision ||
                record.predecessor.hash !== records[i - 1]!.hash)) throw new Error('Roadmap revision chain mismatch');
        }
        if (numbers[numbers.length - 1] !== head.revision || records[records.length - 1]!.hash !== digest(current!))
            throw new Error('Roadmap revision archive head mismatch');
        const selected = records.filter(record => record!.revision < (before ?? head.revision + 1)).slice(-limit).reverse();
        return { headRevision: head.revision, earliestAvailable: numbers[0], unavailableBefore: numbers[0],
            revisions: selected.map(record => { const { snapshot: _snapshot, ...metadata } = record!; return metadata; }),
            ...(pending ? { pendingIntent: { revision: pending.revision, hash: pending.hash } } : {}),
            ...(selected.length && selected[selected.length - 1]!.revision > numbers[0] ?
                { nextBefore: selected[selected.length - 1]!.revision } : {}) };
    }
    async fetch(root: string, current: Buffer | undefined, projectId: string, revision: number): Promise<RoadmapRevisionRecord> {
        if (!Number.isSafeInteger(revision) || revision < 1) throw new Error('Invalid Roadmap revision');
        await this.list(root, current, projectId, undefined, 1);
        const record = await this.file(root, revision);
        if (!record || record.projectId !== projectId || revision > JSON.parse(current!.toString('utf8')).revision)
            throw new Error('Roadmap revision unavailable');
        return record;
    }
}
