import { randomUUID } from 'node:crypto';
import type { ProjectMindClient, ProjectMindService } from '@dope/contracts/lib/project-mind-service';
import type { ProjectMindMutation } from '@dope/contracts/lib/project-mind';
import { ProjectMindStore } from '@dope/project-intelligence/lib/node/project-mind-store';

export class ProjectMindBackend implements ProjectMindService {
    private root: string | undefined;
    private handle: string | undefined;
    private projectId: string | undefined;
    private readonly unlisten: () => void;
    private disposed = false;

    constructor(private readonly store: ProjectMindStore, client: ProjectMindClient) {
        this.unlisten = store.onChange((root, snapshot) => {
            if (!this.disposed && root === this.root) client.notifyProjectMindChanged({ projectId: snapshot.projectId, revision: snapshot.revision });
        });
    }

    async attach(folderUri: string) {
        if (this.disposed) throw new Error('Disposed Project Mind connection');
        const root = await this.store.root(folderUri);
        if (this.root && this.root !== root) throw new Error('A different Project Mind folder is already attached to this connection');
        const snapshot = await this.store.read(root);
        if (this.projectId && snapshot?.projectId !== this.projectId) throw new Error('Project Mind identity changed; inspect the snapshot');
        this.root = root;
        this.projectId = snapshot?.projectId;
        this.handle ??= randomUUID();
        return { projectHandle: this.handle, snapshot };
    }

    private active(handle: string): string {
        if (this.disposed || !this.root || handle !== this.handle) throw new Error('Invalid or detached Project Mind handle');
        return this.root;
    }

    async read(projectHandle: string) {
        const snapshot = await this.store.read(this.active(projectHandle));
        if (this.projectId && snapshot?.projectId !== this.projectId) throw new Error('Project Mind identity changed; inspect the snapshot');
        this.projectId = snapshot?.projectId;
        return snapshot;
    }

    async mutate(request: ProjectMindMutation) {
        if (!request || typeof request !== 'object') throw new Error('Invalid Project Mind mutation');
        const snapshot = await this.store.mutate(this.active(request.projectHandle), request.expectedRevision, request.operation, this.projectId);
        this.projectId = snapshot.projectId;
        return snapshot;
    }

    async migrate(projectHandle: string) {
        const snapshot = await this.store.migrate(this.active(projectHandle));
        this.projectId = snapshot.projectId;
        return snapshot;
    }

    dispose(): void { if (!this.disposed) { this.disposed = true; this.unlisten(); } }
}
