import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, opendir, readdir, realpath, stat } from 'node:fs/promises';
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
    sectionKey: string;
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
    roadmapPath: string;
    sources: RoadmapSource[];
    checkpoints: RoadmapCheckpointPreview[];
    gateSource: RoadmapGateSourcePreview;
    diagnostics: string[];
    mind?: { revision: number; artifactIds: string[] };
}
/** Explicit Markdown grammar; these locations are proof, not qualification evidence. */
export interface RoadmapGateSourcePreview {
    phases: { id: string; sectionKey: string; title: string; objective: string; source: RoadmapCitation }[];
    gates: { id: string; sectionKey: string; parentPhaseId: string; designation: string; title: string;
        purpose: string; criteria: { id: string; sectionKey: string; title: string; expectedResult: string;
            source: RoadmapCitation }[]; source: RoadmapCitation }[];
    corrections: { id: string; sectionKey: string; parent: { kind: 'phase' | 'gate'; id: string };
        title: string; objective: string; source: RoadmapCitation }[];
    diagnostics: string[];
}
export interface RoadmapCandidate {
    path: string;
    sha256: string;
    bytes: number;
}
export interface RoadmapCandidateDiscovery {
    candidates: RoadmapCandidate[];
    diagnostics: string[];
}

const MAX_FILE = 2 * 1024 * 1024;
const MAX_FILES = 512;
const MAX_TOTAL = 32 * 1024 * 1024;
const roadmapPath = 'docs/roadmap/mvp-roadmap.md';
const MAX_CANDIDATES = 64;
const MAX_DIRECTORY_ENTRIES = 512;
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
function genericIdentity(heading: string): { kind: RoadmapCheckpointPreview['kind']; key: string } | undefined {
    const correctionCode = /^Correction\b.*?\b(c\d+-[a-z0-9-]+)\b/i.exec(heading);
    if (correctionCode) return { kind: 'correction', key: correctionCode[1].toLowerCase() };
    const existing = identity(heading);
    if (existing) return existing;
    const phase = /^Phase\s+(\d+)\b/i.exec(heading);
    if (phase) return { kind: 'phase', key: `phase-${phase[1]}` };
    if (/^Correction\b/i.test(heading)) return { kind: 'correction', key: key(heading) };
    if (/^Milestone\b/i.test(heading)) return { kind: 'milestone', key: key(heading) };
    return undefined;
}
/** Share the importer's exact heading identity rule with guarded document patches. */
export function roadmapSectionKey(heading: string, generic: boolean): string | undefined {
    const criterion = /^\s*[-*]\s+Criterion\s+\S+\s*\[id:\s*([a-z0-9][a-z0-9-]*)\]/i.exec(heading);
    if (criterion) return criterion[1].toLowerCase();
    const explicit = /^(?:Phase\s+\d+|Gate\s+G[1-9]\d*|Correction\b[^\[]*)\s*\[id:\s*([a-z0-9][a-z0-9-]*)\]/i.exec(heading);
    if (explicit) return explicit[1].toLowerCase();
    return (generic ? genericIdentity(heading) : identity(heading))?.key;
}
export function parseGateSource(path: string, sha256: string, lines: string[], fenced: Set<number>): RoadmapGateSourcePreview {
    const phases: RoadmapGateSourcePreview['phases'] = [];
    const gates: RoadmapGateSourcePreview['gates'] = [];
    const corrections: RoadmapGateSourcePreview['corrections'] = [];
    const diagnostics: string[] = [];
    const citation = (index: number): RoadmapCitation => ({ path, sha256, line: index + 1, text: lines[index] });
    const sectionIds = new Set<string>();
    const claim = (id: string, line: number): void => {
        if (sectionIds.has(id)) diagnostics.push(`Duplicate section ID ${id} at line ${line}`);
        sectionIds.add(id);
    };
    let currentGate: RoadmapGateSourcePreview['gates'][number] | undefined;
    for (let index = 0; index < lines.length; index++) {
        if (fenced.has(index)) continue;
        const line = lines[index];
        if (/^#{2,3} /.test(line)) currentGate = undefined;
        const phase = /^## Phase\s+\d+\s*\[id:\s*([a-z0-9][a-z0-9-]*)\]\s*:\s*(.+)$/i.exec(line);
        if (phase) {
            const id = phase[1].toLowerCase(); claim(id, index + 1);
            const objective = /^\s*(?:\*\*)?Objective(?:\*\*)?:\s*(.+)$/i.exec(lines[index + 1] ?? '')?.[1];
            if (!objective) diagnostics.push(`Phase ${id} has no explicit objective at line ${index + 1}`);
            phases.push({ id, sectionKey: id, title: phase[2].trim(), objective: objective ?? '', source: citation(index) });
            continue;
        }
        const gate = /^### Gate\s+(G[1-9]\d*)\s*\[id:\s*([a-z0-9][a-z0-9-]*)\]\s*\[phase:\s*([a-z0-9][a-z0-9-]*)\]\s*:\s*(.+)$/i.exec(line);
        if (gate) {
            const id = gate[2].toLowerCase(); claim(id, index + 1);
            const purpose = /^\s*(?:\*\*)?Objective(?:\*\*)?:\s*(.+)$/i.exec(lines[index + 1] ?? '')?.[1];
            if (!purpose) diagnostics.push(`Gate ${id} has no explicit objective at line ${index + 1}`);
            currentGate = { id, sectionKey: id, parentPhaseId: gate[3].toLowerCase(), designation: gate[1].toUpperCase(),
                title: gate[4].trim(), purpose: purpose ?? '', criteria: [], source: citation(index) };
            gates.push(currentGate); continue;
        }
        const correction = /^### Correction\s+(.+?)\s*\[id:\s*([a-z0-9][a-z0-9-]*)\]\s*\[(phase|gate):\s*([a-z0-9][a-z0-9-]*)\]\s*:\s*(.+)$/i.exec(line);
        if (correction) {
            const id = correction[2].toLowerCase(); claim(id, index + 1);
            corrections.push({ id, sectionKey: id, parent: { kind: correction[3].toLowerCase() as 'phase' | 'gate',
                id: correction[4].toLowerCase() }, title: correction[5].trim(), objective: correction[5].trim(), source: citation(index) });
            continue;
        }
        if (/^### Gate\b/i.test(line)) diagnostics.push(`Ambiguous Gate heading at line ${index + 1}: explicit id and phase required`);
        if (/^### Correction\b/i.test(line)) diagnostics.push(`Ambiguous correction owner at line ${index + 1}`);
        const criterion = /^\s*[-*]\s+Criterion\s+\S+\s*\[id:\s*([a-z0-9][a-z0-9-]*)\]\s*:\s*(.+?)\s+[—-]\s+Expected:\s*(.+)$/i.exec(line);
        if (criterion && currentGate) {
            const id = criterion[1].toLowerCase(); claim(id, index + 1);
            currentGate.criteria.push({ id, sectionKey: id, title: criterion[2].trim(), expectedResult: criterion[3].trim(), source: citation(index) });
        } else if (/^\s*[-*]\s+Criterion\b/i.test(line)) diagnostics.push(`Ambiguous criterion at line ${index + 1}`);
    }
    const phaseIds = new Set(phases.map(item => item.id));
    const gateIds = new Set(gates.map(item => item.id));
    for (const gate of gates) {
        if (!phaseIds.has(gate.parentPhaseId)) diagnostics.push(`Gate ${gate.id} has no explicit matching Phase ID at line ${gate.source.line}`);
        if (!gate.criteria.length) diagnostics.push(`Gate ${gate.id} has no testable criteria at line ${gate.source.line}`);
    }
    for (const correction of corrections) if (!(correction.parent.kind === 'phase' ? phaseIds : gateIds).has(correction.parent.id))
        diagnostics.push(`Correction ${correction.id} has no matching owner at line ${correction.source.line}`);
    return { phases, gates, corrections, diagnostics };
}
async function checkedRoot(root: string): Promise<void> {
    if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
        throw new Error('Unsafe roadmap project root');
}

/** Enumerate only conventional root/docs locations; each candidate is bounded and verified before hashing. */
export async function discoverRoadmapCandidates(root: string): Promise<RoadmapCandidateDiscovery> {
    await checkedRoot(root);
    const candidates: RoadmapCandidate[] = [];
    const diagnostics: string[] = [];
    let docsSafe = true;
    for (const directory of ['', 'docs', 'docs/roadmap']) {
        if (directory === 'docs/roadmap' && !docsSafe) continue;
        const base = directory ? join(root, directory) : root;
        if (directory) {
            let info;
            try { info = await lstat(base); }
            catch (error) { if (missing(error)) { if (directory === 'docs') docsSafe = false; continue; } throw error; }
            if (info.isSymbolicLink() || !info.isDirectory()) {
                if (directory === 'docs') docsSafe = false;
                diagnostics.push(`Unsafe candidate directory: ${directory}`); continue;
            }
        }
        const entries = [];
        for await (const entry of await opendir(base)) {
            entries.push(entry);
            if (entries.length > MAX_DIRECTORY_ENTRIES) break;
        }
        if (entries.length > MAX_DIRECTORY_ENTRIES) { diagnostics.push(`Roadmap candidate directory limit exceeded: ${directory || '.'}`); continue; }
        for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            if (!/roadmap/i.test(entry.name) || !/\.md$/i.test(entry.name)) continue;
            const path = directory ? `${directory}/${entry.name}` : entry.name;
            if (!safePath(path) || entry.isSymbolicLink() || !entry.isFile()) { diagnostics.push(`Unsafe candidate skipped: ${path}`); continue; }
            const info = await lstat(join(root, path));
            if (!info.isFile() || info.size > MAX_FILE) { diagnostics.push(`Oversized or unsafe candidate skipped: ${path}`); continue; }
            const handle = await open(join(root, path), constants.O_RDONLY | constants.O_NOFOLLOW);
            let bytes: Buffer;
            try { if (!(await handle.stat()).isFile()) throw new Error(`Unsafe roadmap source path: ${path}`); bytes = await handle.readFile(); }
            finally { await handle.close(); }
            if (bytes.length > MAX_FILE) { diagnostics.push(`Oversized candidate skipped: ${path}`); continue; }
            candidates.push({ path, sha256: hash(bytes), bytes: bytes.length });
            if (candidates.length >= MAX_CANDIDATES) { diagnostics.push('Roadmap candidate limit reached'); return { candidates, diagnostics }; }
        }
    }
    return { candidates, diagnostics };
}
function status(raw: string): RoadmapStatus {
    if (/\bqualification remains not[ -]green\b/i.test(raw)) return 'not-green';
    if (/\bowner.closed for sequencing\b/i.test(raw)) return 'waived';
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
function evidenceVerdict(content: string): { text: string; line: number } | undefined {
    const first = content.split(/\r?\n/).slice(0, 24);
    const line = first.findIndex(value => /(?:^|\*\*)\s*(?:(?:\d{4}-\d{2}-\d{2})\s+)?(?:Status|Disposition|Decision|Result|Verdict):/i.test(value));
    if (line >= 0) return { text: verdict(first[line].trim()), line: line + 1 };
    const heading = first.findIndex(value => /^# /.test(value) && status(value) !== 'unknown');
    return heading >= 0 ? { text: first[heading], line: heading + 1 } : undefined;
}
function evidencePriority(path: string, text: string): number {
    // An explicit final owner disposition supersedes an earlier evidence-only audit.
    if (/\bowner.closed for sequencing\b|\bowner approved\s*\/\s*qualified\s*\/\s*closed\b/i.test(text))
        return /(?:\/closeout|\/final-qualification|\/final-closeout)\.md$/.test(path) ? 4 : 3;
    if (/\/final-closeout\.md$/.test(path)) return 3;
    if (/(?:\/closeout|\/final-qualification|\/final-closeout)\.md$/.test(path)) return 2;
    if (/\bqualified\s*\/\s*closed\b/i.test(text)) return 2;
    return 1;
}

/** Read a bounded, source-backed import proposal. This never initializes or writes any owner. */
export async function previewRoadmapImport(root: string, selectedPath = roadmapPath): Promise<RoadmapImportPreview> {
    await checkedRoot(root);
    if (!safePath(selectedPath) || !/\.md$/i.test(selectedPath)) throw new Error(`Unsafe roadmap source path: ${selectedPath}`);
    const sources: RoadmapSource[] = [];
    const contents = new Map<string, string>();
    const diagnostics: string[] = [];
    let total = 0;
    async function read(path: string, required = false): Promise<void> {
        if (!safePath(path)) throw new Error(`Unsafe roadmap source path: ${path}`);
        if (contents.has(path)) return;
        let current = root;
        for (const part of path.split('/')) {
            current = join(current, part);
            let info;
            try { info = await lstat(current); }
            catch (error) { if (missing(error)) { if (required) throw new Error(`Missing roadmap source: ${path}`); diagnostics.push(`Missing source: ${path}`); return; } throw error; }
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
    await read(selectedPath, true);
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
    for (const match of contents.get(selectedPath)!.matchAll(/docs\/(?:planning|tasks)\/[A-Za-z0-9_./-]+\.md/g)) {
        const path = match[0];
        if (safePath(path) && !contents.has(path)) await read(path);
    }
    const byPath = new Map(sources.map(source => [source.path, source]));
    const text = contents.get(selectedPath)!;
    const generic = selectedPath !== roadmapPath || !/^## Product Phase \d+\b/m.test(text);
    const lines = text.split(/\r?\n/);
    const sections: { line: number; heading: string; end: number }[] = [];
    const fencedLines = new Set<number>();
    let fence: string | undefined;
    for (let index = 0; index < lines.length; index++) {
        const marker = /^\s*(`{3,}|~{3,})/.exec(lines[index]);
        if (marker) {
            fencedLines.add(index);
            if (!fence) fence = marker[1][0];
            else if (fence === marker[1][0]) fence = undefined;
            continue;
        }
        if (fence) {
            fencedLines.add(index);
            if (/^#{2,3} /.test(lines[index])) diagnostics.push(`Unsupported fenced roadmap heading at line ${index + 1}`);
            continue;
        }
        const heading = /^#{2,3} (.+?)\s*$/.exec(lines[index]);
        if (heading) { if (sections.length) sections[sections.length - 1].end = index; sections.push({ line: index + 1, heading: heading[1], end: lines.length }); }
    }
    if (fence) diagnostics.push('Unclosed roadmap Markdown fence');
    const gateSource = parseGateSource(selectedPath, byPath.get(selectedPath)!.sha256, lines, fencedLines);
    const counts = new Map<string, number>();
    for (const section of sections) { const item = generic ? genericIdentity(section.heading) : identity(section.heading); if (item) counts.set(item.key, (counts.get(item.key) ?? 0) + 1); }
    const checkpoints: RoadmapCheckpointPreview[] = [];
    for (const section of sections) {
        const item = generic ? genericIdentity(section.heading) : identity(section.heading);
        if (!item) { if (generic) diagnostics.push(`Unsupported roadmap section at line ${section.line}: ${section.heading}`); continue; }
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
            evidence.push({ path: ref, sha256: source.sha256, line: evidenceStatus?.line ?? 1,
                text: evidenceStatus?.text ?? evidenceText.split(/\r?\n/, 1)[0],
                ...(evidenceStatus ? { status: status(evidenceStatus.text), statusText: evidenceStatus.text } : {}) });
        }
        const decisions = evidence.filter(ref => ref.status && ref.status !== 'unknown' &&
            (/(?:\/closeout|\/final-qualification|\/final-closeout)\.md$/.test(ref.path) ||
                /\bowner.closed for sequencing\b|\bowner approved\s*\/\s*qualified\s*\/\s*closed\b/i.test(ref.statusText ?? '')));
        const priority = Math.max(0, ...decisions.map(ref => evidencePriority(ref.path, ref.statusText ?? '')));
        const latest = decisions.filter(ref => evidencePriority(ref.path, ref.statusText ?? '') === priority);
        const latestStatuses = [...new Set(latest.map(ref => ref.status!))];
        if (decisions.some(ref => ref.status !== resolvedStatus)) localDiagnostics.push('Status differs from linked owner evidence');
        if (new Set(decisions.map(ref => ref.status)).size > 1) localDiagnostics.push('Conflicting historical status evidence');
        if (latestStatuses.length > 1) localDiagnostics.push('Conflicting current owner evidence');
        const effectiveStatus = latestStatuses.length === 1 ? latestStatuses[0] : resolvedStatus;
        const waived = [statusText, ...decisions.map(ref => ref.statusText)].some(value => /\b(waived|waiver|owner.closed for sequencing)\b/i.test(value ?? ''));
        if (statusText) {
            const offset = span.findIndex(line => line.trim() === explicit[0]);
            const source = byPath.get(selectedPath)!;
            evidence.unshift({ path: selectedPath, sha256: source.sha256, line: section.line + offset, text: explicit[0],
                status: resolvedStatus, statusText });
        }
        const source = byPath.get(selectedPath)!;
        checkpoints.push({ id: `roadmap:${selectedPath}#${item.key}`, sectionKey: item.key, kind: item.kind, title: section.heading,
            status: effectiveStatus, roadmapStatus: resolvedStatus, waived, statusText, readOnly: localDiagnostics.length > 0, diagnostics: [...new Set(localDiagnostics)],
            source: { path: selectedPath, sha256: source.sha256, line: section.line, text: lines[section.line - 1] }, evidence });
        if (generic) {
            for (let index = section.line; index < section.end; index++) {
                if (fencedLines.has(index)) continue;
                const checkbox = /^\s*[-*] \[([ xX])\] (.+?)\s*$/.exec(lines[index]);
                if (!checkbox) continue;
                const sectionKey = `${item.key}/checklist-${key(checkbox[2])}`;
                const duplicate = checkpoints.some(checkpoint => checkpoint.sectionKey === sectionKey);
                checkpoints.push({ id: `roadmap:${selectedPath}#${sectionKey}`, sectionKey, kind: 'milestone', title: checkbox[2],
                    status: 'unknown', roadmapStatus: 'unknown', waived: false, readOnly: true,
                    diagnostics: [duplicate ? 'Duplicate checklist item/key' : 'Checklist completion is not qualification status'],
                    source: { path: selectedPath, sha256: source.sha256, line: index + 1, text: lines[index] }, evidence: [] });
                if (duplicate) for (const checkpoint of checkpoints) if (checkpoint.sectionKey === sectionKey)
                    checkpoint.diagnostics = [...new Set([...checkpoint.diagnostics, 'Duplicate checklist item/key'])];
            }
        }
    }
    // A missing Mind is ordinary. read() is deliberately non-initializing.
    const mind = await new ProjectMindStore().read(root);
    return { roadmapPath: selectedPath, sources, checkpoints, gateSource, diagnostics,
        ...(mind ? { mind: { revision: mind.revision, artifactIds: mind.artifacts.map(artifact => artifact.id) } } : {}) };
}
