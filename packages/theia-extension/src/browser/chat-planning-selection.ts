import type { ChatContextSelection } from '@dope/chat/lib/service';
import type { RoadmapService } from '../roadmap-service';
import type { RoadmapInspectorModel } from './roadmap-inspector-model';
import type { PlanningMapController } from './planning-map-controller';

export type PlanningSelection = ChatContextSelection & { kind: 'roadmap-checkpoint' | 'planning-map'; projectId: string };

/** Reads the existing map owners. This has no Chat or widget lifecycle effects. */
export class ChatPlanningSelection {
    private active?: 'roadmap-checkpoint' | 'planning-map';
    private roadmapId?: string;
    private planningId?: string;
    private readonly listeners = new Set<() => void>();
    constructor(private readonly roadmap: RoadmapInspectorModel, private readonly planning: PlanningMapController,
        private readonly roadmapService: RoadmapService) {
        this.roadmapId = roadmap.selectedId;
        this.planningId = planning.selectedMapId;
        this.active = roadmap.selectedId ? 'roadmap-checkpoint' : planning.selectedMapId ? 'planning-map' : undefined;
        roadmap.onChange(() => {
            if (roadmap.selectedId && roadmap.selectedId !== this.roadmapId) this.active = 'roadmap-checkpoint';
            this.roadmapId = roadmap.selectedId;
            for (const listener of this.listeners) listener();
        });
        planning.onChange(() => {
            if (planning.selectedMapId && planning.selectedMapId !== this.planningId) this.active = 'planning-map';
            this.planningId = planning.selectedMapId;
            for (const listener of this.listeners) listener();
        });
    }
    onChange(listener: () => void): { dispose(): void } {
        this.listeners.add(listener);
        return { dispose: () => { this.listeners.delete(listener); } };
    }

    bridge(workspace: string, branchIds: string[]) {
        const handoff = this.planning.prepareWorkContext;
        const map = this.planning.selected;
        const index = this.roadmap.index;
        const checkpoint = this.roadmap.selected;
        if (this.roadmap.projectUri !== workspace || this.planning.projectWorkspace !== workspace ||
            !handoff || handoff.workspace !== workspace || !map || !index || !checkpoint ||
            handoff.projectId !== index.projectId || handoff.checkpointId !== checkpoint.id ||
            handoff.mapId !== map.id || handoff.planningProjectId !== this.planning.collection?.projectId ||
            map.projectId !== handoff.planningProjectId ||
            map.revision !== handoff.mapRevision || this.roadmap.prepareWorkBlockedReason)
            throw new Error('Prepare Work and select its current linked Planning Map first');
        return { projectId: index.projectId, checkpointId: checkpoint.id, roadmapRevision: index.revision,
            mapId: map.id, mapRevision: map.revision, branchIds };
    }

    current(workspace: string): PlanningSelection | undefined {
        if (this.active === 'roadmap-checkpoint' && this.roadmap.projectUri === workspace && this.roadmap.selected && this.roadmap.index) {
            const item = this.roadmap.selected;
            return { kind: 'roadmap-checkpoint', id: item.id, projectId: this.roadmap.index.projectId,
                ownerRevision: this.roadmap.index.revision, ...(item.source ? { sourceHash: item.source.sha256 } : {}) };
        }
        if (this.active === 'planning-map' && this.planning.projectWorkspace === workspace && this.planning.selected && this.planning.collection)
            return { kind: 'planning-map', id: this.planning.selected.id, projectId: this.planning.collection.projectId,
                ownerRevision: this.planning.selected.revision };
        return undefined;
    }

    async resolve(workspace: string, selection: PlanningSelection, pinned: boolean): Promise<PlanningSelection> {
        if (selection.kind === 'roadmap-checkpoint') {
            const index = await this.roadmapService.read(workspace);
            if (index.projectId !== selection.projectId) throw new Error('Roadmap selection belongs to another project');
            const item = index.checkpoints.find(candidate => candidate.id === selection.id);
            if (!item) throw new Error('Selected Roadmap checkpoint is missing');
            if (pinned && (index.revision !== selection.ownerRevision || item.source?.sha256 !== selection.sourceHash))
                throw new Error('Pinned Roadmap checkpoint is stale; pin the current selection again');
            return { kind: 'roadmap-checkpoint', id: item.id, projectId: index.projectId,
                ownerRevision: index.revision, ...(item.source ? { sourceHash: item.source.sha256 } : {}) };
        }
        if (this.planning.projectWorkspace !== workspace || this.planning.collection?.projectId !== selection.projectId)
            throw new Error('Planning selection belongs to another project');
        const map = await this.planning.navigationMap(selection.id);
        if (!map) throw new Error('Selected Planning Map is missing');
        if (pinned && map.revision !== selection.ownerRevision)
            throw new Error('Pinned Planning Map is stale; pin the current selection again');
        return { kind: 'planning-map', id: map.id, projectId: selection.projectId, ownerRevision: map.revision };
    }
}
