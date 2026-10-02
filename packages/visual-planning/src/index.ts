import { parseArchitecture, projectPath } from '@dope/software-map';
import type { ArchitectureDeclaration } from '@dope/software-map';

export const PLANNING_SCHEMA_VERSION = 1;
export type MapStatus = 'draft' | 'active' | 'completed' | 'superseded' | 'archived';
export type TransformationKind = 'add' | 'modify' | 'remove' | 'move' | 'split' | 'merge' | 'redirect-relationship' | 'change-contract';
export type NodeKind = 'system' | 'subsystem' | 'component';
export type Resolution = 'as-planned' | 'accepted-different' | 'deferred' | 'abandoned';
export interface PlanningBasis { architectureRevision: number; architectureFingerprint: string; physicalInputFingerprint: string; physicalGeneration: number }
export const sameSemanticBasis = (a: PlanningBasis, b: PlanningBasis): boolean =>
  a.architectureRevision === b.architectureRevision && a.architectureFingerprint === b.architectureFingerprint &&
  a.physicalInputFingerprint === b.physicalInputFingerprint;
export const sameObservation = (a: PlanningBasis, b: PlanningBasis): boolean =>
  sameSemanticBasis(a, b) && a.physicalGeneration === b.physicalGeneration;
export interface RebaseReality {
  basis: PlanningBasis;
  architecture: ArchitectureDeclaration;
  physicalNodes: { id: string; kind: string; name: string; parentId?: string; path?: string; evidenceIds: string[] }[];
  relationships: { kind: string; sourceId: string; targetId: string; evidenceIds: string[] }[];
  sourceHashes?: Record<string, string>;
}
export interface PlannedNode { id: string; kind: NodeKind; parentId?: string; name: string; purpose: string; roots: string[]; allowedDependencies?: string[]; forbiddenDependencies?: string[] }
export interface DependencyRelationship { sourceId: string; targetId: string; policy: 'allowed' | 'forbidden' }
export interface RelationshipRedirect { from: DependencyRelationship; to: DependencyRelationship }
export interface PlannedTransformation {
  id: string; kind: TransformationKind; currentIds: string[]; futureNodes: PlannedNode[]; dependsOn: string[];
  redirect?: RelationshipRedirect; resolution?: Resolution; deferredTo?: { mapId: string; transformationId: string }; adopted?: boolean;
}
export type WorkStatus = 'proposed' | 'ready' | 'in-progress' | 'completed' | 'cancelled';
export interface WorkItem {
  id: string; title: string; objective: string; transformationIds: string[]; dependsOn: string[];
  requirements: string[]; constraints: string[]; acceptanceCriteria: string[]; validationTargets: string[];
  workingSet: string[]; status: WorkStatus; completionNotes?: string;
}
export interface HistoryEntry { revision: number; action: string; at: string }
export interface PlanningMap {
  schemaVersion: 1; id: string; projectId: string; title: string; objective: string; status: MapStatus;
  revision: number; history: HistoryEntry[]; basis: PlanningBasis;
  basisSnapshot?: RebaseReality;
  transformations: PlannedTransformation[]; workItems: WorkItem[]; branchedFrom?: string;
  reconciliation?: PlanningReconciliation;
  editHistory?: { undo: PlannedTransformation[][]; redo: PlannedTransformation[][] };
}
export interface CrossMapConflict { schemaVersion: 1; mapIds: [string, string]; transformationIds: [string, string]; identityId: string; reason: 'incompatible-target' }
export type RebaseReason = 'missing' | 'identity' | 'parent' | 'contract' | 'relationship' | 'source-changed' | 'already-realized' | 'realized-differently' | 'unresolved';
export interface RebaseConflict { transformationId: string; identityId: string; reason: RebaseReason; evidence: string[] }
export interface StaleResult { schemaVersion: 1; stale: boolean; architectureChanged: boolean; physicalChanged: boolean; affectedTransformationIds: string[]; affectedBranchIds: string[]; conflicts: RebaseConflict[] }
export interface RebaseResult { schemaVersion: 1; oldBasis: PlanningBasis; currentBasis: PlanningBasis; conflicts: RebaseConflict[]; unaffectedTransformationIds: string[]; oldReality?: RebaseReality; currentReality: RebaseReality }
export type ReconciliationOutcome = 'implemented-as-planned' | 'implemented-differently' | 'not-implemented' | 'unexpected-implementation';
export interface ReconciliationResult { schemaVersion: 1; transformationId?: string; identityId: string; outcome: ReconciliationOutcome; physicalGeneration: number; evidenceIds: string[]; explanation: string; branchIds?: string[] }
export interface PlanningReconciliation { basis: PlanningBasis; results: ReconciliationResult[]; at: string }
export interface TargetProjection { nodes: PlannedNode[]; relationships: DependencyRelationship[] }
export interface WorkItemSuggestion { transformationIds: string[]; dependsOn: number[]; objective: string }

function fail(at: string): never { throw new Error(`Invalid planning map: ${at}`); }
function obj(v: unknown, at: string): Record<string, unknown> { if (!v || typeof v !== 'object' || Array.isArray(v)) fail(at); return v as Record<string, unknown>; }
function fields(v: Record<string, unknown>, required: string[], optional: string[], at: string): void {
  if (required.some(k => !Object.hasOwn(v, k)) || Object.keys(v).some(k => !required.includes(k) && !optional.includes(k))) fail(at);
}
function str(v: unknown, at: string): string { if (typeof v !== 'string' || !v.trim() || v !== v.trim()) fail(at); return v; }
function id(v: unknown, at: string): string { const s = str(v, at); if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(s)) fail(at); return s; }
function integer(v: unknown, at: string): number { if (!Number.isSafeInteger(v) || (v as number) < 0) fail(at); return v as number; }
function choice<T extends string>(v: unknown, allowed: readonly T[], at: string): T { if (!allowed.includes(v as T)) fail(at); return v as T; }
function list<T>(v: unknown, parse: (v: unknown, at: string) => T, at: string): T[] {
  if (!Array.isArray(v)) fail(at);
  return v.map((item, i) => parse(item, `${at}[${i}]`));
}
function unique(values: string[], at: string): string[] { if (new Set(values).size !== values.length) fail(`duplicate ${at}`); return values.sort(); }
function ids(v: unknown, at: string): string[] { return unique(list(v, id, at), at); }
function strings(v: unknown, at: string): string[] { return unique(list(v, str, at), at); }
function path(v: unknown, at: string): string { try { return projectPath(v); } catch { fail(at); } }
function paths(v: unknown, at: string): string[] { return unique(list(v, path, at), at); }
function bool(v: unknown, at: string): boolean { if (typeof v !== 'boolean') fail(at); return v; }
function versioned(v: unknown, at: string, required: string[], optional: string[] = []): Record<string, unknown> {
  const x = obj(v, at); fields(x, ['schemaVersion', ...required], optional, at);
  if (x.schemaVersion !== 1) fail(`${at}.schemaVersion`);
  return x;
}
function pair(v: unknown, at: string): [string, string] { const values = list(v, id, at); if (values.length !== 2) fail(at); return [values[0], values[1]]; }
function parseBasis(v: unknown, at: string): PlanningBasis {
  const x = obj(v, at); fields(x, ['architectureRevision', 'architectureFingerprint', 'physicalInputFingerprint', 'physicalGeneration'], [], at);
  return { architectureRevision: integer(x.architectureRevision, `${at}.architectureRevision`), architectureFingerprint: str(x.architectureFingerprint, `${at}.architectureFingerprint`),
    physicalInputFingerprint: str(x.physicalInputFingerprint, `${at}.physicalInputFingerprint`), physicalGeneration: integer(x.physicalGeneration, `${at}.physicalGeneration`) };
}
export function parseRebaseReality(v: unknown): RebaseReality {
  const x = obj(v, 'reality'); fields(x, ['basis', 'architecture', 'physicalNodes', 'relationships'], ['sourceHashes'], 'reality');
  const physicalNodes = list(x.physicalNodes, (raw, at) => {
    const n = obj(raw, at); fields(n, ['id', 'kind', 'name', 'evidenceIds'], ['parentId', 'path'], at);
    return { id: str(n.id, `${at}.id`), kind: choice(n.kind, ['project', 'system', 'subsystem', 'component', 'code'] as const, `${at}.kind`),
      name: str(n.name, `${at}.name`), ...(n.parentId === undefined ? {} : { parentId: str(n.parentId, `${at}.parentId`) }),
      ...(n.path === undefined ? {} : { path: path(n.path, `${at}.path`) }), evidenceIds: strings(n.evidenceIds, `${at}.evidenceIds`) };
  }, 'reality.physicalNodes');
  const relationships = list(x.relationships, (raw, at) => {
    const r = obj(raw, at); fields(r, ['kind', 'sourceId', 'targetId', 'evidenceIds'], [], at);
    return { kind: choice(r.kind, ['contains', 'owns', 'imports', 'depends-on', 'exports', 'references', 'extends', 'implements'] as const, `${at}.kind`),
      sourceId: str(r.sourceId, `${at}.sourceId`), targetId: str(r.targetId, `${at}.targetId`), evidenceIds: strings(r.evidenceIds, `${at}.evidenceIds`) };
  }, 'reality.relationships');
  if (new Set(physicalNodes.map(n => n.id)).size !== physicalNodes.length) fail('reality duplicate node');
  const sourceHashes = x.sourceHashes === undefined ? undefined : obj(x.sourceHashes, 'reality.sourceHashes');
  if (sourceHashes) for (const [source, hash] of Object.entries(sourceHashes))
    if (projectPath(source) !== source || typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) fail('reality.sourceHashes');
  return { basis: parseBasis(x.basis, 'reality.basis'), architecture: parseArchitecture(x.architecture), physicalNodes, relationships,
    ...(sourceHashes ? { sourceHashes: sourceHashes as Record<string, string> } : {}) };
}
function node(v: unknown, at: string): PlannedNode {
  const x = obj(v, at); fields(x, ['id', 'kind', 'name', 'purpose', 'roots'], ['parentId', 'allowedDependencies', 'forbiddenDependencies'], at);
  const kind = choice(x.kind, ['system', 'subsystem', 'component'] as const, `${at}.kind`);
  if ((kind === 'system') !== (x.parentId === undefined)) fail(`${at}.parentId`);
  if (kind !== 'subsystem' && (x.allowedDependencies !== undefined || x.forbiddenDependencies !== undefined)) fail(`${at}.dependencies`);
  return { id: id(x.id, `${at}.id`), kind, ...(x.parentId === undefined ? {} : { parentId: id(x.parentId, `${at}.parentId`) }),
    name: str(x.name, `${at}.name`), purpose: str(x.purpose, `${at}.purpose`), roots: paths(x.roots, `${at}.roots`),
    ...(x.allowedDependencies === undefined ? {} : { allowedDependencies: ids(x.allowedDependencies, `${at}.allowedDependencies`) }),
    ...(x.forbiddenDependencies === undefined ? {} : { forbiddenDependencies: ids(x.forbiddenDependencies, `${at}.forbiddenDependencies`) }) };
}
function relationship(v: unknown, at: string): DependencyRelationship {
  const x = obj(v, at); fields(x, ['sourceId', 'targetId', 'policy'], [], at);
  return { sourceId: id(x.sourceId, `${at}.sourceId`), targetId: id(x.targetId, `${at}.targetId`), policy: choice(x.policy, ['allowed', 'forbidden'] as const, `${at}.policy`) };
}
function transformation(v: unknown, at: string): PlannedTransformation {
  const x = obj(v, at); fields(x, ['id', 'kind', 'currentIds', 'futureNodes', 'dependsOn'], ['redirect', 'resolution', 'deferredTo', 'adopted'], at);
  const kind = choice(x.kind, ['add', 'modify', 'remove', 'move', 'split', 'merge', 'redirect-relationship', 'change-contract'] as const, `${at}.kind`);
  const currentIds = ids(x.currentIds, `${at}.currentIds`);
  const futureNodes = list(x.futureNodes, node, `${at}.futureNodes`).sort(byId);
  unique(futureNodes.map(n => n.id), `${at}.futureNodes`);
  const counts: Record<TransformationKind, [number, number]> = { add: [0, 1], modify: [1, 1], remove: [1, 0], move: [1, 1], split: [1, 2], merge: [2, 1], 'redirect-relationship': [0, 0], 'change-contract': [1, 1] };
  const [sources, targets] = counts[kind];
  if (currentIds.length < sources || futureNodes.length < targets ||
    (kind !== 'remove' && kind !== 'split' && kind !== 'merge' && kind !== 'add' && currentIds.length !== sources) ||
    (kind !== 'split' && kind !== 'add' && futureNodes.length !== targets) ||
    (kind === 'merge' && futureNodes.length !== 1) || (kind === 'remove' && futureNodes.length) ||
    (kind === 'split' && currentIds.length !== 1)) fail(`${at}.shape`);
  if ((kind === 'redirect-relationship') !== (x.redirect !== undefined)) fail(`${at}.redirect`);
  if (['modify', 'move', 'change-contract'].includes(kind) && currentIds[0] !== futureNodes[0].id) fail(`${at}.identity`);
  const redirect = x.redirect === undefined ? undefined : obj(x.redirect, `${at}.redirect`);
  if (redirect) fields(redirect, ['from', 'to'], [], `${at}.redirect`);
  return { id: id(x.id, `${at}.id`), kind, currentIds, futureNodes, dependsOn: ids(x.dependsOn, `${at}.dependsOn`),
    ...(redirect ? { redirect: { from: relationship(redirect.from, `${at}.redirect.from`), to: relationship(redirect.to, `${at}.redirect.to`) } } : {}),
    ...(x.resolution === undefined ? {} : { resolution: choice(x.resolution, ['as-planned', 'accepted-different', 'deferred', 'abandoned'] as const, `${at}.resolution`) }),
    ...(x.deferredTo === undefined ? {} : { deferredTo: (() => { const d = obj(x.deferredTo, `${at}.deferredTo`); fields(d, ['mapId', 'transformationId'], [], `${at}.deferredTo`);
      return { mapId: id(d.mapId, `${at}.deferredTo.mapId`), transformationId: id(d.transformationId, `${at}.deferredTo.transformationId`) }; })() }),
    ...(x.adopted === undefined ? {} : { adopted: bool(x.adopted, `${at}.adopted`) }) };
}
function work(v: unknown, at: string): WorkItem {
  const x = obj(v, at); fields(x, ['id', 'title', 'objective', 'transformationIds', 'dependsOn', 'requirements', 'constraints', 'acceptanceCriteria', 'validationTargets', 'workingSet', 'status'], ['completionNotes'], at);
  const status = choice(x.status, ['proposed', 'ready', 'in-progress', 'completed', 'cancelled'] as const, `${at}.status`);
  if ((status === 'completed') !== (x.completionNotes !== undefined)) fail(`${at}.completionNotes`);
  const transformationIds = ids(x.transformationIds, `${at}.transformationIds`);
  if (!transformationIds.length) fail(`${at}.transformationIds`);
  return { id: id(x.id, `${at}.id`), title: str(x.title, `${at}.title`), objective: str(x.objective, `${at}.objective`), transformationIds,
    dependsOn: ids(x.dependsOn, `${at}.dependsOn`), requirements: strings(x.requirements, `${at}.requirements`),
    constraints: strings(x.constraints, `${at}.constraints`), acceptanceCriteria: strings(x.acceptanceCriteria, `${at}.acceptanceCriteria`),
    validationTargets: strings(x.validationTargets, `${at}.validationTargets`), workingSet: paths(x.workingSet, `${at}.workingSet`), status,
    ...(x.completionNotes === undefined ? {} : { completionNotes: str(x.completionNotes, `${at}.completionNotes`) }) };
}
function byId(a: { id: string }, b: { id: string }): number { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }
function acyclic(items: Array<{ id: string; dependsOn: string[] }>, at: string): void {
  const states = new Map<string, number>(); const lookup = new Map(items.map(x => [x.id, x]));
  function visit(id: string): void {
    if (!lookup.has(id)) fail(`${at}: unknown dependency ${id}`);
    if (states.get(id) === 1) fail(`${at}: cycle ${id}`);
    if (states.get(id) === 2) return;
    states.set(id, 1); for (const dep of lookup.get(id)!.dependsOn) visit(dep); states.set(id, 2);
  }
  for (const item of items) visit(item.id);
}
export function validateTransformationDependencies(items: PlannedTransformation[]): void { acyclic(items, 'transformations'); }
export function parsePlanningMap(input: unknown): PlanningMap {
  const x = obj(input, 'root'); fields(x, ['schemaVersion', 'id', 'projectId', 'title', 'objective', 'status', 'revision', 'history', 'basis', 'transformations', 'workItems'], ['branchedFrom', 'editHistory', 'basisSnapshot', 'reconciliation'], 'root');
  if (x.schemaVersion !== 1) fail('unsupported schemaVersion');
  const basis = parseBasis(x.basis, 'basis');
  if (x.basisSnapshot !== undefined && !sameObservation(parseRebaseReality(x.basisSnapshot).basis, basis)) fail('basis snapshot mismatch');
  const history = list(x.history, (raw, at) => { const h = obj(raw, at); fields(h, ['revision', 'action', 'at'], [], at); return { revision: integer(h.revision, `${at}.revision`), action: str(h.action, `${at}.action`), at: str(h.at, `${at}.at`) }; }, 'history').sort((a, b) => a.revision - b.revision);
  const revision = integer(x.revision, 'revision');
  if (history.length && (history[history.length - 1].revision !== revision || history.some((h, i) => i && h.revision <= history[i - 1].revision))) fail('history revision');
  if (!history.length && revision !== 0) fail('history revision');
  const transformations = list(x.transformations, transformation, 'transformations').sort(byId);
  if (transformations.some(t => (t.resolution === 'deferred') !== !!t.deferredTo)) fail('deferral linkage');
  const editHistory = x.editHistory === undefined ? undefined : obj(x.editHistory, 'editHistory');
  if (editHistory) fields(editHistory, ['undo', 'redo'], [], 'editHistory');
  const snapshots = (value: unknown, at: string) => list(value, (raw, place) => {
    const items = list(raw, transformation, place).sort(byId);
    unique(items.map(item => item.id), `${place} id`);
    validateTransformationDependencies(items);
    return items;
  }, at);
  const workItems = list(x.workItems, work, 'workItems').sort(byId);
  unique(transformations.map(t => t.id), 'transformation id'); unique(workItems.map(w => w.id), 'work item id');
  validateTransformationDependencies(transformations); acyclic(workItems, 'work items');
  const transformIds = new Set(transformations.map(t => t.id));
  for (const item of workItems) for (const ref of item.transformationIds) if (!transformIds.has(ref)) fail(`unknown transformation ${ref}`);
  const status = choice(x.status, ['draft', 'active', 'completed', 'superseded', 'archived'] as const, 'status');
  const reconciliation = x.reconciliation === undefined ? undefined : parsePlanningReconciliation(x.reconciliation);
  if (reconciliation && (reconciliation.results.filter(r => r.transformationId).length !== transformations.length ||
    transformations.some(t => reconciliation.results.filter(r => r.transformationId === t.id).length !== 1))) fail('reconciliation coverage');
  const closed = history.some(entry => entry.action.startsWith('closeout:'));
  if ((status === 'completed' && !closed || closed && !canCloseOut({ transformations, reconciliation } as PlanningMap))) fail('unresolved closeout');
  return { schemaVersion: 1, id: id(x.id, 'id'), projectId: id(x.projectId, 'projectId'), title: str(x.title, 'title'), objective: str(x.objective, 'objective'), status, revision, history,
    basis, ...(x.basisSnapshot === undefined ? {} : { basisSnapshot: parseRebaseReality(x.basisSnapshot) }),
    transformations, workItems, ...(reconciliation ? { reconciliation } : {}), ...(x.branchedFrom === undefined ? {} : { branchedFrom: id(x.branchedFrom, 'branchedFrom') }),
    ...(editHistory ? { editHistory: { undo: snapshots(editHistory.undo, 'editHistory.undo'), redo: snapshots(editHistory.redo, 'editHistory.redo') } } : {}) };
}
export function parsePlanningMapJson(json: string): PlanningMap { try { return parsePlanningMap(JSON.parse(json)); } catch (error) { if (error instanceof SyntaxError) fail('malformed JSON'); throw error; } }
export function parseCrossMapConflict(input: unknown): CrossMapConflict {
  const x = versioned(input, 'conflict', ['mapIds', 'transformationIds', 'identityId', 'reason']);
  const mapIds = pair(x.mapIds, 'conflict.mapIds'); if (mapIds[0] === mapIds[1]) fail('conflict.mapIds');
  return { schemaVersion: 1, mapIds, transformationIds: pair(x.transformationIds, 'conflict.transformationIds'),
    identityId: id(x.identityId, 'conflict.identityId'), reason: choice(x.reason, ['incompatible-target'] as const, 'conflict.reason') };
}
export function parseStaleResult(input: unknown): StaleResult {
  const x = versioned(input, 'stale', ['stale', 'architectureChanged', 'physicalChanged', 'affectedTransformationIds', 'affectedBranchIds', 'conflicts']);
  return { schemaVersion: 1 as const, stale: bool(x.stale, 'stale.stale'), architectureChanged: bool(x.architectureChanged, 'stale.architectureChanged'),
    physicalChanged: bool(x.physicalChanged, 'stale.physicalChanged'), affectedTransformationIds: ids(x.affectedTransformationIds, 'stale.affectedTransformationIds'),
    affectedBranchIds: ids(x.affectedBranchIds, 'stale.affectedBranchIds'), conflicts: parseRebaseConflicts(x.conflicts) };
}
function parseRebaseConflicts(value: unknown): RebaseConflict[] {
  return list(value, (v, at) => { const c = obj(v, at); fields(c, ['transformationId', 'identityId', 'reason', 'evidence'], [], at);
    return { transformationId: id(c.transformationId, `${at}.transformationId`), identityId: str(c.identityId, `${at}.identityId`),
      reason: choice(c.reason, ['missing', 'identity', 'parent', 'contract', 'relationship', 'source-changed', 'already-realized', 'realized-differently', 'unresolved'] as const, `${at}.reason`), evidence: strings(c.evidence, `${at}.evidence`) }; }, 'rebase.conflicts');
}
export function parseRebaseResult(input: unknown): RebaseResult {
  const x = versioned(input, 'rebase', ['oldBasis', 'currentBasis', 'conflicts', 'unaffectedTransformationIds', 'currentReality'], ['oldReality']);
  const conflicts = parseRebaseConflicts(x.conflicts);
  const unaffectedTransformationIds = ids(x.unaffectedTransformationIds, 'rebase.unaffectedTransformationIds');
  if (conflicts.some(c => unaffectedTransformationIds.includes(c.transformationId))) fail('rebase conflicting unaffected identity');
  return { schemaVersion: 1, oldBasis: parseBasis(x.oldBasis, 'rebase.oldBasis'), currentBasis: parseBasis(x.currentBasis, 'rebase.currentBasis'),
    conflicts: conflicts.sort((a, b) => a.transformationId.localeCompare(b.transformationId) || a.identityId.localeCompare(b.identityId)), unaffectedTransformationIds,
    ...(x.oldReality === undefined ? {} : { oldReality: parseRebaseReality(x.oldReality) }), currentReality: parseRebaseReality(x.currentReality) };
}
export function parseReconciliationResult(input: unknown): ReconciliationResult {
  const x = versioned(input, 'reconciliation', ['identityId', 'outcome', 'physicalGeneration', 'evidenceIds', 'explanation'], ['transformationId', 'branchIds']);
  const outcome = choice(x.outcome, ['implemented-as-planned', 'implemented-differently', 'not-implemented', 'unexpected-implementation'] as const, 'reconciliation.outcome');
  if ((outcome === 'unexpected-implementation') === (x.transformationId !== undefined)) fail('reconciliation.transformationId');
  return { schemaVersion: 1, identityId: str(x.identityId, 'reconciliation.identityId'), outcome, physicalGeneration: integer(x.physicalGeneration, 'reconciliation.physicalGeneration'),
    evidenceIds: strings(x.evidenceIds, 'reconciliation.evidenceIds'), explanation: str(x.explanation, 'reconciliation.explanation'),
    ...(x.branchIds === undefined ? {} : { branchIds: ids(x.branchIds, 'reconciliation.branchIds') }),
    ...(x.transformationId === undefined ? {} : { transformationId: id(x.transformationId, 'reconciliation.transformationId') }) };
}

export function parsePlanningReconciliation(input: unknown): PlanningReconciliation {
  const x = obj(input, 'planning reconciliation'); fields(x, ['basis', 'results', 'at'], [], 'planning reconciliation');
  const basis = parseBasis(x.basis, 'planning reconciliation.basis');
  const results = list(x.results, parseReconciliationResult, 'planning reconciliation.results');
  if (results.some(r => r.physicalGeneration !== basis.physicalGeneration) ||
    new Set(results.map(r => `${r.transformationId ?? ''}:${r.identityId}`)).size !== results.length) fail('reconciliation generation or duplicate');
  return { basis, results, at: str(x.at, 'planning reconciliation.at') };
}
export function canCloseOut(map: PlanningMap): boolean {
  const results = map.reconciliation?.results;
  return !!results && map.transformations.every(t => {
    const outcome = results.find(r => r.transformationId === t.id)?.outcome;
    return !!outcome && (t.resolution === 'as-planned' && outcome === 'implemented-as-planned' ||
      t.resolution === 'accepted-different' && outcome === 'implemented-differently' ||
      t.resolution === 'deferred' && !!t.deferredTo || t.resolution === 'abandoned');
  });
}
const transitions: Record<MapStatus, MapStatus[]> = { draft: ['active', 'archived'], active: ['superseded', 'archived'], completed: ['archived'], superseded: ['archived'], archived: [] };
export function transitionMap(map: PlanningMap, status: MapStatus, at: string): PlanningMap {
  if (!transitions[map.status].includes(status)) fail(`illegal transition ${map.status} -> ${status}`);
  const next = { ...map, status, revision: map.revision + 1, history: [...map.history, { revision: map.revision + 1, action: `status:${status}`, at: str(at, 'at') }] };
  return parsePlanningMap(next);
}
export function branchMap(map: PlanningMap, newId: string, at: string): PlanningMap {
  if (newId === map.id) fail('branch identity');
  return parsePlanningMap({ ...map, id: id(newId, 'newId'), status: 'draft', revision: 0, history: [{ revision: 0, action: `branch:${map.id}`, at: str(at, 'at') }], branchedFrom: map.id,
    transformations: map.transformations.map(t => ({ ...t, resolution: undefined, deferredTo: undefined })), reconciliation: undefined, editHistory: { undo: [], redo: [] },
    workItems: map.workItems.map(w => ({ ...w, status: 'proposed', completionNotes: undefined })) });
}
export const duplicateMap = branchMap;

function canonicalNodes(architecture: ArchitectureDeclaration): PlannedNode[] {
  return architecture.systems.flatMap(system => [
    { id: system.id, kind: 'system' as const, name: system.name, purpose: system.purpose, roots: system.roots ?? [] },
    ...system.subsystems.flatMap(sub => [
      { id: sub.id, kind: 'subsystem' as const, parentId: system.id, name: sub.name, purpose: sub.purpose, roots: sub.roots,
        ...(sub.allowedDependencies ? { allowedDependencies: sub.allowedDependencies } : {}), ...(sub.forbiddenDependencies ? { forbiddenDependencies: sub.forbiddenDependencies } : {}) },
      ...(sub.components ?? []).map(c => ({ id: c.id, kind: 'component' as const, parentId: sub.id, name: c.name, purpose: c.purpose, roots: c.roots }))
    ])
  ]);
}
function key(r: DependencyRelationship): string { return `${r.sourceId}\0${r.policy}\0${r.targetId}`; }
function topo(items: PlannedTransformation[]): PlannedTransformation[] {
  const lookup = new Map(items.map(x => [x.id, x])); const done = new Set<string>(); const result: PlannedTransformation[] = [];
  function visit(t: PlannedTransformation): void { if (done.has(t.id)) return; for (const dep of t.dependsOn) { const dependency = lookup.get(dep); if (dependency) visit(dependency); } done.add(t.id); result.push(t); }
  for (const t of [...items].sort(byId)) visit(t); return result;
}
/** A proposed target only. This never changes architecture or physical evidence. */
export function projectTarget(architecture: ArchitectureDeclaration, map: PlanningMap): TargetProjection {
  const canonical = parseArchitecture(architecture);
  const nodes = new Map(canonicalNodes(canonical).map(n => [n.id, n]));
  const declared = new Set(nodes.keys());
  const produced = new Map<string, string>();
  for (const t of map.transformations.filter(t => !t.adopted)) if (['add', 'split', 'merge'].includes(t.kind)) for (const n of t.futureNodes) {
    if (!declared.has(n.id)) {
      if (produced.has(n.id)) fail(`duplicate future identity ${n.id}`);
      produced.set(n.id, t.id);
    }
  }
  const transformations = new Map(map.transformations.map(t => [t.id, t]));
  function dependsOn(t: PlannedTransformation, required: string, seen = new Set<string>()): boolean {
    if (t.dependsOn.includes(required)) return true;
    for (const dep of t.dependsOn) {
      if (seen.has(dep)) continue;
      seen.add(dep);
      if (dependsOn(transformations.get(dep)!, required, seen)) return true;
    }
    return false;
  }
  const redirects: RelationshipRedirect[] = [];
  for (const t of topo(map.transformations.filter(t => !t.adopted))) {
    for (const reference of [...t.currentIds, ...t.futureNodes.map(n => n.parentId).filter((x): x is string => x !== undefined),
      ...(t.redirect ? [t.redirect.from.sourceId, t.redirect.from.targetId, t.redirect.to.sourceId, t.redirect.to.targetId] : [])]) {
      const producer = produced.get(reference);
      if (producer && producer !== t.id && !dependsOn(t, producer)) fail(`missing dependency ${t.id} -> ${producer}`);
    }
    for (const sourceId of t.currentIds) if (!nodes.has(sourceId)) fail(`unknown current identity ${sourceId}`);
    if (t.kind === 'redirect-relationship') { redirects.push(t.redirect!); continue; }
    if (['modify', 'move', 'change-contract'].includes(t.kind)) {
      const before = nodes.get(t.currentIds[0])!, after = t.futureNodes[0];
      if (before.kind !== after.kind) fail(`changed kind ${before.id}`);
      if (t.kind !== 'move' && before.parentId !== after.parentId) fail(`changed parent ${before.id}`);
      if (t.kind === 'move' && before.parentId === after.parentId) fail(`unchanged parent ${before.id}`);
      if (t.kind === 'change-contract' && before.kind !== 'subsystem') fail(`invalid contract ${before.id}`);
    }
    if (['remove', 'split', 'merge'].includes(t.kind)) for (const sourceId of t.currentIds) {
      if ([...nodes.values()].some(n => n.parentId === sourceId && !t.currentIds.includes(n.id))) fail(`occupied identity ${sourceId}`);
      nodes.delete(sourceId);
    }
    for (const future of t.futureNodes) {
      if (t.kind === 'add' && nodes.has(future.id)) fail(`duplicate future identity ${future.id}`);
      if (!['modify', 'move', 'change-contract'].includes(t.kind) && nodes.has(future.id)) fail(`duplicate future identity ${future.id}`);
      nodes.set(future.id, future);
    }
  }
  for (const n of nodes.values()) {
    if (n.parentId && (!nodes.has(n.parentId) || (n.kind === 'subsystem' ? nodes.get(n.parentId)!.kind !== 'system' : nodes.get(n.parentId)!.kind !== 'subsystem'))) fail(`invalid parent ${n.id}`);
  }
  const relationships = new Map<string, DependencyRelationship>();
  for (const n of nodes.values()) if (n.kind === 'subsystem') for (const policy of ['allowed', 'forbidden'] as const)
    for (const targetId of policy === 'allowed' ? n.allowedDependencies ?? [] : n.forbiddenDependencies ?? []) {
      const r = { sourceId: n.id, targetId, policy }; relationships.set(key(r), r);
    }
  for (const { from, to } of redirects) {
    if (!relationships.delete(key(from))) fail(`unknown relationship ${key(from)}`);
    if (!nodes.has(to.sourceId) || !nodes.has(to.targetId)) fail('unknown redirected identity');
    relationships.set(key(to), to);
  }
  for (const r of relationships.values()) if (nodes.get(r.sourceId)?.kind !== 'subsystem' || nodes.get(r.targetId)?.kind !== 'subsystem') fail(`invalid relationship ${key(r)}`);
  for (const n of nodes.values()) if (n.kind === 'subsystem') {
    for (const policy of ['allowed', 'forbidden'] as const) {
      const property = policy === 'allowed' ? 'allowedDependencies' : 'forbiddenDependencies';
      if (n[property] !== undefined || [...relationships.values()].some(r => r.sourceId === n.id && r.policy === policy))
        n[property] = [...relationships.values()].filter(r => r.sourceId === n.id && r.policy === policy).map(r => r.targetId).sort();
    }
  }
  return { nodes: [...nodes.values()].sort(byId), relationships: [...relationships.values()].sort((a, b) => key(a).localeCompare(key(b))) };
}
export function validatePlanningReferences(architecture: ArchitectureDeclaration, map: PlanningMap): void { projectTarget(architecture, map); }
export function detectActiveConflicts(maps: PlanningMap[]): CrossMapConflict[] {
  const active = maps.filter(m => m.status === 'active').sort(byId); const result: CrossMapConflict[] = [];
  for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) {
    if (active[i].projectId !== active[j].projectId) continue;
    for (const a of active[i].transformations) for (const b of active[j].transformations) {
      const touchedA = new Set([...a.currentIds, ...a.futureNodes.map(n => n.id), ...(a.redirect ? [a.redirect.from.sourceId, a.redirect.from.targetId] : [])]);
      const touchedB = new Set([...b.currentIds, ...b.futureNodes.map(n => n.id), ...(b.redirect ? [b.redirect.from.sourceId, b.redirect.from.targetId] : [])]);
      for (const identityId of [...touchedA].filter(id => touchedB.has(id)).sort())
        if (JSON.stringify({ ...a, id: '', dependsOn: [], resolution: undefined }) !== JSON.stringify({ ...b, id: '', dependsOn: [], resolution: undefined }))
          result.push({ schemaVersion: 1, mapIds: [active[i].id, active[j].id], transformationIds: [a.id, b.id], identityId, reason: 'incompatible-target' });
    }
  }
  return result;
}
export function suggestWorkItems(map: PlanningMap): WorkItemSuggestion[] {
  const items = topo(map.transformations);
  // Share an exact architecture identity to group; a common parent alone is too broad.
  const groups: PlannedTransformation[][] = [];
  const touched = (t: PlannedTransformation): string[] => [...t.currentIds, ...t.futureNodes.map(n => n.id)];
  for (const t of items) {
    const last = groups.at(-1);
    if (last?.some(other => touched(t).some(id => touched(other).includes(id)))) last.push(t);
    else groups.push([t]);
  }
  const indices = new Map(groups.flatMap((group, i) => group.map(t => [t.id, i] as const)));
  return groups.map((group, i) => ({ transformationIds: group.map(t => t.id).sort(),
    dependsOn: [...new Set(group.flatMap(t => t.dependsOn.map(id => indices.get(id)!).filter(index => index !== i)))].sort((a, b) => a - b),
    objective: group.map(t => `${t.kind}: ${[...new Set(touched(t))].join(', ') || t.id}`).join('; ') }));
}
