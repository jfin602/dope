export const WorkspaceMode = {
    BUILD: 'BUILD',
    PLAN: 'PLAN'
} as const;

export type WorkspaceMode = typeof WorkspaceMode[keyof typeof WorkspaceMode];

export function parseWorkspaceMode(value: unknown): WorkspaceMode {
    return value === WorkspaceMode.PLAN ? WorkspaceMode.PLAN : WorkspaceMode.BUILD;
}

export class WorkspaceModeService {
    private value: WorkspaceMode = WorkspaceMode.BUILD;
    private readonly listeners = new Set<(mode: WorkspaceMode) => void>();

    get current(): WorkspaceMode { return this.value; }

    set(mode: WorkspaceMode): void {
        if (this.value === mode) return;
        this.value = mode;
        for (const listener of this.listeners) listener(mode);
    }

    onChange(listener: (mode: WorkspaceMode) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }
}
