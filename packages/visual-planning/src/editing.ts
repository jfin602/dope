import type { ArchitectureDeclaration } from '@dope/software-map';
import { parsePlanningMap, projectTarget } from './index';
import type { DependencyRelationship, PlannedNode, PlannedTransformation, PlanningMap } from './index';

export type EditCommand =
  | { kind: 'add'; node: PlannedNode }
  | { kind: 'move'; id: string; parentId: string }
  | { kind: 'remove'; id: string }
  | { kind: 'draw-relationship'; sourceId: string; targetId: string }
  | { kind: 'redirect-relationship'; from: DependencyRelationship; to: DependencyRelationship }
  | { kind: 'modify' | 'change-contract' | 'split' | 'merge'; currentIds: string[]; futureNodes: PlannedNode[] };

export function previewTransformation(architecture: ArchitectureDeclaration, map: PlanningMap, command: EditCommand,
    transformationId: string): PlannedTransformation {
  if (map.status !== 'draft' && map.status !== 'active') throw new Error('Planning map is closed');
  const target = projectTarget(architecture, map);
  const nodes = new Map(target.nodes.map(node => [node.id, node]));
  const current = (id: string) => {
    const node = nodes.get(id);
    if (!node) throw new Error(`Unknown target identity ${id}`);
    return node;
  };
  let change: PlannedTransformation;
  if (command.kind === 'add') change = { id: transformationId, kind: 'add', currentIds: [], futureNodes: [command.node], dependsOn: [] };
  else if (command.kind === 'move') {
    const node = current(command.id), parent = current(command.parentId);
    if (node.kind === 'system' || parent.kind !== (node.kind === 'component' ? 'subsystem' : 'system') || node.parentId === parent.id)
      throw new Error('Invalid hierarchy move');
    change = { id: transformationId, kind: 'move', currentIds: [node.id], futureNodes: [{ ...node, parentId: parent.id }], dependsOn: [] };
  } else if (command.kind === 'remove') {
    current(command.id);
    change = { id: transformationId, kind: 'remove', currentIds: [command.id], futureNodes: [], dependsOn: [] };
  } else if (command.kind === 'draw-relationship') {
    const from = target.relationships.filter(r => r.sourceId === command.sourceId && r.policy === 'allowed');
    if (from.length !== 1 || from[0].targetId === command.targetId) throw new Error('Ambiguous dependency gesture');
    change = { id: transformationId, kind: 'redirect-relationship', currentIds: [], futureNodes: [], dependsOn: [],
      redirect: { from: from[0], to: { sourceId: command.sourceId, targetId: command.targetId, policy: 'allowed' } } };
  } else if (command.kind === 'redirect-relationship') {
    if (!target.relationships.some(r => JSON.stringify(r) === JSON.stringify(command.from))) throw new Error('Unknown relationship');
    if (JSON.stringify(command.from) === JSON.stringify(command.to) ||
        target.relationships.some(r => JSON.stringify(r) === JSON.stringify(command.to))) throw new Error('Conflicting relationship');
    change = { id: transformationId, kind: command.kind, currentIds: [], futureNodes: [], dependsOn: [],
      redirect: { from: command.from, to: command.to } };
  } else {
    for (const id of command.currentIds) current(id);
    change = { id: transformationId, kind: command.kind, currentIds: command.currentIds,
      futureNodes: command.futureNodes, dependsOn: [] };
  }
  const touched = (item: PlannedTransformation) => [...item.currentIds, ...item.futureNodes.map(node => node.id)];
  if (map.transformations.some(item => item.id === change.id || touched(item).some(id => touched(change).includes(id)) ||
      !!(item.redirect && change.redirect && JSON.stringify(item.redirect.from) === JSON.stringify(change.redirect.from))))
    throw new Error('Conflicting transformation reference');
  const proposed = parsePlanningMap({ ...map, transformations: [...map.transformations, change] });
  projectTarget(architecture, proposed);
  return proposed.transformations.find(item => item.id === transformationId)!;
}
