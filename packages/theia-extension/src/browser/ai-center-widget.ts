import { BaseWidget, codicon, Message } from '@theia/core/lib/browser/widgets/widget';
import { AI_REGISTRY_VERSION, AI_ROLE_IDS } from '@dope/ai';
import type { AIConnection, AIConnectionConfig, AIRoleHardConstraints, AIRoleId, AIRolePolicy,
    AIRolePolicyEntry, AIRoleSoftPreference } from '@dope/ai';
import type { AIRegistryService } from '@dope/contracts/lib/ai-registry-service';
import type { AICredentialService } from '@dope/contracts/lib/ai-credential-service';
import type { AIRolePolicyService } from '@dope/contracts/lib/ai-role-policy-service';
import { AICenterController, connectionHealth, usableModelSummary } from './ai-center-controller';
import { AICenterRolesController, emptyRoleHard, ROLE_DETAILS, ROLE_REASON_LABELS,
    roleEntryLabel, roleResolution, roleTargetLabel } from './ai-center-roles';

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
    readonly roles: AICenterRolesController;
    private readonly content = element('div');
    private surface: 'connections' | 'models' | 'roles' = 'connections';
    private editing = false;
    private modelsOpen = false;
    private returnToChat?: () => void;
    private returnLabel = 'Return to Chat';

    constructor(registry: AIRegistryService, credentials: AICredentialService, roles: AIRolePolicyService) {
        super();
        this.id = AI_CENTER_ID;
        this.title.label = this.title.caption = 'AI Center';
        this.title.iconClass = codicon('sparkle');
        this.title.closable = true;
        this.node.tabIndex = -1;
        this.addClass('dope-ai-center');
        this.controller = new AICenterController(registry, credentials, () => this.render());
        this.roles = new AICenterRolesController(roles, () => this.render());
        this.node.append(this.content);
        void this.controller.load();
        void this.roles.load();
    }

    refresh(): void { void this.controller.load(); void this.roles.load(); }

    async focusRole(id: AIRoleId): Promise<void> {
        this.surface = 'roles';
        this.roles.select(id);
        await this.roles.load();
        this.content.querySelector<HTMLElement>('.dope-ai-role-editor h3')?.focus();
    }

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
        const roleStatus = element('p', this.roles.message, 'dope-ai-message');
        roleStatus.setAttribute('role', 'status'); roleStatus.setAttribute('aria-live', 'polite');
        this.content.append(roleStatus);
        if (this.returnToChat) this.content.append(button(this.returnLabel, () => {
            const action = this.returnToChat;
            this.returnToChat = undefined;
            this.render();
            action?.();
        }));
        const tabs = element('nav', undefined, 'dope-ai-tabs'); tabs.setAttribute('aria-label', 'AI Center sections');
        for (const surface of ['connections', 'models', 'roles'] as const) {
            const tab = button(surface[0].toUpperCase() + surface.slice(1), () => {
                this.surface = surface; this.render();
            });
            tab.setAttribute('aria-current', String(this.surface === surface)); tabs.append(tab);
        }
        this.content.append(tabs);
        if (this.surface === 'roles') { this.renderRoles(); return; }
        if (this.surface === 'models') { this.renderModels(); return; }
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

    private renderModels(): void {
        const state = this.controller.state;
        const section = element('section'); section.setAttribute('aria-label', 'AI models');
        section.append(element('h3', 'Models'));
        if (!state?.registry.models.length) section.append(element('p', 'No models discovered yet. Add or refresh a connection.'));
        for (const model of state?.registry.models ?? []) {
            const connection = state!.registry.connections.find(item => item.id === model.connectionId);
            const row = element('div', undefined, 'dope-ai-model');
            row.append(element('span', `${connection?.alias ?? 'Removed connection'} · ${model.label} · ${
                model.locality} · ${model.state} · ${model.enabled ? 'enabled' : 'disabled'}`));
            if (connection) row.append(button('Open connection', () => {
                this.controller.selectedId = connection.id; this.surface = 'connections';
                void this.controller.select(connection.id);
            }));
            section.append(row);
        }
        this.content.append(section);
    }

    private renderRoles(): void {
        const state = this.controller.state;
        const snapshot = this.roles.snapshot;
        const layout = element('div', undefined, 'dope-ai-layout');
        const list = element('nav'); list.setAttribute('aria-label', 'AI roles');
        list.append(element('h3', 'Roles'));
        for (const roleId of AI_ROLE_IDS) {
            const policy = snapshot?.policies.find(item => item.roleId === roleId);
            const row = button('', () => this.roles.select(roleId), this.roles.busy);
            row.className = 'dope-ai-connection';
            row.setAttribute('aria-current', String(this.roles.selectedId === roleId));
            const details = ROLE_DETAILS[roleId];
            const health = snapshot && state ? roleResolution(snapshot, state, roleId, true).health : 'loading';
            row.append(element('strong', details.name), element('span', details.purpose),
                element('span', `Preferred: ${roleEntryLabel(policy?.preferred, state)}`),
                element('span', `${policy?.fallbacks.length ?? 0} fallbacks · ${health}`),
                element('span', policy ? this.roleSummary(policy) : ''));
            list.append(row);
        }
        const detail = element('section', undefined, 'dope-ai-role-editor');
        detail.setAttribute('aria-label', 'Role policy editor');
        if (this.roles.draft) this.renderRoleEditor(detail, this.roles.draft);
        else detail.append(element('p', 'Role policy is loading.'));
        layout.append(list, detail); this.content.append(layout);
    }

    private roleSummary(policy: AIRolePolicy): string {
        const parts: string[] = [policy.hard.locality];
        if (policy.hard.requiredCapabilities.length) parts.push(policy.hard.requiredCapabilities.join(', '));
        if (policy.hard.minimumKnownContextTokens) parts.push(`context ≥ ${policy.hard.minimumKnownContextTokens}`);
        if (policy.hard.hostedProjectData === 'forbidden') parts.push('no hosted egress');
        if (policy.preferences.length) parts.push(policy.preferences.join(', '));
        return parts.join(' · ');
    }

    private renderRoleEditor(detail: HTMLElement, draft: AIRolePolicy): void {
        const info = ROLE_DETAILS[draft.roleId];
        const heading = element('h3', info.name); heading.tabIndex = -1;
        detail.append(heading, element('p', info.purpose));
        if (['coding-agent', 'background', 'deep-reasoning'].includes(draft.roleId))
            detail.append(element('p', 'No active consumer yet'));
        detail.append(element('p', info.authority, 'dope-ai-role-authority'));
        detail.append(element('p', 'Global role policy can restrict hosted egress; the initiating feature must approve it.'));
        const entries = element('div');
        entries.append(element('h4', 'Preferred target'));
        this.renderEntry(entries, draft.preferred, -1);
        entries.append(element('h4', `Fallbacks (${draft.fallbacks.length})`));
        for (const [index, entry] of draft.fallbacks.entries()) this.renderEntry(entries, entry, index);
        entries.append(button('Add fallback', () => this.roles.edit(policy => ({ ...policy,
            allowFallback: true, fallbacks: [...policy.fallbacks, { type: 'constraints', hard: emptyRoleHard(), preferences: [] }] })),
            this.roles.busy || !draft.preferred || draft.fallbacks.length >= 8));
        detail.append(entries);
        const fallback = element('label', 'Allow fallback before useful output');
        const fallbackInput = element('input'); fallbackInput.type = 'checkbox'; fallbackInput.checked = draft.allowFallback;
        fallbackInput.addEventListener('change', () => this.roles.edit(policy => ({ ...policy, allowFallback: fallbackInput.checked })));
        fallback.append(fallbackInput); detail.append(fallback);
        detail.append(element('h4', 'Global hard constraints'));
        this.renderHard(detail, draft.hard, hard => this.roles.edit(policy => ({ ...policy, hard })));
        detail.append(element('h4', 'Soft preferences'));
        this.renderPreferences(detail, draft.preferences, preferences => this.roles.edit(policy => ({ ...policy, preferences })));
        detail.append(button('Save role', () => void this.roles.save(), this.roles.busy || !this.roles.dirty));
        detail.append(button('Discard edits', () => this.roles.select(draft.roleId), this.roles.busy || !this.roles.dirty));
        this.renderEligibility(detail, draft);
    }

    private renderEntry(parent: HTMLElement, entry: AIRolePolicyEntry | undefined, fallbackIndex: number): void {
        const wrapper = element('div', undefined, 'dope-ai-role-entry');
        const update = (next?: AIRolePolicyEntry) => this.roles.edit(policy => fallbackIndex < 0 ?
            { ...policy, preferred: next, fallbacks: next ? policy.fallbacks : [] } :
            { ...policy, fallbacks: policy.fallbacks.map((item, index) => index === fallbackIndex ? next! : item) });
        const typeLabel = element('label', fallbackIndex < 0 ? 'Preferred target type' : `Fallback ${fallbackIndex + 1} target type`);
        const type = element('select');
        for (const [value, label] of [['', 'Not configured'], ['exact', 'Exact model'], ['constraints', 'Matching constraints']]) {
            if (fallbackIndex >= 0 && !value) continue;
            const option = element('option', label); option.value = value; option.selected = (entry?.type ?? '') === value; type.append(option);
        }
        type.addEventListener('change', () => update(type.value === 'exact' ?
            { type: 'exact', target: this.firstTarget() } : type.value === 'constraints' ?
                { type: 'constraints', hard: emptyRoleHard(), preferences: [] } : undefined));
        typeLabel.append(type); wrapper.append(typeLabel);
        if (entry?.type === 'exact') {
            const label = element('label', 'Model'); const select = element('select');
            const state = this.controller.state;
            const targets = state?.registry.models.map(model => ({ connectionId: model.connectionId, modelId: model.providerModelKey })) ?? [];
            if (!targets.some(target => target.connectionId === entry.target.connectionId && target.modelId === entry.target.modelId))
                targets.unshift(entry.target);
            for (const target of targets) {
                const option = element('option', state ? roleTargetLabel(target, state) : `${target.connectionId} · ${target.modelId}`);
                option.value = JSON.stringify(target);
                option.selected = target.connectionId === entry.target.connectionId && target.modelId === entry.target.modelId;
                select.append(option);
            }
            select.addEventListener('change', () => update({ type: 'exact', target: JSON.parse(select.value) }));
            label.append(select); wrapper.append(label);
        } else if (entry?.type === 'constraints') {
            this.renderHard(wrapper, entry.hard, hard => update({ ...entry, hard }));
            this.renderPreferences(wrapper, entry.preferences, preferences => update({ ...entry, preferences }));
        }
        if (fallbackIndex >= 0) {
            wrapper.draggable = true;
            wrapper.addEventListener('dragstart', event => event.dataTransfer?.setData('text/plain', String(fallbackIndex)));
            wrapper.addEventListener('dragover', event => event.preventDefault());
            wrapper.addEventListener('drop', event => {
                event.preventDefault();
                const from = event.dataTransfer?.getData('text/plain') ?? '';
                if (/^\d+$/.test(from)) this.roles.move(Number(from), fallbackIndex);
            });
            wrapper.append(button('Move Up', () => this.moveFallback(fallbackIndex, fallbackIndex - 1), fallbackIndex === 0),
                button('Move Down', () => this.moveFallback(fallbackIndex, fallbackIndex + 1),
                    fallbackIndex === (this.roles.draft?.fallbacks.length ?? 0) - 1),
                button('Remove fallback', () => this.roles.edit(policy => ({ ...policy,
                    fallbacks: policy.fallbacks.filter((_, index) => index !== fallbackIndex) }))));
        }
        parent.append(wrapper);
    }

    private moveFallback(from: number, to: number): void {
        this.roles.move(from, to);
        queueMicrotask(() => this.content.querySelectorAll('.dope-ai-role-entry')[to + 1]?.
            querySelector<HTMLButtonElement>('button')?.focus());
    }

    private firstTarget(): { connectionId: string; modelId: string } {
        const model = this.controller.state?.registry.models[0];
        return model ? { connectionId: model.connectionId, modelId: model.providerModelKey } :
            { connectionId: '', modelId: '' };
    }

    private renderHard(parent: HTMLElement, hard: AIRoleHardConstraints, update: (next: AIRoleHardConstraints) => void): void {
        const locality = element('label', 'Locality'); const select = element('select');
        for (const optionValue of ['any', 'local-only', 'hosted-only'] as const) {
            const option = element('option', optionValue); option.value = optionValue;
            option.selected = hard.locality === optionValue; select.append(option);
        }
        select.addEventListener('change', () => update({ ...hard, locality: select.value as AIRoleHardConstraints['locality'] }));
        locality.append(select); parent.append(locality);
        const context = element('label', 'Minimum known context tokens'); const input = element('input');
        input.type = 'number'; input.min = '0'; input.step = '1';
        input.value = hard.minimumKnownContextTokens?.toString() ?? '';
        input.addEventListener('change', () => {
            const { minimumKnownContextTokens: _old, ...rest } = hard;
            update(input.value ? { ...rest, minimumKnownContextTokens: Number(input.value) } : rest);
        });
        context.append(input); parent.append(context);
        for (const capability of ['conversationalText', 'streaming', 'structuredOutput', 'toolCalling'] as const) {
            const label = element('label', `Require ${capability}`); const checkbox = element('input');
            checkbox.type = 'checkbox'; checkbox.checked = hard.requiredCapabilities.includes(capability);
            checkbox.addEventListener('change', () => update({ ...hard, requiredCapabilities: checkbox.checked ?
                [...hard.requiredCapabilities, capability] : hard.requiredCapabilities.filter(item => item !== capability) }));
            label.append(checkbox); parent.append(label);
        }
        const hosted = element('label', 'Forbid hosted project-data egress'); const checkbox = element('input');
        checkbox.type = 'checkbox'; checkbox.checked = hard.hostedProjectData === 'forbidden';
        checkbox.addEventListener('change', () => update({ ...hard,
            hostedProjectData: checkbox.checked ? 'forbidden' : 'requires-feature-authorization' }));
        hosted.append(checkbox); parent.append(hosted);
        const flags = element('label', 'Enabled and usable models are always required for execution.');
        parent.append(flags);
    }

    private renderPreferences(parent: HTMLElement, preferences: readonly AIRoleSoftPreference[],
        update: (next: AIRoleSoftPreference[]) => void): void {
        for (const preference of ['prefer-local', 'prefer-hosted', 'prefer-reasoning-capable', 'prefer-larger-context'] as const) {
            const label = element('label', preference.replaceAll('-', ' ')); const checkbox = element('input');
            checkbox.type = 'checkbox'; checkbox.checked = preferences.includes(preference);
            checkbox.addEventListener('change', () => update(checkbox.checked ? [...preferences, preference] :
                preferences.filter(item => item !== preference)));
            label.append(checkbox); parent.append(label);
        }
    }

    private renderEligibility(detail: HTMLElement, draft: AIRolePolicy): void {
        const state = this.controller.state; const snapshot = this.roles.snapshot;
        detail.append(element('h4', 'Current eligible targets'));
        detail.append(element('p', 'Preview assumes no feature egress approval. A feature may impose stronger constraints.'));
        if (!state || !snapshot) return;
        try {
            const configured = roleResolution({ ...snapshot, policies: snapshot.policies.map(item =>
                item.roleId === draft.roleId ? draft : item) }, state, draft.roleId, false);
            for (const candidate of configured.candidates) detail.append(element('p',
                `${roleTargetLabel(candidate.target, state)} · Eligible under current policy`));
            for (const excluded of configured.excluded) if (excluded.target &&
                excluded.reason !== 'already-candidate') detail.append(element('p',
                `Configured ${roleTargetLabel(excluded.target, state)} · ${
                    ROLE_REASON_LABELS[excluded.reason] ?? 'Ineligible'}`));
            if (!configured.candidates.length && !configured.excluded.length && draft.preferred)
                detail.append(element('p', 'No models match this role policy.'));
            detail.append(element('h4', 'Available model suggestions'));
            detail.append(element('p', 'Suggestions use the global hard constraints; a preferred entry may narrow them.'));
            const previewPolicy: AIRolePolicy = { ...draft, preferred: { type: 'constraints', hard: emptyRoleHard(),
                preferences: draft.preferences }, fallbacks: [], allowFallback: false };
            const preview = roleResolution({ ...snapshot, policies: snapshot.policies.map(item =>
                item.roleId === draft.roleId ? previewPolicy : item) }, state, draft.roleId, false);
            for (const candidate of preview.candidates) detail.append(element('p',
                `${roleTargetLabel(candidate.target, state)} · Available under global constraints`));
            for (const excluded of preview.excluded) if (excluded.target && excluded.reason !== 'already-candidate')
                detail.append(element('p', `${roleTargetLabel(excluded.target, state)} · ${
                    ROLE_REASON_LABELS[excluded.reason] ?? 'Ineligible'}`));
            if (!preview.candidates.length && !preview.excluded.length) detail.append(element('p', 'No models available.'));
        } catch { detail.append(element('p', 'Review constraints to see eligibility.')); }
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
