import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import URI from '@theia/core/lib/common/uri';
import { DocumentsWorkspaceState, type DocumentsMode } from './documents-workspace-state';
import { ProjectDocumentsTree, type ProjectDocumentEntry, type ProjectDocumentListing } from './project-documents-tree';
import { documentFormat, readDocumentPreview, renderDocumentPreview, renderDocumentSource } from './documents-preview';
import { DocumentsEditing } from './documents-editing';
import { projectDocumentsCompare, type CompareFile, type CompareTreeNode, type DocumentsCompare,
    type VerifiedDocumentsCandidate } from './documents-diff';
import type { ChatPanelController } from './chat-panel-controller';

export const DOCUMENTS_WIDGET_ID = 'dope-documents';

/** One optional center viewport. File selection remains presentation only. */
export class DocumentsWidget extends BaseWidget {
    readonly presentation = new DocumentsWorkspaceState();
    private readonly rootsListener;
    private readonly locationListener;
    private readonly filesListener;
    private readonly editing: DocumentsEditing;
    private request = 0;
    private readonly tree = document.createElement('div');
    private readonly content = document.createElement('div');
    private readonly status = document.createElement('p');
    private readonly project = document.createElement('span');
    private readonly mode = document.createElement('span');
    private listing?: ProjectDocumentsTree;
    private readonly folders = new Map<string, ProjectDocumentListing>();
    private readonly expanded = new Set<string>();
    private readonly loading = new Set<string>();
    private readonly folderErrors = new Map<string, string>();
    private activePath?: string;
    private previewRequest = 0;
    private previewText?: string;
    private previewError?: string;
    private previewLoading = false;
    private previewMode: 'preview' | 'source' = 'preview';
    private compare?: DocumentsCompare;
    private reviewOwner?: ChatPanelController;
    private compareView: 'original' | 'proposed' | 'diff' = 'proposed';

    constructor(private readonly workspaces: WorkspaceService, private readonly files: FileService, editors: EditorManager) {
        super();
        this.editing = new DocumentsEditing(files, editors, () => {
            const roots = workspaces.tryGetRoots();
            return roots.length === 1 && roots[0].resource.scheme === 'file' ? roots[0].resource.toString() : undefined;
        }, () => { if (!this.isDisposed) this.render(); });
        this.id = DOCUMENTS_WIDGET_ID;
        this.title.label = this.title.caption = 'Documents';
        this.title.iconClass = codicon('files');
        this.title.closable = true;
        this.addClass('dope-documents');
        this.node.tabIndex = -1;

        const header = document.createElement('header');
        const heading = document.createElement('h2');
        heading.textContent = 'Documents';
        this.project.className = 'dope-documents-project';
        this.mode.className = 'dope-documents-mode';
        header.append(heading, this.project, this.mode);

        const body = document.createElement('div');
        body.className = 'dope-documents-body';
        const sidebar = document.createElement('aside');
        sidebar.setAttribute('aria-label', 'Document paths');
        const treeHeading = document.createElement('h3');
        treeHeading.textContent = 'Files';
        this.tree.className = 'dope-documents-tree';
        this.tree.tabIndex = 0;
        this.tree.setAttribute('role', 'tree');
        this.tree.setAttribute('aria-label', 'Document files');
        this.tree.addEventListener('keydown', event => this.onTreeKeyDown(event));
        sidebar.append(treeHeading, this.tree);

        const main = document.createElement('main');
        main.setAttribute('aria-label', 'Document content');
        this.content.className = 'dope-documents-content';
        this.content.tabIndex = 0;
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        main.append(this.status, this.content);
        body.append(sidebar, main);
        this.node.append(header, body);

        this.rootsListener = workspaces.onWorkspaceChanged(() => { void this.refreshProject(); });
        this.locationListener = workspaces.onWorkspaceLocationChanged(() => { void this.refreshProject(); });
        this.filesListener = files.onDidFilesChange(event => {
            const path = this.editing.activePath;
            const project = this.presentation.selection.projectUri;
            if (path && project && event.contains(new URI(project).resolve(path)))
                this.editing.externalChange(new URI(project).resolve(path));
            const selected = this.presentation.selection.selectedPath;
            if (project && selected && this.presentation.selection.mode === 'explorer' &&
                event.contains(new URI(project).resolve(selected))) void this.loadPreview(selected);
            if (project && this.presentation.selection.mode === 'docs-proposal' && this.compare &&
                this.compare.files.some(file => event.contains(new URI(project).resolve(file.path))))
                void this.recheckCompare();
        });
        void this.refreshProject();
    }

    async refreshProject(): Promise<void> {
        const request = ++this.request;
        this.editing.invalidate();
        ++this.previewRequest;
        this.previewText = undefined;
        this.previewError = undefined;
        this.previewLoading = false;
        this.previewMode = 'preview';
        this.compare = undefined;
        this.reviewOwner = undefined;
        this.listing = undefined;
        this.folders.clear();
        this.expanded.clear();
        this.loading.clear();
        this.folderErrors.clear();
        this.activePath = undefined;
        this.presentation.setStatus('pending');
        this.render();
        try {
            const roots = await this.workspaces.roots;
            if (this.isDisposed || request !== this.request) return;
            if (roots.length > 1) throw new Error('Documents require one project folder; multiple workspace roots are open.');
            const projectUri = roots.length === 1 && roots[0].resource.scheme === 'file' ? roots[0].resource.toString() : undefined;
            this.presentation.setProject(projectUri);
            if (projectUri) {
                this.listing = new ProjectDocumentsTree(this.files, new URI(projectUri));
                await this.loadFolder('', request);
            } else this.presentation.setStatus('empty');
        } catch (error) {
            if (this.isDisposed || request !== this.request) return;
            this.presentation.setProject(undefined);
            this.presentation.setStatus('error', error instanceof Error ? error.message : 'Unable to read the current workspace.');
        }
        this.render();
    }

    private async loadFolder(path: string, request = this.request): Promise<void> {
        if (!this.listing || this.loading.has(path)) return;
        this.loading.add(path);
        this.folderErrors.delete(path);
        this.render();
        try {
            const result = await this.listing.list(path);
            if (this.isDisposed || request !== this.request) return;
            this.folders.set(path, result);
            if (!path && this.presentation.selection.mode === 'explorer') this.presentation.setStatus('ready');
        } catch {
            if (this.isDisposed || request !== this.request) return;
            this.folderErrors.set(path, 'Folder unavailable or access denied.');
            if (!path && this.presentation.selection.mode === 'explorer')
                this.presentation.setStatus('error', 'Project documents unavailable or access denied.');
        } finally {
            if (request === this.request) { this.loading.delete(path); this.render(); }
        }
    }

    private visibleEntries(parent = ''): ProjectDocumentEntry[] {
        const result: ProjectDocumentEntry[] = [];
        for (const entry of this.folders.get(parent)?.entries ?? []) {
            result.push(entry);
            if (entry.directory && this.expanded.has(entry.path)) result.push(...this.visibleEntries(entry.path));
        }
        return result;
    }

    private select(entry: ProjectDocumentEntry): void {
        this.activePath = entry.path;
        if (entry.directory) {
            if (this.expanded.delete(entry.path)) { this.render(); return; }
            this.expanded.add(entry.path);
            if (!this.folders.has(entry.path)) void this.loadFolder(entry.path);
        } else {
            this.presentation.selectExplorer(entry.path);
            this.previewMode = 'preview';
            void this.loadPreview(entry.path);
        }
        this.render();
    }

    private async loadPreview(path: string): Promise<void> {
        const request = ++this.previewRequest;
        const projectUri = this.presentation.selection.projectUri;
        this.previewText = undefined;
        this.previewError = undefined;
        this.previewLoading = true;
        this.render();
        try {
            if (!projectUri) throw new Error('No local project is open.');
            const text = await readDocumentPreview(this.files, new URI(projectUri), path);
            if (this.isDisposed || request !== this.previewRequest ||
                this.presentation.selection.projectUri !== projectUri || this.presentation.selection.selectedPath !== path) return;
            this.previewText = text;
        } catch (error) {
            if (this.isDisposed || request !== this.previewRequest) return;
            this.previewError = error instanceof Error && /too large|binary|UTF-8|linked|Unsafe/u.test(error.message) ?
                error.message : 'Document unavailable or access denied.';
        } finally {
            if (!this.isDisposed && request === this.previewRequest) {
                this.previewLoading = false;
                this.render();
            }
        }
    }

    private onTreeKeyDown(event: KeyboardEvent): void {
        if (this.presentation.selection.mode !== 'explorer') return;
        const entries = this.visibleEntries();
        if (!entries.length) return;
        const index = Math.max(0, entries.findIndex(entry => entry.path === this.activePath));
        const current = entries[index];
        let next: ProjectDocumentEntry | undefined;
        if (event.key === 'ArrowDown') next = entries[Math.min(index + 1, entries.length - 1)];
        else if (event.key === 'ArrowUp') next = entries[Math.max(index - 1, 0)];
        else if (event.key === 'Home') next = entries[0];
        else if (event.key === 'End') next = entries.at(-1);
        else if (event.key === 'ArrowRight' && current.directory) {
            if (!this.expanded.has(current.path)) this.select(current);
            else next = entries[index + 1];
        } else if (event.key === 'ArrowLeft') {
            if (current.directory && this.expanded.has(current.path)) this.select(current);
            else next = entries.find(entry => entry.path === current.path.slice(0, current.path.lastIndexOf('/')));
        } else if (event.key === 'Enter' || event.key === ' ') this.select(current);
        else return;
        event.preventDefault();
        if (next) { this.activePath = next.path; this.render(); }
        this.tree.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    }

    /** Selection can be supplied only after a current owner has verified the same project. */
    showCandidate(mode: Exclude<DocumentsMode, 'explorer'>, projectUri: string, candidateId: string): boolean {
        const selected = this.presentation.selectCandidate(mode, projectUri, candidateId);
        if (selected) { this.compare = undefined; this.render(); }
        return selected;
    }

    /** P6 can hand off only owner-checked proposal state; this view never decides or applies it. */
    showDocumentationCompare(projectUri: string, candidate: VerifiedDocumentsCandidate,
        owner?: ChatPanelController): boolean {
        if (!candidate.proposal || candidate.projectRoot !== decodeURIComponent(new URL(projectUri).pathname) ||
            !this.presentation.selectCandidate('docs-proposal', projectUri, candidate.proposal.id)) return false;
        this.compare = projectDocumentsCompare(candidate);
        this.reviewOwner = owner;
        this.compareView = 'proposed';
        this.presentation.setStatus('ready');
        this.render();
        return true;
    }

    refreshReview(): void {
        if (this.isDisposed || !this.compare) return;
        const { proposalId, digest } = this.compare;
        if (this.reviewOwner && !this.reviewOwner.pending && !this.reviewOwner.running &&
            !this.reviewOwner.currentDocumentationProposal(proposalId, digest))
            this.compare = { ...this.compare, status: 'historical', approvable: false };
        this.render();
    }

    private async recheckCompare(): Promise<void> {
        const owner = this.reviewOwner, compare = this.compare;
        if (!owner || !compare || !compare.approvable) return;
        try {
            const latest = await owner.inspectDocumentationProposal(compare.proposalId, compare.digest);
            if (this.compare === compare && latest.status !== 'applicable') {
                this.compare = projectDocumentsCompare(latest);
                this.render();
            }
        } catch {
            if (this.compare === compare) {
                this.compare = { ...compare, status: 'stale', approvable: false };
                this.render();
            }
        }
    }

    private renderCompareTree(nodes: CompareTreeNode[], depth = 0): void {
        for (const node of nodes) {
            if (node.file) {
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'dope-documents-tree-row';
                row.style.setProperty('--dope-documents-depth', String(depth));
                row.setAttribute('role', 'treeitem');
                row.setAttribute('aria-level', String(depth + 1));
                row.setAttribute('aria-selected', String(this.presentation.selection.selectedPath === node.path));
                row.textContent = `${node.name} · ${node.file.label}`;
                row.title = node.path;
                row.addEventListener('click', () => {
                    const current = this.presentation.selection;
                    if (current.projectUri && current.candidateId) {
                        this.presentation.selectCandidate('docs-proposal', current.projectUri, current.candidateId, node.path);
                        this.presentation.setStatus('ready');
                        this.compareView = 'proposed';
                        this.render();
                    }
                });
                this.tree.append(row);
            } else {
                const folder = document.createElement('div');
                folder.className = 'dope-documents-tree-row';
                folder.style.setProperty('--dope-documents-depth', String(depth));
                folder.textContent = `${node.name}/`;
                folder.setAttribute('role', 'group');
                this.tree.append(folder);
                this.renderCompareTree(node.children, depth + 1);
            }
        }
    }

    private renderCompare(file: CompareFile): void {
        const controls = document.createElement('div');
        controls.className = 'dope-documents-view-controls';
        for (const view of ['original', 'proposed', 'diff'] as const) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = view === 'diff' ? 'Source Diff' : view === 'original' ? 'Original' : 'Proposed';
            button.setAttribute('aria-pressed', String(this.compareView === view));
            button.addEventListener('click', () => { this.compareView = view; this.render(); });
            controls.append(button);
        }
        this.content.append(controls);
        const selected = this.compareView === 'original' ? file.original : file.proposed;
        if (this.compareView !== 'diff' && selected === null) {
            const absent = document.createElement('p');
            absent.textContent = this.compareView === 'original' ? 'Original file absent.' : 'Proposed file absent.';
            this.content.append(absent);
            return;
        }
        const source = document.createElement('pre');
        source.className = 'dope-documents-source dope-documents-compare';
        source.setAttribute('aria-label', `${file.path} ${this.compareView === 'diff' ? 'source diff' : this.compareView}`);
        const rows = this.compareView === 'diff' ? file.sourceDiff :
            this.compareView === 'original' ? file.originalLines : file.proposedLines;
        for (const line of rows) {
            const span = document.createElement('span');
            span.id = line.anchor.replace(/[^a-zA-Z0-9_-]/gu, '-');
            span.dataset.kind = line.kind;
            span.dataset.line = String(line.line);
            span.dataset.side = line.side;
            if (this.compareView === 'diff' && !/[\r\n]$/u.test(line.text)) span.dataset.unterminated = 'true';
            if (this.compareView === 'diff') {
                const marker = document.createElement('span');
                marker.textContent = line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '- ' : '  ';
                marker.setAttribute('aria-label', line.kind);
                span.append(marker);
            }
            span.append(document.createTextNode(line.text));
            source.append(span);
        }
        this.content.append(source);
    }

    private render(): void {
        const state = this.presentation.selection;
        this.project.textContent = state.projectUri ? new URL(state.projectUri).pathname : 'No local project';
        this.mode.textContent = state.mode === 'explorer' ? 'Project docs' :
            state.mode === 'docs-proposal' ? 'Documentation proposal' : 'Prompt stack';
        this.tree.replaceChildren();
        const compare = this.compare;
        if (state.mode === 'docs-proposal' && compare && compare.proposalId === state.candidateId)
            this.renderCompareTree(compare.tree);
        else if (state.mode !== 'explorer') this.tree.textContent = 'Review files will appear here.';
        else if (!state.projectUri) this.tree.textContent = 'Open one local project folder.';
        else if (this.loading.has('')) this.tree.textContent = 'Loading document folders…';
        else if (this.folderErrors.has('')) this.tree.textContent = this.folderErrors.get('')!;
        else {
            const entries = this.visibleEntries();
            if (!this.activePath) this.activePath = entries[0]?.path;
            for (const entry of entries) {
                const row = document.createElement('div');
                row.className = 'dope-documents-tree-row';
                row.setAttribute('role', 'treeitem');
                row.setAttribute('aria-label', entry.path);
                row.setAttribute('aria-level', String(entry.path.split('/').length));
                row.setAttribute('title', entry.path);
                row.tabIndex = entry.path === this.activePath ? 0 : -1;
                row.style.setProperty('--dope-documents-depth', String(entry.path.split('/').length - 1));
                if (entry.directory) row.setAttribute('aria-expanded', String(this.expanded.has(entry.path)));
                else row.setAttribute('aria-selected', String(entry.path === state.selectedPath));
                row.textContent = `${entry.directory ? this.expanded.has(entry.path) ? '▾ ' : '▸ ' : '  '}${entry.name}`;
                row.addEventListener('click', () => { this.select(entry); this.tree.querySelector<HTMLElement>('[tabindex="0"]')?.focus(); });
                this.tree.append(row);
                if (entry.directory && this.expanded.has(entry.path)) {
                    const notice = this.loading.has(entry.path) ? 'Loading…' : this.folderErrors.get(entry.path) ??
                        (this.folders.get(entry.path)?.truncated ? 'Folder limit reached; additional entries are hidden.' :
                            this.folders.get(entry.path)?.entries.length === 0 ? 'No visible documents or folders.' : '');
                    if (notice) {
                        const message = document.createElement('p');
                        message.className = 'dope-documents-tree-notice';
                        message.setAttribute('role', 'status');
                        message.textContent = `${entry.path}: ${notice}`;
                        this.tree.append(message);
                    }
                }
            }
            const root = this.folders.get('');
            if (!entries.length) this.tree.textContent = 'No visible documents or folders. Excluded files are hidden; directory access may be restricted.';
            if (root?.truncated) {
                const message = document.createElement('p');
                message.textContent = 'Folder limit reached; additional entries are hidden.';
                this.tree.append(message);
            }
            if (root?.excluded) {
                const message = document.createElement('p');
                message.textContent = `${root.excluded} non-document, hidden, or unsafe entries excluded.`;
                this.tree.append(message);
            }
        }
        this.status.textContent = state.mode === 'docs-proposal' && this.compare ?
            `${this.compare.status === 'applicable' ? 'Pending · read-only' : `${this.compare.status} · read-only; review unavailable`} · ${
                state.selectedPath ?? `${this.compare.files.length} changed file(s)`}` :
            state.status === 'error' ? state.error ?? 'Documents unavailable' :
            state.status === 'pending' ? 'Loading Documents…' : state.selectedPath ?
                `${state.selectedPath} · ${documentFormat(state.selectedPath)?.toUpperCase() ?? 'Unknown format'} · ${
                    this.editing.activePath === state.selectedPath ? this.editing.dirty ? 'Unsaved changes in editor' : 'Open in editor' : 'Preview'}` :
                state.projectUri ? 'Select a document.' : 'Open one local project folder.';
        if (this.editing.message) this.status.textContent += ` · ${this.editing.message}`;
        if (this.editing.dirty && this.editing.activePath !== state.selectedPath)
            this.status.textContent += ` · Unsaved in editor: ${this.editing.activePath}`;
        this.content.replaceChildren();
        if (state.mode === 'docs-proposal' && compare && compare.proposalId === state.candidateId) {
            const owner = this.reviewOwner;
            if (owner) {
                const actions = document.createElement('div');
                actions.className = 'dope-documents-view-controls';
                for (const [label, action] of [
                    ['Accept', () => owner.applyDocumentationProposal(compare.proposalId, compare.digest)],
                    ['Reject', () => owner.dismissDocumentationProposal(compare.proposalId, 'deny')],
                    ['Revise Proposal', () => { owner.prepareDocumentationRevision(compare.proposalId, compare.digest); }],
                ] as const) {
                    const button = document.createElement('button');
                    button.type = 'button'; button.textContent = label;
                    button.disabled = !owner.canDecideDocumentation(compare.proposalId, compare.digest) ||
                        label === 'Accept' && !compare.approvable;
                    button.addEventListener('click', () => { if (!button.disabled) void action(); });
                    actions.append(button);
                }
                this.content.append(actions);
            }
            const file = compare.files.find(item => item.path === state.selectedPath) ?? compare.files[0];
            if (file) this.renderCompare(file);
            else this.content.textContent = 'No comparable files.';
            return;
        }
        if (state.mode !== 'explorer') { this.content.textContent = 'Review files will appear here.'; return; }
        if (!state.selectedPath) { this.content.textContent = 'Select a document to view its content.'; return; }
        const controls = document.createElement('div');
        controls.className = 'dope-documents-view-controls';
        for (const choice of ['preview', 'source'] as const) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = choice === 'preview' ? 'Preview' : 'Source (read-only)';
            button.setAttribute('aria-pressed', String(this.previewMode === choice));
            button.addEventListener('click', () => { this.previewMode = choice; this.render(); });
            controls.append(button);
        }
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.textContent = 'Source/Edit in editor';
        edit.setAttribute('aria-label', `Edit ${state.selectedPath} in the text editor`);
        edit.addEventListener('click', () => {
            const projectUri = this.presentation.selection.projectUri;
            const path = this.presentation.selection.selectedPath;
            if (this.presentation.selection.mode === 'explorer' && projectUri && path)
                void this.editing.open(projectUri, path);
        });
        controls.append(edit);
        this.content.append(controls);
        if (this.editing.activePath === state.selectedPath) {
            const help = document.createElement('p');
            help.textContent = 'Edit in the text editor. Use Ctrl/Cmd+S to save; its dirty tab, undo, conflict choice and close prompt protect your draft.';
            this.content.append(help);
        }
        if (this.previewLoading) { this.content.append('Loading document…'); return; }
        if (this.previewError) { this.content.append(this.previewError); return; }
        if (this.previewText === undefined) { this.content.append('Select a document to view its content.'); return; }
        this.content.append(this.previewMode === 'source' ? renderDocumentSource(this.previewText) :
            renderDocumentPreview(documentFormat(state.selectedPath) ?? 'txt', this.previewText));
    }

    protected override onActivateRequest(): void { this.node.focus(); }

    override dispose(): void {
        this.request++;
        this.previewRequest++;
        this.rootsListener.dispose();
        this.locationListener.dispose();
        this.filesListener.dispose();
        super.dispose();
    }
}
