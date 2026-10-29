import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { RoadmapInspectorModel } from './roadmap-inspector-model';
import { evaluateGateQualification } from '@dope/project-intelligence/lib/node/roadmap-gate-domain.js';
import { roadmapGateLabel } from './roadmap-canvas-model';

export const ROADMAP_INSPECTOR_ID = 'dope-roadmap-inspector';
export const ROADMAP_CANVAS_INSPECTOR_ID = 'dope-roadmap-canvas-inspector';

export class RoadmapInspectorWidget extends BaseWidget {
    private readonly content = document.createElement('div');
    private readonly off: () => void;
    constructor(private readonly model: RoadmapInspectorModel, private readonly editable = true) {
        super();
        this.id = editable ? ROADMAP_CANVAS_INSPECTOR_ID : ROADMAP_INSPECTOR_ID;
        this.title.label = 'Roadmap';
        this.title.caption = 'Roadmap details in canvas';
        this.title.iconClass = codicon('milestone');
        this.title.closable = true;
        this.addClass('dope-roadmap-inspector');
        this.content.setAttribute('aria-label', 'Roadmap details');
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
        const activeElement = this.node.contains(document.activeElement) ? document.activeElement as HTMLElement : undefined;
        const active = activeElement?.id;
        const scrollTop = activeElement?.scrollTop;
        const textControl = activeElement instanceof HTMLInputElement || activeElement instanceof HTMLTextAreaElement ? activeElement : undefined;
        const selection = textControl && typeof textControl.selectionStart === 'number' ?
            [textControl.selectionStart, textControl.selectionEnd] : undefined;
        const item = this.model.selected;
        const gate = this.model.selectedGate;
        const prompt = this.model.selectedPrompt;
        this.content.replaceChildren();
        if (!item && prompt) {
            this.content.append(this.element('h2', prompt.title), this.element('p', `${prompt.kind} · ${prompt.statusLabel}`),
                this.element('p', prompt.taskSource?.path ?? prompt.taskSource?.stackPath ?? 'Source unavailable'));
            if (prompt.kind === 'prompt' && prompt.taskSource?.path) {
                const action = this.button('Open Prompt', () => void this.model.openPrompt());
                action.id = 'dope-roadmap-open-prompt';
                action.setAttribute('aria-label', `Open prompt source: ${prompt.title}`);
                this.content.append(action);
            }
            this.content.append(this.element('p', 'Opening a prompt displays its source in the editor. It does not run the prompt.'));
            const feedback = this.element('p', this.model.error ?? '');
            feedback.setAttribute('role', this.model.error ? 'alert' : 'status');
            this.content.append(feedback);
            return;
        }
        if (gate) {
            this.renderGate(gate);
            if (active) {
                const replacement = this.content.querySelector<HTMLElement>(`#${active}`);
                replacement?.focus();
                if (replacement && scrollTop !== undefined) replacement.scrollTop = scrollTop;
                if (selection && (replacement instanceof HTMLInputElement || replacement instanceof HTMLTextAreaElement))
                    replacement.setSelectionRange(selection[0], selection[1]);
            }
            return;
        }
        const phase = this.model.selectedPhase;
        if (phase) {
            const gates = this.model.gateIndex?.gates.filter(item => item.parentPhaseId === phase.id) ?? [];
            this.content.append(this.element('h2', phase.title),
                this.element('p', `Phase ${phase.order + 1} · ${phase.draftAcceptance} · ${phase.qualificationStatus.replaceAll('-', ' ')} · Roadmap revision ${this.model.gateIndex?.revision}`));
            const objective = this.element('section');
            objective.append(this.element('h3', 'Objective'), this.element('p', phase.objective));
            const coverage = this.element('section');
            coverage.append(this.element('h3', 'Gate coverage'),
                this.element('p', `${gates.length} accepted ${gates.length === 1 ? 'Gate' : 'Gates'} · complete Gate-set coverage ${phase.gateSetCoverage.status.replaceAll('-', ' ')}`));
            for (const item of gates) coverage.append(this.element('p', `${roadmapGateLabel(item)} · ${item.qualificationStatus.replaceAll('-', ' ')}`));
            if (!gates.length) coverage.append(this.element('p', 'No accepted Gates. This Phase is Unplanned, not Green.'));
            this.content.append(objective, coverage);
            return;
        }
        if (!item) { this.content.append(this.element('p', 'Select a Phase or Gate on the Roadmap to inspect it.')); return; }
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
        if (this.editable) {
            const prepare = this.button('Prepare Work', () => void this.model.prepareWork());
            prepare.id = 'dope-roadmap-prepare-work';
            prepare.disabled = !!this.model.prepareWorkBlockedReason;
            prepare.setAttribute('aria-label', `Prepare Work for ${item.title}`);
            this.content.append(prepare);
            if (this.model.prepareWorkBlockedReason)
                this.content.append(this.element('p', this.model.prepareWorkBlockedReason));
            else this.content.append(this.element('p', 'Open the existing Planning Map to review requirements and impact. This does not start Chat or Work.'));
        }
        if (this.editable && !item.readOnly && this.model.draft) this.renderEditor(item.title);
        else if (!this.editable && !item.readOnly) this.content.append(this.element('p', 'Edit this checkpoint in Roadmap Details on the canvas.'));
        else this.content.append(this.element('p', 'This source checkpoint is read only.'));
        const feedback = this.element('p', this.model.error ?? (this.model.busy ? 'Checking Roadmap revision…' : ''));
        feedback.setAttribute('role', this.model.error ? 'alert' : 'status');
        this.content.append(feedback);
        if (active) {
            const replacement = this.content.querySelector<HTMLElement>(`#${active}`);
            replacement?.focus();
            if (replacement && scrollTop !== undefined) replacement.scrollTop = scrollTop;
            if (selection && (replacement instanceof HTMLInputElement || replacement instanceof HTMLTextAreaElement))
                replacement.setSelectionRange(selection[0], selection[1]);
        }
    }
    private renderGate(gate: NonNullable<RoadmapInspectorModel['selectedGate']>): void {
        const index = this.model.gateIndex;
        const phase = index?.phases.find(item => item.id === gate.parentPhaseId);
        const qualification = evaluateGateQualification(gate, gate.qualificationSource);
        this.content.append(this.element('h2', roadmapGateLabel(gate)),
            this.element('p', `Gate in ${phase?.title ?? gate.parentPhaseId} · ${gate.draftAcceptance} · ${qualification.status.replaceAll('-', ' ')} · Roadmap revision ${index?.revision}`));
        const objective = this.element('section');
        objective.append(this.element('h3', 'Objective'), this.element('p', gate.purpose));
        const criteria = this.element('section');
        criteria.append(this.element('h3', 'Criteria and available evidence'));
        if (!gate.criteria.length) criteria.append(this.element('p', 'No criteria recorded. Gate qualification is unavailable.'));
        for (const criterion of gate.criteria) {
            const group = this.element('div');
            group.append(this.element('h4', criterion.title), this.element('p', `Expected: ${criterion.expectedResult}`));
            if (!criterion.evidence.length) group.append(this.element('p', 'No evidence recorded.'));
            for (const evidence of criterion.evidence) group.append(this.element('p',
                `${evidence.result} · ${evidence.review.status}${evidence.validation ? ' · stale' : ''} · ${evidence.summary} · ${evidence.verifiedBy}`));
            criteria.append(group);
        }
        const dependencies = this.element('section');
        dependencies.append(this.element('h3', 'Dependencies'));
        if (!gate.dependencies.length) dependencies.append(this.element('p', 'None recorded.'));
        for (const id of gate.dependencies) {
            const target = index?.gates.find(candidate => candidate.id === id);
            dependencies.append(this.element('p', target ? roadmapGateLabel(target) : `Unresolved · ${id}`));
        }
        const corrections = this.element('section');
        corrections.append(this.element('h3', 'Corrections'));
        const linked = index?.corrections.filter(item => item.parent.kind === 'gate' && item.parent.id === gate.id) ?? [];
        if (!linked.length) corrections.append(this.element('p', 'None recorded.'));
        for (const correction of linked) corrections.append(this.element('p', `${correction.title} · ${correction.qualificationStatus.replaceAll('-', ' ')} · ${correction.objective}`));
        this.content.append(objective, criteria, dependencies, corrections);
        const prepare = this.button('Prepare Work', () => void this.model.prepareWork());
        prepare.id = 'dope-roadmap-prepare-work'; prepare.disabled = true;
        prepare.setAttribute('aria-label', `Prepare Work for Gate ${gate.designation}: unavailable`);
        this.content.append(prepare, this.element('p', this.model.prepareWorkBlockedReason));
        if (this.editable && this.model.gateDraft) {
            const form = this.element('form');
            form.onsubmit = event => { event.preventDefault(); void this.model.saveGate(); };
            form.append(this.element('h3', 'Edit Gate definition'));
            const title = this.element('input'); title.id = 'dope-roadmap-gate-title';
            title.value = this.model.gateDraft.title; title.maxLength = 200;
            title.setAttribute('aria-label', 'Gate title');
            title.oninput = () => this.model.changeGate('title', title.value);
            const purpose = this.element('textarea'); purpose.id = 'dope-roadmap-gate-purpose';
            purpose.value = this.model.gateDraft.purpose; purpose.maxLength = 8192;
            purpose.setAttribute('aria-label', 'Gate objective');
            purpose.oninput = () => this.model.changeGate('purpose', purpose.value);
            const save = this.element('button', 'Preview Gate edit'); save.type = 'submit';
            save.disabled = !this.model.dirty || this.model.busy;
            form.append(title, purpose, save);
            if (this.model.requiresApproval) {
                form.append(this.element('p', `${this.model.previewSummary ?? 'Review this Gate change.'} Approve explicitly.`));
                const approve = this.button('Approve Gate edit', () => void this.model.approve());
                approve.id = 'dope-roadmap-gate-approve'; approve.disabled = this.model.busy;
                form.append(approve);
            }
            if (this.model.dirty || this.model.requiresApproval) {
                const discard = this.button('Discard Gate edit', () => this.model.discardEdit());
                discard.disabled = this.model.busy; form.append(discard);
            }
            this.content.append(form);
        }
        const feedback = this.element('p', this.model.error ?? (this.model.busy ? 'Checking Roadmap revision…' : ''));
        feedback.setAttribute('role', this.model.error ? 'alert' : 'status');
        this.content.append(feedback);
    }
    private renderEditor(title: string): void {
        const draft = this.model.draft!;
        const form = this.element('form');
        form.onsubmit = event => { event.preventDefault(); void this.model.save(); };
        form.append(this.element('h3', `Edit ${title}`));
        const titleLabel = this.element('label', 'Title');
        const titleInput = this.element('input');
        titleInput.id = 'dope-roadmap-title'; titleInput.value = draft.title; titleInput.maxLength = 512;
        titleInput.disabled = !!this.model.selected?.readOnly;
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
            const warning = this.element('p', `${this.model.selected?.source ? 'Review this linked Markdown change.' : 'This change affects a gate.'} ${this.model.previewSummary ?? ''} Approve explicitly.`);
            warning.style.whiteSpace = 'pre-wrap';
            const approve = this.button('Approve change', () => void this.model.approve());
            approve.id = 'dope-roadmap-approve'; approve.disabled = this.model.busy;
            form.append(warning, approve);
        }
        if (this.model.dirty || this.model.requiresApproval) {
            const discard = this.button('Discard draft and preview', () => this.model.discardEdit());
            discard.id = 'dope-roadmap-discard'; discard.disabled = this.model.busy;
            form.append(discard);
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
