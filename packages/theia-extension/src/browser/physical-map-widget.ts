import * as React from 'react';
import { createRoot, Root } from 'react-dom/client';
import { ReactFlow, Background, Controls, Handle, Position, type ReactFlowInstance, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BaseWidget, Message, codicon } from '@theia/core/lib/browser/widgets/widget';
import { OpenerService, open } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { PhysicalMapController, physicalMapTabId, type PhysicalMapTabOptions } from './physical-map-controller';
import type { CanvasNode } from './physical-map-projection';
import { PlanningMapController } from './planning-map-controller';
import { projectPlanningMap } from './planning-map-projection';
import { affectedArchitecture, transformationsForArchitecture } from './planning-work-projection';
import type { EditCommand } from '@dope/visual-planning/lib/editing';
import type { PlannedNode, WorkItem } from '@dope/visual-planning';
import './dope.css';

export const PHYSICAL_MAP_ID = 'dope-physical-map-canvas';

function MapNode({ data }: { data: { item: CanvasNode & { intent?: string }; editable?: boolean } }): React.ReactElement {
    const item = data.item;
    return React.createElement('div', { className: `dope-map-node dope-map-${item.kind} dope-map-${item.state}${item.intent ? ` dope-plan-${item.intent}` : ''}` },
        React.createElement('span', { className: 'dope-map-kind' }, `${item.context ? '↗ ' : ''}${item.kind}`),
        React.createElement('strong', null, item.name),
        React.createElement('small', { className: 'dope-map-badge', title: item.badge }, item.badge),
        data.editable && item.kind === 'subsystem' ? React.createElement(React.Fragment, null,
            React.createElement(Handle, { type: 'target', position: Position.Left }),
            React.createElement(Handle, { type: 'source', position: Position.Right })) : null);
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
    private readonly planningBar = document.createElement('section');
    private readonly workPanel = document.createElement('section');
    private readonly planningListener;
    private readonly heading = document.createElement('h2');
    private readonly focusedTab: boolean;
    private draftTitle = '';
    private draftObjective = '';

    constructor(map: ConstructorParameters<typeof PhysicalMapController>[0], service: ConstructorParameters<typeof PhysicalMapController>[1],
        private readonly opener: OpenerService, private readonly openTab: (id: string) => Promise<void>,
        private readonly planning: PlanningMapController,
        options?: PhysicalMapTabOptions) {
        super();
        this.focusedTab = !!options;
        this.id = options ? physicalMapTabId(options) : PHYSICAL_MAP_ID;
        this.title.label = options ? `Map: ${options.focusId}` : 'Physical Map';
        this.title.caption = 'Physical Map — current architecture';
        this.title.iconClass = codicon('type-hierarchy');
        this.title.closable = true;
        this.addClass('dope-physical-map-view');
        const bar = document.createElement('header');
        this.heading.textContent = 'Physical Map';
        const planningToggle = document.createElement('button');
        planningToggle.type = 'button';
        planningToggle.textContent = 'Planning Map';
        planningToggle.onclick = () => this.planning.setMode(!this.planning.planningMode);
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
        bar.append(this.heading, planningToggle, up, this.focusButton, this.tabButton, this.sourceButton, fit);
        this.breadcrumbs.setAttribute('aria-label', 'Map focus');
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.canvas.className = 'dope-physical-map-canvas';
        this.planningBar.className = 'dope-planning-bar';
        this.workPanel.className = 'dope-work-panel';
        this.workPanel.setAttribute('aria-label', 'Planning work');
        this.node.append(bar, this.planningBar, this.workPanel, this.breadcrumbs, this.status, this.canvas);
        this.controller = new PhysicalMapController(map, service, () => this.render(), options?.workspace, options?.focusId);
        this.planningListener = planning.onChange(() => this.render());
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
        const { loading, error } = this.controller;
        const selectedMap = this.planning.selected;
        const planningMode = this.planning.planningMode;
        this.heading.textContent = planningMode ? 'Planning Map' : 'Physical Map';
        if (!this.focusedTab) this.title.label = planningMode ? 'Planning Map' : 'Physical Map';
        const projection = planningMode && selectedMap ? projectPlanningMap(
            this.controller.sourceNodes, this.controller.sourceRelationships, this.controller.sourceViolations,
            selectedMap, this.planning.view, this.controller.focusId) : this.controller.projection;
        this.renderPlanningBar();
        this.renderWorkPanel();
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
        const highlighted = planningMode && selectedMap && this.planning.selectedWorkItem ?
            new Set(affectedArchitecture(selectedMap, this.planning.selectedWorkItem.transformationIds, this.controller.sourceNodes)) : new Set<string>();
        this.focusButton.disabled = !selected || !this.controller.projectMatches;
        this.tabButton.disabled = !selected || !this.controller.projectMatches;
        this.sourceButton.disabled = !selected || !this.controller.projectMatches;
        this.status.textContent = !this.controller.projectMatches ? 'This map tab belongs to another project.' :
            this.planning.error ? `Planning Map: ${this.planning.error}` :
            error ? `Physical Map: ${error}` : loading ? 'Loading Physical Map…' :
            planningMode && !selectedMap ? 'Create or select a Planning Map.' :
            projection.nodes.length ? `${this.controller.focusId ? 'Focused architecture' : projection.oneSystem ? 'One System overview' : 'Systems overview'} · ${projection.nodes.length} objects` :
                'No published architecture. Initialize or refresh the Software Map in the left inspector.';
        const nodes: Node[] = projection.nodes.map(item => ({
            id: item.id, type: 'architecture', position: { x: item.x, y: item.y },
            parentId: item.parentId,
            data: { item, editable: planningMode && !!selectedMap }, draggable: planningMode &&
                (item.kind === 'subsystem' || item.kind === 'component'), selectable: true, selected: item.id === selected,
            className: item.id === selected ? 'dope-map-selected' : highlighted.has(item.id) ? 'dope-work-highlight' : item.context ? 'dope-map-context' : undefined,
            style: { width: item.width, height: item.height }
        }));
        const edges: Edge[] = projection.edges.map(item => ({
            id: item.id, source: item.source, target: item.target, label: item.kind === 'dependency' ? item.label : undefined,
            className: `dope-map-edge dope-map-edge-${item.kind} dope-map-edge-${item.state}${'intent' in item && item.intent ? ` dope-plan-edge-${item.intent}` : ''}`,
            type: item.kind === 'containment' ? 'straight' : 'smoothstep',
            selectable: false
        }));
        this.root.render(React.createElement(ReactFlow, {
            nodes, edges, nodeTypes, nodesDraggable: planningMode, nodesConnectable: planningMode, elementsSelectable: true,
            onNodeClick: (_event: React.MouseEvent, node: Node) => { this.controller.select(node.id);
                if (planningMode && selectedMap) this.planning.selectTransformation(transformationsForArchitecture(selectedMap, node.id, this.controller.sourceNodes)[0]); },
            onNodeDoubleClick: (_event: React.MouseEvent, node: Node) => this.controller.focus(node.id),
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
            fitView: true, fitViewOptions: { padding: 0.14 }, onInit: (flow: ReactFlowInstance) => { this.flow = flow; void flow.fitView({ padding: 0.14 }); },
            proOptions: { hideAttribution: true }
        }, React.createElement(Background), React.createElement(Controls, { showInteractive: false })));
        const graph = `${this.controller.focusId ?? ''}:${nodes.map(node => node.id).join('|')}`;
        if (nodes.length && graph !== this.renderedGraph) requestAnimationFrame(() => { if (!this.isDisposed) void this.flow?.fitView({ padding: 0.14 }); });
        this.renderedGraph = graph;
    }

    private renderPlanningBar(): void {
        const bar = this.planningBar;
        bar.replaceChildren();
        if (!this.planning.planningMode) { bar.hidden = true; return; }
        bar.hidden = false;
        const button = (label: string, action: () => void, disabled = false) => {
            const control = document.createElement('button');
            control.type = 'button'; control.textContent = label; control.disabled = disabled;
            control.onclick = action; bar.append(control); return control;
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
        button('Refresh', () => void this.planning.refresh(), this.planning.loading);
        const title = document.createElement('input'); title.placeholder = 'Map title'; title.setAttribute('aria-label', 'New map title');
        title.value = this.draftTitle; title.oninput = () => { this.draftTitle = title.value; };
        const objective = document.createElement('input'); objective.placeholder = 'Objective'; objective.setAttribute('aria-label', 'New map objective');
        objective.value = this.draftObjective; objective.oninput = () => { this.draftObjective = objective.value; };
        bar.append(title, objective);
        button('Create', () => { if (title.value.trim() && objective.value.trim()) {
            void this.planning.create(title.value.trim(), objective.value.trim()); this.draftTitle = ''; this.draftObjective = '';
        } },
            !this.planning.canCreate || this.planning.loading || !this.controller.projectMatches);
        button('Branch alternative', () => void this.planning.duplicate(), !this.planning.selected || this.planning.loading);
        const editable = !!this.planning.selected && !this.planning.loading && this.controller.projectMatches;
        const ask = (label: string, value = '') => window.prompt(label, value)?.trim();
        button('Add target', () => {
            const kind = ask('Kind: system, subsystem, component');
            if (kind !== 'system' && kind !== 'subsystem' && kind !== 'component') return;
            const id = ask('Stable target ID'), name = ask('Name'), purpose = ask('Purpose');
            const parentId = kind === 'system' ? undefined : ask('Parent ID', this.controller.selectedId ?? '');
            const roots = ask('Project-relative roots, comma separated');
            if (!id || !name || !purpose || roots === undefined || (kind !== 'system' && !parentId)) return;
            const node: PlannedNode = { id, kind, name, purpose, roots: roots.split(',').map(s => s.trim()).filter(Boolean),
                ...(parentId ? { parentId } : {}) };
            void this.planning.beginEdit({ kind: 'add', node });
        }, !editable);
        button('Move selected', () => { const id = this.controller.selectedId, parentId = ask('New parent ID');
            if (id && parentId) void this.planning.beginEdit({ kind: 'move', id, parentId }); }, !editable || !this.controller.selectedId);
        button('Remove from target', () => { const id = this.controller.selectedId;
            if (id) void this.planning.beginEdit({ kind: 'remove', id }); }, !editable || !this.controller.selectedId);
        button('Redirect dependency', () => {
            const sourceId = ask('Source Subsystem ID'), oldTarget = ask('Current target Subsystem ID');
            const targetId = ask('New target Subsystem ID'), policy = ask('Policy: allowed or forbidden', 'allowed');
            if (sourceId && oldTarget && targetId && (policy === 'allowed' || policy === 'forbidden'))
                void this.planning.beginEdit({ kind: 'redirect-relationship',
                    from: { sourceId, targetId: oldTarget, policy }, to: { sourceId, targetId, policy } });
        }, !editable);
        for (const kind of ['modify', 'split', 'merge', 'change-contract'] as const) button(kind, () => {
            const ids = ask('Current IDs, comma separated', this.controller.selectedId ?? '');
            const json = ask('Future nodes JSON array (id, kind, parentId, name, purpose, roots)');
            if (!ids || !json) return;
            try {
                const futureNodes = JSON.parse(json) as PlannedNode[];
                const command: EditCommand = { kind, currentIds: ids.split(',').map(s => s.trim()), futureNodes };
                void this.planning.beginEdit(command);
            } catch { this.status.textContent = 'Invalid future nodes JSON'; }
        }, !editable);
        button('Undo', () => void this.planning.undo(), !editable || !this.planning.canUndo);
        button('Redo', () => void this.planning.redo(), !editable || !this.planning.canRedo);
        if (this.planning.preview) {
            const preview = document.createElement('pre');
            const change = this.planning.preview.transformation;
            preview.textContent = `Preview ${change.kind}\n${JSON.stringify(change, null, 2)}`;
            bar.append(preview);
            button('Commit change', () => void this.planning.commitEdit(), !editable);
            button('Cancel change', () => this.planning.cancelEdit());
        }
        const selectedNode = this.controller.sourceNodes.find(node => node.id === this.controller.selectedId);
        button('Preview branch adoption', () => {
            const kind = ask('Branch kind: system, subsystem, component', selectedNode?.kind ?? 'system');
            const id = ask('Branch ID', selectedNode?.id ?? '');
            if (id && (kind === 'system' || kind === 'subsystem' || kind === 'component'))
                void this.planning.beginAdoption({ kind, id });
        }, !editable);
        button('Preview transformation set adoption', () => {
            const ids = ask('Transformation IDs, comma separated', this.planning.selectedTransformationId ?? '');
            if (ids) void this.planning.beginAdoption({ kind: 'transformations', ids: ids.split(',').map(id => id.trim()).filter(Boolean) });
        }, !editable);
        if (this.planning.adoptionPreview) {
            const result = this.planning.adoptionPreview.result;
            const preview = document.createElement('pre');
            preview.textContent = `Adopt Target · ${JSON.stringify(result.scope)}\nSelected: ${result.selectedTransformationIds.join(', ')}\nIncluded dependencies: ${result.includedDependentTransformationIds.join(', ') || 'none'}\nCanonical diff:\n${JSON.stringify(result.changes, null, 2)}\nBlockers: ${result.blockers.join('; ') || 'none'}`;
            bar.append(preview);
            button('Accept canonical diff and adopt', () => void this.planning.acceptAdoption(), !editable || !!result.blockers.length);
            button('Cancel adoption', () => this.planning.cancelAdoption());
        }
        for (const status of this.planning.allowedTransitions) button(status[0].toUpperCase() + status.slice(1),
            () => void this.planning.transition(status), this.planning.loading);
        for (const view of ['current', 'target', 'diff'] as const) button(
            view === 'current' ? 'Current only' : view === 'target' ? 'Target only' : 'Diff',
            () => this.planning.setView(view), this.planning.view === view);
        for (const conflict of this.planning.conflicts) {
            const item = document.createElement('span'); item.className = 'dope-plan-conflict';
            item.textContent = `Conflict: ${conflict.identityId} (${conflict.mapIds.join(' / ')})`;
            bar.append(item);
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
        const edit = (field: keyof WorkItem, value: string, list = false) => {
            const item = this.planning.selectedWorkItem;
            if (!item) return;
            const answer = window.prompt(`WorkItem ${field}`, value);
            if (answer === null) return;
            void this.planning.putWorkItem({ ...item, [field]: list ? csv(answer) : answer.trim() });
        };
        const heading = document.createElement('h3'); heading.textContent = 'Work'; panel.append(heading);
        button('Suggest from transformations', () => this.planning.requestSuggestions(), !map.transformations.length);
        this.planning.suggestions?.forEach((suggestion, index) => {
            line(`Suggestion ${index + 1}: ${suggestion.objective} · ${suggestion.transformationIds.join(', ')} · ${suggestion.dependsOn.length ? `after ${suggestion.dependsOn.map(i => i + 1).join(', ')}` : 'parallel'}`);
            button(`Accept suggestion ${index + 1}`, () => void this.planning.acceptSuggestion(index));
            button(`Split suggestion ${index + 1}`, () => {
                const first = window.prompt('First part transformation IDs, comma separated', suggestion.transformationIds.join(', '));
                if (first === null) return;
                const second = window.prompt('Second part transformation IDs, comma separated', suggestion.transformationIds.join(', '));
                if (second === null) return;
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
        button('Split WorkItem', () => {
            const first = window.prompt('First part transformation IDs, comma separated', item.transformationIds.join(', '));
            if (first === null) return;
            const second = window.prompt('Second part transformation IDs, comma separated', item.transformationIds.join(', '));
            if (second === null) return;
            const parts: [WorkItem, WorkItem] = [first, second].map((refs, index) => ({ ...item,
                id: `work-${crypto.randomUUID()}`, title: `${item.title} ${index + 1}`, transformationIds: csv(refs), status: 'proposed',
                completionNotes: undefined })) as [WorkItem, WorkItem];
            void this.planning.splitWorkItem(item.id, parts);
        }, item.status === 'completed' || item.status === 'cancelled');
        button('Merge WorkItem', () => {
            const otherId = window.prompt('Other WorkItem ID');
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
        for (const status of transitions[item.status]) button(`Mark ${status}`, () => {
            const notes = status === 'completed' ? window.prompt('Completion notes (validation is tracked separately)') : undefined;
            if (status === 'completed' && !notes?.trim()) return;
            void this.planning.transitionWorkItem(status, notes?.trim());
        });
        if (item.completionNotes) line(`Completion notes: ${item.completionNotes}`);
        if (item.status === 'completed') button('Edit completion notes', () => edit('completionNotes', item.completionNotes ?? ''));
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
        this.planningListener.dispose();
        this.controller.dispose();
        this.root?.unmount();
        this.root = undefined;
        super.dispose();
    }
}
