import type { ArchitectureDeclaration, PhysicalMapSnapshot } from '@dope/software-map';
import { parsePlanningMap, parseRebaseReality } from './index';
import type { PlannedNode, PlannedTransformation, PlanningMap, RebaseConflict, RebaseReality, RebaseResult, StaleResult } from './index';

export type RebaseDecision = { transformationId: string; identityId: string; reason: RebaseConflict['reason'];
  action: 'keep-target' | 'accept-different' | 'replace-reference'; replacementId?: string };

export function captureReality(basis: RebaseReality['basis'], architecture: ArchitectureDeclaration, snapshot: PhysicalMapSnapshot,
  sourceHashes?: Record<string, string>): RebaseReality {
  if (snapshot.metadata.generation !== basis.physicalGeneration || snapshot.metadata.inputFingerprint !== basis.physicalInputFingerprint)
    throw new Error('Software Map generation changed');
  return parseRebaseReality({ basis, architecture,
    physicalNodes: snapshot.nodes.map(node =>
      ({ id: node.id, kind: node.kind, name: node.name, ...(node.parentId ? { parentId: node.parentId } : {}),
        ...(node.kind === 'code' ? { path: node.path } : {}), evidenceIds: node.evidenceIds })),
    relationships: snapshot.relationships.map(({ kind, sourceId, targetId, evidenceIds }) => ({ kind, sourceId, targetId, evidenceIds })),
    ...(sourceHashes ? { sourceHashes } : {}) });
}

function canonical(architecture: ArchitectureDeclaration): Map<string, PlannedNode> {
  return new Map(architecture.systems.flatMap(system => [
    { id: system.id, kind: 'system' as const, name: system.name, purpose: system.purpose, roots: system.roots ?? [] },
    ...system.subsystems.flatMap(sub => [
      { id: sub.id, kind: 'subsystem' as const, parentId: system.id, name: sub.name, purpose: sub.purpose, roots: sub.roots,
        allowedDependencies: sub.allowedDependencies, forbiddenDependencies: sub.forbiddenDependencies },
      ...(sub.components ?? []).map(component => ({ id: component.id, kind: 'component' as const, parentId: sub.id,
        name: component.name, purpose: component.purpose, roots: component.roots }))
    ])
  ]).map(node => [node.id, node]));
}
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const contract = (n?: PlannedNode) => n && [n.purpose, n.roots, n.allowedDependencies ?? [], n.forbiddenDependencies ?? []];
const relationsFor = (reality: RebaseReality, id: string) => reality.relationships.filter(r => r.sourceId === id || r.targetId === id)
  .map(r => [r.kind, r.sourceId, r.targetId, r.evidenceIds]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
// ponytail: scan the graph per referenced branch; index ownership if real rebase latency warrants it.
const physicalFor = (reality: RebaseReality, id: string) => {
  const nodes = new Map(reality.physicalNodes.map(n => [n.id, n]));
  const descendant = (nodeId: string): boolean => {
    const seen = new Set<string>();
    for (let cursor: string | undefined = nodeId; cursor && !seen.has(cursor); cursor = nodes.get(cursor)?.parentId) {
      if (cursor === id) return true;
      seen.add(cursor);
    }
    return false;
  };
  return reality.physicalNodes.filter(n => descendant(n.id)).map(n => [n.id, n.kind, n.name, n.parentId, n.evidenceIds,
    n.path && reality.sourceHashes?.[n.path]])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
};
function physicalEvidence(old: RebaseReality, current: RebaseReality, id: string): string[] {
  const before = new Map(old.physicalNodes.map(n => [n.id, n]));
  const after = new Map(current.physicalNodes.map(n => [n.id, n]));
  const branch = new Set([...physicalFor(old, id), ...physicalFor(current, id)].map(n => n[0] as string));
  const changed = [...branch].filter(nodeId => {
    const a = before.get(nodeId), b = after.get(nodeId);
    if (a?.path && old.sourceHashes?.[a.path] !== current.sourceHashes?.[a.path]) return true;
    return !same(a, b);
  });
  return changed.slice(0, 12).map(nodeId => {
    const a = before.get(nodeId), b = after.get(nodeId), path = b?.path ?? a?.path;
    return `${path ?? nodeId}: ${a?.evidenceIds.join(',') ?? 'absent'} → ${b?.evidenceIds.join(',') ?? 'absent'}${path && old.sourceHashes?.[path] !== current.sourceHashes?.[path] ? ' · source hash changed' : ''}`;
  }).concat(changed.length > 12 ? [`${changed.length - 12} more changed physical nodes`] : []);
}
function branches(id: string, old: Map<string, PlannedNode>, current: Map<string, PlannedNode>): string[] {
  const result = new Set<string>();
  for (const nodes of [old, current]) {
    const seen = new Set<string>();
    for (let cursor: string | undefined = id; cursor && !seen.has(cursor); cursor = nodes.get(cursor)?.parentId) {
      if (nodes.get(cursor)?.kind === 'system' || nodes.get(cursor)?.kind === 'subsystem') result.add(cursor);
      seen.add(cursor);
    }
  }
  return [...result];
}
function realized(change: PlannedTransformation, reality: RebaseReality): boolean {
  const physical = new Map(reality.physicalNodes.map(n => [n.id, n]));
  if (change.kind === 'remove') return change.currentIds.every(id => !physical.has(id));
  if (change.redirect) return reality.relationships.some(r => r.sourceId === change.redirect!.to.sourceId &&
    r.targetId === change.redirect!.to.targetId && r.kind === 'depends-on') &&
    !reality.relationships.some(r => r.sourceId === change.redirect!.from.sourceId && r.targetId === change.redirect!.from.targetId && r.kind === 'depends-on');
  if (change.kind === 'change-contract') return false;
  return change.futureNodes.length > 0 && change.futureNodes.every(future => {
    const node = physical.get(future.id);
    return node?.kind === future.kind && node.name === future.name && node.parentId === future.parentId;
  }) && (change.kind !== 'split' && change.kind !== 'merge' || change.currentIds.every(id => !physical.has(id)));
}

/** Pure three-way comparison. A changed global fingerprint never stains an unrelated transformation. */
export function previewRebase(map: PlanningMap, currentReality: RebaseReality): RebaseResult {
  const current = parseRebaseReality(currentReality), old = map.basisSnapshot;
  const changed = !same(map.basis, current.basis);
  const conflicts: RebaseConflict[] = [];
  const push = (t: PlannedTransformation, identityId: string, reason: RebaseConflict['reason'], evidence: string[]) => {
    if (!conflicts.some(c => c.transformationId === t.id && c.identityId === identityId && c.reason === reason))
      conflicts.push({ transformationId: t.id, identityId, reason, evidence });
  };
  if (changed) for (const t of map.transformations.filter(t => !t.adopted)) {
    if (!old) { push(t, t.currentIds[0] ?? t.futureNodes[0]?.id ?? t.redirect?.from.sourceId ?? map.id,
      'unresolved', ['Old basis graph unavailable']); continue; }
    const before = canonical(old.architecture), now = canonical(current.architecture);
    const refs = new Set([...t.currentIds, ...t.futureNodes.flatMap(n => n.parentId ? [n.parentId] : []),
      ...(t.redirect ? [t.redirect.from.sourceId, t.redirect.from.targetId, t.redirect.to.sourceId, t.redirect.to.targetId] : [])]);
    for (const id of refs) {
      const a = before.get(id), b = now.get(id);
      const direct = t.currentIds.includes(id) || !!t.redirect && [t.redirect.from.sourceId, t.redirect.from.targetId,
        t.redirect.to.sourceId, t.redirect.to.targetId].includes(id);
      if (!a) continue; // planned nodes are resolved by their producing transformation
      if (!b) { push(t, id, 'missing', [`Canonical ${id} was removed`]); continue; }
      if (a.kind !== b.kind) push(t, id, 'identity', [`${id}: ${a.kind} → ${b.kind}`]);
      if (a.name !== b.name) push(t, id, 'identity', [`${id}: ${a.name} → ${b.name}`]);
      if (a.parentId !== b.parentId) push(t, id, 'parent', [`${id}: ${a.parentId ?? 'project'} → ${b.parentId ?? 'project'}`]);
      if (!same(contract(a), contract(b))) push(t, id, 'contract', [`Canonical contract changed for ${id}`]);
      if (direct && !same(relationsFor(old, id), relationsFor(current, id))) push(t, id, 'relationship',
        [`Physical relationships changed for ${id}`, ...[...new Set([...old.relationships, ...current.relationships]
          .filter(r => r.sourceId === id || r.targetId === id).flatMap(r => r.evidenceIds))].slice(0, 12)]);
      if (direct) {
        const oldPhysical = physicalFor(old, id), currentPhysical = physicalFor(current, id);
        if (!same(oldPhysical, currentPhysical)) push(t, id,
          same(oldPhysical.map(entry => entry.slice(0, -1)), currentPhysical.map(entry => entry.slice(0, -1))) ? 'source-changed' : 'realized-differently',
          [`Physical branch changed for ${id}`, ...physicalEvidence(old, current, id)]);
      }
    }
    for (const future of t.futureNodes) if (!before.has(future.id) && now.has(future.id) && !realized(t, current))
      push(t, future.id, 'identity', [`Planned identity ${future.id} is now occupied`]);
    if (realized(t, current) && !realized(t, old)) {
      const existing = conflicts.filter(c => c.transformationId === t.id);
      for (const c of existing) conflicts.splice(conflicts.indexOf(c), 1);
      push(t, t.futureNodes[0]?.id ?? t.currentIds[0] ?? t.redirect?.to.sourceId ?? map.id,
        'already-realized', ['Physical Map matches target intent']);
    }
  }
  return { schemaVersion: 1, oldBasis: map.basis, currentBasis: current.basis, oldReality: old, currentReality: current,
    conflicts: conflicts.sort((a, b) => a.transformationId.localeCompare(b.transformationId) || a.identityId.localeCompare(b.identityId)),
    unaffectedTransformationIds: map.transformations.filter(t => !conflicts.some(c => c.transformationId === t.id)).map(t => t.id).sort() };
}

export function stalePlanningMap(map: PlanningMap, current: RebaseReality): StaleResult {
  const preview = previewRebase(map, current), old = map.basisSnapshot;
  const oldNodes = old ? canonical(old.architecture) : new Map<string, PlannedNode>();
  const nowNodes = canonical(current.architecture);
  const affectedTransformationIds = [...new Set(preview.conflicts.map(c => c.transformationId))].sort();
  const affectedBranchIds = [...new Set(preview.conflicts.flatMap(c => branches(c.identityId, oldNodes, nowNodes)))].sort();
  const architectureChanged = map.basis.architectureRevision !== current.basis.architectureRevision ||
    map.basis.architectureFingerprint !== current.basis.architectureFingerprint;
  const physicalChanged = map.basis.physicalInputFingerprint !== current.basis.physicalInputFingerprint ||
    map.basis.physicalGeneration !== current.basis.physicalGeneration;
  return { schemaVersion: 1, stale: architectureChanged || physicalChanged, architectureChanged,
    physicalChanged,
    affectedTransformationIds, affectedBranchIds, conflicts: preview.conflicts };
}

export function acceptRebase(map: PlanningMap, preview: RebaseResult, decisions: RebaseDecision[], at: string): PlanningMap {
  if (!same(map.basis, preview.oldBasis)) throw new Error('Stale Planning Map basis');
  const key = (c: Pick<RebaseConflict, 'transformationId' | 'identityId' | 'reason'>) => `${c.transformationId}\0${c.identityId}\0${c.reason}`;
  const conflicts = new Map(preview.conflicts.map(c => [key(c), c]));
  const chosen = new Map(decisions.map(d => [key(d), d]));
  if (chosen.size !== decisions.length || [...conflicts.keys()].some(id => !chosen.has(id)) ||
    decisions.some(d => !conflicts.has(key(d)))) throw new Error('Unresolved rebase conflict');
  const currentNodes = canonical(preview.currentReality.architecture);
  const replace = (id: string, ds: RebaseDecision[]): string => ds.find(d => d.action === 'replace-reference' && d.identityId === id)?.replacementId ?? id;
  const transformations = map.transformations.map(t => {
    const ds = decisions.filter(d => d.transformationId === t.id);
    if (!ds.length) return t;
    for (const decision of ds) {
      if (decision.action === 'replace-reference') {
        const previous = preview.oldReality && canonical(preview.oldReality.architecture).get(decision.identityId);
        const next = decision.replacementId && currentNodes.get(decision.replacementId);
        if (!previous || !next || previous.kind !== next.kind) throw new Error('Invalid replacement reference');
      } else if (decision.action !== 'keep-target' && decision.action !== 'accept-different') throw new Error('Invalid rebase decision');
      if (decision.reason === 'missing' && decision.action !== 'replace-reference')
        throw new Error('Missing reference requires explicit replacement');
    }
    return { ...t, currentIds: t.currentIds.map(id => replace(id, ds)),
      futureNodes: t.futureNodes.map(n => ({ ...n, id: ['modify', 'move', 'change-contract'].includes(t.kind) ? replace(n.id, ds) : n.id,
        parentId: n.parentId && replace(n.parentId, ds) })),
      redirect: t.redirect && { from: { ...t.redirect.from, sourceId: replace(t.redirect.from.sourceId, ds), targetId: replace(t.redirect.from.targetId, ds) },
        to: { ...t.redirect.to, sourceId: replace(t.redirect.to.sourceId, ds), targetId: replace(t.redirect.to.targetId, ds) } },
      ...(ds.some(d => d.action === 'accept-different') ? { resolution: 'accepted-different' as const } : {}) };
  });
  return parsePlanningMap({ ...map, basis: preview.currentBasis, basisSnapshot: preview.currentReality,
    transformations, reconciliation: undefined,
    editHistory: { undo: [], redo: [] }, revision: map.revision + 1,
    history: [...map.history, { revision: map.revision + 1,
      action: `rebase:${map.basis.architectureFingerprint}:${map.basis.physicalInputFingerprint}:${decisions.map(d => `${d.transformationId}/${d.identityId}/${d.reason}=${d.action}`).join(',')}`,
      at }] });
}
