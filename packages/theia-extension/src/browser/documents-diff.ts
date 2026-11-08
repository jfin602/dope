import type { ChatDocumentationProposal } from '@dope/chat';

export type CompareOperation = 'create' | 'update' | 'delete';
export type CompareStatus = 'applicable' | 'stale' | 'missing' | 'historical' | 'unsupported';
export type CompareSide = 'original' | 'proposed';
export type CompareKind = 'same' | 'added' | 'removed';

/** Offsets are UTF-16 string offsets, suitable for source selection and copying. */
export interface CompareLine {
    kind: CompareKind;
    side: CompareSide;
    text: string;
    start: number;
    end: number;
    line: number;
    anchor: string;
}
export interface CompareFile {
    path: string;
    operation: CompareOperation;
    label: 'Added' | 'Modified' | 'Deleted';
    original: string | null;
    proposed: string | null;
    defaultSide: 'proposed';
    originalLines: CompareLine[];
    proposedLines: CompareLine[];
    sourceDiff: CompareLine[];
}
export interface CompareTreeNode {
    name: string;
    path: string;
    children: CompareTreeNode[];
    file?: CompareFile;
}
export interface DocumentsCompare {
    proposalId: string;
    digest: string;
    status: CompareStatus;
    approvable: boolean;
    files: CompareFile[];
    tree: CompareTreeNode[];
}
export interface VerifiedDocumentsCandidate {
    /** Result from the current documentation owner, for the currently selected project. */
    status: 'applicable' | 'stale' | 'missing';
    projectRoot: string;
    proposal: ChatDocumentationProposal | undefined;
}
export interface CompareFixtureTarget {
    path: string;
    operation: CompareOperation;
    before: string | null;
    after: string | null;
}

function lines(text: string): string[] {
    if (!text) return [];
    const result = text.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/gu);
    return result ?? [];
}

function makeLines(text: string | null, side: CompareSide, path: string): CompareLine[] {
    if (text === null) return [];
    let offset = 0;
    return lines(text).map((value, index) => {
        const start = offset;
        offset += value.length;
        return { kind: 'same', side, text: value, start, end: offset, line: index + 1,
            anchor: `${path}:${side}:${index + 1}` };
    });
}

/** Exact line comparison. A bounded middle prevents quadratic work on pathological files. */
function diff(original: CompareLine[], proposed: CompareLine[]): void {
    let first = 0;
    while (first < original.length && first < proposed.length &&
        original[first].text === proposed[first].text) first++;
    let oldEnd = original.length, newEnd = proposed.length;
    while (oldEnd > first && newEnd > first && original[oldEnd - 1].text === proposed[newEnd - 1].text) {
        oldEnd--; newEnd--;
    }
    const oldLength = oldEnd - first, newLength = newEnd - first;
    if (oldLength * newLength > 250_000) {
        for (let i = first; i < oldEnd; i++) original[i].kind = 'removed';
        for (let i = first; i < newEnd; i++) proposed[i].kind = 'added';
        return;
    }
    const table: number[][] = Array.from({ length: oldLength + 1 }, () => Array<number>(newLength + 1).fill(0));
    for (let i = oldLength - 1; i >= 0; i--)
        for (let j = newLength - 1; j >= 0; j--)
            table[i][j] = original[first + i].text === proposed[first + j].text ? 1 + table[i + 1][j + 1] :
                Math.max(table[i + 1][j], table[i][j + 1]);
    let i = 0, j = 0;
    while (i < oldLength || j < newLength) {
        if (i < oldLength && j < newLength && original[first + i].text === proposed[first + j].text) { i++; j++; }
        else if (j < newLength && (i === oldLength || table[i][j + 1] >= table[i + 1][j]))
            proposed[first + j++].kind = 'added';
        else original[first + i++].kind = 'removed';
    }
}

function sourceRows(original: CompareLine[], proposed: CompareLine[]): CompareLine[] {
    // LCS alignment keeps unchanged context in order and preserves removed lines.
    const old = original, next = proposed;
    const rows: CompareLine[] = [];
    let i = 0, j = 0;
    while (i < old.length || j < next.length) {
        if (i < old.length && j < next.length && old[i].kind === 'same' && next[j].kind === 'same' &&
            old[i].text === next[j].text) { rows.push(next[j]); i++; j++; continue; }
        if (i < old.length && old[i].kind === 'removed') { rows.push(old[i++]); continue; }
        if (j < next.length && next[j].kind === 'added') { rows.push(next[j++]); continue; }
        // Equivalent lines can be aligned after a preceding insertion/removal.
        if (i < old.length && old[i].kind === 'same') { i++; continue; }
        if (j < next.length) rows.push(next[j++]);
    }
    return rows;
}

export function projectCompareFile(target: CompareFixtureTarget): CompareFile {
    const { path, operation, before, after } = target;
    if (!['create', 'update', 'delete'].includes(operation) ||
        operation === 'create' && (before !== null || after === null) ||
        operation === 'update' && (before === null || after === null) ||
        operation === 'delete' && (before === null || after !== null)) throw new Error('Inconsistent compare target');
    const originalLines = makeLines(before, 'original', path);
    const proposedLines = makeLines(after, 'proposed', path);
    diff(originalLines, proposedLines);
    return { path, operation, label: operation === 'create' ? 'Added' : operation === 'update' ? 'Modified' : 'Deleted',
        original: before, proposed: after, defaultSide: 'proposed', originalLines, proposedLines,
        sourceDiff: sourceRows(originalLines, proposedLines) };
}

function tree(files: CompareFile[]): CompareTreeNode[] {
    const roots: CompareTreeNode[] = [];
    for (const file of files) {
        let level = roots, path = '';
        for (const part of file.path.split('/')) {
            path = path ? `${path}/${part}` : part;
            let node = level.find(item => item.name === part);
            if (!node) { node = { name: part, path, children: [] }; level.push(node); }
            if (path === file.path) node.file = file;
            level = node.children;
        }
    }
    const sort = (items: CompareTreeNode[]): void => {
        items.sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name));
        items.forEach(item => sort(item.children));
    };
    sort(roots);
    return roots;
}

/** No source read or authority decision occurs here. The caller supplies owner-checked applicability. */
export function projectDocumentsCompare(candidate: VerifiedDocumentsCandidate): DocumentsCompare {
    const proposal = candidate.proposal;
    const status: CompareStatus = !proposal || candidate.status === 'missing' ? 'missing' :
        proposal.dependencySnapshotVersion !== 1 ? 'historical' :
            candidate.status === 'stale' || proposal.root !== candidate.projectRoot ? 'stale' :
                proposal.targets.some(target => (target as { operation: string }).operation === 'delete') ? 'unsupported' :
                    'applicable';
    const files = proposal?.targets.map(target => projectCompareFile({ path: target.path,
        operation: target.operation as CompareOperation, before: target.before,
        after: (target as { after: string | null }).after })) ?? [];
    return { proposalId: proposal?.id ?? '', digest: proposal?.digest ?? '', status,
        approvable: status === 'applicable', files, tree: tree(files) };
}
