import { parseSessionArtifactRef, sessionArtifactRefKey } from '@dope/contracts/lib/developer-session';
import type { DeveloperSession, SessionArtifactRef, SessionCollection } from '@dope/contracts/lib/developer-session';
import type { SessionResolveResult } from '@dope/contracts/lib/developer-session-service';
import type { WorkSelection } from './shared-panel-state';

export type SessionNavigationResult = { opened: boolean; message: string };
export interface SessionNavigationOwners {
    focusChat(workspace: string, id: string): boolean;
    focusWork(workspace: string, selection: WorkSelection): boolean;
    openChat(workspace: string, id: string, current: () => boolean): Promise<boolean>;
    openWork(workspace: string, selection: WorkSelection, current: () => boolean): Promise<boolean>;
    openPlanning(workspace: string, ref: { kind: 'planning-map'; mapId: string } |
        { kind: 'work-item'; mapId: string; workItemId: string }, current: () => boolean): Promise<boolean>;
    openProjectMind(workspace: string, artifactId: string, artifactType: 'decision' | 'idea',
        projectMindId: string | null, current: () => boolean): Promise<boolean>;
}

/** Navigation consumes fresh Session resolution, but never treats membership as owner authority. */
export async function navigateSessionArtifact(context: {
    workspace?: string;
    collection?: SessionCollection;
    session?: DeveloperSession;
    resolution?: SessionResolveResult;
    current(): boolean;
}, input: SessionArtifactRef, owners: SessionNavigationOwners): Promise<SessionNavigationResult> {
    let ref: SessionArtifactRef;
    try { ref = parseSessionArtifactRef(input); }
    catch { return { opened: false, message: 'Invalid linked artifact identity.' }; }
    const { workspace, collection, session, resolution, current } = context;
    if (!current() || !workspace || !collection || !session || !resolution ||
        collection.project.canonicalRoot !== session.project.canonicalRoot ||
        collection.project.projectMindId !== session.project.projectMindId ||
        !collection.sessions.some(item => item.id === session.id && item.revision === session.revision) ||
        resolution.sessionId !== session.id || resolution.sessionRevision !== session.revision ||
        resolution.collectionRevision !== collection.revision ||
        !session.links.some(link => sessionArtifactRefKey(link) === sessionArtifactRefKey(ref)))
        return { opened: false, message: 'Linked artifact is no longer current in this project. Refresh the Session.' };
    const target = resolution.artifacts.find(item => sessionArtifactRefKey(item.ref) === sessionArtifactRefKey(ref));
    if (!target || target.availability !== 'resolved')
        return { opened: false, message: target ?
            `Linked artifact is ${target.availability}: ${target.diagnostic}` : 'Linked artifact metadata is unavailable. Refresh the Session.' };
    let focused = false;
    try {
        if (ref.kind === 'chat') {
            focused = owners.focusChat(workspace, ref.chatId);
            if (!focused) {
                focused = await owners.openChat(workspace, ref.chatId, current);
                if (!focused && current()) focused = owners.focusChat(workspace, ref.chatId);
            }
        } else if (ref.kind === 'agent-task' || ref.kind === 'agent-run' || ref.kind === 'agent-sequence') {
            const selection: WorkSelection = ref.kind === 'agent-task' ? { kind: 'task', id: ref.taskId } :
                ref.kind === 'agent-run' ? { kind: 'run', id: ref.runId } : { kind: 'sequence', id: ref.sequenceId };
            focused = owners.focusWork(workspace, selection);
            if (!focused) {
                focused = await owners.openWork(workspace, selection, current);
                if (!focused && current()) focused = owners.focusWork(workspace, selection);
            }
        } else if (ref.kind === 'planning-map' || ref.kind === 'work-item') {
            focused = await owners.openPlanning(workspace, ref, current);
        } else if (ref.kind === 'project-mind') {
            focused = await owners.openProjectMind(workspace, ref.artifactId, ref.artifactType,
                collection.project.projectMindId, current);
        } else return { opened: false, message: 'Exact navigation for this link is not available yet.' };
    } catch { return { opened: false, message: 'The owner panel could not open this exact linked artifact.' }; }
    if (!current()) return { opened: false, message: 'Project or Session changed before navigation completed.' };
    return focused ? { opened: true, message: 'Opened the linked artifact in its owner panel.' } :
        { opened: false, message: 'No available owner panel could select this exact linked artifact. Open its normal view and retry.' };
}
