import type { RoadmapIndex, RoadmapChange } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { RoadmapOwnerRecord } from '@dope/project-intelligence/lib/node/roadmap-owner-links';
import type { PlanningActionRequest, PlanningActionPreview, PlanningUndoRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import type { RoadmapCandidateDiscovery, RoadmapImportPreview } from '@dope/project-intelligence/lib/node/roadmap-import';
import type { RoadmapSyncPreview } from '@dope/project-intelligence/lib/node/roadmap-document-sync';
import type { GreenfieldDraft, GreenfieldEdit, GreenfieldPreview } from '@dope/project-intelligence/lib/node/roadmap-greenfield';

export const roadmapServicePath = '/services/dope/roadmap';
export interface RoadmapClient { notifyRoadmapChanged(change: RoadmapChange): void; notifyLinkedDocumentChanged(root: string, projectId: string): void }

/** Roadmap reads and a thin RPC bridge to Dope-owned ProjectPlanningActions. */
export interface RoadmapService {
    beginDraft(projectUri: string): Promise<{ handle: string; draft: GreenfieldDraft }>;
    editDraft(handle: string, expectedRevision: number, action: GreenfieldEdit): Promise<GreenfieldDraft>;
    readDraft(handle: string): Promise<GreenfieldDraft>;
    previewDraft(handle: string, path: string): Promise<GreenfieldPreview>;
    acceptDraft(handle: string, preview: GreenfieldPreview, approved: boolean): Promise<RoadmapIndex>;
    cancelDraft(handle: string): Promise<void>;
    bindDraftChat(projectUri: string, handle: string, chatId: string): Promise<void>;
    read(projectUri: string): Promise<RoadmapIndex>;
    owners(projectUri: string): Promise<RoadmapOwnerRecord[]>;
    discoverImports(projectUri: string): Promise<RoadmapCandidateDiscovery>;
    previewImport(projectUri: string, path: string): Promise<RoadmapImportPreview>;
    acceptImport(projectUri: string, expectedRevision: number, expectedProjectId: string, preview: RoadmapImportPreview): Promise<RoadmapIndex>;
    previewDocumentSync(projectUri: string): Promise<RoadmapSyncPreview>;
    applyDocumentSync(projectUri: string, preview: RoadmapSyncPreview): Promise<RoadmapIndex>;
    observeLinkedDocument(projectUri?: string): Promise<void>;
    attach(projectUri: string): Promise<{ projectHandle: string; snapshot: RoadmapIndex }>;
    detach(projectHandle: string): Promise<void>;
    preview(request: PlanningActionRequest): Promise<PlanningActionPreview>;
    apply(request: PlanningActionRequest, token: string, approved: boolean): Promise<RoadmapIndex>;
    undo(request: PlanningUndoRequest): Promise<RoadmapIndex>;
    undoToken(projectHandle: string, ownerId: string): Promise<string | undefined>;
}
