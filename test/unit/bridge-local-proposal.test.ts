import assert from 'node:assert/strict';
import test from 'node:test';
import { BridgeLocalProposal } from '../../packages/theia-extension/lib/node/bridge-local-proposal.js';
import { localPlanningJson } from '../../packages/theia-extension/lib/node/roadmap-local-model.js';
import type { VisualPlanningService } from '../../packages/visual-planning/src/service.ts';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';

const basis = { architectureRevision: 0, architectureFingerprint: 'architecture',
  physicalInputFingerprint: 'physical', physicalGeneration: 2 };
const selection = { projectId: 'project', checkpointId: 'checkpoint', roadmapRevision: 4,
  mapId: 'map', mapRevision: 3, branchIds: ['system'] };
const map = { id: 'map', projectId: 'project', revision: 3, status: 'draft', basis,
  transformations: [{ id: 'change', kind: 'modify', currentIds: ['system'], futureNodes: [], dependsOn: [] }],
  workItems: [{ id: 'prior', transformationIds: ['change'], dependsOn: [] }] };
function fixture() {
  let revision = 7, impactStatus = 'ready', previews = 0, approved = true;
  const service = {
    attach: async () => ({ projectHandle: 'handle' }),
    read: async () => ({ projectId: 'project', revision, maps: [map] }),
    currentSoftwareImpact: async (request: typeof selection) => ({ status: request.projectId === 'project' &&
      request.checkpointId === 'checkpoint' && request.expectedRoadmapRevision === 4 ? impactStatus : 'stale',
      checkpoint: { id: 'checkpoint', title: 'Checkpoint', objective: 'Goal', requirements: ['Goal'] },
      roadmapRevision: 4, basis, planningMap: { id: 'map', revision: 3 },
      branches: [{ id: 'system', kind: 'system', name: 'System', purpose: 'Purpose' }],
      sources: [{ path: 'src/a.ts', evidenceIds: ['evidence'] }], relationships: [], uncertainties: [],
      limits: { maxBranches: 8, maxPaths: 24, maxRelationships: 24, maxBytes: 32768, truncated: false },
      action: { kind: 'refocus-branches', branchIds: ['system'], explicit: true } }),
    targetDesign: async () => ({ mapId: 'map', mapRevision: 3, collectionRevision: 7, basis,
      target: { nodes: [], relationships: [] }, diff: { nodes: ['system'], relationships: [] } }),
    targetApproved: async () => approved,
    suggestApprovedWorkItems: async () => [{ transformationIds: ['change'], dependsOn: [],
      objective: 'Implement change', projectId: 'project', mapId: 'map', basis,
      transformationKey: 'change', requirements: [], constraints: [], acceptanceCriteria: ['Works'],
      validationTargets: ['Test'], workingSet: ['src/a.ts'], assignment: 'HUMAN',
      delegablePaths: [], humanReservedPaths: [] }],
    preview: async () => { previews++; return map.transformations[0]; },
  } as unknown as VisualPlanningService;
  return { service, stale: () => { revision++; }, staleImpact: () => { impactStatus = 'stale'; },
    unapprove: () => { approved = false; },
    previews: () => previews };
}
const target = { type: 'bridge-proposal', projectId: 'project', checkpointId: 'checkpoint',
  roadmapRevision: 4, mapId: 'map', mapRevision: 3, basis,
  suggestion: { kind: 'target', transformationId: 'newChange', command: { kind: 'remove', id: 'system' } }, questions: [] };

test('Bridge proposal uses selected owner context and validates a target with the Planning preview service', async () => {
  const f = fixture();
  const prepared = await BridgeLocalProposal.prepare(f.service, '/tmp/bridge-fixture', selection);
  assert.match(prepared.instruction, /src\/a.ts/);
  assert.equal(await prepared.validate(target), true);
  assert.equal(f.previews(), 1);
  assert.equal(await prepared.validate({ ...target, projectId: 'foreign' }), false);
  assert.equal(await prepared.validate({ ...target, extra: 'injection' }), false);
  assert.equal(await prepared.validate({ ...target, suggestion: {
    ...target.suggestion, command: { kind: 'remove', id: 'foreign' } } }), false);
  assert.equal(await prepared.validate({ ...target, suggestion: {
    ...target.suggestion, command: { kind: 'remove', id: 'system', shell: 'run me' } } }), false);
  f.stale();
  assert.equal(await prepared.validate(target), false);
});

test('Bridge WorkItem suggestions require current transformations, dependencies and evidenced paths', async () => {
  const f = fixture();
  const prepared = await BridgeLocalProposal.prepare(f.service, '/tmp/bridge-fixture', selection);
  const suggestion = { kind: 'work-item', objective: 'Implement the approved target',
    transformationIds: ['change'], dependsOn: ['prior'], acceptanceCriteria: ['Behavior is covered'],
    validationTargets: ['Focused test'], workingSet: ['src/a.ts'] };
  assert.equal(await prepared.validate({ ...target, suggestion }), true);
  assert.equal(await prepared.validate({ ...target, suggestion: { ...suggestion, workingSet: ['../outside'] } }), false);
  assert.equal(await prepared.validate({ ...target, suggestion: { ...suggestion, dependsOn: ['unknown'] } }), false);
  f.staleImpact();
  assert.equal(await prepared.validate({ ...target, suggestion }), false);
  const without = fixture(); without.unapprove();
  const noApproval = await BridgeLocalProposal.prepare(without.service, '/tmp/bridge-fixture', selection);
  assert.equal(await noApproval.validate({ ...target, suggestion }), false);
});

test('Bridge strict JSON buffers malformed output, allows a concrete no-action question and never streams a partial action', async () => {
  const f = fixture();
  const prepared = await BridgeLocalProposal.prepare(f.service, '/tmp/bridge-fixture', selection);
  let attempts = 0;
  const complete = await localPlanningJson(async function* () {
    attempts++;
    yield { type: 'delta', text: '{"type":"bridge-proposal"' };
    yield { type: 'complete', text: JSON.stringify(attempts === 1 ? { ...target, projectId: 'foreign' } : target) };
  }, new AbortController().signal, 32768, 'bridge', true,
  { validateBridge: value => prepared.validate(value) });
  assert.equal(attempts, 2);
  assert.equal(JSON.parse(complete.text).projectId, 'project');
  const question = await localPlanningJson(async function* () {
    yield { type: 'complete', text: '{"type":"no-action","message":"Which Architecture branch should I assess?"}' };
  }, new AbortController().signal, 32768, 'bridge', true,
  { validateBridge: value => prepared.validate(value) });
  assert.equal(JSON.parse(question.text).type, 'no-action');
});

test('Bridge preparation rejects foreign and stale owner context before inference', async () => {
  const f = fixture();
  await assert.rejects(BridgeLocalProposal.prepare(f.service, '/tmp/bridge-fixture',
    { ...selection, projectId: 'foreign' }), /current owner review/);
  await assert.rejects(BridgeLocalProposal.prepare(f.service, '/tmp/bridge-fixture',
    { ...selection, branchIds: [] }), /Select a current checkpoint/);
});

test('saved Chat Bridge turn uses exact selected local model and never calls a hosted provider', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-bridge-chat-'));
  const f = fixture();
  let generated = 0;
  let provider: 'local' | 'hosted' = 'hosted';
  const models = { list: async () => ({ connections: [{ id: 'selected', ready: true, providerId: provider,
    models: [{ id: 'model', label: 'Selected', usable: true,
      capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 16384 } }] }] }),
    async *generate() { generated++; yield { type: 'complete', text: JSON.stringify(target) }; } };
  const composer = { compose: async () => ({ messages: [{ role: 'user', content: 'Suggest a target' }],
    refs: [{ schemaVersion: 1, kind: 'roadmap-checkpoint', id: 'checkpoint', label: 'Checkpoint',
      projectId: 'project', ownerRevision: 4, estimatedTokens: 20, includedBytes: 100,
      contentHash: 'a'.repeat(64) }], diagnostics: [], usedTokens: 20, budgetTokens: 10000 }) };
  const repository = new ChatRepository();
  const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
    composer as never, undefined, undefined, undefined, undefined, f.service);
  try {
    const { projectHandle } = await backend.attach(pathToFileURL(root).href);
    const chatId = randomUUID();
    const created = await backend.mutate({ projectHandle, expectedRevision: 0,
      operation: { type: 'create-chat', id: chatId, folderPath: '' } });
    const settings = structuredClone(created.chats[0].settings);
    settings.context.reservedOutputTokens = 512;
    await backend.mutate({ projectHandle, expectedRevision: created.revision,
      operation: { type: 'set-settings', chatId, settings } });
    const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
    assert.equal(lease.acquired, true);
    if (!lease.acquired) return;
    const request = { projectHandle, chatId, leaseToken: lease.token,
      selectedModel: { connectionId: 'selected', modelId: 'model' }, content: 'Suggest a target',
      context: [{ kind: 'roadmap-checkpoint' as const, id: 'checkpoint', projectId: 'project', ownerRevision: 4 }],
      bridgeProposal: selection };
    await assert.rejects(backend.runTurn(request), /selected local model/);
    await assert.rejects(backend.runTurn({ ...request, hostedProjectDataAuthorized: true }), /selected local model/);
    assert.equal(generated, 0);
    provider = 'local';
    const result = await backend.runTurn(request);
    assert.equal(result.proposal, undefined);
    assert.equal(generated, 1);
    const saved = (await backend.get(projectHandle, chatId))!.messages.at(-1)!;
    assert.equal(saved.role, 'assistant');
    if (saved.role === 'assistant') {
      assert.equal(saved.planningActivity?.kind, 'bridge-proposal');
      assert.equal(saved.planningActivity?.status, 'suggested');
      assert.equal(saved.planningActivity?.refs.some(ref => ref.kind === 'planning-map' && ref.id === 'map'), true);
      assert.equal(saved.execution.actualModel?.modelId, 'model');
    }
  } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});
