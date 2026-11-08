import { BaseWidget, codicon } from '@theia/core/lib/browser/widgets/widget';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { DocumentsWorkspaceState, type DocumentsMode } from './documents-workspace-state';

export const DOCUMENTS_WIDGET_ID = 'dope-documents';

/** One optional center viewport. File and candidate adapters are added by later steps. */
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

    constructor(private readonly workspaces: WorkspaceService) {
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
        this.presentation.setStatus('pending');
        this.render();
        try {
            const roots = await this.workspaces.roots;
            if (this.isDisposed || request !== this.request) return;
            const projectUri = roots.length === 1 && roots[0].resource.scheme === 'file' ? roots[0].resource.toString() : undefined;
            this.presentation.setProject(projectUri);
            this.presentation.setStatus('empty');
        } catch {
            if (this.isDisposed || request !== this.request) return;
            this.presentation.setProject(undefined);
            this.presentation.setStatus('error', 'Unable to read the current workspace.');
        }
        this.render();
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
        this.tree.textContent = state.projectUri ? 'Document paths will appear here.' : 'Open one local project folder.';
        this.status.textContent = state.status === 'error' ? state.error ?? 'Documents unavailable' :
            state.status === 'pending' ? 'Loading Documents…' : state.projectUri ? 'No document selected.' : 'Open one local project folder.';
        this.content.textContent = 'Select a document to view its content.';
    }

    protected override onActivateRequest(): void { this.node.focus(); }

    override dispose(): void {
        this.rootsListener.dispose();
        this.locationListener.dispose();
        super.dispose();
    }
}
