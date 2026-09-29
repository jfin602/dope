import { injectable } from '@theia/core/shared/inversify';
import { CommandRegistry, MenuModelRegistry } from '@theia/core/lib/common';
import { AbstractViewContribution, FrontendApplicationContribution, OpenerService, open } from '@theia/core/lib/browser';
import { BaseWidget, codicon, Message } from '@theia/core/lib/browser/widgets/widget';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import URI from '@theia/core/lib/common/uri';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { StorageService } from '@theia/core/lib/browser/storage-service';
import type { ArchitectureEvidenceItem, Evidence, GraphNode, GraphRelationship } from '@dope/software-map';
import { SoftwareMapConnection, SoftwareMapController } from './software-map-controller';
import './dope.css';

export const SOFTWARE_MAP_ID = 'dope-software-map';

export class SoftwareMapWidget extends BaseWidget {
    readonly controller: SoftwareMapController;
    private readonly rootsListener;
    private workspaceRequest = 0;
    private readonly status = document.createElement('p');
    private readonly tree = document.createElement('section');
    private readonly detail = document.createElement('section');
    private readonly violations = document.createElement('section');
    private readonly controls = document.createElement('section');
    private readonly expanded = new Set<string>();

    constructor(connect: () => SoftwareMapConnection, private readonly workspaces: WorkspaceService, private readonly opener: OpenerService,
        preferences?: StorageService) {
        super();
        this.id = SOFTWARE_MAP_ID;
        this.title.label = 'sMap';
        this.title.caption = 'sMap — Software Map';
        this.title.iconClass = codicon('type-hierarchy');
        this.title.closable = true;
        this.addClass('dope-spike-view');
        this.addClass('dope-smap-view');
        this.node.tabIndex = 0;
        this.controller = new SoftwareMapController(connect, () => this.render(), preferences);
        const heading = document.createElement('h2');
        heading.textContent = 'Software Map';
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.node.append(heading, this.status, this.controls, this.tree, this.detail, this.violations);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.attach(); });
        void this.attach();
    }
    private button(label: string, action: () => void): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.onclick = action;
        return button;
    }
    private async attach(): Promise<void> {
        const request = ++this.workspaceRequest;
        const roots = await this.workspaces.roots;
        if (this.isDisposed || request !== this.workspaceRequest) return;
        const workspace = roots.length === 1 ? roots[0].resource.toString() : undefined;
        if (workspace !== this.controller.workspace) await this.controller.attach(workspace);
    }
    private element<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string): HTMLElementTagNameMap[K] {
        const element = document.createElement(tag);
        if (text !== undefined) element.textContent = text;
        return element;
    }
    private field(label: string, value: string, change: (value: string) => void, multiline = false, secret = false): HTMLElement {
        const wrapper = this.element('label', label);
        const input = multiline ? this.element('textarea') : this.element('input');
        if (input instanceof HTMLInputElement && secret) input.type = 'password';
        input.value = value;
        input.oninput = () => change(input.value);
        wrapper.append(input);
        return wrapper;
    }
    private renderOnboarding(): void {
        const model = this.controller;
        this.controls.replaceChildren();
        if (!model.workspace || !model.initialization) return;
        if (model.initialization.state === 'initialized') {
            this.controls.append(this.button('Refresh Software Map', () => void model.analyze()));
            return;
        }
        if (model.flow === 'none') {
            this.controls.append(this.button('Analyze Project', () => model.begin()));
            this.controls.append(this.element('p', 'Software Map is uninitialized. Analyze Project is available whenever you are ready.'));
        } else if (model.flow === 'offer') {
            this.controls.append(this.element('h3', 'Analyze Project?'), this.element('p', 'Choose local synthesis, an existing declaration, or manual architecture.'));
            const setup = this.button('Set up local synthesis', () => void model.setup());
            setup.disabled = model.setupBusy;
            this.controls.append(setup);
            if (model.initialization.declarationPresent) {
                const existing = this.button('Use existing architecture', () => void model.useExisting());
                existing.disabled = model.setupBusy;
                this.controls.append(existing);
            }
            this.controls.append(this.button('Define architecture manually', () => model.manual()), this.button('Not now', () => model.decline()));
        } else if (model.flow === 'setup') this.renderSetup();
        else if (model.flow === 'review') this.renderReview();
        else if (model.flow === 'manual') this.renderDraft('Manual architecture');
    }
    private renderSetup(): void {
        const model = this.controller;
        this.controls.append(this.element('h3', 'Local synthesis setup'),
            this.element('p', 'LM Studio compatible endpoint. Discovery and capability probing use no project evidence.'));
        this.controls.append(this.field('Endpoint', model.endpoint, value => model.changeEndpoint(value)));
        this.controls.append(this.field('Optional session token', model.token, value => model.changeToken(value), false, true));
        this.controls.append(this.button('Discover models', () => void model.discover()));
        const label = this.element('label', 'Model');
        const select = this.element('select');
        for (const id of model.models) {
            const option = this.element('option', id);
            option.value = id;
            option.selected = id === model.model;
            select.append(option);
        }
        select.onchange = () => model.changeModel(select.value);
        label.append(select);
        this.controls.append(label);
        const probe = this.button('Run structured-output capability probe', () => void model.probe());
        probe.disabled = model.setupBusy || !model.model;
        this.controls.append(probe, this.element('p', model.setupReady ? 'Structured-output probe passed. Model ready.' :
            model.setupBusy ? 'Checking local model…' : 'Run the probe before analysis.'));
        const start = this.button('Analyze Project with selected model', () => void model.synthesize());
        start.disabled = !model.setupReady || model.setupBusy;
        const cancel = this.button('Cancel', () => void model.cancel());
        this.controls.append(start, cancel);
    }
    private renderReview(): void {
        const review = this.controller.review;
        if (!review) return;
        this.controls.append(this.element('h3', 'Review proposed architecture'), this.element('p', review.proposal.summary));
        const byKey = new Map(review.proposal.nodes.map(node => [node.proposalKey, node]));
        const facts = new Map(review.packet.items.map(item => [item.id, item]));
        const list = this.element('ul');
        const render = (parent: string | null, target: HTMLUListElement) => {
            for (const draft of this.controller.draft.filter(node => node.parentProposalKey === parent)) {
                const proposal = byKey.get(draft.proposalKey);
                const row = this.element('li');
                row.append(this.element('h4', `${draft.kind}: ${draft.name || '(unnamed)'}`), this.element('p', draft.purpose));
                if (proposal) {
                    row.append(this.element('p', `Confidence: ${proposal.confidence.toFixed(2)} (synthesis confidence, not probability)`),
                        this.element('p', `Rationale: ${proposal.rationale}`), this.element('h4', 'Model explanation'));
                    for (const statement of proposal.evidence) row.append(this.element('p', statement));
                    row.append(this.element('h4', 'Source-backed evidence'));
                    for (const ref of proposal.evidenceRefs) this.renderPacketFact(ref, facts.get(ref), row);
                } else row.append(this.element('p', 'Developer-added boundary; no model evidence.'));
                const children = this.element('ul'); render(draft.proposalKey, children);
                row.append(children); target.append(row);
            }
        };
        render(null, list);
        this.controls.append(list, this.element('h4', 'Open questions'));
        if (review.proposal.openQuestions.length) {
            const questions = this.element('ul');
            for (const question of review.proposal.openQuestions) questions.append(this.element('li', question));
            this.controls.append(questions);
        } else this.controls.append(this.element('p', 'None reported.'));
        this.controls.append(this.element('h4', 'Unassigned source-backed evidence'));
        if (!review.proposal.unassignedEvidenceRefs.length) this.controls.append(this.element('p', 'None reported.'));
        for (const ref of review.proposal.unassignedEvidenceRefs) this.renderPacketFact(ref, facts.get(ref), this.controls);
        this.renderDraft('Correct and accept architecture');
    }
    private renderPacketFact(ref: string, item: ArchitectureEvidenceItem | undefined, target: HTMLElement): void {
        if (!item) { target.append(this.element('p', `Unavailable packet fact ${ref}`)); return; }
        const fact = this.element('div');
        fact.className = 'dope-smap-fact';
        fact.append(this.element('p', `${item.kind} · ${item.path} · ${ref}`),
            this.element('small', `Deterministic fact: ${JSON.stringify(item)} · source evidence IDs: ${item.sourceEvidenceIds.join(', ') || 'none'}`));
        fact.append(this.button(`Open source for ${ref}`, () => void this.openReviewSource(ref)));
        target.append(fact);
    }
    private async openReviewSource(ref: string): Promise<void> {
        try {
            const location = await this.controller.reviewSource(ref);
            if (location && !this.isDisposed) await open(this.opener, new URI(location.uri));
        } catch (error) { this.status.textContent = `Source navigation failed: ${String(error)}`; }
    }
    private renderDraft(title: string): void {
        const model = this.controller;
        const editor = this.element('section');
        editor.append(this.element('h3', title));
        const validation = this.element('p');
        validation.setAttribute('role', 'status');
        const accept = this.button('Accept architecture', () => void model.accept());
        const refreshValidation = () => { const error = model.draftError(); validation.textContent = error ? `Cannot accept: ${error}` : 'Canonical architecture is valid.'; accept.disabled = !!error || model.setupBusy; };
        for (const node of model.draft) {
            const row = this.element('fieldset');
            row.append(this.element('legend', `${node.kind}: ${node.name || '(unnamed)'}`));
            const edit = (key: 'id' | 'name' | 'purpose', label: string) => this.field(label, node[key], value => { node[key] = value; refreshValidation(); });
            row.append(edit('id', 'Canonical ID'), edit('name', 'Name'), edit('purpose', 'Purpose'));
            if (node.kind !== 'system') {
                const label = this.element('label', 'Parent boundary');
                const select = this.element('select');
                select.setAttribute('aria-label', `${node.kind} parent for ${node.name || node.proposalKey}`);
                for (const parent of model.draft.filter(item => item.kind === (node.kind === 'subsystem' ? 'system' : 'subsystem'))) {
                    const option = this.element('option', `${parent.name || parent.proposalKey} (${parent.id || 'no ID'})`);
                    option.value = parent.proposalKey;
                    option.selected = parent.proposalKey === node.parentProposalKey;
                    select.append(option);
                }
                select.onchange = () => { node.parentProposalKey = select.value; refreshValidation(); };
                label.append(select); row.append(label);
            }
            row.append(this.field('Implementation roots (one project-relative path per line)', node.roots.join('\n'), value => {
                node.roots = value.split('\n').map(path => path.trim()).filter(Boolean); refreshValidation();
            }, true));
            if (node.kind !== 'component') row.append(this.button(`Add ${node.kind === 'system' ? 'subsystem' : 'component'} under ${node.name || node.proposalKey}`,
                () => model.add(node.kind === 'system' ? 'subsystem' : 'component', node.proposalKey)));
            row.append(this.button(`Remove ${node.kind} ${node.name || node.proposalKey} and its children`, () => model.remove(node.proposalKey)));
            editor.append(row);
        }
        const cancel = this.button('Cancel', () => void model.cancel());
        cancel.disabled = model.setupBusy;
        editor.append(this.button('Add system', () => model.add('system')), validation, accept, cancel);
        this.controls.append(editor);
        refreshValidation();
    }
    private render(): void {
        if (this.isDisposed) return;
        const focusedControl = this.controls.contains(document.activeElement) ? (document.activeElement as HTMLElement) : undefined;
        const focusedLabel = focusedControl?.closest('label')?.firstChild?.textContent;
        const focusedButton = focusedControl?.tagName === 'BUTTON' ? focusedControl.textContent : undefined;
        const focusedNode = (document.activeElement as HTMLElement | null)?.dataset.nodeId;
        const focusedEdge = (document.activeElement as HTMLElement | null)?.dataset.edgeId;
        const model = this.controller;
        const status = model.status;
        this.status.textContent = !model.workspace ? 'Open one local project folder to inspect its Software Map.' :
            model.error ? `Error: ${model.error}` :
            model.loading ? `Analyzing or loading generation ${status?.generation ?? '…'}; previous results hidden.` :
            model.initialization?.state !== 'initialized' ? model.setupBusy ? 'Software Map initialization in progress.' : 'Software Map is uninitialized.' :
            !status || status.state === 'idle' ? 'Ready to refresh. No derived graph is loaded.' :
            status.state === 'failed' ? `Analysis failed at generation ${status.generation}.` :
            `Generation ${status.publishedGeneration} · ${status.analysis.completeness} · ${model.nodes.length} nodes · ${model.violations.length} violations`;
        this.tree.replaceChildren();
        this.detail.replaceChildren();
        this.violations.replaceChildren();
        this.renderOnboarding();
        if (focusedButton) [...this.controls.querySelectorAll('button')].find(button => button.textContent === focusedButton)?.focus();
        else if (focusedLabel) [...this.controls.querySelectorAll('label')].find(label => label.firstChild?.textContent === focusedLabel)?.querySelector<HTMLElement>('input, textarea, select')?.focus();
        if (model.initialization?.state !== 'initialized') return;
        if (status?.analysis.errors.length) {
            const diagnostics = this.element('section');
            diagnostics.append(this.element('h3', 'Diagnostics'));
            for (const error of status.analysis.errors) diagnostics.append(this.element('p', `${error.producer}: ${error.code} — ${error.path ? `${error.path}: ` : ''}${error.message}`));
            this.tree.append(diagnostics);
        }
        if (model.loading || status?.state !== 'ready' || status.generation !== status.publishedGeneration) return;
        if (status.declarationPresent === false) this.tree.append(this.element('p', 'No .dope/architecture.json declaration. Analyzed implementation remains unassigned.'));
        if (status.analysis.completeness === 'partial') this.tree.append(this.element('p', 'Partial analysis: inspect diagnostics before relying on this graph.'));
        const nodes = model.nodes;
        const children = new Map<string, GraphNode[]>();
        for (const node of nodes) {
            const parent = node.parentId ?? '';
            const group = children.get(parent) ?? [];
            group.push(node);
            children.set(parent, group);
        }
        for (const group of children.values()) group.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
        const renderNode = (node: GraphNode): HTMLElement => {
            const row = this.element('li');
            const descendants = children.get(node.id) ?? [];
            const button = this.button(`${node.name} · ${node.kind}${node.kind === 'code' ? ` · ${node.codeKind}` : ''}`, () => void model.select(node.id));
            button.dataset.nodeId = node.id;
            button.setAttribute('aria-current', String(model.selectedId === node.id));
            if (descendants.length) {
                const details = this.element('details');
                details.open = node.kind !== 'code' || this.expanded.has(node.id);
                details.ontoggle = () => details.open ? this.expanded.add(node.id) : this.expanded.delete(node.id);
                const summary = this.element('summary');
                summary.append(button);
                details.append(summary, list(descendants));
                row.append(details);
            } else row.append(button);
            return row;
        };
        const list = (items: GraphNode[]): HTMLUListElement => {
            const ul = this.element('ul');
            for (const item of items) ul.append(renderNode(item));
            return ul;
        };
        this.tree.append(this.element('h3', 'Architecture'));
        const systems = nodes.filter(node => node.kind === 'system');
        this.tree.append(systems.length ? list(systems) : this.element('p', 'No declared Systems.'));
        const unassigned = nodes.filter(node => node.kind === 'code' && node.ownership.state === 'unassigned' && !nodes.some(parent => parent.id === node.parentId && parent.kind === 'code'));
        this.tree.append(this.element('h3', `Unassigned / unknown implementation (${unassigned.length} roots)`));
        if (unassigned.length) this.tree.append(list(unassigned));
        else this.tree.append(this.element('p', nodes.length ? 'No unassigned code roots.' : 'No implementation found.'));
        if (model.selectedId) this.renderNodeDetail(nodes.find(node => node.id === model.selectedId));
        if (model.selectedViolation) this.renderViolationDetail();
        this.violations.append(this.element('h3', `Architecture violations (${model.violations.length})`));
        if (!model.violations.length) this.violations.append(this.element('p', 'No declared dependency violations found.'));
        for (const violation of model.violations) {
            this.violations.append(this.button(`${violation.rule}: ${violation.sourceSubsystemId} → ${violation.targetSubsystemId} (${violation.originRelationshipIds.length} physical edges)`,
                () => void model.selectViolation(violation)));
        }
        if (focusedNode) [...this.tree.querySelectorAll<HTMLButtonElement>('button[data-node-id]')].find(button => button.dataset.nodeId === focusedNode)?.focus();
        if (focusedEdge) [...this.detail.querySelectorAll<HTMLButtonElement>('button[data-edge-id]')].find(button => button.dataset.edgeId === focusedEdge)?.focus();
    }
    private renderNodeDetail(node?: GraphNode): void {
        if (!node) return;
        this.detail.append(this.element('h3', node.name), this.element('p', `${node.kind} · ${node.id}`));
        if ('purpose' in node) this.detail.append(this.element('p', node.purpose));
        if (node.kind === 'code') {
            const owner = node.ownership;
            this.detail.append(this.element('p', `Source: ${node.path}${node.symbol ? ` · ${node.symbol}` : ''}`),
                this.element('p', `Ownership: ${owner.state}${owner.systemId ? ` · ${owner.systemId}` : ''}${owner.subsystemId ? ` / ${owner.subsystemId}` : ''}${owner.componentId ? ` / ${owner.componentId}` : ''}`));
        }
        this.renderEdges('Outgoing dependencies / relationships', this.controller.outgoing);
        this.renderEdges('Incoming dependencies / relationships', this.controller.incoming);
        this.renderEvidence(this.controller.evidence.filter(item => node.evidenceIds.includes(item.id)));
    }
    private renderViolationDetail(): void {
        const violation = this.controller.selectedViolation!;
        this.detail.append(this.element('h3', `Violation: ${violation.rule}`),
            this.element('p', `Rule ${violation.rule}: ${violation.sourceSubsystemId} → ${violation.targetSubsystemId}`),
            this.element('h4', 'Offending physical edges'));
        this.renderEdges('Source relationships', this.controller.offending);
        this.renderEvidence(this.controller.evidence);
    }
    private renderEdges(label: string, edges: GraphRelationship[]): void {
        this.detail.append(this.element('h4', `${label} (${edges.length})`));
        for (const edge of edges) {
            const source = this.controller.nodes.find(item => item.id === edge.sourceId)?.name ?? edge.sourceId;
            const target = this.controller.nodes.find(item => item.id === edge.targetId)?.name ?? edge.targetId;
            const row = this.element('div');
            row.className = 'dope-smap-edge';
            row.append(this.element('p', `${edge.originRelationshipIds?.length ? 'Aggregated' : 'Direct'} ${edge.kind}: ${source} → ${target}${edge.originRelationshipIds?.length ? ` · ${edge.originRelationshipIds.length} physical edges` : ''}`));
            this.renderEvidence(this.controller.evidence.filter(item => edge.evidenceIds.includes(item.id)), row);
            if (edge.originRelationshipIds?.length) {
                const show = this.button('Show originating physical edges', () => void this.controller.origins(edge));
                show.dataset.edgeId = edge.id;
                row.append(show);
                if (this.controller.selectedAggregateId === edge.id) {
                    row.append(this.element('h4', `Originating physical edges (${this.controller.originEdges.length})`));
                    for (const origin of this.controller.originEdges) {
                        const from = this.controller.nodes.find(item => item.id === origin.sourceId);
                        const to = this.controller.nodes.find(item => item.id === origin.targetId);
                        row.append(this.element('p', `${origin.kind}: ${from?.name ?? origin.sourceId} → ${to?.name ?? origin.targetId}`));
                        this.renderEvidence(this.controller.originEvidence.filter(item => origin.evidenceIds.includes(item.id)), row);
                    }
                }
            }
            this.detail.append(row);
        }
    }
    private renderEvidence(items: Evidence[], target: HTMLElement = this.detail): void {
        for (const item of items) {
            const label = `${item.class} · ${item.path ?? item.producer}${item.span?.line ? `:${item.span.line}${item.span.column ? `:${item.span.column}` : ''}` : ''} · ${item.producer}`;
            target.append(this.button(label, () => void this.openEvidence(item)));
        }
    }
    private async openEvidence(item: Evidence): Promise<void> {
        try {
            const location = await this.controller.source(item.id);
            if (!location || this.isDisposed) return;
            await open(this.opener, new URI(location.uri), location.span?.line ? { selection: { start: { line: location.span.line - 1, character: (location.span.column ?? 1) - 1 } } } : undefined);
        } catch (error) { this.status.textContent = `Source navigation failed: ${String(error)}`; }
    }
    protected override onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
    }
    override dispose(): void {
        ++this.workspaceRequest;
        this.rootsListener.dispose();
        this.controller.dispose();
        super.dispose();
    }
}

@injectable()
export class SoftwareMapView extends AbstractViewContribution<SoftwareMapWidget> implements FrontendApplicationContribution {
    constructor() { super({ widgetId: SOFTWARE_MAP_ID, widgetName: 'sMap', defaultWidgetOptions: { area: 'left', rank: 200 } }); }
    async onDidInitializeLayout(): Promise<void> {
        // Add the Activity Bar entry without activating it or moving a restored user layout.
        await this.openView();
    }
    override registerCommands(commands: CommandRegistry): void {
        super.registerCommands(commands);
        commands.registerCommand({ id: 'dope.softwareMap.open', label: 'Dope: Show Software Map' }, { execute: () => this.openView({ activate: true }) });
    }
    override registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction(CommonMenus.VIEW_VIEWS, { commandId: 'dope.softwareMap.open', label: 'Software Map' });
    }
}
