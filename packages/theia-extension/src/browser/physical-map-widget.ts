import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ReactFlow, Background, Controls, type ReactFlowInstance, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BaseWidget, Message, codicon } from '@theia/core/lib/browser/widgets/widget';
import { OpenerService, open } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { PhysicalMapController, physicalMapTabId, type PhysicalMapTabOptions } from './physical-map-controller';
import type { CanvasNode } from './physical-map-projection';
import './dope.css';

export const PHYSICAL_MAP_ID = 'dope-physical-map-canvas';

function MapNode({ data }: { data: { item: CanvasNode } }): React.ReactElement {
    const item = data.item;
    return React.createElement('div', { className: `dope-map-node dope-map-${item.kind} dope-map-${item.state}` },
        React.createElement('span', { className: 'dope-map-kind' }, `${item.context ? '↗ ' : ''}${item.kind}`),
        React.createElement('strong', null, item.name),
        React.createElement('small', { className: 'dope-map-badge' }, item.badge));
}
const nodeTypes = { architecture: MapNode };

export class PhysicalMapWidget extends BaseWidget {
    private readonly controller: PhysicalMapController;
    private readonly status = document.createElement('p');
    private readonly canvas = document.createElement('div');
    private root?: Root;
    private flow?: ReactFlowInstance;
    private renderedGraph = '';
    private readonly breadcrumbs = document.createElement('nav');
    private readonly focusButton = document.createElement('button');
    private readonly tabButton = document.createElement('button');
    private readonly sourceButton = document.createElement('button');

    constructor(map: ConstructorParameters<typeof PhysicalMapController>[0], service: ConstructorParameters<typeof PhysicalMapController>[1],
        private readonly opener: OpenerService, private readonly openTab: (id: string) => Promise<void>,
        options?: PhysicalMapTabOptions) {
        super();
        this.id = options ? physicalMapTabId(options) : PHYSICAL_MAP_ID;
        this.title.label = options ? `Map: ${options.focusId}` : 'Physical Map';
        this.title.caption = 'Physical Map — current architecture';
        this.title.iconClass = codicon('type-hierarchy');
        this.title.closable = true;
        this.addClass('dope-physical-map-view');
        const bar = document.createElement('header');
        const title = document.createElement('h2');
        title.textContent = 'Physical Map';
        const up = document.createElement('button');
        up.type = 'button';
        up.textContent = 'Up';
        up.onclick = () => this.controller.up();
        this.focusButton.type = 'button';
        this.focusButton.textContent = 'Focus';
        this.focusButton.onclick = () => this.controller.focus();
        this.tabButton.type = 'button';
        this.tabButton.textContent = 'Open Selected Tab';
        this.tabButton.onclick = () => { const id = this.controller.selectedId; if (id) void this.openTab(id); };
        this.sourceButton.type = 'button';
        this.sourceButton.textContent = 'Open Source';
        this.sourceButton.onclick = () => void this.openSource();
        const fit = document.createElement('button');
        fit.type = 'button';
        fit.textContent = 'Fit Architecture';
        fit.onclick = () => this.controller.fit();
        bar.append(title, up, this.focusButton, this.tabButton, this.sourceButton, fit);
        this.breadcrumbs.setAttribute('aria-label', 'Map focus');
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.canvas.className = 'dope-physical-map-canvas';
        this.node.append(bar, this.breadcrumbs, this.status, this.canvas);
        this.controller = new PhysicalMapController(map, service, () => this.render(), options?.workspace, options?.focusId);
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.root = createRoot(this.canvas);
        this.render();
    }

    protected override onBeforeDetach(msg: Message): void {
        this.root?.unmount();
        this.root = undefined;
        this.flow = undefined;
        super.onBeforeDetach(msg);
    }

    private render(): void {
        if (!this.root) return;
        const { projection, loading, error } = this.controller;
        this.breadcrumbs.replaceChildren();
        const overview = document.createElement('button');
        overview.textContent = 'Project';
        overview.onclick = () => this.controller.fit();
        this.breadcrumbs.append(overview);
        for (const item of this.controller.breadcrumbs) {
            this.breadcrumbs.append(' / ');
            const button = document.createElement('button');
            button.textContent = item.name;
            button.onclick = () => this.controller.focus(item.id);
            this.breadcrumbs.append(button);
        }
        const selected = this.controller.selectedId;
        this.focusButton.disabled = !selected || !this.controller.projectMatches;
        this.tabButton.disabled = !selected || !this.controller.projectMatches;
        this.sourceButton.disabled = !selected || !this.controller.projectMatches;
        this.status.textContent = !this.controller.projectMatches ? 'This map tab belongs to another project.' :
            error ? `Physical Map: ${error}` : loading ? 'Loading Physical Map…' :
            projection.nodes.length ? `${this.controller.focusId ? 'Focused architecture' : projection.oneSystem ? 'One System overview' : 'Systems overview'} · ${projection.nodes.length} objects` :
                'No published architecture. Initialize or refresh the Software Map in the left inspector.';
        const nodes: Node[] = projection.nodes.map(item => ({
            id: item.id, type: 'architecture', position: { x: item.x, y: item.y },
            parentId: item.parentId, extent: item.parentId ? 'parent' : undefined,
            data: { item }, draggable: false, selectable: true, selected: item.id === selected,
            className: item.id === selected ? 'dope-map-selected' : item.context ? 'dope-map-context' : undefined,
            style: { width: item.width, height: item.height }
        }));
        const edges: Edge[] = projection.edges.map(item => ({
            id: item.id, source: item.source, target: item.target, label: item.kind === 'dependency' ? item.label : undefined,
            className: `dope-map-edge dope-map-edge-${item.kind} dope-map-edge-${item.state}`,
            type: item.kind === 'containment' ? 'straight' : 'smoothstep',
            selectable: false
        }));
        this.root.render(React.createElement(ReactFlow, {
            nodes, edges, nodeTypes, nodesDraggable: false, nodesConnectable: false, elementsSelectable: true,
            onNodeClick: (_event: React.MouseEvent, node: Node) => this.controller.select(node.id),
            onNodeDoubleClick: (_event: React.MouseEvent, node: Node) => this.controller.focus(node.id),
            fitView: true, fitViewOptions: { padding: 0.14 }, onInit: (flow: ReactFlowInstance) => { this.flow = flow; void flow.fitView({ padding: 0.14 }); },
            proOptions: { hideAttribution: true }
        }, React.createElement(Background), React.createElement(Controls, { showInteractive: false })));
        const graph = `${this.controller.focusId ?? ''}:${nodes.map(node => node.id).join('|')}`;
        if (nodes.length && graph !== this.renderedGraph) requestAnimationFrame(() => { if (!this.isDisposed) void this.flow?.fitView({ padding: 0.14 }); });
        this.renderedGraph = graph;
    }

    private async openSource(): Promise<void> {
        try {
            const location = await this.controller.source();
            if (!location || this.isDisposed) return;
            await open(this.opener, new URI(location.uri), location.span?.line ? { selection: {
                start: { line: location.span.line - 1, character: (location.span.column ?? 1) - 1 }
            } } : undefined);
        } catch (error) { if (!this.isDisposed) this.status.textContent = `Source navigation failed: ${String(error)}`; }
    }

    override dispose(): void {
        this.controller.dispose();
        this.root?.unmount();
        this.root = undefined;
        super.dispose();
    }
}
