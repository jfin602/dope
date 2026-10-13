import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ReactFlow, Background, Handle, Position, type Edge, type Node, type NodeChange, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BaseWidget, Message, codicon } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import type { CheckpointNode } from '@dope/project-intelligence/lib/roadmap-projection';
import { projectRoadmapTasks, type TaskRoadmapProjection } from '@dope/project-intelligence/lib/roadmap-task-projection';
import type { RoadmapTaskStack } from '@dope/agent-core/lib/node/roadmap-task-discovery';
import type { RoadmapService } from '../roadmap-service';
import type { RoadmapOwnerRecord } from '@dope/project-intelligence/lib/node/roadmap-owner-links';
import type { RoadmapLink } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { PlanningActionRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import type { RoadmapCandidateDiscovery, RoadmapImportPreview } from '@dope/project-intelligence/lib/node/roadmap-import';
import type { RoadmapSyncPreview, RoadmapRelinkPreview, RoadmapPendingRecoveryPreview } from '@dope/project-intelligence/lib/node/roadmap-document-sync';
import type { GreenfieldDraft, GreenfieldEdit, GreenfieldPreview } from '@dope/project-intelligence/lib/node/roadmap-greenfield';
import { roadmapCanvasOrder, roadmapSpatialNextId, roadmapSpatialLayout, roadmapEdgeHandles, roadmapDetailAtZoom, roadmapVisibleGraph,
    type RoadmapDetail } from './roadmap-canvas-model';
import { RoadmapInspectorModel } from './roadmap-inspector-model';
import { readRoadmapViewport, roadmapGestures, roadmapKeyboardAction, roadmapViewportKey, roadmapLegacyViewportKey, roadmapViewportSnapshot,
    type RoadmapViewportState } from './roadmap-viewport';
import './dope.css';

function RoadmapNode({ data }: { data: { item: CheckpointNode; selected: boolean; relation: string; omitted: number;
    select: (id: string) => void; activate: (id: string) => void } }): React.ReactElement {
    const item = data.item;
    return React.createElement(React.Fragment, null,
        React.createElement(Handle, { id: 'left', type: 'target', position: Position.Left, isConnectable: false }),
        React.createElement(Handle, { id: 'top', type: 'target', position: Position.Top, isConnectable: false }),
        React.createElement(Handle, { id: 'bottom', type: 'target', position: Position.Bottom, isConnectable: false }),
        React.createElement('button', { type: 'button', className: 'dope-roadmap-node',
            'data-checkpoint-id': item.id, 'aria-current': data.selected ? 'true' : undefined,
            'aria-label': `${item.kind}: ${item.title}; ${item.statusLabel}${data.relation ? `; ${data.relation}` : ''}${data.omitted ? `; ${data.omitted} prompts hidden` : ''}`,
            onClick: event => { event.stopPropagation(); data.select(item.id); },
            onDoubleClick: event => { event.stopPropagation(); data.activate(item.id); } },
        React.createElement('small', null, item.kind),
        React.createElement('strong', null, item.title),
        React.createElement('span', { className: 'dope-roadmap-status' }, item.statusLabel),
        data.omitted > 0 ? React.createElement('span', { className: 'dope-roadmap-omitted' },
            `${data.omitted} prompt${data.omitted === 1 ? '' : 's'} hidden; expand or select stack for Next prompts`) : null),
        React.createElement(Handle, { id: 'right', type: 'source', position: Position.Right, isConnectable: false }),
        React.createElement(Handle, { id: 'top', type: 'source', position: Position.Top, isConnectable: false }),
        React.createElement(Handle, { id: 'bottom', type: 'source', position: Position.Bottom, isConnectable: false }));
}
const roadmapNodeTypes = { checkpoint: RoadmapNode };

export const ROADMAP_CANVAS_ID = 'dope-roadmap-canvas';

/** A single ordinary center tab; it neither owns nor opens a ChatPanel. */
export class RoadmapCanvasWidget extends BaseWidget {
    private readonly status = document.createElement('p');
    private readonly path = document.createElement('div');
    private root?: Root;
    private flow?: ReactFlowInstance;
    private taskStacks: RoadmapTaskStack[] = [];
    private taskDiscoveryError?: string;
    private readonly toolbar = document.createElement('header');
    private readonly pools = document.createElement('section');
    private readonly importEntry = document.createElement('section');
    private readonly poolFilter = document.createElement('input');
    private owners: RoadmapOwnerRecord[] = [];
    private poolQuery = '';
    private mutating = false;
    private readonly reload = document.createElement('button');
    private readonly details = document.createElement('button');
    private readonly mind = document.createElement('button');
    private readonly zoomIn = document.createElement('button');
    private readonly zoomOut = document.createElement('button');
    private readonly fitButton = document.createElement('button');
    private readonly arrangeButton = document.createElement('button');
    private readonly expandButton = document.createElement('button');
    private readonly collapseButton = document.createElement('button');
    private readonly focusButton = document.createElement('button');
    private readonly nextPromptsButton = document.createElement('button');
    private readonly detailLabel = document.createElement('span');
    private detail: RoadmapDetail = 'phase';
    private arranging = false;
    private viewport?: RoadmapViewportState['viewport'];
    private readonly placements = new Map<string, { x: number; y: number }>();
    private saveTimer?: ReturnType<typeof setTimeout>;
    private saveWrite: Promise<unknown> = Promise.resolve();
    private saveKey?: string;
    private projectId?: string;
    private readonly expanded = new Set<string>();
    private readonly collapsed = new Set<string>();
    private promptWindow?: { stackId: string; start: number };
    private readonly rootsListener;
    private readonly modelListener;
    private request = 0;
    private importSerial = 0;
    private syncPreview?: RoadmapSyncPreview;
    private recovery?: { uri: string; preview?: RoadmapPendingRecoveryPreview; error?: string; busy: boolean };
    private relink?: { uri: string; path: string; preview?: RoadmapRelinkPreview; error?: string; busy: boolean };
    private importState?: { uri: string; projectId: string; revision: number; discovery: RoadmapCandidateDiscovery;
        preview?: RoadmapImportPreview; path?: string; busy: boolean; showChooser: boolean; message?: string };
    private createState?: { uri: string; projectId: string; handle: string; draft: GreenfieldDraft;
        mode: 'manual' | 'chat'; chatId?: string; path: string; preview?: GreenfieldPreview; busy: boolean; error?: string };
    private createSerial = 0;
    private createStarting = false;
    private projectUri?: string;
    private projection?: TaskRoadmapProjection;
    private selectedId?: string;
    private readonly focusRecheck = (): void => { if (!this.isDisposed && this.projectUri) void this.refresh(); };

    constructor(private readonly service: RoadmapService, private readonly workspaces: WorkspaceService,
        private readonly inspector: RoadmapInspectorModel, private readonly openInspector: () => Promise<unknown>,
        private readonly openMind: (id?: string, workspace?: string) => Promise<boolean> = async () => false,
        private readonly savedChats: (workspace: string) => { id: string; title: string }[] = () => [],
        private readonly storage?: Pick<StorageService, 'getData' | 'setData'>) {
        super();
        this.id = ROADMAP_CANVAS_ID;
        this.title.label = this.title.caption = 'Roadmap';
        this.title.iconClass = codicon('milestone');
        this.title.closable = true;
        this.addClass('dope-roadmap-canvas');
        const heading = document.createElement('h2');
        heading.textContent = 'Roadmap';
        this.reload.type = 'button';
        this.reload.textContent = 'Refresh';
        this.reload.setAttribute('aria-label', 'Refresh Roadmap');
        this.reload.onclick = () => { void this.refresh(); };
        this.details.type = 'button';
        this.details.textContent = 'Details';
        this.details.setAttribute('aria-label', 'Show Roadmap details in left sidebar');
        this.details.onclick = () => { void this.openInspector(); };
        this.mind.type = 'button';
        this.mind.textContent = 'Project Mind';
        this.mind.setAttribute('aria-label', 'Browse and edit Project Mind Notes, Ideas, Questions and Decisions');
        this.mind.onclick = () => { void this.openMind().catch(error => {
            this.status.textContent = `Project Mind unavailable: ${String(error)}. Retry from the command palette.`;
        }); };
        for (const [button, label, icon, action] of [
            [this.zoomIn, 'Zoom in on Roadmap', 'zoom-in', () => void this.flow?.zoomIn()],
            [this.zoomOut, 'Zoom out on Roadmap', 'zoom-out', () => void this.flow?.zoomOut()],
            [this.fitButton, 'Fit Roadmap', 'screen-full', () => void this.flow?.fitView({ padding: 0.12, maxZoom: 1 })],
        ] as const) {
            button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
            const glyph = document.createElement('span'); glyph.className = codicon(icon); glyph.setAttribute('aria-hidden', 'true');
            button.append(glyph); button.onclick = action;
        }
        this.arrangeButton.type = 'button';
        this.arrangeButton.textContent = 'Arrange';
        this.arrangeButton.title = 'Move checkpoint cards without changing their order or dependencies';
        this.arrangeButton.setAttribute('aria-pressed', 'false');
        this.arrangeButton.onclick = () => {
            this.arranging = !this.arranging;
            this.arrangeButton.setAttribute('aria-pressed', String(this.arranging));
            this.path.classList.toggle('dope-roadmap-arranging', this.arranging);
            this.status.textContent = this.arranging ? 'Arrange on: drag a card or use Alt+Arrow on a focused card.' :
                'Arrange off: drag the background to pan.';
            this.renderFlow();
        };
        for (const [button, label, action] of [
            [this.expandButton, 'Expand selected Roadmap branch', () => this.setExpansion(true)],
            [this.collapseButton, 'Collapse selected Roadmap branch', () => this.setExpansion(false)],
            [this.focusButton, 'Focus selected Roadmap checkpoint', () => this.focusSelection()],
        ] as const) { button.type = 'button'; button.textContent = label.substring(0, label.indexOf(' '));
            button.title = label; button.setAttribute('aria-label', label); button.onclick = action; }
        this.detailLabel.className = 'dope-roadmap-detail';
        this.detailLabel.setAttribute('aria-live', 'polite');
        this.nextPromptsButton.type = 'button';
        this.nextPromptsButton.textContent = 'Next prompts';
        this.nextPromptsButton.setAttribute('aria-label', 'Show next prompts in selected stack');
        this.nextPromptsButton.onclick = () => this.nextPrompts();
        this.toolbar.append(heading, this.details, this.mind, this.zoomIn, this.zoomOut, this.fitButton, this.arrangeButton,
            this.expandButton, this.collapseButton, this.focusButton, this.nextPromptsButton, this.detailLabel, this.reload);
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.path.className = 'dope-roadmap-stage';
        this.path.setAttribute('aria-label', 'Roadmap checkpoints canvas');
        this.path.tabIndex = 0;
        this.path.title = 'Shift+Arrow pans. In Arrange mode, Alt+Arrow moves the selected card.';
        this.path.onkeydown = event => this.onPathKey(event);
        this.pools.className = 'dope-roadmap-pools';
        this.pools.setAttribute('aria-label', 'Detached Ideas and Issues');
        this.poolFilter.type = 'search';
        this.poolFilter.setAttribute('aria-label', 'Filter Ideas and Issues');
        this.poolFilter.placeholder = 'Filter Ideas and Issues';
        this.poolFilter.oninput = () => { this.poolQuery = this.poolFilter.value; this.renderPools(); };
        this.importEntry.className = 'dope-roadmap-import';
        this.importEntry.setAttribute('aria-label', 'Roadmap setup');
        this.node.append(this.toolbar, this.status, this.importEntry, this.path, this.pools);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.refresh(); });
        window.addEventListener('focus', this.focusRecheck);
        this.modelListener = inspector.onChange(() => {
            if (!this.projectUri || inspector.projectUri !== this.projectUri || !inspector.index) return;
            this.selectedId = inspector.selectedPrompt?.id ?? inspector.selectedId;
            this.schedulePresentation();
            this.projection = projectRoadmapTasks(inspector.index, this.taskStacks, this.owners, { projectId: inspector.index.projectId, selectedId: this.selectedId });
            this.render();
        });
        void this.refresh();
    }

    async refresh(): Promise<void> {
        const request = ++this.request;
        const priorProjectUri = this.projectUri;
        const selectedTaskId = this.projection?.nodes.find(node => node.id === this.selectedId && node.taskSource)?.id;
        try { await this.service.observeLinkedDocument(undefined); }
        catch (error) { this.status.textContent = `Roadmap observation unavailable: ${String(error)}. Use Refresh to retry.`; return; }
        if (this.isDisposed || request !== this.request) return;
        ++this.importSerial;
        const oldDraft = this.createState;
        if (oldDraft && oldDraft.uri !== this.projectUri) void this.service.cancelDraft(oldDraft.handle);
        if (oldDraft && oldDraft.uri !== this.projectUri) this.createState = undefined;
        this.importState = undefined;
        this.syncPreview = undefined;
        this.importEntry.replaceChildren();
        this.projection = undefined;
        this.owners = [];
        this.taskStacks = [];
        this.taskDiscoveryError = undefined;
        this.renderFlow();
        this.renderImportEntry();
        this.pools.replaceChildren();
        this.status.textContent = 'Loading Roadmap…';
        try {
            const roots = await this.workspaces.roots;
            if (this.isDisposed || request !== this.request) return;
            if (roots.length !== 1 || roots[0].resource.scheme !== 'file') {
                this.flushPresentation();
                this.projectUri = undefined;
                this.projectId = undefined;
                this.saveKey = undefined;
                this.selectedId = undefined;
                this.status.textContent = 'Open one local project folder to view its Roadmap.';
                this.inspector.setSnapshot(undefined, undefined);
                return;
            }
            const projectUri = roots[0].resource.toString();
            const [index, owners, taskResult] = await Promise.all([this.service.read(projectUri), this.service.owners(projectUri),
                this.service.discoverTasks(projectUri).then(tasks => ({ tasks, error: undefined as string | undefined }),
                    error => ({ tasks: [] as RoadmapTaskStack[], error: String(error) }))]);
            if (this.isDisposed || request !== this.request) return;
            const switched = this.projectUri !== projectUri || this.projectId !== index.projectId;
            if (switched) {
                this.flushPresentation();
                const nextKey = roadmapViewportKey(projectUri, index.projectId);
                this.projectUri = undefined;
                this.projectId = undefined;
                this.saveKey = undefined;
                let stored: unknown;
                try {
                    stored = await this.storage?.getData(nextKey);
                    if (stored === undefined) stored = await this.storage?.getData(roadmapLegacyViewportKey(projectUri, index.projectId));
                } catch { /* Default layout remains available. */ }
                if (this.isDisposed || request !== this.request) return;
                this.saveKey = nextKey;
                this.projectId = index.projectId;
                const state = readRoadmapViewport(stored, index.projectId);
                this.selectedId = state.selectedId;
                this.viewport = state.viewport;
                this.expanded.clear(); this.collapsed.clear(); this.placements.clear();
                state.expanded.forEach(id => this.expanded.add(id));
                state.collapsed.forEach(id => this.collapsed.add(id));
                Object.entries(state.placements).forEach(([id, position]) => this.placements.set(id, position));
                this.promptWindow = undefined;
                this.detail = roadmapDetailAtZoom(this.viewport?.zoom ?? 0.85, 'phase');
                this.arranging = false;
                this.arrangeButton.setAttribute('aria-pressed', 'false');
                this.path.classList.remove('dope-roadmap-arranging');
            }
            const tasks = taskResult.tasks;
            this.taskDiscoveryError = taskResult.error;
            if (switched) { this.poolQuery = ''; this.poolFilter.value = ''; }
            this.owners = owners;
            this.taskStacks = tasks;
            this.projectUri = projectUri;
            if (this.relink && (this.relink.uri !== projectUri || this.relink.preview?.revision !== index.revision))
                this.relink = undefined;
            if (switched && this.flow) {
                if (this.viewport) void this.flow.setViewport(this.viewport);
                else requestAnimationFrame(() => { if (this.flow && this.projectUri === projectUri) void this.flow.fitView({ padding: 0.12 }); });
            }
            if (this.createState && (this.createState.uri !== projectUri || this.createState.projectId !== index.projectId || index.revision !== 0)) {
                void this.service.cancelDraft(this.createState.handle); this.createState = undefined; ++this.createSerial;
            }
            if (this.createState) {
                const draft = await this.service.readDraft(this.createState.handle);
                if (draft.revision !== this.createState.draft.revision) this.createState.preview = undefined;
                this.createState.draft = draft;
            }
            const restoredId = switched ? this.selectedId : undefined;
            this.inspector.setSnapshot(projectUri, index);
            if (switched && restoredId) {
                if (index.checkpoints.some(item => item.id === restoredId)) this.inspector.select(restoredId);
                else this.selectedId = restoredId; // Prompt nodes are presentation-only and absent from the inspector index.
            }
            if (index.revision === 0) this.status.textContent = 'No Roadmap yet. Import one, create manually, or plan with an existing Chat.';
            if (priorProjectUri === projectUri && selectedTaskId &&
                projectRoadmapTasks(index, tasks).nodes.some(node => node.id === selectedTaskId)) this.selectedId = selectedTaskId;
            this.projection = projectRoadmapTasks(index, tasks, owners, { projectId: index.projectId, selectedId: this.selectedId });
            this.render();
            if (index.linkedDocument) {
                try {
                    const sync = await this.service.previewDocumentSync(projectUri);
                    if (this.isDisposed || request !== this.request || this.projectUri !== projectUri) return;
                    if (sync.revision !== index.revision) {
                        const recovered = await this.service.read(projectUri);
                        if (this.isDisposed || request !== this.request || this.projectUri !== projectUri) return;
                        this.inspector.setSnapshot(projectUri, recovered);
                        this.projection = projectRoadmapTasks(recovered, tasks, owners, { projectId: recovered.projectId, selectedId: this.selectedId });
                        this.render();
                    }
                    this.syncPreview = sync;
                    this.renderImportEntry();
                    await this.service.observeLinkedDocument(projectUri);
                } catch (error) {
                    if (this.isDisposed || request !== this.request || this.projectUri !== projectUri) return;
                    this.status.textContent = `Linked Markdown compare failed: ${String(error)}. Review the file and Refresh.`;
                }
            }
        } catch (error) {
            if (this.isDisposed || request !== this.request) return;
            this.status.textContent = `Roadmap unavailable: ${error instanceof Error ? error.message : 'Unable to read Roadmap'}. Use Refresh to retry.`;
            this.inspector.setSnapshot(undefined, undefined);
        }
    }

    linkedSourceChanged(root: string, projectId: string): void {
        if (this.inspector.index?.projectRoot === root && this.inspector.index.projectId === projectId)
            void this.refresh();
    }

    private render(): void {
        const projection = this.projection;
        if (!projection) return;
        const nodes = roadmapCanvasOrder(projection);
        if (this.selectedId && !nodes.some(node => node.id === this.selectedId)) {
            this.selectedId = undefined;
            this.schedulePresentation();
        }
        this.renderFlow();
        this.renderPools();
        this.renderImportEntry();
        const diagnostic = projection.diagnostics.length ? ` · ${projection.diagnostics.length} unresolved reference(s)` : '';
        this.status.textContent = projection.revision === 0 ?
            'No Roadmap yet. Import one, create manually, or plan with an existing Chat.' :
            `${nodes.length} checkpoints · Roadmap revision ${projection.revision}${diagnostic}${this.inspector.index?.linkedDocument ? ` · Linked: ${this.inspector.index.linkedDocument.path} (${this.inspector.index.linkedDocument.syncState})` : ''}${this.taskDiscoveryError ? ' · Prompt discovery unavailable; Refresh to retry.' : ''}`;
    }

    private renderFlow(): void {
        if (!this.root) return;
        const projection = this.projection;
        this.detailLabel.textContent = `${this.detail[0].toUpperCase()}${this.detail.slice(1)} detail`;
        this.expandButton.disabled = this.collapseButton.disabled = !this.selectedId;
        this.focusButton.disabled = !this.selectedId;
        const visible = projection ? roadmapVisibleGraph(projection, this.detail, this.selectedId,
            this.expanded, this.collapsed, 96, this.promptWindow) : undefined;
        this.nextPromptsButton.disabled = !this.selectedId || !visible?.omittedByStack.get(this.selectedId);
        const positions = projection ? roadmapSpatialLayout(projection) : new Map<string, { x: number; y: number }>();
        const titles = new Map(projection?.nodes.map(item => [item.id, item.title]) ?? []);
        const relations = new Map<string, string[]>();
        for (const edge of projection?.edges ?? []) relations.set(edge.to, [...(relations.get(edge.to) ?? []),
            `${edge.kind === 'branch' ? 'Branches from' : 'Depends on'} ${titles.get(edge.from) ?? edge.from}`]);
        const nodes: Node[] = (visible ? roadmapCanvasOrder(visible) : []).map(item => ({
            id: item.id, type: 'checkpoint', position: this.placements.get(item.id) ?? positions.get(item.id) ?? { x: 64, y: 64 },
            data: { item, selected: item.id === this.selectedId, relation: (relations.get(item.id) ?? []).join(', '),
                omitted: visible?.omittedByStack.get(item.id) ?? 0,
                select: (id: string) => this.select(id), activate: (id: string) => this.activateCheckpoint(id) },
            selected: item.id === this.selectedId, draggable: this.arranging, selectable: true,
            className: item.id === this.selectedId ? 'dope-roadmap-selected' : undefined,
        }));
        const displayed = new Map(nodes.map(node => [node.id, node.position]));
        const edges: Edge[] = (visible?.edges ?? []).map(item => {
            return { id: item.id, source: item.from, target: item.to,
                ...roadmapEdgeHandles(item, displayed),
                type: 'smoothstep', selectable: false,
                className: `dope-roadmap-edge dope-roadmap-edge-${item.kind}` };
        });
        this.root.render(React.createElement(ReactFlow, {
            id: 'dope-roadmap-flow', nodes, edges, nodeTypes: roadmapNodeTypes,
            defaultViewport: this.viewport ?? { x: 20, y: 20, zoom: 0.85 }, minZoom: 0.2, maxZoom: 2,
            ...roadmapGestures(this.arranging), elementsSelectable: true,
            nodesFocusable: false, edgesFocusable: false,
            zoomOnDoubleClick: false, nodeDragThreshold: 5,
            onNodeClick: (_event: React.MouseEvent, node: Node) => this.select(node.id),
            onNodeDoubleClick: (_event: React.MouseEvent, node: Node) => this.activateCheckpoint(node.id),
            onNodesChange: (changes: NodeChange[]) => {
                if (!this.arranging || !this.projection) return;
                let changed = false;
                for (const change of changes) if (change.type === 'position' && change.position &&
                    this.projection.nodes.some(item => item.id === change.id)) {
                    this.placements.set(change.id, { x: change.position.x, y: change.position.y });
                    changed = true;
                }
                if (changed) this.renderFlow();
            },
            onNodeDragStop: (_event: MouseEvent | TouchEvent, node: Node) => {
                if (!this.arranging || !this.projection?.nodes.some(item => item.id === node.id)) return;
                this.placements.set(node.id, { x: node.position.x, y: node.position.y });
                this.schedulePresentation();
                this.renderFlow();
            },
            onInit: (flow: ReactFlowInstance) => { this.flow = flow;
                if (this.viewport) void flow.setViewport(this.viewport);
                else requestAnimationFrame(() => { if (this.flow === flow) void flow.fitView({ padding: 0.12 }); }); },
            onMoveEnd: (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
                if (!this.projectId || !this.projectUri) return;
                if (!this.viewport || this.viewport.x !== viewport.x || this.viewport.y !== viewport.y || this.viewport.zoom !== viewport.zoom) {
                    this.viewport = { x: viewport.x, y: viewport.y, zoom: viewport.zoom };
                    this.schedulePresentation();
                }
                const next = roadmapDetailAtZoom(viewport.zoom, this.detail);
                if (next !== this.detail) { this.detail = next; this.renderFlow(); }
            },
            proOptions: { hideAttribution: true },
        }, React.createElement(Background, { id: 'dope-roadmap-grid' })));
    }

    private setExpansion(expand: boolean): void {
        const id = this.selectedId;
        if (!id) return;
        const node = this.projection?.nodes.find(item => item.id === id);
        const target = node?.kind === 'prompt' ? this.projection?.nodes.find(item =>
            item.kind === 'task-stack' && item.taskSource?.stackPath === node.taskSource?.stackPath)?.id : id;
        if (!target) return;
        (expand ? this.collapsed : this.expanded).delete(target);
        (expand ? this.expanded : this.collapsed).add(target);
        this.schedulePresentation();
        this.renderFlow();
    }

    private focusSelection(): void {
        if (!this.selectedId || !this.flow || !this.projection) return;
        const position = this.placements.get(this.selectedId) ?? roadmapSpatialLayout(this.projection).get(this.selectedId);
        if (!position) return;
        void this.flow.setCenter(position.x + 140, position.y + 40, { zoom: Math.max(1.4, this.flow.getZoom()), duration: 320 });
    }

    private nextPrompts(): void {
        const id = this.selectedId;
        if (!id || this.projection?.nodes.find(item => item.id === id)?.kind !== 'task-stack') return;
        const count = this.projection.nodes.filter(item => item.kind === 'prompt' &&
            item.taskSource?.stackPath === this.projection?.nodes.find(stack => stack.id === id)?.taskSource?.stackPath).length;
        if (count <= 96) return;
        this.promptWindow = { stackId: id, start: ((this.promptWindow?.stackId === id ? this.promptWindow.start : 0) + 96) % count };
        this.expanded.add(id);
        this.collapsed.delete(id);
        this.schedulePresentation();
        this.renderFlow();
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.root = createRoot(this.path);
        this.renderFlow();
    }

    protected override onBeforeDetach(msg: Message): void {
        this.root?.unmount();
        this.root = undefined;
        this.flow = undefined;
        super.onBeforeDetach(msg);
    }

    private renderImportEntry(): void {
        this.importEntry.replaceChildren();
        if (!this.projectUri || !this.inspector.index) return;
        const index = this.inspector.index;
        if (index.linkedDocument) {
            const linked = document.createElement('p');
            const sync = this.syncPreview;
            linked.textContent = `Linked Markdown: ${index.linkedDocument.path} · ${sync?.state ?? index.linkedDocument.syncState}`;
            this.importEntry.append(linked);
            if (sync?.state === 'source-changed') {
                const detail = document.createElement('p');
                detail.textContent = sync.changes.length ? sync.changes.slice(0, 12).map(change =>
                    `${change.checkpointId} ${change.field}: ${String(change.accepted ?? 'absent').slice(0, 120)} → ${String(change.source ?? 'absent').slice(0, 120)}`).join('; ') +
                    (sync.changes.length > 12 ? `; ${sync.changes.length - 12} more change(s)` : '') :
                    'Only unsupported Markdown changed; its content will remain untouched.';
                this.importEntry.append(detail);
                const apply = document.createElement('button'); apply.type = 'button'; apply.textContent = 'Apply source changes';
                apply.onclick = () => { void this.applySync(sync); }; this.importEntry.append(apply);
            }
            if (sync && (sync.state === 'conflict' || sync.state === 'relink-needed')) {
                const warning = document.createElement('p'); warning.setAttribute('role', 'alert');
                warning.textContent = `${sync.state === 'relink-needed' ? 'Relink needed' : 'Sync conflict'}: ${sync.diagnostics.concat(sync.changes.filter(change => change.conflict).map(change => `${change.checkpointId} ${change.field}`)).join('; ')}. Review the Markdown and Refresh.`;
                this.importEntry.append(warning);
            }
            if (sync?.state === 'conflict' && index.linkedDocument.pending) {
                const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Review interrupted sync';
                open.onclick = () => void this.previewRecovery(); this.importEntry.append(open);
                const recovery = this.recovery?.uri === this.projectUri ? this.recovery : undefined;
                if (recovery?.preview) {
                    const choice = recovery.preview;
                    const detail = document.createElement('p');
                    detail.textContent = `Source SHA-256 ${choice.sourceHash ?? 'unavailable'}; accepted ${choice.acceptedHash}. ` +
                        choice.changes.map(change => `${change.checkpointId} ${change.field}: accepted ${String(change.accepted ?? 'absent').slice(0, 100)}, ` +
                            `pending ${String(change.roadmap ?? 'absent').slice(0, 100)}, source ${String(change.source ?? 'absent').slice(0, 100)}`).join('; ');
                    this.importEntry.append(detail);
                    if (choice.diagnostics.length) this.appendImportDiagnostics('Recovery needs review', choice.diagnostics);
                    if (choice.state === 'ready') {
                        const approve = document.createElement('button'); approve.type = 'button';
                        approve.textContent = 'Approve source as recovered Roadmap'; approve.disabled = recovery.busy;
                        approve.onclick = () => void this.applyRecovery(choice); this.importEntry.append(approve);
                    }
                }
                if (recovery?.error) { const error = document.createElement('p'); error.setAttribute('role', 'alert');
                    error.textContent = recovery.error; this.importEntry.append(error); }
            }
            if (sync?.state === 'relink-needed' && index.linkedDocument.pending) {
                const guidance = document.createElement('p'); guidance.setAttribute('role', 'alert');
                guidance.textContent = 'An interrupted edit is pending. Restore the Markdown at its original path, then Refresh and review recovery before relinking.';
                this.importEntry.append(guidance);
            }
            if (sync?.state === 'relink-needed' && !index.linkedDocument.pending) {
                const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Relink Markdown';
                open.onclick = () => { this.relink = { uri: this.projectUri!, path: '', busy: false }; this.renderImportEntry(); };
                this.importEntry.append(open);
                if (this.relink?.uri === this.projectUri) {
                    const label = document.createElement('label'); label.textContent = 'New project-relative .md path';
                    const input = document.createElement('input'); input.type = 'text'; input.value = this.relink.path;
                    input.setAttribute('aria-label', 'New project-relative Markdown path');
                    input.oninput = () => { if (this.relink) { this.relink.path = input.value; this.relink.preview = undefined; } };
                    input.onchange = () => this.renderImportEntry();
                    label.append(input); this.importEntry.append(label);
                    const preview = document.createElement('button'); preview.type = 'button'; preview.textContent = 'Preview relink';
                    preview.disabled = this.relink.busy;
                    preview.onclick = () => void this.previewRelink(); this.importEntry.append(preview);
                    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel relink';
                    cancel.onclick = () => { this.relink = undefined; this.renderImportEntry(); }; this.importEntry.append(cancel);
                    const choice = this.relink.preview;
                    if (choice) {
                        const summary = document.createElement('p');
                        summary.textContent = `${choice.previousPath} → ${choice.path}; SHA-256 ${choice.sourceHash ?? 'unavailable'}; ${choice.sections.length} mapped sections. ` +
                            (choice.state === 'ready' ? 'Same accepted bytes and section identities; only the link and source references will change.' : 'Review required; relink cannot be accepted.');
                        this.importEntry.append(summary);
                        if (choice.diagnostics.length) this.appendImportDiagnostics('Relink mismatches', choice.diagnostics);
                        if (choice.state === 'ready') {
                            const approve = document.createElement('button'); approve.type = 'button'; approve.textContent = 'Approve Relink';
                            approve.disabled = this.relink.busy;
                            approve.onclick = () => void this.applyRelink(choice); this.importEntry.append(approve);
                        }
                    }
                    if (this.relink.error) { const error = document.createElement('p'); error.setAttribute('role', 'alert');
                        error.textContent = this.relink.error; this.importEntry.append(error); }
                }
            }
            return;
        }
        if (index.revision !== 0) return;
        const heading = document.createElement('h3'); heading.textContent = 'Start your Roadmap';
        const actions = document.createElement('div'); actions.className = 'dope-roadmap-import-actions';
        const button = (label: string, action: () => void): HTMLButtonElement => {
            const element = document.createElement('button'); element.type = 'button'; element.textContent = label;
            element.onclick = action; return element;
        };
        const importButton = button('Import Roadmap', () => void this.discoverImport());
        importButton.disabled = !!this.importState?.busy || !!this.createState || this.createStarting;
        const chatButton = button('Plan with Chat', () => { void this.beginCreate('chat'); });
        const manualButton = button('Create Manually', () => { void this.beginCreate('manual'); });
        chatButton.disabled = manualButton.disabled = !!this.createState || this.createStarting || !!this.importState?.busy;
        actions.append(importButton,
            chatButton, manualButton);
        this.importEntry.append(heading, actions);
        if (this.createState) { this.renderCreate(); return; }
        const state = this.importState;
        if (!state || state.uri !== this.projectUri || state.projectId !== index.projectId) return;
        if (state.message) { const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = state.message; this.importEntry.append(message); }
        if (!state.showChooser) return;
        const chooser = document.createElement('div'); chooser.className = 'dope-roadmap-import-chooser';
        const label = document.createElement('label'); label.textContent = 'Project Markdown file';
        const select = document.createElement('select'); select.setAttribute('aria-label', 'Project Markdown Roadmap');
        const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose a Roadmap file'; select.append(placeholder);
        for (const candidate of state.discovery.candidates) {
            const option = document.createElement('option'); option.value = candidate.path;
            option.textContent = `${candidate.path} (${candidate.bytes} bytes)`; select.append(option);
        }
        select.value = state.path ?? '';
        select.disabled = state.busy;
        select.onchange = () => void this.previewImport(select.value);
        label.append(select);
        const cancel = button('Cancel', () => this.cancelImport());
        chooser.append(label, cancel);
        this.importEntry.append(chooser);
        if (state.discovery.diagnostics.length) this.appendImportDiagnostics('Discovery diagnostics', state.discovery.diagnostics);
        if (!state.discovery.candidates.length) {
            const empty = document.createElement('p'); empty.textContent = 'No supported Markdown candidates found in the project root or docs. Add a ROADMAP.md and refresh this list.';
            this.importEntry.append(empty);
        }
        if (!state.preview) return;
        const preview = state.preview;
        const summary = document.createElement('p');
        const unsupported = preview.diagnostics.filter(item => /unsupported/i.test(item)).length;
        const notGreen = preview.checkpoints.filter(item => item.status === 'not-green').length;
        summary.textContent = `Preview ${preview.roadmapPath}: ${preview.checkpoints.length} checkpoints, ${preview.sources.length} source files, ${unsupported} unsupported section(s), ${notGreen} Not Green checkpoint(s). ${preview.checkpoints.filter(item => item.readOnly).length} read-only checkpoint(s).`;
        this.importEntry.append(summary);
        if (preview.diagnostics.length) this.appendImportDiagnostics('Import diagnostics', preview.diagnostics);
        const caution = preview.checkpoints.flatMap(item => item.diagnostics.map(detail => `${item.title}: ${detail}`));
        if (caution.length) this.appendImportDiagnostics('Checkpoint diagnostics', caution);
        const accept = button('Accept Import', () => void this.acceptImport());
        accept.disabled = state.busy || !preview.checkpoints.length || !preview.checkpoints.some(item => !item.sectionKey.includes('/checklist-'));
        this.importEntry.append(accept);
    }

    private async applySync(preview: RoadmapSyncPreview): Promise<void> {
        const uri = this.projectUri;
        if (!uri || this.syncPreview !== preview) return;
        try {
            await this.service.applyDocumentSync(uri, preview);
            if (this.projectUri === uri) await this.refresh();
        } catch (error) {
            if (this.projectUri === uri) {
                this.status.textContent = `Linked Roadmap sync failed: ${String(error)}. Refresh and review before retrying.`;
                this.syncPreview = undefined;
                this.renderImportEntry();
            }
        }
    }

    private async previewRecovery(): Promise<void> {
        const uri = this.projectUri;
        if (!uri) return;
        const state = { uri, busy: true } as { uri: string; preview?: RoadmapPendingRecoveryPreview; error?: string; busy: boolean };
        this.recovery = state; this.renderImportEntry();
        try { state.preview = await this.service.previewPendingRecovery(uri); }
        catch (error) { state.error = String(error); }
        finally { if (this.recovery === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private async applyRecovery(preview: RoadmapPendingRecoveryPreview): Promise<void> {
        const uri = this.projectUri, state = this.recovery;
        if (!uri || !state || state.uri !== uri || state.preview !== preview || state.busy) return;
        state.busy = true; this.renderImportEntry();
        try { await this.service.applyPendingRecovery(uri, preview, true); this.recovery = undefined; await this.refresh(); }
        catch (error) { if (this.recovery === state) { state.preview = undefined; state.error = String(error); } }
        finally { if (this.recovery === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private async previewRelink(): Promise<void> {
        const state = this.relink, uri = this.projectUri;
        if (!state || !uri || state.uri !== uri || state.busy) return;
        state.busy = true; state.error = undefined; state.preview = undefined; this.renderImportEntry();
        try { const preview = await this.service.previewRelink(uri, state.path);
            if (this.relink === state && this.projectUri === uri) state.preview = preview;
        } catch (error) { if (this.relink === state) state.error = String(error); }
        finally { if (this.relink === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private async applyRelink(preview: RoadmapRelinkPreview): Promise<void> {
        const state = this.relink, uri = this.projectUri;
        if (!state || !uri || state.uri !== uri || state.preview !== preview || state.busy) return;
        state.busy = true; this.renderImportEntry();
        try { await this.service.applyRelink(uri, preview, true);
            if (this.relink === state) { this.relink = undefined; await this.refresh(); }
        } catch (error) { if (this.relink === state) { state.preview = undefined;
            state.error = `Relink failed: ${String(error)}. Refresh and review before retrying.`; } }
        finally { if (this.relink === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private appendImportDiagnostics(title: string, diagnostics: string[]): void {
        const group = document.createElement('details');
        const heading = document.createElement('summary'); heading.textContent = `${title} (${diagnostics.length})`;
        const list = document.createElement('ul');
        for (const diagnostic of diagnostics) { const item = document.createElement('li'); item.textContent = diagnostic; list.append(item); }
        group.append(heading, list); this.importEntry.append(group);
    }

    private showSetupMessage(message: string): void {
        const index = this.inspector.index, uri = this.projectUri;
        if (!index || !uri) return;
        ++this.importSerial;
        this.importState = { uri, projectId: index.projectId, revision: index.revision,
            discovery: this.importState?.discovery ?? { candidates: [], diagnostics: [] }, busy: false, showChooser: false, message };
        this.renderImportEntry();
    }

    private async discoverImport(): Promise<void> {
        const index = this.inspector.index, uri = this.projectUri;
        if (!index || !uri || index.revision !== 0) return;
        const serial = ++this.importSerial;
        this.importState = { uri, projectId: index.projectId, revision: index.revision,
            discovery: { candidates: [], diagnostics: [] }, busy: true, showChooser: false, message: 'Finding project Markdown Roadmaps…' };
        this.renderImportEntry();
        try {
            const discovery = await this.service.discoverImports(uri);
            if (!this.currentImport(serial, uri, index.projectId, index.revision)) return;
            this.importState = { uri, projectId: index.projectId, revision: index.revision, discovery, busy: false, showChooser: true };
            this.renderImportEntry();
            this.importEntry.querySelector<HTMLSelectElement>('select')?.focus();
        } catch (error) { this.importError(serial, `Could not list Roadmaps: ${String(error)}. Refresh and retry.`); }
    }

    private async previewImport(path: string): Promise<void> {
        const state = this.importState;
        if (!state) return;
        const serial = ++this.importSerial;
        this.importState = { ...state, path, preview: undefined, busy: !!path, message: path ? 'Reading import preview…' : undefined };
        this.renderImportEntry();
        if (!path) return;
        try {
            const preview = await this.service.previewImport(state.uri, path);
            if (!this.currentImport(serial, state.uri, state.projectId, state.revision)) return;
            this.importState = { ...this.importState!, preview, busy: false, message: undefined };
            this.renderImportEntry();
            this.importEntry.querySelector<HTMLSelectElement>('select')?.focus();
        } catch (error) { this.importError(serial, `Import preview failed: ${String(error)}. Choose another file or retry.`); }
    }

    private async acceptImport(): Promise<void> {
        const state = this.importState;
        if (!state?.preview || state.busy || !state.preview.checkpoints.length) return;
        const serial = ++this.importSerial;
        this.importState = { ...state, busy: true, message: 'Checking Roadmap revision and source…' };
        this.renderImportEntry();
        try {
            const current = await this.service.read(state.uri);
            if (!this.currentImport(serial, state.uri, state.projectId, state.revision) ||
                current.projectId !== state.projectId || current.revision !== state.revision)
                throw new Error('Roadmap changed. Refresh, choose the file and preview again');
            const result = await this.service.acceptImport(state.uri, state.revision, state.projectId, state.preview);
            if (!this.currentImport(serial, state.uri, state.projectId, state.revision)) return;
            this.inspector.setSnapshot(state.uri, result);
            await this.refresh();
            if (this.projectUri === state.uri && this.inspector.index?.revision === result.revision)
                this.status.textContent = `Imported and linked ${result.linkedDocument?.path ?? state.preview.roadmapPath} · ${result.linkedDocument?.syncState ?? 'no supported sections'}.`;
        } catch (error) { this.importError(serial, `Import was not accepted: ${String(error)}. Refresh and preview again.`); }
    }

    private currentImport(serial: number, uri: string, projectId: string, revision: number): boolean {
        return !this.isDisposed && serial === this.importSerial && this.projectUri === uri &&
            this.inspector.index?.projectId === projectId && this.inspector.index.revision === revision;
    }

    private importError(serial: number, message: string): void {
        if (serial !== this.importSerial || !this.importState) return;
        this.importState = { ...this.importState, busy: false, preview: undefined, message };
        this.renderImportEntry();
    }

    private cancelImport(): void { ++this.importSerial; this.importState = undefined; this.renderImportEntry(); }

    private async beginCreate(mode: 'manual' | 'chat'): Promise<void> {
        const uri = this.projectUri, index = this.inspector.index;
        if (!uri || !index || index.revision !== 0 || this.createState || this.createStarting || this.importState?.busy) return;
        const serial = ++this.createSerial;
        this.createStarting = true; this.renderImportEntry();
        try {
            const started = await this.service.beginDraft(uri);
            if (serial !== this.createSerial || this.projectUri !== uri || this.inspector.index?.projectId !== index.projectId ||
                this.inspector.index.revision !== 0) { await this.service.cancelDraft(started.handle); return; }
            this.importState = undefined;
            this.createState = { uri, projectId: index.projectId, handle: started.handle, draft: started.draft,
                mode, path: 'ROADMAP.md', busy: false };
            this.createStarting = false; this.renderImportEntry();
            this.importEntry.querySelector<HTMLInputElement>('.dope-roadmap-create input')?.focus();
        } catch (error) { if (serial === this.createSerial && this.projectUri === uri && this.inspector.index?.projectId === index.projectId)
            this.showSetupMessage(`Could not start a Roadmap draft: ${String(error)}. Refresh and retry.`); }
        finally { if (serial === this.createSerial) { this.createStarting = false; this.renderImportEntry(); } }
    }

    private async editCreate(action: GreenfieldEdit): Promise<void> {
        const state = this.createState;
        if (!state || state.busy) return;
        const serial = ++this.createSerial;
        state.busy = true; state.error = undefined; this.renderImportEntry();
        try {
            const draft = await this.service.editDraft(state.handle, state.draft.revision, action);
            if (serial !== this.createSerial || this.createState !== state) return;
            state.draft = draft; state.preview = undefined;
        } catch (error) { if (serial === this.createSerial && this.createState === state) state.error = `Draft edit failed: ${String(error)}. Correct the fields and retry.`; }
        finally { if (serial === this.createSerial && this.createState === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private async previewCreate(): Promise<void> {
        const state = this.createState; if (!state || state.busy) return;
        const serial = ++this.createSerial; state.busy = true; state.error = undefined; this.renderImportEntry();
        try {
            const preview = await this.service.previewDraft(state.handle, state.path);
            if (serial === this.createSerial && this.createState === state) state.preview = preview;
        } catch (error) { if (serial === this.createSerial && this.createState === state) state.error = `Preview failed: ${String(error)}. Choose an unused project Markdown path and retry.`; }
        finally { if (serial === this.createSerial && this.createState === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private async acceptCreate(): Promise<void> {
        const state = this.createState; if (!state?.preview || state.busy) return;
        const serial = ++this.createSerial; state.busy = true; state.error = undefined; this.renderImportEntry();
        try {
            const current = await this.service.read(state.uri);
            if (current.projectId !== state.projectId || current.revision !== 0 || this.projectUri !== state.uri)
                throw new Error('Roadmap changed. Refresh and start a new draft');
            const result = await this.service.acceptDraft(state.handle, state.preview, true);
            if (serial !== this.createSerial || this.createState !== state) return;
            this.createState = undefined;
            this.inspector.setSnapshot(state.uri, result);
            await this.refresh();
        } catch (error) { if (serial === this.createSerial && this.createState === state) state.error = `Creation failed: ${String(error)}. Review the preview and retry, or Refresh to recover.`; }
        finally { if (serial === this.createSerial && this.createState === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private cancelCreate(): void {
        const state = this.createState; if (!state) return;
        ++this.createSerial; this.createState = undefined;
        void this.service.cancelDraft(state.handle).catch(() => undefined);
        this.renderImportEntry();
    }

    private renderCreate(): void {
        const state = this.createState; if (!state) return;
        const section = document.createElement('section'); section.className = 'dope-roadmap-create';
        const heading = document.createElement('h4'); heading.textContent = state.mode === 'chat' ? 'Plan with an existing Chat' : 'Create a Roadmap manually';
        const note = document.createElement('p'); note.textContent = 'Build one phase and checkpoint at a time. Preview before approving a new Markdown file. No model is needed.';
        section.append(heading, note);
        const button = (label: string, action: () => void): HTMLButtonElement => {
            const element = document.createElement('button'); element.type = 'button'; element.textContent = label;
            element.disabled = state.busy; element.onclick = action; return element;
        };
        if (state.mode === 'chat') {
            const chats = this.savedChats(state.uri);
            if (state.chatId && !chats.some(chat => chat.id === state.chatId)) {
                state.chatId = undefined;
                void this.service.bindDraftChat(state.uri, state.handle, '').catch(() => undefined);
            }
            const label = document.createElement('label'); label.textContent = 'Saved Chat for planning';
            const select = document.createElement('select'); select.setAttribute('aria-label', 'Saved Chat for Roadmap planning');
            select.disabled = state.busy;
            const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose an open saved Chat'; select.append(empty);
            for (const chat of chats) { const option = document.createElement('option'); option.value = chat.id; option.textContent = chat.title; select.append(option); }
            select.value = state.chatId ?? ''; select.onchange = () => { if (state.busy) return; state.busy = true; select.disabled = true; void (async () => {
                const chatId = select.value;
                try {
                    await this.service.bindDraftChat(state.uri, state.handle, chatId);
                    if (this.createState !== state) return;
                    state.chatId = chatId || undefined; state.error = undefined;
                } catch (error) { state.error = `Chat binding failed: ${String(error)}. Choose a saved Chat in this project.`; }
                state.busy = false; this.renderImportEntry(); this.importEntry.querySelector<HTMLSelectElement>('.dope-roadmap-create select')?.focus();
            })(); };
            label.append(select); section.append(label);
            const guidance = document.createElement('p');
            guidance.textContent = state.chatId ? 'Use the selected Chat where you placed it. Review each draft proposal there before applying it. Confirmed edits appear here after Refresh.' :
                'Open and select a saved Chat using the ordinary Chat panel, then choose it here. You can build the draft manually now.';
            section.append(guidance);
        }
        const form = document.createElement('form');
        const phaseLabel = document.createElement('label'); phaseLabel.textContent = 'New phase title';
        const phase = document.createElement('input'); phase.required = true; phase.maxLength = 200; phaseLabel.append(phase);
        const objectiveLabel = document.createElement('label'); objectiveLabel.textContent = 'Objective (optional)';
        const objective = document.createElement('input'); objective.maxLength = 8192; objectiveLabel.append(objective);
        form.onsubmit = event => { event.preventDefault(); void this.editCreate({ type: 'create-phase', title: phase.value, objective: objective.value }); };
        const addPhase = document.createElement('button'); addPhase.type = 'submit'; addPhase.textContent = 'Add phase'; addPhase.disabled = state.busy;
        form.append(phaseLabel, objectiveLabel, addPhase); section.append(form);
        for (const item of state.draft.phases) {
            const group = document.createElement('section');
            const title = document.createElement('h5'); title.textContent = item.title;
            const description = document.createElement('p'); description.textContent = item.objective || 'No objective yet.';
            group.append(title, description);
            const phaseEdit = document.createElement('form');
            const phaseTitleLabel = document.createElement('label'); phaseTitleLabel.textContent = `Edit ${item.title} title`;
            const phaseTitle = document.createElement('input'); phaseTitle.value = item.title; phaseTitle.required = true; phaseTitle.maxLength = 200; phaseTitleLabel.append(phaseTitle);
            const phaseObjectiveLabel = document.createElement('label'); phaseObjectiveLabel.textContent = 'Phase objective';
            const phaseObjective = document.createElement('input'); phaseObjective.value = item.objective; phaseObjective.maxLength = 8192; phaseObjectiveLabel.append(phaseObjective);
            phaseEdit.onsubmit = event => { event.preventDefault(); void this.editCreate({ type: 'edit-phase', phaseId: item.id,
                title: phaseTitle.value, objective: phaseObjective.value }); };
            const savePhase = document.createElement('button'); savePhase.type = 'submit'; savePhase.textContent = 'Update phase'; savePhase.disabled = state.busy;
            phaseEdit.append(phaseTitleLabel, phaseObjectiveLabel, savePhase); group.append(phaseEdit);
            for (const checkpoint of item.checkpoints) {
                const edit = document.createElement('form');
                const checkpointTitleLabel = document.createElement('label'); checkpointTitleLabel.textContent = `Edit ${checkpoint.title} title`;
                const checkpointTitle = document.createElement('input'); checkpointTitle.value = checkpoint.title;
                checkpointTitle.required = true; checkpointTitle.maxLength = 200; checkpointTitleLabel.append(checkpointTitle);
                const checkpointObjectiveLabel = document.createElement('label'); checkpointObjectiveLabel.textContent = 'Checkpoint objective';
                const checkpointObjective = document.createElement('input'); checkpointObjective.value = checkpoint.objective;
                checkpointObjective.maxLength = 8192; checkpointObjectiveLabel.append(checkpointObjective);
                edit.onsubmit = event => { event.preventDefault(); void this.editCreate({ type: 'edit-checkpoint', phaseId: item.id,
                    checkpointId: checkpoint.id, title: checkpointTitle.value, objective: checkpointObjective.value }); };
                const save = document.createElement('button'); save.type = 'submit'; save.textContent = 'Update checkpoint'; save.disabled = state.busy;
                edit.append(checkpointTitleLabel, checkpointObjectiveLabel, save); group.append(edit);
            }
            const checkpointForm = document.createElement('form');
            const checkpointLabel = document.createElement('label'); checkpointLabel.textContent = `New checkpoint in ${item.title}`;
            const checkpointInput = document.createElement('input'); checkpointInput.required = true; checkpointInput.maxLength = 200; checkpointLabel.append(checkpointInput);
            const checkpointObjectiveLabel = document.createElement('label'); checkpointObjectiveLabel.textContent = 'Objective (optional)';
            const checkpointObjective = document.createElement('input'); checkpointObjective.maxLength = 8192; checkpointObjectiveLabel.append(checkpointObjective);
            checkpointForm.onsubmit = event => { event.preventDefault(); void this.editCreate({ type: 'create-checkpoint', phaseId: item.id,
                title: checkpointInput.value, objective: checkpointObjective.value }); };
            const add = document.createElement('button'); add.type = 'submit'; add.textContent = 'Add checkpoint'; add.disabled = state.busy;
            checkpointForm.append(checkpointLabel, checkpointObjectiveLabel, add); group.append(checkpointForm); section.append(group);
        }
        const pathLabel = document.createElement('label'); pathLabel.textContent = 'New Markdown path in this project';
        const path = document.createElement('input'); path.value = state.path; path.maxLength = 512;
        path.oninput = () => { state.path = path.value; state.preview = undefined;
            section.querySelector('[data-approve-draft]')?.remove(); section.querySelector('pre')?.remove(); };
        pathLabel.append(path); section.append(pathLabel);
        section.append(button('Preview Roadmap', () => void this.previewCreate()), button('Cancel draft', () => this.cancelCreate()));
        if (state.preview) {
            const summary = document.createElement('pre'); summary.setAttribute('aria-label', 'Roadmap creation preview');
            summary.textContent = state.preview.markdown; section.append(summary);
            const approve = button(`Approve and create ${state.preview.path}`, () => void this.acceptCreate());
            approve.dataset.approveDraft = 'true'; section.append(approve);
        }
        if (state.error) { const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = state.error; section.append(error); }
        this.importEntry.append(section);
    }


    private renderPools(): void {
        const projection = this.projection;
        if (!projection) return;
        const filterFocused = document.activeElement === this.poolFilter;
        const filterSelection = filterFocused ? [this.poolFilter.selectionStart, this.poolFilter.selectionEnd] : undefined;
        this.pools.replaceChildren();
        const heading = document.createElement('h2');
        heading.textContent = 'Unsequenced Ideas and Issues';
        const hint = document.createElement('p');
        const selectedCheckpoint = this.inspector.index?.checkpoints.some(item => item.id === this.selectedId && !item.readOnly);
        hint.textContent = selectedCheckpoint ? 'Link a record to the selected checkpoint. The original record stays with its owner.' :
            'Select a checkpoint above to link an Idea or Issue.';
        this.pools.append(heading, hint, this.poolFilter);
        if (filterFocused) {
            this.poolFilter.focus();
            if (filterSelection && filterSelection[0] !== null && filterSelection[1] !== null)
                this.poolFilter.setSelectionRange(filterSelection[0], filterSelection[1]);
        }
        const query = this.poolQuery.trim().toLocaleLowerCase();
        for (const [label, records] of [['Ideas', projection.pools.ideas], ['Issues', projection.pools.issues]] as const) {
            const group = document.createElement('section');
            const title = document.createElement('h3'); title.textContent = label;
            const list = document.createElement('ul'); list.setAttribute('aria-label', `Detached ${label}`);
            const matches = records.filter(record => !query || `${record.title} ${record.status} ${record.targetId} ${record.provenance}`.toLocaleLowerCase().includes(query));
            for (const record of matches) {
                const item = document.createElement('li');
                const name = document.createElement('strong'); name.textContent = record.title;
                const details = document.createElement('span');
                details.textContent = `${record.status} · ${record.provenance} · ${record.targetId}`;
                const link = document.createElement('button'); link.type = 'button';
                link.textContent = 'Promote / link to selected checkpoint';
                link.setAttribute('aria-label', `Promote or link ${record.title} to selected checkpoint`);
                link.disabled = !selectedCheckpoint || this.mutating;
                link.onclick = () => void this.changeLink('link', this.selectedId!, record.owner === 'issue'
                    ? { owner: 'issue', targetId: record.targetId, sourceHash: record.sourceHash }
                    : { owner: 'project-mind', targetId: record.targetId, ownerRevision: record.ownerRevision });
                if (record.owner === 'project-mind') {
                    const open = document.createElement('button'); open.type = 'button';
                    open.textContent = 'Open in Project Mind';
                    open.setAttribute('aria-label', `Open ${record.title} in Project Mind`);
                    open.onclick = () => void this.openMindRecord(record.targetId);
                    item.append(name, details, open, link);
                } else item.append(name, details, link);
                list.append(item);
            }
            if (!matches.length) { const empty = document.createElement('li'); empty.textContent = 'No matching detached records.'; list.append(empty); }
            group.append(title, list); this.pools.append(group);
        }
        if (projection.unlinkedTasks.length) {
            const group = document.createElement('section');
            const title = document.createElement('h3'); title.textContent = 'Unlinked task sources';
            const list = document.createElement('ul'); list.setAttribute('aria-label', 'Unlinked task sources');
            for (const source of projection.unlinkedTasks.filter(item => !query ||
                `${item.title} ${item.path} ${item.reason}`.toLocaleLowerCase().includes(query))) {
                const item = document.createElement('li');
                item.textContent = `${source.title} · ${source.path} · ${source.reason}`;
                list.append(item);
            }
            if (!list.childElementCount) { const empty = document.createElement('li'); empty.textContent = 'No matching task sources.'; list.append(empty); }
            group.append(title, list); this.pools.append(group);
        }
        const selected = this.inspector.selected;
        if (selected) {
            const linked = document.createElement('section');
            const title = document.createElement('h3'); title.textContent = `Linked to ${selected.title}`;
            const list = document.createElement('ul'); list.setAttribute('aria-label', 'Linked Ideas and Issues');
            for (const link of selected.links.filter(link => link.owner === 'issue' || link.owner === 'project-mind')) {
                const record = this.owners.find(owner => owner.owner === link.owner && owner.targetId === link.targetId);
                const current = record && (record.owner === 'issue' ? record.sourceHash === link.sourceHash : record.ownerRevision === link.ownerRevision);
                const item = document.createElement('li');
                const text = document.createElement('span');
                text.textContent = record ? `${record.title} · ${record.status} · ${current ? 'linked' : 'changed owner reference'}` :
                    `${link.owner} · ${link.targetId} · missing owner reference`;
                const unlink = document.createElement('button'); unlink.type = 'button'; unlink.textContent = 'Unlink';
                unlink.setAttribute('aria-label', `Unlink ${record?.title ?? link.targetId} from ${selected.title}`);
                unlink.disabled = this.mutating || selected.readOnly;
                unlink.onclick = () => void this.changeLink('unlink', selected.id, link);
                if (link.owner === 'project-mind') {
                    const open = document.createElement('button'); open.type = 'button';
                    open.textContent = 'Open in Project Mind';
                    open.setAttribute('aria-label', `Open ${record?.title ?? link.targetId} in Project Mind`);
                    open.onclick = () => void this.openMindRecord(link.targetId);
                    item.append(text, open, unlink);
                } else item.append(text, unlink);
                list.append(item);
            }
            if (!list.childElementCount) { const empty = document.createElement('li'); empty.textContent = 'No linked Ideas or Issues.'; list.append(empty); }
            linked.append(title, list); this.pools.append(linked);
        }
    }

    private async openMindRecord(id: string): Promise<void> {
        const workspace = this.projectUri;
        if (!workspace) return;
        try {
            if (!await this.openMind(id, workspace) && this.projectUri === workspace)
                this.status.textContent = 'Project Mind reference is missing, stale, foreign, or a draft is unsaved. Open Project Mind to inspect or recover.';
        } catch (error) {
            if (this.projectUri === workspace) this.status.textContent = `Project Mind unavailable: ${String(error)}. Refresh and retry.`;
        }
    }

    private async changeLink(type: 'link' | 'unlink', id: string, link: RoadmapLink): Promise<void> {
        const uri = this.projectUri, index = this.inspector.index;
        if (this.mutating || !uri || !index || !index.checkpoints.some(item => item.id === id && !item.readOnly)) return;
        this.mutating = true; this.renderPools();
        let handle: string | undefined;
        try {
            const attached = await this.service.attach(uri);
            handle = attached.projectHandle;
            if (this.projectUri !== uri || attached.snapshot.projectId !== index.projectId || attached.snapshot.revision !== index.revision)
                throw new Error('Roadmap changed. Refresh and retry.');
            const source = index.checkpoints.find(item => item.id === id)?.source;
            const request: PlanningActionRequest = { projectHandle: handle, ownerId: index.projectId,
                expectedRevision: index.revision, sourceHashes: source ? { [id]: source.sha256 } : undefined,
                actions: [{ type, id, link }] };
            const preview = await this.service.preview(request);
            if (this.projectUri !== uri || this.inspector.index?.revision !== index.revision) throw new Error('Roadmap changed. Refresh and retry.');
            if (preview.requiresApproval && !window.confirm(`Unlink ${link.targetId} from ${id}? The original record will remain intact.`)) return;
            const result = await this.service.apply(request, preview.token, preview.requiresApproval);
            if (this.projectUri === uri) {
                this.inspector.setSnapshot(uri, result);
                await this.refresh();
                if (this.projectUri === uri && this.projection?.revision === result.revision)
                    this.status.textContent = `${type === 'link' ? 'Linked' : 'Unlinked'} ${link.targetId}. Original owner record unchanged.`;
            }
        } catch (error) {
            if (this.projectUri === uri) this.status.textContent = `Roadmap link failed: ${error instanceof Error ? error.message : String(error)} Refresh and retry.`;
        } finally {
            if (handle) { try { await this.service.detach(handle); } catch { /* Connection may have closed. */ } }
            this.mutating = false; this.renderPools();
        }
    }

    private select(id: string, focus = false): void {
        const node = this.projection?.nodes.find(candidate => candidate.id === id);
        if (!node) return;
        if (this.promptWindow && this.promptWindow.stackId !== id) this.promptWindow = undefined;
        this.selectedId = id;
        this.schedulePresentation();
        if (node.taskSource) this.inspector.selectTask(node);
        else this.inspector.select(id);
        this.render();
        if (focus) requestAnimationFrame(() => [...this.path.querySelectorAll<HTMLButtonElement>('button')]
            .find(button => button.dataset.checkpointId === id)?.focus());
    }

    private activateCheckpoint(id: string): void {
        const node = this.projection?.nodes.find(candidate => candidate.id === id);
        if (!node) return;
        this.select(id);
        if (node.kind === 'prompt') void this.inspector.openPrompt(node);
        else { this.setExpansion(true); this.focusSelection(); }
    }

    private onPathKey(event: KeyboardEvent): void {
        const target = event.target as HTMLElement;
        const current = target.closest<HTMLButtonElement>('button[data-checkpoint-id]');
        if (event.key === 'Enter' && current && this.path.contains(current)) {
            event.preventDefault();
            this.activateCheckpoint(current.dataset.checkpointId!);
            return;
        }
        const action = roadmapKeyboardAction(event.key, event.shiftKey, event.altKey, this.arranging);
        if (action && (target === this.path || (current && this.path.contains(current)))) {
            event.preventDefault();
            const kind = action.startsWith('move') ? 'move' : 'pan';
            const direction = action.slice(kind.length + 1);
            const dx = direction === 'left' ? -40 : direction === 'right' ? 40 : 0;
            const dy = direction === 'up' ? -40 : direction === 'down' ? 40 : 0;
            if (kind === 'pan' && this.flow) {
                const view = this.flow.getViewport();
                void this.flow.setViewport({ ...view, x: view.x - dx, y: view.y - dy });
            } else if (kind === 'move' && current && this.projection) {
                const id = current.dataset.checkpointId!;
                const position = this.placements.get(id) ?? roadmapSpatialLayout(this.projection).get(id);
                if (position) { this.placements.set(id, { x: position.x + dx, y: position.y + dy });
                    this.schedulePresentation(); this.renderFlow(); current.focus(); }
            }
            return;
        }
        if (!current || !this.path.contains(current) || event.altKey || event.shiftKey) return;
        const ids = this.projection ? roadmapCanvasOrder({ ...this.projection,
            ...roadmapVisibleGraph(this.projection, this.detail, this.selectedId, this.expanded, this.collapsed, 96, this.promptWindow) })
            .map(node => node.id) : [];
        const positions = this.projection ? roadmapSpatialLayout(this.projection) : new Map<string, { x: number; y: number }>();
        for (const [id, position] of this.placements) positions.set(id, position);
        const next = roadmapSpatialNextId(ids, positions, current.dataset.checkpointId, event.key);
        if (next === undefined) return;
        event.preventDefault();
        this.select(next, true);
    }

    private presentation(): RoadmapViewportState | undefined {
        if (!this.projectId) return undefined;
        return roadmapViewportSnapshot(this.projectId, this.viewport, this.selectedId,
            this.expanded, this.collapsed, this.placements);
    }

    private schedulePresentation(): void {
        if (!this.saveKey || !this.storage) return;
        if (this.saveTimer) clearTimeout(this.saveTimer);
        this.saveTimer = setTimeout(() => this.flushPresentation(), 350);
    }

    private flushPresentation(): void {
        if (!this.saveTimer) return;
        clearTimeout(this.saveTimer);
        this.saveTimer = undefined;
        const state = this.presentation();
        if (this.saveKey && state && this.storage) {
            const key = this.saveKey;
            this.saveWrite = this.saveWrite.catch(() => undefined).then(() => this.storage?.setData(key, state));
            void this.saveWrite.catch(() => {
                if (!this.isDisposed) this.status.textContent = 'Roadmap view could not be saved. Try moving a card or the map again.';
            });
        }
    }

    override dispose(): void { ++this.request; ++this.importSerial; ++this.createSerial;
        this.flushPresentation();
        if (this.createState) void this.service.cancelDraft(this.createState.handle).catch(() => undefined);
        window.removeEventListener('focus', this.focusRecheck);
        void this.service.observeLinkedDocument(undefined).catch(() => undefined); this.rootsListener.dispose(); this.modelListener(); super.dispose(); }
}
