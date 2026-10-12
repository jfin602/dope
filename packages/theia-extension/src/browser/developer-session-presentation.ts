import type { DeveloperSession } from '@dope/contracts/lib/developer-session';

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
