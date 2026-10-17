import * as React from '@theia/core/shared/react';
import { inject, injectable } from '@theia/core/shared/inversify';
import { TreeModel, TreeNode, TreeWidget } from '@theia/core/lib/browser';
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
