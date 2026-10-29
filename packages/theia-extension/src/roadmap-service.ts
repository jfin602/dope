import type { RoadmapIndex, RoadmapChange, RoadmapReplacementPreview } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
import type { GateDocumentEdit, GateDocumentPatch, GateDocumentSyncPreview, GateDocumentRelinkPreview } from
    '@dope/project-intelligence/lib/node/roadmap-gate-document';
import type { RoadmapOwnerRecord } from '@dope/project-intelligence/lib/node/roadmap-owner-links';
import type { PlanningActionRequest, PlanningActionPreview, PlanningUndoRequest } from '@dope/project-intelligence/lib/node/project-planning-actions';
import type { RoadmapCandidateDiscovery, RoadmapImportPreview } from '@dope/project-intelligence/lib/node/roadmap-import';
import type { RoadmapSyncPreview, RoadmapRelinkPreview, RoadmapPendingRecoveryPreview } from '@dope/project-intelligence/lib/node/roadmap-document-sync';
import type { GreenfieldDraft, GreenfieldEdit, GreenfieldPreview, GreenfieldEditPreview, GreenfieldChange, ImplementationPlanDraft, ImplementationPlanProjectionPreview } from '@dope/project-intelligence/lib/node/roadmap-greenfield';
import type { RoadmapTaskStack } from '@dope/agent-core/lib/node/roadmap-task-discovery';
import type { RoadmapProjection, RoadmapPresentation } from '@dope/project-intelligence/lib/roadmap-projection';
import type { PhaseFocusEvidence } from './node/phase-focus-evidence';

export const roadmapServicePath = '/services/dope/roadmap';
export interface RoadmapClient { notifyRoadmapChanged(change: RoadmapChange): void; notifyLinkedDocumentChanged(root: string, projectId: string): void;
    notifyDraftChanged(change: GreenfieldChange): void; notifyPhaseFocusEvidenceChanged(root: string): void }

/** Roadmap reads and a thin RPC bridge to Dope-owned ProjectPlanningActions. */
export interface RoadmapService {
    beginDraft(projectUri: string): Promise<{ handle: string; draft: GreenfieldDraft }>;
    beginImplementationPlan(projectUri: string, chatId: string): Promise<{ handle: string; ownerRevision: number }>;
    cancelUnacceptedImplementationPlan(projectUri: string, chatId: string): Promise<void>;
    recoverDrafts(projectUri: string): Promise<{ handle: string; draft: GreenfieldDraft; chatId?: string;
        plan?: ImplementationPlanDraft }[]>;
    listImplementationPlans(projectUri: string): Promise<{ handle: string; plan: ImplementationPlanDraft }[]>;
    previewImplementationPlanProjection(projectUri: string, handle: string): Promise<ImplementationPlanProjectionPreview>;
    clearImplementationPlanProjection(projectUri: string, handle: string): Promise<void>;
    applyImplementationPlanProjection(projectUri: string, preview: ImplementationPlanProjectionPreview,
        approved: boolean): Promise<GreenfieldDraft>;
    editDraft(handle: string, expectedRevision: number, action: GreenfieldEdit): Promise<GreenfieldDraft>;
    previewDraftEdit(handle: string, expectedRevision: number, action: GreenfieldEdit): Promise<GreenfieldEditPreview>;
    applyDraftEdit(handle: string, preview: GreenfieldEditPreview, approved: boolean): Promise<GreenfieldDraft>;
    undoDraftEdit(handle: string, expectedRevision: number): Promise<GreenfieldDraft>;
    redoDraftEdit(handle: string, expectedRevision: number): Promise<GreenfieldDraft>;
    readDraft(handle: string): Promise<GreenfieldDraft>;
    previewDraft(handle: string, path: string): Promise<GreenfieldPreview>;
    acceptDraft(handle: string, preview: GreenfieldPreview, approved: boolean): Promise<RoadmapIndex>;
    cancelDraft(handle: string): Promise<void>;
    bindDraftChat(projectUri: string, handle: string, chatId: string): Promise<void>;
    /** @deprecated P17 removes this schema-1 typed compile seam. The store only reads schema 2. */
    read(projectUri: string): Promise<RoadmapIndex>;
    /** Canonical schema-2 view; selection is scoped to the saved project identity. */
    readProjection(projectUri: string, presentation?: RoadmapPresentation): Promise<RoadmapProjection>;
    owners(projectUri: string): Promise<RoadmapOwnerRecord[]>;
    discoverTasks(projectUri: string): Promise<RoadmapTaskStack[]>;
    phaseFocusEvidence(projectUri: string, expectedProjectId: string, phaseId: string): Promise<PhaseFocusEvidence>;
    resolvePromptSource(projectUri: string, path: string, fingerprint: string): Promise<string>;
    discoverImports(projectUri: string): Promise<RoadmapCandidateDiscovery>;
    previewImport(projectUri: string, path: string): Promise<RoadmapImportPreview>;
    /** Approved explicit Phase/Gate Markdown import into the schema-2 Roadmap owner. */
    acceptGateImport(projectUri: string, expectedRevision: number, projectId: string,
        preview: RoadmapImportPreview): Promise<RoadmapGateIndex>;
    previewGateDocumentPatch(projectUri: string, edit: GateDocumentEdit): Promise<GateDocumentPatch>;
    publishGateDocumentPatch(projectUri: string, preview: GateDocumentPatch, approved: boolean): Promise<RoadmapGateIndex>;
    previewGateDocumentSync(projectUri: string): Promise<GateDocumentSyncPreview>;
    applyGateDocumentSync(projectUri: string, preview: GateDocumentSyncPreview, approved: boolean): Promise<RoadmapGateIndex>;
    previewGateRelink(projectUri: string, path: string): Promise<GateDocumentRelinkPreview>;
    applyGateRelink(projectUri: string, preview: GateDocumentRelinkPreview, approved: boolean): Promise<RoadmapGateIndex>;
    recoverGateDocumentPatch(projectUri: string, approved: boolean): Promise<RoadmapGateIndex>;
    acceptImport(projectUri: string, expectedRevision: number, expectedProjectId: string, preview: RoadmapImportPreview): Promise<RoadmapIndex>;
    previewReplacement(projectUri: string, path: string): Promise<RoadmapReplacementPreview>;
    applyReplacement(projectUri: string, preview: RoadmapReplacementPreview, approved: boolean): Promise<RoadmapIndex>;
    previewDocumentSync(projectUri: string): Promise<RoadmapSyncPreview>;
    applyDocumentSync(projectUri: string, preview: RoadmapSyncPreview): Promise<RoadmapIndex>;
    previewPendingRecovery(projectUri: string): Promise<RoadmapPendingRecoveryPreview>;
    applyPendingRecovery(projectUri: string, preview: RoadmapPendingRecoveryPreview, approved: boolean): Promise<RoadmapIndex>;
    previewRelink(projectUri: string, path: string): Promise<RoadmapRelinkPreview>;
    applyRelink(projectUri: string, preview: RoadmapRelinkPreview, approved: boolean): Promise<RoadmapIndex>;
    observeLinkedDocument(projectUri?: string): Promise<void>;
    attach(projectUri: string): Promise<{ projectHandle: string; snapshot: RoadmapIndex }>;
    detach(projectHandle: string): Promise<void>;
    preview(request: PlanningActionRequest): Promise<PlanningActionPreview>;
    apply(request: PlanningActionRequest, token: string, approved: boolean): Promise<RoadmapIndex>;
    undo(request: PlanningUndoRequest): Promise<RoadmapIndex>;
    undoToken(projectHandle: string, ownerId: string): Promise<string | undefined>;
}
