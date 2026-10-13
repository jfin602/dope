import type { CheckpointNode } from '@dope/project-intelligence/lib/roadmap-projection';

export type RoadmapStatus = CheckpointNode['status'];

/** Presentation only: prompt/task discovery never supplies qualification evidence. */
export const roadmapStatusMark: Record<RoadmapStatus, string> = {
    green: '✓', active: '▶', 'not-green': '!', waived: '◇',
    'not-implemented': '○', unknown: '?',
};

/** A connection is earned only when both actual graph endpoints are Green. */
export function roadmapEdgeStatus(from: RoadmapStatus | undefined, to: RoadmapStatus | undefined): RoadmapStatus {
    if (from === 'green' && to === 'green') return 'green';
    for (const status of ['not-green', 'waived', 'active', 'not-implemented'] as const) {
        if (from === status || to === status) return status;
    }
    return 'unknown';
}
