import { watch, type FSWatcher } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { checkedRoadmapDocumentFile } from './roadmap-document-patch';
import type { RoadmapGateIndex } from './roadmap-gate-domain';

/** Watches one accepted source only. The caller owns project lifecycle and any reconciliation. */
export class RoadmapLinkedObserver {
    private watcher?: FSWatcher;
    private timer?: ReturnType<typeof setTimeout>;
    private serial = 0;
    private notified?: string;
    private root?: string;

    constructor(private readonly read: (root: string) => Promise<RoadmapGateIndex>,
        private readonly changed: (root: string, projectId: string) => void) {}

    async observe(root?: string): Promise<void> {
        const serial = ++this.serial;
        this.clear();
        if (!root) return;
        const index = await this.read(root);
        const linked = index.linkedDocument;
        if (!linked || linked.projectRoot !== root || linked.projectId !== index.projectId) return;
        const source = await checkedRoadmapDocumentFile(root, linked.path);
        if (serial !== this.serial) return;
        this.root = root;
        this.watcher = watch(source.directory, { persistent: false }, (_event, filename) => {
            if (filename !== null && String(filename) !== basename(source.file)) return;
            if (this.timer) clearTimeout(this.timer);
            this.timer = setTimeout(() => { this.timer = undefined; void this.recheck(serial); }, 120);
        });
        this.watcher.on('error', () => {
            if (serial !== this.serial) return;
            this.watcher?.close();
            this.watcher = undefined;
            this.changed(root, index.projectId); // Focus and Refresh remain available if observation fails.
        });
    }

    /** A committed owner switch closes the old watch before subscribing to the new source. */
    async rebindIfObserving(root: string): Promise<void> {
        if (this.root !== root) return;
        await this.observe(root);
    }

    private async recheck(serial: number): Promise<void> {
        const root = this.root;
        if (!root || serial !== this.serial) return;
        try {
            const index = await this.read(root);
            const linked = index.linkedDocument;
            if (!linked || linked.projectRoot !== root || linked.projectId !== index.projectId) return;
            let fingerprint: string;
            try {
                fingerprint = createHash('sha256').update((await checkedRoadmapDocumentFile(root, linked.path)).bytes).digest('hex');
            } catch { fingerprint = 'missing-or-unsafe'; }
            if (serial !== this.serial) return;
            if (fingerprint === linked.sourceHash) { this.notified = undefined; return; }
            if (fingerprint === this.notified) return;
            this.notified = fingerprint;
            this.changed(root, index.projectId);
        } catch { /* Refresh/focus will expose storage errors. */ }
    }

    private clear(): void {
        if (this.timer) clearTimeout(this.timer);
        this.timer = undefined;
        this.watcher?.close();
        this.watcher = undefined;
        this.root = undefined;
        this.notified = undefined;
    }
    dispose(): void { ++this.serial; this.clear(); }
}
