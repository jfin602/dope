import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { ApplicationShell, type StatefulWidget } from '@theia/core/lib/browser';
import { SingleTextInputDialog } from '@theia/core/lib/browser/dialogs';
import type { Event } from '@theia/core/lib/common';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import type { MarkdownRenderer } from '@theia/core/lib/browser/markdown-rendering/markdown-renderer';
import type { ChatOperation } from '@dope/chat/lib/service';
import { CHAT_COLORS, type ChatSettings, type ChatContextKind, type ChatModelSelection } from '@dope/chat';
import type { ChatContextSelection } from '@dope/chat/lib/service';
import { SoftwareMapController } from './software-map-controller';
import type { ModelConnectionsService, ModelConnectionsSnapshot } from '@dope/contracts/lib/model-connections-service';
import { AICenterContribution } from './ai-center-contribution';
import { ChatOpenOwners, ChatPanelController, chatTree, readOnlyPrompt } from './chat-panel-controller';
import type { ChatConnection, ChatTree } from './chat-panel-controller';
import { ChatScrollFollow, ChatTranscriptDrag, animateChatToLatest, canDragChatTranscript, chatLauncherIds, workLauncherIds, chatPanelWidgetId, panelModule, resizeChatInput, resolveChatModel, shouldSendChatInput, type ChatPanelOptions } from './chat-panel-presentation';
import { renderUntrustedMessageMarkdown } from './untrusted-message-markdown';
import { readSharedPanelLayout, SharedPanelState, WorkOpenOwners } from './shared-panel-state';
import type { WorkSelection } from './shared-panel-state';
import { WorkSelectionController, workReviewCanAccept, workReviewState, workRows, workTitle } from './work-selection-controller';
import { restoreWorkScroll } from './work-transcript-presentation';
import type { AgentRuntimeService } from '@dope/contracts/lib/agent-runtime-service';
import type { AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import type { AIRolePolicyService } from '@dope/contracts/lib/ai-role-policy-service';
import { createDefaultExecutionGrant, EFFECT_KINDS } from '@dope/agent-core';
import { AgentRunController } from './agent-run-controller';

export class ChatPanelWidget extends BaseWidget implements StatefulWidget {
    readonly controller: ChatPanelController;
    readonly panel: SharedPanelState;
    readonly workController?: WorkSelectionController;
    readonly directController?: AgentRunController;
    private composingWork = false;
    private promptStacksOnly = false;
    private lastWorkSelection?: WorkSelection;
    private readonly rootsListener;
    private readonly modelsListener;
    private readonly status = document.createElement('p');
    private module: 'chat' | 'work';
    private readonly content = document.createElement('div');
    private workspaceRequest = 0;
    private modelsRequest = 0;
    private models: ModelConnectionsSnapshot = { connections: [] };
    private settingsOpen = false;
    private revealSettings = false;
    private settingsDraft?: ChatSettings;
    private settingsChatId?: string;
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
        private readonly openTranscript?: (project: string, runId: string) => Promise<void>) {
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
        this.controller = new ChatPanelController(connect, () => this.render(), owners, this.id,
            () => { void this.shell.activateWidget(this.id); });
        this.panel = new SharedPanelState(workOwners, this.id,
            () => { this.panel.setMode('work'); void this.shell.activateWidget(this.id); }, () => this.render());
        this.panel.mode = this.module;
        if (runtime) this.workController = new WorkSelectionController(runtime, () => this.render());
        if (runtime && registry && roles) this.directController = new AgentRunController(runtime, registry, roles, () => this.render());
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.node.append(this.status, this.content);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.attach(); });
        this.modelsListener = onModelsChanged?.(() => { if (this.module === 'chat') void this.loadModels();
            void this.directController?.resolveTarget();
            void this.workController?.phase.refresh(); });
        void this.attach();
        if (this.module === 'chat') void this.loadModels();
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
        scroll?.classList.remove('dope-chat-scroll-dragging');
        this.dragPointerId = undefined; this.dragChatId = undefined;
        document.removeEventListener('pointermove', this.moveTranscriptDrag);
        document.removeEventListener('pointerup', this.endTranscriptPointer);
        document.removeEventListener('pointercancel', this.endTranscriptPointer);
        return dragged;
    }

    storeState(): object {
        return { ...this.panel.layout(this.module === 'chat' ? this.controller.chatId : undefined),
            module: this.module, area: this.shell.getAreaFor(this) };
    }
    restoreState(state: object): void {
        const layout = readSharedPanelLayout(state);
        if (!layout?.workspace) return;
        this.module = panelModule(this.options, layout);
        layout.panelMode = this.module;
        this.panel.restore(layout);
        if (this.module === 'chat') this.controller.restore(layout.workspace, layout.chatId ? 'chat' : 'select-chat', layout.chatId);
    }

    private async attach(): Promise<void> {
        const request = ++this.workspaceRequest;
        this.composingWork = false;
        this.lastWorkSelection = undefined;
        // Invalidate the old project immediately while workspace roots resolve.
        this.panel.attach(undefined);
        await this.workController?.attach(undefined);
        await this.directController?.attach(undefined);
        await this.controller.attach(undefined);
        const roots = await this.workspaces.roots;
        if (this.isDisposed || request !== this.workspaceRequest) return;
        const workspace = roots.length === 1 ? roots[0].resource.toString() : undefined;
        this.panel.attach(workspace);
        this.panel.setMode(this.module);
        const workAttached = this.workController?.attach(workspace);
        void this.directController?.attach(workspace);
        void workAttached?.then(() => {
            if (!this.isDisposed && request === this.workspaceRequest && this.panel.work)
                void this.workController?.select(this.panel.work);
        });
        if (this.module === 'chat') await this.controller.attach(workspace);
    }

    async selectChatLauncher(): Promise<void> {
        if (this.module !== 'chat') return;
        this.panel.setMode('chat');
        await this.controller.select(undefined);
    }
    async selectWorkLauncher(selection?: WorkSelection): Promise<void> {
        this.composingWork = false;
        this.promptStacksOnly = false;
        if (this.module !== 'work') return;
        this.panel.setMode('work');
        if (selection) this.selectWork(selection);
        else this.render();
        void this.refreshWork();
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
    private selectWork(selection?: WorkSelection): void {
        this.composingWork = false;
        if (selection) this.promptStacksOnly = false;
        if (!this.panel.selectWork(selection)) return;
        if (selection) this.lastWorkSelection = selection;
        void (async () => {
            await this.workController?.select(selection);
            if (!selection) await this.workController?.refresh();
            if (selection?.kind === 'sequence' && this.panel.work?.id === selection.id) {
                const id = this.workController?.phase.selected?.id;
                if (id && id !== selection.id) this.panel.selectWork({ kind: 'sequence', id });
            }
        })();
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
        validation.value = controller.validationCommand; validation.setAttribute('aria-label', 'Required validation command (optional)');
        validation.placeholder = 'Optional test command';
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
        const status = document.createElement('p'); status.setAttribute('role', 'status');
        status.textContent = controller.message || controller.targetMessage;
        const submit = async () => {
            if (!controller.canStart) return;
            const run = await controller.start();
            if (run) { await this.workController?.refresh(); this.selectWork({ kind: 'run', id: run.id }); }
        };
        form.onsubmit = event => { event.preventDefault(); void submit(); };
        form.append(prompt, model, validation, acceptLabel, review, status, start);
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
            } else void controller?.select(work);
        }));
        this.content.append(header);
        if (!controller?.handle) return;
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
                meta.textContent = [row.status, row.activity, row.elapsedMs === undefined ? time :
                    `${Math.floor(row.elapsedMs / 60000)}m elapsed`].filter(Boolean).join(' · ');
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
            if (event.button !== 0 || !event.isPrimary || !canDragChatTranscript(event.target as Element)) return;
            this.workPointerId = event.pointerId;
            this.cancelWorkAnimation?.(); this.workAnimationUntil = 0;
            this.workDrag.start(event.clientY, scroll.scrollTop, event.clientX);
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
            scroll.classList.remove('dope-chat-scroll-dragging');
        };
        region.append(scroll, latest);
        const detail = (text: string, className = 'dope-work-detail') => {
            const paragraph = document.createElement('p'); paragraph.className = className;
            paragraph.textContent = text; scroll.append(paragraph);
        };
        if (work.kind === 'sequence') {
            const phase = controller.phase, sequence = phase.selected?.id === work.id ? phase.selected : undefined;
            if (sequence) {
                detail(`Status: ${sequence.status}${sequence.blockedReason ? ` · ${sequence.blockedReason}` : ''}`, 'dope-work-overview');
                detail(`Current: P${Math.min(sequence.currentEntryNumber, sequence.stack.entries.length)} of ${sequence.stack.entries.length}`, 'dope-work-overview');
                if (sequence.checkpoints.length) {
                    const checkpoint = document.createElement('small'); checkpoint.className = 'dope-work-system';
                    checkpoint.textContent = `${sequence.checkpoints.length} checkpoint${sequence.checkpoints.length === 1 ? '' : 's'} recorded`;
                    scroll.append(checkpoint);
                }
                const progress = document.createElement('details'); progress.className = 'dope-work-diagnostics';
                const progressTitle = document.createElement('summary'); progressTitle.textContent = 'Progress'; progress.append(progressTitle);
                const entries = document.createElement('ol');
                for (const entry of sequence.stack.entries) {
                    const item = document.createElement('li');
                    const checkpoint = sequence.checkpoints.find(value => value.entryNumber === entry.number);
                    const current = entry.number === sequence.currentEntryNumber && sequence.status !== 'completed';
                    const state = checkpoint ? 'Completed' : current ? sequence.status : 'Pending';
                    item.textContent = `P${entry.number} - ${entry.title} · ${state}${checkpoint ? ` · ${checkpoint.sha}` : ''}`;
                    if (checkpoint?.runId && this.panel.workspace) item.append(' ', this.button('Open Transcript', () =>
                        void this.openTranscript?.(this.panel.workspace!, checkpoint.runId!)));
                    entries.append(item);
                }
                progress.append(entries); scroll.append(progress);
                const metadata = document.createElement('details'); metadata.className = 'dope-work-diagnostics';
                const metadataTitle = document.createElement('summary'); metadataTitle.textContent = 'Prompt Stack details';
                const metadataText = document.createElement('p');
                metadataText.textContent = `${sequence.stack.mode === 'correction' ? 'Correction' : 'Phase'} ${sequence.stack.phase} · ${sequence.stack.folderName} · Model: Coding Agent`;
                metadata.append(metadataTitle, metadataText); scroll.append(metadata);
                if (sequence.runIds?.length && this.panel.workspace) {
                    const previousRuns = document.createElement('details'); previousRuns.className = 'dope-work-diagnostics';
                    const previousTitle = document.createElement('summary'); previousTitle.textContent = 'Saved run transcripts';
                    previousRuns.append(previousTitle);
                    for (const runId of sequence.runIds) {
                        const run = controller.runs.find(candidate => candidate.id === runId);
                        previousRuns.append(this.button(`${run ? `Run · ${run.status}` : 'Saved run'} · Open Transcript`, () =>
                            void this.openTranscript?.(this.panel.workspace!, runId)));
                    }
                    scroll.append(previousRuns);
                }
                if (phase.run) {
                    detail(`Current activity: ${phase.run.outcome?.summary ?? phase.run.changeSummary?.summary ?? phase.run.status}`, 'dope-work-overview');
                    detail(`Validation: ${phase.run.validationResults.map(result => `${result.label} ${result.status}`).join(', ') || 'Pending'}`,
                        phase.run.validationResults.some(result => result.status === 'failed') ? 'dope-work-warning' : 'dope-work-detail');
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
                    detail(`P${entry.number} · ${entry.execution === 'manual-gate' ? 'Manual/browser gate' : 'Agent task'}`, 'dope-work-overview');
                    if (entry.execution === 'manual-gate' && sequence.status !== 'completed') {
                        const prompt = document.createElement('pre'); prompt.textContent = entry.promptText; scroll.append(prompt);
                        scroll.append(this.button('Verify manual gate', () => void phase.reconcile(), phase.busy));
                    } else if (entry.execution === 'agent-task' && sequence.status !== 'completed') {
                        const validation = document.createElement('input'); validation.type = 'text';
                        validation.value = phase.validationCommand; validation.maxLength = 160;
                        validation.setAttribute('aria-label', 'Required validation command');
                        validation.oninput = () => { phase.validationCommand = validation.value; start.disabled = !phase.canStart; };
                        scroll.append(validation);
                        const grant = document.createElement('label');
                        const check = document.createElement('input'); check.type = 'checkbox'; check.checked = phase.acceptedGrant;
                        check.onchange = () => { phase.acceptedGrant = check.checked; start.disabled = !phase.canStart; };
                        grant.append(check, ' Accept project execution grant'); scroll.append(grant);
                        if (phase.needsDirtyAcceptance && !phase.dirtyPromptDismissed)
                            scroll.append(this.button('Continue with dirty worktree', () => void phase.continueDirty(), phase.busy),
                                this.button('Cancel dirty acceptance', () => phase.cancelDirty(), phase.busy));
                        detail(phase.readinessMessage, phase.canStart ? 'dope-work-detail' : 'dope-work-warning');
                        const start = this.button(sequence.status === 'ready' ? 'Start' : 'Resume', () => void phase.start(), !phase.canStart);
                        scroll.append(start, this.button('Stop', () => void phase.stop(), phase.busy || sequence.status !== 'running'));
                    }
                }
                if (sequence.blockedReason === 'checkpoint-pending' || sequence.blockedReason === 'checkpoint-failed')
                    scroll.append(this.button('Verify checkpoint', () => void phase.checkpoint(), phase.busy));
                else if (sequence.status !== 'running' && sequence.status !== 'completed')
                    scroll.append(this.button('Reconcile repository', () => void phase.reconcile(), phase.busy));
                if (sequence.gateMessage) detail(sequence.gateMessage, 'dope-work-warning');
                const transcriptRunId = phase.run?.id ?? sequence.runIds?.at(-1) ?? sequence.checkpoints.at(-1)?.runId;
                if (transcriptRunId && this.panel.workspace) scroll.append(this.button('Open Transcript', () =>
                    void this.openTranscript?.(this.panel.workspace!, transcriptRunId)));
            } else detail('Prompt Stack could not be opened. Refresh and try again.');
        } else {
            const run = work.kind === 'run' && controller.selectedRun?.id === work.id ? controller.selectedRun : undefined;
            if (run) {
                const state = document.createElement('p'); state.className = 'dope-work-overview';
                state.textContent = `Run · ${run.status}`; scroll.append(state);
                const provenance = document.createElement('details'); provenance.className = 'dope-work-diagnostics';
                const provenanceTitle = document.createElement('summary'); provenanceTitle.textContent = 'Model and provenance';
                const provenanceText = document.createElement('p');
                provenanceText.textContent = run.provenance ? `${run.provenance.providerId} · ${run.provenance.modelId}` : 'Coding Agent';
                provenance.append(provenanceTitle, provenanceText); scroll.append(provenance);
                const recent = [...controller.transcript].reverse().find(entry => entry.kind === 'message' || entry.kind === 'command');
                detail(`Current activity: ${recent?.kind === 'message' ? recent.text.slice(0, 180) :
                    recent?.kind === 'command' ? recent.command : run.outcome?.summary ?? run.status}`, 'dope-work-overview');
                if (controller.selectedTask?.origin.kind === 'direct' &&
                    ['pending', 'running', 'blocked'].includes(run.status)) scroll.append(this.button('Stop Work', () => {
                    if (this.directController) { void this.directController.select(run.id).then(() => this.directController?.stop()); }
                }));
                if (this.panel.workspace) scroll.append(this.button('Open Transcript', () =>
                    void this.openTranscript?.(this.panel.workspace!, run.id)));
                if (controller.transcriptState === 'not-recorded') detail('Transcript not recorded for this historical run.');
                const diagnostics = document.createElement('details'); diagnostics.className = 'dope-work-diagnostics';
                const summary = document.createElement('summary'); summary.textContent = 'Run diagnostics'; diagnostics.append(summary);
                if (controller.selectedTask) { const instructions = document.createElement('p');
                    instructions.textContent = controller.selectedTask.instructions; diagnostics.append(instructions); }
                for (const path of run.changedFiles) {
                    const item = document.createElement('p'); item.textContent = `Changed · ${path}`; diagnostics.append(item);
                }
                if (run.changedFiles.length) { const status = document.createElement('small'); status.className = 'dope-work-system';
                    status.textContent = `${run.changedFiles.length} changed file${run.changedFiles.length === 1 ? '' : 's'}`; scroll.append(status); }
                for (const result of run.validationResults) {
                    const item = document.createElement('p'); item.textContent = `Candidate validation · ${result.label} · ${result.status}`;
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
                if (run.candidateReview && controller.selectedTask?.origin.kind === 'work-item') {
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
                    scope.textContent = `Delegated paths: ${controller.selectedTask.origin.scope.delegablePaths.join(', ')} · ` +
                        `Human reserved: ${controller.selectedTask.origin.scope.humanReservedPaths.join(', ') || 'none'}`;
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
                        section.append(this.button('Accept candidate', () => void controller.decideCandidate('accept'),
                            state !== 'pending' || !workReviewCanAccept(run, controller.selectedTask)),
                            this.button('Reject candidate', () => void controller.decideCandidate('reject'), state !== 'pending'));
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
            } else if (work.kind === 'task' && controller.selectedTask?.id === work.id)
                detail(controller.selectedTask.instructions);
            else detail('Work record could not be found.');
        }
        this.content.append(region);
        latest.hidden = !this.workFollow.latestBelow;
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
            'physical-map', 'flow', 'planning-map', 'work-item', 'saved-chat'];
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
            const menu = document.createElement('details');
            menu.className = 'dope-chat-context';
            const menuLabel = document.createElement('summary');
            menuLabel.textContent = '⋯';
            menuLabel.setAttribute('aria-label', `Actions for Chat ${chat.title}`);
            const actions = document.createElement('div');
            actions.className = 'dope-chat-actions';
            const rename = this.button('Rename', () => void this.name('Rename Chat', chat.title).then(title => {
                if (title) this.mutate({ type: 'rename-chat', chatId: chat.id, title });
            }));
            const move = this.button('Move', () => void this.folderChoice('Move Chat', chat.folderPath).then(folderPath => {
                if (folderPath !== undefined) this.mutate({ type: 'move-chat', chatId: chat.id, folderPath });
            }));
            actions.append(rename, move);
            menu.append(menuLabel, actions);
            row.append(select, menu);
            item.append(row);
            list.append(item);
        }
        return list;
    }
    private render(): void {
        const state = this.controller;
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
        this.status.textContent = this.panel.mode === 'chat' ?
            state.error || (state.loading ? 'Loading Chats…' : !state.workspace ? 'Open one project to use Chats.' : '') :
            !this.panel.workspace ? 'Open one project to use Work.' : !this.workController?.handle ?
                this.workController?.message || 'Loading Work…' : '';
        if (this.panel.mode === 'work' && this.panel.workspace && !this.workController?.handle &&
            this.workController?.message) this.status.append(' ', this.button('Retry', () => {
                void this.workController?.attach(this.panel.workspace).then(() => this.directController?.attach(this.panel.workspace));
            }));
        if (this.panel.mode === 'chat' && state.error.includes('Interactive role')) this.status.append(' ',
            this.button('Configure Interactive in Roles', () => { void this.aiCenter?.openRole('interactive'); }));
        this.content.replaceChildren();
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
        const header = document.createElement('header');
        const back = this.button('Back / Chats', () => state.select(undefined));
        const heading = document.createElement('h2');
        heading.textContent = chat.title;
        const settings = this.button('⚙', () => {
            this.settingsOpen = !this.settingsOpen;
            this.revealSettings = this.settingsOpen;
            this.settingsDraft = this.settingsOpen ? structuredClone(chat.settings) : undefined;
            this.settingsChatId = chat.id;
            this.render();
        });
        settings.className = 'dope-chat-settings';
        settings.setAttribute('aria-label', 'Chat settings');
        header.append(back, heading, settings);
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
            if (event.button !== 0 || !event.isPrimary ||
                !canDragChatTranscript(event.target as Element)) return;
            this.endTranscriptDrag();
            this.dragPointerId = event.pointerId; this.dragChatId = state.chatId;
            this.transcriptDrag.start(event.clientY, scroll.scrollTop, event.clientX);
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
        for (const message of chat.messages) {
            const item = document.createElement('li');
            item.className = `dope-chat-message dope-chat-message-${message.role}`;
            item.setAttribute('aria-label', message.role === 'user' ? 'You' : 'Assistant');
            if (message.role === 'user') item.dataset.color = chat.color;
            const content = document.createElement('div');
            content.className = 'dope-chat-message-content';
            const body = message.role === 'assistant' && state.stream?.messageId === message.id ?
                state.stream.content : message.content;
            if (message.role === 'assistant' && message.execution.status === 'pending' && !body) {
                content.classList.add('dope-chat-working');
                content.textContent = 'Working';
                const dots = document.createElement('span'); dots.textContent = '…'; dots.setAttribute('aria-hidden', 'true');
                content.append(dots);
            } else if (message.role === 'assistant') {
                content.append(renderUntrustedMessageMarkdown(this.markdown, body));
            } else content.textContent = body;
            const time = document.createElement('time');
            time.dateTime = message.createdAt;
            time.textContent = new Date(message.createdAt).toLocaleString();
            item.append(content);
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
        if (state.running && !chat.messages.some(message =>
            message.role === 'assistant' && ['pending', 'streaming'].includes(message.execution.status))) {
            const item = document.createElement('li'); item.className = 'dope-chat-message dope-chat-message-assistant';
            item.setAttribute('aria-label', state.stream?.content ? 'Assistant' : 'Assistant working');
            const content = document.createElement('div'); content.className = 'dope-chat-message-content';
            if (state.stream?.content) {
                content.append(renderUntrustedMessageMarkdown(this.markdown, state.stream.content));
            } else {
                content.classList.add('dope-chat-working'); content.textContent = 'Working';
                const dots = document.createElement('span'); dots.textContent = '…'; dots.setAttribute('aria-hidden', 'true');
                content.append(dots);
            }
            item.append(content); transcript.append(item);
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
        if (selected && state.context.length) menuButton('Preview context', () => {
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
        toolbar.append(more, modelSelector, submitButton);
        composer.append(input, toolbar);
        composer.append(menu);
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
            composer.append(selectedContext);
        }
        if (state.lastContext) {
            const details = document.createElement('details');
            details.className = 'dope-chat-context-diagnostics';
            const summary = document.createElement('summary');
            summary.textContent = `Context · ${state.lastContext.refs.length} sources · ${state.lastContext.usedTokens}/${state.lastContext.budgetTokens} tokens`;
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
            composer.append(details);
        }
        shell.append(composer);
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
        if (focused) {
            const replacement = [...this.content.querySelectorAll<HTMLElement>('[aria-label]')]
                .find(element => element.getAttribute('aria-label') === focused);
            replacement?.focus({ preventScroll: true });
            if (selection && replacement instanceof HTMLTextAreaElement)
                replacement.setSelectionRange(selection[0], selection[1]);
        }
    }
    override dispose(): void {
        this.endTranscriptDrag();
        this.cancelScrollAnimation?.();
        ++this.workspaceRequest;
        ++this.modelsRequest;
        this.rootsListener.dispose();
        this.modelsListener?.dispose();
        this.panel.dispose();
        this.controller.dispose();
        super.dispose();
    }
}
