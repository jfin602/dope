import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { selectDopeCapabilityHelp } from '../../packages/theia-extension/lib/node/dope-capability-help.js';
import { planningOutcome } from '../../packages/theia-extension/lib/browser/chat-panel-presentation.js';
import { RoadmapStore, type RoadmapIndex } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import type { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import type { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import type { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';

test('file replacement help does not capture a normal Objective edit', () => {
    assert.equal(selectDopeCapabilityHelp('Unlink this wrong roadmap file'), 'roadmap-change-file');
    assert.equal(selectDopeCapabilityHelp('Change the linked file'), 'roadmap-change-file');
    assert.equal(selectDopeCapabilityHelp('Change the Objective in this Roadmap file'), undefined);
});

test('one saved local Chat gives current linked-file help before and after a confirmed relink', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-chat-help-replacement-'));
    const original = '# Roadmap\n## Phase 1 [id: phase-one]: Wrong\nObjective: Old\n';
    const store = new RoadmapStore();
    let backend: ChatBackend | undefined;
    try {
        await writeFile(join(root, 'wrong.md'), original);
        const first = await store.acceptGateImport(root, 0, 'project', await previewRoadmapImport(root, 'wrong.md'));
        const repository = new ChatRepository();
        const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore,
            {} as SoftwareMapIndex, repository, store);
        const observed: string[] = [];
        const selected = { connectionId: 'local', modelId: 'selected' };
        const models = { list: async () => ({ connections: [{ id: 'local', providerId: 'local', ready: true,
            models: [{ id: 'selected', label: 'Selected local', usable: true,
                capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 4096 } }] }] }),
        async *generate(selection: typeof selected, request: { messages: { content: string }[] }) {
            assert.deepEqual(selection, selected);
            const help = request.messages.find(message => message.content.includes('Dope UI help'))?.content ?? '';
            observed.push(help);
            assert.match(help, /Chat cannot change the link/);
            assert.match(help, /Change linked file/);
            yield { type: 'complete' as const, text: JSON.stringify({ type: 'no-action',
                message: 'Nothing changed. Roadmap > Roadmap Markdown and setup > Change linked file lets you review and confirm a replacement.' }) };
        } };
        backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer);
        const { projectHandle } = await backend.attach(new URL(`file://${root}`).href);
        const chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Help' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) return;
        const request = { projectHandle, chatId, leaseToken: lease.token, selectedModel: selected,
            content: 'How do I change the wrong linked Roadmap file?', context: [] };
        assert.equal((await backend.runTurn(request)).proposal, undefined);
        await rename(join(root, 'wrong.md'), join(root, 'intended.md'));
        const preview = await store.previewGateRelink(root, 'intended.md');
        assert.equal(preview.state, 'ready');
        const next = await store.applyGateRelink(root, preview, true);
        assert.deepEqual(next.phases.map(item => item.id), ['phase-one']);
        assert.equal(next.linkedDocument?.path, 'intended.md');
        assert.deepEqual(await readFile(join(root, 'intended.md'), 'utf8'), original);
        assert.equal((await backend.runTurn(request)).proposal, undefined);
        assert.match(observed[0], /wrong\.md \(synced\)/);
        assert.match(observed[1], /intended\.md \(synced\)/);
        const saved = (await new ChatRepository().read(root)).chats;
        assert.equal(saved.length, 1);
        assert.equal(saved[0].id, chatId);
        assert.equal(saved[0].messages.length, 4);
        for (const answer of saved[0].messages.filter(message => message.role === 'assistant')) {
            assert.equal(answer.planningActivity?.status, 'no-action');
            assert.match(planningOutcome(answer)?.summary ?? '', /Change linked file/);
            assert.doesNotMatch(planningOutcome(answer)?.summary ?? '', /applied|saved/i);
        }
        assert.equal((await store.read(root)).revision, first.revision + 1);
    } finally { backend?.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('linked and unlinked Roadmap help stays no-action, project-scoped, local and within measured context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-chat-help-'));
    try {
        const roadmap: RoadmapIndex = { schemaVersion: 1, projectId: 'project', projectRoot: root, revision: 3,
            checkpoints: [], linkedDocument: { projectRoot: root, projectId: 'project', path: 'docs/wrong.md',
                sourceHash: 'hash', sections: [], lastSynced: { sourceHash: 'hash', roadmapRevision: 3 }, syncState: 'synced' } };
        const store = { read: async () => roadmap } as RoadmapStore;
        const repository = new ChatRepository();
        const composer = new ChatContextComposer({} as ProjectMindStore, {} as PlanningStore,
            {} as SoftwareMapIndex, repository, store);
        const selected = { connectionId: 'local', modelId: 'q4-short' };
        const capabilities = { conversationalText: true, streaming: true, contextWindowTokens: 4096 };
        let calls = 0;
        const models = { list: async () => ({ connections: [{ id: 'local', providerId: 'local', ready: true,
            models: [{ id: 'q4-short', label: 'Q4 short', usable: true, capabilities }] }] }),
        async *generate(selection: typeof selected, request: { messages: { content: string }[]; maxOutputTokens?: number }) {
            calls++;
            assert.deepEqual(selection, selected);
            assert.ok(Buffer.byteLength(JSON.stringify(request.messages), 'utf8') +
                (request.maxOutputTokens ?? 0) + 512 + 256 <= capabilities.contextWindowTokens);
            const instructions = request.messages.filter(message => message.content.includes('Dope UI help'));
            assert.equal(instructions.length, 1);
            assert.match(instructions[0].content, /Chat cannot change the link/);
            assert.doesNotMatch(instructions[0].content, /propose \{"type":"roadmap-intent"/);
            if (roadmap.linkedDocument) {
                assert.match(instructions[0].content, /Relink Markdown/);
                assert.match(instructions[0].content, /docs\/wrong\.md \(unavailable\)/);
            }
            else if (roadmap.revision === 0) assert.match(instructions[0].content, /Import Roadmap/);
            else assert.match(instructions[0].content, /No linked file can be changed from this existing unlinked Roadmap/);
            yield { type: 'complete' as const, text: JSON.stringify({ type: 'no-action',
                message: roadmap.linkedDocument ? 'Nothing changed. In Roadmap, open Roadmap Markdown and setup, then Relink Markdown.' :
                    roadmap.revision === 0 ? 'Nothing changed. Open Roadmap Markdown and setup, then Import Roadmap.' :
                    'Nothing changed. This existing unlinked Roadmap has no supported replacement action.' }),
                usage: { tokenMeasurement: 'estimated' as const } };
        } };
        const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer);
        const { projectHandle } = await backend.attach(new URL(`file://${root}`).href);
        const chatId = randomUUID();
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Help' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'test' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) return;
        const request = { projectHandle, chatId, leaseToken: lease.token, selectedModel: selected,
            content: 'Unlink this wrong roadmap file', context: [] };
        const preview = await backend.previewContext(request);
        assert.ok(preview.usedTokens <= preview.budgetTokens);
        const result = await backend.runTurn(request);
        assert.deepEqual(result.refs, preview.refs);
        assert.equal(result.proposal, undefined);
        let saved = (await repository.read(root)).chats[0].messages.at(-1);
        assert.equal(saved?.role, 'assistant');
        if (saved?.role === 'assistant') assert.equal(saved.planningActivity?.status, 'no-action');
        delete roadmap.linkedDocument;
        await backend.runTurn(request);
        roadmap.revision = 0;
        await backend.runTurn(request);
        assert.equal(calls, 3);
        roadmap.projectRoot = join(root, 'foreign');
        await assert.rejects(backend.previewContext(request), /foreign Roadmap help/);
        assert.equal(calls, 3);
        backend.dispose();
    } finally { await rm(root, { recursive: true, force: true }); }
});
