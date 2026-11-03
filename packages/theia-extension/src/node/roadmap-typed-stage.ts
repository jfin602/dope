import type { RoadmapGateIndex } from '@dope/project-intelligence/lib/node/roadmap-gate-domain';
export function typedRoadmapCounts(index: RoadmapGateIndex): { phases: number; gates: number; criteria: number } {
    return { phases: index.phases.length, gates: index.gates.length,
        criteria: index.gates.reduce((count, gate) => count + gate.criteria.length, 0) };
}
