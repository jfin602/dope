import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/chat-repository.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { DeveloperSessionChatPlanningResolver } from '../../packages/theia-extension/lib/node/developer-session-resolver.js';
import { DeveloperSessionAgentMindResolver } from '../../packages/theia-extension/lib/node/developer-session-resolver.js';
import { AgentStore } from '../../packages/agent-core/lib/node/agent-store.js';
import { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';

const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
  physicalInputFingerprint: 'source', physicalGeneration: 1 };
const chatId = () => randomUUID();
const folder = () => mkdtemp(join(tmpdir(), 'dope-session-resolver-'));

function resolver(root: string, current = () => Promise.resolve({ ...basis })) {
  let handle = 'attached';
  return { resolve: new DeveloperSessionChatPlanningResolver(() => ({ root, projectHandle: handle }),
    undefined, undefined, undefined, current), changeHandle: (next: string) => { handle = next; } };
}

test('Chat metadata peek preserves interrupted and legacy bytes and excludes transcripts', async () => {
  const root = await folder(), chats = new ChatRepository(), id = chatId();
  try {
    await chats.mutate(root, 0, { type: 'create-chat', id, folderPath: '', title: 'Linked Chat' });
    const manifestFile = join(root, '.dope/chats/index.json');
    const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
    const chatFile = join(root, '.dope/chats/folders', manifest.entries[0].file);
    const record = JSON.parse(await readFile(chatFile, 'utf8'));
    delete record.color; // Valid legacy record: normal Chat read would migrate it.
    record.messages = [{ schemaVersion: 1, id: chatId(), role: 'user', createdAt: record.createdAt,
      content: 'PRIVATE TRANSCRIPT', contextRefs: [] },
      { schemaVersion: 1, id: chatId(), role: 'assistant', createdAt: record.createdAt, content: '',
        execution: { schemaVersion: 1, id: chatId(), status: 'pending',
          selectedModel: { connectionId: 'local', modelId: 'model' }, startedAt: record.createdAt } }];
    await writeFile(chatFile, `${JSON.stringify(record)}\n`);
    const before = [await readFile(manifestFile), await readFile(chatFile)];
    const result = await resolver(root).resolve.resolve('attached', { kind: 'chat', chatId: id });
    assert.equal(result.availability, 'resolved');
    assert.equal(result.title, 'Linked Chat');
    assert.equal(JSON.stringify(result).includes('PRIVATE TRANSCRIPT'), false);
    assert.deepEqual([await readFile(manifestFile), await readFile(chatFile)], before);
    assert.equal((await resolver(root).resolve.resolve('attached', { kind: 'chat', chatId: chatId() })).availability, 'missing');
    await writeFile(chatFile, '{bad json');
    assert.equal((await resolver(root).resolve.resolve('attached', { kind: 'chat', chatId: id })).availability, 'unavailable');
    await writeFile(chatFile, before[1]);
    await writeFile(manifestFile, '{bad json');
    assert.equal((await resolver(root).resolve.resolve('attached', { kind: 'chat', chatId: id })).availability, 'unavailable');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Agent and Project Mind resolution keeps owner bytes and source facts distinct', async () => {
  const root = await folder(), agents = new AgentStore(), mind = new ProjectMindStore();
  const now = '2026-10-11T12:00:00.000Z', decisionId = randomUUID(), ideaId = randomUUID();
  const task = { version: 1 as const, id: 'task-one', createdAt: now, objective: 'One objective',
    instructions: 'Implement', projectRoot: '.' as const, modelPolicy: { kind: 'follow-coding-agent' as const },
    controls: {}, authority: { profile: 'phase-8b-project' as const },
    completion: { validation: [], requireValidationPass: false }, origin: { kind: 'direct' as const } };
  const run = { version: 1 as const, id: 'run-one', taskId: task.id, status: 'pending' as const,
    grantId: 'grant-one', grantRevision: 0, requestedPolicy: task.modelPolicy, projectRoot: '.' as const,
    createdAt: now, changedFiles: [], validationResults: [] };
  const artifact = (type: 'decision' | 'idea', id: string) => ({ schemaVersion: 2 as const,
    id, type, title: type, createdAt: now, updatedAt: now, provenance: 'developer' as const,
    archivedAt: null, links: [], status: type === 'decision' ? 'proposed' as const : 'captured' as const,
    ...(type === 'decision' ? { decision: 'Choice', context: '', rationale: '', consequences: '',
      alternatives: '', revisitConditions: '' } : { body: 'Idea body' }) });
  try {
    const subject = new DeveloperSessionAgentMindResolver(() => ({ root, projectHandle: 'attached' }));
    assert.equal((await subject.resolve('attached', { kind: 'agent-run', taskId: task.id, runId: run.id })).availability, 'missing');
    assert.equal((await subject.resolve('attached', { kind: 'agent-sequence', sequenceId: 'sequence-one' })).availability, 'missing');
    assert.equal((await subject.resolve('attached', { kind: 'project-mind', artifactType: 'decision', artifactId: decisionId })).availability, 'missing');
    await agents.createTask(root, task);
    await agents.createRun(root, run);
    await agents.createTask(root, { ...task, id: 'task-two' });
    await mind.mutate(root, 0, { type: 'create', artifact: artifact('decision', decisionId) });
    await mind.mutate(root, 1, { type: 'create', artifact: artifact('idea', ideaId) });
    const files = [join(root, '.dope/agent/tasks/task-one.json'), join(root, '.dope/agent/runs/run-one/run.json'),
      join(root, '.dope/project-mind.json')];
    const before = await Promise.all(files.map(file => readFile(file)));
    const linked = await subject.resolve('attached', { kind: 'agent-run', taskId: task.id, runId: run.id });
    assert.equal(linked.availability, 'resolved');
    assert.equal(linked.status, 'pending');
    assert.equal(linked.taskOrigin, 'direct');
    assert.equal(linked.validationStatus, 'unavailable');
    assert.equal(linked.promotionStatus, 'not-applied');
    assert.equal((await subject.resolve('attached', { kind: 'agent-run', taskId: 'task-two', runId: run.id })).availability, 'stale');
    assert.equal((await subject.resolve('attached', { kind: 'agent-task', taskId: task.id })).objective, task.objective);
    assert.equal((await subject.resolve('attached', { kind: 'project-mind', artifactType: 'decision', artifactId: decisionId })).status, 'proposed');
    assert.equal((await subject.resolve('attached', { kind: 'project-mind', artifactType: 'idea', artifactId: ideaId })).status, 'captured');
    assert.equal((await subject.resolve('attached', { kind: 'project-mind', artifactType: 'idea', artifactId: decisionId })).availability, 'stale');
    assert.equal((await subject.resolve('attached', { kind: 'project-mind', artifactType: 'idea', artifactId: randomUUID() })).availability, 'missing');
    assert.deepEqual(await Promise.all(files.map(file => readFile(file))), before);
    await writeFile(files[1], '{bad json');
    assert.equal((await subject.resolve('attached', { kind: 'agent-run', taskId: task.id, runId: run.id })).availability, 'unavailable');
    await writeFile(files[1], before[1]);
    await writeFile(files[2], '{bad json');
    assert.equal((await subject.resolve('attached', { kind: 'project-mind', artifactType: 'idea', artifactId: ideaId })).availability, 'unavailable');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Agent review and Dope validation projection uses exact run facts', async () => {
  const root = await folder();
  try {
    const task = { id: 'task-one', projectId: 'project-one', objective: 'Implement',
      origin: { kind: 'direct' }, completion: { validation: [] } };
    const base = { id: 'run-one', taskId: task.id, projectId: task.projectId, status: 'completed',
      candidateFingerprint: 'candidate', authorityDecision: { allowed: true }, appliedFiles: ['src/a.ts'],
      validationResults: [{ owner: 'dope', status: 'passed', candidateFingerprint: 'candidate' }] };
    let run: any = { ...base, reviewDecision: { kind: 'accept', candidateFingerprint: 'candidate' } };
    let sequence: any = { id: 'sequence-one', status: 'running', stack: { folderName: 'p9b' } };
    const agents = { readTask: async () => task, readRun: async () => run,
      readSequence: async () => sequence } as unknown as AgentStore;
    const subject = new DeveloperSessionAgentMindResolver(() => ({ root, projectHandle: 'attached' }),
      undefined, agents);
    const ref = { kind: 'agent-run' as const, taskId: task.id, runId: base.id };
    assert.deepEqual((( { validationStatus, reviewDecision, promotionStatus }) =>
      ({ validationStatus, reviewDecision, promotionStatus }))(await subject.resolve('attached', ref)),
      { validationStatus: 'passed', reviewDecision: 'accept', promotionStatus: 'applied' });
    task.completion.validation.push({ kind: 'test', label: 'required second target' });
    assert.equal((await subject.resolve('attached', ref)).validationStatus, 'incomplete');
    task.completion.validation.pop();
    run = { ...base, status: 'cancelled', reviewDecision: { kind: 'reject', candidateFingerprint: 'candidate' },
      validationResults: [{ owner: 'dope', status: 'failed', candidateFingerprint: 'candidate' }] };
    const rejected = await subject.resolve('attached', ref);
    assert.equal(rejected.validationStatus, 'failed');
    assert.equal(rejected.reviewDecision, 'reject');
    assert.equal(rejected.promotionStatus, 'not-applied');
    assert.equal((await subject.resolve('attached', { kind: 'agent-sequence', sequenceId: sequence.id })).status, 'running');
    sequence = undefined;
    assert.equal((await subject.resolve('attached', { kind: 'agent-sequence', sequenceId: 'sequence-one' })).availability, 'missing');
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Planning resolution uses exact composite identity, independent owner project ID and semantic basis', async () => {
  const root = await folder(), planning = new PlanningStore();
  try {
    await planning.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan', objective: 'Build', basis });
    const one = await planning.mutate(root, 1, { type: 'put-transformation', mapId: 'plan', transformation: {
      id: 'change', kind: 'add', currentIds: [], dependsOn: [],
      futureNodes: [{ id: 'core', kind: 'system', name: 'Core', purpose: 'Build', roots: [] }],
    } });
    await planning.mutate(root, 2, { type: 'put-work-item', mapId: 'plan', workItem: {
      id: 'work', title: 'Work', objective: 'Build', transformationIds: ['change'], dependsOn: [],
      requirements: [], constraints: [], acceptanceCriteria: [], validationTargets: [], workingSet: [], status: 'proposed',
    } });
    assert.match(one.projectId, /^project-/); // Never equated with Session's null Project Mind ID.
    let current = { ...basis, physicalGeneration: 42 };
    const subject = resolver(root, async () => current).resolve;
    const map = await subject.resolve('attached', { kind: 'planning-map', mapId: 'plan' });
    assert.equal(map.availability, 'resolved');
    assert.equal(map.status, 'draft');
    const work = await subject.resolve('attached', { kind: 'work-item', mapId: 'plan', workItemId: 'work' });
    assert.equal(work.availability, 'resolved');
    assert.equal(work.status, 'proposed');
    assert.equal(work.observedRevision, 2);
    assert.equal((await subject.resolve('attached', { kind: 'planning-map', mapId: 'missing' })).availability, 'missing');
    assert.equal((await subject.resolve('attached', { kind: 'work-item', mapId: 'missing', workItemId: 'work' })).availability, 'missing');
    assert.equal((await subject.resolve('attached', { kind: 'work-item', mapId: 'plan', workItemId: 'missing' })).availability, 'missing');
    current = { ...basis, physicalInputFingerprint: 'changed', physicalGeneration: 42 };
    assert.equal((await subject.resolve('attached', { kind: 'planning-map', mapId: 'plan' })).availability, 'stale');
    assert.equal((await subject.resolve('attached', { kind: 'work-item', mapId: 'plan', workItemId: 'work' })).availability, 'stale');
    const noEvidence = resolver(root, async () => undefined).resolve;
    assert.equal((await noEvidence.resolve('attached', { kind: 'planning-map', mapId: 'plan' })).availability, 'unavailable');
    const file = join(root, '.dope/planning-maps.json'), original = await readFile(file);
    await writeFile(file, '{bad json');
    assert.equal((await subject.resolve('attached', { kind: 'planning-map', mapId: 'plan' })).availability, 'unavailable');
    await writeFile(file, original);
    const foreignMap = JSON.parse(original.toString());
    foreignMap.maps[0].projectId = 'foreign-project';
    await writeFile(file, JSON.stringify(foreignMap));
    assert.equal((await subject.resolve('attached', { kind: 'planning-map', mapId: 'plan' })).availability, 'unavailable');
    await writeFile(file, original);
    const attachment = resolver(root);
    await assert.rejects(attachment.resolve.resolve('wrong', { kind: 'planning-map', mapId: 'plan' }), /handle/);
    attachment.changeHandle('replacement');
    await assert.rejects(attachment.resolve.resolve('attached', { kind: 'planning-map', mapId: 'plan' }), /handle/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
