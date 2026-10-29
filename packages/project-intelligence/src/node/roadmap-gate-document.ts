import { createHash } from 'node:crypto';
import { checkedRoadmapDocumentFile } from './roadmap-document-patch';
import { parseGateSource } from './roadmap-import';
import type { RoadmapGateIndex, RoadmapGateLinkedDocument } from './roadmap-gate-domain';

export type GateSectionKind = RoadmapGateLinkedDocument['sections'][number]['kind'];
export interface GateMappedField { kind: GateSectionKind; id: string; title: string; detail: string }
export interface GateDocumentEdit { kind: 'phase' | 'gate' | 'criterion'; id: string; sourceHash: string;
    title?: string; detail?: string }
export interface GateDocumentPatch { path: string; checkpointId: string; beforeHash: string; afterHash: string;
    before: string; after: string; changedLines: { before: string; after: string }[]; requiresApproval: true;
    edit: GateDocumentEdit; revision: number; projectId: string }
export interface GateDocumentDiff { kind: GateSectionKind; id: string; field: 'title' | 'detail';
    accepted: string; source: string; roadmap: string; conflict: boolean }
export interface GateDocumentSyncPreview { state: 'unchanged' | 'source-changed' | 'conflict' | 'relink-needed';
    projectId: string; revision: number; path: string; acceptedHash: string; sourceHash?: string;
    changes: GateDocumentDiff[]; diagnostics: string[] }
export interface GateDocumentRelinkPreview { state: 'ready' | 'review'; projectId: string; revision: number;
    previousPath: string; path: string; sourceHash?: string; diagnostics: string[] }

const digest = (bytes: Buffer): string => createHash('sha256').update(bytes).digest('hex');
const fieldKey = (kind: GateSectionKind, id: string): string => `${kind}:${id}`;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
export function gateField(index: RoadmapGateIndex, kind: GateSectionKind, id: string): GateMappedField | undefined {
    if (kind === 'phase') { const item = index.phases.find(item => item.id === id);
        return item && { kind, id, title: item.title, detail: item.objective }; }
    if (kind === 'gate') { const item = index.gates.find(item => item.id === id);
        return item && { kind, id, title: item.title, detail: item.purpose }; }
    if (kind === 'criterion') { const item = index.gates.flatMap(gate => gate.criteria).find(item => item.id === id);
        return item && { kind, id, title: item.title, detail: item.expectedResult }; }
    const item = index.corrections.find(item => item.id === id);
    return item && { kind, id, title: item.title, detail: item.objective };
}
/** Parse only the linked file with the importer's exact Gate grammar and stable IDs. */
export async function readGateMappedDocument(root: string, linked: RoadmapGateLinkedDocument): Promise<{
    hash: string; content: string; fields: GateMappedField[]; lines: Map<string, { title: number; detail: number }>;
    diagnostics: string[]; structure: { phases: string[]; gates: { id: string; parentPhaseId: string;
        designation: string; criteria: string[] }[] } }> {
    const source = await checkedRoadmapDocumentFile(root, linked.path);
    const content = source.bytes.toString('utf8');
    if (!Buffer.from(content).equals(source.bytes)) throw new Error('Unsupported linked Roadmap encoding');
    const rawLines = content.split(/\r\n|\n|\r/);
    const fenced = new Set<number>();
    let fence: string | undefined;
    for (let at = 0; at < rawLines.length; at++) {
        const marker = /^\s*(`{3,}|~{3,})/.exec(rawLines[at]);
        if (marker) { fenced.add(at); if (!fence) fence = marker[1][0]; else if (fence === marker[1][0]) fence = undefined; }
        else if (fence) fenced.add(at);
    }
    const parsed = parseGateSource(linked.path, digest(source.bytes), rawLines, fenced);
    const diagnostics = [...parsed.diagnostics];
    if (fence) diagnostics.push('Unclosed Markdown fence');
    for (const section of [...parsed.phases, ...parsed.gates]) {
        const start = section.source.line - 1;
        let end = start + 1;
        while (end < rawLines.length && (fenced.has(end) || !/^#{2,3} /.test(rawLines[end]))) end++;
        const count = rawLines.slice(start + 1, end).filter((line, offset) =>
            !fenced.has(start + 1 + offset) && /^\s*(?:\*\*)?Objective(?:\*\*)?:/i.test(line)).length;
        if (count !== 1) diagnostics.push(`Ambiguous objective for ${section.id}`);
    }
    const byKey = new Map<string, { field: GateMappedField; title: number; detail: number }>();
    for (const phase of parsed.phases) byKey.set(fieldKey('phase', phase.id), { field: {
        kind: 'phase', id: phase.id, title: phase.title, detail: phase.objective },
        title: phase.source.line - 1, detail: phase.source.line });
    for (const gate of parsed.gates) {
        byKey.set(fieldKey('gate', gate.id), { field: { kind: 'gate', id: gate.id, title: gate.title, detail: gate.purpose },
            title: gate.source.line - 1, detail: gate.source.line });
        for (const criterion of gate.criteria) byKey.set(fieldKey('criterion', criterion.id), { field: {
            kind: 'criterion', id: criterion.id, title: criterion.title, detail: criterion.expectedResult },
            title: criterion.source.line - 1, detail: criterion.source.line - 1 });
    }
    for (const correction of parsed.corrections) byKey.set(fieldKey('correction', correction.id), { field: {
        kind: 'correction', id: correction.id, title: correction.title, detail: correction.objective },
        title: correction.source.line - 1, detail: correction.source.line - 1 });
    const fields: GateMappedField[] = [];
    const lines = new Map<string, { title: number; detail: number }>();
    if (byKey.size !== linked.sections.length) diagnostics.push('Linked section set changed; review source identity');
    for (const section of linked.sections) {
        const mapped = byKey.get(fieldKey(section.kind, section.id));
        if (!mapped || section.sectionKey !== section.id) {
            diagnostics.push(`Missing or moved linked ${section.kind}: ${section.id}`); continue;
        }
        fields.push(mapped.field); lines.set(fieldKey(section.kind, section.id), { title: mapped.title, detail: mapped.detail });
    }
    return { hash: digest(source.bytes), content, fields, lines, diagnostics,
        structure: { phases: parsed.phases.map(item => item.id), gates: parsed.gates.map(item => ({
            id: item.id, parentPhaseId: item.parentPhaseId, designation: item.designation,
            criteria: item.criteria.map(criterion => criterion.id) })) } };
}

function structureDiagnostics(index: RoadmapGateIndex, mapped: Awaited<ReturnType<typeof readGateMappedDocument>>): string[] {
    const expected = { phases: [...index.phases].sort((a, b) => a.order - b.order).map(item => item.id),
        gates: [...index.gates].sort((a, b) => index.phases.find(p => p.id === a.parentPhaseId)!.order -
            index.phases.find(p => p.id === b.parentPhaseId)!.order || a.order - b.order).map(item => ({
            id: item.id, parentPhaseId: item.parentPhaseId, designation: item.designation,
            criteria: [...item.criteria].sort((a, b) => a.order - b.order).map(c => c.id) })) };
    return same(expected, mapped.structure) ? [] : ['Phase, Gate or Criterion topology differs from accepted Roadmap'];
}

export async function planGateDocumentPatch(root: string, index: RoadmapGateIndex, edit: GateDocumentEdit): Promise<GateDocumentPatch> {
    const linked = index.linkedDocument;
    if (!linked || linked.projectRoot !== root || linked.projectId !== index.projectId || linked.syncState !== 'synced' ||
        !linked.lastSynced || linked.lastSynced.sourceHash !== linked.sourceHash || edit.sourceHash !== linked.sourceHash ||
        !linked.sections.some(item => item.kind === edit.kind && item.id === edit.id))
        throw new Error('Stale or unsupported linked Gate section');
    if (edit.title === undefined && edit.detail === undefined) throw new Error('Empty linked Gate edit');
    for (const value of [edit.title, edit.detail]) if (value !== undefined &&
        (!value.trim() || value.length > 8192 || /[\r\n\0]/.test(value))) throw new Error('Invalid linked Gate field');
    if (edit.title !== undefined && edit.title.length > 512) throw new Error('Invalid linked Gate title');
    const mapped = await readGateMappedDocument(root, linked);
    if (mapped.hash !== linked.sourceHash || mapped.diagnostics.length || structureDiagnostics(index, mapped).length)
        throw new Error('Stale or ambiguous linked Gate source');
    const basis = linked.lastSynced.fields.find(item => item.kind === edit.kind && item.id === edit.id);
    const current = gateField(index, edit.kind, edit.id);
    if (!basis || !current || !same(basis, current)) throw new Error('Linked Gate field conflict');
    const where = mapped.lines.get(fieldKey(edit.kind, edit.id));
    if (!where) throw new Error('Missing linked Gate section');
    const pieces = mapped.content.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)!.filter((piece, at, all) => piece || at < all.length - 1);
    const lines = pieces.map(piece => piece.replace(/\r\n|\n|\r$/, ''));
    const changedLines: GateDocumentPatch['changedLines'] = [];
    const change = (at: number, next: string): void => {
        if (lines[at] === next) return;
        changedLines.push({ before: lines[at], after: next });
        pieces[at] = next + (pieces[at].match(/\r\n|\n|\r$/)?.[0] ?? '');
        lines[at] = next;
    };
    if (edit.kind === 'phase' || edit.kind === 'gate') {
        if (edit.title !== undefined) {
            const line = lines[where.title];
            const prefix = edit.kind === 'phase' ? /^(## Phase\s+\d+\s*\[id:\s*[a-z0-9-]+\]\s*:\s*)/i :
                /^(### Gate\s+G[1-9]\d*\s*\[id:\s*[a-z0-9-]+\]\s*\[phase:\s*[a-z0-9-]+\]\s*:\s*)/i;
            const match = prefix.exec(line);
            if (!match) throw new Error('Ambiguous linked Gate heading');
            change(where.title, match[1] + edit.title);
        }
        if (edit.detail !== undefined) {
            const line = lines[where.detail];
            const prefix = /^(\s*(?:\*\*)?Objective(?:\*\*)?:\s*)/i;
            const match = prefix.exec(line);
            if (!match) throw new Error('Ambiguous linked Gate objective');
            change(where.detail, match[1] + edit.detail);
        }
    } else {
        const line = lines[where.title];
        const match = /^(\s*[-*]\s+Criterion\s+\S+\s*\[id:\s*[a-z0-9-]+\]\s*:\s*)(.+?)(\s+[—-]\s+Expected:\s*)(.+)$/i.exec(line);
        if (!match) throw new Error('Ambiguous linked Criterion');
        change(where.title, match[1] + (edit.title ?? match[2]) + match[3] + (edit.detail ?? match[4]));
    }
    if (!changedLines.length) throw new Error('Linked Gate edit makes no change');
    const after = pieces.join('');
    if (Buffer.byteLength(after) > 2 * 1024 * 1024) throw new Error('Linked Roadmap size limit');
    const verified = await readGateMappedDocumentFromContent(linked, after);
    if (verified.diagnostics.length || verified.fields.length !== linked.sections.length ||
        !verified.fields.every(field => {
            const old = mapped.fields.find(item => item.kind === field.kind && item.id === field.id)!;
            return field.id === edit.id && field.kind === edit.kind ?
                field.title === (edit.title ?? old.title) && field.detail === (edit.detail ?? old.detail) : same(field, old);
        })) throw new Error('Linked Gate patch changed unmapped structure');
    return { path: linked.path, checkpointId: edit.id, beforeHash: linked.sourceHash, afterHash: digest(Buffer.from(after)),
        before: mapped.content, after, changedLines, requiresApproval: true, edit, revision: index.revision,
        projectId: index.projectId };
}

async function readGateMappedDocumentFromContent(linked: RoadmapGateLinkedDocument, content: string) {
    // Reuse the exact grammar without publishing: the checked source was already read above.
    const lines = content.split(/\r\n|\n|\r/); const fenced = new Set<number>(); let fence: string | undefined;
    lines.forEach((line, at) => { const marker = /^\s*(`{3,}|~{3,})/.exec(line);
        if (marker) { fenced.add(at); fence = !fence ? marker[1][0] : fence === marker[1][0] ? undefined : fence; }
        else if (fence) fenced.add(at); });
    const parsed = parseGateSource(linked.path, digest(Buffer.from(content)), lines, fenced);
    const fields: GateMappedField[] = [...parsed.phases.map(item => ({ kind: 'phase' as const, id: item.id, title: item.title, detail: item.objective })),
        ...parsed.gates.flatMap(item => [{ kind: 'gate' as const, id: item.id, title: item.title, detail: item.purpose },
            ...item.criteria.map(c => ({ kind: 'criterion' as const, id: c.id, title: c.title, detail: c.expectedResult }))]),
        ...parsed.corrections.map(item => ({ kind: 'correction' as const, id: item.id, title: item.title, detail: item.objective }))];
    return { fields, diagnostics: [...parsed.diagnostics, ...(fence ? ['Unclosed Markdown fence'] : [])] };
}

export async function previewGateDocumentSync(root: string, index: RoadmapGateIndex): Promise<GateDocumentSyncPreview> {
    const linked = index.linkedDocument;
    if (!linked || linked.projectRoot !== root || linked.projectId !== index.projectId)
        throw new Error('Roadmap has no linked Gate document for this project');
    const base: GateDocumentSyncPreview = { state: 'unchanged', projectId: index.projectId, revision: index.revision,
        path: linked.path, acceptedHash: linked.sourceHash, changes: [], diagnostics: [] };
    let mapped: Awaited<ReturnType<typeof readGateMappedDocument>>;
    try { mapped = await readGateMappedDocument(root, linked); }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT' || /Unsafe linked Roadmap/.test(String(error)))
            return { ...base, state: 'relink-needed', diagnostics: ['Linked Gate Markdown is missing or unsafe; relink explicitly'] };
        throw error;
    }
    base.sourceHash = mapped.hash;
    if (linked.pending || linked.syncState === 'pending-sync') return { ...base, state: 'conflict', diagnostics: ['Pending document patch requires recovery'] };
    base.diagnostics.push(...mapped.diagnostics, ...structureDiagnostics(index, mapped));
    if (base.diagnostics.length) return { ...base, state: 'conflict' };
    if (!linked.lastSynced || linked.lastSynced.sourceHash !== linked.sourceHash)
        return { ...base, state: 'conflict', diagnostics: ['Accepted mapped basis is unavailable'] };
    const accepted = new Map(linked.lastSynced.fields.map(item => [fieldKey(item.kind, item.id), item]));
    for (const field of mapped.fields) {
        const key = fieldKey(field.kind, field.id);
        const prior = accepted.get(key); const current = gateField(index, field.kind, field.id);
        if (!prior || !current) { base.diagnostics.push(`Missing mapped owner: ${key}`); continue; }
        if (!same(prior, current)) base.diagnostics.push(`Roadmap mapped field changed independently: ${key}`);
        for (const name of ['title', 'detail'] as const) if (field[name] !== prior[name])
            base.changes.push({ kind: field.kind, id: field.id, field: name, accepted: prior[name], source: field[name],
                roadmap: current[name], conflict: current[name] !== prior[name] && current[name] !== field[name] });
    }
    base.state = base.diagnostics.length || base.changes.some(item => item.conflict) ? 'conflict' :
        mapped.hash === linked.sourceHash ? 'unchanged' : 'source-changed';
    return base;
}

export async function previewGateDocumentRelink(root: string, index: RoadmapGateIndex, path: string): Promise<GateDocumentRelinkPreview> {
    const linked = index.linkedDocument;
    if (!linked || linked.projectRoot !== root || linked.projectId !== index.projectId || !linked.lastSynced)
        throw new Error('Roadmap has no accepted linked Gate basis');
    if (linked.pending || linked.syncState === 'pending-sync') throw new Error('Pending Gate patch requires recovery before relink');
    const previous = await previewGateDocumentSync(root, index);
    if (previous.state !== 'relink-needed' || path === linked.path) throw new Error('Linked source is available; reconcile before relink');
    const base: GateDocumentRelinkPreview = { state: 'review', projectId: index.projectId, revision: index.revision,
        previousPath: linked.path, path, diagnostics: [] };
    const mapped = await readGateMappedDocument(root, { ...linked, path });
    base.sourceHash = mapped.hash; base.diagnostics.push(...mapped.diagnostics, ...structureDiagnostics(index, mapped));
    if (mapped.hash !== linked.sourceHash || !same(mapped.fields, linked.lastSynced.fields))
        base.diagnostics.push('Relink candidate differs from accepted source and mapped fields');
    if (!base.diagnostics.length) base.state = 'ready';
    return base;
}
