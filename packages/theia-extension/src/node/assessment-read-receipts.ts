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
        const next = this.next(path, required, current, now, active);
        return next?.offset === offset ? next.sourceHash : undefined;
    }

    next(path: string, required: { path: string; coveredBytes: number;
        nextOffset: number | null; expectedSourceHash?: string } | undefined,
        current: AssessmentReadContext, now = Date.now(), active = true):
        { offset: number; sourceHash: string } | undefined {
        if (!active || Object.keys(this.owner).some(key =>
            this.owner[key as keyof AssessmentReadContext] !== current[key as keyof AssessmentReadContext]))
            return undefined;
        const page = this.pages.get(path);
        if (!page || !Number.isSafeInteger(page.nextOffset) || page.nextOffset! <= 0 ||
            page.expiresAt <= now ||
            required?.path !== path || !required.coveredBytes || required.nextOffset !== page.nextOffset ||
            required.expectedSourceHash !== page.sourceHash) return undefined;
        return { offset: page.nextOffset!, sourceHash: page.sourceHash };
    }
}
