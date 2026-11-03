import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { parseRoutingProvenance } from '../../packages/ai/lib/index.js';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { lockedRoadmapConversionInstruction } from '../../packages/theia-extension/lib/node/roadmap-local-model.js';

const natural = `Phase 1 — Path
Objective: Build a fixed path for enemies.
Gate — Movement
Purpose: Move enemies across the path.
- Enemies cross every waypoint in sequence.
Phase 2 — Combat
Objective: Build a basic tower attack.
Gate — Attack
Purpose: Damage enemies with a tower.
- The tower damages one visible enemy when fired.`;
const markers = ['RM1', 'P|Path|Build a fixed path for enemies.',
  'G|Movement|Move enemies across the path.', 'C|Enemies cross every waypoint in sequence.',
  'P|Combat|Build a basic tower attack.', 'G|Attack|Damage enemies with a tower.',
  'C|The tower damages one visible enemy when fired.', 'END'].join('\n');
const target = { connectionId: 'local', modelId: 'q4' };
const hard = { requiredCapabilities: ['conversationalText', 'streaming'], locality: 'local-only',
  enabledOnly: true, usableOnly: true, hostedProjectData: 'requires-feature-authorization' } as const;

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'dope-two-pass-'));
  const repository = new ChatRepository(), roadmapStore = new RoadmapStore();
  const greenfield = new RoadmapGreenfield(roadmapStore);
  const index = { status: () => ({ state: 'idle', generation: 0 }), snapshot: () => undefined,
    inputsCurrent: async () => false };
  const state = { chosen: { ...target }, provider: 'local', ready: true, usable: true,
    contextWindowTokens: 32768, afterLock: undefined as undefined | (() => Promise<void>),
    onConversion: undefined as undefined | ((signal: AbortSignal) => Promise<void>),
    failFinish: false, cancelAtFinish: false, stagedAtFinish: false };
  const requests: { channel: 'role' | 'model'; selection: typeof target;
    messages: readonly { role: string; content: string }[]; signal?: AbortSignal }[] = [];
  const models = { list: async () => ({ connections: [{ id: 'local', label: 'Local', ready: state.ready,
    providerId: state.provider, models: [{ id: 'q4', label: 'Q4', usable: state.usable,
      capabilities: { conversationalText: true, streaming: true,
        contextWindowTokens: state.contextWindowTokens, maxInputTokens: state.contextWindowTokens } }] }] }),
    async *generate(selection: typeof target, request: { messages: typeof requests[number]['messages'];
      signal?: AbortSignal; projectTools?: unknown }) {
      requests.push({ channel: 'model', selection, messages: request.messages, signal: request.signal });
      if (request.messages[0]?.content.includes('RM1')) {
        assert.equal(request.projectTools, undefined);
        await state.onConversion?.(request.signal!);
        if (request.signal?.aborted) return;
        yield { type: 'complete' as const, text: markers, actualModelId: 'q4', finishReason: 'stop',
          usage: { tokenMeasurement: 'unavailable' as const },
          provenance: { connectionId: 'local', modelId: 'q4', providerId: 'local', modelLabel: 'Q4' } };
      } else yield { type: 'complete' as const, text: 'Ordinary answer', actualModelId: 'q4',
        finishReason: 'stop', usage: { tokenMeasurement: 'unavailable' as const } };
    } };
  const routing = { async resolve() { return { inventory: { models: [{ ...target,
    providerModelKey: 'q4', locality: 'local' }] }, resolution: { selectedTarget: { ...state.chosen } } }; },
    async *generate(request: { allowFallback: boolean; localOnly: boolean; signal: AbortSignal;
      conversation: (target: typeof target) => Promise<{ messages: typeof requests[number]['messages'] }> }) {
      assert.equal(request.allowFallback, false);
      assert.equal(request.localOnly, true);
      const conversation = await request.conversation(state.chosen);
      requests.push({ channel: 'role', selection: { ...state.chosen },
        messages: conversation.messages, signal: request.signal });
      const route = parseRoutingProvenance({ version: 1, source: 'role-policy',
        requestedRole: 'interactive', policyRevision: 1, effectiveHard: hard,
        preferredTarget: target, actualTarget: state.chosen,
        executionLabels: { connection: 'Local', provider: 'local', model: 'Q4' },
        attempts: [{ target: state.chosen, outcome: 'selected' }] });
      yield { type: 'complete' as const, text: natural, actualModelId: 'q4', finishReason: 'stop',
        usage: { tokenMeasurement: 'unavailable' as const },
        provenance: { connectionId: 'local', modelId: 'q4', providerId: 'local', modelLabel: 'Q4' },
        routingProvenance: route };
    } };
  const originalLock = repository.lockRoadmapPlan.bind(repository);
  repository.lockRoadmapPlan = (async (...args: Parameters<typeof originalLock>) => {
    const locked = await originalLock(...args);
    await state.afterLock?.();
    return locked;
  }) as typeof repository.lockRoadmapPlan;
  const originalMutate = repository.mutate.bind(repository);
  repository.mutate = (async (...args: Parameters<typeof originalMutate>) => {
    if ((state.failFinish || state.cancelAtFinish) && args[2]?.type === 'finish-assistant' &&
      args[2].outcome === 'complete') {
      state.stagedAtFinish = !!(backend as never as { nativeStages: { get(chatId: string): unknown } })
        .nativeStages.get(chatId);
      if (state.cancelAtFinish) await backend.cancelTurn(projectHandle, chatId, lease.token);
      throw new Error('injected final Chat failure');
    }
    return originalMutate(...args);
  }) as typeof repository.mutate;
  const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never,
    new ChatContextComposer({} as never, {} as never, index as never, repository, roadmapStore,
      undefined, greenfield), routing as never, undefined, undefined, greenfield,
    undefined, roadmapStore);
  const { projectHandle } = await backend.attach(pathToFileURL(root).href);
  const chatId = randomUUID();
  await backend.mutate({ projectHandle, expectedRevision: 0,
    operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Fixed title' } });
  const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
  if (!lease.acquired) throw new Error('Lease missing');
  const run = () => backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
    content: '/roadmap Create a complete Roadmap for a small puzzle app' });
  const saved = async () => (await new ChatRepository().read(root)).chats[0].messages;
  const close = async () => { backend.dispose(); await rm(root, { recursive: true, force: true }); };
  return { root, repository, roadmapStore, backend, projectHandle, chatId, lease, state, requests,
    run, saved, close };
}

test('Follow Interactive uses two requests in one Chat execution; ordinary Chat uses one', async () => {
  const f = await fixture();
  try {
    const result = await f.run();
    assert.ok(result.proposal);
    assert.deepEqual(f.requests.map(item => item.channel), ['role', 'model']);
    assert.deepEqual(f.requests.map(item => item.selection), [target, target]);
    assert.equal(f.requests[0].signal, f.requests[1].signal);
    assert.deepEqual(f.requests[1].messages.map(item => item.role), ['system', 'user']);
    assert.equal(f.requests[1].messages[1].content, natural);
    assert.equal(f.requests[1].messages[0].content, lockedRoadmapConversionInstruction);
    assert.doesNotMatch(JSON.stringify(f.requests[1].messages), /previous Chat|roadmap_stage|\/roadmap/);
    const messages = await f.saved();
    assert.deepEqual(messages.map(item => item.role), ['user', 'assistant']);
    assert.equal(messages[1].execution.status, 'complete');
    assert.equal(messages[1].planningActivity?.status, 'pending');
    assert.equal(messages[1].planningActivity?.proposalId, result.proposal.id);
    assert.equal(new Set(messages.filter(item => item.role === 'assistant').map(item => item.execution.id)).size, 1);
    assert.equal((await f.roadmapStore.read(f.root)).revision, 0);
    const secondChat = randomUUID();
    await f.backend.mutate({ projectHandle: f.projectHandle,
      expectedRevision: (await f.backend.read(f.projectHandle)).revision,
      operation: { type: 'create-chat', id: secondChat, folderPath: '', title: 'Ordinary' } });
    const secondLease = await f.backend.claim({ projectHandle: f.projectHandle, chatId: secondChat, ownerId: 'panel' });
    if (!secondLease.acquired) throw new Error('Second lease missing');
    await f.backend.runTurn({ projectHandle: f.projectHandle, chatId: secondChat,
      leaseToken: secondLease.token, content: 'What is 1+1?', selectedModel: target });
    assert.equal(f.requests.length, 3);
  } finally { await f.close(); }
});

test('cancellation after lock and during conversion leaves only inert history', async () => {
  for (const when of ['after-lock', 'conversion']) {
    const f = await fixture();
    try {
      if (when === 'after-lock') f.state.afterLock = () => f.backend.cancelTurn(f.projectHandle, f.chatId, f.lease.token);
      else f.state.onConversion = () => f.backend.cancelTurn(f.projectHandle, f.chatId, f.lease.token);
      await assert.rejects(f.run());
      const messages = await f.saved(), assistant = messages[1];
      assert.equal(assistant.role, 'assistant');
      if (assistant.role !== 'assistant') throw new Error('assistant missing');
      assert.equal(assistant.execution.status, 'cancelled');
      assert.equal(assistant.lockedRoadmapPlan?.text, natural);
      assert.notEqual(assistant.planningActivity?.status, 'pending');
      assert.equal((f.backend as never as { proposals: Map<string, unknown> }).proposals.size, 0);
      assert.equal((await f.roadmapStore.read(f.root)).revision, 0);
      assert.equal(f.requests.length, when === 'after-lock' ? 1 : 2);
    } finally { await f.close(); }
  }
});

test('owner revision or linked source drift after lock rejects stale conversion', async () => {
  for (const kind of ['revision', 'source']) {
    const f = await fixture();
    try {
      const original = f.roadmapStore.read.bind(f.roadmapStore);
      let drift = false;
      f.state.afterLock = async () => { drift = true; };
      f.roadmapStore.read = (async (...args: Parameters<typeof original>) => {
        const owner = await original(...args);
        return drift ? { ...owner, ...(kind === 'revision' ? { revision: owner.revision + 1 } :
          { linkedDocument: { path: 'ROADMAP.md', sourceHash: 'a'.repeat(64) } }) } : owner;
      }) as typeof f.roadmapStore.read;
      await assert.rejects(f.run(), /owner changed|source changed|Locked Roadmap/);
      assert.equal(f.requests.length, 1);
      const messages = await f.saved();
      assert.equal(messages[1].role, 'assistant');
      if (messages[1].role === 'assistant') {
        assert.equal(messages[1].execution.status, 'failed');
        assert.equal(messages[1].lockedRoadmapPlan?.text, natural);
        assert.notEqual(messages[1].planningActivity?.status, 'pending');
      }
    } finally { await f.close(); }
  }
});

test('Follow Interactive rejects model, connection, provider and capability drift without fallback', async () => {
  for (const kind of ['model', 'connection', 'provider', 'capability']) {
    const f = await fixture();
    try {
      f.state.afterLock = async () => {
        if (kind === 'model') f.state.chosen = { connectionId: 'local', modelId: 'other' };
        if (kind === 'connection') f.state.chosen = { connectionId: 'other', modelId: 'q4' };
        if (kind === 'provider') f.state.provider = 'hosted';
        if (kind === 'capability') f.state.contextWindowTokens = 16384;
      };
      await assert.rejects(f.run(), /target changed|model or loaded capability changed/);
      assert.equal(f.requests.length, 1);
      const messages = await f.saved();
      assert.equal(messages[1].role, 'assistant');
      if (messages[1].role === 'assistant') assert.equal(messages[1].execution.status, 'failed');
    } finally { await f.close(); }
  }
});

test('failure or cancellation after checked staging retires approval and preserves locked plan', async () => {
  for (const outcome of ['failed', 'cancelled']) {
    const f = await fixture();
    try {
      if (outcome === 'failed') f.state.failFinish = true;
      else f.state.cancelAtFinish = true;
      await assert.rejects(f.run(), /injected final Chat failure/);
      assert.equal(f.state.stagedAtFinish, true, 'checked stage existed before final Chat outcome');
      assert.equal(f.requests.length, 2);
      const messages = await f.saved(), assistant = messages[1];
      assert.equal(assistant.role, 'assistant');
      if (assistant.role !== 'assistant') throw new Error('assistant missing');
      assert.equal(assistant.execution.status, outcome);
      assert.equal(assistant.lockedRoadmapPlan?.text, natural);
      assert.notEqual(assistant.planningActivity?.status, 'pending');
      assert.equal((f.backend as never as { proposals: Map<string, unknown> }).proposals.size, 0);
      assert.equal((f.backend as never as { nativeStages: { get(chatId: string): unknown } }).nativeStages.get(f.chatId), undefined);
      assert.equal((await f.roadmapStore.read(f.root)).revision, 0);
    } finally { await f.close(); }
  }
});
