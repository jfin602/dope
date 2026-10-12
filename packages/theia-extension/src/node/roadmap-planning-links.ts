import { pathToFileURL } from 'node:url';
import type { AdoptionPreview, AdoptionScope } from '@dope/visual-planning/lib/adoption';
import type { EditCommand } from '@dope/visual-planning/lib/editing';
import type { PlannedTransformation, PlanningMap, WorkItem } from '@dope/visual-planning';
import type { VisualPlanningService } from '@dope/visual-planning/lib/service';
import type { RoadmapLink } from '@dope/project-intelligence/lib/node/roadmap-store';

export type RoadmapPlanningRecord =
    | { owner: 'planning-map'; projectId: string; map: PlanningMap }
    | { owner: 'transformation'; projectId: string; mapId: string; mapRevision: number; transformation: PlannedTransformation }
    | { owner: 'work-item'; projectId: string; mapId: string; mapRevision: number; workItem: WorkItem };

/** Read-only bridge to the Planning Map owner. A Roadmap link grants no adoption or Work authority. */
export class RoadmapPlanningLinks {
    private handle?: string;
    constructor(private readonly root: string, private readonly planning: VisualPlanningService) {}

    private async attached(): Promise<string> {
        if (!this.handle) this.handle = (await this.planning.attach(pathToFileURL(this.root).href)).projectHandle;
        return this.handle;
    }

    async resolve(root: string, link: RoadmapLink): Promise<RoadmapPlanningRecord | undefined> {
        if (root !== this.root || !['planning-map', 'transformation', 'work-item'].includes(link.owner) ||
            !link.ownerProjectId || link.ownerRevision === undefined || !link.basis) return undefined;
        const handle = await this.attached();
        const collection = await this.planning.read(handle);
        if (collection.projectId !== link.ownerProjectId) return undefined;
        const parts = link.targetId.split('/');
        if (parts.length !== (link.owner === 'planning-map' ? 1 : 2) || parts.some(part => !part)) return undefined;
        const map = collection.maps.find(item => item.id === parts[0]);
        if (!map || map.projectId !== collection.projectId || map.revision !== link.ownerRevision ||
            JSON.stringify(map.basis) !== JSON.stringify(link.basis)) return undefined;
        const freshness = await this.planning.staleness(handle, map.id);
        if (freshness.stale || freshness.conflicts.length) return undefined;
        const currentBasis = await this.planning.currentBasis(handle);
        if (JSON.stringify(currentBasis) !== JSON.stringify(map.basis)) return undefined;
        const conflicts = await this.planning.conflicts(handle);
        if (conflicts.some(conflict => conflict.mapIds.includes(map.id))) return undefined;
        // Owner state may move while current physical basis is inspected.
        const again = await this.planning.read(handle);
        const current = again.maps.find(item => item.id === map.id);
        if (again.projectId !== collection.projectId || again.revision !== collection.revision ||
            !current || current.revision !== map.revision || JSON.stringify(current.basis) !== JSON.stringify(map.basis)) return undefined;
        if (link.owner === 'planning-map') return { owner: 'planning-map', projectId: collection.projectId, map };
        if (link.owner === 'transformation') {
            const transformation = map.transformations.find(item => item.id === parts[1]);
            return transformation ? { owner: 'transformation', projectId: collection.projectId,
                mapId: map.id, mapRevision: map.revision, transformation } : undefined;
        }
        const workItem = map.workItems.find(item => item.id === parts[1]);
        return workItem ? { owner: 'work-item', projectId: collection.projectId,
            mapId: map.id, mapRevision: map.revision, workItem } : undefined;
    }

    /** Delegates to the native Planning Map preview. No mutation or acceptance API is exposed here. */
    async previewTransformation(root: string, link: RoadmapLink, command: EditCommand,
        transformationId: string): Promise<PlannedTransformation> {
        const record = await this.resolve(root, link);
        if (record?.owner !== 'planning-map' || !['draft', 'active'].includes(record.map.status))
            throw new Error('Stale, foreign or closed Planning Map');
        const handle = await this.attached();
        const collection = await this.planning.read(handle);
        if (collection.projectId !== record.projectId) throw new Error('Planning owner changed');
        const proposal = await this.planning.preview(handle, record.map.id, collection.revision,
            record.map.revision, command, transformationId);
        if (!await this.resolve(root, link)) throw new Error('Planning basis changed after preview');
        return proposal;
    }

    async previewAdoption(root: string, link: RoadmapLink, scope: AdoptionScope): Promise<AdoptionPreview> {
        const record = await this.resolve(root, link);
        if (record?.owner !== 'planning-map' || !['draft', 'active'].includes(record.map.status))
            throw new Error('Stale, foreign or closed Planning Map');
        const handle = await this.attached();
        const collection = await this.planning.read(handle);
        if (collection.projectId !== record.projectId) throw new Error('Planning owner changed');
        const preview = await this.planning.previewAdoption({ projectHandle: handle, mapId: record.map.id,
            expectedRevision: collection.revision, expectedMapRevision: record.map.revision,
            expectedBasis: record.map.basis, scope });
        if (!await this.resolve(root, link)) throw new Error('Planning basis changed after preview');
        if (preview.blockers.length) throw new Error(`Adoption blocked: ${preview.blockers.join('; ')}`);
        return preview;
    }
}
