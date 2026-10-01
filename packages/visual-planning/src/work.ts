import { parsePlanningMap } from './index';
import type { PlanningMap, WorkItem, WorkItemSuggestion, WorkStatus } from './index';

const legal: Record<WorkStatus, WorkStatus[]> = {
  proposed: ['ready', 'cancelled'], ready: ['in-progress', 'cancelled'],
  'in-progress': ['ready', 'completed', 'cancelled'], completed: [], cancelled: []
};

export function acceptSuggestion(map: PlanningMap, suggestion: WorkItemSuggestion, id: string): WorkItem {
  const refs = suggestion.transformationIds;
  if (!refs.length || refs.some(ref => !map.transformations.some(item => item.id === ref))) throw new Error('Unknown suggestion transformation');
  return { id, title: suggestion.objective, objective: suggestion.objective, transformationIds: refs,
    dependsOn: [], requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: [], status: 'proposed' };
}

export function putWorkItem(map: PlanningMap, item: WorkItem): PlanningMap {
  const previous = map.workItems.find(work => work.id === item.id);
  if (previous && previous.status !== item.status && !legal[previous.status].includes(item.status))
    throw new Error(`Illegal WorkItem transition ${previous.status} -> ${item.status}`);
  if (!previous && item.status !== 'proposed') throw new Error('New WorkItem must be proposed');
  return parsePlanningMap({ ...map, workItems: [...map.workItems.filter(work => work.id !== item.id), item] });
}

export function splitWorkItem(map: PlanningMap, sourceId: string, parts: [WorkItem, WorkItem]): PlanningMap {
  const source = map.workItems.find(item => item.id === sourceId);
  if (!source || source.status === 'completed' || source.status === 'cancelled') throw new Error('WorkItem cannot be split');
  if (parts.some(part => part.id === sourceId || part.status !== 'proposed' || part.dependsOn.includes(sourceId)) || parts[0].id === parts[1].id)
    throw new Error('Invalid WorkItem split');
  if (parts.some(part => part.transformationIds.some(id => !source.transformationIds.includes(id))) ||
      source.transformationIds.some(id => !parts.some(part => part.transformationIds.includes(id))))
    throw new Error('Split must preserve transformation references');
  if (map.workItems.some(item => item.dependsOn.includes(sourceId))) throw new Error('Resolve dependent WorkItems before split');
  return parsePlanningMap({ ...map, workItems: [...map.workItems.filter(item => item.id !== sourceId), ...parts] });
}

export function mergeWorkItems(map: PlanningMap, sourceIds: [string, string], merged: WorkItem): PlanningMap {
  const parts = sourceIds.map(id => map.workItems.find(item => item.id === id));
  if (sourceIds[0] === sourceIds[1] || parts.some(item => !item || item.status === 'completed' || item.status === 'cancelled') ||
      merged.status !== 'proposed' || sourceIds.includes(merged.id)) throw new Error('Invalid WorkItem merge');
  const refs = new Set(parts.flatMap(item => item!.transformationIds));
  if (merged.transformationIds.length !== refs.size || merged.transformationIds.some(id => !refs.has(id)))
    throw new Error('Merge must preserve transformation references');
  if (map.workItems.some(item => !sourceIds.includes(item.id) && item.dependsOn.some(id => sourceIds.includes(id))))
    throw new Error('Resolve dependent WorkItems before merge');
  return parsePlanningMap({ ...map, workItems: [...map.workItems.filter(item => !sourceIds.includes(item.id)), merged] });
}
