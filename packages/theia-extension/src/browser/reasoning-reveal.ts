export type ReasoningDisplayMode = 'paragraphs' | 'short-chunks' | 'live-tokens';

/** Presentation-only buffer. The caller continues to receive every provider event immediately. */
export class ReasoningRevealBuffer {
    private sourceLength = 0;
    private pending = '';
    constructor(readonly mode: ReasoningDisplayMode) {}

    update(text: string): string[] {
        if (text.length < this.sourceLength) throw new Error('Reasoning stream changed');
        const delta = text.slice(this.sourceLength);
        this.sourceLength = text.length;
        if (!delta) return [];
        if (this.mode === 'live-tokens') return [delta];
        this.pending += delta;
        const chunks: string[] = [];
        const limit = this.mode === 'short-chunks' ? 180 : 420;
        while (this.pending) {
            const paragraph = paragraphBoundary(this.pending);
            const bounded = this.pending.length >= limit ? boundedBoundary(this.pending, limit) : 0;
            const boundary = paragraph > 0 && paragraph <= limit ? paragraph : bounded || paragraph;
            if (!boundary) break;
            chunks.push(this.pending.slice(0, boundary));
            this.pending = this.pending.slice(boundary);
        }
        return chunks;
    }

    flush(): string[] {
        if (!this.pending) return [];
        const remaining = this.pending;
        this.pending = '';
        return [remaining];
    }

    get bufferedLength(): number { return this.pending.length; }
}

function paragraphBoundary(text: string): number {
    let fenced = false;
    let offset = 0;
    for (const line of text.match(/[^\n]*\n|[^\n]+$/gu) ?? []) {
        if (/^\s*(```|~~~)/u.test(line)) fenced = !fenced;
        offset += line.length;
        if (!fenced && /^\s*\n$/u.test(line) && offset > line.length) {
            // Keep Markdown list items together, including loose lists.
            if (/^\s*(?:[-*+] |\d+[.)] )/u.test(text.slice(offset))) continue;
            return offset;
        }
    }
    return 0;
}

function boundedBoundary(text: string, limit: number): number {
    const prefix = text.slice(0, limit);
    // A partly generated fenced block must remain one Markdown unit.
    if ((prefix.match(/^\s*(```|~~~)/gmu) ?? []).length % 2) return 0;
    const minimum = Math.floor(limit / 2);
    // Lists remain Markdown lists: reveal between items, never inside an item.
    if (/(?:^|\n)\s*(?:[-*+] |\d+[.)] )/u.test(prefix)) {
        let itemBoundary = 0;
        for (const match of prefix.matchAll(/\n(?=\s*(?:[-*+] |\d+[.)] ))/gu))
            if (match.index >= minimum) itemBoundary = match.index + 1;
        return itemBoundary;
    }
    let cut = 0;
    for (const match of prefix.matchAll(/[.!?](?:["')\]]*)\s+/gu)) {
        const end = match.index + match[0].length;
        if (end >= minimum) cut = end;
    }
    if (cut) return cut;
    for (const match of prefix.matchAll(/\s+/gu)) {
        const end = match.index + match[0].length;
        if (end >= minimum) cut = end;
    }
    return cut || limit;
}
