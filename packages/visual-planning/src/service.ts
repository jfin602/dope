import type { CrossMapConflict, MapStatus, PlannedTransformation, PlanningBasis, PlanningMap, WorkItem } from './index';

export const visualPlanningServicePath = '/services/dope/visual-planning';
export const VisualPlanningService = Symbol('VisualPlanningService');

export interface PlanningCollection { schemaVersion: 1; projectId: string; revision: number; maps: PlanningMap[] }
export type PlanningOperation =
  | { type: 'create'; id: string; title: string; objective: string; basis: PlanningBasis }
  | { type: 'duplicate'; mapId: string; newId: string }
  | { type: 'transition'; mapId: string; status: MapStatus }
  | { type: 'update'; mapId: string; title: string; objective: string }
  | { type: 'put-transformation'; mapId: string; transformation: PlannedTransformation }
  | { type: 'remove-transformation'; mapId: string; transformationId: string }
  | { type: 'put-work-item'; mapId: string; workItem: WorkItem }
  | { type: 'remove-work-item'; mapId: string; workItemId: string };
export interface PlanningMutation { projectHandle: string; expectedRevision: number; operation: PlanningOperation }
export interface VisualPlanningService {
  attach(folderUri: string): Promise<{ projectHandle: string; snapshot: PlanningCollection }>;
  read(projectHandle: string): Promise<PlanningCollection>;
  list(projectHandle: string): Promise<PlanningMap[]>;
  get(projectHandle: string, mapId: string): Promise<PlanningMap | undefined>;
  conflicts(projectHandle: string): Promise<CrossMapConflict[]>;
  mutate(request: PlanningMutation): Promise<PlanningCollection>;
}
