import type { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import { ProjectPlanningActions } from '@dope/project-intelligence/lib/node/project-planning-actions';
import type { VisualPlanningService } from '@dope/visual-planning/lib/service';
import { RoadmapPlanningLinks } from './roadmap-planning-links';
import { discoverRoadmapTaskStacks } from '@dope/agent-core/lib/node/roadmap-task-discovery';
import { resolvePhaseFocusLink } from './phase-focus-evidence';
import { RoadmapOwnerLinks } from '@dope/project-intelligence/lib/node/roadmap-owner-links';

/** Bind Roadmap and Chat mutations to the same Planning Map owner checks. */
export function createRoadmapActionRuntime(store: RoadmapStore,
    planning: (root: string) => VisualPlanningService & { dispose?: () => void }) {
    const bridges = new Map<string, { links: RoadmapPlanningLinks; service: VisualPlanningService & { dispose?: () => void } }>();
    const actions = new ProjectPlanningActions(store, async (root, link) => link.owner === 'evidence'
        ? resolvePhaseFocusLink(root, await store.read(root), await discoverRoadmapTaskStacks(root), link)
        : !!await new RoadmapOwnerLinks().resolve(root, link), {
        resolve: async (root, link) => {
            let bridge = bridges.get(root);
            if (!bridge) {
                const service = planning(root);
                bridge = { links: new RoadmapPlanningLinks(root, service), service };
                bridges.set(root, bridge);
            }
            return bridge.links.resolve(root, link);
        }
    });
    return { actions, dispose: () => {
        for (const bridge of bridges.values()) bridge.service.dispose?.();
        bridges.clear();
    } };
}
