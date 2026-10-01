import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { branchMap, detectActiveConflicts, parsePlanningMap, transitionMap } from '../index';
import { projectTarget } from '../index';
import { parseArchitecture } from '@dope/software-map';
import { createHash } from 'node:crypto';
import type { PlanningMap } from '../index';
import type { PlanningCollection, PlanningOperation } from '../service';

const absent = (error: unknown): boolean => (error as NodeJS.ErrnoException).code === 'ENOENT';
const bad = (place: string): never => { throw new Error(`Invalid planning collection: ${place}`); };
const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;

export function parsePlanningCollection(value: unknown): PlanningCollection {
  if (!value || typeof value !== 'object' || Array.isArray(value)) bad('document');
  const data = value as Record<string, unknown>;
  if (Object.keys(data).sort().join(',') !== 'maps,projectId,revision,schemaVersion' || data.schemaVersion !== 1 ||
      typeof data.projectId !== 'string' || !/^[A-Za-z][A-Za-z0-9._-]*$/.test(data.projectId) ||
      !validRevision(data.revision) || data.revision === 0 || !Array.isArray(data.maps)) bad('schema');
  const maps = (data.maps as unknown[]).map(parsePlanningMap).sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  if (new Set(maps.map(map => map.id)).size !== maps.length || maps.some(map => map.projectId !== data.projectId)) bad('map identity');
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

  async mutate(root: string, expectedRevision: number, operation: PlanningOperation, expectedProjectId?: string): Promise<PlanningCollection> {
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
        maps.push(parsePlanningMap({ schemaVersion: 1, id: op.id, projectId, title: op.title, objective: op.objective,
          status: 'draft', revision: 0, history: [{ revision: 0, action: 'create', at: now }], basis: op.basis,
          transformations: [], workItems: [] }));
      } else {
        if (!('mapId' in op) || typeof op.mapId !== 'string') throw new Error('Invalid planning operation');
        const index = maps.findIndex(map => map.id === op.mapId);
        if (index < 0) throw new Error('Unknown planning map');
        const map = maps[index];
        if ('expectedMapRevision' in op && map.revision !== op.expectedMapRevision) throw new Error('Stale Planning Map revision');
        if ('expectedBasis' in op && JSON.stringify(map.basis) !== JSON.stringify(op.expectedBasis)) throw new Error('Stale Planning Map basis');
        if ('expectedBasis' in op) {
          const declaration = await this.declaration(root);
          if (createHash('sha256').update(declaration).digest('hex') !== map.basis.architectureFingerprint)
            throw new Error('Stale Planning Map architecture basis');
        }
        if (op.type === 'duplicate') {
          if (maps.some(item => item.id === op.newId)) throw new Error('Planning map already exists');
          maps.push(branchMap(map, op.newId, now));
        } else if (op.type === 'transition') maps[index] = transitionMap(map, op.status, now);
        else {
          if (map.status !== 'draft' && map.status !== 'active') throw new Error('Planning map is closed');
          let changed: PlanningMap;
          switch (op.type) {
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
            case 'put-work-item': changed = { ...map, workItems: [...map.workItems.filter(item => item.id !== op.workItem?.id), op.workItem] }; break;
            case 'remove-work-item': changed = { ...map, workItems: map.workItems.filter(item => item.id !== op.workItemId) }; break;
            default: throw new Error('Invalid planning operation');
          }
          if (op.type.startsWith('remove-') && changed.transformations.length === map.transformations.length && changed.workItems.length === map.workItems.length)
            throw new Error('Unknown planning item');
          if (op.type === 'put-transformation' || op.type === 'remove-transformation') changed.editHistory = {
            undo: [...(map.editHistory?.undo ?? []), map.transformations], redo: [] };
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

  async conflicts(root: string) { return detectActiveConflicts((await this.read(root)).maps); }
}
