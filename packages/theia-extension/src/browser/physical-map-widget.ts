import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ReactFlow, Background, Controls, type ReactFlowInstance, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BaseWidget, Message, codicon } from '@theia/core/lib/browser/widgets/widget';
import { PhysicalMapController } from './physical-map-controller';
import type { CanvasNode } from './physical-map-projection';
import './dope.css';

export const PHYSICAL_MAP_ID = 'dope-physical-map-canvas';

function MapNode({ data }: { data: { item: CanvasNode } }): React.ReactElement {
    const item = data.item;
    return React.createElement('div', { className: `dope-map-node dope-map-${item.kind} dope-map-${item.state}` },
        React.createElement('span', { className: 'dope-map-kind' }, item.kind === 'system' ? '▣ System' : item.kind === 'subsystem' ? '▤ Subsystem' : '◇ Implementation'),
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

    constructor(map: ConstructorParameters<typeof PhysicalMapController>[0], service: ConstructorParameters<typeof PhysicalMapController>[1]) {
        super();
        this.id = PHYSICAL_MAP_ID;
        this.title.label = 'Physical Map';
        this.title.caption = 'Physical Map — current architecture';
        this.title.iconClass = codicon('type-hierarchy');
        this.title.closable = true;
        this.addClass('dope-physical-map-view');
        const bar = document.createElement('header');
        const title = document.createElement('h2');
        title.textContent = 'Physical Map';
        const fit = document.createElement('button');
        fit.type = 'button';
        fit.textContent = 'Fit Architecture';
        fit.onclick = () => void this.flow?.fitView({ padding: 0.14 });
        bar.append(title, fit);
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.canvas.className = 'dope-physical-map-canvas';
        this.node.append(bar, this.status, this.canvas);
        this.controller = new PhysicalMapController(map, service, () => this.render());
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
        this.status.textContent = error ? `Physical Map: ${error}` : loading ? 'Loading Physical Map…' :
            projection.nodes.length ? `${projection.oneSystem ? 'One System overview' : 'Systems overview'} · ${projection.nodes.filter(node => node.kind === 'subsystem').length} Subsystems` :
                'No published architecture. Initialize or refresh the Software Map in the left inspector.';
        const nodes: Node[] = projection.nodes.map(item => ({
            id: item.id, type: 'architecture', position: { x: item.x, y: item.y },
            parentId: item.parentId, extent: item.parentId ? 'parent' : undefined,
            data: { item }, draggable: false, selectable: false,
            style: { width: item.width, height: item.height }
        }));
        const edges: Edge[] = projection.edges.map(item => ({
            id: item.id, source: item.source, target: item.target, label: item.kind === 'dependency' ? item.label : undefined,
            className: `dope-map-edge dope-map-edge-${item.kind} dope-map-edge-${item.state}`,
            type: item.kind === 'containment' ? 'straight' : 'smoothstep',
            selectable: false
        }));
        this.root.render(React.createElement(ReactFlow, {
            nodes, edges, nodeTypes, nodesDraggable: false, nodesConnectable: false, elementsSelectable: false,
            fitView: true, fitViewOptions: { padding: 0.14 }, onInit: (flow: ReactFlowInstance) => { this.flow = flow; void flow.fitView({ padding: 0.14 }); },
            proOptions: { hideAttribution: true }
        }, React.createElement(Background), React.createElement(Controls, { showInteractive: false })));
        if (nodes.length) requestAnimationFrame(() => { if (!this.isDisposed) void this.flow?.fitView({ padding: 0.14 }); });
    }

    override dispose(): void {
        this.controller.dispose();
        this.root?.unmount();
        this.root = undefined;
        super.dispose();
    }
}
