import { parseArchitecture } from '@dope/software-map';
import type { ArchitectureDeclaration, ComponentDeclaration, SubsystemDeclaration, SystemDeclaration } from '@dope/software-map';
import { parsePlanningMap, projectTarget } from './index';
import type { PlannedNode, PlannedTransformation, PlanningMap } from './index';

export type AdoptionScope = { kind: 'system' | 'subsystem' | 'component'; id: string } | { kind: 'transformations'; ids: string[] };
export interface CanonicalChange { id: string; kind: PlannedNode['kind']; action: 'add' | 'change' | 'remove' | 'reparent' | 'dependency'; before?: PlannedNode; after?: PlannedNode }
export interface AdoptionPreview {
  scope: AdoptionScope; selectedTransformationIds: string[]; includedDependentTransformationIds: string[];
  changes: CanonicalChange[]; blockers: string[]; declaration?: ArchitectureDeclaration;
}
const order = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
function nodes(architecture: ArchitectureDeclaration): PlannedNode[] {
  return architecture.systems.flatMap(system => [
    { id: system.id, kind: 'system', name: system.name, purpose: system.purpose, roots: system.roots ?? [] } as PlannedNode,
    ...system.subsystems.flatMap(sub => [
      { id: sub.id, kind: 'subsystem', parentId: system.id, name: sub.name, purpose: sub.purpose, roots: sub.roots,
        ...(sub.allowedDependencies === undefined ? {} : { allowedDependencies: sub.allowedDependencies }),
        ...(sub.forbiddenDependencies === undefined ? {} : { forbiddenDependencies: sub.forbiddenDependencies }) } as PlannedNode,
      ...(sub.components ?? []).map(component => ({ id: component.id, kind: 'component', parentId: sub.id,
        name: component.name, purpose: component.purpose, roots: component.roots } as PlannedNode))
    ])
  ]);
}
function declarationFrom(nodes: PlannedNode[]): ArchitectureDeclaration {
  const systems: SystemDeclaration[] = nodes.filter(n => n.kind === 'system').sort(order).map(system => ({
    id: system.id, name: system.name, purpose: system.purpose, ...(system.roots.length ? { roots: system.roots } : {}),
    subsystems: nodes.filter(n => n.kind === 'subsystem' && n.parentId === system.id).sort(order).map(sub => ({
      id: sub.id, name: sub.name, purpose: sub.purpose, roots: sub.roots,
      ...(sub.allowedDependencies === undefined ? {} : { allowedDependencies: sub.allowedDependencies }),
      ...(sub.forbiddenDependencies === undefined ? {} : { forbiddenDependencies: sub.forbiddenDependencies }),
      components: nodes.filter(n => n.kind === 'component' && n.parentId === sub.id).sort(order).map(component => ({
        id: component.id, name: component.name, purpose: component.purpose, roots: component.roots
      } as ComponentDeclaration))
    } as SubsystemDeclaration))
  }));
  return parseArchitecture({ schemaVersion: 1, systems });
}
function diff(before: PlannedNode[], after: PlannedNode[]): CanonicalChange[] {
  const old = new Map(before.map(n => [n.id, n]));
  const next = new Map(after.map(n => [n.id, n]));
  return [...new Set([...old.keys(), ...next.keys()])].sort().flatMap(id => {
    const a = old.get(id), b = next.get(id);
    if (a && b && JSON.stringify(a) === JSON.stringify(b)) return [];
    const entry = (action: CanonicalChange['action']): CanonicalChange =>
      ({ id, kind: (b ?? a)!.kind, action, ...(a ? { before: a } : {}), ...(b ? { after: b } : {}) });
    if (!a || !b) return [entry(a ? 'remove' : 'add')];
    const actions: CanonicalChange['action'][] = [];
    if (a.parentId !== b.parentId) actions.push('reparent');
    if (JSON.stringify([a.allowedDependencies, a.forbiddenDependencies]) !== JSON.stringify([b.allowedDependencies, b.forbiddenDependencies])) actions.push('dependency');
    if (a.kind !== b.kind || a.name !== b.name || a.purpose !== b.purpose || JSON.stringify(a.roots) !== JSON.stringify(b.roots)) actions.push('change');
    return actions.map(entry);
  });
}
/** Pure authority preview; no geometry, WorkItem status, or physical evidence enters here. */
export function planAdoption(architecture: ArchitectureDeclaration, input: PlanningMap, scope: AdoptionScope): AdoptionPreview {
  const map = parsePlanningMap(input), canonical = parseArchitecture(architecture);
  const pending = map.transformations.filter(t => !t.adopted);
  const byId = new Map(pending.map(t => [t.id, t]));
  const blockers: string[] = [];
  if (map.status !== 'draft' && map.status !== 'active') blockers.push('Planning map is closed');
  const original = nodes(canonical);
  const existing = new Map(original.map(n => [n.id, n]));
  const projected = (declaration: ArchitectureDeclaration, items: PlannedTransformation[]) => {
    const producers = new Map(items.filter(t => ['add', 'split', 'merge'].includes(t.kind)).flatMap(t => t.futureNodes.map(n => [n.id, t.id] as const)));
    const expanded = items.map(t => {
      const references = [...t.currentIds, ...t.futureNodes.flatMap(n => [n.parentId, ...(n.allowedDependencies ?? []), ...(n.forbiddenDependencies ?? [])]),
        ...(t.redirect ? [t.redirect.to.sourceId, t.redirect.to.targetId] : [])].filter((id): id is string => !!id);
      const required = references.map(id => producers.get(id)).filter((id): id is string => !!id && id !== t.id);
      if (['remove', 'split', 'merge'].includes(t.kind)) for (const source of t.currentIds)
        for (const child of original.filter(n => n.parentId === source)) {
          const dependent = items.find(other => other.id !== t.id && other.currentIds.includes(child.id) && ['remove', 'move', 'split', 'merge'].includes(other.kind));
          if (dependent) required.push(dependent.id);
        }
      return { ...t, dependsOn: [...new Set([...t.dependsOn.filter(id => items.some(other => other.id === id)), ...required])].sort() };
    });
    return projectTarget(declaration, parsePlanningMap({ ...map, transformations: expanded, workItems: [] }));
  };
  const allFuture = new Map(map.transformations.flatMap(t => t.futureNodes.map(n => [n.id, n] as const)));
  const inBranch = (id: string, root: string, future: boolean): boolean => {
    const visited = new Set<string>();
    for (let cursor: string | undefined = id; cursor && !visited.has(cursor);
      cursor = future ? allFuture.get(cursor)?.parentId ?? existing.get(cursor)?.parentId : existing.get(cursor)?.parentId) {
      if (cursor === root) return true;
      visited.add(cursor);
    }
    return false;
  };
  let selected: string[];
  if (scope.kind === 'transformations') {
    selected = [...new Set(scope.ids)];
    if (!selected.length) blockers.push('Select at least one transformation');
  } else {
    const branch = allFuture.get(scope.id) ?? existing.get(scope.id);
    if (!branch || branch.kind !== scope.kind) blockers.push(`Unknown ${scope.kind} branch ${scope.id}`);
    selected = branch ? pending.filter(t => t.currentIds.some(id => inBranch(id, scope.id, false)) ||
      t.futureNodes.some(n => inBranch(n.id, scope.id, true)) ||
      !!(t.redirect && [t.redirect.from.sourceId, t.redirect.to.sourceId].some(id => inBranch(id, scope.id, false)))).map(t => t.id) : [];
    if (branch && !selected.length) blockers.push('Branch has no planned transformations');
  }
  for (const id of selected) if (!byId.has(id)) blockers.push(`Unknown or already adopted transformation ${id}`);
  const included = new Set(selected.filter(id => byId.has(id)));
  const include = (id: string): void => {
    const t = byId.get(id);
    if (!t) { blockers.push(`Unresolved transformation dependency ${id}`); return; }
    if (included.has(id)) return;
    included.add(id);
    for (const dep of t.dependsOn) if (byId.has(dep)) include(dep);
  };
  for (const id of [...included]) for (const dep of byId.get(id)!.dependsOn) if (byId.has(dep)) include(dep);
  // New parents and children needed by the strict declaration are deterministic dependencies.
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of [...included].map(id => byId.get(id)!)) {
      const references = [...t.currentIds, ...t.futureNodes.flatMap(n => [n.parentId, ...(n.allowedDependencies ?? []), ...(n.forbiddenDependencies ?? [])]),
        ...(t.redirect ? [t.redirect.from.sourceId, t.redirect.from.targetId, t.redirect.to.sourceId, t.redirect.to.targetId] : [])]
        .filter((id): id is string => !!id);
      for (const reference of references) if (!existing.has(reference)) {
        const producer = pending.find(other => other.id !== t.id && ['add', 'split', 'merge'].includes(other.kind) && other.futureNodes.some(n => n.id === reference));
        if (producer && !included.has(producer.id)) { include(producer.id); changed = true; }
      }
      for (const source of t.currentIds) if (['remove', 'split', 'merge'].includes(t.kind)) {
        for (const child of original.filter(n => n.parentId === source)) {
          const dependent = pending.filter(other => other.currentIds.includes(child.id) && ['remove', 'move', 'split', 'merge'].includes(other.kind));
          if (dependent.length === 1 && !included.has(dependent[0].id)) { include(dependent[0].id); changed = true; }
        }
      }
      for (const node of t.futureNodes) {
        const parent = node.parentId;
        if (parent && !existing.has(parent)) {
          const producer = pending.find(other => other.futureNodes.some(n => n.id === parent));
          if (!producer) blockers.push(`Missing parent ${parent}`);
          else if (!included.has(producer.id)) { include(producer.id); changed = true; }
        }
        if (node.kind === 'system' && !existing.has(node.id) && !pending.some(other => included.has(other.id) && other.futureNodes.some(n => n.parentId === node.id && n.kind === 'subsystem'))) {
          const children = pending.filter(other => other.futureNodes.some(n => n.parentId === node.id && n.kind === 'subsystem'));
          if (children.length === 1) { include(children[0].id); changed = true; }
          else blockers.push(`System ${node.id} requires a selected subsystem`);
        }
      }
    }
  }
  let declaration: ArchitectureDeclaration | undefined;
  let changes: CanonicalChange[] = [];
  if (!blockers.length) try {
    const chosen = map.transformations.filter(t => included.has(t.id));
    const byChosen = new Map(chosen.map(t => [t.id, t]));
    const precedes = (id: string, other: string, seen = new Set<string>()): boolean => {
      if (seen.has(other)) return false;
      seen.add(other);
      return byChosen.get(other)?.dependsOn.some(dep => dep === id || precedes(id, dep, seen)) ?? false;
    };
    for (let i = 0; i < chosen.length; i++) for (let j = i + 1; j < chosen.length; j++) {
      const a = chosen[i], b = chosen[j];
      const touched = (t: PlannedTransformation) => [...t.currentIds, ...t.futureNodes.map(n => n.id)];
      const overlap = a.redirect && b.redirect ? JSON.stringify(a.redirect.from) === JSON.stringify(b.redirect.from) :
        a.redirect || b.redirect ? false : touched(a).some(id => touched(b).includes(id));
      if (overlap && !precedes(a.id, b.id) && !precedes(b.id, a.id))
        throw new Error(`Conflicting transformations ${a.id} and ${b.id}`);
    }
    const target = projected(canonical, chosen);
    declaration = declarationFrom(target.nodes);
    changes = diff(original, nodes(declaration));
    if (!changes.length) blockers.push('Selected target makes no canonical change');
    const fullTarget = projected(canonical, map.transformations);
    const remaining = projected(declaration, map.transformations.map(t => included.has(t.id) ? { ...t, adopted: true } : t));
    if (JSON.stringify(fullTarget) !== JSON.stringify(remaining)) blockers.push('Partial adoption changes the still-planned target');
  } catch (error) { blockers.push(String(error)); }
  return { scope, selectedTransformationIds: selected.sort(), includedDependentTransformationIds: [...included].filter(id => !selected.includes(id)).sort(),
    changes, blockers: [...new Set(blockers)].sort(), ...(blockers.length ? {} : { declaration }) };
}
