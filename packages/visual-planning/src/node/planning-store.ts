import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { branchMap, canCloseOut, detectActiveConflicts, parsePlanningMap, sameObservation, sameSemanticBasis, transitionMap } from '../index';
import { reconcilePlanningMap } from '../reconciliation';
import { projectTarget } from '../index';
import { mergeWorkItems, putWorkItem, splitWorkItem } from '../work';
import { parseArchitecture } from '@dope/software-map';
import { createHash } from 'node:crypto';
import type { PlannedTransformation, PlanningMap } from '../index';
import type { PlanningCollection, PlanningOperation } from '../service';
import type { AdoptionAcceptance, AdoptionRequest } from '../service';
import { planAdoption } from '../adoption';
import type { AdoptionPreview } from '../adoption';
import type { ArchitectureDeclaration } from '@dope/software-map';
import { acceptRebase, previewRebase } from '../rebase';
import type { RebaseReality } from '../index';
import type { RebaseAcceptance } from '../service';

const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const bad = (place: string): never => { throw new Error(`Invalid planning collection: ${place}`); };
const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
const sameTarget = (a: PlannedTransformation, b: PlannedTransformation): boolean =>
  JSON.stringify({ ...a, resolution: undefined, deferredTo: undefined }) ===
  JSON.stringify({ ...b, resolution: undefined, deferredTo: undefined });

export function parsePlanningCollection(value: unknown): PlanningCollection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad('document');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(',') !== 'maps,projectId,revision,schemaVersion' || data.schemaVersion !== 1 ||
      typeof data.projectId !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(data.projectId) ||
      !validRevision(data.revision) || data.revision === 0 || !Array.isArray(data.maps)) bad('schema');
  const maps = (data.maps as unknown[]).map(parsePlanningMap).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(maps.map(map => map.id)).size !== maps.length || maps.some(map => map.projectId !== data.projectId)) bad('map identity');
  for (const map of maps.filter(map => map.history.some(entry => entry.action.startsWith('closeout:'))))
    for (const change of map.transformations.filter(t => t.resolution === 'deferred')) {
    if (!maps.some(target => target.id === change.deferredTo?.mapId && target.transformations.some(t => t.id === change.deferredTo?.transformationId)))
      bad('deferred map linkage');
  }
  return { schemaVersion: 1, projectId: data.projectId as string, revision: data.revision as number, maps };
}

export class PlanningStore {
  async root(uri: string): Promise<string> {
    if (typeof uri !== 'string') throw new Error('Planning requires a local folder');
    let url: URL;
    try { url = new URL(uri); } catch { throw new Error('Planning requires a local folder'); }
    if (url.protocol !== 'file:' || url.host) throw new Error('Planning requires a local folder');
    const root = await realpath(fileURLToPath(url));
    if (!(await stat(root)).isDirectory()) throw new Error('Planning requires a folder');
    return root;
  }

  private async paths(root: string) {
    if (typeof root !== 'string' || !isAbsolute(root) || resolve(root) !== root || await realpath(root) !== root || !(await stat(root)).isDirectory())
      throw new Error('Planning requires a canonical local root');
    const directory = join(root, '.dope');
    try {
      const info = await lstat(directory);
      if (!info.isDirectory() || info.isSymbolicLink() || await realpath(directory) !== directory) throw new Error('Unsafe planning directory');
    } catch (error) { if (!absent(error)) throw error; }
    return { directory, file: join(directory, 'planning-maps.json'), lock: join(directory, 'planning-maps.lock') };
  }

  private async regular(file: string): Promise<boolean> {
    try {
      const info = await lstat(file);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Unsafe planning file: ${file}`);
      return true;
    } catch (error) { if (absent(error)) return false; throw error; }
  }

  private async declaration(root: string): Promise<string> {
    const file = join(root, '.dope/architecture.json');
    if (!(await this.regular(file))) throw new Error('Missing canonical architecture');
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { if (!(await handle.stat()).isFile()) throw new Error('Unsafe architecture file'); return await handle.readFile('utf8'); }
    finally { await handle.close(); }
  }

  async read(root: string): Promise<PlanningCollection> {
    const { directory, file } = await this.paths(root);
    if (!(await this.regular(file))) return { schemaVersion: 1, projectId: 'uninitialized', revision: 0, maps: [] };
    const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      if (!(await handle.stat()).isFile() || await realpath(directory) !== directory) throw new Error('Unsafe planning file');
      const bytes = await handle.readFile({ encoding: 'utf8' });
      try { return parsePlanningCollection(JSON.parse(bytes)); }
      catch { throw new Error(`Corrupt or unsupported planning collection: ${file}`); }
    } finally { await handle.close(); }
  }

  private async acquire(lock: string): Promise<import('node:fs/promises').FileHandle> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const handle = await open(lock, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
        try { await handle.writeFile(`${process.pid}\n`); await handle.sync(); return handle; }
        catch (error) { await handle.close(); await rm(lock); throw error; }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        await this.regular(lock);
        const info = await lstat(lock);
        const reader = await open(lock, constants.O_RDONLY | constants.O_NOFOLLOW);
        let owner: string;
        try { owner = (await reader.readFile({ encoding: 'utf8' })).trim(); }
        finally { await reader.close(); }
        if (!/^[1-9]\d*$/.test(owner)) throw new Error(`Planning locked; inspect ${lock}`);
        try { process.kill(Number(owner), 0); throw new Error(`Planning locked; inspect ${lock}`); }
        catch (probe) {
          if ((probe as NodeJS.ErrnoException).code !== 'ESRCH') throw probe;
        }
        // ponytail: PID locks assume no PID reuse; use OS file locks if this becomes a practical collision.
        if ((await lstat(lock)).ino !== info.ino) throw new Error(`Planning lock changed; inspect ${lock}`);
        await rm(lock);
      }
    }
    throw new Error(`Planning locked; inspect ${lock}`);
  }

  private async write(root: string, next: PlanningCollection): Promise<void> {
    const { directory, file } = await this.paths(root);
    const temporary = join(directory, `planning-maps.${randomUUID()}.tmp`);
    let replaced = false;
    try {
      const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
      try { await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`); await handle.sync(); }
      finally { await handle.close(); }
      await this.regular(file);
      await rename(temporary, file);
      replaced = true;
      const parent = await open(directory, 'r');
      try { await parent.sync(); } finally { await parent.close(); }
    } catch (error) {
      if (replaced) throw new Error(`Planning write outcome uncertain; re-read before retrying: ${String(error)}`);
      throw error;
    } finally { await rm(temporary, { force: true }); }
  }

  async mutate(root: string, expectedRevision: number, operation: PlanningOperation, expectedProjectId?: string,
    reality?: () => Promise<RebaseReality>): Promise<PlanningCollection> {
    if (!validRevision(expectedRevision) || !operation || typeof operation !== 'object') throw new Error('Invalid planning mutation');
    const { directory, lock } = await this.paths(root);
    let created = false;
    try { await lstat(directory); } catch (error) { if (absent(error)) created = true; else throw error; }
    await mkdir(directory, { recursive: true });
    await this.paths(root);
    if (created) {
      const parent = await open(root, 'r');
      try { await parent.sync(); } finally { await parent.close(); }
    }
    const handle = await this.acquire(lock);
    try {
      const current = await this.read(root);
      if (expectedProjectId && current.projectId !== expectedProjectId) throw new Error('Planning identity changed; reattach');
      if (current.revision !== expectedRevision) throw new Error(`Stale planning revision; current ${current.revision}`);
      const projectId = current.revision ? current.projectId : `project-${randomUUID()}`;
      const now = new Date().toISOString();
      const maps = [...current.maps];
      const op = operation as PlanningOperation;
      if (op.type === 'create') {
        if (maps.some(map => map.id === op.id)) throw new Error('Planning map already exists');
        const snapshot = await reality?.();
        if (snapshot && !sameSemanticBasis(snapshot.basis, op.basis)) throw new Error('Stale Planning Map basis');
        maps.push(parsePlanningMap({ schemaVersion: 1, id: op.id, projectId, title: op.title, objective: op.objective,
          status: 'draft', revision: 0, history: [{ revision: 0, action: 'create', at: now }], basis: snapshot?.basis ?? op.basis,
          ...(snapshot ? { basisSnapshot: snapshot } : {}),
          transformations: [], workItems: [] }));
      } else {
        if (!('mapId' in op) || typeof op.mapId !== 'string') throw new Error('Invalid planning operation');
        const index = maps.findIndex(map => map.id === op.mapId);
        if (index < 0) throw new Error('Unknown planning map');
        const map = maps[index];
        if ('expectedMapRevision' in op && map.revision !== op.expectedMapRevision) throw new Error('Stale Planning Map revision');
        if ('expectedBasis' in op && (!op.expectedBasis || !sameSemanticBasis(map.basis, op.expectedBasis))) throw new Error('Stale Planning Map basis');
        if ('expectedBasis' in op) {
          const declaration = await this.declaration(root);
          if (createHash('sha256').update(declaration).digest('hex') !== map.basis.architectureFingerprint)
            throw new Error('Stale Planning Map architecture basis');
        }
        if ((op.type === 'put-transformation' && (op.transformation.adopted !== undefined || op.transformation.resolution !== undefined ||
            map.transformations.some(t => t.id === op.transformation.id && t.adopted))) ||
            (op.type === 'remove-transformation' && map.transformations.some(t => t.id === op.transformationId && t.adopted)) ||
            ((op.type === 'undo' || op.type === 'redo') && map.transformations.some(t => t.adopted)))
          throw new Error('Adopted transformations cannot be edited');
        if (op.type === 'duplicate') {
          if (maps.some(item => item.id === op.newId)) throw new Error('Planning map already exists');
          maps.push(branchMap(map, op.newId, now));
        } else if (op.type === 'transition') maps[index] = transitionMap(map, op.status, now);
        else {
          if (map.status !== 'draft' && map.status !== 'active') throw new Error('Planning map is closed');
          let changed: PlanningMap;
          switch (op.type) {
            case 'reconcile': {
              if (!reality) throw new Error('Software Map analysis is unavailable');
              const observed = await reality();
              changed = { ...map, reconciliation: reconcilePlanningMap(map, observed, now),
                transformations: map.transformations.map(t => ({ ...t, resolution: undefined, deferredTo: undefined })) };
              break;
            }
            case 'disposition': {
              if (!map.reconciliation) throw new Error('Reconcile before disposition');
              const target = map.transformations.find(t => t.id === op.transformationId);
              const outcome = map.reconciliation.results.find(r => r.transformationId === op.transformationId)?.outcome;
              if (!target || !outcome || op.resolution === 'as-planned' && outcome !== 'implemented-as-planned' ||
                op.resolution === 'accepted-different' && outcome !== 'implemented-differently') throw new Error('Invalid reconciliation disposition');
              if (op.resolution === 'deferred') {
                const destination = maps.find(item => item.id === op.deferredToMapId && item.id !== map.id &&
                  (item.status === 'draft' || item.status === 'active'));
                const carried = destination?.transformations.find(t => t.id === target.id);
                if (!carried || !sameTarget(carried, target)) throw new Error('Deferral requires a matching transformation in another active Planning Map');
              } else if (op.deferredToMapId !== undefined) throw new Error('Invalid deferral target');
              changed = { ...map, transformations: map.transformations.map(t => t.id === target.id ? { ...t,
                resolution: op.resolution, deferredTo: op.resolution === 'deferred' ?
                  { mapId: op.deferredToMapId!, transformationId: target.id } : undefined } : t) };
              break;
            }
            case 'closeout': {
              if (map.status !== 'active' || !canCloseOut(map) || !reality) throw new Error('Unresolved Planning Map closeout');
              const observed = await reality();
              if (!sameSemanticBasis(map.reconciliation!.basis, observed.basis))
                throw new Error('Stale reconciliation; analyze and reconcile again');
              for (const t of map.transformations.filter(t => t.resolution === 'deferred')) {
                const destination = maps.find(item => item.id === t.deferredTo?.mapId && (item.status === 'draft' || item.status === 'active'));
                const carried = destination?.transformations.find(item => item.id === t.deferredTo?.transformationId);
                if (!carried) throw new Error('Deferred Planning Map linkage changed');
              }
              changed = { ...map, status: 'completed' };
              break;
            }
            case 'update': changed = { ...map, title: op.title, objective: op.objective }; break;
            case 'put-transformation': changed = { ...map, transformations: [...map.transformations.filter(item => item.id !== op.transformation?.id), op.transformation] }; break;
            case 'remove-transformation': changed = { ...map, transformations: map.transformations.filter(item => item.id !== op.transformationId) }; break;
            case 'undo': case 'redo': {
              const past = map.editHistory ?? { undo: [], redo: [] };
              const source = op.type === 'undo' ? past.undo : past.redo;
              if (!source.length) throw new Error(`Nothing to ${op.type}`);
              changed = { ...map, transformations: source.at(-1)!, editHistory: {
                undo: op.type === 'undo' ? source.slice(0, -1) : [...past.undo, map.transformations],
                redo: op.type === 'redo' ? source.slice(0, -1) : [...past.redo, map.transformations]
              } };
              break;
            }
            case 'put-work-item': changed = putWorkItem(map, op.workItem); break;
            case 'split-work-item': changed = splitWorkItem(map, op.sourceId, op.parts); break;
            case 'merge-work-items': changed = mergeWorkItems(map, op.sourceIds, op.merged); break;
            case 'remove-work-item': changed = { ...map, workItems: map.workItems.filter(item => item.id !== op.workItemId) }; break;
            default: throw new Error('Invalid planning operation');
          }
          if (op.type.startsWith('remove-') && changed.transformations.length === map.transformations.length && changed.workItems.length === map.workItems.length)
            throw new Error('Unknown planning item');
          if (op.type === 'put-transformation' || op.type === 'remove-transformation') changed.editHistory = {
            undo: [...(map.editHistory?.undo ?? []), map.transformations], redo: [] };
          if (['put-transformation', 'remove-transformation', 'undo', 'redo'].includes(op.type)) {
            changed.reconciliation = undefined;
            changed.transformations = changed.transformations.map(t => ({ ...t, resolution: undefined, deferredTo: undefined }));
          }
          if ('expectedBasis' in op) {
            const declaration = parseArchitecture(JSON.parse(await this.declaration(root)));
            projectTarget(declaration, parsePlanningMap({ ...changed, revision: map.revision + 1,
              history: [...map.history, { revision: map.revision + 1, action: op.type, at: now }] }));
          }
          const subject = 'transformation' in op ? op.transformation?.id : 'transformationId' in op ? op.transformationId :
            'workItem' in op ? op.workItem?.id : 'workItemId' in op ? op.workItemId : map.id;
          maps[index] = parsePlanningMap({ ...changed, revision: map.revision + 1,
            history: [...map.history, { revision: map.revision + 1, action: `${op.type}:${subject}`, at: now }] });
        }
      }
      const next = parsePlanningCollection({ schemaVersion: 1, projectId, revision: current.revision + 1, maps });
      await this.write(root, next);
      return next;
    } finally {
      const acquired = await handle.stat();
      await handle.close();
      try { if ((await lstat(lock)).ino !== acquired.ino) throw new Error('Planning lock changed; inspect it'); await rm(lock); }
      catch (error) { if (!absent(error)) throw error; }
    }
  }

  async rebase(root: string, request: RebaseAcceptance, reality: () => Promise<RebaseReality>, expectedProjectId?: string): Promise<PlanningCollection> {
    const { lock } = await this.paths(root);
    const handle = await this.acquire(lock);
    try {
      const collection = await this.read(root);
      if (expectedProjectId && collection.projectId !== expectedProjectId) throw new Error('Planning identity changed; reattach');
      const map = collection.maps.find(item => item.id === request.mapId);
      if (collection.revision !== request.expectedRevision || !map || map.revision !== request.expectedMapRevision ||
        !sameObservation(map.basis, request.expectedBasis)) throw new Error('Stale planning revision');
      if (map.status !== 'draft' && map.status !== 'active') throw new Error('Planning map is closed');
      const current = await reality();
      if (!sameObservation(current.basis, request.expectedCurrentBasis)) throw new Error('Current Software Map basis changed');
      const preview = previewRebase(map, current);
      const changed = acceptRebase(map, preview, request.decisions, new Date().toISOString());
      const next = parsePlanningCollection({ ...collection, revision: collection.revision + 1,
        maps: collection.maps.map(item => item.id === map.id ? changed : item) });
      await this.write(root, next);
      return next;
    } finally {
      const acquired = await handle.stat(); await handle.close();
      try { if ((await lstat(lock)).ino !== acquired.ino) throw new Error('Planning lock changed; inspect it'); await rm(lock); }
      catch (error) { if (!absent(error)) throw error; }
    }
  }

  async conflicts(root: string) { return detectActiveConflicts((await this.read(root)).maps); }

  private async adoptionPreview(root: string, request: AdoptionRequest, collection: PlanningCollection): Promise<AdoptionPreview> {
    const map = collection.maps.find(item => item.id === request.mapId);
    if (collection.revision !== request.expectedRevision || !map || map.revision !== request.expectedMapRevision ||
        !sameObservation(map.basis, request.expectedBasis)) throw new Error('Stale planning revision or basis');
    const bytes = await this.declaration(root);
    if (createHash('sha256').update(bytes).digest('hex') !== map.basis.architectureFingerprint)
      throw new Error('Stale Planning Map architecture basis');
    return planAdoption(parseArchitecture(JSON.parse(bytes)), map, request.scope);
  }

  async previewAdoption(root: string, request: AdoptionRequest): Promise<AdoptionPreview> {
    return this.adoptionPreview(root, request, await this.read(root));
  }

  async adopt(root: string, request: AdoptionAcceptance, expectedProjectId: string | undefined,
    writer: (expectedFingerprint: string, declaration: ArchitectureDeclaration, beforeCommit: () => Promise<() => Promise<void>>) => Promise<string>): Promise<PlanningCollection> {
    const { lock } = await this.paths(root);
    const handle = await this.acquire(lock);
    try {
      const current = await this.read(root);
      if (expectedProjectId && current.projectId !== expectedProjectId) throw new Error('Planning identity changed; reattach');
      const preview = await this.adoptionPreview(root, request, current);
      if (preview.blockers.length || !preview.declaration) throw new Error(`Adoption blocked: ${preview.blockers.join('; ')}`);
      const included = [...preview.selectedTransformationIds, ...preview.includedDependentTransformationIds].sort();
      if (JSON.stringify(request.acceptedChanges) !== JSON.stringify(preview.changes) ||
          JSON.stringify(request.acceptedTransformationIds) !== JSON.stringify(included)) throw new Error('Adoption diff was not accepted');
      const index = current.maps.findIndex(map => map.id === request.mapId);
      const map = current.maps[index];
      if (map.status !== 'draft' && map.status !== 'active') throw new Error('Planning map is closed');
      const revision = map.revision + 1;
      const changed = parsePlanningMap({ ...map, revision, history: [...map.history, { revision, action: `adopt:${included.join(',')}`, at: new Date().toISOString() }],
        transformations: map.transformations.map(t => ({ ...t, ...(included.includes(t.id) ? { adopted: true } : {}), resolution: undefined, deferredTo: undefined })),
        reconciliation: undefined,
        editHistory: { undo: [], redo: [] } });
      const maps = [...current.maps]; maps[index] = changed;
      const next = parsePlanningCollection({ ...current, revision: current.revision + 1, maps });
      await writer(map.basis.architectureFingerprint, preview.declaration, async () => {
        try { await this.write(root, next); }
        catch (error) {
          try { await this.write(root, current); }
          catch (restore) { throw new Error(`Planning adoption outcome uncertain: ${String(restore)}; original error: ${String(error)}`); }
          throw error;
        }
        return async () => this.write(root, current);
      });
      return next;
    } finally {
      const acquired = await handle.stat();
      await handle.close();
      try { if ((await lstat(lock)).ino !== acquired.ino) throw new Error('Planning lock changed; inspect it'); await rm(lock); }
      catch (error) { if (!absent(error)) throw error; }
    }
  }
}
