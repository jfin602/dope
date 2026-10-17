import type { ChatAssistantMessage } from '@dope/chat';

/** Only the backend's persisted activity marker can select compact machine presentation. */
export function planningActivityPresentation(message: ChatAssistantMessage): { label: string; status: string; alert: boolean } | undefined {
    const activity = message.planningActivity;
    if (!activity || !['roadmap-intent', 'roadmap-proposal', 'roadmap-draft-proposal', 'no-action'].includes(activity.kind))
        return undefined;
    const label = activity.kind === 'no-action' ? 'No planning action' :
        activity.kind === 'roadmap-draft-proposal' ? 'Planning draft' :
        activity.kind === 'roadmap-proposal' ? 'Roadmap proposal' : 'Roadmap intent';
    const statuses: Record<typeof activity.status, string> = {
        pending: 'Pending · no write',
        'no-action': 'No change',
        rejected: 'Rejected · no change',
        denied: 'Denied · no change',
        stale: 'Stale · no change',
        applied: 'Applied',
        failed: 'Failed',
        cancelled: 'Cancelled',
    };
    return { label, status: statuses[activity.status],
        alert: ['rejected', 'denied', 'stale', 'failed', 'cancelled'].includes(activity.status) };
}

/** A saved backend activity marker, completed turn, and intact strict payload are all required. */
function validatedNoActionMessage(message: ChatAssistantMessage): string | undefined {
    if (message.execution.status !== 'complete' || message.planningActivity?.kind !== 'no-action' ||
        message.planningActivity.status !== 'no-action') return undefined;
    try {
        const raw: unknown = JSON.parse(message.content);
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
        const value = raw as Record<string, unknown>;
        if (Object.keys(value).sort().join(',') !== 'message,type' || value.type !== 'no-action' ||
            typeof value.message !== 'string' || !value.message.trim() || value.message.length > 1000) return undefined;
        const reply = value.message.trim();
        // The backend validates the no-action shape, not the truth of model prose.
        // Keep contradictory write claims in the inspectable raw JSON, never as the main reply.
        if (/\b(?:I|we)\s+(?:have\s+)?(?:applied|committed|saved|wrote|updated|changed|deleted|created)\b/i.test(reply) ||
            /\b(?:was|were|has been|have been)\s+(?:applied|committed|saved|written|updated|changed|deleted|created)\b/i.test(reply))
            return undefined;
        return reply;
    } catch { return undefined; }
}

/** Explain only the backend-verified activity; raw model text is never an authority signal. */
export function planningOutcome(message: ChatAssistantMessage): { summary: string; questions: string[] } | undefined {
    const activity = message.planningActivity;
    if (!activity) return undefined;
    const ref = activity.refs.find(item => item.kind === 'roadmap-checkpoint');
    const target = ref ? `checkpoint ${ref.label}` : activity.kind === 'roadmap-draft-proposal' ? 'Roadmap draft' : 'Roadmap';
    let change = `change ${target}`;
    // This detail is only displayed alongside a backend-verified preview or confirmed apply.
    if (activity.status === 'pending' || activity.status === 'applied') {
        try {
            const raw: unknown = JSON.parse(message.content);
            if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
                const value = raw as Record<string, unknown>;
                const action = value.action && typeof value.action === 'object' && !Array.isArray(value.action) ?
                    value.action as Record<string, unknown> : undefined;
                const objective = activity.kind === 'roadmap-intent' ? value.value : action?.objective;
                const normalized = typeof objective === 'string' ? objective.replace(/\s+/g, ' ') : undefined;
                const short = normalized?.slice(0, 120);
                if (activity.kind === 'roadmap-draft-proposal' && action?.type === 'create-phase')
                    change = 'create a phase in Roadmap draft';
                else if (activity.kind === 'roadmap-draft-proposal' && action?.type === 'create-checkpoint')
                    change = 'create a checkpoint in Roadmap draft';
                else if (short) change = `set the objective of ${target} to “${short}${(normalized?.length ?? 0) > 120 ? '…' : ''}”`;
                else if (action && typeof action.type === 'string' &&
                    ['create', 'edit', 'reorder', 'create-phase', 'create-checkpoint', 'edit-phase',
                        'edit-checkpoint', 'reorder-phase', 'reorder-checkpoint'].includes(action.type))
                    change = action.type === 'create' ? `create a Roadmap item near ${target}` :
                        action.type === 'edit' || action.type === 'reorder' ? `${action.type} ${target}` :
                            `${action.type.replace(/-/g, ' ')} in ${target}`;
            }
        } catch { /* A damaged saved payload never grants authority or breaks the transcript. */ }
    }
    const revision = activity.appliedRevision;
    if (activity.status === 'applied' && revision !== undefined) return {
        summary: `The approved proposal to ${change} was saved at revision ${revision}.`,
        questions: ['Does the saved result match your current objective?', 'Would you like to review the linked source or next checkpoint?'],
    };
    if (activity.status === 'pending') return {
        summary: `A proposal to ${change} was previewed and is awaiting approval; no write yet.`,
        questions: ['Does the proposed change match your intent?', 'Should you review the affected source before deciding?'],
    };
    if (activity.status === 'no-action') return {
        summary: validatedNoActionMessage(message) ?? `The local planning turn proposed no change to ${target}. Nothing was written.`,
        questions: [],
    };
    if (activity.status === 'denied') return {
        summary: `You rejected the proposed change to ${target}. Nothing was written by that proposal.`,
        questions: ['What would you change about the proposal?'],
    };
    if (activity.status === 'stale') return {
        summary: `The proposal for ${target} became stale and was not applied.`,
        questions: ['Would you like to compare it with the current Roadmap before trying again?'],
    };
    if (activity.status === 'rejected') return {
        summary: `The proposed change to ${target} did not pass planning validation and was not applied.`,
        questions: ['Would reviewing the eligible field or current source help refine the request?'],
    };
    if (activity.status === 'cancelled') return {
        summary: `The local planning turn was cancelled. No proposal from this turn was applied.`,
        questions: ['Would you like to review the current checkpoint before retrying?'],
    };
    return {
        summary: `The local planning turn failed before an approved change could be applied.`,
        questions: ['Would you like to check the error and current source before retrying?'],
    };
}

export const CHAT_PANEL_ID = 'dope-chat-panel';
export const chatAreas = { left: 'left', right: 'right', center: 'main', bottom: 'bottom' } as const;
export type ChatArea = keyof typeof chatAreas;
export interface ChatPanelOptions { instanceId: string; module?: 'chat' | 'work' }
export function resolveChatModel<T extends { selection: { connectionId: string; modelId: string } }>(
    usable: readonly T[], override?: T['selection'], defaultModel?: T['selection']): T['selection'] | undefined {
    const requested = override ?? defaultModel;
    return requested ? usable.find(entry => entry.selection.connectionId === requested.connectionId &&
        entry.selection.modelId === requested.modelId)?.selection : undefined;
}
export const chatLauncherOptions = {
    left: { instanceId: '00000000-0000-4000-8000-000000000001' },
    right: { instanceId: '00000000-0000-4000-8000-000000000002' },
} as const;
export const chatLauncherIds = {
    left: `${CHAT_PANEL_ID}:${chatLauncherOptions.left.instanceId}`,
    right: `${CHAT_PANEL_ID}:${chatLauncherOptions.right.instanceId}`,
} as const;
export const workLauncherOptions = {
    left: { instanceId: '00000000-0000-4000-8000-000000000003', module: 'work' },
    right: { instanceId: '00000000-0000-4000-8000-000000000004', module: 'work' },
} as const;
export const workLauncherIds = {
    left: `${CHAT_PANEL_ID}:${workLauncherOptions.left.instanceId}`,
    right: `${CHAT_PANEL_ID}:${workLauncherOptions.right.instanceId}`,
} as const;
/** Old combined-panel widgets have no module option; their saved mode selects the restored module. */
export function panelModule(options: ChatPanelOptions, saved?: { panelMode: 'chat' | 'work' }): 'chat' | 'work' {
    if (options.instanceId === workLauncherOptions.left.instanceId ||
        options.instanceId === workLauncherOptions.right.instanceId) return 'work';
    if (options.instanceId === chatLauncherOptions.left.instanceId ||
        options.instanceId === chatLauncherOptions.right.instanceId) return 'chat';
    return options.module ?? saved?.panelMode ?? 'chat';
}
export function shouldSendChatInput(event: Pick<KeyboardEvent, 'key' | 'shiftKey' | 'isComposing' | 'keyCode'>): boolean {
    return event.key === 'Enter' && !event.shiftKey && !event.isComposing && event.keyCode !== 229;
}
export function resizeChatInput(input: HTMLTextAreaElement): void {
    input.style.height = 'auto';
    input.style.height = `${input.scrollHeight}px`;
}
/** Presentation-only follow state; a new Chat starts at the latest turn. */
export class ChatScrollFollow {
    private chatId?: string;
    following = true;
    latestBelow = false;
    select(chatId?: string): void {
        if (this.chatId === chatId) return;
        this.chatId = chatId;
        this.following = true;
        this.latestBelow = false;
    }
    scrolled(top: number, height: number, viewport: number): void {
        this.following = height - top - viewport < 64;
        this.latestBelow = !this.following;
    }
    restore(previousTop: number, height: number, viewport: number): number {
        const top = this.following ? height : previousTop;
        this.latestBelow = !this.following && height - top - viewport >= 64;
        return top;
    }
    jump(): void { this.following = true; this.latestBelow = false; }
}
/** Pointer drag state is independent of the DOM rerenders caused by streamed tokens. */
export class ChatTranscriptDrag {
    private startY = 0;
    private startX = 0;
    private startTop = 0;
    dragging = false;
    start(y: number, top: number, x = 0): void { this.startY = y; this.startX = x; this.startTop = top; this.dragging = false; }
    move(y: number, x = 0, touch = false): number | undefined {
        if (touch && !this.dragging && Math.abs(x - this.startX) > Math.abs(y - this.startY)) return undefined;
        if (!this.dragging && Math.abs(y - this.startY) < 5) return undefined;
        this.dragging = true;
        return this.startTop + this.startY - y;
    }
    end(): boolean { const dragged = this.dragging; this.dragging = false; return dragged; }
}
export function canDragChatTranscript(target: Element): boolean {
    return !target.closest('button, [role="button"], input, textarea, select, [contenteditable]');
}
export function animateChatToLatest(element: HTMLElement, reducedMotion: boolean,
    schedule: typeof requestAnimationFrame = requestAnimationFrame, duration = 200): () => void {
    const target = () => Math.max(0, element.scrollHeight - element.clientHeight);
    if (reducedMotion || duration <= 0) { element.scrollTop = target(); return () => {}; }
    let cancelled = false;
    let started: number | undefined;
    const from = element.scrollTop;
    const frame = (now: number) => {
        if (cancelled) return;
        started ??= now;
        const fraction = Math.min(1, (now - started) / duration);
        element.scrollTop = from + (target() - from) * (1 - (1 - fraction) ** 3);
        if (fraction < 1) schedule(frame);
        else element.scrollTop = target();
    };
    schedule(frame);
    return () => { cancelled = true; };
}
export function safeChatLink(href: string, base: string): boolean {
    try { return ['http:', 'https:', 'mailto:'].includes(new URL(href, base).protocol); }
    catch { return false; }
}
export function chatPanelOptions(module: 'chat' | 'work' = 'chat'): ChatPanelOptions {
    return { instanceId: crypto.randomUUID(), module };
}
export function chatPanelWidgetId(options: ChatPanelOptions): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(options?.instanceId))
        throw new Error('Invalid ChatPanel instance');
    return `${CHAT_PANEL_ID}:${options.instanceId}`;
}
export interface ChatPanelShell<W extends { id: string }> {
    addWidget(widget: W, options: { area: typeof chatAreas[ChatArea] }): Promise<void>;
    activateWidget(id: string): Promise<unknown>;
}
export async function openChatPanel<W extends { id: string }>(area: ChatArea,
    create: (options: ChatPanelOptions) => Promise<W>, shell: ChatPanelShell<W>, module: 'chat' | 'work' = 'chat'): Promise<W> {
    const widget = await create(chatPanelOptions(module));
    await shell.addWidget(widget, { area: chatAreas[area] });
    await shell.activateWidget(widget.id);
    return widget;
}
