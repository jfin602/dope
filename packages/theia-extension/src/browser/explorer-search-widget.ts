import * as React from '@theia/core/shared/react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { ExpandableTreeNode, TreeModel, TreeNode, TreeWidget } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { FileNavigatorWidget } from '@theia/navigator/lib/browser/navigator-widget';
import { WorkspaceSearchFilterService } from '@theia/workspace/lib/browser';
import { FileSearchService } from '@theia/file-search/lib/common/file-search-service';

/** A small file-name filter on the existing navigator, backed by Theia's file search. */
@injectable()
export class ExplorerSearchWidget extends FileNavigatorWidget {
    @inject(FileSearchService) protected readonly fileSearch!: FileSearchService;
    @inject(WorkspaceSearchFilterService) protected readonly searchFilters!: WorkspaceSearchFilterService;

    private query = '';
    private searching = false;
    private matchedNodes = new Set<string>();
    private resultCount = 0;
    private request = 0;
    private timer: ReturnType<typeof setTimeout> | undefined;
    private readonly searchInput = React.createRef<HTMLInputElement>();
    private controlsNode: HTMLDivElement | undefined;
    private creation: { parent: URI; name: string; error: string; busy: boolean;
        submit: (name: string) => Promise<string | undefined> } | undefined;
    private readonly creationInput = React.createRef<HTMLInputElement>();

    /** Show the naming field in the existing Explorer tree, under the chosen directory. */
    async startFileCreation(parent: URI, submit: (name: string) => Promise<string | undefined>): Promise<void> {
        this.clearSearch();
        const node = await this.model.revealFile(parent);
        if (node && ExpandableTreeNode.is(node) && !node.expanded) await this.model.expandNode(node);
        this.creation = { parent, name: '', error: '', busy: false, submit };
        this.updateRows();
    }

    private cancelFileCreation(): void {
        if (!this.creation || this.creation.busy) return;
        this.creation = undefined;
        this.updateRows();
        this.node.focus();
    }

    private async commitFileCreation(): Promise<void> {
        const creation = this.creation;
        if (!creation || creation.busy) return;
        if (!creation.name.trim()) {
            creation.error = 'Enter a file name';
            this.update();
            return;
        }
        creation.busy = true;
        const error = await creation.submit(creation.name);
        if (this.creation !== creation) return;
        creation.busy = false;
        if (error) {
            creation.error = error;
            this.update();
            this.creationInput.current?.focus();
        } else {
            this.creation = undefined;
            this.updateRows();
        }
    }

    protected override doUpdateRows(): void {
        super.doUpdateRows();
        if (!this.creation) return;
        const rows = Array.from(this.rows.entries());
        const parentIndex = rows.findIndex(([, row]) => 'uri' in row.node &&
            (row.node as TreeNode & { uri: URI }).uri.toString() === this.creation?.parent.toString());
        const depth = parentIndex < 0 ? 0 : rows[parentIndex][1].depth + 1;
        const index = parentIndex < 0 ? 0 : parentIndex + 1;
        rows.splice(index, 0, ['dope-inline-new-file', { node: { id: 'dope-inline-new-file', parent: undefined }, index, depth }]);
        this.rows = new Map(rows.map(([id, row], position) => [id, { ...row, index: position }]));
        this.update();
    }

    protected override doRenderNodeRow(row: TreeWidget.NodeRow): React.ReactNode {
        if (row.node.id !== 'dope-inline-new-file' || !this.creation) return super.doRenderNodeRow(row);
        const creation = this.creation;
        return React.createElement('div', {
            className: 'dope-explorer-new-file-row',
            style: { paddingLeft: `${this.getPaddingLeft(row.node, { depth: row.depth })}px` },
            onKeyDown: (event: React.KeyboardEvent) => event.stopPropagation()
        },
        React.createElement('span', { className: 'codicon codicon-new-file', 'aria-hidden': true }),
        React.createElement('div', { className: 'dope-explorer-new-file-field' },
            React.createElement('input', {
                ref: node => { this.creationInput.current = node; if (node && document.activeElement !== node) node.focus(); },
                type: 'text', 'aria-label': 'New file name', 'aria-invalid': !!creation.error,
                'aria-describedby': creation.error ? 'dope-explorer-new-file-error' : undefined,
                value: creation.name, disabled: creation.busy,
                onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
                    creation.name = event.currentTarget.value;
                    creation.error = '';
                    this.update();
                },
                onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => {
                    if (event.key === 'Enter') { event.preventDefault(); void this.commitFileCreation(); }
                    if (event.key === 'Escape') { event.preventDefault(); this.cancelFileCreation(); }
                },
                onBlur: () => { if (!creation.busy) this.cancelFileCreation(); }
            }),
            creation.error ? React.createElement('div', { id: 'dope-explorer-new-file-error', role: 'alert' }, creation.error) : undefined));
    }

    private readonly setControlsNode = (node: HTMLDivElement | null): void => {
        this.controlsNode?.removeEventListener('keydown', this.handleControlKeyDown, true);
        this.controlsNode = node ?? undefined;
        this.controlsNode?.addEventListener('keydown', this.handleControlKeyDown, true);
    };

    private readonly handleControlKeyDown = (event: KeyboardEvent): void => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.key === 'Tab') return;
        // The native navigator handles Enter/Space on its root. Intercept keys in our controls
        // before they reach that listener, so a search action cannot open a selected file.
        event.stopPropagation();
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (target.closest('.dope-explorer-fulltext') && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            void this.commandService.executeCommand('search-in-workspace.open');
        } else if (target.matches('input') && event.key === 'Escape') {
            event.preventDefault();
            this.clearSearch();
        } else if (target.matches('input') && event.key === 'ArrowDown') {
            event.preventDefault();
            this.node.focus();
        }
    };

    protected override init(): void {
        super.init();
        this.addClass('dope-explorer-search');
        this.toDispose.push(this.workspaceService.onWorkspaceChanged(() => this.clearSearch()));
        this.toDispose.push(this.workspaceService.onWorkspaceLocationChanged(() => this.clearSearch()));
        this.toDispose.push({ dispose: () => { if (this.timer) clearTimeout(this.timer); this.request++; } });
        this.toDispose.push({ dispose: () => this.setControlsNode(null) });
    }

    private clearSearch(): void {
        if (this.timer) clearTimeout(this.timer);
        this.request++;
        this.query = '';
        this.searching = false;
        this.resultCount = 0;
        this.matchedNodes.clear();
        this.updateRows();
        this.update();
    }

    private setQuery(value: string): void {
        if (this.timer) clearTimeout(this.timer);
        const request = ++this.request;
        this.query = value;
        this.matchedNodes.clear();
        this.resultCount = 0;
        this.searching = !!value.trim();
        this.updateRows();
        this.update();
        if (this.searching) this.timer = setTimeout(() => { void this.findFiles(value.trim(), request); }, 150);
    }

    private async findFiles(query: string, request: number): Promise<void> {
        const roots = this.workspaceService.tryGetRoots().map(root => root.resource.toString());
        if (!roots.length) { this.searching = false; this.update(); return; }
        try {
            const matches = await this.fileSearch.find(query, {
                rootUris: roots, fuzzyMatch: true, useGitIgnore: true,
                excludePatterns: this.searchFilters.getExclusionGlobs()
            });
            if (request !== this.request) return;
            const ids = new Set<string>();
            let count = 0;
            for (const match of matches) {
                if (request !== this.request) return;
                const uri = new URI(match);
                if (!this.workspaceService.getWorkspaceRootUri(uri)) continue;
                const node = await this.model.revealFile(uri);
                if (request !== this.request) return;
                if (!node) continue;
                count++;
                for (let parent: TreeNode | undefined = node; parent; parent = parent.parent) ids.add(parent.id);
            }
            this.matchedNodes = ids;
            this.resultCount = count;
        } catch {
            // The filter is read-only; leave the normal tree available after a backend error.
            if (request === this.request) this.clearSearch();
            return;
        }
        if (request === this.request) {
            this.searching = false;
            this.updateRows();
            this.update();
        }
    }

    protected override shouldDisplayNode(node: TreeNode): boolean {
        return super.shouldDisplayNode(node) && (!this.query.trim() || this.matchedNodes.has(node.id));
    }

    protected override renderTree(model: TreeModel): React.ReactNode {
        if (this.query.trim() && !this.searching && !this.resultCount) {
            return React.createElement('div', { className: 'dope-explorer-search-empty', role: 'status' }, 'No matching files');
        }
        const tree = super.renderTree(model);
        return React.isValidElement(tree) && tree.type === TreeWidget.View
            ? React.cloneElement(tree as React.ReactElement<{ height: number }>, { height: Math.max(0, this.node.offsetHeight - 38) })
            : tree;
    }

    protected override render(): React.ReactNode {
        return React.createElement(React.Fragment, undefined,
            React.createElement('div', { className: 'dope-explorer-search-controls', ref: this.setControlsNode },
                React.createElement('div', { className: `dope-explorer-search-field${this.query ? ' dope-explorer-search-field-has-query' : ''}` },
                    React.createElement('span', { className: 'codicon codicon-search', 'aria-hidden': true }),
                    React.createElement('input', {
                        ref: this.searchInput, type: 'search', 'aria-label': 'Search files', placeholder: 'Search files...', value: this.query,
                        onChange: (event: React.ChangeEvent<HTMLInputElement>) => this.setQuery(event.currentTarget.value)
                    }),
                    this.query ? React.createElement('button', {
                        className: 'dope-explorer-search-clear', type: 'button', 'aria-label': 'Clear file search', title: 'Clear file search',
                        onClick: () => { this.clearSearch(); this.searchInput.current?.focus(); }
                    }, '×') : undefined,
                    React.createElement('button', {
                        className: 'dope-explorer-fulltext', type: 'button', title: 'Search in files', 'aria-label': 'Search in files',
                        onClick: () => void this.commandService.executeCommand('search-in-workspace.open')
                    }, React.createElement('span', { className: 'codicon codicon-arrow-right', 'aria-hidden': true })))),
            React.createElement('div', { className: 'dope-explorer-search-tree' }, super.render()));
    }
}
