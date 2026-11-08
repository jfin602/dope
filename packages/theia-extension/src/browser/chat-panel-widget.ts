import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { ApplicationShell, type StatefulWidget } from '@theia/core/lib/browser';
import { SingleTextInputDialog } from '@theia/core/lib/browser/dialogs';
import { Emitter, type Event } from '@theia/core/lib/common';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { ConnectionStatus, type ConnectionStatusService } from '@theia/core/lib/browser/connection-status-service';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import URI from '@theia/core/lib/common/uri';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { FileDialogService } from '@theia/filesystem/lib/browser/file-dialog/file-dialog-service';
import type { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import type { ChatOperation } from '@dope/chat/lib/service';
import type { ChatSkill, ChatSkillChange } from '@dope/chat/lib/service';
import { CHAT_COLORS, type ChatSettings, type ChatModelSelection, type ChatAssistantMessage } from '@dope/chat';
import type { ChatContextSelection, ChatEvent, ChatPlanningProposal } from '@dope/chat/lib/service';
import { SoftwareMapController } from './software-map-controller';
import type { ModelConnectionsService, ModelConnectionsSnapshot } from '@dope/contracts/lib/model-connections-service';
import { AICenterContribution } from './ai-center-contribution';
import { ChatOpenOwners, ChatPanelController, chatTree } from './chat-panel-controller';
import type { ChatConnection, ChatTree } from './chat-panel-controller';
import { ChatScrollFollow, ChatTranscriptDrag, LiveAnswerRevealBuffer, LiveAnswerUpdateBatcher, animateChatToLatest, canDragChatTranscript, chatResponseCopyText, chatTranscriptCopyText, chatDiagnosticCopyText, chatActivityPresentation, chatStreamingActivityPresentation, chatToolCallLabel, chatLauncherIds, workLauncherIds, chatPanelWidgetId, panelModule, planningActivityPresentation, planningOutcome, documentationReviewDisplayText, documentationDiscoveryFileUri, implementationPlanAnswer, isDraftPlanningAction, isInlineRoadmapProposal, liveAnswerSource, nativeRoadmapCardStatus, resizeChatInput, resolveChatModel, shouldSendChatInput, hasSendableChatDraft, type ChatActivityDisplay, type ChatPanelOptions } from './chat-panel-presentation';
import { ChatCopyContextMenu } from './chat-copy-context-menu';
import { renderUntrustedMessageMarkdown } from './untrusted-message-markdown';
import { fadeInNewAnswerText } from './live-answer-fade';
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
import { ReasoningRevealBuffer } from './reasoning-reveal';
import type { DocumentsWidget } from './documents-widget';

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

function appendSkillText(target: HTMLElement, content: string,
    skill: { name: string; title?: string; description?: string }): void {
    const command = `/${skill.name}`;
    if (!content.startsWith(command) || content.length > command.length && !/\s/.test(content[command.length])) {
        target.textContent = content; return;
    }
    const token = document.createElement('span'); token.className = 'dope-chat-skill-token';
    token.textContent = command;
    const detail = `${skill.title || skill.name} — ${skill.description || 'Skill used for this turn'}`;
    token.dataset.skillDetail = detail;
    target.append(token, document.createTextNode(content.slice(command.length)));
}

export class ChatPanelWidget extends BaseWidget implements StatefulWidget {
    private viewedDocuments?: DocumentsWidget;
    private readonly copyMenu = new ChatCopyContextMenu();
    private readonly copyFeedbackTimers = new WeakMap<HTMLElement, {
        timer: ReturnType<typeof setTimeout>; label: string | null; title: string | null }>();
    private static readonly toolbarChanged = new Emitter<void>();
    static readonly onDidChangeToolbar = ChatPanelWidget.toolbarChanged.event;
    readonly controller: ChatPanelController;
    readonly panel: SharedPanelState;
    readonly workController?: WorkSelectionController;
    readonly directController?: AgentRunController;
    private composingWork = false;
    private composerResizeObserver?: ResizeObserver;
    private toolbarState = '';
    get canBackToChats(): boolean { return this.panel.mode === 'chat' && this.controller.mode === 'chat'; }
    backToChats(): void { if (this.canBackToChats) this.controller.select(undefined); }
    get canCopyTranscript(): boolean { return this.canBackToChats && !!this.controller.chat?.messages.length; }
    get canOpenChatSettings(): boolean { return this.canBackToChats && !!this.controller.chat; }
    get isChatSettingsOpen(): boolean { return this.canOpenChatSettings && this.settingsOpen; }
    async copyWholeTranscript(): Promise<void> {
        const chat = this.controller.chat;
        if (!this.canCopyTranscript || !chat) return;
        const button = document.getElementById('dope.chat.copyTranscript');
        try {
            await copyChatText(chatTranscriptCopyText(chat, this.controller.stream,
                this.controller.transientUser?.chatId === chat.id ? this.controller.transientUser : undefined));
            if (button) this.flashCopyFeedback(button, 'Copied.');
        } catch { if (button) this.flashCopyFeedback(button, 'Copy failed.'); }
    }
    openTranscriptCopyMenu(anchor: HTMLElement): void {
        this.copyMenu.open(anchor, () => {
            const chat = this.controller.chat;
            return chat && this.canCopyTranscript ? chatDiagnosticCopyText(chat, { transcript: true }, this.controller.stream) : undefined;
        }, copyChatText, message => this.flashCopyFeedback(anchor, message));
    }
    private bindDiagnosticCopy(button: HTMLButtonElement, message: ChatAssistantMessage): void {
        this.copyMenu.bind(button, () => {
            const chat = this.controller.chat;
            return chat && chat.messages.some(item => item.id === message.id && item.role === 'assistant' &&
                item.execution.id === message.execution.id) ?
                chatDiagnosticCopyText(chat, { messageId: message.id }, this.controller.stream) : undefined;
        }, copyChatText, feedback => this.flashCopyFeedback(button, feedback));
    }
    private flashCopyFeedback(button: HTMLElement, message: string): void {
        const previous = this.copyFeedbackTimers.get(button);
        if (previous) clearTimeout(previous.timer);
        const label = previous ? previous.label : button.getAttribute('aria-label');
        const title = previous ? previous.title : button.getAttribute('title');
        button.dataset.copyFeedback = message;
        button.setAttribute('aria-label', message);
        button.setAttribute('title', message);
        const timer = setTimeout(() => {
            delete button.dataset.copyFeedback;
            if (label === null) button.removeAttribute('aria-label');
            else button.setAttribute('aria-label', label);
            if (title === null) button.removeAttribute('title');
            else button.setAttribute('title', title);
            this.copyFeedbackTimers.delete(button);
        }, 2000);
        this.copyFeedbackTimers.set(button, { timer, label, title });
    }
    toggleChatSettings(): void {
        const chat = this.controller.chat;
        if (!this.canOpenChatSettings || !chat) return;
        if (this.settingsOpen) { this.closeChatSettings(); return; }
        this.settingsOpen = true;
        this.settingsEntering = true;
        this.settingsDraft = structuredClone(chat.settings);
        this.settingsChatId = chat.id;
        this.render();
    }
    private skillsOpen = false;
    private skillFormOpen = false;
    private skills?: ChatSkill[];
    private skillsLoading = false;
    private skillEditId?: string;
    private skillName = '';
    private skillTitle = '';
    private skillDescription = '';
    private skillBody = '';
    private skillError = '';
    private async loadSkills(): Promise<void> {
        if (this.skillsLoading) return;
        this.skillsLoading = true;
        try { this.skills = await this.controller.listSkills(); this.skillError = ''; }
        catch (error) { this.skillError = String(error); }
        finally { this.skillsLoading = false; this.render(); }
    }
    private async changeSkill(change: ChatSkillChange): Promise<void> {
        try {
            this.skills = await this.controller.changeSkill(change);
            this.skillError = ''; this.skillEditId = undefined;
            this.skillName = ''; this.skillTitle = ''; this.skillDescription = ''; this.skillBody = '';
            this.skillFormOpen = false;
        } catch (error) { this.skillError = String(error); }
        this.render();
    }
    private openSkills(): void {
        this.skillsOpen = true;
        if (this.controller.mode === 'chat') this.controller.select(undefined);
        if (!this.skills && !this.skillsLoading) void this.loadSkills();
        this.render();
    }
    private closeSkills(): void {
        this.skillsOpen = false; this.skillFormOpen = false; this.skillEditId = undefined; this.skillError = '';
        this.render();
    }
    private settingsEntering = false;
    private settingsClosing = false;
    private closeChatSettings(): void {
        if (this.settingsClosing) return;
        this.settingsClosing = true;
        const finish = () => {
            if (!this.settingsClosing) return;
            this.settingsClosing = false;
            this.settingsOpen = false;
            this.settingsEntering = false;
            this.settingsDraft = undefined;
            this.render();
        };
        const overlay = this.content.querySelector<HTMLElement>('.dope-chat-settings-overlay');
        if (!overlay || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { finish(); return; }
        const backdrop = this.content.querySelector<HTMLElement>('.dope-chat-settings-backdrop');
        backdrop?.animate([{ opacity: 1 }, { opacity: 0 }],
            { duration: 140, easing: 'ease-in', fill: 'forwards' });
        void overlay.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
            { duration: 140, easing: 'ease-in', fill: 'forwards' }).finished.then(finish, finish);
    }
    private viewedProposal?: { uri: string; chatId: string; id: string; proposal: ChatPlanningProposal };
    private autoPreviewTurn?: { uri: string; chatId: string };
    private readonly autoPreviewedProposals = new Set<string>();
    private readonly openPlanningActivities = new Set<string>();
    private readonly openResponseInfo = new Set<string>();
    private readonly activityExpansion = new Map<string, boolean>();
    private readonly activityAutoCollapsed = new Set<string>();
    private liveReasoning?: { key: string; body: HTMLElement; runs: Array<{
        kind: 'thinking' | 'provisional' | 'tool'; raw: string; node: HTMLElement;
        buffer?: ReasoningRevealBuffer }> };
    private readonly answerBatcher = new LiveAnswerUpdateBatcher(() => {
        const before = this.liveAnswerReveal.current();
        if (!this.updateLiveStreamAnswer()) this.render();
        if (this.liveAnswerReveal.pending() && this.liveAnswerReveal.current() !== before)
            this.answerBatcher.request();
    });
    private readonly liveAnswerReveal = new LiveAnswerRevealBuffer();
    private liveAnswerVisible?: { key: string; text: string };
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
    private transcriptTouchChatId?: string;
    private transcriptTouchActive = false;
    private transcriptTouchMoved = false;
    private transcriptTouchSettleTimer?: ReturnType<typeof setTimeout>;
    private transcriptRenderPending = false;

    /** Replacing the scroll node during a native swipe cancels touch momentum. */
    private settleTranscriptTouch(): void {
        if (this.transcriptTouchSettleTimer) clearTimeout(this.transcriptTouchSettleTimer);
        this.transcriptTouchSettleTimer = setTimeout(() => {
            this.transcriptTouchSettleTimer = undefined;
            this.transcriptTouchChatId = undefined;
            if (this.transcriptRenderPending) {
                this.transcriptRenderPending = false;
                this.render();
            }
        }, 160);
    }

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
        private readonly fileDialogs?: FileDialogService, private readonly files?: FileService,
        private readonly viewRoadmapProposal?: (uri: string, chatId: string, proposal: ChatPlanningProposal,
            isCurrent: () => boolean, activate?: boolean) => Promise<void>,
        private readonly clearRoadmapProposal?: (uri: string, chatId: string, proposalId: string,
            accepted: boolean, changedIds: string[]) => Promise<void>,
        private readonly roadmapPicker?: { available: (projectUri: string) => boolean;
            active?: () => boolean;
            begin: (projectUri: string) => Promise<ChatContextSelection[] | undefined> },
        private readonly onRoadmapStage?: (event: Extract<ChatEvent, { kind: 'roadmap-stage' }>, workspace: string) => void,
        private readonly viewLiveRoadmapStage?: (uri: string,
            readLatest: () => Promise<NonNullable<ChatPanelController['roadmapStage']>>) => Promise<void>,
        private readonly openDocumentationReview?: (uri: string, owner: ChatPanelController,
            proposalId: string, digest: string) => Promise<DocumentsWidget>) {
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
        this.controller = new ChatPanelController(connect, kind => {
            this.viewedDocuments?.refreshReview();
            if (kind === 'activity' && !this.transcriptTouchActive && !this.transcriptTouchSettleTimer &&
                this.updateLiveStreamActivity()) return;
            if (kind === 'answer' && !this.transcriptTouchActive && !this.transcriptTouchSettleTimer) {
                const stream = this.controller.stream;
                if (stream?.content) {
                    const saved = this.controller.chat?.messages.find(message => message.id === stream.messageId);
                    const partial = saved?.role === 'assistant' ? saved : undefined;
                    const key = `${stream.chatId}:${stream.messageId}:${stream.executionId}:${partial?.answerPartial?.cursor ?? 0}`;
                    this.liveAnswerReveal.update(key, liveAnswerSource(partial, stream.content));
                }
                this.answerBatcher.request(!this.liveAnswerVisible && !!stream?.content); return;
            }
            this.render();
        }, owners, this.id,
            () => { void this.shell.activateWidget(this.id); }, planningSelection, (event, workspace) => {
                onRoadmapStage?.(event, workspace);
                this.updateLiveStageNotice();
            });
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
        this.planningListener = planningSelection?.onChange(() => this.render());
        this.initialAttach = this.attach();
        if (this.module === 'chat') void this.loadModels();
    }

    private syncViewedProposal(): void {
        const viewed = this.viewedProposal;
        if (!viewed) return;
        const state = this.controller;
        if (state.workspace === viewed.uri && state.chatId === viewed.chatId &&
            state.planningProposal?.id === viewed.id) {
            if (state.planningProposal !== viewed.proposal) {
                if (state.planningProposal.preview) void this.viewCurrentRoadmapProposal(state.planningProposal);
                else { this.viewedProposal = undefined;
                    void this.clearRoadmapProposal?.(viewed.uri, viewed.chatId, viewed.id, false, []); }
            }
            return;
        }
        this.viewedProposal = undefined;
        const decision = state.planningDecision?.id === viewed.id ? state.planningDecision : undefined;
        void this.clearRoadmapProposal?.(viewed.uri, viewed.chatId, viewed.id,
            decision?.status === 'accepted', decision?.changedIds ?? []).catch(() => {});
    }

    private syncAutoRoadmapPreview(): void {
        const state = this.controller;
        const uri = state.workspace, chatId = state.chatId;
        if (state.running) {
            this.autoPreviewTurn = uri && chatId ? { uri, chatId } : undefined;
            return;
        }
        const arriving = this.autoPreviewTurn;
        if (!arriving) return;
        this.autoPreviewTurn = undefined;
        const proposal = state.planningProposal;
        if (!uri || !chatId || !proposal || arriving.uri !== uri || arriving.chatId !== chatId ||
            proposal.chatId !== chatId || !state.canViewPlanningProposal(proposal.id) ||
            !this.roadmapPicker?.active?.()) return;
        const key = `${uri}:${chatId}:${proposal.id}`;
        if (this.autoPreviewedProposals.has(key)) return;
        this.autoPreviewedProposals.add(key);
        void this.viewCurrentRoadmapProposal(proposal, true);
    }

    /** Refresh the current assistant card in place so batches never rerender the composer or move focus. */
    private updateLiveStageNotice(): void {
        const state = this.controller, stage = state.running ? state.roadmapStage : undefined;
        const transcript = this.content.querySelector<HTMLElement>('.dope-chat-transcript');
        if (!transcript) return;
        const old = transcript.querySelector<HTMLElement>('.dope-chat-native-live');
        if (!stage || !state.workspace) { old?.remove(); return; }
        const item = [...transcript.querySelectorAll<HTMLElement>('.dope-chat-message-assistant')]
            .find(row => row.dataset.messageId === stage.turnId);
        const content = item?.querySelector<HTMLElement>('.dope-chat-message-content');
        if (!content) return;
        let card = old;
        if (!card || !content.contains(card)) {
            old?.remove();
            card = this.nativeRoadmapSummaryCard('Generating', stage.counts, [], undefined,
                this.viewLiveRoadmapStage ? { run: () => { void (async () => {
                    try {
                        await state.readCurrentRoadmapStage();
                        const uri = state.workspace;
                        if (!uri) throw new Error('Project changed before Roadmap navigation');
                        await this.viewLiveRoadmapStage!(uri, () => state.readCurrentRoadmapStage());
                    } catch (error) {
                        state.roadmapStageError = `Roadmap preview unavailable: ${String(error)}`;
                        this.updateLiveStageNotice();
                    }
                })(); } } : undefined);
            card.classList.add('dope-chat-native-live');
            card.setAttribute('role', 'status');
            card.setAttribute('aria-live', 'polite');
            content.append(card);
        }
        card.querySelector('strong')!.textContent = 'Roadmap · Generating';
        card.querySelector('p')!.textContent = `${stage.counts.phases} Phases · ${stage.counts.gates} Gates · ` +
            `${stage.counts.criteria} Criteria · ${stage.complete ? 'Final validation pending' : 'Incomplete'}`;
        let note = card.querySelector<HTMLElement>('[role="alert"]');
        const warning = state.roadmapStageError || (stage.incompletePhaseIds.length ?
            `${stage.incompletePhaseIds.length} Phase(s) still need Gates` : undefined);
        if (warning) {
            if (!note) { note = document.createElement('p'); note.setAttribute('role', 'alert'); card.append(note); }
            note.textContent = warning;
        } else note?.remove();
    }

    private async viewCurrentRoadmapProposal(proposal: ChatPlanningProposal, automatic = false): Promise<void> {
        const state = this.controller;
        const uri = state.workspace, chatId = state.chatId;
        const active = () => !automatic || !!this.roadmapPicker?.active?.();
        if (!uri || !chatId || !state.canViewPlanningProposal(proposal.id) || !this.viewRoadmapProposal ||
            !active()) return;
        const viewed = { uri, chatId, id: proposal.id, proposal };
        this.viewedProposal = viewed;
        try {
            await this.viewRoadmapProposal(uri, chatId, proposal, () =>
                this.viewedProposal === viewed && state.workspace === uri && state.chatId === chatId &&
                state.canViewPlanningProposal(proposal.id) && active(), !automatic);
        } catch (error) {
            if (this.viewedProposal !== viewed) return;
            this.viewedProposal = undefined;
            void this.clearRoadmapProposal?.(uri, chatId, proposal.id, false, []).catch(() => {});
            if (automatic && !active()) return;
            state.planningProposalError = `Roadmap preview unavailable: ${String(error)}. Refresh the selection and retry.`;
            state.planningProposalErrorMessageId = proposal.messageId;
            this.render();
        }
    }
    private nativeRoadmapSummaryCard(status: string, counts?: { phases: number; gates: number; criteria: number },
        warnings: readonly string[] = [], diagnostic?: string,
        view?: { run: () => void; disabled?: boolean },
        operations?: NonNullable<ChatPlanningProposal['operations']>): HTMLElement {
        const card = document.createElement('section');
        card.className = 'dope-chat-plan-review dope-chat-native-summary';
        card.dataset.status = status.toLowerCase().split(' ')[0];
        card.setAttribute('aria-label', `Roadmap proposal: ${status}`);
        const heading = document.createElement('strong'); heading.textContent = `Roadmap · ${status}`;
        const totals = document.createElement('p');
        const operationCount = (state: string) => operations?.filter(operation => operation.status === state).length ?? 0;
        const decisions = operations ? [
            ['Applied', operationCount('Applied')], ['Rejected', operationCount('Rejected')],
            ['Pending', operationCount('Pending')],
        ].filter(([, count]) => count) : [];
        totals.textContent = operations ? decisions.length ? decisions.map(([label, count]) =>
            `${count} ${label} operation${count === 1 ? '' : 's'}`).join(' · ') :
            `${operations.length} operations · status in Details` :
            counts ? `${counts.phases} proposed Phases · ${counts.gates} Gates · ${counts.criteria} Criteria` :
            'Roadmap counts unavailable';
        card.append(heading, totals);
        if (warnings.length || diagnostic || counts || operations) {
            const details = document.createElement('details');
            const label = document.createElement('summary');
            label.textContent = warnings.length ? `Details · ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : 'Details';
            details.append(label);
            if (counts) {
                const proposed = document.createElement('p');
                proposed.textContent = `Recorded Roadmap totals: ${counts.phases} Phases · ${counts.gates} Gates · ` +
                    `${counts.criteria} Criteria. These totals are not applied counts.`;
                details.append(proposed);
            }
            for (const operation of operations ?? []) {
                const row = document.createElement('p');
                row.textContent = `${operation.type} · ${operation.status}`;
                details.append(row);
            }
            for (const warning of warnings) {
                const line = document.createElement('p'); line.className = 'dope-chat-native-warning';
                line.textContent = warning; details.append(line);
            }
            if (diagnostic) {
                const note = document.createElement('p'); note.textContent = diagnostic.slice(0, 2048);
                details.append(note);
            }
            card.append(details);
        }
        if (view) {
            const action = this.button('View in Roadmap', view.run, !!view.disabled);
            action.className = 'dope-chat-native-view';
            card.append(action);
        }
        return card;
    }
    private roadmapProposalReviewCard(proposal: ChatPlanningProposal): HTMLElement {
        const state = this.controller;
        const review = document.createElement('section');
        review.className = 'dope-chat-plan-review';
        review.setAttribute('role', 'dialog');
        review.setAttribute('aria-label', 'Roadmap proposal review');
        if (proposal.publication) {
            const publication = proposal.publication;
            const title = document.createElement('strong');
            title.textContent = publication.mode === 'publish' ? 'Publish New Markdown' : 'Link Existing Markdown';
            const facts = document.createElement('p');
            facts.textContent = `${publication.path} · Roadmap revision ${proposal.revision} · SHA-256 ${publication.sourceHash}`;
            const counts = document.createElement('p');
            counts.textContent = `${publication.phaseCount} Phases · ${publication.gateCount} Gates · ${publication.criterionCount} Criteria`;
            review.append(title, facts, counts);
            for (const warning of [...publication.warnings, ...(publication.diagnostics ?? [])]) {
                const row = document.createElement('p'); row.textContent = warning; review.append(row);
            }
            if (publication.content !== undefined) {
                const details = document.createElement('details');
                const label = document.createElement('summary');
                label.textContent = 'Generated Markdown preview (first 16,000 characters)';
                const body = document.createElement('pre'); body.textContent = publication.content;
                details.append(label, body); review.append(details);
            } else {
                const compatible = document.createElement('p');
                compatible.textContent = 'Existing file is compatible. Approval links it without rewriting its bytes.';
                review.append(compatible);
            }
            const decisions = document.createElement('div'); decisions.className = 'dope-chat-plan-review-actions';
            decisions.append(this.button('Approve', () => void state.decidePlanningProposal(true), state.pending),
                this.button('Reject', () => void state.decidePlanningProposal(false), state.pending));
            review.append(decisions);
            return review;
        }
        if (proposal.operations) return this.nativeRoadmapSummaryCard(proposal.preview &&
            proposal.operations.some(item => item.status === 'Pending') ? 'Ready' : 'Stale', proposal.counts,
            proposal.warnings, proposal.summary, this.viewRoadmapProposal ? {
                run: () => void this.viewCurrentRoadmapProposal(proposal),
                disabled: !state.canViewPlanningProposal(proposal.id) } : undefined, proposal.operations);
        const heading = document.createElement('strong');
        const draftProposal = isDraftPlanningAction(proposal.action.type);
        heading.textContent = proposal.preview ? 'Proposed Roadmap Change' :
            `Review ${draftProposal ? 'proposed draft' : 'Roadmap proposal'} · revision ${proposal.revision}`;
        const affected = document.createElement('p');
        affected.textContent = proposal.preview ? `Proposed · Not applied · Roadmap revision ${proposal.revision}` :
            `Affected: ${proposal.changedIds.join(', ')}`;
        if (proposal.preview) {
            const preview = proposal.preview;
            const steps = document.createElement('p');
            steps.textContent = `${preview.steps.length || 1} action${preview.steps.length === 1 ? '' : 's'} · ` +
                `${preview.totalChanged} changed element${preview.totalChanged === 1 ? '' : 's'}`;
            review.append(steps);
            for (const step of preview.steps) {
                const line = document.createElement('p');
                line.className = 'dope-chat-proposal-step';
                line.textContent = `${step.type.replace('.', ' ')} · ${step.title}`;
                review.append(line);
            }
            const expanded = document.createElement('details');
            const expandedLabel = document.createElement('summary');
            expandedLabel.textContent = `${Math.max(0, preview.entities.length - 3)} more changed elements`;
            expanded.append(expandedLabel);
            for (const [index, change] of preview.entities.entries()) {
                const value = change.after ?? change.before;
                if (!value) continue;
                const card = document.createElement('section');
                card.className = 'dope-chat-roadmap-element-preview';
                card.dataset.action = change.action;
                card.setAttribute('aria-label', `${change.action} ${value.kind}: ${value.title ?? value.id}`);
                const context = document.createElement('small');
                const parent = value.parentId ? preview.parentTitles[value.parentId] ?? value.parentId : undefined;
                context.textContent = `${value.kind}${value.designation ? ` ${value.designation}` : ''} · ` +
                    `${change.action}${parent ? ` · ${parent}` : ''}`;
                const title = document.createElement('strong'); title.textContent = value.title ?? value.id;
                card.append(context, title);
                const field = (label: string, before: unknown, after: unknown) => {
                    if (JSON.stringify(before) === JSON.stringify(after)) return;
                    const row = document.createElement('p');
                    row.textContent = change.action === 'edit' ?
                        `${label}: ${before ?? 'none'} → ${after ?? 'none'}` :
                        `${label}: ${change.action === 'delete' ? before : after}`;
                    card.append(row);
                };
                if (change.action === 'edit') field('Title', change.before?.title, change.after?.title);
                field(value.kind === 'gate' ? 'Purpose' : value.kind === 'criterion' ? 'Expected result' : 'Objective',
                    change.before?.detail, change.after?.detail);
                field('Parent', change.before?.parentId && (preview.parentTitles[change.before.parentId] ?? change.before.parentId),
                    change.after?.parentId && (preview.parentTitles[change.after.parentId] ?? change.after.parentId));
                field('Order', change.before?.order, change.after?.order);
                field('Dependencies', change.before?.dependencies?.join(', '), change.after?.dependencies?.join(', '));
                if (change.action === 'create' && value.criteria?.length) {
                    const list = document.createElement('ul');
                    for (const criterion of value.criteria) {
                        const item = document.createElement('li');
                        item.textContent = `${criterion.title} — ${criterion.expectedResult}`;
                        list.append(item);
                    }
                    card.append(list);
                    if (value.additionalCriteria) {
                        const more = document.createElement('p');
                        more.textContent = `${value.additionalCriteria} additional criteria in diagnostic diff`;
                        card.append(more);
                    }
                }
                if (index < 3) review.append(card);
                else expanded.append(card);
            }
            if (preview.entities.length > 3) review.append(expanded);
            if (preview.additionalChanges) {
                const more = document.createElement('p');
                more.textContent = `${preview.additionalChanges} additional changed elements. See full diagnostic diff.`;
                review.append(more);
            }
            if (preview.sourceChanges?.length) {
                const source = document.createElement('div');
                source.className = 'dope-chat-proposal-source';
                const label = document.createElement('strong'); label.textContent = 'Linked Markdown · source-owned field';
                source.append(label);
                for (const line of preview.sourceChanges) {
                    const row = document.createElement('p'); row.textContent = `${line.before} → ${line.after}`;
                    source.append(row);
                }
                if (preview.additionalSourceChanges) {
                    const more = document.createElement('p');
                    more.textContent = `${preview.additionalSourceChanges} additional source changes in diagnostic diff`;
                    source.append(more);
                }
                review.append(source);
            }
        }
        const diff = document.createElement('details');
        diff.open = !proposal.preview && (proposal.action.type.includes('.') ||
            ['gate-sequence', 'gate-undo'].includes(proposal.action.type));
        const diffLabel = document.createElement('summary'); diffLabel.textContent = proposal.previewOnly ?
            'Validation summary' : proposal.preview ? 'Full diagnostic diff' : 'Review before and after';
        const diffText = document.createElement('pre'); diffText.textContent = proposal.summary;
        diff.append(diffLabel, diffText);
        const decisions = document.createElement('div');
        decisions.className = 'dope-chat-plan-review-actions';
        if (proposal.preview && proposal.revision >= 0 && this.viewRoadmapProposal) {
            const view = this.button('View in Roadmap', () => void this.viewCurrentRoadmapProposal(proposal),
                !state.canViewPlanningProposal(proposal.id));
            decisions.append(view);
        }
        if (proposal.previewOnly) {
            const pending = document.createElement('p');
            pending.textContent = 'Validated preview only · Review decisions are not available yet.';
            decisions.append(pending);
        } else decisions.append(
            this.button(draftProposal ? 'Accept into draft' : 'Apply proposal',
                () => void state.decidePlanningProposal(true), state.pending),
            this.button('Reject proposal', () => void state.decidePlanningProposal(false), state.pending));
        review.prepend(heading, affected);
        review.append(diff, decisions);
        return review;
    }

    /** Saved review data is display-only; only controller.planningProposal can expose decision buttons. */
    private savedRoadmapProposalCard(message: ChatAssistantMessage): HTMLElement | undefined {
        const activity = message.planningActivity;
        if (activity?.kind === 'documentation-proposal' && activity.documentProposal) {
            const card = document.createElement('section');
            card.className = 'dope-chat-plan-review dope-chat-proposal-history';
            card.dataset.status = activity.status;
            card.setAttribute('aria-label', 'Documentation review proposal');
            const heading = document.createElement('strong');
            heading.textContent = `Documentation review${(activity.documentProposal.proposalRevision ?? 1) > 1 ?
                ` · Revision ${activity.documentProposal.proposalRevision}` : ''} · ${activity.status === 'pending' ? 'Pending · no write' :
                activity.status === 'applied' ? 'Applied' : activity.status}`;
            card.append(heading);
            const summary = document.createElement('p');
            summary.textContent = `${activity.documentProposal.targets.length} proposed file change(s)`;
            card.append(summary);
            if (activity.documentationDiscovery) {
                const discovery = activity.documentationDiscovery;
                const section = document.createElement('details');
                section.className = 'dope-chat-documentation-discovery';
                const title = document.createElement('summary');
                title.textContent = 'Documentation Discovery';
                section.append(title);
                const counts = document.createElement('p');
                counts.textContent = `Detected documentation files: ${discovery.detected ?? 'Unavailable'} · Files read: ${discovery.reads.length}`;
                section.append(counts);
                if (discovery.omitted.length) {
                    const warning = document.createElement('p');
                    warning.textContent = `Inventory limits: ${discovery.omitted.join('; ')}`;
                    section.append(warning);
                }
                const table = document.createElement('table');
                const header = document.createElement('tr');
                for (const label of ['File', 'Reads']) {
                    const cell = document.createElement('th'); cell.textContent = label; header.append(cell);
                }
                table.append(header);
                const error = document.createElement('p');
                error.setAttribute('role', 'status');
                for (const read of discovery.reads) {
                    const row = document.createElement('tr');
                    const file = document.createElement('td');
                    const link = document.createElement('a');
                    link.href = '#'; link.textContent = read.path;
                    link.onclick = event => {
                        event.preventDefault();
                        void this.openDocumentationDiscoveryFile(activity.documentProposal!.root, read.path, error);
                    };
                    file.append(link);
                    const count = document.createElement('td'); count.textContent = String(read.count);
                    row.append(file, count); table.append(row);
                }
                if (!discovery.reads.length) {
                    const empty = document.createElement('p'); empty.textContent = 'No successful document reads.';
                    section.append(empty);
                } else section.append(table);
                section.append(error);
                card.append(section);
            }
            const note = document.createElement('p');
            note.textContent = activity.status === 'pending' ?
                'Review only. Apply requires a separate developer decision and will recheck every source.' :
                activity.status === 'approved' ? 'Approval recorded. Recover and verify the application outcome.' :
                activity.status === 'denied' ? 'You rejected this documentation proposal. No document was changed.' :
                activity.status === 'stale' ? 'This unapproved proposal is stale. No document was changed by it. Review current source again.' :
                activity.diagnostic ?? 'This proposal was not fully applied. Check History for any verified retained changes.';
            if (activity.status !== 'applied') card.append(note);
            if (activity.status === 'pending') {
                card.append(this.button('Open Review', () => {
                    const uri = this.controller.workspace;
                    if (!uri || !this.openDocumentationReview) return;
                    void this.openDocumentationReview(uri, this.controller, activity.proposalId!,
                        activity.documentProposal!.digest).then(widget => { this.viewedDocuments = widget; }, error => {
                            this.controller.planningProposalError = `Documentation review unavailable: ${String(error)}`;
                            this.render();
                        });
                }, !this.openDocumentationReview || !this.controller.canDecideDocumentation(
                    activity.proposalId!, activity.documentProposal.digest)));
                card.append(this.button('Accept',
                    () => void this.controller.applyDocumentationProposal(activity.proposalId!, activity.documentProposal!.digest),
                    !this.controller.canDecideDocumentation(activity.proposalId!, activity.documentProposal.digest)));
                card.append(this.button('Reject',
                    () => void this.controller.dismissDocumentationProposal(activity.proposalId!, 'deny'),
                    !this.controller.canDecideDocumentation(activity.proposalId!, activity.documentProposal.digest)));
                card.append(this.button('Revise Proposal', () => {
                    if (this.controller.prepareDocumentationRevision(activity.proposalId!, activity.documentProposal!.digest))
                        queueMicrotask(() => this.content.querySelector<HTMLTextAreaElement>('.dope-chat-composer textarea')?.focus());
                }, !this.controller.canDecideDocumentation(activity.proposalId!, activity.documentProposal.digest)));
            } else if (activity.status === 'approved') {
                card.append(this.button('Recover application',
                    () => void this.controller.recoverDocumentationProposal(activity.proposalId!), this.controller.pending));
            }
            return card;
        }
        if (!activity || !['roadmap-gate-proposal', 'roadmap-gate-undo', 'roadmap-publication'].includes(activity.kind))
            return undefined;
        if (activity.status === 'pending' && this.controller.planningProposal?.messageId === message.id)
            return this.roadmapProposalReviewCard(this.controller.planningProposal);
        const proposal = activity.proposal;
        if (proposal?.operations) {
            const applied = proposal.operations.some(operation => operation.status === 'Applied');
            const rejected = proposal.operations.some(operation => operation.status === 'Rejected');
            const status = activity.status === 'applied' && applied && rejected ? 'Partially applied' :
                nativeRoadmapCardStatus(activity.status, false);
            return this.nativeRoadmapSummaryCard(status, proposal.counts, proposal.warnings,
                activity.status === 'applied' ? undefined : activity.diagnostic ?? proposal.summary,
                undefined, proposal.operations);
        }
        const status = activity.status === 'applied' ? 'Applied' :
            activity.status === 'denied' ? 'Rejected · no change' :
            activity.status === 'rejected' && activity.proposalId ? 'Failed · no change' :
            activity.status === 'rejected' ? 'Denied · no change' :
            activity.status === 'stale' ? 'Stale' :
            activity.status === 'superseded' ? 'Superseded' :
            activity.status === 'pending' ? proposal?.previewOnly ? 'Validated preview · no change' :
                'Pending · review unavailable' :
            activity.status === 'cancelled' ? 'Cancelled' : 'Failed';
        const card = document.createElement('section');
        card.className = 'dope-chat-plan-review dope-chat-proposal-history';
        card.dataset.status = status.split(' ')[0].toLowerCase();
        card.setAttribute('aria-label', `Roadmap proposal: ${status}`);
        const heading = document.createElement('div');
        heading.className = 'dope-chat-proposal-history-heading';
        const mark = document.createElement('span');
        mark.className = 'dope-chat-proposal-history-mark';
        mark.setAttribute('aria-hidden', 'true');
        mark.textContent = activity.status === 'applied' ? '✓' :
            activity.status === 'stale' || activity.status === 'pending' ? '!' :
            activity.status === 'rejected' ? '×' : '•';
        const action = document.createElement('strong');
        const step = proposal?.preview?.steps[0];
        action.textContent = activity.kind === 'roadmap-gate-undo' ? 'Roadmap undo' :
            activity.kind === 'roadmap-publication' ?
                `${proposal?.publication?.mode === 'link' ? 'Linked existing' : 'Published new'} Markdown · ${proposal?.publication?.path ?? 'Roadmap'}` :
                'Proposed Roadmap Change';
        const result = document.createElement('span');
        result.textContent = `${status}${activity.appliedRevision === undefined ? '' : ` · revision ${activity.appliedRevision}`}`;
        heading.append(mark, action, result);
        if (step) {
            const change = document.createElement('p');
            change.className = 'dope-chat-proposal-step';
            change.textContent = `${step.type.replace('.', ' ')} · ${step.title}`;
            card.append(heading, change);
        } else card.append(heading);
        if (activity.diagnostic) {
            const diagnostic = document.createElement('p');
            diagnostic.className = 'dope-chat-proposal-diagnostic';
            diagnostic.setAttribute('role', 'status');
            diagnostic.textContent = activity.diagnostic;
            card.append(diagnostic);
        }
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = 'Details';
        summary.onkeydown = event => {
            if (event.key !== ' ' && event.key !== 'Spacebar') return;
            event.preventDefault();
            details.open = !details.open;
        };
        details.append(summary);
        if (proposal) {
            const basis = document.createElement('p');
            basis.textContent = `Review basis: Roadmap revision ${proposal.revision}${proposal.sourceHash ?
                ` · linked source SHA-256 ${proposal.sourceHash}` : ''}.`;
            details.append(basis);
            for (const step of proposal.preview?.steps ?? []) {
                const row = document.createElement('p');
                row.className = 'dope-chat-proposal-step';
                row.textContent = `${step.type.replace('.', ' ')} · ${step.title}`;
                details.append(row);
            }
            for (const entity of proposal.preview?.entities ?? []) {
                const row = document.createElement('p');
                const before = entity.before, after = entity.after;
                row.textContent = `${entity.action} ${after?.kind ?? before?.kind ?? 'element'}: ` +
                    `${before?.title ?? before?.id ?? 'new'} → ${after?.title ?? after?.id ?? 'removed'}` +
                    `${before?.detail !== after?.detail ? ` · ${before?.detail ?? 'none'} → ${after?.detail ?? 'none'}` : ''}`;
                details.append(row);
            }
            for (const change of proposal.preview?.sourceChanges ?? []) {
                const row = document.createElement('p');
                row.textContent = `Linked source: ${change.before} → ${change.after}`;
                details.append(row);
            }
            const diff = document.createElement('pre');
            diff.textContent = proposal.summary;
            details.append(diff);
        } else {
            const fallback = document.createElement('p');
            fallback.textContent = 'Older saved activity has no review details. This card cannot apply a change.';
            details.append(fallback);
        }
        card.append(details);
        return card;
    }

    private async openDocumentationDiscoveryFile(root: string, path: string, error: HTMLElement): Promise<void> {
        error.textContent = '';
        const workspace = this.panel.workspace;
        const target = workspace && documentationDiscoveryFileUri(workspace, root, path);
        if (!target || !this.editors || !this.files) {
            error.textContent = 'This file cannot be opened from the current project.'; return;
        }
        try {
            const base = new URI(workspace!);
            let part = base;
            for (const segment of path.split('/')) {
                part = part.resolve(segment);
                const stat = await this.files.resolve(part);
                if (stat.isSymbolicLink) throw new Error('Unsafe linked path');
            }
            const stat = await this.files.resolve(new URI(target));
            if (stat.isDirectory) throw new Error('Path is a directory');
            await this.editors.open(new URI(target), { mode: 'activate', preview: false });
        } catch {
            error.textContent = 'File unavailable or unsafe to open. The proposal is unchanged.';
        }
    }
    private roadmapActionCard(message: ChatAssistantMessage): HTMLElement | undefined {
        const action = message.roadmapAction, state = this.controller;
        if (!action || action.chatId !== state.chatId || !state.workspace ||
            action.sourceMessageId !== undefined && action.sourceMessageId !== message.id) return undefined;
        const card = document.createElement('section');
        card.className = 'dope-chat-roadmap-offer';
        card.setAttribute('aria-label', 'Roadmap action');
        const heading = document.createElement('strong');
        const note = document.createElement('p'); note.setAttribute('role', 'status');
        const actions = document.createElement('div'); actions.className = 'dope-chat-roadmap-offer-actions';
        const status = action.status;
        if (status === 'offered') {
            heading.textContent = 'Create Roadmap Draft';
            note.textContent = 'This saved offer is no longer active. To generate a Roadmap, submit /gen-roadmap with a prompt in Chat.';
            const generate = this.button('Write generation command', () => state.prefillRoadmapGeneration(),
                state.pending || state.running);
            generate.className = 'dope-chat-roadmap-offer-primary';
            actions.append(generate);
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
                if (run.resumedFrom)
                    detail(`Resumed from run ${run.resumedFrom.runId} · restored candidate ${run.resumedFrom.candidateFingerprint.slice(0, 12)}`, 'dope-work-detail');
                const resume = controller.resumePreview;
                if (resume?.sourceRunId === run.id && resume.eligible && !controller.resumeOpen)
                    primary('Resume from saved candidate', () => void controller.openResumePreview(), !controller.resumeBusy);
                if (resume?.sourceRunId === run.id && controller.resumeOpen && resume.task) {
                    const section = document.createElement('section'); section.className = 'dope-work-review';
                    const title = document.createElement('h3'); title.textContent = 'Review saved candidate continuation'; section.append(title);
                    const facts = [
                        `Task: ${resume.task.objective}`,
                        `Original run: ${run.id} · ${run.status}`,
                        `Source HEAD: ${run.basis?.head ?? 'unknown'}`,
                        `Verified candidate: ${resume.candidateFingerprint}`,
                        `Change counts: ${resume.effects?.effects.filter(effect => effect.kind === 'create').length ?? 0} created, ` +
                            `${resume.effects?.effects.filter(effect => effect.kind === 'modify').length ?? 0} modified`,
                        `Changes: ${resume.effects?.effects.map(effect => `${effect.kind} ${effect.path}`).join(', ') ?? 'none'}`,
                        `Uncertain prior commands: ${resume.uncertainCommands?.join(', ') || 'none recorded'}${resume.transcriptIncomplete ? ' · transcript incomplete' : ''}. None will be replayed.`,
                        `Selected model: ${controller.resumeTarget?.modelId ?? 'Unavailable'}`,
                        `Fresh grant: workspace read, write, process, test, build; project create and modify` +
                            (resume.task.origin.kind === 'work-item' ?
                                ` within delegated paths: ${resume.task.origin.scope.delegablePaths.join(', ')}` : ''),
                        `Validation: ${resume.task.completion.validation.map(target => target.label).join(', ')}`,
                        'Restored changes require normal validation and human candidate review before application.'
                    ];
                    for (const fact of facts) { const item = document.createElement('p'); item.className = 'dope-work-detail';
                        item.textContent = fact; section.append(item); }
                    const approval = document.createElement('label'); approval.className = 'dope-work-grant';
                    const accepted = document.createElement('input'); accepted.type = 'checkbox';
                    accepted.checked = controller.resumeAccepted;
                    accepted.onchange = () => { controller.resumeAccepted = accepted.checked; this.render(); };
                    approval.append(accepted, ' Approve a fresh execution grant and resume this candidate'); section.append(approval);
                    if (controller.resumeTarget?.locality === 'hosted') {
                        const hostedApproval = document.createElement('label'); hostedApproval.className = 'dope-work-grant';
                        const hosted = document.createElement('input'); hosted.type = 'checkbox';
                        hosted.checked = controller.resumeHostedAuthorized;
                        hosted.onchange = () => { controller.resumeHostedAuthorized = hosted.checked; this.render(); };
                        hostedApproval.append(hosted, ' Authorize sending project data to the hosted Coding Agent');
                        section.append(hostedApproval);
                    }
                    section.append(this.button('Cancel', () => controller.cancelResumePreview()),
                        this.button('Confirm Resume', () => void controller.confirmResume().then(newRun => {
                            if (newRun) this.selectWork({ kind: 'run', id: newRun.id });
                        }), controller.resumeBusy || !controller.resumeAccepted || !controller.resumeTarget ||
                        controller.resumeTarget.locality === 'hosted' && !controller.resumeHostedAuthorized));
                    scroll.append(section);
                }
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
    private activityText(diagnostic: ChatActivityDisplay): HTMLElement {
        const body = document.createElement('div');
        body.className = 'dope-chat-stream-text dope-chat-message-content';
        for (const part of diagnostic.parts) {
            if (part.kind === 'tool') {
                const call = document.createElement('div');
                call.className = 'dope-chat-stream-tool';
                call.textContent = chatToolCallLabel(part);
                body.append(call);
            } else if (part.text) {
                const prose = renderUntrustedMessageMarkdown(this.markdown, part.text);
                prose.className = 'dope-chat-stream-prose';
                body.append(prose);
            }
        }
        if (!body.childNodes.length) body.textContent = 'No activity captured';
        return body;
    }
    private appendReasoningActivity(item: HTMLElement, messageId: string | undefined,
        diagnostic: ReturnType<typeof chatStreamingActivityPresentation>, active: boolean,
        startedAt: string, endedAt?: string, outcome: 'Working...' | 'Finished' | 'Canceled' | 'Error' |
            'Paused at generation limit' | 'Incomplete' = 'Working...', answerStartedAt?: string): void {
        const details = document.createElement('details');
        details.className = 'dope-chat-stream-activity';
        details.open = messageId ? this.activityExpansion.get(messageId) ?? active : active;
        const heading = document.createElement('summary');
        if (messageId) heading.addEventListener('click', () => this.activityExpansion.set(messageId, !details.open));
        const label = document.createElement('span');
        label.textContent = active && answerStartedAt ? 'Answering' : outcome;
        heading.append(label, this.compactElapsedClock(startedAt, answerStartedAt ?? endedAt,
            active && !answerStartedAt));
        details.append(heading);
        if (diagnostic) {
            if (diagnostic.unavailable && diagnostic.parts.some(part => part.kind === 'provisional')) {
                const note = document.createElement('span');
                note.className = 'dope-chat-stream-note';
                note.textContent = 'Provisional output';
                details.append(note);
            }
            if (active) {
                const body = document.createElement('div');
                body.className = 'dope-chat-stream-text dope-chat-message-content';
                details.append(body);
            } else details.append(this.activityText(diagnostic));
            if (diagnostic.truncated) {
                const limit = document.createElement('span'); limit.className = 'dope-chat-stream-limit';
                limit.textContent = 'Activity capture stopped before completion; later activity was not captured.';
                details.append(limit);
            }
            if (diagnostic.issue === 'persistence-failed') {
                const failure = document.createElement('span'); failure.className = 'dope-chat-stream-limit';
                failure.textContent = 'Activity persistence failed; the recovered record may be incomplete.';
                details.append(failure);
            }
            if (diagnostic.issue === 'interrupted') {
                const interrupted = document.createElement('span'); interrupted.className = 'dope-chat-stream-note';
                interrupted.textContent = 'Generation interrupted; recent activity may not have reached storage.';
                details.append(interrupted);
            }
            if (diagnostic.issue === 'provider-truncated') {
                const provider = document.createElement('span'); provider.className = 'dope-chat-stream-note';
                provider.textContent = 'Provider stopped at its output limit; reasoning may be incomplete.';
                details.append(provider);
            }
        } else if (!active) {
            const note = document.createElement('span');
            note.className = 'dope-chat-stream-note';
            note.textContent = 'No captured reasoning or provisional activity';
            details.append(note);
        }
        item.prepend(details);
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
    private stopWorkingClock(item: HTMLElement, startedAt: string, answerStartedAt: string): void {
        const heading = item.querySelector<HTMLElement>('.dope-chat-stream-activity > summary');
        if (!heading) return;
        const label = heading.querySelector<HTMLElement>('span');
        if (label) label.textContent = 'Answering';
        const clock = heading.querySelector<HTMLElement>('.dope-elapsed-time');
        if (clock) {
            delete clock.dataset.running;
            clock.dataset.endedAt = answerStartedAt;
            clock.textContent = formatRunElapsedCompact(startedAt, Date.parse(answerStartedAt)) ?? '0s';
        }
        if (item.getAttribute('aria-label') === 'Assistant working')
            item.setAttribute('aria-label', 'Assistant answering');
        this.syncElapsedTicker();
    }
    private updateLiveStreamActivity(): boolean {
        const state = this.controller;
        const stream = state.stream;
        if (this.panel.mode !== 'chat' || state.mode !== 'chat' || !state.running ||
            !stream || stream.chatId !== state.chatId) return false;
        const item = [...this.content.querySelectorAll<HTMLElement>('.dope-chat-message')].find(candidate =>
            candidate.dataset.messageId === stream.messageId) ??
            this.content.querySelector<HTMLElement>('.dope-chat-message[aria-label="Assistant working"]');
        const scroll = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
        const diagnostic = chatStreamingActivityPresentation(stream.events, !!stream.content);
        if (!item || !scroll || !diagnostic) return false;
        let details = item.querySelector<HTMLDetailsElement>('.dope-chat-stream-activity');
        if (!details) {
            this.appendReasoningActivity(item, stream.messageId, diagnostic, true,
                state.runStartedAt ?? new Date().toISOString(), undefined, 'Working...', stream.answerStartedAt);
            details = item.querySelector<HTMLDetailsElement>('.dope-chat-stream-activity')!;
        }
        const note = details.querySelector<HTMLElement>('.dope-chat-stream-note');
        if (diagnostic.unavailable && diagnostic.parts.some(part => part.kind === 'provisional')) {
            if (!note) {
                const unavailable = document.createElement('span');
                unavailable.className = 'dope-chat-stream-note';
                unavailable.textContent = 'Provisional output';
                details.append(unavailable);
            }
        } else {
            note?.remove();
        }
        let body = details.querySelector<HTMLElement>('.dope-chat-stream-text');
        if (!body) {
            body = document.createElement('div');
            body.className = 'dope-chat-stream-text dope-chat-message-content';
            details.append(body);
        }
        const key = `${stream.chatId}:${stream.messageId}:${stream.executionId}`;
        if (!this.liveReasoning || this.liveReasoning.key !== key || this.liveReasoning.body !== body) {
            body.replaceChildren();
            this.liveReasoning = { key, body, runs: [] };
        }
        const mode = state.chat?.settings.reasoningDisplay?.mode ?? 'paragraphs';
        const fade = state.chat?.settings.reasoningDisplay?.fadeIn !== false;
        const runs = diagnostic.parts.reduce<Array<{ kind: 'thinking' | 'provisional' | 'tool'; text: string }>>(
            (result, part) => {
                const last = result.at(-1);
                if (part.kind !== 'tool' && last?.kind === part.kind) last.text += part.text;
                else result.push({ kind: part.kind, text: part.kind === 'tool' ? chatToolCallLabel(part) : part.text });
                return result;
            }, []);
        let presentation = this.liveReasoning;
        if (presentation.runs.length > runs.length || presentation.runs.some((run, index) =>
            run.kind !== runs[index].kind || run.kind !== 'tool' && !runs[index].text.startsWith(run.raw))) {
            body.replaceChildren();
            presentation = this.liveReasoning = { key, body, runs: [] };
        }
        let revealed = false;
        const appendChunk = (container: HTMLElement, chunk: string) => {
            const prose = renderUntrustedMessageMarkdown(this.markdown, chunk);
            prose.className = 'dope-chat-stream-prose dope-chat-reasoning-chunk';
            if (fade) prose.classList.add('dope-chat-reasoning-fade');
            container.append(prose);
            revealed = true;
        };
        runs.forEach((part, index) => {
            let run = presentation.runs[index];
            if (!run) {
                const node = document.createElement('div');
                node.className = part.kind === 'tool' ? 'dope-chat-stream-tool' : 'dope-chat-reasoning-run';
                body!.append(node);
                run = { kind: part.kind, raw: '', node,
                    ...(part.kind !== 'tool' ? { buffer: new ReasoningRevealBuffer(mode) } : {}) };
                presentation.runs.push(run);
            }
            if (run.kind === 'tool') {
                if (run.raw !== part.text) { run.node.textContent = part.text; revealed = true; }
            } else if (run.buffer) {
                if (mode === 'live-tokens') {
                    if (run.raw !== part.text) {
                        const prose = renderUntrustedMessageMarkdown(this.markdown, part.text);
                        prose.className = 'dope-chat-stream-prose';
                        run.node.replaceChildren(prose); revealed = true;
                    }
                } else for (const chunk of run.buffer.update(part.text)) appendChunk(run.node, chunk);
            }
            run.raw = part.text;
            if (index < runs.length - 1 && run.buffer)
                for (const chunk of run.buffer.flush()) appendChunk(run.node, chunk);
        });
        let indicator = details.querySelector<HTMLElement>('.dope-chat-reasoning-generating');
        const pending = mode !== 'live-tokens' && presentation.runs.some(run => run.buffer?.bufferedLength);
        if (!indicator) {
            indicator = document.createElement('span');
            indicator.className = 'dope-chat-reasoning-generating';
            indicator.setAttribute('aria-label', 'Generating reasoning');
            indicator.setAttribute('role', 'status');
            details.append(indicator);
        }
        indicator.hidden = !pending;
        let limit = details.querySelector<HTMLElement>('.dope-chat-stream-limit');
        if (diagnostic.truncated && !limit) {
            limit = document.createElement('span'); limit.className = 'dope-chat-stream-limit';
            limit.textContent = 'Activity capture stopped before completion; later activity was not captured.';
            details.append(limit);
        } else if (!diagnostic.truncated) limit?.remove();
        if (revealed && this.scrollFollow.following && details.open) scroll.scrollTop = scroll.scrollHeight;
        return true;
    }
    private renderLiveAnswer(source: string, key: string, advance = this.liveAnswerVisible?.key !== key): HTMLElement {
        this.liveAnswerReveal.update(key, source);
        const visible = advance ? this.liveAnswerReveal.advance() : this.liveAnswerReveal.current();
        const rendered = renderUntrustedMessageMarkdown(this.markdown, visible);
        const previous = this.liveAnswerVisible?.key === key ? this.liveAnswerVisible.text : '';
        const text = fadeInNewAnswerText(rendered, previous,
            this.controller.chat?.settings.reasoningDisplay?.fadeIn !== false);
        this.liveAnswerVisible = { key, text };
        return rendered;
    }
    private updateLiveStreamAnswer(): boolean {
        const state = this.controller;
        const stream = state.stream;
        if (this.panel.mode !== 'chat' || state.mode !== 'chat' || !state.running ||
            !stream || stream.chatId !== state.chatId) return false;
        const item = [...this.content.querySelectorAll<HTMLElement>('.dope-chat-message')].find(candidate =>
            candidate.dataset.messageId === stream.messageId) ??
            this.content.querySelector<HTMLElement>('.dope-chat-message[aria-label="Assistant working"]');
        const scroll = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
        if (!item || !scroll) return false;
        const saved = state.chat?.messages.find(message => message.id === stream.messageId);
        const partial = saved?.role === 'assistant' ? saved : undefined;
        const source = liveAnswerSource(partial, stream.content);
        if (stream.answerStartedAt)
            this.stopWorkingClock(item, state.runStartedAt ?? stream.answerStartedAt, stream.answerStartedAt);
        let answer = item.querySelector<HTMLElement>('.dope-chat-live-answer');
        if (!source) { answer?.remove(); this.liveAnswerVisible = undefined; this.liveAnswerReveal.reset(); return true; }
        if (!answer) {
            const content = item.querySelector<HTMLElement>(':scope > .dope-chat-message-content');
            if (!content) return false;
            if (!partial?.answerPartial) content.replaceChildren();
            answer = document.createElement('div');
            answer.className = 'dope-chat-live-answer';
            content.append(answer);
        }
        answer.replaceChildren(this.renderLiveAnswer(source,
            `${stream.chatId}:${stream.messageId}:${stream.executionId}:${partial?.answerPartial?.cursor ?? 0}`, true));
        if (!this.activityAutoCollapsed.has(stream.messageId)) {
            this.activityAutoCollapsed.add(stream.messageId);
            this.activityExpansion.set(stream.messageId, false);
            const activity = item.querySelector<HTMLDetailsElement>('.dope-chat-stream-activity');
            if (activity) activity.open = false;
        }
        if (this.scrollFollow.following && !this.transcriptDrag.dragging) {
            this.cancelScrollAnimation?.();
            this.scrollAnimationUntil = performance.now() + 180;
            this.animateLatest(scroll);
        }
        return true;
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
    private projectRelativePath(workspace: string, uri: string): string {
        const root = decodeURIComponent(new URL(workspace).pathname).replace(/\/$/, '');
        const file = decodeURIComponent(new URL(uri).pathname);
        if (!file.startsWith(`${root}/`)) throw new Error('Choose a file inside the active project');
        const path = file.slice(root.length + 1);
        if (path === '.dope' || path.startsWith('.dope/')) throw new Error('Private project data cannot be attached as a file');
        return path;
    }
    private selectedCode(): ChatContextSelection | undefined {
        const workspace = this.controller.workspace;
        const editor = this.editors?.currentEditor?.editor;
        const range = editor?.selection;
        if (!workspace || !editor || !range) return undefined;
        let path: string;
        try { path = this.projectRelativePath(workspace, editor.document.uri.toString()); }
        catch { return undefined; }
        const start = editor.document.offsetAt(range.start), end = editor.document.offsetAt(range.end);
        if (start === end) return undefined;
        return { kind: 'selection', id: path, text: editor.document.getText(range), start, end };
    }
    private attachSelection(selection: ChatContextSelection, workspace?: string, chatId?: string): void {
        if (!workspace || !chatId || this.controller.workspace !== workspace || this.controller.chatId !== chatId)
            throw new Error('Chat or project changed; choose the context again');
        this.controller.addContext(selection);
    }
    private async pickProjectFile(workspace: string, chatId: string): Promise<void> {
        try {
            if (!this.fileDialogs || !this.files) throw new Error('Project file picker is unavailable');
            const root = await this.files.resolve(new URI(workspace));
            const selected = await this.fileDialogs.showOpenDialog({ title: 'Attach project file',
                openLabel: 'Attach', canSelectFiles: true, canSelectFolders: false }, root);
            if (!selected) return;
            const path = this.projectRelativePath(workspace, selected.toString());
            const info = await this.files.resolve(selected);
            if (!info.isFile || info.size === undefined || info.size > 1_000_000)
                throw new Error('File is unavailable or exceeds the 1 MB context limit');
            this.attachSelection({ kind: 'file', id: path }, workspace, chatId);
        } catch (error) { this.status.textContent = `Could not attach file: ${String(error)}`; }
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
        const overlay = document.createElement('div');
        overlay.className = 'dope-chat-settings-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-label', 'Chat settings');
        overlay.onkeydown = event => {
            if (event.key === 'Escape') { event.stopPropagation(); this.toggleChatSettings(); }
        };
        const form = document.createElement('section');
        form.className = 'dope-chat-settings-form';
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
        const section = (label: string) => {
            const group = document.createElement('section'); group.className = 'dope-chat-settings-section';
            const heading = document.createElement('h4'); heading.textContent = label;
            group.append(heading); form.append(group); return group;
        };
        const field = (parent: HTMLElement, label: string, input: HTMLElement) => {
            const row = document.createElement('label');
            row.className = input instanceof HTMLInputElement && input.type === 'checkbox' ?
                'dope-chat-settings-check' : 'dope-chat-settings-field';
            row.textContent = label; row.append(input); parent.append(row);
        };
        const appearance = section('Appearance'); appearance.append(color);
        const reasoningDisplay = section('Response streaming');
        const displayMode = document.createElement('select');
        displayMode.append(new Option('Paragraphs', 'paragraphs'), new Option('Short Chunks', 'short-chunks'),
            new Option('Live Tokens', 'live-tokens'));
        displayMode.value = draft.reasoningDisplay?.mode ?? 'paragraphs';
        displayMode.onchange = () => { draft.reasoningDisplay = {
            mode: displayMode.value as NonNullable<ChatSettings['reasoningDisplay']>['mode'],
            fadeIn: draft.reasoningDisplay?.fadeIn ?? true }; };
        field(reasoningDisplay, 'Display mode', displayMode);
        const fadeIn = document.createElement('input'); fadeIn.type = 'checkbox';
        fadeIn.checked = draft.reasoningDisplay?.fadeIn ?? true;
        fadeIn.onchange = () => { draft.reasoningDisplay = {
            mode: draft.reasoningDisplay?.mode ?? 'paragraphs', fadeIn: fadeIn.checked }; };
        field(reasoningDisplay, 'Fade in new text', fadeIn);
        const modelSection = section('Model');
        const model = document.createElement('select');
        model.append(new Option('Follow Interactive role', ''));
        for (const entry of this.usableModels()) model.append(new Option(entry.label,
            JSON.stringify(entry.selection)));
        const exact = draft.modelPolicy.type === 'exact' ? draft.modelPolicy.model : undefined;
        if (exact && !this.usableModels().some(entry => this.sameModel(entry.selection, exact)))
            model.append(new Option(`Pinned model unavailable (${exact.modelId})`, JSON.stringify(exact)));
        model.value = exact ? JSON.stringify(exact) : '';
        model.onchange = () => { draft.modelPolicy = model.value ?
            { type: 'exact', model: JSON.parse(model.value) as ChatModelSelection } : { type: 'follow-interactive' };
            draft.reasoningControls = undefined; this.render(); };
        field(modelSection, 'Default model', model);
        if (!this.usableModels().length || exact && !this.usableModels().some(entry => this.sameModel(entry.selection, exact)))
            modelSection.append(this.button('Manage AI connections', () => { void this.aiCenter?.openFromChat(this.id); }));
        if (draft.modelPolicy.type === 'follow-interactive')
            modelSection.append(this.button('Configure Interactive role', () => { void this.aiCenter?.openRole('interactive'); }));
        const active = this.usableModels().find(entry => this.sameModel(entry.selection, exact));
        if (!active) {
            const note = document.createElement('p'); note.className = 'dope-chat-settings-note';
            note.textContent = exact ? 'This saved model is unavailable. Choose an available model or Follow Interactive role.' :
                'Reasoning options depend on the Interactive model. Pin an available model to configure them here.';
            modelSection.append(note);
        } else if (!active.controls.length) {
            const note = document.createElement('p'); note.className = 'dope-chat-settings-note';
            note.textContent = 'No configurable reasoning options are reported for this model.';
            modelSection.append(note);
        }
        for (const control of active?.controls ?? []) {
            const select = document.createElement('select');
            select.append(new Option('Auto', ''), ...control.values.map(value =>
                new Option(value === 'on' ? 'On' : value[0].toUpperCase() + value.slice(1), value)));
            const selected = draft.reasoningControls?.[control.id];
            if (selected && !control.values.includes(selected)) {
                const unavailable = new Option(`${selected[0].toUpperCase() + selected.slice(1)} unavailable`, selected);
                unavailable.disabled = true;
                select.append(unavailable);
            }
            select.value = selected ?? '';
            select.onchange = () => {
                draft.reasoningControls = { ...draft.reasoningControls };
                if (select.value) draft.reasoningControls[control.id] = select.value;
                else delete draft.reasoningControls[control.id];
            };
            field(modelSection, 'Reasoning', select);
            const activeModel = this.models.connections.find(connection =>
                connection.id === active?.selection.connectionId)?.models.find(item =>
                    item.id === active?.selection.modelId);
            if (control.id === 'reasoning.effort' &&
                activeModel?.capabilities.localReasoning?.format === 'qwen-chat-template' &&
                !control.values.includes('off')) {
                const note = document.createElement('p');
                note.textContent = 'Off is unavailable for this LM Studio Qwen model through the Pi tool endpoint. Choose Auto or On.';
                modelSection.append(note);
            }
        }
        const conversation = section('Conversation');
        const outputLimit = document.createElement('select');
        outputLimit.append(new Option('Ask each time', 'ask'), new Option('Allow each time', 'allow'),
            new Option('Cancel each time', 'cancel'));
        outputLimit.value = draft.outputLimitPolicy;
        outputLimit.onchange = () => { draft.outputLimitPolicy = outputLimit.value as ChatSettings['outputLimitPolicy']; };
        field(conversation, 'At generation limit', outputLimit);
        const history = document.createElement('input'); history.type = 'checkbox';
        history.checked = draft.context.history === 'recent';
        history.onchange = () => { draft.context.history = history.checked ? 'recent' : 'none'; };
        field(conversation, 'Use previous messages', history);
        const advanced = document.createElement('details'); advanced.className = 'dope-chat-settings-advanced';
        const advancedTitle = document.createElement('summary'); advancedTitle.textContent = 'Advanced settings';
        advanced.append(advancedTitle); form.append(advanced);
        const tokenInputs: HTMLInputElement[] = [];
        for (const [label, key] of [['Input token budget', 'maxInputTokens'], ['Output token reserve', 'reservedOutputTokens']] as const) {
            const input = document.createElement('input'); input.type = 'number'; input.min = key === 'maxInputTokens' ? '1' : '0';
            input.step = '1'; input.value = String(draft.context[key]); tokenInputs.push(input);
            input.onchange = () => { draft.context[key] = Number(input.value); };
            field(advanced, label, input);
        }
        const budgetNote = document.createElement('p'); budgetNote.className = 'dope-chat-settings-note';
        budgetNote.textContent = 'These saved limits are capped by the selected model’s loaded capacity when a turn runs.';
        advanced.append(budgetNote);
        const saved = document.createElement('input'); saved.type = 'checkbox'; saved.checked = draft.context.savedChatSearch;
        saved.onchange = () => { draft.context.savedChatSearch = saved.checked; };
        field(advanced, 'Allow saved Chat retrieval', saved);
        const savedNote = document.createElement('p'); savedNote.className = 'dope-chat-settings-note';
        savedNote.textContent = 'Lets you select an excerpt from another saved Chat. Your current conversation history is controlled above.';
        advanced.append(savedNote);
        const error = document.createElement('p'); error.className = 'dope-chat-settings-error';
        error.setAttribute('role', 'alert'); advanced.append(error);
        const actions = document.createElement('footer');
        const save = this.button('Save settings', () => {
            const [input, output] = tokenInputs.map(control => Number(control.value));
            if (!tokenInputs.every(control => control.value.trim() && control.checkValidity()) ||
                !Number.isSafeInteger(input) || input < 1 || !Number.isSafeInteger(output) || output < 0) {
                error.textContent = 'Enter whole, nonnegative token limits; input must be at least 1.';
                advanced.open = true; return;
            }
            draft.context.maxInputTokens = input; draft.context.reservedOutputTokens = output;
            error.textContent = '';
            void this.controller.mutate({ type: 'set-settings', chatId,
            settings: draft }).then(saved => {
            if (saved && this.settingsChatId === chatId) {
                this.closeChatSettings();
            }
        }); }, this.controller.pending);
        save.className = 'dope-chat-settings-save';
        actions.append(save);
        form.append(actions);
        const pullTab = this.button('↑', () => this.closeChatSettings());
        pullTab.className = 'dope-chat-settings-pull-tab';
        pullTab.setAttribute('aria-label', 'Close chat settings');
        pullTab.title = 'Close chat settings';
        overlay.append(form, pullTab);
        return overlay;
    }
    private renderSkillsDrawer(): HTMLElement {
        const drawer = document.createElement('section');
        drawer.className = 'dope-chat-skills-drawer';
        drawer.setAttribute('role', 'dialog');
        drawer.setAttribute('aria-label', 'Skills');
        drawer.onkeydown = event => {
            if (event.key === 'Escape') this.closeSkills();
        };
        const header = document.createElement('header');
        const title = document.createElement('h3'); title.textContent = 'Skills';
        const close = this.button('×', () => this.closeSkills());
        close.setAttribute('aria-label', 'Close Skills');
        header.append(title, close); drawer.append(header);
        const list = document.createElement('div'); list.className = 'dope-chat-skills-list';
        for (const skill of this.skills ?? []) {
            const row = document.createElement('div'); row.className = 'dope-chat-skills-row';
            if (!skill.enabled) row.classList.add('dope-chat-skills-disabled');
            const name = document.createElement('strong'); name.textContent = `/${skill.name}`;
            const title = document.createElement('span'); title.textContent = skill.title;
            title.className = 'dope-chat-skills-title';
            const description = document.createElement('span'); description.textContent = skill.description;
            description.className = 'dope-chat-skills-description';
            row.append(name, title, description);
            if (skill.provenance === 'user') {
                const actions = document.createElement('div'); actions.className = 'dope-chat-skills-actions';
                actions.append(this.button('Edit', () => {
                    this.skillEditId = skill.id; this.skillName = skill.name; this.skillTitle = skill.title;
                    this.skillDescription = skill.description; this.skillBody = skill.body;
                    this.skillFormOpen = true; this.render();
                }), this.button(skill.enabled ? 'Disable' : 'Enable', () =>
                    void this.changeSkill({ type: 'enable', id: skill.id, enabled: !skill.enabled })),
                this.button('Delete', () => {
                    if (window.confirm(`Delete /${skill.name}?`)) void this.changeSkill({ type: 'delete', id: skill.id });
                }));
                row.append(actions);
            }
            list.append(row);
        }
        drawer.append(list);
        if (!this.skillFormOpen) {
            const add = this.button('Add Skill', () => {
                this.skillEditId = undefined; this.skillName = ''; this.skillTitle = '';
                this.skillDescription = ''; this.skillBody = '';
                this.skillError = ''; this.skillFormOpen = true; this.render();
            });
            add.className = 'dope-chat-skills-add'; drawer.append(add);
        } else {
            const form = document.createElement('div'); form.className = 'dope-chat-skills-form';
            const field = (label: string, value: string, set: (value: string) => void, multiline = false) => {
                const wrapper = document.createElement('label'); wrapper.textContent = label;
                const input = multiline ? document.createElement('textarea') : document.createElement('input');
                input.value = value; input.setAttribute('aria-label', label);
                if (multiline) input.maxLength = 1500;
                input.oninput = () => set(input.value);
                wrapper.append(input); form.append(wrapper);
            };
            field('Command name', this.skillName, value => this.skillName = value);
            field('Title', this.skillTitle, value => this.skillTitle = value);
            field('Summary', this.skillDescription, value => this.skillDescription = value);
            field('Instructions', this.skillBody, value => this.skillBody = value, true);
            form.append(this.button(this.skillEditId ? 'Save Skill' : 'Add Skill', () => void this.changeSkill(
                this.skillEditId ? { type: 'edit', id: this.skillEditId, name: this.skillName, title: this.skillTitle,
                    description: this.skillDescription, body: this.skillBody } :
                    { type: 'add', name: this.skillName, title: this.skillTitle,
                        description: this.skillDescription, body: this.skillBody })));
            form.append(this.button('Cancel', () => { this.skillFormOpen = false; this.skillError = ''; this.render(); }));
            drawer.append(form);
        }
        if (this.skillError) {
            const error = document.createElement('p'); error.setAttribute('role', 'alert');
            error.className = 'dope-chat-skills-error'; error.textContent = this.skillError; drawer.append(error);
        }
        return drawer;
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
        if (this.transcriptTouchChatId && (this.transcriptTouchChatId !== state.chatId ||
            this.panel.mode !== 'chat' || state.mode !== 'chat')) {
            if (this.transcriptTouchSettleTimer) clearTimeout(this.transcriptTouchSettleTimer);
            this.transcriptTouchSettleTimer = undefined;
            this.transcriptTouchChatId = undefined;
            this.transcriptTouchActive = false;
            this.transcriptTouchMoved = false;
            this.transcriptRenderPending = false;
        }
        if (this.transcriptTouchChatId === state.chatId &&
            (this.transcriptTouchActive || this.transcriptTouchSettleTimer) &&
            this.panel.mode === 'chat' && state.mode === 'chat') {
            this.transcriptRenderPending = true;
            return;
        }
        this.syncViewedProposal();
        this.syncAutoRoadmapPreview();
        const toolbarState = `${this.canBackToChats}:${this.canCopyTranscript}:${this.canOpenChatSettings}:${this.isChatSettingsOpen}`;
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
                    this.workController.phase.selected : undefined) : 'Work' : this.settingsOpen ? 'CHAT SETTINGS' : 'Chat';
        this.content.className = this.panel.mode === 'work' ? 'dope-chat-content dope-chat-content-work' :
            state.mode !== 'chat' ? 'dope-chat-content dope-chat-content-select' :
                'dope-chat-content dope-chat-content-conversation';
        if (this.panel.mode === 'work' && !this.panel.work) this.content.classList.add('dope-work-select');
        this.scrollFollow.select(this.panel.mode === 'chat' && state.mode === 'chat' ? state.chatId : undefined);
        if (this.liveReasoning && (this.panel.mode !== 'chat' || state.mode !== 'chat' ||
            state.chatId !== state.stream?.chatId || !state.running || !state.stream ||
            !this.liveReasoning.key.startsWith(`${state.stream.chatId}:${state.stream.messageId}:`)))
            this.liveReasoning = undefined;
        if (this.liveAnswerVisible && (this.panel.mode !== 'chat' || state.mode !== 'chat' ||
            state.chatId !== state.stream?.chatId || !state.running || !state.stream ||
            !this.liveAnswerVisible.key.startsWith(`${state.stream.chatId}:${state.stream.messageId}:`))) {
            this.liveAnswerVisible = undefined;
            this.liveAnswerReveal.reset();
        }
        this.answerBatcher.cancel();
        const oldScroll = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
        const scrollTop = oldScroll?.scrollTop ?? 0;
        const settingsScrollTop = this.content.querySelector<HTMLElement>('.dope-chat-settings-form')?.scrollTop ?? 0;
        const active = document.activeElement as HTMLElement | null;
        const focused = this.content.contains(active) ? active?.getAttribute('aria-label') : undefined;
        const focusedWorkKey = this.content.contains(active) ? active?.dataset.workKey : undefined;
        const selection = active instanceof HTMLTextAreaElement ? [active.selectionStart, active.selectionEnd] : undefined;
        // Work and Chat selection keep their root status. Active Chat places it
        // with other notices in the scrollable response area below.
        this.node.insertBefore(this.status, this.content);
        const latestMessage = state.chat?.messages.at(-1);
        const failedTurn = this.panel.mode === 'chat' && state.mode === 'chat' &&
            latestMessage?.role === 'assistant' && latestMessage.execution.status === 'failed' && !state.running;
        const inlineTurnError = failedTurn ? state.error : '';
        this.status.className = this.panel.mode === 'chat' && state.error && !inlineTurnError ? 'dope-chat-error-bubble' : '';
        this.status.textContent = this.panel.mode === 'chat' ?
            (inlineTurnError ? '' : state.error) || (state.loading ? 'Loading Chats…' : !state.workspace ?
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
        if (this.panel.mode === 'chat' && !inlineTurnError && state.error.includes('Interactive role')) this.status.append(' ',
            this.button('Open AI Center', () => { void this.aiCenter?.openRole('interactive'); }));
        if (this.panel.mode === 'chat' && !inlineTurnError && state.error.includes('Verify Local agent execution')) {
            const failed = [...(state.chat?.messages ?? [])].reverse().find(message =>
                message.role === 'assistant' && message.execution.status === 'failed');
            const model = failed?.role === 'assistant' ? failed.execution.selectedModel : state.turnModel;
            this.status.append(' ', this.button('Open tool verification', () => {
                if (model) void this.aiCenter?.openLocalAgentVerification(this.id, model.connectionId, model.modelId);
                else void this.aiCenter?.openFromChat(this.id);
            }));
        }
        this.composerResizeObserver?.disconnect();
        this.composerResizeObserver = undefined;
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
                }), state.pending), this.button('Skills', () => this.openSkills()));
            header.append(heading, create);
            if (!this.usableModels().length)
                header.append(this.button('Manage AI connections', () => { void this.aiCenter?.openFromChat(this.id); }));
            const navigation = document.createElement('nav');
            navigation.className = 'dope-chat-selector-list';
            navigation.setAttribute('aria-label', 'Chats and folders');
            navigation.append(this.renderTree(chatTree(state.snapshot)));
            this.content.append(header, navigation);
            if (this.skillsOpen) this.content.append(this.renderSkillsDrawer());
            return;
        }
        this.skillsOpen = false;
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
        const activePlanning = state.activePlanning;
        if (activePlanning) {
            const pinned = state.planningMode === 'pin';
            const selectionMode = this.button('', () => pinned ? state.followPlanning() : state.pinPlanning(),
                !pinned && (!state.workspace || !this.planningSelection?.current(state.workspace)));
            selectionMode.className = 'dope-chat-title-edit';
            selectionMode.setAttribute('aria-label', pinned ? 'Follow planning selection' : 'Pin planning selection');
            selectionMode.title = pinned ? 'Follow planning selection' : 'Pin planning selection';
            const pinIcon = document.createElement('span');
            pinIcon.className = codicon(pinned ? 'pinned' : 'pin'); pinIcon.setAttribute('aria-hidden', 'true');
            selectionMode.append(pinIcon); header.append(selectionMode);
            if (activePlanning.kind === 'roadmap-checkpoint' && !state.running) {
                const bridge = this.button('', () => {
                    const entered = window.prompt('Affected Architecture branch IDs, comma separated');
                    if (entered === null) return;
                    const branchIds = entered.split(',').map(id => id.trim()).filter(Boolean);
                    if (!branchIds.length) { this.status.textContent = 'Select an affected Architecture branch'; return; }
                    void state.runTurn(state.turnModel, undefined, undefined, branchIds);
                }, state.pending || !state.draft.trim() || !this.selectedModel());
                bridge.className = 'dope-chat-title-edit';
                bridge.setAttribute('aria-label', 'Suggest Bridge change'); bridge.title = 'Suggest Bridge change';
                const bridgeIcon = document.createElement('span');
                bridgeIcon.className = codicon('git-merge'); bridgeIcon.setAttribute('aria-hidden', 'true');
                bridge.append(bridgeIcon); header.append(bridge);
            }
        }
        const shell = document.createElement('section'); shell.className = 'dope-chat-shell';
        const region = document.createElement('div'); region.className = 'dope-chat-transcript-region';
        if (this.settingsOpen) region.classList.add('dope-chat-settings-region');
        const scroll = document.createElement('div'); scroll.className = 'dope-chat-scroll';
        scroll.setAttribute('role', 'log'); scroll.setAttribute('aria-label', 'Chat conversation');
        scroll.onscroll = () => {
            if (!this.transcriptTouchActive && this.transcriptTouchSettleTimer) this.settleTranscriptTouch();
            if (performance.now() < this.scrollAnimationUntil) return;
            this.scrollFollow.scrolled(scroll.scrollTop, scroll.scrollHeight, scroll.clientHeight);
            latest.hidden = !this.scrollFollow.latestBelow;
        };
        scroll.ontouchstart = () => {
            if (this.transcriptTouchSettleTimer) clearTimeout(this.transcriptTouchSettleTimer);
            this.transcriptTouchSettleTimer = undefined;
            this.transcriptTouchChatId = state.chatId;
            this.transcriptTouchActive = true;
            this.transcriptTouchMoved = false;
            this.cancelScrollAnimation?.(); this.scrollAnimationUntil = 0;
        };
        scroll.ontouchmove = () => { this.transcriptTouchMoved = true; };
        scroll.ontouchend = scroll.ontouchcancel = event => {
            if (event.touches.length) return;
            this.transcriptTouchActive = false;
            if (this.transcriptTouchMoved) this.settleTranscriptTouch();
            else {
                this.transcriptTouchChatId = undefined;
                if (this.transcriptRenderPending) {
                    this.transcriptRenderPending = false;
                    this.render();
                }
            }
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
            message.role === 'assistant' && ['pending', 'streaming', 'paused-output-limit'].includes(message.execution.status));
        for (const message of chat.messages) {
            const item = document.createElement('li');
            item.className = `dope-chat-message dope-chat-message-${message.role}`;
            item.dataset.messageId = message.id;
            item.setAttribute('aria-label', message.role === 'user' ? 'You' : 'Assistant');
            if (message.role === 'user') item.dataset.color = chat.color;
            const content = document.createElement('div');
            content.className = 'dope-chat-message-content';
            const body = message.role === 'assistant' ? documentationReviewDisplayText(message) : message.content;
            if (message.role === 'assistant' && message.execution.status === 'pending' && !body) {
                if (!(state.running && message.id === activeAssistant?.id)) content.textContent = 'Working...';
            } else if (message.role === 'assistant') {
                const activity = planningActivityPresentation(message);
                const outcome = message.execution.status === 'failed' ? undefined : planningOutcome(message);
                const docsFinal = message.execution.status === 'complete' &&
                    message.planningActivity?.kind === 'documentation-proposal';
                if (docsFinal) {
                    const response = document.createElement('div');
                    response.style.whiteSpace = 'pre-wrap';
                    response.textContent = body;
                    content.append(response);
                }
                if (outcome && !docsFinal && !isInlineRoadmapProposal(message)) {
                    if (message.planningActivity?.kind === 'no-action' &&
                        message.planningActivity.status === 'no-action') {
                        content.append(renderUntrustedMessageMarkdown(this.markdown, outcome.summary));
                    } else {
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
                }
                if (activity && !docsFinal && !isInlineRoadmapProposal(message)) {
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
                    this.bindDiagnosticCopy(copy, message);
                    details.append(summary, raw, copy);
                    content.append(details);
                    if (activity.alert) item.classList.add('dope-chat-message-alert');
                } else if (!isInlineRoadmapProposal(message) && (message.planningActivity?.status === 'failed' ||
                    message.planningActivity?.status === 'cancelled')) {
                    if (body) {
                        const raw = document.createElement('pre');
                        raw.className = 'dope-chat-planning-invalid-raw';
                        raw.textContent = body;
                        content.append(raw);
                    }
                } else if (message.execution.status === 'complete' && !docsFinal && !isInlineRoadmapProposal(message) &&
                    !(message.planningActivity?.kind === 'no-action' && outcome))
                    content.append(renderUntrustedMessageMarkdown(this.markdown, body));
                else if (message.execution.status === 'cancelled' && !message.answerPartial) {
                    content.classList.add('dope-chat-final-answer');
                    const note = document.createElement('p'); note.textContent = 'No final response'; content.append(note);
                }
                if (['streaming', 'paused-output-limit', 'stopped-incomplete', 'interrupted', 'cancelled'].includes(message.execution.status) &&
                    message.answerPartial) {
                    if (message.execution.status !== 'streaming') {
                        const marker = document.createElement('strong');
                        marker.className = 'dope-chat-incomplete-marker';
                        marker.textContent = 'Incomplete';
                        content.append(marker);
                    }
                    if (message.answerPartial.text) {
                        const partial = renderUntrustedMessageMarkdown(this.markdown, message.answerPartial.text);
                        partial.className = 'dope-chat-partial-answer';
                        content.append(partial);
                    }
                }
            } else if (message.role === 'user' && message.skill) {
                const current = this.skills?.find(skill => skill.id === message.skill?.id);
                appendSkillText(content, body, { name: message.skill.name,
                    title: message.skill.title ?? current?.title,
                    description: message.skill.description ?? current?.description });
            } else content.textContent = body;
            if (message.role === 'assistant' &&
                state.running && message.id === activeAssistant?.id &&
                state.stream?.messageId === message.id && state.stream.executionId === message.execution.id &&
                state.stream.content) {
                const source = liveAnswerSource(message, state.stream.content);
                if (source) {
                    if (!message.answerPartial) content.replaceChildren();
                    const live = document.createElement('div'); live.className = 'dope-chat-live-answer';
                    live.append(this.renderLiveAnswer(source,
                        `${state.stream.chatId}:${state.stream.messageId}:${state.stream.executionId}:` +
                        `${message.answerPartial?.cursor ?? 0}`));
                    content.append(live);
                }
            }
            if (message.role === 'assistant' && message.execution.status === 'failed' && message.execution.failure) {
                const recovery = document.createElement('div');
                recovery.className = 'dope-chat-error-bubble';
                const description = document.createElement('span');
                description.textContent = inlineTurnError && message.id === latestMessage?.id ?
                    inlineTurnError : message.execution.failure;
                recovery.append(description);
                if (message.execution.failure.includes('Verify Local agent execution') ||
                    description.textContent.includes('Verify Local agent execution')) {
                    const target = message.execution.selectedModel;
                    recovery.append(this.button('Open tool verification', () => {
                        void this.aiCenter?.openLocalAgentVerification(this.id, target.connectionId, target.modelId);
                    }));
                }
                content.append(recovery);
            }
            if (message.role === 'assistant' && message.lockedRoadmapPlan) {
                const inspection = document.createElement('details');
                inspection.className = 'dope-chat-locked-roadmap-plan';
                const heading = document.createElement('summary');
                heading.textContent = 'Natural Roadmap plan · saved for inspection';
                const note = document.createElement('p');
                note.textContent = 'Planning text only. No Roadmap changes were applied from this snapshot.';
                const plan = document.createElement('pre');
                plan.textContent = message.lockedRoadmapPlan.text;
                inspection.append(heading, note, plan);
                content.append(inspection);
            }
            const time = document.createElement('time');
            time.dateTime = message.createdAt;
            time.textContent = new Date(message.createdAt).toLocaleString();
            if (message.role === 'user') item.append(content);
            if (message.role === 'assistant') {
                if (isInlineRoadmapProposal(message)) item.classList.add('dope-chat-message-roadmap-proposal');
                const diagnostic = chatActivityPresentation(message, state.stream);
                const active = state.running && message.id === activeAssistant?.id;
                if ((message.execution.status === 'complete' ||
                    active && state.stream?.messageId === message.id && !!state.stream.content) &&
                    !this.activityAutoCollapsed.has(message.id)) {
                    this.activityAutoCollapsed.add(message.id);
                    this.activityExpansion.set(message.id, false);
                }
                if (diagnostic || active || message.execution.status === 'complete')
                    this.appendReasoningActivity(item, message.id, diagnostic, active,
                        message.execution.startedAt, message.execution.finishedAt,
                        message.execution.status === 'complete' ? 'Finished' :
                        message.execution.status === 'paused-output-limit' ? 'Paused at generation limit' :
                        message.execution.status === 'stopped-incomplete' ? 'Incomplete' :
                        message.execution.status === 'cancelled' ? 'Canceled' :
                        ['failed', 'interrupted'].includes(message.execution.status) ? 'Error' : 'Working...',
                        active && state.stream?.messageId === message.id ? state.stream.answerStartedAt : undefined);
                if (message.execution.finishReason === 'length') {
                    const providerLimit = document.createElement('span');
                    providerLimit.className = 'dope-chat-stream-note';
                    const segment = message.answerPartial?.segments.at(-1);
                    const ceiling = segment?.outputCeilingTokens;
                    const output = segment?.tokenUsage?.tokenMeasurement === 'provider-reported' ?
                        segment.tokenUsage.outputTokens : undefined;
                    providerLimit.textContent = `Provider reported an output length limit${ceiling ?
                        ` at a ${ceiling.toLocaleString()} token segment ceiling` : ''}${output === undefined ? '' :
                        ` · ${output.toLocaleString()} provider-reported output tokens`}. The answer remains incomplete.`;
                    item.append(providerLimit);
                }
                if (!diagnostic && message.execution.tokenUsage?.reasoningTokens !== undefined) {
                    const usage = document.createElement('span');
                    usage.className = 'dope-chat-stream-note';
                    usage.textContent = `Reasoning tokens: ${message.execution.tokenUsage.reasoningTokens} · Reasoning stream unavailable`;
                    item.append(usage);
                }
                if (message.execution.status === 'failed' && message.execution.failure ||
                    message.execution.status === 'complete' && chatResponseCopyText(message) ||
                    active && state.stream?.content) content.classList.add('dope-chat-final-answer');
                item.append(content);
                const savedProposal = this.savedRoadmapProposalCard(message);
                if (savedProposal) item.append(savedProposal);
                const action = savedProposal ? undefined : this.roadmapActionCard(message);
                if (action) item.append(action);
                if (state.pendingCommand && message.id === activeAssistant?.id) {
                    const command = this.commandApprovalCard();
                    if (command) item.append(command);
                }
            }
            if (message.role === 'user') {
                const meta = document.createElement('small'); meta.className = 'dope-chat-message-meta';
                meta.append(time);
                if (message.contextRefs.length) {
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
                item.append(meta);
            } else if (['complete', 'stopped-incomplete', 'failed', 'cancelled', 'interrupted'].includes(message.execution.status)) {
                const execution = message.execution;
                if (['failed', 'cancelled', 'interrupted'].includes(execution.status))
                    item.classList.add('dope-chat-message-alert');
                const footer = document.createElement('div'); footer.className = 'dope-chat-response-footer';
                const actions = document.createElement('div'); actions.className = 'dope-chat-response-actions';
                const copyText = chatResponseCopyText(message);
                const copy = this.button('', () => {
                    if (!copyText) { this.flashCopyFeedback(copy, 'No final response to copy.'); return; }
                    void copyChatText(copyText)
                        .then(() => { icon.className = codicon('check');
                            this.flashCopyFeedback(copy, 'Copied.');
                            setTimeout(() => { icon.className = codicon('copy'); }, 2000); },
                            () => this.flashCopyFeedback(copy, 'Copy failed.'));
                });
                copy.className = 'dope-chat-copy-response';
                copy.setAttribute('aria-label', 'Copy Response'); copy.setAttribute('aria-live', 'polite');
                copy.title = 'Copy Response';
                this.bindDiagnosticCopy(copy, message);
                const icon = document.createElement('span'); icon.className = codicon('copy');
                icon.setAttribute('aria-hidden', 'true'); copy.append(icon);
                const info = document.createElement('div'); info.className = 'dope-chat-response-info';
                info.id = `dope-chat-response-info-${message.id}`;
                info.hidden = !this.openResponseInfo.has(message.id);
                const detail = (label: string, value: string) => {
                    const row = document.createElement('div');
                    row.textContent = `${label}: ${value}`;
                    info.append(row);
                };
                detail('Status', `${execution.status}${execution.failure ? ` · ${execution.failure}` : ''}`);
                if (message.planningActivity?.kind === 'roadmap-gate-proposal') {
                    const raw = document.createElement('details');
                    const label = document.createElement('summary'); label.textContent = 'Original proposal JSON';
                    const payload = document.createElement('pre'); payload.textContent = message.content;
                    const copyJson = this.button('Copy JSON', () => void copyChatText(message.content)
                        .then(() => { copyJson.textContent = 'Copied'; }, () => { copyJson.textContent = 'Copy failed'; }));
                    raw.append(label, payload, copyJson); info.append(raw);
                }
                detail('Selected', `${execution.selectedModel.connectionId}/${execution.selectedModel.modelId}`);
                if (execution.actualModel) detail('Actual',
                    `${execution.actualModel.providerId}/${execution.actualModel.modelLabel}`);
                if (execution.routingProvenance) {
                    const route = execution.routingProvenance;
                    detail('Routing', `${route.requestedRole ?? 'Exact'} · ${route.source}`);
                    detail('Constraints', `${route.effectiveHard.locality}, ` +
                        `${route.effectiveHard.requiredCapabilities.join(', ') || 'none'}, ` +
                        `context ≥${route.effectiveHard.minimumKnownContextTokens ?? 0}, ` +
                        `hosted egress ${route.effectiveHard.hostedProjectData}`);
                    detail('Preferred', route.preferredTarget ?
                        `${route.preferredTarget.connectionId}/${route.preferredTarget.modelId}` : 'none');
                    detail('Route actual', `${route.executionLabels.connection}/${route.executionLabels.model}`);
                    detail('Attempts', route.attempts.map(attempt =>
                        `${attempt.target.connectionId}/${attempt.target.modelId} ${attempt.outcome}`).join(' → ') || 'none');
                } else if (execution.resolutionSource) {
                    detail('Resolution', execution.resolutionSource);
                }
                const infoButton = this.button('', () => {
                    const open = !this.openResponseInfo.has(message.id);
                    if (open) this.openResponseInfo.add(message.id);
                    else this.openResponseInfo.delete(message.id);
                    info.hidden = !open;
                    infoButton.setAttribute('aria-expanded', String(open));
                    infoButton.setAttribute('aria-label', open ? 'Hide response info' : 'Show response info');
                    infoButton.title = open ? 'Hide response info' : 'Show response info';
                });
                infoButton.className = 'dope-chat-response-info-button';
                infoButton.setAttribute('aria-label', info.hidden ? 'Show response info' : 'Hide response info');
                infoButton.setAttribute('aria-expanded', String(!info.hidden));
                infoButton.setAttribute('aria-controls', info.id);
                infoButton.title = info.hidden ? 'Show response info' : 'Hide response info';
                const infoIcon = document.createElement('span'); infoIcon.className = codicon('info');
                infoIcon.setAttribute('aria-hidden', 'true'); infoButton.append(infoIcon);
                actions.append(copy, infoButton);
                if (['failed', 'cancelled'].includes(message.execution.status)) {
                    const retry = this.button('Retry', () => {
                        if (this.selectedModel()) void state.runTurn(state.turnModel, message.id,
                            () => window.confirm('Send this Chat message, history and selected project context to the hosted model?'));
                    }, state.running || state.pending || !this.selectedModel());
                    retry.className = 'dope-chat-response-retry';
                    actions.append(retry);
                }
                footer.append(actions, time);
                item.append(info, footer);
            }
            transcript.append(item);
        }
        if (state.transientUser?.chatId === chat.id) {
            const item = document.createElement('li');
            item.className = 'dope-chat-message dope-chat-message-user';
            item.dataset.color = chat.color;
            item.setAttribute('aria-label', 'You');
            const content = document.createElement('div');
            content.className = 'dope-chat-message-content';
            const command = /^\/([a-z0-9-]+)(?=\s|$)/.exec(state.transientUser.content)?.[1];
            const skill = this.skills?.find(entry => entry.name === command && entry.enabled);
            if (skill) appendSkillText(content, state.transientUser.content, skill);
            else content.textContent = state.transientUser.content;
            item.append(content); transcript.append(item);
        }
        if (state.running && !activeAssistant) {
            const item = document.createElement('li'); item.className = 'dope-chat-message dope-chat-message-assistant';
            item.setAttribute('aria-label', 'Assistant working');
            const content = document.createElement('div'); content.className = 'dope-chat-message-content';
            if (!state.runStartedAt) content.textContent = 'Working...';
            transcript.append(item);
            const diagnostic = chatStreamingActivityPresentation(state.stream?.chatId === chat.id ?
                state.stream.events : [], !!state.stream?.content);
            if (state.stream?.content && !this.activityAutoCollapsed.has(state.stream.messageId)) {
                this.activityAutoCollapsed.add(state.stream.messageId);
                this.activityExpansion.set(state.stream.messageId, false);
            }
            if (state.runStartedAt) this.appendReasoningActivity(item, state.stream?.messageId, diagnostic,
                true, state.runStartedAt, undefined, 'Working...', state.stream?.answerStartedAt);
            item.append(content);
            if (state.stream?.chatId === chat.id && state.stream.content) {
                    content.replaceChildren();
                    content.classList.add('dope-chat-final-answer');
                    const live = document.createElement('div'); live.className = 'dope-chat-live-answer';
                    live.append(this.renderLiveAnswer(state.stream.content,
                        `${state.stream.chatId}:${state.stream.messageId}:${state.stream.executionId}:0`));
                    content.append(live);
            }
            if (state.pendingCommand && !activeAssistant) {
                const command = this.commandApprovalCard();
                if (command) item.append(command);
            }
        }
        scroll.append(transcript);
        const latest = this.button('', () => this.scrollToLatest());
        latest.setAttribute('aria-label', 'Scroll to latest'); latest.title = 'Scroll to latest';
        const down = document.createElement('span'); down.className = codicon('chevron-down');
        down.setAttribute('aria-hidden', 'true'); latest.append(down);
        latest.className = 'dope-chat-latest'; latest.hidden = !this.scrollFollow.latestBelow;
        region.append(scroll, latest);
        if (!this.settingsOpen) shell.append(header);
        shell.append(region);
        const outputLimit = state.outputLimitDecisionTarget;
        if (outputLimit) {
            const notice = document.createElement('div');
            notice.className = 'dope-chat-output-limit-notice';
            notice.setAttribute('role', 'status');
            notice.setAttribute('aria-label', 'Generation limit reached');
            const prompt = document.createElement('span');
            prompt.textContent = 'Generation limit reached. Stop generating?';
            const actions = document.createElement('div');
            actions.className = 'dope-chat-output-limit-actions';
            const stop = this.button('Stop', () => { void state.decideOutputLimit('stop'); },
                state.outputLimitDecisionPending);
            stop.setAttribute('aria-label', 'Stop generating');
            const resume = this.button('Continue generating', () => { void state.decideOutputLimit('continue'); },
                state.outputLimitDecisionPending);
            resume.setAttribute('aria-label', 'Continue generating');
            notice.onkeydown = event => {
                if (event.key === 'Escape') {
                    event.preventDefault(); event.stopPropagation();
                    shell.querySelector<HTMLTextAreaElement>('.dope-chat-composer textarea')?.focus();
                }
            };
            actions.append(stop, resume);
            notice.append(prompt, actions);
            shell.append(notice);
        }
        const composer = document.createElement('div'); composer.className = 'dope-chat-composer';
        const input = document.createElement('textarea'); input.rows = 1; input.placeholder = 'Message';
        input.setAttribute('aria-label', 'Message'); input.value = state.draft;
        const inputWrap = document.createElement('div'); inputWrap.className = 'dope-chat-input-wrap';
        const mirror = document.createElement('div'); mirror.className = 'dope-chat-input-mirror';
        mirror.setAttribute('aria-hidden', 'true');
        const skillTooltip = document.createElement('span');
        skillTooltip.className = 'dope-chat-skill-tooltip'; skillTooltip.hidden = true;
        inputWrap.append(mirror, input, skillTooltip);
        const updateSkillHighlight = () => {
            const command = /^\/([a-z0-9-]+)(?=\s|$)/.exec(input.value)?.[1];
            const skill = this.skills?.find(entry => entry.name === command && entry.enabled);
            inputWrap.classList.toggle('dope-chat-input-has-skill', !!skill);
            mirror.replaceChildren(); mirror.hidden = !skill; skillTooltip.hidden = true;
            if (skill) {
                appendSkillText(mirror, input.value, skill);
                skillTooltip.textContent = `${skill.title} — ${skill.description}`;
                mirror.scrollTop = input.scrollTop; mirror.scrollLeft = input.scrollLeft;
            }
        };
        input.onscroll = () => { mirror.scrollTop = input.scrollTop; mirror.scrollLeft = input.scrollLeft; };
        input.onmousemove = event => {
            if (!skillPopup.hidden) { skillTooltip.hidden = true; return; }
            const token = mirror.querySelector<HTMLElement>('.dope-chat-skill-token');
            const bounds = token?.getBoundingClientRect();
            skillTooltip.hidden = !bounds || event.clientX < bounds.left || event.clientX > bounds.right ||
                event.clientY < bounds.top || event.clientY > bounds.bottom;
        };
        input.onmouseleave = () => { skillTooltip.hidden = true; };
        if (!this.skills && !this.skillsLoading) void this.loadSkills();
        const skillPopup = document.createElement('div'); skillPopup.className = 'dope-chat-skill-popup';
        skillPopup.setAttribute('role', 'dialog'); skillPopup.setAttribute('aria-label', 'Skills');
        let skillChoices: ChatSkill[] = [];
        let skillIndex = 0;
        const updateSkillPopup = () => {
            const caret = input.selectionStart;
            const match = /^\/([a-z0-9-]*)/i.exec(input.value);
            if (!match || caret > match[0].length ||
                input.value[match[0].length] !== undefined) { skillPopup.hidden = true; return; }
            const query = match[1].toLowerCase();
            const candidates = (this.skills ?? []).filter(skill => skill.enabled);
            const detected = candidates.find(skill => skill.name === query);
            skillChoices = candidates.filter(skill => skill.name.startsWith(query)).concat(
                candidates.filter(skill => !skill.name.startsWith(query) && skill.name.includes(query))).slice(0, 8);
            skillIndex = detected ? skillChoices.findIndex(skill => skill.id === detected.id) :
                Math.max(0, Math.min(skillIndex, skillChoices.length - 1));
            skillPopup.replaceChildren(); skillPopup.hidden = false;
            skillChoices.forEach((skill, index) => {
                const option = document.createElement('button'); option.type = 'button';
                option.className = 'dope-chat-skill-option'; option.setAttribute('role', 'option');
                option.setAttribute('aria-selected', String(index === skillIndex));
                const name = document.createElement('strong'); name.textContent = `/${skill.name}`;
                const title = document.createElement('span'); title.textContent = skill.title;
                title.className = 'dope-chat-skill-option-title';
                const summary = document.createElement('span'); summary.textContent = skill.description;
                summary.className = 'dope-chat-skill-option-summary';
                option.append(name, title, summary);
                option.onmousedown = event => event.preventDefault();
                option.onclick = () => selectSkill(skill);
                skillPopup.append(option);
            });
            const add = document.createElement('button'); add.type = 'button';
            add.className = 'dope-chat-skill-add'; add.textContent = '+ Add Skill';
            add.onclick = () => { this.skillFormOpen = true; this.openSkills(); };
            skillPopup.append(add);
        };
        const selectSkill = (skill: ChatSkill) => {
            const token = /^\/[a-z0-9-]*/i.exec(input.value)?.[0] ?? '/';
            input.value = `/${skill.name}${input.value.slice(token.length) || ' '}`;
            state.setDraft(input.value); skillPopup.hidden = true;
            input.focus(); input.setSelectionRange(skill.name.length + 2, skill.name.length + 2);
            resizeChatInput(input);
            updateSkillHighlight();
        };
        const toolbar = document.createElement('div'); toolbar.className = 'dope-chat-composer-toolbar';
        const menu = document.createElement('div'); menu.className = 'dope-chat-composer-menu'; menu.popover = 'auto';
        menu.id = `${this.id}-composer-actions`;
        menu.setAttribute('role', 'dialog'); menu.setAttribute('aria-label', 'Attach context');
        const more = this.button('', () => {
            if (menu.matches(':popover-open')) { menu.hidePopover(); return; }
            buildMenu();
            const bounds = more.getBoundingClientRect();
            menu.style.left = `${Math.max(8, Math.min(bounds.left, window.innerWidth - 208))}px`;
            menu.style.bottom = `${Math.max(8, window.innerHeight - bounds.top + 6)}px`;
            menu.showPopover();
            menu.querySelector<HTMLElement>('button, input')?.focus();
        });
        more.className = 'dope-chat-composer-more';
        more.title = 'Attach context'; more.setAttribute('aria-label', 'Attach context');
        const addIcon = document.createElement('span'); addIcon.className = codicon('add');
        addIcon.setAttribute('aria-hidden', 'true'); more.append(addIcon);
        more.setAttribute('aria-haspopup', 'dialog'); more.setAttribute('aria-controls', menu.id);
        more.setAttribute('aria-expanded', 'false');
        menu.addEventListener('toggle', () => more.setAttribute('aria-expanded', String(menu.matches(':popover-open'))));
        menu.onkeydown = event => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
            const choices = [...menu.querySelectorAll<HTMLElement>('button, input')];
            const index = choices.indexOf(document.activeElement as HTMLElement);
            choices[(index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length]?.focus();
            event.preventDefault();
        };
        const buildMenu = () => {
            menu.replaceChildren();
            const heading = document.createElement('div');
            heading.className = 'dope-chat-attach-heading';
            heading.textContent = 'Add Context:';
            menu.append(heading);
            const action = (label: string, icon: string, run: () => void) => {
                const button = this.button('', () => { menu.hidePopover(); run(); });
                const glyph = document.createElement('span'); glyph.className = codicon(icon); glyph.setAttribute('aria-hidden', 'true');
                button.append(glyph, document.createTextNode(label)); menu.append(button);
            };
            const workspace = state.workspace, chatId = state.chatId;
            if (!workspace || !chatId) return;
            action('File', 'file', () => void this.pickProjectFile(workspace, chatId));
            if (this.roadmapPicker?.available(workspace)) action('Roadmap Element', 'milestone', () => {
                void this.roadmapPicker!.begin(workspace).then(selections => {
                    if (!selections?.length) return;
                    if (this.controller.workspace !== workspace || this.controller.chatId !== chatId)
                        throw new Error('Chat or project changed; select Roadmap elements again');
                    this.controller.addRoadmapElements(selections);
                }).catch(error => { this.status.textContent = `Could not attach Roadmap elements: ${String(error)}`; });
            });
            const code = this.selectedCode();
            if (code) action('Selected code', 'code', () => {
                try {
                    const current = this.selectedCode();
                    if (!current || current.id !== code.id || current.start !== code.start ||
                        current.end !== code.end || current.text !== code.text)
                        throw new Error('Editor selection changed; select the code again');
                    this.attachSelection(current, workspace, chatId);
                } catch (error) { this.status.textContent = String(error); }
            });
            const planning = this.planningSelection?.current(workspace);
            const included = state.activePlanning;
            if (planning && !(included?.kind === planning.kind && included.id === planning.id &&
                included.projectId === planning.projectId && included.ownerRevision === planning.ownerRevision))
                action('Current planning selection', 'target', () => {
                    void this.planningSelection!.resolve(workspace, planning, true).then(resolved => {
                        this.attachSelection(resolved, workspace, chatId);
                    }).catch(error => { this.status.textContent = `Could not attach planning selection: ${String(error)}`; });
                });
            if (chat.settings.context.savedChatSearch) action('Saved Chat excerpt', 'comment-discussion', () => {
                menu.replaceChildren(heading);
                const search = document.createElement('input'); search.type = 'search';
                search.placeholder = 'Search saved Chats'; search.setAttribute('aria-label', 'Search saved Chats');
                const results = document.createElement('div'); results.className = 'dope-chat-attach-results';
                const find = async () => {
                    results.textContent = 'Searching…';
                    try {
                        const hits = await state.searchSaved(search.value.trim());
                        if (state.workspace !== workspace || state.chatId !== chatId || !menu.matches(':popover-open')) return;
                        results.replaceChildren();
                        if (!hits.length) results.textContent = 'No matching saved messages';
                        for (const hit of hits) {
                            const choice = this.button(`${hit.title} · ${hit.excerpt}`, () => {
                                try { this.attachSelection({ kind: 'saved-chat', id: hit.chatId,
                                    messageId: hit.messageId }, workspace, chatId); menu.hidePopover(); }
                                catch (error) { this.status.textContent = String(error); }
                            });
                            results.append(choice);
                        }
                    } catch (error) { results.textContent = `Search failed: ${String(error)}`; }
                };
                search.onkeydown = event => { if (event.key === 'Enter') { event.preventDefault(); void find(); } };
                const searchButton = this.button('Search', () => void find());
                menu.append(search, searchButton, results); menu.showPopover(); search.focus();
            });
            if (menu.childElementCount === 1) {
                const empty = document.createElement('div');
                empty.className = 'dope-chat-attach-empty';
                empty.textContent = 'No context available to attach';
                menu.append(empty);
            }
        };
        const modelPicker = document.createElement('label'); modelPicker.className = 'dope-chat-model-picker';
        const modelIcon = document.createElement('span'); modelIcon.className = codicon('sparkle');
        modelIcon.setAttribute('aria-hidden', 'true');
        const modelSelector = document.createElement('select'); modelSelector.setAttribute('aria-label', 'Model for next turn');
        modelPicker.append(modelIcon, modelSelector);
        if (chat.settings.modelPolicy.type === 'follow-interactive') modelSelector.append(new Option('Follow Interactive', ''));
        for (const connection of this.models.connections) {
            if (!connection.ready && !connection.models.length) {
                const option = new Option(`${connection.label} · Connection unavailable`, '');
                option.disabled = true; option.className = 'dope-chat-model-error';
                modelSelector.append(option);
            }
            for (const model of connection.models) {
                const option = new Option(`${connection.label} · ${model.label}`,
                    JSON.stringify({ connectionId: connection.id, modelId: model.id }));
                if (!connection.ready || !model.usable) {
                    option.disabled = true; option.className = 'dope-chat-model-error';
                    option.title = connection.ready ? 'Model unavailable' : 'Connection unavailable';
                }
                modelSelector.append(option);
            }
        }
        const selected = this.selectedModel();
        if (selected) modelSelector.value = JSON.stringify(selected);
        else if (chat.settings.modelPolicy.type === 'follow-interactive' && !state.turnModel) modelSelector.value = '';
        else {
            const option = new Option('No Model', '', true, true);
            option.className = 'dope-chat-model-error';
            modelSelector.append(option);
            modelPicker.dataset.unavailable = 'true';
        }
        const selectedIndex = modelSelector.selectedIndex;
        const manageModels = '__manage_models__';
        modelSelector.append(new Option('Manage Models', manageModels));
        modelSelector.onchange = () => {
            if (modelSelector.value === manageModels) {
                modelSelector.selectedIndex = selectedIndex;
                void this.aiCenter?.openFromChat(this.id);
                return;
            }
            state.turnModel = modelSelector.value ? JSON.parse(modelSelector.value) as ChatModelSelection : undefined;
            this.render();
        };
        const commandLabel = document.createElement('label');
        commandLabel.className = 'dope-chat-command-mode';
        commandLabel.dataset.mode = state.commandMode;
        const terminalIcon = document.createElement('span');
        terminalIcon.className = codicon('terminal');
        terminalIcon.setAttribute('aria-hidden', 'true');
        const commandMode = document.createElement('select');
        commandMode.setAttribute('aria-label', 'Commands');
        commandMode.append(new Option('Ask', 'ask'), new Option('Allow', 'allow'));
        commandMode.value = state.commandMode;
        commandMode.onchange = () => void state.setCommandMode(commandMode.value as 'ask' | 'allow');
        commandLabel.append(terminalIcon, commandMode);
        let submitButton: HTMLButtonElement;
        if (state.running) {
            submitButton = this.button('', () => void state.cancel());
            submitButton.title = 'Cancel'; submitButton.setAttribute('aria-label', 'Cancel');
            const icon = document.createElement('span'); icon.className = codicon('debug-stop');
            icon.setAttribute('aria-hidden', 'true'); submitButton.append(icon);
        } else {
            const canSend = Boolean(selected || chat.settings.modelPolicy.type === 'follow-interactive' && !state.turnModel);
            const confirmHosted = () => window.confirm('Send this Chat message, history and selected project context to the hosted model chosen by Interactive?');
            const submit = () => {
                if (!canSend || state.pending || !hasSendableChatDraft(state.draft)) return;
                const previousTop = scroll.scrollTop;
                void state.runTurn(state.turnModel, undefined, confirmHosted);
                const current = this.content.querySelector<HTMLElement>('.dope-chat-scroll');
                if (current) current.scrollTop = previousTop;
                this.scrollToLatest();
            };
            submitButton = this.button('', submit, !canSend || state.pending || !hasSendableChatDraft(state.draft));
            submitButton.title = 'Send'; submitButton.setAttribute('aria-label', 'Send');
            const icon = document.createElement('span'); icon.className = codicon('arrow-up');
            icon.setAttribute('aria-hidden', 'true'); submitButton.append(icon);
            input.onkeydown = event => {
                if (!event.isComposing && !skillPopup.hidden) {
                    if (event.key === 'Escape') { skillPopup.hidden = true; event.preventDefault(); return; }
                    if (skillChoices.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
                        skillIndex = (skillIndex + (event.key === 'ArrowDown' ? 1 : -1) + skillChoices.length) % skillChoices.length;
                        updateSkillPopup(); event.preventDefault(); return;
                    }
                    if ((event.key === 'Enter' || event.key === 'Tab') && skillChoices[skillIndex]) {
                        selectSkill(skillChoices[skillIndex]); event.preventDefault(); return;
                    }
                }
                if (!shouldSendChatInput(event)) return;
                event.preventDefault();
                submit();
            };
        }
        submitButton.classList.add('dope-chat-composer-submit');
        input.oninput = () => {
            state.setDraft(input.value);
            if (input.value !== state.draft) input.value = state.draft;
            if (!state.running) submitButton.disabled =
                !(selected || chat.settings.modelPolicy.type === 'follow-interactive' && !state.turnModel) ||
                state.pending || !hasSendableChatDraft(state.draft);
            resizeChatInput(input);
            updateSkillPopup();
            updateSkillHighlight();
        };
        toolbar.append(more, modelPicker, commandLabel, submitButton);
        composer.append(skillPopup, inputWrap, toolbar);
        updateSkillPopup();
        updateSkillHighlight();
        const responseNotices = document.createElement('div');
        responseNotices.className = 'dope-chat-response-notices';
        responseNotices.setAttribute('aria-label', 'Chat notices and reviews');
        if (state.running && state.planningProgress?.stage === 'validating' && !state.roadmapStage) {
            const progress = document.createElement('p');
            progress.className = 'dope-chat-planning-progress';
            progress.setAttribute('role', 'status');
            progress.textContent = 'Validating local planning result…';
            responseNotices.append(progress);
        }
        if (state.context.length || state.documentationRevision) {
            const selectedContext = document.createElement('ul');
            selectedContext.className = 'dope-chat-selected-context';
            if (state.documentationRevision) {
                const row = document.createElement('li');
                const label = document.createElement('span');
                label.textContent = `Documentation proposal · Revision ${state.documentationRevision.revision}`;
                const remove = this.button('×', () => state.restoreDocumentationDraft());
                remove.setAttribute('aria-label', 'Remove documentation proposal revision target');
                row.append(label, remove); selectedContext.append(row);
            }
            state.context.forEach((item, index) => {
                const row = document.createElement('li');
                const label = document.createElement('span');
                const title = item.kind === 'saved-chat' ? state.snapshot?.chats.find(chat => chat.id === item.id)?.title : undefined;
                const kind = item.kind === 'roadmap' && item.elementKind ? 'Roadmap' :
                    item.kind === 'saved-chat' ? 'Chat' : item.kind === 'selection' ? 'Code' :
                    item.kind === 'file' ? 'File' : 'Planning';
                label.textContent = `${kind}: ${item.label ?? title ?? item.id}${item.start !== undefined ? `:${item.start}-${item.end}` : ''}`;
                const remove = this.button('×', () => state.removeContext(index));
                remove.setAttribute('aria-label', `Remove ${label.textContent}`);
                row.append(label, remove);
                selectedContext.append(row);
            });
            composer.prepend(selectedContext);
        }
        if (state.previousDocumentationDraft !== undefined && !state.documentationRevision) {
            const restore = this.button('Restore previous draft', () => state.restoreDocumentationDraft());
            composer.prepend(restore);
        }
        if (state.planningProposal && !state.planningProposal.preview)
            responseNotices.append(this.roadmapProposalReviewCard(state.planningProposal));
        if (state.planningProposalError) {
            const note = document.createElement('p');
            note.setAttribute('role', 'status');
            note.textContent = state.planningProposalError;
            const messageId = state.planningProposalErrorMessageId ?? [...chat.messages].reverse().find(message =>
                message.role === 'assistant' && isInlineRoadmapProposal(message) &&
                message.planningActivity?.diagnostic === state.planningProposalError)?.id;
            const source = Array.from(transcript.children).find(item =>
                (item as HTMLElement).dataset.messageId === messageId);
            const card = source?.querySelector('.dope-chat-plan-review');
            const saved = chat.messages.find(message => message.id === messageId);
            if (card && saved?.role === 'assistant' && isInlineRoadmapProposal(saved)) {
                if (saved.planningActivity?.diagnostic !== state.planningProposalError) card.append(note);
            } else if (source) source.append(note);
            else responseNotices.append(note);
        }
        responseNotices.prepend(this.status);
        scroll.append(responseNotices);
        shell.append(composer, menu);
        if (this.settingsOpen) {
            const backdrop = document.createElement('div');
            backdrop.className = 'dope-chat-settings-backdrop';
            backdrop.setAttribute('aria-hidden', 'true');
            backdrop.onclick = () => this.closeChatSettings();
            const overlay = this.renderSettings(chat.id);
            if (this.settingsEntering) {
                backdrop.classList.add('dope-chat-settings-entering');
                overlay.classList.add('dope-chat-settings-entering');
                this.settingsEntering = false;
            }
            region.append(backdrop, overlay);
        }
        this.content.append(shell);
        this.updateLiveStageNotice();
        resizeChatInput(input);
        this.composerResizeObserver = new ResizeObserver(() => resizeChatInput(input));
        this.composerResizeObserver.observe(shell);
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
        const settings = shell.querySelector<HTMLElement>('.dope-chat-settings-form');
        if (settings) settings.scrollTop = settingsScrollTop;
        latest.hidden = !this.scrollFollow.latestBelow;
        if (state.running && state.stream?.chatId === chat.id) this.updateLiveStreamActivity();
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
        const viewed = this.viewedProposal;
        if (viewed) {
            this.viewedProposal = undefined;
            void this.clearRoadmapProposal?.(viewed.uri, viewed.chatId, viewed.id, false, []).catch(() => {});
        }
        this.copyMenu.close(false);
        this.composerResizeObserver?.disconnect();
        this.liveReasoning = undefined;
        this.liveAnswerVisible = undefined;
        this.liveAnswerReveal.reset();
        this.answerBatcher.cancel();
        this.stopElapsedTicker();
        this.endTranscriptDrag();
        document.removeEventListener('keydown', this.spacePanKeyDown);
        document.removeEventListener('keyup', this.spacePanKeyUp);
        window.removeEventListener('blur', this.spacePanBlur);
        this.cancelScrollAnimation?.();
        if (this.transcriptTouchSettleTimer) clearTimeout(this.transcriptTouchSettleTimer);
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
