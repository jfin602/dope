import { sameObservation } from '@dope/visual-planning';
import type { PlanningBasis, PlanningMap } from '@dope/visual-planning';
import type { PlanningCollection } from '@dope/visual-planning/lib/service';
import type { SoftwareMapController } from './software-map-controller';

export interface PrepareWorkNavigation {
    workspace: string;
    projectId: string; // Roadmap owner, deliberately independent of the Planning owner.
    mapId?: string;
    mapRevision?: number;
    mapOwnerProjectId?: string;
    mapBasis?: PlanningBasis;
}

export interface PrepareWorkPlanningView {
    readonly focusWorkspace?: string;
    readonly collection?: PlanningCollection;
    navigationCurrentMap(id: string): Promise<PlanningMap | undefined>;
}

/** A common attached workspace binds the owners; a linked map also needs its own current identity and basis. */
export async function verifyPrepareWorkNavigation(selection: PrepareWorkNavigation,
    software: Pick<SoftwareMapController, 'workspace' | 'status' | 'initialization'>,
    planning: PrepareWorkPlanningView): Promise<{ projectId: string; revision: number; existingMapId?: string }> {
    const collection = planning.collection;
    if (software.workspace !== selection.workspace || planning.focusWorkspace !== selection.workspace || !collection ||
        software.status?.state !== 'ready' || software.initialization?.state !== 'initialized' ||
        !software.initialization.declarationPresent)
        throw new Error('Planning Map is unavailable for this project. Open its Software Map and retry.');
    const planningProjectId = collection.projectId;
    let existingMapId: string | undefined;
    if (selection.mapId) {
        if (selection.mapOwnerProjectId !== planningProjectId || !selection.mapBasis)
            throw new Error('Linked Planning Map has a foreign owner or missing basis. Review the Roadmap link.');
        const exact = await planning.navigationCurrentMap(selection.mapId);
        if (!exact || exact.projectId !== planningProjectId || exact.revision !== selection.mapRevision ||
            !sameObservation(exact.basis, selection.mapBasis))
            throw new Error('Linked Planning Map is missing or stale. Review the Roadmap link before preparing work.');
    } else {
        const candidates = collection.maps.filter(map => map.projectId === planningProjectId &&
            (map.status === 'draft' || map.status === 'active'));
        if (candidates.length === 1) {
            const current = await planning.navigationCurrentMap(candidates[0].id);
            if (!current || current.revision !== candidates[0].revision)
                throw new Error('Existing Planning Map basis changed. Refresh or rebase it before preparing work.');
            existingMapId = current.id;
        }
    }
    if (software.workspace !== selection.workspace || planning.focusWorkspace !== selection.workspace ||
        planning.collection?.projectId !== planningProjectId || planning.collection.revision !== collection.revision)
        throw new Error('Project changed while opening Planning Map. Select the checkpoint again.');
    return { projectId: planningProjectId, revision: collection.revision, existingMapId };
}
