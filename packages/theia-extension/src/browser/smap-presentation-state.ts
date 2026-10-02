import type { StorageService } from '@theia/core/lib/browser/storage-service';

export const nodePalette = ['default', 'blue', 'green', 'orange', 'purple'] as const;
export type NodePalette = typeof nodePalette[number];
type Override = Exclude<NodePalette, 'default'>;
type StoredColors = { version: 1; workspace: string; colors: Record<string, string> };
export const nodeColorStorageKey = (workspace: string): string => `dope.smap.node-colors.v1:${encodeURIComponent(workspace)}`;

/** Workbench presentation state; architecture and planning never read this store. */
export class SmapPresentationState {
    private workspace?: string;
    private colors: Record<string, Override> = Object.create(null);
    private request = 0;
    private readonly listeners = new Set<() => void>();
    constructor(private readonly storage: Pick<StorageService, 'getData' | 'setData'>) {}

    onChange(listener: () => void): { dispose(): void } {
        this.listeners.add(listener);
        return { dispose: () => { this.listeners.delete(listener); } };
    }
    private changed(): void { for (const listener of this.listeners) listener(); }
    get(id: string): NodePalette { return this.colors[id] ?? 'default'; }

    async attach(workspace?: string): Promise<void> {
        if (workspace === this.workspace) return;
        this.workspace = workspace;
        this.colors = Object.create(null);
        const request = ++this.request;
        this.changed();
        if (!workspace) return;
        try {
            const stored = await this.storage.getData<StoredColors>(nodeColorStorageKey(workspace));
            if (request !== this.request || this.workspace !== workspace) return;
            if (stored?.version === 1 && stored.workspace === workspace && stored.colors &&
                typeof stored.colors === 'object' && !Array.isArray(stored.colors)) {
                this.colors = Object.assign(Object.create(null), Object.fromEntries(Object.entries(stored.colors).filter(([, color]) =>
                    typeof color === 'string' && nodePalette.includes(color as NodePalette) && color !== 'default')));
            }
            this.changed();
        } catch { /* A missing presentation preference leaves the default palette. */ }
    }

    async set(id: string, color: NodePalette): Promise<void> {
        const workspace = this.workspace;
        if (!workspace || !id || !nodePalette.includes(color)) return;
        ++this.request;
        if (color === 'default') delete this.colors[id];
        else this.colors[id] = color;
        this.changed();
        await this.storage.setData(nodeColorStorageKey(workspace),
            { version: 1, workspace, colors: { ...this.colors } } satisfies StoredColors);
    }
}
