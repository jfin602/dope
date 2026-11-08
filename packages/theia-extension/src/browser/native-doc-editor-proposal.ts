import { injectable } from '@theia/core/shared/inversify';
import URI from '@theia/core/lib/common/uri';
import { ResourceResolver, type Resource } from '@theia/core/lib/common/resource';
import { DiffUris } from '@theia/core/lib/browser/diff-uris';
import { ApplicationShell, BaseWidget, Widget, Message, codicon } from '@theia/core/lib/browser';
import { MonacoEditorProvider } from '@theia/monaco/lib/browser/monaco-editor-provider';
import type { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { MonacoDiffEditor } from '@theia/monaco/lib/browser/monaco-diff-editor';
import { WorkspaceService } from '@theia/workspace/lib/browser/workspace-service';
import { renderDocumentPreview } from './documents-preview';
import { nativeDocumentModes } from './native-doc-editor-modes';
import { proposalSnapshot, proposalTabKey, ProposalTabSelection, lineEndingComparison,
    type ProposalTabSnapshot, type ProposalViewStatus } from './native-doc-editor-proposal-model';
import type { VerifiedDocumentsCandidate } from './documents-diff';
import type { ChatDocumentationProposal } from '@dope/chat';

export const PROPOSAL_SCHEME = 'dope-doc-proposal';
/** Only registered immutable bytes resolve. The resource has no mutation methods. */
@injectable()
export class ProposalDocumentResources implements ResourceResolver {
    private readonly bytes = new Map<string, { root: string; text: string }>();

    invalidateForeign(root: string | undefined): void {
        for (const [uri, entry] of this.bytes) if (entry.root !== root) this.bytes.delete(uri);
    }

    uris(snapshot: ProposalTabSnapshot): { original: URI; proposed: URI; diff: URI } {
        const key = encodeURIComponent(proposalTabKey(snapshot.identity));
        const path = `/${snapshot.identity.path}`;
        const side = (version: 'original' | 'proposed') => new URI()
            .withScheme(PROPOSAL_SCHEME).withPath(path).withQuery(`${key}&${version}`);
        const original = side('original'), proposed = side('proposed');
        const old = snapshot.original ?? '';
        for (const [uri, text] of [[original, old], [proposed, snapshot.proposed]] as const) {
            const existing = this.bytes.get(uri.toString());
            if (existing && existing.text !== text) throw new Error('Proposal resource identity changed bytes');
            this.bytes.set(uri.toString(), { root: snapshot.identity.root, text });
        }
        return { original, proposed, diff: DiffUris.encode(original, proposed, `${snapshot.identity.path} (Proposal Diff)`) };
    }

    resolve(uri: URI): Resource {
        if (uri.scheme !== PROPOSAL_SCHEME || !this.bytes.has(uri.toString()))
            throw new Error('Unknown proposal resource');
        const text = this.bytes.get(uri.toString())!.text;
        return { uri, readOnly: true, autosaveable: false, dispose: () => undefined,
            readContents: async () => text };
    }
}

/** A main-area tab, with native Monaco source and diff editors but no Saveable or canonical URI. */
export class ProposalDocumentWidget extends BaseWidget {
    readonly snapshot: ProposalTabSnapshot;
    private readonly selection: ProposalTabSelection;
    private readonly body = document.createElement('div');
    private readonly footer = document.createElement('nav');
    private readonly statusNode = document.createElement('p');
    private readonly editors = new Map<'original' | 'proposed' | 'diff', MonacoEditor>();
    private visibleEditor?: MonacoEditor;

    constructor(snapshot: ProposalTabSnapshot, private readonly provider: MonacoEditorProvider,
        private readonly resources: ProposalDocumentResources) {
        super();
        this.snapshot = snapshot;
        this.selection = new ProposalTabSelection(snapshot);
        this.id = `dope-proposal-editor:${proposalTabKey(snapshot.identity)}`;
        this.title.label = snapshot.identity.path.split('/').pop() ?? snapshot.identity.path;
        this.title.iconClass = codicon('diff');
        this.title.caption = `${snapshot.identity.path.split('/').join(' › ')} · ${snapshot.status} · read-only`;
        this.title.closable = true;
        this.addClass('dope-proposal-document-editor');
        this.body.className = 'dope-proposal-editor-body';
        this.footer.className = 'dope-native-document-modes';
        this.footer.setAttribute('aria-label', 'Proposal document view and version');
        this.statusNode.setAttribute('role', 'status');
        this.node.append(this.statusNode, this.body, this.footer);
        this.render();
    }

    invalidate(): void { this.selection.invalidateForProject(undefined); this.render(); }
    setStatus(status: ProposalViewStatus): void {
        if (this.snapshot.status === status) return;
        this.snapshot.status = status;
        this.title.caption = `${this.snapshot.identity.path.split('/').join(' › ')} · ${status} · read-only`;
        this.render();
    }

    async initialize(): Promise<void> {
        const uris = this.resources.uris(this.snapshot);
        const [original, proposed, diff] = await Promise.all([
            this.provider.get(uris.original), this.provider.get(uris.proposed), this.provider.get(uris.diff)]);
        if (this.isDisposed || this.selection.invalid) { original.dispose(); proposed.dispose(); diff.dispose(); return; }
        if (!(diff instanceof MonacoDiffEditor)) {
            original.dispose(); proposed.dispose(); diff.dispose();
            throw new Error('Native Monaco comparison is unavailable');
        }
        diff.diffEditor.updateOptions({ ignoreTrimWhitespace: false, renderIndicators: true });
        this.editors.set('original', original);
        this.editors.set('proposed', proposed);
        this.editors.set('diff', diff);
        this.toDispose.push(original);
        this.toDispose.push(proposed);
        this.toDispose.push(diff);
        this.render();
    }

    private render(): void {
        this.visibleEditor?.handleVisibilityChanged(false);
        this.visibleEditor = undefined;
        this.footer.replaceChildren();
        this.body.replaceChildren();
        this.statusNode.textContent = this.selection.invalid ? 'Wrong project · proposal view unavailable' :
            `${this.snapshot.status} · read-only · ${this.selection.mode === 'diff' ?
                lineEndingComparison(this.snapshot.original, this.snapshot.proposed) :
                this.snapshot.original === null ? 'Original absent (new file)' : 'Original retained'}`;
        if (this.selection.invalid) return;
        const button = (label: string, selected: boolean, action: () => void) => {
            const item = document.createElement('button');
            item.type = 'button'; item.textContent = label;
            item.setAttribute('aria-pressed', String(selected));
            item.addEventListener('click', action); this.footer.append(item);
        };
        for (const mode of nativeDocumentModes(this.snapshot.format, true))
            button(mode[0].toUpperCase() + mode.slice(1), this.selection.mode === mode,
                () => { this.selection.selectMode(mode); this.render(); });
        for (const version of ['original', 'proposed'] as const)
            button(version[0].toUpperCase() + version.slice(1), this.selection.version === version,
                () => { this.selection.selectVersion(version); this.render(); });
        if (this.selection.mode === 'formatted') {
            const formatted = document.createElement('div');
            formatted.className = 'dope-native-document-formatted';
            formatted.tabIndex = 0;
            const text = this.selection.text;
            if (text === null) formatted.textContent = 'Original absent — this is a new file.';
            else if (text.length > 1_000_000) formatted.textContent = 'Document is too large to format.';
            else {
                const view = renderDocumentPreview('md', text);
                formatted.append(view);
            }
            this.body.append(formatted);
        } else if (this.selection.mode === 'source' && this.selection.text === null) {
            this.body.textContent = 'Original absent — this is a new file.';
        } else {
            const editor = this.editors.get(this.selection.mode === 'diff' ? 'diff' : this.selection.version);
            if (editor) {
                this.body.append(editor.node);
                if (this.isAttached && this.isVisible) this.showEditor(editor);
            }
        }
    }

    private showEditor(editor: MonacoEditor): void {
        editor.handleVisibilityChanged(true);
        this.visibleEditor = editor;
        this.resizeEditor(editor);
    }

    private resizeEditor(editor: MonacoEditor): void {
        editor.setSize({ width: this.body.clientWidth, height: this.body.clientHeight });
        editor.refresh();
    }
    protected override onAfterShow(msg: Message): void {
        super.onAfterShow(msg);
        for (const editor of this.editors.values()) if (editor.node.isConnected) this.showEditor(editor);
    }
    protected override onAfterHide(msg: Message): void {
        this.visibleEditor?.handleVisibilityChanged(false);
        this.visibleEditor = undefined;
        super.onAfterHide(msg);
    }
    protected override onResize(msg: Widget.ResizeMessage): void {
        super.onResize(msg);
        for (const editor of this.editors.values()) if (editor.node.isConnected) this.resizeEditor(editor);
    }
}

@injectable()
export class ProposalDocumentTabs {
    constructor(private readonly shell: ApplicationShell, private readonly workspace: WorkspaceService,
        private readonly provider: MonacoEditorProvider, private readonly resources: ProposalDocumentResources) {
        this.workspace.onWorkspaceChanged(() => this.invalidateForeign());
        this.workspace.onWorkspaceLocationChanged(() => this.invalidateForeign());
    }

    private currentRoot(): string | undefined {
        const roots = this.workspace.tryGetRoots();
        return roots.length === 1 && roots[0].resource.scheme === 'file' ? roots[0].resource.path.fsPath() : undefined;
    }
    private invalidateForeign(): void {
        const root = this.currentRoot();
        this.resources.invalidateForeign(root);
        for (const widget of this.shell.mainPanel.widgets())
            if (widget instanceof ProposalDocumentWidget && widget.snapshot.identity.root !== root) widget.invalidate();
    }

    /** The current guarded Docs inspect result supplies retained review bytes. */
    async open(candidate: VerifiedDocumentsCandidate, path: string): Promise<ProposalDocumentWidget> {
        const proposal = candidate.proposal;
        if (!proposal || candidate.status === 'missing' || candidate.projectRoot !== proposal.root)
            throw new Error('Checked proposal bytes are unavailable for this project');
        const status: ProposalViewStatus = candidate.status === 'applicable' ? 'pending' : 'stale';
        return this.openSnapshot(proposalSnapshot(proposal, path, status));
    }

    syncStatus(proposal: ChatDocumentationProposal, activityStatus: string): void {
        const status: ProposalViewStatus = activityStatus === 'pending' ? 'pending' :
            activityStatus === 'applied' ? 'accepted' : activityStatus === 'denied' ? 'rejected' :
            activityStatus === 'superseded' ? 'revised' : activityStatus === 'stale' ? 'stale' :
            activityStatus === 'approved' || activityStatus === 'failed' ? 'partial-recovery' : 'unavailable';
        for (const widget of this.shell.mainPanel.widgets()) {
            if (widget instanceof ProposalDocumentWidget &&
                widget.snapshot.identity.root === proposal.root &&
                widget.snapshot.identity.proposalId === proposal.id &&
                widget.snapshot.identity.digest === proposal.digest && !widget.isDisposed)
                widget.setStatus(status);
        }
    }

    /** Saved Chat history may retain bytes after rejection or recovery; this remains viewing only. */
    async openRetained(proposal: ChatDocumentationProposal, path: string,
        status: Exclude<ProposalViewStatus, 'applicable'>): Promise<ProposalDocumentWidget> {
        return this.openSnapshot(proposalSnapshot(proposal, path, status));
    }

    private async openSnapshot(snapshot: ProposalTabSnapshot): Promise<ProposalDocumentWidget> {
        const root = this.currentRoot();
        if (!root || root !== snapshot.identity.root) throw new Error('Wrong project for proposal tab');
        const id = `dope-proposal-editor:${proposalTabKey(snapshot.identity)}`;
        const existing = Array.from(this.shell.mainPanel.widgets()).find(widget => widget.id === id);
        if (existing instanceof ProposalDocumentWidget) {
            existing.setStatus(snapshot.status);
            await this.shell.activateWidget(existing.id);
            return existing;
        }
        this.resources.uris(snapshot);
        const widget = new ProposalDocumentWidget(snapshot, this.provider, this.resources);
        await widget.initialize();
        if (this.currentRoot() !== root) { widget.dispose(); throw new Error('Project changed while opening proposal tab'); }
        await this.shell.addWidget(widget, { area: 'main' });
        if (this.currentRoot() !== root) { widget.dispose(); throw new Error('Project changed while opening proposal tab'); }
        await this.shell.activateWidget(widget.id);
        return widget;
    }
}
