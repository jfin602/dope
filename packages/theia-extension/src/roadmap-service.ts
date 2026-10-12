import type { RoadmapIndex } from '@dope/project-intelligence/lib/node/roadmap-store';

export const roadmapServicePath = '/services/dope/roadmap';

/** Read-only Roadmap entry point. Mutations belong to ProjectPlanningActions. */
export interface RoadmapService {
    read(projectUri: string): Promise<RoadmapIndex>;
}
