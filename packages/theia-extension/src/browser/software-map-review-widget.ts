import { BaseWidget, codicon, Message } from '@theia/core/lib/browser/widgets/widget';
import { OpenerService, open } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { suggestArchitectureId } from '@dope/software-map';
import type { ArchitectureReviewNode } from '@dope/software-map';
import { SoftwareMapController } from './software-map-controller';
import './dope.css';

export const SOFTWARE_MAP_REVIEW_ID = 'dope-software-map-review';

export class SoftwareMapReviewWidget extends BaseWidget {
    private readonly listener;
    private readonly rootsListener;
    private readonly content = document.createElement('div');
    private selectedKey?: string;
    private workspaceRequest = 0;

    constructor(private readonly controller: SoftwareMapController, private readonly workspaces: WorkspaceService,
        private readonly opener: OpenerService) {
        super();
        this.id = SOFTWARE_MAP_REVIEW_ID;
        this.title.label = this.title.caption = 'sMap Architecture Review';
        this.title.iconClass = codicon('type-hierarchy');
        this.title.closable = true;
        this.addClass('dope-smap-view');
        this.addClass('dope-smap-review');
        this.node.tabIndex = 0;
        this.node.append(this.content);
        this.listener = controller.onChange(() => this.render());
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.attach(); });
        void this.attach();
        this.render();
    }
    private async attach(): Promise<void> {
        const request = ++this.workspaceRequest;
        const roots = await this.workspaces.roots;
        if (this.isDisposed || request !== this.workspaceRequest) return;
        const workspace = roots.length === 1 ? roots[0].resource.toString() : undefined;
        if (workspace !== this.controller.workspace) await this.controller.attach(workspace);
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
    private field(label: string, value: string, update: (value: string) => void, multiline = false): HTMLElement {
        const wrapper = this.element('label', label);
        const input = this.element(multiline ? 'textarea' : 'input');
        input.value = value;
        input.oninput = () => update(input.value);
        wrapper.append(input);
        return wrapper;
    }
    private render(): void {
        if (this.isDisposed) return;
        const focused = this.content.contains(document.activeElement) ? document.activeElement as HTMLElement : undefined;
        const focusedField = focused?.closest('label')?.firstChild?.textContent;
        const focusedButton = focused?.tagName === 'BUTTON' ? focused.textContent : undefined;
        const cursor = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement ? focused.selectionStart : null;
        const advancedOpen = this.content.querySelector<HTMLDetailsElement>('.dope-smap-review-layout details')?.open ?? false;
        const review = this.controller.review;
        if (this.controller.flow !== 'review' || this.controller.initialization?.state !== 'review_required' || !review) {
            this.content.replaceChildren(this.element('h2', 'sMap Architecture Review'),
                this.element('p', 'No architecture review is pending for this project.'));
            this.selectedKey = undefined;
            return;
        }
        const draft = this.controller.draft;
        if (!draft.some(node => node.proposalKey === this.selectedKey)) this.selectedKey = draft[0]?.proposalKey;
        const selected = draft.find(node => node.proposalKey === this.selectedKey);
        const heading = this.element('h2', 'sMap Architecture Review');
        const summary = this.element('p', review.proposal.summary);
        const ambiguity = this.element('p', `${review.proposal.openQuestions.length} open questions · ${review.proposal.unassignedEvidenceRefs.length} unassigned evidence facts`);
        const questions = this.element('details');
        questions.append(this.element('summary', 'Open questions and unassigned evidence'));
        for (const question of review.proposal.openQuestions) questions.append(this.element('p', question));
        for (const ref of review.proposal.unassignedEvidenceRefs) {
            const item = review.packet.items.find(fact => fact.id === ref);
            questions.append(this.button(`${item?.kind ?? 'Evidence'} · ${item?.path ?? ref}`, () => void this.openSource(ref)));
        }
        const coverage = this.element('details');
        coverage.append(this.element('summary', `Source-backed coverage · ${review.coverageLedger?.filter(item => item.status === 'unresolved').length ?? 0} unresolved cues`));
        for (const cue of review.coverageLedger ?? []) {
            const row = this.element('p', `${cue.status}: ${cue.concept} → ${cue.candidateKeys.join(', ') || 'unresolved'}`);
            coverage.append(row);
            for (const ref of cue.evidenceRefs) {
                const item = review.packet.items.find(fact => fact.id === ref);
                coverage.append(this.button(item?.path ?? ref, () => void this.openSource(ref)));
            }
        }
        for (const descent of review.componentDescents ?? []) {
            coverage.append(this.element('p', `${descent.subsystemKey}: ${descent.kind}`));
            for (const ref of descent.evidenceRefs) {
                const item = review.packet.items.find(fact => fact.id === ref);
                coverage.append(this.button(item?.path ?? ref, () => void this.openSource(ref)));
            }
        }
        const layout = this.element('div'); layout.className = 'dope-smap-review-layout';
        const tree = this.element('nav'); tree.setAttribute('aria-label', 'Architecture hierarchy');
        tree.append(this.element('h3', 'Proposed hierarchy'));
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
        const accept = this.button('Accept architecture', () => void this.controller.accept());
        const issues = this.controller.draftDiagnostics();
        validation.append(this.element('p', issues.length ? `Acceptance blocked: ${issues.length} blocker${issues.length === 1 ? '' : 's'}` : 'Review ready for acceptance.'));
        if (issues.length) {
            const list = this.element('ul');
            for (const issue of issues) list.append(this.element('li', `${issue.code}: ${issue.message}${issue.paths.length ? ` · ${issue.paths.join(', ')}` : ''}${issue.proposalKeys.length ? ` · ${issue.proposalKeys.join(', ')}` : ''}`));
            validation.append(list);
        }
        accept.disabled = !!issues.length || this.controller.setupBusy;
        const actions = this.element('div'); actions.className = 'dope-smap-review-actions';
        actions.append(this.button('Add System', () => this.add('system')), validation, accept,
            this.button('Decline review', () => void this.controller.cancel()));
        this.content.replaceChildren(heading, summary, ambiguity, questions, coverage, layout, actions);
        const advanced = this.content.querySelector<HTMLDetailsElement>('.dope-smap-review-layout details');
        if (advanced) advanced.open = advancedOpen;
        if (focusedField) {
            const input = [...this.content.querySelectorAll('label')].find(label => label.firstChild?.textContent === focusedField)?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select');
            input?.focus();
            if (cursor !== null && (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement)) input.setSelectionRange(cursor, cursor);
        }
        else if (focusedButton) [...this.content.querySelectorAll('button')].find(button => button.textContent === focusedButton)?.focus();
    }
    private renderDetail(node: ArchitectureReviewNode, target: HTMLElement): void {
        const proposal = this.controller.refinedEvidence.get(node.proposalKey) ??
            this.controller.review!.proposal.nodes.find(item => item.proposalKey === node.proposalKey);
        target.append(this.element('h3', `${node.kind}: ${node.name || '(unnamed)'}`));
        const edit = (key: 'name' | 'purpose') => this.field(key === 'name' ? 'Name' : 'Purpose / responsibility', node[key], value => {
            const otherIds = this.controller.draft.filter(item => item !== node).map(item => item.id);
            const oldSuggestedId = key === 'name' ? suggestArchitectureId(node.name, otherIds) : '';
            node[key] = value;
            if (key === 'name' && (!node.id || node.id === oldSuggestedId)) node.id = suggestArchitectureId(value, otherIds);
            this.controller.draftChanged();
        }, key === 'purpose');
        target.append(edit('name'), edit('purpose'));
        if (node.kind !== 'system') {
            const label = this.element('label', 'Parent boundary');
            const select = this.element('select');
            for (const parent of this.controller.draft.filter(item => item.kind === (node.kind === 'subsystem' ? 'system' : 'subsystem'))) {
                const option = this.element('option', parent.name || parent.proposalKey);
                option.value = parent.proposalKey; option.selected = parent.proposalKey === node.parentProposalKey;
                select.append(option);
            }
            select.onchange = () => { node.parentProposalKey = select.value; this.controller.draftChanged(); };
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
                const item = this.controller.review!.packet.items.find(fact => fact.id === ref);
                target.append(this.button(`${item?.kind ?? 'Evidence'} · ${item?.path ?? ref}`, () => void this.openSource(ref)));
            }
        } else target.append(this.element('p', 'Developer-added boundary.'));
        const docs = this.controller.review!.packet.documents?.filter(doc =>
            ['modules-seed', 'readme-orientation'].includes(doc.class) || node.roots.some(root => doc.path.startsWith(root.split('/').slice(0, 2).join('/')))).slice(0, 6) ?? [];
        if (docs.length) {
            target.append(this.element('h4', 'Documented'));
            for (const doc of docs) target.append(this.button(`${doc.class} · ${doc.path}`, () => void this.openDocument(doc.path)));
        }
        if (node.kind !== 'component') {
            const search = this.button('Search Deeper', () => void this.controller.searchDeeper(node.proposalKey));
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
                        const item = this.controller.review!.packet.items.find(fact => fact.id === ref);
                        section.append(this.button(`Observed: ${item?.path ?? ref}`, () => void this.openSource(ref)));
                    }
                }
                section.append(this.button('Accept refinement', () => this.controller.acceptRefinement()),
                    this.button('Reject refinement', () => this.controller.rejectRefinement()));
                target.append(section);
            }
        }
        const advanced = this.element('details');
        advanced.append(this.element('summary', 'Advanced: canonical ID and implementation roots'),
            this.field('Canonical ID', node.id, value => { node.id = value; this.controller.draftChanged(); }),
            this.field('Implementation roots (one project-relative path per line)', node.roots.join('\n'), value => {
                node.roots = value.split('\n').map(path => path.trim()).filter(Boolean); this.controller.draftChanged();
            }, true));
        target.append(advanced);
        if (node.kind !== 'component') target.append(this.button(`Add ${node.kind === 'system' ? 'Subsystem' : 'Component'}`, () =>
            this.add(node.kind === 'system' ? 'subsystem' : 'component', node.proposalKey)));
        target.append(this.button(`Remove ${node.kind} and descendants`, () => { this.controller.remove(node.proposalKey); }));
    }
    private add(kind: ArchitectureReviewNode['kind'], parent: string | null = null): void {
        this.controller.add(kind, parent);
        this.selectedKey = this.controller.draft.at(-1)?.proposalKey;
        this.render();
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
    override dispose(): void { ++this.workspaceRequest; this.listener.dispose(); this.rootsListener.dispose(); super.dispose(); }
}
