import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';
import { projectRoadmapDraft } from '../../packages/theia-extension/src/browser/roadmap-canvas-model.ts';
import type { GreenfieldChange } from '../../packages/project-intelligence/src/node/roadmap-greenfield.ts';

const proposal = (projectId: string, draftRevision: number, action: unknown) => JSON.stringify({
    type: 'roadmap-draft-proposal', projectId, draftRevision, action });

test('selected local model previews two draft phases with one approval and no canonical write', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-chat-draft-steps-'));
    const store = new RoadmapStore(), greenfield = new RoadmapGreenfield(store);
    const repository = new ChatRepository();
    const { handle } = await greenfield.begin(root);
    const chatId = randomUUID();
    const projectId = (await store.read(root)).projectId;
    let calls = 0;
    const answer = JSON.stringify({ type: 'roadmap-draft-sequence', projectId, draftRevision: 0,
        actions: [{ type: 'create-phase', title: 'Design' }, { type: 'create-phase', title: 'Build' }] });
    const models = { list: async () => ({ connections: [{ id: 'local', ready: true, providerId: 'local',
        models: [{ id: 'short', label: 'Short', usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 4096 } }] }] }),
        async *generate() { calls++; yield { type: 'complete' as const, text: answer }; } };
    const composer = { compose: async () => ({ messages: [{ role: 'user' as const, content: 'Two phases' }],
        refs: [], diagnostics: [], usedTokens: 20, budgetTokens: 1000 }) };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer as never,
        undefined, undefined, new ProjectPlanningActions(store), greenfield);
    try {
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: chatId, folderPath: '' } });
        const lease = await backend.claim({ projectHandle, chatId, ownerId: 'panel' });
        if (!lease.acquired) throw new Error('Chat lease missing');
        greenfield.bindChat(root, handle, chatId);
        const result = await backend.runTurn({ projectHandle, chatId, leaseToken: lease.token,
            selectedModel: { connectionId: 'local', modelId: 'short' }, planningSteps: 2, content: 'Two phases' });
        assert.ok(result.proposal);
        assert.equal(result.proposal?.action.type, 'draft-sequence');
        assert.equal(greenfield.read(handle).revision, 0);
        assert.equal((await store.read(root)).revision, 0);
        assert.equal(calls, 1);
        const message = (await backend.get(projectHandle, chatId))!.messages.at(-1)!;
        assert.equal(message.role === 'assistant' && message.planningActivity?.kind, 'roadmap-draft-sequence');
        assert.equal(message.role === 'assistant' && message.execution.actualModel?.modelId, 'short');
        await backend.decidePlanningProposal(projectHandle, chatId, lease.token, result.proposal!.id, true);
        assert.deepEqual(greenfield.read(handle).phases.map(phase => phase.title), ['Design', 'Build']);
        assert.equal((await store.read(root)).revision, 0);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true }); }
});

test('selected saved Chat previews one noncanonical draft edit; approval, stale, foreign and fallback gates', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-chat-draft-'));
    const other = await mkdtemp(join(tmpdir(), 'dope-chat-draft-other-'));
    const store = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(store);
    const changes: GreenfieldChange[] = [];
    const stopObserving = greenfield.onChange(change => changes.push(change));
    const repository = new ChatRepository();
    const outputs: string[] = [];
    const sent: string[] = [];
    let hostedCalls = 0;
    let cancelOnGenerate: (() => Promise<void>) | undefined;
    const models = { list: async () => ({ connections: [
        { id: 'local', ready: true, providerId: 'local', models: [{ id: 'short', label: 'Short', usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 4096 } }] },
        { id: 'hosted', ready: true, providerId: 'gemini', models: [{ id: 'remote', label: 'Remote', usable: true,
            capabilities: { conversationalText: true, streaming: true, contextWindowTokens: 8192 } }] }
    ] }), async *generate(target: { connectionId: string }, request: { messages: { content: string }[] }) {
        if (target.connectionId === 'hosted') hostedCalls++;
        sent.push(request.messages.map(item => item.content).join('\n'));
        if (cancelOnGenerate) { const cancel = cancelOnGenerate; cancelOnGenerate = undefined; await cancel(); }
        const beforePartial = changes.length;
        yield { type: 'delta' as const, text: '{"type":"roadmap-draft-' };
        assert.equal(changes.length, beforePartial, 'partial model text must not publish a draft event');
        yield { type: 'complete' as const, text: outputs.shift() ?? '{"type":"no-action","message":"none"}' };
    } };
    const composer = { compose: async (_root: string, _chat: unknown, content: string) => ({
        messages: [{ role: 'user' as const, content }], refs: [], diagnostics: [], usedTokens: 20, budgetTokens: 1000 }) };
    const backend = new ChatBackend(repository, { notifyChatEvent() {} }, models as never, composer as never,
        undefined, undefined, new ProjectPlanningActions(store), greenfield);
    try {
        const { handle } = await greenfield.begin(root);
        const { projectHandle } = await backend.attach(pathToFileURL(root).href);
        const selected = randomUUID(), unselected = randomUUID();
        let chats = await backend.mutate({ projectHandle, expectedRevision: 0,
            operation: { type: 'create-chat', id: selected, folderPath: '', title: 'Selected' } });
        chats = await backend.mutate({ projectHandle, expectedRevision: chats.revision,
            operation: { type: 'create-chat', id: unselected, folderPath: '', title: 'Other' } });
        const lease = await backend.claim({ projectHandle, chatId: selected, ownerId: 'panel' });
        const otherLease = await backend.claim({ projectHandle, chatId: unselected, ownerId: 'panel-2' });
        assert.ok(lease.acquired && otherLease.acquired);
        greenfield.bindChat(root, handle, selected);
        assert.throws(() => greenfield.bindChat(other, handle, selected), /Foreign/);
        const projectId = (await store.read(root)).projectId;
        const turn = (content = 'Plan') => backend.runTurn({ projectHandle, chatId: selected,
            leaseToken: lease.token, selectedModel: { connectionId: 'local', modelId: 'short' }, content });
        outputs.push(proposal(projectId, 0, { type: 'create-phase', title: 'Wrong action' }),
            '{"type":"no-action","message":"Chat cannot relink a Roadmap; nothing changed."}');
        const help = await turn('I linked the wrong Roadmap, how do I change it?');
        assert.equal(help.proposal, undefined);
        assert.doesNotMatch(sent.at(-1) ?? '', /noncanonical Roadmap draft|draftRevision/);
        assert.equal(greenfield.read(handle).revision, 0);
        assert.equal((await store.read(root)).revision, 0);
        await assert.rejects(backend.runTurn({ projectHandle, chatId: selected, leaseToken: lease.token,
            selectedModel: { connectionId: 'hosted', modelId: 'remote' }, hostedProjectDataAuthorized: true,
            content: 'Plan' }), /requires a local model/);
        assert.equal(hostedCalls, 0);
        outputs.push(proposal(projectId, 0, { type: 'create-phase', title: 'Build' }));
        const pending = (await turn()).proposal;
        assert.ok(pending);
        const proposed = changes.at(-1)!;
        assert.equal(proposed.kind, 'proposed');
        assert.equal(proposed.projectId, projectId);
        assert.equal(proposed.revision, 0);
        const graph = projectRoadmapDraft({ projectId, revision: 0, nodes: [], edges: [],
            pools: { ideas: [], issues: [] }, diagnostics: [] }, greenfield.read(handle), proposed.draft);
        assert.equal(graph.nodes.find(node => node.title === 'Build')?.draftState, 'proposed');
        assert.equal(graph.nodes.find(node => node.title === 'Build')?.status, 'not-implemented');
        assert.equal(greenfield.read(handle).revision, 0);
        assert.equal((await store.read(root)).revision, 0);
        const restartedDrafts = new RoadmapGreenfield(new RoadmapStore());
        await restartedDrafts.restore(root);
        assert.equal(restartedDrafts.chatDraft(root, selected)?.handle, handle);
        assert.equal((await new ChatRepository().read(root)).chats.some(chat => chat.id === selected), true);
        const restartedBackend = new ChatBackend(new ChatRepository(), { notifyChatEvent() {} }, models as never,
            composer as never, undefined, undefined, new ProjectPlanningActions(new RoadmapStore()), restartedDrafts);
        try {
            const reopened = await restartedBackend.attach(pathToFileURL(root).href);
            await assert.rejects(restartedBackend.decidePlanningProposal(reopened.projectHandle, selected,
                lease.token, pending.id, true), /Planning proposal unavailable/);
            assert.equal(restartedDrafts.read(handle).revision, 0);
        } finally { restartedBackend.dispose(); }
        assert.match(sent.at(-1) ?? '', /draftRevision/);
        assert.ok((sent.at(-1) ?? '').includes(proposal(projectId, 0,
            { type: 'create-phase', title: 'Example phase', objective: 'One clear objective' })));
        assert.match(sent.at(-1) ?? '', /not a property named after the action/);
        await assert.rejects(readFile(join(root, 'ROADMAP.md')), /ENOENT/);
        await backend.decidePlanningProposal(projectHandle, selected, lease.token, pending.id, false);
        assert.equal(changes.at(-1)?.kind, 'cleared');
        assert.equal(greenfield.read(handle).revision, 0);
        await assert.rejects(backend.decidePlanningProposal(projectHandle, selected, lease.token,
            pending.id, true), /Planning proposal unavailable/);

        outputs.push(proposal(projectId, 0, { type: 'create-phase', title: 'Build' }));
        const approved = (await turn()).proposal;
        assert.ok(approved);
        const result = await backend.decidePlanningProposal(projectHandle, selected, lease.token, approved.id, true);
        assert.equal(result?.revision, 1);
        assert.equal(changes.at(-1)?.kind, 'accepted');
        const phase = greenfield.read(handle).phases[0];
        assert.equal(phase.title, 'Build');
        assert.equal((await store.read(root)).revision, 0);
        await assert.rejects(readFile(join(root, 'ROADMAP.md')), /ENOENT/);

        outputs.push(proposal(projectId, 1, { type: 'create-checkpoint', phaseId: phase.id, title: 'First' }));
        const stale = (await turn()).proposal;
        assert.ok(stale);
        assert.match(sent.at(-1) ?? '', /Build/);
        greenfield.edit(handle, 1, { type: 'edit-phase', phaseId: phase.id, objective: 'Human decision' });
        await assert.rejects(backend.decidePlanningProposal(projectHandle, selected, lease.token, stale.id, true), /Stale/);
        assert.equal(greenfield.read(handle).phases[0].checkpoints.length, 0);

        outputs.push(proposal(projectId, 2, { type: 'create-checkpoint', phaseId: phase.id, title: 'First' }));
        const checkpointProposal = (await turn()).proposal;
        assert.ok(checkpointProposal);
        assert.match(sent.at(-1) ?? '', /Human decision/);
        await backend.decidePlanningProposal(projectHandle, selected, lease.token, checkpointProposal.id, true);
        const checkpointId = greenfield.read(handle).phases[0].checkpoints[0].id;
        outputs.push(proposal(projectId, 3, { type: 'edit-checkpoint', phaseId: phase.id,
            checkpointId, objective: 'Confirmed' }));
        const editProposal = (await turn()).proposal;
        assert.ok(editProposal);
        await backend.decidePlanningProposal(projectHandle, selected, lease.token, editProposal.id, true);
        assert.equal(greenfield.read(handle).phases[0].checkpoints[0].objective, 'Confirmed');
        outputs.push(proposal(projectId, 4, { type: 'reorder-checkpoint', phaseId: phase.id, checkpointId, order: 0 }));
        const reorderProposal = (await turn()).proposal;
        assert.ok(reorderProposal);
        await backend.decidePlanningProposal(projectHandle, selected, lease.token, reorderProposal.id, true);
        assert.equal(greenfield.read(handle).revision, 5);

        outputs.push(proposal('foreign', 5, { type: 'create-phase', title: 'Wrong' }));
        assert.match((await turn()).proposalError ?? '', /foreign/);
        outputs.push(proposal(projectId, 5, { type: 'shell', command: 'touch ROADMAP.md' }),
            proposal(projectId, 5, { type: 'shell', command: 'touch ROADMAP.md' }));
        await assert.rejects(turn(), /strict JSON|planning/i);
        assert.equal(greenfield.read(handle).revision, 5);
        await assert.rejects(backend.runTurn({ projectHandle, chatId: selected, leaseToken: lease.token,
            selectedModel: { connectionId: 'missing', modelId: 'missing' }, content: 'Plan' }), /unavailable/);
        outputs.push('{bad', '{bad');
        await assert.rejects(turn(), /strict JSON/);
        cancelOnGenerate = () => backend.cancelTurn(projectHandle, selected, lease.token);
        await assert.rejects(turn(), /cancelled/);
        assert.equal(greenfield.read(handle).revision, 5);
        assert.equal((await store.read(root)).revision, 0);
        await assert.rejects(readFile(join(root, 'ROADMAP.md')), /ENOENT/);
        await assert.rejects(stat(join(root, '.dope/agent')), /ENOENT/);
        assert.equal(hostedCalls, 0);
        assert.equal((await repository.read(root)).chats.find(chat => chat.id === selected)?.messages.at(-1)?.role, 'assistant');
        outputs.push(proposal(projectId, 5, { type: 'create-phase', title: 'Detached' }));
        const detached = (await turn()).proposal;
        assert.ok(detached);
        greenfield.bindChat(root, handle, unselected);
        await assert.rejects(backend.decidePlanningProposal(projectHandle, selected, lease.token, detached.id, true), /binding changed/);
        assert.equal(greenfield.read(handle).revision, 5);
        greenfield.unbindChat(root, handle);
        assert.equal((await backend.runTurn({ projectHandle, chatId: unselected, leaseToken: otherLease.token,
            selectedModel: { connectionId: 'local', modelId: 'short' }, content: 'Hello' })).proposal, undefined);
        const resumedDrafts = new RoadmapGreenfield(new RoadmapStore());
        const recovered = await resumedDrafts.restore(root);
        assert.equal(recovered[0].handle, handle);
        assert.equal(recovered[0].draft.revision, 5);
        assert.equal(recovered[0].draft.phases[0].checkpoints[0].objective, 'Confirmed');
        await writeFile(join(root, 'ROADMAP.md'), '# Existing owner\n');
        const occupied = resumedDrafts.preview(handle, 'ROADMAP.md');
        await assert.rejects(resumedDrafts.accept(handle, occupied, true), /already exists/);
        assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), '# Existing owner\n');
        const preview = resumedDrafts.preview(handle, 'NEW-ROADMAP.md');
        assert.equal((await store.read(root)).revision, 0);
        const created = await resumedDrafts.accept(handle, preview, true);
        const reopened = await new RoadmapStore().read(root);
        assert.equal(await readFile(join(root, 'NEW-ROADMAP.md'), 'utf8'), preview.markdown);
        assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), '# Existing owner\n');
        assert.equal(reopened.revision, created.revision);
        assert.deepEqual(reopened.checkpoints.map(item => item.id), created.checkpoints.map(item => item.id));
        assert.equal(reopened.linkedDocument?.path, 'NEW-ROADMAP.md');
        assert.equal(reopened.linkedDocument?.syncState, 'synced');
        assert.equal((await new ChatRepository().read(root)).chats.some(chat => chat.id === selected), true);
    } finally { stopObserving(); backend.dispose(); await rm(root, { recursive: true, force: true });
        await rm(other, { recursive: true, force: true }); }
});
