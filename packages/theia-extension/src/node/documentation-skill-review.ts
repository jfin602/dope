import type { DocumentationDiscovery } from './documentation-discovery';

export interface DocumentationSkillReview {
    report: string;
    changes: { path: string; after: string }[];
}

/** Model output is proposal data only; brokered file reads remain the evidence of inspection. */
export function parseDocumentationSkillReview(output: string, readPaths: readonly string[]): DocumentationSkillReview {
    if (Buffer.byteLength(output, 'utf8') > 60_000) throw new Error('Documentation review output exceeds limit');
    const value: unknown = JSON.parse(output);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid documentation review');
    const record = value as Record<string, unknown>;
    if (Object.keys(record).sort().join(',') !== 'changes,report' ||
        typeof record.report !== 'string' || !record.report.trim() || record.report.length > 4000 ||
        !Array.isArray(record.changes) || record.changes.length > 4)
        throw new Error('Invalid documentation review structure');
    const changes = record.changes.map(change => {
        if (!change || typeof change !== 'object' || Array.isArray(change) ||
            Object.keys(change).sort().join(',') !== 'after,path' ||
            typeof change.path !== 'string' || typeof change.after !== 'string')
            throw new Error('Invalid documentation change');
        return { path: change.path, after: change.after };
    });
    if (changes.length && !readPaths.length) throw new Error('Review needs an actual brokered document read');
    return { report: record.report.trim(), changes };
}

export function documentationCoverage(discovery: DocumentationDiscovery,
    readPaths: readonly string[]): string {
    const paths = [...new Set(readPaths)].sort();
    return `Discovery: ${discovery.enumerated} .md/.txt files enumerated; ${discovery.searched} searched; ` +
        `${paths.length} actually read through the broker${paths.length ? ` (${paths.join(', ')})` : ''}. ` +
        (discovery.omitted.length ? `Omissions: ${discovery.omitted.join('; ')}.` : 'No inventory omissions recorded.');
}
