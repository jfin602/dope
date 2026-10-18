import { createHash, randomUUID } from 'node:crypto';
import { readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import type { AdoptionAcceptance, AdoptionRequest, CurrentSoftwareImpactPacket, CurrentSoftwareImpactRequest, PlanningCollection, PlanningMutation, RebaseAcceptance, RebaseRequest, VisualPlanningService } from '@dope/visual-planning/lib/service';
import { PlanningStore } from '@dope/visual-planning/lib/node/planning-store';
import { previewTransformation } from '@dope/visual-planning/lib/editing';
import { detectActiveConflicts, sameObservation } from '@dope/visual-planning';
import { captureReality, previewRebase, stalePlanningMap } from '@dope/visual-planning/lib/rebase';
import { SoftwareMapIndex } from '@dope/code-analysis/lib/node/software-map-index';
import { readInitialization, replaceArchitecture } from '@dope/code-analysis/lib/node/smap-initialization-file';
import { readArchitecture } from '@dope/code-analysis/lib/node/architecture-file';
import type { EditCommand } from '@dope/visual-planning/lib/editing';
import { RoadmapStore } from '@dope/project-intelligence/lib/node/roadmap-store';

export class VisualPlanningBackend implements VisualPlanningService {
  private root?: string;
  private handle?: string;
  private projectId?: string;
  private disposed = false;
  private attaching = 0;

  constructor(private readonly store: PlanningStore, private readonly index?: SoftwareMapIndex,
    private readonly roadmap?: RoadmapStore) {}

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
    if (this.index?.status(root).generation !== status.generation || !await this.index?.inputsCurrent(root))
      throw new Error('Software Map inputs or generation changed; analyze again');
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
    const status = this.index?.status(root);
    if (this.index && (!status || status.state !== 'ready' ||
      status.inputFingerprint !== map.basis.physicalInputFingerprint ||
      !await this.index.inputsCurrent(root))) throw new Error('Stale Planning Map basis');
    if ((await readInitialization(root)).declarationFingerprint !== map.basis.architectureFingerprint)
      throw new Error('Stale Planning Map architecture basis');
    const architecture = (await readArchitecture(root)).architecture;
    if (this.index && this.index.status(root).generation !== status?.generation)
      throw new Error('Software Map generation changed during preview');
    return previewTransformation(architecture, map, command, transformationId);
  }
  async mutate(request: PlanningMutation) {
    if (!request || typeof request !== 'object') throw new Error('Invalid planning mutation');
    const root = this.active(request.projectHandle);
    // ponytail: analyze under the planning lock so stale requests cannot publish a fresh generation; revisit if lock latency matters.
    const observed = request.operation.type === 'reconcile' ? async () => {
      if (!this.index) throw new Error('Software Map analysis is unavailable');
      const status = await this.index.analyze(root);
      if (status.state !== 'ready' || status.analysis.completeness !== 'complete') throw new Error('Fresh Software Map analysis did not complete');
      return this.reality(root);
    } : ['create', 'closeout'].includes(request.operation.type) && this.index ? () => this.reality(root) : undefined;
    const snapshot = await this.store.mutate(root, request.expectedRevision, request.operation, this.projectId,
      observed);
    this.projectId = snapshot.projectId;
    return snapshot;
  }
  async staleness(projectHandle: string, mapId: string) {
    const root = this.active(projectHandle), map = (await this.read(projectHandle)).maps.find(item => item.id === mapId);
    if (!map) throw new Error('Unknown planning map');
    return stalePlanningMap(map, await this.reality(root));
  }
  async currentBasis(projectHandle: string) { return (await this.reality(this.active(projectHandle))).basis; }
  async currentSoftwareImpact(request: CurrentSoftwareImpactRequest): Promise<CurrentSoftwareImpactPacket> {
    const root = this.active(request.projectHandle);
    const limits = { maxBranches: 8, maxPaths: 24, maxRelationships: 24, maxBytes: 12_000, truncated: false };
    const branchIds = Array.isArray(request.branchIds) ? request.branchIds : [];
    const action = (kind: 'analyze-software-map' | 'refocus-branches') =>
      ({ kind, branchIds: branchIds.slice(0, limits.maxBranches), explicit: true as const });
    const empty = (status: CurrentSoftwareImpactPacket['status'], reason: string,
      kind: 'analyze-software-map' | 'refocus-branches' = 'analyze-software-map'): CurrentSoftwareImpactPacket =>
      ({ status, reason, branches: [], sources: [], relationships: [], uncertainties: [reason], limits, action: action(kind) });
    if (!this.roadmap) return empty('unavailable', 'Roadmap evidence owner is unavailable');
    const roadmap = await this.roadmap.read(root);
    const planning = await this.read(request.projectHandle);
    if (!request.projectId || roadmap.projectId !== request.projectId)
      return empty('unavailable', 'Foreign or unavailable project');
    if (roadmap.revision !== request.expectedRoadmapRevision)
      return empty('stale', 'Roadmap checkpoint revision changed', 'refocus-branches');
    const checkpoint = roadmap.checkpoints.find(item => item.id === request.checkpointId);
    if (!checkpoint) return empty('unavailable', 'Selected checkpoint is unavailable', 'refocus-branches');
    if (!branchIds.length || branchIds.length > limits.maxBranches || new Set(branchIds).size !== branchIds.length)
      return empty('ambiguous', 'Select one to eight distinct canonical Architecture branches', 'refocus-branches');
    const status = this.index?.status(root);
    if (!status || status.state !== 'ready' || status.analysis.completeness !== 'complete' ||
      status.generation !== status.publishedGeneration)
      return empty('unavailable', 'Complete Software Map analysis is unavailable');
    let initialized: Awaited<ReturnType<typeof readInitialization>>;
    try { initialized = await readInitialization(root); }
    catch { return empty('stale', 'Canonical Architecture declaration changed; review it before impact'); }
    if (!initialized.initialized || !initialized.declarationPresent)
      return empty('unavailable', 'Initialized canonical Architecture is unavailable');
    let observed: Awaited<ReturnType<VisualPlanningBackend['reality']>>;
    try { observed = await this.reality(root); }
    catch { return empty('stale', 'Software Map, source, or canonical Architecture changed; analyze again'); }
    const mapLinks = checkpoint.links.filter(link => link.owner === 'planning-map');
    if (mapLinks.length > 1) return empty('ambiguous', 'Checkpoint links more than one Planning Map; select a single reviewed scope', 'refocus-branches');
    let planningMap: CurrentSoftwareImpactPacket['planningMap'];
    if (mapLinks.length) {
      const link = mapLinks[0], map = planning.maps.find(item => item.id === link.targetId);
      if (link.ownerProjectId !== planning.projectId || !map || map.projectId !== planning.projectId ||
        link.ownerRevision !== map.revision || !link.basis || !sameObservation(link.basis, map.basis))
        return empty('stale', 'Checkpoint Planning Map link requires re-review', 'refocus-branches');
      const rebase = previewRebase(map, observed);
      if (rebase.conflicts.length || !sameObservation(map.basis, observed.basis))
        return empty('stale', 'Linked Planning Map basis or branch changed; review rebase before impact', 'refocus-branches');
      planningMap = { id: map.id, revision: map.revision, rebaseConflicts: rebase.conflicts.length };
    }
    const snapshot = this.index?.snapshot(root);
    if (!snapshot || snapshot.metadata.projectId !== 'project:root' ||
      snapshot.metadata.analysis.completeness !== 'complete')
      return empty('unavailable', 'Current Software Map snapshot is unavailable');
    const allBranches = observed.architecture.systems.flatMap(system => [
      { id: system.id, kind: 'system' as const, name: system.name, purpose: system.purpose },
      ...system.subsystems.flatMap(sub => [
        { id: sub.id, kind: 'subsystem' as const, name: sub.name, purpose: sub.purpose },
        ...(sub.components ?? []).map(component => ({ id: component.id, kind: 'component' as const,
          name: component.name, purpose: component.purpose }))
      ])
    ]);
    const selected = branchIds.map(id => allBranches.find(branch => branch.id === id));
    if (selected.some(branch => !branch)) return empty('ambiguous', 'Selected Architecture branch is missing or changed', 'refocus-branches');
    const nodes = new Map(snapshot.nodes.map(node => [node.id, node]));
    const inBranch = (id: string): boolean => {
      const seen = new Set<string>();
      for (let cursor: string | undefined = id; cursor && !seen.has(cursor); cursor = nodes.get(cursor)?.parentId) {
        if (branchIds.includes(cursor)) return true;
        seen.add(cursor);
      }
      return false;
    };
    const relevant = snapshot.nodes.filter(node => inBranch(node.id));
    const paths = new Map<string, Set<string>>();
    const evidence = new Map(snapshot.evidence.map(item => [item.id, item]));
    for (const node of relevant) {
      if (node.kind !== 'code') continue;
      const refs = paths.get(node.path) ?? new Set<string>();
      for (const id of node.evidenceIds) if (evidence.get(id)?.path === node.path) refs.add(id);
      paths.set(node.path, refs);
    }
    const allSources = [...paths].sort(([a], [b]) => a.localeCompare(b));
    const allRelationships = snapshot.relationships.filter(edge =>
      inBranch(edge.sourceId) || inBranch(edge.targetId)).sort((a, b) => a.id.localeCompare(b.id));
    const clip = (value: string, size: number) => value.length > size ? value.slice(0, size) : value;
    const packet: CurrentSoftwareImpactPacket = { status: 'ready',
      checkpoint: { id: checkpoint.id, title: clip(checkpoint.title, 256), objective: clip(checkpoint.objective, 1200),
        requirements: [clip(checkpoint.objective, 1200)] }, roadmapRevision: roadmap.revision,
      basis: observed.basis, ...(planningMap ? { planningMap } : {}),
      branches: selected.map(branch => ({ ...branch!, name: clip(branch!.name, 128), purpose: clip(branch!.purpose, 512) })),
      sources: allSources.slice(0, limits.maxPaths).map(([path, ids]) =>
        ({ path, evidenceIds: [...ids].sort().slice(0, 8) })),
      relationships: allRelationships.slice(0, limits.maxRelationships).map(edge =>
        ({ kind: edge.kind, sourceId: edge.sourceId, targetId: edge.targetId })),
      uncertainties: ['Roadmap objective is the only structured checkpoint requirement at this stage; branch selection is explicit, not semantic alignment'],
      limits, action: action('refocus-branches') };
    if (allSources.length > packet.sources.length) {
      limits.truncated = true;
      packet.uncertainties.push(`${allSources.length - packet.sources.length} source paths omitted`);
    }
    if (allRelationships.length > packet.relationships.length)
      { limits.truncated = true; packet.uncertainties.push(`${allRelationships.length - packet.relationships.length} relationships omitted`); }
    if (allSources.some(([, ids]) => ids.size > 8)) {
      limits.truncated = true;
      packet.uncertainties.push('Additional source evidence IDs omitted');
    }
    if (!packet.sources.length) packet.uncertainties.push('Selected branches have no mapped source paths');
    while (Buffer.byteLength(JSON.stringify(packet)) > limits.maxBytes && (packet.relationships.length || packet.sources.length)) {
      if (packet.relationships.length) packet.relationships.pop();
      else packet.sources.pop();
      limits.truncated = true;
    }
    if (limits.truncated) packet.uncertainties.push('Evidence is bounded; refocus branches for more detail');
    while (Buffer.byteLength(JSON.stringify(packet)) > limits.maxBytes && (packet.relationships.length || packet.sources.length)) {
      if (packet.relationships.length) packet.relationships.pop();
      else packet.sources.pop();
      limits.truncated = true;
    }
    if (Buffer.byteLength(JSON.stringify(packet)) > limits.maxBytes)
      return empty('ambiguous', 'Selected branch metadata exceeds impact budget; refocus more narrowly', 'refocus-branches');
    if (this.index?.status(root).generation !== observed.basis.physicalGeneration || !await this.index?.inputsCurrent(root) ||
      (await this.roadmap.read(root)).revision !== roadmap.revision ||
      planningMap && (await this.store.read(root)).revision !== planning.revision)
      return empty('stale', 'Source generation or checkpoint revision changed during impact read');
    return packet;
  }
  async previewRebase(request: RebaseRequest) {
    const root = this.active(request.projectHandle), collection = await this.read(request.projectHandle);
    const map = collection.maps.find(item => item.id === request.mapId);
    if (collection.revision !== request.expectedRevision || !map || map.revision !== request.expectedMapRevision ||
      !sameObservation(map.basis, request.expectedBasis)) throw new Error('Stale planning revision');
    const current = await this.reality(root);
    if (!sameObservation(current.basis, request.expectedCurrentBasis)) throw new Error('Current Software Map basis changed');
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
