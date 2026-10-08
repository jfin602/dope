export type PanelMode = 'chat' | 'work';
export type WorkSelection = { kind: 'task' | 'sequence'; id: string };

export interface SharedPanelLayout {
    version: 2;
    workspace?: string;
    panelMode: PanelMode;
    chatId?: string;
    work?: WorkSelection;
}

export function readSharedPanelLayout(value: object): SharedPanelLayout | undefined {
    const state = value as Record<string, unknown>;
    if (state?.version !== 1 && state?.version !== 2 || typeof state.workspace !== 'string') return undefined;
    if (state.version === 1) {
        if (state.mode !== 'select-chat' && state.mode !== 'chat' ||
            state.mode === 'chat' && typeof state.chatId !== 'string') return undefined;
        return { version: 2, workspace: state.workspace, panelMode: 'chat',
            chatId: state.mode === 'chat' ? state.chatId as string : undefined };
    }
    if (state.panelMode !== 'chat' && state.panelMode !== 'work') return undefined;
    const work = state.work as Record<string, unknown> | undefined;
    return { version: 2, workspace: state.workspace, panelMode: state.panelMode,
        chatId: typeof state.chatId === 'string' ? state.chatId : undefined,
        work: work && (work.kind === 'task' || work.kind === 'sequence') &&
            typeof work.id === 'string' && !!work.id ? { kind: work.kind, id: work.id } : undefined };
}

/** Renderer-local presentation ownership; not an Agent Runtime mutation lock. */
export class WorkOpenOwners {
    private readonly owners = new Map<string, { panelId: string; focus: () => void; displaced: () => void }>();
    private key(workspace: string, work: WorkSelection): string {
        return JSON.stringify([workspace, work.kind, work.id]);
    }
    reserve(workspace: string, work: WorkSelection, panelId: string, focus: () => void,
        displaced: () => void, restoring = false): boolean {
        const key = this.key(workspace, work);
        const owner = this.owners.get(key);
        if (owner && owner.panelId !== panelId) {
            if (!restoring || panelId.localeCompare(owner.panelId) >= 0) {
                if (!restoring) owner.focus();
                return false;
            }
            owner.displaced();
        }
        this.owners.set(key, { panelId, focus, displaced });
        return true;
    }
    release(workspace: string, work: WorkSelection, panelId: string): void {
        const key = this.key(workspace, work);
        if (this.owners.get(key)?.panelId === panelId) this.owners.delete(key);
    }
}

export class SharedPanelState {
    mode: PanelMode = 'chat';
    workspace?: string;
    work?: WorkSelection;
    private restored?: SharedPanelLayout;
    private disposed = false;

    constructor(private readonly owners: WorkOpenOwners, private readonly panelId: string,
        private readonly focus: () => void, private readonly changed: () => void) { }

    setMode(mode: PanelMode): void {
        if (this.disposed || this.mode === mode) return;
        this.mode = mode;
        this.changed();
    }
    attach(workspace: string | undefined): void {
        if (this.disposed) return;
        if (this.workspace && this.work) this.owners.release(this.workspace, this.work, this.panelId);
        this.workspace = workspace;
        this.work = undefined;
        if (workspace && this.restored) {
            const state = this.restored;
            this.restored = undefined;
            if (state.workspace === workspace) {
                this.mode = state.panelMode;
                if (state.work) this.selectWork(state.work, true);
            } else this.mode = 'chat';
        }
        this.changed();
    }
    restore(state: SharedPanelLayout): void {
        if (this.disposed || this.workspace && this.workspace !== state.workspace) return;
        this.mode = state.panelMode;
        this.restored = state;
        if (this.workspace) this.attach(this.workspace);
        else this.changed();
    }
    selectWork(work: WorkSelection | undefined, restoring = false): boolean {
        if (this.disposed || !this.workspace || work && !work.id.trim()) return false;
        if (this.work && work?.kind === this.work.kind && work.id === this.work.id) {
            if (!restoring) this.setMode('work');
            return true;
        }
        if (work && !this.owners.reserve(this.workspace, work, this.panelId, this.focus, () => {
            if (this.work?.kind === work.kind && this.work.id === work.id) {
                this.work = undefined;
                this.changed();
            }
        }, restoring)) return false;
        if (this.work) this.owners.release(this.workspace, this.work, this.panelId);
        this.work = work;
        if (work && !restoring) this.mode = 'work';
        this.changed();
        return true;
    }
    layout(chatId?: string): SharedPanelLayout {
        return { version: 2, workspace: this.workspace, panelMode: this.mode, chatId, work: this.work };
    }
    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        if (this.workspace && this.work) this.owners.release(this.workspace, this.work, this.panelId);
        this.restored = undefined;
    }
}
