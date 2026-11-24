import { createHash, randomUUID } from 'node:crypto';

export type ClipboardKind = 'text' | 'image';
export interface ClipboardContent { kind: ClipboardKind; value: string; mime?: 'image/png' }
export interface ClipboardEntry extends ClipboardContent {
    id: string;
    createdAt: number;
    pinned: boolean;
    digest: string;
}
export interface ClipboardSnapshot { entries: ClipboardEntry[]; paused: boolean; limit: number; skipLikelySecrets: boolean }
export interface ClipboardAdapter { read(): ClipboardContent | undefined; write(content: ClipboardContent): void }
export interface ClipboardHistoryStore { read(): Promise<ClipboardSnapshot | undefined>; write(snapshot: ClipboardSnapshot): Promise<void> }

export const MAX_TEXT_LENGTH = 256 * 1024;
export const MAX_IMAGE_BASE64_LENGTH = 2 * 1024 * 1024;
export const MAX_HISTORY_BYTES = 32 * 1024 * 1024;
const privateKey = /-----BEGIN (?:OPENSSH |RSA |EC |DSA )?PRIVATE KEY-----/;
const credential = /(?:^|\n)\s*(?:password|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*\S{8,}/i;
export function likelySecret(text: string): boolean { return privateKey.test(text) || credential.test(text); }
function validContent(content: ClipboardContent | undefined): content is ClipboardContent {
    return !!content && (content.kind === 'text' ? !!content.value && content.value.length <= MAX_TEXT_LENGTH :
        content.kind === 'image' && content.mime === 'image/png' && !!content.value &&
        content.value.length <= MAX_IMAGE_BASE64_LENGTH && /^[A-Za-z0-9+/]+=*$/.test(content.value));
}
function digest(content: ClipboardContent): string {
    return createHash('sha256').update(content.kind).update('\0').update(content.value).digest('hex');
}
function limitValue(value: number): number { return Number.isInteger(value) && value >= 1 && value <= 1000 ? value : 100; }

/** Owns global state; never accepts workspace identifiers or sends data to another service. */
export class ClipboardHistory {
    private snapshotValue: ClipboardSnapshot = { entries: [], paused: false, limit: 100, skipLikelySecrets: true };
    private timer?: ReturnType<typeof setInterval>;
    private lastSeen?: string;
    private saving: Promise<void> = Promise.resolve();
    private revisionValue = 0;
    constructor(private readonly adapter: ClipboardAdapter, private readonly store: ClipboardHistoryStore,
        private readonly intervalMs = 800) {}

    async start(): Promise<void> {
        if (this.timer) return;
        const saved = await this.store.read();
        if (saved) this.snapshotValue = { entries: saved.entries.filter(entry => validContent(entry) &&
            typeof entry.id === 'string' && typeof entry.digest === 'string' && typeof entry.createdAt === 'number')
            .slice(0, 1000), paused: !!saved.paused, limit: limitValue(saved.limit),
            skipLikelySecrets: saved.skipLikelySecrets !== false };
        // Existing clipboard content at launch is not a new copy event.
        let current: ClipboardContent | undefined;
        try { current = this.adapter.read(); } catch { current = undefined; }
        this.lastSeen = validContent(current) ? digest(current) : undefined;
        this.timer = setInterval(() => this.capture(), this.intervalMs);
        this.timer.unref?.();
    }
    stop(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined; }
    async flushed(): Promise<void> { await this.saving; }
    revision(): number { return this.revisionValue; }
    snapshot(): ClipboardSnapshot { return { ...this.snapshotValue, entries: this.snapshotValue.entries.map(entry => ({ ...entry })) }; }
    search(query: string): ClipboardEntry[] {
        const needle = query.trim().toLocaleLowerCase();
        return this.snapshotValue.entries.filter(entry => !needle ||
            (entry.kind === 'text' ? entry.value.toLocaleLowerCase().includes(needle) : 'image'.includes(needle)))
            .map(entry => ({ ...entry }));
    }
    capture(): boolean {
        let content: ClipboardContent | undefined;
        try { content = this.adapter.read(); } catch { return false; }
        const hash = validContent(content) ? digest(content) : undefined;
        if (hash === this.lastSeen) return false;
        this.lastSeen = hash;
        if (!validContent(content) || this.snapshotValue.paused ||
            content.kind === 'text' && this.snapshotValue.skipLikelySecrets && likelySecret(content.value)) return false;
        const previous = this.snapshotValue.entries.find(entry => entry.digest === hash);
        this.snapshotValue.entries = this.snapshotValue.entries.filter(entry => entry.digest !== hash);
        this.snapshotValue.entries.unshift({ ...content, id: previous?.id ?? randomUUID(),
            createdAt: Date.now(), pinned: previous?.pinned ?? false, digest: hash! });
        this.trim(); this.persist(); return true;
    }
    restore(id: string): boolean {
        const index = this.snapshotValue.entries.findIndex(entry => entry.id === id);
        if (index < 0) return false;
        const entry = this.snapshotValue.entries[index];
        this.adapter.write(entry);
        this.lastSeen = entry.digest;
        this.snapshotValue.entries.splice(index, 1);
        this.snapshotValue.entries.unshift({ ...entry, createdAt: Date.now() });
        this.persist(); return true;
    }
    setPaused(paused: boolean): void { this.snapshotValue.paused = paused; this.persist(); }
    setLimit(limit: number): void { if (limitValue(limit) !== limit) throw new Error('Retention must be 1–1000');
        this.snapshotValue.limit = limit; this.trim(); this.persist(); }
    setSkipLikelySecrets(value: boolean): void { this.snapshotValue.skipLikelySecrets = value; this.persist(); }
    pin(id: string, pinned: boolean): boolean { const entry = this.snapshotValue.entries.find(item => item.id === id);
        if (!entry) return false; entry.pinned = pinned; this.trim(); this.persist(); return true; }
    delete(id: string): void { this.snapshotValue.entries = this.snapshotValue.entries.filter(entry => entry.id !== id); this.persist(); }
    clear(): void { this.snapshotValue.entries = []; this.persist(); }
    private trim(): void {
        // Pins survive normal retention, but the hard 1000-entry ceiling still bounds disk use.
        const pinned = this.snapshotValue.entries.filter(entry => entry.pinned);
        const regular = this.snapshotValue.entries.filter(entry => !entry.pinned);
        const allowed = Math.max(0, this.snapshotValue.limit - pinned.length);
        const candidates = [...pinned, ...regular.slice(0, allowed)];
        const keep = new Set<ClipboardEntry>();
        let bytes = 0;
        for (const entry of candidates) {
            const size = Buffer.byteLength(entry.value, 'utf8');
            if (bytes + size > MAX_HISTORY_BYTES) continue;
            bytes += size; keep.add(entry);
        }
        this.snapshotValue.entries = this.snapshotValue.entries.filter(entry => keep.has(entry)).slice(0, 1000);
    }
    private persist(): void { ++this.revisionValue; const snapshot = this.snapshot();
        this.saving = this.saving.catch(() => {}).then(() => this.store.write(snapshot)); }
}
