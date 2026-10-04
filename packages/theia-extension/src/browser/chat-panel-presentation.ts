export const CHAT_PANEL_ID = 'dope-chat-panel';
export const chatAreas = { left: 'left', right: 'right', center: 'main', bottom: 'bottom' } as const;
export type ChatArea = keyof typeof chatAreas;
export interface ChatPanelOptions { instanceId: string }
export const chatLauncherOptions = {
    left: { instanceId: '00000000-0000-4000-8000-000000000001' },
    right: { instanceId: '00000000-0000-4000-8000-000000000002' },
} as const;
export const chatLauncherIds = {
    left: `${CHAT_PANEL_ID}:${chatLauncherOptions.left.instanceId}`,
    right: `${CHAT_PANEL_ID}:${chatLauncherOptions.right.instanceId}`,
} as const;
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
    private startTop = 0;
    dragging = false;
    start(y: number, top: number): void { this.startY = y; this.startTop = top; this.dragging = false; }
    move(y: number): number | undefined {
        if (!this.dragging && Math.abs(y - this.startY) < 5) return undefined;
        this.dragging = true;
        return this.startTop + this.startY - y;
    }
    end(): boolean { const dragged = this.dragging; this.dragging = false; return dragged; }
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
export function chatPanelOptions(): ChatPanelOptions { return { instanceId: crypto.randomUUID() }; }
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
    create: (options: ChatPanelOptions) => Promise<W>, shell: ChatPanelShell<W>): Promise<W> {
    const widget = await create(chatPanelOptions());
    await shell.addWidget(widget, { area: chatAreas[area] });
    await shell.activateWidget(widget.id);
    return widget;
}
