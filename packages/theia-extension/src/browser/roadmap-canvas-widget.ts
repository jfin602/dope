import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ReactFlow, Background, BaseEdge, Handle, Position, MarkerType, type Edge, type EdgeProps, type Node, type NodeChange, type ReactFlowInstance } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { BaseWidget, Message, codicon } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import type { CheckpointNode } from '@dope/project-intelligence/lib/roadmap-projection';
import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { GateDocumentSyncPreview, GateDocumentRelinkPreview } from '@dope/project-intelligence/lib/node/roadmap-gate-document';
import { projectRoadmapTasks, selectPhaseFocus, type TaskRoadmapProjection } from '@dope/project-intelligence/lib/roadmap-task-projection';
import type { RoadmapTaskStack } from '@dope/agent-core/lib/node/roadmap-task-discovery';
import type { RoadmapService } from '../roadmap-service';
import type { PhaseFocusEvidence } from '../node/phase-focus-evidence';
import type { RoadmapOwnerRecord } from '@dope/project-intelligence/lib/node/roadmap-owner-links';
import type { RoadmapIndex, RoadmapLink, RoadmapReplacementPreview } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { PlanningActionRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import type { RoadmapCandidateDiscovery, RoadmapImportPreview } from '@dope/project-intelligence/lib/node/roadmap-import';
import type { RoadmapSyncPreview, RoadmapRelinkPreview, RoadmapPendingRecoveryPreview } from '@dope/project-intelligence/lib/node/roadmap-document-sync';
import type { GreenfieldDraft, GreenfieldEdit, GreenfieldPreview, GreenfieldEditPreview, GreenfieldChange, ImplementationPlanDraft, ImplementationPlanProjectionPreview } from '@dope/project-intelligence/lib/node/roadmap-greenfield';
import type { ChatStrategicDraftReview, ChatEvent } from '@dope/chat/lib/service';
import { currentDraftChange, projectRoadmapDraft, projectGateDraftCards, gatePhaseCards, roadmapGateLabel, roadmapSelectableGate, roadmapCanvasOrder, roadmapCanvasConnectors, roadmapConnectorTouchesSelection, roadmapImplementationStacks, roadmapSpatialNextId, roadmapSpatialLayout, roadmapEdgeHandles, roadmapBranchPath, roadmapDetailAtZoom, roadmapVisibleGraph,
    type RoadmapDetail, type RoadmapVisibleGraph } from './roadmap-canvas-model';
import { RoadmapInspectorModel } from './roadmap-inspector-model';
import { RoadmapInspectorWidget } from './roadmap-inspector-widget';
import { roadmapEdgeStatus, roadmapStatusMark } from './roadmap-status-style';
import { readRoadmapViewport, roadmapGestures, roadmapInitialCamera, roadmapInitialTarget, roadmapKeyboardAction, roadmapKeyboardCamera, roadmapUserViewportEvent,
    roadmapViewportKey, roadmapLegacyViewportKey, roadmapViewportSnapshot,
    type RoadmapViewportState } from './roadmap-viewport';
import './dope.css';

type RoadmapReplacementState = { uri: string; projectId: string; revision: number; path: string;
    discovery: RoadmapCandidateDiscovery; preview?: RoadmapReplacementPreview; error?: string; busy: boolean; applying?: boolean };

function RoadmapNode({ data }: { data: { item: CheckpointNode; selected: boolean; relation: string; omitted: number; detail: RoadmapDetail;
    selectedGateId?: string; select: (id: string) => void; selectGate: (gateId: string, phaseId: string) => void;
    activate: (id: string) => void;
    reveal: (id: string, element: HTMLButtonElement) => void } }): React.ReactElement {
    const item = data.item;
    const card = item.phaseCard;
    if (card) return React.createElement(React.Fragment, null,
        React.createElement(Handle, { id: 'left', type: 'target', position: Position.Left, isConnectable: false }),
        React.createElement(Handle, { id: 'right-target', type: 'target', position: Position.Right, isConnectable: false }),
        React.createElement('div', { className: `dope-roadmap-node dope-roadmap-phase-card dope-roadmap-phase-${card.presentation}`,
            'data-phase-id': item.id },
        React.createElement('button', { type: 'button', className: 'dope-roadmap-phase-main',
            'data-checkpoint-id': item.id, 'aria-current': data.selected ? 'true' : undefined,
            'aria-label': `Phase ${card.number}: ${item.title}; ${item.statusLabel}`,
            onFocus: event => data.reveal(item.id, event.currentTarget as HTMLButtonElement),
            onClick: event => { event.stopPropagation(); data.select(item.id); } },
            React.createElement('small', { className: 'dope-roadmap-authority' },
                item.draftState === 'proposed' ? 'Proposed · review required' :
                    item.draftState === 'accepted' ? 'Accepted draft · not yet canonical' : 'Canonical Roadmap'),
            React.createElement('small', { className: 'dope-roadmap-phase-label' }, `PHASE ${card.number}`),
            React.createElement('strong', null, item.title),
            React.createElement('span', { className: 'dope-roadmap-status' }, item.statusLabel)),
        React.createElement('span', { className: 'dope-roadmap-phase-divider', 'aria-hidden': true }),
        React.createElement('span', { className: 'dope-roadmap-phase-count' },
            card.required ? `${card.qualified} of ${card.required} gates qualified` : 'No accepted gates · Unplanned'),
        React.createElement('span', { className: 'dope-roadmap-phase-track', role: 'progressbar',
            'aria-label': 'Required accepted Gates qualified', 'aria-valuemin': 0,
            'aria-valuemax': card.required || 1, 'aria-valuenow': card.qualified,
            'aria-valuetext': card.required ? `${card.qualified} of ${card.required} gates qualified` : 'No accepted gates' },
            React.createElement('span', { style: { width: card.required ? `${100 * card.qualified / card.required}%` : '0%' } })),
        React.createElement('div', { className: 'dope-roadmap-phase-children nowheel' },
            ...card.gates.map(gate => React.createElement('details', { key: gate.id,
                className: `dope-roadmap-gate-row dope-roadmap-gate-${gate.status} nodrag nopan`, 'data-gate-id': gate.id,
                'aria-current': data.selectedGateId === gate.id ? 'true' : undefined,
                onClick: event => event.stopPropagation(),
                onDoubleClick: event => event.stopPropagation(),
                onKeyDown: event => { const details = event.currentTarget as HTMLDetailsElement;
                    if (event.key === 'Escape' && details.open) {
                        event.stopPropagation(); event.preventDefault(); details.open = false;
                        (event.currentTarget.querySelector('summary') as HTMLElement | null)?.focus();
                    } } },
                React.createElement('summary', { className: 'dope-roadmap-gate-summary',
                    onClick: event => { if (window.getSelection()?.toString()) event.preventDefault(); } },
                    React.createElement('span', { className: 'dope-roadmap-gate-icon', 'aria-hidden': true },
                        gate.proposed ? '◇' : gate.status === 'green' ? '✓' : gate.status === 'not-green' ? '!' : '?'),
                    React.createElement('span', { className: 'dope-roadmap-gate-title' }, roadmapGateLabel(gate)),
                    React.createElement('span', { className: 'dope-roadmap-gate-qualifier' },
                        gate.proposed ? 'Proposed / Not accepted' : gate.status.replaceAll('-', ' ')),
                    React.createElement('span', { className: 'dope-roadmap-gate-chevron', 'aria-hidden': true }, '⌄')),
                React.createElement('div', { className: 'dope-roadmap-gate-foldout' },
                    React.createElement('p', null, `Objective: ${gate.purpose}`),
                    React.createElement('strong', null, 'Criteria'),
                    gate.criteria.length ? gate.criteria.map(criterion => React.createElement('details', { key: criterion.id },
                        React.createElement('summary', null, criterion.title),
                        React.createElement('p', null, `Expected: ${criterion.expectedResult}`),
                        React.createElement('p', null, criterion.evidence.length ?
                            criterion.evidence.map(evidence => `${evidence.result} (${evidence.review.status}${evidence.validation ? ', stale' : ''}): ${evidence.summary}`).join('; ') :
                            'No evidence recorded.'))) : React.createElement('p', null, 'No criteria recorded.'),
                    React.createElement('p', null, `Dependencies: ${gate.dependencies.join(', ') || 'None recorded.'}`),
                    React.createElement('p', null, `Corrections: ${card.corrections.filter(correction =>
                        correction.parent.kind === 'gate' && correction.parent.id === gate.id)
                        .map(correction => correction.title).join(', ') || 'None recorded.'}`),
                    React.createElement('button', { type: 'button', className: 'nodrag',
                        onClick: event => { event.stopPropagation(); data.selectGate(gate.id, item.id); } },
                        `Open ${gate.designation} details`)))),
            ...card.corrections.filter(correction => correction.parent.kind === 'phase').map(correction =>
                React.createElement('span', { key: correction.id, className: 'dope-roadmap-correction-row' },
                    `Phase correction · ${correction.title} · ${correction.qualificationStatus}`)))),
        React.createElement(Handle, { id: 'right', type: 'source', position: Position.Right, isConnectable: false }));
    return React.createElement(React.Fragment, null,
        React.createElement(Handle, { id: 'left', type: 'target', position: Position.Left, isConnectable: false }),
        React.createElement(Handle, { id: 'top', type: 'target', position: Position.Top, isConnectable: false }),
        React.createElement(Handle, { id: 'bottom', type: 'target', position: Position.Bottom, isConnectable: false }),
        React.createElement(Handle, { id: 'right-target', type: 'target', position: Position.Right, isConnectable: false }),
        React.createElement('button', { type: 'button', className: `dope-roadmap-node dope-roadmap-status-${item.status}${item.draftState ? ` dope-roadmap-draft-${item.draftState}` : ''}${card ? ' dope-roadmap-phase-card' : ''}`,
            'data-checkpoint-id': item.id, 'aria-current': data.selected ? 'true' : undefined,
            'aria-label': `${item.draftState === 'proposed' ? 'Proposed draft' : item.draftState === 'accepted' ? 'Accepted draft' : 'Canonical Roadmap'} ${item.kind}: ${item.title}; ${item.statusLabel}${item.phaseAssociation?.unresolvedReason ?
                `; Parent unresolved: ${item.phaseAssociation.unresolvedReason}` : ''}${data.relation ? `; ${data.relation}` : ''}${data.omitted ? `; ${data.omitted} prompts hidden` : ''}`,
            onFocus: event => data.reveal(item.id, event.currentTarget as HTMLButtonElement),
            onClick: event => { event.stopPropagation(); data.select(item.id); },
            onDoubleClick: event => { event.stopPropagation(); data.activate(item.id); } },
        React.createElement('small', { className: 'dope-roadmap-authority' },
            item.draftState === 'proposed' ? 'Proposed · review required' :
                item.draftState === 'accepted' ? 'Accepted draft · not yet canonical' : 'Canonical Roadmap'),
        data.detail !== 'world' ? React.createElement('small', null, item.kind) : null,
        React.createElement('strong', null, item.title),
        React.createElement('span', { className: 'dope-roadmap-status' },
            React.createElement('span', { className: 'dope-roadmap-status-mark', 'aria-hidden': true }, roadmapStatusMark[item.status]),
            item.statusLabel),
        item.phaseAssociation?.unresolvedReason ? React.createElement('small', {
            className: 'dope-roadmap-association-warning' }, `Parent unresolved: ${item.phaseAssociation.unresolvedReason}`) : null,
        data.detail === 'checkpoint' && item.evidence.length ? React.createElement('small', null,
            `${item.evidence.length} source citation${item.evidence.length === 1 ? '' : 's'}`) : null,
        data.omitted > 0 ? React.createElement('span', { className: 'dope-roadmap-omitted' },
            `${data.omitted} prompt${data.omitted === 1 ? '' : 's'} hidden; expand or select stack for Next prompts`) : null),
        React.createElement(Handle, { id: 'right', type: 'source', position: Position.Right, isConnectable: false }),
        React.createElement(Handle, { id: 'top', type: 'source', position: Position.Top, isConnectable: false }),
        React.createElement(Handle, { id: 'bottom', type: 'source', position: Position.Bottom, isConnectable: false }));
}
const roadmapNodeTypes = { checkpoint: RoadmapNode };

function RoadmapBranchEdge(props: EdgeProps): React.ReactElement {
    return React.createElement(BaseEdge, { id: props.id,
        path: roadmapBranchPath(props.sourceX, props.sourceY, props.targetX, props.targetY,
            props.sourceY > props.targetY), markerEnd: props.markerEnd, style: props.style });
}
const roadmapEdgeTypes = { branchRoute: RoadmapBranchEdge };

export const ROADMAP_CANVAS_ID = 'dope-roadmap-canvas';

/** A single ordinary center tab; it neither owns nor opens a ChatPanel. */
export class RoadmapCanvasWidget extends BaseWidget {
    private readonly status = document.createElement('p');
    private readonly strategicBar = document.createElement('section');
    private strategic?: { uri: string; projectId: string; chatId: string; stage?: Extract<ChatEvent, { kind: 'planning-progress' }>['stage'];
        review?: ChatStrategicDraftReview; error?: string; busy?: boolean; decide: (approve: boolean) => Promise<void> };
    private strategicFitToken?: string;
    private readonly path = document.createElement('div');
    private root?: Root;
    private flow?: ReactFlowInstance;
    private taskStacks: RoadmapTaskStack[] = [];
    private taskDiscoveryError?: string;
    private readonly toolbar = document.createElement('header');
    private readonly stage = document.createElement('div');
    private readonly stageResize = new ResizeObserver(() => {
        this.applyInitialCamera();
        this.restoreVisibleCameraOnResize();
        if (this.stage.clientWidth < 1240 && this.sourceOpen && this.inspectionOpen &&
            this.sourceView === 'expanded' && this.inspectionView === 'expanded') this.setSourceOpen(false);
    });
    private readonly sourceButton = document.createElement('button');
    private readonly sourceLabel = document.createElement('span');
    private readonly poolButton = document.createElement('button');
    private readonly pools = document.createElement('section');
    private readonly importEntry = document.createElement('section');
    private readonly inspection = document.createElement('section');
    private readonly inspectionEditor: RoadmapInspectorWidget;
    private readonly draftInspection = document.createElement('section');
    private readonly inspectionSummary = document.createElement('strong');
    private readonly relationshipSummary = document.createElement('p');
    private readonly implementation = document.createElement('section');
    private readonly implementationText = document.createElement('p');
    private readonly implementationToggle = document.createElement('button');
    private readonly implementationNext = document.createElement('button');
    private readonly implementationWork = document.createElement('button');
    private readonly inspectionExpand = document.createElement('button');
    private readonly inspectionCompact = document.createElement('button');
    private readonly inspectionMinimize = document.createElement('button');
    private readonly inspectionClose = document.createElement('button');
    private inspectionView: 'expanded' | 'compact' | 'minimized' = 'compact';
    private inspectionOpen = false;
    private inspectionReturnFocus?: HTMLElement;
    private inspectionFocus?: HTMLElement;
    private readonly sourceHeader = document.createElement('div');
    private readonly sourceSummary = document.createElement('strong');
    private readonly sourceExpand = document.createElement('button');
    private readonly sourceCompact = document.createElement('button');
    private readonly sourceMinimize = document.createElement('button');
    private readonly sourceClose = document.createElement('button');
    private sourceView: 'expanded' | 'compact' | 'minimized' = 'compact';
    private sourceFocus?: HTMLElement;
    private sourceError?: string;
    private syncApplying = false;
    private syncChecking = false;
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
    private readonly phaseButton = document.createElement('button');
    private readonly phaseFocus = document.createElement('section');
    private readonly phaseHeading = document.createElement('strong');
    private readonly phaseContent = document.createElement('div');
    private readonly phaseFeedback = document.createElement('p');
    private readonly phaseExpand = document.createElement('button');
    private readonly phaseCompact = document.createElement('button');
    private readonly phaseMinimize = document.createElement('button');
    private readonly phaseClose = document.createElement('button');
    private phaseOpen = false;
    private phaseView: 'compact' | 'expanded' | 'minimized' = 'compact';
    private phaseId?: string;
    private phaseEvidence?: PhaseFocusEvidence;
    private phaseEvidenceRequest = 0;
    private phaseReturnFocus?: HTMLElement;
    private readonly detailLabel = document.createElement('span');
    private detail: RoadmapDetail = 'phase';
    private arranging = false;
    private viewport?: RoadmapViewportState['viewport'];
    private displayedViewport?: RoadmapViewportState['viewport'];
    private initialCameraPending = false;
    private automaticCamera?: RoadmapViewportState['viewport'];
    private cameraGeneration = 0;
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
    private replacementSerial = 0;
    private syncPreview?: RoadmapSyncPreview;
    private gateSyncPreview?: GateDocumentSyncPreview;
    private gateRelink?: { path: string; preview?: GateDocumentRelinkPreview; busy: boolean; error?: string };
    private recovery?: { uri: string; preview?: RoadmapPendingRecoveryPreview; error?: string; busy: boolean };
    private relink?: { uri: string; path: string; preview?: RoadmapRelinkPreview; error?: string; busy: boolean };
    private replacement?: RoadmapReplacementState;
    private importState?: { uri: string; projectId: string; revision: number; discovery: RoadmapCandidateDiscovery;
        preview?: RoadmapImportPreview; path?: string; busy: boolean; showChooser: boolean; message?: string };
    private createState?: { uri: string; projectId: string; handle: string; draft: GreenfieldDraft;
        mode: 'manual' | 'chat' | 'plan'; chatId?: string; path: string; preview?: GreenfieldPreview;
        editPreview?: GreenfieldEditPreview; busy: boolean; error?: string };
    private planSetup?: { uri: string; projectId: string; chatId?: string; busy: boolean; error?: string };
    private createSerial = 0;
    private draftSequence = 0;
    private draftEpoch?: string;
    private proposedDraft?: GreenfieldDraft;
    private reviewedPlan?: { uri: string; projectId: string; handle: string; plan: ImplementationPlanDraft;
        preview?: ImplementationPlanProjectionPreview; busy: boolean; error?: string };
    private createStarting = false;
    private projectUri?: string;
    private projection?: TaskRoadmapProjection;
    private selectedId?: string;
    private selectedEdgeId?: string;
    private sourceOpen = false;
    private poolOpen = false;
    private readonly focusRecheck = (): void => { if (!this.isDisposed && this.projectUri) void this.refresh(); };

    constructor(private readonly service: RoadmapService, private readonly workspaces: WorkspaceService,
        private readonly inspector: RoadmapInspectorModel,
        private readonly openMind: (id?: string, workspace?: string) => Promise<boolean> = async () => false,
        private readonly savedChats: (workspace: string) => { id: string; title: string }[] = () => [],
        private readonly storage?: Pick<StorageService, 'getData' | 'setData'>,
        private readonly openWork: () => Promise<void> = async () => {}) {
        super();
        this.id = ROADMAP_CANVAS_ID;
        this.title.label = this.title.caption = 'Roadmap';
        this.title.iconClass = codicon('milestone');
        this.title.closable = true;
        this.addClass('dope-roadmap-canvas');
        this.inspectionEditor = new RoadmapInspectorWidget(inspector);
        this.toolbar.setAttribute('aria-label', 'Roadmap controls');
        const icon = (button: HTMLButtonElement, label: string, name: string): void => {
            button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
            const glyph = document.createElement('span'); glyph.className = codicon(name); glyph.setAttribute('aria-hidden', 'true');
            button.append(glyph);
        };
        this.reload.type = 'button';
        icon(this.reload, 'Refresh Roadmap', 'refresh');
        this.reload.onclick = () => { void this.refresh(); };
        this.details.type = 'button';
        icon(this.details, 'Show Roadmap details on canvas', 'info');
        this.details.onclick = () => this.openDetails();
        this.details.setAttribute('aria-controls', 'dope-roadmap-inspection-panel');
        this.mind.type = 'button';
        icon(this.mind, 'Browse and edit Project Mind Notes, Ideas, Questions and Decisions', 'book');
        this.mind.setAttribute('aria-label', 'Browse and edit Project Mind Notes, Ideas, Questions and Decisions');
        this.mind.onclick = () => { void this.openMind().catch(error => {
            this.status.textContent = `Project Mind unavailable: ${String(error)}. Retry from the command palette.`;
        }); };
        for (const [button, label, icon, action] of [
            [this.zoomIn, 'Zoom in on Roadmap', 'zoom-in', () => this.intentionalCamera(flow => flow.zoomIn())],
            [this.zoomOut, 'Zoom out on Roadmap', 'zoom-out', () => this.intentionalCamera(flow => flow.zoomOut())],
            [this.fitButton, 'Fit Roadmap', 'screen-full', () => this.intentionalCamera(flow => flow.fitView({ padding: 0.12, maxZoom: 1 }))],
        ] as const) {
            button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
            const glyph = document.createElement('span'); glyph.className = codicon(icon); glyph.setAttribute('aria-hidden', 'true');
            button.append(glyph); button.onclick = action;
        }
        this.arrangeButton.type = 'button';
        icon(this.arrangeButton, 'Arrange Roadmap card positions', 'move');
        this.arrangeButton.title = 'Move Roadmap cards without changing their order or dependencies';
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
            [this.focusButton, 'Focus selected Roadmap card', () => this.focusSelection()],
        ] as const) { icon(button, label, button === this.focusButton ? 'target' : button === this.expandButton ? 'expand-all' : 'collapse-all');
            button.onclick = action; }
        this.detailLabel.className = 'dope-roadmap-detail';
        this.detailLabel.setAttribute('aria-live', 'polite');
        this.nextPromptsButton.type = 'button';
        icon(this.nextPromptsButton, 'Show next implementation prompts for selected checkpoint', 'list-ordered');
        this.nextPromptsButton.onclick = () => this.nextPrompts();
        icon(this.phaseButton, 'Open Phase Focus for selected phase', 'list-ordered');
        this.phaseButton.append(' Open Phase');
        this.phaseButton.setAttribute('aria-controls', 'dope-roadmap-phase-focus');
        this.phaseButton.onclick = () => this.openPhaseFocus();
        icon(this.sourceButton, 'Roadmap Markdown and setup', 'file-text');
        this.sourceButton.append(this.sourceLabel);
        this.sourceLabel.setAttribute('aria-live', 'polite');
        this.sourceButton.setAttribute('aria-controls', 'dope-roadmap-source-panel');
        this.sourceButton.onclick = () => this.setSourceOpen(!this.sourceOpen || this.sourceView === 'minimized');
        icon(this.poolButton, 'Ideas, Issues and unlinked tasks', 'lightbulb');
        this.poolButton.append(' Ideas / Issues');
        this.poolButton.setAttribute('aria-controls', 'dope-roadmap-pool-panel');
        this.poolButton.onclick = () => this.setPoolOpen(!this.poolOpen);
        this.toolbar.append(this.sourceButton, this.details, this.mind, this.zoomIn, this.zoomOut, this.fitButton, this.arrangeButton,
            this.expandButton, this.collapseButton, this.focusButton, this.nextPromptsButton, this.phaseButton, this.detailLabel, this.reload);
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.path.className = 'dope-roadmap-stage';
        this.path.setAttribute('aria-label', 'Roadmap canvas');
        this.path.tabIndex = 0;
        this.path.title = 'Shift+Arrow pans. In Arrange mode, Alt+Arrow moves the selected card.';
        this.path.onkeydown = event => this.onPathKey(event);
        this.pools.className = 'dope-roadmap-pools';
        this.pools.id = 'dope-roadmap-pool-panel';
        this.pools.setAttribute('aria-label', 'Detached Ideas and Issues');
        this.poolFilter.type = 'search';
        this.poolFilter.setAttribute('aria-label', 'Filter Ideas and Issues');
        this.poolFilter.placeholder = 'Filter Ideas and Issues';
        this.poolFilter.oninput = () => { this.poolQuery = this.poolFilter.value; this.renderPools(); };
        this.importEntry.className = 'dope-roadmap-import';
        this.importEntry.id = 'dope-roadmap-source-panel';
        this.importEntry.setAttribute('aria-label', 'Linked Markdown');
        this.importEntry.tabIndex = -1;
        this.importEntry.addEventListener('focusin', event => {
            const target = event.target;
            if (target instanceof HTMLElement && !this.sourceHeader.contains(target)) this.sourceFocus = target;
        });
        this.importEntry.onkeydown = event => { if (event.key === 'Escape') { event.stopPropagation(); this.setSourceOpen(false); this.sourceButton.focus(); } };
        this.inspection.className = 'dope-roadmap-inspection';
        this.inspection.id = 'dope-roadmap-inspection-panel';
        this.inspection.setAttribute('aria-label', 'Roadmap checkpoint details');
        this.inspection.tabIndex = -1;
        this.inspection.onkeydown = event => { if (event.key === 'Escape') { event.stopPropagation(); this.setInspectionOpen(false); } };
        this.inspection.addEventListener('focusin', event => {
            const target = event.target;
            if (target instanceof HTMLElement && this.inspectionEditor.node.contains(target)) this.inspectionFocus = target;
        });
        const inspectionHeader = document.createElement('div');
        inspectionHeader.className = 'dope-roadmap-inspection-header';
        this.inspectionSummary.textContent = 'Checkpoint details';
        this.inspectionSummary.setAttribute('aria-live', 'polite');
        for (const [button, label, action] of [
            [this.inspectionExpand, 'Expand Roadmap details', () => this.setInspectionView('expanded')],
            [this.inspectionCompact, 'Compact Roadmap details', () => this.setInspectionView('compact')],
            [this.inspectionMinimize, 'Minimize Roadmap details', () => this.setInspectionView('minimized')],
            [this.inspectionClose, 'Close Roadmap details', () => this.setInspectionOpen(false)],
        ] as const) { button.type = 'button'; button.textContent = label.slice(0, label.indexOf(' '));
            button.setAttribute('aria-label', label); button.onclick = action; }
        inspectionHeader.append(this.inspectionSummary, this.inspectionExpand, this.inspectionCompact,
            this.inspectionMinimize, this.inspectionClose);
        this.implementation.className = 'dope-roadmap-implementation';
        this.implementation.setAttribute('aria-label', 'Implementation sources');
        this.implementationToggle.type = this.implementationNext.type = 'button';
        this.implementationWork.type = 'button';
        this.implementationWork.textContent = 'Open Prompt Stacks in Work';
        this.implementationWork.onclick = () => {
            if (this.projectUri && this.inspector.index?.projectId === this.projectId &&
                !this.taskDiscoveryError) void this.openWork();
        };
        this.implementationToggle.onclick = () => this.setExpansion(!this.expanded.has(this.selectedId ?? ''));
        this.implementationNext.textContent = 'Next prompts';
        this.implementationNext.onclick = () => this.nextPrompts();
        this.implementation.append(this.implementationText, this.implementationToggle,
            this.implementationNext, this.implementationWork);
        this.relationshipSummary.className = 'dope-roadmap-relationship-summary';
        this.relationshipSummary.setAttribute('aria-live', 'polite');
        this.relationshipSummary.hidden = true;
        this.draftInspection.hidden = true;
        this.inspection.append(inspectionHeader, this.relationshipSummary, this.implementation,
            this.draftInspection, this.inspectionEditor.node);
        this.setInspectionView('compact');
        this.phaseFocus.id = 'dope-roadmap-phase-focus';
        this.phaseFocus.className = 'dope-roadmap-phase-focus';
        this.phaseFocus.setAttribute('aria-label', 'Phase Focus');
        this.phaseFocus.tabIndex = -1;
        this.phaseFocus.onkeydown = event => {
            if (event.key === 'Escape') { event.stopPropagation(); this.setPhaseOpen(false); }
        };
        const phaseHeader = document.createElement('div');
        phaseHeader.className = 'dope-roadmap-phase-header';
        for (const [button, label, action] of [
            [this.phaseExpand, 'Expand Phase Focus', () => this.setPhaseView('expanded')],
            [this.phaseCompact, 'Compact Phase Focus', () => this.setPhaseView('compact')],
            [this.phaseMinimize, 'Minimize Phase Focus', () => this.setPhaseView('minimized')],
            [this.phaseClose, 'Close Phase Focus', () => this.setPhaseOpen(false)],
        ] as const) { button.type = 'button'; button.textContent = label.split(' ')[0];
            button.setAttribute('aria-label', label); button.onclick = action; }
        phaseHeader.append(this.phaseHeading, this.phaseExpand, this.phaseCompact, this.phaseMinimize, this.phaseClose);
        this.phaseFeedback.setAttribute('role', 'status');
        this.phaseFeedback.setAttribute('aria-live', 'polite');
        this.phaseFocus.append(phaseHeader, this.phaseFeedback, this.phaseContent);
        this.setPhaseView('compact');
        this.sourceHeader.className = 'dope-roadmap-source-header';
        this.sourceSummary.textContent = 'Linked Markdown';
        for (const [button, label, action] of [
            [this.sourceExpand, 'Expand Linked Markdown', () => this.setSourceView('expanded')],
            [this.sourceCompact, 'Compact Linked Markdown', () => this.setSourceView('compact')],
            [this.sourceMinimize, 'Minimize Linked Markdown', () => this.setSourceView('minimized')],
            [this.sourceClose, 'Close Linked Markdown', () => this.setSourceOpen(false)],
        ] as const) { button.type = 'button'; button.textContent = label.replace(' Linked Markdown', '');
            button.setAttribute('aria-label', label); button.onclick = action; }
        this.sourceHeader.append(this.sourceSummary, this.sourceExpand, this.sourceCompact, this.sourceMinimize, this.sourceClose);
        this.setSourceView('compact');
        this.pools.onkeydown = event => { if (event.key === 'Escape') { event.stopPropagation(); this.setPoolOpen(false); this.poolButton.focus(); } };
        this.stage.className = 'dope-roadmap-stage-host dope-map-stage';
        this.strategicBar.className = 'dope-roadmap-strategic-review';
        this.strategicBar.setAttribute('aria-label', 'Strategic Roadmap review');
        this.strategicBar.setAttribute('aria-live', 'polite');
        this.strategicBar.hidden = true;
        this.stage.append(this.path, this.status, this.strategicBar, this.importEntry, this.inspection, this.phaseFocus, this.poolButton, this.pools);
        this.node.append(this.toolbar, this.stage);
        this.stageResize.observe(this.stage);
        this.setSourceOpen(false);
        this.setInspectionOpen(false);
        this.setPhaseOpen(false);
        this.setPoolOpen(false);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.refresh(); });
        window.addEventListener('focus', this.focusRecheck);
        this.modelListener = inspector.onChange(() => {
            this.phaseFeedback.textContent = inspector.error ? `Prompt source unavailable: ${inspector.error}` : '';
            this.phaseFeedback.setAttribute('role', inspector.error ? 'alert' : 'status');
            if (!this.projectUri || inspector.projectUri !== this.projectUri || !inspector.index) return;
            const nextSelection = inspector.selectedPrompt?.id ?? inspector.selectedId;
            const graphChanged = this.selectedId !== nextSelection || this.projection?.revision !== inspector.index.revision;
            this.selectedId = nextSelection;
            this.inspectionSummary.textContent = `${inspector.selectedPrompt?.title ?? inspector.selectedGate?.title ?? inspector.selected?.title ?? 'Roadmap details'}${inspector.requiresApproval ? ' · Approval pending' : inspector.dirty ? ' · Unsaved draft' : ''}`;
            this.details.dataset.review = String(inspector.requiresApproval || inspector.dirty);
            this.details.setAttribute('aria-label', inspector.requiresApproval ? 'Show Roadmap details: approval pending' :
                inspector.dirty ? 'Show Roadmap details: unsaved draft' : 'Show Roadmap details on canvas');
            if (graphChanged) {
                this.schedulePresentation();
                this.projection = this.projectIndex(inspector.index);
                this.render();
            }
        });
        void this.refresh();
    }

    async refresh(): Promise<void> {
        const request = ++this.request;
        ++this.phaseEvidenceRequest;
        this.phaseEvidence = undefined;
        this.proposedDraft = undefined;
        this.draftSequence = 0;
        this.draftEpoch = undefined;
        const priorProjectUri = this.projectUri;
        const selectedTaskId = this.projection?.nodes.find(node => node.id === this.selectedId && node.taskSource)?.id;
        try { await this.service.observeLinkedDocument(undefined); }
        catch (error) { this.status.textContent = `Roadmap observation unavailable: ${String(error)}. Use Refresh to retry.`; return; }
        if (this.isDisposed || request !== this.request) return;
        ++this.importSerial;
        ++this.replacementSerial;
        this.replacement = undefined;
        const oldDraft = this.createState;
        if (oldDraft && oldDraft.uri !== this.projectUri) this.createState = undefined;
        this.importState = undefined;
        this.syncPreview = undefined;
        this.gateSyncPreview = undefined;
        this.gateRelink = undefined;
        this.syncChecking = !!this.inspector.index?.linkedDocument;
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
                this.setSourceOpen(false);
                this.setPoolOpen(false);
                this.setPhaseOpen(false);
                this.renderImportEntry();
                return;
            }
            const projectUri = roots[0].resource.toString();
            const [index, owners, taskResult, plans] = await Promise.all([this.service.read(projectUri), this.service.owners(projectUri),
                this.service.discoverTasks(projectUri).then(tasks => ({ tasks, error: undefined as string | undefined }),
                    error => ({ tasks: [] as RoadmapTaskStack[], error: String(error) })),
                this.service.listImplementationPlans(projectUri)]);
            if (this.isDisposed || request !== this.request) return;
            const switched = this.projectUri !== projectUri || this.projectId !== index.projectId;
            if (switched) {
                if (this.strategic && (this.strategic.uri !== projectUri || this.strategic.projectId !== index.projectId))
                    this.strategic = undefined;
                this.selectedEdgeId = undefined;
                this.relationshipSummary.hidden = true;
                this.setSourceOpen(false);
                this.setPoolOpen(false);
                this.setPhaseOpen(false);
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
                this.displayedViewport = state.viewport;
                this.initialCameraPending = !state.viewport;
                this.automaticCamera = undefined;
                ++this.cameraGeneration;
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
            if (this.planSetup && (this.planSetup.uri !== projectUri || this.planSetup.projectId !== index.projectId))
                this.planSetup = undefined;
            const reviewed = plans[0];
            if (reviewed && this.planSetup?.uri === projectUri) this.planSetup = undefined;
            if (!reviewed || this.reviewedPlan?.uri !== projectUri || this.reviewedPlan.handle !== reviewed.handle ||
                this.reviewedPlan.plan.revision !== reviewed.plan.revision || index.revision !== 0)
                this.reviewedPlan = reviewed ? { uri: projectUri, projectId: index.projectId,
                    handle: reviewed.handle, plan: reviewed.plan, busy: false } : undefined;
            if (switched) this.sourceError = undefined;
            if (this.relink && (this.relink.uri !== projectUri || this.relink.preview?.revision !== index.revision))
                this.relink = undefined;
            if (this.createState && (this.createState.uri !== projectUri || this.createState.projectId !== index.projectId || index.revision !== 0)) {
                this.createState = undefined; this.proposedDraft = undefined; this.draftSequence = 0; ++this.createSerial;
            }
            // A new RPC connection must reattach the persisted handle before readDraft can use it.
            const restored = index.revision === 0 ? await this.service.recoverDrafts(projectUri) : [];
            if (this.isDisposed || request !== this.request) return;
            if (this.createState && !restored.some(item => item.handle === this.createState?.handle)) {
                this.createState = undefined; this.proposedDraft = undefined; ++this.createSerial;
            }
            if (this.createState) {
                const draft = await this.service.readDraft(this.createState.handle);
                if (this.isDisposed || request !== this.request) return;
                if (draft.revision !== this.createState.draft.revision) {
                    this.createState.preview = undefined; this.proposedDraft = undefined;
                }
                this.createState.draft = draft;
            } else if (index.revision === 0) {
                const chosen = restored[0];
                if (chosen) this.createState = { uri: projectUri, projectId: index.projectId, handle: chosen.handle,
                    draft: chosen.draft, mode: chosen.plan ? 'plan' : chosen.chatId ? 'chat' : 'manual', chatId: chosen.chatId,
                    path: 'ROADMAP.md', busy: false };
            }
            const restoredId = switched ? this.selectedId : undefined;
            this.inspector.setSnapshot(projectUri, index);
            if (switched && restoredId) {
                if (index.checkpoints?.some(item => item.id === restoredId) ||
                    (index as unknown as RoadmapGateIndex).phases?.some(item => item.id === restoredId) ||
                    (index as unknown as RoadmapGateIndex).gates?.some(item => item.id === restoredId)) this.inspector.select(restoredId);
                else this.selectedId = restoredId; // Prompt nodes are presentation-only and absent from the inspector index.
            }
            if (index.revision === 0) this.status.textContent = 'No Roadmap yet. Import one, create manually, or plan with an existing Chat.';
            if (priorProjectUri === projectUri && selectedTaskId &&
                this.projectIndex(index, tasks, owners).nodes.some(node => node.id === selectedTaskId)) this.selectedId = selectedTaskId;
            this.projection = this.projectIndex(index, tasks, owners);
            if (switched && this.selectedId) {
                const restoredTask = this.projection.nodes.find(node => node.id === this.selectedId && node.taskSource);
                if (restoredTask) this.inspector.selectTask(restoredTask);
            }
            this.render();
            if (this.phaseOpen) void this.refreshPhaseEvidence();
            if (switched && this.viewport && this.flow) void this.flow.setViewport(this.viewport);
            this.queueInitialCamera();
            if (index.linkedDocument) {
                try {
                    const gateSchema = (index as unknown as RoadmapGateIndex).schemaVersion === 2;
                    const sync = gateSchema ? await this.service.previewGateDocumentSync(projectUri) :
                        await this.service.previewDocumentSync(projectUri);
                    if (this.isDisposed || request !== this.request || this.projectUri !== projectUri) return;
                    if (sync.revision !== index.revision) {
                        const recovered = await this.service.read(projectUri);
                        if (this.isDisposed || request !== this.request || this.projectUri !== projectUri) return;
                        this.inspector.setSnapshot(projectUri, recovered);
                        this.projection = this.projectIndex(recovered, tasks, owners);
                        this.render();
                    }
                    if (gateSchema) { this.gateSyncPreview = sync as GateDocumentSyncPreview; this.syncPreview = undefined; }
                    else { this.syncPreview = sync as RoadmapSyncPreview; this.gateSyncPreview = undefined; }
                    this.syncChecking = false;
                    this.sourceError = undefined;
                    this.renderImportEntry();
                    this.render();
                    await this.service.observeLinkedDocument(projectUri);
                } catch (error) {
                    if (this.isDisposed || request !== this.request || this.projectUri !== projectUri) return;
                    this.sourceError = `Linked Markdown compare failed: ${String(error)}. Review the file and Refresh.`;
                    this.syncChecking = false;
                    this.status.textContent = this.sourceError;
                    this.renderImportEntry();
                }
            } else { this.syncChecking = false; this.sourceError = undefined;
                this.syncPreview = undefined; this.gateSyncPreview = undefined; this.renderImportEntry(); }
        } catch (error) {
            if (this.isDisposed || request !== this.request) return;
            this.status.textContent = `Roadmap unavailable: ${error instanceof Error ? error.message : 'Unable to read Roadmap'}. Use Refresh to retry.`;
            this.inspector.setSnapshot(undefined, undefined);
        }
    }

    /** Review navigation only. Never accepts or publishes a draft. */
    async revealAcceptedChatDraft(projectUri: string, projectId: string, chatId: string,
        revision: number): Promise<void> {
        await this.refresh();
        this.clearStrategicReview(projectUri, chatId);
        const state = this.createState;
        if (this.projectUri !== projectUri || this.projectId !== projectId ||
            state?.uri !== projectUri || state.projectId !== projectId || state.mode !== 'chat' ||
            state.chatId !== chatId || state.draft.revision !== revision || !this.projection?.nodes.length)
            throw new Error('Accepted Roadmap draft changed or is unavailable in this project');
        this.selectedId = this.projection.nodes.find(node => node.draftState === 'accepted')?.id;
        this.render();
        requestAnimationFrame(() => {
            if (this.projectUri === projectUri && this.projectId === projectId &&
                this.createState?.draft.revision === revision && this.flow)
                void this.flow.fitView({ padding: 0.12, maxZoom: 1 });
        });
    }

    /** Browser presentation of the backend's validated, unaccepted preview. */
    async presentStrategicReview(uri: string, projectId: string, chatId: string,
        state: { stage?: Extract<ChatEvent, { kind: 'planning-progress' }>['stage'];
            review?: ChatStrategicDraftReview; error?: string; clear?: boolean; busy?: boolean },
        decide: (approve: boolean) => Promise<void>): Promise<void> {
        if (state.clear) { this.clearStrategicReview(uri, chatId); return; }
        if (this.projectUri !== uri || this.projectId !== projectId || !this.inspector.index)
            await this.refresh();
        if (this.projectUri !== uri || this.projectId !== projectId || this.inspector.index?.revision !== 0)
            throw new Error('Roadmap project or canonical owner changed before review');
        if (state.review && (state.review.projectId !== projectId || state.review.draft.revision !== state.review.revision))
            throw new Error('Strategic Roadmap preview has a foreign project or revision');
        const fit = !!state.review && this.strategicFitToken !== state.review.token;
        if (fit) this.initialCameraPending = false;
        this.strategic = { uri, projectId, chatId, ...state, decide };
        this.projection = this.projectIndex(this.inspector.index);
        this.render();
        if (fit && state.review) {
            this.strategicFitToken = state.review.token;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (this.strategic?.review?.token === state.review?.token && this.flow)
                    void this.flow.fitView({ padding: 0.12, maxZoom: 1 });
            }));
        }
    }

    clearStrategicReview(uri: string, chatId: string): void {
        if (this.strategic?.uri !== uri || this.strategic.chatId !== chatId) return;
        this.strategic = undefined;
        this.strategicFitToken = undefined;
        this.strategicBar.hidden = true;
        if (this.inspector.index) {
            this.projection = this.projectIndex(this.inspector.index);
            if (this.selectedId && !this.projection.nodes.some(node => node.id === this.selectedId))
                this.selectedId = undefined;
            this.render();
        }
    }

    linkedSourceChanged(root: string, projectId: string): void {
        if (this.inspector.index?.projectRoot === root && this.inspector.index.projectId === projectId)
            void this.refresh();
    }

    private withDraft(base: TaskRoadmapProjection): TaskRoadmapProjection {
        if (base.revision !== 0) return base;
        if (this.strategic?.projectId === base.projectId && this.strategic.review)
            return projectRoadmapDraft(base, undefined, this.strategic.review.draft);
        if (this.createState?.projectId === base.projectId)
            return projectRoadmapDraft(base, this.createState.draft, this.proposedDraft);
        return this.reviewedPlan?.projectId === base.projectId && this.reviewedPlan.preview ?
            projectRoadmapDraft(base, undefined, this.reviewedPlan.preview.draft) : base;
    }

    private projectIndex(index: RoadmapIndex, tasks = this.taskStacks, owners = this.owners): TaskRoadmapProjection {
        if ((index as unknown as RoadmapGateIndex).schemaVersion === 2) {
            const phases = gatePhaseCards(index as unknown as RoadmapGateIndex, owners);
            const accepted = this.createState?.projectId === phases.projectId ? this.createState.draft : undefined;
            const proposed = this.strategic?.projectId === phases.projectId ? this.strategic.review?.draft :
                this.proposedDraft ?? (this.reviewedPlan?.projectId === phases.projectId ? this.reviewedPlan.preview?.draft : undefined);
            const visible = projectGateDraftCards(phases, accepted, proposed);
            return { ...visible, unlinkedTasks: phases.unassignedCorrections.map(item => ({
                path: item.id, title: item.title, reason: 'Correction parent is missing or conflicted.' })),
                omittedTaskNodes: 0 };
        }
        return this.withDraft(projectRoadmapTasks(index, tasks, owners,
            { projectId: index.projectId, selectedId: this.selectedId }));
    }

    /** Reject foreign, stale and repeated notifications before touching presentation state. */
    draftChanged(change: GreenfieldChange): void {
        if (change.kind === 'plan' && this.inspector.index?.projectRoot === change.root &&
            this.inspector.index.projectId === change.projectId) { void this.refresh(); return; }
        const state = this.createState;
        if (this.isDisposed || !state || !this.inspector.index || this.inspector.index.revision !== 0 ||
            change.root !== this.inspector.index.projectRoot || change.projectId !== state.projectId ||
            change.handle !== state.handle) return;
        if (this.draftEpoch && this.draftEpoch !== change.epoch) { void this.refresh(); return; }
        if (!currentDraftChange(change, { root: this.inspector.index.projectRoot,
            projectId: state.projectId, handle: state.handle, revision: state.draft.revision,
            sequence: this.draftSequence })) return;
        this.draftSequence = change.sequence;
        this.draftEpoch = change.epoch;
        if (change.kind === 'cancelled') { this.createState = undefined; this.proposedDraft = undefined; }
        else if (change.kind === 'accepted') { state.draft = change.draft!; state.preview = undefined; this.proposedDraft = undefined; }
        else this.proposedDraft = change.kind === 'proposed' ? change.draft : undefined;
        if (this.inspector.index) this.projection = this.projectIndex(this.inspector.index);
        this.render();
    }

    private setSourceOpen(open: boolean): void {
        this.sourceOpen = open;
        this.importEntry.hidden = !open;
        this.sourceButton.setAttribute('aria-expanded', String(open));
        if (open) {
            if (this.stage.clientWidth < 1240 && this.inspectionOpen && this.inspectionView === 'expanded')
                this.setInspectionOpen(false);
            this.setPoolOpen(false);
            if (this.sourceView === 'minimized') this.setSourceView('compact');
            if (this.sourceFocus?.isConnected && this.importEntry.contains(this.sourceFocus)) this.sourceFocus.focus();
            else this.importEntry.focus();
        } else if (this.importEntry.contains(document.activeElement)) {
            this.sourceButton.focus();
        }
    }

    private setSourceView(view: 'expanded' | 'compact' | 'minimized'): void {
        if (view === 'expanded' && this.stage.clientWidth < 1240 && this.inspectionOpen)
            this.setInspectionOpen(false);
        if (view === 'minimized' && this.importEntry.contains(document.activeElement)) {
            this.sourceButton.focus();
        }
        this.sourceView = view;
        this.importEntry.dataset.state = view;
        this.sourceExpand.hidden = view === 'expanded';
        this.sourceCompact.hidden = view !== 'expanded';
        this.sourceMinimize.hidden = view === 'minimized';
        if (view !== 'minimized' && this.sourceOpen) {
            if (this.sourceFocus?.isConnected && this.importEntry.contains(this.sourceFocus)) this.sourceFocus.focus();
            else this.importEntry.focus();
        }
    }

    /** Presentation only: the editor stays mounted and the model retains drafts and pending previews. */
    openDetails(): void {
        this.setInspectionOpen(true, true);
    }

    private setInspectionOpen(open: boolean, focus = false): void {
        const hadFocus = this.inspection.contains(document.activeElement);
        if (open && !this.inspectionOpen) {
            const active = document.activeElement;
            this.inspectionReturnFocus = active instanceof HTMLElement && !this.inspection.contains(active) ? active : this.path;
        }
        this.inspectionOpen = open;
        this.inspection.hidden = !open;
        this.details.setAttribute('aria-expanded', String(open));
        if (open) {
            if (this.inspectionView === 'minimized') this.setInspectionView('compact');
            if (this.stage.clientWidth < 1240 && this.sourceOpen && this.sourceView === 'expanded')
                this.setSourceOpen(false);
            if (focus) {
                if (this.inspectionFocus?.isConnected && this.inspectionEditor.node.contains(this.inspectionFocus)) this.inspectionFocus.focus();
                else this.inspection.focus();
            }
        } else if (hadFocus) {
            const target = this.inspectionReturnFocus;
            if (target?.isConnected && !this.inspection.contains(target)) target.focus();
            else this.path.focus();
        }
    }

    private setInspectionView(view: 'expanded' | 'compact' | 'minimized'): void {
        if (view === 'expanded' && this.stage.clientWidth < 1240 && this.sourceOpen)
            this.setSourceOpen(false);
        const focused = this.inspection.contains(document.activeElement);
        const focusedEditor = this.inspectionEditor.node.contains(document.activeElement);
        this.inspectionView = view;
        this.inspection.dataset.state = view;
        this.inspectionExpand.hidden = view === 'expanded';
        this.inspectionCompact.hidden = view !== 'expanded';
        this.inspectionMinimize.hidden = view === 'minimized';
        if (focused && view === 'expanded') {
            const editorFocus = this.inspectionFocus?.isConnected ? this.inspectionFocus :
                this.inspectionEditor.node.querySelector<HTMLElement>('input:not(:disabled), textarea:not(:disabled), button');
            editorFocus?.focus();
        } else if (focused && (view === 'minimized' || focusedEditor ||
            document.activeElement === this.inspectionCompact)) this.inspectionExpand.focus();
    }

    private setPoolOpen(open: boolean): void {
        this.poolOpen = open;
        this.pools.hidden = !open;
        this.poolButton.setAttribute('aria-expanded', String(open));
        if (open) {
            this.setSourceOpen(false);
            this.poolFilter.focus();
        } else if (this.pools.contains(document.activeElement)) this.poolButton.focus();
    }

    private openPhaseFocus(): void {
        if (this.inspector.gateIndex) return;
        const selected = this.projection?.nodes.find(node => node.id === this.selectedId);
        if (selected?.kind !== 'phase' || selected.draftState || !this.inspector.index) {
            this.status.textContent = 'Select a canonical phase checkpoint, then choose Open Phase.';
            return;
        }
        this.phaseId = selected.id;
        this.setPhaseOpen(true);
        this.renderPhaseFocus();
        void this.refreshPhaseEvidence();
        this.phaseFocus.focus();
    }

    phaseEvidenceChanged(root: string): void {
        if (this.phaseOpen && this.inspector.index?.projectRoot === root) void this.refreshPhaseEvidence();
    }

    private async refreshPhaseEvidence(): Promise<void> {
        const index = this.inspector.index;
        const uri = this.projectUri;
        const serial = ++this.phaseEvidenceRequest;
        this.phaseEvidence = undefined;
        this.phaseFeedback.textContent = '';
        this.phaseFeedback.removeAttribute('role');
        if (!this.phaseOpen || !index || !uri || !this.phaseId || index.projectId !== this.projectId) return;
        const phaseId = this.phaseId;
        this.renderPhaseFocus();
        try {
            const evidence = await this.service.phaseFocusEvidence(uri, index.projectId, phaseId);
            if (this.isDisposed || serial !== this.phaseEvidenceRequest || !this.phaseOpen ||
                this.projectUri !== uri || this.projectId !== evidence.projectId || this.phaseId !== phaseId ||
                this.inspector.index?.revision !== index.revision) return;
            this.phaseEvidence = evidence;
            this.renderPhaseFocus();
        } catch (error) {
            if (this.isDisposed || serial !== this.phaseEvidenceRequest || this.projectUri !== uri) return;
            this.phaseFeedback.textContent = `Phase evidence unavailable: ${String(error)}. Refresh Roadmap to retry.`;
            this.phaseFeedback.setAttribute('role', 'alert');
        }
    }

    private setPhaseOpen(open: boolean): void {
        const hadFocus = this.phaseFocus.contains(document.activeElement);
        if (open && !this.phaseOpen) {
            const active = document.activeElement;
            this.phaseReturnFocus = active instanceof HTMLElement ? active : this.phaseButton;
        }
        this.phaseOpen = open;
        if (!open) { ++this.phaseEvidenceRequest; this.phaseEvidence = undefined; }
        this.phaseFocus.hidden = !open;
        this.phaseButton.setAttribute('aria-expanded', String(open));
        if (!open && hadFocus) (this.phaseReturnFocus?.isConnected ? this.phaseReturnFocus : this.phaseButton).focus();
        if (open && this.phaseView === 'minimized') this.setPhaseView('compact');
    }

    private setPhaseView(view: 'compact' | 'expanded' | 'minimized'): void {
        const contentFocused = this.phaseContent.contains(document.activeElement);
        this.phaseView = view;
        this.phaseFocus.dataset.state = view;
        this.phaseExpand.hidden = view === 'expanded';
        this.phaseCompact.hidden = view !== 'expanded';
        this.phaseMinimize.hidden = view === 'minimized';
        if (contentFocused && view === 'minimized') this.phaseExpand.focus();
    }

    private renderPhaseFocus(): void {
        if (!this.phaseOpen) return;
        const index = this.inspector.index;
        if ((index as unknown as RoadmapGateIndex | undefined)?.schemaVersion === 2) {
            this.setPhaseOpen(false); // The schema-two Gate inspector is completed in P13.
            return;
        }
        const evidence = this.phaseEvidence?.projectId === index?.projectId ? this.phaseEvidence : undefined;
        const phase = index && this.phaseId && selectPhaseFocus(index, this.taskStacks, this.phaseId,
            evidence?.checkpoints, evidence?.qualifications, evidence?.failedPromptEvidence, evidence?.blocked);
        if (!phase || phase.projectId !== this.projectId) {
            this.setPhaseOpen(false);
            return;
        }
        this.phaseHeading.textContent = `${phase.phaseTitle} · ${phase.qualification.replaceAll('-', ' ')}`;
        this.phaseContent.replaceChildren();
        const note = document.createElement('p');
        note.textContent = 'Authored order is fixed. Source inspection does not run Work. Implementation and qualification require separately verified evidence.';
        this.phaseContent.append(note);
        if (phase.stacks.length && !this.taskDiscoveryError) {
            const work = document.createElement('button');
            work.type = 'button'; work.textContent = 'Open Prompt Stacks in Work';
            work.onclick = () => {
                if (this.projectUri && this.inspector.index?.projectId === phase.projectId &&
                    this.projectId === phase.projectId) void this.openWork();
            };
            this.phaseContent.append(work);
        }
        if (!phase.stacks.length) {
            const empty = document.createElement('p');
            empty.textContent = 'No authored prompt stacks are linked to this phase. Check task discovery or select another phase.';
            this.phaseContent.append(empty);
        }
        for (const stack of phase.stacks) {
            const section = document.createElement('section');
            const heading = document.createElement('h3');
            heading.textContent = `${stack.segment === 'correction' ? 'Correction' : stack.segment === 'continuation' ? 'Continuation' : 'Phase'} · ${stack.path}`;
            section.append(heading);
            if (stack.failedPrompt) {
                const relationship = document.createElement('p');
                relationship.textContent = `Source-backed correction of ${stack.failedPrompt.stackPath}/P${stack.failedPrompt.number}`;
                section.append(relationship);
            } else if (stack.segment === 'correction') {
                const relationship = document.createElement('p');
                relationship.textContent = 'Correction belongs to this phase · exact failed prompt unknown without verified evidence.';
                section.append(relationship);
            }
            const list = document.createElement('ol');
            list.setAttribute('aria-label', `${stack.path} authored prompt order`);
            for (const prompt of stack.prompts) {
                const item = document.createElement('li');
                const button = document.createElement('button');
                button.type = 'button';
                button.textContent = `P${prompt.number} — ${prompt.title}`;
                button.setAttribute('aria-label', `Inspect P${prompt.number} source: ${prompt.title}`);
                button.onclick = () => {
                    if (evidence?.blocked.some(item => item.projectId === index?.projectId &&
                        item.stackPath === stack.path && item.stackFingerprint === stack.fingerprint &&
                        item.entryNumber === prompt.number && item.reason === 'source-drift')) {
                        this.phaseFeedback.textContent = 'Prompt source drift detected. Restore or review the authored source before opening it.';
                        this.phaseFeedback.setAttribute('role', 'alert');
                        return;
                    }
                    const node = this.projection?.nodes.find(candidate => candidate.kind === 'prompt' &&
                        candidate.taskSource?.stackPath === stack.path && candidate.taskSource.number === prompt.number &&
                        candidate.taskSource.fingerprint === prompt.fingerprint);
                    if (!node) { this.status.textContent = 'Prompt projection is unavailable. Refresh Roadmap and retry.'; return; }
                    this.select(node.id);
                    if (this.inspector.selectedPrompt?.id === node.id) void this.inspector.openPrompt(node);
                };
                const detail = document.createElement('small');
                detail.textContent = `${prompt.kind}${prompt.manualGate ? ' · manual gate' : ''} · implementation ${prompt.implementation} · qualification ${prompt.qualification}` +
                    `${prompt.checkpointSha ? ` · checkpoint ${prompt.checkpointSha}` : ''} · ${prompt.path} · SHA-256 ${prompt.fingerprint}`;
                item.append(button, detail); list.append(item);
            }
            section.append(list); this.phaseContent.append(section);
        }
        for (const diagnostic of phase.diagnostics) {
            const warning = document.createElement('p'); warning.textContent = diagnostic;
            this.phaseContent.append(warning);
        }
        for (const diagnostic of evidence?.diagnostics ?? []) {
            const warning = document.createElement('p'); warning.textContent = diagnostic;
            this.phaseContent.append(warning);
        }
        if (this.taskDiscoveryError) {
            const warning = document.createElement('p');
            warning.textContent = `Prompt discovery unavailable: ${this.taskDiscoveryError}. Refresh Roadmap to retry.`;
            this.phaseContent.append(warning);
        }
    }

    private render(): void {
        const projection = this.projection;
        if (!projection) return;
        const nodes = roadmapCanvasOrder(projection);
        if (this.selectedId && !nodes.some(node => node.id === this.selectedId)) {
            this.selectedId = undefined;
            this.schedulePresentation();
        }
        const visible = roadmapVisibleGraph(projection, this.detail, this.selectedId,
            this.expanded, this.collapsed, 96, this.promptWindow);
        this.renderFlow(visible);
        this.renderStrategicBar();
        this.renderDraftInspection();
        this.renderPhaseFocus();
        this.renderImplementationSummary(visible);
        // Checkpoint linking belongs to the retired Roadmap shape. Keep the
        // shared owner records intact, but do not expose its unusable control.
        this.poolButton.hidden = !!this.inspector.gateIndex;
        if (this.inspector.gateIndex) {
            this.poolOpen = false;
            this.pools.hidden = true;
        } else this.renderPools();
        this.renderImportEntry();
        const displayedCount = visible.nodes.length;
        const diagnostic = projection.diagnostics.length ? ` · ${projection.diagnostics.length} unresolved reference(s)` : '';
        this.status.textContent = projection.revision === 0 ?
            this.reviewedPlan?.preview && !this.createState ? 'Proposed plan projection on canvas · Review the graph and accept or reject below. Nothing has been published.' :
            this.strategic?.review ? 'Proposed Roadmap on canvas · Not yet accepted. Accept or reject here. Nothing has been published.' :
            this.proposedDraft ? `Proposed draft on canvas · Review and accept or reject ${this.createState?.mode === 'manual' ? 'in Roadmap' : 'in the selected Chat'}. Nothing has been published.` :
                this.createState ? `Accepted draft revision ${this.createState.draft.revision} on canvas · Review Phase and Gate definitions before accepting Roadmap structure. Markdown publication requires separate approval.` :
                    'No Roadmap yet. Import one, create manually, or plan with an existing Chat.' :
            `${displayedCount} displayed Roadmap cards · Roadmap revision ${projection.revision}${diagnostic}${this.inspector.index?.linkedDocument ? ` · Linked: ${this.inspector.index.linkedDocument.path} (${this.gateSyncPreview?.state ?? this.inspector.index.linkedDocument.syncState})` : ' · Accepted structure; Markdown not published'}${this.reviewedPlan ? ' · Reviewed plan remains noncanonical; bulk projection into this Roadmap is unavailable.' : ''}${this.taskDiscoveryError ? ' · Prompt discovery unavailable; Refresh to retry.' : ''}`;
    }

    private renderStrategicBar(): void {
        const state = this.strategic;
        this.strategicBar.replaceChildren();
        this.strategicBar.hidden = !state;
        if (!state) return;
        this.strategicBar.setAttribute('aria-label', 'Roadmap draft review');
        const heading = document.createElement('strong');
        const terminal = state.error || state.stage === 'failed' || state.stage === 'cancelled';
        const incomplete = !!state.review && state.review.draft.phases.some(phase => !phase.gates?.length);
        heading.textContent = terminal ? state.stage === 'cancelled' ? 'ROADMAP PREPARATION CANCELLED' :
            'ROADMAP PREPARATION FAILED' : state.review ?
            incomplete ? 'INCOMPLETE ROADMAP PROPOSAL · NOT YET ACCEPTED' : 'PROPOSED ROADMAP · NOT YET ACCEPTED' :
            'PREPARING ROADMAP REVIEW';
        const progress = document.createElement('span');
        const labels: Record<string, string> = { 'checking-owner': 'Checking Roadmap',
            'generating-draft': 'Optional model expansion', 'validating-draft': 'Extracting saved plan',
            'preparing-draft': 'Validating preview', 'draft-ready': 'Ready for review',
            cancelled: 'Preparation cancelled. Request a new proposal from Chat.',
            failed: 'Preparation failed. Review Roadmap and request a new proposal from Chat.' };
        progress.setAttribute('role', 'status');
        progress.textContent = state.error ?? (state.review ?
            `${incomplete ? 'Incomplete: Phase Gate-set coverage remains unresolved. ' : ''}` +
            `${state.review.diagnostic ?? 'Inspect the graph, then accept or reject this noncanonical proposal.'}` :
            labels[state.stage ?? ''] ?? 'Checking Roadmap');
        this.strategicBar.append(heading, progress);
        if (state.review) {
            const inspect = document.createElement('button'); inspect.type = 'button'; inspect.textContent = 'Inspect Proposal';
            inspect.onclick = () => {
                const first = state.review?.draft.phases[0];
                if (first) this.select(first.id);
            };
            this.strategicBar.append(inspect);
        }
        if (state.review) for (const [label, approve] of [['Accept Draft', true], ['Reject Draft', false]] as const) {
            const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
            button.disabled = !!state.busy;
            button.onclick = () => void state.decide(approve);
            this.strategicBar.append(button);
        }
        else if (state.stage && !['cancelled', 'failed'].includes(state.stage) && !state.error) {
            const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel generation';
            cancel.onclick = () => void state.decide(false);
            this.strategicBar.append(cancel);
        }
    }

    private renderDraftInspection(): void {
        const draft = this.strategic?.review?.draft ?? this.createState?.draft ?? this.reviewedPlan?.preview?.draft;
        const selected = draft?.phases.find(phase => phase.id === this.selectedId ||
            phase.checkpoints.some(item => item.id === this.selectedId));
        const checkpoint = selected?.checkpoints.find(item => item.id === this.selectedId);
        const item = checkpoint ?? (selected?.id === this.selectedId ? selected : undefined);
        this.draftInspection.hidden = !item;
        this.inspectionEditor.node.hidden = !!item;
        if (!item) {
            this.inspectionSummary.textContent = this.inspector.selectedGate?.title ?? this.inspector.selected?.title ?? 'Roadmap details';
            return;
        }
        this.inspectionSummary.textContent = `${item.title} · ${this.strategic?.review || this.reviewedPlan?.preview ? 'Proposed' : 'Accepted draft'}`;
        const names = new Map(draft!.phases.flatMap(phase => [[phase.id, phase.title] as const,
            ...phase.checkpoints.map(child => [child.id, child.title] as const)]));
        this.draftInspection.replaceChildren();
        const objective = document.createElement('p'); objective.textContent = item.objective || 'No objective supplied.';
        this.draftInspection.append(objective);
        if (checkpoint?.dependencies?.length) {
            const dependencies = document.createElement('p');
            dependencies.textContent = `Depends on: ${checkpoint.dependencies.map(id => names.get(id) ?? id).join(', ')}`;
            this.draftInspection.append(dependencies);
        }
        if (this.strategic?.review) {
            const coverage = document.createElement('p');
            coverage.textContent = this.strategic.review.diagnostic ?? 'Check source requirements before accepting.';
            this.draftInspection.append(coverage);
            if (!selected?.checkpoints.length) {
                const missing = document.createElement('p');
                missing.textContent = 'Incomplete phase: no checkpoints were supplied. Accept only as a noncanonical draft to refine; linked Markdown cannot be published yet.';
                this.draftInspection.append(missing);
            }
        }
        const authority = document.createElement('p'); authority.textContent =
            this.strategic?.review ? 'Proposed strategic Roadmap. Accept or reject in Roadmap; no file has been written.' :
            this.reviewedPlan?.preview ? 'Proposed plan projection. Review and accept or reject in Roadmap.' :
                'Accepted draft. Linked Markdown requires a separate preview and approval.';
        this.draftInspection.append(authority);
    }

    private renderImplementationSummary(visibleGraph?: RoadmapVisibleGraph): void {
        const id = this.selectedId;
        const stacks = id && this.projection ? roadmapImplementationStacks(this.projection, id) : [];
        this.implementation.hidden = !stacks.length;
        if (!stacks.length) return;
        const count = stacks.reduce((total, stack) => total +
            (this.taskStacks.find(source => source.path === stack.path)?.prompts.length ?? stack.promptCount), 0);
        const paths = stacks.slice(0, 3).map(stack => stack.path).join(', ');
        this.implementationText.textContent = `${stacks.length} implementation stack${stacks.length === 1 ? '' : 's'} · ` +
            `${count} discovered prompt${count === 1 ? '' : 's'} · ${paths}${stacks.length > 3 ? `, +${stacks.length - 3} more` : ''}. ` +
            'Source only; prompt discovery does not determine qualification status.';
        this.implementationWork.disabled = !!this.taskDiscoveryError || !this.projectUri ||
            this.inspector.index?.projectId !== this.projectId;
        const expanded = this.expanded.has(id!);
        this.implementationToggle.textContent = expanded ? 'Hide Prompts' : 'View Prompts';
        this.implementationToggle.setAttribute('aria-expanded', String(expanded));
        this.implementationToggle.setAttribute('aria-label', `${expanded ? 'Hide' : 'View'} implementation prompts for ${this.projection?.nodes.find(node => node.id === id)?.title}`);
        const visible = visibleGraph ?? (this.projection && roadmapVisibleGraph(this.projection, this.detail, id,
            this.expanded, this.collapsed, 96, this.promptWindow));
        this.implementationNext.hidden = !expanded || !stacks.some(stack => (visible?.omittedByStack.get(stack.id) ?? 0) > 0);
    }

    private renderFlow(visibleGraph?: RoadmapVisibleGraph): void {
        if (!this.root) return;
        const projection = this.projection;
        const cameraGeneration = this.cameraGeneration;
        const cameraProjectUri = this.projectUri;
        this.detailLabel.textContent = `${this.detail[0].toUpperCase()}${this.detail.slice(1)} detail`;
        const stacks = this.selectedId && projection ? roadmapImplementationStacks(projection, this.selectedId) : [];
        this.expandButton.disabled = this.collapseButton.disabled = !stacks.length;
        this.focusButton.disabled = !projection?.nodes.some(item => item.id === this.selectedId);
        this.phaseButton.hidden = !!this.inspector.gateIndex;
        const visible = visibleGraph ?? (projection ? roadmapVisibleGraph(projection, this.detail, this.selectedId,
            this.expanded, this.collapsed, 96, this.promptWindow) : undefined);
        this.nextPromptsButton.disabled = !this.expanded.has(this.selectedId ?? '') ||
            !stacks.some(stack => (visible?.omittedByStack.get(stack.id) ?? 0) > 0);
        const positions = visible ? roadmapSpatialLayout({ ...projection!, ...visible }) : new Map<string, { x: number; y: number }>();
        const titles = new Map(projection?.nodes.map(item => [item.id, item.title]) ?? []);
        const relations = new Map<string, string[]>();
        for (const edge of visible ? roadmapCanvasConnectors(visible) : [])
            relations.set(edge.to, [...(relations.get(edge.to) ?? []),
                `${edge.label} ${titles.get(edge.from) ?? edge.from}`]);
        const nodes: Node[] = (visible ? roadmapCanvasOrder(visible) : []).map(item => {
            const position = this.placements.get(item.id) ?? positions.get(item.id) ?? { x: 64, y: 64 };
            return {
                id: item.id, type: 'checkpoint', position,
                data: { item, selected: item.id === this.selectedId, selectedGateId: this.selectedId,
                    detail: this.detail,
                    relation: (relations.get(item.id) ?? []).join(', '),
                    omitted: visible?.omittedByStack.get(item.id) ?? 0,
                    select: (id: string) => this.select(id),
                    selectGate: (gateId: string, phaseId: string) => this.selectGate(gateId, phaseId,
                        projection!.projectId, projection!.revision),
                    activate: (id: string) => this.activateCheckpoint(id),
                    reveal: (id: string, element: HTMLButtonElement) => this.revealFocusedCard(id, position, element) },
                selected: item.id === this.selectedId, draggable: this.arranging, selectable: true,
                className: `${item.id === this.selectedId ? 'dope-roadmap-selected ' : ''}${item.draftState ? `dope-roadmap-draft-${item.draftState}` : ''}`,
            };
        });
        const displayed = new Map(nodes.map(node => [node.id, node.position]));
        const statuses = new Map(visible?.nodes.map(node => [node.id, node.status]) ?? []);
        const edges: Edge[] = (visible ? roadmapCanvasConnectors(visible) : []).map(item => {
            const status = roadmapEdgeStatus(statuses.get(item.from), statuses.get(item.to));
            const handles = roadmapEdgeHandles(item, displayed);
            return { id: item.id, source: item.from, target: item.to,
                ...handles,
                type: handles.targetHandle === 'right-target' ? 'branchRoute' : 'smoothstep',
                selectable: true, selected: item.id === this.selectedEdgeId, zIndex: 1,
                ...(item.kind === 'dependency' || item.kind === 'progression' ?
                    { markerEnd: { type: MarkerType.ArrowClosed } } : {}),
                ariaLabel: `${item.label}; ${titles.get(item.from) ?? item.from} to ${titles.get(item.to) ?? item.to}; endpoint status ${status}`,
                className: `dope-roadmap-edge dope-roadmap-edge-${item.kind}${item.kind === 'dependency' ? ` dope-roadmap-edge-${status}` : ''}${projection?.nodes.find(node => node.id === item.to)?.draftState ? ` dope-roadmap-draft-${projection.nodes.find(node => node.id === item.to)?.draftState}` : ''}${roadmapConnectorTouchesSelection(item, this.selectedId) ? ' dope-roadmap-edge-related' : ''}` };
        });
        this.root.render(React.createElement(ReactFlow, {
            id: 'dope-roadmap-flow', nodes, edges, nodeTypes: roadmapNodeTypes, edgeTypes: roadmapEdgeTypes,
            defaultViewport: this.displayedViewport ?? { x: 20, y: 20, zoom: 1 }, minZoom: 0.2, maxZoom: 2,
            ...roadmapGestures(this.arranging), elementsSelectable: true,
            nodesFocusable: false, edgesFocusable: false,
            zoomOnDoubleClick: false, nodeDragThreshold: 5,
            onNodeClick: (_event: React.MouseEvent, node: Node) => this.select(node.id),
            onNodeDoubleClick: (_event: React.MouseEvent, node: Node) => this.activateCheckpoint(node.id),
            onEdgeClick: (event: React.MouseEvent, edge: Edge) => {
                event.stopPropagation();
                this.select(edge.target);
                if (this.selectedId !== edge.target) return;
                this.selectedEdgeId = edge.id;
                this.relationshipSummary.textContent = edge.ariaLabel ?? 'Roadmap relationship';
                this.relationshipSummary.hidden = false;
                this.renderFlow();
            },
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
                this.queueInitialCamera();
                requestAnimationFrame(() => { if (flow === this.flow) this.restoreVisibleCameraOnResize(); }); },
            onMoveStart: (event: unknown) => {
                if (roadmapUserViewportEvent(event) && cameraGeneration === this.cameraGeneration && cameraProjectUri === this.projectUri)
                    this.initialCameraPending = false;
            },
            onMoveEnd: (event: unknown, viewport: { x: number; y: number; zoom: number }) => {
                if (!this.projectId || !this.projectUri || cameraGeneration !== this.cameraGeneration ||
                    cameraProjectUri !== this.projectUri) return;
                if (roadmapUserViewportEvent(event)) this.recordUserCamera(viewport);
                else if (!this.viewport && this.automaticCamera &&
                    (viewport.x !== this.automaticCamera.x || viewport.y !== this.automaticCamera.y ||
                        viewport.zoom !== this.automaticCamera.zoom)) {
                    // Graph measurement is allowed to update React Flow, but not to replace the
                    // readable first camera before the developer navigates deliberately.
                    const camera = this.automaticCamera;
                    if (this.flow) void this.flow.setViewport(camera);
                    return;
                } else this.displayedViewport = { ...viewport };
                const next = roadmapDetailAtZoom(viewport.zoom, this.detail);
                if (next !== this.detail) { this.detail = next; this.renderFlow(); }
            },
            proOptions: { hideAttribution: true },
        }, React.createElement(Background, { id: 'dope-roadmap-grid' })));
        this.queueInitialCamera();
    }

    private queueInitialCamera(): void {
        if (!this.initialCameraPending || !this.projection || !this.flow) return;
        const generation = this.cameraGeneration;
        const uri = this.projectUri;
        const flow = this.flow;
        requestAnimationFrame(() => {
            if (generation === this.cameraGeneration && uri === this.projectUri && flow === this.flow)
                this.applyInitialCamera();
        });
    }

    private applyInitialCamera(): void {
        if (!this.initialCameraPending || !this.flow || !this.projection ||
            !this.stage.clientWidth || !this.stage.clientHeight) return;
        const target = roadmapInitialTarget(this.projection.nodes);
        const position = target && (this.placements.get(target.id) ?? roadmapSpatialLayout(this.projection).get(target.id));
        if (!position) return;
        const camera = roadmapInitialCamera(position, this.stage.clientWidth, this.stage.clientHeight);
        this.initialCameraPending = false;
        this.automaticCamera = camera;
        this.displayedViewport = camera;
        this.detail = roadmapDetailAtZoom(camera.zoom, this.detail);
        void this.flow.setViewport(camera);
    }

    /** A saved full-width camera may clip its selected card in a narrower editor.
     * Derive the temporary camera from the saved intent so widening restores it. */
    private restoreVisibleCameraOnResize(): void {
        const flow = this.flow, saved = this.viewport, projection = this.projection, id = this.selectedId;
        if (!flow || !saved || !projection || !id || !this.stage.clientWidth || !this.stage.clientHeight) return;
        const card = [...this.path.querySelectorAll<HTMLButtonElement>('button[data-checkpoint-id]')]
            .find(button => button.dataset.checkpointId === id);
        if (!card) return;
        const visible = roadmapVisibleGraph(projection, this.detail, id,
            this.expanded, this.collapsed, 96, this.promptWindow);
        const position = this.placements.get(id) ?? roadmapSpatialLayout({ ...projection, ...visible }).get(id);
        if (!position) return;
        const camera = roadmapKeyboardCamera(position, this.stage.clientWidth, this.stage.clientHeight,
            saved, card.offsetWidth, card.offsetHeight) ?? saved;
        const current = flow.getViewport();
        if (current.x === camera.x && current.y === camera.y && current.zoom === camera.zoom) return;
        this.displayedViewport = camera;
        void flow.setViewport(camera);
    }

    private recordUserCamera(camera = this.flow?.getViewport()): void {
        if (!camera || !this.projectId || !this.projectUri) return;
        this.initialCameraPending = false;
        this.automaticCamera = undefined;
        this.displayedViewport = { ...camera };
        if (!this.viewport || this.viewport.x !== camera.x || this.viewport.y !== camera.y || this.viewport.zoom !== camera.zoom) {
            this.viewport = { ...camera };
            this.schedulePresentation();
        }
    }

    private intentionalCamera(action: (flow: ReactFlowInstance) => Promise<boolean>): void {
        const flow = this.flow;
        if (!flow || !this.projectUri) return;
        const generation = this.cameraGeneration;
        const uri = this.projectUri;
        const wasPending = this.initialCameraPending;
        this.initialCameraPending = false;
        void action(flow).then(applied => {
            if (flow !== this.flow || generation !== this.cameraGeneration || uri !== this.projectUri) return;
            if (applied) this.recordUserCamera(flow.getViewport());
            else if (wasPending && !this.viewport) {
                this.initialCameraPending = true;
                this.queueInitialCamera();
            }
        });
    }

    private setExpansion(expand: boolean): void {
        const id = this.selectedId;
        if (!id) return;
        const node = this.projection?.nodes.find(item => item.id === id);
        const stack = node?.kind === 'prompt' ? this.projection?.nodes.find(item =>
            item.kind === 'task-stack' && item.taskSource?.stackPath === node.taskSource?.stackPath) : undefined;
        const target = stack ? this.projection?.edges.find(edge => edge.to === stack.id &&
            edge.id.startsWith('task-parent:'))?.from : id;
        if (!target) return;
        (expand ? this.collapsed : this.expanded).delete(target);
        (expand ? this.expanded : this.collapsed).add(target);
        this.schedulePresentation();
        this.render();
    }

    private focusSelection(): void {
        if (!this.selectedId || !this.flow || !this.projection) return;
        const visible = roadmapVisibleGraph(this.projection, this.detail, this.selectedId,
            this.expanded, this.collapsed, 96, this.promptWindow);
        const position = this.placements.get(this.selectedId) ?? roadmapSpatialLayout({ ...this.projection, ...visible }).get(this.selectedId);
        if (!position) return;
        const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320;
        if (this.projection.nodes.some(item => item.id === this.selectedId && item.phaseCard)) {
            const camera = roadmapInitialCamera(position, this.stage.clientWidth, this.stage.clientHeight);
            this.intentionalCamera(flow => flow.setViewport(camera, { duration }));
            return;
        }
        this.intentionalCamera(flow => flow.setCenter(position.x + 140, position.y + 40,
            { zoom: Math.max(1.4, flow.getZoom()), duration }));
    }

    private nextPrompts(): void {
        const id = this.selectedId;
        if (!id || !this.projection) return;
        const visible = roadmapVisibleGraph(this.projection, this.detail, id,
            this.expanded, this.collapsed, 96, this.promptWindow);
        const omitted = roadmapImplementationStacks(this.projection, id).filter(item =>
            (visible.omittedByStack.get(item.id) ?? 0) > 0);
        const previous = omitted.findIndex(item => item.id === this.promptWindow?.stackId);
        const stack = omitted[(previous + 1) % omitted.length];
        if (!stack) return;
        const count = stack.promptCount;
        const shown = visible.nodes.filter(node => node.kind === 'prompt' &&
            node.taskSource?.stackPath === stack.path).length;
        this.promptWindow = { stackId: stack.id,
            start: ((this.promptWindow?.stackId === stack.id ? this.promptWindow.start : 0) + Math.max(1, shown)) % count };
        this.expanded.add(id);
        this.collapsed.delete(id);
        this.schedulePresentation();
        this.render();
    }

    protected override onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.root = createRoot(this.path);
        this.renderFlow();
    }

    protected override onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        if (this.phaseOpen) void this.refreshPhaseEvidence();
    }

    protected override onBeforeDetach(msg: Message): void {
        if (this.flow) this.displayedViewport = this.flow.getViewport();
        this.root?.unmount();
        this.root = undefined;
        this.flow = undefined;
        super.onBeforeDetach(msg);
    }

    private renderGateLinkedSource(): void {
        const index = this.inspector.gateIndex;
        const linked = index?.linkedDocument;
        const uri = this.projectUri;
        if (!index || !linked || !uri) return;
        const sync = this.gateSyncPreview;
        const state = sync?.state ?? linked.syncState;
        const notice = this.sourceError ? 'source check failed' : this.syncChecking ? 'checking source' :
            state.replaceAll('-', ' ');
        this.sourceLabel.textContent = `Markdown · ${notice}`;
        this.sourceButton.setAttribute('aria-label', `Roadmap Markdown ${linked.path}: ${notice}`);
        this.sourceButton.dataset.review = String(!!this.sourceError || !!linked.pending ||
            (state !== 'unchanged' && state !== 'synced'));
        this.sourceSummary.textContent = `Linked Markdown · ${linked.path} · ${notice}`;
        const detail = document.createElement('p');
        detail.textContent = `Linked source: ${linked.path} · accepted SHA-256 ${linked.sourceHash}. ` +
            'Canonical Roadmap acceptance and Markdown publication are separate approvals.';
        this.importEntry.append(detail);
        if (this.sourceError) {
            const error = document.createElement('p'); error.setAttribute('role', 'alert');
            error.textContent = this.sourceError; this.importEntry.append(error);
        }
        if (this.syncChecking) {
            const pending = document.createElement('p'); pending.textContent = 'Checking linked source…';
            this.importEntry.append(pending);
        }
        if (sync?.sourceHash && sync.sourceHash !== sync.acceptedHash) {
            const hash = document.createElement('p'); hash.textContent = `Observed SHA-256 ${sync.sourceHash}`;
            this.importEntry.append(hash);
        }
        if (sync?.diagnostics.length) this.appendImportDiagnostics('Linked source needs review', sync.diagnostics);
        if (sync?.state === 'source-changed') {
            const changes = document.createElement('p');
            changes.textContent = sync.changes.map(change =>
                `${change.kind} ${change.id} ${change.field}: ${change.accepted} → ${change.source}`).join('; ');
            this.importEntry.append(changes);
            const apply = document.createElement('button'); apply.type = 'button';
            apply.textContent = 'Accept source changes'; apply.disabled = this.syncApplying;
            apply.onclick = () => { if (this.syncApplying || this.gateSyncPreview !== sync) return;
                this.syncApplying = true; this.renderImportEntry();
                void this.service.applyGateDocumentSync(uri, sync, true).then(() => this.refresh()).catch(error => {
                    this.sourceError = `Linked Gate source was not accepted: ${String(error)}`;
                }).finally(() => { this.syncApplying = false; this.renderImportEntry(); }); };
            this.importEntry.append(apply);
        }
        if (sync?.state === 'relink-needed' && !linked.pending) {
            const relink = this.gateRelink ?? { path: '', busy: false };
            this.gateRelink = relink;
            const label = document.createElement('label'); label.textContent = 'Replacement project-relative Markdown path';
            const input = document.createElement('input'); input.value = relink.path;
            input.setAttribute('aria-label', 'Replacement project-relative Markdown path');
            input.oninput = () => { relink.path = input.value; relink.preview = undefined; };
            label.append(input); this.importEntry.append(label);
            const preview = document.createElement('button'); preview.type = 'button';
            preview.textContent = 'Preview Gate relink'; preview.disabled = relink.busy || !relink.path;
            preview.onclick = () => { relink.busy = true; relink.error = undefined; this.renderImportEntry();
                void this.service.previewGateRelink(uri, relink.path).then(value => { relink.preview = value; })
                    .catch(error => { relink.error = String(error); }).finally(() => {
                        relink.busy = false; this.renderImportEntry(); }); };
            this.importEntry.append(preview);
            if (relink.preview) {
                const result = document.createElement('p');
                result.textContent = `${relink.preview.previousPath} → ${relink.preview.path} · ${relink.preview.state}`;
                this.importEntry.append(result);
                if (relink.preview.diagnostics.length)
                    this.appendImportDiagnostics('Relink diagnostics', relink.preview.diagnostics);
                if (relink.preview.state === 'ready') {
                    const approve = document.createElement('button'); approve.type = 'button';
                    approve.textContent = 'Approve Gate relink'; approve.disabled = relink.busy;
                    approve.onclick = () => { if (!relink.preview || relink.busy) return;
                        relink.busy = true; this.renderImportEntry();
                        void this.service.applyGateRelink(uri, relink.preview, true).then(() => this.refresh())
                            .catch(error => { relink.error = String(error); }).finally(() => {
                                relink.busy = false; this.renderImportEntry(); }); };
                    this.importEntry.append(approve);
                }
            }
            if (relink.error) this.appendImportDiagnostics('Relink was not accepted', [relink.error]);
        }
        if (linked.pending) {
            const caution = document.createElement('p'); caution.setAttribute('role', 'alert');
            caution.textContent = 'A linked edit is pending. Review the original Markdown and its backup before recovery.';
            this.importEntry.append(caution);
        }
    }

    private renderImportEntry(): void {
        this.importEntry.replaceChildren();
        this.importEntry.append(this.sourceHeader);
        if ((this.inspector.index as unknown as RoadmapGateIndex | undefined)?.schemaVersion === 2 &&
            this.inspector.index?.linkedDocument) {
            this.renderGateLinkedSource();
            return;
        }
        const linkedDocument = this.inspector.index?.linkedDocument;
        const sourceState = this.syncPreview?.state ?? linkedDocument?.syncState;
        const approvalPending = !!this.importState?.preview || !!this.createState?.preview ||
            !!this.relink?.preview || !!this.recovery?.preview || !!this.replacement?.preview;
        const needsReview = sourceState === 'conflict' || sourceState === 'relink-needed' || sourceState === 'source-changed' ||
            !!linkedDocument?.pending || approvalPending || !!this.sourceError || this.syncChecking;
        const sourceNotice = this.sourceError ? 'Source check failed · review' :
            sourceState === 'conflict' ? 'Conflict · review' : sourceState === 'relink-needed' ? 'Relink needed' :
            linkedDocument?.pending ? 'Pending sync · review' :
            sourceState === 'source-changed' ? 'Source changed · review' : approvalPending ? 'Approval required' :
            this.syncChecking ? 'Checking source' : sourceState;
        this.sourceLabel.textContent = linkedDocument ? `Markdown · ${sourceNotice}` :
            approvalPending ? 'Markdown · Approval required' :
            this.inspector.index?.revision === 0 ? 'Markdown / Create' : 'Markdown';
        this.sourceButton.setAttribute('aria-label', linkedDocument ?
            `Roadmap Markdown ${linkedDocument.path}: ${sourceNotice}${needsReview ? '; review required' : ''}` :
            this.inspector.index?.revision === 0 ?
                `Roadmap Markdown, import and create${approvalPending ? '; approval required' : ''}` :
                'Roadmap Markdown: accepted structure has no published file');
        this.sourceButton.dataset.review = String(needsReview);
        this.sourceSummary.textContent = linkedDocument ? `Linked Markdown · ${linkedDocument.path} · ${sourceNotice}` :
            approvalPending ? 'Linked Markdown · Approval required' : 'Linked Markdown · Setup';
        if (!this.projectUri || !this.inspector.index) return;
        if (this.sourceError) { const error = document.createElement('p'); error.setAttribute('role', 'alert');
            error.textContent = this.sourceError; this.importEntry.append(error); }
        const index = this.inspector.index;
        if (index.linkedDocument) {
            const linked = document.createElement('p');
            const sync = this.syncPreview;
            linked.textContent = `Linked Markdown: ${index.linkedDocument.path} · ${sync?.state ?? index.linkedDocument.syncState}`;
            this.importEntry.append(linked);
            const ownership = document.createElement('p');
            ownership.textContent = 'The linked Markdown stays at its original path. Review external changes before applying supported title, objective, order or prose fields; status evidence is preserved.';
            this.importEntry.append(ownership);
            if (this.reviewedPlan?.projectId === index.projectId) {
                const blocked = document.createElement('p'); blocked.setAttribute('role', 'status');
                blocked.textContent = 'Reviewed implementation plan remains a noncanonical draft. This linked Roadmap supports single-section document edits only; bulk projection needs a separate reviewed source mapping and cannot overwrite the Markdown.';
                this.importEntry.append(blocked);
            }
            const change = document.createElement('button'); change.type = 'button'; change.textContent = 'Change linked file';
            change.className = 'dope-roadmap-change-linked';
            change.onclick = () => void this.discoverReplacement(); this.importEntry.append(change);
            if (this.replacement?.uri === this.projectUri && this.replacement.projectId === index.projectId &&
                this.replacement.revision === index.revision) this.renderReplacement();
            if (sync?.sourceHash && sync.sourceHash !== sync.acceptedHash) {
                const hashes = document.createElement('p');
                hashes.textContent = `Accepted source SHA-256 ${sync.acceptedHash}; current source SHA-256 ${sync.sourceHash}.`;
                this.importEntry.append(hashes);
            }
            if (sync?.state === 'source-changed') {
                const detail = document.createElement('p');
                detail.textContent = sync.changes.length ? sync.changes.slice(0, 12).map(change =>
                    `${change.checkpointId} ${change.field}: ${String(change.accepted ?? 'absent').slice(0, 120)} → ${String(change.source ?? 'absent').slice(0, 120)}`).join('; ') +
                    (sync.changes.length > 12 ? `; ${sync.changes.length - 12} more change(s)` : '') :
                    'Only unsupported Markdown changed; its content will remain untouched.';
                this.importEntry.append(detail);
                const apply = document.createElement('button'); apply.type = 'button'; apply.textContent = 'Apply source changes';
                apply.disabled = this.syncApplying || this.syncChecking;
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
        if (index.revision !== 0) {
            const note = document.createElement('p');
            note.textContent = 'This accepted Roadmap structure has no linked Markdown. No canonical file has been published.';
            this.importEntry.append(note);
            return;
        }
        const heading = document.createElement('h3'); heading.textContent = 'Start your Roadmap';
        const actions = document.createElement('div'); actions.className = 'dope-roadmap-import-actions';
        const button = (label: string, action: () => void): HTMLButtonElement => {
            const element = document.createElement('button'); element.type = 'button'; element.textContent = label;
            element.onclick = action; return element;
        };
        const importButton = button('Import Roadmap', () => void this.discoverImport());
        importButton.disabled = !!this.importState?.busy || !!this.createState || this.createStarting ||
            !!this.reviewedPlan?.preview || !!this.reviewedPlan?.busy;
        const chatButton = button('Plan with Chat', () => {
            if (this.projectUri) this.planSetup = { uri: this.projectUri, projectId: index.projectId, busy: false };
            this.renderImportEntry();
        });
        const manualButton = button('Create Manually', () => { void this.beginCreate('manual'); });
        chatButton.disabled = manualButton.disabled = !!this.createState || this.createStarting || !!this.importState?.busy ||
            !!this.reviewedPlan?.preview || !!this.reviewedPlan?.busy;
        if (this.planSetup?.chatId) chatButton.disabled = true;
        actions.append(importButton,
            chatButton, manualButton);
        this.importEntry.append(heading, actions);
        if (this.createState) { this.renderCreate(); return; }
        if (this.planSetup?.uri === this.projectUri && this.planSetup.projectId === index.projectId) {
            const setup = this.planSetup;
            const section = document.createElement('section'); section.className = 'dope-roadmap-create';
            const title = document.createElement('h4'); title.textContent = 'Implementation plan with saved Chat';
            const guidance = document.createElement('p'); guidance.textContent = setup.chatId ?
                'Use this saved Chat where you placed it. The complete plan will require review in Chat before it appears on this Roadmap.' :
                'Choose the saved Chat to use for a complete, reviewable implementation plan.';
            section.append(title, guidance);
            if (!setup.chatId) {
                const select = document.createElement('select'); select.setAttribute('aria-label', 'Saved Chat for implementation plan');
                const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Choose a saved Chat'; select.append(empty);
                for (const chat of this.savedChats(setup.uri)) {
                    const option = document.createElement('option'); option.value = chat.id; option.textContent = chat.title; select.append(option);
                }
                const start = document.createElement('button'); start.type = 'button'; start.textContent = 'Start plan in Chat';
                start.disabled = setup.busy;
                start.onclick = () => { if (setup.busy || !select.value) return;
                    const selectedChatId = select.value; setup.busy = true; this.renderImportEntry();
                    void this.service.beginImplementationPlan(setup.uri, selectedChatId).then(() => {
                        if (this.planSetup === setup && this.projectUri === setup.uri) {
                            setup.chatId = selectedChatId; setup.error = undefined;
                        } else void this.service.cancelUnacceptedImplementationPlan(setup.uri, selectedChatId).catch(() => undefined);
                    }, error => { if (this.planSetup === setup) setup.error = `Plan could not start: ${String(error)}. Refresh and review the Roadmap owner.`; })
                        .finally(() => { if (this.planSetup === setup) { setup.busy = false; this.renderImportEntry(); } });
                };
                section.append(select, start);
            } else {
                const discard = document.createElement('button'); discard.type = 'button';
                discard.textContent = 'Discard unaccepted plan setup'; discard.disabled = setup.busy;
                discard.onclick = () => { if (!setup.chatId || setup.busy) return; setup.busy = true; this.renderImportEntry();
                    void this.service.cancelUnacceptedImplementationPlan(setup.uri, setup.chatId).then(() => {
                        if (this.planSetup === setup) this.planSetup = undefined;
                    }, error => { if (this.planSetup === setup)
                        setup.error = `Plan setup could not be discarded: ${String(error)}. Refresh and review the plan.`; })
                        .finally(() => { setup.busy = false; this.renderImportEntry(); });
                };
                section.append(discard);
            }
            if (setup.error) { const error = document.createElement('p'); error.setAttribute('role', 'alert');
                error.textContent = setup.error; section.append(error); }
            this.importEntry.append(section);
        }
        if (this.reviewedPlan?.uri === this.projectUri && this.reviewedPlan.projectId === index.projectId) {
            const state = this.reviewedPlan;
            const section = document.createElement('section'); section.className = 'dope-roadmap-create';
            const title = document.createElement('h4'); title.textContent = `Reviewed implementation plan · revision ${state.plan.revision}`;
            const note = document.createElement('p'); note.textContent =
                'Project strategic outcomes into this Roadmap draft. Technical detail stays in the reviewed plan. Linked Markdown needs a separate preview and approval.';
            section.append(title, note);
            const control = (label: string, action: () => void): HTMLButtonElement => {
                const element = document.createElement('button'); element.type = 'button'; element.textContent = label;
                element.disabled = state.busy; element.onclick = action; return element;
            };
            if (!state.preview) section.append(control('Review plan projection', () => void this.previewReviewedPlan()));
            else {
                const graph = document.createElement('pre'); graph.setAttribute('aria-label', 'Plan projection review');
                graph.textContent = state.preview.draft.phases.map(phase =>
                    `${phase.title}\n${phase.checkpoints.map(item => `  ${item.title}${item.dependencies?.length ?
                        ` · depends on ${item.dependencies.length} outcome(s)` : ''}`).join('\n')}`).join('\n');
                section.append(graph, control('Accept as Roadmap draft', () => void this.acceptReviewedPlan()),
                    control('Reject projection', () => void this.rejectReviewedPlan()));
            }
            if (state.error) { const error = document.createElement('p'); error.setAttribute('role', 'alert');
                error.textContent = state.error; section.append(error); }
            this.importEntry.append(section);
        }
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
        const gates = preview.gateSource;
        summary.textContent = `Preview ${preview.roadmapPath}: ${gates.phases.length} Phases, ${gates.gates.length} Gates, ` +
            `${gates.gates.reduce((count, gate) => count + gate.criteria.length, 0)} criteria. ` +
            'Imported definitions start unqualified; Markdown remains at its source path.';
        this.importEntry.append(summary);
        const mapped = document.createElement('details');
        const mappedHeading = document.createElement('summary'); mappedHeading.textContent = 'Phase and Gate source mapping';
        const mappedList = document.createElement('ul');
        for (const item of [...gates.phases, ...gates.gates].slice(0, 50)) {
            const row = document.createElement('li');
            row.textContent = `${'designation' in item ? item.designation + ' Gate' : 'Phase'}: ${item.title} · ${item.source.path}:${item.source.line}`;
            mappedList.append(row);
        }
        if (gates.phases.length + gates.gates.length > 50) { const rest = document.createElement('li');
            rest.textContent = `${gates.phases.length + gates.gates.length - 50} more Phase or Gate definitions; review the source Markdown before approval.`;
            mappedList.append(rest); }
        mapped.append(mappedHeading, mappedList); this.importEntry.append(mapped);
        if (gates.diagnostics.length) this.appendImportDiagnostics('Gate source diagnostics', gates.diagnostics);
        const accept = button('Accept Import', () => void this.acceptImport());
        accept.disabled = state.busy || !gates.phases.length || !!gates.diagnostics.length;
        this.importEntry.append(accept);
    }

    private async applySync(preview: RoadmapSyncPreview): Promise<void> {
        const uri = this.projectUri;
        if (!uri || this.syncPreview !== preview || this.syncApplying || this.syncChecking) return;
        this.syncApplying = true; this.renderImportEntry();
        try {
            await this.service.applyDocumentSync(uri, preview);
            if (this.projectUri === uri) await this.refresh();
        } catch (error) {
            if (this.projectUri === uri) {
                this.sourceError = `Linked Roadmap sync failed: ${String(error)}. Refresh and review before retrying.`;
                this.status.textContent = this.sourceError;
                this.syncPreview = undefined;
                this.renderImportEntry();
            }
        } finally { this.syncApplying = false; this.renderImportEntry(); }
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

    private renderReplacement(): void {
        const state = this.replacement;
        if (!state) return;
        const heading = document.createElement('h3'); heading.textContent = 'Change linked file';
        this.importEntry.append(heading);
        const warning = document.createElement('p');
        warning.textContent = 'This replaces the active project Roadmap. The previous Markdown file remains on disk. Unsynchronized changes or conflicts must be resolved before replacement.';
        this.importEntry.append(warning);
        const chooser = document.createElement('div'); chooser.className = 'dope-roadmap-import-chooser';
        const label = document.createElement('label'); label.textContent = 'New project Markdown file';
        const select = document.createElement('select'); select.setAttribute('aria-label', 'Replacement Markdown Roadmap');
        const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose a different Roadmap file';
        select.append(placeholder);
        for (const candidate of state.discovery.candidates.filter(item => item.path !== this.inspector.index?.linkedDocument?.path)) {
            const option = document.createElement('option'); option.value = candidate.path;
            option.textContent = `${candidate.path} (${candidate.bytes} bytes)`; select.append(option);
        }
        select.value = state.path;
        select.disabled = state.busy;
        select.onchange = () => void this.previewReplacement(select.value);
        label.append(select);
        const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = 'Cancel';
        cancel.disabled = !!state.applying;
        cancel.onclick = () => { ++this.replacementSerial; this.replacement = undefined; this.renderImportEntry();
            this.importEntry.querySelector<HTMLButtonElement>('.dope-roadmap-change-linked')?.focus(); };
        chooser.append(label, cancel); this.importEntry.append(chooser);
        if (state.discovery.diagnostics.length) this.appendImportDiagnostics('Discovery diagnostics', state.discovery.diagnostics);
        if (!state.discovery.candidates.some(item => item.path !== this.inspector.index?.linkedDocument?.path) && !state.busy) {
            const empty = document.createElement('p'); empty.textContent = 'No other project Markdown Roadmap found. Add a file and try again.';
            this.importEntry.append(empty);
        }
        if (state.error) { const error = document.createElement('p'); error.setAttribute('role', 'alert');
            error.textContent = state.error; this.importEntry.append(error); }
        const preview = state.preview;
        if (!preview) return;
        const summary = document.createElement('p');
        summary.textContent = `${preview.previousPath} → ${preview.path}. ${preview.replacementWarning} ` +
            `${preview.removedCheckpointIds.length} active checkpoint(s) removed, ${preview.addedCheckpointIds.length} added, ` +
            `${preview.retainedCheckpointIds.length} retained; ${preview.atRiskCheckpoints.length} existing checkpoint(s) have state or links at risk.`;
        this.importEntry.append(summary);
        if (preview.atRiskCheckpoints.length) this.appendImportDiagnostics('Active Roadmap state at risk',
            preview.atRiskCheckpoints.map(item => `${item.title} (${item.status}; ${item.dependencies} dependencies, ${item.links} links)`));
        if (preview.diagnostics.length) this.appendImportDiagnostics('Replacement diagnostics', preview.diagnostics.map(item =>
            `${item.severity}: ${item.path}${item.line ? `:${item.line}` : ''}: ${item.message}`));
        if (preview.state !== 'ready') {
            const blocked = document.createElement('p'); blocked.setAttribute('role', 'alert');
            blocked.textContent = 'Replacement cannot be confirmed. ' +
                preview.diagnostics.filter(item => item.severity === 'blocking').slice(0, 3).map(item => item.message).join(' ') +
                ' Resolve the listed source, conflict or unsynchronized changes and preview again.';
            this.importEntry.append(blocked);
            return;
        }
        const confirm = document.createElement('button'); confirm.type = 'button';
        confirm.textContent = 'Confirm replacing active Roadmap'; confirm.disabled = state.busy;
        confirm.onclick = () => void this.applyReplacement(preview);
        this.importEntry.append(confirm);
    }

    private currentReplacement(state: RoadmapReplacementState, serial: number): boolean {
        return !this.isDisposed && this.replacement === state && serial === this.replacementSerial &&
            this.projectUri === state.uri && this.inspector.index?.projectId === state.projectId &&
            this.inspector.index.revision === state.revision;
    }

    private async discoverReplacement(): Promise<void> {
        const uri = this.projectUri, index = this.inspector.index;
        if (!uri || !index?.linkedDocument) return;
        const serial = ++this.replacementSerial;
        const state: RoadmapReplacementState = { uri, projectId: index.projectId, revision: index.revision, path: '',
            discovery: { candidates: [], diagnostics: [] }, busy: true };
        this.replacement = state; this.renderImportEntry();
        try {
            const discovery = await this.service.discoverImports(uri);
            if (!this.currentReplacement(state, serial)) return;
            state.discovery = discovery;
        } catch (error) {
            if (!this.currentReplacement(state, serial)) return;
            state.error = `Could not list Roadmaps: ${String(error)}. Retry or Cancel.`;
        } finally {
            if (this.currentReplacement(state, serial)) {
                state.busy = false; this.renderImportEntry();
                this.importEntry.querySelector<HTMLSelectElement>('select[aria-label="Replacement Markdown Roadmap"]')?.focus();
            }
        }
    }

    private async previewReplacement(path: string): Promise<void> {
        const prior = this.replacement;
        if (!prior || prior.busy) return;
        const serial = ++this.replacementSerial;
        const state: RoadmapReplacementState = { ...prior, path, preview: undefined, error: undefined, busy: !!path };
        this.replacement = state; this.renderImportEntry();
        if (!path) { this.importEntry.querySelector<HTMLSelectElement>('select[aria-label="Replacement Markdown Roadmap"]')?.focus(); return; }
        try {
            const preview = await this.service.previewReplacement(state.uri, path);
            if (this.currentReplacement(state, serial)) state.preview = preview;
        } catch (error) {
            if (this.currentReplacement(state, serial)) state.error = `Replacement preview failed: ${String(error)}. Choose another file or retry.`;
        } finally {
            if (this.currentReplacement(state, serial)) { state.busy = false; this.renderImportEntry();
                this.importEntry.querySelector<HTMLSelectElement>('select[aria-label="Replacement Markdown Roadmap"]')?.focus(); }
        }
    }

    private async applyReplacement(preview: RoadmapReplacementPreview): Promise<void> {
        const state = this.replacement;
        if (!state || state.busy || state.preview !== preview || preview.state !== 'ready') return;
        const serial = ++this.replacementSerial;
        state.busy = true; state.applying = true; state.error = undefined; this.renderImportEntry();
        try {
            const result = await this.service.applyReplacement(state.uri, preview, true);
            if (!this.currentReplacement(state, serial)) return;
            if (result.projectId !== state.projectId || result.revision <= state.revision ||
                result.linkedDocument?.path !== preview.path) throw new Error('Replacement acknowledgement did not match the selected source');
            this.inspector.setSnapshot(state.uri, result);
            await this.refresh();
            if (this.projectUri === state.uri && this.inspector.index?.revision === result.revision)
                this.status.textContent = `Linked ${preview.path} as the active Roadmap. Previous Markdown remains on disk.`;
        } catch (error) {
            if (this.currentReplacement(state, serial)) {
                state.preview = undefined;
                state.error = `Replacement could not be confirmed: ${String(error)}. Refresh and preview before retrying.`;
            }
        } finally {
            if (this.currentReplacement(state, serial)) { state.busy = false; state.applying = false; this.renderImportEntry();
                this.importEntry.querySelector<HTMLSelectElement>('select[aria-label="Replacement Markdown Roadmap"]')?.focus(); }
        }
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
        if (!state?.preview || state.busy || !state.preview.gateSource.phases.length ||
            state.preview.gateSource.diagnostics.length) return;
        const serial = ++this.importSerial;
        this.importState = { ...state, busy: true, message: 'Checking Roadmap revision and source…' };
        this.renderImportEntry();
        try {
            const current = await this.service.read(state.uri);
            if (!this.currentImport(serial, state.uri, state.projectId, state.revision) ||
                current.projectId !== state.projectId || current.revision !== state.revision)
                throw new Error('Roadmap changed. Refresh, choose the file and preview again');
            const result = await this.service.acceptGateImport(state.uri, state.revision, state.projectId, state.preview);
            if (!this.currentImport(serial, state.uri, state.projectId, state.revision)) return;
            this.inspector.setSnapshot(state.uri, result as unknown as RoadmapIndex);
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

    private async previewReviewedPlan(): Promise<void> {
        const state = this.reviewedPlan, index = this.inspector.index;
        if (!state || state.busy || !index || index.revision !== 0 || state.projectId !== index.projectId) return;
        state.busy = true; state.error = undefined; this.renderImportEntry();
        try {
            const preview = await this.service.previewImplementationPlanProjection(state.uri, state.handle);
            if (this.reviewedPlan !== state || this.projectUri !== state.uri) return;
            state.preview = preview;
            this.projection = this.projectIndex(index);
            this.render();
        } catch (error) { if (this.reviewedPlan === state) state.error = `Plan projection unavailable: ${String(error)}. Refresh and review again.`; }
        finally { if (this.reviewedPlan === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private async acceptReviewedPlan(): Promise<void> {
        const state = this.reviewedPlan, index = this.inspector.index;
        if (!state?.preview || state.busy || !index || index.revision !== 0 || state.projectId !== index.projectId) return;
        state.busy = true; state.error = undefined; this.renderImportEntry();
        try {
            const draft = await this.service.applyImplementationPlanProjection(state.uri, state.preview, true);
            if (this.reviewedPlan !== state || this.projectUri !== state.uri) return;
            this.reviewedPlan = undefined;
            this.createState = { uri: state.uri, projectId: state.projectId, handle: state.handle,
                draft, mode: 'plan', path: 'ROADMAP.md', busy: false };
            this.projection = this.projectIndex(index);
            this.render();
        } catch (error) { if (this.reviewedPlan === state) {
            state.preview = undefined; state.error = `Plan projection was not accepted: ${String(error)}. Refresh and review again.`;
        } } finally { if (this.reviewedPlan === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private async rejectReviewedPlan(): Promise<void> {
        const state = this.reviewedPlan, index = this.inspector.index;
        if (!state?.preview || state.busy || !index || state.projectId !== index.projectId) return;
        state.busy = true; this.renderImportEntry();
        try { await this.service.clearImplementationPlanProjection(state.uri, state.handle); }
        catch (error) { if (this.reviewedPlan === state) state.error = `Projection rejection could not be confirmed: ${String(error)}`; }
        finally {
            if (this.reviewedPlan === state) {
                state.preview = undefined; state.busy = false;
                this.projection = this.projectIndex(index);
                this.render();
            }
        }
    }

    private async beginCreate(mode: 'manual' | 'chat'): Promise<void> {
        const uri = this.projectUri, index = this.inspector.index;
        if (!uri || !index || index.revision !== 0 || this.createState || this.createStarting ||
            this.importState?.busy || this.reviewedPlan?.preview || this.reviewedPlan?.busy) return;
        const serial = ++this.createSerial;
        this.createStarting = true; this.renderImportEntry();
        try {
            const started = await this.service.beginDraft(uri);
            if (serial !== this.createSerial || this.projectUri !== uri || this.inspector.index?.projectId !== index.projectId ||
                this.inspector.index.revision !== 0) { await this.service.cancelDraft(started.handle); return; }
            this.importState = undefined;
            this.createState = { uri, projectId: index.projectId, handle: started.handle, draft: started.draft,
                mode, path: 'ROADMAP.md', busy: false };
            this.draftSequence = 0; this.draftEpoch = undefined; this.proposedDraft = undefined;
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
            state.draft = draft; state.preview = undefined; state.editPreview = undefined;
        } catch (error) { if (serial === this.createSerial && this.createState === state) state.error = `Draft edit failed: ${String(error)}. Correct the fields and retry.`; }
        finally { if (serial === this.createSerial && this.createState === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private async previewCreateEdit(action: GreenfieldEdit): Promise<void> {
        const state = this.createState; if (!state || state.busy) return;
        const serial = ++this.createSerial; state.busy = true; state.error = undefined; state.editPreview = undefined;
        this.renderImportEntry();
        try {
            const preview = await this.service.previewDraftEdit(state.handle, state.draft.revision, action);
            if (serial === this.createSerial && this.createState === state) state.editPreview = preview;
        } catch (error) { if (serial === this.createSerial && this.createState === state)
            state.error = `Graph change could not be previewed: ${String(error)}`; }
        finally { if (serial === this.createSerial && this.createState === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private async applyCreateEdit(): Promise<void> {
        const state = this.createState, preview = state?.editPreview; if (!state || !preview || state.busy) return;
        const serial = ++this.createSerial; state.busy = true; this.renderImportEntry();
        try {
            const draft = await this.service.applyDraftEdit(state.handle, preview, true);
            if (serial === this.createSerial && this.createState === state) {
                state.draft = draft; state.editPreview = undefined; state.preview = undefined; state.error = undefined;
            }
        } catch (error) { if (serial === this.createSerial && this.createState === state) {
            state.editPreview = undefined; state.error = `Graph change was not accepted: ${String(error)}. Preview again.`;
        } } finally { if (serial === this.createSerial && this.createState === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private async replayCreateEdit(redo: boolean): Promise<void> {
        const state = this.createState; if (!state || state.busy) return;
        const serial = ++this.createSerial; state.busy = true; state.editPreview = undefined; this.renderImportEntry();
        try {
            const draft = redo ? await this.service.redoDraftEdit(state.handle, state.draft.revision) :
                await this.service.undoDraftEdit(state.handle, state.draft.revision);
            if (serial === this.createSerial && this.createState === state) {
                state.draft = draft; state.preview = undefined; state.error = undefined;
            }
        } catch (error) { if (serial === this.createSerial && this.createState === state)
            state.error = `Undo/redo unavailable: ${String(error)}`; }
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
            await this.service.acceptDraft(state.handle, state.preview, true);
            if (serial !== this.createSerial || this.createState !== state) return;
            this.createState = undefined;
            await this.refresh();
        } catch (error) { if (serial === this.createSerial && this.createState === state) state.error = `Creation failed: ${String(error)}. Review the preview and retry, or Refresh to recover.`; }
        finally { if (serial === this.createSerial && this.createState === state) { state.busy = false; this.renderImportEntry(); } }
    }

    private cancelCreate(): void {
        const state = this.createState; if (!state) return;
        ++this.createSerial; this.createState = undefined; this.proposedDraft = undefined; this.draftSequence = 0;
        this.draftEpoch = undefined;
        void this.service.cancelDraft(state.handle).catch(() => undefined);
        if (this.inspector.index) this.projection = this.projectIndex(this.inspector.index);
        this.render();
    }

    private renderCreate(): void {
        const state = this.createState; if (!state) return;
        const section = document.createElement('section'); section.className = 'dope-roadmap-create';
        const heading = document.createElement('h4'); heading.textContent = state.mode === 'chat' ? 'Plan with an existing Chat' :
            state.mode === 'plan' ? 'Accepted plan Roadmap draft' : 'Create a Roadmap manually';
        const note = document.createElement('p'); note.textContent = state.mode === 'plan' ?
            'Review the projected outcomes, edit if needed, then preview and explicitly approve the new linked Markdown file.' :
            'Build Phases, Gates and testable Criteria. Review each change, then accept the Roadmap structure. Markdown publication requires separate approval. No model is needed.';
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
            guidance.textContent = state.chatId ? 'Use the selected Chat where you placed it. Validated proposals appear provisionally on this canvas. Review and accept or reject them in Chat.' :
                'Open and select a saved Chat using the ordinary Chat panel, then choose it here. You can build the draft manually now.';
            section.append(guidance);
        }
        const form = document.createElement('form');
        const phaseLabel = document.createElement('label'); phaseLabel.textContent = 'New phase title';
        const phase = document.createElement('input'); phase.required = true; phase.maxLength = 200; phaseLabel.append(phase);
        const objectiveLabel = document.createElement('label'); objectiveLabel.textContent = 'Phase objective (required before structure acceptance)';
        const objective = document.createElement('input'); objective.maxLength = 8192; objectiveLabel.append(objective);
        form.onsubmit = event => { event.preventDefault(); void this.editCreate({ type: 'create-phase', title: phase.value, objective: objective.value }); };
        const addPhase = document.createElement('button'); addPhase.type = 'submit'; addPhase.textContent = 'Add phase'; addPhase.disabled = state.busy;
        form.append(phaseLabel, objectiveLabel, addPhase); section.append(form);
        const parentChoices = state.draft.phases.flatMap(item => [
            { id: item.id, label: `Phase: ${item.title}` },
            ...item.checkpoints.map(checkpoint => ({ id: checkpoint.id, label: `Checkpoint: ${checkpoint.title}` }))]);
        const choose = (label: string, choices: { id: string; label: string }[]): HTMLSelectElement => {
            const select = document.createElement('select'); select.setAttribute('aria-label', label);
            for (const choice of choices) { const option = document.createElement('option'); option.value = choice.id;
                option.textContent = choice.label; select.append(option); }
            select.disabled = state.busy; return select;
        };
        if (parentChoices.length) {
            const correction = document.createElement('form');
            const name = document.createElement('input'); name.required = true; name.maxLength = 200;
            name.setAttribute('aria-label', 'New correction title');
            const parent = choose('Correction parent', parentChoices);
            correction.onsubmit = event => { event.preventDefault(); void this.previewCreateEdit({ type: 'create-correction',
                parentId: parent.value, title: name.value }); };
            const create = document.createElement('button'); create.type = 'submit'; create.textContent = 'Preview correction branch';
            create.disabled = state.busy; correction.append(name, parent, create); section.append(correction);
        }
        for (const item of state.draft.phases) {
            const group = document.createElement('section');
            const title = document.createElement('h5'); title.textContent = item.title;
            const description = document.createElement('p'); description.textContent = item.objective || 'No objective yet.';
            group.append(title, description);
            if (item.kind === 'correction') {
                const parents = parentChoices.filter(choice => choice.id !== item.id &&
                    !item.checkpoints.some(checkpoint => checkpoint.id === choice.id));
                const parent = choose(`Parent for correction ${item.title}`, parents);
                parent.value = item.parentId ?? '';
                group.append(parent, button('Preview correction parent', () => void this.previewCreateEdit({
                    type: 'attach-correction', correctionId: item.id, parentId: parent.value })));
            }
            const phaseEdit = document.createElement('form');
            const phaseTitleLabel = document.createElement('label'); phaseTitleLabel.textContent = `Edit ${item.title} title`;
            const phaseTitle = document.createElement('input'); phaseTitle.value = item.title; phaseTitle.required = true; phaseTitle.maxLength = 200; phaseTitleLabel.append(phaseTitle);
            const phaseObjectiveLabel = document.createElement('label'); phaseObjectiveLabel.textContent = 'Phase objective';
            const phaseObjective = document.createElement('input'); phaseObjective.value = item.objective; phaseObjective.maxLength = 8192; phaseObjectiveLabel.append(phaseObjective);
            phaseEdit.onsubmit = event => { event.preventDefault(); void this.editCreate({ type: 'edit-phase', phaseId: item.id,
                title: phaseTitle.value, objective: phaseObjective.value }); };
            const savePhase = document.createElement('button'); savePhase.type = 'submit'; savePhase.textContent = 'Update phase'; savePhase.disabled = state.busy;
            phaseEdit.append(phaseTitleLabel, phaseObjectiveLabel, savePhase); group.append(phaseEdit);
            if (!item.kind) {
                const gateForm = document.createElement('form');
                const gateTitle = document.createElement('input'); gateTitle.required = true; gateTitle.maxLength = 200;
                gateTitle.setAttribute('aria-label', `New Gate in ${item.title}`);
                const gatePurpose = document.createElement('input'); gatePurpose.required = true; gatePurpose.maxLength = 8192;
                gatePurpose.setAttribute('aria-label', 'Testable Gate purpose');
                gateForm.onsubmit = event => { event.preventDefault(); void this.previewCreateEdit({
                    type: 'create-gate', phaseId: item.id, title: gateTitle.value, purpose: gatePurpose.value }); };
                const addGate = document.createElement('button'); addGate.type = 'submit'; addGate.textContent = 'Preview Gate';
                gateForm.append(gateTitle, gatePurpose, addGate); group.append(gateForm);
                for (const gate of item.gates ?? []) {
                    const gateHeading = document.createElement('h6'); gateHeading.textContent = `${gate.designation} · ${gate.title} · Proposed definition`;
                    group.append(gateHeading);
                    const gateEdit = document.createElement('form');
                    const gateName = document.createElement('input'); gateName.required = true; gateName.maxLength = 200;
                    gateName.value = gate.title; gateName.setAttribute('aria-label', `Edit ${gate.designation} title`);
                    const gateObjective = document.createElement('input'); gateObjective.required = true; gateObjective.maxLength = 8192;
                    gateObjective.value = gate.purpose; gateObjective.setAttribute('aria-label', `Edit ${gate.designation} purpose`);
                    gateEdit.onsubmit = event => { event.preventDefault(); void this.previewCreateEdit({
                        type: 'edit-gate', phaseId: item.id, gateId: gate.id,
                        title: gateName.value, purpose: gateObjective.value }); };
                    const saveGate = document.createElement('button'); saveGate.type = 'submit'; saveGate.textContent = 'Preview Gate edit';
                    gateEdit.append(gateName, gateObjective, saveGate); group.append(gateEdit);
                    const criterionForm = document.createElement('form');
                    const criterionTitle = document.createElement('input'); criterionTitle.required = true; criterionTitle.maxLength = 200;
                    criterionTitle.setAttribute('aria-label', `New criterion for ${gate.designation}`);
                    const expected = document.createElement('input'); expected.required = true; expected.maxLength = 8192;
                    expected.setAttribute('aria-label', `Expected observation for ${gate.designation}`);
                    criterionForm.onsubmit = event => { event.preventDefault(); void this.previewCreateEdit({
                        type: 'add-criterion', phaseId: item.id, gateId: gate.id,
                        title: criterionTitle.value, expectedResult: expected.value }); };
                    const addCriterion = document.createElement('button'); addCriterion.type = 'submit';
                    addCriterion.textContent = 'Preview criterion';
                    criterionForm.append(criterionTitle, expected, addCriterion); group.append(criterionForm);
                    for (const criterion of gate.criteria) {
                        const criterionEdit = document.createElement('form');
                        const criterionName = document.createElement('input'); criterionName.required = true; criterionName.maxLength = 200;
                        criterionName.value = criterion.title; criterionName.setAttribute('aria-label', `Edit ${criterion.title} criterion`);
                        const criterionResult = document.createElement('input'); criterionResult.required = true; criterionResult.maxLength = 8192;
                        criterionResult.value = criterion.expectedResult;
                        criterionResult.setAttribute('aria-label', `Edit expected result for ${criterion.title}`);
                        criterionEdit.onsubmit = event => { event.preventDefault(); void this.previewCreateEdit({
                            type: 'edit-criterion', phaseId: item.id, gateId: gate.id, criterionId: criterion.id,
                            title: criterionName.value, expectedResult: criterionResult.value }); };
                        const saveCriterion = document.createElement('button'); saveCriterion.type = 'submit';
                        saveCriterion.textContent = 'Preview criterion edit';
                        criterionEdit.append(criterionName, criterionResult, saveCriterion); group.append(criterionEdit);
                    }
                }
            }
            section.append(group);
        }
        const pathLabel = document.createElement('label'); pathLabel.textContent = 'Proposed Markdown path (publication requires separate approval)';
        const path = document.createElement('input'); path.value = state.path; path.maxLength = 512;
        path.oninput = () => { state.path = path.value; state.preview = undefined;
            section.querySelector('[data-approve-draft]')?.remove(); section.querySelector('pre')?.remove(); };
        pathLabel.append(path); section.append(pathLabel);
        section.append(button('Undo last draft edit', () => void this.replayCreateEdit(false)),
            button('Redo last draft edit', () => void this.replayCreateEdit(true)));
        if (state.editPreview) {
            const preview = document.createElement('pre'); preview.setAttribute('aria-label', 'Before and after graph change');
            preview.textContent = `Before:\n${JSON.stringify(state.editPreview.before.phases, null, 2)}\nAfter:\n${JSON.stringify(state.editPreview.after.phases, null, 2)}`;
            section.append(preview, button('Accept graph change', () => void this.applyCreateEdit()),
                button('Reject graph change', () => { state.editPreview = undefined; this.renderImportEntry(); }));
        }
        section.append(button('Preview Roadmap', () => void this.previewCreate()), button('Cancel draft', () => this.cancelCreate()));
        if (state.preview) {
            const summary = document.createElement('pre'); summary.setAttribute('aria-label', 'Roadmap creation preview');
            const names = new Map(state.preview.phases.flatMap(item => [[item.id, item.title] as const,
                ...item.checkpoints.map(checkpoint => [checkpoint.id, checkpoint.title] as const)]));
            const relations = state.preview.phases.flatMap(item => [
                ...(item.parentId ? [`Correction ${item.title} branches from ${names.get(item.parentId) ?? item.parentId}`] : []),
                ...item.checkpoints.flatMap(checkpoint => (checkpoint.dependencies ?? []).map(dependency =>
                    `${checkpoint.title} depends on ${names.get(dependency) ?? dependency}`))]);
            summary.textContent = `${state.preview.markdown}\nUnresolved coverage:\n${state.preview.unresolvedCoverage.join('\n') || 'Gate-set completeness still requires owner review'}\nGraph relationships:\n${relations.length ? relations.join('\n') : 'None'}\n`;
            section.append(summary);
            const approve = button('Accept Roadmap structure (no Markdown publication)', () => void this.acceptCreate());
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
        const selectedCheckpoint = this.inspector.index?.checkpoints?.some(item => item.id === this.selectedId && !item.readOnly);
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
            const title = document.createElement('h3'); title.textContent = this.inspector.gateIndex ? 'Unassigned corrections' : 'Unlinked task sources';
            const list = document.createElement('ul'); list.setAttribute('aria-label', title.textContent);
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
        if (id !== this.selectedId && (this.inspector.dirty || this.inspector.requiresApproval)) {
            this.status.textContent = 'A Roadmap edit or approval is pending. Save or review it before selecting another checkpoint.';
            this.setInspectionOpen(true);
            return;
        }
        this.selectedEdgeId = undefined;
        this.relationshipSummary.hidden = true;
        if (this.promptWindow && this.promptWindow.stackId !== id) this.promptWindow = undefined;
        this.selectedId = id;
        if (this.phaseOpen && node.kind === 'phase' && !node.draftState) this.phaseId = id;
        this.schedulePresentation();
        if (node.taskSource) this.inspector.selectTask(node);
        else if (!node.draftState || node.draftState === 'accepted' &&
            !!this.inspector.gateIndex?.phases.some(phase => phase.id === id)) this.inspector.select(id);
        this.setInspectionView('compact');
        this.setInspectionOpen(true);
        this.render();
        if (node.draftState) this.status.textContent = `${node.title} · ${node.draftState === 'proposed' ?
            this.reviewedPlan?.preview ? 'Proposed plan projection; accept or reject in Roadmap' :
                this.strategic?.review ? 'Proposed draft; accept or reject in Roadmap' :
                    'Proposed draft; accept or reject in the selected Chat' :
            this.inspector.gateIndex?.phases.some(phase => phase.id === id) ?
                'Accepted Roadmap structure; Markdown publication remains separate' :
                'Accepted draft; preview and approve creation in Roadmap'} · Not canonical.`;
        if (focus) {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (this.selectedId === id) [...this.path.querySelectorAll<HTMLButtonElement>('button[data-checkpoint-id]')]
                    .find(button => button.dataset.checkpointId === id)?.focus();
            }));
        }
    }

    private selectGate(id: string, phaseId: string, projectId: string, revision: number): void {
        const index = this.inspector.gateIndex;
        const gate = roadmapSelectableGate(index, projectId, revision, phaseId, id);
        if (!gate || !this.projection?.nodes.some(node => node.id === phaseId) ||
            this.projection.projectId !== projectId || this.projection.revision !== revision) return;
        if (id !== this.selectedId && (this.inspector.dirty || this.inspector.requiresApproval)) {
            this.status.textContent = 'A Roadmap edit or approval is pending. Finish it before selecting another Gate.';
            this.setInspectionOpen(true);
            return;
        }
        this.selectedId = id;
        this.selectedEdgeId = undefined;
        this.relationshipSummary.hidden = true;
        this.promptWindow = undefined;
        this.inspector.select(id);
        this.setInspectionView('compact');
        this.setInspectionOpen(true);
        this.render();
    }

    private revealFocusedCard(id: string, position: { x: number; y: number }, card: HTMLButtonElement): void {
        if (!this.flow || !this.projection?.nodes.some(node => node.id === id)) return;
        const camera = roadmapKeyboardCamera(position, this.stage.clientWidth, this.stage.clientHeight,
            this.flow.getViewport(), card.offsetWidth, card.offsetHeight);
        if (camera) this.intentionalCamera(flow => flow.setViewport(camera, {
            duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 160 }));
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
                this.intentionalCamera(flow => flow.setViewport({ ...view, x: view.x - dx, y: view.y - dy }));
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
        const positions = this.projection ? roadmapSpatialLayout({ ...this.projection,
            ...roadmapVisibleGraph(this.projection, this.detail, this.selectedId, this.expanded, this.collapsed, 96, this.promptWindow) }) :
            new Map<string, { x: number; y: number }>();
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
        this.stageResize.disconnect();
        window.removeEventListener('focus', this.focusRecheck);
        void this.service.observeLinkedDocument(undefined).catch(() => undefined); this.rootsListener.dispose(); this.modelListener();
        this.inspectionEditor.dispose(); super.dispose(); }
}
