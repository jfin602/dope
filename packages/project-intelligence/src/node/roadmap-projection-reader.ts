import { projectRoadmap, type RoadmapProjection, type RoadmapPresentation } from '../roadmap-projection';
import type { RoadmapOwnerRecord } from './roadmap-owner-links';
import type { RoadmapStore } from './roadmap-store';
import type { RoadmapGateIndex } from './roadmap-gate-domain';

/** Shared source-bound read used by the existing Roadmap RPC backend. */
export async function readRoadmapProjection(store: RoadmapStore, root: string,
    owners: readonly RoadmapOwnerRecord[], presentation: RoadmapPresentation = {}): Promise<RoadmapProjection> {
    const index = await store.read<RoadmapGateIndex>(root);
    if (index.projectRoot !== root) throw new Error('Roadmap project root changed');
    return projectRoadmap(index, owners, presentation);
}
