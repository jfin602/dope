import { createHash } from 'node:crypto';
import { checkedRoadmapDocumentFile } from './roadmap-document-patch';
import { roadmapSectionKey } from './roadmap-import';
import type { RoadmapIndex, RoadmapLinkedDocument } from './roadmap-store';

export interface RoadmapMappedSection {
    checkpointId: string;
    title: string;
    line: number;
    heading: string;
    objective?: string;
    order?: number;
    prose?: string;
}
export interface RoadmapSyncDiff {
    checkpointId: string;
    field: 'title' | 'objective' | 'order' | 'prose';
    accepted: string | number | undefined;
    source: string | number | undefined;
    roadmap: string | number | undefined;
    conflict: boolean;
}
export interface RoadmapSyncPreview {
    state: 'unchanged' | 'source-changed' | 'conflict' | 'relink-needed';
    projectId: string;
    revision: number;
    path: string;
    acceptedHash: string;
    sourceHash?: string;
    changes: RoadmapSyncDiff[];
    diagnostics: string[];
}

const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const fields = ['title', 'objective', 'order', 'prose'] as const;
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

/** Parse only the accepted linked document; never follow references or discover other files. */
export async function readRoadmapMappedSections(root: string, linked: RoadmapLinkedDocument):
    Promise<{ hash: string; sections: RoadmapMappedSection[]; diagnostics: string[] }> {
    const source = await checkedRoadmapDocumentFile(root, linked.path);
    const content = source.bytes.toString('utf8');
    if (!Buffer.from(content).equals(source.bytes)) throw new Error('Unsupported linked Roadmap encoding');
    const lines = content.split(/\r?\n/);
    const generic = linked.path !== 'docs/roadmap/mvp-roadmap.md' || !/^## Product Phase \d+\b/m.test(content);
    const headings: { line: number; key?: string; title: string }[] = [];
    let fence: string | undefined;
    for (let at = 0; at < lines.length; at++) {
        const marker = /^\s*(`{3,}|~{3,})/.exec(lines[at]);
        if (marker) { if (!fence) fence = marker[1][0]; else if (fence === marker[1][0]) fence = undefined; continue; }
        if (fence) continue;
        const heading = /^#{2,3} (.+?)\s*$/.exec(lines[at]);
        if (heading) {
            const key = roadmapSectionKey(heading[1], generic);
            headings.push({ line: at, key, title: heading[1] });
        }
    }
    const diagnostics: string[] = [];
    if (fence) diagnostics.push('Unclosed Markdown fence');
    const sections: RoadmapMappedSection[] = [];
    for (const accepted of linked.sections) {
        const matches = headings.filter(item => item.key === accepted.sectionKey);
        if (matches.length !== 1) { diagnostics.push(`Moved or ambiguous section: ${accepted.sectionKey}`); continue; }
        const heading = matches[0];
        const end = headings.find(item => item.line > heading.line)?.line ?? lines.length;
        const section: RoadmapMappedSection = { checkpointId: accepted.checkpointId, title: heading.title,
            line: heading.line + 1, heading: lines[heading.line] };
        let localFence: string | undefined;
        for (let at = heading.line + 1; at < end; at++) {
            const marker = /^\s*(`{3,}|~{3,})/.exec(lines[at]);
            if (marker) { if (!localFence) localFence = marker[1][0]; else if (localFence === marker[1][0]) localFence = undefined; continue; }
            if (localFence) continue;
            const match = /^\s*(Objective|Order|Prose):\s*(.*?)\s*$/i.exec(lines[at]);
            if (!match) continue;
            const field = match[1].toLowerCase() as 'objective' | 'order' | 'prose';
            if (section[field] !== undefined || (field === 'order' && !/^\d+$/.test(match[2]))) {
                diagnostics.push(`Ambiguous ${field} field: ${accepted.sectionKey}`); continue;
            }
            if (field === 'order') section.order = Number(match[2]);
            else section[field] = match[2];
        }
        if (section.title.length > 512 || section.objective !== undefined && section.objective.length > 8192 ||
            section.prose !== undefined && section.prose.length > 8192 ||
            section.order !== undefined && !Number.isSafeInteger(section.order))
            diagnostics.push(`Invalid mapped field: ${accepted.sectionKey}`);
        sections.push(section);
    }
    return { hash: digest(source.bytes), sections, diagnostics };
}

export async function previewRoadmapDocumentSync(root: string, index: RoadmapIndex): Promise<RoadmapSyncPreview> {
    const linked = index.linkedDocument;
    if (!linked || linked.projectId !== index.projectId || linked.projectRoot !== root)
        throw new Error('Roadmap has no linked document for this project');
    const base: RoadmapSyncPreview = { state: 'unchanged', projectId: index.projectId, revision: index.revision,
        path: linked.path, acceptedHash: linked.lastSynced.sourceHash, changes: [], diagnostics: [] };
    let source: Awaited<ReturnType<typeof readRoadmapMappedSections>>;
    try { source = await readRoadmapMappedSections(root, linked); }
    catch (error) {
        if (missing(error) || /Unsafe linked Roadmap (path|symlink|file)/.test(String(error)))
            return { ...base, state: 'relink-needed', diagnostics: ['Linked Markdown is missing, moved or unsafe; relink explicitly.'] };
        throw error;
    }
    base.sourceHash = source.hash;
    if (linked.syncState === 'pending-sync') return { ...base, state: 'conflict', diagnostics: ['Pending sync requires recovery.'] };
    if (source.diagnostics.length) return { ...base, state: 'conflict', diagnostics: source.diagnostics };
    if (source.hash === linked.sourceHash && linked.syncState === 'synced') return base;
    if (linked.lastSynced.sourceHash !== linked.sourceHash || !linked.lastSynced.fields)
        return { ...base, state: 'conflict', diagnostics: ['Accepted mapped-field basis unavailable or stale; review and relink.'] };
    const accepted = new Map(linked.lastSynced.fields.map(item => [item.checkpointId, item]));
    for (const section of source.sections) {
        const prior = accepted.get(section.checkpointId);
        const current = index.checkpoints.find(item => item.id === section.checkpointId);
        if (!prior || !current) {
            base.diagnostics.push(`Unsupported or changed checkpoint: ${section.checkpointId}`); continue;
        }
        for (const field of fields) {
            const before = prior[field];
            const after = section[field];
            if (before === after) continue;
            const roadmap = field === 'prose' ? before : current[field];
            base.changes.push({ checkpointId: section.checkpointId, field, accepted: before, source: after,
                roadmap, conflict: current.readOnly || (before !== undefined && after === undefined) ||
                    (field !== 'prose' && roadmap !== before && roadmap !== after) });
        }
    }
    if (base.diagnostics.length || base.changes.some(change => change.conflict)) base.state = 'conflict';
    else base.state = 'source-changed';
    return base;
}
