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
    let sent = '';
    const capabilities = { conversationalText: true, streaming: true, contextWindowTokens: 4096 };
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
      models: [{ id: 'short', label: 'Short', usable: true, capabilities }] }] }),
    async *generate(_selection: unknown, request: { messages: { content: string }[] }) {
      providerCalls++;
      sent = request.messages.at(-1)?.content ?? '';
      yield { type: 'complete' as const, text: '{"type":"no-action","message":"Done"}', usage: { tokenMeasurement: 'estimated' as const } };
    } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer);
    const { projectHandle } = await backend.attach(new URL(`file://${root}`).href);
    const chatId = randomUUID();
    let state = await backend.mutate({ projectHandle, expectedRevision: 0,
      operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Roadmap review' } });
    const settings = structuredClone(state.chats[0].settings);
    settings.context = { maxInputTokens: 4096, reservedOutputTokens: 1024, history: 'none',
      savedChatSearch: false, allowedSources: ['roadmap-checkpoint'] };
    state = await backend.mutate({ projectHandle, expectedRevision: state.revision,
      operation: { type: 'set-settings', chatId, settings } });
    const context = [{ kind: 'roadmap-checkpoint' as const, id: 'phase-a', projectId: 'roadmap-project',
      ownerRevision: 3, sourceHash: sha256 }];
    const selection = { connectionId: 'local', modelId: 'short' };
    const preview = await backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'What next?', context });
    assert.equal(providerCalls, 0);
    assert.equal(preview.budgetTokens, 938);
    assert.equal(preview.refs[0].kind, 'roadmap-checkpoint');
    assert.equal(preview.refs[0].ownerRevision, 3);
    assert.equal(preview.refs[0].sourceHash, sha256);
    assert.ok(preview.diagnostics.some(item => item.kind === 'truncated'));
    const lease = await backend.claim({ projectHandle, chatId, ownerId: 'test' });
    assert.equal(lease.acquired, true);
    if (!lease.acquired) return;
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
    assert.equal(providerCalls, 1);
    await assert.rejects(backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'Next', context: [{ ...context[0], projectId: 'foreign' }] }), /foreign Roadmap/);
    await assert.rejects(backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'Next', context: [{ ...context[0], ownerRevision: 2 }] }), /Stale/);
    roadmap.revision = 4;
    await assert.rejects(backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'Next', context }), /Stale/);
    roadmap.revision = 3;
    await writeFile(join(root, 'docs/phase.md'), '# Changed\n');
    await assert.rejects(backend.previewContext({ projectHandle, chatId, selectedModel: selection,
      content: 'Next', context }), /Stale Roadmap source/);
    await assert.rejects(backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
      selectedModel: selection, content: 'Next', context }), /Stale Roadmap source/);
    assert.equal(providerCalls, 1);
    backend.dispose();
  } finally { await rm(root, { recursive: true, force: true }); }
});
