import type { DocumentationDiscovery } from './documentation-discovery';
import { readDocumentationBasis } from './documentation-review';
import type { ChatDocumentationProposal } from '@dope/chat';

export type DocumentationSkillChange = { path: string; after: string } |
    { path: string; replace: { before: string; after: string } } | { path: string; remove: true };
export interface DocumentationReadPage { path: string; offset: number; endOffset: number;
    fileBytes: number; sourceHash: string; fullHash?: string; text: string }

export interface DocumentationSkillReview {
    final_response: string;
    report: string;
    changes: DocumentationSkillChange[];
}

function singleReviewObject(output: string): unknown {
    try { return JSON.parse(output); }
    catch { /* A local model may wrap its one JSON result in prose or a code fence. */ }
    const candidates: unknown[] = [];
    let start = -1, depth = 0, quoted = false, escaped = false;
    for (let index = 0; index < output.length; index++) {
        const character = output[index];
        if (start < 0) { if (character === '{') { start = index; depth = 1; } continue; }
        if (quoted) {
            if (escaped) escaped = false;
            else if (character === '\\') escaped = true;
            else if (character === '"') quoted = false;
        } else if (character === '"') quoted = true;
        else if (character === '{') depth++;
        else if (character === '}' && --depth === 0) {
            try {
                const candidate: unknown = JSON.parse(output.slice(start, index + 1));
                if (candidate && typeof candidate === 'object' && !Array.isArray(candidate) &&
                    'final_response' in candidate && 'report' in candidate && 'changes' in candidate) candidates.push(candidate);
            } catch { /* Malformed wrapper text is not a proposal. */ }
            start = -1;
        }
    }
    if (candidates.length !== 1) throw new Error('Documentation review needs exactly one valid JSON object');
    return candidates[0];
}

/** Model output is proposal data only; brokered file reads remain the evidence of inspection. */
export function parseDocumentationSkillReview(output: string, readPaths: readonly string[], revision = false): DocumentationSkillReview {
    if (Buffer.byteLength(output, 'utf8') > 60_000) throw new Error('Documentation review output exceeds limit');
    const value = singleReviewObject(output);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid documentation review');
    const record = value as Record<string, unknown>;
    if (Object.keys(record).sort().join(',') !== 'changes,final_response,report' ||
        typeof record.final_response !== 'string' || !record.final_response.trim() ||
        record.final_response.length > 16_000 ||
        typeof record.report !== 'string' || !record.report.trim() || record.report.length > 4000 ||
        !Array.isArray(record.changes) || record.changes.length > 4)
        throw new Error('Invalid documentation review structure');
    const changes = record.changes.map(change => {
        if (!change || typeof change !== 'object' || Array.isArray(change) ||
            typeof change.path !== 'string')
            throw new Error('Invalid documentation change');
        if (Object.keys(change).sort().join(',') === 'after,path' && typeof change.after === 'string')
            return { path: change.path, after: change.after };
        if (revision && Object.keys(change).sort().join(',') === 'path,remove' && change.remove === true)
            return { path: change.path, remove: true as const };
        if (Object.keys(change).sort().join(',') === 'path,replace' && change.replace &&
            typeof change.replace === 'object' && !Array.isArray(change.replace) &&
            Object.keys(change.replace).sort().join(',') === 'after,before' &&
            typeof change.replace.before === 'string' && !!change.replace.before &&
            typeof change.replace.after === 'string')
            return { path: change.path, replace: change.replace as { before: string; after: string } };
        throw new Error('Invalid documentation change');
    });
    if (changes.length && !readPaths.length && !revision) throw new Error('Review needs an actual brokered document read');
    return { final_response: record.final_response, report: record.report.trim(), changes };
}

/** A small exact replacement keeps untouched bytes out of model output and within the saved proposal. */
export async function materializeDocumentationChanges(root: string, changes: readonly DocumentationSkillChange[],
    pages: readonly DocumentationReadPage[]): Promise<{ path: string; after: string }[]> {
    const result: { path: string; after: string }[] = [];
    for (const change of changes) {
        if ('remove' in change) throw new Error('Removal only applies to an existing proposal revision');
        if ('after' in change) { result.push(change); continue; }
        const basis = await readDocumentationBasis(root, change.path);
        if (basis.before === null) throw new Error(`Incomplete review: update source missing: ${change.path}`);
        const { before, after } = change.replace;
        if (basis.before.split(before).length !== 2 ||
            !pages.some(page => page.path === change.path && page.text.includes(before)))
            throw new Error(`Incomplete review: exact replacement was not uniquely observed: ${change.path}`);
        result.push({ path: change.path, after: basis.before.replace(before, after) });
    }
    return result;
}

/** Revision operations edit the saved candidate; omitted targets retain their exact proposed bytes. */
export async function materializeDocumentationRevision(root: string, prior: ChatDocumentationProposal,
    changes: readonly DocumentationSkillChange[], pages: readonly DocumentationReadPage[]):
    Promise<{ path: string; after: string }[]> {
    if (!changes.length || new Set(changes.map(item => item.path)).size !== changes.length)
        throw new Error('Revision needs distinct changes to the selected proposal');
    const next = new Map(prior.targets.map(target => [target.path, target.after]));
    for (const change of changes) {
        const proposed = next.get(change.path);
        if ('remove' in change) {
            if (proposed === undefined) throw new Error(`Cannot remove a file outside the selected proposal: ${change.path}`);
            next.delete(change.path);
        } else if ('replace' in change) {
            if (proposed === undefined) {
                const [materialized] = await materializeDocumentationChanges(root, [change], pages);
                next.set(change.path, materialized.after);
            } else {
                if (proposed.split(change.replace.before).length !== 2)
                    throw new Error(`Proposed excerpt is not unique: ${change.path}`);
                next.set(change.path, proposed.replace(change.replace.before, change.replace.after));
            }
        } else next.set(change.path, change.after);
    }
    if (!next.size) throw new Error('Revision must retain at least one proposed file');
    if (next.size === prior.targets.length && [...next].every(([path, after]) =>
        prior.targets.some(target => target.path === path && target.after === after)))
        throw new Error('Revision made no change to the selected proposal');
    for (const [path] of next) {
        if (!prior.targets.some(target => target.path === path)) {
            const basis = await readDocumentationBasis(root, path);
            if (basis.before !== null && !pages.some(page => page.path === path))
                throw new Error(`New update target was not read through the broker: ${path}`);
        }
    }
    return [...next].map(([path, after]) => ({ path, after }));
}

/** Fail closed when the requested create/update set or a named late source was not inspected. */
export function requireCompleteDocumentationReview(objective: string, discovery: DocumentationDiscovery,
    changes: readonly { path: string }[], pages: readonly DocumentationReadPage[]): void {
    const requested = objective.split(/\/docs-review\b/u).at(-1) ?? objective;
    const paths = [...requested.matchAll(/(?:^|[\s`'"(])([\w-]+(?:\/[\w.-]+)*\.(?:md|txt))\b/giu)]
        .map(match => match[1]).filter(path => path.includes('/'));
    const created = /\bcreat(?:e|ing)\b/iu.test(requested);
    const updated = /\bupdat(?:e|ing)\b/iu.test(requested);
    const required = new Set<string>();
    // Collect every named create target, including lists, before source citations begin.
    // A path after "from", "containing", or "read" is evidence, not another target.
    const createClauses = [...requested.matchAll(/\bcreat(?:e|ing)\b([\s\S]*?)(?=\b(?:from|based\s+on|using|containing|with|read|consult|reference|per|updat(?:e|ing)|creat(?:e|ing))\b|;|\.(?=\s)|$)/giu)]
        .map(match => match[1]);
    const explicitCreates = createClauses.flatMap(clause =>
        [...clause.matchAll(/(?:^|[\s`'"(])([\w-]+(?:\/[\w.-]+)*\.(?:md|txt))\b/giu)]
            .map(match => match[1]).filter(path => path.includes('/')));
    if (created) explicitCreates.forEach(path => required.add(path));
    if (updated) {
        const explicitUpdates = [...requested.matchAll(/\bupdat(?:e|ing)\s+(?:the\s+)?([\w-]+(?:\/[\w.-]+)*\.(?:md|txt))\b/giu)]
            .map(match => match[1]);
        if (explicitUpdates.some(path => !discovery.candidates.some(item => item.path === path && !item.historical)))
            throw new Error('Incomplete review: requested update source not discovered');
        if (explicitUpdates.length) explicitUpdates.forEach(path => required.add(path));
        else {
            const namedCurrent = paths.filter(path => !explicitCreates.includes(path) &&
                discovery.candidates.some(item => item.path === path && !item.historical));
            if (namedCurrent.length) namedCurrent.forEach(path => required.add(path));
            else {
                const candidate = discovery.candidates.find(item => !item.historical &&
                    !required.has(item.path) && item.score > 0);
                if (candidate) required.add(candidate.path);
            }
        }
    }
    for (const path of required) if (!changes.some(change => change.path === path))
        throw new Error(`Incomplete review: required target omitted: ${path}`);
    if (updated && !changes.some(change => pages.some(page => page.path === change.path)))
        throw new Error('Incomplete review: updated source was not read');
    if (/\blate\b/iu.test(requested)) {
        const late = [...required].find(path => pages.some(page => page.path === path));
        if (late && !pages.some(page => page.path === late &&
            page.endOffset > Math.max(4096, page.fileBytes - 4096)))
            throw new Error(`Incomplete review: late section not read: ${late}`);
    }
}

export function documentationCoverage(discovery: DocumentationDiscovery,
    readPaths: readonly string[]): string {
    const paths = [...new Set(readPaths)].sort();
    return `Discovery: ${discovery.enumerated} .md/.txt files enumerated; ${discovery.searched} searched; ` +
        `${paths.length} actually read through the broker${paths.length ? ` (${paths.join(', ')})` : ''}. ` +
        (discovery.omitted.length ? `Omissions: ${discovery.omitted.join('; ')}.` : 'No inventory omissions recorded.');
}
