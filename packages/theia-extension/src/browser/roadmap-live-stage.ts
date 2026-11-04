import type { ChatRoadmapStageSnapshot } from '@dope/chat/lib/service';

/** Transport events carry a projection, never approval authority. */
export function acceptsLiveRoadmapStage(snapshot: ChatRoadmapStageSnapshot,
    event: { chatId: string; messageId: string },
    basis: { projectId: string; revision: number; sourceHash: string | null },
    live?: ChatRoadmapStageSnapshot, pending?: ChatRoadmapStageSnapshot,
    endedTurnId?: string): boolean {
    if (snapshot.chatId !== event.chatId || snapshot.turnId !== event.messageId ||
        endedTurnId === event.messageId || snapshot.projectId !== basis.projectId ||
        snapshot.revision !== basis.revision || snapshot.sourceHash !== basis.sourceHash ||
        snapshot.expiresAt <= Date.now() || !Number.isSafeInteger(snapshot.sequence) ||
        snapshot.sequence < 1 || snapshot.ownerId.length === 0) return false;
    for (const previous of [live, pending]) if (previous &&
        (previous.chatId !== snapshot.chatId || previous.turnId !== snapshot.turnId ||
            previous.proposalId !== snapshot.proposalId || snapshot.sequence <= previous.sequence)) return false;
    return true;
}

/** A loading position is derived only from a verified, still active owner snapshot. */
export function showNextPhaseLoader(snapshot: ChatRoadmapStageSnapshot): boolean {
    return !snapshot.complete && snapshot.counts.phases > 0 &&
        snapshot.incompletePhaseIds.length === 0 && snapshot.expiresAt > Date.now();
}

/** Canvas positions are display-only; no position becomes a Roadmap entity. */
export function nextPhasePosition(occupied: readonly { x: number }[]): { x: number; y: number } {
    return { x: (occupied.length ? Math.max(...occupied.map(item => item.x)) : -496) + 560, y: 64 };
}
