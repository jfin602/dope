/** Cursor movement uses only a complete, server-verified archive page set. */
export function roadmapHistoryTarget(revisions: readonly number[], head: number, earliest: number,
    cursor: number, direction: -1 | 1): number | undefined {
    if (!Number.isSafeInteger(head) || !Number.isSafeInteger(earliest) || !Number.isSafeInteger(cursor) ||
        head < 1 || earliest < 1 || earliest > head || cursor < earliest || cursor > head ||
        revisions.length !== head - earliest + 1 || revisions.length > 256 ||
        revisions.some((revision, index) => revision !== head - index)) return undefined;
    const next = cursor + direction;
    return next >= earliest && next <= head ? next : undefined;
}
