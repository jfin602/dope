import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { planningOutcome } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
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
    await writeFile(join(root, 'ROADMAP.md'), markdown);
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

test('source-change help has one grounded no-action route in preview and saved Chat turns', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-help-chat-'));
  try {
    await mkdir(join(root, 'docs'));
    const markdown = '# Current phase\n';
    const sha256 = createHash('sha256').update(markdown).digest('hex');
    await writeFile(join(root, 'docs/phase.md'), markdown);
    await writeFile(join(root, 'ROADMAP.md'), markdown);
    const source = { path: 'docs/phase.md', sha256, line: 1, text: '# Current phase' };
    const roadmap: RoadmapIndex = { schemaVersion: 1, projectId: 'project', projectRoot: root, revision: 2,
      checkpoints: [{ id: 'phase', kind: 'phase', title: 'Current phase', objective: 'Keep planning', order: 0,
        dependencies: [], status: 'active', readOnly: false, source, evidence: [], links: [] }],
      linkedDocument: { projectRoot: root, projectId: 'project', path: 'ROADMAP.md', sourceHash: sha256,
        sections: [], lastSynced: { sourceHash: sha256, roadmapRevision: 2 }, syncState: 'synced' } };
    const store = { read: async () => roadmap } as unknown as RoadmapStore;
    const repository = new ChatRepository();
    const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore,
      {} as SoftwareMapIndex, repository, store);
    const sent: { role: string; content: string }[][] = [];
    let answer = '{"type":"no-action","message":"Use Roadmap > Roadmap Markdown and setup > Change linked file. Chat cannot directly relink; nothing changed."}';
    const capabilities = { conversationalText: true, streaming: true, contextWindowTokens: 32768 };
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
      models: [{ id: 'q4', label: 'Q4', usable: true, capabilities }] }] }),
      async *generate(selection: { connectionId: string; modelId: string }, request: { messages: { role: string; content: string }[] }) {
        assert.deepEqual(selection, { connectionId: 'local', modelId: 'q4' });
        sent.push(request.messages);
        yield { type: 'complete' as const, text: answer };
      } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer);
    const { projectHandle } = await backend.attach(new URL(`file://${root}`).href);
    const chatId = randomUUID();
    let state = await backend.mutate({ projectHandle, expectedRevision: 0,
      operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Saved help' } });
    const settings = structuredClone(state.chats[0].settings);
    settings.context = { maxInputTokens: 12000, reservedOutputTokens: 1024, history: 'recent',
      savedChatSearch: false, allowedSources: ['roadmap-checkpoint'] };
    state = await backend.mutate({ projectHandle, expectedRevision: state.revision,
      operation: { type: 'set-settings', chatId, settings } });
    const lease = await backend.claim({ projectHandle, chatId, ownerId: 'test' });
    assert.equal(lease.acquired, true);
    if (!lease.acquired) return;
    const selection = { connectionId: 'local', modelId: 'q4' };
    const context = [{ kind: 'roadmap-checkpoint' as const, id: 'phase', projectId: 'project',
      ownerRevision: 2, sourceHash: sha256 }];
    const phrase = 'I linked the wrong Roadmap, how do I change it?';
    for (const attached of [[], context]) {
      const preview = await backend.previewContext({ projectHandle, chatId, selectedModel: selection,
        content: phrase, context: attached });
      assert.ok(preview.usedTokens <= preview.budgetTokens);
      assert.deepEqual(preview.refs.map(ref => ref.kind), attached.map(ref => ref.kind));
      const turn = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
        selectedModel: selection, content: phrase, context: attached });
      assert.deepEqual(turn.refs, preview.refs);
      assert.equal(turn.proposal, undefined);
      const system = sent.at(-1)!.filter(item => item.role === 'system').map(item => item.content).join('\n');
      assert.match(system, /Dope UI help \(roadmap-change-file\)/);
      assert.match(system, /Roadmap > Roadmap Markdown and setup > Change linked file/);
      assert.match(system, /Chat cannot change the link/);
      assert.doesNotMatch(system, /Use the supplied checkpoint capabilities|noncanonical Roadmap draft/);
      const saved = (await repository.read(root)).chats[0].messages.at(-1);
      assert.equal(saved?.role, 'assistant');
      if (saved?.role === 'assistant') {
        assert.equal(saved.content, answer);
        assert.equal(saved.planningActivity?.verifiedGuidance?.capabilityId, 'roadmap-change-file');
        const visible = planningOutcome(saved)?.summary ?? '';
        for (const required of ['Open Roadmap', 'Roadmap Markdown and setup', 'Change linked file',
          'Select the intended project Markdown file', 'Review the replacement preview',
          'affected Roadmap content', 'explicitly confirm', 'remains on disk', 'Chat cannot directly change'])
          assert.match(visible, new RegExp(required), required);
      }
    }
    answer = '{"type":"no-action","message":"The synced Roadmap is conflicted; replace its file."}';
    await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token, selectedModel: selection,
      content: 'What is the current Roadmap status?', context: [] });
    let verified = (await repository.read(root)).chats[0].messages.at(-1);
    if (verified?.role === 'assistant') {
      assert.match(planningOutcome(verified)?.summary ?? '', /linked Markdown source state is synced/);
      assert.match(planningOutcome(verified)?.summary ?? '', /1 active \(Current phase\)/);
      assert.doesNotMatch(planningOutcome(verified)?.summary ?? '', /conflicted|Change linked file/);
      assert.match(verified.content, /conflicted/);
    }
    answer = '{"type":"no-action","message":"First edit the checkpoint Objective, then use Roadmap Change linked file."}';
    await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token, selectedModel: selection,
      content: 'How do I change a Planning Map link?', context: [] });
    verified = (await repository.read(root)).chats[0].messages.at(-1);
    if (verified?.role === 'assistant') {
      assert.equal(verified.planningActivity?.verifiedGuidance?.capabilityId, 'planning-map-link');
      assert.match(planningOutcome(verified)?.summary ?? '', /no verified direct procedure/);
      assert.match(planningOutcome(verified)?.summary ?? '', /not a prerequisite/);
      assert.match(verified.content, /First edit/);
    }
    await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token, selectedModel: selection,
      content: 'How do I edit this checkpoint Objective?', context });
    verified = (await repository.read(root)).chats[0].messages.at(-1);
    if (verified?.role === 'assistant') {
      assert.equal(verified.planningActivity?.verifiedGuidance?.capabilityId, 'roadmap-objective');
      assert.match(planningOutcome(verified)?.summary ?? '', /Preview and save/);
      assert.doesNotMatch(planningOutcome(verified)?.summary ?? '', /Change linked file/);
    }
    answer = '{"type":"no-action","message":"Done"}';
    for (const syncState of ['pending-sync', 'conflict', 'missing', 'source-changed'] as const) {
      roadmap.linkedDocument!.syncState = syncState;
      const active = (await repository.read(root)).chats[0];
      const composed = await composer.compose(root, active, phrase, [], capabilities, undefined, true);
      const guidance = composed.messages.find(item => item.role === 'system')?.content ?? '';
      assert.match(guidance, new RegExp(syncState));
      assert.doesNotMatch(guidance, /Available manual path:.*Change linked file/);
    }
    roadmap.linkedDocument!.syncState = 'synced';
    await writeFile(join(root, 'ROADMAP.md'), '# Externally changed\n');
    let live = await composer.compose(root, (await repository.read(root)).chats[0], phrase, [],
      capabilities, undefined, true);
    assert.match(live.verifiedGuidance?.text ?? '', /blocked in the recorded source-changed state/);
    await rm(join(root, 'ROADMAP.md'));
    live = await composer.compose(root, (await repository.read(root)).chats[0], phrase, [],
      capabilities, undefined, true);
    assert.match(live.verifiedGuidance?.text ?? '', /blocked in the recorded unavailable state/);
    assert.match(live.verifiedGuidance?.text ?? '', /Relink Markdown/);
    await writeFile(join(root, 'ROADMAP.md'), markdown);
    const active = (await repository.read(root)).chats[0];
    const editing = await composer.compose(root, active, 'Change the checkpoint Objective to Prepare release',
      context, capabilities, undefined, true);
    assert.match(editing.messages.find(item => item.role === 'system')?.content ?? '',
      /Use the supplied checkpoint capabilities/);
    assert.doesNotMatch(editing.messages.find(item => item.role === 'system')?.content ?? '', /Dope UI help/);
    await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token, selectedModel: selection,
      content: 'Change the checkpoint Objective to Prepare release', context });
    assert.match(sent.at(-1)!.find(item => item.role === 'system')?.content ?? '',
      /Use the supplied checkpoint capabilities/);
    assert.doesNotMatch(sent.at(-1)!.find(item => item.role === 'system')?.content ?? '', /Dope UI help/);
    // A restored backend reads the same saved Chat without changing its model or authority.
    await backend.release(projectHandle, chatId, lease.token);
    backend.dispose();
    const restored = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer);
    const attached = await restored.attach(new URL(`file://${root}`).href);
    assert.equal(attached.snapshot.chats[0].id, chatId);
    assert.equal(attached.snapshot.chats[0].messages.length, 12);
    const restoredLease = await restored.claim({ projectHandle: attached.projectHandle, chatId, ownerId: 'restored' });
    assert.equal(restoredLease.acquired, true);
    if (!restoredLease.acquired) return;
    roadmap.linkedDocument = undefined;
    const absent = await restored.previewContext({ projectHandle: attached.projectHandle, chatId,
      selectedModel: selection, content: phrase, context: [] });
    assert.ok(absent.usedTokens <= absent.budgetTokens);
    await restored.runTurn({ projectHandle: attached.projectHandle, chatId, leaseToken: restoredLease.token,
      selectedModel: selection, content: phrase, context: [] });
    assert.match(sent.at(-1)!.find(item => item.role === 'system')!.content, /no linked Roadmap Markdown/);
    assert.doesNotMatch(sent.at(-1)!.find(item => item.role === 'system')!.content, /Available manual path:.*Change linked file/);
    roadmap.projectRoot = join(root, 'foreign');
    const before = sent.length;
    await assert.rejects(restored.previewContext({ projectHandle: attached.projectHandle, chatId,
      selectedModel: selection, content: phrase, context: [] }), /Stale or foreign Roadmap help context/);
    await assert.rejects(restored.runTurn({ projectHandle: attached.projectHandle, chatId,
      leaseToken: restoredLease.token, selectedModel: selection, content: phrase, context: [] }), /Stale or foreign Roadmap help context/);
    assert.equal(sent.length, before);
    roadmap.projectRoot = root;
    answer = 'You should edit the checkpoint Objective in ROADMAP.md.';
    await assert.rejects(restored.runTurn({ projectHandle: attached.projectHandle, chatId,
      leaseToken: restoredLease.token, selectedModel: selection, content: phrase, context: [] }), /strict JSON after two attempts/);
    assert.equal(sent.length, before + 2);
    const failed = (await repository.read(root)).chats[0].messages.at(-1);
    assert.equal(failed?.role, 'assistant');
    if (failed?.role === 'assistant') assert.equal(failed.execution.status, 'failed');
    restored.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});
