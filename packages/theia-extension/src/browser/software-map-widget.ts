import { injectable } from '@theia/core/shared/inversify';
import { CommandRegistry, MenuModelRegistry } from '@theia/core/lib/common';
import { AbstractViewContribution, FrontendApplicationContribution, OpenerService, open } from '@theia/core/lib/browser';
import { BaseWidget, codicon, Message } from '@theia/core/lib/browser/widgets/widget';
import { CommonMenus } from '@theia/core/lib/browser/common-menus';
import URI from '@theia/core/lib/common/uri';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import type { Evidence, GraphNode, GraphRelationship } from '@dope/software-map';
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
    private readonly expanded = new Set<string>();

    constructor(connect: () => SoftwareMapConnection, private readonly workspaces: WorkspaceService, private readonly opener: OpenerService) {
        super();
        this.id = SOFTWARE_MAP_ID;
        this.title.label = 'sMap';
        this.title.caption = 'sMap — Software Map';
        this.title.iconClass = codicon('type-hierarchy');
        this.title.closable = true;
        this.addClass('dope-spike-view');
        this.addClass('dope-smap-view');
        this.node.tabIndex = 0;
        this.controller = new SoftwareMapController(connect, () => this.render());
        const heading = document.createElement('h2');
        heading.textContent = 'Software Map';
        const analyze = this.button('Analyze / Refresh', () => void this.controller.analyze());
        analyze.setAttribute('aria-label', 'Analyze or refresh Software Map');
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.node.append(heading, analyze, this.status, this.tree, this.detail, this.violations);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.controller.attach(); void this.attach(); });
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
    private render(): void {
        if (this.isDisposed) return;
        const focusedNode = (document.activeElement as HTMLElement | null)?.dataset.nodeId;
        const focusedEdge = (document.activeElement as HTMLElement | null)?.dataset.edgeId;
        const model = this.controller;
        const status = model.status;
        this.status.textContent = !model.workspace ? 'Open one local project folder to inspect its Software Map.' :
            model.error ? `Error: ${model.error}` :
            model.loading ? `Analyzing or loading generation ${status?.generation ?? '…'}; previous results hidden.` :
            !status || status.state === 'idle' ? 'Ready to analyze. No derived graph is loaded.' :
            status.state === 'failed' ? `Analysis failed at generation ${status.generation}.` :
            `Generation ${status.publishedGeneration} · ${status.analysis.completeness} · ${model.nodes.length} nodes · ${model.violations.length} violations`;
        this.tree.replaceChildren();
        this.detail.replaceChildren();
        this.violations.replaceChildren();
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
