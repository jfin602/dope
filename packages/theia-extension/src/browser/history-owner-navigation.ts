import { ApplicationShell, WidgetManager, OpenerService, open } from '@theia/core/lib/browser';
import URI from '@theia/core/lib/common/uri';
import { EditorManager } from '@theia/editor/lib/browser/editor-manager';
import type { HistoryEntry, HistoryNavigableOwnerRef, HistoryProject } from '@dope/contracts/lib/history';
import type { HistoryService } from '@dope/contracts/lib/history-service';
import { ChatOpenOwners } from './chat-panel-controller';
import { WorkOpenOwners, type WorkSelection } from './shared-panel-state';
import { ChatPanelWidget } from './chat-panel-widget';
import { CHAT_PANEL_ID, chatPanelOptions } from './chat-panel-presentation';
import { PlanningMapController } from './planning-map-controller';
import { SoftwareMapController } from './software-map-controller';
import { PHYSICAL_MAP_ID, PhysicalMapWidget } from './physical-map-widget';
import { PROJECT_MIND_ID, ProjectMindWidget } from './dope-workbench';
import type { HistoryNavigationOwners } from './history-navigation';

export function historyOwnerNavigation(dependencies: {
    shell: ApplicationShell; manager: WidgetManager; chats: ChatOpenOwners; work: WorkOpenOwners;
    planning: PlanningMapController; map: SoftwareMapController; history: HistoryService;
    editors: EditorManager; opener: OpenerService;
}, handle: string, project: HistoryProject): HistoryNavigationOwners {
    const { shell, manager, chats, work, planning, map, history, editors, opener } = dependencies;
    const workspace = new URI(project.projectRoot).withScheme('file').toString();
    const activate = async (widget: ChatPanelWidget | PhysicalMapWidget | ProjectMindWidget, area: 'main' | 'right',
        current: () => Promise<boolean>): Promise<boolean> => {
        if (!await current()) return false;
        if (!widget.isAttached) await shell.addWidget(widget, { area });
        if (!await current()) return false;
        await shell.activateWidget(widget.id);
        return await current();
    };
    return { async open(owner: HistoryNavigableOwnerRef, current: () => Promise<boolean>, entry?: HistoryEntry): Promise<boolean> {
        if (!await current()) return false;
        if (owner.kind === 'chat') {
            if (chats.focus(workspace, owner.chatId)) return await current();
            const widget = await manager.getOrCreateWidget<ChatPanelWidget>(CHAT_PANEL_ID, chatPanelOptions());
            if (!await current() || !await widget.navigateChat(owner.chatId, workspace) || !await current()) return false;
            return activate(widget, 'main', current);
        }
        if (owner.kind === 'agent-task' || owner.kind === 'agent-run' || owner.kind === 'agent-sequence') {
            const selection: WorkSelection = owner.kind === 'agent-task' ? { kind: 'task', id: owner.taskId } :
                owner.kind === 'agent-run' ? { kind: 'run', id: owner.runId } : { kind: 'sequence', id: owner.sequenceId };
            if (work.focus(workspace, selection)) return await current();
            const widget = await manager.getOrCreateWidget<ChatPanelWidget>(CHAT_PANEL_ID, chatPanelOptions('work'));
            if (!await current() || !await widget.navigateWork(selection, workspace) || !await current()) return false;
            return activate(widget, 'main', current);
        }
        if (owner.kind === 'planning-map' || owner.kind === 'work-item') {
            if (map.workspace !== workspace || planning.focusWorkspace !== workspace ||
                planning.collection?.projectId !== project.projectId) return false;
            const exact = await planning.navigationMap(owner.mapId);
            if (!await current() || !exact || exact.revision !== planning.collection?.maps.find(item => item.id === owner.mapId)?.revision ||
                owner.kind === 'work-item' && !exact.workItems.some(item => item.id === owner.workItemId)) return false;
            const widget = await manager.getOrCreateWidget<PhysicalMapWidget>(PHYSICAL_MAP_ID);
            if (!await current() || map.workspace !== workspace || planning.focusWorkspace !== workspace) return false;
            planning.setHistory(true);
            planning.setMode(true);
            planning.select(owner.mapId);
            if (owner.kind === 'work-item') planning.selectWorkItem(owner.workItemId);
            if (planning.selectedMapId !== owner.mapId || owner.kind === 'work-item' && planning.selectedWorkItemId !== owner.workItemId)
                return false;
            return activate(widget, 'main', current);
        }
        if (owner.kind === 'project-mind') {
            if (entry?.source !== 'project-mind' || !entry.ownerProjectId) return false;
            const widget = await manager.getOrCreateWidget<ProjectMindWidget>(PROJECT_MIND_ID);
            if (!await current() || !await widget.navigateArtifact(owner.artifactId, workspace, entry.ownerProjectId) || !await current()) return false;
            return activate(widget, 'right', current);
        }
        if (owner.kind === 'editor') {
            const file = await history.resolveEditor(handle, owner.projectRelativePath);
            if (!await current() || file !== await history.resolveEditor(handle, owner.projectRelativePath) || !await current()) return false;
            const uri = new URI(file);
            const existing = await editors.getByUri(uri);
            if (!await current() || file !== await history.resolveEditor(handle, owner.projectRelativePath) || !await current()) return false;
            if (existing) await shell.activateWidget(existing.id);
            else await open(opener, uri);
            return await current();
        }
        return false;
    } };
}
