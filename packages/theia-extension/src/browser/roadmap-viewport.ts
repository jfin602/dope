/** Workbench-only Roadmap layout. No field here changes Roadmap revision or edges. */
export interface RoadmapViewportState {
    version: 2;
    orientation: 'horizontal';
    projectId: string;
    viewport?: { x: number; y: number; zoom: number };
    /** Distinguishes an intentional Fit/pan/zoom from the old automatic fit on mount. */
    viewportIntent?: 'user';
    selectedId?: string;
    expanded: string[];
    collapsed: string[];
    placements: Record<string, { x: number; y: number }>;
}

export const roadmapViewportKey = (uri: string, projectId: string): string =>
    `dope.roadmap.viewport.v2:${encodeURIComponent(uri)}:${encodeURIComponent(projectId)}`;

/** Keep the old key untouched so the original vertical Arrange work remains recoverable. */
export const roadmapLegacyViewportKey = (uri: string, projectId: string): string =>
    `dope.roadmap.viewport.v1:${encodeURIComponent(uri)}:${encodeURIComponent(projectId)}`;

/** React Flow also reports camera changes caused by mounting and graph measurement. */
export function roadmapUserViewportEvent(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const event = value as { isTrusted?: unknown; type?: unknown };
    return event.isTrusted === true && typeof event.type === 'string' &&
        /^(mouse|pointer|touch|wheel|key)/.test(event.type);
}

export function roadmapViewportSnapshot(projectId: string, viewport: RoadmapViewportState['viewport'],
    selectedId: string | undefined, expanded: ReadonlySet<string>, collapsed: ReadonlySet<string>,
    placements: ReadonlyMap<string, { x: number; y: number }>): RoadmapViewportState {
    return { version: 2, orientation: 'horizontal', projectId, viewport: viewport && { ...viewport },
        viewportIntent: viewport ? 'user' : undefined, selectedId,
        expanded: [...expanded], collapsed: [...collapsed],
        placements: Object.fromEntries([...placements].map(([id, position]) => [id, { ...position }])) };
}

const point = (value: unknown): value is { x: number; y: number } => {
    const item = value as { x?: unknown; y?: unknown } | null;
    return !!item && typeof item.x === 'number' && Number.isFinite(item.x) &&
        typeof item.y === 'number' && Number.isFinite(item.y);
};

export function readRoadmapViewport(value: unknown, projectId: string): RoadmapViewportState {
    const empty = (): RoadmapViewportState => ({ version: 2, orientation: 'horizontal', projectId,
        expanded: [], collapsed: [], placements: {} });
    if (!value || typeof value !== 'object') return empty();
    const item = value as Partial<RoadmapViewportState>;
    if (item.projectId !== projectId) return empty();
    const horizontal = item.version === 2 && item.orientation === 'horizontal';
    const legacy = (value as { version?: unknown }).version === 1;
    if (!horizontal && !legacy) return empty();
    const ids = (list: unknown): string[] => Array.isArray(list) ?
        [...new Set(list.filter((id): id is string => typeof id === 'string' && id.length > 0))].slice(0, 2048) : [];
    const placements: RoadmapViewportState['placements'] = {};
    if (horizontal && item.placements && typeof item.placements === 'object' && !Array.isArray(item.placements))
        for (const [id, position] of Object.entries(item.placements).slice(0, 2048))
            if (id && id !== '__proto__' && id !== 'constructor' && id !== 'prototype' && point(position))
                placements[id] = { x: position.x, y: position.y };
    const viewport = item.viewport;
    // Earlier v2 builds saved fit-all on mount. At world-detail zoom that value has no
    // provenance; a marked intentional Fit remains restorable at the same zoom.
    const validViewport = horizontal && point(viewport) && typeof viewport.zoom === 'number' &&
        Number.isFinite(viewport.zoom) && viewport.zoom >= 0.2 && viewport.zoom <= 2 &&
        (item.viewportIntent === 'user' || viewport.zoom >= 0.56);
    return { version: 2, orientation: 'horizontal', projectId,
        viewport: validViewport ? { x: viewport.x, y: viewport.y, zoom: viewport.zoom } : undefined,
        viewportIntent: validViewport ? 'user' : undefined,
        selectedId: typeof item.selectedId === 'string' ? item.selectedId : undefined,
        expanded: ids(item.expanded), collapsed: ids(item.collapsed), placements };
}

export interface RoadmapCameraNode {
    id: string;
    kind: string;
    order: number;
    status: string;
}

/** Current phase follows the latest completed phase in authoritative roadmap status. */
export function roadmapInitialTarget<T extends RoadmapCameraNode>(nodes: readonly T[]): T | undefined {
    const ordered = [...nodes].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const phases = ordered.filter(node => node.kind === 'phase');
    const completed = (node: T): boolean => node.status === 'green' || node.status === 'waived';
    let lastCompleted = -1;
    phases.forEach((node, index) => { if (completed(node)) lastCompleted = index; });
    return phases.slice(lastCompleted + 1).find(node => node.status === 'active') ??
        phases.slice(lastCompleted + 1).find(node => node.status === 'not-green') ??
        phases.slice(lastCompleted + 1).find(node => !completed(node)) ??
        phases.find(node => node.status === 'active') ?? phases.at(-1) ??
        ordered.find(node => node.status === 'active') ?? ordered[0];
}

/** Center the card at phase detail; adjacent 420px phase columns remain visible. */
export function roadmapInitialCamera(target: { x: number; y: number }, width: number, height: number):
    NonNullable<RoadmapViewportState['viewport']> {
    const zoom = 0.9;
    return { x: width / 2 - (target.x + 140) * zoom,
        y: height / 2 - (target.y + 80) * zoom, zoom };
}

export const roadmapGestures = (arranging: boolean): { panOnDrag: boolean; zoomOnScroll: boolean;
    zoomOnPinch: boolean; nodesDraggable: boolean; nodesConnectable: boolean } => ({
    panOnDrag: true, zoomOnScroll: true, zoomOnPinch: true, nodesDraggable: arranging, nodesConnectable: false,
});

export function roadmapKeyboardAction(key: string, shift: boolean, alt: boolean, arranging: boolean):
    'pan-left' | 'pan-right' | 'pan-up' | 'pan-down' | 'move-left' | 'move-right' | 'move-up' | 'move-down' | undefined {
    const direction = ({ ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' } as Record<string, string>)[key];
    return direction && ((alt && arranging) || shift) ? `${alt && arranging ? 'move' : 'pan'}-${direction}` as ReturnType<typeof roadmapKeyboardAction> : undefined;
}
