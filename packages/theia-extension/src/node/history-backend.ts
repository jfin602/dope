import { randomUUID } from 'node:crypto';
import { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import { projectHistory, proposeHistoryContinuation } from '@dope/contracts/lib/history';
import type { HistoryProject } from '@dope/contracts/lib/history';
import type { HistoryService, HistorySnapshot } from '@dope/contracts/lib/history-service';
import { readHistoryOwnerMetadata } from './history-owner-metadata';
import { readHistoryWorkGitMetadata } from './history-work-git';

/** Per-RPC-connection read-only projection. A late read cannot publish for a replaced root. */
export class HistoryBackend implements HistoryService {
    private project?: HistoryProject;
    private handle = randomUUID();
    private generation = 0;
    private disposed = false;

    constructor(private readonly planning = new PlanningStore()) {}

    async attach(folderUri: string): Promise<{ projectHandle: string }> {
        if (this.disposed) throw new Error('History connection disposed');
        const generation = ++this.generation;
        this.project = undefined;
        this.handle = randomUUID();
        const root = await this.planning.root(folderUri);
        const planning = await this.planning.read(root);
        if (this.disposed || generation !== this.generation) throw new Error('History attachment superseded');
        this.project = { projectRoot: root, projectId: planning.projectId };
        return { projectHandle: this.handle };
    }

    async read(projectHandle: string): Promise<HistorySnapshot> {
        if (this.disposed || !this.project || projectHandle !== this.handle) throw new Error('Invalid History project handle');
        const project = this.project, generation = this.generation;
        const planning = await this.planning.read(project.projectRoot);
        if (planning.projectId !== project.projectId) throw new Error('History project identity changed; reattach');
        const observedAt = new Date().toISOString();
        const [owner, work] = await Promise.all([
            readHistoryOwnerMetadata(project, observedAt), readHistoryWorkGitMetadata(project, observedAt)
        ]);
        if (this.disposed || generation !== this.generation || projectHandle !== this.handle)
            throw new Error('History project changed during read');
        if ((await this.planning.read(project.projectRoot)).projectId !== project.projectId)
            throw new Error('History project identity changed during read');
        const entries = projectHistory([...owner.entries, ...work.entries], project);
        return { project, entries, continueWith: proposeHistoryContinuation(project, entries),
            diagnostics: [...owner.diagnostics, ...work.diagnostics].slice(0, 20).map(item => ({
                source: item.source, message: item.message.slice(0, 200)
            })), truncated: owner.truncated || work.truncated || owner.entries.length + work.entries.length > entries.length };
    }

    dispose(): void { this.disposed = true; ++this.generation; this.project = undefined; }
}
