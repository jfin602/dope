import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { join } from 'node:path';
import type { Artifact } from '@dope/contracts/lib/project-mind';
import { ProjectMindStore } from './project-mind-store';
import type { RoadmapIndex, RoadmapLink } from './roadmap-store';

const issueId = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/;
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');

export type RoadmapOwnerRecord =
    | { owner: 'project-mind'; targetId: string; ownerRevision: number; title: string; status: string; artifact: Artifact; readOnly: false }
    | { owner: 'issue'; targetId: string; sourceHash: string; title: string; status: string; body: string; readOnly: true };

/** Reads original owners. The Roadmap never stores a second copy of either record. */
export class RoadmapOwnerLinks {
    constructor(private readonly mind = new ProjectMindStore()) {}

    private async issues(root: string): Promise<RoadmapOwnerRecord[]> {
        const path = join(root, 'known-issues.md');
        try {
            const info = await lstat(path);
            if (info.isSymbolicLink() || !info.isFile()) throw new Error('Unsafe issue registry');
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
            throw error;
        }
        const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        let bytes: Buffer;
        try {
            if (!(await handle.stat()).isFile()) throw new Error('Unsafe issue registry');
            bytes = await handle.readFile();
        } finally { await handle.close(); }
        if (bytes.length > 2 * 1024 * 1024) throw new Error('Issue registry exceeds read limit');
        const sourceHash = hash(bytes);
        const lines = bytes.toString('utf8').split(/\r?\n/);
        const records: RoadmapOwnerRecord[] = [];
        const seen = new Set<string>();
        let section: 'open' | 'resolved' | undefined;
        let start = -1;
        let current: { id: string; title: string } | undefined;
        const flush = (end: number): void => {
            if (!current) return;
            const body = lines.slice(start + 1, end).join('\n').trim();
            const status = /^- \*\*Status:\*\*\s*(.+)$/m.exec(body)?.[1];
            if (!status) throw new Error(`Unsupported issue record: ${current.id}`);
            records.push({ owner: 'issue', targetId: current.id, sourceHash, title: current.title,
                status, body, readOnly: true });
        };
        for (let i = 0; i < lines.length; i++) {
            const heading = /^## (Open Issues|Resolved Issues)\s*$/.exec(lines[i]);
            if (heading) { flush(i); current = undefined; section = heading[1] === 'Open Issues' ? 'open' : 'resolved'; continue; }
            if (/^## /.test(lines[i])) { flush(i); current = undefined; section = undefined; continue; }
            if (!section || !/^### /.test(lines[i])) continue;
            flush(i); current = undefined;
            const match = /^### ([ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}) — \d{4}-\d\d-\d\d — (.+)$/.exec(lines[i]);
            if (!match || !issueId.test(match[1]) || seen.has(match[1])) throw new Error(`Unsupported or duplicate issue heading at line ${i + 1}`);
            seen.add(match[1]); current = { id: match[1], title: match[2] }; start = i;
        }
        flush(lines.length);
        return records;
    }

    async list(root: string): Promise<RoadmapOwnerRecord[]> {
        const mind = await this.mind.read(root);
        const artifacts: RoadmapOwnerRecord[] = mind ? mind.artifacts
            .filter(artifact => ['idea', 'question', 'decision'].includes(artifact.type))
            .map(artifact => ({ owner: 'project-mind', targetId: artifact.id, ownerRevision: mind.revision,
                title: artifact.title, status: artifact.status, artifact, readOnly: false })) : [];
        return [...artifacts, ...await this.issues(root)];
    }

    async resolve(root: string, link: RoadmapLink): Promise<RoadmapOwnerRecord | undefined> {
        if (link.owner !== 'project-mind' && link.owner !== 'issue') return undefined;
        const record = (await this.list(root)).find(item => item.owner === link.owner && item.targetId === link.targetId);
        if (!record) return undefined;
        return record.owner === 'project-mind'
            ? link.ownerRevision === record.ownerRevision && link.sourceHash === undefined ? record : undefined
            : link.sourceHash === record.sourceHash && link.ownerRevision === undefined ? record : undefined;
    }

    async detached(root: string, roadmap: RoadmapIndex): Promise<RoadmapOwnerRecord[]> {
        const linked = new Set(roadmap.checkpoints.flatMap(checkpoint => checkpoint.links.map(link => `${link.owner}\0${link.targetId}`)));
        return (await this.list(root)).filter(record => (record.owner === 'issue' || record.artifact.type === 'idea') &&
            !linked.has(`${record.owner}\0${record.targetId}`));
    }
}
