import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { ChatRepository } from '../../packages/chat/lib/node/index.js';
import { RoadmapStore } from '../../packages/project-intelligence/lib/node/roadmap-store.js';
import { RoadmapGreenfield } from '../../packages/project-intelligence/lib/node/roadmap-greenfield.js';
import { ProjectPlanningActions } from '../../packages/project-intelligence/lib/node/project-planning-actions.js';
import { ChatBackend } from '../../packages/theia-extension/lib/node/chat-backend.js';

const proposal = (projectId: string, draftRevision: number, action: unknown) => JSON.stringify({
    type: 'roadmap-draft-proposal', projectId, draftRevision, action });

test('selected saved Chat previews one noncanonical draft edit; approval, stale, foreign and fallback gates', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dope-chat-draft-'));
    const other = await mkdtemp(join(tmpdir(), 'dope-chat-draft-other-'));
    const store = new RoadmapStore();
    const greenfield = new RoadmapGreenfield(store);
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
        await assert.rejects(backend.runTurn({ projectHandle, chatId: selected, leaseToken: lease.token,
            selectedModel: { connectionId: 'hosted', modelId: 'remote' }, hostedProjectDataAuthorized: true,
            content: 'Plan' }), /requires a local model/);
        assert.equal(hostedCalls, 0);
        outputs.push(proposal(projectId, 0, { type: 'create-phase', title: 'Build' }));
        const pending = (await turn()).proposal;
        assert.ok(pending);
        assert.equal(greenfield.read(handle).revision, 0);
        assert.equal((await store.read(root)).revision, 0);
        assert.match(sent.at(-1) ?? '', /draftRevision/);
        assert.ok((sent.at(-1) ?? '').includes(proposal(projectId, 0,
            { type: 'create-phase', title: 'Example phase', objective: 'One clear objective' })));
        assert.match(sent.at(-1) ?? '', /not a property named after the action/);
        await assert.rejects(readFile(join(root, 'ROADMAP.md')), /ENOENT/);
        await backend.decidePlanningProposal(projectHandle, selected, lease.token, pending.id, false);
        assert.equal(greenfield.read(handle).revision, 0);

        outputs.push(proposal(projectId, 0, { type: 'create-phase', title: 'Build' }));
        const approved = (await turn()).proposal;
        assert.ok(approved);
        const result = await backend.decidePlanningProposal(projectHandle, selected, lease.token, approved.id, true);
        assert.equal(result?.revision, 1);
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
        const preview = greenfield.preview(handle, 'ROADMAP.md');
        assert.equal((await store.read(root)).revision, 0);
        const created = await greenfield.accept(handle, preview, true);
        const reopened = await new RoadmapStore().read(root);
        assert.equal(await readFile(join(root, 'ROADMAP.md'), 'utf8'), preview.markdown);
        assert.equal(reopened.revision, created.revision);
        assert.deepEqual(reopened.checkpoints.map(item => item.id), created.checkpoints.map(item => item.id));
        assert.equal(reopened.linkedDocument?.syncState, 'synced');
        assert.equal((await new ChatRepository().read(root)).chats.some(chat => chat.id === selected), true);
    } finally { backend.dispose(); await rm(root, { recursive: true, force: true });
        await rm(other, { recursive: true, force: true }); }
});
