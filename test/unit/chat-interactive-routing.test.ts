import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { parseRoutingProvenance } from '../../packages/ai/lib/index.js';

const hard = { requiredCapabilities: ['conversationalText', 'streaming'], locality: 'any', enabledOnly: true,
  usableOnly: true, hostedProjectData: 'requires-feature-authorization' } as const;
const targets = [{ connectionId: 'local', modelId: 'small' }, { connectionId: 'hosted', modelId: 'large' }] as const;
const runtime = { connections: [
  { id: 'local', label: 'Local', providerId: 'local-provider', ready: true,
    models: [{ id: 'small', label: 'Small', usable: true, capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 2048 } }] },
  { id: 'hosted', label: 'Hosted', providerId: 'hosted-provider', ready: true,
    models: [{ id: 'large', label: 'Large', usable: true, capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 8192 } }] },
] };

test('new Chats follow Interactive, require Chat hosted consent, record fallback and keep exact override authority', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-chat-interactive-'));
  const repository = new ChatRepository();
  let preferred = 0, fallback = false, broken = false, runtimeCalls: string[] = [], budgets: number[] = [];
  const models = { list: async () => runtime,
    async *generate(target: { connectionId: string }) {
      runtimeCalls.push(target.connectionId);
      yield { type: 'complete' as const, text: 'Exact answer' };
    } };
  const composer = { async compose(_root: string, _chat: unknown, content: string, _context: unknown,
    capabilities: { contextWindowTokens: number }) {
    budgets.push(capabilities.contextWindowTokens);
    return { messages: [{ role: 'user' as const, content }], refs: [], diagnostics: [], usedTokens: 5,
      budgetTokens: capabilities.contextWindowTokens };
  } };
  const routing = { async resolve(_role: string, _hard: unknown, authorized: boolean) {
    const first = targets[preferred];
    return { inventory: { models: targets.map((target, index) => ({ ...target,
      providerModelKey: target.modelId, locality: index ? 'hosted' : 'local' })) },
      resolution: { selectedTarget: broken || first.connectionId === 'hosted' && !authorized ? undefined : first } };
  }, async *generate(request: { hostedProjectDataAuthorized: boolean;
    conversation: (target: typeof targets[number]) => Promise<unknown> }) {
    const chosen = targets[fallback ? 1 : preferred];
    assert.ok(chosen.connectionId !== 'hosted' || request.hostedProjectDataAuthorized);
    await request.conversation(chosen);
    runtimeCalls.push(chosen.connectionId);
    const route = parseRoutingProvenance({ version: 1, source: 'role-policy', requestedRole: 'interactive',
      policyRevision: preferred + 1, effectiveHard: hard, preferredTarget: targets[preferred], actualTarget: chosen,
      executionLabels: { connection: chosen.connectionId, provider: `${chosen.connectionId}-provider`,
        model: chosen.modelId }, attempts: fallback ? [
          { target: targets[0], outcome: 'transient-transport' }, { target: chosen, outcome: 'selected' } ] :
          [{ target: chosen, outcome: 'selected' }] });
    yield { type: 'complete' as const, text: 'Role answer', routingProvenance: route };
  } };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer as never, routing as never);
  try {
    const { projectHandle } = await service.attach(pathToFileURL(root).href);
    const chatId = randomUUID();
    let state = await service.mutate({ projectHandle, expectedRevision: 0,
      operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Pinned title' } });
    assert.deepEqual(state.chats[0].settings.modelPolicy, { type: 'follow-interactive' });
    const claim = await service.claim({ projectHandle, chatId, ownerId: 'panel' });
    if (!claim.acquired) assert.fail();
    const send = (content: string, extra = {}) => service.runTurn({ projectHandle, chatId, leaseToken: claim.token, content, ...extra });
    await send('First');
    assert.deepEqual(budgets, [2048, 2048]);
    preferred = 1;
    await assert.rejects(send('Hosted denied'), /hosted egress confirmation required/);
    assert.equal((await service.read(projectHandle)).chats[0].messages.length, 2);
    assert.deepEqual(runtimeCalls, ['local']);
    await send('Hosted confirmed', { hostedProjectDataAuthorized: true });
    assert.equal(budgets.at(-1), 8192);
    state = await service.read(projectHandle);
    assert.equal(state.chats[0].messages[3].role, 'assistant');
    if (state.chats[0].messages[3].role === 'assistant') {
      assert.equal(state.chats[0].messages[3].execution.routingProvenance?.requestedRole, 'interactive');
      assert.equal(state.chats[0].messages[3].execution.routingProvenance?.actualTarget.connectionId, 'hosted');
    }
    await send('Exact override', { selectedModel: targets[0] });
    assert.equal(runtimeCalls.at(-1), 'local');
    assert.deepEqual((await service.read(projectHandle)).chats[0].settings.modelPolicy,
      { type: 'follow-interactive' });
    state = await service.read(projectHandle);
    if (state.chats[0].messages.at(-1)?.role === 'assistant')
      assert.equal(state.chats[0].messages.at(-1)!.execution.routingProvenance?.source, 'explicit-turn');
    preferred = 0; fallback = true;
    await send('Fallback', { hostedProjectDataAuthorized: true });
    state = await service.read(projectHandle);
    const last = state.chats[0].messages.at(-1);
    assert.equal(last?.role, 'assistant');
    if (last?.role === 'assistant') {
      assert.equal(last.execution.selectedModel.connectionId, 'local');
      assert.equal(last.execution.actualModel?.connectionId, 'hosted');
      assert.deepEqual(last.execution.routingProvenance?.attempts.map(item => item.outcome),
        ['transient-transport', 'selected']);
    }
    broken = true; fallback = false;
    const before = state.chats[0].messages.length;
    await assert.rejects(send('Broken role'), /Interactive role has no eligible model/);
    assert.equal((await service.read(projectHandle)).chats[0].messages.length, before);
    await send('Exact repair escape', { selectedModel: targets[0] });
    state = await service.read(projectHandle);
    state = await service.mutate({ projectHandle, expectedRevision: state.revision,
      operation: { type: 'set-settings', chatId, settings: { ...state.chats[0].settings,
        modelPolicy: { type: 'exact', model: targets[0] } } } });
    preferred = 1;
    await send('Pinned stays local');
    assert.equal(runtimeCalls.at(-1), 'local');
    assert.equal((await service.read(projectHandle)).chats[0].settings.modelPolicy.type, 'exact');
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('automatic title reuses the routed actual exact target', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-chat-role-title-'));
  const repository = new ChatRepository();
  const titleTargets: string[] = [];
  let roleCalls = 0;
  const models = { list: async () => runtime,
    async *generate(target: { connectionId: string }) {
      titleTargets.push(target.connectionId);
      yield { type: 'complete' as const, text: 'Routed title' };
    } };
  const composer = { async compose(_root: string, _chat: unknown, content: string) {
    return { messages: [{ role: 'user' as const, content }], refs: [], diagnostics: [], usedTokens: 4, budgetTokens: 1024 };
  } };
  const routing = { async resolve() {
    return { inventory: { models: [{ ...targets[0], providerModelKey: 'small', locality: 'local' }] },
      resolution: { selectedTarget: targets[0] } };
  }, async *generate(request: { conversation: (target: typeof targets[0]) => Promise<unknown> }) {
    roleCalls++;
    await request.conversation(targets[0]);
    yield { type: 'complete' as const, text: 'Answer', routingProvenance: parseRoutingProvenance({
      version: 1, source: 'role-policy', requestedRole: 'interactive', policyRevision: 1,
      effectiveHard: hard, preferredTarget: targets[0], actualTarget: targets[0],
      executionLabels: { connection: 'Local', provider: 'local-provider', model: 'Small' },
      attempts: [{ target: targets[0], outcome: 'selected' }],
    }) };
  } };
  const service = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer as never, routing as never);
  try {
    const { projectHandle } = await service.attach(pathToFileURL(root).href);
    const chatId = randomUUID();
    await service.mutate({ projectHandle, expectedRevision: 0,
      operation: { type: 'create-chat', id: chatId, folderPath: '' } });
    const claim = await service.claim({ projectHandle, chatId, ownerId: 'panel' });
    if (!claim.acquired) assert.fail();
    await service.runTurn({ projectHandle, chatId, leaseToken: claim.token, content: 'Explain this' });
    for (let i = 0; i < 50 && !(await service.read(projectHandle)).chats[0].titleSource.includes('automatic'); i++)
      await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal((await service.read(projectHandle)).chats[0].title, 'Routed title');
    assert.deepEqual(titleTargets, ['local']);
    assert.equal(roleCalls, 1);
  } finally { service.dispose(); await rm(root, { recursive: true, force: true }); }
});
