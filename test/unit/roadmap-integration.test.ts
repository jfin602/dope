import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { previewRoadmapImport } from '../../packages/project-intelligence/lib/node/roadmap-import.js';
import { ProjectMindStore } from '../../packages/project-intelligence/lib/node/project-mind-store.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { PlanningStore } from '../../packages/visual-planning/lib/node/planning-store.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { ChatContextComposer } from '../../packages/theia-extension/lib/node/chat-context-composer.js';
import { createRoadmapActionRuntime } from '../../packages/theia-extension/lib/node/roadmap-action-runtime.js';
import { RoadmapInspectorModel } from '../../packages/theia-extension/lib/browser/roadmap-inspector-model.js';

const basis = { architectureRevision: 1, architectureFingerprint: 'architecture',
    physicalInputFingerprint: 'physical', physicalGeneration: 7 };
const intent = (objective: string) =>
    JSON.stringify({ type: 'roadmap-intent', intent: 'set-objective', value: objective });

test('imported Roadmap, original owners, manual inspector, Planning Map and saved Chat share guarded authority', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-roadmap-integration-'));
    const uri = pathToFileURL(root).href;
    const roadmap = new RoadmapStore(), mind = new ProjectMindStore(), maps = new PlanningStore();
    const repository = new ChatRepository();
    const outputs: string[] = [];
    const sent: string[] = [];
    let calls = 0;
    let currentBasis = basis;
    let adoption = 0;
    let agent = 0;
    const runtime = createRoadmapActionRuntime(roadmap, () => ({
        attach: async () => ({ projectHandle: 'map-handle', snapshot: await maps.read(root) }),
        read: async () => maps.read(root),
        staleness: async () => ({ stale: false, conflicts: [] }),
        currentBasis: async () => currentBasis,
        conflicts: async () => [],
        adoptTarget: async () => { adoption++; throw new Error('Adoption forbidden'); },
        launchWorkItem: async () => { agent++; throw new Error('Agent forbidden'); }
    } as never));
    let contextHandle: string | undefined;
    const composer = new ChatContextComposer(mind, maps, {} as never, repository, roadmap,
        async (_root, link) => !!contextHandle && !!await runtime.actions.readOwner(contextHandle, (await roadmap.read(root)).projectId, link));
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'short', label: 'Short', usable: true, capabilities: {
            conversationalText: true, streaming: true, contextWindowTokens: 4096 } }] }] }),
        async *generate(_selection: unknown, request: { messages: { content: string }[] }) {
            calls++;
            sent.push(request.messages.at(-1)?.content ?? '');
            yield { type: 'complete' as const, text: outputs.shift() ?? 'No action' };
        } };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer,
        undefined, undefined, runtime.actions);
    try {
        await mkdir(join(root, 'docs/roadmap'), { recursive: true });
        const markdown = '# Roadmap\n\n## Product Phase 10 — Planning\nStatus: **NOT IMPLEMENTED**\nObjective: Original objective\n';
        await writeFile(join(root, 'docs/roadmap/mvp-roadmap.md'), markdown);
        await writeFile(join(root, 'known-issues.md'), '# Known Issues\n\n## Open Issues\n\n### UBGG — 2026-10-12 — Real issue\n\n- **Status:** Open\n- Original issue\n');
        const now = '2026-10-12T12:00:00.000Z';
        const ideaId = randomUUID();
        await mind.mutate(root, 0, { type: 'create', artifact: { schemaVersion: 2, id: ideaId,
            type: 'idea', title: 'Original idea', body: 'Owner body', status: 'captured',
            provenance: 'developer', createdAt: now, updatedAt: now, archivedAt: null, links: [] } });
        const mapCollection = await maps.mutate(root, 0, { type: 'create', id: 'plan', title: 'Plan',
            objective: 'Architecture intent', basis });
        const importPreview = await previewRoadmapImport(root);
        let index = await roadmap.acceptImport(root, 0, importPreview);
        const checkpoint = index.checkpoints[0];
        assert.equal(checkpoint.status, 'not-implemented');
        const markdownBefore = await readFile(join(root, 'docs/roadmap/mvp-roadmap.md'));
        const mindBefore = await readFile(join(root, '.dope/project-mind.json'));
        const issueBefore = await readFile(join(root, 'known-issues.md'));
        const mapBefore = await readFile(join(root, '.dope/planning-maps.json'));

        const { projectHandle, snapshot } = await runtime.actions.attach(root);
        contextHandle = projectHandle;
        const detached = await runtime.actions.readDetached(projectHandle, snapshot.projectId);
        assert.deepEqual(detached.map(item => item.owner), ['project-mind', 'issue']);
        const issue = detached.find(item => item.owner === 'issue')!;
        const map = mapCollection.maps[0];
        const mapLink = { owner: 'planning-map' as const, targetId: map.id,
            ownerProjectId: mapCollection.projectId, ownerRevision: map.revision, basis };
        const issueLink = { owner: 'issue' as const, targetId: issue.targetId,
            sourceHash: issue.owner === 'issue' ? issue.sourceHash : '' };
        const linkRequest = { projectHandle, ownerId: snapshot.projectId, expectedRevision: index.revision,
            sourceHashes: { [checkpoint.id]: checkpoint.source!.sha256 }, actions: [
                { type: 'link' as const, id: checkpoint.id, link: issueLink },
                { type: 'link' as const, id: checkpoint.id, link: mapLink }] };
        const linkPreview = await runtime.actions.preview(linkRequest);
        index = await runtime.actions.apply(linkRequest, linkPreview.token);
        assert.equal(index.checkpoints[0].links.length, 2);
        assert.equal((await runtime.actions.readDetached(projectHandle, snapshot.projectId)).length, 1);
        assert.equal((await runtime.actions.readOwner(projectHandle, snapshot.projectId, mapLink))?.owner, 'planning-map');
        assert.deepEqual(await readFile(join(root, '.dope/planning-maps.json')), mapBefore);

        const service = { attach: async () => runtime.actions.attach(root), detach: async (handle: string) => runtime.actions.detach(handle),
            read: async () => roadmap.read(root), preview: runtime.actions.preview.bind(runtime.actions),
            apply: (request: Parameters<typeof runtime.actions.apply>[0], token: string, approved: boolean) =>
                runtime.actions.apply(request, token, approved),
            undo: runtime.actions.undoEligible.bind(runtime.actions),
            undoToken: async (handle: string, ownerId: string) => runtime.actions.undoToken(handle, ownerId) };
        const inspector = new RoadmapInspectorModel(service);
        inspector.setSnapshot(uri, index);
        inspector.select(checkpoint.id);
        inspector.change('objective', 'Manual objective');
        await inspector.save();
        assert.equal(inspector.requiresApproval, true);
        await inspector.approve();
        assert.equal(inspector.error, undefined);
        index = await roadmap.read(root);
        assert.equal(index.checkpoints[0].objective, 'Manual objective');
        assert.equal(index.checkpoints[0].status, 'not-implemented');
        assert.equal(calls, 0); // Manual Roadmap operation does not start a model.

        const attached = await backend.attach(uri);
        const chatId = randomUUID();
        let chat = await backend.mutate({ projectHandle: attached.projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '', title: 'Planning' } });
        const settings = structuredClone(chat.chats[0].settings);
        settings.context = { maxInputTokens: 3072, reservedOutputTokens: 512, history: 'none',
            savedChatSearch: false, allowedSources: ['roadmap-checkpoint'] };
        chat = await backend.mutate({ projectHandle: attached.projectHandle, expectedRevision: chat.revision,
            operation: { type: 'set-settings', chatId, settings } });
        const lease = await backend.claim({ projectHandle: attached.projectHandle, chatId, ownerId: 'panel' });
        assert.equal(lease.acquired, true);
        if (!lease.acquired) return;
        const context = async (revision: number) => [{ kind: 'roadmap-checkpoint' as const, id: checkpoint.id,
            projectId: index.projectId, ownerRevision: revision,
            sourceHash: (await roadmap.read(root)).checkpoints.find(item => item.id === checkpoint.id)!.source!.sha256 }];
        const turn = async (revision: number) => backend.runTurn({ projectHandle: attached.projectHandle,
            chatId, leaseToken: lease.token, selectedModel: { connectionId: 'local', modelId: 'short' },
            content: 'Plan one step', context: await context(revision) });
        outputs.push(intent('AI objective'));
        const pending = (await turn(index.revision)).proposal;
        assert.ok(pending);
        assert.equal((await roadmap.read(root)).checkpoints[0].objective, 'Manual objective');
        assert.equal(await backend.decidePlanningProposal(attached.projectHandle, chatId, lease.token, pending.id, false), undefined);
        await assert.rejects(backend.decidePlanningProposal(attached.projectHandle, chatId, lease.token, pending.id, true), /unavailable/);
        outputs.push(intent('Stale AI objective'));
        const stale = (await turn(index.revision)).proposal;
        assert.ok(stale);
        inspector.change('objective', 'Second manual objective');
        await inspector.save();
        await inspector.approve();
        index = await roadmap.read(root);
        await assert.rejects(backend.decidePlanningProposal(attached.projectHandle, chatId, lease.token, stale.id, true), /Stale/);
        await assert.rejects(turn(index.revision - 1), /Stale or foreign Roadmap context/);
        await assert.rejects(backend.runTurn({ projectHandle: attached.projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'short' }, content: 'Foreign',
            context: [{ ...(await context(index.revision))[0], projectId: 'foreign' }] }), /Stale or foreign Roadmap context/);
        outputs.push(intent('Approved AI objective'));
        const fresh = (await turn(index.revision)).proposal;
        assert.ok(fresh);
        const changed = await backend.decidePlanningProposal(attached.projectHandle, chatId, lease.token, fresh.id, true);
        assert.deepEqual(changed?.changedIds, [checkpoint.id]);
        index = await roadmap.read(root);
        assert.equal(index.checkpoints[0].objective, 'Approved AI objective');
        assert.equal(index.checkpoints[0].status, 'not-implemented');
        await assert.rejects(backend.decidePlanningProposal(attached.projectHandle, chatId, lease.token, fresh.id, true), /unavailable/);
        outputs.push('{"type":"no-action","message":"No edit"}');
        await turn(index.revision);
        assert.equal(calls, 4);
        assert.match(sent.at(-1) ?? '', /Approved AI objective/);

        currentBasis = { ...basis, physicalGeneration: 8 };
        assert.equal(await runtime.actions.readOwner(projectHandle, snapshot.projectId, mapLink), undefined);
        await assert.rejects(turn(index.revision), /Stale Planning Map basis/);
        assert.equal(calls, 4);
        await assert.rejects(runtime.actions.preview({ ...linkRequest, expectedRevision: index.revision,
            sourceHashes: { [checkpoint.id]: index.checkpoints[0].source!.sha256 },
            actions: [{ type: 'link', id: checkpoint.id,
                link: { ...mapLink, targetId: 'foreign-map' } }] }), /Foreign or unresolved/);
        assert.notDeepEqual(await readFile(join(root, 'docs/roadmap/mvp-roadmap.md')), markdownBefore);
        assert.match(await readFile(join(root, 'docs/roadmap/mvp-roadmap.md'), 'utf8'), /Objective: Approved AI objective/);
        assert.deepEqual(await readFile(join(root, '.dope/project-mind.json')), mindBefore);
        assert.deepEqual(await readFile(join(root, 'known-issues.md')), issueBefore);
        assert.deepEqual(await readFile(join(root, '.dope/planning-maps.json')), mapBefore);
        assert.equal(adoption, 0);
        assert.equal(agent, 0);
        await assert.rejects(lstat(join(root, '.dope/agent')), /ENOENT/);
        await assert.rejects(lstat(join(root, '.dope/architecture.json')), /ENOENT/);
        await backend.release(attached.projectHandle, chatId, lease.token);
        backend.dispose();
        const reopened = new ChatRepository();
        const saved = await reopened.read(root);
        assert.equal(saved.chats.length, 1);
        assert.equal(saved.chats[0].id, chatId);
        assert.equal(saved.chats[0].messages.filter(item => item.role === 'assistant').length, 4);
        assert.equal((await roadmap.read(root)).revision, index.revision);
    } finally {
        backend.dispose(); runtime.dispose();
        await rm(root, { recursive: true, force: true });
    }
});
