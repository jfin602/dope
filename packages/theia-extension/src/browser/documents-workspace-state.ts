/** Presentation selection only. Proposal authority stays with its originating owner. */
export type DocumentsMode = 'explorer' | 'docs-proposal' | 'prompt-stack';
export type DocumentsStatus = 'empty' | 'pending' | 'ready' | 'error';

export interface DocumentsSelection {
    mode: DocumentsMode;
    projectUri?: string;
    selectedPath?: string;
    candidateId?: string;
    status: DocumentsStatus;
    error?: string;
}

export class DocumentsWorkspaceState {
    private current: DocumentsSelection = { mode: 'explorer', status: 'empty' };

    get selection(): Readonly<DocumentsSelection> { return this.current; }

    /** A changed or unavailable workspace invalidates all proposal and path selection. */
    setProject(projectUri?: string): void {
        if (this.current.projectUri === projectUri) return;
        this.current = { mode: 'explorer', projectUri, status: 'empty' };
    }

    selectExplorer(path?: string): void {
        this.current = { mode: 'explorer', projectUri: this.current.projectUri,
            selectedPath: path, status: path ? 'ready' : 'empty' };
    }

    /** An explicit current-owner handoff is required; this state never rehydrates candidates. */
    selectCandidate(mode: 'docs-proposal' | 'prompt-stack', projectUri: string, candidateId: string, path?: string): boolean {
        if (!projectUri || !candidateId || this.current.projectUri !== projectUri) return false;
        this.current = { mode, projectUri, candidateId, selectedPath: path, status: 'pending' };
        return true;
    }

    setStatus(status: DocumentsStatus, error?: string): void {
        this.current = { ...this.current, status, error: status === 'error' ? error : undefined };
    }
}
