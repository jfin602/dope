import { pathToFileURL } from 'node:url';
import type { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';
import type { PlannedTransformation, RebaseResult, WorkItemSuggestion } from '@dope/visual-planning';
import { sameSemanticBasis, suggestWorkItems } from '@dope/visual-planning';
import type { EditCommand } from '@dope/visual-planning/lib/editing';
import type { RebaseDecision } from '@dope/visual-planning/lib/rebase';
import type { CurrentSoftwareImpactPacket, PlanningCollection, TargetDesignReview, VisualPlanningService } from '@dope/visual-planning/lib/service';
import { PlanningBridgeApprovals } from './planning-bridge-approvals';
import { planCorrectionRework } from './planning-correction';
import type { CorrectionReplan } from './planning-correction';

/** One selected checkpoint and branch scope. All reads go back to their existing owners. */
export class PlanningTargetReview {
    private readonly approvals: PlanningBridgeApprovals;
    private handle?: string;
    constructor(private readonly root: string, private readonly checkpointId: string,
        branchIds: string[], private readonly roadmap: RoadmapStore,
        private readonly planning: VisualPlanningService) {
        this.branchIds = [...branchIds].sort();
        this.approvals = new PlanningBridgeApprovals(async projectRoot => {
            if (projectRoot !== this.root) throw new Error('Foreign target review root');
            const reviewed = await this.readReview();
            return { roadmap: reviewed.roadmap, basis: reviewed.design.basis,
                targetBranchIds: this.branchIds,
                planning: { projectId: reviewed.collection.projectId,
                    collectionRevision: reviewed.collection.revision, map: reviewed.map } };
        });
    }
    private readonly branchIds: string[];
    private async attached(): Promise<string> {
        this.handle ??= (await this.planning.attach(pathToFileURL(this.root).href)).projectHandle;
        return this.handle;
    }
    private async readSelection() {
        const handle = await this.attached();
        const roadmap = await this.roadmap.read(this.root);
        const checkpoint = roadmap.checkpoints.find(item => item.id === this.checkpointId);
        if (!checkpoint) throw new Error('Roadmap checkpoint is unavailable');
        const links = checkpoint.links.filter(link => link.owner === 'planning-map');
        if (links.length !== 1) throw new Error('Select one reviewed Planning Map link');
        const link = links[0], collection = await this.planning.read(handle);
        const map = collection.maps.find(item => item.id === link.targetId);
        if (!map || collection.projectId !== link.ownerProjectId || map.projectId !== collection.projectId ||
            map.revision !== link.ownerRevision || !link.basis ||
            !sameSemanticBasis(map.basis, link.basis) || map.basis.physicalGeneration !== link.basis.physicalGeneration)
            throw new Error('Planning Map link requires explicit Roadmap re-review');
        const impact = await this.planning.currentSoftwareImpact({ projectHandle: handle,
            projectId: roadmap.projectId, checkpointId: this.checkpointId,
            expectedRoadmapRevision: roadmap.revision, branchIds: this.branchIds });
        if (impact.status !== 'ready' || impact.checkpoint?.id !== this.checkpointId ||
            impact.planningMap?.id !== map.id || impact.planningMap.revision !== map.revision ||
            !impact.basis || !sameSemanticBasis(impact.basis, map.basis))
            throw new Error(`Checkpoint impact requires review: ${impact.reason ?? impact.status}`);
        const latest = await this.roadmap.read(this.root);
        if (latest.revision !== roadmap.revision) throw new Error('Roadmap checkpoint changed during target review');
        return { roadmap, collection, map, impact };
    }
    private async readReview() {
        const selected = await this.readSelection();
        const design = await this.planning.targetDesign(await this.attached(), selected.map.id,
            selected.collection.revision, selected.map.revision);
        if (design.mapId !== selected.map.id || design.mapRevision !== selected.map.revision ||
            design.collectionRevision !== selected.collection.revision ||
            !sameSemanticBasis(design.basis, selected.map.basis) ||
            design.basis.physicalGeneration !== selected.map.basis.physicalGeneration)
            throw new Error('Target design changed during review');
        if (design.diff.nodes.length === 0 && design.diff.relationships.length === 0)
            throw new Error('Target design has no reviewable changes');
        return { ...selected, design };
    }
    async preview(): Promise<{ impact: CurrentSoftwareImpactPacket; design: TargetDesignReview; token: string }> {
        const reviewed = await this.readReview();
        const approval = await this.approvals.preview(this.root, this.checkpointId, 'target');
        if (approval.reference.mapRevision !== reviewed.map.revision ||
            approval.reference.collectionRevision !== reviewed.collection.revision ||
            approval.reference.roadmapRevision !== reviewed.roadmap.revision)
            throw new Error('Target changed during approval preview');
        return { impact: reviewed.impact, design: reviewed.design, token: approval.token };
    }
    reject(token: string): void { this.approvals.reject(token); }
    async approve(token: string, developerAction: boolean): Promise<void> {
        await this.approvals.approve(this.root, token, developerAction);
    }
    async approved(): Promise<boolean> { return this.approvals.approved(this.root, this.checkpointId, 'target'); }
    async suggestApprovedWorkItems(): Promise<WorkItemSuggestion[]> {
        if (!await this.approved()) throw new Error('Current Planning target requires explicit approval');
        const reviewed = await this.readReview();
        const suggestions = suggestWorkItems(reviewed.map);
        if (!await this.approved()) throw new Error('Planning target changed during WorkItem suggestion');
        return suggestions;
    }
    /** Review affected unexecuted WorkItems before creating a separate correction draft. */
    async previewCorrectionReplan(changedTransformationIds: readonly string[]): Promise<CorrectionReplan> {
        const handle = await this.attached();
        const roadmap = await this.roadmap.read(this.root);
        const checkpoint = roadmap.checkpoints.find(item => item.id === this.checkpointId);
        const links = checkpoint?.links.filter(link => link.owner === 'planning-map') ?? [];
        if (roadmap.projectRoot !== this.root || links.length !== 1)
            throw new Error('Select one owned Planning Map for correction review');
        const collection = await this.planning.read(handle);
        const map = collection.maps.find(item => item.id === links[0].targetId);
        if (!map || map.projectId !== collection.projectId || links[0].ownerProjectId !== collection.projectId)
            throw new Error('Foreign Planning Map for correction review');
        const result = planCorrectionRework(map, changedTransformationIds);
        const latest = await this.planning.read(await this.attached());
        if (latest.revision !== collection.revision ||
            latest.maps.find(item => item.id === map.id)?.revision !== map.revision ||
            (await this.roadmap.read(this.root)).revision !== roadmap.revision)
            throw new Error('Planning target changed during correction review');
        return result;
    }
    async previewTransformation(command: EditCommand, transformationId: string): Promise<PlannedTransformation> {
        const { collection, map } = await this.readSelection();
        return this.planning.preview(await this.attached(), map.id, collection.revision,
            map.revision, command, transformationId);
    }
    async putTransformation(command: EditCommand, transformationId: string, expectedRevision: number,
        expectedMapRevision: number): Promise<{ collection: PlanningCollection; relinkRequired: true }> {
        const { collection, map } = await this.readSelection();
        if (collection.revision !== expectedRevision || map.revision !== expectedMapRevision)
            throw new Error('Planning target changed after transformation preview');
        const transformation = await this.planning.preview(await this.attached(), map.id,
            expectedRevision, expectedMapRevision, command, transformationId);
        const changed = await this.planning.mutate({ projectHandle: await this.attached(), expectedRevision,
            operation: { type: 'put-transformation', mapId: map.id, transformation,
                expectedMapRevision, expectedBasis: map.basis } });
        // Roadmap is a separate owner. Its revisioned link must be reviewed and relinked explicitly.
        return { collection: changed, relinkRequired: true };
    }
    /** Stale basis recovery is a separate, explicit Planning Map operation. */
    async previewRebase(mapId: string): Promise<RebaseResult> {
        const handle = await this.attached(), collection = await this.planning.read(handle);
        const map = collection.maps.find(item => item.id === mapId);
        const roadmap = await this.roadmap.read(this.root);
        const checkpoint = roadmap.checkpoints.find(item => item.id === this.checkpointId);
        if (!map || map.projectId !== collection.projectId ||
            !checkpoint?.links.some(link => link.owner === 'planning-map' && link.targetId === mapId &&
                link.ownerProjectId === collection.projectId)) throw new Error('Unknown or foreign checkpoint Planning Map');
        return this.planning.previewRebase({ projectHandle: handle, mapId, expectedRevision: collection.revision,
            expectedMapRevision: map.revision, expectedBasis: map.basis,
            expectedCurrentBasis: await this.planning.currentBasis(handle) });
    }
    async acceptRebase(mapId: string, preview: RebaseResult, expectedRevision: number,
        expectedMapRevision: number, decisions: RebaseDecision[]): Promise<{ collection: PlanningCollection; relinkRequired: true }> {
        const fresh = await this.previewRebase(mapId);
        if (JSON.stringify(fresh) !== JSON.stringify(preview)) throw new Error('Rebase preview changed; review again');
        const handle = await this.attached();
        const collection = await this.planning.acceptRebase({ projectHandle: handle, mapId,
            expectedRevision, expectedMapRevision, expectedBasis: preview.oldBasis,
            expectedCurrentBasis: preview.currentBasis, decisions });
        // The Roadmap link is an independent owner reference, never an atomic side effect of rebase.
        return { collection, relinkRequired: true };
    }
}
