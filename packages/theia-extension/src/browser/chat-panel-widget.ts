import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { ApplicationShell, type StatefulWidget } from '@theia/core/lib/browser';
import { SingleTextInputDialog } from '@theia/core/lib/browser/dialogs';
import { Emitter, type Event } from '@theia/core/lib/common';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { ConnectionStatus, type ConnectionStatusService } from '@theia/core/lib/browser/connection-status-service';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import type { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import type { ChatOperation } from '@dope/chat/lib/service';
import { CHAT_COLORS, type ChatSettings, type ChatContextKind, type ChatModelSelection, type ChatAssistantMessage } from '@dope/chat';
import type { ChatContextSelection, ChatStrategicDraftReview, ChatEvent } from '@dope/chat/lib/service';
import { SoftwareMapController } from './software-map-controller';
import type { ModelConnectionsService, ModelConnectionsSnapshot } from '@dope/contracts/lib/model-connections-service';
import { AICenterContribution } from './ai-center-contribution';
import { ChatOpenOwners, ChatPanelController, chatTree, readOnlyPrompt } from './chat-panel-controller';
import type { ChatConnection, ChatTree } from './chat-panel-controller';
import { ChatScrollFollow, ChatTranscriptDrag, animateChatToLatest, canDragChatTranscript, chatResponseCopyText, chatTranscriptCopyText, chatLauncherIds, workLauncherIds, chatPanelWidgetId, panelModule, planningActivityPresentation, planningOutcome, implementationPlanAnswer, isDraftPlanningAction, resizeChatInput, resolveChatModel, shouldSendChatInput, type ChatPanelOptions } from './chat-panel-presentation';
import { renderUntrustedMessageMarkdown } from './untrusted-message-markdown';
import { readSharedPanelLayout, SharedPanelState, WorkOpenOwners } from './shared-panel-state';
import type { WorkSelection } from './shared-panel-state';
import { WorkSelectionController, workManualGateReady, workReviewCanAccept, workReviewState, workRows, workRunOverview, workTitle } from './work-selection-controller';
import { WorkSelectionNavigator } from './work-selection-navigator';
import { restoreWorkScroll, workDisclosureKeydown } from './work-transcript-presentation';
import { formatRunElapsed, formatRunElapsedCompact } from './run-elapsed';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import type { AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import type { AIRolePolicyService } from '@dope/contracts/lib/ai-role-policy-service';
import { createDefaultExecutionGrant, EFFECT_KINDS } from '@dope/agent-core';
import { AgentRunController } from './agent-run-controller';
import type { HistoryFocusTarget } from '@dope/contracts/lib/history';
import { panelFocusTarget } from './history-focus-target';
import type { ChatPlanningSelection, PlanningSelection } from './chat-planning-selection';

function copyChatText(text: string): Promise<void> {
    // Keep the copy command inside the click gesture. Some desktop browser
    // contexts expose Clipboard.writeText but reject it for an embedded editor.
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
    const selection = window.getSelection();
    const ranges = selection ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index)) : [];
    const input = document.createElement('textarea');
    input.value = text;
    input.setAttribute('aria-hidden', 'true');
    input.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0';
    document.body.append(input);
    input.focus(); input.select();
    const copied = document.execCommand('copy');
    input.remove();
    previousFocus?.focus();
    if (selection) { selection.removeAllRanges(); for (const range of ranges) selection.addRange(range); }
    return copied ? Promise.resolve() :
        navigator.clipboard?.writeText(text) ?? Promise.reject(new Error('Clipboard unavailable'));
}

export class ChatPanelWidget extends BaseWidget implements StatefulWidget {
    private static readonly toolbarChanged = new Emitter<void>();
    static readonly onDidChangeToolbar = ChatPanelWidget.toolbarChanged.event;
    readonly controller: ChatPanelController;
    readonly panel: SharedPanelState;
    readonly workController?: WorkSelectionController;
    readonly directController?: AgentRunController;
    private composingWork = false;
    private toolbarState = '';
    get canBackToChats(): boolean { return this.panel.mode === 'chat' && this.controller.mode === 'chat'; }
    backToChats(): void { if (this.canBackToChats) this.controller.select(undefined); }
    get canCopyTranscript(): boolean { return this.canBackToChats && !!this.controller.chat?.messages.length; }
    get canOpenChatSettings(): boolean { return this.canBackToChats && !!this.controller.chat; }
    async copyWholeTranscript(): Promise<void> {
        const chat = this.controller.chat;
        if (!this.canCopyTranscript || !chat) return;
        try {
            await copyChatText(chatTranscriptCopyText(chat, this.controller.stream,
                this.controller.transientUser?.chatId === chat.id ? this.controller.transientUser : undefined));
        } catch { this.status.textContent = 'Could not copy the transcript.'; }
    }
    toggleChatSettings(): void {
        const chat = this.controller.chat;
        if (!this.canOpenChatSettings || !chat) return;
        this.settingsOpen = !this.settingsOpen;
        this.revealSettings = this.settingsOpen;
        this.settingsDraft = this.settingsOpen ? structuredClone(chat.settings) : undefined;
        this.settingsChatId = chat.id;
        this.render();
    }
    private strategicPresentationKey = '';
    private strategicPresentationTarget?: { workspace: string; projectId: string; chatId: string };
    private strategicPresentationQueue: Promise<void> = Promise.resolve();
    private readonly openPlanningActivities = new Set<string>();
    private readonly openToolActivities = new Set<string>();
    private promptStacksOnly = false;
    private lastWorkSelection?: WorkSelection;
    private readonly rootsListener;
    private readonly connectionListener;
    private readonly modelsListener;
    private readonly planningListener;
    private readonly status = document.createElement('p');
    private module: 'chat' | 'work';
    get moduleKind(): 'chat' | 'work' { return this.module; }
    historyFocusTarget(projectUri?: string): HistoryFocusTarget | undefined {
        return panelFocusTarget({ module: this.module, projectUri, panelWorkspace: this.panel.workspace,
            chatWorkspace: this.controller.workspace, chatId: this.controller.chatId,
            workProject: this.workController?.project, work: this.panel.work });
    }
    private readonly content = document.createElement('div');
    private workspaceRequest = 0;
    private initialAttach: Promise<void> = Promise.resolve();
    private workReconnect?: Promise<void>;
    private backendOffline = false;
    private workspaceAttachFailed = false;
    private workspaceRootCount?: number;
    private workAttachmentError = false;
    private workAttachTimer?: ReturnType<typeof setTimeout>;
    private reconnectProbe?: ReturnType<typeof setInterval>;
    private elapsedTicker?: ReturnType<typeof setInterval>;
    private probingBackend = false;
    private workNavigator?: WorkSelectionNavigator;
    private modelsRequest = 0;
    private models: ModelConnectionsSnapshot = { connections: [] };
    private settingsOpen = false;
    private revealSettings = false;
    private settingsDraft?: ChatSettings;
    private settingsChatId?: string;
    private titleEditingChatId?: string;
    private titleDraft = '';
    private readonly scrollFollow = new ChatScrollFollow();
    private readonly transcriptDrag = new ChatTranscriptDrag();
    private readonly workFollow = new ChatScrollFollow();
    private readonly workDrag = new ChatTranscriptDrag();
    private workPointerId?: number;
    private workScrollKey?: string;
    private workSelectionChanged = false;
    private workScrollTop = 0;
    private cancelWorkAnimation?: () => void;
    private workAnimationUntil = 0;
    private dragPointerId?: number;
    private dragChatId?: string;
    private spacePanPressed = false;
    private cancelScrollAnimation?: () => void;
    private scrollAnimationUntil = 0;

    constructor(connect: () => ChatConnection, private readonly workspaces: WorkspaceService,
        private readonly shell: ApplicationShell, owners: ChatOpenOwners, workOwners: WorkOpenOwners,
        private readonly options: ChatPanelOptions,
        private readonly markdown: MarkdownRenderer,
        private readonly modelConnections?: ModelConnectionsService,
        private readonly editors?: EditorManager, private readonly map?: SoftwareMapController,
        private readonly aiCenter?: AICenterContribution, onModelsChanged?: Event<void>,
        runtime?: AgentRuntimeService, registry?: AIRegistryService, roles?: AIRolePolicyService,
        private readonly openTranscript?: (project: string, runId: string) => Promise<void>,
        private readonly planningSelection?: ChatPlanningSelection,
        private readonly openPromptSource?: (project: string, path: string, promptText: string,
            isCurrent: () => boolean) => Promise<void>,
        connectionStatus?: ConnectionStatusService,
        private readonly openRoadmapDraft?: (projectUri: string, projectId: string, chatId: string,
            revision: number) => Promise<void>,
        private readonly presentStrategicRoadmap?: (projectUri: string, projectId: string, chatId: string,
            state: { stage?: Extract<ChatEvent, { kind: 'planning-progress' }>['stage'];
                review?: ChatStrategicDraftReview; error?: string; clear?: boolean; busy?: boolean },
            decide: (approve: boolean) => Promise<void>, open: boolean) => Promise<void>) {
        super();
        this.module = panelModule(options);
        this.id = chatPanelWidgetId(options);
        this.title.label = this.title.caption = this.id === workLauncherIds.left || this.id === workLauncherIds.right ?
            'Work' : 'Chat';
        this.title.iconClass = this.id === workLauncherIds.left || this.id === workLauncherIds.right ?
            codicon('tools') : codicon('comment-discussion');
        this.title.closable = this.id !== chatLauncherIds.left && this.id !== chatLauncherIds.right &&
            this.id !== workLauncherIds.left && this.id !== workLauncherIds.right;
        this.addClass('dope-chat-panel');
        this.controller = new ChatPanelController(connect, () => { this.render(); this.syncStrategicRoadmap(); }, owners, this.id,
            () => { void this.shell.activateWidget(this.id); }, planningSelection);
        this.panel = new SharedPanelState(workOwners, this.id,
            () => { this.panel.setMode('work'); void this.shell.activateWidget(this.id); }, () => this.render());
        this.panel.mode = this.module;
        if (runtime && registry && roles) this.directController = new AgentRunController(runtime, registry, roles, () => this.render());
        if (runtime) this.workController = new WorkSelectionController(runtime, () => this.render(),
            policy => this.directController!.resolvePolicyTarget(policy));
        if (this.workController) this.workNavigator = new WorkSelectionNavigator(this.panel, this.workController);
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.node.append(this.status, this.content);
        document.addEventListener('keydown', this.spacePanKeyDown);
        document.addEventListener('keyup', this.spacePanKeyUp);
        window.addEventListener('blur', this.spacePanBlur);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { this.initialAttach = this.attach(); });
        this.backendOffline = connectionStatus?.currentStatus === ConnectionStatus.OFFLINE;
        this.connectionListener = connectionStatus?.onStatusChange(status => {
            this.backendOffline = status === ConnectionStatus.OFFLINE;
            if (this.backendOffline) this.startReconnectProbe();
            else this.stopReconnectProbe();
            if (this.module !== 'work') { this.render(); return; }
            if (!this.panel.workspace && !this.workspaceAttachFailed) { this.render(); return; }
            if (this.backendOffline) this.render();
            else void this.retryWorkConnection();
        });
        if (this.backendOffline) this.startReconnectProbe();
        this.modelsListener = onModelsChanged?.(() => { if (this.module === 'chat') void this.loadModels();
            void this.directController?.resolveTarget();
            void this.workController?.phase.refresh();
            if (this.panel.work?.kind === 'task') void this.workController?.select(this.panel.work); });
        this.planningListener = planningSelection?.onChange(() => this.updatePlanningLabel());
        this.initialAttach = this.attach();
        if (this.module === 'chat') void this.loadModels();
    }

    private syncStrategicRoadmap(): void {
        if (!this.presentStrategicRoadmap || this.module !== 'chat') return;
        const state = this.controller;
        const workspace = state.workspace, chatId = state.chatId;
        const projectId = state.strategicDraftReview?.projectId ?? state.roadmapGenerationProjectId;
        if (workspace && chatId && projectId && (state.roadmapGenerationStage || state.strategicDraftReview)) {
            const previous = this.strategicPresentationTarget;
            const open = !previous || previous.workspace !== workspace || previous.chatId !== chatId ||
                previous.projectId !== projectId;
            this.strategicPresentationTarget = { workspace, chatId, projectId };
            const key = `${workspace}:${chatId}:${state.roadmapGenerationStage ?? ''}:${state.strategicDraftReview?.token ?? ''}:${state.pending}`;
            if (key === this.strategicPresentationKey) return;
            this.strategicPresentationKey = key;
            const payload = { stage: state.roadmapGenerationStage, review: state.strategicDraftReview, busy: state.pending };
            this.strategicPresentationQueue = this.strategicPresentationQueue.then(() =>
                this.presentStrategicRoadmap!(workspace, projectId, chatId, payload,
                    approve => state.strategicDraftReview ? state.decideStrategicDraft(approve) : state.cancel(), open))
                .catch(() => { state.error = 'Roadmap editor unavailable. Open Roadmap to retry.';
                    this.render(); });
            return;
        }
        const target = this.strategicPresentationTarget;
        if (!target) return;
        if (state.pending) return;
        this.strategicPresentationTarget = undefined;
        this.strategicPresentationKey = '';
        const acceptedMessage = state.chat?.messages.find(message => message.role === 'assistant' &&
            message.roadmapAction?.status === 'accepted' && message.roadmapAction.projectId === target.projectId);
        const accepted = acceptedMessage?.role === 'assistant' ? acceptedMessage.roadmapAction : undefined;
        const error = state.error || undefined;
        this.strategicPresentationQueue = this.strategicPresentationQueue.then(async () => {
            if (accepted?.draftRevision !== undefined && accepted.chatId === target.chatId)
                await this.openRoadmapDraft?.(target.workspace, accepted.projectId, accepted.chatId, accepted.draftRevision);
            else await this.presentStrategicRoadmap!(target.workspace, target.projectId, target.chatId,
                error ? { error } : { clear: true }, async () => {}, false);
        }).catch(() => {});
    }
    private roadmapActionCard(message: ChatAssistantMessage): HTMLElement | undefined {
        const action = message.roadmapAction, state = this.controller;
        if (!action || action.chatId !== state.chatId || !state.workspace ||
            action.sourceMessageId !== undefined && action.sourceMessageId !== message.id) return undefined;
        const liveOffer = state.roadmapOffer?.id === action.offerId &&
            state.roadmapOffer.messageId === message.id && state.roadmapOffer.projectId === action.projectId &&
            Date.now() < state.roadmapOffer.expiresAt ? state.roadmapOffer : undefined;
        const liveReview = action.status === 'ready' && !!state.strategicDraftReview &&
            state.strategicDraftReview.projectId === action.projectId;
        const card = document.createElement('section');
        card.className = 'dope-chat-roadmap-offer';
        card.setAttribute('aria-label', 'Roadmap action');
        const heading = document.createElement('strong');
        const note = document.createElement('p'); note.setAttribute('role', 'status');
        const actions = document.createElement('div'); actions.className = 'dope-chat-roadmap-offer-actions';
        const status = action.status === 'offered' && state.activeRoadmapOfferId === action.offerId &&
            state.roadmapGenerationStage ? 'generating' : action.status;
        if (status === 'offered' && liveOffer) {
            heading.textContent = 'Create Roadmap Draft';
            note.textContent = 'Generate a provisional strategic Roadmap from this discussion. Review it in the Roadmap editor before accepting.';
            const generate = this.button('Generate Draft Roadmap', () => void state.decideRoadmapOffer(true, this.selectedModel()),
                state.pending || state.running);
            generate.className = 'dope-chat-roadmap-offer-primary';
            actions.append(generate, this.button('Not now', () => void state.decideRoadmapOffer(false),
                state.pending || state.running));
        } else if (status === 'generating') {
            heading.textContent = 'Preparing Roadmap Draft';
            const stage = state.roadmapGenerationStage ?? action.stage;
            note.textContent = stage === 'checking-owner' ? 'Checking Roadmap…' :
                stage === 'generating-draft' ? 'Optional model expansion…' :
                stage === 'validating-draft' ? 'Extracting saved plan…' :
                stage === 'preparing-draft' ? 'Validating preview…' :
                'Checking draft state…';
            actions.append(this.button('Cancel generation', () => void state.cancel()));
        } else if (status === 'ready' && liveReview) {
            heading.textContent = 'Roadmap Ready for Review';
            note.textContent = action.diagnostic ?? 'Review the proposed phases in the Roadmap editor.';
            actions.append(this.button('Open Roadmap', () => {
                const review = state.strategicDraftReview, workspace = state.workspace, chatId = state.chatId;
                if (review && workspace && chatId && review.projectId === action.projectId)
                    void this.presentStrategicRoadmap?.(workspace, action.projectId, chatId,
                        { review }, approve => state.decideStrategicDraft(approve), true);
            }));
        } else if (status === 'accepted') {
            heading.textContent = 'Roadmap Draft Accepted';
            note.textContent = 'Accepted draft · not yet published. Canonical Markdown still requires separate approval.';
            if (action.draftRevision !== undefined) actions.append(this.button('Open Roadmap', () => {
                const workspace = state.workspace, chatId = state.chatId;
                if (workspace && chatId === action.chatId)
                    void this.openRoadmapDraft?.(workspace, action.projectId, chatId, action.draftRevision!);
            }));
        } else {
            heading.textContent = status === 'rejected' ? 'Roadmap Draft Rejected' :
                status === 'declined' ? 'Roadmap Creation Declined' :
                status === 'failed' ? 'Roadmap Generation Failed' :
                status === 'cancelled' ? 'Roadmap Generation Canceled' :
                status === 'stale' ? 'Roadmap Action Stale' :
                status === 'ready' ? 'Roadmap Review No Longer Available' : 'Roadmap Offer No Longer Available';
            note.textContent = status === 'stale' ?
                'The offer or review session ended. Ask Chat for a new phase outline to continue.' :
                action.diagnostic ?? (status === 'ready' ?
                'The review session ended. Request a new draft to continue.' :
                status === 'offered' ? 'Request a new offer to generate a draft.' :
                status === 'declined' ? 'You chose not to prepare this Roadmap draft.' :
                status === 'rejected' ? 'The proposed draft was rejected. No Roadmap was created.' :
                status === 'cancelled' ? 'Draft preparation was canceled.' : 'No active Roadmap action.');
        }
        card.append(heading, note);
        if (actions.childElementCount) card.append(actions);
        return card;
    }
    private commandApprovalCard(): HTMLElement | undefined {
        const state = this.controller;
        const pending = state.pendingCommand;
        if (!pending) return undefined;
        const card = document.createElement('section');
        card.className = 'dope-chat-command-preview';
        card.setAttribute('aria-label', 'Pending command approval');
        const heading = document.createElement('strong'); heading.textContent = 'Command approval';
        const exact = document.createElement('pre'); exact.textContent = pending.command;
        const scope = document.createElement('p');
        scope.textContent = `Project: ${pending.project} · Cwd: ${pending.cwd} · Sandbox: ${pending.sandbox} · Effect: ${pending.effect}`;
        const actions = document.createElement('div'); actions.className = 'dope-chat-roadmap-offer-actions';
        actions.append(this.button('Allow once', () => void state.decideCommand(true)),
            this.button('Deny', () => void state.decideCommand(false)));
        card.append(heading, exact, scope, actions);
        return card;
    }
    private scrollToLatest(): void {
        const scroll = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
        if (!scroll) return;
        this.scrollFollow.jump();
        this.cancelScrollAnimation?.();
        this.scrollAnimationUntil = performance.now() + 200;
        this.animateLatest(scroll);
    }
    private updatePlanningLabel(): void {
        const state = this.controller;
        const active = state.activePlanning;
        const label = this.content.querySelector<HTMLElement>('.dope-chat-planning-context');
        if (label) {
            label.hidden = !active;
            label.textContent = active ? `${state.planningMode === 'pin' ? 'Pinned' : 'Following active selection'}: ` +
                `${active.kind === 'roadmap-checkpoint' ? 'checkpoint' : active.kind === 'roadmap' ? 'Roadmap' : 'Planning Map'} ${active.id}` : '';
        }
        const pin = this.content.querySelector<HTMLButtonElement>('.dope-chat-pin-planning');
        if (pin) pin.disabled = !state.workspace || !this.planningSelection?.current(state.workspace);
    }
    private animateLatest(scroll: HTMLElement): void {
        const remaining = Math.max(0, this.scrollAnimationUntil - performance.now());
        this.cancelScrollAnimation = animateChatToLatest(scroll,
            window.matchMedia('(prefers-reduced-motion: reduce)').matches, requestAnimationFrame, remaining);
    }
    private readonly moveTranscriptDrag = (event: PointerEvent): void => {
        if (event.pointerId !== this.dragPointerId) return;
        const scroll = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
        if (!scroll || this.controller.chatId !== this.dragChatId) { this.endTranscriptDrag(); return; }
        const top = this.transcriptDrag.move(event.clientY, event.clientX, event.pointerType === 'touch');
        if (top === undefined) return;
        if (!scroll.hasPointerCapture(event.pointerId)) scroll.setPointerCapture(event.pointerId);
        this.cancelScrollAnimation?.(); this.scrollAnimationUntil = 0;
        scroll.classList.add('dope-chat-scroll-dragging');
        window.getSelection()?.removeAllRanges();
        scroll.scrollTop = top;
        this.scrollFollow.scrolled(scroll.scrollTop, scroll.scrollHeight, scroll.clientHeight);
        event.preventDefault();
    };
    private readonly endTranscriptPointer = (event: PointerEvent): void => {
        if (event.pointerId !== this.dragPointerId) return;
        const dragged = this.endTranscriptDrag();
        if (event.type !== 'pointerup' || !dragged) return;
        const suppressClick = (click: MouseEvent) => {
            click.preventDefault(); click.stopPropagation();
            document.removeEventListener('click', suppressClick, true);
        };
        document.addEventListener('click', suppressClick, true);
        setTimeout(() => document.removeEventListener('click', suppressClick, true), 0);
    };
    private endTranscriptDrag(): boolean {
        const dragged = this.transcriptDrag.end();
        const scroll = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
        if (this.dragPointerId !== undefined && scroll?.hasPointerCapture(this.dragPointerId))
            scroll.releasePointerCapture(this.dragPointerId);
        scroll?.classList.remove('dope-chat-scroll-dragging', 'dope-chat-scroll-panning');
        this.dragPointerId = undefined; this.dragChatId = undefined;
        document.removeEventListener('pointermove', this.moveTranscriptDrag);
        document.removeEventListener('pointerup', this.endTranscriptPointer);
        document.removeEventListener('pointercancel', this.endTranscriptPointer);
        return dragged;
    }
    private readonly spacePanKeyDown = (event: KeyboardEvent): void => {
        if (event.code === 'Space' && !event.repeat &&
            !(event.target instanceof Element && event.target.closest('input, textarea, select, button, [contenteditable]')))
            this.spacePanPressed = true;
    };
    private readonly spacePanKeyUp = (event: KeyboardEvent): void => {
        if (event.code === 'Space') this.spacePanPressed = false;
    };
    private readonly spacePanBlur = (): void => { this.spacePanPressed = false; };

    storeState(): object {
        return { ...this.panel.layout(this.module === 'chat' ? this.controller.chatId : undefined),
            planningContext: this.controller.planningMode === 'pin' ? this.controller.pinnedPlanning : undefined,
            module: this.module, area: this.shell.getAreaFor(this) };
    }
    restoreState(state: object): void {
        const layout = readSharedPanelLayout(state);
        if (!layout?.workspace) return;
        this.module = panelModule(this.options, layout);
        if (this.module === 'work' && this.backendOffline) this.startReconnectProbe();
        layout.panelMode = this.module;
        this.panel.restore(layout);
        if (this.module === 'chat') this.controller.restore(layout.workspace, layout.chatId ? 'chat' : 'select-chat', layout.chatId);
        const pin = (state as { planningContext?: PlanningSelection }).planningContext;
        if (this.module === 'chat' && pin) this.controller.restorePlanning('pin', pin, layout.workspace);
        if (this.module === 'work') void this.initialAttach.then(() => this.restoreWorkSelection());
    }

    private async restoreWorkSelection(): Promise<void> {
        const request = this.workspaceRequest;
        const workspace = this.panel.workspace;
        const selection = this.panel.work;
        const controller = this.workController;
        if (!workspace || !selection || !controller || controller.project !== workspace || !controller.handle) return;
        const canonical = await controller.select(selection, true);
        if (request !== this.workspaceRequest || this.isDisposed || this.panel.workspace !== workspace ||
            controller.project !== workspace || this.panel.work?.kind !== selection.kind ||
            this.panel.work.id !== selection.id) return;
        if (canonical && (canonical.kind !== selection.kind || canonical.id !== selection.id))
            this.panel.selectWork(canonical);
        this.render();
    }

    private async attach(): Promise<void> {
        const request = ++this.workspaceRequest;
        this.workspaceAttachFailed = false;
        this.workspaceRootCount = undefined;
        this.workAttachmentError = false;
        if (this.workAttachTimer) clearTimeout(this.workAttachTimer);
        const previous = this.panel.layout();
        this.composingWork = false;
        this.lastWorkSelection = undefined;
        // Invalidate the old project immediately while workspace roots resolve.
        this.panel.attach(undefined);
        if (previous.workspace) this.panel.restore(previous);
        await this.workController?.attach(undefined);
        await this.directController?.attach(undefined);
        await this.controller.attach(undefined);
        let timer: ReturnType<typeof setTimeout> | undefined;
        let roots: Awaited<WorkspaceService['roots']>;
        try {
            roots = await Promise.race([this.workspaces.roots, new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('workspace-timeout')), 10000);
            })]);
        } catch {
            if (!this.isDisposed && request === this.workspaceRequest) {
                this.workspaceAttachFailed = true;
                this.render();
            }
            return;
        } finally { if (timer) clearTimeout(timer); }
        if (this.isDisposed || request !== this.workspaceRequest) return;
        this.workspaceRootCount = roots.length;
        const workspace = roots.length === 1 ? roots[0].resource.toString() : undefined;
        this.panel.attach(workspace);
        this.panel.setMode(this.module);
        const workAttached = this.workController?.attach(workspace);
        if (workspace && this.module === 'work') {
            this.workAttachTimer = setTimeout(() => {
                if (!this.isDisposed && request === this.workspaceRequest &&
                    this.workController?.attachState === 'loading') {
                    this.workAttachmentError = true;
                    this.render();
                }
            }, 15000);
            void workAttached?.then(() => {
                if (request === this.workspaceRequest && this.workAttachTimer) {
                    clearTimeout(this.workAttachTimer);
                    this.workAttachTimer = undefined;
                }
            }, () => {
                if (request === this.workspaceRequest && this.workAttachTimer) {
                    clearTimeout(this.workAttachTimer);
                    this.workAttachTimer = undefined;
                }
            });
        }
        void this.directController?.attach(workspace);
        void workAttached?.then(() => {
            if (!this.isDisposed && request === this.workspaceRequest && this.workController?.handle) {
                this.workAttachmentError = false;
                void this.restoreWorkSelection();
            }
        });
        if (this.module === 'chat') await this.controller.attach(workspace);
        else await workAttached;
    }

    /** Reuse this panel and its saved owner; never start or approve Work during recovery. */
    private retryWorkConnection(): Promise<void> {
        if (this.backendOffline) return this.probeBackend(true);
        if (this.workReconnect) return this.workReconnect;
        if (!this.panel.workspace && this.workspaceAttachFailed && !this.backendOffline) {
            this.initialAttach = this.attach();
            return this.initialAttach;
        }
        const project = this.panel.workspace;
        const request = this.workspaceRequest;
        if (!project || !this.workController || this.backendOffline) return Promise.resolve();
        this.workAttachmentError = false;
        this.render();
        const attempt = (async () => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                await Promise.race([this.workController!.attach(project), new Promise<never>((_, reject) => {
                    timer = setTimeout(() => reject(new Error('work-reattach-timeout')), 15000);
                })]);
            } catch {
                if (!this.isDisposed && request === this.workspaceRequest && this.panel.workspace === project) {
                    void this.workController!.attach(undefined);
                    this.workAttachmentError = true;
                    this.render();
                }
                return;
            } finally { if (timer) clearTimeout(timer); }
            if (this.isDisposed || request !== this.workspaceRequest || this.panel.workspace !== project ||
                this.workController?.project !== project || !this.workController.handle) return;
            await this.restoreWorkSelection();
        })();
        this.workReconnect = attempt.finally(() => {
            if (this.workReconnect === done) this.workReconnect = undefined;
        });
        const done = this.workReconnect;
        return done;
    }
    private startReconnectProbe(): void {
        if (this.reconnectProbe || this.module !== 'work') return;
        this.reconnectProbe = setInterval(() => { void this.probeBackend(); }, 3000);
    }
    private stopReconnectProbe(): void {
        if (this.reconnectProbe) clearInterval(this.reconnectProbe);
        this.reconnectProbe = undefined;
    }
    private async probeBackend(manual = false): Promise<void> {
        if (!this.backendOffline || this.probingBackend || this.isDisposed ||
            !this.panel.workspace && !this.workspaceAttachFailed) return;
        this.probingBackend = true;
        try {
            // A restarted backend can answer HTTP while Theia's old socket remains
            // offline. Reload this same tab to negotiate a fresh backend channel;
            // StatefulWidget restores its saved Work owner without execution.
            const response = await fetch(window.location.origin + '/', {
                method: 'HEAD', cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(2500)
            });
            if (response.ok && this.backendOffline && !this.isDisposed) {
                const key = 'dope.work.reconnect-reload';
                const last = Number(window.sessionStorage.getItem(key) || 0);
                if (manual || Date.now() - last > 30000) {
                    window.sessionStorage.setItem(key, String(Date.now()));
                    window.location.reload();
                }
            }
        } catch { /* Keep the visible disconnected state until the service returns. */ }
        finally { this.probingBackend = false; }
    }

    async selectChatLauncher(): Promise<void> {
        if (this.module !== 'chat') return;
        this.panel.setMode('chat');
        await this.controller.select(undefined);
    }
    async navigateChat(chatId: string, workspace: string): Promise<boolean> {
        await this.initialAttach;
        if (this.isDisposed || this.module !== 'chat' || this.panel.workspace !== workspace ||
            this.controller.workspace !== workspace || !this.controller.attached) return false;
        await this.controller.refresh();
        if (this.isDisposed || this.panel.workspace !== workspace || this.controller.workspace !== workspace ||
            !this.controller.snapshot?.chats.some(chat => chat.id === chatId)) return false;
        return await this.controller.select(chatId) && this.panel.workspace === workspace &&
            this.controller.workspace === workspace && this.controller.chatId === chatId;
    }
    async selectWorkLauncher(selection?: WorkSelection, navigationOnly = false): Promise<void> {
        this.composingWork = false;
        this.promptStacksOnly = false;
        if (this.module !== 'work') return;
        this.panel.setMode('work');
        if (selection) await this.selectWork(selection, navigationOnly);
        else this.render();
        if (!navigationOnly) await this.refreshWork();
    }
    /** Exact owner navigation; never starts a task or changes the Chat conversation. */
    async navigateWork(selection: WorkSelection, workspace: string): Promise<boolean> {
        await this.initialAttach;
        if (this.module !== 'work' || this.panel.workspace !== workspace || this.workController?.project !== workspace ||
            !this.workController.handle) return false;
        await this.selectWorkLauncher(selection, true);
        if (this.panel.workspace !== workspace || this.workController.project !== workspace ||
            !this.panel.work || this.panel.work.id !== selection.id || this.panel.work.kind !== selection.kind)
            return false;
        const exact = selection.kind === 'task' ? this.workController.selectedTask?.id === selection.id :
            selection.kind === 'run' ? this.workController.selectedRun?.id === selection.id :
                this.workController.phase.selected?.id === selection.id;
        if (!exact) this.panel.selectWork(undefined);
        return exact && this.panel.workspace === workspace && this.workController.project === workspace &&
            this.panel.work?.id === selection.id && this.panel.work.kind === selection.kind;
    }
    async selectPromptStacks(): Promise<void> {
        if (this.module !== 'work') return;
        this.panel.setMode('work');
        this.selectWork();
        this.promptStacksOnly = true;
        this.render();
    }
    async refreshWork(): Promise<void> {
        if (this.panel.mode !== 'work') return;
        await Promise.all([this.workController?.refresh(), this.directController?.refresh()]);
        if (this.panel.work) await this.workController?.select(this.panel.work);
    }

    private button(label: string, action: () => void, disabled = false): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.onclick = action;
        return button;
    }
    private async selectWork(selection?: WorkSelection, navigationOnly = false): Promise<void> {
        this.composingWork = false;
        if (selection) this.promptStacksOnly = false;
        const canonical = await this.workNavigator?.select(selection, navigationOnly);
        if (canonical) this.lastWorkSelection = canonical;
        if (!selection) await this.workController?.refresh();
    }
    private renderWorkComposer(): void {
        const controller = this.directController;
        if (!controller) return;
        const form = document.createElement('form'); form.className = 'dope-work-composer';
        const prompt = document.createElement('textarea'); prompt.maxLength = 20000;
        prompt.setAttribute('aria-label', 'Work instructions'); prompt.placeholder = 'Describe one bounded task…';
        prompt.value = controller.instructions;
        const start = this.button('Start Work', () => void submit(), !controller.canStart);
        const edit = () => { controller.edit(prompt.value.trim().split('\n')[0].slice(0, 1000), prompt.value);
            start.disabled = !controller.canStart; accept.checked = false; };
        prompt.oninput = edit;
        prompt.onkeydown = event => { if (shouldSendChatInput(event)) { event.preventDefault(); void submit(); } };
        const model = document.createElement('select'); model.setAttribute('aria-label', 'Coding Agent model');
        const follow = document.createElement('option'); follow.value = 'follow'; follow.textContent = 'Follow Coding Agent'; model.append(follow);
        for (const target of controller.exactTargets) { const option = document.createElement('option');
            option.value = `${target.connectionId}\u0000${target.modelId}`; option.textContent = target.label; model.append(option); }
        model.value = controller.policy.kind === 'exact' ? `${controller.policy.connectionId}\u0000${controller.policy.modelId}` : 'follow';
        model.onchange = () => { const target = controller.exactTargets.find(item =>
            `${item.connectionId}\u0000${item.modelId}` === model.value);
            controller.setPolicy(target ? { kind: 'exact', connectionId: target.connectionId, modelId: target.modelId } :
                { kind: 'follow-coding-agent' }); };
        const validation = document.createElement('input'); validation.type = 'text'; validation.maxLength = 160;
        validation.value = controller.validationCommand; validation.setAttribute('aria-label', 'Required validation command');
        validation.placeholder = 'Required test command before Work can start';
        validation.oninput = () => { controller.setValidation(validation.value); start.disabled = !controller.canStart; };
        const grant = createDefaultExecutionGrant({ id: 'preview', revision: 1, taskId: 'preview',
            acceptedAt: new Date().toISOString() });
        const review = document.createElement('details'); review.className = 'dope-work-diagnostics';
        const summary = document.createElement('summary');
        summary.textContent = 'Review project execution grant'; review.append(summary);
        for (const kind of EFFECT_KINDS) { const item = document.createElement('div');
            item.textContent = `${grant.permissions[kind] ? 'Allowed' : 'Denied'} · ${kind}`; review.append(item); }
        const acceptLabel = document.createElement('label'); const accept = document.createElement('input');
        accept.type = 'checkbox'; accept.checked = controller.accepted;
        accept.onchange = () => { controller.acceptGrant(accept.checked); start.disabled = !controller.canStart; };
        acceptLabel.className = 'dope-work-grant';
        acceptLabel.append(accept, ' Accept project execution grant');
        const hostedLabel = document.createElement('label'); hostedLabel.className = 'dope-work-grant';
        const hosted = document.createElement('input'); hosted.type = 'checkbox';
        hosted.checked = controller.hostedProjectDataAuthorized;
        hosted.onchange = () => { controller.authorizeHostedProjectData(hosted.checked); start.disabled = !controller.canStart; };
        hostedLabel.append(hosted, ' Authorize sending project data to the hosted Coding Agent');
        const status = document.createElement('p'); status.setAttribute('role', 'status');
        status.textContent = controller.message || controller.targetMessage;
        const submit = async () => {
            if (!controller.canStart) return;
            const run = await controller.start();
            if (run) { await this.workController?.refresh(); this.selectWork({ kind: 'run', id: run.id }); }
        };
        form.onsubmit = event => { event.preventDefault(); void submit(); };
        form.append(prompt, model, validation, acceptLabel, ...(controller.resolved?.locality === 'hosted' ? [hostedLabel] : []), review, status, start);
        this.content.append(form);
    }
    private renderWork(): void {
        const work = this.panel.work, controller = this.workController;
        const key = work && `${work.kind}:${work.id}`;
        if (key !== this.workScrollKey) {
            this.cancelWorkAnimation?.(); this.workAnimationUntil = 0;
            this.workScrollKey = key; this.workFollow.select(key); this.workSelectionChanged = true;
        }
        const header = document.createElement('header');
        const heading = document.createElement('h2');
        heading.textContent = work && controller ? workTitle(work,
            work.kind === 'run' && controller.selectedRun?.id === work.id ? controller.selectedRun : undefined,
            work.kind === 'task' && controller.selectedTask?.id === work.id ||
                work.kind === 'run' && controller.selectedRun?.id === work.id ? controller.selectedTask : undefined,
            work.kind === 'sequence' && controller.phase.selected?.id === work.id ? controller.phase.selected : undefined) : 'Select Work';
        header.append(heading);
        if (!work) header.append(this.button('New Work', () => { this.selectWork(); this.composingWork = true; this.render(); }));
        if (work) header.append(this.button('Back to Select Work', () => this.selectWork()));
        if (work) header.append(this.button('Refresh Work', () => {
            if (work.kind === 'sequence') {
                void controller?.phase.refresh(); void controller?.refresh();
            } else if (work.kind === 'task') {
                void controller?.phase.refresh().then(() => controller.select(work));
            } else void controller?.select(work);
        }));
        this.content.append(header);
        if (this.backendOffline || this.workAttachmentError) return;
        if (!controller?.handle) return;
        if (work && controller.selectionState !== 'attached') {
            const detail = document.createElement('p'); detail.setAttribute('role', 'status');
            detail.textContent = controller.selectionState === 'loading' ? 'Loading Work detail…' :
                controller.selectionState === 'not-found' ? 'Work was not found in this project.' :
                    controller.selectionState === 'unavailable' ?
                        controller.message || controller.phase.message || 'Work detail is unavailable.' :
                        'Select Work to continue.';
            this.content.append(detail);
            if (controller.selectionState === 'unavailable' || controller.selectionState === 'not-found')
                this.content.append(this.button('Retry', () => void this.restoreWorkSelection()));
            return;
        }
        if (!work && this.composingWork) { this.renderWorkComposer(); return; }
        if (controller.message || controller.phase.message) {
            const status = document.createElement('p'); status.setAttribute('role', 'status');
            status.textContent = (controller.message || controller.phase.message).replaceAll('Phase Stack', 'Prompt Stack');
            this.content.append(status);
        }
        if (!work) {
            const groups = workRows(controller.tasks, controller.runs, controller.phase.sequences);
            const rowButton = (row: (typeof groups.running)[number]): HTMLButtonElement => {
                const button = this.button('', () => this.selectWork(row.selection));
                button.className = 'dope-work-row';
                button.dataset.workKey = `${row.selection.kind}:${row.selection.id}`;
                button.dataset.status = row.status;
                button.setAttribute('aria-current', this.lastWorkSelection?.kind === row.selection.kind &&
                    this.lastWorkSelection.id === row.selection.id ? 'true' : 'false');
                const cue = document.createElement('span'); cue.className = 'dope-work-state-cue';
                cue.setAttribute('aria-hidden', 'true');
                const text = document.createElement('span'); text.className = 'dope-work-row-text';
                const title = document.createElement('span'); title.className = 'dope-work-row-title'; title.textContent = row.title;
                const meta = document.createElement('span'); meta.className = 'dope-work-row-meta';
                const time = Number.isFinite(Date.parse(row.updatedAt)) ? new Date(row.updatedAt).toLocaleString() : '';
                meta.textContent = [row.status, row.activity, time].filter(Boolean).join(' · ');
                if (row.startedAt) meta.append(' · ', this.elapsedClock(row.startedAt, row.endedAt, row.running));
                text.append(title, meta);
                if (row.stack) { const progress = document.createElement('span'); progress.className = 'dope-work-row-progress';
                    progress.textContent = row.stack; text.append(progress); }
                button.append(cue, text);
                return button;
            };
            if (!this.promptStacksOnly) for (const [heading, rows] of [['Running', groups.running],
                ['History', groups.history]] as const) {
                const section = document.createElement('section');
                const title = document.createElement('h3'); title.textContent = heading; section.append(title);
                if (heading === 'Running' && !rows.length) {
                    const empty = document.createElement('p'); empty.textContent = 'No Work currently running.';
                    section.append(empty);
                }
                if (heading === 'History' && !rows.length) {
                    const empty = document.createElement('p'); empty.textContent = 'No saved Work yet.';
                    section.append(empty);
                }
                for (const row of rows) section.append(rowButton(row));
                this.content.append(section);
            }
            const stacks = document.createElement('section');
            const label = document.createElement('h3'); label.textContent = 'Prompt Stacks'; stacks.append(label);
            const sourceNote = document.createElement('p');
            sourceNote.textContent = 'Discovered source is a preview only. Opening a stack does not approve or run it.';
            stacks.append(sourceNote);
            const root = document.createElement('input'); root.type = 'text'; root.value = controller.phase.tasksRoot;
            root.setAttribute('aria-label', 'Tasks folder');
            root.onchange = () => controller.phase.setTasksRoot(root.value);
            const scan = document.createElement('div'); scan.className = 'dope-work-stack-scan';
            scan.append(root, this.button('Refresh', () => { controller.phase.setTasksRoot(root.value); void controller.scan(); },
                controller.phase.busy));
            stacks.append(scan);
            if (!controller.phase.stacks.length && !controller.phase.busy) {
                const empty = document.createElement('p'); empty.textContent = 'No Prompt Stacks found in this folder.';
                stacks.append(empty);
            }
            for (const stack of controller.phase.stacks) {
                const button = this.button('', () => this.selectWork({ kind: 'sequence', id: stack.sequenceId ?? stack.folderName }),
                    controller.phase.busy || !stack.valid && !stack.sequenceId);
                button.className = 'dope-work-row'; button.dataset.status = stack.valid ? stack.sequenceStatus ?? 'discovered' : 'invalid';
                button.dataset.workKey = `sequence:${stack.sequenceId ?? stack.folderName}`;
                button.setAttribute('aria-current', this.lastWorkSelection?.kind === 'sequence' &&
                    this.lastWorkSelection.id === (stack.sequenceId ?? stack.folderName) ? 'true' : 'false');
                const cue = document.createElement('span'); cue.className = 'dope-work-state-cue'; cue.setAttribute('aria-hidden', 'true');
                const text = document.createElement('span'); text.className = 'dope-work-row-text';
                const title = document.createElement('span'); title.className = 'dope-work-row-title'; title.textContent = stack.folderName;
                const meta = document.createElement('span'); meta.className = 'dope-work-row-meta';
                meta.textContent = stack.valid ? stack.sequenceStatus ?? 'Discovered Prompt Stack' :
                    `${stack.sequenceStatus ? `${stack.sequenceStatus} · ` : ''}Invalid Prompt Stack`;
                text.append(title, meta); button.append(cue, text); stacks.append(button);
                if (!stack.valid) { const error = document.createElement('p'); error.textContent = stack.error ?? 'Invalid Prompt Stack.';
                    error.className = 'dope-work-warning'; stacks.append(error); }
            }
            this.content.append(stacks);
            return;
        }
        const region = document.createElement('section'); region.className = 'dope-chat-transcript-region';
        region.setAttribute('aria-label', 'Selected Work');
        const scroll = document.createElement('div'); scroll.className = 'dope-chat-scroll dope-work-scroll';
        scroll.setAttribute('role', 'log'); scroll.setAttribute('aria-label', 'Work transcript');
        scroll.addEventListener('keydown', workDisclosureKeydown);
        const latest = this.button('Latest', () => {
            this.workFollow.jump();
            this.workAnimationUntil = performance.now() + 200;
            this.cancelWorkAnimation?.();
            this.cancelWorkAnimation = animateChatToLatest(scroll,
                window.matchMedia('(prefers-reduced-motion: reduce)').matches);
            latest.hidden = true;
        });
        latest.className = 'dope-chat-latest dope-work-latest';
        scroll.onscroll = () => {
            this.workScrollTop = scroll.scrollTop;
            if (performance.now() < this.workAnimationUntil) return;
            this.workFollow.scrolled(scroll.scrollTop, scroll.scrollHeight, scroll.clientHeight);
            latest.hidden = !this.workFollow.latestBelow;
        };
        scroll.onwheel = event => {
            if (event.deltaY < 0) { this.cancelWorkAnimation?.(); this.workAnimationUntil = 0; }
        };
        scroll.onpointerdown = event => {
            if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary ||
                !canDragChatTranscript(event.target as Element, this.spacePanPressed)) return;
            this.workPointerId = event.pointerId;
            this.cancelWorkAnimation?.(); this.workAnimationUntil = 0;
            this.workDrag.start(event.clientY, scroll.scrollTop, event.clientX);
            if (this.spacePanPressed) { scroll.classList.add('dope-chat-scroll-panning'); event.preventDefault(); }
        };
        scroll.onpointermove = event => {
            if (event.pointerId !== this.workPointerId) return;
            const top = this.workDrag.move(event.clientY, event.clientX, event.pointerType === 'touch');
            if (top === undefined) return;
            if (!scroll.hasPointerCapture(event.pointerId)) scroll.setPointerCapture(event.pointerId);
            scroll.classList.add('dope-chat-scroll-dragging');
            scroll.scrollTop = top;
        };
        scroll.onpointerup = scroll.onpointercancel = event => {
            if (event.pointerId !== this.workPointerId) return;
            if (scroll.hasPointerCapture(event.pointerId)) scroll.releasePointerCapture(event.pointerId);
            this.workPointerId = undefined; this.workDrag.end();
            scroll.classList.remove('dope-chat-scroll-dragging', 'dope-chat-scroll-panning');
        };
        region.append(scroll, latest);
        const detail = (text: string, className = 'dope-work-detail') => {
            const paragraph = document.createElement('p'); paragraph.className = className;
            paragraph.textContent = text; scroll.append(paragraph);
        };
        const view = controller.view(work);
        const overview = document.createElement('p');
        overview.className = 'dope-work-overview';
        overview.setAttribute('role', 'status');
        overview.setAttribute('aria-live', 'polite');
        overview.textContent = `${view.origin === 'prompt-stack' ? 'Prompt Stack' : view.origin === 'work-item' ? 'WorkItem' : 'Direct Work'} · ${view.status}`;
        scroll.append(overview);
        const displayedRun = work.kind === 'sequence' ? controller.phase.run :
            work.kind === 'run' ? controller.selectedRun : undefined;
        if (displayedRun?.startedAt) scroll.append(this.elapsedClock(displayedRun.startedAt,
            displayedRun.endedAt, displayedRun.status === 'running'));
        const decision = document.createElement('section'); decision.className = 'dope-work-start';
        decision.setAttribute('aria-label', 'Next Work action');
        const decisionTitle = document.createElement('h3'); decisionTitle.textContent = 'Next action'; decision.append(decisionTitle);
        const decisionText = document.createElement('p'); decisionText.className = 'dope-work-next';
        decisionText.textContent = work.kind === 'task' && view.origin === 'direct' ?
            'This saved direct task has no Start control here. Use New Work to review a fresh execution grant.' : view.next;
        decision.append(decisionText);
        const primary = (label: string, action: () => void, enabled: boolean): HTMLButtonElement => {
            const button = this.button(label, action, !enabled);
            if (enabled && !decision.querySelector('.dope-work-primary')) button.className = 'dope-work-primary';
            if (!enabled) button.title = view.gateMessage || view.next;
            decision.append(button);
            return button;
        };
        const support = (label: string, action: () => void, enabled = true): HTMLButtonElement => {
            const button = this.button(label, action, !enabled);
            if (!enabled) button.title = view.gateMessage || view.next;
            decision.append(button);
            return button;
        };
        const transcriptButton = (runId: string): HTMLButtonElement => {
            const project = this.panel.workspace;
            return this.button('Open Transcript', () => {
                if (project && this.panel.workspace === project && controller.project === project &&
                    this.panel.work?.kind === work.kind && this.panel.work.id === work.id)
                    void this.openTranscript?.(project, runId);
            }, !project || controller.project !== project || !this.openTranscript);
        };
        scroll.append(decision);
        if (work.kind === 'sequence') {
            const phase = controller.phase, sequence = phase.selected?.id === work.id ? phase.selected : undefined;
            if (sequence) {
                if (view.current) detail(`P${view.current.number} of ${view.current.total} · ${view.current.execution === 'manual-gate' ?
                    'Manual verification' : 'Agent task'}`, 'dope-work-detail');
                if (view.blockedReason) detail(`Repository: ${view.blockedReason}. ${view.gateMessage ||
                    'Inspect saved evidence before continuing.'}`, 'dope-work-warning');
                const executableSteps = sequence.stack.entries.filter(item => item.execution === 'agent-task').length;
                const executableCheckpoints = sequence.checkpoints.filter(checkpoint => checkpoint.sha &&
                    sequence.stack.entries.find(entry => entry.number === checkpoint.entryNumber)?.execution === 'agent-task').length;
                const checkpointRunId = sequence.checkpoints.at(-1)?.runId;
                const checkpointRun = checkpointRunId ? controller.runs.find(item => item.id === checkpointRunId) : undefined;
                const evidenceRun = phase.run ?? checkpointRun;
                detail(`Agent: ${view.runState} · Git checkpoints: ${executableCheckpoints} of ${executableSteps} agent steps · ` +
                    `Required validation: ${view.validation} · Owner qualification: not recorded`, 'dope-work-detail');
                if (view.validation === 'unavailable' || view.validation === 'failed')
                    detail(`Required check ${view.validation === 'unavailable' ? 'did not complete' : 'failed'}: ` +
                        `${evidenceRun?.validationResults.find(result => result.reason)?.reason ?? 'inspect the saved validation and transcript.'}`,
                        'dope-work-warning');
                if (evidenceRun?.validationResults.length) {
                    const checks = document.createElement('details'); checks.className = 'dope-work-diagnostics';
                    const summary = document.createElement('summary'); summary.textContent = 'Required validation evidence'; checks.append(summary);
                    for (const result of evidenceRun.validationResults) {
                        const item = document.createElement('p'); item.textContent = `${result.label} · ${result.status}${result.reason ? ` · ${result.reason}` : ''}`;
                        checks.append(item);
                    }
                    scroll.append(checks);
                }
                if (sequence.checkpoints.length) {
                    const checkpoint = document.createElement('small'); checkpoint.className = 'dope-work-system';
                    checkpoint.textContent = `${sequence.checkpoints.length} checkpoint${sequence.checkpoints.length === 1 ? '' : 's'} recorded`;
                    scroll.append(checkpoint);
                }
                const progress = document.createElement('section'); progress.className = 'dope-work-progress';
                progress.setAttribute('aria-label', 'Authored Prompt Stack progress');
                const progressTitle = document.createElement('h3'); progressTitle.textContent = 'Authored steps'; progress.append(progressTitle);
                const entries = document.createElement('ol');
                for (const entry of sequence.stack.entries) {
                    const item = document.createElement('li');
                    const checkpoint = sequence.checkpoints.find(value => value.entryNumber === entry.number);
                    const current = entry.number === sequence.currentEntryNumber && sequence.status !== 'completed';
                    if (current) item.setAttribute('aria-current', 'step');
                    const state = checkpoint ? entry.execution === 'manual-gate' ? 'Manual verification recorded' :
                        'Checkpoint verified' : current ? view.status : 'Pending';
                    item.textContent = `P${entry.number} - ${entry.title} · ${state}${checkpoint ? ` · ${checkpoint.sha}` : ''}`;
                    const sourcePath = `${sequence.stack.sourcePath ?? `docs/tasks/${sequence.stack.folderName}`}/${entry.filename}`;
                    const source = document.createElement('small');
                    source.textContent = ` · ${entry.execution === 'manual-gate' ? 'Manual gate' : 'Agent task'}`;
                    item.append(source);
                    const sourceDetail = document.createElement('details'); sourceDetail.className = 'dope-work-diagnostics';
                    const sourceSummary = document.createElement('summary'); sourceSummary.textContent = 'Immutable prompt source';
                    const sourceText = document.createElement('code'); sourceText.textContent = sourcePath;
                    sourceDetail.append(sourceSummary, sourceText); item.append(sourceDetail);
                    const workItem = /^- Accepted WorkItem: ([^\n]+)\./mu.exec(entry.promptText)?.[1];
                    const dependencies = /^- Depends on: ([^\n]+)\./mu.exec(entry.promptText)?.[1];
                    if (workItem || dependencies) {
                        const lineage = document.createElement('small');
                        lineage.textContent = ` · ${workItem ? `WorkItem ${workItem}` : 'No WorkItem reference'} · Depends on ${dependencies ?? 'unrecorded'}`;
                        item.append(lineage);
                    }
                    const workingSet = /^Working set:\n((?:- [^\n]+\n?)*)/mu.exec(entry.promptText)?.[1]
                        .split('\n').filter(line => line.startsWith('- ')).map(line => line.slice(2)) ?? [];
                    if (workingSet.length) {
                        const files = document.createElement('small');
                        files.textContent = ` · Working set: ${workingSet.join(', ')}`;
                        item.append(files);
                    }
                    if (this.openPromptSource && this.panel.workspace) item.append(' ', this.button('Open Prompt', () => {
                        const project = this.panel.workspace;
                        if (!project || controller.phase.selected?.id !== sequence.id) return;
                        void this.openPromptSource!(project, sourcePath, entry.promptText,
                            () => this.panel.workspace === project && controller.phase.selected?.id === sequence.id).catch(error => {
                            if (this.panel.workspace !== project || controller.phase.selected?.id !== sequence.id) return;
                            controller.phase.message = error instanceof Error ? error.message : String(error);
                            this.render();
                        });
                    }));
                    if (checkpoint?.runId && this.panel.workspace) item.append(' ', transcriptButton(checkpoint.runId));
                    entries.append(item);
                }
                progress.append(entries); scroll.append(progress);
                const metadata = document.createElement('details'); metadata.className = 'dope-work-diagnostics';
                const metadataTitle = document.createElement('summary'); metadataTitle.textContent = 'Prompt Stack details';
                const metadataText = document.createElement('p');
                metadataText.textContent = `${sequence.stack.mode === 'correction' ? 'Correction' : 'Phase'} ${sequence.stack.phase} · ${sequence.stack.folderName} · Model: ${phase.resolvedTarget?.label ?? 'Coding Agent'}`;
                metadata.append(metadataTitle, metadataText); scroll.append(metadata);
                if (sequence.runIds?.length && this.panel.workspace) {
                    const previousRuns = document.createElement('details'); previousRuns.className = 'dope-work-diagnostics';
                    const previousTitle = document.createElement('summary'); previousTitle.textContent = 'Saved run transcripts';
                    previousRuns.append(previousTitle);
                    for (const runId of sequence.runIds) {
                        const run = controller.runs.find(candidate => candidate.id === runId);
                        const button = transcriptButton(runId);
                        button.textContent = `${run ? `Run · ${run.status}` : 'Saved run'} · Open Transcript`;
                        previousRuns.append(button);
                    }
                    scroll.append(previousRuns);
                }
                if (phase.run) {
                    detail(`Run: ${phase.run.status} · ${phase.run.changedFiles.length} changed files`, 'dope-work-detail');
                    detail(`Authority: ${phase.run.authorityDecision ? phase.run.authorityDecision.allowed ? 'Allowed' : 'Blocked' : 'Pending'}`,
                        phase.run.authorityDecision && !phase.run.authorityDecision.allowed ? 'dope-work-warning' : 'dope-work-detail');
                    if (phase.run.changedFiles.length) {
                        const files = document.createElement('details'); files.className = 'dope-work-diagnostics';
                        const summary = document.createElement('summary'); summary.textContent = `${phase.run.changedFiles.length} candidate changed files`;
                        const list = document.createElement('p'); list.textContent = phase.run.changedFiles.join(', ');
                        files.append(summary, list); scroll.append(files);
                    }
                }
                const entry = phase.current;
                if (entry) {
                    if (entry.execution === 'manual-gate' && sequence.status !== 'completed') {
                        const promptDetail = document.createElement('details'); promptDetail.className = 'dope-work-diagnostics';
                        const promptSummary = document.createElement('summary'); promptSummary.textContent = 'Manual gate prompt';
                        const prompt = document.createElement('pre'); prompt.textContent = entry.promptText;
                        promptDetail.append(promptSummary, prompt); scroll.append(promptDetail);
                        if (!workManualGateReady(sequence))
                            detail('Manual verification is unavailable until the repository block is resolved.', 'dope-work-warning');
                        primary('Verify manual gate', () => void phase.reconcile(), view.actions.includes('verify-manual-gate'));
                    } else if (entry.execution === 'agent-task' && sequence.status !== 'completed') {
                        const model = document.createElement('select'); model.setAttribute('aria-label', 'Coding Agent model');
                        const follow = document.createElement('option'); follow.value = 'follow';
                        follow.textContent = 'Follow Coding Agent'; model.append(follow);
                        for (const target of phase.exactTargets) { const option = document.createElement('option');
                            option.value = `${target.connectionId}\u0000${target.modelId}`;
                            option.textContent = target.label; model.append(option); }
                        model.value = phase.modelPolicy.kind === 'exact' ?
                            `${phase.modelPolicy.connectionId}\u0000${phase.modelPolicy.modelId}` : 'follow';
                        model.onchange = () => { const target = phase.exactTargets.find(item =>
                            `${item.connectionId}\u0000${item.modelId}` === model.value);
                            phase.setModelPolicy(target ? { kind: 'exact', connectionId: target.connectionId,
                                modelId: target.modelId } : { kind: 'follow-coding-agent' }); };
                        decision.append(model);
                        const validation = document.createElement('input'); validation.type = 'text';
                        validation.value = phase.validationCommand; validation.maxLength = 160;
                        validation.setAttribute('aria-label', 'Required validation command');
                        validation.oninput = () => { phase.validationCommand = validation.value; syncStart(); };
                        decision.append(validation);
                        const grant = document.createElement('label');
                        const check = document.createElement('input'); check.type = 'checkbox'; check.checked = phase.acceptedGrant;
                        check.onchange = () => { phase.acceptedGrant = check.checked; syncStart(); };
                        grant.append(check, ' Accept project execution grant'); decision.append(grant);
                        if (phase.resolvedTarget?.locality === 'hosted') {
                            const hostedLabel = document.createElement('label');
                            const hosted = document.createElement('input'); hosted.type = 'checkbox';
                            hosted.checked = phase.hostedProjectDataAuthorized;
                            hosted.onchange = () => { phase.hostedProjectDataAuthorized = hosted.checked; syncStart(); };
                            hostedLabel.append(hosted, ' Authorize sending project data to the hosted Coding Agent');
                            decision.append(hostedLabel);
                        }
                        if (phase.needsDirtyAcceptance && !phase.dirtyPromptDismissed)
                            decision.append(primary('Continue with dirty worktree', () => void phase.continueDirty(),
                                view.actions.includes('continue-dirty')),
                                support('Cancel dirty acceptance', () => phase.cancelDirty(), !phase.busy));
                        const readiness = document.createElement('p'); readiness.setAttribute('role', 'status');
                        readiness.className = phase.canStart ? 'dope-work-detail' : 'dope-work-warning';
                        readiness.textContent = phase.readinessMessage;
                        decision.append(readiness);
                        const start = primary(sequence.status === 'ready' ? 'Start' : 'Resume', () => void phase.start(), phase.canStart);
                        const syncStart = () => {
                            start.disabled = !phase.canStart;
                            readiness.textContent = phase.readinessMessage;
                            readiness.className = phase.canStart ? 'dope-work-detail' : 'dope-work-warning';
                            if (!phase.canStart) start.classList.remove('dope-work-primary');
                            else if (!decision.querySelector('.dope-work-primary')) start.classList.add('dope-work-primary');
                        };
                        if (sequence.status === 'running') primary('Stop', () => void phase.stop(), view.actions.includes('stop'));
                    }
                }
                if (sequence.blockedReason === 'checkpoint-pending' || sequence.blockedReason === 'checkpoint-failed')
                    primary('Verify checkpoint', () => void phase.checkpoint(), view.actions.includes('verify-checkpoint'));
                else if (sequence.blockedReason === 'candidate-review-pending' && phase.run?.candidateReview)
                    primary('Review candidate', () =>
                        void this.selectWork({ kind: 'run', id: phase.run!.id }), view.actions.includes('review-candidate'));
                else if (sequence.status !== 'running' && sequence.status !== 'completed')
                    primary('Reconcile repository', () => void phase.reconcile(), view.actions.includes('reconcile'));
                if (sequence.gateMessage) detail(sequence.gateMessage, 'dope-work-warning');
                const transcriptRunId = phase.run?.id ?? sequence.runIds?.at(-1) ?? sequence.checkpoints.at(-1)?.runId;
                if (transcriptRunId && this.panel.workspace) scroll.append(transcriptButton(transcriptRunId));
            } else detail('Prompt Stack could not be opened. Refresh and try again.');
        } else {
            const run = work.kind === 'run' && controller.selectedRun?.id === work.id ? controller.selectedRun : undefined;
            if (run) {
                const overview = workRunOverview(run, controller.selectedTask);
                detail(overview.state, 'dope-work-detail');
                detail(`Required validation: ${view.validation} · ${run.changedFiles.length} changed files · ` +
                    'Git checkpoint and owner qualification are separate', 'dope-work-detail');
                if (view.validation === 'unavailable' || view.validation === 'failed')
                    detail(`Required check ${view.validation === 'unavailable' ? 'did not complete' : 'failed'}: ` +
                        `${run.validationResults.find(result => result.reason)?.reason ?? 'inspect the saved validation and transcript.'}`,
                        'dope-work-warning');
                const provenance = document.createElement('details'); provenance.className = 'dope-work-diagnostics';
                const provenanceTitle = document.createElement('summary'); provenanceTitle.textContent = 'Model and provenance';
                const provenanceText = document.createElement('p');
                provenanceText.textContent = run.provenance ? `${run.provenance.providerId} · ${run.provenance.modelId}` : 'Coding Agent';
                provenance.append(provenanceTitle, provenanceText); scroll.append(provenance);
                if (run.outcome) detail(`Run outcome: ${run.outcome.summary}`, 'dope-work-detail');
                if (controller.selectedTask?.origin.kind === 'direct' && run.status === 'running')
                    primary('Stop Work', () => {
                        const project = this.panel.workspace;
                        if (!project || controller.project !== project || this.panel.work?.kind !== 'run' ||
                            this.panel.work.id !== run.id || controller.selectedTask?.id !== run.taskId || !this.directController) return;
                        void this.directController.select(run.id).then(() => {
                            if (this.panel.workspace === project && controller.project === project &&
                                this.panel.work?.kind === 'run' && this.panel.work.id === run.id &&
                                this.directController?.selected?.id === run.id) void this.directController.stop();
                        });
                    }, !!this.directController && controller.project === this.panel.workspace);
                if (this.panel.workspace) scroll.append(transcriptButton(run.id));
                if (controller.transcriptState === 'not-recorded') detail('Transcript not recorded for this historical run.');
                const diagnostics = document.createElement('details'); diagnostics.className = 'dope-work-diagnostics';
                const summary = document.createElement('summary'); summary.textContent = 'Run diagnostics'; diagnostics.append(summary);
                if (controller.selectedTask) { const instructions = document.createElement('p');
                    instructions.textContent = controller.selectedTask.instructions; diagnostics.append(instructions); }
                for (const target of controller.selectedTask?.completion.validation ?? []) {
                    const item = document.createElement('p');
                    item.textContent = `Required check · ${target.label} · ${target.command ?? 'command not recorded'}`;
                    diagnostics.append(item);
                }
                for (const path of run.changedFiles) {
                    const item = document.createElement('p'); item.textContent = `Changed · ${path}`; diagnostics.append(item);
                }
                if (run.changedFiles.length) { const status = document.createElement('small'); status.className = 'dope-work-system';
                    status.textContent = `${run.changedFiles.length} changed file${run.changedFiles.length === 1 ? '' : 's'}`; scroll.append(status); }
                for (const result of run.validationResults) {
                    const item = document.createElement('p'); item.textContent = `Candidate validation · ${result.label} · ${result.status}` +
                        `${result.reason ? ` · ${result.reason}` : ''}`;
                    diagnostics.append(item);
                    if (result.status === 'failed') { const status = document.createElement('small');
                        status.className = 'dope-work-system dope-work-warning'; status.textContent = item.textContent;
                        scroll.append(status); }
                }
                if (run.validationResults.length && !run.validationResults.some(result => result.status === 'failed')) {
                    const status = document.createElement('small'); status.className = 'dope-work-system';
                    status.textContent = `${run.validationResults.length} candidate validation result${run.validationResults.length === 1 ? '' : 's'}`;
                    scroll.append(status);
                }
                if (run.candidateReview && controller.selectedTask?.reviewPolicy?.kind === 'required') {
                    const review = run.candidateReview;
                    const state = workReviewState(run, controller.selectedTask, controller.reviewBusy);
                    const section = document.createElement('section'); section.className = 'dope-work-review';
                    const title = document.createElement('h3'); title.textContent = 'Work candidate review'; section.append(title);
                    const status = document.createElement('p'); status.setAttribute('role', 'status');
                    status.textContent = state === 'pending' ? 'Candidate held for developer review. No changes applied.' :
                        state === 'busy' ? 'Review decision in progress.' :
                        state === 'stale' ? 'Review is stale or no longer eligible. Refresh Work.' :
                        state === 'accepted' ? `Accepted · ${run.status}${run.status === 'completed' ? ' · candidate applied' : ' · inspect outcome'}` :
                        state === 'rejected' ? 'Rejected · candidate not applied' : 'Review is unavailable.';
                    section.append(status);
                    const scope = document.createElement('p'); scope.className = 'dope-work-detail';
                    scope.textContent = controller.selectedTask.origin.kind === 'work-item' ?
                        `Delegated paths: ${controller.selectedTask.origin.scope.delegablePaths.join(', ')} · ` +
                        `Human reserved: ${controller.selectedTask.origin.scope.humanReservedPaths.join(', ') || 'none'}` :
                        controller.selectedTask.origin.kind === 'phase-stack' ?
                            'Phase-stack candidate: inspect changed paths against the authored prompt and accepted grant.' :
                            'Direct Work candidate: inspect changed paths against your instructions and accepted grant.';
                    section.append(scope);
                    const paths = document.createElement('p'); paths.className = 'dope-work-detail';
                    paths.textContent = `Changed paths: ${review.changedPaths.join(', ') || 'none'}`; section.append(paths);
                    for (const result of review.validation) {
                        const item = document.createElement('p'); item.className = 'dope-work-detail';
                        item.textContent = `Dope validation · ${result.label} · ${result.status}${result.summary ? ` · ${result.summary}` : ''}`;
                        section.append(item);
                    }
                    const diff = document.createElement('details'); diff.className = 'dope-work-diagnostics';
                    const diffTitle = document.createElement('summary'); diffTitle.textContent = 'Candidate diff';
                    const pre = document.createElement('pre'); pre.textContent = review.diff;
                    diff.append(diffTitle, pre);
                    if (review.diffTruncated) { const truncated = document.createElement('p');
                        truncated.textContent = 'Diff preview truncated. Review the changed paths before deciding.'; diff.append(truncated); }
                    section.append(diff);
                    if (state === 'pending' && !workReviewCanAccept(run, controller.selectedTask)) {
                        const unavailable = document.createElement('p'); unavailable.className = 'dope-work-warning';
                        unavailable.textContent = 'Required Dope validation is missing or stale. Candidate cannot be accepted.';
                        section.append(unavailable);
                    }
                    if (state === 'pending' || state === 'busy') {
                        primary('Accept candidate', () => void controller.decideCandidate('accept'),
                            view.actions.includes('accept-candidate') && workReviewCanAccept(run, controller.selectedTask));
                        section.append(this.button('Reject candidate', () => void controller.decideCandidate('reject'),
                            !view.actions.includes('reject-candidate')));
                    }
                    scroll.append(section);
                }
                if (controller.selectedTask?.id === run.taskId) {
                    const steering = document.createElement('details'); steering.className = 'dope-work-diagnostics dope-work-controls';
                    const title = document.createElement('summary'); title.textContent = `Steering · ${controller.steering?.entries.length ?? 0} requests`;
                    steering.append(title);
                    for (const entry of controller.steering?.entries ?? []) {
                        const item = document.createElement('p'); item.className = 'dope-work-detail';
                        item.textContent = `#${entry.revision} ${entry.request.kind}: ${entry.request.text} · ${entry.acknowledgement.status}. ` +
                            'Active-turn steering unavailable; explicitly stop and start a new task to change instructions.';
                        steering.append(item);
                    }
                    if (run.status === 'running' && !run.candidateReview && !run.candidateDelta) {
                        const kind = document.createElement('select'); kind.setAttribute('aria-label', 'Steering request kind');
                        for (const value of ['instruction', 'focus'] as const) {
                            const option = document.createElement('option'); option.value = value; option.textContent = value;
                            kind.append(option);
                        }
                        kind.value = controller.steeringKind;
                        kind.onchange = () => { controller.steeringKind = kind.value as 'instruction' | 'focus'; };
                        const input = document.createElement('textarea'); input.setAttribute('aria-label', 'Steering request');
                        input.maxLength = 4000; input.value = controller.steeringText;
                        const send = this.button('Record steering request', () => void controller.requestSteering(),
                            controller.steeringBusy || !controller.steeringText.trim());
                        input.oninput = () => { controller.steeringText = input.value; send.disabled = controller.steeringBusy || !input.value.trim(); };
                        const notice = document.createElement('p'); notice.className = 'dope-work-detail';
                        notice.textContent = 'This records a request and an unsupported acknowledgement. It does not change the active turn.';
                        steering.append(notice, kind, input, send);
                    }
                    scroll.append(steering);
                }
                if (controller.actions.length) {
                    const actions = document.createElement('details'); actions.className = 'dope-work-diagnostics';
                    const title = document.createElement('summary');
                    title.textContent = `Blocked actions · ${controller.actions.filter(action => !action.decision).length} open`;
                    actions.append(title);
                    for (const action of controller.actions) {
                        const item = document.createElement('p'); item.className = 'dope-work-detail';
                        item.textContent = `${action.effect.kind} · ${action.effect.path ?? action.effect.scope} · ` +
                            `${action.requiredAuthority} · ${action.rationale} · ${action.decision?.kind ?? 'blocked'}`;
                        actions.append(item);
                        if (!action.decision) actions.append(
                            this.button('Acknowledge blocked action', () => void controller.decideAction(action.id, 'acknowledged'), controller.actionBusy),
                            this.button('Reject blocked action', () => void controller.decideAction(action.id, 'rejected'), controller.actionBusy));
                    }
                    const notice = document.createElement('p'); notice.className = 'dope-work-warning';
                    notice.textContent = 'Decisions record review only. They do not grant permission or execute the blocked effect.';
                    actions.append(notice); scroll.append(actions);
                }
                if (controller.mapImpact) {
                    const impact = controller.mapImpact;
                    const section = document.createElement('details'); section.className = 'dope-work-diagnostics';
                    const title = document.createElement('summary'); title.textContent = `Map impact · ${impact.paths.length} changed paths`;
                    section.append(title);
                    const notice = document.createElement('p'); notice.className = 'dope-work-detail';
                    notice.textContent = 'Recorded after candidate promotion. Re-analysis needed; canonical Architecture is unchanged.';
                    section.append(notice);
                    for (const path of impact.paths) {
                        const item = document.createElement('p'); item.className = 'dope-work-detail';
                        item.textContent = path.status === 'resolved' ?
                            `${path.path} · affected map IDs: ${path.nodeIds.join(', ')} · evidence IDs: ${path.evidenceIds.join(', ') || 'none'} · stale` :
                            `${path.path} · unknown map impact (${path.reason})`;
                        section.append(item);
                    }
                    scroll.append(section);
                }
                if (run.authorityDecision) { const item = document.createElement('p');
                    item.textContent = `Authority · ${run.authorityDecision.allowed ? 'allowed' : 'blocked'}`; diagnostics.append(item);
                    const status = document.createElement('small'); status.className = run.authorityDecision.allowed ?
                        'dope-work-system' : 'dope-work-system dope-work-warning';
                    status.textContent = item.textContent; scroll.append(status); }
                if (run.capacityRetries) { const item = document.createElement('p');
                    item.textContent = `Retries · ${run.capacityRetries}`; diagnostics.append(item); }
                if (run.outcome) { const item = document.createElement('p');
                    item.textContent = `${run.outcome.code} · ${run.outcome.summary}`; diagnostics.append(item);
                    const status = document.createElement('small'); status.className = run.status === 'completed' ?
                        'dope-work-system' : 'dope-work-system dope-work-warning';
                    status.textContent = item.textContent; scroll.append(status); }
                if (diagnostics.children.length > 1) scroll.append(diagnostics);
            } else if (work.kind === 'task' && controller.selectedTask?.id === work.id) {
                const task = controller.selectedTask;
                detail(task.instructions);
                if (task.origin.kind === 'work-item') {
                    const section = document.createElement('section'); section.className = 'dope-work-start';
                    const title = document.createElement('h3'); title.textContent = 'Pending WorkItem task'; section.append(title);
                    const info = (value: string) => { const item = document.createElement('p');
                        item.className = 'dope-work-detail'; item.textContent = value; section.append(item); };
                    info(`Objective: ${task.objective}`);
                    info(`Origin: WorkItem ${task.origin.workItemId} · Planning Map ${task.origin.planningMapId}`);
                    info(`Delegated paths: ${task.origin.scope.delegablePaths.join(', ')}`);
                    if (task.origin.scope.humanReservedPaths.length)
                        info(`Human reserved: ${task.origin.scope.humanReservedPaths.join(', ')}`);
                    info(`Required Dope validation: ${task.completion.requireValidationPass && task.completion.validation.length ?
                        task.completion.validation.map(target => `${target.label}: ${target.command ?? 'no command'}`).join('; ') :
                        'Missing from this saved task'}`);
                    info(`Coding Agent: ${controller.startTarget ? `${controller.startTarget.label} (${controller.startTarget.locality}${
                        controller.startTarget.context ? `, observed context ${controller.startTarget.context} tokens` : ''})` :
                        controller.startTargetReason}`);
                    info('Candidate changes remain held for Dope validation and developer review.');
                    const grant = createDefaultExecutionGrant({ id: 'preview', revision: 1, taskId: task.id,
                        acceptedAt: new Date().toISOString() });
                    const review = document.createElement('details'); review.className = 'dope-work-diagnostics';
                    const summary = document.createElement('summary'); summary.textContent = 'Review fixed project execution grant';
                    review.append(summary);
                    for (const kind of EFFECT_KINDS) { const item = document.createElement('div');
                        item.textContent = `${grant.permissions[kind] ? 'Allowed' : 'Denied'} · ${kind}`; review.append(item); }
                    section.append(review);
                    const acceptLabel = document.createElement('label'); acceptLabel.className = 'dope-work-grant';
                    const accept = document.createElement('input'); accept.type = 'checkbox';
                    accept.checked = controller.acceptedStartGrant;
                    accept.setAttribute('aria-label', 'Accept project execution grant');
                    accept.onchange = () => controller.acceptStartGrant(accept.checked);
                    acceptLabel.append(accept, ' Accept project execution grant');
                    section.append(acceptLabel);
                    if (controller.startTarget?.locality === 'hosted') {
                        const hostedLabel = document.createElement('label'); hostedLabel.className = 'dope-work-grant';
                        const hosted = document.createElement('input'); hosted.type = 'checkbox';
                        hosted.checked = controller.hostedProjectDataAuthorized;
                        hosted.onchange = () => controller.authorizeHostedProjectData(hosted.checked);
                        hostedLabel.append(hosted, ' Authorize sending project data to the hosted Coding Agent');
                        section.append(hostedLabel);
                    }
                    const reason = controller.startBlockReason;
                    if (reason) { const status = document.createElement('p'); status.className = 'dope-work-warning';
                        status.setAttribute('role', 'status'); status.textContent = reason; section.append(status); }
                    primary('Start WorkItem task', () => {
                        void controller.startSelectedWorkItemTask().then(run => {
                            if (run && this.panel.work?.kind === 'task' && this.panel.work.id === task.id)
                                this.selectWork({ kind: 'run', id: run.id });
                        });
                    }, !reason && view.actions.includes('start'));
                    scroll.append(section);
                }
            }
            else detail('Work record could not be found.');
        }
        this.content.append(region);
        latest.hidden = !this.workFollow.latestBelow;
    }
    private elapsedClock(startedAt: string, endedAt?: string, running = false): HTMLSpanElement {
        const clock = document.createElement('span');
        clock.className = 'dope-elapsed-time';
        clock.dataset.startedAt = startedAt;
        if (endedAt) clock.dataset.endedAt = endedAt;
        if (running) clock.dataset.running = 'true';
        clock.textContent = `Elapsed ${formatRunElapsed(startedAt, endedAt) ?? '—'}`;
        return clock;
    }
    private compactElapsedClock(startedAt: string, endedAt?: string, running = false): HTMLSpanElement {
        const clock = document.createElement('span');
        clock.className = 'dope-elapsed-time';
        clock.dataset.startedAt = startedAt;
        clock.dataset.compact = 'true';
        if (running) clock.dataset.running = 'true';
        clock.textContent = formatRunElapsedCompact(startedAt, endedAt ? Date.parse(endedAt) : Date.now()) ?? '0s';
        return clock;
    }
    private appendWorkingStatus(item: HTMLElement, startedAt: string): void {
        const row = document.createElement('div');
        row.className = 'dope-chat-working-row';
        row.setAttribute('role', 'status');
        const label = document.createElement('span'); label.textContent = 'Working...';
        row.append(label, this.compactElapsedClock(startedAt, undefined, true));
        item.append(row);
    }
    private appendToolActivity(item: HTMLElement, messageId: string,
        events: readonly { name: string; status: string; truncated?: boolean; detail?: string; target?: string }[] | undefined,
        active: boolean, startedAt: string, endedAt?: string): void {
        const labels: Record<string, string> = { read_file: 'Read', list_files: 'List',
            search_paths: 'Find paths', search_text: 'Search text', run_command: 'Command',
            dope_read: 'Read', dope_list: 'List', dope_search_paths: 'Find paths',
            dope_search_text: 'Search text', dope_command: 'Command' };
        const steps = events?.length ?? 0;
        const current = events?.at(-1);
        if (active && !steps) return;
        const labelText = active && current ?
            `${labels[current.name] ?? 'Tool'}${current.target ? ` · ${current.target}` : ''}` :
            steps ? `Project activity · ${steps} tool ${steps === 1 ? 'step' : 'steps'}` : 'Project activity';
        if (!steps) {
            const row = document.createElement('div'); row.className = 'dope-chat-activity-static';
            const label = document.createElement('span'); label.textContent = labelText;
            row.append(label, this.compactElapsedClock(startedAt, endedAt));
            item.append(row);
            return;
        }
        const activity = document.createElement('details'); activity.className = 'dope-chat-tool-activity';
        activity.open = this.openToolActivities.has(messageId);
        activity.addEventListener('toggle', () => {
            if (activity.open) this.openToolActivities.add(messageId);
            else this.openToolActivities.delete(messageId);
        });
        const heading = document.createElement('summary');
        const label = document.createElement('span'); label.className = 'dope-chat-activity-label';
        label.textContent = labelText;
        heading.append(label);
        if (!active) heading.append(this.compactElapsedClock(startedAt, endedAt));
        activity.append(heading);
        if (active && current) {
            const exact = document.createElement('pre');
            exact.className = 'dope-chat-tool-detail';
            exact.textContent = current.detail ?? `${current.name} (call details unavailable)`;
            activity.append(exact);
            const history = document.createElement('div');
            history.className = 'dope-chat-tool-history-title';
            history.textContent = `Project activity · ${steps} tool ${steps === 1 ? 'step' : 'steps'}`;
            activity.append(history);
        }
        const list = document.createElement('ul');
        for (const event of events ?? []) {
            const row = document.createElement('li');
            const command = event.name === 'run_command' || event.name === 'dope_command';
            const outcome = command && event.status === 'completed' ? 'allowed · completed' :
                command && event.status === 'failed' ? 'allowed · failed' : event.status;
            row.textContent = `${labels[event.name] ?? 'Tool'} · ${outcome}${event.truncated ? ' · truncated' : ''}`;
            list.append(row);
        }
        activity.append(list); item.append(activity);
    }
    private syncElapsedTicker(): void {
        const active = this.content.querySelector('.dope-elapsed-time[data-running="true"]');
        if (!active) { this.stopElapsedTicker(); return; }
        if (this.elapsedTicker) return;
        this.elapsedTicker = setInterval(() => {
            const clocks = this.content.querySelectorAll<HTMLElement>('.dope-elapsed-time[data-running="true"]');
            if (!clocks.length) { this.stopElapsedTicker(); return; }
            const now = Date.now();
            clocks.forEach(clock => {
                clock.textContent = clock.dataset.compact === 'true' ?
                    formatRunElapsedCompact(clock.dataset.startedAt ?? '', now) ?? '0s' :
                    `Elapsed ${formatRunElapsed(clock.dataset.startedAt ?? '', undefined, now) ?? '—'}`;
            });
        }, 1000);
    }
    private stopElapsedTicker(): void {
        if (this.elapsedTicker) clearInterval(this.elapsedTicker);
        this.elapsedTicker = undefined;
    }
    private toggleTitleEditing(chatId: string, currentTitle: string): void {
        if (this.titleEditingChatId === chatId) {
            const title = this.titleDraft.trim();
            this.titleEditingChatId = undefined;
            if (title && title !== currentTitle) this.mutate({ type: 'rename-chat', chatId, title });
        } else {
            this.titleEditingChatId = chatId;
            this.titleDraft = currentTitle;
        }
        this.render();
        if (this.titleEditingChatId === chatId) {
            const input = this.content.querySelector<HTMLInputElement>('.dope-chat-title-input');
            input?.focus(); input?.select();
        }
    }
    private async name(title: string, value = ''): Promise<string | undefined> {
        const result = await new SingleTextInputDialog({ title, initialValue: value, confirmButtonLabel: 'Save' }).open();
        return result?.trim() || undefined;
    }
    private async folderChoice(title: string, current: string, excluded = ''): Promise<string | undefined> {
        const paths = ['', ...(this.controller.snapshot?.folders.map(folder => folder.path) ?? [])]
            .filter(path => !excluded || path !== excluded && !path.startsWith(`${excluded}/`));
        const choice = await this.name(`${title} — destination folder (${paths.map(path => path || '/').join(', ')})`, current || '/');
        if (choice === undefined) return undefined;
        const path = choice === '/' ? '' : choice;
        if (!paths.includes(path)) { this.status.textContent = 'Choose an existing destination folder.'; return undefined; }
        return path;
    }
    private mutate(operation: ChatOperation): void { void this.controller.mutate(operation); }
    private async loadModels(): Promise<void> {
        if (!this.modelConnections) return;
        const request = ++this.modelsRequest;
        try {
            const models = await this.modelConnections.list();
            if (this.isDisposed || request !== this.modelsRequest) return;
            this.models = models; this.render();
        } catch (error) { if (request === this.modelsRequest) this.status.textContent = String(error); }
    }
    private async addContext(kind: ChatContextKind): Promise<void> {
        const chat = this.controller.chat;
        if (!chat) return;
        const allowed = chat.settings.context.allowedSources;
        if (!allowed.length) { this.status.textContent = 'Enable context sources in Chat settings.'; return; }
        if (!allowed.includes(kind)) { this.status.textContent = 'Context source is disabled.'; return; }
        const workspace = this.controller.workspace, chatId = chat.id;
        try {
            let selection: ChatContextSelection;
            if (kind === 'editor' || kind === 'selection') {
                const editor = this.editors?.currentEditor?.editor;
                const workspace = this.controller.workspace;
                if (!editor || !workspace) throw new Error('Open a project file in the editor first');
                const root = decodeURIComponent(new URL(workspace).pathname).replace(/\/$/, '');
                const file = decodeURIComponent(new URL(editor.document.uri.toString()).pathname);
                if (!file.startsWith(`${root}/`)) throw new Error('Current editor is outside this project');
                const path = file.slice(root.length + 1);
                if (kind === 'selection') {
                    const range = editor.selection;
                    if (!range) throw new Error('Select editor text first');
                    const start = editor.document.offsetAt(range.start), end = editor.document.offsetAt(range.end);
                    if (start === end) throw new Error('Select editor text first');
                    selection = { kind, id: path, text: editor.document.getText(range), start, end };
                } else selection = { kind, id: path, text: editor.document.getText() };
            } else if (kind === 'physical-map' || kind === 'flow') {
                const map = this.map;
                if (!map?.selectedId || !map.status || map.workspace !== this.controller.workspace)
                    throw new Error('Select a current Physical Map identity first');
                selection = { kind, id: map.selectedId, projectId: 'project:root', generation: map.status.generation,
                    ...(kind === 'flow' ? { direction: 'downstream' as const } : {}) };
            } else if (kind === 'saved-chat') {
                const query = await this.name('Search saved Chats by content');
                if (!query) return;
                const hits = await this.controller.searchSaved(query);
                if (!hits.length) throw new Error('No saved Chat matches');
                const choice = await this.name(`Choose excerpt: ${hits.map((hit, index) =>
                    `${index + 1} ${hit.title}: ${hit.excerpt}`).join(' | ')}`, '1');
                if (!choice) return;
                const hit = hits[Number(choice) - 1];
                if (!hit) throw new Error('Invalid saved Chat excerpt choice');
                selection = { kind, id: hit.chatId, messageId: hit.messageId };
            } else {
                const id = await this.name(kind === 'work-item' ? 'Map ID:WorkItem ID' : `${kind} ID or project-relative path`);
                if (!id) return;
                selection = { kind: kind as ChatContextKind, id };
            }
            if (this.controller.workspace !== workspace || this.controller.chatId !== chatId) return;
            this.controller.addContext(selection);
        } catch (error) { this.status.textContent = String(error); }
    }
    private behavior(kind: 'Ask' | 'Explain' | 'Trace' | 'Find Related'): void {
        const state = this.controller;
        const selected = this.map && this.map.workspace === state.workspace ? this.map.selectedId : undefined;
        state.draft = readOnlyPrompt(kind, state.draft);
        if (kind !== 'Ask' && selected) {
            const contextKind = kind === 'Trace' ? 'flow' : 'physical-map';
            void this.addContext(contextKind);
        }
        this.render();
        this.content.querySelector<HTMLTextAreaElement>('textarea')?.focus();
    }
    private usableModels(): Array<{ selection: ChatModelSelection; label: string;
        controls: readonly { id: string; values: readonly string[] }[] }> {
        return this.models.connections.flatMap(connection => connection.ready ? connection.models
            .filter(model => model.usable).map(model => ({ selection: { connectionId: connection.id, modelId: model.id },
                label: `${connection.label} · ${model.label}`, controls: model.capabilities.reasoningControls ?? [] })) : []);
    }
    private sameModel(a?: ChatModelSelection, b?: ChatModelSelection): boolean {
        return !!a && !!b && a.connectionId === b.connectionId && a.modelId === b.modelId;
    }
    private selectedModel(): ChatModelSelection | undefined {
        const state = this.controller, usable = this.usableModels();
        return resolveChatModel(usable, state.turnModel,
            state.chat?.settings.modelPolicy.type === 'exact' ? state.chat.settings.modelPolicy.model : undefined);
    }
    private renderSettings(chatId: string): HTMLElement {
        const form = document.createElement('section');
        form.className = 'dope-chat-settings-form';
        form.setAttribute('aria-label', 'Chat settings');
        const draft = this.settingsDraft!;
        const color = document.createElement('fieldset');
        color.className = 'dope-chat-color-picker';
        const legend = document.createElement('legend'); legend.textContent = 'Chat color';
        color.append(legend);
        for (const value of CHAT_COLORS) {
            const choice = this.button(value, () => this.mutate({ type: 'set-color', chatId, color: value }),
                this.controller.pending || this.controller.running);
            choice.className = 'dope-chat-color-choice';
            choice.dataset.color = value;
            choice.setAttribute('aria-label', `${value} Chat color`);
            choice.setAttribute('aria-pressed', String(this.controller.chat?.color === value));
            color.append(choice);
        }
        form.append(color);
        const field = (label: string, input: HTMLElement) => {
            const row = document.createElement('label'); row.textContent = label; row.append(input); form.append(row);
        };
        const model = document.createElement('select');
        model.append(new Option('Follow Interactive role', ''));
        for (const entry of this.usableModels()) model.append(new Option(entry.label,
            JSON.stringify(entry.selection)));
        const exact = draft.modelPolicy.type === 'exact' ? draft.modelPolicy.model : undefined;
        if (exact && !this.usableModels().some(entry => this.sameModel(entry.selection, exact)))
            model.append(new Option('Pinned model unavailable', JSON.stringify(exact)));
        model.value = exact ? JSON.stringify(exact) : '';
        model.onchange = () => { draft.modelPolicy = model.value ?
            { type: 'exact', model: JSON.parse(model.value) as ChatModelSelection } : { type: 'follow-interactive' };
            draft.reasoningControls = undefined; this.render(); };
        field('Chat model policy', model);
        if (!this.usableModels().length || exact && !this.usableModels().some(entry => this.sameModel(entry.selection, exact)))
            form.append(this.button('Manage AI connections', () => { void this.aiCenter?.openFromChat(this.id); }));
        if (draft.modelPolicy.type === 'follow-interactive')
            form.append(this.button('Configure Interactive role', () => { void this.aiCenter?.openRole('interactive'); }));
        const active = this.usableModels().find(entry => this.sameModel(entry.selection, exact));
        for (const control of active?.controls ?? []) {
            const select = document.createElement('select');
            select.append(new Option('Default', ''), ...control.values.map(value => new Option(value, value)));
            select.value = draft.reasoningControls?.[control.id] ?? '';
            select.onchange = () => {
                draft.reasoningControls = { ...draft.reasoningControls };
                if (select.value) draft.reasoningControls[control.id] = select.value;
                else delete draft.reasoningControls[control.id];
            };
            field(`Reasoning: ${control.id}`, select);
        }
        const history = document.createElement('select');
        history.append(new Option('Recent history', 'recent'), new Option('No history', 'none'));
        history.value = draft.context.history;
        history.onchange = () => { draft.context.history = history.value as 'recent' | 'none'; };
        field('Conversation history', history);
        for (const [label, key] of [['Input token budget', 'maxInputTokens'], ['Output token reserve', 'reservedOutputTokens']] as const) {
            const input = document.createElement('input'); input.type = 'number'; input.min = key === 'maxInputTokens' ? '1' : '0';
            input.value = String(draft.context[key]);
            input.onchange = () => { draft.context[key] = Number(input.value); };
            field(label, input);
        }
        const sources: ChatContextKind[] = ['editor', 'selection', 'file', 'project-mind', 'architecture',
            'physical-map', 'flow', 'planning-map', 'work-item', 'roadmap-checkpoint', 'roadmap', 'saved-chat'];
        for (const source of sources) {
            const input = document.createElement('input'); input.type = 'checkbox';
            input.checked = draft.context.allowedSources.includes(source);
            input.onchange = () => { draft.context.allowedSources = input.checked ?
                [...draft.context.allowedSources, source] : draft.context.allowedSources.filter(item => item !== source); };
            field(`Allow ${source} context`, input);
        }
        const saved = document.createElement('input'); saved.type = 'checkbox'; saved.checked = draft.context.savedChatSearch;
        saved.onchange = () => { draft.context.savedChatSearch = saved.checked; };
        field('Allow saved Chat retrieval', saved);
        form.append(this.button('Save settings', () => void this.controller.mutate({ type: 'set-settings', chatId,
            settings: draft }).then(saved => {
            if (saved && this.settingsChatId === chatId) {
                this.settingsOpen = false; this.settingsDraft = undefined; this.render();
            }
        }), this.controller.running));
        return form;
    }
    private renderTree(node: ChatTree): HTMLElement {
        const list = document.createElement('ul');
        list.className = 'dope-chat-tree';
        for (const folder of node.folders) {
            const item = document.createElement('li');
            item.className = 'dope-chat-folder';
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = folder.path.slice(folder.path.lastIndexOf('/') + 1);
            details.append(summary);
            const menu = document.createElement('details');
            menu.className = 'dope-chat-context';
            const menuLabel = document.createElement('summary');
            menuLabel.textContent = 'Actions';
            menuLabel.setAttribute('aria-label', `Actions for folder ${folder.path}`);
            const actions = document.createElement('div');
            actions.className = 'dope-chat-actions';
            actions.append(
                this.button('New Chat', () => void this.controller.newChat(folder.path)),
                this.button('New Folder', () => void this.name('New folder').then(name => { if (name) void this.controller.newFolder(folder.path, name); })),
                this.button('Rename', () => void this.name('Rename folder', summary.textContent || '').then(name => {
                    if (name) this.mutate({ type: 'rename-folder', path: folder.path, name });
                })),
                this.button('Move', () => void this.folderChoice('Move folder', node.path, folder.path).then(destination => {
                    if (destination !== undefined) this.mutate({ type: 'move-folder', path: folder.path, destination });
                }))
            );
            menu.append(menuLabel, actions);
            details.append(menu, this.renderTree(folder));
            item.append(details);
            list.append(item);
        }
        for (const chat of node.chats) {
            const item = document.createElement('li');
            const row = document.createElement('div');
            row.className = 'dope-chat-row';
            const select = this.button('', () => void this.controller.select(chat.id));
            select.className = 'dope-chat-select';
            select.setAttribute('aria-label', `Open Chat ${chat.title}`);
            const dot = document.createElement('span');
            dot.className = 'dope-chat-color-dot'; dot.dataset.color = chat.color;
            dot.setAttribute('aria-hidden', 'true');
            const text = document.createElement('span');
            text.className = 'dope-chat-row-text';
            const title = document.createElement('span');
            title.className = 'dope-chat-row-title'; title.textContent = chat.title;
            const time = document.createElement('time');
            time.dateTime = chat.lastInteractedAt;
            time.title = `Created ${chat.createdAt}; last interaction ${chat.lastInteractedAt}`;
            time.textContent = new Date(chat.lastInteractedAt).toLocaleDateString();
            text.append(title, time);
            select.append(dot, text);
            const menu = document.createElement('div');
            menu.className = 'dope-chat-composer-menu dope-chat-row-menu';
            menu.popover = 'auto';
            menu.id = `${this.id}-chat-actions-${chat.id}`;
            menu.setAttribute('role', 'menu');
            menu.setAttribute('aria-label', `Actions for Chat ${chat.title}`);
            let openOnPointerDown = false;
            const more = this.button('⋯', () => {
                if (openOnPointerDown || menu.matches(':popover-open')) {
                    openOnPointerDown = false;
                    if (menu.matches(':popover-open')) menu.hidePopover();
                    return;
                }
                menu.showPopover();
                const bounds = more.getBoundingClientRect();
                const width = menu.offsetWidth, height = menu.offsetHeight;
                menu.style.left = `${Math.max(8, Math.min(bounds.right - width, window.innerWidth - width - 8))}px`;
                menu.style.top = `${bounds.bottom + height + 8 <= window.innerHeight ? bounds.bottom + 4 :
                    Math.max(8, bounds.top - height - 4)}px`;
                menu.querySelector<HTMLButtonElement>('button')?.focus();
            });
            more.className = 'dope-chat-row-more';
            more.addEventListener('pointerdown', () => { openOnPointerDown = menu.matches(':popover-open'); });
            more.setAttribute('aria-label', `Actions for Chat ${chat.title}`);
            more.setAttribute('aria-haspopup', 'menu');
            more.setAttribute('aria-controls', menu.id);
            more.setAttribute('aria-expanded', 'false');
            menu.addEventListener('toggle', () => more.setAttribute('aria-expanded', String(menu.matches(':popover-open'))));
            menu.addEventListener('focusout', event => {
                if (event.relatedTarget && !menu.contains(event.relatedTarget as Node) && menu.matches(':popover-open'))
                    menu.hidePopover();
            });
            menu.addEventListener('keydown', event => {
                const entries = [...menu.querySelectorAll<HTMLButtonElement>('button')];
                const index = entries.indexOf(document.activeElement as HTMLButtonElement);
                if (event.key === 'Escape') { event.preventDefault(); menu.hidePopover(); more.focus(); return; }
                const next = event.key === 'ArrowDown' ? (index + 1) % entries.length :
                    event.key === 'ArrowUp' ? (index + entries.length - 1) % entries.length :
                        event.key === 'Home' ? 0 : event.key === 'End' ? entries.length - 1 : -1;
                if (next >= 0) { event.preventDefault(); entries[next].focus(); }
            });
            more.addEventListener('keydown', event => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    if (!menu.matches(':popover-open')) more.click();
                    const entries = menu.querySelectorAll<HTMLButtonElement>('button');
                    (event.key === 'ArrowUp' ? entries[entries.length - 1] : entries[0])?.focus();
                }
            });
            const menuEntry = (label: string, iconName: string, paths: string[], action: () => void): HTMLButtonElement => {
                const entry = this.button('', () => { menu.hidePopover(); action(); });
                entry.setAttribute('role', 'menuitem');
                const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                icon.setAttribute('class', `lucide lucide-${iconName}`);
                icon.setAttribute('viewBox', '0 0 24 24');
                icon.setAttribute('fill', 'none');
                icon.setAttribute('stroke', 'currentColor');
                icon.setAttribute('stroke-width', '2');
                icon.setAttribute('stroke-linecap', 'round');
                icon.setAttribute('stroke-linejoin', 'round');
                icon.setAttribute('aria-hidden', 'true');
                for (const d of paths) {
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', d); icon.append(path);
                }
                const text = document.createElement('span'); text.textContent = label;
                entry.append(icon, text);
                return entry;
            };
            const rename = menuEntry('Rename', 'pencil',
                ['M21.174 6.812a1.2 1.2 0 0 0 0-1.698l-2.288-2.288a1.2 1.2 0 0 0-1.698 0L3 17l-1 4 4-1Z', 'm15 5 4 4'],
                () => void this.name('Rename Chat', chat.title).then(title => {
                    if (title) this.mutate({ type: 'rename-chat', chatId: chat.id, title });
                }));
            const move = menuEntry('Move', 'folder',
                ['M20 20H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2Z'],
                () => void this.folderChoice('Move Chat', chat.folderPath).then(folderPath => {
                    if (folderPath !== undefined) this.mutate({ type: 'move-chat', chatId: chat.id, folderPath });
                }));
            const remove = menuEntry('Delete Chat', 'trash-2',
                ['M3 6h18', 'M8 6V4h8v2', 'M5 6l1 15h12l1-15', 'M10 10v7', 'M14 10v7'],
                () => {
                    if (window.confirm(`Permanently delete “${chat.title}” and its saved Chat file? This cannot be undone.`))
                        void this.controller.deleteChat(chat.id);
                });
            menu.append(rename, move, remove);
            row.append(select, more, menu);
            item.append(row);
            list.append(item);
        }
        return list;
    }
    private render(): void {
        const state = this.controller;
        const toolbarState = `${this.canBackToChats}:${this.canCopyTranscript}:${this.canOpenChatSettings}`;
        if (toolbarState !== this.toolbarState) {
            this.toolbarState = toolbarState;
            ChatPanelWidget.toolbarChanged.fire();
        }
        if (this.dragPointerId !== undefined && (this.panel.mode !== 'chat' || state.mode !== 'chat' || state.chatId !== this.dragChatId))
            this.endTranscriptDrag();
        const selectedWork = this.panel.work;
        if (this.id !== chatLauncherIds.left && this.id !== chatLauncherIds.right &&
            this.id !== workLauncherIds.left && this.id !== workLauncherIds.right)
            this.title.iconClass = codicon(this.panel.mode === 'work' ? 'tools' : 'comment-discussion');
        this.title.label = this.title.caption = this.panel.mode === 'work' ? selectedWork && this.workController ?
            workTitle(selectedWork,
                selectedWork.kind === 'run' && this.workController.selectedRun?.id === selectedWork.id ?
                    this.workController.selectedRun : undefined,
                selectedWork.kind !== 'sequence' && this.workController.selectedTask &&
                    (selectedWork.kind === 'task' && this.workController.selectedTask.id === selectedWork.id ||
                        selectedWork.kind === 'run' && this.workController.selectedRun?.id === selectedWork.id) ?
                    this.workController.selectedTask : undefined,
                selectedWork.kind === 'sequence' && this.workController.phase.selected?.id === selectedWork.id ?
                    this.workController.phase.selected : undefined) : 'Work' : 'Chat';
        this.content.className = this.panel.mode === 'work' ? 'dope-chat-content dope-chat-content-work' :
            state.mode !== 'chat' ? 'dope-chat-content dope-chat-content-select' :
                'dope-chat-content dope-chat-content-conversation';
        if (this.panel.mode === 'work' && !this.panel.work) this.content.classList.add('dope-work-select');
        this.scrollFollow.select(this.panel.mode === 'chat' && state.mode === 'chat' ? state.chatId : undefined);
        const oldScroll = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
        const scrollTop = oldScroll?.scrollTop ?? 0;
        const active = document.activeElement as HTMLElement | null;
        const focused = this.content.contains(active) ? active?.getAttribute('aria-label') : undefined;
        const focusedWorkKey = this.content.contains(active) ? active?.dataset.workKey : undefined;
        const selection = active instanceof HTMLTextAreaElement ? [active.selectionStart, active.selectionEnd] : undefined;
        // Work and Chat selection keep their root status. Active Chat places it
        // with other notices in the scrollable response area below.
        this.node.insertBefore(this.status, this.content);
        this.status.className = this.panel.mode === 'chat' && state.error ? 'dope-chat-error-bubble' : '';
        this.status.textContent = this.panel.mode === 'chat' ?
            state.error || (state.loading ? 'Loading Chats…' : !state.workspace ?
                this.workspaceRootCount === undefined ? 'Checking the attached project…' :
                this.workspaceRootCount === 0 ? 'Open a project folder to use Chats.' :
                'Multiple project roots are open. Open one project folder to use Chats.' : '') :
            this.workspaceAttachFailed ? 'Work project did not respond. Retry the connection.' :
            !this.panel.workspace ? 'Open one project to use Work.' : this.backendOffline ?
                'Work is temporarily disconnected. Reconnecting when the backend returns…' :
            this.workAttachmentError ? 'Work connection did not respond. Retry connection.' :
            this.workController?.attachState === 'loading' ?
                this.workController.phase.handle ? 'Loading saved Work…' : 'Connecting to Work…' :
            this.workController?.attachState === 'unavailable' ?
                    this.workController.message || 'Work is unavailable.' : '';
        if (this.panel.mode === 'work' && (this.workspaceAttachFailed || this.workAttachmentError || this.panel.workspace &&
            (this.backendOffline || this.workController?.attachState === 'unavailable'))) {
            this.status.append(' ', this.button('Retry connection', () => void this.retryWorkConnection(),
                !!this.workReconnect || this.probingBackend));
            if (this.panel.workspace) this.status.append(' ', this.button('Back to Select Work', () => { void this.selectWork(); }));
        }
        if (this.panel.mode === 'chat' && state.error.includes('Interactive role')) this.status.append(' ',
            this.button('Open AI Center', () => { void this.aiCenter?.openRole('interactive'); }));
        if (this.panel.mode === 'chat' && state.error.includes('Verify Local agent execution')) {
            const failed = [...(state.chat?.messages ?? [])].reverse().find(message =>
                message.role === 'assistant' && message.execution.status === 'failed');
            const model = failed?.role === 'assistant' ? failed.execution.selectedModel : state.turnModel;
            this.status.append(' ', this.button('Open tool verification', () => {
                if (model) void this.aiCenter?.openLocalAgentVerification(this.id, model.connectionId, model.modelId);
                else void this.aiCenter?.openFromChat(this.id);
            }));
        }
        this.content.replaceChildren();
        this.stopElapsedTicker();
        if (this.panel.mode === 'work') {
            this.renderWork();
            const current = this.content.querySelector<HTMLElement>('.dope-work-scroll');
            if (current) {
                current.scrollTop = restoreWorkScroll(this.workFollow, this.workScrollTop,
                    current.scrollHeight, current.clientHeight, this.workSelectionChanged);
                const latest = this.content.querySelector<HTMLElement>('.dope-work-latest');
                if (latest) latest.hidden = !this.workFollow.latestBelow;
            }
            this.workSelectionChanged = false;
            this.syncElapsedTicker();
            if (focused) this.content.querySelectorAll<HTMLElement>('[aria-label]').forEach(element => {
                if (element.getAttribute('aria-label') === focused) element.focus({ preventScroll: true });
            });
            if (focusedWorkKey) this.content.querySelectorAll<HTMLElement>('[data-work-key]').forEach(element => {
                if (element.dataset.workKey === focusedWorkKey) element.focus({ preventScroll: true });
            });
            return;
        }
        if (!state.snapshot) {
            if (state.error && state.workspace) this.content.append(this.button('Retry', () => void this.attach()));
            return;
        }
        if (state.mode === 'select-chat') {
            this.settingsOpen = false; this.settingsDraft = undefined; this.settingsChatId = undefined;
            this.titleEditingChatId = undefined;
            const header = document.createElement('header');
            header.className = 'dope-chat-selector-header';
            const heading = document.createElement('h2');
            heading.textContent = 'Select Chat';
            const create = document.createElement('div');
            create.className = 'dope-chat-selector-create';
            create.append(this.button('New Chat', () => void state.newChat(''), state.pending),
                this.button('New Folder', () => void this.name('New folder').then(name => {
                    if (name) void state.newFolder('', name);
                }), state.pending));
            header.append(heading, create);
            if (!this.usableModels().length)
                header.append(this.button('Manage AI connections', () => { void this.aiCenter?.openFromChat(this.id); }));
            const navigation = document.createElement('nav');
            navigation.className = 'dope-chat-selector-list';
            navigation.setAttribute('aria-label', 'Chats and folders');
            navigation.append(this.renderTree(chatTree(state.snapshot)));
            this.content.append(header, navigation);
            return;
        }
        const chat = state.chat;
        if (!chat) { state.select(undefined); return; }
        if (this.settingsChatId !== chat.id) {
            this.settingsOpen = false; this.settingsDraft = undefined; this.settingsChatId = chat.id;
        }
        if (this.titleEditingChatId && this.titleEditingChatId !== chat.id) this.titleEditingChatId = undefined;
        const header = document.createElement('header');
        header.className = 'dope-chat-title-card';
        if (this.titleEditingChatId === chat.id) {
            const input = document.createElement('input');
            input.className = 'dope-chat-title-input';
            input.setAttribute('aria-label', 'Chat title');
            input.maxLength = 200;
            input.value = this.titleDraft;
            input.oninput = () => { this.titleDraft = input.value; };
            input.onkeydown = event => {
                if (event.key === 'Enter') { event.preventDefault(); this.toggleTitleEditing(chat.id, chat.title); }
                else if (event.key === 'Escape') { this.titleEditingChatId = undefined; this.render(); }
            };
            header.append(input);
        } else {
            const heading = document.createElement('h2');
            heading.textContent = chat.title;
            header.append(heading);
        }
        const editTitle = this.button('', () => this.toggleTitleEditing(chat.id, chat.title), state.pending);
        editTitle.className = 'dope-chat-title-edit';
        editTitle.setAttribute('aria-label', this.titleEditingChatId === chat.id ? 'Save chat title' : 'Edit chat title');
        editTitle.title = this.titleEditingChatId === chat.id ? 'Save chat title' : 'Edit chat title';
        const editIcon = document.createElement('span');
        editIcon.className = codicon('edit'); editIcon.setAttribute('aria-hidden', 'true');
        editTitle.append(editIcon);
        header.append(editTitle);
        const shell = document.createElement('section'); shell.className = 'dope-chat-shell';
        const region = document.createElement('div'); region.className = 'dope-chat-transcript-region';
        const scroll = document.createElement('div'); scroll.className = 'dope-chat-scroll';
        scroll.setAttribute('role', 'log'); scroll.setAttribute('aria-label', 'Chat conversation');
        scroll.onscroll = () => {
            if (performance.now() < this.scrollAnimationUntil) return;
            this.scrollFollow.scrolled(scroll.scrollTop, scroll.scrollHeight, scroll.clientHeight);
            latest.hidden = !this.scrollFollow.latestBelow;
        };
        scroll.onwheel = event => { if (event.deltaY < 0) { this.cancelScrollAnimation?.(); this.scrollAnimationUntil = 0; } };
        scroll.onpointerdown = event => {
            if (event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary ||
                !canDragChatTranscript(event.target as Element, this.spacePanPressed)) return;
            this.endTranscriptDrag();
            this.dragPointerId = event.pointerId; this.dragChatId = state.chatId;
            this.transcriptDrag.start(event.clientY, scroll.scrollTop, event.clientX);
            if (this.spacePanPressed) { scroll.classList.add('dope-chat-scroll-panning'); event.preventDefault(); }
            document.addEventListener('pointermove', this.moveTranscriptDrag);
            document.addEventListener('pointerup', this.endTranscriptPointer);
            document.addEventListener('pointercancel', this.endTranscriptPointer);
        };
        scroll.onpointermove = event => {
            if (event.pointerType === 'touch' && event.buttons) {
                this.cancelScrollAnimation?.(); this.scrollAnimationUntil = 0;
            }
        };
        const transcript = document.createElement('ol');
        transcript.className = 'dope-chat-transcript';
        const lastUserIndex = chat.messages.map(message => message.role).lastIndexOf('user');
        const activeAssistant = [...chat.messages.slice(lastUserIndex + 1)].reverse().find(message =>
            message.role === 'assistant' && ['pending', 'streaming'].includes(message.execution.status));
        for (const message of chat.messages) {
            const item = document.createElement('li');
            item.className = `dope-chat-message dope-chat-message-${message.role}`;
            item.dataset.messageId = message.id;
            item.setAttribute('aria-label', message.role === 'user' ? 'You' : 'Assistant');
            if (message.role === 'user') item.dataset.color = chat.color;
            const content = document.createElement('div');
            content.className = 'dope-chat-message-content';
            const body = message.role === 'assistant' && state.stream?.messageId === message.id ?
                state.stream.content : message.content;
            if (message.role === 'assistant' && message.execution.status === 'pending' && !body) {
                if (!(state.running && message.id === activeAssistant?.id)) content.textContent = 'Working...';
            } else if (message.role === 'assistant') {
                const activity = state.stream?.messageId === message.id ? undefined : planningActivityPresentation(message);
                const outcome = state.stream?.messageId === message.id ? undefined : planningOutcome(message);
                if (outcome) {
                    const explanation = document.createElement('div');
                    explanation.className = 'dope-chat-planning-outcome';
                    const summary = document.createElement('p'); summary.textContent = outcome.summary;
                    explanation.append(summary);
                    if (outcome.questions.length) {
                        const questions = document.createElement('p');
                        questions.textContent = outcome.questions.join(' ');
                        explanation.append(questions);
                    }
                    content.append(explanation);
                }
                if (activity) {
                    const planAnswer = implementationPlanAnswer(message);
                    if (planAnswer) content.append(renderUntrustedMessageMarkdown(this.markdown, planAnswer));
                    const details = document.createElement('details');
                    details.className = 'dope-chat-planning-activity';
                    details.open = this.openPlanningActivities.has(message.id);
                    details.addEventListener('toggle', () => {
                        if (details.open) this.openPlanningActivities.add(message.id);
                        else this.openPlanningActivities.delete(message.id);
                    });
                    const summary = document.createElement('summary');
                    summary.setAttribute('aria-label', `${activity.label}: ${activity.status}. Original JSON`);
                    const label = document.createElement('span'); label.className = 'dope-chat-activity-label';
                    label.textContent = activity.label;
                    const status = document.createElement('span'); status.className = 'dope-chat-activity-status';
                    status.textContent = activity.status;
                    summary.append(label, status);
                    const raw = document.createElement('pre'); raw.className = 'dope-chat-activity-raw';
                    raw.textContent = body;
                    const copy = this.button('Copy JSON', () => {
                        void copyChatText(body)
                            .then(() => { copy.textContent = 'Copied'; }, () => { copy.textContent = 'Copy failed'; });
                    });
                    copy.setAttribute('aria-label', `Copy original JSON for ${activity.label}`);
                    copy.setAttribute('aria-live', 'polite');
                    details.append(summary, raw, copy);
                    content.append(details);
                    if (activity.alert) item.classList.add('dope-chat-message-alert');
                } else if (message.planningActivity?.status === 'failed' ||
                    message.planningActivity?.status === 'cancelled') {
                    const note = document.createElement('p');
                    note.className = 'dope-chat-planning-invalid';
                    note.textContent = 'Unvalidated local planning output';
                    content.append(note);
                    if (body) {
                        const raw = document.createElement('pre');
                        raw.className = 'dope-chat-planning-invalid-raw';
                        raw.textContent = body;
                        content.append(raw);
                    }
                } else content.append(renderUntrustedMessageMarkdown(this.markdown, body));
            } else content.textContent = body;
            const time = document.createElement('time');
            time.dateTime = message.createdAt;
            time.textContent = new Date(message.createdAt).toLocaleString();
            item.append(content);
            if (message.role === 'assistant') {
                if (state.running && message.id === activeAssistant?.id)
                    this.appendWorkingStatus(item, message.execution.startedAt);
                const events = state.toolProgress?.messageId === message.id && state.running ?
                    state.toolProgress.events : message.execution.toolEvents;
                this.appendToolActivity(item, message.id, events, state.running && message.id === activeAssistant?.id,
                    message.execution.startedAt, message.execution.finishedAt);
                const action = this.roadmapActionCard(message);
                if (action) item.append(action);
                if (state.pendingCommand && message.id === activeAssistant?.id) {
                    const command = this.commandApprovalCard();
                    if (command) item.append(command);
                }
            }
            const meta = document.createElement('small'); meta.className = 'dope-chat-message-meta';
            meta.append(time);
            if (message.role === 'user' && message.contextRefs.length) {
                for (const [origin, label] of [['manual', 'Context'], ['automatic', 'Auto context']] as const) {
                    const sources = message.contextRefs.filter(ref => (ref.origin ?? 'manual') === origin);
                    if (!sources.length) continue;
                    const refs = document.createElement('details');
                    const summary = document.createElement('summary');
                    summary.textContent = ` · ${label} (${sources.length})`;
                    refs.append(summary);
                    const list = document.createElement('ul');
                    for (const ref of sources) {
                        const entry = document.createElement('li');
                        entry.textContent = `${ref.kind}: ${ref.label}${origin === 'manual' ? ` (${ref.id})` : ''}` +
                            `${ref.includedBytes === 0 ? ' (omitted by budget)' : ''}`;
                        list.append(entry);
                    }
                    refs.append(list); meta.append(refs);
                }
            }
            if (message.role === 'assistant') {
                const execution = message.execution;
                const status = document.createElement('span');
                status.textContent = ` · ${execution.status}${execution.failure ? ` · ${execution.failure}` : ''}`;
                if (['failed', 'cancelled', 'interrupted'].includes(execution.status))
                    item.classList.add('dope-chat-message-alert');
                meta.append(status);
                const provenance = document.createElement('span');
                provenance.className = 'dope-chat-provenance';
                provenance.textContent = ` · ${execution.selectedModel.connectionId}/${execution.selectedModel.modelId}` +
                    (execution.actualModel ? ` → ${execution.actualModel.providerId}/${execution.actualModel.modelLabel}` : '');
                meta.append(provenance);
                if (execution.routingProvenance) {
                    const route = execution.routingProvenance;
                    const why = document.createElement('details');
                    const summary = document.createElement('summary'); summary.textContent = 'Why this model?';
                    const detail = document.createElement('span');
                    detail.textContent = `${route.requestedRole ?? 'Exact'} · ${route.source}; constraints: ` +
                        `${route.effectiveHard.locality}, ${route.effectiveHard.requiredCapabilities.join(', ') || 'none'}, ` +
                        `context ≥${route.effectiveHard.minimumKnownContextTokens ?? 0}, ` +
                        `hosted egress ${route.effectiveHard.hostedProjectData}; ` +
                        `preferred: ${route.preferredTarget ? `${route.preferredTarget.connectionId}/${route.preferredTarget.modelId}` : 'none'}; ` +
                        `actual: ${route.executionLabels.connection}/${route.executionLabels.model}; ` +
                        `attempts: ${route.attempts.map(item => `${item.target.connectionId}/${item.target.modelId} ${item.outcome}`).join(' → ')}`;
                    why.append(summary, detail); meta.append(why);
                } else if (execution.resolutionSource && ['failed', 'cancelled'].includes(execution.status)) {
                    const why = document.createElement('details');
                    const summary = document.createElement('summary'); summary.textContent = 'Why this model?';
                    const detail = document.createElement('span');
                    detail.textContent = `${execution.resolutionSource}; selected: ` +
                        `${execution.selectedModel.connectionId}/${execution.selectedModel.modelId}; ` +
                        `${execution.failure ?? execution.status}`;
                    why.append(summary, detail); meta.append(why);
                }
            }
            item.append(meta);
            if (message.role === 'assistant' &&
                message.execution.failure?.includes('Verify Local agent execution') &&
                !state.error.includes('Verify Local agent execution')) {
                const recovery = document.createElement('div');
                recovery.className = 'dope-chat-error-bubble';
                const description = document.createElement('span');
                description.textContent = message.execution.failure;
                const target = message.execution.selectedModel;
                recovery.append(description, this.button('Open tool verification', () => {
                    void this.aiCenter?.openLocalAgentVerification(this.id, target.connectionId, target.modelId);
                }));
                item.append(recovery);
            }
            if (message.role === 'assistant') {
                const copyText = chatResponseCopyText(message,
                    state.stream?.messageId !== undefined && state.stream.messageId === message.id ? state.stream.content : undefined);
                if (copyText) {
                    const copy = this.button('', () => {
                        void copyChatText(copyText)
                            .then(() => { icon.className = codicon('check');
                                copy.setAttribute('aria-label', 'Response copied'); copy.title = 'Copied';
                                setTimeout(() => { icon.className = codicon('copy');
                                    copy.setAttribute('aria-label', 'Copy Response'); copy.title = 'Copy Response'; }, 2000); },
                                () => { copy.setAttribute('aria-label', 'Copy response failed'); copy.title = 'Copy failed'; });
                    });
                    copy.className = 'dope-chat-copy-response';
                    copy.setAttribute('aria-label', 'Copy Response');
                    copy.setAttribute('aria-live', 'polite');
                    copy.title = 'Copy Response';
                    const icon = document.createElement('span'); icon.className = codicon('copy');
                    icon.setAttribute('aria-hidden', 'true'); copy.append(icon);
                    item.append(copy);
                }
            }
            transcript.append(item);
        }
        if (state.transientUser?.chatId === chat.id) {
            const item = document.createElement('li');
            item.className = 'dope-chat-message dope-chat-message-user';
            item.dataset.color = chat.color;
            item.setAttribute('aria-label', 'You');
            const content = document.createElement('div');
            content.className = 'dope-chat-message-content'; content.textContent = state.transientUser.content;
            item.append(content); transcript.append(item);
        }
        if (state.running && !activeAssistant) {
            const item = document.createElement('li'); item.className = 'dope-chat-message dope-chat-message-assistant';
            item.setAttribute('aria-label', state.stream?.content ? 'Assistant' : 'Assistant working');
            const content = document.createElement('div'); content.className = 'dope-chat-message-content';
            if (state.stream?.content) {
                content.append(renderUntrustedMessageMarkdown(this.markdown, state.stream.content));
            }
            item.append(content); transcript.append(item);
            if (state.runStartedAt) this.appendWorkingStatus(item, state.runStartedAt);
            if (state.runStartedAt) this.appendToolActivity(item, state.toolProgress?.messageId ?? '',
                state.toolProgress?.events, true, state.runStartedAt);
            if (state.pendingCommand && !activeAssistant) {
                const command = this.commandApprovalCard();
                if (command) item.append(command);
            }
        }
        scroll.append(transcript);
        if (this.settingsOpen) scroll.prepend(this.renderSettings(chat.id));
        const latest = this.button('', () => this.scrollToLatest());
        latest.setAttribute('aria-label', 'Scroll to latest'); latest.title = 'Scroll to latest';
        const down = document.createElement('span'); down.className = codicon('chevron-down');
        down.setAttribute('aria-hidden', 'true'); latest.append(down);
        latest.className = 'dope-chat-latest'; latest.hidden = !this.scrollFollow.latestBelow;
        region.append(scroll, latest);
        shell.append(header, region);
        const composer = document.createElement('div'); composer.className = 'dope-chat-composer';
        const input = document.createElement('textarea'); input.rows = 1; input.placeholder = 'Message';
        input.setAttribute('aria-label', 'Message'); input.value = state.draft;
        const toolbar = document.createElement('div'); toolbar.className = 'dope-chat-composer-toolbar';
        const menu = document.createElement('div'); menu.className = 'dope-chat-composer-menu'; menu.popover = 'auto';
        menu.id = `${this.id}-composer-actions`;
        menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', 'Composer actions');
        const more = this.button('+', () => {
            const bounds = more.getBoundingClientRect();
            menu.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - 232))}px`;
            menu.style.bottom = `${window.innerHeight - bounds.top + 6}px`;
            menu.showPopover();
            sources.focus();
        });
        more.className = 'dope-chat-composer-more';
        more.title = 'More actions'; more.setAttribute('aria-label', 'More actions');
        more.setAttribute('aria-haspopup', 'dialog'); more.setAttribute('aria-controls', menu.id);
        more.setAttribute('aria-expanded', 'false');
        menu.addEventListener('toggle', () => more.setAttribute('aria-expanded', String(menu.matches(':popover-open'))));
        menu.addEventListener('focusout', event => {
            if (event.relatedTarget && !menu.contains(event.relatedTarget as Node) && menu.matches(':popover-open'))
                menu.hidePopover();
        });
        const menuButton = (label: string, action: () => void, disabled = false) => {
            const button = this.button(label, () => { menu.hidePopover(); action(); }, disabled);
            menu.append(button);
        };
        const sources = document.createElement('select');
        sources.setAttribute('aria-label', 'Context source');
        for (const kind of chat.settings.context.allowedSources)
            sources.append(new Option(kind.replace(/-/g, ' '), kind));
        menu.append(sources);
        menuButton('Add context', () => void this.addContext(sources.value as ChatContextKind), !sources.options.length);
        for (const kind of ['Ask', 'Explain', 'Trace', 'Find Related'] as const)
            menuButton(kind, () => this.behavior(kind));
        if (state.context.length) menuButton('Clear context', () => state.clearContext());
        menuButton('Follow active planning selection', () => state.followPlanning());
        const pinPlanning = this.button('Pin selected checkpoint / Planning Map', () => {
            menu.hidePopover(); state.pinPlanning();
        }, !state.workspace || !this.planningSelection?.current(state.workspace));
        pinPlanning.className = 'dope-chat-pin-planning';
        menu.append(pinPlanning);
        const modelSelector = document.createElement('select'); modelSelector.setAttribute('aria-label', 'Model for next turn');
        const usable = this.usableModels();
        if (chat.settings.modelPolicy.type === 'follow-interactive') modelSelector.append(new Option('Follow Interactive', ''));
        for (const entry of usable) modelSelector.append(new Option(entry.label, JSON.stringify(entry.selection)));
        const selected = this.selectedModel();
        if (selected) modelSelector.value = JSON.stringify(selected);
        else if (chat.settings.modelPolicy.type === 'follow-interactive' && !state.turnModel) modelSelector.value = '';
        else modelSelector.append(new Option('Selected model unavailable', '', true, true));
        modelSelector.onchange = () => {
            state.turnModel = modelSelector.value ? JSON.parse(modelSelector.value) as ChatModelSelection : undefined;
            this.render();
        };
        const commandLabel = document.createElement('label');
        commandLabel.className = 'dope-chat-command-mode';
        commandLabel.textContent = 'Commands: ';
        const commandMode = document.createElement('select');
        commandMode.setAttribute('aria-label', 'Commands');
        commandMode.append(new Option('Ask', 'ask'), new Option('Allow', 'allow'));
        commandMode.value = state.commandMode;
        commandMode.onchange = () => void state.setCommandMode(commandMode.value as 'ask' | 'allow');
        commandLabel.append(commandMode);
        if (selected && (state.context.length || state.activePlanning)) menuButton('Preview context', () => {
            void state.previewContext(selected).catch(error => { this.status.textContent = String(error); });
        });
        if (!selected && chat.settings.modelPolicy.type === 'exact')
            menuButton('Manage AI connections', () => { void this.aiCenter?.openFromChat(this.id); });
        if (chat.settings.modelPolicy.type === 'follow-interactive')
            menuButton('Configure Interactive role', () => { void this.aiCenter?.openRole('interactive'); });
        menuButton('Refresh models', () => void this.loadModels());
        let submitButton: HTMLButtonElement;
        if (state.running) {
            submitButton = this.button('', () => void state.cancel());
            submitButton.title = 'Cancel'; submitButton.setAttribute('aria-label', 'Cancel');
            const icon = document.createElement('span'); icon.className = codicon('debug-stop');
            icon.setAttribute('aria-hidden', 'true'); submitButton.append(icon);
        } else {
            const retry = [...chat.messages].reverse().find(message => message.role === 'assistant' &&
                ['failed', 'cancelled'].includes(message.execution.status));
            const canSend = Boolean(selected || chat.settings.modelPolicy.type === 'follow-interactive' && !state.turnModel);
            const confirmHosted = () => window.confirm('Send this Chat message, history and selected project context to the hosted model chosen by Interactive?');
            if (state.activePlanning?.kind === 'roadmap-checkpoint' && state.workspace)
                menuButton('Suggest Bridge change (local)', () => {
                    const entered = window.prompt('Affected Architecture branch IDs, comma separated');
                    if (entered === null) return;
                    const branchIds = entered.split(',').map(id => id.trim()).filter(Boolean);
                    if (!branchIds.length) { state.error = 'Select at least one affected Architecture branch'; this.update(); return; }
                    void state.runTurn(state.turnModel, undefined, undefined, branchIds);
                }, !canSend || state.pending || !state.draft.trim());
            if (retry) menuButton('Retry', () => { if (canSend) void state.runTurn(state.turnModel, retry.id, confirmHosted); }, !canSend);
            const submit = () => {
                if (!canSend || state.pending || !state.draft.trim()) return;
                const previousTop = scroll.scrollTop;
                void state.runTurn(state.turnModel, undefined, confirmHosted);
                const current = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
                if (current) current.scrollTop = previousTop;
                this.scrollToLatest();
            };
            submitButton = this.button('', submit, !canSend || state.pending || !state.draft.trim());
            submitButton.title = 'Send'; submitButton.setAttribute('aria-label', 'Send');
            const icon = document.createElement('span'); icon.className = codicon('arrow-up');
            icon.setAttribute('aria-hidden', 'true'); submitButton.append(icon);
            input.onkeydown = event => {
                if (!shouldSendChatInput(event)) return;
                event.preventDefault();
                submit();
            };
        }
        submitButton.classList.add('dope-chat-composer-submit');
        input.oninput = () => {
            state.draft = input.value;
            if (!state.running) submitButton.disabled =
                !(selected || chat.settings.modelPolicy.type === 'follow-interactive' && !state.turnModel) ||
                state.pending || !state.draft.trim();
            resizeChatInput(input);
        };
        toolbar.append(more, modelSelector, commandLabel, submitButton);
        composer.append(input, toolbar);
        const responseNotices = document.createElement('div');
        responseNotices.className = 'dope-chat-response-notices';
        responseNotices.setAttribute('aria-label', 'Chat notices and reviews');
        if (state.running && state.planningProgress?.stage === 'validating') {
            const progress = document.createElement('p');
            progress.className = 'dope-chat-planning-progress';
            progress.setAttribute('role', 'status');
            progress.textContent = 'Validating local planning result…';
            responseNotices.append(progress);
        }
        const planning = document.createElement('div');
        planning.className = 'dope-chat-planning-context';
        const activePlanning = state.activePlanning;
        planning.hidden = !activePlanning;
        planning.textContent = activePlanning ? `${state.planningMode === 'pin' ? 'Pinned' : 'Following active selection'}: ` +
            `${activePlanning.kind === 'roadmap-checkpoint' ? 'checkpoint' : activePlanning.kind === 'roadmap' ? 'Roadmap' : 'Planning Map'} ${activePlanning.id}` : '';
        responseNotices.append(planning);
        if (activePlanning?.kind === 'roadmap') {
            const notice = document.createElement('p');
            notice.className = 'dope-chat-context-diagnostics';
            notice.textContent = 'Roadmap Chat editing is not yet qualified. Review any proposed change before applying it; use Roadmap manual controls for dependable structure edits.';
            responseNotices.append(notice);
        }
        if (state.context.length) {
            const selectedContext = document.createElement('ul');
            selectedContext.className = 'dope-chat-selected-context';
            state.context.forEach((item, index) => {
                const row = document.createElement('li');
                const label = document.createElement('span');
                label.textContent = `${item.kind}: ${item.id}${item.start !== undefined ? `:${item.start}-${item.end}` : ''}`;
                row.append(label, this.button('Remove', () => state.removeContext(index)));
                selectedContext.append(row);
            });
            responseNotices.append(selectedContext);
        }
        if (state.planningProposal) {
            const proposal = state.planningProposal;
            const review = document.createElement('section');
            review.className = 'dope-chat-context-diagnostics dope-chat-plan-review';
            review.setAttribute('aria-label', 'Roadmap proposal review');
            const heading = document.createElement('strong');
            const draftProposal = isDraftPlanningAction(proposal.action.type);
            heading.textContent = `Review ${draftProposal ? 'proposed draft' : 'Roadmap proposal'} · revision ${proposal.revision}`;
            const affected = document.createElement('p');
            affected.textContent = `Affected: ${proposal.changedIds.join(', ')}`;
            const diff = document.createElement('details');
            diff.open = proposal.action.type.includes('.') ||
                ['gate-sequence', 'gate-undo'].includes(proposal.action.type);
            const diffLabel = document.createElement('summary'); diffLabel.textContent = 'Review before and after';
            const diffText = document.createElement('pre'); diffText.textContent = proposal.summary;
            diff.append(diffLabel, diffText);
            review.append(heading, affected, diff,
                this.button(draftProposal ? 'Accept into draft' : 'Apply proposal',
                    () => void state.decidePlanningProposal(true), state.pending),
                this.button('Reject proposal', () => void state.decidePlanningProposal(false), state.pending));
            const source = Array.from(transcript.children).find(item =>
                (item as HTMLElement).dataset.messageId === proposal.messageId);
            if (source) source.append(review);
            else responseNotices.append(review);
        }
        if (state.planningProposalError) {
            const note = document.createElement('p');
            note.setAttribute('role', 'status');
            note.textContent = state.planningProposalError;
            const source = Array.from(transcript.children).find(item =>
                (item as HTMLElement).dataset.messageId === state.planningProposalErrorMessageId);
            if (source) source.append(note);
            else responseNotices.append(note);
        }
        if (state.lastContext) {
            const details = document.createElement('details');
            details.className = 'dope-chat-context-diagnostics';
            const summary = document.createElement('summary');
            summary.textContent = `Context · ${state.lastContext.refs.length} sources · ~${state.lastContext.usedTokens}/${state.lastContext.budgetTokens} estimated tokens`;
            details.append(summary);
            const description = document.createElement('small');
            description.textContent = state.lastContext.diagnostics.map(item =>
                    `${item.source}: ${item.message}`).join(' ');
            details.append(description);
            const included = document.createElement('ul');
            included.setAttribute('aria-label', 'Included context preview');
            for (const ref of state.lastContext.refs) {
                const item = document.createElement('li');
                item.textContent = `${ref.kind}: ${ref.label} (${ref.estimatedTokens} estimated tokens)`;
                included.append(item);
            }
            details.append(included);
            responseNotices.append(details);
        }
        responseNotices.prepend(this.status);
        scroll.append(responseNotices);
        shell.append(composer, menu);
        this.content.append(shell);
        resizeChatInput(input);
        scroll.scrollTop = this.scrollFollow.restore(scrollTop, scroll.scrollHeight, scroll.clientHeight);
        if (this.dragPointerId !== undefined && this.dragChatId === state.chatId) {
            scroll.scrollTop = scrollTop;
            if (this.transcriptDrag.dragging) scroll.classList.add('dope-chat-scroll-dragging');
        }
        if (performance.now() < this.scrollAnimationUntil) {
            scroll.scrollTop = scrollTop;
            this.cancelScrollAnimation?.();
            this.animateLatest(scroll);
        }
        if (this.revealSettings) {
            scroll.scrollTop = 0;
            this.scrollFollow.scrolled(0, scroll.scrollHeight, scroll.clientHeight);
            this.revealSettings = false;
        }
        latest.hidden = !this.scrollFollow.latestBelow;
        this.syncElapsedTicker();
        if (focused) {
            const replacement = [...this.content.querySelectorAll<HTMLElement>('[aria-label]')]
                .find(element => element.getAttribute('aria-label') === focused);
            replacement?.focus({ preventScroll: true });
            if (selection && replacement instanceof HTMLTextAreaElement)
                replacement.setSelectionRange(selection[0], selection[1]);
        }
    }
    override dispose(): void {
        this.stopElapsedTicker();
        this.endTranscriptDrag();
        document.removeEventListener('keydown', this.spacePanKeyDown);
        document.removeEventListener('keyup', this.spacePanKeyUp);
        window.removeEventListener('blur', this.spacePanBlur);
        this.cancelScrollAnimation?.();
        ++this.workspaceRequest;
        ++this.modelsRequest;
        this.rootsListener.dispose();
        this.connectionListener?.dispose();
        this.stopReconnectProbe();
        if (this.workAttachTimer) clearTimeout(this.workAttachTimer);
        this.modelsListener?.dispose();
        this.planningListener?.dispose();
        this.panel.dispose();
        this.controller.dispose();
        super.dispose();
    }
}
