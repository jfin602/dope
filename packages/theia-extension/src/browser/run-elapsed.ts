export function formatRunElapsed(startedAt: string, endedAt?: string, now = Date.now()): string | undefined {
    const start = Date.parse(startedAt);
    const end = endedAt === undefined ? now : Date.parse(endedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return undefined;
    const seconds = Math.floor(Math.max(0, end - start) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const remainder = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function formatRunElapsedCompact(startedAt: string, now = Date.now()): string | undefined {
    const start = Date.parse(startedAt);
    if (!Number.isFinite(start) || !Number.isFinite(now)) return undefined;
    const seconds = Math.floor(Math.max(0, now - start) / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    const remainder = seconds % 60;
    return `${hours ? `${hours}h` : ''}${hours || minutes ? `${minutes}m` : ''}${remainder}s`;
}
