import { BaseWidget, codicon, Message } from '@theia/core/lib/browser/widgets/widget';
import { OpenerService, open } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { architectureDraft, branchFingerprint, targetBranch, reviewDiagnostics, suggestArchitectureId } from '@dope/software-map';
import type { ArchitectureReviewNode } from '@dope/software-map';
import { declarationFromDraft, SoftwareMapController } from './software-map-controller';
import './dope.css';

export const SOFTWARE_MAP_REVIEW_ID = 'dope-software-map-review';

export class SoftwareMapReviewWidget extends BaseWidget {
    private readonly listener;
    private readonly rootsListener;
    private readonly content = document.createElement('div');
    private selectedKey?: string;
    private workspaceRequest = 0;
    private workspaceChanging = false;
    private acceptedWorkspace?: string;
    private acceptedDraft?: ArchitectureReviewNode[];
    private acceptedBaseline = '';
    private acceptedFingerprint?: string;
    private acceptedBusy = false;
    private acceptedMessage = '';
    private acceptedRequest = 0;

    constructor(private readonly controller: SoftwareMapController, private readonly workspaces: WorkspaceService,
        private readonly opener: OpenerService, private readonly openAICenter?: () => Promise<unknown>) {
        super();
        this.id = SOFTWARE_MAP_REVIEW_ID;
        this.title.label = this.title.caption = 'Edit Architecture';
        this.title.iconClass = codicon('type-hierarchy');
        this.title.closable = true;
        this.addClass('dope-smap-view');
        this.addClass('dope-smap-review');
        this.node.tabIndex = 0;
        this.node.append(this.content);
        this.listener = controller.onChange(() => this.render());
        this.rootsListener = workspaces.onWorkspaceChanged(() => {
            this.workspaceChanging = true;
            this.clearAccepted();
            this.content.replaceChildren(this.element('h2', 'Edit Architecture'), this.element('p', 'Loading workspace…'));
            void this.attach();
        });
        void this.attach();
        this.render();
    }
    private async attach(): Promise<void> {
        const request = ++this.workspaceRequest;
        const roots = await this.workspaces.roots;
        if (this.isDisposed || request !== this.workspaceRequest) return;
        const workspace = roots.length === 1 ? roots[0].resource.toString() : undefined;
        if (workspace !== this.controller.workspace) await this.controller.attach(workspace);
        if (request === this.workspaceRequest) { this.workspaceChanging = false; this.render(); }
    }
    private clearAccepted(): void {
        ++this.acceptedRequest;
        this.acceptedWorkspace = undefined;
        this.controller.invalidateRefinement(false);
        this.controller.refinedEvidence.clear(); this.controller.refinedSources.clear();
        this.acceptedDraft = undefined;
        this.acceptedFingerprint = undefined;
        this.acceptedBaseline = '';
        this.acceptedBusy = false;
        this.acceptedMessage = '';
        this.selectedKey = undefined;
        this.node.scrollTop = 0;
    }
    private async loadAccepted(): Promise<void> {
        const workspace = this.controller.workspace;
        if (!workspace || this.controller.initialization?.state !== 'initialized') return;
        const request = ++this.acceptedRequest;
        this.controller.invalidateRefinement(false);
        this.controller.refinedEvidence.clear(); this.controller.refinedSources.clear();
        this.acceptedWorkspace = workspace;
        this.acceptedDraft = undefined;
        this.acceptedBusy = true;
        this.acceptedMessage = 'Loading canonical Architecture…';
        this.render();
        try {
            const current = await this.controller.readCurrentArchitecture();
            if (request !== this.acceptedRequest || workspace !== this.controller.workspace) return;
            this.acceptedDraft = architectureDraft(current.declaration);
            this.acceptedBaseline = JSON.stringify(this.acceptedDraft);
            this.acceptedFingerprint = current.declarationFingerprint;
            this.selectedKey = this.acceptedDraft[0]?.proposalKey;
            this.acceptedMessage = 'Canonical Architecture loaded. Changes stay in this editor until Save Architecture.';
            void this.controller.setup(true);
        } catch (error) {
            if (request === this.acceptedRequest) this.acceptedMessage = String(error);
        } finally {
            if (request === this.acceptedRequest) { this.acceptedBusy = false; this.render(); }
        }
    }
    private draft(): ArchitectureReviewNode[] { return this.acceptedDraft ?? this.controller.draft; }
    private draftChanged(): void {
        if (this.controller.initialization?.state === 'initialized') {
            const preview = this.controller.refinementPreview;
            if (preview && this.acceptedDraft && branchFingerprint(targetBranch(this.acceptedDraft, preview.targetKey),
                this.acceptedDraft.find(node => node.proposalKey === preview.parentKey)) !== preview.branchFingerprint)
                this.controller.invalidateRefinement();
            this.acceptedMessage = ''; this.render();
        }
        else this.controller.draftChanged();
    }
    private async saveAccepted(): Promise<void> {
        if (!this.acceptedDraft || !this.acceptedFingerprint || this.acceptedBusy || reviewDiagnostics(this.acceptedDraft).length ||
            JSON.stringify(this.acceptedDraft) === this.acceptedBaseline) return;
        const workspace = this.controller.workspace, request = ++this.acceptedRequest;
        const draft = structuredClone(this.acceptedDraft), expectedFingerprint = this.acceptedFingerprint;
        this.acceptedBusy = true;
        this.acceptedMessage = 'Saving canonical Architecture…';
        this.render();
        try {
            const result = await this.controller.saveCurrentArchitecture(expectedFingerprint, declarationFromDraft(draft));
            if (request !== this.acceptedRequest || workspace !== this.controller.workspace) return;
            this.acceptedFingerprint = result.declarationFingerprint;
            this.acceptedBaseline = JSON.stringify(draft);
            this.acceptedMessage = result.status.state === 'ready'
                ? 'Canonical Architecture saved. Software Map analysis is ready.'
                : `Canonical Architecture saved. Software Map analysis ${result.status.state}; inspect Software Map diagnostics.`;
        } catch (error) {
            if (request === this.acceptedRequest) this.acceptedMessage = `Save Architecture failed: ${String(error)}`;
        } finally {
            if (request === this.acceptedRequest) { this.acceptedBusy = false; this.render(); }
        }
    }
    private element<K extends keyof HTMLElementTagNameMap>(tag: K, value?: string): HTMLElementTagNameMap[K] {
        const node = document.createElement(tag);
        if (value !== undefined) node.textContent = value;
        return node;
    }
    private button(value: string, action: () => void): HTMLButtonElement {
        const node = this.element('button', value);
        node.type = 'button'; node.onclick = action;
        return node;
    }
    private renderRefinementSetup(): HTMLElement {
        const model = this.controller;
        const setup = this.element('details');
        setup.setAttribute('aria-label', 'Search Deeper provider setup');
        setup.append(this.element('summary', model.setupReady ? 'Search Deeper · selected model ready' : 'Search Deeper · setup required'));
        const label = this.element('label', 'AI Center connection / model');
        const select = this.element('select');
        const empty = this.element('option', 'Select a connection and model'); empty.value = ''; select.append(empty);
        for (const connection of model.inventory?.registry.connections ?? []) {
            if (connection.config.type !== 'local' && connection.config.type !== 'gemini') continue;
            for (const item of model.inventory?.registry.models.filter(candidate => candidate.connectionId === connection.id) ?? []) {
                const option = this.element('option', connection.alias + ' — ' + item.label);
                option.value = JSON.stringify([connection.id, item.providerModelKey]);
                option.selected = connection.id === model.connectionId && item.providerModelKey === model.modelId;
                select.append(option);
            }
        }
        select.onchange = () => {
            if (select.value) { const [connectionId, modelId] = JSON.parse(select.value) as [string, string]; model.selectTarget(connectionId, modelId); }
        };
        label.append(select); setup.append(label);
        if (model.roleSuggested) setup.append(this.element('p',
            'Software Map role suggested this exact target. You can choose another target before the probe.'));
        setup.append(this.button('Manage connections in AI Center', () => void this.openAICenter?.()));
        if (model.selectedConnection()?.config.type === 'local')
            setup.append(this.field('Loaded context tokens', String(model.contextWindowTokens), value => model.changeContextTokens(value)));
        if (model.selectedConnection()?.config.type === 'gemini') {
            setup.append(this.element('p', 'Search Deeper may send bounded repository evidence to Google’s Gemini API. Confirm before invoking it.'));
            const consent = this.element('label', 'I consent to sending repository evidence for Search Deeper');
            const checkbox = this.element('input'); checkbox.type = 'checkbox'; checkbox.checked = model.hostedConsentGranted();
            checkbox.onchange = () => { if (checkbox.checked) model.consentToHostedEvidence(); else model.revokeHostedEvidenceConsent(); };
            consent.prepend(checkbox); setup.append(consent);
        }
        setup.append(this.button('Refresh AI Center inventory', () => void model.refreshInventory()),
            this.button('Run Software Map structured-output probe', () => void model.probe()));
        setup.append(this.element('p', model.error || (model.setupBusy ? 'Checking model…' : model.setupReady ?
            'Selected model is ready for Search Deeper.' : 'Select an AI Center target and run the Software Map probe.')));
        for (const button of setup.querySelectorAll('button')) button.disabled = model.setupBusy;
        return setup;
    }
    private field(label: string, value: string, update: (value: string) => void, multiline = false, secret = false): HTMLElement {
        const wrapper = this.element('label', label);
        const input = this.element(multiline ? 'textarea' : 'input');
        if (secret && input instanceof HTMLInputElement) input.type = 'password';
        input.value = value;
        input.oninput = () => update(input.value);
        wrapper.append(input);
        return wrapper;
    }
    private render(): void {
        if (this.isDisposed) return;
        if (this.workspaceChanging) return;
        const scrollTop = this.node.scrollTop;
        const focused = this.content.contains(document.activeElement) ? document.activeElement as HTMLElement : undefined;
        const focusedField = focused?.closest('label')?.firstChild?.textContent;
        const focusedButton = focused?.tagName === 'BUTTON' ? focused.textContent : undefined;
        const cursor = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? focused.selectionStart : null;
        const advancedOpen = this.content.querySelector<HTMLDetailsElement>('.dope-smap-review-layout details')?.open ?? false;
        const setupOpen = this.content.querySelector<HTMLDetailsElement>('details[aria-label="Search Deeper provider setup"]')?.open ?? false;
        const review = this.controller.review;
        const accepted = this.controller.initialization?.state === 'initialized';
        if (accepted && this.controller.workspace !== this.acceptedWorkspace) { void this.loadAccepted(); return; }
        if (!accepted && this.acceptedWorkspace) this.clearAccepted();
        const pending = this.controller.flow === 'review' && this.controller.initialization?.state === 'review_required' && !!review;
        if (!pending && !accepted) {
            this.content.replaceChildren(this.element('h2', 'Edit Architecture'),
                this.element('p', 'Architecture is not ready to edit for this project.'));
            this.selectedKey = undefined;
            return;
        }
        if (accepted && !this.acceptedDraft) {
            this.content.replaceChildren(this.element('h2', 'Edit Architecture'), this.element('p', this.acceptedMessage));
            if (!this.acceptedBusy) this.content.append(this.button('Retry loading Architecture', () => void this.loadAccepted()));
            return;
        }
        const draft = this.draft();
        if (!draft.some(node => node.proposalKey === this.selectedKey)) this.selectedKey = draft[0]?.proposalKey;
        const selected = draft.find(node => node.proposalKey === this.selectedKey);
        const heading = this.element('h2', 'Edit Architecture');
        const summary = this.element('p', pending ? review!.proposal.summary : 'Edit the accepted canonical Architecture. Save Architecture is the only canonical write.');
        const ambiguity = pending ? this.element('p', `${review!.proposal.openQuestions.length} open questions · ${review!.proposal.unassignedEvidenceRefs.length} unassigned evidence facts`) : undefined;
        const questions = this.element('details');
        questions.append(this.element('summary', 'Open questions and unassigned evidence'));
        for (const question of review?.proposal.openQuestions ?? []) questions.append(this.element('p', question));
        for (const ref of review?.proposal.unassignedEvidenceRefs ?? []) {
            const item = review?.packet.items.find(fact => fact.id === ref);
            questions.append(this.button(`${item?.kind ?? 'Evidence'} · ${item?.path ?? ref}`, () => void this.openSource(ref)));
        }
        const coverage = this.element('details');
        coverage.append(this.element('summary', `Source-backed coverage · ${review?.coverageLedger?.filter(item => item.status === 'unresolved').length ?? 0} unresolved cues`));
        for (const cue of review?.coverageLedger ?? []) {
            const row = this.element('p', `${cue.status}: ${cue.concept} → ${cue.candidateKeys.join(', ') || 'unresolved'}`);
            coverage.append(row);
            for (const ref of cue.evidenceRefs) {
                const item = review?.packet.items.find(fact => fact.id === ref);
                coverage.append(this.button(item?.path ?? ref, () => void this.openSource(ref)));
            }
        }
        for (const descent of review?.componentDescents ?? []) {
            coverage.append(this.element('p', `${descent.subsystemKey}: ${descent.kind}`));
            for (const ref of descent.evidenceRefs) {
                const item = review?.packet.items.find(fact => fact.id === ref);
                coverage.append(this.button(item?.path ?? ref, () => void this.openSource(ref)));
            }
        }
        const layout = this.element('div'); layout.className = 'dope-smap-review-layout';
        const tree = this.element('nav'); tree.setAttribute('aria-label', 'Architecture hierarchy');
        tree.append(this.element('h3', 'Architecture'));
        const list = (parent: string | null): HTMLUListElement => {
            const ul = this.element('ul');
            for (const node of draft.filter(item => item.parentProposalKey === parent)) {
                const li = this.element('li');
                const button = this.button(`${node.kind}: ${node.name || '(unnamed)'}`, () => { this.selectedKey = node.proposalKey; this.render(); });
                button.setAttribute('aria-current', String(node.proposalKey === this.selectedKey));
                button.className = `dope-smap-review-${node.kind}`;
                li.append(button, list(node.proposalKey)); ul.append(li);
            }
            return ul;
        };
        tree.append(list(null));
        const detail = this.element('section'); detail.setAttribute('aria-label', 'Selected architecture boundary');
        if (selected) this.renderDetail(selected, detail);
        layout.append(tree, detail);
        const validation = this.element('div'); validation.setAttribute('role', 'status');
        const accept = this.button(pending ? 'Accept Architecture' : 'Save Architecture', () => {
            if (pending) void this.controller.accept(); else void this.saveAccepted();
        });
        accept.classList.add('dope-action-primary');
        const issues = reviewDiagnostics(draft);
        validation.append(this.element('p', issues.length ? `${pending ? 'Acceptance' : 'Save'} blocked: ${issues.length} blocker${issues.length === 1 ? '' : 's'}` :
            pending ? 'Review ready for acceptance.' : this.acceptedMessage || (JSON.stringify(draft) === this.acceptedBaseline ? 'No unsaved changes.' : 'Unsaved Architecture changes.')));
        if (issues.length) {
            const list = this.element('ul');
            for (const issue of issues) list.append(this.element('li', `${issue.code}: ${issue.message}${issue.paths.length ? ` · ${issue.paths.join(', ')}` : ''}${issue.proposalKeys.length ? ` · ${issue.proposalKeys.join(', ')}` : ''}`));
            validation.append(list);
        }
        accept.disabled = !!issues.length || (pending ? this.controller.setupBusy : this.acceptedBusy || JSON.stringify(draft) === this.acceptedBaseline);
        const actions = this.element('div'); actions.className = 'dope-smap-review-actions';
        const addSystem = this.button('Add System', () => this.add('system'));
        addSystem.classList.add('dope-action-outline');
        actions.append(addSystem, validation, accept);
        if (pending) actions.append(this.button('Decline review', () => void this.controller.cancel()));
        else {
            const discard = this.button('Discard changes / Reload Architecture', () => void this.loadAccepted());
            discard.disabled = this.acceptedBusy;
            actions.append(discard, this.button('Cancel editing', () => {
                this.clearAccepted(); this.content.replaceChildren(this.element('h2', 'Edit Architecture'), this.element('p', 'Editing canceled. Reopen Edit Architecture to load canonical state.'));
                this.close();
            }));
        }
        this.content.replaceChildren(heading, summary, ...(pending ? [ambiguity!, questions, coverage] : [this.renderRefinementSetup()]), layout, actions);
        this.node.scrollTop = scrollTop;
        if (accepted && this.acceptedBusy) for (const control of this.content.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>('input, textarea, select, button')) control.disabled = true;
        const advanced = this.content.querySelector<HTMLDetailsElement>('.dope-smap-review-layout details');
        if (advanced) advanced.open = advancedOpen;
        const setup = this.content.querySelector<HTMLDetailsElement>('details[aria-label="Search Deeper provider setup"]');
        if (setup) setup.open = setupOpen;
        if (focusedField) {
            const input = [...this.content.querySelectorAll('label')].find(label => label.firstChild?.textContent === focusedField)?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
            input?.focus();
            if (cursor !== null && (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) input.setSelectionRange(cursor, cursor);
        }
        else if (focusedButton) [...this.content.querySelectorAll('button')].find(button => button.textContent === focusedButton)?.focus();
    }
    private renderDetail(node: ArchitectureReviewNode, target: HTMLElement): void {
        const review = this.controller.initialization?.state === 'review_required' ? this.controller.review : undefined;
        const proposal = this.controller.refinedEvidence.get(node.proposalKey) ??
            review?.proposal.nodes.find(item => item.proposalKey === node.proposalKey);
        target.append(this.element('h3', `${node.kind}: ${node.name || '(unnamed)'}`));
        const edit = (key: 'name' | 'purpose') => this.field(key === 'name' ? 'Name' : 'Purpose / responsibility', node[key], value => {
            const otherIds = this.draft().filter(item => item !== node).map(item => item.id);
            const oldSuggestedId = key === 'name' ? suggestArchitectureId(node.name, otherIds) : '';
            node[key] = value;
            if (key === 'name' && (!node.id || (review && node.id === oldSuggestedId))) node.id = suggestArchitectureId(value, otherIds);
            this.draftChanged();
        }, key === 'purpose');
        target.append(edit('name'), edit('purpose'));
        if (node.kind !== 'system') {
            const label = this.element('label', 'Parent boundary');
            const select = this.element('select');
            for (const parent of this.draft().filter(item => item.kind === (node.kind === 'subsystem' ? 'system' : 'subsystem'))) {
                const option = this.element('option', parent.name || parent.proposalKey);
                option.value = parent.proposalKey; option.selected = parent.proposalKey === node.parentProposalKey;
                select.append(option);
            }
            select.onchange = () => { node.parentProposalKey = select.value; this.draftChanged(); };
            label.append(select); target.append(label);
        }
        target.append(this.element('p', `Implementation roots: ${node.roots.length}${node.roots.length ? ` · ${node.roots.slice(0, 3).join(', ')}${node.roots.length > 3 ? '…' : ''}` : ''}`));
        if (proposal) {
            target.append(this.element('p', `Confidence: ${proposal.confidence.toFixed(2)} · synthesis estimate`));
            target.append(this.element('h4', 'Inferred'));
            if (proposal.rationale) target.append(this.element('p', proposal.rationale));
            if (proposal.evidence.length) {
                const evidence = this.element('ul');
                for (const statement of proposal.evidence) evidence.append(this.element('li', statement));
                target.append(evidence);
            }
            target.append(this.element('h4', 'Observed'));
            for (const ref of proposal.evidenceRefs) {
                const item = review?.packet.items.find(fact => fact.id === ref) ?? this.controller.refinedSources.get(node.proposalKey)?.find(fact => fact.id === ref);
                target.append(this.button(`${item?.kind ?? 'Evidence'} · ${item?.path ?? ref}`, () => item && 'uri' in item ?
                    void open(this.opener, new URI(item.uri)) : void this.openSource(ref)));
            }
        } else if (review) target.append(this.element('p', 'Developer-added boundary.'));
        const docs = review?.packet.documents?.filter(doc =>
            ['modules-seed', 'readme-orientation'].includes(doc.class) || node.roots.some(root => doc.path.startsWith(root.split('/').slice(0, 2).join('/')))).slice(0, 6) ?? [];
        if (docs.length) {
            target.append(this.element('h4', 'Documented'));
            for (const doc of docs) target.append(this.button(`${doc.class} · ${doc.path}`, () => void this.openDocument(doc.path)));
        }
        if (node.kind !== 'component') {
            const search = this.button('Search Deeper', () => {
                if (!this.acceptedDraft) { void this.controller.searchDeeper(node.proposalKey); return; }
                const draft = this.acceptedDraft, fingerprint = this.acceptedFingerprint, request = this.acceptedRequest;
                if (draft && fingerprint) void this.controller.searchDeeper(node.proposalKey, { draft, fingerprint,
                    current: () => !this.isDisposed && request === this.acceptedRequest && draft === this.acceptedDraft &&
                        fingerprint === this.acceptedFingerprint && this.controller.workspace === this.acceptedWorkspace });
            });
            search.classList.add('dope-action-primary');
            search.disabled = !!this.controller.refinementBusyKey || this.controller.setupBusy;
            target.append(search);
            if (this.controller.refinementBusyKey === node.proposalKey) target.append(this.element('p', 'Searching this branch…'));
            if (this.controller.refinementError?.key === node.proposalKey)
                target.append(this.element('p', this.controller.refinementError.message));
            const preview = this.controller.refinementPreview;
            if (preview?.targetKey === node.proposalKey) {
                const section = this.element('section'); section.setAttribute('aria-label', 'Search Deeper preview');
                section.append(this.element('h4', 'Refinement preview · current draft unchanged'));
                const before = preview.branch.map(item => `${item.kind}: ${item.name}`).join(', ');
                const after = preview.proposal.nodes.filter(item => !(preview.targetKind === 'subsystem' && item.kind === 'system'))
                    .map(item => `${item.kind}: ${item.name}`).join(', ');
                section.append(this.element('p', `Current: ${before}`), this.element('p', `Proposed: ${after}`));
                for (const proposed of preview.proposal.nodes.filter(item => !(preview.targetKind === 'subsystem' && item.kind === 'system'))) {
                    section.append(this.element('p', `Inferred: ${proposed.rationale}`));
                    for (const ref of proposed.evidenceRefs) {
                        const item = review?.packet.items.find(fact => fact.id === ref) ?? preview.evidence?.find(fact => fact.id === ref);
                        section.append(this.button(`Observed: ${item?.path ?? ref}`, () => item && 'uri' in item ?
                            void open(this.opener, new URI(item.uri)) : void this.openSource(ref)));
                    }
                }
                section.append(this.button('Accept refinement', () => {
                    if (this.acceptedDraft) {
                        const next = this.controller.acceptRefinement(this.acceptedDraft);
                        if (next) { this.acceptedDraft = next; this.draftChanged(); }
                    } else this.controller.acceptRefinement();
                }),
                    this.button('Reject refinement', () => this.controller.rejectRefinement()));
                target.append(section);
            }
        }
        const advanced = this.element('details');
        advanced.append(this.element('summary', 'Advanced: canonical ID, implementation roots and dependencies'),
            this.field('Canonical ID', node.id, value => { node.id = value; this.draftChanged(); }),
            this.field('Implementation roots (one project-relative path per line)', node.roots.join('\n'), value => {
                node.roots = value.split('\n').map(path => path.trim()).filter(Boolean); this.draftChanged();
            }, true));
        if (node.kind === 'subsystem') for (const field of ['allowedDependencies', 'forbiddenDependencies'] as const) {
            advanced.append(this.field(`${field === 'allowedDependencies' ? 'Allowed' : 'Forbidden'} dependencies (Subsystem IDs, one per line)`,
                node[field]?.join('\n') ?? '', value => {
                    const values = value.split('\n').map(id => id.trim()).filter(Boolean);
                    node[field] = values.length ? values : undefined;
                    this.draftChanged();
                }, true));
        }
        target.append(advanced);
        if (node.kind !== 'component') target.append(this.button(`Add ${node.kind === 'system' ? 'Subsystem' : 'Component'}`, () =>
            this.add(node.kind === 'system' ? 'subsystem' : 'component', node.proposalKey)));
        target.append(this.button(`Remove ${node.kind} and descendants`, () => this.remove(node.proposalKey)));
    }
    private add(kind: ArchitectureReviewNode['kind'], parent: string | null = null): void {
        if (this.acceptedDraft) {
            const key = `draft:${crypto.randomUUID()}`;
            this.acceptedDraft.push({ proposalKey: key, kind, parentProposalKey: parent, id: '', name: '', purpose: '', roots: [] });
            this.selectedKey = key;
            this.draftChanged();
        } else {
            this.controller.add(kind, parent);
            this.selectedKey = this.controller.draft.at(-1)?.proposalKey;
        }
        this.render();
    }
    private remove(key: string): void {
        if (!this.acceptedDraft) { this.controller.remove(key); return; }
        const removed = new Set([key]);
        for (let changed = true; changed;) {
            changed = false;
            for (const node of this.acceptedDraft) if (node.parentProposalKey && removed.has(node.parentProposalKey) && !removed.has(node.proposalKey)) {
                removed.add(node.proposalKey); changed = true;
            }
        }
        this.acceptedDraft = this.acceptedDraft.filter(node => !removed.has(node.proposalKey));
        this.draftChanged();
    }
    private async openSource(ref: string): Promise<void> {
        try {
            const location = await this.controller.reviewSource(ref);
            if (location && !this.isDisposed) await open(this.opener, new URI(location.uri));
        } catch (error) { this.content.append(this.element('p', `Source navigation failed: ${String(error)}`)); }
    }
    private async openDocument(path: string): Promise<void> {
        try {
            const location = await this.controller.reviewDocument(path);
            if (location && !this.isDisposed) await open(this.opener, new URI(location.uri));
        } catch (error) { this.content.append(this.element('p', `Document navigation failed: ${String(error)}`)); }
    }
    protected override onActivateRequest(msg: Message): void { super.onActivateRequest(msg); this.node.focus(); }
    override dispose(): void { ++this.workspaceRequest; this.clearAccepted(); this.listener.dispose(); this.rootsListener.dispose(); super.dispose(); }
}
