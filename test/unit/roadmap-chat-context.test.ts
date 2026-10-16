import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import type { RoadmapStore, RoadmapIndex } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import type { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import type { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import type { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';

test('saved Chat previews and sends bounded revisioned Roadmap evidence through one composer', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-chat-'));
  try {
    await mkdir(join(root, 'docs'));
    const markdown = '# Phase A\nEvidence from source\n';
    const sha256 = createHash('sha256').update(markdown).digest('hex');
    await writeFile(join(root, 'docs/phase.md'), markdown);
    const source = { path: 'docs/phase.md', sha256, line: 1, text: '# Phase A' };
    const basis = { architectureRevision: 1, architectureFingerprint: 'arch', physicalInputFingerprint: 'input', physicalGeneration: 1 };
    const roadmap: RoadmapIndex = { schemaVersion: 1, projectId: 'roadmap-project', projectRoot: root, revision: 3,
      checkpoints: [
        { id: 'phase-a', kind: 'phase', title: 'Phase A', objective: 'Plan the next step', order: 0,
          dependencies: [], status: 'active', readOnly: false, source, evidence: [source],
          links: [{ owner: 'planning-map', targetId: 'map-a', ownerProjectId: 'planning-project', ownerRevision: 2, basis }] },
        { id: 'phase-b', kind: 'phase', title: 'Phase B', objective: 'Follow A', order: 1,
          dependencies: ['phase-a'], status: 'unknown', readOnly: false, evidence: [], links: [] },
        ...Array.from({ length: 10 }, (_, i) => ({ id: `other-${i}`, kind: 'milestone' as const,
          title: `Other ${i}`, objective: 'Unrelated', order: i + 2, dependencies: [],
          status: 'unknown' as const, readOnly: false, evidence: [], links: [] })) ] };
    const roadmapStore = { read: async () => roadmap } as unknown as RoadmapStore;
    const planning = { read: async () => ({ projectId: 'planning-project', revision: 5,
      maps: [{ id: 'map-a', revision: 2, title: 'Target map', objective: 'Change architecture',
        status: 'draft', basis, transformations: [], workItems: [] }] }) } as unknown as PlanningStore;
    const repository = new ChatRepository();
    const composer = new ChatContextComposer({} as ProjectMindStore, planning, {} as SoftwareMapIndex,
      repository, roadmapStore);
    let providerCalls = 0;
    let revisionRetryCalls = 0;
    let revisionRetryMode = false;
    let retryInstruction = '';
    let sent = '';
    let sentSystem = '';
    let changeAfterComplete: number | undefined;
    const capabilities = { conversationalText: true, streaming: true, contextWindowTokens: 4096 };
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
      models: [{ id: 'short', label: 'Short', usable: true, capabilities }] }] }),
    async *generate(_selection: unknown, request: { messages: { role: string; content: string }[]; maxOutputTokens?: number }) {
      providerCalls++;
      sent = request.messages.at(-1)?.content ?? '';
      sentSystem = request.messages.find(message => message.role === 'system')?.content ?? '';
      assert.equal(request.maxOutputTokens, 1024);
      assert.ok(Buffer.byteLength(JSON.stringify(request.messages), 'utf8') +
        (request.maxOutputTokens ?? 0) + 512 + 256 <= capabilities.contextWindowTokens);
      if (changeAfterComplete) capabilities.contextWindowTokens = changeAfterComplete;
      const answer = revisionRetryMode ? ++revisionRetryCalls === 2 ?
        '{"type":"no-action","message":"Current Roadmap owner revision: 3. Phase A is active."}' :
        '{"type":"no-action","message":"Phase A is active."}' :
        '{"type":"no-action","message":"Done"}';
      if (revisionRetryCalls === 2) retryInstruction = request.messages[0]?.content ?? '';
      yield { type: 'complete' as const, text: answer, usage: { tokenMeasurement: 'estimated' as const } };
    } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer);
    const { projectHandle } = await backend.attach(new URL(`file://${root}`).href);
    const chatId = randomUUID();
    let state = await backend.mutate({ projectHandle, expectedRevision: 0,
      operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Roadmap review' } });
    assert.deepEqual(state.chats[0].settings.context.allowedSources, ['roadmap-checkpoint']);
    const settings = structuredClone(state.chats[0].settings);
    settings.context = { maxInputTokens: 4096, reservedOutputTokens: 1024, history: 'none',
      savedChatSearch: false, allowedSources: [] };
    state = await backend.mutate({ projectHandle, expectedRevision: state.revision,
      operation: { type: 'set-settings', chatId, settings } });
    const context = [{ kind: 'roadmap-checkpoint' as const, id: 'phase-a', projectId: 'roadmap-project',
      ownerRevision: 3, sourceHash: sha256 }];
    const selection = { connectionId: 'local', modelId: 'short' };
    await assert.rejects(backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'What next?', context }), /Context source disabled: roadmap-checkpoint/);
    const lease = await backend.claim({ projectHandle, chatId, ownerId: 'test' });
    assert.equal(lease.acquired, true);
    if (!lease.acquired) return;
    await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
      selectedModel: selection, content: 'What next?', context }), /Context source disabled: roadmap-checkpoint/);
    assert.equal(providerCalls, 0);
    settings.context.allowedSources = ['roadmap-checkpoint'];
    state = await backend.mutate({ projectHandle, expectedRevision: state.revision,
      operation: { type: 'set-settings', chatId, settings } });
    const preview = await backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'What next?', context });
    assert.equal(providerCalls, 0);
    assert.equal(preview.budgetTokens, 768);
    assert.ok(preview.usedTokens <= preview.budgetTokens);
    assert.equal(preview.refs[0].kind, 'roadmap-checkpoint');
    assert.equal(preview.refs[0].ownerRevision, 3);
    assert.equal(preview.refs[0].sourceHash, sha256);
    assert.ok(preview.diagnostics.some(item => item.kind === 'truncated'));
    const turn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
      selectedModel: selection, content: 'What next?', context });
    assert.deepEqual(turn.refs, preview.refs);
    const saved = (await repository.read(root)).chats[0].messages[0];
    assert.equal(saved.role, 'user');
    if (saved.role === 'user') assert.deepEqual(saved.contextRefs, preview.refs);
    assert.match(sent, /Phase A/);
    assert.match(sent, /Phase B/);
    assert.match(sent, /Target map/);
    assert.match(sent, /docs\/phase.md/);
    assert.doesNotMatch(sent, /Other 9/);
    assert.match(sentSystem, /a request to read does not make a linked checkpoint unlinked or read-only/);
    assert.match(sentSystem, /put the concrete answer in its message field/);
    assert.match(sentSystem, /distinguish those counters/);
    assert.equal(providerCalls, 1);
    capabilities.contextWindowTokens = 8192;
    revisionRetryMode = true;
    const revisionTurn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
      selectedModel: selection, content: 'Give the current Roadmap owner revision and status; no edit.', context });
    assert.equal(revisionTurn.refs[0].ownerRevision, 3);
    assert.equal(revisionRetryCalls, 2);
    assert.match(retryInstruction, /owner revision 3/);
    const revisionAnswer = (await repository.read(root)).chats[0].messages.at(-1);
    assert.equal(revisionAnswer?.role, 'assistant');
    if (revisionAnswer?.role === 'assistant') assert.match(revisionAnswer.content, /owner revision: 3/);
    revisionRetryMode = false;
    capabilities.contextWindowTokens = 4096;
    for (const measured of [16384, 32768, 65536]) {
      capabilities.contextWindowTokens = measured;
      const larger = await backend.previewContext({ projectHandle, chatId, selectedModel: selection,
        content: 'What next?', context });
      assert.ok(larger.budgetTokens >= preview.budgetTokens);
      assert.ok(larger.usedTokens < larger.budgetTokens); // Extra capacity does not pad an ordinary request.
      const result = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
        selectedModel: selection, content: 'What next?', context });
      assert.deepEqual(result.refs, larger.refs);
      assert.match(sent, /Phase A/);
      assert.doesNotMatch(sent, /Other 9/);
    }
    const broad = structuredClone(settings);
    broad.context.maxInputTokens = 25000;
    broad.context.history = 'recent';
    broad.context.allowedSources = ['roadmap-checkpoint', 'file'];
    await writeFile(join(root, 'docs/brief.md'), ('Review the phase boundary, dependencies, and tests. "Source backed."\n').repeat(800));
    let latestBroad = await repository.read(root);
    await backend.mutate({ projectHandle, expectedRevision: latestBroad.revision,
      operation: { type: 'set-settings', chatId, settings: broad } });
    for (const measured of [16384, 32768, 65536]) {
      capabilities.contextWindowTokens = measured;
      const packed = await backend.previewContext({ projectHandle, chatId, selectedModel: selection,
        content: 'Review the selected phase and attached brief.',
        context: [...context, { kind: 'file', id: 'docs/brief.md' }] });
      assert.deepEqual(packed.refs.slice(0, 2).map(item => item.kind), ['roadmap-checkpoint', 'file']);
    }
    capabilities.contextWindowTokens = 32768;
    changeAfterComplete = 16384;
    await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
      selectedModel: selection, content: 'What next?', context }), /Loaded local context changed/);
    changeAfterComplete = undefined;
    const failed = (await repository.read(root)).chats[0].messages.at(-1);
    assert.equal(failed?.role, 'assistant');
    if (failed?.role === 'assistant') {
      const retry = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
        selectedModel: selection, retryMessageId: failed.id, context });
      assert.deepEqual(retry.refs, preview.refs);
    }
    const constrained = structuredClone(settings);
    constrained.context.maxInputTokens = 550;
    roadmap.checkpoints[0].title = 'Phase A '.repeat(100);
    let latest = await repository.read(root);
    await backend.mutate({ projectHandle, expectedRevision: latest.revision,
      operation: { type: 'set-settings', chatId, settings: constrained } });
    await assert.rejects(backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'What next?', context }), /do not fit|does not fit|budget/);
    await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
      selectedModel: selection, content: 'What next?', context }), /do not fit|does not fit|budget/);
    latest = await repository.read(root);
    await backend.mutate({ projectHandle, expectedRevision: latest.revision,
      operation: { type: 'set-settings', chatId, settings } });
    roadmap.checkpoints[0].title = 'Phase A';
    roadmap.projectRoot = join(root, 'other');
    await assert.rejects(backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'Next', context }), /foreign Roadmap/);
    await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
      selectedModel: selection, content: 'Next', context }), /foreign Roadmap/);
    roadmap.projectRoot = root;
    await assert.rejects(backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'Next', context: [{ ...context[0], projectId: 'foreign' }] }), /foreign Roadmap/);
    await assert.rejects(backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'Next', context: [{ ...context[0], ownerRevision: 2 }] }), /Stale/);
    roadmap.revision = 4;
    await assert.rejects(backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'Next', context }), /Stale/);
    await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
      selectedModel: selection, content: 'Next', context }), /Stale/);
    roadmap.revision = 3;
    await writeFile(join(root, 'docs/phase.md'), '# Changed\n');
    await assert.rejects(backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'Next', context }), /Stale Roadmap source/);
    await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
      selectedModel: selection, content: 'Next', context }), /Stale Roadmap source/);
    assert.equal(providerCalls, 8);
    backend.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});
