import type { RoadmapIndex, RoadmapChange } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { PlanningActionRequest, PlanningActionPreview, PlanningUndoRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';

export const roadmapServicePath = '/services/dope/roadmap';
export interface RoadmapClient { notifyRoadmapChanged(change: RoadmapChange): void }

/** Roadmap reads and a thin RPC bridge to Dope-owned ProjectPlanningActions. */
export interface RoadmapService {
    read(projectUri: string): Promise<RoadmapIndex>;
    attach(projectUri: string): Promise<{ projectHandle: string; snapshot: RoadmapIndex }>;
    detach(projectHandle: string): Promise<void>;
    preview(request: PlanningActionRequest): Promise<PlanningActionPreview>;
    apply(request: PlanningActionRequest, token: string, approved: boolean): Promise<RoadmapIndex>;
    undo(request: PlanningUndoRequest): Promise<RoadmapIndex>;
    undoToken(projectHandle: string, ownerId: string): Promise<string | undefined>;
}
