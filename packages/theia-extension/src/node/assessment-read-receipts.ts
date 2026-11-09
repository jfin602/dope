/** Ephemeral authority for one Assessment execution's verified sequential file reads. */
export interface AssessmentReadContext {
    root: string; projectHandle: string; chatId: string; turnId: string;
    leaseToken: string; ownerId: string;
}

export class AssessmentReadReceipts {
    private readonly pages = new Map<string, { sourceHash: string; nextOffset: number | null;
        expiresAt: number }>();
    constructor(private readonly owner: AssessmentReadContext) {}

    record(page: { path: string; sourceHash: string; nextOffset: number | null }, now = Date.now()): void {
        this.pages.set(page.path, { sourceHash: page.sourceHash, nextOffset: page.nextOffset,
            expiresAt: now + 30 * 60_000 });
    }

    resolve(path: string, offset: number, required: { path: string; coveredBytes: number;
        nextOffset: number | null; expectedSourceHash?: string } | undefined,
        current: AssessmentReadContext, now = Date.now(), active = true): string | undefined {
        if (!active || Object.keys(this.owner).some(key =>
            this.owner[key as keyof AssessmentReadContext] !== current[key as keyof AssessmentReadContext]))
            return undefined;
        const page = this.pages.get(path);
        if (!page || !Number.isSafeInteger(offset) || offset <= 0 ||
            page.expiresAt <= now || page.nextOffset !== offset ||
            required?.path !== path || !required.coveredBytes || required.nextOffset !== offset ||
            required.expectedSourceHash !== page.sourceHash) return undefined;
        return page.sourceHash;
    }
}
