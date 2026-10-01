import { createHash, randomUUID } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import type { AdoptionAcceptance, AdoptionRequest, PlanningCollection, PlanningMutation, RebaseAcceptance, RebaseRequest, VisualPlanningService } from '@dope/visual-planning/lib/service';
import { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import { previewTransformation } from '@dope/visual-planning/lib/editing';
import { detectActiveConflicts } from '@dope/visual-planning';
import { captureReality, previewRebase, stalePlanningMap } from '@dope/visual-planning/lib/rebase';
import { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';
import { readInitialization, replaceArchitecture } from '@dope/code-analysis/lib/node/smap-initialization-file';
import { readArchitecture } from '@dope/code-analysis/lib/node/architecture-file';
import type { EditCommand } from '@dope/visual-planning/lib/editing';

export class VisualPlanningBackend implements VisualPlanningService {
  private root?: string;
  private handle?: string;
  private projectId?: string;
  private disposed = false;
  private attaching = 0;

  constructor(private readonly store: PlanningStore, private readonly index?: SoftwareMapIndex) {}

  private async reality(root: string) {
    const status = this.index?.status(root), snapshot = this.index?.snapshot(root);
    if (status?.state !== 'ready' || !snapshot || status.generation !== snapshot.metadata.generation ||
      status.inputFingerprint !== snapshot.metadata.inputFingerprint) throw new Error('Current Software Map is unavailable');
    const state = await readInitialization(root);
    if (!state.initialized) throw new Error('Canonical architecture is unavailable');
    const architecture = (await readArchitecture(root)).architecture;
    if (state.declarationFingerprint !== (await readInitialization(root)).declarationFingerprint)
      throw new Error('Canonical architecture changed during rebase');
    const sourceHashes: Record<string, string> = {};
    for (const path of new Set(snapshot.nodes.filter(node => node.kind === 'code').map(node => node.path))) {
      const file = await realpath(join(root, path));
      const within = relative(root, file);
      if (!within || within === '..' || within.startsWith('../') || isAbsolute(within)) throw new Error('Unsafe Software Map source');
      sourceHashes[path] = createHash('sha256').update(await readFile(file)).digest('hex');
    }
    if (this.index?.status(root).generation !== status.generation) throw new Error('Software Map generation changed during rebase');
    return captureReality({ architectureRevision: 0, architectureFingerprint: state.declarationFingerprint,
      physicalInputFingerprint: snapshot.metadata.inputFingerprint, physicalGeneration: snapshot.metadata.generation }, architecture, snapshot, sourceHashes);
  }

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
  async preview(projectHandle: string, mapId: string, expectedRevision: number, expectedMapRevision: number,
    command: EditCommand, transformationId: string) {
    const root = this.active(projectHandle);
    const collection = await this.read(projectHandle);
    const map = collection.maps.find(item => item.id === mapId);
    if (collection.revision !== expectedRevision || !map || map.revision !== expectedMapRevision)
      throw new Error('Stale planning revision');
    if ((await readInitialization(root)).declarationFingerprint !== map.basis.architectureFingerprint)
      throw new Error('Stale Planning Map architecture basis');
    const architecture = (await readArchitecture(root)).architecture;
    return previewTransformation(architecture, map, command, transformationId);
  }
  async mutate(request: PlanningMutation) {
    if (!request || typeof request !== 'object') throw new Error('Invalid planning mutation');
    const root = this.active(request.projectHandle);
    const snapshot = await this.store.mutate(root, request.expectedRevision, request.operation, this.projectId,
      request.operation.type === 'create' && this.index ? () => this.reality(root) : undefined);
    this.projectId = snapshot.projectId;
    return snapshot;
  }
  async staleness(projectHandle: string, mapId: string) {
    const root = this.active(projectHandle), map = (await this.read(projectHandle)).maps.find(item => item.id === mapId);
    if (!map) throw new Error('Unknown planning map');
    return stalePlanningMap(map, await this.reality(root));
  }
  async previewRebase(request: RebaseRequest) {
    const root = this.active(request.projectHandle), collection = await this.read(request.projectHandle);
    const map = collection.maps.find(item => item.id === request.mapId);
    if (collection.revision !== request.expectedRevision || !map || map.revision !== request.expectedMapRevision ||
      JSON.stringify(map.basis) !== JSON.stringify(request.expectedBasis)) throw new Error('Stale planning revision');
    const current = await this.reality(root);
    if (JSON.stringify(current.basis) !== JSON.stringify(request.expectedCurrentBasis)) throw new Error('Current Software Map basis changed');
    return previewRebase(map, current);
  }
  async acceptRebase(request: RebaseAcceptance) {
    const root = this.active(request.projectHandle);
    const snapshot = await this.store.rebase(root, request, () => this.reality(root), this.projectId);
    this.projectId = snapshot.projectId;
    return snapshot;
  }
  async previewAdoption(request: AdoptionRequest) {
    const root = this.active(request.projectHandle);
    const state = await readInitialization(root);
    if (!state.initialized || state.declarationFingerprint !== request.expectedBasis.architectureFingerprint)
      throw new Error('Stale canonical architecture basis');
    return this.store.previewAdoption(root, request);
  }
  async adoptTarget(request: AdoptionAcceptance) {
    const root = this.active(request.projectHandle);
    const state = await readInitialization(root);
    if (!state.initialized || state.declarationFingerprint !== request.expectedBasis.architectureFingerprint)
      throw new Error('Stale canonical architecture basis');
    const snapshot = await this.store.adopt(root, request, this.projectId,
      (fingerprint, declaration, beforeCommit) => replaceArchitecture(root, fingerprint, declaration, beforeCommit));
    this.projectId = snapshot.projectId;
    return snapshot;
  }
  dispose(): void { this.disposed = true; }
}
