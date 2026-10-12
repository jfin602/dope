import { injectable } from '@theia/core/shared/inversify';
import { AbstractViewContribution } from '@theia/core/lib/browser';
import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { CommandRegistry } from '@theia/core/lib/common';
import { RoadmapInspectorModel } from './roadmap-inspector-model';

export const ROADMAP_INSPECTOR_ID = 'dope-roadmap-inspector';

export class RoadmapInspectorWidget extends BaseWidget {
    private readonly content = document.createElement('div');
    private readonly off: () => void;
    constructor(private readonly model: RoadmapInspectorModel) {
        super();
        this.id = ROADMAP_INSPECTOR_ID;
        this.title.label = 'Roadmap';
        this.title.caption = 'Roadmap details';
        this.title.iconClass = codicon('milestone');
        this.title.closable = true;
        this.addClass('dope-roadmap-inspector');
        this.content.setAttribute('aria-label', 'Roadmap checkpoint details');
        this.node.append(this.content);
        this.off = model.onChange(() => this.render());
        this.render();
    }
    private element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        return element;
    }
    private button(text: string, action: () => void): HTMLButtonElement {
        const button = this.element('button', text);
        button.type = 'button'; button.onclick = action;
        return button;
    }
    private render(): void {
        const activeElement = this.node.contains(document.activeElement) ? document.activeElement as HTMLInputElement | HTMLTextAreaElement : undefined;
        const active = activeElement?.id;
        const scrollTop = activeElement?.scrollTop;
        const selection = activeElement && typeof activeElement.selectionStart === 'number' ?
            [activeElement.selectionStart, activeElement.selectionEnd] : undefined;
        const item = this.model.selected;
        this.content.replaceChildren();
        if (!item) { this.content.append(this.element('p', 'Select a checkpoint on the Roadmap to inspect it.')); return; }
        const heading = this.element('h2', item.title);
        const state = this.element('p', `${item.kind} · ${item.status.replaceAll('-', ' ')} · Roadmap revision ${this.model.index?.revision}`);
        const objective = this.element('section');
        objective.append(this.element('h3', 'Objective'), this.element('p', item.objective || 'No objective recorded.'));
        const evidence = this.element('section');
        evidence.append(this.element('h3', 'Evidence and gates'));
        if (!item.evidence.length) evidence.append(this.element('p', 'No evidence recorded. Gate status is not inferred.'));
        for (const citation of item.evidence) evidence.append(this.element('p', `${citation.path}:${citation.line} · ${citation.statusText ?? citation.text}`));
        const dependencies = this.element('section');
        dependencies.append(this.element('h3', 'Dependencies'));
        if (!item.dependencies.length) dependencies.append(this.element('p', 'None recorded.'));
        for (const id of item.dependencies) {
            const target = this.model.index?.checkpoints.find(candidate => candidate.id === id);
            dependencies.append(this.element('p', target ? `${target.kind} · ${target.title}` : `Unresolved · ${id}`));
        }
        const links = this.element('section');
        links.append(this.element('h3', 'Typed links'));
        if (!item.links.length) links.append(this.element('p', 'None recorded.'));
        for (const link of item.links) links.append(this.element('p', `${link.owner} · ${link.targetId}${link.ownerRevision === undefined ? '' : ` · revision ${link.ownerRevision}`}`));
        this.content.append(heading, state, objective, evidence, dependencies, links);
        if (!item.readOnly && this.model.draft) this.renderEditor(item.title);
        else this.content.append(this.element('p', 'This source checkpoint is read only.'));
        const feedback = this.element('p', this.model.error ?? (this.model.busy ? 'Checking Roadmap revision…' : ''));
        feedback.setAttribute('role', this.model.error ? 'alert' : 'status');
        this.content.append(feedback);
        if (active) {
            const replacement = this.content.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${active}`);
            replacement?.focus();
            if (replacement && scrollTop !== undefined) replacement.scrollTop = scrollTop;
            if (selection && replacement && typeof replacement.setSelectionRange === 'function')
                replacement.setSelectionRange(selection[0], selection[1]);
        }
    }
    private renderEditor(title: string): void {
        const draft = this.model.draft!;
        const form = this.element('form');
        form.onsubmit = event => { event.preventDefault(); void this.model.save(); };
        form.append(this.element('h3', `Edit ${title}`));
        const titleLabel = this.element('label', 'Title');
        const titleInput = this.element('input');
        titleInput.id = 'dope-roadmap-title'; titleInput.value = draft.title; titleInput.maxLength = 512;
        titleInput.disabled = !!this.model.selected?.source;
        titleInput.oninput = () => this.model.change('title', titleInput.value);
        titleLabel.append(titleInput);
        const objectiveLabel = this.element('label', 'Objective');
        const objectiveInput = this.element('textarea');
        objectiveInput.id = 'dope-roadmap-objective'; objectiveInput.value = draft.objective; objectiveInput.maxLength = 8192;
        objectiveInput.oninput = () => this.model.change('objective', objectiveInput.value);
        objectiveLabel.append(objectiveInput);
        const statusLabel = this.element('label', 'Status');
        const statusInput = this.element('select');
        statusInput.id = 'dope-roadmap-status';
        for (const status of ['unknown', 'active', 'not-implemented', 'not-green', 'green', 'waived']) {
            const option = this.element('option', status.replaceAll('-', ' '));
            option.value = status; option.selected = draft.status === status;
            option.disabled = status === 'green' || status === 'waived'; statusInput.append(option);
        }
        statusInput.disabled = !!this.model.selected?.source || draft.status === 'green' || draft.status === 'waived';
        statusInput.onchange = () => this.model.change('status', statusInput.value);
        statusLabel.append(statusInput);
        const save = this.element('button', 'Preview and save');
        save.id = 'dope-roadmap-save'; save.type = 'submit'; save.disabled = !this.model.dirty || this.model.busy;
        form.append(titleLabel, objectiveLabel, statusLabel, save);
        if (this.model.requiresApproval) {
            const warning = this.element('p', `This change affects a gate. ${this.model.previewSummary ?? ''} Approve explicitly.`);
            const approve = this.button('Approve change', () => void this.model.approve());
            approve.id = 'dope-roadmap-approve'; approve.disabled = this.model.busy;
            form.append(warning, approve);
        }
        if (this.model.undo) {
            const undo = this.button('Undo last edit', () => void this.model.undoEdit());
            undo.id = 'dope-roadmap-undo'; undo.disabled = this.model.busy;
            form.append(undo);
        }
        this.content.append(form);
    }
    override dispose(): void { this.off(); super.dispose(); }
}

@injectable()
export class RoadmapInspectorView extends AbstractViewContribution<RoadmapInspectorWidget> {
    constructor() { super({ widgetId: ROADMAP_INSPECTOR_ID, widgetName: 'Roadmap', defaultWidgetOptions: { area: 'left', rank: 210 } }); }
    show(): Promise<RoadmapInspectorWidget> { return this.openView({ activate: true }); }
    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand({ id: 'dope.roadmap.inspector', label: 'Dope: Show Roadmap Details' },
            { execute: () => this.show() });
    }
}
