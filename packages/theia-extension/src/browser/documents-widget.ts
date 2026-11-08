import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { FileService } from '@theia/filesystem/lib/browser/file-service';
import URI from '@theia/core/lib/common/uri';
import { DocumentsWorkspaceState, type DocumentsMode } from './documents-workspace-state';
import { ProjectDocumentsTree, type ProjectDocumentEntry, type ProjectDocumentListing } from './project-documents-tree';

export const DOCUMENTS_WIDGET_ID = 'dope-documents';

/** One optional center viewport. File selection remains presentation only. */
export class DocumentsWidget extends BaseWidget {
    readonly presentation = new DocumentsWorkspaceState();
    private readonly rootsListener;
    private readonly locationListener;
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

    constructor(private readonly workspaces: WorkspaceService, private readonly files: FileService) {
        super();
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
        void this.refreshProject();
    }

    async refreshProject(): Promise<void> {
        const request = ++this.request;
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
        } else this.presentation.selectExplorer(entry.path);
        this.render();
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
        if (selected) this.render();
        return selected;
    }

    private render(): void {
        const state = this.presentation.selection;
        this.project.textContent = state.projectUri ? new URL(state.projectUri).pathname : 'No local project';
        this.mode.textContent = state.mode === 'explorer' ? 'Project docs' :
            state.mode === 'docs-proposal' ? 'Documentation proposal' : 'Prompt stack';
        this.tree.replaceChildren();
        if (state.mode !== 'explorer') this.tree.textContent = 'Review files will appear here.';
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
        this.status.textContent = state.status === 'error' ? state.error ?? 'Documents unavailable' :
            state.status === 'pending' ? 'Loading Documents…' : state.selectedPath ? `Selected: ${state.selectedPath}` :
                state.projectUri ? 'Select a document.' : 'Open one local project folder.';
        this.content.textContent = state.selectedPath ? `${state.selectedPath} — preview will appear here.` :
            'Select a document to view its content.';
    }

    protected override onActivateRequest(): void { this.node.focus(); }

    override dispose(): void {
        this.request++;
        this.rootsListener.dispose();
        this.locationListener.dispose();
        super.dispose();
    }
}
