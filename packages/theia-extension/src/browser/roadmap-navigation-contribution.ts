import { inject, injectable } from '@theia/core/shared/inversify';
import { ApplicationShell, FrontendApplicationContribution, WidgetFactory, WidgetManager } from '@theia/core/lib/browser';
import { CommandRegistry } from '@theia/core/lib/common';
import { Widget } from '@theia/core/shared/@lumino/widgets';
import { EXPLORER_VIEW_CONTAINER_ID } from '@theia/navigator/lib/browser/navigator-widget-factory';
import { SEARCH_VIEW_CONTAINER_ID } from '@theia/search-in-workspace/lib/browser/search-in-workspace-factory';
import { ROADMAP_CANVAS_ID } from './roadmap-canvas-widget';

export const ROADMAP_LAUNCHER_ID = 'dope-roadmap-activity-launcher';

/** The side bar icon delegates to the single existing center-editor Roadmap. */
export class RoadmapActivityLauncher extends Widget {
    constructor(private readonly openRoadmap: () => Promise<void>) {
        super();
        this.id = ROADMAP_LAUNCHER_ID;
        this.title.label = 'Roadmap';
        this.title.caption = 'Roadmap';
        this.title.iconClass = 'codicon codicon-milestone';
        this.title.className = 'dope-roadmap-launcher';
        this.node.setAttribute('aria-label', 'Roadmap');
    }

    protected override onActivateRequest(): void {
        void this.openRoadmap();
    }
}

@injectable()
export class RoadmapNavigationContribution implements FrontendApplicationContribution {
    @inject(ApplicationShell) private readonly shell!: ApplicationShell;
    @inject(WidgetManager) private readonly widgets!: WidgetManager;
    @inject(CommandRegistry) private readonly commands!: CommandRegistry;

    async initializeLayout(): Promise<void> {
        const launcher = await this.widgets.getOrCreateWidget<RoadmapActivityLauncher>(ROADMAP_LAUNCHER_ID);
        if (!launcher.isAttached) await this.shell.addWidget(launcher, { area: 'left', rank: 200 });
    }

    async onDidInitializeLayout(): Promise<void> {
        // Old saved layouts may still contain the Search view in the Activity Bar.
        const search = this.widgets.tryGetWidget(SEARCH_VIEW_CONTAINER_ID);
        if (search && this.shell.getAreaFor(search) === 'left') await this.shell.addWidget(search, { area: 'bottom' });
        const launcher = await this.widgets.getOrCreateWidget<RoadmapActivityLauncher>(ROADMAP_LAUNCHER_ID);
        if (this.shell.getAreaFor(launcher) !== 'left') await this.shell.addWidget(launcher, { area: 'left', rank: 200 });
        if (this.shell.getCurrentWidget('left') === launcher) await this.shell.revealWidget(EXPLORER_VIEW_CONTAINER_ID);
        const updateActive = () => {
            const active = this.shell.getCurrentWidget('main')?.id === ROADMAP_CANVAS_ID;
            launcher.title.className = active ? 'dope-roadmap-launcher dope-roadmap-launcher-active' : 'dope-roadmap-launcher';
        };
        this.shell.onDidChangeActiveWidget(updateActive);
        this.shell.onDidChangeCurrentWidget(updateActive);
        updateActive();
        const tabBar = this.shell.getTabBarFor(launcher);
        if (tabBar) {
            const labelTab = () => {
                const tab = tabBar.node.querySelector<HTMLElement>(`#shell-tab-${ROADMAP_LAUNCHER_ID}`);
                if (tab && tab.getAttribute('aria-label') !== 'Roadmap') {
                    tab.setAttribute('aria-label', 'Roadmap');
                    tab.setAttribute('title', 'Roadmap');
                    tab.setAttribute('role', 'button');
                    tab.tabIndex = 0;
                    tab.addEventListener('keydown', event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            launcher.activate();
                        }
                    });
                }
            };
            const observer = new MutationObserver(labelTab);
            observer.observe(tabBar.node, { childList: true, subtree: true });
            labelTab();
            launcher.disposed.connect(() => observer.disconnect());
        }
    }

    createLauncher(): RoadmapActivityLauncher {
        return new RoadmapActivityLauncher(async () => {
            const opening = this.commands.executeCommand('dope.roadmap.open');
            // The launcher has no view body. Keep Explorer as the side panel content.
            await this.shell.revealWidget(EXPLORER_VIEW_CONTAINER_ID);
            await opening;
        });
    }
}

export function roadmapLauncherFactory(contribution: RoadmapNavigationContribution): WidgetFactory {
    return { id: ROADMAP_LAUNCHER_ID, createWidget: () => contribution.createLauncher() };
}
