import type { CheckpointNode, CheckpointEdge, RoadmapProjection } from '@dope/project-intelligence/lib/roadmap-projection';
import type { GreenfieldDraft, GreenfieldChange } from '@dope/project-intelligence/lib/node/roadmap-greenfield';

export function currentDraftChange(change: GreenfieldChange, state: { root: string; projectId: string;
    handle: string; revision: number; sequence: number }): boolean {
    return change.root === state.root && change.projectId === state.projectId && change.handle === state.handle &&
        Number.isSafeInteger(change.sequence) && change.sequence > state.sequence &&
        Number.isSafeInteger(change.revision) && change.revision >= state.revision &&
        (change.kind === 'accepted' ? change.revision > state.revision && change.draft?.revision === change.revision :
            change.kind === 'proposed' ? change.revision === state.revision &&
                change.draft?.revision === state.revision + 1 :
                (change.kind === 'cleared' || change.kind === 'cancelled') && change.revision === state.revision);
}

/** Merge noncanonical draft cards into the one existing Roadmap graph. */
export function projectRoadmapDraft<T extends RoadmapProjection>(base: T, accepted?: GreenfieldDraft,
    proposed?: GreenfieldDraft): T {
    if (!accepted && !proposed) return base;
    const before = new Map<string, string>();
    for (const [order, phase] of (accepted?.phases ?? []).entries()) {
        before.set(phase.id, JSON.stringify({ title: phase.title, objective: phase.objective, order }));
        for (const [index, item] of phase.checkpoints.entries())
            before.set(item.id, JSON.stringify({ ...item, order: index }));
    }
    const active = proposed ?? accepted!;
    const nodes: CheckpointNode[] = [];
    const edges: CheckpointEdge[] = [];
    for (const [order, phase] of active.phases.entries()) {
        const phaseState = proposed && before.get(phase.id) !== JSON.stringify({ title: phase.title, objective: phase.objective, order })
            ? 'proposed' : 'accepted';
        nodes.push({ id: phase.id, kind: 'phase', title: phase.title, order, status: 'not-implemented',
            statusLabel: phaseState === 'proposed' ? 'Proposed · not implemented' : 'Accepted draft · not implemented',
            evidence: [], readOnly: true, lane: 'path', draftState: phaseState });
        for (const [index, item] of phase.checkpoints.entries()) {
            const state = proposed && before.get(item.id) !== JSON.stringify({ ...item, order: index }) ? 'proposed' : 'accepted';
            nodes.push({ id: item.id, kind: 'milestone', title: item.title, order: index,
                status: 'not-implemented', statusLabel: state === 'proposed' ? 'Proposed · not implemented' :
                    'Accepted draft · not implemented', evidence: [], readOnly: true, lane: 'branch',
                draftState: state, phaseAssociation: { phaseId: phase.id } });
            edges.push({ id: `draft:${phase.id}:${item.id}`, from: phase.id, to: item.id,
                kind: 'branch', label: state === 'proposed' ? 'Proposed draft checkpoint' : 'Accepted draft checkpoint' });
        }
    }
    const ids = new Set(base.nodes.map(node => node.id));
    return { ...base, nodes: [...base.nodes, ...nodes.filter(node => !ids.has(node.id))],
        edges: [...base.edges, ...edges.filter(edge => !ids.has(edge.to))] };
}

export type RoadmapDetail = 'world' | 'phase' | 'checkpoint';

/** Absolute zoom thresholds with a dead band at each boundary. */
export function roadmapDetailAtZoom(zoom: number, current: RoadmapDetail): RoadmapDetail {
    if (!Number.isFinite(zoom) || zoom <= 0) return current;
    if (current === 'world') return zoom >= 0.72 ? 'phase' : 'world';
    if (current === 'checkpoint') return zoom <= 1.12 ? 'phase' : 'checkpoint';
    return zoom < 0.56 ? 'world' : zoom > 1.36 ? 'checkpoint' : 'phase';
}

export interface RoadmapVisibleGraph {
    nodes: CheckpointNode[];
    edges: CheckpointEdge[];
    /** Counts hidden prompt children on their stable stack identity. */
    omittedByStack: Map<string, number>;
}

export interface RoadmapImplementationStack {
    id: string;
    path: string;
    fingerprint: string;
    promptCount: number;
}

/** Source-backed stack ownership for presentation; task-stack cards never become checkpoints. */
export function roadmapImplementationStacks(projection: RoadmapProjection, checkpointId: string): RoadmapImplementationStack[] {
    const byId = new Map(projection.nodes.map(node => [node.id, node]));
    return projection.edges.filter(edge => edge.id.startsWith('task-parent:') && edge.from === checkpointId)
        .map(edge => byId.get(edge.to)).filter((node): node is CheckpointNode => node?.kind === 'task-stack')
        .map(node => ({ id: node.id, path: node.taskSource!.stackPath, fingerprint: node.taskSource!.fingerprint,
            promptCount: projection.nodes.filter(item => item.kind === 'prompt' &&
                item.taskSource?.stackPath === node.taskSource?.stackPath).length }));
}

export interface RoadmapCanvasConnector {
    id: string;
    from: string;
    to: string;
    kind: 'progression' | 'membership' | 'containment' | 'dependency';
    label: string;
}

/** Selection emphasis is local to a connector actually rendered at this detail level. */
export function roadmapConnectorTouchesSelection(connector: Pick<RoadmapCanvasConnector, 'from' | 'to'>,
    selectedId: string | undefined): boolean {
    return selectedId !== undefined && (connector.from === selectedId || connector.to === selectedId);
}

/** Relationships for drawing only. None are written back to RoadmapIndex. */
export function roadmapCanvasConnectors(projection: Pick<RoadmapProjection, 'nodes' | 'edges'>): RoadmapCanvasConnector[] {
    const byId = new Map(projection.nodes.map(node => [node.id, node]));
    const visible = (id: string): boolean => byId.has(id);
    const phases = projection.nodes.filter(node => node.kind === 'phase')
        .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
    const connectors: RoadmapCanvasConnector[] = [];
    const storedDependencies = new Set(projection.edges.filter(edge => edge.id.startsWith('dependency:'))
        .map(edge => `${edge.from}\0${edge.to}`));
    for (let i = 1; i < phases.length; i++) connectors.push({
        id: `view:progression:${phases[i - 1].id}:${phases[i].id}`,
        from: phases[i - 1].id, to: phases[i].id, kind: 'progression',
        label: 'Chronological phase progression; no release gate implied',
    });
    for (const node of projection.nodes) if ((node.kind === 'correction' ||
        node.kind === 'task-stack' && roadmapUpperBranch(node)) &&
        node.phaseAssociation?.phaseId && visible(node.phaseAssociation.phaseId) &&
        !storedDependencies.has(`${node.phaseAssociation.phaseId}\0${node.id}`)) connectors.push({
        id: `view:membership:${node.phaseAssociation.phaseId}:${node.id}`,
        from: node.phaseAssociation.phaseId, to: node.id, kind: 'membership',
        label: `Correction belongs to ${byId.get(node.phaseAssociation.phaseId)!.title}`,
    });
    for (const edge of projection.edges) if (visible(edge.from) && visible(edge.to)) {
        const kind = edge.kind === 'dependency' || edge.id.startsWith('dependency:') ? 'dependency' : 'containment';
        // A source-backed branch and the presentation membership may name the same pair.
        // Draw that relationship once; the stored edge remains intact in the projection.
        if (kind === 'containment' && connectors.some(item => item.kind === 'membership' &&
            item.from === edge.from && item.to === edge.to)) continue;
        connectors.push({ id: `view:${edge.id}`, from: edge.from, to: edge.to, kind,
            label: kind === 'dependency' ? `${byId.get(edge.to)?.kind === 'correction' &&
                byId.get(edge.to)?.phaseAssociation?.phaseId === edge.from ?
                'Stored Roadmap dependency and correction membership' : 'Stored Roadmap dependency'}: ${edge.label}` :
                `Supporting task or prompt: ${edge.label}` });
    }
    return connectors;
}

/** Presentation disclosure only. The projection and its evidence are never changed. */
export function roadmapVisibleGraph(projection: RoadmapProjection, _detail: RoadmapDetail,
    selectedId?: string, expanded: ReadonlySet<string> = new Set(), collapsed: ReadonlySet<string> = new Set(),
    promptLimit = 96, window?: { stackId: string; start: number }): RoadmapVisibleGraph {
    const promptsByStack = new Map<string, CheckpointNode[]>();
    for (const node of projection.nodes) if (node.kind === 'prompt') {
        const stack = projection.nodes.find(candidate =>
            candidate.kind === 'task-stack' && candidate.taskSource?.stackPath === node.taskSource?.stackPath)?.id;
        if (stack) {
            promptsByStack.set(stack, [...(promptsByStack.get(stack) ?? []), node]);
        }
    }
    const owners = new Map(projection.edges.filter(edge => edge.id.startsWith('task-parent:'))
        .map(edge => [edge.to, edge.from]));
    const visible = new Set(projection.nodes.filter(node => node.kind !== 'prompt' && node.kind !== 'task-stack')
        .map(node => node.id));
    const candidates = [...promptsByStack].filter(([stack]) => {
        const owner = owners.get(stack);
        return !!owner && visible.has(owner) && expanded.has(owner) && !collapsed.has(owner);
    }).sort(([a], [b]) => a === window?.stackId ? -1 : b === window?.stackId ? 1 : 0);
    const budget = Math.max(1, Math.min(256, Math.floor(promptLimit)));
    let remaining = budget;
    const perStack = Math.max(1, Math.floor(budget / Math.max(1, candidates.length)));
    for (const [stack, prompts] of candidates) {
        let stackRemaining = Math.min(perStack, remaining);
        const ordered = [...prompts].sort((a, b) => (a.taskSource?.number ?? 0) - (b.taskSource?.number ?? 0) || a.id.localeCompare(b.id));
        const selectedIndex = ordered.findIndex(node => node.id === selectedId);
        const neighborhood = selectedIndex < 0 ? [] : ordered.slice(Math.max(0, selectedIndex - 2), selectedIndex + 3);
        for (const node of neighborhood) if (!visible.has(node.id) && stackRemaining > 0) {
            visible.add(node.id); remaining--; stackRemaining--;
        }
        const offset = stack === window?.stackId && Number.isSafeInteger(window.start) ?
            Math.max(0, Math.min(ordered.length - 1, window.start)) : 0;
        for (const node of [...ordered.slice(offset), ...ordered.slice(0, offset)])
            if (!visible.has(node.id) && stackRemaining > 0) { visible.add(node.id); remaining--; stackRemaining--; }
    }
    const omittedByStack = new Map<string, number>();
    for (const [stack, prompts] of promptsByStack) if (owners.has(stack))
        omittedByStack.set(stack, prompts.filter(node => !visible.has(node.id)).length);
    const edges = projection.edges.filter(edge => visible.has(edge.from) && visible.has(edge.to));
    for (const [stack, prompts] of candidates) {
        const owner = owners.get(stack)!;
        const shown = prompts.filter(node => visible.has(node.id)).sort((a, b) =>
            (a.taskSource?.number ?? 0) - (b.taskSource?.number ?? 0));
        for (const node of shown) if (!edges.some(edge => edge.to === node.id &&
            shown.some(previous => previous.id === edge.from)))
            edges.push({ id: `disclosure:${owner}:${node.id}`, from: owner, to: node.id,
                kind: 'branch', label: 'Disclosed implementation prompt' });
    }
    return { nodes: projection.nodes.filter(node => visible.has(node.id)),
        edges, omittedByStack };
}

/** DOM order and keyboard order are the same, including correction branches. */
export function roadmapCanvasOrder(projection: Pick<RoadmapProjection, 'nodes' | 'edges'>): CheckpointNode[] {
    const phases = projection.nodes.filter(node => node.lane === 'path');
    const branches = projection.nodes.filter(node => node.lane === 'branch');
    const byId = new Map(projection.nodes.map(node => [node.id, node]));
    const children = new Map<string, CheckpointNode[]>();
    for (const node of branches) {
        const parent = node.phaseAssociation?.unresolvedReason ? undefined : node.phaseAssociation?.phaseId ??
            projection.edges.find(edge => edge.to === node.id && edge.kind === 'branch')?.from;
        if (parent && byId.has(parent)) children.set(parent, [...(children.get(parent) ?? []), node]);
    }
    const compare = (a: CheckpointNode, b: CheckpointNode): number =>
        Number(roadmapUpperBranch(b)) - Number(roadmapUpperBranch(a)) || a.order - b.order || a.id.localeCompare(b.id);
    for (const group of children.values()) group.sort(compare);
    const seen = new Set<string>();
    const ordered: CheckpointNode[] = [];
    const visit = (node: CheckpointNode): void => {
        if (seen.has(node.id)) return;
        seen.add(node.id);
        ordered.push(node);
        for (const child of children.get(node.id) ?? []) visit(child);
    };
    for (const phase of [...phases].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) visit(phase);
    for (const branch of [...branches].sort(compare)) visit(branch);
    return ordered;
}

export function roadmapNextId(ids: readonly string[], current: string | undefined, key: string): string | undefined {
    if (!ids.length) return undefined;
    const index = current ? ids.indexOf(current) : -1;
    if (key === 'Home') return ids[0];
    if (key === 'End') return ids[ids.length - 1];
    if (key === 'ArrowDown' || key === 'ArrowRight') return ids[Math.min(ids.length - 1, index + 1)];
    if (key === 'ArrowUp' || key === 'ArrowLeft') return ids[Math.max(0, index < 0 ? 0 : index - 1)];
    return undefined;
}

const roadmapUpperBranch = (node: CheckpointNode): boolean => node.kind === 'correction' ||
    (node.kind === 'task-stack' && (node.taskSource?.segment ?? node.title).startsWith('Correction ')) ||
    /qualification/i.test(node.title) && node.kind !== 'phase';

/** Arrow keys choose the closest displayed card in the requested direction; Tab follows canvas order. */
export function roadmapSpatialNextId(ids: readonly string[], positions: ReadonlyMap<string, { x: number; y: number }>,
    current: string | undefined, key: string): string | undefined {
    if (key === 'Home' || key === 'End') return roadmapNextId(ids, current, key);
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(key)) return undefined;
    const origin = current && positions.get(current);
    if (!origin) return ids[0];
    const horizontal = key === 'ArrowLeft' || key === 'ArrowRight';
    const sign = key === 'ArrowLeft' || key === 'ArrowUp' ? -1 : 1;
    return ids.filter(id => id !== current && positions.has(id)).map(id => {
        const point = positions.get(id)!;
        const primary = (horizontal ? point.x - origin.x : point.y - origin.y) * sign;
        const cross = Math.abs(horizontal ? point.y - origin.y : point.x - origin.x);
        return { id, primary, cross };
    }).filter(candidate => candidate.primary > 0).sort((a, b) =>
        a.cross - b.cross || a.primary - b.primary || ids.indexOf(a.id) - ids.indexOf(b.id))[0]?.id;
}

/** A displayed edge retains its real graph endpoints; only its presentation handles change. */
export function roadmapEdgeHandles(edge: { from: string; to: string; kind: RoadmapCanvasConnector['kind'] | CheckpointEdge['kind'] },
    positions: ReadonlyMap<string, { x: number; y: number }>): { sourceHandle: string; targetHandle: string } {
    const from = positions.get(edge.from), to = positions.get(edge.to);
    // A stored gate between consecutive phases must not paint over the chronological line.
    if (edge.kind === 'dependency' && from && to && Math.abs(to.y - from.y) <= 20)
        return { sourceHandle: 'bottom', targetHandle: 'bottom' };
    if (edge.kind !== 'progression' && from && to && Math.abs(to.y - from.y) > 20)
        return to.y < from.y ? { sourceHandle: 'top', targetHandle: 'right-target' } :
            { sourceHandle: 'bottom', targetHandle: 'right-target' };
    return { sourceHandle: 'right', targetHandle: 'left' };
}

/** Orthogonal branch bus outside the card column; React Flow supplies measured handle coordinates. */
export function roadmapBranchPath(sourceX: number, sourceY: number, targetX: number, targetY: number,
    upper: boolean): string {
    const clearance = upper ? -26 : 26;
    const gutter = Math.max(sourceX + 240, targetX + 28);
    return `M ${sourceX} ${sourceY} L ${sourceX} ${sourceY + clearance} L ${gutter} ${sourceY + clearance} ` +
        `L ${gutter} ${targetY} L ${targetX} ${targetY}`;
}

/** Stable phase columns with correction space above and supporting work below. */
export function roadmapSpatialLayout(projection: RoadmapProjection): Map<string, { x: number; y: number }> {
    const placed = new Map<string, { x: number; y: number }>();
    const byId = new Map(projection.nodes.map(node => [node.id, node]));
    const children = new Map<string, CheckpointNode[]>();
    const incoming = new Set<string>();
    for (const edge of projection.edges.filter(item => item.kind === 'branch')) {
        const child = byId.get(edge.to);
        if (child && child.kind !== 'prompt' && child.kind !== 'task-stack' &&
            !child.phaseAssociation?.unresolvedReason && byId.has(edge.from)) {
            children.set(edge.from, [...(children.get(edge.from) ?? []), child]);
            incoming.add(child.id);
        }
    }
    for (const node of projection.nodes) if (node.kind !== 'prompt' && node.kind !== 'task-stack' &&
        node.phaseAssociation?.phaseId && byId.has(node.phaseAssociation.phaseId)) {
        const parent = node.phaseAssociation.phaseId;
        // A task with an explicit failed-prompt parent keeps that source-backed attachment.
        if (!incoming.has(node.id)) {
            children.set(parent, [...(children.get(parent) ?? []), node]);
            incoming.add(node.id);
        }
    }
    const compare = (a: CheckpointNode, b: CheckpointNode): number =>
        a.order - b.order || a.id.localeCompare(b.id, 'en');
    for (const group of children.values()) group.sort(compare);
    const baseline = 640;
    const column = 28;
    const cardHeight = (node: CheckpointNode): number =>
        Math.max(160, 100 + Math.ceil(node.title.length / 20) * 22 +
            (node.phaseAssociation?.unresolvedReason ? 44 : 0));
    let nextBandX = 64;
    const visitBand = (root: CheckpointNode): void => {
        const x = nextBandX;
        const cursor = { upper: baseline - 70, lower: baseline + cardHeight(root) + 70 };
        const visit = (node: CheckpointNode, depth: number, upper: boolean): void => {
            if (placed.has(node.id)) return;
            const height = cardHeight(node);
            const y = node === root ? baseline : upper ? cursor.upper - height : cursor.lower;
            placed.set(node.id, { x: x + Math.min(depth, 3) * column, y });
            if (node !== root) {
                if (upper) cursor.upper = y - 44;
                else cursor.lower = y + height + 44;
            }
            for (const child of children.get(node.id) ?? [])
                visit(child, node.kind === 'prompt' && child.kind === 'prompt' ? depth : depth + 1,
                    node === root ? roadmapUpperBranch(child) : upper);
        };
        visit(root, 0, false);
        nextBandX += 420;
    };
    for (const phase of projection.nodes.filter(node => node.kind === 'phase').sort(compare)) visitBand(phase);
    // Unmatched work stays in a distinct, discoverable region past the phase route.
    nextBandX += 120;
    for (const node of [...projection.nodes].filter(item => item.kind !== 'prompt' && item.kind !== 'task-stack' &&
        !incoming.has(item.id)).sort(compare))
        if (!placed.has(node.id)) visitBand(node);
    for (const node of [...projection.nodes].filter(item => item.kind !== 'prompt' && item.kind !== 'task-stack').sort(compare))
        if (!placed.has(node.id)) visitBand(node);
    // Disclosure consumes only the space used by displayed prompts. Strategic cards retain exact coordinates.
    const ownerByPrompt = new Map(projection.edges.filter(edge => edge.id.startsWith('disclosure:'))
        .map(edge => [edge.to, edge.from]));
    const promptById = new Map(projection.nodes.filter(node => node.kind === 'prompt').map(node => [node.id, node]));
    const pending = [...promptById.values()].sort((a, b) =>
        (a.taskSource?.stackPath ?? '').localeCompare(b.taskSource?.stackPath ?? '') ||
        (a.taskSource?.number ?? 0) - (b.taskSource?.number ?? 0));
    const cursors = new Map<number, { upper: number; lower: number }>();
    for (const prompt of pending) {
        const owner = ownerByPrompt.get(prompt.id) ?? projection.edges.find(edge => edge.to === prompt.id &&
            promptById.has(edge.from))?.from;
        const anchor = owner && placed.get(owner);
        if (!anchor) continue;
        const band = Math.round((anchor.x - 64) / 420);
        let cursor = cursors.get(band);
        if (!cursor) {
            const strategic = [...placed.entries()].filter(([, point]) => Math.round((point.x - 64) / 420) === band);
            cursor = { upper: Math.min(...strategic.map(([, point]) => point.y)) - 80,
                lower: Math.max(...strategic.map(([id, point]) => point.y + cardHeight(byId.get(id)!))) + 80 };
            cursors.set(band, cursor);
        }
        const correction = byId.get(owner)?.kind === 'correction' ||
            (promptById.has(owner) && placed.get(owner)!.y < baseline);
        const height = cardHeight(prompt);
        const y = correction ? cursor.upper - height : cursor.lower;
        placed.set(prompt.id, { x: anchor.x, y });
        if (correction) cursor.upper = y - 44;
        else cursor.lower = y + height + 44;
    }
    return placed;
}
