import { sessionArtifactRefKey } from '@dope/contracts/lib/developer-session';
import type { DeveloperSession, SessionArtifactRef } from '@dope/contracts/lib/developer-session';
import type { SessionArtifactResolution, SessionResolveResult } from '@dope/contracts/lib/developer-session-service';

export interface SessionLinkGroup {
    kind: SessionArtifactRef['kind'];
    entries: { ref: SessionArtifactRef; resolution?: SessionArtifactResolution }[];
}

/** Match only an exact, current Session resolution; retain links without owner results. */
export function sessionLinkGroups(session: DeveloperSession, collectionRevision: number,
    result?: SessionResolveResult): SessionLinkGroup[] {
    const current = result?.sessionId === session.id && result.sessionRevision === session.revision &&
        result.collectionRevision === collectionRevision ? result : undefined;
    const byKey = new Map(current?.artifacts.map(artifact => [sessionArtifactRefKey(artifact.ref), artifact]));
    const groups: SessionLinkGroup[] = [];
    for (const ref of session.links) {
        let group = groups.find(item => item.kind === ref.kind);
        if (!group) { group = { kind: ref.kind, entries: [] }; groups.push(group); }
        group.entries.push({ ref, resolution: byKey.get(sessionArtifactRefKey(ref)) });
    }
    return groups;
}

export function visibleSessions(sessions: readonly DeveloperSession[], filter: string): DeveloperSession[] {
    const query = filter.trim().toLocaleLowerCase();
    return sessions.filter(session => session.title.toLocaleLowerCase().includes(query));
}

export function sessionListState(state: { loading: boolean; error: string;
    snapshot?: { sessions: readonly DeveloperSession[] } }, visible: readonly DeveloperSession[]): string {
    if (state.error) return state.error;
    if (state.loading) return 'Loading Development Sessions…';
    if (!state.snapshot) return 'Open one local project folder to use Development Sessions.';
    if (!state.snapshot.sessions.length) return 'No sessions in this project yet.';
    if (!visible.length) return 'No sessions match this filter.';
    return '';
}

export function sessionOverview(session: DeveloperSession): { title: string; status: string; updatedAt: string;
    objective: string; notes: string; nextActions: readonly string[]; links: number } {
    return { title: session.title, status: session.status, updatedAt: session.updatedAt,
        objective: session.objective, notes: session.notes, nextActions: session.nextActions,
        links: session.links.length };
}

/** Use the workbench's stable widget factory identity; activation never clones the tab. */
export async function revealSessionWidget<T extends { id: string; isAttached: boolean }>(
    get: () => Promise<T>, add: (widget: T) => Promise<unknown>, activate: (id: string) => Promise<unknown>): Promise<T> {
    const widget = await get();
    if (!widget.isAttached) await add(widget);
    await activate(widget.id);
    return widget;
}
