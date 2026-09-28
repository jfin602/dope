import { randomUUID } from 'node:crypto';
import type { PlanningClient, PlanningService } from '@dope/contracts/lib/planning-service';
import type { PlanningDocument, PlanningMutation } from '@dope/contracts/lib/planning';
import { PlanningStore } from '@dope/planning/lib/node/planning-store';
import { ProjectMindStore } from '@dope/project-intelligence/lib/node/project-mind-store';

function artifactLinks(snapshot: PlanningDocument): Map<string, Set<string>> {
    return new Map([...snapshot.plans, ...snapshot.tasks].map(item =>
        [item.id, new Set(item.links.flatMap(link => link.type === 'artifact' ? [link.id] : []))]));
}

export class PlanningBackend implements PlanningService {
    private root: string | undefined;
    private handle: string | undefined;
    private projectId: string | undefined;
    private readonly unlisten: () => void;
    private disposed = false;

    constructor(private readonly store: PlanningStore, private readonly mind: ProjectMindStore, client: PlanningClient) {
        this.unlisten = store.onChange((root, snapshot) => {
            if (!this.disposed && root === this.root) client.notifyPlanningChanged({ projectHandle: this.handle!, revision: snapshot.revision });
        });
    }

    async attach(folderUri: string) {
        if (this.disposed) throw new Error('Disposed Planning connection');
        const root = await this.store.root(folderUri);
        if (this.root && this.root !== root) throw new Error('A different Planning folder is already attached to this connection');
        const mind = await this.mind.read(root);
        if (this.projectId && mind?.projectId !== this.projectId) throw new Error('Project Mind identity changed; inspect both stores');
        const snapshot = await this.store.read(root);
        if (snapshot && mind?.projectId !== snapshot.projectId) throw new Error('Planning project identity mismatch; inspect both stores');
        this.root = root;
        this.projectId = mind?.projectId;
        this.handle ??= randomUUID();
        return { projectHandle: this.handle, snapshot, ...(!mind ? { prerequisite: 'project-mind' as const } : {}) };
    }

    private active(handle: string): string {
        if (this.disposed || !this.root || handle !== this.handle) throw new Error('Invalid or detached Planning handle');
        return this.root;
    }

    async read(projectHandle: string) {
        const root = this.active(projectHandle);
        const mind = await this.mind.read(root);
        if (mind?.projectId !== this.projectId) throw new Error('Project Mind identity changed; reattach after inspecting both stores');
        const snapshot = await this.store.read(root);
        if (snapshot && snapshot.projectId !== this.projectId) throw new Error('Planning project identity mismatch; inspect both stores');
        return snapshot;
    }

    async mutate(request: PlanningMutation) {
        if (!request || typeof request !== 'object') throw new Error('Invalid Planning mutation');
        const root = this.active(request.projectHandle);
        if (!this.projectId) throw new Error('Project Mind prerequisite: create a Project Mind artifact and reattach Planning');
        return this.store.mutate(root, this.projectId, request.expectedRevision, request.operation, async (current, next) => {
            const mind = await this.mind.read(root);
            if (!mind || mind.projectId !== this.projectId) throw new Error('Project Mind identity changed; inspect both stores');
            const before = artifactLinks(current);
            for (const [owner, ids] of artifactLinks(next)) {
                for (const id of ids) {
                    if (!before.get(owner)?.has(id) && !mind.artifacts.some(artifact => artifact.id === id)) {
                        throw new Error(`Unknown Project Mind artifact: ${id}`);
                    }
                }
            }
        });
    }

    dispose(): void { if (!this.disposed) { this.disposed = true; this.unlisten(); } }
}
