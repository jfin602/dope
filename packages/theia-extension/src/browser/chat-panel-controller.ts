import { compareChatsByInteraction, joinChatFolderPath } from '@dope/chat';
import type { Chat, ChatCollection, ChatFolderPath, ChatActivityEvent } from '@dope/chat';
import type { ChatClient, ChatOperation, ChatService, ChatContextSelection, ChatContextPreview, ChatSearchHit,
    ChatPlanningProposal, ChatRoadmapOffer, ChatStrategicDraftReview, ChatTurnResult,
    ChatCommandMode, ChatCommandPreview } from '@dope/chat/lib/service';
import type { ChatModelSelection } from '@dope/chat';
import type { ChatPlanningSelection, PlanningSelection } from './chat-planning-selection';
import { isDraftPlanningAction } from './chat-panel-presentation';

export type ChatConnection = ChatService & { setClient(client: ChatClient | undefined): void; dispose(): void };
export type ChatMode = 'select-chat' | 'chat';
export type ReadOnlyBehavior = 'Ask' | 'Explain' | 'Trace' | 'Find Related';
export function readOnlyPrompt(kind: ReadOnlyBehavior, draft = ''): string {
    const prompts = {
        Ask: 'Answer this question using the attached project context. Distinguish verified project facts from interpretation:',
        Explain: 'Explain the selected project context. Cite the supplied evidence and label unknowns:',
        Trace: 'Trace possible execution using only evidenced Flow hops. State truncation and unknown hops:',
        'Find Related': 'Find related project identities using the supplied context. Separate direct evidence from suggestions:',
    };
    return `${prompts[kind]}${draft.trim() ? `\n\n${draft.trim()}` : ''}`;
}
export interface ChatTree { path: ChatFolderPath; folders: ChatTree[]; chats: Chat[] }

/** A renderer-local reservation, keyed by project URI and durable Chat identity. */
export class ChatOpenOwners {
    private readonly owners = new Map<string, { panelId: string; focus: () => void }>();
    private key(workspace: string, chatId: string): string { return JSON.stringify([workspace, chatId]); }
    reserve(workspace: string, chatId: string, panelId: string, focus: () => void): boolean {
        const key = this.key(workspace, chatId);
        const owner = this.owners.get(key);
        if (owner && owner.panelId !== panelId) { owner.focus(); return false; }
        this.owners.set(key, { panelId, focus });
        return true;
    }
    release(workspace: string, chatId: string, panelId: string): void {
        const key = this.key(workspace, chatId);
        if (this.owners.get(key)?.panelId === panelId) this.owners.delete(key);
    }
    focus(workspace: string, chatId: string): boolean {
        const owner = this.owners.get(this.key(workspace, chatId));
        if (!owner) return false;
        owner.focus();
        return true;
    }
}

export function chatTree(collection: ChatCollection): ChatTree {
    const root: ChatTree = { path: '', folders: [], chats: [] };
    const nodes = new Map<string, ChatTree>([['', root]]);
    for (const folder of [...collection.folders].sort((a, b) => a.path.localeCompare(b.path)))
        nodes.set(folder.path, { path: folder.path, folders: [], chats: [] });
    for (const folder of collection.folders) {
        const parent = folder.path.includes('/') ? folder.path.slice(0, folder.path.lastIndexOf('/')) : '';
        nodes.get(parent)?.folders.push(nodes.get(folder.path)!);
    }
    for (const node of nodes.values()) node.folders.sort((a, b) => a.path.localeCompare(b.path));
    for (const chat of collection.chats) nodes.get(chat.folderPath)?.chats.push(chat);
    for (const node of nodes.values()) node.chats.sort(compareChatsByInteraction);
    return root;
}

/** Panel-local navigation over the shared project service. */
export class ChatPanelController {
    workspace: string | undefined;
    snapshot: ChatCollection | undefined;
    mode: ChatMode = 'select-chat';
    chatId: string | undefined;
    loading = false;
    pending = false;
    error = '';
    draft = '';
    context: ChatContextSelection[] = [];
    lastContext?: ChatContextPreview;
    planningProposal?: ChatPlanningProposal;
    roadmapOffer?: ChatRoadmapOffer;
    strategicDraftReview?: ChatStrategicDraftReview;
    planningProposalError?: string;
    planningProposalErrorMessageId?: string;
    planningMode: 'follow' | 'pin' = 'follow';
    pinnedPlanning?: PlanningSelection;
    turnModel: ChatModelSelection | undefined;
    commandMode: ChatCommandMode = 'ask';
    pendingCommand?: ChatCommandPreview;
    toolProgress?: { messageId: string; events: { name: NonNullable<import('@dope/chat').ChatExecution['toolEvents']>[number]['name'];
        status: 'running' | 'completed' | 'failed' | 'denied'; truncated?: boolean; detail?: string; target?: string }[] };
    running = false;
    runStartedAt?: string;
    stream: { messageId: string; executionId: string; content: string; sequence: number;
        activitySequence: number; events: ChatActivityEvent[] } | undefined;
    planningProgress?: { messageId: string; stage: 'waiting' | 'validating' };
    roadmapGenerationStage?: Extract<import('@dope/chat/lib/service').ChatEvent, { kind: 'planning-progress' }>['stage'];
    roadmapGenerationProjectId?: string;
    activeRoadmapOfferId?: string;
    transientUser: { chatId: string; content: string; previousIds: Set<string> } | undefined;
    private connection?: ChatConnection;
    private handle?: string;
    private generation = 0;
    private request = 0;
    private eventRevision = 0;
    private disposed = false;
    private selection = 0;
    private lease?: { workspace: string; chatId: string; connection: ChatConnection; handle: string; token: string };
    private renewal?: ReturnType<typeof setInterval>;
    private restoreRetry?: ReturnType<typeof setTimeout>;
    private retryChatId?: string;
    private restoreAttempts = 0;
    private restored?: { workspace: string; chatId: string };
    private restoredPlanning?: { workspace: string; selection: PlanningSelection };
    private departing?: Promise<void>;
    private readonly selections = new Set<Promise<boolean>>();
    private readonly planningListener?: { dispose(): void };
    private planningGeneration = 0;

    constructor(private readonly connect: () => ChatConnection, private readonly changed: () => void,
        private readonly owners = new ChatOpenOwners(), private readonly panelId: string = crypto.randomUUID(),
        private readonly focus = () => {}, private readonly planning?: ChatPlanningSelection) {
        this.planningListener = planning?.onChange(() => {
            ++this.planningGeneration; this.lastContext = undefined; this.changed();
        });
    }
    get chat(): Chat | undefined { return this.snapshot?.chats.find(chat => chat.id === this.chatId); }
    get attached(): boolean { return !!this.handle; }

    async attach(workspace: string | undefined): Promise<void> {
        if (this.disposed || workspace && workspace === this.workspace && this.handle) return;
        this.clearRestoreRetry();
        const generation = ++this.generation;
        ++this.request;
        ++this.selection;
        this.workspace = undefined;
        this.snapshot = undefined;
        this.mode = 'select-chat';
        this.chatId = undefined;
        this.handle = undefined;
        this.loading = !!workspace;
        this.pending = false;
        this.error = '';
        this.draft = ''; this.context = []; this.lastContext = undefined; this.planningProposal = undefined;
        this.roadmapOffer = undefined; this.strategicDraftReview = undefined;
        this.planningProposalError = undefined; this.planningProposalErrorMessageId = undefined;

        this.turnModel = undefined; this.stream = undefined; this.transientUser = undefined;
        this.commandMode = 'ask'; this.pendingCommand = undefined; this.toolProgress = undefined;
        this.planningProgress = undefined;
        this.roadmapGenerationStage = undefined; this.roadmapGenerationProjectId = undefined;
        this.activeRoadmapOfferId = undefined;
        this.planningMode = 'follow'; this.pinnedPlanning = undefined;
        if (workspace && this.restoredPlanning?.workspace === workspace) {
            this.planningMode = 'pin'; this.pinnedPlanning = this.restoredPlanning.selection;
        }
        if (workspace) this.restoredPlanning = undefined;
        this.changed();
        await this.leave();
        this.running = false;
        await Promise.allSettled([...this.selections]);
        if (this.disposed || generation !== this.generation) return;
        this.connection?.setClient(undefined);
        if (this.connection) void Promise.resolve(this.connection.dispose()).catch(() => {});
        this.connection = undefined;
        this.workspace = workspace;
        this.eventRevision = 0;
        this.changed();
        if (!workspace) return;
        try {
            const connection = this.connect();
            this.connection = connection;
            connection.setClient({ notifyChatEvent: event => {
                if (this.disposed || generation !== this.generation || this.handle && event.projectHandle !== this.handle) return;
                if (event.kind === 'command-pending') {
                    if (event.chatId === this.chatId && this.running && this.lease) {
                        this.pendingCommand = event.preview; this.changed();
                    }
                    return;
                }
                if (event.kind === 'command-settled') {
                    if (event.chatId === this.chatId && this.pendingCommand?.id === event.id) {
                        this.pendingCommand = undefined; this.changed();
                    }
                    return;
                }
                if (event.kind === 'tool-progress') {
                    if (event.chatId !== this.chatId || !this.running) return;
                    const current = this.toolProgress?.messageId === event.messageId ? this.toolProgress.events : [];
                    const next = event.status === 'running' ?
                        [...current, { name: event.name, status: event.status, detail: event.detail, target: event.target }] :
                        [...current.slice(0, -1), { name: event.name, status: event.status,
                            truncated: event.truncated, detail: event.detail, target: event.target }];
                    this.toolProgress = { messageId: event.messageId, events: next.slice(-16) };
                    this.changed(); return;
                }
                if (event.kind === 'planning-progress') {
                    if ((this.pending || this.running) && event.chatId === this.chatId &&
                        (this.roadmapOffer?.id === event.messageId || this.activeRoadmapOfferId === event.messageId)) {
                        this.roadmapGenerationStage = event.stage;
                        this.changed();
                        return;
                    }
                    if (!this.running || event.chatId !== this.chatId ||
                        event.stage !== 'waiting' && event.stage !== 'validating' ||
                        this.planningProgress?.messageId === event.messageId && this.planningProgress.stage === event.stage) return;
                    this.planningProgress = { messageId: event.messageId, stage: event.stage };
                    this.changed();
                    return;
                }
                if (event.kind === 'assistant-delta') {
                    if (!this.running || event.chatId !== this.chatId) return;
                    const current = this.stream;
                    if (current && (current.messageId !== event.messageId || current.executionId !== event.executionId ||
                        event.sequence !== current.sequence + 1)) return;
                    if (!current && event.sequence !== 0) return;
                    this.stream = { messageId: event.messageId, executionId: event.executionId,
                        content: (current?.content ?? '') + event.delta, sequence: event.sequence,
                        activitySequence: current?.activitySequence ?? 0, events: current?.events ?? [] };
                    this.changed();
                    return;
                }
                if (event.kind === 'assistant-activity') {
                    if (!this.running || event.chatId !== this.chatId) return;
                    const current = this.stream;
                    if (current && (current.messageId !== event.messageId || current.executionId !== event.executionId ||
                        event.sequence !== current.activitySequence + 1)) return;
                    if (!current && event.sequence !== 1) return;
                    this.stream = { messageId: event.messageId, executionId: event.executionId,
                        content: current?.content ?? '', sequence: current?.sequence ?? -1,
                        activitySequence: event.sequence,
                        events: [...(current?.events ?? []), { sequence: event.sequence,
                            kind: event.activityKind, text: event.text }] };
                    this.changed(); return;
                }
                if (event.kind === 'lease-changed' && event.chatId === this.retryChatId) {
                    const chatId = this.retryChatId!;
                    // The old connection may have closed before its browser could
                    // finish a release RPC. Recheck through the normal atomic claim.
                    void this.select(chatId, true);
                }
                this.eventRevision = Math.max(this.eventRevision, event.revision);
                if (!this.pending && !this.running && this.handle && event.revision > (this.snapshot?.revision ?? -1)) void this.refresh();
            } });
            const attached = await connection.attach(workspace);
            if (this.disposed || generation !== this.generation) return;
            this.handle = attached.projectHandle;
            this.snapshot = attached.snapshot;
            this.loading = false;
            this.changed();
            if (this.eventRevision > attached.snapshot.revision) void this.refresh();
            if (this.restored) {
                const restored = this.restored;
                this.restored = undefined;
                if (restored.workspace === workspace) void this.select(restored.chatId, true);
            }
        } catch (error) {
            if (generation === this.generation && !this.disposed) {
                this.connection?.setClient(undefined);
                if (this.connection) void Promise.resolve(this.connection.dispose()).catch(() => {});
                this.connection = undefined;
                this.loading = false; this.error = String(error); this.changed();
            }
        }
    }

    restore(workspace: string, mode: ChatMode, chatId?: string): void {
        if (this.disposed) return;
        this.clearRestoreRetry();
        this.restoreAttempts = 0;
        this.restored = mode === 'chat' && chatId ? { workspace, chatId } : undefined;
        if (this.restored && this.workspace === workspace && this.handle) {
            const restored = this.restored;
            this.restored = undefined;
            void this.select(restored.chatId, true);
        }
    }

    private async leave(): Promise<void> {
        this.clearRestoreRetry();
        if (this.running || this.roadmapGenerationStage && this.pending) await this.cancel();
        if (this.renewal) clearInterval(this.renewal);
        this.renewal = undefined;
        const lease = this.lease;
        this.lease = undefined;
        if (lease) {
            const previous = this.departing;
            const departing = (async () => {
                await previous;
                try { await lease.connection.release(lease.handle, lease.chatId, lease.token); }
                catch { /* An expired or replaced token must never release its successor. */ }
                finally { this.owners.release(lease.workspace, lease.chatId, this.panelId); }
            })();
            this.departing = departing;
        }
        await this.departing;
    }

    select(chatId: string | undefined, restoring = false): Promise<boolean> {
        const selection = this.doSelect(chatId, restoring);
        this.selections.add(selection);
        void selection.finally(() => this.selections.delete(selection));
        return selection;
    }

    private async doSelect(chatId: string | undefined, restoring: boolean): Promise<boolean> {
        this.clearRestoreRetry();
        if (!restoring) this.restoreAttempts = 0;
        const selection = ++this.selection;
        const previous = [...this.selections];
        if (chatId && !this.snapshot?.chats.some(chat => chat.id === chatId)) {
            this.error = restoring ? 'Restored Chat is unavailable; select a Chat.' : 'Chat is unavailable.';
            this.changed();
            return false;
        }
        if (chatId === this.chatId && this.mode === 'chat' && this.lease) return true;
        this.chatId = undefined; this.mode = 'select-chat'; this.error = '';
        this.draft = ''; this.context = []; this.lastContext = undefined; this.planningProposal = undefined;
        this.roadmapOffer = undefined; this.strategicDraftReview = undefined;
        this.planningProposalError = undefined; this.planningProposalErrorMessageId = undefined;

        this.turnModel = undefined; this.stream = undefined; this.transientUser = undefined;
        this.commandMode = 'ask'; this.pendingCommand = undefined;
        this.planningProgress = undefined;
        this.roadmapGenerationStage = undefined; this.roadmapGenerationProjectId = undefined;
        this.activeRoadmapOfferId = undefined;
        this.changed();
        await this.leave();
        await Promise.allSettled(previous);
        if (selection !== this.selection || this.disposed || !chatId) return !chatId;
        const workspace = this.workspace, connection = this.connection, handle = this.handle;
        if (!workspace || !connection || !handle) return false;
        if (!this.owners.reserve(workspace, chatId, this.panelId, this.focus)) {
            this.error = restoring ? 'Chat already restored in another panel; select a Chat.' :
                'Chat is already open in another panel.';
            this.changed();
            return false;
        }
        try {
            const claim = await connection.claim({ projectHandle: handle, chatId, ownerId: this.panelId });
            if (selection !== this.selection || this.disposed || workspace !== this.workspace) {
                if (claim.acquired) await connection.release(handle, chatId, claim.token).catch(() => {});
                this.owners.release(workspace, chatId, this.panelId);
                return false;
            }
            if (!claim.acquired) {
                this.error = restoring ? this.restoreAttempts >= 2 ?
                    `Chat is still owned by ${claim.ownerId}; select it to retry.` :
                    `Chat is currently owned by ${claim.ownerId}; restore will retry after release or lease expiry.` :
                    `Chat is currently owned by ${claim.ownerId}.`;
                this.owners.release(workspace, chatId, this.panelId);
                if (restoring) {
                    this.retryChatId = chatId;
                    // A close event can overtake the denied claim response. One
                    // quick recheck closes that gap. One TTL retry covers a lost
                    // close signal; then wait for a release event or user selection.
                    const attempt = ++this.restoreAttempts;
                    if (attempt <= 2) {
                        const retryAfterMs = attempt === 1 ? Math.min(100, claim.retryAfterMs) : claim.retryAfterMs;
                        this.restoreRetry = setTimeout(() => {
                            this.restoreRetry = undefined;
                            this.retryChatId = undefined;
                            if (!this.disposed && selection === this.selection && this.workspace === workspace &&
                                this.handle === handle) void this.select(chatId, true);
                        }, Math.max(1, Math.min(60_000, retryAfterMs)));
                    }
                }
                this.changed();
                return false;
            }
            this.lease = { workspace, chatId, connection, handle, token: claim.token };
            this.restoreAttempts = 0;
            this.chatId = chatId; this.mode = 'chat'; this.stream = undefined; this.changed();
            this.renewal = setInterval(() => {
                if (this.lease?.token !== claim.token) return;
                void connection.renew(handle, chatId, claim.token).catch(() => {
                    if (this.lease?.token === claim.token) {
                        void this.select(undefined).then(() => {
                            if (!this.disposed && this.workspace === workspace) {
                                this.error = 'Chat ownership lease was lost; select the Chat again.';
                                this.changed();
                            }
                        });
                    }
                });
            }, 20_000);
            return true;
        } catch (error) {
            this.owners.release(workspace, chatId, this.panelId);
            if (selection === this.selection && !this.disposed) { this.error = String(error); this.changed(); }
            return false;
        }
    }

    private clearRestoreRetry(): void {
        if (this.restoreRetry) clearTimeout(this.restoreRetry);
        this.restoreRetry = undefined;
        this.retryChatId = undefined;
    }

    async refresh(retainError = false): Promise<void> {
        if (!this.connection || !this.handle || this.disposed) return;
        const generation = this.generation, request = ++this.request;
        const connection = this.connection, handle = this.handle;
        try {
            const snapshot = await connection.read(handle);
            if (this.disposed || generation !== this.generation || request !== this.request ||
                snapshot.revision < (this.snapshot?.revision ?? -1)) return;
            this.snapshot = snapshot;
            if (this.transientUser && snapshot.chats.find(chat => chat.id === this.transientUser?.chatId)?.messages.some(message =>
                message.role === 'user' && message.content === this.transientUser?.content.trim() &&
                !this.transientUser?.previousIds.has(message.id))) this.transientUser = undefined;
            if (this.stream && !snapshot.chats.find(chat => chat.id === this.chatId)?.messages.some(message =>
                message.id === this.stream?.messageId && message.role === 'assistant' &&
                message.execution.id === this.stream.executionId && message.execution.status === 'streaming'))
                this.stream = undefined;
            if (this.chatId && !snapshot.chats.some(chat => chat.id === this.chatId)) void this.select(undefined);
            if (!retainError) this.error = '';
            this.changed();
            if (this.eventRevision > snapshot.revision) void this.refresh(retainError);
        } catch (error) {
            if (!this.disposed && generation === this.generation && request === this.request) {
                this.error = String(error); this.changed();
            }
        }
    }

    async mutate(operation: ChatOperation): Promise<boolean> {
        if (!this.connection || !this.handle || !this.snapshot || this.pending || this.running || this.disposed) return false;
        const generation = this.generation, connection = this.connection, handle = this.handle;
        const request = ++this.request;
        this.pending = true;
        this.error = '';
        this.changed();
        try {
            const snapshot = await connection.mutate({ projectHandle: handle,
                expectedRevision: this.snapshot.revision, operation,
                ...('chatId' in operation && this.lease?.chatId === operation.chatId ?
                    { leaseToken: this.lease.token } : {}) });
            if (this.disposed || generation !== this.generation || request !== this.request) return false;
            this.snapshot = snapshot;
            this.pending = false;
            if (operation.type === 'create-chat') {
                const selected = await this.select(operation.id);
                if (this.eventRevision > snapshot.revision) void this.refresh();
                return selected;
            }
            this.changed();
            if (this.eventRevision > snapshot.revision) void this.refresh();
            return true;
        } catch (error) {
            if (!this.disposed && generation === this.generation && request === this.request) {
                this.pending = false; this.error = String(error); this.changed();
                void this.refresh(true);
            }
            return false;
        }
    }

    async newChat(folderPath: ChatFolderPath): Promise<boolean> {
        return this.mutate({ type: 'create-chat', id: crypto.randomUUID(), folderPath });
    }
    async deleteChat(chatId: string): Promise<boolean> {
        if (this.mode !== 'select-chat') return false;
        await this.refresh();
        if (!this.snapshot?.chats.some(chat => chat.id === chatId)) return false;
        const deleted = await this.mutate({ type: 'delete-chat', chatId });
        if (deleted) await this.refresh();
        return deleted;
    }
    async setCommandMode(mode: ChatCommandMode): Promise<void> {
        const lease = this.lease;
        if (!lease || mode !== 'ask' && mode !== 'allow') return;
        try {
            await lease.connection.setCommandMode(lease.handle, lease.chatId, lease.token, mode);
            if (lease !== this.lease) return;
            this.commandMode = mode;
            if (mode === 'ask') this.pendingCommand = undefined;
            this.error = '';
        } catch (error) { if (lease === this.lease) this.error = String(error); }
        this.changed();
    }
    async decideCommand(allowOnce: boolean): Promise<void> {
        const lease = this.lease, pending = this.pendingCommand;
        if (!lease || !pending) return;
        try {
            await lease.connection.decideCommand(lease.handle, lease.chatId, lease.token, pending.id, allowOnce);
            if (lease === this.lease && this.pendingCommand?.id === pending.id) this.pendingCommand = undefined;
        } catch (error) { if (lease === this.lease) this.error = String(error); }
        this.changed();
    }
    get activePlanning(): PlanningSelection | undefined {
        return this.planningMode === 'pin' ? this.pinnedPlanning : this.workspace ? this.planning?.current(this.workspace) : undefined;
    }
    pinPlanning(): boolean {
        const selection = this.workspace && this.planning?.current(this.workspace);
        if (!selection) { this.error = 'Select Roadmap or a Planning Map first.'; this.changed(); return false; }
        this.pinnedPlanning = selection; this.planningMode = 'pin'; this.lastContext = undefined; this.error = ''; this.changed();
        return true;
    }
    followPlanning(): void { this.planningMode = 'follow'; this.pinnedPlanning = undefined; this.lastContext = undefined; this.error = ''; this.changed(); }
    restorePlanning(mode: 'follow' | 'pin', selection?: PlanningSelection, workspace?: string): void {
        if (mode === 'pin' && selection && selection.projectId && selection.id &&
            (selection.kind === 'roadmap-checkpoint' || selection.kind === 'roadmap' || selection.kind === 'planning-map')) {
            this.planningMode = 'pin'; this.pinnedPlanning = selection;
            if (workspace && this.workspace !== workspace) this.restoredPlanning = { workspace, selection };
        } else { this.restoredPlanning = undefined; this.followPlanning(); }
        this.changed();
    }
    private async turnContext(): Promise<ChatContextSelection[]> {
        const selection = this.activePlanning;
        if (!selection || !this.planning || !this.workspace) return this.context;
        const current = await this.planning.resolve(this.workspace, selection, this.planningMode === 'pin');
        if (this.context.length >= 20) throw new Error('Too many context selections; remove one before adding the planning selection');
        // Keep the active planning identity ahead of optional attachments so a large file
        // cannot consume the budget needed for the selected, authority-bound checkpoint.
        return [current, ...this.context];
    }
    async runTurn(model?: ChatModelSelection, retryMessageId?: string,
        confirmHosted?: () => boolean, bridgeBranchIds?: string[]): Promise<boolean> {
        const lease = this.lease;
        if (!lease || this.running || this.pending || !this.chat || !retryMessageId && !this.draft.trim()) return false;
        const content = this.draft;
        const offerReply = !retryMessageId && /^yes,?\s+create the roadmap[.!]?$/i.test(content.trim());
        const keepReview = !!this.strategicDraftReview && !retryMessageId &&
            (/^roadmap[.!?]?$/i.test(content.trim()) ||
                !/\b(?:roadmap|phase|checkpoint|tower|enemy|health|currency|money|abilit(?:y|ies))\b/i.test(content));
        this.activeRoadmapOfferId = offerReply ? this.roadmapOffer?.id : undefined;
        if (this.activeRoadmapOfferId) {
            this.roadmapGenerationProjectId = this.roadmapOffer?.projectId;
            this.roadmapGenerationStage = 'checking-owner';
        }
        const generation = this.generation, chatId = this.chatId;
        let completed = false;
        this.running = true; this.runStartedAt = new Date().toISOString();
        this.error = ''; this.stream = undefined; this.planningProgress = undefined;
        this.toolProgress = undefined;
        this.planningProposal = undefined; this.planningProposalError = undefined;
        this.planningProposalErrorMessageId = undefined;
        this.roadmapOffer = undefined;
        if (!keepReview) this.strategicDraftReview = undefined;
        if (!retryMessageId && chatId) this.transientUser = { chatId, content,
            previousIds: new Set(this.chat?.messages.filter(message => message.role === 'user').map(message => message.id)) };
        if (!retryMessageId) this.draft = '';
        this.turnModel = undefined;
        this.changed();
        try {
            const context = offerReply ? [] : await this.turnContext();
            const bridgeProposal = offerReply ? undefined : bridgeBranchIds ?
                this.planning?.bridge(this.workspace!, bridgeBranchIds) : undefined;
            if (generation !== this.generation || chatId !== this.chatId || lease !== this.lease)
                throw new Error('Chat changed while resolving planning selection');
            const request = { projectHandle: lease.handle, chatId: lease.chatId, leaseToken: lease.token,
                ...(model ? { selectedModel: model } : {}), context,
                ...(bridgeProposal ? { bridgeProposal } : {}),
                ...(retryMessageId ? { retryMessageId } : { content }) };
            let result;
            try { result = await lease.connection.runTurn(request); }
            catch (error) {
                if (!model && String(error).includes('Chat hosted egress confirmation required') && confirmHosted?.())
                    result = await lease.connection.runTurn({ ...request, hostedProjectDataAuthorized: true });
                else throw error;
            }
            if (generation !== this.generation || chatId !== this.chatId || lease !== this.lease)
                throw new Error('Chat changed during the turn');
            this.lastContext = result;
            this.planningProposal = result.proposal;
            if (result.roadmapFocus && this.workspace && this.planning) {
                const focused = await this.planning.focusRoadmap(this.workspace, result.roadmapFocus);
                if (this.planningMode === 'pin') this.pinnedPlanning = focused;
            }
            this.roadmapOffer = result.roadmapOffer;
            if (result.roadmapDraftReview) { this.transientUser = undefined;
                this.strategicDraftReview = result.roadmapDraftReview; }
            this.planningProposalError = result.proposalError;
            this.planningProposalErrorMessageId = result.proposalError ? result.proposal?.messageId : undefined;
            completed = true;
            this.context = [];
            return true;
        } catch (error) {
            if (!this.disposed && generation === this.generation && chatId === this.chatId) {
                this.error = String(error);
                this.changed();
            }
            return false;
        } finally {
            if (!this.disposed && generation === this.generation && chatId === this.chatId) {
                this.running = false; this.runStartedAt = undefined;
                this.stream = undefined; this.planningProgress = undefined;
                this.pendingCommand = undefined;
                this.roadmapGenerationStage = undefined; this.activeRoadmapOfferId = undefined; this.changed();
                await this.refresh(true);
                if (!completed && this.transientUser?.chatId === chatId) {
                    if (this.error && !retryMessageId) this.draft = content;
                    this.transientUser = undefined;
                    this.changed();
                }
            }
        }
    }
    async decideRoadmapOffer(approve: boolean, selectedModel?: ChatModelSelection): Promise<void> {
        const lease = this.lease, offer = this.roadmapOffer;
        if (!lease || !offer || this.pending || this.running || offer.chatId !== lease.chatId) return;
        const generation = this.generation;
        this.pending = true; this.changed();
        try {
            if (approve) { this.activeRoadmapOfferId = offer.id; this.roadmapGenerationProjectId = offer.projectId;
                this.roadmapGenerationStage = 'checking-owner'; this.changed(); }
            const outcome = await lease.connection.decideRoadmapOffer(lease.handle, lease.chatId,
                lease.token, offer.id, offer.token, approve, selectedModel);
            if (generation !== this.generation || lease !== this.lease) return;
            if (outcome !== 'declined') this.strategicDraftReview = outcome;
        } catch (error) {
            if (generation !== this.generation || lease !== this.lease) return;
            this.error = `Roadmap offer was not accepted: ${String(error)}. Ask Chat for a revised phase plan before another offer.`;
        } finally {
            if (generation !== this.generation || lease !== this.lease) return;
            this.roadmapOffer = undefined; this.roadmapGenerationStage = undefined;
            this.pending = false; this.changed(); await this.refresh(true);
            this.activeRoadmapOfferId = undefined;
        }
    }
    async decideStrategicDraft(approve: boolean): Promise<void> {
        const lease = this.lease, review = this.strategicDraftReview;
        if (!lease || !review || this.pending || this.running) return;
        const generation = this.generation;
        this.pending = true; this.changed();
        try {
            await lease.connection.decideStrategicDraft(lease.handle, lease.chatId,
                lease.token, review.token, approve);
            if (generation !== this.generation || lease !== this.lease) return;
            this.strategicDraftReview = undefined;
        } catch (error) { if (generation !== this.generation || lease !== this.lease) return;
            this.error = `Strategic draft was not accepted: ${String(error)}`;
            this.strategicDraftReview = undefined;
        } finally { if (generation === this.generation && lease === this.lease) {
            try { await this.refresh(true); }
            finally { this.pending = false; this.changed(); }
        } }
    }
    async decidePlanningProposal(approve: boolean): Promise<void> {
        const lease = this.lease, proposal = this.planningProposal;
        if (!lease || !proposal || this.pending || this.running || proposal.chatId !== lease.chatId) return;
        this.pending = true; this.changed();
        this.planningProposalErrorMessageId = proposal.messageId;
        try {
            const result = await lease.connection.decidePlanningProposal(lease.handle, lease.chatId,
                lease.token, proposal.id, approve);
            this.planningProposal = undefined;
            this.planningProposalError = approve && result ?
                `${isDraftPlanningAction(proposal.action.type) ? 'Accepted Roadmap draft' : 'Roadmap'} ` +
                `updated at revision ${result.revision}: ${result.changedIds.join(', ')}` : 'Planning proposal rejected';
        } catch (error) {
            this.planningProposal = undefined;
            this.planningProposalError = `Planning proposal was not applied: ${String(error)}. Refresh the selection for the next turn.`;
        } finally { this.pending = false; this.changed(); await this.refresh(true); }
    }
    addContext(selection: ChatContextSelection): void {
        if (this.context.length >= 20) throw new Error('Too many context selections');
        this.context.push(selection); this.lastContext = undefined; this.changed();
    }
    removeContext(index: number): void { this.context.splice(index, 1); this.lastContext = undefined; this.changed(); }
    clearContext(): void { this.context = []; this.lastContext = undefined; this.changed(); }
    async previewContext(model: ChatModelSelection): Promise<void> {
        const lease = this.lease;
        if (!lease) throw new Error('Chat unavailable');
        const generation = this.generation, chatId = this.chatId, planningGeneration = this.planningGeneration;
        const context = await this.turnContext();
        if (generation !== this.generation || chatId !== this.chatId || lease !== this.lease)
            throw new Error('Chat changed while resolving planning selection');
        const preview = await lease.connection.previewContext({ projectHandle: lease.handle, chatId: lease.chatId,
            selectedModel: model, content: this.draft, context });
        if (generation === this.generation && chatId === this.chatId && lease === this.lease &&
            planningGeneration === this.planningGeneration) {
            this.lastContext = preview; this.changed();
        }
    }
    async searchSaved(query: string): Promise<ChatSearchHit[]> {
        const lease = this.lease;
        if (!lease || !this.chat?.settings.context.savedChatSearch) throw new Error('Saved Chat search disabled');
        return lease.connection.search({ projectHandle: lease.handle, query, limit: 10, excludeChatId: lease.chatId });
    }
    async cancel(): Promise<void> {
        const lease = this.lease;
        if (lease && (this.running || this.roadmapGenerationStage && this.pending))
            await lease.connection.cancelTurn(lease.handle, lease.chatId, lease.token).catch(() => {});
    }
    async newFolder(parent: ChatFolderPath, name: string): Promise<boolean> {
        try { return this.mutate({ type: 'create-folder', path: joinChatFolderPath(parent, name) }); }
        catch (error) { this.error = String(error); this.changed(); return false; }
    }
    dispose(): void {
        this.clearRestoreRetry();
        if (this.disposed) return;
        this.disposed = true;
        this.planningListener?.dispose();
        ++this.generation; ++this.request;
        ++this.selection;
        const connection = this.connection;
        void (async () => { await this.leave(); await Promise.allSettled([...this.selections]); })().finally(() => {
            connection?.setClient(undefined);
            if (connection) void Promise.resolve(connection.dispose()).catch(() => {});
        });
        this.connection = undefined;
    }
}
