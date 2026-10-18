import assert from 'node:assert/strict';
import test from 'node:test';
import { projectWorkflowLineage } from '../../packages/theia-extension/lib/node/workflow-lineage.js';
import type { RoadmapIndex, RoadmapLink } from '../../packages/project-intelligence/src/node/roadmap-store.ts';
import type { PlanningMap } from '../../packages/visual-planning/src/index.ts';
import type { RoadmapTaskStack } from '../../packages/agent-core/src/node/roadmap-task-discovery.ts';
import type { AgentTaskSequence } from '../../packages/agent-core/src/sequence.ts';
import type { AgentTask, AgentRun } from '../../packages/agent-core/src/contracts.ts';
import type { HistoryEntry } from '../../packages/contracts/src/history.ts';

const basis = { architectureRevision: 1, architectureFingerprint: 'a', physicalInputFingerprint: 'p', physicalGeneration: 2 };
const map: PlanningMap = { schemaVersion: 1, id: 'map', projectId: 'project', title: 'Map', objective: 'Target',
  status: 'completed', revision: 3, history: [], basis,
  transformations: [{ id: 'change', kind: 'modify', currentIds: ['component'], futureNodes: [], dependsOn: [] }],
  workItems: [{ id: 'work', title: 'Work', objective: 'Implement', transformationIds: ['change'], dependsOn: [],
    requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: [], status: 'completed' }] };
const link: RoadmapLink = { owner: 'planning-map', targetId: 'map', ownerProjectId: 'project', ownerRevision: 3, basis };
const roadmap = (links: RoadmapLink[] = [], status: RoadmapIndex['checkpoints'][number]['status'] = 'not-implemented'): RoadmapIndex => ({
  schemaVersion: 1, projectId: 'project', projectRoot: '/project', revision: 1,
  checkpoints: ['first', 'second'].map(id => ({ id, kind: 'milestone', title: id, objective: '', order: 0,
    dependencies: [], links, status, readOnly: false, evidence: [] }))
});
const stack: RoadmapTaskStack = { folderName: 'c11-example', path: 'docs/tasks/c11-example', mode: 'correction', phase: 11,
  fingerprint: 'a'.repeat(64), executable: false,
  prompts: [{ number: 1, title: 'P1', kind: 'implementation', path: 'docs/tasks/c11-example/P1-test.txt',
    fingerprint: 'b'.repeat(64), browserRequired: false, version: '0.11.8' }] };
const sequence = { id: 'sequence', status: 'completed', stack: { sourcePath: stack.path, fingerprint: stack.fingerprint },
  checkpoints: [{ entryNumber: 1, sha: 'sha', taskId: 'task', runId: 'run' }] } as AgentTaskSequence;
const task = { id: 'task', projectId: 'project', origin: { kind: 'phase-stack', promptId: 'P1' },
  phaseStack: { stackFingerprint: stack.fingerprint } } as AgentTask;
const run = { id: 'run', taskId: 'task', projectId: 'project', status: 'completed' } as AgentRun;
const observed = (checkpointId: string, value = link) => ({ checkpointId, link: value, resolved: true });

test('one map supports several checkpoints, but completed WorkItems and runs do not derive qualification', () => {
  const result = projectWorkflowLineage({ roadmap: roadmap([link]), maps: [map], currentBasis: basis,
    planningLinks: [observed('first'), observed('second')], stacks: [stack],
    stackAssociations: [{ checkpointId: 'first', stackPath: stack.path, fingerprint: stack.fingerprint! }],
    sequences: [sequence], tasks: [task], runs: [run] });
  assert.equal(result[0].stage, 'Validating');
  assert.equal(result[1].stage, 'Prepared');
  assert.equal(result[0].links.filter(edge => edge.to.kind === 'run').length, 1);
  assert.equal(result[0].links.filter(edge => edge.to.kind === 'transformation').length, 2);
  assert.equal(result[0].links.every(edge => edge.to.projectId === 'project'), true);
  assert.equal(result[0].links.some(edge => (edge.to.kind as string) === 'session'), false);
  assert.deepEqual(result[0].reconciliation[0].checkpointStacks,
    [{ projectId: 'project', kind: 'stack', id: stack.path }]);
  assert.equal(roadmap([link]).checkpoints[0].status, 'not-implemented');
});

test('stale revision and basis, missing and foreign links remain distinct from absent planning', () => {
  assert.equal(projectWorkflowLineage({ roadmap: roadmap() })[0].stage, 'Roadmapped');
  assert.equal(projectWorkflowLineage({ roadmap: roadmap() })[0].ownerStatus, 'not-implemented');
  assert.equal(projectWorkflowLineage({ roadmap: roadmap([], 'unknown') })[0].ownerStatus, 'unknown');
  const cases: [RoadmapLink, 'stale' | 'missing' | 'foreign' | 'unverified'][] = [
    [{ ...link, ownerRevision: 2 }, 'stale'],
    [{ ...link, basis: { ...basis, physicalGeneration: 1 } }, 'stale'],
    [{ ...link, targetId: 'absent' }, 'missing'],
    [{ ...link, ownerProjectId: 'other' }, 'foreign'],
    [link, 'unverified']
  ];
  for (const [candidate, reason] of cases) {
    const view = projectWorkflowLineage({ roadmap: roadmap([candidate]), maps: [map], currentBasis: basis });
    assert.equal(view[0].stage, 'Roadmapped');
    assert.equal(view[0].unresolved[0].reason, reason);
    assert.deepEqual(view[0].conditions, reason === 'stale' ? ['Stale'] : []);
  }
});

test('multiple explicit stacks require matching fingerprints and project-scoped task/run evidence', () => {
  const other = { ...stack, path: 'docs/tasks/c11-other', fingerprint: 'c'.repeat(64),
    prompts: stack.prompts.map(prompt => ({ ...prompt, path: 'docs/tasks/c11-other/P1-test.txt' })) };
  const result = projectWorkflowLineage({ roadmap: roadmap(), stacks: [stack, other],
    stackAssociations: [stack, other].map(item => ({ checkpointId: 'first', stackPath: item.path, fingerprint: item.fingerprint! })),
    sequences: [sequence], tasks: [{ ...task, projectId: 'foreign' }], runs: [run] });
  assert.equal(result[0].links.filter(edge => edge.to.kind === 'stack').length, 2);
  assert.equal(result[0].links.some(edge => edge.to.kind === 'run'), false);
  assert.equal(result[0].stage, 'Validating'); // Sequence completion, not a qualified outcome.
  const changed = projectWorkflowLineage({ roadmap: roadmap(), stacks: [stack],
    stackAssociations: [{ checkpointId: 'first', stackPath: stack.path, fingerprint: 'd'.repeat(64) }] });
  assert.deepEqual(changed[0].unresolved, [{ kind: 'stack', id: stack.path, reason: 'stale' }]);
  assert.equal(changed[0].stage, 'Roadmapped');
});

test('WorkItem delegation uses actual owner basis and run status without implying qualification', () => {
  const delegated = { id: 'delegated', projectId: 'project', origin: { kind: 'work-item', projectId: 'project',
    planningMapId: 'map', workItemId: 'work', mapRevision: 3, basis } } as AgentTask;
  const failed = { id: 'failed-run', taskId: 'delegated', projectId: 'project', status: 'failed' } as AgentRun;
  const view = projectWorkflowLineage({ roadmap: roadmap([link]), maps: [map], currentBasis: basis,
    planningLinks: [observed('first'), observed('second')], tasks: [delegated], runs: [failed] });
  assert.equal(view[0].stage, 'Implementing');
  assert.deepEqual(view[0].conditions, ['Failed']);
  assert.equal(view[0].links.some(edge => edge.to.kind === 'run' && edge.to.id === 'failed-run'), true);
  const staleTask = { ...delegated, origin: { ...delegated.origin, mapRevision: 2 } } as AgentTask;
  const staleView = projectWorkflowLineage({ roadmap: roadmap([link]), maps: [map], currentBasis: basis,
    planningLinks: [observed('first'), observed('second')], tasks: [staleTask], runs: [failed] });
  assert.equal(staleView[0].stage, 'Prepared');
  assert.equal(staleView[0].links.some(edge => edge.to.kind === 'run'), false);
});

test('owner-backed Not Green, Green evidence and closeout are separate observations', () => {
  const notGreen = projectWorkflowLineage({ roadmap: roadmap([], 'not-green') });
  assert.equal(notGreen[0].stage, 'Roadmapped');
  assert.deepEqual(notGreen[0].conditions, ['Not Green']);
  const green = roadmap([], 'green');
  const closeouts = [{ projectId: 'project', checkpointId: 'first', evidenceId: 'decision-1' }];
  assert.equal(projectWorkflowLineage({ roadmap: green, closeouts })[0].stage, 'Roadmapped');
  green.checkpoints[0].evidence.push({ path: 'qualification.md', sha256: 'a'.repeat(64), line: 1, text: 'Owner result' });
  const result = projectWorkflowLineage({ roadmap: green, closeouts });
  assert.equal(result[0].stage, 'Closed');
  assert.equal(result[1].stage, 'Roadmapped');
  assert.equal(projectWorkflowLineage({ roadmap: green, closeouts: [{ ...closeouts[0], projectId: 'foreign' }] })[0].stage, 'Qualified');
});

test('captured ideas and accepted brainstorm drafts remain source-scoped and noncanonical', () => {
  const idea = { schemaVersion: 2 as const, id: 'idea', type: 'idea' as const, status: 'captured' as const,
    title: 'Idea', body: 'Body', provenance: 'developer' as const, createdAt: null, updatedAt: null,
    archivedAt: null, links: [] };
  const source = { roadmap: roadmap(), projectMind: { schemaVersion: 2 as const, projectId: 'project', revision: 1,
    artifacts: [idea] }, brainstormDraft: { projectId: 'project', draft: { revision: 1,
    phases: [{ id: 'draft-phase', title: 'Draft', objective: '', checkpoints: [] }] } } };
  assert.deepEqual(projectWorkflowLineage(source).map(item => item.stage),
    ['Captured', 'Brainstorming', 'Roadmapped', 'Roadmapped']);
  assert.equal(projectWorkflowLineage({ ...source, projectMind: { ...source.projectMind, projectId: 'foreign' },
    brainstormDraft: { ...source.brainstormDraft, projectId: 'foreign' } }).length, 2);
});

test('Bridge reconciliation carries physical outcomes with exact Work, validation and History attribution', () => {
  const reported: PlanningMap = { ...map, reconciliation: { basis, at: '2026-10-18', results: [
    { schemaVersion: 1, transformationId: 'change', identityId: 'component', outcome: 'implemented-differently',
      physicalGeneration: 2, evidenceIds: ['syntax:component'], explanation: 'Changed source' },
    { schemaVersion: 1, identityId: 'code:surprise', outcome: 'unexpected-implementation',
      physicalGeneration: 2, evidenceIds: ['syntax:surprise'], explanation: 'Outside plan', branchIds: ['branch'] }
  ] } };
  const delegated = { id: 'delegated', projectId: 'project', origin: { kind: 'work-item', projectId: 'project',
    planningMapId: 'map', workItemId: 'work', mapRevision: 3, basis } } as AgentTask;
  const completed = { id: 'done', taskId: 'delegated', projectId: 'project', status: 'completed',
    validationResults: [{ status: 'passed' }] } as AgentRun;
  const history: HistoryEntry[] = [{ projectId: 'project', projectRoot: '/project', kind: 'event', source: 'agent',
    sourceId: 'run:done', owner: { kind: 'agent-run', runId: 'done' }, title: 'Run',
    status: { kind: 'owner', label: 'Completed' }, availability: 'available', occurredAt: '2026-10-18', observedAt: null }];
  const view = projectWorkflowLineage({ roadmap: roadmap([link]), maps: [reported], currentBasis: basis,
    planningLinks: [observed('first'), observed('second')], tasks: [delegated], runs: [completed], historyEntries: history });
  assert.equal(view[0].stage, 'Validating');
  assert.equal(view[0].ownerStatus, 'not-implemented');
  const report = view[0].reconciliation[0];
  assert.equal(report.sourceState, 'matches-observed-analysis');
  assert.deepEqual(report.basis, basis);
  assert.deepEqual(report.counts, { 'implemented-differently': 1, 'unexpected-implementation': 1 });
  assert.equal(report.rollups?.workItems.work['implemented-differently'], 1);
  assert.equal(report.rollups?.branches.branch['unexpected-implementation'], 1);
  assert.deepEqual(report.outcomes[0].workItems, [{ projectId: 'project', kind: 'work-item', id: 'map/work' }]);
  assert.deepEqual(report.outcomes[0].runs, [{ ref: { projectId: 'project', kind: 'run', id: 'done' },
    status: 'completed', validation: ['passed'], taskMapRevision: 3, basisState: 'matches-map' }]);
  assert.deepEqual(report.outcomes[0].history, [{ source: 'agent', sourceId: 'run:done' }]);
  assert.match(report.outcomes[0].ambiguity!, /Manual disposition is unresolved/);
  assert.equal(report.outcomes[1].runs.length, 0);
  assert.match(report.outcomes[1].ambiguity!, /no planned transformation/);
  const changed = projectWorkflowLineage({ roadmap: roadmap([link]), maps: [reported],
    currentBasis: { ...basis, physicalInputFingerprint: 'different' }, planningLinks: [observed('first'), observed('second')] });
  assert.equal(changed[0].reconciliation[0].sourceState, 'source-drift');
  assert.deepEqual(changed[0].unresolved, [{ kind: 'planning-map', id: 'map', reason: 'stale' }]);
  assert.equal(changed[0].stage, 'Prepared');
  assert.equal(projectWorkflowLineage({ roadmap: roadmap([link]), maps: [reported], planningLinks: [observed('first')] })[0]
    .reconciliation[0].sourceState, 'unknown');
  assert.equal(projectWorkflowLineage({ roadmap: roadmap([link]), maps: [{ ...reported, reconciliation: undefined }],
    planningLinks: [observed('first')] })[0].reconciliation[0].sourceState, 'not-reconciled');
  const historical = projectWorkflowLineage({ roadmap: roadmap([link]), maps: [reported], currentBasis: basis,
    planningLinks: [observed('first')], tasks: [{ ...delegated, origin: { ...delegated.origin, mapRevision: 2 } } as AgentTask],
    runs: [completed] })[0].reconciliation[0].outcomes[0];
  assert.equal(historical.runs[0].basisState, 'historical');
  assert.match(historical.ambiguity!, /historical Planning Map/);
  const reanalyzed = projectWorkflowLineage({ roadmap: roadmap([link]), maps: [reported],
    currentBasis: { ...basis, physicalGeneration: 3 }, planningLinks: [observed('first')] })[0];
  assert.equal(reanalyzed.reconciliation[0].sourceState, 'same-source-new-generation');
  assert.deepEqual(reanalyzed.unresolved, []);
  const manuallyResolved = { ...reported, transformations: [{ ...reported.transformations[0], resolution: 'accepted-different' as const }] };
  const resolvedView = projectWorkflowLineage({ roadmap: roadmap([link]), maps: [manuallyResolved], currentBasis: basis,
    planningLinks: [observed('first')] })[0].reconciliation[0].outcomes[0];
  assert.equal(resolvedView.disposition, 'accepted-different');
  assert.doesNotMatch(resolvedView.ambiguity ?? '', /Manual disposition is unresolved/);
});
