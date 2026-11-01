import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, realpath, stat } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { parseGateSource } from './roadmap-import';
import type { RoadmapGateIndex, RoadmapGateLinkedDocument } from './roadmap-gate-domain';
import type { GateMappedField } from './roadmap-gate-document';

export interface RoadmapPublicationPreview {
    approvalId: string;
    projectId: string;
    projectRoot: string;
    revision: number;
    path: string;
    content: string;
    sourceHash: string;
    phaseCount: number;
    gateCount: number;
    criterionCount: number;
    warnings: string[];
    sections: RoadmapGateLinkedDocument['sections'];
    fields: GateMappedField[];
}

export const publicationHash = (content: string | Buffer): string =>
    createHash('sha256').update(content).digest('hex');

/** Publication uses a project-root filename so no mutable intermediate directory can redirect creation. */
export async function checkedPublicationDestination(root: string, path: string): Promise<string> {
    if (!isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root ||
        !(await stat(root)).isDirectory() || !path || path.length > 512 || !/\.md$/i.test(path) ||
        isAbsolute(path) || path.includes('\\') || path.includes(':') || /[\x00-\x1f\x7f]/.test(path) ||
        path.includes('/') || path === '.' || path === '..' || path === '.dope')
        throw new Error('Unsafe publication path; choose a project-root .md filename');
    const file = join(root, path);
    try { await lstat(file); throw new Error(`Destination already exists: ${path}. Link/import it or select another path`); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    return file;
}

export async function verifiedPublicationFile(root: string, path: string, expectedHash: string): Promise<boolean> {
    const parent = dirname(join(root, path));
    if (await realpath(root) !== root || await realpath(parent) !== parent) throw new Error('Unsafe publication parent');
    let info;
    try { info = await lstat(join(root, path)); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
    if (!info.isFile() || info.isSymbolicLink() || info.size > 2 * 1024 * 1024)
        throw new Error('Publication destination is unsafe or changed');
    const handle = await open(join(root, path), constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
        const opened = await handle.stat();
        if (!opened.isFile() || opened.ino !== info.ino || opened.dev !== info.dev ||
            publicationHash(await handle.readFile()) !== expectedHash)
            throw new Error('Publication destination differs from approved bytes; review manually');
        return true;
    } finally { await handle.close(); }
}

const line = (value: string, label: string): string => {
    if (!value.trim() || /[\r\n\x00-\x1f]/.test(value))
        throw new Error(`${label} contains unsupported Markdown line breaks or controls`);
    return value;
};
const sorted = <T extends { order: number }>(items: T[]): T[] => [...items].sort((a, b) => a.order - b.order);

/** Deterministic accepted-authority serialization, checked against the existing Gate parser. */
export function serializeRoadmapPublication(index: RoadmapGateIndex, path: string): Omit<RoadmapPublicationPreview, 'approvalId'> {
    if (!index.revision || index.linkedDocument || !index.phases.length || !index.gates.length ||
        index.phases.some(p => p.draftAcceptance !== 'accepted') ||
        index.gates.some(g => g.draftAcceptance !== 'accepted') || index.corrections.length)
        throw new Error('Publish requires accepted Phase/Gate structure with no linked file or Corrections');
    const lines: string[] = ['# Roadmap', ''];
    const warnings: string[] = [];
    for (const [phaseNumber, phase] of sorted(index.phases).entries()) {
        line(phase.id, 'Phase ID'); line(phase.title, 'Phase title'); line(phase.objective, 'Phase objective');
        if (phase.gateSetCoverage.status !== 'approved') warnings.push(`${phase.title}: Gate-set coverage is unreviewed`);
        lines.push(`## Phase ${phaseNumber + 1} [id: ${phase.id}]: ${phase.title}`, `Objective: ${phase.objective}`,
            `Order: ${phase.order}`, `Dependencies: ${phase.dependencies.join(', ') || 'none'}`, '');
        const gates = sorted(index.gates.filter(g => g.parentPhaseId === phase.id));
        if (!gates.length) throw new Error(`Phase ${phase.id} has no accepted Gates`);
        for (const gate of gates) {
            line(gate.id, 'Gate ID'); line(gate.title, 'Gate title'); line(gate.purpose, 'Gate purpose');
            if (!gate.criteria.length) throw new Error(`Gate ${gate.id} has no testable criteria`);
            lines.push(`### Gate ${gate.designation} [id: ${gate.id}] [phase: ${phase.id}]: ${gate.title}`,
                `Objective: ${gate.purpose}`, `Order: ${gate.order}`,
                `Dependencies: ${gate.dependencies.join(', ') || 'none'}`);
            for (const [number, criterion] of sorted(gate.criteria).entries()) {
                line(criterion.id, 'Criterion ID'); line(criterion.title, 'Criterion title');
                line(criterion.expectedResult, 'Criterion expected result');
                lines.push(`- Criterion ${number + 1} [id: ${criterion.id}]: ${criterion.title} — Expected: ${criterion.expectedResult}`);
            }
            lines.push('');
        }
    }
    const content = `${lines.join('\n').trimEnd()}\n`;
    if (Buffer.byteLength(content) > 2 * 1024 * 1024) throw new Error('Roadmap publication exceeds file size limit');
    const sourceHash = publicationHash(content);
    const parsed = parseGateSource(path, sourceHash, content.split('\n'), new Set());
    if (parsed.diagnostics.length) throw new Error(`Generated Roadmap cannot be mapped: ${parsed.diagnostics.join('; ')}`);
    const phases = sorted(index.phases);
    const gates = phases.flatMap(p => sorted(index.gates.filter(g => g.parentPhaseId === p.id)));
    const sourceLines = content.split('\n');
    const metadataMatches = (sourceLine: number, order: number, dependencies: string[]): boolean =>
        sourceLines[sourceLine + 1] === `Order: ${order}` &&
        sourceLines[sourceLine + 2] === `Dependencies: ${dependencies.join(', ') || 'none'}`;
    if (JSON.stringify(parsed.phases.map(p => [p.id, p.title, p.objective])) !==
        JSON.stringify(phases.map(p => [p.id, p.title, p.objective])) ||
        JSON.stringify(parsed.gates.map(g => [g.id, g.parentPhaseId, g.designation, g.title, g.purpose,
            g.criteria.map(c => [c.id, c.title, c.expectedResult])])) !==
        JSON.stringify(gates.map(g => [g.id, g.parentPhaseId, g.designation, g.title, g.purpose,
            sorted(g.criteria).map(c => [c.id, c.title, c.expectedResult])])) ||
        parsed.corrections.length ||
        parsed.phases.some((p, at) => !metadataMatches(p.source.line, phases[at].order, phases[at].dependencies)) ||
        parsed.gates.some((g, at) => !metadataMatches(g.source.line, gates[at].order, gates[at].dependencies)))
        throw new Error('Generated Roadmap failed Phase/Gate/Criterion round trip');
    const sections: RoadmapGateLinkedDocument['sections'] = [
        ...parsed.phases.map(p => ({ sectionKey: p.sectionKey, kind: 'phase' as const, id: p.id })),
        ...parsed.gates.flatMap(g => [{ sectionKey: g.sectionKey, kind: 'gate' as const, id: g.id },
            ...g.criteria.map(c => ({ sectionKey: c.sectionKey, kind: 'criterion' as const, id: c.id }))])];
    const fields: GateMappedField[] = [
        ...parsed.phases.map(p => ({ kind: 'phase' as const, id: p.id, title: p.title, detail: p.objective })),
        ...parsed.gates.flatMap(g => [{ kind: 'gate' as const, id: g.id, title: g.title, detail: g.purpose },
            ...g.criteria.map(c => ({ kind: 'criterion' as const, id: c.id, title: c.title, detail: c.expectedResult }))])];
    return { projectId: index.projectId, projectRoot: index.projectRoot, revision: index.revision,
        path, content, sourceHash, phaseCount: phases.length, gateCount: gates.length,
        criterionCount: gates.reduce((n, g) => n + g.criteria.length, 0), warnings, sections, fields };
}
