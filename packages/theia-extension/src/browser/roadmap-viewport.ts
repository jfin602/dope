/** Workbench-only Roadmap layout. No field here changes Roadmap revision or edges. */
export interface RoadmapViewportState {
    version: 2;
    orientation: 'horizontal';
    projectId: string;
    viewport?: { x: number; y: number; zoom: number };
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

export function roadmapViewportSnapshot(projectId: string, viewport: RoadmapViewportState['viewport'],
    selectedId: string | undefined, expanded: ReadonlySet<string>, collapsed: ReadonlySet<string>,
    placements: ReadonlyMap<string, { x: number; y: number }>): RoadmapViewportState {
    return { version: 2, orientation: 'horizontal', projectId, viewport: viewport && { ...viewport }, selectedId,
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
    return { version: 2, orientation: 'horizontal', projectId,
        viewport: horizontal && point(viewport) && typeof viewport.zoom === 'number' &&
            Number.isFinite(viewport.zoom) && viewport.zoom >= 0.2 && viewport.zoom <= 2 ?
            { x: viewport.x, y: viewport.y, zoom: viewport.zoom } : undefined,
        selectedId: typeof item.selectedId === 'string' ? item.selectedId : undefined,
        expanded: ids(item.expanded), collapsed: ids(item.collapsed), placements };
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
