export const CHAT_PANEL_ID = 'dope-chat-panel';
export const chatAreas = { left: 'left', right: 'right', center: 'main', bottom: 'bottom' } as const;
export type ChatArea = keyof typeof chatAreas;
export interface ChatPanelOptions { instanceId: string }
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
