import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, readdir, realpath, stat } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { ProjectMindStore } from './project-mind-store';

export type RoadmapStatus = 'green' | 'not-green' | 'not-implemented' | 'waived' | 'active' | 'unknown';
export interface RoadmapSource {
    path: string;
    sha256: string;
    bytes: number;
}
export interface RoadmapCitation { path: string; sha256: string; line: number; text: string; status?: RoadmapStatus; statusText?: string }
export interface RoadmapCheckpointPreview {
    id: string;
    kind: 'phase' | 'correction' | 'milestone';
    title: string;
    status: RoadmapStatus;
    roadmapStatus: RoadmapStatus;
    waived: boolean;
    statusText?: string;
    readOnly: boolean;
    diagnostics: string[];
    source: RoadmapCitation;
    evidence: RoadmapCitation[];
}
export interface RoadmapImportPreview {
    sources: RoadmapSource[];
    checkpoints: RoadmapCheckpointPreview[];
    diagnostics: string[];
    mind?: { revision: number; artifactIds: string[] };
}

const MAX_FILE = 2 * 1024 * 1024;
const MAX_FILES = 512;
const MAX_TOTAL = 32 * 1024 * 1024;
const roadmapPath = 'docs/roadmap/mvp-roadmap.md';
const safePath = (path: string): boolean => path.length > 0 && !isAbsolute(path) && !path.includes('\\') && !path.includes('\0') && !path.includes(':') &&
    path.split('/').every(part => part !== '' && part !== '.' && part !== '..');
const hash = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const missing = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';

function key(heading: string): string {
    return heading.toLowerCase().replace(/`/g, '').normalize('NFKC').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function identity(heading: string): { kind: RoadmapCheckpointPreview['kind']; key: string } | undefined {
    const phase = /^Product Phase (\d+)\b/i.exec(heading);
    if (phase) return { kind: 'phase', key: `phase-${phase[1]}` };
    if (/^Foundation Spike 0\b/i.test(heading)) return { kind: 'phase', key: 'foundation-spike-0' };
    const correction = /`(c[0-9]+-[a-z0-9-]+)`/.exec(heading);
    if (correction) return { kind: 'correction', key: correction[1] };
    const namedCorrection = /^(c[0-9]+-[a-z0-9-]+)\b/i.exec(heading);
    if (namedCorrection) return { kind: 'correction', key: namedCorrection[1].toLowerCase() };
    if (/\bcorrection\b/i.test(heading)) return { kind: 'correction', key: key(heading) };
    return undefined;
}
function status(raw: string): RoadmapStatus {
    if (/\b(not[ -]green|not qualified|unqualified|failed)\b/i.test(raw) && !/\bnot (?:implemented|activated) or qualified\b/i.test(raw)) return 'not-green';
    if (/\b(not implemented|not activated|not executed)\b/i.test(raw)) return 'not-implemented';
    if (/\b(waived|waiver|owner.closed for sequencing)\b/i.test(raw)) return 'waived';
    if (/\b(green|qualified)\b/i.test(raw)) return 'green';
    if (/\b(active|activated|in progress)\b/i.test(raw)) return 'active';
    return 'unknown';
}
function verdict(line: string): string {
    const trimmed = line.trim();
    const first = trimmed.indexOf('**');
    if (first < 0) return trimmed;
    const closing = trimmed.indexOf('**', first + 2);
    if (closing < 0) return trimmed;
    const prefix = trimmed.slice(0, closing + 2);
    if (first !== 0) return prefix;
    const suffix = trimmed.slice(closing + 2).trimStart();
    if (suffix.startsWith('**')) {
        const next = suffix.indexOf('**', 2);
        if (next >= 0) return `${prefix} ${suffix.slice(0, next + 2)}`;
    }
    return prefix;
}
function evidenceVerdict(content: string): string | undefined {
    const first = content.split(/\r?\n/).slice(0, 24);
    const explicit = first.find(line => /^(?:\*\*)?(?:Status|Disposition):/i.test(line.trim()));
    if (explicit) return verdict(explicit);
    const heading = first.find(line => /^# /.test(line));
    return heading && status(heading) !== 'unknown' ? heading : undefined;
}

/** Read a bounded, source-backed import proposal. This never initializes or writes any owner. */
export async function previewRoadmapImport(root: string): Promise<RoadmapImportPreview> {
    if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
        throw new Error('Unsafe roadmap project root');
    const sources: RoadmapSource[] = [];
    const contents = new Map<string, string>();
    const diagnostics: string[] = [];
    let total = 0;
    async function read(path: string, required = false): Promise<void> {
        if (!safePath(path)) throw new Error(`Unsafe roadmap source path: ${path}`);
        let current = root;
        for (const part of path.split('/')) {
            current = join(current, part);
            let info;
            try { info = await lstat(current); }
            catch (error) { if (missing(error) && !required) { diagnostics.push(`Missing source: ${path}`); return; } throw error; }
            if (info.isSymbolicLink()) throw new Error(`Unsafe roadmap source path: ${path}`);
        }
        if (relative(root, current).startsWith(`..${sep}`) || !((await lstat(current)).isFile()))
            throw new Error(`Unsafe roadmap source path: ${path}`);
        const info = await stat(current);
        if (info.size > MAX_FILE || total + info.size > MAX_TOTAL || sources.length >= MAX_FILES)
            throw new Error('Roadmap source inventory limit exceeded');
        const handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW);
        let bytes: Buffer;
        try {
            if (!(await handle.stat()).isFile()) throw new Error(`Unsafe roadmap source path: ${path}`);
            bytes = await handle.readFile();
        } finally { await handle.close(); }
        if (bytes.length > MAX_FILE || total + bytes.length > MAX_TOTAL) throw new Error('Roadmap source inventory limit exceeded');
        total += bytes.length;
        sources.push({ path, sha256: hash(bytes), bytes: bytes.length });
        contents.set(path, bytes.toString('utf8'));
    }
    await read(roadmapPath, true);
    // Walk only the approved source families, with fixed depth and deterministic ordering.
    for (const [directory, depth, accept] of [
        ['docs/planning', 2, (name: string) => name.endsWith('.md')],
        ['docs/tasks', 2, (name: string) => name === 'closeout.md'],
    ] as const) {
        let first;
        try {
            const info = await lstat(join(root, directory));
            if (info.isSymbolicLink() || !info.isDirectory()) throw new Error(`Unsafe roadmap source directory: ${directory}`);
            first = await readdir(join(root, directory), { withFileTypes: true });
        } catch (error) { if (missing(error)) { diagnostics.push(`Missing source directory: ${directory}`); continue; } throw error; }
        for (const entry of first.sort((a, b) => a.name.localeCompare(b.name))) {
            const path = `${directory}/${entry.name}`;
            if (entry.isSymbolicLink()) { diagnostics.push(`Unsafe source skipped: ${path}`); continue; }
            if (entry.isFile() && accept(entry.name)) await read(path);
            if (depth === 2 && entry.isDirectory()) {
                const children = await readdir(join(root, path), { withFileTypes: true });
                for (const child of children.sort((a, b) => a.name.localeCompare(b.name))) {
                    const childPath = `${path}/${child.name}`;
                    if (child.isSymbolicLink()) { diagnostics.push(`Unsafe source skipped: ${childPath}`); continue; }
                    if (child.isFile() && accept(child.name)) await read(childPath);
                }
            }
        }
    }
    await read('known-issues.md');
    for (const match of contents.get(roadmapPath)!.matchAll(/docs\/(?:planning|tasks)\/[A-Za-z0-9_./-]+\.md/g)) {
        const path = match[0];
        if (safePath(path) && !contents.has(path)) await read(path);
    }
    const byPath = new Map(sources.map(source => [source.path, source]));
    const text = contents.get(roadmapPath)!;
    const lines = text.split(/\r?\n/);
    const sections: { line: number; heading: string; end: number }[] = [];
    let fence: string | undefined;
    for (let index = 0; index < lines.length; index++) {
        const marker = /^\s*(`{3,}|~{3,})/.exec(lines[index]);
        if (marker) {
            if (!fence) fence = marker[1][0];
            else if (fence === marker[1][0]) fence = undefined;
            continue;
        }
        if (fence) {
            if (/^#{2,3} /.test(lines[index])) diagnostics.push(`Unsupported fenced roadmap heading at line ${index + 1}`);
            continue;
        }
        const heading = /^#{2,3} (.+?)\s*$/.exec(lines[index]);
        if (heading) { if (sections.length) sections[sections.length - 1].end = index; sections.push({ line: index + 1, heading: heading[1], end: lines.length }); }
    }
    if (fence) diagnostics.push('Unclosed roadmap Markdown fence');
    const counts = new Map<string, number>();
    for (const section of sections) { const item = identity(section.heading); if (item) counts.set(item.key, (counts.get(item.key) ?? 0) + 1); }
    const checkpoints: RoadmapCheckpointPreview[] = [];
    for (const section of sections) {
        const item = identity(section.heading);
        if (!item) continue;
        const span = lines.slice(section.line, section.end);
        const explicit = span.slice(0, 12).map(line => line.trim()).filter(line =>
            /^(?:\*\*)?(?:Status|Disposition):/i.test(line) || /^\*\*(?:APPROVED DESIGN|NOT IMPLEMENTED|NOT QUALIFIED|NOT GREEN|GREEN|QUALIFIED)\b/i.test(line));
        const localDiagnostics: string[] = [];
        if ((counts.get(item.key) ?? 0) > 1) localDiagnostics.push('Duplicate checkpoint heading/key');
        if (explicit.length !== 1) localDiagnostics.push(explicit.length ? 'Ambiguous status' : 'Unknown status');
        const statusText = explicit.length === 1 ? verdict(explicit[0]) : undefined;
        const resolvedStatus = statusText ? status(statusText) : 'unknown';
        if (resolvedStatus === 'unknown') localDiagnostics.push('Unknown status');
        if (statusText && /\b(green|qualified)\b/i.test(statusText.replace(/\b(not implemented or qualified|not activated or qualified|not green|not qualified|not implemented|unqualified|failed)\b/ig, '')) &&
            /\b(not green|not qualified|not implemented|unqualified|failed)\b/i.test(statusText))
            localDiagnostics.push('Ambiguous status');
        const evidence: RoadmapCitation[] = [];
        const refs = new Set<string>();
        const natural = item.kind === 'phase' ? `p${item.key.match(/\d+$/)?.[0] ?? '0'}` : item.key;
        for (const source of sources) if (source.path.startsWith(`docs/planning/${natural}/`) || source.path === `docs/tasks/${natural}/closeout.md`)
            refs.add(source.path);
        for (const line of span) for (const match of line.matchAll(/(?:docs\/(?:planning|tasks)\/[A-Za-z0-9_./-]+\.md)/g)) refs.add(match[0]);
        for (const ref of [...refs].sort()) {
            if (!safePath(ref)) { localDiagnostics.push(`Unsafe reference: ${ref}`); continue; }
            const source = byPath.get(ref);
            if (!source) { localDiagnostics.push(`Missing reference: ${ref}`); continue; }
            const evidenceText = contents.get(ref)!;
            const evidenceStatus = evidenceVerdict(evidenceText);
            evidence.push({ path: ref, sha256: source.sha256, line: 1, text: evidenceText.split(/\r?\n/, 1)[0],
                ...(evidenceStatus ? { status: status(evidenceStatus), statusText: evidenceStatus } : {}) });
        }
        const closeout = evidence.filter(ref => /(?:\/closeout|\/final-qualification)\.md$/.test(ref.path) && ref.status && ref.status !== 'unknown');
        const closeoutStatuses = [...new Set(closeout.map(ref => ref.status!))];
        if (closeoutStatuses.some(value => value !== resolvedStatus)) localDiagnostics.push('Status differs from linked closeout evidence');
        if (closeoutStatuses.length > 1) localDiagnostics.push('Conflicting closeout evidence');
        const effectiveStatus = closeoutStatuses.length === 1 ? closeoutStatuses[0] : resolvedStatus;
        const waived = [statusText, ...closeout.map(ref => ref.statusText)].some(value => /\b(waived|waiver|owner.closed for sequencing)\b/i.test(value ?? ''));
        const source = byPath.get(roadmapPath)!;
        checkpoints.push({ id: `roadmap:${roadmapPath}#${item.key}`, kind: item.kind, title: section.heading,
            status: effectiveStatus, roadmapStatus: resolvedStatus, waived, statusText, readOnly: localDiagnostics.length > 0, diagnostics: [...new Set(localDiagnostics)],
            source: { path: roadmapPath, sha256: source.sha256, line: section.line, text: lines[section.line - 1] }, evidence });
    }
    // A missing Mind is ordinary. read() is deliberately non-initializing.
    const mind = await new ProjectMindStore().read(root);
    return { sources, checkpoints, diagnostics, ...(mind ? { mind: { revision: mind.revision, artifactIds: mind.artifacts.map(artifact => artifact.id) } } : {}) };
}
