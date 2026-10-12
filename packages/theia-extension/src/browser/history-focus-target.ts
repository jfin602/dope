import type { HistoryFocusTarget } from '@dope/contracts/lib/history';

export function panelFocusTarget(state: {
    module: 'chat' | 'work'; projectUri?: string; panelWorkspace?: string;
    chatWorkspace?: string; chatId?: string; workProject?: string;
    work?: { kind: 'task' | 'run' | 'sequence'; id: string };
}): HistoryFocusTarget | undefined {
    if (!state.projectUri || state.panelWorkspace !== state.projectUri) return undefined;
    if (state.module === 'chat' && state.chatWorkspace === state.projectUri && state.chatId)
        return { kind: 'chat', chatId: state.chatId };
    if (state.module !== 'work' || state.workProject !== state.projectUri || !state.work) return undefined;
    if (state.work.kind === 'task') return { kind: 'agent-task', taskId: state.work.id };
    if (state.work.kind === 'run') return { kind: 'agent-run', runId: state.work.id };
    return { kind: 'agent-sequence', sequenceId: state.work.id };
}

export function planningFocusTarget(state: {
    planningMode: boolean; projectMatches: boolean; mapWorkspace?: string; focusWorkspace?: string;
    selectedMapId?: string; selectedWorkItemId?: string;
}): HistoryFocusTarget | undefined {
    if (!state.planningMode || !state.projectMatches || !state.mapWorkspace ||
        state.mapWorkspace !== state.focusWorkspace || !state.selectedMapId) return undefined;
    return state.selectedWorkItemId ?
        { kind: 'work-item', mapId: state.selectedMapId, workItemId: state.selectedWorkItemId } :
        { kind: 'planning-map', mapId: state.selectedMapId };
}

export function editorFocusTarget(projectUri: string | undefined, editorUri: string | undefined):
    HistoryFocusTarget | undefined {
    if (!projectUri || !editorUri) return undefined;
    try {
        const root = new URL(projectUri), editor = new URL(editorUri);
        if (root.protocol !== 'file:' || editor.protocol !== 'file:' || root.host !== editor.host) return undefined;
        const projectPath = decodeURIComponent(root.pathname).replace(/\/$/u, '');
        const editorPath = decodeURIComponent(editor.pathname);
        if (!editorPath.startsWith(`${projectPath}/`)) return undefined;
        const path = editorPath.slice(projectPath.length + 1);
        if (!path || path.split('/').some(part => part === '..' || part === '.')) return undefined;
        return { kind: 'editor', projectRelativePath: path };
    } catch { return undefined; }
}
