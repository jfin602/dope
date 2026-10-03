import type { StorageService } from '@theia/core/lib/browser/storage-service';

export const nodePalette = ['default', 'blue', 'cyan', 'teal', 'green', 'yellow', 'orange', 'red', 'pink', 'purple', 'indigo'] as const;
export type NodePalette = typeof nodePalette[number];
type Override = Exclude<NodePalette, 'default'>;
export type ColorNode = { id: string; kind: string; parentId?: string };

/** Automatic colors depend on identity, never traversal order or stored preferences. */
export function automaticSystemColor(id: string): Override {
    let hash = 2166136261;
    for (const char of id) { hash ^= char.codePointAt(0)!; hash = Math.imul(hash, 16777619); }
    return nodePalette[1 + (hash >>> 0) % (nodePalette.length - 1)] as Override;
}

/** Projected parents win for planned moves; source parents reveal ancestors outside focus. */
export function architectureColors(projected: readonly ColorNode[], source: readonly ColorNode[], explicit: (id: string) => NodePalette): (id: string) => NodePalette {
    const nodes = new Map(source.map(node => [node.id, node]));
    for (const node of projected) nodes.set(node.id, { ...nodes.get(node.id), ...node,
        parentId: node.parentId ?? nodes.get(node.id)?.parentId });
    const cache = new Map<string, NodePalette>();
    const resolving = new Set<string>();
    const resolve = (id: string): NodePalette => {
        if (cache.has(id)) return cache.get(id)!;
        if (resolving.has(id)) return 'default';
        const node = nodes.get(id);
        if (!node) return 'default';
        resolving.add(id);
        const override = explicit(id);
        const color = override !== 'default' ? override : node.kind === 'system' ? automaticSystemColor(id) :
            node.parentId ? resolve(node.parentId) : 'default';
        resolving.delete(id);
        cache.set(id, color);
        return color;
    };
    return resolve;
}
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
