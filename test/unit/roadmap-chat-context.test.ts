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

test('Pi Chat binds selected Roadmap identity without automatic source bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-chat-'));
  try {
    await mkdir(join(root, 'docs'));
    const markdown = '# Phase A\nEvidence from source\n';
    const sha256 = createHash('sha256').update(markdown).digest('hex');
    await writeFile(join(root, 'docs/phase.md'), markdown);
    const source = { path: 'docs/phase.md', sha256, line: 1, text: '# Phase A' };
    const roadmap: RoadmapIndex = { schemaVersion: 1, projectId: 'roadmap-project', projectRoot: root, revision: 3,
      checkpoints: [{ id: 'phase-a', kind: 'phase', title: 'Phase A', objective: 'Plan the next step', order: 0,
        dependencies: [], status: 'active', readOnly: false, source, evidence: [source], links: [] }] };
    const repository = new ChatRepository();
    const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore,
      {} as SoftwareMapIndex, repository, { read: async () => roadmap } as unknown as RoadmapStore);
    const chat = (await repository.mutate(root, 0, { type: 'create-chat', id: randomUUID(),
      folderPath: '', title: 'Roadmap review' })).chats[0];
    const capabilities = { conversationalText: true, streaming: true, contextWindowTokens: 16384 };
    const context = [{ kind: 'roadmap-checkpoint' as const, id: 'phase-a', projectId: 'roadmap-project',
      ownerRevision: 3, sourceHash: sha256 }];
    const plain = await composer.compose(root, chat, 'What is in docs/phase.md?', [], capabilities,
      undefined, false, false, undefined, true);
    assert.deepEqual(plain.refs, []);
    assert.match(plain.messages[0].content, /Pi read_file, list_files or search tools/);
    assert.doesNotMatch(plain.messages.at(-1)!.content, /Evidence from source/);
    const selected = await composer.compose(root, chat, 'What is the selected Phase?', context,
      capabilities, undefined, false, false, undefined, true);
    assert.deepEqual(selected.refs.map(ref => [ref.kind, ref.projectId, ref.ownerRevision, ref.sourceHash]),
      [['roadmap-checkpoint', 'roadmap-project', 3, sha256]]);
    assert.match(selected.messages.at(-1)!.content, /"projectId":"roadmap-project","ownerRevision":3/);
    assert.match(selected.messages.at(-1)!.content, /"id":"phase-a"/);
    assert.doesNotMatch(selected.messages.at(-1)!.content, /Evidence from source/);
    const attached = await composer.compose(root, chat, 'Read the attached file',
      [{ kind: 'file', id: 'docs/phase.md' }], capabilities, undefined, false, false, undefined, true);
    assert.match(attached.messages.at(-1)!.content, /Evidence from source/);
    await assert.rejects(composer.compose(root, chat, 'Next', [{ ...context[0], projectId: 'foreign' }],
      capabilities, undefined, false, false, undefined, true), /Stale or foreign Roadmap/);
    await assert.rejects(composer.compose(root, chat, 'Next', [{ ...context[0], ownerRevision: 2 }],
      capabilities, undefined, false, false, undefined, true), /Stale or foreign Roadmap/);
    roadmap.revision = 4;
    await assert.rejects(composer.compose(root, chat, 'Next', context, capabilities,
      undefined, false, false, undefined, true), /Stale or foreign Roadmap/);
    roadmap.revision = 3;
    await writeFile(join(root, 'docs/phase.md'), '# Changed\n');
    await assert.rejects(composer.compose(root, chat, 'Next', context, capabilities,
      undefined, false, false, undefined, true), /Stale Roadmap source/);
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
      /Pi read_file, list_files or search tools/);
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
    const restoredSystem = sent.at(-1)!.filter(item => item.role === 'system').map(item => item.content).join('\n');
    assert.match(restoredSystem, /no linked Roadmap Markdown/);
    assert.doesNotMatch(restoredSystem, /Available manual path:.*Change linked file/);
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
