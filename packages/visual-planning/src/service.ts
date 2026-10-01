import type { CrossMapConflict, MapStatus, PlannedTransformation, PlanningBasis, PlanningMap, WorkItem } from './index';
import type { EditCommand } from './editing';
import type { AdoptionPreview, AdoptionScope } from './adoption';
import type { RebaseResult, StaleResult } from './index';
import type { RebaseDecision } from './rebase';

export const visualPlanningServicePath = '/services/dope/visual-planning';
export const VisualPlanningService = Symbol('VisualPlanningService');

export interface PlanningCollection { schemaVersion: 1; projectId: string; revision: number; maps: PlanningMap[] }
export type PlanningOperation =
  | { type: 'create'; id: string; title: string; objective: string; basis: PlanningBasis }
  | { type: 'duplicate'; mapId: string; newId: string }
  | { type: 'transition'; mapId: string; status: MapStatus }
  | { type: 'update'; mapId: string; title: string; objective: string }
  | { type: 'put-transformation'; mapId: string; transformation: PlannedTransformation; expectedMapRevision?: number; expectedBasis?: PlanningBasis }
  | { type: 'remove-transformation'; mapId: string; transformationId: string }
  | { type: 'undo' | 'redo'; mapId: string; expectedMapRevision: number; expectedBasis: PlanningBasis }
  | { type: 'put-work-item'; mapId: string; workItem: WorkItem }
  | { type: 'split-work-item'; mapId: string; sourceId: string; parts: [WorkItem, WorkItem] }
  | { type: 'merge-work-items'; mapId: string; sourceIds: [string, string]; merged: WorkItem }
  | { type: 'remove-work-item'; mapId: string; workItemId: string };
export interface PlanningMutation { projectHandle: string; expectedRevision: number; operation: PlanningOperation }
export interface AdoptionRequest { projectHandle: string; mapId: string; expectedRevision: number; expectedMapRevision: number;
  expectedBasis: PlanningBasis; scope: AdoptionScope }
export interface AdoptionAcceptance extends AdoptionRequest { acceptedChanges: AdoptionPreview['changes']; acceptedTransformationIds: string[] }
export interface RebaseRequest { projectHandle: string; mapId: string; expectedRevision: number; expectedMapRevision: number;
  expectedBasis: PlanningBasis; expectedCurrentBasis: PlanningBasis }
export interface RebaseAcceptance extends RebaseRequest { decisions: RebaseDecision[] }
export interface VisualPlanningService {
  attach(folderUri: string): Promise<{ projectHandle: string; snapshot: PlanningCollection }>;
  read(projectHandle: string): Promise<PlanningCollection>;
  list(projectHandle: string): Promise<PlanningMap[]>;
  get(projectHandle: string, mapId: string): Promise<PlanningMap | undefined>;
  conflicts(projectHandle: string): Promise<CrossMapConflict[]>;
  preview(projectHandle: string, mapId: string, expectedRevision: number, expectedMapRevision: number,
    command: EditCommand, transformationId: string): Promise<PlannedTransformation>;
  previewAdoption(request: AdoptionRequest): Promise<AdoptionPreview>;
  adoptTarget(request: AdoptionAcceptance): Promise<PlanningCollection>;
  staleness(projectHandle: string, mapId: string): Promise<StaleResult>;
  previewRebase(request: RebaseRequest): Promise<RebaseResult>;
  acceptRebase(request: RebaseAcceptance): Promise<PlanningCollection>;
  mutate(request: PlanningMutation): Promise<PlanningCollection>;
}
