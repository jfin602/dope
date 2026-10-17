import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { selectDopeCapabilityHelp } from '../../packages/theia-extension/lib/node/dope-capability-help.js';
import type { RoadmapIndex, RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import type { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import type { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import type { SoftwareMapIndex } from '../../packages/code-analysis/lib/node/software-map-index.js';

test('file replacement help does not capture a normal Objective edit', () => {
    assert.equal(selectDopeCapabilityHelp('Unlink this wrong roadmap file'), 'roadmap-change-file');
    assert.equal(selectDopeCapabilityHelp('Change the linked file'), 'roadmap-change-file');
    assert.equal(selectDopeCapabilityHelp('Change the Objective in this Roadmap file'), undefined);
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
                assert.match(instructions[0].content, /Change linked file/);
                assert.match(instructions[0].content, /docs\/wrong\.md \(synced\)/);
            }
            else if (roadmap.revision === 0) assert.match(instructions[0].content, /Import Roadmap/);
            else assert.match(instructions[0].content, /No replacement action is supported/);
            yield { type: 'complete' as const, text: JSON.stringify({ type: 'no-action',
                message: roadmap.linkedDocument ? 'Nothing changed. In Roadmap, open Roadmap Markdown and setup, then Change linked file.' :
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
