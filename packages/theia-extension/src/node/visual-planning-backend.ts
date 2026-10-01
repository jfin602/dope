import { randomUUID } from 'node:crypto';
import type { PlanningCollection, PlanningMutation, VisualPlanningService } from '@dope/visual-planning/lib/service';
import { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import { detectActiveConflicts } from '@dope/visual-planning';

export class VisualPlanningBackend implements VisualPlanningService {
  private root?: string;
  private handle?: string;
  private projectId?: string;
  private disposed = false;
  private attaching = 0;

  constructor(private readonly store: PlanningStore) {}

  async attach(folderUri: string) {
    if (this.disposed) throw new Error('Disposed planning connection');
    const request = ++this.attaching;
    const root = await this.store.root(folderUri);
    if (this.disposed || request !== this.attaching) throw new Error('Superseded planning attachment');
    if (this.root && this.root !== root) throw new Error('A different planning folder is already attached');
    const snapshot = await this.store.read(root);
    if (this.disposed || request !== this.attaching) throw new Error('Superseded planning attachment');
    if (this.projectId && snapshot.projectId !== this.projectId) throw new Error('Planning identity changed; reattach');
    this.root = root;
    this.projectId = snapshot.revision ? snapshot.projectId : undefined;
    this.handle ??= randomUUID();
    return { projectHandle: this.handle, snapshot };
  }

  private active(projectHandle: string): string {
    if (this.disposed || !this.root || projectHandle !== this.handle) throw new Error('Invalid or disposed planning handle');
    return this.root;
  }

  async read(projectHandle: string): Promise<PlanningCollection> {
    const snapshot = await this.store.read(this.active(projectHandle));
    if (this.projectId && snapshot.projectId !== this.projectId) throw new Error('Planning identity changed; reattach');
    this.projectId = snapshot.revision ? snapshot.projectId : undefined;
    return snapshot;
  }
  async list(projectHandle: string) { return (await this.read(projectHandle)).maps; }
  async get(projectHandle: string, mapId: string) { return (await this.read(projectHandle)).maps.find(map => map.id === mapId); }
  async conflicts(projectHandle: string) {
    return detectActiveConflicts((await this.read(projectHandle)).maps);
  }
  async mutate(request: PlanningMutation) {
    if (!request || typeof request !== 'object') throw new Error('Invalid planning mutation');
    const snapshot = await this.store.mutate(this.active(request.projectHandle), request.expectedRevision, request.operation, this.projectId);
    this.projectId = snapshot.projectId;
    return snapshot;
  }
  dispose(): void { this.disposed = true; }
}
