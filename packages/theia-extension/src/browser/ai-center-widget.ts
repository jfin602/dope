import { BaseWidget, codicon, Message } from '@theia/core/lib/browser/widgets/widget';
import { AI_REGISTRY_VERSION } from '@dope/ai';
import type { AIConnection, AIConnectionConfig } from '@dope/ai';
import type { AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import type { AICredentialService } from '@dope/contracts/lib/ai-credential-service';
import { AICenterController, connectionHealth, usableModelSummary } from './ai-center-controller';

export const AI_CENTER_ID = 'dope-ai-center';

function element<Tag extends keyof HTMLElementTagNameMap>(tag: Tag, text?: string, className?: string): HTMLElementTagNameMap[Tag] {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

function button(label: string, action: () => void, disabled = false): HTMLButtonElement {
    const node = element('button', label);
    node.type = 'button'; node.disabled = disabled; node.addEventListener('click', action);
    return node;
}

function field(form: HTMLElement, label: string, name: string, value = '', secret = false): HTMLInputElement {
    const wrapper = element('label', label);
    const input = element('input');
    input.name = name; input.value = value; input.type = secret ? 'password' : 'text';
    if (secret) input.autocomplete = 'new-password';
    wrapper.append(input); form.append(wrapper);
    return input;
}

function value(form: HTMLFormElement, name: string): string {
    return (form.elements.namedItem(name) as HTMLInputElement).value.trim();
}

function safeEndpoint(endpoint: string): string {
    try {
        const url = new URL(endpoint);
        return `${url.origin}${['/', '/v1', '/v1/'].includes(url.pathname) ? url.pathname : '/[custom path]'}`;
    } catch { return 'Invalid endpoint'; }
}

export class AICenterWidget extends BaseWidget {
    readonly controller: AICenterController;
    private readonly content = element('div');
    private editing = false;
    private modelsOpen = false;
    private returnToChat?: () => void;
    private returnLabel = 'Return to Chat';

    constructor(registry: AIRegistryService, credentials: AICredentialService) {
        super();
        this.id = AI_CENTER_ID;
        this.title.label = this.title.caption = 'AI Center';
        this.title.iconClass = codicon('sparkle');
        this.title.closable = true;
        this.node.tabIndex = -1;
        this.addClass('dope-ai-center');
        this.controller = new AICenterController(registry, credentials, () => this.render());
        this.node.append(this.content);
        void this.controller.load();
    }

    refresh(): void { void this.controller.load(); }

    setReturnToChat(action?: () => void, label = 'Return to Chat'): void { this.returnToChat = action; this.returnLabel = label; this.render(); }

    private select(id?: string): void {
        this.editing = false; this.modelsOpen = false;
        void this.controller.select(id);
    }

    private render(): void {
        const controller = this.controller;
        this.content.replaceChildren();
        const title = element('h2', 'AI Center');
        const status = element('p', controller.message, 'dope-ai-message');
        status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
        this.content.append(title, status);
        if (this.returnToChat) this.content.append(button(this.returnLabel, () => {
            const action = this.returnToChat;
            this.returnToChat = undefined;
            this.render();
            action?.();
        }));
        const layout = element('div', undefined, 'dope-ai-layout');
        const list = element('nav'); list.setAttribute('aria-label', 'AI connections');
        const listTitle = element('h3', 'Connections');
        list.append(listTitle, button('Add Connection', () => this.select(undefined), controller.busy));
        const state = controller.state;
        for (const connection of state?.registry.connections ?? []) {
            const row = button('', () => this.select(connection.id), controller.busy);
            row.className = 'dope-ai-connection';
            row.setAttribute('aria-current', String(controller.selectedId === connection.id));
            const provider = controller.setups.find(setup => setup.type === connection.config.type);
            row.append(element('strong', `${provider?.locality ?? 'AI'} · ${connection.config.type === 'local' ? connection.config.runtime : connection.config.type} · ${connection.alias}`),
                element('span', `${connectionHealth(state!, connection)} · ${usableModelSummary(controller.usableModels, connection)}`));
            list.append(row);
        }
        const detail = element('section'); detail.setAttribute('aria-label', 'Connection details');
        const selected = state?.registry.connections.find(connection => connection.id === controller.selectedId);
        if (selected) this.renderDetail(detail, selected);
        else this.renderForm(detail);
        layout.append(list, detail); this.content.append(layout);
    }

    private renderDetail(detail: HTMLElement, connection: AIConnection): void {
        const controller = this.controller;
        const state = controller.state!;
        detail.append(element('h3', connection.alias), element('p', `Health: ${connectionHealth(state, connection)}`));
        detail.append(element('p', `Provider: ${connection.config.type}`));
        if (connection.preferredModelId) detail.append(element('p', `Preferred model: ${connection.preferredModelId}`));
        if ('endpoint' in connection.config && connection.config.endpoint)
            detail.append(element('p', `Endpoint: ${safeEndpoint(connection.config.endpoint)}`));
        const credential = controller.credential;
        detail.append(element('p', `Credential: ${credential?.effectiveSource ?? 'none'} · ${credential?.sources.map(item =>
            `${item.source}${item.name ? ` (${item.name})` : ''}: ${item.status}`).join(', ') ?? 'checking'}`));
        const actions = element('div', undefined, 'dope-ai-actions');
        actions.append(button('Edit', () => { this.editing = !this.editing; this.render(); }, controller.busy),
            button('Refresh Models', () => void controller.check(connection.id, 'refresh'), controller.busy || connection.lifecycle === 'disabled'),
            button('Reconnect', () => void controller.check(connection.id, 'reconnect'), controller.busy || connection.lifecycle === 'disabled'),
            button('Test Connection', () => void this.test(connection.id), controller.busy || connection.lifecycle === 'disabled'),
            button(connection.lifecycle === 'enabled' ? 'Disable' : 'Enable', () => void controller.run(() =>
                controller.mutate({ type: 'update-connection', id: connection.id, changes: {
                    alias: connection.alias, config: connection.config,
                    lifecycle: connection.lifecycle === 'enabled' ? 'disabled' : 'enabled' } }),
                'Connection state could not be changed.'), controller.busy),
            button('Remove', () => {
                if (window.confirm(`Remove connection ${connection.alias}?`)) void controller.remove(connection.id);
            }, controller.busy));
        detail.append(actions);
        if (this.editing) this.renderForm(detail, connection);
        const models = state.registry.models.filter(model => model.connectionId === connection.id);
        const disclosure = button(`Models (${models.length}) ${this.modelsOpen ? '▾' : '▸'}`, () => {
            this.modelsOpen = !this.modelsOpen; this.render();
        });
        disclosure.setAttribute('aria-expanded', String(this.modelsOpen)); detail.append(disclosure);
        if (this.modelsOpen) for (const model of models) {
            const row = element('div', undefined, 'dope-ai-model');
            const capabilities = Object.entries(model.capabilities).map(([name, item]) =>
                `${name}: ${item.value === undefined ? 'unknown' : item.value ? 'yes' : 'no'} (${item.source})`).join(', ');
            row.append(element('span', `${model.label} · ${model.state} · ${capabilities} · context ${
                model.limits.contextWindowTokens.value ?? 'unknown'} (${model.limits.contextWindowTokens.source})`),
                button(model.enabled ? 'Disable model' : 'Enable model', () => void controller.toggleModel(
                    connection.id, model.providerModelKey, !model.enabled), controller.busy));
            detail.append(row);
        }
        const tested = state.tests.find(item => item.connectionId === connection.id);
        if (tested) detail.append(element('p', `Last test: ${tested.latencyMs} ms${tested.hostedCostPossible ? ' · hosted usage may incur cost' : ''}`));
    }

    private async test(id: string): Promise<void> {
        try {
            const hosted = await this.controller.testDisclosure(id);
            if (hosted && !window.confirm('Test Connection sends a small hosted request that may incur cost. Continue?')) return;
            await this.controller.check(id, 'test');
        } catch { this.controller.message = 'Test availability could not be checked.'; this.render(); }
    }

    private renderForm(detail: HTMLElement, existing?: AIConnection): void {
        const setups = this.controller.setups;
        detail.append(element('h3', existing ? 'Edit Connection' : 'Add Connection'));
        if (!existing && !this.controller.state?.registry.connections.length)
            detail.append(element('p', 'Local runtimes run on your machine; hosted providers use an account and may incur cost.'));
        const form = element('form');
        const label = element('label', 'Provider');
        const select = element('select'); select.name = 'provider';
        for (const setup of setups) {
            const option = element('option', `${setup.locality} · ${setup.type}`);
            option.value = setup.type; option.selected = setup.type === existing?.config.type;
            select.append(option);
        }
        label.append(select); form.append(label);
        const alias = field(form, 'Alias', 'alias', existing?.alias); alias.required = true;
        const extra = element('div'); form.append(extra);
        const renderFields = () => {
            extra.replaceChildren();
            const setup = setups.find(item => item.type === select.value);
            if (!setup) return;
            if (setup.fields.includes('runtime')) field(extra, 'Runtime', 'runtime',
                existing?.config.type === 'local' ? existing.config.runtime : 'lm-studio').readOnly = true;
            if (setup.fields.includes('endpoint')) {
                const endpoint = field(extra, 'Endpoint', 'endpoint',
                    existing?.config.type === select.value && 'endpoint' in existing.config ? existing.config.endpoint ?? '' :
                        select.value === 'local' ? 'http://127.0.0.1:1234/v1' : '');
                endpoint.required = true;
            }
            if (setup.fields.includes('preferredModelId')) field(extra, 'Preferred model ID', 'preferredModelId', existing?.preferredModelId);
            const credentialLabel = element('label', 'Credential source');
            const credentialSelect = element('select'); credentialSelect.name = 'source';
            const defaultSource = existing?.credential?.source ??
                (setup.credential === 'optional' ? '' : setup.environmentVariable ? 'environment' : 'session');
            if (setup.credential === 'optional') {
                const option = element('option', 'none'); option.value = '';
                option.selected = !defaultSource;
                credentialSelect.append(option);
            }
            for (const source of setup.credentialSources) {
                const option = element('option', source); option.value = source;
                option.selected = source === defaultSource;
                credentialSelect.append(option);
            }
            credentialLabel.append(credentialSelect); extra.append(credentialLabel);
            const secret = field(extra, 'New credential (never displayed)', 'secret', '', true);
            const environmentName = setup.environmentVariable ? undefined : field(extra, 'Environment variable name',
                'environmentName', existing?.credential?.source === 'environment' ? existing.credential.name : '');
            const updateSecret = () => {
                secret.parentElement!.hidden = !credentialSelect.value || credentialSelect.value === 'environment';
                if (environmentName) environmentName.parentElement!.hidden = credentialSelect.value !== 'environment';
            };
            credentialSelect.addEventListener('change', updateSecret); updateSecret();
            if (setup.environmentVariable) extra.append(element('p', `Environment variable: ${setup.environmentVariable}`));
            if (select.value === 'local' && !existing) extra.append(button('Detect Local runtime', () => {
                void this.controller.detectLocal().then(config => {
                    if (config?.type === 'local') (form.elements.namedItem('endpoint') as HTMLInputElement).value = config.endpoint;
                    else { this.controller.message = 'No supported Local runtime detected.'; this.render(); }
                }).catch(() => { this.controller.message = 'Local detection failed.'; this.render(); });
            }));
        };
        select.addEventListener('change', renderFields); renderFields();
        const save = element('button', existing ? 'Save Connection' : 'Add Connection'); save.type = 'submit';
        form.append(save);
        form.addEventListener('submit', event => {
            event.preventDefault();
            const setup = setups.find(item => item.type === select.value);
            if (!setup) return;
            const source = value(form, 'source') as 'environment' | 'session' | 'secure';
            const secret = value(form, 'secret');
            const config: AIConnectionConfig = select.value === 'local' ?
                { type: 'local', runtime: 'lm-studio', endpoint: value(form, 'endpoint') } :
                select.value === 'openai-compatible' ? { type: 'openai-compatible', endpoint: value(form, 'endpoint') } :
                    select.value === 'gemini' ? { type: 'gemini' } : { type: 'openai' };
            const connection: AIConnection = { version: AI_REGISTRY_VERSION, id: existing?.id ?? crypto.randomUUID(),
                alias: value(form, 'alias'), lifecycle: existing?.lifecycle ?? 'enabled', config,
                ...(setup.fields.includes('preferredModelId') && value(form, 'preferredModelId') ?
                    { preferredModelId: value(form, 'preferredModelId') } : {}),
                ...(source === 'environment' ?
                    { credential: { source, name: setup.environmentVariable ?? value(form, 'environmentName'), status: 'unknown' } } :
                    source === 'session' || source === 'secure' ? { credential: { source, status: 'unknown' } } : {}) };
            void this.controller.save(connection, !existing, secret, source === 'environment' ? undefined : source)
                .then(saved => { if (saved) { this.editing = false; this.render(); } });
        });
        detail.append(form);
    }

    protected override onActivateRequest(msg: Message): void { super.onActivateRequest(msg); this.node.focus(); }
    protected override onAfterAttach(msg: Message): void { super.onAfterAttach(msg); this.refresh(); }
}
