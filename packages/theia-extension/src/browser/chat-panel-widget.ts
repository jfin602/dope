import { BaseWidget } from '@theia/core/lib/browser/widgets/widget';
import { SingleTextInputDialog } from '@theia/core/lib/browser/dialogs';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import type { ChatOperation } from '@dope/chat/lib/service';
import { ChatPanelController, chatTree } from './chat-panel-controller';
import type { ChatConnection, ChatTree } from './chat-panel-controller';
import { chatPanelWidgetId, type ChatPanelOptions } from './chat-panel-presentation';

export class ChatPanelWidget extends BaseWidget {
    readonly controller: ChatPanelController;
    private readonly rootsListener;
    private readonly status = document.createElement('p');
    private readonly content = document.createElement('div');
    private workspaceRequest = 0;

    constructor(connect: () => ChatConnection, private readonly workspaces: WorkspaceService, options: ChatPanelOptions) {
        super();
        this.id = chatPanelWidgetId(options);
        this.title.label = this.title.caption = 'Chat';
        this.title.closable = true;
        this.addClass('dope-chat-panel');
        this.controller = new ChatPanelController(connect, () => this.render());
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.node.append(this.status, this.content);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.attach(); });
        void this.attach();
    }

    private async attach(): Promise<void> {
        const request = ++this.workspaceRequest;
        // Invalidate the old project immediately while workspace roots resolve.
        await this.controller.attach(undefined);
        const roots = await this.workspaces.roots;
        if (this.isDisposed || request !== this.workspaceRequest) return;
        await this.controller.attach(roots.length === 1 ? roots[0].resource.toString() : undefined);
    }

    private button(label: string, action: () => void, disabled = false): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.onclick = action;
        return button;
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
    private renderTree(node: ChatTree): HTMLElement {
        const list = document.createElement('ul');
        for (const folder of node.folders) {
            const item = document.createElement('li');
            const details = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = folder.path.slice(folder.path.lastIndexOf('/') + 1);
            details.append(summary);
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
            details.append(actions, this.renderTree(folder));
            item.append(details);
            list.append(item);
        }
        for (const chat of node.chats) {
            const item = document.createElement('li');
            const row = document.createElement('div');
            row.className = 'dope-chat-row';
            const select = this.button(chat.title, () => this.controller.select(chat.id));
            select.className = 'dope-chat-select';
            select.title = `Last interaction ${chat.lastInteractedAt}`;
            const time = document.createElement('time');
            time.dateTime = chat.lastInteractedAt;
            time.title = `Created ${chat.createdAt}; last interaction ${chat.lastInteractedAt}`;
            time.textContent = new Date(chat.lastInteractedAt).toLocaleDateString();
            const rename = this.button('Rename', () => void this.name('Rename Chat', chat.title).then(title => {
                if (title) this.mutate({ type: 'rename-chat', chatId: chat.id, title });
            }));
            const move = this.button('Move', () => void this.folderChoice('Move Chat', chat.folderPath).then(folderPath => {
                if (folderPath !== undefined) this.mutate({ type: 'move-chat', chatId: chat.id, folderPath });
            }));
            row.append(select, time, rename, move);
            item.append(row);
            list.append(item);
        }
        return list;
    }
    private render(): void {
        const state = this.controller;
        this.status.textContent = state.error || (state.loading ? 'Loading Chats…' : !state.workspace ? 'Open one project to use Chats.' : '');
        this.content.replaceChildren();
        if (!state.snapshot) {
            if (state.error && state.workspace) this.content.append(this.button('Retry', () => void this.attach()));
            return;
        }
        if (state.mode === 'select-chat') {
            const header = document.createElement('header');
            const heading = document.createElement('h2');
            heading.textContent = 'Select Chat';
            header.append(heading,
                this.button('New Chat', () => void state.newChat(''), state.pending),
                this.button('New Folder', () => void this.name('New folder').then(name => {
                    if (name) void state.newFolder('', name);
                }), state.pending));
            this.content.append(header, this.renderTree(chatTree(state.snapshot)));
            return;
        }
        const chat = state.chat;
        if (!chat) { state.select(undefined); return; }
        const header = document.createElement('header');
        const back = this.button('Back / Chats', () => state.select(undefined));
        const heading = document.createElement('h2');
        heading.textContent = chat.title;
        const settings = this.button('⚙', () => {}, true);
        settings.className = 'dope-chat-settings';
        settings.setAttribute('aria-label', 'Chat settings (available in P9)');
        header.append(back, heading, settings);
        const transcript = document.createElement('ol');
        transcript.className = 'dope-chat-transcript';
        for (const message of chat.messages) {
            const item = document.createElement('li');
            const who = document.createElement('strong');
            who.textContent = message.role === 'user' ? 'You' : 'Assistant';
            const content = document.createElement('p');
            content.textContent = message.content || (message.role === 'assistant' ? `(${message.execution.status})` : '');
            const time = document.createElement('time');
            time.dateTime = message.createdAt;
            time.textContent = new Date(message.createdAt).toLocaleString();
            item.append(who, time, content);
            transcript.append(item);
        }
        this.content.append(header, transcript);
    }
    override dispose(): void {
        ++this.workspaceRequest;
        this.rootsListener.dispose();
        this.controller.dispose();
        super.dispose();
    }
}
