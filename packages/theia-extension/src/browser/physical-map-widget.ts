import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ReactFlow, Background, Handle, Position, type ReactFlowInstance, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BaseWidget, Message, codicon } from '@theia/core/lib/browser/widgets/widget';
import { OpenerService, open } from '@theia/core/lib/browser';
import { SingleTextInputDialog } from '@theia/core/lib/browser/dialogs';
import URI from '@theia/core/lib/common/uri';
import { PhysicalMapController, physicalMapTabId, type PhysicalMapTabOptions } from './physical-map-controller';
import type { CanvasNode } from './physical-map-projection';
import type { FlowCanvasNode } from './flow-map-projection';
import { MapViewport, mapFitContext, mapFitOptions } from './map-viewport';
import { mapLabel } from './map-label';
import { PlanningMapController } from './planning-map-controller';
import { projectPlanningMap, projectRebaseConflict, projectReconciliationResult } from './planning-map-projection';
import { affectedArchitecture, transformationsForArchitecture } from './planning-work-projection';
import type { EditCommand } from '@dope/visual-planning/lib/editing';
import type { PlannedNode, Resolution, WorkItem } from '@dope/visual-planning';
import { reconciliationRollups } from '@dope/visual-planning/lib/reconciliation';
import { SmapPresentationState, nodePalette, type NodePalette } from './smap-presentation-state';
import './dope.css';

export const PHYSICAL_MAP_ID = 'dope-physical-map-canvas';

function MapNode({ data }: { data: { item: CanvasNode & { intent?: string; stale?: boolean; conflict?: boolean }; editable?: boolean; color: NodePalette } }): React.ReactElement {
    const item = data.item;
    const connectable = !!data.editable && item.kind === 'subsystem';
    const hiddenHandle = connectable ? undefined : { opacity: 0, pointerEvents: 'none' as const };
    return React.createElement('div', { className: `dope-map-node dope-map-${item.kind} dope-map-${item.state} dope-map-color-${data.color}${item.intent ? ` dope-plan-${item.intent}` : ''}${item.stale ? ' dope-plan-stale' : ''}${item.conflict ? ' dope-plan-conflicted' : ''}` },
        React.createElement('span', { className: 'dope-map-kind' }, `${item.context ? '↗ ' : ''}${item.kind}`),
        React.createElement('strong', null, mapLabel(item.name)),
        React.createElement('small', { className: 'dope-map-badge', title: item.badge }, item.badge),
        React.createElement(Handle, { type: 'target', position: Position.Left, isConnectable: connectable, style: hiddenHandle }),
        React.createElement(Handle, { type: 'source', position: Position.Right, isConnectable: connectable, style: hiddenHandle }));
}
const nodeTypes = { architecture: MapNode };
function FlowNode({ data }: { data: { item: FlowCanvasNode } }): React.ReactElement {
    const item = data.item;
    return React.createElement('div', { className: `dope-flow-node dope-flow-${item.shape}` },
        React.createElement('span', { className: 'dope-map-kind' }, item.role),
        React.createElement('strong', null, mapLabel(item.name)),
        React.createElement(Handle, { type: 'target', position: Position.Left, style: { opacity: 0 } }),
        React.createElement(Handle, { type: 'source', position: Position.Right, style: { opacity: 0 } }));
}
const flowNodeTypes = { flow: FlowNode };

function iconButton(button: HTMLButtonElement, label: string, icon: string): void {
    button.type = 'button';
    button.title = label;
    button.setAttribute('aria-label', label);
    const glyph = document.createElement('span');
    glyph.className = codicon(icon);
    glyph.setAttribute('aria-hidden', 'true');
    button.replaceChildren(glyph);
}

export class PhysicalMapWidget extends BaseWidget {
    private async ask(title: string, initialValue = ''): Promise<string | undefined> {
        return (await new SingleTextInputDialog({ title, initialValue }).open())?.trim();
    }
    private readonly controller: PhysicalMapController;
    private readonly status = document.createElement('p');
    private readonly canvas = document.createElement('div');
    private root?: Root;
    private flow?: ReactFlowInstance;
    private readonly viewport = new MapViewport();
    private fitContext = '';
    private fitRequested = true;
    private fitQueued = false;
    private fitting = false;
    private readonly breadcrumbs = document.createElement('nav');
    private readonly upButton = document.createElement('button');
    private readonly focusButton = document.createElement('button');
    private readonly tabButton = document.createElement('button');
    private readonly sourceButton = document.createElement('button');
    private readonly colorSelect = document.createElement('select');
    private readonly planningBar = document.createElement('section');
    private readonly planningDetails = document.createElement('section');
    private readonly planningOverlay = document.createElement('div');
    private readonly inspection = document.createElement('aside');
    private readonly inspectionSummary = document.createElement('p');
    private readonly inspectionAction = document.createElement('button');
    private readonly expandInspection = document.createElement('button');
    private readonly compactInspection = document.createElement('button');
    private readonly minimizeInspection = document.createElement('button');
    private readonly workPanel = document.createElement('section');
    private readonly flowBar = document.createElement('section');
    private readonly flowPanel = document.createElement('section');
    private readonly modeBar = document.createElement('div');
    private readonly architectureButton = document.createElement('button');
    private readonly flowButton = document.createElement('button');
    private readonly planningListener;
    private readonly colorListener;
    private readonly heading = document.createElement('h2');
    private readonly focusedTab: boolean;
    private readonly flowId: string;
    private draftTitle = '';
    private draftObjective = '';

    constructor(map: ConstructorParameters<typeof PhysicalMapController>[0],
        private readonly opener: OpenerService, private readonly openTab: (id: string) => Promise<void>,
        private readonly planning: PlanningMapController, private readonly colors: SmapPresentationState,
        options?: PhysicalMapTabOptions) {
        super();
        this.focusedTab = !!options;
        this.id = options ? physicalMapTabId(options) : PHYSICAL_MAP_ID;
        // Retained map tabs need distinct, URL-safe SVG pattern references.
        this.flowId = `smap-${Array.from(this.id, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('')}`;
        this.title.label = options ? `Map: ${options.focusId}` : 'Physical Map';
        this.title.caption = 'Physical Map — current architecture';
        this.title.iconClass = codicon('type-hierarchy');
        this.title.closable = true;
        this.addClass('dope-physical-map-view');
        const bar = document.createElement('header');
        bar.className = 'dope-map-toolbar';
        bar.setAttribute('role', 'toolbar');
        bar.setAttribute('aria-label', 'Map controls');
        this.heading.textContent = 'Physical Map';
        const planningToggle = document.createElement('button');
        planningToggle.type = 'button';
        planningToggle.textContent = 'Planning Map';
        planningToggle.onclick = () => this.planning.setMode(!this.planning.planningMode);
        this.modeBar.className = 'dope-map-mode';
        this.modeBar.setAttribute('role', 'group');
        this.modeBar.setAttribute('aria-label', 'Physical Map view');
        this.architectureButton.textContent = 'Architecture';
        this.flowButton.textContent = 'Flow';
        this.architectureButton.onclick = () => this.controller.setMode('architecture');
        this.flowButton.onclick = () => this.controller.setMode('flow');
        this.modeBar.append(this.architectureButton, this.flowButton);
        iconButton(this.upButton, 'Move up one map level', 'arrow-up');
        this.upButton.onclick = () => { this.controller.setDetail('architecture'); this.controller.up(); };
        iconButton(this.focusButton, 'Focus selected map object', 'target');
        this.focusButton.onclick = () => { this.controller.setDetail('architecture'); this.controller.focus(); };
        iconButton(this.tabButton, 'Open selected object in a map tab', 'link-external');
        this.tabButton.onclick = () => { const id = this.controller.selectedId; if (id) void this.openTab(id); };
        iconButton(this.sourceButton, 'Open selected object source', 'go-to-file');
        this.sourceButton.onclick = () => void this.openSource();
        const fit = document.createElement('button');
        iconButton(fit, 'Fit current map at a readable scale', 'screen-full');
        fit.onclick = () => this.fitCurrentMap();
        const zoomIn = document.createElement('button');
        iconButton(zoomIn, 'Zoom in on map', 'zoom-in');
        zoomIn.onclick = () => void this.flow?.zoomIn();
        const zoomOut = document.createElement('button');
        iconButton(zoomOut, 'Zoom out on map', 'zoom-out');
        zoomOut.onclick = () => void this.flow?.zoomOut();
        this.colorSelect.setAttribute('aria-label', 'Selected node color');
        for (const color of nodePalette) {
            const option = document.createElement('option');
            option.value = color; option.textContent = color === 'default' ? 'Default' : color[0].toUpperCase() + color.slice(1);
            this.colorSelect.append(option);
        }
        this.colorSelect.onchange = () => {
            const id = this.controller.selectedId;
            if (id && !this.colorSelect.disabled) void this.colors.set(id, this.colorSelect.value as NodePalette)
                .catch(error => { this.status.textContent = `Node color could not be saved: ${String(error)}`; });
        };
        const colorLabel = document.createElement('label');
        colorLabel.append('Node color ', this.colorSelect);
        bar.append(this.heading, planningToggle, this.modeBar, this.upButton, this.focusButton, this.tabButton, this.sourceButton,
            zoomIn, zoomOut, fit, colorLabel, this.flowBar, this.planningBar);
        this.breadcrumbs.className = 'dope-map-breadcrumbs';
        this.breadcrumbs.setAttribute('aria-label', 'Map focus');
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.canvas.className = 'dope-physical-map-canvas';
        this.planningBar.className = 'dope-planning-bar';
        this.planningDetails.className = 'dope-planning-details';
        this.planningOverlay.className = 'dope-planning-inspection';
        this.workPanel.className = 'dope-work-panel';
        this.workPanel.setAttribute('aria-label', 'Planning work');
        this.flowBar.className = 'dope-flow-bar';
        this.flowPanel.className = 'dope-flow-panel';
        this.flowPanel.setAttribute('aria-label', 'Flow inspection');
        this.inspection.className = 'dope-map-inspection';
        this.inspection.setAttribute('aria-label', 'Map inspection');
        const inspectionHeader = document.createElement('div');
        inspectionHeader.className = 'dope-map-inspection-header';
        this.inspectionSummary.className = 'dope-map-inspection-summary';
        iconButton(this.expandInspection, 'Expand map inspection', 'chevron-up');
        iconButton(this.compactInspection, 'Compact map inspection', 'chevron-down');
        iconButton(this.minimizeInspection, 'Minimize map inspection', 'chrome-minimize');
        this.expandInspection.onclick = () => this.setInspectionState('expanded');
        this.compactInspection.onclick = () => this.setInspectionState('compact');
        this.minimizeInspection.onclick = () => this.setInspectionState('minimized');
        this.inspectionAction.type = 'button';
        inspectionHeader.append(this.inspectionSummary, this.inspectionAction, this.expandInspection,
            this.compactInspection, this.minimizeInspection);
        this.inspection.append(inspectionHeader, this.flowPanel, this.planningOverlay);
        this.setInspectionState('expanded');
        const stage = document.createElement('div');
        stage.className = 'dope-map-stage';
        this.planningOverlay.append(this.planningDetails, this.workPanel);
        stage.append(this.canvas, this.inspection, this.status);
        this.node.append(bar, this.breadcrumbs, stage);
        this.controller = new PhysicalMapController(map, () => this.render(), options?.workspace, options?.focusId);
        this.planningListener = planning.onChange(() => {
            if (planning.planningMode && this.controller.mode === 'flow') this.controller.setMode('architecture');
            this.render();
        });
        this.colorListener = colors.onChange(() => this.render());
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
        this.fitRequested = true;
        super.onBeforeDetach(msg);
    }

    private setInspectionState(state: 'expanded' | 'compact' | 'minimized'): void {
        this.inspection.dataset.state = state;
        this.expandInspection.hidden = state === 'expanded';
        this.compactInspection.hidden = state !== 'expanded';
        this.minimizeInspection.hidden = state === 'minimized';
        this.expandInspection.setAttribute('aria-pressed', String(state === 'expanded'));
        this.compactInspection.setAttribute('aria-pressed', String(state === 'compact'));
        this.minimizeInspection.setAttribute('aria-pressed', String(state === 'minimized'));
    }

    private inspectionActionFor(label: string | undefined, icon: string, action: () => void): void {
        this.inspectionAction.hidden = !label;
        if (!label) return;
        iconButton(this.inspectionAction, label, icon);
        this.inspectionAction.disabled = false;
        this.inspectionAction.onclick = action;
    }

    private render(): void {
        if (!this.root) return;
        void this.colors.attach(this.controller.mapWorkspace);
        const { loading, error } = this.controller;
        const selectedMap = this.planning.selected;
        const planningMode = this.planning.planningMode;
        const flowMode = !planningMode && this.controller.mode === 'flow';
        const context = mapFitContext(this.controller.mapWorkspace, this.controller.mapGeneration, this.controller.focusId,
            planningMode ? 'planning' : flowMode ? 'flow' : 'physical', planningMode ? selectedMap?.id : undefined,
            planningMode ? this.planning.view : 'current');
        if (context !== this.fitContext) {
            this.fitContext = context;
            this.fitRequested = true;
            if (!flowMode && this.controller.detail !== 'architecture') { this.controller.setDetail('architecture'); return; }
        }
        this.heading.textContent = planningMode ? 'Planning Map' : 'Physical Map';
        if (!this.focusedTab) this.title.label = planningMode ? 'Planning Map' : 'Physical Map';
        this.modeBar.hidden = planningMode;
        this.upButton.disabled = !this.controller.focusId || !this.controller.projectMatches;
        this.architectureButton.setAttribute('aria-pressed', String(!flowMode));
        this.flowButton.setAttribute('aria-pressed', String(flowMode));
        const projection = planningMode && selectedMap ? projectPlanningMap(
            this.controller.sourceNodes, this.controller.sourceRelationships, this.controller.sourceViolations,
            selectedMap, this.planning.view, this.controller.focusId, this.planning.stale,
            { detail: this.controller.detail, selectedId: this.controller.selectedId }) : this.controller.projection;
        this.controller.clearPlannedSelectionIfAbsent(projection.nodes.map(node => node.id));
        this.renderPlanningBar();
        this.renderWorkPanel();
        this.planningOverlay.hidden = !planningMode;
        this.inspectionSummary.textContent = planningMode ?
            `${this.planning.selectedWorkItem ? `Work: ${this.planning.selectedWorkItem.title}` :
                this.planning.selectedTransformationId ? `Change: ${this.planning.selectedTransformationId}` :
                    projection.nodes.find(node => node.id === this.controller.selectedId)?.name ?? (selectedMap ? `Plan: ${selectedMap.title}` : 'Planning Map')} · ${this.planning.stale?.stale ? 'stale' : selectedMap?.status ?? 'no map'}` :
            `${projection.nodes.find(node => node.id === this.controller.selectedId)?.name ?? 'Architecture'} · ${projection.nodes.length} objects`;
        this.inspectionActionFor(planningMode ? 'Review Planning work and details' : this.controller.sourceNodes.some(node => node.id === this.controller.selectedId) ? 'Open selected object source' : undefined,
            planningMode ? 'edit' : 'go-to-file', () => planningMode ? this.setInspectionState('expanded') : void this.openSource());
        this.breadcrumbs.replaceChildren();
        const overview = document.createElement('button');
        overview.textContent = 'Project';
        overview.onclick = () => { this.controller.setDetail('architecture'); this.controller.fit(); };
        this.breadcrumbs.append(overview);
        for (const item of this.controller.breadcrumbs) {
            this.breadcrumbs.append(' / ');
            const button = document.createElement('button');
            button.textContent = item.name;
            button.onclick = () => { this.controller.setDetail('architecture'); this.controller.focus(item.id); };
            this.breadcrumbs.append(button);
        }
        if (flowMode) { this.renderFlow(); return; }
        this.flowBar.hidden = true; this.flowPanel.hidden = true;
        const selected = this.controller.selectedId;
        const selectedNode = projection.nodes.find(node => node.id === selected &&
            (node.kind === 'system' || node.kind === 'subsystem' || node.kind === 'component'));
        this.colorSelect.disabled = !this.controller.projectMatches || !selectedNode;
        this.colorSelect.value = selectedNode ? this.colors.get(selectedNode.id) : 'default';
        const selectedPhysical = !!selected && this.controller.sourceNodes.some(node => node.id === selected);
        const highlighted = planningMode && selectedMap && this.planning.selectedWorkItem ?
            new Set(affectedArchitecture(selectedMap, this.planning.selectedWorkItem.transformationIds, this.controller.sourceNodes)) : new Set<string>();
        this.focusButton.disabled = !selectedPhysical || !this.controller.projectMatches;
        this.tabButton.disabled = !selectedPhysical || !this.controller.projectMatches;
        this.sourceButton.disabled = !selectedPhysical || !this.controller.projectMatches;
        this.status.textContent = !this.controller.projectMatches ? 'This map tab belongs to another project.' :
            this.planning.error ? `Planning Map: ${this.planning.error}` :
            error ? `Physical Map: ${error}` : loading ? 'Loading Physical Map…' :
            planningMode && !selectedMap ? 'Create or select a Planning Map.' :
            planningMode && this.planning.stale?.stale ? `⚠ Stale Planning Map · ${this.planning.stale.affectedTransformationIds.length} affected transformations · ${this.planning.stale.affectedBranchIds.length} affected branches` :
            projection.nodes.length ? `${this.controller.focusId ? 'Focused architecture' : projection.oneSystem ? 'One System overview' : 'Systems overview'} · ${projection.nodes.length} objects` :
                'No published architecture. Initialize or refresh the Software Map in the left inspector.';
        const nodes: Node[] = projection.nodes.map(item => ({
            id: item.id, type: 'architecture', position: { x: item.x, y: item.y },
            parentId: item.parentId,
            data: { item, editable: planningMode && !!selectedMap, color: this.colors.get(item.id) }, draggable: planningMode &&
                (item.kind === 'subsystem' || item.kind === 'component'), selectable: true, selected: item.id === selected,
            className: item.id === selected ? 'dope-map-selected' : highlighted.has(item.id) ? 'dope-work-highlight' : item.context ? 'dope-map-context' : undefined,
            style: { width: item.width, height: item.height }
        }));
        const edges: Edge[] = projection.edges.map(item => ({
            id: item.id, source: item.source, target: item.target, label: item.kind === 'dependency' ? item.label : undefined,
            className: `dope-map-edge dope-map-edge-${item.kind} dope-map-edge-${item.state}${item.kind === 'dependency' && (item.source === selected || item.target === selected) ? ' dope-map-edge-selected' : ''}${'intent' in item && item.intent ? ` dope-plan-edge-${item.intent}` : ''}${'stale' in item && item.stale ? ' dope-plan-edge-stale' : ''}`,
            type: item.kind === 'containment' ? 'straight' : 'smoothstep',
            selectable: false
        }));
        this.root.render(React.createElement(ReactFlow, {
            id: this.flowId,
            nodes, edges, nodeTypes, minZoom: 0.01, nodesDraggable: planningMode, nodesConnectable: planningMode, elementsSelectable: true,
            onNodeClick: (_event: React.MouseEvent, node: Node) => { if (planningMode && !this.controller.sourceNodes.some(item => item.id === node.id))
                    this.controller.selectPlanned(node.id);
                else this.controller.select(node.id);
                if (planningMode && selectedMap) this.planning.selectTransformation(transformationsForArchitecture(selectedMap, node.id, this.controller.sourceNodes)[0]); },
            onNodeDoubleClick: (_event: React.MouseEvent, node: Node) => { this.controller.setDetail('architecture'); this.controller.focus(node.id); },
            onNodeDragStop: (_event: MouseEvent | TouchEvent, node: Node) => {
                const kind = (node.data.item as CanvasNode).kind;
                const parents = this.flow?.getIntersectingNodes(node).filter(item =>
                    (item.data.item as CanvasNode).kind === (kind === 'component' ? 'subsystem' : 'system') && item.id !== node.parentId) ?? [];
                if (parents.length === 1) void this.planning.beginEdit({ kind: 'move', id: node.id, parentId: parents[0].id });
                else if (parents.length) this.status.textContent = 'Ambiguous move: drop on one parent boundary.';
                this.render();
            },
            onConnect: connection => { if (connection.source && connection.target) void this.planning.beginEdit({
                kind: 'draw-relationship', sourceId: connection.source, targetId: connection.target }); },
            onInit: (flow: ReactFlowInstance) => { this.flow = flow; this.queueFit(); },
            onMoveEnd: (_event: MouseEvent | TouchEvent | null, viewport: { zoom: number }) => {
                if (!this.fitting && !this.fitRequested) this.controller.setDetail(this.viewport.detail(viewport.zoom, this.controller.detail));
            },
            proOptions: { hideAttribution: true }
        }, React.createElement(Background, { id: this.flowId })));
        if (nodes.length && !loading) this.queueFit();
    }

    private renderFlow(): void {
        const controller = this.controller, projection = controller.flowProjection;
        this.planningBar.hidden = true; this.workPanel.hidden = true;
        this.flowBar.hidden = false; this.flowPanel.hidden = false;
        const selected = controller.flowSelectedId;
        const traceable = !!selected && !!controller.flowResult;
        this.focusButton.disabled = !controller.flowResult?.groups?.some(group => group.id === controller.selectedGroupId && !!group.focusId) &&
            (!selected || !controller.sourceNodes.some(node => node.id === selected));
        this.tabButton.disabled = !selected || !controller.sourceNodes.some(node => node.id === selected);
        this.sourceButton.disabled = !selected || !controller.sourceNodes.some(node => node.id === selected);
        this.colorSelect.disabled = true;
        const selectedEdge = controller.selectedFlowEdge;
        const selectedNode = projection?.nodes.find(item => item.id === controller.selectedGroupId || item.id === selected);
        this.inspectionSummary.textContent = `${selectedEdge ? `Edge: ${selectedEdge.source} → ${selectedEdge.target}` : selectedNode ?
            `${selectedNode.role}: ${selectedNode.name}` : 'Static Flow'} · ${projection?.coverageStatus ?? 'loading'}${projection?.truncated ? ' · truncated' : ''}`;
        const selectedGroup = controller.flowResult?.groups?.find(group => group.id === controller.selectedGroupId);
        this.inspectionActionFor(selectedEdge ? 'Open selected Flow edge evidence source' : selectedGroup?.focusId ? 'Focus selected Flow Subsystem' :
            selected ? 'Trace downstream from selected Flow participant' : undefined,
            selectedEdge ? 'go-to-file' : selectedGroup?.focusId ? 'target' : 'arrow-right',
            () => selectedEdge ? void this.openSource(true) : selectedGroup?.focusId ? controller.focus(selectedGroup.id) : controller.trace('downstream'));
        this.inspectionAction.disabled = selectedEdge ? !selectedEdge.evidenceIds.length : false;
        this.flowBar.replaceChildren();
        const button = (label: string, action: () => void, disabled = false) => {
            const control = document.createElement('button');
            iconButton(control, label === 'Trace downstream' ? 'Trace possible execution downstream from selection' :
                label === 'Trace upstream' ? 'Trace possible execution upstream from selection' : 'Clear current Flow trace',
                label === 'Trace downstream' ? 'arrow-right' : label === 'Trace upstream' ? 'arrow-left' : 'clear-all');
            control.disabled = disabled; control.onclick = action;
            this.flowBar.append(control); return control;
        };
        button('Trace downstream', () => controller.trace('downstream'), !traceable).setAttribute('aria-pressed', String(controller.direction === 'downstream'));
        button('Trace upstream', () => controller.trace('upstream'), !traceable).setAttribute('aria-pressed', String(controller.direction === 'upstream'));
        button('Clear trace', () => controller.trace(), !controller.direction);
        const label = document.createElement('span');
        label.textContent = `Static Flow · ${controller.direction ? `tracing ${controller.direction}` : 'possible execution'}`;
        this.flowBar.append(label);
        this.flowPanel.replaceChildren();
        if (projection) {
            if (!controller.direction && controller.flowResult?.aggregation) {
                const summary = document.createElement('p');
                const aggregation = controller.flowResult.aggregation;
                summary.textContent = `Architectural overview: ${aggregation.sourceFacts} evidenced interactions summarized as ${aggregation.shownRelationships} relationships; ${aggregation.groupedParticipants} participants grouped`;
                this.flowPanel.append(summary);
                if (aggregation.unassignedInvocations) {
                    const unassigned = document.createElement('p');
                    unassigned.textContent = `${aggregation.unassignedInvocations} invocation facts involve code without accepted ownership; open Unassigned code to trace them`;
                    this.flowPanel.append(unassigned);
                }
            }
            const coverage = document.createElement('p');
            coverage.textContent = `Coverage: ${projection.coverageStatus}${projection.truncated ?
                ` · ${projection.truncation.continueFromIds.length} continuation points` : ''}`;
            this.flowPanel.append(coverage);
            const coverageDetails = document.createElement('details');
            const coverageSummary = document.createElement('summary');
            coverageSummary.textContent = `${projection.coverage.length} coverage areas · ${projection.diagnostics.length} diagnostics`;
            coverageDetails.append(coverageSummary);
            for (const item of projection.coverage) {
                const line = document.createElement('p');
                line.textContent = `${item.scopeId}: ${item.status} Flow coverage`;
                coverageDetails.append(line);
            }
            for (const item of projection.diagnostics) {
                const line = document.createElement('p'); line.textContent = `⚠ ${item.code}: ${item.message}`;
                coverageDetails.append(line);
            }
            this.flowPanel.append(coverageDetails);
            const participants = document.createElement('details');
            const summary = document.createElement('summary'); summary.textContent = 'Flow participants'; participants.append(summary);
            for (const item of projection.nodes) {
                const control = document.createElement('button'); control.type = 'button';
                control.textContent = `${item.role} · ${item.name}`;
                control.setAttribute('aria-pressed', String(item.selected));
                control.onclick = () => controller.select(item.id);
                participants.append(control);
            }
            this.flowPanel.append(participants);
            const group = controller.flowResult?.groups?.find(item => item.id === controller.selectedGroupId);
            if (group) {
                const details = document.createElement('section');
                details.setAttribute('aria-label', 'Grouped Flow participants');
                const title = document.createElement('p'); title.textContent = `${group.name} · ${group.memberIds.length} evidenced members`;
                details.append(title);
                if (group.focusId) button('Focus Subsystem', () => controller.focus(group.id));
                for (const member of group.members) {
                    const control = document.createElement('button'); control.type = 'button';
                    control.textContent = member.name;
                    control.onclick = () => controller.select(member.id);
                    details.append(control);
                }
                this.flowPanel.append(details);
            }
            const edgeList = document.createElement('div');
            edgeList.className = 'dope-flow-edge-list';
            edgeList.setAttribute('aria-label', 'Flow edges');
            const edgeDetails = document.createElement('details');
            const edgeSummary = document.createElement('summary'); edgeSummary.textContent = `${projection.edges.length} evidenced relationships`;
            edgeDetails.append(edgeSummary);
            for (const edge of projection.edges) {
                const control = document.createElement('button'); control.type = 'button';
                control.textContent = `${edge.source} → ${edge.target} · ${edge.label}`;
                control.setAttribute('aria-pressed', String(controller.selectedFlowEdgeId === edge.id));
                control.onclick = () => void controller.inspectFlowEdge(edge.id);
                edgeList.append(control);
            }
            edgeDetails.append(edgeList); this.flowPanel.append(edgeDetails);
            const edge = controller.selectedFlowEdge;
            if (edge) {
                const details = document.createElement('section');
                details.setAttribute('aria-label', 'Selected Flow edge');
                const line = (value: string) => { const p = document.createElement('p'); p.textContent = value; details.append(p); };
                const name = (id: string) => projection.nodes.find(node => node.id === id)?.name ?? id;
                line(`${edge.kind} · ${name(edge.source)} (${edge.source}) → ${name(edge.target)} (${edge.target})`);
                const origins = document.createElement('details');
                const originSummary = document.createElement('summary');
                originSummary.textContent = `${edge.originFlowFactIds.length} backing interactions · expand for detail traces`;
                origins.append(originSummary);
                for (const origin of edge.originParticipants) {
                    const control = document.createElement('button'); control.type = 'button';
                    const source = controller.sourceNodes.find(node => node.id === origin.sourceId)?.name ??
                        controller.flowResult?.groups?.flatMap(group => group.members).find(member => member.id === origin.sourceId)?.name ?? origin.sourceId;
                    control.textContent = `${source} · trace downstream`;
                    control.title = origin.id;
                    control.onclick = () => controller.traceOrigin(origin.sourceId);
                    origins.append(control);
                }
                if (!edge.originParticipants.length) for (const id of edge.originFlowFactIds) {
                    const item = document.createElement('p'); item.textContent = id; origins.append(item);
                }
                details.append(origins);
                if (edge.projectionVariants.length > 1)
                    line(`${edge.projectionVariants.length} detail variants; shared data/behavior semantics remain unresolved at this level`);
                if (edge.async || edge.retry || edge.error)
                    line(`Behavior: ${[edge.async && 'async', edge.retry && 'retry', edge.error && 'error'].filter(Boolean).join(', ')}`);
                line(edge.enrichment.length ? `Data semantics: ${edge.enrichment.map(item => `${item.kind} ${item.label}`).join('; ')}` :
                    'Data semantics unresolved');
                line(`Evidence: ${edge.evidenceIds.length} source records`);
                for (const evidence of controller.flowEvidence)
                    line(`${evidence.id} · ${evidence.class} · ${evidence.producer} ${evidence.path ?? ''}${evidence.span?.line ? `:${evidence.span.line}` : ''}`);
                if (projection.coverageStatus !== 'complete') line(`Flow coverage: ${projection.coverageStatus}`);
                const source = document.createElement('button'); source.type = 'button';
                source.textContent = 'Open edge source'; source.disabled = !edge.evidenceIds.length;
                source.onclick = () => void this.openSource(true); details.append(source);
                this.flowPanel.append(details);
            }
        }
        this.status.textContent = !controller.projectMatches ? 'This map tab belongs to another project.' :
            controller.error ? `Flow: ${controller.error}` : controller.loading ? 'Loading Static Flow…' :
            projection ? `${projection.nodes.length} Flow participants · ${projection.edges.length} evidenced interactions` :
                'Focus a System to inspect Static Flow.';
        const nodes: Node[] = projection?.nodes.map(item => ({ id: item.id, type: 'flow',
            position: { x: item.x, y: item.y }, data: { item }, draggable: false, selectable: true,
            selected: item.selected, className: `${item.subdued ? 'dope-flow-subdued ' : ''}${item.selected ? 'dope-flow-selected' : ''}`,
            style: { width: item.width, height: item.height } })) ?? [];
        const edges: Edge[] = projection?.edges.map(item => ({ id: item.id, source: item.source, target: item.target,
            label: [item.label, ...item.enrichment.map(value => value.label), item.async ? 'async' : '',
                item.retry ? 'retry' : '', item.error ? 'error' : ''].filter(Boolean).join(' · '),
            type: item.backEdge ? 'smoothstep' : 'default', animated: item.async,
            className: `dope-flow-edge${item.subdued ? ' dope-flow-subdued' : ''}${item.selected ? ' dope-flow-selected' : ''}${item.backEdge ? ' dope-flow-back' : ''}`,
            selectable: true, selected: controller.selectedFlowEdgeId === item.id })) ?? [];
        this.root?.render(React.createElement(ReactFlow, { id: this.flowId, nodes, edges, nodeTypes: flowNodeTypes,
            minZoom: 0.01, nodesDraggable: false, nodesConnectable: false, elementsSelectable: true,
            onNodeClick: (_event: React.MouseEvent, node: Node) => controller.select(node.id),
            onNodeDoubleClick: (_event: React.MouseEvent, node: Node) => controller.focus(node.id),
            onEdgeClick: (_event: React.MouseEvent, edge: Edge) => void controller.inspectFlowEdge(edge.id),
            onInit: (flow: ReactFlowInstance) => { this.flow = flow; this.queueFit(); },
            proOptions: { hideAttribution: true }
        }, React.createElement(Background, { id: this.flowId })));
        if (nodes.length && !controller.loading) this.queueFit();
    }

    private fitCurrentMap(): void {
        this.fitRequested = true;
        if (this.controller.mode !== 'flow') this.controller.setDetail('architecture');
        this.queueFit();
    }

    private queueFit(): void {
        if (!this.fitRequested || this.fitQueued || this.fitting || !this.flow || this.controller.loading ||
            !(this.controller.mode === 'flow' ? this.controller.flowProjection?.nodes.length : this.controller.projection.nodes.length)) return;
        this.fitQueued = true;
        requestAnimationFrame(async () => {
            this.fitQueued = false;
            if (!this.fitRequested || !this.flow || this.isDisposed || this.controller.loading) return;
            this.fitRequested = false;
            this.fitting = true;
            try {
                await this.flow.fitView(mapFitOptions(this.controller.mode === 'flow' && !!this.controller.focusId));
                this.viewport.fitted(this.flow.getZoom());
            } finally { this.fitting = false; this.queueFit(); }
        });
    }

    private renderPlanningBar(): void {
        const bar = this.planningBar, details = this.planningDetails;
        bar.replaceChildren(); details.replaceChildren();
        if (!this.planning.planningMode) { bar.hidden = true; details.hidden = true; return; }
        bar.hidden = false;
        details.hidden = false;
        const button = (label: string, action: () => void, disabled = false, parent = details) => {
            const control = document.createElement('button');
            control.type = 'button'; control.textContent = label; control.disabled = disabled;
            control.onclick = action; parent.append(control); return control;
        };
        const maps = document.createElement('select');
        maps.setAttribute('aria-label', 'Planning Map');
        for (const map of this.planning.visibleMaps) {
            const option = document.createElement('option'); option.value = map.id;
            option.textContent = `${map.title} · ${map.status}${map.branchedFrom ? ' · branch' : ''}`;
            maps.append(option);
        }
        maps.value = this.planning.selectedMapId ?? '';
        maps.onchange = () => this.planning.select(maps.value);
        bar.append(maps);
        const history = document.createElement('label');
        const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = this.planning.showHistory;
        checkbox.onchange = () => this.planning.setHistory(checkbox.checked);
        history.append(checkbox, 'History'); bar.append(history);
        button('Refresh', () => void this.planning.refresh(), this.planning.loading, bar);
        const title = document.createElement('input'); title.placeholder = 'Map title'; title.setAttribute('aria-label', 'New map title');
        title.value = this.draftTitle; title.oninput = () => { this.draftTitle = title.value; };
        const objective = document.createElement('input'); objective.placeholder = 'Objective'; objective.setAttribute('aria-label', 'New map objective');
        objective.value = this.draftObjective; objective.oninput = () => { this.draftObjective = objective.value; };
        details.append(title, objective);
        button('Create', () => { if (title.value.trim() && objective.value.trim()) {
            void this.planning.create(title.value.trim(), objective.value.trim()); this.draftTitle = ''; this.draftObjective = '';
        } },
            !this.planning.canCreate || this.planning.loading || !this.controller.projectMatches);
        button('Branch alternative', () => void this.planning.duplicate(), !this.planning.selected || this.planning.loading);
        const editable = !!this.planning.selected && ['draft', 'active'].includes(this.planning.selected.status) &&
            !this.planning.loading && this.controller.projectMatches;
        button('Add target', async () => {
            const kind = await this.ask('Kind: system, subsystem, component');
            if (kind !== 'system' && kind !== 'subsystem' && kind !== 'component') return;
            const id = await this.ask('Stable target ID'), name = await this.ask('Name'), purpose = await this.ask('Purpose');
            const parentId = kind === 'system' ? undefined : await this.ask('Parent ID', this.controller.selectedId ?? '');
            const roots = await this.ask('Project-relative roots, comma separated');
            if (!id || !name || !purpose || roots === undefined || (kind !== 'system' && !parentId)) return;
            const node: PlannedNode = { id, kind, name, purpose, roots: roots.split(',').map(s => s.trim()).filter(Boolean),
                ...(parentId ? { parentId } : {}) };
            void this.planning.beginEdit({ kind: 'add', node });
        }, !editable);
        button('Move selected', async () => { const id = this.controller.selectedId, parentId = await this.ask('New parent ID');
            if (id && parentId) void this.planning.beginEdit({ kind: 'move', id, parentId }); }, !editable || !this.controller.selectedId);
        button('Remove from target', () => { const id = this.controller.selectedId;
            if (id) void this.planning.beginEdit({ kind: 'remove', id }); }, !editable || !this.controller.selectedId);
        button('Redirect dependency', async () => {
            const sourceId = await this.ask('Source Subsystem ID'), oldTarget = await this.ask('Current target Subsystem ID');
            const targetId = await this.ask('New target Subsystem ID'), policy = await this.ask('Policy: allowed or forbidden', 'allowed');
            if (sourceId && oldTarget && targetId && (policy === 'allowed' || policy === 'forbidden'))
                void this.planning.beginEdit({ kind: 'redirect-relationship',
                    from: { sourceId, targetId: oldTarget, policy }, to: { sourceId, targetId, policy } });
        }, !editable);
        for (const kind of ['modify', 'split', 'merge', 'change-contract'] as const) button(kind, async () => {
            const ids = await this.ask('Current IDs, comma separated', this.controller.selectedId ?? '');
            const json = await this.ask('Future nodes JSON array (id, kind, parentId, name, purpose, roots)');
            if (!ids || !json) return;
            try {
                const futureNodes = JSON.parse(json) as PlannedNode[];
                const command: EditCommand = { kind, currentIds: ids.split(',').map(s => s.trim()), futureNodes };
                void this.planning.beginEdit(command);
            } catch { this.status.textContent = 'Invalid future nodes JSON'; }
        }, !editable);
        button('Undo', () => void this.planning.undo(), !editable || !this.planning.canUndo);
        button('Redo', () => void this.planning.redo(), !editable || !this.planning.canRedo);
        if (this.planning.stale?.stale) {
            const summary = document.createElement('p'); summary.className = 'dope-plan-stale-summary';
            summary.textContent = `⚠ Stale map · branches: ${this.planning.stale.affectedBranchIds.join(', ') || 'unresolved'} · transformations: ${this.planning.stale.affectedTransformationIds.join(', ')}`;
            details.append(summary);
            button('Review three-way rebase', () => void this.planning.beginRebase(), !editable);
        }
        if (this.planning.rebasePreview) {
            const { result, decisions } = this.planning.rebasePreview;
            const section = document.createElement('section'); section.className = 'dope-rebase-workspace';
            const heading = document.createElement('h3'); heading.textContent = 'Three-way rebase'; section.append(heading);
            for (const [title, value] of [
                ['Old basis', `${result.oldBasis.architectureFingerprint} · Physical ${result.oldBasis.physicalGeneration}`],
                ['Current reality', `${result.currentBasis.architectureFingerprint} · Physical ${result.currentBasis.physicalGeneration}`],
                ['Target intent', `${this.planning.selected?.transformations.map(t => `${t.id}: ${t.kind}`).join(', ') ?? ''}`]
            ]) { const line = document.createElement('p'); line.textContent = `${title}: ${value}`; section.append(line); }
            const unaffected = document.createElement('p'); unaffected.textContent = `Unaffected references advance: ${result.unaffectedTransformationIds.join(', ') || 'none'}`; section.append(unaffected);
            for (const conflict of result.conflicts) {
                const row = document.createElement('div'); row.className = 'dope-rebase-conflict';
                const label = document.createElement('span'); label.textContent = `⚠ ${conflict.transformationId} · ${conflict.identityId} · ${conflict.reason}: ${conflict.evidence.join('; ')}`;
                const comparison = projectRebaseConflict(this.planning.selected!, result, conflict);
                const threeWay = document.createElement('p'); threeWay.textContent = `Old basis: ${comparison.old} → Current reality: ${comparison.current} → Target intent: ${comparison.target}`;
                const select = document.createElement('select'); select.setAttribute('aria-label', `Resolve ${conflict.transformationId} ${conflict.reason}`);
                for (const [value, caption] of [['', 'Unresolved'], ['keep-target', 'Keep target intent'], ['accept-different', 'Accept different outcome'], ['replace-reference', 'Replace reference']] as const) {
                    const option = document.createElement('option'); option.value = value; option.textContent = caption; select.append(option);
                }
                const replacement = document.createElement('input'); replacement.placeholder = 'Replacement canonical ID'; replacement.setAttribute('aria-label', `Replacement for ${conflict.identityId}`);
                const prior = decisions.find(d => d.transformationId === conflict.transformationId && d.identityId === conflict.identityId && d.reason === conflict.reason);
                select.value = prior?.action ?? ''; replacement.value = prior?.replacementId ?? '';
                const decide = () => { if (!select.value) return; this.planning.decideRebase({ ...conflict, action: select.value as 'keep-target' | 'accept-different' | 'replace-reference',
                    ...(select.value === 'replace-reference' ? { replacementId: replacement.value.trim() } : {}) }); };
                select.onchange = decide; replacement.onchange = decide;
                row.append(label, threeWay, select, replacement); section.append(row);
            }
            details.append(section);
            button('Accept rebase', () => void this.planning.acceptRebase(), !editable || decisions.length !== result.conflicts.length);
            button('Cancel rebase · keep old basis', () => this.planning.cancelRebase());
        }
        if (this.planning.preview) {
            const preview = document.createElement('pre');
            const change = this.planning.preview.transformation;
            preview.textContent = `Preview ${change.kind}\n${JSON.stringify(change, null, 2)}`;
            details.append(preview);
            button('Commit change', () => void this.planning.commitEdit(), !editable);
            button('Cancel change', () => this.planning.cancelEdit());
        }
        const selectedNode = this.controller.sourceNodes.find(node => node.id === this.controller.selectedId);
        button('Preview branch adoption', async () => {
            const kind = await this.ask('Branch kind: system, subsystem, component', selectedNode?.kind ?? 'system');
            const id = await this.ask('Branch ID', selectedNode?.id ?? '');
            if (id && (kind === 'system' || kind === 'subsystem' || kind === 'component'))
                void this.planning.beginAdoption({ kind, id });
        }, !editable);
        button('Preview transformation set adoption', async () => {
            const ids = await this.ask('Transformation IDs, comma separated', this.planning.selectedTransformationId ?? '');
            if (ids) void this.planning.beginAdoption({ kind: 'transformations', ids: ids.split(',').map(id => id.trim()).filter(Boolean) });
        }, !editable);
        if (this.planning.adoptionPreview) {
            const result = this.planning.adoptionPreview.result;
            const preview = document.createElement('pre');
            preview.textContent = `Adopt Target · ${JSON.stringify(result.scope)}\nSelected: ${result.selectedTransformationIds.join(', ')}\nIncluded dependencies: ${result.includedDependentTransformationIds.join(', ') || 'none'}\nCanonical diff:\n${JSON.stringify(result.changes, null, 2)}\nBlockers: ${result.blockers.join('; ') || 'none'}`;
            details.append(preview);
            button('Accept canonical diff and adopt', () => void this.planning.acceptAdoption(), !editable || !!result.blockers.length);
            button('Cancel adoption', () => this.planning.cancelAdoption());
        }
        const selected = this.planning.selected;
        if (selected && (selected.status === 'active' || selected.status === 'completed')) {
            button('Analyze and reconcile', () => void this.planning.reconcile(), selected.status !== 'active' || !editable);
            const report = selected.reconciliation;
            if (report) {
                const summary = document.createElement('p');
                summary.textContent = `Reconciliation · Physical generation ${report.basis.physicalGeneration} · input ${report.basis.physicalInputFingerprint} · ${JSON.stringify(reconciliationRollups(selected).map)}`;
                details.append(summary);
                for (const result of report.results) {
                    const row = document.createElement('p');
                    row.textContent = projectReconciliationResult(result);
                    details.append(row);
                    if (!result.transformationId || selected.status !== 'active') continue;
                    const change = selected.transformations.find(t => t.id === result.transformationId)!;
                    const options = result.outcome === 'implemented-as-planned' ? [['as-planned', 'Resolve as planned']] :
                        result.outcome === 'implemented-differently' ? [['accepted-different', 'Accept intentionally different']] : [];
                    for (const [resolution, label] of [...options, ['deferred', 'Defer'], ['abandoned', 'Abandon']]) button(
                        `${label}: ${change.id}`, async () => {
                            const target = resolution === 'deferred' ? await this.ask('Destination Planning Map ID') : undefined;
                            if (resolution !== 'deferred' || target) void this.planning.disposition(change.id,
                                resolution as Resolution, target);
                        }, !editable || change.resolution === resolution);
                }
                const rollups = reconciliationRollups(selected);
                for (const [id, counts] of Object.entries(rollups.workItems)) {
                    const row = document.createElement('p'); row.textContent = `WorkItem ${id}: ${JSON.stringify(counts)}`; details.append(row);
                }
                for (const [id, counts] of Object.entries(rollups.branches)) {
                    const row = document.createElement('p'); row.textContent = `Branch ${id}: ${JSON.stringify(counts)}`; details.append(row);
                }
            }
            if (selected.status === 'active') button('Close out Planning Map', () => void this.planning.closeout(), !this.planning.canCloseOut || !editable);
        }
        for (const status of this.planning.allowedTransitions) button(status[0].toUpperCase() + status.slice(1),
            () => void this.planning.transition(status), this.planning.loading);
        for (const view of ['current', 'target', 'diff'] as const) button(
            view === 'current' ? 'Current only' : view === 'target' ? 'Target only' : 'Diff',
            () => this.planning.setView(view), this.planning.view === view, bar);
        for (const conflict of this.planning.conflicts) {
            const item = document.createElement('span'); item.className = 'dope-plan-conflict';
            item.textContent = `Conflict: ${conflict.identityId} (${conflict.mapIds.join(' / ')})`;
            details.append(item);
        }
    }

    private renderWorkPanel(): void {
        const panel = this.workPanel, map = this.planning.selected;
        panel.replaceChildren();
        panel.hidden = !this.planning.planningMode || !map || !this.controller.projectMatches;
        if (panel.hidden || !map) return;
        const button = (label: string, action: () => void, disabled = false) => {
            const control = document.createElement('button');
            control.type = 'button'; control.textContent = label; control.disabled = disabled || this.planning.loading;
            control.onclick = action; panel.append(control); return control;
        };
        const line = (value: string) => { const element = document.createElement('p'); element.textContent = value; panel.append(element); };
        const csv = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);
        const edit = async (field: keyof WorkItem, value: string, list = false) => {
            const item = this.planning.selectedWorkItem;
            if (!item) return;
            const answer = await this.ask(`WorkItem ${field}`, value);
            if (answer === undefined) return;
            void this.planning.putWorkItem({ ...item, [field]: list ? csv(answer) : answer.trim() });
        };
        const heading = document.createElement('h3'); heading.textContent = 'Work'; panel.append(heading);
        button('Suggest from transformations', () => this.planning.requestSuggestions(), !map.transformations.length);
        this.planning.suggestions?.forEach((suggestion, index) => {
            line(`Suggestion ${index + 1}: ${suggestion.objective} · ${suggestion.transformationIds.join(', ')} · ${suggestion.dependsOn.length ? `after ${suggestion.dependsOn.map(i => i + 1).join(', ')}` : 'parallel'}`);
            button(`Accept suggestion ${index + 1}`, () => void this.planning.acceptSuggestion(index));
            button(`Split suggestion ${index + 1}`, async () => {
                const first = await this.ask('First part transformation IDs, comma separated', suggestion.transformationIds.join(', '));
                if (first === undefined) return;
                const second = await this.ask('Second part transformation IDs, comma separated', suggestion.transformationIds.join(', '));
                if (second === undefined) return;
                try { this.planning.splitSuggestion(index, [csv(first), csv(second)]); }
                catch (error) { this.status.textContent = String(error); }
            });
        });
        line(`WorkItems: ${map.workItems.length}`);
        for (const item of map.workItems) button(`${item.title} · ${item.status}${item.dependsOn.length ? ` · after ${item.dependsOn.join(', ')}` : ' · parallel'}`,
            () => this.planning.selectWorkItem(item.id), item.id === this.planning.selectedWorkItemId);
        line(`Transformations: ${map.transformations.map(change => change.id).join(', ') || 'none'}`);
        for (const change of map.transformations) {
            const control = button(`${change.id} · ${change.adopted ? 'adopted' : 'still planned'}${map.workItems.some(item => item.transformationIds.includes(change.id)) ? ' · linked' : ''}`,
                () => this.planning.selectTransformation(change.id), change.id === this.planning.selectedTransformationId);
            if (this.planning.selectedWorkItem?.transformationIds.includes(change.id)) control.classList.add('dope-work-highlight');
        }
        if (this.planning.selectedTransformationId) line(`Linked WorkItems: ${this.planning.linkedWorkItems.map(item => item.title).join(', ') || 'none'}`);
        const item = this.planning.selectedWorkItem;
        if (!item) return;
        line(`Selected ${item.id} · ${item.status} · transformations ${item.transformationIds.join(', ')}`);
        for (const field of ['title', 'objective', 'requirements', 'constraints', 'acceptanceCriteria', 'validationTargets', 'workingSet',
            'transformationIds', 'dependsOn'] as const) {
            const value = item[field];
            line(`${field}: ${Array.isArray(value) ? value.join(', ') || 'none' : value}`);
            button(`Edit ${field}`, () => edit(field, Array.isArray(value) ? value.join(', ') : value, Array.isArray(value)));
        }
        button('Split WorkItem', async () => {
            const first = await this.ask('First part transformation IDs, comma separated', item.transformationIds.join(', '));
            if (first === undefined) return;
            const second = await this.ask('Second part transformation IDs, comma separated', item.transformationIds.join(', '));
            if (second === undefined) return;
            const parts: [WorkItem, WorkItem] = [first, second].map((refs, index) => ({ ...item,
                id: `work-${crypto.randomUUID()}`, title: `${item.title} ${index + 1}`, transformationIds: csv(refs), status: 'proposed',
                completionNotes: undefined })) as [WorkItem, WorkItem];
            void this.planning.splitWorkItem(item.id, parts);
        }, item.status === 'completed' || item.status === 'cancelled');
        button('Merge WorkItem', async () => {
            const otherId = await this.ask('Other WorkItem ID');
            const other = map.workItems.find(work => work.id === otherId);
            if (!other) return;
            const merged: WorkItem = { ...item, id: `work-${crypto.randomUUID()}`, title: `${item.title} + ${other.title}`,
                objective: `${item.objective}; ${other.objective}`,
                requirements: [...new Set([...item.requirements, ...other.requirements])],
                constraints: [...new Set([...item.constraints, ...other.constraints])],
                acceptanceCriteria: [...new Set([...item.acceptanceCriteria, ...other.acceptanceCriteria])],
                validationTargets: [...new Set([...item.validationTargets, ...other.validationTargets])],
                workingSet: [...new Set([...item.workingSet, ...other.workingSet])],
                transformationIds: [...new Set([...item.transformationIds, ...other.transformationIds])],
                dependsOn: [...new Set([...item.dependsOn, ...other.dependsOn])].filter(id => id !== item.id && id !== other.id),
                status: 'proposed', completionNotes: undefined };
            void this.planning.mergeWorkItems([item.id, other.id], merged);
        }, item.status === 'completed' || item.status === 'cancelled');
        const transitions: Record<WorkItem['status'], WorkItem['status'][]> = {
            proposed: ['ready', 'cancelled'], ready: ['in-progress', 'cancelled'],
            'in-progress': ['ready', 'completed', 'cancelled'], completed: [], cancelled: []
        };
        for (const status of transitions[item.status]) button(`Mark ${status}`, async () => {
            const notes = status === 'completed' ? await this.ask('Completion notes (validation is tracked separately)') : undefined;
            if (status === 'completed' && !notes?.trim()) return;
            void this.planning.transitionWorkItem(status, notes?.trim());
        });
        if (item.completionNotes) line(`Completion notes: ${item.completionNotes}`);
        if (item.status === 'completed') button('Edit completion notes', () => edit('completionNotes', item.completionNotes ?? ''));
    }

    private async openSource(edge = false): Promise<void> {
        try {
            const location = edge ? await this.controller.flowSource() : await this.controller.source();
            if (!location || this.isDisposed) return;
            await open(this.opener, new URI(location.uri), location.span?.line ? { selection: {
                start: { line: location.span.line - 1, character: (location.span.column ?? 1) - 1 }
            } } : undefined);
        } catch (error) { if (!this.isDisposed) this.status.textContent = `Source navigation failed: ${String(error)}`; }
    }

    override dispose(): void {
        this.planningListener.dispose();
        this.colorListener.dispose();
        this.controller.dispose();
        this.root?.unmount();
        this.root = undefined;
        super.dispose();
    }
}
