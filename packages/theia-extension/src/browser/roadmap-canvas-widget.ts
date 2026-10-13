import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { projectRoadmap, type RoadmapProjection } from '@dope/project-intelligence/lib/roadmap-projection';
import type { RoadmapService } from '../roadmap-service';
import type { RoadmapOwnerRecord } from '@dope/project-intelligence/lib/node/roadmap-owner-links';
import type { RoadmapLink } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { PlanningActionRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import type { RoadmapCandidateDiscovery, RoadmapImportPreview } from '@dope/project-intelligence/lib/node/roadmap-import';
import type { RoadmapSyncPreview } from '@dope/project-intelligence/lib/node/roadmap-document-sync';
import { roadmapCanvasOrder, roadmapNextId } from './roadmap-canvas-model';
import { RoadmapInspectorModel } from './roadmap-inspector-model';

export const ROADMAP_CANVAS_ID = 'dope-roadmap-canvas';

/** A single ordinary center tab; it neither owns nor opens a ChatPanel. */
export class RoadmapCanvasWidget extends BaseWidget {
    private readonly status = document.createElement('p');
    private readonly path = document.createElement('ol');
    private readonly toolbar = document.createElement('header');
    private readonly pools = document.createElement('section');
    private readonly importEntry = document.createElement('section');
    private readonly poolFilter = document.createElement('input');
    private owners: RoadmapOwnerRecord[] = [];
    private poolQuery = '';
    private mutating = false;
    private readonly reload = document.createElement('button');
    private readonly details = document.createElement('button');
    private readonly mind = document.createElement('button');
    private readonly rootsListener;
    private readonly modelListener;
    private request = 0;
    private importSerial = 0;
    private syncPreview?: RoadmapSyncPreview;
    private importState?: { uri: string; projectId: string; revision: number; discovery: RoadmapCandidateDiscovery;
        preview?: RoadmapImportPreview; path?: string; busy: boolean; showChooser: boolean; message?: string };
    private projectUri?: string;
    private projection?: RoadmapProjection;
    private selectedId?: string;

    constructor(private readonly service: RoadmapService, private readonly workspaces: WorkspaceService,
        private readonly inspector: RoadmapInspectorModel, private readonly openInspector: () => Promise<unknown>,
        private readonly openMind: (id?: string, workspace?: string) => Promise<boolean> = async () => false) {
        super();
        this.id = ROADMAP_CANVAS_ID;
        this.title.label = this.title.caption = 'Roadmap';
        this.title.iconClass = codicon('milestone');
        this.title.closable = true;
        this.addClass('dope-roadmap-canvas');
        const heading = document.createElement('h2');
        heading.textContent = 'Roadmap';
        this.reload.type = 'button';
        this.reload.textContent = 'Refresh';
        this.reload.setAttribute('aria-label', 'Refresh Roadmap');
        this.reload.onclick = () => { void this.refresh(); };
        this.details.type = 'button';
        this.details.textContent = 'Details';
        this.details.setAttribute('aria-label', 'Show Roadmap details in left sidebar');
        this.details.onclick = () => { void this.openInspector(); };
        this.mind.type = 'button';
        this.mind.textContent = 'Project Mind';
        this.mind.setAttribute('aria-label', 'Browse and edit Project Mind Notes, Ideas, Questions and Decisions');
        this.mind.onclick = () => { void this.openMind().catch(error => {
            this.status.textContent = `Project Mind unavailable: ${String(error)}. Retry from the command palette.`;
        }); };
        this.toolbar.append(heading, this.details, this.mind, this.reload);
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.path.setAttribute('aria-label', 'Roadmap checkpoints');
        this.path.onkeydown = event => this.onPathKey(event);
        this.pools.className = 'dope-roadmap-pools';
        this.pools.setAttribute('aria-label', 'Detached Ideas and Issues');
        this.poolFilter.type = 'search';
        this.poolFilter.setAttribute('aria-label', 'Filter Ideas and Issues');
        this.poolFilter.placeholder = 'Filter Ideas and Issues';
        this.poolFilter.oninput = () => { this.poolQuery = this.poolFilter.value; this.renderPools(); };
        this.importEntry.className = 'dope-roadmap-import';
        this.importEntry.setAttribute('aria-label', 'Roadmap setup');
        this.node.append(this.toolbar, this.status, this.importEntry, this.path, this.pools);
        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.refresh(); });
        this.modelListener = inspector.onChange(() => {
            if (!this.projectUri || inspector.projectUri !== this.projectUri || !inspector.index) return;
            this.selectedId = inspector.selectedId;
            this.projection = projectRoadmap(inspector.index, this.owners, { projectId: inspector.index.projectId, selectedId: this.selectedId });
            this.render();
        });
        void this.refresh();
    }

    async refresh(): Promise<void> {
        const request = ++this.request;
        ++this.importSerial;
        this.importState = undefined;
        this.syncPreview = undefined;
        this.importEntry.replaceChildren();
        this.projection = undefined;
        this.owners = [];
        this.path.replaceChildren();
        this.renderImportEntry();
        this.pools.replaceChildren();
        this.status.textContent = 'Loading Roadmap…';
        try {
            const roots = await this.workspaces.roots;
            if (this.isDisposed || request !== this.request) return;
            if (roots.length !== 1 || roots[0].resource.scheme !== 'file') {
                this.projectUri = undefined;
                this.selectedId = undefined;
                this.status.textContent = 'Open one local project folder to view its Roadmap.';
                this.inspector.setSnapshot(undefined, undefined);
                return;
            }
            const projectUri = roots[0].resource.toString();
            const [index, owners] = await Promise.all([this.service.read(projectUri), this.service.owners(projectUri)]);
            if (this.isDisposed || request !== this.request) return;
            if (this.projectUri !== projectUri) { this.selectedId = undefined; this.poolQuery = ''; this.poolFilter.value = ''; }
            this.owners = owners;
            this.projectUri = projectUri;
            this.inspector.setSnapshot(projectUri, index);
            if (index.revision === 0) this.status.textContent = 'No Roadmap index yet. Import a project Markdown Roadmap to begin.';
            this.projection = projectRoadmap(index, owners, { projectId: index.projectId, selectedId: this.selectedId });
            this.render();
            if (index.linkedDocument) {
                try {
                    const sync = await this.service.previewDocumentSync(projectUri);
                    if (this.isDisposed || request !== this.request || this.projectUri !== projectUri) return;
                    this.syncPreview = sync;
                    this.renderImportEntry();
                } catch (error) {
                    if (this.isDisposed || request !== this.request || this.projectUri !== projectUri) return;
                    this.status.textContent = `Linked Markdown compare failed: ${String(error)}. Review the file and Refresh.`;
                }
            }
        } catch (error) {
            if (this.isDisposed || request !== this.request) return;
            this.status.textContent = `Roadmap unavailable: ${error instanceof Error ? error.message : 'Unable to read Roadmap'}. Use Refresh to retry.`;
            this.inspector.setSnapshot(undefined, undefined);
        }
    }

    private render(): void {
        const projection = this.projection;
        if (!projection) return;
        const nodes = roadmapCanvasOrder(projection);
        if (!nodes.some(node => node.id === this.selectedId)) this.selectedId = undefined;
        this.path.replaceChildren();
        for (const node of nodes) {
            const item = document.createElement('li');
            item.className = `dope-roadmap-${node.lane}`;
            const button = document.createElement('button');
            button.type = 'button';
            button.dataset.checkpointId = node.id;
            button.setAttribute('aria-current', String(node.id === this.selectedId));
            const predecessors = projection.edges.filter(edge => edge.to === node.id)
                .map(edge => projection.nodes.find(candidate => candidate.id === edge.from)?.title ?? edge.from);
            const relation = predecessors.length ? `${node.lane === 'branch' ? 'Branches from' : 'Depends on'} ${predecessors.join(', ')}` : '';
            button.setAttribute('aria-label', `${node.kind}: ${node.title}; ${node.statusLabel}${relation ? `; ${relation}` : ''}`);
            button.tabIndex = node.id === (this.selectedId ?? nodes[0]?.id) ? 0 : -1;
            const kind = document.createElement('small');
            kind.textContent = node.kind;
            const title = document.createElement('strong');
            title.textContent = node.title;
            const state = document.createElement('span');
            state.className = 'dope-roadmap-status';
            state.textContent = node.statusLabel;
            const context = document.createElement('small');
            context.className = 'dope-roadmap-relation';
            context.textContent = relation;
            button.append(kind, title, context, state);
            button.onclick = () => this.select(node.id);
            item.append(button);
            this.path.append(item);
        }
        this.renderPools();
        const diagnostic = projection.diagnostics.length ? ` · ${projection.diagnostics.length} unresolved reference(s)` : '';
        this.status.textContent = projection.revision === 0 ?
            'No Roadmap index yet. Import an existing project Markdown Roadmap to begin.' :
            `${nodes.length} checkpoints · Roadmap revision ${projection.revision}${diagnostic}${this.inspector.index?.linkedDocument ? ` · Linked: ${this.inspector.index.linkedDocument.path} (${this.inspector.index.linkedDocument.syncState})` : ''}`;
    }

    private renderImportEntry(): void {
        this.importEntry.replaceChildren();
        if (!this.projectUri || !this.inspector.index) return;
        const index = this.inspector.index;
        if (index.linkedDocument) {
            const linked = document.createElement('p');
            const sync = this.syncPreview;
            linked.textContent = `Linked Markdown: ${index.linkedDocument.path} · ${sync?.state ?? index.linkedDocument.syncState}`;
            this.importEntry.append(linked);
            if (sync?.state === 'source-changed') {
                const detail = document.createElement('p');
                detail.textContent = sync.changes.length ? sync.changes.slice(0, 12).map(change =>
                    `${change.checkpointId} ${change.field}: ${String(change.accepted ?? 'absent').slice(0, 120)} → ${String(change.source ?? 'absent').slice(0, 120)}`).join('; ') +
                    (sync.changes.length > 12 ? `; ${sync.changes.length - 12} more change(s)` : '') :
                    'Only unsupported Markdown changed; its content will remain untouched.';
                this.importEntry.append(detail);
                const apply = document.createElement('button'); apply.type = 'button'; apply.textContent = 'Apply source changes';
                apply.onclick = () => { void this.applySync(sync); }; this.importEntry.append(apply);
            }
            if (sync && (sync.state === 'conflict' || sync.state === 'relink-needed')) {
                const warning = document.createElement('p'); warning.setAttribute('role', 'alert');
                warning.textContent = `${sync.state === 'relink-needed' ? 'Relink needed' : 'Sync conflict'}: ${sync.diagnostics.concat(sync.changes.filter(change => change.conflict).map(change => `${change.checkpointId} ${change.field}`)).join('; ')}. Review the Markdown and Refresh.`;
                this.importEntry.append(warning);
            }
            return;
        }
        if (index.revision !== 0) return;
        const heading = document.createElement('h3'); heading.textContent = 'Start your Roadmap';
        const actions = document.createElement('div'); actions.className = 'dope-roadmap-import-actions';
        const button = (label: string, action: () => void): HTMLButtonElement => {
            const element = document.createElement('button'); element.type = 'button'; element.textContent = label;
            element.onclick = action; return element;
        };
        const importButton = button('Import Roadmap', () => void this.discoverImport());
        importButton.disabled = !!this.importState?.busy;
        actions.append(importButton,
            button('Plan with Chat', () => { this.showSetupMessage('Open an existing saved Chat from the Chat panel. Roadmap draft planning arrives in P8; Chat stays where you docked it.'); }),
            button('Create Manually', () => { this.showSetupMessage('Manual Roadmap creation arrives in P8. You can import an existing Markdown Roadmap now.'); }));
        this.importEntry.append(heading, actions);
        const state = this.importState;
        if (!state || state.uri !== this.projectUri || state.projectId !== index.projectId) return;
        if (state.message) { const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = state.message; this.importEntry.append(message); }
        if (!state.showChooser) return;
        const chooser = document.createElement('div'); chooser.className = 'dope-roadmap-import-chooser';
        const label = document.createElement('label'); label.textContent = 'Project Markdown file';
        const select = document.createElement('select'); select.setAttribute('aria-label', 'Project Markdown Roadmap');
        const placeholder = document.createElement('option'); placeholder.value = ''; placeholder.textContent = 'Choose a Roadmap file'; select.append(placeholder);
        for (const candidate of state.discovery.candidates) {
            const option = document.createElement('option'); option.value = candidate.path;
            option.textContent = `${candidate.path} (${candidate.bytes} bytes)`; select.append(option);
        }
        select.value = state.path ?? '';
        select.disabled = state.busy;
        select.onchange = () => void this.previewImport(select.value);
        label.append(select);
        const cancel = button('Cancel', () => this.cancelImport());
        chooser.append(label, cancel);
        this.importEntry.append(chooser);
        if (state.discovery.diagnostics.length) this.appendImportDiagnostics('Discovery diagnostics', state.discovery.diagnostics);
        if (!state.discovery.candidates.length) {
            const empty = document.createElement('p'); empty.textContent = 'No supported Markdown candidates found in the project root or docs. Add a ROADMAP.md and refresh this list.';
            this.importEntry.append(empty);
        }
        if (!state.preview) return;
        const preview = state.preview;
        const summary = document.createElement('p');
        const unsupported = preview.diagnostics.filter(item => /unsupported/i.test(item)).length;
        const notGreen = preview.checkpoints.filter(item => item.status === 'not-green').length;
        summary.textContent = `Preview ${preview.roadmapPath}: ${preview.checkpoints.length} checkpoints, ${preview.sources.length} source files, ${unsupported} unsupported section(s), ${notGreen} Not Green checkpoint(s). ${preview.checkpoints.filter(item => item.readOnly).length} read-only checkpoint(s).`;
        this.importEntry.append(summary);
        if (preview.diagnostics.length) this.appendImportDiagnostics('Import diagnostics', preview.diagnostics);
        const caution = preview.checkpoints.flatMap(item => item.diagnostics.map(detail => `${item.title}: ${detail}`));
        if (caution.length) this.appendImportDiagnostics('Checkpoint diagnostics', caution);
        const accept = button('Accept Import', () => void this.acceptImport());
        accept.disabled = state.busy || !preview.checkpoints.length || !preview.checkpoints.some(item => !item.sectionKey.includes('/checklist-'));
        this.importEntry.append(accept);
    }

    private async applySync(preview: RoadmapSyncPreview): Promise<void> {
        const uri = this.projectUri;
        if (!uri || this.syncPreview !== preview) return;
        try {
            await this.service.applyDocumentSync(uri, preview);
            if (this.projectUri === uri) await this.refresh();
        } catch (error) {
            if (this.projectUri === uri) {
                this.status.textContent = `Linked Roadmap sync failed: ${String(error)}. Refresh and review before retrying.`;
                this.syncPreview = undefined;
                this.renderImportEntry();
            }
        }
    }

    private appendImportDiagnostics(title: string, diagnostics: string[]): void {
        const group = document.createElement('details');
        const heading = document.createElement('summary'); heading.textContent = `${title} (${diagnostics.length})`;
        const list = document.createElement('ul');
        for (const diagnostic of diagnostics) { const item = document.createElement('li'); item.textContent = diagnostic; list.append(item); }
        group.append(heading, list); this.importEntry.append(group);
    }

    private showSetupMessage(message: string): void {
        const index = this.inspector.index, uri = this.projectUri;
        if (!index || !uri) return;
        ++this.importSerial;
        this.importState = { uri, projectId: index.projectId, revision: index.revision,
            discovery: this.importState?.discovery ?? { candidates: [], diagnostics: [] }, busy: false, showChooser: false, message };
        this.renderImportEntry();
    }

    private async discoverImport(): Promise<void> {
        const index = this.inspector.index, uri = this.projectUri;
        if (!index || !uri || index.revision !== 0) return;
        const serial = ++this.importSerial;
        this.importState = { uri, projectId: index.projectId, revision: index.revision,
            discovery: { candidates: [], diagnostics: [] }, busy: true, showChooser: false, message: 'Finding project Markdown Roadmaps…' };
        this.renderImportEntry();
        try {
            const discovery = await this.service.discoverImports(uri);
            if (!this.currentImport(serial, uri, index.projectId, index.revision)) return;
            this.importState = { uri, projectId: index.projectId, revision: index.revision, discovery, busy: false, showChooser: true };
            this.renderImportEntry();
            this.importEntry.querySelector<HTMLSelectElement>('select')?.focus();
        } catch (error) { this.importError(serial, `Could not list Roadmaps: ${String(error)}. Refresh and retry.`); }
    }

    private async previewImport(path: string): Promise<void> {
        const state = this.importState;
        if (!state) return;
        const serial = ++this.importSerial;
        this.importState = { ...state, path, preview: undefined, busy: !!path, message: path ? 'Reading import preview…' : undefined };
        this.renderImportEntry();
        if (!path) return;
        try {
            const preview = await this.service.previewImport(state.uri, path);
            if (!this.currentImport(serial, state.uri, state.projectId, state.revision)) return;
            this.importState = { ...this.importState!, preview, busy: false, message: undefined };
            this.renderImportEntry();
            this.importEntry.querySelector<HTMLSelectElement>('select')?.focus();
        } catch (error) { this.importError(serial, `Import preview failed: ${String(error)}. Choose another file or retry.`); }
    }

    private async acceptImport(): Promise<void> {
        const state = this.importState;
        if (!state?.preview || state.busy || !state.preview.checkpoints.length) return;
        const serial = ++this.importSerial;
        this.importState = { ...state, busy: true, message: 'Checking Roadmap revision and source…' };
        this.renderImportEntry();
        try {
            const current = await this.service.read(state.uri);
            if (!this.currentImport(serial, state.uri, state.projectId, state.revision) ||
                current.projectId !== state.projectId || current.revision !== state.revision)
                throw new Error('Roadmap changed. Refresh, choose the file and preview again');
            const result = await this.service.acceptImport(state.uri, state.revision, state.projectId, state.preview);
            if (!this.currentImport(serial, state.uri, state.projectId, state.revision)) return;
            this.inspector.setSnapshot(state.uri, result);
            await this.refresh();
            if (this.projectUri === state.uri && this.inspector.index?.revision === result.revision)
                this.status.textContent = `Imported and linked ${result.linkedDocument?.path ?? state.preview.roadmapPath} · ${result.linkedDocument?.syncState ?? 'no supported sections'}.`;
        } catch (error) { this.importError(serial, `Import was not accepted: ${String(error)}. Refresh and preview again.`); }
    }

    private currentImport(serial: number, uri: string, projectId: string, revision: number): boolean {
        return !this.isDisposed && serial === this.importSerial && this.projectUri === uri &&
            this.inspector.index?.projectId === projectId && this.inspector.index.revision === revision;
    }

    private importError(serial: number, message: string): void {
        if (serial !== this.importSerial || !this.importState) return;
        this.importState = { ...this.importState, busy: false, preview: undefined, message };
        this.renderImportEntry();
    }

    private cancelImport(): void { ++this.importSerial; this.importState = undefined; this.renderImportEntry(); }


    private renderPools(): void {
        const projection = this.projection;
        if (!projection) return;
        const filterFocused = document.activeElement === this.poolFilter;
        const filterSelection = filterFocused ? [this.poolFilter.selectionStart, this.poolFilter.selectionEnd] : undefined;
        this.pools.replaceChildren();
        const heading = document.createElement('h2');
        heading.textContent = 'Unsequenced Ideas and Issues';
        const hint = document.createElement('p');
        hint.textContent = this.selectedId ? 'Link a record to the selected checkpoint. The original record stays with its owner.' :
            'Select a checkpoint above to link an Idea or Issue.';
        this.pools.append(heading, hint, this.poolFilter);
        if (filterFocused) {
            this.poolFilter.focus();
            if (filterSelection && filterSelection[0] !== null && filterSelection[1] !== null)
                this.poolFilter.setSelectionRange(filterSelection[0], filterSelection[1]);
        }
        const query = this.poolQuery.trim().toLocaleLowerCase();
        for (const [label, records] of [['Ideas', projection.pools.ideas], ['Issues', projection.pools.issues]] as const) {
            const group = document.createElement('section');
            const title = document.createElement('h3'); title.textContent = label;
            const list = document.createElement('ul'); list.setAttribute('aria-label', `Detached ${label}`);
            const matches = records.filter(record => !query || `${record.title} ${record.status} ${record.targetId} ${record.provenance}`.toLocaleLowerCase().includes(query));
            for (const record of matches) {
                const item = document.createElement('li');
                const name = document.createElement('strong'); name.textContent = record.title;
                const details = document.createElement('span');
                details.textContent = `${record.status} · ${record.provenance} · ${record.targetId}`;
                const link = document.createElement('button'); link.type = 'button';
                link.textContent = 'Promote / link to selected checkpoint';
                link.setAttribute('aria-label', `Promote or link ${record.title} to selected checkpoint`);
                link.disabled = !this.selectedId || this.mutating || !!this.inspector.selected?.readOnly;
                link.onclick = () => void this.changeLink('link', this.selectedId!, record.owner === 'issue'
                    ? { owner: 'issue', targetId: record.targetId, sourceHash: record.sourceHash }
                    : { owner: 'project-mind', targetId: record.targetId, ownerRevision: record.ownerRevision });
                if (record.owner === 'project-mind') {
                    const open = document.createElement('button'); open.type = 'button';
                    open.textContent = 'Open in Project Mind';
                    open.setAttribute('aria-label', `Open ${record.title} in Project Mind`);
                    open.onclick = () => void this.openMindRecord(record.targetId);
                    item.append(name, details, open, link);
                } else item.append(name, details, link);
                list.append(item);
            }
            if (!matches.length) { const empty = document.createElement('li'); empty.textContent = 'No matching detached records.'; list.append(empty); }
            group.append(title, list); this.pools.append(group);
        }
        const selected = this.inspector.selected;
        if (selected) {
            const linked = document.createElement('section');
            const title = document.createElement('h3'); title.textContent = `Linked to ${selected.title}`;
            const list = document.createElement('ul'); list.setAttribute('aria-label', 'Linked Ideas and Issues');
            for (const link of selected.links.filter(link => link.owner === 'issue' || link.owner === 'project-mind')) {
                const record = this.owners.find(owner => owner.owner === link.owner && owner.targetId === link.targetId);
                const current = record && (record.owner === 'issue' ? record.sourceHash === link.sourceHash : record.ownerRevision === link.ownerRevision);
                const item = document.createElement('li');
                const text = document.createElement('span');
                text.textContent = record ? `${record.title} · ${record.status} · ${current ? 'linked' : 'changed owner reference'}` :
                    `${link.owner} · ${link.targetId} · missing owner reference`;
                const unlink = document.createElement('button'); unlink.type = 'button'; unlink.textContent = 'Unlink';
                unlink.setAttribute('aria-label', `Unlink ${record?.title ?? link.targetId} from ${selected.title}`);
                unlink.disabled = this.mutating || selected.readOnly;
                unlink.onclick = () => void this.changeLink('unlink', selected.id, link);
                if (link.owner === 'project-mind') {
                    const open = document.createElement('button'); open.type = 'button';
                    open.textContent = 'Open in Project Mind';
                    open.setAttribute('aria-label', `Open ${record?.title ?? link.targetId} in Project Mind`);
                    open.onclick = () => void this.openMindRecord(link.targetId);
                    item.append(text, open, unlink);
                } else item.append(text, unlink);
                list.append(item);
            }
            if (!list.childElementCount) { const empty = document.createElement('li'); empty.textContent = 'No linked Ideas or Issues.'; list.append(empty); }
            linked.append(title, list); this.pools.append(linked);
        }
    }

    private async openMindRecord(id: string): Promise<void> {
        const workspace = this.projectUri;
        if (!workspace) return;
        try {
            if (!await this.openMind(id, workspace) && this.projectUri === workspace)
                this.status.textContent = 'Project Mind reference is missing, stale, foreign, or a draft is unsaved. Open Project Mind to inspect or recover.';
        } catch (error) {
            if (this.projectUri === workspace) this.status.textContent = `Project Mind unavailable: ${String(error)}. Refresh and retry.`;
        }
    }

    private async changeLink(type: 'link' | 'unlink', id: string, link: RoadmapLink): Promise<void> {
        const uri = this.projectUri, index = this.inspector.index;
        if (this.mutating || !uri || !index || !index.checkpoints.some(item => item.id === id && !item.readOnly)) return;
        this.mutating = true; this.renderPools();
        let handle: string | undefined;
        try {
            const attached = await this.service.attach(uri);
            handle = attached.projectHandle;
            if (this.projectUri !== uri || attached.snapshot.projectId !== index.projectId || attached.snapshot.revision !== index.revision)
                throw new Error('Roadmap changed. Refresh and retry.');
            const source = index.checkpoints.find(item => item.id === id)?.source;
            const request: PlanningActionRequest = { projectHandle: handle, ownerId: index.projectId,
                expectedRevision: index.revision, sourceHashes: source ? { [id]: source.sha256 } : undefined,
                actions: [{ type, id, link }] };
            const preview = await this.service.preview(request);
            if (this.projectUri !== uri || this.inspector.index?.revision !== index.revision) throw new Error('Roadmap changed. Refresh and retry.');
            if (preview.requiresApproval && !window.confirm(`Unlink ${link.targetId} from ${id}? The original record will remain intact.`)) return;
            const result = await this.service.apply(request, preview.token, preview.requiresApproval);
            if (this.projectUri === uri) {
                this.inspector.setSnapshot(uri, result);
                await this.refresh();
                if (this.projectUri === uri && this.projection?.revision === result.revision)
                    this.status.textContent = `${type === 'link' ? 'Linked' : 'Unlinked'} ${link.targetId}. Original owner record unchanged.`;
            }
        } catch (error) {
            if (this.projectUri === uri) this.status.textContent = `Roadmap link failed: ${error instanceof Error ? error.message : String(error)} Refresh and retry.`;
        } finally {
            if (handle) { try { await this.service.detach(handle); } catch { /* Connection may have closed. */ } }
            this.mutating = false; this.renderPools();
        }
    }

    private select(id: string, focus = false): void {
        if (!this.projection?.nodes.some(node => node.id === id)) return;
        this.selectedId = id;
        this.inspector.select(id);
        this.render();
        if (focus) [...this.path.querySelectorAll<HTMLButtonElement>('button')]
            .find(button => button.dataset.checkpointId === id)?.focus();
    }

    private onPathKey(event: KeyboardEvent): void {
        const target = event.target as HTMLElement;
        const current = target.closest<HTMLButtonElement>('button[data-checkpoint-id]');
        if (!current || !this.path.contains(current)) return;
        const ids = this.projection ? roadmapCanvasOrder(this.projection).map(node => node.id) : [];
        const next = roadmapNextId(ids, current.dataset.checkpointId, event.key);
        if (next === undefined) return;
        event.preventDefault();
        this.select(next, true);
    }

    override dispose(): void { ++this.request; ++this.importSerial; this.rootsListener.dispose(); this.modelListener(); super.dispose(); }
}
