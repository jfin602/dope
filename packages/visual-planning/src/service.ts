import type { CrossMapConflict, MapStatus, PlannedTransformation, PlanningBasis, PlanningMap, Resolution, TargetProjection, WorkItem, WorkItemSuggestion } from './index';
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
  | { type: 'remove-work-item'; mapId: string; workItemId: string }
  | { type: 'reconcile'; mapId: string; expectedMapRevision: number }
  | { type: 'disposition'; mapId: string; transformationId: string; resolution: Resolution; deferredToMapId?: string }
  | { type: 'closeout'; mapId: string; expectedMapRevision: number };
export interface PlanningMutation { projectHandle: string; expectedRevision: number; operation: PlanningOperation }
export interface AdoptionRequest { projectHandle: string; mapId: string; expectedRevision: number; expectedMapRevision: number;
  expectedBasis: PlanningBasis; scope: AdoptionScope }
export interface AdoptionAcceptance extends AdoptionRequest { acceptedChanges: AdoptionPreview['changes']; acceptedTransformationIds: string[] }
export interface RebaseRequest { projectHandle: string; mapId: string; expectedRevision: number; expectedMapRevision: number;
  expectedBasis: PlanningBasis; expectedCurrentBasis: PlanningBasis }
export interface RebaseAcceptance extends RebaseRequest { decisions: RebaseDecision[] }
/** A disposable read of a selected Roadmap checkpoint against current canonical software. */
export interface CurrentSoftwareImpactRequest { projectHandle: string; projectId: string; checkpointId: string;
  expectedRoadmapRevision: number; branchIds: string[] }
export interface CurrentSoftwareImpactPacket {
  status: 'ready' | 'unavailable' | 'stale' | 'ambiguous'; reason?: string;
  checkpoint?: { id: string; title: string; objective: string; requirements: string[] };
  roadmapRevision?: number; basis?: PlanningBasis;
  planningMap?: { id: string; revision: number; rebaseConflicts: number };
  branches: { id: string; kind: 'system' | 'subsystem' | 'component'; name: string; purpose: string }[];
  sources: { path: string; evidenceIds: string[] }[];
  relationships: { kind: string; sourceId: string; targetId: string }[];
  uncertainties: string[];
  limits: { maxBranches: number; maxPaths: number; maxRelationships: number; maxBytes: number; truncated: boolean };
  action: { kind: 'analyze-software-map' | 'refocus-branches'; branchIds: string[]; explicit: true };
}
/** Read-only target design. `current` is canonical; `target` is only the proposed Planning Map projection. */
export interface TargetDesignReview {
  mapId: string; mapRevision: number; collectionRevision: number; basis: PlanningBasis;
  current: TargetProjection; target: TargetProjection;
  diff: { nodes: string[]; relationships: string[] };
}
/** Unwritten, project-scoped WorkItem order. It has no prompt files or Run identity. */
export interface PlanningStackOutline {
  checkpointId: string; mapId: string; mapRevision: number; projectId: string;
  items: { id: string; title: string; objective: string; dependsOn: string[];
    acceptanceCriteria: string[]; validationTargets: string[]; workingSet: string[] }[];
}
export interface PlanningStackPreview {
  token: string; folderName: string; destination: string; draftHash: string;
  stackFingerprint: string; sourceHash: string; gitHead: string; packageVersion: string;
  projectId: string; checkpointId: string; scope: string; dependencies: string[]; gates: string[];
  files: { path: string; hash: string; diff: string }[];
}
export interface PlanningStackRecord {
  projectId: string; checkpointId: string; folderName: string; stackFingerprint: string;
  status: 'publishing' | 'review-required' | 'published'; files: { path: string; hash: string }[];
}
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
  /** Exact current observation for cross-owner references; generation alone is not semantic staleness. */
  currentBasis(projectHandle: string): Promise<PlanningBasis>;
  currentSoftwareImpact(request: CurrentSoftwareImpactRequest): Promise<CurrentSoftwareImpactPacket>;
  targetDesign(projectHandle: string, mapId: string, expectedRevision: number, expectedMapRevision: number): Promise<TargetDesignReview>;
  previewTargetApproval(projectHandle: string, checkpointId: string, branchIds: string[]): Promise<{
    impact: CurrentSoftwareImpactPacket; design: TargetDesignReview; token: string }>;
  approveTarget(projectHandle: string, token: string, developerAction: boolean): Promise<void>;
  rejectTarget(projectHandle: string, token: string): Promise<void>;
  targetApproved(projectHandle: string, checkpointId: string, branchIds: string[]): Promise<boolean>;
  suggestApprovedWorkItems(projectHandle: string, checkpointId: string, branchIds: string[]): Promise<WorkItemSuggestion[]>;
  previewScopeApproval(projectHandle: string, checkpointId: string): Promise<{ token: string; checkpointId: string; roadmapRevision: number; roadmapSourceHash: string }>;
  approveScope(projectHandle: string, token: string, developerAction: boolean): Promise<void>;
  stackOutline(projectHandle: string, checkpointId: string, branchIds: string[]): Promise<PlanningStackOutline>;
  reorderStackOutline(projectHandle: string, checkpointId: string, branchIds: string[], orderedIds: string[]): Promise<PlanningStackOutline>;
  previewStackPublication(projectHandle: string, checkpointId: string, branchIds: string[], folderName: string, orderedIds: string[]): Promise<PlanningStackPreview>;
  publishStack(projectHandle: string, token: string, developerAction: boolean): Promise<PlanningStackRecord>;
  cancelStackPreview(projectHandle: string, token: string): Promise<void>;
  attemptAuthoredStackReorder(projectHandle: string, folderName: string, orderedIds: string[]): Promise<void>;
  previewRebase(request: RebaseRequest): Promise<RebaseResult>;
  acceptRebase(request: RebaseAcceptance): Promise<PlanningCollection>;
  mutate(request: PlanningMutation): Promise<PlanningCollection>;
}
