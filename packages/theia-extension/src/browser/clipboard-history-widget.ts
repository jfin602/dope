import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import type { ClipboardEntry, ClipboardSnapshot } from '../clipboard/clipboard-history';
import type { ClipboardHistoryService } from '../clipboard/clipboard-service';

export const CLIPBOARD_HISTORY_ID = 'dope-clipboard-history';
function relativeTime(time: number): string {
    const elapsed = Math.max(0, Date.now() - time);
    if (elapsed < 60_000) return 'just now';
    if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
    if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
    return `${Math.floor(elapsed / 86_400_000)}d ago`;
}
function entryType(entry: ClipboardEntry): string {
    if (entry.kind === 'image') return 'Image';
    if (/^https?:\/\/\S+$/i.test(entry.value)) return 'URL';
    if (/^(?:\/|[A-Za-z]:\\)[^\n]+$/.test(entry.value)) return 'Path';
    return entry.value.includes('\n') ? 'Text / code' : 'Text';
}
function button(label: string, action: () => void): HTMLButtonElement {
    const element = document.createElement('button');
    element.type = 'button'; element.textContent = label; element.title = label;
    element.onclick = event => { event.stopPropagation(); action(); };
    return element;
}

export class ClipboardHistoryWidget extends BaseWidget {
    private readonly toolbar = document.createElement('div');
    private readonly list = document.createElement('div');
    private readonly searchBox = document.createElement('input');
    private readonly status = document.createElement('p');
    private snapshotValue?: ClipboardSnapshot;
    private timer?: ReturnType<typeof setInterval>;
    private busy = false;
    private revisionValue = -1;
    private expanded = new Set<string>();
    constructor(private readonly service?: ClipboardHistoryService) {
        super();
        this.id = CLIPBOARD_HISTORY_ID;
        this.title.label = this.title.caption = 'Clipboard History';
        this.title.iconClass = codicon('clippy');
        this.title.closable = true;
        this.node.tabIndex = 0;
        this.addClass('dope-clipboard-history');
        this.searchBox.type = 'search'; this.searchBox.placeholder = 'Search clipboard history';
        this.searchBox.setAttribute('aria-label', 'Search clipboard history');
        this.searchBox.oninput = () => this.renderList();
        this.toolbar.className = 'dope-clipboard-toolbar';
        this.list.className = 'dope-clipboard-list';
        this.status.setAttribute('role', 'status');
        this.node.append(this.searchBox, this.toolbar, this.status, this.list);
        if (!service) this.status.textContent = 'System clipboard history requires the Dope desktop application.';
    }
    protected override onAfterAttach(msg: unknown): void {
        super.onAfterAttach(msg as never);
        if (this.service) { void this.refresh(); if (this.timer) clearInterval(this.timer);
            this.timer = setInterval(() => void this.refresh(), 1200); }
    }
    protected override onActivateRequest(msg: unknown): void {
        super.onActivateRequest(msg as never);
        this.searchBox.focus({ preventScroll: true });
    }
    protected override onBeforeDetach(msg: unknown): void {
        if (this.timer) clearInterval(this.timer);
        this.timer = undefined;
        super.onBeforeDetach(msg as never);
    }
    async refresh(): Promise<void> {
        if (!this.service || this.busy) return;
        this.busy = true;
        try {
            const revision = await this.service.revision();
            if (revision === this.revisionValue) return;
            const snapshot = await this.service.snapshot();
            if (this.isDisposed) return;
            this.revisionValue = revision;
            this.snapshotValue = snapshot; this.render();
        } catch { this.status.textContent = 'Clipboard History is unavailable. Try reopening the panel.'; }
        finally { this.busy = false; }
    }
    private async change(action: () => Promise<unknown>): Promise<void> {
        try { await action(); await this.refresh(); }
        catch { this.status.textContent = 'Clipboard action failed. Clipboard contents were not changed.'; }
    }
    private render(): void {
        const snapshot = this.snapshotValue;
        if (!snapshot || !this.service) return;
        this.toolbar.replaceChildren();
        this.toolbar.append(button(snapshot.paused ? 'Resume Capture' : 'Pause Capture',
            () => void this.change(() => this.service!.setPaused(!snapshot.paused))),
        button('Clear History', () => void this.change(() => this.service!.clear())));
        const label = document.createElement('label'); label.textContent = 'Keep ';
        const retention = document.createElement('input'); retention.type = 'number';
        retention.min = '1'; retention.max = '1000'; retention.value = String(snapshot.limit);
        retention.setAttribute('aria-label', 'Maximum clipboard entries');
        retention.onchange = () => void this.change(() => this.service!.setLimit(Number(retention.value)));
        label.append(retention); this.toolbar.append(label);
        const privacy = document.createElement('label');
        const skip = document.createElement('input'); skip.type = 'checkbox'; skip.checked = snapshot.skipLikelySecrets;
        skip.onchange = () => void this.change(() => this.service!.setSkipLikelySecrets(skip.checked));
        privacy.append(skip, document.createTextNode(' Skip likely secrets')); this.toolbar.append(privacy);
        this.status.textContent = snapshot.paused ? 'Capture paused' : `${snapshot.entries.length} saved · Sensitive content cannot always be identified.`;
        this.renderList();
    }
    private renderList(): void {
        const query = this.searchBox.value.trim().toLocaleLowerCase();
        const entries = this.snapshotValue?.entries.filter(entry => !query ||
            (entry.kind === 'text' ? entry.value.toLocaleLowerCase().includes(query) : 'image'.includes(query))) ?? [];
        this.list.replaceChildren();
        if (!entries.length) { const empty = document.createElement('p');
            empty.textContent = query ? 'No matching clipboard entries.' : 'Copy something to see it here.';
            this.list.append(empty); return; }
        for (const entry of entries) {
            const row = document.createElement('article'); row.className = 'dope-clipboard-entry';
            row.tabIndex = 0; row.setAttribute('role', 'button');
            row.setAttribute('aria-label', `Restore ${entryType(entry)} copied ${relativeTime(entry.createdAt)}`);
            const restore = () => void this.change(() => this.service!.restore(entry.id));
            row.onclick = restore;
            row.onkeydown = event => { if (event.target === row && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault(); restore(); } };
            const meta = document.createElement('div'); meta.className = 'dope-clipboard-meta';
            const type = document.createElement('span'); type.textContent = entryType(entry);
            const time = document.createElement('time'); time.dateTime = new Date(entry.createdAt).toISOString();
            time.textContent = relativeTime(entry.createdAt);
            meta.append(type, time);
            const content = document.createElement('div'); content.className = 'dope-clipboard-preview';
            if (entry.kind === 'image') { const image = document.createElement('img');
                image.src = `data:image/png;base64,${entry.value}`; image.alt = 'Clipboard image thumbnail'; content.append(image); }
            else { const text = document.createElement('pre'); text.textContent = entry.value;
                if (!this.expanded.has(entry.id)) text.className = 'dope-clipboard-clamped';
                content.append(text); }
            const actions = document.createElement('div'); actions.className = 'dope-clipboard-actions';
            actions.append(button('Restore', restore),
                button(entry.pinned ? 'Unpin' : 'Pin', () => void this.change(() => this.service!.pin(entry.id, !entry.pinned))),
                button('Delete', () => void this.change(() => this.service!.delete(entry.id))));
            if (entry.kind === 'text' && entry.value.length > 180) actions.append(button(
                this.expanded.has(entry.id) ? 'Less' : 'More', () => {
                    if (this.expanded.has(entry.id)) this.expanded.delete(entry.id); else this.expanded.add(entry.id);
                    this.renderList(); }));
            row.append(meta, content, actions); this.list.append(row);
        }
    }
}
