import { BaseWidget } from '@theia/core/lib/browser/widgets/widget';
import { ApplicationShell, type StatefulWidget } from '@theia/core/lib/browser';
import { SingleTextInputDialog } from '@theia/core/lib/browser/dialogs';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import type { ChatOperation } from '@dope/chat/lib/service';
import type { ChatSettings, ChatContextKind, ChatModelSelection } from '@dope/chat';
import type { ChatContextSelection } from '@dope/chat/lib/service';
import { SoftwareMapController } from './software-map-controller';
import type { ModelConnectionsService, ModelConnectionsSnapshot } from '@dope/contracts/lib/model-connections-service';
import { ChatOpenOwners, ChatPanelController, chatTree, readOnlyPrompt } from './chat-panel-controller';
import type { ChatConnection, ChatTree } from './chat-panel-controller';
import { chatPanelWidgetId, type ChatPanelOptions } from './chat-panel-presentation';

class SecretInputDialog extends SingleTextInputDialog {
    constructor(title: string) {
        super({ title, confirmButtonLabel: 'Connect' });
        this.inputField.type = 'password';
        this.inputField.autocomplete = 'off';
    }
}

export class ChatPanelWidget extends BaseWidget implements StatefulWidget {
    readonly controller: ChatPanelController;
    private readonly rootsListener;
    private readonly status = document.createElement('p');
    private readonly content = document.createElement('div');
    private workspaceRequest = 0;
    private models: ModelConnectionsSnapshot = { connections: [] };
    private settingsOpen = false;
    private settingsDraft?: ChatSettings;
    private settingsChatId?: string;

    constructor(connect: () => ChatConnection, private readonly workspaces: WorkspaceService,
        private readonly shell: ApplicationShell, owners: ChatOpenOwners, options: ChatPanelOptions,
        private readonly modelConnections?: ModelConnectionsService,
        private readonly editors?: EditorManager, private readonly map?: SoftwareMapController) {
        super();
        this.id = chatPanelWidgetId(options);
        this.title.label = this.title.caption = 'Chat';
        this.title.closable = true;
        this.addClass('dope-chat-panel');
        this.controller = new ChatPanelController(connect, () => this.render(), owners, this.id,
            () => { void this.shell.activateWidget(this.id); });
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.node.append(this.status, this.content);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.attach(); });
        void this.attach();
        void this.loadModels();
    }

    storeState(): object {
        return { version: 1, area: this.shell.getAreaFor(this), workspace: this.controller.workspace,
            mode: this.controller.mode, chatId: this.controller.chatId };
    }
    restoreState(state: object): void {
        const value = state as Record<string, unknown>;
        if (value?.version === 1 && typeof value.workspace === 'string' &&
            (value.mode === 'select-chat' || value.mode === 'chat') &&
            (value.mode === 'select-chat' || typeof value.chatId === 'string'))
            this.controller.restore(value.workspace, value.mode, value.chatId as string | undefined);
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
    private async secret(title: string): Promise<string | undefined> {
        return (await new SecretInputDialog(title).open())?.trim() || undefined;
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
        try { this.models = await this.modelConnections.list(); this.render(); }
        catch (error) { this.status.textContent = String(error); }
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
        const preferred = state.turnModel ?? state.chat?.settings.defaultModel;
        return preferred ? usable.find(model => this.sameModel(model.selection, preferred))?.selection : usable[0]?.selection;
    }
    private async setupModels(): Promise<void> {
        if (!this.modelConnections) return;
        const providerId = (await this.name('Model provider: local, gemini or openai', 'local'))?.toLowerCase();
        if (!providerId) return;
        if (!['local', 'gemini', 'openai'].includes(providerId)) { this.status.textContent = 'Choose local, gemini or openai.'; return; }
        const label = await this.name('Connection name', providerId);
        if (!label) return;
        const modelId = providerId === 'openai' ? await this.name('OpenAI model ID') : undefined;
        if (providerId === 'openai' && !modelId) return;
        const id = crypto.randomUUID();
        try {
            await this.modelConnections.upsert({ id, providerId, label, ...(modelId ? { preferredModelId: modelId } : {}) });
            if (providerId !== 'local') {
                const credential = await this.secret(`${providerId} session API key`);
                if (!credential) return;
                await this.modelConnections.setSessionCredential(id, credential);
            }
            this.models = await this.modelConnections.activate(id);
            this.render();
        } catch (error) { this.status.textContent = String(error); void this.loadModels(); }
    }
    private async reconnect(connectionId: string): Promise<void> {
        const connection = this.models.connections.find(item => item.id === connectionId);
        if (!connection || !this.modelConnections) return;
        try {
            if (connection.providerId !== 'local') {
                const credential = await this.secret(`${connection.label} session API key`);
                if (!credential) return;
                await this.modelConnections.setSessionCredential(connectionId, credential);
            }
            this.models = await this.modelConnections.activate(connectionId);
            this.render();
        } catch (error) { this.status.textContent = String(error); }
    }
    private renderSettings(chatId: string): HTMLElement {
        const form = document.createElement('section');
        form.className = 'dope-chat-settings-form';
        form.setAttribute('aria-label', 'Chat settings');
        const draft = this.settingsDraft!;
        const field = (label: string, input: HTMLElement) => {
            const row = document.createElement('label'); row.textContent = label; row.append(input); form.append(row);
        };
        const model = document.createElement('select');
        model.append(new Option('No default model', ''));
        for (const entry of this.usableModels()) model.append(new Option(entry.label,
            JSON.stringify(entry.selection)));
        model.value = draft.defaultModel ? JSON.stringify(draft.defaultModel) : '';
        model.onchange = () => { draft.defaultModel = model.value ? JSON.parse(model.value) as ChatModelSelection : undefined;
            draft.reasoningControls = undefined; this.render(); };
        field('Default model', model);
        const active = this.usableModels().find(entry => this.sameModel(entry.selection, draft.defaultModel));
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
            this.settingsOpen = false; this.settingsDraft = undefined; this.settingsChatId = undefined;
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
        if (this.settingsChatId !== chat.id) {
            this.settingsOpen = false; this.settingsDraft = undefined; this.settingsChatId = chat.id;
        }
        const header = document.createElement('header');
        const back = this.button('Back / Chats', () => state.select(undefined));
        const heading = document.createElement('h2');
        heading.textContent = chat.title;
        const settings = this.button('⚙', () => {
            this.settingsOpen = !this.settingsOpen;
            this.settingsDraft = this.settingsOpen ? structuredClone(chat.settings) : undefined;
            this.settingsChatId = chat.id;
            this.render();
        });
        settings.className = 'dope-chat-settings';
        settings.setAttribute('aria-label', 'Chat settings');
        header.append(back, heading, settings);
        const transcript = document.createElement('ol');
        transcript.className = 'dope-chat-transcript';
        for (const message of chat.messages) {
            const item = document.createElement('li');
            const who = document.createElement('strong');
            who.textContent = message.role === 'user' ? 'You' : 'Assistant';
            const content = document.createElement('p');
            content.textContent = message.content || (message.role === 'assistant' && state.stream?.messageId === message.id ?
                state.stream.content : '');
            const time = document.createElement('time');
            time.dateTime = message.createdAt;
            time.textContent = new Date(message.createdAt).toLocaleString();
            item.append(who, time, content);
            if (message.role === 'assistant') {
                const status = document.createElement('small');
                status.textContent = ` ${message.execution.status}${message.execution.failure ? ` · ${message.execution.failure}` : ''}`;
                item.append(status);
                if (message.execution.actualModel) {
                    const provenance = document.createElement('small');
                    provenance.className = 'dope-chat-provenance';
                    provenance.textContent = ` ${message.execution.actualModel.providerId} · ${message.execution.actualModel.modelLabel}`;
                    item.append(provenance);
                }
            }
            transcript.append(item);
        }
        this.content.append(header);
        if (this.settingsOpen) this.content.append(this.renderSettings(chat.id));
        this.content.append(transcript);
        const composer = document.createElement('div'); composer.className = 'dope-chat-composer';
        const input = document.createElement('textarea'); input.rows = 3; input.placeholder = 'Message';
        input.setAttribute('aria-label', 'Message'); input.value = state.draft;
        input.oninput = () => { state.draft = input.value; };
        const toolbar = document.createElement('div'); toolbar.className = 'dope-chat-composer-toolbar';
        const sources = document.createElement('select');
        sources.setAttribute('aria-label', 'Context source');
        for (const kind of chat.settings.context.allowedSources)
            sources.append(new Option(kind.replace(/-/g, ' '), kind));
        toolbar.append(sources, this.button('Add context', () => void this.addContext(sources.value as ChatContextKind),
            !sources.options.length));
        for (const kind of ['Ask', 'Explain', 'Trace', 'Find Related'] as const)
            toolbar.append(this.button(kind, () => this.behavior(kind)));
        if (state.context.length) toolbar.append(this.button('Clear context', () => state.clearContext()));
        const modelSelector = document.createElement('select'); modelSelector.setAttribute('aria-label', 'Model for next turn');
        const usable = this.usableModels();
        for (const entry of usable) modelSelector.append(new Option(entry.label, JSON.stringify(entry.selection)));
        const selected = this.selectedModel();
        if (selected) modelSelector.value = JSON.stringify(selected);
        else modelSelector.append(new Option(chat.settings.defaultModel ? 'Default model unavailable' : 'No usable model', '', true, true));
        modelSelector.onchange = () => {
            state.turnModel = JSON.parse(modelSelector.value) as ChatModelSelection;
            this.render();
        };
        toolbar.append(modelSelector);
        if (selected && state.context.length) toolbar.append(this.button('Preview context', () => {
            void state.previewContext(selected).catch(error => { this.status.textContent = String(error); });
        }));
        if (!selected) {
            toolbar.append(this.button('Set up models', () => void this.setupModels()));
            for (const connection of this.models.connections.filter(item => !item.ready))
                toolbar.append(this.button(`Connect ${connection.label}`, () => void this.reconnect(connection.id)));
        }
        toolbar.append(this.button('Refresh models', () => void this.loadModels()));
        if (state.running) toolbar.append(this.button('Cancel', () => void state.cancel()));
        else {
            const retry = [...chat.messages].reverse().find(message => message.role === 'assistant' &&
                ['failed', 'cancelled'].includes(message.execution.status));
            if (retry) toolbar.append(this.button('Retry', () => { if (selected) void state.runTurn(selected, retry.id); }, !selected));
            toolbar.append(this.button('Send', () => { if (selected) void state.runTurn(selected); }, !selected || state.pending));
        }
        composer.append(input, toolbar);
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
            const details = document.createElement('small');
            details.textContent = `Context ${state.lastContext.usedTokens}/${state.lastContext.budgetTokens} estimated tokens; ` +
                `${state.lastContext.refs.length} sources included. ` + state.lastContext.diagnostics.map(item =>
                    `${item.source}: ${item.message}`).join(' ');
            composer.append(details);
            const included = document.createElement('ul');
            included.setAttribute('aria-label', 'Included context preview');
            for (const ref of state.lastContext.refs) {
                const item = document.createElement('li');
                item.textContent = `${ref.kind}: ${ref.label} (${ref.estimatedTokens} estimated tokens)`;
                included.append(item);
            }
            composer.append(included);
        }
        this.content.append(composer);
    }
    override dispose(): void {
        ++this.workspaceRequest;
        this.rootsListener.dispose();
        this.controller.dispose();
        super.dispose();
    }
}
