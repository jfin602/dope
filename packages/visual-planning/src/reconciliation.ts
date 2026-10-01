import { parsePlanningReconciliation, parseRebaseReality } from './index';
import type { PlanningMap, PlanningReconciliation, RebaseReality, ReconciliationOutcome, ReconciliationResult } from './index';

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Compare source-backed physical evidence; canonical declarations alone do not prove implementation. */
export function reconcilePlanningMap(map: PlanningMap, input: RebaseReality, at: string): PlanningReconciliation {
  const current = parseRebaseReality(input), old = map.basisSnapshot;
  if (!old || current.basis.physicalGeneration <= map.basis.physicalGeneration ||
    current.basis.physicalGeneration <= old.basis.physicalGeneration)
    throw new Error('Fresh Software Map analysis required');
  const now = new Map(current.physicalNodes.map(node => [node.id, node]));
  const before = new Map(old.physicalNodes.map(node => [node.id, node]));
  const descendants = (reality: RebaseReality, id: string) => {
    const nodes = new Map(reality.physicalNodes.map(node => [node.id, node]));
    return reality.physicalNodes.filter(node => {
      const visited = new Set<string>();
      for (let cursor: string | undefined = node.id; cursor && !visited.has(cursor); cursor = nodes.get(cursor)?.parentId) {
        if (cursor === id) return true;
        visited.add(cursor);
      }
      return false;
    });
  };
  const physical = (reality: RebaseReality, id: string) => descendants(reality, id)
    .filter(node => node.kind === 'code').map(node => [node.id, node.parentId, node.evidenceIds,
      node.path && reality.sourceHashes?.[node.path]]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const results: ReconciliationResult[] = map.transformations.map(change => {
    const ids = [...new Set([...change.currentIds, ...change.futureNodes.map(node => node.id),
      ...(change.redirect ? [change.redirect.from.sourceId, change.redirect.from.targetId,
        change.redirect.to.sourceId, change.redirect.to.targetId] : [])])];
    const identityId = change.futureNodes[0]?.id ?? change.currentIds[0] ?? change.redirect?.to.sourceId ?? change.id;
    const changed = ids.some(id => !same(physical(old, id), physical(current, id)));
    const sourceEvidence = ids.flatMap(id => [old, current].flatMap(reality =>
      descendants(reality, id).filter(node => node.kind === 'code').flatMap(node => node.evidenceIds)));
    const evidenceIds = [...new Set(sourceEvidence)].sort();
    const relation = (sourceId: string, targetId: string, reality: RebaseReality) => reality.relationships.some(r =>
      r.kind === 'depends-on' && r.sourceId === sourceId && r.targetId === targetId && r.evidenceIds.length > 0);
    const matches = change.kind === 'remove' ? change.currentIds.every(id => !now.has(id) || physical(current, id).length === 0) :
      change.redirect ? relation(change.redirect.to.sourceId, change.redirect.to.targetId, current) &&
        !relation(change.redirect.from.sourceId, change.redirect.from.targetId, current) :
      change.futureNodes.every(node => {
        const actual = now.get(node.id);
        return actual?.kind === node.kind && actual.name === node.name && actual.parentId === node.parentId &&
          physical(current, node.id).length > 0;
      }) && (!['split', 'merge'].includes(change.kind) || change.currentIds.every(id => physical(current, id).length === 0));
    const verifiable = change.kind !== 'change-contract';
    const relationChanged = !!change.redirect &&
      (!same(old.relationships.filter(r => ids.includes(r.sourceId) || ids.includes(r.targetId)),
        current.relationships.filter(r => ids.includes(r.sourceId) || ids.includes(r.targetId))));
    const observed = changed || relationChanged || change.kind === 'remove' &&
      change.currentIds.some(id => physical(old, id).length > 0 && physical(current, id).length === 0);
    const outcome: ReconciliationOutcome = matches && observed && verifiable ? 'implemented-as-planned' :
      observed ? 'implemented-differently' : 'not-implemented';
    const relationEvidence = change.redirect ? current.relationships.filter(r => r.kind === 'depends-on' &&
      ids.includes(r.sourceId) && ids.includes(r.targetId)).flatMap(r => r.evidenceIds) : [];
    return { schemaVersion: 1 as const, transformationId: change.id, identityId, outcome,
      physicalGeneration: current.basis.physicalGeneration, evidenceIds: [...new Set([...evidenceIds, ...relationEvidence])].sort(),
      explanation: `${observed ? 'Physical source or dependency evidence changed' : 'No physical source or dependency change observed'}; ${matches ? 'target structure matches' : 'target structure does not match'}${verifiable ? '' : '; contract meaning is not physically verifiable'}` };
  });
  const covered = new Set(map.transformations.flatMap(change => [...change.currentIds, ...change.futureNodes.map(n => n.id),
    ...(change.redirect ? [change.redirect.from.sourceId, change.redirect.from.targetId,
      change.redirect.to.sourceId, change.redirect.to.targetId] : [])]));
  for (const node of new Map([...old.physicalNodes, ...current.physicalNodes].filter(n => n.kind === 'code').map(n => [n.id, n])).values()) {
    const previous = before.get(node.id), observed = now.get(node.id);
    if (previous && observed && same(previous, observed) &&
      (!node.path || old.sourceHashes?.[node.path] === current.sourceHashes?.[node.path])) continue;
    const owners = new Set<string>();
    for (let cursor: string | undefined = node.parentId; cursor; cursor = (now.get(cursor) ?? before.get(cursor))?.parentId) owners.add(cursor);
    if ([...owners].some(id => covered.has(id))) continue;
    results.push({ schemaVersion: 1, identityId: node.id, outcome: 'unexpected-implementation',
      physicalGeneration: current.basis.physicalGeneration, evidenceIds: (observed ?? previous)!.evidenceIds,
      branchIds: [...owners].filter(id => ['system', 'subsystem'].includes((now.get(id) ?? before.get(id))?.kind ?? '')).sort(),
      explanation: `${node.path ?? node.id}: physical source ${observed ? 'changed' : 'removed'} outside planned transformations` });
  }
  return parsePlanningReconciliation({ basis: current.basis, results, at });
}

export function reconciliationRollups(map: PlanningMap) {
  const results = map.reconciliation?.results ?? [];
  const forIds = (ids: string[]) => results.filter(result => result.transformationId && ids.includes(result.transformationId))
    .reduce((counts, result) => { counts[result.outcome] = (counts[result.outcome] ?? 0) + 1; return counts; },
      {} as Partial<Record<ReconciliationOutcome, number>>);
  const nodes = new Map([...(map.basisSnapshot?.physicalNodes ?? []), ...map.transformations.flatMap(t => t.futureNodes)]
    .map(n => [n.id, n]));
  const branches = new Map<string, string[]>();
  for (const t of map.transformations) for (const id of [...t.currentIds, ...t.futureNodes.map(n => n.id),
    ...(t.redirect ? [t.redirect.from.sourceId, t.redirect.from.targetId, t.redirect.to.sourceId, t.redirect.to.targetId] : [])]) {
    const seen = new Set<string>();
    for (let cursor: string | undefined = id; cursor && !seen.has(cursor); cursor = nodes.get(cursor)?.parentId) {
      seen.add(cursor);
      if (nodes.get(cursor)?.kind === 'system' || nodes.get(cursor)?.kind === 'subsystem')
        branches.set(cursor, [...new Set([...(branches.get(cursor) ?? []), t.id])]);
    }
  }
  const branchRollups = Object.fromEntries([...branches].map(([id, ids]) => [id, forIds(ids)]));
  for (const result of results.filter(r => r.outcome === 'unexpected-implementation')) for (const id of result.branchIds ?? []) {
    const counts = branchRollups[id] ??= {};
    counts['unexpected-implementation'] = (counts['unexpected-implementation'] ?? 0) + 1;
  }
  return { workItems: Object.fromEntries(map.workItems.map(w => [w.id, forIds(w.transformationIds)])),
    branches: branchRollups,
    map: { ...forIds(map.transformations.map(t => t.id)),
      'unexpected-implementation': results.filter(r => r.outcome === 'unexpected-implementation').length } };
}
